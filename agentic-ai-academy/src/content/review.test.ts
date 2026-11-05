import { describe, expect, it } from 'vitest'
import { buildReviewQueue, lessonMastery, reviewSummary } from './review'
import { LESSONS } from './lessons'
import { initialProgress, type ProgressState, type QuizAttempt } from '../store/progressState'

const NOW = Date.parse('2026-10-20T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function attempt(questionId: string, correct: boolean, daysAgo: number): QuizAttempt {
  return {
    questionId,
    lessonSlug: 'what-agentic-llms-are',
    chosen: correct ? 0 : 1,
    correct,
    at: new Date(NOW - daysAgo * DAY).toISOString(),
  }
}

function stateWith(attempts: QuizAttempt[], overrides: Partial<ProgressState> = {}): ProgressState {
  return { ...initialProgress, quizAttempts: attempts, ...overrides }
}

const first = LESSONS[0]
const q1 = first.quiz[0].id
const q2 = first.quiz[1].id
const q3 = first.quiz[2].id

describe('review queue', () => {
  it('is empty for a student who has not answered anything', () => {
    const summary = reviewSummary(stateWith([]), NOW)
    expect(summary.due).toBe(0)
    expect(summary.items).toEqual([])
  })

  it('holds a question whose latest attempt was wrong', () => {
    const summary = reviewSummary(stateWith([attempt(q1, false, 3)]), NOW)
    expect(summary.due).toBe(1)
    expect(summary.items[0].question.id).toBe(q1)
    expect(summary.items[0].daysSince).toBe(3)
  })

  it('drops a question once it is answered correctly', () => {
    // Answered correctly just now: it moves to box 1 and waits a day, so it
    // is no longer due.
    const state = stateWith([attempt(q1, false, 0), attempt(q1, true, 0)])
    expect(reviewSummary(state, NOW).due).toBe(0)
    // But it is still counted as one the student has missed at some point.
    expect(reviewSummary(state, NOW).everMissed).toBe(1)
    expect(reviewSummary(state, NOW).everCorrect).toBe(1)
  })

  it('puts the question back if it is answered wrongly again', () => {
    const state = stateWith([attempt(q1, false, 5), attempt(q1, true, 4), attempt(q1, false, 1)])
    const summary = reviewSummary(state, NOW)
    expect(summary.due).toBe(1)
    expect(summary.items[0].misses).toBe(2)
    expect(summary.items[0].attempts).toBe(3)
  })

  it('orders the most overdue question first', () => {
    const state = stateWith([attempt(q1, false, 1), attempt(q2, false, 9), attempt(q3, false, 4)])
    const items = buildReviewQueue(state, NOW)
    expect(items.map((item) => item.question.id)).toEqual([q2, q3, q1])
    expect(summary_oldest(state, NOW)).toBe(q2)
  })

  it('counts how many lessons are affected', () => {
    const state = stateWith([attempt(q1, false, 2), attempt(q2, false, 5)])
    expect(reviewSummary(state, NOW).affectedLessons).toBe(1)
  })

  it('ignores attempts at questions that no longer exist', () => {
    const state = stateWith([attempt('q-does-not-exist', false, 2)])
    expect(reviewSummary(state, NOW).due).toBe(0)
  })

  it('is deterministic', () => {
    const state = stateWith([attempt(q1, false, 3), attempt(q2, false, 3)])
    expect(buildReviewQueue(state, NOW)).toEqual(buildReviewQueue(state, NOW))
  })
})

function summary_oldest(state: ProgressState, now: number) {
  return reviewSummary(state, now).oldest?.question.id
}

describe('lesson mastery', () => {
  it('is not mastered for a fresh student', () => {
    const mastery = lessonMastery(first.slug, stateWith([]))
    expect(mastery.mastered).toBe(false)
    expect(mastery.objectivesTotal).toBe(first.objectives.length)
  })

  it('requires both the objectives and the questions', () => {
    const objectiveChecks = first.objectives.map((_objective, index) => `${first.slug}#${index}`)
    const withObjectives = stateWith([], { objectiveChecks })

    // Objectives ticked, no questions answered: still not mastered.
    expect(lessonMastery(first.slug, withObjectives).mastered).toBe(false)

    const withBoth = stateWith(
      [...first.quiz].map((question) => attempt(question.id, true, 1)),
      { objectiveChecks },
    )
    expect(lessonMastery(first.slug, withBoth).mastered).toBe(true)
  })

  it('does not require the optional advanced questions', () => {
    const objectiveChecks = first.objectives.map((_objective, index) => `${first.slug}#${index}`)
    const coreOnly = stateWith(
      [...first.quiz].map((question) => attempt(question.id, true, 1)),
      { objectiveChecks },
    )
    const mastery = lessonMastery(first.slug, coreOnly)
    expect(mastery.questionsTotal).toBe(first.quiz.length)
    expect(mastery.mastered).toBe(true)
  })

  it('counts the objectives that are ticked', () => {
    const state = stateWith([], { objectiveChecks: [`${first.slug}#0`, `${first.slug}#2`] })
    const mastery = lessonMastery(first.slug, state)
    expect(mastery.objectivesChecked).toBe(2)
  })

  it('handles an unknown lesson gracefully', () => {
    const mastery = lessonMastery('not-a-lesson', stateWith([]))
    expect(mastery.mastered).toBe(false)
    expect(mastery.objectivesTotal).toBe(0)
  })
})
