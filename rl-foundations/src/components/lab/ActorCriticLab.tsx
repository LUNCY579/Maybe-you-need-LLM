import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildGridworld, policyReturn, SoftmaxPolicy, stateCount } from '../../core/mdp'
import { criticGap, optimalValue, runActorCritic } from '../../core/actorcritic'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'loop'

export function ActorCriticLab() {
  const [view] = useState<View>('loop')
  const [episodes, setEpisodes] = useState(300)
  const [actorRate, setActorRate] = useState(0.02)
  const [criticRate, setCriticRate] = useState(0.5)
  const [discount, setDiscount] = useState(0.95)
  const [useBaseline, setUseBaseline] = useState(true)
  const [seed, setSeed] = useState(5)

  const world = useMemo(() => buildGridworld(), [])
  const policy = useMemo(() => new SoftmaxPolicy(stateCount(world), 4), [world])

  const run = useMemo(
    () =>
      runActorCritic(world, policy, {
        episodes,
        actorLearningRate: actorRate,
        criticLearningRate: criticRate,
        discount,
        seed,
        useBaseline,
      }),
    [world, policy, episodes, actorRate, criticRate, discount, seed, useBaseline],
  )

  const ceiling = useMemo(() => optimalValue(world), [world])
  const random = useMemo(() => policyReturn(world, policy), [world, policy])
  const learned = useMemo(() => policyReturn(world, run.policy), [world, run.policy])

  return (
    <div className="lab">
      <Panel
        title="Laboratory D · The actor–critic loop"
        subtitle="Two halves learning together, and the curves they produce"
        accent="emerald"
      >
        <div className="lab-controls">
          <SegmentedControl label="View" value={view} onChange={() => undefined} options={[{ value: 'loop', label: 'The loop' }]} />
          <Slider label="The episodes" value={episodes} min={50} max={1000} step={50} onChange={setEpisodes} />
          <Slider
            label="The actor’s learning rate"
            value={actorRate}
            min={0.001}
            max={0.2}
            step={0.001}
            onChange={setActorRate}
            format={(value) => value.toFixed(3)}
          />
          <Slider
            label="The critic’s learning rate"
            value={criticRate}
            min={0.05}
            max={1}
            step={0.05}
            onChange={setCriticRate}
            format={(value) => value.toFixed(2)}
          />
          <Slider
            label="The discount"
            value={discount}
            min={0.5}
            max={1}
            step={0.01}
            onChange={setDiscount}
            format={(value) => value.toFixed(2)}
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
          <div className="field">
            <span className="field-label">The baseline</span>
            <button
              type="button"
              className={useBaseline ? 'btn btn-primary' : 'btn btn-default'}
              onClick={() => setUseBaseline(!useBaseline)}
            >
              {useBaseline ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        <div className="stat-row">
          <Stat label="The random policy is worth" value={fmt(random, 3)} tone="warn" />
          <Stat label="The learned policy is worth" value={fmt(learned, 3)} tone="good" />
          <Stat label="The optimum is worth" value={fmt(ceiling, 3)} />
          <Stat
            label="The critic’s gap"
            value={fmt(criticGap(world, run.policy, run.values), 4)}
            hint="what it believes, minus the truth"
          />
        </div>

        <Figure
          title="The learning curve"
          description="The average return over the last twenty episodes, and the value the optimal policy achieves."
          caption="The agent is doing dynamic programming by accident: it never writes the equation down, and it estimates the answer from samples."
        >
          <TrendChart
            data={run.episodes.map((record) => ({
              x: record.episode,
              average: record.average,
              ceiling,
            }))}
            series={[
              { key: 'average', name: 'the average return', colour: 'var(--accent-emerald)' },
              { key: 'ceiling', name: 'the optimal value of the start state', colour: 'var(--accent-indigo)' },
            ]}
            xLabel="the episode"
            yLabel="the return"
            height={280}
          />
        </Figure>

        <Figure
          title="The two halves"
          description="What the critic believed at the end, and what the policy is actually worth."
          caption="The gap between the two is the diagnostic: a critic that is too optimistic pushes the actor too hard, and one that is too pessimistic gives up."
        >
          <DataTable
            caption="The state of the two halves"
            headers={['The quantity', 'The value']}
            rows={[
              ['the critic’s value of the start state', fmt(run.values[0] ?? 0, 4)],
              ['the gap from the truth', fmt(criticGap(world, run.policy, run.values), 4)],
              ['the policy the actor found', fmt(learned, 4)],
              ['the optimal policy', fmt(ceiling, 4)],
              ['the norm of the actor’s parameters', fmt(run.episodes[run.episodes.length - 1]?.parameterNorm ?? 0, 4)],
            ]}
          />
        </Figure>

        <Callout tone="definition" title="What the critic is for">
          The actor needs to know which of its actions were better than it expected. The return tells it, but the
          return is mostly made up of things that were going to happen anyway. The critic estimates the part that was
          not, and that part is the advantage — a smaller signal, a better one, and the reason the actor–critic family
          exists.
        </Callout>
      </Panel>
    </div>
  )
}
