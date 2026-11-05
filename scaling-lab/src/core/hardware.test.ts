import { describe, expect, it } from 'vitest'
import {
  capabilityAt,
  detectBreaks,
  eraReadings,
  feasibilityOfTarget,
  geometricSeries,
  hardwareSeries,
  computeSeries,
  lossImpliedByTrend,
  lossAtAllocation,
  lossReachableInYear,
  logLinearTrend,
  monthsFromOomPerYear,
  MOORE_DOUBLING_MONTHS,
  oomPerYearFromDoublingMonths,
  PAPER_ERAS,
  runCompute,
  yearWhenFeasible,
  budgetForTargetLoss,
  budgetForTargetLossBySearch,
} from './hardware'
import { fitSurface, surfaceLoss, type SurfacePoint } from './surface'
import { analyticOptimum, COST_PER_PARAMETER_TOKEN, computeOf, frontierExponent } from './isoflop'

/** The same ten runs the IsoFLOP laboratory fits its surface from. */
const POINTS: SurfacePoint[] = [
  { capacity: 4, samples: 100, loss: 1.4 },
  { capacity: 4, samples: 400, loss: 1.05 },
  { capacity: 8, samples: 100, loss: 0.95 },
  { capacity: 8, samples: 400, loss: 0.62 },
  { capacity: 16, samples: 100, loss: 0.7 },
  { capacity: 16, samples: 400, loss: 0.42 },
  { capacity: 32, samples: 100, loss: 0.55 },
  { capacity: 32, samples: 400, loss: 0.3 },
  { capacity: 64, samples: 400, loss: 0.25 },
  { capacity: 64, samples: 1600, loss: 0.18 },
]

const fit = fitSurface(POINTS)
/** The hardware fixture, with its break planted at 2004. */
const series = hardwareSeries()
const relative = (a: number, b: number): number => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-12)

describe('the era statistics the paper reports', () => {
  it('are three eras, each with a span and a range', () => {
    expect(PAPER_ERAS).toHaveLength(3)
    for (const era of PAPER_ERAS) {
      expect(era.to).toBeGreaterThan(era.from)
      expect(era.oomPerYear).toBeGreaterThan(0)
      expect(era.doublingMonths).toBeGreaterThan(0)
      expect(era.runs).toBeGreaterThan(1)
      expect(era.range[1]).toBeGreaterThan(era.range[0])
      expect(era.era.length).toBeGreaterThan(0)
    }
  })

  it('are quoted with the numbers the paper prints', () => {
    // A drift guard, not a measurement: if one of these fails, somebody has
    // edited the quotation and the screen is printing something the paper does
    // not say. The computed numbers elsewhere in this file are the measurements.
    expect(PAPER_ERAS.map((era) => era.oomPerYear)).toEqual([0.2, 0.6, 0.4])
    expect(PAPER_ERAS.map((era) => era.doublingMonths)).toEqual([21.3, 5.7, 9.9])
    expect(PAPER_ERAS.map((era) => era.runs)).toEqual([19, 72, 16])
    expect(PAPER_ERAS.map((era) => era.from)).toEqual([1952, 2010, 2015.7])
    expect(PAPER_ERAS.map((era) => era.to)).toEqual([2010, 2022, 2022])
    expect(PAPER_ERAS.map((era) => era.range)).toEqual([[3e4, 2e14], [7e14, 2e18], [4e21, 8e23]])
  })

  it('starts the large-scale era in the month, not the year', () => {
    // September 2015 is where the paper puts the boundary, and a 2015 or a 2016
    // would both be a rounding of a date that is not a whole year.
    expect(PAPER_ERAS[2]!.from).toBe(2015.7)
    expect(eraReadings(PAPER_ERAS[2]!).years).toBeCloseTo(6.3, 10)
  })
})

