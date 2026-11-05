import { describe, expect, it } from 'vitest'
import {
  PROGRESS_SCHEMA_VERSION,
  PROGRESS_STORAGE_KEY,
  addStudyTime,
  completeLesson,
  createEmptyProgress,
  deletePlaygroundConfig,
  loadProgress,
  mergeProgress,
  parseProgress,
  persistProgress,
  recordQuizAttempt,
  resetLesson,
  sanitizeProgress,
  savePlaygroundConfig,
  serializeProgress,
  setNote,
  summarize,
  toggleBookmark,
  visitLesson,
  type ProgressState,
  type ProgressStorage,
} from './progress'

function memoryStorage(initial: Record<string, string> = {}): ProgressStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

const BEFORE = new Date('2026-01-01T00:00:00.000Z')
const AFTER = new Date('2026-02-01T00:00:00.000Z')

describe('progress serialization', () => {
  it('round-trips through JSON without losing fields', () => {
    let state = createEmptyProgress()
    state = visitLesson(state, 'pretraining-why', BEFORE)
    state = completeLesson(state, 'pretraining-why', BEFORE)
    state = addStudyTime(state, 'pretraining-why', 95)
    state = toggleBookmark(state, 'pretraining-why')
    state = setNote(state, 'pretraining-why', 'Labels come from the text itself.')
    state = recordQuizAttempt(state, {
      questionId: 'q-pretrain-1',
      correct: true,
      answerIndex: 0,
      at: BEFORE.toISOString(),
    })

    const document = JSON.parse(serializeProgress(state)) as Record<string, unknown>
    expect(document.app).toBe('llm-foundations-lab')
    expect(typeof document.exportedAt).toBe('string')

    const { state: parsed, error } = parseProgress(serializeProgress(state))
    expect(error).toBeUndefined()
    expect(parsed.version).toBe(PROGRESS_SCHEMA_VERSION)
    expect(parsed.lessons['pretraining-why']).toMatchObject({
      completed: true,
      secondsSpent: 95,
      completedAt: BEFORE.toISOString(),
    })
    expect(parsed.bookmarks).toEqual(['pretraining-why'])
    expect(parsed.notes['pretraining-why']).toContain('Labels')
    expect(parsed.quizzes).toHaveLength(1)
  })

  it('reports a parse error instead of throwing', () => {
    const { state, error } = parseProgress('{ not json')
    expect(error).toBeTruthy()
    expect(state).toEqual(createEmptyProgress())
  })

  it('never lets a parsed version override the schema version', () => {
    const { state } = parseProgress(JSON.stringify({ version: 99, lessons: {} }))
    expect(state.version).toBe(PROGRESS_SCHEMA_VERSION)
  })

  it('sanitises malformed fields rather than trusting them', () => {
    const state = sanitizeProgress({
      lessons: {
        good: { completed: 'yes', secondsSpent: -50, lastVisitedAt: 7 },
        bad: 'not an object',
      },
      quizzes: [
        { questionId: 'q1', correct: 1, answerIndex: 1.7, at: '2026-01-01' },
        { questionId: '', correct: true },
        'nope',
      ],
      bookmarks: ['a', 'a', '', 3],
      playgroundConfigs: [
        { lab: 'nonsense', name: 'Mine', settings: { temperature: 0.7, label: 'x', flag: true, nested: {} } },
      ],
      notes: { a: 'note', b: 5 },
    })

    expect(state.lessons.good.completed).toBe(false)
    expect(state.lessons.good.secondsSpent).toBe(0)
    expect(state.lessons.good.lastVisitedAt).toBeUndefined()
    expect(state.lessons.bad).toBeUndefined()
    expect(state.quizzes).toHaveLength(1)
    expect(state.quizzes[0]).toMatchObject({ questionId: 'q1', correct: false, answerIndex: 1 })
    expect(state.bookmarks).toEqual(['a'])
    expect(state.playgroundConfigs[0].lab).toBe('transformer')
    expect(state.playgroundConfigs[0].settings).toEqual({ temperature: 0.7, label: 'x', flag: true })
    expect(state.notes).toEqual({ a: 'note' })
  })

  it('ignores non-object input entirely', () => {
    expect(sanitizeProgress(null)).toEqual(createEmptyProgress())
    expect(sanitizeProgress([1, 2, 3])).toEqual(createEmptyProgress())
  })
})

