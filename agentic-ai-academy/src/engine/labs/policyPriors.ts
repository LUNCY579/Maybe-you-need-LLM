/**
 * Lab C · two extensions of the world-model lesson, both measured.
 *
 *  (a) **What a pretrained prior buys** (Ch. 7 and Ch. 23, the RT-2 analogue).
 *      One tabular value table is learned by interacting with a *pretraining
 *      family*, then reused to initialise learning on three transfer families.
 *      That transfer of a structure learned elsewhere is the whole analogy with
 *      web-scale pretraining — nothing more is claimed. Sample efficiency is
 *      counted in real-environment interactions, and one family is built so the
 *      prior points the wrong way, so the result is not uniformly in favour.
 *
 *  (b) **Self-generated action data** (Ch. 23 §23.2.2, the π0 analogue).
 *      A model-based policy rolls out its own trajectories; its own transitions
 *      refit the world model that produces the next generation of the policy.
 *      The loop is measured per generation: success rate, how much of the
 *      training data was self-generated, and the divergence between what the
 *      learned model predicts and what the probe in the real environment shows
 *      actually happens. A second arm keeps a fixed, externally supplied
 *      demonstration set in the mix.
 *
 * Rigour notes, which the screen repeats:
 *  - Everything is deterministic: same seed + same config = same numbers.
 *  - The units are grid steps and total-variation distance. These are controlled
 *    analogues; nothing here reproduces, approximates or estimates a number
 *    published by Brohan et al. (2023) or Black et al. (2024).
 *  - The dynamics are the Lab C dynamics (intended move, slip to a perpendicular
 *    action, walls block, goal and pit terminate) reimplemented here so the
 *    extensions can count interactions; `worldModel.ts` itself is untouched.
 */

import { createRng, type Rng } from '../prng'
import {
  DEFAULT_WORLD_MODEL_CONFIG,
  allCells,
  isWallish,
  type GridAction,
  type Policy,
  type WorldModelConfig,
} from './worldModel'

/* ------------------------------------------------------------------ */
/* Shared world helpers                                                */
/* ------------------------------------------------------------------ */

export interface Outcome {
  next: [number, number]
  probability: number
}

function keyOf(position: [number, number]): string {
  return `${position[0]},${position[1]}`
}

/** A state-action pair key, used for learned models and probes. */
export function pairKey(position: [number, number], action: GridAction): string {
  return `${keyOf(position)}#${action}`
}

