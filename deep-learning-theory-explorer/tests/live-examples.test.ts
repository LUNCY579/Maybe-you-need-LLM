import { describe, expect, it } from 'vitest';
import { EQUATIONS } from '../src/content/equations';
import { ACTIVATION_IDS } from '../src/lib/numerics/activations';
import { liveEvaluation } from '../src/lib/liveExamples';

/**
 * Every equation's example is computed.
 *
 * The equation explorer says its worked examples are "evaluated live in your
 * browser". That is a promise about every equation, not most of them: a
 * quoted number on a page that says it is a computed one is worse than no
 * number at all.
 *
 * So every equation is evaluated here, for every activation the reader can
 * choose, and the result has to be numbers rather than nothing — and numbers
 * that agree with each other where the theory says they must.
 */

const ACTIVATIONS = ACTIVATION_IDS as readonly string[];

describe('the live evaluations', () => {
  it('every equation has one', () => {
    for (const equation of EQUATIONS) {
      const rows = liveEvaluation(equation.id, 'tanh');
      expect(rows, `the equation "${equation.title}" has no live evaluation`).not.toBeNull();
      expect(rows!.length, `the equation "${equation.title}" evaluates to nothing`).toBeGreaterThan(0);
    }
  });

  it('every equation has one for every activation', () => {
    for (const equation of EQUATIONS) {
      for (const activation of ACTIVATIONS) {
        const rows = liveEvaluation(equation.id, activation);
        expect(rows, `the equation "${equation.title}" has no live evaluation for ${activation}`).not.toBeNull();
        for (const [label, value] of rows!) {
          expect(value, `"${label}" of "${equation.title}" is empty`).not.toBe('');
          expect(value, `"${label}" of "${equation.title}" is a placeholder`).not.toBe('—');
        }
      }
    }
  });

  it('the NTK really is the inner product of the parameter gradients', () => {
    // eq. (7.17): the two numbers in the panel are the same number, computed
    // two ways
    const rows = liveEvaluation('ntk-definition', 'tanh')!;
    const gram = Number(rows.find(([k]) => k.includes('Gram'))![1]);
    const inner = Number(rows.find(([k]) => k.includes('inner product'))![1]);
    expect(gram).toBeCloseTo(inner, 10);
  });

  it('the kernel prediction agrees with the real gradient step', () => {
    // eqs. (7.19)-(7.20): the first-order expansion is the actual step, to
    // within the second-order term
    const rows = liveEvaluation('kernel-learning', 'tanh')!;
    const predicted = Number(rows.find(([k]) => k.includes('predicted'))![1]);
    const actual = Number(rows.find(([k]) => k.includes('actual'))![1]);
    expect(Math.abs(predicted - actual)).toBeLessThan(0.01 * Math.max(Math.abs(actual), 1e-6));
  });

  it('the initialization really does scale the weights by 1/n', () => {
    // eq. (4.2): the measured weight variance is C_W / n
    const rows = liveEvaluation('init-variance', 'tanh')!;
    const expected = Number(rows.find(([k]) => k.includes('C_W/n'))![1]);
    const measured = Number(rows.find(([k]) => k.includes('measured'))![1]);
    expect(Math.abs(measured - expected)).toBeLessThan(0.05 * expected);
  });
});
