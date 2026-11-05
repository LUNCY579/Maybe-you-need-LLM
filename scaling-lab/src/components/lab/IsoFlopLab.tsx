import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  analyticOptimum,
  budgetWhereDataRunsOut,
  frontier,
  frontierExponent,
  isoFlopFamily,
  isoFLOPCurve,
  measuredAllocationExponents,
  predictedAllocationExponents,
  tokensPerParameterRule,
  insideFittedRange,
} from '../../core/isoflop'
import { constrainedOptimum } from '../../core/epochs'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { ISOFLOP_DEFAULTS } from '../../content/labDefaults'
import { GRID_CAPACITIES, GRID_SAMPLES, useTrainingSurface } from './surfaceFixture'

type View = 'curve' | 'rule' | 'runout'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const ISOFLOP_VIEWS: { value: View; label: string }[] = [
  { value: 'curve', label: 'The curves' },
  { value: 'rule', label: 'The rule' },
  { value: 'runout', label: 'The finite pool' },
]

export function IsoFlopLab() {
  const [view, setView] = useViewParam(ISOFLOP_VIEWS)
  const [decay, setDecay] = useState(ISOFLOP_DEFAULTS.decay)
  const [noise, setNoise] = useState(ISOFLOP_DEFAULTS.noise)
  const [seed, setSeed] = useState(ISOFLOP_DEFAULTS.seed)
  const [budget, setBudget] = useState(ISOFLOP_DEFAULTS.budget)
  const [decade, setDecade] = useState(ISOFLOP_DEFAULTS.budgetDecadeStart)
  const [points, setPoints] = useState(ISOFLOP_DEFAULTS.points)
  const [uniquePool, setUniquePool] = useState(ISOFLOP_DEFAULTS.uniquePool)

  const { fit } = useTrainingSurface({ decay, noise, seed })

  // The nest is three curves two decades apart, so their minima are visibly on a line.
  const budgets = useMemo(() => [0, 1, 2].map((step) => 10 ** (decade + 2 * step)), [decade])
  const family = useMemo(() => isoFlopFamily(fit, budgets, { points }), [fit, budgets, points])
  const curve = useMemo(() => isoFLOPCurve(fit, budget, { points }), [fit, budget, points])
  const optimum = useMemo(() => analyticOptimum(fit, budget), [fit, budget])

  const rule = useMemo(
    () => tokensPerParameterRule(fit, budgets),
    [fit, budgets],
  )
  const allocation = useMemo(() => predictedAllocationExponents(fit), [fit])
  const measured = useMemo(() => measuredAllocationExponents(fit, budgets), [fit, budgets])
  const front = useMemo(() => frontier(fit, budgets), [fit, budgets])
  const gamma = useMemo(() => frontierExponent(fit), [fit])

  const runout = useMemo(() => budgetWhereDataRunsOut(fit, uniquePool), [fit, uniquePool])
  const constrained = useMemo(() => constrainedOptimum(fit, budget, uniquePool), [fit, budget, uniquePool])
  const range = useMemo(
    () => ({
      capacity: [Math.min(...GRID_CAPACITIES), Math.max(...GRID_CAPACITIES)] as [number, number],
      samples: [Math.min(...GRID_SAMPLES), Math.max(...GRID_SAMPLES)] as [number, number],
    }),
    [],
  )
  const fitted = useMemo(() => insideFittedRange(optimum, range), [optimum, range])

  // One series per curve in the nest, in the order they were asked for.
  const familySeries = budgets.map((budgetValue, index) => ({
    key: `b${index}`,
    name: `10^${Math.log10(budgetValue).toFixed(0)}`,
    colour: COLOURS[index % COLOURS.length]!,
  }))
  // Each curve is swept over its own capacity range, so the nest is plotted in units of
  // its own optimum: r = N/N*. That puts every minimum at zero on the axis and makes the
  // arms comparable, which is the thing the chart is for.
  const resolution = Math.min(...family.map((entry) => entry.curve.length))
  const merged = Array.from({ length: resolution }, (_unused, i) => {
    const row: { x: number; [key: string]: number } = {} as { x: number }
    family.forEach((entry, index) => {
      const point = entry.curve[i]!
      row.x = Math.log10(point.capacity / entry.optimum.capacity)
      row[`b${index}`] = point.loss
    })
    return row
  })

  return (
    <div className="lab">
      <Panel
        title="Laboratory C · The IsoFLOP frontier"
        subtitle="The closed form beside the runs it was derived from"
        accent="violet"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={ISOFLOP_VIEWS}
          />
          <Slider
            label="The budget"
            value={Math.log10(budget)}
            min={4}
            max={10}
            step={0.1}
            onChange={(value) => setBudget(10 ** value)}
            format={(value) => `10^${value.toFixed(1)}`}
            hint="The compute the allocation is taken at: 6·N·D."
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
          <Slider
            label="The lowest budget in the nest"
            value={decade}
            min={4}
            max={8}
            step={1}
            onChange={setDecade}
            format={(value) => `10^${value.toFixed(0)}`}
            hint="Three curves, two decades apart, so their minima fall on the frontier."
          />
          <Slider
            label="The points per curve"
            value={points}
            min={12}
            max={96}
            step={4}
            onChange={setPoints}
            hint="The resolution of the U, and of the nest."
          />
          {view === 'runout' ? (
            <Slider
              label="The corpus"
              value={uniquePool}
              min={50}
              max={3000}
              step={10}
              onChange={setUniquePool}
              hint="The unique rows that exist. Everything past them is a repeat."
            />
          ) : null}
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat
            label="The optimum at this budget"
            value={`N ${fmt(optimum.capacity, 1)} · D ${fmt(optimum.samples, 1)}`}
            hint="the closed form, not a search"
          />
          <Stat label="The loss there" value={fmt(optimum.loss, 5)} tone="good" />
          <Stat
            label="The frontier exponent"
            value={fmt(gamma, 4)}
            hint={`αβ/(α+β) = ${fmt(fit.alpha, 3)}·${fmt(fit.beta, 3)}/(${fmt(fit.alpha, 3)}+${fmt(fit.beta, 3)})`}
          />
          <Stat
            label="The tokens per parameter"
            value={fmt(optimum.tokensPerParameter, 2)}
            hint="a consequence of the two exponents and the budget"
          />
        </div>

        {view === 'curve' ? (
          <>
            <Figure
              title="One IsoFLOP curve, and its minimum"
              description={`The loss along 6·N·D = ${fmt(budget, 2)}, swept over the capacity in log space. The sample count is pinned by the budget.`}
              caption="Hoffmann et al. trained a family of models along each budget to find this minimum. Here the curve is the measured surface read along the constraint, and the minimum is the derivative rather than the search: N* = (αA/βB)^(1/(α+β))·P^(β/(α+β)), with P the budget divided by six."
            >
              <TrendChart
                data={curve.map((point) => ({ x: Math.log10(point.capacity), loss: point.loss, excess: point.excess }))}
                series={[
                  { key: 'loss', name: 'the loss', colour: 'var(--accent-violet)' },
                  { key: 'excess', name: 'the cost of the allocation', colour: 'var(--accent-rose)', dashed: true },
                ]}
                xLabel="the log of the capacity"
                yLabel="the loss"
                referenceLines={[{ x: Math.log10(optimum.capacity), label: 'the optimum' }]}
                height={280}
              />
            </Figure>

            <Figure
              title="The nest: the same U at three budgets"
              description="Each curve is a fixed compute budget; the minima march down and to the right."
              caption="The minima of these U's, traced across budgets, are themselves a power law in the compute — the frontier, and the next view. The arms of each U are what the naive allocations pay: the loss at the ends of a curve is the same budget spent entirely on parameters or entirely on data."
            >
              <TrendChart
                data={merged}
                series={familySeries}
                xLabel="the log of N/N* — the capacity in units of its own optimum"
                yLabel="the loss"
                height={280}
              />
            </Figure>

            <DataTable
              caption="Each curve in the nest, at its own minimum"
              headers={['The budget', 'The capacity', 'The samples', 'The tokens per parameter', 'The loss', 'The worst allocation at that cost']}
              rows={front.map((point) => [
                fmt(point.budget, 2),
                fmt(point.capacity, 1),
                fmt(point.samples, 1),
                fmt(point.tokensPerParameter, 2),
                fmt(point.loss, 5),
                fmt(point.worstLoss, 5),
              ])}
            />

            <Callout tone="definition" title="Why the exponent is a combination and not a measurement">
              γ = αβ/(α+β) is arithmetic on the two exponents the surface was fitted with, so the frontier is not a
              third fact about the models. Measure α and β on the grid and the compute-optimal law has this slope
              whether or not anybody ran the budgets. The measured slope beside it is the check that the algebra and
              the arithmetic were done to the same surface.
            </Callout>
          </>
        ) : null}

        {view === 'rule' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The ratio’s exponent, measured"
                value={fmt(rule.exponent, 4)}
                hint="the slope of tokens-per-parameter against budget"
              />
              <Stat
                label="The ratio’s exponent, predicted"
                value={fmt(rule.predicted, 4)}
                hint="(α−β)/(α+β), from the same two exponents"
                tone={Math.abs(rule.exponent - rule.predicted) < 1e-6 ? 'good' : 'warn'}
              />
              <Stat
                label="The capacity’s share of a budget"
                value={fmt(allocation.capacity, 4)}
                hint={`β/(α+β); measured on these optima: ${fmt(measured.capacity, 4)}`}
              />
              <Stat
                label="The data’s share of a budget"
                value={fmt(allocation.samples, 4)}
                hint={`α/(α+β); the two shares add to ${fmt(allocation.sum, 6)}`}
              />
            </div>

            <Figure
              title="The tokens-per-parameter ratio against the budget"
              description="The ratio at the optimum of each budget, on log–log axes."
              caption="This is why “twenty tokens per parameter” could look like a constant: the ratio is constant only where α = β, and the exponent of the line above is (α−β)/(α+β). A rule quoted as a number is a claim about the two exponents of the surface it came from, and this surface is not that one."
            >
              <TrendChart
                data={rule.ratioAt.map((row) => ({ x: Math.log10(row.budget), ratio: row.tokensPerParameter }))}
                series={[{ key: 'ratio', name: 'the ratio at the optimum', colour: 'var(--accent-violet)' }]}
                xLabel="the log of the budget"
                yLabel="the tokens per parameter"
                height={280}
              />
            </Figure>

            <Figure
              title="The allocation exponents, two ways"
              description="The closed form, and the slope of the log–log line through the optima the closed form produced."
              caption="The two columns should agree to floating-point precision: one is algebra and the other is arithmetic on the algebra’s output. They are both printed because a disagreement would mean the frontier being quoted is not the frontier being plotted."
            >
              <DataTable
                caption="The budget split between capacity and data"
                headers={['The quantity', 'Predicted', 'Measured', 'The difference']}
                rows={[
                  ['The capacity exponent', fmt(allocation.capacity, 6), fmt(measured.capacity, 6), fmt(allocation.capacity - measured.capacity, 6)],
                  ['The data exponent', fmt(allocation.samples, 6), fmt(measured.samples, 6), fmt(allocation.samples - measured.samples, 6)],
                  ['The sum of the two', fmt(allocation.sum, 6), fmt(measured.capacity + measured.samples, 6), fmt(allocation.sum - (measured.capacity + measured.samples), 6)],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="A ratio is not a rule until the exponents are">
              Read the same way as the twenty-token figure: this surface gives a ratio that moves with the budget, so
              a fixed number of tokens per parameter is wrong at one end of the range and wrong at the other. The
              version worth quoting is the exponent above and the two coefficients it came from, not a constant.
            </Callout>
          </>
        ) : null}

        {view === 'runout' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The budget where the corpus runs out"
                value={fmt(runout, 2)}
                hint={`the compute at which D* first equals ${uniquePool} rows`}
                tone={budget > runout ? 'warn' : 'good'}
              />
              <Stat
                label="The epochs this budget forces"
                value={fmt(constrained.epochs, 2)}
                hint={constrained.binds ? 'the pool binds: the surplus is spent on repeats' : 'the pool does not bind at this budget'}
                tone={constrained.binds ? 'warn' : 'good'}
              />
              <Stat
                label="The price of the constraint"
                value={fmt(constrained.price, 5)}
                hint="the loss over the unconstrained optimum at the same budget"
              />
              <Stat
                label="The ceiling used"
                value={`${fmt(constrained.ceilingUse * 100, 2)}%`}
                hint="of U·(1 + R★), the most a finite pool can ever be worth"
              />
            </div>

            <Figure
              title="The two optima at one budget"
              description="The unconstrained allocation, and the allocation that spends what the corpus cannot cover on repeats of it."
              caption="Below the budget at which D* reaches the corpus the two are the same run. Above it the tokens the frontier wants do not exist, so the extra compute buys passes over the same rows, and the effective-data law of screen F decides what those passes are worth. The gap between the two losses is the price of a finite corpus, and it grows with the budget."
            >
              <DataTable
                caption="The same budget, spent two ways"
                headers={['The allocation', 'The capacity', 'The tokens read', 'The passes over the pool', 'The data counted', 'The loss']}
                rows={[
                  [
                    'the unconstrained optimum, if the pool were infinite',
                    fmt(constrained.unconstrained.capacity, 1),
                    fmt(constrained.unconstrained.samples, 1),
                    fmt(constrained.unconstrained.samples / uniquePool, 2),
                    fmt(constrained.unconstrained.samples, 1),
                    fmt(constrained.unconstrained.loss, 5),
                  ],
                  [
                    'the optimum against the pool',
                    fmt(constrained.capacity, 1),
                    fmt(constrained.tokens, 1),
                    fmt(constrained.epochs, 2),
                    fmt(constrained.effectiveData, 1),
                    fmt(constrained.loss, 5),
                  ],
                ]}
              />
            </Figure>

            <Figure
              title="What the constraint costs, budget by budget"
              description="The same pair of optima at each of the nest’s budgets."
              caption="The price is zero while the corpus covers the frontier’s appetite and rises once it does not. Where it starts is the number the first stat reports, and it is a property of the fitted exponents and the pool together — the reason a data-limited regime is a boundary you can compute rather than one you discover afterwards."
            >
              <DataTable
                caption="The optima at each budget, against the same pool"
                headers={['The budget', 'The unconstrained D*', 'The epochs it implies', 'The constrained loss', 'The price']}
                rows={budgets.map((budgetValue) => {
                  const point = constrainedOptimum(fit, budgetValue, uniquePool)
                  return [
                    fmt(budgetValue, 2),
                    fmt(point.unconstrained.samples, 1),
                    fmt(point.unconstrained.samples / uniquePool, 2),
                    fmt(point.loss, 5),
                    fmt(point.price, 5),
                  ]
                })}
              />
            </Figure>

            <Callout tone="note" title="Read these numbers inside the grid they came from">
              The optimum at this budget sits at a capacity of {fmt(optimum.capacity, 1)} and a sample count of{' '}
              {fmt(optimum.samples, 1)}, against a surface fitted on capacities {range.capacity[0]}–{range.capacity[1]}{' '}
              and sample counts {range.samples[0]}–{range.samples[1]}.{' '}
              {fitted.extrapolates
                ? 'At least one of those is outside the grid, so the allocation quoted is an extrapolation of the measurement rather than a reading of it.'
                : 'Both are inside the grid, so the allocation is an interpolation of the measurement.'}
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}

const COLOURS = ['var(--accent-violet)', 'var(--accent-teal)', 'var(--accent-amber)', 'var(--accent-rose)', 'var(--accent-sky)']
