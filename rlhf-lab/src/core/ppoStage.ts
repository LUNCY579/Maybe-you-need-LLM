/**
 * Stage three: the policy optimisation, and the pipeline run end to end.
 *
 * One-step PPO on the bandit, against the reward table stage two produced, with
 * the KL penalty measured against the policy stage one produced. The gold reward
 * is scored alongside the proxy at every step and never enters the objective —
 * that is the entire experiment. What comes out is the last laboratory's
 * phenomenon produced by a pipeline rather than by a construction: the proxy
 * climbs, the gold reward turns over, and where it turns over is set by the
 * reward model's extrapolation error rather than by the truth.
 *
 * `runPipeline` is all three stages in one call, which is what makes them
 * runnable files rather than diagrams.
 */

import type { Bandit } from './policy.js'
import { actionProbs, applyStep, cloneBandit, contextValues, klToReference, logProb, meanReward } from './policy.js'
import { type AdvantageTreatment, evaluatePpo, normaliseAdvantages, ppoGradient, sampleAdvantageBatch } from './ppo.js'
import type { Demonstration, PipelineTask, SftRun } from './sft.js'
import { buildTask, demonstratorPolicy, goldReward, runSft, sampleDemonstrations } from './sft.js'
import type { PreferencePair, RewardModel, RewardModelRun } from './rewardModel.js'
import { errorProfile, fitRewardModel, rewardTable, samplePreferences, scoreOf } from './rewardModel.js'

/** The per-step KL penalty in reward units, under the policy that collected the batch. */
export function klPenaltyTable(policy: Bandit, reference: Bandit, beta: number): number[][] {
  const table: number[][] = []
  for (let context = 0; context < policy.contexts; context++) {
    const row: number[] = []
    for (let action = 0; action < policy.actions; action++) {
      row.push(beta * (logProb(policy, context, action) - logProb(reference, context, action)))
    }
    table.push(row)
  }
  return table
}

/** The proxy reward with the penalty subtracted — what the collector actually sees. */
export function penalisedRewards(proxy: number[][], policy: Bandit, reference: Bandit, beta: number): number[][] {
  const penalty = klPenaltyTable(policy, reference, beta)
  return proxy.map((row, context) => row.map((value, action) => value - (penalty[context]![action] ?? 0)))
}

/** Rewards shifted to zero mean and unit variance across every prompt and response. */
export function standardise(rewards: number[][]): { table: number[][]; mean: number; standardDeviation: number } {
  const flat = rewards.flat()
  const mean = flat.reduce((a, b) => a + b, 0) / Math.max(1, flat.length)
  const variance = flat.reduce((total, value) => total + (value - mean) ** 2, 0) / Math.max(1, flat.length)
  const standardDeviation = Math.sqrt(variance)
  const scale = standardDeviation > 1e-12 ? 1 / standardDeviation : 1
  return { table: rewards.map((row) => row.map((value) => (value - mean) * scale)), mean, standardDeviation }
}

/** The batch's advantages, with the treatment the run asked for. */
function applyTreatment(advantages: number[], treatment: AdvantageTreatment): number[] {
  if (treatment === 'raw') return advantages
  const normalised = normaliseAdvantages(advantages)
  return treatment === 'centred' ? normalised.centred : normalised.whitened
}

/** The mean nominal quality the policy answers a prompt with. */
export function meanNominalQuality(task: PipelineTask, policy: Bandit): number {
  let total = 0
  for (let context = 0; context < task.contexts; context++) {
    const probs = actionProbs(policy, context)
    const row = task.nominal[context] ?? []
    total += probs.reduce((sum, p, action) => sum + p * (row[action] ?? 0), 0)
  }
  return task.contexts === 0 ? 0 : total / task.contexts
}

