import { createContext, useContext, useLayoutEffect, useMemo, useReducer, type ReactNode } from 'react'
import {
  STORAGE_KEY,
  initialProgress,
  objectiveKey,
  progressReducer,
  readStoredProgress,
  type ProgressApi,
  type QuizAttempt,
} from './progressState'

/**
 * Student progress store.
 *
 * Everything is local-first: the state lives in memory and is mirrored to
 * localStorage. No account, no network, no backend.
 *
 * The schema itself — the types, the reducer, the migrations and the
 * defensive loader — lives in `progressState.ts`, which is pure and can be
 * tested without a component tree. This file is only the React binding, and
 * it exports only the binding: the pure values are imported from
 * `progressState` directly, so that this file stays a component module and
 * the hot-reload warning does not fire on every edit.
 */

export type { Achievement, LabActivity, ProgressApi, ProgressState, QuizAttempt } from './progressState'

const ProgressContext = createContext<ProgressApi | null>(null)

export function ProgressProvider({ children, totalLessons }: { children: ReactNode; totalLessons: number }) {
  const [state, dispatch] = useReducer(progressReducer, initialProgress, (initial) => {
    if (typeof window === 'undefined') return initial
    return readStoredProgress()
  })

  /*
   * Persist in a layout effect, not a passive one.
   *
   * A passive effect is deferred until after the browser paints, which leaves
   * a window in which a student can tick an objective and immediately reload
   * the page and lose the answer. A layout effect writes to storage
   * synchronously after the commit, so the value is on disk before the
   * interaction can be interrupted.
   */
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage can be unavailable (private mode, quota); progress stays in memory.
    }
  }, [state])

  const latestAttempts = useMemo(() => {
    const latest = new Map<string, QuizAttempt>()
    for (const attempt of state.quizAttempts) latest.set(attempt.questionId, attempt)
    return latest
  }, [state.quizAttempts])

  const api = useMemo<ProgressApi>(() => {
    const answeredQuestionIds = [...latestAttempts.keys()]
    const correctQuestionIds = [...latestAttempts.values()].filter((attempt) => attempt.correct).map((attempt) => attempt.questionId)
    return {
      state,
      lastLessonSlug: state.lastLessonSlug,
      completedCount: state.completedLessons.length,
      totalLessons,
      completionRatio: totalLessons === 0 ? 0 : state.completedLessons.length / totalLessons,
      quizAccuracy: answeredQuestionIds.length === 0 ? 0 : correctQuestionIds.length / answeredQuestionIds.length,
      answeredQuestionIds,
      correctQuestionIds,
      isCompleted: (slug) => state.completedLessons.includes(slug),
      isBookmarked: (slug) => state.bookmarks.includes(slug),
      difficultyFor: (slug, fallback) => state.difficultyOverrides[slug] ?? fallback,
      isObjectiveChecked: (slug, index) => state.objectiveChecks.includes(objectiveKey(slug, index)),
      objectivesChecked: (slug) => {
        const prefix = `${slug}#`
        return state.objectiveChecks.filter((key) => key.startsWith(prefix)).length
      },
      completeLesson: (slug) => dispatch({ type: 'complete-lesson', slug }),
      uncompleteLesson: (slug) => dispatch({ type: 'uncomplete-lesson', slug }),
      toggleBookmark: (slug) => dispatch({ type: 'toggle-bookmark', slug }),
      recordAttempt: (attempt) => dispatch({ type: 'record-attempt', attempt }),
      recordLab: (labId, metric) => dispatch({ type: 'record-lab', labId, metric }),
      setDifficulty: (slug, difficulty) => dispatch({ type: 'set-difficulty', slug, difficulty }),
      toggleObjective: (slug, index) => dispatch({ type: 'toggle-objective', key: objectiveKey(slug, index) }),
      visitLesson: (slug) => dispatch({ type: 'visit-lesson', slug }),
      importProgress: (imported) => dispatch({ type: 'import', state: imported }),
      resetProgress: () => dispatch({ type: 'reset' }),
    }
  }, [state, totalLessons, latestAttempts])

  return <ProgressContext.Provider value={api}>{children}</ProgressContext.Provider>
}

export function useProgress(): ProgressApi {
  const context = useContext(ProgressContext)
  if (!context) {
    throw new Error('useProgress must be used inside a ProgressProvider')
  }
  return context
}
