/**
 * IsoFLOP curves, the scaling frontier, and the crossover points.
 *
 * The surface in `surface.ts` says what the loss is at any pair of capacity
 * and data. Everything a compute budget decides then follows, and it follows
 * in closed form rather than by search. Write the budget as
 *
 *     C = k · N · D      (k = 6 for a transformer's forward and backward pass)
 *
 * and minimise `E + A·N^(−α) + B·D^(−β)` subject to it. Differentiate along
 * the constraint and the stationary point is
 *
 *     N* = (αA / βB)^(1/(α+β)) · P^(β/(α+β))
 *     D* = P / N*
 *
 * where `P = C/k` is the product the budget pins down. Two facts fall out of
 * those two lines, and they are the two facts the papers of this course are
 * about.
 *
 * The first is the *IsoFLOP curve*: hold the budget, slide the allocation, and
 * the loss traces a U. The minimum of the U is the compute-optimal allocation,
 * and the arms of the U are what the naive allocations pay. Hoffmann et al.
 * found the minima by training a family of models along each budget — that is
 * the measurement this module reproduces analytically, and the analytic answer
 * is compared against the numeric search in `computeOptimum` by a test.
 *
 * The second is the *frontier*: the minima of the U's, traced across budgets,
 * themselves form a power law,
 *
 *     L*(C) = E + const · C^(−αβ/(α+β)),
 *
 * so the exponent of the compute-optimal loss law is a combination of the two
 * single-variable exponents and nothing else. That number is measured here
 * rather than quoted.
 *
 * The crossover points are Kaplan et al.'s question rather than Hoffmann's: at
 * a fixed budget, is a bigger model with less data better than a smaller model
 * with more data? Both losses are explicit, so the budget at which they are
 * equal is explicit too — and below it the small model wins and above it the
 * large one does.
 */

import { ols } from '@llm-materials/course-core'
import { surfaceLoss, type SurfaceFit } from './surface'

/** How much arithmetic one parameter costs for one sample. */
export const COST_PER_PARAMETER_TOKEN = 6

/** The compute a run costs, in the same units as the budget. */
export function computeOf(capacity: number, samples: number, costPerParameterToken = COST_PER_PARAMETER_TOKEN): number {
  return costPerParameterToken * capacity * samples
}

export interface Allocation {
  /** The capacity. */
  capacity: number
  /** The number of samples. */
  samples: number
  /** The loss the surface predicts there. */
  loss: number
  /** The samples per parameter. */
  tokensPerParameter: number
}

export interface AnalyticOptimum extends Allocation {
  /** The budget the optimum was taken at. */
  budget: number
  /** The product of capacity and samples the budget pins down. */
  product: number
  /** The capacity exponent: how fast the optimum's capacity grows with the budget. */
  capacityExponent: number
  /** The data exponent: how fast the optimum's sample count grows with the budget. */
  dataExponent: number
}

function requirePositiveTerms(fit: SurfaceFit, name: string): void {
  if (!(fit.alpha > 0 && fit.beta > 0)) throw new Error(`${name}: the surface's exponents are not positive`)
  if (!(fit.A > 0 && fit.B > 0)) throw new Error(`${name}: the surface has no capacity and data term to trade off`)
}

/**
 * The closed-form compute-optimal allocation.
 *
 * This is the minimum of the IsoFLOP curve, found by differentiating the
 * surface along the fixed-product constraint instead of searching for it. It
 * must agree with the numeric `computeOptimum`, and a test says that it does.
 */
export function analyticOptimum(
  fit: SurfaceFit,
  budget: number,
  options: { costPerParameterToken?: number } = {},
): AnalyticOptimum {
  requirePositiveTerms(fit, 'analyticOptimum')
  if (!(budget > 0)) throw new Error('analyticOptimum: the budget must be positive')
  const k = options.costPerParameterToken ?? COST_PER_PARAMETER_TOKEN
  const product = budget / k
  const sum = fit.alpha + fit.beta
  const capacity = ((fit.alpha * fit.A) / (fit.beta * fit.B)) ** (1 / sum) * product ** (fit.beta / sum)
  const samples = product / capacity
  return {
    capacity,
    samples,
    loss: surfaceLoss(fit, capacity, samples),
    tokensPerParameter: samples / capacity,
    budget,
    product,
    capacityExponent: fit.beta / sum,
    dataExponent: fit.alpha / sum,
  }
}

