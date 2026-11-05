/**
 * Pruning a pool: what a metric buys, and where it stops buying.
 *
 * Sorscher, Geirhos, Shekhar, Ganguli & Morcos ("Beyond neural scaling laws:
 * beating power law scaling via data pruning", arXiv:2206.14486) made the
 * observation that this
 * module measures. Their setting is a classifier over a *clustered* corpus:
 * most of the data sits in a few big clusters, and inside a cluster the points
 * are redundant, while a small number of rare points carry most of the
 * information. They then show that pruning by a good similarity metric beats
 * the power law — that the loss falls faster as the corpus shrinks than any
 * law of volume alone can do — right up to a *percolation threshold*, below
 * which the rare points start going and the loss rockets back up. The whole
 * point of their figure is the shape: a steep descent, a knee, a cliff.
 *
 * Their metrics are two distances to a class prototype. **Weak scaling** uses
 * the class mean in the input space, which needs no labels and no trained
 * model. **Strong scaling** uses the class mean in the embedding of a model
 * already trained on the full corpus, which needs both and knows more. Their
 * reported ordering — strong beats weak, weak beats random, and each has its
 * own threshold — is the claim under test here.
 *
 * ## The transposition, and why it is honest
 *
 * This is a regression toy, not their image classifier; it is synthetic
 * throughout, and every number in it is measured rather than assumed. What
 * makes the transposition faithful is that the scalar each metric is trying to
 * estimate is exact here. For a linear-Gaussian row
 *
 *     yₙ = w·xₙ + εₙ,  εₙ ~ N(0, σₙ²),
 *
 * the Fisher information the row contributes about `w` is `xₙ xₙᵀ / σₙ²`, so
 * its trace `‖xₙ‖² / σₙ²` is a scalar measure of how much the row is worth.
 * That is the "informativeness" the metrics rank, and it is available to the
 * analyst, which lets the module define a *best possible* metric — the oracle —
 * against which the computable ones are scored.
 *
 * The pool then has the structure their argument needs.
 *
 * - The **bulk** is redundant: it lives in the same `headDims` directions, so
 *   most of it can go with little cost, and it spans a wide range of both
 *   amplitude and label noise, so its rows differ in information by three
 *   orders of magnitude.
 * - The **rare** rows are the only ones with a component in the tail
 *   directions. They are moderate in norm and exceptionally clean, which puts
 *   them at the middle of the ranking a metric made from the inputs and at the
 *   top of the ranking made with the labels.
 *
 * Pruning by information therefore sheds the unreliable mass first and keeps
 * the rare rows to the end: the loss improves over a long descent and then
 * breaks at the fraction where the tail directions start going. A metric that
 * ranks by the inputs alone puts those same rows in the middle of the queue, so
 * its cliff comes early. A random metric drops the two groups in proportion,
 * which is the ordinary power law of volume: no gain at any fraction, and no
 * threshold to find. The last is a `null`, reported as one.
 */

import { createRng } from '@llm-materials/course-core'
import { ridgeFit, meanSquaredError } from './repeats'
import { fitPowerLaw, type PowerLawFit } from './surface'

/** The keep fractions the curves are read on: fine at the top, coarse near the cliff. */
export const DEFAULT_FRACTIONS = [1, 0.85, 0.7, 0.6, 0.5, 0.4, 0.3, 0.22, 0.15, 0.1, 0.06, 0.03]

