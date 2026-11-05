import { describe, expect, it } from 'vitest'
import {
  buildDemonstrations,
  buildPreferencePairs,
  distance,
  dominates,
  expectedChoice,
  imitate,
  meanChoice,
  preferredRound,
  preferenceStep,
  runTwoRound,
  trainSecondRound,
  utility,
  type Policy,
} from './alignment'

const pool = buildDemonstrations(40, 2)
const certain = buildPreferencePairs(24, { chooseHelpful: 1 })
const undecided = buildPreferencePairs(24, { chooseHelpful: 0.5 })

describe('the first round', () => {
  it('lands on the mean of what it was shown', () => {
    const one = imitate([{ kind: 'helpful', helpfulness: 0.9, harmlessness: 0.2 }])
    expect(one).toEqual({ helpfulness: 0.9, harmlessness: 0.2 })
    const mixed = imitate([
      { kind: 'helpful', helpfulness: 0.9, harmlessness: 0.2 },
      { kind: 'harmless', helpfulness: 0.3, harmlessness: 0.9 },
    ])
    expect(mixed).toEqual({ helpfulness: 0.6, harmlessness: 0.55 })
  })

  it('puts a mixed pool between the clusters, at a point nobody chose', () => {
    const policy = imitate(pool)
    expect(policy.helpfulness).toBeGreaterThan(0.35)
    expect(policy.helpfulness).toBeLessThan(0.85)
    expect(policy.harmlessness).toBeGreaterThan(0.35)
    expect(policy.harmlessness).toBeLessThan(0.85)
    // Neither cluster is dominated by the pool mean: the compromise is the finding.
    expect(dominates(policy, { helpfulness: 0.9, harmlessness: 0.25 })).toBe(false)
    expect(dominates({ helpfulness: 0.3, harmlessness: 0.92 }, policy)).toBe(false)
  })

  it('has an empty pool at the origin', () => {
    expect(imitate([])).toEqual({ helpfulness: 0, harmlessness: 0 })
  })
})

describe('the second round', () => {
  it('moves all the way to a labeler who is certain', () => {
    const run = runTwoRound(pool, certain)
    expect(run.roundTwo.helpfulness).toBeCloseTo(0.9, 2)
    expect(run.roundTwo.harmlessness).toBeCloseTo(0.25, 2)
    expect(run.movement).toBeGreaterThan(0.3)
    expect(run.roundTwo.harmlessness).toBeLessThan(run.roundOne.harmlessness)
  })

  it('barely moves a labeler who is undecided', () => {
    const run = runTwoRound(pool, undecided)
    expect(run.movement).toBeLessThan(0.06)
    expect(distance(run.roundTwo, meanChoice(undecided))).toBeLessThan(0.01)
  })

  it('puts the target where the labels point, exactly', () => {
    const pair = { question: 'q', helpful: { id: 'a', helpfulness: 0.9, harmlessness: 0.2 }, harmless: { id: 'b', helpfulness: 0.3, harmlessness: 0.9 }, chooseHelpful: 0.25 }
    const choice = expectedChoice(pair)
    expect(choice.helpfulness).toBeCloseTo(0.45, 8)
    expect(choice.harmlessness).toBeCloseTo(0.725, 8)
    const twice = meanChoice([pair, pair])
    expect(twice.helpfulness).toBeCloseTo(0.45, 8)
    expect(twice.harmlessness).toBeCloseTo(0.725, 8)
  })

  it('takes a learning rate rather than a leap', () => {
    const start: Policy = { helpfulness: 0, harmlessness: 0 }
    const half = preferenceStep(start, certain, { learningRate: 0.5 })
    expect(half.helpfulness).toBeCloseTo(0.45, 8)
    expect(half.harmlessness).toBeCloseTo(0.125, 8)
    const whole = preferenceStep(start, certain, { learningRate: 1 })
    expect(whole.helpfulness).toBeCloseTo(0.9, 8)
    expect(whole.harmlessness).toBeCloseTo(0.25, 8)
    expect(preferenceStep(start, [], { learningRate: 1 })).toEqual(start)
  })

  it('converges, and says so in the residual', () => {
    const first = trainSecondRound(imitate(pool), certain, { steps: 2 })
    const later = trainSecondRound(imitate(pool), certain, { steps: 20 })
    expect(first.path).toHaveLength(3)
    expect(later.residual).toBeLessThan(first.residual)
    expect(later.residual).toBeLessThan(0.001)
    // Each step covers half the remaining distance, so the path is monotone.
    const gaps = first.path.map((point) => distance(point, meanChoice(certain)))
    expect(gaps[1]!).toBeLessThan(gaps[0]!)
    expect(gaps[2]!).toBeLessThan(gaps[1]!)
  })
})

