/**
 * Laboratory B: genuine two-parameter objectives.
 *
 * Two slices of a real one-hidden-layer network trained on a real dataset are
 * exposed to the UI:
 *
 *  readout slice : vary two read-out weights of a network whose hidden layer is
 *                  frozen at its initialization. The loss is then exactly
 *                  L(v) = (1/M) ||Phi v - Y||^2 with Phi the frozen feature matrix,
 *                  i.e. a quadratic form -- convex, and the *exact* object that
 *                  Chapter 10 ("Kernel Learning") analyzes in the infinite-width limit.
 *
 *  hidden slice  : vary two weights of the first hidden layer while training only
 *                  those two. The loss is genuinely non-convex; gradients come from
 *                  the same analytic backpropagation used to train networks, so the
 *                  trajectory is never faked.
 *
 * The displayed surface is produced by evaluating the real loss on a grid.
 */

import { matVec, symmetricEigen, transpose, zeros } from './linalg';
import { backpropMse, createMlp, forward, mse, type Mlp, type ActivationLike } from './mlp';

export type SliceKind = 'readout' | 'hidden';

export interface ObjectiveQuadratic {
  /** eigenvalues of the full read-out Hessian 2/M * Phi^T Phi */
  hessianEigenvalues: number[];
  /** stability threshold eta < 2/lambda_max for gradient descent */
  lrThreshold: number;
  vStar: number[];
  minLoss: number;
  features: number[][];
  /** starts of the read-out weights at initialization */
  v0: number[];
}

export interface Objective2D {
  kind: SliceKind;
  axisLabels: [string, string];
  bounds: { a: [number, number]; b: [number, number] };
  start: [number, number];
  valueAt: (a: number, b: number) => number;
  gradAt: (a: number, b: number) => [number, number];
  quadratic?: ObjectiveQuadratic;
}

export interface BuildObjectiveOptions {
  kind?: SliceKind;
  hidden?: number;
  activationId?: ActivationLike;
  Cw?: number;
  Cb?: number;
  seed?: number;
  span?: number;
  readoutIndex?: [number, number];
}

/** Frozen-feature network: hidden layer at initialization, linear read-out. */
export function buildFeatureNetwork(
  X: number[][],
  { hidden = 8, activationId = 'tanh', Cw = 1, Cb = 0, seed = 11, readoutIndex = [0, 1] }: BuildObjectiveOptions = {},
): { net: Mlp; features: number[][]; readoutIndex: [number, number] } {
  if (X.length === 0) throw new Error('need a non-empty dataset');
  const inputDim = X[0].length;
  if (hidden < Math.max(readoutIndex[0], readoutIndex[1]) + 1) throw new Error('readoutIndex exceeds the hidden width');
  const net = createMlp({ widths: [inputDim, hidden, 1], activation: activationId, outputActivation: 'linear', Cw, Cb, seed });
  const features = X.map((x) => forward(net, x).activations[0].slice());
  return { net, features, readoutIndex };
}

function readoutWeights(net: Mlp): number[] {
  const layer = net.layers[net.layers.length - 1];
  return layer.W[0].slice();
}

/** Exact quadratic read-out loss, mean over samples. */
export function readoutLoss(features: number[][], v: number[], Y: number[][]): number {
  const pred = matVec(features, v);
  let s = 0;
  for (let i = 0; i < pred.length; i++) {
    const d = pred[i] - Y[i][0];
    s += d * d;
  }
  return s / pred.length;
}

/** Exact gradient of the read-out loss: (2/M) Phi^T (Phi v - Y). */
export function readoutGrad(features: number[][], v: number[], Y: number[][]): number[] {
  const pred = matVec(features, v);
  const residual = pred.map((p, i) => (2 * (p - Y[i][0])) / features.length);
  return matVec(transpose(features), residual);
}

export interface ReadoutAnalysis {
  hessianEigenvalues: number[];
  lrThreshold: number;
  vStar: number[];
  minLoss: number;
  lossPrediction: (t: number, lr: number, v0: number[]) => number;
}

