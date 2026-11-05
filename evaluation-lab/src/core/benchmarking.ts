/**
 * Three questions about a benchmark rather than about a model.
 *
 * - HEML's argument: one metric is not a measurement, and the trade-offs
 *   between metrics are the result. The surface here is computed from a small
 *   set of model parameters, so the frontier is a real non-dominated set.
 * - The illusion paper's argument: a public test set is selected on, and the
 *   winner of that selection is optimistically scored. The gap is computable.
 * - The trenches paper's argument: decoding is part of the measurement. A
 *   temperature change moves a score by an amount that can be compared with
 *   the benchmark's own error bar.
 *
 * Every number is synthetic and every constant is labelled where it is shown.
 */

import { createRng, gaussian } from '@llm-materials/course-core'

/* ---------------------------------------------------------- HEML surfaces */

export interface MetricModel {
  id: string
  name: string
  /** Higher is better, on a 0–1 scale. */
  accuracy: number
  calibration: number
  robustness: number
  fairness: number
  /** Lower is better, in relative cost units. */
  cost: number
}

/**
 * Six models with deliberately different shapes.
 *
 * The parameters are chosen so that no model is best at everything: the most
 * accurate is expensive, the cheapest is poorly calibrated, and the frontier
 * has more than one point. They are illustrative, not HEML's table.
 */
export const HEML_MODELS: MetricModel[] = [
  { id: 'aurora', name: 'Aurora', accuracy: 0.79, calibration: 0.62, robustness: 0.71, fairness: 0.6, cost: 1.0 },
  { id: 'borealis', name: 'Borealis', accuracy: 0.7, calibration: 0.81, robustness: 0.76, fairness: 0.72, cost: 0.62 },
  { id: 'cirrus', name: 'Cirrus', accuracy: 0.71, calibration: 0.7, robustness: 0.82, fairness: 0.68, cost: 0.4 },
  { id: 'drake', name: 'Drake', accuracy: 0.68, calibration: 0.88, robustness: 0.64, fairness: 0.81, cost: 0.3 },
  { id: 'eos', name: 'Eos', accuracy: 0.66, calibration: 0.75, robustness: 0.6, fairness: 0.55, cost: 0.18 },
  { id: 'fenrir', name: 'Fenrir', accuracy: 0.81, calibration: 0.55, robustness: 0.58, fairness: 0.5, cost: 1.3 },
]

export interface TradeoffPoint extends MetricModel {
  /** Whether some other model is at least as good on every metric and cheaper. */
  dominated: boolean
}

/**
 * The Pareto frontier of accuracy against cost.
 *
 * A model is dominated when another model is at least as accurate and no more
 * expensive, with one of the two strict. The frontier is the set of models
 * that are not dominated, ordered by cost. The other metrics are carried along
 * because the point of HEML is that the choice between them is the result.
 */
export function tradeoffSurface(models: MetricModel[] = HEML_MODELS): TradeoffPoint[] {
  return models
    .map((model) => ({
      ...model,
      dominated: models.some(
        (other) =>
          other.id !== model.id &&
          other.accuracy >= model.accuracy &&
          other.cost <= model.cost &&
          (other.accuracy > model.accuracy || other.cost < model.cost),
      ),
    }))
    .sort((a, b) => a.cost - b.cost)
}

/** How many points are on the frontier, and how wide the spread of each metric is. */
export function surfaceSummary(models: MetricModel[] = HEML_MODELS): {
  frontier: number
  accuracySpread: number
  calibrationSpread: number
  costSpread: number
  bestAccuracy: string
  bestCalibration: string
  cheapest: string
} {
  const points = tradeoffSurface(models)
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values)
  const best = (key: 'accuracy' | 'calibration' | 'cost', direction: 1 | -1) =>
    [...models].sort((a, b) => direction * (a[key] - b[key]))[0]
  return {
    frontier: points.filter((point) => !point.dominated).length,
    accuracySpread: spread(models.map((model) => model.accuracy)),
    calibrationSpread: spread(models.map((model) => model.calibration)),
    costSpread: spread(models.map((model) => model.cost)),
    bestAccuracy: best('accuracy', -1)?.name ?? '—',
    bestCalibration: best('calibration', -1)?.name ?? '—',
    cheapest: best('cost', 1)?.name ?? '—',
  }
}

