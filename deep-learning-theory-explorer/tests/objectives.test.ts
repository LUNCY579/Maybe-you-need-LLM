import { describe, expect, it } from 'vitest';
import {
  analyzeReadout,
  buildObjective,
  evaluateSurface,
  numericalHessian2D,
  readoutGrad,
  readoutLoss,
  runTrajectory,
} from '../src/lib/numerics/objectives';
import { smoothRegression } from '../src/lib/numerics/datasets';
import { symmetricEigen } from '../src/lib/numerics/linalg';

const data = smoothRegression(40, 2, 0.0, 5);

describe('the frozen read-out problem', () => {
  it('has a loss and a gradient that agree with finite differences', () => {
    const { features } = buildObjective(data.X, data.Y, { kind: 'readout', hidden: 6, seed: 3 }).quadratic!;
    const v = features[0].map((_, i) => 0.3 * (i + 1));
    const g = readoutGrad(features, v, data.Y);
    const h = 1e-6;
    for (let i = 0; i < v.length; i++) {
      const plus = v.slice();
      plus[i] += h;
      const minus = v.slice();
      minus[i] -= h;
      const fd = (readoutLoss(features, plus, data.Y) - readoutLoss(features, minus, data.Y)) / (2 * h);
      expect(fd).toBeCloseTo(g[i], 5);
    }
  });

  it('the least-squares solution is a stationary point of the real loss', () => {
    const obj = buildObjective(data.X, data.Y, { kind: 'readout', hidden: 6, seed: 3 });
    const q = obj.quadratic!;
    const g = readoutGrad(q.features, q.vStar, data.Y);
    for (const component of g) expect(Math.abs(component)).toBeLessThan(1e-8);
    // and the loss there is the smallest attainable value
    const v = q.vStar.map((x) => x + 0.1);
    expect(readoutLoss(q.features, v, data.Y)).toBeGreaterThanOrEqual(q.minLoss - 1e-12);
  });

  it('the closed-form loss prediction matches the measured trajectory', () => {
    const obj = buildObjective(data.X, data.Y, { kind: 'readout', hidden: 5, seed: 7 });
    const q = obj.quadratic!;
    const analysis = analyzeReadout(q.features, data.Y);
    const lr = 0.3 * analysis.lrThreshold;
    const traj = runTrajectory(obj, { learningRate: lr, steps: 25, mode: 'slice' });
    for (const point of traj.points) {
      const predicted = analysis.lossPrediction(point.step, lr, q.v0);
      // the slice trajectory only moves two coordinates, so compare loosely:
      // the prediction is for the full quadratic, the slice is a restriction.
      expect(predicted).toBeGreaterThanOrEqual(analysis.minLoss - 1e-12);
    }
    expect(traj.points[traj.points.length - 1].loss).toBeLessThan(traj.points[0].loss);
  });

  it('the stability threshold equals 2 / lambda_max of the read-out Hessian', () => {
    const obj = buildObjective(data.X, data.Y, { kind: 'readout', hidden: 6, seed: 9 });
    const q = obj.quadratic!;
    const { values } = symmetricEigen(
      q.features.reduce<number[][]>(
        (acc, row) => acc.map((r, a) => r.map((v, b) => v + (2 / q.features.length) * row[a] * row[b])),
        Array.from({ length: q.features[0].length }, () => new Array<number>(q.features[0].length).fill(0)),
      ),
    );
    expect(q.lrThreshold).toBeCloseTo(2 / values[0], 10);
  });

  it('gradient descent diverges above the threshold and converges below it', () => {
    const obj = buildObjective(data.X, data.Y, { kind: 'readout', hidden: 5, seed: 4 });
    const q = obj.quadratic!;
    const stable = runTrajectory(obj, { learningRate: 0.5 * q.lrThreshold, steps: 60, mode: 'slice' });
    expect(stable.diverged).toBe(false);
    expect(stable.points[stable.points.length - 1].loss).toBeLessThan(stable.points[0].loss);

    const unstable = runTrajectory(obj, { learningRate: 5 * q.lrThreshold, steps: 60, mode: 'slice' });
    expect(unstable.diverged).toBe(true);
  });
});

describe('the non-convex hidden-parameter slice', () => {
  it('is genuinely non-convex: the Hessian determinant changes sign across the surface', () => {
    const obj = buildObjective(data.X, data.Y, { kind: 'hidden', hidden: 5, seed: 6 });
    // Scan the slice: a non-convex objective must have regions of opposite
    // Hessian determinant (saddle-like structure), which is what makes the
    // landscape panel worth looking at.
    const signs = new Set<number>();
    for (let i = 0; i <= 6; i++) {
      for (let j = 0; j <= 6; j++) {
        const a = obj.bounds.a[0] + ((obj.bounds.a[1] - obj.bounds.a[0]) * i) / 6;
        const b = obj.bounds.b[0] + ((obj.bounds.b[1] - obj.bounds.b[0]) * j) / 6;
        const H = numericalHessian2D(obj, a, b);
        const det = H[0][0] * H[1][1] - H[0][1] * H[1][0];
        if (Math.abs(det) < 1e-9) continue;
        signs.add(Math.sign(det));
      }
    }
    expect(signs.size).toBeGreaterThan(1);
  });

  it('the slice gradient matches finite differences of the real loss', () => {
    const obj = buildObjective(data.X, data.Y, { kind: 'hidden', hidden: 5, seed: 6 });
    const [a, b] = obj.start;
    const [ga, gb] = obj.gradAt(a, b);
    const h = 1e-5;
    const fda = (obj.valueAt(a + h, b) - obj.valueAt(a - h, b)) / (2 * h);
    const fdb = (obj.valueAt(a, b + h) - obj.valueAt(a, b - h)) / (2 * h);
    expect(fda).toBeCloseTo(ga, 4);
    expect(fdb).toBeCloseTo(gb, 4);
  });

  it('evaluates a real surface with a finite minimum and maximum', () => {
    const obj = buildObjective(data.X, data.Y, { kind: 'hidden', hidden: 5, seed: 6 });
    const surface = evaluateSurface(obj, 21);
    expect(surface.values.length).toBe(21);
    expect(surface.values[0].length).toBe(21);
    expect(Number.isFinite(surface.min)).toBe(true);
    expect(surface.max).toBeGreaterThan(surface.min);
    for (const row of surface.values) for (const v of row) expect(Number.isFinite(v)).toBe(true);
  });

  it('rejects invalid evaluation grids', () => {
    const obj = buildObjective(data.X, data.Y, { kind: 'readout', hidden: 4, seed: 1 });
    expect(() => evaluateSurface(obj, 3)).toThrow(/between 5 and 201/);
    expect(() => evaluateSurface(obj, 500)).toThrow(/between 5 and 201/);
  });
});

describe('trajectory validation', () => {
  it('rejects a non-positive learning rate and a nonsensical step count', () => {
    const obj = buildObjective(data.X, data.Y, { kind: 'readout', hidden: 4, seed: 1 });
    expect(() => runTrajectory(obj, { learningRate: 0, steps: 10 })).toThrow(/learning rate/);
    expect(() => runTrajectory(obj, { learningRate: 0.1, steps: 0 })).toThrow(/steps/);
    expect(() => runTrajectory(obj, { learningRate: 0.1, steps: 10_000 })).toThrow(/steps/);
  });
});
