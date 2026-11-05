import { describe, expect, it } from 'vitest'
import {
  benjaminiHochberg,
  bootstrapCI,
  bonferroniThreshold,
  cohensD,
  meanCI95,
  ols,
  permutationTest,
  powerLawFit,
  requiredSampleSize,
  welchT,
} from '../src/stats.js'
import { createRng } from '../src/math.js'

describe('ols', () => {
  it('recovers known coefficients', () => {
    const xs = [0, 1, 2, 3, 4]
    const ys = xs.map((x) => 3 + 2 * x)
    const fit = ols(xs.map((x) => [x]), ys)
    expect(fit.coefficients[0]).toBeCloseTo(3, 8)
    expect(fit.coefficients[1]).toBeCloseTo(2, 8)
    expect(fit.r2).toBeCloseTo(1, 10)
  })

  it('fits multiple predictors', () => {
    const design = [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
    ]
    // y = 4 + 2·x₁ + 3·x₂
    const response = [6, 7, 9, 11, 12, 14]
    const fit = ols(design, response)
    expect(fit.coefficients[0]).toBeCloseTo(4, 8)
    expect(fit.coefficients[1]).toBeCloseTo(2, 8)
    expect(fit.coefficients[2]).toBeCloseTo(3, 8)
    expect(fit.r2).toBeCloseTo(1, 8)
  })

  it('reports residuals that sum to zero for an intercept model', () => {
    const xs = [1, 2, 3, 4, 5]
    const ys = [2.1, 3.9, 6.2, 7.8, 10.1]
    const fit = ols(xs.map((x) => [x]), ys)
    const total = fit.residuals.reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(0, 8)
  })

  it('rejects mismatched lengths', () => {
    expect(() => ols([[1]], [1, 2])).toThrow(/lengths differ/)
  })
})

describe('powerLawFit', () => {
  it('recovers a power law exponent', () => {
    const xs = [1, 2, 4, 8, 16]
    const ys = xs.map((x) => 3 * Math.pow(x, -1.7))
    const fit = powerLawFit(xs, ys)
    expect(fit.exponent).toBeCloseTo(-1.7, 6)
    expect(fit.coefficient).toBeCloseTo(3, 5)
    expect(fit.r2).toBeCloseTo(1, 8)
  })

  it('skips non-positive points', () => {
    const fit = powerLawFit([1, 0, 2], [1, 5, 4])
    expect(fit.n).toBe(2)
  })

  it('refuses fewer than two usable points', () => {
    expect(() => powerLawFit([1], [1])).toThrow(/at least two/)
  })
})

describe('bootstrapCI', () => {
  it('brackets the point estimate', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const ci = bootstrapCI(values, (s) => s.reduce((a, b) => a + b, 0) / s.length, 2000, 7)
    expect(ci.low).toBeLessThanOrEqual(ci.point)
    expect(ci.high).toBeGreaterThanOrEqual(ci.point)
    expect(ci.resamples).toBe(2000)
  })

  it('is reproducible for a given seed', () => {
    const values = [3, 1, 4, 1, 5, 9, 2, 6]
    const a = bootstrapCI(values, (s) => s.reduce((x, y) => x + y, 0) / s.length, 500, 11)
    const b = bootstrapCI(values, (s) => s.reduce((x, y) => x + y, 0) / s.length, 500, 11)
    expect(a).toEqual(b)
  })
})

describe('permutationTest', () => {
  it('finds no effect for identical groups', () => {
    const a = [10, 11, 9, 10, 12]
    const b = [10, 11, 9, 10, 12]
    const result = permutationTest(a, b, 2000, 3)
    expect(result.pValue).toBeGreaterThan(0.2)
  })

  it('finds a large effect for well-separated groups', () => {
    const a = [10, 11, 12, 13, 14]
    const b = [1, 2, 3, 4, 5]
    const result = permutationTest(a, b, 2000, 3)
    expect(result.pValue).toBeLessThan(0.05)
    expect(result.observedDifference).toBeCloseTo(9, 9)
  })
})

describe('effect sizes and intervals', () => {
  it('computes Welch t', () => {
    const t = welchT([1, 2, 3, 4], [5, 6, 7, 8])
    expect(t).toBeLessThan(0)
  })

  it('computes Cohen d', () => {
    const d = cohensD([5, 6, 7], [1, 2, 3])
    expect(d).toBeGreaterThan(1)
  })

  it('computes a mean confidence interval', () => {
    const ci = meanCI95([2, 4, 4, 4, 5, 5, 7, 9])
    expect(ci.low).toBeLessThan(ci.mean)
    expect(ci.high).toBeGreaterThan(ci.mean)
  })
})

describe('multiple comparisons', () => {
  it('applies the Bonferroni threshold', () => {
    expect(bonferroniThreshold(10)).toBeCloseTo(0.005, 12)
  })

  it('runs Benjamini–Hochberg', () => {
    const { rejected } = benjaminiHochberg([0.001, 0.008, 0.02, 0.4, 0.9])
    expect(rejected[0]).toBe(true)
    expect(rejected[1]).toBe(true)
    expect(rejected[4]).toBe(false)
  })
})

describe('requiredSampleSize', () => {
  it('scales with the effect size', () => {
    const big = requiredSampleSize(0.8)
    const small = requiredSampleSize(0.4)
    expect(small).toBeGreaterThan(big)
  })

  it('rejects a non-positive effect size', () => {
    expect(() => requiredSampleSize(0)).toThrow(RangeError)
  })
})

describe('determinism', () => {
  it('produces the same permutation p-value for the same seed', () => {
    const a = [1, 2, 3, 4, 5]
    const b = [2, 3, 4, 5, 6]
    const first = permutationTest(a, b, 1000, 77)
    const second = permutationTest(a, b, 1000, 77)
    expect(first.pValue).toBe(second.pValue)
  })

  it('uses a seeded stream for reproducibility', () => {
    const rng = createRng(5)
    const draws = Array.from({ length: 5 }, () => rng())
    const again = createRng(5)
    expect(draws).toEqual(Array.from({ length: 5 }, () => again()))
  })
})
