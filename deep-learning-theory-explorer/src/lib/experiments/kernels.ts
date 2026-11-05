/**
 * Experiment runners for the signal-propagation laboratories.
 *
 * Each runner is a pure function: config in, measured numbers out. The runners
 * never fabricate anything — every value is either measured from seeded networks
 * or computed from the Chapter 5 recursions with quadrature. Tests call the same
 * functions, so what a student sees is what the test suite checks.
 */

import { getActivation, type ActivationId } from '../numerics/activations';
import {
  chiParallel,
  chiPerp,
  findCriticalPoints,
  gOfK,
  kernelFlowDiagonal,
  powerLawPrediction,
  taylorA1,
  type CriticalPoint,
} from '../numerics/gaussian';
import { backpropMse, batchStats, createMlp, forward, type InitDistribution, type Mlp } from '../numerics/mlp';
import { optimizerStep, type OptimizerId } from '../numerics/optimizers';
import { Rng } from '../numerics/rng';
import { mean, stdDev, variance } from '../numerics/rng';

export interface InputSpec {
  distribution: 'gaussian' | 'uniform';
  scale: number;
  dim?: number;
}

export function makeInputs(spec: InputSpec, count: number, seed: number): number[][] {
  const rng = new Rng(seed);
  const dim = spec.dim ?? 8;
  return Array.from({ length: count }, () =>
    Array.from({ length: dim }, () =>
      spec.distribution === 'gaussian' ? rng.normalScaled(0, spec.scale) : rng.uniformUnitVariance(spec.scale),
    ),
  );
}

/** A fixed, documented target function: the network must fit something concrete. */
export function targetFunction(x: number[]): number[] {
  return [Math.sin(1.5 * x[0]) + 0.5 * Math.cos(x[1 % x.length])];
}

export interface InitializationConfig {
  activation: ActivationId;
  Cw: number;
  Cb: number;
  depth: number;
  width: number;
  samples: number;
  seeds: number;
  seed: number;
  input: InputSpec;
  initDistribution: InitDistribution;
  /** subsample of preactivations kept for the histogram view */
  histogramLayer?: number;
}

export interface LayerSummary {
  layer: number;
  /** ensemble mean of the measured layer kernel */
  measured: number;
  /** standard deviation of the measured layer kernel across seeds */
  spread: number;
  /** infinite-width recursion prediction (quadrature) */
  theory: number;
  /** asymptotic 1/((-a1) l) law where it applies */
  asymptote: number | null;
  /** measured gradient RMS with respect to the preactivations, ensemble mean */
  gradRms: number;
}

export interface InitializationResult {
  layers: LayerSummary[];
  criticalPoints: CriticalPoint[];
  criticalSelection: CriticalPoint | null;
  susceptibility: { parallel: number; perpendicular: number; Kstar: number } | null;
  a1: number;
  expectedCw: number | null;
  /** raw preactivations of one layer for every seed, for the histogram panel */
  histogram: { values: number[]; layer: number };
  /**
   * The forward pass itself: the preactivation matrix of one layer of the first
   * network, rows are input samples and columns are neurons. This is the object
   * whose mean square is the kernel, and it is what makes dead units, saturated
   * units and a bimodal layer directly visible.
   */
  preactivationMatrix: { rows: number[][]; layer: number; inputLabels: string[] };
  /** the weights of one layer, for the distribution panel */
  weightSample: { values: number[]; layer: number };
  notes: string[];
  seedList: number[];
}

/**
 * Finite-width measurement of the layer-wise kernel plus its infinite-width
 * prediction. The theory curve uses the *measured* first-layer kernel as its
 * initial condition, so the comparison is apples to apples.
 */
