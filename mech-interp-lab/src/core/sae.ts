/**
 * A sparse autoencoder, trained on activations.
 *
 * The idea: a model's residual stream holds a superposition — several features
 * packed into the same direction. A sparse autoencoder tries to recover them
 * by looking for a *sparse* code: an overcomplete dictionary in which each
 * activation is a combination of a few dictionary elements.
 *
 * The autoencoder here is the standard one:
 *
 *   f = ReLU(W_enc (x − b_pre) + b_enc)      the sparse code
 *   x̂ = W_dec f + b_pre                        the reconstruction
 *   L = ‖x − x̂‖² + λ‖f‖₁                      reconstruction plus sparsity
 *
 * The gradients are automatic, from the shared core's engine, so the training
 * loop is a real optimisation of a real objective.
 *
 * One thing in the loop is not in those equations: after every step each
 * dictionary element is rescaled to unit length, with the length moved into the
 * encoder so the reconstruction is untouched. That pin is what makes λ a sparsity
 * pressure rather than a bargain — see `trainAutoencoder`.
 */

import { createRng } from '@llm-materials/course-core'
import {
  Tape,
  abs,
  add,
  adMatmul,
  sumAll,
  addBias,
  elementwise,
  relu,
  scale,
  square,
} from '@llm-materials/course-core'

export interface SparseAutoencoder {
  /** The encoder, dimensions × features. */
  encoder: number[][]
  /** The decoder, features × dimensions. */
  decoder: number[][]
  /** The pre-activation bias of the decoder. */
  decoderBias: number[]
  /** The bias of the encoder. */
  encoderBias: number[]
  dimensions: number
  features: number
}

export interface SaeTrainingResult {
  autoencoder: SparseAutoencoder
  /** The loss at every recorded step. */
  history: { step: number; loss: number; reconstruction: number; sparsity: number }[]
  /** The final mean squared reconstruction error. */
  reconstructionError: number
  /** The final mean number of active features. */
  l0: number
  /** The fraction of the activation variance the reconstruction explains. */
  explainedVariance: number
  /** The number of training steps taken. */
  steps: number
}

interface Tensors {
  encoder: ReturnType<Tape['parameter']>
  decoder: ReturnType<Tape['parameter']>
  decoderBias: ReturnType<Tape['parameter']>
  encoderBias: ReturnType<Tape['parameter']>
}

/** A sparse autoencoder with random initialisation. */
export function createAutoencoder(
  dimensions: number,
  features: number,
  seed = 5,
): SparseAutoencoder {
  const rng = createRng(seed)
  const encoder: number[][] = []
  for (let i = 0; i < dimensions; i++) {
    const row: number[] = []
    for (let j = 0; j < features; j++) {
      row.push((rng() * 2 - 1) * (1 / Math.sqrt(dimensions)))
    }
    encoder.push(row)
  }
  const decoder: number[][] = []
  for (let i = 0; i < features; i++) {
    const row: number[] = []
    for (let j = 0; j < dimensions; j++) {
      row.push((rng() * 2 - 1) * (1 / Math.sqrt(features)))
    }
    decoder.push(row)
  }
  return {
    encoder,
    decoder,
    decoderBias: new Array<number>(dimensions).fill(0),
    encoderBias: new Array<number>(features).fill(0),
    dimensions,
    features,
  }
}

function toTensors(tape: Tape, autoencoder: SparseAutoencoder): Tensors {
  return {
    encoder: tape.parameter(autoencoder.encoder.flat(), [autoencoder.dimensions, autoencoder.features]),
    decoder: tape.parameter(autoencoder.decoder.flat(), [autoencoder.features, autoencoder.dimensions]),
    decoderBias: tape.parameter(autoencoder.decoderBias.slice(), [autoencoder.dimensions]),
    encoderBias: tape.parameter(autoencoder.encoderBias.slice(), [autoencoder.features]),
  }
}

/** The loss of one example, with its two parts. */
function autoencoderLoss(
  tape: Tape,
  tensors: Tensors,
  x: number[],
  lambda: number,
): {
  code: number[]
  reconstruction: number[]
  reconstructionLoss: ReturnType<Tape['op']>
  sparsityLoss: ReturnType<Tape['op']>
} {
  const dimensions = tensors.decoderBias.shape[0] ?? 0

  const xTensor = tape.parameter(x, [1, dimensions])

  // f = ReLU(W_enc (x − b_pre) + b_enc)
  const negBias = scale(tape, tensors.decoderBias, -1)
  const centred = add(tape, xTensor, negBias)
  const encoded = adMatmul(tape, centred, tensors.encoder)
  const biased = addBias(tape, encoded, tensors.encoderBias)
  const code = relu(tape, biased)

  // x̂ = W_dec f + b_pre, where W_dec is (features × dimensions).
  const decoded = adMatmul(tape, code, tensors.decoder)
  const reconstruction = addBias(tape, decoded, tensors.decoderBias)

  // ‖x − x̂‖²
  const difference = elementwise(
    tape,
    xTensor,
    reconstruction,
    (a, b) => a - b,
    (_a, _b, g) => [g, -g],
  )
  const squared = square(tape, difference)
  const reconstructionLoss = sumAll(tape, squared)

  // λ‖f‖₁
  const magnitudes = abs(tape, code)
  const sparsityLoss = scale(tape, sumAll(tape, magnitudes), lambda)

  return {
    code: code.data,
    reconstruction: reconstruction.data,
    reconstructionLoss,
    sparsityLoss,
  }
}

