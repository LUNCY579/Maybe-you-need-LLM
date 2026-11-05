/**
 * Prompting laboratory core: retrieval scoring and prompt-budget accounting.
 *
 * Honesty note: the retriever here does not embed text with a neural encoder.
 * Documents are described by an explicit, hand-written keyword vector, and the
 * query is projected into the same six-dimensional space. The cosine similarities
 * computed from those vectors are genuine arithmetic; they simply describe the
 * toy keyword model rather than a production embedding model.
 */
import { tokenize } from './tokenizer'

export const RETRIEVAL_AXES = ['tokens', 'attention', 'training', 'alignment', 'inference', 'reasoning'] as const
export type RetrievalAxis = (typeof RETRIEVAL_AXES)[number]

export interface ToyDocument {
  id: string
  title: string
  text: string
  /** Hand-written weight per axis, each in [0, 1]. */
  vector: number[]
}

export const TOY_DOCUMENTS: readonly ToyDocument[] = [
  {
    id: 'doc-tokenizer',
    title: 'Tokenization primer',
    text: 'Tokens are the units a model reads: words, subword pieces or characters, each mapped to an id in a fixed vocabulary.',
    vector: [1, 0.1, 0.2, 0, 0.1, 0],
  },
  {
    id: 'doc-attention',
    title: 'Attention mechanics',
    text: 'Queries and keys produce attention scores that are scaled, masked and normalised before being applied to values.',
    vector: [0.4, 1, 0.2, 0, 0.3, 0.1],
  },
  {
    id: 'doc-pretraining',
    title: 'Pre-training objectives',
    text: 'Self-supervised objectives train on unlabelled text by predicting hidden or next tokens before any task is chosen.',
    vector: [0.3, 0.2, 1, 0.1, 0, 0.1],
  },
  {
    id: 'doc-alignment',
    title: 'Preference alignment',
    text: 'Supervised fine-tuning imitates demonstrations; preference methods optimise comparisons between candidate answers.',
    vector: [0.2, 0, 0.5, 1, 0.2, 0.2],
  },
  {
    id: 'doc-inference',
    title: 'Serving and caching',
    text: 'Prefill fills a KV cache in parallel; decoding appends one token at a time, so memory bandwidth dominates throughput.',
    vector: [0.4, 0.5, 0.1, 0, 1, 0.2],
  },
  {
    id: 'doc-reasoning',
    title: 'Reasoning and search',
    text: 'Reasoning traces expose intermediate steps that a verifier can score, enabling search over candidate solutions.',
    vector: [0.2, 0.3, 0.2, 0.3, 0.3, 1],
  },
  {
    id: 'doc-longcontext',
    title: 'Long-context memory',
    text: 'Longer contexts raise attention cost quadratically during prefill and grow the cache linearly with the number of tokens.',
    vector: [0.5, 0.7, 0.1, 0, 0.9, 0.1],
  },
]

export function dotProduct(a: readonly number[], b: readonly number[]): number {
  let sum = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) sum += a[i] * b[i]
  return sum
}

export function magnitude(a: readonly number[]): number {
  return Math.sqrt(dotProduct(a, a))
}

/** Cosine similarity, guarded against zero vectors. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const denominator = magnitude(a) * magnitude(b)
  if (denominator === 0) return 0
  return dotProduct(a, b) / denominator
}

/**
 * Adjacency between retrieval axes, used for concept expansion.
 *
 * The relation is symmetric by construction: if a relates to b, b relates to a.
 * Every index is a valid position in RETRIEVAL_AXES.
 */
const AXIS_NEIGHBOURS: readonly (readonly number[])[] = [
  [1], // tokens    ↔ attention
  [0, 4], // attention ↔ tokens, inference
  [], // training  (no close neighbour)
  [5], // alignment ↔ reasoning
  [0, 1], // inference ↔ tokens, attention
  [3], // reasoning ↔ alignment
]

/**
 * Query terms that do not literally name an axis but clearly point at one.
 *
 * This is the lexical-expansion step of a keyword retriever: a term is mapped
 * onto the axis whose documents discuss it. The table is explicit and
 * hand-written — it is part of the toy model, not a learned embedding.
 */
const AXIS_SYNONYMS: Record<string, RetrievalAxis> = {
  // tokens
  tokenize: 'tokens',
  tokenization: 'tokens',
  tokeniser: 'tokens',
  tokenizer: 'tokens',
  vocabulary: 'tokens',
  ids: 'tokens',
  segment: 'tokens',
  // attention
  head: 'attention',
  heads: 'attention',
  query: 'attention',
  key: 'attention',
  value: 'attention',
  weights: 'attention',
  softmax: 'attention',
  score: 'attention',
  scores: 'attention',
  mechanics: 'attention',
  // training
  train: 'training',
  training: 'training',
  pretraining: 'training',
  objective: 'training',
  data: 'training',
  corpus: 'training',
  loss: 'training',
  gradient: 'training',
  optimisation: 'training',
  optimization: 'training',
  // alignment
  sft: 'alignment',
  rlhf: 'alignment',
  dpo: 'alignment',
  reward: 'alignment',
  prefer: 'alignment',
  preference: 'alignment',
  preferences: 'alignment',
  human: 'alignment',
  feedback: 'alignment',
  tune: 'alignment',
  fine: 'alignment',
  instruct: 'alignment',
  // inference
  cache: 'inference',
  caching: 'inference',
  kv: 'inference',
  decode: 'inference',
  decoding: 'inference',
  latency: 'inference',
  serving: 'inference',
  memory: 'inference',
  context: 'inference',
  window: 'inference',
  speed: 'inference',
  prefill: 'inference',
  // reasoning
  chain: 'reasoning',
  thought: 'reasoning',
  reason: 'reasoning',
  verify: 'reasoning',
  verifier: 'reasoning',
  step: 'reasoning',
  steps: 'reasoning',
  search: 'reasoning',
  path: 'reasoning',
}

