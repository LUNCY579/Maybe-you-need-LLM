/**
 * Experiment runners for the training laboratories (D: NTK, E: representation).
 * Everything is measured: Jacobians are exact analytic derivatives, the NTK is
 * assembled as a Gram matrix of those Jacobians, and training uses the same
 * backpropagation the test suite validates against finite differences.
 */

import { getActivation, type ActivationId } from '../numerics/activations';
import { asymmetry, checkPsd, symmetricEigen } from '../numerics/linalg';
import { empiricalNtk, createMlp, forward, mse, backpropMse, outputJacobian, type Mlp } from '../numerics/mlp';
import { relativeFrobenius, twoLayerNtkPrediction } from '../numerics/ntk';
import { Rng, mean, variance } from '../numerics/rng';
import { featureDrift, fisherRatio, hiddenActivations, kernelDrift, pca } from '../numerics/representation';
import { getClassificationDataset, type Dataset } from '../numerics/datasets';
import { optimizerStep, type OptimizerId } from '../numerics/optimizers';

export interface NtkConfig {
  activation: ActivationId;
  Cw: number;
  Cb: number;
  depth: number;
  width: number;
  /** number of distinct inputs in the kernel matrix */
  samples: number;
  inputDim: number;
  seeds: number;
  seed: number;
}

export interface NtkAnalysis {
  points: number[][];
  meanNtk: number[][];
  /** per-entry standard deviation across seeds */
  sdNtk: number[][];
  prediction: number[][] | null;
  relativeError: number | null;
  symmetryDefect: number;
  psd: { isPsd: boolean; minEigenvalue: number; maxEigenvalue: number; relativeMin: number; tolerance: number };
  eigenvalues: number[];
  parameters: number;
  seeds: number;
  inputLabels: number[];
  notes: string[];
  /** the output Jacobian of the first seed: rows are (input, output component), columns are parameters */
  jacobian: number[][];
  /** the column index at which each layer's parameter block starts */
  layerOffsets: number[];
  /** L2 norm of the parameter-gradient block of each layer, for the first input */
  layerGradientNorms: number[];
  /** the raw parameter gradient of the first input, for display */
  gradientVector: number[];
  /** the maximum absolute entry of the Jacobian */
  jacobianScale: number;
}

/** Empirical NTK, averaged over seeds, with diagnostics and (for 2 layers) theory. */
export function runNtkAnalysis(config: NtkConfig): NtkAnalysis {
  const act = getActivation(config.activation);
  const rng = new Rng(config.seed * 31 + 5);
  if (config.samples < 2) throw new Error('need at least two inputs for a kernel matrix');
  if (config.samples > 12) throw new Error('at most 12 inputs are supported in the NTK laboratory');
  const X = Array.from({ length: config.samples }, () =>
    Array.from({ length: config.inputDim }, () => rng.normalScaled(0, 1)),
  );
  const widths = [config.inputDim, ...Array(config.depth - 1).fill(config.width), 1];
  const nets: Mlp[] = [];
  const seeds = Array.from({ length: config.seeds }, (_, i) => config.seed * 977 + i);
  for (const s of seeds) {
    nets.push(createMlp({ widths, activation: config.activation, Cw: config.Cw, Cb: config.Cb, seed: s }));
  }
  const ntk = nets.map((net) => empiricalNtk(net, X));
  const n = config.samples;
  const meanNtk: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const sdNtk: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const values = ntk.map((t) => t[i][j]);
      meanNtk[i][j] = mean(values);
      sdNtk[i][j] = config.seeds > 1 ? Math.sqrt(variance(values)) : 0;
    }
  }
  const prediction =
    config.depth === 2 ? twoLayerNtkPrediction(act, X, { Cw: config.Cw, Cb: config.Cb, hidden: config.width }) : null;
  const relativeError = prediction ? relativeFrobenius(meanNtk, prediction) : null;
  const psd = checkPsd(meanNtk);
  const { values } = symmetricEigen(meanNtk);

  const notes: string[] = [];
  notes.push(
    `Averaged over ${config.seeds} seeded network${config.seeds === 1 ? '' : 's'}; each NTK entry is a sum of squared parameter gradients (book eq. (7.17)).`,
  );
  if (prediction) {
    notes.push(
      'Closed-form comparison: for a two-layer network E[Θ] = C_W·E[σ′(u)σ′(v)](x·x′ + 1) + n₁·E[σ(u)σ(v)] + 1, with the expectations taken over the bivariate Gaussian at K^(1).',
    );
  } else {
    notes.push(
      'Closed-form comparison is only shown for two-layer networks; for deeper networks the app reports measurements and the frozen-NTK recursion of eqs. (9.5)-(9.7) separately, with its normalization convention stated.',
    );
  }
  notes.push(
    'The raw NTK carries an overall width-dependent normalization: the read-out term grows linearly with the hidden width, which is exactly why the book rescales weight learning rates by 1/n_{ℓ−1} (eqs. (8.6)-(8.7)).',
  );

  // The Jacobian of the first instantiation: the NTK is the Gram matrix of exactly
  // these rows, so showing them makes the definition of eq. (7.17) checkable by eye.
  const firstNet = nets[0];
  const jacobian = outputJacobian(firstNet, X);
  const layerOffsets: number[] = [];
  let offset = 0;
  for (const layer of firstNet.layers) {
    layerOffsets.push(offset);
    offset += layer.W.length * layer.W[0].length + layer.b.length;
  }
  const layerGradientNorms = layerOffsets.map((start, i) => {
    const end = i + 1 < layerOffsets.length ? layerOffsets[i + 1] : offset;
    let s = 0;
    for (let k = start; k < end; k++) {
      const v = jacobian[0][k];
      s += v * v;
    }
    return Math.sqrt(s);
  });
  let jacobianScale = 0;
  for (const row of jacobian) for (const v of row) jacobianScale = Math.max(jacobianScale, Math.abs(v));

  return {
    points: X,
    meanNtk,
    sdNtk,
    prediction,
    relativeError,
    symmetryDefect: asymmetry(meanNtk),
    psd,
    eigenvalues: values,
    parameters: nets[0].parameterCount,
    seeds: config.seeds,
    inputLabels: X.map((_, i) => i + 1),
    notes,
    jacobian,
    layerOffsets,
    layerGradientNorms,
    gradientVector: jacobian[0].slice(),
    jacobianScale,
  };
}

