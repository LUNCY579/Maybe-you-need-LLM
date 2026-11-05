/**
 * Epochs: what a fixed pool of data is worth when you go round it again.
 *
 * The scaling laws of the other modules assume the data can be whatever size
 * you want. It cannot: a corpus is a finite number of rows, and once they have
 * all been read the only way to spend more compute is to read them again. The
 * question Muennighoff et al. ask is what the repeats are worth, and their
 * answer is a curve in three parts.
 *
 * This module measures that curve rather than drawing it from a formula. The
 * instrument is a real mini-batch stochastic gradient descent run over a real
 * pool:
 *
 * - the **repeated** run sees the same `U` rows once per epoch, E times over;
 * - the **fresh** run sees `U` new rows per epoch, so at epoch E it has read
 *   the same number of tokens as the repeated run but E·U different rows.
 *
 * Both runs start from the same weights, use the same batch order for the
 * first epoch — the first epoch's data is the same rows — and are scored on
 * the same held-out set. That construction makes the three phases arithmetic
 * instead of assertion:
 *
 * 1. **warmup.** At epoch one the two runs are the same run, so the gap is
 *    exactly zero, and it stays small while the weights are still far from the
 *    pool's empirical optimum: repeating what you have already seen costs
 *    nothing you could have spent on new data, because the optimiser had not
 *    finished with it.
 * 2. **plateau.** Once the repeated run has converged on its pool, a further
 *    epoch buys almost nothing while a further epoch of fresh data buys the
 *    usual amount. The gap opens and the repeated loss flattens.
 * 3. **decay.** The pool's empirical optimum is not the population optimum: it
 *    is fitted to the noise in `U` rows. Keep going and the repeated run walks
 *    towards it, and the held-out loss turns upward. This is the third phase,
 *    and it is the reason the practice is early stopping rather than more
 *    epochs.
 *
 * The last part of the module is the parametric law from the paper — the
 * effective-data formula, evaluated at the constants the paper reports — and
 * the compute-optimal allocation when the pool binds. The measured curves and
 * the law are two instruments on the same question, and they disagree in
 * exactly the way the paper says they should: the law saturates, while a real
 * run also overfits.
 */

import { createRng } from '@llm-materials/course-core'
import { buildRepeatsTask, meanSquaredError, type RepeatsTask } from './repeats'
import { analyticOptimum, COST_PER_PARAMETER_TOKEN } from './isoflop'
import { surfaceLoss, type SurfaceFit } from './surface'

/** The rows, the stream and the held-out set the epochs are measured on. */
export interface EpochTask {
  /** The unique pool every repeated epoch goes over. */
  pool: number[][]
  /** The targets of the unique pool. */
  poolY: number[]
  /** The fresh stream: `unique × epochs` rows, the head of which is the pool. */
  stream: number[][]
  /** The targets of the fresh stream. */
  streamY: number[]
  /** The held-out rows, identical for both runs. */
  testX: number[][]
  /** The held-out targets. */
  testY: number[]
  /** The dimension the learner sees. */
  features: number
  /** The size of the unique pool. */
  unique: number
  /** The noise variance planted in the targets. */
  noise: number
  /** The per-feature scale the rows were divided by. */
  scale: number[]
  /** The task the pool was drawn from. */
  source: RepeatsTask
}

export interface EpochOptions {
  /** The number of epochs both runs are trained for. */
  epochs?: number
  /** The rows per gradient step. */
  batch?: number
  /** The learning rate. */
  learningRate?: number
  /** The weight penalty on the mean loss, constant as the data grows. */
  ridge?: number
  /** The seed. */
  seed?: number
  /** The size of the unique pool. */
  unique?: number
  /** The number of random features the learner has. */
  capacity?: number
  /** The raw input dimension. */
  inputFeatures?: number
  /** The noise variance. */
  noise?: number
  /** Independent restarts of each curve, averaged. */
  runs?: number
}

/**
 * Build the pool, the stream and the held-out set.
 *
 * The stream is drawn as one long sequence from a single seeded generator and
 * the pool is its head, so the fresh run's first epoch is literally the same
 * rows as the repeated run's first epoch. The held-out set belongs to the
 * stream, so both curves are scored on identical data.
 *
 * Every row is then divided by the pool's per-feature root-mean-square. That is
 * a change of coordinates, not of the model class: the linear learner can still
 * express exactly the same predictions, and the losses are still the ordinary
 * squared error on the held-out rows. It is there because descent is run in
 * these coordinates, and unscaled random features make the step size meaningless.
 */
