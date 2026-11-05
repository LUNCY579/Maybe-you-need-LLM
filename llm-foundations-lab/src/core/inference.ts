/**
 * Inference and reasoning laboratory core.
 *
 * Three honest building blocks:
 *  1. `ToyAutoregressiveLM` — an explicit transition table over a tiny vocabulary.
 *     Generation is real autoregressive decoding; the "model" is a hand-written
 *     table, and the UI says so.
 *  2. A KV-cache *memory model* — the standard analytical formula for cache bytes.
 *     The book introduces the cache conceptually in Section 2.3.3 ("Cache and
 *     Memory") and gives the size bound O(L · n_g · d_h · m) in Section 2.3.4
 *     ("Sharing across Heads and Layers"). It is an analytic calculation, not a
 *     measurement of a real deployment, and it is labelled as such.
 *  3. A reasoning-path simulator — best-of-n sampling and beam search over a toy
 *     tree with node rewards. The search really runs; the tree is synthetic.
 */
import { createRng, softmax, type Rng, type Vector } from './math'

/* ------------------------------------------------------------------ *
 * 1. Toy autoregressive language model
 * ------------------------------------------------------------------ */

export const TOY_LM_TOKENS = ['<bos>', 'the', 'model', 'learns', 'from', 'text', 'and', 'generates', 'tokens', '<eos>'] as const

/**
 * Hand-written next-token distribution per predecessor, with a small "context"
 * effect: after the bigram "model learns", "from" becomes much more likely.
 * It is a table, not a neural network — the lab labels it as a toy transition model.
 */
const BIGRAM_TABLE: Record<string, Record<string, number>> = {
  '<bos>': { the: 6, a: 1.5, model: 0.4 },
  the: { model: 6, text: 1.2, next: 0.3, tokens: 0.2 },
  model: { learns: 4.5, generates: 3.4, predicts: 2.2, is: 0.8 },
  learns: { from: 6.5, the: 0.5, tokens: 0.3 },
  from: { text: 5.5, the: 2.2, tokens: 0.7 },
  text: { and: 3.2, '<eos>': 3.6, tokens: 0.9 },
  and: { generates: 3.0, learns: 1.4, predicts: 1.2 },
  generates: { tokens: 4.6, text: 2.4, '<eos>': 0.9 },
  tokens: { '<eos>': 5.5, and: 1.1 },
  '<eos>': {},
}

/** Context-sensitive boost applied when a token is present anywhere in the window. */
const CONTEXT_BOOSTS: Record<string, { token: string; boost: number }> = {
  learns: { token: 'from', boost: 4 },
  generates: { token: 'tokens', boost: 3.5 },
  predicts: { token: 'the', boost: 3 },
}

export class ToyAutoregressiveLM {
  readonly tokens: readonly string[] = TOY_LM_TOKENS
  /** Number of context tokens the model can see (its effective context window). */
  readonly contextWindow: number

  constructor(contextWindow = 4) {
    this.contextWindow = contextWindow
  }

  /** Logits for the next token given the visible context window. */
  logits(context: readonly string[]): Vector {
    const visible = Number.isFinite(this.contextWindow)
      ? context.slice(Math.max(0, context.length - Math.max(this.contextWindow, 1)))
      : context
    const previous = visible[visible.length - 1] ?? '<bos>'
    const row = BIGRAM_TABLE[previous] ?? {}
    const logits = this.tokens.map((token) => row[token] ?? -6)
    for (const seen of visible) {
      const boost = CONTEXT_BOOSTS[seen]
      if (boost) {
        const index = this.tokens.indexOf(boost.token)
        if (index >= 0) logits[index] += boost.boost
      }
    }
    return logits
  }

  probabilities(context: readonly string[], temperature = 1): Vector {
    return softmax(this.logits(context), temperature)
  }

  /** True when this prefix is a valid sentence under the table. */
  isValidPrefix(context: readonly string[]): boolean {
    if (context.length === 0) return true
    const previous = context[context.length - 1]
    if (!(previous in BIGRAM_TABLE)) return false
    if (context.length === 1) return previous === '<bos>'
    return true
  }
}

export interface ToyGenerationStep {
  index: number
  context: string[]
  nextToken: string
  probability: number
  /** Share of the probability mass the top token held at this step. */
  peakProbability: number
  entropy: number
}

/** Autoregressive decoding with temperature and an optional context window. */
export function autoregressiveDecode(
  lm: ToyAutoregressiveLM,
  prompt: readonly string[],
  maxNewTokens: number,
  temperature = 1,
  seed = 1,
): { tokens: string[]; steps: ToyGenerationStep[] } {
  const rng: Rng = createRng(seed)
  const tokens = [...prompt]
  const steps: ToyGenerationStep[] = []
  for (let i = 0; i < maxNewTokens; i++) {
    const probs = lm.probabilities(tokens, temperature)
    let r = rng()
    let chosen = probs.length - 1
    for (let j = 0; j < probs.length; j++) {
      r -= probs[j]
      if (r <= 0) {
        chosen = j
        break
      }
    }
    let entropy = 0
    for (const p of probs) if (p > 0) entropy -= p * Math.log(p)
    steps.push({
      index: i,
      context: [...tokens],
      nextToken: lm.tokens[chosen],
      probability: probs[chosen],
      peakProbability: Math.max(...probs),
      entropy,
    })
    tokens.push(lm.tokens[chosen])
    if (lm.tokens[chosen] === '<eos>') break
  }
  return { tokens, steps }
}

