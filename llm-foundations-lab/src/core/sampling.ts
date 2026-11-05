/**
 * Decoding laboratory core: deterministic, probability-based next-token sampling.
 *
 * The simulator operates on an explicit toy logit vector over a small vocabulary.
 * It is *not* a language model: no neural network is running. Every probability it
 * prints is the result of a real softmax / filtering computation on those logits,
 * which is exactly what a decoder does with the logits a model produces.
 *
 * Equations referenced from Foundations of Large Language Models, Section 5.1.3:
 *   top-k renormalisation .............. Eq. 5.24 / 5.25
 *   sampling from the filtered pool .... Eq. 5.26
 *   top-p (nucleus) candidate pool ..... Eq. 5.28
 *   temperature-scaled softmax ......... Eq. 5.29
 */
import { entropy, softmax, type Rng, type Vector } from './math'

export interface Candidate {
  token: string
  logit: number
  /** Probability after temperature scaling and renormalisation. */
  probability: number
  /** Index in the original (unsorted) logit vector. */
  index: number
}

export interface SamplingConfig {
  /** Temperature τ > 0. τ → 0 approaches greedy decoding. */
  temperature: number
  /** Keep only the k highest-probability tokens; k ≥ 1. */
  topK: number
  /** Keep the smallest set whose cumulative probability ≥ p; p ∈ (0, 1]. */
  topP: number
  /** Seed for the deterministic PRNG. */
  seed: number
}

export const DEFAULT_SAMPLING_CONFIG: SamplingConfig = {
  temperature: 1,
  topK: 8,
  topP: 0.9,
  seed: 42,
}

export interface DecodingTrace {
  /** Softmax of the raw logits (temperature = 1): the model's own distribution. */
  baseProbabilities: Vector
  /** Softmax of logits / τ. */
  temperatureProbabilities: Vector
  /** Indices retained by top-k and top-p, sorted by probability (descending). */
  candidateIndices: number[]
  /** Final renormalised distribution over the retained candidates. */
  probabilities: Vector
  /** Candidates with their final probabilities, sorted descending. */
  candidates: Candidate[]
  /** Entropy of the final distribution, in nats. */
  entropy: number
}

function assertTemperature(temperature: number): void {
  if (!Number.isFinite(temperature) || temperature <= 0) {
    throw new RangeError(
      `temperature must be a positive finite number (received ${temperature}); τ → 0 is approached with a small positive value`,
    )
  }
}

/**
 * Apply temperature, top-k and top-p, then renormalise.
 * Invalid arguments raise explicit errors so the UI can explain the failure
 * instead of silently producing NaN probabilities.
 */
export function decodeDistribution(
  logits: Vector,
  tokens: readonly string[],
  config: SamplingConfig,
): DecodingTrace {
  if (logits.length !== tokens.length) {
    throw new Error(`decodeDistribution: ${logits.length} logits for ${tokens.length} tokens`)
  }
  const { temperature, topK, topP } = config
  assertTemperature(temperature)
  if (!Number.isInteger(topK) || topK < 1) {
    throw new RangeError(`topK must be an integer ≥ 1, received ${topK}`)
  }
  if (!Number.isFinite(topP) || topP <= 0 || topP > 1) {
    throw new RangeError(`topP must be in (0, 1], received ${topP}`)
  }

  const baseProbabilities = softmax(logits)
  const temperatureProbabilities = softmax(logits, temperature)

  // Rank by the temperature-scaled probabilities, which is what decoders do.
  const order = temperatureProbabilities
    .map((p, index) => ({ p, index }))
    .sort((a, b) => b.p - a.p || a.index - b.index)

  const k = Math.min(topK, order.length)
  let pool = order.slice(0, k)

  // Smallest prefix of the ranking whose cumulative probability reaches p.
  let cumulative = 0
  const nucleus: typeof pool = []
  for (const entry of pool) {
    nucleus.push(entry)
    cumulative += entry.p
    if (cumulative >= topP) break
  }
  pool = nucleus
  if (pool.length === 0) pool = order.slice(0, 1)

  const mass = pool.reduce((s, entry) => s + entry.p, 0)
  const probabilities = new Array<number>(logits.length).fill(0)
  for (const entry of pool) probabilities[entry.index] = entry.p / mass

  const candidates: Candidate[] = pool.map((entry) => ({
    token: tokens[entry.index],
    logit: logits[entry.index],
    probability: entry.p / mass,
    index: entry.index,
  }))

  return {
    baseProbabilities,
    temperatureProbabilities,
    candidateIndices: pool.map((entry) => entry.index),
    probabilities,
    candidates,
    entropy: entropy(probabilities),
  }
}