export function runInitialization(config: InitializationConfig): InitializationResult {
  const act = getActivation(config.activation);
  if (!act) throw new Error(`unknown activation "${config.activation}"`);
  if (!Number.isInteger(config.depth) || config.depth < 2) throw new Error(`depth must be an integer of at least 2, got ${config.depth}`);
  if (!Number.isInteger(config.width) || config.width < 2) throw new Error(`width must be an integer of at least 2, got ${config.width}`);
  if (!Number.isInteger(config.samples) || config.samples < 2) throw new Error('at least two input samples are needed');
  if (!Number.isInteger(config.seeds) || config.seeds < 1) throw new Error('at least one seed is needed');
  if (!Number.isFinite(config.Cw) || config.Cw <= 0) throw new Error(`C_W must be positive, got ${config.Cw}`);
  if (!Number.isFinite(config.Cb) || config.Cb < 0) throw new Error(`C_b must be non-negative, got ${config.Cb}`);
  if (!Number.isFinite(config.seed)) throw new Error('the seed must be finite');

  const X = makeInputs(config.input, config.samples, config.seed * 977 + 13);
  const Y = X.map((x) => targetFunction(x));
  const widths = [X[0].length, ...Array(config.depth - 1).fill(config.width), 1];
  const seedList = Array.from({ length: config.seeds }, (_, i) => config.seed * 131 + i);

  const kernels: number[][] = [];
  const gradProfiles: number[][] = [];
  let histogram: number[] = [];
  let weightSample: number[] = [];
  let preactivationMatrix: number[][] = [];
  const histogramLayer = config.histogramLayer ?? Math.max(1, Math.floor(config.depth / 2));

  for (const s of seedList) {
    const net = createMlp({
      widths,
      activation: config.activation,
      Cw: config.Cw,
      Cb: config.Cb,
      distribution: config.initDistribution,
      seed: s,
    });
    const stats = batchStats(net, X);
    kernels.push(stats.kernelEstimate.slice(0, config.depth));
    const g = backpropMse(net, X, Y).layerPreactivationGradRms.slice(0, config.depth);
    gradProfiles.push(g);
    if (histogram.length === 0) {
      const layer = Math.min(histogramLayer, config.depth - 1);
      preactivationMatrix = X.map((x) => forward(net, x).preactivations[layer].slice());
      histogram = preactivationMatrix.flat();
      weightSample = net.layers[Math.min(histogramLayer, net.layers.length - 1)].W.flat();
    }
  }

  const K1 = mean(kernels.map((k) => k[0]));
  const theoryProfile = kernelFlowDiagonal(act, K1, config.Cw, config.Cb, config.depth);
  const a1 = taylorA1(act);
  const layers: LayerSummary[] = [];
  for (let l = 0; l < config.depth; l++) {
    const values = kernels.map((k) => k[l]);
    const grads = gradProfiles.map((g) => g[l]);
    layers.push({
      layer: l + 1,
      measured: mean(values),
      spread: config.seeds > 1 ? stdDev(values) : 0,
      theory: theoryProfile[l],
      asymptote:
        act.universality === 'K=0' && a1 < 0 && config.Cb === 0
          ? powerLawPrediction(a1, theoryProfile[0], l + 1)
          : null,
      gradRms: mean(grads),
    });
  }

  const scanWindow = Math.max(4, 6 * Math.max(1, config.Cw));
  const criticalPoints = findCriticalPoints(act, { Kmax: scanWindow, steps: 900 });
  const physical = criticalPoints.filter((p) => p.physical);
  const unphysical = criticalPoints.filter((p) => !p.physical);
  const criticalSelection = physical.length ? physical[physical.length - 1] : null;
  const susceptibility = criticalSelection
    ? {
        parallel: chiParallel(act, criticalSelection.Kstar, config.Cw),
        perpendicular: chiPerp(act, criticalSelection.Kstar, config.Cw),
        Kstar: criticalSelection.Kstar,
      }
    : null;

  const notes: string[] = [];
  notes.push(
    `Measured ensemble mean over ${config.seeds} seeded network${config.seeds === 1 ? '' : 's'} with ${config.samples} input samples of dimension ${X[0].length}.`,
  );
  notes.push(`Theory curve: the infinite-width recursion iterated from the measured K^(1) = ${K1.toFixed(5)} using Gauss-Hermite quadrature.`);
  if (act.universality === 'K=0' && a1 < 0) {
    notes.push(`K = 0 class: the asymptotic law uses a_1 = ${a1.toFixed(3)}, which is activation dependent.`);
  }
  if (!physical.length) {
    // The two failures are different, and saying which one happened is the
    // point of the scan: a root that exists but asks for a negative bias
    // variance is not the same finding as no root anywhere in the window.
    notes.push(
      unphysical.length
        ? `The criticality scanner found ${unphysical.length} root${unphysical.length === 1 ? '' : 's'} of eq. (5.73) in K in [0, ${scanWindow.toFixed(
            1,
          )}] and every one is unphysical: the largest has C_b = ${unphysical[unphysical.length - 1].Cb.toFixed(
            4,
          )}, and a variance cannot be negative — see Lesson 7 for why.`
        : `The criticality scanner found no root of eq. (5.73) at all in K in [0, ${scanWindow.toFixed(
            1,
          )}]: the condition is never met, so this activation cannot be tuned to criticality — see Lesson 7 for why.`,
    );
  }

  return {
    layers,
    criticalPoints,
    criticalSelection,
    susceptibility,
    a1,
    expectedCw: act.scaleInvariantA2 ? 1 / act.scaleInvariantA2 : act.critical?.Cw ?? null,
    histogram: { values: histogram, layer: histogramLayer + 1 },
    preactivationMatrix: {
      rows: preactivationMatrix,
      layer: histogramLayer + 1,
      inputLabels: X.map((_, i) => `x${i + 1}`),
    },
    weightSample: { values: weightSample, layer: histogramLayer + 1 },
    notes,
    seedList,
  };
}