export interface SaeTrainingOptions {
  steps?: number
  learningRate?: number
  /** The weight on the L1 penalty. */
  sparsityCoefficient?: number
  /** The seed. */
  seed?: number
}

/**
 * Train a sparse autoencoder on a set of activations.
 *
 * The objective is per-example, so a batch of one is enough; the model is
 * small and the activations are few.
 */
export function trainAutoencoder(
  activations: number[][],
  features: number,
  options: SaeTrainingOptions = {},
): SaeTrainingResult {
  const steps = options.steps ?? 800
  const learningRate = options.learningRate ?? 0.03
  const lambda = options.sparsityCoefficient ?? 0.05
  const dimensions = activations[0]?.length ?? 0
  const seed = options.seed ?? 5

  const autoencoder = createAutoencoder(dimensions, features, seed)
  const tape = new Tape()
  const tensors = toTensors(tape, autoencoder)

  const history: SaeTrainingResult['history'] = []
  const rng = createRng(seed + 31)

  const parameterTensors = [tensors.encoder, tensors.decoder, tensors.decoderBias, tensors.encoderBias]
  const m = parameterTensors.map((tensor) => new Float64Array(tensor.data.length))
  const v = parameterTensors.map((tensor) => new Float64Array(tensor.data.length))
  let step = 0

  for (let iteration = 0; iteration < steps; iteration++) {
    const example = activations[Math.floor(rng() * activations.length)]!

    for (const tensor of parameterTensors) tensor.grad.fill(0)
    tape.clear()

    const { reconstructionLoss, sparsityLoss } = autoencoderLoss(tape, tensors, example, lambda)
    const total = reconstructionLoss.data[0]! + sparsityLoss.data[0]!
    const combined = add(tape, reconstructionLoss, sparsityLoss)
    tape.backward(combined)

    // The Adam update.
    step++
    const correction1 = 1 - 0.9 ** step
    const correction2 = 1 - 0.999 ** step
    for (let t = 0; t < parameterTensors.length; t++) {
      const tensor = parameterTensors[t]!
      for (let i = 0; i < tensor.data.length; i++) {
        const g = tensor.grad[i] ?? 0
        m[t]![i] = 0.9 * m[t]![i]! + 0.1 * g
        v[t]![i] = 0.999 * v[t]![i]! + 0.001 * g * g
        const mHat = m[t]![i]! / correction1
        const vHat = v[t]![i]! / correction2
        tensor.data[i] = tensor.data[i]! - learningRate * mHat / (Math.sqrt(vHat) + 1e-8)
      }
    }

    // Pin every dictionary element to unit length, and move the length into the
    // encoder so that the reconstruction is left exactly as it was:
    //
    //   x̂ = Σ_f W_dec[f] c_f   with   c_f = ReLU(W_enc[f] · (x − b_pre) + b_enc[f])
    //
    // ReLU is positively homogeneous, so dividing row `f` of the decoder by `s` and
    // multiplying that row's encoder weights and bias by the same `s` changes
    // nothing you can see.
    //
    // It changes everything about the penalty, though. Without the pin the
    // optimiser can grow the dictionary and shrink the code, and pay less λ for the
    // same reconstruction: the L1 term is then not a sparsity pressure at all but a
    // runaway, and a sweep over λ measures that instead of the trade-off. Real
    // implementations pin the dictionary for the same reason. A row whose length has
    // already collapsed is left alone — dividing by nothing would be worse.
    for (let f = 0; f < features; f++) {
      let length = 0
      for (let d = 0; d < dimensions; d++) {
        const value = tensors.decoder.data[f * dimensions + d] ?? 0
        length += value * value
      }
      length = Math.sqrt(length)
      if (length < 1e-6 || !Number.isFinite(length)) continue
      const inverse = 1 / length
      for (let d = 0; d < dimensions; d++) {
        const at = f * dimensions + d
        tensors.decoder.data[at] = (tensors.decoder.data[at] ?? 0) * inverse
        const column = d * features + f
        tensors.encoder.data[column] = (tensors.encoder.data[column] ?? 0) * length
      }
      tensors.encoderBias.data[f] = (tensors.encoderBias.data[f] ?? 0) * length
    }

    if (iteration % 25 === 0 || iteration === steps - 1) {
      history.push({
        step: iteration,
        loss: total,
        reconstruction: reconstructionLoss.data[0] ?? 0,
        sparsity: sparsityLoss.data[0] ?? 0,
      })
    }
  }

  const trained = readAutoencoder(tensors)
  const evaluation = evaluateAutoencoder(trained, activations)

  return {
    autoencoder: trained,
    history,
    reconstructionError: evaluation.reconstructionError,
    l0: evaluation.l0,
    explainedVariance: evaluation.explainedVariance,
    steps,
  }
}

