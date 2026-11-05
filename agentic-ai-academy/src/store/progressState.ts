import type { LessonDifficulty } from '../types/curriculum'
import { ALL_QUESTIONS, LESSONS } from '../content/lessons'
import { LABS } from '../content/labs'

/**
 * The progress schema.
 *
 * Everything in this module is pure: no React, no context, no DOM beyond
 * `localStorage`. That is deliberate. The schema is the part of the course
 * most likely to change — a new field, a renamed field, a different shape —
 * and it is the part a student would least like to lose. Keeping it
 * framework-free means it can be tested on its own, and it means the
 * migrations that carry an old payload forward can be reasoned about without
 * a component tree.
 *
 * The React context lives in `progress.tsx`.
 */

export const STORAGE_KEY = 'agentic-ai-academy/progress'
export const PROGRESS_VERSION = 1 as const

/**
 * Where earlier versions of the course wrote the state.
 *
 * The version used to live in the storage key, which meant that changing the
 * schema would orphan a student's progress: the new key would be empty and
 * the old one would simply be ignored. The version now lives in the payload
 * and is migrated, and these keys are read once — on first load, and only if
 * the current key is empty — and then left alone.
 */
export const LEGACY_STORAGE_KEYS = ['agentic-ai-academy/progress/v1'] as const

export interface QuizAttempt {
  questionId: string
  lessonSlug: string
  chosen: number
  correct: boolean
  /** ISO timestamp (kept for attempt history ordering). */
  at: string
}

export interface LabActivity {
  labId: string
  metric: string
  at: string
}

export interface ProgressState {
  version: typeof PROGRESS_VERSION
  completedLessons: string[]
  bookmarks: string[]
  quizAttempts: QuizAttempt[]
  labActivity: LabActivity[]
  difficultyOverrides: Record<string, LessonDifficulty>
  /**
   * Learning objectives the student has marked as understood.
   *
   * Keyed by `<lessonSlug>#<objectiveIndex>` so that the set survives a
   * lesson being re-ordered and stays meaningful across sessions.
   */
  objectiveChecks: string[]
  lastLessonSlug: string | null
  updatedAt: string | null
}

type Action =
  | { type: 'complete-lesson'; slug: string }
  | { type: 'uncomplete-lesson'; slug: string }
  | { type: 'toggle-bookmark'; slug: string }
  | { type: 'record-attempt'; attempt: Omit<QuizAttempt, 'at'> }
  | { type: 'record-lab'; labId: string; metric: string }
  | { type: 'set-difficulty'; slug: string; difficulty: LessonDifficulty }
  | { type: 'toggle-objective'; key: string }
  | { type: 'visit-lesson'; slug: string }
  | { type: 'import'; state: ProgressState }
  | { type: 'reset' }

export const initialProgress: ProgressState = {
  version: PROGRESS_VERSION,
  completedLessons: [],
  bookmarks: [],
  quizAttempts: [],
  labActivity: [],
  difficultyOverrides: {},
  objectiveChecks: [],
  lastLessonSlug: null,
  updatedAt: null,
}

/** The key used to record that one learning objective has been understood. */
export function objectiveKey(lessonSlug: string, index: number): string {
  return `${lessonSlug}#${index}`
}

function nowIso(): string {
  return new Date().toISOString()
}

