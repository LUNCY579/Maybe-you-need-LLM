/**
 * Spaced repetition for the question bank.
 *
 * The scheduler is SM-2, the algorithm behind SuperMemo and the default in
 * Anki: it tracks three numbers per item — how many times in a row the item
 * has been recalled, how easy the item is, and how long to wait before the
 * next review — and updates them from the quality of each recall.
 *
 * Spacing works because recall is cheapest just before forgetting. The
 * scheduling rule here is the one Anki uses, which differs from the original
 * SuperMemo description in one respect: a failed review resets the repetition
 * count and the interval but does not keep reducing the ease factor. Without
 * that rule, a hard item ends up in "low interval hell" and comes back every
 * few minutes for weeks.
 *
 * The ease factor never falls below 1.3, for the same reason SuperMemo chose
 * that floor: below it, the intervals shrink so far that the item is
 * effectively re-learned from scratch every session.
 *
 * The newer FSRS scheduler fits a two-parameter memory model to the whole
 * review history instead of summarising it in one number. That is a better
 * algorithm, and it needs far more review data than a reader of one course
 * will generate, so this course uses SM-2.
 */

/** How well an item was recalled, on the 0–5 scale SM-2 uses. */
export type RecallQuality = 0 | 1 | 2 | 3 | 4 | 5

export interface ReviewState {
  /** Times recalled correctly in a row. Reset to 0 by a lapse. */
  repetitions: number
  /** How easy the item is. Starts at 2.5, never below 1.3. */
  easeFactor: number
  /** Days until the next review. */
  intervalDays: number
  /** When the item was last reviewed, or null if it never has been. */
  lastReviewedAt: string | null
  /** When the item is next due. */
  dueAt: string
}

export const INITIAL_EASE = 2.5
export const MINIMUM_EASE = 1.3
/** The longest gap the scheduler will ever schedule. */
export const MAXIMUM_INTERVAL_DAYS = 365 * 2
const DAY_MS = 24 * 60 * 60 * 1000

export function initialReviewState(now: Date = new Date()): ReviewState {
  return {
    repetitions: 0,
    easeFactor: INITIAL_EASE,
    intervalDays: 0,
    lastReviewedAt: null,
    // A new item is due immediately.
    dueAt: now.toISOString(),
  }
}

/**
 * Map a quiz outcome onto SM-2's quality scale.
 *
 * A correct answer is worth more when it was quick, because speed is part of
 * what the ease factor is meant to capture. A wrong answer is a lapse, and a
 * skipped question is a failure to produce anything at all.
 */
export function answerToQuality(
  correct: boolean,
  timeSpentSeconds: number,
  difficulty = 2,
): RecallQuality {
  if (!correct) return timeSpentSeconds < 0 ? 0 : 1
  // A hard question that was still answered correctly is worth less.
  const penalty = difficulty >= 3 ? 1 : 0
  if (timeSpentSeconds >= 0 && timeSpentSeconds < 10) return (5 - penalty) as RecallQuality
  if (timeSpentSeconds < 30) return (4 - penalty) as RecallQuality
  return (3 - penalty) as RecallQuality
}

/**
 * Apply one review.
 *
 * This is SM-2 as described in the SuperMemo documentation and implemented by
 * Anki, with the two refinements noted above: the ease factor has a floor of
 * 1.3, and a lapse does not itself reduce the ease factor.
 */
export function reviewItem(
  state: ReviewState,
  quality: RecallQuality,
  now: Date = new Date(),
): ReviewState {
  const passed = quality >= 3
  let repetitions: number
  let intervalDays: number
  let easeFactor: number

  if (passed) {
    if (state.repetitions === 0) {
      intervalDays = 1
    } else if (state.repetitions === 1) {
      intervalDays = 6
    } else {
      intervalDays = Math.round(state.intervalDays * state.easeFactor)
    }
    repetitions = state.repetitions + 1
    const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    easeFactor = Math.max(MINIMUM_EASE, state.easeFactor + delta)
  } else {
    // A lapse: start the item again, but keep the ease factor.
    repetitions = 0
    intervalDays = 1
    easeFactor = state.easeFactor
  }

  intervalDays = Math.max(1, Math.min(MAXIMUM_INTERVAL_DAYS, intervalDays))

  return {
    repetitions,
    easeFactor: Math.round(easeFactor * 1000) / 1000,
    intervalDays,
    lastReviewedAt: now.toISOString(),
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
  }
}

/** Is this item due for review at the given moment? */
export function isDue(state: ReviewState, now: Date = new Date()): boolean {
  return new Date(state.dueAt).getTime() <= now.getTime()
}

