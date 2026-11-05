/**
 * Laboratory E: measurable statements about representation learning.
 *
 * The textbook's Chapter 11 introduces the differential of the neural tangent
 * kernel (dNTK) as the object that quantifies how much the *representation* moves
 * during training, and shows that both the dNTK and feature learning vanish at
 * infinite width (Chapters 6 and 10: "no representation learning" in the
 * infinite-width limit). Rather than asserting that statement, this module
 * *measures* three finite-width quantities and lets the student watch them change
 * as the width grows:
 *
 *   featureDrift   || h(x; t) - h(x; 0) || / || h(x; 0) ||
 *   kernelDrift    || Theta(t) - Theta(0) ||_F / || Theta(0) ||_F
 *   fisherRatio    between-class scatter / within-class scatter of hidden features
 *
 * All three are computed from real forward passes of a real network whose weights
 * were changed by real gradient descent.
 */

import { gram, matVec, symmetricEigen } from './linalg';
import { forward, type Mlp } from './mlp';

/** Hidden activations at a chosen layer (1-indexed) for every input. */
export function hiddenActivations(net: Mlp, X: number[][], layer: number): number[][] {
  if (layer < 1 || layer > net.layers.length) throw new Error(`layer ${layer} outside 1..${net.layers.length}`);
  return X.map((x) => forward(net, x).activations[layer - 1].slice());
}

export interface PcaResult {
  /** projected coordinates, shape (n, k) */
  projected: number[][];
  /** principal directions, shape (k, d) */
  components: number[][];
  /** variance explained by each retained component */
  explained: number[];
  /** fraction of total variance explained by each component */
  explainedRatio: number[];
  /** mean of the input features */
  mean: number[];
}

/**
 * Principal component analysis of a feature matrix, computed from the eigende-
 * composition of the covariance matrix (no randomized approximation).
 * PCA is a *linear* projection: it preserves global variance directions only, and
 * overlapped classes in the projection may still be separable by a non-linear
 * read-out. The UI states this limitation next to the plot.
 */
export function pca(rows: number[][], k = 2): PcaResult {
  if (rows.length < 2) throw new Error('PCA needs at least two samples');
  const d = rows[0].length;
  if (k < 1 || k > d) throw new Error(`k must be between 1 and ${d}`);
  const mean = new Array<number>(d).fill(0);
  for (const row of rows) for (let j = 0; j < d; j++) mean[j] += row[j] / rows.length;
  const centred = rows.map((row) => row.map((v, j) => v - mean[j]));
  const cov: number[][] = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  for (const row of centred) {
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) cov[i][j] += (row[i] * row[j]) / Math.max(1, rows.length - 1);
    }
  }
  const { values, vectors } = symmetricEigen(cov);
  const components = vectors.slice(0, k);
  const total = values.reduce((a, b) => a + Math.max(0, b), 0);
  const projected = centred.map((row) => components.map((u) => u.reduce((s, uu, j) => s + uu * row[j], 0)));
  return {
    projected,
    components,
    explained: values.slice(0, k).map((v) => Math.max(0, v)),
    explainedRatio: values.slice(0, k).map((v) => (total > 0 ? Math.max(0, v) / total : 0)),
    mean,
  };
}

/**
 * Fisher ratio tr(S_B)/tr(S_W) of hidden features for a labelled dataset: a
 * scale-free measure of class separation. Values >> 1 mean the classes are well
 * separated in the hidden representation.
 */
export function fisherRatio(features: number[][], labels: number[]): number {
  if (features.length !== labels.length) throw new Error('feature/label length mismatch');
  const classes = Array.from(new Set(labels)).sort((a, b) => a - b);
  const d = features[0].length;
  const globalMean = new Array<number>(d).fill(0);
  for (const row of features) for (let j = 0; j < d; j++) globalMean[j] += row[j] / features.length;
  const classMean = new Map<number, number[]>();
  const classCount = new Map<number, number>();
  for (const c of classes) {
    classMean.set(c, new Array<number>(d).fill(0));
    classCount.set(c, 0);
  }
  for (let i = 0; i < features.length; i++) {
    const c = labels[i];
    const m = classMean.get(c)!;
    for (let j = 0; j < d; j++) m[j] += features[i][j];
    classCount.set(c, classCount.get(c)! + 1);
  }
  for (const c of classes) {
    const m = classMean.get(c)!;
    const n = classCount.get(c)!;
    for (let j = 0; j < d; j++) m[j] /= n;
  }
  let sb = 0;
  for (const c of classes) {
    const m = classMean.get(c)!;
    const n = classCount.get(c)!;
    for (let j = 0; j < d; j++) sb += n * (m[j] - globalMean[j]) ** 2;
  }
  let sw = 0;
  for (let i = 0; i < features.length; i++) {
    const m = classMean.get(labels[i])!;
    for (let j = 0; j < d; j++) sw += (features[i][j] - m[j]) ** 2;
  }
  return sw > 0 ? sb / sw : Number.POSITIVE_INFINITY;
}

/** Relative movement of hidden features between two parameter settings. */
export function featureDrift(before: number[][], after: number[][]): number {
  if (before.length !== after.length) throw new Error('shape mismatch');
  let num = 0;
  let den = 0;
  for (let i = 0; i < before.length; i++) {
    for (let j = 0; j < before[i].length; j++) {
      num += (after[i][j] - before[i][j]) ** 2;
      den += before[i][j] ** 2;
    }
  }
  return den > 0 ? Math.sqrt(num / den) : Number.NaN;
}

/**
 * Fractional Frobenius drift of the empirical NTK between two parameter settings,
 * a finite-width proxy for the dNTK of Chapter 11.
 */
export function kernelDrift(before: number[][], after: number[][]): number {
  if (before.length !== after.length) throw new Error('shape mismatch');
  let num = 0;
  let den = 0;
  for (let i = 0; i < before.length; i++) {
    for (let j = 0; j < before[i].length; j++) {
      num += (after[i][j] - before[i][j]) ** 2;
      den += before[i][j] ** 2;
    }
  }
  return den > 0 ? Math.sqrt(num / den) : Number.NaN;
}

export interface SeparationMetrics {
  fisher: number;
  /** fraction of variance of the hidden features captured by the first two PCs */
  pcaExplained: number;
  driftFromInit: number;
  kernelDriftFromInit: number;
}

/** Trace of a Gram matrix, a cheap scalar summary of a kernel matrix. */
export function kernelTrace(K: number[][]): number {
  let s = 0;
  for (let i = 0; i < K.length; i++) s += K[i][i];
  return s;
}

/** Effective rank of a kernel matrix from its eigenvalue spectrum (entropy-based). */
export function effectiveRank(K: number[][]): number {
  const { values } = symmetricEigen(K);
  const positive = values.map((v) => Math.max(0, v));
  const total = positive.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let entropy = 0;
  for (const v of positive) {
    const p = v / total;
    if (p > 1e-12) entropy -= p * Math.log(p);
  }
  return Math.exp(entropy);
}

export { gram, matVec };