/**
 * How the two exponents split the budget.
 *
 * The optimum's capacity grows as `C^(β/(α+β))` and its data as `C^(α/(α+β))`,
 * and `sum` is the claim that the two add to one: the budget is a product, so
 * whatever fraction of the log-budget goes to capacity cannot also go to data.
 * Note the cross-over in the two exponents: the capacity is governed by the
 * *data* exponent and the other way round, which is why a hard-to-fit model
 * (small α) spends relatively more of an increase in budget on data.
 */
export function predictedAllocationExponents(fit: SurfaceFit): { capacity: number; samples: number; sum: number } {
  requirePositiveTerms(fit, 'predictedAllocationExponents')
  const total = fit.alpha + fit.beta
  const capacity = fit.beta / total
  const samples = fit.alpha / total
  return { capacity, samples, sum: capacity + samples }
}

/** The least-squares slope of a set of points in log–log space. */
export function logLogSlope(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length) throw new Error('logLogSlope: the lengths differ')
  if (xs.length < 2) throw new Error('logLogSlope: two points are needed')
  for (const value of [...xs, ...ys]) {
    if (!(value > 0)) throw new Error('logLogSlope: the values must be positive')
  }
  const fit = ols(xs.map((value) => [Math.log(value)]), ys.map((value) => Math.log(value)))
  return fit.coefficients[1] ?? 0
}

/**
 * The allocation exponent the closed form actually produces.
 *
 * The same number as `predictedAllocationExponents`, but measured: the optima
 * are computed at a set of budgets and the slope of the log–log line through
 * them is fitted. If the algebra and the arithmetic disagree, one of them is
 * wrong, and the test that compares them says which.
 */
export function measuredAllocationExponents(fit: SurfaceFit, budgets: number[]): { capacity: number; samples: number } {
  if (budgets.length < 3) throw new Error('measuredAllocationExponents: three budgets are needed')
  const optima = budgets.map((budget) => analyticOptimum(fit, budget))
  return {
    capacity: logLogSlope(budgets, optima.map((point) => point.capacity)),
    samples: logLogSlope(budgets, optima.map((point) => point.samples)),
  }
}

export interface IsoFlopPoint extends Allocation {
  /** The budget every point on the curve costs the same. */
  budget: number
  /** What this allocation pays over the best allocation at the same cost. */
  excess: number
}

/**
 * The IsoFLOP curve: the loss along a fixed compute budget.
 *
 * Every point costs the same — `k·N·D` is constant along the curve — so the
 * loss is the only thing that varies. Hoffmann et al. trained a whole family of
 * models along each curve to find its minimum; here the curve is the surface
 * read along the constraint, and the minimum is `analyticOptimum`.
 */
export function isoFLOPCurve(
  fit: SurfaceFit,
  budget: number,
  options: { costPerParameterToken?: number; points?: number } = {},
): IsoFlopPoint[] {
  const settings = { costPerParameterToken: COST_PER_PARAMETER_TOKEN, points: 96, ...options }
  const product = budget / settings.costPerParameterToken
  const optimum = analyticOptimum(fit, budget, settings)
  const from = Math.log(product / 1e6)
  const to = Math.log(product)
  const curve: IsoFlopPoint[] = []
  for (let i = 0; i <= settings.points; i++) {
    const capacity = Math.exp(from + ((to - from) * i) / settings.points)
    const samples = product / capacity
    const loss = surfaceLoss(fit, capacity, samples)
    curve.push({ capacity, samples, loss, tokensPerParameter: samples / capacity, budget, excess: loss - optimum.loss })
  }
  return curve
}

/** The minima of a family of IsoFLOP curves — the compute-optimal frontier. */
export interface FrontierPoint extends Allocation {
  budget: number
  /** The loss of the best allocation that ignores the budget's structure. */
  worstLoss: number
}

