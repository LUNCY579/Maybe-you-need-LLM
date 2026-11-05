import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildCorpus, documentFrequency } from '../../core/corpus'
import { bm25, buildIndex, meanReciprocalRank, randomRecall, recallAt } from '../../core/sparse'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'index' | 'bm25'

export function SparseLab() {
  const [view, setView] = useState<View>('index')
  const [size, setSize] = useState(400)
  const [k1, setK1] = useState(1.2)
  const [b, setB] = useState(0.75)
  const [seed, setSeed] = useState(4)

  const corpus = useMemo(() => buildCorpus({ size, seed }), [size, seed])
  const index = useMemo(() => buildIndex(corpus), [corpus])
  const frequencies = useMemo(() => documentFrequency(corpus), [corpus])

  const recall = useMemo(() => recallAt(index, corpus, { k: 10, k1, b }), [index, corpus, k1, b])
  const random = useMemo(() => randomRecall(corpus, 10), [corpus])
  const mrr = useMemo(() => meanReciprocalRank(index, corpus, { k1, b }), [index, corpus, k1, b])

  const kCurve = useMemo(() => {
    const rows: { x: number; recall: number; random: number }[] = []
    for (let k = 1; k <= 20; k++) {
      rows.push({ x: k, recall: recallAt(index, corpus, { k, k1, b }), random: randomRecall(corpus, k) })
    }
    return rows
  }, [index, corpus, k1, b])

  const example = useMemo(() => {
    const query = corpus.queries[0]!
    const relevant = corpus.passages[query.relevant]!
    const scores = corpus.passages
      .map((passage) => ({
        id: passage.id,
        length: passage.words.length,
        score: bm25(index, query.words, passage.words, { k1, b }),
        relevant: passage.id === query.relevant,
      }))
      .sort((a, c) => c.score - a.score)
    return { query, relevant, scores: scores.slice(0, 12), overlap: overlapOf(query.words, relevant.words) }
  }, [corpus, index, k1, b])

  return (
    <div className="lab">
      <Panel
        title="Laboratory A · The sparse index"
        subtitle="Matching the words, exactly"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'index', label: 'The index' },
              { value: 'bm25', label: 'The score' },
            ]}
          />
          <Slider label="The documents" value={size} min={100} max={800} step={50} onChange={setSize} />
          <Slider
            label="k1"
            value={k1}
            min={0}
            max={3}
            step={0.1}
            onChange={setK1}
            format={(value) => value.toFixed(1)}
            hint="How quickly the term frequency stops paying."
          />
          <Slider
            label="b"
            value={b}
            min={0}
            max={1}
            step={0.05}
            onChange={setB}
            format={(value) => value.toFixed(2)}
            hint="How strongly the document length is normalised."
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="The postings" value={index.postingCount.toLocaleString()} />
          <Stat
            label="The recall at ten"
            value={`${fmt(recall * 100, 1)}%`}
            tone={recall > random ? 'good' : 'warn'}
            hint={`against ${fmt(random * 100, 1)}% at random`}
          />
          <Stat label="The reciprocal rank" value={fmt(mrr, 4)} />
          <Stat label="The words in the question" value={String(example.query.words.length)} />
        </div>

        {view === 'index' ? (
          <>
            <Figure
              title="The size of the index"
              description="The number of postings against the number of documents, as the corpus grows."
              caption="Every distinct word in every document is one posting. The postings are what a lexical search costs, and they are what makes it affordable."
            >
              <DataTable
                caption="The index"
                headers={['The quantity', 'The value']}
                rows={[
                  ['the documents', index.documents],
                  ['the postings', index.postingCount],
                  ['the postings per document', fmt(index.postingCount / Math.max(1, index.documents), 1)],
                  ['the words in the vocabulary', corpus.vocabulary],
                  ['the average document length', fmt(index.averageLength, 1)],
                ]}
              />
            </Figure>

            <Figure
              title="How rare the words are"
              description="The distribution of the document frequency: how many words appear in one document, and how many appear in many."
              caption="The words that appear in one document are the ones the inverse document frequency rewards, and they are the ones a question almost never contains."
            >
              <DataTable
                caption="The document frequency"
                headers={['The document frequency', 'The words with it']}
                rows={[1, 2, 5, 10, 50, 100]
                  .map((frequency) => [
                    frequency,
                    frequencies.filter((value) => value === frequency).length,
                  ])
                  .filter((row) => row[1] > 0)}
              />
            </Figure>

            <Callout tone="note" title="Why the question and the answer use different words">
              A question is written to be read by a person, and a document is written to be read by whoever needed it.
              The words they share are the ones everybody uses — and the ones the inverse document frequency says carry
              the least information. The laboratory's corpus is built that way on purpose, and the recall shows the
              cost.
            </Callout>
          </>
        ) : null}

        {view === 'bm25' ? (
          <>
            <Figure
              title="The recall against the depth"
              description="The recall at k of the lexical retriever, against the recall of a random ranking."
              caption="The random line is the number to beat. A retriever that cannot stay above it has learned nothing — and the gap between them is the whole of the lexical approach."
            >
              <TrendChart
                data={kCurve}
                series={[
                  { key: 'recall', name: 'the lexical retriever', colour: 'var(--accent-indigo)' },
                  { key: 'random', name: 'a random ranking', colour: 'var(--accent-rose)' },
                ]}
                xLabel="k"
                yLabel="the recall"
                height={280}
              />
            </Figure>

            <Figure
              title="The scores of the best documents"
              description="The BM25 score of the highest-scoring documents, with the right answer marked."
              caption="The right answer is in the list, and it is not at the top. The words the question uses are the words the document does not."
            >
              <DataTable
                caption="The ranking"
                headers={['The document', 'Its length', 'The score', 'The right answer?']}
                rows={example.scores.map((row) => [
                  row.id,
                  row.length,
                  fmt(row.score, 3),
                  row.relevant ? 'yes' : '—',
                ])}
              />
            </Figure>

            <Callout tone="definition" title="The overlap that was missed">
              The question and its answer share {example.overlap} distinct words out of {example.query.words.length}.
              A lexical retriever has nothing else to go on, and that is the whole of its problem.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}

/** The number of distinct words two texts share. */
function overlapOf(a: number[], b: number[]): number {
  const set = new Set(b)
  let count = 0
  for (const word of new Set(a)) if (set.has(word)) count++
  return count
}
