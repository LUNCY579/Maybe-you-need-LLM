import { useMemo, useState } from 'react'
import { navigate } from '../../app/router'
import { PLAN_OPTIONS, studyPlan } from '../../content/studyPlan'
import { Badge, Button, Card, Panel } from '../primitives'
import { useProgress } from '../../store/progress'

/**
 * The study plan.
 *
 * The course is a stack of hours: the lessons, the laboratories and a builder.
 * That is a fact about the content, and it is not a plan: a student with three
 * hours a week and a student with nine hours a week need different evenings,
 * and both need to know what to do in one.
 *
 * The plan is derived from the content — the lesson order, the estimated
 * minutes, and which laboratory goes with which lesson — so it cannot drift
 * away from the curriculum. Changing the pace changes the packing; it does
 * not change what a week is for.
 */
export function StudyPlanView() {
  const progress = useProgress()
  const [hours, setHours] = useState(3)
  const plan = useMemo(() => studyPlan(hours), [hours])

  const done = new Set(progress.state.completedLessons)

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">How much time do you have?</h2>
            <p className="text-muted mt-1 text-xs">
              The plan is built from the lessons themselves: their order, their estimated minutes, and the
              laboratory that goes with each. Change the pace and the packing changes; what a week is for does not.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hours per week">
            {PLAN_OPTIONS.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={option === hours ? 'primary' : 'secondary'}
                aria-pressed={option === hours}
                onClick={() => setHours(option)}
              >
                {option} h / week
              </Button>
            ))}
          </div>
        </div>
        <p className="text-muted text-xs">
          {plan.weekCount} week{plan.weekCount === 1 ? '' : 's'} · {Math.round(plan.totalMinutes / 60)} hours of
          reading in total · {plan.weeks.flatMap((week) => week.labs).length} laboratories
        </p>
      </Card>

      <ol className="space-y-3">
        {plan.weeks.map((week) => {
          const weekDone = week.lessons.every((lesson) => done.has(lesson.slug))
          return (
            <li key={week.week}>
              <Panel
                title={`Week ${week.week} · ${week.title}`}
                subtitle={`${week.minutes} minutes of reading${week.labs.length > 0 ? `, and ${week.labs.length} laborator${week.labs.length === 1 ? 'y' : 'ies'}` : ''}`}
              >
                <div className="space-y-3">
                  <ul className="space-y-1.5 text-sm">
                    {week.lessons.map((lesson) => {
                      const finished = done.has(lesson.slug)
                      return (
                        <li key={lesson.slug} className="flex flex-wrap items-baseline gap-2">
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/lesson/${lesson.slug}`)}>
                            {lesson.title}
                          </Button>
                          <span className="text-muted text-[11px]">{lesson.minutes} min</span>
                          {finished ? <Badge tone="emerald">done</Badge> : null}
                        </li>
                      )
                    })}
                  </ul>

                  {week.labs.length > 0 ? (
                    <div className="border-t pt-2" style={{ borderColor: 'var(--border-soft)' }}>
                      <p className="text-muted text-[11px] font-semibold uppercase">Run these</p>
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {week.labs.map((lab) => (
                          <li key={lab.id}>
                            <Button size="sm" variant="secondary" onClick={() => navigate(`/${lab.route}`)}>
                              {lab.name}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <p className="text-muted border-t pt-2 text-xs leading-relaxed" style={{ borderColor: 'var(--border-soft)' }}>
                    <span className="font-medium text-[var(--text-strong)]">By the end of this week you can</span>{' '}
                    {week.outcome.toLowerCase()}
                  </p>

                  {weekDone ? <Badge tone="emerald">this week is done</Badge> : null}
                </div>
              </Panel>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
