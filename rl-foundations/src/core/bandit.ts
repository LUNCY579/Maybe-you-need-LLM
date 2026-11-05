/**
 * The simplest policy gradient, derived and checked.
 *
 * One state, one action, one reward per action: a bandit. It is the smallest
 * problem on which the derivation can be written down and every line of it
 * computed exactly, because the expectation is a finite sum rather than an
 * integral over trajectories.
 *
 * Three expressions of the same gradient are computed here — the derivative of
 * the expected reward, the same thing written with the score function, and the
 * same thing again with the reward shifted by a baseline — and the residual
 * between them is measured rather than asserted. The moments of the sampled
 * estimator are exact too: with one state the mean and the variance of the
 * estimate are sums over the arms, so the baseline's claim (no bias, less
 * variance) is arithmetic rather than a report of one lucky run.
 */

import { createRng } from '@llm-materials/course-core'

export interface Bandit {
  /** The reward of each arm, received every time it is pulled. */
  rewards: number[]
}

/** The default bandit: four arms, ranked, with one of them bad. */
export function buildBandit(options: Partial<Bandit> = {}): Bandit {
  return { rewards: [1.6, 1, 0.4, -0.2], ...options }
}

/** The number of arms. */
export function armCount(bandit: Bandit): number {
  return bandit.rewards.length
}

/** The softmax of the logits. */
export function softmax(logits: number[]): number[] {
  const maximum = Math.max(...logits)
  const exponentials = logits.map((value) => Math.exp(value - maximum))
  const total = exponentials.reduce((a, b) => a + b, 0)
  return exponentials.map((value) => value / total)
}

/** The logits of a bandit policy: one preference per arm, scaled. */
export function banditLogits(bandit: Bandit, sharpness: number): number[] {
  return bandit.rewards.map((reward) => reward * sharpness)
}

/** The expected reward of the policy — the objective the gradient is a gradient of. */
export function expectedReward(bandit: Bandit, logits: number[]): number {
  const probabilities = softmax(logits)
  return probabilities.reduce((sum, probability, arm) => sum + probability * bandit.rewards[arm]!, 0)
}

/**
 * The gradient of the log-probability of one arm, over the logits.
 *
 * The score function: `1` at the arm taken, minus the probability of each arm.
 */
export function scoreFunction(probabilities: number[], arm: number): number[] {
  return probabilities.map((probability, index) => (index === arm ? 1 : 0) - probability)
}

/**
 * The gradient by direct differentiation.
 *
 * J = Σ_a π_a R_a and ∂π_a/∂θ_k = π_a(1[a=k] − π_k), which collapses to
 * ∂J/∂θ_k = π_k (R_k − J).
 */
export function directGradient(bandit: Bandit, logits: number[]): number[] {
  const probabilities = softmax(logits)
  const objective = expectedReward(bandit, logits)
  return probabilities.map((probability, arm) => probability * (bandit.rewards[arm]! - objective))
}

/**
 * The same gradient in the score-function form.
 *
 * ∇J = Σ_a π_a ∇log π_a R_a — the likelihood-ratio trick, with the expectation
 * written out as the finite sum it is here.
 */
export function scoreFunctionGradient(bandit: Bandit, logits: number[]): number[] {
  const probabilities = softmax(logits)
  const gradient = new Array<number>(probabilities.length).fill(0)
  for (let arm = 0; arm < probabilities.length; arm++) {
    const scores = scoreFunction(probabilities, arm)
    const weight = probabilities[arm]! * bandit.rewards[arm]!
    for (let index = 0; index < gradient.length; index++) {
      gradient[index] = (gradient[index] ?? 0) + weight * (scores[index] ?? 0)
    }
  }
  return gradient
}

/**
 * The gradient again, with the reward shifted by a baseline.
 *
 * Any constant, and any function of the state — which here is everything,
 * because there is one state. The sum is unchanged because the score function
 * averages to zero.
 */
