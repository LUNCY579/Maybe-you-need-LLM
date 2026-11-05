import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildRepeatsTask, repeatComparison } from '../../core/repeats'
import {
  effectiveDataLaw,
  epochsForValue,
  PAPER_REPETITION_CONSTANT,
  repetitionSchedule,
  repetitionValue,
} from '../../core/epochs'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { REPEATS_DEFAULTS } from '../../content/labDefaults'

type View = 'price' | 'curve' | 'law'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const REPEATS_VIEWS: { value: View; label: string }[] = [
  { value: 'price', label: 'The price' },
  { value: 'curve', label: 'The curves' },
  { value: 'law', label: 'The law' },
]

export function RepeatsLab() {
  const [view, setView] = useViewParam(REPEATS_VIEWS)
  const [unique, setUnique] = useState(REPEATS_DEFAULTS.unique)
  const [capacity, setCapacity] = useState(REPEATS_DEFAULTS.capacity)
  const [ridge, setRidge] = useState(REPEATS_DEFAULTS.ridge)
  const [maxRepeats, setMaxRepeats] = useState(REPEATS_DEFAULTS.maxRepeats)
  const [rDStar, setRDStar] = useState(REPEATS_DEFAULTS.rDStar)
  const [pool, setPool] = useState(REPEATS_DEFAULTS.pool)
  const [epochs, setEpochs] = useState(REPEATS_DEFAULTS.epochs)
  const [seed, setSeed] = useState(REPEATS_DEFAULTS.seed)

  const task = useMemo(
    () => buildRepeatsTask({ unique, capacity, ridge, seed }),
    [unique, capacity, ridge, seed],
  )

  const comparison = useMemo(
    () =>
      repeatComparison(
        task,
        [1, 2, 4, 8, 16, 32].filter((count) => count <= maxRepeats),
        { ridge },
      ),
    [task, maxRepeats, ridge],
  )

  // The law, evaluated on the pool the slider names. The repetitions are the extra
  // passes, so the sweep starts at zero rather than at one epoch.
  const law = useMemo(() => {
    const passes = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48]
    return passes.map((repetition) => ({
      x: repetition + 1,
      repetition,
      effective: effectiveDataLaw(pool, repetition, { rDStar }),
      value: repetitionValue(repetition, { rDStar }),
    }))
  }, [pool, rDStar])

  const schedule = useMemo(() => repetitionSchedule(pool, epochs, { rDStar }), [pool, epochs, rDStar])
  const ceiling = pool * (1 + rDStar)
  const epochOfHalfValue = useMemo(() => epochsForValue(0.5, { rDStar }), [rDStar])

  return (
    <div className="lab">
      <Panel
        title="Laboratory F · The effective-data law"
        subtitle="What a repeated corpus is worth, measured here and written down there"
        accent="amber"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={REPEATS_VIEWS}
          />
          {view === 'law' ? (
            <>
              <Slider
                label="The pool, in tokens"
                value={Math.log10(pool)}
                min={6}
                max={12}
                step={0.1}
                onChange={(value) => setPool(10 ** value)}
                format={(value) => `10^${value.toFixed(1)}`}
                hint="The unique tokens the repeats are taken over."
              />
              <Slider
                label="The repetition constant R★"
                value={rDStar}
                min={1}
                max={40}
                step={0.5}
                onChange={setRDStar}
                format={(value) => value.toFixed(2)}
                hint={`The paper’s own fitted value is ${PAPER_REPETITION_CONSTANT.data}.`}
              />
              <Slider label="The epochs to list" value={epochs} min={2} max={24} onChange={setEpochs} />
            </>
          ) : (
            <>
              <Slider label="The unique rows" value={unique} min={40} max={400} step={20} onChange={setUnique} />
              <Slider label="The capacity" value={capacity} min={8} max={60} onChange={setCapacity} />
              <Slider
                label="The ridge penalty"
                value={ridge}
                min={0.001}
                max={0.5}
                step={0.001}
                onChange={setRidge}
                format={(value) => value.toFixed(3)}
              />
              <Slider label="The most repeats" value={maxRepeats} min={1} max={32} onChange={setMaxRepeats} />
              <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
            </>
          )}
        </div>

        {view === 'law' ? (
          <div className="stat-row">
            <Stat label="The pool" value={fmt(pool, 2)} hint="unique tokens" />
            <Stat
              label="The ceiling on effective data"
              value={fmt(ceiling, 2)}
              hint="U·(1 + R★): no number of passes is worth more than this"
            />
            <Stat
              label="Epochs to half a fresh one"
              value={fmt(epochOfHalfValue, 2)}
              hint="the R at which the marginal pass is worth half a new epoch"
            />
            <Stat
              label="The value of the last listed pass"
              value={fmt((schedule[schedule.length - 1]?.nextEpochValue ?? 0) * 100, 2) + '%'}
              hint="of a fresh epoch, at the epoch count above"
              tone="warn"
            />
          </div>
        ) : (
          <div className="stat-row">
            <Stat label="The unique rows" value={String(task.x.length)} />
            <Stat
              label="The last run’s gap"
              value={fmt(comparison[comparison.length - 1]?.gap ?? 0, 5)}
              hint="the price of the last round of repeats"
              tone="warn"
            />
            <Stat
              label="The repeated run’s loss"
              value={fmt(comparison[comparison.length - 1]?.repeatedLoss ?? 0, 5)}
              hint="it does not improve"
            />
            <Stat
              label="The fresh run’s loss"
              value={fmt(comparison[comparison.length - 1]?.freshLoss ?? 0, 5)}
              hint="it keeps improving"
              tone="good"
            />
          </div>
        )}

        {view === 'price' ? (
          <>
            <Figure
              title="What the repeats cost"
              description="At each number of repeats, the held-out loss of the repeated run and of a fresh run of the same length."
              caption="Both runs are measured on the same held-out set and cost the same arithmetic. The only difference is whether the rows are new."
            >
              <DataTable
                caption="The price of each round of repeats"
                headers={['The repeats', 'The rows read', 'The repeated run', 'The fresh run', 'The gap']}
                rows={comparison.map((row) => [
                  row.repeats,
                  row.rows,
                  fmt(row.repeatedLoss, 5),
                  fmt(row.freshLoss, 5),
                  fmt(row.gap, 5),
                ])}
              />
            </Figure>

            <Callout tone="definition" title="Why the repeated run cannot improve">
              The ridge solution is (XᵀX/N + λI)⁻¹Xᵀy/N. Repeating every row E times multiplies XᵀX and Xᵀy by
              E, and the N in the denominator by E, so every term is multiplied by the same factor and the solution is
              identical. The model is the same model; only the bill has changed.
            </Callout>
          </>
        ) : null}

        {view === 'curve' ? (
          <>
            <Figure
              title="The two curves"
              description="The held-out loss against the number of rows read, for the repeated run and for the fresh run."
              caption="The fresh curve falls all the way down. The repeated curve is flat from the first point, because the model it finds does not change."
            >
              <TrendChart
                data={comparison.map((row) => ({
                  x: row.rows,
                  repeated: row.repeatedLoss,
                  fresh: row.freshLoss,
                }))}
                series={[
                  { key: 'repeated', name: 'the repeated run', colour: 'var(--accent-rose)' },
                  { key: 'fresh', name: 'the fresh run', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the rows read"
                yLabel="the held-out loss"
                height={280}
              />
            </Figure>

            <Callout tone="warning" title="The rule that falls out">
              The loss curve of a run should be read against the <em>unique</em> tokens, not the tokens read. A run of
              four hundred billion tokens over a hundred billion unique tokens has a hundred billion tokens of
              effective data, and its curve belongs next to the curve of a hundred-billion-token fresh run — not next
              to the curve of a four-hundred-billion-token one.
            </Callout>
          </>
        ) : null}

        {view === 'law' ? (
          <>
            <Figure
              title="The law the paper fits, evaluated here"
              description="D′ = U·(1 + R★·(1 − e^(−R/R★))) over a sweep of extra passes R, at the pool and constant above."
              caption="One pass is worth exactly itself; the marginal pass decays exponentially rather than falling to a smaller constant; and the whole pool is never worth more than U·(1 + R★) however many times it is read. Screen E measures a curve like this one with a real optimiser — this screen only evaluates the formula, which is why its axes are tokens and not epochs-of-training."
            >
              <TrendChart
                data={law}
                series={[{ key: 'effective', name: 'the effective data', colour: 'var(--accent-amber)' }]}
                xLabel="the epochs (extra passes plus one)"
                yLabel="the effective data"
                height={260}
              />
            </Figure>

            <Figure
              title="What the next pass is worth"
              description="The marginal term of the same law, e^(−R/R★): one extra epoch as a fraction of one epoch of fresh data."
              caption="The paper’s summary — that up to about four epochs is nearly free — is this curve read near one. It is a smooth decay with no knee in it, which is the difference between the law and the measured curve beside it on screen E: the measurement turns upward, and the formula has nothing that can."
            >
              <TrendChart
                data={law}
                series={[{ key: 'value', name: 'the next pass, as a share of a fresh epoch', colour: 'var(--accent-teal)' }]}
                xLabel="the epochs (extra passes plus one)"
                yLabel="the share of a fresh epoch"
                height={240}
              />
            </Figure>

            <Figure
              title="The schedule, epoch by epoch"
              description="The same law as a table: what each pass reads, what it is worth, and what the next one will be worth."
              caption="The paper’s own summary — that up to about four epochs is nearly free — is a property of this expression with their constant in it, and the value column is where it is read. Their fitted constant is R★ = 15.387756, quoted from arXiv:2305.16264; the slider lets the sensitivity to that one number be seen."
            >
              <DataTable
                caption="Epochs over a finite pool"
                headers={['The epoch', 'The tokens read', 'The effective data', 'The share of the ceiling', 'The next pass is worth']}
                rows={schedule.map((row) => [
                  row.epoch,
                  fmt(row.tokens, 2),
                  fmt(row.effectiveData, 2),
                  `${fmt((row.effectiveData / ceiling) * 100, 2)}%`,
                  `${fmt(row.nextEpochValue * 100, 2)}%`,
                ])}
              />
            </Figure>

            <Callout tone="note" title="Where this law cannot be trusted">
              The formula saturates; a real run does not merely saturate, it turns upward. Screen E’s measured curve
              has the same first two phases and then a third one the law has no term for, because overfitting the pool
              is not in it. That is why the practice is early stopping rather than more epochs, and why the ceiling
              above is a ceiling on the law’s optimism and not on what a run will achieve.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
