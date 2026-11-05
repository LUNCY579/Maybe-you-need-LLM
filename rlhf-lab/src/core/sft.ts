/**
 * Stage one: supervised fine-tuning.
 *
 * The pipeline the primary source runs has three stages, and this module is the
 * first of them as a runnable file: it takes a task, draws demonstrations from a
 * demonstrator, and fits a policy by maximum likelihood. Everything is on the
 * contextual bandit the rest of the course uses, so the fitted policy, its loss,
 * its accuracy and its distance from the demonstrator are all computed exactly
 * rather than sampled.
 *
 * The task is shared by all three stages, so it is defined here: a set of
 * prompts, a set of candidate responses per prompt, and two quantities attached
 * to each response. The `nominal` quality is what a reward model can be built
 * from — a feature. The `truth` is what the gold reward actually scores, and it
 * differs from the feature by an error the reward model is not given. That gap
 * is the whole of stage two's difficulty and stage three's danger.
 */

import { createRng, softmax } from '@llm-materials/course-core'
import type { Bandit } from './policy.js'
import { applyStep, greedyAction, klToReference, meanReward } from './policy.js'

export interface PipelineTask {
  /** How many prompts there are. */
  contexts: number
  /** How many candidate responses each prompt has. */
  actions: number
  /** The feature a reward model is built on, in [-1, 1], one per prompt and response. */
  nominal: number[][]
  /** What the gold reward sees: the nominal quality plus an error the reward model is not given. */
  truth: number[][]
  /** The quality the gold reward prefers. */
  peak: number
  /** The size of the gap between the feature and the truth. */
  jitter: number
  seed: number
}

export interface TaskOptions {
  contexts?: number
  actions?: number
  peak?: number
  jitter?: number
  seed?: number
}

/**
 * Build the task.
 *
 * The nominal qualities are a grid across [-1, 1] for every prompt; the truth
 * moves each response off its grid point by at most `jitter`. Both are fixed by
 * the seed, so two stages built from the same task see the same responses.
 */
export function buildTask(options: TaskOptions = {}): PipelineTask {
  const contexts = options.contexts ?? 6
  const actions = options.actions ?? 12
  const peak = options.peak ?? 0.4
  const jitter = options.jitter ?? 0.12
  const seed = options.seed ?? 5
  const rng = createRng(seed)

  const nominal: number[][] = []
  const truth: number[][] = []
  for (let context = 0; context < contexts; context++) {
    const row: number[] = []
    const trueRow: number[] = []
    for (let action = 0; action < actions; action++) {
      const x = actions === 1 ? 0 : -1 + (2 * action) / (actions - 1)
      row.push(x)
      trueRow.push(x + jitter * (rng() * 2 - 1))
    }
    nominal.push(row)
    truth.push(trueRow)
  }

  return { contexts, actions, nominal, truth, peak, jitter, seed }
}

/** The gold reward: what a response is actually worth, one number per prompt and response. */
export function goldReward(task: PipelineTask): number[][] {
  return task.truth.map((row) => row.map((value) => -((value - task.peak) * (value - task.peak))))
}

/**
 * What the gold reward would score a response whose *feature* was x, with the
 * jitter averaged out. This is the best any reward model built on the feature
 * can do, so it is the target a stage-two fit is measured against.
 */
export function featureGold(task: PipelineTask): (x: number) => number {
  return (x: number) => -(x - task.peak) * (x - task.peak)
}

/**
 * The demonstrator: the policy the demonstrations are drawn from.
 *
 * It is a soft argmax over the gold reward, so it is good without being
 * perfect — a temperature of zero would be the greedy policy and a large one
 * would be uniform. Its own gold reward is the level stage one is trying to
 * reproduce, and the thing stage one cannot see is that this policy is the best
 * *available* teacher, not the gold optimum.
 */
export function demonstratorPolicy(task: PipelineTask, temperature = 0.25): Bandit {
  const gold = goldReward(task)
  const logits: number[] = []
  for (let context = 0; context < task.contexts; context++) {
    const row = gold[context] ?? []
    logits.push(...row.map((value) => value / Math.max(temperature, 1e-6)))
  }
  return { contexts: task.contexts, actions: task.actions, logits }
}

