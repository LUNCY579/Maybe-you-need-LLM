import { describe, expect, it } from 'vitest';
import { makeInputs, runInitialization, runPhysicsLab, runWidthDepthSweep, targetFunction } from '../src/lib/experiments/kernels';
import { runNtkAnalysis, runNtkWidthScaling, runRepresentation, representationTraining } from '../src/lib/experiments/training';
import { getActivation } from '../src/lib/numerics/activations';
import { empiricalNtk, createMlp } from '../src/lib/numerics/mlp';
import { checkPsd } from '../src/lib/numerics/linalg';

/**
 * Experiment runners.
 *
 * These are the functions the laboratories call. They are tested here so that a
 * regression in a runner is caught by the unit suite rather than only by a
 * human looking at a chart.
 */

const BASE_INIT = {
  activation: 'tanh' as const,
  Cw: 1,
  Cb: 0,
  depth: 6,
  width: 32,
  samples: 16,
  seeds: 4,
  seed: 3,
  input: { distribution: 'gaussian' as const, scale: 1, dim: 6 },
  initDistribution: 'gaussian' as const,
};

describe('the initialization runner', () => {
  it('produces one summary per layer with a measured and a theoretical value', () => {
    const result = runInitialization(BASE_INIT);
    expect(result.layers.length).toBe(BASE_INIT.depth);
    for (const layer of result.layers) {
      expect(Number.isFinite(layer.measured)).toBe(true);
      expect(Number.isFinite(layer.theory)).toBe(true);
      expect(layer.measured).toBeGreaterThan(0);
      expect(layer.spread).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(layer.gradRms)).toBe(true);
    }
    // the layer index is 1-based
    expect(result.layers[0].layer).toBe(1);
    expect(result.layers[result.layers.length - 1].layer).toBe(BASE_INIT.depth);
  });

  it('is reproducible for a fixed seed', () => {
    const a = runInitialization(BASE_INIT);
    const b = runInitialization(BASE_INIT);
    expect(a.layers.map((l) => l.measured)).toEqual(b.layers.map((l) => l.measured));
    expect(a.seedList).toEqual(b.seedList);
  });

  it('says which kind of criticality failure it found, with the number it computed', () => {
    /*
      The note under the scan is the sentence a student reads to make sense of an
      empty criticality table. There are two different findings to report — a root
      that asks for a negative bias variance, and no root anywhere in the window —
      and the note has to name the one that happened, with the value the scan
      computed rather than the value the book prints.
    */
    const sigmoid = runInitialization({ ...BASE_INIT, activation: 'sigmoid' as const, Cw: 1.2 });
    expect(sigmoid.criticalPoints).toHaveLength(1);
    expect(sigmoid.notes.join(' ')).toMatch(/1 root of eq\. \(5\.73\)/);
    expect(sigmoid.notes.join(' ')).toMatch(/C_b = -4\.0000/);
    expect(sigmoid.notes.join(' ')).toMatch(/a variance cannot be negative/);

    const softplus = runInitialization({ ...BASE_INIT, activation: 'softplus' as const, Cw: 1.2 });
    expect(softplus.criticalPoints).toHaveLength(0);
    expect(softplus.notes.join(' ')).toMatch(/no root of eq\. \(5\.73\) at all/);
    // The window is stated, because a scan that found nothing only proves
    // nothing was found inside it.
    expect(softplus.notes.join(' ')).toMatch(/in K in \[0, \d+\.\d\]/);

    const quadratic = runInitialization({ ...BASE_INIT, activation: 'quadratic' as const, Cw: 1.2 });
    expect(quadratic.criticalPoints).toHaveLength(0);
    expect(quadratic.notes.join(' ')).toMatch(/the condition is never met/);
  });

  it('changes the measured profile when the seed changes', () => {
    const a = runInitialization(BASE_INIT);
    const b = runInitialization({ ...BASE_INIT, seed: 91 });
    expect(a.layers.map((l) => l.measured)).not.toEqual(b.layers.map((l) => l.measured));
  });

  it('agrees with the infinite-width recursion at ReLU criticality', () => {
    // C_W = 2 = 1/A^2 is the critical point of the scale-invariant class, where
    // the kernel is exactly constant, so the recursion is a flat line. The
    // measured profile must follow it, up to the finite-width correction.
    const result = runInitialization({ ...BASE_INIT, activation: 'relu', Cw: 2, depth: 6, width: 128, seeds: 30 });
    const theory = result.layers.map((l) => l.theory);
    const maxTheory = Math.max(...theory);
    const minTheory = Math.min(...theory);
    expect(maxTheory / minTheory).toBeLessThan(1.02);
    for (const layer of result.layers) {
      expect(Math.abs(layer.measured - layer.theory) / layer.theory).toBeLessThan(0.2);
    }
  });

  it('reports the asymptote only for the K = 0 class', () => {
    const tanh = runInitialization(BASE_INIT);
    expect(tanh.layers[0].asymptote).not.toBeNull();
    const relu = runInitialization({ ...BASE_INIT, activation: 'relu', Cw: 2 });
    expect(relu.layers[0].asymptote).toBeNull();
  });

  it('finds the critical point of the activation it is given', () => {
    expect(runInitialization({ ...BASE_INIT, activation: 'relu' }).criticalSelection?.Cw).toBeCloseTo(2, 3);
    expect(runInitialization(BASE_INIT).criticalSelection?.Cw).toBeCloseTo(1, 3);
    expect(runInitialization({ ...BASE_INIT, activation: 'sigmoid' }).criticalSelection).toBeNull();
  });

  it('the forward-pass matrix is the one whose mean square is the plotted kernel', () => {
    const result = runInitialization(BASE_INIT);
    const matrix = result.preactivationMatrix;
    expect(matrix.rows.length).toBe(BASE_INIT.samples);
    expect(matrix.rows[0].length).toBe(BASE_INIT.width);
    expect(matrix.inputLabels.length).toBe(BASE_INIT.samples);
    // the mean square of the displayed matrix must equal the kernel of that layer
    let s = 0;
    let count = 0;
    for (const row of matrix.rows) {
      for (const v of row) {
        s += v * v;
        count++;
      }
    }
    const layer = matrix.layer - 1;
    const measured = result.layers[layer].measured;
    // the matrix comes from the first seed, so it agrees with the ensemble mean
    // to within the seed-to-seed spread.
    expect(s / count).toBeGreaterThan(measured - 4 * result.layers[layer].spread - 1e-9);
    expect(s / count).toBeLessThan(measured + 4 * result.layers[layer].spread + 1e-9);
    // and the histogram is the same matrix, flattened
    expect(result.histogram.values.length).toBe(count);
  });

  it('rejects invalid configurations with a message', () => {
    expect(() => runInitialization({ ...BASE_INIT, depth: 1 })).toThrow(/at least 2/);
    expect(() => runInitialization({ ...BASE_INIT, width: 1 })).toThrow(/at least 2/);
    expect(() => runInitialization({ ...BASE_INIT, samples: 1 })).toThrow(/two input samples/);
    expect(() => runInitialization({ ...BASE_INIT, seeds: 0 })).toThrow(/at least one seed/);
    expect(() => runInitialization({ ...BASE_INIT, Cw: 0 })).toThrow(/C_W must be positive/);
    expect(() => runInitialization({ ...BASE_INIT, activation: 'nope' as never })).toThrow(/unknown activation/);
  });
});

