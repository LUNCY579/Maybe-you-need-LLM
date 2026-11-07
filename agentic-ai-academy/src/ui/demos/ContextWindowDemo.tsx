import { useMemo, useState } from 'react'
import {
  CONTEXT_POLICIES,
  CONTEXT_SCENARIOS,
  GIST_FEATURES,
  assembleContext,
  type ContextPolicy,
  type ContextScenario,
  type GistTrace,
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
 * policies the harness uses — and sees what survives, what is lost, and what
 * the agent then answers.
 *
 * The outcome to look for is not "the right policy". It is the moment where
 * the *compression* policy loses the decisive detail while still looking
 * perfectly reasonable, because that is the failure that is hardest to
 * notice in production. The learned policy is that failure with a training run
 * behind it: the weights, the loss curve and the ranking are printed, so the
 * mistake traces back to the fit rather than to a rule someone wrote.
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
  const gist = outcome.gist

  const fill = Math.min(100, Math.round((outcome.used / Math.max(1, outcome.budget)) * 100))
  const droppedIds = new Set(outcome.dropped.map((item) => item.id))
  const pagedIds = new Set(outcome.pagedOut.map((item) => item.id))
  const scores = new Map((gist?.decisions ?? []).map((decision) => [decision.item.id, decision]))

  return (
    <DemoShell
      title="The context window, and what it does to the answer"
      source="Ch. 6, §6.2.2; Ch. 9, §9.3.2.2–9.3.2.3"
      summary="Set the size of the window and choose how the harness fits the material into it — including a compressor trained on the other windows. Watch which facts survive, which are lost, and what the agent then answers."
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
          {gist ? (
            <>
              <Badge tone="cyan">trained on {gist.model.trainedOn.length} other windows</Badge>
              <Badge tone="neutral">
                {gist.ranking.auc.toFixed(2)} of decisive pairs ordered here
              </Badge>
            </>
          ) : null}
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
            const decision = scores.get(item.id)
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
                {decision ? <Badge tone="neutral">score {decision.score.toFixed(2)}</Badge> : null}
                {recalled ? <Badge tone="violet">recalled</Badge> : null}
                {dropped ? <Badge tone="amber">dropped</Badge> : null}
                {paged ? <Badge tone="violet">in the store</Badge> : null}
              </li>
            )
          })}
        </ol>

        {gist ? <GistPanel trace={gist} /> : null}

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
          <Button size="sm" variant="ghost" onClick={() => setPolicy('gist')}>
            Score it with the trained compressor
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setBudget(scenario.budget)}>
            Reset the window
          </Button>
        </div>
      </div>
    </DemoShell>
  )
}

/** The epochs the loss curve is printed at. */
const LOSS_SAMPLES = [1, 2, 5, 10, 25, 50, 100, 200, 300]

/**
 * The learned policy's own evidence.
 *
 * Every figure here comes out of the fit the engine ran: the windows it was trained on, the
 * loss per epoch, the weights it settled on, and the order it then put the material in. A
 * trained compressor is only worth demonstrating if the training is visible — including the
 * part where it generalises badly.
 */
