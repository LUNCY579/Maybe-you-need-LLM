import { describe, expect, it } from 'vitest';
import { COMPUTED_EXERCISES, computedValue, formatComputed, getComputedExercise } from '../src/lib/exercises';
import { LESSONS } from '../src/content/lessons';
import { getActivation } from '../src/lib/numerics/activations';
import { findCriticalPoints } from '../src/lib/numerics/gaussian';
import { symmetricEigen } from '../src/lib/numerics/linalg';
import { twoLayerNtkPrediction } from '../src/lib/numerics/ntk';
import { expectationNormal } from '../src/lib/numerics/quadrature';
import { Rng } from '../src/lib/numerics/rng';

/**
 * The computed exercise answers.
 *
 * These are the numbers a learner is asked to reproduce by hand, so they are
 * held to the same standard as the laboratory outputs: each must be finite,
 * each must be produced by the same code the laboratories run, and each must
 * agree with the prose answer written next to it in the lesson.
 */

describe('the computed-exercise registry', () => {
  it('has unique ids and a method description for every entry', () => {
    const ids = Object.keys(COMPUTED_EXERCISES);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      const entry = COMPUTED_EXERCISES[id];
      expect(entry.method.length, id).toBeGreaterThan(20);
      expect(entry.tolerance, id).toBeGreaterThan(0);
      expect(entry.digits ?? 4, id).toBeGreaterThan(0);
    }
  });

  it('computes a finite number for every entry', () => {
    for (const [id, entry] of Object.entries(COMPUTED_EXERCISES)) {
      const value = entry.compute();
      expect(Number.isFinite(value), id).toBe(true);
      expect(computedValue(id), id).toBe(value);
    }
  });

  it('reproduces the values quoted in the lesson prose', () => {
    // Wick contraction: E[z⁴] = 3K² with K = 2
    expect(COMPUTED_EXERCISES['gaussian-fourth-moment'].compute()).toBe(12);
    // scale-invariant class: A² = (a₊² + a₋²)/2 and C_W = 1/A²
    expect(COMPUTED_EXERCISES['leaky-scale-invariant-a2'].compute()).toBeCloseTo(0.505, 12);
    expect(COMPUTED_EXERCISES['leaky-critical-cw'].compute()).toBeCloseTo(1 / 0.505, 12);
    // deep linear recursion from layer 1 to layer 40
    expect(COMPUTED_EXERCISES['linear-covariance-depth-40'].compute()).toBeCloseTo(0.9 ** 39 * 1.5, 12);
    // the fluctuation law of eq. (3.33)
    expect(COMPUTED_EXERCISES['fluctuation-variance-depth-20-width-256'].compute()).toBeCloseTo(0.15625, 12);
    expect(COMPUTED_EXERCISES['fluctuation-sd-depth-20-width-256'].compute()).toBeCloseTo(Math.sqrt(0.15625), 12);
    // Wick contraction for a quadratic activation
    expect(COMPUTED_EXERCISES['quadratic-wick-kernel'].compute()).toBeCloseTo(2 * 3 + 2 * 0.25, 12);
  });

  it('agrees with the criticality scanner, not only with the closed form', () => {
    // The ReLU critical weight variance from the closed form eq. (5.67) ...
    const closed = COMPUTED_EXERCISES['relu-critical-cw'].compute();
    expect(closed).toBeCloseTo(2, 12);
    // ... and from an independent numerical scan of eq. (5.73).
    const scanned = COMPUTED_EXERCISES['relu-critical-cw-scanned'].compute();
    const points = findCriticalPoints(getActivation('relu'), { Kmax: 6, steps: 900 }).filter((p) => p.physical);
    expect(points.length).toBeGreaterThan(0);
    expect(scanned).toBeCloseTo(points[0].Cw, 6);
    expect(Math.abs(scanned - closed)).toBeLessThan(0.05);
    // the linear activation is critical at C_W = 1
    expect(COMPUTED_EXERCISES['linear-critical-cw'].compute()).toBeCloseTo(1, 12);
  });

  it('reproduces the unphysical sigmoid bias variance of §5.3.2', () => {
    expect(COMPUTED_EXERCISES['sigmoid-unphysical-cb'].compute()).toBeCloseTo(-4, 12);
  });

  it('orders the three tanh power-law estimates as the theory requires', () => {
    // leading asymptotic law < continuous approximation < exact recursion
    const leading = COMPUTED_EXERCISES['tanh-power-law-layer-200'].compute();
    const continuous = COMPUTED_EXERCISES['tanh-power-law-continuous-layer-200'].compute();
    const exact = COMPUTED_EXERCISES['tanh-exact-recursion-layer-200'].compute();
    expect(leading).toBeCloseTo(0.0025, 8);
    expect(continuous).toBeGreaterThan(leading);
    expect(exact).toBeGreaterThan(continuous);
    // and all three agree to within a per cent of each other
    expect(Math.abs(exact - leading) / leading).toBeLessThan(0.02);
  });

  it('computes the NTK trace ratio from the closed form, not from a hard-coded number', () => {
    const ratio = COMPUTED_EXERCISES['ntk-trace-ratio-quadrupled-width'].compute();
    expect(ratio).toBeGreaterThan(3.5);
    expect(ratio).toBeLessThan(4.2);
    // recomputing it independently from the closed form gives the same number
    const act = getActivation('tanh');
    const rng = new Rng(2024);
    const X = Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => rng.normal()));
    const trace = (hidden: number) => {
      const M = twoLayerNtkPrediction(act, X, { Cw: 1, Cb: 0, hidden });
      let s = 0;
      for (let i = 0; i < M.length; i++) s += M[i][i];
      return s;
    };
    expect(ratio).toBeCloseTo(trace(512) / trace(128), 12);
  });
});

