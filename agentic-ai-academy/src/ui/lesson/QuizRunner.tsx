import { useEffect, useMemo, useRef, useState } from 'react'
import type { QuizQuestion } from '../../types/curriculum'
import { Badge, Button, Card, cn } from '../primitives'
import { useProgress } from '../../store/progress'
import { Markdown } from '../Markdown'

interface QuizRunnerProps {
  questions: QuizQuestion[]
  lessonSlug: string
  /** When true, questions from several lessons are shown with their source lesson. */
  showSource?: boolean
  /**
   * The id of a question to bring into view.
   *
   * Used by the review queue: "practise this question" scrolls straight to it
   * and marks it, so the loop from a mistake back to the attempt is one click.
   */
  focusQuestionId?: string | null
}

export function QuizRunner({ questions, lessonSlug, showSource, focusQuestionId }: QuizRunnerProps) {
  const { recordAttempt, state } = useProgress()
  const [selection, setSelection] = useState<Record<string, number>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const optionRefs = useRef(new Map<string, HTMLButtonElement>())
  const cardRefs = useRef(new Map<string, HTMLLIElement>())

  // Bring the focused question into view when it changes.
  useEffect(() => {
    if (!focusQuestionId) return
    const frame = requestAnimationFrame(() => {
      const card = cardRefs.current.get(focusQuestionId)
      if (!card) return
      card.scrollIntoView({ block: 'center' })
      card.classList.add('question-focus')
      window.setTimeout(() => card.classList.remove('question-focus'), 2000)
    })
    return () => cancelAnimationFrame(frame)
  }, [focusQuestionId, questions])

  const answeredCount = Object.keys(revealed).length
  const correctCount = useMemo(
    () => questions.filter((question) => revealed[question.id] && selection[question.id] === question.correct).length,
    [questions, revealed, selection],
  )

  if (questions.length === 0) {
    return <p className="text-muted text-sm">No assessment questions are attached to this lesson yet.</p>
  }

  const previousAttempts = new Map(state.quizAttempts.map((attempt) => [attempt.questionId, attempt]))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="violet">
          {answeredCount}/{questions.length} answered
        </Badge>
        {answeredCount > 0 ? (
          <Badge tone={correctCount === questions.length ? 'emerald' : 'amber'}>
            {correctCount}/{questions.length} correct in this session
          </Badge>
        ) : null}
        <Badge tone="neutral">{questions.length * 1} marks</Badge>
        {answeredCount > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelection({})
              setRevealed({})
            }}
          >
            Reset session
          </Button>
        ) : null}
      </div>

      <ol className="space-y-4">
        {questions.map((question, index) => {
          const chosen = selection[question.id]
          const isRevealed = revealed[question.id] ?? false
          const isCorrect = chosen === question.correct
          const prior = previousAttempts.get(question.id)

          return (
            <li
              key={question.id}
              ref={(node) => {
                if (node) cardRefs.current.set(question.id, node)
                else cardRefs.current.delete(question.id)
              }}
              className="scroll-mt-24"
            >
              <Card className="p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-muted text-[11px] font-semibold uppercase">Question {index + 1}</span>
                  <Badge tone={question.difficulty === 'advanced' ? 'violet' : 'cyan'}>{question.difficulty}</Badge>
                  {showSource ? <Badge tone="neutral">{question.source.label}</Badge> : null}
                  {prior ? (
                    <Badge tone={prior.correct ? 'emerald' : 'rose'}>
                      Previous attempt: {prior.correct ? 'correct' : 'incorrect'}
                    </Badge>
                  ) : null}
                </div>
                <p className="mb-3 text-sm leading-relaxed">{question.prompt}</p>
                <div
                  role="radiogroup"
                  aria-label={`Options for question ${index + 1}`}
                  className="space-y-2"
                  onKeyDown={(event) => {
                    // Arrow keys move the selection within a radio group, as the
                    // ARIA radio-group pattern requires.
                    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
                    event.preventDefault()
                    const current = chosen ?? -1
                    const next =
                      event.key === 'ArrowDown'
                        ? (current + 1) % question.options.length
                        : (current - 1 + question.options.length) % question.options.length
                    setSelection((currentSelection) => ({ ...currentSelection, [question.id]: next }))
                    optionRefs.current.get(`${question.id}:${next}`)?.focus()
                  }}
                >
                  {question.options.map((option, optionIndex) => {
                    const selected = chosen === optionIndex
                    const state_ = isRevealed
                      ? optionIndex === question.correct
                        ? 'correct'
                        : selected
                          ? 'incorrect'
                          : 'idle'
                      : selected
                        ? 'selected'
                        : 'idle'
                    return (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected || (chosen === undefined && optionIndex === 0) ? 0 : -1}
                        ref={(node) => {
                          if (node) optionRefs.current.set(`${question.id}:${optionIndex}`, node)
                          else optionRefs.current.delete(`${question.id}:${optionIndex}`)
                        }}
                        disabled={isRevealed}
                        onClick={() => setSelection((current) => ({ ...current, [question.id]: optionIndex }))}
                        className={cn(
                          'focus-ring flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition',
                          state_ === 'idle' && 'surface-2',
                        )}
                        style={{
                          borderColor:
                            state_ === 'correct'
                              ? 'rgba(52,211,153,0.6)'
                              : state_ === 'incorrect'
                                ? 'rgba(251,113,133,0.6)'
                                : state_ === 'selected'
                                  ? 'var(--accent)'
                                  : 'var(--border-soft)',
                          background:
                            state_ === 'correct'
                              ? 'rgba(52,211,153,0.10)'
                              : state_ === 'incorrect'
                                ? 'rgba(251,113,133,0.10)'
                                : state_ === 'selected'
                                  ? 'rgba(53,230,255,0.08)'
                                  : undefined,
                        }}
                      >
                        <span className="text-muted mt-[2px] font-mono text-xs">{String.fromCharCode(65 + optionIndex)}</span>
                        <span>{option}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={chosen === undefined || isRevealed}
                    onClick={() => {
                      if (chosen === undefined) return
                      setRevealed((current) => ({ ...current, [question.id]: true }))
                      recordAttempt({
                        questionId: question.id,
                        lessonSlug,
                        chosen,
                        correct: chosen === question.correct,
                      })
                    }}
                  >
                    Check answer
                  </Button>
                  {isRevealed ? <Badge tone={isCorrect ? 'emerald' : 'rose'}>{isCorrect ? 'Correct' : 'Not quite'}</Badge> : null}
                </div>

                {isRevealed ? (
                  <div className="mt-3 space-y-2 rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border-soft)' }}>
                    <p className="text-muted text-[11px] font-semibold uppercase">Why</p>
                    <Markdown text={question.explanation} />
                    <p className="text-muted text-[11px]">
                      Source: {question.source.label}
                      {question.source.page ? ` · p. ${question.source.page}` : ''}
                    </p>
                  </div>
                ) : null}
              </Card>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
