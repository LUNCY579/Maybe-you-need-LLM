/**
 * The scaling task.
 *
 * A scaling law is a statement about a loss measured on real training runs,
 * and the honest way to teach one is to have real training runs to measure.
 * This module builds one.
 *
 * The task is a spectral regression: the input has `features` dimensions with
 * a decaying variance spectrum, the truth is a linear function whose
 * coefficients are all equal, and the observation carries noise. A learner is
 * given two knobs:
 *
 * - **capacity** — how many of the spectrum's directions it may use. Using
 *   too few leaves signal on the table; using more costs variance.
 * - **samples** — how many training points it sees.
 *
 * The excess risk of a ridge estimator on this task is a sum of two powers:
 * the truncation bias, which falls with the capacity, and the variance, which
 * falls with the number of samples. That is the shape every scaling law in
 * this course has, and it is not assumed — it is measured.
 */

import { createRng } from '@llm-materials/course-core'

export interface ScalingTask {
  /** The variance of each input dimension. */
  spectrum: number[]
  /** The true coefficient of each dimension. */
  truth: number[]
  /** The noise variance of the observations. */
  noise: number
  /** The number of input dimensions. */
  features: number
}

export interface TrainOptions {
  /** How many of the spectrum's directions the learner may use. */
  capacity: number
  /** How many training points to draw. */
  samples: number
  /** The ridge penalty, per training point — see `ridgeSolve`. */
  ridge?: number
  /** The seed. */
  seed?: number
}

export interface TrainResult {
  /** The loss on the training set. */
  trainLoss: number
  /** The loss on a held-out set. */
  testLoss: number
  /** The number of parameters the learner had. */
  parameters: number
  /** The number of samples it saw. */
  samples: number
}

/** The smallest possible loss: the noise the task cannot be beaten past. */
export function irreducibleLoss(task: ScalingTask): number {
  return task.noise
}

/**
 * Build the task.
 *
 * The spectrum decays as a power law with the exponent `decay`, which is what
 * decides the shape of the bias curve: the signal in the tail beyond the
 * capacity is worth (capacity)^(1 − 2·decay), so the bias falls as a power
 * law with exponent 2·decay − 1.
 */
export function buildScalingTask(options: {
  features?: number
  decay?: number
  noise?: number
} = {}): ScalingTask {
  const features = options.features ?? 64
  const decay = options.decay ?? 0.75
  const noise = options.noise ?? 0.05
  const spectrum: number[] = []
  const truth: number[] = []
  for (let j = 0; j < features; j++) {
    spectrum.push(1 / (j + 1) ** decay)
    truth.push(1)
  }
  return { spectrum, truth, noise, features }
}

/** Draw a design matrix and the response for a task. */
export function drawSample(
  task: ScalingTask,
  count: number,
  seed: number,
): { x: number[][]; y: number[] } {
  const rng = createRng(seed)
  const x: number[][] = []
  const y: number[] = []
  for (let n = 0; n < count; n++) {
    const row: number[] = []
    let signal = 0
    for (let j = 0; j < task.features; j++) {
      const value = gaussian(rng) * task.spectrum[j]!
      row.push(value)
      signal += value * task.truth[j]!
    }
    const noise = gaussian(rng) * Math.sqrt(task.noise)
    x.push(row)
    y.push(signal + noise)
  }
  return { x, y }
}

