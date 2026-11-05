/**
 * Deterministic numerical primitives.
 *
 * Every laboratory in this collection renders numbers that were produced by a
 * function in this file (or a sibling). Nothing is hard-coded, nothing is
 * pre-baked, and every random draw comes from a seeded stream so a lesson can
 * be replayed exactly.
 *
 * The module is deliberately free of DOM and framework code: it is plain
 * TypeScript so it can be unit-tested in Node and reused by any renderer.
 */

/** A dense matrix stored as an array of rows. */
export type Matrix = number[][]

/** A dense vector. */
export type Vector = number[]

/** Smallest positive number used when guarding logarithms and divisions. */
export const EPSILON = 1e-12

/** A seeded pseudo-random generator: identical seeds always replay identical sequences. */
export type Rng = () => number

/**
 * mulberry32 — small, fast, deterministic 32-bit PRNG.
 *
 * Chosen because its whole state is one 32-bit integer, so a lesson can state
 * "seed 41, draw 1000 samples" and a learner will get the same numbers on
 * every machine and every browser.
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

/** Uniform sample in [low, high). */
export function uniform(rng: Rng, low = 0, high = 1): number {
  return low + (high - low) * rng()
}

/** A uniform integer in [0, n). */
export function randInt(rng: Rng, n: number): number {
  if (n <= 0) return 0
  return Math.min(n - 1, Math.floor(rng() * n))
}

/* ------------------------------------------------------------------ vectors */

export function zerosVector(length: number): Vector {
  return new Array<number>(length).fill(0)
}

export function onesVector(length: number): Vector {
  return new Array<number>(length).fill(1)
}

export function addVectors(a: Vector, b: Vector): Vector {
  if (a.length !== b.length) {
    throw new Error(`addVectors: length mismatch (${a.length} vs ${b.length})`)
  }
  return a.map((v, i) => v + b[i])
}

export function subtractVectors(a: Vector, b: Vector): Vector {
  if (a.length !== b.length) {
    throw new Error(`subtractVectors: length mismatch (${a.length} vs ${b.length})`)
  }
  return a.map((v, i) => v - b[i])
}

export function scaleVector(a: Vector, factor: number): Vector {
  return a.map((v) => v * factor)
}

