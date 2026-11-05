/**
 * Finite-width multilayer perceptrons: the *experimental* side of every laboratory.
 *
 * Conventions follow Chapter 2 and Chapter 4 of Roberts, Yaida & Hanin,
 * "The Principles of Deep Learning Theory" (arXiv:2106.10165):
 *
 *   z^(l) = W^(l) h^(l-1) + b^(l),   h^(l) = sigma(z^(l)),
 *   W_ij^(l) ~ N(0, C_W / n_{l-1}),  b_i^(l) ~ N(0, C_b),     (eq. (4.1), (4.2))
 *
 * so that C_W and C_b have exactly the meaning they carry in the kernel recursion
 * K^(l+1) = C_b + C_W g(K^(l)) used by the theory modules.
 *
 * Hidden layers use the chosen activation; the output layer is linear by default
 * (a standard read-out convention, and it keeps the loss landscape analysis in
 * Laboratory B exactly quadratic in the read-out weights).
 */

import { getActivation, type ActivationId } from './activations';

/** convenience alias so callers can pass activation ids without importing the registry */
export type ActivationLike = ActivationId;
import { Rng } from './rng';
import { checkPsd, symmetricEigen, zeros } from './linalg';

export type InitDistribution = 'gaussian' | 'uniform';

export interface LayerParams {
  /** W[i][j], i = output neuron of the layer, j = input neuron */
  W: number[][];
  b: number[];
}

export interface MlpConfig {
  /** layer widths [n_0, n_1, ..., n_L]; n_L is the output dimension */
  widths: number[];
  activation: ActivationId;
  /** 'linear' (default) or 'same' for the output layer */
  outputActivation?: 'linear' | 'same';
  distribution?: InitDistribution;
  /** rescaled weight variance C_W */
  Cw: number;
  /** bias variance C_b */
  Cb: number;
  seed: number;
}

export interface Mlp {
  config: Required<Omit<MlpConfig, 'outputActivation'>> & { outputActivation: 'linear' | 'same' };
  layers: LayerParams[];
  /** number of trainable parameters */
  parameterCount: number;
}

export interface ForwardResult {
  /** z^(l) for l = 1..L */
  preactivations: number[][];
  /** h^(l) for l = 1..L (the network output for a linear read-out) */
  activations: number[][];
  output: number[];
}

export interface LayerStats {
  layer: number;
  /** empirical mean of the preactivations over neurons and samples */
  mean: number;
  /** empirical variance of the preactivations over neurons and samples */
  variance: number;
  /** mean square preactivation, the finite-width estimate of K^(l) */
  meanSquare: number;
  /** mean square activation, the finite-width estimate of h^(l) statistics */
  activationMeanSquare: number;
  /** fraction of preactivations beyond 3 standard deviations of the layer mean */
  tailFraction: number;
}

export interface BatchStats {
  layers: LayerStats[];
  outputs: number[][];
  /** finite-width estimate of K^(l): per-layer mean square preactivation */
  kernelEstimate: number[];
  /** seed-to-seed detectable saturation: |mean| relative to sd */
  saturation: number[];
}

function assertPositiveInteger(v: number, name: string): void {
  if (!Number.isInteger(v) || v < 1) throw new Error(`${name} must be a positive integer, got ${v}`);
}

export function validateMlpConfig(config: MlpConfig): void {
  if (!config.widths || config.widths.length < 2) throw new Error('a network needs at least an input and an output layer');
  config.widths.forEach((w, i) => assertPositiveInteger(w, `widths[${i}]`));
  if (config.widths.length > 40) throw new Error('depth is limited to 40 layers to keep the browser responsive');
  for (const w of config.widths) {
    if (w > 1024) throw new Error('widths are limited to 1024 neurons per layer to keep the browser responsive');
  }
  if (!(config.Cw >= 0) || !Number.isFinite(config.Cw)) throw new Error(`C_W must be a finite non-negative number, got ${config.Cw}`);
  if (!(config.Cb >= 0) || !Number.isFinite(config.Cb)) throw new Error(`C_b must be a finite non-negative number, got ${config.Cb}`);
  if (!Number.isFinite(config.seed)) throw new Error('seed must be finite');
  if (config.Cw === 0) throw new Error('C_W = 0 gives a deterministically zero network, which cannot satisfy the criticality conditions');
}