export function baselineGradient(bandit: Bandit, logits: number[], baseline: number): number[] {
  const probabilities = softmax(logits)
  const gradient = new Array<number>(probabilities.length).fill(0)
  for (let arm = 0; arm < probabilities.length; arm++) {
    const scores = scoreFunction(probabilities, arm)
    const weight = probabilities[arm]! * (bandit.rewards[arm]! - baseline)
    for (let index = 0; index < gradient.length; index++) {
      gradient[index] = (gradient[index] ?? 0) + weight * (scores[index] ?? 0)
    }
  }
  return gradient
}

/** The largest difference between two gradients, per component. */
export function maxDifference(a: number[], b: number[]): number {
  let worst = 0
  for (let index = 0; index < a.length; index++) {
    worst = Math.max(worst, Math.abs((a[index] ?? 0) - (b[index] ?? 0)))
  }
  return worst
}

/**
 * The three forms side by side.
 *
 * They are the same number computed three ways, and the residuals are the
 * evidence that the derivation was implemented correctly.
 */
export interface FormComparison {
  direct: number[]
  scoreFunction: number[]
  baseline: number[]
  /** The baseline that was subtracted — the expected reward. */
  objective: number
  residualScoreFunction: number
  residualBaseline: number
  /** The difference an action-dependent "baseline" would make. */
  wrongBaselineResidual: number
}

export function compareForms(bandit: Bandit, logits: number[]): FormComparison {
  const direct = directGradient(bandit, logits)
  const scoreForm = scoreFunctionGradient(bandit, logits)
  const objective = expectedReward(bandit, logits)
  const withBaseline = baselineGradient(bandit, logits, objective)
  return {
    direct,
    scoreFunction: scoreForm,
    baseline: withBaseline,
    objective,
    residualScoreFunction: maxDifference(direct, scoreForm),
    residualBaseline: maxDifference(direct, withBaseline),
    wrongBaselineResidual: maxDifference(direct, actionDependentGradient(bandit, logits, 0.5)),
  }
}

/**
 * The estimator with a baseline that depends on the action taken.
 *
 * This is the mistake the theorem rules out: subtracting a function of the arm
 * rather than a function of the state. The expectation moves by exactly the
 * score function of the arm the baseline favours, which is not zero.
 */
export function actionDependentGradient(
  bandit: Bandit,
  logits: number[],
  value: number,
  arm = best(bandit),
): number[] {
  const probabilities = softmax(logits)
  const gradient = new Array<number>(probabilities.length).fill(0)
  for (let index = 0; index < probabilities.length; index++) {
    const scores = scoreFunction(probabilities, index)
    const weight = probabilities[index]! * (bandit.rewards[index]! - (index === arm ? value : 0))
    for (let component = 0; component < gradient.length; component++) {
      gradient[component] = (gradient[component] ?? 0) + weight * (scores[component] ?? 0)
    }
  }
  return gradient
}

/**
 * The exact moments of the sampled estimator.
 *
 * One arm is drawn per sample, so the estimator takes one of a handful of
 * values with known probabilities: the mean and the variance are sums over the
 * arms, with no simulation involved.
 */
export interface EstimatorMoments {
  /** The mean of the estimate, per logit — equal to the exact gradient. */
  mean: number[]
  /** The variance of the estimate, per logit. */
  variance: number[]
  /** The standard deviation, per logit. */
  deviation: number[]
  /** The expected squared distance of one estimate from the mean. */
  spread: number
}

export function estimatorMoments(bandit: Bandit, logits: number[], baseline = 0): EstimatorMoments {
  const probabilities = softmax(logits)
  const mean = new Array<number>(probabilities.length).fill(0)
  const second = new Array<number>(probabilities.length).fill(0)
  for (let arm = 0; arm < probabilities.length; arm++) {
    const scores = scoreFunction(probabilities, arm)
    const weight = bandit.rewards[arm]! - baseline
    for (let index = 0; index < mean.length; index++) {
      const term = (scores[index] ?? 0) * weight
      mean[index] = (mean[index] ?? 0) + probabilities[arm]! * term
      second[index] = (second[index] ?? 0) + probabilities[arm]! * term * term
    }
  }
  const variance = mean.map((value, index) => Math.max(0, (second[index] ?? 0) - value * value))
  const deviation = variance.map((value) => Math.sqrt(value))
  return { mean, variance, deviation, spread: Math.sqrt(variance.reduce((sum, value) => sum + value, 0)) }
}

