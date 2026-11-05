import { describe, expect, it } from 'vitest';
import { EXPERIMENTS } from '../src/content/experiments';
import { createMlp, empiricalNtk } from '../src/lib/numerics/mlp';
import { relativeFrobenius, twoLayerNtkPrediction } from '../src/lib/numerics/ntk';
import { getActivation } from '../src/lib/numerics/activations';
import { Rng } from '../src/lib/numerics/rng';

/**
 * The gallery's numbers.
 *
 * A preset states what the reader should see. If the application does not
 * produce it, the gallery is a picture of a laboratory rather than a set of
 * hypotheses, and a reader who checks will conclude the whole application is
 * careless with its numbers.
 *
 * So the numbers the gallery quotes are recomputed here, with the same code
 * the laboratory runs, and compared with what the gallery says.
 */

describe('the gallery', () => {
  it('states the arithmetic of its expectations correctly', () => {
    // the powers quoted in the expected outcomes
    expect(1.1 ** 11).toBeCloseTo(2.9, 1);
    expect(0.9 ** 11).toBeCloseTo(0.31, 2);
    expect(0.75 ** 15).toBeCloseTo(0.013, 3);
    expect(1.25 ** 15).toBeCloseTo(28, 0);
    // the asymptotic law of the K = 0 class at ℓ = 200 with K^(1) = 1
    expect(1 / (2 * 199 + 1)).toBeCloseTo(0.0025, 4);
  });

  it('produces the relative NTK error it says it does', () => {
    const preset = EXPERIMENTS.find((e) => e.id === 'ntk-two-layer')!;
    expect(preset.measured, 'the NTK preset states no measured numbers').toBeDefined();

    const act = getActivation('tanh');
    const seed = preset.seed;
    const inputDim = 4;
    const samples = 5;
    const seeds = 24;
    const rng = new Rng(seed * 31 + 5);
    const X = Array.from({ length: samples }, () => Array.from({ length: inputDim }, () => rng.normalScaled(0, 1)));

    for (const claim of preset.measured!) {
      let accErr = 0;
      for (let s = 0; s < seeds; s++) {
        const net = createMlp({
          widths: [inputDim, claim.width, 1],
          activation: 'tanh',
          Cw: 1,
          Cb: 0,
          seed: seed * 977 + s,
        });
        const t = empiricalNtk(net, X);
        const pred = twoLayerNtkPrediction(act, X, { Cw: 1, Cb: 0, hidden: claim.width });
        accErr += relativeFrobenius(t, pred) / seeds;
      }
      expect(
        Math.abs(accErr - claim.relativeError),
        `at width ${claim.width} the app measures ${(accErr * 100).toFixed(1)}%, the gallery says ${(claim.relativeError * 100).toFixed(1)}%`,
      ).toBeLessThan(claim.tolerance);
    }
  });

  it('gives every preset a hypothesis, an expectation and a seed', () => {
    for (const preset of EXPERIMENTS) {
      expect(preset.hypothesis.length, `${preset.id} has no hypothesis`).toBeGreaterThan(10);
      expect(preset.expected.length, `${preset.id} states no expectation`).toBeGreaterThan(10);
      expect(Number.isInteger(preset.seed), `${preset.id} has no seed`).toBe(true);
      expect(preset.description.length, `${preset.id} has no description`).toBeGreaterThan(10);
    }
  });

  it('states in prose the numbers it holds as data', () => {
    // the sentence and the data have to agree: a reader reads the sentence
    for (const preset of EXPERIMENTS) {
      for (const claim of preset.measured ?? []) {
        const percent = Math.round(claim.relativeError * 100);
        expect(
          preset.expected,
          `the expectation of "${preset.id}" does not mention ${percent}%`,
        ).toContain(`${percent}%`);
      }
    }
  });
});
