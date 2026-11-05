/**
 * Compute trends across three eras, and what a trend buys a loss.
 *
 * arXiv:2202.05924 (Sevilla, Heim, Ho, Besiroglu, Hobbhahn & Villalobos,
 * "Compute Trends Across Three Eras of Machine Learning") is a measurement
 * paper: it fits log-linear trends to the training compute of landmark models
 * and reports a slope and a doubling time for each era. Its three eras, with
 * the statistics it reports, are in `PAPER_ERAS` below — quoted, not computed,
 * and labelled as the quotation they are.
 *
 * What this module adds is the machinery to check those statistics against each
 * other and to connect them to the scaling laws in this app. Three things are
 * worth doing with them:
 *
 * 1. **The statistics are the same quantity in different units, and they
 *    disagree.** A slope of `s` orders of magnitude a year is a doubling every
 *    `log₁₀2 / s` years. The paper reports a slope, a doubling time *and* a
 *    compute range for each era, so there are three readings of one trend: from
 *    the slope, from the doubling time, and from the range divided by the years
 *    it covers. `monthsFromOomPerYear` converts the first two and `eraReadings`
 *    puts all three side by side. They agree closely for two of the three eras
 *    and not at all for the third, and the reason is a fact about trend lines
 *    rather than about this code: a fitted slope describes the middle of a
 *    scattered dataset, while a range is the distance between its two extremes.
 *    The tests carry the residuals so the reader can see which numbers are the
 *    paper's and which are the disagreement between them.
 *
 * 2. **A trend is a fit, and a break in it is a second fit.** The eras are not
 *    given by the data; they are placed by the analyst. `detectBreaks` fits a
 *    piecewise log-linear trend and chooses the split that minimises the sum of
 *    squared errors. A break is a change of *slope*, so a split only counts when
 *    its two sides disagree by `minSlopeChange`: without that rule, a series that
 *    is exactly one straight line offers a break at whichever year the rounding
 *    noise happens to favour. Run on a series with a break planted in it, the
 *    function recovers the planted year and both planted slopes; run on a single
 *    line, it reports null.
 *
 * 3. **Hardware and spend are different trends, and only one of them is
 *    controllable.** The paper's benchmark for the pre-deep-learning era is
 *    Moore's law — transistor density doubling roughly every two years, which
 *    it quotes as the reason that era's compute trend is what it is. A scaling
 *    law turns a compute trend into a loss trend: at the compute-optimal
 *    allocation the frontier falls as `C^(−γ)` with `γ = αβ/(α+β)`, so a given
 *    growth in compute buys a fixed, computable improvement in loss per year.
 *    `lossImpliedByTrend` does that arithmetic, and `budgetForTargetLoss` and
 *    `yearWhenFeasible` run the chain the other way, from a loss to the budget
 *    that buys it to the year a machine could have spent it.
 *
 * The last step needs a unit bridge. A scaling surface is fitted in whatever
 * units the laboratory's runs are counted in, and a hardware series is in
 * FLOP/s, so `flopsPerBudgetUnit` is the number that converts one to the other.
 * It defaults to 1, which says plainly that the two are the same scale — a
 * convenience for the fixture, never a physical fact to be quoted.
 *
 * The series this module analyses are synthetic — `hardwareSeries` and
 * `computeSeries` are fixtures with parameters, and the default parameters are
 * chosen to make the analysis interesting, not to reproduce a dataset. The
 * quoted values in `PAPER_ERAS` are the paper's, and nothing here claims to have
 * re-measured them.
 */

import { ols } from '@llm-materials/course-core'
import { analyticOptimum, COST_PER_PARAMETER_TOKEN, frontierExponent } from './isoflop'
import { surfaceLoss, type SurfaceFit } from './surface'

/** A year and the FLOPs of a training run, or of a machine per second. */
export interface TrendPoint {
  year: number
  /** The quantity being trended, in whatever unit the caller means. */
  value: number
}

/** One era of the paper's own reporting, quoted rather than measured here. */
export interface ReportedEra {
  era: string
  /** The first year of the fit. */
  from: number
  /** The last year of the fit. */
  to: number
  /** The paper's log-linear slope, in orders of magnitude per year. */
  oomPerYear: number
  /** The paper's doubling time, in months. */
  doublingMonths: number
  /** How many models the fit was made on. */
  runs: number
  /** The compute range of the models in the fit, in FLOPs. */
  range: [number, number]
}

