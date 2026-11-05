import { describe, expect, it } from 'vitest'
import { masteredLessonCount, nextActions } from './guidance'
import { LESSONS } from './lessons'
import { LABS } from './labs'
import { initialProgress, type ProgressState, type QuizAttempt } from '../store/progressState'

function stateWith(overrides: Partial<ProgressState> = {}): ProgressState {
  return { ...initialProgress, ...overrides }
}

/**
 * Activity for every registered laboratory.
 *
 * The lab suggestions are generated from the registry, so a test that means
 * "nothing left to run" has to mean it for the registry as it stands today,
 * not for the handful of ids that happened to exist when this file was
 * written.
 */
function everyLabRun(): ProgressState['labActivity'] {
  return LABS.map((lab) => ({ labId: lab.id, metric: 'run', at: '2026-10-01T00:00:00.000Z' }))
}

function attempt(questionId: string, correct: boolean, daysAgo = 0): QuizAttempt {
  return {
    questionId,
    lessonSlug: LESSONS[0].slug,
    chosen: 0,
    correct,
    // The review queue is derived against the real clock, so the timestamps in
    // this test have to be relative to it rather than hard-coded.
    at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  }
}

describe('next actions', () => {
  it('suggests reading the first lesson to a new student', () => {
    const actions = nextActions(stateWith())
    expect(actions.length).toBeGreaterThan(0)
    expect(actions[0].kind).toBe('lesson')
    expect(actions[0].route).toBe(`/lesson/${LESSONS[0].slug}`)
  })

  it('puts a review first when something is due', () => {
    const first = LESSONS[0]
    const actions = nextActions(stateWith({ quizAttempts: [attempt(first.quiz[0].id, false)] }))
    expect(actions[0].kind).toBe('review')
    expect(actions[0].priority).toBe('high')
  })

  it('suggests finishing a lesson that has been assessed but not completed', () => {
    const first = LESSONS[0]
    const actions = nextActions(stateWith({ quizAttempts: [attempt(first.quiz[0].id, true)] }))
    const finish = actions.find((action) => action.id === `finish:${first.slug}`)
    expect(finish).toBeDefined()
    expect(finish?.kind).toBe('lesson')
  })

  it('suggests ticking the objectives of a completed but not mastered lesson', () => {
    const first = LESSONS[0]
    const actions = nextActions(stateWith({ completedLessons: [first.slug] }))
    const objectives = actions.find((action) => action.id === `objectives:${first.slug}`)
    expect(objectives).toBeDefined()
    expect(objectives?.kind).toBe('objective')
  })

  it('suggests taking the questions of a lesson that was read but never assessed', () => {
    const first = LESSONS[0]
    const actions = nextActions(stateWith({ completedLessons: [first.slug], objectiveChecks: first.objectives.map((_o, i) => `${first.slug}#${i}`) }))
    const assess = actions.find((action) => action.id === `assess:${first.slug}`)
    expect(assess).toBeDefined()
  })

  it('suggests labs that have never been run', () => {
    const actions = nextActions(stateWith())
    expect(actions.some((action) => action.kind === 'lab')).toBe(true)
  })

  it('does not suggest a lab that has already been run', () => {
    const actions = nextActions(stateWith({ labActivity: everyLabRun() }))
    expect(actions.some((action) => action.kind === 'lab')).toBe(false)
  })

  it('respects the limit', () => {
    expect(nextActions(stateWith(), 3)).toHaveLength(3)
  })

  it('always returns at least one action', () => {
    const full: ProgressState = {
      ...initialProgress,
      completedLessons: LESSONS.map((lesson) => lesson.slug),
      objectiveChecks: LESSONS.flatMap((lesson) => lesson.objectives.map((_o, i) => `${lesson.slug}#${i}`)),
      // Answered correctly just now, so each question is scheduled a day out
      // rather than being due.
      quizAttempts: LESSONS.flatMap((lesson) => lesson.quiz.map((question) => attempt(question.id, true, 0))),
      labActivity: everyLabRun(),
    }
    const actions = nextActions(full)
    expect(actions.length).toBeGreaterThan(0)
    expect(actions[0].kind).toBe('course')
    expect(masteredLessonCount(full)).toBe(LESSONS.length)
  })

  it('is deterministic', () => {
    const state = stateWith({ quizAttempts: [attempt(LESSONS[0].quiz[0].id, false)] })
    expect(nextActions(state).map((action) => action.id)).toEqual(nextActions(state).map((action) => action.id))
  })
})
