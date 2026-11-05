import { describe, expect, it } from 'vitest'
import {
  addVectors,
  clamp,
  correlation,
  createRng,
  crossEntropy,
  dot,
  entropy,
  erf,
  fmt,
  gaussian,
  identity,
  l2Distance,
  l2Norm,
  linspace,
  logSumExp,
  matmul,
  mean,
  normalCdf,
  normalPdf,
  normalQuantile,
  normalTwoSidedP,
  outer,
  round,
  sigmoid,
  softmax,
  softplus,
  stdDev,
  subtractVectors,
  transpose,
  variance,
} from '../src/math.js'

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = createRng(1)
    const b = createRng(2)
    expect(a()).not.toBe(b())
  })

  it('stays inside [0, 1)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 10000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('has a mean close to 0.5 and variance close to 1/12', () => {
    const rng = createRng(1234)
    const draws: number[] = []
    for (let i = 0; i < 200000; i++) draws.push(rng())
    expect(mean(draws)).toBeCloseTo(0.5, 2)
    expect(variance(draws)).toBeCloseTo(1 / 12, 3)
  })
})

describe('gaussian', () => {
  it('has the right mean and variance', () => {
    const rng = createRng(99)
    const draws: number[] = []
    for (let i = 0; i < 100000; i++) draws.push(gaussian(rng))
    expect(mean(draws)).toBeCloseTo(0, 1)
    expect(stdDev(draws)).toBeCloseTo(1, 1)
  })
})

describe('matrix operations', () => {
  it('multiplies correctly', () => {
    const a = [
      [1, 2],
      [3, 4],
    ]
    const b = [
      [5, 6],
      [7, 8],
    ]
    expect(matmul(a, b)).toEqual([
      [19, 22],
      [43, 50],
    ])
  })

  it('rejects incompatible shapes', () => {
    expect(() => matmul([[1, 2]], [[1, 2]])).toThrow(/incompatible shapes/)
  })

  it('treats an empty left operand as an empty product', () => {
    expect(matmul([], [[1]])).toEqual([])
  })

  it('transposes', () => {
    expect(
      transpose([
        [1, 2, 3],
        [4, 5, 6],
      ]),
    ).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ])
  })

  it('computes the outer product', () => {
    expect(outer([1, 2], [3, 4])).toEqual([
      [3, 4],
      [6, 8],
    ])
  })

  it('builds the identity', () => {
    expect(identity(3)).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ])
  })
})

describe('vector operations', () => {
  it('adds and subtracts', () => {
    expect(addVectors([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9])
    expect(subtractVectors([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3])
  })

  it('rejects length mismatches', () => {
    expect(() => addVectors([1], [1, 2])).toThrow(/length mismatch/)
    expect(() => dot([1], [1, 2])).toThrow(/length mismatch/)
  })

  it('computes norms and distances', () => {
    expect(l2Norm([3, 4])).toBe(5)
    expect(l2Distance([0, 0], [3, 4])).toBe(5)
  })
})

describe('softmax', () => {
  it('sums to one', () => {
    const p = softmax([1, 2, 3])
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
  })

  it('is invariant to a constant shift', () => {
    const a = softmax([1, 2, 3])
    const b = softmax([101, 102, 103])
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 12))
  })

  it('rejects a non-positive temperature', () => {
    expect(() => softmax([1, 2], 0)).toThrow(RangeError)
    expect(() => softmax([1, 2], -1)).toThrow(RangeError)
  })

  it('sharpens as temperature falls', () => {
    const hot = softmax([1, 2, 3], 2)
    const cold = softmax([1, 2, 3], 0.5)
    expect(cold[2]).toBeGreaterThan(hot[2])
  })

  it('handles an empty vector', () => {
    expect(softmax([])).toEqual([])
  })
})

describe('probability helpers', () => {
  it('computes logSumExp stably', () => {
    expect(logSumExp([0, 0, 0])).toBeCloseTo(Math.log(3), 12)
    expect(logSumExp([1000, 1000])).toBeCloseTo(1000 + Math.log(2), 9)
  })

  it('computes the logistic sigmoid symmetrically', () => {
    expect(sigmoid(0)).toBe(0.5)
    expect(sigmoid(10)).toBeCloseTo(0.9999546, 6)
    expect(sigmoid(-10)).toBeCloseTo(4.5398e-5, 9)
    expect(sigmoid(3) + sigmoid(-3)).toBeCloseTo(1, 12)
  })

  it('computes softplus', () => {
    expect(softplus(0)).toBeCloseTo(Math.log(2), 12)
    expect(softplus(100)).toBeCloseTo(100, 9)
  })

  it('computes the error function', () => {
    expect(erf(0)).toBeCloseTo(0, 9)
    expect(erf(1)).toBeCloseTo(0.8427008, 6)
    expect(erf(-1)).toBeCloseTo(-0.8427008, 6)
  })

  it('computes the normal CDF and PDF', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 9)
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 4)
    expect(normalPdf(0)).toBeCloseTo(0.3989423, 7)
  })

  it('inverts the normal CDF', () => {
    for (const p of [0.001, 0.025, 0.5, 0.975, 0.999]) {
      expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 8)
    }
  })

  it('computes a two-sided normal p-value', () => {
    expect(normalTwoSidedP(0)).toBeCloseTo(1, 12)
    expect(normalTwoSidedP(1.96)).toBeCloseTo(0.05, 3)
  })
})

describe('loss functions', () => {
  it('computes cross-entropy against a one-hot target', () => {
    const loss = crossEntropy([0, 1, 0], softmax([1, 2, 3]))
    const expected = -Math.log(softmax([1, 2, 3])[1])
    expect(loss).toBeCloseTo(expected, 12)
  })

  it('is zero for a perfect prediction', () => {
    expect(crossEntropy([1, 0], [1, 0])).toBeCloseTo(0, 12)
  })

  it('rejects mismatched lengths', () => {
    expect(() => crossEntropy([1], [1, 2])).toThrow(/length mismatch/)
  })

  it('computes entropy in nats', () => {
    expect(entropy([0.5, 0.5])).toBeCloseTo(Math.log(2), 12)
    expect(entropy([1])).toBeCloseTo(0, 12)
  })
})

describe('descriptive statistics', () => {
  it('computes mean, variance and standard deviation', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9]
    expect(mean(values)).toBe(5)
    expect(variance(values)).toBeCloseTo(32 / 7, 12)
    expect(stdDev(values)).toBeCloseTo(Math.sqrt(32 / 7), 12)
  })

  it('computes correlation', () => {
    expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12)
    expect(correlation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 12)
  })

  it('returns zero correlation for a constant vector', () => {
    expect(correlation([1, 1, 1], [1, 2, 3])).toBe(0)
  })
})

describe('helpers', () => {
  it('clips', () => {
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(-5, 0, 1)).toBe(0)
  })

  it('formats numbers consistently', () => {
    expect(fmt(0)).toBe('0')
    expect(fmt(1.23456)).toBe('1.235')
    expect(fmt(0.00001)).toBe('1.00e-5')
  })

  it('rounds without producing negative zero', () => {
    expect(Object.is(round(-0.0001, 2), -0)).toBe(false)
    expect(round(1.2345, 2)).toBe(1.23)
  })

  it('builds a linear space', () => {
    expect(linspace(3, 0, 1)).toEqual([0, 0.5, 1])
    expect(linspace(1, 5, 5)).toEqual([5])
    expect(linspace(0)).toEqual([])
  })
})
