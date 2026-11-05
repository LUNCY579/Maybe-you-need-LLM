import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildCorpus } from '../../core/corpus'
import { buildIndex, randomRecall, recallAt } from '../../core/sparse'
import { denseRank, denseRecall, recallByDimension, trainEncoder } from '../../core/dense'
import { Button, Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'encoder' | 'training' | 'encoders' | 'dimension'

const SWEEP_DIMENSIONS = [4, 8, 16, 24, 32, 48, 64]

export function DenseLab() {
  const [view, setView] = useState<View>('encoder')
  const [size, setSize] = useState(400)
  const [dimension, setDimension] = useState(24)
  const [steps, setSteps] = useState(150)
  const [temperature, setTemperature] = useState(0.1)
  const [seed, setSeed] = useState(5)
  const [sweep, setSweep] = useState<{ dimension: number; recall: number; parameters: number }[] | null>(null)

  const corpus = useMemo(() => buildCorpus({ size, seed: 4 }), [size])
  const trained = useMemo(
    () => trainEncoder(corpus, { steps, dimension, temperature, seed }),
    [corpus, steps, dimension, temperature, seed],
  )
  const separate = useMemo(
    () =>
      view === 'encoders'
        ? trainEncoder(corpus, { steps, dimension, temperature, seed, separate: true })
        : null,
    [view, corpus, steps, dimension, temperature, seed],
  )
  const index = useMemo(() => buildIndex(corpus), [corpus])
  const lexical = useMemo(() => recallAt(index, corpus, { k: 10 }), [index, corpus])
  const dense = useMemo(() => denseRecall(corpus, trained.encoder, 10), [corpus, trained.encoder])

  const parameters = corpus.vocabulary * dimension + dimension

  const changeSize = (value: number) => {
    setSize(value)
    setSweep(null)
  }
  const changeSeed = (value: number) => {
    setSeed(value)
    setSweep(null)
  }

  const example = useMemo(() => {
    const query = corpus.queries[0]!
    const ranked = denseRank(corpus, trained.encoder, query.words)
    return { query, ranked: ranked.slice(0, 10) }
  }, [corpus, trained.encoder])

  return (
    <div className="lab">
      <Panel
        title="Laboratory B · The dense retriever"
        subtitle="A question and a document in the same space, learned here"
        accent="teal"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'encoder', label: 'The encoder' },
              { value: 'training', label: 'The training' },
              { value: 'encoders', label: 'The two encoders' },
              { value: 'dimension', label: 'The dimension' },
            ]}
          />
          <Slider label="The documents" value={size} min={100} max={800} step={50} onChange={changeSize} />
          <Slider label="The dimension" value={dimension} min={8} max={64} step={4} onChange={setDimension} />
          <Slider label="The steps" value={steps} min={10} max={400} step={10} onChange={setSteps} />
          <Slider
            label="The temperature"
            value={temperature}
            min={0.02}
            max={0.5}
            step={0.01}
            onChange={setTemperature}
            format={(value) => value.toFixed(2)}
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={changeSeed} />
        </div>

        <div className="stat-row">
          <Stat
            label="The dense recall at ten"
            value={`${fmt(dense * 100, 1)}%`}
            tone={dense > lexical ? 'good' : 'warn'}
          />
          <Stat label="The lexical recall at ten" value={`${fmt(lexical * 100, 1)}%`} tone="warn" />
          <Stat label="A random ranking" value={`${fmt(randomRecall(corpus, 10) * 100, 1)}%`} />
          <Stat
            label="The final loss"
            value={fmt(trained.history[trained.history.length - 1] ?? 0, 4)}
          />
        </div>

        {view === 'encoder' ? (
          <>
            <Figure
              title="The ranking, under the learned embedding"
              description="The documents the trained retriever returns for a question, with the right answer marked."
              caption="The retriever was never told which words matter. It was told that a question should be closer to its own answer than to the other answers in the batch — and it worked out which words carry the topic."
            >
              <DataTable
                caption="The ranking"
                headers={['The document', 'The score', 'The right answer?']}
                rows={example.ranked.map((row) => [
                  row.id,
                  fmt(row.score, 5),
                  row.id === example.query.relevant ? 'yes' : '—',
                ])}
              />
            </Figure>

            <Callout tone="definition" title="What the model learned">
              The embedding is a matrix with one row per word. The training pushes the words of a topic towards each
              other and the background words towards the origin — and the question, which is mostly background words,
              ends up close to the document that is mostly the topic’s words. Nothing about the question was changed;
              only the space it lives in.
            </Callout>
          </>
        ) : null}

        {view === 'training' ? (
          <>
            <Figure
              title="The training curve"
              description="The loss of the contrastive objective, and the recall of the retriever it produces."
              caption="The loss is the cross-entropy of the diagonal of the batch’s score matrix. The recall is the number that matters, and it climbs as the loss falls."
            >
              <TrendChart
                data={trained.history.map((loss, index) => ({ x: index, loss }))}
                series={[{ key: 'loss', name: 'the contrastive loss', colour: 'var(--accent-teal)' }]}
                xLabel="the step"
                yLabel="the loss"
                height={260}
              />
            </Figure>

            <Figure
              title="The two retrievers, on the same questions"
              description="The recall of the lexical retriever and of the trained one, at each depth."
              caption="The gap opens immediately. The lexical retriever is matching words, and the questions and the answers do not use the same words."
            >
              <DataTable
                caption="The comparison"
                headers={['k', 'The lexical retriever', 'The trained retriever', 'A random ranking']}
                rows={[1, 5, 10, 20].map((k) => [
                  k,
                  `${fmt(recallAt(index, corpus, { k }) * 100, 1)}%`,
                  `${fmt(denseRecall(corpus, trained.encoder, k) * 100, 1)}%`,
                  `${fmt(randomRecall(corpus, k) * 100, 1)}%`,
                ])}
              />
            </Figure>

            <Callout tone="warning" title="The negatives are nearly free">
              Every batch of questions gives one positive each and all the others as negatives: sixteen questions make
              256 pairs, of which sixteen are right. That is why the contrastive objective is affordable, and it is also
              why the batch size is a hyper-parameter that matters.
            </Callout>
          </>
        ) : null}

        {view === 'encoders' && separate ? (
          <>
            <p className="body-text">
              The two sides of a bi-encoder can share one projection or have one each. The rows below are the two
              arrangements trained on the same questions, for the same number of steps, with the same seed.
            </p>

            <Figure
              title="One encoder, or two"
              description="The contrastive loss of the tied arrangement and of the separate pair, step for step."
              caption="Sharing the projection halves the parameters and puts the question and the document in the same space by construction. Separating them gives each side its own space to learn, and costs the second matrix."
            >
              <TrendChart
                data={trained.history.map((loss, index) => ({
                  x: index,
                  tied: loss,
                  separate: separate.history[index] ?? 0,
                }))}
                series={[
                  { key: 'tied', name: 'one encoder', colour: 'var(--accent-teal)' },
                  { key: 'separate', name: 'two encoders', colour: 'var(--accent-amber)' },
                ]}
                xLabel="the step"
                yLabel="the loss"
                height={260}
              />
            </Figure>

            <div className="stat-row">
              <Stat label="The recall, one encoder" value={`${fmt(dense * 100, 1)}%`} tone="good" />
              <Stat
                label="The recall, two encoders"
                value={`${fmt(separate.recall * 100, 1)}%`}
                tone={separate.recall > dense ? 'good' : 'warn'}
              />
              <Stat label="The parameters, one encoder" value={parameters.toLocaleString()} />
              <Stat label="The parameters, two encoders" value={(2 * parameters).toLocaleString()} tone="warn" />
            </div>

            <Figure
              title="The three networks of the pipeline"
              description="What the retriever is made of, and what each part costs."
              caption="The two encoders are the bi-encoder; in the tied arrangement the two rows are one matrix. The third network is the reader: it is the parametric memory, and Laboratory D counts its weights against the index."
            >
              <DataTable
                caption="The bill of materials"
                headers={['The network', 'Reads', 'Parameters here', 'When it runs']}
                rows={[
                  ['the query encoder', 'the question', (corpus.vocabulary * dimension + dimension).toLocaleString(), 'at query time'],
                  ['the document encoder', 'one document', (corpus.vocabulary * dimension + dimension).toLocaleString(), 'once, before the index is built'],
                  ['the reader', 'the question and the passages', 'counted in Laboratory D', 'at answer time'],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="Why the question and the document are not the same distribution">
              A question is short and written to be answered; a document is long and written to be found. One
              projection can serve both — the tied arrangement reaches {fmt(dense * 100, 1)}% here, and the separate
              pair reaches {fmt(separate.recall * 100, 1)}% — but in a real corpus the two sides are different
              distributions, so DPR gives each its own encoder and pays for the second matrix, as the counts above say.
            </Callout>
          </>
        ) : null}

        {view === 'dimension' ? (
          <>
            <p className="body-text">
              The width of the embedding is the one setting that trades memory for accuracy in a straight line: the
              projection has one row per vocabulary word per coordinate. The sweep trains a fresh encoder at each width
              for sixty steps, with the same seed, so the curve measures the width rather than the training.
            </p>

            <div className="button-row">
              <Button
                variant="primary"
                onClick={() => setSweep(recallByDimension(corpus, SWEEP_DIMENSIONS, { steps: 60, seed }))}
              >
                Run the sweep
              </Button>
            </div>

            {sweep ? (
              <>
                <Figure
                  title="The recall against the width"
                  description="The recall at ten of a retriever trained at each embedding width, at a fixed sixty steps."
                  caption="More coordinates give the projection more room to separate the topics, and the recall follows — at a cost that is exactly linear in the width. The curve is not smooth, because sixty steps is not a converged run; it is the same sixty steps at every width."
                >
                  <TrendChart
                    data={sweep.map((point) => ({ x: point.dimension, recall: point.recall }))}
                    series={[{ key: 'recall', name: 'the recall at ten', colour: 'var(--accent-teal)' }]}
                    xLabel="the width of the embedding"
                    yLabel="the recall"
                    height={260}
                  />
                </Figure>

                <Figure
                  title="What each width costs"
                  description="The parameters of the projection at each width, and the recall it reaches."
                  caption="The parameters are the vocabulary times the width, plus the bias. On this corpus the vocabulary is small; in a real retriever it is the vocabulary of the tokenizer, and the same multiplication is the bill."
                >
                  <DataTable
                    caption="The sweep"
                    headers={['The width', 'The parameters', 'The recall at ten']}
                    rows={sweep.map((point) => [
                      point.dimension,
                      point.parameters.toLocaleString(),
                      `${fmt(point.recall * 100, 1)}%`,
                    ])}
                  />
                </Figure>

                <Callout tone="note" title="A curve at one budget is not the whole story">
                  Every point here was trained for the same sixty steps. A wider model usually needs more steps to use
                  its width, so a converged sweep is not this curve — and the laboratory would rather show the budget it
                  actually ran than draw the curve the paper implies.
                </Callout>
              </>
            ) : (
              <Callout tone="note" title="Seven trainings, one click">
                The sweep trains {SWEEP_DIMENSIONS.length} encoders, one per width. It is a button rather than a slider
                because the work is done when you ask for it, not on every render.
              </Callout>
            )}
          </>
        ) : null}
      </Panel>
    </div>
  )
}