/** The variance reduction the baseline buys, as a ratio of the two spreads. */
export function baselineVarianceEffect(
  bandit: Bandit,
  logits: number[],
): { withoutBaseline: EstimatorMoments; withBaseline: EstimatorMoments; ratio: number } {
  const objective = expectedReward(bandit, logits)
  const without = estimatorMoments(bandit, logits, 0)
  const withIt = estimatorMoments(bandit, logits, objective)
  return { withoutBaseline: without, withBaseline: withIt, ratio: without.spread / (withIt.spread || 1) }
}

/**
 * Draw from the policy and estimate the gradient.
 *
 * The seed is explicit, so a run can be reproduced and compared with the exact
 * moments above.
 */
export function sampledGradient(bandit: Bandit, logits: number[], seed: number, baseline = 0): number[] {
  const rng = createRng(seed)
  const probabilities = softmax(logits)
  const u = rng()
  let arm = 0
  let cumulative = 0
  for (let index = 0; index < probabilities.length; index++) {
    cumulative += probabilities[index]!
    if (u <= cumulative) {
      arm = index
      break
    }
  }
  const scores = scoreFunction(probabilities, arm)
  const weight = bandit.rewards[arm]! - baseline
  return scores.map((value) => value * weight)
}

/** The empirical mean and deviation of many draws, against the exact ones. */
export function sampleStatistics(
  bandit: Bandit,
  logits: number[],
  options: { samples?: number; seed?: number; baseline?: number } = {},
): { mean: number[]; deviation: number[]; samples: number; meanError: number } {
  const settings = { samples: 4000, seed: 3, baseline: 0, ...options }
  const draws: number[][] = []
  for (let index = 0; index < settings.samples; index++) {
    draws.push(sampledGradient(bandit, logits, settings.seed + index * 7919, settings.baseline))
  }
  const size = logits.length
  const mean = new Array<number>(size).fill(0)
  for (const draw of draws) {
    for (let index = 0; index < size; index++) mean[index] = (mean[index] ?? 0) + (draw[index] ?? 0)
  }
  const scaled = mean.map((value) => value / draws.length)
  const deviation = scaled.map((value, index) =>
    Math.sqrt(draws.reduce((sum, draw) => sum + ((draw[index] ?? 0) - value) ** 2, 0) / Math.max(1, draws.length - 1)),
  )
  const exact = directGradient(bandit, logits)
  return { mean: scaled, deviation, samples: draws.length, meanError: maxDifference(scaled, exact) }
}

/**
 * Gradient ascent on the exact gradient.
 *
 * The update is deterministic, so what it shows is the arithmetic of the
 * derivative rather than the luck of a sample: the objective climbs to the best
 * arm, and the step that the derivation says is uphill is uphill.
 */
export function trainBandit(
  bandit: Bandit,
  options: { steps?: number; learningRate?: number; sharpness?: number } = {},
): { logits: number[]; history: { objective: number; best: number }[] } {
  const settings = { steps: 60, learningRate: 0.5, sharpness: 0.5, ...options }
  let logits = banditLogits(bandit, settings.sharpness)
  const history: { objective: number; best: number }[] = []
  const bestArm = best(bandit)
  for (let step = 0; step <= settings.steps; step++) {
    const probabilities = softmax(logits)
    history.push({
      objective: expectedReward(bandit, logits),
      best: probabilities[bestArm] ?? 0,
    })
    const gradient = directGradient(bandit, logits)
    logits = logits.map((value, index) => value + settings.learningRate * (gradient[index] ?? 0))
  }
  return { logits, history }
}

/** The index of the best arm. */
export function best(bandit: Bandit): number {
  let index = 0
  for (let arm = 1; arm < bandit.rewards.length; arm++) {
    if ((bandit.rewards[arm] ?? 0) > (bandit.rewards[index] ?? 0)) index = arm
  }
  return index
}