export interface NtkWidthScaling {
  widths: number[];
  trace: number[];
  diagonal: number[];
  predictedDiagonal: number[] | null;
  relativeErrors: number[];
}

export interface NtkClosedFormComparison {
  /** the inputs the two kernels are compared at */
  X: number[][];
  /** the two-layer closed form of eq. (7.17) */
  closed: number[][];
  /** the same kernel, measured from seeded networks and averaged */
  measured: number[][];
  /** the relative error of the first row */
  relativeError: number;
}

/**
 * The two-layer NTK: the closed form against the measurement.
 *
 * The closed form is eq. (7.17); the measurement is the empirical NTK of a
 * real two-layer network, averaged over seeds. This is the comparison the
 * lesson figure draws, and it is a real computation — it builds a network per
 * seed and assembles its kernel from Jacobians — so it belongs with the other
 * measurements rather than in the middle of a render.
 */
export function runNtkClosedForm(config: {
  width: number;
  seeds: number;
  samples?: number;
  inputDim?: number;
  seed?: number;
}): NtkClosedFormComparison {
  const samples = config.samples ?? 5;
  const inputDim = config.inputDim ?? 4;
  const act = getActivation('tanh');
  const rng = new Rng((config.seed ?? 2024) * 31 + 5);
  const X = Array.from({ length: samples }, () => Array.from({ length: inputDim }, () => rng.normal()));
  const closed = twoLayerNtkPrediction(act, X, { Cw: 1, Cb: 0, hidden: config.width });
  const measured: number[][] = Array.from({ length: samples }, () => new Array(samples).fill(0));
  for (let s = 0; s < config.seeds; s++) {
    const net = createMlp({ widths: [inputDim, config.width, 1], activation: 'tanh', Cw: 1, Cb: 0, seed: 1000 + s });
    const theta = empiricalNtk(net, X);
    for (let i = 0; i < samples; i++) {
      for (let j = 0; j < samples; j++) measured[i][j] += theta[i][j] / config.seeds;
    }
  }
  const row = closed[0];
  const measuredRow = measured[0];
  const relativeError =
    row.reduce((s, v, i) => s + Math.abs(v - measuredRow[i]), 0) / row.reduce((s, v) => s + v, 0);
  return { X, closed, measured, relativeError };
}

