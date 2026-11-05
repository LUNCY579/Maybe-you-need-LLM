/**
 * Lab C — World models and decision making.
 *
 * A small grid world with slip dynamics, a goal and a pit. Two agents are
 * compared on the *same* true environment:
 *
 *  - model-free: tabular Q-learning, trained by interacting with the world.
 *  - model-based: the agent learns an approximate model of the dynamics
 *    (accuracy controlled by the learner), plans with value iteration inside
 *    that model, then executes the resulting policy in the real world.
 *
 * The lab reports predicted versus actual transitions, so model error becomes
 * visible rather than anecdotal.
 */

import { createRng, type Rng } from '../prng'

export type GridAction = 0 | 1 | 2 | 3 // up, right, down, left

export const ACTION_NAMES = ['up', 'right', 'down', 'left'] as const

export interface WorldModelConfig {
  width: number
  height: number
  start: [number, number]
  goal: [number, number]
  pit: [number, number]
  walls: [number, number][]
  /** Probability that the executed action slips to a perpendicular action. */
  slip: number
  /** Reward for reaching the goal. */
  goalReward: number
  /** Reward for entering the pit. */
  pitReward: number
  /** Cost per step. */
  stepCost: number
  /** 0..1 — how faithful the learned model is to the true dynamics. */
  modelAccuracy: number
  /** Training episodes for the model-free agent. */
  episodes: number
  /** Evaluation episodes for both agents. */
  evalEpisodes: number
  /** Value-iteration sweeps for the model-based agent. */
  planningSweeps: number
  discount: number
  seed: number
}

export const DEFAULT_WORLD_MODEL_CONFIG: WorldModelConfig = {
  width: 5,
  height: 5,
  start: [0, 4],
  goal: [4, 0],
  pit: [2, 2],
  walls: [
    [1, 2],
    [3, 1],
  ],
  slip: 0.2,
  goalReward: 1,
  pitReward: -1,
  stepCost: -0.02,
  modelAccuracy: 0.8,
  episodes: 200,
  evalEpisodes: 20,
  planningSweeps: 40,
  discount: 0.95,
  seed: 7,
}

const cellKey = (x: number, y: number) => `${x},${y}`

export function isWallish(config: WorldModelConfig, x: number, y: number): boolean {
  return config.walls.some((wall) => wall[0] === x && wall[1] === y)
}

function clamp(config: WorldModelConfig, x: number, y: number): [number, number] {
  const cx = Math.min(config.width - 1, Math.max(0, x))
  const cy = Math.min(config.height - 1, Math.max(0, y))
  if (isWallish(config, cx, cy)) return [-1, -1]
  return [cx, cy]
}

function move(position: [number, number], action: GridAction): [number, number] {
  switch (action) {
    case 0:
      return [position[0], position[1] - 1]
    case 1:
      return [position[0] + 1, position[1]]
    case 2:
      return [position[0], position[1] + 1]
    default:
      return [position[0] - 1, position[1]]
  }
}

/** True dynamics: intended move, with slip to a perpendicular action. */
function trueNext(config: WorldModelConfig, position: [number, number], action: GridAction, rng: Rng): [number, number] {
  let executed: GridAction = action
  if (rng.chance(config.slip)) {
    const perpendicular: GridAction[] = action === 0 || action === 2 ? [1, 3] : [0, 2]
    executed = rng.pick(perpendicular)
  }
  const candidate = move(position, executed)
  const bounded = clamp(config, candidate[0], candidate[1])
  return bounded[0] === -1 ? position : bounded
}

function rewardOf(config: WorldModelConfig, position: [number, number]): number {
  if (position[0] === config.goal[0] && position[1] === config.goal[1]) return config.goalReward
  if (position[0] === config.pit[0] && position[1] === config.pit[1]) return config.pitReward
  return config.stepCost
}

function terminal(config: WorldModelConfig, position: [number, number]): boolean {
  return (
    (position[0] === config.goal[0] && position[1] === config.goal[1]) ||
    (position[0] === config.pit[0] && position[1] === config.pit[1])
  )
}

export function allCells(config: WorldModelConfig): [number, number][] {
  const cells: [number, number][] = []
  for (let y = 0; y < config.height; y += 1) {
    for (let x = 0; x < config.width; x += 1) {
      if (!isWallish(config, x, y)) cells.push([x, y])
    }
  }
  return cells
}

/**
 * The learner's model of the dynamics. With probability `modelAccuracy` it
 * matches the true slip dynamics; otherwise it is the naive deterministic
 * model (the agent believes its actions always work).
 */