export interface StageOptions {
  /** The KL coefficient, in reward units per nat. */
  beta?: number
  /** The PPO clip range. */
  epsilon?: number
  steps?: number
  batch?: number
  /** How many passes each batch is optimised for. */
  epochs?: number
  learningRate?: number
  criticLearningRate?: number
  /** What happens to the batch's advantages before the update. */
  normalise?: AdvantageTreatment
  /** Whether the reward table is standardised before use. */
  normaliseRewards?: boolean
  seed?: number
  reportEvery?: number
}

export interface StagePoint {
  step: number
  /** The proxy reward the policy now expects. */
  proxy: number
  /** The gold reward the same policy expects. */
  gold: number
  /** KL(policy ‖ reference), averaged over the prompts. */
  kl: number
  /** The share of the batch whose clip was active at the end of the update. */
  clipFraction: number
  meanRatio: number
  /** The critic's mean squared residual on this batch. */
  criticLoss: number
}

export interface StageRun {
  policy: Bandit
  history: StagePoint[]
  /** The reward table the optimisation was given. */
  proxy: number[][]
  beta: number
  epsilon: number
  steps: number
  /** The best gold reward reached, and when. */
  bestGold: number
  bestGoldStep: number
  goldAtEnd: number
  proxyAtEnd: number
  klAtEnd: number
  /** How much gold reward was given away after the peak. */
  dropFromBest: number
  meanQuality: number
  meanQualityAtReference: number
  /** What the reference policy was worth on both scales. */
  goldAtReference: number
  proxyAtReference: number
}

/**
 * Run stage three.
 *
 * Each step collects a batch under the current policy, pays the KL penalty for
 * the actions in it, moves the critic toward the batch, then takes `epochs`
 * clipped-surrogate passes against the collection policy. The gold reward is
 * computed on the same policy and never enters the objective: it is a measuring
 * stick, which is exactly what a gold reward model is for.
 */
export function runPpoStage(
  task: PipelineTask,
  model: RewardModel,
  reference: Bandit,
  options: StageOptions = {},
): StageRun {
  const beta = options.beta ?? 0.05
  const epsilon = options.epsilon ?? 0.2
  const steps = options.steps ?? 60
  const batch = options.batch ?? 256
  const epochs = options.epochs ?? 4
  const learningRate = options.learningRate ?? 0.3
  const criticLearningRate = options.criticLearningRate ?? 0.5
  const treatment = options.normalise ?? 'raw'
  const seed = options.seed ?? 41
  const reportEvery = options.reportEvery ?? 1

  const gold = goldReward(task)
  const raw = rewardTable(task, model)
  const scaled = options.normaliseRewards ? standardise(raw).table : raw
  let critic = contextValues(reference, scaled)
  let policy = cloneBandit(reference)

  const history: StagePoint[] = []
  const record = (step: number, clipFraction: number, meanRatio: number, criticLoss: number) => {
    history.push({
      step,
      proxy: meanReward(policy, raw),
      gold: meanReward(policy, gold),
      kl: klToReference(policy, reference).mean,
      clipFraction,
      meanRatio,
      criticLoss,
    })
  }

  record(0, 0, 1, 0)
  for (let step = 1; step <= steps; step++) {
    const old = cloneBandit(policy)
    const seen = penalisedRewards(scaled, old, reference, beta)
    const collected = sampleAdvantageBatch(old, seen, critic, batch, seed + step)
    const advantages = applyTreatment(collected.advantages, treatment)

    // The critic is one number per prompt, fitted to the batch it just saw.
    let criticLoss = 0
    for (let context = 0; context < task.contexts; context++) {
      const rows = collected.trajectory.steps.filter((entry) => entry.context === context)
      if (rows.length === 0) continue
      const average = rows.reduce((total, entry) => total + entry.reward, 0) / rows.length
      const error = average - (critic[context] ?? 0)
      criticLoss += rows.reduce((total, entry) => total + (entry.reward - (critic[context] ?? 0)) ** 2, 0)
      critic[context] = (critic[context] ?? 0) + criticLearningRate * error
    }
    criticLoss /= Math.max(1, collected.trajectory.steps.length)

    for (let epoch = 0; epoch < epochs; epoch++) {
      const gradient = ppoGradient(policy, old, collected.trajectory, advantages, epsilon)
      policy = applyStep(policy, gradient, learningRate)
    }

    const evaluation = evaluatePpo(policy, old, collected.trajectory, advantages, epsilon)
    if (step % reportEvery === 0 || step === steps) record(step, evaluation.clipFraction, evaluation.meanRatio, criticLoss)
  }

  const best = history.reduce((a, b) => (b.gold > a.gold ? b : a))
  const last = history[history.length - 1]!
  return {
    policy,
    history,
    proxy: raw,
    beta,
    epsilon,
    steps,
    bestGold: best.gold,
    bestGoldStep: best.step,
    goldAtEnd: last.gold,
    proxyAtEnd: last.proxy,
    klAtEnd: last.kl,
    dropFromBest: best.gold - last.gold,
    meanQuality: meanNominalQuality(task, policy),
    meanQualityAtReference: meanNominalQuality(task, reference),
    goldAtReference: meanReward(reference, gold),
    proxyAtReference: meanReward(reference, raw),
  }
}

