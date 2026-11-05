/**
 * The clipped surrogate objective, and the advantage estimates that go with
 * it.
 *
 * PPO's objective (Schulman et al., 2017) is
 *
 *   L^CLIP(θ) = E[ min( r_t A_t, clip(r_t, 1−ε, 1+ε) A_t ) ]
 *
 * where r_t = π_θ(a_t | s_t) / π_old(a_t | s_t) is the importance ratio. The
 * clip is the whole point: it removes the incentive to move a ratio that is
 * already far from one, in whichever direction would increase the objective.
 *
 * Everything here is computed on explicit trajectories, so the objective, its
 * gradient and the behaviour of the clip can all be checked by hand.
 */

import { clamp, createRng } from '@llm-materials/course-core'
import type { Vector } from '@llm-materials/course-core'
import { actionProbs, logProbGradient } from './policy.js'
import type { Bandit } from './policy.js'

export interface TrajectoryStep {
  context: number
  action: number
  /** The reward received at this step, before any KL penalty. */
  reward: number
  /** The value the old policy's critic assigned to the state. */
  value: number
  /** The value of the next state, for the bootstrap term. */
  nextValue: number
  /** Whether this is the last step of the trajectory. */
  terminal: boolean
}

export interface Trajectory {
  steps: TrajectoryStep[]
}

/**
 * The discounted return with a bootstrap term at the end.
 */
export function discountedReturn(trajectory: Trajectory, gamma = 1): number {
  let total = 0
  let discount = 1
  for (const step of trajectory.steps) {
    total += discount * step.reward
    discount *= gamma
  }
  return total
}

/**
 * The one-step temporal-difference residual.
 *
 * δ_t = r_t + γ V(s_{t+1}) − V(s_t)
 */
export function tdResidual(step: TrajectoryStep, gamma = 1): number {
  const bootstrap = step.terminal ? 0 : gamma * step.nextValue
  return step.reward + bootstrap - step.value
}

/**
 * Generalised advantage estimation.
 *
 * A_t^GAE(γ, λ) = Σ_{l ≥ 0} (γλ)^l δ_{t+l}
 *
 * λ = 0 is the one-step advantage (low variance, high bias); λ = 1 is the
 * Monte Carlo return (unbiased, high variance). The bias–variance trade-off
 * is the reason λ is a hyperparameter at all.
 */
export function generalisedAdvantage(trajectory: Trajectory, gamma = 1, lambda = 0.95): number[] {
  const steps = trajectory.steps
  const advantages = new Array<number>(steps.length).fill(0)
  let running = 0

  for (let t = steps.length - 1; t >= 0; t--) {
    const step = steps[t]!
    running = tdResidual(step, gamma) + (step.terminal ? 0 : gamma * lambda * running)
    advantages[t] = running
  }

  return advantages
}

/** The value targets the advantages are regressed onto. */
export function valueTargets(trajectory: Trajectory, advantages: number[]): number[] {
  return trajectory.steps.map((step, index) => step.value + advantages[index]!)
}

/**
 * The importance ratio of one step.
 */
export function importanceRatio(bandit: Bandit, oldPolicy: Bandit, step: TrajectoryStep): number {
  const current = actionProbs(bandit, step.context)[step.action] ?? 0
  const old = actionProbs(oldPolicy, step.context)[step.action] ?? 0
  if (old <= 0) return 1
  return current / old
}

/**
 * The unclipped surrogate for one step.
 */
export function surrogate(ratio: number, advantage: number): number {
  return ratio * advantage
}

/**
 * The clipped surrogate for one step.
 *
 * The minimum is what makes the clip bite: when the advantage is positive the
 * objective is capped once the ratio passes 1+ε, and when the advantage is
 * negative it is capped once the ratio falls below 1−ε. In both cases the
 * gradient becomes zero beyond the bound, which is the mechanism the whole
 * algorithm rests on.
 */
export function clippedSurrogate(ratio: number, advantage: number, epsilon = 0.2): number {
  const clipped = clamp(ratio, 1 - epsilon, 1 + epsilon)
  return Math.min(ratio * advantage, clipped * advantage)
}

/**
 * Whether the clip is active for a step — that is, whether the clipped and
 * unclipped objectives differ.
 */
export function clipIsActive(ratio: number, advantage: number, epsilon = 0.2): boolean {
  return clippedSurrogate(ratio, advantage, epsilon) !== surrogate(ratio, advantage)
}

/**
 * The gradient of the clipped objective with respect to the ratio.
 *
 * It is zero wherever the clip is active, and the ratio's gradient otherwise.
 */
