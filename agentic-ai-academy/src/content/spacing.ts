import type { QuizAttempt } from '../store/progressState'

/**
 * Spaced repetition for the review queue.
 *
 * The course already asks the student to *retrieve* — that is the half of
 * learning science that most systems skip. This module adds the other half:
 * **spacing**.
 *
 * The evidence for spacing is strong and uncontroversial. Reviewing material
 * just before it is forgotten is far less effective than reviewing it at
 * expanding intervals, because each successful retrieval has to be re-consolidated
 * (Ebbinghaus 1885; Cepeda et al. 2006; Carpenter, Pan & Butler 2022,
 * *Nature Reviews Psychology*). The same review states also show that
 * learners systematically under-use both strategies, because scheduling feels
 * like an optimisation to be done later rather than part of learning itself.
 *
 * The scheduler is the **Leitner system** (Leitner 1970): every item sits in a
 * box, and the box determines how long the item waits before it comes back.
 * A correct answer promotes the item, so it is seen less often; a wrong
 * answer demotes it to the first box, so it is seen again immediately.
 *
 * The intervals below are the classic Leitner schedule. They are a heuristic
 * rather than an optimum — optimal schedules are known (Reddy et al. 2016;
 * Tabibian et al. 2019), but they need a per-learner memory model and a large
 * amount of interaction history, and this course has neither. The important
 * property for the student is the *shape*: items that are well known come
 * back rarely, and items that are not come back soon.
 */

/** The day interval for each Leitner box. Box 0 is due immediately. */
export const LEITNER_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30] as const

/** The highest box an item can reach. */
export const MAX_BOX = LEITNER_INTERVALS_DAYS.length - 1

const DAY_MS = 24 * 60 * 60 * 1000

export interface ItemSchedule {
  /** The Leitner box, 0 (needs work) to MAX_BOX (well known). */
  box: number
  /** How many consecutive correct answers the item has. */
  streak: number
  /** When the item was last attempted, in milliseconds since the epoch. */
  lastAttemptAt: number
  /** When the item should next be reviewed, in milliseconds since the epoch. */
  dueAt: number
  /** True when the item is due now. */
  due: boolean
  /** Whole days until the item is due; 0 when it is due. */
  daysUntilDue: number
  /** How many times the item has been attempted. */
  attempts: number
}

/**
 * The schedule for one question, given its attempt history.
 *
 * The history is expected in chronological order, as the attempt log stores it.
 */
export function scheduleFor(attempts: QuizAttempt[], now: number = Date.now()): ItemSchedule | null {
  if (attempts.length === 0) return null

  const last = attempts[attempts.length - 1]
  const lastAttemptAt = Date.parse(last.at)
  if (Number.isNaN(lastAttemptAt)) return null

  let streak = 0
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    if (!attempts[index].correct) break
    streak += 1
  }

  // A wrong answer sends the item back to the first box, where the interval
  // is zero and it is due straight away.
  const box = last.correct ? Math.min(MAX_BOX, streak) : 0
  const intervalMs = LEITNER_INTERVALS_DAYS[box] * DAY_MS
  const dueAt = last.correct ? lastAttemptAt + intervalMs : lastAttemptAt

  return {
    box,
    streak,
    lastAttemptAt,
    dueAt,
    // `>=` rather than `>` so that a question answered wrongly in this very
    // instant is due immediately: the student must be able to retry it.
    due: now >= dueAt,
    daysUntilDue: Math.max(0, Math.ceil((dueAt - now) / DAY_MS)),
    attempts: attempts.length,
  }
}

/**
 * Group the attempt log by question.
 *
 * The log is append-only, so the order within a question is chronological.
 */
export function groupAttempts(attempts: QuizAttempt[]): Map<string, QuizAttempt[]> {
  const grouped = new Map<string, QuizAttempt[]>()
  for (const attempt of attempts) {
    const list = grouped.get(attempt.questionId)
    if (list) list.push(attempt)
    else grouped.set(attempt.questionId, [attempt])
  }
  return grouped
}

/**
 * The next review time for a question, in milliseconds since the epoch.
 *
 * `null` when the question has never been attempted.
 */
export function nextReviewAt(attempts: QuizAttempt[], now: number = Date.now()): number | null {
  const schedule = scheduleFor(attempts, now)
  return schedule ? schedule.dueAt : null
}

/**
 * The box a question is in, or `null` if it has never been attempted.
 */
export function boxFor(attempts: QuizAttempt[], now: number = Date.now()): number | null {
  return scheduleFor(attempts, now)?.box ?? null
}

/** A short human description of a box, for the interface. */
export function describeBox(box: number): string {
  if (box <= 0) return 'needs work'
  if (box >= MAX_BOX) return 'well known'
  return `box ${box} of ${MAX_BOX}`
}