export function buildEpochTask(options: EpochOptions = {}): EpochTask {
  const settings = { epochs: 24, unique: 30, capacity: 30, inputFeatures: 12, noise: 0.05, ridge: 1e-4, seed: 7, ...options }
  const total = settings.unique * settings.epochs
  const source = buildRepeatsTask({
    unique: total,
    features: settings.inputFeatures,
    capacity: settings.capacity,
    ridge: settings.ridge,
    noise: settings.noise,
    seed: settings.seed,
  })
  const pool = source.x.slice(0, settings.unique)
  const scale = featureScale(pool)
  return {
    pool: scaleRows(pool, scale),
    poolY: source.y.slice(0, settings.unique),
    stream: scaleRows(source.x, scale),
    streamY: source.y,
    testX: scaleRows(source.testX, scale),
    testY: source.testY,
    features: source.features,
    unique: settings.unique,
    noise: settings.noise,
    scale,
    source,
  }
}

/** The root-mean-square of each feature over the rows it is measured on. */
function featureScale(rows: number[][]): number[] {
  const features = rows[0]?.length ?? 0
  const scale = Array.from({ length: features }, () => 0)
  for (const row of rows) {
    for (let f = 0; f < features; f++) scale[f] = (scale[f] ?? 0) + (row[f] ?? 0) ** 2
  }
  return scale.map((total) => Math.max(1e-6, Math.sqrt(total / Math.max(1, rows.length))))
}

function scaleRows(rows: number[][], scale: number[]): number[][] {
  return rows.map((row) => row.map((value, f) => value / (scale[f] ?? 1)))
}

/** One epoch boundary of a run. */
export interface EpochPoint {
  /** The epoch index, one-based. */
  epoch: number
  /** The tokens both runs have read. */
  tokens: number
  /** The distinct rows the repeated run has seen. */
  uniqueSeen: number
  /** The distinct rows the fresh run has seen. */
  freshSeen: number
  /** The repeated run's held-out loss. */
  repeatedLoss: number
  /** The fresh run's held-out loss. */
  freshLoss: number
  /** What repetition costs at this epoch: the gap between the two. */
  gap: number
  /** The gap as a fraction of the fresh loss. */
  relativeGap: number
  /** The repeated run's loss on the pool it memorises. */
  trainLoss: number
  /** How much the repeated run gained from this epoch. */
  repeatedGain: number
  /** How much the fresh run gained from this epoch. */
  freshGain: number
}

interface Trajectory {
  losses: number[]
  trainLosses: number[]
  weights: number[]
}

/**
 * One SGD trajectory over a data stream, with the loss read after every epoch.
 *
 * The batches are drawn without replacement inside an epoch, so the order is a
 * shuffle and the epoch is a pass. The penalty is a constant coefficient on the
 * mean loss, which is what weight decay is in practice; that detail matters,
 * because it is what lets the repeated run converge onto its pool's own
 * optimum rather than the population's.
 */