describe('the two statistics are one number in two units', () => {
  it('converts exactly both ways', () => {
    for (const months of [5.7, 9.9, 21.3, MOORE_DOUBLING_MONTHS, 100]) {
      expect(monthsFromOomPerYear(oomPerYearFromDoublingMonths(months))).toBeCloseTo(months, 10)
    }
    for (const s of [0.2, 0.6, 1, 3.5]) {
      expect(oomPerYearFromDoublingMonths(monthsFromOomPerYear(s))).toBeCloseTo(s, 10)
    }
  })

  it('puts one order of magnitude a year at 3.6 months to double', () => {
    // The identity the whole section rests on: log₁₀2 is 0.30103, so a series
    // that grows a decade a year doubles every 3.6 months, not every half year.
    expect(monthsFromOomPerYear(1)).toBeCloseTo(12 * Math.log10(2), 10)
    expect(monthsFromOomPerYear(Math.log10(2))).toBeCloseTo(12, 10)
    expect(oomPerYearFromDoublingMonths(monthsFromOomPerYear(1))).toBeCloseTo(1, 12)
  })

  it('refuses a slope or a period that is not a growth rate', () => {
    expect(() => monthsFromOomPerYear(0)).toThrow()
    expect(() => monthsFromOomPerYear(-1)).toThrow()
    expect(() => oomPerYearFromDoublingMonths(0)).toThrow()
    expect(() => oomPerYearFromDoublingMonths(Number.NaN)).toThrow()
  })

  it('measures how far apart the paper’s own two figures are', () => {
    // The residuals are the paper's, not this code's: both figures are quoted,
    // and the disagreement is what converting one into the other reveals. The
    // doubling times are the shorter readings in the first era and the third,
    // and the longer reading in the second.
    const percent = (era: (typeof PAPER_ERAS)[number]): number =>
      ((monthsFromOomPerYear(era.oomPerYear) - era.doublingMonths) / era.doublingMonths) * 100
    expect(percent(PAPER_ERAS[0]!)).toBeCloseTo(-15.2, 1)
    expect(percent(PAPER_ERAS[1]!)).toBeCloseTo(5.6, 1)
    expect(percent(PAPER_ERAS[2]!)).toBeCloseTo(-8.8, 1)
    // Every era disagrees by more than a twentieth of its doubling time.
    for (const era of PAPER_ERAS) {
      expect(Math.abs(percent(era))).toBeGreaterThan(4)
    }
  })
})

describe('the three readings of one era', () => {
  it('recovers the reported doubling time from the range, for two of the three eras', () => {
    // The paper's months figure for the pre-deep-learning and large-scale eras is
    // the range divided by the years, to a fiftieth of a month. It is not the
    // slope's: the two eras' slope figures imply 18.1 and 9.0 months.
    expect(eraReadings(PAPER_ERAS[0]!).monthsFromRange).toBeCloseTo(PAPER_ERAS[0]!.doublingMonths, 1)
    expect(eraReadings(PAPER_ERAS[2]!).monthsFromRange).toBeCloseTo(PAPER_ERAS[2]!.doublingMonths, 1)
    expect(monthsFromOomPerYear(PAPER_ERAS[0]!.oomPerYear)).not.toBeCloseTo(PAPER_ERAS[0]!.doublingMonths, 1)
    expect(monthsFromOomPerYear(PAPER_ERAS[2]!.oomPerYear)).not.toBeCloseTo(PAPER_ERAS[2]!.doublingMonths, 1)
  })

  it('finds the deep-learning era a different shape of disagreement', () => {
    // Here the range covers half the growth the slope claims over the same years,
    // because the era's two extreme runs are not the two ends of its trend line.
    const dl = eraReadings(PAPER_ERAS[1]!)
    expect(dl.spanOom).toBeCloseTo(3.456, 2)
    expect(dl.years).toBeCloseTo(12, 10)
    expect(dl.fromRange).toBeCloseTo(0.288, 3)
    expect(dl.rangeOverSlope).toBeCloseTo(0.48, 1)
    expect(dl.monthsFromRange).toBeCloseTo(12.54, 1)
    expect(dl.fromSlope).toBe(0.6)
  })

  it('agrees with the conversion for the other two eras', () => {
    expect(eraReadings(PAPER_ERAS[0]!).rangeOverSlope).toBeCloseTo(0.847, 2)
    expect(eraReadings(PAPER_ERAS[2]!).rangeOverSlope).toBeCloseTo(0.913, 2)
    for (const era of PAPER_ERAS) {
      const reading = eraReadings(era)
      expect(reading.fromDoubling).toBeCloseTo(oomPerYearFromDoublingMonths(era.doublingMonths), 12)
      expect(reading.rangeOverSlope).toBeCloseTo(reading.fromRange / reading.fromSlope, 12)
    }
  })

  it('refuses an era that covers no years', () => {
    expect(() => eraReadings({ ...PAPER_ERAS[0]!, to: PAPER_ERAS[0]!.from })).toThrow()
  })
})

