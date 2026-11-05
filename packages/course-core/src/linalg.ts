/**
 * Small dense linear algebra.
 *
 * Deliberately tiny and dependency-free: a laboratory that needs an
 * eigenvalue, a Cholesky factor or a linear solve should not need a 500 kB
 * numerics library, and the whole thing has to run in a browser tab.
 */

import type { Matrix, Vector } from './math.js'
import { EPSILON, identity, matVec, transpose, zeros } from './math.js'

export interface Eigendecomposition {
  /** Eigenvalues, ascending. */
  values: number[]
  /** `vectors[i]` is the unit eigenvector for `values[i]`. */
  vectors: Vector[]
}

/**
 * Jacobi eigenvalue algorithm for a symmetric matrix.
 *
 * The classic choice for small dense problems because it is numerically
 * well-behaved and easy to audit: every step is a plane rotation.
 */
export function jacobiEigen(input: Matrix, maxSweeps = 100, tolerance = 1e-12): Eigendecomposition {
  const n = input.length
  if (n === 0) return { values: [], vectors: [] }
  const a = input.map((row) => row.slice())
  const v = identity(n)

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j]
    }
    if (off <= tolerance) break

    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) <= tolerance) continue
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q])
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c

        for (let k = 0; k < n; k++) {
          const akp = a[k][p]
          const akq = a[k][q]
          a[k][p] = c * akp - s * akq
          a[k][q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k]
          const aqk = a[q][k]
          a[p][k] = c * apk - s * aqk
          a[q][k] = s * apk + c * aqk
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p]
          const vkq = v[k][q]
          v[k][p] = c * vkp - s * vkq
          v[k][q] = s * vkp + c * vkq
        }
      }
    }
  }

  const pairs = Array.from({ length: n }, (_, i) => ({ value: a[i][i], vector: v.map((row) => row[i]) }))
  pairs.sort((x, y) => x.value - y.value)
  return { values: pairs.map((p) => p.value), vectors: pairs.map((p) => p.vector) }
}

/**
 * Largest eigenvalue and eigenvector by power iteration.
 *
 * Useful when only the top of the spectrum matters (conditioning bounds,
 * `lambda_max` in a stability analysis) and the matrix is larger than the
 * Jacobi sweep comfortably handles.
 */
export function powerIteration(
  a: Matrix,
  initial: Vector,
  iterations = 200,
  tolerance = 1e-12,
): { value: number; vector: Vector } {
  const n = a.length
  let v = initial.slice()
  let norm = Math.hypot(...v)
  if (norm <= EPSILON) {
    v = new Array<number>(n).fill(1)
    norm = Math.sqrt(n)
  }
  v = v.map((x) => x / norm)

  let value = 0
  for (let it = 0; it < iterations; it++) {
    const next = matVec(a, v)
    const nextNorm = Math.hypot(...next)
    if (nextNorm <= EPSILON) return { value: 0, vector: v }
    const scaled = next.map((x) => x / nextNorm)
    const residual = Math.hypot(...scaled.map((x, i) => x - v[i]))
    v = scaled
    value = nextNorm
    if (residual <= tolerance) break
  }
  return { value, vector: v }
}

/**
 * Cholesky decomposition of a symmetric positive-definite matrix.
 *
 * Returns the lower triangular `L` with `A = L·Lᵀ`, or `null` when the matrix
 * is not positive definite (which a laboratory should report rather than hide).
 */
export function cholesky(a: Matrix): Matrix | null {
  const n = a.length
  if (n === 0) return []
  const l = zeros(n, n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let acc = a[i][j]
      for (let k = 0; k < j; k++) acc -= l[i][k] * l[j][k]
      if (i === j) {
        if (acc <= 0) return null
        l[i][j] = Math.sqrt(acc)
      } else {
        l[i][j] = acc / l[j][j]
      }
    }
  }
  return l
}

/**
 * Solve `A·x = b` by Gaussian elimination with partial pivoting.
 *
 * Throws when the matrix is singular rather than returning infinities.
 */
export function solveLinear(a: Matrix, b: Vector): Vector {
  const n = a.length
  if (n === 0) return []
  const m = a.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    }
    if (Math.abs(m[pivot][col]) <= EPSILON) {
      throw new Error('solveLinear: matrix is singular')
    }
    if (pivot !== col) {
      const tmp = m[pivot]
      m[pivot] = m[col]
      m[col] = tmp
    }
    for (let row = col + 1; row < n; row++) {
      const factor = m[row][col] / m[col][col]
      for (let k = col; k <= n; k++) m[row][k] -= factor * m[col][k]
    }
  }

  const x = new Array<number>(n).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    let acc = m[row][n]
    for (let k = row + 1; k < n; k++) acc -= m[row][k] * x[k]
    x[row] = acc / m[row][row]
  }
  return x
}

/** Matrix inverse via Gauss–Jordan elimination. */
export function invert(a: Matrix): Matrix {
  const n = a.length
  if (n === 0) return []
  // The augmented matrix has 2n columns: A on the left, the identity on the right.
  const width = 2 * n
  const eye = identity(n)
  const aug = a.map((row, i) => [...row, ...eye[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) pivot = row
    }
    if (Math.abs(aug[pivot][col]) <= EPSILON) {
      throw new Error('invert: matrix is singular')
    }
    const tmp = aug[pivot]
    aug[pivot] = aug[col]
    aug[col] = tmp
    const diag = aug[col][col]
    for (let k = 0; k < width; k++) aug[col][k] /= diag
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      if (factor === 0) continue
      for (let k = 0; k < width; k++) aug[row][k] -= factor * aug[col][k]
    }
  }
  return aug.map((row) => row.slice(n))
}

/** Trace of a square matrix. */
export function trace(a: Matrix): number {
  let total = 0
  for (let i = 0; i < a.length; i++) total += a[i][i]
  return total
}

/** Frobenius norm of a matrix. */
export function frobeniusNorm(a: Matrix): number {
  let acc = 0
  for (const row of a) for (const v of row) acc += v * v
  return Math.sqrt(acc)
}

/** Whether a matrix is symmetric to within a tolerance. */
export function isSymmetric(a: Matrix, tolerance = 1e-9): boolean {
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      if (Math.abs(a[i][j] - a[j][i]) > tolerance) return false
    }
  }
  return true
}

/** Symmetrise a matrix, `A := (A + Aᵀ) / 2`. */
export function symmetrize(a: Matrix): Matrix {
  const t = transpose(a)
  return a.map((row, i) => row.map((v, j) => (v + t[i][j]) / 2))
}