function trainStream(task: EpochTask, epochs: number, mode: 'repeat' | 'fresh', options: Required<Pick<EpochOptions, 'batch' | 'learningRate' | 'ridge' | 'seed'>>): Trajectory {
  const rng = createRng(options.seed)
  const weights = Array.from({ length: task.features }, () => 0)
  const losses: number[] = []
  const trainLosses: number[] = []

  for (let epoch = 1; epoch <= epochs; epoch++) {
    const rows =
      mode === 'repeat'
        ? task.pool
        : task.stream.slice((epoch - 1) * task.unique, epoch * task.unique)
    const targets =
      mode === 'repeat'
        ? task.poolY
        : task.streamY.slice((epoch - 1) * task.unique, epoch * task.unique)

    // The order: a Fisher–Yates shuffle on the shared stream so that both runs
    // step through the first epoch's rows in the same sequence.
    const order = rows.map((_, index) => index)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const swap = order[i]!
      order[i] = order[j]!
      order[j] = swap
    }

    for (let start = 0; start < order.length; start += options.batch) {
      const slice = order.slice(start, start + options.batch)
      const gradient = Array.from({ length: task.features }, () => 0)
      for (const index of slice) {
        const row = rows[index]!
        const target = targets[index]!
        let prediction = 0
        for (let f = 0; f < task.features; f++) prediction += (row[f] ?? 0) * (weights[f] ?? 0)
        const error = prediction - target
        for (let f = 0; f < task.features; f++) gradient[f] = (gradient[f] ?? 0) + (2 * error * (row[f] ?? 0)) / slice.length
      }
      for (let f = 0; f < task.features; f++) {
        weights[f] = (weights[f] ?? 0) - options.learningRate * ((gradient[f] ?? 0) + 2 * options.ridge * (weights[f] ?? 0))
      }
    }

    losses.push(meanSquaredError(task.testX, task.testY, weights))
    trainLosses.push(meanSquaredError(rows, targets, weights))
  }

  return { losses, trainLosses, weights }
}

/**
 * The measured epoch curve.
 *
 * Two trajectories, the same tokens, the same held-out set, different data.
 * The gap column is the price of repetition at each epoch; the gain columns are
 * what one more epoch is worth to each run, which is what the dominance epoch
 * is read from.
 *
 * With `runs` above one the curves are means over independent restarts — the
 * same pool, a different batch order each — because the epoch-to-epoch
 * fluctuation of constant-step descent is otherwise larger than the phase
 * boundaries it is being read against.
 */
export function epochCurve(options: EpochOptions = {}): EpochPoint[] {
  const settings = {
    epochs: 24,
    unique: 30,
    batch: 6,
    learningRate: 0.04,
    ridge: 1e-4,
    seed: 7,
    capacity: 30,
    inputFeatures: 12,
    noise: 0.05,
    runs: 8,
    ...options,
  }
  const task = buildEpochTask(settings)
  const repeated: number[][] = []
  const fresh: number[][] = []
  const train: number[][] = []
  for (let run = 0; run < settings.runs; run++) {
    const trainer = {
      batch: settings.batch,
      learningRate: settings.learningRate,
      ridge: settings.ridge,
      seed: settings.seed + run * 101,
    }
    const rep = trainStream(task, settings.epochs, 'repeat', trainer)
    const fr = trainStream(task, settings.epochs, 'fresh', trainer)
    repeated.push(rep.losses)
    fresh.push(fr.losses)
    train.push(rep.trainLosses)
  }
  const mean = (curves: number[][], index: number): number =>
    curves.reduce((total, curve) => total + curve[index]!, 0) / curves.length

  const points: EpochPoint[] = []
  for (let epoch = 1; epoch <= settings.epochs; epoch++) {
    const repeatedLoss = mean(repeated, epoch - 1)
    const freshLoss = mean(fresh, epoch - 1)
    const previousRepeated = epoch === 1 ? repeatedLoss : mean(repeated, epoch - 2)
    const previousFresh = epoch === 1 ? freshLoss : mean(fresh, epoch - 2)
    points.push({
      epoch,
      tokens: epoch * settings.unique,
      uniqueSeen: settings.unique,
      freshSeen: epoch * settings.unique,
      repeatedLoss,
      freshLoss,
      gap: repeatedLoss - freshLoss,
      relativeGap: freshLoss > 0 ? (repeatedLoss - freshLoss) / freshLoss : 0,
      trainLoss: mean(train, epoch - 1),
      repeatedGain: previousRepeated - repeatedLoss,
      freshGain: previousFresh - freshLoss,
    })
  }
  return points
}

/**
 * How many epochs before repetition dominates.
 *
 * The definition is marginal, not absolute: the epoch at which one more epoch
 * of the same rows buys less than a set fraction of what one more epoch of new
 * rows buys. It is the point at which the extra compute is better spent on data
 * than on another pass, and it is the number the lesson's title asks for.
 */
export function dominanceEpoch(points: EpochPoint[], options: { fraction?: number } = {}): number | null {
  const fraction = options.fraction ?? 0.5
  for (const point of points) {
    if (point.epoch === 1) continue
    if (point.freshGain <= 0) continue
    if (point.repeatedGain <= fraction * point.freshGain) return point.epoch
  }
  return null
}

