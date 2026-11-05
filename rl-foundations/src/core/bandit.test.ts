import { describe, expect, it } from 'vitest'
import {
  baselineVarianceEffect,
  best,
  banditLogits,
  buildBandit,
  compareForms,
  directGradient,
  estimatorMoments,
  expectedReward,
  maxDifference,
  sampleStatistics,
  scoreFunction,
  scoreFunctionGradient,
  softmax,
  trainBandit,
  actionDependentGradient,
} from './bandit'

const bandit = buildBandit()
const logits = banditLogits(bandit, 0.8)

describe('the bandit', () => {
  it('puts the probability where the reward is', () => {
    const probabilities = softmax(logits)
    expect(probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
    expect(probabilities[best(bandit)]).toBe(Math.max(...probabilities))
  })

  it('sums the rewards by probability', () => {
    const probabilities = softmax(logits)
    const expected = probabilities.reduce((sum, p, arm) => sum + p * bandit.rewards[arm]!, 0)
    expect(expectedReward(bandit, logits)).toBeCloseTo(expected, 15)
  })

  it('has a score function that averages to zero', () => {
    const probabilities = softmax(logits)
    const average = probabilities.map((_, index) =>
      probabilities.reduce((sum, probability, arm) => sum + probability * scoreFunction(probabilities, arm)[index]!, 0),
    )
    for (const value of average) expect(Math.abs(value)).toBeLessThan(1e-15)
  })

  it('derives the same gradient three ways', () => {
    const forms = compareForms(bandit, logits)
    expect(forms.residualScoreFunction).toBeLessThan(1e-12)
    expect(forms.residualBaseline).toBeLessThan(1e-12)
    // The direct form is the closed derivative the derivation ends with.
    forms.direct.forEach((value, arm) => {
      const probabilities = softmax(logits)
      expect(value).toBeCloseTo(probabilities[arm]! * (bandit.rewards[arm]! - forms.objective), 15)
    })
  })

  it('is moved by a baseline that depends on the action', () => {
    const forms = compareForms(bandit, logits)
    expect(forms.wrongBaselineResidual).toBeGreaterThan(1e-6)
    const probabilities = softmax(logits)
    const direct = directGradient(bandit, logits)
    const arm = best(bandit)
    const moved = actionDependentGradient(bandit, logits, 0.5, arm)
    moved.forEach((value, index) => {
      // The shift is half a unit taken off one arm, so the gradient loses
      // 0.5 × π_arm × the score function of that arm — and the score function
      // of an arm is `1 at its own logit, minus the probability of each`.
      const score = (index === arm ? 1 : 0) - probabilities[index]!
      expect(value).toBeCloseTo(direct[index]! - 0.5 * probabilities[arm]! * score, 15)
    })
  })

  it('matches the exact moments of the sampled estimator', () => {
    const moments = estimatorMoments(bandit, logits)
    const direct = directGradient(bandit, logits)
    expect(maxDifference(moments.mean, direct)).toBeLessThan(1e-15)
    expect(scoreFunctionGradient(bandit, logits)).toHaveLength(direct.length)
  })

  it('draws an estimate whose empirical mean is the exact gradient', () => {
    const samples = 50000
    const statistics = sampleStatistics(bandit, logits, { samples, seed: 11 })
    const moments = estimatorMoments(bandit, logits)
    // The distance left over is a sampling error, so it is measured against the
    // standard error the exact moments predict — not against a number invented
    // for the test.
    statistics.mean.forEach((value, index) => {
      const standardError = (moments.deviation[index] ?? 0) / Math.sqrt(samples)
      expect(Math.abs(value - (moments.mean[index] ?? 0))).toBeLessThan(6 * standardError + 1e-12)
      expect(Math.abs(value - (directGradient(bandit, logits)[index] ?? 0))).toBeLessThan(
        6 * standardError + 1e-12,
      )
    })
  })

  it('takes the variance down and the bias nowhere with a baseline', () => {
    const effect = baselineVarianceEffect(bandit, logits)
    expect(maxDifference(effect.withoutBaseline.mean, effect.withBaseline.mean)).toBeLessThan(1e-15)
    expect(effect.withBaseline.spread).toBeLessThan(effect.withoutBaseline.spread)
    expect(effect.ratio).toBeGreaterThan(1)
  })

  it('climbs to the best arm when it follows the gradient', () => {
    const trained = trainBandit(bandit, { steps: 200, learningRate: 0.6 })
    const first = trained.history[0]!
    const last = trained.history[trained.history.length - 1]!
    expect(last.objective).toBeGreaterThan(first.objective)
    expect(last.best).toBeGreaterThan(first.best)
    expect(last.best).toBeGreaterThan(0.95)
    expect(last.objective).toBeCloseTo(Math.max(...bandit.rewards), 1)
  })
})
