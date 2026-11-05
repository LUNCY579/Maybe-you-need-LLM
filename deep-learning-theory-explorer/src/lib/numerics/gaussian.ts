/**
 * The infinite-width effective theory of preactivations (Chapters 4-5) and of the
 * neural tangent kernel (Chapters 8-9) of
 * Roberts, Yaida & Hanin, "The Principles of Deep Learning Theory", arXiv:2106.10165.
 *
 * Everything in this module is the *theory* side: it predicts infinite-width
 * observables by iterating the kernel recursion. The *experiment* side lives in
 * `mlp.ts`, which instantiates and runs finite-width networks. Laboratories compare
 * the two; tests check both against analytic cases.
 *
 * Notation (book eqs. (5.1)-(5.5), (5.49)-(5.52), (5.80)-(5.92)):
 *   K^(l)         single-input kernel (mean squared preactivation) at layer l
 *   g(K)          E[sigma(z)^2], z ~ N(0,K)
 *   chi_parallel  C_W g'(K)     growth of parallel/magnitude perturbations
 *   chi_perp      C_W E[sigma'(z)^2]_K   growth of perpendicular/angular perturbations
 *   a_1           O(K^2) coefficient of g(K), = (3/4) gamma_2^2 + gamma_1 gamma_3
 */

import type { ActivationSpec } from './activations';
import { expectationBivariate, expectationNormalVariance, validateCovariance } from './quadrature';

/** g(K) = E[sigma(z)^2] with z ~ N(0,K) — book eq. (5.49). */
export function gOfK(act: ActivationSpec, K: number, n = 96): number {
  return expectationNormalVariance((z) => act.f(z) * act.f(z), K, n);
}

/**
 * g'(K). Two equivalent expressions from the identity (5.53):
 *   g'(K) = E[sigma(z)^2 (z^2 - K)] / (2 K^2) = E[z sigma(z) sigma'(z)] / K.
 * The second form follows from the integration-by-parts identity (5.53),
 * E[F(z)(z^2-K)] = K E[z F'(z)] (checked in the tests against F(z) = z^2).
 * At K = 0 the limit is gamma_1^2 + gamma_0 gamma_2 (used for stability screening).
 */
export function gPrimeOfK(act: ActivationSpec, K: number, n = 96): number {
  if (K <= 1e-12) {
    const g0 = act.f(0);
    return act.df(0) ** 2 + g0 * act.d2f(0);
  }
  const num = expectationNormalVariance((z) => act.f(z) * act.f(z) * (z * z - K), K, n);
  return num / (2 * K * K);
}

/** E[sigma'(z)^2], z ~ N(0,K) — the perpendicular susceptibility kernel (5.51). */
export function kernelDotOfK(act: ActivationSpec, K: number, n = 96): number {
  return expectationNormalVariance((z) => act.df(z) * act.df(z), K, n);
}

/**
 * h(K) = (1/2) d(chi_parallel)/dK = C_W E[sigma(z)^2 (z^2-K)]/(4K^2) — book eq. (5.52).
 * The K -> 0 limit is C_W (gamma_1^2 + gamma_0 gamma_2)/2, obtained by expanding
 * E[sigma^2 (z^2-K)] = 2K^2 (gamma_1^2 + gamma_0 gamma_2) + O(K^3).
 */
export function hOfK(act: ActivationSpec, K: number, Cw: number, n = 96): number {
  if (K <= 1e-12) {
    const g0 = act.f(0);
    const g1 = act.df(0);
    const g2 = act.d2f(0);
    return (Cw * (g1 * g1 + g0 * g2)) / 2;
  }
  const num = expectationNormalVariance((z) => act.f(z) * act.f(z) * (z * z - K), K, n);
  return (Cw * num) / (4 * K * K);
}

/** Parallel susceptibility chi_parallel(K) = C_W g'(K) — book eq. (5.10)/(5.50). */
export function chiParallel(act: ActivationSpec, K: number, Cw: number, n = 96): number {
  return Cw * gPrimeOfK(act, K, n);
}

