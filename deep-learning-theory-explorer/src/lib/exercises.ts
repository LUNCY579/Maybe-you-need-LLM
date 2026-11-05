import { getActivation, type ActivationId } from './numerics/activations';
import { findCriticalPoints, kernelFlowDiagonal, powerLawPrediction, taylorA1 } from './numerics/gaussian';
import { DEFAULT_GP, gpPosterior } from './numerics/gp';
import { symmetricEigen } from './numerics/linalg';
import { twoLayerNtkPrediction } from './numerics/ntk';
import { expectationNormal, expectationNormalVariance } from './numerics/quadrature';
import { Rng } from './numerics/rng';

/**
 * Computed exercise answers.
 *
 * Every numerical exercise in the curriculum has a *computed* answer: the value
 * is produced here by the same code the laboratories run, so the number a
 * learner is asked to reproduce is the number the app actually measures. The
 * learner may type their value and have it checked against the live
 * computation, and the method used is shown next to the verdict.
 *
 * The prose in `src/content/lessons.ts` explains the derivation; this module
 * is the authority on the value.
 */

export interface ComputedExercise {
  id: string;
  /** one line: how this number is produced */
  method: string;
  /** the live value */
  compute: () => number;
  /** the accepted absolute tolerance */
  tolerance: number;
  unit?: string;
  /** how many significant digits to show */
  digits?: number;
}

/** Format a computed value the way the exercise panel shows it. */
export function formatComputed(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const a = Math.abs(value);
  if (a >= 1e5 || a < 1e-3) return value.toExponential(Math.max(2, digits - 1));
  const d = Math.max(0, Math.min(8, digits - Math.floor(Math.log10(a)) - 1));
  return value.toFixed(d);
}

