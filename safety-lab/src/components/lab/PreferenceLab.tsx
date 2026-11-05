import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  buildQuestions,
  consistencySweep,
  effectiveLooks,
  expectedMajorityRate,
  expectedRepeatAgreement,
  interLabelerAgreement,
  leanSweep,
  lookCorrelation,
  majorityProbability,
  readReward,
  repeatAgreementCurve,
  labelQuestion,
  trainPolicy,
  type Labeler,
} from '../../core/preference'
import { Callout, DataTable, Figure, Panel, SegmentedControl, Slider, Stat, TrendChart } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'
import { PREFERENCE_DEFAULTS } from '../../content/labDefaults'

type View = 'repeat' | 'majority' | 'panel'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const PREFERENCE_VIEWS: { value: View; label: string }[] = [
  { value: 'repeat', label: 'What the agreement number measures' },
  { value: 'majority', label: 'What the reward model picks' },
  { value: 'panel', label: 'How many opinions a panel is worth' },
]

const CONSISTENCIES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
const LEANS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]

export function PreferenceLab() {
  const [view, setView] = useViewParam(PREFERENCE_VIEWS)
  const [looks, setLooks] = useState(PREFERENCE_DEFAULTS.looks)
  const [lean, setLean] = useState(PREFERENCE_DEFAULTS.lean)
  const [consistency, setConsistency] = useState(PREFERENCE_DEFAULTS.consistency)
  const [userRightRate, setUserRightRate] = useState(PREFERENCE_DEFAULTS.userRightRate)
  const [questions, setQuestions] = useState(PREFERENCE_DEFAULTS.questions)
  const [seed, setSeed] = useState(PREFERENCE_DEFAULTS.seed)

  const labeler = useMemo<Labeler>(
    () => ({ id: 'labeler', agreeRate: lean, consistency, looks }),
    [lean, consistency, looks],
  )
  const set = useMemo(() => buildQuestions(questions, { userRightRate, seed }), [questions, userRightRate, seed])

  const outcome = useMemo(() => trainPolicy(labeler, set, { seed }), [labeler, set, seed])
  const sweep = useMemo(() => consistencySweep({ agreeRate: lean, looks }, CONSISTENCIES, set, { seed }), [lean, looks, set, seed])
  const byLean = useMemo(() => leanSweep({ consistency, looks }, LEANS, set, { seed }), [consistency, looks, set, seed])
  const agreementCurve = useMemo(() => repeatAgreementCurve(labeler, CONSISTENCIES), [labeler])

  // The same labeler twice is a different question from two labelers once, and the two
  // numbers only agree with each other at a consistency of zero.
  const across = useMemo(() => {
    const other = { ...labeler, id: 'second labeler' }
    return {
      zero: interLabelerAgreement({ ...labeler, consistency: 0, id: 'first' }, { ...other, consistency: 0 }),
      current: interLabelerAgreement({ ...labeler, id: 'first' }, other),
      perfect: interLabelerAgreement({ ...labeler, consistency: 1, id: 'first' }, { ...other, consistency: 1 }),
    }
  }, [labeler])

  // One labeler, one pair, looked at twice: the count behind the agreement rate.
  const sampledAgreement = useMemo(() => {
    let pairs = 0
    let agreed = 0
    for (let index = 0; index < set.length; index++) {
      const labels = labelQuestion(labeler, seed + index * 101)
      for (let first = 0; first < labels.choices.length; first++) {
        for (let second = first + 1; second < labels.choices.length; second++) {
          pairs++
          if (labels.choices[first] === labels.choices[second]) agreed++
        }
      }
    }
    return pairs === 0 ? 0 : agreed / pairs
  }, [labeler, set, seed])

  const jury = useMemo(
    () => Array.from({ length: 7 }, (_, index) => index * 2 + 1).map((size) => ({ size, scattered: majorityProbability(lean, size), faithful: lean })),
    [lean],
  )

  const certain = readReward(labelQuestion({ ...labeler, consistency: 1 }, seed))

  return (
    <div className="lab">
      <Panel
        title="Laboratory E · The consistent labeler"
        subtitle="Two properties of a person that a preference number usually conflates"
        accent="sky"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={PREFERENCE_VIEWS}
          />
          <Slider
            label="The looks per question"
            value={looks}
            min={1}
            max={9}
            onChange={setLooks}
            hint="The same pair, shown again. A real panel of different people would behave like a consistency of zero."
          />
          <Slider
            label="The lean toward agreeing with the user"
            value={lean}
            min={0}
            max={1}
            step={0.05}
            onChange={setLean}
            format={(value) => `${(value * 100).toFixed(0)}%`}
            hint="What the labeler would say if asked twice, perfectly consistent or not."
          />
          <Slider
            label="The consistency"
            value={consistency}
            min={0}
            max={1}
            step={0.05}
            onChange={setConsistency}
            format={(value) => `${(value * 100).toFixed(0)}%`}
            hint="The chance a look reports that lean rather than drawing afresh from it."
          />
          <Slider
            label="How often the user’s belief is right"
            value={userRightRate}
            min={0}
            max={1}
            step={0.05}
            onChange={setUserRightRate}
            format={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Slider label="The questions" value={questions} min={20} max={300} step={20} onChange={setQuestions} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat
            label="Two looks agree"
            value={`${fmt(expectedRepeatAgreement(labeler) * 100, 1)}%`}
            hint={`the same pair, asked again (${fmt(sampledAgreement * 100, 1)}% sampled)`}
          />
          <Stat
            label="The reward model picks agreeing"
            value={`${fmt(expectedMajorityRate(labeler) * 100, 1)}%`}
            hint={`against a lean of ${fmt(lean * 100, 0)}%`}
            tone={expectedMajorityRate(labeler) > lean ? 'warn' : 'good'}
          />
          <Stat
            label="The panel is worth"
            value={`${fmt(effectiveLooks(labeler), 2)} looks`}
            hint={`of the ${looks} it was counted as`}
            tone={effectiveLooks(labeler) < looks ? 'warn' : 'default'}
          />
          <Stat
            label="The policy agrees with the user"
            value={`${fmt(outcome.sycophancyRate * 100, 1)}%`}
            hint={`and is right ${fmt(outcome.accuracy * 100, 1)}% of the time`}
            tone="warn"
          />
        </div>

        {view === 'repeat' ? (
          <>
            <Figure
              title="The repeat-agreement rate as consistency walks"
              description="Two looks at the same pair from the same person, computed exactly, with the sampled count over the questions beside it."
              caption="At a consistency of one every look is the same look repeated and the rate is one hundred per cent — which is the worst possible outcome for a number that was meant to be evidence of care."
            >
              <TrendChart
                data={agreementCurve.map((row) => ({
                  x: Math.round(row.consistency * 100),
                  expected: row.expected * 100,
                  sampled: sampledAgreement * 100,
                }))}
                series={[
                  { key: 'expected', name: 'two looks of one labeler', colour: 'var(--accent-sky)' },
                  { key: 'sampled', name: 'the same, counted over the questions', colour: 'var(--accent-amber)' },
                ]}
                xLabel="the consistency, in per cent"
                yLabel="the agreement, in per cent"
                height={260}
              />
            </Figure>

            <Figure
              title="Two kinds of agreement that are not the same number"
              description="Looks from one labeler against looks from two, at three consistencies."
              caption="Agreement across people contains no consistency term at all — it measures the lean the two of them share. Only agreement across looks measures consistency, and a report that quotes one number usually means neither."
            >
              <DataTable
                caption="The two agreements"
                headers={['The consistency', 'Two looks, one labeler', 'One look each, two labelers', 'What that second number contains']}
                rows={[
                  [
                    'zero',
                    `${fmt(expectedRepeatAgreement({ ...labeler, consistency: 0 }) * 100, 1)}%`,
                    `${fmt(across.zero.expected * 100, 1)}%`,
                    'the shared lean only',
                  ],
                  [
                    'the one on the slider',
                    `${fmt(expectedRepeatAgreement(labeler) * 100, 1)}%`,
                    `${fmt(across.current.observed * 100, 1)}%`,
                    'the shared lean only',
                  ],
                  [
                    'one',
                    `${fmt(expectedRepeatAgreement({ ...labeler, consistency: 1 }) * 100, 1)}%`,
                    `${fmt(across.perfect.expected * 100, 1)}%`,
                    'the shared lean only',
                  ],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="Why the distinction is worth a screen">
              Two labelers draw their own latent side, so however consistent each of them is, their looks are
              independent of each other — the expected agreement is a·b + (1−a)(1−b) and has no third term. A team
              that raises its agreement number by re-showing the same person the same pair is buying a measurement of
              nothing.
            </Callout>
          </>
        ) : null}

        {view === 'majority' ? (
          <>
            <Figure
              title="What the reward model hands the policy, as consistency walks"
              description="The lean is held still. The sampled rate at which the majority of looks picks the agreeing answer, against the exact mixture of binomial tails."
              caption="The curve moves toward the lean rather than past it. Independent looks are a jury, and a jury of a biased coin is more biased than the coin; perfect consistency removes that amplification and leaves the lean exactly as it was."
            >
              <TrendChart
                data={sweep.map((row) => ({
                  x: Math.round(row.consistency * 100),
                  sampled: row.sycophancyRate * 100,
                  expected: row.expectedSycophancy * 100,
                  accuracy: row.accuracy * 100,
                }))}
                series={[
                  { key: 'expected', name: 'what the arithmetic says', colour: 'var(--accent-sky)' },
                  { key: 'sampled', name: 'what the labels did', colour: 'var(--accent-rose)' },
                  { key: 'accuracy', name: 'and how often that was right', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the consistency, in per cent"
                yLabel="the rate, in per cent"
                height={270}
              />
            </Figure>

            <Figure
              title="The same walk done on the lean instead"
              description="Consistency held still, the lean walked from always dissenting to always agreeing."
              caption="This is the axis that actually decides the outcome. Nothing about consistency moves a policy this far."
            >
              <DataTable
                caption="The lean"
                headers={['The lean', 'The reward model picks agreeing', 'The policy agreed with the user', 'And was right']}
                rows={byLean.map((row) => [
                  `${fmt(row.agreeRate * 100, 0)}%`,
                  `${fmt(row.expectedSycophancy * 100, 1)}%`,
                  `${fmt(row.sycophancyRate * 100, 1)}%`,
                  `${fmt(row.accuracy * 100, 1)}%`,
                ])}
              />
            </Figure>

            <Figure
              title="How much of the difference is the jury"
              description="The probability that a strict majority of independent looks picks the agreeing side, at every odd panel size."
              caption="Scattered looks are a jury, so the amplification at the left-hand end of the curve above is the same term that makes a majority of three better than one coin. Consistency takes it away — which is fidelity, not weakness."
            >
              <DataTable
                caption="The jury"
                headers={['The independent looks', `A majority picks agreeing at a lean of ${fmt(lean * 100, 0)}%`, 'A consistent labeler of any size']}
                rows={jury.map((row) => [row.size, `${fmt(row.scattered * 100, 1)}%`, `${fmt(row.faithful * 100, 1)}%`])}
              />
            </Figure>

            <Callout tone="warning" title="The reported metric and the outcome move apart">
              Walking consistency from zero to one takes the repeat-agreement rate up to {fmt(100, 0)} per cent while
              the sycophancy the policy learns moves from {fmt(sweep[0]!.expectedSycophancy * 100, 1)} per cent to{' '}
              {fmt(sweep[sweep.length - 1]!.expectedSycophancy * 100, 1)} per cent. A team reading only the first number
              would report improvement while the second one got worse.
            </Callout>
          </>
        ) : null}

        {view === 'panel' ? (
          <>
            <Figure
              title="How many independent opinions the panel is actually worth"
              description="The design effect on the looks this labeler is asked for, at every consistency."
              caption="Three looks from a perfectly consistent person are one look said three times. Any statistic that counts them as three is over-confident by construction, and this is the curve that says by how much."
            >
              <TrendChart
                data={CONSISTENCIES.map((value) => ({
                  x: Math.round(value * 100),
                  effective: effectiveLooks({ ...labeler, consistency: value }),
                  counted: looks,
                }))}
                series={[
                  { key: 'effective', name: 'the looks it is worth', colour: 'var(--accent-sky)' },
                  { key: 'counted', name: 'the looks it was counted as', colour: 'var(--accent-rose)' },
                ]}
                xLabel="the consistency, in per cent"
                yLabel="the independent opinions"
                height={260}
              />
            </Figure>

            <Figure
              title="The panel, at the setting on the slider"
              description="The correlation between two of its looks and what the whole set is worth."
              caption="The correlation is consistency squared and nothing else — not the lean, not the number of looks. That is why asking more people is the only way to buy information a panel of one cannot supply."
            >
              <DataTable
                caption="The panel"
                headers={['The quantity', 'The value']}
                rows={[
                  ['the looks asked for', looks],
                  ['the correlation between two of them', fmt(lookCorrelation(labeler), 4)],
                  ['the independent opinions that is worth', fmt(effectiveLooks(labeler), 3)],
                  ['the confidence the reward model reports', fmt(outcome.meanConfidence, 3)],
                  ['the reward it collected', fmt(outcome.meanReward, 3)],
                  ['the side a certain labeler would pick', certain.prefers],
                ]}
              />
            </Figure>

            <Callout tone="note" title="What to do with the number">
              If the panel is worth {fmt(effectiveLooks(labeler), 2)} looks and the budget is fixed, the difference
              between asking {looks} more people and asking one person {looks} times is the difference between
              information and a transcript. The correlation is not a detail of the labelling guide; it is the reason
              the label count is not the sample size.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