describe('progress mutations', () => {
  it('keeps the first completion time when completing twice', () => {
    const once = completeLesson(createEmptyProgress(), 'l1', BEFORE)
    const twice = completeLesson(once, 'l1', AFTER)
    expect(twice.lessons.l1.completedAt).toBe(BEFORE.toISOString())
    expect(twice.lessons.l1.lastVisitedAt).toBe(AFTER.toISOString())
  })

  it('visiting a lesson does not mark it complete', () => {
    const state = visitLesson(createEmptyProgress(), 'l1', BEFORE)
    expect(state.lessons.l1.completed).toBe(false)
    expect(state.lessons.l1.lastVisitedAt).toBe(BEFORE.toISOString())
  })

  it('resetting a lesson keeps quizzes, notes and bookmarks', () => {
    let state = completeLesson(createEmptyProgress(), 'l1', BEFORE)
    state = setNote(state, 'l1', 'keep me')
    state = toggleBookmark(state, 'l1')
    const reset = resetLesson(state, 'l1')
    expect(reset.lessons.l1).toBeUndefined()
    expect(reset.notes.l1).toBe('keep me')
    expect(reset.bookmarks).toEqual(['l1'])
  })

  it('accumulates study time and rejects nonsense durations', () => {
    let state = addStudyTime(createEmptyProgress(), 'l1', 30)
    state = addStudyTime(state, 'l1', 12.4)
    expect(state.lessons.l1.secondsSpent).toBe(42)
    expect(addStudyTime(state, 'l1', 0)).toBe(state)
    expect(addStudyTime(state, 'l1', -5)).toBe(state)
    expect(addStudyTime(state, 'l1', Number.NaN)).toBe(state)
    expect(addStudyTime(state, 'l1', Number.POSITIVE_INFINITY)).toBe(state)
  })

  it('toggles bookmarks idempotently', () => {
    const on = toggleBookmark(createEmptyProgress(), 'l1')
    expect(on.bookmarks).toEqual(['l1'])
    expect(toggleBookmark(on, 'l1').bookmarks).toEqual([])
  })

  it('replaces a saved configuration with the same id', () => {
    const config = {
      id: 'cfg-1',
      name: 'First',
      lab: 'sampling' as const,
      settings: { temperature: 0.8 },
      savedAt: BEFORE.toISOString(),
    }
    let state = savePlaygroundConfig(createEmptyProgress(), config)
    state = savePlaygroundConfig(state, { ...config, name: 'Second', settings: { temperature: 0.4 } })
    expect(state.playgroundConfigs).toHaveLength(1)
    expect(state.playgroundConfigs[0].name).toBe('Second')
    expect(deletePlaygroundConfig(state, 'cfg-1').playgroundConfigs).toEqual([])
  })
})

describe('summaries', () => {
  it('scores each question by its latest attempt', () => {
    let state = createEmptyProgress()
    state = recordQuizAttempt(state, { questionId: 'q1', correct: false, answerIndex: 2, at: BEFORE.toISOString() })
    state = recordQuizAttempt(state, { questionId: 'q1', correct: true, answerIndex: 0, at: AFTER.toISOString() })
    state = recordQuizAttempt(state, { questionId: 'q2', correct: false, answerIndex: 1, at: AFTER.toISOString() })
    const summary = summarize(state, 18)
    expect(summary.questionsAnswered).toBe(2)
    expect(summary.questionsCorrect).toBe(1)
    expect(summary.accuracy).toBeCloseTo(0.5, 10)
    expect(summary.quizByQuestion).toEqual({ q1: true, q2: false })
  })

  it('clamps completed lessons to the course size and reports study minutes', () => {
    let state = createEmptyProgress()
    state = completeLesson(state, 'a', BEFORE)
    state = completeLesson(state, 'b', BEFORE)
    state = addStudyTime(state, 'a', 150)
    const summary = summarize(state, 1)
    expect(summary.lessonsCompleted).toBe(1)
    expect(summary.lessonsVisited).toBe(2)
    expect(summary.studyMinutes).toBe(3)
    expect(summary.accuracy).toBe(0)
  })
})

