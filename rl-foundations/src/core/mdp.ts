/**
 * A gridworld, and the exact answers to its questions.
 *
 * The course needs a problem with a right answer: a small enough
 * Markov decision process that the value function, the optimal policy and
 * the expected return of a parameterised policy can all be computed exactly,
 * and large enough that the answers are worth having.
 *
 * This is such a problem. The grid is four by four, the agent gets a small
 * negative reward for every step and a large one for reaching the goal, and
 * the moves slip. Everything the laboratories claim is then checked against
 * an exact computation rather than against another simulation.
 */

import { createRng } from '@llm-materials/course-core'

export type Action = number

/** Up, down, left, right. */
export const ACTIONS: Action[] = [0, 1, 2, 3]
export const ACTION_NAMES = ['up', 'down', 'left', 'right']

export interface Gridworld {
  /** The width and the height of the grid. */
  width: number
  height: number
  /** The cells that are walls. */
  walls: number[]
  /** The goal cell. */
  goal: number
  /** The reward for taking a step. */
  stepReward: number
  /** The reward for reaching the goal. */
  goalReward: number
  /** The probability that a move goes where it was aimed. */
  accuracy: number
  /** The terminal states. */
  terminal: number[]
}

export interface Transition {
  /** The probability of each successor. */
  probabilities: number[]
  /** The expected reward of each action. */
  reward: number
}

/** The default gridworld: four by four, with two walls. */
export function buildGridworld(options: Partial<Gridworld> = {}): Gridworld {
  return {
    width: 4,
    height: 4,
    walls: [5, 10],
    goal: 15,
    stepReward: -1,
    goalReward: 10,
    accuracy: 0.8,
    terminal: [15],
    ...options,
  }
}

/** The number of states in a gridworld. */
export function stateCount(world: Gridworld): number {
  return world.width * world.height
}

/** The state at a position. */
export function stateAt(world: Gridworld, row: number, column: number): number {
  return row * world.width + column
}

/** The row and column of a state. */
export function positionOf(world: Gridworld, state: number): { row: number; column: number } {
  return { row: Math.floor(state / world.width), column: state % world.width }
}

/** The state one step away in the given direction, or the same state. */
export function neighbour(world: Gridworld, state: number, action: number): number {
  const { row, column } = positionOf(world, state)
  let nextRow = row
  let nextColumn = column
  if (action === 0) nextRow -= 1
  if (action === 1) nextRow += 1
  if (action === 2) nextColumn -= 1
  if (action === 3) nextColumn += 1
  if (nextRow < 0 || nextRow >= world.height || nextColumn < 0 || nextColumn >= world.width) return state
  const next = stateAt(world, nextRow, nextColumn)
  if (world.walls.includes(next)) return state
  return next
}

/** The transition kernel of the gridworld. */
export function transition(world: Gridworld, state: number, action: number): Transition {
  const states = stateCount(world)
  const probabilities = new Array<number>(states).fill(0)
  const slip = (1 - world.accuracy) / (ACTIONS.length - 1)
  for (const other of ACTIONS) {
    const probability = other === action ? world.accuracy : slip
    const next = neighbour(world, state, other)
    probabilities[next] = (probabilities[next] ?? 0) + probability
  }
  // The reward is the one for *arriving* at a state: the goal pays, every
  // other step costs, and a terminal state pays nothing because the episode
  // is over.
  let reward = 0
  for (let s = 0; s < states; s++) {
    const probability = probabilities[s] ?? 0
    if (probability === 0) continue
    if (world.terminal.includes(s)) reward += probability * world.goalReward
    else reward += probability * world.stepReward
  }
  return { probabilities, reward }
}

/** The state distribution at the start of an episode. */
export const START_STATE = 0

/* -------------------------------------------------------------------------- */
/* Dynamic programming                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The Bellman optimality operator.
 *
 * One application of it is a sweep: for every state, the value of the best
 * action, and the value of the state is that.
 */
