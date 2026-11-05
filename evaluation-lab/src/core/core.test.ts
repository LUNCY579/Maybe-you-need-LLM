import { describe, expect, it } from 'vitest'
import { createRng } from '@llm-materials/course-core'
import {
  MODELS,
  NEUTRAL_JUDGE,
  buildAnswers,
  buildQuestions,
  judgePreference,
  measureJudge,
  measurePositionBias,
  measureSelfPreference,
  measureVerbosityBias,
  modelById,
} from './setting.js'
import {
  bootstrapRanking,
  pairwiseWinProbability,
  rankWithBradleyTerry,
  rankingAccuracy,
  runArena,
  runArenaElo,
  votesNeeded,
  votesToSeparate,
} from './arena.js'
import {
  contaminationEffect,
  detectionPower,
  intervalWidthCurve,
  questionsNeeded,
  rankingShift,
  scoreDistribution,
  scoreInterval,
  scoreStandardError,
} from './measurement.js'

const questions = buildQuestions(20, 5)
const answers = buildAnswers(MODELS, questions, 11)

describe('the synthetic setting', () => {
  it('builds questions with known difficulties', () => {
    expect(questions).toHaveLength(20)
    for (const question of questions) {
      expect(question.difficulty).toBeGreaterThan(0)
      expect(question.difficulty).toBeLessThan(1)
    }
  })

  it('gives every answer a true quality and a length', () => {
    expect(answers).toHaveLength(MODELS.length * questions.length)
    for (const answer of answers) {
      expect(answer.trueQuality).toBeGreaterThanOrEqual(0)
      expect(answer.trueQuality).toBeLessThanOrEqual(1)
      expect(answer.length).toBeGreaterThan(0)
    }
  })

  it('makes the better model the better answer on most questions', () => {
    let bestModelWins = 0
    let total = 0
    for (const question of questions) {
      const byModel = MODELS.map((model) => answers.find((a) => a.modelId === model.id && a.questionId === question.id)!)
      const best = byModel.reduce((a, b) => (b.trueQuality > a.trueQuality ? b : a))
      const worst = byModel.reduce((a, b) => (b.trueQuality < a.trueQuality ? b : a))
      if (best.modelId === 'atlas' && worst.modelId !== 'atlas') bestModelWins++
      total++
    }
    expect(bestModelWins).toBeGreaterThan(total * 0.6)
  })

  it('looks a model up by id and refuses an unknown one', () => {
    expect(modelById('atlas').name).toBe('Atlas')
    expect(() => modelById('nope')).toThrow(/no model/)
  })
})

