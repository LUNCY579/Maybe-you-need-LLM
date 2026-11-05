import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { compareAllocations, computeOptimum, surfaceLoss, type SurfaceFit } from '../../core/surface'
import { betterAt, crossoverBudget, crossoverSeries } from '../../core/isoflop'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { COMPUTE_DEFAULTS } from '../../content/labDefaults'
import { GRID_CAPACITIES, GRID_SAMPLES, useTrainingSurface } from './surfaceFixture'

type View = 'curve' | 'optimum' | 'crossover'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const COMPUTE_VIEWS: { value: View; label: string }[] = [
  { value: 'curve', label: 'The budget' },
  { value: 'optimum', label: 'The optimum' },
  { value: 'crossover', label: 'The crossover' },
]

export function ComputeLab() {
  const [view, setView] = useViewParam(COMPUTE_VIEWS)
  const [decay, setDecay] = useState(COMPUTE_DEFAULTS.decay)
  const [noise, setNoise] = useState(COMPUTE_DEFAULTS.noise)
  const [budget, setBudget] = useState(COMPUTE_DEFAULTS.budget)
  const [seed, setSeed] = useState(COMPUTE_DEFAULTS.seed)
  const [small, setSmall] = useState(COMPUTE_DEFAULTS.smallCapacity)
  const [large, setLarge] = useState(COMPUTE_DEFAULTS.largeCapacity)

  const { points, fit } = useTrainingSurface({ decay, noise, seed })

  const optimum = useMemo(() => computeOptimum(fit, budget), [fit, budget])
  const allocations = useMemo(() => compareAllocations(fit, budget), [fit, budget])

  // The two sizes have to be distinct or the crossover question has no answer, and the
  // slider pair cannot enforce that on its own. A tie is read as the next capacity up.
  const lo = Math.min(small, large)
  const hi = Math.max(small, large)
  const pair = lo === hi ? { small: lo, large: lo + 1 } : { small: lo, large: hi }
  const crossover = useMemo(() => crossoverBudget(fit, pair.small, pair.large), [fit, pair.small, pair.large])
  const atBudget = useMemo(() => betterAt(fit, budget, pair.small, pair.large), [fit, budget, pair.small, pair.large])
  const series = useMemo(() => {
    const larger = GRID_CAPACITIES.filter((capacity) => capacity > pair.small)
    return crossoverSeries(fit, pair.small, larger.length > 0 ? larger : [pair.large])
  }, [fit, pair.small, pair.large])

  return (
    <div className="lab">
      <Panel
        title="Laboratory B · The compute optimum"
        subtitle="A budget, and the allocation that minimises the loss under it"
        accent="teal"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={COMPUTE_VIEWS}
          />
          <Slider
            label="The budget"
            value={Math.log10(budget)}
            min={4}
            max={10}
            step={0.1}
            onChange={(value) => setBudget(10 ** value)}
            format={(value) => `10^${value.toFixed(1)}`}
            hint="The product of the parameters and the samples, times six."
          />
          <Slider
            label="The spectrum’s decay"
            value={decay}
            min={0.5}
            max={1.2}
            step={0.01}
            onChange={setDecay}
            format={(value) => value.toFixed(2)}
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
          {view === 'crossover' ? (
            <>
              <Slider label="The smaller capacity" value={small} min={2} max={32} onChange={setSmall} />
              <Slider label="The larger capacity" value={large} min={4} max={64} onChange={setLarge} />
            </>
          ) : null}
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="The capacity at the optimum" value={fmt(optimum.capacity, 1)} />
          <Stat label="The samples at the optimum" value={fmt(optimum.samples, 1)} />
          <Stat
            label="The tokens per parameter"
            value={fmt(optimum.samplesPerParameter, 2)}
            hint="at the optimum"
          />
          <Stat label="The loss at the optimum" value={fmt(optimum.loss, 5)} tone="good" />
        </div>

        {view === 'curve' ? (
          <>
            <Figure
              title="The loss along a fixed budget"
              description="As the allocation slides from all data to all parameters, the loss along the fixed budget."
              caption="The curve has a single minimum, and it is not at either end. That is the whole content of the compute-optimal allocation: there is a best way to spend the budget, and it is in the middle."
            >
              <TrendChart
                data={optimum.curve.map((point) => ({ x: point.capacity, loss: point.loss }))}
                series={[{ key: 'loss', name: 'the loss along the budget', colour: 'var(--accent-teal)' }]}
                xLabel="the capacity"
                yLabel="the loss"
                height={280}
              />
            </Figure>

            <Callout tone="note" title="The budget is a product, not a sum">
              The cost of a run is proportional to the parameters times the tokens, so fixing the budget means fixing
              the product. Every point on the curve above has the same cost, and the loss is what varies.
            </Callout>
          </>
        ) : null}

        {view === 'optimum' ? (
          <>
            <Figure
              title="The fitted surface"
              description="The loss as a function of the capacity and the number of samples, and the fit of E + A·N^(−α) + B·D^(−β)."
              caption="The surface is fitted by a search over the two exponents with a non-negative least-squares solve inside, because for fixed exponents the model is linear in its three remaining coefficients — and all three of those are a floor or a penalty, so none of them is allowed below zero."
            >
              <DataTable
                caption="The fitted surface"
                headers={['The term', 'Its value', 'What it is']}
                rows={[
                  ['E', fmt(fit.E, 5), fit.constrained
                    ? 'held at zero: the unconstrained fit wanted a floor below zero, which is not a loss'
                    : 'the irreducible loss — the floor'],
                  ['A', fmt(fit.A, 5), `the capacity term, with the exponent ${fmt(fit.alpha, 4)}`],
                  ['B', fmt(fit.B, 5), `the data term, with the exponent ${fmt(fit.beta, 4)}`],
                  ['R²', fmt(fit.r2, 4), 'how much of the variation the surface explains'],
                ]}
              />
            </Figure>

            <Figure
              title="The runs the surface was fitted on"
              description={`${points.length} training runs: the capacities ${GRID_CAPACITIES.join(', ')} against the sample counts ${GRID_SAMPLES.join(', ')}, each measured on held-out data.`}
              caption="This is the grid the search is made on, and the region a number on this screen is interpolated inside — the row below says whether the budget you asked about sits in it or outside it. Read the residual column down its capacities rather than across: it changes sign in blocks, which is the additive form failing rather than the runs being noisy. A fit's data term is really σ²·capacity/samples, so its steepness depends on the size, and a single B·D^(−β) cannot be right at capacity 8 and capacity 64 at once. That is what the constrained floor is paying for."
            >
              <DataTable
                caption="Every run, and the surface’s prediction of it"
                headers={['Capacity', 'Samples', 'Measured loss', 'Surface loss', 'Residual']}
                rows={points.map((point) => [
                  point.capacity,
                  point.samples,
                  fmt(point.loss, 5),
                  fmt(surfaceLoss(fit, point.capacity, point.samples), 5),
                  fmt(point.loss - surfaceLoss(fit, point.capacity, point.samples), 5),
                ])}
              />
            </Figure>

            <Figure
              title="The four ways to spend the budget"
              description="The compute optimum, and the three naive alternatives, all at the same cost."
              caption="The naive allocations are not slightly worse; they are much worse. The price of ignoring the structure of the loss is the price of the whole optimisation."
            >
              <DataTable
                caption="The allocations, at the same budget"
                headers={['The allocation', 'The capacity', 'The samples', 'The loss']}
                rows={allocations.map((row) => [
                  row.name,
                  fmt(row.capacity, 1),
                  fmt(row.samples, 1),
                  fmt(row.loss, 5),
                ])}
              />
            </Figure>

            <Callout tone="definition" title="What the tokens-per-parameter ratio means here">
              The ratio at the optimum is a <em>consequence</em> of the two exponents and the budget, not a setting
              anybody chooses. Change the budget and it moves; change the task and it moves. The paper this course is
              built on reports a ratio near twenty for its own models, and that number is quoted there rather than
              computed here — this laboratory computes the ratio for <em>this</em> surface, which is a different
              measurement.
            </Callout>
          </>
        ) : null}

        {view === 'crossover' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The crossover compute"
                value={fmt(crossover.budget, 2)}
                hint="the budget at which the two sizes tie"
              />
            <Stat
                label="The winner at this budget"
                value={atBudget.winner === pair.large ? `N = ${pair.large}` : `N = ${pair.small}`}
                tone={atBudget.winner === pair.large ? 'good' : 'warn'}
                hint="of the two sizes offered"
              />
              <Stat
                label="The gap"
                value={fmt(Math.abs(atBudget.gap), 5)}
                hint="the loss difference between them at this budget"
              />
              <Stat
                label="The data threshold"
                value={fmt(crossover.dataThreshold, 1)}
                hint="samples below which the larger model is the wrong choice"
              />
            </div>

            <Figure
              title="Which of the two wins, budget by budget"
              description="Both sizes are given the sample counts that the same compute allows, D = P/N, and the two losses are compared."
              caption="Below the crossover the small model trained on more data is better; above it the large model trained on less is better. That is the sentence “bigger models need more data”, turned into a number: the data is not a preference, it is what the same budget leaves you once the parameters are paid for."
            >
              <TrendChart
                data={crossoverGrid(fit, pair.small, pair.large)}
                series={[
                  { key: 'small', name: `N = ${pair.small}`, colour: 'var(--accent-teal)' },
                  { key: 'large', name: `N = ${pair.large}`, colour: 'var(--accent-rose)' },
                ]}
                xLabel="the log of the budget"
                yLabel="the loss"
                referenceLines={[{ x: Math.log10(crossover.budget), label: 'the crossover' }]}
                height={280}
              />
            </Figure>

            <Figure
              title="One size against every larger one"
              description={`The compute at which each capacity starts to pay for itself, measured against N = ${pair.small}.`}
              caption="The crossover grows with the gap in size, which is the content of the claim that a larger model is only worth paying for once there is data enough to fill it."
            >
              <DataTable
                caption={`The crossover of N = ${pair.small} against each larger capacity`}
                headers={['The larger N', 'The ratio', 'The crossover compute', 'Samples each has there', 'The loss both give']}
                rows={series.map((row) => [
                  row.large,
                  fmt(row.ratio, 2),
                  fmt(row.budget, 2),
                  fmt(row.samplesForLarge, 1),
                  fmt(row.loss, 5),
                ])}
              />
            </Figure>

            <Callout tone="warning" title="The crossover is a property of the fitted surface">
              Both losses are read from the same E + A·N^(−α) + B·D^(−β) that view B fitted to the twenty runs, so the
              crossover inherits the range it was fitted over. Extrapolate a law past the grid that measured it and
              the crossover you get is a claim about the extrapolation, not about the models.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}

/**
 * The two sizes’ losses along a sweep of budgets.
 *
 * Each budget is plotted at its own base-ten logarithm, because the crossover spans
 * six orders of it and a linear axis would show two straight lines crossing rather
 * than the sweep of the trade-off. `x` is the log; the marker is the closed-form
 * crossover, so the line and the marker are two independent readings of the same
 * surface and a test can insist they fall in the same place.
 */
function crossoverGrid(fit: SurfaceFit, small: number, large: number) {
  const points: { x: number; small: number; large: number }[] = []
  for (let i = 0; i <= 24; i++) {
    const budget = 10 ** (4 + i * 0.25)
    const compared = betterAt(fit, budget, small, large)
    points.push({ x: 4 + i * 0.25, small: compared.smallLoss, large: compared.largeLoss })
  }
  return points
}
