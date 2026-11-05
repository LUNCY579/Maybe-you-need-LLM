/**
 * The KL divergence, and the three estimators RLHF actually uses.
 *
 * The KL between a policy and a reference policy has to be *estimated* from
 * samples, because the policy is a network and the integral is intractable.
 * Three estimators are in common use, and they differ in ways that matter:
 *
 *   k1 = log(π_θ / π_ref)              the naive one: unbiased, but it can be
 *                                       negative and its variance is unbounded
 *   k2 = (log(π_θ / π_ref))²           always positive, but biased upwards
 *   k3 = π_θ / π_ref − 1 − log(π_θ / π_ref)
 *                                       non-negative and unbiased
 *
 * The third is the one to use when the penalty is in the objective and the
 * estimate has to stay positive.
 */

import { createRng } from '@llm-materials/course-core'
import type { Rng, Vector } from '@llm-materials/course-core'
import { actionProbs, klToReference } from './policy.js'
import type { Bandit } from './policy.js'

export type KlEstimator = 'k1' | 'k2' | 'k3'

/**
 * The exact KL from a policy to a reference, averaged over the contexts.
 */
export function exactKl(bandit: Bandit, reference: Bandit, contexts?: number[]): number {
  return klToReference(bandit, reference, contexts).mean
}

/**
 * One estimator's value on a single sample.
 */
export function estimateKl(
  estimator: KlEstimator,
  currentProb: number,
  referenceProb: number,
): number {
  const logRatio = Math.log(Math.max(currentProb, 1e-300)) - Math.log(Math.max(referenceProb, 1e-300))
  if (estimator === 'k1') return logRatio
  if (estimator === 'k2') return logRatio * logRatio
  const ratio = currentProb / Math.max(referenceProb, 1e-300)
  return ratio - 1 - logRatio
}

/**
 * Estimate the KL from sampled actions.
 *
 * The estimator's mean is compared against the exact value, and its variance
 * is reported, because an estimator that is biased by a constant is a
 * different thing from one that is merely noisy.
 */
export interface KlEstimate {
  estimator: KlEstimator
  /** The mean of the estimate. */
  mean: number
  /** The sample variance of the estimate. */
  variance: number
  /** The exact KL, for comparison. */
  exact: number
  /** The bias: the mean minus the exact value. */
  bias: number
  /** The smallest value the estimator took. */
  minimum: number
  /** How often the estimate was negative. */
  negativeFraction: number
  /** The number of samples. */
  samples: number
}

export function estimateKlFromSamples(
  bandit: Bandit,
  reference: Bandit,
  estimator: KlEstimator,
  samples = 4000,
  seed = 17,
): KlEstimate {
  const rng = createRng(seed)
  const values: number[] = []

  for (let s = 0; s < samples; s++) {
    const context = Math.floor(rng() * bandit.contexts)
    const probs = actionProbs(bandit, context)
    const referenceProbs = actionProbs(reference, context)
    // Sample an action from the *current* policy.
    const u = rng()
    let cumulative = 0
    let action = 0
    for (let a = 0; a < probs.length; a++) {
      cumulative += probs[a] ?? 0
      if (u <= cumulative) {
        action = a
        break
      }
    }
    values.push(estimateKl(estimator, probs[action] ?? 0, referenceProbs[action] ?? 0))
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance =
    values.length < 2
      ? 0
      : values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1)

  return {
    estimator,
    mean,
    variance,
    exact: exactKl(bandit, reference),
    bias: mean - exactKl(bandit, reference),
    minimum: Math.min(...values),
    negativeFraction: values.filter((v) => v < 0).length / values.length,
    samples: values.length,
  }
}

/**
 * The three estimators, estimated side by side.
 */
export function compareEstimators(
  bandit: Bandit,
  reference: Bandit,
  samples = 4000,
  seed = 17,
): KlEstimate[] {
  return (['k1', 'k2', 'k3'] as KlEstimator[]).map((estimator) =>
    estimateKlFromSamples(bandit, reference, estimator, samples, seed + estimator.charCodeAt(1)),
  )
}

/**
 * The reverse KL, KL(π_ref ‖ π_θ).
 *
 * It is not the same number, and the direction matters: the forward KL punishes
 * the policy for putting mass where the reference has none, while the reverse
 * KL punishes it for missing mass where the reference has some.
 */
