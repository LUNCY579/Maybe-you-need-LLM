/**
 * An evaluation harness, not a loss curve.
 *
 * A training loss is a diagnostic: it says the optimiser is working on the
 * batches it saw. An evaluation is a measurement, and a measurement has to
 * name its data, its metric and its baseline. This module does the three
 * things a minimal harness does:
 *
 * - it holds out a split the model was not trained on (`splitTokens` in the
 *   transformer already defines it, so the harness and the training run agree
 *   on what "held out" means);
 * - it reports loss and perplexity, and two accuracy numbers — top-1 and
 *   top-5 — because a language model's argmax is not the only thing it is
 *   asked for;
 * - it reports the chance rate, and a standard error, so the accuracy can be
 *   read against what a model that knew nothing would score.
 *
 * The standard error treats tokens as independent draws. They are not — the
 * tokens in a document are correlated — so the number is a nominal one, and
 * the interface says so.
 */

import { Tape } from '@llm-materials/course-core'
import type { TinyTransformer } from './transformer.js'
import { splitTokens } from './transformer.js'

export interface EvaluationOptions {
  /** The sequence length the model is evaluated on. */
  sequenceLength: number
  /** How many non-overlapping windows to evaluate. */
  windows?: number
  /** Where in the token stream to start. Defaults to the held-out boundary. */
  start?: number
}

export interface EvaluationReport {
  /** The mean negative log-likelihood per token. */
  loss: number
  perplexity: number
  /** The fraction of positions where the argmax is the target. */
  top1: number
  /** The fraction of positions where the target is in the five best logits. */
  top5: number
  /** What a model that assigned every token the same probability would score. */
  chance: number
  /** How many token positions were scored. */
  tokens: number
  /** The nominal standard error of the top-1 accuracy. */
  standardError: number
  /** How many non-overlapping windows were scored. */
  windows: number
}

/**
 * Score a model on a held-out slice of a token stream.
 *
 * The windows are non-overlapping and taken in order, which makes the result
 * reproducible: there is no sampling and no seed. The last window is dropped
 * if it does not fit, rather than padded, because padding would change the
 * distribution the model is scored on.
 */
export function evaluateModel(
  model: TinyTransformer,
  tokens: number[],
  options: EvaluationOptions,
): EvaluationReport {
  const sequenceLength = Math.max(1, options.sequenceLength)
  const window = sequenceLength + 1
  const start = options.start ?? splitTokens(tokens.length, sequenceLength).validationStart
  const available = Math.max(0, Math.floor((tokens.length - start) / window))
  const count = Math.min(options.windows ?? 8, available)

  const tape = new Tape()
  let negativeLogLikelihood = 0
  let top1 = 0
  let top5 = 0
  let scored = 0

  for (let index = 0; index < count; index++) {
    const offset = start + index * window
    const chunk = tokens.slice(offset, offset + window)
    const inputs = chunk.slice(0, sequenceLength)
    const targets = chunk.slice(1)
    tape.clear()
    const { logits } = model.forward(tape, inputs)
    const vocabulary = logits.shape[1]!
    const best = topK(logits.data, logits.shape[0]!, vocabulary, 5)

    for (let position = 0; position < sequenceLength; position++) {
      const row = logits.data.slice(position * vocabulary, (position + 1) * vocabulary)
      const target = targets[position]!
      negativeLogLikelihood += -logProbability(row, target)
      if (best[position]![0] === target) top1++
      if (best[position]!.includes(target)) top5++
      scored++
    }
  }

  const loss = scored === 0 ? Number.NaN : negativeLogLikelihood / scored
  const accuracy = scored === 0 ? 0 : top1 / scored
  return {
    loss,
    perplexity: Number.isFinite(loss) ? Math.exp(loss) : Number.NaN,
    top1: accuracy,
    top5: scored === 0 ? 0 : top5 / scored,
    chance: 1 / model.config.vocabSize,
    tokens: scored,
    standardError: scored === 0 ? Number.NaN : Math.sqrt((accuracy * (1 - accuracy)) / scored),
    windows: count,
  }
}

/** The log-probability the model gave to one target, from its logits row. */
export function logProbability(logits: number[] | Float64Array, target: number): number {
  let max = Number.NEGATIVE_INFINITY
  for (const value of logits) {
    if (value > max) max = value
  }
  let sum = 0
  for (const value of logits) sum += Math.exp(value - max)
  const logit = logits[target]
  if (logit === undefined) return Number.NEGATIVE_INFINITY
  return logit - max - Math.log(sum)
}

/** The best `k` token ids at every position of a logits matrix. */
function topK(data: number[], rows: number, vocabulary: number, k: number): number[][] {
  const result: number[][] = []
  for (let row = 0; row < rows; row++) {
    const indices: number[] = []
    const values: number[] = []
    for (let id = 0; id < vocabulary; id++) {
      const value = data[row * vocabulary + id]!
      if (indices.length === k && value <= values[k - 1]!) continue
      let position = indices.length
      while (position > 0 && values[position - 1]! < value) position--
      indices.splice(position, 0, id)
      values.splice(position, 0, value)
      if (indices.length > k) {
        indices.pop()
        values.pop()
      }
    }
    result.push(indices)
  }
  return result
}
