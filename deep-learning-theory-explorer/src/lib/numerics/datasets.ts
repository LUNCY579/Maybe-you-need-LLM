/**
 * Synthetic datasets, generated with a seeded RNG so that every experiment is
 * reproducible. These are *own constructions* (the standard two-moons / circles
 * toy problems are re-derived here from their parametric definitions) and are used
 * only as test data for the mathematical experiments; the textbook does not supply
 * datasets, so the data is deliberately simple and fully documented.
 */

import { Rng } from './rng';

export interface Dataset {
  id: string;
  label: string;
  description: string;
  X: number[][];
  /** one-hot targets, shape (n, classes) */
  Y: number[][];
  /** integer class labels, shape (n) */
  labels: number[];
  classes: number;
  inputDim: number;
  /** true classification quality of the data source (for reference) */
  seed: number;
  noise: number;
}

export interface RegressionDataset {
  id: string;
  label: string;
  description: string;
  X: number[][];
  /** scalar targets, shape (n,1) */
  Y: number[][];
  /** the noiseless generating function, used as an independent reference */
  truth: (x: number[]) => number;
  inputDim: number;
  seed: number;
  noise: number;
}

function oneHot(labels: number[], classes: number): number[][] {
  return labels.map((c) => Array.from({ length: classes }, (_, i) => (i === c ? 1 : 0)));
}

/** Two interleaving half circles (Moons). */
export function twoMoons(n = 120, noise = 0.08, seed = 1): Dataset {
  const rng = new Rng(seed);
  const X: number[][] = [];
  const labels: number[] = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < half; i++) {
    const theta = (Math.PI * i) / Math.max(1, half - 1);
    X.push([Math.cos(theta) + rng.normalScaled(0, noise), Math.sin(theta) + rng.normalScaled(0, noise)]);
    labels.push(0);
  }
  for (let i = 0; i < n - half; i++) {
    const theta = (Math.PI * i) / Math.max(1, n - half - 1);
    X.push([1 - Math.cos(theta) + rng.normalScaled(0, noise), 0.5 - Math.sin(theta) + rng.normalScaled(0, noise)]);
    labels.push(1);
  }
  return {
    id: 'two-moons',
    label: 'Two moons',
    description:
      'Two interleaved half circles. A linear classifier cannot separate the classes, so any separation achieved by a network must come from its learned hidden representation.',
    X,
    Y: oneHot(labels, 2),
    labels,
    classes: 2,
    inputDim: 2,
    seed,
    noise,
  };
}

/** Concentric circles. */
export function circles(n = 120, noise = 0.08, seed = 2): Dataset {
  const rng = new Rng(seed);
  const X: number[][] = [];
  const labels: number[] = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < half; i++) {
    const theta = rng.uniform(0, 2 * Math.PI);
    const r = 0.5 + rng.normalScaled(0, noise);
    X.push([r * Math.cos(theta), r * Math.sin(theta)]);
    labels.push(0);
  }
  for (let i = 0; i < n - half; i++) {
    const theta = rng.uniform(0, 2 * Math.PI);
    const r = 1.5 + rng.normalScaled(0, noise);
    X.push([r * Math.cos(theta), r * Math.sin(theta)]);
    labels.push(1);
  }
  return {
    id: 'circles',
    label: 'Concentric circles',
    description: 'Two rings of different radius. Requires a radial (non-linear) feature to separate.',
    X,
    Y: oneHot(labels, 2),
    labels,
    classes: 2,
    inputDim: 2,
    seed,
    noise,
  };
}

/** Two or three Gaussian clusters. */
export function gaussianClusters(n = 120, classes = 3, separation = 2.2, noise = 0.7, seed = 3): Dataset {
  const rng = new Rng(seed);
  if (classes < 2 || classes > 4) throw new Error('classes must be between 2 and 4');
  const centres = Array.from({ length: classes }, (_, c) => {
    const angle = (2 * Math.PI * c) / classes;
    return [separation * Math.cos(angle), separation * Math.sin(angle)];
  });
  const X: number[][] = [];
  const labels: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % classes;
    X.push([centres[c][0] + rng.normalScaled(0, noise), centres[c][1] + rng.normalScaled(0, noise)]);
    labels.push(c);
  }
  return {
    id: `clusters-${classes}`,
    label: `${classes} Gaussian clusters`,
    description: `Isotropic Gaussians of standard deviation ${noise} centred on a circle of radius ${separation}. Linearly separable in the input space.`,
    X,
    Y: oneHot(labels, classes),
    labels,
    classes,
    inputDim: 2,
    seed,
    noise,
  };
}

/**
 * Scalar regression task for the optimization laboratory:
 *   y = sin(pi x_1) + 0.5 x_2^2 ,  x ~ U(-1,1)^d,  plus optional Gaussian noise.
 * The noiseless function is returned as `truth`, so model predictions can be
 * compared against an independent target.
 */
export function smoothRegression(n = 60, inputDim = 2, noise = 0.05, seed = 5): RegressionDataset {
  if (inputDim < 1 || inputDim > 8) throw new Error('inputDim must be between 1 and 8');
  const rng = new Rng(seed);
  const truth = (x: number[]) => Math.sin(Math.PI * x[0]) + (x.length > 1 ? 0.5 * x[1] * x[1] : 0);
  const X: number[][] = [];
  const Y: number[][] = [];
  for (let i = 0; i < n; i++) {
    const x = Array.from({ length: inputDim }, () => rng.uniform(-1, 1));
    X.push(x);
    Y.push([truth(x) + rng.normalScaled(0, noise)]);
  }
  return {
    id: 'smooth-regression',
    label: 'Smooth regression',
    description: `y = sin(pi x_1) + 0.5 x_2^2 with Gaussian noise sigma = ${noise} on ${inputDim} input dimensions.`,
    X,
    Y,
    truth,
    inputDim,
    seed,
    noise,
  };
}

export const CLASSIFICATION_DATASETS = ['two-moons', 'circles', 'clusters-3'] as const;

export function getClassificationDataset(id: string, n = 120, seed = 1): Dataset {
  switch (id) {
    case 'two-moons':
      return twoMoons(n, 0.08, seed);
    case 'circles':
      return circles(n, 0.08, seed);
    case 'clusters-3':
      return gaussianClusters(n, 3, 2.2, 0.7, seed);
    default:
      throw new Error(`unknown dataset "${id}"`);
  }
}

/** Standardize columns to zero mean and unit variance (documented preprocessing). */
export function standardize(X: number[][]): { X: number[][]; mean: number[]; sd: number[] } {
  const d = X[0].length;
  const mean = new Array<number>(d).fill(0);
  for (const row of X) for (let j = 0; j < d; j++) mean[j] += row[j] / X.length;
  const sd = new Array<number>(d).fill(0);
  for (const row of X) for (let j = 0; j < d; j++) sd[j] += (row[j] - mean[j]) ** 2 / X.length;
  for (let j = 0; j < d; j++) sd[j] = Math.sqrt(sd[j]) || 1;
  return { X: X.map((row) => row.map((v, j) => (v - mean[j]) / sd[j])), mean, sd };
}
