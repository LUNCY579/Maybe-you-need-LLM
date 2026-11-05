import { describe, expect, it } from 'vitest'
import {
  buildCritiqueCases,
  compareCritics,
  CRITICS,
  detect,
  scoreCritique,
  verdictAgreement,
  type Critic,
  type CriticCase,
  type Exchange,
} from './constitution'

const flat: Critic = { id: 'flat', recall: 0.5, falsePositiveRate: 0, costPerCritique: 1 }

function caseOf(category: string, violation: boolean, harmfulness: number): CriticCase {
  const exchange: Exchange = {
    prompt: `prompt-${category}-${violation}`,
    category,
    response: violation ? `here is how about ${category}` : `a safe answer about ${category}`,
    harmfulness,
    compliant: violation,
  }
  return { exchange, violation }
}

describe('detecting a violation', () => {
  it('catches everything it can see and nothing it cannot', () => {
    const cases = [caseOf('harm', true, 0.8), caseOf('privacy', false, 0)]
    expect(detect(cases, { ...flat, recall: 1 }, { seed: 1 })).toEqual([true, false])
    expect(detect(cases, { ...flat, recall: 0 }, { seed: 1 })).toEqual([false, false])
  })

  it('is the same draws for two critics given the same seed', () => {
    const cases = buildCritiqueCases(40, 5)
    const self = CRITICS[0]!
    const external = CRITICS[1]!
    const first = detect(cases, { ...self, recall: 0.5 }, { seed: 4 })
    const second = detect(cases, { ...external, recall: 0.5 }, { seed: 4 })
    expect(first).toEqual(second)
  })

  it('reproduces the per-category recalls the critic is given', () => {
    const cases = buildCritiqueCases(600, 5)
    const verdicts = detect(cases, CRITICS[0]!, { seed: 2 })
    const seenBy = (category: string) => {
      const rows = cases.map((entry, index) => ({ entry, verdict: verdicts[index]! })).filter((row) => row.entry.exchange.category === category)
      const violations = rows.filter((row) => row.entry.violation)
      return violations.filter((row) => row.verdict).length / violations.length
    }
    // The blind spot is the one the profile says it is, and the rest are near their own numbers.
    expect(seenBy('deception')).toBeLessThan(0.3)
    expect(seenBy('harm')).toBeGreaterThan(0.85)
    expect(seenBy('illegal')).toBeGreaterThan(0.8)
  })

  it('raises false alarms at the rate it is charged with', () => {
    const cases = buildCritiqueCases(600, 5).filter((entry) => !entry.violation)
    const rate = detect(cases, { ...flat, recall: 0, falsePositiveRate: 0.1 }, { seed: 8 }).filter(Boolean).length / cases.length
    expect(rate).toBeGreaterThan(0.05)
    expect(rate).toBeLessThan(0.15)
  })
})

describe('scoring a set of verdicts', () => {
  const cases = [caseOf('harm', true, 0.8), caseOf('privacy', true, 0.6), caseOf('honesty', false, 0), caseOf('harm', false, 0)]
  // Detected: the first. Missed: the second. False alarm: the third. The fourth is correct silence.
  const result = scoreCritique(cases, [true, false, true, false], flat)

  it('counts the four kinds of answer', () => {
    expect(result.violations).toBe(2)
    expect(result.detected).toBe(1)
    expect(result.missed).toBe(1)
    expect(result.falseAlarms).toBe(1)
    expect(result.recall).toBeCloseTo(0.5, 8)
    expect(result.revised).toBe(1)
  })

  it('removes only the harm the critic saw', () => {
    expect(result.harmBefore).toBeCloseTo(0.35, 8)
    expect(result.harmAfter).toBeCloseTo(0.15, 8)
    expect(result.harmRemoved).toBeCloseTo(0.2, 8)
    // The missed violation is still there in full: 0.6 of the 1.4 across four cases.
    expect(result.harmAfter).toBeCloseTo(0.6 / 4, 8)
  })

  it('charges for every case, not every flag', () => {
    expect(scoreCritique(cases, [true, false, true, false], { ...flat, costPerCritique: 3 }).cost).toBe(12)
  })

  it('reports nothing at all when there is nothing to see', () => {
    const empty = scoreCritique([], [], flat)
    expect(empty.violations).toBe(0)
    expect(empty.recall).toBe(0)
    expect(empty.harmBefore).toBe(0)
  })
})

