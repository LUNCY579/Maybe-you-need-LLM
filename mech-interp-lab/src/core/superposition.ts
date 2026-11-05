/**
 * Superposition, computed.
 *
 * The toy model of superposition asks a simple question: what happens when a
 * model has fewer dimensions than the features it wants to represent?
 *
 * The model implemented here is the paper's, and it is exactly computable.
 *
 * - There are `n` features. Feature k has an importance I_k.
 * - The model is a matrix W ∈ R^{d×n}: one column w_k per feature, each
 *   constrained to the unit ball.
 * - The activation is h = W x, and the model reads feature k back as
 *   x̂_k = w_k · h = Σ_m (w_k · w_m) x_m.
 *
 * With the features independent and unit-variance, the expected squared error
 * of feature k is exactly
 *
 *   L_k = E[(x_k − x̂_k)²] = 1 − 2‖w_k‖² + Σ_m (w_k · w_m)²
 *
 * and the loss is the importance-weighted sum Σ_k I_k L_k. When the columns
 * are orthonormal the first two terms cancel and what is left is pure
 * **interference**:
 *
 *   L_k = I_k Σ_{m ≠ k} (w_k · w_m)²
 *
 * So with d dimensions and n > d features the columns *cannot* all be
 * orthogonal, and the features that share a direction interfere with each
 * other. The interference is the price of superposition, and it is exactly
 * computable.
 *
 * A feature whose column is zero is dropped: it costs its own importance and
 * interferes with nothing. The trade-off between those two is the
 * **importance threshold**, and the laboratory measures it rather than
 * quoting it.
 *
 * The last section of this module is the other half of the same question asked
 * the other way round: fix the number of dimensions, add features one at a
 * time, and watch what the model does to the interference. That is
 * `tradeoffCurve`, and it is where the phrase "the price of a feature" becomes a
 * number rather than a picture.
 */

import { createRng, gaussian } from '@llm-materials/course-core'
import type { Rng, Vector } from '@llm-materials/course-core'

export interface Feature {
  id: number
  /** How important the feature is. */
  importance: number
  /** The direction the feature arrives from, a unit vector in R^d. */
  input: Vector
  /** A sample of the feature's value. */
  value: number
}

export interface SuperpositionModel {
  /** The model's columns, one per feature: d × n. */
  columns: Vector[]
  /** The number of dimensions. */
  dimensions: number
  /** The total expected squared loss. */
  loss: number
  /** The loss per represented feature. */
  lossPerFeature: number
  /** The total interference, summed over every feature. */
  interference: number
  /** The features the model represents. */
  represented: number[]
  /** The features the model dropped. */
  dropped: number[]
  /** The interference each feature suffers. */
  interferencePerFeature: number[]
  /** The fraction of each feature's own signal the model recovers. */
  recoveryPerFeature: number[]
  /** The effective number of features per direction. */
  featuresPerDirection: number[]
}

/* ------------------------------------------------------------------ helpers */

/** The dot product of two vectors. */
export function dot(a: Vector, b: Vector): number {
  let total = 0
  for (let i = 0; i < a.length; i++) total += a[i]! * b[i]!
  return total
}

/** A vector scaled by a factor. */
export function scale(a: Vector, factor: number): Vector {
  return a.map((value) => value * factor)
}

/** The squared length of a vector. */
export function squaredNorm(a: Vector): number {
  let total = 0
  for (const value of a) total += value * value
  return total
}

/** The Euclidean length of a vector. */
export function norm(a: Vector): number {
  return Math.sqrt(squaredNorm(a))
}

/* -------------------------------------------------------------------- loss */

/**
 * The total expected squared loss of a set of columns.
 *
 * L = Σ_k I_k [1 − 2‖w_k‖² + Σ_m (w_k · w_m)²]
 */
