import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  ACTION_NAMES,
  buildGridworld,
  positionOf,
  rollout,
  SoftmaxPolicy,
  stateCount,
  transition,
  valueIteration,
} from '../../core/mdp'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'world' | 'value' | 'optimal'

export function GridworldLab() {
  const [view, setView] = useState<View>('world')
  const [accuracy, setAccuracy] = useState(0.8)
  const [stepReward, setStepReward] = useState(-1)
  const [goalReward, setGoalReward] = useState(10)
  const [seed, setSeed] = useState(5)

  const world = useMemo(
    () => buildGridworld({ accuracy, stepReward, goalReward }),
    [accuracy, stepReward, goalReward],
  )

  const optimal = useMemo(() => valueIteration(world), [world])

  const trajectory = useMemo(() => {
    const policy = new SoftmaxPolicy(stateCount(world), 4)
    return rollout(world, policy, seed)
  }, [world, seed])

  const sweep = useMemo(() => {
    const rows: { x: number; value: number }[] = []
    let values = new Array<number>(stateCount(world)).fill(0)
    for (let iteration = 0; iteration < 40; iteration++) {
      const next = valueIteration(world, { maxIterations: 1, tolerance: 0 })
      values = next.values
      rows.push({ x: iteration + 1, value: values[0] ?? 0 })
    }
    return rows
  }, [world])

  return (
    <div className="lab">
      <Panel
        title="Laboratory A · The gridworld"
        subtitle="The problem, and the exact answers to it"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'world', label: 'The world' },
              { value: 'value', label: 'The value' },
              { value: 'optimal', label: 'The optimum' },
            ]}
          />
          <Slider
            label="The accuracy of a move"
            value={accuracy}
            min={0.3}
            max={1}
            step={0.05}
            onChange={setAccuracy}
            format={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Slider label="The reward for a step" value={stepReward} min={-5} max={0} step={0.5} onChange={setStepReward} />
          <Slider label="The reward for the goal" value={goalReward} min={0} max={30} step={1} onChange={setGoalReward} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="The states" value={String(stateCount(world))} />
          <Stat
            label="The optimal value"
            value={fmt(optimal.values[0] ?? 0, 4)}
            hint="from the start state"
            tone="good"
          />
          <Stat label="The sweeps" value={String(optimal.iterations)} />
          <Stat
            label="The residual"
            value={optimal.residual.toExponential(2)}
            tone={optimal.residual < 1e-8 ? 'good' : 'warn'}
          />
        </div>

        {view === 'world' ? (
          <>
            <Figure
              title="The grid"
              description="Every state, its value, and the action the optimal policy takes there."
              caption="The value of a state is what the agent expects to collect from it. The walls and the goal are where the structure is."
            >
              <DataTable
                caption="The value of every state"
                headers={['The state', 'The position', 'The value', 'The optimal action', 'The reward for it']}
                rows={Array.from({ length: stateCount(world) }, (_, state) => {
                  const { row, column } = positionOf(world, state)
                  const wall = world.walls.includes(state)
                  const goal = world.terminal.includes(state)
                  const action = optimal.policy[state] ?? 0
                  return [
                    state,
                    wall ? 'a wall' : goal ? 'the goal' : `row ${row}, column ${column}`,
                    goal ? '—' : fmt(optimal.values[state] ?? 0, 3),
                    goal || wall ? '—' : ACTION_NAMES[action],
                    goal || wall ? '—' : fmt(transition(world, state, action).reward, 3),
                  ]
                })}
              />
            </Figure>

            <Figure
              title="One episode, and what it collected"
              description="The states the agent visited, the actions it took, and the rewards it received."
              caption="The return is the sum of the rewards, each weighted by a power of the discount. The goal pays, and every step costs."
            >
              <DataTable
                caption="The episode"
                headers={['The step', 'The state', 'The action', 'The reward', 'The return so far']}
                rows={trajectory.states.slice(0, 18).map((state, index) => [
                  index,
                  state,
                  ACTION_NAMES[trajectory.actions[index] ?? 0],
                  fmt(trajectory.rewards[index] ?? 0, 2),
                  fmt(
                    trajectory.rewards
                      .slice(0, index + 1)
                      .reduce((sum, reward, k) => sum + reward * 0.95 ** k, 0),
                    3,
                  ),
                ])}
              />
            </Figure>

            <Callout tone="note" title="Why the moves slip">
              A move goes where it was aimed with a probability of {accuracy}. The rest of the time it goes somewhere
              else. That is what makes the problem a stochastic one, and it is why the value function is an expectation
              rather than a path length.
            </Callout>
          </>
        ) : null}

        {view === 'value' ? (
          <>
            <Figure
              title="The value, sweep by sweep"
              description="The value of the start state as the Bellman operator is applied over and over."
              caption="Each sweep replaces every value with the value of the best action. The sequence converges, and the difference between the last two sweeps is the residual."
            >
              <TrendChart
                data={sweep}
                series={[{ key: 'value', name: 'the value of the start state', colour: 'var(--accent-indigo)' }]}
                xLabel="the sweep"
                yLabel="the value"
                height={260}
              />
            </Figure>

            <Figure
              title="The transition kernel"
              description="The probability of each outcome, for the four actions, from the start state."
              caption="The kernel is the whole of the environment. Everything else in this course is a way of reasoning about it."
            >
              <DataTable
                caption="The outcomes of each action, from the start state"
                headers={['The action', ...Array.from({ length: stateCount(world) }, (_, state) => String(state))]}
                rows={ACTION_NAMES.map((_, action) => {
                  const { probabilities } = transition(world, 0, action as 0)
                  return [
                    ACTION_NAMES[action],
                    ...probabilities.map((probability) => (probability > 0 ? fmt(probability, 3) : '·')),
                  ]
                })}
              />
            </Figure>

            <Callout tone="definition" title="What the Bellman equation is worth">
              The equation is a fixed point: the value function is the one that satisfies it. Iterating it converges to
              that function, because the operator is a contraction — and the residual, the largest difference between
              two consecutive sweeps, is the number that says how nearly it has converged.
            </Callout>
          </>
        ) : null}

        {view === 'optimal' ? (
          <>
            <Figure
              title="The optimal policy"
              description="The action to take in each state, and the value of taking it."
              caption="The greedy policy with respect to the optimal value function is the optimal policy. It costs no more to find than one policy evaluation."
            >
              <DataTable
                caption="The optimal policy"
                headers={['The state', 'The position', 'The value', 'The action']}
                rows={Array.from({ length: stateCount(world) }, (_, state) => {
                  const { row, column } = positionOf(world, state)
                  const wall = world.walls.includes(state)
                  const goal = world.terminal.includes(state)
                  return [
                    state,
                    wall ? 'a wall' : goal ? 'the goal' : `row ${row}, column ${column}`,
                    goal ? '—' : fmt(optimal.values[state] ?? 0, 3),
                    goal || wall ? '—' : ACTION_NAMES[optimal.policy[state] ?? 0],
                  ]
                })}
              />
            </Figure>

            <Callout tone="warning" title="The answer every other laboratory is checked against">
              A policy gradient is trying to find this policy, by a much more expensive route: it never writes the
              equation down, and it estimates the answer from samples. The laboratories that follow compare the two —
              and the comparison is the sharpest check there is.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
