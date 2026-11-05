import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  buildDemonstrations,
  buildPreferencePairs,
  distance,
  meanChoice,
  preferredRound,
  runTwoRound,
  trainSecondRound,
  utility,
} from '../../core/alignment'
import { Callout, DataTable, Figure, Panel, SegmentedControl, Slider, Stat, TrendChart } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'
import { ALIGNMENT_DEFAULTS } from '../../content/labDefaults'

type View = 'reach' | 'trade'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const ALIGNMENT_VIEWS: { value: View; label: string }[] = [
  { value: 'reach', label: 'What the rounds reach' },
  { value: 'trade', label: 'What the compromise costs' },
]

const WEIGHTS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]

/** The mean of one half of the pool, which is the point a round-one model could never reach alone. */
function clusterMean(entries: { kind: string; helpfulness: number; harmlessness: number }[], kind: string) {
  const half = entries.filter((entry) => entry.kind === kind)
  if (half.length === 0) return { helpfulness: 0, harmlessness: 0 }
  return {
    helpfulness: half.reduce((sum, entry) => sum + entry.helpfulness, 0) / half.length,
    harmlessness: half.reduce((sum, entry) => sum + entry.harmlessness, 0) / half.length,
  }
}

export function AlignmentLab() {
  const [view, setView] = useViewParam(ALIGNMENT_VIEWS)
  const [demonstrations, setDemonstrations] = useState(ALIGNMENT_DEFAULTS.demonstrations)
  const [chooseHelpful, setChooseHelpful] = useState(ALIGNMENT_DEFAULTS.chooseHelpful)
  const [learningRate, setLearningRate] = useState(ALIGNMENT_DEFAULTS.learningRate)
  const [steps, setSteps] = useState(ALIGNMENT_DEFAULTS.steps)
  const [helpfulWeight, setHelpfulWeight] = useState(ALIGNMENT_DEFAULTS.helpfulWeight)
  const [seed, setSeed] = useState(ALIGNMENT_DEFAULTS.seed)

  const pool = useMemo(() => buildDemonstrations(demonstrations, seed), [demonstrations, seed])
  const pairs = useMemo(() => buildPreferencePairs(Math.max(4, Math.round(demonstrations / 2)), { chooseHelpful }), [demonstrations, chooseHelpful])

  const run = useMemo(() => runTwoRound(pool, pairs, { steps, learningRate }), [pool, pairs, steps, learningRate])
  const second = useMemo(() => trainSecondRound(run.roundOne, pairs, { steps, learningRate }), [run.roundOne, pairs, steps, learningRate])
  const target = useMemo(() => meanChoice(pairs), [pairs])

  const helpful = useMemo(() => clusterMean(pool, 'helpful'), [pool])
  const safe = useMemo(() => clusterMean(pool, 'harmless'), [pool])

  const sweep = useMemo(() => WEIGHTS.map((weight) => preferredRound(pool, pairs, weight, { steps, learningRate })), [pool, pairs, steps, learningRate])

  // The crossover is the finding, and a sweep only says where it is if you look for the
  // sign change rather than eyeballing two columns.
  const crossover = useMemo(() => {
    const first = sweep.findIndex((entry) => entry.prefers === 'round two')
    return first <= 0 ? null : WEIGHTS[first] ?? null
  }, [sweep])

  const chosen = useMemo(() => preferredRound(pool, pairs, helpfulWeight, { steps, learningRate }), [pool, pairs, helpfulWeight, steps, learningRate])

  const path = second.path.map((policy, step) => ({ x: step, helpfulness: policy.helpfulness, harmlessness: policy.harmlessness }))

  return (
    <div className="lab">
      <Panel
        title="Laboratory B · The two rounds"
        subtitle="Imitation reaches a mean; preference moves toward whatever is chosen"
        accent="violet"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={ALIGNMENT_VIEWS}
          />
          <Slider
            label="The demonstrations"
            value={demonstrations}
            min={10}
            max={120}
            step={10}
            onChange={setDemonstrations}
            hint="Half of them comply and half of them decline, and nothing is in between."
          />
          <Slider
            label="How often the labels pick the helpful answer"
            value={chooseHelpful}
            min={0}
            max={1}
            step={0.05}
            onChange={setChooseHelpful}
            format={(value) => `${(value * 100).toFixed(0)}%`}
            hint="One half is a label that says nothing; one is a label that is certain."
          />
          <Slider
            label="The learning rate"
            value={learningRate}
            min={0.05}
            max={1}
            step={0.05}
            onChange={setLearningRate}
          />
          <Slider label="The steps" value={steps} min={1} max={24} onChange={setSteps} />
          <Slider
            label="The weight on helpfulness"
            value={helpfulWeight}
            min={0}
            max={1}
            step={0.05}
            onChange={setHelpfulWeight}
            format={(value) => `${(value * 100).toFixed(0)}%`}
            hint="The rest of the weight falls on harmlessness. This is the only place the trade-off is decided."
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat
            label="After round one"
            value={`${fmt(run.roundOne.helpfulness, 3)}, ${fmt(run.roundOne.harmlessness, 3)}`}
            hint="helpfulness, harmlessness"
          />
          <Stat
            label="After round two"
            value={`${fmt(run.roundTwo.helpfulness, 3)}, ${fmt(run.roundTwo.harmlessness, 3)}`}
            hint="helpfulness, harmlessness"
            tone="good"
          />
          <Stat label="The movement" value={fmt(run.movement, 4)} hint="how far the preference round travelled" />
          <Stat
            label="The residual"
            value={fmt(second.residual, 4)}
            hint="still short of what the labels ask for"
            tone={second.residual < 0.01 ? 'good' : 'warn'}
          />
        </div>

        {view === 'reach' ? (
          <>
            <Figure
              title="The second round, step by step"
              description="Both coordinates of the policy after every preference step, starting from the imitation point."
              caption="A preference step moves a fraction of the way to whatever the labels choose, so the curve approaches its target geometrically and never arrives unless the labels are certain and the steps are enough."
            >
              <TrendChart
                data={path}
                series={[
                  { key: 'helpfulness', name: 'the helpfulness', colour: 'var(--accent-sky)' },
                  { key: 'harmlessness', name: 'the harmlessness', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the step"
                yLabel="the coordinate"
                height={260}
              />
            </Figure>

            <Figure
              title="The four points that matter"
              description="The two clusters the pool is made of, the mean the first round lands on, and the target the second round is aiming at."
              caption="Round one is an average, so it can only reach the middle of what it was shown. The point both clusters would be better than is not in the pool at all, and a preference signal cannot invent one."
            >
              <DataTable
                caption="The points"
                headers={['The point', 'The helpfulness', 'The harmlessness', 'What it is']}
                rows={[
                  ['the helpful cluster', fmt(helpful.helpfulness, 3), fmt(helpful.harmlessness, 3), 'in the pool'],
                  ['the safe cluster', fmt(safe.helpfulness, 3), fmt(safe.harmlessness, 3), 'in the pool'],
                  ['after round one', fmt(run.roundOne.helpfulness, 3), fmt(run.roundOne.harmlessness, 3), 'the mean of the pool'],
                  ['what the labels choose', fmt(target.helpfulness, 3), fmt(target.harmlessness, 3), 'the target of round two'],
                  ['after round two', fmt(run.roundTwo.helpfulness, 3), fmt(run.roundTwo.harmlessness, 3), `distance to target ${fmt(distance(run.roundTwo, target), 4)}`],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="What the second round can and cannot do">
              It can move the policy along the axis the labels care about, in proportion to how confidently they choose.
              It cannot reach a point that no demonstration supports: at a labeler certain of the helpful answer the
              policy walks toward the helpful cluster, and at an undecided one it does not move at all. The number on
              the card above says which of those two you are looking at.
            </Callout>
          </>
        ) : null}

        {view === 'trade' ? (
          <>
            <Figure
              title="The value of each round, as the weighting moves"
              description="One axis weighted against the other, and the value of the policy after each round."
              caption={
                crossover === null
                  ? 'Over this range one round is always the better of the two, which is worth knowing before anyone argues that the second round is a compromise.'
                  : `The two lines cross at a weight of ${fmt(crossover, 2)} on helpfulness: below it the first round is the better policy, above it the second.`
              }
            >
              <TrendChart
                data={sweep.map((entry) => ({
                  x: Math.round(entry.helpfulWeight * 100),
                  roundOne: entry.roundOne * 100,
                  roundTwo: entry.roundTwo * 100,
                }))}
                series={[
                  { key: 'roundOne', name: 'after round one', colour: 'var(--accent-amber)' },
                  { key: 'roundTwo', name: 'after round two', colour: 'var(--accent-violet)' },
                ]}
                xLabel="the weight on helpfulness, in per cent"
                yLabel="the utility"
                height={260}
              />
            </Figure>

            <Figure
              title="The same sweep as a table"
              description="Each weighting, the utility of each round, and which one the weighting prefers."
              caption="The trade-off is not in the arithmetic. It is in the weight — and the weight is a decision somebody makes before the run, not a result of it."
            >
              <DataTable
                caption="The weighting"
                headers={['The weight on helpfulness', 'The utility of round one', 'The utility of round two', 'Preferred']}
                rows={sweep.map((entry) => [
                  `${fmt(entry.helpfulWeight * 100, 0)}%`,
                  fmt(entry.roundOne, 4),
                  fmt(entry.roundTwo, 4),
                  entry.prefers,
                ])}
              />
            </Figure>

            <Callout tone="warning" title="The weighting is not a finding">
              At the weight on the slider — {fmt(helpfulWeight * 100, 0)} per cent on helpfulness — this run prefers{' '}
              {chosen.prefers}, by {fmt(Math.abs(utility(run.roundTwo, helpfulWeight) - utility(run.roundOne, helpfulWeight)), 4)}.
              Change the weight and the answer changes without anything about the model doing so, which is why a report
              that gives a single utility number should say what weight produced it.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