export function bellmanOptimality(
  world: Gridworld,
  values: number[],
): { values: number[]; greedy: Action[] } {
  const states = stateCount(world)
  const next = new Array<number>(states).fill(0)
  const greedy: Action[] = new Array<number>(states).fill(0)
  for (let state = 0; state < states; state++) {
    if (world.terminal.includes(state)) {
      next[state] = 0
      continue
    }
    let best = -Infinity
    let bestAction: Action = 0
    for (const action of ACTIONS) {
      const { probabilities, reward } = transition(world, state, action)
      let value = reward
      for (let s = 0; s < states; s++) {
        value += (probabilities[s] ?? 0) * (values[s] ?? 0)
      }
      if (value > best) {
        best = value
        bestAction = action
      }
    }
    next[state] = best === -Infinity ? 0 : best
    greedy[state] = bestAction
  }
  return { values: next, greedy }
}

/** The value function of the optimal policy, by value iteration. */
export function valueIteration(
  world: Gridworld,
  options: { tolerance?: number; maxIterations?: number } = {},
): { values: number[]; policy: Action[]; iterations: number; residual: number } {
  const settings = { tolerance: 1e-10, maxIterations: 2000, ...options }
  let values = new Array<number>(stateCount(world)).fill(0)
  let policy: Action[] = new Array<number>(stateCount(world)).fill(0)
  let iterations = 0
  let residual = Infinity
  for (; iterations < settings.maxIterations; iterations++) {
    const step = bellmanOptimality(world, values)
    residual = Math.max(...step.values.map((value, index) => Math.abs(value - (values[index] ?? 0))))
    values = step.values
    policy = step.greedy
    if (residual < settings.tolerance) {
      iterations++
      break
    }
  }
  return { values, policy, iterations, residual }
}

/** The value of a state under a given policy, by iteration. */
export function policyEvaluation(
  world: Gridworld,
  policy: Action[],
  options: { tolerance?: number; maxIterations?: number } = {},
): { values: number[]; residual: number } {
  const settings = { tolerance: 1e-12, maxIterations: 5000, ...options }
  const states = stateCount(world)
  let values = new Array<number>(states).fill(0)
  let residual = Infinity
  let iterations = 0
  for (; iterations < settings.maxIterations; iterations++) {
    const next = new Array<number>(states).fill(0)
    for (let state = 0; state < states; state++) {
      if (world.terminal.includes(state)) {
        next[state] = 0
        continue
      }
      const action = policy[state] ?? 0
      const { probabilities, reward } = transition(world, state, action)
      let value = reward
      for (let s = 0; s < states; s++) value += (probabilities[s] ?? 0) * (values[s] ?? 0)
      next[state] = value
    }
    residual = Math.max(...next.map((value, index) => Math.abs(value - (values[index] ?? 0))))
    values = next
    if (residual < settings.tolerance) {
      iterations++
      break
    }
  }
  return { values, residual }
}

/** The expected return of a policy, from the start state. */
export function expectedReturn(world: Gridworld, policy: Action[]): number {
  const { values } = policyEvaluation(world, policy)
  return values[START_STATE] ?? 0
}

/* -------------------------------------------------------------------------- */
/* The parameterised policy                                                    */
/* -------------------------------------------------------------------------- */

/** A softmax policy over the actions, with one logit per state and action. */
export class SoftmaxPolicy {
  readonly states: number
  readonly actions: number
  readonly logits: number[]

  constructor(states: number, actions: number, logits?: number[]) {
    this.states = states
    this.actions = actions
    this.logits = logits ?? new Array<number>(states * actions).fill(0)
  }

  /** The probability of each action in a state. */
  probabilities(state: number): number[] {
    const row: number[] = []
    for (let a = 0; a < this.actions; a++) row.push(this.logits[state * this.actions + a] ?? 0)
    const maximum = Math.max(...row)
    const exponentials = row.map((value) => Math.exp(value - maximum))
    const total = exponentials.reduce((a, b) => a + b, 0)
    return exponentials.map((value) => value / total)
  }

  /** The log-probability of an action in a state. */
  logProbability(state: number, action: number): number {
    const probabilities = this.probabilities(state)
    return Math.log(Math.max(probabilities[action] ?? 1e-12, 1e-12))
  }

  /** The gradient of the log-probability of an action, over the logits. */
  scoreGradient(state: number, action: number): number[] {
    const probabilities = this.probabilities(state)
    const gradient = new Array<number>(this.states * this.actions).fill(0)
    for (let a = 0; a < this.actions; a++) {
      gradient[state * this.actions + a] = (a === action ? 1 : 0) - (probabilities[a] ?? 0)
    }
    return gradient
  }

