/**
 * The policy gradient.
 *
 * The claim is that the gradient of the expected return is an expectation of
 * something the agent can measure while it is acting:
 *
 *     ∇J = E[ ∇ log π(a|s) · G ]
 *
 * This module implements the estimator, and it implements the exact answer it
 * is supposed to be estimating — the expected return of the policy, solved from
 * the evaluation equations — so that the two can be compared. That comparison is the
 * check, and it is a real one: the mean of the estimator over many
 * trajectories has to converge to the gradient of the exact function.
 *
 * The baseline is the other half of the story. Subtracting a function of the
 * state does not change the expectation, and it removes a great deal of the
 * variance.
 */

import { createRng } from '@llm-materials/course-core'
import {
  policyReturn,
  rollout,
  SoftmaxPolicy,
  type Gridworld,
  type Trajectory,
} from './mdp'

export interface GradientEstimate {
  /** The estimated gradient, one entry per logit. */
  gradient: number[]
  /** The exact gradient, by a central difference of the exact return. */
  exact: number[]
  /** The largest difference between the two. */
  error: number
  /** The error relative to the size of the exact gradient. */
  relativeError: number
  /** The size of the finite difference. */
  epsilon: number
  /** The number of trajectories the estimate used. */
  trajectories: number
}

/** The exact gradient of the expected return, by a central difference. */
export function exactGradient(
  world: Gridworld,
  policy: SoftmaxPolicy,
  epsilon = 1e-5,
): number[] {
  const gradient: number[] = []
  for (let index = 0; index < policy.logits.length; index++) {
    const state = Math.floor(index / policy.actions)
    const action = index % policy.actions
    const up = policyReturn(world, policy.withLogit(state, action, (policy.logits[index] ?? 0) + epsilon))
    const down = policyReturn(world, policy.withLogit(state, action, (policy.logits[index] ?? 0) - epsilon))
    gradient.push((up - down) / (2 * epsilon))
  }
  return gradient
}

/**
 * The REINFORCE estimator.
 *
 * The gradient of the log-probability is multiplied by the return, and the
 * result is averaged over the trajectories.
 *
 * The weighting decides which return: the rewards from the step onwards
 * (`reward-to-go`), or the whole episode's return (`total`). Both are unbiased
 * — the score of a step is uncorrelated with anything that happened before it —
 * and they are not equally noisy. That difference is `compareRewardWeightings`.
 */
export function reinforceGradient(
  world: Gridworld,
  policy: SoftmaxPolicy,
  options: {
    trajectories?: number
    seed?: number
    baseline?: (trajectory: Trajectory, index: number) => number
    weighting?: 'reward-to-go' | 'total'
  } = {},
): number[] {
  const settings = { trajectories: 2000, seed: 1, weighting: 'reward-to-go' as const, ...options }
  const rng = createRng(settings.seed)
  const gradient = new Array<number>(policy.logits.length).fill(0)
  let count = 0

  for (let trial = 0; trial < settings.trajectories; trial++) {
    const trajectory = rollout(world, policy, Math.floor(rng() * 1e9))
    count++
    // The return from each step onwards.
    const returns = returnsFromEachStep(trajectory.rewards)
    for (let t = 0; t < trajectory.states.length; t++) {
      const state = trajectory.states[t]!
      const action = trajectory.actions[t]!
      const baseline = settings.baseline ? settings.baseline(trajectory, t) : 0
      const weight =
        (settings.weighting === 'total' ? trajectory.total : (returns[t] ?? 0)) - baseline
      const scores = policy.scoreGradient(state, action)
      for (let index = 0; index < gradient.length; index++) {
        gradient[index] = (gradient[index] ?? 0) + (scores[index] ?? 0) * weight
      }
    }
  }

  return gradient.map((value) => value / count)
}

/** The return from each step of a trajectory onwards. */
export function returnsFromEachStep(rewards: number[]): number[] {
  const returns = new Array<number>(rewards.length).fill(0)
  let running = 0
  for (let t = rewards.length - 1; t >= 0; t--) {
    running += rewards[t] ?? 0
    returns[t] = running
  }
  return returns
}

/**
 * Compare the estimator with the exact gradient.
 *
 * The error is the largest difference between the two, over the logits. A
 * sweep over sample sizes can pass its reference in, because the reference does
 * not depend on the number of samples.
 */
export function compareGradients(
  world: Gridworld,
  policy: SoftmaxPolicy,
  options: {
    trajectories?: number
    seed?: number
    epsilon?: number
    baseline?: (trajectory: Trajectory, index: number) => number
    exact?: number[]
  } = {},
): GradientEstimate {
  const settings = { trajectories: 4000, seed: 1, epsilon: 1e-5, ...options }
  const estimate = reinforceGradient(world, policy, settings)
  const exact = settings.exact ?? exactGradient(world, policy, settings.epsilon)
  let error = 0
  for (let index = 0; index < exact.length; index++) {
    error = Math.max(error, Math.abs((estimate[index] ?? 0) - (exact[index] ?? 0)))
  }
  const norm = Math.sqrt(exact.reduce((sum, value) => sum + value * value, 0))
  return {
    gradient: estimate,
    exact,
    error,
    relativeError: norm === 0 ? error : error / norm,
    epsilon: settings.epsilon,
    trajectories: settings.trajectories,
  }
}

