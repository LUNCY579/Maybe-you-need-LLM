/**
 * Reasoning laboratory core.
 *
 * Two real computations, both small enough to inspect:
 *
 * 1. A step scorer trained on the same solution in two different regimes:
 *    - outcome supervision: every step inherits the final-answer label
 *    - process supervision: every step gets its own correctness label
 *    Logistic regression on three interpretable step features, trained with
 *    gradient descent. The outcome model cannot separate a wrong step from a
 *    correct one inside a failed solution; the process model can.
 *
 * 2. Evaluation protocols over synthetic per-question results, which show how
 *    the reported conclusion depends on what was measured.
 */
import { sigmoid, type Vector } from './math'

export const STEP_FEATURE_NAMES = ['matches the previous line', 'arithmetic is valid', 'looks confident'] as const

export interface ReasoningStepExample {
  /** Which solution (base task) the step belongs to. */
  taskId: string
  stepIndex: number
  /** Whether this step is actually valid. */
  stepCorrect: boolean
  /** Whether the whole solution ended correct. */
  finalCorrect: boolean
  /** phi(step): three observable features of the step text. */
  features: [number, number, number]
}

/**
 * Six synthetic solutions: four end correctly, two fail.
 *
 * The construction is what makes the comparison in Section 6.4.2 observable:
 *
 *  - The two failing solutions read *coherently* and are written *confidently*.
 *    Every one of their steps looks fine at the level of the whole path, so the
 *    only evidence of the failure is the invalid arithmetic in one single step.
 *  - The four successful solutions are not over-confident.
 *
 * Consequently a path-level signal (how confident the whole solution sounds)
 * can predict the outcome, while a step-level signal (is this step's arithmetic
 * valid) can predict which step failed. Outcome supervision only ever sees the
 * path-level signal, so it cannot tell which step was at fault — it has to
 * penalise the entire path, exactly as the book describes. Process supervision
 * sees the step-level signal and can point at the offending line.
 */
export const STEP_DATASET: readonly ReasoningStepExample[] = [
  // Correct solution 1 — coherent, arithmetically valid, not over-confident.
  { taskId: 't1', stepIndex: 0, stepCorrect: true, finalCorrect: true, features: [0.9, 0.95, 0.4] },
  { taskId: 't1', stepIndex: 1, stepCorrect: true, finalCorrect: true, features: [0.85, 0.9, 0.45] },
  { taskId: 't1', stepIndex: 2, stepCorrect: true, finalCorrect: true, features: [0.8, 0.92, 0.5] },
  // Correct solution 2
  { taskId: 't2', stepIndex: 0, stepCorrect: true, finalCorrect: true, features: [0.7, 0.8, 0.3] },
  { taskId: 't2', stepIndex: 1, stepCorrect: true, finalCorrect: true, features: [0.75, 0.85, 0.55] },
  { taskId: 't2', stepIndex: 2, stepCorrect: true, finalCorrect: true, features: [0.6, 0.7, 0.6] },
  // Correct solution 3 — the last step is unusually confident, which puts it
  // close to the failed solutions and keeps the outcome model from separating
  // the two classes perfectly.
  { taskId: 't3', stepIndex: 0, stepCorrect: true, finalCorrect: true, features: [0.95, 0.6, 0.5] },
  { taskId: 't3', stepIndex: 1, stepCorrect: true, finalCorrect: true, features: [0.9, 0.95, 0.78] },
  // Correct solution 4
  { taskId: 't4', stepIndex: 0, stepCorrect: true, finalCorrect: true, features: [0.55, 0.75, 0.6] },
  { taskId: 't4', stepIndex: 1, stepCorrect: true, finalCorrect: true, features: [0.8, 0.88, 0.45] },
  // Failed solution 1 — the whole path reads well; only step 1 is wrong.
  { taskId: 't5', stepIndex: 0, stepCorrect: true, finalCorrect: false, features: [0.72, 0.8, 0.85] },
  { taskId: 't5', stepIndex: 1, stepCorrect: false, finalCorrect: false, features: [0.5, 0.15, 0.9] },
  { taskId: 't5', stepIndex: 2, stepCorrect: true, finalCorrect: false, features: [0.65, 0.85, 0.87] },
  // Failed solution 2 — again only the last step is wrong.
  { taskId: 't6', stepIndex: 0, stepCorrect: true, finalCorrect: false, features: [0.88, 0.7, 0.82] },
  { taskId: 't6', stepIndex: 1, stepCorrect: true, finalCorrect: false, features: [0.7, 0.75, 0.84] },
  { taskId: 't6', stepIndex: 2, stepCorrect: false, finalCorrect: false, features: [0.45, 0.2, 0.86] },
]