describe('the compute fixture', () => {
  it('never leaves the range the paper quotes', () => {
    for (const era of PAPER_ERAS) {
      const sample = computeSeries({ era: PAPER_ERAS.indexOf(era), pointsPerEra: 9 })
      expect(sample[0]!.value / era.range[0]).toBeCloseTo(1, 12)
      expect(sample[sample.length - 1]!.value / era.range[1]).toBeCloseTo(1, 12)
      for (const point of sample) {
        expect(point.value).toBeGreaterThanOrEqual(era.range[0])
        expect(point.value).toBeLessThanOrEqual(era.range[1] * 1.0000001)
        expect(point.year).toBeGreaterThanOrEqual(era.from)
        expect(point.year).toBeLessThanOrEqual(era.to)
        expect(point.era).toBe(era.era)
      }
    }
  })

  it('is a straight line in log space, so its fitted slope is the range over the years', () => {
    // The fitted number equals the range-derived reading of the era and not the
    // quoted slope. That is the fixture doing its job: it shows that a range and
    // a trend are different statistics, and lets the screen print both.
    for (const index of [0, 1, 2]) {
      const trend = logLinearTrend(computeSeries({ era: index }))
      const reading = eraReadings(PAPER_ERAS[index]!)
      expect(relative(trend.oomPerYear, reading.fromRange)).toBeLessThan(1e-9)
      expect(trend.r2).toBeGreaterThan(0.999999)
      expect(trend.sse).toBeLessThan(1e-15)
      expect(trend.oomPerYear).not.toBeCloseTo(reading.fromSlope, 2)
    }
  })

  it('refuses an era that does not exist and a grid with no line in it', () => {
    expect(() => computeSeries({ era: 7 })).toThrow(/no era/)
    expect(() => computeSeries({ era: 3 })).toThrow(/no era/)
    expect(() => computeSeries({ pointsPerEra: 1 })).toThrow(/at least two points/)
  })
})

