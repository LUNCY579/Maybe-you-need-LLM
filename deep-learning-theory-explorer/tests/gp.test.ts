import { describe, expect, it } from 'vitest';
import { solveLinear } from '../src/lib/numerics/linalg';
import { DEFAULT_GP, gpDemoData, gpPosterior, rbfKernel } from '../src/lib/numerics/gp';

/**
 * The Gaussian-process limit.
 *
 * The posterior is the exact infinite-width prediction of the theory, so it can
 * be checked against the properties a posterior must have: it passes through
 * the data, its uncertainty collapses at the observations, and it reduces to
 * the prior when there is no data.
 */

describe('the linear solver', () => {
  it('solves a system exactly', () => {
    // 2x + y = 5, x − y = 1  =>  x = 2, y = 1
    const x = solveLinear(
      [
        [2, 1],
        [1, -1],
      ],
      [5, 1],
    );
    expect(x[0]).toBeCloseTo(2, 10);
    expect(x[1]).toBeCloseTo(1, 10);
  });

  it('solves a larger system', () => {
    const n = 6;
    const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? n + 1 : 1 / (i + j + 1))));
    const truth = Array.from({ length: n }, (_, i) => i + 1);
    const b = A.map((row) => row.reduce((s, v, j) => s + v * truth[j], 0));
    const x = solveLinear(A, b);
    for (let i = 0; i < n; i++) expect(x[i]).toBeCloseTo(truth[i], 8);
  });

  it('refuses a singular system rather than returning nonsense', () => {
    expect(() =>
      solveLinear(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2],
      ),
    ).toThrow(/singular/);
  });

  it('refuses a mismatched right-hand side', () => {
    expect(() => solveLinear([[1]], [1, 2])).toThrow(/length/);
  });
});

describe('the RBF kernel', () => {
  it('is one on the diagonal and decays with distance', () => {
    const o = { ...DEFAULT_GP, signalVariance: 2 };
    expect(rbfKernel([1, 2], [1, 2], o)).toBeCloseTo(2, 12);
    const near = rbfKernel([0, 0], [0.1, 0], o);
    const far = rbfKernel([0, 0], [3, 0], o);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeLessThan(0.01);
  });
});

describe('the Gaussian-process posterior', () => {
  const data = gpDemoData(7, 0.1, 5);
  const queries = Array.from({ length: 40 }, (_, i) => [-1.5 + (3 * i) / 39]);

  it('interpolates the data when the noise is small', () => {
    const p = gpPosterior(data.X, data.y, data.X, { ...DEFAULT_GP, noiseVariance: 1e-4 });
    for (let i = 0; i < data.X.length; i++) {
      expect(p.mean[i], `point ${i}`).toBeCloseTo(data.y[i], 2);
    }
  });

  it('has small uncertainty at the observations and large uncertainty away from them', () => {
    const atData = gpPosterior(data.X, data.y, data.X, { ...DEFAULT_GP, noiseVariance: 0.01 });
    for (const sd of atData.sd) expect(sd).toBeLessThan(0.2);
    // well outside the range of the observations the prior is recovered
    const far = gpPosterior(data.X, data.y, [[-8]], { ...DEFAULT_GP, noiseVariance: 0.01 });
    expect(far.sd[0]).toBeGreaterThan(0.9);
    expect(Math.abs(far.mean[0])).toBeLessThan(0.05);
  });

  it('reduces to the prior where there is no data nearby', () => {
    // a single observation in the middle of a wide range
    const X = [[0]];
    const y = [1];
    const far = gpPosterior(X, y, [[100]], { ...DEFAULT_GP, lengthScale: 0.5 });
    expect(far.mean[0]).toBeLessThan(1e-6);
    expect(far.sd[0]).toBeCloseTo(1, 6);
  });

  it('is a valid function of the length scale: a short length scale follows the data more closely', () => {
    const short = gpPosterior(data.X, data.y, queries, { ...DEFAULT_GP, lengthScale: 0.15 });
    const long = gpPosterior(data.X, data.y, queries, { ...DEFAULT_GP, lengthScale: 3 });
    const roughness = (p: typeof short) =>
      p.mean.slice(1).reduce((s, m, i) => s + Math.abs(m - p.mean[i]), 0) / p.mean.length;
    expect(roughness(short)).toBeGreaterThan(roughness(long));
  });

  it('rejects inconsistent inputs', () => {
    expect(() => gpPosterior([], [], [[0]])).toThrow(/at least one observation/);
    expect(() => gpPosterior([[0]], [], [[0]])).toThrow(/targets/);
  });

  it('generates its own data, reproducibly', () => {
    const a = gpDemoData(9, 0.15, 3);
    const b = gpDemoData(9, 0.15, 3);
    const c = gpDemoData(9, 0.15, 4);
    expect(a.X).toEqual(b.X);
    expect(a.y).toEqual(b.y);
    expect(a.y).not.toEqual(c.y);
    expect(a.X.length).toBe(9);
  });
});