export function clippedSurrogateRatioGradient(ratio: number, advantage: number, epsilon = 0.2): number {
  const clipped = clamp(ratio, 1 - epsilon, 1 + epsilon)
  if (clipped !== ratio) {
    // The clip is active. The gradient is zero unless the two branches tie.
    return 0
  }
  return advantage
}

export interface PpoStepResult {
  ratio: number
  advantage: number
  unclipped: number
  clipped: number
  clipActive: boolean
}

export interface PpoEvaluation {
  steps: PpoStepResult[]
  /** The mean unclipped surrogate. */
  meanUnclipped: number
  /** The mean clipped surrogate. */
  meanClipped: number
  /** The fraction of steps where the clip was active. */
  clipFraction: number
  /** The mean importance ratio. */
  meanRatio: number
}

/**
 * Evaluate the PPO objective on a trajectory, for a given policy and the
 * policy it was collected under.
 */
export function evaluatePpo(
  bandit: Bandit,
  oldPolicy: Bandit,
  trajectory: Trajectory,
  advantages: number[],
  epsilon = 0.2,
): PpoEvaluation {
  const steps: PpoStepResult[] = []

  for (let t = 0; t < trajectory.steps.length; t++) {
    const step = trajectory.steps[t]!
    const ratio = importanceRatio(bandit, oldPolicy, step)
    const advantage = advantages[t]!
    const unclipped = surrogate(ratio, advantage)
    const clipped = clippedSurrogate(ratio, advantage, epsilon)
    steps.push({ ratio, advantage, unclipped, clipped, clipActive: clipIsActive(ratio, advantage, epsilon) })
  }

  const count = steps.length
  return {
    steps,
    meanUnclipped: count === 0 ? 0 : steps.reduce((a, s) => a + s.unclipped, 0) / count,
    meanClipped: count === 0 ? 0 : steps.reduce((a, s) => a + s.clipped, 0) / count,
    clipFraction: count === 0 ? 0 : steps.filter((s) => s.clipActive).length / count,
    meanRatio: count === 0 ? 1 : steps.reduce((a, s) => a + s.ratio, 0) / count,
  }
}

/**
 * The gradient of the mean clipped objective with respect to the logits.
 *
 * For a step whose clip is not active, the gradient is
 * advantage · r_t · ∇log π(a|s), which is the usual policy gradient scaled
 * by the importance ratio. For a clipped step it is zero.
 */
export function ppoGradient(
  bandit: Bandit,
  oldPolicy: Bandit,
  trajectory: Trajectory,
  advantages: number[],
  epsilon = 0.2,
): number[] {
  const gradient = new Array<number>(bandit.logits.length).fill(0)

  for (let t = 0; t < trajectory.steps.length; t++) {
    const step = trajectory.steps[t]!
    const ratio = importanceRatio(bandit, oldPolicy, step)
    const advantage = advantages[t]!
    const ratioGradient = clippedSurrogateRatioGradient(ratio, advantage, epsilon)
    if (ratioGradient === 0) continue

    const logGradient = logProbGradient(bandit, step.context, step.action)
    for (let j = 0; j < bandit.actions; j++) {
      gradient[step.context * bandit.actions + j] +=
        ratioGradient * ratio * (logGradient[j] ?? 0)
    }
  }

  const count = Math.max(1, trajectory.steps.length)
  return gradient.map((value) => value / count)
}

/**
 * The value-function loss and its gradient.
 *
 * The critic is regressed onto the advantage targets, and the loss is the
 * mean squared error.
 */
export function valueLossAndGradient(
  values: Vector,
  targets: Vector,
): { loss: number; gradient: number[] } {
  let loss = 0
  const gradient = new Array<number>(values.length).fill(0)
  for (let i = 0; i < values.length; i++) {
    const error = (values[i] ?? 0) - (targets[i] ?? 0)
    loss += error * error
    gradient[i] = (2 * error) / Math.max(1, values.length)
  }
  return { loss: loss / Math.max(1, values.length), gradient }
}

/**
 * The objective a trust-region method maximises, and its gradient.
 *
 * L = E[ r_t A_t ] subject to KL(π_θ ‖ π_old) ≤ δ.
 *
 * The surrogate is the same as PPO's without the clip; the constraint is what
 * the clip is a cheap approximation to.
 */
