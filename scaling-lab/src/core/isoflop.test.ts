import { describe, expect, it } from 'vitest'
import { computeOptimum, fitSurface, surfaceLoss, type SurfaceFit, type SurfacePoint } from './surface'
import {
  analyticOptimum,
  betterAt,
  budgetWhereDataRunsOut,
  computeOf,
  COST_PER_PARAMETER_TOKEN,
  crossoverBudget,
  crossoverSeries,
  frontier,
  frontierExponent,
  insideFittedRange,
  isoFLOPCurve,
  isoFlopFamily,
  logLogSlope,
  measuredAllocationExponents,
  predictedAllocationExponents,
  tokensPerParameterRule,
} from './isoflop'

/** A surface with the same shape the laboratory fits from real runs. */
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

const BUDGETS = [1e4, 3e4, 1e5, 3e5, 1e6, 3e6, 1e7]

const relative = (a: number, b: number): number => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-12)

describe('the closed-form optimum', () => {
  it('is what the numeric search finds', () => {
    for (const budget of [1e5, 1e6, 1e8]) {
      const exact = analyticOptimum(fit, budget)
      const searched = computeOptimum(fit, budget)
      expect(relative(exact.loss, searched.loss)).toBeLessThan(1e-6)
      expect(relative(exact.capacity, searched.capacity)).toBeLessThan(1e-4)
      expect(relative(exact.samples, searched.samples)).toBeLessThan(1e-4)
    }
  })

  it('spends the budget it was given', () => {
    for (const budget of BUDGETS) {
      const optimum = analyticOptimum(fit, budget)
      expect(computeOf(optimum.capacity, optimum.samples)).toBeCloseTo(budget, 6)
      expect(optimum.samples * optimum.capacity).toBeCloseTo(budget / COST_PER_PARAMETER_TOKEN, 4)
    }
  })

  it('balances the two terms, which is what the stationary condition says', () => {
    const optimum = analyticOptimum(fit, 1e6)
    // At the minimum the marginal losses are equal: α·A·N^(−α) = β·B·D^(−β).
    const capacitySide = fit.alpha * fit.A * optimum.capacity ** -fit.alpha
    const dataSide = fit.beta * fit.B * optimum.samples ** -fit.beta
    expect(relative(capacitySide, dataSide)).toBeLessThan(1e-9)
  })

  it('is the best point on its own IsoFLOP curve', () => {
    const curve = isoFLOPCurve(fit, 1e6, { points: 400 })
    const best = curve.reduce((a, b) => (b.loss < a.loss ? b : a))
    const optimum = analyticOptimum(fit, 1e6)
    expect(optimum.loss).toBeLessThanOrEqual(best.loss + 1e-12)
    // The grid point nearest the optimum has almost nothing left to gain.
    const nearest = curve.reduce((a, b) => (Math.abs(b.capacity - optimum.capacity) < Math.abs(a.capacity - optimum.capacity) ? b : a))
    expect(nearest.excess).toBeLessThan(1e-4)
  })

  it('refuses a surface with nothing to trade off', () => {
    const flat: SurfaceFit = { E: 1, A: 0, alpha: 0.5, B: 1, beta: 0.5, r2: 1, points: 10, constrained: false }
    expect(() => analyticOptimum(flat, 1e6)).toThrow()
    expect(() => analyticOptimum(fit, 0)).toThrow()
  })
})

