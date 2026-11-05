import { useMemo, useState } from 'react'
import { createRng, fmt, l2Distance } from '@llm-materials/course-core'
import { buildSchedule } from '../../core/schedules'
import { qSample } from '../../core/forward'
import { ancestralStep, ddimStep, reverseMean, sample, toEpsilon, toX0 } from '../../core/reverse'
import type { Parameterisation, ReverseConfig } from '../../core/reverse'
import { ringMixture, trainDenoiser } from '../../core/denoiser'
import type { TrainingResult } from '../../core/denoiser'
import { Button, Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, PointChart, TrendChart } from '@llm-materials/course-ui'

type View = 'sampling' | 'parameterisations'

const SCHEDULE = buildSchedule('linear', 200)
const DIMENSION = 2

export function ReverseLab() {
  const [view, setView] = useState<View>('sampling')
  const [model, setModel] = useState<TrainingResult | null>(null)
  const [isTraining, setIsTraining] = useState(false)
  const [seed, setSeed] = useState(11)
  const [sampler, setSampler] = useState<'ancestral' | 'ddim'>('ancestral')
  const [parameterisation, setParameterisation] = useState<Parameterisation>('epsilon')

  const data = useMemo(() => ringMixture(createRng(seed), 400, 8), [seed])

  const train = () => {
    setIsTraining(true)
    // The training is synchronous but short enough not to block the interface
    // for long; the button is disabled meanwhile so it cannot be pressed twice.
    window.setTimeout(() => {
      const result = trainDenoiser(
        {
          dimension: DIMENSION,
          hiddenSizes: [32, 32],
          timeEmbeddingDimension: 8,
          schedule: SCHEDULE,
          seed,
        },
        { steps: 900, batchSize: 64, recordEvery: 50 },
      )
      setModel(result)
      setIsTraining(false)
    }, 20)
  }

  const config: ReverseConfig = useMemo(
    () => ({ schedule: SCHEDULE, parameterisation, variance: 'beta', dimension: DIMENSION }),
    [parameterisation],
  )

  const trace = useMemo(() => {
    if (!model) return null
    return sample((x, t) => model.denoiser.predict(x, t), config, seed, {
      ddim: sampler === 'ddim',
    })
  }, [model, config, seed, sampler])

  const trajectories = useMemo(() => {
    if (!model) return []
    const rng = createRng(seed + 31)
    return Array.from({ length: 4 }, (_, sampleIndex) => {
      let current = [rng() * 2 - 1, rng() * 2 - 1]
      const points = [{ x: current[0], y: current[1] }]
      for (let t = SCHEDULE.steps - 1; t >= 0; t -= 10) {
        const prediction = model.denoiser.predict(current, t)
        const result =
          sampler === 'ddim'
            ? ddimStep(current, t, prediction, config, rng, 0)
            : ancestralStep(current, t, prediction, config, rng, true)
        current = result.xPrevious
        points.push({ x: current[0], y: current[1] })
      }
      return { sampleIndex, points }
    })
  }, [model, config, seed, sampler])

  const parameterisationRows = useMemo(() => {
    const x0 = [1.1, -0.6]
    const t = 30
    const epsilon = [0.4, -0.2]
    const xT = qSample(x0, t, epsilon, SCHEDULE)
    const asV = SCHEDULE.sqrtAlphaBar[t] * epsilon[0] - SCHEDULE.sqrtOneMinusAlphaBar[t] * x0[0]
    const asV2 = SCHEDULE.sqrtAlphaBar[t] * epsilon[1] - SCHEDULE.sqrtOneMinusAlphaBar[t] * x0[1]
    const fromV = toEpsilon([asV, asV2], xT, t, SCHEDULE, 'v')
    const x0FromEpsilon = toX0(epsilon, xT, t, SCHEDULE, 'epsilon')
    const x0FromV = toX0([asV, asV2], xT, t, SCHEDULE, 'v')
    const meanFromEpsilon = reverseMean(epsilon, xT, t, SCHEDULE)
    return [
      ['the true x_0', `(${fmt(x0[0], 4)}, ${fmt(x0[1], 4)})`],
      ['the true ε', `(${fmt(epsilon[0], 4)}, ${fmt(epsilon[1], 4)})`],
      ['x_t', `(${fmt(xT[0], 4)}, ${fmt(xT[1], 4)})`],
      ['ε recovered from the v form', `(${fmt(fromV[0], 4)}, ${fmt(fromV[1], 4)})`],
      ['x_0 recovered from ε', `(${fmt(x0FromEpsilon[0], 4)}, ${fmt(x0FromEpsilon[1], 4)})`],
      ['x_0 recovered from v', `(${fmt(x0FromV[0], 4)}, ${fmt(x0FromV[1], 4)})`],
      ['the reverse mean μ_θ', `(${fmt(meanFromEpsilon[0], 4)}, ${fmt(meanFromEpsilon[1], 4)})`],
    ] as [string, string][]
  }, [])

  const lossCurve = useMemo(
    () => (model ? model.losses.map((entry) => ({ x: entry.step, loss: entry.loss })) : []),
    [model],
  )

  const sampleQuality = useMemo(() => {
    if (!model || !trace) return null
    const final = trace.states[trace.states.length - 1]
    let nearest = Number.POSITIVE_INFINITY
    for (const point of data) {
      nearest = Math.min(nearest, l2Distance(final, point))
    }
    return { radius: Math.hypot(final[0], final[1]), nearest }
  }, [model, trace, data])

  return (
    <div className="lab">
      <Panel
        title="Laboratory B · The reverse process"
        subtitle="A real denoiser, trained in your browser, sampled back to the data"
        accent="teal"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'sampling', label: 'Sampling' },
              { value: 'parameterisations', label: 'Parameterisations' },
            ]}
          />
          <SegmentedControl
            label="Sampler"
            value={sampler}
            onChange={setSampler}
            options={[
              { value: 'ancestral', label: 'Ancestral' },
              { value: 'ddim', label: 'DDIM (deterministic)' },
            ]}
          />
          <Slider
            label="Seed"
            value={seed}
            min={1}
            max={50}
            onChange={setSeed}
            hint="The seed fixes the data, the model and the sampler."
          />
          <div className="field">
            <span className="field-label">The model</span>
            <Button variant="primary" onClick={train} disabled={isTraining}>
              {isTraining ? 'Training…' : model ? 'Retrain the denoiser' : 'Train the denoiser'}
            </Button>
            <p className="field-hint">
              A two-layer perceptron, trained from scratch on a generated ring of eight modes, with the simplified
              objective of equation 14.
            </p>
          </div>
        </div>

        {view === 'sampling' ? (
          <>
            {!model ? (
              <Callout tone="note" title="Nothing to show yet">
                Press <strong>Train the denoiser</strong>. The network is built, initialised and trained in this tab —
                there is no pre-trained checkpoint anywhere in this project, and no download.
              </Callout>
            ) : (
              <>
                <div className="stat-row">
                  <Stat label="Final loss" value={fmt(model.finalLoss, 4)} hint="mean squared error on ε" />
                  <Stat label="Training steps" value={String(model.losses.length)} hint="recorded points" />
                  <Stat label="Network evaluations" value={String(SCHEDULE.steps)} hint="one per sampling step" />
                  {sampleQuality ? (
                    <Stat
                      label="Sample radius"
                      value={fmt(sampleQuality.radius, 3)}
                      hint={`nearest training point at ${fmt(sampleQuality.nearest, 3)}`}
                      tone={sampleQuality.radius > 1.2 && sampleQuality.radius < 2.8 ? 'good' : 'warn'}
                    />
                  ) : null}
                </div>

                <Figure
                  title="The training loss"
                  description="The simplified objective during training: the mean squared error between the true noise and the network's prediction of it, over the training steps."
                  caption="The loss on the simplified objective. It falls as the network learns to predict the noise at each noise level."
                >
                  <TrendChart
                    data={lossCurve}
                    series={[{ key: 'loss', name: 'L_simple', colour: 'var(--accent-teal)' }]}
                    xLabel="training step"
                    yLabel="mean squared error"
                    height={240}
                  />
                </Figure>

                <Figure
                  title="The reverse process, from noise to data"
                  description="Four sampled trajectories through the reverse chain, plotted at intervals, with the training data shown behind them."
                  caption="Four samples drawn from the trained model, with their intermediate states. The chain starts as pure noise and ends on the ring of modes."
                >
                  <PointChart
                    points={[
                      ...data.map((point) => ({ x: point[0], y: point[1], group: 'The data' })),
                      ...(trajectories.flatMap((trajectory) =>
                        trajectory.points.map((point) => ({ x: point.x, y: point.y, group: 'Samples' })),
                      ) ?? []),
                    ]}
                    series={[
                      { key: 'The data', name: 'The training data', colour: 'var(--border-strong)' },
                      { key: 'Samples', name: 'Sampled trajectories', colour: 'var(--accent-rose)' },
                    ]}
                    xLabel="first coordinate"
                    yLabel="second coordinate"
                    height={360}
                    domain={[
                      [-3.5, 3.5],
                      [-3.5, 3.5],
                    ]}
                  />
                </Figure>

                <DataTable
                  caption="The chain, step by step, for one sample"
                  headers={['Step', 'State', 'Radius']}
                  rows={
                    trace
                      ? trace.steps
                          .filter((_, index) => index % 20 === 0)
                          .map((step, index) => {
                            const state = trace.states[index + 1]
                            return [step, `(${fmt(state[0], 3)}, ${fmt(state[1], 3)})`, fmt(Math.hypot(state[0], state[1]), 3)]
                          })
                      : []
                  }
                />

                <Callout tone="warning" title="This is a toy model, trained on toy data">
                  The network is a two-layer perceptron with 32 hidden units, trained for 900 steps on 400 points drawn
                  from a generated ring of eight Gaussian modes. It is a real diffusion model, trained with a real
                  gradient, on a distribution that is easy enough to fit in a second — and it is not a model of images,
                  and it is not a model of anything a paper has published a number for.
                </Callout>
              </>
            )}
          </>
        ) : null}

        {view === 'parameterisations' ? (
          <>
            <div className="lab-controls">
              <SegmentedControl
                label="Parameterisation used for sampling"
                value={parameterisation}
                onChange={setParameterisation}
                options={[
                  { value: 'epsilon', label: 'ε' },
                  { value: 'x0', label: 'x₀' },
                  { value: 'v', label: 'v' },
                ]}
              />
            </div>

            <Figure
              title="One network output, three readings"
              description="The same network output interpreted as the predicted noise, as the predicted clean sample, and as the predicted velocity, with the true values shown for comparison."
              caption="The three parameterisations describe the same reverse process. What changes is the regression target, and therefore how the training objective is weighted across noise levels."
            >
              <DataTable caption="Converting between the parameterisations" headers={['Quantity', 'Value']} rows={parameterisationRows} />
            </Figure>

            <Callout tone="definition" title="Why the conversion is exact">
              The v parameterisation is v = √ᾱ_t·ε − √(1−ᾱ_t)·x_0. Because the closed form gives x_t = √ᾱ_t·x_0 +
              √(1−ᾱ_t)·ε, the two are invertible: ε = √(1−ᾱ_t)·x_t + √ᾱ_t·v, and x_0 = √ᾱ_t·x_t − √(1−ᾱ_t)·v. The
              table above is that algebra, evaluated.
            </Callout>

            {model ? (
              <Callout tone="note" title="The parameterisation only changes the target">
                Switch the control above and press <strong>Retrain the denoiser</strong> to train the network to predict
                that quantity instead. The reverse process it defines is the same one; only the regression target and
                the resulting loss weighting differ.
              </Callout>
            ) : null}
          </>
        ) : null}
      </Panel>
    </div>
  )
}
