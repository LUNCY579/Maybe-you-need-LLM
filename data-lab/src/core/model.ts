/**
 * The downstream model.
 *
 * A data pipeline is only worth judging by what it produces, so every filter
 * in this course is scored by training a model on the data that survives it
 * and measuring the model. The model here is a multinomial logistic
 * regression over bag-of-tokens: small enough to train in milliseconds,
 * expressive enough that a bad corpus really does give a worse model, and
 * differentiable enough that its gradient can be checked against a finite
 * difference.
 */

export interface Sample {
  /** The bag-of-tokens count vector. */
  features: number[]
  /** The label to predict. */
  label: number
  /** The domain the sample came from, for the per-domain losses. */
  group: number
}

export interface ClassifierWeights {
  /** The weight matrix, one row per class. */
  w: number[][]
  /** The bias, one per class. */
  b: number[]
}

export interface TrainingOptions {
  /** The number of gradient steps. */
  steps?: number
  /** The learning rate. */
  learningRate?: number
  /** The L2 penalty. */
  l2?: number
}

export interface TrainingResult {
  weights: ClassifierWeights
  /** The loss at each step. */
  history: number[]
  /** The loss of the final model on the training set. */
  finalLoss: number
}

/** The softmax of a score vector. */
export function softmax(scores: number[]): number[] {
  const maximum = Math.max(...scores)
  const exponentials = scores.map((score) => Math.exp(score - maximum))
  const total = exponentials.reduce((a, b) => a + b, 0)
  return exponentials.map((value) => value / total)
}

/** The negative log-likelihood of one sample, and the gradient of it. */
function sampleLossGradient(
  weights: ClassifierWeights,
  sample: Sample,
  l2: number,
): { loss: number; dw: number[][]; db: number[] } {
  const classes = weights.w.length
  const features = sample.features.length
  const scores = new Array<number>(classes).fill(0)
  for (let c = 0; c < classes; c++) {
    let total = weights.b[c] ?? 0
    const row = weights.w[c]!
    for (let f = 0; f < features; f++) {
      total += (row[f] ?? 0) * (sample.features[f] ?? 0)
    }
    scores[c] = total
  }
  const probabilities = softmax(scores)
  const loss = -Math.log(Math.max(probabilities[sample.label] ?? 1e-12, 1e-12))

  const dw: number[][] = []
  const db: number[] = []
  for (let c = 0; c < classes; c++) {
    const row = new Array<number>(features).fill(0)
    const probability = probabilities[c] ?? 0
    const target = c === sample.label ? 1 : 0
    const delta = probability - target
    for (let f = 0; f < features; f++) {
      row[f] = delta * (sample.features[f] ?? 0) + l2 * (weights.w[c]?.[f] ?? 0)
    }
    dw.push(row)
    db.push(delta)
  }
  return { loss, dw, db }
}

/** The mean loss of a set of samples under some weights, and the L2 penalty. */
export function meanLoss(weights: ClassifierWeights, samples: Sample[], l2 = 0): number {
  if (samples.length === 0) return 0
  let total = 0
  for (const sample of samples) {
    const { loss } = sampleLossGradient(weights, sample, 0)
    total += loss
  }
  const penalty = l2 * sumOfSquares(weights.w) / 2
  return total / samples.length + penalty
}

function sumOfSquares(matrix: number[][]): number {
  let total = 0
  for (const row of matrix) for (const value of row) total += value * value
  return total
}

/**
 * The gradient of the mean loss.
 *
 * Exported so that the test suite can compare it against a central finite
 * difference of `meanLoss`, component by component. The gradient of a mean is
 * the mean of the gradients, which is what the training loop uses.
 */