/** Perpendicular susceptibility chi_perp(K) = C_W E[sigma'(z)^2]_K — book eq. (5.51). */
export function chiPerp(act: ActivationSpec, K: number, Cw: number, n = 96): number {
  return Cw * kernelDotOfK(act, K, n);
}

/**
 * The second criticality condition as a single dimensionless ratio (book eq. (5.73)):
 *   ratio(K*) = E[sigma'(z)^2]_{K*} / g'(K*)   must equal 1.
 * If K* = 0 is a root with C_b < 0 the activation cannot be tuned to criticality,
 * which is exactly the fate of the sigmoid (Section 5.3.2).
 */
export function criticalityRatio(act: ActivationSpec, K: number, n = 96): number {
  if (K <= 1e-12) {
    const g0 = act.f(0);
    const g1 = act.df(0);
    const g2 = act.d2f(0);
    return (g1 * g1) / (g1 * g1 + g0 * g2);
  }
  return kernelDotOfK(act, K, n) / gPrimeOfK(act, K, n);
}

/**
 * a_1 = (3/4) gamma_2^2 + gamma_1 gamma_3, the coefficient of K^2 in
 * g(K) = gamma_0^2 + (gamma_1^2 + gamma_0 gamma_2) K + a_1 K^2 + ...
 * Its sign decides the stability of the K = 0 fixed point: a_1 < 0 gives the benign
 * power-law decay (K = 0 class), a_1 > 0 repels the kernel (half-stable class).
 */
export function taylorA1(act: ActivationSpec): number {
  const g1 = act.df(0);
  const g2 = act.d2f(0);
  const h = 1e-4;
  const g3 = (act.d2f(h) - act.d2f(-h)) / (2 * h);
  return 0.75 * g2 * g2 + g1 * g3;
}

export interface CriticalPoint {
  /** fixed-point kernel value K* */
  Kstar: number;
  Cw: number;
  Cb: number;
  /** C_b >= 0 is required (a variance cannot be negative) */
  physical: boolean;
  /** one-line stability remark for the UI */
  note: string;
}

/**
 * Numerical realization of the algorithm in Section 5.3.1:
 *   1. scan K* >= 0 until the ratio (5.73) equals unity
 *   2. set C_W = 1/g'(K*) and C_b = K* - C_W g(K*)
 * If the only root is K* = 0 the limit is treated analytically so that numerically
 * delicate cases (tanh, sin, sigmoid) are still classified correctly.
 */
