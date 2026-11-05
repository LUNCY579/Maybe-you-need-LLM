/**
 * The n-step return, the λ-return, and the bias and variance they trade.
 *
 * The Monte Carlo return is unbiased and noisy. The one-step return is
 * biased and quiet. The λ-return is a mixture of the two, and λ is the knob:
 * at zero it is the one-step return, at one it is the Monte Carlo return.
 *
 * The measurement here is the real one — the mean squared error of the
 * estimator against the true return, over many trajectories, as a function of
 * λ — and the bias and the variance are then read off the two ends.
 */

import { createRng } from '@llm-materials/course-core'
import { rollout, SoftmaxPolicy, type Gridworld, type Trajectory } from './mdp'

/** The n-step return from a step onwards. */
export function nStepReturn(rewards: number[], t: number, n: number, discount: number): number {
  let total = 0
  let power = 1
  const limit = Math.min(t + n, rewards.length)
  for (let k = t; k < limit; k++) {
    total += power * (rewards[k] ?? 0)
    power *= discount
  }
  return total
}

/**
 * The λ-return.
 *
 * The weighted mixture of the n-step returns, with the weights
 * (1−λ)λ^(n−1), and the last term taking the remaining weight. At λ = 0 it
 * is the one-step return; at λ = 1 it is the full return.
 */
export function lambdaReturn(
  rewards: number[],
  t: number,
  lambda: number,
  discount: number,
  bootstrap = 0,
): number {
  const horizon = rewards.length - t
  if (horizon <= 0) return bootstrap

  // The full return from t, with the bootstrap at the end.
  let full = 0
  let power = 1
  for (let k = 0; k < horizon; k++) {
    full += power * (rewards[t + k] ?? 0)
    power *= discount
  }
  full += power * bootstrap

  let total = 0
  for (let k = 1; k < horizon; k++) {
    // The k-step return from t.
    let nStep = 0
    let nPower = 1
    for (let j = 0; j < k; j++) {
      nStep += nPower * (rewards[t + j] ?? 0)
      nPower *= discount
    }
    nStep += nPower * bootstrap
    total += (1 - lambda) * lambda ** (k - 1) * nStep
  }
  // The last term takes the weight that is left.
  total += lambda ** (horizon - 1) * full
  return total
}

/** The general advantage estimate, from the λ-return. */
export function generalAdvantage(
  rewards: number[],
  values: number[],
  t: number,
  lambda: number,
  discount: number,
  bootstrap = 0,
): number {
  return lambdaReturn(rewards, t, lambda, discount, bootstrap) - (values[t] ?? 0)
}

/**
 * The general advantage estimate, properly.
 *
 * The temporal-difference error at each step, weighted by (γλ) to the power of
 * how far ahead it is:
 *
 *     A_t = Σ_l (γλ)^l δ_{t+l},   δ_t = r_t + γV(s_{t+1}) − V(s_t)
 *
 * At λ = 1 it is the sum of the errors, which is the true advantage; at
 * λ = 0 it is the first error alone, which is cheap and biased. The trade
 * between them is the whole of the estimator.
 */
export function advantageEstimate(
  rewards: number[],
  values: number[],
  t: number,
  lambda: number,
  discount: number,
): number {
  let total = 0
  let weight = 1
  for (let l = 0; t + l < rewards.length; l++) {
    const nextValue = t + l + 1 < values.length ? (values[t + l + 1] ?? 0) : 0
    const delta = (rewards[t + l] ?? 0) + discount * nextValue - (values[t + l] ?? 0)
    total += weight * delta
    weight *= discount * lambda
  }
  return total
}

export interface EstimatorError {
  /** The parameter the estimator was measured at. */
  lambda: number
  /** The mean squared error against the true value. */
  meanSquaredError: number
  /** The bias: the mean of the estimate minus the true mean. */
  bias: number
  /** The variance: the spread of the estimate. */
  variance: number
  /** The standard deviation. */
  deviation: number
}

/**
 * Measure an estimator of the advantage.
 *
 * The truth is the true advantage of the state and action the agent took,
 * solved exactly from the evaluation equations. The estimator is the general advantage
 * estimate, and the measurement is over many trajectories.
 */
export function measureEstimator(
  world: Gridworld,
  policy: SoftmaxPolicy,
  lambda: number,
  options: {
    trajectories?: number
    seed?: number
    discount?: number
    horizon?: number
    values?: number[]
    advantages?: number[]
  } = {},
): EstimatorError {
  const settings = { trajectories: 800, seed: 3, discount: 0.95, horizon: 100, ...options }
  const rng = createRng(settings.seed)
  const estimates: number[] = []
  const truths: number[] = []

  for (let trial = 0; trial < settings.trajectories; trial++) {
    const trajectory = rollout(world, policy, Math.floor(rng() * 1e9), { maxLength: settings.horizon })
    if (trajectory.rewards.length === 0) continue
    for (let t = 0; t < trajectory.states.length; t++) {
      const state = trajectory.states[t]!
      const action = trajectory.actions[t]!
      const estimate = advantageEstimate(trajectory.rewards, settings.values ?? [], t, lambda, settings.discount)
      const truth = settings.advantages?.[state * policy.actions + action]
      if (truth === undefined) continue
      estimates.push(estimate)
      truths.push(truth)
    }
  }

  if (estimates.length === 0) {
    return { lambda, meanSquaredError: 0, bias: 0, variance: 0, deviation: 0 }
  }

  const meanEstimate = estimates.reduce((a, b) => a + b, 0) / estimates.length
  const meanTruth = truths.reduce((a, b) => a + b, 0) / truths.length
  const variance =
    estimates.reduce((sum, value) => sum + (value - meanEstimate) ** 2, 0) / Math.max(1, estimates.length - 1)
  let squaredError = 0
  for (let i = 0; i < estimates.length; i++) {
    squaredError += ((estimates[i] ?? 0) - (truths[i] ?? 0)) ** 2
  }

  return {
    lambda,
    meanSquaredError: squaredError / estimates.length,
    bias: meanEstimate - meanTruth,
    variance,
    deviation: Math.sqrt(variance),
  }
}

/**
 * The λ-returns of a whole trajectory.
 *
 * The laboratory shows the estimates and the truth together, and the gap
 * between them is the bias, drawn out along the trajectory.
 */
export function lambdaReturnsForTrajectory(
  trajectory: Trajectory,
  lambda: number,
  discount: number,
  values: number[] = [],
): number[] {
  return trajectory.rewards.map((_, t) =>
    lambdaReturn(trajectory.rewards, t, lambda, discount, values[t] ?? 0),
  )
}
