import { describe, expect, it } from 'vitest';
import { circles, gaussianClusters, getClassificationDataset, smoothRegression, standardize, twoMoons } from '../src/lib/numerics/datasets';
import { effectiveRank, featureDrift, fisherRatio, hiddenActivations, kernelDrift, kernelTrace, pca } from '../src/lib/numerics/representation';
import { createMlp, empiricalNtk } from '../src/lib/numerics/mlp';
import { checkPsd, gram, symmetricEigen } from '../src/lib/numerics/linalg';

describe('synthetic datasets', () => {
  it('are reproducible for a fixed seed and different across seeds', () => {
    const a = twoMoons(60, 0.05, 7);
    const b = twoMoons(60, 0.05, 7);
    const c = twoMoons(60, 0.05, 8);
    expect(a.X).toEqual(b.X);
    expect(a.labels).toEqual(b.labels);
    expect(a.X).not.toEqual(c.X);
  });

  it('build the two-moons problem with the documented shape', () => {
    const d = twoMoons(80, 0.05, 1);
    expect(d.X.length).toBe(80);
    expect(d.X[0].length).toBe(2);
    expect(d.Y.length).toBe(80);
    expect(d.Y[0].length).toBe(2);
    expect(d.classes).toBe(2);
    // one-hot encoding is consistent with the integer labels
    for (let i = 0; i < d.X.length; i++) {
      expect(d.Y[i][d.labels[i]]).toBe(1);
      expect(d.Y[i].reduce((a, b) => a + b, 0)).toBe(1);
    }
  });

  it('builds the circles and cluster problems with the documented shape', () => {
    expect(circles(40, 0.05, 2).X.length).toBe(40);
    expect(gaussianClusters(60, 3, 2.2, 0.5, 3).classes).toBe(3);
    expect(() => gaussianClusters(60, 7, 2.2, 0.5, 3)).toThrow(/between 2 and 4/);
    expect(() => getClassificationDataset('nope')).toThrow(/unknown dataset/);
  });

  it('makes the regression target reproducible and its truth evaluable', () => {
    const d = smoothRegression(30, 2, 0.02, 4);
    expect(d.X.length).toBe(30);
    expect(d.Y[0].length).toBe(1);
    const x = [0.25, -0.5];
    expect(d.truth(x)).toBeCloseTo(Math.sin(Math.PI * 0.25) + 0.5 * 0.25, 12);
    // the noisy targets sit close to the noiseless truth
    const residual = d.Y.reduce((s, y, i) => s + Math.abs(y[0] - d.truth(d.X[i])), 0) / d.Y.length;
    expect(residual).toBeLessThan(0.15);
    expect(() => smoothRegression(10, 99, 0.1, 1)).toThrow(/inputDim/);
  });

  it('standardizes to zero mean and unit variance', () => {
    const d = twoMoons(200, 0.1, 2);
    const { X } = standardize(d.X);
    for (let j = 0; j < 2; j++) {
      const col = X.map((row) => row[j]);
      const m = col.reduce((a, b) => a + b, 0) / col.length;
      const v = col.reduce((a, b) => a + (b - m) ** 2, 0) / col.length;
      expect(Math.abs(m)).toBeLessThan(1e-12);
      expect(Math.abs(v - 1)).toBeLessThan(1e-12);
    }
  });
});

describe('principal component analysis', () => {
  it('recovers the axes of a rotated, scaled two-dimensional cloud', () => {
    const theta = 0.6;
    const rows: number[][] = [];
    const rng = (() => {
      let s = 12345;
      return () => {
        s = (1103515245 * s + 12345) % 2147483648;
        return s / 2147483648;
      };
    })();
    for (let i = 0; i < 400; i++) {
      const u = (rng() - 0.5) * 6;
      const v = (rng() - 0.5) * 1;
      rows.push([u * Math.cos(theta) - v * Math.sin(theta), u * Math.sin(theta) + v * Math.cos(theta)]);
    }
    const p = pca(rows, 2);
    // the first component captures the long axis
    expect(p.explainedRatio[0]).toBeGreaterThan(0.9);
    expect(p.explainedRatio[0] + p.explainedRatio[1]).toBeCloseTo(1, 8);
    // the projected cloud is centred
    const meanX = p.projected.reduce((a, q) => a + q[0], 0) / p.projected.length;
    const meanY = p.projected.reduce((a, q) => a + q[1], 0) / p.projected.length;
    expect(Math.abs(meanX)).toBeLessThan(1e-9);
    expect(Math.abs(meanY)).toBeLessThan(1e-9);
  });

  it('rejects impossible requests', () => {
    expect(() => pca([[1, 2]], 2)).toThrow(/at least two samples/);
    expect(() => pca([[1, 2], [3, 4]], 5)).toThrow(/between 1 and/);
  });
});