export function reverseKl(bandit: Bandit, reference: Bandit, contexts?: number[]): number {
  const list = contexts ?? Array.from({ length: bandit.contexts }, (_, i) => i)
  let total = 0
  for (const context of list) {
    const probs = actionProbs(bandit, context)
    const referenceProbs = actionProbs(reference, context)
    let kl = 0
    for (let action = 0; action < bandit.actions; action++) {
      const q = referenceProbs[action] ?? 0
      if (q <= 0) continue
      kl += q * (Math.log(Math.max(q, 1e-300)) - Math.log(Math.max(probs[action] ?? 0, 1e-300)))
    }
    total += kl
  }
  return list.length === 0 ? 0 : total / list.length
}

/**
 * The chi-square divergence, which is the one the PPO paper's early
 * formulations use and which behaves differently from the KL under the
 * clipping.
 */
export function chiSquare(bandit: Bandit, reference: Bandit, contexts?: number[]): number {
  const list = contexts ?? Array.from({ length: bandit.contexts }, (_, i) => i)
  let total = 0
  for (const context of list) {
    const probs = actionProbs(bandit, context)
    const referenceProbs = actionProbs(reference, context)
    let chi = 0
    for (let action = 0; action < bandit.actions; action++) {
      const p = probs[action] ?? 0
      const q = referenceProbs[action] ?? 0
      if (p <= 0) continue
      chi += (p - q) ** 2 / Math.max(q, 1e-300)
    }
    total += chi
  }
  return list.length === 0 ? 0 : total / list.length
}

/**
 * Sample a trajectory from a policy, with a fixed seed.
 */
export function sampleTrajectory(
  bandit: Bandit,
  steps: number,
  rewards: number[][],
  values: number[],
  rng: Rng,
): { context: number; action: number }[] {
  const trajectory: { context: number; action: number }[] = []
  for (let t = 0; t < steps; t++) {
    const context = Math.min(bandit.contexts - 1, t % bandit.contexts)
    const probs = actionProbs(bandit, context)
    const u = rng()
    let cumulative = 0
    let action = 0
    for (let a = 0; a < probs.length; a++) {
      cumulative += probs[a] ?? 0
      if (u <= cumulative) {
        action = a
        break
      }
    }
    trajectory.push({ context, action })
  }
  void rewards
  void values
  return trajectory
}

/**
 * The KL-penalised objective, and the policy that maximises it.
 *
 * The objective the third stage of the pipeline actually optimises is not the
 * reward: it is the reward *minus* β times the KL from a reference policy.
 * Over the policies of one context that objective has a closed form,
 *
 *   π*(a) ∝ π_ref(a) · exp(r(a) / β)
 *
 * so the reference is not a detail of the optimiser — it is part of the answer,
 * and the penalty does not shrink the movement, it chooses a different policy.
 * Everything below is exact: the tilt is a softmax of the reference's logits
 * plus the reward divided by β, and the KL it produces has to satisfy
 *
 *   KL(π* ‖ π_ref) = E_{π*}[r] / β − log Z,  Z = Σ_a π_ref(a) exp(r(a) / β)
 *
 * which is the identity `penaltyRow` measures the residual of.
 */

/** The maximiser of E_π[r] − β·KL(π ‖ reference), context by context. */
export function penalisedPolicy(reference: Bandit, rewards: number[][], beta: number): Bandit {
  const logits = reference.logits.map((value, index) => {
    const context = Math.floor(index / reference.actions)
    const action = index % reference.actions
    return value + (rewards[context]?.[action] ?? 0) / beta
  })
  return { contexts: reference.contexts, actions: reference.actions, logits }
}

export interface PenaltyRow {
  beta: number
  /** The expected reward of the penalised optimum, averaged over the contexts. */
  reward: number
  /** Its KL distance from the reference. */
  kl: number
  /** reward − β·kl, the value of the objective it maximises. */
  objective: number
  /** The reward given up relative to the unpenalised optimum. */
  rewardCost: number
  /** The distance saved relative to the unpenalised optimum. */
  klSaved: number
  /** The residual of the identity KL = E[r]/β − log Z. */
  identityResidual: number
}