export function gradientOfLoss(
  weights: ClassifierWeights,
  samples: Sample[],
  l2 = 0,
): { dw: number[][]; db: number[] } {
  const classes = weights.w.length
  const features = weights.w[0]?.length ?? 0
  const dw: number[][] = []
  const db: number[] = new Array<number>(classes).fill(0)
  for (let c = 0; c < classes; c++) dw.push(new Array<number>(features).fill(0))

  if (samples.length === 0) return { dw, db }

  for (const sample of samples) {
    const { dw: sampleDw, db: sampleDb } = sampleLossGradient(weights, sample, l2)
    for (let c = 0; c < classes; c++) {
      const target = dw[c]!
      const source = sampleDw[c]!
      for (let f = 0; f < features; f++) target[f] = (target[f] ?? 0) + (source[f] ?? 0)
      db[c] = (db[c] ?? 0) + (sampleDb[c] ?? 0)
    }
  }

  for (let c = 0; c < classes; c++) {
    for (let f = 0; f < features; f++) dw[c]![f] = (dw[c]![f] ?? 0) / samples.length
    db[c] = (db[c] ?? 0) / samples.length
  }
  return { dw, db }
}

/**
 * Train the classifier with full-batch gradient descent.
 *
 * The gradient is analytic. `gradientOfLoss` in the test suite compares it
 * against a central finite difference, component by component.
 */
export function trainClassifier(
  samples: Sample[],
  classes: number,
  features: number,
  options: TrainingOptions = {},
): TrainingResult {
  const settings = { steps: 400, learningRate: 0.5, l2: 0, ...options }
  const weights: ClassifierWeights = { w: [], b: new Array<number>(classes).fill(0) }
  for (let c = 0; c < classes; c++) weights.w.push(new Array<number>(features).fill(0))

  const history: number[] = []
  if (samples.length === 0) {
    return { weights, history, finalLoss: 0 }
  }

  for (let step = 0; step < settings.steps; step++) {
    const { dw, db } = gradientOfLoss(weights, samples, settings.l2)

    for (let c = 0; c < classes; c++) {
      const row = weights.w[c]!
      const target = dw[c]!
      for (let f = 0; f < features; f++) {
        row[f] = (row[f] ?? 0) - settings.learningRate * (target[f] ?? 0)
      }
      weights.b[c] = (weights.b[c] ?? 0) - settings.learningRate * (db[c] ?? 0)
    }

    history.push(meanLoss(weights, samples, settings.l2))
  }

  return { weights, history, finalLoss: history[history.length - 1] ?? 0 }
}

/** The accuracy of a set of weights on a set of samples. */
export function accuracy(weights: ClassifierWeights, samples: Sample[]): number {
  if (samples.length === 0) return 0
  let correct = 0
  for (const sample of samples) {
    const predicted = predict(weights, sample.features)
    if (predicted === sample.label) correct++
  }
  return correct / samples.length
}

/** The index of the highest-scoring class. */
export function predict(weights: ClassifierWeights, features: number[]): number {
  const classes = weights.w.length
  let best = 0
  let bestScore = -Infinity
  for (let c = 0; c < classes; c++) {
    const row = weights.w[c]!
    let score = weights.b[c] ?? 0
    for (let f = 0; f < features.length; f++) score += (row[f] ?? 0) * (features[f] ?? 0)
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

/** The loss of each group of samples. */
export function groupLosses(weights: ClassifierWeights, samples: Sample[], groups: number): number[] {
  const totals = new Array<number>(groups).fill(0)
  const counts = new Array<number>(groups).fill(0)
  for (const sample of samples) {
    const { loss } = sampleLossGradient(weights, sample, 0)
    totals[sample.group] = (totals[sample.group] ?? 0) + loss
    counts[sample.group] = (counts[sample.group] ?? 0) + 1
  }
  return totals.map((total, index) => (counts[index] ? total / counts[index] : 0))
}

/** The accuracy within each group of samples. */
export function groupAccuracies(weights: ClassifierWeights, samples: Sample[], groups: number): number[] {
  const correct = new Array<number>(groups).fill(0)
  const counts = new Array<number>(groups).fill(0)
  for (const sample of samples) {
    counts[sample.group] = (counts[sample.group] ?? 0) + 1
    if (predict(weights, sample.features) === sample.label) correct[sample.group] = (correct[sample.group] ?? 0) + 1
  }
  return correct.map((value, index) => (counts[index] ? value / counts[index] : 0))
}