export type SupervisionMode = 'outcome' | 'process'

export interface StepScorerRun {
  weights: Vector
  history: { step: number; loss: number; accuracy: number }[]
  predictions: { taskId: string; stepIndex: number; score: number; stepCorrect: boolean; finalCorrect: boolean }[]
  /** Accuracy of predicting *step* validity, which is the quantity of interest. */
  stepAccuracy: number
  /**
   * How much of the credit a failed solution concentrates on a single step.
   *
   * This is the credit-assignment question the book poses in Section 6.4.2:
   * "an outcome-based training approach might simply penalize the entire
   * sequence". A scorer that penalises the whole path spreads its credit
   * evenly and its score range across the path stays small; a scorer that
   * received per-step feedback can point at one line and its range is large.
   *
   * Measured as the mean score range (max − min) inside each failed solution.
   */
  failedPathCreditSpread: number
  /**
   * Mean score given to the *sound* steps of a failed solution.
   *
   * A low value means the scorer penalises steps that were actually fine,
   * which is what happens when a whole path is labelled wrong.
   */
  soundStepPenalty: number
}

function featuresOf(example: ReasoningStepExample): Vector {
  return [...example.features]
}

function dot(a: Vector, b: Vector): number {
  return a.reduce((sum, value, index) => sum + value * b[index], 0)
}

/**
 * Train the step scorer.
 * `outcome` labels every step of a solution with the solution's final outcome;
 * `process` labels each step with its own validity.
 */
export function trainStepScorer(mode: SupervisionMode, options: { learningRate?: number; steps?: number } = {}): StepScorerRun {
  const learningRate = options.learningRate ?? 1.2
  const steps = options.steps ?? 400
  if (!Number.isFinite(learningRate) || learningRate <= 0) {
    throw new RangeError(`learningRate must be positive and finite, received ${learningRate}`)
  }
  let weights: Vector = [0.1, 0.1, 0.1]
  const history: { step: number; loss: number; accuracy: number }[] = []

  const labelOf = (example: ReasoningStepExample): number =>
    mode === 'outcome' ? Number(example.finalCorrect) : Number(example.stepCorrect)

  const measure = () => {
    let loss = 0
    let correct = 0
    for (const example of STEP_DATASET) {
      const prediction = sigmoid(dot(weights, featuresOf(example)))
      const label = labelOf(example)
      loss -= label * Math.log(Math.max(prediction, 1e-12)) + (1 - label) * Math.log(Math.max(1 - prediction, 1e-12))
      if ((prediction >= 0.5 ? 1 : 0) === Number(example.stepCorrect)) correct += 1
    }
    return { loss: loss / STEP_DATASET.length, accuracy: correct / STEP_DATASET.length }
  }

  history.push({ step: 0, ...measure() })
  for (let step = 1; step <= steps; step++) {
    const gradient: Vector = [0, 0, 0]
    for (const example of STEP_DATASET) {
      const features = featuresOf(example)
      const error = sigmoid(dot(weights, features)) - labelOf(example)
      for (let k = 0; k < 3; k++) gradient[k] += (error * features[k]) / STEP_DATASET.length
    }
    weights = weights.map((value, k) => value - learningRate * gradient[k])
    history.push({ step, ...measure() })
  }

  const predictions = STEP_DATASET.map((example) => ({
    taskId: example.taskId,
    stepIndex: example.stepIndex,
    score: sigmoid(dot(weights, featuresOf(example))),
    stepCorrect: example.stepCorrect,
    finalCorrect: example.finalCorrect,
  }))
  const stepAccuracy =
    predictions.filter((p) => (p.score >= 0.5) === p.stepCorrect).length / predictions.length

  // Credit assignment: how is the blame distributed inside a failed solution?
  const failedTasks = new Map<string, typeof predictions>()
  for (const prediction of predictions) {
    if (prediction.finalCorrect) continue
    const list = failedTasks.get(prediction.taskId) ?? []
    list.push(prediction)
    failedTasks.set(prediction.taskId, list)
  }
  const spreads: number[] = []
  const soundScores: number[] = []
  for (const steps of failedTasks.values()) {
    const scores = steps.map((step) => step.score)
    spreads.push(Math.max(...scores) - Math.min(...scores))
    for (const step of steps) if (step.stepCorrect) soundScores.push(step.score)
  }
  const failedPathCreditSpread =
    spreads.length === 0 ? 0 : spreads.reduce((sum, value) => sum + value, 0) / spreads.length
  const soundStepPenalty =
    soundScores.length === 0 ? 0 : soundScores.reduce((sum, value) => sum + value, 0) / soundScores.length

  return { weights, history, predictions, stepAccuracy, failedPathCreditSpread, soundStepPenalty }
}