export function findCriticalPoints(
  act: ActivationSpec,
  { Kmax = 6, steps = 1201, tolerance = 1e-10 }: { Kmax?: number; steps?: number; tolerance?: number } = {},
): CriticalPoint[] {
  const pts: CriticalPoint[] = [];
  const pushPoint = (Kstar: number) => {
    const gp = gPrimeOfK(act, Kstar);
    if (!Number.isFinite(gp) || gp <= 0) return;
    const Cw = 1 / gp;
    const Cb = Kstar - Cw * gOfK(act, Kstar);
    const physical = Cb >= -1e-9;
    const a1 = taylorA1(act);
    let note: string;
    if (!physical) {
      note = 'unphysical: C_b < 0 (a bias variance cannot be negative) — no critical initialization exists';
    } else if (Kstar <= 1e-8) {
      if (a1 < 0) {
        note =
          'K = 0 universality class: C_b = 0 and the kernel decays by the power law K^(l) ~ 1/((-a_1) l)';
      } else if (Math.abs(a1) < 1e-6) {
        note =
          'the trivial fixed point K* = 0: the kernel stays at zero whatever C_W is, so this is not the critical point — look for the nonzero root';
      } else {
        note = 'half-stable: the K* = 0 fixed point is repelled (a_1 > 0); look for the nonzero root';
      }
    } else {
      note = 'nontrivial fixed point at K* > 0';
    }
    pts.push({ Kstar: Math.max(0, Kstar), Cw, Cb, physical, note });
  };

  // K* -> 0 limit handled analytically (K=0 class and the sigmoid case both live here)
  const ratio0 = criticalityRatio(act, 0);
  if (Math.abs(ratio0 - 1) < 1e-7) pushPoint(0);

  let prevK = 1e-6;
  let prevF = criticalityRatio(act, prevK) - 1;
  for (let i = 1; i <= steps; i++) {
    const K = 1e-6 + (Kmax - 1e-6) * (i / steps);
    const F = criticalityRatio(act, K) - 1;
    if (Number.isFinite(prevF) && Number.isFinite(F) && prevF * F < 0) {
      let lo = prevK;
      let hi = K;
      let flo = prevF;
      for (let it = 0; it < 200 && hi - lo > tolerance; it++) {
        const mid = 0.5 * (lo + hi);
        const fmid = criticalityRatio(act, mid) - 1;
        if (flo * fmid <= 0) {
          hi = mid;
        } else {
          lo = mid;
          flo = fmid;
        }
      }
      pushPoint(0.5 * (lo + hi));
    }
    prevK = K;
    prevF = F;
  }

  /*
   * The ratio is computed by quadrature and it oscillates numerically at large
   * K, so the same critical point is crossed many times. What the scanner
   * reports is the set of distinct critical points, not the number of times
   * the curve happens to wobble across one. When the trivial fixed point and a
   * nonzero one give the same hyperparameters — as they do for the linear
   * activation, where every K is a fixed point at C_W = 1 — the nonzero root is
   * the one reported, because it is the one a reader can act on.
   */
  const distinct: CriticalPoint[] = [];
  for (const p of pts) {
    const same = distinct.find(
      (q) =>
        Math.abs(q.Cw - p.Cw) <= 1e-6 * Math.max(1, Math.abs(p.Cw)) &&
        Math.abs(q.Cb - p.Cb) <= 1e-6 * Math.max(1, Math.abs(p.Cb)),
    );
    if (!same) distinct.push(p);
    else if (p.Kstar > same.Kstar) distinct[distinct.indexOf(same)] = p;
  }
  return distinct;
}

/** Iterate the single-input (diagonal) kernel recursion K^(l+1) = C_b + C_W g(K^(l)). */
export function kernelFlowDiagonal(
  act: ActivationSpec,
  K1: number,
  Cw: number,
  Cb: number,
  layers: number,
  n = 96,
): number[] {
  if (layers < 1) throw new Error('layers must be >= 1');
  const out = new Array<number>(layers);
  out[0] = K1;
  for (let l = 1; l < layers; l++) out[l] = Cb + Cw * gOfK(act, out[l - 1], n);
  return out;
}

/** One step of the full kernel recursion for the matrix of pairwise input kernels. */
export function kernelStep(act: ActivationSpec, K: number[][], Cw: number, Cb: number, n = 64): number[][] {
  const m = K.length;
  const next: number[][] = [];
  for (let a = 0; a < m; a++) {
    const row = new Array<number>(m).fill(0);
    for (let b = 0; b < m; b++) {
      row[b] = Cb + Cw * kernelExpectation(act, K[a][a], K[a][b], K[b][b], n);
    }
    next.push(row);
  }
  return symmetrize(next);
}

/**
 * E[sigma(u) sigma(v)] for (u,v) jointly Gaussian with covariance
 * [[K11,K12],[K12,K22]] — the two-input version of g(K), book eq. (5.1)/(5.44).
 */
export function kernelExpectation(
  act: ActivationSpec,
  K11: number,
  K12: number,
  K22: number,
  n = 96,
): number {
  validateCovariance(K11, K12, K22);
  // Guard the degenerate case K11 = 0 (unreachable for well-behaved initializations).
  if (K11 <= 1e-14) {
    const c = bivariate(act, Math.max(K11, 1e-14), K12, K22, n);
    return Number.isFinite(c) ? c : act.f(0) * act.f(0);
  }
  return bivariate(act, K11, K12, K22, n);
}

function bivariate(act: ActivationSpec, K11: number, K12: number, K22: number, n: number): number {
  return expectationBivariate((u, v) => act.f(u) * act.f(v), K11, K12, K22, n);
}

