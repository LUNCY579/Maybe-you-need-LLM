import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgressProvider, useProgress } from './progress'
import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEY,
  deriveAchievements,
  initialProgress,
  migrateProgress,
  parseProgress,
  progressReducer,
  readProgress,
  readStoredProgress,
  serializeProgress,
  type ProgressApi,
} from './progressState'
import { ThemeProvider } from './theme'
import { LESSONS } from '../content/lessons'

describe('progress reducer', () => {
  it('completes a lesson once and ignores duplicates', () => {
    const once = progressReducer(initialProgress, { type: 'complete-lesson', slug: 'a' })
    const twice = progressReducer(once, { type: 'complete-lesson', slug: 'a' })
    expect(twice.completedLessons).toEqual(['a'])
    expect(twice.updatedAt).not.toBeNull()
  })

  it('toggles bookmarks', () => {
    const on = progressReducer(initialProgress, { type: 'toggle-bookmark', slug: 'a' })
    expect(on.bookmarks).toEqual(['a'])
    const off = progressReducer(on, { type: 'toggle-bookmark', slug: 'a' })
    expect(off.bookmarks).toEqual([])
  })

  it('records attempts and lab activity with timestamps', () => {
    const attempted = progressReducer(initialProgress, {
      type: 'record-attempt',
      attempt: { questionId: 'q1-1', lessonSlug: 'what-agentic-llms-are', chosen: 1, correct: true },
    })
    expect(attempted.quizAttempts).toHaveLength(1)
    expect(attempted.quizAttempts[0].at).toMatch(/\d{4}-\d{2}-\d{2}T/)
    const labbed = progressReducer(attempted, { type: 'record-lab', labId: 'planning', metric: 'goal=true' })
    expect(labbed.labActivity[0].labId).toBe('planning')
  })

  it('caps lab activity to keep storage bounded', () => {
    let state = initialProgress
    for (let index = 0; index < 60; index += 1) {
      state = progressReducer(state, { type: 'record-lab', labId: `lab-${index}`, metric: 'x' })
    }
    expect(state.labActivity.length).toBeLessThanOrEqual(50)
  })

  it('resets to a clean state', () => {
    let state = progressReducer(initialProgress, { type: 'complete-lesson', slug: 'a' })
    state = progressReducer(state, { type: 'set-difficulty', slug: 'a', difficulty: 'advanced' })
    expect(progressReducer(state, { type: 'reset' })).toEqual(initialProgress)
  })
})

describe('progress parsing', () => {
  it('returns a clean state for missing or corrupt payloads', () => {
    expect(parseProgress(null)).toEqual(initialProgress)
    expect(parseProgress('not json')).toEqual(initialProgress)
    expect(parseProgress('{"completedLessons": "nope"}')).toMatchObject({ completedLessons: [], quizAttempts: [] })
  })

  it('recognises a progress export, and refuses anything else', () => {
    // The difference between "this file holds no progress" and "this file is
    // not a progress export" matters: importing the second one must not
    // replace a student's history with an empty one.
    expect(readProgress(null).recognised).toBe(false)
    expect(readProgress('not json').recognised).toBe(false)
    expect(readProgress('[]').recognised).toBe(false)
    expect(readProgress('{"unrelated": 1}').recognised).toBe(false)
    expect(readProgress('{"completedLessons": []}').recognised).toBe(true)
    expect(readProgress(serializeProgress(initialProgress)).recognised).toBe(true)
  })

  it('keeps the state of a recognised payload even when it is empty', () => {
    const read = readProgress('{"completedLessons": [], "quizAttempts": []}')
    expect(read.recognised).toBe(true)
    expect(read.state.completedLessons).toEqual([])
  })

  it('drops attempts for unknown questions and keeps known ones', () => {
    const payload = JSON.stringify({
      completedLessons: ['x'],
      quizAttempts: [
        { questionId: 'q1-1', lessonSlug: 'x', chosen: 0, correct: true, at: '2026-01-01T00:00:00.000Z' },
        { questionId: 'removed-question', lessonSlug: 'x', chosen: 0, correct: true, at: '2026-01-01T00:00:00.000Z' },
      ],
    })
    const parsed = parseProgress(payload)
    expect(parsed.quizAttempts).toHaveLength(1)
    expect(parsed.quizAttempts[0].questionId).toBe('q1-1')
  })

  it('round-trips through serialization', () => {
    const state = progressReducer(initialProgress, { type: 'complete-lesson', slug: 'a' })
    const roundTripped = parseProgress(serializeProgress(state))
    expect(roundTripped.completedLessons).toEqual(['a'])
  })

  it('drops difficulty overrides that name an unknown lesson or track', () => {
    const payload = JSON.stringify({
      difficultyOverrides: {
        'what-agentic-llms-are': 'advanced',
        'not-a-lesson': 'advanced',
        'tools-and-context': 'nonsense',
      },
    })
    expect(parseProgress(payload).difficultyOverrides).toEqual({ 'what-agentic-llms-are': 'advanced' })
  })
})