describe('the physics-lab runner', () => {
  it('records a loss trajectory that decreases and flags divergence', () => {
    const result = runPhysicsLab({ ...BASE_INIT, steps: 25, learningRate: 0.05 });
    expect(result.training.length).toBe(26);
    expect(result.diverged).toBe(false);
    expect(result.training[result.training.length - 1].loss).toBeLessThan(result.training[0].loss);
    // the loss recorded at step t is the loss of the parameters at step t
    for (let i = 1; i < result.training.length; i++) {
      expect(result.training[i].loss).toBeLessThanOrEqual(result.training[i - 1].loss + 1e-9);
    }
  });

  it('flags a divergent run instead of hiding it', () => {
    const result = runPhysicsLab({ ...BASE_INIT, steps: 200, learningRate: 0.2, Cw: 3 });
    expect(result.diverged).toBe(true);
  });

  it('produces weight and activation samples for the histograms', () => {
    const result = runPhysicsLab({ ...BASE_INIT, steps: 2, learningRate: 0.05 });
    expect(result.weights.length).toBeGreaterThan(0);
    expect(result.activations.length).toBeGreaterThan(0);
    expect(result.weights.every(Number.isFinite)).toBe(true);
  });

  it('rejects an invalid learning rate instead of producing NaNs', () => {
    expect(() => runPhysicsLab({ ...BASE_INIT, steps: 2, learningRate: Number.NaN })).toThrow(/learning rate/);
    expect(() => runPhysicsLab({ ...BASE_INIT, steps: -1, learningRate: 0.1 })).toThrow(/steps/);
    expect(() => runPhysicsLab({ ...BASE_INIT, steps: 1.5, learningRate: 0.1 })).toThrow(/steps/);
  });
});