/** E[sigma'(u) sigma'(v)] — the kernel that multiplies the NTK in the recursion (9.6). */
export function kernelDotMatrix(act: ActivationSpec, K: number[][], n = 64): number[][] {
  const m = K.length;
  const out: number[][] = [];
  for (let a = 0; a < m; a++) {
    const row = new Array<number>(m).fill(0);
    for (let b = 0; b < m; b++) {
      row[b] = expectationBivariate((u, v) => act.df(u) * act.df(v), K[a][a], K[a][b], K[b][b], n);
    }
    out.push(row);
  }
  return out;
}

export interface FlowResult {
  /** K^(l) for l = 1..layers */
  kernels: number[][][];
  /** Theta^(l) for l = 1..layers, the frozen NTK recursion (9.5)-(9.7) */
  ntks: number[][][];
}

/**
 * Joint flow of the infinite-width kernel and of the frozen NTK, book eqs. (5.1)
 * and (9.5)-(9.7):
 *
 *   K^(l+1)     = C_b + C_W E[sigma(u)sigma(v)]
 *   Theta^(l+1) = C_b + C_W ( Kdot^(l) Theta^(l) + E[sigma(u)sigma(v)] )
 *   Theta^(1)   = K^(1)
 *
 * (The C_W factor multiplies both terms because Kdot here is the *unrescaled*
 * expectation E[sigma'(u)sigma'(v)].)
 */
export function kernelAndNtkFlow(
  act: ActivationSpec,
  K0: number[][],
  Cw: number,
  Cb: number,
  layers: number,
  n = 96,
): FlowResult {
  if (layers < 1) throw new Error('layers must be >= 1');
  const m = K0.length;
  let K = K0.map((row) => row.slice());
  let theta = K0.map((row) => row.slice());
  const kernels: number[][][] = [cloneMatrix(K)];
  const ntks: number[][][] = [cloneMatrix(theta)];
  for (let l = 1; l < layers; l++) {
    const kdot = kernelDotMatrix(act, K, n);
    const nextK: number[][] = [];
    const nextTheta: number[][] = [];
    for (let a = 0; a < m; a++) {
      const kr = new Array<number>(m).fill(0);
      const tr = new Array<number>(m).fill(0);
      for (let b = 0; b < m; b++) {
        const e = kernelExpectation(act, K[a][a], K[a][b], K[b][b], n);
        kr[b] = Cb + Cw * e;
        tr[b] = Cb + Cw * (kdot[a][b] * theta[a][b] + e);
      }
      nextK.push(kr);
      nextTheta.push(tr);
    }
    K = symmetrize(nextK);
    theta = symmetrize(nextTheta);
    kernels.push(cloneMatrix(K));
    ntks.push(cloneMatrix(theta));
  }
  return { kernels, ntks };
}

/**
 * Asymptotic power-law prediction for the K = 0 universality class, eq. (5.92):
 *   K^(l) ~ 1 / ( (-a_1) (l-1) + 1/K^(1) )
 * The continuous approximation dK/dl = a_1 K^2; the exact recursion differs at
 * O(K^3) and by an O(1) shift of the offset, which the UI states explicitly.
 */
export function powerLawPrediction(a1: number, K1: number, l: number): number {
  if (a1 >= 0) return Number.NaN;
  return 1 / (-a1 * (l - 1) + 1 / K1);
}

export function symmetrize(M: number[][]): number[][] {
  const m = M.length;
  const out: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row = new Array<number>(m).fill(0);
    for (let j = 0; j < m; j++) row[j] = 0.5 * (M[i][j] + M[j][i]);
    out.push(row);
  }
  return out;
}

export function cloneMatrix(M: number[][]): number[][] {
  return M.map((row) => row.slice());
}

/** Squared Frobenius distance between two matrices of equal shape. */
export function matrixDistance(A: number[][], B: number[][]): number {
  if (A.length !== B.length) throw new Error('shape mismatch');
  let s = 0;
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < A[i].length; j++) {
      const d = A[i][j] - B[i][j];
      s += d * d;
    }
  }
  return Math.sqrt(s);
}
