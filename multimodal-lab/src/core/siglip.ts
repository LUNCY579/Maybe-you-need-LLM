/**
 * The two language-image losses.
 *
 * CLIP's contrastive loss normalises each image's scores over the whole batch:
 * the probability of the right caption is a softmax, so the loss of one pair
 * depends on every other pair in the batch. SigLIP replaces it with a sum of
 * independent logistic losses, one per pair, which needs no view of the batch
 * at all — the normalisation is gone, and with it the coupling.
 *
 * The logits here are synthetic and the losses are computed exactly. The point
 * of the laboratory is the dependence structure, which is a property of the
 * losses and not of the encoders that produced the numbers.
 */

import { createRng } from '@llm-materials/course-core'

export interface LogitOptions {
  /** The number of pairs in the batch. */
  size?: number
  /** The similarity of a correct pair. */
  margin?: number
  /** The half-width of the uniform noise on every similarity. */
  noise?: number
  /** The seed. */
  seed?: number
}

/**
 * A batch of pairwise similarities: the diagonal pairs are matched, and are
 * given a margin over the off-diagonal ones.
 */
export function buildLogits(options: LogitOptions = {}): number[][] {
  const { size = 8, margin = 0.4, noise = 0.05, seed = 4 } = options
  const rng = createRng(seed)
  const logits: number[][] = []
  for (let i = 0; i < size; i++) {
    const row: number[] = []
    for (let j = 0; j < size; j++) {
      const jitter = (rng() * 2 - 1) * noise
      row.push(i === j ? margin + jitter : jitter)
    }
    logits.push(row)
  }
  return logits
}

/** The stable softplus: log(1 + e^x), without overflowing. */
export function softplus(value: number): number {
  if (value > 0) return value + Math.log1p(Math.exp(-value))
  return Math.log1p(Math.exp(value))
}

/* -------------------------------------------------------------------------- */
/* The softmax loss                                                            */
/* -------------------------------------------------------------------------- */

/** The softmax cross-entropy of one row: the caption at `row` against the rest. */
export function softmaxRowLoss(logits: number[][], row: number, temperature = 0.1): number {
  const values = logits[row] ?? []
  if (values.length === 0) return 0
  const scaled = values.map((value) => value / Math.max(temperature, 1e-6))
  const maximum = Math.max(...scaled)
  const exponentials = scaled.map((value) => Math.exp(value - maximum))
  const total = exponentials.reduce((sum, value) => sum + value, 0)
  const correct = exponentials[row] ?? 0
  return -Math.log(Math.max(correct / total, 1e-12))
}

/** The CLIP-style contrastive loss: the mean over the rows. */
export function softmaxLoss(logits: number[][], temperature = 0.1): number {
  if (logits.length === 0) return 0
  let total = 0
  for (let row = 0; row < logits.length; row++) total += softmaxRowLoss(logits, row, temperature)
  return total / logits.length
}

/**
 * The softmax probabilities of one image over the captions of the batch. They
 * sum to one, because they are a distribution over the batch.
 */
export function softmaxProbabilities(logits: number[][], row: number, temperature = 0.1): number[] {
  const values = logits[row] ?? []
  if (values.length === 0) return []
  const scaled = values.map((value) => value / Math.max(temperature, 1e-6))
  const maximum = Math.max(...scaled)
  const exponentials = scaled.map((value) => Math.exp(value - maximum))
  const total = exponentials.reduce((sum, value) => sum + value, 0)
  return exponentials.map((value) => value / total)
}

/* -------------------------------------------------------------------------- */
/* The sigmoid loss                                                            */
/* -------------------------------------------------------------------------- */

export interface SigmoidOptions {
  /** The learned scale, the paper's t. */
  scale?: number
  /** The learned bias, the paper's b. */
  bias?: number
}

/**
 * The paper's initialisation: t′ = 10 and b = −10, for batches in the tens of
 * thousands. The bias is what keeps the many negatives from dominating the
 * first steps, and the laboratory exposes it so that its role can be seen.
 */
export const PAPER_SCALE = 10
export const PAPER_BIAS = -10

/**
 * The loss of one pair.
 *
 * With the label +1 for a matched pair and −1 for an unmatched one, the loss
 * is −log σ(y (t·s + b)) = softplus(−y (t·s + b)). It depends on this pair
 * alone.
 */
export function sigmoidPairLoss(
  logit: number,
  label: 1 | -1,
  options: SigmoidOptions = {},
): number {
  const { scale = PAPER_SCALE, bias = PAPER_BIAS } = options
  return softplus(-label * (scale * logit + bias))
}

