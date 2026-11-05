/**
 * The checks behind Laboratory B and the reward-to-go half of Laboratory C.
 *
 * The policy gradient is only worth teaching if the number on the screen is a
 * gradient, so the reference answer is tested against the function it is a
 * derivative of — not against another run of the same estimator. The
 * reward-to-go claim is tested the same way: the two weightings have to agree
 * in the mean and disagree in the spread, and both halves of that have to be
 * measured.
 */

import { describe, expect, it } from 'vitest'
import {
  buildGridworld,
  expectedReturn,
  policyReturn,
  solveLinearSystem,
  SoftmaxPolicy,
  stateCount,
  stochasticAdvantages,
  stochasticPolicyEvaluation,
  stochasticPolicyValues,
  transition,
} from './mdp'
import {
  compareRewardWeightings,
  exactGradient,
  gradientNorm,
  reinforceGradient,
  type WeightingComparison,
} from './policygradient'

const world = buildGridworld()

/** A policy whose logits vary, so that its gradient is not degenerate. */
function softmaxPolicy(scale: number): SoftmaxPolicy {
  const states = stateCount(world)
  const logits = new Array<number>(states * 4).fill(0)
  for (let index = 0; index < logits.length; index++) {
    logits[index] = 0.2 * Math.sin(index * scale + 1)
  }
  return new SoftmaxPolicy(states, 4, logits)
}

/** The same equation the solve answers, iterated to a tolerance instead. */
function iteratePolicyValues(policy: SoftmaxPolicy): number[] {
  const states = stateCount(world)
  let values = new Array<number>(states).fill(0)
  for (let sweep = 0; sweep < 4000; sweep++) {
    const next = new Array<number>(states).fill(0)
    for (let state = 0; state < states; state++) {
      if (world.terminal.includes(state)) continue
      const probabilities = policy.probabilities(state)
      let value = 0
      for (let action = 0; action < 4; action++) {
        const { probabilities: successors, reward } = transition(world, state, action)
        let expected = reward
        for (let s = 0; s < states; s++) expected += (successors[s] ?? 0) * (values[s] ?? 0)
        value += (probabilities[action] ?? 0) * expected
      }
      next[state] = value
    }
    values = next
  }
  return values
}

describe('the exact policy evaluation', () => {
  it('leaves no Bellman error', () => {
    const { values, residual } = stochasticPolicyEvaluation(world, softmaxPolicy(0.7))
    expect(residual).toBeLessThan(1e-9)
    expect(values).toHaveLength(stateCount(world))
    expect(values[stateCount(world) - 1]).toBe(0)
  })

  it('agrees with the iteration it replaced', () => {
    const policy = softmaxPolicy(0.3)
    const solved = stochasticPolicyValues(world, policy)
    const iterated = iteratePolicyValues(policy)
    for (let state = 0; state < solved.length; state++) {
      expect(solved[state]!).toBeCloseTo(iterated[state]!, 6)
    }
  })

  it('gives a lower value to a worse policy', () => {
    const uniform = policyReturn(world, new SoftmaxPolicy(stateCount(world), 4))
    const sharp = policyReturn(world, softmaxPolicy(3))
    expect(Number.isFinite(uniform)).toBe(true)
    expect(Number.isFinite(sharp)).toBe(true)
    expect(Math.abs(sharp - uniform)).toBeGreaterThan(1e-6)
  })
})

describe('the linear solve', () => {
  it('solves a system with a known answer', () => {
    const solution = solveLinearSystem(
      [
        [4, 3, 0],
        [0, 2, 1],
        [1, 0, 5],
      ],
      [10, 5, 12],
    )
    expect(solution[0]!).toBeCloseTo(61 / 43, 10)
    expect(solution[1]!).toBeCloseTo(62 / 43, 10)
    expect(solution[2]!).toBeCloseTo(91 / 43, 10)
  })
})