describe('progress migrations', () => {
  it('brings a version 0 payload up to the current version', () => {
    const migrated = migrateProgress({ history: [{ questionId: 'q1-1' }], difficulty: 'advanced' })
    expect(migrated.version).toBe(1)
    expect(migrated.quizAttempts).toEqual([{ questionId: 'q1-1' }])
    expect(migrated.difficulty).toBeUndefined()
  })

  it('leaves a payload from a newer version alone', () => {
    const migrated = migrateProgress({ version: 99, somethingNew: true })
    expect(migrated.somethingNew).toBe(true)
    expect(migrated.version).toBe(1)
  })

  it('reads the state written by an earlier release and moves it to the current key', () => {
    const legacyKey = LEGACY_STORAGE_KEYS[0]
    window.localStorage.setItem(
      legacyKey,
      JSON.stringify({ version: 1, completedLessons: ['what-agentic-llms-are'], quizAttempts: [] }),
    )
    const stored = readStoredProgress()
    expect(stored.completedLessons).toEqual(['what-agentic-llms-are'])
    // The migrated state is written to the current key, so this happens once.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy()
  })

  it('prefers the current key over the earlier one', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, completedLessons: ['tools-and-context'] }))
    window.localStorage.setItem(LEGACY_STORAGE_KEYS[0], JSON.stringify({ version: 1, completedLessons: ['what-agentic-llms-are'] }))
    expect(readStoredProgress().completedLessons).toEqual(['tools-and-context'])
  })
})

/* A tiny consumer so the React context can be exercised end to end. */
function ProgressProbe() {
  const api = useProgress()
  return (
    <div>
      <p data-testid="completed">{api.completedCount}</p>
      <p data-testid="accuracy">{api.quizAccuracy.toFixed(2)}</p>
      <p data-testid="last">{api.lastLessonSlug ?? 'none'}</p>
      <button onClick={() => api.completeLesson('what-agentic-llms-are')}>complete</button>
      <button onClick={() => api.recordAttempt({ questionId: 'q1-1', lessonSlug: 'what-agentic-llms-are', chosen: 1, correct: true })}>
        attempt
      </button>
      <button onClick={() => api.visitLesson('tools-and-context')}>visit</button>
    </div>
  )
}

describe('progress provider', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('counts completions, accuracy and last visit', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ProgressProvider totalLessons={LESSONS.length}>
          <ProgressProbe />
        </ProgressProvider>
      </ThemeProvider>,
    )

    expect(screen.getByTestId('completed')).toHaveTextContent('0')
    expect(screen.getByTestId('last')).toHaveTextContent('none')

    await user.click(screen.getByRole('button', { name: 'complete' }))
    await user.click(screen.getByRole('button', { name: 'attempt' }))
    await user.click(screen.getByRole('button', { name: 'visit' }))

    expect(screen.getByTestId('completed')).toHaveTextContent('1')
    expect(screen.getByTestId('accuracy')).toHaveTextContent('1.00')
    expect(screen.getByTestId('last')).toHaveTextContent('tools-and-context')
  })

  it('persists to localStorage', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ProgressProvider totalLessons={LESSONS.length}>
          <ProgressProbe />
        </ProgressProvider>
      </ThemeProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'complete' }))
    const stored = window.localStorage.getItem(STORAGE_KEY)
    expect(stored).toBeTruthy()
    expect(stored!).toContain('what-agentic-llms-are')
  })
})

describe('achievement derivation', () => {
  it('unlocks milestones from activity', () => {
    const base: ProgressApi = {
      state: initialProgress,
      lastLessonSlug: null,
      completedCount: 0,
      totalLessons: 12,
      completionRatio: 0,
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
    const idle = deriveAchievements(base)
    expect(idle.every((achievement) => !achievement.achieved)).toBe(true)

    const active = deriveAchievements({
      ...base,
      completedCount: 12,
      answeredQuestionIds: Array.from({ length: 12 }, (_, index) => `q${index}`),
      correctQuestionIds: Array.from({ length: 12 }, (_, index) => `q${index}`),
      state: {
        ...initialProgress,
        labActivity: ['workflow-builder', 'planning', 'memory', 'world-model'].map((labId) => ({ labId, metric: 'x', at: 'now' })),
      },
    })
    expect(active.filter((achievement) => achievement.achieved).length).toBeGreaterThan(4)
  })
})

/*
 * The browser can say no to storage.
 *
 * Private browsing, a full quota and cookies-disabled all make `localStorage`
 * throw, and the code had comments promising that progress stays in memory when
 * that happens. Nothing exercised the promise, and one half of it was untrue:
 * the theme read was not guarded, so an unreadable store threw at the root of
 * the tree before a student could see anything.
 */
describe('when storage is unavailable', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderApp() {
    return render(
      <ThemeProvider>
        <ProgressProvider totalLessons={LESSONS.length}>
          <ProgressProbe />
        </ProgressProvider>
      </ThemeProvider>,
    )
  }

  it('keeps the session usable when a write is refused', async () => {
    const refusal = new Error('exceeded the available quota')
    refusal.name = 'QuotaExceededError'
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw refusal
    })

    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'complete' }))
    await user.click(screen.getByRole('button', { name: 'attempt' }))

    // The reducer never learned that the mirror failed, so the student's own
    // view of their progress is correct for the session they are in.
    expect(screen.getByTestId('completed')).toHaveTextContent('1')
    expect(screen.getByTestId('accuracy')).toHaveTextContent('1.00')
    // And nothing was half-written: the key is simply not there.
    expect(setItem).toHaveBeenCalled()
    setItem.mockRestore()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('boots on the default theme when the store cannot be read', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage is disabled')
    })

    // If the theme read is unguarded this throws out of the render and the test
    // fails, which is the point: the app used to crash here, not degrade.
    expect(() => renderApp()).not.toThrow()
    expect(screen.getByTestId('completed')).toHaveTextContent('0')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    getItem.mockRestore()
  })

  it('still counts a completion made against an unreadable store', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage is disabled')
    })

    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'complete' }))
    await user.click(screen.getByRole('button', { name: 'visit' }))

    expect(screen.getByTestId('completed')).toHaveTextContent('1')
    expect(screen.getByTestId('last')).toHaveTextContent('tools-and-context')
  })
})