function GistPanel({ trace }: { trace: GistTrace }) {
  const { model, ranking, decisions } = trace
  const untrained = model.loss[0]
  const final = model.loss[model.loss.length - 1]
  const strongest = Math.max(...GIST_FEATURES.map((entry) => Math.abs(model.weights[entry.key])), 1e-9)
  const trainedOn = CONTEXT_SCENARIOS.filter((entry) => model.trainedOn.includes(entry.id))

  return (
    <section
      className="surface-2 space-y-3 rounded-lg border p-3"
      style={{ borderColor: 'var(--border-soft)' }}
      aria-label="What the learned compressor did"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold">What the compressor was trained on</h3>
        <p className="text-muted text-[11px]">
          {model.examples} items, {model.positives} of them decisive, from{' '}
          {trainedOn.map((entry) => entry.title).join(' and ')} — never from this window.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-muted text-[11px] font-semibold uppercase">Loss per epoch</p>
          <ul className="mt-1.5 space-y-1 text-[11px]" aria-label="Mean log-loss at sampled epochs">
            {LOSS_SAMPLES.filter((epoch) => epoch <= model.epochs).map((epoch) => {
              const value = model.loss[epoch - 1]
              return (
                <li key={epoch} className="flex items-center gap-2">
                  <span className="text-muted w-10 shrink-0 font-mono">{epoch}</span>
                  <span
                    className="h-1.5 flex-1 overflow-hidden rounded-full"
                    style={{ background: 'var(--surface-1)' }}
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(value / untrained) * 100}%`, background: 'var(--accent)' }}
                    />
                  </span>
                  <span className="text-muted w-12 shrink-0 text-right font-mono">{value.toFixed(3)}</span>
                </li>
              )
            })}
          </ul>
          <p className="text-muted mt-1.5 text-[11px] leading-relaxed">
            Mean log-loss starts at {untrained.toFixed(3)} — what guessing every item at fifty-fifty
            costs — and ends at {final.toFixed(3)} after {model.epochs} epochs.
          </p>
        </div>

        <div>
          <p className="text-muted text-[11px] font-semibold uppercase">What each signal is worth</p>
          <ul className="mt-1.5 space-y-1.5 text-[11px]" aria-label="The weight each signal carries">
            {GIST_FEATURES.map((entry) => {
              const weight = model.weights[entry.key]
              const hue = weight >= 0 ? 'var(--accent)' : 'rgba(251,113,133,0.85)'
              return (
                <li key={entry.key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{entry.label}</span>
                    <span className="font-mono" style={{ color: weight >= 0 ? 'var(--accent)' : 'rgb(251,113,133)' }}>
                      {weight >= 0 ? `+${weight.toFixed(2)}` : weight.toFixed(2)}
                    </span>
                  </div>
                  <div
                    className="mt-0.5 h-1 overflow-hidden rounded-full"
                    style={{ background: 'var(--surface-1)' }}
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(Math.abs(weight) / strongest) * 100}%`, background: hue }}
                    />
                  </div>
                  <p className="text-muted mt-0.5 leading-relaxed">{entry.note}</p>
                </li>
              )
            })}
          </ul>
          <p className="text-muted mt-1.5 text-[11px] font-mono">intercept {model.bias.toFixed(2)}</p>
        </div>
      </div>

      <div>
        <p className="text-muted text-[11px] font-semibold uppercase">The order it put the material in</p>
        <ol className="mt-1.5 space-y-1 text-[11px]" aria-label="The order it put the material in">
          {decisions.map((decision, index) => (
            <li key={decision.item.id} className="flex flex-wrap items-baseline gap-2">
              <span className="text-muted w-5 shrink-0 font-mono">{index + 1}</span>
              <span className="min-w-0 flex-1">
                {decision.item.label}
                {decision.item.critical ? <span className="text-muted"> · decisive</span> : null}
              </span>
              <span className="text-muted font-mono">{decision.score.toFixed(3)}</span>
              <Badge tone={decision.action === 'full' ? 'emerald' : decision.action === 'gist' ? 'amber' : 'neutral'}>
                {decision.action === 'full'
                  ? 'kept in full'
                  : decision.action === 'gist'
                    ? 'kept as a summary'
                    : 'dropped for room'}
              </Badge>
            </li>
          ))}
        </ol>
        <p className="text-muted mt-2 text-[11px] leading-relaxed">
          {ranking.concordant} of {ranking.pairs} decisive-over-other pairs are ordered correctly here — a{' '}
          {ranking.auc.toFixed(2)} ranking on material this fit never saw. Read the weights against it: a signal
          you expected to matter can carry a weight the training corpus did not earn.
        </p>
        <p className="text-muted text-[11px] leading-relaxed">
          The scope note: this is a scorer over five hand-built features, fitted by full-batch gradient descent —
          not gist tokens inside a language model. What is learned is which material to keep and how far to cut
          it; the summaries it cuts to are still the ones written into the scenario.
        </p>
      </div>
    </section>
  )
}
