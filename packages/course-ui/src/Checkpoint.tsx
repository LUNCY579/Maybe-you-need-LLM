import { useId, useState } from 'react'
import { gradeAnswer } from '@llm-materials/course-core'
import type { GradedAnswer, QuizQuestion } from '@llm-materials/course-core'
import { Button } from './primitives.js'

/**
 * One question, answered in place.
 *
 * The practice page is a bank: it is the right place to work through every
 * question a course has. This is the other half of assessment — a single
 * question where the idea was just taught, so the learner finds out whether
 * they followed the lesson before moving on.
 *
 * The grading is `@llm-materials/course-core`'s, the same engine the practice
 * page uses, so an answer is judged identically wherever it is asked. After
 * an answer the explanation and the citation appear, and the learner can try
 * again: a checkpoint is a place to think, not a test that locks.
 */
export function Checkpoint({
  question,
  onAnswered,
  label = 'Checkpoint',
}: {
  question: QuizQuestion
  /** Called on every attempt with the verdict, so the course can record it. */
  onAnswered?: (correct: boolean) => void
  label?: string
}) {
  const baseId = useId()
  const titleId = `${baseId}-title`
  const numericId = `${baseId}-numeric`
  const textId = `${baseId}-text`

  const [selected, setSelected] = useState<string | null>(null)
  const [multi, setMulti] = useState<string[]>([])
  const [numeric, setNumeric] = useState('')
  const [text, setText] = useState('')
  const [booleanValue, setBooleanValue] = useState<boolean | null>(null)
  const [result, setResult] = useState<GradedAnswer | null>(null)

  const answered = result !== null

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
    if (!canSubmit || answered) return
    const given =
      question.kind === 'numeric'
        ? Number(numeric)
        : question.kind === 'text'
          ? text
          : question.kind === 'boolean'
            ? booleanValue
            : question.kind === 'multi-select'
              ? multi
              : selected
    const graded = gradeAnswer(question, given)
    setResult(graded)
    onAnswered?.(graded.correct)
  }

  const retry = () => {
    setResult(null)
  }

  /** The option's verdict, once the question has been answered. */
  const verdictOf = (optionId: string): boolean | undefined => {
    if (!result) return undefined
    if (result.optionVerdicts) return result.optionVerdicts[optionId]
    return question.kind === 'boolean' ? String(optionId) === String(result.expected) : undefined
  }

  const optionClass = (optionId: string, chosen: boolean) => {
    const verdict = verdictOf(optionId)
    return [
      'option',
      chosen ? 'option-selected' : '',
      verdict === true ? 'option-correct' : '',
      verdict === false && chosen ? 'option-incorrect' : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  return (
    <section className="checkpoint" aria-labelledby={titleId}>
      <div className="checkpoint-head">
        <p className="checkpoint-label">{label}</p>
        <h3 id={titleId} className="checkpoint-prompt">
          {question.prompt}
        </h3>
        <p className="checkpoint-meta">
          {question.topic} · {question.difficulty}
        </p>
      </div>

      {question.kind === 'multiple-choice' ? (
        <div className="option-list" role="radiogroup" aria-labelledby={titleId}>
          {question.options?.map((option) => (
            <label key={option.id} className={optionClass(option.id, selected === option.id)}>
              <input
                type="radio"
                name={`${baseId}-choice`}
                value={option.id}
                checked={selected === option.id}
                disabled={answered}
                onChange={() => setSelected(option.id)}
              />
              <span>
                {option.label}
                {answered && option.feedback ? (
                  <span className="option-feedback">{option.feedback}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      ) : null}

      {question.kind === 'multi-select' ? (
        <div className="option-list">
          {question.options?.map((option) => (
            <label key={option.id} className={optionClass(option.id, multi.includes(option.id))}>
              <input
                type="checkbox"
                checked={multi.includes(option.id)}
                disabled={answered}
                onChange={() =>
                  setMulti((current) =>
                    current.includes(option.id)
                      ? current.filter((id) => id !== option.id)
                      : [...current, option.id],
                  )
                }
              />
              <span>
                {option.label}
                {answered && option.feedback ? (
                  <span className="option-feedback">{option.feedback}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      ) : null}

      {question.kind === 'boolean' ? (
        <div className="option-list" role="radiogroup" aria-labelledby={titleId}>
          {[
            { value: true, label: 'True' },
            { value: false, label: 'False' },
          ].map((option) => (
            <label
              key={String(option.value)}
              className={optionClass(String(option.value), booleanValue === option.value)}
            >
              <input
                type="radio"
                name={`${baseId}-truth`}
                checked={booleanValue === option.value}
                disabled={answered}
                onChange={() => setBooleanValue(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      {question.kind === 'numeric' ? (
        <div className="field">
          <label className="field-label" htmlFor={numericId}>
            Your answer{question.unit ? ` (${question.unit})` : ''}
          </label>
          <input
            id={numericId}
            type="number"
            step="any"
            value={numeric}
            disabled={answered}
            onChange={(event) => setNumeric(event.target.value)}
          />
        </div>
      ) : null}

      {question.kind === 'text' ? (
        <div className="field">
          <label className="field-label" htmlFor={textId}>
            Your answer
          </label>
          <input
            id={textId}
            type="text"
            value={text}
            disabled={answered}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      ) : null}

      <div className="button-row">
        {answered ? (
          <Button variant="ghost" onClick={retry}>
            Try another answer
          </Button>
        ) : (
          <Button variant="primary" onClick={submit} disabled={!canSubmit}>
            Check the answer
          </Button>
        )}
      </div>

      {result ? (
        <div className={result.correct ? 'result result-correct' : 'result result-incorrect'} role="status">
          <p className="result-verdict">{result.correct ? 'Correct.' : 'Not quite.'}</p>
          <p className="result-reason">{result.reason}</p>
          <p className="result-explanation">{question.explanation}</p>
          {question.citation ? <p className="result-citation">Source: {question.citation.label}</p> : null}
        </div>
      ) : null}
    </section>
  )
}
