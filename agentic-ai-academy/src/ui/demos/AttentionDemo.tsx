import { useMemo, useState } from 'react'
import { ATTENTION_CASES, attend } from '../../engine/demos/attention'
import { Badge, Button, Field } from '../primitives'
import { DemoShell } from './DemoShell'

/**
 * Attention as a soft lookup.
 *
 * The lesson describes attention in two steps — a dot product against every
 * input, then a softmax so the weights sum to one — and then says the context
 * vector is "a linear combination of all encoder hidden states". That last
 * phrase is the one worth watching: the mechanism never looks at one thing.
 *
 * The student changes the query and the scale, and sees what the lookup
 * actually does. The two failures are the lesson's: a query that names the
 * subject instead of the mechanism, and a distribution too flat to be a
 * lookup at all.
 *
 * It is a toy — one head, four dimensions, hand-written vectors — but the
 * mechanism is the real one, and it is the same mechanism the retriever uses.
 */
export function AttentionDemo() {
  const scenario = ATTENTION_CASES[0]
  const [queryId, setQueryId] = useState(scenario.queries[0].id)
  const [scale, setScale] = useState(3)

  const query = useMemo(
    () => scenario.queries.find((entry) => entry.id === queryId) ?? scenario.queries[0],
    [scenario, queryId],
  )
  const outcome = useMemo(() => attend(scenario, query, scale), [scenario, query, scale])

  return (
    <DemoShell
      title="Attention as a soft lookup"
      source="Ch. 2, §2.3.4 Attention"
      summary="Choose what to ask for and how sharply to ask it. Watch the weight move across the passages, and see why a lookup over everything is not the same as looking at the right thing."
      controls={
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="The query">
              <select
                aria-label="Choose the query"
                value={queryId}
                onChange={(event) => setQueryId(event.target.value)}
                className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
                style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
              >
                {scenario.queries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <label htmlFor="demo-attention-scale" className="text-muted text-xs font-medium">
                Scale: {scale.toFixed(1)}
              </label>
              <input
                id="demo-attention-scale"
                type="range"
                min={0}
                max={12}
                step={0.5}
                value={scale}
                onChange={(event) => setScale(Number(event.target.value))}
                className="focus-ring mt-1 w-full accent-cyan-400"
              />
              <p className="text-muted text-[11px]">
                Low values spread the weight; high values concentrate it.
              </p>
            </div>
          </div>
          <p className="text-muted text-[11px]">
            The query is “{query.prompt}”.
          </p>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm">
          <strong>Question:</strong> {scenario.question}
        </p>
        <p className="text-muted text-xs leading-relaxed">{scenario.context}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={outcome.correct ? 'emerald' : 'rose'}>
            {outcome.correct ? 'the answer is in the context' : 'the answer is not in the context'}
          </Badge>
          <Badge tone="neutral">
            attending to {outcome.effectiveKeys.toFixed(1)} of {scenario.keys.length} passages
          </Badge>
          <Badge tone="neutral">entropy {outcome.entropy.toFixed(2)} bits</Badge>
        </div>

        <div className="surface-2 rounded-lg border p-3" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="text-muted text-[11px] font-semibold uppercase">The attention weights</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {outcome.weights.map((entry) => {
              const isWinner = entry.key.id === outcome.winner.id
              return (
                <li key={entry.key.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate" style={{ color: isWinner ? 'var(--text-strong)' : undefined }}>
                    {entry.key.label}
                    {entry.key.relevant ? ' ← answers the question' : ''}
                  </span>
                  <span className="h-2 w-24 shrink-0 overflow-hidden rounded-full" style={{ background: 'var(--border-soft)' }}>
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.max(1, entry.weight * 100)}%`,
                        background: isWinner ? 'var(--accent)' : 'var(--border-soft)',
                      }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right font-mono text-[10px]">
                    {(entry.weight * 100).toFixed(1)}%
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="text-muted mt-2 text-[11px]">
            The weights sum to {outcome.weights.reduce((sum, entry) => sum + entry.weight, 0).toFixed(3)} — attention is a probability
            distribution over the passages, not a choice of one.
          </p>
        </div>

        <div
          className="rounded-lg border p-3 text-xs"
          style={{
            borderColor: outcome.correct ? 'rgba(52,211,153,0.5)' : 'rgba(251,113,133,0.5)',
            background: outcome.correct ? 'rgba(52,211,153,0.07)' : 'rgba(251,113,133,0.07)',
          }}
          role="status"
        >
          <p className="text-muted font-semibold">The model answers</p>
          <p className="mt-1 leading-relaxed">{outcome.answer}</p>
          <p className="text-muted mt-2 leading-relaxed">{outcome.explanation}</p>
        </div>

        <p className="text-muted text-[11px] leading-relaxed">{scenario.note}</p>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setQueryId('precise')}>
            Ask precisely
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setQueryId('vague')}>
            Ask vaguely
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setQueryId('lexical')}>
            Repeat the keyword
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setScale((value) => (value >= 12 ? 0 : value + 3))}>
            Sharpen or flatten
          </Button>
        </div>
      </div>
    </DemoShell>
  )
}