export interface WidthDepthConfig {
  activation: ActivationId;
  Cw: number;
  Cb: number;
  /** fixed width for the depth sweep */
  width: number;
  depths: number[];
  /** fixed depth for the width sweep */
  depth: number;
  widths: number[];
  samples: number;
  seeds: number;
  seed: number;
}

export interface SweepPoint {
  x: number;
  /** ensemble mean of the terminal-layer kernel */
  meanKernel: number;
  /**
   * Seed-to-seed variance of the layer observable O^(l) = (1/n) sum_j (z_j^(l))^2
   * for a *single* input, averaged over the input samples. This is the variance
   * computed in book eq. (3.33), and it is the quantity that scales as 2l/n.
   */
  varianceKernel: number;
  /**
   * Seed-to-seed variance of the *sample-averaged* observable. Smaller than
   * `varianceKernel` by roughly 1/M because averaging over inputs cancels
   * part of the fluctuation; it is reported for comparison, not for the law.
   */
  pooledVariance: number;
  /** analytic prediction of the variance where one exists (linear waves) */
  predictedVariance: number | null;
  /** ensemble mean of the terminal-layer kernel fluctuation relative to the mean */
  relativeSpread: number;
}

export interface WidthDepthResult {
  depthSweep: SweepPoint[];
  widthSweep: SweepPoint[];
  aspectRatio: Array<{ ratio: number; varianceKernel: number }>;
  notes: string[];
  outputHistograms: Array<{ label: string; values: number[] }>;
  elapsedMs?: number;
}

/**
 * Terminal-layer kernel statistics as a function of depth (at fixed width) and of
 * width (at fixed depth).
 *
 * The measured observable is the one of book eq. (3.31),
 *
 *     O^(l)(x) = (1/n_l) sum_j (z_j^(l)(x))^2 ,
 *
 * evaluated at the last *hidden* layer of the network, and the measured
 * statistic is its variance across network instantiations for a single input,
 * averaged over the input samples. That is exactly the variance of eq. (3.33),
 * so the analytic prediction 2 l (G^(2))^2 / n can be attached to it.
 *
 * For a deep linear critical network the analytic prediction is
 *   Var[O^(l)] = 2 l C_W^(2 l) (G2)^2 / n ,  G2 = mean ||x||^2 / n_0 ,
 * with l the number of layers the signal has passed through, i.e. the index of
 * the last hidden layer. For other activations the app reports the measurement
 * only and says so: the book's general fluctuation analysis is asymptotic in
 * 1/n and involves the four-point vertex.
 */