  /** The greedy policy this policy induces. */
  greedy(): Action[] {
    const policy: Action[] = new Array<number>(this.states).fill(0)
    for (let state = 0; state < this.states; state++) {
      const probabilities = this.probabilities(state)
      let best = 0
      for (let a = 1; a < this.actions; a++) {
        if ((probabilities[a] ?? 0) > (probabilities[best] ?? 0)) best = a
      }
      policy[state] = best
    }
    return policy
  }

  /** A copy with one logit changed. */
  withLogit(state: number, action: number, value: number): SoftmaxPolicy {
    const logits = [...this.logits]
    logits[state * this.actions + action] = value
    return new SoftmaxPolicy(this.states, this.actions, logits)
  }
}

/**
 * The true advantage of every state and action under a stochastic policy.
 *
 * The value of the state, and the value of taking each action and then
 * behaving according to the policy. The advantage is the difference, and it
 * is exact: it is computed from the solved value function, not estimated from samples.
 */
export function stochasticAdvantages(
  world: Gridworld,
  policy: SoftmaxPolicy,
): { values: number[]; advantages: number[] } {
  const { values } = stochasticPolicyEvaluation(world, policy)
  const states = stateCount(world)
  const advantages = new Array<number>(states * policy.actions).fill(0)
  for (let state = 0; state < states; state++) {
    if (world.terminal.includes(state)) continue
    for (let a = 0; a < policy.actions; a++) {
      const { probabilities, reward } = transition(world, state, a as Action)
      let expected = reward
      for (let s = 0; s < states; s++) expected += (probabilities[s] ?? 0) * (values[s] ?? 0)
      advantages[state * policy.actions + a] = expected - (values[state] ?? 0)
    }
  }
  return { values, advantages }
}

/**
 * The expected return of a parameterised policy, exactly.
 *
 * The value of the *stochastic* policy is solved from the evaluation equations, and the
 * expected return is the value of the start state. This is the function the
 * policy gradient is a gradient of, and the finite-difference check is a check
 * against it. The greedy policy would be the wrong object to differentiate:
 * its return is a step function of the logits, so its derivative is zero
 * almost everywhere and infinite at the ties.
 */
export function policyReturn(world: Gridworld, policy: SoftmaxPolicy): number {
  return stochasticPolicyEvaluation(world, policy).values[START_STATE] ?? 0
}

/* -------------------------------------------------------------------------- */
/* Trajectories                                                                */
/* -------------------------------------------------------------------------- */

export interface Trajectory {
  /** The states visited. */
  states: number[]
  /** The actions taken. */
  actions: Action[]
  /** The rewards received. */
  rewards: number[]
  /** The total return. */
  total: number
  /** Why the episode ended. */
  ended: 'goal' | 'horizon'
}

/** The length of an episode, before it is cut off. */
export const MAX_EPISODE_LENGTH = 100

/**
 * Run one episode of a policy.
 *
 * The seed is explicit, so that a trajectory can be reproduced exactly — which
 * is what makes a gradient check possible.
 */
export function rollout(
  world: Gridworld,
  policy: SoftmaxPolicy,
  seed: number,
  options: { start?: number; maxLength?: number } = {},
): Trajectory {
  const settings = { start: START_STATE, maxLength: MAX_EPISODE_LENGTH, ...options }
  const rng = createRng(seed)
  const states: number[] = []
  const actions: Action[] = []
  const rewards: number[] = []
  let state = settings.start
  let total = 0
  let ended: 'goal' | 'horizon' = 'horizon'

  for (let step = 0; step < settings.maxLength; step++) {
    if (world.terminal.includes(state)) {
      ended = 'goal'
      break
    }
    const probabilities = policy.probabilities(state)
    const u = rng()
    let cumulative = 0
    let action: Action = 0
    for (let a = 0; a < ACTIONS.length; a++) {
      cumulative += probabilities[a] ?? 0
      if (u <= cumulative) {
        action = a as Action
        break
      }
    }
    const { probabilities: next, reward } = transition(world, state, action)
    const v = rng()
    let nextState = state
    let cumulativeNext = 0
    for (let s = 0; s < next.length; s++) {
      cumulativeNext += next[s] ?? 0
      if (v <= cumulativeNext) {
        nextState = s
        break
      }
    }
    states.push(state)
    actions.push(action)
    rewards.push(reward)
    total += reward
    state = nextState
    if (world.terminal.includes(state)) {
      ended = 'goal'
      break
    }
  }

  return { states, actions, rewards, total, ended }
}

