import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import type { ShopAction } from '../../core/landscape'
import {
  MODEL_PROFILES,
  divergenceStep,
  environmentScores,
  landscapeSummary,
  replay,
  replayDigest,
} from '../../core/landscape'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'

type View = 'profiles' | 'average' | 'reproducibility'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const ENVIRONMENTS_VIEWS: { value: View; label: string }[] = [
  { value: 'profiles', label: 'The profiles' },
  { value: 'average', label: 'The average' },
  { value: 'reproducibility', label: 'The replay' },
]

const ACTIONS: ShopAction[] = ['search', 'add', 'add', 'checkout']

export function EnvironmentsLab() {
  const [view, setView] = useViewParam(ENVIRONMENTS_VIEWS)
  const [seed, setSeed] = useState(5)

  const rows = useMemo(() => environmentScores(), [])
  const summary = useMemo(() => landscapeSummary(rows), [rows])
  const large = summary.models.find((entry) => entry.model.id === 'large')!

  const first = useMemo(() => replay([...ACTIONS], seed), [seed])
  const second = useMemo(() => replay([...ACTIONS], seed), [seed])
  const changed = useMemo(() => {
    const actions = [...ACTIONS] as ShopAction[]
    actions[2] = 'remove'
    return actions
  }, [])

  return (
    <div className="lab">
      <Panel
        title="Laboratory E · The environments"
        subtitle="One average over eight worlds, and whether the world can be replayed"
        accent="rose"
      >
        <div className="lab-controls">
          <SegmentedControl label="View" value={view} onChange={setView} options={ENVIRONMENTS_VIEWS} />
          <Slider label="The environment’s seed" value={seed} min={1} max={12} onChange={setSeed} />
        </div>

        {view === 'profiles' ? (
          <>
            <div className="stat-row">
              <Stat label="The environments" value={String(rows.length)} />
              <Stat label="The models" value={String(MODEL_PROFILES.length)} />
              <Stat label="The best average" value={summary.bestByAverage} />
              <Stat
                label="Environments where the average is wrong"
                value={String(summary.exceptions)}
                tone="warn"
              />
            </div>

            <Figure
              title="The score matrix"
              description="Every model in every environment, with the best score in each row marked."
              caption="AgentBench is eight environments with one shared harness. Reading the matrix by row is reading it the way the benchmark reports it; reading it by column is reading it the way a user picks a model."
            >
              <DataTable
                caption="The environment profiles"
                headers={['The environment', ...MODEL_PROFILES.map((model) => model.name), 'The best']}
                rows={rows.map((row) => {
                  const best = Math.max(...row.scores)
                  const winner = MODEL_PROFILES[row.scores.indexOf(best)]?.name ?? '—'
                  return [
                    row.environment.name,
                    ...row.scores.map((score) => `${fmt(score * 100, 1)}%`),
                    winner,
                  ]
                })}
              />
            </Figure>

            <Figure
              title="The same matrix, drawn"
              description="Each model’s score in each environment; the environments are in the paper’s order."
              caption="The lines cross. A single number per model would have to flatten every crossing into an average, and the crossings are where the interesting behaviour is."
            >
              <TrendChart
                data={rows.map((row, index) => ({
                  x: index + 1,
                  ...Object.fromEntries(
                    MODEL_PROFILES.map((model, modelIndex) => [
                      model.id,
                      (row.scores[modelIndex] ?? 0) * 100,
                    ]),
                  ),
                }))}
                series={MODEL_PROFILES.map((model, index) => ({
                  key: model.id,
                  name: model.name,
                  colour: ['var(--accent-emerald)', 'var(--accent-amber)', 'var(--accent-rose)', 'var(--accent-indigo)'][index]!,
                }))}
                xLabel="the environment, in the paper’s order"
                yLabel="the score, in per cent"
                height={280}
              />
            </Figure>

            <Callout tone="note" title="A synthetic matrix">
              The scores are a logistic function of a capability and an environment difficulty, chosen so the
              crossing is visible. They are not AgentBench’s published table; the point they make is structural — a
              model can be strong in most environments and weak in one.
            </Callout>
          </>
        ) : null}

        {view === 'average' ? (
          <>
            <div className="stat-row">
              <Stat label="The large model’s mean" value={`${fmt(large.mean * 100, 1)}%`} />
              <Stat label="Its worst environment" value={`${fmt(large.min * 100, 1)}%`} tone="warn" />
              <Stat label="The spread it hides" value={`${fmt(large.spread * 100, 1)} points`} tone="warn" />
              <Stat label="Environments it wins" value={`${large.wins} of ${rows.length}`} />
            </div>

            <Figure
              title="The average, and what it costs"
              description="Each model’s mean score, the worst environment it has, and the number of environments it wins."
              caption="The best average and the most wins are both summary statistics, and they do not answer the same question. A model chosen on the average can be the worst model for the task in front of you."
            >
              <DataTable
                caption="The summaries"
                headers={['The model', 'The mean', 'The worst', 'The best', 'The spread', 'The environments won']}
                rows={summary.models.map((entry) => [
                  entry.model.name,
                  `${fmt(entry.mean * 100, 1)}%`,
                  `${fmt(entry.min * 100, 1)}%`,
                  `${fmt(entry.max * 100, 1)}%`,
                  `${fmt(entry.spread * 100, 1)} points`,
                  entry.wins,
                ])}
              />
            </Figure>

            <Figure
              title="Mean and worst, side by side"
              description="The average score and the worst environment, for every model."
              caption="The gap between the two bars is the failure the average hides. It is not noise: it is one environment where the model does not work."
            >
              <TrendChart
                data={summary.models.map((entry, index) => ({
                  x: index + 1,
                  mean: entry.mean * 100,
                  worst: entry.min * 100,
                }))}
                series={[
                  { key: 'mean', name: 'the mean', colour: 'var(--accent-rose)' },
                  { key: 'worst', name: 'the worst environment', colour: 'var(--accent-amber)' },
                ]}
                xLabel="the model, in the table’s order"
                yLabel="the score, in per cent"
                height={260}
              />
            </Figure>

            <Callout tone="warning" title="One number is a decision, not a description">
              The paper’s finding is not that averages are dishonest; it is that an agent benchmark is a profile. If
              a deployment picks the model with the highest mean and the deployment’s task lives in the model’s worst
              environment, the average was the wrong statistic to choose on.
            </Callout>
          </>
        ) : null}

        {view === 'reproducibility' ? (
          <>
            <div className="stat-row">
              <Stat label="The steps replayed" value={String(first.length - 1)} />
              <Stat
                label="The two runs"
                value={replayDigest(first) === replayDigest(second) ? 'identical' : 'different'}
                tone="good"
              />
              <Stat
                label="The changed action diverges at"
                value={`step ${divergenceStep([...ACTIONS], changed, seed)}`}
                tone="warn"
              />
              <Stat label="The seed" value={String(seed)} />
            </div>

            <Figure
              title="The trajectory, replayed"
              description="The state after every action, in the same environment and from the same seed."
              caption="WebArena’s environments are self-hosted, so a recorded trajectory can be replayed exactly. That is what turns a benchmark score into something another laboratory can check."
            >
              <DataTable
                caption="The replay"
                headers={['The step', 'The action', 'The page', 'The cart']}
                rows={first.slice(1).map((state, index) => [
                  state.step,
                  ACTIONS[index],
                  state.page,
                  state.cart,
                ])}
              />
            </Figure>

            <Figure
              title="A changed action, and where it shows"
              description="The step at which the replay of a trajectory with one action changed first disagrees with the original."
              caption="The divergence begins at the changed action and not before. That is what a deterministic environment buys: a difference in outcome can be attributed to the action that caused it."
            >
              <DataTable
                caption="The original and the perturbation"
                headers={['The step', 'The original', 'The perturbed']}
                rows={first.map((state, index) => [
                  state.step,
                  `${state.page}, ${state.cart} in the cart`,
                  index < divergenceStep([...ACTIONS], changed, seed)
                    ? `${state.page}, ${state.cart} in the cart`
                    : `${replay(changed, seed)[index]?.page ?? '—'}, ${replay(changed, seed)[index]?.cart ?? '—'} in the cart`,
                ])}
              />
            </Figure>

            <Callout tone="definition" title="Reproducibility is an environment property">
              A benchmark whose environment drifts cannot separate a better agent from a different day. Self-hosting
              the environment, seeding it, and recording the actions make the score a property of the agent rather
              than of the audit.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