/** How the pool is drawn. Everything here is synthetic and seeded. */
export interface PruningPoolOptions {
  /** Rows in the pool. */
  rows?: number
  /** Directions the model is allowed to fit. */
  dims?: number
  /** How many of them the bulk of the pool covers. The rest are reached only by the rare rows. */
  headDims?: number
  /** What share of the pool carries a tail direction. */
  rareFraction?: number
  /** The label noise of the most reliable bulk rows. */
  cleanNoise?: number
  /** The label noise of the least reliable bulk rows. */
  loudNoise?: number
  /** The label noise of the rare rows, which are the cleanest of all. */
  rareNoise?: number
  /** The amplitude range of the bulk rows, log-uniform between these. */
  amplitudeLow?: number
  amplitudeHigh?: number
  /** The amplitude of a rare row along its own tail direction. */
  rareAmplitude?: number
  /** How much of the head a rare row carries too. */
  rareHeadScale?: number
  /**
   * How much of a row's reliability is visible in its inputs.
   *
   * One is a world in which a small row is an unreliable row, and the norm is a
   * good metric. Zero is a world in which the two are independent, and the norm
   * sees only half of what the information is. Their weak scaling sits between,
   * and this is the knob that puts it there.
   */
  noiseCoupling?: number
  /** The weight magnitude of the tail directions, relative to the head's. */
  tailWeight?: number
  /** The seed. */
  seed?: number
}

/** Which group each row belongs to. */
export type RowGroup = 'bulk' | 'rare'

export interface PruningPool {
  /** The feature rows. */
  x: number[][]
  /** The labels, drawn with each row's own noise. */
  y: number[]
  /** The label noise of each row — known here, unknown to every metric but the oracle. */
  sigma: number[]
  /** The group of each row. */
  group: RowGroup[]
  /** The information each row carries, exactly: `‖x‖² / σ²`. */
  informativeness: number[]
  /** Held-out rows, drawn from the whole input distribution at the clean noise. */
  testX: number[][]
  /** Held-out labels. */
  testY: number[]
  /** The directions the model fits. */
  dims: number
  /** The true weights. */
  truth: number[]
  /** The tail directions: the ones only the rare rows reach. */
  tailDims: number[]
  /** The irreducible loss of the held-out set. */
  noiseFloor: number
  /** The seed the pool was drawn with. */
  seed: number
}

/** The four metrics, in their terms. */
export type MetricName = 'oracle' | 'strong' | 'weak' | 'random'

export const PRUNING_METRICS: MetricName[] = ['oracle', 'strong', 'weak', 'random']

/** What each metric is, in one line, for the screen to print. */
export const METRIC_DESCRIPTIONS: Record<MetricName, string> = {
  oracle: 'the true information per row, ‖x‖²/σ² — not computable, the ceiling',
  strong: 'a full-data fit, then ‖x‖² over the squared residual — needs labels and a run',
  weak: 'the row norm alone — no labels, no model, their weak scaling',
  random: 'a seeded shuffle — the volume baseline',
}

const SETTINGS = {
  rows: 400,
  dims: 24,
  headDims: 20,
  rareFraction: 0.12,
  cleanNoise: 0.05,
  loudNoise: 1.2,
  rareNoise: 0.02,
  amplitudeLow: 1,
  amplitudeHigh: 2.6,
  // A rare row's norm sits at the middle of the bulk's, and its information at
  // the top of everything's. That is the design: the inputs cannot tell it from
  // an average row, and only the labels show what it is worth.
  rareAmplitude: 5.8,
  rareHeadScale: 0.8,
  noiseCoupling: 0.65,
  tailWeight: 0.35,
  seed: 11,
}

/**
 * Draw the pool.
 *
 * The bulk rows differ from each other in two ways, and the metrics differ in
 * how well they can see them. A row's *amplitude* is how far from the origin it
 * sits and therefore how hard it constrains `w`; a row's *noise* is how much of
 * its label is talk. Both are visible to the information formula and only the
 * first is visible to the inputs, which is what makes the norm a metric that
 * works and works badly. `noiseCoupling` sets how far that goes: at one, small
 * rows are unreliable rows and the norm sees the whole story; at zero the two
 * are independent and the norm sees half.
 *
 * The rare rows are the only ones with a component in a tail direction. They
 * are placed at the middle of the norm distribution and at the top of the
 * information one — a moderate row with a very clean label — which is the whole
 * reason the two kinds of metric have different cliffs. A metric that ranks by
 * what the inputs show loses them halfway down the pool; a metric that ranks by
 * what the labels support keeps them to the last hundredth of it.
 */
