import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  benchmarkMetrics,
  buildPruningPool,
  cliffEdge,
  curationExponent,
  informationSpread,
  METRIC_DESCRIPTIONS,
  metricScores,
  nonRareShare,
  percolationThreshold,
  predictThreshold,
  PRUNING_METRICS,
  pruningCurve,
  volumeLaw,
  type MetricName,
} from '../../core/percolation'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { PERCOLATION_DEFAULTS } from '../../content/labDefaults'

type View = 'threshold' | 'benchmark' | 'predict'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const PERCOLATION_VIEWS: { value: View; label: string }[] = [
  { value: 'threshold', label: 'The cliff' },
  { value: 'benchmark', label: 'The four metrics' },
  { value: 'predict', label: 'The prediction' },
]

const METRIC_OPTIONS: { value: MetricName; label: string }[] = PRUNING_METRICS.map((metric) => ({
  value: metric,
  label: metric,
}))

const fractionText = (value: number | null) => (value === null ? 'none' : fmt(value, 3))

export function PercolationLab() {
  const [view, setView] = useViewParam(PERCOLATION_VIEWS)
  const [metric, setMetric] = useState<MetricName>(PERCOLATION_DEFAULTS.metric)
  const [rareFraction, setRareFraction] = useState(PERCOLATION_DEFAULTS.rareFraction)
  const [noiseCoupling, setNoiseCoupling] = useState(PERCOLATION_DEFAULTS.noiseCoupling)
  const [metricNoise, setMetricNoise] = useState(PERCOLATION_DEFAULTS.metricNoise)
  const [keep, setKeep] = useState(PERCOLATION_DEFAULTS.keep)
  const [seed, setSeed] = useState(PERCOLATION_DEFAULTS.seed)

  const pool = useMemo(() => buildPruningPool({ rareFraction, noiseCoupling, seed }), [rareFraction, noiseCoupling, seed])

  const scores = useMemo(() => metricScores(pool, metric, { noise: metricNoise }), [pool, metric, metricNoise])
  const curve = useMemo(() => pruningCurve(pool, scores), [pool, scores])
  const reading = useMemo(() => percolationThreshold(curve), [curve])
  const edge = useMemo(() => cliffEdge(curve), [curve])
  const composition = useMemo(() => ({ rare: pool.group.filter((label) => label === 'rare').length, bulk: pool.group.filter((label) => label === 'bulk').length }), [pool])
  const atKeep = useMemo(() => {
    const nearest = curve.reduce((acc, point) => (Math.abs(point.fraction - keep) < Math.abs(acc.fraction - keep) ? point : acc), curve[0]!)
    return nearest
  }, [curve, keep])

  const benchmarks = useMemo(() => benchmarkMetrics(pool, { noise: metricNoise }), [pool, metricNoise])
  const spread = useMemo(() => informationSpread(pool), [pool])
  const prediction = useMemo(() => predictThreshold(pool, { metricNoise }), [pool, metricNoise])
  const laws = useMemo(() => curationExponent(pool, metric, { noise: metricNoise }), [pool, metric, metricNoise])
  const volume = useMemo(() => volumeLaw(pool), [pool])

  return (
    <div className="lab">
      <Panel
        title="Laboratory D · The percolation threshold"
        subtitle="Pruning a pool by four metrics, and the cliff each one breaks at"
        accent="sky"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={PERCOLATION_VIEWS}
          />
          <SegmentedControl
            label="The metric"
            value={metric}
            onChange={setMetric}
            options={METRIC_OPTIONS}
          />
          <Slider
            label="The rare share of the pool"
            value={rareFraction}
            min={0.03}
            max={0.3}
            step={0.01}
            onChange={(value) => setRareFraction(value)}
            format={(value) => `${(value * 100).toFixed(0)}%`}
            hint="The rows that carry a tail direction. Below one per direction, some directions are covered by a single row."
          />
          <Slider
            label="How much the inputs show of the noise"
            value={noiseCoupling}
            min={0}
            max={1}
            step={0.05}
            onChange={setNoiseCoupling}
            format={(value) => value.toFixed(2)}
            hint="One is a world where a small row is an unreliable row and the norm is a good metric. Zero is one where it sees only half."
          />
          <Slider
            label="The metric’s own error"
            value={metricNoise}
            min={0}
            max={4}
            step={0.1}
            onChange={setMetricNoise}
            format={(value) => value.toFixed(1)}
            hint="Noise added to the log score — the knob the threshold sweep is run on."
          />
          {view === 'threshold' ? (
            <Slider
              label="The keep fraction to inspect"
              value={keep}
              min={0.03}
              max={1}
              step={0.01}
              onChange={setKeep}
              format={(value) => `${(value * 100).toFixed(0)}%`}
            />
          ) : null}
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat
            label="The threshold"
            value={fractionText(reading.threshold)}
            hint="the smallest keep fraction that still costs nothing"
            tone={reading.threshold === null ? 'warn' : 'good'}
          />
          <Stat
            label="The best fraction"
            value={fractionText(reading.bestFraction)}
            hint={`a loss of ${fmt(reading.bestLoss, 5)}, ${fmt(reading.maxGain, 5)} under the whole pool`}
          />
          <Stat
            label="The cliff edge"
            value={fractionText(edge)}
            hint="the smallest fraction still within twice the best loss"
          />
          <Stat
            label="The rare rows kept there"
            value={`${atKeep.rareKept} of ${composition.rare}`}
            hint={`at ${fmt(atKeep.fraction * 100, 0)}% kept: ${atKeep.tailCovered} of ${pool.tailDims.length} tail directions covered`}
          />
        </div>

        {view === 'threshold' ? (
          <>
            <Figure
              title="The loss as the pool shrinks"
              description={`Every point is a ridge fit on the ${metric} ranking’s top fraction of the pool, measured on the same held-out set. The dashed curve is a random subset of the same size.`}
              caption="Sorscher, Geirhos, Shekhar, Ganguli and Morcos’s figure has this shape: a steep descent, a knee, and a cliff. The descent is the redundant bulk going; the cliff is the rare rows going, which is where the tail directions stop being covered and the model loses parts of the task it could only learn from a handful of rows."
            >
              <TrendChart
                data={curve.map((point) => ({
                  x: point.fraction,
                  curated: point.loss,
                  random: point.randomLoss,
                }))}
                series={[
                  { key: 'curated', name: `pruned by ${metric}`, colour: 'var(--accent-sky)' },
                  { key: 'random', name: 'a random subset', colour: 'var(--accent-rose)', dashed: true },
                ]}
                xLabel="the share of the pool kept"
                yLabel="the held-out loss"
                referenceLines={[
                  ...(reading.threshold === null ? [] : [{ x: reading.threshold, label: 'the threshold' }]),
                  ...(edge === null ? [] : [{ x: edge, label: 'the cliff edge' }]),
                ]}
                height={280}
              />
            </Figure>

            <Figure
              title="What the metric is buying at each fraction"
              description="The excess over a random subset of the same size, and the rare rows still present."
              caption="The excess column is the whole claim of the paper — that a good metric beats the power law of volume rather than sitting beside it — and it is measured here against a random subset of exactly the same size, fitted by exactly the same learner."
            >
              <DataTable
                caption="The pruning curve, point by point"
                headers={['Kept', 'Rows', 'The loss', 'A random subset', 'The excess', 'Rare kept', 'Tail directions covered', 'The least-covered one']}
                rows={curve.map((point) => [
                  `${fmt(point.fraction * 100, 0)}%`,
                  point.kept,
                  fmt(point.loss, 5),
                  fmt(point.randomLoss, 5),
                  fmt(point.excessOverRandom, 5),
                  point.rareKept,
                  `${point.tailCovered} of ${pool.tailDims.length}`,
                  `${point.rarestTailDim} rows`,
                ])}
              />
            </Figure>

            <Callout tone="note" title={`What “${metric}” computes`}>
              {METRIC_DESCRIPTIONS[metric]}. The curve above is this metric’s queue, and the threshold is a property
              of the queue rather than of the pool.
            </Callout>

            <Callout tone="definition" title="Why the four metrics have different cliffs">
              The information a row carries is ‖x‖²/σ², and the bulk’s rows differ in both halves of that product. A
              norm-based ranking sees the amplitude and not the noise, so it puts the rare rows — moderate in norm,
              exceptionally clean — in the middle of the queue and loses them halfway down. A residual-based ranking
              sees both and keeps them to the end. The slider called “how much the inputs show of the noise” is
              exactly the distance between those two worlds, and at one the norm becomes a good metric.
            </Callout>
          </>
        ) : null}

        {view === 'benchmark' ? (
          <>
            <Figure
              title="The four metrics, each at its own best"
              description="The oracle is the true information per row and cannot be computed; strong needs labels and a trained model; weak is the row norm; random is a seeded shuffle."
              caption="The paper’s ordering is strong beats weak, weak beats random, and each has its own threshold. That is the claim under test, and the table is the test: the columns are measured on this pool with this seed, and a rank of 1 is the lowest loss of the four."
            >
              <DataTable
                caption="Each metric at the fraction where it is best"
                headers={['Rank', 'Metric', 'Best loss', 'Kept', 'The threshold', 'Over a random subset of that size', 'Over a random subset of matched compute', 'The metric’s own cost']}
                rows={benchmarks.map((row) => [
                  row.rank,
                  row.metric,
                  fmt(row.bestLoss, 5),
                  `${fmt(row.bestFraction * 100, 0)}% (${row.bestKept} rows)`,
                  fractionText(row.threshold),
                  fmt(row.excessOverRandom, 5),
                  fmt(row.gainAtMatchedCompute, 5),
                  row.metricCostRows === 0 ? 'nothing' : `${row.metricCostRows} rows`,
                ])}
              />
            </Figure>

            <Callout tone="warning" title="Matched volume is not matched compute">
              The seventh column is the honest comparison: a random baseline handed as many extra rows as the metric
              itself had to chew through. Strong scaling fits a model over the whole pool before it can score a single
              row, so the baseline gets a whole pool’s worth of extra rows in exchange. A metric that wins on volume
              and loses on compute is a metric that should not be used, and that is what the column is for.
            </Callout>

            <Figure
              title="The law of volume, and the curated descent beside it"
              description="The exponent of the random subsampling curve, and the exponent of the improving stretch of the curated one."
              caption={`Volume alone gives L ∝ D^(−α) with α = ${fmt(laws.volume.alpha, 4)} and an R² of ${fmt(laws.volume.r2, 4)}. Beating that law means a steeper descent, and the ratio of the two exponents is by how much: ${laws.curated === null ? 'the curated curve has too few improving points to fit at all' : `×${fmt(laws.ratio, 2)} steeper`}.`}
            >
              <DataTable
                caption="Two power laws fitted to one pool"
                headers={['The curve', 'The exponent', 'The coefficient', 'The R²', 'The rows it was fitted on']}
                rows={[
                  ['random subsampling', fmt(laws.volume.alpha, 4), fmt(laws.volume.coefficient, 4), fmt(laws.volume.r2, 4), `${volume.points.length}`],
                  [
                    `pruned by ${metric}`,
                    laws.curated === null ? 'no fit' : fmt(laws.curated.alpha, 4),
                    laws.curated === null ? 'no fit' : fmt(laws.curated.coefficient, 4),
                    laws.curated === null ? 'no fit' : fmt(laws.curated.r2, 4),
                    laws.curated === null ? '—' : `${laws.curated.predictions.length}`,
                  ],
                ]}
              />
            </Figure>
          </>
        ) : null}

        {view === 'predict' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The predicted threshold"
                value={fractionText(prediction.fraction)}
                hint={`the smallest fraction keeping ${prediction.required} rare rows`}
                tone={prediction.fraction === null ? 'warn' : 'good'}
              />
              <Stat
                label="The rare rows in the pool"
                value={String(prediction.rareRows)}
                hint={`${prediction.required} needed: ${pool.tailDims.length} tail directions × 3`}
              />
              <Stat
                label="The separation the metric must bridge"
                value={`${fmt(spread.separation, 2)} nats`}
                hint={`the rare rows’ mean log information over the bulk’s; the metric’s error is ${fmt(metricNoise, 1)}`}
              />
              <Stat
                label="The information spread"
                value={`${fmt(spread.rest, 2)} within the bulk`}
                hint={`${fmt(spread.rare, 2)} within the rare group`}
              />
            </div>

            <Figure
              title="How many rare rows survive the cut"
              description="The expected count of rare rows left at each keep fraction, against the coverage the tail directions need."
              caption="The prediction has no free parameter: it is the survival of the rare group under a cut the metric applies with its own error added to the log information. Where the curve falls under the requirement is the threshold, and the measured cliff on the first view is the same event seen from the loss side."
            >
              <TrendChart
                data={prediction.survival.map((row) => ({ x: row.fraction, expected: row.expectedRareKept }))}
                series={[{ key: 'expected', name: 'the rare rows surviving', colour: 'var(--accent-violet)' }]}
                xLabel="the share of the pool kept"
                yLabel="the rare rows expected"
                referenceLines={[
                  { y: prediction.required, label: `the tail needs ${prediction.required}` },
                  ...(prediction.fraction === null ? [] : [{ x: prediction.fraction, label: 'the predicted threshold' }]),
                ]}
                height={280}
              />
            </Figure>

            <Figure
              title="The threshold, as the metric degrades"
              description="The predicted fraction and the measured one, at each value of the metric’s error."
              caption="Three readings of the same expression, and the tests check all three: as the error goes to zero the prediction collapses to the share of the pool that outranks the rarest rare row; as it grows past the information spread the survival of a rare row becomes the keep fraction itself, the answer goes to one, and there is nothing left to prune."
            >
              <DataTable
                caption="Prediction and measurement, by the metric’s error"
                headers={['The error on the log score', 'The predicted threshold', 'The measured threshold', 'The best fraction', 'The gain there']}
                rows={[0, 0.5, 1, 2, 3, 4].map((error) => {
                  const predicted = predictThreshold(pool, { metricNoise: error })
                  const degraded = metricScores(pool, metric, { noise: error })
                  const measured = percolationThreshold(pruningCurve(pool, degraded))
                  return [
                    fmt(error, 1),
                    fractionText(predicted.fraction),
                    fractionText(measured.threshold),
                    fractionText(measured.bestFraction),
                    fmt(measured.maxGain, 5),
                  ]
                })}
              />
            </Figure>

            <Callout tone="note" title="What the oracle is for">
              The prediction is made against the pool’s true information, which no practitioner has: it is the
              ceiling the computable metrics are scored against, and the reason the ranking a metric produces can be
              compared with the ranking that was available. The non-rare share of the pool —{' '}
              {fmt(nonRareShare(pool) * 100, 1)}% here — is where a norm-based metric’s cliff sits, because that is
              the point at which the rows it can rank well have gone.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
