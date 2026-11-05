/**
 * A small multilayer perceptron with analytic gradients.
 *
 * The diffusion laboratory trains a real denoiser, so the network has to have
 * real gradients — and the test suite checks those gradients against central
 * finite differences on every parameter, because a diffusion model trained
 * with wrong gradients produces plausible-looking nonsense.
 *
 * All parameters live in one flat array. That is not an optimisation: it is
 * what lets an optimiser hold a *live* reference to the parameters and write
 * into them, instead of mutating a copy that is then thrown away.
 */

import { createRng, gaussian } from '@llm-materials/course-core'
import type { Rng, Vector } from '@llm-materials/course-core'

export interface LayerLayout {
  /** Where this layer's weights start in the flat parameter array. */
  offset: number
  /** Number of output units. */
  rows: number
  /** Number of input units. */
  cols: number
  /** Length of this layer's bias vector. */
  biasOffset: number
}

export interface ForwardCache {
  /** The input, for the first layer's gradient. */
  input: Vector
  /** The pre-activation of each layer, except the output layer. */
  preActivations: Vector[]
  /** The post-activation of each layer, except the output layer. */
  activations: Vector[]
}

export interface LayerGradients {
  /** Gradient of the weight matrix, row-major. */
  weights: number[]
  /** Gradient of the bias vector. */
  bias: number[]
}

export interface MlpConfig {
  inputSize: number
  hiddenSizes: number[]
  outputSize: number
  seed: number
  /** Initial weight scale. Defaults to 1/√fan_in. */
  initScale?: number
}

export class Mlp {
  /** The live parameter vector. An optimiser may hold this array directly. */
  readonly parameters: number[]
  /** The layout of each layer inside `parameters`. */
  readonly layout: LayerLayout[]
  readonly inputSize: number
  readonly hiddenSizes: number[]
  readonly outputSize: number

  private readonly rng: Rng

  constructor(config: MlpConfig) {
    const { inputSize, hiddenSizes, outputSize, seed } = config
    this.inputSize = inputSize
    this.hiddenSizes = hiddenSizes.slice()
    this.outputSize = outputSize
    this.rng = createRng(seed)

    const sizes = [inputSize, ...hiddenSizes, outputSize]
    this.layout = []
    this.parameters = []

    for (let l = 0; l < sizes.length - 1; l++) {
      const fanIn = sizes[l]
      const fanOut = sizes[l + 1]
      const scale = config.initScale ?? 1 / Math.sqrt(fanIn)
      const weightOffset = this.parameters.length
      for (let i = 0; i < fanOut; i++) {
        for (let j = 0; j < fanIn; j++) {
          this.parameters.push(scale * gaussian(this.rng))
        }
      }
      const biasOffset = this.parameters.length
      for (let i = 0; i < fanOut; i++) {
        this.parameters.push(0)
      }
      this.layout.push({ offset: weightOffset, rows: fanOut, cols: fanIn, biasOffset })
    }
  }

  /** The number of parameters. */
  get size(): number {
    return this.parameters.length
  }

  /** Forward pass, keeping what the backward pass will need. */
  forward(input: Vector): { output: Vector; cache: ForwardCache } {
    if (input.length !== this.inputSize) {
      throw new Error(`Mlp.forward: expected an input of length ${this.inputSize}, received ${input.length}`)
    }
    const preActivations: Vector[] = []
    const activations: Vector[] = []
    const last = this.layout.length - 1

    let current = input.slice()
    for (let l = 0; l < this.layout.length; l++) {
      const { offset, rows, cols, biasOffset } = this.layout[l]
      const pre: Vector = new Array<number>(rows).fill(0)
      for (let i = 0; i < rows; i++) {
        let acc = this.parameters[biasOffset + i]
        for (let j = 0; j < cols; j++) {
          acc += this.parameters[offset + i * cols + j] * (current[j] ?? 0)
        }
        pre[i] = acc
      }
      preActivations.push(pre)
      // Every layer but the last is squashed with tanh; the output layer is
      // linear, so the network can predict an unbounded target such as the
      // noise vector ε.
      const post = l === last ? pre : pre.map(Math.tanh)
      activations.push(post)
      current = post
    }

    return { output: current, cache: { input: input.slice(), preActivations, activations } }
  }