export function buildPruningPool(options: PruningPoolOptions = {}): PruningPool {
  const settings: ResolvedPool = { ...SETTINGS, ...options }
  const { rows, dims, headDims } = settings
  if (!(headDims < dims)) throw new Error('buildPruningPool: the head must leave at least one tail direction')
  const rng = createRng(settings.seed)
  const truth: number[] = []
  for (let d = 0; d < dims; d++) truth.push(d < headDims ? 1 : settings.tailWeight)
  const tailDims: number[] = []
  for (let d = headDims; d < dims; d++) tailDims.push(d)

  const rareRows =
    settings.rareFraction <= 0 ? 0 : Math.max(tailDims.length, Math.round(rows * settings.rareFraction))
  const bulkRows = rows - rareRows

  const x: number[][] = []
  const y: number[] = []
  const sigma: number[] = []
  const group: RowGroup[] = []

  for (let n = 0; n < bulkRows; n++) {
    const amplitude = logUniform(rng, settings)
    const rank = Math.log(amplitude / settings.amplitudeLow) / Math.log(settings.amplitudeHigh / settings.amplitudeLow)
    const reliability = settings.noiseCoupling * rank + (1 - settings.noiseCoupling) * rng()
    const noise = Math.exp(
      Math.log(settings.loudNoise) + reliability * (Math.log(settings.cleanNoise) - Math.log(settings.loudNoise)),
    )
    const row = Array.from({ length: dims }, () => 0)
    for (let d = 0; d < headDims; d++) row[d] = gaussian(rng) * amplitude
    x.push(row)
    y.push(dot(row, truth) + gaussian(rng) * noise)
    sigma.push(noise)
    group.push('bulk')
  }

  // The rare rows: one tail direction each, round-robin, so every tail
  // direction is covered by a handful of rows and by nothing else.
  for (let n = 0; n < rareRows; n++) {
    const row = Array.from({ length: dims }, () => 0)
    const target = tailDims[n % tailDims.length]!
    row[target] = settings.rareAmplitude * (0.7 + 0.6 * rng())
    for (let d = 0; d < headDims; d++) row[d] = gaussian(rng) * settings.rareHeadScale
    x.push(row)
    y.push(dot(row, truth) + gaussian(rng) * settings.rareNoise)
    sigma.push(settings.rareNoise)
    group.push('rare')
  }

  const information = x.map((row, n) => squaredNorm(row) / sigma[n]! ** 2)

  const test = drawTest(settings, truth)
  return {
    x,
    y,
    sigma,
    group,
    informativeness: information,
    testX: test.x,
    testY: test.y,
    dims,
    truth,
    tailDims,
    noiseFloor: settings.cleanNoise ** 2,
    seed: settings.seed,
  }
}

/**
 * A held-out set drawn from the whole input distribution.
 *
 * It has to reach the tail directions, or the loss would not miss them and
 * there would be no cliff to measure. The tail's share of the input mass is the
 * head's: the rare rows' small amplitude is an accident of the pool, not of the
 * distribution the model is scored on.
 */
function drawTest(settings: ResolvedPool, truth: number[]) {
  const rng = createRng(settings.seed + 7717)
  const count = 400
  const x: number[][] = []
  const y: number[] = []
  for (let n = 0; n < count; n++) {
    const amplitude = logUniform(rng, settings)
    const row: number[] = []
    for (let d = 0; d < settings.dims; d++) row.push(gaussian(rng) * amplitude)
    x.push(row)
    y.push(dot(row, truth) + gaussian(rng) * settings.cleanNoise)
  }
  return { x, y }
}

type ResolvedPool = Required<PruningPoolOptions>

function logUniform(rng: () => number, settings: ResolvedPool): number {
  return settings.amplitudeLow * (settings.amplitudeHigh / settings.amplitudeLow) ** rng()
}

