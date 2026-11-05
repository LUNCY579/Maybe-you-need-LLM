import type { Lesson, LessonContent, PartId, QuizQuestion } from '../../types/curriculum'
import { lessonAgenticLLMs, lessonFoundations, lessonTraining } from './lessons-01-03'
import { lessonScaling, lessonReasoning, lessonVision } from './lessons-04-06'
import { lessonInteractionStyles, lessonTools, lessonRetrieval } from './lessons-07-09'
import { lessonBehavior, lessonAdvanced, lessonFuture } from './lessons-10-12'
import { ADVANCED_TRACK } from './advancedTrack'
import { ALL_LAB_QUESTIONS } from '../labQuestions'
import { CHAPTER_BY_NUMBER } from '../book'

/**
 * Fill in the page number of a question's source from the chapter table.
 *
 * Every question cites a chapter and section; the page follows from the
 * chapter's start page in the arXiv PDF, so it is derived rather than typed
 * twice.
 */
function withPage(source: QuizQuestion['source']): QuizQuestion['source'] {
  if (source.page !== undefined) return source
  const page = CHAPTER_BY_NUMBER.get(source.chapter)?.page
  return page === undefined ? source : { ...source, page }
}

/**
 * Attach the advanced-track material to each lesson.
 *
 * The advanced material lives in its own module so the core lesson files stay
 * readable, and so that adding a lesson is a two-step process: author the core
 * lesson, then add an entry to `ADVANCED_TRACK`.
 */
function withAdvancedTrack(lesson: LessonContent): Lesson {
  const extra = ADVANCED_TRACK[lesson.slug]
  return {
    ...lesson,
    quiz: lesson.quiz.map((question) => ({ ...question, source: withPage(question.source) })),
    advancedQuiz: (extra?.quiz ?? []).map((question) => ({ ...question, source: withPage(question.source) })),
    advancedSections: extra?.sections ?? [],
  }
}

export const LESSONS: Lesson[] = [
  lessonAgenticLLMs,
  lessonFoundations,
  lessonTraining,
  lessonScaling,
  lessonReasoning,
  lessonVision,
  lessonInteractionStyles,
  lessonTools,
  lessonRetrieval,
  lessonBehavior,
  lessonAdvanced,
  lessonFuture,
]
  .map(withAdvancedTrack)
  .sort((a, b) => a.order - b.order)

export const LESSON_BY_SLUG = new Map<string, Lesson>(LESSONS.map((lesson) => [lesson.slug, lesson]))
export const LESSON_BY_ID = new Map<string, Lesson>(LESSONS.map((lesson) => [lesson.id, lesson]))

export function lessonsForPart(part: PartId): Lesson[] {
  return LESSONS.filter((lesson) => lesson.part === part)
}

export function getLesson(slug: string): Lesson | undefined {
  return LESSON_BY_SLUG.get(slug)
}

export function nextLesson(slug: string): Lesson | undefined {
  const lesson = LESSON_BY_SLUG.get(slug)
  if (!lesson) return undefined
  return LESSONS.find((candidate) => candidate.order === lesson.order + 1)
}

export function previousLesson(slug: string): Lesson | undefined {
  const lesson = LESSON_BY_SLUG.get(slug)
  if (!lesson) return undefined
  return LESSONS.find((candidate) => candidate.order === lesson.order - 1)
}

/**
 * The questions a student commits to inside a lesson, before the answer is
 * revealed.
 *
 * They are ordinary questions with an ordinary id, so an attempt recorded
 * against one flows into the review queue exactly like a missed quiz question
 * does. Without this they would be invisible to the review machinery.
 */
export const PREDICT_QUESTIONS: QuizQuestion[] = LESSONS.flatMap((lesson) =>
  [...lesson.sections, ...lesson.advancedSections].flatMap((section) =>
    section.blocks
      .filter((block): block is Extract<typeof block, { kind: 'predict' }> => block.kind === 'predict')
      .map((block) => ({
        ...block.question,
        // The page follows from the chapter, so it is derived rather than
        // typed twice.
        source:
          block.question.source.page === undefined
            ? { ...block.question.source, page: CHAPTER_BY_NUMBER.get(block.question.source.chapter)?.page }
            : block.question.source,
      })),
  ),
)

export const ALL_QUESTIONS: QuizQuestion[] = [
  ...LESSONS.flatMap((lesson) => [...lesson.quiz, ...lesson.advancedQuiz]),
  ...PREDICT_QUESTIONS,
  ...ALL_LAB_QUESTIONS,
]

export function questionsForLesson(slug: string): QuizQuestion[] {
  const lesson = LESSON_BY_SLUG.get(slug)
  if (!lesson) return []
  return [...lesson.quiz, ...lesson.advancedQuiz]
}

export function questionById(id: string): QuizQuestion | undefined {
  return ALL_QUESTIONS.find((question) => question.id === id)
}

/** Lesson slug that a question belongs to. */
export function lessonSlugForQuestion(questionId: string): string | undefined {
  return LESSONS.find((lesson) =>
    [...lesson.quiz, ...lesson.advancedQuiz].some((question) => question.id === questionId),
  )?.slug
}

/** Number of questions that are only reachable on the advanced track. */
export const ADVANCED_QUESTION_COUNT = LESSONS.reduce((sum, lesson) => sum + lesson.advancedQuiz.length, 0)

export const TOTAL_STUDY_MINUTES = LESSONS.reduce((sum, lesson) => sum + lesson.minutes, 0)