export function trustRegionSurrogate(
  bandit: Bandit,
  oldPolicy: Bandit,
  trajectory: Trajectory,
  advantages: number[],
): { objective: number; gradient: number[] } {
  const gradient = new Array<number>(bandit.logits.length).fill(0)
  let objective = 0

  for (let t = 0; t < trajectory.steps.length; t++) {
    const step = trajectory.steps[t]!
    const ratio = importanceRatio(bandit, oldPolicy, step)
    const advantage = advantages[t] ?? 0
    objective += ratio * advantage
    const logGradient = logProbGradient(bandit, step.context, step.action)
    for (let j = 0; j < bandit.actions; j++) {
      gradient[step.context * bandit.actions + j] += advantage * ratio * (logGradient[j] ?? 0)
    }
  }

  const count = Math.max(1, trajectory.steps.length)
  return { objective: objective / count, gradient: gradient.map((value) => value / count) }
}

/**
 * Advantage normalisation: what subtracting the mean costs, and what dividing
 * by the standard deviation buys.
 *
 * Every PPO implementation ships with `advantages = (A − A.mean()) /
 * A.std()` over the minibatch, and it is usually described as a variance
 * reduction. It is not, or not only. Subtracting a *fixed* baseline leaves the
 * gradient exactly unchanged, because the score function averages to zero; the
 * implementations subtract the mean *of the same sample*, and that survivor is
 * computable: the cross terms vanish and the diagonal ones leave -1/N of the
 * gradient behind, so the averaged estimator is (1 - 1/N) of the true one, in
 * the right direction and the wrong length. Dividing by the sample's standard
 * deviation is not a baseline at all — it rescales the gradient by a random
 * factor, which preserves its direction and throws away its size. The study
 * below measures both, rather than repeating the comment in the code review.
 */
export interface NormalisedAdvantages {
  mean: number
  /** The population standard deviation of the batch, which is what implementations divide by. */
  standardDeviation: number
  centred: number[]
  whitened: number[]
}

/**
 * Centre and whiten one batch of advantages.
 *
 * A batch whose spread is below `epsilon` is left unscaled: the guard is in
 * every real implementation, and it is the reason a batch of identical
 * advantages produces zeros rather than an explosion.
 */
export function normaliseAdvantages(advantages: number[], epsilon = 1e-8): NormalisedAdvantages {
  const count = advantages.length
  const mean = count === 0 ? 0 : advantages.reduce((sum, value) => sum + value, 0) / count
  const variance =
    count === 0 ? 0 : advantages.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count
  const standardDeviation = Math.sqrt(variance)
  const divisor = standardDeviation > epsilon ? standardDeviation : 1
  return {
    mean,
    standardDeviation,
    centred: advantages.map((value) => value - mean),
    whitened: advantages.map((value) => (value - mean) / divisor),
  }
}

/** The advantage of every action against a critic that scores each context with one number. */
export function criticAdvantages(rewards: number[][], critic: number[]): number[][] {
  return rewards.map((row, context) => row.map((reward) => reward - (critic[context] ?? 0)))
}

/**
 * The exact gradient of E[A · ∇log π], averaged over the contexts.
 *
 * This is what a minibatch estimator is trying to say, with no sampling: the
 * expectation over actions is a finite sum, and the contexts are drawn uniformly.
 */
export function advantageGradient(bandit: Bandit, advantages: number[][]): number[] {
  const gradient = new Array<number>(bandit.logits.length).fill(0)
  for (let context = 0; context < bandit.contexts; context++) {
    const probs = actionProbs(bandit, context)
    const row = advantages[context] ?? []
    for (let action = 0; action < bandit.actions; action++) {
      const weight = (probs[action] ?? 0) * (row[action] ?? 0)
      if (weight === 0) continue
      const logGradient = logProbGradient(bandit, context, action)
      for (let j = 0; j < bandit.actions; j++) {
        gradient[context * bandit.actions + j] += weight * (logGradient[j] ?? 0)
      }
    }
  }
  return gradient.map((value) => value / Math.max(1, bandit.contexts))
}

/**
 * Draw a minibatch of (context, action) pairs and their advantages.
 *
 * The contexts are uniform and the actions come from the policy, which is what
 * an on-collector does between two updates. Each step is a one-step episode, so
 * its advantage is the reward minus the critic — no returns, no λ, and nothing
 * to attribute to the estimator's error but normalisation itself.
 */
