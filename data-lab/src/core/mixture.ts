/**
 * Data mixtures.
 *
 * A mixture is a policy over domains: how many tokens from each domain the
 * model will see. The paper this course is built on does two things with that
 * policy. It finds the mixture that minimises the *worst* domain's loss, using
 * group distributionally robust optimisation; and it fits a linear model of
 * each domain's excess loss as a function of its weight, so that the mixture
 * can be solved for directly.
 *
 * Both steps are implemented here on the synthetic corpus, and both are
 * checked against a model that was actually trained.
 */

import { ols, type Vector } from '@llm-materials/course-core'
import { DOMAINS, DOMAIN_INDEX, type Corpus, type Document } from './corpus'
import { groupLosses, trainClassifier, type Sample, type TrainingOptions } from './model'
import { splitCorpus, toSamples } from './filters'

export interface MixtureWeights {
  /** The weight of each domain, summing to one. */
  weights: number[]
}

/** Draw a sample set from a corpus with the given mixture. */
export function drawMixture(documents: Document[], weights: number[], size: number, seed: number): Document[] {
  const drawn: Document[] = []
  const byDomain: Document[][] = DOMAINS.map(() => [])
  for (const document of documents) byDomain[DOMAIN_INDEX[document.domain]]!.push(document)

  // A small deterministic shuffle, so that the same seed gives the same draw.
  let state = seed * 2654435761 + 1
  const next = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }

  for (let i = 0; i < size; i++) {
    const u = next()
    let cumulative = 0
    let chosen = DOMAINS.length - 1
    for (let d = 0; d < weights.length; d++) {
      cumulative += weights[d] ?? 0
      if (u <= cumulative) {
        chosen = d
        break
      }
    }
    const pool = byDomain[chosen]!
    if (pool.length === 0) continue
    drawn.push(pool[Math.floor(next() * pool.length)]!)
  }
  return drawn
}

/** The natural mixture of a corpus: the fraction of documents from each domain. */
export function naturalMixture(documents: Document[]): number[] {
  const counts = new Array<number>(DOMAINS.length).fill(0)
  for (const document of documents) counts[DOMAIN_INDEX[document.domain]] = (counts[DOMAIN_INDEX[document.domain]] ?? 0) + 1
  const total = documents.length || 1
  return counts.map((count) => count / total)
}

/** A mixture with the given weight on one domain and the rest shared equally. */
export function mixtureWith(domain: number, weight: number): number[] {
  const rest = (1 - weight) / (DOMAINS.length - 1)
  return DOMAINS.map((_, index) => (index === domain ? weight : rest))
}

/** What a group-DRO run leaves behind. */
export interface GroupDroResult {
  /** The final group weights. */
  weights: number[]
  /** The worst-group loss at each round. */
  worstLossHistory: number[]
  /** The mean group loss at each round. */
  meanLossHistory: number[]
  /** The final per-group losses. */
  groupLosses: number[]
}

/**
 * Group-DRO as a data-mixture objective.
 *
 * DoReMi's first half: hold a weight per domain, train, raise each weight in
 * proportion to how badly its group is doing, renormalise, repeat. The promise is
 * that the weights come to equalise the excess loss, and that the mixture they
 * converge to beats the natural mixture on the domain that was worst.
 *
 * On the seed-17, 400-document corpus with these defaults — the fixture
 * `mixture.test.ts` asserts — the promise holds in the direction it is stated and
 * breaks in the details. The exponent `eta` is the strength of the reweighting:
 * zero leaves the natural mixture exactly where it was, one is what this corpus
 * wants, and a large value chases the worst group alone.
 *
 * - the worst held-out domain's loss falls from 0.5605 to 0.5046 while the mean
 *   falls only from 0.4016 to 0.3983, which is the whole point of optimising the
 *   worst group rather than the average; overall accuracy goes the other way,
 *   0.875 to 0.8583;
 * - the loss spread is smallest at `eta = 1`, not at the largest exponent: 0.1532
 *   at eta 0, 0.0646 at eta 1, 0.2277 at eta 4, where one domain takes 47% of the
 *   corpus and another 1.7%;
 * - the per-round curve is not a descent. The last round beats the first on the
 *   worst and the mean loss, but three of the seven steps between them rise,
 *   because every round trains a fresh model on a fresh draw of the same size.
 *
 * `solveOptimalMixture` below is the weakest link, and is left in precisely
 * because of that.
 */
