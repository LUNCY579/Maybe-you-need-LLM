/**
 * Stage two: the reward model.
 *
 * A Bradley–Terry model over pairs of responses, fitted by gradient descent on
 * the pair loss, on the task stage one was run on. It is deliberately built from
 * the *feature* — a response's nominal quality — rather than from the truth,
 * which is what makes it a proxy: the part of the truth the feature does not
 * carry is error the model cannot see, and the part of the response space the
 * preference data does not cover is where its extrapolation goes free.
 *
 * Both of those are measured here. Pairwise accuracy is reported on the pairs the
 * model was trained on and on pairs from outside that range, which is the
 * difference between a reward model that ranks well and one that is safe to
 * optimise against.
 */

import { sigmoid } from '@llm-materials/course-core'
import type { PipelineTask } from './sft.js'
import { goldReward } from './sft.js'

export interface PreferencePair {
  context: number
  chosen: number
  rejected: number
}

export interface PreferenceOptions {
  count?: number
  seed?: number
  /** The range of nominal qualities the preference data covers. */
  band?: [number, number]
  /** The share of labels that are flipped. */
  labelNoise?: number
}

/** The responses whose nominal quality falls inside a range. */
function eligibleActions(task: PipelineTask, band: [number, number]): number[] {
  const eligible: number[] = []
  for (let action = 0; action < task.actions; action++) {
    const x = task.nominal[0]?.[action] ?? 0
    if (x >= band[0] - 1e-9 && x <= band[1] + 1e-9) eligible.push(action)
  }
  return eligible
}

/**
 * Draw preference pairs.
 *
 * Two distinct responses inside the band are compared by their gold reward and
 * the better one is labelled preferred, unless the label is flipped. Restricting
 * the band is the whole of the lesson: the model is asked to rank what it was
 * shown, and nothing constrains what it says about the rest.
 */
export function samplePreferences(task: PipelineTask, options: PreferenceOptions = {}): PreferencePair[] {
  const count = options.count ?? 400
  const band = options.band ?? [-1, 1]
  const labelNoise = options.labelNoise ?? 0
  const eligible = eligibleActions(task, band)
  if (eligible.length < 2) return []

  const gold = goldReward(task)
  const pairs: PreferencePair[] = []
  let state = (options.seed ?? 31) >>> 0
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }

  for (let index = 0; index < count; index++) {
    const context = Math.floor(next() * task.contexts) % task.contexts
    const first = Math.floor(next() * eligible.length) % eligible.length
    let second = Math.floor(next() * eligible.length) % eligible.length
    while (second === first) second = (second + 1) % eligible.length
    let chosen = eligible[first]!
    let rejected = eligible[second]!
    const chosenGold = gold[context]![chosen]!
    const rejectedGold = gold[context]![rejected]!
    if (chosenGold < rejectedGold || (chosenGold === rejectedGold && next() < 0.5)) {
      const swap = chosen
      chosen = rejected
      rejected = swap
    }
    if (next() < labelNoise) {
      const swap = chosen
      chosen = rejected
      rejected = swap
    }
    pairs.push({ context, chosen, rejected })
  }
  return pairs
}

/** The feature vector a response's nominal quality is turned into. */
export function featureOf(x: number): number[] {
  return [x, x * x]
}

export interface RewardModel {
  /** One weight per feature, so a response is scored w₁x + w₂x². */
  weights: number[]
  band: [number, number]
  pairs: number
  labelNoise: number
  steps: number
  learningRate: number
}

function scoreWith(weights: number[], x: number): number {
  const features = featureOf(x)
  return features.reduce((total, value, index) => total + value * (weights[index] ?? 0), 0)
}

/** The score a response with nominal quality x is given. */
export function scoreOf(model: RewardModel, x: number): number {
  return scoreWith(model.weights, x)
}

/**
 * The Bradley–Terry loss over pairs, with its gradient and its accuracy.
 *
 * For a pair the model scores s_c and s_r, the probability the labelled choice
 * wins is σ(s_c − s_r). The gradient of the mean negative log-likelihood is
 * −mean (1 − σ(Δ))·(φ_c − φ_r): it is small exactly where the model already
 * agrees with the label, and it never asks the model to explain a pair it has
 * no data for.
 */