/**
 * The score a metric gives every row.
 *
 * `noise` is the metric-quality knob: it degrades a ranking continuously, by
 * adding `noise × standard normal` to the log score. Zero leaves the metric as
 * defined; large values make any two rows indistinguishable. It is what the
 * threshold sweep runs on, because the paper's claim is about a threshold that
 * moves with the metric, and a knob is how you move it.
 */
export function metricScores(
  pool: PruningPool,
  metric: MetricName,
  options: { noise?: number; ridge?: number; seed?: number } = {},
): number[] {
  // Read with `??`, not a spread: a caller that forwards an options object with
  // the key absent hands over an explicit `undefined`, and a spread would let it
  // overwrite the default.
  const noise = options.noise ?? 0
  const ridge = options.ridge ?? 1e-3
  const seed = options.seed ?? 3
  let scores: number[]
  if (metric === 'oracle') scores = [...pool.informativeness]
  else if (metric === 'weak') scores = pool.x.map((row) => squaredNorm(row))
  else if (metric === 'random') {
    const rng = createRng(seed)
    scores = pool.x.map(() => rng())
  } else {
    // Strong: the trained model's own view of each row. The residual estimates
    // the row's noise, so the score is the information formula with σ̂ in place
    // of σ — which is exactly what a practitioner can compute, and exactly why
    // it is imperfect: the fit was made with this row in it.
    const weights = ridgeFit(pool.x, pool.y, pool.dims, ridge)
    const residuals = pool.x.map((row, n) => (dot(row, weights) - pool.y[n]!) ** 2)
    const floor = 0.05 * median(residuals)
    scores = pool.x.map((row, n) => squaredNorm(row) / (residuals[n]! + floor))
  }
  if (noise === 0) return scores
  const rng = createRng(seed + 41)
  return scores.map((value) => Math.log(Math.max(value, 1e-12)) + noise * gaussian(rng))
}

/** The rows a keep-fraction retains, in descending score order. */
export function pruneByMetric(pool: PruningPool, scores: number[], fraction: number): number[] {
  if (!(fraction > 0 && fraction <= 1)) throw new Error('pruneByMetric: the keep fraction must be in (0, 1]')
  if (scores.length !== pool.x.length) throw new Error('pruneByMetric: the scores do not match the pool')
  const kept = Math.max(1, Math.round(pool.x.length * fraction))
  const order = scores.map((_value, index) => index)
  order.sort((a, b) => scores[b]! - scores[a]!)
  return order.slice(0, kept).sort((a, b) => a - b)
}

/** One point of a pruning curve. */
export interface PruningPoint {
  /** The share of the pool kept. */
  fraction: number
  /** Rows kept, which is also the compute of the fit. */
  kept: number
  /** The held-out loss of the curated subset. */
  loss: number
  /** The held-out loss of the whole pool. */
  fullLoss: number
  /** What pruning bought at this fraction: positive is an improvement. */
  gain: number
  /** The loss of a random subset of the same size — the volume baseline. */
  randomLoss: number
  /** What curation bought over the same volume. */
  excessOverRandom: number
  /** Rare rows still present. */
  rareKept: number
  /** Tail directions with at least one kept row. */
  tailCovered: number
  /** The least-covered tail direction: how many kept rows reach it at all. */
  rarestTailDim: number
}

/**
 * The loss as a function of the keep fraction, for one metric.
 *
 * Both curves — curated and random — are the same fitted learner on the same
 * held-out set, so the difference between them is the metric and nothing else.
 */