/**
 * The paper's reported era statistics.
 *
 * These are quotations from arXiv:2202.05924 (its era table and the abstract's
 * ranges), kept here so the screen can print them beside the numbers this module
 * computes and the reader can see which is which. The large-scale era begins in
 * September 2015 in the paper, which is the reason its `from` is not a whole
 * year: the era boundary is a date, not a bin.
 */
export const PAPER_ERAS: ReportedEra[] = [
  {
    era: 'pre deep learning',
    from: 1952,
    to: 2010,
    oomPerYear: 0.2,
    doublingMonths: 21.3,
    runs: 19,
    range: [3e4, 2e14],
  },
  {
    era: 'deep learning',
    from: 2010,
    to: 2022,
    oomPerYear: 0.6,
    doublingMonths: 5.7,
    runs: 72,
    range: [7e14, 2e18],
  },
  {
    era: 'large-scale',
    from: 2015.7,
    to: 2022,
    oomPerYear: 0.4,
    doublingMonths: 9.9,
    runs: 16,
    range: [4e21, 8e23],
  },
]

/**
 * The doubling time the paper quotes for the pre-deep-learning era's benchmark:
 * transistor density, roughly every two years. Quoted, and only used as a rate.
 */
export const MOORE_DOUBLING_MONTHS = 24

/** The conversion the two reported statistics have to agree on. */
export function monthsFromOomPerYear(oomPerYear: number): number {
  if (!(oomPerYear > 0)) throw new Error('monthsFromOomPerYear: the slope must be positive')
  return (Math.log10(2) / oomPerYear) * 12
}

/** The other direction: a doubling time in months as a slope in OOMs a year. */
export function oomPerYearFromDoublingMonths(months: number): number {
  if (!(months > 0)) throw new Error('oomPerYearFromDoublingMonths: the doubling time must be positive')
  return Math.log10(2) / (months / 12)
}

/** A geometric series with a period, for the analysis to be tested against. */
export function geometricSeries(options: {
  fromYear?: number
  toYear?: number
  /** The value at the first year. */
  valueAtStart?: number
  /** The doubling period in months. */
  doublingMonths?: number
  /** Years per point. */
  step?: number
}): TrendPoint[] {
  const settings = { fromYear: 1960, toYear: 2022, valueAtStart: 1e3, doublingMonths: 20, step: 1, ...options }
  if (!(settings.doublingMonths > 0)) throw new Error('geometricSeries: the doubling period must be positive')
  const growthPerYear = Math.LN2 / (settings.doublingMonths / 12)
  const points: TrendPoint[] = []
  for (let year = settings.fromYear; year <= settings.toYear + 1e-9; year += settings.step) {
    points.push({ year, value: settings.valueAtStart * Math.exp(growthPerYear * (year - settings.fromYear)) })
  }
  return points
}

/**
 * The hardware fixture: one slope, then another.
 *
 * Two doubling periods and the year they change over. The break is planted, so
 * that `detectBreaks` has something known to find; the default periods are the
 * paper's Moore-adjacent benchmark before it and a slower accelerator trend
 * after. Nothing here is a measurement of any real machine.
 */
export function hardwareSeries(options: {
  fromYear?: number
  toYear?: number
  flopPerSecondAtStart?: number
  breakYear?: number
  beforeDoublingMonths?: number
  afterDoublingMonths?: number
} = {}): TrendPoint[] {
  const settings = {
    fromYear: 1960,
    toYear: 2022,
    flopPerSecondAtStart: 1e3,
    breakYear: 2004,
    beforeDoublingMonths: MOORE_DOUBLING_MONTHS - 4,
    afterDoublingMonths: 30,
    ...options,
  }
  const before = geometricSeries({
    fromYear: settings.fromYear,
    toYear: settings.breakYear,
    valueAtStart: settings.flopPerSecondAtStart,
    doublingMonths: settings.beforeDoublingMonths,
  })
  const startValue = before[before.length - 1]!.value
  const after = geometricSeries({
    fromYear: settings.breakYear,
    toYear: settings.toYear,
    valueAtStart: startValue,
    doublingMonths: settings.afterDoublingMonths,
  })
  return [...before, ...after.slice(1)]
}

