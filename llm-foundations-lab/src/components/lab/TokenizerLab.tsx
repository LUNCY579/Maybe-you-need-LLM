import { useMemo, useState } from 'react'
import { readBoolean, readNumber, readOneOf, readString, type LabSettings } from './settings'
import {
  DEFAULT_MAX_PIECE_LENGTH,
  SPECIAL_TOKENS,
  TOY_SENTENCES,
  TOY_VOCAB,
  tokenize,
  type TokenizerMode,
} from '../../core/tokenizer'
import { createRng, fmt } from '../../core/math'
import { toyEmbedding } from '../../core/embeddings'
import { Heatmap } from '../viz/Heatmap'
import { FigureCard, LineChartPanel } from '../viz/Charts'
import {
  Button,
  Callout,
  Panel,
  ResetButton,
  SectionHeading,
  SegmentedControl,
  Slider,
  Stat,
  TextInput,
  Toggle,
} from '../ui/primitives'
import { DisplayMath, InlineMath } from '../ui/Math'
import { PredictPanel } from './PredictPanel'
import { buildTokenizerQuestions } from '../../content/predictionQuestions'

export type TokenizerView = 'compare' | 'embeddings' | 'objectives' | 'masking' | 'self-supervision' | 'predict'

const VIEWS: { value: TokenizerView; label: string }[] = [
  { value: 'compare', label: 'Segmentations' },
  { value: 'predict', label: 'Predict the segmentation' },
  { value: 'embeddings', label: 'Embedding vectors' },
  { value: 'self-supervision', label: 'Self-supervised targets' },
  { value: 'objectives', label: 'Pre-training objectives' },
  { value: 'masking', label: 'BERT masking' },
]

export interface TokenizerLabProps {
  view?: TokenizerView
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
  /** Settings restored from a saved configuration. */
  initialSettings?: LabSettings
}

