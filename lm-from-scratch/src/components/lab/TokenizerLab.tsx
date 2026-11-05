import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { generateCorpus, tokenizeCorpus, trainTokenizer, tokenizerEconomics } from '../../core/tokenizer'
import { GPT2_VOCAB_SIZE, decodeGpt2, gpt2Segments, tokenizeWithGpt2 } from '../../core/gpt2'
import { REAL_DATASET, datasetText, realDocuments, splitCorpus } from '../../content/realDataset'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'merges' | 'economics' | 'real'

export function TokenizerLab() {
  const [view, setView] = useState<View>('merges')
  const [vocabularySize, setVocabularySize] = useState(400)
  const [documents, setDocuments] = useState(60)
  const [modelWidth, setModelWidth] = useState(512)

  const corpus = useMemo(
    () => generateCorpus(documents, 240, 5, 30),
    [documents],
  )
  const tokenizer = useMemo(() => trainTokenizer(corpus, vocabularySize), [corpus, vocabularySize])
  const stats = useMemo(() => tokenizeCorpus(tokenizer, corpus), [tokenizer, corpus])
  const economics = useMemo(
    () => tokenizerEconomics(tokenizer, corpus, modelWidth),
    [tokenizer, corpus, modelWidth],
  )

  const vocabularySweep = useMemo(() => {
    const rows: { x: number; bytesPerToken: number; embeddingParameters: number }[] = []
    for (let size = 260; size <= 1200; size += 60) {
      const trained = trainTokenizer(corpus, size)
      const measured = tokenizeCorpus(trained, corpus)
      rows.push({
        x: size,
        bytesPerToken: measured.bytesPerToken,
        embeddingParameters: trained.size * modelWidth,
      })
    }
    return rows
  }, [corpus, modelWidth])

  const realText = datasetText()
  const realStats = useMemo(() => tokenizeWithGpt2(realText), [realText])
  const realSplit = useMemo(() => splitCorpus(realDocuments(), 0.2), [])
  const realDocumentsStats = useMemo(
    () =>
      realDocuments().map((document) => ({
        ...document,
        stats: tokenizeWithGpt2(document.text),
      })),
    [],
  )
  const excerptSegments = useMemo(() => gpt2Segments(realText.slice(0, 420)), [realText])
  const excerptText = useMemo(() => decodeGpt2(excerptSegments.map((segment) => segment.id)), [excerptSegments])
  const excerptOnly = useMemo(() => {
    const trained = trainTokenizer(realText, 400)
    return { size: trained.size, ...tokenizeCorpus(trained, realText) }
  }, [realText])
  const realEmbedding = GPT2_VOCAB_SIZE * 768

  return (
    <div className="lab">
      <Panel
        title="Laboratory A · The tokeniser"
        subtitle="A byte-pair encoding trained here, and the GPT-2 vocabulary on a real book"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'merges', label: 'The merges' },
              { value: 'economics', label: 'The economics' },
              { value: 'real', label: 'The real corpus' },
            ]}
          />
          <Slider
            label="Vocabulary size"
            value={vocabularySize}
            min={260}
            max={1200}
            step={20}
            onChange={setVocabularySize}
            hint="The number of tokens the tokeniser can produce."
          />
          <Slider
            label="Documents in the corpus"
            value={documents}
            min={10}
            max={200}
            step={10}
            onChange={setDocuments}
          />
          <Slider
            label="Model width"
            value={modelWidth}
            min={128}
            max={2048}
            step={64}
            onChange={setModelWidth}
            hint="The width of the embedding matrix."
          />
        </div>

        <div className="stat-row">
          <Stat label="Vocabulary" value={String(tokenizer.size)} hint="tokens the encoder can produce" />
          <Stat label="Bytes per token" value={fmt(stats.bytesPerToken, 3)} hint="how much text one token stands for" />
          <Stat
            label="Corpus tokens"
            value={stats.tokens.toLocaleString()}
            hint={`from ${stats.bytes.toLocaleString()} bytes`}
          />
          <Stat
            label="Embedding parameters"
            value={economics.embeddingParameters.toLocaleString()}
            hint="the vocabulary-sized matrix"
          />
        </div>

        {view === 'merges' ? (
          <>
            <Figure
              title="The first merges"
              description="The first twenty merges the tokeniser learned, each of them the most frequent adjacent pair at the moment it was learned."
              caption="The merges, in the order they were learned. The order is the model: a decoder has to reproduce it to invert the encoding, and the merges are what the corpus supports rather than what anybody designed."
            >
              <DataTable
                caption="The first merges"
                headers={['#', 'The pair that was merged', 'The new token']}
                rows={tokenizer.merges.slice(0, 20).map(([a, b], index) => [
                  index + 1,
                  `${tokenizer.vocabulary[a]} + ${tokenizer.vocabulary[b]}`,
                  tokenizer.vocabulary[256 + index],
                ])}
              />
            </Figure>

            <Figure
              title="The corpus, before and after"
              description="A passage of the corpus, and the same passage after the tokeniser has run on it."
              caption="The same text, tokenised. The tokeniser has learned that this corpus uses a small vocabulary repeatedly, so it compresses it well — a fact about the corpus, not about language."
            >
              <DataTable
                caption="A passage, tokenised"
                headers={['Tokens', 'Decoded']}
                rows={Array.from({ length: 6 }, (_, i) => {
                  const start = i * 4
                  const ids = stats.ids.slice(start, start + 4)
                  return [
                    ids.map((id) => tokenizer.vocabulary[id] ?? `?${id}`).join(' '),
                    ids
                      .map((id) => {
                        const piece = tokenizer.vocabulary[id] ?? ''
                        return piece.startsWith('<') ? '·' : piece
                      })
                      .join(''),
                  ]
                })}
              />
            </Figure>

            <Callout tone="definition" title="Why the bytes are the starting point">
              Starting from the 256 bytes means the tokeniser can represent any text at all, including text it has never
              seen and text in a language it has no examples of. The price is a longer sequence for rich text, and that
              is the trade the vocabulary size is making.
            </Callout>
          </>
        ) : null}

        {view === 'economics' ? (
          <>
            <Figure
              title="What a bigger vocabulary buys and costs"
              description="The bytes per token and the size of the embedding matrix, as the vocabulary size grows."
              caption="A larger vocabulary compresses better — fewer tokens for the same text — but the embedding matrix grows with it. The two curves are pulling against each other, and the model width decides which one wins."
            >
              <TrendChart
                data={vocabularySweep}
                series={[
                  { key: 'bytesPerToken', name: 'bytes per token', colour: 'var(--accent-teal)' },
                ]}
                xLabel="the vocabulary size"
                yLabel="bytes per token"
                height={260}
              />
            </Figure>

            <DataTable
              caption="The bill"
              headers={['Quantity', 'Value']}
              rows={[
                ['the corpus', `${stats.bytes.toLocaleString()} bytes`],
                ['the corpus, tokenised', `${stats.tokens.toLocaleString()} tokens`],
                ['bytes per token', fmt(stats.bytesPerToken, 4)],
                ['distinct tokens used', stats.distinctTokens.toLocaleString()],
                ['the embedding matrix', `${economics.embeddingParameters.toLocaleString()} parameters`],
                ['one byte per token would give', `${economics.naiveTokens.toLocaleString()} tokens`],
                ['the saving', `${(1 - stats.tokens / Math.max(1, stats.bytes)).toFixed(4)} of the tokens`],
              ]}
            />

            <Callout tone="note" title="Where the cost lands">
              The token count sets the training compute; the embedding parameters set the memory. A vocabulary chosen
              without a model width in mind moves cost from one to the other, and the width is usually the thing that
              has to fit on the device.
            </Callout>
          </>
        ) : null}

        {view === 'real' ? (
          <>
            <div className="stat-row">
              <Stat label="GPT-2’s vocabulary" value={GPT2_VOCAB_SIZE.toLocaleString()} hint="256 bytes, 50,000 merges and the end-of-text token" />
              <Stat label="Bytes per token" value={fmt(realStats.bytesPerToken, 2)} hint="on the real excerpt" />
              <Stat
                label="The excerpt, tokenised"
                value={realStats.tokens.toLocaleString()}
                hint={`from ${realStats.bytes.toLocaleString()} bytes`}
              />
              <Stat
                label="Its embedding at width 768"
                value={`${(realEmbedding / 1e6).toFixed(1)} M`}
                hint="vocabulary × width"
              />
            </div>

            <Figure
              title={`Using a real tokeniser and a real dataset: ${REAL_DATASET.title}`}
              description="Every paragraph of the excerpt, tokenised by GPT-2's own byte-level BPE."
              caption="The tokeniser is GPT-2's released merge table and GPT-2's ids, reproduced in src/core/gpt2.ts. The text is a real book, in real English, with the punctuation and the long words a generated corpus does not have."
            >
              <DataTable
                caption="The real dataset, by document"
                headers={['Document', 'Characters', 'Tokens', 'Bytes per token']}
                rows={realDocumentsStats.map((document) => [
                  document.title,
                  document.stats.bytes.toLocaleString(),
                  document.stats.tokens.toLocaleString(),
                  fmt(document.stats.bytesPerToken, 2),
                ])}
              />
            </Figure>

            <Figure
              title="The passage, as the tokeniser sees it"
              description="The first tokens of the excerpt, with the id and the vocabulary spelling of each."
              caption={`The vocabulary spells a leading space as Ġ and a line break as Ċ. The round trip is exact: the ${excerptSegments.length} tokens below decode to the same ${excerptSegments.reduce((sum, segment) => sum + segment.bytes, 0)} bytes.`}
            >
              <DataTable
                caption="The first tokens"
                headers={['#', 'Id', 'Token', 'Bytes']}
                rows={excerptSegments.slice(0, 24).map((segment, index) => [
                  index + 1,
                  segment.id,
                  segment.display,
                  segment.bytes,
                ])}
              />
            </Figure>

            <DataTable
              caption="The excerpt, decoded"
              headers={['The tokens, joined', 'The text they decode to']}
              rows={[
                [
                  `${excerptSegments.slice(0, 8).map((segment) => segment.display).join(' ')} …`,
                  excerptText.length > 220 ? `${excerptText.slice(0, 220)}…` : excerptText,
                ],
              ]}
            />

            <Figure
              title="What a vocabulary trained on this book would be"
              description="GPT-2's vocabulary against a 400-token BPE trained on the excerpt itself, on the same text."
              caption="GPT-2 was trained for web text, and its vocabulary reflects that. A vocabulary trained on 2.5 KB of one novel compresses that novel less well — which is the point: the bytes-per-token ratio is a property of the pair, the tokeniser and the corpus."
            >
              <DataTable
                caption="Two vocabularies on one corpus"
                headers={['Vocabulary', 'Size', 'Tokens', 'Bytes per token']}
                rows={[
                  ['GPT-2’s byte-level BPE', GPT2_VOCAB_SIZE.toLocaleString(), realStats.tokens.toLocaleString(), fmt(realStats.bytesPerToken, 2)],
                  ['a BPE trained on this excerpt', excerptOnly.size.toLocaleString(), excerptOnly.tokens.toLocaleString(), fmt(excerptOnly.bytesPerToken, 2)],
                ]}
              />
            </Figure>

            <Callout tone="note" title="The dataset is real, and deliberately small">
              The corpus is five paragraphs of {REAL_DATASET.author}’s <em>{REAL_DATASET.title}</em>, published in{' '}
              {REAL_DATASET.year} and in the public domain; the electronic text is {REAL_DATASET.edition}. The split is{' '}
              {realSplit.training.documents.length} training paragraphs and {realSplit.validation.documents.length}{' '}
              validation paragraph — the shape of a real split, not the substance of one. Five paragraphs cannot measure
              a tokeniser, and the laboratory does not claim they do.
            </Callout>

            <Callout tone="definition" title="What the real tokeniser changes">
              The merge rule is the same one the first view builds; what changes is the vocabulary it starts from and the
              corpus it was chosen on. GPT-2’s 50,000 merges were learned on web text, so this book tokenises into fewer,
              longer pieces than a vocabulary learned from the book alone. Nothing about the algorithm is privileged;
              everything about the vocabulary is.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