export function modelTransition(
  config: WorldModelConfig,
  position: [number, number],
  action: GridAction,
): { next: [number, number]; probability: number }[] {
  const deterministic = clamp(config, ...move(position, action))
  const deterministicNext = deterministic[0] === -1 ? position : deterministic
  const perpendicular: GridAction[] = action === 0 || action === 2 ? [1, 3] : [0, 2]
  const slipTargets = perpendicular.map((candidate) => {
    const target = clamp(config, ...move(position, candidate))
    return target[0] === -1 ? position : target
  })

  const accuracy = Math.min(1, Math.max(0, config.modelAccuracy))
  const trueSlip = config.slip
  const beliefSlip = accuracy * trueSlip

  const outcomes = new Map<string, { next: [number, number]; probability: number }>()
  const add = (next: [number, number], probability: number) => {
    const key = cellKey(next[0], next[1])
    const existing = outcomes.get(key)
    if (existing) existing.probability += probability
    else outcomes.set(key, { next, probability })
  }

  add(deterministicNext, 1 - beliefSlip)
  for (const target of slipTargets) add(target, beliefSlip / slipTargets.length)
  return [...outcomes.values()]
}

/* ------------------------------------------------------------------ */
/* Planners                                                            */
/* ------------------------------------------------------------------ */

export type Policy = Record<string, GridAction>

function greedyFromValues(config: WorldModelConfig, values: Record<string, number>): Policy {
  const policy: Policy = {}
  for (const cell of allCells(config)) {
    if (terminal(config, cell)) continue
    let bestAction: GridAction = 0
    let bestValue = -Infinity
    for (let action = 0 as GridAction; action < 4; action = (action + 1) as GridAction) {
      const outcomes = modelTransition(config, cell, action)
      const expected = outcomes.reduce((sum, outcome) => {
        const nextValue = terminal(config, outcome.next) ? rewardOf(config, outcome.next) : values[cellKey(...outcome.next)]
        return sum + outcome.probability * (rewardOf(config, outcome.next) + config.discount * nextValue)
      }, 0)
      if (expected > bestValue) {
        bestValue = expected
        bestAction = action
      }
    }
    policy[cellKey(cell[0], cell[1])] = bestAction
  }
  return policy
}

export function valueIteration(config: WorldModelConfig): { values: Record<string, number>; policy: Policy; sweeps: number } {
  let values: Record<string, number> = {}
  for (const cell of allCells(config)) values[cellKey(cell[0], cell[1])] = 0

  for (let sweep = 0; sweep < config.planningSweeps; sweep += 1) {
    const next: Record<string, number> = { ...values }
    for (const cell of allCells(config)) {
      if (terminal(config, cell)) continue
      let best = -Infinity
      for (let action = 0 as GridAction; action < 4; action = (action + 1) as GridAction) {
        const outcomes = modelTransition(config, cell, action)
        const expected = outcomes.reduce((sum, outcome) => {
          const immediate = rewardOf(config, outcome.next)
          const continuation = terminal(config, outcome.next) ? 0 : values[cellKey(...outcome.next)]
          return sum + outcome.probability * (immediate + config.discount * continuation)
        }, 0)
        best = Math.max(best, expected)
      }
      next[cellKey(cell[0], cell[1])] = best
    }
    values = next
  }

  return { values, policy: greedyFromValues(config, values), sweeps: config.planningSweeps }
}

export interface TrainingCurvePoint {
  episode: number
  reward: number
  epsilon: number
}

export function qLearning(config: WorldModelConfig): { policy: Policy; curve: TrainingCurvePoint[]; q: Record<string, number[]> } {
  const rng = createRng(config.seed)
  const q: Record<string, number[]> = {}
  const curve: TrainingCurvePoint[] = []
  const alpha = 0.3

  for (const cell of allCells(config)) q[cellKey(cell[0], cell[1])] = [0, 0, 0, 0]

  for (let episode = 0; episode < config.episodes; episode += 1) {
    let position: [number, number] = [config.start[0], config.start[1]]
    let total = 0
    const epsilon = Math.max(0.05, 1 - episode / (config.episodes * 0.6))
    for (let step = 0; step < 60; step += 1) {
      const stateKey = cellKey(position[0], position[1])
      const action: GridAction = rng.chance(epsilon)
        ? (rng.int(4) as GridAction)
        : (q[stateKey].reduce((best, value, index) => (value > q[stateKey][best] ? index : best), 0) as GridAction)
      const next = trueNext(config, position, action, rng)
      const reward = rewardOf(config, next)
      const nextKey = cellKey(next[0], next[1])
      const bestNext = terminal(config, next) ? 0 : Math.max(...q[nextKey])
      q[stateKey][action] += alpha * (reward + config.discount * bestNext - q[stateKey][action])
      total += reward

      if (terminal(config, next)) break
      position = next
    }
    curve.push({ episode, reward: Math.round(total * 1000) / 1000, epsilon: Math.round(epsilon * 100) / 100 })
  }

  const policy: Policy = {}
  for (const cell of allCells(config)) {
    if (terminal(config, cell)) continue
    const values = q[cellKey(cell[0], cell[1])]
    policy[cellKey(cell[0], cell[1])] = values.reduce((best, value, index) => (value > values[best] ? index : best), 0) as GridAction
  }
  return { policy, curve, q }
}

/* ------------------------------------------------------------------ */
/* Evaluation and predicted/actual comparison                          */
/* ------------------------------------------------------------------ */

export interface EpisodeResult {
  path: [number, number][]
  totalReward: number
  reachedGoal: boolean
  fellInPit: boolean
  steps: number
}