describe('the hardware fixture and its planted break', () => {
  it('is one point a year, with no repeated year', () => {
    expect(series[0]!.year).toBe(1960)
    expect(series[series.length - 1]!.year).toBe(2022)
    expect(series).toHaveLength(63)
    const years = new Set(series.map((point) => point.year))
    expect(years.size).toBe(series.length)
    for (const point of series) expect(point.value).toBeGreaterThan(0)
  })

  it('recovers the year the break was planted at', () => {
    const brk = detectBreaks(series)
    expect(brk).not.toBeNull()
    if (!brk) return
    expect(Math.abs(brk.year - 2004)).toBeLessThanOrEqual(1)
    expect(brk.year).toBe(2004.5)
  })

  it('recovers both planted slopes', () => {
    const brk = detectBreaks(series)!
    expect(brk.before.doublingMonths).toBeCloseTo(20, 2)
    expect(brk.after.doublingMonths).toBeCloseTo(30, 2)
    expect(brk.before.oomPerYear).toBeGreaterThan(brk.after.oomPerYear)
    expect(brk.improvement).toBeGreaterThan(1)
    expect(brk.bicDelta).toBeGreaterThan(20)
    expect(brk.sse).toBeLessThan(logLinearTrend(series).sse)
  })

  it('hides the break from a fit that never looks for one', () => {
    // The single trend through the broken series has R² 0.995 and a doubling time
    // of 21.5 months: it is a good fit to the data and the wrong model, and the
    // number it reports is neither of the two slopes that generated the series.
    const whole = logLinearTrend(series)
    expect(whole.r2).toBeGreaterThan(0.99)
    expect(whole.doublingMonths).toBeGreaterThan(20)
    expect(whole.doublingMonths).toBeLessThan(30)
    expect(Math.abs(whole.doublingMonths - 20)).toBeGreaterThan(1)
    expect(Math.abs(whole.doublingMonths - 30)).toBeGreaterThan(1)
  })

  it('refuses a break in a series that is one straight line', () => {
    const single = geometricSeries({ fromYear: 1960, toYear: 2022, doublingMonths: 20 })
    expect(logLinearTrend(single).sse).toBeLessThan(1e-15)
    expect(detectBreaks(single)).toBeNull()
  })

  it('asks how big a change of slope a break has to be', () => {
    // The planted 20 → 30 month change is a third of the slope: a bar of 0.5
    // refuses to call it a break, a bar of 0.33 still finds it.
    expect(detectBreaks(series, { minSlopeChange: 0.5 })).toBeNull()
    expect(detectBreaks(series, { minSlopeChange: 0.33 })!.year).toBe(2004.5)
    expect(detectBreaks(series, { minSlopeChange: 0 })).not.toBeNull()
    expect(() => detectBreaks(series, { minSlopeChange: -1 })).toThrow()
  })

  it('finds nothing when the two halves have the same slope', () => {
    expect(detectBreaks(hardwareSeries({ afterDoublingMonths: 20 }))).toBeNull()
  })

  it('reports nothing rather than an unreliable split on a short series', () => {
    expect(detectBreaks(series.slice(0, 5))).toBeNull()
    // Six points are enough when three of them sit on each side of the break.
    const window = series.filter((point) => point.year >= 2002 && point.year <= 2007)
    expect(window).toHaveLength(6)
    const brk = detectBreaks(window, { minPoints: 3 })
    expect(brk).not.toBeNull()
    expect(brk!.year).toBe(2004.5)
    // The same six points on one side of the break have no break to find.
    expect(detectBreaks(series.filter((point) => point.year >= 1990 && point.year <= 1995))).toBeNull()
  })

  it('prices a split with the penalty the caller asks for', () => {
    const free = detectBreaks(series, { penalty: 0 })!
    const priced = detectBreaks(series, { penalty: 2 })!
    // A constant added to every candidate cannot change which one wins, so the
    // penalty moves the reported sum of squares by exactly its own size and
    // leaves the BIC verdict — which has a principled price already — alone.
    expect(priced.year).toBe(free.year)
    expect(priced.sse - free.sse).toBeCloseTo(2 * Math.log(series.length), 9)
    expect(priced.bicDelta).toBeCloseTo(free.bicDelta, 9)
    expect(priced.improvement).toBeLessThan(free.improvement)
    // A penalty so large that no split can pay for itself is answered with null.
    expect(detectBreaks(series, { penalty: 1e3 })).toBeNull()
  })

  it('is the slope rule that protects a straight line, not the broken one', () => {
    // On the broken series the minimum-SSE split is the planted break: one split
    // can put each era on its own side, and anything else leaves a straight piece
    // spanning the change. On a series that is one line, every split fits equally
    // well and the winner is decided by rounding, which the rule refuses to call
    // a break. The two cases are why a break needs a definition beyond "better".
    expect(detectBreaks(series, { minSlopeChange: 0 })!.year).toBe(2004.5)
    const noise = detectBreaks(geometricSeries({ fromYear: 1960, toYear: 2022, doublingMonths: 20 }), {
      minSlopeChange: 0,
    })!
    expect(noise.year).not.toBe(2004.5)
    expect(noise.improvement).toBeLessThan(1e-15)
    expect(noise.before.oomPerYear).toBeCloseTo(noise.after.oomPerYear, 9)
    expect(noise.bicDelta).toBeGreaterThan(0)
    // BIC does not reject it either: on noiseless data the log of a residual that
    // is nothing but rounding rewards any split at all, which is the honest limit
    // of the penalty knob.
  })

  it('refuses a geometric series with no growth in it', () => {
    expect(() => geometricSeries({ doublingMonths: 0 })).toThrow()
  })
})

