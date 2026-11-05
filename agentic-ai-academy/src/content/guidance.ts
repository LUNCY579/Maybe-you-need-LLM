import { LESSONS } from './lessons'
import { LABS } from './labs'
import { buildReviewQueue, lessonMastery } from './review'
import type { ProgressState } from '../store/progressState'

/**
 * "What should I do next?"
 *
 * A progress dashboard that only shows percentages tells a student *where*
 * they are but not *what to do*. This module turns the recorded activity into
 * a short, ordered list of concrete next actions.
 *
 * The rules are deliberately few, explicit and ordered by how much they
 * unblock:
 *
 *  1. Something is due for review — review it now.
 *  2. A lesson is half-done — finish it.
 *  3. A lesson has been read but not assessed — take its questions.
 *  4. A lesson is complete but its objectives are unticked — tick them.
 *  5. A lab that has never been run is available.
 *  6. Otherwise — the next unread lesson.
 *
 * It is a pure function so the ordering can be asserted in tests.
 */

export interface NextAction {
  id: string
  /** A short imperative label. */
  title: string
  /** One sentence explaining why this is next. */
  detail: string
  /** Where the action takes the student. */
  route: string
  /** How strongly this is recommended. */
  priority: 'high' | 'medium' | 'low'
  kind: 'review' | 'lesson' | 'assessment' | 'objective' | 'lab' | 'course'
}

export function nextActions(state: ProgressState, limit = 5): NextAction[] {
  const actions: NextAction[] = []

  const review = buildReviewQueue(state)
  if (review.length > 0) {
    const oldest = review[0]
    actions.push({
      id: 'review',
      title: `Review ${review.length} question${review.length === 1 ? '' : 's'}`,
      detail: `Your most recent attempt at "${oldest.question.prompt}" was wrong ${oldest.daysSince} day${oldest.daysSince === 1 ? '' : 's'} ago. Answering it correctly clears it from the queue.`,
      route: '/assessments?tab=review',
      priority: 'high',
      kind: 'review',
    })
  }

  const mastery = new Map(LESSONS.map((lesson) => [lesson.slug, lessonMastery(lesson.slug, state)]))
  const completed = new Set(state.completedLessons)
  const attemptedQuestions = new Set(state.quizAttempts.map((attempt) => attempt.questionId))

  for (const lesson of LESSONS) {
    const record = mastery.get(lesson.slug)!
    const lessonAttempted = lesson.quiz.some((question) => attemptedQuestions.has(question.id))

    // A lesson that is ticked off but whose objectives are not all marked is
    // half-finished in the sense that matters.
    if (completed.has(lesson.slug) && !record.mastered && record.objectivesChecked < record.objectivesTotal) {
      actions.push({
        id: `objectives:${lesson.slug}`,
        title: `Tick the remaining objectives in “${lesson.title}”`,
        detail: `${record.objectivesChecked} of ${record.objectivesTotal} objectives are marked as understood. A lesson counts as mastered when the objectives and the questions are both done.`,
        route: `/lesson/${lesson.slug}`,
        priority: 'medium',
        kind: 'objective',
      })
      continue
    }

    if (!completed.has(lesson.slug)) {
      // A lesson that has been assessed but not ticked off is further along
      // than one that has never been opened.
      if (lessonAttempted) {
        actions.push({
          id: `finish:${lesson.slug}`,
          title: `Finish “${lesson.title}”`,
          detail: 'You have already tried this lesson’s questions. Reading it through and marking the objectives completes it.',
          route: `/lesson/${lesson.slug}`,
          priority: 'high',
          kind: 'lesson',
        })
      } else {
        actions.push({
          id: `read:${lesson.slug}`,
          title: `Read “${lesson.title}”`,
          detail: `Lesson ${lesson.order} of ${LESSONS.length}. ${lesson.minutes} minutes, and every concept links to its definition in place.`,
          route: `/lesson/${lesson.slug}`,
          priority: 'medium',
          kind: 'lesson',
        })
      }
      continue
    }

    // Completed, but never assessed.
    if (!lessonAttempted) {
      actions.push({
        id: `assess:${lesson.slug}`,
        title: `Take the questions for “${lesson.title}”`,
        detail: 'You have marked this lesson complete but not answered any of its questions yet. The questions check whether the ideas stuck.',
        route: `/lesson/${lesson.slug}?tab=quiz`,
        priority: 'medium',
        kind: 'assessment',
      })
    }
  }

  const usedLabs = new Set(state.labActivity.map((entry) => entry.labId))
  for (const lab of LABS) {
    if (usedLabs.has(lab.id)) continue
    actions.push({
      id: `lab:${lab.id}`,
      title: `Try ${lab.name}`,
      detail: `${lab.tagline}. ${lab.runtime}.`,
      route: lab.route,
      priority: 'low',
      kind: 'lab',
    })
  }

  // The shape of the whole course. It is the one action that is not about
  // the next hour but about the next month, so it sits at the bottom.
  // Both numbers are read from the content modules rather than written down,
  // so the sentence cannot fall behind a new laboratory.
  const totalMinutes = LESSONS.reduce((sum, lesson) => sum + lesson.minutes, 0)
  const hours = Math.round(totalMinutes / 60)
  actions.push({
    id: 'study-plan',
    title: 'See the whole course as a plan',
    detail: `The course is ${hours} hours of reading and ${LABS.length} laboratories. The study plan packs them into weeks for the time you have.`,
    route: '/curriculum?view=study-plan',
    priority: 'low',
    kind: 'course',
  })

  const order: Record<NextAction['priority'], number> = { high: 0, medium: 1, low: 2 }
  actions.sort((a, b) => order[a.priority] - order[b.priority])

  /*
   * Keep the list varied.
   *
   * Without a cap, a student with twelve unread lessons sees twelve identical
   * "read the next lesson" entries and never learns that there are laboratories
   * to run. At most two entries of each kind are kept, so the list always
   * shows a range of useful things to do.
   */
  const perKind = new Map<NextAction['kind'], number>()
  const varied = actions.filter((action) => {
    const count = perKind.get(action.kind) ?? 0
    if (count >= 2) return false
    perKind.set(action.kind, count + 1)
    return true
  })

  if (varied.length === 0) {
    varied.push({
      id: 'course-complete',
      title: 'The course is complete',
      detail: 'Every lesson is read, every objective is ticked and every question has been answered correctly. The final project is the natural next step.',
      route: '/project',
      priority: 'low',
      kind: 'course',
    })
  }

  return varied.slice(0, limit)
}
/** How many lessons the student has fully mastered. */
export function masteredLessonCount(state: ProgressState): number {
  return LESSONS.filter((lesson) => lessonMastery(lesson.slug, state).mastered).length
}
