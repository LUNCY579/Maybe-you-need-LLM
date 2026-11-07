import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildSchedule } from '../../core/schedules'
import {
  EDM_DEFAULTS,
  analyticSample,
  edmLossWeight,
  karrasSigmas,
  preconditioning,
  sigmaSignalToNoise,
  timestepToSigma,
} from '../../core/preconditioning'
import { Callout, DataTable, Figure, Panel, Slider, Stat, TrendChart } from '@llm-materials/course-ui'

const SCHEDULE = buildSchedule('linear', 200)
const TARGET = [1.2, -0.4]
const START = [4, -3]

export function PreconditioningLab() {
  const [sigmaExponent, setSigmaExponent] = useState(0.5)
  const [sigmaData, setSigmaData] = useState(0.5)
  const [steps, setSteps] = useState(32)

  const sigma = 10 ** sigmaExponent
  const config = useMemo(() => ({ ...EDM_DEFAULTS, sigmaData, steps }), [sigmaData, steps])

  const coefficients = useMemo(() => preconditioning(sigma, sigmaData), [sigma, sigmaData])
  const weight = edmLossWeight(sigma, sigmaData)
  const snr = sigmaSignalToNoise(sigma, sigmaData)

  const ladder = useMemo(() => karrasSigmas(config), [config])
  const sample = useMemo(() => analyticSample(START, TARGET, config), [config])

  const ladderRows = useMemo(
    () =>
      ladder
        .map((value, index) => ({ value, index }))
        .filter(({ index }) => index % 4 === 0 || index === ladder.length - 1)
        .map(({ value, index }) => {
          const row = preconditioning(value, sigmaData)
          return [index, fmt(value, 4), fmt(row.cSkip, 4), fmt(row.cOut, 4), fmt(row.cIn, 4), fmt(row.cNoise, 3)]
        }),
    [ladder, sigmaData],
  )

  const sampleRows = useMemo(
    () =>
      sample
        .map((step, index) => ({ step, index }))
        .filter(({ index }) => index % 4 === 0 || index === sample.length - 1)
        .map(({ step }) => [
          step.step,
          fmt(step.sigma, 4),
          fmt(step.x[0] ?? 0, 4),
          fmt(step.x[1] ?? 0, 4),
          fmt(step.distance, 4),
        ]),
    [sample],
  )

  const clockRows = useMemo(() => {
    const rows: (string | number)[][] = []
    for (let t = 0; t < SCHEDULE.steps; t += 20) {
      const value = timestepToSigma(t, SCHEDULE, sigmaData)
      rows.push([
        t,
        fmt(t / (SCHEDULE.steps - 1), 3),
        fmt(value, 4),
        fmt(value / sigmaData, 4),
        fmt(Math.log(value) / 4, 3),
      ])
    }
    return rows
  }, [sigmaData])

  const distanceCurve = useMemo(
    () => sample.map((step) => ({ x: step.step, distance: step.distance })),
    [sample],
  )

  const first = sample[0]!
  const last = sample[sample.length - 1]!

  return (
    <div className="lab">
      <Panel
        title="Laboratory G · Preconditioning"
        subtitle="The σ parametrisation, the four coefficients, and the two clocks a diffusion model can run on"
        accent="sky"
      >
        <div className="lab-controls">
          <Slider
            label="Noise level"
            value={sigmaExponent}
            min={-3}
            max={2}
            step={0.1}
            onChange={setSigmaExponent}
            format={(value) => `σ = ${(10 ** value).toFixed(3)}`}
            hint="The clock Karras et al. use instead of the timestep."
          />
          <Slider
            label="Data standard deviation"
            value={sigmaData}
            min={0.1}
            max={2}
            step={0.1}
            onChange={setSigmaData}
            format={(value) => value.toFixed(1)}
          />
          <Slider label="Sampler steps" value={steps} min={8} max={64} step={4} onChange={setSteps} />
        </div>

        <div className="stat-row">
          <Stat label="c_skip" value={fmt(coefficients.cSkip, 4)} hint="the weight on the clean input" />
          <Stat label="c_out" value={fmt(coefficients.cOut, 4)} hint="the scale on the network's output" />
          <Stat label="c_in" value={fmt(coefficients.cIn, 4)} hint="the scale on the network's input" />
          <Stat label="c_noise" value={fmt(coefficients.cNoise, 3)} hint="ln σ / 4, what the network is told" />
        </div>

        <DataTable
          caption={`The coefficients at σ = ${fmt(sigma, 3)}`}
          headers={['Quantity', 'Value', 'Why it is there']}
          rows={[
            ['c_skip', fmt(coefficients.cSkip, 6), 'keeps the clean input in the denoiser at low noise'],
            ['c_out', fmt(coefficients.cOut, 6), 'keeps the network output O(1) against the skip'],
            ['c_in', fmt(coefficients.cIn, 6), 'normalises the input to unit variance'],
            ['c_noise', fmt(coefficients.cNoise, 6), 'the noise level, compressed logarithmically'],
            ['the loss weight λ(σ)', fmt(weight, 6), 'weights the error by 1/σ² in effect'],
            ['the signal-to-noise ratio', fmt(snr, 6), 'σ_data² / σ²'],
            ['σ / σ_data', fmt(sigma / sigmaData, 6), 'the normalised noise level'],
          ]}
        />

        <Figure
          title="The noise ladder, largest σ first"
          description="The Karras sampler's noise levels and the preconditioning coefficients at each one."
          caption="The ladder is geometric in σ^(1/ρ), so the steps are dense near the clean end. At large σ the skip weight vanishes and the network does all the work; at small σ the skip carries the input almost unchanged and the network makes a small correction."
        >
          <DataTable
            caption="σ_i and the coefficients"
            headers={['i', 'σ', 'c_skip', 'c_out', 'c_in', 'c_noise']}
            rows={ladderRows}
          />
        </Figure>

        <Figure
          title="A preconditioned sampler on a model with a known answer"
          description="Euler steps of the probability-flow ODE for data concentrated at a point, from the noisiest level to the cleanest."
          caption="The toy model's optimal denoiser is the target itself, so any error left at the end is the sampler's. Each step multiplies the distance to the target by σ_next / σ, so the final ratio is exactly σ_min / σ_max."
        >
          <div className="stat-row">
            <Stat label="The distance at σ_max" value={fmt(first.distance, 3)} hint="the start" />
            <Stat label="The distance at σ_min" value={fmt(last.distance, 4)} hint="the end of the schedule" />
            <Stat
              label="The contraction"
              value={`${fmt(first.distance / Math.max(1e-12, last.distance), 1)}×`}
              hint={`σ_max / σ_min is ${fmt(config.sigmaMax / config.sigmaMin, 0)}×`}
            />
            <Stat
              label="The Euler steps"
              value={String(sample.length - 1)}
              hint={`one fewer than the ${config.steps} noise levels the schedule visits`}
            />
          </div>
          <TrendChart
            data={distanceCurve}
            series={[{ key: 'distance', name: 'the distance to the target', colour: 'var(--accent-sky)' }]}
            xLabel="the step"
            yLabel="the distance"
            height={260}
          />
          <DataTable
            caption="The sampler's state"
            headers={['Step', 'σ', 'x (first)', 'x (second)', 'Distance']}
            rows={sampleRows}
          />
        </Figure>

        <Figure
          title="The same model on two clocks"
          description="The DDPM timestep and the noise level it corresponds to, with the network's time input."
          caption="The DDPM parametrisation fixes a schedule of ᾱ_t and calls t the clock; the Karras parametrisation calls σ the clock and feeds the network ln σ / 4. The two are a reparametrisation of the same process: at this schedule the DDPM clock covers a much narrower range of noise levels than the EDM ladder."
        >
          <DataTable
            caption="The timestep and its noise level"
            headers={['t', 't / T', 'σ_t', 'σ_t / σ_data', 'c_noise']}
            rows={clockRows}
          />
        </Figure>

        <Callout tone="definition" title="What the four coefficients do">
          c_in makes the network's input have unit variance at every noise level; c_skip carries the clean input past
          the network at low noise; c_out scales the correction so the denoiser stays the size of the data; and c_noise
          is the compressed clock. Together they mean one network can be trained on σ = 0.002 and on σ = 80 without its
          activations running to either zero or infinity.
        </Callout>

        <Callout tone="warning" title="The model here is analytic, on purpose">
          The data is concentrated at a single point, so the optimal denoiser is known exactly and the sampler's error
          can be measured rather than estimated. A trained network would add model error on top, which is the subject of
          the reverse-process laboratory. What is being checked here is the algebra of the preconditioning and the
          arithmetic of the schedule.
        </Callout>
      </Panel>
    </div>
  )
}