export function createMlp(config: MlpConfig): Mlp {
  validateMlpConfig(config);
  const distribution = config.distribution ?? 'gaussian';
  const outputActivation = config.outputActivation ?? 'linear';
  const rng = new Rng(config.seed);
  const layers: LayerParams[] = [];
  let params = 0;
  for (let l = 0; l < config.widths.length - 1; l++) {
    const nIn = config.widths[l];
    const nOut = config.widths[l + 1];
    const sd = Math.sqrt(config.Cw / nIn);
    const W: number[][] = [];
    for (let i = 0; i < nOut; i++) {
      const row = new Array<number>(nIn).fill(0);
      for (let j = 0; j < nIn; j++) {
        row[j] = distribution === 'gaussian' ? rng.normalScaled(0, sd) : rng.uniformUnitVariance(sd);
      }
      W.push(row);
    }
    const b: number[] = [];
    const bsd = Math.sqrt(config.Cb);
    for (let i = 0; i < nOut; i++) {
      b.push(config.Cb === 0 ? 0 : distribution === 'gaussian' ? rng.normalScaled(0, bsd) : rng.uniformUnitVariance(bsd));
    }
    layers.push({ W, b });
    params += nOut * nIn + nOut;
  }
  return {
    config: { ...config, distribution, outputActivation },
    layers,
    parameterCount: params,
  };
}

function activationForLayer(net: Mlp, layerIndex: number) {
  const act = getActivation(net.config.activation);
  const isOutput = layerIndex === net.layers.length - 1;
  if (isOutput && net.config.outputActivation === 'linear') {
    return { f: (z: number) => z, df: () => 1, spec: act };
  }
  return { f: act.f, df: act.df, spec: act };
}

export function forward(net: Mlp, x: number[]): ForwardResult {
  if (x.length !== net.config.widths[0]) {
    throw new Error(`input has ${x.length} features but the network expects ${net.config.widths[0]}`);
  }
  const preactivations: number[][] = [];
  const activations: number[][] = [];
  let h = x;
  for (let l = 0; l < net.layers.length; l++) {
    const { W, b } = net.layers[l];
    const z = new Array<number>(W.length).fill(0);
    for (let i = 0; i < W.length; i++) {
      let s = b[i];
      const row = W[i];
      for (let j = 0; j < row.length; j++) s += row[j] * h[j];
      z[i] = s;
    }
    const act = activationForLayer(net, l);
    const out = z.map(act.f);
    preactivations.push(z);
    activations.push(out);
    h = out;
  }
  return { preactivations, activations, output: activations[activations.length - 1] };
}

export function predict(net: Mlp, X: number[][]): number[][] {
  return X.map((x) => forward(net, x).output);
}

/** Mean squared error, the loss used throughout the app (book eq. (7.2)). */
export function mse(net: Mlp, X: number[][], Y: number[][]): number {
  assertBatchShapes(X, Y);
  let s = 0;
  let count = 0;
  for (let m = 0; m < X.length; m++) {
    const out = forward(net, X[m]).output;
    for (let i = 0; i < out.length; i++) {
      const d = out[i] - Y[m][i];
      s += d * d;
      count++;
    }
  }
  return count === 0 ? 0 : s / count;
}

export function assertBatchShapes(X: number[][], Y: number[][]): void {
  if (X.length === 0) throw new Error('empty batch');
  if (X.length !== Y.length) throw new Error(`batch size mismatch: ${X.length} inputs vs ${Y.length} targets`);
}