/**
 * The scaling frontier: the best allocation at each budget, and its loss.
 *
 * Traced across budgets, the minimum of each IsoFLOP curve is itself a power
 * law in the compute. The `worstLoss` column is the loss at the same cost with
 * the allocation taken to the extreme that the naive rule chooses, so the gap
 * between the two columns is the price of not optimising.
 */
export function frontier(fit: SurfaceFit, budgets: number[], options: { costPerParameterToken?: number } = {}): FrontierPoint[] {
  const k = options.costPerParameterToken ?? COST_PER_PARAMETER_TOKEN
  return budgets.map((budget) => {
    const optimum = analyticOptimum(fit, budget, options)
    const product = budget / k
    // The naive allocation this course argues against: all the budget spent on
    // capacity, with the single sample that keeps the product fixed.
    const allCapacity = surfaceLoss(fit, product, 1)
    return { ...optimum, budget, worstLoss: allCapacity }
  })
}

/** The exponent of the compute-optimal loss law, predicted from the surface. */
export function frontierExponent(fit: SurfaceFit): number {
  requirePositiveTerms(fit, 'frontierExponent')
  return (fit.alpha * fit.beta) / (fit.alpha + fit.beta)
}

/**
 * The IsoFLOP family, for the chart.
 *
 * Several curves at several budgets, each with its own minimum. The shape the
 * paper's figure has is: a nest of U's whose minima march down and to the
 * right, and a line through the minima — the frontier.
 */
export function isoFlopFamily(
  fit: SurfaceFit,
  budgets: number[],
  options: { costPerParameterToken?: number; points?: number } = {},
): { budget: number; optimum: AnalyticOptimum; curve: IsoFlopPoint[] }[] {
  return budgets.map((budget) => ({
    budget,
    optimum: analyticOptimum(fit, budget, options),
    curve: isoFLOPCurve(fit, budget, options),
  }))
}

/**
 * The data needed to reach the compute-optimal allocation at a budget.
 *
 * The question "what happens when the data runs out" starts here: the frontier
 * says how much data the optimum wants, and a corpus is a finite number. The
 * budget at which the demand reaches the corpus is computable, and beyond it
 * the optimum is not reachable with fresh data at all.
 */
export function budgetWhereDataRunsOut(fit: SurfaceFit, uniquePool: number): number {
  requirePositiveTerms(fit, 'budgetWhereDataRunsOut')
  if (!(uniquePool > 0)) throw new Error('budgetWhereDataRunsOut: the pool must be positive')
  const { samples: dataExponent } = predictedAllocationExponents(fit)
  // D* is proportional to P raised to the data exponent, so one call at a
  // product of one fixes the constant of proportionality and the pool inverts
  // the power to give the product whose optimum wants exactly `uniquePool`.
  const atOne = analyticOptimum(fit, COST_PER_PARAMETER_TOKEN)
  const product = (uniquePool / atOne.samples) ** (1 / dataExponent)
  return product * COST_PER_PARAMETER_TOKEN
}

export interface Crossover {
  /** The compute at which the two model sizes are equally good. */
  budget: number
  /** The smaller capacity. */
  small: number
  /** The larger capacity. */
  large: number
  /** The sample count each of the two has at the crossover, at the same cost. */
  samplesForSmall: number
  samplesForLarge: number
  /** The loss both give. */
  loss: number
  /** The sample count below which the larger model is the wrong choice. */
  dataThreshold: number
}

/**
 * The crossover point between two model sizes.
 *
 * Kaplan et al.'s observation is that a model's size is only worth paying for
 * once there is data enough to fill it. Fix the compute, give the two sizes
 * the sample counts that the same compute allows — `D = P/N` — and set the two
 * losses equal:
 *
 *     A(N1^(−α) − N2^(−α)) = B·P^(−β)·(N2^β − N1^β)
 *
 * so `P*^β = B(N2^β − N1^β) / (A(N1^(−α) − N2^(−α)))`. Below the crossover the
 * small model trained on more data wins; above it the large model trained on
 * less wins, and the `dataThreshold` is the sample count that tells a reader
 * which side of it they are on.
 */
