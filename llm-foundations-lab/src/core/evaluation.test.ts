import { describe, expect, it } from 'vitest'
import {
  RISK_CATEGORIES,
  SAFETY_CATEGORIES,
  riskProfile,
  riskProfiles,
  safetyProfile,
  strengthForViolation,
} from './evaluation'

describe('the safety evaluation', () => {
  it('has a rate for every category, from the prompts it lists', () => {
    const profile = safetyProfile(0.5)
    expect(profile.rows.length).toBe(SAFETY_CATEGORIES.length)
    expect(profile.prompts).toBe(SAFETY_CATEGORIES.reduce((sum, category) => sum + category.prompts, 0))
    expect(profile.violations).toBeCloseTo(
      profile.rows.reduce((sum, row) => sum + row.violation * row.prompts, 0),
      9,
    )
  })

  it('reduces violations and raises refusals as training strengthens', () => {
    const none = safetyProfile(0)
    const full = safetyProfile(1)
    expect(full.violationRate).toBeLessThan(none.violationRate)
    expect(full.benignRefusal).toBeGreaterThan(none.benignRefusal)
    expect(full.helpfulness).toBeLessThan(none.helpfulness)
    for (let index = 0; index < none.rows.length; index++) {
      expect(full.rows[index]!.violation).toBeLessThan(none.rows[index]!.violation)
    }
  })

  it('solves for the strength that reaches a target violation rate', () => {
    const target = 0.02
    const strength = strengthForViolation(target)
    expect(Number.isFinite(strength)).toBe(true)
    expect(safetyProfile(strength).violationRate).toBeCloseTo(target, 9)
  })
})

describe('the eight risk categories', () => {
  it('lists eight categories with eight scores', () => {
    expect(RISK_CATEGORIES.length).toBe(8)
    const scores = riskProfile({ capability: 0.6, care: 0.5 })
    expect(scores.length).toBe(8)
    expect(scores.map((score) => score.id)).toEqual(RISK_CATEGORIES.map((category) => category.id))
    for (const score of scores) {
      expect(score.value).toBeGreaterThanOrEqual(0)
      expect(score.value).toBeLessThanOrEqual(1)
    }
  })

  it('trades capability against efficiency', () => {
    const small = riskProfile({ capability: 0.3, care: 0.5 })
    const large = riskProfile({ capability: 0.9, care: 0.5 })
    const value = (scores: typeof small, id: string) => scores.find((score) => score.id === id)!.value
    expect(value(large, 'accuracy')).toBeGreaterThan(value(small, 'accuracy'))
    expect(value(large, 'efficiency')).toBeLessThan(value(small, 'efficiency'))
  })

  it('improves the harm categories with care', () => {
    const careless = riskProfile({ capability: 0.85, care: 0.2 })
    const careful = riskProfile({ capability: 0.85, care: 0.9 })
    const value = (scores: typeof careless, id: string) => scores.find((score) => score.id === id)!.value
    for (const id of ['bias', 'toxicity', 'privacy']) {
      expect(value(careful, id)).toBeLessThan(value(careless, id))
    }
  })

  it('scores every named profile', () => {
    const profiles = riskProfiles()
    expect(profiles.length).toBe(3)
    for (const profile of profiles) expect(profile.scores.length).toBe(8)
  })
})