/**
 * The compute fixture: landmark-model training runs, one era at a time.
 *
 * The points march geometrically from the era's quoted minimum to its quoted
 * maximum across its quoted years, so the fixture never leaves the range the
 * paper states. That choice makes the disagreement the interesting part: the
 * slope this series has is the range divided by the years, which is *not* the
 * slope the paper reports, because a range is the distance between two extreme
 * models and a slope is the middle of a scattered set. `eraReadings` is the
 * comparison.
 */
export function computeSeries(options: { era?: number; pointsPerEra?: number } = {}): (TrendPoint & ReportedEra)[] {
  const index = options.era ?? 1
  const perEra = options.pointsPerEra ?? 8
  const era = PAPER_ERAS[index]
  if (!era) throw new Error(`computeSeries: there is no era ${index} of ${PAPER_ERAS.length}`)
  if (!(perEra >= 2)) throw new Error('computeSeries: an era needs at least two points to trend')
  const years = era.to - era.from
  const growthPerYear = Math.log(era.range[1] / era.range[0]) / years
  const points: (TrendPoint & ReportedEra)[] = []
  for (let i = 0; i < perEra; i++) {
    const year = era.from + (years * i) / (perEra - 1)
    points.push({ ...era, year, value: era.range[0] * Math.exp(growthPerYear * (year - era.from)) })
  }
  return points
}

/**
 * The three readings of one era, set beside each other.
 *
 * `fromSlope` converts the paper's orders-of-magnitude figure, `fromDoubling`
 * converts its months figure, and `fromRange` divides the quoted compute range
 * by the quoted years. The first two are the same number twice and any gap
 * between them is the paper rounding two fits; the third is a different quantity
 * altogether and the gap there is the difference between a trend and an envelope.
 */
export function eraReadings(era: ReportedEra): {
  /** The range spanned, in orders of magnitude. */
  spanOom: number
  /** The years the era covers. */
  years: number
  /** The slope as the paper states it. */
  fromSlope: number
  /** The slope as the paper's doubling time implies it. */
  fromDoubling: number
  /** The slope the quoted range and years imply. */
  fromRange: number
  /** `fromRange` as a multiple of `fromSlope`. */
  rangeOverSlope: number
  /** The months per doubling that the quoted range and years imply. */
  monthsFromRange: number
} {
  const years = era.to - era.from
  if (!(years > 0)) throw new Error('eraReadings: the era covers no years')
  const spanOom = Math.log10(era.range[1] / era.range[0])
  const fromRange = spanOom / years
  return {
    spanOom,
    years,
    fromSlope: era.oomPerYear,
    fromDoubling: oomPerYearFromDoublingMonths(era.doublingMonths),
    fromRange,
    rangeOverSlope: fromRange / era.oomPerYear,
    monthsFromRange: monthsFromOomPerYear(fromRange),
  }
}

/** A log-linear trend: the slope in OOMs a year, and the doubling time. */
export interface TrendFit {
  /** Orders of magnitude of the value per year. */
  oomPerYear: number
  /** The natural-log slope per year, which is what the fit is made on. */
  slopePerYear: number
  /** The doubling period implied by the slope, in months. */
  doublingMonths: number
  /** The R² of the fit in log space. */
  r2: number
  /** The fitted value at the first year, and at the last. */
  start: number
  end: number
  points: number
  /** The residual sum of squares, in log space. */
  sse: number
}

/**
 * Fit a log-linear trend.
 *
 * The paper's headline statistics are exactly this: a slope in OOMs a year and a
 * doubling time in months. Both are read from the same regression, which is why
 * they must satisfy the conversion in `monthsFromOomPerYear` — and why the gap
 * between the paper's two reported numbers is a measurement of its own data.
 */
export function logLinearTrend(points: TrendPoint[]): TrendFit {
  if (points.length < 2) throw new Error('logLinearTrend: two points are needed')
  const years: number[] = []
  const logs: number[] = []
  for (const point of points) {
    if (!(point.value > 0)) throw new Error('logLinearTrend: the values must be positive')
    years.push(point.year)
    logs.push(Math.log(point.value))
  }
  const fit = ols(years.map((year) => [year]), logs)
  const slope = fit.coefficients[1] ?? 0
  const intercept = fit.coefficients[0] ?? 0
  const sse = fit.residuals.reduce((sum, value) => sum + value * value, 0)
  const first = years[0]!
  const last = years[years.length - 1]!
  return {
    oomPerYear: slope / Math.LN10,
    slopePerYear: slope,
    doublingMonths: slope === 0 ? Infinity : (Math.LN2 / slope) * 12,
    r2: fit.r2,
    start: Math.exp(intercept + slope * first),
    end: Math.exp(intercept + slope * last),
    points: years.length,
    sse,
  }
}

