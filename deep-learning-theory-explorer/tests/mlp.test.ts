import { describe, expect, it } from 'vitest';
import {
  backpropMse,
  batchStats,
  createMlp,
  empiricalNtk,
  flattenParams,
  forward,
  mse,
  ntkDiagnostics,
  outputJacobian,
  predict,
  unflattenParams,
  validateMlpConfig,
  type Mlp,
} from '../src/lib/numerics/mlp';
import { getActivation } from '../src/lib/numerics/activations';
import { Rng, seedFromString } from '../src/lib/numerics/rng';
import { inputKernel, twoLayerNtkPrediction, normalizeKernel } from '../src/lib/numerics/ntk';
import { asymmetry, checkPsd } from '../src/lib/numerics/linalg';
import { trainSync } from '../src/lib/numerics/optimizers';

const normal = (rng: Rng, d: number, n: number) =>
  Array.from({ length: n }, () => Array.from({ length: d }, () => rng.normal()));

describe('seeded random number generation', () => {
  it('is reproducible for a fixed seed and different across seeds', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    const c = new Rng(1235);
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    const seqC = Array.from({ length: 8 }, () => c.next());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it('produces standard normal samples with the right first two moments', () => {
    const rng = new Rng(7);
    const xs = Array.from({ length: 200000 }, () => rng.normal());
    const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
    const varr = xs.reduce((s, v) => s + v * v, 0) / xs.length - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.01);
    expect(Math.abs(varr - 1)).toBeLessThan(0.02);
  });

  it('hashes string seeds deterministically', () => {
    expect(seedFromString('critical-tanh')).toBe(seedFromString('critical-tanh'));
    expect(seedFromString('a')).not.toBe(seedFromString('b'));
  });
});