export function pairObjective(
  weights: number[],
  task: PipelineTask,
  pairs: PreferencePair[],
): { loss: number; gradient: number[]; accuracy: number } {
  const gradient = new Array<number>(weights.length).fill(0)
  let loss = 0
  let hits = 0

  for (const pair of pairs) {
    const chosenX = task.nominal[pair.context]![pair.chosen] ?? 0
    const rejectedX = task.nominal[pair.context]![pair.rejected] ?? 0
    const difference = scoreWith(weights, chosenX) - scoreWith(weights, rejectedX)
    const probability = sigmoid(difference)
    loss -= Math.log(Math.max(probability, 1e-300))
    if (probability >= 0.5) hits++
    const chosenFeatures = featureOf(chosenX)
    const rejectedFeatures = featureOf(rejectedX)
    for (let index = 0; index < weights.length; index++) {
      gradient[index] =
        (gradient[index] ?? 0) - (1 - probability) * ((chosenFeatures[index] ?? 0) - (rejectedFeatures[index] ?? 0))
    }
  }

  const count = Math.max(1, pairs.length)
  return {
    loss: loss / count,
    gradient: gradient.map((value) => value / count),
    accuracy: pairs.length > 0 ? hits / pairs.length : Number.NaN,
  }
}

/** How often a model puts the labelled winner above the labelled loser. */
export function pairsOfAccuracy(model: RewardModel, pairs: PreferencePair[], task: PipelineTask): number {
  if (pairs.length === 0) return Number.NaN
  let hits = 0
  for (const pair of pairs) {
    const chosen = scoreOf(model, task.nominal[pair.context]![pair.chosen] ?? 0)
    const rejected = scoreOf(model, task.nominal[pair.context]![pair.rejected] ?? 0)
    if (chosen >= rejected) hits++
  }
  return hits / pairs.length
}

export interface RewardModelPoint {
  step: number
  loss: number
  /** Pairwise accuracy on the training pairs. */
  accuracy: number
  /** The same on pairs from the part of the range the model was not shown. */
  outsideAccuracy: number
  /** Where on the feature axis the model's score is highest. */
  optimum: number
  /** The score difference between the two ends of the range: how sharp the model is. */
  spread: number
}

export interface RewardModelRun {
  model: RewardModel
  history: RewardModelPoint[]
  trainPairs: PreferencePair[]
  /** Held-out pairs from outside the training band. */
  outsidePairs: PreferencePair[]
  finalAccuracy: number
  finalOutsideAccuracy: number
  outsideCount: number
}

export interface RewardModelOptions extends PreferenceOptions {
  steps?: number
  learningRate?: number
  reportEvery?: number
  /** The range the model is extrapolated across, for reporting. */
  range?: [number, number]
}

/**
 * The part of the range the training band leaves out, on the roomier side.
 *
 * Falls back to the whole range when the band already covers it, so a held-out
 * accuracy is never computed from a handful of pairs.
 */
function outsideBand(band: [number, number], range: [number, number]): [number, number] {
  const lowRoom = band[0] - range[0]
  const highRoom = range[1] - band[1]
  if (lowRoom < 1e-9 && highRoom < 1e-9) return [range[0], range[1]]
  return lowRoom >= highRoom ? [range[0], band[0]] : [band[1], range[1]]
}

/**
 * Fit the reward model.
 *
 * Nothing regularises the fit: the number of steps is the regulariser, which is
 * why the step count is a dial on the screen and not a constant in here. A model
 * trained long enough on a narrow band ranks its band superbly and will say
 * anything at all about the rest of the response space.
 */
export function fitRewardModel(
  task: PipelineTask,
  pairs: PreferencePair[],
  options: RewardModelOptions = {},
): RewardModelRun {
  const steps = options.steps ?? 120
  const learningRate = options.learningRate ?? 0.4
  const reportEvery = options.reportEvery ?? 4
  const band = options.band ?? [-1, 1]
  const range = options.range ?? [-1, 1]

  const outside = samplePreferences(task, {
    count: 240,
    seed: (options.seed ?? 31) + 7919,
    band: outsideBand(band, range),
    labelNoise: 0,
  })

  const describe = (step: number, weights: number[]): RewardModelPoint => {
    const model: RewardModel = {
      weights,
      band,
      pairs: pairs.length,
      labelNoise: options.labelNoise ?? 0,
      steps,
      learningRate,
    }
    const objective = pairObjective(weights, task, pairs)
    const points = samplePoints(model, range, 41)
    return {
      step,
      loss: objective.loss,
      accuracy: objective.accuracy,
      outsideAccuracy: pairsOfAccuracy(model, outside, task),
      optimum: points.reduce((best, point) => (point.value > best.value ? point : best), points[0]!).x,
      spread: points[points.length - 1]!.value - points[0]!.value,
    }
  }

  const history: RewardModelPoint[] = []
  let weights = pairs.length > 0 ? [0.6, -0.6] : [0, 0]
  history.push(describe(0, weights))
  for (let step = 1; step <= steps; step++) {
    const { gradient } = pairObjective(weights, task, pairs)
    weights = weights.map((value, index) => value - learningRate * (gradient[index] ?? 0))
    if (step % reportEvery === 0 || step === steps) history.push(describe(step, weights))
  }

  const model: RewardModel = {
    weights,
    band,
    pairs: pairs.length,
    labelNoise: options.labelNoise ?? 0,
    steps,
    learningRate,
  }
  const final = history[history.length - 1]!
  return {
    model,
    history,
    trainPairs: pairs,
    outsidePairs: outside,
    finalAccuracy: final.accuracy,
    finalOutsideAccuracy: final.outsideAccuracy,
    outsideCount: outside.length,
  }
}

