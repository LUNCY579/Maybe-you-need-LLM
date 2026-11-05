import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildSuperpositionModel, generateFeatures } from '../../core/superposition'
import { evaluateAutoencoder, monosemanticity, trainAutoencoder } from '../../core/sae'
import { buildSuperposedSetup, splittingCurve, sparsitySweep } from '../../core/splitting'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'
import { AUTOENCODER_DEFAULTS } from '../../content/labDefaults'

type View = 'train' | 'features' | 'splitting'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const AUTOENCODER_VIEWS: { value: View; label: string }[] = [
  { value: 'train', label: 'The training' },
  { value: 'features', label: 'The features' },
  { value: 'splitting', label: 'The splitting' },
]

export function AutoencoderLab() {
  const [view, setView] = useViewParam(AUTOENCODER_VIEWS)
  const [featureCount, setFeatureCount] = useState(AUTOENCODER_DEFAULTS.featureCount)
  const [dimensions, setDimensions] = useState(AUTOENCODER_DEFAULTS.dimensions)
  const [dictionarySize, setDictionarySize] = useState(AUTOENCODER_DEFAULTS.dictionarySize)
  const [sparsity, setSparsity] = useState(AUTOENCODER_DEFAULTS.sparsity)
  const [seed, setSeed] = useState(AUTOENCODER_DEFAULTS.seed)
  const [result, setResult] = useState<ReturnType<typeof trainAutoencoder> | null>(null)

  /* The splitting setup: two features in two dimensions, at a chosen angle. */
  const [angle, setAngle] = useState(AUTOENCODER_DEFAULTS.angle)
  const [rare, setRare] = useState(AUTOENCODER_DEFAULTS.rare)
  const [lambda, setLambda] = useState(AUTOENCODER_DEFAULTS.lambda)
  const [dictionary, setDictionary] = useState(AUTOENCODER_DEFAULTS.splittingDictionary)
  const [runs, setRuns] = useState(AUTOENCODER_DEFAULTS.runs)
  const [curve, setCurve] = useState<ReturnType<typeof splittingCurve> | null>(null)

  const features = useMemo(
    () => generateFeatures(featureCount, dimensions, AUTOENCODER_DEFAULTS.streamSeed),
    [featureCount, dimensions],
  )

  /** The residual stream: the activation the model produces for each feature. */
  const activations = useMemo(() => {
    const model = buildSuperpositionModel(features, dimensions, { seed: AUTOENCODER_DEFAULTS.streamSeed })
    return features.map((feature) => {
      const h = new Array<number>(dimensions).fill(0)
      for (let k = 0; k < features.length; k++) {
        for (let i = 0; i < dimensions; i++) {
          h[i] = (h[i] ?? 0) + (model.columns[k]?.[i] ?? 0) * feature.value
        }
      }
      return h
    })
  }, [features, dimensions])

  const train = () => {
    setResult(
      trainAutoencoder(activations, dictionarySize, {
        steps: AUTOENCODER_DEFAULTS.steps,
        learningRate: AUTOENCODER_DEFAULTS.learningRate,
        sparsityCoefficient: sparsity,
        seed,
      }),
    )
  }

  const evaluation = useMemo(
    () => (result ? evaluateAutoencoder(result.autoencoder, activations) : null),
    [result, activations],
  )

  const featureScores = useMemo(
    () => (result ? monosemanticity(result.autoencoder, activations, features.map((f) => f.id)) : []),
    [result, activations, features],
  )

  /** Two ground-truth features packed into a plane, sampled from a seeded stream. */
  const superposed = useMemo(
    () =>
      buildSuperposedSetup({
        angle: (angle * Math.PI) / 180,
        prevalence: [1, rare],
        seed,
      }),
    [angle, rare, seed],
  )

  /** One trained dictionary, read out against those two directions. */
  const sweep = useMemo(
    () => sparsitySweep(superposed, { lambdas: [lambda], dictionaryFeatures: dictionary, training: { seed } })[0]!,
    [superposed, lambda, dictionary, seed],
  )

  const runSweep = () =>
    setCurve(splittingCurve(superposed, { runs, dictionaryFeatures: dictionary, training: { seed } }))

  return (
    <div className="lab">
      <Panel
        title="Laboratory B · The sparse autoencoder"
        subtitle="A dictionary trained here, on a residual stream generated here"
        accent="teal"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={AUTOENCODER_VIEWS}
          />
          <Slider label="Features" value={featureCount} min={2} max={16} onChange={setFeatureCount} />
          <Slider label="Activation width" value={dimensions} min={2} max={12} onChange={setDimensions} />
          <Slider
            label="Dictionary size"
            value={dictionarySize}
            min={4}
            max={64}
            step={4}
            onChange={setDictionarySize}
            hint="More features than the activation has dimensions: an overcomplete dictionary."
          />
          <Slider
            label="The sparsity coefficient λ"
            value={sparsity}
            min={0}
            max={0.2}
            step={0.005}
            onChange={setSparsity}
            format={(value) => value.toFixed(3)}
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
          {view === 'splitting' ? (
            <>
              <Slider
                label="The angle between them"
                value={angle}
                min={15}
                max={90}
                onChange={setAngle}
                format={(value) => `${value}°`}
                hint="Two features this close in a two-dimensional stream are hard to separate, and this is the case the dictionary is being asked to fix."
              />
              <Slider
                label="The rare feature"
                value={rare}
                min={0.1}
                max={1}
                step={0.05}
                onChange={setRare}
                format={(value) => (value === 1 ? 'as frequent as the other' : value.toFixed(2))}
                hint="Its share of the activations, against the first feature’s one. Below one it is the rarer of the two."
              />
              <Slider
                label="The sparsity coefficient λ"
                value={lambda}
                min={0}
                max={0.15}
                step={0.005}
                onChange={setLambda}
                format={(value) => value.toFixed(3)}
                hint="The one knob that decides whether the dictionary pays to keep a merged row."
              />
              <Slider
                label="The dictionary"
                value={dictionary}
                min={3}
                max={16}
                onChange={setDictionary}
                hint="Eight elements for two features is the overcomplete case: room enough for each feature to get more than one row."
              />
              <Slider label="The initialisations" value={runs} min={2} max={12} onChange={setRuns} />
            </>
          ) : null}
          <div className="field">
            <span className="field-label">The autoencoder</span>
            <button type="button" className="btn btn-primary" onClick={train}>
              Train from scratch
            </button>
            <p className="field-hint">
              Trained in this tab, on activations generated by this tab. There is no checkpoint to download.
            </p>
          </div>
        </div>

        {view === 'train' ? (
          result && evaluation ? (
            <>
              <div className="stat-row">
                <Stat
                  label="The reconstruction error"
                  value={fmt(evaluation.reconstructionError, 5)}
                  hint="mean squared error"
                />
                <Stat
                  label="Explained variance"
                  value={`${fmt(evaluation.explainedVariance * 100, 1)}%`}
                  tone={evaluation.explainedVariance > 0.8 ? 'good' : 'warn'}
                />
                <Stat label="The L0" value={fmt(evaluation.l0, 2)} hint="active features per activation" />
                <Stat label="The final loss" value={fmt(result.history[result.history.length - 1]!.loss, 5)} />
              </div>

              <Figure
                title="The training curve"
                description="The reconstruction loss and the sparsity penalty over the training steps."
                caption="Two objectives in one loss: the squared error wants a faithful reconstruction, and the L1 penalty wants a sparse code. The dictionary that results is a compromise between them, and the sparsity coefficient is what sets the compromise."
              >
                <TrendChart
                  data={result.history.map((entry) => ({
                    x: entry.step,
                    reconstruction: entry.reconstruction,
                    sparsity: entry.sparsity,
                  }))}
                  series={[
                    { key: 'reconstruction', name: 'the reconstruction loss', colour: 'var(--accent-teal)' },
                    { key: 'sparsity', name: 'the sparsity penalty', colour: 'var(--accent-amber)' },
                  ]}
                  xLabel="the training step"
                  yLabel="loss"
                  height={280}
                />
              </Figure>

              <Callout tone="definition" title="What the sparsity bought">
                The L0 is the number of features that are on for a given activation. The fewer there are, the more
                likely each one is about a single thing — which is the property that makes a dictionary feature worth
                reading.
              </Callout>
            </>
          ) : (
            <Callout tone="note" title="Nothing trained yet">
              Press <strong>Train from scratch</strong>. The encoder, the decoder and the optimiser are all built here.
            </Callout>
          )
        ) : null}

        {view === 'features' ? (
          result ? (
            <>
              <Figure
                title="How monosemantic is each dictionary feature?"
                description="For every feature in the dictionary, the fraction of its activations that come from a single input feature."
                caption="A feature that scores one is monosemantic: it turns on for one thing and nothing else. A feature that scores a fraction is a mixture, and it is not the thing a circuit is made of."
              >
                <DataTable
                  caption="The dictionary"
                  headers={['Feature', 'Monosemanticity', 'Reading']}
                  rows={featureScores.map((score, index) => [
                    index,
                    fmt(score, 3),
                    score > 0.8 ? 'one thing' : score > 0.4 ? 'mostly one thing' : 'a mixture',
                  ])}
                />
              </Figure>

              <Callout tone="warning" title="The comparison that matters">
                A dictionary feature is only worth having if it is more interpretable than the neuron it replaces.
                The neurons of the toy model are directions carrying several features, and a dictionary feature that
                scores a fraction is no better than the neuron it was supposed to explain away.
              </Callout>
            </>
          ) : (
            <Callout tone="note" title="Nothing trained yet">
              Press <strong>Train from scratch</strong> on the training tab first.
            </Callout>
          )
        ) : null}

        {view === 'splitting' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The pair has split"
                value={sweep.split ? 'yes' : 'no'}
                hint="one row per feature, and no row serving two"
                tone={sweep.split ? 'good' : 'warn'}
              />
              <Stat
                label="Rows serving two features"
                value={String(sweep.report.mergedRows.length)}
                hint="the polysemantic ones"
                tone={sweep.report.mergedRows.length === 0 ? 'good' : 'warn'}
              />
              <Stat
                label="Features with no row of their own"
                value={String(sweep.report.unownedFeatures.length)}
                hint={`of ${superposed.directions.length} ground-truth features`}
                tone={sweep.report.unownedFeatures.length === 0 ? 'good' : 'warn'}
              />
              <Stat
                label="Features leaking onto another’s direction"
                value={String(sweep.report.absorbed.length)}
                hint="absorption, counted"
                tone={sweep.report.absorbed.length === 0 ? 'good' : 'warn'}
              />
            </div>

            <Figure
              title={`The dictionary at λ = ${lambda.toFixed(3)}, against the two directions it was meant to find`}
              description="Every live row of the decoder, which feature it fires for, and which feature it is pointing at."
              caption={`The stream is two-dimensional and the features are ${angle}° apart, so at least one row has to share a direction. A row is called an owner when it fires for one feature only and points at it above a cosine of 0.9 — the threshold the tests use — and a row that fires for both is the merged, polysemantic case the paper draws. This is one fit of a stochastic optimiser: the curve below is what the same sweep looks like from several initialisations.`}
            >
              <DataTable
                caption={`The ${sweep.report.rows.length} dictionary elements`}
                headers={['Row', 'Firing', 'Purity per feature', 'Features served', 'Points at', 'Owns']}
                rows={sweep.report.rows.map((row) => [
                  row.index,
                  fmt(row.firing, 3),
                  row.purity.map((value) => fmt(value, 3)).join(' · '),
                  row.respondsTo.length,
                  fmt(Math.max(...row.cosine), 3),
                  row.alive ? (row.owns === null ? '—' : superposed.names[row.owns] ?? `feature ${row.owns}`) : 'collapsed',
                ])}
              />
              <DataTable
                caption="Where each ground-truth feature ended up"
                headers={['Feature', 'Prevalence', 'Rows of its own', 'Alignment', 'The leak', 'Leaking onto']}
                rows={sweep.report.features.map((feature) => [
                  feature.name,
                  fmt(feature.prevalence, 3),
                  feature.dedicated.length,
                  fmt(feature.alignment, 3),
                  fmt(feature.absorption, 4),
                  feature.absorbedInto === null ? '—' : superposed.names[feature.absorbedInto] ?? `feature ${feature.absorbedInto}`,
                ])}
              />
            </Figure>

            <div className="field">
              <span className="field-label">The sparsity sweep</span>
              <button type="button" className="btn btn-primary" onClick={runSweep}>
                {`Run the sweep: seven λ from 0 to 0.15, ${runs} initialisations each`}
              </button>
              <p className="field-hint">
                {`${runs * 7} trainings, each from a different seeded start on the same data. That is why it is a button and not a slider.`}
              </p>
            </div>

            {curve ? (
              <>
                <Figure
                  title="Feature splitting, as a rate"
                  description="For each value of λ, how many of the runs ended with every feature owned, how many still carried a merged row, and the mean L0."
                  caption="Whether one particular dictionary splits at one particular λ is an outcome of stochastic optimisation and not worth a claim; that most of them do, as the penalty grows, is. The merged row's share falls as the split's rises, and then the penalty starves the fit — the runs marked degraded reconstructed less than half the variance, so their counts measure a failed autoencoder rather than a sparse one."
                >
                  <TrendChart
                    data={curve.map((point) => ({
                      x: point.lambda,
                      split: point.splitRuns,
                      merged: point.mergedRuns,
                      degraded: point.degradedRuns,
                      l0: point.l0,
                    }))}
                    series={[
                      { key: 'split', name: `runs that split (of ${runs})`, colour: 'var(--accent-teal)' },
                      { key: 'merged', name: 'runs with a merged row', colour: 'var(--accent-rose)', dashed: true },
                      { key: 'degraded', name: 'runs the penalty starved', colour: 'var(--accent-amber)', dashed: true },
                    ]}
                    xLabel="the sparsity coefficient λ"
                    yLabel="runs"
                    yDomain={[0, runs]}
                    height={260}
                  />
                  <DataTable
                    caption="The sweep, one row per λ"
                    headers={['λ', 'The L0', 'Explained variance', 'Owned features', 'Merged rows', 'Split runs', 'Degraded', 'The leak, per feature']}
                    rows={curve.map((point) => [
                      point.lambda.toFixed(3),
                      fmt(point.l0, 3),
                      `${fmt(point.explainedVariance * 100, 1)}%`,
                      fmt(point.ownedFeatures, 2),
                      fmt(point.mergedRows, 2),
                      `${point.splitRuns}/${point.runs}`,
                      point.degradedRuns > 0 ? `${point.degradedRuns}/${point.runs}` : '—',
                      point.absorptionPerFeature.map((value) => fmt(value, 4)).join(' · '),
                    ])}
                  />
                  <p className="field-hint">
                    The λ column is the only thing that changes between the rows: the same {superposed.activations.length}{' '}
                    activations, the same dictionary size, and seeds {seed} to {seed + runs - 1}.
                  </p>
                </Figure>

                <Callout tone="warning" title="Absorption is our measurement, not the paper’s metric">
                  Cunningham et al. describe a feature losing its own dictionary element to a neighbour; they do not
                  publish a formula for it. The leak above is the component of a feature's direction that lands on the
                  best-matching row it does not own, averaged over the activations in which that feature is on — an
                  operationalisation written for this course. What it says here is that make one feature rare and it
                  ends up with an element of its own in fewer runs than the frequent feature does, and is reconstructed
                  by leaning on the frequent feature's row instead. No number on this tab is quoted from a figure.
                </Callout>
              </>
            ) : (
              <Callout tone="note" title="One run is an anecdote">
                The tables above are a single fit. Run the sweep to get the rates — the split at one λ and not at
                another is the phenomenon, and a run cannot show it.
              </Callout>
            )}
          </>
        ) : null}
      </Panel>
    </div>
  )
}
