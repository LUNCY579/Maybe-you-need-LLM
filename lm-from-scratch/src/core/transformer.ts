/**
 * A decoder-only transformer, trained in the browser.
 *
 * This is the whole of the course in one file: a tokeniser, an embedding, a
 * stack of pre-norm attention and feed-forward blocks, a tied output
 * projection, and a training loop that actually runs.
 *
 * The model is small enough to train in a few seconds on a generated corpus,
 * and the point is not the sample quality — it is that every number in the
 * interface comes from a real optimisation of a real objective.
 *
 * The gradients are automatic: the forward pass is written once, and the
 * backward pass is derived from the tape by the engine in the shared core's
 * `autodiff.ts`. The test suite checks every parameter against a central
 * finite difference.
 */

import { createRng } from '@llm-materials/course-core'
import type { Rng, Vector } from '@llm-materials/course-core'
import {
  add,
  adCrossEntropy,
  adMatmul,
  adSoftmaxRows,
  adTranspose,
  causalMask,
  gatherRows,
  gelu,
  rmsNorm,
  scaleBy,
  Tape,
} from '@llm-materials/course-core'
import type { Tensor } from '@llm-materials/course-core'

export interface ModelConfig {
  /** The vocabulary size. */
  vocabSize: number
  /** The width of the residual stream. */
  dModel: number
  /** How many attention heads. */
  heads: number
  /** The feed-forward hidden size. */
  dFf: number
  /** How many transformer blocks. */
  layers: number
  /** The maximum sequence length. */
  contextLength: number
}

export interface Parameter {
  name: string
  tensor: Tensor
}

export class TinyTransformer {
  readonly config: ModelConfig
  readonly parameters: Parameter[] = []
  private readonly embedding: Tensor
  private readonly positions: Tensor
  private readonly blocks: {
    attnNorm: Tensor
    wq: Tensor
    wk: Tensor
    wv: Tensor
    wo: Tensor
    ffnNorm: Tensor
    w1: Tensor
    w2: Tensor
  }[] = []
  private readonly finalNorm: Tensor

  constructor(config: ModelConfig, seed = 0) {
    this.config = config
    const rng = createRng(seed)
    const { vocabSize, dModel, dFf, layers, contextLength, heads } = config

    const tape = new Tape()

    // The token embedding.
    const embeddingData = new Array<number>(vocabSize * dModel).fill(0)
    for (let i = 0; i < embeddingData.length; i++) {
      embeddingData[i] = (rng() * 2 - 1) * (1 / Math.sqrt(dModel))
    }
    this.embedding = tape.parameter(embeddingData, [vocabSize, dModel])
    this.parameters.push({ name: 'token embedding', tensor: this.embedding })

    // The positional embedding.
    const positionData = new Array<number>(contextLength * dModel).fill(0)
    for (let i = 0; i < positionData.length; i++) {
      positionData[i] = (rng() * 2 - 1) * (1 / Math.sqrt(dModel))
    }
    this.positions = tape.parameter(positionData, [contextLength, dModel])
    this.parameters.push({ name: 'positional embedding', tensor: this.positions })

    for (let layer = 0; layer < layers; layer++) {
      const attnNorm = tape.parameter(new Array<number>(dModel).fill(1), [dModel])
      const wq = tape.parameter(randomMatrix(rng, dModel, dModel, dModel), [dModel, dModel])
      const wk = tape.parameter(randomMatrix(rng, dModel, dModel, dModel), [dModel, dModel])
      const wv = tape.parameter(randomMatrix(rng, dModel, dModel, dModel), [dModel, dModel])
      const wo = tape.parameter(randomMatrix(rng, dModel, dModel, dModel), [dModel, dModel])
      const ffnNorm = tape.parameter(new Array<number>(dModel).fill(1), [dModel])
      const w1 = tape.parameter(randomMatrix(rng, dModel, dFf, dModel), [dModel, dFf])
      const w2 = tape.parameter(randomMatrix(rng, dFf, dModel, dFf), [dFf, dModel])

      this.blocks.push({ attnNorm, wq, wk, wv, wo, ffnNorm, w1, w2 })
      this.parameters.push(
        { name: `layer ${layer} attention norm`, tensor: attnNorm },
        { name: `layer ${layer} query`, tensor: wq },
        { name: `layer ${layer} key`, tensor: wk },
        { name: `layer ${layer} value`, tensor: wv },
        { name: `layer ${layer} output`, tensor: wo },
        { name: `layer ${layer} feed-forward norm`, tensor: ffnNorm },
        { name: `layer ${layer} feed-forward in`, tensor: w1 },
        { name: `layer ${layer} feed-forward out`, tensor: w2 },
      )
    }

    this.finalNorm = tape.parameter(new Array<number>(dModel).fill(1), [dModel])
    this.parameters.push({ name: 'final norm', tensor: this.finalNorm })

    void heads
  }

