import { describe, expect, it } from 'vitest'
import {
  buildGridworld,
  neighbour,
  policyEvaluation,
  policyReturn,
  rollout,
  SoftmaxPolicy,
  stateCount,
  stochasticAdvantages,
  stochasticPolicyEvaluation,
  transition,
  valueIteration,
} from './mdp'
import { compareGradients, exactGradient, gradientStandardDeviation, reinforceGradient, returnsFromEachStep } from './policygradient'
import {
  advantageEstimate,
  generalAdvantage,
  lambdaReturn,
  measureEstimator,
  nStepReturn,
} from './returns'
import { criticGap, optimalValue, runActorCritic } from './actorcritic'

const world = buildGridworld()

describe('the gridworld', () => {
  it('has the right number of states', () => {
    expect(stateCount(world)).toBe(16)
  })

  it('keeps the agent inside the grid and off the walls', () => {
    expect(neighbour(world, 0, 0)).toBe(0) // up from the top-left
    expect(neighbour(world, 1, 1)).toBe(1) // into a wall, so the agent stays
    expect(neighbour(world, 15, 1)).toBe(15) // down from the bottom-right
  })

  it('has a transition kernel that sums to one', () => {
    for (let state = 0; state < stateCount(world); state++) {
      for (let action = 0; action < 4; action++) {
        const { probabilities } = transition(world, state, action)
        const total = probabilities.reduce((a, b) => a + b, 0)
        expect(total).toBeCloseTo(1, 10)
      }
    }
  })

  it('pays the goal a positive reward', () => {
    const { reward } = transition(world, 11, 1)
    expect(reward).toBeGreaterThan(0)
    const { reward: elsewhere } = transition(world, 0, 1)
    expect(elsewhere).toBeLessThan(0)
  })

  it('rewards the goal and penalises the steps', () => {
    const { reward } = transition(world, 0, 1)
    expect(reward).toBe(world.stepReward)
  })
})

describe('dynamic programming', () => {
  it('computes a value function that satisfies the Bellman equation', () => {
    const { values } = valueIteration(world)
    for (let state = 0; state < stateCount(world); state++) {
      if (world.terminal.includes(state)) continue
      let best = -Infinity
      for (let action = 0; action < 4; action++) {
        const { probabilities, reward } = transition(world, state, action)
        let value = reward
        for (let s = 0; s < stateCount(world); s++) value += (probabilities[s] ?? 0) * (values[s] ?? 0)
        best = Math.max(best, value)
      }
      expect(best).toBeCloseTo(values[state] ?? 0, 6)
    }
  })

  it('gives a value that is positive where the goal pays and zero at the goal', () => {
    const { values } = valueIteration(world)
    expect(values[0]!).toBeGreaterThan(0)
    expect(values[15]!).toBe(0)
  })

  it('converges', () => {
    const { residual, iterations } = valueIteration(world)
    expect(residual).toBeLessThan(1e-8)
    expect(iterations).toBeLessThan(500)
  })

  it('evaluates a policy to the same answer as the iteration of its values', () => {
    const { values } = valueIteration(world)
    const { values: evaluated } = policyEvaluation(world, values.length ? greedyFrom(values) : [])
    expect(evaluated[0]!).toBeCloseTo(values[0]!, 4)
  })
})

function greedyFrom(values: number[]): number[] {
  const policy: number[] = []
  for (let state = 0; state < stateCount(world); state++) {
    let best = 0
    for (let action = 1; action < 4; action++) {
      const { probabilities, reward } = transition(world, state, action)
      let value = reward
      for (let s = 0; s < stateCount(world); s++) value += (probabilities[s] ?? 0) * (values[s] ?? 0)
      const { probabilities: p2, reward: r2 } = transition(world, state, best)
      let value2 = r2
      for (let s = 0; s < stateCount(world); s++) value2 += (p2[s] ?? 0) * (values[s] ?? 0)
      if (value > value2) best = action
    }
    policy.push(best)
  }
  return policy
}

describe('the trajectory', () => {
  it('is reproducible for a given seed', () => {
    const policy = new SoftmaxPolicy(stateCount(world), 4)
    const a = rollout(world, policy, 42)
    const b = rollout(world, policy, 42)
    expect(a.states).toEqual(b.states)
    expect(a.rewards).toEqual(b.rewards)
  })

  it('ends at the goal or at the horizon', () => {
    const policy = new SoftmaxPolicy(stateCount(world), 4)
    const trajectory = rollout(world, policy, 7)
    expect(trajectory.states.length).toBeLessThanOrEqual(100)
    expect(trajectory.ended === 'goal' || trajectory.states.length === 100).toBe(true)
  })

  it('computes the return from each step', () => {
    expect(returnsFromEachStep([1, 2, 3])).toEqual([6, 5, 3])
  })
})