export interface PipelineOptions {
  contexts?: number
  actions?: number
  peak?: number
  jitter?: number
  taskSeed?: number

  /** Stage one. */
  demonstrations?: number
  demonstrationSeed?: number
  inconsistency?: number
  demonstratorTemperature?: number
  sftSteps?: number
  sftLearningRate?: number

  /** Stage two. */
  pairs?: number
  pairSeed?: number
  band?: [number, number]
  labelNoise?: number
  rmSteps?: number
  rmLearningRate?: number

  /** Stage three. */
  stage?: StageOptions
}

export interface PipelineRun {
  task: PipelineTask
  teacher: Bandit
  demonstrations: Demonstration[]
  sft: SftRun
  preferences: PreferencePair[]
  rm: RewardModelRun
  stage: StageRun
  /** Where the reward model thinks the best response is. */
  modelOptimum: number
  /** What the gold reward says about a response at that place. */
  goldAtModelOptimum: number
  /** The best gold reward any policy on this task can reach. */
  goldAtPeak: number
}

/**
 * All three stages, in order.
 *
 * The demonstrations set the reference policy, the pairs set the reward model,
 * and the reward model is the only thing stage three is allowed to see. Nothing
 * here is sampled at the last step except the batches the collector draws.
 */
export function runPipeline(options: PipelineOptions = {}): PipelineRun {
  const task = buildTask({
    contexts: options.contexts,
    actions: options.actions,
    peak: options.peak,
    jitter: options.jitter,
    seed: options.taskSeed,
  })
  const teacher = demonstratorPolicy(task, options.demonstratorTemperature ?? 0.25)
  const demonstrations = sampleDemonstrations(
    task,
    teacher,
    options.demonstrations ?? 600,
    options.demonstrationSeed ?? 21,
    options.inconsistency ?? 0,
  )
  const sft = runSft(task, demonstrations, {
    steps: options.sftSteps ?? 800,
    learningRate: options.sftLearningRate ?? 0.5,
    teacher,
  })
  const preferences = samplePreferences(task, {
    count: options.pairs ?? 400,
    seed: options.pairSeed ?? 31,
    band: options.band ?? [-1, 1],
    labelNoise: options.labelNoise ?? 0,
  })
  const rm = fitRewardModel(task, preferences, {
    steps: options.rmSteps ?? 120,
    learningRate: options.rmLearningRate ?? 0.4,
    band: options.band ?? [-1, 1],
    labelNoise: options.labelNoise ?? 0,
    seed: options.pairSeed ?? 31,
  })

  const modelOptimum = rm.history[rm.history.length - 1]!.optimum
  const gold = goldReward(task)
  return {
    task,
    teacher,
    demonstrations,
    sft,
    preferences,
    rm,
    stage: runPpoStage(task, rm.model, sft.policy, options.stage ?? {}),
    modelOptimum,
    goldAtModelOptimum: -((modelOptimum - task.peak) ** 2),
    goldAtPeak: Math.max(...gold.flat()),
  }
}

