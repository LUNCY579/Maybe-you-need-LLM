import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { originalDistribution, runCollapse, tailMassTable } from '../../core/collapse'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'generations' | 'floor'

export function CollapseLab() {
  const [view, setView] = useState<View>('generations')
  const [bounded, setBounded] = useState(true)
  const [generations, setGenerations] = useState(8)
  const [samples, setSamples] = useState(150)
  const [support, setSupport] = useState(24)
  const [realFraction, setRealFraction] = useState(0)
  const [symbols, setSymbols] = useState(48)
  const [seed, setSeed] = useState(4)

  const records = useMemo(
    () =>
      runCollapse({
        generations,
        samples,
        symbols,
        support,
        bounded,
        realFraction,
        seed,
      }),
    [generations, samples, symbols, support, bounded, realFraction, seed],
  )

  const table = useMemo(() => tailMassTable({ symbols, smoothing: 1 }), [symbols])

  const original = useMemo(() => originalDistribution({ symbols, alpha: 1.1 }), [symbols])

  return (
    <div className="lab">
      <Panel
        title="Laboratory D · Collapse"
        subtitle="Train on what a model wrote, and watch the tail disappear"
        accent="rose"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'generations', label: 'The generations' },
              { value: 'floor', label: 'The floor' },
            ]}
          />
          <Slider label="The generations" value={generations} min={2} max={16} onChange={setGenerations} />
          <Slider label="The samples in a batch" value={samples} min={60} max={2000} step={20} onChange={setSamples} />
          <Slider
            label="The bounded model’s support"
            value={support}
            min={6}
            max={48}
            onChange={setSupport}
            hint="How many symbols the bounded model can represent at all."
          />
          <Slider
            label="The fraction of real data"
            value={realFraction}
            min={0}
            max={1}
            step={0.05}
            onChange={setRealFraction}
            format={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Slider label="The symbols" value={symbols} min={16} max={96} step={8} onChange={setSymbols} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
          <div className="field">
            <span className="field-label">The model</span>
            <button
              type="button"
              className={bounded ? 'btn btn-primary' : 'btn btn-default'}
              onClick={() => setBounded(!bounded)}
            >
              {bounded ? 'Bounded' : 'Unbounded'}
            </button>
            <p className="field-hint">
              A bounded model can only represent its support. An unbounded one floors every symbol it has never seen.
            </p>
          </div>
        </div>

        <div className="stat-row">
          <Stat label="The original tail mass" value={fmt(records[0]?.originalTailMass ?? 0, 4)} />
          <Stat
            label="The tail mass now"
            value={fmt(records[records.length - 1]?.survivingTailMass ?? 0, 4)}
            tone={(records[records.length - 1]?.survivingTailMass ?? 0) < 0.02 ? 'warn' : 'good'}
          />
          <Stat
            label="The symbols it can still say"
            value={String(records[records.length - 1]?.support ?? 0)}
            hint={`of ${symbols}`}
          />
          <Stat
            label="The distance from the original"
            value={fmt(records[records.length - 1]?.totalVariation ?? 0, 4)}
            tone="warn"
          />
        </div>

        {view === 'generations' ? (
          <>
            <Figure
              title="The recursion, generation by generation"
              description="The mass left on the original's tail symbols, and the distance from the original distribution."
              caption="The tail is measured on the same symbols at every generation — the ones the original was least likely to produce. It is the first thing to go."
            >
              <TrendChart
                data={records.map((record) => ({
                  x: record.generation,
                  tail: record.survivingTailMass,
                  distance: record.totalVariation,
                }))}
                series={[
                  { key: 'tail', name: 'the mass on the original’s tail', colour: 'var(--accent-rose)' },
                  { key: 'distance', name: 'the distance from the original', colour: 'var(--accent-indigo)' },
                ]}
                xLabel="the generation"
                yLabel="the quantity"
                height={280}
              />
            </Figure>

            <Figure
              title="Every generation, in full"
              description="The tail’s mass, the support, the effective number of symbols and the largest probability, at each generation."
              caption="The support is the number of symbols the model can still represent. When it shrinks, the symbols it dropped can never come back."
            >
              <DataTable
                caption="The generations"
                headers={[
                  'The generation',
                  'The tail’s mass',
                  'The support',
                  'The effective symbols',
                  'The largest probability',
                ]}
                rows={records.map((record) => [
                  record.generation,
                  fmt(record.survivingTailMass, 4),
                  record.support,
                  fmt(record.effectiveSupport, 2),
                  fmt(record.maxProbability, 4),
                ])}
              />
            </Figure>

            <Callout tone="warning" title="What this is and is not">
              This is a loop over a discrete distribution with a smoothed empirical model, and it is small enough to
              check by hand. It is <em>not</em> a language model. What it shows is that the mechanism needs nothing
              exotic: a learner that cannot represent the rare outputs will lose them, and one that can will floor
              them.
            </Callout>
          </>
        ) : null}

        {view === 'floor' ? (
          <>
            <Figure
              title="The floor under the tail"
              description="The probability an unbounded model gives to a symbol it has seen a given number of times, in a batch of a given size."
              caption="The smoothing constant puts a floor under every symbol. That floor is why the unbounded model saturates instead of collapsing, and it is also why the tail cannot be recovered from the model alone."
            >
              <DataTable
                caption="The smoothed probability of a symbol"
                headers={['The count', 'The batch size', 'The probability', 'In words']}
                rows={table.map((row) => [
                  row.count,
                  row.samples,
                  row.probability.toExponential(3),
                  row.probability < 1e-3 ? 'effectively never said' : 'said, rarely',
                ])}
              />
            </Figure>

            <Figure
              title="The original distribution"
              description="The distribution the recursion starts from, and the symbols in its tail."
              caption="The tail holds a tenth of the mass over the least likely symbols. It is the part of the distribution that carries the rare knowledge, and the part the recursion destroys first."
            >
              <TrendChart
                data={original.map((value, index) => ({ x: index, p: value }))}
                series={[{ key: 'p', name: 'the probability', colour: 'var(--accent-amber)' }]}
                xLabel="the symbol"
                yLabel="the probability"
                height={240}
              />
            </Figure>

            <Callout tone="definition" title="The two failures, in one sentence each">
              A bounded model loses the tail, because it cannot say the rare symbols at all. An unbounded model floors
              it, because the smoothing constant puts a probability under every symbol whether or not it has been
              seen. Real data in the mixture is what stops both.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