/* ------------------------------------------------------- private testing */

export interface Candidate {
  id: string
  name: string
  /** The true score the private test measures. */
  trueScore: number
}

export const CANDIDATES: Candidate[] = [
  { id: 'one', name: 'candidate one', trueScore: 0.62 },
  { id: 'two', name: 'candidate two', trueScore: 0.64 },
  { id: 'three', name: 'candidate three', trueScore: 0.66 },
  { id: 'four', name: 'candidate four', trueScore: 0.68 },
  { id: 'five', name: 'candidate five', trueScore: 0.7 },
]

export interface SelectionResult {
  candidates: Candidate[]
  /** The measured score on the public set, with its sampling noise. */
  publicScores: number[]
  /** The score on the private set, which is the truth here. */
  privateScores: number[]
  /** The index of the public winner. */
  winner: number
  /** The public score of the winner. */
  publicWinnerScore: number
  /** The private score of the winner. */
  privateWinnerScore: number
  /** The best private score among the candidates. */
  bestPrivateScore: number
  /** How much the public set flattered the winner. */
  optimism: number
}

/**
 * Select the best candidate on a noisy public set, then read the private test.
 *
 * The public score is the true score plus sampling noise. The candidate with
 * the highest public score is chosen. Its private score is lower on average,
 * and the difference is the winner's curse: the selection used the noise.
 */
export function selectOnPublic(
  candidates: Candidate[] = CANDIDATES,
  options: { noise?: number; seed?: number } = {},
): SelectionResult {
  const settings = { noise: 0.03, seed: 83, ...options }
  const rng = createRng(settings.seed)
  const publicScores = candidates.map((candidate) => candidate.trueScore + gaussian(rng) * settings.noise)
  const winner = publicScores.reduce((best, score, index) => (score > publicScores[best]! ? index : best), 0)
  const privateScores = candidates.map((candidate) => candidate.trueScore)
  return {
    candidates,
    publicScores,
    privateScores,
    winner,
    publicWinnerScore: publicScores[winner]!,
    privateWinnerScore: privateScores[winner]!,
    bestPrivateScore: Math.max(...privateScores),
    optimism: publicScores[winner]! - privateScores[winner]!,
  }
}

/** The average optimism as the public set's noise grows. */
export function optimismCurve(
  candidates: Candidate[] = CANDIDATES,
  options: { maxNoise?: number; steps?: number; seeds?: number } = {},
): { noise: number; optimism: number }[] {
  const settings = { maxNoise: 0.08, steps: 8, seeds: 40, ...options }
  const rows: { noise: number; optimism: number }[] = []
  for (let step = 0; step <= settings.steps; step++) {
    const noise = (settings.maxNoise * step) / settings.steps
    let total = 0
    for (let seed = 0; seed < settings.seeds; seed++) {
      total += selectOnPublic(candidates, { noise, seed: 101 + seed }).optimism
    }
    rows.push({ noise, optimism: total / settings.seeds })
  }
  return rows
}

/* ------------------------------------------------------ decoding changes */

/**
 * The score a decoding setting produces.
 *
 * Greedy decoding is the reference. Temperature first helps and then hurts:
 * a little sampling finds a better ending, a lot of it wanders. The returned
 * score is the reference plus that shift plus a draw whose scale grows with
 * the temperature. The shape is a model; the comparison with the error bar is
 * the arithmetic the screen makes.
 */
export function decodingScore(baseScore: number, temperature: number, seed: number): number {
  const shift = 0.08 * temperature - 0.03 * temperature * temperature
  const rng = createRng(seed)
  return Math.max(0, Math.min(1, baseScore + shift + gaussian(rng) * 0.015 * temperature))
}

export interface DecodingRow {
  temperature: number
  mean: number
  sd: number
  delta: number
}

/** A sweep over decoding temperatures, averaged over repeated runs. */
export function decodingSweep(
  baseScore: number,
  temperatures: number[] = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.5],
  runs = 30,
): DecodingRow[] {
  return temperatures.map((temperature) => {
    const scores = Array.from({ length: runs }, (_, run) => decodingScore(baseScore, temperature, 131 + run))
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    const variance = scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / Math.max(1, scores.length - 1)
    return { temperature, mean, sd: Math.sqrt(variance), delta: mean - baseScore }
  })
}
