import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from '../layout/CourseLink.tsx'
import { useCourseNavigate } from '../layout/useCourseNavigate'
import type { LessonMeta, ModuleId, SourceRef } from '../../content/curriculum'
import { getModule } from '../../content/curriculum'
import { questionsForLesson, questionTone } from '../../content/quiz'
import { formulasForLesson, glossaryForLesson } from '../../content/glossary'
import { CONFIDENCE_LABEL, MODULE_STATUS } from '../../content/status'
import { useProgress } from '../../state/hooks'
import { Badge, Button, Callout, Panel } from '../ui/primitives'
import { DisplayMath } from '../ui/Math'
import { annotateConcepts } from './annotate'
import { answerToQuality } from '../../core/spacedRepetition'
import { scrollToSection } from '../layout/scrollToSection'

/* --------------------------------------------------------------- Structure */

export function LessonSection({
  id,
  kicker,
  title,
  children,
}: {
  id?: string
  kicker?: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="lesson-section scroll-mt-24">
      <h2 className="font-display text-lg font-semibold tracking-tight text-fg sm:text-xl">
        {kicker ? <span className="mr-2 font-mono text-xs uppercase tracking-wider text-teal">{kicker}</span> : null}
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted [&_strong]:text-fg">{children}</div>
    </section>
  )
}

export function Prose({ children }: { children: ReactNode }) {
  // Technical terms are linked at their first mention in the section, so the
  // reader can check a definition without leaving the lesson.
  const annotated = useMemo(() => annotateConcepts(children, new Set<string>()), [children])
  return <div className="space-y-3 text-[15px] leading-relaxed text-muted [&_strong]:text-fg">{annotated}</div>
}

