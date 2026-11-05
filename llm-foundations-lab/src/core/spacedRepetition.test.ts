import { describe, expect, it } from 'vitest'
import {
  INITIAL_EASE,
  countDueForReview,
  hasBeenSeen,
  isDueForReview,
  MAXIMUM_INTERVAL_DAYS,
  MINIMUM_EASE,
  answerToQuality,
  daysOverdue,
  describeState,
  initialReviewState,
  isDue,
  parseReviewState,
  reviewedToday,
  reviewItem,
  selectDueItems,
} from './spacedRepetition'

const NOW = new Date('2026-03-01T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

describe('spaced repetition (SM-2)', () => {
  describe('the initial state', () => {
    it('starts unreviewed and due immediately', () => {
      const state = initialReviewState(NOW)
      expect(state.repetitions).toBe(0)
      expect(state.easeFactor).toBe(INITIAL_EASE)
      expect(state.intervalDays).toBe(0)
      expect(state.lastReviewedAt).toBeNull()
      expect(state.dueAt).toBe(NOW.toISOString())
      expect(isDue(state, NOW)).toBe(true)
    })
  })

  describe('a correct answer', () => {
    it('uses a one-day interval for the first success', () => {
      const state = reviewItem(initialReviewState(NOW), 4, NOW)
      expect(state.repetitions).toBe(1)
      expect(state.intervalDays).toBe(1)
      expect(state.dueAt).toBe(new Date(NOW.getTime() + DAY).toISOString())
    })

    it('uses a six-day interval for the second success', () => {
      let state = reviewItem(initialReviewState(NOW), 4, NOW)
      state = reviewItem(state, 4, NOW)
      expect(state.repetitions).toBe(2)
      expect(state.intervalDays).toBe(6)
    })

    it('multiplies the interval by the ease factor afterwards', () => {
      let state = reviewItem(initialReviewState(NOW), 5, NOW)
      state = reviewItem(state, 5, NOW)
      // Two successes: interval 1 then 6, ease raised by the quality-5 grade.
      expect(state.easeFactor).toBeGreaterThan(INITIAL_EASE)
      const before = state.intervalDays
      // SM-2 multiplies by the ease factor as it stood *before* this review.
      const easeBefore = state.easeFactor
      state = reviewItem(state, 5, NOW)
      expect(state.intervalDays).toBe(Math.round(before * easeBefore))
    })

    it('raises the ease factor for a quick, confident recall', () => {
      const state = reviewItem(initialReviewState(NOW), 5, NOW)
      expect(state.easeFactor).toBeGreaterThan(INITIAL_EASE)
    })

    it('lowers the ease factor for a slow but correct recall', () => {
      const state = reviewItem(initialReviewState(NOW), 3, NOW)
      expect(state.easeFactor).toBeLessThan(INITIAL_EASE)
    })

    it('never lets the ease factor fall below the floor', () => {
      let state = initialReviewState(NOW)
      for (let i = 0; i < 40; i++) {
        state = reviewItem(state, 3, NOW)
      }
      expect(state.easeFactor).toBe(MINIMUM_EASE)
    })

    it('never schedules an interval beyond the maximum', () => {
      let state = initialReviewState(NOW)
      for (let i = 0; i < 60; i++) {
        state = reviewItem(state, 5, NOW)
      }
      expect(state.intervalDays).toBeLessThanOrEqual(MAXIMUM_INTERVAL_DAYS)
    })
  })

  describe('a wrong answer', () => {
    it('resets the repetitions and the interval', () => {
      let state = reviewItem(initialReviewState(NOW), 5, NOW)
      state = reviewItem(state, 5, NOW)
      expect(state.repetitions).toBe(2)
      state = reviewItem(state, 1, NOW)
      expect(state.repetitions).toBe(0)
      expect(state.intervalDays).toBe(1)
    })

    it('does not itself reduce the ease factor', () => {
      // The rule that keeps a hard item out of "low interval hell".
      let state = initialReviewState(NOW)
      state = reviewItem(state, 5, NOW)
      const ease = state.easeFactor
      state = reviewItem(state, 1, NOW)
      expect(state.easeFactor).toBe(ease)
    })

    it('comes back the next day', () => {
      const state = reviewItem(initialReviewState(NOW), 1, NOW)
      expect(state.dueAt).toBe(new Date(NOW.getTime() + DAY).toISOString())
    })
  })

  describe('mapping an answer to a quality', () => {
    it('gives a quick correct answer the top grade', () => {
      expect(answerToQuality(true, 3)).toBe(5)
    })

    it('gives an ordinary correct answer a good grade', () => {
      expect(answerToQuality(true, 20)).toBe(4)
    })

    it('gives a slow correct answer the passing grade', () => {
      expect(answerToQuality(true, 120)).toBe(3)
    })

    it('gives a wrong answer a failing grade', () => {
      expect(answerToQuality(false, 10)).toBe(1)
    })

    it('gives a skipped question the lowest grade', () => {
      expect(answerToQuality(false, -1)).toBe(0)
    })

    it('discounts a correct answer to a hard question', () => {
      expect(answerToQuality(true, 3, 3)).toBe(4)
      expect(answerToQuality(true, 120, 3)).toBe(2)
    })
  })

  describe('choosing what to review', () => {
    it('puts the most overdue item first', () => {
      const states = {
        a: { ...initialReviewState(NOW), dueAt: new Date(NOW.getTime() - 10 * DAY).toISOString() },
        b: { ...initialReviewState(NOW), dueAt: new Date(NOW.getTime() - 2 * DAY).toISOString() },
        c: { ...initialReviewState(NOW), dueAt: new Date(NOW.getTime() + 5 * DAY).toISOString() },
      }
      expect(selectDueItems(states, NOW, 10)).toEqual(['a', 'b'])
    })

    it('puts the most overdue item first, even if the other is unseen', () => {
      // Spacing exists to catch an item just before it is forgotten, so
      // overdue dominates the order; an unseen item is due but not late.
      const states = {
        seen: {
          ...initialReviewState(NOW),
          lastReviewedAt: NOW.toISOString(),
          dueAt: new Date(NOW.getTime() - 0.5 * DAY).toISOString(),
        },
        fresh: initialReviewState(NOW),
      }
      expect(selectDueItems(states, NOW, 10)).toEqual(['seen', 'fresh'])
    })

    it('puts an unseen item first when two items are equally overdue', () => {
      const states = {
        seen: {
          ...initialReviewState(NOW),
          lastReviewedAt: NOW.toISOString(),
          dueAt: NOW.toISOString(),
        },
        fresh: initialReviewState(NOW),
      }
      expect(selectDueItems(states, NOW, 10)).toEqual(['fresh', 'seen'])
    })

    it('respects the limit', () => {
      const states = Object.fromEntries(
        Array.from({ length: 30 }, (_, i) => [`q${i}`, initialReviewState(NOW)]),
      )
      expect(selectDueItems(states, NOW, 5)).toHaveLength(5)
    })

    it('returns nothing when nothing is due', () => {
      const states = {
        later: {
          ...initialReviewState(NOW),
          lastReviewedAt: NOW.toISOString(),
          dueAt: new Date(NOW.getTime() + 5 * DAY).toISOString(),
        },
      }
      expect(selectDueItems(states, NOW, 10)).toEqual([])
    })
  })

  describe('reviewing once a day', () => {
    it('reports an item that has never been reviewed as not reviewed today', () => {
      expect(reviewedToday(initialReviewState(NOW), NOW)).toBe(false)
    })

    it('reports an item reviewed earlier today as reviewed today', () => {
      const state = reviewItem(initialReviewState(NOW), 4, NOW)
      expect(reviewedToday(state, NOW)).toBe(true)
      expect(reviewedToday(state, new Date(NOW.getTime() + 60 * 60 * 1000))).toBe(true)
    })

    it('reports an item reviewed yesterday as not reviewed today', () => {
      const state = reviewItem(initialReviewState(NOW), 4, NOW)
      const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000)
      expect(reviewedToday(state, tomorrow)).toBe(false)
    })

    it('ignores a malformed timestamp', () => {
      const state = { ...initialReviewState(NOW), lastReviewedAt: 'not a date' }
      expect(reviewedToday(state, NOW)).toBe(false)
    })
  })

  describe('describing a state', () => {
    it('calls a new item new', () => {
      expect(describeState(initialReviewState(NOW), NOW)).toBe('new')
    })

    it('counts the days it is overdue', () => {
      const state = {
        ...initialReviewState(NOW),
        lastReviewedAt: NOW.toISOString(),
        dueAt: new Date(NOW.getTime() - 3 * DAY).toISOString(),
      }
      expect(describeState(state, NOW)).toBe('3 days overdue')
    })

    it('says when it is next due', () => {
      const state = {
        ...initialReviewState(NOW),
        lastReviewedAt: NOW.toISOString(),
        intervalDays: 6,
        dueAt: new Date(NOW.getTime() + 6 * DAY).toISOString(),
      }
      expect(describeState(state, NOW)).toBe('due in 6 days')
    })
  })

  describe('measuring overdue', () => {
    it('is positive when late and negative when early', () => {
      const late = { ...initialReviewState(NOW), dueAt: new Date(NOW.getTime() - 2 * DAY).toISOString() }
      const early = { ...initialReviewState(NOW), dueAt: new Date(NOW.getTime() + 2 * DAY).toISOString() }
      expect(daysOverdue(late, NOW)).toBeCloseTo(2, 6)
      expect(daysOverdue(early, NOW)).toBeCloseTo(-2, 6)
    })
  })

  describe('parsing a stored state', () => {
    it('accepts a well-formed state', () => {
      const parsed = parseReviewState({
        repetitions: 3,
        easeFactor: 2.1,
        intervalDays: 12,
        lastReviewedAt: NOW.toISOString(),
        dueAt: NOW.toISOString(),
      })
      expect(parsed?.repetitions).toBe(3)
      expect(parsed?.intervalDays).toBe(12)
    })

    it('rejects a malformed state rather than repairing it', () => {
      expect(parseReviewState(null)).toBeNull()
      expect(parseReviewState('nope')).toBeNull()
      expect(parseReviewState({ repetitions: 'many' })).toBeNull()
      expect(parseReviewState({ repetitions: 1, easeFactor: 2, intervalDays: 3 })).toBeNull()
    })

    it('never returns an ease factor below the floor', () => {
      const parsed = parseReviewState({
        repetitions: 1,
        easeFactor: 0.2,
        intervalDays: 3,
        lastReviewedAt: null,
        dueAt: NOW.toISOString(),
      })
      expect(parsed?.easeFactor).toBe(MINIMUM_EASE)
    })
  })
})

