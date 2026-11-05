import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildCorpus } from '../../core/corpus'
import {
  bands,
  decontaminate,
  deduplicate,
  jaccard,
  lshRecall,
  minhashSignature,
  plantBenchmarkLeaks,
  shingles,
  signatureSimilarity,
} from '../../core/dedup'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'fuzzy' | 'decontamination'

export function DedupLab() {
  const [view, setView] = useState<View>('fuzzy')
  const [size, setSize] = useState(300)
  const [seed, setSeed] = useState(29)
  const [threshold, setThreshold] = useState(0.8)
  const [shingleSize, setShingleSize] = useState(5)
  const [permutations, setPermutations] = useState(64)
  const [bandCount, setBandCount] = useState(16)
  const [ngramSize, setNgramSize] = useState(8)
  const [overlapThreshold, setOverlapThreshold] = useState(0.5)
  const [editSpacing, setEditSpacing] = useState(17)
  const [copies, setCopies] = useState(8)

  const corpus = useMemo(() => buildCorpus({ size, seed, duplicateRate: 0.25 }), [size, seed])

  const deduplication = useMemo(
    () => deduplicate(corpus.documents, { threshold, shingleSize, permutations, bandCount }),
    [corpus, threshold, shingleSize, permutations, bandCount],
  )

  /**
   * The evaluation examples.
   *
   * They come from a *different* corpus. A benchmark drawn from the training
   * documents is trivially contaminated — the originals match their own n-grams
   * exactly, and the near-duplicates the generator planted match them too — which
   * measures the corpus’s redundancy rather than the filter.
   */
  const benchmarkSource = useMemo(
    () => buildCorpus({ size: 60, seed: seed + 25, vocabulary: 48, topics: 5 }),
    [seed],
  )

  const leaks = useMemo(
    () => plantBenchmarkLeaks(corpus.documents, benchmarkSource.documents, { copies, editSpacing }),
    [corpus, benchmarkSource, copies, editSpacing],
  )

  const decontamination = useMemo(
    () => decontaminate(leaks.pool, leaks.benchmark, { ngramSize, threshold: overlapThreshold }),
    [leaks, ngramSize, overlapThreshold],
  )

  const found = decontamination.contaminated.filter((entry) => leaks.planted.includes(entry.id)).length
  const innocent = decontamination.contaminated.length - found

  /** The same eight leaks, at every n-gram length the laboratory can be set to. */
  const sweep = useMemo(
    () =>
      [4, 5, 8, 12, 16].map((n) => {
        const result = decontaminate(leaks.pool, leaks.benchmark, { ngramSize: n, threshold: overlapThreshold })
        const hits = result.contaminated.filter((entry) => leaks.planted.includes(entry.id)).length
        return { n, found: `${hits} of ${copies}`, innocent: result.contaminated.length - hits }
      }),
    [leaks, copies, overlapThreshold],
  )

  const recallCurve = useMemo(() => {
    const rows: { x: number; recall: number }[] = []
    for (let similarity = 0.05; similarity <= 0.99; similarity += 0.05) {
      rows.push({ x: similarity, recall: lshRecall(similarity, bandCount, permutations) })
    }
    return rows
  }, [bandCount, permutations])

  const examplePair = useMemo(() => {
    const first = corpus.documents[0]!
    const second = corpus.documents.find((document) => document.duplicateOf === first.id) ?? corpus.documents[1]!
    const a = shingles(first.tokens, shingleSize)
    const b = shingles(second.tokens, shingleSize)
    const signature = minhashSignature(a, permutations)
    const other = minhashSignature(b, permutations)
    return {
      id: first.id,
      other: second.id,
      trueSimilarity: jaccard(a, b),
      estimate: signatureSimilarity(signature, other),
      bands: bands(signature, bandCount).length,
    }
  }, [corpus, shingleSize, permutations, bandCount])

  return (
    <div className="lab">
      <Panel
        title="Laboratory B · Deduplication"
        subtitle="The same document twice is not twice the data"
        accent="amber"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'fuzzy', label: 'The near-duplicates' },
              { value: 'decontamination', label: 'The decontamination' },
            ]}
          />
          <Slider label="Documents" value={size} min={100} max={600} step={50} onChange={setSize} />
          {view === 'fuzzy' ? (
            <>
              <Slider
                label="The duplicate threshold"
                value={threshold}
                min={0.4}
                max={0.99}
                step={0.01}
                onChange={setThreshold}
                format={(value) => value.toFixed(2)}
              />
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
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        {view === 'fuzzy' ? (
          <>
            <div className="stat-row">
              <Stat label="Documents in" value={String(corpus.documents.length)} />
              <Stat label="Removed as duplicates" value={String(deduplication.removed.length)} />
              <Stat
                label="The pairs the index proposed"
                value={String(deduplication.candidatePairs)}
                hint="against every possible pair"
              />
              <Stat
                label="The estimated similarity"
                value={fmt(examplePair.estimate, 3)}
                hint={`the truth is ${fmt(examplePair.trueSimilarity, 3)}`}
                tone={Math.abs(examplePair.estimate - examplePair.trueSimilarity) < 0.1 ? 'good' : 'warn'}
              />
            </div>

            <Figure
              title="What the index caught"
              description="The pairs the LSH index proposed, and the similarity that confirmed them."
              caption="The index proposes and the shingle sets decide. The number of proposals against the number of possible pairs is the whole reason the search is affordable."
            >
              <DataTable
                caption="The duplicates that were removed"
                headers={['Removed', 'Matched', 'The similarity']}
                rows={deduplication.removed.slice(0, 20).map((removal) => [
                  removal.id,
                  removal.matched,
                  fmt(removal.similarity, 4),
                ])}
              />
            </Figure>

            <Figure
              title="The probability the index catches a pair"
              description="For a given similarity, the probability that two documents become candidates under the band structure."
              caption="More bands catch more pairs and compare more pairs. The curve is the dial between those two costs."
            >
              <TrendChart
                data={recallCurve}
                series={[{ key: 'recall', name: 'the probability of a candidate', colour: 'var(--accent-amber)' }]}
                xLabel="the Jaccard similarity"
                yLabel="the probability"
                height={240}
              />
            </Figure>

            <Callout tone="definition" title="What the estimate is worth">
              The MinHash estimate of a pair’s similarity is the fraction of the {permutations} hash functions on which
              the two documents agree. Its error is of order √((1−J)/{permutations}), and the table above compares it
              with the similarity computed exactly.
            </Callout>
          </>
        ) : null}

        {view === 'decontamination' ? (
          <>
            <div className="lab-controls">
              <Slider
                label="The n-gram size"
                value={ngramSize}
                min={3}
                max={16}
                onChange={setNgramSize}
                hint="How many consecutive tokens have to survive for a match to count."
              />
              <Slider
                label="The overlap required"
                value={overlapThreshold}
                min={0.2}
                max={0.9}
                step={0.05}
                onChange={setOverlapThreshold}
                format={(value) => `${(value * 100).toFixed(0)}%`}
                hint="Of the example’s n-grams, not of the document’s."
              />
              <Slider
                label="How edited the copies are"
                value={editSpacing}
                min={5}
                max={40}
                onChange={setEditSpacing}
                hint={`one token in every ${editSpacing} is replaced`}
              />
              <Slider
                label="Leaks planted"
                value={copies}
                min={1}
                max={12}
                onChange={setCopies}
                format={(value) => String(value)}
              />
            </div>

            <div className="stat-row">
              <Stat label="Documents in" value={String(leaks.pool.length)} hint={`${copies} of them are leaks`} />
              <Stat
                label="Leaks found"
                value={`${found} of ${copies}`}
                tone={found === copies ? 'good' : 'warn'}
                hint="out of the copies planted on purpose"
              />
              <Stat
                label="Innocent documents removed"
                value={String(innocent)}
                tone={innocent === 0 ? 'good' : 'warn'}
                hint="real corpus members the rule flagged"
              />
              <Stat label="The corpus that survives" value={String(decontamination.kept.length)} />
            </div>

            <Figure
              title="What the rule found, and what it mistook"
              description="Every document the n-gram overlap removed, marked by whether it was one of the planted leaks."
              caption={`Each leak is an evaluation example with one token in every ${editSpacing} replaced. That edits ${fmt(100 / editSpacing, 1)}% of the document — to a reader the same text, to this rule ${found} of ${copies} of them findable.`}
            >
              <DataTable
                caption="What the decontamination removed"
                headers={['The document', 'The example it matched', 'The overlap', 'Was it a leak?']}
                rows={decontamination.contaminated.slice(0, 30).map((row) => [
                  row.id,
                  row.matched,
                  fmt(row.overlap, 4),
                  leaks.planted.includes(row.id) ? 'planted' : 'innocent',
                ])}
              />
            </Figure>

            <Figure
              title="The same leaks at every n-gram length"
              description="Found leaks and innocent documents removed, at the overlap threshold currently set."
              caption="Shortening the n-gram buys recall with real data: the 4-gram catches every leak and a lot of the corpus with them. At an edit spacing of 7 or less the 8-grams of a copy share nothing with its example, and the rule reports a clean corpus."
            >
              <DataTable
                caption="The n-gram length against what it costs"
                headers={['The n-gram', 'Leaks found', 'Innocent removed']}
                rows={sweep.map((row) => [row.n, row.found, row.innocent])}
              />
            </Figure>

            <Callout tone="warning" title="The two ways this goes wrong">
              Too short an n-gram and ordinary documents start to match the benchmark, and real data is thrown away.
              Too long an n-gram — or too edited a copy — and the leak slips through, and the score stops meaning
              anything. The arithmetic is the one to remember: a document of L tokens has L−n+1 n-grams, edits spaced{' '}
              {editSpacing} apart destroy about n of each one, so the overlap left is roughly 1 − n/{editSpacing}. That
              is why {overlapThreshold > 0.5 ? 'a threshold above a half needs the spacing to be under twice the n-gram length' : 'a lower threshold catches edited copies but costs more ordinary documents'}.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
