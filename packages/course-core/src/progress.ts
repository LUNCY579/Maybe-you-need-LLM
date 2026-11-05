/**
 * The progress record shared by every course application.
 *
 * A learner's state is deliberately small and portable: which lessons are
 * complete, which quiz questions were answered correctly, how much time was
 * spent, and what was bookmarked. It exports to JSON so a learner can move
 * between machines, and it imports back with validation, so a corrupted file
 * cannot break the application.
 */

import { createStore } from './storage.js'
import type { Store } from './storage.js'

export const PROGRESS_SCHEMA_VERSION = 1

export interface QuizAnswerRecord {
  /** Whether the answer was correct the first time it was given. */
  correct: boolean
  /** How many attempts the learner needed. */
  attempts: number
  /** Epoch milliseconds of the last attempt. */
  lastAttempt: number
}

export interface LessonRecord {
  complete: boolean
  /** Accumulated study time in seconds. */
  seconds: number
  lastVisited: number
  bookmarked: boolean
}

export interface ProgressRecord {
  /** Per-lesson state, keyed by lesson id. */
  lessons: Record<string, LessonRecord>
  /** Per-question state, keyed by question id. */
  quiz: Record<string, QuizAnswerRecord>
  /** Ids of glossary terms the learner marked as known. */
  knownTerms: string[]
  /** The learner's chosen difficulty track per lesson, where one exists. */
  tracks: Record<string, string>
  /** Arbitrary per-lesson flags used by individual courses. */
  flags: Record<string, string>
}

export function emptyProgress(): ProgressRecord {
  return { lessons: {}, quiz: {}, knownTerms: [], tracks: {}, flags: {} }
}

export interface ProgressStore extends Store<ProgressRecord> {
  markLessonComplete(lessonId: string, seconds: number): ProgressRecord
  addStudyTime(lessonId: string, seconds: number): ProgressRecord
  setBookmark(lessonId: string, bookmarked: boolean): ProgressRecord
  recordQuizAnswer(questionId: string, correct: boolean): ProgressRecord
  setTrack(lessonId: string, track: string): ProgressRecord
  toggleKnownTerm(termId: string): ProgressRecord
  setFlag(key: string, value: string): ProgressRecord
  reset(): void
}

export interface ProgressStoreOptions {
  key: string
  version?: number
  onChange?: (record: ProgressRecord) => void
}

/**
 * Create the progress store used by a course.
 *
 * The store keeps an in-memory copy and writes through on every mutation, so
 * a page reload restores the learner's place even if the tab was closed
 * without a clean shutdown.
 */
export function createProgressStore(options: ProgressStoreOptions): ProgressStore {
  const version = options.version ?? PROGRESS_SCHEMA_VERSION
  const base = createStore<ProgressRecord>({
    key: options.key,
    version,
    initial: emptyProgress(),
    merge: (existing) => {
      const record = existing as Partial<ProgressRecord> | null
      if (!record || typeof record !== 'object') return emptyProgress()
      return {
        lessons: record.lessons ?? {},
        quiz: record.quiz ?? {},
        knownTerms: record.knownTerms ?? [],
        tracks: record.tracks ?? {},
        flags: record.flags ?? {},
      }
    },
  })

  let current = base.load()

  const commit = (next: ProgressRecord): ProgressRecord => {
    current = next
    base.save(next)
    options.onChange?.(next)
    return next
  }

  const withLesson = (lessonId: string, update: (lesson: LessonRecord) => LessonRecord): ProgressRecord => {
    const existing: LessonRecord = current.lessons[lessonId] ?? {
      complete: false,
      seconds: 0,
      lastVisited: 0,
      bookmarked: false,
    }
    return commit({
      ...current,
      lessons: { ...current.lessons, [lessonId]: update(existing) },
    })
  }

  return {
    load: () => current,
    persistent: base.persistent,
    save: (value) => {
      current = value
      const ok = base.save(value)
      options.onChange?.(value)
      return ok
    },
    clear: () => {
      current = emptyProgress()
      base.clear()
      options.onChange?.(current)
    },
    reset: () => {
      current = emptyProgress()
      base.clear()
      options.onChange?.(current)
    },
    markLessonComplete: (lessonId, seconds) =>
      withLesson(lessonId, (lesson) => ({
        ...lesson,
        complete: true,
        seconds: lesson.seconds + Math.max(0, seconds),
        lastVisited: Date.now(),
      })),
    addStudyTime: (lessonId, seconds) =>
      withLesson(lessonId, (lesson) => ({
        ...lesson,
        seconds: lesson.seconds + Math.max(0, seconds),
        lastVisited: Date.now(),
      })),
    setBookmark: (lessonId, bookmarked) =>
      withLesson(lessonId, (lesson) => ({ ...lesson, bookmarked, lastVisited: Date.now() })),
    recordQuizAnswer: (questionId, correct) => {
      const existing = current.quiz[questionId]
      const record: QuizAnswerRecord = {
        correct: correct || existing?.correct === true,
        attempts: (existing?.attempts ?? 0) + 1,
        lastAttempt: Date.now(),
      }
      return commit({ ...current, quiz: { ...current.quiz, [questionId]: record } })
    },
    setTrack: (lessonId, track) => commit({ ...current, tracks: { ...current.tracks, [lessonId]: track } }),
    toggleKnownTerm: (termId) => {
      const known = current.knownTerms.includes(termId)
      const next = known
        ? current.knownTerms.filter((t) => t !== termId)
        : [...current.knownTerms, termId]
      return commit({ ...current, knownTerms: next })
    },
    setFlag: (key, value) => commit({ ...current, flags: { ...current.flags, [key]: value } }),
  }
}

