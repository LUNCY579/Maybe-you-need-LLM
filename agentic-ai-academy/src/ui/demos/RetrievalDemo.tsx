import { useMemo, useState } from 'react'
import {
  RETRIEVAL_CASES,
  RETRIEVAL_STRATEGIES,
  retrieve,
  type RetrievalStrategy,
} from '../../engine/demos/retrieval'
import { Badge, Button, Field } from '../primitives'
import { DemoShell } from './DemoShell'

/**
 * Retrieval: getting the right passage into the window.
 *
 * The lesson says that retrieval supplies capability and freshness, and the
 * context-window lesson says the window is finite. This demonstration joins
 * them: the student chooses how many passages to retrieve and how they are
 * chosen, and sees the two ways it can go wrong.
 *
 * The first way is not retrieving the passage that answers the question. The
 * second is subtler and more interesting: retrieving it and putting it where
 * the model will not look.
 *
 * The curve drawn under the window is the one Liu et al. (2023) measured —
 * performance is highest when the relevant information is at the beginning or
 * the end of a long context, and degrades towards the middle.
 */
export function RetrievalDemo() {
  const [caseId, setCaseId] = useState(RETRIEVAL_CASES[0].id)
  const [strategy, setStrategy] = useState<RetrievalStrategy>('bi-encoder')
  const [k, setK] = useState(3)

  const scenario = useMemo(
    () => RETRIEVAL_CASES.find((entry) => entry.id === caseId) ?? RETRIEVAL_CASES[0],
    [caseId],
  )
  const outcome = useMemo(() => retrieve(scenario, k, strategy), [scenario, k, strategy])

  const decisive = scenario.passages.find((passage) => passage.relevant)

  return (
    <DemoShell
      title="Getting the right passage into the window"
      source="Ch. 12, §12.2–12.4; Ch. 9, §9.3.2.2"
      summary="Choose how many passages to retrieve and how they are chosen. The decisive passage can fail twice over: it can be left out, and it can be retrieved and then put where the model will not look."
      controls={
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Corpus">
              <select
                aria-label="Choose a retrieval scenario"
                value={caseId}
                onChange={(event) => setCaseId(event.target.value)}
                className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
                style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
              >
                {RETRIEVAL_CASES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <label htmlFor="demo-retrieval-k" className="text-muted text-xs font-medium">
                Passages retrieved: {k}
              </label>
              <input
                id="demo-retrieval-k"
                type="range"
                min={1}
                max={6}
                step={1}
                value={k}
                onChange={(event) => setK(Number(event.target.value))}
                className="focus-ring mt-1 w-full accent-cyan-400"
              />
              <p className="text-muted text-[11px]">
                The corpus holds {scenario.passages.length} passages and the window holds {k}.
              </p>
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-muted text-[11px] font-semibold tracking-wide uppercase">
              How they are chosen
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {RETRIEVAL_STRATEGIES.map((entry) => (
                <label
                  key={entry.value}
                  className="surface-2 flex cursor-pointer gap-2 rounded-lg border p-2 text-xs"
                  style={{ borderColor: entry.value === strategy ? 'var(--accent)' : 'var(--border-soft)' }}
                >
                  <input
                    type="radio"
                    name="demo-retrieval-strategy"
                    value={entry.value}
                    checked={entry.value === strategy}
                    onChange={() => setStrategy(entry.value)}
                    className="focus-ring mt-0.5"
                  />
                  <span>
                    <span className="font-semibold">{entry.label}</span>
                    <span className="text-muted block leading-relaxed">{entry.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm">
          <strong>Question:</strong> {scenario.question}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={outcome.recalled ? 'emerald' : 'rose'}>
            {outcome.recalled ? 'the decisive passage was retrieved' : 'the decisive passage was missed'}
          </Badge>
          <Badge tone={outcome.used ? 'emerald' : 'rose'}>
            {outcome.used ? 'and the model used it' : 'and the model did not use it'}
          </Badge>
          {outcome.decisivePosition !== null ? (
            <Badge tone="neutral">position {outcome.decisivePosition + 1} of {outcome.selected.length}</Badge>
          ) : null}
        </div>

        {/* The window: the passages in the order they were placed, with the
            attention curve drawn underneath. */}
        <div className="surface-2 rounded-lg border p-3" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="text-muted text-[11px] font-semibold uppercase">The window</p>
          <ol className="mt-2 space-y-1.5">
            {outcome.selected.map((entry) => {
              const isDecisive = entry.passage.id === decisive?.id
              return (
                <li key={entry.passage.id} className="flex items-start gap-2 text-xs">
                  <span className="text-muted w-4 shrink-0 font-mono text-[10px]">{entry.position + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">
                      {entry.passage.label}
                      {isDecisive ? ' ← the answer is here' : ''}
                    </span>
                    <span className="text-muted block leading-relaxed">{entry.passage.text}</span>
                  </span>
                  <span className="shrink-0" title={`Attended ${(entry.salience * 100).toFixed(0)}%`}>
                    <span
                      className="block h-1.5 w-12 rounded-full"
                      style={{
                        background: 'var(--border-soft)',
                        boxShadow: `inset ${entry.salience * 100}% 0 0 var(--accent)`,
                      }}
                    />
                    <span className="text-muted mt-0.5 block text-right font-mono text-[9px]">
                      {Math.round(entry.salience * 100)}%
                    </span>
                  </span>
                </li>
              )
            })}
          </ol>
          {outcome.missed.length > 0 ? (
            <p className="text-muted mt-2 text-[11px]">
              Not retrieved: {outcome.missed.map((passage) => passage.label).join(', ')}.
            </p>
          ) : null}
        </div>

        <div
          className="rounded-lg border p-3 text-xs"
          style={{
            borderColor: outcome.correct ? 'rgba(52,211,153,0.5)' : 'rgba(251,113,133,0.5)',
            background: outcome.correct ? 'rgba(52,211,153,0.07)' : 'rgba(251,113,133,0.07)',
          }}
          role="status"
        >
          <p className="text-muted font-semibold">The agent answers</p>
          <p className="mt-1 leading-relaxed">{outcome.answer}</p>
          <p className="text-muted mt-2 leading-relaxed">{outcome.explanation}</p>
        </div>

        <p className="text-muted text-[11px] leading-relaxed">{scenario.note}</p>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setStrategy('bi-encoder')}>
            Similarity only
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStrategy('rerank')}>
            Rerank
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStrategy('diverse')}>
            Select for diversity
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setK((value) => (value >= 6 ? 1 : value + 1))}>
            Retrieve one more
          </Button>
        </div>
      </div>
    </DemoShell>
  )
}
