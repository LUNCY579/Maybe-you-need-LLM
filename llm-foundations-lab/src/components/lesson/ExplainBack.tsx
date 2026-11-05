import { useEffect, useRef, useState } from 'react'
import { EXPLANATION_BY_LESSON } from '../../content/explanations'
import { useProgress } from '../../state/hooks'
import { Badge, Button, Panel } from '../ui/primitives'

/**
 * The self-explanation exercise.
 *
 * At the end of each lesson the reader is asked one question, answers it in
 * their own words, and only then sees the model answer. Generating the
 * explanation is what does the work; the model answer is the feedback that
 * makes the exercise worth doing, and without it the exercise would be
 * decoration (see `src/content/explanations.ts` for the evidence).
 *
 * The reader also says how it went. That rating is not a score — it is the
 * reader's own calibration, and it is used to decide what to suggest next, so
 * it is worth asking for plainly rather than hiding behind a number.
 *
 * The answer is saved, so a reader who comes back to a lesson finds their own
 * words still there. That matters more than it sounds: a note in your own
 * handwriting is worth more than the same note written by somebody else.
 */

export type ExplanationRating = 'yes' | 'partly' | 'not-yet'

const RATING_LABEL: Record<ExplanationRating, string> = {
  yes: 'I had it',
  partly: 'Partly',
  'not-yet': 'Not yet',
}

export function ExplainBack({ lessonId }: { lessonId: string }) {
  const prompt = EXPLANATION_BY_LESSON.get(lessonId)
  const { explanations, recordExplanation } = useProgress()
  const saved = explanations[lessonId]
  const [text, setText] = useState(saved?.answer ?? '')
  const [revealed, setRevealed] = useState(saved?.revealed ?? false)
  const [rating, setRating] = useState<ExplanationRating | null>(saved?.rating ?? null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  /*
   * WebKit can deliver the textarea's blur after the reveal button's click.
   * The blur handler then runs with the previous render's `revealed` value and
   * would save the answer as hidden again, so it reads the latest value from a
   * ref instead of from the closure.
   */
  const revealedRef = useRef(revealed)
  useEffect(() => {
    revealedRef.current = revealed
  }, [revealed])

  /*
   * A different lesson means a different prompt, and the state follows it.
   *
   * The state is adjusted during the render rather than in an effect: an
   * effect would run a second render after the first, and the reader would
   * see a frame of the previous lesson's answer. This is the same pattern the
   * application shell uses when the route changes.
   */
  const [lastLessonId, setLastLessonId] = useState(lessonId)
  if (lastLessonId !== lessonId) {
    setLastLessonId(lessonId)
    const stored = explanations[lessonId]
    setText(stored?.answer ?? '')
    setRating(stored?.rating ?? null)
    setRevealed(stored?.revealed ?? false)
  }

  if (!prompt) return null

  const persist = (
    nextText: string,
    nextRating: ExplanationRating | null,
    nextRevealed: boolean,
  ) => {
    recordExplanation(lessonId, { answer: nextText, rating: nextRating, revealed: nextRevealed })
  }

  const reveal = () => {
    revealedRef.current = true
    setRevealed(true)
    persist(text, rating, true)
    textareaRef.current?.blur()
  }

  const rate = (next: ExplanationRating) => {
    setRating(next)
    persist(text, next, revealed)
  }

  return (
    <section id="explain-back" className="scroll-mt-24" data-testid="explain-back">
      <h2 className="font-display text-lg font-semibold tracking-tight text-fg sm:text-xl">
        <span className="mr-2 font-mono text-xs uppercase tracking-wider text-amber">Explain</span>
        Explain it back
      </h2>
      <p className="mt-2 text-sm text-muted">
        Say it in your own words before you read the answer. Writing the
        explanation is what makes it stick; reading one does not.
      </p>

      <Panel className="mt-3 space-y-3">
        <p className="text-[15px] font-medium leading-relaxed text-fg">{prompt.prompt}</p>

        <label className="sr-only" htmlFor={`explanation-${lessonId}`}>
          Your explanation
        </label>
        <textarea
          id={`explanation-${lessonId}`}
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => persist(text, rating, revealedRef.current)}
          rows={4}
          placeholder="In your own words…"
          className="w-full resize-y rounded-xl border border-control bg-surface-2 px-3 py-2 text-sm leading-relaxed text-fg placeholder:text-faint focus:border-indigo focus:outline-none"
        />

        {!revealed ? (
          <Button size="sm" variant="primary" onClick={reveal} data-testid="reveal-answer">
            Show the answer
          </Button>
        ) : (
          <div className="space-y-3" data-testid="explanation-answer">
            <div className="rounded-xl border border-line bg-panel-2/50 p-3">
              <p className="font-mono text-[11px] uppercase tracking-wider text-faint">A good answer</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{prompt.answer}</p>
            </div>
            <div className="rounded-xl border border-amber/30 bg-amber/5 p-3">
              <p className="font-mono text-[11px] uppercase tracking-wider text-amber">Watch out for</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{prompt.commonError}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">How did that go?</span>
              {(['yes', 'partly', 'not-yet'] as ExplanationRating[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => rate(value)}
                  aria-pressed={rating === value}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                    rating === value
                      ? 'border-indigo bg-indigo/15 text-indigo'
                      : 'border-control text-muted hover:border-indigo/50 hover:text-fg'
                  }`}
                >
                  {RATING_LABEL[value]}
                </button>
              ))}
              {rating === 'not-yet' ? <Badge tone="amber">Come back to this</Badge> : null}
            </div>
          </div>
        )}
      </Panel>
    </section>
  )
}
