import { describe, expect, it } from 'vitest';
import { findCriticalPoints } from '../src/lib/numerics/gaussian';
import { getActivation } from '../src/lib/numerics/activations';
import { LESSONS } from '../src/content/lessons';

/**
 * The order-one numbers.
 *
 * The lesson says: "The theory predicts C_W = 1, 2, 1.98 for linear, ReLU and
 * leaky-ReLU(0.1). None of these numbers was fitted: they follow from demanding
 * that the depth direction neither blows up nor dies out."
 *
 * That is a claim about numbers the application computes, so it is checked
 * here — against the scanner, and against the sentence itself.
 */

/**
 * The critical point the laboratory reports: the nontrivial root when there is
 * one, because the trivial fixed point K* = 0 is always there and is not what
 * a reader can act on.
 */
function critical(activation: string): { Cw: number; Cb: number; Kstar: number } | null {
  const points = findCriticalPoints(getActivation(activation as never), { Kmax: 6, steps: 1200 }).filter(
    (p) => p.physical,
  );
  const nontrivial = points.find((p) => p.Kstar > 1e-8);
  return nontrivial ?? (points.length ? points[points.length - 1] : null);
}

describe('the order-one numbers', () => {
  it('the scanner finds 1, 2 and 1.98 for linear, ReLU and leaky-ReLU(0.1)', () => {
    expect(critical('linear')!.Cw).toBeCloseTo(1, 3);
    expect(critical('relu')!.Cw).toBeCloseTo(2, 3);
    expect(critical('leakyRelu')!.Cw).toBeCloseTo(1.98, 2);
  });

  it('and the lesson says exactly those numbers', () => {
    const lesson = LESSONS.find((l) => l.id === 'criticality')!;
    const callout = lesson.sections
      .flatMap((s) => s.blocks)
      .find((b) => b.kind === 'callout' && b.title === 'Order-one numbers from a principle');
    expect(callout, 'the lesson has no "order-one numbers" callout').toBeDefined();
    const text = (callout as { text: string }).text;
    expect(text).toContain('C_W = 1, 2, 1.98');
  });

  it('the 1.98 is 1/A² for the leaky ReLU, and the app agrees', () => {
    const act = getActivation('leakyRelu');
    const a2 = act.scaleInvariantA2!;
    expect(a2).toBeCloseTo(0.505, 3);
    expect(1 / a2).toBeCloseTo(1.98, 2);
    expect(critical('leakyRelu')!.Cw).toBeCloseTo(1 / a2, 2);
  });

  it('the scanner reports distinct critical points, not every wobble of the curve', () => {
    // the ratio is computed by quadrature and it oscillates numerically, so the
    // same critical point used to be crossed a hundred and fifty times
    for (const activation of ['linear', 'relu', 'leakyRelu', 'tanh', 'sigmoid', 'gelu']) {
      const points = findCriticalPoints(getActivation(activation as never), { Kmax: 6, steps: 1200 });
      expect(points.length, `${activation} produced ${points.length} roots`).toBeLessThanOrEqual(3);
    }
  });

  it('the trivial fixed point is labelled as such', () => {
    // the leaky ReLU has both: the trivial K* = 0 root and the real one
    const points = findCriticalPoints(getActivation('leakyRelu'), { Kmax: 6, steps: 1200 });
    const trivial = points.find((p) => p.Kstar <= 1e-8);
    expect(trivial, 'the leaky ReLU has no trivial root').toBeDefined();
    expect(trivial!.note).toMatch(/trivial fixed point/i);
  });

  it('the sigmoid has one root and it is unphysical', () => {
    const points = findCriticalPoints(getActivation('sigmoid'), { Kmax: 6, steps: 1200 });
    expect(points.length).toBe(1);
    expect(points[0].physical).toBe(false);
    expect(points[0].note).toMatch(/unphysical/i);
  });

  it('the softplus has no root at all, as the gallery says', () => {
    const points = findCriticalPoints(getActivation('softplus'), { Kmax: 6, steps: 1200 });
    expect(points.length).toBe(0);
  });
});
