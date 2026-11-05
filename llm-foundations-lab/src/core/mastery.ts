/**
 * Mastery.
 *
 * "Correct" is not the same as "mastered". A question answered correctly
 * once, in passing, a week ago, is not knowledge; a question recalled
 * correctly four times over a month, the last time after a lapse, is.
 *
 * The course already has the evidence a mastery estimate needs: every answer
 * is recorded, and every answer moves the question along a spaced-repetition
 * schedule. This module turns that record into a number per lesson, and the
 * number is used to say what to study next.
 *
 * The estimate is built from three things the schedule already tracks:
 *
 * - **The repetitions.** How many times in a row the question has been
 *   recalled without a lapse. A lapse resets the count, which is the point:
 *   the count is a run length, not a total.
 * - **The ease factor.** How well the question is sticking. SM-2 lowers it
 *   when a question is recalled slowly or with effort, and raises it when it
 *   is recalled quickly, so it carries information the run length does not.
 * - **The time since the last recall.** A question last recalled a year ago
 *   has decayed since then, even though nothing was ever got wrong.
 *
 * The decay is a half-life: a question whose last recall was six months ago
 * counts half as much as one recalled today. The half-life is a month, which
 * is roughly where the forgetting curve of a technical fact has fallen far
 * enough that a reader would have to relearn it.
 */

/** How long a recall counts for at full strength. */
export const MASTERY_HALF_LIFE_DAYS = 30

/** A question that has never been answered has no mastery at all. */
const UNSEEN = 0

export interface MasteryInput {
  /** How many times in a row the question has been recalled. */
  repetitions: number
  /** The ease factor from the spaced-repetition schedule. */
  easeFactor: number
  /** When the question was last recalled, or null if it never has been. */
  lastReviewedAt: string | null
}

export interface MasteryBreakdown {
  /** The estimate for the question, from 0 to 1. */
  score: number
  /** The part of the estimate that comes from the run of correct recalls. */
  fromRepetitions: number
  /** The part that comes from the ease factor. */
  fromEase: number
  /** The part that comes from how long ago the question was last recalled. */
  fromRecency: number
}

/**
 * How much the question counts for right now.
 *
 * The three parts multiply, because a question that is hard *and* that was
 * recalled a long time ago is worse than either problem on its own.
 */
export function questionMastery(input: MasteryInput, now: Date = new Date()): MasteryBreakdown {
  if (!input.lastReviewedAt) {
    return { score: UNSEEN, fromRepetitions: 0, fromEase: 0, fromRecency: 0 }
  }

  const last = new Date(input.lastReviewedAt)
  if (Number.isNaN(last.getTime())) {
    return { score: UNSEEN, fromRepetitions: 0, fromEase: 0, fromRecency: 0 }
  }

  // The run length: the first recall is worth a quarter, the second a half,
  // the third three quarters, and the fourth and beyond the whole thing. A
  // single lucky guess should not count for much.
  const fromRepetitions = Math.min(1, 0.25 + 0.25 * (input.repetitions - 1))

  // The ease factor runs from 1.3 to about 3.0. Normalised so that the
  // average question (2.5) counts for half.
  const fromEase = Math.max(0, Math.min(1, (input.easeFactor - 1.3) / 1.2))

  // The decay: a month-old recall counts half.
  const days = Math.max(0, (now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000))
  const fromRecency = Math.pow(0.5, days / MASTERY_HALF_LIFE_DAYS)

  const score = Math.max(0, Math.min(1, fromRepetitions * (0.5 + 0.5 * fromEase) * fromRecency))
  return { score, fromRepetitions, fromEase, fromRecency }
}

/**
 * The mastery of a set of questions, and of the lessons they belong to.
 *
 * A lesson with no questions yet has no mastery — not zero mastery, which
 * would say the reader has failed it. The difference matters: a lesson that
 * has not been attempted is a lesson that is waiting, and the learning path
 * treats the two differently.
 */
export interface MasterySummary {
  /** The mean mastery of the lesson's questions, or null if it has none. */
  score: number | null
  /** How many of the lesson's questions have been recalled at least once. */
  attempted: number
  /** How many of the lesson's questions are in good shape. */
  mastered: number
  /** How many of the lesson's questions have never been answered. */
  unseen: number
  /** The lesson's weakest question, for the "look here next" advice. */
  weakest: string | null
}

/** A question counts as mastered once it is worth more than this. */
export const MASTERY_THRESHOLD = 0.6

export function summariseMastery(
  questionIds: string[],
  states: Record<string, { repetitions: number; easeFactor: number; lastReviewedAt: string | null }>,
  now: Date = new Date(),
): MasterySummary {
  if (questionIds.length === 0) {
    return { score: null, attempted: 0, mastered: 0, unseen: 0, weakest: null }
  }

  let total = 0
  let attempted = 0
  let mastered = 0
  let unseen = 0
  let weakest: string | null = null
  let weakestScore = Number.POSITIVE_INFINITY

  for (const id of questionIds) {
    const state = states[id]
    if (!state) {
      unseen += 1
      continue
    }
    const { score } = questionMastery(state, now)
    total += score
    if (state.lastReviewedAt) attempted += 1
    if (score >= MASTERY_THRESHOLD) mastered += 1
    if (score < weakestScore) {
      weakestScore = score
      weakest = id
    }
  }

  return {
    score: total / questionIds.length,
    attempted,
    mastered,
    unseen,
    weakest,
  }
}

/**
 * What the estimate says about a lesson, in words.
 *
 * The wording is the difference between a number the reader has to interpret
 * and a number that means something.
 */
export function describeMastery(summary: MasterySummary): string {
  if (summary.score === null) return 'No questions yet'
  if (summary.unseen === summary.attempted + summary.unseen && summary.unseen > 0 && summary.attempted === 0) {
    return 'Not attempted'
  }
  if (summary.score >= 0.8) return 'Mastered'
  if (summary.score >= MASTERY_THRESHOLD) return 'Mostly there'
  if (summary.attempted > 0) return 'Shaky'
  return 'Not attempted'
}