describe('the judge', () => {
  it('agrees with the human far more often than chance', () => {
    const measurement = measureJudge(MODELS, questions, answers, NEUTRAL_JUDGE)
    expect(measurement.agreement).toBeGreaterThan(0.75)
    expect(measurement.agreement).toBeGreaterThan(0.5)
    expect(measurement.pairs).toBeGreaterThan(0)
  })

  it('is consistent with itself when it has no position bias', () => {
    const measurement = measureJudge(MODELS, questions, answers, NEUTRAL_JUDGE)
    expect(measurement.consistency).toBeGreaterThan(0.9)
  })

  it('prefers the first position about half the time when it has no position bias', () => {
    const measurement = measurePositionBias(MODELS, questions, answers, NEUTRAL_JUDGE)
    expect(measurement.total).toBeGreaterThan(0)
    expect(measurement.rate).toBeGreaterThan(0.35)
    expect(measurement.rate).toBeLessThan(0.65)
  })

  it('prefers the first position much more often when it is biased', () => {
    const biased = { ...NEUTRAL_JUDGE, positionBias: 0.25 }
    const measurement = measurePositionBias(MODELS, questions, answers, biased)
    expect(measurement.rate).toBeGreaterThan(0.75)
  })

  it('prefers the longer answer when it is biased towards length', () => {
    const biased = { ...NEUTRAL_JUDGE, verbosityBias: 0.3 }
    const measurement = measureVerbosityBias(MODELS, questions, answers, biased)
    expect(measurement.total).toBeGreaterThan(0)
    expect(measurement.rate).toBeGreaterThan(0.7)
  })

  it('agrees with the human less often when one answer is from its own family', () => {
    const weak = measureSelfPreference(MODELS, questions, answers, { ...NEUTRAL_JUDGE, selfPreference: 0.15 })
    const strong = measureSelfPreference(MODELS, questions, answers, { ...NEUTRAL_JUDGE, selfPreference: 0.45 })
    expect(strong.mixedPairs).toBeGreaterThan(0)
    expect(strong.otherPairs).toBeGreaterThan(0)
    expect(strong.mixedFamilyAgreement).toBeLessThan(strong.otherFamilyAgreement)
    // The stronger the bias, the worse the agreement on the affected pairs.
    expect(strong.mixedFamilyAgreement).toBeLessThan(weak.mixedFamilyAgreement)
  })

  it('flips its answer when the positions are swapped and the bias is strong', () => {
    const rng = createRng(3)
    const answerA = answers[0]
    const answerB = answers.find((a) => a.modelId === 'flint' && a.questionId === answers[0].questionId)!
    const biased = { ...NEUTRAL_JUDGE, positionBias: 0.5, noise: 0 }
    const first = judgePreference(answerA, answerB, 'first', biased, rng)
    const swapped = judgePreference(answerB, answerA, 'first', biased, rng)
    const swappedWinner = swapped.winner === 'A' ? 'B' : 'A'
    // With a large position bias the judge follows the position, not the answer.
    expect(first.winner).toBe('A')
    expect(swappedWinner).toBe('B')
  })
})

describe('the arena', () => {
  it('collects votes and contests only the close pairs', () => {
    const arena = runArena(MODELS, questions, answers, NEUTRAL_JUDGE, 1)
    expect(arena.totalVotes).toBeGreaterThan(0)
    expect(arena.contestedPairs).toBeGreaterThan(0)

    const total = arena.wins.reduce(
      (acc, row, i) => acc + row.reduce((inner, value, j) => inner + (i === j ? 0 : value), 0),
      0,
    )
    expect(total).toBe(arena.totalVotes)
  })

  it('ranks the models in the right order', () => {
    const arena = runArena(MODELS, questions, answers, NEUTRAL_JUDGE, 2)
    const ranking = rankWithBradleyTerry(MODELS, arena.wins)
    expect(ranking.order[0]).toBe('atlas')
    expect(ranking.order[ranking.order.length - 1]).toBe('flint')
  })

  it('ranks them accurately against the truth', () => {
    const arena = runArena(MODELS, questions, answers, NEUTRAL_JUDGE, 2)
    const ranking = rankWithBradleyTerry(MODELS, arena.wins)
    const accuracy = rankingAccuracy(MODELS, ranking, answers, questions)
    expect(accuracy.accuracy).toBeGreaterThan(0.8)
  })

  it('promotes the verbose model when the judge is biased towards length', () => {
    const clean = runArena(MODELS, questions, answers, NEUTRAL_JUDGE, 2)
    const biased = { ...NEUTRAL_JUDGE, verbosityBias: 0.35, positionBias: 0 }
    const cleanRanking = rankWithBradleyTerry(MODELS, clean.wins)
    const biasedRanking = rankWithBradleyTerry(MODELS, runArena(MODELS, questions, answers, biased, 2).wins)
    // Ember is verbose and poor; a verbosity-biased judge should promote it.
    expect(biasedRanking.order.indexOf('ember')).toBeLessThan(cleanRanking.order.indexOf('ember'))
  })

  it('produces a bootstrap interval that contains the point estimate', () => {
    const arena = runArena(MODELS, questions, answers, NEUTRAL_JUDGE, 2)
    const intervals = bootstrapRanking(MODELS, arena.wins, 150)
    expect(intervals.length).toBe(MODELS.length)
    for (const interval of intervals) {
      expect(interval.low).toBeLessThanOrEqual(interval.strength + 1e-9)
      expect(interval.high).toBeGreaterThanOrEqual(interval.strength - 1e-9)
      expect(interval.topProbability).toBeGreaterThanOrEqual(0)
      expect(interval.topProbability).toBeLessThanOrEqual(1)
    }
  })

  it('runs an Elo season and ranks the same way', () => {
    const arena = runArena(MODELS, questions, answers, NEUTRAL_JUDGE, 2)
    const season = runArenaElo(MODELS, arena.wins)
    expect(season.order[0]).toBe('atlas')
    expect(season.ratings.length).toBe(MODELS.length)
  })

  it('computes a win probability and a sample size', () => {
    expect(pairwiseWinProbability(0)).toBeCloseTo(0.5, 12)
    expect(pairwiseWinProbability(2)).toBeGreaterThan(0.85)
    expect(votesNeeded(0.5)).toBeGreaterThan(votesNeeded(1.5))
  })

  it('separates two models given enough votes', () => {
    const p = pairwiseWinProbability(1)
    const small = votesToSeparate(1, p, 10)
    const large = votesToSeparate(1, p, 200)
    expect(small.separated).toBe(false)
    expect(large.separated).toBe(true)
  })
})