describe('where two critics disagree', () => {
  it('splits the disagreements by direction', () => {
    const agreement = verdictAgreement([true, false, true, true], [true, false, false, false])
    expect(agreement.agreement).toBeCloseTo(2 / 4, 8)
    expect(agreement.bothFlag).toBe(1)
    expect(agreement.onlyA).toBe(2)
    expect(agreement.onlyB).toBe(0)
    expect(verdictAgreement([false, false], [true, false]).onlyB).toBe(1)
  })

  it('is a share of the shorter list when the two differ in length', () => {
    expect(verdictAgreement([true], [true, true]).agreement).toBeCloseTo(1, 8)
  })
})

describe('the self-critic against the external one', () => {
  const cases = buildCritiqueCases(400, 5)
  const rows = compareCritics(cases, CRITICS, { seed: 11 })
  const self = rows.find((row) => row.id === 'self')!
  const external = rows.find((row) => row.id === 'external')!

  it('buys more removed harm for more money', () => {
    expect(external.recall).toBeGreaterThan(self.recall)
    expect(external.harmRemoved).toBeGreaterThan(self.harmRemoved)
    expect(external.cost).toBeGreaterThan(self.cost)
  })

  it('is the better buy per unit of cost', () => {
    // The whole argument of the paper in one column: the cheap critic removes
    // less harm but far less harm per unit spent.
    expect(self.harmPerCost).toBeGreaterThan(external.harmPerCost)
    expect(self.missed).toBeGreaterThan(0)
    expect(external.missed).toBeLessThan(self.missed)
  })

  it('sorts by the harm actually removed', () => {
    expect(rows[0]!.harmRemoved).toBeGreaterThanOrEqual(rows[1]!.harmRemoved)
  })

  it('puts its misses in the category it cannot see', () => {
    // The blind spot is not a rounding error: it concentrates the misses in one
    // category, which is what a per-category audit is for.
    const verdicts = detect(cases, CRITICS[0]!, { seed: 11 })
    const missRate = (category: string) => {
      const rows = cases
        .map((entry, index) => ({ violation: entry.violation, category: entry.exchange.category, verdict: verdicts[index]! }))
        .filter((row) => row.violation && row.category === category)
      return rows.filter((row) => !row.verdict).length / rows.length
    }
    expect(missRate('deception')).toBeGreaterThan(missRate('harm') * 2)
    expect(missRate('harm')).toBeLessThan(0.2)
  })

  it('removes more harm per case than the same critic with the blind spot filled in', () => {
    const profiled = compareCritics(cases, [CRITICS[0]!], { seed: 11 })[0]!
    const recalls = Object.values(CRITICS[0]!.recall as Record<string, number>)
    const mean = recalls.reduce((a, b) => a + b, 0) / recalls.length
    const even = compareCritics(cases, [{ ...CRITICS[0]!, recall: { harm: 0.9, illegal: 0.9, deception: 0.9, privacy: 0.9, harassment: 0.9, honesty: 0.9 } }], { seed: 11 })[0]!
    expect(even.harmRemoved).toBeGreaterThan(profiled.harmRemoved)
    expect(even.missed).toBeLessThan(profiled.missed)
    expect(mean).toBeLessThan(0.9)
  })
})

describe('the cases themselves', () => {
  it('is deterministic and half violations', () => {
    const a = buildCritiqueCases(200, 5)
    expect(a.map((entry) => entry.violation)).toEqual(buildCritiqueCases(200, 5).map((entry) => entry.violation))
    expect(a.filter((entry) => entry.violation).length).toBeGreaterThan(80)
    expect(a.filter((entry) => entry.violation).length).toBeLessThan(120)
  })

  it('carries harm only in the violating cases', () => {
    for (const entry of buildCritiqueCases(120, 3)) {
      if (entry.violation) expect(entry.exchange.harmfulness).toBeGreaterThan(0.3)
      else expect(entry.exchange.harmfulness).toBe(0)
    }
  })
})