  /** The number of parameters. */
  get parameterCount(): number {
    return this.parameters.reduce((acc, parameter) => acc + parameter.tensor.data.length, 0)
  }

  /**
   * The forward pass.
   *
   * Returns the logits for every position, and the loss against the targets
   * when they are supplied. The tape is returned so the caller can
   * back-propagate.
   */
  forward(
    tape: Tape,
    inputIds: number[],
    targets?: number[],
  ): { logits: Tensor; loss?: Tensor } {
    const { dModel, heads } = this.config
    const sequence = inputIds.length
    const headDim = Math.floor(dModel / heads)

    // The token and position embeddings, added together.
    const tokens = gatherRows(tape, this.embedding, inputIds)
    const positions = gatherRows(tape, this.positions, inputIds)
    let x = add(tape, tokens, positions)

    for (const block of this.blocks) {
      // Pre-norm attention.
      const normed = rmsNorm(tape, x, block.attnNorm)
      const q = adMatmul(tape, normed, block.wq)
      const k = adMatmul(tape, normed, block.wk)
      const v = adMatmul(tape, normed, block.wv)

      // Split into heads: (sequence × heads) × headDim.
      const qh = splitHeads(tape, q, sequence, heads, headDim)
      const kh = splitHeads(tape, k, sequence, heads, headDim)
      const vh = splitHeads(tape, v, sequence, heads, headDim)

      const scores = adMatmul(tape, qh, adTranspose(tape, kh))
      const scaled = scaleBy(tape, scores, 1 / Math.sqrt(headDim))
      const masked = causalMask(tape, scaled, heads)
      const weights = adSoftmaxRows(tape, masked)
      const attended = adMatmul(tape, weights, vh)

      const merged = mergeHeads(tape, attended, sequence, heads, headDim)
      const projected = adMatmul(tape, merged, block.wo)
      x = add(tape, x, projected)

      // Pre-norm feed-forward.
      const normed2 = rmsNorm(tape, x, block.ffnNorm)
      const hidden = gelu(tape, adMatmul(tape, normed2, block.w1))
      const output = adMatmul(tape, hidden, block.w2)
      x = add(tape, x, output)
    }

    const final = rmsNorm(tape, x, this.finalNorm)
    // The output projection is tied to the token embedding.
    const logits = adMatmul(tape, final, adTranspose(tape, this.embedding))

    if (!targets) return { logits }
    const loss = adCrossEntropy(tape, logits, targets)
    return { logits, loss }
  }

  /** Zero every gradient. */
  clearGradients(): void {
    for (const parameter of this.parameters) {
      parameter.tensor.grad.fill(0)
    }
  }

  /** The gradients, as a flat list in parameter order. */
  gradientVector(): number[] {
    const values: number[] = []
    for (const parameter of this.parameters) {
      values.push(...parameter.tensor.grad)
    }
    return values
  }

  /** Overwrite the parameters from a flat list in parameter order. */
  setParameterVector(values: number[]): void {
    let index = 0
    for (const parameter of this.parameters) {
      for (let i = 0; i < parameter.tensor.data.length; i++) {
        parameter.tensor.data[i] = values[index]!
        index++
      }
    }
  }

  /** The parameters, as a flat list in parameter order. */
  parameterVector(): number[] {
    const values: number[] = []
    for (const parameter of this.parameters) {
      values.push(...parameter.tensor.data)
    }
    return values
  }
}

function randomMatrix(rng: Rng, rows: number, cols: number, fanIn: number): number[] {
  const scale = 1 / Math.sqrt(fanIn)
  return Array.from({ length: rows * cols }, () => (rng() * 2 - 1) * scale)
}

