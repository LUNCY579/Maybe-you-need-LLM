/**
 * The scaling laws, and the compute optimum.
 *
 * Two fits, and the argument that connects them.
 *
 * The first is a power law in one variable: the loss falls as a power of the
 * number of samples, and the exponent is what everybody quotes. It is fitted
 * here in log–log space by ordinary least squares, and its weakness — that the
 * exponent depends on the range of the data you fitted — is shown rather than
 * hidden.
 *
 * The second is the two-dimensional surface: the loss as a function of the
 * model's capacity and the number of samples. The surface is fitted by a grid
 * search over the two exponents with a constrained least-squares solve inside,
 * because for fixed exponents the model is linear in its three remaining
 * coefficients — and those three coefficients are a floor and two penalties, so
 * they are held non-negative.
 *
 * The compute optimum is then read off the surface: at a fixed budget, the
 * allocation that minimises the loss is neither "all capacity" nor "all data",
 * and where it sits is a consequence of the two exponents.
 */

import { ols } from '@llm-materials/course-core'

export interface PowerLawFit {
  /** The exponent, positive: the loss falls as x^(-alpha). */
  alpha: number
  /** The coefficient: the loss is coefficient * x^(-alpha). */
  coefficient: number
  /** The R² of the fit in log–log space. */
  r2: number
  /** The predicted values, in the input order. */
  predictions: number[]
}

/**
 * Fit a power law by least squares in log–log space.
 *
 * The points must be positive: the log is what makes the fit a line.
 */
export function fitPowerLaw(xs: number[], ys: number[]): PowerLawFit {
  if (xs.length !== ys.length) throw new Error('fitPowerLaw: the lengths differ')
  if (xs.length < 2) throw new Error('fitPowerLaw: two points are needed')
  for (const value of [...xs, ...ys]) {
    if (!(value > 0)) throw new Error('fitPowerLaw: the values must be positive')
  }
  const logX = xs.map((value) => Math.log(value))
  const logY = ys.map((value) => Math.log(value))
  const fit = ols(logX.map((value) => [value]), logY)
  const slope = fit.coefficients[1] ?? 0
  const intercept = fit.coefficients[0] ?? 0
  return {
    alpha: -slope,
    coefficient: Math.exp(intercept),
    r2: fit.r2,
    predictions: logX.map((value) => Math.exp(intercept + slope * value)),
  }
}

/** The loss a power law predicts. */
export function predictPowerLaw(fit: PowerLawFit, x: number): number {
  return fit.coefficient * x ** (-fit.alpha)
}

/**
 * The multiplicative gain of doubling the data.
 *
 * This is the practical content of a power law: it is not the exponent that
 * matters at the margin, it is the factor you get for each doubling.
 */
export function doublingGain(fit: PowerLawFit): number {
  return 2 ** (-fit.alpha)
}

export interface SurfacePoint {
  /** The model's capacity. */
  capacity: number
  /** The number of training samples. */
  samples: number
  /** The measured loss. */
  loss: number
}

export interface SurfaceFit {
  /** The irreducible loss. */
  E: number
  /** The coefficient of the capacity term. */
  A: number
  /** The exponent of the capacity term. */
  alpha: number
  /** The coefficient of the data term. */
  B: number
  /** The exponent of the data term. */
  beta: number
  /** The R² of the fit. */
  r2: number
  /** The number of points the fit used. */
  points: number
  /**
   * Whether at least one coefficient sits on the boundary it is held at.
   *
   * The three terms of the surface are positive by definition — a floor, a
   * capacity penalty, a data penalty — so the fit is constrained to keep them
   * there. When the constraint binds, the unconstrained least-squares answer
   * wanted something that is not a loss, and the compromise is a fact about the
   * points as much as about the fit. See `fitAtExponents`.
   */
  constrained: boolean
}

/**
 * Fit the surface L(N, D) = E + A·N^(−α) + B·D^(−β).
 *
 * For fixed exponents the model is linear in (E, A, B), so the fit is a grid
 * search over the exponents with a non-negative least-squares solve inside. The
 * search is coarse and then refined, because the surface of the residual is
 * smooth in the exponents and the coarse grid finds the basin.
 */