export function sampleAdvantageBatch(
  bandit: Bandit,
  rewards: number[][],
  critic: number[],
  batchSize: number,
  seed: number,
): { trajectory: Trajectory; advantages: number[] } {
  const rng = createRng(seed)
  const trajectory: Trajectory = { steps: [] }
  const advantages: number[] = []

  for (let index = 0; index < batchSize; index++) {
    const context = Math.min(bandit.contexts - 1, Math.floor(rng() * bandit.contexts))
    const probs = actionProbs(bandit, context)
    let draw = rng()
    let action = bandit.actions - 1
    for (let candidate = 0; candidate < bandit.actions; candidate++) {
      draw -= probs[candidate] ?? 0
      if (draw <= 0) {
        action = candidate
        break
      }
    }
    const step: TrajectoryStep = {
      context,
      action,
      reward: rewards[context]?.[action] ?? 0,
      value: critic[context] ?? 0,
      nextValue: 0,
      terminal: true,
    }
    trajectory.steps.push(step)
    advantages.push(tdResidual(step, 1))
  }

  return { trajectory, advantages }
}

export type AdvantageTreatment = 'raw' | 'centred' | 'whitened'

export interface TreatmentEstimate {
  treatment: AdvantageTreatment
  /** The average of the batch estimators. */
  mean: number[]
  /** The angle between the averaged estimator and the exact gradient. */
  cosine: number
  /**
   * How long the averaged estimator is, relative to the exact gradient.
   *
   * This is the number that separates the treatments. Subtracting the batch's
   * own mean leaves one term behind — the samples that appear in both the
   * advantage and the mean — and it is worth exactly -1/N of the gradient, so
   * the averaged estimator shrinks to (1 - 1/N) of its true length. Distance
   * from the exact gradient cannot show that: a noisy estimator wanders in
   * every direction, and the wander swamps a shrinkage of one over N.
   */
  shrinkage: number
  /** The average length of a single batch's estimate: the step size that batch would have taken. */
  meanNorm: number
  /** How much that length varied from batch to batch. */
  normSpread: number
}

export interface AdvantageStudy {
  batches: number
  batchSize: number
  exact: number[]
  /** The exact gradient with the population mean subtracted from every advantage. */
  populationCentredResidual: number
  treatments: TreatmentEstimate[]
}

/**
 * Estimate the same gradient once per treatment and compare each with the
 * analytic answer.
 */
export function advantageStudy(
  bandit: Bandit,
  rewards: number[][],
  critic: number[],
  options: { batches?: number; batchSize?: number; seed?: number } = {},
): AdvantageStudy {
  const batches = options.batches ?? 2000
  const batchSize = options.batchSize ?? 32
  const seed = options.seed ?? 1

  const advantages = criticAdvantages(rewards, critic)
  const exact = advantageGradient(bandit, advantages)
  const all = advantages.flat()
  const populationMean = all.reduce((sum, value) => sum + value, 0) / Math.max(1, all.length)
  const centredMatrix = advantages.map((row) => row.map((value) => value - populationMean))
  const populationCentredResidual = Math.max(
    ...advantageGradient(bandit, centredMatrix).map((value, index) => Math.abs(value - exact[index]!)),
  )

  const treatments: Record<AdvantageTreatment, number[][]> = { raw: [], centred: [], whitened: [] }
  for (let batch = 0; batch < batches; batch++) {
    const sample = sampleAdvantageBatch(bandit, rewards, critic, batchSize, seed * 100_000 + batch)
    for (const treatment of ['raw', 'centred', 'whitened'] as AdvantageTreatment[]) {
      const values =
        treatment === 'raw'
          ? sample.advantages
          : treatment === 'centred'
            ? normaliseAdvantages(sample.advantages).centred
            : normaliseAdvantages(sample.advantages).whitened
      treatments[treatment].push(ppoGradient(bandit, bandit, sample.trajectory, values, 0.2))
    }
  }

  const average = (rows: number[][]) =>
    rows[0]!.map((_, index) => rows.reduce((sum, row) => sum + row[index]!, 0) / rows.length)
  const length = (row: number[]) => Math.sqrt(row.reduce((sum, value) => sum + value * value, 0))

  return {
    batches,
    batchSize,
    exact,
    populationCentredResidual,
    treatments: (['raw', 'centred', 'whitened'] as AdvantageTreatment[]).map((treatment) => {
      const rows = treatments[treatment]
      const mean = average(rows)
      const norms = rows.map(length)
      const meanNorm = norms.reduce((sum, value) => sum + value, 0) / norms.length
      const dot = mean.reduce((sum, value, index) => sum + value * exact[index]!, 0)
      return {
        treatment,
        mean,
        cosine: dot / (length(mean) * length(exact) || 1),
        shrinkage: length(mean) / (length(exact) || 1),
        meanNorm,
        normSpread: Math.sqrt(norms.reduce((sum, value) => sum + (value - meanNorm) ** 2, 0) / norms.length),
      }
    }),
  }
}