export function TokenizerLab({
  view: initialView = 'compare',
  onSaveConfig,
  initialSettings,
}: TokenizerLabProps) {
  const [view, setView] = useState<TokenizerView>(initialView)
  const [text, setText] = useState(() => readString(initialSettings, 'text', 'the model learns from text'))
  const [mode, setMode] = useState<TokenizerMode>(() =>
    readOneOf(initialSettings, 'mode', ['word', 'char', 'subword'] as const, 'word'),
  )
  const [lowercase, setLowercase] = useState(() => readBoolean(initialSettings, 'lowercase', true))
  const [maxPieceLength, setMaxPieceLength] = useState(() =>
    readNumber(initialSettings, 'maxPieceLength', DEFAULT_MAX_PIECE_LENGTH),
  )

  const result = useMemo(
    () => tokenize(text, { mode, lowercase, maxPieceLength }),
    [text, mode, lowercase, maxPieceLength],
  )
  const word = useMemo(() => tokenize(text, { mode: 'word' }), [text])
  const char = useMemo(() => tokenize(text, { mode: 'char' }), [text])
  const subword = useMemo(() => tokenize(text, { mode: 'subword', maxPieceLength }), [text, maxPieceLength])

  const reset = () => {
    setText('the model learns from text')
    setMode('word')
    setLowercase(true)
    setMaxPieceLength(DEFAULT_MAX_PIECE_LENGTH)
  }

  return (
    <div className="lab-frame space-y-5">
      <Panel>
        <SectionHeading
          kicker="Laboratory A"
          title="Tokenization and embeddings"
          description="Word-level, character-level and a greedy subword strategy, all scored against one explicit toy vocabulary. The tokenizer is demonstrative: it is not a BPE/WordPiece/Unigram implementation and it does not reproduce any production model's segmentation."
          action={<ResetButton onReset={reset} label="Reset lab" />}
        />
        <div className="flex flex-wrap gap-1">
          {VIEWS.map((item) => (
            <SegmentedControl
              key={item.value}
              value={view === item.value ? item.value : view}
              onChange={() => setView(item.value)}
              options={[{ value: item.value, label: item.label }]}
              size="sm"
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-3">
            <TextInput
              label="Text to tokenize"
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, 160))}
              data-testid="tokenizer-input"
            />
            <div className="flex flex-wrap gap-3">
              {TOY_SENTENCES.map((sentence) => (
                <Button key={sentence} size="sm" variant="ghost" onClick={() => setText(sentence)}>
                  {sentence.length > 28 ? `${sentence.slice(0, 26)}…` : sentence}
                </Button>
              ))}
            </div>
            <SegmentedControl
              label="Strategy"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'word', label: 'word', hint: 'Split on whitespace and punctuation, then look up whole words.' },
                { value: 'char', label: 'character', hint: 'One unit per character.' },
                { value: 'subword', label: 'greedy subword', hint: 'Longest-match pieces from the toy vocabulary.' },
              ]}
            />
            <div className="flex flex-wrap gap-6">
              <Toggle label="Lower-case before lookup" checked={lowercase} onChange={setLowercase} />
              <Slider
                label="Max subword piece length"
                value={maxPieceLength}
                min={1}
                max={6}
                onChange={setMaxPieceLength}
                format={(value) => `${value} chars`}
              />
            </div>
          </div>
          <div className="split-2-tight">
            <Stat label="Sequence length" value={result.sequenceLength} tone="indigo" />
            <Stat label="Out of vocabulary" value={result.oovCount} tone={result.oovCount ? 'amber' : 'neutral'} />
            <Stat label="OOV rate" value={`${(result.oovRate * 100).toFixed(0)}%`} />
            <Stat label="Vocabulary" value={TOY_VOCAB.length} hint={`ids 0–${SPECIAL_TOKENS.length - 1} are reserved`} />
          </div>
        </div>
      </Panel>

      {view === 'compare' ? <CompareView word={word} char={char} subword={subword} /> : null}
      {view === 'predict' ? <PredictView /> : null}
      {view === 'embeddings' ? <EmbeddingsView tokens={result.tokens.map((t) => t.text)} /> : null}
      {view === 'self-supervision' ? <SelfSupervisionView text={text} /> : null}
      {view === 'objectives' ? <ObjectivesView text={text} /> : null}
      {view === 'masking' ? <MaskingView text={text} /> : null}

      {onSaveConfig ? (
        <Button size="sm" onClick={() => onSaveConfig({ text, mode, lowercase, maxPieceLength })}>
          Save this configuration
        </Button>
      ) : null}
    </div>
  )
}

