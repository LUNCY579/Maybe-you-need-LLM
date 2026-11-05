import { describe, expect, it } from 'vitest';
import {
  expectationBivariate,
  expectationBivariateMC,
  expectationNormal,
  expectationNormalSimpson,
  expectationNormalVariance,
  hermiteRule,
  validateCovariance,
} from '../src/lib/numerics/quadrature';
import { getActivation } from '../src/lib/numerics/activations';

describe('Gauss-Hermite quadrature', () => {
  it('produces normalized, symmetric weights', () => {
    const { x, w } = hermiteRule(40);
    expect(x).toHaveLength(40);
    const sum = w.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 12);
    for (let i = 0; i < x.length; i++) {
      expect(x[i]).toBeCloseTo(-x[x.length - 1 - i], 12);
      expect(w[i]).toBeCloseTo(w[w.length - 1 - i], 12);
    }
  });

  it('is exact for moments of the standard normal', () => {
    const moments = [1, 0, 1, 0, 3, 0, 15, 0, 105]; // E[X^k] for k = 0..8
    for (let k = 0; k < moments.length; k++) {
      const v = expectationNormal((x) => Math.pow(x, k), 40);
      expect(v).toBeCloseTo(moments[k], 9);
    }
  });

  it('matches Simpson integration for a smooth nonlinear activation', () => {
    // Simpson's rule has a discretization floor of roughly 1e-7 on these integrands,
    // which is far below the tolerance any experiment in the app depends on.
    const act = getActivation('tanh');
    for (const K of [0.05, 0.5, 1, 2.5]) {
      const quad = expectationNormalVariance((z) => act.f(z) * act.f(z), K, 96);
      const simpson = expectationNormalSimpson((z) => act.f(z) * act.f(z), K, { panels: 20000 });
      expect(Math.abs(quad - simpson)).toBeLessThan(1e-6);
    }
  });

  it('matches Simpson for the GELU activation (non-elementary)', () => {
    const act = getActivation('gelu');
    for (const K of [0.3, 1, 3]) {
      const quad = expectationNormalVariance((z) => act.f(z) * act.f(z), K, 96);
      const simpson = expectationNormalSimpson((z) => act.f(z) * act.f(z), K, { panels: 20000 });
      expect(Math.abs(quad - simpson) / Math.max(1e-12, Math.abs(simpson))).toBeLessThan(1e-6);
    }
  });

  it('reproduces the analytic Gaussian moments in two dimensions', () => {
    // E[u^2 v^2] = K11 K22 + 2 K12^2 for a centred Gaussian vector
    const K11 = 1.3;
    const K22 = 0.7;
    const K12 = 0.4;
    const quad = expectationBivariate((u, v) => u * u * v * v, K11, K12, K22, 40);
    expect(quad).toBeCloseTo(K11 * K22 + 2 * K12 * K12, 9);
  });

  it('agrees with Monte Carlo integration for a bivariate expectation', () => {
    const act = getActivation('tanh');
    const K11 = 1.0;
    const K22 = 0.8;
    const K12 = 0.55;
    const quad = expectationBivariate((u, v) => act.f(u) * act.f(v), K11, K12, K22, 60);
    const mc = expectationBivariateMC((u, v) => act.f(u) * act.f(v), K11, K12, K22, 400000, () => Math.random());
    // Monte Carlo is only a cross-check: allow 4 standard errors
    expect(Math.abs(quad - mc.value)).toBeLessThan(4 * mc.stderr + 1e-6);
  });

  it('rejects invalid covariance matrices instead of silently returning NaN', () => {
    expect(() => expectationBivariate((a, b) => a * b, 1, 1.5, 1)).toThrow(/positive semidefinite/);
    expect(() => expectationBivariate((a, b) => a * b, -1, 0, 1)).toThrow(/negative variances/);
    expect(() => validateCovariance(1, 0, Number.NaN)).toThrow(/non-finite/);
  });
});
