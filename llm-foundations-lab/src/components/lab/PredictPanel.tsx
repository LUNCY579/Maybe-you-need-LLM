import { useMemo, useState, type ReactNode } from 'react'
import { Badge, Button } from '../ui/primitives'
import type { PredictionQuestion } from '../../content/predictionQuestions'

export type { PredictionOption, PredictionQuestion } from '../../content/predictionQuestions'

/**
 * A prediction exercise.
 *
 * The learner commits to an answer before seeing the result, and the answer is
 * always checked against a computation rather than a stored key. This is the
 * difference between a quiz and an experiment: the point is to predict what the
 * algorithm will do, and then be shown that you were right or wrong, with the
 * numbers that decide it.
 *
 * The questions themselves live in `content/predictionQuestions.tsx`, beside
 * the quiz bank, because they are course content rather than interface.
 */
export interface PredictPanelProps {
  title: string
  description: ReactNode
  questions: PredictionQuestion[]
  /** Shown once every question has been answered. */
  closing?: ReactNode
}

export function PredictPanel({ title, description, questions, closing }: PredictPanelProps) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})

  const question = questions[index]
  const chosen = answers[question.id]
  const isRevealed = revealed[question.id] ?? false
  const score = useMemo(
    () =>
      questions.filter((item) => {
        const picked = answers[item.id]
        return picked !== undefined && item.options[picked]?.correct
      }).length,
    [questions, answers],
  )

  const choose = (optionIndex: number) => {
    if (isRevealed) return
    setAnswers((current) => ({ ...current, [question.id]: optionIndex }))
    setRevealed((current) => ({ ...current, [question.id]: true }))
  }

  const reset = () => {
    setIndex(0)
    setAnswers({})
    setRevealed({})
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo/30 bg-indigo/5 p-4 sm:p-5">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-indigo">Predict</p>
        <h3 className="font-display text-base font-semibold text-fg">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="indigo">
              Question {index + 1} of {questions.length}
            </Badge>
            <Badge tone={score === questions.length ? 'positive' : 'teal'}>{score} correct</Badge>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIndex((current) => Math.max(0, current - 1))
              }}
              disabled={index === 0}
            >
              Previous
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setIndex((current) => Math.min(questions.length - 1, current + 1))
              }}
              disabled={index === questions.length - 1}
            >
              Next
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>

        <div className="mt-4">
          {question.context ? <p className="text-sm text-muted">{question.context}</p> : null}
          <p className="mt-1 text-sm font-medium text-fg">{question.prompt}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {question.options.map((option, optionIndex) => {
              const isChosen = chosen === optionIndex
              const showVerdict = isRevealed && (option.correct || isChosen)
              return (
                <button
                  key={optionIndex}
                  type="button"
                  onClick={() => choose(optionIndex)}
                  disabled={isRevealed}
                  aria-pressed={isChosen}
                  className={`rounded-xl border px-3.5 py-2 text-sm transition-colors disabled:cursor-default ${
                    showVerdict && option.correct
                      ? 'border-teal bg-teal/15 text-teal'
                      : showVerdict && isChosen
                        ? 'border-rose bg-rose/15 text-rose'
                        : isChosen
                          ? 'border-indigo bg-indigo/15 text-indigo'
                          : 'border-control bg-panel-2 text-fg hover:border-indigo/60'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          {isRevealed ? (
            <div className="mt-4 space-y-2">
              <p
                className={`text-sm font-medium ${
                  question.options[chosen ?? 0]?.correct ? 'text-teal' : 'text-rose'
                }`}
              >
                {question.options[chosen ?? 0]?.correct
                  ? 'Correct.'
                  : 'Not quite — the correct option is highlighted in green.'}
              </p>
              <div className="rounded-xl border border-line bg-panel-2/50 p-3 text-sm leading-relaxed text-muted">
                {question.explanation}
                {question.options[chosen ?? 0]?.detail ? (
                  <p className="mt-2">{question.options[chosen ?? 0].detail}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-faint">
              Commit to an answer to see the numbers. Every answer here is computed by the same code the laboratory uses,
              never looked up from a stored key.
            </p>
          )}
        </div>
      </div>

      {closing && score === questions.length && questions.length > 0 ? (
        <div className="rounded-2xl border border-teal/30 bg-teal/5 p-4 text-sm leading-relaxed text-muted">
          {closing}
        </div>
      ) : null}
    </div>
  )
}
