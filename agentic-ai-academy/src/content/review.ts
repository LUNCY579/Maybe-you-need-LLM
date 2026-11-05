import { ALL_QUESTIONS, LESSONS } from './lessons'
import { LAB_QUESTIONS } from './labQuestions'
import { LABS } from './labs'
import { groupAttempts, scheduleFor } from './spacing'
import type { QuizQuestion } from '../types/curriculum'
import type { ProgressState } from '../store/progressState'

/**
 * The review queue.
 *
 * This is the course's spaced-repetition mechanism, and it is driven entirely
 * by the student's own mistakes rather than by a fixed schedule.
 *
 * The rule is:
 *
 *   A question is due when its Leitner box says it should come back. A wrong
 *   answer puts it in box 0, which is due immediately; a correct answer
 *   promotes it a box, so it waits one, three, seven, fourteen or thirty days
 *   before it returns.
 *
 * Within the queue, the questions that have been waiting longest come first.
 * The queue is therefore self-sorting and needs no scheduler of its own.
 *
 * The function is pure: same progress state in, same queue out. That makes it
 * testable and makes the "after answering correctly it disappears" behaviour
 * assertable without a browser.
 */

export interface ReviewItem {
  question: QuizQuestion
  lessonSlug: string
  lessonTitle: string
  /** Total attempts recorded for this question. */
  attempts: number
  /** How many of those attempts were wrong. */
  misses: number
  /** ISO timestamp of the most recent attempt. */
  lastAttemptAt: string
  /** Whole days since that attempt. */
  daysSince: number
  /** The Leitner box the question is currently in. */
  box: number
  /** When the question is next due, in milliseconds since the epoch. */
  dueAt: number
  /** True when the question should be reviewed now. */
  due: boolean
}

export interface UpcomingItem {
  question: QuizQuestion
  lessonSlug: string
  lessonTitle: string
  box: number
  dueAt: number
  daysUntilDue: number
}

