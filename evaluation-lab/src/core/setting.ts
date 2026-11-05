/**
 * The evaluation setting.
 *
 * The question this course has to answer is: what does a benchmark number
 * mean? The honest way to study that is to build a setting where the truth is
 * known, and to measure how far the measurements drift from it.
 *
 * So this module builds a synthetic world with:
 *
 * - a set of **models**, each with a known quality and a known verbosity;
 * - a set of **questions**, each with a known difficulty;
 * - **answers**, whose true quality is a draw from a known distribution;
 * - a **human**, who prefers the more useful answer, with a little noise;
 * - and a **judge**, a model asked to prefer one of two answers, with biases
 *   that are *injected and known*: a preference for the first position, a
 *   preference for longer answers, and a preference for its own family.
 *
 * Because the truth is known here, the biases can be measured exactly rather
 * than estimated. That is the whole point of the laboratory: it is a
 * measuring instrument for bias, not a claim about any real judge.
 */

import { createRng, gaussian } from '@llm-materials/course-core'
import type { Rng } from '@llm-materials/course-core'

/* ------------------------------------------------------------------ models */

export interface ModelProfile {
  id: string
  name: string
  /** The model's true quality, on a scale where 1 is perfect. */
  quality: number
  /** How verbose its answers are, in relative units. */
  verbosity: number
  /** The family it belongs to. A judge is biased towards its own family. */
  family: string
  /** Whether the judge belongs to this family. */
  isJudgeFamily?: boolean
}

export const MODELS: ModelProfile[] = [
  { id: 'atlas', name: 'Atlas', quality: 0.88, verbosity: 1.15, family: 'Meridian', isJudgeFamily: true },
  { id: 'beacon', name: 'Beacon', quality: 0.81, verbosity: 1.35, family: 'Cobalt' },
  { id: 'cinder', name: 'Cinder', quality: 0.74, verbosity: 0.8, family: 'Cobalt' },
  { id: 'delta', name: 'Delta', quality: 0.68, verbosity: 1.0, family: 'Meridian' },
  { id: 'ember', name: 'Ember', quality: 0.57, verbosity: 1.45, family: 'Cobalt' },
  { id: 'flint', name: 'Flint', quality: 0.46, verbosity: 0.7, family: 'Meridian' },
]

export function modelById(id: string): ModelProfile {
  const found = MODELS.find((model) => model.id === id)
  if (!found) throw new Error(`modelById: no model with the id ${id}`)
  return found
}

/* --------------------------------------------------------------- questions */

export interface Question {
  id: string
  prompt: string
  /** How hard it is, on the same 0–1 scale. A harder question lowers every answer. */
  difficulty: number
  /** Whether this question appears in the training data of some models. */
  contaminated?: boolean
}

const PROMPTS = [
  'Explain why the sky appears blue.',
  'Write a Python function that reverses a linked list.',
  'Summarise the causes of the 1929 stock market crash.',
  'Derive the closed form for the variance of a sample mean.',
  'Describe the difference between a process and a thread.',
  'What is the time complexity of quicksort, and when is it worst?',
  'Explain the trolley problem and name its two horns.',
  'Write a SQL query that finds the second-highest salary.',
  'Outline the main provisions of the Treaty of Versailles.',
  'Explain what a p-value is, and what it is not.',
  'Prove that every finite group has a subgroup of every divisor order.',
  'Describe how a heat pump moves heat from cold to hot.',
]

export function buildQuestions(count: number, seed = 5, contaminationFraction = 0): Question[] {
  const rng = createRng(seed)
  const contaminatedCount = Math.round(count * contaminationFraction)
  return Array.from({ length: count }, (_, index) => ({
    id: `q${index + 1}`,
    prompt: PROMPTS[index % PROMPTS.length],
    difficulty: 0.15 + 0.7 * rng(),
    contaminated: index < contaminatedCount,
  }))
}

/* ----------------------------------------------------------------- answers */

export interface Answer {
  modelId: string
  questionId: string
  /** The answer's true usefulness. The human judges on this, approximately. */
  trueQuality: number
  /** Its length, in relative units. */
  length: number
  /** The text shown to the judge. */
  text: string
}

/**
 * Draw the answer a model would give to a question.
 *
 * The quality is the model's quality, reduced by the question's difficulty and
 * perturbed by a draw; the length is the model's verbosity times a draw.
 */
export function sampleAnswer(model: ModelProfile, question: Question, rng: Rng): Answer {
  const difficultyPenalty = question.difficulty * 0.35
  const trueQuality = Math.max(0, Math.min(1, model.quality - difficultyPenalty + gaussian(rng) * 0.12))
  const length = Math.max(0.2, model.verbosity * (0.85 + rng() * 0.3))

  const sentences = Math.max(1, Math.round(length * 3))
  const text = Array.from({ length: sentences }, () => 'The answer continues with a relevant sentence.').join(' ')

  return { modelId: model.id, questionId: question.id, trueQuality, length, text }
}

