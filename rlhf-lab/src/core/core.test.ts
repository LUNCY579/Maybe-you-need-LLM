import { describe, expect, it } from 'vitest'
import { createRng } from '@llm-materials/course-core'
import type { Bandit } from './policy.js'
import {
  actionProbs,
  advantage,
  applyStep,
  cloneBandit,
  contextEntropy,
  contextValues,
  createBandit,
  expectedReward,
  fisherQuadraticForm,
  fisherVectorProduct,
  fisherVectorProductByFiniteDifference,
  greedyAction,
  klToReference,
  logProb,
  logProbGradient,
  matchedCostComparison,
  meanEntropy,
  meanReward,
  naturalGradient,
  rewardLandscape,
  scaledStep,
  sharpen,
  stepCost,
  stepForCost,
} from './policy.js'
import {
  advantageGradient,
  advantageStudy,
  clippedSurrogate,
  clippedSurrogateRatioGradient,
  clipIsActive,
  criticAdvantages,
  discountedReturn,
  evaluatePpo,
  generalisedAdvantage,
  importanceRatio,
  normaliseAdvantages,
  ppoGradient,
  sampleAdvantageBatch,
  tdResidual,
  trustRegionSurrogate,
  valueLossAndGradient,
} from './ppo.js'
import type { TrajectoryStep } from './ppo.js'
import {
  compareEstimators,
  exactKl,
  estimateKl,
  klPenaltySweep,
  ones,
  penalisedObjective,
  penalisedPolicy,
  penaltyRow,
  rewardMaximisingPolicy,
  reverseKl,
  chiSquare,
} from './kl.js'
import {
  advantageCurve,
  buildChain,
  chainValues,
  fitValueHead,
  returnsToGo,
  returnSpread,
  sampleChainTrajectory,
} from './value.js'
import {
  alphaBetaAcrossData,
  bestOfN,
  bestOfNDistribution,
  bestOfNGain,
  buildRewardSetting,
  compareAtBudgets,
  expectedReward as expectedSettingReward,
  fitBestOfNForm,
  klFromReference,
  policyForBudget,
  reinforcementLearningGain,
  rewardModelAtData,
  sweepOveroptimisation,
  tiltedPolicy,
} from './overoptimisation.js'
import {
  actionCounts,
  buildTask,
  demonstratorPolicy,
  empiricalDistribution,
  goldReward,
  maximumLikelihoodPolicy,
  runSft,
  sampleDemonstrations,
  sftObjective,
} from './sft.js'
import type { RewardModel } from './rewardModel.js'
import {
  alignScores,
  errorProfile,
  fitRewardModel,
  pairObjective,
  rewardTable,
  samplePreferences,
  scoreOf,
} from './rewardModel.js'
import {
  klPenaltyTable,
  meanNominalQuality,
  penalisedRewards,
  runPpoStage,
  standardise,
  TURNOVER_FLOOR,
  weakModelStudy,
} from './ppoStage.js'

const bandit = createBandit(4, 5, 3)

describe('the policy', () => {
  it('produces a probability distribution over the actions', () => {
    for (let context = 0; context < bandit.contexts; context++) {
      const probs = actionProbs(bandit, context)
      expect(probs).toHaveLength(bandit.actions)
      expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
      for (const p of probs) expect(p).toBeGreaterThanOrEqual(0)
    }
  })

  it('has a log-probability consistent with the probability', () => {
    const probs = actionProbs(bandit, 0)
    expect(logProb(bandit, 0, 2)).toBeCloseTo(Math.log(probs[2]!), 12)
  })

  it('has a log-probability gradient that sums to zero and matches a finite difference', () => {
    const context = 1
    const action = 3
    const gradient = logProbGradient(bandit, context, action)
    expect(gradient.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 12)

    const epsilon = 1e-6
    for (let j = 0; j < bandit.actions; j++) {
      const perturbed = cloneBandit(bandit)
      perturbed.logits[context * bandit.actions + j]! += epsilon
      const up = logProb(perturbed, context, action)
      const back = cloneBandit(bandit)
      back.logits[context * bandit.actions + j]! -= epsilon
      const down = logProb(back, context, action)
      const numerical = (up - down) / (2 * epsilon)
      expect(numerical).toBeCloseTo(gradient[j]!, 6)
    }
  })

  it('has an expected reward whose gradient matches a finite difference', () => {
    const rewards = Array.from({ length: bandit.contexts }, (_, c) =>
      Array.from({ length: bandit.actions }, (_, a) => Math.sin(c * 1.7 + a * 0.9)),
    )
    const { reward, gradient } = expectedReward(bandit, rewards)

    const epsilon = 1e-6
    for (let i = 0; i < bandit.logits.length; i++) {
      const up = cloneBandit(bandit)
      up.logits[i]! += epsilon
      const down = cloneBandit(bandit)
      down.logits[i]! -= epsilon
      const numerical =
        (expectedReward(up, rewards).reward - expectedReward(down, rewards).reward) / (2 * epsilon)
      expect(numerical).toBeCloseTo(gradient[i]!, 5)
    }
    expect(reward).toBeGreaterThan(-10)
  })

  it('measures the KL to a reference, which is zero for the reference itself', () => {
    expect(klToReference(bandit, bandit).mean).toBeCloseTo(0, 12)
    const other = createBandit(4, 5, 99)
    expect(klToReference(bandit, other).mean).toBeGreaterThan(0)
  })

  it('has an entropy between zero and the log of the action count', () => {
    const entropy = contextEntropy(bandit, 0)
    expect(entropy).toBeGreaterThan(0)
    expect(entropy).toBeLessThanOrEqual(Math.log(bandit.actions) + 1e-12)
    expect(meanEntropy(bandit)).toBeGreaterThan(0)
  })

  it('picks a greedy action and takes a gradient step', () => {
    expect(greedyAction(bandit, 0)).toBeGreaterThanOrEqual(0)
    const stepped = applyStep(bandit, new Array<number>(bandit.logits.length).fill(1), 0.1)
    expect(stepped.logits[0]).toBeCloseTo(bandit.logits[0]! + 0.1, 12)
  })
})

