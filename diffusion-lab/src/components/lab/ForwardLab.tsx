import { useMemo, useState } from 'react'
import { createRng, fmt } from '@llm-materials/course-core'
import { buildSchedule } from '../../core/schedules'
import type { Schedule } from '../../core/schedules'
import {
  describeForwardMarginal,
  forwardChain,
  posteriorMean,
  posteriorVariance,
  qSample,
  swapNoise,
} from '../../core/forward'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, PointChart, TrendChart } from '@llm-materials/course-ui'

type View = 'chain' | 'closed-form' | 'posterior'

const DATA_POINTS: [number, number][] = [
  [1.6, 0.5],
  [-1.2, 1.1],
  [0.2, -1.7],
  [-0.6, -0.3],
  [1.0, -1.0],
]

const SCHEDULE: Schedule = buildSchedule('linear', 200)
const CHAIN_MARKS_EVERY = 20

export function ForwardLab() {
  const [view, setView] = useState<View>('chain')
  const [t, setT] = useState(40)
  const [seed, setSeed] = useState(7)

  const rng = useMemo(() => createRng(seed), [seed])

  const chain = useMemo(() => forwardChain(DATA_POINTS[0], SCHEDULE, rng), [rng])

  // Every twentieth state of the chain is drawn on the plot, including the first and the last.
  const chainMarks = useMemo(() => chain.filter((_, index) => index % CHAIN_MARKS_EVERY === 0), [chain])

  const marginal = useMemo(
    () => describeForwardMarginal(DATA_POINTS[0], t, SCHEDULE),
    [t],
  )

  const closedForm = useMemo(() => {
    const noiseRng = createRng(seed + 101)
    const samples = Array.from({ length: 600 }, () => {
      const noise = [noiseRng() * 2 - 1, noiseRng() * 2 - 1]
      return qSample(DATA_POINTS[0], t, noise, SCHEDULE)
    })
    return samples
  }, [seed, t])

  const stepByStep = useMemo(() => {
    const noiseRng = createRng(seed + 101)
    const samples = Array.from({ length: 600 }, () => {
      let current = DATA_POINTS[0]
      for (let step = 0; step < t; step++) {
        const noise = [noiseRng() * 2 - 1, noiseRng() * 2 - 1]
        // The one-step transition, resampled from scratch at every step.
        current = [
          Math.sqrt(SCHEDULE.alphas[step]) * current[0] + Math.sqrt(SCHEDULE.betas[step]) * noise[0],
          Math.sqrt(SCHEDULE.alphas[step]) * current[1] + Math.sqrt(SCHEDULE.betas[step]) * noise[1],
        ]
      }
      return current
    })
    return samples
  }, [seed, t])

  const posteriorWeights = useMemo(() => {
    const rows: { x: number; onX0: number; onXT: number }[] = []
    for (let step = 0; step < SCHEDULE.steps; step += 4) {
      const index = step
      const alphaBarPrevious = SCHEDULE.previousAlphaBars[index]
      const alphaBar = SCHEDULE.alphaBars[index]
      const alpha = SCHEDULE.alphas[index]
      const beta = SCHEDULE.betas[index]
      const denominator = 1 - alphaBar
      rows.push({
        x: step,
        onX0: (Math.sqrt(alphaBarPrevious) * beta) / denominator,
        onXT: (Math.sqrt(alpha) * (1 - alphaBarPrevious)) / denominator,
      })
    }
    return rows
  }, [])

  const swapped = useMemo(() => {
    const noiseA = [0.9, -0.4]
    const noiseB = [-0.5, 0.8]
    return swapNoise(DATA_POINTS[0], noiseA, noiseB, t, SCHEDULE)
  }, [t])

  const posteriorAtT = useMemo(() => {
    const xT = qSample(DATA_POINTS[0], t, [0.3, -0.2], SCHEDULE)
    return { xT, mean: posteriorMean(xT, DATA_POINTS[0], t, SCHEDULE) }
  }, [t])

  const closedFormTable = useMemo(
    () =>
      [0, Math.max(0, Math.floor(t / 2)), t].map((timestep) => ({
        timestep,
        ...describeForwardMarginal(DATA_POINTS[0], timestep, SCHEDULE),
      })),
    [t],
  )

  const snrCurve = useMemo(
    () => SCHEDULE.snrs.map((snr, index) => ({ x: index, snr })),
    [],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory A · The forward process"
        subtitle="A fixed chain that turns data into noise, and the closed form that makes it affordable"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'chain', label: 'The chain' },
              { value: 'closed-form', label: 'The closed form' },
              { value: 'posterior', label: 'The posterior' },
            ]}
          />
          <Slider
            label="Timestep t"
            value={t}
            min={0}
            max={SCHEDULE.steps - 1}
            onChange={setT}
            format={(value) => `${value} of ${SCHEDULE.steps - 1}`}
            hint="The number of noise steps applied so far."
          />
          <Slider
            label="Seed"
            value={seed}
            min={1}
            max={50}
            onChange={setSeed}
            hint="The same seed always produces the same chain."
          />
        </div>

        <div className="stat-row">
          <Stat label="ᾱ_t" value={fmt(marginal.alphaBar, 4)} hint="the signal still present" />
          <Stat label="SNR" value={fmt(marginal.snr, 3)} hint="signal against noise" />
          <Stat label="√ᾱ_t" value={fmt(marginal.sqrtAlphaBar, 3)} hint="the scale on x_0" />
          <Stat
            label="√(1−ᾱ_t)"
            value={fmt(marginal.sqrtOneMinusAlphaBar, 3)}
            hint="the scale on the noise"
          />
        </div>

        {view === 'chain' ? (
          <>
            <Figure
              title="The chain, step by step"
              description={`The state of one data point as noise is added, plotted at ${chainMarks.length} steps of the chain. The signal moves towards the origin while the spread grows.`}
              caption="The forward chain for a single data point, at every twentieth step of the chain. The state is the data scaled by √ᾱ_t, plus noise of scale √(1−ᾱ_t)."
            >
              <PointChart
                points={DATA_POINTS.map((point) => ({ x: point[0], y: point[1], group: 'Data' }))}
                series={[
                  { key: 'Data', name: 'The data', colour: 'var(--accent-teal)' },
                  { key: 'Chain', name: 'The chain', colour: 'var(--accent-amber)' },
                ]}
                xLabel="first coordinate"
                yLabel="second coordinate"
                height={340}
                domain={[
                  [-3, 3],
                  [-3, 3],
                ]}
                referencePoints={chainMarks.map((point) => ({ x: point[0], y: point[1] }))}
              />
            </Figure>

            <Callout tone="definition" title="What is happening">
              Each step multiplies the state by √α_t = √(1 − β_t) and adds Gaussian noise of scale √β_t. The total
              variance is kept at one, so the state never grows without bound — it trades signal for noise instead.
            </Callout>
          </>
        ) : null}

        {view === 'closed-form' ? (
          <>
            <Figure
              title="The closed form against the Markov chain"
              description="Six hundred samples of the state at the chosen timestep, drawn two ways: directly from the closed form, and by stepping the chain. The two clouds overlap, which is the point."
              caption="600 samples of x_t drawn two ways. Direct: x_t = √ᾱ_t·x_0 + √(1−ᾱ_t)·ε. Stepped: the one-step transition, applied t times. They are the same distribution, which is what makes training a single network evaluation."
            >
              <PointChart
                points={[
                  ...closedForm.map((point) => ({ x: point[0], y: point[1], group: 'Closed form' })),
                  ...stepByStep.map((point) => ({ x: point[0], y: point[1], group: 'Stepped' })),
                ]}
                series={[
                  { key: 'Closed form', name: 'Closed form', colour: 'var(--accent-teal)' },
                  { key: 'Stepped', name: 'Stepped chain', colour: 'var(--accent-rose)' },
                ]}
                xLabel="first coordinate"
                yLabel="second coordinate"
                height={340}
                domain={[
                  [-3, 3],
                  [-3, 3],
                ]}
              />
            </Figure>

            <div className="stat-row">
              <Stat
                label="Mean of x_t"
                value={`(${fmt(marginal.mean[0], 3)}, ${fmt(marginal.mean[1], 3)})`}
                hint="should be √ᾱ_t · x_0"
              />
              <Stat label="Std of x_t" value={fmt(marginal.std, 3)} hint="should be √(1−ᾱ_t)" />
            </div>

            <Figure
              title="The closed form at three timesteps"
              description="The marginal q(x_t | x_0) written out for the data point, at the start, halfway along the chosen timestep, and at the chosen timestep."
              caption="Each row is the same closed form: the mean is √ᾱ_t times the data point, and the spread is √(1−ᾱ_t) in every dimension. No step of the chain is evaluated to produce any of these numbers."
            >
              <DataTable
                caption="x_t = √ᾱ_t·x_0 + √(1−ᾱ_t)·ε"
                headers={['t', 'ᾱ_t', '√ᾱ_t · x_0', '√(1−ᾱ_t)', 'SNR']}
                rows={closedFormTable.map((row) => [
                  row.timestep,
                  fmt(row.alphaBar, 4),
                  `(${fmt(row.mean[0] ?? 0, 3)}, ${fmt(row.mean[1] ?? 0, 3)})`,
                  fmt(row.std, 4),
                  fmt(row.snr, 3),
                ])}
              />
            </Figure>

            <Callout tone="note" title="Why this matters">
              A diffusion model never unrolls the chain during training. It draws a data point, draws a noise vector,
              draws a timestep, and forms the input in one multiplication. The cost of a training step does not depend
              on T at all.
            </Callout>
          </>
        ) : null}

        {view === 'posterior' ? (
          <>
            <Figure
              title="Where the posterior puts its weight"
              description="The weight the posterior mean puts on x_0 and on x_t, as a function of the timestep. At small t the posterior is almost entirely determined by the data; at large t it is almost entirely determined by the current state."
              caption="The posterior q(x_{t−1} | x_t, x_0) is a combination of x_0 and x_t whose coefficients the forward process decides — they sum to within half a percent of one along the whole chain. The weight on x_0 falls as the noise grows."
            >
              <TrendChart
                data={posteriorWeights}
                series={[
                  { key: 'onX0', name: 'weight on x₀', colour: 'var(--accent-teal)' },
                  { key: 'onXT', name: 'weight on x_t', colour: 'var(--accent-rose)' },
                ]}
                xLabel="timestep t"
                yLabel="weight"
                yDomain={[0, 1]}
                height={280}
              />
            </Figure>

            <DataTable
              caption="The posterior at the chosen timestep"
              headers={['Quantity', 'Value']}
              rows={[
                ['ᾱ_t', fmt(marginal.alphaBar, 6)],
                ['weight on x₀', fmt(posteriorWeights[Math.min(posteriorWeights.length - 1, Math.floor(t / 4))]?.onX0 ?? 0, 4)],
                ['x_t', `(${fmt(posteriorAtT.xT[0], 4)}, ${fmt(posteriorAtT.xT[1], 4)})`],
                ['posterior mean', `(${fmt(posteriorAtT.mean[0], 4)}, ${fmt(posteriorAtT.mean[1], 4)})`],
                ['posterior variance β̃_t', fmt(posteriorVariance(t, SCHEDULE), 6)],
              ]}
            />

            <Callout tone="definition" title="The posterior is the target">
              The reverse process is trained so that its Gaussian matches this posterior. Because both are Gaussian,
              the comparison between them is a closed-form KL divergence rather than a Monte Carlo estimate — and that
              is the property the whole method rests on.
            </Callout>
          </>
        ) : null}

        <Figure
          title="The signal-to-noise ratio along the chain"
          description="The signal-to-noise ratio of the forward process at every timestep. It falls from far above one to far below one."
          caption="SNR(t) = ᾱ_t / (1 − ᾱ_t). Above 1 the state still contains more signal than noise."
        >
          <TrendChart
            data={snrCurve}
            series={[{ key: 'snr', name: 'SNR', colour: 'var(--accent-amber)' }]}
            xLabel="timestep t"
            yLabel="SNR"
            height={220}
            referenceLines={[{ y: 1, label: 'SNR = 1' }]}
          />
        </Figure>

        <Figure
          title="Swapping the noise"
          description="Three noisy versions of the same data point: one with the first noise draw, one with the second, and one with the average of the two. The structure of the data is preserved in all three; the texture differs."
          caption="The noise swap, at the chosen timestep. Nothing here involves a model: the data contributes the structure and the noise contributes the texture, and they can be separated exactly."
        >
          <PointChart
            points={[
              { x: swapped.withA[0], y: swapped.withA[1], group: 'Noise A' },
              { x: swapped.withB[0], y: swapped.withB[1], group: 'Noise B' },
              { x: swapped.hybrid[0], y: swapped.hybrid[1], group: 'Average' },
            ]}
            series={[
              { key: 'Noise A', name: 'Noise A', colour: 'var(--accent-teal)' },
              { key: 'Noise B', name: 'Noise B', colour: 'var(--accent-rose)' },
              { key: 'Average', name: 'Average of the two', colour: 'var(--accent-amber)' },
            ]}
            xLabel="first coordinate"
            yLabel="second coordinate"
            height={300}
            domain={[
              [-3, 3],
              [-3, 3],
            ]}
          />
        </Figure>

        <Callout tone="warning" title="What is and is not being shown">
          This laboratory is exact. The forward process has a closed form, so every point plotted here is the true
          distribution and not an approximation of it. No model is involved anywhere in this screen.
        </Callout>
      </Panel>
    </div>
  )
}