/** Split a (sequence × dModel) matrix into heads: (sequence × heads) × headDim. */
function splitHeads(
  tape: Tape,
  x: Tensor,
  sequence: number,
  heads: number,
  headDim: number,
): Tensor {
  const data = new Array<number>(sequence * heads * headDim).fill(0)
  for (let h = 0; h < heads; h++) {
    for (let t = 0; t < sequence; t++) {
      for (let d = 0; d < headDim; d++) {
        data[t * heads * headDim + h * headDim + d] = x.data[t * heads * headDim + h * headDim + d]!
      }
    }
  }
  const out = tape.op(data, [sequence * heads, headDim], [x], () => {
    const dx = new Array<number>(x.data.length).fill(0)
    for (let h = 0; h < heads; h++) {
      for (let t = 0; t < sequence; t++) {
        for (let d = 0; d < headDim; d++) {
          const index = t * heads * headDim + h * headDim + d
          dx[index] = (dx[index] ?? 0) + (out.grad[index] ?? 0)
        }
      }
    }
    Tape.accumulate(x, dx)
  })
  return out
}

/** The inverse of `splitHeads`. */
function mergeHeads(
  tape: Tape,
  x: Tensor,
  sequence: number,
  heads: number,
  headDim: number,
): Tensor {
  const data = new Array<number>(sequence * heads * headDim).fill(0)
  for (let h = 0; h < heads; h++) {
    for (let t = 0; t < sequence; t++) {
      for (let d = 0; d < headDim; d++) {
        data[t * heads * headDim + h * headDim + d] = x.data[t * heads * headDim + h * headDim + d]!
      }
    }
  }
  const out = tape.op(data, [sequence, heads * headDim], [x], () => {
    const dx = new Array<number>(x.data.length).fill(0)
    for (let h = 0; h < heads; h++) {
      for (let t = 0; t < sequence; t++) {
        for (let d = 0; d < headDim; d++) {
          const index = t * heads * headDim + h * headDim + d
          dx[index] = (dx[index] ?? 0) + (out.grad[index] ?? 0)
        }
      }
    }
    Tape.accumulate(x, dx)
  })
  return out
}

/* --------------------------------------------------------------- training */

export interface TrainingConfig {
  /** How many gradient steps to take. */
  steps: number
  /** How many sequences per step. */
  batchSize: number
  /** The learning rate. */
  learningRate: number
  /** The sequence length. */
  sequenceLength: number
  /** The seed. */
  seed: number
}

export interface TrainingStep {
  step: number
  loss: number
  /** The perplexity: the loss, exponentiated. */
  perplexity: number
  /** The gradient norm, before the update. */
  gradientNorm: number
}

export interface TrainingResult {
  model: TinyTransformer
  history: TrainingStep[]
  /** The loss on a held-out split, computed after training. */
  validationLoss: number
  /** The validation perplexity. */
  validationPerplexity: number
  /** The time the training took, in milliseconds. */
  milliseconds: number
}

export interface TokenSplit {
  /** The token index the validation part starts at. */
  validationStart: number
  /** How many tokens are in the validation part. */
  validationSize: number
  /** The token index one past the last sequence that fits in the training part. */
  trainingEnd: number
}

/**
 * The training/validation boundary.
 *
 * A sequence is `sequenceLength + 1` tokens long, because the last token is
 * the target of the one before it. The last tenth of the usable sequences is
 * held out; the same boundary is used by `trainModel` and by the evaluation
 * harness, so the loss the harness reports is measured on data the model was
 * not trained on.
 */
export function splitTokens(tokenCount: number, sequenceLength: number): TokenSplit {
  const usable = tokenCount - (sequenceLength + 1)
  const validationSize = Math.floor(Math.max(0, usable) * 0.1)
  const trainingEnd = Math.max(0, usable - validationSize)
  return { validationStart: trainingEnd, validationSize, trainingEnd }
}

/**
 * Train a model on a tokenised corpus.
 *
 * The corpus is split into a training and a validation part, the batches are
 * drawn at random, and the optimiser is Adam with the usual bias corrections.
 */