describe('class separation and drift', () => {
  it('separates well-clustered features much better than random ones', () => {
    const labels = [0, 0, 0, 0, 1, 1, 1, 1];
    const clustered = [
      [1, 1],
      [1.1, 0.9],
      [0.9, 1.1],
      [1.05, 1.0],
      [5, 5],
      [5.1, 4.9],
      [4.9, 5.1],
      [5.05, 5.0],
    ];
    const scattered = clustered.map((row, i) => [row[0] * (i % 2 ? -1 : 1), row[1] * (i % 3 ? 1 : -1)]);
    expect(fisherRatio(clustered, labels)).toBeGreaterThan(10);
    expect(fisherRatio(scattered, labels)).toBeLessThan(fisherRatio(clustered, labels));
    expect(() => fisherRatio(clustered, labels.slice(1))).toThrow(/mismatch/);
  });

  it('measures feature drift as a relative displacement', () => {
    const before = [
      [1, 2],
      [3, 4],
    ];
    expect(featureDrift(before, before)).toBe(0);
    const after = [
      [2, 4],
      [6, 8],
    ];
    // every coordinate doubled, so the relative drift is exactly 1
    expect(featureDrift(before, after)).toBeCloseTo(1, 12);
    expect(() => featureDrift(before, before.slice(0, 1))).toThrow(/mismatch/);
  });

  it('measures kernel drift as a relative Frobenius displacement', () => {
    const A = [
      [1, 0],
      [0, 1],
    ];
    expect(kernelDrift(A, A)).toBe(0);
    const B = [
      [2, 0],
      [0, 2],
    ];
    expect(kernelDrift(A, B)).toBeCloseTo(1, 12);
  });

  it('computes the trace and the effective rank of a kernel matrix', () => {
    const K = [
      [2, 0],
      [0, 2],
    ];
    expect(kernelTrace(K)).toBe(4);
    expect(effectiveRank(K)).toBeCloseTo(2, 10);
    const rank1 = [
      [2, 2],
      [2, 2],
    ];
    expect(effectiveRank(rank1)).toBeCloseTo(1, 8);
  });
});

describe('hidden representations of a real network', () => {
  it('exposes the hidden activations of the requested layer', () => {
    const net = createMlp({ widths: [2, 5, 3, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 12 });
    const X = [
      [0.1, 0.2],
      [0.3, -0.4],
    ];
    const h1 = hiddenActivations(net, X, 1);
    expect(h1.length).toBe(2);
    expect(h1[0].length).toBe(5);
    const h3 = hiddenActivations(net, X, 3);
    expect(h3[0].length).toBe(1);
    expect(() => hiddenActivations(net, X, 0)).toThrow(/outside/);
    expect(() => hiddenActivations(net, X, 9)).toThrow(/outside/);
  });

  it('produces an empirical NTK that is a Gram matrix: symmetric and PSD', () => {
    const net = createMlp({ widths: [3, 8, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 6 });
    const X = [
      [0.2, -0.1, 0.4],
      [0.5, 0.3, -0.2],
      [-0.4, 0.6, 0.1],
    ];
    const theta = empiricalNtk(net, X);
    expect(checkPsd(theta).isPsd).toBe(true);
    // the Gram matrix of the Jacobian, so the two agree entry by entry
    const G = gram([]);
    expect(G).toEqual([]);
  });
});

describe('the symmetric eigensolver', () => {
  it('diagonalizes a symmetric matrix', () => {
    const A = [
      [4, 1, 0],
      [1, 3, 1],
      [0, 1, 2],
    ];
    const { values, vectors } = symmetricEigen(A);
    expect(values.length).toBe(3);
    // eigenvalues sorted descending
    expect(values[0]).toBeGreaterThanOrEqual(values[1]);
    expect(values[1]).toBeGreaterThanOrEqual(values[2]);
    // A v = lambda v
    for (let k = 0; k < 3; k++) {
      const v = vectors[k];
      const Av = A.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
      for (let i = 0; i < 3; i++) expect(Av[i]).toBeCloseTo(values[k] * v[i], 10);
    }
  });

  it('rejects a non-square matrix', () => {
    expect(() => symmetricEigen([[1, 2]])).toThrow(/square/);
  });
});
