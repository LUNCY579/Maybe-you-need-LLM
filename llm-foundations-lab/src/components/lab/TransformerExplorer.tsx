import { useMemo, useState } from 'react'
import { runExplorer, EXPLORER_STAGES, multiHeadTrace, shapeOf, type ExplorerResult, type HeadTrace, type MultiHeadTrace } from '../../core/transformer'
import { fmt, softmax } from '../../core/math'
import { TOY_VOCAB } from '../../core/tokenizer'
import { buildToyParameters, DEFAULT_TOY_CONFIG, type ToyModelConfig } from '../../core/embeddings'
import { readBoolean, readNumber, readOneOf, readString, type LabSettings } from './settings'
import { Heatmap, MatrixTable } from '../viz/Heatmap'
import { FigureCard, TokenDistributionChart } from '../viz/Charts'
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
import { attentionWorkRatio, sequenceComparison } from '../../core/sequence'

const STARTER_SENTENCES = [
  'the model learns from text',
  'attention heads query key value',
  'tokenizer turns text into tokens',
]

const STAGE_KEYS = [
  ['tokens', 'Tokens & ids'],
  ['embeddings', 'Embeddings'],
  ['positions', 'Positions'],
  ['qkv', 'Q, K, V'],
  ['scores', 'Scores'],
  ['mask', 'Causal mask'],
  ['softmax', 'Softmax'],
  ['output', 'Attention output'],
  ['block', 'Feed-forward'],
  ['prediction', 'Next token'],
] as const

type StageKey = (typeof STAGE_KEYS)[number][0]

export interface TransformerExplorerProps {
  /** Which stage to show first. */
  initialStage?: StageKey
  /** Compact mode is used inside lessons; the playground uses the full layout. */
  compact?: boolean
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
  /** Settings restored from a saved configuration. */
  initialSettings?: LabSettings
}

