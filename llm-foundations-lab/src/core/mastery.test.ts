import { describe, expect, it } from 'vitest'
import {
  MASTERY_HALF_LIFE_DAYS,
  MASTERY_THRESHOLD,
  describeMastery,
  questionMastery,
  summariseMastery,
} from './mastery'

const NOW = new Date('2026-03-01T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY).toISOString()
}

describe('the mastery of one question', () => {
  it('is nothing for a question that has never been answered', () => {
    const result = questionMastery({ repetitions: 0, easeFactor: 2.5, lastReviewedAt: null }, NOW)
    expect(result.score).toBe(0)
  })

  it('is nothing for a malformed timestamp', () => {
    const result = questionMastery({ repetitions: 3, easeFactor: 2.5, lastReviewedAt: 'nonsense' }, NOW)
    expect(result.score).toBe(0)
  })

  it('grows with the number of correct recalls in a row', () => {
    const one = questionMastery({ repetitions: 1, easeFactor: 2.5, lastReviewedAt: daysAgo(0) }, NOW)
    const two = questionMastery({ repetitions: 2, easeFactor: 2.5, lastReviewedAt: daysAgo(0) }, NOW)
    const four = questionMastery({ repetitions: 4, easeFactor: 2.5, lastReviewedAt: daysAgo(0) }, NOW)
    expect(two.score).toBeGreaterThan(one.score)
    expect(four.score).toBeGreaterThan(two.score)
  })

  it('counts a single lucky guess for little', () => {
    const one = questionMastery({ repetitions: 1, easeFactor: 2.5, lastReviewedAt: daysAgo(0) }, NOW)
    const three = questionMastery({ repetitions: 3, easeFactor: 2.5, lastReviewedAt: daysAgo(0) }, NOW)
    expect(one.score).toBeLessThan(0.4)
    expect(three.score).toBeGreaterThan(0.5)
  })

  it('counts a hard question for less than an easy one', () => {
    const hard = questionMastery({ repetitions: 3, easeFactor: 1.3, lastReviewedAt: daysAgo(0) }, NOW)
    const easy = questionMastery({ repetitions: 3, easeFactor: 3.0, lastReviewedAt: daysAgo(0) }, NOW)
    expect(easy.score).toBeGreaterThan(hard.score)
  })

  it('decays with the time since the last recall', () => {
    const fresh = questionMastery({ repetitions: 3, easeFactor: 2.5, lastReviewedAt: daysAgo(0) }, NOW)
    const month = questionMastery(
      { repetitions: 3, easeFactor: 2.5, lastReviewedAt: daysAgo(MASTERY_HALF_LIFE_DAYS) },
      NOW,
    )
    const year = questionMastery({ repetitions: 3, easeFactor: 2.5, lastReviewedAt: daysAgo(365) }, NOW)
    expect(month.score).toBeLessThan(fresh.score)
    expect(year.score).toBeLessThan(month.score)
  })

  it('halves over the half-life', () => {
    const fresh = questionMastery({ repetitions: 4, easeFactor: 2.5, lastReviewedAt: daysAgo(0) }, NOW)
    const halfLife = questionMastery(
      { repetitions: 4, easeFactor: 2.5, lastReviewedAt: daysAgo(MASTERY_HALF_LIFE_DAYS) },
      NOW,
    )
    // The ease part is unchanged, so the ratio is the decay alone.
    expect(halfLife.score / fresh.score).toBeCloseTo(0.5, 2)
  })

  it('never goes below zero or above one', () => {
    const ancient = questionMastery(
      { repetitions: 1, easeFactor: 1.3, lastReviewedAt: daysAgo(3650) },
      NOW,
    )
    expect(ancient.score).toBeGreaterThanOrEqual(0)
    expect(ancient.score).toBeLessThanOrEqual(1)
    const perfect = questionMastery({ repetitions: 20, easeFactor: 3.2, lastReviewedAt: daysAgo(0) }, NOW)
    expect(perfect.score).toBeLessThanOrEqual(1)
  })
})

describe('the mastery of a lesson', () => {
  const states = {
    strong: { repetitions: 5, easeFactor: 2.6, lastReviewedAt: daysAgo(2) },
    weak: { repetitions: 1, easeFactor: 2.0, lastReviewedAt: daysAgo(20) },
  }

  it('is nothing for a lesson with no questions', () => {
    const summary = summariseMastery([], {}, NOW)
    expect(summary.score).toBeNull()
    expect(describeMastery(summary)).toBe('No questions yet')
  })

  it('counts the questions that have never been answered', () => {
    const summary = summariseMastery(['strong', 'weak', 'never'], states, NOW)
    expect(summary.unseen).toBe(1)
    expect(summary.attempted).toBe(2)
  })

  it('is the mean over every question, including the unseen ones', () => {
    const summary = summariseMastery(['strong', 'never'], states, NOW)
    const strong = questionMastery(states.strong, NOW).score
    expect(summary.score).toBeCloseTo(strong / 2, 6)
  })

  it('counts the questions that are in good shape', () => {
    const summary = summariseMastery(['strong', 'weak'], states, NOW)
    expect(summary.mastered).toBeLessThanOrEqual(2)
    expect(summary.mastered).toBeGreaterThanOrEqual(0)
  })

  it('names the weakest question', () => {
    const summary = summariseMastery(['strong', 'weak'], states, NOW)
    expect(summary.weakest).toBe('weak')
  })

  it('calls a lesson that has not been attempted not attempted', () => {
    const summary = summariseMastery(['a', 'b'], {}, NOW)
    expect(describeMastery(summary)).toBe('Not attempted')
  })

  it('calls a well-practised lesson mastered', () => {
    const summary = summariseMastery(
      ['a'],
      { a: { repetitions: 6, easeFactor: 2.8, lastReviewedAt: daysAgo(1) } },
      NOW,
    )
    expect(summary.score).toBeGreaterThan(MASTERY_THRESHOLD)
    expect(describeMastery(summary)).toBe('Mastered')
  })

  it('calls a partly-practised lesson shaky', () => {
    const summary = summariseMastery(['a'], { a: { repetitions: 1, easeFactor: 1.8, lastReviewedAt: daysAgo(30) } }, NOW)
    expect(describeMastery(summary)).toBe('Shaky')
  })
})
