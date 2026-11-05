/**
 * Measurement.
 *
 * A benchmark score is a measurement, and a measurement has a standard error.
 * The three questions this module answers are:
 *
 * - how much does the score move when the benchmark is re-run?
 * - how many questions do you need to tell two models apart?
 * - what does contamination do to the number?
 */

import { createRng, normalQuantile } from '@llm-materials/course-core'
import type { Rng } from '@llm-materials/course-core'

/**
 * The standard error of a benchmark score.
 *
 * A score from N binary outcomes with a true pass rate p has variance
 * p(1−p)/N. This is the most important number in evaluation and the one most
 * often left off the leaderboard.
 */
export function scoreStandardError(score: number, questions: number): number {
  if (questions <= 0) return 0
  const p = Math.min(1, Math.max(0, score))
  return Math.sqrt((p * (1 - p)) / questions)
}

/** A confidence interval for a benchmark score. */
export function scoreInterval(
  score: number,
  questions: number,
  confidence = 0.95,
): { low: number; high: number; standardError: number } {
  const standardError = scoreStandardError(score, questions)
  const z = normalQuantile(1 - (1 - confidence) / 2)
  return {
    low: Math.max(0, score - z * standardError),
    high: Math.min(1, score + z * standardError),
    standardError,
  }
}

/**
 * How the interval narrows as the benchmark grows.
 *
 * The width goes as 1/√N, which is the single most useful fact about
 * benchmark design: to halve the interval you need four times as many
 * questions.
 */
export function intervalWidthCurve(
  score: number,
  questionCounts: number[],
  confidence = 0.95,
): { questions: number; width: number; standardError: number }[] {
  return questionCounts.map((questions) => {
    const interval = scoreInterval(score, questions, confidence)
    return {
      questions,
      width: interval.high - interval.low,
      standardError: interval.standardError,
    }
  })
}

/**
 * The number of questions needed to tell two models apart.
 *
 * Two models with true pass rates p₁ and p₂ are compared on the same N
 * questions. The difference in their scores has standard error
 * √(2p(1−p)/N), and the test is significant when the difference exceeds
 * about 1.96 standard errors.
 */
export function questionsNeeded(
  scoreA: number,
  scoreB: number,
  alpha = 0.05,
  power = 0.8,
): number {
  const difference = Math.abs(scoreA - scoreB)
  if (difference <= 0) return Number.POSITIVE_INFINITY
  const zAlpha = normalQuantile(1 - alpha / 2)
  const zBeta = normalQuantile(power)
  const p = (scoreA + scoreB) / 2
  const numerator = zAlpha * Math.sqrt(2 * p * (1 - p)) + zBeta * Math.sqrt(2 * p * (1 - p))
  return Math.ceil((numerator * numerator) / (difference * difference))
}

/**
 * The probability that a benchmark detects a real difference.
 *
 * The power of the test at a given N, given a true difference.
 */
export function detectionPower(
  scoreA: number,
  scoreB: number,
  questions: number,
  alpha = 0.05,
): number {
  const difference = scoreA - scoreB
  const p = (scoreA + scoreB) / 2
  const standardError = Math.sqrt((2 * p * (1 - p)) / questions)
  if (standardError <= 0) return difference === 0 ? alpha : 1
  const zAlpha = normalQuantile(1 - alpha / 2)
  // The statistic is the difference divided by its standard error; under the
  // alternative it is shifted away from zero.
  const shifted = difference / standardError
  return 1 - normalCdf(zAlpha - shifted) + normalCdf(-zAlpha - shifted)
}

function normalCdf(x: number): number {
  // The error function is in the shared core, but this module deliberately
  // keeps its own small implementation so the file stands alone.
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * ax)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax)
  return 0.5 * (1 + sign * y)
}

/* ---------------------------------------------------------- contamination */

/**
 * What contamination does to a score.
 *
 * A benchmark has N questions. A fraction f of them appear in a model's
 * training data, and on those questions the model's score is inflated by a
 * factor `inflation` — it has effectively memorised them. The reported score
 * rises by f × inflation, and the rise is invisible unless you know f.
 */
export interface ContaminationEffect {
  /** The true score, with no contamination. */
  trueScore: number
  /** The reported score, with contamination. */
  reportedScore: number
  /** How much the score was inflated. */
  inflation: number
  /** The number of contaminated questions. */
  contaminatedQuestions: number
  /** The true score of the clean questions only. */
  cleanScore: number
  /** The score on the contaminated questions. */
  contaminatedScore: number
}

export function contaminationEffect(
  trueScore: number,
  questions: number,
  contaminationFraction: number,
  inflation: number,
): ContaminationEffect {
  const contaminatedQuestions = Math.round(questions * contaminationFraction)
  const cleanQuestions = questions - contaminatedQuestions
  const contaminatedScore = Math.min(1, trueScore * inflation)
  const cleanScore = trueScore
  const reportedScore =
    questions === 0
      ? 0
      : (cleanScore * cleanQuestions + contaminatedScore * contaminatedQuestions) / questions
  return {
    trueScore,
    reportedScore,
    inflation: reportedScore - trueScore,
    contaminatedQuestions,
    cleanScore,
    contaminatedScore,
  }
}

/**
 * How much a *ranking* moves under contamination.
 *
 * Contamination is usually differential — one model has seen the benchmark
 * and the others have not — so the effect on the ordering is larger than the
 * effect on any one score.
 */
export function rankingShift(
  cleanScores: number[],
  contaminatedScores: number[],
): { cleanOrder: number[]; contaminatedOrder: number[]; shifted: boolean } {
  const cleanOrder = cleanScores
    .map((score, index) => ({ index, score }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.index)
  const contaminatedOrder = contaminatedScores
    .map((score, index) => ({ index, score }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.index)
  return {
    cleanOrder,
    contaminatedOrder,
    shifted: cleanOrder.join(',') !== contaminatedOrder.join(','),
  }
}

/* ------------------------------------------------------------ simulation */

/**
 * Re-run a benchmark and see how much the score moves.
 *
 * The score is a proportion of successes on N independent questions, and its
 * sampling distribution is binomial. This draws from that distribution
 * directly, so the spread shown is the spread a benchmark actually has.
 */
export function scoreDistribution(
  trueScore: number,
  questions: number,
  draws = 2000,
  seed = 71,
): number[] {
  const rng = createRng(seed)
  const values: number[] = []
  for (let d = 0; d < draws; d++) {
    let successes = 0
    for (let q = 0; q < questions; q++) {
      if (rng() < trueScore) successes++
    }
    values.push(successes / questions)
  }
  return values
}

/**
 * The number of runs needed before two benchmarks agree.
 *
 * The difference of two independent binomial scores has standard error
 * √(2p(1−p)/N); this is the number of repeated runs that brings the
 * difference below a given tolerance.
 */
export function runsNeededForAgreement(
  score: number,
  tolerance: number,
): number {
  const p = Math.min(1, Math.max(0, score))
  const variance = (2 * p * (1 - p)) / 1000
  if (variance <= 0) return 1
  return Math.ceil((1.96 * Math.sqrt(variance)) ** 2 / (tolerance * tolerance))
}

/** A seeded generator, so a laboratory's figures are reproducible. */
export { createRng }
export type { Rng }
