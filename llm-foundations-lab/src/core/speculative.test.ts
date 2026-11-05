import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SPECULATIVE,
  TOY_VOCAB,
  acceptanceRate,
  bestDraftLength,
  draftDistribution,
  expectedTokens,
  iterationCost,
  residualDistribution,
  speculativeReport,
  speedup,
  targetDistribution,
  totalVariation,
} from './speculative'

const P = [0.5, 0.5]
const Q = [0.25, 0.75]

describe('the two distributions', () => {
  it('covers the toy vocabulary with normalised distributions', () => {
    const target = targetDistribution(DEFAULT_SPECULATIVE)
    const draft = draftDistribution(DEFAULT_SPECULATIVE)
    expect(target).toHaveLength(TOY_VOCAB.length)
    expect(draft).toHaveLength(TOY_VOCAB.length)
    expect(target.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12)
    expect(draft.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12)
  })

  it('keeps the draft pointed at the same peak as the target by default', () => {
    const target = targetDistribution(DEFAULT_SPECULATIVE)
    const draft = draftDistribution(DEFAULT_SPECULATIVE)
    expect(draft.indexOf(Math.max(...draft))).toBe(target.indexOf(Math.max(...target)))
  })

  it('makes the draft identical to the target only when the perturbation vanishes and the temperature matches', () => {
    const setup = { ...DEFAULT_SPECULATIVE, draftNoise: 0, draftTemp: 1 }
    const target = targetDistribution(setup)
    const draft = draftDistribution(setup)
    for (let index = 0; index < target.length; index += 1) {
      expect(draft[index]).toBeCloseTo(target[index], 12)
    }
  })
})

describe('acceptance, computable by hand', () => {
  it('is one when the distributions agree and zero when they do not overlap', () => {
    expect(acceptanceRate(P, P)).toBeCloseTo(1, 12)
    expect(acceptanceRate([0.5, 0.5, 0], [0, 0, 1])).toBeCloseTo(0, 12)
  })

  it('equals the sum of the elementwise minima, and one minus total variation', () => {
    // min(0.5, 0.25) + min(0.5, 0.75) = 0.25 + 0.5 = 0.75
    expect(acceptanceRate(P, Q)).toBeCloseTo(0.75, 12)
    expect(totalVariation(P, Q)).toBeCloseTo(0.25, 12)
    expect(acceptanceRate(P, Q) + totalVariation(P, Q)).toBeCloseTo(1, 12)
  })

  it('never exceeds one and never falls below zero across the setup range', () => {
    for (const setup of [
      { ...DEFAULT_SPECULATIVE, targetTemp: 0.5 },
      { ...DEFAULT_SPECULATIVE, targetTemp: 2 },
      { ...DEFAULT_SPECULATIVE, draftNoise: 0 },
      { ...DEFAULT_SPECULATIVE, draftNoise: 3 },
      { ...DEFAULT_SPECULATIVE, draftTemp: 0.5 },
      { ...DEFAULT_SPECULATIVE, draftTemp: 3 },
    ]) {
      const alpha = acceptanceRate(targetDistribution(setup), draftDistribution(setup))
      expect(alpha).toBeGreaterThanOrEqual(0)
      expect(alpha).toBeLessThanOrEqual(1)
    }
  })

  it('residual resamples exactly the mass the draft failed to cover', () => {
    // max(0, p − q) = [0.25, 0], renormalised to [1, 0]
    const residual = residualDistribution(P, Q)
    expect(residual[0]).toBeCloseTo(1, 12)
    expect(residual[1]).toBeCloseTo(0, 12)
    // When the draft covers everything, the residual is identically zero.
    expect(residualDistribution(P, P).every((value) => value === 0)).toBe(true)
  })
})

describe('the length of a verification pass', () => {
  it('is k + 1 tokens when every draft is accepted, and 1 when none is', () => {
    expect(expectedTokens(1, 5)).toBe(6)
    expect(expectedTokens(0, 5)).toBe(1)
  })

  it('satisfies the geometric sum by hand', () => {
    // α = 1/2, k = 3: E = (1 − (1/2)^4) / (1 − 1/2) = (15/16) / (1/2) = 1.875
    expect(expectedTokens(0.5, 3)).toBeCloseTo(1.875, 12)
  })

  it('grows monotonically in k and is capped by k + 1', () => {
    const alpha = 0.7
    let previous = 0
    for (let k = 1; k <= 12; k += 1) {
      const value = expectedTokens(alpha, k)
      expect(value).toBeGreaterThan(previous)
      expect(value).toBeLessThan(k + 1)
      previous = value
    }
  })

  it('charges one parallel pass plus c per drafted token', () => {
    expect(iterationCost(4, 0.15)).toBeCloseTo(1.6, 12)
    expect(iterationCost(1, 0)).toBeCloseTo(1, 12)
  })
})

describe('the speedup, and the draft length that maximises it', () => {
  it('is (k + 1) / (1 + c·k) in the exact-draft case', () => {
    expect(speedup(1, 4, 0.15)).toBeCloseTo(5 / 1.6, 12)
  })

  it('falls below one when the draft is too expensive to verify', () => {
    expect(speedup(0.2, 8, 0.9)).toBeLessThan(1)
  })

  it('picks the boundary k when the draft is free, and 1 when it is ruinous', () => {
    expect(bestDraftLength(0.9, 0, 12)).toBe(12)
    expect(bestDraftLength(0.05, 5, 12)).toBe(1)
  })

  it('is above one for the default setup, which is the regime the paper describes', () => {
    const report = speculativeReport(DEFAULT_SPECULATIVE)
    expect(report.alpha).toBeGreaterThan(0.5)
    expect(report.alpha).toBeLessThan(1)
    expect(report.bestSpeedup).toBeGreaterThan(1)
  })
})

describe('the report the screen renders', () => {
  it('lists twelve draft lengths, marks the optimum, and closes the books on α', () => {
    const report = speculativeReport(DEFAULT_SPECULATIVE)
    expect(report.rows).toHaveLength(12)
    expect(report.rows.map((row) => row.k)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(report.bestK).toBe(report.rows.findIndex((row) => row.speedup === report.bestSpeedup) + 1)
    // The admitted column sums to α on screen; keep the identity honest here too.
    const admitted = report.target.reduce((sum, value, index) => sum + Math.min(value, report.draft[index]), 0)
    expect(admitted).toBeCloseTo(report.alpha, 12)
    // min and residual are a partition of p: min(p,q) + max(0, p−q) = p, and the
    // reported residual is that uncovered mass renormalised.
    const uncovered = report.target.map((value, index) => Math.max(0, value - report.draft[index]))
    const uncoveredSum = uncovered.reduce((sum, value) => sum + value, 0)
    for (let index = 0; index < report.target.length; index += 1) {
      expect(Math.min(report.target[index], report.draft[index]) + uncovered[index]).toBeCloseTo(report.target[index], 12)
      if (uncoveredSum > 0) {
        expect(report.residual[index]).toBeCloseTo(uncovered[index] / uncoveredSum, 12)
      }
    }
  })
})