export function fitSurface(
  points: SurfacePoint[],
  options: { alphaRange?: [number, number]; betaRange?: [number, number]; grid?: number } = {},
): SurfaceFit {
  const settings = {
    alphaRange: [0.05, 1.6] as [number, number],
    betaRange: [0.05, 1.6] as [number, number],
    grid: 25,
    ...options,
  }
  if (points.length < 5) throw new Error('fitSurface: five points are needed')

  // The holder is an object because the search writes to it from inside a
  // closure, and the compiler cannot see those writes through a `let`.
  const state: { best: SurfaceFit | null; bestError: number } = { best: null, bestError: -Infinity }

  const search = (aLow: number, aHigh: number, bLow: number, bHigh: number, steps: number) => {
    for (let i = 0; i <= steps; i++) {
      const alpha = aLow + ((aHigh - aLow) * i) / steps
      for (let j = 0; j <= steps; j++) {
        const beta = bLow + ((bHigh - bLow) * j) / steps
        const candidate = fitAtExponents(points, alpha, beta)
        if (state.best === null || candidate.r2 > state.bestError) {
          state.bestError = candidate.r2
          state.best = candidate
        }
      }
    }
  }

  search(settings.alphaRange[0], settings.alphaRange[1], settings.betaRange[0], settings.betaRange[1], settings.grid)

  // One refinement pass around the best exponents.
  if (state.best) {
    const stepA = (settings.alphaRange[1] - settings.alphaRange[0]) / settings.grid
    const stepB = (settings.betaRange[1] - settings.betaRange[0]) / settings.grid
    search(
      Math.max(0.01, state.best.alpha - stepA),
      state.best.alpha + stepA,
      Math.max(0.01, state.best.beta - stepB),
      state.best.beta + stepB,
      4,
    )
  }

  if (!state.best) throw new Error('fitSurface: the search failed')
  return state.best
}

/**
 * The fit at fixed exponents, with the three coefficients held non-negative.
 *
 * The unconstrained least-squares answer can want a negative floor, and the
 * reason is worth naming because it is a fact about the fixture rather than about
 * the search: the data term of a real ridge risk is σ²·capacity/samples, so its
 * coefficient grows with the capacity, while `E + A·N^(−α) + B·D^(−β)` says the
 * fall with samples looks the same at every size. On a grid whose capacities
 * span 16× the two statements cannot both hold, and ordinary least squares pays
 * for the compromise by pushing the intercept below zero — which is not a loss,
 * and which every downstream number then inherits: the loss at the optimum, the
 * budget a target costs, the year a capability became buyable.
 *
 * So the coefficients are constrained instead. The feasible set is the positive
 * octant, whose faces are the subsets of the three columns; the constrained
 * optimum lies on the face where exactly the coefficients at the boundary sit, so
 * enumerating the eight subsets and keeping the best fit whose own coefficients
 * are all non-negative is exact, not a heuristic. Three columns is eight solves.
 */
function fitAtExponents(points: SurfacePoint[], alpha: number, beta: number): SurfaceFit {
  const design = points.map((point) => [1, point.capacity ** -alpha, point.samples ** -beta])
  const response = points.map((point) => point.loss)
  const mean = response.reduce((total, value) => total + value, 0) / response.length
  const spread = response.reduce((total, value) => total + (value - mean) ** 2, 0)

  let best: { E: number; A: number; B: number; sse: number; mask: number } | null = null
  for (let mask = 0; mask < 8; mask++) {
    const kept = [0, 1, 2].filter((column) => (mask & 2 ** column) !== 0)
    const solution = solveSubset(design, response, kept)
    // A face whose free coefficients want to be negative is not feasible: the
    // constrained optimum on it is on a smaller face, which is on the list.
    if (solution === null || solution.some((value) => value < 0)) continue
    const fitted = solutionFor(solution, kept)
    let sse = 0
    for (let n = 0; n < design.length; n++) {
      const row = design[n]!
      sse += (fitted.E + fitted.A * row[1]! + fitted.B * row[2]! - response[n]!) ** 2
    }
    if (best === null || sse < best.sse) best = { ...fitted, sse, mask }
  }

  if (best === null) throw new Error('fitSurface: no non-negative fit was found')

  return {
    E: best.E,
    A: best.A,
    alpha,
    B: best.B,
    beta,
    r2: spread <= 0 ? 0 : 1 - best.sse / spread,
    points: points.length,
    constrained: best.mask !== 0b111,
  }
}

/** The three coefficients of a face, read back into the model's names. */
function solutionFor(solution: number[], kept: number[]): { E: number; A: number; B: number } {
  const values = { E: 0, A: 0, B: 0 }
  for (let index = 0; index < kept.length; index++) {
    const value = solution[index]!
    if (kept[index] === 0) values.E = value
    else if (kept[index] === 1) values.A = value
    else values.B = value
  }
  return values
}

/**
 * Least squares over a subset of the design's columns, with no intercept of its
 * own: column 0 *is* the intercept, and whether it is free is the caller's choice.
 */