describe('the width/depth sweep runner', () => {
  it('measures the linear-in-depth variance law for a critical linear network', () => {
    const result = runWidthDepthSweep({
      activation: 'linear',
      Cw: 1,
      Cb: 0,
      width: 48,
      depths: [2, 4, 6, 8],
      depth: 4,
      widths: [16, 32, 64],
      samples: 12,
      seeds: 60,
      seed: 5,
    });
    expect(result.depthSweep.length).toBe(4);
    const variances = result.depthSweep.map((p) => p.varianceKernel);
    // the variance grows with depth
    expect(variances[3]).toBeGreaterThan(variances[0]);
    // and the analytic prediction is attached for the linear activation
    expect(result.depthSweep[0].predictedVariance).not.toBeNull();
    // the width sweep suppresses the variance
    const byWidth = result.widthSweep.map((p) => p.varianceKernel);
    expect(byWidth[2]).toBeLessThan(byWidth[0]);
  });

  it('attaches no prediction for a nonlinear activation, and says so', () => {
    const result = runWidthDepthSweep({
      activation: 'tanh',
      Cw: 1,
      Cb: 0,
      width: 16,
      depths: [2, 4],
      depth: 2,
      widths: [8, 16],
      samples: 8,
      seeds: 4,
      seed: 2,
    });
    expect(result.depthSweep[0].predictedVariance).toBeNull();
    expect(result.notes.join(' ')).toMatch(/No closed-form variance prediction/);
  });
});

