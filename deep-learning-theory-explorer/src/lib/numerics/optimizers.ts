/**
 * Optimizers for the training laboratories (Chapter 7 of the textbook discusses
 * exactly the (full-batch) gradient-descent update
 *   theta(t+1) = theta(t) - eta * dL/dtheta ,
 * and Chapter 10 analyzes the resulting kernel-learning dynamics).
 *
 * Three documented optimizers are provided so that students can compare them:
 *  - 'gd'       plain gradient descent (the book's algorithm)
 *  - 'momentum' heavy-ball momentum (Polyak), v <- mu v - eta g ; theta <- theta + v
 *  - 'adam'     Adam (Kingma & Ba, 2015) with bias correction
 *
 * Every optimizer consumes the *analytic* gradients produced by `backpropMse`;
 * the test suite checks those gradients against central finite differences and the
 * descent direction by checking that the loss actually decreases for small steps.
 */

import { backpropMse, cloneMlp, flattenParams, mse, unflattenParams, type Mlp } from './mlp';

export type OptimizerId = 'gd' | 'momentum' | 'adam';

export interface OptimizerSpec {
  id: OptimizerId;
  label: string;
  latex: string;
  note: string;
  /** Adam keeps its own state; other optimizers ignore the extra parameters */
  beta1?: number;
  beta2?: number;
  epsilon?: number;
  /** default momentum for the heavy-ball method */
  mu?: number;
}

export const OPTIMIZERS: Record<OptimizerId, OptimizerSpec> = {
  gd: {
    id: 'gd',
    label: 'Gradient descent',
    latex: '\\theta_{t+1} = \\theta_t - \\eta \\, \\nabla_\\theta L',
    note:
      'The algorithm analyzed in Chapters 7-10. For a quadratic loss with curvature eigenvalues lambda_i, stability requires eta < 2/lambda_max and the fastest mode decays as (1 - eta lambda_i).',
  },
  momentum: {
    id: 'momentum',
    label: 'Heavy-ball momentum',
    latex: 'v_{t+1} = \\mu v_t - \\eta \\nabla L;\\quad \\theta_{t+1} = \\theta_t + v_{t+1}',
    note:
      'Accumulates velocity with factor mu. Converges faster on ill-conditioned quadratics but inherits the same eta < 2(1+mu)/lambda_max stability window.',
    mu: 0.9,
  },
  adam: {
    id: 'adam',
    label: 'Adam',
    latex: 'm_t = \\beta_1 m_{t-1} + (1-\\beta_1) g_t,\\; v_t = \\beta_2 v_{t-1} + (1-\\beta_2) g_t^2',
    note:
      "Per-parameter adaptive step sizes. Included as an example of an optimizer outside the book's analysis: it is not equivalent to gradient flow and has no simple kernel description.",
    beta1: 0.9,
    beta2: 0.999,
    epsilon: 1e-8,
  },
};

export interface TrainOptions {
  optimizer: OptimizerId;
  learningRate: number;
  steps: number;
  /** heavy-ball momentum coefficient */
  mu?: number;
  beta1?: number;
  beta2?: number;
  epsilon?: number;
}

/** The options a single update step needs: the step count is irrelevant there. */
export type StepOptions = Omit<TrainOptions, 'steps'>;

export interface TrainState {
  step: number;
  /**
   * The loss *at the recorded parameters*. History entries are consistent: the
   * loss of entry `k` is the loss of the parameter vector stored in entry `k`.
   */
  loss: number;
  gradNorm: number;
  /** parameters after the update */
  params: number[];
  diverged: boolean;
}

interface OptimizerState {
  velocity: number[];
  m: number[];
  v: number[];
  t: number;
}

function initialState(n: number): OptimizerState {
  return { velocity: new Array(n).fill(0), m: new Array(n).fill(0), v: new Array(n).fill(0), t: 0 };
}

/** Reject nonsensical training options up front, with a message. */
export function validateTrainOptions(opts: TrainOptions): void {
  if (!OPTIMIZERS[opts.optimizer]) throw new Error(`unknown optimizer "${opts.optimizer}"`);
  if (!Number.isFinite(opts.learningRate) || opts.learningRate <= 0) {
    throw new Error(`learning rate must be a positive finite number, got ${opts.learningRate}`);
  }
  if (!Number.isInteger(opts.steps) || opts.steps < 0) {
    throw new Error(`steps must be a non-negative integer, got ${opts.steps}`);
  }
  if (opts.steps > 100_000) throw new Error('steps above 100000 are refused: the browser would freeze');
  const mu = opts.mu ?? OPTIMIZERS.momentum.mu ?? 0.9;
  if (!Number.isFinite(mu) || mu < 0 || mu >= 1) throw new Error(`momentum mu must lie in [0,1), got ${mu}`);
}

