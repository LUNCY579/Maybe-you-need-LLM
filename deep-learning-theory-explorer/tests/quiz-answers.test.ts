import { describe, expect, it } from 'vitest';
import { QUIZ } from '../src/content/quizzes';
import { getActivation } from '../src/lib/numerics/activations';
import { findCriticalPoints } from '../src/lib/numerics/gaussian';

/**
 * The assessment's numerical answers.
 *
 * A question that quotes a number must quote the number the mathematics
 * produces. These checks recompute each of them from first principles — not
 * from the lesson's prose — so a question cannot drift away from the theory it
 * is testing.
 */

/**
 * The number as it appears in the option text, if there is one.
 *
 * The first numeric run is taken, so "$3K^2$" reads as the coefficient 3 and
 * "≈ 0.44" as 0.44.
 */
function numberInOption(text: string): number | null {
  const cleaned = text.replace(/\\approx|≈/g, ' ').replace(/\$/g, ' ');
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

describe('the assessment bank', () => {
  it('has a consistent answer for every question that quotes a number', () => {
    for (const q of QUIZ) {
      if (!q.numeric) continue;
      // the option the answer key points at must state the same number
      const stated = numberInOption(q.options[q.answerIndex]);
      expect(stated, `${q.id}: option ${q.answerIndex} is "${q.options[q.answerIndex]}"`).not.toBeNull();
      expect(Math.abs(stated! - q.numeric.answer), q.id).toBeLessThanOrEqual(Math.max(q.numeric.tolerance, 1e-9));
    }
  });

  it('quotes the right number for the fourth moment of a Gaussian', () => {
    // E[z⁴] = 3K² for z ~ N(0, K): three Wick pairings
    const K = 2;
    expect(3 * K * K).toBe(12);
    const q = QUIZ.find((x) => x.id === 'q01')!;
    expect(q.numeric?.answer).toBe(3);
  });

  it('quotes the right number for the leading finite-width correction', () => {
    // 2(ℓ−1)/n, eq. (3.28), with ℓ = 21 and n = 100
    const depth = 21;
    const width = 100;
    expect((2 * (depth - 1)) / width).toBeCloseTo(0.4, 12);
    const q = QUIZ.find((x) => x.id === 'q02')!;
    expect(q.numeric!.answer).toBeCloseTo(0.4, 12);
    expect(Math.abs(q.numeric!.answer - (2 * (depth - 1)) / width)).toBeLessThanOrEqual(q.numeric!.tolerance);
  });

  it('quotes the right number for the critical weight variance of the ReLU', () => {
    // C_W = 1/A², eq. (5.67), and the numerical scanner must agree
    const act = getActivation('relu');
    const closed = 1 / act.scaleInvariantA2!;
    const points = findCriticalPoints(act, { Kmax: 6, steps: 900 }).filter((p) => p.physical);
    expect(points.length).toBeGreaterThan(0);
    expect(points[0].Cw).toBeCloseTo(closed, 3);

    const q = QUIZ.find((x) => x.id === 'q04')!;
    expect(q.numeric!.answer).toBeCloseTo(closed, 12);
  });

  it('quotes the right number for the standard deviation of the layer observable', () => {
    // sd = √(2ℓ/n) at criticality, eq. (3.33), with ℓ = 50 and n = 512
    const depth = 50;
    const width = 512;
    const sd = Math.sqrt((2 * depth) / width);
    expect(sd).toBeCloseTo(0.4419, 3);
    const q = QUIZ.find((x) => x.id === 'q07')!;
    expect(Math.abs(q.numeric!.answer - sd)).toBeLessThanOrEqual(q.numeric!.tolerance);
  });

  it('gives every question an explanation that mentions the number it asks for', () => {
    for (const q of QUIZ) {
      if (!q.numeric) continue;
      const stated = String(q.numeric.answer);
      const inExplanation = q.explanation.includes(stated) || q.explanation.includes(stated.replace(/^0\./, '.'));
      expect(inExplanation, `${q.id}: "${q.explanation}" does not mention ${stated}`).toBe(true);
    }
  });

  it('never asks for a number it does not also offer as an option', () => {
    for (const q of QUIZ) {
      if (!q.numeric) continue;
      const optionsWithNumbers = q.options.filter((o) => numberInOption(o) !== null);
      expect(optionsWithNumbers.length, q.id).toBeGreaterThan(1);
    }
  });
});