describe('storage and merging', () => {
  it('persists and reloads from a storage adapter', () => {
    const storage = memoryStorage()
    let state = completeLesson(createEmptyProgress(), 'l1', BEFORE)
    state = setNote(state, 'l1', 'hello')
    persistProgress(storage, state)

    const reloaded = loadProgress(storage)
    expect(reloaded.lessons.l1.completed).toBe(true)
    expect(reloaded.notes.l1).toBe('hello')
    expect(storage.data[PROGRESS_STORAGE_KEY]).toBeTruthy()
  })

  it('returns empty progress for missing or corrupt storage', () => {
    expect(loadProgress(memoryStorage())).toEqual(createEmptyProgress())
    expect(loadProgress(memoryStorage({ [PROGRESS_STORAGE_KEY]: '<<<' }))).toEqual(createEmptyProgress())
  })

  it('merges an import as a union of activity', () => {
    let current = createEmptyProgress()
    current = visitLesson(current, 'shared', BEFORE)
    current = addStudyTime(current, 'shared', 120)
    current = setNote(current, 'shared', 'local note')
    current = toggleBookmark(current, 'local-only')
    current = recordQuizAttempt(current, { questionId: 'q1', correct: true, answerIndex: 0, at: BEFORE.toISOString() })

    let imported: ProgressState = createEmptyProgress()
    imported = completeLesson(imported, 'shared', AFTER)
    imported = addStudyTime(imported, 'shared', 60)
    imported = setNote(imported, 'shared', 'imported note')
    imported = toggleBookmark(imported, 'imported-only')
    imported = recordQuizAttempt(imported, { questionId: 'q1', correct: false, answerIndex: 1, at: BEFORE.toISOString() })
    imported = recordQuizAttempt(imported, { questionId: 'q2', correct: true, answerIndex: 0, at: AFTER.toISOString() })
    imported = savePlaygroundConfig(imported, {
      id: 'cfg',
      name: 'Imported',
      lab: 'learning',
      settings: { learningRate: 0.1 },
      savedAt: AFTER.toISOString(),
    })

    const merged = mergeProgress(current, imported)

    // Union of lessons, longest measured time, and the imported completion survives.
    expect(merged.lessons.shared.completed).toBe(true)
    expect(merged.lessons.shared.completedAt).toBe(AFTER.toISOString())
    expect(merged.lessons.shared.secondsSpent).toBe(120)
    // Notes are the learner's: the current document wins.
    expect(merged.notes.shared).toBe('local note')
    expect(merged.bookmarks.sort()).toEqual(['imported-only', 'local-only'])
    // The same attempt (same question and timestamp) is not duplicated.
    expect(merged.quizzes).toHaveLength(2)
    expect(merged.quizzes.map((a) => a.questionId).sort()).toEqual(['q1', 'q2'])
    expect(merged.playgroundConfigs.map((c) => c.id)).toEqual(['cfg'])
    expect(merged.version).toBe(PROGRESS_SCHEMA_VERSION)
  })

  it('does not mutate either input while merging', () => {
    const current = completeLesson(createEmptyProgress(), 'l1', BEFORE)
    const imported = completeLesson(createEmptyProgress(), 'l2', AFTER)
    const currentSnapshot = JSON.stringify(current)
    const importedSnapshot = JSON.stringify(imported)
    mergeProgress(current, imported)
    expect(JSON.stringify(current)).toBe(currentSnapshot)
    expect(JSON.stringify(imported)).toBe(importedSnapshot)
  })
})