export function evaluatePolicy(
  config: WorldModelConfig,
  policy: Policy,
  seedOffset = 0,
): { episodes: EpisodeResult[]; averageReward: number; successRate: number; averageSteps: number; transitionCounts: Record<string, Record<string, number>> } {
  const rng = createRng(config.seed + 1000 + seedOffset)
  const episodes: EpisodeResult[] = []
  const transitionCounts: Record<string, Record<string, number>> = {}

  for (let episode = 0; episode < config.evalEpisodes; episode += 1) {
    let position: [number, number] = [config.start[0], config.start[1]]
    const path: [number, number][] = [position]
    let total = 0
    let steps = 0
    for (let step = 0; step < 40; step += 1) {
      const action = policy[cellKey(position[0], position[1])] ?? 0
      const next = trueNext(config, position, action, rng)
      const stateKey = cellKey(position[0], position[1])
      const moveKey = cellKey(next[0], next[1])
      transitionCounts[stateKey] = transitionCounts[stateKey] ?? {}
      transitionCounts[stateKey][moveKey] = (transitionCounts[stateKey][moveKey] ?? 0) + 1
      total += rewardOf(config, next)
      steps += 1
      path.push(next)
      if (terminal(config, next)) break
      position = next
    }
    const last = path[path.length - 1]
    episodes.push({
      path,
      totalReward: Math.round(total * 1000) / 1000,
      reachedGoal: last[0] === config.goal[0] && last[1] === config.goal[1],
      fellInPit: last[0] === config.pit[0] && last[1] === config.pit[1],
      steps,
    })
  }

  const averageReward = round(episodes.reduce((sum, episode) => sum + episode.totalReward, 0) / episodes.length)
  const successRate = round(episodes.filter((episode) => episode.reachedGoal).length / episodes.length)
  const averageSteps = round(episodes.reduce((sum, episode) => sum + episode.steps, 0) / episodes.length)

  return { episodes, averageReward, successRate, averageSteps, transitionCounts }
}

export interface TransitionComparison {
  state: [number, number]
  action: GridAction
  predicted: { next: [number, number]; probability: number }[]
  actual: { next: [number, number]; frequency: number }[]
  divergence: number
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function compareTransitions(
  config: WorldModelConfig,
  policy: Policy,
  transitionCounts: Record<string, Record<string, number>>,
  limit = 4,
): TransitionComparison[] {
  const comparisons: TransitionComparison[] = []

  for (const cell of allCells(config)) {
    if (terminal(config, cell)) continue
    const stateKey = cellKey(cell[0], cell[1])
    const observed = transitionCounts[stateKey]
    if (!observed) continue
    const total = Object.values(observed).reduce((sum, count) => sum + count, 0)
    if (total === 0) continue
    const action = policy[stateKey] ?? 0
    const predicted = modelTransition(config, cell, action)
    const actual = Object.entries(observed).map(([key, count]) => ({
      next: key.split(',').map(Number) as [number, number],
      frequency: round(count / total),
    }))

    const keys = new Set([...predicted.map((entry) => cellKey(entry.next[0], entry.next[1])), ...actual.map((entry) => cellKey(entry.next[0], entry.next[1]))])
    let divergence = 0
    for (const key of keys) {
      const p = predicted.find((entry) => cellKey(entry.next[0], entry.next[1]) === key)?.probability ?? 0
      const a = actual.find((entry) => cellKey(entry.next[0], entry.next[1]) === key)?.frequency ?? 0
      divergence += Math.abs(p - a)
    }

    comparisons.push({
      state: cell,
      action,
      predicted,
      actual,
      divergence: round(divergence / 2),
    })
  }

  return comparisons.sort((a, b) => b.divergence - a.divergence).slice(0, limit)
}

export interface WorldModelRun {
  config: WorldModelConfig
  modelFree: {
    trainingCurve: TrainingCurvePoint[]
    policy: Policy
    evaluation: ReturnType<typeof evaluatePolicy>
  }
  modelBased: {
    values: Record<string, number>
    policy: Policy
    sweeps: number
    evaluation: ReturnType<typeof evaluatePolicy>
  }
  divergences: TransitionComparison[]
  /** Model error averaged over visited states: a summary of model quality. */
  meanDivergence: number
}

export function runWorldModelLab(config: WorldModelConfig = DEFAULT_WORLD_MODEL_CONFIG): WorldModelRun {
  const { policy: qPolicy, curve } = qLearning(config)
  const modelFreeEvaluation = evaluatePolicy(config, qPolicy, 0)

  const { values, policy: plannedPolicy, sweeps } = valueIteration(config)
  const modelBasedEvaluation = evaluatePolicy(config, plannedPolicy, 500)

  const divergences = compareTransitions(config, plannedPolicy, modelBasedEvaluation.transitionCounts)
  const meanDivergence = divergences.length === 0 ? 0 : round(divergences.reduce((sum, entry) => sum + entry.divergence, 0) / divergences.length)

  return {
    config,
    modelFree: { trainingCurve: curve, policy: qPolicy, evaluation: modelFreeEvaluation },
    modelBased: { values, policy: plannedPolicy, sweeps, evaluation: modelBasedEvaluation },
    divergences,
    meanDivergence,
  }
}
