import { describe, expect, it } from 'vitest'
import { LEITNER_INTERVALS_DAYS, MAX_BOX, boxFor, describeBox, groupAttempts, nextReviewAt, scheduleFor } from './spacing'
import type { QuizAttempt } from '../store/progressState'

const NOW = Date.parse('2026-10-20T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function attempt(correct: boolean, daysAgo: number, id = 'q1'): QuizAttempt {
  return {
    questionId: id,
    lessonSlug: 'what-agentic-llms-are',
    chosen: 0,
    correct,
    at: new Date(NOW - daysAgo * DAY).toISOString(),
  }
}

describe('the Leitner scheduler', () => {
  it('uses the classic interval schedule', () => {
    expect([...LEITNER_INTERVALS_DAYS]).toEqual([0, 1, 3, 7, 14, 30])
  })

  it('puts a wrongly answered question in box zero, due immediately', () => {
    const schedule = scheduleFor([attempt(false, 0)], NOW)!
    expect(schedule.box).toBe(0)
    expect(schedule.due).toBe(true)
    expect(schedule.streak).toBe(0)
  })

  it('promotes a question that was answered correctly', () => {
    const schedule = scheduleFor([attempt(true, 0)], NOW)!
    expect(schedule.box).toBe(1)
    expect(schedule.streak).toBe(1)
  })

  it('waits a day after the first correct answer', () => {
    const schedule = scheduleFor([attempt(true, 0)], NOW)!
    expect(schedule.daysUntilDue).toBe(1)
    expect(schedule.due).toBe(false)
  })

  it('waits longer as the streak grows', () => {
    const one = scheduleFor([attempt(true, 0)], NOW)!
    const two = scheduleFor([attempt(true, 0), attempt(true, 0, 'q1')], NOW)!
    const three = scheduleFor([attempt(true, 0), attempt(true, 0, 'q1'), attempt(true, 0, 'q1')], NOW)!
    expect(two.daysUntilDue).toBeGreaterThan(one.daysUntilDue)
    expect(three.daysUntilDue).toBeGreaterThan(two.daysUntilDue)
  })

  it('caps the box so the interval cannot grow without bound', () => {
    const many = Array.from({ length: 20 }, () => attempt(true, 0, 'q1'))
    const schedule = scheduleFor(many, NOW)!
    expect(schedule.box).toBe(MAX_BOX)
    expect(schedule.daysUntilDue).toBe(LEITNER_INTERVALS_DAYS[MAX_BOX])
  })

  it('drops back to box zero when the streak is broken', () => {
    const schedule = scheduleFor([attempt(true, 5, 'q1'), attempt(true, 4, 'q1'), attempt(false, 1, 'q1')], NOW)!
    expect(schedule.box).toBe(0)
    expect(schedule.due).toBe(true)
    expect(schedule.streak).toBe(0)
  })

  it('becomes due again once the interval has elapsed', () => {
    // One correct answer puts it in box 1, which waits a day.
    const schedule = scheduleFor([attempt(true, 2)], NOW)!
    expect(schedule.due).toBe(true)
  })

  it('is not due before the interval has elapsed', () => {
    const schedule = scheduleFor([attempt(true, 0)], NOW)!
    expect(schedule.due).toBe(false)
  })

  it('returns nothing for a question that has never been attempted', () => {
    expect(scheduleFor([], NOW)).toBeNull()
    expect(boxFor([], NOW)).toBeNull()
    expect(nextReviewAt([], NOW)).toBeNull()
  })

  it('groups attempts by question, keeping their order', () => {
    const grouped = groupAttempts([attempt(true, 3, 'a'), attempt(false, 1, 'b'), attempt(true, 2, 'a')])
    expect(grouped.size).toBe(2)
    expect(grouped.get('a')).toHaveLength(2)
    expect(grouped.get('a')![0].at < grouped.get('a')![1].at).toBe(true)
  })

  it('describes a box in words', () => {
    expect(describeBox(0)).toBe('needs work')
    expect(describeBox(MAX_BOX)).toBe('well known')
    expect(describeBox(2)).toContain('box 2')
  })

  it('ignores an attempt with an unparseable timestamp', () => {
    const broken = { ...attempt(true, 0), at: 'not a date' }
    expect(scheduleFor([broken], NOW)).toBeNull()
  })
})