export function superpositionLoss(features: Feature[], columns: Vector[]): number {
  let total = 0
  for (let k = 0; k < features.length; k++) {
    const column = columns[k] ?? []
    let sumSquares = 0
    for (let m = 0; m < features.length; m++) {
      const projection = dot(column, columns[m] ?? [])
      sumSquares += projection * projection
    }
    const self = squaredNorm(column)
    total += features[k]!.importance * (1 - 2 * self + sumSquares)
  }
  return total
}

/**
 * The gradient of the loss with respect to the columns.
 *
 * The loss is
 *
 *   L = Σ_k I_k [1 − 2 w_k·w_k + Σ_m (w_k·w_m)²]
 *
 * and differentiating it directly, rather than through the Gram matrix, is
 * both simpler and safer: the Gram matrix is symmetric, and treating its
 * entries as independent variables gets the cross terms wrong.
 *
 * For a single feature k:
 *
 *   ∂L/∂w_p = Σ_k I_k [−4 δ_{kp} w_k
 *                      + 2 Σ_m (w_k·w_m)(δ_{kp} w_m + δ_{mp} w_k)]
 */
export function superpositionGradient(features: Feature[], columns: Vector[]): Vector[] {
  const n = features.length
  const d = columns[0]?.length ?? 0
  const gradients: Vector[] = columns.map(() => new Array<number>(d).fill(0))

  for (let k = 0; k < n; k++) {
    const wk = columns[k]!
    const importance = features[k]!.importance

    // The self term: −4 I_k w_k.
    for (let i = 0; i < d; i++) {
      gradients[k]![i] = (gradients[k]![i] ?? 0) - 4 * importance * wk[i]!
    }

    for (let m = 0; m < n; m++) {
      const wm = columns[m]!
      const projection = dot(wk, wm)
      if (projection === 0) continue
      // p === k: the derivative of (w_k·w_m)² contributes w_m.
      for (let i = 0; i < d; i++) {
        gradients[k]![i] = (gradients[k]![i] ?? 0) + 2 * importance * projection * wm[i]!
        // p === m: and contributes w_k.
        gradients[m]![i] = (gradients[m]![i] ?? 0) + 2 * importance * projection * wk[i]!
      }
    }
  }

  return gradients
}

/* -------------------------------------------------------------------- fit */

/**
 * Fit the model.
 *
 * The optimisation is projected gradient descent: a step on the gradient, then
 * each column is projected back onto the unit ball, so the model can only
 * represent a feature as strongly as the constraint allows.
 */
export function buildSuperpositionModel(
  features: Feature[],
  dimensions: number,
  options: { steps?: number; learningRate?: number; seed?: number } = {},
): SuperpositionModel {
  const steps = options.steps ?? 1500
  const learningRate = options.learningRate ?? 0.02
  const d = Math.max(1, dimensions)
  const n = features.length
  const rng = createRng(options.seed ?? 5)

  // The columns start spread out: the first d features take a direction each,
  // and the rest start at random angles. Starting from a configuration that is
  // already close to the optimum is what lets the descent find the
  // superposed solutions rather than dropping everything.
  const columns: Vector[] = []
  for (let k = 0; k < n; k++) {
    const column = new Array<number>(d).fill(0)
    if (k < d) {
      column[k] = 1
      for (let i = 0; i < d; i++) column[i] = (column[i] ?? 0) + (rng() * 2 - 1) * 0.15
    } else {
      const random = randomUnitVector(rng, d)
      for (let i = 0; i < d; i++) column[i] = random[i]!
    }
    const length = norm(column)
    columns.push(length > 0 ? scale(column, 1 / length) : column)
  }

  for (let step = 0; step < steps; step++) {
    const gradients = superpositionGradient(features, columns)
    for (let k = 0; k < n; k++) {
      const column = columns[k]!
      const gradient = gradients[k]!
      const updated = column.map((value, i) => value - learningRate * (gradient[i] ?? 0))
      // Project onto the unit ball.
      const length = norm(updated)
      columns[k] = length > 1 ? scale(updated, 1 / length) : updated
    }
  }

  return summariseModel(features, columns, d)
}