/** Where the three phases of the curve start and end. */
export interface PhaseBounds {
  /** The last epoch still inside the warmup. */
  warmupEnd: number | null
  /** The first epoch of the plateau. */
  plateauStart: number | null
  /** The first epoch whose loss is measurably worse than the best one's. */
  decayStart: number | null
  /** The epoch at which the repeated run was at its best. */
  bestEpoch: number
  /** The best held-out loss the repeated run reached. */
  bestLoss: number
}

/**
 * The three-phase scaling curve, located.
 *
 * Warmup is where the two runs are still within a tolerance of each other —
 * repetition has not yet cost anything. The plateau begins when the gap opens.
 * The decay begins at the first epoch after the best one whose held-out loss is
 * measurably worse than that best, which is the overfitting the paper's own law
 * does not model. `bestEpoch` is the early-stopping point, and it is what the
 * practice actually uses.
 *
 * A run that never turns upward has `decayStart: null`, and the screen is told
 * so rather than being shown a boundary that is not there.
 */
export function phaseBoundaries(points: EpochPoint[], options: { tolerance?: number; decayTolerance?: number } = {}): PhaseBounds {
  const tolerance = options.tolerance ?? 0.02
  const decayTolerance = options.decayTolerance ?? 0.02
  let warmupEnd: number | null = null
  for (const point of points) {
    if (point.relativeGap <= tolerance) warmupEnd = point.epoch
    else break
  }
  const plateauStart = warmupEnd === null || warmupEnd >= points.length ? null : warmupEnd + 1
  let bestEpoch = points[0]?.epoch ?? 1
  let bestLoss = points[0]?.repeatedLoss ?? Infinity
  for (const point of points) {
    if (point.repeatedLoss < bestLoss) {
      bestLoss = point.repeatedLoss
      bestEpoch = point.epoch
    }
  }
  let decayStart: number | null = null
  for (const point of points) {
    if (point.epoch <= bestEpoch) continue
    if (point.repeatedLoss > bestLoss * (1 + decayTolerance)) {
      decayStart = point.epoch
      break
    }
  }
  return { warmupEnd, plateauStart, decayStart, bestEpoch, bestLoss }
}

/**
 * What an epoch of repetition is worth in fresh rows.
 *
 * The fresh curve is a loss as a function of the number of distinct rows; the
 * repeated curve is a loss as a function of the number of epochs. Inverting the
 * first at the value of the second answers the question "how many new rows
 * would I have needed to do as well as this many repeats", by interpolation in
 * log tokens. It is the operational definition of effective data, measured.
 */
export function effectiveSamples(points: EpochPoint[], epoch: number): number {
  const point = points.find((row) => row.epoch === epoch)
  if (!point) throw new Error(`effectiveSamples: no epoch ${epoch} in the curve`)
  const anchor = points[0]
  if (!anchor) throw new Error('effectiveSamples: the curve is empty')
  if (point.repeatedLoss >= anchor.freshLoss) return anchor.uniqueSeen
  const last = points[points.length - 1]!
  const segments = fallingSegments(points)
  if (segments.length === 0) return last.freshSeen
  if (point.repeatedLoss <= last.freshLoss) {
    const segment = segments[segments.length - 1]!
    return invert(segment.slope, segment.to.freshLoss, segment.to.freshSeen, point.repeatedLoss)
  }
  for (const segment of segments) {
    if (point.repeatedLoss <= segment.to.freshLoss) {
      return invert(segment.slope, segment.from.freshLoss, segment.from.freshSeen, point.repeatedLoss)
    }
  }
  return last.freshSeen
}

interface FallingSegment {
  from: EpochPoint
  to: EpochPoint
  slope: number
}

/** The pieces of the fresh curve that a loss can be inverted along. */
function fallingSegments(points: EpochPoint[]): FallingSegment[] {
  const segments: FallingSegment[] = []
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!
    const to = points[i]!
    // Only falling segments can be inverted: a segment where the fresh run did
    // not improve says nothing about how many rows buy a given loss.
    if (to.freshLoss >= from.freshLoss) continue
    segments.push({ from, to, slope: slopeOf(from.freshLoss, from.freshSeen, to.freshLoss, to.freshSeen) })
  }
  return segments
}