export function groupDroMixture(
  corpus: Corpus,
  options: {
    eta?: number
    rounds?: number
    stepsPerRound?: number
    sampleSize?: number
    seed?: number
    training?: TrainingOptions
  } = {},
): GroupDroResult {
  const settings = {
    eta: 1.0,
    rounds: 8,
    stepsPerRound: 60,
    sampleSize: 260,
    seed: 5,
    training: { steps: 200, learningRate: 0.5 } as TrainingOptions,
    ...options,
  }

  const { train } = splitCorpus(corpus, 0.3)
  const groups = DOMAINS.length
  const weights = naturalMixture(train)
  const worstLossHistory: number[] = []
  const meanLossHistory: number[] = []
  let groupLoss = new Array<number>(groups).fill(0)

  for (let round = 0; round < settings.rounds; round++) {
    const drawn = drawMixture(train, weights, settings.sampleSize, settings.seed + round)
    const samples = toSamples(drawn, corpus)
    const trained = trainClassifier(samples, corpus.topics, corpus.vocabulary, settings.training)
    groupLoss = groupLosses(trained.weights, samples, groups)

    const worst = Math.max(...groupLoss)
    const mean = groupLoss.reduce((a, b) => a + b, 0) / groups
    worstLossHistory.push(worst)
    meanLossHistory.push(mean)

    // The exponentiated-gradient update: raise the weight of the group whose
    // excess loss is largest, and renormalise.
    if (round < settings.rounds - 1) {
      const updated = weights.map((weight, index) => weight * Math.exp(settings.eta * ((groupLoss[index] ?? 0) - mean)))
      const total = updated.reduce((a, b) => a + b, 0) || 1
      for (let i = 0; i < groups; i++) weights[i] = (updated[i] ?? 0) / total
    }
  }

  return { weights, worstLossHistory, meanLossHistory, groupLosses: groupLoss }
}

/* -------------------------------------------------------------------------- */
/* The linear model of the excess loss                                        */
/* -------------------------------------------------------------------------- */

export interface PerDomainModel {
  /** The slope: how much the domain's loss rises per unit of weight. */
  a: number
  /** The intercept: the domain's loss at zero weight. */
  b: number
}

/**
 * Fit each domain's excess loss as a linear function of its weight.
 *
 * The fit is done by training a model on several mixtures that differ only in
 * one domain's weight, and regressing the measured loss on the weight. This is
 * the step that makes the mixture solvable in closed form.
 */
export function fitPerDomainModels(
  corpus: Corpus,
  options: { points?: number; maxWeight?: number; sampleSize?: number; seed?: number; training?: TrainingOptions } = {},
): PerDomainModel[] {
  const settings = {
    points: 3,
    maxWeight: 0.6,
    sampleSize: 240,
    seed: 11,
    training: { steps: 200, learningRate: 0.5 } as TrainingOptions,
    ...options,
  }
  const { train, test } = splitCorpus(corpus, 0.3)
  const testSamples = toSamples(test, corpus)

  const models: PerDomainModel[] = []
  for (let domain = 0; domain < DOMAINS.length; domain++) {
    const xs: number[] = []
    const ys: number[] = []
    for (let p = 0; p < settings.points; p++) {
      const weight = ((p + 1) * settings.maxWeight) / (settings.points + 1)
      const mixture = mixtureWith(domain, weight)
      const drawn = drawMixture(train, mixture, settings.sampleSize, settings.seed + domain * 17 + p)
      const trained = trainClassifier(toSamples(drawn, corpus), corpus.topics, corpus.vocabulary, settings.training)
      const losses = groupLosses(trained.weights, testSamples, DOMAINS.length)
      xs.push(weight)
      ys.push(losses[domain] ?? 0)
    }
    const fit = ols(
      xs.map((x) => [x]),
      ys,
    )
    models.push({ a: fit.coefficients[1] ?? 0, b: fit.coefficients[0] ?? 0 })
  }
  return models
}

