import { useMemo, useState } from 'react'
import {
  CONTEXT_POLICIES,
  CONTEXT_SCENARIOS,
  assembleContext,
  type ContextPolicy,
  type ContextScenario,
} from '../../engine/demos/contextWindow'
import { Badge, Button, Field, cn } from '../primitives'
import { DemoShell } from './DemoShell'

/**
 * The context window, and what happens when it is too small.
 *
 * §6.2.2 says the window "fundamentally limits the amount of information that
 * can be communicated to the LLM for a query", and §9.3.2.2 names the
 * standard remedy: give the model "a truncated form of the chat-history".
 * The interesting part is the bill that comes with it.
 *
 * This demonstration is a projection of a tested engine, so the numbers are
 * the same ones the engine computes and the same ones the unit tests check.
 * The student changes two things — how big the window is, and which of the
 * four policies the harness uses — and sees what survives, what is lost, and
 * what the agent then answers.
 *
 * The outcome to look for is not "the right policy". It is the moment where
 * the *compression* policy loses the decisive detail while still looking
 * perfectly reasonable, because that is the failure that is hardest to
 * notice in production.
 */
export function ContextWindowDemo() {
  const [scenarioId, setScenarioId] = useState(CONTEXT_SCENARIOS[0].id)
  const [policy, setPolicy] = useState<ContextPolicy>('truncate')
  const [budget, setBudget] = useState<number | null>(null)

  const scenario: ContextScenario = useMemo(
    () => CONTEXT_SCENARIOS.find((entry) => entry.id === scenarioId) ?? CONTEXT_SCENARIOS[0],
    [scenarioId],
  )

  const effectiveBudget = budget ?? scenario.budget
  const outcome = useMemo(
    () => assembleContext(scenario, effectiveBudget, policy),
    [scenario, effectiveBudget, policy],
  )

  const fill = Math.min(100, Math.round((outcome.used / Math.max(1, outcome.budget)) * 100))
  const droppedIds = new Set(outcome.dropped.map((item) => item.id))
  const pagedIds = new Set(outcome.pagedOut.map((item) => item.id))

  return (
    <DemoShell
      title="The context window, and what it does to the answer"
      source="Ch. 6, §6.2.2; Ch. 9, §9.3.2.2–9.3.2.3"
      summary="Set the size of the window and choose how the harness fits the material into it. Watch which facts survive, which are lost, and what the agent then answers."
      controls={
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Scenario">
              <select
                aria-label="Choose a context window scenario"
                value={scenarioId}
                onChange={(event) => {
                  setScenarioId(event.target.value)
                  setBudget(null)
                }}
                className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
                style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
              >
                {CONTEXT_SCENARIOS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <label htmlFor="demo-context-budget" className="text-muted text-xs font-medium">
                Window size: {effectiveBudget} tokens
              </label>
              <input
                id="demo-context-budget"
                type="range"
                min={40}
                max={240}
                step={5}
                value={effectiveBudget}
                onChange={(event) => setBudget(Number(event.target.value))}
                className="focus-ring mt-1 w-full accent-cyan-400"
              />
              <p className="text-muted text-[11px]">
                The material needs {outcome.totalTokens} tokens. The window holds {outcome.budget}.
              </p>
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-muted text-[11px] font-semibold tracking-wide uppercase">
              How the harness fits it
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {CONTEXT_POLICIES.map((entry) => (
                <label
                  key={entry.value}
                  className="surface-2 flex cursor-pointer gap-2 rounded-lg border p-2 text-xs"
                  style={{
                    borderColor: entry.value === policy ? 'var(--accent)' : 'var(--border-soft)',
                  }}
                >
                  <input
                    type="radio"
                    name="demo-context-policy"
                    value={entry.value}
                    checked={entry.value === policy}
                    onChange={() => setPolicy(entry.value)}
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
          <strong>Task:</strong> {scenario.goal}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">
            {outcome.used} of {outcome.budget} tokens used
          </Badge>
          <Badge tone={outcome.correct ? 'emerald' : 'rose'}>
            {outcome.correct ? 'the answer survives' : 'the answer is wrong'}
          </Badge>
          {outcome.dropped.length > 0 ? (
            <Badge tone="amber">{outcome.dropped.length} dropped</Badge>
          ) : null}
          {outcome.pagedOut.length > 0 ? (
            <Badge tone="violet">{outcome.pagedOut.length} paged out to the store</Badge>
          ) : null}
          {outcome.recalled ? <Badge tone="violet">recalled “{outcome.recalled.label}”</Badge> : null}
        </div>

        <div
          className="surface-2 h-2 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--surface-1)' }}
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${fill}%`,
              background: outcome.correct ? 'var(--accent)' : 'rgba(251,113,133,0.8)',
            }}
          />
        </div>

        <ol className="space-y-1.5 text-xs">
          {scenario.items.map((item) => {
            const kept = outcome.kept.find((entry) => entry.item.id === item.id)
            const dropped = droppedIds.has(item.id)
            const paged = pagedIds.has(item.id)
            const recalled = outcome.recalled?.id === item.id
            const protectedItem = item.kind === 'system' || item.kind === 'goal'
            return (
              <li
                key={item.id}
                className={cn(
                  'flex flex-wrap items-baseline gap-2 rounded-lg border px-2.5 py-1.5',
                  // The de-emphasis is carried by the border rather than by
                  // opacity: 60% opacity over ten-point muted text fails the
                  // contrast requirement, and a row the reader cannot read is
                  // worse than a row that is plainly marked as gone.
                  dropped || paged ? 'border-dashed' : '',
                )}
                style={{ borderColor: 'var(--border-soft)' }}
              >
                <span className="text-muted text-[10px] uppercase">{item.kind}</span>
                <span className="min-w-0 flex-1">
                  {kept?.compressed ? kept.item.compressed?.label : item.label}
                  {kept?.compressed ? (
                    <span className="text-muted block font-mono text-[10px]">
                      {kept.item.compressed?.content}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted font-mono text-[10px]">
                  {kept ? `${kept.tokens}t` : `${item.tokens}t`}
                </span>
                {item.critical ? <Badge tone="rose">decisive</Badge> : null}
                {protectedItem ? <Badge tone="neutral">protected</Badge> : null}
                {kept ? (
                  kept.compressed ? (
                    <Badge tone={kept.retains ? 'emerald' : 'amber'}>
                      {kept.retains ? 'compressed, fact kept' : 'compressed, fact lost'}
                    </Badge>
                  ) : (
                    <Badge tone="emerald">in the window</Badge>
                  )
                ) : null}
                {recalled ? <Badge tone="violet">recalled</Badge> : null}
                {dropped ? <Badge tone="amber">dropped</Badge> : null}
                {paged ? <Badge tone="violet">in the store</Badge> : null}
              </li>
            )
          })}
        </ol>

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
          <Button size="sm" onClick={() => setPolicy('truncate')}>
            Use truncation
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPolicy('relevance')}>
            Retrieve what is relevant
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPolicy('compress')}>
            Compress everything
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPolicy('page')}>
            Page out and recall
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setBudget(scenario.budget)}>
            Reset the window
          </Button>
        </div>
      </div>
    </DemoShell>
  )
}