export function pruningCurve(
  pool: PruningPool,
  scores: number[],
  fractions: number[] = DEFAULT_FRACTIONS,
  options: { ridge?: number; randomSeed?: number } = {},
): PruningPoint[] {
  const ridge = options.ridge ?? 1e-3
  const randomSeed = options.randomSeed ?? 101
  const full = trainOn(pool, pool.x.map((_row, index) => index), ridge)
  const order = scores.map((_value, index) => index).sort((a, b) => scores[b]! - scores[a]!)
  const randomOrder = seededOrder(pool.x.length, randomSeed)

  return fractions.map((fraction) => {
    const kept = Math.max(1, Math.round(pool.x.length * fraction))
    const indices = order.slice(0, kept)
    const loss = trainOn(pool, indices, ridge)
    const randomLoss = trainOn(pool, randomOrder.slice(0, kept), ridge)
    let rareKept = 0
    const counts = pool.tailDims.map(() => 0)
    for (const index of indices) {
      if (pool.group[index] === 'rare') rareKept++
      const row = pool.x[index]!
      pool.tailDims.forEach((dim, position) => {
        if (Math.abs(row[dim] ?? 0) > 1e-9) counts[position] = (counts[position] ?? 0) + 1
      })
    }
    const covered = counts.filter((count) => count > 0).length
    return {
      fraction,
      kept,
      loss,
      fullLoss: full,
      gain: full - loss,
      randomLoss,
      excessOverRandom: randomLoss - loss,
      rareKept,
      tailCovered: covered,
      rarestTailDim: Math.min(...counts),
    }
  })
}

function trainOn(pool: PruningPool, indices: number[], ridge: number): number {
  const x = indices.map((index) => pool.x[index]!)
  const y = indices.map((index) => pool.y[index]!)
  const weights = ridgeFit(x, y, pool.dims, ridge)
  return meanSquaredError(pool.testX, pool.testY, weights)
}

function seededOrder(length: number, seed: number): number[] {
  const rng = createRng(seed)
  const order = Array.from({ length }, (_, index) => index)
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const swap = order[i]!
    order[i] = order[j]!
    order[j] = swap
  }
  return order
}

/**
 * The percolation threshold, read off the curve.
 *
 * It is the smallest keep fraction that still does not cost anything: at or
 * above it, pruning is free or good; below it the rare rows have gone and the
 * loss is worse than the full pool's. A metric whose curve is never better than
 * the full pool has no threshold, and gets `null` rather than a number.
 */
export interface ThresholdReading {
  /** The smallest keep fraction that still costs nothing, or null if pruning never pays. */
  threshold: number | null
  /** The fraction of the pool the metric wants kept. */
  bestFraction: number
  /** The loss there. */
  bestLoss: number
  /** How much better than the full pool that is. */
  maxGain: number
}

export function percolationThreshold(
  curve: PruningPoint[],
  options: { tolerance?: number } = {},
): ThresholdReading {
  const tolerance = options.tolerance ?? 0
  if (curve.length === 0) return { threshold: null, bestFraction: 1, bestLoss: 0, maxGain: 0 }
  const fullLoss = curve[0]!.fullLoss
  const best = curve.reduce((acc, point) => (point.loss < acc.loss ? point : acc), curve[0]!)
  const maxGain = fullLoss - best.loss
  if (maxGain <= tolerance) {
    // No fraction prunes profitably: the metric carries no information, so the
    // best there is is the whole pool and the threshold question has no answer.
    return { threshold: null, bestFraction: best.fraction, bestLoss: best.loss, maxGain }
  }
  const inside = curve.filter((point) => point.loss <= fullLoss + tolerance).map((point) => point.fraction)
  return { threshold: Math.min(...inside), bestFraction: best.fraction, bestLoss: best.loss, maxGain }
}

/**
 * How far the metric dares to go.
 *
 * The threshold above is measured against the full pool: it answers "how much
 * can I throw away before I am sorry". This answers the sharper question the
 * analytic prediction makes a claim about: the smallest keep fraction whose loss
 * is still within `factor` of the best the curve ever achieves. Below it the
 * curve has broken, and the break is the cliff the paper draws.
 */
export function cliffEdge(curve: PruningPoint[], options: { factor?: number } = {}): number | null {
  const factor = options.factor ?? 2
  if (curve.length === 0) return null
  const best = Math.min(...curve.map((point) => point.loss))
  const inside = curve.filter((point) => point.loss <= best * factor).map((point) => point.fraction)
  return inside.length > 0 ? Math.min(...inside) : null
}