/** Read the trained parameters back into a plain object. */
function readAutoencoder(tensors: Tensors): SparseAutoencoder {
  return {
    encoder: chunk(tensors.encoder.data, tensors.encoder.shape[1] ?? 1),
    decoder: chunk(tensors.decoder.data, tensors.decoder.shape[1] ?? 1),
    decoderBias: tensors.decoderBias.data.slice(),
    encoderBias: tensors.encoderBias.data.slice(),
    dimensions: tensors.decoderBias.shape[0] ?? 0,
    features: tensors.encoderBias.shape[0] ?? 0,
  }
}

function chunk(values: number[], width: number): number[][] {
  const rows: number[][] = []
  for (let i = 0; i < values.length; i += width) {
    rows.push(values.slice(i, i + width))
  }
  return rows
}

/** Encode one activation. */
export function encode(autoencoder: SparseAutoencoder, x: number[]): number[] {
  const centred = x.map((value, i) => value - (autoencoder.decoderBias[i] ?? 0))
  const code = new Array<number>(autoencoder.features).fill(0)
  for (let f = 0; f < autoencoder.features; f++) {
    let total = autoencoder.encoderBias[f] ?? 0
    for (let d = 0; d < autoencoder.dimensions; d++) {
      total += (autoencoder.encoder[d]?.[f] ?? 0) * centred[d]!
    }
    code[f] = total > 0 ? total : 0
  }
  return code
}

/** Decode a code back into an activation. */
export function decode(autoencoder: SparseAutoencoder, code: number[]): number[] {
  const reconstruction = new Array<number>(autoencoder.dimensions).fill(0)
  for (let d = 0; d < autoencoder.dimensions; d++) {
    let total = autoencoder.decoderBias[d] ?? 0
    for (let f = 0; f < autoencoder.features; f++) {
      total += (autoencoder.decoder[f]?.[d] ?? 0) * (code[f] ?? 0)
    }
    reconstruction[d] = total
  }
  return reconstruction
}

export interface SaeEvaluation {
  /** The mean squared reconstruction error. */
  reconstructionError: number
  /** The mean number of active features. */
  l0: number
  /** The fraction of the activation variance the reconstruction explains. */
  explainedVariance: number
}

/** Measure an autoencoder on a set of activations. */
export function evaluateAutoencoder(
  autoencoder: SparseAutoencoder,
  activations: number[][],
): SaeEvaluation {
  let squaredError = 0
  let totalVariance = 0
  let activeTotal = 0

  for (const x of activations) {
    const code = encode(autoencoder, x)
    const reconstruction = decode(autoencoder, code)
    for (let d = 0; d < x.length; d++) {
      const error = x[d]! - reconstruction[d]!
      squaredError += error * error
    }
    const mean = x.reduce((a, b) => a + b, 0) / Math.max(1, x.length)
    for (const value of x) totalVariance += (value - mean) ** 2
    activeTotal += code.filter((value) => value > 0).length
  }

  const count = Math.max(1, activations.length)
  const width = Math.max(1, activations[0]?.length ?? 1)
  const reconstructionError = squaredError / (count * width)
  const variance = totalVariance / (count * width)

  return {
    reconstructionError,
    l0: activeTotal / count,
    explainedVariance: variance === 0 ? 0 : 1 - reconstructionError / variance,
  }
}

/**
 * How monosemantic a dictionary feature is.
 *
 * A feature is monosemantic if it activates for one input feature and not for
 * the others. This is the measurement the sparse-autoencoder paper reports,
 * and it is what distinguishes a dictionary feature from a neuron.
 */
export function monosemanticity(
  autoencoder: SparseAutoencoder,
  activations: number[][],
  /** Which input feature each activation came from. */
  labels: number[],
): number[] {
  const activationCount = new Array<number>(autoencoder.features).fill(0)
  const labelCounts = new Map<number, number[]>()

  for (let i = 0; i < activations.length; i++) {
    const code = encode(autoencoder, activations[i]!)
    const label = labels[i] ?? 0
    for (let f = 0; f < autoencoder.features; f++) {
      if ((code[f] ?? 0) > 0) {
        activationCount[f] = (activationCount[f] ?? 0) + 1
        const counts = labelCounts.get(f) ?? []
        counts[label] = (counts[label] ?? 0) + 1
        labelCounts.set(f, counts)
      }
    }
  }

  return activationCount.map((count, f) => {
    if (count === 0) return 0
    const counts = labelCounts.get(f) ?? []
    let best = 0
    for (const value of counts) {
      if (Number.isFinite(value) && value > best) best = value
    }
    return best / count
  })
}