export interface ReviewSummary {
  items: ReviewItem[]
  /** Questions in the queue, due now. */
  due: number
  /** Questions answered wrongly at least once, whether or not they are still due. */
  everMissed: number
  /** Questions the student has answered correctly at least once. */
  everCorrect: number
  /** How many lessons currently have at least one due question. */
  affectedLessons: number
  /** The single most overdue question, if any. */
  oldest?: ReviewItem
  /** Questions that have been answered and are scheduled to come back later. */
  upcoming: UpcomingItem[]
  /** The highest Leitner box the student has reached. */
  bestBox: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function daysBetween(from: string, to: number): number {
  const then = Date.parse(from)
  if (Number.isNaN(then)) return 0
  return Math.max(0, Math.floor((to - then) / DAY_MS))
}

/**
 * Where a question lives, so the review queue can name it.
 *
 * A question belongs either to a lesson or to a laboratory. The laboratory
 * questions are the diagnostic ones a student meets at the end of a
 * simulation, and they belong in the queue just as much as the lesson
 * questions do.
 */
function ownerOf(questionId: string): { slug: string; title: string } | undefined {
  const lesson = LESSONS.find((candidate) => [...candidate.quiz, ...candidate.advancedQuiz].some((q) => q.id === questionId))
  if (lesson) return { slug: lesson.slug, title: lesson.title }
  const lab = LABS.find((candidate) => (LAB_QUESTIONS[candidate.id] ?? []).some((q) => q.id === questionId))
  if (lab) return { slug: lab.id, title: lab.name }
  return undefined
}

/**
 * Build the review queue from the recorded attempts.
 *
 * `now` is injectable so the ordering can be asserted in tests without
 * depending on the wall clock.
 */
export function buildReviewQueue(state: ProgressState, now: number = Date.now()): ReviewItem[] {
  const grouped = groupAttempts(state.quizAttempts)
  const items: ReviewItem[] = []

  for (const [questionId, attempts] of grouped) {
    const schedule = scheduleFor(attempts, now)
    if (!schedule || !schedule.due) continue

    const question = ALL_QUESTIONS.find((candidate) => candidate.id === questionId)
    if (!question) continue
    const owner = ownerOf(questionId)
    const last = attempts[attempts.length - 1]

    items.push({
      question,
      lessonSlug: owner?.slug ?? last.lessonSlug,
      lessonTitle: owner?.title ?? last.lessonSlug,
      attempts: schedule.attempts,
      misses: attempts.filter((attempt) => !attempt.correct).length,
      lastAttemptAt: last.at,
      daysSince: daysBetween(last.at, now),
      box: schedule.box,
      dueAt: schedule.dueAt,
      due: true,
    })
  }

  // The questions that have been waiting longest come first.
  items.sort((a, b) => a.dueAt - b.dueAt || a.question.id.localeCompare(b.question.id))

  return items
}

/** The review queue plus the counts shown alongside it. */
export function reviewSummary(state: ProgressState, now: number = Date.now()): ReviewSummary {
  const items = buildReviewQueue(state, now)
  const grouped = groupAttempts(state.quizAttempts)

  let everMissed = 0
  let everCorrect = 0
  let bestBox = 0
  const upcoming: UpcomingItem[] = []

  for (const [questionId, attempts] of grouped) {
    if (attempts.some((attempt) => !attempt.correct)) everMissed += 1
    if (attempts.some((attempt) => attempt.correct)) everCorrect += 1

    const schedule = scheduleFor(attempts, now)
    if (!schedule) continue
    bestBox = Math.max(bestBox, schedule.box)
    if (schedule.due) continue

    const question = ALL_QUESTIONS.find((candidate) => candidate.id === questionId)
    if (!question) continue
    const owner = ownerOf(questionId)
    const last = attempts[attempts.length - 1]
    upcoming.push({
      question,
      lessonSlug: owner?.slug ?? last.lessonSlug,
      lessonTitle: owner?.title ?? last.lessonSlug,
      box: schedule.box,
      dueAt: schedule.dueAt,
      daysUntilDue: schedule.daysUntilDue,
    })
  }

  upcoming.sort((a, b) => a.dueAt - b.dueAt)

  return {
    items,
    due: items.length,
    everMissed,
    everCorrect,
    affectedLessons: new Set(items.map((item) => item.lessonSlug)).size,
    oldest: items[0],
    upcoming,
    bestBox,
  }
}

/**
 * Mastery for one lesson.
 *
 * A lesson counts as mastered when the student has marked all of its learning
 * objectives as understood *and* has answered its **core** questions correctly
 * at least once each. Both halves matter: reading alone is not mastery, and
 * quizzing without engaging with the stated objectives is not either.
 *
 * The advanced-track questions are deliberately *not* required. They are an
 * optional deepening, and requiring them would make mastery depend on a choice
 * the student never had to make.
 */
export interface LessonMastery {
  slug: string
  objectivesTotal: number
  objectivesChecked: number
  questionsTotal: number
  questionsCorrect: number
  /** True when both halves are complete. */
  mastered: boolean
}

export function lessonMastery(
  lessonSlug: string,
  state: ProgressState,
): LessonMastery {
  const lesson = LESSONS.find((candidate) => candidate.slug === lessonSlug)
  if (!lesson) {
    return { slug: lessonSlug, objectivesTotal: 0, objectivesChecked: 0, questionsTotal: 0, questionsCorrect: 0, mastered: false }
  }
  const prefix = `${lessonSlug}#`
  const objectivesChecked = state.objectiveChecks.filter((key) => key.startsWith(prefix)).length
  const questionIds = new Set(lesson.quiz.map((question) => question.id))
  const correctIds = new Set(state.quizAttempts.filter((attempt) => attempt.correct).map((attempt) => attempt.questionId))
  const questionsCorrect = [...questionIds].filter((id) => correctIds.has(id)).length
  const objectivesTotal = lesson.objectives.length
  const questionsTotal = questionIds.size
  return {
    slug: lessonSlug,
    objectivesTotal,
    objectivesChecked,
    questionsTotal,
    questionsCorrect,
    mastered: objectivesTotal > 0 && objectivesChecked >= objectivesTotal && questionsTotal > 0 && questionsCorrect >= questionsTotal,
  }
}
