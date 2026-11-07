import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  buildMixture,
  classPosterior,
  guidedScore,
  measureGuidance,
  mixtureScore,
} from '../../core/guidance'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, PointChart, TrendChart } from '@llm-materials/course-ui'

const MEANS = [
  [-2.2, 0],
  [2.2, 0],
  [0, 2.2],
  [0, -2.2],
]

const SWEEP_WEIGHTS = [0, 0.5, 1, 2, 3, 5, 8]

// One measurement setting for the whole screen: the sweep and the chosen weight have to be the
// same run, or the table and the stats above it would be two different experiments.
const MEASUREMENT = { samples: 60, stepSize: 0.04, steps: 150, seed: 77 }

export function GuidanceLab() {
  const [view, setView] = useState<'sweep' | 'tradeoff'>('sweep')
  const [weight, setWeight] = useState(2)
  const [condition, setCondition] = useState(0)

  const mixture = useMemo(() => buildMixture(MEANS, 0.55), [])

  const weights = useMemo(
    () => [...new Set([...SWEEP_WEIGHTS, weight])].sort((a, b) => a - b),
    [weight],
  )

  const measurements = useMemo(
    () => weights.map((w) => ({ w, ...measureGuidance(mixture, condition, w, MEASUREMENT) })),
    [mixture, condition, weights],
  )

  const sweep = useMemo(
    () =>
      measurements.map((measurement) => ({
        x: measurement.w,
        fidelity: measurement.fidelity,
        diversity: measurement.diversity,
        accuracy: measurement.classAccuracy,
      })),
    [measurements],
  )

  const current = measurements[weights.indexOf(weight)]!

  const scoreField = useMemo(() => {
    const points: { x: number; y: number; group: string }[] = []
    for (let i = -9; i <= 9; i++) {
      for (let j = -9; j <= 9; j++) {
        const x = i * 0.35
        const y = j * 0.35
        const score = guidedScore([x, y], condition, weight, mixture)
        const magnitude = Math.hypot(score[0], score[1])
        points.push({ x, y, group: magnitude > 0.35 ? 'Strong' : 'Weak' })
      }
    }
    return points
  }, [mixture, condition, weight])

  const posteriors = useMemo(
    () =>
      MEANS.map((mean, index) => ({
        index,
        mean,
        posterior: classPosterior(mean, mixture),
      })),
    [mixture],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory E · Guidance"
        subtitle="An exact score, a sweep of the guidance weight, and the trade-off it buys"
        accent="rose"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'sweep', label: 'The sweep' },
              { value: 'tradeoff', label: 'The trade-off' },
            ]}
          />
          <Slider
            label="Guidance weight w"
            value={weight}
            min={0}
            max={8}
            step={0.5}
            onChange={setWeight}
            format={(value) => value.toFixed(1)}
            hint="0 is unconditional, 1 is exactly conditional."
          />
          <div className="field">
            <span className="field-label">The condition</span>
            <div className="segmented" role="group" aria-label="The condition">
              {MEANS.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={index === condition ? 'segment segment-active' : 'segment'}
                  aria-pressed={index === condition}
                  onClick={() => setCondition(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <p className="field-hint">The condition asks for the mode at this position.</p>
          </div>
        </div>

        <div className="stat-row">
          <Stat label="Fidelity" value={fmt(current.fidelity, 3)} hint="mean distance to the requested mode" />
          <Stat label="Diversity" value={fmt(current.diversity, 3)} hint="mean distance between samples" />
          <Stat
            label="Class accuracy"
            value={`${fmt(current.classAccuracy * 100, 1)}%`}
            hint="how often the requested mode wins"
            tone={current.classAccuracy > 0.9 ? 'good' : 'warn'}
          />
          <Stat label="Guidance weight" value={weight.toFixed(1)} hint="the parameter being swept" />
        </div>

        {view === 'sweep' ? (
          <>
            <Figure
              title="The guided score field"
              description="The magnitude of the guided score at every point of a grid, for the chosen guidance weight, with the four modes marked."
              caption="The guided score, s_uncond + w(s_cond − s_uncond), on a grid. The guided score points away from the requested mode when the point is far from it, and towards it when it is close — and the sharper the weight, the tighter that turn."
            >
              <PointChart
                points={scoreField}
                series={[
                  { key: 'Weak', name: 'Weak score', colour: 'var(--border-strong)' },
                  { key: 'Strong', name: 'Strong score', colour: 'var(--accent-rose)' },
                ]}
                xLabel="first coordinate"
                yLabel="second coordinate"
                height={340}
                domain={[
                  [-3.2, 3.2],
                  [-3.2, 3.2],
                ]}
                referencePoints={MEANS.map((mean) => ({ x: mean[0], y: mean[1] }))}
              />
            </Figure>

            <Figure
              title="Samples at the chosen weight"
              description="Sixty samples drawn with Langevin dynamics at a fixed step size under the guided score, with the four modes of the mixture marked."
              caption="Samples from the guided model. They are not drawn from the mixture any more: they are drawn from the mixture tilted by p(c|x)^w."
            >
              <PointChart
                points={current.samples.map((sample) => ({ x: sample[0], y: sample[1] }))}
                series={[{ key: 'Samples', name: 'Samples', colour: 'var(--accent-rose)' }]}
                xLabel="first coordinate"
                yLabel="second coordinate"
                height={340}
                domain={[
                  [-3.5, 3.5],
                  [-3.5, 3.5],
                ]}
                referencePoints={MEANS.map((mean) => ({ x: mean[0], y: mean[1] }))}
              />
            </Figure>

            <Callout tone="note" title="Nothing here is simulated">
              The score of a Gaussian mixture is known in closed form, so the guided score is exact, and the sampler is
              a genuine Langevin sampler. There is no network and no approximation in this laboratory.
            </Callout>
          </>
        ) : null}

        {view === 'tradeoff' ? (
          <>
            <Figure
              title="Fidelity against the guidance weight"
              description="The mean distance from a sample to the mode it was asked for, and the mean distance between two samples of the same class, against the guidance weight."
              caption="Fidelity and diversity against the guidance weight. Both fall as w rises: the samples get closer to the mode they were asked for and closer to each other. The second half of that sentence is the price."
            >
              <TrendChart
                data={sweep}
                series={[
                  { key: 'fidelity', name: 'Fidelity (distance to the mode)', colour: 'var(--accent-teal)' },
                  { key: 'diversity', name: 'Diversity (distance between samples)', colour: 'var(--accent-rose)' },
                ]}
                xLabel="guidance weight w"
                yLabel="distance"
                height={300}
              />
            </Figure>

            <DataTable
              caption="The trade-off, measured — the starred row is the weight on the slider"
              headers={['w', 'Fidelity', 'Diversity', 'Class accuracy']}
              rows={sweep.map((row) => [
                row.x === weight ? `${row.x.toFixed(1)} ✱` : row.x.toFixed(1),
                fmt(row.fidelity, 4),
                fmt(row.diversity, 4),
                `${fmt(row.accuracy * 100, 1)}%`,
              ])}
            />

            <Callout tone="definition" title="What the guided model samples">
              A guided model samples from p(x)·p(c|x)^w, normalised — the training distribution tilted towards the
              region the condition favours. The tilt is why the fidelity improves and the diversity does not: the
              tilted distribution simply has less mass everywhere else.
            </Callout>

            <Callout tone="warning" title="The limit of this laboratory">
              A Gaussian mixture has four well-separated modes, so the trade-off appears cleanly. On a real dataset
              with a continuous manifold, the same effect appears as a loss of fine detail and of coverage rather than
              as visible mode collapse.
            </Callout>
          </>
        ) : null}

        <DataTable
          caption="The class posterior at each mode"
          headers={['Mode', 'Position', 'Posterior of the requested class']}
          rows={posteriors.map((entry) => [
            entry.index + 1,
            `(${fmt(entry.mean[0], 1)}, ${fmt(entry.mean[1], 1)})`,
            fmt(entry.posterior[condition], 4),
          ])}
        />

        <Figure
          title="The unconditional score, for comparison"
          description="The magnitude of the unconditional score over the same grid, for reference."
          caption="The unconditional score of the same mixture. It has no idea which mode was requested — that information enters only through the guidance term."
        >
          <PointChart
            points={(() => {
              const points: { x: number; y: number; group: string }[] = []
              for (let i = -9; i <= 9; i++) {
                for (let j = -9; j <= 9; j++) {
                  const x = i * 0.35
                  const y = j * 0.35
                  const score = mixtureScore([x, y], mixture)
                  const magnitude = Math.hypot(score[0], score[1])
                  points.push({ x, y, group: magnitude > 0.35 ? 'Strong' : 'Weak' })
                }
              }
              return points
            })()}
            series={[
              { key: 'Weak', name: 'Weak score', colour: 'var(--border-strong)' },
              { key: 'Strong', name: 'Strong score', colour: 'var(--accent-teal)' },
            ]}
            xLabel="first coordinate"
            yLabel="second coordinate"
            height={300}
            domain={[
              [-3.2, 3.2],
              [-3.2, 3.2],
            ]}
            referencePoints={MEANS.map((mean) => ({ x: mean[0], y: mean[1] }))}
          />
        </Figure>
      </Panel>
    </div>
  )
}
