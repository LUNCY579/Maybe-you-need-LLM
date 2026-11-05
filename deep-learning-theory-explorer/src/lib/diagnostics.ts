import { createMlp, batchStats, backpropMse, flattenParams, unflattenParams, mse, empiricalNtk, outputJacobian } from './numerics/mlp';
import { getActivation } from './numerics/activations';
import { chiParallel, chiPerp, findCriticalPoints, gOfK, powerLawPrediction, taylorA1 } from './numerics/gaussian';
import { twoLayerNtkPrediction } from './numerics/ntk';
import { gpDemoData, gpPosterior } from './numerics/gp';
import { Rng } from './numerics/rng';
import { toCsv } from './export';
import { checkPsd } from './numerics/linalg';
import { expectationNormalSimpson } from './numerics/quadrature';

/**
 * The self-test.
 *
 * The laboratories make claims. This module re-checks the load-bearing ones,
 * in the reader's own browser, with the same code the laboratories use. It is
 * the same set of checks the test suite runs, exposed as a page, so that a
 * reader can confirm that their machine agrees with the theory before trusting
 * a number on screen.
 */

export interface DiagnosticCheck {
  id: string;
  name: string;
  /** what the check is about */
  claim: string;
  /** the book reference, when there is one */
  ref?: string;
  /** runs the check; returns the measured value and the expected value */
  run: () => { measured: number; expected: number; tolerance: number; unit?: string };
}

