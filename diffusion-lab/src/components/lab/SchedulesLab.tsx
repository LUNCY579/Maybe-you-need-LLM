import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildSchedule, effectiveDiffusionLength, terminalKLDivergence } from '../../core/schedules'
import type { ScheduleName } from '../../core/schedules'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

export function SchedulesLab() {
  const [name, setName] = useState<ScheduleName>('linear')
  const [steps, setSteps] = useState(1000)

  const schedule = useMemo(() => buildSchedule(name, steps), [name, steps])
  const linear = useMemo(() => buildSchedule('linear', steps), [steps])
  const cosine = useMemo(() => buildSchedule('cosine', steps), [steps])

  const curve = useMemo(
    () =>
      schedule.alphaBars.map((_, index) => ({
        x: index,
        linear: linear.alphaBars[index],
        cosine: cosine.alphaBars[index],
      })),
    [schedule, linear, cosine],
  )

  const snrCurve = useMemo(
    () =>
      schedule.snrs.map((_, index) => ({
        x: index,
        linear: linear.snrs[index],
        cosine: cosine.snrs[index],
      })),
    [schedule, linear, cosine],
  )

  const terminalBits = terminalKLDivergence(schedule) / Math.log(2)

  return (
    <div className="lab">
      <Panel
        title="Laboratory C · Noise schedules"
        subtitle="The one set of choices in the model that nobody learns"
        accent="amber"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="Schedule"
            value={name}
            onChange={setName}
            options={[
              { value: 'linear', label: 'Linear (the paper)' },
              { value: 'cosine', label: 'Cosine' },
            ]}
          />
          <Slider
            label="Number of steps T"
            value={steps}
            min={100}
            max={2000}
            step={50}
            onChange={setSteps}
            format={(value) => String(value)}
            hint="The paper uses 1000."
          />
        </div>

        <div className="stat-row">
          <Stat label="β₁" value={fmt(schedule.betas[0], 6)} hint="the first noise variance" />
          <Stat label="β_T" value={fmt(schedule.betas[schedule.steps - 1], 6)} hint="the last noise variance" />
          <Stat
            label="Terminal KL"
            value={`${fmt(terminalBits, 8)} bits`}
            hint="how far x_T is from the prior"
            tone={terminalBits < 1e-3 ? 'good' : 'warn'}
          />
          <Stat
            label="Effective length"
            value={String(effectiveDiffusionLength(schedule))}
            hint="the step where ᾱ falls below 0.5"
          />
        </div>

        <Figure
          title="The cumulative signal ᾱ_t"
          description="For both schedules, the fraction of the original signal still present at each timestep, on a logarithmic scale."
          caption="ᾱ_t against t. The paper's linear schedule spends its early steps with almost all the signal intact; the cosine schedule destroys the signal faster at the start and keeps it longer through the middle."
        >
          <TrendChart
            data={curve}
            series={[
              { key: 'linear', name: 'Linear', colour: 'var(--accent-teal)' },
              { key: 'cosine', name: 'Cosine', colour: 'var(--accent-rose)' },
            ]}
            xLabel="timestep t"
            yLabel="ᾱ_t (log scale)"
            height={280}
          />
        </Figure>

        <Figure
          title="The signal-to-noise ratio"
          description="For both schedules, the signal-to-noise ratio at each timestep, on a logarithmic scale, with a reference line at one."
          caption="SNR(t) on a log scale. The point where it crosses one is where the state stops being mostly signal."
        >
          <TrendChart
            data={snrCurve}
            series={[
              { key: 'linear', name: 'Linear', colour: 'var(--accent-teal)' },
              { key: 'cosine', name: 'Cosine', colour: 'var(--accent-rose)' },
            ]}
            xLabel="timestep t"
            yLabel="SNR (log scale)"
            height={280}
            referenceLines={[{ y: 1, label: 'SNR = 1' }]}
          />
        </Figure>

        <DataTable
          caption="The two schedules, sampled at a few points"
          headers={['t', 'ᾱ (linear)', 'ᾱ (cosine)', 'SNR (linear)', 'SNR (cosine)']}
          rows={[0.1, 0.25, 0.5, 0.75, 0.9].map((fraction) => {
            const index = Math.min(schedule.steps - 1, Math.floor(fraction * schedule.steps))
            return [
              index,
              fmt(linear.alphaBars[index], 5),
              fmt(cosine.alphaBars[index], 5),
              fmt(linear.snrs[index], 4),
              fmt(cosine.snrs[index], 4),
            ]
          })}
        />

        <Callout tone="note" title="What the schedule decides">
          The schedule sets ᾱ at every step, and therefore three things at once: how fast the signal disappears, how
          large the terminal divergence from the prior is, and how the training objective ends up weighting the
          different noise levels. Change the number of steps and all three move.
        </Callout>

        <Callout tone="warning" title="A note on the comparison">
          The linear schedule here uses the paper’s fixed β range of 1e-4 to 0.02. At small T that range is spread
          over few steps and the schedule is therefore much more aggressive than it is at T = 1000. The comparison is
          only meaningful at the paper’s step count, which is why the default here is 1000.
        </Callout>
      </Panel>
    </div>
  )
}