/** Measured width scaling of the NTK trace, against the two-layer closed form. */
export function runNtkWidthScaling(config: NtkConfig): NtkWidthScaling {
  const act = getActivation(config.activation);
  const rng = new Rng(config.seed * 31 + 5);
  const X = Array.from({ length: config.samples }, () =>
    Array.from({ length: config.inputDim }, () => rng.normalScaled(0, 1)),
  );
  const widths: number[] = [];
  for (let w = Math.max(2, Math.floor(config.width / 4)); w <= config.width * 4; w = Math.max(w + 1, Math.round(w * 1.6))) {
    widths.push(w);
  }
  const trace: number[] = [];
  const diagonal: number[] = [];
  const predictedDiagonal: number[] = [];
  const relativeErrors: number[] = [];
  for (const w of widths) {
    let acc = 0;
    let accDiag = 0;
    let accErr = 0;
    for (let s = 0; s < config.seeds; s++) {
      const net = createMlp({
        widths: [config.inputDim, w, 1],
        activation: config.activation,
        Cw: config.Cw,
        Cb: config.Cb,
        seed: config.seed * 977 + s,
      });
      const t = empiricalNtk(net, X);
      let tr = 0;
      for (let i = 0; i < t.length; i++) tr += t[i][i];
      acc += tr / config.seeds;
      accDiag += t[0][0] / config.seeds;
      if (config.depth === 2) {
        const pred = twoLayerNtkPrediction(act, X, { Cw: config.Cw, Cb: config.Cb, hidden: w });
        accErr += relativeFrobenius(t, pred) / config.seeds;
      }
    }
    trace.push(acc);
    diagonal.push(accDiag);
    if (config.depth === 2) {
      predictedDiagonal.push(twoLayerNtkPrediction(act, X, { Cw: config.Cw, Cb: config.Cb, hidden: w })[0][0]);
      relativeErrors.push(accErr);
    }
  }
  return { widths, trace, diagonal, predictedDiagonal: predictedDiagonal.length ? predictedDiagonal : null, relativeErrors };
}

export interface NtkDriftPoint {
  step: number;
  loss: number;
  relativeDrift: number;
  normalizedDistance: number;
}

export interface NtkDriftResult {
  points: NtkDriftPoint[];
  widthComparisons: Array<{ width: number; finalDrift: number; finalLoss: number }>;
  notes: string[];
}

/** Train a small network and watch the empirical NTK move (the dNTK effect). */
export function runNtkDrift(
  dataset: Dataset,
  {
    activation = 'tanh' as ActivationId,
    Cw = 1,
    Cb = 0,
    width = 16,
    depth = 2,
    steps = 200,
    learningRate = 0.1,
    sampleCount = 5,
    seed = 7,
    comparisonWidths = [8, 32, 128],
  }: {
    activation?: ActivationId;
    Cw?: number;
    Cb?: number;
    width?: number;
    depth?: number;
    steps?: number;
    learningRate?: number;
    sampleCount?: number;
    seed?: number;
    comparisonWidths?: number[];
  } = {},
): NtkDriftResult {
  const X = dataset.X.slice(0, sampleCount);
  const Y = dataset.Y.slice(0, sampleCount);
  const run = (w: number) => {
    const net = createMlp({
      widths: [dataset.inputDim, ...Array(Math.max(1, depth - 1)).fill(w), dataset.classes],
      activation,
      outputActivation: 'linear',
      Cw,
      Cb,
      seed,
    });
    const theta0 = empiricalNtk(net, X);
    const points: NtkDriftPoint[] = [{ step: 0, loss: mse(net, X, Y), relativeDrift: 0, normalizedDistance: 0 }];
    for (let s = 1; s <= steps; s++) {
      const { grads } = backpropMse(net, X, Y);
      const lr = learningRate;
      for (let l = 0; l < net.layers.length; l++) {
        const W = net.layers[l].W;
        for (let i = 0; i < W.length; i++) for (let j = 0; j < W[i].length; j++) W[i][j] -= lr * grads[l].W[i][j];
        for (let i = 0; i < net.layers[l].b.length; i++) net.layers[l].b[i] -= lr * grads[l].b[i];
      }
      if (s % Math.max(1, Math.floor(steps / 40)) === 0 || s === steps) {
        const theta = empiricalNtk(net, X);
        points.push({
          step: s,
          loss: mse(net, X, Y),
          relativeDrift: kernelDrift(theta0, theta),
          normalizedDistance: kernelDistanceNormalized(theta0, theta),
        });
      }
      const loss = mse(net, X, Y);
      if (!Number.isFinite(loss) || loss > 1e10) break;
    }
    return points;
  };

  const points = run(width);
  const widthComparisons = comparisonWidths.map((w) => {
    const p = run(w);
    return { width: w, finalDrift: p[p.length - 1].relativeDrift, finalLoss: p[p.length - 1].loss };
  });

  return {
    points,
    widthComparisons,
    notes: [
      'Drift is measured as ‖Θ(t) − Θ(0)‖_F / ‖Θ(0)‖_F on a fixed set of inputs; Θ is recomputed from exact Jacobians at every snapshot.',
      'A frozen NTK at infinite width would give zero drift. The measured drift is a finite-width effect and shrinks as the width grows on this task.',
      'The comparison widths use the same seed, learning rate and step count, so the only difference is the width.',
    ],
  };
}

