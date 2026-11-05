import { solveLinear } from './linalg';

/**
 * Gaussian-process regression.
 *
 * This is the *infinite-width limit* of a neural network: at infinite width
 * the preactivations are a Gaussian process, so training such a network on data
 * is exactly kernel regression, and the posterior is available in closed form.
 *
 * The point of implementing it here is not to simulate the Bayesian chapter of
 * the monograph — that would need a finite-width posterior, which this
 * application does not claim to do. It is to make the *limit* concrete: the
 * reader can see the posterior that the infinite-width theory predicts, and
 * then compare it with what a finite-width network actually does in Laboratory
 * E.
 */

export interface GpOptions {
  /** the length scale of the squared-exponential kernel */
  lengthScale: number;
  /** the signal variance */
  signalVariance: number;
  /** the observation noise variance */
  noiseVariance: number;
}

export const DEFAULT_GP: GpOptions = {
  lengthScale: 0.5,
  signalVariance: 1,
  noiseVariance: 0.05,
};

/** The squared-exponential (RBF) kernel, k(x, x′) = σ_f² exp(−‖x−x′‖²/2ℓ²). */
export function rbfKernel(x: number[], y: number[], { lengthScale, signalVariance }: GpOptions): number {
  let d2 = 0;
  for (let i = 0; i < x.length; i++) {
    const d = x[i] - y[i];
    d2 += d * d;
  }
  return signalVariance * Math.exp(-d2 / (2 * lengthScale * lengthScale));
}

export interface GpPosterior {
  /** the training inputs */
  X: number[][];
  /** the training targets */
  y: number[];
  /** the posterior mean at the requested inputs */
  mean: number[];
  /** the posterior standard deviation at the requested inputs */
  sd: number[];
  options: GpOptions;
}

/**
 * The posterior of a zero-mean Gaussian process conditioned on the data
 * (book §10.4, "Kernel methods"):
 *
 *   μ(x)  = k(x, X) [K + σ_n² I]⁻¹ y
 *   σ²(x) = k(x, x) − k(x, X) [K + σ_n² I]⁻¹ k(X, x)
 */
export function gpPosterior(
  X: number[][],
  y: number[],
  queries: number[][],
  options: GpOptions = DEFAULT_GP,
): GpPosterior {
  const n = X.length;
  if (n === 0) throw new Error('a Gaussian process posterior needs at least one observation');
  if (y.length !== n) throw new Error(`there are ${n} inputs but ${y.length} targets`);

  // the noisy kernel matrix, K + σ_n² I
  const A: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => rbfKernel(X[i], X[j], options) + (i === j ? options.noiseVariance : 0)),
  );
  // α = (K + σ_n² I)⁻¹ y
  const alpha = solveLinear(A, y);

  const mean = queries.map((q) => {
    const kx = X.map((xi) => rbfKernel(q, xi, options));
    return kx.reduce((s, k, i) => s + k * alpha[i], 0);
  });

  const sd = queries.map((q) => {
    const kx = X.map((xi) => rbfKernel(q, xi, options));
    // k(x, X) A⁻¹ k(X, x): solve A v = k(X, x)
    const v = solveLinear(A, kx);
    const reduction = kx.reduce((s, k, i) => s + k * v[i], 0);
    const prior = rbfKernel(q, q, options);
    return Math.sqrt(Math.max(1e-12, prior - reduction));
  });

  return { X, y, mean, sd, options };
}

/**
 * A small, deterministic dataset for the figure: a noisy sine wave sampled on
 * a regular grid. It is generated here rather than stored, so the figure has no
 * hidden data.
 */
export function gpDemoData(count = 9, noise = 0.15, seed = 3): { X: number[][]; y: number[] } {
  const X: number[][] = [];
  const y: number[] = [];
  // a small deterministic pseudo-random sequence, so the noise is reproducible
  let s = seed >>> 0;
  const next = () => {
    s = (1103515245 * s + 12345) >>> 0;
    return s / 4294967296 - 0.5;
  };
  for (let i = 0; i < count; i++) {
    const x = -1.5 + (3 * i) / (count - 1);
    X.push([x]);
    y.push(Math.sin(2 * x) + noise * next());
  }
  return { X, y };
}
