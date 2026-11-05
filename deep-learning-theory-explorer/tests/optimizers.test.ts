import { describe, expect, it } from 'vitest';
import { optimizerStep, trainSync, OPTIMIZERS, type OptimizerId } from '../src/lib/numerics/optimizers';
import { backpropMse, cloneMlp, createMlp, flattenParams, mse, unflattenParams, type Mlp } from '../src/lib/numerics/mlp';
import { Rng } from '../src/lib/numerics/rng';

function fixture(): { net: Mlp; X: number[][]; Y: number[][] } {
  const net = createMlp({ widths: [2, 6, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 5 });
  const rng = new Rng(3);
  const X = Array.from({ length: 12 }, () => [rng.normal(), rng.normal()]);
  const Y = X.map((x) => [Math.sin(2 * x[0])]);
  return { net, X, Y };
}

describe('optimizer update rules', () => {
  it('gradient descent applies exactly theta <- theta - eta * grad', () => {
    const { net, X, Y } = fixture();
    const before = flattenParams(net);
    const { grads } = backpropMse(net, X, Y);
    const flat: number[] = [];
    for (const layer of grads) {
      for (const row of layer.W) flat.push(...row);
      flat.push(...layer.b);
    }
    const eta = 0.01;
    const history = trainSync(net, X, Y, { optimizer: 'gd', learningRate: eta, steps: 1 });
    const after = history[1].params;
    for (let i = 0; i < before.length; i++) {
      expect(after[i]).toBeCloseTo(before[i] - eta * flat[i], 12);
    }
  });

  it('heavy-ball momentum accumulates velocity as v <- mu v - eta g', () => {
    const { net, X, Y } = fixture();
    const mu = 0.9;
    const eta = 0.05;
    const state = { velocity: new Array(net.parameterCount).fill(0), m: [], v: [], t: 0 };
    const before = flattenParams(net);
    const { grads } = backpropMse(net, X, Y);
    const flat: number[] = [];
    for (const layer of grads) {
      for (const row of layer.W) flat.push(...row);
      flat.push(...layer.b);
    }
    optimizerStep(net, X, Y, { optimizer: 'momentum', learningRate: eta, mu }, state);
    const after = flattenParams(net);
    for (let i = 0; i < before.length; i++) {
      expect(after[i]).toBeCloseTo(before[i] - eta * flat[i], 12); // v_1 = -eta g
    }
    // second step: v_2 = mu v_1 - eta g_2, and the gradient has changed
    const before2 = flattenParams(net);
    const { grads: g2 } = backpropMse(net, X, Y);
    const flat2: number[] = [];
    for (const layer of g2) {
      for (const row of layer.W) flat2.push(...row);
      flat2.push(...layer.b);
    }
    optimizerStep(net, X, Y, { optimizer: 'momentum', learningRate: eta, mu }, state);
    const after2 = flattenParams(net);
    for (let i = 0; i < before2.length; i++) {
      const v1 = -eta * flat[i];
      const v2 = mu * v1 - eta * flat2[i];
      expect(after2[i]).toBeCloseTo(before2[i] + v2, 12);
    }
  });

  it('Adam follows the documented update rule with bias correction', () => {
    const { net, X, Y } = fixture();
    const eta = 0.01;
    const beta1 = 0.9;
    const beta2 = 0.999;
    const eps = 1e-8;
    const before = flattenParams(net);
    const { grads } = backpropMse(net, X, Y);
    const flat: number[] = [];
    for (const layer of grads) {
      for (const row of layer.W) flat.push(...row);
      flat.push(...layer.b);
    }
    const history = trainSync(net, X, Y, { optimizer: 'adam', learningRate: eta, steps: 1 });
    const after = history[1].params;
    // first step: mhat = g, vhat = g^2, so the update is eta * g/(|g| + eps)
    for (let i = 0; i < before.length; i++) {
      const g = flat[i];
      const expected = before[i] - eta * (g / (Math.sqrt(g * g) + eps));
      expect(after[i]).toBeCloseTo(expected, 10);
    }
    // the step size is set by eta, not by the gradient magnitude, up to the epsilon
    const moving = flat.map((g, i) => (Math.abs(g) > 1e-6 ? Math.abs(after[i] - before[i]) : 0)).filter((d) => d > 0);
    expect(moving.length).toBeGreaterThan(0);
    for (const delta of moving) {
      expect(delta).toBeLessThan(eta * 1.5);
      expect(delta).toBeGreaterThan(eta * 0.5);
    }
    void beta1;
    void beta2;
  });

  it('all three optimizers are registered with documentation', () => {
    for (const id of ['gd', 'momentum', 'adam'] as OptimizerId[]) {
      const spec = OPTIMIZERS[id];
      expect(spec).toBeDefined();
      expect(spec.note.length).toBeGreaterThan(40);
      expect(spec.latex).toContain('\\');
    }
  });
});

describe('gradient descent stability', () => {
  it('descends monotonically below the curvature bound', () => {
    const { net, X, Y } = fixture();
    const history = trainSync(net, X, Y, { optimizer: 'gd', learningRate: 0.01, steps: 60 });
    for (let i = 1; i < history.length; i++) {
      expect(history[i].loss).toBeLessThanOrEqual(history[i - 1].loss + 1e-12);
    }
    expect(history[history.length - 1].loss).toBeLessThan(history[0].loss);
  });

  it('diverges and stops early above the curvature bound', () => {
    const { net, X, Y } = fixture();
    const history = trainSync(net, X, Y, { optimizer: 'gd', learningRate: 5000, steps: 500 });
    expect(history[history.length - 1].diverged).toBe(true);
    // it must not have run the full 500 steps: the loop breaks on divergence
    expect(history.length).toBeLessThan(500);
  });

  it('is reproducible: the same seed and settings give the same history', () => {
    const a = fixture();
    const b = fixture();
    const ha = trainSync(a.net, a.X, a.Y, { optimizer: 'momentum', learningRate: 0.02, steps: 20 });
    const hb = trainSync(b.net, b.X, b.Y, { optimizer: 'momentum', learningRate: 0.02, steps: 20 });
    expect(ha.map((h) => h.loss)).toEqual(hb.map((h) => h.loss));
  });

  it('rejects nonsense options instead of silently misbehaving', () => {
    const { net, X, Y } = fixture();
    expect(() => trainSync(net, X, Y, { optimizer: 'gd', learningRate: 0.01, steps: -3 })).toThrow();
    expect(() => trainSync(net, X, Y, { optimizer: 'gd', learningRate: 0.01, steps: 1.5 })).toThrow();
  });
});

describe('training leaves the network in a consistent state', () => {
  it('the recorded parameters match the network and the loss is the real loss', () => {
    const { net, X, Y } = fixture();
    const history = trainSync(net, X, Y, { optimizer: 'gd', learningRate: 0.02, steps: 5 });
    const final = history[history.length - 1];
    unflattenParams(net, final.params);
    expect(mse(net, X, Y)).toBeCloseTo(final.loss, 12);
  });

  it('cloning a network gives an independent copy', () => {
    const { net } = fixture();
    const copy = cloneMlp(net);
    copy.layers[0].W[0][0] += 1;
    expect(net.layers[0].W[0][0]).not.toBeCloseTo(copy.layers[0].W[0][0], 8);
  });
});
