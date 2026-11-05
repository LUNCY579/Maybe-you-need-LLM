/**
 * Learning laboratory: a *real* training loop on a tiny next-token model.
 *
 * The model is a bigram language model:
 *   Pr(next = j | previous = i) = softmax(z_i) where z_i = W[i, :]
 *
 * Training minimises mean cross-entropy on a corpus of toy sentences, optionally
 * with L2 regularisation, using minibatch stochastic gradient descent. Nothing is
 * animated or invented: the loss curves come from these gradient updates.
 *
 * For a bigram model the softmax-cross-entropy gradient is the classic
 *   dL/dz = (Pr - onehot(next))
 * which is the same gradient a large model's final layer receives; the difference
 * is that a large model computes z from a Transformer stack instead of a lookup row.
 */
import { createRng, softmax, type Rng, type Vector } from './math'

export const TRAIN_CORPUS: readonly string[] = [
  'the model learns from text',
  'the model generates text',
  'the model predicts the next token',
  'the model learns from the text',
  'a large model learns from text',
  'the language model generates the next token',
  'the model predicts the next word',
  'the language model learns from the text',
]

/** A held-out slice drawn from the same toy grammar, used for validation. */
export const VALIDATION_CORPUS: readonly string[] = [
  'the model learns from the next token',
  'a large model predicts text',
  'the language model generates a token',
]

export interface BigramVocab {
  tokens: string[]
  index: Record<string, number>
}

export function buildVocab(corpus: readonly string[]): BigramVocab {
  const tokens = new Set<string>()
  for (const sentence of corpus) {
    for (const token of sentence.split(/\s+/)) if (token) tokens.add(token)
  }
  const list = Array.from(tokens).sort()
  const index: Record<string, number> = {}
  list.forEach((token, i) => {
    index[token] = i
  })
  return { tokens: list, index }
}

export interface Pair {
  prev: number
  next: number
}

export function encodePairs(sentence: string, vocab: BigramVocab): Pair[] {
  const words = sentence.split(/\s+/).filter(Boolean)
  const pairs: Pair[] = []
  for (let i = 1; i < words.length; i++) {
    const prev = vocab.index[words[i - 1]]
    const next = vocab.index[words[i]]
    if (prev === undefined || next === undefined) continue
    pairs.push({ prev, next })
  }
  return pairs
}

export function encodeCorpus(corpus: readonly string[], vocab: BigramVocab): Pair[] {
  return corpus.flatMap((sentence) => encodePairs(sentence, vocab))
}

export interface BigramModel {
  /** Weight matrix [V x V]; row i holds the logits for the token after token i. */
  weights: number[][]
  vocab: BigramVocab
}

export function initModel(vocab: BigramVocab, seed = 7, initScale = 0.01): BigramModel {
  const rng = createRng(seed)
  return {
    vocab,
    weights: vocab.tokens.map(() => vocab.tokens.map(() => (rng() - 0.5) * 2 * initScale)),
  }
}

export interface StepResult {
  loss: number
  /** Number of non-zero gradient entries — a proxy for how much is being learned. */
  gradientMagnitude: number
}

/**
 * One minibatch SGD step over `batch`.
 *
 * Loss = mean_i -log Pr(next_i | prev_i) + (λ/2) ||W||²
 *
 * The reported loss is evaluated on the parameters *before* the update and uses
 * exactly the same convention as `evaluate`, so
 * `trainStep(model, batch, lr, l2).loss === evaluate(model, batch, l2)` holds
 * for the weights the step started from. The regulariser is a property of the
 * whole parameter matrix, so it is not divided by the batch size.
 */
export function trainStep(
  model: BigramModel,
  batch: Pair[],
  learningRate: number,
  l2 = 0,
): StepResult {
  if (!Number.isFinite(learningRate) || learningRate <= 0) {
    throw new RangeError(`learningRate must be positive and finite, received ${learningRate}`)
  }
  if (batch.length === 0) return { loss: 0, gradientMagnitude: 0 }
  const v = model.vocab.tokens.length
  const grad = Array.from({ length: v }, () => new Array<number>(v).fill(0))
  let crossEntropySum = 0

  for (const { prev, next } of batch) {
    const probs = softmax(model.weights[prev])
    crossEntropySum -= Math.log(Math.max(probs[next], 1e-12))
    const row = grad[prev]
    for (let j = 0; j < v; j++) row[j] += probs[j] - (j === next ? 1 : 0)
  }
  const scale = 1 / batch.length

  // L2 penalty over the whole matrix, computed before the update.
  let penalty = 0
  for (let i = 0; i < v; i++) {
    for (let j = 0; j < v; j++) penalty += model.weights[i][j] * model.weights[i][j]
  }
  const loss = crossEntropySum * scale + (l2 > 0 ? (l2 / 2) * penalty : 0)

  let gradientMagnitude = 0
  for (let i = 0; i < v; i++) {
    for (let j = 0; j < v; j++) {
      let g = grad[i][j] * scale
      if (l2 > 0) g += l2 * model.weights[i][j]
      if (g !== 0) gradientMagnitude += Math.abs(g)
      model.weights[i][j] -= learningRate * g
    }
  }
  return { loss, gradientMagnitude }
}

/** Cross-entropy of a pair set under the current parameters (no updates). */
export function evaluate(model: BigramModel, pairs: Pair[], l2 = 0): number {
  if (pairs.length === 0) return 0
  let loss = 0
  for (const { prev, next } of pairs) {
    const probs = softmax(model.weights[prev])
    loss -= Math.log(Math.max(probs[next], 1e-12))
  }
  let total = loss / pairs.length
  if (l2 > 0) {
    let penalty = 0
    for (const row of model.weights) for (const w of row) penalty += w * w
    total += (l2 / 2) * penalty
  }
  return total
}