export function progressReducer(state: ProgressState, action: Action): ProgressState {
  switch (action.type) {
    case 'complete-lesson':
      if (state.completedLessons.includes(action.slug)) return state
      return { ...state, completedLessons: [...state.completedLessons, action.slug], updatedAt: nowIso() }
    case 'uncomplete-lesson':
      return {
        ...state,
        completedLessons: state.completedLessons.filter((slug) => slug !== action.slug),
        updatedAt: nowIso(),
      }
    case 'toggle-bookmark':
      return {
        ...state,
        bookmarks: state.bookmarks.includes(action.slug)
          ? state.bookmarks.filter((slug) => slug !== action.slug)
          : [...state.bookmarks, action.slug],
        updatedAt: nowIso(),
      }
    case 'record-attempt':
      return {
        ...state,
        quizAttempts: [...state.quizAttempts, { ...action.attempt, at: nowIso() }],
        updatedAt: nowIso(),
      }
    case 'record-lab':
      return {
        ...state,
        labActivity: [...state.labActivity.slice(-49), { labId: action.labId, metric: action.metric, at: nowIso() }],
        updatedAt: nowIso(),
      }
    case 'set-difficulty':
      return { ...state, difficultyOverrides: { ...state.difficultyOverrides, [action.slug]: action.difficulty }, updatedAt: nowIso() }
    case 'toggle-objective':
      return {
        ...state,
        objectiveChecks: state.objectiveChecks.includes(action.key)
          ? state.objectiveChecks.filter((key) => key !== action.key)
          : [...state.objectiveChecks, action.key],
        updatedAt: nowIso(),
      }
    case 'visit-lesson':
      return { ...state, lastLessonSlug: action.slug, updatedAt: nowIso() }
    case 'import':
      return { ...action.state, version: PROGRESS_VERSION, updatedAt: nowIso() }
    case 'reset':
      return { ...initialProgress }
    default:
      return state
  }
}

/**
 * The steps that bring an old payload up to the current version.
 *
 * Each step receives the payload as it looked at version *n* and returns it
 * as version *n + 1*. Adding a field to the schema needs no step, because
 * `parseProgress` fills in the missing values; renaming a field, changing
 * the shape of one, or moving one does.
 *
 * The list is indexed by the version being upgraded *from*, so the last entry
 * must be for version `PROGRESS_VERSION - 1`.
 */
const MIGRATIONS: ((payload: Record<string, unknown>) => Record<string, unknown>)[] = [
  // 0 -> 1: the first release recorded the attempts in a `history` array and
  // kept the difficulty override as a bare string. Both were renamed.
  (payload) => {
    const next = { ...payload }
    if (Array.isArray(next.history) && !Array.isArray(next.quizAttempts)) {
      next.quizAttempts = next.history
      delete next.history
    }
    if (next.difficulty && typeof next.difficulty === 'string' && !next.difficultyOverrides) {
      next.difficultyOverrides = {}
      delete next.difficulty
    }
    return next
  },
]

/**
 * Bring a stored payload up to the current schema version.
 *
 * A payload from a *newer* version is left as it is: this build might not
 * understand it, but the field-by-field normalisation below keeps whatever it
 * can recognise, and losing a student's history because they opened an older
 * build of the course would be worse than ignoring a field.
 */
export function migrateProgress(payload: Record<string, unknown>): Record<string, unknown> {
  const from = typeof payload.version === 'number' && Number.isFinite(payload.version) ? payload.version : 0
  let current = payload
  for (let version = Math.max(0, from); version < PROGRESS_VERSION; version++) {
    const step = MIGRATIONS[version]
    if (!step) break
    current = step(current)
  }
  return { ...current, version: PROGRESS_VERSION }
}

/** The two difficulty tracks, and the only values an override may hold. */
const DIFFICULTIES: LessonDifficulty[] = ['core', 'advanced']

/**
 * Keep only the difficulty overrides that are meaningful.
 *
 * A payload can name any lesson and any value; only a known lesson with a
 * known track is worth carrying forward.
 */
function normaliseDifficultyOverrides(value: unknown): Record<string, LessonDifficulty> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const known = new Set(LESSONS.map((lesson) => lesson.slug))
  const result: Record<string, LessonDifficulty> = {}
  for (const [slug, difficulty] of Object.entries(value as Record<string, unknown>)) {
    if (!known.has(slug)) continue
    if (typeof difficulty === 'string' && DIFFICULTIES.includes(difficulty as LessonDifficulty)) {
      result[slug] = difficulty as LessonDifficulty
    }
  }
  return result
}