/** Closed-form least-squares analysis of the quadratic read-out problem. */
export function analyzeReadout(features: number[][], Y: number[][]): ReadoutAnalysis {
  const M = features.length;
  const n = features[0].length;
  const G = zeros(n, n);
  for (let i = 0; i < M; i++) {
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) G[a][b] += ((2 / M) as number) * features[i][a] * features[i][b];
    }
  }
  const { values, vectors } = symmetricEigen(G);
  const lrThreshold = 2 / Math.max(values[0], 1e-12);
  const rhs = matVec(transpose(features), Y.map((y) => y[0]));
  const vStar = new Array<number>(n).fill(0);
  for (let k = 0; k < n; k++) {
    const u = vectors[k];
    let num = 0;
    for (let a = 0; a < n; a++) num += u[a] * rhs[a];
    const den = (M / 2) * values[k];
    const coef = Math.abs(den) > 1e-12 ? num / den : 0;
    for (let a = 0; a < n; a++) vStar[a] += coef * u[a];
  }
  const minLoss = readoutLoss(features, vStar, Y);
  const lossPrediction = (t: number, lr: number, v0: number[]) => {
    let s = 0;
    for (let k = 0; k < n; k++) {
      const u = vectors[k];
      let proj = 0;
      for (let a = 0; a < n; a++) proj += u[a] * (v0[a] - vStar[a]);
      s += (values[k] / 2) * proj * proj * Math.pow(1 - lr * values[k], 2 * t);
    }
    return minLoss + s;
  };
  return { hessianEigenvalues: values, lrThreshold, vStar, minLoss, lossPrediction };
}

/** Build the two-parameter objective. */
export function buildObjective(X: number[][], Y: number[][], options: BuildObjectiveOptions = {}): Objective2D {
  const { kind = 'readout', hidden = 8, activationId = 'tanh', Cw = 1, Cb = 0, seed = 11, span = 2.5, readoutIndex = [0, 1] } =
    options;
  if (X.length === 0) throw new Error('objective requires a non-empty dataset');
  if (!(span > 0)) throw new Error('span must be positive');
  const { net, features } = buildFeatureNetwork(X, { hidden, activationId, Cw, Cb, seed, readoutIndex });
  const [ia, ib] = readoutIndex;

  if (kind === 'readout') {
    const v0 = readoutWeights(net);
    const analysis = analyzeReadout(features, Y);
    const valueAt = (a: number, b: number) => {
      const v = v0.slice();
      v[ia] = a;
      v[ib] = b;
      return readoutLoss(features, v, Y);
    };
    const gradAt = (a: number, b: number): [number, number] => {
      const v = v0.slice();
      v[ia] = a;
      v[ib] = b;
      const g = readoutGrad(features, v, Y);
      return [g[ia], g[ib]];
    };
    const radius =
      1.2 * Math.max(span, Math.abs(v0[ia] - analysis.vStar[ia]), Math.abs(v0[ib] - analysis.vStar[ib]), 0.5);
    const centre: [number, number] = [(v0[ia] + analysis.vStar[ia]) / 2, (v0[ib] + analysis.vStar[ib]) / 2];
    return {
      kind,
      axisLabels: [`v_{${ia + 1}}`, `v_{${ib + 1}}`],
      bounds: { a: [centre[0] - radius, centre[0] + radius], b: [centre[1] - radius, centre[1] + radius] },
      start: [v0[ia], v0[ib]],
      valueAt,
      gradAt,
      quadratic: {
        hessianEigenvalues: analysis.hessianEigenvalues,
        lrThreshold: analysis.lrThreshold,
        vStar: analysis.vStar,
        minLoss: analysis.minLoss,
        features,
        v0,
      },
    };
  }

  // hidden-parameter slice: two weights of neuron 1 in layer 1, bias and read-out frozen
  const firstLayer = net.layers[0].W;
  const a0 = firstLayer[0][0];
  const b0 = firstLayer[0][1];
  const valueAt = (a: number, b: number) => {
    firstLayer[0][0] = a;
    firstLayer[0][1] = b;
    return mse(net, X, Y);
  };
  const gradAt = (a: number, b: number): [number, number] => {
    firstLayer[0][0] = a;
    firstLayer[0][1] = b;
    const { grads } = backpropMse(net, X, Y);
    return [grads[0].W[0][0], grads[0].W[0][1]];
  };
  const radius = Math.max(span, 2 * Math.abs(a0), 2 * Math.abs(b0), 1);
  return {
    kind,
    axisLabels: ['W^{(1)}_{11}', 'W^{(1)}_{12}'],
    bounds: { a: [a0 - radius, a0 + radius], b: [b0 - radius, b0 + radius] },
    start: [a0, b0],
    valueAt,
    gradAt,
  };
}

export interface Surface {
  a: number[];
  b: number[];
  /** values[j][i] = loss at (a[i], b[j]) */
  values: number[][];
  min: number;
  max: number;
}

