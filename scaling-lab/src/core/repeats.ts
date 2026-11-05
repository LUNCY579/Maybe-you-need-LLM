/**
 * The data-constrained regime.
 *
 * When the unique data runs out, the only way to keep the training run going
 * is to go round again. The question the literature asks is what the repeats
 * are worth.
 *
 * The cleanest possible answer comes from a learner whose solution is
 * explicit. A ridge estimator solves
 *
 *     w = (XᵀX + λI)⁻¹ Xᵀy
 *
 * and if every row of X is repeated E times, then XᵀX and Xᵀy are both
 * multiplied by E — so the solution is *unchanged*. Repeating the data buys
 * exactly nothing: the same model, at E times the price. Fresh data, by
 * contrast, keeps improving the estimate, because every new row is new
 * information.
 *
 * That is the whole of the repetition penalty, in one line of algebra, and
 * the laboratory measures it.
 */

import { createRng } from '@llm-materials/course-core'

export interface RepeatsOptions {
  /** The number of unique training rows. */
  unique?: number
  /** The number of input dimensions. */
  features?: number
  /** The number of random features the model is given. */
  capacity?: number
  /** The ridge penalty. */
  ridge?: number
  /** The noise variance. */
  noise?: number
  /** The seed. */
  seed?: number
}

export interface RepeatsTask {
  /** The unique training rows. */
  x: number[][]
  /** The targets of the unique training rows. */
  y: number[]
  /** The held-out rows. */
  testX: number[][]
  /** The held-out targets. */
  testY: number[]
  /** The input dimension. */
  features: number
  /** The number of random features. */
  capacity: number
  /** The dimension of the raw input, before the random feature map. */
  inputFeatures: number
  /** The noise variance. */
  noise: number
  /** The seed the task was built with. */
  seed: number
  /** The ridge penalty. */
  ridge: number
}

export interface RepeatsComparison {
  /** The number of repeats. */
  repeats: number
  /** The number of rows the repeated run saw, counting the repeats. */
  rows: number
  /** The held-out loss of the model trained on the repeated data. */
  repeatedLoss: number
  /** The held-out loss of a model trained on the same number of fresh rows. */
  freshLoss: number
  /** The price of repeating: the gap between the two. */
  gap: number
  /** The ratio between them. */
  ratio: number
  /** The number of arithmetic operations the repeated run cost, in units. */
  compute: number
}

/**
 * The task.
 *
 * A linear regression with a decaying spectrum, on a random feature map: the
 * model sees a fixed number of random features, and the truth is a linear
 * function of the first few of them. It is a regression rather than a
 * classification because the ridge solution is then explicit.
 */
export function buildRepeatsTask(options: RepeatsOptions = {}): RepeatsTask {
  const settings = { unique: 200, features: 12, capacity: 40, ridge: 0.05, noise: 0.05, seed: 7, ...options }
  const weights: number[] = []
  for (let j = 0; j < settings.features; j++) weights.push((j < 3 ? 1 : 0.15) / (j + 1) ** 0.5)

  const draw = (count: number, salt: number) => {
    const x: number[][] = []
    const y: number[] = []
    const local = createRng(settings.seed + salt)
    for (let n = 0; n < count; n++) {
      const row: number[] = []
      for (let j = 0; j < settings.features; j++) row.push(gaussian(local))
      let signal = 0
      for (let j = 0; j < settings.features; j++) signal += (row[j] ?? 0) * (weights[j] ?? 0)
      x.push(row)
      y.push(signal + gaussian(local) * Math.sqrt(settings.noise))
    }
    return { x, y }
  }

  const train = draw(settings.unique, 0)
  const test = draw(Math.max(200, Math.floor(settings.unique / 2)), 991)

  // The random feature map: a fixed projection, derived only from the
  // dimensions, so that every run sees the same features and the comparison
  // is between the data and nothing else.
  const projectionRng = createRng(0x5eed + settings.capacity * 31 + settings.features * 7)
  const projection: number[][] = []
  for (let h = 0; h < settings.capacity; h++) {
    const row: number[] = []
    for (let j = 0; j < settings.features; j++) row.push(gaussian(projectionRng))
    projection.push(row)
  }

  return {
    x: train.x.map((row) => project(row, projection)),
    y: train.y,
    testX: test.x.map((row) => project(row, projection)),
    testY: test.y,
    features: settings.capacity,
    capacity: settings.capacity,
    inputFeatures: settings.features,
    noise: settings.noise,
    seed: settings.seed,
    ridge: settings.ridge,
  }
}

