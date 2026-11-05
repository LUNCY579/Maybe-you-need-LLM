import { useMemo, useState } from 'react'
import { gradeAnswer, summariseQuiz } from '@llm-materials/course-core'
import type { GradedAnswer } from '@llm-materials/course-core'
import { QUIZ } from '../content/quiz'
import { useProgress } from '@llm-materials/course-ui'
import { Button, Callout, Panel, SegmentedControl, Stat } from '@llm-materials/course-ui'

type Filter = 'all' | 'unanswered' | 'incorrect' | 'correct'

export function PracticePage() {
  const { record, recordQuizAnswer } = useProgress()
  const [filter, setFilter] = useState<Filter>('all')
  const [results, setResults] = useState<Record<string, GradedAnswer>>({})

  const answered = useMemo(() => {
    const map: Record<string, { correct: boolean }> = {}
    for (const [id, entry] of Object.entries(record.quiz)) {
      map[id] = { correct: entry.correct }
    }
    return map
  }, [record.quiz])

  const questions = useMemo(() => {
    if (filter === 'all') return QUIZ
    if (filter === 'unanswered') return QUIZ.filter((question) => !answered[question.id])
    if (filter === 'correct') return QUIZ.filter((question) => answered[question.id]?.correct)
    return QUIZ.filter((question) => answered[question.id] && !answered[question.id].correct)
  }, [filter, answered])

  const summary = useMemo(() => summariseQuiz(QUIZ, answered), [answered])

  const submit = (questionId: string, given: unknown) => {
    const question = QUIZ.find((entry) => entry.id === questionId)
    if (!question) return
    const graded = gradeAnswer(question, given)
    setResults((current) => ({ ...current, [questionId]: graded }))
    recordQuizAnswer(questionId, graded.correct)
  }

  return (
    <div className="page">
      <h1 className="page-title">Practice</h1>
      <p className="page-lede">
        {QUIZ.length} questions from the lessons. Every one carries an explanation and a citation, and the numeric
        questions have tolerances tight enough that a plausible guess fails.
      </p>

      <div className="stat-row">
        <Stat label="Answered" value={`${summary.answered} / ${QUIZ.length}`} />
        <Stat label="Correct" value={String(summary.correct)} />
        <Stat
          label="Accuracy"
          value={`${(summary.accuracy * 100).toFixed(1)}%`}
          tone={summary.accuracy > 0.8 ? 'good' : 'default'}
        />
        <Stat
          label="Still to try"
          value={String(QUIZ.length - summary.answered)}
        />
      </div>

      <div className="lab-controls">
        <SegmentedControl
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'unanswered', label: 'Unanswered' },
            { value: 'incorrect', label: 'To revisit' },
            { value: 'correct', label: 'Correct' },
          ]}
        />
      </div>

      {questions.length === 0 ? (
        <Callout tone="note" title="Nothing here">
          There are no questions in this filter. Try another one.
        </Callout>
      ) : null}

      {questions.map((question) => (
        <QuestionCard key={question.id} question={question} onSubmit={submit} result={results[question.id]} />
      ))}
    </div>
  )
}

function QuestionCard({
  question,
  onSubmit,
  result,
}: {
  question: (typeof QUIZ)[number]
  onSubmit: (id: string, given: unknown) => void
  result?: GradedAnswer
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [numeric, setNumeric] = useState('')
  const [text, setText] = useState('')
  const [booleanValue, setBooleanValue] = useState<boolean | null>(null)
  const [multi, setMulti] = useState<string[]>([])

  const canSubmit =
    question.kind === 'numeric'
      ? numeric.trim() !== ''
      : question.kind === 'text'
        ? text.trim() !== ''
        : question.kind === 'boolean'
          ? booleanValue !== null
          : question.kind === 'multi-select'
            ? multi.length > 0
            : selected !== null

  const submit = () => {
    if (!canSubmit) return
    if (question.kind === 'numeric') onSubmit(question.id, Number(numeric))
    else if (question.kind === 'text') onSubmit(question.id, text)
    else if (question.kind === 'boolean') onSubmit(question.id, booleanValue)
    else if (question.kind === 'multi-select') onSubmit(question.id, multi)
    else onSubmit(question.id, selected)
  }

  return (
    <Panel
      title={question.topic}
      subtitle={question.prompt}
      accent={question.difficulty === 'hard' ? 'rose' : question.difficulty === 'core' ? 'teal' : 'indigo'}
    >
      {question.kind === 'multiple-choice' ? (
        <div className="option-list" role="radiogroup" aria-label={question.prompt}>
          {question.options?.map((option) => (
            <label key={option.id} className={selected === option.id ? 'option option-selected' : 'option'}>
              <input
                type="radio"
                name={question.id}
                value={option.id}
                checked={selected === option.id}
                onChange={() => setSelected(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      {question.kind === 'multi-select' ? (
        <div className="option-list">
          {question.options?.map((option) => (
            <label
              key={option.id}
              className={multi.includes(option.id) ? 'option option-selected' : 'option'}
            >
              <input
                type="checkbox"
                checked={multi.includes(option.id)}
                onChange={() =>
                  setMulti((current) =>
                    current.includes(option.id)
                      ? current.filter((id) => id !== option.id)
                      : [...current, option.id],
                  )
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      {question.kind === 'numeric' ? (
        <div className="field">
          <label className="field-label" htmlFor={`${question.id}-numeric`}>
            Your answer{question.unit ? ` (${question.unit})` : ''}
          </label>
          <input
            id={`${question.id}-numeric`}
            type="number"
            step="any"
            value={numeric}
            onChange={(event) => setNumeric(event.target.value)}
          />
        </div>
      ) : null}

      {question.kind === 'text' ? (
        <div className="field">
          <label className="field-label" htmlFor={`${question.id}-text`}>
            Your answer
          </label>
          <input
            id={`${question.id}-text`}
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      ) : null}

      {question.kind === 'boolean' ? (
        <div className="option-list" role="radiogroup" aria-label={question.prompt}>
          {[
            { value: true, label: 'True' },
            { value: false, label: 'False' },
          ].map((option) => (
            <label
              key={String(option.value)}
              className={booleanValue === option.value ? 'option option-selected' : 'option'}
            >
              <input
                type="radio"
                name={question.id}
                checked={booleanValue === option.value}
                onChange={() => setBooleanValue(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      <div className="button-row">
        <Button variant="primary" onClick={submit} disabled={!canSubmit}>
          Check the answer
        </Button>
        <span className="muted">Difficulty: {question.difficulty}</span>
      </div>

      {result ? (
        <div className={result.correct ? 'result result-correct' : 'result result-incorrect'} role="status">
          <p className="result-verdict">{result.correct ? 'Correct.' : 'Not quite.'}</p>
          <p className="result-reason">{result.reason}</p>
          <p className="result-explanation">{question.explanation}</p>
          {question.citation ? <p className="result-citation">Source: {question.citation.label}</p> : null}
        </div>
      ) : null}
    </Panel>
  )
}