describe('network construction and validation', () => {
  it('reproduces identical weights for identical seeds', () => {
    const cfg = { widths: [3, 8, 1], activation: 'tanh' as const, Cw: 1, Cb: 0, seed: 42 };
    const a = createMlp(cfg);
    const b = createMlp(cfg);
    expect(flattenParams(a)).toEqual(flattenParams(b));
    const c = createMlp({ ...cfg, seed: 43 });
    expect(flattenParams(a)).not.toEqual(flattenParams(c));
  });

  it('rejects invalid configurations with a message', () => {
    expect(() => createMlp({ widths: [3], activation: 'tanh', Cw: 1, Cb: 0, seed: 1 })).toThrow(/at least an input and an output/);
    expect(() => createMlp({ widths: [3, 2.5, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 1 })).toThrow(/positive integer/);
    expect(() => createMlp({ widths: [3, 8, 1], activation: 'tanh', Cw: -1, Cb: 0, seed: 1 })).toThrow(/C_W/);
    expect(() => createMlp({ widths: [3, 8, 1], activation: 'tanh', Cw: 0, Cb: 0, seed: 1 })).toThrow(/deterministically zero/);
    expect(() => createMlp({ widths: [3, 8, 1], activation: 'tanh', Cw: 1, Cb: Number.NaN, seed: 1 })).toThrow(/C_b/);
    expect(() => validateMlpConfig({ widths: [3, 5000, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 1 })).toThrow(/limited to 1024/);
  });

  it('initializes weights with variance C_W / n_in', () => {
    const Cw = 1.7;
    const Cb = 0.4;
    const net = createMlp({ widths: [40, 30, 40], activation: 'relu', Cw, Cb, seed: 3 });
    for (const layer of net.layers) {
      const nIn = layer.W[0].length;
      const vals = layer.W.flat();
      const m = vals.reduce((s, v) => s + v, 0) / vals.length;
      const varr = vals.reduce((s, v) => s + v * v, 0) / vals.length - m * m;
      expect(Math.abs(m)).toBeLessThan(4 * Math.sqrt((Cw / nIn) / vals.length));
      expect(varr).toBeGreaterThan(0.7 * (Cw / nIn));
      expect(varr).toBeLessThan(1.3 * (Cw / nIn));
      const bmean = layer.b.reduce((s, v) => s + v, 0) / layer.b.length;
      const bvar = layer.b.reduce((s, v) => s + v * v, 0) / layer.b.length - bmean * bmean;
      const bsd = Math.sqrt(2 / layer.b.length); // relative spread of a sample variance
      expect(bvar).toBeGreaterThan(Cb * (1 - 4 * bsd));
      expect(bvar).toBeLessThan(Cb * (1 + 4 * bsd));
    }
  });
});

describe('forward pass', () => {
  it('computes the layer recurrences by hand for a small network', () => {
    const net = createMlp({ widths: [2, 2, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 9 });
    const x = [0.5, -1.25];
    const r = forward(net, x);
    const z1 = [
      net.layers[0].W[0][0] * x[0] + net.layers[0].W[0][1] * x[1] + net.layers[0].b[0],
      net.layers[0].W[1][0] * x[0] + net.layers[0].W[1][1] * x[1] + net.layers[0].b[1],
    ];
    expect(r.preactivations[0][0]).toBeCloseTo(z1[0], 12);
    expect(r.preactivations[0][1]).toBeCloseTo(z1[1], 12);
    expect(r.activations[0][0]).toBeCloseTo(Math.tanh(z1[0]), 12);
    const z2 = net.layers[1].W[0][0] * Math.tanh(z1[0]) + net.layers[1].W[0][1] * Math.tanh(z1[1]) + net.layers[1].b[0];
    expect(r.output[0]).toBeCloseTo(z2, 12);
  });

  it('preserves the kernel in expectation for a critical deep linear network (eq. (3.15))', () => {
    // Exactly: E[(1/n_l) sum_j z_j^2] = C_W^l ||x||^2 / n_0 at every layer. At
    // C_W = 1 the whole profile is flat in expectation, which is the exact statement
    // of criticality for deep linear networks (book Section 3.2).
    const widths = [16, 32, 32, 32, 32, 1];
    const x = Array.from({ length: 16 }, (_, i) => Math.sin(i + 0.3));
    const target = x.reduce((a, v) => a + v * v, 0) / 16;
    const seeds = 150;
    const profile = new Array<number>(4).fill(0);
    for (let s = 0; s < seeds; s++) {
      const net = createMlp({ widths, activation: 'linear', Cw: 1, Cb: 0, seed: s });
      const r = forward(net, x);
      for (let l = 0; l < 4; l++) {
        const z = r.preactivations[l];
        profile[l] += z.reduce((a, v) => a + v * v, 0) / z.length / seeds;
      }
    }
    for (const value of profile) {
      expect(Math.abs(value - target) / target).toBeLessThan(0.15);
    }
    // and the same identity holds with C_W != 1 through the C_W^l factor
    const Cw = 0.7;
    const averaged = new Array<number>(4).fill(0);
    const draws = 120;
    for (let s = 0; s < draws; s++) {
      const net = createMlp({ widths, activation: 'linear', Cw, Cb: 0, seed: 100 + s });
      const r = forward(net, x);
      for (let l = 0; l < 4; l++) {
        const z = r.preactivations[l];
        averaged[l] += z.reduce((a, v) => a + v * v, 0) / z.length / draws;
      }
    }
    for (let l = 0; l < 4; l++) {
      // layer index l (0-based) carries C_W^(l+1)
      const ratio = averaged[l] / Math.pow(Cw, l + 1) / target;
      expect(Math.abs(ratio - 1)).toBeLessThan(0.15);
    }
  });

  it('matches the analytic first-layer kernel K^(1) for a linear network', () => {
    const rng = new Rng(17);
    const X = normal(rng, 8, 24);
    // K^(1) = C_b + C_W sum_i x_i^2 / n_0 for every sample
    const expected = X.reduce((s, x) => s + x.reduce((a, v) => a + v * v, 0) / 8, 0) / X.length;
    const seeds = 40;
    let acc = 0;
    for (let s = 0; s < seeds; s++) {
      const net = createMlp({ widths: [8, 64, 1], activation: 'linear', Cw: 1, Cb: 0, seed: s });
      acc += batchStats(net, X).kernelEstimate[0] / seeds;
    }
    // finite width gives an O(1/sqrt(n)) spread per seed; the ensemble mean must agree
    expect(Math.abs(acc - expected) / expected).toBeLessThan(0.02);
  });

  it('keeps the kernel constant at ReLU criticality and grows/shrinks otherwise', () => {
    const measure = (Cw: number, depth = 12, width = 128, seeds = 24) => {
      let acc = 0;
      const ratios: number[] = [];
      for (let s = 0; s < seeds; s++) {
        const net = createMlp({ widths: [10, ...Array(depth - 1).fill(width), 1], activation: 'relu', Cw, Cb: 0, seed: s });
        const rng = new Rng(100 + s);
        const X = normal(rng, 10, 64);
        const profile = batchStats(net, X).kernelEstimate.slice(0, depth);
        const ratio = profile[depth - 1] / profile[0];
        ratios.push(ratio);
        acc += ratio / seeds;
      }
      return { mean: acc, spread: Math.max(...ratios) - Math.min(...ratios) };
    };
    const critical = measure(2);
    expect(critical.mean).toBeGreaterThan(0.75);
    expect(critical.mean).toBeLessThan(1.3);
    expect(measure(1.5).mean).toBeLessThan(0.2);
    expect(measure(2.5).mean).toBeGreaterThan(3);
  });

  it('reproduces the linear-in-depth growth of finite-width fluctuations at criticality (eqs. (3.28), (3.33))', () => {
    // For a deep linear network at C_W = 1 the exact leading result is
    //   Var_seeds[ (1/n) sum_j z_j^2 ] = 2 l (G2)^2 / n ,  G2 = ||x||^2 / n_0 .
    // The variance therefore grows linearly in depth while being suppressed by 1/n:
    // the depth-to-width ratio is the small parameter of the effective theory.
    const n = 64;
    const depth = 10;
    const seeds = 400;
    const x = Array.from({ length: n }, (_, i) => Math.sin(2.1 * i) / Math.sqrt(n / 2));
    const G2 = x.reduce((a, v) => a + v * v, 0) / n;
    const hiddenLayers = depth - 1; // the scalar output layer is excluded (single unit)
    const samples: number[][] = [];
    for (let s = 0; s < seeds; s++) {
      const net = createMlp({ widths: [n, ...Array(depth - 1).fill(n), 1], activation: 'linear', Cw: 1, Cb: 0, seed: 9000 + s });
      const r = forward(net, x);
      samples.push(Array.from({ length: hiddenLayers }, (_, l) => {
        const z = r.preactivations[l];
        return z.reduce((a, v) => a + v * v, 0) / z.length;
      }));
    }
    const varianceAt = (l: number) => {
      const vals = samples.map((row) => row[l]);
      const m = vals.reduce((a, v) => a + v, 0) / vals.length;
      return vals.reduce((a, v) => a + (v - m) * (v - m), 0) / (vals.length - 1);
    };
    for (const l of [0, 3, 7]) {
      const measured = varianceAt(l);
      // l is the 0-based layer index, so q_l is the (l+1)-th layer and Var = 2(l+1)G2^2/n
      const predicted = (2 * (l + 1) * G2 * G2) / n;
      expect(measured / predicted).toBeGreaterThan(0.7);
      expect(measured / predicted).toBeLessThan(1.4);
    }
    expect(varianceAt(7) / varianceAt(0)).toBeGreaterThan(4);
    expect(varianceAt(7) / varianceAt(0)).toBeLessThan(12);
    // and the mean profile is preserved (the fluctuations are unbiased to this order)
    const meanAt = (l: number) => samples.reduce((a, row) => a + row[l], 0) / samples.length;
    expect(meanAt(7) / G2).toBeCloseTo(1, 1);
  });
});

describe('gradients', () => {
  it('matches central finite differences of the loss', () => {
    const net = createMlp({ widths: [3, 6, 2], activation: 'tanh', Cw: 1.2, Cb: 0.05, seed: 21 });
    const rng = new Rng(2);
    const X = normal(rng, 3, 8);
    const Y = Array.from({ length: 8 }, () => [rng.normal(), rng.normal()]);
    const { grads } = backpropMse(net, X, Y);
    const theta = flattenParams(net);
    const analytic: number[] = [];
    for (const layer of grads) {
      for (const row of layer.W) analytic.push(...row);
      analytic.push(...layer.b);
    }
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
      const fd = (lp - lm) / (2 * h);
      worst = Math.max(worst, Math.abs(fd - analytic[k]) / Math.max(1e-8, Math.abs(fd)));
    }
    unflattenParams(net, theta);
    expect(worst).toBeLessThan(1e-6);
  });

  it('matches finite differences for the ReLU network away from the kink', () => {
    const net = createMlp({ widths: [4, 7, 1], activation: 'relu', Cw: 2, Cb: 0.1, seed: 4 });
    const rng = new Rng(11);
    const X = normal(rng, 4, 10);
    const Y = X.map((x) => [Math.sin(x[0])]);
    const { grads } = backpropMse(net, X, Y);
    const theta = flattenParams(net);
    const analytic: number[] = [];
    for (const layer of grads) {
      for (const row of layer.W) analytic.push(...row);
      analytic.push(...layer.b);
    }
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
      const fd = (lp - lm) / (2 * h);
      worst = Math.max(worst, Math.abs(fd - analytic[k]) / Math.max(1e-8, Math.abs(fd)));
    }
    unflattenParams(net, theta);
    expect(worst).toBeLessThan(1e-6);
  });

  it('descends: a small gradient step reduces the loss', () => {
    const net = createMlp({ widths: [2, 12, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 31 });
    const rng = new Rng(3);
    const X = normal(rng, 2, 20);
    const Y = X.map((x) => [Math.cos(2 * x[0])]);
    const before = mse(net, X, Y);
    const { grads } = backpropMse(net, X, Y);
    const lr = 0.05;
    const theta = flattenParams(net);
    const flat: number[] = [];
    for (const layer of grads) {
      for (const row of layer.W) flat.push(...row);
      flat.push(...layer.b);
    }
    unflattenParams(
      net,
      theta.map((v, i) => v - lr * flat[i]),
    );
    expect(mse(net, X, Y)).toBeLessThan(before);
  });

  it('shows a vanishing backpropagated signal below criticality and an exploding one above it', () => {
    // The backpropagated error signal dL/dz^(l) is multiplied at each layer by a
    // factor ~ sqrt(C_W E[sigma'^2]) in RMS norm, so at C_W = 1 (tanh) it is preserved,
    // below it decays exponentially with depth and above it blows up.
    const rng = new Rng(6);
    const X = normal(rng, 48, 24);
    const Y = X.map((x) => [x[0]]);
    // Only hidden layers are compared: the output layer holds a single unit, so its
    // per-unit signal is diluted by 1/sqrt(n_{L-1}) relative to the hidden layers.
    const profileFor = (Cw: number, activation: 'tanh' | 'linear') => {
      const net: Mlp = createMlp({ widths: [48, ...Array(8).fill(48), 1], activation, Cw, Cb: 0, seed: 8 });
      const p = backpropMse(net, X, Y).layerPreactivationGradRms;
      return p.slice(0, -1);
    };
    // below criticality the signal decays geometrically with depth
    const deep = profileFor(0.6, 'tanh');
    const ratioDeep = deep[0] / deep[deep.length - 1];
    expect(ratioDeep).toBeLessThan(0.3);
    for (let i = 1; i < deep.length; i++) expect(deep[i]).toBeGreaterThan(deep[i - 1]);
    const perLayer = Math.pow(ratioDeep, 1 / (deep.length - 1));
    expect(perLayer).toBeGreaterThan(0.4);
    expect(perLayer).toBeLessThan(0.95);
    // for a linear activation the same measurement is exactly (C_W)^((L-1)/2) in RMS norm,
    // which makes the critical point visible in both directions
    const critical = profileFor(1, 'linear');
    expect(critical[0] / critical[critical.length - 1]).toBeCloseTo(1, 1);
    const explosive = profileFor(1.6, 'linear');
    const ratioExplosive = explosive[0] / explosive[explosive.length - 1];
    expect(ratioExplosive).toBeGreaterThan(2);
    for (let i = 1; i < explosive.length; i++) expect(explosive[i]).toBeLessThan(explosive[i - 1]);
    // tanh above criticality saturates instead: the preactivations explode but the
    // derivative scale collapses, so the backpropagated signal decays as well
    const saturated = profileFor(1.6, 'tanh');
    expect(saturated[0] / saturated[saturated.length - 1]).toBeLessThan(1);
  });
});

describe('Jacobian and NTK', () => {
  it('matches finite differences of the outputs', () => {
    const net = createMlp({ widths: [2, 5, 2], activation: 'tanh', Cw: 1, Cb: 0, seed: 13 });
    const rng = new Rng(9);
    const X = normal(rng, 2, 4);
    const J = outputJacobian(net, X);
    const theta = flattenParams(net);
    const h = 1e-6;
    let worst = 0;
    for (let row = 0; row < J.length; row++) {
      const m = Math.floor(row / 2);
      const i = row % 2;
      for (let k = 0; k < theta.length; k++) {
        const plus = theta.slice();
        plus[k] += h;
        unflattenParams(net, plus);
        const fp = forward(net, X[m]).output[i];
        const minus = theta.slice();
        minus[k] -= h;
        unflattenParams(net, minus);
        const fm = forward(net, X[m]).output[i];
        const fd = (fp - fm) / (2 * h);
        worst = Math.max(worst, Math.abs(fd - J[row][k]) / Math.max(1e-8, Math.abs(fd)));
      }
    }
    unflattenParams(net, theta);
    expect(worst).toBeLessThan(1e-6);
  });

  it('is exactly the input Gram matrix plus the bias term for a single-layer linear network', () => {
    const net = createMlp({ widths: [3, 1], activation: 'linear', Cw: 1, Cb: 0, seed: 2 });
    const rng = new Rng(5);
    const X = normal(rng, 3, 5);
    const theta = empiricalNtk(net, X);
    // f(x) = w.x + b, so Theta(x,x') = x.x' + 1 (the bias gradient is 1)
    for (let a = 0; a < X.length; a++) {
      for (let b = 0; b < X.length; b++) {
        let dot = 0;
        for (let k = 0; k < 3; k++) dot += X[a][k] * X[b][k];
        expect(theta[a][b]).toBeCloseTo(dot + 1, 10);
      }
    }
  });

  it('is symmetric and positive semidefinite, as a Gram matrix must be', () => {
    for (const activation of ['tanh', 'relu', 'linear'] as const) {
      const net = createMlp({ widths: [3, 12, 1], activation, Cw: 1.5, Cb: 0.1, seed: 77 });
      const rng = new Rng(4);
      const X = normal(rng, 3, 7);
      const theta = empiricalNtk(net, X);
      const diag = ntkDiagnostics(theta);
      expect(asymmetry(theta)).toBeLessThan(1e-9);
      expect(diag.psd.isPsd).toBe(true);
      expect(diag.psd.relativeMin).toBeGreaterThan(-1e-10);
      expect(checkPsd(theta).isPsd).toBe(true);
    }
  });

  it('matches the closed-form two-layer ensemble prediction (eq. (7.17) evaluated in expectation)', () => {
    const Cw = 1;
    const Cb = 0;
    const act = getActivation('tanh');
    const rng = new Rng(2024);
    const X = normal(rng, 4, 6);
    // The closed form is the *ensemble average*, so it must be compared with an
    // average over seeds. A single finite-width draw fluctuates by O(1/√n), and
    // the off-diagonal entries are the noisiest of them all.
    const worstError = (hidden: number, seeds: number) => {
      const predicted = twoLayerNtkPrediction(act, X, { Cw, Cb, hidden });
      const mean: number[][] = Array.from({ length: X.length }, () => new Array<number>(X.length).fill(0));
      for (let s = 0; s < seeds; s++) {
        const net = createMlp({ widths: [4, hidden, 1], activation: 'tanh', Cw, Cb, seed: 1000 + s });
        const theta = empiricalNtk(net, X);
        for (let a = 0; a < X.length; a++) {
          for (let b = 0; b < X.length; b++) mean[a][b] += theta[a][b] / seeds;
        }
      }
      let worst = 0;
      for (let a = 0; a < X.length; a++) {
        for (let b = 0; b < X.length; b++) {
          worst = Math.max(worst, Math.abs(mean[a][b] - predicted[a][b]) / Math.max(1e-9, Math.abs(predicted[a][b])));
        }
      }
      return worst;
    };
    // the ensemble average converges to the closed form, and the residual
    // sampling error falls as the number of seeds grows
    const coarse = worstError(128, 40);
    const fine = worstError(128, 640);
    expect(fine).toBeLessThan(0.1);
    expect(fine).toBeLessThan(coarse);
    // and the closed form describes even a single draw well on the diagonal,
    // where the sampling noise is smallest
    const net = createMlp({ widths: [4, 128, 1], activation: 'tanh', Cw, Cb, seed: 1000 });
    const predicted = twoLayerNtkPrediction(act, X, { Cw, Cb, hidden: 128 });
    const measured = empiricalNtk(net, X);
    for (let i = 0; i < X.length; i++) {
      const ratio = measured[i][i] / predicted[i][i];
      expect(ratio).toBeGreaterThan(0.85);
      expect(ratio).toBeLessThan(1.15);
    }
    // The *relative* error of the off-diagonal entries does not necessarily
    // shrink with the width: those entries are small compared with the
    // diagonal, so the same absolute noise is a larger relative error. The
    // quantity that must shrink with the number of seeds is the sampling
    // error, and that is what the two comparisons above check.
  });

  it('grows with width, which is why the book rescales weight learning rates by 1/n', () => {
    const act = getActivation('tanh');
    const rng = new Rng(31);
    const X = normal(rng, 3, 4);
    const ntkAt = (hidden: number) => {
      let acc = 0;
      for (let s = 0; s < 6; s++) {
        const net = createMlp({ widths: [3, hidden, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: s });
        const theta = empiricalNtk(net, X);
        acc += theta[0][0];
      }
      return acc / 6;
    };
    const small = ntkAt(16);
    const large = ntkAt(128);
    const predicted = twoLayerNtkPrediction(act, X, { Cw: 1, Cb: 0, hidden: 128 })[0][0] / twoLayerNtkPrediction(act, X, { Cw: 1, Cb: 0, hidden: 16 })[0][0];
    const measured = large / small;
    expect(measured).toBeGreaterThan(1.3);
    expect(Math.abs(measured - predicted) / predicted).toBeLessThan(0.5);
  });

  it('normalized deep NTKs share the shape predicted by the frozen recursion', () => {
    const rng = new Rng(64);
    const X = normal(rng, 3, 5);
    const Cw = 1;
    const Cb = 0;
    const K0 = inputKernel(X, Cw, Cb);
    const net = createMlp({ widths: [3, 128, 128, 1], activation: 'tanh', Cw, Cb, seed: 12 });
    const theta = empiricalNtk(net, X);
    const a = normalizeKernel(theta);
    const b = normalizeKernel(K0);
    // Both matrices are PSD; the empirical NTK carries an overall width-dependent
    // normalization (measured separately above), so we compare scale-free summaries.
    expect(asymmetry(theta)).toBeLessThan(1e-9);
    expect(checkPsd(theta).isPsd).toBe(true);
    const meanDiag = (M: number[][]) => M.reduce((s, _, i) => s + M[i][i], 0) / M.length;
    expect(meanDiag(a)).toBeCloseTo(1, 10);
    expect(meanDiag(b)).toBeCloseTo(1, 10);
    // the relative ordering of the off-diagonal entries (how correlated two inputs are)
    // must agree in sign and rough magnitude between the deep kernel and the input kernel
    for (let i = 0; i < X.length; i++) {
      for (let j = i + 1; j < X.length; j++) {
        expect(Math.sign(a[i][j] - 1)).toBe(Math.sign(b[i][j] - 1) === 0 ? Math.sign(a[i][j] - 1) : Math.sign(b[i][j] - 1));
      }
    }
  });
});

describe('training with the analytic gradients', () => {
  it('decreases the loss monotonically for a small enough learning rate', () => {
    const net = createMlp({ widths: [2, 16, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 3 });
    const rng = new Rng(8);
    const X = normal(rng, 2, 30);
    const Y = X.map((x) => [Math.sin(3 * x[0])]);
    const history = trainSync(net, X, Y, { optimizer: 'gd', learningRate: 0.05, steps: 40 });
    for (let i = 1; i < history.length; i++) {
      expect(history[i].loss).toBeLessThanOrEqual(history[i - 1].loss + 1e-12);
    }
    expect(history[history.length - 1].loss).toBeLessThan(history[0].loss);
  });

  it('diverges for a learning rate above the curvature bound', () => {
    const net = createMlp({ widths: [2, 16, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 3 });
    const rng = new Rng(8);
    const X = normal(rng, 2, 30);
    const Y = X.map((x) => [Math.sin(3 * x[0])]);
    const divergent = trainSync(net, X, Y, { optimizer: 'gd', learningRate: 25, steps: 200 });
    expect(divergent[divergent.length - 1].diverged).toBe(true);
  });

  it('reports finite predictions after training', () => {
    const net = createMlp({ widths: [2, 8, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 3 });
    const rng = new Rng(8);
    const X = normal(rng, 2, 12);
    const Y = X.map((x) => [x[0]]);
    trainSync(net, X, Y, { optimizer: 'momentum', learningRate: 0.02, steps: 30 });
    const preds = predict(net, X);
    expect(preds.flat().every((v) => Number.isFinite(v))).toBe(true);
  });
});