/** One metric's summary, at the volume and at the compute the benchmark charges it. */
export interface MetricBenchmark {
  metric: MetricName
  /** How the metric is computed, for the screen. */
  description: string
  /** The lowest held-out loss the metric reaches. */
  bestLoss: number
  /** The keep fraction there. */
  bestFraction: number
  /** Rows kept there. */
  bestKept: number
  /** The full-pool loss, for reference. */
  fullLoss: number
  /** The gain over the full pool at the best fraction. */
  gain: number
  /** The percolation threshold, or null when the metric gives no benefit at all. */
  threshold: number | null
  /** The gain over a random subset of the same size, at the best fraction. */
  excessOverRandom: number
  /** Rows the metric itself must chew through: strong scaling trains first. */
  metricCostRows: number
  /** The gain over a random subset allowed that many extra rows. Positive pays for the metric. */
  gainAtMatchedCompute: number
  /** Tail directions still covered at the best fraction. */
  tailCovered: number
  /** Kept rows reaching the least-covered tail direction at the best fraction. */
  rarestTailDim: number
  /** Rare rows still kept at the best fraction. */
  rareKept: number
  /** 1 is the best metric of the four, by `bestLoss`. */
  rank: number
}

/**
 * The benchmark.
 *
 * Two comparisons, because the paper's claim is only fair if both are made. At
 * matched *volume*, a curated subset beats a random one of the same size — that
 * is the escape from the law of volume. At matched *compute*, the random
 * baseline is given extra rows to make up for the cost of the metric, which for
 * strong scaling is a whole training run over the pool. A metric that cannot
 * beat a larger random subset is not worth using, and the column says so.
 */
export function benchmarkMetrics(
  pool: PruningPool,
  options: { fractions?: number[]; ridge?: number; noise?: number } = {},
): MetricBenchmark[] {
  const fractions = options.fractions ?? DEFAULT_FRACTIONS
  const benchmarks = PRUNING_METRICS.map((metric) => {
    const scores = metricScores(pool, metric, { noise: options.noise, ridge: options.ridge })
    const curve = pruningCurve(pool, scores, fractions, { ridge: options.ridge })
    const summary = percolationThreshold(curve)
    const best = curve.find((point) => point.fraction === summary.bestFraction) ?? curve[0]!
    // A metric that needs a trained model has already paid for a full pass over
    // the pool; the random baseline is handed that many extra rows.
    const cost = metric === 'strong' ? pool.x.length : 0
    const randomScores = metricScores(pool, 'random', { seed: 5 })
    const inflated = Math.min(1, (best.kept + cost) / pool.x.length)
    const randomCurve = pruningCurve(pool, randomScores, [inflated], { ridge: options.ridge })
    return {
      metric,
      description: METRIC_DESCRIPTIONS[metric],
      bestLoss: summary.bestLoss,
      bestFraction: summary.bestFraction,
      bestKept: best.kept,
      fullLoss: best.fullLoss,
      gain: best.fullLoss - summary.bestLoss,
      threshold: summary.threshold,
      excessOverRandom: best.excessOverRandom,
      metricCostRows: cost,
      gainAtMatchedCompute: (randomCurve[0]?.loss ?? best.randomLoss) - summary.bestLoss,
      tailCovered: best.tailCovered,
      rarestTailDim: best.rarestTailDim,
      rareKept: best.rareKept,
      rank: 0,
    }
  })
  const ranked = [...benchmarks].sort((a, b) => a.bestLoss - b.bestLoss)
  for (const benchmark of benchmarks) {
    benchmark.rank = ranked.findIndex((row) => row.metric === benchmark.metric) + 1
  }
  return benchmarks
}