/** Compute every measurement of a fitted model. */
export function summariseModel(features: Feature[], columns: Vector[], dimensions: number): SuperpositionModel {
  const n = features.length
  const interferencePerFeature: number[] = []
  const recoveryPerFeature: number[] = []
  const represented: number[] = []
  const dropped: number[] = []

  for (let k = 0; k < n; k++) {
    const column = columns[k] ?? []
    const self = squaredNorm(column)
    let sumSquares = 0
    for (let m = 0; m < n; m++) {
      const projection = dot(column, columns[m] ?? [])
      sumSquares += projection * projection
    }
    // The interference is everything in the sum beyond the feature's own
    // contribution, which is (w_k·w_k)².
    interferencePerFeature.push(features[k]!.importance * (sumSquares - self * self))
    recoveryPerFeature.push(self)
    if (self > 1e-6) represented.push(k)
    else dropped.push(features[k]!.id)
  }

  // The effective number of features per direction: the inverse participation
  // ratio of the row of W. One means the direction is used by one feature.
  const featuresPerDirection: number[] = []
  for (let i = 0; i < dimensions; i++) {
    let sum = 0
    let sumSquares = 0
    for (let k = 0; k < n; k++) {
      const value = columns[k]?.[i] ?? 0
      sum += value * value
      sumSquares += value ** 4
    }
    featuresPerDirection.push(sumSquares === 0 ? 0 : (sum * sum) / sumSquares)
  }

  const loss = superpositionLoss(features, columns)

  return {
    columns,
    dimensions,
    loss,
    lossPerFeature: loss / Math.max(1, represented.length),
    interference: interferencePerFeature.reduce((a, b) => a + b, 0),
    represented,
    dropped,
    interferencePerFeature,
    recoveryPerFeature,
    featuresPerDirection,
  }
}

/* ------------------------------------------------------------ measurements */

/**
 * The interference between two directions.
 *
 * The cross term in the loss when two features share a direction is
 * (w_i·w_j)². It is zero when the directions are orthogonal, and it grows
 * quadratically as they align.
 */
export function interference(directionA: Vector, directionB: Vector): number {
  const projection = dot(directionA, directionB)
  return projection * projection
}

/**
 * How many features each direction carries.
 *
 * One means the direction is monosemantic; more than one means the model has
 * superposed, and the direction's meaning is a mixture.
 */
export function directionLoad(model: SuperpositionModel): number[] {
  return model.featuresPerDirection
}

/**
 * The average number of features per direction.
 */
export function polysemanticity(model: SuperpositionModel): number {
  const used = model.featuresPerDirection.filter((load) => load > 0)
  if (used.length === 0) return 0
  return used.reduce((a, b) => a + b, 0) / used.length
}

/** The fraction of the features that the model represents. */
export function coverage(model: SuperpositionModel, featureCount: number): number {
  return featureCount === 0 ? 0 : model.represented.length / featureCount
}

/**
 * The importance threshold for one feature.
 *
 * Sweep the feature's importance and find the point at which the model
 * starts to represent it. This is the "importance threshold" the toy model
 * is famous for, measured here rather than quoted.
 */
export function importanceThreshold(
  features: Feature[],
  featureIndex: number,
  dimensions: number,
  options: { steps?: number; seed?: number } = {},
): { importance: number; represented: boolean }[] {
  const steps = options.steps ?? 30
  const maximum = features[featureIndex]?.importance ?? 1
  const curve: { importance: number; represented: boolean }[] = []

  for (let step = 0; step <= steps; step++) {
    const importance = (maximum * step) / steps
    const probe = features.map((feature, index) =>
      index === featureIndex ? { ...feature, importance } : feature,
    )
    const model = buildSuperpositionModel(probe, dimensions, { steps: 250, seed: options.seed ?? 5 })
    curve.push({ importance, represented: model.represented.includes(featureIndex) })
  }

  return curve
}

/**
 * One point on the interference-versus-feature-count curve.
 *
 * Every field is measured on a model fitted at that feature count, from the
 * same seeded start, so two points differ only in how many features were
 * offered.
 */
