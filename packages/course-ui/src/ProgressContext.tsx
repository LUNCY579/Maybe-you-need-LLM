import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createProgressStore, exportProgress, importProgress } from '@llm-materials/course-core'
import type { ProgressRecord, ProgressSummary } from '@llm-materials/course-core'

/**
 * The shared progress provider.
 *
 * Every course in this collection keeps the same record: which lessons are
 * complete, which questions were answered correctly, how long was spent, and
 * what was bookmarked. What differs is which lessons exist, so the module map
 * is passed in.
 */

export interface ProgressContextValue {
  record: ProgressRecord
  summary: ProgressSummary
  markLessonComplete: (lessonId: string, seconds: number) => void
  addStudyTime: (lessonId: string, seconds: number) => void
  setBookmark: (lessonId: string, bookmarked: boolean) => void
  recordQuizAnswer: (questionId: string, correct: boolean) => void
  toggleKnownTerm: (termId: string) => void
  reset: () => void
  exportJson: () => string
  importJson: (json: string) => boolean
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

export function ProgressProvider({
  children,
  storageKey,
  moduleLessonIds,
}: {
  children: ReactNode
  /** The localStorage key the record is stored under. */
  storageKey: string
  /** Module id → the lesson ids that belong to it. */
  moduleLessonIds: Record<string, string[]>
}) {
  const [record, setRecord] = useState<ProgressRecord>(() => storeFor(storageKey).load())

  const summary = useMemo(() => summarise(record, moduleLessonIds), [record, moduleLessonIds])

  const markLessonComplete = useCallback(
    (lessonId: string, seconds: number) => {
      setRecord(storeFor(storageKey).markLessonComplete(lessonId, seconds))
    },
    [storageKey],
  )

  const addStudyTime = useCallback(
    (lessonId: string, seconds: number) => {
      setRecord(storeFor(storageKey).addStudyTime(lessonId, seconds))
    },
    [storageKey],
  )

  const setBookmark = useCallback(
    (lessonId: string, bookmarked: boolean) => {
      setRecord(storeFor(storageKey).setBookmark(lessonId, bookmarked))
    },
    [storageKey],
  )

  const recordQuizAnswer = useCallback(
    (questionId: string, correct: boolean) => {
      setRecord(storeFor(storageKey).recordQuizAnswer(questionId, correct))
    },
    [storageKey],
  )

  const toggleKnownTerm = useCallback(
    (termId: string) => {
      setRecord(storeFor(storageKey).toggleKnownTerm(termId))
    },
    [storageKey],
  )

  const reset = useCallback(() => {
    storeFor(storageKey).reset()
    setRecord(storeFor(storageKey).load())
  }, [storageKey])

  const exportJson = useCallback(() => JSON.stringify(exportProgress(record), null, 2), [record])

  const importJson = useCallback(
    (json: string) => {
      try {
        const imported = importProgress(JSON.parse(json))
        if (!imported) return false
        storeFor(storageKey).save(imported)
        setRecord(imported)
        return true
      } catch {
        return false
      }
    },
    [storageKey],
  )

  const value = useMemo<ProgressContextValue>(
    () => ({
      record,
      summary,
      markLessonComplete,
      addStudyTime,
      setBookmark,
      recordQuizAnswer,
      toggleKnownTerm,
      reset,
      exportJson,
      importJson,
    }),
    [
      record,
      summary,
      markLessonComplete,
      addStudyTime,
      setBookmark,
      recordQuizAnswer,
      toggleKnownTerm,
      reset,
      exportJson,
      importJson,
    ],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext)
  if (!context) throw new Error('useProgress must be used inside a ProgressProvider')
  return context
}

/** One store per key, so two courses on the same origin do not collide. */
const stores = new Map<string, ReturnType<typeof createProgressStore>>()

function storeFor(key: string) {
  let store = stores.get(key)
  if (!store) {
    store = createProgressStore({ key })
    stores.set(key, store)
  }
  return store
}

function summarise(record: ProgressRecord, moduleLessonIds: Record<string, string[]>): ProgressSummary {
  const modules = Object.entries(moduleLessonIds).map(([moduleId, lessonIds]) => {
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
  const lessonsTotal = Object.values(moduleLessonIds).reduce((acc, list) => acc + list.length, 0)
  const lessonsComplete = modules.reduce((acc, m) => acc + m.complete, 0)
  const quizCorrect = quizValues.filter((q) => q.correct).length

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