export function Intro({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-relaxed text-muted [&_strong]:text-fg">{children}</p>
}

export function KeyIdeaList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm leading-relaxed text-muted">
          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function InteractiveExercise({
  id,
  title,
  description,
  children,
}: {
  /** Anchor target, so the in-page outline can link to this exercise. */
  id?: string
  title: string
  description: ReactNode
  children: ReactNode
}) {
  return (
    <div id={id} className="rounded-2xl border border-indigo/30 bg-indigo/5 p-4 sm:p-5">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-indigo">Interactive exercise</p>
      <h3 className="font-display text-base font-semibold text-fg">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  )
}

export function WorkedExample({
  id,
  title,
  children,
}: {
  /** Anchor target, so the in-page outline can link to this example. */
  id?: string
  title: string
  children: ReactNode
}) {
  return (
    <div id={id} className="rounded-2xl border border-amber/30 bg-amber/5 p-4 sm:p-5">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-amber">Worked example</p>
      <h3 className="font-display text-base font-semibold text-fg">{title}</h3>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted [&_strong]:text-fg">{children}</div>
    </div>
  )
}

export function FigurePlaceholderNote({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-faint">{children}</p>
}

/* ------------------------------------------------------------ Knowledge check */

export function KnowledgeCheck({ lessonId }: { lessonId: string }) {
  const questions = useMemo(() => questionsForLesson(lessonId), [lessonId])
  const { recordAnswer, recordReview } = useProgress()
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const shownAt = useRef<Record<string, number>>({})

  if (questions.length === 0) return null

  return (
    <section id="knowledge-check" className="scroll-mt-24">
      <h2 className="font-display text-lg font-semibold tracking-tight text-fg sm:text-xl">
        <span className="mr-2 font-mono text-xs uppercase tracking-wider text-teal">Check</span>
        Knowledge check
      </h2>
      <p className="mt-2 text-sm text-muted">
        {questions.length} question{questions.length === 1 ? '' : 's'} — answers are graded locally and recorded in your
        progress file. Wrong options carry a specific diagnosis.
      </p>
      <p className="mt-2 text-sm text-muted">
        Want more on this lesson?{' '}
        <Link
          to={`/practice?lesson=${lessonId}`}
          className="text-indigo underline underline-offset-2"
        >
          Open every question from it in the practice set
        </Link>
        .
      </p>
      <div className="mt-4 space-y-4">
        {questions.map((question) => {
          const selected = answers[question.id]
          const isRevealed = revealed[question.id] ?? false
          return (
            <div key={question.id} className="rounded-2xl border border-line bg-panel/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={questionTone(question.kind)}>{question.kind}</Badge>
                <span className="font-mono text-[11px] text-faint">
                  §{question.source.section} · p.{question.source.page}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-fg">{question.prompt}</p>
              {question.tex ? <DisplayMath tex={question.tex} /> : null}
              <ul className="mt-3 space-y-1.5">
                {question.options.map((option, index) => {
                  const isChosen = selected === index
                  const isCorrect = index === question.correctIndex
                  const tone = !isRevealed
                    ? isChosen
                      ? 'border-indigo bg-indigo/5'
                      : 'border-line hover:border-indigo/40'
                    : isCorrect
                      ? 'border-teal bg-teal/5'
                      : isChosen
                        ? 'border-rose bg-rose/5'
                        : 'border-line'
                  return (
                    <li key={index}>
                      <button
                        type="button"
                        onClick={() => {
                          setAnswers((current) => ({ ...current, [question.id]: index }))
                          setRevealed((current) => ({ ...current, [question.id]: true }))
                          recordAnswer({ questionId: question.id, correct: isCorrect, answerIndex: index })
                          /*
                           * A knowledge check is a review, so it moves the
                           * question's place in the spaced-repetition
                           * schedule just as a practice session does.
                           */
                          const seen = shownAt.current[question.id]
                          const seconds = seen === undefined ? 0 : (Date.now() - seen) / 1000
                          shownAt.current[question.id] = Date.now()
                          recordReview(question.id, answerToQuality(isCorrect, seconds))
                        }}
                        aria-pressed={isChosen}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${tone}`}
                      >
                        <span className="mr-2 font-mono text-xs text-faint">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="text-fg">{option}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {isRevealed && selected !== undefined ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p className={selected === question.correctIndex ? 'text-positive' : 'text-rose'}>
                    {selected === question.correctIndex ? 'Correct. ' : 'Not quite. '}
                    {question.explanation}
                  </p>
                  <p className="text-xs text-muted">
                    <span className="text-faint">Feedback on your choice: </span>
                    {question.feedback[selected]}
                  </p>
                  {selected !== question.correctIndex ? (
                    <p className="text-xs text-muted">
                      <span className="text-faint">Correct option: </span>
                      {question.feedback[question.correctIndex]}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- References */

export function SourceReferences({ refs }: { refs: SourceRef[] }) {
  return (
    <Panel as="aside">
      <h3 className="font-display text-sm font-semibold text-fg">Source sections</h3>
      <p className="mt-1 text-xs text-muted">
        Every claim in this lesson is traceable to a section of <em>Foundations of Large Language Models</em> (Tong Xiao
        and Jingbo Zhu, arXiv:2501.09223v4). Page numbers refer to that revision.
      </p>
      <ul className="mt-3 space-y-2">
        {refs.map((ref) => (
          <li key={`${ref.section}-${ref.page}`} className="rounded-xl border border-control bg-panel-2/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="teal">
                §{ref.section} · p.{ref.page}
              </Badge>
              <span className="text-xs font-medium text-fg">{ref.title}</span>
              <span className="font-mono text-[11px] text-faint">chapter {ref.chapter}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{ref.note}</p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/* ------------------------------------------------------------- Currency */

/**
 * How settled the module this lesson belongs to is.
 *
 * A lesson says what is taught. It does not say how much weight to put on
 * it, and that is a different question: a mechanism that has been stable
 * for a decade and a result that is three months old are not the same kind
 * of thing. The course answers that question on a page of its own, and this
 * panel is that page's answer, put where the reader is when they are reading
 * the lesson rather than a click away.
 */
export function ModuleCurrency({ moduleId }: { moduleId: string }) {
  const status = MODULE_STATUS.find((entry) => entry.moduleId === moduleId)
  const module = getModule(moduleId as ModuleId)
  const navigate = useCourseNavigate()
  if (!status || !module) return null

  const tone =
    status.confidence === 'settled' ? 'teal' : status.confidence === 'settling' ? 'amber' : 'rose'

  return (
    <Panel as="aside">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-sm font-semibold text-fg">How settled is this?</h3>
        <Badge tone={tone}>{CONFIDENCE_LABEL[status.confidence]}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted">
        Module {module.chapter} teaches what the book establishes. Here is what has moved since, and the primary
        sources for it.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted">{status.moving}</p>
      <Link
        to="/status"
        className="mt-3 inline-block text-xs text-indigo no-underline hover:underline"
        onClick={(event) => {
          /*
            The status page is a hash route, so the fragment of the address
            is the route. A plain "#alignment" would replace it and take the
            reader out of the course. The address keeps the route and names
            the module, and the router puts the reader at that module.
          */
          event.preventDefault()
          navigate({ pathname: '/status', hash: `#${moduleId}` })
        }}
      >
        Read the sources for module {module.chapter} →
      </Link>
    </Panel>
  )
}

export function FurtherReading({ lesson }: { lesson: LessonMeta }) {  const formulas = formulasForLesson(lesson.id)
  const terms = glossaryForLesson(lesson.id)
  return (
    <div className="split-2">
      <Panel>
        <h3 className="font-display text-sm font-semibold text-fg">Further reading</h3>
        <ul className="mt-3 space-y-2">
          {lesson.furtherReading.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm text-indigo hover:underline"
              >
                {item.label} ↗
              </a>
              <p className="text-xs text-muted">{item.note}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-faint">
          Linked papers are third-party works under their own licences and are not redistributed by this site.
        </p>
      </Panel>
      <Panel>
        <h3 className="font-display text-sm font-semibold text-fg">Terms and formulas in this lesson</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {terms.map((term) => (
            <Link key={term.id} to={`/glossary?term=${term.id}`} className="no-underline">
              <Badge tone="neutral">{term.term}</Badge>
            </Link>
          ))}
        </div>
        {formulas.length > 0 ? (
          <ul className="mt-3 space-y-1.5 text-xs text-muted">
            {formulas.map((formula) => (
              <li key={formula.id}>
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

/* --------------------------------------------------------------- Notes */

export function LessonNotes({ lessonId }: { lessonId: string }) {
  const { progress, updateNote } = useProgress()
  const stored = progress.notes[lessonId] ?? ''
  const [value, setValue] = useState(stored)
  // Adjust the state while rendering when the lesson changes, rather than in an
  // effect: this is React's documented pattern for derived state and it avoids
  // an extra render pass with stale text.
  const [syncedLessonId, setSyncedLessonId] = useState(lessonId)
  if (syncedLessonId !== lessonId) {
    setSyncedLessonId(lessonId)
    setValue(stored)
  }

  return (
    <Panel>
      <h3 className="font-display text-sm font-semibold text-fg">Your notes</h3>
      <p className="mt-1 text-xs text-muted">
        Stored in your browser with the rest of your progress and included in the JSON export.
      </p>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => updateNote(lessonId, value)}
        rows={3}
        aria-label="Lesson notes"
        className="mt-2 w-full resize-y rounded-xl border border-control bg-panel-2 px-3 py-2 text-sm text-fg focus:border-indigo focus:outline-none"
      />
    </Panel>
  )
}

/** The sections a lesson page is divided into, in page order. */
const LESSON_SECTIONS = [
  { id: 'objectives', label: 'Objectives' },
  { id: 'concepts', label: 'Concepts' },
  { id: 'exercise', label: 'Interactive exercise' },
  { id: 'worked-example', label: 'Worked example' },
  { id: 'explain-back', label: 'Explain it back' },
  { id: 'knowledge-check', label: 'Knowledge check' },
  { id: 'further-reading', label: 'Further reading' },
]

/**
 * Sticky in-page navigation for a long lesson.
 *
 * The outline tracks the reader: the section currently in view is highlighted,
 * so a long lesson always shows where you are. The tracking uses an
 * IntersectionObserver rather than a scroll listener, so it does not fire on
 * every scroll event.
 */
export function LessonOutline({ lesson }: { lesson: LessonMeta }) {
  const sections = LESSON_SECTIONS

  const [activeId, setActiveId] = useState<string>(sections[0].id)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        // Highlight the first section that is on screen; when several are
        // visible at once, the earliest in the page order wins.
        const first = sections.find((section) => visible.has(section.id))
        if (first) setActiveId(first.id)
      },
      // A band across the upper third of the viewport: a section counts as
      // "current" once its heading reaches that band.
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    )
    for (const section of sections) {
      const element = document.getElementById(section.id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [sections])

  return (
    <nav aria-label="On this page" className="hidden xl:block">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">On this page</p>
      <ul className="space-y-1.5">
        {sections.map((section) => {
          const active = activeId === section.id
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={active ? 'true' : undefined}
                onClick={(event) => {
                  /*
                   * The application uses a hash router, so the fragment of the
                   * address is the route. A plain `href="#section"` would
                   * replace the whole fragment and navigate away from the
                   * lesson, and writing only "#section" into the address
                   * would leave a link that cannot be reloaded or shared. The
                   * link scrolls the section into view instead, and the
                   * address keeps the route.
                   */
                  event.preventDefault()
                  if (!scrollToSection(section.id)) return
                  setActiveId(section.id)
                }}
                className={`text-xs transition-colors ${
                  active ? 'font-medium text-indigo' : 'text-muted hover:text-indigo'
                }`}
              >
                {section.label}
              </a>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-faint">Lesson</p>
      <p className="mt-1 text-xs text-muted">
        Module {lesson.number} · {lesson.minutes} min
      </p>
    </nav>
  )
}

export function CompletionBar({ lesson }: { lesson: LessonMeta }) {
  const { isComplete, complete, reset } = useProgress()
  const done = isComplete(lesson.id)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant={done ? 'secondary' : 'primary'} onClick={() => (done ? reset(lesson.id) : complete(lesson.id))}>
        {done ? 'Mark as not finished' : 'Mark lesson complete'}
      </Button>
      {done ? <Badge tone="positive">completed</Badge> : <Badge tone="neutral">in progress</Badge>}
    </div>
  )
}

export function CopyrightNote() {
  return (
    <Callout tone="amber" title="Adapted educational material">
      This lesson is original writing by the LLM Foundations Lab, grounded in and citing <em>Foundations of Large
      Language Models</em> by Tong Xiao and Jingbo Zhu (arXiv:2501.09223v4), which is licensed CC BY-NC 4.0. No figures,
      tables or extended passages from the book are reproduced. Interactive figures are computed from the algorithms
      described in the cited sections. See the{' '}
      <Link to="/sources" className="underline">
        sources and attribution
      </Link>{' '}
      page for full details.
    </Callout>
  )
}
