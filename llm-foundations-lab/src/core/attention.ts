/**
 * Scaled dot-product attention, following the book's formulation
 * (Foundations of Large Language Models, Section 2.1.1 Eq. 2.6 and
 * Section 5.1.1 Eq. 5.7, Section 5.1.2 Eq. 5.13):
 *
 *   Att_qkv(Q, K, V) = Softmax( Q Kᵀ / sqrt(d) + Mask ) V
 *
 * Mask entry (i, k) is 0 when i ≥ k and −∞ when i < k, so a position can only
 * attend to itself and to earlier positions (causal / autoregressive masking).
 */
import {
  addMatrices,
  matmul,
  scaleMatrix,
  softmaxRows,
  transpose,
  type Matrix,
} from './math'

export interface Qkv {
  Q: Matrix
  K: Matrix
  V: Matrix
  /** Number of columns of K (the model dimension of one head). */
  d: number
}

/** Project hidden states H [m x d] into queries, keys and values. */
export function projectQkv(H: Matrix, Wq: Matrix, Wk: Matrix, Wv: Matrix): Qkv {
  const Q = matmul(H, Wq)
  const K = matmul(H, Wk)
  const V = matmul(H, Wv)
  return { Q, K, V, d: K[0]?.length ?? 0 }
}

/**
 * Causal mask: 0 on and below the diagonal, −Infinity above it.
 * This is the matrix form of "only previous tokens are considered".
 */
export function causalMask(m: number): Matrix {
  const mask: Matrix = []
  for (let i = 0; i < m; i++) {
    const row = new Array<number>(m).fill(0)
    for (let k = i + 1; k < m; k++) row[k] = -Infinity
    mask.push(row)
  }
  return mask
}

/**
 * Causal mask for the case where there are fewer queries than keys.
 *
 * During cached decoding a single new token is queried against a cache that
 * already holds the earlier keys, so `numKeys > numQueries`. Query row `i` then
 * corresponds to absolute position `numKeys - numQueries + i` and may attend to
 * every key at or before that position.
 */
export function causalMaskFor(numQueries: number, numKeys: number): Matrix {
  if (numQueries === numKeys) return causalMask(numQueries)
  const offset = numKeys - numQueries
  const mask: Matrix = []
  for (let i = 0; i < numQueries; i++) {
    const row = new Array<number>(numKeys).fill(0)
    const absolute = offset + i
    for (let k = absolute + 1; k < numKeys; k++) row[k] = -Infinity
    mask.push(row)
  }
  return mask
}

/** Lower-triangular boolean mask, handy for rendering. */
export function causalFlag(m: number): boolean[][] {
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: m }, (_, k) => i >= k),
  )
}

const MASK_FLOOR = -1e30

/** Replace −Infinity with a very negative finite number so arithmetic stays finite. */
function finiteMask(mask: Matrix): Matrix {
  return mask.map((row) => row.map((v) => (Number.isFinite(v) ? v : MASK_FLOOR)))
}

/** Raw attention scores before scaling: Q Kᵀ. */
export function rawScores(Q: Matrix, K: Matrix): Matrix {
  return matmul(Q, transpose(K))
}

/** Scaled scores plus optional additive mask. */
export function attentionScores(
  Q: Matrix,
  K: Matrix,
  options: { masked?: boolean; d?: number } = {},
): Matrix {
  const d = options.d ?? (K[0]?.length || 1)
  let scores = scaleMatrix(rawScores(Q, K), 1 / Math.sqrt(d))
  if (options.masked) {
    scores = addMatrices(scores, finiteMask(causalMaskFor(scores.length, K.length)))
  }
  return scores
}

export interface AttentionTrace {
  /** Scaled, masked scores (pre-softmax). */
  scores: Matrix
  /** Attention weights after softmax, one distribution per row. */
  weights: Matrix
  /** Attention output A V. */
  output: Matrix
  /** True for positions the mask removed from the row. */
  maskedOut: boolean[][]
}

/** Full forward pass of single-head scaled dot-product attention. */
export function attention(
  Q: Matrix,
  K: Matrix,
  V: Matrix,
  options: { masked?: boolean } = {},
): AttentionTrace {
  const m = Q.length
  const d = Q[0]?.length || 1
  const masked = options.masked ?? true
  const mask = masked ? causalMaskFor(m, K.length) : null
  const scores = attentionScores(Q, K, { masked, d })
  const weights = softmaxRows(scores)
  const output = matmul(weights, V)
  const maskedOut = mask
    ? mask.map((row) => row.map((v) => v === -Infinity))
    : Array.from({ length: m }, () => new Array<boolean>(K.length).fill(false))
  return { scores, weights, output, maskedOut }
}

/**
 * Verify the defining property of an attention weight matrix:
 * every row sums to 1 and every weight is non-negative.
 */
export function isRowStochastic(weights: Matrix, tolerance = 1e-9): boolean {
  return weights.every((row) => {
    const sum = row.reduce((s, v) => s + v, 0)
    return Math.abs(sum - 1) < tolerance && row.every((v) => v >= -tolerance)
  })
}

/** Concatenate per-head outputs and apply the output projection W_head. */
export function mergeHeads(heads: Matrix[], Whead: Matrix): Matrix {
  const merged: Matrix = []
  const rows = heads[0]?.length ?? 0
  for (let i = 0; i < rows; i++) {
    merged.push(heads.flatMap((head) => head[i]))
  }
  return matmul(merged, Whead)
}

/** Position of the largest attention weight in each row — "where token i looks". */
export function topAttendedIndex(weights: Matrix): number[] {
  return weights.map((row) => {
    let best = 0
    for (let i = 1; i < row.length; i++) if (row[i] > row[best]) best = i
    return best
  })
}
