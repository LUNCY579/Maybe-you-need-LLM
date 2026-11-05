import { describe, expect, it } from 'vitest'
import { retentionSummary } from './retention'
import { initialProgress, type ProgressState, type QuizAttempt } from '../store/progressState'

const NOW = Date.parse('2026-10-20T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function attempt(questionId: string, correct: boolean, daysAgo: number): QuizAttempt {
  return {
    questionId,
    lessonSlug: 'what-agentic-llms-are',
    chosen: 0,
    correct,
    at: new Date(NOW - daysAgo * DAY).toISOString(),
  }
}

function stateWith(attempts: QuizAttempt[]): ProgressState {
  return { ...initialProgress, quizAttempts: attempts }
}

describe('the retention summary', () => {
  it('reports nothing attempted for a new student', () => {
    const summary = retentionSummary(stateWith([]), NOW)
    expect(summary.learned).toBe(0)
    expect(summary.retained).toBe(0)
    expect(summary.due).toBe(0)
    expect(summary.untouched).toBe(summary.total)
    expect(summary.rate).toBe(0)
    expect(summary.summary).toMatch(/nothing attempted/i)
  })

  it('counts a correctly answered question as retained', () => {
    const summary = retentionSummary(stateWith([attempt('q1-1', true, 0)]), NOW)
    expect(summary.learned).toBe(1)
    expect(summary.retained).toBe(1)
    expect(summary.due).toBe(0)
    expect(summary.rate).toBe(1)
  })

  it('counts a wrongly answered question as due and not yet learned', () => {
    const summary = retentionSummary(stateWith([attempt('q1-1', false, 0)]), NOW)
    expect(summary.learned).toBe(0)
    expect(summary.notYetLearned).toBe(1)
    expect(summary.due).toBe(1)
    expect(summary.retained).toBe(0)
  })

  it('calls a question fragile when it was answered correctly but is due again', () => {
    // One correct answer puts it in box 1, which waits a day. Two days later
    // it is due again, even though the student got it right.
    const summary = retentionSummary(stateWith([attempt('q1-1', true, 2)]), NOW)
    expect(summary.learned).toBe(1)
    expect(summary.fragile).toBe(1)
    expect(summary.due).toBe(1)
    expect(summary.retained).toBe(0)
  })

  it('excludes untouched questions from the retention rate', () => {
    const summary = retentionSummary(stateWith([attempt('q1-1', true, 0)]), NOW)
    // One question met, one retained: the rate is 100%, not 1/84.
    expect(summary.rate).toBe(1)
    expect(summary.untouched).toBe(summary.total - 1)
  })

  it('distributes the questions across the review boxes', () => {
    const summary = retentionSummary(
      stateWith([attempt('q1-1', false, 0), attempt('q1-2', true, 0), attempt('q1-3', true, 0)]),
      NOW,
    )
    expect(summary.boxes[0]).toBe(1)
    expect(summary.boxes[1]).toBe(2)
  })

  it('counts a question as consolidated once it has climbed far enough', () => {
    // One question answered correctly five times in a row climbs to the top
    // box; five questions answered once each are all still in box 1.
    const single = Array.from({ length: 5 }, () => attempt('q1-1', true, 0))
    expect(retentionSummary(stateWith(single), NOW).consolidated).toBe(1)

    const spread = Array.from({ length: 5 }, (_, index) => attempt(`q1-${index}`, true, 0))
    expect(retentionSummary(stateWith(spread), NOW).consolidated).toBe(0)
  })
})
