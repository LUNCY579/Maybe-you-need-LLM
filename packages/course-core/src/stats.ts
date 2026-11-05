/**
 * Statistical machinery used across the courses.
 *
 * Everything here is a real estimator with a stated assumption, not a
 * heuristic. A lesson that says "this difference is not significant" means
 * a specific test was run on the numbers the learner can see.
 */

import { createRng, correlation, mean, normalQuantile, stdDev, sum, variance } from './math.js'
import type { Vector } from './math.js'

export interface RegressionResult {
  /** Intercept, then one coefficient per predictor. */
  coefficients: number[]
  /** R² of the fit. */
  r2: number
  /** Residuals (observed − predicted), in input order. */
  residuals: number[]
  /** Predicted values, in input order. */
  predictions: number[]
  /** Standard error of the residual estimate. */
  residualStdError: number
  /** Number of observations. */
  n: number
}

/**
 * Ordinary least squares with an intercept.
 *
 * Solved through the normal equations with a ridge term of `ridge * I` on the
 * slopes only, which keeps the system solvable for rank-deficient designs
 * without moving the intercept.
 */
export function ols(design: Vector[], response: Vector, ridge = 0): RegressionResult {
  const n = design.length
  if (n === 0) throw new Error('ols: no observations')
  if (design.length !== response.length) {
    throw new Error('ols: design and response lengths differ')
  }
  const p = design[0].length
  const xs = design.map((row) => [1, ...row])

  const xtx: number[][] = Array.from({ length: p + 1 }, () => new Array<number>(p + 1).fill(0))
  const xty: number[] = new Array<number>(p + 1).fill(0)
  for (let i = 0; i < n; i++) {
    for (let a = 0; a <= p; a++) {
      xty[a] += xs[i][a] * response[i]
      for (let b = 0; b <= p; b++) xtx[a][b] += xs[i][a] * xs[i][b]
    }
  }
  for (let a = 1; a <= p; a++) xtx[a][a] += ridge

  // Gauss–Jordan elimination with partial pivoting.
  // The system is (p + 1) equations in (p + 1) unknowns: the unknown vector
  // occupies columns 0..p and the right-hand side sits in column p + 1.
  const rhs = p + 1
  const m = xtx.map((row, i) => [...row, xty[i]])
  for (let col = 0; col <= p; col++) {
    let pivot = col
    for (let row = col + 1; row <= p; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    }
    if (pivot !== col) {
      const tmp = m[pivot]
      m[pivot] = m[col]
      m[col] = tmp
    }
    const diag = m[col][col]
    if (Math.abs(diag) < 1e-12) {
      // A singular design cannot be solved; leave this coefficient at zero.
      continue
    }
    for (let k = col; k <= rhs; k++) m[col][k] /= diag
    for (let row = 0; row <= p; row++) {
      if (row === col) continue
      const factor = m[row][col]
      if (factor === 0) continue
      for (let k = col; k <= rhs; k++) m[row][k] -= factor * m[col][k]
    }
  }
  const coefficients = m.map((row) => row[rhs])

  const predictions = xs.map((row) => row.reduce((acc, v, idx) => acc + v * coefficients[idx], 0))
  const residuals = response.map((y, i) => y - predictions[i])
  const meanY = mean(response)
  const ssTot = sum(response.map((y) => (y - meanY) ** 2))
  const ssRes = sum(residuals.map((r) => r * r))
  const r2 = ssTot <= 0 ? 0 : 1 - ssRes / ssTot
  const residualStdError = n > p + 1 ? Math.sqrt(ssRes / (n - p - 1)) : 0

  return { coefficients, r2, residuals, predictions, residualStdError, n }
}

/**
 * Fit `log y = a + b·log x` — the form a power law takes.
 *
 * Returns the exponent `b`, the coefficient `exp(a)`, and the R² of the fit in
 * log space, which is the number that actually tells you whether the power law
 * describes the data.
 */
export function powerLawFit(xs: number[], ys: number[]): {
  exponent: number
  coefficient: number
  intercept: number
  r2: number
  n: number
} {
  const usable: Vector[] = []
  const logsY: Vector = []
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] > 0 && ys[i] > 0) {
      usable.push([Math.log(xs[i])])
      logsY.push(Math.log(ys[i]))
    }
  }
  if (usable.length < 2) {
    throw new Error('powerLawFit: need at least two positive points')
  }
  const fit = ols(usable, logsY)
  return {
    exponent: fit.coefficients[1],
    coefficient: Math.exp(fit.coefficients[0]),
    intercept: fit.coefficients[0],
    r2: fit.r2,
    n: usable.length,
  }
}

