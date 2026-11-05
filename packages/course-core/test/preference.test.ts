import { describe, expect, it } from 'vitest'
import {
  bradleyTerryGradient,
  bradleyTerryLogLikelihood,
  eloUpdate,
  fitBradleyTerry,
  fitBradleyTerryFromMatrix,
  preferenceProbability,
  runElo,
} from '../src/preference.js'

describe('bradleyTerryLogLikelihood', () => {
  it('is maximal when the winner has the higher strength', () => {
    const comparisons = [{ winner: 0, loser: 1 }]
    const good = bradleyTerryLogLikelihood(comparisons, [2, 0])
    const bad = bradleyTerryLogLikelihood(comparisons, [0, 2])
    expect(good).toBeGreaterThan(bad)
  })

  it('is zero-likelihood-adjacent for a fully confident wrong order', () => {
    const comparisons = [{ winner: 0, loser: 1 }]
    const ll = bradleyTerryLogLikelihood(comparisons, [-50, 50])
    expect(ll).toBeLessThan(-90)
  })
})

describe('bradleyTerryGradient', () => {
  it('points towards the observed winner', () => {
    const comparisons = [{ winner: 0, loser: 1 }]
    const gradient = bradleyTerryGradient(comparisons, [0, 0])
    expect(gradient[0]).toBeCloseTo(0.5, 12)
    expect(gradient[1]).toBeCloseTo(-0.5, 12)
  })
})

describe('fitBradleyTerry', () => {
  it('recovers a known ordering', () => {
    // Item 2 beats item 1 eight times, item 1 beats item 0 eight times.
    const comparisons = [
      { winner: 2, loser: 1, weight: 8 },
      { winner: 1, loser: 0, weight: 8 },
    ]
    const fit = fitBradleyTerry(comparisons, 3, { iterations: 2000, learningRate: 0.3 })
    expect(fit.strengths[2]).toBeGreaterThan(fit.strengths[1])
    expect(fit.strengths[1]).toBeGreaterThan(fit.strengths[0])
  })

  it('centres the strengths so the mean is zero', () => {
    const fit = fitBradleyTerry([{ winner: 0, loser: 1 }], 2)
    const mean = fit.strengths.reduce((a, b) => a + b, 0) / fit.strengths.length
    expect(mean).toBeCloseTo(0, 8)
  })

  it('produces a larger likelihood than the null model', () => {
    const comparisons = [
      { winner: 0, loser: 1, weight: 6 },
      { winner: 1, loser: 2, weight: 6 },
      { winner: 0, loser: 2, weight: 6 },
    ]
    const fit = fitBradleyTerry(comparisons, 3, { iterations: 3000, learningRate: 0.3 })
    const nullLikelihood = bradleyTerryLogLikelihood(comparisons, [0, 0, 0])
    expect(fit.logLikelihood).toBeGreaterThan(nullLikelihood)
  })

  it('is deterministic', () => {
    const comparisons = [
      { winner: 0, loser: 1 },
      { winner: 1, loser: 2 },
    ]
    const a = fitBradleyTerry(comparisons, 3)
    const b = fitBradleyTerry(comparisons, 3)
    expect(a.strengths).toEqual(b.strengths)
  })
})

describe('preferenceProbability', () => {
  it('is the sigmoid of the strength difference', () => {
    expect(preferenceProbability([1, 0], 0, 1)).toBeCloseTo(0.7310586, 6)
  })
})

describe('fitBradleyTerryFromMatrix', () => {
  it('ranks the dominating item first', () => {
    const wins = [
      [0, 10, 10],
      [0, 0, 3],
      [0, 0, 0],
    ]
    const fit = fitBradleyTerryFromMatrix(wins)
    expect(fit.strengths[0]).toBeGreaterThan(fit.strengths[1])
    expect(fit.strengths[1]).toBeGreaterThan(fit.strengths[2])
  })
})

describe('elo', () => {
  it('raises the winner and lowers the loser', () => {
    const { ratingA, ratingB } = eloUpdate(1500, 1500, 1)
    expect(ratingA).toBeGreaterThan(1500)
    expect(ratingB).toBeLessThan(1500)
  })

  it('leaves equal players unchanged in a draw', () => {
    const draw = eloUpdate(1500, 1500, 0.5)
    expect(draw.ratingA).toBeCloseTo(1500, 10)
    expect(draw.ratingB).toBeCloseTo(1500, 10)
  })

  it('moves both players toward each other in a draw between unequal players', () => {
    const { ratingA, ratingB } = eloUpdate(1600, 1400, 0.5)
    expect(ratingA).toBeLessThan(1600)
    expect(ratingB).toBeGreaterThan(1400)
  })

  it('runs a season', () => {
    const ratings = runElo(
      [
        { a: 0, b: 1, scoreA: 1 },
        { a: 0, b: 1, scoreA: 1 },
      ],
      2,
    )
    expect(ratings[0]).toBeGreaterThan(ratings[1])
  })
})