/**
 * Solve a square linear system, by Gaussian elimination with partial pivoting.
 *
 * The state space is sixteen cells wide, so the arithmetic is negligible and
 * exactness is free.
 */
export function solveLinearSystem(matrix: number[][], right: number[]): number[] {
  const size = right.length
  const rows = matrix.map((row, index) => [...row, right[index] ?? 0])
  for (let column = 0; column < size; column++) {
    let pivot = column
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(rows[row]![column] ?? 0) > Math.abs(rows[pivot]![column] ?? 0)) pivot = row
    }
    if (Math.abs(rows[pivot]![column] ?? 0) < 1e-14) throw new RangeError('the system is singular')
    if (pivot !== column) {
      const swap = rows[column]!
      rows[column] = rows[pivot]!
      rows[pivot] = swap
    }
    const anchor = rows[column]![column]!
    for (let row = 0; row < size; row++) {
      if (row === column) continue
      const factor = (rows[row]![column] ?? 0) / anchor
      if (factor === 0) continue
      for (let k = column; k <= size; k++) {
        rows[row]![k] = (rows[row]![k] ?? 0) - factor * (rows[column]![k] ?? 0)
      }
    }
  }
  return rows.map((row, index) => (row[size] ?? 0) / (row[index] ?? 1))
}

/**
 * The value of a stochastic policy, solved exactly.
 *
 * The evaluation equations are linear — V = r + P V, with P the state chain the
 * policy induces — and with sixteen states the system is worth solving outright
 * rather than iterating to a tolerance. The finite-difference gradient check
 * differentiates this function, so its accuracy is the accuracy of the
 * reference answer.
 */
export function stochasticPolicyValues(world: Gridworld, policy: SoftmaxPolicy): number[] {
  const states = stateCount(world)
  const matrix: number[][] = []
  const right: number[] = []
  for (let state = 0; state < states; state++) {
    const row = new Array<number>(states).fill(0)
    if (world.terminal.includes(state)) {
      row[state] = 1
      matrix.push(row)
      right.push(0)
      continue
    }
    const probabilities = policy.probabilities(state)
    let reward = 0
    for (let a = 0; a < policy.actions; a++) {
      const { probabilities: successors, reward: expected } = transition(world, state, a as Action)
      const weight = probabilities[a] ?? 0
      reward += weight * expected
      for (let next = 0; next < states; next++) {
        row[next] = (row[next] ?? 0) - weight * (successors[next] ?? 0)
      }
    }
    row[state] = (row[state] ?? 0) + 1
    matrix.push(row)
    right.push(reward)
  }
  return solveLinearSystem(matrix, right)
}

/**
 * The value of a stochastic policy, and the Bellman error it leaves.
 *
 * The values come from the linear solve; the residual is the largest
 * |V − (r + PV)| over the states, which is the honest way to report how well
 * the solved function satisfies the equation.
 */
export function stochasticPolicyEvaluation(world: Gridworld, policy: SoftmaxPolicy): {
  values: number[]
  residual: number
} {
  const values = stochasticPolicyValues(world, policy)
  const states = stateCount(world)
  let residual = 0
  for (let state = 0; state < states; state++) {
    if (world.terminal.includes(state)) continue
    const probabilities = policy.probabilities(state)
    let value = 0
    for (let a = 0; a < policy.actions; a++) {
      const { probabilities: successors, reward } = transition(world, state, a as Action)
      let expected = reward
      for (let s = 0; s < states; s++) expected += (successors[s] ?? 0) * (values[s] ?? 0)
      value += (probabilities[a] ?? 0) * expected
    }
    residual = Math.max(residual, Math.abs(value - (values[state] ?? 0)))
  }
  return { values, residual }
}
