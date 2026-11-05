import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  dominanceEpoch,
  effectiveSamples,
  epochCurve,
  PAPER_REPETITION_CONSTANT,
  phaseBoundaries,
} from '../../core/epochs'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { EPOCHS_DEFAULTS } from '../../content/labDefaults'

type View = 'phases' | 'gains' | 'price'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const EPOCHS_VIEWS: { value: View; label: string }[] = [
  { value: 'phases', label: 'The three phases' },
  { value: 'gains', label: 'What an epoch buys' },
  { value: 'price', label: 'The memorising' },
]

export function EpochsLab() {
  const [view, setView] = useViewParam(EPOCHS_VIEWS)
  const [epochs, setEpochs] = useState(EPOCHS_DEFAULTS.epochs)
  const [unique, setUnique] = useState(EPOCHS_DEFAULTS.unique)
  const [batch, setBatch] = useState(EPOCHS_DEFAULTS.batch)
  const [learningRate, setLearningRate] = useState(EPOCHS_DEFAULTS.learningRate)
  const [runs, setRuns] = useState(EPOCHS_DEFAULTS.runs)
  const [dominanceFraction, setDominanceFraction] = useState(EPOCHS_DEFAULTS.dominanceFraction)
  const [seed, setSeed] = useState(EPOCHS_DEFAULTS.seed)

  // The heaviest compute in the app: two SGD trajectories per restart, read at every
  // epoch boundary. Everything below is derived from this one call.
  const curve = useMemo(
    () => epochCurve({ epochs, unique, batch, learningRate, runs, seed }),
    [epochs, unique, batch, learningRate, runs, seed],
  )
  const bounds = useMemo(() => phaseBoundaries(curve), [curve])
  const dominant = useMemo(() => dominanceEpoch(curve, { fraction: dominanceFraction }), [curve, dominanceFraction])
  const last = curve[curve.length - 1]!
  const worth = useMemo(() => effectiveSamples(curve, bounds.bestEpoch), [curve, bounds.bestEpoch])

  const referenceLines = [
    bounds.warmupEnd === null ? null : { x: bounds.warmupEnd, label: `the warmup ends at ${bounds.warmupEnd}` },
    bounds.plateauStart === null ? null : { x: bounds.plateauStart, label: `the plateau at ${bounds.plateauStart}` },
    bounds.decayStart === null ? null : { x: bounds.decayStart, label: `the turn at ${bounds.decayStart}` },
  ].filter((line) => line !== null) as { x: number; label: string }[]

  return (
    <div className="lab">
      <Panel
        title="Laboratory E · Going round the pool"
        subtitle="Two runs, the same tokens, different data, measured at every epoch"
        accent="emerald"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={EPOCHS_VIEWS}
          />
          <Slider label="The epochs" value={epochs} min={8} max={40} onChange={setEpochs} />
          <Slider
            label="The unique rows"
            value={unique}
            min={10}
            max={80}
            onChange={setUnique}
            hint="The size of the pool. The fresh run reads this many new rows each epoch."
          />
          <Slider label="The batch" value={batch} min={1} max={Math.max(1, Math.floor(unique / 2))} onChange={setBatch} />
          <Slider
            label="The learning rate"
            value={learningRate}
            min={0.005}
            max={0.12}
            step={0.005}
            onChange={setLearningRate}
            format={(value) => value.toFixed(3)}
          />
          <Slider
            label="The restarts"
            value={runs}
            min={1}
            max={8}
            onChange={setRuns}
            hint="Independent batch orders, averaged. One restart is a single run’s noise."
          />
          {view === 'gains' ? (
            <Slider
              label="The dominance fraction"
              value={dominanceFraction}
              min={0.05}
              max={1}
              step={0.05}
              onChange={setDominanceFraction}
              format={(value) => value.toFixed(2)}
              hint="An epoch dominates when it buys less than this share of what a fresh epoch buys."
            />
          ) : null}
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat
            label="The warmup ends at"
            value={bounds.warmupEnd === null ? 'never' : `epoch ${bounds.warmupEnd}`}
            hint="the last epoch the two runs are within 2% of each other"
          />
          <Stat
            label="The turn upward at"
            value={bounds.decayStart === null ? 'never' : `epoch ${bounds.decayStart}`}
            hint="the first epoch worse than the best by more than 2%"
            tone={bounds.decayStart === null ? 'default' : 'warn'}
          />
          <Stat
            label="The early-stopping epoch"
            value={`epoch ${bounds.bestEpoch}`}
            hint={`the repeated run’s best loss, ${fmt(bounds.bestLoss, 5)}`}
            tone="good"
          />
          <Stat
            label="The gap at the last epoch"
            value={fmt(last.gap, 5)}
            hint={`${fmt(last.relativeGap * 100, 1)}% of the fresh run’s loss`}
          />
        </div>

        {view === 'phases' ? (
          <>
            <Figure
              title="The measured three-phase curve"
              description="Both runs read the same number of tokens; the repeated one goes over the same rows again."
              caption="At epoch one the two are the same run, so the gap is exactly zero — that is the arithmetic of the construction, not a property of the data. The gap opens when the repeated run reaches its pool’s own optimum, and the repeated curve turns upward when it starts to fit the noise planted in those rows. The paper’s law has the first two phases and not the third; screen F draws the law and this screen measures what the law cannot say."
            >
              <TrendChart
                data={curve.map((point) => ({
                  x: point.epoch,
                  repeated: point.repeatedLoss,
                  fresh: point.freshLoss,
                }))}
                series={[
                  { key: 'repeated', name: 'the repeated run', colour: 'var(--accent-rose)' },
                  { key: 'fresh', name: 'the fresh run', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the epoch"
                yLabel="the held-out loss"
                referenceLines={referenceLines}
                height={300}
              />
            </Figure>

            <Figure
              title="The price of repetition, epoch by epoch"
              description="The repeated loss minus the fresh loss, at equal tokens read."
              caption="Both curves are means over the restarts above, on the same pool and the same held-out set, so the only thing that differs between them is whether the rows were new. One restart is a single run’s noise, and the wiggle in the gap is that noise; the growth of the gap is not."
            >
              <TrendChart
                data={curve.map((point) => ({ x: point.epoch, gap: point.gap, relative: point.relativeGap }))}
                series={[
                  { key: 'gap', name: 'the gap in loss', colour: 'var(--accent-amber)' },
                  { key: 'relative', name: 'the gap as a share of fresh', colour: 'var(--accent-sky)', dashed: true },
                ]}
                xLabel="the epoch"
                yLabel="the gap"
                height={260}
              />
            </Figure>

            <DataTable
              caption="Every epoch boundary, as measured"
              headers={['Epoch', 'Tokens read', 'Repeated', 'Fresh', 'The gap', 'Train loss on the pool']}
              rows={curve.map((point) => [
                point.epoch,
                point.tokens,
                fmt(point.repeatedLoss, 5),
                fmt(point.freshLoss, 5),
                fmt(point.gap, 5),
                fmt(point.trainLoss, 5),
              ])}
            />

            <Callout tone="note" title="What is real here and what is a fixture">
              The learner is a genuine mini-batch stochastic gradient descent run over rows drawn from a seeded
              stream, and every number on this screen is read off those trajectories. The task underneath is the
              synthetic linear regression of screen F — a pool of {unique} rows with the noise planted in its targets
              rather than measured from anything. The shapes are the paper’s; the corpus is not a corpus.
            </Callout>
          </>
        ) : null}

        {view === 'gains' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The dominance epoch"
                value={dominant === null ? 'never' : `epoch ${dominant}`}
                hint={`the first epoch worth less than ${fmt(dominanceFraction * 100, 0)}% of a fresh one`}
                tone={dominant === null ? 'default' : 'warn'}
              />
              <Stat
                label="What the best epoch was worth"
                value={`${fmt(worth, 0)} rows`}
                hint="the fresh-run row count that reaches the same loss"
              />
              <Stat
                label="The pool’s own value"
                value={fmt(unique * (1 + PAPER_REPETITION_CONSTANT.data), 0)}
                hint="U·(1 + R★) at the paper’s quoted constant — the ceiling on this pool"
              />
              <Stat
                label="The last epoch’s gain"
                value={fmt(last.repeatedGain, 6)}
                hint={`against ${fmt(last.freshGain, 6)} for a fresh epoch`}
              />
            </div>

            <Figure
              title="What one more epoch buys each run"
              description="The fall in held-out loss from the previous epoch, for the repeated run and the fresh one."
              caption="The dominance epoch is marginal, not absolute: it is where an epoch of the same rows stops being worth a share of what an epoch of new rows is, which is the point at which the extra compute is better spent on data. Raising the fraction above moves that epoch earlier, and the table below is what the same reading gives at each of them."
            >
              <TrendChart
                data={curve.map((point) => ({ x: point.epoch, repeated: point.repeatedGain, fresh: point.freshGain }))}
                series={[
                  { key: 'repeated', name: 'a repeated epoch', colour: 'var(--accent-rose)' },
                  { key: 'fresh', name: 'a fresh epoch', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the epoch"
                yLabel="the loss bought"
                height={280}
              />
            </Figure>

            <Figure
              title="The dominance epoch, at each fraction"
              description="The first epoch whose gain falls under a given share of a fresh epoch’s gain."
              caption="This is the number the lesson’s title asks for, and it has more than one answer: it depends where the bar is put. The row matching the slider above is the one the stat is reading."
            >
              <DataTable
                caption="Dominance by threshold"
                headers={['The fraction of a fresh epoch', 'The dominance epoch', 'The repeated loss there', 'The rows it is worth']}
                rows={[0.9, 0.75, 0.5, 0.25, 0.1].map((fraction) => {
                  const epoch = dominanceEpoch(curve, { fraction })
                  const point = epoch === null ? null : curve.find((row) => row.epoch === epoch)
                  return [
                    `${fmt(fraction * 100, 0)}%`,
                    epoch === null ? 'never' : `epoch ${epoch}`,
                    point ? fmt(point.repeatedLoss, 5) : '—',
                    epoch === null ? '—' : `${fmt(effectiveSamples(curve, epoch), 0)} rows`,
                  ]
                })}
              />
            </Figure>

            <Callout tone="definition" title="Effective data, measured rather than assumed">
              The third stat inverts the fresh curve at the repeated curve’s best loss: it answers “how many new rows
              would I have needed to do as well as this many repeats”, by interpolation in log tokens. Screen F
              answers the same question from the paper’s formula. The two are different instruments on one quantity,
              and they are allowed to disagree — the measured one includes the overfitting the formula has no term
              for.
            </Callout>
          </>
        ) : null}

        {view === 'price' ? (
          <>
            <Figure
              title="The pool goes down while the held-out loss goes up"
              description="The repeated run’s loss on the rows it is training on, against its loss on the held-out set."
              caption="This is the third phase and the reason it is the interesting one. Nothing about the optimiser changed at the turn; what changed is that the pool’s own optimum is a function of the noise planted in the pool’s rows, and continuing to descend walks the weights towards it. The training curve keeps falling the whole way."
            >
              <TrendChart
                data={curve.map((point) => ({ x: point.epoch, train: point.trainLoss, held: point.repeatedLoss }))}
                series={[
                  { key: 'train', name: 'the loss on the pool', colour: 'var(--accent-teal)' },
                  { key: 'held', name: 'the held-out loss', colour: 'var(--accent-rose)' },
                ]}
                xLabel="the epoch"
                yLabel="the loss"
                referenceLines={
                  bounds.decayStart === null ? [] : [{ x: bounds.decayStart, label: `the turn at epoch ${bounds.decayStart}` }]
                }
                height={280}
              />
            </Figure>

            <Figure
              title="The early-stopping point"
              description="The best held-out loss the repeated run reached, and where it left it behind."
              caption={`A run of ${epochs} epochs is worse than a run of ${bounds.bestEpoch}, and the only way to know which is which while the run is going is to watch a held-out set. That is the practical content of the third phase: the compute you have already spent is not the reason to stop, and the loss you can see falling is not the loss you are buying.`}
            >
              <DataTable
                caption="Around the best epoch"
                headers={['The epoch', 'The pool loss', 'The held-out loss', 'Against the best']}
                rows={curve
                  .filter((point) => Math.abs(point.epoch - bounds.bestEpoch) <= 3)
                  .map((point) => [
                    point.epoch === bounds.bestEpoch ? `epoch ${point.epoch} (best)` : `epoch ${point.epoch}`,
                    fmt(point.trainLoss, 5),
                    fmt(point.repeatedLoss, 5),
                    fmt(point.repeatedLoss - bounds.bestLoss, 5),
                  ])}
              />
            </Figure>

            <Callout tone="warning" title="One restart is not a curve">
              With the restarts slider at one, every number on this screen is a single stochastic trajectory, and the
              epoch-to-epoch fluctuation of constant-step descent is larger than the phase boundaries being read off
              it. The phase is a property of the mean; the wiggle is a property of the run.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