export function runWidthDepthSweep(config: WidthDepthConfig): WidthDepthResult {
  if (!getActivation(config.activation)) throw new Error(`unknown activation "${config.activation}"`);
  if (!Array.isArray(config.depths) || config.depths.length === 0) throw new Error('the depth sweep needs at least one depth');
  if (!Array.isArray(config.widths) || config.widths.length === 0) throw new Error('the width sweep needs at least one width');
  if (!Number.isInteger(config.depth) || config.depth < 1) throw new Error(`depth must be a positive integer, got ${config.depth}`);
  if (!Number.isInteger(config.width) || config.width < 1) throw new Error(`width must be a positive integer, got ${config.width}`);
  if (!Number.isInteger(config.samples) || config.samples < 1) throw new Error('at least one input sample is needed');
  if (!Number.isInteger(config.seeds) || config.seeds < 1) throw new Error('at least one seed is needed');
  const X = makeInputs({ distribution: 'gaussian', scale: 1, dim: 8 }, config.samples, config.seed * 613 + 7);
  const n0 = X[0].length;
  const g2PerSample = X.map((x) => x.reduce((a, v) => a + v * v, 0) / n0);

  const attachPrediction = (point: SweepPoint, depth: number, width: number): SweepPoint => {
    if (config.activation !== 'linear' || config.Cb !== 0) return point;
    // exact for the critical linear network: Var[O^(l)] = 2 l (G^(2))^2 / n
    // with G^(2) = C_W^l G2 and l = depth - 1 (the last hidden layer).
    const ell = Math.max(1, depth - 1);
    const predicted = mean(
      g2PerSample.map((g2m) => {
        const g2 = Math.pow(config.Cw, ell) * g2m;
        return (2 * ell * g2 * g2) / width;
      }),
    );
    return { ...point, predictedVariance: predicted };
  };

  const measure = (depth: number, width: number): SweepPoint => {
    const widths = [n0, ...Array(depth - 1).fill(width), 1];
    const hiddenIndex = Math.max(0, depth - 2); // last hidden layer, 0-based
    // per-seed, per-sample layer observable
    const obsBySeed: number[][] = [];
    for (let s = 0; s < config.seeds; s++) {
      const net = createMlp({
        widths,
        activation: config.activation,
        Cw: config.Cw,
        Cb: config.Cb,
        seed: config.seed * 7717 + s,
      });
      const row: number[] = [];
      for (const x of X) {
        const z = forward(net, x).preactivations[hiddenIndex];
        row.push(z.reduce((a, v) => a + v * v, 0) / z.length);
      }
      obsBySeed.push(row);
    }
    // variance across seeds for each input, averaged over inputs (book eq. (3.33))
    const perSampleVariance = X.map((_, m) => variance(obsBySeed.map((row) => row[m])));
    const v = config.seeds > 1 ? mean(perSampleVariance) : 0;
    // variance of the sample-averaged observable, for comparison
    const pooled = obsBySeed.map((row) => mean(row));
    const pooledVariance = config.seeds > 1 ? variance(pooled) : 0;
    const meanKernel = mean(pooled);
    const base: SweepPoint = {
      x: depth,
      meanKernel,
      varianceKernel: v,
      pooledVariance,
      predictedVariance: null,
      relativeSpread: meanKernel !== 0 ? Math.sqrt(pooledVariance) / Math.abs(meanKernel) : Number.NaN,
    };
    return attachPrediction(base, depth, width);
  };

  const depthSweep = config.depths.map((d) => measure(d, config.width));
  const widthSweep = config.widths.map((w) => ({ ...measure(config.depth, w), x: w }));

  const aspectRatio = depthSweep
    .concat(widthSweep.map((p) => ({ ...p, x: config.depth / p.x })))
    .map((p) => ({ ratio: p.x, varianceKernel: p.varianceKernel }));

  const histograms: Array<{ label: string; values: number[] }> = [];
  for (const w of config.widths.slice(0, 3)) {
    const net = createMlp({
      widths: [n0, ...Array(Math.max(1, config.depth - 1)).fill(w), 1],
      activation: config.activation,
      Cw: config.Cw,
      Cb: config.Cb,
      seed: config.seed * 91 + 3,
    });
    histograms.push({ label: `width ${w}`, values: X.map((x) => forward(net, x).output[0]) });
  }

  const notes = [
    'The measured statistic is the variance across network instantiations of the layer observable O^(l) = (1/n) sum_j (z_j^(l))^2 for a single input, averaged over the input samples: the quantity of book eq. (3.33).',
    'Each point is an ensemble of seeded networks; the variance is computed across seeds, not across samples.',
    config.activation === 'linear' && config.Cb === 0
      ? 'Analytic reference attached: Var = 2*l*C_W^(2l)*(G2)^2/width for the deep linear network, with l the index of the last hidden layer.'
      : 'No closed-form variance prediction is shown for nonlinear activations: the app reports the measurement only, because the book\'s fluctuation analysis for general activations is asymptotic in 1/n and involves the four-point vertex.',
    'Runtime is reported for the whole sweep; widths and depths are capped so the browser stays responsive.',
  ];

  return { depthSweep, widthSweep, aspectRatio, notes, outputHistograms: histograms };
}

