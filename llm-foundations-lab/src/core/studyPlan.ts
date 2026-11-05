/**
 * The study plan.
 *
 * A course that can be studied in an hour and a course that can only be
 * studied in three hours are not the same course. Most people learn in short
 * sessions, and a list of eighteen lessons does not help somebody who has
 * twenty minutes and a train to catch.
 *
 * This module turns the learner's state into a plan for the session: what to
 * review, what to read, what to answer, and how long each takes. The plan
 * fits the time the reader says they have, and says what does not fit.
 *
 * The order is not arbitrary. It follows what the learning sciences say
 * about when each kind of work does the most good:
 *
 * 1. **Review first.** A question that is about to be forgotten is worth
 *    more than a question that has not been asked yet, because the forgetting
 *    is what the schedule is trying to prevent.
 * 2. **Then read.** New material is best learned while the older material is
 *    still warm.
 * 3. **Then explain.** Writing an explanation of what was just read is what
 *    makes it stick, and it is short.
 * 4. **Then practise.** New questions, on the part of the course where the
 *    reader is weakest.
 *
 * The plan is a *suggestion*. Every item says why it is there, and every
 * item is a link, so a reader who disagrees can simply do the thing they
 * wanted to do instead.
 */

export type StudyPlanKind = 'review' | 'read' | 'explain' | 'practice'

/** A step of the plan, before it is marked against the time available. */
export interface StudyPlanDraft {
  kind: StudyPlanKind
  /** What the reader should do, in a few words. */
  title: string
  /** The detail of it — the count, the lesson, the module. */
  detail: string
  /** Why this is here, in one sentence. */
  reason: string
  /** How long it should take, in minutes. */
  minutes: number
  /** Where it happens. */
  href: string
}

export interface StudyPlanItem extends StudyPlanDraft {
  /**
   * Whether it fits in the time the reader said they had.
   *
   * An item that does not fit is still shown, marked as being for later.
   * Hiding it would be worse: a reader who is short of time should be able
   * to see what they are missing and choose to do it anyway.
   */
  fits: boolean
}

export interface StudyPlanInput {
  /** How many questions the scheduler says are ready for review. */
  dueCount: number
  /** The lesson the learning path says to study next. */
  nextLesson: { id: string; title: string; minutes: number } | null
  /** Whether the reader has already explained that lesson back. */
  nextLessonExplained: boolean
  /** The module the reader is weakest in, if any. */
  weakest: { title: string; questionCount: number } | null
  /** The time the reader has, in minutes. `null` means as long as they like. */
  minutesAvailable: number | null
}

/** How long a question takes, in minutes, including reading the feedback. */
const MINUTES_PER_QUESTION = 0.8
/** The shortest review session worth offering. */
const MINIMUM_REVIEW_MINUTES = 3
/** The shortest practice session worth offering. */
const MINIMUM_PRACTICE_MINUTES = 5

export function buildStudyPlan(input: StudyPlanInput): StudyPlanItem[] {
  const items: StudyPlanDraft[] = []

  if (input.dueCount > 0) {
    const minutes = Math.max(MINIMUM_REVIEW_MINUTES, Math.round(input.dueCount * MINUTES_PER_QUESTION))
    items.push({
      kind: 'review',
      title: `Review ${input.dueCount} question${input.dueCount === 1 ? '' : 's'}`,
      detail: 'The ones you are about to forget',
      reason: 'A question that is about to be forgotten is worth more than one you have never seen.',
      minutes,
      href: '/review',
    })
  }

  if (input.nextLesson) {
    items.push({
      kind: 'read',
      title: `Read “${input.nextLesson.title}”`,
      detail: `About ${input.nextLesson.minutes} minutes`,
      reason: 'New material is learned best while the older material is still warm.',
      minutes: input.nextLesson.minutes,
      href: `/lessons/${input.nextLesson.id}`,
    })
    if (!input.nextLessonExplained) {
      items.push({
        kind: 'explain',
        title: `Explain “${input.nextLesson.title}” back`,
        detail: 'One question, in your own words',
        reason: 'Writing the explanation is what makes it stick; reading one does not.',
        minutes: 3,
        href: `/lessons/${input.nextLesson.id}#explain-back`,
      })
    }
  }

  if (input.weakest && input.dueCount === 0) {
    items.push({
      kind: 'practice',
      title: `Practise ${input.weakest.title}`,
      detail: `${input.weakest.questionCount} questions, interleaved`,
      reason: 'It is the module you are weakest in, and mixing topics is better remembered than one at a time.',
      minutes: Math.max(MINIMUM_PRACTICE_MINUTES, Math.round(input.weakest.questionCount * MINUTES_PER_QUESTION)),
      href: '/practice',
    })
  }

  return markWhatFits(items, input.minutesAvailable)
}

/**
 * Mark the items that fit in the time available.
 *
 * The items are taken in order, and the time is used up as they are taken.
 * An item that does not fit is not dropped: it is marked as being for later,
 * and a shorter item after it may still fit in the time that is left. A
 * reader with fifteen minutes who cannot read a whole lesson can still
 * explain the last one back, and that is worth doing.
 */
export function markWhatFits(items: StudyPlanDraft[], minutesAvailable: number | null): StudyPlanItem[] {
  if (minutesAvailable === null) {
    return items.map((item) => ({ ...item, fits: true }))
  }
  let used = 0
  return items.map((item) => {
    const fits = used + item.minutes <= minutesAvailable
    if (fits) used += item.minutes
    return { ...item, fits }
  })
}

/** The total time the plan takes. */
export function planMinutes(items: StudyPlanItem[]): number {
  return items.reduce((total, item) => total + item.minutes, 0)
}

/** The time the plan takes, counting only what fits. */
export function plannedMinutes(items: StudyPlanItem[]): number {
  return items.filter((item) => item.fits).reduce((total, item) => total + item.minutes, 0)
}

/** A sentence describing the plan, for the reader who only reads the first line. */
export function summarisePlan(items: StudyPlanItem[], minutesAvailable: number | null): string {
  if (items.length === 0) return 'Nothing is waiting for you. The course is done.'
  const first = items[0]
  if (minutesAvailable === null) {
    return `${first.title}, then ${items.length - 1} more step${items.length === 2 ? '' : 's'}.`
  }
  const fits = items.filter((item) => item.fits)
  if (fits.length === 0) {
    return `Nothing fits in ${minutesAvailable} minutes. Start with “${first.title}” anyway.`
  }
  const minutes = plannedMinutes(items)
  const rest = fits.length - 1
  if (rest === 0) {
    return `${first.title} — about ${minutes} minute${minutes === 1 ? '' : 's'}.`
  }
  return `${first.title}, then ${rest} more step${rest === 1 ? '' : 's'} — about ${minutes} minute${minutes === 1 ? '' : 's'} in all.`
}