/** Every model's answer to every question, in a fixed order. */
export function buildAnswers(models: ModelProfile[], questions: Question[], seed = 11): Answer[] {
  const rng = createRng(seed)
  const answers: Answer[] = []
  for (const question of questions) {
    for (const model of models) {
      answers.push(sampleAnswer(model, question, rng))
    }
  }
  return answers
}

/* ------------------------------------------------------------------- judge */

export interface JudgeBiases {
  /** How strongly the judge prefers the answer in the first position. */
  positionBias: number
  /** How strongly the judge prefers the longer answer. */
  verbosityBias: number
  /** How strongly the judge prefers answers from its own family. */
  selfPreference: number
  /** The standard deviation of the judge's own noise. */
  noise: number
}

export const NEUTRAL_JUDGE: JudgeBiases = {
  positionBias: 0,
  verbosityBias: 0,
  selfPreference: 0,
  noise: 0.05,
}

/**
 * The bias that a position swap produces.
 *
 * When the answers are swapped, the first-position preference now favours
 * what used to be second. The magnitude is the same; the sign flips.
 */
export function positionEffect(position: 'first' | 'second', biases: JudgeBiases): number {
  return biases.positionBias * (position === 'first' ? 1 : -1)
}

/**
 * What the judge prefers.
 *
 * The judge's score for an answer is its true usefulness, plus the three
 * biases, plus noise. Whichever answer scores higher wins.
 *
 * The self-preference term is asymmetric on purpose: an answer from the
 * judge's own family gets a bonus and an answer from another family does not.
 * If both answers got the same bonus the effect would cancel exactly, which
 * is not what the bias is.
 */
export function judgePreference(
  answerA: Answer,
  answerB: Answer,
  positionOfA: 'first' | 'second',
  biases: JudgeBiases,
  rng: Rng,
): { winner: 'A' | 'B'; scoreA: number; scoreB: number } {
  const familyBonusA = biases.selfPreference * (isJudgeFamily(answerA.modelId) ? 1 : 0)
  const familyBonusB = biases.selfPreference * (isJudgeFamily(answerB.modelId) ? 1 : 0)

  const scoreA =
    answerA.trueQuality +
    positionEffect(positionOfA, biases) +
    biases.verbosityBias * (answerA.length - answerB.length) +
    familyBonusA +
    gaussian(rng) * biases.noise

  const scoreB =
    answerB.trueQuality -
    positionEffect(positionOfA, biases) -
    biases.verbosityBias * (answerA.length - answerB.length) +
    familyBonusB +
    gaussian(rng) * biases.noise

  return { winner: scoreA > scoreB ? 'A' : 'B', scoreA, scoreB }
}

/** Whether a model's answers come from the judge's own family. */
export function isJudgeFamily(modelId: string): boolean {
  return MODELS.find((model) => model.id === modelId)?.isJudgeFamily === true
}

/**
 * What the human prefers.
 *
 * The human reads the answer's true usefulness, with a little noise of their
 * own. They have no position bias and no verbosity bias, and no family
 * preference.
 */
export function humanPreference(
  answerA: Answer,
  answerB: Answer,
  rng: Rng,
): 'A' | 'B' {
  const scoreA = answerA.trueQuality + gaussian(rng) * 0.08
  const scoreB = answerB.trueQuality + gaussian(rng) * 0.08
  return scoreA > scoreB ? 'A' : 'B'
}

/* ------------------------------------------------------------ measurements */

export interface BiasMeasurement {
  /** How often the judge's choice matches the human's. */
  agreement: number
  /** How often the human and the judge agree when the positions are swapped. */
  consistency: number
  /** How often the judge's choice differs from the human's. */
  disagreement: number
  /** The number of pairs that were judged. */
  pairs: number
}

/**
 * Measure a judge's agreement with the human, and its consistency.
 *
 * Agreement is over randomly ordered pairs. Consistency is measured by
 * judging the *same* pair twice with the positions swapped: a judge with no
 * position bias agrees with itself every time, and a judge with a strong
 * position bias does not.
 */
export function measureJudge(
  models: ModelProfile[],
  questions: Question[],
  answers: Answer[],
  biases: JudgeBiases,
  seed = 17,
  pairsPerQuestion = 3,
): BiasMeasurement {
  const rng = createRng(seed)
  const answerOf = (modelId: string, questionId: string) =>
    answers.find((answer) => answer.modelId === modelId && answer.questionId === questionId)!

  let agreements = 0
  let consistencies = 0
  let judged = 0

  for (const question of questions) {
    for (let p = 0; p < pairsPerQuestion; p++) {
      const i = Math.floor(rng() * models.length)
      let j = Math.floor(rng() * models.length)
      if (j === i) j = (j + 1) % models.length

      const answerA = answerOf(models[i].id, question.id)
      const answerB = answerOf(models[j].id, question.id)

      const human = humanPreference(answerA, answerB, rng)
      const judgedOnce = judgePreference(answerA, answerB, 'first', biases, rng)
      const judgedSwapped = judgePreference(answerB, answerA, 'first', biases, rng)

      if (judgedOnce.winner === human) agreements++
      // The same pair, presented the other way round: did the judge pick the
      // same *answer*?
      const swappedWinner = judgedSwapped.winner === 'A' ? 'B' : 'A'
      if (swappedWinner === judgedOnce.winner) consistencies++
      judged++
    }
  }

  return {
    agreement: judged === 0 ? 0 : agreements / judged,
    consistency: judged === 0 ? 0 : consistencies / judged,
    disagreement: judged === 0 ? 0 : 1 - agreements / judged,
    pairs: judged,
  }
}