/** The mean of the sigmoid loss over every pair in the batch. */
export function sigmoidLoss(logits: number[][], options: SigmoidOptions = {}): number {
  if (logits.length === 0) return 0
  let total = 0
  let count = 0
  for (let i = 0; i < logits.length; i++) {
    for (let j = 0; j < (logits[i]?.length ?? 0); j++) {
      total += sigmoidPairLoss(logits[i]?.[j] ?? 0, i === j ? 1 : -1, options)
      count += 1
    }
  }
  return count === 0 ? 0 : total / count
}

/**
 * The sigmoid probability that each pair in a row is a match. Each one is
 * decided alone, so the row does not sum to one — which is the whole point.
 */
export function sigmoidProbabilities(logits: number[][], row: number, options: SigmoidOptions = {}): number[] {
  const { scale = PAPER_SCALE, bias = PAPER_BIAS } = options
  return (logits[row] ?? []).map((value) => 1 / (1 + Math.exp(-(scale * value + bias))))
}

/**
 * The bias that makes the positive and negative priors balance: the log of the
 * number of negatives per positive. The paper's own negative-to-positive ratio
 * experiment varies the same quantity.
 */
export function balancedBias(size: number): number {
  return -Math.log(Math.max(size - 1, 1))
}

/* -------------------------------------------------------------------------- */
/* The coupling experiment                                                     */
/* -------------------------------------------------------------------------- */

/** A pair that shares nothing with the batch: a fresh row and column of noise. */
export function appendUnrelatedPair(
  logits: number[][],
  options: { margin?: number; noise?: number; seed?: number } = {},
): number[][] {
  const { margin = 0.4, noise = 0.05, seed = 17 } = options
  const size = logits.length
  if (size === 0) return buildLogits({ size: 1, margin, noise, seed })
  const rng = createRng(seed)
  const row: number[] = []
  for (let j = 0; j < size; j++) row.push((rng() * 2 - 1) * noise)
  row.push(margin + (rng() * 2 - 1) * noise)
  const augmented = logits.map((existing) => [...existing, (rng() * 2 - 1) * noise])
  augmented.push(row)
  return augmented
}

export interface CouplingReport {
  /** The loss of the first correct pair under each loss. */
  sigmoidPairBefore: number
  sigmoidPairAfter: number
  /** The softmax loss of the first row, before and after the extra pair. */
  softmaxRowBefore: number
  softmaxRowAfter: number
  /** The mean losses over the batch. */
  sigmoidMeanBefore: number
  sigmoidMeanAfter: number
  softmaxMeanBefore: number
  softmaxMeanAfter: number
}

/**
 * What the extra pair does to the loss of a pair that did not change.
 *
 * The sigmoid loss of pair (0, 0) is the same to machine precision. The softmax
 * row loss of the first image is not: the denominator has grown, so the right
 * caption now holds a smaller share of the probability.
 */
export function couplingReport(
  logits: number[][],
  options: { temperature?: number } & SigmoidOptions & { margin?: number; noise?: number; seed?: number } = {},
): CouplingReport {
  const { temperature = 0.1, ...rest } = options
  const augmented = appendUnrelatedPair(logits, rest)
  return {
    sigmoidPairBefore: sigmoidPairLoss(logits[0]?.[0] ?? 0, 1, rest),
    sigmoidPairAfter: sigmoidPairLoss(augmented[0]?.[0] ?? 0, 1, rest),
    softmaxRowBefore: softmaxRowLoss(logits, 0, temperature),
    softmaxRowAfter: softmaxRowLoss(augmented, 0, temperature),
    sigmoidMeanBefore: sigmoidLoss(logits, rest),
    sigmoidMeanAfter: sigmoidLoss(augmented, rest),
    softmaxMeanBefore: softmaxLoss(logits, temperature),
    softmaxMeanAfter: softmaxLoss(augmented, temperature),
  }
}

export interface CouplingPoint {
  /** How many unrelated pairs have been added to the batch. */
  extra: number
  sigmoidPair: number
  softmaxRow: number
  [key: string]: number
}

/**
 * The loss of pair (0, 0) under each objective as unrelated pairs are appended
 * to the batch. One line is flat, and that is the entire argument.
 */
export function couplingSweep(
  logits: number[][],
  extras = 6,
  options: { temperature?: number } & SigmoidOptions & { margin?: number; noise?: number; seed?: number } = {},
): CouplingPoint[] {
  const { temperature = 0.1, margin = 0.4, noise = 0.05, seed = 17, ...rest } = options
  const points: CouplingPoint[] = []
  let batch = logits
  for (let extra = 0; extra <= extras; extra++) {
    if (extra > 0) batch = appendUnrelatedPair(batch, { margin, noise, seed: seed + extra })
    points.push({
      extra,
      sigmoidPair: sigmoidPairLoss(batch[0]?.[0] ?? 0, 1, rest),
      softmaxRow: softmaxRowLoss(batch, 0, temperature),
    })
  }
  return points
}