export interface TradeoffPoint {
  /** How many features the model was offered. */
  features: number
  dimensions: number
  /** The weighted loss of the fitted model. */
  loss: number
  /** The loss of fitting nothing: `Σ_k I_k`, the reference the curve is measured against. */
  dropEverythingLoss: number
  /** The total interference paid by the features that were kept. */
  interference: number
  /** Interference per kept feature — what one feature pays for the company it is in. */
  interferencePerFeature: number
  represented: number
  dropped: number
  coverage: number
  /** The average number of features sharing a direction that is in use. */
  polysemanticity: number
  /** `loss` minus the previous point's loss: what the newest feature cost. */
  marginalLoss: number
}

/**
 * The trade-off the toy model is named for, computed.
 *
 * Hold the dimensions fixed and add features one at a time, most important
 * first. While there is a spare direction each new feature is free: it takes it
 * and interferes with nothing. Once the features outnumber the dimensions the
 * model has a choice — pay interference, or drop the tail and pay its
 * importance — and the curve is the record of which one it picks. Reading
 * `interferencePerFeature` against `dropped` is therefore the whole argument of
 * the paper's section on the toy model, in two columns of numbers.
 *
 * Each point is a fresh fit rather than the previous fit with one more column,
 * which costs time and buys the only comparison that means anything: the same
 * starting configuration every time.
 *
 * The step count matters more here than anywhere else in the module. A feature
 * is only *dropped* when its column has been shrunk to nothing, and projected
 * gradient descent spends a long while making it small before making it zero —
 * a few hundred steps will show the steep importance law keeping features it has
 * already given up on. The default is what the descent needs to settle.
 */
export function tradeoffCurve(
  features: Feature[],
  dimensions: number,
  options: { counts?: number[]; steps?: number; learningRate?: number; seed?: number } = {},
): TradeoffPoint[] {
  const steps = options.steps ?? 1200
  const seed = options.seed ?? 5
  const counts = options.counts ?? Array.from({ length: Math.min(features.length, dimensions * 3) }, (_, index) => index + 1)

  const points: TradeoffPoint[] = []
  let previousLoss = 0

  for (const count of counts) {
    const offered = features.slice(0, count)
    const model = buildSuperpositionModel(offered, dimensions, { steps, learningRate: options.learningRate, seed })
    const loss = model.loss
    points.push({
      features: count,
      dimensions,
      loss,
      dropEverythingLoss: offered.reduce((total, feature) => total + feature.importance, 0),
      interference: model.interference,
      interferencePerFeature: model.interference / Math.max(1, model.represented.length),
      represented: model.represented.length,
      dropped: model.dropped.length,
      coverage: coverage(model, offered.length),
      polysemanticity: polysemanticity(model),
      marginalLoss: loss - previousLoss,
    })
    previousLoss = loss
  }

  return points
}

/**
 * Generate a set of features.
 *
 * The importances follow a power law, because that is the assumption the toy
 * model makes: a few important features and a long tail of unimportant ones.
 */
export function generateFeatures(
  count: number,
  dimensions: number,
  seed = 5,
  importanceExponent = 2,
): Feature[] {
  const rng = createRng(seed)
  const features: Feature[] = []
  for (let i = 0; i < count; i++) {
    features.push({
      id: i,
      importance: 1 / (i + 1) ** importanceExponent,
      input: randomUnitVector(rng, dimensions),
      value: gaussian(rng),
    })
  }
  return features
}

/** A random unit vector in R^d. */
export function randomUnitVector(rng: Rng, dimensions: number): Vector {
  const raw = new Array<number>(dimensions)
  let norm = 0
  for (let i = 0; i < dimensions; i++) {
    raw[i] = gaussian(rng)
    norm += raw[i]! * raw[i]!
  }
  norm = Math.sqrt(norm)
  if (norm === 0) {
    raw[0] = 1
    norm = 1
  }
  return raw.map((value) => value / norm)
}
