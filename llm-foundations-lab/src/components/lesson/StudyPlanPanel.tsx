import { useMemo, useState } from 'react'
import { Link } from '../layout/CourseLink.tsx'
import { LESSONS, MODULES } from '../../content/curriculum'
import { QUIZ_BANK } from '../../content/quiz'
import { buildLearningPath } from '../../core/path'
import { buildStudyPlan, planMinutes, summarisePlan } from '../../core/studyPlan'
import { countDueForReview } from '../../core/spacedRepetition'
import { useNow } from '../../state/useNow'
import { useProgress } from '../../state/hooks'
import { Badge, Panel } from '../ui/primitives'

/**
 * What to do now.
 *
 * A course of eighteen lessons is not a plan for somebody who has twenty
 * minutes. This panel turns the learner's state into a session: what to
 * review, what to read, what to answer, and how long each takes.
 *
 * The reader says how long they have, and the plan is marked against it.
 * Everything is still shown — an item that does not fit is marked as being
 * for later rather than hidden, because a reader who is short of time should
 * be able to see what they are missing and choose to do it anyway.
 */

/** The time budgets offered. `null` means as long as they like. */
const BUDGETS: { label: string; minutes: number | null }[] = [
  { label: '10 min', minutes: 10 },
  { label: '20 min', minutes: 20 },
  { label: '45 min', minutes: 45 },
  { label: 'As long as I like', minutes: null },
]

export function StudyPlanPanel() {
  const { isComplete, reviews, explanations, summary } = useProgress()
  const now = useNow()
  const [budget, setBudget] = useState<number | null>(20)

  const plan = useMemo(() => {
    const path = buildLearningPath(LESSONS, isComplete, reviews, now)
    const next = path.recommendation?.lesson ?? null

    /*
     * How many questions have been learned and are now at risk of being
     * forgotten. A question that has never been asked is not at risk, so a
     * reader who has just started is not told to review fifty-two questions
     * before reading a page.
     */
    const dueCount = countDueForReview(
      QUIZ_BANK.map((question) => question.id),
      reviews,
      now,
    ).due

    // The module the reader is weakest in, but only once there is something
    // in the record to be weak in.
    const answered = summary.questionsAnswered
    let weakest: { title: string; questionCount: number } | null = null
    if (answered > 0) {
      let best: { title: string; questionCount: number; accuracy: number } | null = null
      for (const module of MODULES) {
        const questions = QUIZ_BANK.filter((question) => question.moduleId === module.id)
        const done = questions.filter((question) => question.id in summary.quizByQuestion)
        if (done.length === 0) continue
        const correct = done.filter((question) => summary.quizByQuestion[question.id]).length
        const accuracy = correct / done.length
        if (!best || accuracy < best.accuracy) {
          best = { title: module.title, questionCount: questions.length, accuracy }
        }
      }
      if (best) weakest = { title: best.title, questionCount: best.questionCount }
    }

    return buildStudyPlan({
      dueCount,
      nextLesson: next ? { id: next.id, title: next.title, minutes: next.minutes } : null,
      nextLessonExplained: next ? Boolean(explanations[next.id]) : false,
      weakest,
      minutesAvailable: budget,
    })
  }, [isComplete, reviews, explanations, summary, now, budget])

  const total = planMinutes(plan)
  const fitting = plan.filter((item) => item.fits)

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-fg">What to do now</h2>
          <p className="mt-1 text-sm text-muted">{summarisePlan(plan, budget)}</p>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="How long you have">
          {BUDGETS.map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={budget === option.minutes}
              onClick={() => setBudget(option.minutes)}
              className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                budget === option.minutes
                  ? 'border-indigo bg-indigo/15 text-indigo'
                  : 'border-control text-muted hover:border-indigo/50 hover:text-fg'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {plan.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing is waiting for you. Every lesson is done and nothing is due for review.
        </p>
      ) : (
        <ol className="space-y-2">
          {plan.map((item) => (
            <li
              key={item.kind}
              className={`rounded-xl border p-3 ${
                item.fits ? 'border-line bg-panel-2/40' : 'border-dashed border-line bg-transparent'
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  to={item.href}
                  className={`text-sm font-medium no-underline hover:underline ${
                    item.fits ? 'text-fg' : 'text-muted'
                  }`}
                >
                  {item.title}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={item.fits ? 'indigo' : 'neutral'}>
                    {item.fits ? `${item.minutes} min` : 'for later'}
                  </Badge>
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">{item.detail}</p>
              <p className="mt-1 text-xs text-faint">{item.reason}</p>
            </li>
          ))}
        </ol>
      )}

      {plan.length > 0 ? (
        <p className="text-xs text-faint">
          {fitting.length} of {plan.length} step{plan.length === 1 ? '' : 's'} fit in the time you have
          {budget === null ? '' : `, about ${fitting.reduce((sum, item) => sum + item.minutes, 0)} minutes`}. The
          whole plan is about {total} minutes.
        </p>
      ) : null}
    </Panel>
  )
}