/**
 * Build a query vector by matching query terms against the axis names, the
 * synonym table and the document vocabulary. Terms that match nothing contribute
 * nothing, which is the behaviour of a sparse lexical retriever.
 *
 * A matched axis then expands to its neighbours at half weight, and the
 * expansion is iterated to a fixed point so that a chain such as
 * "caching → inference → attention" propagates consistently. The expansion
 * never increases a weight beyond the value that was originally matched, and
 * every entry is guaranteed to stay finite.
 */
export function queryVector(query: string): number[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  const vector: number[] = RETRIEVAL_AXES.map((axis): number => {
    // Exact axis name, then an explicit synonym, then a prefix of the axis name.
    if (terms.includes(axis)) return 1
    if (terms.some((term) => AXIS_SYNONYMS[term] === axis)) return 0.85
    if (terms.some((term) => axis.startsWith(term) && term.length >= 4)) return 0.6
    return 0
  })
  // Neighbour expansion: a query about caching is also about inference, etc.
  for (let pass = 0; pass < RETRIEVAL_AXES.length; pass++) {
    const snapshot = [...vector]
    let changed = false
    snapshot.forEach((value, index) => {
      if (value === 0) return
      for (const neighbour of AXIS_NEIGHBOURS[index] ?? []) {
        if (neighbour < 0 || neighbour >= RETRIEVAL_AXES.length) continue
        const next = Math.max(vector[neighbour], value * 0.5)
        if (next !== vector[neighbour]) {
          vector[neighbour] = next
          changed = true
        }
      }
    })
    if (!changed) break
  }
  return vector.map((value) => (Number.isFinite(value) ? value : 0))
}

export interface RetrievedDocument {
  document: ToyDocument
  score: number
  rank: number
}

/** Rank documents by cosine similarity and keep the top `k` above `threshold`. */
export function retrieve(
  query: string,
  documents: readonly ToyDocument[] = TOY_DOCUMENTS,
  k = 3,
  threshold = 0,
): { queryVector: number[]; results: RetrievedDocument[]; scores: { id: string; score: number }[] } {
  const qv = queryVector(query)
  const scored = documents
    .map((document) => ({ document, score: cosineSimilarity(qv, document.vector) }))
    .sort((a, b) => b.score - a.score || a.document.id.localeCompare(b.document.id))
  return {
    queryVector: qv,
    results: scored
      .filter((entry) => entry.score > threshold)
      .slice(0, Math.max(1, Math.floor(k)))
      .map((entry, index) => ({ ...entry, rank: index + 1 })),
    scores: scored.map((entry) => ({ id: entry.document.id, score: entry.score })),
  }
}

/* ------------------------------------------------------------------ *
 * Prompt budget accounting
 * ------------------------------------------------------------------ */

export interface PromptPart {
  id: string
  label: string
  text: string
  /** Whether this part can be dropped when the budget is exceeded. */
  droppable: boolean
}

export interface PromptBudget {
  parts: { id: string; label: string; tokens: number; droppable: boolean }[]
  totalTokens: number
  contextWindow: number
  /** Fraction of the context window used, can exceed 1 before truncation. */
  utilisation: number
  /** True when the assembled prompt does not fit. */
  overflows: boolean
  /** Tokens removed if every droppable part is discarded. */
  droppableTokens: number
  /** Tokens that would be cut from the front of the non-droppable content. */
  overflowTokens: number
}

/** Estimate the token cost of each prompt part with the demonstrative tokenizer. */
export function promptBudget(parts: readonly PromptPart[], contextWindow: number): PromptBudget {
  const counted = parts.map((part) => ({
    id: part.id,
    label: part.label,
    tokens: tokenize(part.text, { mode: 'subword' }).sequenceLength,
    droppable: part.droppable,
  }))
  const totalTokens = counted.reduce((sum, part) => sum + part.tokens, 0)
  return {
    parts: counted,
    totalTokens,
    contextWindow,
    utilisation: contextWindow === 0 ? Number.POSITIVE_INFINITY : totalTokens / contextWindow,
    overflows: totalTokens > contextWindow,
    droppableTokens: counted.filter((part) => part.droppable).reduce((sum, part) => sum + part.tokens, 0),
    overflowTokens: Math.max(0, totalTokens - contextWindow),
  }
}

export const DEFAULT_PROMPT_PARTS: PromptPart[] = [
  {
    id: 'system',
    label: 'System instruction',
    text: 'You answer questions about language models using only the provided context. Cite the section you used.',
    droppable: false,
  },
  {
    id: 'examples',
    label: 'Worked examples',
    text: 'Question: what is a token? Answer: a token is the unit of text the model reads. Question: what is attention? Answer: attention weights the values of earlier positions.',
    droppable: true,
  },
  {
    id: 'retrieved',
    label: 'Retrieved context',
    text: 'Attention scores are scaled by the square root of the head dimension and masked so that a position cannot see the future.',
    droppable: true,
  },
  {
    id: 'question',
    label: 'User question',
    text: 'Why is the mask applied before the softmax instead of after?',
    droppable: false,
  },
]

/** Format for the context-utilisation meter. */
export function formatTokens(tokens: number): string {
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : String(tokens)
}