function project(row: number[], projection: number[][]): number[] {
  const features: number[] = []
  for (const vector of projection) {
    let total = 0
    for (let j = 0; j < row.length; j++) total += (row[j] ?? 0) * (vector[j] ?? 0)
    features.push(total)
  }
  return features
}

function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12)
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** The ridge solution, by the normal equations. */
export function ridgeFit(x: number[][], y: number[], features: number, ridge: number): number[] {
  const gram: number[][] = []
  // The penalty is relative to the mean loss, so it is scaled by the number
  // of rows. That is what makes the solution invariant under repetition:
  // repeating every row E times multiplies the data term by E and the
  // penalty by E, and the ratio is unchanged.
  const penalty = ridge * Math.max(1, x.length)
  for (let a = 0; a < features; a++) {
    const row: number[] = Array.from({ length: features + 1 }, () => 0)
    for (let b = 0; b < features; b++) {
      let total = 0
      for (const point of x) total += (point[a] ?? 0) * (point[b] ?? 0)
      row[b] = total + (a === b ? penalty : 0)
    }
    let rhs = 0
    for (let n = 0; n < x.length; n++) rhs += (x[n]?.[a] ?? 0) * (y[n] ?? 0)
    row[features] = rhs
    gram.push(row)
  }
  return solveGaussian(gram, features)
}

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

/** The mean squared error of a ridge solution on a set of rows. */
export function meanSquaredError(x: number[][], y: number[], weights: number[]): number {
  if (x.length === 0) return 0
  let total = 0
  for (let n = 0; n < x.length; n++) {
    let prediction = 0
    for (let f = 0; f < weights.length; f++) prediction += (weights[f] ?? 0) * (x[n]?.[f] ?? 0)
    const error = prediction - (y[n] ?? 0)
    total += error * error
  }
  return total / x.length
}

/**
 * The comparison at one number of repeats.
 *
 * The repeated run sees each unique row `repeats` times. The fresh run sees
 * the same number of rows, all of them new. Both are measured on the same
 * held-out set, and the compute is the number of rows each run had to chew
 * through.
 */
export function compareAtRepeats(task: RepeatsTask, repeats: number, options: RepeatsOptions = {}): RepeatsComparison {
  const settings = { ridge: 0.05, seed: 7, ...options }
  const rows = task.x.length * repeats

  const repeatedX: number[][] = []
  const repeatedY: number[] = []
  for (let r = 0; r < repeats; r++) {
    for (let n = 0; n < task.x.length; n++) {
      repeatedX.push(task.x[n]!)
      repeatedY.push(task.y[n]!)
    }
  }

  const fresh = buildRepeatsTask({
    unique: rows,
    features: task.inputFeatures,
    capacity: task.capacity,
    ridge: settings.ridge,
    noise: task.noise,
    seed: task.seed + 1000,
  })
  const freshX = fresh.x.slice(0, rows)
  const freshY = fresh.y.slice(0, rows)

  const repeatedWeights = ridgeFit(repeatedX, repeatedY, task.features, settings.ridge)
  const freshWeights = ridgeFit(freshX, freshY, task.features, settings.ridge)

  const repeatedLoss = meanSquaredError(task.testX, task.testY, repeatedWeights)
  const freshLoss = meanSquaredError(task.testX, task.testY, freshWeights)

  return {
    repeats,
    rows,
    repeatedLoss,
    freshLoss,
    gap: repeatedLoss - freshLoss,
    ratio: freshLoss > 0 ? repeatedLoss / freshLoss : 1,
    compute: rows,
  }
}

/** The comparison over a range of numbers of repeats. */
export function repeatComparison(
  task: RepeatsTask,
  repeats: number[],
  options: RepeatsOptions = {},
): RepeatsComparison[] {
  return repeats.map((count) => compareAtRepeats(task, count, options))
}