export function crossoverBudget(fit: SurfaceFit, small: number, large: number): Crossover {
  requirePositiveTerms(fit, 'crossoverBudget')
  if (!(small > 0 && large > 0)) throw new Error('crossoverBudget: the capacities must be positive')
  if (!(large > small)) throw new Error('crossoverBudget: the second capacity must be the larger')
  const numerator = fit.B * (large ** fit.beta - small ** fit.beta)
  const denominator = fit.A * (small ** -fit.alpha - large ** -fit.alpha)
  const product = (numerator / denominator) ** (1 / fit.beta)
  const samplesForSmall = product / small
  const samplesForLarge = product / large
  return {
    budget: product * COST_PER_PARAMETER_TOKEN,
    small,
    large,
    samplesForSmall,
    samplesForLarge,
    loss: surfaceLoss(fit, small, samplesForSmall),
    dataThreshold: samplesForLarge,
  }
}

/** Which of the two sizes is better at a given budget. */
export function betterAt(fit: SurfaceFit, budget: number, small: number, large: number): {
  winner: number
  smallLoss: number
  largeLoss: number
  gap: number
} {
  const product = budget / COST_PER_PARAMETER_TOKEN
  const smallLoss = surfaceLoss(fit, small, product / small)
  const largeLoss = surfaceLoss(fit, large, product / large)
  return { winner: largeLoss < smallLoss ? large : small, smallLoss, largeLoss, gap: smallLoss - largeLoss }
}

/**
 * The crossover points of one reference size against every larger size.
 *
 * The table the lesson reads: a fixed small model, and for each larger model
 * the compute at which it starts to pay. The crossover grows with the gap in
 * size, which is the content of the "scaling laws say bigger models need more
 * data" sentence.
 */
export function crossoverSeries(fit: SurfaceFit, small: number, larges: number[]): (Crossover & { ratio: number })[] {
  return larges
    .filter((large) => large > small)
    .map((large) => ({ ...crossoverBudget(fit, small, large), ratio: large / small }))
}

/**
 * The tokens-per-parameter rule, rederived.
 *
 * The ratio of data to capacity at the optimum is
 *
 *     D over N = (βB / αA)^(2/(α+β)) · P^((α−β)/(α+β))
 *
 * which is a power of the budget whose exponent is `(α−β)/(α+β)`. That is the
 * whole reason the rule "twenty tokens per parameter" could look like a
 * constant: it is constant only when the two exponents are equal. Measure the
 * exponent on this surface and the rule's status is decided by arithmetic, not
 * by quotation.
 */
export function tokensPerParameterRule(fit: SurfaceFit, budgets: number[]): {
  exponent: number
  predicted: number
  ratioAt: { budget: number; tokensPerParameter: number }[]
} {
  if (budgets.length < 3) throw new Error('tokensPerParameterRule: three budgets are needed')
  const ratioAt = budgets.map((budget) => ({ budget, tokensPerParameter: analyticOptimum(fit, budget).tokensPerParameter }))
  return {
    exponent: logLogSlope(budgets, ratioAt.map((point) => point.tokensPerParameter)),
    predicted: (fit.alpha - fit.beta) / (fit.alpha + fit.beta),
    ratioAt,
  }
}

/**
 * Whether the optimum at a budget lies inside the region the surface was fitted
 * on.
 *
 * The fitted exponents only mean what the grid of runs says they mean, and the
 * closed form will happily report an optimum outside it. This is the check that
 * keeps a screen from quoting a number the measurement never reached.
 */
export function insideFittedRange(
  optimum: Allocation,
  range: { capacity: [number, number]; samples: [number, number] },
): { capacity: boolean; samples: boolean; extrapolates: boolean } {
  const capacity = optimum.capacity >= range.capacity[0] && optimum.capacity <= range.capacity[1]
  const samples = optimum.samples >= range.samples[0] && optimum.samples <= range.samples[1]
  return { capacity, samples, extrapolates: !(capacity && samples) }
}