/** A model's scores across a range, for reporting its shape. */
export function samplePoints(model: RewardModel, range: [number, number], count: number): { x: number; value: number }[] {
  const out: { x: number; value: number }[] = []
  for (let index = 0; index < count; index++) {
    const x = range[0] + ((range[1] - range[0]) * index) / Math.max(1, count - 1)
    out.push({ x, value: scoreOf(model, x) })
  }
  return out
}

/**
 * The reward table the third stage is given: the model's score for every prompt
 * and response. The response's truth never enters it — this is all the policy
 * optimisation is allowed to see.
 */
export function rewardTable(task: PipelineTask, model: RewardModel): number[][] {
  return task.nominal.map((row) => row.map((x) => scoreWith(model.weights, x)))
}

export interface ScoreAlignment {
  /** The model's score times this, plus the offset, reproduces the ceiling over the band. */
  scale: number
  offset: number
  /** The residual of that fit inside the band, in reward units: how badly a straight rescaling can match the shape. */
  insideResidual: number
}

/**
 * Put the model's score on the gold reward's scale.
 *
 * A Bradley–Terry score is only defined up to an increasing affine map: the
 * pairs pin down which response beats which, never what a win is worth. So the
 * two curves cannot be compared as they stand, and comparing them raw would call
 * a scale difference an error. The least-squares affine fit over the band is the
 * most generous reading the data allows — inside the band it leaves only what
 * the pairs could not have constrained, and outside it whatever the extrapolation
 * adds.
 */
export function alignScores(task: PipelineTask, model: RewardModel, samples = 61): ScoreAlignment {
  const low = Math.max(-1, Math.min(model.band[0], model.band[1]))
  const high = Math.min(1, Math.max(model.band[0], model.band[1]))
  const points: { score: number; ceiling: number }[] = []
  for (let index = 0; index < samples; index++) {
    const x = low + ((high - low) * index) / Math.max(1, samples - 1)
    points.push({ score: scoreOf(model, x), ceiling: -(x - task.peak) * (x - task.peak) })
  }

  const n = points.length
  const meanScore = points.reduce((total, point) => total + point.score, 0) / n
  const meanCeiling = points.reduce((total, point) => total + point.ceiling, 0) / n
  let cross = 0
  let square = 0
  for (const point of points) {
    cross += (point.score - meanScore) * (point.ceiling - meanCeiling)
    square += (point.score - meanScore) ** 2
  }

  // A Bradley–Terry score may only be rescaled by an *increasing* affine map, so
  // a score that runs the other way against the ceiling has no legal reading: the
  // best admissible fit is then the constant, and the error is the ceiling's own
  // spread. A band that pins nothing down leaves the score on its own scale.
  const slope = square > 1e-12 ? cross / square : 1
  const scale = Math.max(0, slope)
  const offset = meanCeiling - scale * meanScore
  const insideResidual = Math.sqrt(
    points.reduce((total, point) => total + (offset + scale * point.score - point.ceiling) ** 2, 0) / n,
  )
  return { scale, offset, insideResidual }
}

export interface ModelErrorRow {
  x: number
  /** The model's own score, on the scale the pairs left it. */
  score: number
  /** The same score read on the gold reward's scale. */
  aligned: number
  /** The best any model built on this feature can do at that x. */
  achievable: number
  /** The gap between the two, in reward units. */
  error: number
  insideBand: boolean
}

/**
 * The model's error along the feature axis.
 *
 * `achievable` is the gold reward with the jitter averaged out — the ceiling on
 * what a model of this feature can express. The model's score is put on that
 * scale by `alignScores` before the two are differenced, so the residual is the
 * part of the error the preference data could not have constrained. It is small
 * inside the band and grows outside it, which is the extrapolation the policy
 * then optimises against.
 */
export function errorProfile(task: PipelineTask, model: RewardModel, steps = 41): ModelErrorRow[] {
  const { scale, offset } = alignScores(task, model)
  const rows: ModelErrorRow[] = []
  for (let index = 0; index < steps; index++) {
    const x = -1 + (2 * index) / Math.max(1, steps - 1)
    const score = scoreOf(model, x)
    const achievable = -(x - task.peak) * (x - task.peak)
    const aligned = offset + scale * score
    rows.push({ x, score, aligned, achievable, error: aligned - achievable, insideBand: x >= model.band[0] && x <= model.band[1] })
  }
  return rows
}