function TokenChips({
  tokens,
  tone = 'neutral',
}: {
  tokens: { text: string; id: number | null; oov: boolean }[]
  tone?: 'neutral' | 'indigo' | 'teal'
}) {
  const tones: Record<string, string> = {
    neutral: 'border-control bg-panel-2 text-fg',
    indigo: 'border-indigo/40 bg-indigo/10 text-fg',
    teal: 'border-teal/40 bg-teal/10 text-fg',
  }
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="token-chips">
      {tokens.length === 0 ? <span className="text-sm text-faint">No tokens.</span> : null}
      {tokens.map((token, index) => (
        <span
          key={index}
          data-testid="token-chip"
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-xs ${
            token.oov ? 'border-amber/50 bg-amber/10 text-amber' : tones[tone]
          }`}
          title={token.id === null ? 'out of vocabulary' : `id ${token.id}`}
        >
          {token.text === ' ' ? '␣' : token.text}
          <span className="text-[10px] text-faint">{token.id ?? '∅'}</span>
        </span>
      ))}
    </div>
  )
}

/* ------------------------------------------------- Prediction exercise */

function PredictView() {
  const questions = useMemo(() => buildTokenizerQuestions(), [])
  return (
    <PredictPanel
      title="Predict the segmentation"
      description="Work out how many units the tokenizer will produce before you look. Count the words, then count the characters: the character count is the sentence length without its spaces."
      questions={questions}
      closing="Every count above came from the tokenizer itself, so the exercise and the laboratory cannot disagree."
    />
  )
}

function CompareView({
  word,
  char,
  subword,
}: {  word: ReturnType<typeof tokenize>
  char: ReturnType<typeof tokenize>
  subword: ReturnType<typeof tokenize>
}) {
  const rows = [
    { key: 'word', label: 'Word level', data: word, tone: 'indigo' as const, note: 'Few units, large vocabulary, brittle to new words.' },
    { key: 'char', label: 'Character level', data: char, tone: 'teal' as const, note: 'Tiny vocabulary, very long sequences, and every typo is visible.' },
    { key: 'subword', label: 'Greedy subword', data: subword, tone: 'neutral' as const, note: 'Pieces compose unseen words from known parts, at the cost of longer sequences than words.' },
  ]
  return (
    <div className="split-3">
      {rows.map((row) => (
        <FigureCard
          key={row.key}
          title={row.label}
          subtitle={`${row.data.sequenceLength} units · ${row.data.oovCount} OOV`}
          footer={row.note}
        >
          <TokenChips tokens={row.data.tokens} tone={row.tone} />
        </FigureCard>
      ))}
    </div>
  )
}

function EmbeddingsView({ tokens }: { tokens: string[] }) {
  const dim = 8
  const unique = Array.from(new Set(tokens)).slice(0, 12)
  const matrix = unique.map((token) => toyEmbedding(token, dim))
  return (
    <div className="space-y-4">
      <FigureCard
        title="Embedding vectors"
        subtitle="Deterministic toy vectors: identical tokens share a row, different tokens get different directions."
        footer="Similarity here is arbitrary. Learned embeddings place related tokens near each other, which is what makes vector retrieval and analogy arithmetic meaningful."
      >
        <Heatmap
          matrix={matrix}
          rowLabels={unique}
          colLabels={Array.from({ length: dim }, (_, i) => `d${i}`)}
          title="Token embedding table (sub-matrix for the current sentence)"
          caption="Each row is a unit vector in 8 dimensions. A dot product of two rows measures their alignment."
        />
      </FigureCard>
      <FigureCard title="Cosine similarity between the current tokens" subtitle="Compare each pair of embedding rows.">
        <Heatmap
          matrix={unique.map((a) =>
            unique.map((b) => {
              const va = toyEmbedding(a, dim)
              const vb = toyEmbedding(b, dim)
              const dot = va.reduce((s, v, i) => s + v * vb[i], 0)
              const na = Math.sqrt(va.reduce((s, v) => s + v * v, 0))
              const nb = Math.sqrt(vb.reduce((s, v) => s + v * v, 0))
              return dot / (na * nb)
            }),
          )}
          rowLabels={unique}
          colLabels={unique}
          domain={[-1, 1]}
          title="cos(token_i, token_j)"
          caption="A trained model would show structure here. The toy table shows only pseudo-random noise, which is the honest expectation for a hash-based embedding."
        />
      </FigureCard>
    </div>
  )
}

/** Build the exact input/target pairs used by next-token prediction. */
function selfSupervisedPairs(text: string) {
  const units = tokenize(text, { mode: 'word' }).tokens.map((t) => t.text)
  const pairs: { input: string[]; target: string; position: number }[] = []
  for (let i = 0; i < units.length - 1; i++) {
    pairs.push({ input: units.slice(0, i + 1), target: units[i + 1], position: i })
  }
  return { units, pairs }
}

function SelfSupervisionView({ text }: { text: string }) {
  const { units, pairs } = useMemo(() => selfSupervisedPairs(text), [text])
  return (
    <FigureCard
      title="Self-supervised targets from one sentence"
      subtitle="Next-token prediction turns one sequence into m − 1 training examples without a single human label."
      footer="This is the mechanism that lets pre-training consume raw text. The 'label' is simply the next token in the corpus."
    >
      <DisplayMath tex="\mathcal{L}(\theta) = -\sum_{i} \log \Pr_\theta(x_i \mid x_0, \dots, x_{i-1})" />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-line text-faint">
              <th className="py-2 pr-3 font-medium">#</th>
              <th className="py-2 pr-3 font-medium">input (context)</th>
              <th className="py-2 font-medium">target</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair, index) => (
              <tr key={index} className="border-b border-line-soft">
                <td className="py-1.5 pr-3 font-mono text-faint">{index + 1}</td>
                <td className="py-1.5 pr-3 font-mono text-fg">{pair.input.join(' ')}</td>
                <td className="py-1.5 font-mono text-teal">{pair.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Sequence length {units.length} produced {pairs.length} training targets. In a real corpus this multiplication
        happens across trillions of tokens.
      </p>
    </FigureCard>
  )
}

function ObjectivesView({ text }: { text: string }) {
  const units = tokenize(text, { mode: 'word' }).tokens.map((t) => t.text)
  const maskedIndex = Math.max(0, Math.min(units.length - 1, Math.floor(units.length / 2)))
  const corrupted = units.map((unit, index) => (index === maskedIndex ? '[MASK]' : unit))
  const spanStart = Math.min(maskedIndex, Math.max(0, units.length - 3))
  const spanEnd = Math.min(units.length, spanStart + 2)
  const corruptedSpans = units.map((unit, index) => (index >= spanStart && index < spanEnd ? '[X]' : unit))
  const spanTargets = units.slice(spanStart, spanEnd)

  return (
    <div className="space-y-4">
      <FigureCard
        title="Decoder-only: next-token"
        subtitle="Target is the following token; causal mask applied."
        footer="Can generate: the training operation is the generation operation."
      >
        <div className="space-y-2 text-sm">
          {units.slice(0, -1).map((unit, index) => (
            <div key={index} className="flex items-center gap-2 font-mono text-xs">
              <span className="rounded bg-indigo/15 px-1.5 py-0.5 text-indigo">{unit}</span>
              <span className="text-faint">→</span>
              <span className="rounded bg-teal/15 px-1.5 py-0.5 text-teal">{units[index + 1]}</span>
            </div>
          ))}
        </div>
      </FigureCard>

      <FigureCard
        title="Encoder-only: masked token"
        subtitle="One position is replaced; the model sees both sides."
        footer="Cannot generate left-to-right: at inference time there is no [MASK] to fill, so the objective is out of distribution."
      >
        <TokenChips tokens={corrupted.map((unit) => ({ text: unit, id: null, oov: false }))} tone="indigo" />
        <p className="mt-2 text-xs text-muted">
          Target: <span className="font-mono text-teal">{units[maskedIndex]}</span> at position {maskedIndex}. Loss is
          computed at that position only.
        </p>
      </FigureCard>

      <FigureCard
        title="Encoder–decoder: span corruption"
        subtitle="A contiguous span is deleted and regenerated by the decoder."
        footer="Targets are whole spans, so the decoder learns a sequence-to-sequence reconstruction task."
      >
        <TokenChips tokens={corruptedSpans.map((unit) => ({ text: unit, id: null, oov: false }))} tone="teal" />
        <p className="mt-2 text-xs text-muted">
          Decoder target: <span className="font-mono text-amber">{spanTargets.join(' ')}</span>
        </p>
      </FigureCard>
    </div>
  )
}

function MaskingView({ text }: { text: string }) {
  const [seed, setSeed] = useState(11)
  const [maskRate, setMaskRate] = useState(0.15)
  const units = tokenize(text, { mode: 'word' }).tokens.map((t) => t.text)

  const { decisions, stats } = useMemo(() => {
    const rng = createRng(seed)
    const decisions = units.map((unit) => {
      const selected = rng() < maskRate
      const roll = rng()
      if (!selected) return { unit, kind: 'kept' as const }
      if (roll < 0.8) return { unit, kind: 'mask' as const }
      if (roll < 0.9) return { unit, kind: 'random' as const }
      return { unit, kind: 'unchanged' as const }
    })
    return {
      decisions,
      stats: {
        masked: decisions.filter((d) => d.kind === 'mask').length,
        random: decisions.filter((d) => d.kind === 'random').length,
        unchanged: decisions.filter((d) => d.kind === 'unchanged').length,
        // A randomly replaced unit becomes out of vocabulary, so the count is
        // derived from the decisions rather than tallied as a side effect.
        oovRandom: decisions.filter((d) => d.kind === 'random').length,
      },
    }
  }, [units, seed, maskRate])

  return (
    <div className="space-y-4">
      <FigureCard
        title="BERT-style masking recipe"
        subtitle="15% of positions are selected; of those, 80% become [MASK], 10% a random token, 10% stay unchanged."
        footer="The mixture exists because [MASK] never appears during fine-tuning. Keeping some tokens intact reduces that train/test mismatch."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="space-y-3">
            <Slider label="Masking rate" value={maskRate} min={0.05} max={0.5} step={0.05} onChange={setMaskRate} format={(v) => `${(v * 100).toFixed(0)}%`} />
            <Slider label="Masking seed" value={seed} min={1} max={60} onChange={setSeed} format={(v) => `#${v}`} />
            <div className="flex flex-wrap gap-1.5">
              {decisions.map((decision, index) => {
                const style =
                  decision.kind === 'mask'
                    ? 'border-amber/50 bg-amber/10 text-amber'
                    : decision.kind === 'random'
                      ? 'border-rose/50 bg-rose/10 text-rose'
                      : decision.kind === 'unchanged'
                        ? 'border-indigo/50 bg-indigo/10 text-indigo'
                        : 'border-control bg-panel-2 text-fg'
                const display =
                  decision.kind === 'mask' ? '[MASK]' : decision.kind === 'random' ? '⟨random⟩' : decision.unit
                return (
                  <span key={index} className={`rounded-lg border px-2 py-1 font-mono text-xs ${style}`}>
                    {display}
                  </span>
                )
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Stat label="[MASK] positions" value={stats.masked} tone="amber" />
            <Stat label="Random replacements" value={stats.random} tone="rose" />
            <Stat label="Left unchanged" value={stats.unchanged} tone="indigo" />
            <Stat label="Prediction targets" value={units.length === 0 ? 0 : stats.masked + stats.random + stats.unchanged} />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Loss is computed at all selected positions, including the ones left unchanged and the ones replaced by random
          tokens — the model must recover the original token in each case. With {units.length} units and a{' '}
          {(maskRate * 100).toFixed(0)}% rate the expected number of targets is{' '}
          <InlineMath tex={`${units.length} \\times ${maskRate.toFixed(2)} = ${fmt(units.length * maskRate, 2)}`} />.
        </p>
      </FigureCard>

      <FigureCard title="Masking rate and expected targets" subtitle="How the number of training signals scales with the rate.">
        <LineChartPanel
          data={Array.from({ length: 19 }, (_, index) => {
            const rate = 0.05 + index * 0.05
            return { x: Number(rate.toFixed(2)), targets: units.length * rate }
          })}
          series={[{ key: 'targets', label: 'expected targets', color: 'var(--amber)' }]}
          xLabel="masking rate"
          yLabel="targets"
          height={200}
        />
      </FigureCard>

      <Callout tone="indigo" title="Demonstration tokenizer, not a production one">
        Real subword vocabularies are learned from data with BPE, WordPiece or Unigram, then frozen. The same sentence
        will segment differently for different models, and that difference is not a bug. This lab shows the operations —
        boundaries, ids, sequence length, OOV handling — using an inventory you can read in full.
      </Callout>
    </div>
  )
}

export default TokenizerLab
