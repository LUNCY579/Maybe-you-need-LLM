import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildCorpus, meanQuality } from '../../core/corpus'
import {
  ablationCurve,
  ablationPipeline,
  documentPerplexity,
  evaluateFixedHeldOut,
  evaluatePipeline,
  fitNGram,
  runPipeline,
  type CurveFilter,
} from '../../core/filters'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'pipeline' | 'stages' | 'perplexity' | 'quality' | 'curves'

/** The settings each swept filter is asked about, in the order the curve draws them. */
const CURVE_VALUES: Record<CurveFilter, number[]> = {
  maxPerplexity: [20, 40, 80, 120, 400],
  minTokens: [0, 45, 80, 120, 160],
  minAlignment: [-1, 0.2, 0.4, 0.6],
  dedupThreshold: [0.3, 0.45, 0.6, 0.8],
}

const CURVE_LABELS: Record<CurveFilter, string> = {
  maxPerplexity: 'The perplexity threshold',
  minTokens: 'The minimum length',
  minAlignment: 'The alignment required',
  dedupThreshold: 'The duplicate threshold',
}

export function PipelineLab() {
  const [view, setView] = useState<View>('pipeline')
  const [size, setSize] = useState(300)
  const [seed, setSeed] = useState(17)
  const [maxPerplexity, setMaxPerplexity] = useState(120)
  const [minTokens, setMinTokens] = useState(20)
  const [dedupThreshold, setDedupThreshold] = useState(0.8)
  const [removeDuplicates, setRemoveDuplicates] = useState(true)
  const [curveFilter, setCurveFilter] = useState<CurveFilter>('maxPerplexity')

  const corpus = useMemo(() => buildCorpus({ size, seed, vocabulary: 48, topics: 5 }), [size, seed])

  const config = useMemo(
    () => ({ maxPerplexity, minTokens, dedupThreshold, removeDuplicates }),
    [maxPerplexity, minTokens, dedupThreshold, removeDuplicates],
  )

  const result = useMemo(() => runPipeline(corpus, config, { backgroundFraction: 0.25 }), [corpus, config])

  const evaluation = useMemo(() => evaluatePipeline(corpus, result), [corpus, result])

  /** The same model, scored on every held-out document rather than only the survivors. */
  const fixedEvaluation = useMemo(() => evaluateFixedHeldOut(corpus, result.kept, { steps: 150 }), [corpus, result])

  /** Each ablation reruns the pipeline and trains twice, so only the view that shows it pays for it. */
  const ablation = useMemo(
    () =>
      view === 'quality' ? ablationPipeline(corpus, config, { training: { steps: 150 } }) : null,
    [view, corpus, config],
  )

  const curve = useMemo(
    () =>
      view === 'curves'
        ? ablationCurve(corpus, curveFilter, CURVE_VALUES[curveFilter], { config, training: { steps: 150 } })
        : null,
    [view, corpus, config, curveFilter],
  )

  /** The tightest setting in the sweep: the one that kept the fewest documents. */
  const smallest = useMemo(
    () => (curve ? curve.points.reduce((a, b) => (b.kept < a.kept ? b : a), curve.points[0]!) : null),
    [curve],
  )

  /** How much the survivor-scored accuracy flattered the tightest settings. */
  const widestGap = useMemo(
    () =>
      curve
        ? curve.points.reduce((gap, point) => Math.max(gap, point.accuracy - point.accuracyOnFullHeldOut), 0)
        : 0,
    [curve],
  )

  const perplexityHistogram = useMemo(() => {
    const bins = 12
    const maximum = Math.max(...result.perplexities)
    const counts = new Array<number>(bins).fill(0)
    for (const value of result.perplexities) {
      const index = Math.min(bins - 1, Math.floor((value / (maximum || 1)) * bins))
      counts[index] = (counts[index] ?? 0) + 1
    }
    return counts.map((count, index) => ({
      x: ((index + 0.5) / bins) * maximum,
      count,
    }))
  }, [result.perplexities])

  const unigram = useMemo(() => {
    const background = fitNGram(corpus.documents.slice(0, Math.floor(corpus.documents.length * 0.25)), { order: 1 })
    const ngram = fitNGram(corpus.documents.slice(0, Math.floor(corpus.documents.length * 0.25)))
    return corpus.documents.slice(0, 40).map((document) => ({
      id: document.id,
      unigram: documentPerplexity(background, document.tokens),
      ngram: documentPerplexity(ngram, document.tokens),
      spam: document.isSpam,
    }))
  }, [corpus])

  return (
    <div className="lab">
      <Panel
        title="Laboratory A · The pipeline"
        subtitle="A raw corpus, the filters, and the model trained on what survives them"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'pipeline', label: 'The pipeline' },
              { value: 'stages', label: 'The stages' },
              { value: 'perplexity', label: 'The perplexity' },
              { value: 'quality', label: 'The ablation' },
              { value: 'curves', label: 'The curves' },
            ]}
          />
          <Slider label="Documents" value={size} min={100} max={800} step={50} onChange={setSize} />
          <Slider
            label="The perplexity threshold"
            value={maxPerplexity}
            min={5}
            max={400}
            onChange={setMaxPerplexity}
            format={(value) => value.toFixed(0)}
          />
          <Slider label="The minimum length" value={minTokens} min={0} max={120} onChange={setMinTokens} />
          <Slider
            label="The duplicate threshold"
            value={dedupThreshold}
            min={0.4}
            max={0.99}
            step={0.01}
            onChange={setDedupThreshold}
            format={(value) => value.toFixed(2)}
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
          <div className="field">
            <span className="field-label">Deduplication</span>
            <button
              type="button"
              className={removeDuplicates ? 'btn btn-primary' : 'btn btn-default'}
              onClick={() => setRemoveDuplicates(!removeDuplicates)}
            >
              {removeDuplicates ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        <div className="stat-row">
          <Stat label="Documents in" value={String(corpus.documents.length)} />
          <Stat label="Documents kept" value={String(result.kept.length)} />
          <Stat
            label="The mean quality"
            value={fmt(result.meanQuality, 4)}
            hint="up from the raw corpus"
            tone={result.meanQuality > meanQuality(corpus.documents) ? 'good' : 'warn'}
          />
          <Stat
            label="The model’s accuracy"
            value={`${fmt(evaluation.accuracy * 100, 1)}%`}
            hint={`on the ${fixedEvaluation.heldOut - fixedEvaluation.heldOutRemoved} held-out documents the pipeline left`}
          />
          <Stat
            label="The same model, all questions"
            value={`${fmt(fixedEvaluation.accuracy * 100, 1)}%`}
            hint={`${fixedEvaluation.heldOutRemoved} of ${fixedEvaluation.heldOut} held-out documents were filtered out`}
            tone={fixedEvaluation.accuracy < evaluation.accuracy ? 'warn' : 'good'}
          />
        </div>

        {view === 'pipeline' ? (
          <>
            <Figure
              title="What the pipeline removed"
              description="The number of documents surviving each stage, in the order the stages run."
              caption="The cheap structural rules go first, then the model-based filter, then deduplication. Every stage only sees what the stage before it left."
            >
              <DataTable
                caption="The stages of the pipeline"
                headers={['Stage', 'Before', 'After', 'Removed']}
                rows={result.stages.map((stage) => [
                  stage.name,
                  stage.before,
                  stage.after,
                  stage.before - stage.after,
                ])}
              />
            </Figure>

            <Callout tone="note" title="The corpus here is synthetic">
              The documents are generated by this course’s own code: a Markov chain over a small vocabulary, with
              boilerplate, foreign text and near-duplicates mixed in. Every property the filters act on is known in
              advance, which is what lets the laboratory measure the filters against the truth.
            </Callout>
          </>
        ) : null}

        {view === 'stages' ? (
          <>
            <Figure
              title="The documents that survived, by domain"
              description="How many documents each domain contributed before and after the pipeline."
              caption="A filter that removes a whole domain is a statement about the mixture, whether or not it was meant to be one."
            >
              <DataTable
                caption="The domains, before and after"
                headers={['Domain', 'Before', 'After']}
                rows={(['books', 'news', 'code', 'forum', 'reference'] as const).map((domain) => {
                  const before = corpus.documents.filter((document) => document.domain === domain).length
                  const after = result.kept.filter((document) => document.domain === domain).length
                  return [domain, before, after]
                })}
              />
            </Figure>

            <Figure
              title="The perplexity of every document"
              description="A histogram of the perplexities the reference model assigned, and where the threshold sits."
              caption="The threshold is a single number, and the histogram says how much of the corpus it excludes. Moving it is the whole of the design decision."
            >
              <TrendChart
                data={perplexityHistogram}
                series={[{ key: 'count', name: 'the documents', colour: 'var(--accent-indigo)' }]}
                xLabel="the perplexity"
                yLabel="the documents"
                height={240}
              />
            </Figure>
          </>
        ) : null}

        {view === 'perplexity' ? (
          <>
            <Figure
              title="The unigram model against the n-gram model"
              description="The perplexity of the first documents under each model, and which of them are boilerplate."
              caption="Boilerplate has ordinary words in an unusual arrangement. The unigram model cannot see the arrangement and rates the boilerplate as good text; the n-gram model can, and does not."
            >
              <DataTable
                caption="The two reference models, side by side"
                headers={['Document', 'The unigram model', 'The n-gram model', 'Boilerplate?']}
                rows={unigram.map((row) => [
                  row.id,
                  fmt(row.unigram, 2),
                  fmt(row.ngram, 2),
                  row.spam ? 'yes' : 'no',
                ])}
              />
            </Figure>

            <Callout tone="definition" title="Why the reference model has to be an n-gram model">
              A cookie banner repeats the same common words over and over. A unigram model sees only that the words are
              common, and gives the banner a <em>low</em> perplexity — it looks like good text. The n-gram model sees
              that the arrangement never occurs in the corpus, and charges the document for it. That is the whole
              argument for the extra machinery.
            </Callout>
          </>
        ) : null}

        {view === 'quality' && ablation ? (
          <>
            <Figure
              title="The ablation table"
              description="What each filter is worth: the pipeline with that one filter removed, and the model trained on what is left. The accuracy on all questions is measured on every held-out document, including the ones that variant threw away."
              caption="A filter earns its place by making the model better on a fixed set of questions, not by removing documents. Two columns because the columns can disagree: one test set that shrinks as the filter is tightened is not a test set."
            >
              <DataTable
                caption="The ablation"
                headers={[
                  'The filter removed',
                  'Documents kept',
                  'The accuracy',
                  'The change',
                  'On all questions',
                  'The change there',
                  'The mean quality',
                ]}
                rows={ablation.rows.map((row) => [
                  row.active ? row.removed : `${row.removed} (off in the baseline)`,
                  row.kept,
                  `${fmt(row.accuracy * 100, 1)}%`,
                  `${row.delta >= 0 ? '+' : ''}${fmt(row.delta * 100, 2)} points`,
                  `${fmt(row.accuracyOnFullHeldOut * 100, 1)}%`,
                  `${row.deltaOnFullHeldOut >= 0 ? '+' : ''}${fmt(row.deltaOnFullHeldOut * 100, 2)} points`,
                  fmt(row.meanQuality, 4),
                ])}
              />
            </Figure>

            <Callout tone="warning" title="A negative change is not a rounding error">
              When removing a filter makes the model <em>better</em>, that filter was removing signal as well as
              noise. The table is how you find out, and the fix is the threshold rather than the rule. Read the two
              change columns together: the first is measured on whatever questions survived that variant, so a filter
              that deletes the hard documents shows up as a gain there and a loss on the fixed set.
            </Callout>
          </>
        ) : null}

        {view === 'curves' && curve && smallest ? (
          <>
            <div className="lab-controls">
              <SegmentedControl
                label="The filter swept"
                value={curveFilter}
                onChange={setCurveFilter}
                options={(Object.keys(CURVE_LABELS) as CurveFilter[]).map((filter) => ({
                  value: filter,
                  label: CURVE_LABELS[filter],
                }))}
              />
            </div>

            <div className="stat-row">
              <Stat
                label="The baseline, all questions"
                value={`${fmt(curve.baselineFixed.accuracy * 100, 1)}%`}
                hint={`every point is scored against the same ${curve.baselineFixed.heldOut} documents`}
              />
              <Stat
                label="The tightest setting kept"
                value={String(smallest.kept)}
                hint={`${CURVE_LABELS[curveFilter].toLowerCase()} ${fmt(smallest.value, 2)}`}
              />
              <Stat
                label="The most questions a setting deleted"
                value={String(Math.max(...curve.points.map((point) => point.heldOutRemoved)))}
                hint="out of the fixed held-out set"
              />
              <Stat
                label="The widest gap between the scores"
                value={`${fmt(widestGap * 100, 1)} points`}
                hint="the survivor score above the fixed one"
                tone={widestGap > 0.02 ? 'warn' : 'good'}
              />
            </div>

            <Figure
              title={`Sweeping ${CURVE_LABELS[curveFilter].toLowerCase()}`}
              description="Two accuracy curves for one filter: the score on the held-out documents each setting left in place, and the score on all of them."
              caption="Where the two lines separate, the filter was deleting questions rather than answers. A tightening that raises the upper line and lowers the lower one bought nothing."
            >
              <TrendChart
                data={curve.points.map((point) => ({
                  x: point.value,
                  survivor: point.accuracy,
                  fixed: point.accuracyOnFullHeldOut,
                }))}
                series={[
                  { key: 'survivor', name: 'the questions that survived', colour: 'var(--accent-indigo)' },
                  { key: 'fixed', name: 'every question', colour: 'var(--accent-amber)' },
                ]}
                xLabel={CURVE_LABELS[curveFilter]}
                yLabel="the accuracy"
                height={260}
              />
            </Figure>

            <Figure
              title="The same sweep, as a table"
              description="What each setting kept, how the model scored under both questions, and how many held-out documents the setting threw away."
              caption="The held-out column is the one to read first. A row with many removals is a row whose survivor score is measured on a different test set from every other row."
            >
              <DataTable
                caption="One filter, several thresholds"
                headers={[
                  CURVE_LABELS[curveFilter],
                  'Documents kept',
                  'The survivor score',
                  'The fixed score',
                  'Held-out removed',
                  'The mean quality',
                ]}
                rows={curve.points.map((point) => [
                  fmt(point.value, 2),
                  point.kept,
                  `${fmt(point.accuracy * 100, 1)}%`,
                  `${fmt(point.accuracyOnFullHeldOut * 100, 1)}%`,
                  point.heldOutRemoved,
                  fmt(point.meanQuality, 4),
                ])}
              />
            </Figure>

            <Callout tone="definition" title="Why the baseline is the same for every point">
              Each point reruns the whole pipeline with one threshold changed and the rest held at the settings above,
              and every model is scored against the fixed held-out set rather than whatever survived. A curve is a
              claim about one filter, and it is only that if the other four did not move.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