function meanOf(xs: number[]): number {
  let s = 0;
  for (const v of xs) s += v;
  return xs.length ? s / xs.length : Number.NaN;
}

function varianceOf(xs: number[]): number {
  if (xs.length < 2) return Number.NaN;
  const m = meanOf(xs);
  let s = 0;
  for (const v of xs) s += (v - m) * (v - m);
  return s / (xs.length - 1);
}

/**
 * Layer-wise statistics over a batch of inputs: this is what the "signal
 * propagation" panels of Laboratories A and C display.
 */
export function batchStats(net: Mlp, X: number[][]): BatchStats {
  const depth = net.layers.length;
  const zAll: number[][] = Array.from({ length: depth }, () => []);
  const hAll: number[][] = Array.from({ length: depth }, () => []);
  const outputs: number[][] = [];
  for (const x of X) {
    const r = forward(net, x);
    outputs.push(r.output);
    for (let l = 0; l < depth; l++) {
      zAll[l].push(...r.preactivations[l]);
      hAll[l].push(...r.activations[l]);
    }
  }
  const layers: LayerStats[] = [];
  for (let l = 0; l < depth; l++) {
    const zs = zAll[l];
    const hs = hAll[l];
    const m = meanOf(zs);
    const v = varianceOf(zs);
    const sd = Math.sqrt(v);
    const tail = sd > 0 ? zs.filter((z) => Math.abs(z - m) > 3 * sd).length / zs.length : 0;
    layers.push({
      layer: l + 1,
      mean: m,
      variance: v,
      meanSquare: meanOf(zs.map((z) => z * z)),
      activationMeanSquare: meanOf(hs.map((h) => h * h)),
      tailFraction: tail,
    });
  }
  return {
    layers,
    outputs,
    kernelEstimate: layers.map((s) => s.meanSquare),
    saturation: layers.map((s) => (s.variance > 0 ? Math.abs(s.mean) / Math.sqrt(s.variance) : 0)),
  };
}

export interface Gradients {
  grads: LayerParams[];
  /** L2 norm of the gradient of the loss with respect to each layer's parameters */
  layerGradNorm: number[];
  /** per-layer norm counting only the weight matrices */
  layerWeightGradNorm: number[];
  /**
   * Root-mean-square of dL/dz^(l) over neurons and samples — the backpropagated
   * error signal itself. This is the quantity that vanishes or explodes with depth:
   * at criticality the per-layer factor is sqrt(C_W E[sigma'^2]) in RMS norm.
   */
  layerPreactivationGradRms: number[];
  loss: number;
}

/**
 * Analytic backpropagation for the MSE loss
 *   L = (1/(M d_out)) sum_{m,i} (f_i(x_m) - y_{m,i})^2 .
 * Validated against central finite differences in the test suite.
 */