describe('the NTK runner', () => {
  const config = {
    activation: 'tanh' as const,
    Cw: 1,
    Cb: 0,
    depth: 2,
    width: 48,
    samples: 5,
    inputDim: 4,
    seeds: 8,
    seed: 11,
  };

  it('averages the empirical NTK over seeds and reports its diagnostics', () => {
    const result = runNtkAnalysis(config);
    expect(result.meanNtk.length).toBe(config.samples);
    expect(result.meanNtk[0].length).toBe(config.samples);
    expect(result.symmetryDefect).toBeLessThan(1e-9);
    expect(result.psd.isPsd).toBe(true);
    expect(result.eigenvalues.length).toBe(config.samples);
    expect(result.prediction).not.toBeNull();
    expect(result.relativeError).not.toBeNull();
    expect(result.relativeError!).toBeLessThan(0.5);
  });

  it('matches the closed form better as the width grows', () => {
    const errorAt = (width: number) => runNtkAnalysis({ ...config, width }).relativeError!;
    expect(errorAt(128)).toBeLessThan(errorAt(16));
  });

  it('produces no closed-form comparison for deeper networks, and says so', () => {
    const result = runNtkAnalysis({ ...config, depth: 3 });
    expect(result.prediction).toBeNull();
    expect(result.notes.join(' ')).toMatch(/only shown for two-layer/);
  });

  it('rejects an input set that is too large to display', () => {
    expect(() => runNtkAnalysis({ ...config, samples: 1 })).toThrow(/at least two inputs/);
    expect(() => runNtkAnalysis({ ...config, samples: 40 })).toThrow(/at most 12 inputs/);
  });

  it('measures the linear growth of the NTK with the hidden width', () => {
    const scaling = runNtkWidthScaling({ ...config, width: 64 });
    // the runner chooses its own width ladder around the configured width
    expect(scaling.widths.length).toBe(scaling.trace.length);
    expect(scaling.widths.length).toBeGreaterThanOrEqual(3);
    expect(scaling.trace[scaling.trace.length - 1]).toBeGreaterThan(scaling.trace[0]);
    expect(scaling.predictedDiagonal).not.toBeNull();
    expect(scaling.relativeErrors.length).toBe(scaling.widths.length);
  });

  it('agrees with a directly computed empirical NTK for a single seed', () => {
    const direct = runNtkAnalysis({ ...config, seeds: 1 });
    const net = createMlp({ widths: [4, 48, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 11 * 977 });
    const X = direct.points;
    const manual = empiricalNtk(net, X);
    expect(direct.meanNtk[0][0]).toBeCloseTo(manual[0][0], 10);
    expect(checkPsd(manual).isPsd).toBe(true);
  });

  it('the displayed Jacobian is the one the kernel is the Gram matrix of', () => {
    // This is the definition of eq. (7.17): Theta(x_m, x_m') = J_m . J_m'.
    // If the laboratory shows the Jacobian, this identity must hold exactly.
    const analysis = runNtkAnalysis({ ...config, seeds: 1 });
    const net = createMlp({ widths: [4, 48, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 11 * 977 });
    const manual = empiricalNtk(net, analysis.points);
    const J = analysis.jacobian;
    const M = analysis.points.length;
    const outDim = J.length / M;
    for (let a = 0; a < M; a++) {
      for (let b = 0; b < M; b++) {
        let s = 0;
        for (let i = 0; i < outDim; i++) {
          const rowA = J[a * outDim + i];
          const rowB = J[b * outDim + i];
          for (let k = 0; k < rowA.length; k++) s += rowA[k] * rowB[k];
        }
        expect(s).toBeCloseTo(manual[a][b], 8);
        expect(s).toBeCloseTo(analysis.meanNtk[a][b], 8);
      }
    }
    // the per-layer gradient norms partition the parameters exactly
    const total = analysis.layerGradientNorms.reduce((s, v) => s + v * v, 0);
    const whole = analysis.gradientVector.reduce((s, v) => s + v * v, 0);
    expect(total).toBeCloseTo(whole, 8);
    expect(analysis.layerOffsets[0]).toBe(0);
    expect(analysis.layerOffsets.length).toBeGreaterThan(1);
  });
});

describe('the representation runner', () => {
  it('trains a classifier and records snapshots with separation metrics', () => {
    const result = runRepresentation({
      datasetId: 'two-moons',
      activation: 'tanh',
      Cw: 1,
      Cb: 0,
      width: 16,
      depth: 2,
      steps: 40,
      learningRate: 0.1,
      seed: 31,
      n: 60,
    });
    expect(result.snapshots.length).toBeGreaterThan(2);
    const first = result.snapshots[0];
    const last = result.snapshots[result.snapshots.length - 1];
    expect(last.loss).toBeLessThan(first.loss);
    expect(last.drift).toBeGreaterThan(0);
    expect(last.projection.length).toBe(60);
    expect(last.projection[0]).toHaveProperty('label');
    expect(result.finalActivationStats.length).toBe(result.layers);
  });

  it('uses the documented optimizer and reports which one it used', () => {
    const result = runRepresentation({
      datasetId: 'two-moons',
      activation: 'tanh',
      Cw: 1,
      Cb: 0,
      width: 8,
      depth: 2,
      steps: 10,
      learningRate: 0.05,
      seed: 4,
      n: 40,
      optimizer: 'momentum',
    });
    expect(result.notes.join(' ')).toMatch(/momentum/i);
  });

  it('yields monotonically increasing steps and ends with the same result as the one-shot run', () => {
    const config = {
      datasetId: 'two-moons',
      activation: 'tanh' as const,
      Cw: 1,
      Cb: 0,
      width: 8,
      depth: 2,
      steps: 20,
      learningRate: 0.05,
      seed: 9,
      n: 40,
    };
    const steps: number[] = [];
    let last = null;
    for (const value of representationTraining(config)) {
      steps.push(value.step);
      last = value;
    }
    expect(steps.length).toBeGreaterThan(1);
    // the progress records carry strictly increasing steps ...
    for (let i = 1; i < steps.length - 1; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    // ... and the last record is the summary of the same final state.
    expect(steps[steps.length - 1]).toBe(steps[steps.length - 2]);
    expect(last?.done).toBe(true);
    expect(last?.widthDrift.length).toBe(3);

    const oneShot = runRepresentation(config);
    expect(oneShot.snapshots.length).toBe(last!.snapshots.length);
    for (let i = 0; i < oneShot.snapshots.length; i++) {
      expect(oneShot.snapshots[i].loss).toBeCloseTo(last!.snapshots[i].loss, 12);
      expect(oneShot.snapshots[i].fisher).toBeCloseTo(last!.snapshots[i].fisher, 12);
    }
  });
});

describe('shared helpers', () => {
  it('generates reproducible inputs with the requested shape and scale', () => {
    const X = makeInputs({ distribution: 'gaussian', scale: 2, dim: 5 }, 10, 7);
    expect(X.length).toBe(10);
    expect(X[0].length).toBe(5);
    expect(X).toEqual(makeInputs({ distribution: 'gaussian', scale: 2, dim: 5 }, 10, 7));
    const rms = Math.sqrt(X.flat().reduce((s, v) => s + v * v, 0) / (10 * 5));
    expect(rms).toBeGreaterThan(1.6);
    expect(rms).toBeLessThan(2.4);
  });

  it('evaluates a fixed, documented target function', () => {
    expect(targetFunction([0, 0])[0]).toBeCloseTo(0.5, 12);
    expect(targetFunction([Math.PI / 3, 0])[0]).toBeCloseTo(Math.sin(1.5 * (Math.PI / 3)) + 0.5, 12);
  });

  it('exposes the activation registry used by the runners', () => {
    expect(getActivation('tanh').universality).toBe('K=0');
  });
});