export function dot(a: Vector, b: Vector): number {
  if (a.length !== b.length) {
    throw new Error(`dot: length mismatch (${a.length} vs ${b.length})`)
  }
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

/** Euclidean norm. */
export function l2Norm(values: Vector): number {
  return Math.sqrt(values.reduce((s, v) => s + v * v, 0))
}

/** Euclidean distance between two vectors. */
export function l2Distance(a: Vector, b: Vector): number {
  if (a.length !== b.length) {
    throw new Error(`l2Distance: length mismatch (${a.length} vs ${b.length})`)
  }
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

/** Element-wise product (Hadamard). */
export function hadamard(a: Vector, b: Vector): Vector {
  if (a.length !== b.length) {
    throw new Error(`hadamard: length mismatch (${a.length} vs ${b.length})`)
  }
  return a.map((v, i) => v * b[i])
}

/* ------------------------------------------------------------------ matrices */

export function zeros(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => new Array<number>(cols).fill(0))
}

export function identity(n: number): Matrix {
  const out = zeros(n, n)
  for (let i = 0; i < n; i++) out[i][i] = 1
  return out
}

/** Matrix product. Throws on incompatible shapes rather than returning garbage. */
export function matmul(a: Matrix, b: Matrix): Matrix {
  const n = a.length
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

/** Matrix–vector product. `a` is `m×n`, `v` has length `n`, result has length `m`. */
export function matVec(a: Matrix, v: Vector): Vector {
  const m = a.length
  if (m === 0) return []
  const n = a[0]?.length ?? 0
  if (n !== v.length) {
    throw new Error(`matVec: incompatible shapes (${m}x${n}) · (${v.length})`)
  }
  const out = new Array<number>(m).fill(0)
  for (let i = 0; i < m; i++) {
    let acc = 0
    const row = a[i]
    for (let j = 0; j < n; j++) acc += row[j] * v[j]
    out[i] = acc
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

export function subtractMatrices(a: Matrix, b: Matrix): Matrix {
  return a.map((row, i) => row.map((v, j) => v - b[i][j]))
}

/** Outer product of two vectors. */
export function outer(a: Vector, b: Vector): Matrix {
  return a.map((v) => b.map((w) => v * w))
}

/* ---------------------------------------------------------------- statistics */

export function sum(values: Vector): number {
  let total = 0
  for (const v of values) total += v
  return total
}

export function mean(values: Vector): number {
  if (values.length === 0) return 0
  return sum(values) / values.length
}

/** Sample variance (Bessel-corrected). */
export function variance(values: Vector): number {
  if (values.length < 2) return 0
  const m = mean(values)
  let acc = 0
  for (const v of values) acc += (v - m) ** 2
  return acc / (values.length - 1)
}

export function stdDev(values: Vector): number {
  return Math.sqrt(variance(values))
}

/** Population covariance. */
export function covariance(a: Vector, b: Vector): number {
  if (a.length !== b.length) {
    throw new Error(`covariance: length mismatch (${a.length} vs ${b.length})`)
  }
  if (a.length < 2) return 0
  const ma = mean(a)
  const mb = mean(b)
  let acc = 0
  for (let i = 0; i < a.length; i++) acc += (a[i] - ma) * (b[i] - mb)
  return acc / (a.length - 1)
}

/** Pearson correlation coefficient. */
export function correlation(a: Vector, b: Vector): number {
  const denom = stdDev(a) * stdDev(b)
  if (denom <= EPSILON) return 0
  return covariance(a, b) / denom
}

/** Linear interpolation over evenly spaced points from 0 to 1. */
export function linspace(count: number, from = 0, to = 1): Vector {
  if (count <= 0) return []
  if (count === 1) return [from]
  const step = (to - from) / (count - 1)
  return Array.from({ length: count }, (_, i) => from + step * i)
}

/* --------------------------------------------------------------- probability */

/** Numerically stable softmax over a vector. */
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

/** Row-wise softmax — the operation applied to attention scores. */
export function softmaxRows(scores: Matrix, temperature = 1): Matrix {
  return scores.map((row) => softmax(row, temperature))
}

export function logSoftmax(logits: Vector, temperature = 1): Vector {
  const probs = softmax(logits, temperature)
  return probs.map((p) => Math.log(Math.max(p, EPSILON)))
}

/** log(sum(exp(x))) computed without overflow. */
export function logSumExp(values: Vector): number {
  if (values.length === 0) return -Infinity
  const max = Math.max(...values)
  if (!Number.isFinite(max)) return max
  return max + Math.log(values.reduce((s, v) => s + Math.exp(v - max), 0))
}

/** Numerically stable logistic sigmoid. */
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

/** Shannon entropy in nats. */
export function entropy(probs: Vector): number {
  let h = 0
  for (const p of probs) {
    if (p > 0) h -= p * Math.log(p)
  }
  return h
}

/** Cross-entropy H(p, q) with a guard for zero probabilities. */
export function crossEntropy(target: Vector, predicted: Vector): number {
  if (target.length !== predicted.length) {
    throw new Error(`crossEntropy: length mismatch (${target.length} vs ${predicted.length})`)
  }
  let loss = 0
  for (let i = 0; i < target.length; i++) {
    if (target[i] === 0) continue
    loss -= target[i] * Math.log(Math.max(predicted[i], EPSILON))
  }
  return loss
}

/**
 * The complementary error function for a non-negative argument.
 *
 * Uses the classical continued fraction
 *
 *   erfc(x) = e^{-x²}/√π · 1/(x + a₁/(x + a₂/(x + a₃/(x + …)))),  aₙ = n/2
 *
 * evaluated with Lentz's method, which converges to machine precision for
 * x ≥ 0.5. The naive polynomial approximations that are usually pasted into a
 * learning application are only good to about 1e-7, and a p-value computed
 * from a 1e-7 CDF is a p-value nobody can trust.
 */
function erfcPositive(x: number): number {
  const tiny = 1e-300
  let f = x
  let c = f
  let d = 0
  for (let n = 1; n <= 400; n++) {
    const a = n / 2
    d = x + a * d
    if (Math.abs(d) < tiny) d = tiny
    c = x + a / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const delta = c * d
    f *= delta
    if (Math.abs(delta - 1) < 1e-16) break
  }
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f
}

/**
 * The error function.
 *
 * For small arguments the Maclaurin series is used; for larger ones the
 * continued fraction for `erfc`. Together they give roughly machine precision
 * over the whole real line.
 */
export function erf(x: number): number {
  if (Number.isNaN(x)) return NaN
  const ax = Math.abs(x)
  if (ax < 0.5) {
    // erf(x) = (2/√π) Σ (-1)ⁿ x^(2n+1) / (n! (2n+1))
    const z = ax * ax
    let term = ax
    let sum = ax
    for (let n = 1; n < 60; n++) {
      term *= -z / n
      sum += term / (2 * n + 1)
    }
    return ((2 / Math.sqrt(Math.PI)) * sum) * Math.sign(x)
  }
  const value = 1 - erfcPositive(ax)
  return x < 0 ? -value : value
}

/** The complementary error function, `1 − erf(x)`. */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN
  if (x >= 0) return erfcPositive(x)
  return 2 - erfcPositive(-x)
}

/** Standard normal CDF. */
export function normalCdf(x: number, mu = 0, sigma = 1): number {
  if (sigma <= 0) throw new RangeError('normalCdf: sigma must be positive')
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)))
}

/** Standard normal PDF. */
export function normalPdf(x: number, mu = 0, sigma = 1): number {
  if (sigma <= 0) throw new RangeError('normalPdf: sigma must be positive')
  const z = (x - mu) / sigma
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI))
}

/** Two-sided p-value for a standard normal statistic. */
export function normalTwoSidedP(z: number): number {
  return Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))))
}

/** Quantile function of the standard normal (Acklam's rational approximation). */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const pLow = 0.02425
  let q: number
  let r: number
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p <= 1 - pLow) {
    q = p - 0.5
    r = q * q
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    )
  }
  q = Math.sqrt(-2 * Math.log(1 - p))
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
}

/* ------------------------------------------------------------------ helpers */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Consistent number formatting for figures.
 *
 * Small and very large magnitudes switch to exponential notation so that a
 * figure never shows a column of zeros.
 */
export function fmt(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return String(value)
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs < 0.001 || abs >= 100000) return value.toExponential(2)
  return value.toFixed(digits)
}

/** Percentage formatting with a fixed number of decimals. */
export function fmtPct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`
}

/** Round to a given number of decimal places, avoiding -0. */
export function round(value: number, digits = 3): number {
  const factor = 10 ** digits
  const rounded = Math.round(value * factor) / factor
  return Object.is(rounded, -0) ? 0 : rounded
}