export function backpropMse(net: Mlp, X: number[][], Y: number[][]): Gradients {
  assertBatchShapes(X, Y);
  const depth = net.layers.length;
  const outDim = net.config.widths[depth];
  if (Y[0].length !== outDim) throw new Error(`targets have ${Y[0].length} components but the network outputs ${outDim}`);
  const gradW = net.layers.map((L) => zeros(L.W.length, L.W[0].length));
  const gradB = net.layers.map((L) => new Array<number>(L.b.length).fill(0));
  const deltaSq = net.layers.map((L) => new Array<number>(L.b.length).fill(0));
  let loss = 0;
  const scale = 1 / (X.length * outDim);

  for (let m = 0; m < X.length; m++) {
    const { preactivations, activations } = forward(net, X[m]);
    const out = activations[depth - 1];
    // delta at the output layer
    let delta: number[] = new Array<number>(outDim).fill(0);
    for (let i = 0; i < outDim; i++) {
      const diff = out[i] - Y[m][i];
      loss += diff * diff;
      const act = activationForLayer(net, depth - 1);
      delta[i] = 2 * scale * diff * act.df(preactivations[depth - 1][i]);
    }
    for (let l = depth - 1; l >= 0; l--) {
      const hPrev = l === 0 ? X[m] : activations[l - 1];
      for (let i = 0; i < delta.length; i++) {
        const d = delta[i];
        deltaSq[l][i] += d * d;
        gradB[l][i] += d;
        const row = gradW[l][i];
        for (let j = 0; j < row.length; j++) row[j] += d * hPrev[j];
      }
      if (l > 0) {
        const act = activationForLayer(net, l - 1);
        const prev = new Array<number>(net.layers[l - 1].b.length).fill(0);
        for (let j = 0; j < prev.length; j++) {
          let s = 0;
          for (let i = 0; i < net.layers[l].W.length; i++) s += net.layers[l].W[i][j] * delta[i];
          prev[j] = s * act.df(preactivations[l - 1][j]);
        }
        delta = prev;
      }
    }
  }

  const layerGradNorm: number[] = [];
  const layerWeightGradNorm: number[] = [];
  for (let l = 0; l < depth; l++) {
    let sW = 0;
    for (const row of gradW[l]) for (const v of row) sW += v * v;
    let sB = 0;
    for (const v of gradB[l]) sB += v * v;
    layerWeightGradNorm.push(Math.sqrt(sW));
    layerGradNorm.push(Math.sqrt(sW + sB));
  }
  const layerPreactivationGradRms = deltaSq.map((row) => {
    let s = 0;
    for (const v of row) s += v;
    return Math.sqrt(s / (row.length * X.length));
  });
  return {
    grads: gradW.map((W, l) => ({ W, b: gradB[l] })),
    layerGradNorm,
    layerWeightGradNorm,
    layerPreactivationGradRms,
    loss: loss / (X.length * outDim),
  };
}

/** Mean per-layer gradient norm over a set of seeds (used by Laboratory A). */
export function gradientNormProfile(net: Mlp, X: number[][], Y: number[][]): number[] {
  return backpropMse(net, X, Y).layerGradNorm;
}

export function flattenParams(net: Mlp): number[] {
  const out: number[] = [];
  for (const { W, b } of net.layers) {
    for (const row of W) out.push(...row);
    out.push(...b);
  }
  return out;
}

export function unflattenParams(net: Mlp, vec: number[]): void {
  if (vec.length !== net.parameterCount) {
    throw new Error(`parameter vector has length ${vec.length}, expected ${net.parameterCount}`);
  }
  let k = 0;
  for (const { W, b } of net.layers) {
    for (let i = 0; i < W.length; i++) {
      for (let j = 0; j < W[i].length; j++) W[i][j] = vec[k++];
    }
    for (let i = 0; i < b.length; i++) b[i] = vec[k++];
  }
}

export function cloneMlp(net: Mlp): Mlp {
  return {
    config: { ...net.config },
    layers: net.layers.map(({ W, b }) => ({ W: W.map((row) => row.slice()), b: b.slice() })),
    parameterCount: net.parameterCount,
  };
}

/**
 * Jacobian of the network output with respect to all parameters, evaluated at a
 * batch of inputs. Row (m, i) corresponds to output component i on input m;
 * columns are the flattened parameters. Exact analytic derivatives.
 */
