/**
 * The actor-critic loop.
 *
 * The actor is the policy; the critic is a value function. The critic turns
 * the return into a smaller, less noisy signal — the advantage — and the
 * actor follows the advantage rather than the return. That is the whole idea,
 * and this module runs it: a real loop, on the gridworld, with the learning
 * curves measured at the end.
 */

import { createRng } from '@llm-materials/course-core'
import {
  policyReturn,
  rollout,
  SoftmaxPolicy,
  START_STATE,
  stateCount,
  valueIteration,
  type Gridworld,
} from './mdp'

export interface ActorCriticOptions {
  /** The number of episodes. */
  episodes?: number
  /** The learning rate of the actor. */
  actorLearningRate?: number
  /** The learning rate of the critic. */
  criticLearningRate?: number
  /** The discount. */
  discount?: number
  /** The seed. */
  seed?: number
  /** Whether the actor is updated with the advantage or with the return. */
  useBaseline?: boolean
}

export interface EpisodeRecord {
  /** The episode number. */
  episode: number
  /** The total return of the episode. */
  total: number
  /** The average return over the last twenty episodes. */
  average: number
  /** The value the critic assigns to the start state. */
  startValue: number
  /** The norm of the actor's parameters, for the plots. */
  parameterNorm: number
}

/**
 * Run the actor-critic loop.
 *
 * The critic is a table of values, updated by the temporal-difference error.
 * The actor is a softmax over a logit per state and action, updated with the
 * advantage — the target minus what the critic thought — when the baseline is
 * on, and with the unshifted target when it is off.
 */
export function runActorCritic(
  world: Gridworld,
  policy: SoftmaxPolicy,
  options: ActorCriticOptions = {},
): { episodes: EpisodeRecord[]; policy: SoftmaxPolicy; values: number[] } {
  const settings = {
    episodes: 300,
    actorLearningRate: 0.02,
    criticLearningRate: 0.5,
    discount: 0.95,
    seed: 5,
    useBaseline: true,
    ...options,
  }
  const rng = createRng(settings.seed)
  const states = stateCount(world)
  const logits = [...policy.logits]
  const values = new Array<number>(states).fill(0)
  const records: EpisodeRecord[] = []

  for (let episode = 0; episode < settings.episodes; episode++) {
    const trajectory = rollout(world, new SoftmaxPolicy(states, policy.actions, logits), Math.floor(rng() * 1e9))

    // The critic: a temporal-difference update towards the discounted n-step
    // target, with the value of the state after the last one as the
    // bootstrap.
    const targets: number[] = []
    for (let t = 0; t < trajectory.states.length; t++) {
      let target = 0
      let power = 1
      for (let k = t; k < trajectory.rewards.length; k++) {
        target += power * (trajectory.rewards[k] ?? 0)
        power *= settings.discount
      }
      const nextState = trajectory.states[t + 1]
      target += power * (nextState === undefined ? 0 : (values[nextState] ?? 0))
      targets.push(target)
      const state = trajectory.states[t]!
      values[state] = (values[state] ?? 0) + settings.criticLearningRate * (target - (values[state] ?? 0))
    }

    // The actor: the gradient of the log-probability, weighted by the
    // advantage — the target minus what the critic believed.
    const current = new SoftmaxPolicy(states, policy.actions, logits)
    for (let t = 0; t < trajectory.states.length; t++) {
      const state = trajectory.states[t]!
      const action = trajectory.actions[t]!
      const weight = settings.useBaseline
        ? (targets[t] ?? 0) - (values[state] ?? 0)
        : (targets[t] ?? 0)
      const probabilities = current.probabilities(state)
      for (let a = 0; a < policy.actions; a++) {
        const score = (a === action ? 1 : 0) - (probabilities[a] ?? 0)
        const index = state * policy.actions + a
        logits[index] = (logits[index] ?? 0) + settings.actorLearningRate * score * weight
      }
    }

    const recent = records.slice(-20).map((record) => record.total)
    const average = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length)
    const gradient = new SoftmaxPolicy(states, policy.actions, logits).logits
    const norm = Math.sqrt(gradient.reduce((sum, value) => sum + value * value, 0))
    records.push({
      episode,
      total: trajectory.total,
      average,
      startValue: values[START_STATE] ?? 0,
      parameterNorm: norm,
    })
  }

  return { episodes: records, policy: new SoftmaxPolicy(states, policy.actions, logits), values }
}

/**
 * The gap between what the critic believes and what the policy is worth.
 *
 * A critic that is too optimistic pushes the actor too hard; one that is too
 * pessimistic gives up. The gap is the critic's value of the start state minus
 * the exact expected return of the stochastic policy the actor actually
 * follows — not of the greedy policy, which is a different agent.
 */
export function criticGap(world: Gridworld, policy: SoftmaxPolicy, values: number[]): number {
  return (values[START_STATE] ?? 0) - policyReturn(world, policy)
}

/** The value of the optimal policy, for the ceiling on the learning curves. */
export function optimalValue(world: Gridworld): number {
  const { values } = valueIteration(world)
  return values[START_STATE] ?? 0
}
