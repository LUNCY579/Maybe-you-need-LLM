/**
 * The arena.
 *
 * A preference arena collects pairwise comparisons and turns them into a
 * ranking. The two standard ways of doing that are the Bradley–Terry model,
 * which is a maximum-likelihood fit, and Elo, which is an online update rule.
 * Both are here, and both are fitted to votes that were actually generated.
 */

import { createRng, normalQuantile } from '@llm-materials/course-core'
import {
  fitBradleyTerryFromMatrix,
  runElo,
} from '@llm-materials/course-core'
import type { Answer, JudgeBiases, ModelProfile, Question } from './setting.js'
import { judgePreference } from './setting.js'

/** A vote matrix: `wins[i][j]` is the number of times i was preferred to j. */
export type WinsMatrix = number[][]

export interface VoteSummary {
  /** The win matrix. */
  wins: WinsMatrix
  /** The total number of votes cast. */
  totalVotes: number
  /** How many votes each pair received. */
  votesPerPair: number
  /** How many comparisons were contested. */
  contestedPairs: number
}

/**
 * Run an arena.
 *
 * Every pair of models is compared on every question, a fixed number of times,
 * with the positions randomised. The result is the win matrix and the number
 * of votes it took.
 */
export function runArena(
  models: ModelProfile[],
  questions: Question[],
  answers: Answer[],
  biases: JudgeBiases,
  votesPerPair = 1,
  seed = 41,
): VoteSummary {
  const rng = createRng(seed)
  const answerOf = (modelId: string, questionId: string) =>
    answers.find((answer) => answer.modelId === modelId && answer.questionId === questionId)!

  const index = new Map(models.map((model, i) => [model.id, i]))
  const wins: WinsMatrix = models.map(() => new Array<number>(models.length).fill(0))
  let totalVotes = 0
  let contestedPairs = 0

  for (const question of questions) {
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const answerA = answerOf(models[i].id, question.id)
        const answerB = answerOf(models[j].id, question.id)
        if (Math.abs(answerA.trueQuality - answerB.trueQuality) > 0.25) {
          // A pair this far apart is not worth contesting; real arenas skip
          // obvious comparisons for exactly this reason.
          continue
        }
        contestedPairs++
        for (let v = 0; v < votesPerPair; v++) {
          const firstIsA = rng() < 0.5
          const result = firstIsA
            ? judgePreference(answerA, answerB, 'first', biases, rng)
            : judgePreference(answerB, answerA, 'first', biases, rng)
          const winnerIndex = result.winner === 'A' ? (firstIsA ? i : j) : firstIsA ? j : i
          const loserIndex = winnerIndex === i ? j : i
          wins[index.get(models[winnerIndex].id)!][index.get(models[loserIndex].id)!]++
          totalVotes++
        }
      }
    }
  }

  return { wins, totalVotes, votesPerPair, contestedPairs }
}

export interface ArenaRanking {
  /** The model ids, best first. */
  order: string[]
  /** The fitted strength for each model. */
  strengths: number[]
  /** The log-likelihood of the fit. */
  logLikelihood: number
}

/** Fit a Bradley–Terry model to a set of votes. */
export function rankWithBradleyTerry(models: ModelProfile[], wins: WinsMatrix): ArenaRanking {
  const fit = fitBradleyTerryFromMatrix(wins)
  const order = models
    .map((model, index) => ({ id: model.id, strength: fit.strengths[index] }))
    .sort((a, b) => b.strength - a.strength)
    .map((entry, position) => ({ id: entry.id, strength: entry.strength, position }))
  return {
    order: order.map((entry) => entry.id),
    strengths: order.map((entry) => entry.strength),
    logLikelihood: fit.logLikelihood,
  }
}

/**
 * Bootstrap confidence intervals on the ranking.
 *
 * The votes are resampled with replacement, the model is refitted, and the
 * spread of the resulting strengths is the uncertainty. This is the interval
 * an arena should print next to its leaderboard, and most do not.
 */
export interface RankingInterval {
  modelId: string
  strength: number
  low: number
  high: number
  /** How often the model came first across the bootstrap samples. */
  topProbability: number
}