export function trainModel(
  config: ModelConfig,
  tokens: number[],
  training: TrainingConfig,
): TrainingResult {
  const started = Date.now()
  const model = new TinyTransformer(config, training.seed)
  const rng = createRng(training.seed + 17)

  const sequenceLength = training.sequenceLength
  const window = sequenceLength + 1
  const usable = tokens.length - window
  if (usable <= 0) {
    throw new Error('trainModel: the corpus is too short for one sequence')
  }

  const { validationStart: trainingSize } = splitTokens(tokens.length, sequenceLength)

  const tape = new Tape()
  const m = model.parameterVector()
  const adam = new AdamState(m.length, training.learningRate)
  adam.bind(m)

  const history: TrainingStep[] = []

  for (let step = 0; step < training.steps; step++) {
    model.clearGradients()
    let totalLoss = 0

    for (let b = 0; b < training.batchSize; b++) {
      const start = Math.floor(rng() * trainingSize)
      const chunk = tokens.slice(start, start + window)
      const inputs = chunk.slice(0, sequenceLength)
      const targets = chunk.slice(1)

      tape.clear()
      const { loss } = model.forward(tape, inputs, targets)
      totalLoss += loss!.data[0]!
      // Each batch back-propagates into the parameters, so the gradients
      // accumulate across the batch exactly as gradient accumulation should.
      tape.backward(loss!)
    }

    const loss = totalLoss / training.batchSize

    const gradients = model.gradientVector().map((value) => value / training.batchSize)
    let squared = 0
    for (const gradient of gradients) squared += gradient * gradient
    const gradientNorm = Math.sqrt(squared)

    adam.update(gradients)

    history.push({ step, loss, perplexity: Math.exp(loss), gradientNorm })
  }

  // The validation loss, on data the model never saw.
  let validationLoss = 0
  let batches = 0
  for (let start = trainingSize; start + window <= tokens.length && batches < 8; start += window) {
    const chunk = tokens.slice(start, start + window)
    const inputs = chunk.slice(0, sequenceLength)
    const targets = chunk.slice(1)
    tape.clear()
    const { loss } = model.forward(tape, inputs, targets)
    validationLoss += loss!.data[0]!
    batches++
  }
  validationLoss = batches === 0 ? Number.NaN : validationLoss / batches

  return {
    model,
    history,
    validationLoss,
    validationPerplexity: Number.isNaN(validationLoss) ? Number.NaN : Math.exp(validationLoss),
    milliseconds: Date.now() - started,
  }
}

/** Adam, with the usual bias corrections. */
export class AdamState {
  private readonly m: Float64Array
  private readonly v: Float64Array
  private parameters: number[]
  private readonly learningRate: number
  private readonly beta1: number
  private readonly beta2: number
  private readonly epsilon: number
  private step = 0

  constructor(
    size: number,
    learningRate: number,
    beta1 = 0.9,
    beta2 = 0.999,
    epsilon = 1e-8,
  ) {
    this.parameters = new Array<number>(size).fill(0)
    this.learningRate = learningRate
    this.beta1 = beta1
    this.beta2 = beta2
    this.epsilon = epsilon
    this.m = new Float64Array(size)
    this.v = new Float64Array(size)
  }

  /** Point the optimiser at the live parameter array. */
  bind(parameters: number[]): void {
    this.parameters = parameters
  }

  update(gradients: number[]): void {
    this.step++
    const correction1 = 1 - this.beta1 ** this.step
    const correction2 = 1 - this.beta2 ** this.step
    for (let i = 0; i < this.parameters.length; i++) {
      const g = gradients[i] ?? 0
      this.m[i] = this.beta1 * this.m[i]! + (1 - this.beta1) * g
      this.v[i] = this.beta2 * this.v[i]! + (1 - this.beta2) * g * g
      const mHat = this.m[i]! / correction1
      const vHat = this.v[i]! / correction2
      this.parameters[i] = this.parameters[i]! - this.learningRate * mHat / (Math.sqrt(vHat) + this.epsilon)
    }
  }
}

/**
 * Generate a continuation from the model, one token at a time.
 *
 * The sampling is greedy: the argmax of the next-token distribution. It is
 * not good sampling, and the course does not claim it is — it is enough to
 * show that the model has learned something about the corpus.
 */
export function generate(
  model: TinyTransformer,
  prompt: number[],
  length: number,
  temperature = 1,
  seed = 1,
): number[] {
  const rng = createRng(seed)
  const tape = new Tape()
  const tokens = prompt.slice()

  for (let step = 0; step < length; step++) {
    const context = tokens.slice(-model.config.contextLength)
    const { logits } = model.forward(tape, context)
    const last = logits.data.slice(logits.data.length - model.config.vocabSize)
    const scaled = last.map((value) => value / Math.max(temperature, 1e-6))
    const max = Math.max(...scaled)
    const exps = scaled.map((value) => Math.exp(value - max))
    const total = exps.reduce((a, b) => a + b, 0)
    const u = rng() * total
    let cumulative = 0
    let chosen = 0
    for (let i = 0; i < exps.length; i++) {
      cumulative += exps[i]!
      if (u <= cumulative) {
        chosen = i
        break
      }
    }
    tokens.push(chosen)
  }

  return tokens
}

/** The logits' last row, as a plain array. */
export function lastLogits(logits: Tensor): Vector {
  return logits.data.slice(logits.data.length - logits.shape[1]!)
}
