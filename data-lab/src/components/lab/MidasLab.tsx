import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildCorpus, meanQuality, type Document } from '../../core/corpus'
import { adaptivePerplexityFilter, midasFilter, signatureEstimate } from '../../core/midas'
import { compareFilters } from '../../core/agreement'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'midas' | 'perplexity' | 'agreement'

/** Which corner of the corpus the perplexity filter's reference model is allowed to see. */
type Reference = 'pool' | 'books' | 'code'

const REFERENCE_LABELS: Record<Reference, string> = {
  pool: 'A quarter of the pool',
  books: 'The books only',
  code: 'The code only',
}

/** Documents the corpus's own fields call boilerplate or unseen-language. */
const unwantedOf = (documents: Document[]): number =>
  documents.filter((document) => document.isSpam || document.isForeign).length

export function MidasLab() {
  const [view, setView] = useState<View>('midas')
  const [size, setSize] = useState(300)
  const [seed, setSeed] = useState(17)
  const [threshold, setThreshold] = useState(0.8)
  const [keepSimilar, setKeepSimilar] = useState(1)
  const [shingleSize, setShingleSize] = useState(5)
  const [permutations, setPermutations] = useState(64)
  const [bandCount, setBandCount] = useState(16)
  const [keepFraction, setKeepFraction] = useState(0.9)
  const [order, setOrder] = useState<1 | 2 | 3>(3)
  const [reference, setReference] = useState<Reference>('pool')

  const corpus = useMemo(() => buildCorpus({ size, seed, vocabulary: 48, topics: 5 }), [size, seed])

  const byId = useMemo(() => new Map(corpus.documents.map((document) => [document.id, document])), [corpus])

  const midas = useMemo(
    () =>
      view === 'midas'
        ? midasFilter(corpus.documents, { shingleSize, permutations, bandCount, threshold, keepSimilar })
        : null,
    [view, corpus, shingleSize, permutations, bandCount, threshold, keepSimilar],
  )

  const background = useMemo(
    () => corpus.documents.slice(0, Math.max(10, Math.floor(corpus.documents.length * 0.25))),
    [corpus],
  )

  /** The same pool, cut by a model that saw only one domain — which model is the whole decision. */
  const references = useMemo(
    () =>
      view === 'perplexity'
        ? (['pool', 'books', 'code'] as Reference[]).map((name) => ({
            name,
            documents:
              name === 'pool'
                ? background
                : corpus.documents.filter((document) => document.domain === name),
          }))
        : [],
    [view, corpus, background],
  )

  const cuts = useMemo(
    () =>
      references.map((entry) => ({
        ...entry,
        result: adaptivePerplexityFilter(corpus.documents, {
          keepFraction,
          order,
          referencePool: entry.documents,
        }),
      })),
    [references, corpus, keepFraction, order],
  )

  const chosen = useMemo(() => cuts.find((cut) => cut.name === reference) ?? cuts[0], [cuts, reference])

  const perplexityHistogram = useMemo(() => {
    const perplexities = chosen?.result.perplexities ?? []
    if (perplexities.length === 0) return []
    const bins = 12
    const maximum = Math.max(...perplexities)
    const counts = new Array<number>(bins).fill(0)
    for (const value of perplexities) {
      const index = Math.min(bins - 1, Math.floor((value / (maximum || 1)) * bins))
      counts[index] = (counts[index] ?? 0) + 1
    }
    return counts.map((count, index) => ({ x: ((index + 0.5) / bins) * maximum, count }))
  }, [chosen])

  /** How much the two single-domain references disagree with the pool-fitted one about which documents go. */
  const disagreement = useMemo(() => {
    if (cuts.length < 2 || !chosen) return null
    const mine = new Set(chosen.result.dropped.map((document) => document.id))
    return cuts
      .filter((cut) => cut.name !== chosen.name)
      .map((cut) => {
        const theirs = cut.result.dropped.filter((document) => !mine.has(document.id))
        return { name: cut.name, different: theirs.length, outOf: mine.size }
      })
  }, [cuts, chosen])

  const agreement = useMemo(
    () =>
      view === 'agreement'
        ? compareFilters(corpus, corpus.documents, {
            keepFraction,
            referenceDomains: reference === 'pool' ? undefined : [reference],
          })
        : null,
    [view, corpus, keepFraction, reference],
  )

  /** The documents one rule dropped and the other kept, with the ground truth still attached. */
  const exclusive = useMemo(() => {
    if (!agreement) return []
    const agreementIds = new Set(agreement.agreement.dropped.map((document) => document.id))
    const perplexityIds = new Set(agreement.perplexity.dropped.map((document) => document.id))
    return [
      {
        name: 'the two-view score',
        documents: agreement.agreement.dropped.filter((document) => !perplexityIds.has(document.id)),
      },
      {
        name: 'the perplexity score',
        documents: agreement.perplexity.dropped.filter((document) => !agreementIds.has(document.id)),
      },
    ]
  }, [agreement])

  const unwanted = unwantedOf(corpus.documents)

  return (
    <div className="lab">
      <Panel
        title="Laboratory E · MIDAS and the reference model"
        subtitle="Clusters instead of pairs, and a quantile instead of a number"
        accent="teal"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'midas', label: 'The similar documents' },
              { value: 'perplexity', label: 'The adaptive cut' },
              { value: 'agreement', label: 'The two views' },
            ]}
          />
          <Slider label="Documents" value={size} min={100} max={600} step={50} onChange={setSize} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
          {view === 'midas' ? (
            <>
              <Slider
                label="The similarity that makes a cluster"
                value={threshold}
                min={0.4}
                max={0.99}
                step={0.01}
                onChange={setThreshold}
                format={(value) => value.toFixed(2)}
              />
              <Slider label="How many of a cluster survive" value={keepSimilar} min={1} max={4} onChange={setKeepSimilar} />
              <Slider label="The shingle size" value={shingleSize} min={2} max={12} onChange={setShingleSize} />
              <Slider
                label="The permutations"
                value={permutations}
                min={16}
                max={128}
                step={16}
                onChange={setPermutations}
              />
              <Slider label="The bands" value={bandCount} min={4} max={32} step={4} onChange={setBandCount} />
            </>
          ) : null}
          {view !== 'midas' ? (
            <>
              <Slider
                label="The fraction kept"
                value={keepFraction}
                min={0.3}
                max={0.99}
                step={0.01}
                onChange={setKeepFraction}
                format={(value) => `${(value * 100).toFixed(0)}%`}
                hint="A quantile, not a perplexity number: this says how much goes."
              />
              <Slider
                label="The reference model"
                value={order}
                min={1}
                max={3}
                onChange={(value) => setOrder(value as 1 | 2 | 3)}
                format={(value) => `${value}-gram`}
              />
              <SegmentedControl
                label="What the reference model was fit on"
                value={reference}
                onChange={setReference}
                options={(Object.keys(REFERENCE_LABELS) as Reference[]).map((name) => ({
                  value: name,
                  label: REFERENCE_LABELS[name],
                }))}
              />
            </>
          ) : null}
        </div>

        <div className="stat-row">
          <Stat label="Documents in" value={String(corpus.documents.length)} />
          <Stat
            label="Boilerplate and unseen text"
            value={String(unwanted)}
            hint="the ground truth the filters are scored against"
          />
          <Stat
            label="The raw mean quality"
            value={fmt(meanQuality(corpus.documents), 4)}
            hint="what any filter has to beat"
          />
          {view === 'midas' && midas ? (
            <>
              <Stat
                label="Clusters found"
                value={String(midas.clusters.length)}
                hint={`of ${midas.trueDuplicates} documents the corpus calls duplicates`}
              />
              <Stat
                label="Duplicates removed"
                value={String(midas.trueDuplicatesRemoved)}
                hint={`recall ${fmt(midas.recall, 3)}`}
                tone={midas.recall > 0.9 ? 'good' : 'warn'}
              />
              <Stat
                label="The removed that were unique"
                value={fmt(midas.falsePositiveFraction * 100, 1) + '%'}
                hint={`against ${fmt(midas.candidatePairs)} pairs the index proposed`}
                tone={midas.falsePositiveFraction > 0.1 ? 'warn' : 'good'}
              />
            </>
          ) : null}
          {view === 'perplexity' && chosen ? (
            <>
              <Stat label="Kept" value={String(chosen.result.kept.length)} />
              <Stat
                label="The quantile it cut at"
                value={fmt(chosen.result.threshold, 2)}
                hint={`a ${order}-gram model of ${REFERENCE_LABELS[chosen.name].toLowerCase()}`}
              />
              <Stat
                label="Unwanted documents dropped"
                value={`${chosen.result.unwantedDropped} of ${unwanted}`}
                hint={`${chosen.result.unwantedKept} survived the cut`}
                tone={chosen.result.unwantedDropped >= unwanted * 0.8 ? 'good' : 'warn'}
              />
              <Stat
                label="The kept mean quality"
                value={fmt(chosen.result.keptMeanQuality, 4)}
                hint={`dropped half averages ${fmt(chosen.result.droppedMeanQuality, 4)}`}
                tone={chosen.result.keptMeanQuality > meanQuality(corpus.documents) ? 'good' : 'warn'}
              />
            </>
          ) : null}
          {view === 'agreement' && agreement ? (
            <>
              <Stat
                label="Unwanted dropped by agreement"
                value={`${agreement.agreement.unwantedDropped} of ${unwanted}`}
                hint={`the perplexity rule drops ${agreement.perplexity.unwantedDropped}`}
                tone={agreement.agreement.unwantedDropped >= agreement.perplexity.unwantedDropped ? 'good' : 'warn'}
              />
              <Stat
                label="Clean documents it cost"
                value={String(agreement.agreement.cleanDropped)}
                hint={`against ${agreement.perplexity.cleanDropped} for the one-view rule`}
                tone={agreement.agreement.cleanDropped <= agreement.perplexity.cleanDropped ? 'good' : 'warn'}
              />
              <Stat
                label="The two rules' drop sets overlap"
                value={fmt(agreement.dropSetOverlap, 3)}
                hint={`${agreement.onlyAgreementDrops} only agreement, ${agreement.onlyPerplexityDrops} only perplexity`}
              />
            </>
          ) : null}
        </div>

        {view === 'midas' && midas ? (
          <>
            <Figure
              title="The clusters"
              description="Groups of documents the index said were the same story, what survived, and the strongest similarity inside the group."
              caption="A cluster is a connected component, so a document similar to a similar document joins it even when the outer pair falls below the threshold. That is what the last column is for: it is the strongest pair inside, not the weakest link."
            >
              <DataTable
                caption="What the filter grouped"
                headers={['Members', 'Kept', 'Removed', 'The strongest similarity inside']}
                rows={midas.clusters.slice(0, 15).map((cluster) => [
                  cluster.members.join(' · '),
                  cluster.kept.length,
                  cluster.removed.length,
                  fmt(cluster.internalSimilarity, 4),
                ])}
              />
            </Figure>

            <Figure
              title="What was dropped, and against what"
              description="Each removed document, the kept document it was matched to, the similarity that decided it and the MinHash estimate of the same number."
              caption="The decision uses the exact shingle sets; the estimate is what the signature would have said. The two disagree by the error of the estimator, which is why the index proposes and the sets decide."
            >
              <DataTable
                caption="The removals"
                headers={['Removed', 'Matched', 'The similarity', 'The estimate']}
                rows={midas.removed.slice(0, 15).map((removal) => {
                  const dropped = byId.get(removal.id)
                  const keptAgainst = byId.get(removal.matched)
                  return [
                    removal.id,
                    removal.matched,
                    fmt(removal.similarity, 4),
                    dropped && keptAgainst
                      ? fmt(signatureEstimate(dropped, keptAgainst, permutations, shingleSize), 4)
                      : '—',
                  ]
                })}
              />
            </Figure>

            <Callout tone="definition" title="Why keeping one of each cluster is not obviously right">
              Plain deduplication collapses a cluster to a single document. MIDAS keeps
              {' '}
              {keepSimilar === 1 ? 'one' : keepSimilar} of them, because a phrase that occurs three times is not three
              copies of one document — it is a phrase that occurs three times, and a corpus with no repetition at all
              is flatter than the web it came from. Moving the slider is the argument: at 1 the corpus loses every
              repeated story, at 4 it keeps them and the removal count falls.
            </Callout>
          </>
        ) : null}

        {view === 'perplexity' ? (
          <>
            <Figure
              title="The perplexities, and where the quantile falls"
              description="A histogram of the scores the reference model assigned to every document in the pool."
              caption="The cut is a fraction of the pool, so the number it lands on is a property of this corpus rather than of the filter. The same fraction on a different corpus cuts at a different perplexity."
            >
              <TrendChart
                data={perplexityHistogram}
                series={[{ key: 'count', name: 'the documents', colour: 'var(--accent-cyan)' }]}
                xLabel="the perplexity"
                yLabel="the documents"
                height={240}
              />
            </Figure>

            <Figure
              title="The same pool under three reference models"
              description="One model fit on a quarter of the pool, and two fit on a single domain, each cutting the same fraction. The last column counts the documents this reference drops that the chosen reference keeps."
              caption="Which model scores the documents *is* the filter: three cuts of the same size, and the sets they remove are not the same set."
            >
              <DataTable
                caption="One fraction, three references"
                headers={[
                  'The reference',
                  'Documents',
                  'The cut at',
                  'Unwanted dropped',
                  'The kept quality',
                  'Disagreement',
                ]}
                rows={cuts.map((cut) => [
                  REFERENCE_LABELS[cut.name],
                  `${cut.result.kept.length} kept`,
                  fmt(cut.result.threshold, 2),
                  `${cut.result.unwantedDropped} of ${unwanted}`,
                  fmt(cut.result.keptMeanQuality, 4),
                  cut.name === reference ? '—' : (disagreement?.find((d) => d.name === cut.name)?.different ?? 0),
                ])}
              />
            </Figure>

            <Callout tone="note" title="Why the reference is not the corpus's own order">
              Fitting on the first quarter of the pool is what a pipeline can actually do: it has no curated data to
              learn from yet. The cost is that the model learns that quarter's habits, so documents from the domains
              it under-saw look surprising for a reason that has nothing to do with their quality. A single-domain
              reference exaggerates the effect, which is what the table above is for.
            </Callout>
          </>
        ) : null}

        {view === 'agreement' && agreement ? (
          <>
            <Figure
              title="Two rules, one pool, the same number of documents removed"
              description="The cross-view score against the perplexity score, both cutting to the fraction set above."
              caption="The comparison is not whether a filter cleans data — every filter does that — but what it costs in clean documents to get there."
            >
              <DataTable
                caption="What each rule threw away"
                headers={['The rule', 'Kept', 'Unwanted dropped', 'Clean dropped', 'The dominant domain', 'The kept quality']}
                rows={[agreement.agreement, agreement.perplexity].map((cut) => [
                  cut.name,
                  cut.kept.length,
                  cut.unwantedDropped,
                  cut.cleanDropped,
                  `${fmt(cut.droppedDomainShare * 100, 1)}%`,
                  fmt(cut.keptMeanQuality, 4),
                ])}
              />
            </Figure>

            <Figure
              title="The documents the two rules disagree about"
              description="Of the documents only one rule dropped, how many were actually boilerplate or unseen text and how many were ordinary documents that rule disliked for reasons of its own."
              caption="The exclusive sets are where the two opinions differ, so this is the table that says which opinion is better informed. A document that reads one way to the generative view and votes another way in the bag of words is visible only to a score that reads both."
            >
              <DataTable
                caption="Only one rule dropped it"
                headers={['Dropped only by', 'Documents', 'Of which unwanted', 'Of which clean']}
                rows={exclusive.map((row) => [
                  row.name,
                  row.documents.length,
                  unwantedOf(row.documents),
                  row.documents.length - unwantedOf(row.documents),
                ])}
              />
            </Figure>

            <Callout tone="warning" title="The half of the claim that does not reproduce here">
              The structural argument for a cross-modal score has two halves. The first holds in this analogue: a
              document that reads one way to the generative view and votes another way in the bag of words is caught,
              and catching it costs fewer clean documents than the perplexity rule spends. The second half — that a
              perplexity filter is fragile because its reference model saw only one corner of the corpus — barely
              moves the outcome. Switching the reference does change which documents go — the adaptive-cut view counts
              how many — but the kept mean quality moves by a hair: the tests beside the agreement module measure
              0.5806 against 0.5801. Both views here read the same 48 tokens, so they share the statistics the
              argument says a cross-modal score escapes. A real CLIP filter has a text encoder and an image encoder
              with nothing in common; the null result is about the analogue, not about CLIP.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