describe('the prerequisite drill answers', () => {
  it('gives the stability threshold from the eigensolver, not from a hard-coded 0.5', () => {
    const eta = COMPUTED_EXERCISES['eigen-stability-threshold'].compute();
    expect(eta).toBeCloseTo(0.5, 10);
    // recomputed the long way, from the eigenvalues of the same matrix
    const { values } = symmetricEigen([
      [3, 1],
      [1, 3],
    ]);
    expect(eta).toBeCloseTo(2 / Math.max(...values), 14);
  });

  it('makes the rectified Gaussian non-Gaussian, and the Gaussian itself not', () => {
    const connected = COMPUTED_EXERCISES['connected-fourth-cumulant'].compute();
    expect(connected).toBeCloseTo(0.75, 3);
    // the same contraction on the unrectified variable cancels to zero
    const gaussian = expectationNormal((z) => z ** 4) - 3 * expectationNormal((z) => z * z) ** 2;
    expect(Math.abs(gaussian)).toBeLessThan(1e-9);
  });

  it('agrees with the one-line Gaussian-process posterior', () => {
    const mean = COMPUTED_EXERCISES['gp-single-observation-posterior-mean'].compute();
    const byHand = Math.exp(-0.5 * 0.5 / (2 * 0.5 * 0.5)) / (1 + 0.05);
    expect(mean).toBeCloseTo(byHand, 10);
    expect(mean).toBeCloseTo(0.5777, 3);
  });

  it('is exact where the quadrature rule says it must be exact', () => {
    // 12 Gauss–Hermite nodes integrate a quartic exactly, so this must land on the Wick value
    const quadrature = COMPUTED_EXERCISES['gauss-hermite-fourth-moment-twelve-nodes'].compute();
    expect(quadrature).toBeCloseTo(12, 10);
    expect(quadrature).toBeCloseTo(COMPUTED_EXERCISES['gaussian-fourth-moment'].compute(), 10);
  });
});

describe('the lessons use the computed answers', () => {
  it('every exercise that names a computed key names one that exists', () => {
    for (const lesson of LESSONS) {
      for (const exercise of lesson.exercises) {
        if (!exercise.computed) continue;
        expect(getComputedExercise(exercise.computed), `${lesson.id}: ${exercise.computed}`).toBeDefined();
      }
    }
  });

  it('covers a majority of the numerical exercises with a computed answer', () => {
    const numerical = LESSONS.flatMap((l) => l.exercises).filter((e) => e.kind === 'numerical');
    const computed = numerical.filter((e) => e.computed);
    expect(computed.length).toBeGreaterThanOrEqual(Math.ceil(numerical.length * 0.6));
  });

  it('quotes the computed value in the prose answer', () => {
    for (const lesson of LESSONS) {
      for (const exercise of lesson.exercises) {
        if (!exercise.computed) continue;
        const value = COMPUTED_EXERCISES[exercise.computed].compute();
        // The prose must quote a number equal to the computed value, to within
        // one per cent: the answer is written by hand, so it may be rounded.
        // The prose uses the typographic minus sign, so normalise it first.
        const numbers = exercise.answer.replace(/−/g, '-').match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g) ?? [];
        const quoted = numbers.map(Number).filter(Number.isFinite);
        const matches = quoted.some((q) => Math.abs(q - value) <= 0.01 * Math.abs(value));
        expect(matches, `${lesson.id}: "${exercise.answer}" does not quote ${value}`).toBe(true);
      }
    }
  });
});

describe('formatComputed', () => {
  it('formats small and large magnitudes sensibly', () => {
    expect(formatComputed(0)).toBe('0');
    expect(formatComputed(12, 6)).toBe('12.0000');
    expect(formatComputed(0.0025, 4)).toBe('0.002500');
    expect(formatComputed(1e-7, 4)).toContain('e-');
    expect(formatComputed(Number.NaN)).toBe('—');
  });
});