/** The keys a progress export is made of. */
const PROGRESS_KEYS = [
  'version',
  'completedLessons',
  'bookmarks',
  'quizAttempts',
  'labActivity',
  'difficultyOverrides',
  'objectiveChecks',
  'lastLessonSlug',
]

export interface ProgressRead {
  /** The state, which is clean when the payload was not recognisable. */
  state: ProgressState
  /**
   * Whether the payload was recognisable as a progress export.
   *
   * This matters because the difference between "this file holds no progress"
   * and "this file is not a progress export" is the difference between a
   * student restoring an empty course and a student losing the course they
   * had. The second must never be done silently.
   */
  recognised: boolean
}

/**
 * Read a stored payload, and say whether it was recognisable.
 *
 * `parseProgress` is the forgiving version, for a corrupt payload to fall
 * back to a clean state. This one reports *why* it fell back, so a caller
 * that is about to overwrite the student's progress can refuse to.
 */
export function readProgress(raw: string | null): ProgressRead {
  if (!raw) return { state: initialProgress, recognised: false }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { state: initialProgress, recognised: false }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { state: initialProgress, recognised: false }
  }
  const record = parsed as Record<string, unknown>
  const recognised = PROGRESS_KEYS.some((key) => key in record)
  return { state: parseProgress(raw), recognised }
}

/** Defensive loader: unknown or corrupt payloads fall back to a clean state. */
export function parseProgress(raw: string | null): ProgressState {
  if (!raw) return initialProgress
  try {
    const parsed = migrateProgress(JSON.parse(raw) as Record<string, unknown>)
    const knownQuestionIds = new Set(ALL_QUESTIONS.map((question) => question.id))
    return {
      version: PROGRESS_VERSION,
      completedLessons: Array.isArray(parsed.completedLessons) ? parsed.completedLessons.filter((slug) => typeof slug === 'string') : [],
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks.filter((slug) => typeof slug === 'string') : [],
      quizAttempts: Array.isArray(parsed.quizAttempts)
        ? parsed.quizAttempts
            .filter((attempt) => attempt && knownQuestionIds.has(attempt.questionId))
            .map((attempt) => ({ ...attempt, at: typeof attempt.at === 'string' ? attempt.at : nowIso() }))
        : [],
      labActivity: Array.isArray(parsed.labActivity)
        ? parsed.labActivity.filter((entry) => entry && typeof entry.labId === 'string')
        : [],
      difficultyOverrides: normaliseDifficultyOverrides(parsed.difficultyOverrides),
      objectiveChecks: Array.isArray(parsed.objectiveChecks)
        ? parsed.objectiveChecks.filter((key) => typeof key === 'string')
        : [],
      lastLessonSlug: typeof parsed.lastLessonSlug === 'string' ? parsed.lastLessonSlug : null,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    }
  } catch {
    return initialProgress
  }
}

export function serializeProgress(state: ProgressState): string {
  return JSON.stringify({ ...state, exportedAt: nowIso() }, null, 2)
}

/**
 * Read the stored state, migrating it from an earlier release if needed.
 *
 * The version used to be part of the storage key, so a schema change would
 * have left a student's progress under a key this build no longer reads. The
 * key is now stable and the version travels in the payload, so the only thing
 * left to do is read the old key once, when the current one is empty, and
 * write it back to the current one.
 */
export function readStoredProgress(): ProgressState {
  if (typeof window === 'undefined') return initialProgress
  try {
    const current = window.localStorage.getItem(STORAGE_KEY)
    if (current) return parseProgress(current)
    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const legacy = window.localStorage.getItem(legacyKey)
      if (!legacy) continue
      const migrated = parseProgress(legacy)
      // Write it to the current key, so the migration only happens once.
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      return migrated
    }
    return initialProgress
  } catch {
    return initialProgress
  }
}

