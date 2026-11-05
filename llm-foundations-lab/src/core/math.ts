/**
 * Deterministic numerical helpers used by every laboratory in the course.
 *
 * Everything here is plain TypeScript so the algorithms can be unit-tested without
 * a DOM and reused by any visualization. The course never fakes a computation:
 * every number rendered in the UI is produced by one of these functions.
 */

/** A dense matrix stored as an array of rows. */
export type Matrix = number[][]

/** A dense vector. */
export type Vector = number[]

/** Smallest positive number used when guarding logarithms. */
export const EPSILON = 1e-12

/** A seeded pseudo-random generator: identical seeds always replay identical sequences. */
export type Rng = () => number

/**
 * mulberry32 — small, fast, deterministic 32-bit PRNG.
 * Used for sampling, parameter initialisation and toy dataset generation so that
 * "random" parts of an experiment are reproducible for teaching purposes.
 */
export function createRng(seed: number): Rng {
  let a = Math.trunc(seed) >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal sample via the Box–Muller transform. */
export function gaussian(rng: Rng): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function zeros(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => new Array<number>(cols).fill(0))
}

export function zerosVector(length: number): Vector {
  return new Array<number>(length).fill(0)
}

/** Matrix product. Throws when the shapes are incompatible instead of returning garbage. */
export function matmul(a: Matrix, b: Matrix): Matrix {
  const n = a.length
  // An empty left operand has no rows to inspect, so its width is unknown.
  // The product is empty by definition; there is nothing to validate.
  if (n === 0) return []
  const k = a[0]?.length ?? 0
  const k2 = b.length
  const m = b[0]?.length ?? 0
  if (k !== k2) {
    throw new Error(`matmul: incompatible shapes (${n}x${k}) x (${k2}x${m})`)
  }
  const out = zeros(n, m)
  for (let i = 0; i < n; i++) {
    for (let p = 0; p < k; p++) {
      const av = a[i][p]
      if (av === 0) continue
      for (let j = 0; j < m; j++) {
        out[i][j] += av * b[p][j]
      }
    }
  }
  return out
}

export function transpose(a: Matrix): Matrix {
  const rows = a.length
  const cols = a[0]?.length ?? 0
  const out = zeros(cols, rows)
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) out[j][i] = a[i][j]
  }
  return out
}

export function scaleMatrix(a: Matrix, factor: number): Matrix {
  return a.map((row) => row.map((v) => v * factor))
}

export function addMatrices(a: Matrix, b: Matrix): Matrix {
  return a.map((row, i) => row.map((v, j) => v + b[i][j]))
}

export function addVectors(a: Vector, b: Vector): Vector {
  return a.map((v, i) => v + b[i])
}

export function scaleVector(a: Vector, factor: number): Vector {
  return a.map((v) => v * factor)
}

export function dot(a: Vector, b: Vector): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

/** Numerically stable softmax over a vector. `temperature` must be finite and positive. */
export function softmax(logits: Vector, temperature = 1): Vector {
  if (!Number.isFinite(temperature) || temperature <= 0) {
    throw new RangeError(`softmax: temperature must be a positive finite number, received ${temperature}`)
  }
  if (logits.length === 0) return []
  const scaled = logits.map((v) => v / temperature)
  const max = Math.max(...scaled)
  const exps = scaled.map((v) => Math.exp(v - max))
  const total = exps.reduce((s, v) => s + v, 0)
  if (total <= 0 || !Number.isFinite(total)) {
    throw new Error('softmax: non-finite normalizer')
  }
  return exps.map((v) => v / total)
}

/** Row-wise softmax — this is exactly the operation applied to attention scores. */
export function softmaxRows(scores: Matrix, temperature = 1): Matrix {
  return scores.map((row) => softmax(row, temperature))
}

export function logSoftmax(logits: Vector, temperature = 1): Vector {
  const probs = softmax(logits, temperature)
  return probs.map((p) => Math.log(Math.max(p, EPSILON)))
}

export function argmax(values: Vector): number {
  let best = 0
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[best]) best = i
  }
  return best
}

export function mean(values: Vector): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Shannon entropy in nats. Used to summarise how diverse a token distribution is. */
export function entropy(probs: Vector): number {
  let h = 0
  for (const p of probs) {
    if (p > 0) h -= p * Math.log(p)
  }
  return h
}

/**
 * The GELU activation, in its exact form.
 *
 * GELU is the activation a Transformer feed-forward network usually uses: it
 * passes positive inputs through almost unchanged and suppresses negative ones,
 * which is why it appears in place of a ReLU.
 */
export function gelu(x: number): number {
  return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)))
}

/**
 * Layer normalisation over the feature axis of each row.
 *
 * Each row is centred and scaled to unit variance, then re-scaled by a learned
 * gain and shifted by a learned bias. The point of the operation is that the
 * *scale* of a row stops depending on how large its inputs happened to be.
 */
export function layerNorm(matrix: Matrix, gamma: number[], beta: number[], eps = 1e-5): Matrix {
  return matrix.map((row) => {
    const mean = row.reduce((sum, value) => sum + value, 0) / Math.max(1, row.length)
    const variance =
      row.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / Math.max(1, row.length)
    const inverse = 1 / Math.sqrt(variance + eps)
    return row.map((value, index) => (value - mean) * inverse * (gamma[index] ?? 1) + (beta[index] ?? 0))
  })
}

/** Add two matrices elementwise, the residual connection. */
export function addMatricesElementwise(a: Matrix, b: Matrix): Matrix {
  return a.map((row, i) => row.map((value, j) => value + (b[i]?.[j] ?? 0)))
}

/**
 * Numerically stable logistic sigmoid.
 * Central to preference modelling: Pr(a ≻ b) = sigmoid(r(a) − r(b)).
 */
export function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x)
    return 1 / (1 + z)
  }
  const z = Math.exp(x)
  return z / (1 + z)
}

/** softplus(x) = log(1 + e^x), computed without overflow. */
export function softplus(x: number): number {
  if (x > 30) return x
  if (x < -30) return Math.exp(x)
  return Math.log1p(Math.exp(x))
}

/** Cross-entropy H(p, q) with an explicit guard for zero probabilities. */
export function crossEntropy(target: Vector, predicted: Vector): number {
  let loss = 0
  for (let i = 0; i < target.length; i++) {
    if (target[i] === 0) continue
    loss -= target[i] * Math.log(Math.max(predicted[i], EPSILON))
  }
  return loss
}

export function l2Norm(values: Vector): number {
  return Math.sqrt(values.reduce((s, v) => s + v * v, 0))
}

/** Formatting helper shared by figures so that numbers read consistently. */
export function fmt(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return String(value)
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs < 0.001 || abs >= 100000) return value.toExponential(2)
  return value.toFixed(digits)
}