/**
 * One optimization step in place.
 *
 * Returns the loss measured *before* the update together with the gradient norm
 * and the loss measured *after* the update. Both are reported because the loss
 * after the update is the quantity that belongs with the new parameters.
 */
export function optimizerStep(
  net: Mlp,
  X: number[][],
  Y: number[][],
  opts: StepOptions,
  state: OptimizerState,
): { lossBefore: number; lossAfter: number; gradNorm: number; diverged: boolean } {
  const { grads, loss } = backpropMse(net, X, Y);
  const theta = flattenParams(net);
  const g: number[] = [];
  for (const layer of grads) {
    for (const row of layer.W) g.push(...row);
    g.push(...layer.b);
  }
  let gnorm = 0;
  for (const v of g) gnorm += v * v;
  gnorm = Math.sqrt(gnorm);
  const eta = opts.learningRate;
  const mu = opts.mu ?? OPTIMIZERS.momentum.mu ?? 0.9;
  const beta1 = opts.beta1 ?? OPTIMIZERS.adam.beta1 ?? 0.9;
  const beta2 = opts.beta2 ?? OPTIMIZERS.adam.beta2 ?? 0.999;
  const eps = opts.epsilon ?? 1e-8;
  state.t += 1;

  const next = theta.slice();
  for (let i = 0; i < theta.length; i++) {
    switch (opts.optimizer) {
      case 'gd': {
        next[i] = theta[i] - eta * g[i];
        break;
      }
      case 'momentum': {
        state.velocity[i] = mu * state.velocity[i] - eta * g[i];
        next[i] = theta[i] + state.velocity[i];
        break;
      }
      case 'adam': {
        state.m[i] = beta1 * state.m[i] + (1 - beta1) * g[i];
        state.v[i] = beta2 * state.v[i] + (1 - beta2) * g[i] * g[i];
        const mhat = state.m[i] / (1 - Math.pow(beta1, state.t));
        const vhat = state.v[i] / (1 - Math.pow(beta2, state.t));
        next[i] = theta[i] - eta * (mhat / (Math.sqrt(vhat) + eps));
        break;
      }
    }
  }
  unflattenParams(net, next);
  let diverged = false;
  for (const v of next) {
    if (!Number.isFinite(v) || Math.abs(v) > 1e12) {
      diverged = true;
      break;
    }
  }
  const lossAfter = diverged ? Number.POSITIVE_INFINITY : mse(net, X, Y);
  return { lossBefore: loss, lossAfter, gradNorm: gnorm, diverged };
}

/** Synchronous training returning the full history (used by tests). */
export function trainSync(net: Mlp, X: number[][], Y: number[][], opts: TrainOptions): TrainState[] {
  validateTrainOptions(opts);
  const state = initialState(net.parameterCount);
  const history: TrainState[] = [
    { step: 0, loss: mse(net, X, Y), gradNorm: 0, params: flattenParams(net), diverged: false },
  ];
  for (let s = 0; s < opts.steps; s++) {
    const info = optimizerStep(net, X, Y, opts, state);
    history.push({
      step: s + 1,
      loss: info.lossAfter,
      gradNorm: info.gradNorm,
      params: flattenParams(net),
      diverged: info.diverged,
    });
    if (info.diverged) break;
  }
  return history;
}

export interface TrainingSnapshot {
  step: number;
  loss: number;
  gradNorm: number;
  net: Mlp;
}

/**
 * Async training generator: yields a snapshot every `yieldEvery` steps so the
 * React layer can render progress without blocking the main thread. Callers can
 * stop early by simply not requesting the next value.
 */
export async function* trainAsync(
  net: Mlp,
  X: number[][],
  Y: number[][],
  opts: TrainOptions & { yieldEvery?: number },
): AsyncGenerator<TrainingSnapshot> {
  validateTrainOptions(opts);
  const working = cloneMlp(net);
  const state = initialState(working.parameterCount);
  const yieldEvery = Math.max(1, opts.yieldEvery ?? 1);
  yield { step: 0, loss: mse(working, X, Y), gradNorm: 0, net: cloneMlp(working) };
  for (let s = 1; s <= opts.steps; s++) {
    const info = optimizerStep(working, X, Y, opts, state);
    if (s % yieldEvery === 0 || s === opts.steps || info.diverged) {
      yield { step: s, loss: info.lossAfter, gradNorm: info.gradNorm, net: cloneMlp(working) };
    }
    if (info.diverged) return;
  }
}
