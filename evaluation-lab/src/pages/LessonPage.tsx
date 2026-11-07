import { useEffect, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SECTION_MAP, LESSONS, lessonById, moduleById } from '../content/curriculum'
import { GLOSSARY } from '../content/glossary'
import { QUIZ } from '../content/quiz'
import { useProgress } from '@llm-materials/course-ui'
import { Button, Callout, Panel, Stat } from '@llm-materials/course-ui'
import { MathBlock } from '@llm-materials/course-ui'
import { TextbookLink } from '@llm-materials/course-ui'

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const lesson = lessonId ? lessonById(lessonId) : undefined
  const { record, markLessonComplete, setBookmark } = useProgress()
  const startedAt = useRef(Date.now())

  useEffect(() => {
    startedAt.current = Date.now()
  }, [lessonId])

  if (!lesson) {
    return (
      <div className="page">
        <h1 className="page-title">No such lesson</h1>
        <p className="page-lede">
          <Link to="/lessons">Back to the lessons</Link>.
        </p>
      </div>
    )
  }

  const module = moduleById(lesson.moduleId)
  const progress = record.lessons[lesson.id]
  const glossaryTerms = GLOSSARY.filter((term) => lesson.glossaryTerms.includes(term.id))
  const questions = QUIZ.filter((question) => lesson.quizIds.includes(question.id))
  const index = LESSONS.findIndex((entry) => entry.id === lesson.id)
  const previous = index > 0 ? LESSONS[index - 1] : undefined
  const next = index >= 0 && index < LESSONS.length - 1 ? LESSONS[index + 1] : undefined

  const sources = useMemo(
    () =>
      lesson.sourceRefs.map((ref) => ({
        ...ref,
        known: ref.chapter === 2 && ref.section in SECTION_MAP,
      })),
    [lesson],
  )

  return (
    <div className="page lesson-page">
      <p className="eyebrow">{module ? module.title : ''}</p>
      <h1 className="page-title">{lesson.title}</h1>
      <p className="page-lede">{lesson.subtitle}</p>
      <TextbookLink appId="evaluation-lab" lesson={lesson} />

      <div className="stat-row">
        <Stat label="Reading time" value={`${lesson.minutes} min`} />
        <Stat label="Objectives" value={String(lesson.objectives.length)} />
        <Stat
          label="Status"
          value={progress?.complete ? 'Complete' : 'Not yet'}
          tone={progress?.complete ? 'good' : 'default'}
        />
      </div>

      <Panel title="What you will learn" accent={module?.accent}>
        <ul className="bullet-list">
          {lesson.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      </Panel>

      <Panel title="The ideas">
        <ul className="key-idea-list">
          {lesson.keyIdeas.map((idea) => (
            <li key={idea}>{idea}</li>
          ))}
        </ul>
      </Panel>

      <Panel title="The mathematics" accent="violet">
        <p className="body-text">
          The notation used throughout this course is the paper’s own. The two expressions below are the ones this
          lesson is about; the equation reference has the full derivations.
        </p>
        <MathBlock
          latex="q(\\mathbf{x}_t \\mid \\mathbf{x}_0) = \\mathcal{N}\\!\\left(\\mathbf{x}_t;\\, \\sqrt{\\bar{\\alpha}_t}\\,\\mathbf{x}_0,\\, (1 - \\bar{\\alpha}_t)\\mathbf{I}\\right)"
          caption="The closed form: the state at any step is a scaled copy of the data plus a scaled copy of a noise vector."
          label="The marginal distribution of the state at step t given the data."
        />
        <MathBlock
          latex="s_{\\mathrm{guided}}(\\mathbf{x}, c) = s_{\\mathrm{uncond}}(\\mathbf{x}) + w\\,\\left(s_{\\mathrm{cond}}(\\mathbf{x}, c) - s_{\\mathrm{uncond}}(\\mathbf{x})\\right)"
          caption="The guided score, for the lessons that use it."
          label="The classifier-free guided score."
        />
      </Panel>

      <Panel title="Go and do it" accent="emerald">
        <p className="body-text">{lesson.interactive.description}</p>
        <Link className="btn btn-primary" to={`/labs/${lesson.interactive.lab}`}>
          Open {lesson.interactive.title}
        </Link>
      </Panel>

      <Panel title="Where this came from" accent="amber">
        <ul className="source-list">
          {sources.map((source) => (
            <li key={`${source.chapter}-${source.section}`}>
              <span className="source-label">
                §{source.section} {source.title}
                {source.page ? ` · p. ${source.page}` : ''}
              </span>
              <span className="source-note">{source.note}</span>
            </li>
          ))}
          {sources.length === 0 ? (
            <li className="muted">This lesson is drawn from the later papers; see the references for the details.</li>
          ) : null}
        </ul>
        {lesson.furtherReading.length > 0 ? (
          <>
            <h2 className="section-heading">Further reading</h2>
            <ul className="bullet-list">
              {lesson.furtherReading.map((entry) => (
                <li key={entry.href}>
                  <a href={entry.href} rel="noreferrer">
                    {entry.label}
                  </a>{' '}
                  <span className="muted">— {entry.note}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Panel>

      {glossaryTerms.length > 0 ? (
        <Panel title="The words this lesson uses">
          <dl className="glossary-inline">
            {glossaryTerms.map((term) => (
              <div key={term.id} className="glossary-inline-entry">
                <dt>{term.term}</dt>
                <dd>{term.short}</dd>
              </div>
            ))}
          </dl>
          <p className="muted">
            <Link to="/glossary">The full glossary</Link> has {GLOSSARY.length} terms, with the dependencies between
            them.
          </p>
        </Panel>
      ) : null}

      {questions.length > 0 ? (
        <Panel title="Check yourself" accent="teal">
          <p className="body-text">
            {questions.length} question{questions.length === 1 ? '' : 's'} from this lesson are in the practice bank.
          </p>
          <Link className="btn btn-default" to="/practice">
            Go to the practice bank
          </Link>
        </Panel>
      ) : null}

      <Callout tone="note" title="How to read this lesson">
        The prose here is written for this course; it is not a summary of the paper and it does not reproduce any of
        it. The equations are the paper’s, the derivations are on the equation reference page, and the figures in the
        laboratories are plots of computations made in your browser.
      </Callout>

      <div className="lesson-footer">
        <div>
          {previous ? (
            <Link className="btn btn-default" to={`/lessons/${previous.id}`}>
              ← {previous.title}
            </Link>
          ) : null}
        </div>
        <div className="button-row">
          <Button
            onClick={() => setBookmark(lesson.id, !(progress?.bookmarked ?? false))}
            variant="ghost"
          >
            {progress?.bookmarked ? 'Remove the bookmark' : 'Bookmark this lesson'}
          </Button>
          <Button
            variant="primary"
            onClick={() => markLessonComplete(lesson.id, Math.round((Date.now() - startedAt.current) / 1000))}
          >
            Mark as complete
          </Button>
        </div>
        <div>
          {next ? (
            <Link className="btn btn-default" to={`/lessons/${next.id}`}>
              {next.title} →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
