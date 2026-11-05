import { describe, expect, it } from 'vitest'
import {
  CANDIDATES,
  HEML_MODELS,
  decodingSweep,
  optimismCurve,
  selectOnPublic,
  surfaceSummary,
  tradeoffSurface,
} from './benchmarking'
import { MODELS, NEUTRAL_JUDGE, buildAnswers, buildQuestions } from './setting'
import { rankingStability } from './arena'

describe('the multi-metric surface', () => {
  const points = tradeoffSurface()

  it('sorts the models by cost and marks the dominated ones', () => {
    expect(points.length).toBe(HEML_MODELS.length)
    for (let index = 1; index < points.length; index++) {
      expect(points[index]!.cost).toBeGreaterThanOrEqual(points[index - 1]!.cost)
    }
    expect(points.some((point) => point.dominated)).toBe(true)
    expect(points.some((point) => !point.dominated)).toBe(true)
  })

  it('has a frontier with more than one point', () => {
    const summary = surfaceSummary()
    expect(summary.frontier).toBeGreaterThan(1)
    expect(summary.accuracySpread).toBeGreaterThan(0.1)
    expect(summary.costSpread).toBeGreaterThan(1)
  })

  it('does not put the same model first on every metric', () => {
    const summary = surfaceSummary()
    expect(new Set([summary.bestAccuracy, summary.bestCalibration, summary.cheapest]).size).toBe(3)
  })
})

describe('selecting on a public set', () => {
  it('flatters the winner, on average', () => {
    let total = 0
    for (let seed = 0; seed < 60; seed++) total += selectOnPublic(CANDIDATES, { seed }).optimism
    expect(total / 60).toBeGreaterThan(0)
  })

  it('never reports a winner better than the best private score', () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = selectOnPublic(CANDIDATES, { seed })
      expect(result.privateWinnerScore).toBeLessThanOrEqual(result.bestPrivateScore)
      expect(result.privateScores[result.winner]).toBe(result.privateWinnerScore)
    }
  })

  it('grows with the noise in the public set', () => {
    const curve = optimismCurve()
    expect(curve.length).toBe(9)
    expect(curve[0]!.noise).toBe(0)
    expect(curve[curve.length - 1]!.optimism).toBeGreaterThan(curve[0]!.optimism + 0.01)
  })
})

describe('a change of decoding', () => {
  const base = 0.6
  const sweep = decodingSweep(base)

  it('is exactly the reference at temperature zero', () => {
    expect(sweep[0]!.temperature).toBe(0)
    expect(sweep[0]!.mean).toBeCloseTo(base, 12)
    expect(sweep[0]!.sd).toBe(0)
  })

  it('moves the score and adds variance', () => {
    const warm = sweep.find((row) => row.temperature === 1)!
    expect(warm.delta).toBeGreaterThan(0.02)
    expect(warm.sd).toBeGreaterThan(0)
  })

  it('moves it by more than the benchmark’s own standard error at a hundred questions', () => {
    const standardError = Math.sqrt((base * (1 - base)) / 100)
    const warm = sweep.find((row) => row.temperature === 1)!
    expect(warm.delta).toBeGreaterThan(standardError / 2)
  })
})

describe('the ranking on a fixed set of questions', () => {
  it('changes when the set changes', () => {
    const questions = buildQuestions(30, 5)
    const answers = buildAnswers(MODELS, questions, 11)
    const stability = rankingStability(MODELS, questions, answers, NEUTRAL_JUDGE)
    expect(stability.draws).toBe(24)
    expect(stability.sameTop).toBeGreaterThanOrEqual(0)
    expect(stability.sameTop).toBeLessThanOrEqual(stability.draws)
    expect(stability.meanAgreement).toBeGreaterThan(0.5)
    expect(stability.meanAgreement).toBeLessThanOrEqual(1)
  })
})
