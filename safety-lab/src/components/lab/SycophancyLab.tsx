import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  buildSycophancyCases,
  flipRate,
  flipRateWhenChallenged,
  mitigationEffect,
} from '../../core/measures'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { SYCOPHANCY_DEFAULTS } from '../../content/labDefaults'

type View = 'flip' | 'mitigation'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const SYCOPHANCY_VIEWS: { value: View; label: string }[] = [
  { value: 'flip', label: 'The flip rate' },
  { value: 'mitigation', label: 'The mitigation' },
]

export function SycophancyLab() {
  const [view, setView] = useViewParam(SYCOPHANCY_VIEWS)
  const [count, setCount] = useState(SYCOPHANCY_DEFAULTS.cases)
  const [seed, setSeed] = useState(SYCOPHANCY_DEFAULTS.seed)

  const cases = useMemo(() => buildSycophancyCases(count, seed), [count, seed])
  const rate = useMemo(() => flipRate(cases), [cases])
  const challenged = useMemo(() => flipRateWhenChallenged(cases), [cases])
  const effect = useMemo(() => mitigationEffect(cases), [cases])

  const curve = useMemo(() => {
    const rows: { x: number; rate: number; challenged: number }[] = []
    for (const size of [20, 40, 80, 160, 320]) {
      const subset = buildSycophancyCases(size, seed)
      rows.push({ x: size, rate: flipRate(subset) * 100, challenged: flipRateWhenChallenged(subset) * 100 })
    }
    return rows
  }, [seed])

  const examples = useMemo(
    () =>
      cases
        .filter((entry) => entry.neutral === entry.question && entry.underPressure !== entry.question)
        .slice(0, 8)
        .map((entry) => ({
          question: entry.question,
          asserted: entry.asserted,
          neutral: entry.neutral,
          underPressure: entry.underPressure,
          whenChallenged: entry.whenChallenged,
        })),
    [cases],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory F · Sycophancy"
        subtitle="Changing the answer to agree with the person asking"
        accent="amber"
      >
        <div className="lab-controls">
          <SegmentedControl label="View" value={view} onChange={setView} options={SYCOPHANCY_VIEWS} />
          <Slider label="The questions" value={count} min={20} max={600} step={20} onChange={setCount} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="The flip rate" value={`${fmt(rate * 100, 1)}%`} tone="warn" />
          <Stat
            label="With the challenge"
            value={`${fmt(challenged * 100, 1)}%`}
            tone="good"
          />
          <Stat label="The effect of the mitigation" value={`${fmt(effect * 100, 1)} points`} tone="good" />
          <Stat label="The questions" value={String(cases.length)} />
        </div>

        {view === 'flip' ? (
          <>
            <Figure
              title="The flip rate, against the size of the sample"
              description="The fraction of correct answers that become wrong, as the number of questions grows."
              caption="The rate settles as the sample grows, and the sample is what makes it a measurement rather than an impression."
            >
              <TrendChart
                data={curve}
                series={[{ key: 'rate', name: 'the flip rate', colour: 'var(--accent-amber)' }]}
                xLabel="the questions"
                yLabel="in per cent"
                height={250}
              />
            </Figure>

            <Figure
              title="Some of the flips"
              description="Questions the model answers correctly, and answers wrongly once the user pushes."
              caption="The model knew. That is what makes the flip a flip rather than an error."
            >
              <DataTable
                caption="The flips"
                headers={['The correct answer', 'What the user asserted', 'With no pressure', 'Under pressure']}
                rows={examples.map((entry) => [
                  entry.question,
                  entry.asserted,
                  entry.neutral,
                  entry.underPressure,
                ])}
              />
            </Figure>

            <Callout tone="definition" title="Why it happens">
              The training rewarded the answer that made the user happy, and agreement looks like that. Which is good
              news, in a way: a consequence of the training can be changed by the training.
            </Callout>
          </>
        ) : null}

        {view === 'mitigation' ? (
          <>
            <Figure
              title="The two rates"
              description="The flip rate with no mitigation, and with the challenge in the prompt."
              caption="One sentence in the prompt moves the number, and by a measurable amount."
            >
              <TrendChart
                data={curve}
                series={[
                  { key: 'rate', name: 'with no mitigation', colour: 'var(--accent-rose)' },
                  { key: 'challenged', name: 'with the challenge', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the questions"
                yLabel="in per cent"
                height={250}
              />
            </Figure>

            <Figure
              title="The mitigation, on the same questions"
              description="What each of the flipped questions becomes once the user is told they may be wrong."
              caption="The mitigation is a prompt, so it lives wherever the prompt lives — which is not the same as a fix in the training."
            >
              <DataTable
                caption="The mitigation"
                headers={['The correct answer', 'Under pressure', 'With the challenge', 'Recovered?']}
                rows={examples.map((entry) => [
                  entry.question,
                  entry.underPressure,
                  entry.whenChallenged,
                  entry.whenChallenged === entry.question ? 'yes' : 'no',
                ])}
              />
            </Figure>

            <Callout tone="warning" title="A mitigation in the prompt is not a fix">
              Telling the model the user may be wrong works, and it works only while the sentence is there. The place to
              fix sycophancy is the training, and the measurement is how you would know whether you had.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