export interface Demonstration {
  context: number
  action: number
}

/**
 * Draw demonstrations.
 *
 * A fraction `inconsistency` of them come from a uniform policy instead of the
 * demonstrator: annotators who sometimes pick at random. This is the failure
 * mode stage one has — maximum likelihood has no way to tell a confident
 * demonstration from a coin flip, so it fits the mixture.
 */
export function sampleDemonstrations(
  task: PipelineTask,
  teacher: Bandit,
  count: number,
  seed = 21,
  inconsistency = 0,
): Demonstration[] {
  const rng = createRng(seed)
  const demonstrations: Demonstration[] = []
  for (let index = 0; index < count; index++) {
    const context = Math.floor(rng() * task.contexts) % task.contexts
    let action: number
    if (rng() < inconsistency) {
      action = Math.floor(rng() * task.actions) % task.actions
    } else {
      const probs = softmax(teacher.logits.slice(context * task.actions, (context + 1) * task.actions))
      let draw = rng()
      action = task.actions - 1
      for (let candidate = 0; candidate < task.actions; candidate++) {
        draw -= probs[candidate] ?? 0
        if (draw <= 0) {
          action = candidate
          break
        }
      }
    }
    demonstrations.push({ context, action })
  }
  return demonstrations
}

/** How often each response was demonstrated for each prompt. */
export function actionCounts(demonstrations: Demonstration[], task: PipelineTask): number[][] {
  const counts = Array.from({ length: task.contexts }, () => new Array<number>(task.actions).fill(0))
  for (const demonstration of demonstrations) {
    counts[demonstration.context]![demonstration.action]! += 1
  }
  return counts
}

/** The distribution the demonstrations say each prompt should be answered with. */
export function empiricalDistribution(counts: number[][]): number[][] {
  return counts.map((row) => {
    const total = row.reduce((a, b) => a + b, 0)
    return total > 0 ? row.map((value) => value / total) : row.map(() => 1 / row.length)
  })
}

/**
 * The exact minimiser of the stage-one loss.
 *
 * Maximum likelihood on counts is the normalised counts, so the answer the
 * gradient run is approaching can be written down rather than guessed at. A
 * prompt nobody demonstrated is given the uniform policy, which is what the loss
 * leaves free.
 */
export function maximumLikelihoodPolicy(counts: number[][]): Bandit {
  const contexts = counts.length
  const actions = counts[0]?.length ?? 0
  const logits: number[] = []
  for (let context = 0; context < contexts; context++) {
    const row = counts[context] ?? []
    const total = row.reduce((a, b) => a + b, 0)
    for (let action = 0; action < actions; action++) {
      const value = row[action] ?? 0
      logits.push(total > 0 ? Math.log(Math.max(value / total, 1e-12)) : 0)
    }
  }
  return { contexts, actions, logits }
}

/**
 * The stage-one objective: the mean negative log-likelihood of the
 * demonstrations under the policy, and its gradient.
 *
 * Minimising it is a least-squares-free problem with a closed-form answer worth
 * naming: the minimiser is the empirical distribution of the demonstrations.
 * That is why the laboratory can say exactly what inconsistent demonstrations
 * cost, instead of watching a curve.
 */
export function sftObjective(policy: Bandit, demonstrations: Demonstration[]): { loss: number; gradient: number[] } {
  const gradient = new Array<number>(policy.logits.length).fill(0)
  let loss = 0
  for (const demonstration of demonstrations) {
    const start = demonstration.context * policy.actions
    const probs = softmax(policy.logits.slice(start, start + policy.actions))
    const probability = probs[demonstration.action] ?? 0
    loss -= Math.log(Math.max(probability, 1e-300))
    for (let action = 0; action < policy.actions; action++) {
      const indicator = action === demonstration.action ? 1 : 0
      gradient[start + action] = (gradient[start + action] ?? 0) + (probs[action] ?? 0) - indicator
    }
  }
  const count = Math.max(1, demonstrations.length)
  return {
    loss: loss / count,
    gradient: gradient.map((value) => value / count),
  }
}

