/**
 * The learning path.
 *
 * The course is not a flat list: lessons have prerequisites, so the order a
 * learner should take them in is not simply the order they are numbered. This
 * module turns the curriculum plus the learner's progress into a path with a
 * clear state for every lesson, and picks the next one to study with a reason
 * that can be shown to the learner.
 *
 * The logic lives here rather than in a component so that it can be tested
 * without a browser.
 */
import type { LessonMeta } from '../content/curriculum'
import { summariseMastery, type MasterySummary } from './mastery'

export type PathStatus = 'done' | 'available' | 'blocked'

export interface PathStep {
  lesson: LessonMeta
  status: PathStatus
  /** Titles of the prerequisites that are not yet satisfied. */
  blockedBy: string[]
  /**
   * What the learner knows of this lesson, from the review record.
   *
   * It is null when the lesson has no questions yet, which is different from
   * a mastery of zero: that would say the learner has failed it.
   */
  mastery: MasterySummary | null
}

export interface PathRecommendation {
  lesson: LessonMeta
  /** Why this lesson, in one sentence. */
  reason: string
  /** The lessons that come before it on the path. */
  blockedBy: string[]
}

export interface LearningPath {
  steps: PathStep[]
  /** The lesson to study next, or null when the course is finished. */
  recommendation: PathRecommendation | null
  /** How many lessons are done, available and blocked. */
  counts: { done: number; available: number; blocked: number }
}

/**
 * Build the path.
 *
 * A lesson is *available* when every prerequisite is complete, *done* when the
 * lesson itself is complete, and *blocked* otherwise. A lesson with no
 * prerequisites is always available.
 *
 * The mastery of each lesson comes from the review record: how many times in
 * a row its questions have been recalled, how well they are sticking, and how
 * long ago they were last seen.
 */
export function buildLearningPath(
  lessons: readonly LessonMeta[],
  isComplete: (lessonId: string) => boolean,
  reviewStates: Record<
    string,
    { repetitions: number; easeFactor: number; lastReviewedAt: string | null }
  > = {},
  now: Date = new Date(),
  needsWork: (lessonId: string) => boolean = () => false,
): LearningPath {
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]))

  const steps: PathStep[] = lessons.map((lesson) => {
    const mastery = summariseMastery(lesson.quizIds, reviewStates, now)
    if (isComplete(lesson.id)) {
      return { lesson, status: 'done', blockedBy: [], mastery }
    }
    const blockedBy = lesson.prerequisites
      .filter((id) => !isComplete(id))
      .map((id) => byId.get(id)?.title ?? id)
    return {
      lesson,
      status: blockedBy.length === 0 ? 'available' : 'blocked',
      blockedBy,
      mastery,
    }
  })

  const counts = {
    done: steps.filter((step) => step.status === 'done').length,
    available: steps.filter((step) => step.status === 'available').length,
    blocked: steps.filter((step) => step.status === 'blocked').length,
  }

  return { steps, recommendation: recommendNext(steps, counts, needsWork), counts }
}

/**
 * Pick the next lesson to study.
 *
 * The rule is: take the first lesson that is available and not yet done, in
 * course order — unless the learner has told us they did not understand
 * something, in which case that lesson comes first.
 *
 * The second rule is the interesting one. A lesson the reader has rated "not
 * yet" on their self-explanation is the one they have said they do not
 * understand, and that is a stronger signal than the order of the course.
 * It is also the sort of signal a reader expects to be acted on: if they say
 * they did not get it and the course carries on regardless, the course is not
 * listening.
 */
export function recommendNext(
  steps: readonly PathStep[],
  counts?: { done: number; available: number; blocked: number },
  needsWork: (lessonId: string) => boolean = () => false,
): PathRecommendation | null {
  const available = steps.filter((step) => step.status === 'available')

  const shaky = available.find((step) => needsWork(step.lesson.id))
  if (shaky) {
    return {
      lesson: shaky.lesson,
      reason:
        'You said this one was not clear yet, so it is worth another look before you move on.',
      blockedBy: [],
    }
  }

  const available0 = available[0]
  if (available0) {
    return {
      lesson: available0.lesson,
      reason:
        available0.lesson.prerequisites.length === 0
          ? 'It has no prerequisites, so it is a fine place to start.'
          : `Its prerequisites are done, so it is ready to study.`,
      blockedBy: [],
    }
  }

  const unfinished = steps.find((step) => step.status === 'blocked')
  if (unfinished) {
    return {
      lesson: unfinished.lesson,
      reason: `Nothing is unblocked yet. This one is waiting on ${unfinished.blockedBy.join(', ')}.`,
      blockedBy: unfinished.blockedBy,
    }
  }

  void counts
  return null
}