  /**
   * Backward pass.
   *
   * `dOutput` is dL/d(output). The returned gradients are in layer order and
   * are flattened in the same order as `parameters`.
   */
  backward(cache: ForwardCache, dOutput: Vector): LayerGradients[] {
    const gradients: LayerGradients[] = []
    const last = this.layout.length - 1
    // `delta` is dL/d(a_l) for the layer currently being processed.
    let delta = dOutput.slice()

    for (let l = last; l >= 0; l--) {
      const { offset, rows, cols } = this.layout[l]
      const inputToLayer = l === 0 ? cache.input : cache.activations[l - 1]

      // dL/d(pre_l): the tanh derivative, except on the linear output layer.
      // The derivative of tanh is 1 − tanh(pre)², so it is the *activation*
      // that appears here, not the pre-activation.
      const activation = cache.activations[l]
      const dPre =
        l === last ? delta : delta.map((value, i) => value * (1 - activation[i] * activation[i]))

      const weights: number[] = new Array<number>(rows * cols).fill(0)
      const bias: number[] = new Array<number>(rows).fill(0)

      for (let i = 0; i < rows; i++) {
        const d = dPre[i] ?? 0
        if (d === 0) continue
        for (let j = 0; j < cols; j++) {
          weights[i * cols + j] += d * (inputToLayer[j] ?? 0)
        }
        bias[i] += d
      }

      if (l > 0) {
        // dL/d(a_{l-1})[j] = Σ_i W_l[i][j] · dL/d(pre_l)[i]
        //
        // Note the dimension: a_{l-1} has as many units as layer l has
        // *columns*, because W_l maps a_{l-1} onto pre_l.
        const nextDelta: number[] = new Array<number>(cols).fill(0)
        for (let i = 0; i < rows; i++) {
          const d = dPre[i] ?? 0
          if (d === 0) continue
          for (let j = 0; j < cols; j++) {
            nextDelta[j] += this.parameters[offset + i * cols + j] * d
          }
        }
        delta = nextDelta
      }

      gradients.unshift({ weights, bias })
    }

    return gradients
  }

  /** Overwrite all parameters from a flat vector of the same length. */
  setParameters(values: number[]): void {
    if (values.length !== this.parameters.length) {
      throw new Error(`Mlp.setParameters: expected ${this.parameters.length} values, received ${values.length}`)
    }
    for (let i = 0; i < values.length; i++) this.parameters[i] = values[i]
  }

  /** The parameters as a plain array, for a snapshot. */
  snapshot(): number[] {
    return this.parameters.slice()
  }

  /** A deep copy, so a laboratory can snapshot a model mid-training. */
  clone(): Mlp {
    const copy = Object.create(Mlp.prototype) as Mlp
    Object.assign(copy, {
      parameters: this.parameters.slice(),
      layout: this.layout,
      inputSize: this.inputSize,
      hiddenSizes: this.hiddenSizes.slice(),
      outputSize: this.outputSize,
      rng: this.rng,
    })
    return copy
  }
}

/**
 * The Adam optimiser.
 *
 * It holds a *live* reference to the parameter array, so a step really does
 * change the network. The second-moment estimate is what makes the step size
 * roughly independent of the gradient's scale.
 */
export class Adam {
  private readonly m: number[]
  private readonly v: number[]
  private step = 0
  private readonly parameters: number[]
  private readonly learningRate: number
  private readonly beta1: number
  private readonly beta2: number
  private readonly epsilon: number

  constructor(
    parameters: number[],
    learningRate: number,
    beta1 = 0.9,
    beta2 = 0.999,
    epsilon = 1e-8,
  ) {
    this.parameters = parameters
    this.learningRate = learningRate
    this.beta1 = beta1
    this.beta2 = beta2
    this.epsilon = epsilon
    this.m = new Array<number>(parameters.length).fill(0)
    this.v = new Array<number>(parameters.length).fill(0)
  }

  /** One step, given the gradients in the same order as the parameters. */
  update(gradients: number[]): void {
    this.step++
    const biasCorrection1 = 1 - this.beta1 ** this.step
    const biasCorrection2 = 1 - this.beta2 ** this.step
    for (let i = 0; i < this.parameters.length; i++) {
      const g = gradients[i] ?? 0
      this.m[i] = this.beta1 * this.m[i] + (1 - this.beta1) * g
      this.v[i] = this.beta2 * this.v[i] + (1 - this.beta2) * g * g
      const mHat = this.m[i] / biasCorrection1
      const vHat = this.v[i] / biasCorrection2
      this.parameters[i] -= this.learningRate * mHat / (Math.sqrt(vHat) + this.epsilon)
    }
  }

  /** The number of steps taken so far. */
  get iterations(): number {
    return this.step
  }
}
