import { Suspense, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Link } from '../components/layout/CourseLink.tsx'
import { getLesson, getModule, lessonNeighbours, prerequisiteChain } from '../content/curriculum'
import { LESSON_BODIES } from '../content/lessons/registry'
import {
  CompletionBar,
  CopyrightNote,
  FurtherReading,
  ModuleCurrency,
  KnowledgeCheck,
  LessonNotes,
  LessonOutline,
  SourceReferences,
} from '../components/lesson/LessonChrome'
import { useProgress } from '../state/hooks'
import { ReadingProgress } from '../components/lesson/ReadingProgress'
import { ExplainBack } from '../components/lesson/ExplainBack'
import { Badge, Button, Panel } from '../components/ui/primitives'
import { NotFoundPage } from './NotFound'

export function LessonPage() {
  const { lessonId = '' } = useParams()
  const lesson = getLesson(lessonId)
  const { visit, isComplete, isBookmarked, bookmark } = useProgress()

  useEffect(() => {
    if (lesson) visit(lesson.id)
  }, [lesson, visit])

  if (!lesson) return <NotFoundPage message={`No lesson with the id “${lessonId}”.`} />

  const module = getModule(lesson.moduleId)
  const Body = LESSON_BODIES[lesson.id]
  const { previous, next } = lessonNeighbours(lesson.id)
  const prerequisites = prerequisiteChain(lesson.id)

  return (
    <article className="animate-rise space-y-6">
      <ReadingProgress />
      <header className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-faint">
          <Link to="/" className="hover:text-indigo">
            Home
          </Link>
          <span aria-hidden>/</span>
          <Link to={`/modules/${lesson.moduleId}`} className="hover:text-indigo">
            Module {module?.chapter}: {module?.title}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-muted">Lesson {lesson.number}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={module?.accent ?? 'indigo'}>chapter {module?.chapter}</Badge>
          <Badge tone="neutral">{lesson.minutes} min</Badge>
          {isComplete(lesson.id) ? <Badge tone="positive">completed</Badge> : null}
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{lesson.title}</h1>
        <p className="max-w-3xl text-sm text-muted sm:text-base">{lesson.subtitle}</p>
        <div className="flex flex-wrap items-center gap-2">
          <CompletionBar lesson={lesson} />
          <Button size="sm" variant="ghost" onClick={() => bookmark(lesson.id)}>
            {isBookmarked(lesson.id) ? '★ Remove bookmark' : '☆ Bookmark'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            Print / save as PDF
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="lesson-body min-w-0 space-y-8">
          <Panel>
            <h2 id="objectives" className="scroll-mt-24 font-display text-lg font-semibold text-fg">
              Objectives
            </h2>
            <p className="mt-1 text-xs text-faint">By the end of this lesson you should be able to:</p>
            <ul className="mt-3 space-y-1.5">
              {lesson.objectives.map((objective) => (
                <li key={objective} className="flex gap-2 text-sm text-muted">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo" />
                  {objective}
                </li>
              ))}
            </ul>
            {prerequisites.length > 0 ? (
              <p className="mt-3 text-xs text-faint">
                Prerequisites:{' '}
                {prerequisites.map((prerequisite, index) => (
                  <span key={prerequisite.id}>
                    {index > 0 ? ', ' : ''}
                    <Link to={`/lessons/${prerequisite.id}`} className="text-indigo hover:underline">
                      {prerequisite.title}
                    </Link>
                  </span>
                ))}
              </p>
            ) : (
              <p className="mt-3 text-xs text-faint">No prerequisites — this is a starting point.</p>
            )}
          </Panel>

          <section id="concepts" className="scroll-mt-24 space-y-6">
            {/*
              The body is loaded on demand, one module at a time, so that
              opening a lesson does not download the prose of the other
              seventeen.
            */}
            <Suspense fallback={<LessonSkeleton />}>
              {Body ? (
                <div data-testid="lesson-body">
                  <Body lesson={lesson} />
                </div>
              ) : (
                <p className="text-sm text-faint">Lesson content is missing.</p>
              )}
            </Suspense>
          </section>

          <ExplainBack lessonId={lesson.id} />

          <KnowledgeCheck lessonId={lesson.id} />

          <section id="further-reading" className="scroll-mt-24 space-y-4">
            <FurtherReading lesson={lesson} />
          </section>

          <SourceReferences refs={lesson.sourceRefs} />
          <ModuleCurrency moduleId={lesson.moduleId} />
          <LessonNotes lessonId={lesson.id} />
          <CopyrightNote />

          <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            {previous ? (
              <Link to={`/lessons/${previous.id}`} className="no-underline">
                <span className="block text-[11px] text-faint">Previous</span>
                <span className="text-sm text-indigo hover:underline">← {previous.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link to={`/lessons/${next.id}`} className="text-right no-underline">
                <span className="block text-[11px] text-faint">Next</span>
                <span className="text-sm text-indigo hover:underline">{next.title} →</span>
              </Link>
            ) : (
              <Link to="/practice" className="text-right no-underline">
                <span className="block text-[11px] text-faint">Finished the course?</span>
                <span className="text-sm text-indigo hover:underline">Take the full practice set →</span>
              </Link>
            )}
          </nav>
        </div>

        <aside className="hidden xl:block" data-print="hidden">
          <div className="sticky top-20 space-y-4">
            <LessonOutline lesson={lesson} />
          </div>
        </aside>
      </div>
    </article>
  )
}

/**
 * The placeholder shown while a lesson body loads.
 *
 * The bodies are loaded on demand, one module at a time. The placeholder has
 * the shape of the thing that is coming, so the page does not jump when the
 * text arrives.
 */
function LessonSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-5 w-1/3 animate-pulse-soft rounded bg-line-soft" />
      <div className="h-4 w-full animate-pulse-soft rounded bg-line-soft" />
      <div className="h-4 w-11/12 animate-pulse-soft rounded bg-line-soft" />
      <div className="h-4 w-4/5 animate-pulse-soft rounded bg-line-soft" />
    </div>
  )
}

export default LessonPage