describe('the log-linear trend', () => {
  it('reads the slope back off a series built from a slope', () => {
    for (const months of [6, 20, 40]) {
      const trend = logLinearTrend(geometricSeries({ doublingMonths: months, valueAtStart: 7, fromYear: 1990, toYear: 2010 }))
      expect(trend.doublingMonths).toBeCloseTo(months, 6)
      expect(trend.oomPerYear).toBeCloseTo(oomPerYearFromDoublingMonths(months), 9)
      expect(trend.start).toBeCloseTo(7, 8)
      expect(trend.end / (7 * 2 ** (240 / months))).toBeCloseTo(1, 9)
      expect(trend.points).toBe(21)
      expect(trend.r2).toBeGreaterThan(0.999999)
    }
  })

  it('is the same statistic in two units, by construction', () => {
    const trend = logLinearTrend(geometricSeries({ doublingMonths: 20 }))
    expect(trend.doublingMonths).toBeCloseTo(monthsFromOomPerYear(trend.oomPerYear), 10)
    expect(trend.slopePerYear).toBeCloseTo(trend.oomPerYear * Math.LN10, 12)
  })

  it('says so when there is no line to fit', () => {
    expect(() => logLinearTrend([{ year: 2000, value: 1 }])).toThrow(/two points/)
    expect(() => logLinearTrend([{ year: 2000, value: 1 }, { year: 2001, value: 0 }])).toThrow(/positive/)
  })

  it('reports an infinite doubling time for a series that does not grow', () => {
    const flat = logLinearTrend([{ year: 2000, value: 5 }, { year: 2005, value: 5 }, { year: 2010, value: 5 }])
    expect(flat.oomPerYear).toBeCloseTo(0, 12)
    expect(flat.doublingMonths).toBe(Infinity)
    expect(flat.sse).toBeCloseTo(0, 12)
  })
})

describe('what a compute trend does to a loss', () => {
  const gamma = frontierExponent(fit)

  it('uses the frontier exponent and nothing else', () => {
    expect(gamma).toBeCloseTo((fit.alpha * fit.beta) / (fit.alpha + fit.beta), 12)
    for (const slope of [0.2, 0.6, 1.5]) {
      const implied = lossImpliedByTrend(fit, slope)
      expect(implied.gamma).toBe(gamma)
      expect(implied.lossFactorPerYear).toBeCloseTo(Math.pow(10, -gamma * slope), 12)
      expect(implied.yearsForTenTimesBetter).toBeCloseTo(1 / (gamma * slope), 12)
    }
  })

  it('multiplies out to the tenfold it promises', () => {
    for (const slope of [0.2, 0.6, 1.5]) {
      const implied = lossImpliedByTrend(fit, slope)
      expect(implied.lossFactorPerYear ** implied.yearsForTenTimesBetter).toBeCloseTo(0.1, 10)
    }
  })

  it('reports the three rates the screen prints', () => {
    // 0.6 OOMs a year is the paper's deep-learning slope; 0.288 is what its
    // quoted range implies; Moore's two years is 0.1505.
    expect(lossImpliedByTrend(fit, 0.6).yearsForTenTimesBetter).toBeCloseTo(3.058, 3)
    expect(lossImpliedByTrend(fit, eraReadings(PAPER_ERAS[1]!).fromRange).yearsForTenTimesBetter).toBeCloseTo(6.371, 3)
    expect(lossImpliedByTrend(fit, oomPerYearFromDoublingMonths(MOORE_DOUBLING_MONTHS)).yearsForTenTimesBetter).toBeCloseTo(12.19, 2)
  })

  it('buys more the faster the trend, and never a factor above one', () => {
    const rates = [0.1, 0.2, 0.6, 1.5].map((slope) => lossImpliedByTrend(fit, slope))
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]!.lossFactorPerYear).toBeLessThan(rates[i - 1]!.lossFactorPerYear)
      expect(rates[i]!.yearsForTenTimesBetter).toBeLessThan(rates[i - 1]!.yearsForTenTimesBetter)
    }
    for (const rate of rates) {
      expect(rate.lossFactorPerYear).toBeGreaterThan(0)
      expect(rate.lossFactorPerYear).toBeLessThan(1)
    }
  })

  it('refuses a trend that is not growth', () => {
    expect(() => lossImpliedByTrend(fit, 0)).toThrow()
    expect(() => lossImpliedByTrend(fit, -0.6)).toThrow()
  })
})

