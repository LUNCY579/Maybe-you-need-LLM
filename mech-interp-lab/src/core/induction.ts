/**
 * The induction circuit.
 *
 * An induction head completes a pattern it has already seen: after `[A][B] …
 * [A]` it predicts `[B]`. It does not do this alone. A previous-token head in
 * the layer below writes each token's predecessor into the token's position,
 * and the induction head matches the current token against that shifted
 * content, attends to the token that followed the last match, and copies it.
 *
 * The circuit here is hand-wired rather than trained: every weight is set by
 * the two rules above, so the behaviour is a consequence of the wiring and not
 * of a lucky run. The one intervention the paper's argument rests on is
 * available — removing the previous-token head — and the measurement is the
 * same one the paper reports: the accuracy on the positions where the next
 * token can be predicted from an earlier occurrence.
 */

import { createRng } from '@llm-materials/course-core'

/** The vocabulary the demonstrations are written in. */
export const TOKENS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

/**
 * `composed` is the two-head circuit; `ablated` keeps the induction head and
 * removes the previous-token head, whose only job is to shift the keys by one.
 */
export type InductionVariant = 'composed' | 'ablated'

export interface SequenceOptions {
  /** The length of the block that is repeated. */
  block?: number
  /** How many times the block is repeated. */
  repeats?: number
  /** The size of the vocabulary. */
  vocab?: number
  /** The seed of the block. */
  seed?: number
}

/**
 * A sequence built by drawing a block and repeating it.
 *
 * Repetition is what the circuit is for, and building the sequence this way
 * makes every position in the second and later copies predictable by
 * construction — which is what lets the accuracy be checked against the truth
 * rather than against a model's own claim.
 *
 * The block is drawn without replacement, so its tokens are distinct. With a
 * repeated token inside the block, a position could match two earlier places
 * and the head would have to choose between two different continuations; that
 * ambiguity is real, but it would blur the demonstration of the circuit
 * itself.
 */
export function buildRepeatedSequence(options: SequenceOptions = {}): number[] {
  const { block = 6, repeats = 2, vocab = 8, seed = 4 } = options
  const rng = createRng(seed)
  const pool = Array.from({ length: vocab }, (_, index) => index)
  for (let index = pool.length - 1; index > 0; index--) {
    const swap = Math.floor(rng() * (index + 1))
    const value = pool[index]!
    pool[index] = pool[swap]!
    pool[swap] = value
  }
  const base = pool.slice(0, Math.min(block, vocab))
  const sequence: number[] = []
  for (let repeat = 0; repeat < repeats; repeat++) sequence.push(...base)
  return sequence
}

/** A sequence drawn with no repetition at all. */
export function buildRandomSequence(options: { length?: number; vocab?: number; seed?: number } = {}): number[] {
  const { length = 16, vocab = 8, seed = 4 } = options
  const rng = createRng(seed)
  return Array.from({ length }, () => Math.floor(rng() * vocab))
}

export interface AttentionOptions {
  variant?: InductionVariant
  /** The softmax temperature: smaller is sharper. */
  temperature?: number
  /** The size of the vocabulary, for the prediction distribution and chance. */
  vocab?: number
}

/**
 * The attention weights of the induction head at one position.
 *
 * The query is the current token. The key at position `j` is the token at
 * `j - 1` — that is the previous-token head's contribution. The value is the
 * token at `j`. In the ablated variant the keys are the tokens themselves, so
 * the head can only find the current token's earlier occurrences and copies
 * one of those.
 */
export function attentionWeights(tokens: number[], position: number, options: AttentionOptions = {}): number[] {
  const { variant = 'composed', temperature = 0.1 } = options
  const logits: number[] = []
  for (let j = 0; j <= position; j++) {
    const key = variant === 'composed' ? (j >= 1 ? tokens[j - 1] : undefined) : tokens[j]
    logits.push(key !== undefined && key === tokens[position] ? 1 : 0)
  }
  const maximum = Math.max(...logits)
  const exponentials = logits.map((logit) => Math.exp((logit - maximum) / Math.max(temperature, 1e-6)))
  const total = exponentials.reduce((sum, value) => sum + value, 0)
  return exponentials.map((value) => value / total)
}