/** The value of E_π[r] − β·KL(π ‖ reference) for any policy, averaged over contexts. */
export function penalisedObjective(
  policy: Bandit,
  reference: Bandit,
  rewards: number[][],
  beta: number,
): { reward: number; kl: number; objective: number } {
  let reward = 0
  for (let context = 0; context < policy.contexts; context++) {
    const probs = actionProbs(policy, context)
    const row = rewards[context] ?? []
    for (let action = 0; action < policy.actions; action++) {
      reward += (probs[action] ?? 0) * (row[action] ?? 0)
    }
  }
  const mean = reward / Math.max(policy.contexts, 1)
  const kl = exactKl(policy, reference)
  return { reward: mean, kl, objective: mean - beta * kl }
}

/**
 * The log of Σ_a π_ref(a) exp(r(a)/β), averaged over the contexts.
 *
 * It is the constant the identity KL = E[r]/β − log Z needs, and it is what the
 * penalty trades against: the same tilt, seen from the reference's side.
 */
export function logPartitionOfTilt(reference: Bandit, rewards: number[][], beta: number): number {
  let total = 0
  for (let context = 0; context < reference.contexts; context++) {
    const referenceProbs = actionProbs(reference, context)
    const row = rewards[context] ?? []
    let partition = 0
    for (let action = 0; action < reference.actions; action++) {
      partition += (referenceProbs[action] ?? 0) * Math.exp((row[action] ?? 0) / beta)
    }
    total += Math.log(Math.max(partition, 1e-300))
  }
  return total / Math.max(reference.contexts, 1)
}

/** One row of the β sweep, with the identity checked. */
export function penaltyRow(reference: Bandit, rewards: number[][], beta: number): PenaltyRow {
  const policy = penalisedPolicy(reference, rewards, beta)
  const { reward, kl, objective } = penalisedObjective(policy, reference, rewards, beta)
  return {
    beta,
    reward,
    kl,
    objective,
    rewardCost: 0,
    klSaved: 0,
    identityResidual: kl - (reward / beta - logPartitionOfTilt(reference, rewards, beta)),
  }
}

/**
 * The β sweep, with the two ends filled in.
 *
 * `rewardCost` and `klSaved` are measured against the reward-maximising policy —
 * the same policy every β is trading distance against — so the first row of the
 * sweep costs nothing to read.
 */
export function klPenaltySweep(
  reference: Bandit,
  rewards: number[][],
  betas: number[] = [0.05, 0.1, 0.2, 0.4, 0.8, 1.6, 3.2, 6.4],
): PenaltyRow[] {
  const best = rewardMaximisingPolicy(reference, rewards)
  const rows = betas.map((beta) => penaltyRow(reference, rewards, beta))
  for (const row of rows) {
    row.rewardCost = best.reward - row.reward
    row.klSaved = best.kl - row.kl
  }
  return rows
}

export interface GreedyPolicy {
  /** The policy itself: one nearly deterministic row per context. */
  policy: Bandit
  /** The expected reward of taking the best action in every context. */
  reward: number
  /** Its KL distance from the same reference the penalties are measured against. */
  kl: number
}

/**
 * The β = 0 limit: the policy that takes the best action in every context.
 *
 * It is the reward-maximising policy of the landscape, so it is the thing every
 * β is trading distance against — and its KL is the price of taking no distance
 * at all.
 */
export function rewardMaximisingPolicy(reference: Bandit, rewards: number[][]): GreedyPolicy {
  const logits = reference.logits.slice()
  let reward = 0
  for (let context = 0; context < reference.contexts; context++) {
    const row = rewards[context] ?? []
    let best = 0
    for (let action = 1; action < reference.actions; action++) {
      if ((row[action] ?? 0) > (row[best] ?? 0)) best = action
    }
    reward += row[best] ?? 0
    for (let action = 0; action < reference.actions; action++) {
      logits[context * reference.actions + action] = action === best ? 20 : -20
    }
  }
  const policy: Bandit = { contexts: reference.contexts, actions: reference.actions, logits }
  return {
    policy,
    reward: reward / Math.max(reference.contexts, 1),
    kl: exactKl(policy, reference),
  }
}

/** A vector of ones, for convenience in the laboratories. */
export function ones(length: number): Vector {
  return new Array<number>(length).fill(1)
}