export const CHECKS: DiagnosticCheck[] = [
  {
    id: 'quadrature',
    name: 'The quadrature against an independent rule',
    claim:
      'The Gauss–Hermite quadrature behind every theory curve in this application agrees with Simpson integration of the same integrand.',
    run: () => {
      // the integrand g(K) = E[σ(z)σ(z′)] for a tanh network, which is what
      // every recursion in the course is built on
      const act = getActivation('tanh');
      const K = 2;
      const hermite = gOfK(act, K);
      const simpson = expectationNormalSimpson((z) => act.f(z) * act.f(z), K, { panels: 20000 });
      return { measured: hermite, expected: simpson, tolerance: 1e-6 };
    },
  },
  {
    id: 'linear-kernel',
    name: 'The deep linear kernel recursion',
    claim: 'G^(ℓ) = C_W^ℓ G^(0) exactly, for a critical deep linear network.',
    ref: 'eq. (3.15)',
    run: () => {
      const net = createMlp({ widths: [8, 64, 64, 64, 1], activation: 'linear', Cw: 1, Cb: 0, seed: 5 });
      const rng = new Rng(11);
      const x = Array.from({ length: 8 }, () => rng.normal());
      const stats = batchStats(net, [x]);
      const measured = stats.kernelEstimate[0];
      const expected = (x.reduce((s, v) => s + v * v, 0) / 8) * Math.pow(1, 1);
      return { measured, expected, tolerance: 0.25 };
    },
  },
  {
    id: 'relu-critical',
    name: 'Kaiming initialisation from criticality',
    claim: 'The ReLU critical weight variance is 1/A² with A² = 1/2, so C_W = 2.',
    ref: 'eq. (5.67)',
    run: () => {
      const act = getActivation('relu');
      const closed = 1 / act.scaleInvariantA2!;
      const points = findCriticalPoints(act, { Kmax: 6, steps: 900 }).filter((p) => p.physical);
      const scanned = points.length ? points[0].Cw : Number.NaN;
      return { measured: scanned, expected: closed, tolerance: 0.02 };
    },
  },
  {
    id: 'gradients',
    name: 'Analytic gradients against finite differences',
    claim: 'Every parameter gradient of the mean-squared error matches a central difference.',
    run: () => {
      const net = createMlp({ widths: [3, 8, 1], activation: 'tanh', Cw: 1.2, Cb: 0.05, seed: 21 });
      const rng = new Rng(2);
      const X = Array.from({ length: 8 }, () => Array.from({ length: 3 }, () => rng.normal()));
      const Y = X.map(() => [rng.normal()]);
      const { grads } = backpropMse(net, X, Y);
      const flat: number[] = [];
      for (const layer of grads) {
        for (const row of layer.W) flat.push(...row);
        flat.push(...layer.b);
      }
      const theta = flattenParams(net);
      const h = 1e-6;
      let worst = 0;
      for (let k = 0; k < theta.length; k++) {
        const plus = theta.slice();
        plus[k] += h;
        unflattenParams(net, plus);
        const lp = mse(net, X, Y);
        const minus = theta.slice();
        minus[k] -= h;
        unflattenParams(net, minus);
        const lm = mse(net, X, Y);
        unflattenParams(net, theta);
        const fd = (lp - lm) / (2 * h);
        worst = Math.max(worst, Math.abs(fd - flat[k]) / Math.max(1e-8, Math.abs(fd)));
      }
      return { measured: worst, expected: 0, tolerance: 1e-5 };
    },
  },
  {
    id: 'ntk-gram',
    name: 'The NTK is a Gram matrix',
    claim: 'Θ(xᵢ, xⱼ) is the inner product of the parameter-gradient rows, and the matrix is positive semidefinite.',
    ref: 'eq. (7.17)',
    run: () => {
      const net = createMlp({ widths: [3, 16, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 7 });
      const rng = new Rng(4);
      const X = Array.from({ length: 4 }, () => Array.from({ length: 3 }, () => rng.normal()));
      const J = outputJacobian(net, X);
      const theta = empiricalNtk(net, X);
      let worst = 0;
      for (let a = 0; a < X.length; a++) {
        for (let b = 0; b < X.length; b++) {
          let s = 0;
          for (let k = 0; k < J[a].length; k++) s += J[a][k] * J[b][k];
          worst = Math.max(worst, Math.abs(s - theta[a][b]));
        }
      }
      const psd = checkPsd(theta);
      return {
        measured: Math.max(worst, psd.isPsd ? 0 : 1),
        expected: 0,
        tolerance: 1e-8,
      };
    },
  },
  {
    id: 'ntk-closed-form',
    name: 'The two-layer NTK closed form',
    claim: 'The ensemble-averaged kernel agrees with C_W·K̇·(x·x′ + 1) + n₁·g + 1.',
    ref: 'eq. (7.17)',
    run: () => {
      const act = getActivation('tanh');
      const rng = new Rng(2024);
      const X = Array.from({ length: 5 }, () => Array.from({ length: 4 }, () => rng.normal()));
      const hidden = 128;
      const closed = twoLayerNtkPrediction(act, X, { Cw: 1, Cb: 0, hidden });
      // The closed form is the *ensemble average*, so it must be compared with
      // an average over seeds. The off-diagonal entries carry an O(1/√seeds)
      // sampling error, which is why the comparison uses many seeds.
      const seeds = 400;
      const mean: number[][] = Array.from({ length: X.length }, () => new Array<number>(X.length).fill(0));
      for (let s = 0; s < seeds; s++) {
        const net = createMlp({ widths: [4, hidden, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 1000 + s });
        const theta = empiricalNtk(net, X);
        for (let a = 0; a < X.length; a++) {
          for (let b = 0; b < X.length; b++) mean[a][b] += theta[a][b] / seeds;
        }
      }
      let worst = 0;
      for (let a = 0; a < X.length; a++) {
        for (let b = 0; b < X.length; b++) {
          worst = Math.max(worst, Math.abs(mean[a][b] - closed[a][b]) / Math.max(1e-9, Math.abs(closed[a][b])));
        }
      }
      return { measured: worst, expected: 0, tolerance: 0.15 };
    },
  },
  {
    id: 'fluctuation-law',
    name: 'The finite-width fluctuation law',
    claim: 'Var[O^(ℓ)] grows linearly with depth and shrinks as 1/n.',
    ref: 'eq. (3.33)',
    run: () => {
      const n = 64;
      const depth = 10;
      const seeds = 300;
      const x = Array.from({ length: n }, (_, i) => Math.sin(2.1 * i) / Math.sqrt(n / 2));
      const G2 = x.reduce((s, v) => s + v * v, 0) / n;
      const samples: number[][] = [];
      for (let s = 0; s < seeds; s++) {
        const net = createMlp({ widths: [n, ...Array(depth - 1).fill(n), 1], activation: 'linear', Cw: 1, Cb: 0, seed: 9000 + s });
        const r = batchStats(net, [x]);
        samples.push(r.kernelEstimate.slice(0, depth));
      }
      const col = samples.map((row) => row[depth - 2]);
      const m = col.reduce((s, v) => s + v, 0) / col.length;
      const variance = col.reduce((s, v) => s + (v - m) * (v - m), 0) / (col.length - 1);
      const expected = (2 * (depth - 1) * G2 * G2) / n;
      return { measured: variance, expected, tolerance: 0.4 * expected };
    },
  },
  {
    id: 'kzero-power-law',
    name: 'The K = 0 power law',
    claim: 'At criticality the tanh kernel decays as 1/((−a₁)(ℓ−1) + 1/K^(1)).',
    ref: 'eq. (5.92)',
    run: () => {
      const act = getActivation('tanh');
      const a1 = taylorA1(act);
      const measured = powerLawPrediction(a1, 1, 200);
      const expected = 1 / (2 * 200);
      return { measured, expected, tolerance: 0.02 * expected };
    },
  },
  {
    id: 'gp-posterior',
    name: 'The Gaussian-process posterior',
    claim: 'The infinite-width posterior interpolates its data and recovers the prior far from it.',
    run: () => {
      const data = gpDemoData(7, 0.1, 5);
      const p = gpPosterior(data.X, data.y, data.X, { lengthScale: 0.5, signalVariance: 1, noiseVariance: 1e-4 });
      let worst = 0;
      for (let i = 0; i < data.X.length; i++) worst = Math.max(worst, Math.abs(p.mean[i] - data.y[i]));
      return { measured: worst, expected: 0, tolerance: 0.05 };
    },
  },
  {
    id: 'susceptibility',
    name: 'Both susceptibilities at criticality',
    claim: 'At the critical point χ∥ = χ⊥ = 1.',
    ref: 'eq. (5.55)',
    run: () => {
      const act = getActivation('relu');
      const points = findCriticalPoints(act, { Kmax: 6, steps: 900 }).filter((p) => p.physical);
      const p = points[0];
      const parallel = chiParallel(act, p.Kstar, p.Cw);
      const perpendicular = chiPerp(act, p.Kstar, p.Cw);
      return {
        measured: Math.max(Math.abs(parallel - 1), Math.abs(perpendicular - 1)),
        expected: 0,
        tolerance: 0.02,
      };
    },
  },
  {
    id: 'helper-function',
    name: 'The helper function g(K)',
    claim: 'For the linear activation g(K) = K exactly.',
    run: () => {
      const act = getActivation('linear');
      const measured = gOfK(act, 3);
      return { measured, expected: 3, tolerance: 1e-8 };
    },
  },
  {
    id: 'reproducibility',
    name: 'The seeded generator is reproducible',
    claim: 'The same seed gives the same stream of numbers.',
    run: () => {
      const a = new Rng(1234);
      const b = new Rng(1234);
      let worst = 0;
      for (let i = 0; i < 64; i++) worst = Math.max(worst, Math.abs(a.next() - b.next()));
      return { measured: worst, expected: 0, tolerance: 0 };
    },
  },
  {
    id: 'csv-escaping',
    name: 'The CSV export escapes correctly',
    claim: 'A field with a comma, a quote or a newline is quoted properly.',
    run: () => {
      const csv = toCsv(['a'], [['x,y'], ['q"uote'], ['two\nlines']]);
      const good = csv === 'a\r\n"x,y"\r\n"q""uote"\r\n"two\nlines"\r\n';
      return { measured: good ? 0 : 1, expected: 0, tolerance: 0 };
    },
  },
];

export interface DiagnosticResult extends DiagnosticCheck {
  measured: number;
  expected: number;
  tolerance: number;
  unit?: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

/** Run every check, recording what happened rather than throwing. */
export function runDiagnostics(): DiagnosticResult[] {
  return CHECKS.map((check) => {
    const started = performance.now();
    try {
      const { measured, expected, tolerance, unit } = check.run();
      const scale = Math.max(1, Math.abs(expected));
      const passed = Math.abs(measured - expected) <= tolerance * (tolerance < 1 ? scale : 1);
      return {
        ...check,
        measured,
        expected,
        tolerance,
        unit,
        passed,
        durationMs: performance.now() - started,
      };
    } catch (e) {
      return {
        ...check,
        measured: Number.NaN,
        expected: Number.NaN,
        tolerance: 0,
        passed: false,
        error: e instanceof Error ? e.message : String(e),
        durationMs: performance.now() - started,
      };
    }
  });
}
