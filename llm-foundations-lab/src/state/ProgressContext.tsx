import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  addStudyTime,
  completeLesson,
  createEmptyProgress,
  deletePlaygroundConfig,
  loadProgress,
  mergeProgress,
  parseProgress,
  persistProgress,
  recordExplanation as applyExplanation,
  recordQuizAttempt,
  recordReview as applyReview,
  resetLesson,
  savePlaygroundConfig,
  serializeProgress,
  setNote,
  summarize,
  toggleBookmark,
  visitLesson,
  type ProgressState,
  type QuizAttempt,
  type SavedPlaygroundConfig,
} from '../core/progress'
import type { ExplanationRating } from '../core/progress'
import {
  initialReviewState,
  reviewedToday,
  reviewItem,
  type RecallQuality,
} from '../core/spacedRepetition'
import { LESSONS } from '../content/curriculum'
import { ProgressContext, type ProgressContextValue } from './context'

export type { ProgressContextValue }

function browserStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ProgressState>(() => {
    const storage = browserStorage()
    return storage ? loadProgress(storage) : createEmptyProgress()
  })
  const storageRef = useRef<Storage | null>(browserStorage())

  useEffect(() => {
    const storage = storageRef.current
    if (!storage) return
    /*
      A write that fails is not worth losing the course over, so the failure
      is reported once and the reader carries on. The progress file is a
      convenience; the lessons are not.
    */
    if (!persistProgress(storage, progress)) {
      console.warn(
        'The progress file could not be written. The browser may be blocking storage; progress will not be kept.',
      )
    }
  }, [progress])

  // Aggregate study time while a lesson page is open (rough, but honest).
  const [activeLesson, setActiveLesson] = useState<string | null>(null)
  useEffect(() => {
    if (!activeLesson) return
    const started = Date.now()
    const timer = window.setInterval(() => {
      setProgress((current) => addStudyTime(current, activeLesson, 30))
    }, 30_000)
    return () => {
      window.clearInterval(timer)
      const elapsed = Math.round((Date.now() - started) / 1000)
      if (elapsed >= 5) {
        setProgress((current) => addStudyTime(current, activeLesson, elapsed))
      }
    }
  }, [activeLesson])

  const summary = useMemo(() => summarize(progress, LESSONS.length), [progress])

  /*
   * The mutating actions are stable for the lifetime of the provider.
   *
   * They all update the state through the functional form of `setProgress`, so
   * they never need to close over the current state. Stability matters: the
   * lesson page records a visit in an effect that depends on `visit`, and
   * visiting a lesson writes a new timestamp. If `visit` changed identity on
   * every progress update, that effect would re-fire, write another timestamp
   * and start an unbounded render loop.
   */
  const complete = useCallback((lessonId: string) => {
    setProgress((current) => completeLesson(current, lessonId))
  }, [])
  const reset = useCallback((lessonId: string) => {
    setProgress((current) => resetLesson(current, lessonId))
  }, [])
  const visit = useCallback((lessonId: string) => {
    setProgress((current) => visitLesson(current, lessonId))
    setActiveLesson(lessonId)
  }, [])
  const recordTime = useCallback((lessonId: string, seconds: number) => {
    setProgress((current) => addStudyTime(current, lessonId, seconds))
  }, [])
  const bookmark = useCallback((lessonId: string) => {
    setProgress((current) => toggleBookmark(current, lessonId))
  }, [])
  const isBookmarked = useCallback(
    (lessonId: string) => progress.bookmarks.includes(lessonId),
    [progress.bookmarks],
  )
  const isComplete = useCallback(
    (lessonId: string) => progress.lessons[lessonId]?.completed ?? false,
    [progress.lessons],
  )
  const recordAnswer = useCallback((attempt: Omit<QuizAttempt, 'at'>) => {
    setProgress((current) => recordQuizAttempt(current, { ...attempt, at: new Date().toISOString() }))
  }, [])
  /*
   * The review schedule.
   *
   * A question that has never been reviewed is treated as due, so every
   * question in the bank enters the queue the moment a learner starts.
   */
  const reviews = progress.reviews
  const recordReview = useCallback((questionId: string, quality: RecallQuality) => {
    setProgress((current) => {
      const previous = current.reviews[questionId] ?? initialReviewState()
      // A question is reviewed once a day. A second attempt in the same
      // sitting would push the next review further out without testing
      // anything the learner did not already know.
      if (reviewedToday(previous, new Date())) return current
      return applyReview(current, questionId, reviewItem(previous, quality, new Date()))
    })
  }, [])
  const explanations = progress.explanations
  const recordExplanation = useCallback(
    (
      lessonId: string,
      record: { answer: string; rating: ExplanationRating | null; revealed: boolean },
    ) => {
      setProgress((current) => applyExplanation(current, lessonId, record))
    },
    [],
  )
  const saveConfig = useCallback((config: SavedPlaygroundConfig) => {
    setProgress((current) => savePlaygroundConfig(current, config))
  }, [])
  const removeConfig = useCallback((id: string) => {
    setProgress((current) => deletePlaygroundConfig(current, id))
  }, [])
  const updateNote = useCallback((lessonId: string, note: string) => {
    setProgress((current) => setNote(current, lessonId, note))
  }, [])
  const exportJson = useCallback(() => serializeProgress(progress), [progress])
  const importJson = useCallback(
    (json: string, mode: 'merge' | 'replace') => {
      const parsed = parseProgress(json)
      if (parsed.error) return { ok: false, error: `Could not parse the file: ${parsed.error}` }
      if (mode === 'replace') {
        setProgress(parsed.state)
      } else {
        setProgress((current) => mergeProgress(current, parsed.state))
      }
      return { ok: true, newerVersion: parsed.newerVersion }
    },
    [],
  )
  const clearAll = useCallback(() => setProgress(createEmptyProgress()), [])

  const value = useMemo<ProgressContextValue>(
    () => ({
      progress,
      summary,
      complete,
      reset,
      visit,
      recordTime,
      bookmark,
      isBookmarked,
      isComplete,
      recordAnswer,
      reviews,
      recordReview,
      explanations,
      recordExplanation,
      saveConfig,
      removeConfig,
      updateNote,
      exportJson,
      importJson,
      clearAll,
    }),
    [
      progress,
      summary,
      complete,
      reset,
      visit,
      recordTime,
      bookmark,
      isBookmarked,
      isComplete,
      recordAnswer,
      reviews,
      recordReview,
      explanations,
      recordExplanation,
      saveConfig,
      removeConfig,
      updateNote,
      exportJson,
      importJson,
      clearAll,
    ],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}