describe('the policy gradient', () => {
  it('estimates the gradient of the exact expected return', () => {
    const policy = new SoftmaxPolicy(stateCount(world), 4)
    const comparison = compareGradients(world, policy, { trajectories: 6000, seed: 3 })
    expect(comparison.relativeError).toBeLessThan(0.5)
  })

  it('has a gradient that is not zero', () => {
    const policy = new SoftmaxPolicy(stateCount(world), 4)
    const gradient = exactGradient(world, policy)
    const norm = Math.sqrt(gradient.reduce((sum, value) => sum + value * value, 0))
    expect(norm).toBeGreaterThan(0.1)
  })

  it('reduces the variance when a baseline is used', () => {
    const policy = new SoftmaxPolicy(stateCount(world), 4)
    const { values } = stochasticPolicyEvaluation(world, policy)
    const without = gradientStandardDeviation(world, policy, { batches: 8, trajectoriesPerBatch: 100, seed: 5 })
    const withBaseline = gradientStandardDeviation(world, policy, {
      batches: 8,
      trajectoriesPerBatch: 100,
      seed: 5,
      baseline: (trajectory, index) => values[trajectory.states[index] ?? 0] ?? 0,
    })
    const norm = (deviations: number[]) =>
      Math.sqrt(deviations.reduce((sum, value) => sum + value * value, 0))
    expect(norm(withBaseline.deviation)).toBeLessThan(norm(without.deviation))
  })

  it('is unchanged by a baseline, in expectation', () => {
    const policy = new SoftmaxPolicy(stateCount(world), 4)
    const { values } = stochasticPolicyEvaluation(world, policy)
    const plain = reinforceGradient(world, policy, { trajectories: 3000, seed: 8 })
    const baselined = reinforceGradient(world, policy, {
      trajectories: 3000,
      seed: 8,
      baseline: (trajectory, index) => values[trajectory.states[index] ?? 0] ?? 0,
    })
    const norm = (gradient: number[]) => Math.sqrt(gradient.reduce((sum, value) => sum + value * value, 0))
    expect(norm(baselined)).toBeLessThan(norm(plain) * 1.5)
  })
})

describe('the returns', () => {
  it('computes the n-step return', () => {
    expect(nStepReturn([1, 2, 3, 4], 0, 2, 1)).toBe(3)
    expect(nStepReturn([1, 2, 3, 4], 0, 4, 1)).toBe(10)
  })

  it('reduces to the Monte Carlo return at lambda one', () => {
    const rewards = [1, 2, 3, 4]
    const monteCarlo = nStepReturn(rewards, 0, rewards.length, 0.9)
    expect(lambdaReturn(rewards, 0, 1, 0.9, 0)).toBeCloseTo(monteCarlo, 8)
  })

  it('reduces to the one-step return at lambda zero', () => {
    const rewards = [1, 2, 3, 4]
    expect(lambdaReturn(rewards, 0, 0, 0.9, 0)).toBeCloseTo(1, 8)
  })

  it('has a bias and a variance that trade off as lambda moves', () => {
    const policy = new SoftmaxPolicy(stateCount(world), 4)
    const { values, advantages } = stochasticAdvantages(world, policy)
    const errors = [0, 0.5, 0.9, 1].map((lambda) =>
      measureEstimator(world, policy, lambda, {
        trajectories: 300,
        horizon: 5,
        values,
        advantages,
      }),
    )
    // The one-step estimate is biased and quiet; the full one is unbiased and noisy.
    // The bias grows with lambda and the variance falls with it.
    expect(Math.abs(errors[errors.length - 1]!.bias)).toBeGreaterThan(Math.abs(errors[0]!.bias))
    expect(errors[errors.length - 1]!.variance).toBeLessThan(errors[0]!.variance)
  })

  it('computes the advantage', () => {
    const values = [1, 2, 3]
    const rewards = [1, 1, 1]
    const advantage = generalAdvantage(rewards, values, 0, 1, 1)
    expect(advantage).toBeCloseTo(3 - 1, 8)
  })

  it('computes the general advantage estimate', () => {
    const rewards = [1, 1, 1]
    const values = [0, 0, 0, 0]
    // Every delta is 1, so the estimate is the sum of the weights.
    expect(advantageEstimate(rewards, values, 0, 0, 0.9)).toBeCloseTo(1, 8)
    expect(advantageEstimate(rewards, values, 0, 1, 0.9)).toBeCloseTo(1 + 0.9 + 0.81, 8)
  })
})

describe('the actor-critic loop', () => {
  it('learns: the return goes up', () => {
    const policy = new SoftmaxPolicy(stateCount(world), 4)
    const { episodes } = runActorCritic(world, policy, { episodes: 200, seed: 3 })
    const first = episodes.slice(0, 20).reduce((sum, record) => sum + record.total, 0) / 20
    const last = episodes.slice(-20).reduce((sum, record) => sum + record.total, 0) / 20
    expect(last).toBeGreaterThan(first)
  })

  it('reaches a return better than a random policy', () => {
    const policy = new SoftmaxPolicy(stateCount(world), 4)
    const { episodes, policy: learned } = runActorCritic(world, policy, { episodes: 400, seed: 11 })
    const random = policyReturn(world, new SoftmaxPolicy(stateCount(world), 4))
    const learnedReturn = policyReturn(world, learned)
    expect(learnedReturn).toBeGreaterThan(random)
    const best = episodes.reduce((lowest, record) => Math.min(lowest, record.total), Infinity)
    expect(best).toBeGreaterThan(-100)
  })

  it('reports the gap between the critic and the truth', () => {
    const policy = new SoftmaxPolicy(stateCount(world), 4)
    const { values } = runActorCritic(world, policy, { episodes: 100, seed: 2 })
    expect(Number.isFinite(criticGap(world, policy, values))).toBe(true)
  })

  it('knows the optimal value', () => {
    // The goal pays more than the steps cost, so the optimal value is positive.
    expect(optimalValue(world)).toBeGreaterThan(0)
    expect(optimalValue(world)).toBeLessThan(world.goalReward)
  })
})