function gaussian(rng: () => number): number {
  // Box–Muller, from the seeded generator.
  const u = Math.max(rng(), 1e-12)
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/**
 * The size of the held-out set: fixed, rather than a fraction of the training set.
 *
 * The grid this module feeds to `fitSurface` is swept along the sample axis, and
 * the error of a loss estimate falls with the number of rows it is measured on.
 * Scaling the held-out set with the training set therefore makes the *noise* of
 * the measurement a function of the axis the fit is trying to read: the points at
 * 50 samples came out scattered by ±0.1 around a curve that is flat to 0.01, and
 * the grid was not monotone in data at any capacity. One fixed set makes every
 * point of the grid an estimate of the same accuracy, so what is left of the
 * scatter is the run-to-run variation of the weights rather than of the ruler.
 */
const EVALUATION_SAMPLES = 512

/**
 * Train a ridge estimator on the first `capacity` directions and measure it.
 *
 * The estimator is the closed-form ridge solution, so the run is exact and
 * the cost is a single linear system; the losses are measured on data the
 * estimator never saw.
 */
export function trainRidge(task: ScalingTask, options: TrainOptions): TrainResult {
  const settings = { ridge: 1e-3, seed: 1, ...options }
  const capacity = Math.max(1, Math.min(task.features, settings.capacity))
  const { x, y } = drawSample(task, settings.samples, settings.seed)
  const { x: testX, y: testY } = drawSample(task, EVALUATION_SAMPLES, settings.seed + 7717)

  const weights = ridgeSolve(x, y, capacity, settings.ridge * Math.max(1, settings.samples))

  const trainLoss = meanSquaredError(x, y, weights, capacity)
  const testLoss = meanSquaredError(testX, testY, weights, capacity)

  return { trainLoss, testLoss, parameters: capacity + 1, samples: settings.samples }
}

/** The mean squared error of a prediction. */
export function meanSquaredError(x: number[][], y: number[], weights: number[], capacity: number): number {
  let total = 0
  for (let n = 0; n < x.length; n++) {
    const row = x[n]!
    let prediction = 0
    for (let j = 0; j < capacity; j++) prediction += (row[j] ?? 0) * (weights[j] ?? 0)
    const error = prediction - (y[n] ?? 0)
    total += error * error
  }
  return x.length === 0 ? 0 : total / x.length
}

/**
 * The ridge solution, by the normal equations.
 *
 * `penalty` is the total added to the diagonal, so a caller that wants a penalty
 * relative to the mean loss — the convention `ridgeFit` in `repeats.ts` uses, and
 * the one this module needs because its grid changes the sample count — passes
 * `ridge × samples`. The relative penalty is what stays fixed when a run is
 * re-read with more data; the absolute one quietly changes the estimator at every
 * point of the grid.
 */
function ridgeSolve(x: number[][], y: number[], capacity: number, penalty: number): number[] {
  const gram: number[][] = []
  for (let a = 0; a < capacity; a++) {
    const row: number[] = Array.from({ length: capacity + 1 }, () => 0)
    for (let b = 0; b < capacity; b++) {
      let total = 0
      for (const point of x) total += (point[a] ?? 0) * (point[b] ?? 0)
      row[b] = total + (a === b ? penalty : 0)
    }
    let rhs = 0
    for (let n = 0; n < x.length; n++) rhs += (x[n]?.[a] ?? 0) * (y[n] ?? 0)
    row[capacity] = rhs
    gram.push(row)
  }
  return solveGaussian(gram, capacity)
}

/** A Gauss–Jordan solve with partial pivoting. */
function solveGaussian(matrix: number[][], size: number): number[] {
  const m = matrix.map((row) => [...row])
  for (let col = 0; col < size; col++) {
    let pivot = col
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(m[row]![col]!) > Math.abs(m[pivot]![col]!)) pivot = row
    }
    if (pivot !== col) {
      const tmp = m[pivot]!
      m[pivot] = m[col]!
      m[col] = tmp
    }
    const diagonal = m[col]![col]!
    if (Math.abs(diagonal) < 1e-12) continue
    for (let k = col; k <= size; k++) m[col]![k] = (m[col]![k] ?? 0) / diagonal
    for (let row = 0; row < size; row++) {
      if (row === col) continue
      const factor = m[row]![col]!
      if (factor === 0) continue
      for (let k = col; k <= size; k++) m[row]![k] = (m[row]![k] ?? 0) - factor * (m[col]![k] ?? 0)
    }
  }
  return m.map((row) => row[size] ?? 0)
}
