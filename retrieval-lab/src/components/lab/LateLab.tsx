import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildCorpus } from '../../core/corpus'
import {
  denseRecall,
  indexSize,
  lateInteractionRank,
  lengthBias,
  maxSimScore,
  trainEncoder,
} from '../../core/dense'
import {
  buildMultiHopWorld,
  compareMultiHop,
  evidenceRanks,
  multiHopCurve,
} from '../../core/multihop'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'maxsim' | 'multihop'

export function LateLab() {
  const [view, setView] = useState<View>('maxsim')
  const [size, setSize] = useState(400)
  const [dimension, setDimension] = useState(24)
  const [steps, setSteps] = useState(150)
  const [normalise, setNormalise] = useState(false)
  const [seed, setSeed] = useState(5)

  const corpus = useMemo(() => buildCorpus({ size, seed: 4 }), [size])
  const trained = useMemo(
    () => trainEncoder(corpus, { steps, dimension, seed }),
    [corpus, steps, dimension, seed],
  )

  const world = useMemo(() => (view === 'multihop' ? buildMultiHopWorld({ seed: seed + 2 }) : null), [view, seed])
  const comparison = useMemo(() => (world ? compareMultiHop(world, 10) : null), [world])
  const curve = useMemo(() => (world ? multiHopCurve(world, 30) : []), [world])
  const ranks = useMemo(
    () => (world ? world.questions.map((question) => evidenceRanks(world, question)) : []),
    [world],
  )

  const query = corpus.queries[0]!
  const bias = useMemo(
    () => lengthBias(corpus, trained.encoder, query.words, { normalise }),
    [corpus, trained.encoder, query.words, normalise],
  )
  const ranked = useMemo(
    () => lateInteractionRank(corpus, trained.encoder, query.words, { normalise }),
    [corpus, trained.encoder, query.words, normalise],
  )
  const single = useMemo(() => denseRecall(corpus, trained.encoder, 10), [corpus, trained.encoder])

  const lengths = useMemo(() => {
    const scores = corpus.passages.map((passage) => ({
      length: passage.words.length,
      score: maxSimScore(trained.encoder, query.words, passage.words, corpus.vocabulary, { normalise }),
    }))
    return scores.slice(0, 14)
  }, [corpus, trained.encoder, query.words, normalise])

  return (
    <div className="lab">
      <Panel
        title="Laboratory C · The late interaction"
        subtitle="Comparing a question and a document word by word, and what the index costs"
        accent="amber"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'maxsim', label: 'The MaxSim score' },
              { value: 'multihop', label: 'The multi-hop question' },
            ]}
          />
          {view === 'maxsim' ? (
            <>
              <Slider label="The documents" value={size} min={100} max={800} step={50} onChange={setSize} />
              <Slider label="The dimension" value={dimension} min={8} max={64} step={4} onChange={setDimension} />
              <Slider label="The steps" value={steps} min={10} max={400} step={10} onChange={setSteps} />
              <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
              <div className="field">
                <span className="field-label">The normalisation</span>
                <button
                  type="button"
                  className={normalise ? 'btn btn-primary' : 'btn btn-default'}
                  onClick={() => setNormalise(!normalise)}
                >
                  {normalise ? 'On' : 'Off'}
                </button>
                <p className="field-hint">Dividing the score by the number of candidates the maximum was taken over.</p>
              </div>
            </>
          ) : (
            <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
          )}
        </div>

        {view === 'maxsim' ? (
          <>
        <div className="stat-row">
          <Stat
            label="The length bias"
            value={fmt(bias, 4)}
            hint="the correlation of the score with the length"
            tone={Math.abs(bias) > 0.2 ? 'warn' : 'good'}
          />
          <Stat label="The single-vector recall" value={`${fmt(single * 100, 1)}%`} />
          <Stat label="The vectors in a single-vector index" value={indexSize(corpus, false).toLocaleString()} />
          <Stat
            label="The vectors in a late index"
            value={indexSize(corpus, true).toLocaleString()}
            tone="warn"
          />
        </div>

        <Figure
          title="The score against the length"
          description="The MaxSim score of the first documents and how long they are."
          caption="The maximum is taken over more candidates in a longer document, so the score inherits a preference for length. The bias is measurable, and so is what the normalisation does to it."
        >
          <TrendChart
            data={lengths.map((entry) => ({ x: entry.length, score: entry.score }))}
            series={[{ key: 'score', name: 'the MaxSim score', colour: 'var(--accent-amber)' }]}
            xLabel="the length of the document"
            yLabel="the score"
            height={260}
          />
        </Figure>

        <Figure
          title="The ranking under the late interaction"
          description="The documents the late-interaction retriever returns, with the right answer marked."
          caption="A single vector cannot say which part of a document matched which part of the question. A vector per word can — and the index it needs is orders of magnitude larger."
        >
          <DataTable
            caption="The ranking"
            headers={['The document', 'Its length', 'The score', 'The right answer?']}
            rows={ranked.slice(0, 12).map((row) => {
              const passage = corpus.passages.find((entry) => entry.id === row.id)
              return [row.id, passage?.words.length ?? 0, fmt(row.score, 5), row.id === query.relevant ? 'yes' : '—']
            })}
          />
        </Figure>

        <Callout tone="warning" title="The price, and the catch">
          The late-interaction index stores a vector for every word of every document — {indexSize(corpus, true).toLocaleString()} of them here, against {indexSize(corpus, false).toLocaleString()} for the single-vector
          index. And the encoder here was trained for the single-vector objective, not for MaxSim: a late-interaction
          retriever is more accurate when the encoder is trained for it, and this laboratory measures the two effects
          that are there — the length bias, and the difference in the index — rather than assuming them.
        </Callout>
          </>
        ) : null}

        {view === 'multihop' && world && comparison ? (
          <>
            <p className="body-text">
              A multi-hop question needs two documents at once, one for each of its aspects. The three scorers below
              are given the same question and the same {world.documents.length} candidates, and the score is whether
              both evidence documents are in the top ten.
            </p>

            <div className="stat-row">
              <Stat
                label="Both found, lexical"
                value={`${fmt(comparison.lexical.both * 100, 0)}%`}
                hint="one hop matches a word, the other does not"
                tone="warn"
              />
              <Stat
                label="Both found, dense"
                value={`${fmt(comparison.dense.both * 100, 0)}%`}
                hint="the average loses the exact token"
                tone="warn"
              />
              <Stat
                label="Both found, late"
                value={`${fmt(comparison.late.both * 100, 0)}%`}
                hint="each word keeps its own match"
                tone="good"
              />
              <Stat label="The candidates" value={String(world.documents.length)} />
            </div>

            <Figure
              title="Both evidence documents, as the depth grows"
              description="The fraction of multi-hop questions whose two evidence documents are both in the top k, for each scorer."
              caption="The late interaction has both documents within the first few ranks. The dense retriever needs a depth far beyond ten to see them, because the evidence is diluted by the rest of its document. The lexical retriever never gets the hop whose words the question does not use."
            >
              <TrendChart
                data={curve}
                series={[
                  { key: 'lexical', name: 'the lexical score', colour: 'var(--accent-rose)' },
                  { key: 'dense', name: 'the dense score', colour: 'var(--accent-teal)' },
                  { key: 'late', name: 'the late interaction', colour: 'var(--accent-amber)' },
                ]}
                xLabel="k"
                yLabel="both found"
                height={280}
              />
            </Figure>

            <Figure
              title="What the three scorers find"
              description="Both evidence documents, at least one, and the mean rank of the first, at a depth of ten."
              caption="The lexical scorer finds the document whose word the question uses, and only that one. The dense scorer's single vector is so diluted that neither evidence document is in the top ten. The late interaction finds both, in the first two ranks."
            >
              <DataTable
                caption="The three scorers"
                headers={['The scorer', 'Both in the top ten', 'At least one', 'The mean rank of the first']}
                rows={[
                  ['the lexical score', `${fmt(comparison.lexical.both * 100, 0)}%`, `${fmt(comparison.lexical.atLeastOne * 100, 0)}%`, fmt(comparison.lexical.meanRank, 1)],
                  ['the dense score', `${fmt(comparison.dense.both * 100, 0)}%`, `${fmt(comparison.dense.atLeastOne * 100, 0)}%`, fmt(comparison.dense.meanRank, 1)],
                  ['the late interaction', `${fmt(comparison.late.both * 100, 0)}%`, `${fmt(comparison.late.atLeastOne * 100, 0)}%`, fmt(comparison.late.meanRank, 1)],
                ]}
              />
            </Figure>

            <Figure
              title="The rank of each evidence document"
              description="Where each question's two evidence documents land, under each scorer."
              caption="In the lexical column one rank is near the top and the other is near the bottom: the hop the question paraphrases is invisible to it. The dense ranks are what dilution looks like — both documents are there, far down the list. The late interaction puts each of them at the top."
            >
              <DataTable
                caption="The ranks"
                headers={['The question', 'The evidence', 'Lexical', 'Dense', 'Late']}
                rows={world.questions.map((question, index) => [
                  question.id,
                  question.evidence.join(' and '),
                  ranks[index]?.lexical.join(', ') ?? '—',
                  ranks[index]?.dense.join(', ') ?? '—',
                  ranks[index]?.late.join(', ') ?? '—',
                ])}
              />
            </Figure>

            <Callout tone="definition" title="What each score keeps of the question">
              The lexical score keeps the words, and a word the question does not share is invisible to it. The dense
              score keeps one vector for the question and one for the document, and a long document's vector is mostly
              everything else it says. The late score keeps a vector per word, so the exact match survives the padding
              — which is the whole of the difference, and the reason the paper calls it late: the comparison happens
              after the encoder, not inside it.
            </Callout>

            <Callout tone="note" title="What this demonstration is, and is not">
              The embeddings here are constructed rather than trained, and the aspects are orthogonal on purpose, so
              the three scores differ only in what they can represent. It is not a reproduction of a published
              multi-hop benchmark, and no number on it is quoted: a real ColBERT trains its token vectors with MaxSim,
              which this laboratory does not reproduce. What it does show is the mechanism — a token that survives
              averaging and a word that does not survive paraphrasing.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