/** Has this question been asked at least once? */
export function hasBeenSeen(state: ReviewState): boolean {
  return state.lastReviewedAt !== null
}

/**
 * Is this question one the reader has learned and is now at risk of losing?
 *
 * A question that has never been asked is not at risk of being forgotten:
 * it has not been learned yet. It is still worth asking — the review session
 * offers it — but calling it "due" would be a lie, and a plan that said
 * "review 52 questions" to somebody who has not read a page would be
 * nonsense rather than advice.
 */
export function isDueForReview(state: ReviewState, now: Date = new Date()): boolean {
  return hasBeenSeen(state) && isDue(state, now)
}

/**
 * How many of a set of questions are due for review.
 *
 * The count is of questions that have been learned and are now at risk. The
 * questions that have never been asked are counted separately, because they
 * are new material rather than a review.
 */
export function countDueForReview(
  questionIds: string[],
  states: Record<string, ReviewState>,
  now: Date = new Date(),
): { due: number; unseen: number; scheduled: number } {
  let due = 0
  let unseen = 0
  let scheduled = 0
  for (const id of questionIds) {
    const state = states[id]
    if (!state || !hasBeenSeen(state)) {
      unseen += 1
      continue
    }
    if (isDue(state, now)) due += 1
    else scheduled += 1
  }
  return { due, unseen, scheduled }
}

/**
 * Has this item already been reviewed today?
 *
 * A question is reviewed once a day. Answering the same question twice in one
 * sitting tests nothing new, and letting it count would push the next review
 * further out each time, so the schedule would drift away from what the
 * learner actually knows.
 */
export function reviewedToday(state: ReviewState, now: Date = new Date()): boolean {
  if (!state.lastReviewedAt) return false
  const last = new Date(state.lastReviewedAt)
  if (Number.isNaN(last.getTime())) return false
  return (
    last.getFullYear() === now.getFullYear() &&
    last.getMonth() === now.getMonth() &&
    last.getDate() === now.getDate()
  )
}

/** How overdue an item is, in days. Negative means it is not yet due. */
export function daysOverdue(state: ReviewState, now: Date = new Date()): number {
  return (now.getTime() - new Date(state.dueAt).getTime()) / DAY_MS
}

/**
 * Choose the items to review.
 *
 * The order is: the most overdue first, then, among equally overdue items, the
 * ones that have never been seen, then the least recently reviewed. Overdue
 * dominates because that is the whole point of spacing — an item that is about
 * to be forgotten is worth more attention than a brand new one.
 */
export function selectDueItems(
  states: Record<string, ReviewState>,
  now: Date = new Date(),
  limit = 20,
): string[] {
  const entries = Object.entries(states)
  const due = entries.filter(([, state]) => isDue(state, now))
  due.sort(([, a], [, b]) => {
    const overdue = daysOverdue(b, now) - daysOverdue(a, now)
    if (Math.abs(overdue) > 0.001) return overdue
    const aSeen = a.lastReviewedAt ? 1 : 0
    const bSeen = b.lastReviewedAt ? 1 : 0
    if (aSeen !== bSeen) return aSeen - bSeen
    return (a.lastReviewedAt ?? '').localeCompare(b.lastReviewedAt ?? '')
  })
  return due.slice(0, limit).map(([id]) => id)
}

/**
 * A short description of where an item stands, for the interface.
 */
export function describeState(state: ReviewState, now: Date = new Date()): string {
  if (!state.lastReviewedAt) return 'new'
  const overdue = daysOverdue(state, now)
  if (overdue > 1) return `${Math.floor(overdue)} days overdue`
  if (overdue > 0) return 'due now'
  if (state.intervalDays === 1) return 'due tomorrow'
  return `due in ${state.intervalDays} days`
}

/**
 * Parse a stored review state, discarding anything malformed.
 *
 * A review state is a convenience, not a record of what the learner did, so a
 * corrupt entry is dropped rather than repaired.
 */
export function parseReviewState(value: unknown): ReviewState | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const { repetitions, easeFactor, intervalDays, lastReviewedAt, dueAt } = record
  if (typeof repetitions !== 'number' || !Number.isFinite(repetitions)) return null
  if (typeof easeFactor !== 'number' || !Number.isFinite(easeFactor)) return null
  if (typeof intervalDays !== 'number' || !Number.isFinite(intervalDays)) return null
  if (typeof dueAt !== 'string') return null
  return {
    repetitions: Math.max(0, Math.floor(repetitions)),
    easeFactor: Math.max(MINIMUM_EASE, easeFactor),
    intervalDays: Math.max(0, Math.floor(intervalDays)),
    lastReviewedAt: typeof lastReviewedAt === 'string' ? lastReviewedAt : null,
    dueAt,
  }
}
