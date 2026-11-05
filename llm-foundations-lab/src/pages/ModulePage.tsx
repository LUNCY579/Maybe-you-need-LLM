import { useParams } from 'react-router-dom'
import { Link } from '../components/layout/CourseLink.tsx'
import { getModule, lessonsForModule, LESSONS } from '../content/curriculum'
import { formulasForLesson, glossaryForLesson } from '../content/glossary'
import { useProgress } from '../state/hooks'
import { buildLearningPath } from '../core/path'
import { Badge, Button, Panel, ProgressBar } from '../components/ui/primitives'
import { MisconceptionPanel } from '../components/lesson/MisconceptionPanel'
import { ModuleCurrency } from '../components/lesson/LessonChrome'
import { NotFoundPage } from './NotFound'

export function ModulePage() {
  const { moduleId = '' } = useParams()
  const module = getModule(moduleId)
  const { isComplete } = useProgress()

  if (!module) return <NotFoundPage message={`No module with the id “${moduleId}”.`} />

  const lessons = lessonsForModule(module.id)
  const completed = lessons.filter((lesson) => isComplete(lesson.id)).length
  const chapterLessons = LESSONS.filter((lesson) => lesson.moduleId === module.id)
  const terms = Array.from(
    new Map(chapterLessons.flatMap((lesson) => glossaryForLesson(lesson.id)).map((entry) => [entry.id, entry])).values(),
  )
  const formulas = Array.from(
    new Map(chapterLessons.flatMap((lesson) => formulasForLesson(lesson.id)).map((entry) => [entry.id, entry])).values(),
  )

  /*
   * The module shows the learner's place in the course, not just the module's
   * contents: which lessons are done, which are ready, and which are still
   * waiting on a prerequisite. The "start" button points at the next lesson
   * that is actually ready, not always at the first one.
   */
  const path = buildLearningPath(LESSONS, isComplete)
  const stepFor = (lessonId: string) => path.steps.find((step) => step.lesson.id === lessonId)
  const nextInModule =
    path.steps.find((step) => step.lesson.moduleId === module.id && step.status === 'available') ??
    path.steps.find((step) => step.lesson.moduleId === module.id && step.status === 'blocked')
  const startLesson = nextInModule?.lesson ?? lessons[0]

  return (
    <div className="animate-rise space-y-6">
      <header className="space-y-3">
        <nav aria-label="Breadcrumb" className="text-xs text-faint">
          <Link to="/" className="hover:text-indigo">
            Home
          </Link>{' '}
          <span aria-hidden>/</span> <span className="text-muted">Module {module.chapter}</span>
        </nav>
        <Badge tone={module.accent}>chapter {module.chapter} · {module.pages}</Badge>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">{module.title}</h1>
        <p className="max-w-3xl text-base text-muted">{module.tagline}</p>
        <div className="max-w-md">
          <ProgressBar value={completed} max={lessons.length} label={`${completed} of ${lessons.length} lessons complete`} tone="teal" />
        </div>
      </header>

      <ModuleCurrency moduleId={module.id} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel>
          <h2 className="font-display text-lg font-semibold text-fg">Module summary</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{module.summary}</p>
          <h3 className="mt-4 font-mono text-[11px] uppercase tracking-wider text-faint">Learning outcomes</h3>
          <ul className="mt-2 space-y-1.5">
            {module.outcomes.map((outcome) => (
              <li key={outcome} className="flex gap-2 text-sm text-muted">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                {outcome}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-semibold text-fg">In this module</h2>
          <ul className="mt-2 space-y-2 text-sm">
            <li className="text-muted">
              Lessons: <span className="font-mono text-fg">{lessons.length}</span>
            </li>
            <li className="text-muted">
              Quiz items:{' '}
              <span className="font-mono text-fg">
                {lessons.reduce((sum, lesson) => sum + lesson.quizIds.length, 0)}
              </span>
            </li>
            <li className="text-muted">
              Glossary terms: <span className="font-mono text-fg">{terms.length}</span>
            </li>
            <li className="text-muted">
              Formulas: <span className="font-mono text-fg">{formulas.length}</span>
            </li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to={`/lessons/${startLesson?.id}`} className="no-underline">
              <Button size="sm" variant="primary">
                {completed === lessons.length
                  ? `Review lesson ${startLesson?.number}`
                  : completed > 0
                    ? `Continue with lesson ${startLesson?.number}`
                    : `Start lesson ${startLesson?.number}`}
              </Button>
            </Link>
            <Link to="/practice" className="no-underline">
              <Button size="sm">Practise this module</Button>
            </Link>
          </div>
          {nextInModule && nextInModule.status === 'blocked' ? (
            <p className="mt-2 text-xs text-amber">
              Lesson {nextInModule.lesson.number} is waiting on {nextInModule.blockedBy.join(', ')}.
            </p>
          ) : null}
        </Panel>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-fg">Lessons</h2>
        <div className="grid gap-3">
          {lessons.map((lesson) => (
            <Panel key={lesson.id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={isComplete(lesson.id) ? 'positive' : 'neutral'}>
                    {isComplete(lesson.id) ? '✓ complete' : `lesson ${lesson.number}`}
                  </Badge>
                  {stepFor(lesson.id)?.status === 'available' ? <Badge tone="indigo">ready</Badge> : null}
                  {stepFor(lesson.id)?.status === 'blocked' ? (
                    <Badge tone="amber" title={`Waiting on ${stepFor(lesson.id)?.blockedBy.join(', ')}`}>
                      blocked
                    </Badge>
                  ) : null}
                  <span className="font-mono text-[11px] text-faint">{lesson.minutes} min</span>
                </div>
                <h3 className="mt-2 font-display text-lg font-semibold text-fg">
                  <Link to={`/lessons/${lesson.id}`} className="hover:text-indigo">
                    {lesson.title}
                  </Link>
                </h3>
                <p className="mt-1 text-sm text-muted">{lesson.subtitle}</p>
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {lesson.objectives.slice(0, 2).map((objective) => (
                    <li key={objective}>· {objective}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-faint">
                  Interactive: {lesson.interactive.title} · Source: §{lesson.sourceRefs[0].section} (p.
                  {lesson.sourceRefs[0].page})
                </p>
              </div>
              <Link to={`/lessons/${lesson.id}`} className="shrink-0 no-underline">
                <Button size="sm" variant={isComplete(lesson.id) ? 'secondary' : 'primary'}>
                  {isComplete(lesson.id) ? 'Review' : 'Start'}
                </Button>
              </Link>
            </Panel>
          ))}
        </div>
      </section>

      <MisconceptionPanel module={module} />

      <Panel>
        <h2 className="font-display text-lg font-semibold text-fg">Vocabulary and formulas introduced here</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {terms.map((term) => (
            <Link key={term.id} to={`/glossary?term=${term.id}`} className="no-underline">
              <Badge tone="neutral">{term.term}</Badge>
            </Link>
          ))}
        </div>
        {formulas.length > 0 ? (
          <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {formulas.map((formula) => (
              <li key={formula.id} className="text-xs">
                <Link to={`/math?formula=${formula.id}`} className="text-indigo hover:underline">
                  {formula.name}
                </Link>
                <span className="ml-1 text-faint">§{formula.section}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </div>
  )
}

export default ModulePage