describe('the budget a target loss costs', () => {
  it('inverts the frontier exactly', () => {
    for (const target of [0.5, 0.35, 0.25, 0.15]) {
      const requirement = budgetForTargetLoss(fit, target)
      expect(analyticOptimum(fit, requirement.budget).loss).toBeCloseTo(target, 9)
      expect(relative(requirement.budget, budgetForTargetLossBySearch(fit, target))).toBeLessThan(1e-10)
      expect(requirement.gamma).toBe(frontierExponent(fit))
      expect(requirement.capacity).toBeGreaterThan(0)
      expect(requirement.samples).toBeGreaterThan(0)
      expect(computeOf(requirement.capacity, requirement.samples)).toBeCloseTo(requirement.budget, 6)
    }
  })

  it('is a pure power law in the budget, with no scale factor left over', () => {
    // The coefficient is the excess loss at a budget of one, which is all the
    // closed form needs: the optimum is homogeneous in the budget, so a unit
    // budget leaves the coefficient behind unchanged.
    const coefficient = budgetForTargetLoss(fit, 0.25).coefficient
    expect(coefficient).toBeCloseTo(analyticOptimum(fit, 1).loss - fit.E, 10)
    for (const budget of [1, 1e3, 1e6, 1e9]) {
      const excess = analyticOptimum(fit, budget).loss - fit.E
      expect(relative(excess, coefficient * budget ** -frontierExponent(fit))).toBeLessThan(1e-9)
    }
  })

  it('costs more the lower the target', () => {
    const budgets = [0.6, 0.45, 0.3, 0.2, 0.13].map((target) => budgetForTargetLoss(fit, target).budget)
    for (let i = 1; i < budgets.length; i++) {
      expect(budgets[i]!).toBeGreaterThan(budgets[i - 1]!)
    }
    expect(budgets[budgets.length - 1]! / budgets[0]!).toBeGreaterThan(10)
  })

  it('says so when the target is the noise floor', () => {
    expect(() => budgetForTargetLoss(fit, fit.E)).toThrow(/no budget reaches it/)
    expect(() => budgetForTargetLoss(fit, fit.E - 0.1)).toThrow(/no budget reaches it/)
    // Just above the floor is not an error; it is a very large number. The floor
    // of this surface is 0.10736, and a target a ten-thousandth above it costs
    // five orders of magnitude more than the 0.25 the screen starts from.
    expect(budgetForTargetLoss(fit, fit.E + 1e-4).budget).toBeGreaterThan(1e10)
    expect(budgetForTargetLoss(fit, fit.E + 1e-4).budget / budgetForTargetLoss(fit, 0.25).budget).toBeGreaterThan(1e4)
  })

  it('bridges the cost per parameter-token both ways', () => {
    for (const cost of [COST_PER_PARAMETER_TOKEN, 8]) {
      const requirement = budgetForTargetLoss(fit, 0.25, { costPerParameterToken: cost })
      const optimum = analyticOptimum(fit, requirement.budget, { costPerParameterToken: cost })
      expect(optimum.loss).toBeCloseTo(0.25, 9)
      expect(optimum.capacity * optimum.samples).toBeCloseTo(requirement.budget / cost, 6)
    }
    // The same loss costs more when a parameter-token costs more.
    expect(budgetForTargetLoss(fit, 0.25, { costPerParameterToken: 8 }).budget).toBeGreaterThan(
      budgetForTargetLoss(fit, 0.25).budget,
    )
  })

  it('stops the search when the target is out of its range', () => {
    expect(() => budgetForTargetLossBySearch(fit, fit.E)).toThrow(/out of reach/)
  })
})