/**
 * The advantage of a state under a policy: the return minus the value of the
 * state.
 *
 * The value of the state is solved exactly, from the linear evaluation
 * equations, so the advantage
 * is the true advantage and not an estimate of it.
 */
export function advantage(trajectory: Trajectory, values: number[]): number[] {
  const returns = returnsFromEachStep(trajectory.rewards)
  return returns.map((value, index) => value - (values[trajectory.states[index] ?? 0] ?? 0))
}

/**
 * The variance of an estimator, over repeated batches.
 *
 * The standard deviation of the estimated gradient, over batches of
 * trajectories, is the number that says how many samples a practitioner would
 * need.
 */
export function gradientStandardDeviation(
  world: Gridworld,
  policy: SoftmaxPolicy,
  options: {
    batches?: number
    trajectoriesPerBatch?: number
    seed?: number
    baseline?: (trajectory: Trajectory, index: number) => number
    weighting?: 'reward-to-go' | 'total'
  } = {},
): { mean: number[]; deviation: number[] } {
  const settings = { batches: 12, trajectoriesPerBatch: 200, seed: 2, ...options }
  const estimates: number[][] = []
  for (let batch = 0; batch < settings.batches; batch++) {
    estimates.push(
      reinforceGradient(world, policy, {
        trajectories: settings.trajectoriesPerBatch,
        seed: settings.seed + batch * 977,
        baseline: settings.baseline,
        weighting: settings.weighting,
      }),
    )
  }
  const mean: number[] = []
  const deviation: number[] = []
  for (let index = 0; index < policy.logits.length; index++) {
    const values = estimates.map((estimate) => estimate[index] ?? 0)
    const average = values.reduce((a, b) => a + b, 0) / values.length
    mean.push(average)
    const variance =
      values.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(1, values.length - 1)
    deviation.push(Math.sqrt(variance))
  }
  return { mean, deviation }
}

/** The norm of a gradient, for the plots. */
export function gradientNorm(gradient: number[]): number {
  return Math.sqrt(gradient.reduce((sum, value) => sum + value * value, 0))
}

/**
 * The two weightings, measured.
 *
 * Multiplying the score of a step by the whole episode's return, or by the
 * rewards that came after it, is the difference between the Monte Carlo
 * gradient and the reward-to-go one. The expectation is the same because the
 * score of a step is uncorrelated with the rewards that step could not have
 * influenced; the spread is not the same, and this is where the size of that
 * difference is measured rather than asserted.
 */
export interface WeightingComparison {
  /** The exact gradient, by a central difference of the exact return. */
  exact: number[]
  rewardToGo: { mean: number[]; deviation: number[] }
  total: { mean: number[]; deviation: number[] }
  /** The distance between the two means, relative to the size of the gradient. */
  meanGap: number
  /** Each mean's distance from the exact gradient, relative to its size. */
  relativeErrorRewardToGo: number
  relativeErrorTotal: number
  /** The spread of the total-return estimator over the spread of the reward-to-go one. */
  spreadRatio: number
  batches: number
  trajectoriesPerBatch: number
}

export function compareRewardWeightings(
  world: Gridworld,
  policy: SoftmaxPolicy,
  options: {
    batches?: number
    trajectoriesPerBatch?: number
    seed?: number
    epsilon?: number
    baseline?: (trajectory: Trajectory, index: number) => number
  } = {},
): WeightingComparison {
  const settings = { batches: 16, trajectoriesPerBatch: 250, seed: 2, epsilon: 1e-5, ...options }
  const common = {
    batches: settings.batches,
    trajectoriesPerBatch: settings.trajectoriesPerBatch,
    seed: settings.seed,
    baseline: settings.baseline,
  }
  const rewardToGo = gradientStandardDeviation(world, policy, { ...common, weighting: 'reward-to-go' })
  const total = gradientStandardDeviation(world, policy, { ...common, weighting: 'total' })
  const exact = exactGradient(world, policy, settings.epsilon)
  const norm = gradientNorm(exact) || 1
  const spread = (entries: number[]) => Math.sqrt(entries.reduce((sum, value) => sum + value * value, 0))
  const gap = (a: number[], b: number[]) =>
    Math.max(...a.map((value, index) => Math.abs(value - (b[index] ?? 0))))
  return {
    exact,
    rewardToGo,
    total,
    meanGap: gap(rewardToGo.mean, total.mean) / norm,
    relativeErrorRewardToGo: gap(rewardToGo.mean, exact) / norm,
    relativeErrorTotal: gap(total.mean, exact) / norm,
    spreadRatio: spread(total.deviation) / (spread(rewardToGo.deviation) || 1),
    batches: settings.batches,
    trajectoriesPerBatch: settings.trajectoriesPerBatch,
  }
}