export function outputJacobian(net: Mlp, X: number[][]): number[][] {
  const depth = net.layers.length;
  const outDim = net.config.widths[depth];
  const rows: number[][] = [];
  for (let m = 0; m < X.length; m++) {
    const { preactivations, activations } = forward(net, X[m]);
    for (let i = 0; i < outDim; i++) {
      const g = new Array<number>(net.parameterCount).fill(0);
      // Backpropagate the seed vector e_i through the linearized network.
      // Invariant: `delta` is d(output_i)/d(z^(l)) — the derivative with respect to
      // the PREACTIVATION of layer l — so the activation derivative is carried by the
      // propagation step, never applied twice.
      let delta = new Array<number>(outDim).fill(0);
      delta[i] = 1;
      for (let l = depth - 1; l >= 0; l--) {
        const hPrev = l === 0 ? X[m] : activations[l - 1];
        let offset = 0;
        for (let ll = 0; ll < l; ll++) {
          offset += net.layers[ll].W.length * net.layers[ll].W[0].length + net.layers[ll].b.length;
        }
        for (let k = 0; k < delta.length; k++) {
          for (let j = 0; j < hPrev.length; j++) g[offset + k * hPrev.length + j] += delta[k] * hPrev[j];
        }
        const bOffset = offset + net.layers[l].W.length * net.layers[l].W[0].length;
        for (let k = 0; k < delta.length; k++) g[bOffset + k] += delta[k];
        if (l > 0) {
          const prevAct = activationForLayer(net, l - 1);
          const prev = new Array<number>(net.layers[l - 1].b.length).fill(0);
          for (let j = 0; j < prev.length; j++) {
            let s = 0;
            for (let k = 0; k < net.layers[l].W.length; k++) s += net.layers[l].W[k][j] * delta[k];
            prev[j] = s * prevAct.df(preactivations[l - 1][j]);
          }
          delta = prev;
        }
      }
      rows.push(g);
    }
  }
  return rows;
}

/**
 * Empirical neural tangent kernel at initialization (book eq. (7.17)):
 *   Theta_{mm'} = sum_parameters df(x_m)/dtheta . df(x_{m'})/dtheta
 * For a multi-output network the sum runs over output components as well.
 */
export function empiricalNtk(net: Mlp, X: number[][]): number[][] {
  const J = outputJacobian(net, X);
  const M = X.length;
  const outDim = net.config.widths[net.layers.length];
  const theta: number[][] = Array.from({ length: M }, () => new Array<number>(M).fill(0));
  for (let m = 0; m < M; m++) {
    for (let mp = 0; mp < M; mp++) {
      let s = 0;
      for (let i = 0; i < outDim; i++) {
        const a = J[m * outDim + i];
        const b = J[mp * outDim + i];
        for (let k = 0; k < a.length; k++) s += a[k] * b[k];
      }
      theta[m][mp] = s;
    }
  }
  return theta;
}

export interface NtkDiagnostics {
  symmetryDefect: number;
  psd: ReturnType<typeof checkPsd>;
  /** spectrum of the empirical NTK */
  eigenvalues: number[];
}

export function ntkDiagnostics(theta: number[][]): NtkDiagnostics {
  const n = theta.length;
  let symmetryDefect = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) symmetryDefect = Math.max(symmetryDefect, Math.abs(theta[i][j] - theta[j][i]));
  const { values } = symmetricEigen(theta);
  return { symmetryDefect, psd: checkPsd(theta), eigenvalues: values };
}

/**
 * Inter-layer neuron correlation: the average (over ordered pairs of distinct
 * neurons in a layer) of the correlation coefficient of preactivations *within a
 * single network instantiation*. This vanishes in the infinite-width limit
 * (Chapters 4-5) and grows with depth/width; Laboratory C measures it.
 */
export function intraLayerCorrelation(net: Mlp, X: number[][]): number[] {
  const depth = net.layers.length;
  const out: number[] = [];
  for (let l = 0; l < depth; l++) {
    const zs = X.map((x) => forward(net, x).preactivations[l]);
    const n = zs[0].length;
    if (n < 2) {
      out.push(0);
      continue;
    }
    const series = Array.from({ length: n }, (_, j) => zs.map((row) => row[j]));
    let total = 0;
    let pairs = 0;
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        total += Math.abs(pearson(series[a], series[b]));
        pairs++;
      }
    }
    out.push(pairs === 0 ? 0 : total / pairs);
  }
  return out;
}

function pearson(a: number[], b: number[]): number {
  const ma = meanOf(a);
  const mb = meanOf(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

export { meanOf, varianceOf };