export function TransformerExplorer({
  initialStage = 'tokens',
  compact = false,
  onSaveConfig,
  initialSettings,
}: TransformerExplorerProps) {
  const [text, setText] = useState(() => readString(initialSettings, 'text', STARTER_SENTENCES[0]))
  const [mode, setMode] = useState<'word' | 'char' | 'subword'>(() =>
    readOneOf(initialSettings, 'mode', ['word', 'char', 'subword'] as const, 'word'),
  )
  const [masked, setMasked] = useState(() => readBoolean(initialSettings, 'masked', true))
  const [stage, setStage] = useState<StageKey>(initialStage)
  const [temperature, setTemperature] = useState(() => readNumber(initialSettings, 'temperature', 1))
  const [inspect, setInspect] = useState({ row: 0, col: 0 })
  const [dim, setDim] = useState(() => readNumber(initialSettings, 'dim', DEFAULT_TOY_CONFIG.dim))
  const [seed, setSeed] = useState(() => readString(initialSettings, 'seed', DEFAULT_TOY_CONFIG.seed))
  const [heads, setHeads] = useState(() => readNumber(initialSettings, 'heads', 1))
  const [headIndex, setHeadIndex] = useState(0)

  const config: ToyModelConfig = useMemo(
    () => ({ ...DEFAULT_TOY_CONFIG, dim, seed }),
    [dim, seed],
  )

  const result: ExplorerResult = useMemo(
    () => runExplorer(text.length === 0 ? ' ' : text, { mode, config, masked }),
    [text, mode, config, masked],
  )

  /**
   * The per-head trace, computed with the same projection matrices the Explorer
   * uses. With one head it reproduces the single-head path exactly, so the
   * multi-head view is a genuine generalisation rather than a separate model.
   */
  const headTrace = useMemo(() => {
    const params = buildToyParameters(TOY_VOCAB.length, config)
    return multiHeadTrace(result.H, params, heads, { masked })
  }, [result.H, config, heads, masked])

  /** The head the detailed figures describe. */
  const activeHead = headTrace.heads[Math.min(headIndex, headTrace.heads.length - 1)] ?? headTrace.heads[0]

  const sequenceLength = Math.max(1, result.shapes.sequenceLength)
  const safeRow = Math.min(inspect.row, sequenceLength - 1)
  const safeCol = Math.min(inspect.col, sequenceLength - 1)
  const labels = result.steps.map((step) => `${step.index}:${step.token}`)

  const finalDistribution = useMemo(() => softmax(result.logits, temperature), [result.logits, temperature])
  const distributionItems = useMemo(
    () =>
      result.probabilities
        .map((_, id) => ({ token: TOY_VOCAB[id], probability: finalDistribution[id] }))
        .filter((item) => item.probability > 0.0005)
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 12),
    [result.probabilities, finalDistribution],
  )

  const reset = () => {
    setText(STARTER_SENTENCES[0])
    setMode('word')
    setMasked(true)
    setTemperature(1)
    setDim(DEFAULT_TOY_CONFIG.dim)
    setHeads(1)
    setInspect({ row: 0, col: 0 })
    setStage('tokens')
  }

  return (
    <div className="lab-frame space-y-5">
      <Panel className={compact ? 'p-4' : ''}>
        <SectionHeading
          kicker="Flagship demonstration"
          title="Transformer Explorer"
          description={
            <>
              A tiny decoder-only Transformer computed from scratch in your browser: one block,{' '}
              {headTrace.heads.length} head{headTrace.heads.length === 1 ? '' : 's'}, dimension{' '}
              <span className="font-mono text-fg">{dim}</span>, vocabulary{' '}
              <span className="font-mono text-fg">{TOY_VOCAB.length}</span>. Every number below comes from the same
              matrix operations a real model uses. The weights are teacher-chosen so the arithmetic stays readable —
              this is a teaching model, not a trained language model.
            </>
          }
          action={<ResetButton onReset={reset} label="Reset explorer" />}
        />

        <div className="split-side">
          <div className="space-y-3">
            <TextInput
              label="Input sentence"
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, 120))}
              placeholder="type a sentence…"
              data-testid="explorer-input"
              hint="Lower-casing is applied by the demonstrative tokenizer. Unknown words become <unk>."
            />
            <div className="flex flex-wrap items-end gap-4">
              <SegmentedControl
                label="Tokenization"
                value={mode}
                onChange={(value) => {
                  setMode(value)
                  setInspect({ row: 0, col: 0 })
                }}
                options={[
                  { value: 'word', label: 'word' },
                  { value: 'char', label: 'character' },
                  { value: 'subword', label: 'subword (greedy)' },
                ]}
              />
              <Slider
                label="Embedding dimension d"
                value={dim}
                min={4}
                max={12}
                step={2}
                onChange={(value) => {
                  setDim(value)
                  setInspect({ row: 0, col: 0 })
                }}
                format={(value) => `${value}`}
                hint="Changes every projection matrix, so all numbers change."
              />
              <SegmentedControl
                label="Attention heads"
                value={String(heads)}
                onChange={(value) => {
                  setHeads(Number(value))
                  setInspect({ row: 0, col: 0 })
                }}
                options={[
                  { value: '1', label: '1', hint: 'One head over the whole hidden dimension.' },
                  { value: '2', label: '2', hint: 'Two heads, each over half the dimension.' },
                  { value: '4', label: '4', hint: 'Four heads, each over a quarter.' },
                ]}
              />
              <TextInput
                label="Weights seed"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
                hint="Change it and every projection matrix changes — the arithmetic does not. The embeddings are derived from the token itself, so they stay put."
              />
            </div>
            <Toggle
              label="Apply the causal mask"
              checked={masked}
              onChange={setMasked}
              hint="Switch it off to see attention leak into future positions — the failure the mask prevents."
            />
          </div>

          <div className="split-2-tight">
            <Stat label="Sequence length m" value={result.shapes.sequenceLength} tone="indigo" />
            <Stat label="Hidden dimension d" value={dim} tone="teal" />
            <Stat
              label="Heads × head dim"
              value={`${headTrace.heads.length} × ${headTrace.headWidths[0] ?? 0}`}
              tone="teal"
              hint="Each head owns a contiguous slice of the hidden dimension."
            />
            <Stat label="OOV units" value={result.tokenization.oovCount} tone={result.tokenization.oovCount ? 'amber' : 'neutral'} />
            <Stat label="Score matrix" value={result.shapes.attention} tone="indigo" hint="m × m" />
          </div>
        </div>

        {text.trim().length === 0 ? (
          <Callout tone="amber" title="Empty input">
            Type a sentence to compute a forward pass.
          </Callout>
        ) : null}
      </Panel>

      <div className="split-side-left split-side-left-narrow">
        <nav aria-label="Explorer stages" className="lg:sticky lg:top-20 lg:self-start">
          <ol className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {STAGE_KEYS.map(([key, label], index) => {
              const active = key === stage
              return (
                <li key={key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setStage(key)}
                    aria-current={active ? 'step' : undefined}
                    data-testid={`stage-${key}`}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                      active
                        ? 'border-indigo bg-indigo/10 text-fg'
                        : 'border-line bg-panel-2/50 text-muted hover:border-indigo/40 hover:text-fg'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] ${
                        active ? 'bg-indigo-strong text-white' : 'bg-line-soft text-faint'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="whitespace-nowrap">{label}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="min-w-0">
          {stage === 'tokens' ? (
            <StageTokens result={result} mode={mode} />
          ) : stage === 'embeddings' ? (
            <StageEmbeddings result={result} dim={dim} />
          ) : stage === 'positions' ? (
            <StagePositions result={result} dim={dim} />
          ) : stage === 'qkv' ? (
            <StageQkv result={result} trace={headTrace} />
          ) : stage === 'scores' ? (
            <StageScores result={result} trace={headTrace} />
          ) : stage === 'mask' ? (
            <StageMask result={result} masked={masked} />
          ) : stage === 'softmax' ? (
            <StageSoftmax
              result={result}
              trace={headTrace}
              head={activeHead}
              setHeadIndex={setHeadIndex}
              inspect={{ row: safeRow, col: safeCol }}
              setInspect={setInspect}
            />
          ) : stage === 'block' ? (
            <StageBlock result={result} />
          ) : stage === 'output' ? (
            <StageOutput
              result={result}
              trace={headTrace}
              head={activeHead}
              inspect={{ row: safeRow, col: safeCol }}
              setInspect={setInspect}
            />
          ) : (
            <StagePrediction
              result={result}
              temperature={temperature}
              setTemperature={setTemperature}
              items={distributionItems}
              labels={labels}
            />
          )}
        </div>
      </div>

      <CircleOfAttention result={result} labels={labels} onPick={(row, col) => {
        setInspect({ row, col })
        setStage('softmax')
      }} />

      <SequenceComparisonCard />

      {onSaveConfig ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => onSaveConfig({ text, mode, masked, temperature, dim, heads, seed })}
            title="Store these settings in your local progress file"
          >
            Save this configuration
          </Button>
          <span className="text-xs text-faint">
            Saved configurations live in your browser only and can be exported on the dashboard.
          </span>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ Stages */

function SequenceComparisonCard() {
  const [length, setLength] = useState(256)
  const rows = useMemo(() => sequenceComparison(length, 3), [length])

  return (
    <FigureCard
      title="CNN, RNN and attention, side by side"
      subtitle="The three ways of mixing information across a sequence, on the quantities that decided the argument."
      footer="Path length is how many composition steps a signal takes between two distant positions; work is per layer, with constants dropped. Attention buys a path of one and pays for it with quadratic work — the trade the Transformer made."
    >
      <div className="space-y-3">
        <Slider
          label="Sequence length"
          value={length}
          min={16}
          max={1024}
          step={16}
          onChange={setLength}
          format={(value) => `${value} tokens`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">architecture</th>
                <th className="py-1.5 font-medium">path length</th>
                <th className="py-1.5 font-medium">receptive field</th>
                <th className="py-1.5 font-medium">parallel over time</th>
                <th className="py-1.5 font-medium">work per layer</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((row) => (
                <tr key={row.kind} className="border-b border-line-soft">
                  <td className="py-1.5 text-fg">{row.name}</td>
                  <td className={row.kind === 'attention' ? 'py-1.5 text-teal' : 'py-1.5 text-muted'}>{row.path}</td>
                  <td className="py-1.5 text-muted">{row.receptiveField}</td>
                  <td className="py-1.5">{row.parallel ? <span className="text-teal">yes</span> : <span className="text-rose">no</span>}</td>
                  <td className="py-1.5 text-muted">{row.work.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="indigo" title="What the comparison is, and is not">
          These are asymptotic counts, not a benchmark: the constants a real kernel spends, and the memory traffic that
          dominates at long context, are not in the table. What is in the table is the reason a recurrence cannot be
          trained in parallel over time and a convolution needs a logarithmic stack to see the whole sequence — and the
          reason attention's quadratic work is the price of its one-step path.
        </Callout>
        <p className="text-xs text-muted">
          At this length, one attention layer does{' '}
          <span className="font-mono text-fg">{attentionWorkRatio(length)}×</span> the multiply-adds of one recurrent
          step, while the recurrent stack needs{' '}
          <span className="font-mono text-fg">{length}</span> sequential steps to connect the same two positions.
        </p>
      </div>
    </FigureCard>
  )
}

function StageTokens({ result, mode }: { result: ExplorerResult; mode: string }) {  return (
    <FigureCard
      title={EXPLORER_STAGES.tokens}
      subtitle={`Mode: ${mode}. Boundaries and ids come from the explicit toy vocabulary.`}
      footer="Real models use a learned subword vocabulary of 30k–200k+ units; these numbers are illustrative."
    >
      <div className="flex flex-wrap gap-1.5" data-testid="token-chips">
        {result.steps.map((step) => (
          <span
            key={step.index}
            data-testid="token-chip"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-xs ${
              step.token === '<unk>'
                ? 'border-amber/50 bg-amber/10 text-amber'
                : 'border-control bg-panel-2 text-fg'
            }`}
            title={`position ${step.index}${step.id === null ? ', out of vocabulary' : `, id ${step.id}`}`}
          >
            {step.token}
            <span className="text-[10px] text-faint">#{step.id ?? '∅'}</span>
          </span>
        ))}
      </div>
      <div className="mt-3 split-3-tight">
        <Stat label="Sequence length" value={result.tokenization.sequenceLength} tone="indigo" />
        <Stat label="Out-of-vocabulary" value={result.tokenization.oovCount} tone="amber" />
        <Stat label="Toy vocabulary size" value={result.shapes.vocab} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Sequence length is what the model pays for: attention builds an{' '}
        <span className="font-mono">m × m</span> score matrix, and every generated token appends to the context.
      </p>
    </FigureCard>
  )
}

function StageEmbeddings({ result, dim }: { result: ExplorerResult; dim: number }) {
  return (
    <FigureCard
      title={EXPLORER_STAGES.embeddings}
      subtitle="Each row is the embedding of one token, produced by a deterministic toy table."
      footer="In a trained model these vectors are learned; similar tokens end up with similar directions."
    >
      <Heatmap
        testId="embedding-heatmap"
        matrix={result.steps.map((step) => step.tokenEmbedding)}
        rowLabels={result.steps.map((s) => s.token)}
        colLabels={Array.from({ length: dim }, (_, i) => `d${i}`)}
        title={`Token embedding matrix E — ${shapeOf(result.steps.map((s) => s.tokenEmbedding))}`}
        caption="Toy embeddings are pseudo-random unit vectors derived from the token string. They demonstrate the shape and the lookup operation, not learned semantics."
      />
    </FigureCard>
  )
}

function StagePositions({ result, dim }: { result: ExplorerResult; dim: number }) {
  return (
    <div className="space-y-4">
      <FigureCard
        title={EXPLORER_STAGES.positions}
        subtitle="Sinusoidal positional encodings added elementwise to the token embeddings."
      >
        <DisplayMath
          tex="PE_{(pos, 2i)} = \sin\left(\frac{pos}{10000^{2i/d}}\right), \qquad PE_{(pos, 2i+1)} = \cos\left(\frac{pos}{10000^{2i/d}}\right)"
          caption="Each dimension oscillates at a different frequency, so every position gets a distinct pattern."
        />
        <Heatmap
          matrix={result.steps.map((step) => step.positional)}
          rowLabels={result.steps.map((s) => `pos ${s.index}`)}
          colLabels={Array.from({ length: dim }, (_, i) => `d${i}`)}
          title="Positional encoding per position"
          showValues={false}
          caption="Read the columns: low-index dimensions change quickly with position, high-index dimensions change slowly. That is the frequency ladder."
        />
      </FigureCard>
      <FigureCard title="Input to the block: H = embedding + position" subtitle="The matrix attention actually consumes.">
        <MatrixTable
          matrix={result.H}
          rowLabels={result.steps.map((s) => s.token)}
          colLabels={Array.from({ length: dim }, (_, i) => `d${i}`)}
          label={`H — ${shapeOf(result.H)}`}
        />
      </FigureCard>
    </div>
  )
}

function StageQkv({ result, trace }: { result: ExplorerResult; trace: MultiHeadTrace }) {
  const rows = result.steps.map((s) => s.token)
  const multi = trace.heads.length > 1
  return (
    <div className="space-y-4">
      {multi ? (
        <Callout tone="indigo" title={`${trace.heads.length} heads, each over ${trace.headWidths[0]} dimensions`}>
          Each head takes a contiguous slice of the projected vectors and runs its own attention over it. The slices below
          are what the model actually multiplies; the full-width matrices are their concatenation.
        </Callout>
      ) : null}
      {trace.heads.map((head) => {
        const cols = Array.from({ length: head.width }, (_, i) => `d${head.from + i}`)
        return (
          <FigureCard
            key={head.index}
            title={multi ? `Head ${head.index} — dimensions ${head.from}–${head.to - 1}` : EXPLORER_STAGES.qkv}
            subtitle={
              multi
                ? `Q = H W_q, K = H W_k, V = H W_v, each restricted to this head's slice of the hidden dimension.`
                : 'Q = H W_q, K = H W_k, V = H W_v — three different views of the same hidden states.'
            }
          >
            <div className="split-3">
              <Heatmap matrix={head.Q} rowLabels={rows} colLabels={cols} title={`Queries Q ${shapeOf(head.Q)}`} showValues={false} />
              <Heatmap matrix={head.K} rowLabels={rows} colLabels={cols} title={`Keys K ${shapeOf(head.K)}`} showValues={false} />
              <Heatmap matrix={head.V} rowLabels={rows} colLabels={cols} title={`Values V ${shapeOf(head.V)}`} showValues={false} />
            </div>
          </FigureCard>
        )
      })}
      <FigureCard title="Intuition" subtitle="What each projection is for.">
        <p className="text-xs leading-relaxed text-muted">
          A query asks “what am I looking for?”, a key advertises “what do I contain?”, and the value is the payload that
          gets mixed once the match is scored. Projection matrices here are fixed by seed{' '}
          <span className="font-mono">{DEFAULT_TOY_CONFIG.seed}</span>, so you can reproduce every digit.
        </p>
      </FigureCard>
    </div>
  )
}

function StageScores({ result, trace }: { result: ExplorerResult; trace: MultiHeadTrace }) {
  const rows = result.steps.map((s) => s.token)
  const multi = trace.heads.length > 1
  return (
    <div className="space-y-4">
      {multi ? (
        <Callout tone="indigo" title="Each head scores in its own subspace">
          The scaling factor is <InlineMath tex="1/\sqrt{d_{head}}" /> — with more heads the head dimension is smaller,
          so the same raw dot product is divided by a smaller number. That is why the numbers below are not the
          single-head numbers scaled uniformly.
        </Callout>
      ) : null}
      {trace.heads.map((head) => {
        const d = head.width
        return (
          <div key={head.index} className="space-y-4">
            <FigureCard
              title={multi ? `Head ${head.index} — raw dot products Q Kᵀ` : 'Raw dot products Q Kᵀ'}
              subtitle="Before scaling: larger head dimensions produce larger magnitudes, which is exactly why we scale."
            >
              <Heatmap matrix={head.raw} rowLabels={rows} colLabels={rows} title={`Q Kᵀ ${shapeOf(head.raw)}`} />
            </FigureCard>
            <FigureCard
              title={multi ? `Head ${head.index} — ${EXPLORER_STAGES.scores}` : EXPLORER_STAGES.scores}
              subtitle={`Scaled by 1/√d = 1/√${d} = ${fmt(1 / Math.sqrt(d))}`}
            >
              <DisplayMath tex={`\\frac{Q K^{\\top}}{\\sqrt{${d}}}`} />
              <Heatmap
                testId={multi ? undefined : 'score-heatmap'}
                matrix={head.scores}
                rowLabels={rows}
                colLabels={rows}
                title="Scaled scores S (masked entries shown as −1e30)"
                dimmed={head.scores.map((row) => row.map((value) => value <= -1e29))}
              />
            </FigureCard>
          </div>
        )
      })}
    </div>
  )
}

function StageMask({ result, masked }: { result: ExplorerResult; masked: boolean }) {
  const rows = result.steps.map((s) => s.token)
  // Display form of the mask: 0 = a position the row may attend to, 1 = blocked (−∞).
  const mask = useMemo(
    () => rows.map((_, i) => rows.map((__, k) => (!masked ? 0 : i >= k ? 0 : 1))),
    [rows, masked],
  )
  return (
    <FigureCard
      title={EXPLORER_STAGES.mask}
      subtitle={masked ? 'Future positions are set to −∞ before the softmax.' : 'Masking is OFF: attention can see the future.'}
      footer={
        masked
          ? 'After softmax, −∞ becomes exactly 0, so no future information can flow into an earlier position.'
          : 'This is how a model would leak the answer it is supposed to predict. Real decoders always mask during training and generation.'
      }
    >
      <DisplayMath tex="\operatorname{Mask}_{(i,k)} = \begin{cases} 0 & i \ge k \\ -\infty & i < k \end{cases}" />
      <div className="split-2">
        <Heatmap
          matrix={mask}
          rowLabels={rows}
          colLabels={rows}
          domain={[0, 1]}
          title="Mask matrix as displayed (0 = visible, 1 = blocked with −∞)"
          showValues={false}
          caption="The upper triangle is the future. Because the mask is additive, one matrix handles every row."
        />
        <Heatmap
          testId="weight-heatmap"
          matrix={result.attentionTrace.weights}
          rowLabels={rows}
          colLabels={rows}
          title={masked ? 'Resulting attention weights' : 'Attention weights without a mask'}
          caption={
            masked
              ? 'Zeros above the diagonal are proof the mask was applied.'
              : 'Every row spreads mass across all positions, including future ones.'
          }
        />
      </div>
    </FigureCard>
  )
}

function StageSoftmax({
  result,
  trace,
  head,
  setHeadIndex,
  inspect,
  setInspect,
}: {
  result: ExplorerResult
  trace: MultiHeadTrace
  head: HeadTrace
  setHeadIndex: (value: number) => void
  inspect: { row: number; col: number }
  setInspect: (value: { row: number; col: number }) => void
}) {
  const rows = result.steps.map((s) => s.token)
  const { row, col } = inspect
  const scores = head.scores[row] ?? []
  const weights = head.weights[row] ?? []
  const maskedOut = scores[col] === undefined || (head.scores[row]?.[col] ?? 0) <= -1e29
  const denominator = scores.reduce((sum, value) => sum + Math.exp(value - Math.max(...scores.filter(Number.isFinite))), 0)
  const multi = trace.heads.length > 1

  return (
    <div className="space-y-4">
      {multi ? (
        <FigureCard
          title="Which head to inspect"
          subtitle="Each head normalises its own scores, so the weights differ between heads."
          actions={
            <SegmentedControl
              label=""
              value={String(head.index)}
              onChange={(value) => setHeadIndex(Number(value))}
              options={trace.heads.map((entry) => ({
                value: String(entry.index),
                label: `head ${entry.index}`,
                hint: `dimensions ${entry.from}–${entry.to - 1}`,
              }))}
            />
          }
        >
          <p className="text-xs leading-relaxed text-muted">
            The table below shows where each head sends its attention. Different heads specialise — one may track the
            previous token, another the token two positions back — and the model reads all of them in parallel.
          </p>
        </FigureCard>
      ) : null}
      <FigureCard
        title={multi ? `Head ${head.index} — ${EXPLORER_STAGES.softmax}` : EXPLORER_STAGES.softmax}
        subtitle="Each row is normalised independently: every token distributes one unit of attention over the positions it can see."
      >
        <DisplayMath tex="\operatorname{Softmax}(s_i)_ k = \frac{e^{s_{i,k}}}{\sum_{k'} e^{s_{i,k'}}}" />
        <Heatmap
          testId="weight-heatmap"
          matrix={head.weights}
          rowLabels={rows}
          colLabels={rows}
          title="Attention weight matrix A"
          caption="Row sums are exactly 1. Zeros in the upper triangle come from the mask."
        />
      </FigureCard>

      <FigureCard
        title="Inspect a single cell"
        subtitle="Pick any (query position, key position) and follow the arithmetic by hand."
        actions={
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">
              query
              <select
                value={row}
                onChange={(event) => setInspect({ row: Number(event.target.value), col })}
                className="ml-1 rounded-lg border border-control bg-panel-2 px-2 py-1 font-mono text-xs text-fg"
              >
                {rows.map((label, index) => (
                  <option key={index} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              key
              <select
                value={col}
                onChange={(event) => setInspect({ row, col: Number(event.target.value) })}
                className="ml-1 rounded-lg border border-control bg-panel-2 px-2 py-1 font-mono text-xs text-fg"
              >
                {rows.map((label, index) => (
                  <option key={index} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      >
        <ol className="space-y-2 text-sm text-muted" data-testid="softmax-walkthrough">
          <li>
            <span className="font-mono text-fg">1.</span> scaled score{' '}
            <InlineMath tex={`s_{${row},${col}} = ${maskedOut ? '\\text{masked}' : fmt(scores[col] ?? 0, 4)}`} />
          </li>
          <li>
            <span className="font-mono text-fg">2.</span> apply the mask:{' '}
            {maskedOut ? (
              <span className="text-amber">
                the entry is −∞, so its exponential is exactly 0 and it can never receive attention.
              </span>
            ) : (
              <span>
                the entry is ≥ 0 after masking, so it survives with value{' '}
                <InlineMath tex={`e^{${fmt(scores[col] ?? 0, 3)}} = ${fmt(Math.exp(scores[col] ?? 0), 4)}`} />
              </span>
            )}
          </li>
          <li>
            <span className="font-mono text-fg">3.</span> denominator (sum of exponentials, using the numerical-stability
            form): <InlineMath tex={`\\sum_{k'} e^{s_{${row},k'} - \\max} = ${fmt(denominator, 4)}`} />
          </li>
          <li>
            <span className="font-mono text-fg">4.</span> weight{' '}
            <InlineMath tex={`A_{${row},${col}} = ${fmt(weights[col] ?? 0, 4)}`} />
          </li>
        </ol>
      </FigureCard>
    </div>
  )
}

function StageBlock({ result }: { result: ExplorerResult }) {
  const rows = result.steps.map((s) => s.token)
  const { attentionOut, afterNorm1, ffnHidden, ffnOut, blockOut } = result.block
  const cols = (matrix: number[][]) =>
    Array.from({ length: matrix[0]?.length ?? 0 }, (_, i) => `d${i}`)

  return (
    <div className="space-y-4">
      <FigureCard
        title="Residual connection and layer norm"
        subtitle="A block adds to the representation rather than replacing it, then normalises the result."
        footer="The residual connection is why a deep stack of blocks does not destroy the signal: a sub-layer that has nothing useful to add can leave its input alone."
      >
        <DisplayMath tex="H' = \operatorname{LayerNorm}(H + \operatorname{Attention}(H))" />
        <div className="split-2">
          <Heatmap
            matrix={attentionOut}
            rowLabels={rows}
            colLabels={cols(attentionOut)}
            title="Attention sub-layer output"
            showValues={false}
          />
          <Heatmap
            matrix={afterNorm1}
            rowLabels={rows}
            colLabels={cols(afterNorm1)}
            title="After the residual add and layer norm"
            showValues={false}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Layer norm centres each row and rescales it to unit variance, so the size of a row stops depending on how
          large its inputs happened to be.
        </p>
      </FigureCard>

      <FigureCard
        title="Feed-forward network"
        subtitle="Two linear projections with a GELU in between, applied to every position independently."
        footer="The feed-forward network is where the model does most of its per-token work; attention is what lets a position see the others."
      >
        <DisplayMath tex="H'' = \operatorname{LayerNorm}\big(H' + W_2 \,\operatorname{GELU}(W_1 H' + b_1) + b_2\big)" />
        <div className="split-2">
          <Heatmap
            matrix={ffnHidden}
            rowLabels={rows}
            colLabels={Array.from({ length: ffnHidden[0]?.length ?? 0 }, (_, i) => `h${i}`)}
            title="Hidden activation (GELU)"
            showValues={false}
            caption={`The hidden layer is ${ffnHidden[0]?.length ?? 0} wide — four times the model dimension, as it is in a real Transformer.`}
          />
          <Heatmap
            matrix={ffnOut}
            rowLabels={rows}
            colLabels={cols(ffnOut)}
            title="Feed-forward output"
            showValues={false}
          />
        </div>
      </FigureCard>

      <FigureCard
        title="The block's output"
        subtitle="After the second residual connection and normalisation. This is what the vocabulary projection reads."
      >
        <Heatmap
          testId="block-heatmap"
          matrix={blockOut}
          rowLabels={rows}
          colLabels={cols(blockOut)}
          title={`Block output ${shapeOf(blockOut)}`}
        />
        <p className="mt-3 text-xs leading-relaxed text-muted">
          One block, {result.shapes.dim} dimensions, {result.shapes.sequenceLength} positions. The next-token
          distribution on the following stage is a projection of the last row of this matrix.
        </p>
      </FigureCard>
    </div>
  )
}

function StageOutput({
  result,
  trace,
  head,
  inspect,
  setInspect,
}: {
  result: ExplorerResult
  trace: MultiHeadTrace
  head: HeadTrace
  inspect: { row: number; col: number }
  setInspect: (value: { row: number; col: number }) => void
}) {
  const rows = result.steps.map((s) => s.token)
  const { row } = inspect
  const weights = head.weights[row] ?? []
  const output = trace.merged
  const contributions = weights
    .map((weight, index) => ({ index, weight, token: rows[index] }))
    .filter((entry) => entry.weight > 1e-6)
    .sort((a, b) => b.weight - a.weight)

  return (
    <div className="space-y-4">
      <FigureCard
        title={EXPLORER_STAGES.output}
        subtitle={
          trace.heads.length > 1
            ? 'The head outputs are concatenated (Merge) and this is the result. Each head contributed its own slice of the columns.'
            : 'The attention output mixes value vectors with the weights: A · V. This is the attention sub-layer’s contribution, before the residual connection.'
        }
      >
        <DisplayMath tex="\operatorname{output}_i = \sum_{k \le i} A_{i,k} \, v_k" />
        <Heatmap
          testId="output-heatmap"
          matrix={output}
          rowLabels={rows}
          colLabels={Array.from({ length: output[0]?.length ?? 0 }, (_, i) => `d${i}`)}
          title={`Attention output ${shapeOf(output)}`}
        />
      </FigureCard>
      {trace.heads.length > 1 ? (
        <FigureCard
          title="Where each head sends its attention"
          subtitle="The position each head weights most strongly, for the last row of the sequence."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-faint">
                  <th className="py-1.5 font-medium">head</th>
                  <th className="py-1.5 font-medium">dimensions</th>
                  <th className="py-1.5 font-medium">attends most to</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {trace.heads.map((entry) => {
                  const target = entry.topIndex[entry.topIndex.length - 1] ?? 0
                  return (
                    <tr key={entry.index} className="border-b border-line-soft">
                      <td className="py-1.5 text-fg">{entry.index}</td>
                      <td className="py-1.5 text-muted">
                        {entry.from}–{entry.to - 1}
                      </td>
                      <td className="py-1.5 text-teal">{rows[target] ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </FigureCard>
      ) : null}
      <FigureCard
        title={`Where row ${row} ("${rows[row]}") gets its information`}
        subtitle="Each surviving weight is a contribution to the mixed output vector."
      >
        <ul className="space-y-1.5">
          {contributions.map((entry) => (
            <li key={entry.index} className="flex items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => setInspect({ row, col: entry.index })}
                className="font-mono text-xs text-indigo hover:underline"
              >
                key {entry.index}: {entry.token}
              </button>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
                <div className="h-full rounded-full bg-teal-strong" style={{ width: `${entry.weight * 100}%` }} />
              </div>
              <span className="w-14 text-right font-mono text-xs text-muted">{fmt(entry.weight, 3)}</span>
            </li>
          ))}
        </ul>
      </FigureCard>
    </div>
  )
}

function StagePrediction({
  result,
  temperature,
  setTemperature,
  items,
  labels,
}: {
  result: ExplorerResult
  temperature: number
  setTemperature: (value: number) => void
  items: { token: string; probability: number }[]
  labels: string[]
}) {
  const lastRow = result.attentionTrace.output.length - 1
  return (
    <div className="space-y-4">
      <FigureCard
        title={EXPLORER_STAGES.prediction}
        subtitle={`Only the final position (row ${lastRow}) is used to predict the next token, exactly as in autoregressive decoding.`}
        footer="The unembedding matrix here maps 8 hidden dimensions to the toy vocabulary with a hand-chosen pattern. A trained model learns a much larger matrix; the shape of the computation is the same."
      >
        <DisplayMath tex="\Pr(\cdot \mid x_0 \dots x_{m-1}) = \operatorname{Softmax}(H_L W_o)" />
        <div className="split-side-left">
          <div className="space-y-4">
            <Slider
              label="Temperature applied to the logits"
              value={temperature}
              min={0.1}
              max={2.5}
              step={0.05}
              onChange={setTemperature}
              format={(value) => `τ = ${value.toFixed(2)}`}
              hint="Lower τ sharpens the distribution toward the top candidate; higher τ flattens it."
            />
            <Stat
              label="Top candidate"
              value={items[0] ? `${items[0].token}` : '—'}
              hint={items[0] ? `probability ${fmt(items[0].probability, 4)}` : undefined}
              tone="amber"
            />
            <Stat
              label="Candidates above 1%"
              value={items.filter((item) => item.probability > 0.01).length}
              tone="teal"
              hint="Effective breadth of the next-token choice."
            />
          </div>
          <TokenDistributionChart items={items} highlight={items[0]?.token} />
        </div>
      </FigureCard>
      <Callout tone="indigo" title="What this is not">
        These probabilities come from teacher-chosen matrices, so they carry no linguistic knowledge. The lesson is the
        mechanism — embedding, attention, normalisation, projection — not the prediction. A trained model of this shape
        would learn <span className="font-mono">{labels.length}</span> contextual representations and a much larger
        output matrix.
      </Callout>
    </div>
  )
}

/** Attention arcs: a readable alternative to the matrix for short sequences. */
function CircleOfAttention({
  result,
  labels,
  onPick,
}: {
  result: ExplorerResult
  labels: string[]
  onPick: (row: number, col: number) => void
}) {
  const [selected, setSelected] = useState(labels.length - 1)
  const row = Math.min(selected, labels.length - 1)
  const weights = result.attentionTrace.weights[row] ?? []
  const width = 640
  const height = 150
  const step = labels.length > 1 ? (width - 80) / (labels.length - 1) : 0

  return (
    <FigureCard
      title="Attention arcs"
      subtitle={`Row ${row} ("${labels[row] ?? ''}") distributes its attention over earlier positions.`}
      actions={
        <label className="text-xs text-muted">
          query position
          <input
            type="range"
            min={0}
            max={Math.max(0, labels.length - 1)}
            value={row}
            onChange={(event) => setSelected(Number(event.target.value))}
            className="ml-2 align-middle"
          />
        </label>
      }
      footer="Arc thickness is the attention weight. Only arcs that survive the mask are drawn; a masked position has weight exactly 0."
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Attention arcs figure">
        <line x1={40} y1={height - 30} x2={width - 40} y2={height - 30} stroke="var(--line)" />
        {labels.map((label, index) => {
          const x = 40 + index * step
          const weight = weights[index] ?? 0
          return (
            <g key={index}>
              {weight > 0.002 ? (
                <path
                  d={`M ${40 + row * step} ${height - 34} Q ${(40 + row * step + x) / 2} ${
                    height - 34 - 40 - weight * 60
                  } ${x} ${height - 34}`}
                  fill="none"
                  stroke="var(--teal)"
                  strokeWidth={Math.max(1, weight * 10)}
                  opacity={0.25 + weight}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onPick(row, index)}
                />
              ) : null}
              <circle
                cx={x}
                cy={height - 30}
                r={index === row ? 6 : 4}
                fill={index === row ? 'var(--amber)' : 'var(--indigo)'}
              />
              <text
                x={x}
                y={height - 10}
                textAnchor="middle"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--muted)"
              >
                {label.length > 9 ? `${label.slice(0, 8)}…` : label}
              </text>
              <text x={x} y={height - 46} textAnchor="middle" fontSize="9" fill="var(--faint)">
                {weight > 0.002 ? fmt(weight, 2) : ''}
              </text>
            </g>
          )
        })}
      </svg>
    </FigureCard>
  )
}

export default TransformerExplorer
