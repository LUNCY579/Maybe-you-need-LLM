/**
 * Student progress model: local-only, JSON-serialisable, validated on import.
 *
 * Nothing here talks to a server. Progress lives in localStorage and can be
 * exported/imported as a JSON document so a learner can move between machines.
 */

import {
  MINIMUM_EASE,
  initialReviewState,
  parseReviewState,
  type ReviewState,
} from './spacedRepetition'

export const PROGRESS_SCHEMA_VERSION = 3
export const PROGRESS_STORAGE_KEY = 'llm-foundations-lab:progress'

export interface QuizAttempt {
  questionId: string
  correct: boolean
  /** Answer index chosen by the learner. */
  answerIndex: number
  /** ISO-8601 timestamp of the attempt. */
  at: string
}

export interface LessonProgress {
  lessonId: string
  completed: boolean
  completedAt?: string
  /** Seconds spent on the lesson (approximate; measured while the page is open). */
  secondsSpent: number
  lastVisitedAt?: string
}

export interface SavedPlaygroundConfig {
  id: string
  name: string
  /** Which experiment the configuration belongs to. */
  lab: 'transformer' | 'tokenizer' | 'sampling' | 'learning' | 'alignment' | 'inference' | 'prompt'
  /** Arbitrary, lab-specific settings; kept as a flat record for portability. */
  settings: Record<string, number | string | boolean>
  savedAt: string
}

export interface ProgressState {
  version: number
  lessons: Record<string, LessonProgress>
  quizzes: QuizAttempt[]
  bookmarks: string[]
  playgroundConfigs: SavedPlaygroundConfig[]
  /** Free-form notes keyed by lesson id. */
  notes: Record<string, string>
  /** Spaced-repetition state per question id, for the review schedule. */
  reviews: Record<string, ReviewState>
  /**
   * The reader's own answer to each lesson's self-explanation prompt, and how
   * they said it went. It is kept in the progress file so that a note in the
   * reader's own words is still there when they come back.
   */
  explanations: Record<string, ExplanationRecord>
}

/** What the reader said about their own explanation. */
export type ExplanationRating = 'yes' | 'partly' | 'not-yet'

export interface ExplanationRecord {
  /** The reader's own words. */
  answer: string
  /** How the reader said it went. */
  rating: ExplanationRating | null
  /** Whether the reader has already been shown the model answer. */
  revealed: boolean
  /** When the record was written. */
  at: string
}