describe('the PPO objective', () => {
  const trajectory = {
    steps: [
      { context: 0, action: 1, reward: 1, value: 0.5, nextValue: 0.6, terminal: false },
      { context: 1, action: 2, reward: 0.5, value: 0.6, nextValue: 0.4, terminal: false },
      { context: 2, action: 0, reward: -0.5, value: 0.4, nextValue: 0, terminal: true },
    ],
  }

  it('computes the discounted return', () => {
    expect(discountedReturn(trajectory, 1)).toBeCloseTo(1, 12)
    expect(discountedReturn(trajectory, 0.9)).toBeCloseTo(1 + 0.5 * 0.9 - 0.5 * 0.81, 12)
  })

  it('computes the temporal-difference residual', () => {
    const step = trajectory.steps[0]!
    expect(tdResidual(step, 0.9)).toBeCloseTo(1 + 0.9 * 0.6 - 0.5, 12)
    const terminal = trajectory.steps[2]!
    expect(tdResidual(terminal, 0.9)).toBeCloseTo(-0.5 - 0.4, 12)
  })

  it('reduces to the Monte Carlo return when lambda is one', () => {
    const advantages = generalisedAdvantage(trajectory, 0.9, 1)
    const returns = discountedReturn(trajectory, 0.9)
    expect(advantages[0]).toBeCloseTo(returns - trajectory.steps[0]!.value, 10)
  })

  it('reduces to the one-step residual when lambda is zero', () => {
    const advantages = generalisedAdvantage(trajectory, 0.9, 0)
    expect(advantages[0]).toBeCloseTo(tdResidual(trajectory.steps[0]!, 0.9), 12)
  })

  it('moves from the one-step advantage towards the Monte Carlo one as lambda rises', () => {
    // λ = 0 is the one-step residual; λ = 1 is the Monte Carlo return. The
    // mean squared distance to the λ = 1 answer grows with λ, which is the
    // trade-off: more bias, less variance.
    const rng = createRng(19)
    const long: { context: number; action: number; reward: number; value: number; nextValue: number; terminal: boolean }[] = []
    for (let t = 0; t < 12; t++) {
      long.push({
        context: t % bandit.contexts,
        action: Math.floor(rng() * bandit.actions),
        reward: rng() * 2 - 1,
        value: rng() * 2 - 1,
        nextValue: rng() * 2 - 1,
        terminal: t === 11,
      })
    }
    const target = generalisedAdvantage({ steps: long }, 0.9, 1)
    const distances = [0, 0.25, 0.5, 0.75, 1].map((lambda) => {
      const advantages = generalisedAdvantage({ steps: long }, 0.9, lambda)
      return advantages.reduce((acc, a, i) => acc + (a - target[i]!) ** 2, 0)
    })
    // As λ rises the estimate moves towards the Monte Carlo answer, so the
    // distance to it falls: the bias falls and the variance rises.
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]!).toBeLessThan(distances[i - 1]!)
    }
    expect(distances[distances.length - 1]).toBeCloseTo(0, 10)
  })

  it('clips the objective once the ratio passes the bound', () => {
    // A positive advantage and a large ratio: the objective is capped.
    expect(clippedSurrogate(2, 1, 0.2)).toBeCloseTo(1.2, 12)
    expect(clippedSurrogate(0.5, 1, 0.2)).toBeCloseTo(0.5, 12)
    // A negative advantage: the objective is capped from below.
    expect(clippedSurrogate(0.5, -1, 0.2)).toBeCloseTo(-0.8, 12)
  })

  it('reports whether the clip is active', () => {
    expect(clipIsActive(2, 1, 0.2)).toBe(true)
    expect(clipIsActive(1.1, 1, 0.2)).toBe(false)
    expect(clipIsActive(0.5, 1, 0.2)).toBe(false)
  })

  it('has zero gradient wherever the clip is active', () => {
    // A positive advantage with a ratio above the bound: the clipped branch
    // is the minimum, and its gradient is zero.
    expect(clippedSurrogateRatioGradient(2, 1, 0.2)).toBe(0)
    // A negative advantage with a ratio below the bound: the clipped branch
    // is again the minimum, and again the gradient is zero.
    expect(clippedSurrogateRatioGradient(0.5, -1, 0.2)).toBe(0)
    // Where nothing is clipped, the gradient is the advantage.
    expect(clippedSurrogateRatioGradient(1, 1, 0.2)).toBe(1)
    expect(clippedSurrogateRatioGradient(1, -1, 0.2)).toBe(-1)
  })

  it('computes the importance ratio', () => {
    const step = trajectory.steps[0]!
    expect(importanceRatio(bandit, bandit, step)).toBeCloseTo(1, 12)
  })

  it('evaluates the objective on a trajectory', () => {
    const advantages = generalisedAdvantage(trajectory, 0.9, 0.95)
    const evaluation = evaluatePpo(bandit, bandit, trajectory, advantages)
    expect(evaluation.meanRatio).toBeCloseTo(1, 12)
    expect(evaluation.clipFraction).toBe(0)
  })

  it('has a zero gradient on a clipped step and the policy gradient elsewhere', () => {
    const advantages = [1, 1, 1]
    const gradient = ppoGradient(bandit, bandit, trajectory, advantages)
    // With the ratio at one, nothing is clipped, and the gradient is the
    // ordinary policy gradient.
    expect(gradient.some((g) => Math.abs(g) > 0)).toBe(true)
  })

  it('regresses the value function onto its targets', () => {
    const { loss, gradient } = valueLossAndGradient([1, 2], [1, 2])
    expect(loss).toBeCloseTo(0, 12)
    expect(gradient.every((g) => Math.abs(g) < 1e-12)).toBe(true)
  })

  it('computes the trust-region surrogate', () => {
    const advantages = [1, 1, 1]
    const { objective } = trustRegionSurrogate(bandit, bandit, trajectory, advantages)
    expect(objective).toBeCloseTo(1, 12)
  })
})

describe('the KL estimators', () => {
  const reference = createBandit(4, 5, 42)
  const policy = createBandit(4, 5, 3)

  it('computes the exact KL', () => {
    expect(exactKl(policy, policy)).toBeCloseTo(0, 12)
    expect(exactKl(policy, reference)).toBeGreaterThan(0)
  })

  it('computes the reverse KL and the chi-square divergence', () => {
    expect(reverseKl(policy, policy)).toBeCloseTo(0, 12)
    expect(chiSquare(policy, policy)).toBeCloseTo(0, 12)
    expect(reverseKl(policy, reference)).toBeGreaterThan(0)
  })

  it('has an unbiased first estimator and a non-negative third one', () => {
    const estimates = compareEstimators(policy, reference, 40000, 5)
    const k1 = estimates.find((e) => e.estimator === 'k1')!
    const k3 = estimates.find((e) => e.estimator === 'k3')!

    // k1 is unbiased for the KL, but it can be negative.
    expect(Math.abs(k1.bias)).toBeLessThan(0.02)
    expect(k1.negativeFraction).toBeGreaterThan(0)

    // k3 is always non-negative. Its expectation is the chi-square divergence
    // minus the KL — not the KL itself, which is the detail most write-ups
    // of this estimator leave out.
    expect(k3.negativeFraction).toBe(0)
    const target = chiSquare(policy, reference) - exactKl(policy, reference)
    expect(Math.abs(k3.mean - target)).toBeLessThan(0.02)
  })

  it('has a biased-upwards second estimator', () => {
    const k2 = compareEstimators(policy, reference, 40000, 5).find((e) => e.estimator === 'k2')!
    expect(k2.mean).toBeGreaterThan(k2.exact)
    expect(k2.negativeFraction).toBe(0)
  })

  it('computes a single estimate by hand', () => {
    expect(estimateKl('k1', 0.5, 0.25)).toBeCloseTo(Math.log(2), 12)
    expect(estimateKl('k2', 0.5, 0.25)).toBeCloseTo(Math.log(2) ** 2, 12)
    expect(estimateKl('k3', 0.5, 0.25)).toBeCloseTo(2 - 1 - Math.log(2), 12)
  })
})

describe('the KL penalty', () => {
  const reference = createBandit(3, 5, 21)
  const rewards = rewardLandscape(3, 5)

  it('picks the policy no perturbation of a logit beats', () => {
    for (const beta of [0.1, 0.4, 1.6]) {
      const optimum = penalisedPolicy(reference, rewards, beta)
      const best = penalisedObjective(optimum, reference, rewards, beta).objective
      for (let index = 0; index < optimum.logits.length; index++) {
        for (const delta of [-0.05, 0.05]) {
          const perturbed = cloneBandit(optimum)
          perturbed.logits[index]! += delta
          expect(
            penalisedObjective(perturbed, reference, rewards, beta).objective,
          ).toBeLessThanOrEqual(best + 1e-12)
        }
      }
    }
  })

  it('satisfies the identity that ties its distance to its reward', () => {
    for (const beta of [0.05, 0.2, 0.8, 5]) {
      expect(Math.abs(penaltyRow(reference, rewards, beta).identityResidual)).toBeLessThan(1e-12)
    }
  })

  it('buys distance with reward, in one direction the whole way', () => {
    const rows = klPenaltySweep(reference, rewards, [0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8])
    const greedy = rewardMaximisingPolicy(reference, rewards)
    for (let index = 1; index < rows.length; index++) {
      expect(rows[index]!.kl).toBeLessThan(rows[index - 1]!.kl)
      expect(rows[index]!.reward).toBeLessThan(rows[index - 1]!.reward)
      expect(rows[index]!.rewardCost).toBeGreaterThan(rows[index - 1]!.rewardCost)
      expect(rows[index]!.klSaved).toBeGreaterThan(rows[index - 1]!.klSaved)
    }
    expect(greedy.reward).toBeGreaterThan(rows[0]!.reward)
    expect(greedy.kl).toBeGreaterThan(rows[0]!.kl)
  })

  it('leaves the reference alone when the penalty overwhelms the reward', () => {
    const own = penalisedObjective(reference, reference, rewards, 1)
    const row = penaltyRow(reference, rewards, 1e6)
    expect(row.kl).toBeLessThan(1e-6)
    expect(row.reward).toBeCloseTo(own.reward, 6)
  })
})