function solveSubset(design: number[][], response: number[], kept: number[]): number[] | null {
  const size = kept.length
  if (size === 0) return []
  const gram: number[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => 0))
  const right = Array.from({ length: size }, () => 0)
  for (let n = 0; n < design.length; n++) {
    const row = design[n]!
    for (let a = 0; a < size; a++) {
      right[a] = (right[a] ?? 0) + row[kept[a]!]! * response[n]!
      for (let b = 0; b < size; b++) gram[a]![b] = (gram[a]![b] ?? 0) + row[kept[a]!]! * row[kept[b]!]!
    }
  }
  return solveSquare(gram, right)
}

/** A square solve with partial pivoting, for the two- and three-column systems. */
function solveSquare(matrix: number[][], right: number[]): number[] | null {
  const size = right.length
  const m = matrix.map((row, index) => [...row, right[index]!])
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
    if (Math.abs(diagonal) < 1e-12) return null
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

/** The loss the fitted surface predicts. */
export function surfaceLoss(fit: SurfaceFit, capacity: number, samples: number): number {
  return fit.E + fit.A * capacity ** -fit.alpha + fit.B * samples ** -fit.beta
}

export interface ComputeOptimum {
  /** The capacity at the optimum. */
  capacity: number
  /** The number of samples at the optimum. */
  samples: number
  /** The loss at the optimum. */
  loss: number
  /** The samples per parameter at the optimum. */
  samplesPerParameter: number
  /** The whole loss curve along the budget, for the chart. */
  curve: { capacity: number; samples: number; loss: number }[]
}

/**
 * The allocation that minimises the loss at a fixed compute budget.
 *
 * The budget is the product of the capacity and the number of samples, times
 * the constant that says how much arithmetic one parameter-token costs. The
 * search is a scan over the capacity in log space, with the sample count
 * pinned by the budget, and the minimum is then refined by a ternary search.
 */
export function computeOptimum(
  fit: SurfaceFit,
  budget: number,
  options: { costPerParameterToken?: number; points?: number } = {},
): ComputeOptimum {
  const settings = { costPerParameterToken: 6, points: 240, ...options }
  const product = budget / settings.costPerParameterToken

  const lossAt = (capacity: number): number => {
    const samples = product / capacity
    return surfaceLoss(fit, capacity, samples)
  }

  let low = Math.log(product / 1e6)
  let high = Math.log(product)
  for (let iteration = 0; iteration < 200; iteration++) {
    const m1 = low + (high - low) / 3
    const m2 = high - (high - low) / 3
    if (lossAt(Math.exp(m1)) < lossAt(Math.exp(m2))) high = m2
    else low = m1
  }
  const capacity = Math.exp((low + high) / 2)
  const samples = product / capacity

  const curve: { capacity: number; samples: number; loss: number }[] = []
  const from = Math.log(product / 1e6)
  const to = Math.log(product)
  for (let i = 0; i <= settings.points; i++) {
    const c = Math.exp(from + ((to - from) * i) / settings.points)
    const s = product / c
    curve.push({ capacity: c, samples: s, loss: surfaceLoss(fit, c, s) })
  }

  return {
    capacity,
    samples,
    loss: lossAt(capacity),
    samplesPerParameter: samples / capacity,
    curve,
  }
}

/**
 * The loss of the worst allocation at a budget, for comparison.
 *
 * The point of the compute optimum is that the alternatives are worse: all
 * the capacity, or all the data, or the average of the two.
 */
export function compareAllocations(fit: SurfaceFit, budget: number): {
  name: string
  capacity: number
  samples: number
  loss: number
}[] {
  const product = budget / 6
  const optimum = computeOptimum(fit, budget)
  const allCapacity = { capacity: product, samples: 1 }
  const allData = { capacity: 1, samples: product }
  const geometric = { capacity: Math.sqrt(product), samples: Math.sqrt(product) }
  return [
    { name: 'the compute optimum', capacity: optimum.capacity, samples: optimum.samples, loss: optimum.loss },
    { name: 'all capacity, no data', capacity: allCapacity.capacity, samples: allCapacity.samples, loss: surfaceLoss(fit, allCapacity.capacity, allCapacity.samples) },
    { name: 'all data, no capacity', capacity: allData.capacity, samples: allData.samples, loss: surfaceLoss(fit, allData.capacity, allData.samples) },
    { name: 'the geometric mean', capacity: geometric.capacity, samples: geometric.samples, loss: surfaceLoss(fit, geometric.capacity, geometric.samples) },
  ]
}