function slopeOf(lossA: number, rowsA: number, lossB: number, rowsB: number): number {
  const denominator = Math.log(rowsB / rowsA)
  return denominator === 0 ? 0 : (lossB - lossA) / denominator
}

function invert(slope: number, lossAt: number, rowsAt: number, targetLoss: number): number {
  if (slope === 0) return rowsAt
  return rowsAt * Math.exp((targetLoss - lossAt) / slope)
}

/**
 * The repetition constants Muennighoff et al. report for their own fits: the
 * data one is `R_D^★` above, the parameter one belongs to the excess-parameters
 * term this module does not use.
 */
export const PAPER_REPETITION_CONSTANT = { data: 15.387756, parameters: 5.309743 }

/**
 * The paper's effective-data law, as written.
 *
 * Muennighoff et al. give the worth of a repeated corpus as
 *
 *     D′ = U · (1 + R★ · (1 − e^(−R/R★))),
 *
 * with `U` the unique tokens, `R` the number of *extra* passes over them —
 * their `R_D`, which is the epoch count minus one — and `D′` the effective
 * data, their "equivalent amount of unique data". `R★` is their fitted
 * repetition constant.
 *
 * The shape is the result. One pass is worth exactly itself; the marginal epoch
 * decays exponentially, `e^(−R/R★)`, so the value of adding compute decays to
 * zero rather than to a smaller constant; and the whole pool can never be worth
 * more than `U·(1 + R★)` however many times it is read. The paper's own
 * summary — up to four epochs is nearly free, and beyond that the value decays
 * away — is a property of this expression with their constant in it, and the
 * tests read it off as a number rather than as a quotation.
 */
export function effectiveDataLaw(
  uniqueTokens: number,
  repetitions: number,
  options: { rDStar?: number } = {},
): number {
  const rDStar = options.rDStar ?? PAPER_REPETITION_CONSTANT.data
  if (!(uniqueTokens >= 0)) throw new Error('effectiveDataLaw: the unique tokens must not be negative')
  if (!(repetitions >= 0)) throw new Error('effectiveDataLaw: the repetitions count starts at zero')
  return uniqueTokens * (1 + rDStar * (1 - Math.exp(-repetitions / rDStar)))
}

/**
 * The same law read in tokens rather than passes: `total = unique × epochs`.
 *
 * Below one full pass the run has not seen the pool at all, so the effective
 * data is the tokens themselves; the two halves meet continuously, because the
 * law at zero repetitions returns the pool and the pool is what has been read.
 */
export function effectiveDataForTokens(uniqueTokens: number, totalTokens: number, options: { rDStar?: number } = {}): number {
  if (!(uniqueTokens > 0)) throw new Error('effectiveDataForTokens: the unique tokens must be positive')
  if (totalTokens <= uniqueTokens) return Math.max(0, totalTokens)
  return effectiveDataLaw(uniqueTokens, totalTokens / uniqueTokens - 1, options)
}

/** The fraction of a fresh epoch that the `repetitions`-th extra epoch is worth. */
export function repetitionValue(repetitions: number, options: { rDStar?: number } = {}): number {
  const rDStar = options.rDStar ?? PAPER_REPETITION_CONSTANT.data
  return Math.exp(-repetitions / rDStar)
}

/**
 * The epoch at which an extra pass is worth a given fraction of a fresh one.
 *
 * The marginal epoch of the law is exactly `e^(−R/R★)`, so the answer is in
 * closed form: `R = −R★·ln(fraction)`. It is the paper's "how many epochs"
 * question answered from its own constants, and it is the number the measured
 * `dominanceEpoch` is compared against.
 */
export function epochsForValue(fraction: number, options: { rDStar?: number } = {}): number {
  const rDStar = options.rDStar ?? PAPER_REPETITION_CONSTANT.data
  if (!(fraction > 0 && fraction <= 1)) throw new Error('epochsForValue: the fraction must be in (0, 1]')
  return -rDStar * Math.log(fraction)
}