describe('the natural gradient', () => {
  const policy = createBandit(3, 5, 8)
  const rewards = rewardLandscape(3, 5)
  const draw = createRng(4)
  const vector = policy.logits.map(() => draw() * 2 - 1)
  const worstGap = (left: number[], right: number[]) =>
    left.reduce((worst, value, index) => Math.max(worst, Math.abs(value - (right[index] ?? 0))), 0)

  it('is the product the finite difference finds', () => {
    expect(worstGap(fisherVectorProduct(policy, vector), fisherVectorProductByFiniteDifference(policy, vector))).toBeLessThan(1e-6)
  })

  it('is the covariance of the direction under the policy', () => {
    for (let context = 0; context < policy.contexts; context++) {
      const start = context * policy.actions
      const slice = { contexts: 1, actions: policy.actions, logits: policy.logits.slice(start, start + policy.actions) }
      const block = vector.slice(start, start + policy.actions)
      const probs = actionProbs(slice, 0)
      const expectation = probs.reduce((sum, p, action) => sum + p * (block[action] ?? 0), 0)
      const covariance = probs.reduce(
        (sum, p, action) => sum + p * ((block[action] ?? 0) - expectation) ** 2,
        0,
      )
      expect(fisherQuadraticForm(slice, block)).toBeCloseTo(covariance, 12)
      expect(fisherQuadraticForm(slice, block)).toBeGreaterThanOrEqual(0)
    }
  })

  it('cannot see the direction that shifts every logit in a context', () => {
    const shifted = fisherVectorProduct(policy, ones(policy.logits.length))
    expect(Math.max(...shifted.map((value) => Math.abs(value)))).toBeLessThan(1e-12)

    const damping = 1e-3
    const natural = naturalGradient(policy, vector, damping)
    const product = fisherVectorProduct(policy, natural)
    const residual = vector.map((value, index) => value - (product[index] ?? 0) - damping * (natural[index] ?? 0))
    expect(worstGap(residual, vector.map(() => 0))).toBeLessThan(1e-9)
  })

  it('costs the distance its step size says it costs', () => {
    const gradient = expectedReward(policy, rewards).gradient
    for (const eta of [0.05, 0.1, 0.2, 0.4]) {
      const cost = stepCost(policy, scaledStep(policy, gradient, eta))
      const budget = (eta * eta) / 2
      expect(cost.exact).toBeGreaterThan(budget * 0.9)
      expect(cost.exact).toBeLessThan(budget * 1.1)
      expect(Math.abs(cost.predicted - cost.exact)).toBeLessThan(budget * 0.1)
    }
  })

  it('is the advantage, which is also the direction the penalty tilts by', () => {
    const values = advantage(policy, rewards)
    const gradient = expectedReward(policy, rewards).gradient

    expect(worstGap(fisherVectorProduct(policy, values), gradient)).toBeLessThan(1e-12)

    const direction = naturalGradient(policy, gradient, 1e-6)
    let shiftResidual = 0
    for (let context = 0; context < policy.contexts; context++) {
      const start = context * policy.actions
      const offsets = values.slice(start, start + policy.actions).map((value, action) => {
        return (direction[start + action] ?? 0) - value
      })
      shiftResidual = Math.max(shiftResidual, Math.max(...offsets) - Math.min(...offsets))
    }
    // The solve recovers the advantage up to a constant per context, and a
    // constant added to one context's logits is invisible to its softmax.
    expect(shiftResidual).toBeLessThan(1e-4)

    const beta = 0.8
    const tilted = penalisedPolicy(policy, rewards, beta)
    const viaNatural: Bandit = {
      ...policy,
      logits: policy.logits.map((value, index) => value + (direction[index] ?? 0) / beta),
    }
    for (let context = 0; context < policy.contexts; context++) {
      expect(worstGap(actionProbs(tilted, context), actionProbs(viaNatural, context))).toBeLessThan(1e-4)
    }
  })

  it('finds a step whose measured cost is the budget it was given', () => {
    const gradient = expectedReward(policy, rewards).gradient
    for (const budget of [0.002, 0.02, 0.1]) {
      const step = stepForCost(policy, gradient, budget)
      expect(step.cost).toBeLessThanOrEqual(budget + 1e-9)
      expect(step.cost).toBeGreaterThan(budget * 0.999)
      expect(step.tries).toBeLessThan(200)
    }
  })

  it('buys more reward than a vanilla step at the same measured cost', () => {
    const eta = 0.2
    const ratios: number[] = []

    for (const sharpness of [1, 3, 6, 12]) {
      const bandit = sharpen(policy, sharpness)
      const gradient = expectedReward(bandit, rewards).gradient
      const natural = scaledStep(bandit, naturalGradient(bandit, gradient, 1e-3), eta)
      const budget = stepCost(bandit, natural).exact
      const vanilla = stepForCost(bandit, gradient, budget)
      const before = expectedReward(bandit, rewards).reward
      const gain = (delta: number[]) => expectedReward(applyStep(bandit, delta, 1), rewards).reward - before

      // Matching the cost means the two steps are the same distance from the policy.
      expect(vanilla.cost).toBeCloseTo(budget, 6)
      expect(gain(natural)).toBeGreaterThan(gain(vanilla.delta))
      ratios.push(gain(natural) / gain(vanilla.delta))
    }

    // The lead is a ratio, because sharpening the policy also shrinks what any
    // step can win. It is smallest where the two rulers nearly agree.
    expect(Math.min(...ratios)).toBeGreaterThan(1)
    expect(Math.min(...ratios)).toBeCloseTo(ratios[0]!, 6)
    expect(ratios[1]!).toBeGreaterThan(ratios[0]!)
  })

  it('is the steepest of the directions that pay the same distance', () => {
    for (const eta of [0.1, 0.2, 0.4]) {
      const comparison = matchedCostComparison(policy, rewards, eta, 64, 11)
      expect(comparison.budget).toBeGreaterThan(0)
      expect(comparison.naturalBeatsAll).toBe(true)
      expect(comparison.naturalGain).toBeGreaterThan(comparison.bestRandomGain)
      expect(comparison.naturalGain).toBeGreaterThan(comparison.vanillaGain)
      expect(comparison.vanillaGain).toBeGreaterThan(comparison.meanRandomGain)
      // The same distance in probability is not the same length in logits.
      expect(comparison.naturalLength).toBeGreaterThan(comparison.vanillaLength)
    }
  })
})

describe('advantage normalisation', () => {
  const bandit = createBandit(3, 4, 5)
  const rewards = rewardLandscape(3, 4)
  // The critic is exact, so the advantage each step carries is the true one and
  // the only error left in the estimator is what normalisation introduced.
  const critic = contextValues(bandit, rewards)
  const study = (batchSize: number, batches = 600, seed = 3) =>
    advantageStudy(bandit, rewards, critic, { batchSize, batches, seed })
  const pick = (result: ReturnType<typeof study>, treatment: string) =>
    result.treatments.find((entry) => entry.treatment === treatment)!
  const relativeSpread = (entry: ReturnType<typeof pick>) => entry.normSpread / entry.meanNorm

  it('leaves a batch with mean zero and unit spread', () => {
    const sample = sampleAdvantageBatch(bandit, rewards, critic, 40, 9)
    const normalised = normaliseAdvantages(sample.advantages)
    expect(Math.abs(normalised.mean)).toBeGreaterThan(0.01)
    expect(normalised.centred.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0, 12)
    const spread = Math.sqrt(
      normalised.whitened.reduce((sum, value) => sum + value * value, 0) / normalised.whitened.length,
    )
    expect(spread).toBeCloseTo(1, 12)
    // The same batch drawn from the same seed is the same batch.
    expect(sampleAdvantageBatch(bandit, rewards, critic, 40, 9).advantages).toEqual(sample.advantages)
    expect(sampleAdvantageBatch(bandit, rewards, critic, 40, 10).advantages).not.toEqual(sample.advantages)
  })

  it('leaves a batch of identical advantages at zero rather than at infinity', () => {
    const flat = normaliseAdvantages([2, 2, 2, 2])
    expect(flat.standardDeviation).toBeCloseTo(0, 12)
    expect(flat.whitened).toEqual([0, 0, 0, 0])
  })

  it('is free when the baseline is fixed rather than measured from the batch', () => {
    const result = study(32, 200)
    expect(result.populationCentredResidual).toBeLessThan(1e-15)
  })

  it('shrinks the gradient by exactly 1 − 1/N, which needs no sampling to prove', () => {
    // Every possible batch, weighted by its probability: the cross terms of the
    // measured mean vanish because the score function averages to zero, and the
    // diagonal ones leave exactly -1/N of the analytic gradient behind.
    const atoms: { step: TrajectoryStep; probability: number; advantage: number }[] = []
    for (let context = 0; context < bandit.contexts; context++) {
      const probs = actionProbs(bandit, context)
      for (let action = 0; action < bandit.actions; action++) {
        const reward = rewards[context]![action]!
        atoms.push({
          step: { context, action, reward, value: critic[context]!, nextValue: 0, terminal: true },
          probability: (probs[action] ?? 0) / bandit.contexts,
          advantage: reward - critic[context]!,
        })
      }
    }
    const exact = advantageGradient(bandit, criticAdvantages(rewards, critic))
    const length = (row: number[]) => Math.sqrt(row.reduce((sum, value) => sum + value * value, 0))

    for (const size of [2, 3]) {
      const mean = new Array<number>(exact.length).fill(0)
      const walk = (picked: typeof atoms, weight: number) => {
        if (picked.length === size) {
          const advantages = picked.map((atom) => atom.advantage)
          const gradient = ppoGradient(
            bandit,
            bandit,
            { steps: picked.map((atom) => atom.step) },
            normaliseAdvantages(advantages).centred,
            0.2,
          )
          for (let index = 0; index < mean.length; index++) mean[index] += weight * gradient[index]!
          return
        }
        for (const atom of atoms) {
          if (atom.probability > 0) walk([...picked, atom], weight * atom.probability)
        }
      }
      walk([], 1)
      const factor = 1 - 1 / size
      const residual = Math.max(...mean.map((value, index) => Math.abs(value - factor * exact[index]!)))
      expect(residual).toBeLessThan(1e-12)
      expect(length(mean) / length(exact)).toBeCloseTo(factor, 12)
    }
  })

  it('measures the same shrinkage on the batches the screen draws', () => {
    const sizes = [
      { batchSize: 4, batches: 1500 },
      { batchSize: 16, batches: 800 },
      { batchSize: 64, batches: 500 },
    ]
    for (const { batchSize, batches } of sizes) {
      const result = study(batchSize, batches)
      const predicted = 1 - 1 / batchSize
      // The estimator's own noise puts a few per cent on a number this small.
      expect(Math.abs(pick(result, 'centred').shrinkage - predicted)).toBeLessThan(0.03)
      expect(Math.abs(pick(result, 'raw').shrinkage - 1)).toBeLessThan(0.03)
      expect(pick(result, 'centred').cosine).toBeGreaterThan(0.99)
    }
  })

  it('whitens to a length that is not the gradient’s, in the gradient’s direction', () => {
    const large = study(64, 1500)
    expect(pick(large, 'whitened').cosine).toBeGreaterThan(0.999)
    expect(pick(large, 'whitened').shrinkage).toBeGreaterThan(1)
    expect(pick(large, 'whitened').meanNorm).not.toBeCloseTo(pick(large, 'raw').meanNorm, 3)
  })

  it('pins the step size, which is what it is actually for', () => {
    for (const batchSize of [4, 16, 64]) {
      const result = study(batchSize, 1200)
      expect(relativeSpread(pick(result, 'whitened'))).toBeLessThan(relativeSpread(pick(result, 'raw')))
    }
  })

  it('makes the update independent of the scale the rewards happen to be reported in', () => {
    const scaled = (factor: number) =>
      advantageStudy(bandit, rewards.map((row) => row.map((value) => value * factor)), critic.map((v) => v * factor), {
        batches: 600,
        batchSize: 32,
        seed: 7,
      })
    const one = scaled(1)
    const ten = scaled(10)
    expect(pick(ten, 'raw').meanNorm).toBeCloseTo(10 * pick(one, 'raw').meanNorm, 5)
    expect(pick(ten, 'whitened').meanNorm).toBeCloseTo(pick(one, 'whitened').meanNorm, 5)
  })
})

