import { useMemo, useState } from 'react'
import { PATCH_SCENARIOS, layerStates, patch, probe } from '../../engine/demos/patching'
import { Badge, Button, Field } from '../primitives'
import { DemoShell } from './DemoShell'

/**
 * Locating a decision.
 *
 * The chapter is careful about the difference between three kinds of
 * evidence, and the demonstration puts them side by side: a probe that finds
 * the concept everywhere, a logit lens that shows the decision forming, and
 * patching that says where the behaviour is actually caused.
 *
 * The lesson it teaches is the one the chapter's account of superposition
 * forces: a weak shadow of the information is everywhere, so correlational
 * evidence does not localise anything. Only an intervention does.
 */
export function PatchingDemo() {
  const scenario = PATCH_SCENARIOS[0]
  const [scenarioId, setScenarioId] = useState(PATCH_SCENARIOS[0].id)
  const [threshold, setThreshold] = useState(10)
  const [patchedLayer, setPatchedLayer] = useState(scenario.decisionLayer)

  const current = useMemo(
    () => PATCH_SCENARIOS.find((entry) => entry.id === scenarioId) ?? PATCH_SCENARIOS[0],
    [scenarioId],
  )
  const states = useMemo(() => layerStates(current, 'b'), [current])
  const probeResults = useMemo(() => probe(current, threshold), [current, threshold])
  const outcome = useMemo(() => patch(current, 'a', 'b', patchedLayer), [current, patchedLayer])

  return (
    <DemoShell
      title="Where was the decision made?"
      source="Ch. 21, §21.4–21.7 Superposition, the logit lens and activation patching"
      summary="Two runs of the same model, a probe, a logit lens and a patch. The probe finds the concept everywhere; the patch says where the behaviour was caused."
      controls={
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Scenario">
              <select
                aria-label="Choose a patching scenario"
                value={scenarioId}
                onChange={(event) => {
                  setScenarioId(event.target.value)
                  const next = PATCH_SCENARIOS.find((entry) => entry.id === event.target.value)
                  if (next) setPatchedLayer(next.decisionLayer)
                }}
                className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
                style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
              >
                {PATCH_SCENARIOS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <label htmlFor="demo-probe-threshold" className="text-muted text-xs font-medium">
                Probe threshold: {threshold}%
              </label>
              <input
                id="demo-probe-threshold"
                type="range"
                min={0}
                max={25}
                step={1}
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
                className="focus-ring mt-1 w-full accent-cyan-400"
              />
              <p className="text-muted text-[11px]">How confident a probe must be before you believe it.</p>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-muted text-sm leading-relaxed">{current.context}</p>

        <div className="grid gap-2 sm:grid-cols-2">
          {[current.runs.a, current.runs.b].map((run) => (
            <div key={run.id} className="surface-2 rounded-lg border p-2.5 text-xs" style={{ borderColor: 'var(--border-soft)' }}>
              <p className="font-semibold">{run.name}</p>
              <p className="text-muted mt-0.5">“{run.prompt}”</p>
              <p className="mt-1">→ {run.answer}</p>
            </div>
          ))}
        </div>

        <div className="surface-2 rounded-lg border p-3" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="text-muted text-[11px] font-semibold uppercase">The layers of run B</p>
          <ul className="mt-2 space-y-1 text-xs">
            {states.map((state) => {
              const probeResult = probeResults[state.layer]
              const isPatched = patchedLayer === state.layer
              return (
                <li key={state.layer} className="flex flex-wrap items-center gap-2">
                  <span className="text-muted w-16 shrink-0 font-mono text-[10px]">
                    layer {state.layer + 1}
                  </span>
                  <span
                    className="h-2 w-20 shrink-0 overflow-hidden rounded-full"
                    style={{ background: 'var(--border-soft)' }}
                    title={`logit lens: ${state.readout}`}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.abs(state.signal) * 100)}%`,
                        background: state.signal > 0 ? 'var(--accent)' : state.signal < 0 ? 'rgba(251,113,133,0.8)' : 'transparent',
                      }}
                    />
                  </span>
                  <span className="w-24 shrink-0 text-[10px]">
                    <span className="text-muted">lens:</span>{' '}
                    {state.readout === 'undecided' ? (
                      <span className="text-muted">undecided</span>
                    ) : state.readout === 'a' ? (
                      current.runs.a.answer
                    ) : (
                      current.runs.b.answer
                    )}
                  </span>
                  <span className="w-28 shrink-0 text-[10px]">
                    <span className="text-muted">probe:</span>{' '}
                    {probeResult.detected ? (
                      <span className="text-emerald-300">detected ({probeResult.confidence}%)</span>
                    ) : (
                      <span className="text-muted">no</span>
                    )}
                  </span>
                  {isPatched ? <Badge tone="amber">patched here</Badge> : null}
                </li>
              )
            })}
          </ul>
          <p className="text-muted mt-2 text-[11px]">
            The probe finds the concept at every layer it is allowed to notice. The logit lens only
            commits from the layer the decision was made in.
          </p>
        </div>

        <div>
          <label htmlFor="demo-patch-layer" className="text-muted text-xs font-medium">
            Patch run A into run B at layer {patchedLayer + 1}
          </label>
          <input
            id="demo-patch-layer"
            type="range"
            min={0}
            max={current.layers - 1}
            step={1}
            value={patchedLayer}
            onChange={(event) => setPatchedLayer(Number(event.target.value))}
            className="focus-ring mt-1 w-full accent-cyan-400"
          />
        </div>

        <div
          className="rounded-lg border p-3 text-xs"
          style={{
            borderColor: outcome.changed ? 'rgba(52,211,153,0.5)' : 'rgba(251,113,133,0.5)',
            background: outcome.changed ? 'rgba(52,211,153,0.07)' : 'rgba(251,113,133,0.07)',
          }}
          role="status"
        >
          <p className="font-semibold">
            {outcome.changed ? 'The behaviour transferred' : 'Nothing happened'}
          </p>
          <p className="mt-1 leading-relaxed">{outcome.explanation}</p>
          <p className="text-muted mt-2 leading-relaxed">
            The patched model now says: {outcome.answer}
          </p>
        </div>

        <p className="text-muted text-[11px] leading-relaxed">{current.note}</p>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setPatchedLayer(current.decisionLayer)}>
            Patch the decision layer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPatchedLayer(0)}>
            Patch the first layer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPatchedLayer(current.layers - 1)}>
            Patch the last layer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setThreshold(threshold > 12 ? 0 : 15)}>
            Change the probe threshold
          </Button>
        </div>
      </div>
    </DemoShell>
  )
}