/**
 * The attention of the previous-token head: everything on the position before.
 * At the first position there is nothing to attend to, and the weights are all
 * zero rather than a fabricated distribution.
 */
export function previousTokenWeights(position: number): number[] {
  const weights = new Array<number>(position + 1).fill(0)
  if (position > 0) weights[position - 1] = 1
  return weights
}

/**
 * The positions whose key matches the current token: the places the head is
 * choosing between, in the same order as the attention weights.
 */
export function matchingPositions(tokens: number[], position: number): number[] {
  const matches: number[] = []
  for (let j = 1; j <= position; j++) {
    if (tokens[j - 1] === tokens[position]) matches.push(j)
  }
  return matches
}

export interface Prediction {
  /** The distribution over the vocabulary. */
  distribution: number[]
  /** The most likely token. */
  token: number
  /** How much of the attention the winning token received. */
  confidence: number
}

/**
 * The head's next-token prediction.
 *
 * Attention is over positions, and the value at each position is the token
 * there; summing the attention by token turns the positional distribution into
 * a distribution over the vocabulary.
 */
export function predictNext(tokens: number[], position: number, options: AttentionOptions = {}): Prediction {
  const weights = attentionWeights(tokens, position, options)
  const distribution = new Array<number>(options.vocab ?? TOKENS.length).fill(0)
  for (let j = 0; j <= position; j++) {
    const token = tokens[j] ?? 0
    distribution[token] = (distribution[token] ?? 0) + (weights[j] ?? 0)
  }
  let token = 0
  let confidence = -Infinity
  for (let index = 0; index < distribution.length; index++) {
    if ((distribution[index] ?? 0) > confidence) {
      confidence = distribution[index] ?? 0
      token = index
    }
  }
  return { distribution, token, confidence }
}

export interface PositionScore {
  position: number
  token: number
  next: number
  predicted: number
  confidence: number
  /** The positions whose keys matched the current token. */
  matches: number[]
  correct: boolean
}

export interface InductionReport {
  /** Every position that has a next token. */
  scores: PositionScore[]
  /** The positions where the next token follows an earlier occurrence. */
  predictable: number
  correct: number
  /** The accuracy on the predictable positions, or 0 when there are none. */
  accuracy: number
  /** The accuracy of a head that guesses one token uniformly. */
  chance: number
}

/**
 * The paper's measurement, on our sequence: of the positions where an earlier
 * occurrence makes the next token predictable, how many does the circuit get
 * right?
 */
export function inductionReport(tokens: number[], options: AttentionOptions = {}): InductionReport {
  const scores: PositionScore[] = []
  let predictable = 0
  let correct = 0
  for (let position = 1; position < tokens.length - 1; position++) {
    const matches = matchingPositions(tokens, position)
    const prediction = predictNext(tokens, position, options)
    const next = tokens[position + 1] ?? -1
    const isCorrect = prediction.token === next
    scores.push({
      position,
      token: tokens[position] ?? 0,
      next,
      predicted: prediction.token,
      confidence: prediction.confidence,
      matches,
      correct: isCorrect,
    })
    if (matches.length > 0) {
      predictable += 1
      if (isCorrect) correct += 1
    }
  }
  return {
    scores,
    predictable,
    correct,
    accuracy: predictable === 0 ? 0 : correct / predictable,
    chance: 1 / (options.vocab ?? TOKENS.length),
  }
}

export interface RepeatPoint {
  repeats: number
  accuracy: number
  predictable: number
}

/**
 * The accuracy as the block is repeated more times.
 *
 * One copy is not a pattern: with a single copy no position has an earlier
 * occurrence, so there is nothing to induce. The curve is the demonstration
 * that the circuit's competence is bought by repetition.
 */
export function accuracyByRepeats(
  options: SequenceOptions & AttentionOptions = {},
  counts: number[] = [1, 2, 3, 4],
): RepeatPoint[] {
  return counts.map((repeats) => {
    const report = inductionReport(buildRepeatedSequence({ ...options, repeats }), options)
    return { repeats, accuracy: report.accuracy * 100, predictable: report.predictable }
  })
}