/** The finite-data loss: the surface, with the data term read on effective data. */
export function constrainedSurfaceLoss(fit: SurfaceFit, capacity: number, totalTokens: number, uniquePool: number, options: { rDStar?: number } = {}): number {
  return surfaceLoss(fit, capacity, effectiveDataForTokens(uniquePool, totalTokens, options))
}

export interface ConstrainedOptimum {
  capacity: number
  /** The total tokens the run reads, repeats included. */
  tokens: number
  /** How many times it goes over the pool. */
  epochs: number
  /** The extra passes over the pool, which is the law's own variable. */
  repetitions: number
  /** The effective data that costs, under the law. */
  effectiveData: number
  /** What share of the pool's ceiling on effective data the optimum reaches. */
  ceilingUse: number
  loss: number
  /** The unconstrained optimum at the same budget, for comparison. */
  unconstrained: { capacity: number; samples: number; loss: number }
  /** Whether the pool binds at all. */
  binds: boolean
  /** The penalty the constraint costs in loss. */
  price: number
}

/**
 * The compute-optimal allocation when the corpus is finite.
 *
 * The budget still fixes the product of capacity and tokens, but past one pass
 * the tokens no longer buy data at the fresh rate: they buy repeats, and the
 * law says what those are worth. The search is the same log-space ternary
 * search `computeOptimum` uses, and the comparison with `analyticOptimum` at
 * the same budget is the whole point — it says which way a finite pool pushes
 * the allocation, how many epochs it pushes the run into, and what the push
 * costs.
 */
export function constrainedOptimum(
  fit: SurfaceFit,
  budget: number,
  uniquePool: number,
  options: { rDStar?: number } = {},
): ConstrainedOptimum {
  const settings = { rDStar: PAPER_REPETITION_CONSTANT.data, ...options }
  if (!(budget > 0)) throw new Error('constrainedOptimum: the budget must be positive')
  if (!(uniquePool > 0)) throw new Error('constrainedOptimum: the pool must be positive')
  const product = budget / COST_PER_PARAMETER_TOKEN

  const lossAt = (capacity: number): number => constrainedSurfaceLoss(fit, capacity, product / capacity, uniquePool, settings)

  // The capacity term falls along the budget and the effective-data term
  // rises, so the residual is unimodal in the log capacity and a ternary
  // search on it is the same instrument `computeOptimum` uses.
  let low = Math.log(product / 1e6)
  let high = Math.log(product)
  for (let iteration = 0; iteration < 200; iteration++) {
    const m1 = low + (high - low) / 3
    const m2 = high - (high - low) / 3
    if (lossAt(Math.exp(m1)) < lossAt(Math.exp(m2))) high = m2
    else low = m1
  }
  const capacity = Math.exp((low + high) / 2)
  const tokens = product / capacity
  const repetitions = Math.max(0, tokens / uniquePool - 1)
  const effectiveData = effectiveDataLaw(uniquePool, repetitions, settings)
  const unconstrained = analyticOptimum(fit, budget)
  const loss = lossAt(capacity)
  return {
    capacity,
    tokens,
    epochs: tokens / uniquePool,
    repetitions,
    effectiveData,
    ceilingUse: effectiveData / (uniquePool * (1 + settings.rDStar)),
    loss,
    unconstrained: { capacity: unconstrained.capacity, samples: unconstrained.samples, loss: unconstrained.loss },
    binds: tokens > uniquePool,
    price: loss - unconstrained.loss,
  }
}

/**
 * The three-phase curve read off the law rather than off a training run.
 *
 * The epochs along a budget, with the effective data each buys and the value of
 * the next one. It is the same story the measured curves tell, in the paper's
 * own voice: nearly free, then less, then nothing.
 */
export function repetitionSchedule(uniquePool: number, epochs: number, options: { rDStar?: number } = {}): {
  epoch: number
  tokens: number
  effectiveData: number
  nextEpochValue: number
}[] {
  const settings = { rDStar: PAPER_REPETITION_CONSTANT.data, ...options }
  const rows = []
  for (let epoch = 1; epoch <= epochs; epoch++) {
    const repetitions = epoch - 1
    rows.push({
      epoch,
      tokens: epoch * uniquePool,
      effectiveData: effectiveDataLaw(uniquePool, repetitions, settings),
      nextEpochValue: repetitionValue(repetitions, settings),
    })
  }
  return rows
}