/** Top-1 next-token accuracy on a pair set. */
export function accuracy(model: BigramModel, pairs: Pair[]): number {
  if (pairs.length === 0) return 0
  let correct = 0
  for (const { prev, next } of pairs) {
    const probs = softmax(model.weights[prev])
    let best = 0
    for (let j = 1; j < probs.length; j++) if (probs[j] > probs[best]) best = j
    if (best === next) correct += 1
  }
  return correct / pairs.length
}

export interface TrainingConfig {
  learningRate: number
  batchSize: number
  steps: number
  l2: number
  seed: number
}

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  learningRate: 0.8,
  batchSize: 8,
  steps: 60,
  l2: 0,
  seed: 7,
}

export interface LossPoint {
  step: number
  trainLoss: number
  validationLoss: number
  trainAccuracy: number
  validationAccuracy: number
  gradientMagnitude: number
}

export interface TrainingRun {
  history: LossPoint[]
  model: BigramModel
  trainPairs: Pair[]
  validationPairs: Pair[]
  /** True when the run produced NaN/Infinity losses (a diverging learning rate). */
  diverged: boolean
}

/** Train for a fixed number of steps, recording the full loss trajectory. */
export function train(
  config: TrainingConfig,
  onPoint?: (point: LossPoint) => void,
): TrainingRun {
  const vocab = buildVocab([...TRAIN_CORPUS, ...VALIDATION_CORPUS])
  const trainPairs = encodeCorpus(TRAIN_CORPUS, vocab)
  const validationPairs = encodeCorpus(VALIDATION_CORPUS, vocab)
  if (trainPairs.length === 0) throw new Error('training corpus produced no pairs')

  const model = initModel(vocab, config.seed)
  const rng: Rng = createRng(config.seed * 977 + 13)
  const history: LossPoint[] = []
  let diverged = false

  const push = (step: number, gradientMagnitude: number) => {
    const point: LossPoint = {
      step,
      trainLoss: safeEvaluate(model, trainPairs, config.l2),
      validationLoss: safeEvaluate(model, validationPairs, config.l2),
      trainAccuracy: safeAccuracy(model, trainPairs),
      validationAccuracy: safeAccuracy(model, validationPairs),
      gradientMagnitude,
    }
    if (!Number.isFinite(point.trainLoss) || !Number.isFinite(point.validationLoss)) {
      diverged = true
    }
    history.push(point)
    onPoint?.(point)
  }

  push(0, Number.NaN)
  const batchSize = Math.max(1, Math.min(config.batchSize, trainPairs.length))
  for (let step = 1; step <= config.steps; step++) {
    // Sample a fresh minibatch. Sampling with replacement keeps small corpora usable.
    const batch: Pair[] = []
    for (let b = 0; b < batchSize; b++) {
      const pick = trainPairs[Math.floor(rng() * trainPairs.length) % trainPairs.length]
      batch.push(pick)
    }
    try {
      const result = trainStep(model, batch, config.learningRate, config.l2)
      push(step, result.gradientMagnitude)
      if (!Number.isFinite(result.loss)) {
        diverged = true
        break
      }
    } catch {
      // The parameters left the representable range: record the failure and stop,
      // exactly as a real trainer would abort rather than continue with NaNs.
      diverged = true
      push(step, Number.NaN)
      break
    }
  }
  return { history, model, trainPairs, validationPairs, diverged }
}

/**
 * Evaluation that survives an exploding parameter vector.
 * A real trainer would stop on a non-finite loss; the lab records it and keeps
 * the trajectory so learners can see *when* the run became unusable.
 */
function safeEvaluate(model: BigramModel, pairs: Pair[], l2: number): number {
  try {
    return evaluate(model, pairs, l2)
  } catch {
    return Number.NaN
  }
}

function safeAccuracy(model: BigramModel, pairs: Pair[]): number {
  try {
    return accuracy(model, pairs)
  } catch {
    return Number.NaN
  }
}

/** Row-stochastic transition matrix of the trained model, for the heatmap figure. */
export function transitionMatrix(model: BigramModel): number[][] {
  return model.weights.map((row) => softmax(row))
}

/** Predict the most likely continuation of a token under the trained model. */
export function predictNext(model: BigramModel, token: string): { token: string; probability: number } | null {
  const index = model.vocab.index[token]
  if (index === undefined) return null
  const probs = softmax(model.weights[index])
  let best = 0
  for (let j = 1; j < probs.length; j++) if (probs[j] > probs[best]) best = j
  return { token: model.vocab.tokens[best], probability: probs[best] }
}

/** Sum of squared weights — used to show what L2 regularisation actually changes. */
export function weightNorm(model: BigramModel): number {
  let sum = 0
  for (const row of model.weights) for (const w of row) sum += w * w
  return Math.sqrt(sum)
}

/** Finite-difference gradient check, used by the unit tests and by the lab UI. */
export function numericalGradient(
  model: BigramModel,
  pairs: Pair[],
  i: number,
  j: number,
  epsilon = 1e-4,
): number {
  const original = model.weights[i][j]
  model.weights[i][j] = original + epsilon
  const up = evaluate(model, pairs)
  model.weights[i][j] = original - epsilon
  const down = evaluate(model, pairs)
  model.weights[i][j] = original
  return (up - down) / (2 * epsilon)
}

/** Current logits/probabilities of one row, exposed for the figure. */
export function nextTokenDistribution(model: BigramModel, token: string): Vector | null {
  const index = model.vocab.index[token]
  if (index === undefined) return null
  return softmax(model.weights[index])
}