function kernelDistanceNormalized(A: number[][], B: number[][]): number {
  return relativeFrobenius(A, B);
}

export interface RepresentationConfig {
  datasetId: string;
  activation: ActivationId;
  Cw: number;
  Cb: number;
  width: number;
  depth: number;
  steps: number;
  learningRate: number;
  seed: number;
  snapshotInterval?: number;
  n?: number;
  /** the update rule; the same module the test suite validates */
  optimizer?: OptimizerId;
}

export interface RepresentationSnapshot {
  step: number;
  loss: number;
  accuracy: number;
  fisher: number;
  drift: number;
  kernelDriftValue: number;
  pcaExplained: number;
  projection: Array<{ x: number; y: number; label: number }>;
}

export interface RepresentationResult {
  dataset: Dataset;
  snapshots: RepresentationSnapshot[];
  layers: number;
  widthDrift: Array<{ width: number; finalDrift: number; finalFisher: number; finalLoss: number; accuracy: number }>;
  notes: string[];
  finalActivationStats: Array<{ layer: number; meanSquare: number }>;
}

/** One progress record of the representation run, yielded by `representationTraining`. */
export interface RepresentationProgress {
  /** the gradient step reached */
  step: number;
  /** the number of steps requested */
  totalSteps: number;
  dataset: Dataset;
  snapshots: RepresentationSnapshot[];
  net: Mlp;
  h0: number[][];
  layers: number;
  widthDrift: RepresentationResult['widthDrift'];
  finalActivationStats: RepresentationResult['finalActivationStats'];
  notes: string[];
  /** true on the final record, when the width comparison has also finished */
  done: boolean;
}

/**
 * Train a small classifier on a synthetic dataset and record what happens to the
 * hidden representation. PCA is used only for the 2-D view; the reported separation
 * metric is a Fisher ratio computed in the full hidden space.
 *
 * This is the generator form: it yields a progress record after every snapshot so
 * that the interface can drive it, pause it and resume it without the browser
 * freezing. `runRepresentation` below drains it in one go for the tests.
 */
