/**
 * The value head, and what generalised advantage estimation does with it.
 *
 * The critic in a real pipeline is a head on top of the policy network, and it
 * is wrong — usually quite wrong, since it is trained on the returns of the
 * policy it is scoring while that policy is moving. λ is the dial that decides
 * how much of that wrongness is allowed into the advantage, and here the
 * trade-off is exactly computable rather than sampled: the states are positions
 * in a chain, one context per step, so every trajectory the policy can produce
 * can be enumerated and the bias and the variance of the estimator read off.
 */

import { createRng } from '@llm-materials/course-core'
import { actionProbs, contextValues, createBandit, rewardLandscape } from './policy.js'
import type { Bandit } from './policy.js'
import type { Trajectory, TrajectoryStep } from './ppo.js'

export interface Chain {
  /** One context per position, so state t is scored by its own logits. */
  bandit: Bandit
  rewards: number[][]
  gamma: number
}

/** A chain short enough to enumerate in full, on the same constructed landscape as the other laboratories. */
export function buildChain(seed: number, horizon = 6, actions = 4, gamma = 0.9): Chain {
  return { bandit: createBandit(horizon, actions, seed), rewards: rewardLandscape(horizon, actions), gamma }
}

/**
 * The value of every position under the policy, by backward induction: what a
 * perfectly fitted value head would have converged to.
 */
export function chainValues(chain: Chain): number[] {
  const immediate = contextValues(chain.bandit, chain.rewards)
  const values = Array.from({ length: immediate.length }, () => 0)
  for (let t = immediate.length - 1; t >= 0; t--) {
    values[t] = immediate[t]! + chain.gamma * (values[t + 1] ?? 0)
  }
  return values
}

/** One trajectory from the chain: the actions come from the policy, the rewards from the landscape. */
export function sampleChainTrajectory(chain: Chain, critic: number[], seed: number): Trajectory {
  return sampleChainTrajectoryWith(chain, critic, createRng(seed))
}

/**
 * The same draw from a stream the caller owns.
 *
 * A fit over many epochs uses one stream, because separate streams for seeds
 * that differ by a constant are not the same as independent samples: the
 * average across them keeps a systematic error that no number of epochs
 * removes.
 */
export function sampleChainTrajectoryWith(
  chain: Chain,
  critic: number[],
  rng: () => number,
): Trajectory {
  const steps: TrajectoryStep[] = []
  for (let t = 0; t < chain.bandit.contexts; t++) {
    const probs = actionProbs(chain.bandit, t)
    let draw = rng()
    let action = chain.bandit.actions - 1
    for (let candidate = 0; candidate < chain.bandit.actions; candidate++) {
      draw -= probs[candidate] ?? 0
      if (draw <= 0) {
        action = candidate
        break
      }
    }
    steps.push({
      context: t,
      action,
      reward: chain.rewards[t]?.[action] ?? 0,
      value: critic[t] ?? 0,
      nextValue: critic[t + 1] ?? 0,
      terminal: t === chain.bandit.contexts - 1,
    })
  }
  return { steps }
}

/** The return-to-go of every position in a finished trajectory: the target a value head is trained on. */
export function returnsToGo(trajectory: Trajectory, gamma: number): number[] {
  const returns = Array.from({ length: trajectory.steps.length }, () => 0)
  let running = 0
  for (let t = trajectory.steps.length - 1; t >= 0; t--) {
    running = trajectory.steps[t]!.reward + gamma * running
    returns[t] = running
  }
  return returns
}

export interface ValueHeadPoint {
  /** How many trajectories the head has been shown. */
  seen: number
  /** The mean squared error against the returns it was shown. */
  loss: number
  /** The root mean squared error against the exact value of each state. */
  error: number
  /** The head itself at that point, so the advantage estimator can be scored against it. */
  values: number[]
}

export interface ValueHeadFit {
  /** One number per state, as the head holds it after training. */
  values: number[]
  rmse: number
  curve: ValueHeadPoint[]
  trajectories: number
}

/**
 * Train a value head on sampled returns.
 *
 * The head is a table of one number per state, which is what a value head on a
 * fixed one-hot feature vector is, and its target is the return-to-go of the
 * trajectory the policy just produced. The step is one over the number of times
 * that state has been seen, which makes the head the running average of the
 * returns from it — the Robbins–Monro schedule, and the slowest thing that still
 * converges. A fixed step size does not converge at all: the head keeps chasing
 * the last few trajectories it saw and wanders, so more data makes it no better.
 * The one knob is how much data the head got, and the error falls as one over
 * its square root.
 */
export function fitValueHead(
  chain: Chain,
  options: { trajectories?: number; checkpoints?: number; seed?: number } = {},
): ValueHeadFit {
  const trajectories = options.trajectories ?? 200
  const checkpoints = options.checkpoints ?? 24
  const seed = options.seed ?? 1

  const exact = chainValues(chain)
  const rng = createRng(seed)
  const values = Array.from({ length: exact.length }, () => 0)
  const seen = Array.from({ length: exact.length }, () => 0)
  const curve: ValueHeadPoint[] = []
  const every = Math.max(1, Math.ceil(trajectories / checkpoints))
  let shown = 0
  let squared = 0

  const rmse = () =>
    Math.sqrt(values.reduce((sum, value, index) => sum + (value - exact[index]!) ** 2, 0) / values.length)

  for (let index = 0; index < trajectories; index++) {
    const trajectory = sampleChainTrajectoryWith(chain, values, rng)
    const returns = returnsToGo(trajectory, chain.gamma)
    for (let t = 0; t < returns.length; t++) {
      seen[t]! += 1
      values[t]! += (returns[t]! - values[t]!) / seen[t]!
      squared += (values[t]! - returns[t]!) ** 2
      shown += 1
    }
    // The first checkpoint is one trajectory, where the head reproduces what it
    // was shown exactly and its loss is therefore zero while its error is not.
    if (index === 0 || (index + 1) % every === 0 || index === trajectories - 1) {
      curve.push({ seen: index + 1, loss: squared / shown, error: rmse(), values: [...values] })
    }
  }

  return { values, rmse: rmse(), curve, trajectories }
}