export interface ProgressApi {
  state: ProgressState
  /** Slug of the most recently visited lesson, if any. */
  lastLessonSlug: string | null
  completedCount: number
  totalLessons: number
  completionRatio: number
  quizAccuracy: number
  answeredQuestionIds: string[]
  correctQuestionIds: string[]
  isCompleted: (slug: string) => boolean
  isBookmarked: (slug: string) => boolean
  difficultyFor: (slug: string, fallback: LessonDifficulty) => LessonDifficulty
  /** True when the student has marked this learning objective as understood. */
  isObjectiveChecked: (lessonSlug: string, index: number) => boolean
  /** How many objectives of a lesson are marked as understood. */
  objectivesChecked: (lessonSlug: string) => number
  completeLesson: (slug: string) => void
  uncompleteLesson: (slug: string) => void
  toggleBookmark: (slug: string) => void
  recordAttempt: (attempt: Omit<QuizAttempt, 'at'>) => void
  recordLab: (labId: string, metric: string) => void
  setDifficulty: (slug: string, difficulty: LessonDifficulty) => void
  toggleObjective: (lessonSlug: string, index: number) => void
  visitLesson: (slug: string) => void
  importProgress: (state: ProgressState) => void
  resetProgress: () => void
}

/* ------------------------------------------------------------------ */
/* Achievements are derived, never stored                             */
/* ------------------------------------------------------------------ */

export interface Achievement {
  id: string
  title: string
  description: string
  achieved: boolean
  progress: number
}

export function deriveAchievements(api: ProgressApi): Achievement[] {
  const { state, answeredQuestionIds, correctQuestionIds, completedCount } = api
  const distinctLabIds = new Set(state.labActivity.map((entry) => entry.labId))
  return [
    {
      id: 'first-steps',
      title: 'First steps',
      description: 'Complete your first lesson.',
      achieved: completedCount >= 1,
      progress: Math.min(1, completedCount),
    },
    {
      id: 'harness-builder',
      title: 'Harness builder',
      description: 'Run the workflow builder or any lab simulation.',
      achieved: state.labActivity.length >= 1,
      progress: Math.min(1, state.labActivity.length),
    },
    {
      id: 'lab-explorer',
      title: 'Lab explorer',
      // The count comes from the content, so adding a laboratory cannot leave
      // the achievement behind.
      description: `Try all ${LABS.length} laboratories.`,
      achieved: distinctLabIds.size >= LABS.length,
      progress: LABS.length === 0 ? 0 : distinctLabIds.size / LABS.length,
    },
    {
      id: 'reasoner',
      title: 'Reasoner',
      description: 'Answer 10 assessment questions.',
      achieved: answeredQuestionIds.length >= 10,
      progress: Math.min(1, answeredQuestionIds.length / 10),
    },
    {
      id: 'committer',
      title: 'Committed',
      description: 'Commit to a prediction in a lesson before seeing the answer.',
      achieved: state.quizAttempts.some((attempt) => attempt.questionId.startsWith('p')),
      progress: state.quizAttempts.some((attempt) => attempt.questionId.startsWith('p')) ? 1 : 0,
    },
    {
      id: 'accurate',
      title: 'Accurate',
      description: 'Answer 10 questions correctly.',
      achieved: correctQuestionIds.length >= 10,
      progress: Math.min(1, correctQuestionIds.length / 10),
    },
    {
      id: 'halfway',
      title: 'Halfway through the book',
      description: 'Complete 6 of the 12 lessons.',
      achieved: completedCount >= 6,
      progress: Math.min(1, completedCount / 6),
    },
    {
      id: 'graduate',
      title: 'Course complete',
      description: 'Complete every lesson in the released curriculum.',
      achieved: completedCount >= api.totalLessons && api.totalLessons > 0,
      progress: api.totalLessons === 0 ? 0 : completedCount / api.totalLessons,
    },
  ]
}
