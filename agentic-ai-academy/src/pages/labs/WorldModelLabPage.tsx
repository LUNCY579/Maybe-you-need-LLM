import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ACTION_NAMES,
  DEFAULT_WORLD_MODEL_CONFIG,
  allCells,
  isWallish,
  runWorldModelLab,
  type WorldModelConfig,
} from '../../engine/labs/worldModel'
import {
  Badge,
  Button,
  Card,
  ChartFigure,
  Field,
  Panel,
  Slider,
  StatTile,
  TabPanel,
  Tabs,
} from '../../ui/primitives'
import { LabReflection } from '../../ui/lesson/LabReflection'
import { useProgress } from '../../store/progress'
import { LAB_BY_ID } from '../../content/labs'

/** Cell colours for any world, not only the Lab C default one. */
function worldCellStyle(world: WorldModelConfig) {
  return (x: number, y: number) => {
    if (isWallish(world, x, y)) return { background: 'rgba(148,178,255,0.22)' }
    if (x === world.goal[0] && y === world.goal[1]) return { background: 'rgba(52,211,153,0.25)' }
    if (x === world.pit[0] && y === world.pit[1]) return { background: 'rgba(251,113,133,0.22)' }
    if (x === world.start[0] && y === world.start[1]) return { background: 'rgba(251,191,36,0.22)' }
    return { background: 'var(--surface-2)' }
  }
}


/** Greedy arrow for a policy; empty where the policy has nothing to say about the cell. */
function arrowFor(policy: Record<string, number>, x: number, y: number) {
  const action = policy[`${x},${y}`]
  if (action === undefined) return ''
  return ['↑', '→', '↓', '←'][action] ?? ''
}

