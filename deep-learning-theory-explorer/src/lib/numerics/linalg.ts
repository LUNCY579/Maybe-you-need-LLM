/**
 * Small dense linear algebra used by the laboratories.
 *
 * Sizes are deliberately tiny (matrices up to a few hundred rows) because the
 * browser must stay responsive; every routine validates its inputs so that
 * experiments fail with a message instead of returning NaNs.
 */

export function zeros(n: number, m = n): number[][] {
  return Array.from({ length: n }, () => new Array<number>(m).fill(0));
}

export function identity(n: number): number[][] {
  const I = zeros(n);
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}

export function matmul(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const k = A[0]?.length ?? 0;
  const m = B[0]?.length ?? 0;
  if (B.length !== k) throw new Error(`matmul shape mismatch: (${n}x${k}) * (${B.length}x${m})`);
  const out = zeros(n, m);
  for (let i = 0; i < n; i++) {
    for (let p = 0; p < k; p++) {
      const a = A[i][p];
      if (a === 0) continue;
      for (let j = 0; j < m; j++) out[i][j] += a * B[p][j];
    }
  }
  return out;
}

export function transpose(A: number[][]): number[][] {
  const n = A.length;
  const m = A[0]?.length ?? 0;
  const out = zeros(m, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) out[j][i] = A[i][j];
  return out;
}

export function matVec(A: number[][], x: number[]): number[] {
  if (A[0] && x.length !== A[0].length) throw new Error('matVec shape mismatch');
  return A.map((row) => {
    let s = 0;
    for (let j = 0; j < x.length; j++) s += row[j] * x[j];
    return s;
  });
}

export function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('dot length mismatch');
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

/** Gram matrix A A^T */
export function gram(A: number[][]): number[][] {
  return matmul(A, transpose(A));
}

export interface Eigen {
  values: number[];
  /** columns are eigenvectors: vectors[j] is the j-th eigenvector */
  vectors: number[][];
}

/**
 * Cyclic Jacobi eigenvalue algorithm for real symmetric matrices.
 * Deterministic, no dependencies, accurate to machine precision for the small
 * matrices used here (NTK matrices, Gram matrices).
 */
export function symmetricEigen(A: number[][], { maxSweeps = 100, tol = 1e-12 } = {}): Eigen {
  const n = A.length;
  if (n === 0) return { values: [], vectors: [] };
  for (const row of A) if (row.length !== n) throw new Error('symmetricEigen requires a square matrix');
  const a = A.map((row) => row.slice());
  const v = identity(n);
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    if (Math.sqrt(2 * off) < tol) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const values = a.map((row, i) => row[i]);
  const order = values.map((_, i) => i).sort((i, j) => values[j] - values[i]);
  return {
    values: order.map((i) => values[i]),
    vectors: order.map((i) => v.map((row) => row[i])),
  };
}

export function eigenvalues(A: number[][]): number[] {
  return symmetricEigen(A).values;
}

/** Largest eigenvalue by power iteration (fallback for large matrices). */
export function largestEigenvalue(A: number[][], iterations = 500): number {
  const n = A.length;
  let x = new Array<number>(n).fill(1 / Math.sqrt(Math.max(1, n)));
  let lambda = 0;
  for (let it = 0; it < iterations; it++) {
    const y = matVec(A, x);
    const ny = norm(y);
    if (ny < 1e-300) return 0;
    x = y.map((v) => v / ny);
    lambda = ny;
  }
  return lambda;
}

export interface PsdReport {
  isPsd: boolean;
  minEigenvalue: number;
  maxEigenvalue: number;
  /** smallest eigenvalue relative to the largest (scale-free measure) */
  relativeMin: number;
  tolerance: number;
}

/**
 * Positive-semidefiniteness check used for NTK matrices: an NTK is a Gram
 * matrix of gradients, so it must be PSD up to numerical error.
 */
export function checkPsd(A: number[][], tolerance = 1e-8): PsdReport {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (Math.abs(A[i][j] - A[j][i]) > 1e-10 * Math.max(1, Math.abs(A[i][j]))) {
        throw new Error('checkPsd expects a symmetric matrix');
      }
    }
  }
  const { values } = symmetricEigen(A);
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;
  const scale = Math.max(1e-12, Math.abs(max));
  const relativeMin = min / scale;
  return {
    isPsd: relativeMin >= -tolerance,
    minEigenvalue: min,
    maxEigenvalue: max,
    relativeMin,
    tolerance,
  };
}

export function maxAbsDiff(A: number[][], B: number[][]): number {
  if (A.length !== B.length) throw new Error('shape mismatch');
  let m = 0;
  for (let i = 0; i < A.length; i++) {
    if (A[i].length !== B[i].length) throw new Error('shape mismatch');
    for (let j = 0; j < A[i].length; j++) m = Math.max(m, Math.abs(A[i][j] - B[i][j]));
  }
  return m;
}

/**
 * Solve A x = b for a dense square system, by Gaussian elimination with partial
 * pivoting.
 *
 * The matrix is destroyed. The system is rejected if it is singular to working
 * precision, rather than returning a silently wrong answer.
 */
export function solveLinear(A: number[][], b: number[]): number[] {
  const n = A.length;
  if (n === 0) return [];
  if (b.length !== n) throw new Error(`right-hand side has length ${b.length}, expected ${n}`);
  const M = A.map((row, i) => {
    if (row.length !== n) throw new Error(`row ${i} has length ${row.length}, expected ${n}`);
    return row.slice();
  });
  const x = b.slice();

  for (let col = 0; col < n; col++) {
    // partial pivoting: find the row with the largest entry in this column
    let pivot = col;
    let best = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > best) {
        best = v;
        pivot = r;
      }
    }
    if (best < 1e-14) throw new Error('the system is singular to working precision');
    if (pivot !== col) {
      const t = M[pivot];
      M[pivot] = M[col];
      M[col] = t;
      const tv = x[pivot];
      x[pivot] = x[col];
      x[col] = tv;
    }
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / M[col][col];
      if (factor === 0) continue;
      for (let c = col; c < n; c++) M[r][c] -= factor * M[col][c];
      x[r] -= factor * x[col];
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = x[r];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

/** symmetry defect of a matrix, max |A - A^T| */
export function asymmetry(A: number[][]): number {
  return maxAbsDiff(A, transpose(A));
}
