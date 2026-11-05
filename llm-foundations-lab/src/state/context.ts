import { createContext } from 'react'
import type {
  ExplanationRating,
  ProgressState,
  ProgressSummary,
  QuizAttempt,
  SavedPlaygroundConfig,
} from '../core/progress'
import type { RecallQuality, ReviewState } from '../core/spacedRepetition'

/**
 * The shape of the value carried by the progress context.
 *
 * The context object lives in its own module so that the provider file can
 * export components only, and so the provider and the hooks can share the same
 * context without importing each other.
 */
export interface ProgressContextValue {
  progress: ProgressState
  summary: ProgressSummary
  complete: (lessonId: string) => void
  reset: (lessonId: string) => void
  visit: (lessonId: string) => void
  recordTime: (lessonId: string, seconds: number) => void
  bookmark: (lessonId: string) => void
  isBookmarked: (lessonId: string) => boolean
  isComplete: (lessonId: string) => boolean
  recordAnswer: (attempt: Omit<QuizAttempt, 'at'>) => void
  /** The spaced-repetition state of every question that has been reviewed. */
  reviews: Record<string, ReviewState>
  /** Apply a review to a question, moving it to its next scheduled interval. */
  recordReview: (questionId: string, quality: RecallQuality) => void
  /** The reader's own answer to each lesson's self-explanation prompt. */
  explanations: Record<
    string,
    { answer: string; rating: ExplanationRating | null; revealed: boolean; at: string }
  >
  /** Record the reader's explanation of a lesson, and how they said it went. */
  recordExplanation: (
    lessonId: string,
    record: { answer: string; rating: ExplanationRating | null; revealed: boolean },
  ) => void
  saveConfig: (config: SavedPlaygroundConfig) => void
  removeConfig: (id: string) => void
  updateNote: (lessonId: string, note: string) => void
  exportJson: () => string
  importJson: (
    json: string,
    mode: 'merge' | 'replace',
  ) => { ok: boolean; error?: string; newerVersion?: number }
  clearAll: () => void
}

export const ProgressContext = createContext<ProgressContextValue | null>(null)