/**
 * The percolation prediction.
 *
 * The threshold is not a free parameter: it is where the metric stops being
 * able to tell a rare row from a redundant one. Write the log information of row
 * `n` as `ℓₙ`, the metric's error as a standard deviation `m` on that log scale,
 * and the cut the metric applies at keep-fraction `f` as `τ(f)`: the `1 − f`
 * quantile of the *scores*, which are `ℓ + m·ε`, so `τ` solves
 *
 *     meanᵢ Φ((τ − ℓᵢ)/m) = 1 − f.
 *
 * A row then survives with probability `Φ((ℓₙ − τ)/m)`, and the expected number
 * of rare rows left is the sum of those over the rare group. Pruning holds while
 * the tail directions stay covered — `required` rows per direction — and the
 * predicted threshold is the smallest fraction for which they do.
 *
 * Three readings of this expression are the paper's prediction, and the tests
 * check all three: the threshold rises with the metric's error `m`; as `m` goes
 * to zero it collapses to the share of the pool that outranks the rarest rare
 * row; and as `m` grows past the spread of the information itself the survival
 * of a rare row becomes `f` itself, the answer goes to one, and there is nothing
 * to prune — which is what the random metric measures.
 */
export interface PercolationPrediction {
  /** The smallest keep fraction the metric can be trusted to, or null at any fraction. */
  fraction: number | null
  /** Rare rows the tail needs covered: `requiredPerTailDim` per direction. */
  required: number
  /** Rare rows in the pool. */
  rareRows: number
  /** The expected count of rare rows surviving, at each of the swept fractions. */
  survival: { fraction: number; expectedRareKept: number }[]
}

export function predictThreshold(
  pool: PruningPool,
  options: { metricNoise?: number; requiredPerTailDim?: number; fractions?: number[] } = {},
): PercolationPrediction {
  const metricNoise = options.metricNoise ?? 0
  const requiredPerTailDim = options.requiredPerTailDim ?? 3
  const logs = pool.informativeness.map((value) => Math.log(value))
  const rare: number[] = []
  const all: number[] = []
  for (let n = 0; n < logs.length; n++) {
    all.push(logs[n]!)
    if (pool.group[n] === 'rare') rare.push(logs[n]!)
  }
  if (rare.length === 0) throw new Error('predictThreshold: the pool has no rare rows')
  const required = requiredPerTailDim * pool.tailDims.length
  const total = logs.length

  const cut = (fraction: number): number => {
    const keep = Math.max(1, Math.round(total * fraction))
    if (metricNoise <= 1e-9) {
      const sorted = [...all].sort((a, b) => b - a)
      return sorted[Math.min(sorted.length - 1, keep - 1)]!
    }
    // The quantile of a mixture of normals centred on the ℓᵢ: the share of rows
    // scoring above a candidate cut is monotone decreasing in the cut, so a
    // bisection settles it. The bracket is the data's own range, widened by
    // eight error bars.
    const target = keep / total
    let lo = Math.min(...all) - 8 * metricNoise
    let hi = Math.max(...all) + 8 * metricNoise
    for (let step = 0; step < 80; step++) {
      const middle = (lo + hi) / 2
      const above = all.reduce((sum, value) => sum + normalCdf((value - middle) / metricNoise), 0) / total
      if (above > target) lo = middle
      else hi = middle
    }
    return (lo + hi) / 2
  }

  const expectedRareKept = (fraction: number): number => {
    const tau = cut(fraction)
    if (metricNoise <= 1e-9) return rare.filter((value) => value >= tau).length
    return rare.reduce((sum, value) => sum + normalCdf((value - tau) / metricNoise), 0)
  }

  const fractions = options.fractions ?? DEFAULT_FRACTIONS
  const survival = fractions.map((fraction) => ({ fraction, expectedRareKept: expectedRareKept(fraction) }))

  // The threshold is the smallest swept fraction at which the expected rare
  // coverage still reaches the requirement — and the sweep is the honest one,
  // because a metric that needs the whole pool has no fraction to name.
  const inside = survival.filter((row) => row.expectedRareKept >= required).map((row) => row.fraction)
  return { fraction: inside.length > 0 ? Math.min(...inside) : null, required, rareRows: rare.length, survival }
}