function clampCell(world: WorldModelConfig, x: number, y: number): [number, number] {
  const cx = Math.min(world.width - 1, Math.max(0, x))
  const cy = Math.min(world.height - 1, Math.max(0, y))
  if (isWallish(world, cx, cy)) return [-1, -1]
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

/** Where an action lands with no slip: out-of-bounds and walls leave you in place. */
export function resolveMove(world: WorldModelConfig, position: [number, number], action: GridAction): [number, number] {
  const candidate = clampCell(world, ...move(position, action))
  return candidate[0] === -1 ? position : candidate
}

export function rewardAt(world: WorldModelConfig, position: [number, number]): number {
  if (position[0] === world.goal[0] && position[1] === world.goal[1]) return world.goalReward
  if (position[0] === world.pit[0] && position[1] === world.pit[1]) return world.pitReward
  return world.stepCost
}

export function isTerminalCell(world: WorldModelConfig, position: [number, number]): boolean {
  return (
    (position[0] === world.goal[0] && position[1] === world.goal[1]) ||
    (position[0] === world.pit[0] && position[1] === world.pit[1])
  )
}

/** Every cell that is neither a wall nor a terminal state. */
export function decisionCells(world: WorldModelConfig): [number, number][] {
  return allCells(world).filter((cell) => !isTerminalCell(world, cell))
}

export function perpendicularActions(action: GridAction): GridAction[] {
  return (action === 0 || action === 2 ? [1, 3] : [0, 2]) as GridAction[]
}

/** The ground-truth transition distribution: intended move, slip to a perpendicular. */
export function trueDynamics(world: WorldModelConfig, position: [number, number], action: GridAction): Outcome[] {
  const slip = Math.min(0.5, Math.max(0, world.slip))
  const outcomes = new Map<string, Outcome>()
  const add = (next: [number, number], probability: number) => {
    const key = keyOf(next)
    const existing = outcomes.get(key)
    if (existing) existing.probability += probability
    else outcomes.set(key, { next, probability })
  }
  add(resolveMove(world, position, action), 1 - slip)
  for (const perpendicular of perpendicularActions(action)) {
    add(resolveMove(world, position, perpendicular), slip / 2)
  }
  return [...outcomes.values()]
}

/** The naive belief a learner falls back on when it has never tried a pair: my action always works. */
export function naiveDynamics(world: WorldModelConfig, position: [number, number], action: GridAction): Outcome[] {
  return [{ next: resolveMove(world, position, action), probability: 1 }]
}

/** One sample of the true dynamics, consuming the same two random draws as Lab C. */
export function sampleTransition(
  world: WorldModelConfig,
  position: [number, number],
  action: GridAction,
  rng: Rng,
): [number, number] {
  let executed: GridAction = action
  if (rng.chance(world.slip)) {
    const perpendiculars = perpendicularActions(action)
    executed = perpendiculars[rng.int(perpendiculars.length)]
  }
  return resolveMove(world, position, executed)
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Total-variation distance between two transition distributions. */
export function divergence(a: Outcome[], b: Outcome[]): number {
  const keys = new Set<string>()
  for (const outcome of a) keys.add(keyOf(outcome.next))
  for (const outcome of b) keys.add(keyOf(outcome.next))
  let total = 0
  for (const key of keys) {
    const left = a.find((outcome) => keyOf(outcome.next) === key)?.probability ?? 0
    const right = b.find((outcome) => keyOf(outcome.next) === key)?.probability ?? 0
    total += Math.abs(left - right)
  }
  return total / 2
}

export function greedyPolicyFromQ(world: WorldModelConfig, q: Record<string, number[]>): Policy {
  const policy: Policy = {}
  for (const cell of decisionCells(world)) {
    const values = q[keyOf(cell)] ?? [0, 0, 0, 0]
    policy[keyOf(cell)] = values.reduce((best, value, index) => (value > values[best] ? index : best), 0) as GridAction
  }
  return policy
}

/* ------------------------------------------------------------------ */
/* (a) Pretrained prior versus learning from scratch                   */
/* ------------------------------------------------------------------ */

export type TransferRelation = 'aligned' | 'partial' | 'misleading'

export interface TaskFamily {
  id: string
  label: string
  /** The structure the observation-to-action mapping has in this family. */
  structure: string
  relation: TransferRelation
  /** What the transferred table believes here, before any interaction. */
  expectation: string
  world: WorldModelConfig
}

function familyWorld(overrides: Partial<WorldModelConfig>): WorldModelConfig {
  return { ...DEFAULT_WORLD_MODEL_CONFIG, ...overrides }
}

/**
 * The single family standing in for the pretraining corpus. Its Q-table is the
 * only thing the prior agent brings to every transfer family.
 */
export const PRETRAINING_FAMILY = {
  id: 'pretrain-north-east',
  label: 'Pretraining family · reach the north-east corner',
  structure: 'the reward lies up and to the right; the pit sits in the middle of the route',
  world: familyWorld({
    start: [0, 4],
    goal: [4, 0],
    pit: [2, 2],
    walls: [
      [1, 2],
      [3, 1],
    ],
  }),
} as const

/**
 * Three transfer families, deliberately not all friendly to the prior: the
 * same geometry with a new start pose (the prior is nearly the answer), a
 * quarter-turn (half of the prior is right), and a mirror (all of the prior is
 * wrong and pulls the policy back toward where the pretraining reward was).
 */
export const TRANSFER_FAMILIES: TaskFamily[] = [
  {
    id: 'same-structure-new-pose',
    label: 'North-east, new start pose',
    structure: 'reach the north-east corner from (0,2) instead of (0,4)',
    relation: 'aligned',
    expectation: 'the prior already ranks up and right highest almost everywhere',
    world: familyWorld({
      start: [0, 2],
      goal: [4, 0],
      pit: [2, 2],
      walls: [
        [1, 2],
        [3, 1],
      ],
    }),
  },
  {
    id: 'quarter-turn',
    label: 'North-west quarter-turn',
    structure: 'reach the north-west corner: up is still right, right is now wrong',
    relation: 'partial',
    expectation: 'half of the transferred structure holds, half of it points at a wall',
    world: familyWorld({
      start: [4, 4],
      goal: [0, 0],
      pit: [2, 2],
      walls: [
        [1, 3],
        [3, 1],
      ],
    }),
  },
  {
    id: 'mirrored-goal',
    label: 'Mirrored south-west dock',
    structure: 'reach the south-west corner: the exact opposite of the pretraining task',
    relation: 'misleading',
    expectation: 'the prior keeps pulling the policy back to the north-east corner',
    world: familyWorld({
      start: [4, 0],
      goal: [0, 4],
      pit: [2, 2],
      walls: [
        [1, 2],
        [3, 1],
      ],
    }),
  },
]

export interface PriorLearningConfig {
  /** Training episodes allowed to each arm before the budget runs out. */
  episodes: number
  /** Steps per episode, in training and in evaluation. */
  stepCap: number
  alpha: number
  discount: number
  epsilonFloor: number
  /** Fraction of the budget over which epsilon decays from 1 to the floor. */
  epsilonDecay: number
  /** Evaluate the greedy policy every this many episodes (and at the end). */
  evalInterval: number
  evalEpisodes: number
  /** Success rate at which an arm is declared to have learned the task. */
  successThreshold: number
  /** How much of the pretraining Q-table the prior agent starts with, 0..1.5. */
  priorStrength: number
  seed: number
}

export const DEFAULT_PRIOR_LEARNING_CONFIG: PriorLearningConfig = {
  episodes: 150,
  stepCap: 40,
  alpha: 0.3,
  discount: 0.95,
  epsilonFloor: 0.05,
  epsilonDecay: 0.6,
  evalInterval: 5,
  evalEpisodes: 12,
  successThreshold: 0.6,
  priorStrength: 1,
  seed: 7,
}

export type ArmName = 'prior' | 'scratch'

export interface ArmTracePoint {
  episode: number
  successRate: number
  /** Real-environment steps spent so far, training plus evaluation. */
  interactionSteps: number
}

export interface ArmOutcome {
  arm: ArmName
  /** Episode index at which the greedy policy first met the success threshold. */
  episodesToThreshold: number | null
  /** Real-environment interactions spent when the threshold was first met. */
  stepsToThreshold: number | null
  reachedThreshold: boolean
  successAtBudget: number
  averageRewardAtBudget: number
  trainingSteps: number
  evaluationSteps: number
  interactionSteps: number
  curve: ArmTracePoint[]
  policy: Policy
  q: Record<string, number[]>
}

interface EvaluationSummary {
  successRate: number
  averageReward: number
  averageSteps: number
  steps: number
}

/** Greedy rollout of a policy in the real environment, with a fixed seed. */
export function evaluateInWorld(
  world: WorldModelConfig,
  policy: Policy,
  options: { episodes: number; stepCap: number; seed: number },
): EvaluationSummary & { episodes: { reachedGoal: boolean; fellInPit: boolean; steps: number; reward: number }[] } {
  const rng = createRng(options.seed)
  const episodes: { reachedGoal: boolean; fellInPit: boolean; steps: number; reward: number }[] = []
  let steps = 0

  for (let episode = 0; episode < options.episodes; episode += 1) {
    let position: [number, number] = [world.start[0], world.start[1]]
    let reward = 0
    let length = 0
    for (let step = 0; step < options.stepCap; step += 1) {
      const action = policy[keyOf(position)] ?? 0
      const next = sampleTransition(world, position, action, rng)
      reward += rewardAt(world, next)
      length += 1
      steps += 1
      position = next
      if (isTerminalCell(world, next)) break
    }
    episodes.push({
      reachedGoal: position[0] === world.goal[0] && position[1] === world.goal[1],
      fellInPit: position[0] === world.pit[0] && position[1] === world.pit[1],
      steps: length,
      reward: round(reward),
    })
  }

  const reached = episodes.filter((episode) => episode.reachedGoal).length
  return {
    successRate: round(reached / episodes.length),
    averageReward: round(episodes.reduce((sum, episode) => sum + episode.reward, 0) / episodes.length),
    averageSteps: round(episodes.reduce((sum, episode) => sum + episode.steps, 0) / episodes.length),
    steps,
    episodes,
  }
}

/**
 * Tabular Q-learning on one family, with an optional initial table — the prior
 * arm — and mid-training evaluations, so "episodes to threshold" is measured
 * rather than assumed. The update rule is the one Lab C uses.
 */
export function trainOnWorld(
  world: WorldModelConfig,
  config: PriorLearningConfig,
  options: { arm: ArmName; initialQ?: Record<string, number[]> | null },
): ArmOutcome {
  const rng = createRng(config.seed)
  const q: Record<string, number[]> = {}
  for (const cell of allCells(world)) {
    const transferred = options.initialQ?.[keyOf(cell)]
    q[keyOf(cell)] = transferred
      ? transferred.map((value) => value * config.priorStrength)
      : [0, 0, 0, 0]
  }

  let trainingSteps = 0
  let evaluationSteps = 0
  let episodesToThreshold: number | null = null
  let stepsToThreshold: number | null = null
  let averageRewardAtBudget = 0
  let successAtBudget = 0
  const curve: ArmTracePoint[] = []

  for (let episode = 0; episode <= config.episodes; episode += 1) {
    const policy = greedyPolicyFromQ(world, q)

    if (episode % config.evalInterval === 0 || episode === config.episodes) {
      // The same evaluation seed for both arms: the probe is shared, the policy is not.
      const evaluation = evaluateInWorld(world, policy, {
        episodes: config.evalEpisodes,
        stepCap: config.stepCap,
        seed: config.seed + 4100,
      })
      evaluationSteps += evaluation.steps
      successAtBudget = evaluation.successRate
      averageRewardAtBudget = evaluation.averageReward
      curve.push({ episode, successRate: evaluation.successRate, interactionSteps: trainingSteps + evaluationSteps })
      if (episodesToThreshold === null && evaluation.successRate >= config.successThreshold) {
        episodesToThreshold = episode
        stepsToThreshold = trainingSteps + evaluationSteps
      }
    }

    if (episode === config.episodes) break

    const epsilon = Math.max(config.epsilonFloor, 1 - episode / (config.episodes * config.epsilonDecay))
    let position: [number, number] = [world.start[0], world.start[1]]
    for (let step = 0; step < config.stepCap; step += 1) {
      const stateKey = keyOf(position)
      const values = q[stateKey]
      const action: GridAction = rng.chance(epsilon)
        ? (rng.int(4) as GridAction)
        : (values.reduce((best, value, index) => (value > values[best] ? index : best), 0) as GridAction)
      const next = sampleTransition(world, position, action, rng)
      const reward = rewardAt(world, next)
      const bestNext = isTerminalCell(world, next) ? 0 : Math.max(...q[keyOf(next)])
      q[stateKey][action] += config.alpha * (reward + config.discount * bestNext - q[stateKey][action])
      trainingSteps += 1
      if (isTerminalCell(world, next)) break
      position = next
    }
  }

  return {
    arm: options.arm,
    episodesToThreshold,
    stepsToThreshold,
    reachedThreshold: episodesToThreshold !== null,
    successAtBudget,
    averageRewardAtBudget,
    trainingSteps,
    evaluationSteps,
    interactionSteps: trainingSteps + evaluationSteps,
    curve,
    policy: greedyPolicyFromQ(world, q),
    q,
  }
}

export interface FamilyComparison {
  family: TaskFamily
  prior: ArmOutcome
  scratch: ArmOutcome
  /**
   * Interactions saved by the prior. Positive means the prior reached its
   * threshold with fewer real-environment steps. An arm that never met the
   * threshold is charged its full budget, so this stays comparable.
   */
  stepSaving: number
  /**
   * Prior interactions as a fraction of scratch interactions at the threshold.
   * Above 1 the prior was cheaper; below 1 it was dearer; null when the prior
   * never met the threshold inside the budget.
   */
  speedup: number | null
  /** Measured, not configured: did the prior cost interactions on this family? */
  negativeTransfer: boolean
}

export interface PretrainingSummary {
  familyId: string
  interactionSteps: number
  episodesToThreshold: number | null
  successAtBudget: number
  /** The table handed to every transfer family. */
  q: Record<string, number[]>
}

export interface PriorTransferRun {
  config: PriorLearningConfig
  pretraining: PretrainingSummary
  families: FamilyComparison[]
  /** Family ids where the prior was cheaper, in the measured runs. */
  helped: string[]
  /** Family ids where the prior was more expensive, in the measured runs. */
  hurt: string[]
  /** One-line, number-free summary of the sign of the effect per family. */
  signByFamily: Record<string, 'helps' | 'hurts'>
}

/**
 * Learn the pretraining table once, then run both arms on every transfer family
 * with the same seed, the same budget and the same evaluation probe.
 */
export function runPriorTransferLab(config: PriorLearningConfig = DEFAULT_PRIOR_LEARNING_CONFIG): PriorTransferRun {
  const pretrainingArm = trainOnWorld(PRETRAINING_FAMILY.world, config, { arm: 'scratch', initialQ: null })

  const families: FamilyComparison[] = TRANSFER_FAMILIES.map((family) => {
    const scratch = trainOnWorld(family.world, config, { arm: 'scratch', initialQ: null })
    const prior = trainOnWorld(family.world, config, { arm: 'prior', initialQ: pretrainingArm.q })

    const priorCost = prior.stepsToThreshold ?? prior.interactionSteps
    const scratchCost = scratch.stepsToThreshold ?? scratch.interactionSteps
    const stepSaving = scratchCost - priorCost

    return {
      family,
      prior,
      scratch,
      stepSaving,
      speedup: prior.reachedThreshold && priorCost > 0 ? round(scratchCost / priorCost) : null,
      negativeTransfer: priorCost > scratchCost,
    }
  })

  const signByFamily: Record<string, 'helps' | 'hurts'> = {}
  for (const entry of families) signByFamily[entry.family.id] = entry.negativeTransfer ? 'hurts' : 'helps'

  return {
    config,
    pretraining: {
      familyId: PRETRAINING_FAMILY.id,
      interactionSteps: pretrainingArm.interactionSteps,
      episodesToThreshold: pretrainingArm.episodesToThreshold,
      successAtBudget: pretrainingArm.successAtBudget,
      q: pretrainingArm.q,
    },
    families,
    helped: families.filter((entry) => !entry.negativeTransfer).map((entry) => entry.family.id),
    hurt: families.filter((entry) => entry.negativeTransfer).map((entry) => entry.family.id),
    signByFamily,
  }
}

/* ------------------------------------------------------------------ */
/* (b) Self-generated action data                                      */
/* ------------------------------------------------------------------ */

export type LoopArm = 'self-only' | 'mixed'

export interface TransitionSample {
  state: [number, number]
  action: GridAction
  next: [number, number]
  origin: 'self' | 'external'
}

export interface LearnedPair {
  state: [number, number]
  action: GridAction
  observations: number
  outcomes: Outcome[]
}

/** Counts-per-state-action-pair model; an absent pair falls back to the naive belief. */
export type LearnedModel = Record<string, LearnedPair>

export function modelTransitionOf(world: WorldModelConfig, model: LearnedModel, position: [number, number], action: GridAction): Outcome[] {
  return model[pairKey(position, action)]?.outcomes ?? naiveDynamics(world, position, action)
}

/**
 * Fit the transition model from transitions, blending each pair's counts with
 * `naivePriorMass` units of the "my action always works" belief. Pairs with no
 * data at all keep that naive belief outright.
 */
export function fitModel(world: WorldModelConfig, samples: TransitionSample[], naivePriorMass: number): LearnedModel {
  const counts = new Map<string, { state: [number, number]; action: GridAction; total: number; byNext: Map<string, number> }>()

  for (const sample of samples) {
    const key = pairKey(sample.state, sample.action)
    const entry = counts.get(key) ?? { state: sample.state, action: sample.action, total: 0, byNext: new Map<string, number>() }
    entry.total += 1
    const nextKey = keyOf(sample.next)
    entry.byNext.set(nextKey, (entry.byNext.get(nextKey) ?? 0) + 1)
    counts.set(key, entry)
  }

  const mass = Math.max(0, naivePriorMass)
  const model: LearnedModel = {}
  for (const [key, entry] of counts) {
    const naive = naiveDynamics(world, entry.state, entry.action)
    const blended = new Map<string, Outcome>()
    for (const outcome of naive) {
      blended.set(keyOf(outcome.next), { next: outcome.next, probability: (mass * outcome.probability) / (entry.total + mass) })
    }
    for (const [nextKey, count] of entry.byNext) {
      const existing = blended.get(nextKey)
      const probability = count / (entry.total + mass)
      if (existing) existing.probability += probability
      else blended.set(nextKey, { next: nextKey.split(',').map(Number) as [number, number], probability })
    }
    const outcomes = [...blended.values()].filter((outcome) => outcome.probability > 0)
    const total = outcomes.reduce((sum, outcome) => sum + outcome.probability, 0)
    model[key] = {
      state: entry.state,
      action: entry.action,
      observations: entry.total,
      outcomes: outcomes.map((outcome) => ({ next: outcome.next, probability: outcome.probability / total })),
    }
  }
  return model
}

/** Value iteration inside a learned model, then the greedy policy of those values. */
export function planInsideModel(
  world: WorldModelConfig,
  model: LearnedModel,
  sweeps: number,
  discount: number,
): { values: Record<string, number>; policy: Policy; sweeps: number } {
  let values: Record<string, number> = {}
  for (const cell of decisionCells(world)) values[keyOf(cell)] = 0

  for (let sweep = 0; sweep < sweeps; sweep += 1) {
    const next: Record<string, number> = { ...values }
    for (const cell of decisionCells(world)) {
      let best = -Infinity
      for (let action = 0 as GridAction; action < 4; action = (action + 1) as GridAction) {
        const outcomes = modelTransitionOf(world, model, cell, action)
        const expected = outcomes.reduce((sum, outcome) => {
          const immediate = rewardAt(world, outcome.next)
          const continuation = isTerminalCell(world, outcome.next) ? 0 : values[keyOf(outcome.next)] ?? 0
          return sum + outcome.probability * (immediate + discount * continuation)
        }, 0)
        best = Math.max(best, expected)
      }
      next[keyOf(cell)] = best
    }
    values = next
  }

  const policy: Policy = {}
  for (const cell of decisionCells(world)) {
    let bestAction: GridAction = 0
    let bestValue = -Infinity
    for (let action = 0 as GridAction; action < 4; action = (action + 1) as GridAction) {
      const outcomes = modelTransitionOf(world, model, cell, action)
      const expected = outcomes.reduce((sum, outcome) => {
        const immediate = rewardAt(world, outcome.next)
        const continuation = isTerminalCell(world, outcome.next) ? 0 : values[keyOf(outcome.next)] ?? 0
        return sum + outcome.probability * (immediate + discount * continuation)
      }, 0)
      if (expected > bestValue) {
        bestValue = expected
        bestAction = action
      }
    }
    policy[keyOf(cell)] = bestAction
  }

  return { values, policy, sweeps }
}

/** Roll the current policy out in the real environment and keep the transitions it produced. */
export function collectSelfGeneratedTransitions(
  world: WorldModelConfig,
  policy: Policy,
  options: { episodes: number; stepCap: number; seed: number },
): TransitionSample[] {
  const rng = createRng(options.seed)
  const samples: TransitionSample[] = []
  for (let episode = 0; episode < options.episodes; episode += 1) {
    let position: [number, number] = [world.start[0], world.start[1]]
    for (let step = 0; step < options.stepCap; step += 1) {
      const action = policy[keyOf(position)] ?? 0
      const next = sampleTransition(world, position, action, rng)
      samples.push({ state: position, action, next, origin: 'self' })
      if (isTerminalCell(world, next)) break
      position = next
    }
  }
  return samples
}

/**
 * The externally supplied demonstrations: a fixed set of real transitions that
 * covers every state-action pair `perPair` times. That is what a human
 * tele-operation sweep gives you, and it is precisely the coverage the
 * policy's own rollouts lose.
 */
export function buildDemonstrationPool(world: WorldModelConfig, perPair: number, seed: number): TransitionSample[] {
  const rng = createRng(seed)
  const pool: TransitionSample[] = []
  for (const cell of decisionCells(world)) {
    for (let action = 0 as GridAction; action < 4; action = (action + 1) as GridAction) {
      for (let repeat = 0; repeat < perPair; repeat += 1) {
        pool.push({ state: cell, action, next: sampleTransition(world, cell, action, rng), origin: 'external' })
      }
    }
  }
  // A deterministic shuffle, so taking a *subset* of the pool spreads over pairs
  // instead of covering only the first cells.
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = rng.int(index + 1)
    const held = pool[index]
    pool[index] = pool[swap]
    pool[swap] = held
  }
  return pool
}

export interface ProbeRow {
  state: [number, number]
  action: GridAction
  actual: Outcome[]
}

/**
 * What actually happens, measured rather than assumed: a fixed number of real
 * transitions per state-action pair, sampled once per run so every generation
 * and both arms are scored against the identical probe.
 */
export function probeRealDynamics(world: WorldModelConfig, samplesPerPair: number, seed: number): { rows: ProbeRow[]; pairs: number; samples: number } {
  const rng = createRng(seed)
  const rows: ProbeRow[] = []
  let samples = 0
  for (const cell of decisionCells(world)) {
    for (let action = 0 as GridAction; action < 4; action = (action + 1) as GridAction) {
      const counts = new Map<string, number>()
      for (let sample = 0; sample < samplesPerPair; sample += 1) {
        const next = sampleTransition(world, cell, action, rng)
        const key = keyOf(next)
        counts.set(key, (counts.get(key) ?? 0) + 1)
        samples += 1
      }
      rows.push({
        state: cell,
        action,
        actual: [...counts.entries()].map(([key, count]) => ({
          next: key.split(',').map(Number) as [number, number],
          probability: count / samplesPerPair,
        })),
      })
    }
  }
  return { rows, pairs: rows.length, samples }
}

export interface ModelDivergenceRow {
  state: [number, number]
  action: GridAction
  observations: number
  predicted: Outcome[]
  actual: Outcome[]
  divergence: number
  source: 'learned' | 'naive fallback'
}

export interface ModelScore {
  /** Mean total-variation distance between the learned model and the probed reality. */
  mean: number
  rows: ModelDivergenceRow[]
  worst: ModelDivergenceRow[]
  /** Fraction of probed pairs that have at least one transition in the training data. */
  coverage: number
}

/** Score a learned model against the probe: the compounding-error measurement. */
export function scoreModelAgainstProbe(world: WorldModelConfig, model: LearnedModel, probe: { rows: ProbeRow[] }): ModelScore {
  const rows: ModelDivergenceRow[] = probe.rows.map((row) => {
    const fitted = model[pairKey(row.state, row.action)]
    return {
      state: row.state,
      action: row.action,
      observations: fitted?.observations ?? 0,
      predicted: fitted ? fitted.outcomes : naiveDynamics(world, row.state, row.action),
      actual: row.actual,
      divergence: round(divergence(fitted ? fitted.outcomes : naiveDynamics(world, row.state, row.action), row.actual)),
      source: fitted ? ('learned' as const) : ('naive fallback' as const),
    }
  })

  const mean = rows.length === 0 ? 0 : round(rows.reduce((sum, row) => sum + row.divergence, 0) / rows.length)
  const modelled = rows.filter((row) => row.observations > 0).length
  return {
    mean,
    rows,
    worst: [...rows].sort((a, b) => b.divergence - a.divergence || a.observations - b.observations).slice(0, 5),
    coverage: round(modelled / Math.max(1, rows.length)),
  }
}

export interface SelfGeneratedConfig {
  world: WorldModelConfig
  /** Generations of the retraining loop, generation 0 included. */
  generations: number
  /** Real rollouts of the current policy per generation. */
  rolloutEpisodes: number
  stepCap: number
  /** Transitions asked from the external pool each generation, as a share of the budget. */
  trainingSamples: number
  /** Share of the per-generation budget requested from the fixed external pool (0 = self-only). */
  externalShare: number
  /** Real transitions per state-action pair in the externally supplied pool. */
  demonstrationsPerPair: number
  /** Pseudo-count mass of the naive "my action always works" belief in the fit. */
  naivePriorMass: number
  planningSweeps: number
  discount: number
  evalEpisodes: number
  /** Probe samples per state-action pair, used to score the learned model. */
  probeSamplesPerPair: number
  /** Model error above which the planner is treated as unreliable. */
  errorThreshold: number
  /** Drop in success rate that counts as degradation. */
  degradeMargin: number
  seed: number
}

export const LOOP_WORLD: WorldModelConfig = {
  ...DEFAULT_WORLD_MODEL_CONFIG,
  // Harsher than Lab C's default slip (0.20): a model that is wrong about where
  // a slip lands has to be paid for, which is what the loop is measuring.
  slip: 0.4,
  seed: 7,
}

export const DEFAULT_SELF_GENERATED_CONFIG: SelfGeneratedConfig = {
  world: LOOP_WORLD,
  generations: 10,
  rolloutEpisodes: 14,
  stepCap: 14,
  trainingSamples: 360,
  externalShare: 0.5,
  demonstrationsPerPair: 6,
  naivePriorMass: 1,
  planningSweeps: 30,
  discount: 0.95,
  evalEpisodes: 40,
  probeSamplesPerPair: 200,
  errorThreshold: 0.3,
  degradeMargin: 0.15,
  seed: 7,
}

export interface GenerationRow {
  generation: number
  arm: LoopArm
  dataOrigin: 'no data' | 'external demonstrations' | 'self-generated + demonstrations' | 'self-generated'
  selfSamples: number
  externalSamples: number
  /** Measured share of the generation's training transitions that the policy produced itself. */
  selfGeneratedShare: number
  coverage: number
  modelError: number
  successRate: number
  averageReward: number
  averageSteps: number
  errorAboveThreshold: boolean
  policy: Policy
  worstDivergences: ModelDivergenceRow[]
}

export interface LoopArmResult {
  arm: LoopArm
  externalShareRequested: number
  generations: GenerationRow[]
  initialSuccess: number
  finalSuccess: number
  /** The lowest success rate measured anywhere in the loop, and its generation. */
  lowestSuccess: number
  lowestSuccessAt: number
  successDrop: number
  initialError: number
  finalError: number
  /** The highest model error measured in the loop, and its generation. */
  peakError: number
  peakErrorAt: number
  errorGrowth: number
  meanSelfGeneratedShare: number
  /** Model coverage of the state-action space: how much of it the data ever touched. */
  initialCoverage: number
  finalCoverage: number
  /** First generation whose measured model error exceeded the threshold. */
  errorCrossedAt: number | null
  /** Last generation whose measured model error was back under the threshold, if any. */
  errorReturnedUnderAt: number | null
  /** First generation whose measured success fell below initial success by the margin. */
  successDroppedAt: number | null
  degraded: boolean
}

function dataOrigin(self: number, external: number): GenerationRow['dataOrigin'] {
  if (self > 0 && external > 0) return 'self-generated + demonstrations'
  if (self > 0) return 'self-generated'
  if (external > 0) return 'external demonstrations'
  return 'no data'
}

/**
 * One arm of the loop: retrain the model on the policy's own data, generation
 * after generation.
 *
 * Both arms use the identical seeds for the rollouts, the evaluation probe and
 * the model fit. Everything that differs between them therefore comes from the
 * external data in the training set and nothing else — generation 1's
 * self-generated transitions are literally the same transitions in both arms.
 */
function runLoopArm(
  config: SelfGeneratedConfig,
  pool: TransitionSample[],
  probe: { rows: ProbeRow[] },
  arm: LoopArm,
  externalShare: number,
): LoopArmResult {
  const world = config.world

  // Generation 0 always comes from the externally supplied demonstrations, so
  // both arms start from the same policy and the same model.
  let model = fitModel(world, pool, config.naivePriorMass)
  let policy = planInsideModel(world, model, config.planningSweeps, config.discount).policy

  const rows: GenerationRow[] = []
  for (let generation = 0; generation < config.generations; generation += 1) {
    let selfSamples = 0
    let externalSamples = pool.length

    if (generation > 0) {
      const collected = collectSelfGeneratedTransitions(world, policy, {
        episodes: config.rolloutEpisodes,
        stepCap: config.stepCap,
        seed: config.seed + generation * 17,
      })
      const selfBudget = Math.max(0, Math.round(config.trainingSamples * (1 - externalShare)))
      const self = collected.slice(0, selfBudget)
      const externalBudget = Math.min(pool.length, Math.max(0, Math.round(config.trainingSamples * externalShare)))
      const external = pool.slice(0, externalBudget)
      selfSamples = self.length
      externalSamples = external.length
      model = fitModel(world, [...external, ...self], config.naivePriorMass)
      policy = planInsideModel(world, model, config.planningSweeps, config.discount).policy
    }

    const scored = scoreModelAgainstProbe(world, model, probe)
    const evaluation = evaluateInWorld(world, policy, {
      episodes: config.evalEpisodes,
      stepCap: config.stepCap,
      seed: config.seed + 9000,
    })
    const total = selfSamples + externalSamples

    rows.push({
      generation,
      arm,
      dataOrigin: dataOrigin(selfSamples, externalSamples),
      selfSamples,
      externalSamples,
      selfGeneratedShare: total === 0 ? 0 : round(selfSamples / total),
      coverage: scored.coverage,
      modelError: scored.mean,
      successRate: evaluation.successRate,
      averageReward: evaluation.averageReward,
      averageSteps: evaluation.averageSteps,
      errorAboveThreshold: scored.mean > config.errorThreshold,
      policy,
      worstDivergences: scored.worst,
    })
  }

  const first = rows[0]
  const last = rows[rows.length - 1]
  const crossed = rows.find((row) => row.errorAboveThreshold)
  const returnedUnder = crossed ? rows.find((row) => row.generation > crossed.generation && !row.errorAboveThreshold) : undefined
  const dropped = rows.find((row) => row.generation > 0 && row.successRate <= first.successRate - config.degradeMargin)
  const lowest = rows.reduce((best, row) => (row.successRate < best.successRate ? row : best), rows[0])
  const peak = rows.reduce((best, row) => (row.modelError > best.modelError ? row : best), rows[0])

  return {
    arm,
    externalShareRequested: externalShare,
    generations: rows,
    initialSuccess: first.successRate,
    finalSuccess: last.successRate,
    lowestSuccess: lowest.successRate,
    lowestSuccessAt: lowest.generation,
    successDrop: round(first.successRate - last.successRate),
    initialError: first.modelError,
    finalError: last.modelError,
    peakError: peak.modelError,
    peakErrorAt: peak.generation,
    errorGrowth: round(last.modelError - first.modelError),
    meanSelfGeneratedShare: round(rows.reduce((sum, row) => sum + row.selfGeneratedShare, 0) / rows.length),
    initialCoverage: first.coverage,
    finalCoverage: last.coverage,
    errorCrossedAt: crossed ? crossed.generation : null,
    errorReturnedUnderAt: returnedUnder ? returnedUnder.generation : null,
    successDroppedAt: dropped ? dropped.generation : null,
    degraded: round(first.successRate - last.successRate) >= config.degradeMargin,
  }
}

export interface SelfGeneratedRun {
  config: SelfGeneratedConfig
  /** Transitions in the fixed external pool, and the pairs it covers. */
  poolSize: number
  probeSummary: { pairs: number; samples: number; samplesPerPair: number; seed: number }
  arms: LoopArmResult[]
  selfOnly: LoopArmResult
  mixed: LoopArmResult
  /** First generation where the two arms' success rates differ by more than the degrade margin. */
  separationAt: number | null
}

/**
 * The self-generated-data loop. Both arms start from the same model and policy,
 * built from the fixed external pool; from generation 1 on, the self-only arm is
 * retrained purely on its own rollouts while the mixed arm keeps the pool in the
 * training set.
 */
export function runSelfGeneratedLoop(config: SelfGeneratedConfig = DEFAULT_SELF_GENERATED_CONFIG): SelfGeneratedRun {
  const pool = buildDemonstrationPool(config.world, config.demonstrationsPerPair, config.seed + 77)
  const probe = probeRealDynamics(config.world, config.probeSamplesPerPair, config.seed + 6161)

  const selfOnly = runLoopArm(config, pool, probe, 'self-only', 0)
  const mixed = runLoopArm(config, pool, probe, 'mixed', config.externalShare)
  const arms = [selfOnly, mixed]

  let separationAt: number | null = null
  for (let index = 0; index < selfOnly.generations.length; index += 1) {
    const gap = Math.abs(mixed.generations[index].successRate - selfOnly.generations[index].successRate)
    if (gap > config.degradeMargin) {
      separationAt = selfOnly.generations[index].generation
      break
    }
  }

  return {
    config,
    poolSize: pool.length,
    probeSummary: { pairs: probe.pairs, samples: probe.samples, samplesPerPair: config.probeSamplesPerPair, seed: config.seed + 6161 },
    arms,
    selfOnly,
    mixed,
    separationAt,
  }
}

/* ------------------------------------------------------------------ */
/* Combined entry point                                                */
/* ------------------------------------------------------------------ */

export interface PolicyPriorsRun {
  priors: PriorTransferRun
  selfGenerated: SelfGeneratedRun
}

/** Both measurements in one call, for screens that want them together. */
export function runPolicyPriorsLab(
  priorConfig: PriorLearningConfig = DEFAULT_PRIOR_LEARNING_CONFIG,
  loopConfig: SelfGeneratedConfig = DEFAULT_SELF_GENERATED_CONFIG,
): PolicyPriorsRun {
  return { priors: runPriorTransferLab(priorConfig), selfGenerated: runSelfGeneratedLoop(loopConfig) }
}