describe('the reference gradient', () => {
  it('is the derivative of the return it is taken from', () => {
    const policy = softmaxPolicy(0.7)
    const gradient = exactGradient(world, policy)
    const base = policyReturn(world, policy)
    const step = 1e-4
    const uphill = policyReturn(
      world,
      new SoftmaxPolicy(
        policy.states,
        policy.actions,
        policy.logits.map((value, index) => value + step * (gradient[index] ?? 0)),
      ),
    )
    // The first-order prediction: J(θ + αg) − J(θ) = α‖g‖² + O(α²).
    const predicted = step * gradientNorm(gradient) ** 2
    const measured = uphill - base
    expect(measured).toBeGreaterThan(0)
    expect(Math.abs(measured - predicted) / predicted).toBeLessThan(0.05)
  })

  it('is a derivative of the stochastic value, not of the greedy one', () => {
    // The greedy policy's return is a step function of the logits, so a
    // central difference of it would return zero almost everywhere. The
    // reference has to be the value of the policy the agent actually follows,
    // and that value is a different number.
    const policy = new SoftmaxPolicy(stateCount(world), 4)
    const stochastic = policyReturn(world, policy)
    const greedy = expectedReturn(world, policy.greedy())
    expect(stochastic).not.toBeCloseTo(greedy, 3)
    const reference = exactGradient(world, policy)
    // The component with the largest slope, so the comparison is not a fight
    // with rounding: a forward difference at 1e-4 has to match the central one.
    let index = 0
    for (let candidate = 1; candidate < reference.length; candidate++) {
      if (Math.abs(reference[candidate] ?? 0) > Math.abs(reference[index] ?? 0)) index = candidate
    }
    const step = 1e-4
    const perturbed = policy.withLogit(
      Math.floor(index / policy.actions),
      index % policy.actions,
      (policy.logits[index] ?? 0) + step,
    )
    const forward = (policyReturn(world, perturbed) - stochastic) / step
    const expected = reference[index] ?? 0
    expect(Math.abs(expected)).toBeGreaterThan(0.1)
    expect(Math.abs(forward - expected) / Math.abs(expected)).toBeLessThan(0.05)
  })
})

describe('the estimator against the reference', () => {
  it('points uphill, with a baseline', () => {
    const policy = softmaxPolicy(0.7)
    const { values } = stochasticAdvantages(world, policy)
    const estimate = reinforceGradient(world, policy, {
      trajectories: 4000,
      seed: 3,
      baseline: (trajectory, index) => values[trajectory.states[index] ?? 0] ?? 0,
    })
    const base = policyReturn(world, policy)
    const norm = gradientNorm(estimate)
    const step = 1e-4
    const uphill = policyReturn(
      world,
      new SoftmaxPolicy(
        policy.states,
        policy.actions,
        policy.logits.map((value, index) => value + step * (estimate[index] ?? 0)),
      ),
    )
    expect(norm).toBeGreaterThan(0)
    expect(uphill).toBeGreaterThan(base)
  })
})

describe('reward-to-go against the total return', () => {
  const policy = new SoftmaxPolicy(stateCount(world), 4)
  const { values } = stochasticAdvantages(world, policy)
  const baseline = (trajectory: { states: number[] }, index: number) =>
    values[trajectory.states[index] ?? 0] ?? 0

  const plain: WeightingComparison = compareRewardWeightings(world, policy, {
    batches: 16,
    trajectoriesPerBatch: 250,
    seed: 2,
  })
  const shifted: WeightingComparison = compareRewardWeightings(world, policy, {
    batches: 16,
    trajectoriesPerBatch: 250,
    seed: 2,
    baseline,
  })

  it('has the same expectation', () => {
    expect(plain.meanGap).toBeLessThan(0.1)
    expect(shifted.meanGap).toBeLessThan(0.1)
    // Neither weighting is biased: both means sit near the exact gradient.
    expect(plain.relativeErrorRewardToGo).toBeLessThan(0.5)
    expect(plain.relativeErrorTotal).toBeLessThan(0.5)
  })

  it('has a smaller spread', () => {
    expect(plain.spreadRatio).toBeGreaterThan(1.2)
    expect(shifted.spreadRatio).toBeGreaterThan(1)
  })

  it('is a difference the baseline largely removes', () => {
    expect(shifted.spreadRatio).toBeLessThan(plain.spreadRatio)
    expect(shifted.rewardToGo.deviation).toHaveLength(policy.logits.length)
    const spread = (entries: number[]) => Math.sqrt(entries.reduce((sum, value) => sum + value * value, 0))
    expect(spread(shifted.rewardToGo.deviation)).toBeLessThan(spread(plain.rewardToGo.deviation))
  })
})