/** A bootstrap confidence interval for an arbitrary statistic. */
export function bootstrapCI(
  values: Vector,
  statistic: (sample: Vector) => number,
  resamples = 2000,
  seed = 12345,
  alpha = 0.05,
): { low: number; high: number; point: number; resamples: number } {
  if (values.length === 0) throw new Error('bootstrapCI: no values')
  const rng = createRng(seed)
  const point = statistic(values)
  const stats: number[] = []
  for (let r = 0; r < resamples; r++) {
    const sample = new Array<number>(values.length)
    for (let i = 0; i < values.length; i++) {
      sample[i] = values[Math.floor(rng() * values.length)]
    }
    stats.push(statistic(sample))
  }
  stats.sort((a, b) => a - b)
  const lo = Math.floor((alpha / 2) * (resamples - 1))
  const hi = Math.ceil((1 - alpha / 2) * (resamples - 1))
  return { low: stats[lo], high: stats[hi], point, resamples }
}

/**
 * Two-sided permutation test on the difference in means.
 *
 * Exact enough for teaching: the null distribution is generated by shuffling
 * the group labels, and the p-value is the fraction of shuffles at least as
 * extreme as the observed gap.
 */
export function permutationTest(
  a: Vector,
  b: Vector,
  resamples = 10000,
  seed = 4242,
): { observedDifference: number; pValue: number; resamples: number } {
  const observedDifference = mean(a) - mean(b)
  const pooled = [...a, ...b]
  const nA = a.length
  const rng = createRng(seed)
  let atLeastAsExtreme = 0
  for (let r = 0; r < resamples; r++) {
    const shuffled = pooled.slice()
    for (let i = pooled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = shuffled[i]
      shuffled[i] = shuffled[j]
      shuffled[j] = tmp
    }
    const diff = mean(shuffled.slice(0, nA)) - mean(shuffled.slice(nA))
    if (Math.abs(diff) >= Math.abs(observedDifference) - 1e-15) atLeastAsExtreme++
  }
  return {
    observedDifference,
    pValue: (atLeastAsExtreme + 1) / (resamples + 1),
    resamples,
  }
}

/** Welch's two-sample t statistic. */
export function welchT(a: Vector, b: Vector): number {
  const va = variance(a) / a.length
  const vb = variance(b) / b.length
  const denom = Math.sqrt(va + vb)
  if (denom <= 0) return 0
  return (mean(a) - mean(b)) / denom
}

/** Cohen's d, with the pooled standard deviation. */
export function cohensD(a: Vector, b: Vector): number {
  const pooled = Math.sqrt(
    ((a.length - 1) * variance(a) + (b.length - 1) * variance(b)) /
      Math.max(1, a.length + b.length - 2),
  )
  if (pooled <= 0) return 0
  return (mean(a) - mean(b)) / pooled
}

/** A two-sided 95% confidence interval for a mean, using the normal approximation. */
export function meanCI95(values: Vector): { low: number; high: number; mean: number } {
  const m = mean(values)
  if (values.length < 2) return { low: m, high: m, mean: m }
  const se = stdDev(values) / Math.sqrt(values.length)
  const z = normalQuantile(0.975)
  return { low: m - z * se, high: m + z * se, mean: m }
}

/** Benjamini–Hochberg step-up procedure for controlling the false discovery rate. */
export function benjaminiHochberg(pValues: number[]): { rejected: boolean[]; threshold: number } {
  const m = pValues.length
  const order = pValues.map((p, i) => ({ p, i })).sort((x, y) => x.p - y.p)
  const rejected = new Array<boolean>(m).fill(false)
  let threshold = 0
  let maxIndex = -1
  for (let k = 0; k < m; k++) {
    const adjusted = (order[k].p * m) / (k + 1)
    if (adjusted <= 0.05) {
      maxIndex = k
      threshold = order[k].p
    }
  }
  for (let k = 0; k <= maxIndex; k++) rejected[order[k].i] = true
  return { rejected, threshold }
}

/** Bonferroni-corrected per-test threshold for a family of `m` tests. */
export function bonferroniThreshold(m: number, familyAlpha = 0.05): number {
  return familyAlpha / Math.max(1, m)
}

/**
 * Sample size needed to detect a given effect size with a given power,
 * using the normal approximation to the two-sample test.
 */
export function requiredSampleSize(effectSize: number, alpha = 0.05, power = 0.8): number {
  if (effectSize <= 0) throw new RangeError('requiredSampleSize: effectSize must be positive')
  const zAlpha = normalQuantile(1 - alpha / 2)
  const zBeta = normalQuantile(power)
  return Math.ceil(((zAlpha + zBeta) ** 2 * 2) / effectSize ** 2)
}

/** Pearson correlation of two vectors — re-exported so callers need one import. */
export { correlation }
