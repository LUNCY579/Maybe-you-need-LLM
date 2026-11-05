/**
 * Transformer Explorer core: the full forward pass of a *toy* single-block,
 * single-head (or multi-head) decoder over a hand-written example.
 *
 * Pipeline, matching Foundations of Large Language Models §2.1.1:
 *   text → demonstrative tokenization → token ids → embeddings
 *        → + positional information → Q, K, V → scaled scores → causal mask
 *        → row softmax → attention output → residual + layer norm
 *        → feed-forward network → residual + layer norm → vocabulary logits
 *        → next-token distribution
 *
 * Every stage returns the actual matrices so the UI can display them; nothing is
 * precomputed or hard-coded. This model has one block, a handful of dimensions and
 * a tiny vocabulary. It is not a language model and the course never claims it is.
 */
import { attention, projectQkv, topAttendedIndex, type AttentionTrace, type Qkv } from './attention'
import {
  addPositional,
  buildToyParameters,
  DEFAULT_TOY_CONFIG,
  positionalEncoding,
  toyEmbedding,
  type ToyModelConfig,
  type ToyParameters,
} from './embeddings'
import {
  addMatricesElementwise,
  gelu,
  layerNorm,
  matmul,
  softmax,
  type Matrix,
  type Vector,
} from './math'
import { tokenize, TOY_VOCAB, type TokenizationResult, type TokenizerMode } from './tokenizer'

/**
 * The intermediate results of one Transformer block, so the Explorer can show
 * every step of it rather than only the attention part.
 */
export interface BlockTrace {
  /** The attention sub-layer's output, before the residual connection. */
  attentionOut: Matrix
  /** After adding the residual and normalising. */
  afterNorm1: Matrix
  /** The feed-forward network's hidden activation. */
  ffnHidden: Matrix
  /** The feed-forward network's output. */
  ffnOut: Matrix
  /** After the second residual connection and normalisation: the block's output. */
  blockOut: Matrix
}

/**
 * One Transformer block.
 *
 * Following the structure in the book (§2.1.1), a decoder block is
 *
 *   H' = LayerNorm(H + Attention(H))
 *   H'' = LayerNorm(H' + FeedForward(H'))
 *
 * and the feed-forward network is two linear projections with a GELU in
 * between. The residual connections are the interesting part: they let the
 * sub-layer add to the representation rather than replace it, so a block that
 * has nothing useful to say passes its input through unchanged.
 */
export function runBlock(H: Matrix, params: ToyParameters, attentionOut: Matrix): BlockTrace {
  const afterNorm1 = layerNorm(
    addMatricesElementwise(H, attentionOut),
    params.gamma1,
    params.beta1,
  )
  const hidden = matmul(afterNorm1, params.W1).map((row) => row.map((value, index) => gelu(value + params.b1[index])))
  const ffnOut = matmul(hidden, params.W2).map((row) => row.map((value, index) => value + params.b2[index]))
  const blockOut = layerNorm(addMatricesElementwise(afterNorm1, ffnOut), params.gamma2, params.beta2)
  return { attentionOut, afterNorm1, ffnHidden: hidden, ffnOut, blockOut }
}

export interface ExplorerStageNames {
  tokens: string
  embeddings: string
  positions: string
  qkv: string
  scores: string
  mask: string
  softmax: string
  output: string
  block: string
  prediction: string
}

export const EXPLORER_STAGES: ExplorerStageNames = {
  tokens: 'Tokens & ids',
  embeddings: 'Token embeddings',
  positions: 'Positional information',
  qkv: 'Q, K, V',
  scores: 'Attention scores',
  mask: 'Causal mask',
  softmax: 'Softmax weights',
  output: 'Attention output',
  block: 'Feed-forward and residual',
  prediction: 'Next-token distribution',
}

export interface ExplorerStep {
  index: number
  token: string
  id: number | null
  tokenEmbedding: Vector
  positional: Vector
  hidden: Vector
}