describe('the allocation exponents', () => {
  it('are predicted from the two surface exponents and sum to one', () => {
    const predicted = predictedAllocationExponents(fit)
    expect(predicted.sum).toBeCloseTo(1, 10)
    expect(predicted.capacity).toBeCloseTo(fit.beta / (fit.alpha + fit.beta), 10)
    expect(predicted.samples).toBeCloseTo(fit.alpha / (fit.alpha + fit.beta), 10)
  })

  it('are what the closed form actually produces', () => {
    const predicted = predictedAllocationExponents(fit)
    const measured = measuredAllocationExponents(fit, BUDGETS)
    expect(measured.capacity).toBeCloseTo(predicted.capacity, 6)
    expect(measured.samples).toBeCloseTo(predicted.samples, 6)
  })

  it('cross over: the capacity is governed by the data exponent', () => {
    // A surface whose data term is harder to fit (larger β) spends relatively
    // more of each increase in budget on capacity.
    const dataBound: SurfaceFit = { E: 0.1, A: 2, alpha: 0.3, B: 4, beta: 0.9, r2: 1, points: 10, constrained: false }
    const capacityBound: SurfaceFit = { E: 0.1, A: 2, alpha: 0.9, B: 4, beta: 0.3, r2: 1, points: 10, constrained: false }
    expect(predictedAllocationExponents(dataBound).capacity).toBeGreaterThan(
      predictedAllocationExponents(capacityBound).capacity,
    )
  })

  it('refuse too few budgets', () => {
    expect(() => measuredAllocationExponents(fit, [1e5, 1e6])).toThrow()
    expect(() => logLogSlope([1, 2], [1])).toThrow()
    expect(() => logLogSlope([1, -2], [1, 2])).toThrow()
  })
})

describe('the frontier', () => {
  it('falls as a power law whose exponent is the two exponents combined', () => {
    const points = frontier(fit, BUDGETS)
    const measured = logLogSlope(BUDGETS, points.map((point) => point.loss - fit.E))
    expect(measured).toBeCloseTo(-frontierExponent(fit), 6)
  })

  it('gets better with budget and never below the floor', () => {
    const points = frontier(fit, BUDGETS)
    for (let i = 1; i < points.length; i++) {
      expect(points[i]!.loss).toBeLessThan(points[i - 1]!.loss)
    }
    for (const point of points) {
      expect(point.loss).toBeGreaterThan(fit.E)
    }
  })

  it('beats the naive allocation at every budget', () => {
    for (const point of frontier(fit, BUDGETS)) {
      expect(point.loss).toBeLessThan(point.worstLoss)
      expect(point.worstLoss - point.loss).toBeGreaterThan(0)
    }
  })

  it('nests the IsoFLOP curves the family chart draws', () => {
    const family = isoFlopFamily(fit, [1e5, 1e6])
    expect(family.length).toBe(2)
    expect(family[1]!.optimum.loss).toBeLessThan(family[0]!.optimum.loss)
    expect(family[1]!.optimum.capacity).toBeGreaterThan(family[0]!.optimum.capacity)
    for (const row of family) {
      expect(row.curve.length).toBeGreaterThan(20)
      expect(Math.min(...row.curve.map((point) => point.loss))).toBeGreaterThanOrEqual(row.optimum.loss - 1e-12)
    }
  })
})

describe('the crossover points', () => {
  it('put the two sizes level at the crossover', () => {
    const cross = crossoverBudget(fit, 8, 32)
    const product = cross.budget / COST_PER_PARAMETER_TOKEN
    expect(surfaceLoss(fit, 8, product / 8)).toBeCloseTo(cross.loss, 12)
    expect(surfaceLoss(fit, 32, product / 32)).toBeCloseTo(cross.loss, 12)
  })

  it('hand the win to the small model below and the large one above', () => {
    const cross = crossoverBudget(fit, 8, 32)
    const below = betterAt(fit, cross.budget / 10, 8, 32)
    const above = betterAt(fit, cross.budget * 10, 8, 32)
    expect(below.winner).toBe(8)
    expect(above.winner).toBe(32)
    expect(below.gap).toBeLessThan(0)
    expect(above.gap).toBeGreaterThan(0)
  })

  it('grow with the size gap', () => {
    const series = crossoverSeries(fit, 8, [16, 32, 64, 128])
    expect(series.length).toBe(4)
    for (let i = 1; i < series.length; i++) {
      expect(series[i]!.budget).toBeGreaterThan(series[i - 1]!.budget)
    }
    // And the larger model always needs more data per parameter to pay for itself.
    for (const row of series) {
      expect(row.samplesForLarge).toBeGreaterThan(0)
      expect(row.dataThreshold).toBeCloseTo(row.budget / COST_PER_PARAMETER_TOKEN / row.large, 8)
    }
  })

  it('is between the two sizes it was asked about', () => {
    const cross = crossoverBudget(fit, 8, 32)
    expect(cross.samplesForSmall).toBeGreaterThan(cross.samplesForLarge)
  })

  it('refuses a pair that is not a pair', () => {
    expect(() => crossoverBudget(fit, 32, 8)).toThrow()
    expect(() => crossoverBudget(fit, 0, 8)).toThrow()
  })
})