/** Physics-lab runner: one configuration, every observable the lab can show. */
export interface PhysicsConfig extends InitializationConfig {
  learningRate: number;
  steps: number;
  /** the update rule, shared with the other laboratories and the test suite */
  optimizer?: OptimizerId;
}

export interface PhysicsTrainingPoint {
  step: number;
  loss: number;
  gradNorm: number;
}

export interface PhysicsResult extends InitializationResult {
  training: PhysicsTrainingPoint[];
  weights: number[];
  activations: number[];
  diverged: boolean;
}

export function runPhysicsLab(config: PhysicsConfig): PhysicsResult {
  const base = runInitialization(config);
  if (!Number.isFinite(config.learningRate) || config.learningRate <= 0) {
    throw new Error(`learning rate must be a positive finite number, got ${config.learningRate}`);
  }
  if (!Number.isInteger(config.steps) || config.steps < 0) {
    throw new Error(`training steps must be a non-negative integer, got ${config.steps}`);
  }
  const X = makeInputs(config.input, config.samples, config.seed * 977 + 13);
  const Y = X.map((x) => targetFunction(x));
  const widths = [X[0].length, ...Array(config.depth - 1).fill(config.width), 1];
  const net = createMlp({
    widths,
    activation: config.activation,
    Cw: config.Cw,
    Cb: config.Cb,
    distribution: config.initDistribution,
    seed: config.seed * 131,
  });

  // real gradient descent, synchronous so the caller can time it
  const training: PhysicsTrainingPoint[] = [{ step: 0, loss: Number.NaN, gradNorm: 0 }];
  let diverged = false;
  const lr = config.learningRate;
  const optimizer: OptimizerId = config.optimizer ?? 'gd';
  const optState = {
    velocity: new Array(net.parameterCount).fill(0),
    m: new Array(net.parameterCount).fill(0),
    v: new Array(net.parameterCount).fill(0),
    t: 0,
  };
  for (let s = 1; s <= config.steps; s++) {
    const info = optimizerStep(net, X, Y, { optimizer, learningRate: lr }, optState);
    if (s === 1) training[0] = { step: 0, loss: info.lossBefore, gradNorm: info.gradNorm };
    training.push({ step: s, loss: info.lossAfter, gradNorm: info.gradNorm });
    if (info.diverged || !Number.isFinite(info.lossAfter) || info.lossAfter > 1e10) {
      diverged = true;
      break;
    }
  }

  return {
    ...base,
    training,
    diverged,
    weights: net.layers[0].W.flat().slice(0, 2000),
    activations: base.histogram.values.slice(0, 4000),
  };
}

/** Convenience: the terminal-layer kernel for a quick single-seed probe. */
export function terminalKernel(net: Mlp, X: number[][]): number {
  const stats = batchStats(net, X);
  return stats.kernelEstimate[stats.kernelEstimate.length - 1];
}

export { gOfK };