const registry: ComputedExercise[] = [
  {
    id: 'gaussian-fourth-moment',
    method: 'Wick contraction: E[z⁴] = 3K² for z ~ N(0, K), with K = 2.',
    compute: () => {
      const K = 2;
      return 3 * K * K;
    },
    tolerance: 0.001,
    digits: 6,
  },
  {
    id: 'leaky-scale-invariant-a2',
    method: 'A² = (a₊² + a₋²)/2 with a₊ = 1 and a₋ = 0.1 (book eq. (5.61)).',
    compute: () => {
      const aPlus = 1;
      const aMinus = 0.1;
      return (aPlus * aPlus + aMinus * aMinus) / 2;
    },
    tolerance: 0.0005,
    digits: 4,
  },
  {
    id: 'leaky-critical-cw',
    method: 'C_W^crit = 1/A² for the scale-invariant class (book eq. (5.67)).',
    compute: () => {
      const aPlus = 1;
      const aMinus = 0.1;
      const A2 = (aPlus * aPlus + aMinus * aMinus) / 2;
      return 1 / A2;
    },
    tolerance: 0.005,
    digits: 4,
  },
  {
    id: 'linear-critical-cw',
    method: 'C_W^crit = 1/A² with a₊ = a₋ = 1, i.e. the deep linear network (book eq. (5.67)).',
    compute: () => {
      const act = getActivation('linear');
      return 1 / act.scaleInvariantA2!;
    },
    tolerance: 0.001,
    digits: 6,
  },
  {
    id: 'relu-critical-cw',
    method: 'C_W^crit = 1/A² with a₊ = 1 and a₋ = 0, i.e. the ReLU (book eq. (5.67)).',
    compute: () => {
      const act = getActivation('relu');
      return 1 / act.scaleInvariantA2!;
    },
    tolerance: 0.001,
    digits: 6,
  },
  {
    id: 'relu-critical-cw-scanned',
    method: 'The numerical criticality scanner (book §5.3.1) applied to the ReLU, not the closed form.',
    compute: () => {
      const points = findCriticalPoints(getActivation('relu'), { Kmax: 6, steps: 900 }).filter((p) => p.physical);
      return points.length ? points[0].Cw : Number.NaN;
    },
    tolerance: 0.01,
    digits: 4,
  },
  {
    id: 'sigmoid-unphysical-cb',
    method: 'C_b = −σ(0)²/σ′(0)² at the K* = 0 root of the sigmoid (book §5.3.2).',
    compute: () => {
      const act = getActivation('sigmoid');
      const s0 = act.f(0);
      const d0 = act.df(0);
      return -(s0 * s0) / (d0 * d0);
    },
    tolerance: 0.01,
    digits: 4,
  },
  {
    id: 'linear-covariance-depth-40',
    method: 'G^(ℓ) = C_W^(ℓ−1) G^(1) for the deep linear network (book eq. (3.15), applied from layer 1).',
    compute: () => {
      const Cw = 0.9;
      const G1 = 1.5;
      const depth = 40;
      return Math.pow(Cw, depth - 1) * G1;
    },
    tolerance: 0.0005,
    digits: 5,
  },
  {
    id: 'fluctuation-sd-depth-20-width-256',
    method: 'sd[O^(ℓ)] = √(2ℓ(G⁽²⁾)²/n) at criticality (book eq. (3.33)).',
    compute: () => {
      const depth = 20;
      const width = 256;
      const G2 = 1;
      return Math.sqrt((2 * depth * G2 * G2) / width);
    },
    tolerance: 0.005,
    digits: 4,
  },
  {
    id: 'fluctuation-variance-depth-20-width-256',
    method: 'Var[O^(ℓ)] = 2ℓ(G⁽²⁾)²/n at criticality (book eq. (3.33)).',
    compute: () => {
      const depth = 20;
      const width = 256;
      const G2 = 1;
      return (2 * depth * G2 * G2) / width;
    },
    tolerance: 0.005,
    digits: 4,
  },
  {
    id: 'tanh-power-law-layer-200',
    method: 'The leading asymptotic law of book eq. (5.92): K^(ℓ) ≈ 1/((−a₁)ℓ) with a₁ = −2.',
    compute: () => {
      const act = getActivation('tanh');
      const a1 = taylorA1(act);
      return 1 / (-a1 * 200);
    },
    tolerance: 0.0002,
    digits: 6,
  },
  {
    id: 'tanh-power-law-continuous-layer-200',
    method:
      'The continuous approximation dK/dℓ = a₁K², integrated: 1/((−a₁)(ℓ−1) + 1/K^(1)) with K^(1) = 1.',
    compute: () => {
      const act = getActivation('tanh');
      const a1 = taylorA1(act);
      return powerLawPrediction(a1, 1, 200);
    },
    tolerance: 0.0002,
    digits: 6,
  },
  {
    id: 'tanh-exact-recursion-layer-200',
    method: 'The exact kernel recursion K^(ℓ+1) = C_b + C_W g(K^(ℓ)) evaluated by Gauss-Hermite quadrature.',
    compute: () => {
      const act = getActivation('tanh');
      const flow = kernelFlowDiagonal(act, 1, 1, 0, 200);
      return flow[199];
    },
    tolerance: 0.0002,
    digits: 6,
  },
  {
    id: 'quadratic-wick-kernel',
    method: 'E[z²z′²] = K₁₁K₂₂ + 2K₁₂² for jointly Gaussian (z, z′) (Wick contraction).',
    compute: () => {
      const K11 = 2;
      const K22 = 3;
      const K12 = 0.5;
      return K11 * K22 + 2 * K12 * K12;
    },
    tolerance: 0.001,
    digits: 6,
  },
  {
    id: 'ntk-trace-ratio-quadrupled-width',
    method:
      'The closed-form two-layer NTK (book eq. (7.17)) evaluated at hidden widths 128 and 512 for the same inputs; the ratio of the traces.',
    compute: () => {
      const act = getActivation('tanh');
      const rng = new Rng(2024);
      const X = Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => rng.normal()));
      const options = { Cw: 1, Cb: 0 };
      const trace = (hidden: number) => {
        const M = twoLayerNtkPrediction(act, X, { ...options, hidden });
        let s = 0;
        for (let i = 0; i < M.length; i++) s += M[i][i];
        return s;
      };
      return trace(512) / trace(128);
    },
    tolerance: 0.05,
    digits: 4,
  },
  {
    id: 'eigen-stability-threshold',
    method:
      'η_max = 2/λ_max for gradient descent on the quadratic with Hessian [[3,1],[1,3]]; λ_max comes from the Jacobi eigensolver the laboratories use.',
    compute: () => {
      const { values } = symmetricEigen([
        [3, 1],
        [1, 3],
      ]);
      return 2 / Math.max(...values);
    },
    tolerance: 0.001,
    digits: 4,
  },
  {
    id: 'connected-fourth-cumulant',
    method:
      'The connected four-point correlator G⁽⁴⁾ − 3(G⁽²⁾)² of the ReLU of a standard normal, both terms evaluated by Gauss–Hermite quadrature.',
    compute: () => {
      const fourth = expectationNormal((z) => Math.pow(Math.max(z, 0), 4));
      const second = expectationNormal((z) => Math.max(z, 0) ** 2);
      return fourth - 3 * second * second;
    },
    tolerance: 0.005,
    digits: 4,
  },
  {
    id: 'gp-single-observation-posterior-mean',
    method:
      'The RBF Gaussian-process posterior mean at x = 0.5 after one observation (x = 0, y = 1), with the default ℓ = 0.5, σ_f² = 1, σ_n² = 0.05.',
    compute: () => gpPosterior([[0]], [1], [[0.5]], DEFAULT_GP).mean[0],
    tolerance: 0.002,
    digits: 4,
  },
  {
    id: 'gauss-hermite-fourth-moment-twelve-nodes',
    method: 'E[z⁴] for z ~ N(0, 2) read off the 12-node Gauss–Hermite rule, not off the Wick contraction.',
    compute: () => expectationNormalVariance((z) => z ** 4, 2, 12),
    tolerance: 0.001,
    digits: 6,
  },
];

export const COMPUTED_EXERCISES: Record<string, ComputedExercise> = Object.fromEntries(
  registry.map((e) => [e.id, e]),
);

export function getComputedExercise(id: string): ComputedExercise | undefined {
  return COMPUTED_EXERCISES[id];
}

/** The live value of a computed exercise, or null if the key is unknown. */
export function computedValue(id: string): number | null {
  const entry = COMPUTED_EXERCISES[id];
  if (!entry) return null;
  const value = entry.compute();
  return Number.isFinite(value) ? value : null;
}

/** Convenience: the critical weight variance of an activation, from the registry. */
export function criticalCw(activation: ActivationId): number | null {
  const act = getActivation(activation);
  if (!act.scaleInvariantA2) return null;
  return 1 / act.scaleInvariantA2;
}