/* ------------------------------------------------------------------ *
 * 2. KV-cache memory model (analytical, not a benchmark)
 * ------------------------------------------------------------------ */

export interface KvCacheConfig {
  /** Number of Transformer layers. */
  layers: number
  /** Number of query heads. */
  queryHeads: number
  /** Number of key/value heads (equal to queryHeads for MHA, fewer for GQA/MQA). */
  kvHeads: number
  /** Dimension per head. */
  headDim: number
  /** Context length in tokens. */
  contextLength: number
  /** Bytes per stored number: 2 for fp16/bf16, 1 for int8, 0.5 for int4. */
  bytesPerValue: number
  /** Batch size (number of concurrent sequences). */
  batchSize: number
}

export const DEFAULT_KV_CONFIG: KvCacheConfig = {
  layers: 32,
  queryHeads: 32,
  kvHeads: 8,
  headDim: 128,
  contextLength: 4096,
  bytesPerValue: 2,
  batchSize: 1,
}

/**
 * Bytes for the key and value tensors of one sequence:
 *   2 (K and V) × layers × kvHeads × headDim × contextLength × bytesPerValue
 * This is the standard accounting used when discussing long-context memory
 * (book Section 2.3.3); it is an estimate for a cache of this shape.
 */
export function kvCacheBytes(config: KvCacheConfig): number {
  const { layers, kvHeads, headDim, contextLength, bytesPerValue, batchSize } = config
  return 2 * layers * kvHeads * headDim * contextLength * bytesPerValue * batchSize
}