/**
 * The position bias, measured directly.
 *
 * The pairs are *constructed* rather than searched for: a twin of the answer
 * is made with exactly the same true usefulness and a different length, so
 * the position is the only thing that can decide. The position of the
 * original is randomised, and the rate at which the first answer wins is
 * the measurement. With no position bias the rate is one half.
 */
export function measurePositionBias(
  models: ModelProfile[],
  questions: Question[],
  answers: Answer[],
  biases: JudgeBiases,
  seed = 23,
): { firstPreferred: number; total: number; rate: number } {
  const rng = createRng(seed)
  const answerOf = (modelId: string, questionId: string) =>
    answers.find((answer) => answer.modelId === modelId && answer.questionId === questionId)!

  let firstPreferred = 0
  let total = 0

  for (const question of questions) {
    for (const model of models) {
      const original = answerOf(model.id, question.id)
      // A twin with exactly the same usefulness, so the position decides.
      const twin: Answer = {
        ...original,
        length: original.length + 0.5,
        text: `${original.text} An additional clause, of identical usefulness.`,
      }

      const originalFirst = rng() < 0.5
      const result = originalFirst
        ? judgePreference(original, twin, 'first', biases, rng)
        : judgePreference(twin, original, 'first', biases, rng)

      // In both cases the answer named by the result is the one in the first
      // position: when the original went first it is A, and when the twin
      // went first it is A too.
      if (result.winner === 'A') firstPreferred++
      total++
    }
  }

  return { firstPreferred, total, rate: total === 0 ? 0.5 : firstPreferred / total }
}

/**
 * The verbosity bias, measured the same way.
 *
 * The pairs are twins with identical usefulness, and the twin is the longer
 * one. The rate at which the longer answer wins is the measurement; with no
 * verbosity bias it is one half.
 */
export function measureVerbosityBias(
  models: ModelProfile[],
  questions: Question[],
  answers: Answer[],
  biases: JudgeBiases,
  seed = 29,
): { longerPreferred: number; total: number; rate: number } {
  const rng = createRng(seed)
  const answerOf = (modelId: string, questionId: string) =>
    answers.find((answer) => answer.modelId === modelId && answer.questionId === questionId)!

  let longerPreferred = 0
  let total = 0

  for (const question of questions) {
    for (const model of models) {
      const original = answerOf(model.id, question.id)
      const longer: Answer = {
        ...original,
        length: original.length + 0.6,
        text: `${original.text} And some more, of exactly the same usefulness.`,
      }

      const result = judgePreference(original, longer, 'first', biases, rng)
      if (result.winner === 'B') longerPreferred++
      total++
    }
  }

  return { longerPreferred, total, rate: total === 0 ? 0.5 : longerPreferred / total }
}

/**
 * The self-preference bias, measured against the human.
 *
 * Compare the judge's agreement with the human on pairs where one answer
 * came from its own family — where the bias acts — against pairs where
 * neither did, where it does not.
 */
export function measureSelfPreference(
  models: ModelProfile[],
  questions: Question[],
  answers: Answer[],
  biases: JudgeBiases,
  seed = 31,
): {
  mixedFamilyAgreement: number
  otherFamilyAgreement: number
  mixedPairs: number
  otherPairs: number
} {
  const rng = createRng(seed)
  const answerOf = (modelId: string, questionId: string) =>
    answers.find((answer) => answer.modelId === modelId && answer.questionId === questionId)!

  let mixedAgreements = 0
  let mixedPairs = 0
  let otherAgreements = 0
  let otherPairs = 0

  for (const question of questions) {
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const answerA = answerOf(models[i].id, question.id)
        const answerB = answerOf(models[j].id, question.id)
        const ownA = isJudgeFamily(answerA.modelId)
        const ownB = isJudgeFamily(answerB.modelId)
        const isMixed = ownA !== ownB

        const human = humanPreference(answerA, answerB, rng)
        const judged = judgePreference(answerA, answerB, 'first', biases, rng)
        if (isMixed) {
          mixedPairs++
          if (judged.winner === human) mixedAgreements++
        } else {
          otherPairs++
          if (judged.winner === human) otherAgreements++
        }
      }
    }
  }

  return {
    mixedFamilyAgreement: mixedPairs === 0 ? 0 : mixedAgreements / mixedPairs,
    otherFamilyAgreement: otherPairs === 0 ? 0 : otherAgreements / otherPairs,
    mixedPairs,
    otherPairs,
  }
}