describe('measurement', () => {
  it('computes the standard error of a benchmark score', () => {
    expect(scoreStandardError(0.5, 100)).toBeCloseTo(Math.sqrt(0.25 / 100), 12)
    expect(scoreStandardError(0.5, 100)).toBeLessThan(scoreStandardError(0.5, 10))
  })

  it('produces an interval that contains the score', () => {
    const interval = scoreInterval(0.6, 100)
    expect(interval.low).toBeLessThan(0.6)
    expect(interval.high).toBeGreaterThan(0.6)
    expect(interval.high).toBeLessThanOrEqual(1)
  })

  it('narrows the interval as the benchmark grows', () => {
    const curve = intervalWidthCurve(0.5, [10, 100, 1000, 10000])
    expect(curve[3].width).toBeLessThan(curve[0].width)
    // The width goes as one over the square root of N.
    const ratio = curve[0].width / curve[1].width
    expect(ratio).toBeGreaterThan(2.5)
    expect(ratio).toBeLessThan(3.5)
  })

  it('asks for more questions when the difference is smaller', () => {
    expect(questionsNeeded(0.7, 0.6)).toBeGreaterThan(questionsNeeded(0.9, 0.6))
  })

  it('has more power with more questions', () => {
    expect(detectionPower(0.7, 0.6, 1000)).toBeGreaterThan(detectionPower(0.7, 0.6, 50))
  })

  it('shows what contamination does to a score', () => {
    const clean = contaminationEffect(0.6, 100, 0, 1.4)
    expect(clean.reportedScore).toBeCloseTo(0.6, 12)

    const dirty = contaminationEffect(0.6, 100, 0.2, 1.4)
    expect(dirty.contaminatedQuestions).toBe(20)
    expect(dirty.reportedScore).toBeGreaterThan(0.6)
    expect(dirty.inflation).toBeCloseTo(dirty.reportedScore - 0.6, 12)
  })

  it('shows that contamination can move a ranking', () => {
    const shift = rankingShift([0.7, 0.6, 0.5], [0.7, 0.6, 0.95])
    expect(shift.shifted).toBe(true)
    expect(shift.contaminatedOrder[0]).toBe(2)
  })

  it('simulates a benchmark whose score wobbles', () => {
    const scores = scoreDistribution(0.6, 100, 2000)
    expect(scores).toHaveLength(2000)
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    expect(mean).toBeCloseTo(0.6, 1)
    const sd = Math.sqrt(scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / scores.length)
    expect(sd).toBeCloseTo(scoreStandardError(0.6, 100), 2)
  })
})
