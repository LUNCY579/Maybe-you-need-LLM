/**
 * Embeddings, positional information and the deterministic projection matrices
 * used by the Transformer Explorer.
 *
 * The Explorer explains a *simplified* calculation on a tiny example. Real models
 * learn embeddings and projections from data; here they are generated from a fixed
 * seed so that every learner sees exactly the same numbers and can verify them by
 * hand. The UI labels this clearly wherever the numbers are shown.
 */
import { createRng, gaussian, type Matrix, type Vector } from './math'

export const DEFAULT_DIM = 8

/** A stable numeric fingerprint for a string (FNV-1a). */
export function hashString(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * Toy token embedding: a deterministic, unit-normalised pseudo-random vector.
 * The only property we need pedagogically is that identical tokens get identical
 * vectors and different tokens get different ones.
 */
export function toyEmbedding(token: string, dim = DEFAULT_DIM): Vector {
  const rng = createRng(hashString(`embed:${token}`))
  const vector = Array.from({ length: dim }, () => gaussian(rng))
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1
  const scaled = vector.map((v) => v / norm)
  // Keep the displayed numbers round enough to reason about.
  return scaled.map((v) => Math.round(v * 1000) / 1000)
}

/**
 * Sinusoidal positional encoding from "Attention Is All You Need" (as summarised
 * in the book's discussion of positional information):
 *
 *   PE(pos, 2i)   = sin(pos / 10000^(2i/d))
 *   PE(pos, 2i+1) = cos(pos / 10000^(2i/d))
 */
export function positionalEncoding(position: number, dim = DEFAULT_DIM): Vector {
  const vector = new Array<number>(dim).fill(0)
  for (let i = 0; i < Math.floor(dim / 2); i++) {
    const freq = 1 / Math.pow(10000, (2 * i) / dim)
    vector[2 * i] = Math.round(Math.sin(position * freq) * 1000) / 1000
    if (2 * i + 1 < dim) {
      vector[2 * i + 1] = Math.round(Math.cos(position * freq) * 1000) / 1000
    }
  }
  return vector
}

/** Embedding + positional encoding, the input a Transformer block receives. */
export function addPositional(embedding: Vector, position: number): Vector {
  const pe = positionalEncoding(position, embedding.length)
  return embedding.map((v, i) => Math.round((v + pe[i]) * 1000) / 1000)
}

/** Deterministic projection matrix with entries ~ N(0, 1/sqrt(fanIn)). */
export function seededProjection(rows: number, cols: number, seed: string): Matrix {
  const rng = createRng(hashString(seed))
  const std = 1 / Math.sqrt(cols)
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => Math.round(gaussian(rng) * std * 1000) / 1000),
  )
}

export interface ToyModelConfig {
  /** Embedding / hidden dimension. */
  dim: number
  /** Seed prefix; changing it changes every matrix and therefore every number. */
  seed: string
}

export const DEFAULT_TOY_CONFIG: ToyModelConfig = { dim: DEFAULT_DIM, seed: 'llm-lab-v1' }

export interface ToyParameters {
  /** Embedding dimension. */
  dim: number
  Wq: Matrix
  Wk: Matrix
  Wv: Matrix
  /** Final projection to vocabulary-size logits. */
  Wo: Matrix
  /** Feed-forward network: the first projection, its bias, the second and its bias. */
  W1: Matrix
  b1: Vector
  W2: Matrix
  b2: Vector
  /** Layer-normalisation gains and shifts, one per dimension. */
  gamma1: Vector
  beta1: Vector
  gamma2: Vector
  beta2: Vector
}

export function buildToyParameters(
  vocabSizeForOutput: number,
  config: ToyModelConfig = DEFAULT_TOY_CONFIG,
): ToyParameters {
  const { dim, seed } = config
  // The feed-forward network is wider than the model, as it is in a real
  // Transformer: four times the hidden size.
  const hidden = dim * 4
  return {
    dim,
    Wq: seededProjection(dim, dim, `${seed}:Wq`),
    Wk: seededProjection(dim, dim, `${seed}:Wk`),
    Wv: seededProjection(dim, dim, `${seed}:Wv`),
    Wo: seededProjection(dim, vocabSizeForOutput, `${seed}:Wo`),
    W1: seededProjection(dim, hidden, `${seed}:W1`),
    b1: seededProjection(1, hidden, `${seed}:b1`)[0],
    W2: seededProjection(hidden, dim, `${seed}:W2`),
    b2: seededProjection(1, dim, `${seed}:b2`)[0],
    gamma1: new Array<number>(dim).fill(1),
    beta1: new Array<number>(dim).fill(0),
    gamma2: new Array<number>(dim).fill(1),
    beta2: new Array<number>(dim).fill(0),
  }
}