export function bootstrapRanking(
  models: ModelProfile[],
  wins: WinsMatrix,
  resamples = 400,
  seed = 53,
): RankingInterval[] {
  const rng = createRng(seed)
  const n = models.length
  const samples: number[][] = []

  for (let r = 0; r < resamples; r++) {
    // Resample each pair's votes with replacement.
    const resampled: WinsMatrix = Array.from({ length: n }, () => new Array<number>(n).fill(0))
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const forward = wins[i][j]
        const backward = wins[j][i]
        const total = forward + backward
        if (total === 0) continue
        let drawnForward = 0
        for (let v = 0; v < total; v++) {
          if (rng() < forward / total) drawnForward++
        }
        resampled[i][j] = drawnForward
        resampled[j][i] = total - drawnForward
      }
    }
    const fit = fitBradleyTerryFromMatrix(resampled)
    samples.push(fit.strengths)
  }

  const base = rankWithBradleyTerry(models, wins)

  return base.order.map((modelId, position) => {
    const modelIndex = models.findIndex((model) => model.id === modelId)
    const column = samples.map((sample) => sample[modelIndex]).sort((a, b) => a - b)
    const low = column[Math.floor(0.025 * (column.length - 1))]
    const high = column[Math.ceil(0.975 * (column.length - 1))]
    const topCount = samples.filter((sample) => {
      let best = 0
      for (let i = 1; i < sample.length; i++) if (sample[i] > sample[best]) best = i
      return best === modelIndex
    }).length
    return {
      modelId,
      strength: base.strengths[position],
      low,
      high,
      topProbability: samples.length === 0 ? 0 : topCount / samples.length,
    }
  })
}

/**
 * How accurate a ranking is.
 *
 * The fraction of contested pairs the ranking orders correctly, measured
 * against the true ordering of the answers.
 */
export function rankingAccuracy(
  models: ModelProfile[],
  ranking: ArenaRanking,
  answers: Answer[],
  questions: Question[],
): { correct: number; total: number; accuracy: number } {
  const position = new Map(ranking.order.map((id, index) => [id, index]))
  let correct = 0
  let total = 0

  for (const question of questions) {
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const answerA = answers.find((a) => a.modelId === models[i].id && a.questionId === question.id)
        const answerB = answers.find((a) => a.modelId === models[j].id && a.questionId === question.id)
        if (!answerA || !answerB) continue
        if (Math.abs(answerA.trueQuality - answerB.trueQuality) <= 0.02) continue
        total++
        const betterFirst =
          answerA.trueQuality > answerB.trueQuality ? models[i].id : models[j].id
        if ((position.get(betterFirst) ?? 99) < (position.get(betterFirst === models[i].id ? models[j].id : models[i].id) ?? 99)) {
          correct++
        }
      }
    }
  }

  return { correct, total, accuracy: total === 0 ? 0 : correct / total }
}

/**
 * The Elo season over the same votes.
 *
 * Every vote is an online update, so the rating depends on the order the
 * votes arrived in. Running the same votes in a different order gives a
 * different season — which is why Elo ratings are not confidence intervals.
 */
export function runArenaElo(
  models: ModelProfile[],
  wins: WinsMatrix,
  k = 32,
  seed = 61,
): { ratings: number[]; order: string[] } {
  const rng = createRng(seed)
  const index = new Map(models.map((model, i) => [model.id, i]))

  // Flatten the votes into a list of matches, then shuffle it.
  const matches: { a: number; b: number; scoreA: 0 | 0.5 | 1 }[] = []
  for (let i = 0; i < models.length; i++) {
    for (let j = i + 1; j < models.length; j++) {
      for (let v = 0; v < wins[i][j]; v++) matches.push({ a: i, b: j, scoreA: 1 })
      for (let v = 0; v < wins[j][i]; v++) matches.push({ a: i, b: j, scoreA: 0 })
    }
  }
  for (let i = matches.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = matches[i]
    matches[i] = matches[j]
    matches[j] = tmp
  }

  const ratings = runElo(matches, models.length, k)
  const order = models
    .map((model, i) => ({ id: model.id, rating: ratings[i] }))
    .sort((a, b) => b.rating - a.rating)
    .map((entry) => entry.id)
  void index
  return { ratings, order }
}

