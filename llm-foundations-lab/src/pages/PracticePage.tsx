import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from '../components/layout/CourseLink.tsx'
import { LESSONS, MODULES, getLesson } from '../content/curriculum'
import { QUIZ_BANK, quizStats, type QuizQuestion, questionTone } from '../content/quiz'
import { useProgress } from '../state/hooks'
import { useNow } from '../state/useNow'
import { Badge, Button, Callout, Panel, ProgressBar, SegmentedControl, Stat } from '../components/ui/primitives'
import { DisplayMath } from '../components/ui/Math'
import { QuestionOptions } from '../components/practice/QuestionOptions'
import { AnswerFeedback } from '../components/practice/AnswerFeedback'
import {
  answerToQuality,
  initialReviewState,
  selectDueItems,
} from '../core/spacedRepetition'
import { interleave } from '../core/interleave'

type Scope = 'all' | 'unanswered' | 'incorrect' | 'bookmarked' | 'due'

export function PracticePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  /*
    The two filters are read from the address rather than held in state of
    their own.

    They were held in state, initialised from the address once, and that
    meant a reader who arrived at a link to a particular question set saw
    every question, and the back button did nothing. It also meant that
    changing one filter wrote the address out afresh and quietly dropped the
    other: narrowing to a lesson and then choosing a different question set
    lost the lesson.

    The address is where a filter belongs. It is what makes the link
    shareable, and it is the only place both filters can live at once.
  */
  const requestedScope = (searchParams.get('filter') as Scope | null) ?? 'all'
  const scope: Scope = (['all', 'unanswered', 'incorrect', 'bookmarked', 'due'] as Scope[]).includes(
    requestedScope,
  )
    ? requestedScope
    : 'all'
  const lessonFilter = searchParams.get('lesson') ?? 'all'

  /**
   * Changes one filter in the address, and leaves the other alone.
   */
  const setFilterParam = (key: 'filter' | 'lesson', value: string) => {
    const next = new URLSearchParams(searchParams)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setSearchParams(next)
  }

  const { summary, recordAnswer, progress, reviews, recordReview } = useProgress()
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [index, setIndex] = useState(0)
  const now = useNow()
  const shownAt = useRef(0)

  /** The questions the scheduler says are ready to be recalled. */
  const dueIds = useMemo(
    () =>
      new Set(
        selectDueItems(
          Object.fromEntries(
            QUIZ_BANK.map((question) => [question.id, reviews[question.id] ?? initialReviewState(now)]),
          ),
          now,
          QUIZ_BANK.length,
        ),
      ),
    [reviews, now],
  )

  /*
   * The questions in view.
   *
   * The order is interleaved by default: the questions of two lessons never
   * sit next to each other, so the reader has to work out which rule applies
   * before they can work out the answer. The evidence for that is strong
   * (Rohrer et al. 2015 and 2020; Faria and Yan 2022) and the cost is that
   * interleaved practice feels harder, which is why the page says so.
   *
   * A single lesson has nothing to interleave with, so a filtered set is left
   * in its authored order.
   */
  const questions = useMemo(() => {
    const filtered = QUIZ_BANK.filter((question) => {
      if (lessonFilter !== 'all' && question.lessonId !== lessonFilter) return false
      if (moduleFilter !== 'all' && question.moduleId !== moduleFilter) return false
      if (scope === 'unanswered') return !(question.id in summary.quizByQuestion)
      if (scope === 'incorrect') return summary.quizByQuestion[question.id] === false
      if (scope === 'bookmarked') {
        return progress.bookmarks.includes(question.lessonId)
      }
      if (scope === 'due') return dueIds.has(question.id)
      return true
    })
    if (lessonFilter !== 'all') return filtered
    return interleave(filtered, (question) => question.lessonId)
  }, [scope, moduleFilter, lessonFilter, summary.quizByQuestion, progress.bookmarks, dueIds])

  /**
   * The module where the learner is weakest, so the practice page can offer a
   * shortcut to it. A module only counts once at least one of its questions has
   * been answered; ties go to the earliest module, which keeps the suggestion
   * stable between visits.
   */
  /** The lessons the current module filter allows, for the lesson dropdown. */
  const lessonsInView = useMemo(
    () => LESSONS.filter((lesson) => moduleFilter === 'all' || lesson.moduleId === moduleFilter),
    [moduleFilter],
  )

  const weakest = useMemo(() => {    let best: {
      moduleId: string
      chapter: number
      title: string
      answered: number
      correct: number
      missed: number
      accuracy: number
    } | null = null
    for (const module of MODULES) {
      const moduleQuestions = QUIZ_BANK.filter((question) => question.moduleId === module.id)
      const answered = moduleQuestions.filter((question) => question.id in summary.quizByQuestion)
      if (answered.length === 0) continue
      const correct = answered.filter((question) => summary.quizByQuestion[question.id]).length
      const accuracy = correct / answered.length
      if (best === null || accuracy < best.accuracy) {
        best = {
          moduleId: module.id,
          chapter: module.chapter,
          title: module.title,
          answered: answered.length,
          correct,
          missed: answered.length - correct,
          accuracy,
        }
      }
    }
    return best
  }, [summary.quizByQuestion])

  // Changing the filter starts a fresh session. Adjusting the state during
  // render keeps the question list and the answers in step without an effect.
  const filterKey = `${scope}|${moduleFilter}`
  const [activeFilterKey, setActiveFilterKey] = useState(filterKey)
  if (activeFilterKey !== filterKey) {
    setActiveFilterKey(filterKey)
    setIndex(0)
    setAnswers({})
  }

  // The clock for the next answer restarts when the question changes.
  useEffect(() => {
    shownAt.current = Date.now()
  }, [index, scope, moduleFilter, lessonFilter])

  const answeredInSession = Object.keys(answers).length
  const correctInSession = Object.entries(answers).filter(([id, choice]) => {
    const question = QUIZ_BANK.find((item) => item.id === id)
    return question && choice === question.correctIndex
  }).length

  const current = questions[Math.min(index, Math.max(0, questions.length - 1))]
  const teachingLesson = current ? getLesson(current.lessonId) : undefined
  const stats = quizStats()

  const answer = (question: QuizQuestion, choice: number) => {
    setAnswers((current) => ({ ...current, [question.id]: choice }))
    const correct = choice === question.correctIndex
    recordAnswer({ questionId: question.id, correct, answerIndex: choice })
    /*
     * Every attempt is also a review, so the spaced-repetition schedule
     * reflects what the reader actually did rather than only what they did
     * in a dedicated review session.
     */
    const seconds = (Date.now() - shownAt.current) / 1000
    recordReview(question.id, answerToQuality(correct, seconds))
  }

  return (
    <div className="animate-rise space-y-5">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">Practice</h1>
        <p className="max-w-3xl text-sm text-muted">
          {stats.total} questions across {stats.lessons} lessons, of which {stats.calculations} require an actual
          calculation. Answers are graded immediately, every option carries a diagnosis, and your results are recorded in
          the local progress file.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Answered overall" value={`${summary.questionsAnswered} / ${stats.total}`} tone="indigo" />
        <Stat label="Accuracy overall" value={`${(summary.accuracy * 100).toFixed(0)}%`} tone="teal" />
        <Stat label="This session" value={`${correctInSession} / ${answeredInSession}`} tone="amber" />
        <Stat label="Questions in view" value={questions.length} />
      </div>

      <Panel className="space-y-3">
        <div className="flex flex-wrap items-end gap-4">
          <SegmentedControl
            label="Question set"
            value={scope}
            onChange={(next) => {
              setFilterParam('filter', next)
            }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'unanswered', label: 'Unanswered' },
              { value: 'incorrect', label: 'Incorrect' },
              { value: 'bookmarked', label: 'Bookmarked lessons' },
              { value: 'due', label: 'Due for review' },
            ]}
          />
          <label className="text-xs text-muted">
            Module
            <select
              value={moduleFilter}
              onChange={(event) => {
                setModuleFilter(event.target.value)
                setFilterParam('lesson', 'all')
              }}
              className="ml-1 rounded-lg border border-control bg-panel-2 px-2 py-1.5 text-xs text-fg"
            >
              <option value="all">all modules</option>
              {MODULES.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.chapter}. {module.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Lesson
            <select
              value={lessonFilter}
              onChange={(event) => {
                setFilterParam('lesson', event.target.value)
              }}
              className="ml-1 rounded-lg border border-control bg-panel-2 px-2 py-1.5 text-xs text-fg"
              data-testid="lesson-filter"
            >
              <option value="all">all lessons</option>
              {lessonsInView.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.number}. {lesson.title}
                </option>
              ))}
            </select>
          </label>
          {weakest ? (
            <Button
              size="sm"
              onClick={() => {
                setModuleFilter(weakest.moduleId)
                setFilterParam('filter', weakest.missed > 0 ? 'incorrect' : 'unanswered')
              }}
              title="Jump to the module where your answers are weakest"
            >
              Practise my weakest module
            </Button>
          ) : null}
        </div>
        {weakest ? (
          <p className="text-xs text-faint">
            Your weakest module is {weakest.chapter}. {weakest.title} — {weakest.correct} of{' '}
            {weakest.answered} answered correctly
            {weakest.missed > 0 ? `, ${weakest.missed} still wrong.` : '.'}
          </p>
        ) : null}
        <ProgressBar
          value={answeredInSession}
          max={questions.length}
          label={`Session progress · ${answeredInSession} of ${questions.length} attempted`}
          tone="teal"
        />
        {lessonFilter === 'all' && questions.length > 1 ? (
          <p className="text-xs text-faint">
            The questions are interleaved: two of them are never from the same lesson, so you have to work out
            which rule applies before you can work out the answer. It feels harder than a run of one topic, and
            that is the point — interleaved practice is better remembered than blocked practice.
          </p>
        ) : null}
      </Panel>

      {questions.length === 0 ? (
        <Callout tone="amber" title="Nothing to show">
          No questions match this filter. Try “All”, or answer a few knowledge checks first.
        </Callout>
      ) : current ? (
        <Panel className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="indigo">
                question {Math.min(index + 1, questions.length)} / {questions.length}
              </Badge>
              <Badge tone={questionTone(current.kind)}>{current.kind}</Badge>
              <span className="font-mono text-[11px] text-faint">
                §{current.source.section} · p.{current.source.page}
              </span>
              {teachingLesson ? (
                <Link
                  to={`/lessons/${teachingLesson.id}`}
                  className="text-[11px] text-indigo underline underline-offset-2"
                >
                  taught in {teachingLesson.title}
                </Link>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
                ← previous
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                disabled={index >= questions.length - 1}
              >
                next →
              </Button>
            </div>
          </div>

          <p className="text-base font-medium text-fg">{current.prompt}</p>
          {current.tex ? <DisplayMath tex={current.tex} /> : null}

          <QuestionOptions
            question={current}
            chosen={answers[current.id]}
            onChoose={(choice) => answer(current, choice)}
            disabled={answers[current.id] !== undefined}
          />

          {answers[current.id] !== undefined ? (
            <AnswerFeedback question={current} chosen={answers[current.id]} />
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={index >= questions.length - 1}
            >
              Next question
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAnswers({})}>
              Clear session answers
            </Button>
            <Link to="/dashboard" className="text-xs text-indigo hover:underline">
              See all results on the dashboard
            </Link>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <h2 className="font-display text-lg font-semibold text-fg">Question map</h2>
        <p className="mt-1 text-xs text-muted">Colour shows your latest recorded answer for each question.</p>
        <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-10 lg:grid-cols-13">
          {questions.map((question, questionIndex) => {
            const result = summary.quizByQuestion[question.id]
            const tone =
              result === true
                ? 'bg-teal-strong text-white'
                : result === false
                  ? 'bg-rose text-white'
                  : 'bg-line-soft text-faint'
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => setIndex(questionIndex)}
                title={question.prompt}
                data-lesson={question.lessonId}
                className={`h-8 rounded-lg text-[10px] font-mono ${tone} ${
                  questionIndex === index ? 'ring-2 ring-indigo' : ''
                }`}
              >
                {questionIndex + 1}
              </button>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}

export default PracticePage
