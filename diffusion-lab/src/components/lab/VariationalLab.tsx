import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildSchedule } from '../../core/schedules'
import { qSample } from '../../core/forward'
import { posteriorMean } from '../../core/forward'
import { simplifiedObjectiveRatio, weightCurves } from '../../core/variational'
import type { ReverseConfig } from '../../core/reverse'
import { Callout, Figure, Panel, SegmentedControl, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

const SCHEDULE = buildSchedule('linear', 200)
const CONFIG: ReverseConfig = {
  schedule: SCHEDULE,
  parameterisation: 'epsilon',
  variance: 'beta',
  dimension: 2,
}

export function VariationalLab() {
  const [view, setView] = useState<'weights' | 'decomposition' | 'cost'>('weights')

  const curves = useMemo(() => weightCurves(SCHEDULE, CONFIG), [])

  const ratioData = useMemo(
    () =>
      SCHEDULE.betas.map((_, t) => ({
        x: t,
        ratio: simplifiedObjectiveRatio(t, CONFIG),
        normalised: curves.weighted[t],
      })),
    [curves],
  )

  const decomposition = useMemo(() => {
    const x0 = [0.8, -0.4]
    const noise = [0.3, 0.6]
    const xT = qSample(x0, 60, noise, SCHEDULE)

    // The "model" here is the exact posterior, so every per-step term is
    // zero; the lab shows what the terms would be for a model that is wrong
    // by a fixed amount in each coordinate.
    const truth = posteriorMean(xT, x0, 60, SCHEDULE)
    const wrong = truth.map((value) => value + 0.05)

    const rows: { t: number; kl: number; weight: number }[] = []
    for (let t = 1; t < SCHEDULE.steps; t += 2) {
      const alphaBarPrevious = SCHEDULE.previousAlphaBars[t]
      const alphaBar = SCHEDULE.alphaBars[t]
      const alpha = SCHEDULE.alphas[t]
      const beta = SCHEDULE.betas[t]
      const denominator = 1 - alphaBar
      const c0 = (Math.sqrt(alphaBarPrevious) * beta) / denominator
      const cT = (Math.sqrt(alpha) * (1 - alphaBarPrevious)) / denominator
      const mean = x0.map((value, i) => c0 * value + cT * (xT[i] ?? 0))

      const posteriorStd = Math.sqrt(((1 - alphaBarPrevious) / denominator) * beta)
      const modelStd = Math.sqrt(beta)
      const kl =
        0.5 *
        (mean.reduce((acc, value, i) => {
          const d = value - (wrong[i] ?? 0)
          return acc + Math.log(modelStd / posteriorStd) + (posteriorStd ** 2 + d * d) / (2 * modelStd ** 2) - 0.5
        }, 0))

      rows.push({ t, kl, weight: simplifiedObjectiveRatio(t, CONFIG) })
    }
    return rows
  }, [])

  const total = decomposition.reduce((acc, row) => acc + row.kl, 0)

  return (
    <div className="lab">
      <Panel
        title="Laboratory F · The variational bound"
        subtitle="What the objective actually is, and what the simplification gives up"
        accent="violet"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'weights', label: 'The weights' },
              { value: 'decomposition', label: 'The decomposition' },
              { value: 'cost', label: 'The cost' },
            ]}
          />
        </div>

        <div className="stat-row">
          <Stat
            label="Largest true weight"
            value={fmt(curves.maxWeighted, 4)}
            hint="at the smallest timesteps"
          />
          <Stat
            label="Weight at the last step"
            value={fmt(ratioData[ratioData.length - 1].ratio, 6)}
            hint="effectively nothing"
          />
          <Stat label="Simplified weight" value="1" hint="everywhere, by definition" />
          <Stat label="Per-step KL, summed" value={fmt(total, 4)} hint="nats, for a model off by 0.05" />
        </div>

        {view === 'weights' ? (
          <>
            <Figure
              title="The weight the true bound puts on each timestep"
              description="The weight of the true variational bound at each timestep, on a logarithmic scale, together with the flat weight of the simplified objective."
              caption="The true bound weights the loss by β_t²/(2σ_t²α_t(1−ᾱ_t)). The simplified objective replaces that with 1, which is why small timesteps are effectively ignored."
            >
              <TrendChart
                data={ratioData}
                series={[
                  { key: 'ratio', name: 'the true weight', colour: 'var(--accent-violet)' },
                ]}
                xLabel="timestep t"
                yLabel="weight (log scale)"
                height={300}
              />
            </Figure>

            <Figure
              title="The two objectives, normalised"
              description="The weight of the true bound, rescaled so that its largest value is one, together with the flat weight the simplified objective uses."
              caption="Normalised so the two curves can be compared. The gap between them is the whole difference between the true bound and the objective the paper trains with."
            >
              <TrendChart
                data={curves.weighted.map((weight, index) => ({ x: index, weighted: weight, simplified: 1 }))}
                series={[
                  { key: 'weighted', name: 'the true bound, normalised', colour: 'var(--accent-violet)' },
                  { key: 'simplified', name: 'the simplified objective', colour: 'var(--accent-amber)', dashed: true },
                ]}
                xLabel="timestep t"
                yLabel="relative weight"
                yDomain={[0, 1.05]}
                height={280}
              />
            </Figure>

            <Callout tone="definition" title="Why the simplification is not a small change">
              The true weight is enormous at small t and negligible at large t. Replacing it with a constant therefore
              does not rescale the objective — it changes which timesteps the network spends its capacity on. The paper
              reports that this gives worse codelengths and better samples, and the course leaves the judgement to the
              ablation rather than to an argument.
            </Callout>
          </>
        ) : null}

        {view === 'decomposition' ? (
          <>
            <Figure
              title="The per-step KL terms"
              description="The KL divergence between the true posterior and a reverse process that is wrong by a fixed amount, at each timestep."
              caption="One KL term per step, for a reverse process whose mean is off by 0.05 in both coordinates. The terms are not equal, and the true bound would weight them very unequally indeed."
            >
              <TrendChart
                data={decomposition}
                xKey="t"
                series={[{ key: 'kl', name: 'L_{t−1}', colour: 'var(--accent-violet)' }]}
                xLabel="timestep t"
                yLabel="KL (nats)"
                height={280}
              />
            </Figure>

            <DataTable
              caption="The terms, sampled along the chain"
              headers={['t', 'L_{t−1} (nats)', 'the true weight']}
              rows={decomposition
                .filter((_, index) => index % 10 === 0)
                .map((row) => [row.t, fmt(row.kl, 6), fmt(row.weight, 4)])}
            />

            <Callout tone="note" title="Every term is a closed form">
              Both distributions are Gaussian, so the KL divergence between them is the formula on the equation page,
              evaluated. There is no Monte Carlo estimate anywhere in this screen, and no network.
            </Callout>
          </>
        ) : null}
        {view === 'cost' ? (
          <>
            <Figure
              title="What a sample costs"
              description="The number of network evaluations a sample costs for a given number of steps, and the wall-clock estimate that follows."
              caption="The number of steps is the only number that matters for sampling cost. The paper uses T = 1000, so one sample costs one thousand network evaluations — which is why every later improvement in this area is about taking fewer steps."
            >
              <DataTable
                caption="The cost of one sample, by the number of steps"
                headers={['Steps', 'Network evaluations', 'Relative to T = 1000']}
                rows={[1, 2, 4, 10, 20, 50, 100, 250, 500, 1000].map((steps) => [
                  steps,
                  steps,
                  `${fmt(steps / 1000, 4)}×`,
                ])}
              />
            </Figure>

            <Callout tone="note" title="Where the cost actually is">
              The forward process costs nothing at sampling time: it is only used during training, and its closed form
              means a training step never depends on T. The reverse process is the whole bill, and it is paid once per
              step, for every sample.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
