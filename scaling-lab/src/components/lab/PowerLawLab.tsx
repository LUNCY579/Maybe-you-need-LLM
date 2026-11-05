import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildScalingTask, trainRidge } from '../../core/spectral'
import { doublingGain, fitPowerLaw, predictPowerLaw } from '../../core/surface'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { POWERLAW_DEFAULTS } from '../../content/labDefaults'

type View = 'fit' | 'range'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const POWERLAW_VIEWS: { value: View; label: string }[] = [
  { value: 'fit', label: 'The fit' },
  { value: 'range', label: 'The range' },
]

export function PowerLawLab() {
  const [view, setView] = useViewParam(POWERLAW_VIEWS)
  const [decay, setDecay] = useState(POWERLAW_DEFAULTS.decay)
  const [noise, setNoise] = useState(POWERLAW_DEFAULTS.noise)
  const [capacity, setCapacity] = useState(POWERLAW_DEFAULTS.capacity)
  const [seed, setSeed] = useState(POWERLAW_DEFAULTS.seed)

  const task = useMemo(() => buildScalingTask({ decay, noise }), [decay, noise])

  /** The training runs: the same model, more and more data. */
  const runs = useMemo(() => {
    const points: { samples: number; loss: number }[] = []
    for (const samples of [50, 100, 200, 400, 800, 1600, 3200]) {
      const run = trainRidge(task, { capacity, samples, seed })
      points.push({ samples, loss: run.testLoss })
    }
    return points
  }, [task, capacity, seed])

  const fit = useMemo(
    () => fitPowerLaw(runs.map((run) => run.samples), runs.map((run) => run.loss)),
    [runs],
  )

  const rangeFits = useMemo(() => {
    const rows: { from: number; to: number; alpha: number; r2: number }[] = []
    for (let from = 0; from < runs.length - 2; from++) {
      for (let to = from + 2; to < runs.length; to++) {
        const slice = runs.slice(from, to + 1)
        const partial = fitPowerLaw(
          slice.map((run) => run.samples),
          slice.map((run) => run.loss),
        )
        rows.push({ from: slice[0]!.samples, to: slice[slice.length - 1]!.samples, alpha: partial.alpha, r2: partial.r2 })
      }
    }
    return rows
  }, [runs])

  return (
    <div className="lab">
      <Panel
        title="Laboratory A · The power law"
        subtitle="Training runs here, a law fitted to them here"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={POWERLAW_VIEWS}
          />
          <Slider
            label="The spectrum’s decay"
            value={decay}
            min={0.5}
            max={1.2}
            step={0.01}
            onChange={setDecay}
            format={(value) => value.toFixed(2)}
            hint="The shape of the signal: how fast it thins out along the spectrum."
          />
          <Slider
            label="The noise"
            value={noise}
            min={0.005}
            max={0.4}
            step={0.005}
            onChange={setNoise}
            format={(value) => value.toFixed(3)}
          />
          <Slider label="The capacity" value={capacity} min={2} max={64} onChange={setCapacity} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="The exponent" value={fmt(fit.alpha, 4)} hint="the slope of the log–log line" />
          <Stat label="The R²" value={fmt(fit.r2, 4)} tone={fit.r2 > 0.95 ? 'good' : 'warn'} />
          <Stat
            label="What a doubling buys"
            value={`${fmt((1 - doublingGain(fit)) * 100, 2)}%`}
            hint="the improvement per doubling of the data"
          />
          <Stat label="The training runs" value={String(runs.length)} />
        </div>

        {view === 'fit' ? (
          <>
            <Figure
              title="The loss against the data"
              description="The measured held-out loss of the model, and the law fitted to those points in log–log space."
              caption="Every point on this chart is a real training run: a ridge estimator fitted on freshly drawn data and measured on data it had never seen."
            >
              <TrendChart
                data={runs.map((run) => ({ x: run.samples, loss: run.loss }))}
                series={[{ key: 'loss', name: 'the measured loss', colour: 'var(--accent-indigo)' }]}
                xLabel="the number of training samples"
                yLabel="the held-out loss"
                height={280}
              />
            </Figure>

            <Figure
              title="The fit, in log–log space"
              description="The same points with both axes on a logarithmic scale, and the straight line through them."
              caption="A power law is a straight line in log–log space, and the exponent is the slope. The R² says how close the points are to the line."
            >
              <DataTable
                caption="Every run, and what the law says about it"
                headers={['The samples', 'The measured loss', 'The predicted loss', 'The ratio']}
                rows={runs.map((run, index) => [
                  run.samples,
                  fmt(run.loss, 5),
                  fmt(predictPowerLaw(fit, run.samples), 5),
                  index === 0 ? '—' : fmt(run.loss / (runs[index - 1]!.loss), 4),
                ])}
              />
            </Figure>

            <Callout tone="definition" title="Why the exponent is the number to quote">
              The law is multiplicative, so the natural unit of improvement is a doubling of the data. An exponent of
              0.5 means a doubling improves the loss by about 29%, and an exponent of 0.1 means about 7%. The two
              exponents are worth more to a practitioner than the whole fitted curve.
            </Callout>
          </>
        ) : null}

        {view === 'range' ? (
          <>
            <Figure
              title="The same runs, fitted over different ranges"
              description="Every contiguous range of the runs, and the exponent that comes out of fitting it."
              caption="This is the caveat that a bare exponent hides: the fitted exponent is an average over the range you fitted, and it moves when the range moves."
            >
              <DataTable
                caption="The exponent, by the range it was fitted over"
                headers={['From', 'To', 'The exponent', 'The R²']}
                rows={rangeFits
                  .filter((row) => row.to > row.from)
                  .slice(0, 18)
                  .map((row) => [row.from, row.to, fmt(row.alpha, 4), fmt(row.r2, 4)])}
              />
            </Figure>

            <Callout tone="warning" title="An exponent without a range is half a result">
              A law that is measured over one decade and quoted as a universal constant is a claim about a region
              that was never tested. The runs above are all from the same experiment; the exponent still moves with the
              range, and a real law is flatter and noisier than a synthetic one.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
