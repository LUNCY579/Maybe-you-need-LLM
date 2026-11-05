import { groupAttempts, scheduleFor, LEITNER_INTERVALS_DAYS, MAX_BOX } from './spacing'
import { ALL_QUESTIONS } from './lessons'
import type { ProgressState } from '../store/progressState'

/**
 * What the student has actually retained.
 *
 * The review queue answers "what do I need to do now?". This answers "how
 * much of this have I actually learned?", which is a different and more
 * motivating question — and the one the Leitner boxes are really measuring.
 *
 * A question is *retained* when it has been answered correctly and has not
 * yet come due for review. A question is *due* when its box says so. A
 * question is *fragile* when it has been answered correctly once but is
 * already due again — which is the state that most systems hide, and the one
 * that tells a student where the real gaps are.
 */
export interface RetentionSummary {
  /** Questions answered correctly at least once. */
  learned: number
  /** Questions currently retained: answered correctly and not yet due. */
  retained: number
  /** Questions due for review right now. */
  due: number
  /** Questions answered wrongly and never since corrected. */
  notYetLearned: number
  /** Questions answered correctly but already due again. */
  fragile: number
  /** Questions never attempted. */
  untouched: number
  /** The total number of questions in the course. */
  total: number
  /**
   * Retention as a fraction of the questions the student has met.
   *
   * Questions never attempted are excluded: they are not evidence of
   * forgetting.
   */
  rate: number
  /** The distribution across Leitner boxes, 0..MAX_BOX. */
  boxes: number[]
  /**
   * The questions that have climbed past the middle of the schedule.
   *
   * A question that has been answered correctly enough times to move up
   * several boxes is not about to be forgotten. This is the count that
   * answers "is any of this sticking?".
   */
  consolidated: number
  /** A one-line summary for the dashboard. */
  summary: string
}

export function retentionSummary(state: ProgressState, now: number = Date.now()): RetentionSummary {
  const grouped = groupAttempts(state.quizAttempts)
  const boxes = new Array<number>(LEITNER_INTERVALS_DAYS.length).fill(0)

  let learned = 0
  let retained = 0
  let due = 0
  let notYetLearned = 0
  let fragile = 0
  let consolidated = 0

  for (const [, attempts] of grouped) {
    const schedule = scheduleFor(attempts, now)
    if (!schedule) continue
    boxes[schedule.box] = (boxes[schedule.box] ?? 0) + 1
    if (schedule.box >= Math.floor(MAX_BOX / 2)) consolidated += 1

    const everCorrect = attempts.some((attempt) => attempt.correct)
    if (!everCorrect) {
      notYetLearned += 1
      due += 1
      continue
    }
    learned += 1
    if (schedule.due) {
      due += 1
      // Answered correctly, but the box says it is due again. The student got
      // it once and has not seen it since.
      fragile += 1
    } else {
      retained += 1
    }
  }

  const total = ALL_QUESTIONS.length
  const untouched = Math.max(0, total - grouped.size)
  const met = grouped.size
  const rate = met === 0 ? 0 : retained / met

  const summary =
    met === 0
      ? 'Nothing attempted yet.'
      : due === 0
        ? `All ${met} attempted question(s) are currently retained.`
        : `${retained} of ${met} attempted question(s) are retained; ${due} due for review.`

  return {
    learned,
    retained,
    due,
    notYetLearned,
    fragile,
    untouched,
    total,
    rate,
    boxes,
    consolidated,
    summary,
  }
}