/** One breakpoint of a piecewise trend. */
export interface BreakFit {
  /** The year the trend changes in, taken from the points either side. */
  year: number
  before: TrendFit
  after: TrendFit
  /** The two pieces' residual sum of squares, plus the caller's penalty. */
  sse: number
  /** How much better than the single trend the split is, net of the penalty. */
  improvement: number
  /** The change in Bayesian information criterion the split earns. */
  bicDelta: number
}

/**
 * Where a trend changes slope.
 *
 * Every candidate year is tried, the two sides fitted separately, and the split
 * with the smallest residual sum of squares wins. `minPoints` keeps a segment
 * from being fitted on one or two points. `minSlopeChange` is the relative
 * difference the two sides' slopes have to show for a split to be a candidate at
 * all: a break is a change of slope, and without this rule a series that is
 * exactly one straight line still offers a "break" at whichever year the
 * floating-point noise prefers, because a split always removes a little of a
 * residual that is already nothing. `penalty` is multiplied by log n and added to
 * a split's residual sum of squares, so a caller can require a break to earn its
 * keep: at two log n it is the BIC price of the two extra parameters.
 *
 * On a series with a planted break this recovers the planted year and both
 * planted slopes. On a series that is a single log-linear line it reports null.
 */
export function detectBreaks(
  points: TrendPoint[],
  options: { minPoints?: number; penalty?: number; minSlopeChange?: number } = {},
): BreakFit | null {
  const minPoints = options.minPoints ?? 3
  const penalty = options.penalty ?? 0
  const minSlopeChange = options.minSlopeChange ?? 0.1
  if (minSlopeChange < 0) throw new Error('detectBreaks: the slope change cannot be negative')
  if (points.length < 2 * minPoints) return null
  const whole = logLinearTrend(points)
  // The ranking is on the raw sum of squares, so the holder keeps it beside the
  // candidate the caller is handed, whose own `sse` already includes the penalty.
  let best: { candidate: BreakFit; raw: number } | null = null
  for (let split = minPoints; split <= points.length - minPoints; split++) {
    const left = points.slice(0, split)
    const right = points.slice(split)
    const before = logLinearTrend(left)
    const after = logLinearTrend(right)
    const scale = Math.max(Math.abs(before.slopePerYear), Math.abs(after.slopePerYear))
    if (scale === 0) continue
    if (Math.abs(after.slopePerYear - before.slopePerYear) < minSlopeChange * scale) continue
    const raw = before.sse + after.sse
    const cost = penalty * Math.log(points.length)
    if (best === null || raw < best.raw) {
      best = {
        candidate: {
          year: (left[left.length - 1]!.year + right[0]!.year) / 2,
          before,
          after,
          sse: raw + cost,
          improvement: whole.sse - raw - cost,
          bicDelta: bic(whole.sse, points.length, 2) - bic(raw, points.length, 4),
        },
        raw,
      }
    }
  }
  if (best === null || best.candidate.improvement <= 0) return null
  return best.candidate
}

/**
 * The Bayesian information criterion of a log-linear fit.
 *
 * `parameters` is 2 for a single line and 4 for two, which is the price a break
 * has to pay before the extra flexibility it buys is worth taking. The residual
 * sum of squares is floored so that a series that is exactly a line — a
 * synthetic one, usually — gives a finite number instead of the log of zero.
 */
function bic(sse: number, observations: number, parameters: number): number {
  const floor = Math.max(sse, 1e-300)
  return observations * Math.log(floor / observations) + parameters * Math.log(observations)
}

/**
 * What a compute trend does to a loss.
 *
 * The frontier of the scaling surface falls as `C^(−γ)` with `γ = αβ/(α+β)`, so
 * a trend of `s` OOMs a year turns into a loss improvement of `10^(−γs)` a year:
 * a number per year that a laboratory can spend, and the only place in this app
 * where a hardware or a spend trend becomes a capability.
 */
export function lossImpliedByTrend(fit: SurfaceFit, oomPerYear: number): {
  gamma: number
  lossFactorPerYear: number
  yearsForTenTimesBetter: number
} {
  if (!(oomPerYear > 0)) throw new Error('lossImpliedByTrend: the trend must be positive')
  const gamma = frontierExponent(fit)
  const lossFactorPerYear = Math.pow(10, -gamma * oomPerYear)
  return { gamma, lossFactorPerYear, yearsForTenTimesBetter: Math.log10(10) / (gamma * oomPerYear) }
}