export interface ExplorerResult {
  text: string
  mode: TokenizerMode
  tokenization: TokenizationResult
  steps: ExplorerStep[]
  /** Hidden states H [m x d] after adding positional information. */
  H: Matrix
  qkv: Qkv
  attentionTrace: AttentionTrace
  /** The rest of the block: residual connection, normalisation, feed-forward. */
  block: BlockTrace
  /** Contextual representation used for the next-token prediction. */
  lastRepresentation: Vector
  /** Logits over the toy vocabulary. */
  logits: Vector
  /** Context-dependent and prior contributions to the logits, kept separate. */
  logitBreakdown: OutputLogitBreakdown
  /** Full distribution over the toy vocabulary. */
  probabilities: Vector
  /** Top candidates (index, token, probability), sorted descending. */
  topPredictions: { token: string; probability: number; id: number }[]
  /** True when the input produced no tokens at all. */
  isEmpty: boolean
  /** Sizes of the matrices involved, for the "what's the shape?" annotations. */
  shapes: {
    sequenceLength: number
    dim: number
    vocab: number
    attention: string
  }
}

const OOV_DISPLAY_TOKEN = '<unk>'

/**
 * A small, hand-written frequency prior over the toy vocabulary.
 *
 * A trained model learns this information into its unembedding matrix. Here the
 * unembedding `Wo` is a *seeded random* matrix — it is deliberately not trained —
 * so the prior is kept as a separate, explicit term. The Explorer shows both
 * contributions so learners can see exactly where each part of a logit comes from.
 *
 * The prior is teacher-chosen: it is not a measured corpus frequency.
 */
export const OUTPUT_FREQUENCY_PRIOR: number[] = TOY_VOCAB.map((token) => {
  const length = token.length
  // Very short tokens are function words in this toy vocabulary and are common.
  if (length <= 2) return 0.9
  if (length <= 4) return 0.6
  if (length <= 6) return 0.35
  if (length <= 9) return 0.15
  return 0
})

export interface OutputLogitBreakdown {
  /** Context-dependent part: representation · Wo (a genuine matrix product). */
  contextLogits: Vector
  /** The static frequency prior added on top. */
  prior: Vector
  /** contextLogits + prior — the logits the softmax consumes. */
  logits: Vector
}

/**
 * Project a contextual representation onto the vocabulary.
 *
 * The projection itself is a real matrix product against the model's own
 * (seeded, untrained) unembedding matrix `Wo`. The static prior is added
 * afterwards and reported separately so the two effects never blur together.
 */
export function outputLogitBreakdown(
  representation: Vector,
  params: ToyParameters,
  prior: readonly number[] = OUTPUT_FREQUENCY_PRIOR,
): OutputLogitBreakdown {
  const contextLogits = matmul([representation], params.Wo)[0] ?? []
  const paddedPrior = TOY_VOCAB.map((_, index) => prior[index] ?? 0)
  const logits = contextLogits.map((value, index) => value + paddedPrior[index])
  return { contextLogits, prior: paddedPrior, logits }
}

export function runExplorer(
  text: string,
  options: { mode: TokenizerMode; config?: ToyModelConfig; masked?: boolean } = { mode: 'word' },
): ExplorerResult {
  const config = options.config ?? DEFAULT_TOY_CONFIG
  const dim = config.dim
  const tokenization = tokenize(text, { mode: options.mode })
  const tokens = tokenization.tokens.map((t) => (t.oov || t.id === null ? OOV_DISPLAY_TOKEN : t.text))

  const params: ToyParameters = buildToyParameters(TOY_VOCAB.length, config)

  const steps: ExplorerStep[] = tokens.map((token, index) => {
    const tokenEmbedding = toyEmbedding(token, dim)
    const positional = positionalEncoding(index, dim)
    // H = token embedding + positional encoding, exactly the input a Transformer block receives.
    const hidden = addPositional(tokenEmbedding, index)
    return { index, token, id: tokenization.ids[index], tokenEmbedding, positional, hidden }
  })

  const H: Matrix = steps.map((step) => step.hidden)
  const qkv = projectQkv(H, params.Wq, params.Wk, params.Wv)
  const attentionTrace = attention(qkv.Q, qkv.K, qkv.V, { masked: options.masked ?? true })

  // The rest of the block: the residual connection, the normalisation, and the
  // feed-forward network. The vocabulary projection reads the *block's* output,
  // not the attention output directly.
  const block = runBlock(H, params, attentionTrace.output)

  const lastRepresentation = block.blockOut[block.blockOut.length - 1] ?? new Array<number>(dim).fill(0)
  const logitBreakdown = outputLogitBreakdown(lastRepresentation, params)
  const logits = logitBreakdown.logits
  const probabilities = softmax(logits)
  const topPredictions = probabilities
    .map((probability, id) => ({ probability, id, token: TOY_VOCAB[id] }))
    .filter((entry) => entry.id >= 4)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 10)

  return {
    text,
    mode: options.mode,
    tokenization,
    steps,
    H,
    qkv,
    attentionTrace,
    block,
    lastRepresentation,
    logits,
    logitBreakdown,
    probabilities,
    topPredictions,
    isEmpty: steps.length === 0,
    shapes: {
      sequenceLength: tokens.length,
      dim,
      vocab: TOY_VOCAB.length,
      attention: `[${tokens.length} × ${tokens.length}]`,
    },
  }
}