/**
 * Draw one token from a probability vector.
 * Uses inverse transform sampling, so a seeded RNG gives a replayable sequence.
 */
export function sampleFromDistribution(probabilities: Vector, rng: Rng): number {
  const total = probabilities.reduce((s, p) => s + p, 0)
  if (!(total > 0)) throw new Error('sampleFromDistribution: probabilities sum to zero')
  let r = rng() * total
  for (let i = 0; i < probabilities.length; i++) {
    r -= probabilities[i]
    if (r <= 0) return i
  }
  // Floating-point tail: return the last non-zero entry.
  for (let i = probabilities.length - 1; i >= 0; i--) {
    if (probabilities[i] > 0) return i
  }
  throw new Error('sampleFromDistribution: no non-zero probability')
}

/** Convenience: decode a distribution and draw a token from it. */
export function sampleToken(
  logits: Vector,
  tokens: readonly string[],
  config: SamplingConfig,
  rng: Rng,
): { index: number; token: string; trace: DecodingTrace } {
  const trace = decodeDistribution(logits, tokens, config)
  const index = sampleFromDistribution(trace.probabilities, rng)
  return { index, token: tokens[index], trace }
}

export interface GenerationStep {
  step: number
  contextBefore: string[]
  token: string
  tokenIndex: number
  /** Probability the sampled token had under the final filtered distribution. */
  probability: number
  entropy: number
  /** Number of candidates retained by the filters at this step. */
  candidateCount: number
}

/**
 * Generate a short continuation with an explicit transition function.
 * `transition(context) → logits` is supplied by the caller; the lab uses a hand
 * crafted toy model, so the course never pretends a real LLM is running.
 */
export function generateSequence(
  prompt: string[],
  transition: (context: string[]) => Vector,
  tokens: readonly string[],
  config: SamplingConfig,
  maxNewTokens: number,
  rng: Rng,
  contextWindow = Number.POSITIVE_INFINITY,
): { text: string[]; steps: GenerationStep[] } {
  const sequence = [...prompt]
  const steps: GenerationStep[] = []
  for (let step = 0; step < maxNewTokens; step++) {
    const visible = Number.isFinite(contextWindow)
      ? sequence.slice(Math.max(0, sequence.length - contextWindow))
      : sequence
    const logits = transition(visible)
    const trace = decodeDistribution(logits, tokens, config)
    const index = sampleFromDistribution(trace.probabilities, rng)
    sequence.push(tokens[index])
    steps.push({
      step,
      contextBefore: [...visible],
      token: tokens[index],
      tokenIndex: index,
      probability: trace.probabilities[index],
      entropy: trace.entropy,
      candidateCount: trace.candidateIndices.length,
    })
  }
  return { text: sequence, steps }
}

/** Greedy decoding for comparison: always take the highest-probability token. */
export function greedyToken(logits: Vector): number {
  let best = 0
  for (let i = 1; i < logits.length; i++) if (logits[i] > logits[best]) best = i
  return best
}

/** Deterministic seed from a text field so learners can replay any experiment. */
export function seedFromText(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/**
 * The toy distribution used by the decoding lab. Logits are hand-chosen to look
 * like a plausible "next token after 'the model'" distribution, with a long tail
 * so that top-k and top-p have something to cut.
 */
export const TOY_LOGIT_TOKENS = [
  'learns', 'generates', 'predicts', 'reads', 'is', 'encodes', 'paints', 'sings',
  'dances', 'zorbles', 'composes', 'writes',
] as const

export const TOY_LOGITS = [4.2, 3.4, 3.0, 2.2, 1.6, 1.1, 0.4, -0.2, -0.9, -1.6, -2.4, -3.2]