/** Evaluate the real objective on a grid (contour and 3D surface views). */
export function evaluateSurface(obj: Objective2D, steps = 61, bounds?: Objective2D['bounds']): Surface {
  if (!Number.isInteger(steps) || steps < 5 || steps > 201) throw new Error('steps must be an integer between 5 and 201');
  const B = bounds ?? obj.bounds;
  const a = Array.from({ length: steps }, (_, i) => B.a[0] + ((B.a[1] - B.a[0]) * i) / (steps - 1));
  const b = Array.from({ length: steps }, (_, j) => B.b[0] + ((B.b[1] - B.b[0]) * j) / (steps - 1));
  const values: number[][] = [];
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < steps; j++) {
    const row = new Array<number>(steps).fill(0);
    for (let i = 0; i < steps; i++) {
      const v = obj.valueAt(a[i], b[j]);
      row[i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    values.push(row);
  }
  return { a, b, values, min, max };
}

export interface TrajectoryPoint {
  step: number;
  a: number;
  b: number;
  loss: number;
}

export interface TrajectoryOptions {
  start?: [number, number];
  learningRate: number;
  steps: number;
  /** 'slice' updates only the two displayed parameters; 'full' updates the whole read-out */
  mode?: 'full' | 'slice';
  momentum?: number;
  dataset?: { X: number[][]; Y: number[][] };
}

export interface TrajectoryResult {
  points: TrajectoryPoint[];
  diverged: boolean;
}

/**
 * Real gradient descent on the real loss. In 'slice' mode only the two displayed
 * parameters move, so the drawn path is the exact trajectory of the 2-D restricted
 * dynamics. In 'full' mode (read-out slice only) every read-out weight moves and the
 * plotted path is the projection of the true trajectory — which is why the projected
 * path can leave the direction of steepest descent of the displayed slice.
 */
export function runTrajectory(obj: Objective2D, options: TrajectoryOptions): TrajectoryResult {
  const { learningRate: lr, steps, mode = 'slice' } = options;
  if (!(lr > 0)) throw new Error('learning rate must be positive');
  if (!Number.isInteger(steps) || steps < 1 || steps > 5000) throw new Error('steps must be an integer between 1 and 5000');
  const mu = options.momentum ?? 0;
  const start = options.start ?? obj.start;
  const points: TrajectoryPoint[] = [];

  if (mode === 'full') {
    const q = obj.quadratic;
    const ds = options.dataset;
    if (!q || !ds) throw new Error("mode 'full' requires the quadratic read-out objective and the dataset");
    // lift the slice point into the full read-out vector, with all untrained
    // components at zero, and record the true loss there
    let v = q.v0.map(() => 0);
    v[0] = start[0];
    v[1] = start[1];
    const velocity = new Array<number>(v.length).fill(0);
    points.push({ step: 0, a: v[0], b: v[1], loss: readoutLoss(q.features, v, ds.Y) });
    for (let s = 1; s <= steps; s++) {
      const g = readoutGrad(q.features, v, ds.Y);
      for (let i = 0; i < v.length; i++) {
        if (mu > 0) {
          velocity[i] = mu * velocity[i] - lr * g[i];
          v[i] += velocity[i];
        } else {
          v[i] -= lr * g[i];
        }
      }
      const loss = readoutLoss(q.features, v, ds.Y);
      points.push({ step: s, a: v[0], b: v[1], loss });
      if (!Number.isFinite(loss) || loss > 1e12) return { points, diverged: true };
    }
    return { points, diverged: false };
  }

  let a = start[0];
  let b = start[1];
  let va = 0;
  let vb = 0;
  points.push({ step: 0, a, b, loss: obj.valueAt(a, b) });
  for (let s = 1; s <= steps; s++) {
    const [ga, gb] = obj.gradAt(a, b);
    if (!Number.isFinite(ga) || !Number.isFinite(gb)) return { points, diverged: true };
    if (mu > 0) {
      va = mu * va - lr * ga;
      vb = mu * vb - lr * gb;
      a += va;
      b += vb;
    } else {
      a -= lr * ga;
      b -= lr * gb;
    }
    const loss = obj.valueAt(a, b);
    points.push({ step: s, a, b, loss });
    if (!Number.isFinite(loss) || loss > 1e12 || Math.abs(a) > 1e6 || Math.abs(b) > 1e6) {
      return { points, diverged: true };
    }
  }
  return { points, diverged: false };
}

/** Hessian of the objective at a point, by central finite differences of the real loss. */
export function numericalHessian2D(obj: Objective2D, a: number, b: number, h = 1e-4): number[][] {
  const faa = (obj.valueAt(a + h, b) - 2 * obj.valueAt(a, b) + obj.valueAt(a - h, b)) / (h * h);
  const fbb = (obj.valueAt(a, b + h) - 2 * obj.valueAt(a, b) + obj.valueAt(a, b - h)) / (h * h);
  const fab =
    (obj.valueAt(a + h, b + h) - obj.valueAt(a + h, b - h) - obj.valueAt(a - h, b + h) + obj.valueAt(a - h, b - h)) /
    (4 * h * h);
  return [
    [faa, fab],
    [fab, fbb],
  ];
}
