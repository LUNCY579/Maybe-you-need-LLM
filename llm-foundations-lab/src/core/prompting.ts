import type { LabSettings } from '../components/lab/settings'

/**
 * Few-shot prompting, as an analytic model rather than a run.
 *
 * GPT-3's headline result is that a language model can be taught a task by
 * putting examples in the prompt, with no gradient step. Two things follow,
 * and both are quantified here: the accuracy rises with the number of
 * demonstrations and saturates, and the *labels* of those demonstrations leak
 * into the model's answer — a prompt with four examples of one label and one
 * of another makes the model more likely to emit the frequent label. The
 * constants are chosen to reproduce the shape the paper reports; they are not
 * a fit to GPT-3's measured curves, and the numbers are not a measurement of
 * any model.
 */

/** The parameters of the synthetic in-context learner. */
export interface InContextModel {
  /** The number of labels, which sets the chance rate. */
  labels: number
  /** The accuracy the model approaches with unlimited demonstrations. */
  ceiling: number
  /** How many demonstrations it takes to close most of the gap. */
  scale: number
  /** The strength with which prompt labels pull the model's prior. */
  labelPull: number
}

export const DEFAULT_IN_CONTEXT_MODEL: InContextModel = {
  labels: 4,
  ceiling: 0.9,
  scale: 3,
  labelPull: 0.8,
}

/** The accuracy after `n` demonstrations, for a model of the given shape. */
export function fewShotAccuracy(n: number, model: InContextModel = DEFAULT_IN_CONTEXT_MODEL): number {
  const chance = 1 / model.labels
  const demonstrations = Math.max(0, n)
  return chance + (model.ceiling - chance) * (1 - Math.exp(-demonstrations / model.scale))
}

export interface FewShotPoint {
  demonstrations: number
  accuracy: number
  chance: number
}

/** The accuracy curve, one row per demonstration count. */
export function fewShotCurve(
  counts: readonly number[] = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32],
  model: InContextModel = DEFAULT_IN_CONTEXT_MODEL,
): FewShotPoint[] {
  return counts.map((demonstrations) => ({
    demonstrations,
    accuracy: fewShotAccuracy(demonstrations, model),
    chance: 1 / model.labels,
  }))
}

/**
 * The label distribution the prompt induces.
 *
 * With no demonstrations the model falls back on a flat prior over labels.
 * As demonstrations accumulate, the empirical label frequency leaks in with
 * weight `labelPull`, so a prompt whose examples are 4:0 makes the model's
 * predicted label share follow the prompt rather than the task.
 */
export function inducedLabelShare(
  counts: readonly number[],
  labelPull = DEFAULT_IN_CONTEXT_MODEL.labelPull,
): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0)
  const labels = counts.length
  if (labels === 0) return []
  if (total === 0) return counts.map(() => 1 / labels)
  return counts.map((count) => (1 - labelPull) / labels + labelPull * (count / total))
}

/**
 * How often the model answers with the prompt's majority label on an
 * ambiguous item, as the demonstrations are made more lopsided.
 */
export function majorityLabelRate(
  counts: readonly number[],
  labelPull = DEFAULT_IN_CONTEXT_MODEL.labelPull,
): number {
  const share = inducedLabelShare(counts, labelPull)
  return share.length === 0 ? 0 : Math.max(...share)
}

/** The demonstrations a prompt would need to reach a target accuracy. */
export function demonstrationsFor(target: number, model: InContextModel = DEFAULT_IN_CONTEXT_MODEL): number {
  const chance = 1 / model.labels
  if (target <= chance) return 0
  if (target >= model.ceiling) return Number.POSITIVE_INFINITY
  return model.scale * Math.log((model.ceiling - chance) / (model.ceiling - target))
}

/** The settings a saved prompt configuration restores. */
export function readInContextModel(settings?: LabSettings): InContextModel {
  if (!settings) return { ...DEFAULT_IN_CONTEXT_MODEL }
  const read = (key: keyof InContextModel) => {
    const value = settings[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_IN_CONTEXT_MODEL[key]
  }
  return {
    labels: Math.max(2, Math.round(read('labels'))),
    ceiling: Math.min(0.99, Math.max(0.05, read('ceiling'))),
    scale: Math.max(0.5, read('scale')),
    labelPull: Math.min(0.99, Math.max(0, read('labelPull'))),
  }
}