export function* representationTraining(config: RepresentationConfig): Generator<RepresentationProgress> {
  const dataset = getClassificationDataset(config.datasetId, config.n ?? 120, config.seed);
  const X = dataset.X;
  const Y = dataset.Y;
  const snapshotInterval = config.snapshotInterval ?? Math.max(1, Math.floor(config.steps / 12));

  const build = (width: number) =>
    createMlp({
      widths: [dataset.inputDim, ...Array(Math.max(1, config.depth - 1)).fill(width), dataset.classes],
      activation: config.activation,
      outputActivation: 'linear',
      Cw: config.Cw,
      Cb: config.Cb,
      seed: config.seed,
    });

  const hiddenLayerIndex = 0;
  const optimizer: OptimizerId = config.optimizer ?? 'gd';

  const makeRecorder = (net: Mlp, h0: number[][], theta0: number[][]) => {
    const snapshots: RepresentationSnapshot[] = [];
    const record = (step: number) => {
      const h = hiddenActivations(net, X, hiddenLayerIndex + 1);
      const proj = pca(h, 2);
      const predictions = X.map((x) => forward(net, x).output);
      let correct = 0;
      predictions.forEach((p, i) => {
        const argmax = p.indexOf(Math.max(...p));
        if (argmax === dataset.labels[i]) correct++;
      });
      snapshots.push({
        step,
        loss: mse(net, X, Y),
        accuracy: correct / X.length,
        fisher: fisherRatio(h, dataset.labels),
        drift: featureDrift(h0, h),
        kernelDriftValue: kernelDrift(theta0, empiricalNtk(net, X.slice(0, 12))),
        pcaExplained: proj.explainedRatio[0] + (proj.explainedRatio[1] ?? 0),
        projection: proj.projected.map((p, i) => ({ x: p[0], y: p[1] ?? 0, label: dataset.labels[i] })),
      });
    };
    return { snapshots, record };
  };

  /** The synchronous version, used for the width comparison. */
  const runToCompletion = (width: number) => {
    const net = build(width);
    const h0 = hiddenActivations(net, X, hiddenLayerIndex + 1);
    const theta0 = empiricalNtk(net, X.slice(0, 12));
    const { snapshots, record } = makeRecorder(net, h0, theta0);
    record(0);
    const optState = {
      velocity: new Array(net.parameterCount).fill(0),
      m: new Array(net.parameterCount).fill(0),
      v: new Array(net.parameterCount).fill(0),
      t: 0,
    };
    for (let s = 1; s <= config.steps; s++) {
      const info = optimizerStep(net, X, Y, { optimizer, learningRate: config.learningRate }, optState);
      if (s % snapshotInterval === 0 || s === config.steps || info.diverged) record(s);
      if (info.diverged) break;
    }
    return { snapshots, net, h0 };
  };

  // The main run is driven step by step so the interface can pause it.
  const net = build(config.width);
  const h0 = hiddenActivations(net, X, hiddenLayerIndex + 1);
  const theta0 = empiricalNtk(net, X.slice(0, 12));
  const { snapshots, record } = makeRecorder(net, h0, theta0);
  record(0);
  const optState = {
    velocity: new Array(net.parameterCount).fill(0),
    m: new Array(net.parameterCount).fill(0),
    v: new Array(net.parameterCount).fill(0),
    t: 0,
  };
  let lastStep = 0;
  for (let s = 1; s <= config.steps; s++) {
    const info = optimizerStep(net, X, Y, { optimizer, learningRate: config.learningRate }, optState);
    lastStep = s;
    if (s % snapshotInterval === 0 || s === config.steps || info.diverged) {
      record(s);
      yield {
        step: s,
        totalSteps: config.steps,
        dataset,
        snapshots: snapshots.slice(),
        net,
        h0,
        layers: net.layers.length,
        widthDrift: [],
        finalActivationStats: [],
        notes: [],
        done: false,
      };
    }
    if (info.diverged) break;
  }

  // The width comparison needs three further complete runs.
  const widthDrift = [8, 32, 128].map((w) => {
    const r = runToCompletion(w);
    const last = r.snapshots[r.snapshots.length - 1];
    return { width: w, finalDrift: last.drift, finalFisher: last.fisher, finalLoss: last.loss, accuracy: last.accuracy };
  });

  const finalActivationStats: Array<{ layer: number; meanSquare: number }> = [];
  for (let l = 0; l < net.layers.length; l++) {
    let s = 0;
    let count = 0;
    for (const x of X) {
      for (const v of forward(net, x).preactivations[l]) {
        s += v * v;
        count++;
      }
    }
    finalActivationStats.push({ layer: l + 1, meanSquare: s / count });
  }

  yield {
    step: lastStep,
    totalSteps: config.steps,
    dataset,
    snapshots,
    net,
    h0,
    layers: net.layers.length,
    widthDrift,
    finalActivationStats,
    notes: [
      `Trained with full-batch ${optimizer.toUpperCase() === 'GD' ? 'gradient descent' : optimizer}, learning rate η = ${config.learningRate}, ${config.steps} steps, seed ${config.seed}.`,
      'Loss is mean squared error against one-hot labels; accuracy is the argmax agreement with the true class.',
      'Feature drift is ‖h(t) − h(0)‖/‖h(0)‖ over all samples of the chosen hidden layer, measured in the full hidden space (not in the PCA plane).',
      'The 2-D view uses principal component analysis of the hidden activations: it preserves the largest-variance directions only, so classes that overlap in the projection may still be linearly separable in the full space.',
      'The sample standard deviation of the Fisher ratio is not reported because it is a deterministic function of the weights at each snapshot; treat the trend, not the last digit.',
    ],
    done: true,
  };
}

/** Run the whole representation experiment to completion in one call. */
export function runRepresentation(config: RepresentationConfig): RepresentationResult {
  const gen = representationTraining(config);
  let last: RepresentationProgress | null = null;
  for (const value of gen) last = value;
  if (!last) throw new Error('representation training produced no result');
  return {
    dataset: last.dataset,
    snapshots: last.snapshots,
    layers: last.layers,
    widthDrift: last.widthDrift,
    finalActivationStats: last.finalActivationStats,
    notes: last.notes,
  };
}