describe('from a machine to a year', () => {
  it('turns a rate and a wall-clock into the compute of a run', () => {
    expect(runCompute(1e15, 1)).toBe(3.6e18)
    expect(runCompute(1e3, 24 * 30)).toBeCloseTo(2.592e9, -3)
    expect(() => runCompute(0, 10)).toThrow()
    expect(() => runCompute(1e9, 0)).toThrow()
  })

  it('reads the series exactly at its own points', () => {
    for (const point of [series[0]!, series[30]!, series[series.length - 1]!]) {
      expect(capabilityAt(series, point.year)).toBeCloseTo(point.value, 1)
    }
    expect(capabilityAt(series, 1955)).toBe(series[0]!.value)
  })

  it('interpolates in log space, which is where a hardware series is straight', () => {
    const low = series[40]!
    const high = series[41]!
    const middle = capabilityAt(series, (low.year + high.year) / 2)
    expect(middle).toBeCloseTo(Math.sqrt(low.value * high.value), 1)
    expect(Math.log(middle / low.value)).toBeCloseTo(Math.log(high.value / middle), 6)
  })

  it('extrapolates after the last point along the last segment', () => {
    const last = series[series.length - 1]!
    const previous = series[series.length - 2]!
    const perYear = Math.log(last.value / previous.value) / (last.year - previous.year)
    expect(capabilityAt(series, last.year + 5)).toBeCloseTo(last.value * Math.exp(perYear * 5), 1)
    // The fixture slows down at the break, so a projection is slower than the
    // early era's slope would have suggested.
    expect(perYear).toBeLessThan(Math.LN2 / ((MOORE_DOUBLING_MONTHS - 4) / 12))
  })

  it('refuses an empty series', () => {
    expect(() => capabilityAt([], 2000)).toThrow()
  })

  it('finds the year inside the series without calling it a projection', () => {
    const target = capabilityAt(series, 2008)
    const found = yearWhenFeasible(series, runCompute(target, 24 * 30), { hours: 24 * 30 })
    expect(found.year).toBeCloseTo(2008, 6)
    expect(found.beyond).toBeNull()
    expect(found.extrapolated).toBe(false)
  })

  it('labels the two ends when it has to leave them', () => {
    const before = yearWhenFeasible(series, runCompute(1e2, 1), { hours: 1 })
    expect(before.beyond).toBe('start')
    expect(before.year).toBe(series[0]!.year)
    expect(before.extrapolated).toBe(true)
    const after = yearWhenFeasible(series, runCompute(1e24, 1), { hours: 1 })
    expect(after.beyond).toBe('end')
    expect(after.year).toBeGreaterThan(series[series.length - 1]!.year)
    expect(() => yearWhenFeasible(series, 0)).toThrow()
    expect(() => yearWhenFeasible([], 1e9)).toThrow()
  })

  it('moves the year with the wall-clock allowance', () => {
    const month = yearWhenFeasible(series, 1e18, { hours: 24 * 30 })
    const day = yearWhenFeasible(series, 1e18, { hours: 1 })
    expect(day.year).toBeGreaterThan(month.year)
    // 720 hours is a month of seconds, so the same run needs 720 times the rate
    // in a day and the series grows by log10(2) per 20 months by 1995.
    expect(month.year).toBeLessThan(2015)
    expect(day.extrapolated).toBe(true)
  })

  it('runs the whole chain both ways', () => {
    const perUnit = 1e12
    for (const target of [0.5, 0.25, 0.15]) {
      const row = feasibilityOfTarget(fit, series, target, { hours: 24 * 30, flopsPerBudgetUnit: perUnit })
      expect(row.requiredCompute).toBeCloseTo(row.budget * perUnit, 4)
      expect(row.beyond).toBeNull()
      // The year it reports, the hardware of that year can spend the budget.
      const rate = capabilityAt(series, row.year)
      expect(runCompute(rate, 24 * 30) / perUnit).toBeCloseTo(row.budget, -4)
      const reachable = lossReachableInYear(fit, series, row.year, { hours: 24 * 30, flopsPerBudgetUnit: perUnit })
      expect(reachable.loss).toBeCloseTo(target, 3)
    }
  })

  it('improves the loss as the years go by, and never the other way', () => {
    const losses = [1965, 1980, 1995, 2010, 2022].map(
      (year) => lossReachableInYear(fit, series, year, { flopsPerBudgetUnit: 1e15 }).loss,
    )
    for (let i = 1; i < losses.length; i++) {
      expect(losses[i]!).toBeLessThan(losses[i - 1]!)
    }
    expect(losses[0]!).toBeGreaterThan(1000)
    expect(losses[losses.length - 1]!).toBeLessThan(1)
  })

  it('reads the same surface the IsoFLOP screen reads', () => {
    const reachable = lossReachableInYear(fit, series, 2010, { flopsPerBudgetUnit: 1e15 })
    expect(reachable.loss).toBe(surfaceLoss(fit, reachable.capacity, reachable.samples))
    expect(reachable.loss).toBe(lossAtAllocation(fit, reachable.capacity, reachable.samples))
    expect(computeOf(reachable.capacity, reachable.samples)).toBeCloseTo(reachable.budget, -5)
  })

  it('refuses a unit bridge that is not a bridge', () => {
    expect(() => feasibilityOfTarget(fit, series, 0.25, { flopsPerBudgetUnit: 0 })).toThrow(/unit bridge/)
    expect(() => lossReachableInYear(fit, series, 2010, { flopsPerBudgetUnit: -1 })).toThrow(/unit bridge/)
  })
})