/** Attention weights stored per token in the cache (K and V tensors). */
export function kvCacheValues(config: KvCacheConfig): number {
  return 2 * config.layers * config.kvHeads * config.headDim * config.contextLength * config.batchSize
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

/**
 * Analytical attention work model (not a hardware benchmark).
 * Score computation is O(T² · d) per head for prefill; decoding one token needs
 * O(T · d) per head because only one query is processed against cached keys.
 */
export function attentionMultiplyAdds(contextLength: number, headDim: number, heads: number): number {
  return contextLength * contextLength * headDim * heads
}

export function decodeMultiplyAdds(contextLength: number, headDim: number, heads: number): number {
  return contextLength * headDim * heads
}

/** Ratio of cached memory between grouped-query attention and full multi-head attention. */
export function gqaMemoryRatio(config: KvCacheConfig): number {
  if (config.kvHeads <= 0) return Number.POSITIVE_INFINITY
  return config.kvHeads / Math.max(config.queryHeads, 1)
}

/* ------------------------------------------------------------------ *
 * 3. Reasoning path search on a toy tree
 * ------------------------------------------------------------------ */

export interface ReasoningNode {
  id: string
  /** Short label of the reasoning step. */
  label: string
  parentId: string | null
  /** Verifier score in [0, 1] — the "reward model" for the step. */
  score: number
  /** True when this node completes a correct solution. */
  terminal: boolean
  correct: boolean
}

/**
 * A synthetic reasoning tree. Each node is a partial solution; a verifier can
 * score it. The laboratory searches it for real, which lets learners compare
 * greedy, best-of-n and beam search on the same problem.
 */
export function buildToyReasoningTree(): ReasoningNode[] {
  // Scores are chosen so that the *first* step of the wrong branch looks best to a
  // greedy searcher, while the correct branch only overtakes it two steps later.
  // That is the textbook reason to keep several hypotheses alive (beam search).
  return [
    { id: 'root', label: 'Problem: 17 × 6', parentId: null, score: 0.5, terminal: false, correct: false },
    // Branch A — correct decomposition, unimpressive first step.
    { id: 'a1', label: '17 × 6 = 17 × (5 + 1)', parentId: 'root', score: 0.4, terminal: false, correct: false },
    { id: 'a2', label: '= 17 × 5 + 17', parentId: 'a1', score: 0.55, terminal: false, correct: false },
    { id: 'a3', label: '= 85 + 17 = 102', parentId: 'a2', score: 0.95, terminal: true, correct: true },
    // Branch B — plausible and confident, but arithmetically wrong.
    { id: 'b1', label: '17 × 6 = 16 × 6 + 1', parentId: 'root', score: 0.75, terminal: false, correct: false },
    { id: 'b2', label: '16 × 6 = 96, so 96 + 1 = 97', parentId: 'b1', score: 0.9, terminal: true, correct: false },
    // Branch C — correct, but slow to look promising.
    { id: 'c1', label: '17 × 6 = (10 × 6) + (7 × 6)', parentId: 'root', score: 0.6, terminal: false, correct: false },
    { id: 'c2', label: '(10 × 6) = 60', parentId: 'c1', score: 0.82, terminal: false, correct: false },
    { id: 'c3', label: '(7 × 6) = 42, total 60 + 42 = 102', parentId: 'c2', score: 0.97, terminal: true, correct: true },
    // Branch D — a confident shortcut that is wrong.
    { id: 'd1', label: '17 × 6 = 100 (rounded)', parentId: 'root', score: 0.5, terminal: true, correct: false },
  ]
}

export interface SearchResult {
  /** Terminal node ids kept. */
  selected: string[]
  /** Every node scored (the "verification calls" budget actually spent). */
  verified: string[]
  /** Depth of the search. */
  depth: number
  /** Whether the best selected terminal is correct. */
  correct: boolean
  /** Number of node expansions — a proxy for inference cost. */
  expansions: number
}

function childrenOf(tree: ReasoningNode[], id: string): ReasoningNode[] {
  return tree.filter((node) => node.parentId === id)
}

/**
 * Beam search over the toy tree. `beamWidth = 1` reproduces greedy decoding;
 * larger widths keep several partial solutions alive.
 *
 * The search keeps going after a terminal node appears, because a higher-scoring
 * terminal may still be one step deeper — this is exactly the failure mode that
 * traps greedy decoding on the toy tree.
 */
export function beamSearch(tree: ReasoningNode[], beamWidth: number, maxDepth = 6): SearchResult {
  const width = Math.max(1, Math.floor(beamWidth))
  let frontier: ReasoningNode[] = tree.filter((node) => node.parentId === null)
  const verified: string[] = []
  const terminals: ReasoningNode[] = []
  let expansions = 0
  let depth = 0

  for (let step = 0; step < maxDepth && frontier.length > 0; step++) {
    const candidates = frontier.flatMap((node) => childrenOf(tree, node.id))
    if (candidates.length === 0) break
    depth = step + 1
    expansions += candidates.length
    for (const node of candidates) verified.push(node.id)
    for (const node of candidates) if (node.terminal) terminals.push(node)
    const frontierCandidates = candidates.filter((node) => !node.terminal)
    frontier = [...frontierCandidates].sort((a, b) => b.score - a.score).slice(0, width)
  }

  const ranked = [...terminals].sort((a, b) => b.score - a.score)
  const best = ranked[0] ?? [...frontier].sort((a, b) => b.score - a.score)[0]
  return {
    selected: best ? [best.id] : [],
    verified,
    depth,
    correct: best?.correct ?? false,
    expansions,
  }
}

/**
 * Best-of-n: sample n complete paths, score each with the verifier and keep the best.
 * `temperature` mutates the sampling distribution over children so that learners can
 * see the diversity/accuracy trade-off; results are reproducible for a given seed.
 */
export function bestOfN(tree: ReasoningNode[], n: number, temperature = 1, seed = 3): SearchResult {
  const rng = createRng(seed)
  const verified: string[] = []
  const paths: { node?: ReasoningNode; path: ReasoningNode[] }[] = []
  for (let i = 0; i < Math.max(1, n); i++) {
    let current = tree.find((node) => node.parentId === null)!
    const path: ReasoningNode[] = [current]
    while (!current.terminal) {
      const children = childrenOf(tree, current.id)
      if (children.length === 0) break
      const logits = children.map((c) => c.score / Math.max(temperature, 1e-6))
      const max = Math.max(...logits)
      const exps = logits.map((v) => Math.exp(v - max))
      const total = exps.reduce((s, v) => s + v, 0)
      const probs = exps.map((v) => v / total)
      let r = rng()
      let pick = 0
      for (let j = 0; j < probs.length; j++) {
        r -= probs[j]
        if (r <= 0) {
          pick = j
          break
        }
      }
      current = children[pick]
      path.push(current)
      verified.push(current.id)
    }
    paths.push({ node: current.terminal ? current : undefined, path })
  }
  const scored = paths
    .filter((p) => p.node)
    .map((p) => ({ node: p.node!, score: p.node!.score, path: p.path }))
    .sort((a, b) => b.score - a.score)
  const best = scored[0]
  return {
    selected: best ? [best.node.id] : [],
    verified,
    depth: best ? best.path.length - 1 : 0,
    correct: best?.node.correct ?? false,
    expansions: verified.length,
  }
}

/** Path from the root to a node, for rendering the chosen reasoning trace. */
export function pathToNode(tree: ReasoningNode[], id: string): ReasoningNode[] {
  const byId = new Map(tree.map((node) => [node.id, node]))
  const path: ReasoningNode[] = []
  let current = byId.get(id)
  while (current) {
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return path
}