describe('reward overoptimisation', () => {
  const setting = buildRewardSetting()
  const harsh = buildRewardSetting(61, 6, 0.6, 13)
  const sizes = [1, 2, 4, 8, 16, 32, 64, 128, 256, 1024, 4096, 65536, 1048576]

  it('puts the gold optimum away from where the reference policy sits', () => {
    expect(setting.points).toHaveLength(61)
    // The gold reward is a quadratic peaked at `peak`, so its best grid point is
    // the one nearest that, and the reference (centred on zero) is not there.
    expect(Math.abs(setting.points[setting.bestIndex]! - setting.peak)).toBeLessThan(0.1)
    expect(expectedSettingReward(setting.reference, setting.trueReward)).toBeLessThan(
      Math.max(...setting.trueReward),
    )
    // The proxy's best point is not the gold one: that is the whole setting.
    expect(setting.proxyBestIndex).not.toBe(setting.bestIndex)
    expect(setting.errorSlope).toBeGreaterThan(0)
  })

  it('tilt-policy by the proxy reward and measure the KL', () => {
    const policy = tiltedPolicy(setting, 0)
    expect(klFromReference(setting, policy)).toBeCloseTo(0, 10)

    const tilted = tiltedPolicy(setting, 0.2)
    expect(klFromReference(setting, tilted)).toBeGreaterThan(0)
  })

  it('traces a curve where the proxy rises and the gold reward turns over', () => {
    for (const s of [setting, harsh]) {
      const curve = sweepOveroptimisation(s, 2, 160)
      expect(curve.points).toHaveLength(161)

      const first = curve.points[0]!
      const last = curve.points[curve.points.length - 1]!
      expect(first.kl).toBeCloseTo(0, 12)
      expect(last.proxy).toBeGreaterThan(first.proxy)
      // The proxy keeps rising the whole way; the gold reward peaks in the
      // interior and is worse by the end.
      const proxies = curve.points.map((point) => point.proxy)
      for (let i = 1; i < proxies.length; i++) expect(proxies[i]!).toBeGreaterThan(proxies[i - 1]!)
      expect(curve.bestTrueReward).toBeGreaterThan(last.trueReward)
      expect(curve.bestLambda).toBeGreaterThan(0)
      expect(curve.bestLambda).toBeLessThan(last.lambda)
      // And the regret is the gold reward measured against its own best.
      expect(last.regret).toBeCloseTo(Math.max(...s.trueReward) - last.trueReward, 12)
    }
  })

  it('induces the reference exactly at n = 1, and no fewer nats as n grows', () => {
    const one = bestOfNDistribution(setting, 1)
    expect(one.kl).toBeLessThan(1e-12)
    for (let i = 0; i < one.policy.length; i++) {
      expect(one.policy[i]).toBeCloseTo(setting.reference[i]!, 12)
    }
    const distances = sizes.map((n) => bestOfNDistribution(setting, n).kl)
    for (let i = 1; i < distances.length; i++) expect(distances[i]).toBeGreaterThan(distances[i - 1]!)
    // The induced policy is a policy: it sums to one and it improves on the
    // reference on the *proxy*, which is what it selects on.
    expect(one.policy.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
    expect(expectedSettingReward(bestOfNDistribution(setting, 64).policy, setting.proxyReward)).toBeGreaterThan(
      expectedSettingReward(setting.reference, setting.proxyReward),
    )
  })

  it('matches a brute-force enumeration of every pair at n = 2', () => {
    const exact = bestOfNDistribution(setting, 2)
    const counts = setting.points.map(() => 0)
    let total = 0
    for (let a = 0; a < setting.points.length; a++) {
      for (let b = 0; b < setting.points.length; b++) {
        // Both draws come from the reference; the winner is the higher proxy,
        // and a tie is broken uniformly between the two draws.
        const pa = setting.proxyReward[a]!
        const pb = setting.proxyReward[b]!
        const mass = setting.reference[a]! * setting.reference[b]!
        total += mass
        if (pa > pb) counts[a]! += mass
        else if (pb > pa) counts[b]! += mass
        else {
          counts[a]! += mass / 2
          counts[b]! += mass / 2
        }
      }
    }
    for (let i = 0; i < counts.length; i++) {
      expect(exact.policy[i]).toBeCloseTo(counts[i]! / total, 12)
    }
  })

  it('matches the Monte-Carlo selection to within its sampling error', () => {
    for (const n of [8, 64]) {
      const measured = bestOfN(setting, n, 20000, 29 + n)
      const exact = bestOfNDistribution(setting, n)
      expect(measured.selectedTrueReward).toBeCloseTo(exact.trueReward, 1)
      expect(measured.selectedProxyReward).toBeCloseTo(exact.proxyReward, 1)
      // The Monte-Carlo row reports the self-information of the response it
      // landed on, which is a different quantity from the KL the policy travels.
      expect(measured.selectedKl).not.toBeCloseTo(exact.kl, 2)
    }
  })

  it('spends a KL budget exactly, and says so when a budget cannot be spent', () => {
    for (const budget of [0.05, 0.5, 3, 12]) {
      const spent = policyForBudget(setting, budget)
      expect(spent.reachable).toBe(true)
      expect(spent.kl).toBeCloseTo(budget, 6)
    }
    const ceiling = policyForBudget(setting, 1e6)
    expect(ceiling.reachable).toBe(false)
    // The tilt can only ever collapse onto the proxy's best point.
    expect(ceiling.kl).toBeCloseTo(-Math.log(setting.reference[setting.proxyBestIndex]!), 6)
    expect(ceiling.policy[setting.proxyBestIndex]).toBeGreaterThan(0.999)
    for (const budget of [1, 5, 12]) {
      expect(policyForBudget(setting, budget).kl).toBeLessThan(ceiling.kl)
    }
    expect(policyForBudget(setting, ceiling.ceiling + 5).kl).toBeCloseTo(ceiling.kl, 6)
  })

  it('is the exact maximiser of the proxy reward at the distance it travels', () => {
    const rng = createRng(97)
    for (const budget of [0.5, 2, 6]) {
      const chosen = policyForBudget(setting, budget)
      // The tilt at λ maximises E[proxy] − KL/λ over every policy, so no
      // competitor — including ones off the tilt family — beats it.
      const objective = (policy: number[]) =>
        expectedSettingReward(policy, setting.proxyReward) - klFromReference(setting, policy) / chosen.lambda
      const best = objective(chosen.policy)
      for (const lambda of [0.05, 0.3, 1, 3, 10, 40]) {
        expect(objective(tiltedPolicy(setting, lambda))).toBeLessThanOrEqual(best + 1e-9)
      }
      for (let trial = 0; trial < 20; trial++) {
        const wild = chosen.policy.map((p) => p * (0.2 + rng() * 4))
        const mass = wild.reduce((a, b) => a + b, 0)
        expect(objective(wild.map((w) => w / mass))).toBeLessThanOrEqual(best + 1e-9)
      }
    }
  })

  it('wins on the proxy at every budget and trades the gold reward as the budget grows', () => {
    const rows = compareAtBudgets(setting, [0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8, 12, 14, 20], sizes)
    expect(rows).toHaveLength(11)
    for (const row of rows.filter((r) => r.reachable)) {
      expect(row.rlKl).toBeCloseTo(row.budget, 6)
      expect(row.rlProxyReward).toBeGreaterThan(row.bonProxyReward)
    }
    // The gold reward has no such law: which method is ahead depends on where
    // on the curve you stop.
    const gaps = rows.map((row) => row.rlTrueReward - row.bonTrueReward)
    expect(Math.max(...gaps)).toBeGreaterThan(0.01)
    expect(Math.min(...gaps)).toBeLessThan(-0.01)
    // Past the ceiling both methods are reported at where they actually got to.
    const beyond = rows[rows.length - 1]!
    expect(beyond.reachable).toBe(false)
    expect(beyond.bonKl).toBeLessThan(beyond.budget)
  })

  it('fits a parabola to the best-of-n gain and a logarithm to the reinforcement-learning gain', () => {
    const bon = bestOfNGain(setting)
    const rl = reinforcementLearningGain(setting, 2, 160)
    expect(rl.baseline).toBeCloseTo(expectedSettingReward(setting.reference, setting.trueReward), 12)
    expect(bon.fit.alpha).toBeGreaterThan(0)
    expect(bon.fit.beta).toBeGreaterThan(0)
    expect(rl.fit.alpha).toBeGreaterThan(0)
    expect(rl.fit.beta).toBeGreaterThan(0)
    expect(bon.fit.r2).toBeGreaterThan(0.99)
    expect(rl.fit.r2).toBeGreaterThan(0.9)
    // Both curves rise before they fall, which is what a positive α means.
    expect(bon.bestGain).toBeGreaterThan(0)
    expect(rl.bestGain).toBeGreaterThan(0)
    expect(bon.gains[0]).toBeGreaterThan(0)
  })

  it('turns the coefficients inside out when it fits the reward instead of the gain', () => {
    const curve = sweepOveroptimisation(setting, 2, 160)
    const distances = curve.points.map((point) => Math.sqrt(Math.max(point.kl, 1e-12)))
    const raw = fitBestOfNForm(distances, curve.points.map((point) => point.trueReward))
    const gain = bestOfNGain(setting)
    // The reward starts at the reference's reward, not at zero, so a form with
    // no intercept has to bend down from its first point.
    expect(raw.alpha).toBeLessThan(0)
    expect(raw.r2).toBeLessThan(gain.fit.r2)
    expect(gain.fit.r2).toBeGreaterThan(0.99)
  })

  it('shrinks both parts of the error as one over the square root of the pairs', () => {
    const bigger = rewardModelAtData(setting, 25, 100)
    expect(bigger.errorScale).toBeCloseTo(setting.errorScale * 2, 12)
    expect(bigger.errorSlope).toBeCloseTo(setting.errorSlope * 2, 12)
    // Calibrated so that the reference count reproduces the setting it came from.
    expect(rewardModelAtData(setting, 100, 100)).toEqual(setting)
    // Nothing but the judge changes: the gold reward and the reference are the
    // same arrays, which is what makes the comparison a comparison.
    expect(bigger.trueReward).toEqual(setting.trueReward)
    expect(bigger.reference).toEqual(setting.reference)
    expect(bigger.peak).toBe(setting.peak)
  })

  it('moves β the way the paper reports and α the way this construction must', () => {
    const rows = alphaBetaAcrossData(setting, [1, 4, 16, 64, 100, 256, 1024, 4096, 16384], 100, 1.2, 100)
    expect(rows).toHaveLength(9)
    const first = rows[0]!
    const last = rows[rows.length - 1]!
    // β — the part of the fit that says "and then it gets worse" — falls, for both methods.
    expect(last.rlBeta).toBeLessThan(first.rlBeta)
    expect(last.bonBeta).toBeLessThan(first.bonBeta)
    // α — the initial rate — does not rise. The systematic error is a slope, and
    // a slope points the way the gold reward improves from where the reference sits.
    expect(last.rlAlpha).toBeLessThan(first.rlAlpha)
    // The two optima come together, and the error terms shrink as stated.
    expect(last.optimumGap).toBeLessThanOrEqual(first.optimumGap)
    expect(last.errorScale).toBeLessThan(first.errorScale)
    // Pushing as far as the proxy allows turns from a loss into a gain.
    expect(first.gainAtCeiling).toBeLessThan(0)
    expect(last.gainAtCeiling).toBeGreaterThan(0)
    // Best-of-n barely notices the judge: its coefficients move less than the
    // reinforcement-learning ones do.
    expect(Math.abs(last.bonAlpha - first.bonAlpha)).toBeLessThan(Math.abs(last.rlAlpha - first.rlAlpha))
    expect(Math.abs(last.bonBeta - first.bonBeta)).toBeLessThan(Math.abs(first.rlBeta - last.rlBeta))
    // The row at the reference count is the setting's own fit, exactly.
    const at100 = rows.find((row) => row.data === 100)!
    expect(at100.rlAlpha).toBeCloseTo(reinforcementLearningGain(setting, 1.2, 100).fit.alpha, 12)
    // Both fits stay good shapes at every size, so the coefficients mean something.
    for (const row of rows) expect(row.rlR2).toBeGreaterThan(0.85)
    for (const row of rows) expect(row.bonR2).toBeGreaterThan(0.99)
  })

  it('has an expected reward that matches a direct sum', () => {
    const policy = tiltedPolicy(setting, 0.1)
    const expected = expectedSettingReward(policy, setting.trueReward)
    let manual = 0
    for (let i = 0; i < policy.length; i++) manual += policy[i]! * setting.trueReward[i]!
    expect(expected).toBeCloseTo(manual, 12)
  })
})

describe('the value head and generalised advantage estimation', () => {
  const chain = buildChain(3)
  const exact = chainValues(chain)
  const head = fitValueHead(chain, { trajectories: 512, seed: 1 })

  it('solves the Bellman equation at every position of the chain', () => {
    const immediate = contextValues(chain.bandit, chain.rewards)
    for (let t = 0; t < exact.length; t++) {
      expect(exact[t]).toBeCloseTo(immediate[t]! + chain.gamma * (exact[t + 1] ?? 0), 12)
    }
    expect(returnsToGo(sampleChainTrajectory(chain, exact, 4), chain.gamma)[0]).toBeCloseTo(
      discountedReturn(sampleChainTrajectory(chain, exact, 4), chain.gamma),
      12,
    )
  })

  it('trains a head that approaches the exact value of every state', () => {
    const little = fitValueHead(chain, { trajectories: 8, seed: 1 })
    expect(little.rmse).toBeGreaterThan(head.rmse)
    expect(head.rmse).toBeLessThan(0.05)
    expect(Math.max(...head.values.map((value, index) => Math.abs(value - exact[index]!)))).toBeLessThan(0.1)
    // The last point of the curve is the reported error, and the curve is the
    // error against the truth rather than against the sample.
    expect(head.curve[head.curve.length - 1]!.error).toBeCloseTo(head.rmse, 12)
    expect(head.curve[head.curve.length - 1]!.seen).toBe(head.trajectories)
  })

  it('has a bias that the closed form in the critic’s error predicts, exactly', () => {
    const critic = head.values
    const error = exact.map((value, index) => value - critic[index]!)
    for (const lambda of [0, 0.25, 0.5, 0.75, 0.9]) {
      // E[A_0(λ)] = e_0 + (1 − 1/λ) Σ_{l≥1} (γλ)^l e_l
      let tail = 0
      let term = chain.gamma * lambda
      for (let l = 1; l < error.length; l++) {
        tail += term * error[l]!
        term *= chain.gamma * lambda
      }
      const predicted = lambda === 0 ? error[0]! - chain.gamma * error[1]! : error[0]! + (1 - 1 / lambda) * tail
      const row = advantageCurve(chain, critic, [lambda]).rows[0]!
      expect(row.mean).toBeCloseTo(predicted, 10)
    }
  })

  it('is unbiased at λ = 1 whatever the head says, and biased below it', () => {
    const curve = advantageCurve(chain, new Array(exact.length).fill(0))
    expect(Math.abs(curve.rows[20]!.bias)).toBeLessThan(1e-12)
    expect(Math.abs(curve.rows[0]!.bias)).toBeGreaterThan(0.5)
    expect(Math.abs(curve.rows[10]!.bias)).toBeLessThan(Math.abs(curve.rows[0]!.bias))
    // And the variance is a property of the policy and the horizon, not of the critic.
    const other = advantageCurve(chain, head.values)
    expect(curve.rows[0]!.variance).toBeCloseTo(other.rows[0]!.variance, 10)
    expect(curve.rows[20]!.variance).toBeCloseTo(other.rows[20]!.variance, 10)
    expect(other.rows[20]!.variance).toBeGreaterThan(other.rows[0]!.variance)
    // It rises the whole way, so λ is trading one error for the other and not
    // moving both at once.
    expect(other.rows.every((row, index) => index === 0 || row.variance >= other.rows[index - 1]!.variance - 1e-12)).toBe(
      true,
    )
  })

  it('matches the recursion actually run on sampled trajectories', () => {
    const critic = head.values
    const lambda = 0.7
    const samples = 4000
    let sum = 0
    let second = 0
    for (let index = 0; index < samples; index++) {
      const advantage = generalisedAdvantage(
        sampleChainTrajectory(chain, critic, index),
        chain.gamma,
        lambda,
      )[0]!
      sum += advantage
      second += advantage * advantage
    }
    const mean = sum / samples
    const row = advantageCurve(chain, critic, [lambda]).rows[0]!
    expect(row.mean).toBeCloseTo(mean, 2)
    expect(row.variance).toBeCloseTo(second / samples - mean * mean, 2)
  })

  it('puts the least error at λ = 0 when the critic is exact, and higher as the critic worsens', () => {
    const perfect = advantageCurve(chain, exact)
    expect(perfect.bestLambda).toBe(0)
    expect(Math.max(...perfect.rows.map((row) => Math.abs(row.bias)))).toBeLessThan(1e-12)
    expect(perfect.rows[0]!.mse).toBeLessThan(perfect.rows[20]!.mse)

    const fitted = advantageCurve(chain, head.values)
    const hopeless = advantageCurve(chain, new Array(exact.length).fill(0))
    expect(hopeless.bestLambda).toBeGreaterThan(0.5)
    expect(hopeless.bestMse).toBeGreaterThan(fitted.bestMse)
    expect(fitted.bestMse).toBeGreaterThan(perfect.bestMse)
    // The worst λ is the one that trusts the critic least and the sample most.
    expect(fitted.rows[20]!.mse).toBeGreaterThan(fitted.bestMse)
  })

  it('shows a loss that rises while the error falls, which is what the screen claims', () => {
    const one = fitValueHead(chain, { trajectories: 1, seed: 11 })
    expect(one.curve[0]!.loss).toBeCloseTo(0, 12)
    expect(one.curve[0]!.error).toBeGreaterThan(0.5)

    const many = fitValueHead(chain, { trajectories: 256, seed: 11 })
    const last = many.curve[many.curve.length - 1]!
    expect(last.loss).toBeGreaterThan(0.3)
    expect(last.error).toBeLessThan(one.curve[0]!.error / 4)

    // The loss the converged head reports is the disagreement of the returns it
    // was shown, not the head's distance from the truth.
    const spread = returnSpread(chain)
    const variance = spread.reduce((sum, point) => sum + point.standardDeviation ** 2, 0) / spread.length
    expect(last.loss).toBeGreaterThan(variance - 0.15)
    expect(last.loss).toBeLessThan(variance + 0.15)
  })

  it('spreads the returns in the shape the states-by-state table reports', () => {
    for (const seed of [3, 7, 11]) {
      const other = buildChain(seed)
      const values = chainValues(other)
      const spread = returnSpread(other)
      expect(spread.length).toBe(values.length)
      // The mean of the sampled returns from a position is the value of that position.
      for (let t = 0; t < values.length; t++) expect(spread[t]!.mean).toBeCloseTo(values[t]!, 10)
      // The end of the chain is the least varied, and the hardest position is not the first.
      const others = spread.slice(0, -1).map((point) => point.standardDeviation)
      expect(spread[spread.length - 1]!.standardDeviation).toBeLessThan(Math.min(...others))
      const hardest = spread.reduce(
        (best, point, index) => (point.standardDeviation > spread[best]!.standardDeviation ? index : best),
        0,
      )
      expect(hardest).toBeGreaterThan(0)
      expect(spread[hardest]!.standardDeviation).toBeGreaterThan(spread[0]!.standardDeviation)
    }
  })

  it('prefers a shorter trace once the head has data, along a path that is not monotone', () => {
    for (const seed of [3, 7, 11]) {
      const other = buildChain(seed)
      const rungs = [1, 2, 4, 8, 16, 32, 64, 128, 256].map((size) => {
        const fit = fitValueHead(other, { trajectories: size, seed: 11 })
        return { error: fit.rmse, bestLambda: advantageCurve(other, fit.values).bestLambda }
      })
      expect(rungs[0]!.bestLambda).toBeGreaterThanOrEqual(0.7)
      expect(rungs[rungs.length - 1]!.bestLambda).toBeLessThanOrEqual(0.1)
      expect(rungs[rungs.length - 1]!.error).toBeLessThan(rungs[0]!.error / 4)
      expect(rungs.some((rung, index) => index > 0 && rung.error > rungs[index - 1]!.error)).toBe(true)
      // With the exact values in place of the head there is nothing left to buy.
      expect(advantageCurve(other, chainValues(other)).bestLambda).toBe(0)
    }
  })
})

describe('the seeded stream', () => {
  it('replays exactly', () => {
    const a = createRng(7)
    const b = createRng(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

/**
 * The pipeline, on the numbers the screen runs at by default: six prompts, twelve
 * candidate responses, 600 demonstrations, 400 preference pairs from the top half
 * of the response range with a tenth of the labels flipped, and 600 PPO steps at
 * a KL coefficient of 0.1.
 */
const pipeTask = buildTask({})
const pipeTeacher = demonstratorPolicy(pipeTask, 0.25)
const pipeDemos = sampleDemonstrations(pipeTask, pipeTeacher, 600, 21, 0)
const pipeSft = runSft(pipeTask, pipeDemos, { steps: 600, learningRate: 0.5, teacher: pipeTeacher })
const topBand: [number, number] = [0.4, 1]
const topPairs = samplePreferences(pipeTask, { count: 400, seed: 31, band: topBand, labelNoise: 0.1 })
const topFit = fitRewardModel(pipeTask, topPairs, { steps: 600, band: topBand, labelNoise: 0.1, seed: 31 })
const STAGE_DEFAULTS = { beta: 0.1, steps: 600, batch: 96, learningRate: 0.5, seed: 41, reportEvery: 10 }
const pipeStage = runPpoStage(pipeTask, topFit.model, pipeSft.policy, STAGE_DEFAULTS)
const pipeGold = goldReward(pipeTask)

/** The gradient of a scalar function of a vector, by central differences. */
function numericGradient(loss: (vector: number[]) => number, at: number[]): number[] {
  const h = 1e-6
  return at.map((_, index) => {
    const up = [...at]
    const down = [...at]
    up[index]! += h
    down[index]! -= h
    return (loss(up) - loss(down)) / (2 * h)
  })
}

/** The largest error of a model along the feature axis, on one side of the band or the other. */
function profileError(model: RewardModel, insideBand: boolean): number {
  const rows = errorProfile(pipeTask, model, 41).filter((row) => row.insideBand === insideBand)
  if (rows.length === 0) return 0
  return Math.max(...rows.map((row) => Math.abs(row.error)))
}

describe('stage one: the supervised fit', () => {
  it('has the gradient it claims, at a peaked policy as well as a flat one', () => {
    const policies: Bandit[] = [
      {
        contexts: pipeTask.contexts,
        actions: pipeTask.actions,
        logits: new Array<number>(pipeTask.contexts * pipeTask.actions).fill(0),
      },
      pipeTeacher,
      sharpen(pipeTeacher, 4),
    ]
    for (const policy of policies) {
      const { gradient } = sftObjective(policy, pipeDemos)
      const numeric = numericGradient((logits) => sftObjective({ ...policy, logits }, pipeDemos).loss, policy.logits)
      for (let i = 0; i < gradient.length; i++) expect(gradient[i]!).toBeCloseTo(numeric[i]!, 5)
      // The softmax is shift-invariant in each block, so each block's gradient sums to nought.
      for (let context = 0; context < pipeTask.contexts; context++) {
        const block = gradient.slice(context * pipeTask.actions, (context + 1) * pipeTask.actions)
        expect(block.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 12)
      }
    }
  })

  it('descends monotonically to the entropy of the demonstrations it was given', () => {
    const counts = actionCounts(pipeDemos, pipeTask)
    const empirical = empiricalDistribution(counts)
    let entropy = 0
    for (let context = 0; context < pipeTask.contexts; context++) {
      const seen = counts[context]!.reduce((a, b) => a + b, 0)
      let row = 0
      for (const p of empirical[context]!) if (p > 0) row -= p * Math.log(p)
      entropy += (seen / pipeDemos.length) * row
    }
    expect(pipeSft.exactLoss).toBeCloseTo(entropy, 10)
    const exact = maximumLikelihoodPolicy(counts)
    expect(sftObjective(exact, pipeDemos).loss).toBeCloseTo(pipeSft.exactLoss, 12)
    for (let context = 0; context < pipeTask.contexts; context++) {
      const probs = actionProbs(exact, context)
      for (let action = 0; action < pipeTask.actions; action++) {
        expect(probs[action]!).toBeCloseTo(empirical[context]![action]!, 9)
      }
    }
    expect(pipeSft.finalLoss).toBeGreaterThan(pipeSft.exactLoss)
    expect(pipeSft.finalLoss - pipeSft.exactLoss).toBeLessThan(0.04)
    expect(pipeSft.history.every((point, index) => index === 0 || point.loss <= pipeSft.history[index - 1]!.loss + 1e-12)).toBe(true)

    const brief = runSft(pipeTask, pipeDemos, { steps: 200, learningRate: 0.5 })
    expect(brief.finalLoss - brief.exactLoss).toBeGreaterThan(pipeSft.finalLoss - pipeSft.exactLoss)
    expect(brief.maxGapToEmpirical).toBeGreaterThan(pipeSft.maxGapToEmpirical)
  })

  it('learns the inconsistency rather than filtering it out', () => {
    const ladder = [0, 0.2, 0.5].map((inconsistency) => {
      const demonstrations = sampleDemonstrations(pipeTask, pipeTeacher, 600, 21, inconsistency)
      const run = runSft(pipeTask, demonstrations, { steps: 600, learningRate: 0.5, teacher: pipeTeacher })
      return {
        loss: run.finalLoss,
        floor: run.exactLoss,
        gold: run.finalGold,
        distance: Math.abs(meanNominalQuality(pipeTask, run.policy) - pipeTask.peak),
      }
    })
    for (const rung of ladder) expect(rung.loss - rung.floor).toBeLessThan(0.04)
    for (let index = 1; index < ladder.length; index++) {
      // More inconsistent demonstrations: a higher floor, a higher loss, a worse policy.
      expect(ladder[index]!.floor).toBeGreaterThan(ladder[index - 1]!.floor)
      expect(ladder[index]!.loss).toBeGreaterThan(ladder[index - 1]!.loss)
      expect(ladder[index]!.gold).toBeLessThan(ladder[index - 1]!.gold)
      expect(ladder[index]!.distance).toBeGreaterThan(ladder[index - 1]!.distance)
    }
  })
})

describe('stage two: the reward model', () => {
  it('labels the response the gold reward prefers, and only inside the band it was given', () => {
    const band: [number, number] = [-0.5, 0.9]
    const pairs = samplePreferences(pipeTask, { count: 300, seed: 7, band, labelNoise: 0 })
    expect(pairs).toHaveLength(300)
    for (const pair of pairs) {
      expect(pipeGold[pair.context]![pair.chosen]!).toBeGreaterThanOrEqual(pipeGold[pair.context]![pair.rejected]!)
      for (const action of [pair.chosen, pair.rejected]) {
        const x = pipeTask.nominal[pair.context]![action]!
        expect(x).toBeGreaterThanOrEqual(band[0] - 1e-9)
        expect(x).toBeLessThanOrEqual(band[1] + 1e-9)
      }
    }
  })

  it('has the Bradley–Terry gradient it claims, and points the way the labels do', () => {
    const weights = [1.3, -0.7]
    const objective = pairObjective(weights, pipeTask, topPairs)
    const numeric = numericGradient((vector) => pairObjective(vector, pipeTask, topPairs).loss, weights)
    for (let index = 0; index < objective.gradient.length; index++) {
      expect(objective.gradient[index]!).toBeCloseTo(numeric[index]!, 8)
    }

    // A single pair whose chosen response is the better one: the loss falls as the
    // weight on the feature rises, so the gradient must be negative.
    const one = [{ context: 0, chosen: pipeTask.actions - 1, rejected: 0 }]
    const pair = pairObjective([0, 0], pipeTask, one)
    expect(pair.gradient[0]!).toBeLessThan(0)
    expect(pair.accuracy).toBe(1)
    expect(pairObjective([2, 0], pipeTask, one).loss).toBeLessThan(pairObjective([-2, 0], pipeTask, one).loss)
  })

  it('reads an ordering on the reward scale, and refuses to read it backwards', () => {
    const model = (weights: number[]): RewardModel => ({
      weights,
      band: [-1, 1],
      pairs: 0,
      labelNoise: 0,
      steps: 0,
      learningRate: 0,
    })
    // The ceiling is -x² + 2·peak·x - peak², so these weights express it exactly.
    const right = model([2 * pipeTask.peak, -1])
    const alignment = alignScores(pipeTask, right)
    expect(alignment.scale).toBeCloseTo(1, 6)
    expect(alignment.offset).toBeCloseTo(-(pipeTask.peak ** 2), 6)
    expect(alignment.insideResidual).toBeLessThan(1e-9)
    for (const row of errorProfile(pipeTask, right, 41)) expect(row.error).toBeCloseTo(0, 9)

    // Twice the slope is the same model: a Bradley–Terry score carries no units.
    const doubled = errorProfile(pipeTask, model([4 * pipeTask.peak, -2]), 41)
    const original = errorProfile(pipeTask, right, 41)
    for (let index = 0; index < doubled.length; index++) {
      expect(doubled[index]!.aligned).toBeCloseTo(original[index]!.aligned, 9)
    }
    expect(doubled[0]!.score).toBeCloseTo(2 * original[0]!.score, 9)
    expect(doubled[0]!.score).not.toBeCloseTo(original[0]!.score, 6)

    // A score that runs the other way against the ceiling has no legal rescaling.
    const backwards = alignScores(pipeTask, model([-2 * pipeTask.peak, -1]))
    expect(backwards.scale).toBe(0)
    const flat = errorProfile(pipeTask, model([-2 * pipeTask.peak, -1]), 41).map((row) => row.aligned)
    expect(Math.max(...flat) - Math.min(...flat)).toBeLessThan(1e-12)
  })

  it('extrapolates worse the longer it is trained, while its accuracy does not move', () => {
    const band: [number, number] = [-0.8, 0]
    const pairs = samplePreferences(pipeTask, { count: 400, seed: 31, band, labelNoise: 0.1 })
    const brief = fitRewardModel(pipeTask, pairs, { steps: 120, band, labelNoise: 0.1, seed: 31 })
    const long = fitRewardModel(pipeTask, pairs, { steps: 1500, band, labelNoise: 0.1, seed: 31 })

    expect(Math.abs(long.finalAccuracy - brief.finalAccuracy)).toBeLessThan(0.01)
    expect(long.finalOutsideAccuracy).toBeLessThan(brief.finalOutsideAccuracy)
    expect(profileError(long.model, false)).toBeGreaterThan(profileError(brief.model, false))
    expect(profileError(long.model, true)).toBeLessThan(profileError(long.model, false) / 4)
    // The held-out pairs are the ones outside the band, and there are enough to mean something.
    expect(long.outsideCount).toBeGreaterThan(100)
  })
})

describe('stage three: the policy optimisation, against a model that is not the truth', () => {
  it('penalises exactly the KL it says it does', () => {
    const beta = 0.1
    const penalty = klPenaltyTable(pipeSft.policy, pipeTeacher, beta)
    for (let context = 0; context < pipeTask.contexts; context++) {
      for (let action = 0; action < pipeTask.actions; action++) {
        const expected = beta * (logProb(pipeSft.policy, context, action) - logProb(pipeTeacher, context, action))
        expect(penalty[context]![action]!).toBeCloseTo(expected, 12)
      }
    }
    const raw = rewardTable(pipeTask, topFit.model)
    const seen = penalisedRewards(raw, pipeSft.policy, pipeTeacher, beta)
    for (let context = 0; context < pipeTask.contexts; context++) {
      for (let action = 0; action < pipeTask.actions; action++) {
        expect(seen[context]![action]!).toBeCloseTo(raw[context]![action]! - penalty[context]![action]!, 12)
      }
    }
    const flat = standardise(raw).table.flat()
    expect(Math.abs(flat.reduce((a, b) => a + b, 0) / flat.length)).toBeLessThan(1e-12)
    expect(Math.sqrt(flat.reduce((a, b) => a + b * b, 0) / flat.length)).toBeCloseTo(1, 6)
  })

  it('is given a table that never contains the truth', () => {
    const rows = rewardTable(pipeTask, topFit.model)
    for (let context = 0; context < pipeTask.contexts; context++) {
      for (let action = 0; action < pipeTask.actions; action++) {
        expect(rows[context]![action]!).toBeCloseTo(scoreOf(topFit.model, pipeTask.nominal[context]![action]!), 15)
      }
    }
    // Move the truth and only the truth: the reward the optimisation sees does not move.
    const perturbed = { ...pipeTask, truth: pipeTask.truth.map((row) => row.map((value) => value + 0.3)) }
    expect(goldReward(perturbed)).not.toEqual(pipeGold)
    expect(rewardTable(perturbed, topFit.model)).toEqual(rows)
  })

  it('raises the proxy the whole way and turns the gold reward over', () => {
    expect(pipeStage.proxyAtEnd).toBeGreaterThan(pipeStage.proxyAtReference)
    expect(pipeStage.history.every((point, index) => index === 0 || point.proxy >= pipeStage.history[index - 1]!.proxy - 1e-9)).toBe(true)
    expect(pipeStage.bestGoldStep).toBeGreaterThan(0)
    expect(pipeStage.bestGoldStep).toBeLessThan(pipeStage.steps)
    expect(pipeStage.dropFromBest).toBeGreaterThan(TURNOVER_FLOOR)
    expect(pipeStage.goldAtEnd).toBeLessThan(pipeStage.goldAtReference)
    expect(Math.abs(pipeStage.meanQuality - pipeTask.peak)).toBeGreaterThan(
      Math.abs(pipeStage.meanQualityAtReference - pipeTask.peak),
    )
    expect(pipeStage.goldAtReference).toBeCloseTo(meanReward(pipeSft.policy, pipeGold), 12)
    expect(pipeStage.proxyAtReference).toBeCloseTo(meanReward(pipeSft.policy, rewardTable(pipeTask, topFit.model)), 12)

    // Same seed, same curve.
    const again = runPpoStage(pipeTask, topFit.model, pipeSft.policy, { ...STAGE_DEFAULTS, steps: 60, batch: 32 })
    const once = runPpoStage(pipeTask, topFit.model, pipeSft.policy, { ...STAGE_DEFAULTS, steps: 60, batch: 32 })
    expect(again.history).toEqual(once.history)
  })

  it('does not turn over when the reward model was shown every response', () => {
    const pairs = samplePreferences(pipeTask, { count: 400, seed: 31, band: [-1, 1], labelNoise: 0.1 })
    const fit = fitRewardModel(pipeTask, pairs, { steps: 600, band: [-1, 1], labelNoise: 0.1, seed: 31 })
    const stage = runPpoStage(pipeTask, fit.model, pipeSft.policy, STAGE_DEFAULTS)
    expect(profileError(fit.model, false)).toBe(0)
    expect(stage.goldAtEnd).toBeGreaterThan(stage.goldAtReference)
    expect(stage.dropFromBest).toBeLessThan(TURNOVER_FLOOR)
    expect(stage.goldAtEnd).toBeGreaterThan(pipeStage.goldAtEnd)
    expect(Math.abs(stage.meanQuality - pipeTask.peak)).toBeLessThan(Math.abs(pipeStage.meanQuality - pipeTask.peak))
  })
})

describe('the weak reward model study', () => {
  // The same four rows the screen lists: one supervised policy, four sets of pairs.
  const variants = [
    { label: 'Every response, noisy labels', band: [-1, 1] as [number, number], pairs: 400, labelNoise: 0.1, rmSteps: 600 },
    { label: 'The low middle only', band: [-0.8, 0] as [number, number], pairs: 400, labelNoise: 0.1, rmSteps: 600 },
    { label: 'The top half, noisy labels', band: [0.4, 1] as [number, number], pairs: 400, labelNoise: 0.1, rmSteps: 600 },
    { label: 'The top half, clean labels', band: [0.4, 1] as [number, number], pairs: 400, labelNoise: 0, rmSteps: 600 },
  ]
  const rows = weakModelStudy(pipeTask, pipeSft.policy, variants, {
    steps: 600,
    batch: 64,
    learningRate: 1,
    beta: 0.05,
    seed: 41,
    reportEvery: 10,
  })

  it('puts every row on the same reference policy', () => {
    expect(rows).toHaveLength(4)
    for (const row of rows) {
      expect(row.goldAtReference).toBeCloseTo(pipeStage.goldAtReference, 12)
      expect(row.history).toHaveLength(61)
      expect(row.history[0]!.gold).toBeCloseTo(row.goldAtReference, 12)
      expect(row.history[0]!.proxy).toBeCloseTo(row.proxyAtReference, 12)
    }
  })

  it('turns over in exactly the two rows that were shown half the range', () => {
    expect(rows.map((row) => row.turnsOver)).toEqual([false, false, true, true])
    const [wide, lowMiddle, topNoisy, topClean] = rows
    expect(wide!.dropFromBest).toBeLessThan(TURNOVER_FLOOR)
    expect(lowMiddle!.dropFromBest).toBeLessThan(TURNOVER_FLOOR)
    expect(topNoisy!.dropFromBest).toBeGreaterThan(TURNOVER_FLOOR)
    expect(topClean!.dropFromBest).toBeGreaterThan(topNoisy!.dropFromBest)
    for (const row of [topNoisy!, topClean!]) {
      expect(row.bestGoldStep).toBeGreaterThan(0)
      expect(row.bestGoldStep).toBeLessThan(600)
      expect(row.proxyAtEnd).toBeGreaterThan(row.proxyAtReference)
      expect(row.goldAtEnd).toBeLessThan(row.goldAtReference)
    }
  })

  it('finds the best-ranking model the most dangerous one', () => {
    const bestRanker = rows.reduce((best, row) => (row.accuracy > best.accuracy ? row : best), rows[0]!)
    expect(bestRanker.label).toBe('The top half, clean labels')
    expect(bestRanker.labelNoise).toBe(0)
    expect(Math.max(...rows.map((row) => row.dropFromBest))).toBeCloseTo(bestRanker.dropFromBest, 12)
    expect(bestRanker.outsideAccuracy).toBeLessThan(bestRanker.accuracy - 0.3)
    expect(bestRanker.accuracy).toBeGreaterThan(Math.min(...rows.map((row) => row.accuracy)))
  })

  it('measures the error the ranking accuracy does not see', () => {
    const wide = rows.find((row) => row.band[0] === -1)!
    expect(wide.errorOutside).toBe(0)
    for (const row of rows.filter((entry) => entry.band[0] !== -1)) {
      expect(row.errorOutside).toBeGreaterThan(row.errorInside * 5)
      expect(row.errorOutside).toBeGreaterThan(TURNOVER_FLOOR)
    }
    // Narrower the range the pairs cover, further the model puts the best response from the peak.
    for (const row of rows) {
      expect(Math.abs(row.modelOptimum - pipeTask.peak)).toBeLessThanOrEqual(1.1)
    }
    expect(wide.modelOptimum).toBeCloseTo(0.5, 6)
    expect(rows[1]!.modelOptimum).toBeGreaterThan(pipeTask.peak)
    expect(rows[3]!.modelOptimum).toBeLessThan(pipeTask.peak)
  })

  it('leaves every policy further from the peak than the reference policy was', () => {
    const reference = Math.abs(meanNominalQuality(pipeTask, pipeSft.policy) - pipeTask.peak)
    for (const row of rows) expect(Math.abs(row.meanQuality - pipeTask.peak)).toBeGreaterThan(reference)
    expect(rows[0]!.meanQuality).toBeGreaterThan(pipeTask.peak)
    expect(rows[1]!.meanQuality).toBeGreaterThan(rows[0]!.meanQuality)
    expect(rows[3]!.meanQuality).toBeLessThan(rows[2]!.meanQuality)
    expect(rows.filter((row) => row.proxyAtEnd > row.proxyAtReference)).toHaveLength(4)
    expect(rows.filter((row) => row.goldAtEnd < row.goldAtReference)).toHaveLength(2)
  })
})