/**
 * Credit concentration within each solution.
 *
 * `spread` is the *range* of the step scores belonging to one solution
 * (max − min). A large spread means the scorer is confident about which steps
 * mattered; a spread near zero means it assigns roughly the same credit to every
 * step, which is the credit-assignment failure that outcome supervision tends to
 * produce. `mean` is reported alongside so the UI can show both the level and the
 * concentration of the credit.
 */
export function creditSpread(run: StepScorerRun): {
  taskId: string
  spread: number
  mean: number
  max: number
  min: number
}[] {
  const byTask = new Map<string, number[]>()
  for (const prediction of run.predictions) {
    const list = byTask.get(prediction.taskId) ?? []
    list.push(prediction.score)
    byTask.set(prediction.taskId, list)
  }
  return Array.from(byTask.entries()).map(([taskId, scores]) => {
    const max = Math.max(...scores)
    const min = Math.min(...scores)
    const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length
    return { taskId, spread: max - min, mean, max, min }
  })
}

/* ------------------------------------------------------------------ *
 * Evaluation protocols over synthetic results
 * ------------------------------------------------------------------ */

export interface SyntheticResult {
  id: string
  /** Final answer was correct. */
  answerCorrect: boolean
  /** Every reasoning step was valid. */
  stepsSound: boolean
  /** Tokens generated for this question. */
  tokens: number
}

/**
 * Deterministic synthetic result set: some answers are right for the wrong reason
 * (steps unsound), some are wrong despite sound steps (execution slips).
 */
export const SYNTHETIC_RESULTS: readonly SyntheticResult[] = [
  { id: 'r1', answerCorrect: true, stepsSound: true, tokens: 320 },
  { id: 'r2', answerCorrect: true, stepsSound: true, tokens: 410 },
  { id: 'r3', answerCorrect: true, stepsSound: false, tokens: 180 },
  { id: 'r4', answerCorrect: true, stepsSound: false, tokens: 240 },
  { id: 'r5', answerCorrect: true, stepsSound: true, tokens: 900 },
  { id: 'r6', answerCorrect: false, stepsSound: true, tokens: 260 },
  { id: 'r7', answerCorrect: false, stepsSound: false, tokens: 150 },
  { id: 'r8', answerCorrect: false, stepsSound: false, tokens: 700 },
  { id: 'r9', answerCorrect: true, stepsSound: true, tokens: 1500 },
  { id: 'r10', answerCorrect: false, stepsSound: true, tokens: 380 },
]

export interface ProtocolReport {
  protocol: 'outcome' | 'process' | 'cost-adjusted'
  /** Main score reported by the protocol. */
  score: number
  label: string
  detail: string
}

/** Compare the three reporting protocols over the same results. */
export function evaluateProtocols(results: readonly SyntheticResult[] = SYNTHETIC_RESULTS): ProtocolReport[] {
  const n = results.length || 1
  const outcome = results.filter((r) => r.answerCorrect).length / n
  const process = results.filter((r) => r.answerCorrect && r.stepsSound).length / n
  const tokens = results.reduce((sum, r) => sum + r.tokens, 0)
  const correct = results.filter((r) => r.answerCorrect && r.stepsSound).length
  const costAdjusted = tokens === 0 ? 0 : correct / (tokens / 1000)
  return [
    {
      protocol: 'outcome',
      score: outcome,
      label: 'Answer accuracy',
      detail: 'Counts correct final answers, including answers that are right for the wrong reason.',
    },
    {
      protocol: 'process',
      score: process,
      label: 'Sound-and-correct rate',
      detail: 'Requires both a correct answer and sound steps. This is the strictest of the three.',
    },
    {
      protocol: 'cost-adjusted',
      score: costAdjusted,
      label: 'Sound answers per 1k tokens',
      detail: 'Divides sound correct answers by generated tokens, so a method that “thinks” for twice as long must be twice as reliable to win.',
    },
  ]
}