export function WorldModelLabPage() {
  const progress = useProgress()
  const lab = LAB_BY_ID.get('world-model')
  const [config, setConfig] = useState<WorldModelConfig>(DEFAULT_WORLD_MODEL_CONFIG)
  const [tab, setTab] = useState<'grid' | 'curve' | 'divergence'>('grid')

  const run = useMemo(() => runWorldModelLab(config), [config])
  // The same environment with a planning agent that believes nothing ever slips:
  // the comparison the first discussion prompt asks the student to make.
  const naiveModel = useMemo(() => runWorldModelLab({ ...config, modelAccuracy: 0 }), [config])
  const cells = useMemo(() => allCells(config), [config])
  const update = (patch: Partial<WorldModelConfig>) => setConfig((current) => ({ ...current, ...patch }))

  const cellStyle = worldCellStyle(config)

  const curveData = run.modelFree.trainingCurve
    .filter((point) => point.episode % Math.max(1, Math.floor(config.episodes / 60)) === 0)
    .map((point) => ({ episode: point.episode, reward: point.reward, epsilon: point.epsilon }))

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="emerald">Lab C</Badge>
          <Badge tone="neutral">Seeded · reproducible per seed</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{lab?.name ?? 'World Model & Decision Making'}</h1>
        <p className="text-muted max-w-3xl text-sm">{lab?.description}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Model-free reward" value={run.modelFree.evaluation.averageReward.toFixed(2)} hint={`success ${(run.modelFree.evaluation.successRate * 100).toFixed(0)}%`} />
        <StatTile label="Model-based reward" value={run.modelBased.evaluation.averageReward.toFixed(2)} hint={`success ${(run.modelBased.evaluation.successRate * 100).toFixed(0)}%`} />
        <StatTile
          label="Model-free steps"
          value={run.modelFree.evaluation.averageSteps.toFixed(1)}
          hint={`vs ${run.modelBased.evaluation.averageSteps.toFixed(1)} for planning`}
        />
        <StatTile label="Mean model divergence" value={run.meanDivergence.toFixed(3)} hint={`accuracy setting ${config.modelAccuracy.toFixed(2)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Panel
          title="Environment and learner"
          subtitle="All parameters are deterministic; each seed gives one reproducible run."
        >
              <Field label={`Slip probability: ${config.slip.toFixed(2)}`} hint="Probability that the executed action slips to a perpendicular direction.">
                <Slider label="Slip probability" value={config.slip} min={0} max={0.5} step={0.05} onChange={(value) => update({ slip: value })} />
              </Field>
              <Field label={`Learned-model accuracy: ${config.modelAccuracy.toFixed(2)}`} hint="How faithful the planning agent's model is to the true dynamics.">
                <Slider
                  label="Model accuracy"
                  value={config.modelAccuracy}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(value) => update({ modelAccuracy: value })}
                />
              </Field>
              <Field label={`Training episodes: ${config.episodes}`}>
                <Slider label="Training episodes" value={config.episodes} min={40} max={600} step={20} onChange={(value) => update({ episodes: value })} />
              </Field>
              <Field label={`Seeds / evaluation episodes: ${config.evalEpisodes}`}>
                <Slider label="Evaluation episodes" value={config.evalEpisodes} min={5} max={60} onChange={(value) => update({ evalEpisodes: value })} />
              </Field>
              <Field label={`Random seed: ${config.seed}`}>
                <Slider label="Random seed" value={config.seed} min={1} max={30} onChange={(value) => update({ seed: value })} />
              </Field>
              <Button
                size="sm"
                onClick={() => {
                  setConfig(DEFAULT_WORLD_MODEL_CONFIG)
                  progress.recordLab('world-model', `reset:seed=${config.seed}`)
                }}
              >
                Restore defaults
              </Button>
              <p className="text-muted text-[11px]">
                Rewards: goal {config.goalReward}, pit {config.pitReward}, step {config.stepCost}. Discount {config.discount}; planning sweeps{' '}
                {config.planningSweeps}.
              </p>
        </Panel>

        <div className="space-y-4">
          <Tabs
            idPrefix="world-model-tabs"
            ariaLabel="World model views"
            active={tab}
            onChange={(next) => {
              setTab(next)
            }}
            tabs={[
              { id: 'grid', label: 'Policies' },
              { id: 'curve', label: 'Learning curve' },
              { id: 'divergence', label: 'Predicted vs actual' },
            ]}
          />

          <TabPanel idPrefix="world-model-tabs" id="grid" active={tab === 'grid'}>
            <div className="grid gap-3 md:grid-cols-2">
              <Panel title="Model-free policy" subtitle="Greedy action from the learned Q-table after training.">
                <Grid config={config} cells={cells} cellStyle={cellStyle} arrowFor={(x, y) => arrowFor(run.modelFree.policy, x, y)} />
                <p className="text-muted mt-2 text-[11px]">
                  Trained without any model of the environment: {config.episodes} episodes of acting and receiving reward, no dynamics learned at all.
                </p>
              </Panel>
              <Panel title="Model-based policy" subtitle="Greedy action from value iteration inside the learned model.">
                <Grid config={config} cells={cells} cellStyle={cellStyle} arrowFor={(x, y) => arrowFor(run.modelBased.policy, x, y)} />
                <p className="text-muted mt-2 text-[11px]">
                  Planned with {run.modelBased.sweeps} value-iteration sweeps over a model with accuracy {config.modelAccuracy.toFixed(2)}. Compare the
                  arrows around the pit and the walls: differences here are planning errors, not learning errors.
                </p>
              </Panel>
            </div>
          </TabPanel>

          <TabPanel idPrefix="world-model-tabs" id="curve" active={tab === 'curve'}>
            <Panel title="Model-free training curve" subtitle="Episode reward while interacting with the true environment.">
              <ChartFigure
                title="Model-free training curve"
                description="Episode reward and the exploration rate ε over training episodes, for the Q-learning agent interacting with the true environment."
                columns={['Episode', 'Reward', 'Exploration ε']}
                rows={curveData.map((entry) => [entry.episode, entry.reward, entry.epsilon])}
              >
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={curveData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke="rgba(148,178,255,0.12)" />
                      <XAxis dataKey="episode" tick={{ fontSize: 10 }} stroke="#9aa7c7" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#9aa7c7" width={44} />
                      <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid rgba(148,178,255,0.25)', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="reward" stroke="#35e6ff" dot={false} strokeWidth={2} name="episode reward" />
                      <Line type="monotone" dataKey="epsilon" stroke="#a78bfa" dot={false} strokeWidth={1.4} strokeDasharray="4 3" name="exploration ε" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartFigure>
              <p className="text-muted mt-2 text-[11px]">
                Compare with the model-based agent: it reaches a policy with zero episodes of true-environment interaction, but its quality depends on the
                accuracy of its model. That trade — sample efficiency versus model error — is the core of Ch. 7 §7.3.
              </p>
            </Panel>
          </TabPanel>

          <TabPanel idPrefix="world-model-tabs" id="divergence" active={tab === 'divergence'}>
            <Panel title="Predicted vs actual transitions" subtitle="Top divergent states visited by the model-based policy.">
              {run.divergences.length === 0 ? (
                <p className="text-muted text-xs">No transitions were observed; increase evaluation episodes.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {run.divergences.map((entry) => (
                    <div key={`${entry.state.join('-')}-${entry.action}`} className="surface-2 rounded border p-2" style={{ borderColor: 'var(--border-soft)' }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="cyan">
                          state ({entry.state.join(',')}) · action {ACTION_NAMES[entry.action]}
                        </Badge>
                        <Badge tone={entry.divergence > 0.3 ? 'rose' : entry.divergence > 0.1 ? 'amber' : 'emerald'}>
                          divergence {entry.divergence.toFixed(2)}
                        </Badge>
                      </div>
                      <p className="mt-1">
                        <strong>predicted:</strong>{' '}
                        {entry.predicted.map((outcome) => `(${outcome.next.join(',')}) p=${outcome.probability.toFixed(2)}`).join(' · ')}
                      </p>
                      <p>
                        <strong>actual:</strong>{' '}
                        {entry.actual.map((outcome) => `(${outcome.next.join(',')}) freq=${outcome.frequency.toFixed(2)}`).join(' · ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </TabPanel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Method</h2>
          <ul className="text-muted mt-2 space-y-2 text-xs">
            <li>
              <strong>Model-free:</strong> tabular Q-learning on the true environment (α = 0.3, ε decaying from 1.0 to 0.05, γ = {config.discount}), then
              greedy evaluation.
            </li>
            <li>
              <strong>Model-based:</strong> the learner holds a transition model between the true slip dynamics and a naive deterministic belief,
              interpolated by the accuracy slider; value iteration plans inside that belief; the resulting policy is then executed in the real world.
            </li>
            <li>
              <strong>Comparability:</strong> identical environment, identical evaluation episodes and poses, and the same seeded generator for the plan-
              execution noise (offset so the two agents do not share trajectories). The comparison is not rigged in either direction.
            </li>
          </ul>
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-semibold">What to notice</h2>
          <ul className="text-muted mt-2 space-y-2 text-xs">
            <li>
              Set model accuracy to 0.0: the planning agent believes its actions always work. The cost is measurable rather than dramatic — mean
              divergence {run.meanDivergence.toFixed(3)} becomes {naiveModel.meanDivergence.toFixed(3)} while on this seed the outcome does not move at
              all ({naiveModel.modelBased.evaluation.averageReward.toFixed(2)} reward,{' '}
              {(naiveModel.modelBased.evaluation.successRate * 100).toFixed(0)}% success). Read the divergence rather than the score: a plan built on a
              wrong model can still arrive, and that is exactly the failure an outcome-only review cannot see.
            </li>
            <li>Set slip to 0: both agents solve the task; the difference becomes cost, not outcome.</li>
            <li>
              Watch the divergence table: it converts “the model is wrong” into a number per state. That is the diagnostic value of a world model in a
              debugging loop.
            </li>
            <li>
              The model-free agent needs many episodes; the model-based one needs a model. Neither is free, which is why Ch. 7 presents world models as a
              complement to interaction rather than a replacement.
            </li>
          </ul>
        </Card>
      </div>

      <LabReflection labId="world-model" />
    </div>
  )
}

function Grid({
  config,
  cells,
  cellStyle,
  arrowFor,
}: {
  config: WorldModelConfig
  cells: [number, number][]
  cellStyle: (x: number, y: number) => { background: string }
  arrowFor: (x: number, y: number) => string
}) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${config.width}, minmax(0, 1fr))`, gap: 4 }}>
      {Array.from({ length: config.width * config.height }, (_, index) => {
        const x = index % config.width
        const y = Math.floor(index / config.width)
        const inPlay = cells.some((cell) => cell[0] === x && cell[1] === y)
        return (
          <div
            key={`${x}-${y}`}
            className="grid aspect-square place-items-center rounded-md border text-sm font-semibold"
            style={{ borderColor: 'var(--border-soft)', ...cellStyle(x, y) }}
            title={`(${x},${y})`}
          >
            {inPlay ? arrowFor(x, y) : ''}
          </div>
        )
      })}
    </div>
  )
}
