import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  NF4_CODEBOOK,
  activationsWithOutlier,
  blockedNormalFloatError,
  dotProducts,
  gaussianMatrix,
  groupedQuantisation,
  normalFloatError,
  outlierChannels,
  perChannelQuantisation,
  perTensorQuantisation,
  relativeDifference,
  smoothActivations,
  smoothQuant,
  smoothQuantSweep,
  smoothScales,
  smoothWeights,
  unsmoothedError,
} from '../../core/quantisation'
import type { Matrix } from '../../core/attention'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { QUANTISATION_DEFAULTS } from '../../content/labDefaults'

type View = 'grid' | 'migration' | 'codebook'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const QUANTISATION_VIEWS: { value: View; label: string }[] = [
  { value: 'grid', label: 'The grid' },
  { value: 'migration', label: 'The migration' },
  { value: 'codebook', label: 'The codebook' },
]

const ALPHAS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
const BLOCK_SIZES = [4, 8, 16, 32, 64, 128, 256, 512, 1024]

function percent(fraction: number): string {
  return `${fmt(fraction * 100, 1)}%`
}

/** The channels widest first, with the median width the outlier is measured against. */
function widestChannels(matrix: Matrix, medianMax: number, count = 8): (string | number)[][] {
  const maxima = outlierChannels(matrix).channelMax
  return maxima
    .map((value, index) => ({ index, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count)
    .map((channel) => [
      channel.index,
      fmt(channel.value, 3),
      medianMax === 0 ? '—' : `${fmt(channel.value / medianMax, 2)}×`,
    ])
}

export function QuantisationLab() {
  const [view, setView] = useViewParam(QUANTISATION_VIEWS)
  const [rows, setRows] = useState(QUANTISATION_DEFAULTS.rows)
  const [width, setWidth] = useState(QUANTISATION_DEFAULTS.width)
  const [bits, setBits] = useState(QUANTISATION_DEFAULTS.bits)
  const [groupSize, setGroupSize] = useState(QUANTISATION_DEFAULTS.groupSize)
  const [alpha, setAlpha] = useState(QUANTISATION_DEFAULTS.alpha)
  const [outlierIndex, setOutlierIndex] = useState(QUANTISATION_DEFAULTS.outlierIndex)
  const [outlierScale, setOutlierScale] = useState(QUANTISATION_DEFAULTS.outlierScale)
  const [blockSize, setBlockSize] = useState(QUANTISATION_DEFAULTS.blockSize)
  const [seed, setSeed] = useState(QUANTISATION_DEFAULTS.seed)

  // A slider can outlive the width it was dragged over — the outlier index and the
  // group are both positions inside the tensor, so each is clamped to the tensor it
  // is applied to rather than trusted.
  const safeOutlierIndex = Math.max(0, Math.min(outlierIndex, width - 1))
  const safeGroupSize = Math.max(1, Math.min(groupSize, width))
  const safeBlockSize = Math.max(1, blockSize)

  const activations = useMemo(
    () =>
      activationsWithOutlier(rows, width, {
        seed,
        outlierIndex: safeOutlierIndex,
        outlierScale,
      }),
    [rows, width, seed, safeOutlierIndex, outlierScale],
  )
  const weights = useMemo(() => gaussianMatrix(Math.max(4, Math.round(rows / 4)), width, seed + 2), [rows, width, seed])

  const outlier = useMemo(() => outlierChannels(activations), [activations])
  const tensor = useMemo(() => perTensorQuantisation(activations, bits), [activations, bits])
  const channel = useMemo(() => perChannelQuantisation(activations, bits), [activations, bits])
  const grouped = useMemo(
    () => groupedQuantisation(activations, bits, safeGroupSize),
    [activations, bits, safeGroupSize],
  )

  const groupCurve = useMemo(() => {
    const sizes = [1, 2, 4, 8, 16, 32, 64].filter((size) => size <= width)
    if (!sizes.includes(width)) sizes.push(width)
    return sizes.map((size) => {
      const run = groupedQuantisation(activations, bits, size)
      return { x: size, error: run.error, scales: run.scales }
    })
  }, [activations, bits, width])

  const unsmoothed = useMemo(() => unsmoothedError(activations, weights, { bits }), [activations, weights, bits])
  const migrated = useMemo(() => smoothQuant(activations, weights, alpha, { bits }), [activations, weights, alpha, bits])
  const sweep = useMemo(
    () => smoothQuantSweep(activations, weights, { bits, alphas: ALPHAS }),
    [activations, weights, bits],
  )
  const best = useMemo(
    () => sweep.reduce((low, entry) => (entry.totalError < low.totalError ? entry : low)),
    [sweep],
  )
  const invariance = useMemo(() => {
    const scales = smoothScales(activations, weights, alpha)
    return relativeDifference(
      dotProducts(activations, weights),
      dotProducts(smoothActivations(activations, scales), smoothWeights(weights, scales)),
    )
  }, [activations, weights, alpha])

  const values = useMemo(() => weights.flat(), [weights])
  const codebook = useMemo(() => normalFloatError(values), [values])
  const blocked = useMemo(() => blockedNormalFloatError(values, safeBlockSize), [values, safeBlockSize])
  const unblocked = useMemo(() => blockedNormalFloatError(values, Math.max(1, values.length)), [values])
  const blockCurve = useMemo(
    () => BLOCK_SIZES.map((size) => ({ x: size, error: blockedNormalFloatError(values, size) })),
    [values],
  )

  const schemeRows: (string | number)[][] = [
    ['one grid for the tensor', 1, fmt(tensor.error, 4), '—', `${fmt(tensor.resolutionCost, 2)}× too coarse`],
    ['one grid for each channel', width, fmt(channel.error, 4), fmt(channel.worstChannel, 4), 'one scale each'],
    [
      `one grid per ${safeGroupSize} channels`,
      grouped.scales,
      fmt(grouped.error, 4),
      '—',
      `${fmt(grouped.scales / width, 2)} scales per channel`,
    ],
  ]

  return (
    <div className="lab">
      <Panel
        title="Laboratory D · Eight bits, four bits"
        subtitle="One grid for a tensor, one for each channel, and the outlier that decides between them"
        accent="violet"
      >
        <div className="lab-controls">
          <SegmentedControl label="View" value={view} onChange={setView} options={QUANTISATION_VIEWS} />
          <Slider label="Rows" value={rows} min={16} max={128} step={8} onChange={setRows} />
          <Slider label="The width" value={width} min={4} max={64} step={4} onChange={setWidth} />
          <Slider label="Bits" value={bits} min={2} max={8} onChange={setBits} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
          {view === 'grid' ? (
            <>
              <Slider
                label="The channel the outlier is planted in"
                value={safeOutlierIndex}
                min={0}
                max={Math.max(0, width - 1)}
                onChange={setOutlierIndex}
              />
              <Slider
                label="How much wider the outlier is"
                value={outlierScale}
                min={2}
                max={40}
                onChange={setOutlierScale}
              />
              <Slider
                label="The channels sharing a grid"
                value={safeGroupSize}
                min={1}
                max={width}
                onChange={setGroupSize}
              />
            </>
          ) : null}
          {view === 'migration' ? (
            <Slider
              label="The share of the width that moves"
              value={alpha}
              min={0}
              max={1}
              step={0.01}
              onChange={setAlpha}
              format={(value) => value.toFixed(2)}
              hint="α in the SmoothQuant scale: zero leaves the outliers in the activations, one moves all of them to the weights."
            />
          ) : null}
          {view === 'codebook' ? (
            <Slider
              label="The block a scale is chosen for"
              value={safeBlockSize}
              min={4}
              max={512}
              step={4}
              onChange={setBlockSize}
              hint="QLoRA normalises each block of this many weights to its own range."
            />
          ) : null}
        </div>

        {view === 'grid' ? (
          <>
            <div className="stat-row">
              <Stat label="The outlier" value={`${fmt(outlier.ratio, 1)}×`} hint={`channel ${outlier.index}, against the median`} tone={outlier.ratio > 4 ? 'warn' : 'good'} />
              <Stat label="One grid's error" value={fmt(tensor.error, 4)} />
              <Stat label="One grid per channel" value={fmt(channel.error, 4)} tone="good" />
              <Stat label="What the one grid costs" value={`${fmt(tensor.resolutionCost, 1)}×`} hint="resolution against a typical channel" />
            </div>

            <Figure
              title="The three grids, on one tensor"
              description="The spacing each scheme uses, the error it leaves, and what it spends to leave it."
              caption="A single grid must be wide enough for the widest channel, so every ordinary channel is quantised against a spacing twenty times too coarse. One grid per channel removes that cost and pays for it in scales and in a kernel that has to apply them; grouping is the compromise every four-bit library ships."
            >
              <DataTable
                caption="The three schemes"
                headers={['The scheme', 'Scales stored', 'The RMS error', 'The worst channel', 'What it buys or costs']}
                rows={schemeRows}
              />
            </Figure>

            <Figure
              title="The channels, widest first"
              description="The ten widest channels of the activation tensor, against the median channel the outlier is measured against."
              caption="The tensor is synthetic: every channel but one is drawn uniformly from [-1, 1], and the chosen channel from [-s, s] with s the slider. The outlier is not rare in the statistics of the model — one channel is enough to set the grid for all of them."
            >
              <DataTable
                caption="The widest channels"
                headers={['The channel', 'Its largest value', 'Against the median']}
                rows={widestChannels(activations, outlier.medianMax)}
              />
            </Figure>

            <Figure
              title="Grouping, between the two extremes"
              description="The error as the grid is chosen for smaller and smaller groups of channels."
              caption="At a group of the whole width this is the per-tensor scheme and at a group of one it is the per-channel scheme. The error falls monotonically, but the scales stored rise in proportion to the number of groups: the curve is the price list, not a free improvement."
            >
              <TrendChart
                data={groupCurve}
                series={[{ key: 'error', name: 'the RMS error', colour: 'var(--accent-violet)' }]}
                xLabel="the channels sharing one grid"
                yLabel="the RMS error"
                height={260}
              />
            </Figure>

            <Callout tone="warning" title="Why one channel decides the whole tensor">
              The grid has {fmt(tensor.representable, 3)} as its largest representable magnitude and a spacing of{' '}
              {fmt(tensor.step, 4)}. An ordinary channel of width one is quantised on a grid built for a channel of
              width {fmt(outlier.channelMax[outlier.index] ?? 0, 2)}, which is why its relative error is the outlier's
              rather than its own.
            </Callout>
          </>
        ) : null}

        {view === 'migration' ? (
          <>
            <div className="stat-row">
              <Stat label="The total error" value={fmt(migrated.totalError, 4)} hint={`at α = ${fmt(alpha, 2)}`} />
              <Stat label="Without migrating" value={fmt(unsmoothed.totalError, 4)} tone={migrated.totalError < unsmoothed.totalError ? 'good' : 'warn'} />
              <Stat label="The activation outlier" value={`${fmt(migrated.activationOutlierRatio, 2)}×`} />
              <Stat label="The weight outlier" value={`${fmt(migrated.weightOutlierRatio, 2)}×`} />
            </div>

            <Figure
              title="The valley the share of the width is chosen in"
              description="The error each half carries as more of the outlier is moved from the activations into the weights."
              caption={`The two errors are a product held at a constant: pushing α up flattens the activations and puts the same width into the weights, so one falls while the other rises. The total is minimised at α = ${fmt(best.alpha, 2)} on this tensor, which is what the paper's half is a claim about — a half is the geometric split, not a tuned constant.`}
            >
              <TrendChart
                data={sweep.map((entry) => ({
                  x: entry.alpha,
                  activationError: entry.activationError,
                  weightError: entry.weightError,
                  totalError: entry.totalError,
                }))}
                series={[
                  { key: 'activationError', name: 'the activations', colour: 'var(--accent-violet)' },
                  { key: 'weightError', name: 'the weights', colour: 'var(--accent-amber)', dashed: true },
                  { key: 'totalError', name: 'the total', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the share of the width moved (α)"
                yLabel="the RMS error"
                referenceLines={[{ x: best.alpha, label: 'the minimum' }]}
                height={280}
              />
            </Figure>

            <Figure
              title="Every α, as the screen measures it"
              description="Both halves' errors and outlier ratios at each point of the sweep."
              caption="At α = 0 the activations carry the outlier and the weights are clean; at α = 1 the reverse. The middle is where the two halves meet, and the sweep is computed rather than quoted: nothing here is read off a figure in the paper."
            >
              <DataTable
                caption="The migration"
                headers={['α', 'The activations', 'The weights', 'The total', 'Activation outlier', 'Weight outlier', 'The minimum']}
                rows={sweep.map((entry) => [
                  fmt(entry.alpha, 2),
                  fmt(entry.activationError, 4),
                  fmt(entry.weightError, 4),
                  fmt(entry.totalError, 4),
                  `${fmt(entry.activationOutlierRatio, 2)}×`,
                  `${fmt(entry.weightOutlierRatio, 2)}×`,
                  entry.alpha === best.alpha ? 'yes' : '',
                ])}
              />
            </Figure>

            <Figure
              title="What the migration must not change"
              description="The largest relative change in any dot product of the activations with the weights, after the scales are applied."
              caption="Dividing a column of the activations and multiplying the matching column of the weights leaves every product alone. The number below is floating-point noise, and it is measured on this run rather than asserted."
            >
              <DataTable
                caption="The invariance"
                headers={['The quantity', 'The value', 'What it means']}
                rows={[
                  ['the largest relative change in a dot product', invariance.toExponential(2), 'zero up to floating point'],
                  ['the activation error', `${fmt(unsmoothed.activationError, 4)} → ${fmt(migrated.activationError, 4)}`, 'before → after'],
                  ['the weight error', `${fmt(unsmoothed.weightError, 4)} → ${fmt(migrated.weightError, 4)}`, 'before → after'],
                  ['the total', `${fmt(unsmoothed.totalError, 4)} → ${fmt(migrated.totalError, 4)}`, 'the sum both halves pay'],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="The scale, and why a half">
              With s_j = max|X_j|^α / max|W_j|^(1−α), the pair (X/s, W·s) is the same product as (X, W). At α = 1 the
              activations are made flat and the weights take all of the width; at α = 0 the reverse. The geometric
              split is the value that makes the two halves' widths equal, which is why it is the one a paper reports —
              and why the sweep above has its minimum where it does.
            </Callout>

            <Callout tone="note" title="What is synthetic here">
              The activation tensor is generated with a planted outlier and the weights are drawn from a normal
              distribution; neither is a trained model. The per-tensor and per-channel arithmetic is exact for the
              tensors shown, and the claim that the product is preserved is checked above; the absolute error is a
              property of this synthetic pair, not of any named model.
            </Callout>
          </>
        ) : null}

        {view === 'codebook' ? (
          <>
            <div className="stat-row">
              <Stat label="NF4, whole tensor" value={fmt(codebook.error, 4)} hint="four bits" />
              <Stat label="The even grid, same range" value={fmt(codebook.uniformError, 4)} />
              <Stat label="What the codebook saves" value={percent(1 - codebook.error / codebook.uniformError)} tone="good" />
              <Stat label="Blocked at this size" value={fmt(blocked, 4)} hint={`against ${fmt(unblocked, 4)} for one block`} />
            </div>

            <Figure
              title="The sixteen levels, and where they sit"
              description="The NF4 codebook, its spacing, and the even grid it is compared with."
              caption="The levels are bunched near zero, where a normal distribution puts its mass, and spread apart at the ends, where almost nothing is. The values are quoted from the QLoRA paper: the construction — midpoints of equal-probability bins, mirrored and rescaled — is not reproduced here, and the test checks the shape and the error it buys rather than re-deriving it."
            >
              <DataTable
                caption="The codebook"
                headers={['The level', 'Its value', 'The gap to the next']}
                rows={NF4_CODEBOOK.map((level, index) => [
                  index,
                  fmt(level, 4),
                  index + 1 < NF4_CODEBOOK.length ? fmt(NF4_CODEBOOK[index + 1]! - level, 4) : '—',
                ])}
              />
            </Figure>

            <Figure
              title="The block, and the damage it confines"
              description="The error of block-wise NF4 as the block a scale is chosen for grows."
              caption="A block gets its own range, so an outlier inside one block no longer sets the spacing for every other block. The curve rises with the block size and flattens at the whole tensor; the flat end is the case the block exists to avoid."
            >
              <TrendChart
                data={blockCurve}
                series={[{ key: 'error', name: 'the RMS error', colour: 'var(--accent-violet)' }]}
                xLabel="weights sharing one scale"
                yLabel="the RMS error"
                height={260}
              />
            </Figure>

            <Figure
              title="The block sizes QLoRA uses"
              description="The block-wise error at each of the sizes the paper's implementation offers."
              caption="A whole-tensor scale is the last row and the top of the curve: one weight an order of magnitude larger than its neighbours sets the spacing for all of them. The block is what turns that one bad draw into one bad block."
            >
              <DataTable
                caption="The block sizes"
                headers={['The block', 'The RMS error', 'Against one block for the tensor']}
                rows={BLOCK_SIZES.map((size) => [
                  size,
                  fmt(blockedNormalFloatError(values, size), 4),
                  unblocked === 0 ? '—' : `${fmt(blockedNormalFloatError(values, size) / unblocked, 2)}×`,
                ])}
              />
            </Figure>

            <Callout tone="definition" title="Four bits, and a scale per block">
              NF4 is a four-bit codebook whose levels are the quantiles of a standard normal; a block of weights is
              normalised by its own absolute maximum before it is coded. The arithmetic here is QLoRA's storage half:
              the frozen model is held in these four-bit blocks, which is why the memory laboratory's QLoRA budget
              charges half a byte per frozen parameter.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
