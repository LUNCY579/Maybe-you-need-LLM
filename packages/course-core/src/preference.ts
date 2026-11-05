/**
 * Bradley–Terry preference modelling and Elo.
 *
 * The Bradley–Terry model is the statistical backbone of reward modelling,
 * Chatbot Arena, and most pairwise-preference evaluations. It is included here
 * because more than one course in this collection needs it, and because the
 * maximum-likelihood fit has to be right: a "preference model" whose
 * likelihood is computed with the wrong sign is worse than no model at all.
 */

import { sigmoid, softmax } from './math.js'
import type { Vector } from './math.js'

/** One observed comparison: `winner` beat `loser`. */
export interface Comparison {
  winner: number
  loser: number
  /** Optional weight, e.g. how many votes backed this comparison. */
  weight?: number
}

export interface BradleyTerryFit {
  /** Per-item strength. Higher means preferred more often. */
  strengths: number[]
  /** Log-likelihood of the fitted model. */
  logLikelihood: number
  /** Number of gradient steps taken. */
  iterations: number
  /** Final gradient norm. */
  gradientNorm: number
}

/**
 * Log-likelihood of a Bradley–Terry model under strengths `theta`.
 *
 * Pr(i ≻ j) = sigmoid(theta_i − theta_j), so the log-likelihood is
 * `Σ w · log σ(theta_winner − theta_loser)`.
 */
export function bradleyTerryLogLikelihood(comparisons: Comparison[], theta: Vector): number {
  let total = 0
  for (const { winner, loser, weight = 1 } of comparisons) {
    const p = sigmoid(theta[winner] - theta[loser])
    total += weight * Math.log(Math.max(p, 1e-300))
  }
  return total
}

/**
 * Gradient of the log-likelihood with respect to the strengths.
 *
 * `d/dθ_i = Σ_{i as winner} w(1 − p) − Σ_{i as loser} w·p`.
 */
export function bradleyTerryGradient(comparisons: Comparison[], theta: Vector): Vector {
  const gradient = new Array<number>(theta.length).fill(0)
  for (const { winner, loser, weight = 1 } of comparisons) {
    const p = sigmoid(theta[winner] - theta[loser])
    gradient[winner] += weight * (1 - p)
    gradient[loser] -= weight * p
  }
  return gradient
}

/**
 * Fit a Bradley–Terry model by regularised maximum likelihood.
 *
 * The strengths are identified only up to a constant shift, so the mean is
 * subtracted at the end. A small L2 penalty keeps the fit finite when the
 * comparison graph is disconnected or one item is undefeated.
 */
export function fitBradleyTerry(
  comparisons: Comparison[],
  itemCount: number,
  options: { iterations?: number; learningRate?: number; l2?: number; tolerance?: number } = {},
): BradleyTerryFit {
  const iterations = options.iterations ?? 500
  const learningRate = options.learningRate ?? 0.5
  const l2 = options.l2 ?? 1e-4
  const tolerance = options.tolerance ?? 1e-8

  let theta = new Array<number>(itemCount).fill(0)

  for (let step = 0; step < iterations; step++) {
    const gradient = bradleyTerryGradient(comparisons, theta)
    for (let i = 0; i < itemCount; i++) {
      gradient[i] -= l2 * theta[i]
    }
    const norm = Math.sqrt(gradient.reduce((acc, g) => acc + g * g, 0))
    if (norm < tolerance) break
    theta = theta.map((t, i) => t + learningRate * gradient[i])
  }

  // Remove the arbitrary constant.
  const mean = theta.reduce((acc, t) => acc + t, 0) / Math.max(1, theta.length)
  theta = theta.map((t) => t - mean)

  const gradient = bradleyTerryGradient(comparisons, theta)
  const gradientNorm = Math.sqrt(gradient.reduce((acc, g) => acc + g * g, 0))

  return {
    strengths: theta,
    logLikelihood: bradleyTerryLogLikelihood(comparisons, theta),
    iterations,
    gradientNorm,
  }
}

/**
 * Predict the probability that `a` beats `b` under fitted strengths.
 */
export function preferenceProbability(theta: Vector, a: number, b: number): number {
  return sigmoid(theta[a] - theta[b])
}

/**
 * Fit strengths from a pairwise preference matrix.
 *
 * `wins[i][j]` is the number of times item `i` was preferred to item `j`.
 * Only the upper triangle is used.
 */
export function fitBradleyTerryFromMatrix(wins: number[][]): BradleyTerryFit {
  const n = wins.length
  const comparisons: Comparison[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = wins[i]?.[j] ?? 0
      const b = wins[j]?.[i] ?? 0
      if (a === 0 && b === 0) continue
      if (a >= b) comparisons.push({ winner: i, loser: j, weight: a })
      else comparisons.push({ winner: j, loser: i, weight: b })
    }
  }
  return fitBradleyTerry(comparisons, n)
}

/**
 * A standard Elo rating system.
 *
 * The update is `R' = R + K · S · (E − A)`, where `E` is the expected score
 * and `A` the actual score.
 */
export function eloUpdate(
  ratingA: number,
  ratingB: number,
  scoreA: 0 | 0.5 | 1,
  k = 32,
): { ratingA: number; ratingB: number } {
  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400))
  const expectedB = 1 - expectedA
  return {
    ratingA: ratingA + k * (scoreA - expectedA),
    ratingB: ratingB + k * (1 - scoreA - expectedB),
  }
}

/** Run a full Elo season over a list of matches. */
export function runElo(
  matches: { a: number; b: number; scoreA: 0 | 0.5 | 1 }[],
  itemCount: number,
  k = 32,
  initial = 1500,
): number[] {
  const ratings = new Array<number>(itemCount).fill(initial)
  for (const match of matches) {
    const { ratingA, ratingB } = eloUpdate(ratings[match.a], ratings[match.b], match.scoreA, k)
    ratings[match.a] = ratingA
    ratings[match.b] = ratingB
  }
  return ratings
}

/**
 * Softmax over model scores — the temperature-scaled choice rule used in
 * preference search and in best-of-n sampling.
 */
export function preferenceSoftmax(scores: Vector, temperature = 1): Vector {
  return softmax(scores, temperature)
}