function normalCdf(z: number): number {
  // Abramowitz & Stegun 26.2.17's erf approximation, to ~1.5e-7.
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const polynomial =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  const erf = 1 - polynomial * Math.exp(-x * x)
  return 0.5 * (1 + sign * erf)
}

/** The law of volume: what random subsampling of the pool does to the loss. */
export function volumeLaw(
  pool: PruningPool,
  fractions: number[] = [0.1, 0.2, 0.35, 0.5, 0.7, 0.85, 1],
  options: { ridge?: number; seed?: number } = {},
): PowerLawFit & { points: PruningPoint[] } {
  const scores = metricScores(pool, 'random', { seed: options.seed ?? 9 })
  const points = pruningCurve(pool, scores, fractions, { ridge: options.ridge })
  const usable = points.filter((point) => Number.isFinite(point.loss) && point.loss > 0 && point.kept > 0)
  if (usable.length < 2) throw new Error('volumeLaw: the fractions leave too few usable points to fit a law')
  return { ...fitPowerLaw(usable.map((point) => point.kept), usable.map((point) => point.loss)), points }
}

/** How much steeper the curated descent is than the law of volume. */
export function curationExponent(
  pool: PruningPool,
  metric: MetricName,
  options: { ridge?: number; noise?: number } = {},
): { volume: PowerLawFit; curated: PowerLawFit | null; ratio: number } {
  const volume = volumeLaw(pool, [0.1, 0.2, 0.35, 0.5, 0.7, 0.85, 1], options)
  const scores = metricScores(pool, metric, { noise: options.noise, ridge: options.ridge })
  const curve = pruningCurve(pool, scores, [1, 0.85, 0.7, 0.55, 0.45, 0.35, 0.25, 0.2], { ridge: options.ridge })
  // Only the improving stretch is a scaling law of volume: past the threshold
  // the curve turns around and a power law in the row count no longer describes
  // it at all.
  const best = curve.reduce((acc, point) => (point.loss < acc.loss ? point : acc), curve[0]!)
  const stretch = curve.filter((point) => point.fraction >= best.fraction && point.loss > 0).sort((a, b) => a.kept - b.kept)
  if (stretch.length < 3) return { volume, curated: null, ratio: 1 }
  const curated = fitPowerLaw(stretch.map((point) => point.kept), stretch.map((point) => point.loss))
  return { volume, curated, ratio: curated.alpha / volume.alpha }
}

/**
 * The information spread of the pool, on the log scale the prediction lives on.
 *
 * `separation` is how far above the bulk's middle the rare rows' middle sits, in
 * decades of information. It is the size of the gap a metric has to bridge, and
 * the yardstick the metric's own error is compared against: an error much bigger
 * than the separation is a metric that cannot see the rare rows at all.
 */
export function informationSpread(pool: PruningPool): { rare: number; rest: number; separation: number } {
  const logs = pool.informativeness.map((value) => Math.log(value))
  const rare = logs.filter((_value, index) => pool.group[index] === 'rare')
  const rest = logs.filter((_value, index) => pool.group[index] !== 'rare')
  return { rare: spread(rare), rest: spread(rest), separation: mean(rare) - mean(rest) }
}

function spread(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1))
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

function squaredNorm(row: number[]): number {
  return row.reduce((sum, value) => sum + value * value, 0)
}

function dot(a: number[], b: number[]): number {
  let total = 0
  for (let i = 0; i < a.length; i++) total += a[i]! * (b[i] ?? 0)
  return total
}

function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12)
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** A convenience for the screen: the pool's groups, counted. */
export function poolComposition(pool: PruningPool): Record<RowGroup, number> {
  const counts: Record<RowGroup, number> = { bulk: 0, rare: 0 }
  for (const label of pool.group) counts[label]++
  return counts
}

/** The share of the pool that is not rare, which is where a norm-based metric's cliff sits. */
export function nonRareShare(pool: PruningPool): number {
  const counts = poolComposition(pool)
  return counts.bulk / pool.x.length
}
