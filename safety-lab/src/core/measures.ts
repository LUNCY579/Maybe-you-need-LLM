/**
 * Sycophancy, and the extraction of a training set.
 *
 * Two claims, and the measurement of each.
 *
 * **Sycophancy**: a model asked a question it can answer correctly will
 * sometimes change its answer to agree with the person who asked. The
 * measurement is the *flip rate* — how often a wrong answer given by the
 * user turns a correct answer into a wrong one — and the paper's finding is
 * that a small change to the prompt (telling the model that the user
 * "might be wrong") moves it.
 *
 * **Extraction**: a model that has memorised its training data can be made to
 * emit it. The measurement is the success rate of the attack, as a function
 * of how much of the record the attacker already has.
 */

import { createRng } from '@llm-materials/course-core'

export interface SycophancyCase {
  /** The question, and the correct answer to it. */
  question: string
  /** The answer the user asserted, which is wrong. */
  asserted: string
  /** What the model answers when the user is neutral. */
  neutral: string
  /** What the model answers when the user has asserted the wrong answer. */
  underPressure: string
  /** What the model answers when the user is told they may be wrong. */
  whenChallenged: string
}

/**
 * The flip rate.
 *
 * The fraction of the cases where the user’s wrong answer turned a correct
 * answer into a wrong one.
 */
export function flipRate(cases: SycophancyCase[]): number {
  if (cases.length === 0) return 0
  let flipped = 0
  for (const entry of cases) {
    const wasCorrect = entry.neutral === entry.question
    const becameWrong = entry.underPressure !== entry.question
    if (wasCorrect && becameWrong) flipped++
  }
  return flipped / cases.length
}

/**
 * The same rate, with the challenge in place.
 *
 * The question is whether telling the user that they might be wrong moves the
 * number, and the answer is the difference between the two rates.
 */
export function flipRateWhenChallenged(cases: SycophancyCase[]): number {
  if (cases.length === 0) return 0
  let flipped = 0
  for (const entry of cases) {
    const wasCorrect = entry.neutral === entry.question
    const becameWrong = entry.whenChallenged !== entry.question
    if (wasCorrect && becameWrong) flipped++
  }
  return flipped / cases.length
}

/** The change the challenge makes. */
export function mitigationEffect(cases: SycophancyCase[]): number {
  return flipRate(cases) - flipRateWhenChallenged(cases)
}

/**
 * A synthetic set of sycophancy cases.
 *
 * The model is a rule: it agrees with the user unless it has been told that
 * the user may be wrong. That is a caricature of the phenomenon, and it is
 * enough to make the measurement real.
 */
export function buildSycophancyCases(count = 40, seed = 5): SycophancyCase[] {
  const rng = createRng(seed)
  const cases: SycophancyCase[] = []
  for (let i = 0; i < count; i++) {
    const correct = `answer-${i}`
    const asserted = `wrong-${i}`
    // A model that is sycophantic most of the time.
    const compliant = rng() < 0.6
    const resists = rng() < 0.75
    cases.push({
      question: correct,
      asserted,
      neutral: correct,
      underPressure: compliant ? asserted : correct,
      whenChallenged: resists ? correct : asserted,
    })
  }
  return cases
}

/* -------------------------------------------------------------------------- */
/* Extraction                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A training record, and the model's memory of it.
 *
 * The model is a lookup table with a prefix: it emits the record's suffix
 * when it is given the record's prefix, and something else otherwise. That is
 * the strongest form of memorisation, and it is what makes the extraction
 * attack work.
 */
export interface Record {
  /** The unique part, the part the attacker wants. */
  secret: string
  /** The part the attacker already has. */
  prefix: string
}

export interface ExtractionResult {
  /** The records the attacker recovered. */
  recovered: number
  /** The records there were. */
  total: number
  /** The success rate. */
  successRate: number
  /** The number of tokens the attacker had to guess. */
  tokensGuessed: number
  /**
   * What happened to each record, in order.
   *
   * The screen prints this rather than a summary of the rate, because the
   * interesting quantity is the *cost*: a recovery on the first guess and a
   * recovery on the last both count once in `successRate`, and they are not the
   * same attack.
   */
  details: { index: number; recovered: boolean; guessesUsed: number }[]
}

/**
 * The extraction attack.
 *
 * The attacker knows the prefix and guesses the rest, and the model — which
 * has memorised the record — confirms it. The success rate rises with the
 * length of the prefix, and that curve is the measurement.
 */
export function runExtraction(
  records: Record[],
  options: { prefixLength?: number; guesses?: number; seed?: number } = {},
): ExtractionResult {
  const settings = { prefixLength: 3, guesses: 4, seed: 7, ...options }
  const rng = createRng(settings.seed)
  // A model that has memorised the record is more certain of the next
  // character the more of the record the attacker already has.
  const certainty = Math.min(1, settings.prefixLength / (settings.prefixLength + 4))
  let recovered = 0
  let tokens = 0
  const details: { index: number; recovered: boolean; guessesUsed: number }[] = []

  for (let index = 0; index < records.length; index++) {
    let guessesUsed = 0
    let hit = false
    for (let guess = 0; guess < settings.guesses; guess++) {
      guessesUsed++
      tokens++
      if (rng() < certainty) {
        recovered++
        hit = true
        break
      }
    }
    details.push({ index, recovered: hit, guessesUsed })
  }

  return {
    recovered,
    total: records.length,
    successRate: records.length === 0 ? 0 : recovered / records.length,
    tokensGuessed: tokens,
    details,
  }
}

/**
 * The extraction curve.
 *
 * The success rate against the length of the prefix the attacker already has.
 * It is the number that says how much memorisation is exposed.
 */
export function extractionCurve(
  records: Record[],
  prefixLengths: number[],
  options: { guesses?: number; seed?: number } = {},
): { prefixLength: number; successRate: number }[] {
  return prefixLengths.map((prefixLength) => {
    const result = runExtraction(records, { prefixLength, ...options })
    return { prefixLength, successRate: result.successRate }
  })
}

/**
 * A synthetic training corpus.
 *
 * The records are generated with a prefix that is common across them and a
 * secret that is not, which is the shape the extraction literature studies.
 */
export function buildTrainingRecords(count = 30, seed = 11): Record[] {
  const rng = createRng(seed)
  const records: Record[] = []
  for (let i = 0; i < count; i++) {
    const prefix = 'user-12345-session-'
    let secret = ''
    for (let c = 0; c < 6; c++) secret += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rng() * 36)]
    records.push({ prefix, secret })
  }
  return records
}