/** Everything one attention head computes, for the Explorer to display. */
export interface HeadTrace {
  /** Zero-based index of the head. */
  index: number
  /** The contiguous slice of the hidden dimension this head owns. */
  from: number
  to: number
  /** How many dimensions the head owns. */
  width: number
  Q: Matrix
  K: Matrix
  V: Matrix
  /** Raw dot products, before the 1/√d scaling. */
  raw: Matrix
  /** Scaled scores. */
  scores: Matrix
  /** Softmax weights. */
  weights: Matrix
  /** This head's attention output. */
  output: Matrix
  /** The position each row attends to most. */
  topIndex: number[]
}

export interface MultiHeadTrace {
  heads: HeadTrace[]
  /** The head outputs concatenated, [m × d]. */
  merged: Matrix
  /** How many dimensions each head owns. */
  headWidths: number[]
}

/**
 * Multi-head attention on the toy example.
 *
 * Following the book's formulation (Eq. 2.7–2.11): the full hidden states are
 * projected once into Q, K and V; head *j* then takes the contiguous slice of
 * columns [from, to) of each projection, runs attention inside that subspace,
 * and the per-head outputs are concatenated back to full width
 * (`Merge(head_1, …, head_h)`) before the output projection.
 *
 * Head widths are distributed as evenly as possible, so the concatenation always
 * restores exactly `dim` columns — no coordinate is silently dropped when the
 * number of heads does not divide the model dimension.
 */
export function multiHeadTrace(
  H: Matrix,
  params: ToyParameters,
  heads: number,
  options: { masked?: boolean } = {},
): MultiHeadTrace {
  const dim = H[0]?.length ?? 0
  const headCount = Math.max(1, Math.min(Math.floor(heads), dim))
  const masked = options.masked ?? true
  const base = Math.floor(dim / headCount)
  const remainder = dim % headCount

  const headWidths: number[] = []
  const boundaries: number[] = []
  let cursor = 0
  for (let h = 0; h < headCount; h++) {
    const width = base + (h < remainder ? 1 : 0)
    boundaries.push(cursor)
    headWidths.push(width)
    cursor += width
  }

  const Q = matmul(H, params.Wq)
  const K = matmul(H, params.Wk)
  const V = matmul(H, params.Wv)

  const headTraces: HeadTrace[] = []
  for (let h = 0; h < headCount; h++) {
    const from = boundaries[h]
    const to = from + headWidths[h]
    const Qh = Q.map((row) => row.slice(from, to))
    const Kh = K.map((row) => row.slice(from, to))
    const Vh = V.map((row) => row.slice(from, to))
    const raw = Qh.map((q) => Kh.map((k) => q.reduce((s, v, i) => s + v * k[i], 0)))
    const trace = attention(Qh, Kh, Vh, { masked })
    headTraces.push({
      index: h,
      from,
      to,
      width: headWidths[h],
      Q: Qh,
      K: Kh,
      V: Vh,
      raw,
      scores: trace.scores,
      weights: trace.weights,
      output: trace.output,
      topIndex: topAttendedIndex(trace.weights),
    })
  }

  // Merge: concatenate the head outputs along the feature axis.
  const merged: Matrix = H.map((_, row) => headTraces.flatMap((head) => head.output[row] ?? []))
  return { heads: headTraces, merged, headWidths }
}

/** Small helper used by the UI to explain the softmax denominator. */
export function softmaxDenominator(scores: Vector, temperature = 1): number {
  const scaled = scores.map((v) => Math.exp(v / temperature - Math.max(...scores) / temperature))
  return scaled.reduce((s, v) => s + v, 0)
}

/** Shape of a matrix string, used in captions. */
export function shapeOf(matrix: Matrix | Vector): string {
  if (matrix.length === 0) return '[0 × 0]'
  if (Array.isArray(matrix[0])) {
    const rows = matrix.length
    const cols = (matrix[0] as unknown as number[]).length
    return `[${rows} × ${cols}]`
  }
  return `[${matrix.length}]`
}