describe('what counts as due for review', () => {
  const NOW = new Date('2026-03-01T12:00:00.000Z')
  const DAY = 24 * 60 * 60 * 1000

  const never = { repetitions: 0, easeFactor: 2.5, intervalDays: 0, lastReviewedAt: null, dueAt: NOW.toISOString() }
  const learned = {
    repetitions: 3,
    easeFactor: 2.5,
    intervalDays: 10,
    lastReviewedAt: new Date(NOW.getTime() - 20 * DAY).toISOString(),
    dueAt: new Date(NOW.getTime() - 10 * DAY).toISOString(),
  }
  const scheduled = {
    repetitions: 3,
    easeFactor: 2.5,
    intervalDays: 10,
    lastReviewedAt: new Date(NOW.getTime() - DAY).toISOString(),
    dueAt: new Date(NOW.getTime() + 9 * DAY).toISOString(),
  }

  it('says a question that has never been asked has not been seen', () => {
    expect(hasBeenSeen(never)).toBe(false)
    expect(hasBeenSeen(learned)).toBe(true)
  })

  it('does not call a question that has never been asked due for review', () => {
    // It has not been learned, so it is not at risk of being forgotten.
    expect(isDueForReview(never, NOW)).toBe(false)
    expect(isDueForReview(learned, NOW)).toBe(true)
    expect(isDueForReview(scheduled, NOW)).toBe(false)
  })

  it('counts the three kinds of question separately', () => {
    const counts = countDueForReview(
      ['a', 'b', 'c', 'd'],
      { a: learned, b: scheduled, c: never },
      NOW,
    )
    expect(counts.due).toBe(1)
    expect(counts.scheduled).toBe(1)
    expect(counts.unseen).toBe(2)
  })

  it('counts a question with no record at all as unseen', () => {
    const counts = countDueForReview(['x'], {}, NOW)
    expect(counts.unseen).toBe(1)
    expect(counts.due).toBe(0)
  })
})