describe('what the two rounds were for', () => {
  it('is decided by the weighting, and the two answer cross over', () => {
    const safety = preferredRound(pool, certain, 0)
    const helpfulness = preferredRound(pool, certain, 1)
    expect(safety.prefers).toBe('round one')
    expect(helpfulness.prefers).toBe('round two')
    // The crossover is close to the even weighting, which is the honest reading
    // of "the second round makes the model safer": it does not.
    expect(preferredRound(pool, certain, 0.4).prefers).toBe('round one')
    expect(preferredRound(pool, certain, 0.6).prefers).toBe('round two')
    expect(Math.abs(preferredRound(pool, certain, 0.5).roundOne - preferredRound(pool, certain, 0.5).roundTwo)).toBeLessThan(0.06)
  })

  it('is a weighted average of the two axes', () => {
    const point: Policy = { helpfulness: 0.8, harmlessness: 0.4 }
    expect(utility(point, 1)).toBeCloseTo(0.8, 8)
    expect(utility(point, 0)).toBeCloseTo(0.4, 8)
    expect(utility(point, 0.5)).toBeCloseTo(0.6, 8)
    expect(utility(point, 5)).toBeCloseTo(0.8, 8)
  })

  it('prefers an even split of labels to a certain one under a safety weighting', () => {
    // This is the round-two result that a safety reviewer cares about: the same
    // procedure with uncertain labels leaves the policy safe *and* useful.
    const soft = runTwoRound(pool, buildPreferencePairs(24, { chooseHelpful: 0.5 }))
    const hard = runTwoRound(pool, certain)
    expect(soft.roundTwo.harmlessness).toBeGreaterThan(hard.roundTwo.harmlessness)
    expect(soft.roundTwo.helpfulness).toBeLessThan(hard.roundTwo.helpfulness)
  })

  it('measures distance as a distance', () => {
    expect(distance({ helpfulness: 0, harmlessness: 0 }, { helpfulness: 3, harmlessness: 4 })).toBeCloseTo(5, 8)
  })

  it('needs one axis strictly better to dominate', () => {
    expect(dominates({ helpfulness: 0.5, harmlessness: 0.5 }, { helpfulness: 0.5, harmlessness: 0.5 })).toBe(false)
    expect(dominates({ helpfulness: 0.6, harmlessness: 0.5 }, { helpfulness: 0.5, harmlessness: 0.5 })).toBe(true)
    expect(dominates({ helpfulness: 0.6, harmlessness: 0.4 }, { helpfulness: 0.5, harmlessness: 0.5 })).toBe(false)
  })
})

describe('the fixtures', () => {
  it('is two clusters and nothing in between', () => {
    const helpful = pool.filter((entry) => entry.kind === 'helpful')
    const harmless = pool.filter((entry) => entry.kind === 'harmless')
    expect(helpful).toHaveLength(20)
    expect(Math.max(...harmless.map((entry) => entry.helpfulness))).toBeLessThan(Math.min(...helpful.map((entry) => entry.helpfulness)))
    expect(Math.max(...helpful.map((entry) => entry.harmlessness))).toBeLessThan(Math.min(...harmless.map((entry) => entry.harmlessness)))
  })

  it('is the same pool every time for a seed', () => {
    expect(buildDemonstrations(12, 4)).toEqual(buildDemonstrations(12, 4))
    expect(buildDemonstrations(12, 4)).not.toEqual(buildDemonstrations(12, 5))
  })

  it('gives every question one answer of each kind', () => {
    const pairs = buildPreferencePairs(6)
    expect(pairs).toHaveLength(6)
    for (const pair of pairs) {
      expect(pair.helpful.helpfulness).toBeGreaterThan(pair.harmless.helpfulness)
      expect(pair.helpful.harmlessness).toBeLessThan(pair.harmless.harmlessness)
      expect(pair.chooseHelpful).toBe(1)
    }
  })
})
