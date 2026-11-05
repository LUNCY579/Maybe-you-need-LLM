import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { generateCorpus, runPipeline } from '../../core/data'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable } from '@llm-materials/course-ui'

type View = 'pipeline' | 'mixture'

export function DataLab() {
  const [view, setView] = useState<View>('pipeline')
  const [documents, setDocuments] = useState(400)
  const [qualityThreshold, setQualityThreshold] = useState(0.3)
  const [duplicateRate, setDuplicateRate] = useState(0.15)
  const [deduplicate, setDeduplicate] = useState(true)
  const [balance, setBalance] = useState(0)
  const [seed, setSeed] = useState(5)

  const corpus = useMemo(
    () => generateCorpus({ documents, seed, duplicateRate, sources: ['web', 'books', 'code', 'papers'] }),
    [documents, seed, duplicateRate],
  )

  const result = useMemo(
    () =>
      runPipeline(corpus, 500, {
        qualityThreshold,
        deduplicate,
        duplicateSimilarity: 0.85,
        perSourceLimit: balance > 0 ? Math.floor(documents / 4 / balance) : undefined,
      }),
    [corpus, qualityThreshold, deduplicate, balance, documents],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory D · The data pipeline"
        subtitle="A generated corpus, run through the stages, with the token count watched"
        accent="rose"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'pipeline', label: 'The pipeline' },
              { value: 'mixture', label: 'The mixture' },
            ]}
          />
          <Slider label="Documents" value={documents} min={50} max={1200} step={50} onChange={setDocuments} />
          <Slider
            label="Quality threshold"
            value={qualityThreshold}
            min={0}
            max={0.8}
            step={0.05}
            onChange={setQualityThreshold}
            format={(value) => value.toFixed(2)}
          />
          <Slider
            label="Duplicate rate in the corpus"
            value={duplicateRate}
            min={0}
            max={0.5}
            step={0.05}
            onChange={setDuplicateRate}
            format={(value) => `${fmt(value * 100, 0)}%`}
          />
          <Slider
            label="Balance across sources"
            value={balance}
            min={0}
            max={4}
            step={1}
            onChange={setBalance}
            format={(value) => (value === 0 ? 'off' : `${value}×`)}
          />
          <div className="field">
            <span className="field-label">Deduplication</span>
            <div className="segmented" role="group" aria-label="Deduplication">
              <button
                type="button"
                className={deduplicate ? 'segment segment-active' : 'segment'}
                aria-pressed={deduplicate}
                onClick={() => setDeduplicate(true)}
              >
                on
              </button>
              <button
                type="button"
                className={!deduplicate ? 'segment segment-active' : 'segment'}
                aria-pressed={!deduplicate}
                onClick={() => setDeduplicate(false)}
              >
                off
              </button>
            </div>
          </div>
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="Documents in" value={String(corpus.length)} />
          <Stat label="Documents kept" value={String(result.kept.length)} />
          <Stat
            label="Tokens retained"
            value={`${fmt(result.tokenRetention * 100, 1)}%`}
            hint="of the original training budget"
            tone={result.tokenRetention > 0.6 ? 'good' : 'warn'}
          />
          <Stat
            label="Tokens"
            value={`${(result.tokens / 1000).toFixed(0)}k`}
            hint="what the run would actually train on"
          />
        </div>

        {view === 'pipeline' ? (
          <>
            <Figure
              title="What each stage removes"
              description="Every stage of the pipeline, and how many documents it removed."
              caption="The stages are not independent. The quality filter changes which documents the deduplication sees, so the thresholds and the order are decisions with consequences."
            >
              <DataTable
                caption="The pipeline"
                headers={['Stage', 'Kept', 'Removed', 'Share of the original bytes']}
                rows={result.stages.map((stage) => [
                  stage.name,
                  stage.kept.toLocaleString(),
                  stage.removed.toLocaleString(),
                  fmt(stage.bytesKept * 100, 1) + '%',
                ])}
              />
            </Figure>

            <Callout tone="definition" title="What the stages are for">
              The quality filter removes the documents a classifier says are not worth training on. Deduplication
              removes the text that appears more than once — which is not a tidy-up, because repeated text is a signal
              the model would otherwise learn from. The balance stage caps what any one source can contribute, which is
              a decision about what the model should know.
            </Callout>

            <Callout tone="note" title="The budget is the token count">
              Everything downstream is priced in tokens. A pipeline that keeps 62% of the documents keeps 62% of the
              training budget for the same model and the same number of steps — and the model that results is a
              different model, not the same one trained for less.
            </Callout>
          </>
        ) : null}

        {view === 'mixture' ? (
          <>
            <Figure
              title="The mixture that comes out"
              description="The surviving documents, broken down by source, with the share of the bytes each contributes."
              caption="The mixture is a research decision, and the pipeline decides it. Moving the balance slider changes what the model sees, and the effect on the learning is not proportional to the change in the bytes."
            >
              <DataTable
                caption="The mixture"
                headers={['Source', 'Documents', 'Bytes', 'Share']}
                rows={result.mixture.map((entry) => [
                  entry.source,
                  entry.documents.toLocaleString(),
                  entry.bytes.toLocaleString(),
                  fmt((entry.bytes / Math.max(1, result.mixture.reduce((a, e) => a + e.bytes, 0))) * 100, 1) + '%',
                ])}
              />
            </Figure>

            <Callout tone="warning" title="A mixture is a claim">
              The proportions in which the sources are combined say what the model should know. A corpus that is 90%
              code is a different model from one that is 90% books, and no amount of careful filtering afterwards undoes
              that choice.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