/**
 * Every trajectory the chain can produce, with the probability the policy gives it.
 *
 * The paths depend on the policy alone, not on the critic being scored, so they
 * are kept against the chain: one screen recomputes the estimator a dozen times
 * and each recomputation would otherwise walk 4^h again.
 */
const pathCache = new WeakMap<Chain, { probability: number; rewards: number[] }[]>()

function enumeratePaths(chain: Chain): { probability: number; rewards: number[] }[] {
  const cached = pathCache.get(chain)
  if (cached) return cached
  const paths: { probability: number; rewards: number[] }[] = []
  const walk = (position: number, rewards: number[], probability: number) => {
    if (position === chain.bandit.contexts) {
      paths.push({ probability, rewards })
      return
    }
    const probs = actionProbs(chain.bandit, position)
    for (let action = 0; action < chain.bandit.actions; action++) {
      const weight = probs[action] ?? 0
      if (weight <= 0) continue
      walk(position + 1, [...rewards, chain.rewards[position]?.[action] ?? 0], probability * weight)
    }
  }
  walk(0, [], 1)
  pathCache.set(chain, paths)
  return paths
}

/**
 * The exact mean and spread of the return-to-go from every position.
 *
 * The head is fitted on sampled returns, so the difficulty of each state is the
 * spread of the numbers it will be shown from that state — one reward at the end
 * of the chain, six discounted ones at the start. This is what the per-state
 * error is expected to track.
 */
export function returnSpread(chain: Chain): { mean: number; standardDeviation: number }[] {
  const paths = enumeratePaths(chain)
  return chainValues(chain).map((_, position) => {
    let mean = 0
    let second = 0
    for (const path of paths) {
      let running = 0
      for (let t = path.rewards.length - 1; t >= position; t--) running = path.rewards[t]! + chain.gamma * running
      mean += path.probability * running
      second += path.probability * running * running
    }
    return { mean, standardDeviation: Math.sqrt(Math.max(0, second - mean * mean)) }
  })
}

export interface AdvantageCurveRow {
  lambda: number
  /** E[A_0] under the policy, exactly. */
  mean: number
  /** The distance from the true advantage of the first state. */
  bias: number
  variance: number
  mse: number
}

export interface AdvantageCurve {
  rows: AdvantageCurveRow[]
  /** The advantage the estimator is trying to say: the true value of the first state minus the critic's. */
  target: number
  criticRmse: number
  paths: number
  bestLambda: number
  bestMse: number
}

/**
 * The bias and the variance of generalised advantage estimation, exactly.
 *
 * The residuals of a trajectory do not depend on λ, so one enumeration of the
 * paths gives every λ at once: A_0(λ) = Σ_l (γλ)^l δ_l. The bias then has a
 * closed form worth naming — with e = V − v the critic's error, E[A_0(λ)] = e_0
 * + (1 − 1/λ) Σ_{l≥1} (γλ)^l e_l — so at λ = 1 the critic cancels out of the
 * estimate entirely and the bias is zero whatever the head says, while below
 * one every value the head holds wrong contributes to it.
 */
export function advantageCurve(
  chain: Chain,
  critic: number[],
  lambdas: number[] = Array.from({ length: 21 }, (_, index) => index / 20),
): AdvantageCurve {
  const exact = chainValues(chain)
  const paths = enumeratePaths(chain)
  const deltas = paths.map((path) => {
    const row: number[] = []
    for (let t = 0; t < path.rewards.length; t++) {
      row.push(path.rewards[t]! + chain.gamma * (critic[t + 1] ?? 0) - (critic[t] ?? 0))
    }
    return row
  })
  const powers = lambdas.map((lambda) => {
    const row: number[] = []
    let term = 1
    for (let t = 0; t < paths[0]!.rewards.length; t++) {
      row.push(term)
      term *= chain.gamma * lambda
    }
    return row
  })

  const rows = lambdas.map((lambda, index) => {
    let mean = 0
    let second = 0
    for (let p = 0; p < paths.length; p++) {
      const path = paths[p]!
      const delta = deltas[p]!
      let advantage = 0
      for (let t = 0; t < delta.length; t++) advantage += powers[index]![t]! * delta[t]!
      mean += path.probability * advantage
      second += path.probability * advantage * advantage
    }
    const variance = second - mean * mean
    const bias = mean - (exact[0]! - (critic[0] ?? 0))
    return { lambda, mean, bias, variance, mse: bias * bias + variance }
  })

  let best = rows[0]!
  for (const row of rows) if (row.mse < best.mse) best = row

  return {
    rows,
    target: exact[0]! - (critic[0] ?? 0),
    criticRmse: Math.sqrt(
      exact.reduce((sum, value, index) => sum + (value - (critic[index] ?? 0)) ** 2, 0) / exact.length,
    ),
    paths: paths.length,
    bestLambda: best.lambda,
    bestMse: best.mse,
  }
}