export function createEmptyProgress(): ProgressState {
  return {
    version: PROGRESS_SCHEMA_VERSION,
    lessons: {},
    quizzes: [],
    bookmarks: [],
    playgroundConfigs: [],
    notes: {},
    reviews: {},
    explanations: {},
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Validate and normalise an arbitrary parsed JSON value into a ProgressState. */
export function sanitizeProgress(input: unknown): ProgressState {
  const state = createEmptyProgress()
  if (!isRecord(input)) return state
  state.version = PROGRESS_SCHEMA_VERSION

  if (isRecord(input.explanations)) {
    for (const [lessonId, raw] of Object.entries(input.explanations)) {
      if (!isRecord(raw)) continue
      const rating = raw.rating
      state.explanations[lessonId] = {
        answer: typeof raw.answer === 'string' ? raw.answer : '',
        rating:
          rating === 'yes' || rating === 'partly' || rating === 'not-yet' ? rating : null,
        revealed: raw.revealed === true,
        at: typeof raw.at === 'string' ? raw.at : '',
      }
    }
  }

  if (isRecord(input.reviews)) {
    for (const [questionId, raw] of Object.entries(input.reviews)) {
      const parsed = parseReviewState(raw)
      if (parsed) state.reviews[questionId] = parsed
    }
  }

  if (isRecord(input.lessons)) {
    for (const [lessonId, raw] of Object.entries(input.lessons)) {
      if (!isRecord(raw)) continue
      state.lessons[lessonId] = {
        lessonId,
        completed: asBoolean(raw.completed),
        completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : undefined,
        secondsSpent: Math.max(0, asNumber(raw.secondsSpent)),
        lastVisitedAt: typeof raw.lastVisitedAt === 'string' ? raw.lastVisitedAt : undefined,
      }
    }
  }

  if (Array.isArray(input.quizzes)) {
    state.quizzes = input.quizzes
      .filter(isRecord)
      .map((raw) => ({
        questionId: asString(raw.questionId),
        correct: asBoolean(raw.correct),
        answerIndex: Math.trunc(asNumber(raw.answerIndex, -1)),
        at: asString(raw.at, new Date(0).toISOString()),
      }))
      .filter((attempt) => attempt.questionId.length > 0)
  }

  if (Array.isArray(input.bookmarks)) {
    state.bookmarks = Array.from(
      new Set(input.bookmarks.filter((v): v is string => typeof v === 'string' && v.length > 0)),
    )
  }

  if (Array.isArray(input.playgroundConfigs)) {
    state.playgroundConfigs = input.playgroundConfigs
      .filter(isRecord)
      .map((raw) => ({
        id: asString(raw.id, `imported-${Math.random().toString(36).slice(2, 8)}`),
        name: asString(raw.name, 'Imported configuration'),
        lab: ([
          'transformer',
          'tokenizer',
          'sampling',
          'learning',
          'alignment',
          'inference',
          'prompt',
        ] as const).includes(raw.lab as never)
          ? (raw.lab as SavedPlaygroundConfig['lab'])
          : 'transformer',
        settings: isRecord(raw.settings)
          ? (Object.fromEntries(
              Object.entries(raw.settings).filter(([, v]) =>
                ['number', 'string', 'boolean'].includes(typeof v),
              ),
            ) as Record<string, number | string | boolean>)
          : {},
        savedAt: asString(raw.savedAt, new Date(0).toISOString()),
      }))
  }

  if (isRecord(input.notes)) {
    for (const [lessonId, note] of Object.entries(input.notes)) {
      if (typeof note === 'string') state.notes[lessonId] = note
    }
  }

  return state
}

/**
 * Parse a JSON document (exported progress) into a sanitized state.
 *
 * A document written by a *newer* version of the course is read as far as
 * this version understands it, and the fact is reported rather than hidden.
 * The fields this version does not know about are dropped, which is the only
 * thing it can do, but a reader whose file came from a later build should be
 * told that part of it was not read rather than finding out later.
 */
export function parseProgress(json: string): {
  state: ProgressState
  error?: string
  /** The version the document was written by, when it is newer than this one. */
  newerVersion?: number
} {
  try {
    const parsed: unknown = JSON.parse(json)
    const written = isRecord(parsed) && typeof parsed.version === 'number' ? parsed.version : null
    return {
      state: sanitizeProgress(parsed),
      newerVersion:
        written !== null && written > PROGRESS_SCHEMA_VERSION ? written : undefined,
    }
  } catch (error) {
    return {
      state: createEmptyProgress(),
      error: error instanceof Error ? error.message : 'unknown JSON error',
    }
  }
}

/** Serialise progress exactly as exported to a file. */
export function serializeProgress(state: ProgressState): string {
  return JSON.stringify(
    {
      ...sanitizeProgress(state),
      exportedAt: new Date().toISOString(),
      app: 'llm-foundations-lab',
    },
    null,
    2,
  )
}

export function completeLesson(state: ProgressState, lessonId: string, at = new Date()): ProgressState {
  const existing = state.lessons[lessonId]
  return {
    ...state,
    lessons: {
      ...state.lessons,
      [lessonId]: {
        lessonId,
        completed: true,
        completedAt: existing?.completedAt ?? at.toISOString(),
        secondsSpent: existing?.secondsSpent ?? 0,
        lastVisitedAt: at.toISOString(),
      },
    },
  }
}

export function resetLesson(state: ProgressState, lessonId: string): ProgressState {
  const lessons = { ...state.lessons }
  delete lessons[lessonId]
  return { ...state, lessons }
}

export function visitLesson(state: ProgressState, lessonId: string, at = new Date()): ProgressState {
  const existing = state.lessons[lessonId]
  return {
    ...state,
    lessons: {
      ...state.lessons,
      [lessonId]: {
        lessonId,
        completed: existing?.completed ?? false,
        completedAt: existing?.completedAt,
        secondsSpent: existing?.secondsSpent ?? 0,
        lastVisitedAt: at.toISOString(),
      },
    },
  }
}

export function addStudyTime(state: ProgressState, lessonId: string, seconds: number): ProgressState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state
  const existing = state.lessons[lessonId] ?? {
    lessonId,
    completed: false,
    secondsSpent: 0,
  }
  return {
    ...state,
    lessons: {
      ...state.lessons,
      [lessonId]: { ...existing, secondsSpent: existing.secondsSpent + Math.round(seconds) },
    },
  }
}

export function toggleBookmark(state: ProgressState, lessonId: string): ProgressState {
  const has = state.bookmarks.includes(lessonId)
  return {
    ...state,
    bookmarks: has ? state.bookmarks.filter((id) => id !== lessonId) : [...state.bookmarks, lessonId],
  }
}

export function recordQuizAttempt(state: ProgressState, attempt: QuizAttempt): ProgressState {
  return { ...state, quizzes: [...state.quizzes, attempt] }
}

/**
 * Record the spaced-repetition state of a question.
 *
 * A question that has never been reviewed gets a fresh state, so every
 * question in the bank is reviewable from the start.
 */
export function recordReview(
  state: ProgressState,
  questionId: string,
  review: ReviewState,
): ProgressState {
  return {
    ...state,
    reviews: { ...state.reviews, [questionId]: { ...review, easeFactor: Math.max(MINIMUM_EASE, review.easeFactor) } },
  }
}

/**
 * Record the reader's explanation of a lesson.
 *
 * The rating is the reader's own calibration rather than a score, and it is
 * used to decide what to suggest next.
 */
export function recordExplanation(
  state: ProgressState,
  lessonId: string,
  record: { answer: string; rating: ExplanationRating | null; revealed: boolean },
): ProgressState {
  return {
    ...state,
    explanations: {
      ...state.explanations,
      [lessonId]: {
        answer: record.answer,
        rating: record.rating,
        revealed: record.revealed,
        at: new Date().toISOString(),
      },
    },
  }
}

/** The spaced-repetition state of a question, or a fresh one. */
export function reviewStateFor(state: ProgressState, questionId: string): ReviewState {
  return state.reviews[questionId] ?? initialReviewState()
}

export function savePlaygroundConfig(
  state: ProgressState,
  config: SavedPlaygroundConfig,
): ProgressState {
  const others = state.playgroundConfigs.filter((c) => c.id !== config.id)
  return { ...state, playgroundConfigs: [...others, config] }
}

export function deletePlaygroundConfig(state: ProgressState, id: string): ProgressState {
  return { ...state, playgroundConfigs: state.playgroundConfigs.filter((c) => c.id !== id) }
}

export function setNote(state: ProgressState, lessonId: string, note: string): ProgressState {
  return { ...state, notes: { ...state.notes, [lessonId]: note } }
}

export interface ProgressSummary {
  lessonsCompleted: number
  lessonsVisited: number
  questionsAnswered: number
  questionsCorrect: number
  accuracy: number
  bookmarks: number
  studyMinutes: number
  /** Per-lesson best (latest) quiz outcome. */
  quizByQuestion: Record<string, boolean>
}

export function summarize(state: ProgressState, totalLessons?: number): ProgressSummary {
  const quizByQuestion: Record<string, boolean> = {}
  for (const attempt of state.quizzes) quizByQuestion[attempt.questionId] = attempt.correct
  const answered = Object.keys(quizByQuestion).length
  const correct = Object.values(quizByQuestion).filter(Boolean).length
  const seconds = Object.values(state.lessons).reduce((s, l) => s + l.secondsSpent, 0)
  const visited = Object.keys(state.lessons).length
  const completed = Object.values(state.lessons).filter((l) => l.completed).length
  return {
    lessonsCompleted: totalLessons === undefined ? completed : Math.min(completed, totalLessons),
    lessonsVisited: visited,
    questionsAnswered: answered,
    questionsCorrect: correct,
    accuracy: answered === 0 ? 0 : correct / answered,
    bookmarks: state.bookmarks.length,
    studyMinutes: Math.round(seconds / 60),
    quizByQuestion,
  }
}

/** A minimal storage interface so the store is testable without a browser. */
export interface ProgressStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * Read the progress file.
 *
 * Reading can fail: the browser may refuse to give access to storage at all,
 * and a file written by an older version of the course may not parse. None of
 * that is worth losing the course over, so a failure yields an empty progress
 * file and the reader starts again.
 */
export function loadProgress(storage: ProgressStorage, key = PROGRESS_STORAGE_KEY): ProgressState {
  let raw: string | null = null
  try {
    raw = storage.getItem(key)
  } catch {
    return createEmptyProgress()
  }
  if (!raw) return createEmptyProgress()
  const { state } = parseProgress(raw)
  return state
}

/**
 * Write the progress file.
 *
 * Writing can fail too, and it fails more often than reading does: Firefox
 * throws `NS_ERROR_FAILURE` when the storage is disabled or full, and a
 * browser in private mode may refuse silently. The progress file is a
 * convenience, so a failure to write it must not take the course down with
 * it. The function reports whether the write happened.
 */
export function persistProgress(
  storage: ProgressStorage,
  state: ProgressState,
  key = PROGRESS_STORAGE_KEY,
): boolean {
  try {
    storage.setItem(key, JSON.stringify(sanitizeProgress(state)))
    return true
  } catch {
    return false
  }
}

/** Merge an imported document into the current state (union of activity). */
export function mergeProgress(current: ProgressState, imported: ProgressState): ProgressState {
  const lessons = { ...current.lessons }
  for (const [id, incoming] of Object.entries(imported.lessons)) {
    const existing = lessons[id]
    if (!existing) {
      lessons[id] = incoming
      continue
    }
    lessons[id] = {
      lessonId: id,
      completed: existing.completed || incoming.completed,
      completedAt: existing.completedAt ?? incoming.completedAt,
      secondsSpent: Math.max(existing.secondsSpent, incoming.secondsSpent),
      lastVisitedAt: (existing.lastVisitedAt ?? '') > (incoming.lastVisitedAt ?? '')
        ? existing.lastVisitedAt
        : incoming.lastVisitedAt,
    }
  }
  const seen = new Set(current.quizzes.map((a) => `${a.questionId}|${a.at}`))
  const quizzes = [...current.quizzes]
  for (const attempt of imported.quizzes) {
    const key = `${attempt.questionId}|${attempt.at}`
    if (!seen.has(key)) {
      quizzes.push(attempt)
      seen.add(key)
    }
  }
  const configs = [...current.playgroundConfigs]
  for (const config of imported.playgroundConfigs) {
    if (!configs.some((c) => c.id === config.id)) configs.push(config)
  }
  // The more recent review state for a question wins.
  const reviews = { ...imported.reviews }
  for (const [questionId, review] of Object.entries(current.reviews)) {
    reviews[questionId] = review
  }
  // The more recent explanation of a lesson wins.
  const explanations = { ...imported.explanations }
  for (const [lessonId, explanation] of Object.entries(current.explanations)) {
    explanations[lessonId] = explanation
  }
  return {
    version: PROGRESS_SCHEMA_VERSION,
    lessons,
    quizzes,
    bookmarks: Array.from(new Set([...current.bookmarks, ...imported.bookmarks])),
    playgroundConfigs: configs,
    notes: { ...imported.notes, ...current.notes },
    reviews,
    explanations,
  }
}

/** Trigger a browser download of the progress document. */
export function downloadProgress(state: ProgressState, filename = 'llm-foundations-progress.json'): void {
  const blob = new Blob([serializeProgress(state)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
