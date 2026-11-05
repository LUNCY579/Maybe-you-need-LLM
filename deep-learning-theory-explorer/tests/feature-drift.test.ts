import { describe, expect, it } from 'vitest';
import { runRepresentation } from '../src/lib/experiments/training';
import { EXPERIMENTS } from '../src/content/experiments';
import { LESSONS } from '../src/content/lessons';

/**
 * The feature-drift claim.
 *
 * The lesson, the gallery preset and the lesson's figure all say that the
 * representation moves less as the network widens. That is a claim about a
 * measurement, and the measurement is the application's own — so the claim is
 * checked here, and the caveat that goes with it is checked too.
 *
 * The caveat matters as much as the claim: the ordering is a property of the
 * small-drift regime, and at a large step size the wide network overshoots and
 * the ordering reverses. A reader told only the first half would be misled by
 * the second.
 */

interface Measured {
  drift: number[];
  fisher: number[];
}

const cache = new Map<string, Measured>();

/**
 * One run trains all three widths, so one call answers every question about
 * that configuration — and the answer is cached, because the runs are the
 * expensive part of this suite.
 */
function measure(learningRate: number, steps = 300, n = 120, seed = 31): Measured {
  const key = `${learningRate}|${steps}|${n}|${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const result = runRepresentation({
    datasetId: 'two-moons',
    activation: 'tanh',
    Cw: 1,
    Cb: 0,
    width: 32,
    depth: 2,
    steps,
    learningRate,
    seed,
    n,
  });
  const measured: Measured = {
    drift: result.widthDrift.map((w) => w.finalDrift),
    fisher: result.widthDrift.map((w) => w.finalFisher),
  };
  cache.set(key, measured);
  return measured;
}

describe('the feature drift', () => {
  it('falls as the network widens, at the step size the application uses', () => {
    // the step size of the gallery preset and of the lesson figure
    const { drift } = measure(0.01);
    expect(drift[0]).toBeGreaterThan(drift[1]);
    expect(drift[1]).toBeGreaterThan(drift[2]);
  });

  it('quotes the numbers the lesson and the gallery state', () => {
    // the lesson's exercise answer and the gallery's expectation both say
    // "0.24, 0.10 and 0.04", and the Fisher ratios "0.61, 0.67, 0.64"
    const { drift, fisher } = measure(0.01);
    const round2 = (v: number) => Math.round(v * 100) / 100;
    expect(round2(drift[0])).toBeCloseTo(0.24, 2);
    expect(round2(drift[1])).toBeCloseTo(0.1, 2);
    expect(round2(drift[2])).toBeCloseTo(0.04, 2);
    expect(round2(fisher[0])).toBeCloseTo(0.61, 2);
    expect(round2(fisher[1])).toBeCloseTo(0.67, 2);
    expect(round2(fisher[2])).toBeCloseTo(0.64, 2);
  });

  it('says in prose the numbers it measures', () => {
    // the sentence and the measurement have to agree: a reader reads the sentence
    const { drift, fisher } = measure(0.01);
    const round2 = (v: number) => Math.round(v * 100) / 100;
    const preset = EXPERIMENTS.find((e) => e.id === 'representation-drift')!;
    for (const v of [...drift, ...fisher]) {
      expect(preset.expected, `the gallery's expectation does not mention ${round2(v)}`).toContain(`${round2(v)}`);
    }
    const lesson = LESSONS.find((l) => l.id === 'representation-learning')!;
    const answer = lesson.exercises[0].answer;
    for (const v of [...drift, ...fisher]) {
      expect(answer, `the lesson's answer does not mention ${round2(v)}`).toContain(`${round2(v)}`);
    }
  });

  it('separates best in the middle, which is what the lesson says', () => {
    const { fisher } = measure(0.01);
    expect(fisher[1]).toBeGreaterThan(fisher[0]);
    expect(fisher[1]).toBeGreaterThan(fisher[2]);
  });

  it('holds at the step size and length of the lesson figure', () => {
    const { drift } = measure(0.01, 120, 80);
    expect(drift[0]).toBeGreaterThan(drift[1]);
    expect(drift[1]).toBeGreaterThan(drift[2]);
  });

  it('reverses at a large step size, which is why the claim is stated with its caveat', () => {
    // the point of the caveat: the claim is not true everywhere
    const { drift } = measure(0.1);
    expect(drift[2]).toBeGreaterThan(drift[0]);
  });

  it('is a property of the regime rather than of one lucky seed', () => {
    for (const seed of [31, 99]) {
      const { drift } = measure(0.01, 300, 120, seed);
      expect(drift[2], `at seed ${seed}`).toBeLessThan(drift[0]);
    }
  });
});
