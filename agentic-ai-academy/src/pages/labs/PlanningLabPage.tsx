import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DEFAULT_WORLD, cellKind, runAllStrategies, runPlanning, type PlanningStrategy } from '../../engine/labs/planning'
import { Badge, Button, Card, ChartFigure, Field, Panel, Slider, StatTile, TabPanel, Tabs } from '../../ui/primitives'
import { LabReflection } from '../../ui/lesson/LabReflection'
import { useProgress } from '../../store/progress'
import { LAB_BY_ID } from '../../content/labs'

const STRATEGY_INFO: Record<PlanningStrategy, { label: string; description: string }> = {
  greedy: { label: 'Greedy', description: 'Always steps toward the goal. No model of walls or locks, no memory of failure.' },
  'fixed-plan': { label: 'Fixed plan', description: 'Plans once at t=0 assuming the door is passable, then executes blindly.' },
  search: { label: 'Search-based', description: 'Breadth-first search over the full state space (position, key, door), then executes the optimal plan.' },
  reflective: { label: 'Reflective', description: 'Greedy, but remembers failures and replans from the current state (bounded replan budget).' },
}

export function PlanningLabPage() {
  const progress = useProgress()
  const lab = LAB_BY_ID.get('planning')
  const [strategy, setStrategy] = useState<PlanningStrategy>('greedy')
  const [slipProbability, setSlipProbability] = useState(0)
  const [seed, setSeed] = useState(1)
  const [tab, setTab] = useState<'world' | 'steps' | 'compare'>('world')

  const options = useMemo(() => ({ slipProbability, seed }), [slipProbability, seed])
  const run = useMemo(() => runPlanning(strategy, DEFAULT_WORLD, options), [strategy, options])
  const allRuns = useMemo(() => runAllStrategies(DEFAULT_WORLD, options), [options])

  const chartData = allRuns.map((entry) => ({
    name: STRATEGY_INFO[entry.strategy].label,
    actions: entry.actionCount,
    failures: entry.failures,
    replans: entry.replans,
  }))

  const cells = Array.from({ length: DEFAULT_WORLD.height * DEFAULT_WORLD.width }, (_, index) => {
    const x = index % DEFAULT_WORLD.width
    const y = Math.floor(index / DEFAULT_WORLD.width)
    return { x, y, kind: cellKind(DEFAULT_WORLD, [x, y]) }
  })

  const visited = new Set(run.steps.filter((step) => !step.failed).map((step) => `${step.to[0]},${step.to[1]}`))

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="cyan">Lab A</Badge>
          <Badge tone="neutral">Deterministic · no randomness</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{lab?.name ?? 'Agent Planning'}</h1>
        <p className="text-muted max-w-3xl text-sm">{lab?.description}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Plan length" value={String(run.planLength)} hint="Actions the planner produced" />
        <StatTile label="Actions executed" value={String(run.actionCount)} hint={`Budget ${DEFAULT_WORLD.budget}`} />
        <StatTile label="Failures" value={String(run.failures)} hint="Blocked moves and locked-door attempts" />
        <StatTile label="Goal reached" value={run.reachedGoal ? 'yes' : 'no'} hint={`${run.replans} replan(s)`} />
      </div>

      <Tabs
        idPrefix="planning-tabs"
        ariaLabel="Planning lab views"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'world', label: 'World' },
          { id: 'steps', label: `Step trace (${run.steps.length})` },
          { id: 'compare', label: 'Strategy comparison' },
        ]}
      />

      <TabPanel idPrefix="planning-tabs" id="world" active={tab === 'world'}>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <Panel title="Environment" subtitle="Start ▢, key ◆, door ▤ (locked), goal ★. Cyan tint marks cells the agent reached.">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${DEFAULT_WORLD.width}, minmax(0, 1fr))`, gap: 4 }}>
              {cells.map((cell) => {
                const reachable = visited.has(`${cell.x},${cell.y}`)
                const glyph =
                  cell.kind === 'start' ? 'S' : cell.kind === 'goal' ? '★' : cell.kind === 'key' ? '◆' : cell.kind === 'door' ? '▤' : ''
                return (
                  <div
                    key={`${cell.x}-${cell.y}`}
                    title={`(${cell.x},${cell.y}) ${cell.kind}`}
                    className="grid aspect-square place-items-center rounded-md border text-xs font-semibold"
                    style={{
                      borderColor: 'var(--border-soft)',
                      background:
                        cell.kind === 'wall'
                          ? 'rgba(148,178,255,0.22)'
                          : reachable
                            ? 'rgba(53,230,255,0.16)'
                            : 'var(--surface-2)',
                      color: cell.kind === 'goal' ? '#fbbf24' : cell.kind === 'key' ? '#a78bfa' : 'inherit',
                    }}
                  >
                    {glyph}
                  </div>
                )
              })}
            </div>
            <p className="text-muted text-[11px]">
              World {DEFAULT_WORLD.width}×{DEFAULT_WORLD.height}. The door is locked until the agent holds the key; greedy planners never fetch it.
            </p>
          </Panel>

          <div className="space-y-3">
            <Panel title="Planner" subtitle={STRATEGY_INFO[strategy].description}>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STRATEGY_INFO) as PlanningStrategy[]).map((candidate) => (
                  <Button
                    key={candidate}
                    variant={candidate === strategy ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => {
                      setStrategy(candidate)
                      progress.recordLab('planning', `${candidate}:goal=${runPlanning(candidate, DEFAULT_WORLD, options).reachedGoal}`)
                    }}
                  >
                    {STRATEGY_INFO[candidate].label}
                  </Button>
                ))}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSeed((value) => value + 1)}>
                Re-run with a new seed
              </Button>
            </Panel>

            <Panel
              title="World dynamics"
              subtitle="At 0% the world is deterministic and the four planners differ only in their reasoning. Above 0 the world sometimes does something else."
            >
              <Field label={`Slip probability: ${(slipProbability * 100).toFixed(0)}%`}>
                <Slider
                  label="Slip probability"
                  value={slipProbability}
                  min={0}
                  max={0.5}
                  step={0.05}
                  onChange={setSlipProbability}
                />
              </Field>
              <Field label={`Seed: ${seed}`}>
                <Slider label="Run seed" value={seed} min={1} max={20} step={1} onChange={setSeed} />
              </Field>
              <p className="text-muted text-[11px]">
                All four planners meet the same slips at the same step indices, so the comparison stays fair. The search planner's plan is computed
                in the deterministic model, so a slip is exactly the case its plan cannot account for — the model-based failure mode of Ch. 7, §7.3.5.
              </p>
            </Panel>

            <Panel title="Outcome" subtitle="How the run ended.">
              <p className="text-sm">
                {run.reachedGoal
                  ? `The ${STRATEGY_INFO[strategy].label.toLowerCase()} planner reached the goal after ${run.actionCount} actions with ${run.failures} failure(s).`
                  : `The ${STRATEGY_INFO[strategy].label.toLowerCase()} planner did NOT reach the goal within the ${DEFAULT_WORLD.budget}-action budget: ${run.failures} failure(s), ${run.replans} replan(s).`}
              </p>
              {run.failures > 0 ? (
                <div className="mt-2 space-y-1 text-xs">
                  <p className="text-muted font-semibold uppercase">First failures</p>
                  {run.steps
                    .filter((step) => step.failed)
                    .slice(0, 3)
                    .map((step) => (
                      <p key={step.index} className="text-muted">
                        #{step.index + 1} {step.action} from ({step.from.join(',')}): {step.note}
                      </p>
                    ))}
                </div>
              ) : null}
            </Panel>
          </div>
        </div>
      </TabPanel>

      <TabPanel idPrefix="planning-tabs" id="steps" active={tab === 'steps'}>
        <Panel title="Step trace" subtitle="Action, position transition and the note the harness recorded.">
          <ol tabIndex={0} aria-label="Step trace" className="thin-scroll max-h-[30rem] space-y-1.5 overflow-y-auto pr-1 text-xs focus-ring">
            {run.steps.map((step) => (
              <li
                key={step.index}
                className="surface-2 flex flex-wrap items-center gap-2 rounded border p-2"
                style={{ borderColor: step.failed ? 'rgba(251,113,133,0.45)' : 'var(--border-soft)' }}
              >
                <span className="text-muted font-mono text-[10px]">#{step.index + 1}</span>
                <Badge tone={step.failed ? 'rose' : step.action === 'replan' ? 'violet' : 'neutral'}>{step.action}</Badge>
                <span className="text-muted">
                  ({step.from.join(',')}) → ({step.to.join(',')})
                </span>
                <span className="w-full sm:w-auto sm:flex-1">{step.note}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </TabPanel>

      <TabPanel idPrefix="planning-tabs" id="compare" active={tab === 'compare'}>
        <div className="space-y-4">
          <Panel title="Strategy comparison" subtitle="Same world, same budget. Actions include failed moves and replan markers.">
            <ChartFigure
              title="Planner strategy comparison"
              description="Actions executed, failures and replans for each of the four planning strategies, in the same world and with the same step budget."
              columns={['Strategy', 'Actions', 'Failures', 'Replans']}
              rows={chartData.map((entry) => [entry.name, entry.actions, entry.failures, entry.replans])}
            >
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(148,178,255,0.12)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9aa7c7" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#9aa7c7" width={36} />
                    <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid rgba(148,178,255,0.25)', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="actions" fill="#35e6ff" name="actions executed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failures" fill="#fb7185" name="failures" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="replans" fill="#a78bfa" name="replans" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartFigure>
          </Panel>

          <Card className="overflow-x-auto p-4">
            <table className="w-full min-w-[520px] border-collapse text-xs">
              <caption className="text-muted mb-2 text-left">Detailed results</caption>
              <thead>
                <tr>
                  {['Strategy', 'Plan length', 'Actions', 'Failures', 'Replans', 'Goal'].map((header) => (
                    <th key={header} scope="col" className="border-b px-2 py-1 text-left uppercase" style={{ borderColor: 'var(--border-soft)' }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allRuns.map((entry) => (
                  <tr key={entry.strategy}>
                    <td className="border-b px-2 py-1" style={{ borderColor: 'var(--border-soft)' }}>
                      {STRATEGY_INFO[entry.strategy].label}
                    </td>
                    <td className="border-b px-2 py-1" style={{ borderColor: 'var(--border-soft)' }}>
                      {entry.planLength}
                    </td>
                    <td className="border-b px-2 py-1" style={{ borderColor: 'var(--border-soft)' }}>
                      {entry.actionCount}
                    </td>
                    <td className="border-b px-2 py-1" style={{ borderColor: 'var(--border-soft)' }}>
                      {entry.failures}
                    </td>
                    <td className="border-b px-2 py-1" style={{ borderColor: 'var(--border-soft)' }}>
                      {entry.replans}
                    </td>
                    <td className="border-b px-2 py-1" style={{ borderColor: 'var(--border-soft)' }}>
                      {entry.reachedGoal ? 'yes' : 'no'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Panel title="What to notice" subtitle="Discussion prompts for this lab.">
            <ul className="text-muted space-y-2 text-xs">
              <li>
                Greedy planning is cheap and locally rational, yet it cannot discover that the door requires a key — a concrete instance of why
                state-aware planning (Ch. 6 §6.2.3) is needed for agentic tasks.
              </li>
              <li>
                The fixed plan is computed with complete map knowledge but an incorrect model of one transition. One wrong assumption invalidates an
                otherwise optimal plan: this is the model-error lesson that Lab C formalises.
              </li>
              <li>
                Search-based planning is optimal here, but it relies on the full state space being known and cheap to enumerate. For real environments
                that assumption fails, which is where self-reflection and world models enter.
              </li>
              <li>Reflective planning trades extra steps for robustness: it recovers from failure without full knowledge of the environment.</li>
            </ul>
          </Panel>
        </div>
      </TabPanel>

      <LabReflection labId="planning" />
    </div>
  )
}
