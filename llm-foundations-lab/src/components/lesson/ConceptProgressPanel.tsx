import { useMemo } from 'react'
import { Link } from '../layout/CourseLink.tsx'
import { GLOSSARY } from '../../content/glossary'
import { LESSONS } from '../../content/curriculum'
import { useProgress } from '../../state/hooks'
import { Badge, Panel, ProgressBar } from '../ui/primitives'

/**
 * Conceptual progress.
 *
 * Completing a lesson is a blunt measure: a reader who has finished the
 * alignment module has met a dozen new ideas, and one who has finished the
 * inference module has met a different dozen. This panel counts the *terms*
 * rather than the lessons, so the progress shown matches what was actually
 * learned, and it names the concepts that are still ahead.
 */
export function ConceptProgressPanel({ limit = 10 }: { limit?: number }) {
  const { isComplete } = useProgress()

  const { covered, upcoming, total } = useMemo(() => {
    const met = GLOSSARY.filter((entry) => isComplete(entry.lessonId))
    const notMet = GLOSSARY.filter((entry) => !isComplete(entry.lessonId))
    // The next concepts are the ones whose lesson comes soonest in the course.
    const order = new Map(LESSONS.map((lesson, index) => [lesson.id, index]))
    const sorted = [...notMet].sort(
      (a, b) => (order.get(a.lessonId) ?? 0) - (order.get(b.lessonId) ?? 0),
    )
    return { covered: met, upcoming: sorted, total: GLOSSARY.length }
  }, [isComplete])

  return (
    <Panel className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-fg">Concepts covered</h2>
        <span className="font-mono text-xs text-faint">
          {covered.length} of {total} terms
        </span>
      </div>
      <ProgressBar
        value={covered.length}
        max={total}
        tone="teal"
        ariaLabel={`Concepts covered: ${covered.length} of ${total}`}
      />
      <p className="text-xs text-muted">
        A term counts as covered once you have finished the lesson that introduces it. The lessons and the vocabulary are
        two different measures of the same progress.
      </p>

      {covered.length > 0 ? (
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-faint">Met so far</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {covered.slice(0, 18).map((entry) => (
              <Link key={entry.id} to={`/glossary?term=${entry.id}`} className="no-underline">
                <Badge tone="teal">{entry.term}</Badge>
              </Link>
            ))}
            {covered.length > 18 ? (
              <span className="self-center text-xs text-faint">and {covered.length - 18} more</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-faint">Next in line</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {upcoming.slice(0, limit).map((entry) => (
              <Link key={entry.id} to={`/glossary?term=${entry.id}`} className="no-underline">
                <Badge tone="neutral">{entry.term}</Badge>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  )
}