/**
 * The compute a target loss costs, at the optimal allocation.
 *
 * Inverting the frontier: with `L*(C) = E + K·C^(−γ)`, the budget that reaches a
 * loss `L` is `((L − E)/K)^(−1/γ)`. A loss at or below the noise floor `E` cannot
 * be bought at any price, and that is said rather than returned as a very large
 * number.
 *
 * The closed form is checked against a bisection on `analyticOptimum` in the
 * tests, so the two ways of reading the same surface have to agree.
 */
export function budgetForTargetLoss(
  fit: SurfaceFit,
  targetLoss: number,
  options: { costPerParameterToken?: number } = {},
): { budget: number; capacity: number; samples: number; gamma: number; coefficient: number } {
  const cost = options.costPerParameterToken ?? COST_PER_PARAMETER_TOKEN
  const gamma = frontierExponent(fit)
  const atOne = analyticOptimum(fit, 1, { costPerParameterToken: cost })
  // The excess loss at budget 1 *is* the frontier's coefficient: the optimum is
  // a pure power law in the budget, so a unit budget leaves the coefficient
  // behind with no residual scale factor to divide out.
  const coefficient = atOne.loss - fit.E
  if (!(coefficient > 0)) throw new Error('budgetForTargetLoss: the surface has no excess loss to buy against')
  if (!(targetLoss > fit.E)) {
    throw new Error('budgetForTargetLoss: the target loss is at or below the floor, so no budget reaches it')
  }
  const budget = Math.pow((targetLoss - fit.E) / coefficient, -1 / gamma)
  const optimum = analyticOptimum(fit, budget, { costPerParameterToken: cost })
  return { budget, capacity: optimum.capacity, samples: optimum.samples, gamma, coefficient }
}

/** Bisection on the frontier, to check the closed form above. */
export function budgetForTargetLossBySearch(
  fit: SurfaceFit,
  targetLoss: number,
  options: { iterations?: number } = {},
): number {
  const iterations = options.iterations ?? 200
  let low = 1
  let high = 1
  while (analyticOptimum(fit, high).loss > targetLoss && high < 1e30) high *= 10
  if (analyticOptimum(fit, high).loss > targetLoss) {
    throw new Error('budgetForTargetLossBySearch: the target loss is out of reach of the search range')
  }
  for (let i = 0; i < iterations; i++) {
    const middle = Math.sqrt(low * high)
    if (analyticOptimum(fit, middle).loss > targetLoss) low = middle
    else high = middle
  }
  return (low + high) / 2
}

/** FLOPs a machine can do in the wall-clock allowance of one run. */
export function runCompute(flopPerSecond: number, hours: number): number {
  if (!(flopPerSecond > 0)) throw new Error('runCompute: the capability must be positive')
  if (!(hours > 0)) throw new Error('runCompute: the wall-clock allowance must be positive')
  return flopPerSecond * hours * 3600
}

/** Read the capability series at a year, in log space between the points. */
export function capabilityAt(series: TrendPoint[], year: number): number {
  if (series.length === 0) throw new Error('capabilityAt: the series is empty')
  const first = series[0]!
  const last = series[series.length - 1]!
  if (year <= first.year) return first.value
  if (year >= last.year) {
    const previous = series[series.length - 2] ?? last
    const perYear = Math.log(last.value / previous.value) / (last.year - previous.year || 1)
    return last.value * Math.exp(perYear * (year - last.year))
  }
  for (let i = 1; i < series.length; i++) {
    const before = series[i - 1]!
    const after = series[i]!
    if (year <= after.year) {
      const weight = (year - before.year) / (after.year - before.year || 1)
      return Math.exp(Math.log(before.value) * (1 - weight) + Math.log(after.value) * weight)
    }
  }
  return last.value
}

/**
 * When a run becomes possible.
 *
 * The year at which the hardware series, multiplied by the wall-clock a training
 * run is allowed, first reaches the compute required. Interpolating between two
 * points of the series is a reading of the data; reaching outside it is a
 * projection, and `beyond` says which end had to be left: `'start'` means the run
 * was already possible when the series begins, `'end'` means it becomes possible
 * only after the series stops, and null means the answer is inside the measured
 * years. The difference between "in 2019" and "in 2031" is the difference between
 * a fact and a guess, so the guess is labelled as one.
 */
