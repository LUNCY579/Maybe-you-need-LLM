import { useEffect, useRef, useState } from 'react'
import type { QuizQuestion } from '../../types/curriculum'
import { Badge, Button, Card, cn } from '../primitives'
import { useProgress } from '../../store/progress'
import { Markdown } from '../Markdown'

/**
 * A prediction the student commits to before the answer is revealed.
 *
 * The point is not the question. It is the commitment: choosing an answer
 * before seeing the explanation turns a fact the student half-knew into one
 * they can check, and the check is what makes it retrievable later. A wrong
 * prediction is recorded as an attempt, so it comes back in the review queue
 * exactly like a missed quiz question does.
 */
export function PredictBlock({ question, lessonSlug }: { question: QuizQuestion; lessonSlug: string }) {
  const { recordAttempt, state } = useProgress()
  const [chosen, setChosen] = useState<number | null>(null)
  const [committed, setCommitted] = useState(false)
  const optionsRef = useRef<HTMLDivElement>(null)

  // A prediction that was already made in an earlier session stays made.
  const prior = state.quizAttempts.filter((attempt) => attempt.questionId === question.id).at(-1)

  useEffect(() => {
    if (prior && !committed) {
      setChosen(prior.chosen)
      setCommitted(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prior?.questionId])

  const correct = chosen === question.correct

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="amber">Predict first</Badge>
        <span className="text-muted text-[11px]">{question.source.label}</span>
      </div>

      <p className="text-sm leading-relaxed">{question.prompt}</p>

      {question.tryIt ? (
        <p
          className="rounded-lg border px-3 py-2 text-[11px] leading-relaxed"
          style={{ borderColor: 'var(--border-soft)', background: 'var(--surface-2)' }}
        >
          <span className="font-semibold" style={{ color: 'var(--accent)' }}>
            Try it
          </span>{' '}
          <span className="text-muted">{question.tryIt}</span>
        </p>
      ) : null}

      <div ref={optionsRef} role="radiogroup" aria-label={`Options for: ${question.prompt}`} className="space-y-2">
        {question.options.map((option, index) => {
          const selected = chosen === index
          const state_ = !committed
            ? selected
              ? 'selected'
              : 'idle'
            : index === question.correct
              ? 'correct'
              : selected
                ? 'incorrect'
                : 'idle'
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (chosen === null && index === 0) ? 0 : -1}
              disabled={committed}
              onClick={() => setChosen(index)}
              onKeyDown={(event) => {
                if (committed) return
                if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
                event.preventDefault()
                const current = chosen ?? -1
                const next =
                  event.key === 'ArrowDown'
                    ? (current + 1) % question.options.length
                    : (current - 1 + question.options.length) % question.options.length
                setChosen(next)
                optionsRef.current
                  ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
                  [next]?.focus()
              }}
              className={cn(
                'focus-ring flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition',
                state_ === 'idle' && 'surface-2',
                committed && 'cursor-default',
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
              <span className="text-muted mt-[2px] font-mono text-xs">{String.fromCharCode(65 + index)}</span>
              <span>{option}</span>
            </button>
          )
        })}
      </div>

      {!committed ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={chosen === null}
            onClick={() => {
              if (chosen === null) return
              setCommitted(true)
              recordAttempt({ questionId: question.id, lessonSlug, chosen, correct: chosen === question.correct })
            }}
          >
            Commit and check
          </Button>
          <span className="text-muted text-[11px]">
            {chosen === null ? 'Choose an answer first — the explanation stays hidden until you commit.' : 'Once you commit, the explanation appears and a wrong answer joins your review queue.'}
          </span>
        </div>
      ) : (
        <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={correct ? 'emerald' : 'rose'}>{correct ? 'You were right' : 'Not quite'}</Badge>
            {!correct ? <span className="text-muted text-[11px]">This is now in your review queue.</span> : null}
          </div>
          {/*
            The explanation is a labelled region rather than loose text. That
            gives a screen reader a name for it, and it keeps the text
            together even though the renderer may split it around a glossary
            link.
          */}
          <div role="note" aria-label="Why this is the answer" className="text-sm leading-relaxed">
            <Markdown text={question.explanation} />
          </div>
        </div>
      )}
    </Card>
  )
}
