import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  artefactGap,
  cliffInterval,
  emergenceCurve,
  logSweep,
  maxStep,
  metricShift,
  roughness,
  transitionSharpness,
} from '../../core/emergence'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { EMERGENCE_DEFAULTS } from '../../content/labDefaults'

type View = 'cliff' | 'artefact' | 'metric'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const EMERGENCE_VIEWS: { value: View; label: string }[] = [
  { value: 'cliff', label: 'The cliff' },
  { value: 'artefact', label: 'The artefact' },
  { value: 'metric', label: 'The metric' },
]

/** A ratio of two onsets is undefined when one of them never happens, and that is said. */
const ratioText = (value: number) => (Number.isFinite(value) ? fmt(value, 2) : 'no cliff')
const computeText = (value: number | null) => (value === null ? 'never' : fmt(value, 1))

/** The sweep the artefact is read on: forty points over three decades, not twelve. */
const SWEEP = logSweep(1, 2048, 40)

export function EmergenceLab() {
  const [view, setView] = useViewParam(EMERGENCE_VIEWS)
  const [length, setLength] = useState(EMERGENCE_DEFAULTS.length)
  const [threshold, setThreshold] = useState(EMERGENCE_DEFAULTS.threshold)
  const [amplitude, setAmplitude] = useState(EMERGENCE_DEFAULTS.amplitude)
  const [exponent, setExponent] = useState(EMERGENCE_DEFAULTS.exponent)
  const [floor, setFloor] = useState(EMERGENCE_DEFAULTS.floor)
  const [blindAt, setBlindAt] = useState(EMERGENCE_DEFAULTS.blindAt)

  const compute = useMemo(() => [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048], [])

  const curve = useMemo(
    () => emergenceCurve(compute, length, { amplitude, exponent }),
    [compute, length, amplitude, exponent],
  )

  const short = useMemo(() => emergenceCurve(compute, 1, { amplitude, exponent }), [compute, amplitude, exponent])

  // `compute` travels with the scores: the sharpness of a transition is a ratio of
  // computes, and a curve stripped to its scores has no axis to read them on.
  const exact = useMemo(() => curve.map((point) => ({ compute: point.compute, exact: point.exact })), [curve])
  const continuous = useMemo(() => curve.map((point) => ({ compute: point.compute, exact: point.continuous })), [curve])

  const shifted = useMemo(() => metricShift(compute, length, threshold), [compute, length, threshold])

  // The same three numbers on the finer sweep: a cliff that straddles two of twelve
  // points is a different measurement from one resolved across forty.
  const fine = useMemo(
    () => emergenceCurve(SWEEP, length, { amplitude, exponent }),
    [length, amplitude, exponent],
  )
  const fineScores = useMemo(() => fine.map((point) => point.exact), [fine])
  const artefact = useMemo(
    () => artefactGap(SWEEP, length, { floor, blindAt, amplitude, exponent }),
    [length, floor, blindAt, amplitude, exponent],
  )
  const cliff = useMemo(
    () => cliffInterval(SWEEP, fineScores, { low: 0.1, high: 0.9 }),
    [fineScores],
  )
  const smoothCliff = useMemo(
    () => cliffInterval(SWEEP, fine.map((point) => point.accuracy), { low: 0.1, high: 0.9 }),
    [fine],
  )
  const cliffRows: (string | number)[][] = [
    [
      'the whole-sequence score',
      computeText(cliff.start),
      computeText(cliff.end),
      fmt(cliff.width, 1),
      ratioText(cliff.ratio),
      fmt(maxStep(fineScores), 4),
    ],
    [
      'the per-token accuracy',
      computeText(smoothCliff.start),
      computeText(smoothCliff.end),
      fmt(smoothCliff.width, 1),
      ratioText(smoothCliff.ratio),
      fmt(artefact.performanceJump, 4),
    ],
  ]

  return (
    <div className="lab">
      <Panel
        title="Laboratory G · The cliff"
        subtitle="One capability, two metrics, and the two curves they produce"
        accent="rose"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={EMERGENCE_VIEWS}
          />
          <Slider
            label="The length of the task"
            value={length}
            min={1}
            max={40}
            onChange={setLength}
            hint="How many tokens must all be right for the task to count as solved."
          />
          <Slider
            label="The metric’s threshold"
            value={threshold}
            min={0}
            max={0.95}
            step={0.05}
            onChange={setThreshold}
            format={(value) => value.toFixed(2)}
          />
          <Slider
            label="The error at one unit of compute"
            value={amplitude}
            min={0.5}
            max={1.4}
            step={0.01}
            onChange={setAmplitude}
            format={(value) => value.toFixed(2)}
          />
          <Slider
            label="The exponent of the capability"
            value={exponent}
            min={0.1}
            max={0.8}
            step={0.01}
            onChange={setExponent}
            format={(value) => value.toFixed(2)}
          />
          {view === 'artefact' ? (
            <>
              <Slider
                label="The reporting floor"
                value={floor}
                min={0.001}
                max={0.2}
                step={0.001}
                onChange={setFloor}
                format={(value) => value.toFixed(3)}
                hint="A score below this is read as nothing, which is what makes the onset a fact about the metric."
              />
              <Slider
                label="The accuracy that counts as able"
                value={blindAt}
                min={0.2}
                max={0.95}
                step={0.05}
                onChange={setBlindAt}
                format={(value) => value.toFixed(2)}
              />
            </>
          ) : null}
        </div>

        <div className="stat-row">
          <Stat
            label="The sharpness of the cliff"
            value={ratioText(transitionSharpness(exact))}
            hint="the ratio of the compute at 90% to the compute at 10%"
            tone="warn"
          />
          <Stat
            label="The same for a one-token task"
            value={ratioText(transitionSharpness(short))}
            tone="good"
          />
          <Stat
            label="The roughness of the exact curve"
            value={fmt(roughness(exact), 4)}
            hint="the second difference, relative to the range"
          />
          <Stat label="The roughness of the continuous one" value={fmt(roughness(continuous), 4)} tone="good" />
        </div>

        {view === 'cliff' ? (
          <>
            <Figure
              title="The same capability, read through two metrics"
              description="The per-token accuracy, the whole-sequence score, and the continuous metric."
              caption="The underlying capability rises smoothly. The whole-sequence score rises in a cliff, and the cliff is a property of the metric: the score is the per-token accuracy raised to the length of the task."
            >
              <TrendChart
                data={curve.map((point) => ({
                  x: point.compute,
                  exact: point.exact,
                  continuous: point.continuous,
                }))}
                series={[
                  { key: 'exact', name: 'the whole-sequence score', colour: 'var(--accent-rose)' },
                  { key: 'continuous', name: 'the continuous metric', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the compute"
                yLabel="the score"
                height={280}
              />
            </Figure>

            <Figure
              title="The length of the task and the sharpness of the cliff"
              description="The whole-sequence score, for task lengths from one token upwards."
              caption="Nothing about the model changed between these curves. The task got longer, the score got steeper, and the appearance of an abrupt new ability got stronger."
            >
              <DataTable
                caption="The score, by the length of the task"
                headers={['The compute', 'One token', 'Five tokens', 'Ten tokens', 'Twenty tokens']}
                rows={compute.map((c) => {
                  const at = (n: number) => {
                    const point = emergenceCurve([c], n, { amplitude, exponent })[0]!
                    return fmt(point.exact, 4)
                  }
                  return [c, at(1), at(5), at(10), at(20)]
                })}
              />
            </Figure>

            <Callout tone="definition" title="What is being claimed, and what is not">
              The claim is not that abilities do not exist, and not that the measurements are wrong. The claim is that
              a shape in a curve is a fact about the curve, and that before reading a cliff as a fact about the model
              you have to check the metric that produced it.
            </Callout>
          </>
        ) : null}

        {view === 'artefact' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The widest gap between the two"
                value={fmt(artefact.maxGap, 4)}
                hint={`at compute ${fmt(artefact.atCompute, 0)}: ${fmt(artefact.accuracyAtMax, 3)} accuracy against a score of ${fmt(artefact.scoreAtMax, 3)}`}
                tone="warn"
              />
              <Stat
                label="The accuracy when the metric first spoke"
                value={fmt(artefact.accuracyAtOnset, 4)}
                hint={`at compute ${computeText(artefact.onset)}, above the ${fmt(floor, 3)} floor`}
                tone="warn"
              />
              <Stat
                label="Points called a failure while able"
                value={`${artefact.blindPoints} of ${SWEEP.length}`}
                hint={`per-token accuracy at least ${fmt(blindAt, 2)} with a score at or below the floor`}
              />
              <Stat
                label="The biggest single jump"
                value={`${fmt(artefact.metricJump, 4)} versus ${fmt(artefact.performanceJump, 4)}`}
                hint="the metric against the underlying performance"
              />
            </div>

            <Figure
              title="The cliff and the curve underneath it, on the same sweep"
              description={`Forty points over three decades of compute, for a task of ${length} tokens: the per-token accuracy, the whole-sequence score, and the difference.`}
              caption="This is the reproduction of the artefact: one model, one sweep, two readings. The accuracy is monotone and its largest step is the number in the fourth stat; the score is flat, then it is not, and the compute it needed to get there is reported beside an accuracy that was already high."
            >
              <TrendChart
                data={fine.map((point) => ({ x: point.compute, accuracy: point.accuracy, exact: point.exact }))}
                series={[
                  { key: 'accuracy', name: 'the per-token accuracy', colour: 'var(--accent-emerald)' },
                  { key: 'exact', name: 'the whole-sequence score', colour: 'var(--accent-rose)' },
                ]}
                xLabel="the compute"
                yLabel="the reading"
                height={280}
              />
            </Figure>

            <Figure
              title="Where the cliff is, as an interval"
              description="The first compute at which the score clears one tenth of its own best, and the first at which it clears nine tenths."
              caption="The ratio says how sharp the transition is and the width says how much compute was spent climbing it. The accuracy row is the control — one and the same model, read by a metric that never stops rising — and it is the wider of the two: the score reaches a tenth of its own best and then nine tenths inside a factor of thirty of compute, while the accuracy needs two orders of magnitude for the same walk. That factor is the artefact, and at a task length of one the two rows coincide, which is the control agreeing with itself."
            >
              <DataTable
                caption="The two readings of one sweep"
                headers={['The reading', 'The 10% onset', 'The 90% onset', 'The width', 'The ratio', 'The biggest step']}
                rows={cliffRows}
              />
            </Figure>

            <Figure
              title="The sweep, point by point"
              description="Every one of the forty readings, so the gap is checkable by eye rather than by the summary above."
              caption="The gap column is the accuracy minus the score, and it is at its widest in the middle of the climb. That is the point where a report of “the model cannot do this” and a report of a model getting most of the tokens right are simultaneously true, and only one of them is about the metric."
            >
              <DataTable
                caption="Accuracy, score and the difference between them"
                headers={['The compute', 'The per-token accuracy', 'The whole-sequence score', 'The gap']}
                rows={fine.map((point) => [
                  fmt(point.compute, 1),
                  fmt(point.accuracy, 5),
                  fmt(point.exact, 5),
                  fmt(point.accuracy - point.exact, 5),
                ])}
              />
            </Figure>

            <Callout tone="warning" title="What the floor does to the answer">
              The onset is the first point above the reporting floor, so moving that floor moves the claimed discovery.
              It is a defensible choice — a score of one part in a hundred is a rounding away from zero — but it is a
              choice, and the stat above names the number it was made at.
            </Callout>
          </>
        ) : null}

        {view === 'metric' ? (
          <>
            <Figure
              title="Moving the metric’s threshold"
              description="The same capability, scored by a metric whose threshold has been moved."
              caption="The point at which the score takes off moves with the metric. The capability underneath it does not move at all, because nothing about it was touched."
            >
              <TrendChart
                data={shifted.map((point) => ({ x: point.compute, score: point.score }))}
                series={[{ key: 'score', name: 'the score', colour: 'var(--accent-amber)' }]}
                xLabel="the compute"
                yLabel="the score"
                height={260}
              />
            </Figure>

            <Figure
              title="Where the score takes off, for each threshold"
              description="The first compute at which the score passes one half, for a range of thresholds."
              caption="The threshold is a choice about how the model is credited, and it moves the cliff by as much as a factor of several in compute."
            >
              <DataTable
                caption="The cliff, by threshold"
                headers={['The threshold', 'The first compute above half the score', 'The score at the end']}
                rows={[0.2, 0.35, 0.5, 0.65, 0.8].map((value) => {
                  const shiftedCurve = metricShift(compute, length, value)
                  const first = shiftedCurve.find((point) => point.score > 0.5)
                  return [
                    value.toFixed(2),
                    first?.compute ?? 'never',
                    fmt(shiftedCurve[shiftedCurve.length - 1]?.score ?? 0, 4),
                  ]
                })}
              />
            </Figure>

            <Callout tone="warning" title="The practical lesson">
              When a capability appears suddenly, the first question is not <em>what changed in the model</em> but
              <em> what the metric is doing</em>. A threshold, a length, and a rounding rule are all metric choices,
              and each of them can manufacture a cliff out of a smooth rise.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
