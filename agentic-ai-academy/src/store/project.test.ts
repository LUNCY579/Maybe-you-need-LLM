import { describe, expect, it } from 'vitest'
import { RUBRIC, RUBRIC_MAX_POINTS } from '../content/project'
import { deriveReadiness, initialProject, parseProject, serializeProject } from './project'
import type { ProgressApi } from './progressState'

function makeProgress(overrides: Partial<ProgressApi['state']> = {}): ProgressApi {
  const state = {
    version: 1 as const,
    completedLessons: [],
    bookmarks: [],
    quizAttempts: [],
    labActivity: [],
    difficultyOverrides: {},
    objectiveChecks: [],
    lastLessonSlug: null,
    updatedAt: null,
    ...overrides,
  }
  return {
    state,
    lastLessonSlug: state.lastLessonSlug,
    completedCount: state.completedLessons.length,
    totalLessons: 12,
    completionRatio: state.completedLessons.length / 12,
    quizAccuracy: 0,
    answeredQuestionIds: [],
    correctQuestionIds: [],
    isCompleted: () => false,
    isBookmarked: () => false,
    difficultyFor: (_slug, fallback) => fallback,
    isObjectiveChecked: () => false,
    objectivesChecked: () => 0,
    completeLesson: () => {},
    uncompleteLesson: () => {},
    toggleBookmark: () => {},
    recordAttempt: () => {},
    recordLab: () => {},
    setDifficulty: () => {},
    toggleObjective: () => {},
    visitLesson: () => {},
    importProgress: () => {},
    resetProgress: () => {},
  }
}

const MILESTONES = ['m1', 'm2', 'm3', 'm4', 'm5']

describe('project state', () => {
  it('parses an empty payload into the initial state', () => {
    expect(parseProject(null)).toEqual(initialProject)
    expect(parseProject('not json')).toEqual(initialProject)
  })

  it('round-trips through serialize and parse', () => {
    const state = { ...initialProject, taskName: 'A retrieval agent', checklist: { m1: true }, notes: { '0': 'done' }, rubric: { measurement: 3 } }
    expect(parseProject(serializeProject(state))).toEqual(state)
  })

  it('drops rubric scores that are out of range', () => {
    const parsed = parseProject(JSON.stringify({ rubric: { measurement: 99, honesty: -5, harness: 2 } }))
    expect(parsed.rubric.measurement).toBe(RUBRIC.find((c) => c.id === 'measurement')?.maxPoints)
    expect(parsed.rubric.honesty).toBe(0)
    expect(parsed.rubric.harness).toBe(2)
  })

  it('ignores non-boolean checklist entries and non-string notes', () => {
    const parsed = parseProject(JSON.stringify({ checklist: { m1: true, m2: 'yes' }, notes: { '0': 'ok', '1': 42 } }))
    expect(parsed.checklist).toEqual({ m1: true })
    expect(parsed.notes).toEqual({ '0': 'ok' })
  })
})

describe('readiness report', () => {
  it('reports a not-started project', () => {
    const report = deriveReadiness({ project: initialProject, progress: makeProgress(), milestoneIds: MILESTONES })
    expect(report.verdict).toBe('not-started')
    expect(report.awarded).toBe(0)
    expect(report.max).toBe(RUBRIC_MAX_POINTS)
    expect(report.evidenceRatio).toBe(0)
  })

  it('reports an in-progress project once there is activity', () => {
    const report = deriveReadiness({
      project: { ...initialProject, checklist: { m1: true } },
      progress: makeProgress(),
      milestoneIds: MILESTONES,
    })
    expect(report.verdict).toBe('in-progress')
    expect(report.milestonesDone).toBe(1)
  })

  it('marks criteria as evidenced from real course activity', () => {
    const progress = makeProgress({
      labActivity: [
        { labId: 'workflow-builder', metric: 'run', at: '2026-01-01T00:00:00.000Z' },
        { labId: 'planning', metric: 'run', at: '2026-01-01T00:00:00.000Z' },
        { labId: 'memory', metric: 'run', at: '2026-01-01T00:00:00.000Z' },
        { labId: 'world-model', metric: 'run', at: '2026-01-01T00:00:00.000Z' },
      ],
    })
    const report = deriveReadiness({ project: initialProject, progress, milestoneIds: MILESTONES })
    const byId = new Map(report.criteria.map((entry) => [entry.criterion.id, entry]))
    expect(byId.get('measurement')?.evidenced).toBe(true)
    expect(byId.get('harness')?.evidenced).toBe(true)
    expect(byId.get('safety')?.evidenced).toBe(true)
    expect(byId.get('traceability')?.evidenced).toBe(false)
  })

  it('reaches submitted only when every milestone is done and points are awarded', () => {
    const project = {
      ...initialProject,
      checklist: Object.fromEntries(MILESTONES.map((id) => [id, true])),
      rubric: { measurement: 2 },
    }
    const report = deriveReadiness({ project, progress: makeProgress(), milestoneIds: MILESTONES })
    expect(report.verdict).toBe('submitted')
    expect(report.awarded).toBe(2)
    expect(report.milestonesDone).toBe(MILESTONES.length)
  })

  it('awards no points on its own', () => {
    const progress = makeProgress({
      labActivity: MILESTONES.map((id) => ({ labId: id, metric: 'run', at: '2026-01-01T00:00:00.000Z' })),
    })
    const report = deriveReadiness({ project: initialProject, progress, milestoneIds: MILESTONES })
    expect(report.awarded).toBe(0)
  })

  it('covers every rubric criterion exactly once', () => {
    const report = deriveReadiness({ project: initialProject, progress: makeProgress(), milestoneIds: MILESTONES })
    expect(report.criteria).toHaveLength(RUBRIC.length)
    expect(report.criteria.map((entry) => entry.criterion.id)).toEqual(RUBRIC.map((criterion) => criterion.id))
  })
})
