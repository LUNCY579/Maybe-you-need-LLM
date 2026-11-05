/**
 * Neural tangent kernel theory (Chapters 7-9).
 *
 * Two objects live here:
 *
 * 1. `twoLayerNtkPrediction` — an exact *ensemble-average* formula for the NTK of
 *    a network with one hidden layer and a linear read-out, derived term by term
 *    from the definition (7.17) with the initialization (4.2):
 *
 *      Theta(x,x') = sum_theta df/dtheta df/dtheta'
 *                  -> C_W * Kdot^{(1)}(x,x') * (x.x' + 1)
 *                     + n_1 * g(K^{(1)}(x,x'))
 *                     + 1                                  (the output bias)
 *
 *    where K^{(1)} = C_b + C_W (x.x')/n_0, Kdot = E[sigma'(u)sigma'(v)] and
 *    g = E[sigma(u)sigma(v)] are bivariate Gaussian expectations at K^{(1)}.
 *    The formula is validated against the empirical NTK in the test suite.
 *
 * 2. `frozenNtkRecursion` — the recursive frozen NTK of the effective theory,
 *    book eqs. (9.5)-(9.7):
 *
 *      Theta^{(l+1)} = K^{(l+1)} + chi_perp^{(l+1)} Theta^{(l)} ,  Theta^{(1)} = K^{(1)}
 *
 *    This is the width-normalized object: in eqs. (8.6)-(8.7) the book explains that
 *    the learning-rate tensor must scale the weight part of each layer by 1/n_{l-1},
 *    which is exactly what makes the NTK finite at infinite width. The raw sum over
 *    parameters of eq. (7.17) instead carries an overall factor of the layer width;
 *    Laboratory D measures that factor and states the convention explicitly rather
 *    than hiding it.
 */

import type { ActivationSpec } from './activations';
import { chiPerp, cloneMatrix, kernelExpectation, symmetrize } from './gaussian';
import { expectationBivariate } from './quadrature';

export interface TwoLayerNtkOptions {
  Cw: number;
  Cb: number;
  hidden: number;
  nodes?: number;
}

/**
 * Ensemble-average NTK of a 2-layer network (one hidden layer, linear read-out)
 * as a function of the input Gram matrix. Exact in the infinite-width limit.
 */
export function twoLayerNtkPrediction(
  act: ActivationSpec,
  X: number[][],
  { Cw, Cb, hidden, nodes = 64 }: TwoLayerNtkOptions,
): number[][] {
  const n0 = X[0].length;
  const M = X.length;
  const out: number[][] = [];
  for (let a = 0; a < M; a++) {
    const row = new Array<number>(M).fill(0);
    for (let b = 0; b < M; b++) {
      let dot = 0;
      for (let k = 0; k < n0; k++) dot += X[a][k] * X[b][k];
      const K11 = Cb + Cw * (dotOf(X[a], X[a]) / n0);
      const K22 = Cb + Cw * (dotOf(X[b], X[b]) / n0);
      const K12 = Cb + Cw * (dot / n0);
      const g = kernelExpectation(act, K11, K12, K22, nodes);
      const kdot = expectationBivariate((u, v) => act.df(u) * act.df(v), K11, K12, K22, nodes);
      row[b] = Cw * kdot * (dot + 1) + hidden * g + 1;
    }
    out.push(row);
  }
  return out;
}

function dotOf(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Frozen NTK recursion of the effective theory, eqs. (9.5)-(9.7), for the whole
 * matrix of pairwise input kernels.
 *   Theta^{(l+1)} = K^{(l+1)} + chi_perp^{(l+1)} Theta^{(l)}
 * Note that chi_perp is evaluated at the *diagonal* kernel value of each input pair,
 * which is the single-input approximation used in the book's leading-order analysis.
 */
export function frozenNtkRecursion(
  act: ActivationSpec,
  K0: number[][],
  Cw: number,
  Cb: number,
  layers: number,
  nodes = 64,
): number[][][] {
  if (layers < 1) throw new Error('layers must be >= 1');
  const M = K0.length;
  let K = cloneMatrix(K0);
  let theta = cloneMatrix(K0);
  const out: number[][][] = [cloneMatrix(theta)];
  for (let l = 1; l < layers; l++) {
    const nextK: number[][] = [];
    const nextTheta: number[][] = [];
    for (let a = 0; a < M; a++) {
      const kr = new Array<number>(M).fill(0);
      const tr = new Array<number>(M).fill(0);
      for (let b = 0; b < M; b++) {
        const e = kernelExpectation(act, K[a][a], K[a][b], K[b][b], nodes);
        kr[b] = Cb + Cw * e;
        // chi_perp^{(l+1)} = C_W E[sigma'^2] evaluated at the midpoint diagonal kernel
        const chi = chiPerp(act, 0.5 * (K[a][a] + K[b][b]), Cw, 96);
        tr[b] = kr[b] + chi * theta[a][b];
      }
      nextK.push(kr);
      nextTheta.push(tr);
    }
    K = symmetrize(nextK);
    theta = symmetrize(nextTheta);
    out.push(cloneMatrix(theta));
  }
  return out;
}

/** Divide a kernel matrix by the mean of its diagonal (a scale-free comparison). */
export function normalizeKernel(M: number[][]): number[][] {
  const d = M.length;
  let s = 0;
  for (let i = 0; i < d; i++) s += M[i][i];
  const scale = d > 0 ? s / d : 1;
  if (!(scale > 0)) return M.map((row) => row.slice());
  return M.map((row) => row.map((v) => v / scale));
}

export function relativeFrobenius(A: number[][], B: number[][]): number {
  if (A.length !== B.length || A[0].length !== B[0].length) throw new Error('shape mismatch');
  let num = 0;
  let den = 0;
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < A[i].length; j++) {
      num += (A[i][j] - B[i][j]) ** 2;
      den += B[i][j] ** 2;
    }
  }
  return den > 0 ? Math.sqrt(num / den) : Number.NaN;
}

/** Empirical input kernel of a batch: K_{ab} = C_b + C_W (x_a . x_b)/n_0 (eq. (5.2)). */
export function inputKernel(X: number[][], Cw: number, Cb: number): number[][] {
  const n0 = X[0].length;
  return X.map((xa) =>
    X.map((xb) => {
      let dot = 0;
      for (let k = 0; k < n0; k++) dot += xa[k] * xb[k];
      return Cb + (Cw * dot) / n0;
    }),
  );
}