export function yearWhenFeasible(
  series: TrendPoint[],
  requiredCompute: number,
  options: { hours?: number } = {},
): {
  year: number
  /** True when the answer needed a projection outside the series' years. */
  extrapolated: boolean
  /** Which end of the series had to be left, if either. */
  beyond: 'start' | 'end' | null
  flopPerSecond: number
} {
  const hours = options.hours ?? 24 * 30
  if (!(requiredCompute > 0)) throw new Error('yearWhenFeasible: the required compute must be positive')
  const requiredRate = requiredCompute / (hours * 3600)
  const last = series[series.length - 1]
  if (!last) throw new Error('yearWhenFeasible: the series is empty')
  const first = series[0]!
  if (first.value >= requiredRate) {
    return { year: first.year, extrapolated: true, beyond: 'start', flopPerSecond: requiredRate }
  }
  for (let i = 1; i < series.length; i++) {
    const before = series[i - 1]!
    const after = series[i]!
    if (after.value >= requiredRate) {
      const weight =
        Math.log(requiredRate / before.value) / (Math.log(after.value) - Math.log(before.value) || 1)
      return {
        year: before.year + weight * (after.year - before.year),
        extrapolated: false,
        beyond: null,
        flopPerSecond: requiredRate,
      }
    }
  }
  const previous = series[series.length - 2] ?? last
  const perYear = Math.log(last.value / previous.value) / (last.year - previous.year || 1)
  if (!(perYear > 0)) throw new Error('yearWhenFeasible: the series never grows, so the run is never feasible')
  return {
    year: last.year + Math.log(requiredRate / last.value) / perYear,
    extrapolated: true,
    beyond: 'end',
    flopPerSecond: requiredRate,
  }
}

/** The whole chain, in one row: loss to budget to hardware to year. */
export function feasibilityOfTarget(
  fit: SurfaceFit,
  series: TrendPoint[],
  targetLoss: number,
  options: { hours?: number; costPerParameterToken?: number; flopsPerBudgetUnit?: number } = {},
): {
  targetLoss: number
  budget: number
  capacity: number
  samples: number
  /** The budget converted to the hardware series' units. */
  requiredCompute: number
  year: number
  extrapolated: boolean
  beyond: 'start' | 'end' | null
  flopPerSecond: number
} {
  const perUnit = options.flopsPerBudgetUnit ?? 1
  if (!(perUnit > 0)) throw new Error('feasibilityOfTarget: the unit bridge must be positive')
  const requirement = budgetForTargetLoss(fit, targetLoss, options)
  const feasible = yearWhenFeasible(series, requirement.budget * perUnit, { hours: options.hours })
  return {
    targetLoss,
    budget: requirement.budget,
    capacity: requirement.capacity,
    samples: requirement.samples,
    requiredCompute: requirement.budget * perUnit,
    year: feasible.year,
    extrapolated: feasible.extrapolated,
    beyond: feasible.beyond,
    flopPerSecond: feasible.flopPerSecond,
  }
}

/**
 * The loss the best allocation at a year's hardware can reach.
 *
 * The other direction along the same chain, and it uses the same
 * `flopsPerBudgetUnit` bridge, dividing the machine's FLOPs back into the units
 * the surface is measured in.
 */
export function lossReachableInYear(
  fit: SurfaceFit,
  series: TrendPoint[],
  year: number,
  options: { hours?: number; costPerParameterToken?: number; flopsPerBudgetUnit?: number } = {},
): { year: number; budget: number; loss: number; capacity: number; samples: number } {
  const perUnit = options.flopsPerBudgetUnit ?? 1
  if (!(perUnit > 0)) throw new Error('lossReachableInYear: the unit bridge must be positive')
  const rate = capabilityAt(series, year)
  const budget = runCompute(rate, options.hours ?? 24 * 30) / perUnit
  const optimum = analyticOptimum(fit, budget, { costPerParameterToken: options.costPerParameterToken })
  return { year, budget, loss: optimum.loss, capacity: optimum.capacity, samples: optimum.samples }
}

/** The surface's own loss at an allocation, exported so the screen can recompute a row. */
export function lossAtAllocation(fit: SurfaceFit, capacity: number, samples: number): number {
  return surfaceLoss(fit, capacity, samples)
}
