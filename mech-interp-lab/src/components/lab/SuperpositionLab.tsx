import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  buildSuperpositionModel,
  coverage,
  directionLoad,
  generateFeatures,
  importanceThreshold,
  polysemanticity,
  tradeoffCurve,
} from '../../core/superposition'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'
import { SUPERPOSITION_DEFAULTS } from '../../content/labDefaults'

type View = 'model' | 'threshold' | 'tradeoff' | 'load'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const SUPERPOSITION_VIEWS: { value: View; label: string }[] = [
  { value: 'model', label: 'The model' },
  { value: 'threshold', label: 'The threshold' },
  { value: 'tradeoff', label: 'The trade-off' },
  { value: 'load', label: 'The load' },
]

export function SuperpositionLab() {
  const [view, setView] = useViewParam(SUPERPOSITION_VIEWS)
  const [featureCount, setFeatureCount] = useState(SUPERPOSITION_DEFAULTS.featureCount)
  const [dimensions, setDimensions] = useState(SUPERPOSITION_DEFAULTS.dimensions)
  const [importanceExponent, setImportanceExponent] = useState(SUPERPOSITION_DEFAULTS.importanceExponent)
  const [seed, setSeed] = useState(SUPERPOSITION_DEFAULTS.seed)

  const features = useMemo(
    () => generateFeatures(featureCount, dimensions, seed, importanceExponent),
    [featureCount, dimensions, seed, importanceExponent],
  )

  const model = useMemo(
    () => buildSuperpositionModel(features, dimensions, { seed }),
    [features, dimensions, seed],
  )

  const threshold = useMemo(
    () => importanceThreshold(features, Math.min(3, features.length - 1), dimensions, { seed }),
    [features, dimensions, seed],
  )

  // Only computed for the view that shows it: every point is a fit of its own, and
  // the sliders re-run the whole thing.
  const tradeoff = useMemo(
    () => (view === 'tradeoff' ? tradeoffCurve(features, dimensions, { seed }) : []),
    [view, features, dimensions, seed],
  )

  const sweep = useMemo(() => {
    const rows: { x: number; interference: number; loss: number }[] = []
    for (let d = 1; d <= Math.max(2, featureCount); d++) {
      const fitted = buildSuperpositionModel(features, d, { seed })
      rows.push({ x: d, interference: fitted.interference, loss: fitted.loss })
    }
    return rows
  }, [features, featureCount, seed])

  return (
    <div className="lab">
      <Panel
        title="Laboratory A · Superposition"
        subtitle="A model with fewer dimensions than features, fitted here and measured here"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={SUPERPOSITION_VIEWS}
          />
          <Slider label="Features" value={featureCount} min={3} max={30} onChange={setFeatureCount} />
          <Slider label="Dimensions" value={dimensions} min={1} max={16} onChange={setDimensions} />
          <Slider
            label="Importance exponent"
            value={importanceExponent}
            min={0}
            max={4}
            step={0.25}
            onChange={setImportanceExponent}
            format={(value) => (value === 0 ? 'all equal' : value.toFixed(2))}
            hint="Zero makes every feature equally important, which is when the model superposes rather than drops."
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="The loss" value={fmt(model.loss, 4)} hint="the expected squared error" />
          <Stat
            label="The interference"
            value={fmt(model.interference, 4)}
            hint="what the features pay each other"
            tone={model.interference > 0.1 ? 'warn' : 'good'}
          />
          <Stat
            label="Features per direction"
            value={fmt(polysemanticity(model), 2)}
            hint="one would be monosemantic"
          />
          <Stat label="Coverage" value={`${fmt(coverage(model, featureCount) * 100, 0)}%`} hint="of the features represented" />
        </div>

        {view === 'model' ? (
          <>
            <Figure
              title="The interference against the number of dimensions"
              description="The total interference the model suffers, and its loss, as the number of dimensions it is given."
              caption="With few dimensions the model has to pack features together and they interfere; with enough dimensions it can give each one its own direction and the interference falls away."
            >
              <TrendChart
                data={sweep}
                series={[
                  { key: 'interference', name: 'the interference', colour: 'var(--accent-rose)' },
                  { key: 'loss', name: 'the loss', colour: 'var(--accent-indigo)' },
                ]}
                xLabel="the number of dimensions"
                yLabel="value"
                height={280}
              />
            </Figure>

            <DataTable
              caption="Every feature, and what the model did with it"
              headers={['Feature', 'Importance', 'Recovered', 'Interference paid']}
              rows={features.map((feature, k) => [
                feature.id,
                fmt(feature.importance, 4),
                fmt(model.recoveryPerFeature[k] ?? 0, 4),
                fmt(model.interferencePerFeature[k] ?? 0, 4),
              ])}
            />

            <Callout tone="definition" title="What the two columns mean">
              <em>Recovered</em> is the squared length of the model’s column for that feature — how much of its own
              signal the readout gives back. <em>Interference paid</em> is what the other features sharing its direction
              cost it. A feature with high recovery and no interference is represented cleanly; one with high recovery
              and high interference is paying to be there.
            </Callout>
          </>
        ) : null}

        {view === 'threshold' ? (
          <>
            <Figure
              title="The importance threshold"
              description="The same feature, with its importance swept, and whether the model chooses to represent it at each level."
              caption="The threshold, measured rather than quoted. Below some importance the model drops the feature rather than pay the interference; above it, the feature is kept."
            >
              <TrendChart
                data={threshold.map((point) => ({ x: point.importance, kept: point.represented ? 1 : 0 }))}
                series={[{ key: 'kept', name: 'kept (1) or dropped (0)', colour: 'var(--accent-teal)' }]}
                xLabel="the feature's importance"
                yLabel="kept"
                height={240}
              />
            </Figure>

            <DataTable
              caption="The threshold, sampled"
              headers={['Importance', 'The model’s decision']}
              rows={threshold.map((point) => [fmt(point.importance, 5), point.represented ? 'kept' : 'dropped'])}
            />

            <Callout tone="note" title="Why the threshold exists at all">
              Hosting a feature costs the host the interference; dropping it costs the feature its own importance. The
              model drops a feature when the second price is lower than the first — and that is the whole of the
              threshold, in one sentence.
            </Callout>
          </>
        ) : null}

        {view === 'tradeoff' ? (
          <>
            <div className="stat-row">
              <Stat label="Free up to" value={`${dimensions}`} hint="the features a model of this size can host alone" />
              <Stat
                label="The newest feature’s price"
                value={fmt(tradeoff[tradeoff.length - 1]?.marginalLoss ?? 0, 4)}
                hint="what the last feature added to the loss"
              />
              <Stat
                label="Interference per kept feature"
                value={fmt(tradeoff[tradeoff.length - 1]?.interferencePerFeature ?? 0, 4)}
                hint="what one feature pays for the company it is in"
              />
              <Stat
                label="Dropped"
                value={`${tradeoff[tradeoff.length - 1]?.dropped ?? 0}`}
                hint="of the features offered"
                tone={(tradeoff[tradeoff.length - 1]?.dropped ?? 0) > 0 ? 'warn' : 'good'}
              />
            </div>

            <Figure
              title="The trade-off curve"
              description="The dimensions held fixed and the features added one at a time, most important first. Each point is a fit of its own."
              caption="Up to the number of dimensions each new feature is free — it takes a direction and interferes with nothing. Past that the model pays, and the two ways of paying are the two curves: the interference it accepts, and the loss of the features it drops instead. The dashed line is the loss of representing nothing at all, which is the floor the model is trading against."
            >
              <TrendChart
                data={tradeoff.map((point) => ({
                  x: point.features,
                  loss: point.loss,
                  reference: point.dropEverythingLoss,
                  interference: point.interference,
                }))}
                series={[
                  { key: 'loss', name: 'the loss', colour: 'var(--accent-indigo)' },
                  { key: 'reference', name: 'dropping everything', colour: 'var(--accent-amber)', dashed: true },
                  { key: 'interference', name: 'the interference', colour: 'var(--accent-rose)' },
                ]}
                referenceLines={[{ x: dimensions, label: `${dimensions} dimensions` }]}
                xLabel="the features offered"
                yLabel="value"
                height={280}
              />
            </Figure>

            <DataTable
              caption="Every fit on the curve"
              headers={[
                'Offered',
                'The loss',
                'Marginal',
                'Dropping all',
                'The interference',
                'Per kept feature',
                'Kept',
                'Dropped',
                'Features per direction',
              ]}
              rows={tradeoff.map((point) => [
                point.features,
                fmt(point.loss, 4),
                fmt(point.marginalLoss, 4),
                fmt(point.dropEverythingLoss, 4),
                fmt(point.interference, 4),
                fmt(point.interferencePerFeature, 4),
                point.represented,
                point.dropped,
                fmt(point.polysemanticity, 2),
              ])}
            />

            <Callout tone="note" title="The slider picks the regime, and the table shows why">
              Set the importance exponent to 0 and every feature matters equally, so no feature is worth dropping: the
              <em> dropped</em> column stays at zero and the whole cost arrives as interference, spread over everyone.
              Set it to 2 and a few features dominate: the tail is dropped as soon as it would have to share, the
              interference stays small, and the loss sits just under the price of dropping everything. Same dimensions,
              same algorithm, two different answers — which is the toy model’s actual point, and it is a claim about the
              two columns above rather than about the picture.
            </Callout>
          </>
        ) : null}

        {view === 'load' ? (
          <>
            <Figure
              title="How many features each direction carries"
              description="The effective number of features on each of the model’s directions, and the average across them."
              caption="The participation ratio of each direction. A direction carrying one feature is monosemantic; one carrying several is a mixture, and the model has superposed."
            >
              <DataTable
                caption="The load on each direction"
                headers={['Direction', 'Effective features', 'Interpretation']}
                rows={directionLoad(model).map((load, index) => [
                  index,
                  fmt(load, 3),
                  load < 1.2 ? 'monosemantic' : load < 2 ? 'a mixture of two' : 'a mixture of several',
                ])}
              />
            </Figure>

            <Callout tone="warning" title="This is what a neuron looks like">
              A direction carrying several features is exactly a polysemantic neuron: one unit of the model, responding
              to several things. The dictionary a sparse autoencoder learns is the attempt to recover the things rather
              than the unit.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
