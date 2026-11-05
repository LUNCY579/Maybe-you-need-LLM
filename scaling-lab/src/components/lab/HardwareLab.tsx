import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  budgetForTargetLoss,
  budgetForTargetLossBySearch,
  capabilityAt,
  computeSeries,
  detectBreaks,
  eraReadings,
  feasibilityOfTarget,
  hardwareSeries,
  lossImpliedByTrend,
  lossReachableInYear,
  logLinearTrend,
  MOORE_DOUBLING_MONTHS,
  monthsFromOomPerYear,
  oomPerYearFromDoublingMonths,
  PAPER_ERAS,
  runCompute,
} from '../../core/hardware'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { HARDWARE_DEFAULTS } from '../../content/labDefaults'
import { useTrainingSurface } from './surfaceFixture'

type View = 'eras' | 'trend' | 'feasible'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const HARDWARE_VIEWS: { value: View; label: string }[] = [
  { value: 'eras', label: 'The eras' },
  { value: 'trend', label: 'The break' },
  { value: 'feasible', label: 'The year it was buyable' },
]

/** A doubling time is undefined when the slope is zero, and the screen says so. */
const monthsText = (value: number) => (Number.isFinite(value) ? `${fmt(value, 1)} months` : 'never')

export function HardwareLab() {
  const [view, setView] = useViewParam(HARDWARE_VIEWS)
  const [decay, setDecay] = useState(HARDWARE_DEFAULTS.decay)
  const [noise, setNoise] = useState(HARDWARE_DEFAULTS.noise)
  const [seed, setSeed] = useState(HARDWARE_DEFAULTS.seed)
  const [eraIndex, setEraIndex] = useState(HARDWARE_DEFAULTS.era)
  const [pointsPerEra, setPointsPerEra] = useState(HARDWARE_DEFAULTS.pointsPerEra)
  const [hours, setHours] = useState(HARDWARE_DEFAULTS.hours)
  const [targetLoss, setTargetLoss] = useState(HARDWARE_DEFAULTS.targetLoss)
  const [perUnit, setPerUnit] = useState(HARDWARE_DEFAULTS.flopsPerBudgetUnit)
  const [breakYear, setBreakYear] = useState(HARDWARE_DEFAULTS.breakYear)
  const [beforeMonths, setBeforeMonths] = useState(HARDWARE_DEFAULTS.beforeDoublingMonths)
  const [afterMonths, setAfterMonths] = useState(HARDWARE_DEFAULTS.afterDoublingMonths)

  const { fit } = useTrainingSurface({ decay, noise, seed })

  const era = PAPER_ERAS[eraIndex] ?? PAPER_ERAS[1]!
  const readings = useMemo(() => eraReadings(era), [era])
  const landmark = useMemo(() => computeSeries({ era: eraIndex, pointsPerEra }), [eraIndex, pointsPerEra])
  const landmarkTrend = useMemo(() => logLinearTrend(landmark), [landmark])

  const hardware = useMemo(
    () =>
      hardwareSeries({
        breakYear,
        beforeDoublingMonths: beforeMonths,
        afterDoublingMonths: afterMonths,
      }),
    [breakYear, beforeMonths, afterMonths],
  )
  const wholeTrend = useMemo(() => logLinearTrend(hardware), [hardware])
  const breakFit = useMemo(() => detectBreaks(hardware, { minPoints: 5, penalty: 2 }), [hardware])
  const beforeTrend = useMemo(
    () => logLinearTrend(hardware.filter((point) => point.year <= breakYear)),
    [hardware, breakYear],
  )
  const afterTrend = useMemo(
    () => logLinearTrend(hardware.filter((point) => point.year >= breakYear)),
    [hardware, breakYear],
  )

  // A loss at or below the surface’s floor cannot be bought at any price, and the
  // function that inverts the frontier says so by throwing. The screen reports that
  // rather than moving the slider’s bounds, because the floor is measured and moves
  // with the task.
  const buyable = targetLoss > fit.E
  const requirement = useMemo(
    () => (buyable ? budgetForTargetLoss(fit, targetLoss) : null),
    [buyable, fit, targetLoss],
  )
  const searched = useMemo(
    () => (buyable ? budgetForTargetLossBySearch(fit, targetLoss) : null),
    [buyable, fit, targetLoss],
  )
  const feasible = useMemo(
    () => (buyable ? feasibilityOfTarget(fit, hardware, targetLoss, { hours, flopsPerBudgetUnit: perUnit }) : null),
    [buyable, fit, hardware, targetLoss, hours, perUnit],
  )
  const implied = useMemo(() => lossImpliedByTrend(fit, wholeTrend.oomPerYear), [fit, wholeTrend])
  const today = useMemo(
    () => lossReachableInYear(fit, hardware, hardware[hardware.length - 1]!.year, { hours, flopsPerBudgetUnit: perUnit }),
    [fit, hardware, hours, perUnit],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory H · Hardware and the eras"
        subtitle="A trend in FLOPs, the break inside it, and what a loss costs to reach"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={HARDWARE_VIEWS}
          />
          {view === 'eras' ? (
            <>
              <SegmentedControl
                label="The era"
                value={String(eraIndex)}
                onChange={(value) => setEraIndex(Number(value))}
                options={PAPER_ERAS.map((entry, index) => ({ value: String(index), label: entry.era }))}
              />
              <Slider
                label="The landmark runs listed"
                value={pointsPerEra}
                min={3}
                max={16}
                onChange={setPointsPerEra}
                hint="Points marching geometrically across the era’s quoted range."
              />
            </>
          ) : null}
          {view === 'trend' ? (
            <>
              <Slider
                label="The break year"
                value={breakYear}
                min={1975}
                max={2015}
                onChange={setBreakYear}
                hint="Planted, so that the detection has a known answer to be checked against."
              />
              <Slider
                label="Before: months per doubling"
                value={beforeMonths}
                min={6}
                max={48}
                onChange={setBeforeMonths}
                format={monthsText}
              />
              <Slider
                label="After: months per doubling"
                value={afterMonths}
                min={6}
                max={120}
                onChange={setAfterMonths}
                format={monthsText}
              />
            </>
          ) : null}
          {view === 'feasible' ? (
            <>
              <Slider
                label="The target loss"
                value={targetLoss}
                min={0.02}
                max={2}
                step={0.01}
                onChange={setTargetLoss}
                format={(value) => value.toFixed(3)}
                hint={`The fitted floor of this surface is ${fmt(fit.E, 4)}; nothing below it is purchasable.`}
              />
              <Slider
                label="The wall-clock of a run"
                value={Math.log10(hours)}
                min={0}
                max={4}
                step={0.1}
                onChange={(value) => setHours(10 ** value)}
                format={(value) => `${fmt(10 ** value, 1)} hours`}
              />
              <Slider
                label="The bridge to FLOPs"
                value={Math.log10(perUnit)}
                min={0}
                max={12}
                step={0.5}
                onChange={(value) => setPerUnit(10 ** value)}
                format={(value) => `×10^${value.toFixed(1)}`}
                hint="How many FLOPs one unit of the surface’s budget is worth. Every year on this screen depends on it."
              />
            </>
          ) : null}
          <Slider
            label="The noise of the task behind the surface"
            value={noise}
            min={0.005}
            max={0.4}
            step={0.005}
            onChange={setNoise}
            format={(value) => value.toFixed(3)}
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
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        {view === 'eras' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The paper’s slope"
                value={`${fmt(era.oomPerYear, 2)} OOM/yr`}
                hint={`doubling every ${fmt(era.doublingMonths, 1)} months, over ${era.runs} runs — both quoted`}
              />
              <Stat
                label="What the slope implies"
                value={monthsText(monthsFromOomPerYear(era.oomPerYear))}
                hint="the same figure, converted: the two reported numbers must agree"
              />
              <Stat
                label="What the range implies"
                value={`${fmt(readings.fromRange, 3)} OOM/yr`}
                hint={`the ${fmt(readings.spanOom, 1)}-decade range over ${fmt(readings.years, 1)} years`}
                tone="warn"
              />
              <Stat
                label="Range over slope"
                value={`×${fmt(readings.rangeOverSlope, 2)}`}
                hint="a trend and an envelope are different quantities"
              />
            </div>

            <Figure
              title="The three readings of one era"
              description="The slope as reported, the slope the reported doubling time implies, and the slope the reported range and years imply."
              caption="The first two are the same number twice, so any gap between them is the paper rounding two separate fits — and the conversion is exact: ln 2 divided by the months, times twelve, in base ten. The third is a different quantity: a range is the distance between the two most extreme models and a slope is the middle of a scattered set, so reading one as the other is where a headline growth rate comes from."
            >
              <DataTable
                caption={`The ${era.era} era, ${era.from} to ${era.to}`}
                headers={['The reading', 'OOMs per year', 'The doubling time', 'What it is']}
                rows={[
                  ['the reported slope', fmt(readings.fromSlope, 4), monthsText(era.doublingMonths), 'what the paper states'],
                  ['the reported doubling time', fmt(readings.fromDoubling, 4), monthsText(readings.fromDoubling === era.oomPerYear ? era.doublingMonths : monthsFromOomPerYear(readings.fromDoubling)), 'the same statement, converted'],
                  ['the reported range', fmt(readings.fromRange, 4), monthsText(readings.monthsFromRange), 'the envelope of the two extreme runs'],
                  ['the landmark fits on this fixture', fmt(landmarkTrend.oomPerYear, 4), monthsText(landmarkTrend.doublingMonths), `a log-linear trend over ${landmarkTrend.points} synthetic runs`],
                ]}
              />
            </Figure>

            <Figure
              title="The fixture the readings are taken on"
              description="Landmark training runs marching geometrically across the era’s quoted range, on log axes."
              caption="Nothing here is a measurement of a real model: the points are planted between the range the paper states, which is the only part of this that is quoted. The trend line is then fitted to them, and its slope disagrees with the paper’s for exactly the reason the table gives — this fixture has no scatter, so its envelope and its trend coincide, whereas a real era’s do not."
            >
              <TrendChart
                data={landmark.map((point) => ({ x: point.year, log: Math.log10(point.value) }))}
                series={[{ key: 'log', name: 'the log of the FLOPs', colour: 'var(--accent-indigo)' }]}
                xLabel="the year"
                yLabel="log₁₀ FLOPs"
                height={280}
              />
            </Figure>

            <Callout tone="definition" title="Moore’s law, as a rate rather than a slogan">
              The paper’s pre-deep-learning benchmark is transistor density doubling about every{' '}
              {fmt(MOORE_DOUBLING_MONTHS, 0)} months, which is {fmt(oomPerYearFromDoublingMonths(MOORE_DOUBLING_MONTHS), 3)}{' '}
              orders of magnitude a year. Every number on this screen is compared against that: a trend that is faster
              than two years per doubling is not a hardware trend, it is a spending trend, and the two have different
              futures.
            </Callout>
          </>
        ) : null}

        {view === 'trend' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The break detected"
                value={breakFit === null ? 'none found' : `about ${fmt(breakFit.year, 1)}`}
                hint={`planted at ${breakYear}`}
                tone={breakFit === null ? 'warn' : 'good'}
              />
              <Stat
                label="The slope before"
                value={`${fmt(breakFit?.before.oomPerYear ?? beforeTrend.oomPerYear, 3)} OOM/yr`}
                hint={`planted as a ${monthsText(beforeMonths)} doubling`}
              />
              <Stat
                label="The slope after"
                value={`${fmt(breakFit?.after.oomPerYear ?? afterTrend.oomPerYear, 3)} OOM/yr`}
                hint={`planted as a ${monthsText(afterMonths)} doubling`}
              />
              <Stat
                label="One trend over the whole"
                value={`${fmt(wholeTrend.oomPerYear, 3)} OOM/yr`}
                hint={`and an R² of ${fmt(wholeTrend.r2, 4)} — the average hides the change`}
                tone="warn"
              />
            </div>

            <Figure
              title="A trend with a break in it"
              description="Hardware capability, one slope until the planted year and a slower one after."
              caption="The detection tries every split, fits both sides, and keeps the smallest residual sum of squares once the split has paid its penalty — two log n, the Bayesian price of the two extra parameters. The requirement that the two slopes differ is what stops a perfectly straight series from reporting a break wherever floating-point noise prefers one."
            >
              <TrendChart
                data={hardware.map((point) => ({ x: point.year, log: Math.log10(point.value) }))}
                series={[{ key: 'log', name: 'the log of FLOPs per second', colour: 'var(--accent-indigo)' }]}
                xLabel="the year"
                yLabel="log₁₀ FLOP/s"
                referenceLines={[
                  { x: breakYear, label: `planted at ${breakYear}` },
                  ...(breakFit === null ? [] : [{ x: breakFit.year, label: 'detected' }]),
                ]}
                height={280}
              />
            </Figure>

            <Figure
              title="What one trend would have said"
              description="The single fit, the two-piece fit, and the improvement the split buys."
              caption="A break is a claim about the future of a trend, so it has to earn its keep: the improvement column is the residual the split removes, and the BIC delta is what it costs. Where the two slopes are close, no penalty is small enough to justify the split, and the honest answer is one straight line."
            >
              <DataTable
                caption="One trend against two"
                headers={['The reading', 'OOMs per year', 'The doubling time', 'The R²', 'The points']}
                rows={[
                  ['the whole series', fmt(wholeTrend.oomPerYear, 4), monthsText(wholeTrend.doublingMonths), fmt(wholeTrend.r2, 4), wholeTrend.points],
                  [
                    breakFit === null ? 'no split found' : `before ${fmt(breakFit.year, 0)}`,
                    breakFit === null ? '—' : fmt(breakFit.before.oomPerYear, 4),
                    breakFit === null ? '—' : monthsText(breakFit.before.doublingMonths),
                    breakFit === null ? '—' : fmt(breakFit.before.r2, 4),
                    breakFit === null ? '—' : breakFit.before.points,
                  ],
                  [
                    breakFit === null ? 'no split found' : `after ${fmt(breakFit.year, 0)}`,
                    breakFit === null ? '—' : fmt(breakFit.after.oomPerYear, 4),
                    breakFit === null ? '—' : monthsText(breakFit.after.doublingMonths),
                    breakFit === null ? '—' : fmt(breakFit.after.r2, 4),
                    breakFit === null ? '—' : breakFit.after.points,
                  ],
                ]}
              />
              <DataTable
                caption="The split, and what it earns"
                headers={['The quantity', 'Its value', 'What it means']}
                rows={[
                  [
                    'the residual the split removes',
                    breakFit === null ? '—' : fmt(breakFit.improvement, 6),
                    'the whole-series sum of squares, net of the penalty',
                  ],
                  [
                    'the BIC the split earns',
                    breakFit === null ? '—' : fmt(breakFit.bicDelta, 4),
                    'positive is a break worth naming',
                  ],
                  ['the penalty charged', fmt(2 * Math.log(hardware.length), 4), 'two extra parameters at log n each'],
                  [
                    'the points in the series',
                    hardware.length,
                    `${hardware[0]!.year} to ${hardware[hardware.length - 1]!.year}`,
                  ],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="This fixture is planted, and that is the point">
              The break year and the two doubling periods are inputs, so the detection has a known answer to be
              checked against — which is what makes it a test rather than an illustration. No real accelerator trend is
              being asserted here; the arithmetic of finding a change of slope in a log-linear series is.
            </Callout>
          </>
        ) : null}

        {view === 'feasible' ? (
          buyable && requirement && feasible ? (
            <>
              <div className="stat-row">
                <Stat
                  label="The budget the target costs"
                  value={fmt(requirement.budget, 2)}
                  hint={`the closed form; a bisection says ${fmt(searched ?? 0, 2)}`}
                />
                <Stat
                  label="The allocation there"
                  value={`N ${fmt(requirement.capacity, 1)} · D ${fmt(requirement.samples, 1)}`}
                  hint="the frontier’s optimum at that budget"
                />
                <Stat
                  label="The year it becomes buyable"
                  value={fmt(feasible.year, 1)}
                  hint={
                    feasible.beyond === null
                      ? `inside the series, at ${fmt(feasible.flopPerSecond, 2)} FLOP/s`
                      : `a projection past the ${feasible.beyond === 'start' ? 'beginning' : 'end'} of the series`
                  }
                  tone={feasible.beyond === null ? 'good' : 'warn'}
                />
                <Stat
                  label="The best loss today"
                  value={fmt(today.loss, 5)}
                  hint={`at ${fmt(today.budget, 2)} of budget, with the run’s ${fmt(hours, 0)} hours`}
                />
              </div>

              <Figure
                title="The chain, in one row"
                description="A loss target, the compute it costs at the optimal allocation, the rate the hardware series must reach, and the year it does."
                caption="Each arrow is a function with its own test: the frontier inverted for the budget, the budget divided by the wall-clock for the required rate, and the series interpolated for the year. The last is the one a reader should distrust, and `beyond` is the flag that says whether the answer was read inside the measured years or projected outside them."
              >
                <DataTable
                  caption="From a loss to a year"
                  headers={['The step', 'The quantity', 'The value', 'Where it comes from']}
                  rows={[
                    ['1', 'the target loss', fmt(targetLoss, 5), 'the slider'],
                    ['2', 'the budget at the optimum', fmt(requirement.budget, 3), 'the frontier inverted'],
                    ['3', 'the capacity and tokens', `${fmt(requirement.capacity, 1)} · ${fmt(requirement.samples, 1)}`, 'analyticOptimum at that budget'],
                    ['4', 'the FLOPs that costs', fmt(requirement.budget * perUnit, 3), `× the ${fmt(perUnit, 2)} bridge`],
                    ['5', 'the rate needed in the run', fmt(feasible.flopPerSecond, 3), `over ${fmt(hours, 0)} hours = ${fmt(runCompute(feasible.flopPerSecond, hours), 3)} FLOPs`],
                    ['6', 'the year', fmt(feasible.year, 2), feasible.beyond === null ? 'interpolated in the series' : 'projected outside the series'],
                    ['7', 'the capability at that year', fmt(capabilityAt(hardware, feasible.year), 3), 'read back off the series as a check'],
                  ]}
                />
              </Figure>

              <Figure
                title="A trend in FLOPs turned into a trend in loss"
                description={`The frontier falls as C^(−γ) with γ = ${fmt(implied.gamma, 4)}, so a slope of ${fmt(wholeTrend.oomPerYear, 3)} OOMs a year becomes a loss factor of ${fmt(implied.lossFactorPerYear, 4)} a year.`}
                caption="This is the only place in this app where a hardware number becomes a capability number, and it is arithmetic on the frontier’s exponent rather than a measurement: ten times better loss takes the years in the fourth stat, and every one of them assumes the budget keeps growing at the fitted rate and that the surface keeps holding."
              >
                <DataTable
                  caption="What the trend buys"
                  headers={['The quantity', 'The value', 'What it means']}
                  rows={[
                    ['the frontier exponent γ', fmt(implied.gamma, 4), 'αβ/(α+β), from the fitted surface'],
                    ['the hardware slope', `${fmt(wholeTrend.oomPerYear, 4)} OOM/yr`, 'the single trend over the whole fixture'],
                    ['the loss factor per year', fmt(implied.lossFactorPerYear, 4), 'what one year of the trend buys'],
                    ['years for a ten-times better loss', fmt(implied.yearsForTenTimesBetter, 2), 'the same figure as a doubling time'],
                    ['today’s reachable loss', fmt(today.loss, 5), `at ${today.year}, one month of a run`],
                  ]}
                />
              </Figure>

              <Callout tone="note" title="Every year on this screen hangs on the bridge">
                The surface’s budget is in the units of its own training runs and the series is in FLOP/s, so the
                factor between them is an assumption, not a measurement. Halving it moves every date by a predictable
                amount and changes no shape — which is the honest way to read a claim of the form “X will be
                affordable in 20YY”.
              </Callout>
            </>
          ) : (
            <Callout tone="warning" title="That loss cannot be bought at any price">
              The fitted surface has a floor of E = {fmt(fit.E, 5)}: the irreducible loss of the task, which no amount
              of compute reaches below. The target here is {fmt(targetLoss, 5)}, at or under it, so the inversion has
              no answer and the screen reports that rather than a very large budget. Raising the target above the
              floor gives the whole chain back.
            </Callout>
          )
        ) : null}
      </Panel>
    </div>
  )
}