export interface RankingStability {
  /** The number of subsets the full ranking was compared with. */
  draws: number
  /** How often a subset kept the full set's top model. */
  sameTop: number
  /** The mean share of model pairs ordered the same as the full ranking. */
  meanAgreement: number
}

/**
 * How much the ranking depends on which questions happened to be in the set.
 *
 * The full question set produces one ranking. Each draw takes half the
 * questions, runs the same arena on them, and compares the result with the
 * full ranking: whether the top model survived, and how many model pairs kept
 * their order. A fixed evaluation set is a choice, and this is the size of the
 * choice.
 */
export function rankingStability(
  models: ModelProfile[],
  questions: Question[],
  answers: Answer[],
  biases: JudgeBiases,
  options: { draws?: number; seed?: number; fraction?: number } = {},
): RankingStability {
  const settings = { draws: 24, seed: 71, fraction: 0.5, ...options }
  const full = rankWithBradleyTerry(
    models,
    runArena(models, questions, answers, biases, 1, settings.seed).wins,
  )
  const fullPosition = new Map(full.order.map((id, index) => [id, index]))
  let sameTop = 0
  let totalAgreement = 0

  for (let draw = 0; draw < settings.draws; draw++) {
    const rng = createRng(settings.seed + draw * 17)
    const shuffled = [...questions]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = shuffled[i]
      shuffled[i] = shuffled[j]
      shuffled[j] = tmp
    }
    const subset = shuffled.slice(0, Math.max(4, Math.round(shuffled.length * settings.fraction)))
    const partial = rankWithBradleyTerry(
      models,
      runArena(models, subset, answers, biases, 1, settings.seed + draw * 17 + 1).wins,
    )
    if (partial.order[0] === full.order[0]) sameTop++
    let pairs = 0
    let agree = 0
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const a = models[i].id
        const b = models[j].id
        const partialBefore = partial.order.indexOf(a) < partial.order.indexOf(b)
        const fullBefore = (fullPosition.get(a) ?? 0) < (fullPosition.get(b) ?? 0)
        pairs++
        if (partialBefore === fullBefore) agree++
      }
    }
    totalAgreement += pairs === 0 ? 0 : agree / pairs
  }

  return { draws: settings.draws, sameTop, meanAgreement: totalAgreement / settings.draws }
}

/**
 * How many votes it takes to tell two models apart.
 *
 * A pairwise comparison between two models of equal true quality is a coin
 * flip; one between models that differ by `delta` in true quality is won by
 * the better model with a probability given by the Bradley–Terry model. The
 * number of votes needed to be confident the better model really is better is
 * then a function of the delta, the confidence and the expected margin.
 */
export function votesToSeparate(
  delta: number,
  expectedWinRate: number,
  votes: number,
): { lowerBound: number; upperBound: number; separated: boolean; expectedMargin: number } {
  // A normal approximation to the number of wins in `votes` comparisons.
  const mean = votes * expectedWinRate
  const sd = Math.sqrt(votes * expectedWinRate * (1 - expectedWinRate))
  const lower = mean - 1.96 * sd
  const upper = mean + 1.96 * sd
  // The better model is established when the lower bound is above half the votes.
  return {
    lowerBound: lower,
    upperBound: upper,
    separated: lower > votes / 2,
    expectedMargin: votes * (expectedWinRate - 0.5) * 2 * Math.tanh(delta / 2),
  }
}

/** The probability that the better model wins a single comparison. */
export function pairwiseWinProbability(delta: number): number {
  // Bradley–Terry with strengths differing by delta: p = σ(delta).
  return 1 / (1 + Math.exp(-delta))
}

/**
 * The number of votes needed to detect a difference of `delta` between two
 * models, at a given confidence and power.
 *
 * The variance of the difference between two independent win proportions is
 * 2p(1−p)/n, so the sample size follows from a normal approximation.
 */
export function votesNeeded(delta: number, alpha = 0.05, power = 0.8): number {
  const p = pairwiseWinProbability(delta)
  const zAlpha = normalQuantile(1 - alpha / 2)
  const zBeta = normalQuantile(power)
  const numerator = zAlpha * Math.sqrt(2 * p * (1 - p)) + zBeta * Math.sqrt(p * (1 - p) + 0.25)
  return Math.ceil((numerator * numerator) / (delta * delta * 0.5))
}