/* ------------------------------------------------------------------ summaries */

export interface ModuleCompletion {
  moduleId: string
  total: number
  complete: number
  fraction: number
  seconds: number
}

export interface ProgressSummary {
  modules: ModuleCompletion[]
  lessonsComplete: number
  lessonsTotal: number
  quizAnswered: number
  quizCorrect: number
  quizAccuracy: number
  totalSeconds: number
  bookmarks: string[]
}

export function summariseProgress(
  record: ProgressRecord,
  moduleLessonIds: Record<string, string[]>,
): ProgressSummary {
  const modules: ModuleCompletion[] = Object.entries(moduleLessonIds).map(([moduleId, lessonIds]) => {
    let complete = 0
    let seconds = 0
    for (const id of lessonIds) {
      const lesson = record.lessons[id]
      if (!lesson) continue
      if (lesson.complete) complete++
      seconds += lesson.seconds
    }
    return {
      moduleId,
      total: lessonIds.length,
      complete,
      fraction: lessonIds.length === 0 ? 0 : complete / lessonIds.length,
      seconds,
    }
  })

  const quizValues = Object.values(record.quiz)
  const quizCorrect = quizValues.filter((q) => q.correct).length

  const lessonsTotal = Object.values(moduleLessonIds).reduce((acc, ids) => acc + ids.length, 0)
  const lessonsComplete = modules.reduce((acc, m) => acc + m.complete, 0)

  return {
    modules,
    lessonsComplete,
    lessonsTotal,
    quizAnswered: quizValues.length,
    quizCorrect,
    quizAccuracy: quizValues.length === 0 ? 0 : quizCorrect / quizValues.length,
    totalSeconds: modules.reduce((acc, m) => acc + m.seconds, 0),
    bookmarks: Object.entries(record.lessons)
      .filter(([, lesson]) => lesson.bookmarked)
      .map(([id]) => id)
      .sort(),
  }
}

/* ----------------------------------------------------------------- import/export */

export interface ProgressExport {
  kind: 'llm-materials-progress'
  version: number
  exportedAt: string
  record: ProgressRecord
}

export function exportProgress(record: ProgressRecord, version = PROGRESS_SCHEMA_VERSION): ProgressExport {
  return {
    kind: 'llm-materials-progress',
    version,
    exportedAt: new Date().toISOString(),
    record,
  }
}

/**
 * Import an exported progress file.
 *
 * Returns `null` for anything that is not a recognisable progress export, so
 * a caller can show a clear error rather than half-applying a bad file.
 */
export function importProgress(input: unknown): ProgressRecord | null {
  if (typeof input !== 'object' || input === null) return null
  const file = input as Partial<ProgressExport>
  if (file.kind !== 'llm-materials-progress') return null
  const record = file.record as Partial<ProgressRecord> | undefined
  if (!record || typeof record !== 'object') return null
  return {
    lessons: record.lessons ?? {},
    quiz: record.quiz ?? {},
    knownTerms: Array.isArray(record.knownTerms) ? record.knownTerms : [],
    tracks: record.tracks ?? {},
    flags: record.flags ?? {},
  }
}