/**
 * Solve the mixture problem in closed form.
 *
 * We minimise the worst domain's loss subject to the weights summing to one.
 * With the linear model L_d(w) = a_d w + b_d, the solution equalises the
 * active domains: for a given level `lambda`, the best weight for domain d is
 * max(0, (lambda - b_d) / a_d), and the level is the one for which the
 * weights sum to one.
 *
 * The formula needs a_d to be positive — more of a domain must make its loss
 * worse — and the fits from `fitPerDomainModels` do not oblige: three of the five
 * slopes measured on this corpus are negative (0.1325, −0.1766, −0.034, −0.182,
 * 0.0183). Dividing by `Math.max(a, 1e-9)` then hands the solver a domain whose
 * loss *falls* with weight and it spends 90% of the corpus there, predicts a worst
 * loss of 0.5882, and measures 0.5171. That mixture is better than the natural one
 * on the worst domain and worse on the mean (0.4288 against 0.4016) and on the
 * accuracy. The screen shows the prediction and the measurement side by side.
 */
export function solveOptimalMixture(models: PerDomainModel[]): { weights: number[]; worstLoss: number } {
  const lower = Math.min(...models.map((model) => model.b))
  const upper = Math.max(...models.map((model) => model.b + model.a))

  let low = lower
  let high = upper
  for (let iteration = 0; iteration < 200; iteration++) {
    const lambda = (low + high) / 2
    const weights = models.map((model) => Math.max(0, (lambda - model.b) / Math.max(model.a, 1e-9)))
    const total = weights.reduce((a, b) => a + b, 0)
    if (total > 1) high = lambda
    else low = lambda
  }

  const lambda = (low + high) / 2
  const raw = models.map((model) => Math.max(0, (lambda - model.b) / Math.max(model.a, 1e-9)))
  const total = raw.reduce((a, b) => a + b, 0) || 1
  const weights = raw.map((weight) => weight / total)
  const worstLoss = Math.max(...models.map((model, index) => model.a * (weights[index] ?? 0) + model.b))
  return { weights, worstLoss }
}

/* -------------------------------------------------------------------------- */
/* The comparison                                                             */
/* -------------------------------------------------------------------------- */

export interface MixtureComparison {
  name: string
  weights: number[]
  /** The loss of each domain on the held-out set. */
  perDomainLoss: number[]
  /** The worst domain's loss. */
  worstLoss: number
  /** The mean domain's loss. */
  meanLoss: number
  /** The accuracy on the held-out set. */
  accuracy: number
}

/**
 * Train a model on each candidate mixture and measure it on the same held-out
 * set, so that the comparison is between mixtures and nothing else.
 */
export function compareMixtures(
  corpus: Corpus,
  candidates: { name: string; weights: number[] }[],
  options: { sampleSize?: number; seed?: number; training?: TrainingOptions } = {},
): MixtureComparison[] {
  const settings = {
    sampleSize: 260,
    seed: 23,
    training: { steps: 220, learningRate: 0.5 } as TrainingOptions,
    ...options,
  }
  const { train, test } = splitCorpus(corpus, 0.3)
  const testSamples = toSamples(test, corpus)

  return candidates.map((candidate, index) => {
    const drawn = drawMixture(train, candidate.weights, settings.sampleSize, settings.seed + index)
    const trained = trainClassifier(toSamples(drawn, corpus), corpus.topics, corpus.vocabulary, settings.training)
    const losses = groupLosses(trained.weights, testSamples, DOMAINS.length)
    const correct = testSamples.filter((sample) => predictedLabel(trained.weights, sample) === sample.label).length
    return {
      name: candidate.name,
      weights: candidate.weights,
      perDomainLoss: losses,
      worstLoss: Math.max(...losses),
      meanLoss: losses.reduce((a, b) => a + b, 0) / losses.length,
      accuracy: testSamples.length === 0 ? 0 : correct / testSamples.length,
    }
  })
}

function predictedLabel(weights: { w: number[][]; b: number[] }, sample: Sample): number {
  const classes = weights.w.length
  let best = 0
  let bestScore = -Infinity
  for (let c = 0; c < classes; c++) {
    let score = weights.b[c] ?? 0
    const row = weights.w[c]!
    for (let f = 0; f < sample.features.length; f++) score += (row[f] ?? 0) * (sample.features[f] ?? 0)
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

/** The excess loss of each domain under the optimal mixture. */
export function excessLosses(models: PerDomainModel[], weights: Vector): number[] {
  return models.map((model, index) => model.a * (weights[index] ?? 0) + model.b)
}