describe('the tokens-per-parameter rule', () => {
  it('is a power of the budget whose exponent the surface predicts', () => {
    const rule = tokensPerParameterRule(fit, BUDGETS)
    expect(rule.exponent).toBeCloseTo(rule.predicted, 6)
    expect(rule.predicted).toBeCloseTo((fit.alpha - fit.beta) / (fit.alpha + fit.beta), 10)
  })

  it('is a constant only when the two exponents are equal', () => {
    const equal: SurfaceFit = { E: 0.1, A: 2, alpha: 0.5, B: 3, beta: 0.5, r2: 1, points: 10, constrained: false }
    const rule = tokensPerParameterRule(equal, [1e4, 1e6, 1e8])
    expect(rule.predicted).toBeCloseTo(0, 12)
    expect(rule.exponent).toBeCloseTo(0, 6)
    // Two surfaces that differ only in which exponent is larger move opposite ways.
    const dataHard: SurfaceFit = { E: 0.1, A: 2, alpha: 0.4, B: 3, beta: 0.8, r2: 1, points: 10, constrained: false }
    const capacityHard: SurfaceFit = { E: 0.1, A: 2, alpha: 0.8, B: 3, beta: 0.4, r2: 1, points: 10, constrained: false }
    expect(tokensPerParameterRule(dataHard, BUDGETS).exponent).toBeLessThan(0)
    expect(tokensPerParameterRule(capacityHard, BUDGETS).exponent).toBeGreaterThan(0)
  })

  it('changes when the budget changes, so the rule is a consequence not a setting', () => {
    const small = analyticOptimum(fit, 1e5)
    const large = analyticOptimum(fit, 1e8)
    const ratio = tokensPerParameterRule(fit, BUDGETS)
    if (ratio.predicted !== 0) {
      expect(large.tokensPerParameter).not.toBeCloseTo(small.tokensPerParameter, 3)
    }
  })
})

describe('the data pool as a limit', () => {
  it('says when the optimum’s demand for samples reaches the pool', () => {
    for (const pool of [500, 2000, 50000]) {
      const budget = budgetWhereDataRunsOut(fit, pool)
      const optimum = analyticOptimum(fit, budget)
      expect(relative(optimum.samples, pool)).toBeLessThan(1e-9)
    }
  })

  it('grows with the pool', () => {
    expect(budgetWhereDataRunsOut(fit, 5000)).toBeGreaterThan(budgetWhereDataRunsOut(fit, 500))
  })

  it('refuses a pool that is not there', () => {
    expect(() => budgetWhereDataRunsOut(fit, 0)).toThrow()
  })
})

describe('the range the surface was fitted on', () => {
  it('says when the optimum is an extrapolation', () => {
    const range = { capacity: [4, 64] as [number, number], samples: [100, 1600] as [number, number] }
    const inside = insideFittedRange(analyticOptimum(fit, 1e4), range)
    expect(inside.capacity).toBe(true)
    expect(inside.samples).toBe(true)
    expect(inside.extrapolates).toBe(false)

    const tooBig = insideFittedRange(analyticOptimum(fit, 1e12), range)
    expect(tooBig.capacity).toBe(false)
    expect(tooBig.extrapolates).toBe(true)

    const tooSmall = insideFittedRange(analyticOptimum(fit, 1e3), range)
    expect(tooSmall.capacity).toBe(false)
    expect(tooSmall.samples).toBe(false)
  })
})