export interface SftPoint {
  step: number
  loss: number
  /** The share of demonstrations the policy would now pick greedily. */
  accuracy: number
  /** The gold reward the policy scores, averaged over prompts. */
  gold: number
  /** KL(policy ‖ demonstrator), when a demonstrator was given. */
  klToTeacher: number | null
}

export interface SftRun {
  policy: Bandit
  history: SftPoint[]
  counts: number[][]
  /** The distribution the demonstrations imply — what the fit converges to. */
  empirical: number[][]
  /** How far the final policy sits from that distribution, in the largest single probability. */
  maxGapToEmpirical: number
  finalLoss: number
  /** The loss of the exact maximum-likelihood policy: the floor the run is descending to. */
  exactLoss: number
  finalAccuracy: number
  finalGold: number
  teacherGold: number | null
  /** The response each prompt is demonstrated most often. */
  bestAction: number[]
}

export interface SftOptions {
  steps?: number
  /** The step size on the logits — the learning rate a real SFT run has. */
  learningRate?: number
  teacher?: Bandit
  reportEvery?: number
}

/**
 * Run stage one.
 *
 * Gradient descent on the mean negative log-likelihood, at a fixed step size on
 * the logits. That is what a supervised run does, and on a softmax there is a
 * reason it works: the objective is convex in the logits and its Hessian is the
 * Fisher block, whose largest eigenvalue is at most one, so any step size below
 * two descends. The loss floor is the empirical distribution's own entropy,
 * which `maximumLikelihoodPolicy` writes down exactly, so the run's convergence
 * is a measured quantity rather than an impression.
 */
export function runSft(task: PipelineTask, demonstrations: Demonstration[], options: SftOptions = {}): SftRun {
  const steps = options.steps ?? 800
  const learningRate = options.learningRate ?? 0.5
  const reportEvery = options.reportEvery ?? 8
  const teacher = options.teacher
  const gold = goldReward(task)
  const counts = actionCounts(demonstrations, task)
  const empirical = empiricalDistribution(counts)

  let policy: Bandit = {
    contexts: task.contexts,
    actions: task.actions,
    logits: new Array<number>(task.contexts * task.actions).fill(0),
  }

  const history: SftPoint[] = []
  const measure = (step: number): SftPoint => {
    const { loss } = sftObjective(policy, demonstrations)
    let hits = 0
    for (const demonstration of demonstrations) {
      if (greedyAction(policy, demonstration.context) === demonstration.action) hits++
    }
    return {
      step,
      loss,
      accuracy: demonstrations.length > 0 ? hits / demonstrations.length : 0,
      gold: meanReward(policy, gold),
      klToTeacher: teacher ? klToReference(policy, teacher).mean : null,
    }
  }

  history.push(measure(0))
  for (let step = 1; step <= steps; step++) {
    const { gradient } = sftObjective(policy, demonstrations)
    policy = applyStep(
      policy,
      gradient.map((value) => -value),
      learningRate,
    )
    if (step % reportEvery === 0 || step === steps) history.push(measure(step))
  }

  const exactLoss = sftObjective(maximumLikelihoodPolicy(counts), demonstrations).loss
  let maxGapToEmpirical = 0
  for (let context = 0; context < task.contexts; context++) {
    const probs = softmax(policy.logits.slice(context * task.actions, (context + 1) * task.actions))
    for (let action = 0; action < task.actions; action++) {
      maxGapToEmpirical = Math.max(maxGapToEmpirical, Math.abs((probs[action] ?? 0) - (empirical[context]![action] ?? 0)))
    }
  }

  const final = history[history.length - 1]!
  return {
    policy,
    history,
    counts,
    empirical,
    maxGapToEmpirical,
    finalLoss: final.loss,
    exactLoss,
    finalAccuracy: final.accuracy,
    finalGold: final.gold,
    teacherGold: teacher ? meanReward(teacher, gold) : null,
    bestAction: counts.map((row) => row.reduce((best, value, index) => (value > row[best]! ? index : best), 0)),
  }
}
