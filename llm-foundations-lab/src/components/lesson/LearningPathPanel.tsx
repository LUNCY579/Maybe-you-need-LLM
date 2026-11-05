import { Link } from '../layout/CourseLink.tsx'
import { MODULES, LESSONS } from '../../content/curriculum'
import { buildLearningPath, type PathStep } from '../../core/path'
import { describeMastery } from '../../core/mastery'
import { useProgress } from '../../state/hooks'
import { useNow } from '../../state/useNow'
import { Badge, Panel } from '../ui/primitives'

/**
 * The learner's path through the course.
 *
 * It shows which lessons are done, which are ready, and which are waiting on a
 * prerequisite — and says which one to study next and why. Without this, the
 * numbered order looks like the only order, and a learner who starts in the
 * middle has no way to tell what they should go back to.
 */
export function LearningPathPanel({ compact = false }: { compact?: boolean }) {
  const { isComplete, reviews, explanations } = useProgress()
  const now = useNow()
  /*
   * A lesson the reader has said they did not understand comes first, whatever
   * the course order says. It is the one signal in the record that the reader
   * has volunteered, and a course that ignores it is not listening.
   */
  const needsWork = (lessonId: string) => explanations[lessonId]?.rating === 'not-yet'
  const path = buildLearningPath(LESSONS, isComplete, reviews, now, needsWork)

  if (!path.recommendation) {
    return (
      <Panel>
        <h2 className="font-display text-lg font-semibold text-fg">Your path</h2>
        <p className="mt-1 text-sm text-muted">
          Every lesson is complete. The full practice set covers all six modules — that is the natural next step.
        </p>
        <Link
          to="/practice"
          className="mt-3 inline-block text-sm text-indigo underline underline-offset-2"
        >
          Take the full practice set →
        </Link>
      </Panel>
    )
  }

  const recommendation = path.recommendation

  return (
    <Panel className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-fg">Your path</h2>
        <p className="mt-1 text-sm text-muted">
          {path.counts.done} of {LESSONS.length} lessons done · {path.counts.available} ready to study ·{' '}
          {path.counts.blocked} waiting on a prerequisite.
        </p>
      </div>

      <div className="rounded-xl border border-indigo/30 bg-indigo/5 p-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-indigo">Study next</p>
        <p className="mt-1 text-sm text-fg">
          <Link to={`/lessons/${recommendation.lesson.id}`} className="font-medium text-indigo underline underline-offset-2">
            {recommendation.lesson.title}
          </Link>
        </p>
        <p className="mt-1 text-xs text-muted">{recommendation.reason}</p>
        {recommendation.blockedBy.length > 0 ? (
          <p className="mt-1 text-xs text-amber">
            Waiting on: {recommendation.blockedBy.join(', ')}
          </p>
        ) : null}
      </div>

      {compact ? null : (
        <ol className="space-y-2">
          {MODULES.map((module) => {
            const steps = path.steps.filter((step) => step.lesson.moduleId === module.id)
            return (
              <li key={module.id}>
                <p className="font-mono text-[11px] uppercase tracking-wider text-faint">
                  {module.chapter}. {module.title}
                </p>
                <ul className="mt-1 space-y-1">
                  {steps.map((step) => (
                    <PathRow key={step.lesson.id} step={step} />
                  ))}
                </ul>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}

function PathRow({ step }: { step: PathStep }) {
  const { lesson, status, blockedBy, mastery } = step
  const tone = status === 'done' ? 'positive' : status === 'available' ? 'indigo' : 'neutral'
  const label = status === 'done' ? 'done' : status === 'available' ? 'ready' : 'blocked'
  /*
   * The mastery of the lesson, when it has one. A lesson that has not been
   * attempted has no mastery, which is different from a mastery of zero.
   */
  const masteryText = mastery && mastery.score !== null ? describeMastery(mastery) : null
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <Badge tone={tone}>{label}</Badge>
      {status === 'blocked' ? (
        <span className="text-faint" title={`Waiting on ${blockedBy.join(', ')}`}>
          {lesson.title}
        </span>
      ) : (
        <Link to={`/lessons/${lesson.id}`} className="text-fg hover:text-indigo hover:underline">
          {lesson.title}
        </Link>
      )}
      {masteryText ? (
        <span
          className={`text-[11px] ${
            masteryText === 'Shaky' || masteryText === 'Not attempted' ? 'text-amber' : 'text-faint'
          }`}
          title={`${mastery?.mastered ?? 0} of ${lesson.quizIds.length} questions in good shape`}
        >
          {masteryText}
        </span>
      ) : null}
    </li>
  )
}