export interface WeakModelVariant {
  label: string
  /** The range of nominal qualities the preference data covers. */
  band: [number, number]
  pairs?: number
  pairSeed?: number
  labelNoise?: number
  rmSteps?: number
}

export interface WeakModelRow extends WeakModelVariant {
  accuracy: number
  /** …and on the pairs the band leaves out. */
  outsideAccuracy: number
  modelOptimum: number
  /** The model’s largest error, in reward units, where the pairs reach. */
  errorInside: number
  /** …and where they do not. Zero when the band is the whole range. */
  errorOutside: number
  /** The whole curve, so the screen can draw it without running the stage twice. */
  history: StagePoint[]
  proxyAtReference: number
  proxyAtEnd: number
  goldAtReference: number
  bestGold: number
  bestGoldStep: number
  goldAtEnd: number
  dropFromBest: number
  klAtEnd: number
  meanQuality: number
  /** Whether the gold reward peaked part-way through and then fell. */
  turnsOver: boolean
}

/**
 * The fall from the gold reward's peak that counts as a turnover.
 *
 * Every one of these curves wobbles: the reported best and the reported end
 * differ by a few thousandths even when the run has simply plateaued. A
 * hundredth of a reward unit is above that wobble and below every fall the
 * laboratory wants to name, so it is the line between "the run reached its
 * best and stayed there" and "the run went past it".
 */
export const TURNOVER_FLOOR = 0.01

/**
 * The same reference policy, optimised against several reward models.
 *
 * Stage one runs once and is shared: the only thing that changes down the column
 * is how the model was fitted. That is what makes the comparison a measurement
 * of stage two rather than of the whole pipeline, and the rows differ only in
 * which responses the preference data covered.
 */
export function weakModelStudy(
  task: PipelineTask,
  reference: Bandit,
  variants: WeakModelVariant[],
  options: StageOptions = {},
): WeakModelRow[] {
  return variants.map((variant) => {
    const pairs = samplePreferences(task, {
      count: variant.pairs ?? 400,
      seed: variant.pairSeed ?? 31,
      band: variant.band,
      labelNoise: variant.labelNoise ?? 0,
    })
    const fit = fitRewardModel(task, pairs, {
      steps: variant.rmSteps ?? 600,
      band: variant.band,
      labelNoise: variant.labelNoise ?? 0,
      seed: variant.pairSeed ?? 31,
    })
    const stage = runPpoStage(task, fit.model, reference, options)
    const profile = errorProfile(task, fit.model, 41)
    const offBand = profile.filter((row) => !row.insideBand)
    return {
      ...variant,
      accuracy: fit.finalAccuracy,
      outsideAccuracy: fit.finalOutsideAccuracy,
      modelOptimum: fit.history[fit.history.length - 1]!.optimum,
      errorInside: Math.max(0, ...profile.filter((row) => row.insideBand).map((row) => Math.abs(row.error))),
      errorOutside: offBand.length === 0 ? 0 : Math.max(...offBand.map((row) => Math.abs(row.error))),
      history: stage.history,
      proxyAtReference: stage.proxyAtReference,
      proxyAtEnd: stage.proxyAtEnd,
      goldAtReference: stage.goldAtReference,
      bestGold: stage.bestGold,
      bestGoldStep: stage.bestGoldStep,
      goldAtEnd: stage.goldAtEnd,
      dropFromBest: stage.dropFromBest,
      klAtEnd: stage.klAtEnd,
      meanQuality: stage.meanQuality,
      turnsOver:
        stage.bestGoldStep > 0 && stage.bestGoldStep < stage.steps && stage.dropFromBest > TURNOVER_FLOOR,
    }
  })
}

/** The score the reward model gives a nominal quality, exposed for the screen. */
export function modelScore(model: RewardModel, x: number): number {
  return scoreOf(model, x)
}
