import { describe, expect, it } from 'vitest'
import {
  buildExchanges,
  critique,
  judgeAgreement,
  PRINCIPLES,
  revise,
  runConstitutionLoop,
  sampleJudgeVerdicts,
  type Exchange,
} from './constitution'
import { runRedTeam } from './redteam'
import {
  buildSycophancyCases,
  buildTrainingRecords,
  extractionCurve,
  flipRate,
  flipRateWhenChallenged,
  mitigationEffect,
  runExtraction,
} from './measures'

const exchanges: Exchange[] = [
  { prompt: 'p1', category: 'harm', response: 'here is how', harmfulness: 0.8, compliant: true },
  { prompt: 'p2', category: 'illegal', response: 'here is how', harmfulness: 0.6, compliant: true },
  { prompt: 'p3', category: 'honesty', response: 'a safe answer', harmfulness: 0, compliant: false },
  { prompt: 'p4', category: 'harassment', response: 'here is how', harmfulness: 0.9, compliant: true },
]

describe('the constitution', () => {
  it('has a principle for every category', () => {
    const categories = new Set(PRINCIPLES.map((principle) => principle.category))
    for (const exchange of exchanges) {
      expect(categories.has(exchange.category), exchange.category).toBe(true)
    }
  })

  it('critiques a compliant response and leaves a safe one alone', () => {
    expect(critique(exchanges[0]!)).toContain('harm')
    expect(critique(exchanges[2]!)).toBeNull()
  })

  it('revises a compliant response into a safe one', () => {
    const revised = revise(exchanges[0]!)
    expect(revised.harmfulness).toBe(0)
    expect(revised.compliant).toBe(false)
    expect(revised.response.length).toBeGreaterThan(0)
  })

  it('runs the loop and removes the harm', () => {
    const result = runConstitutionLoop(exchanges)
    expect(result.harmAfter).toBeLessThan(result.harmBefore)
    expect(result.changed).toBe(3)
    expect(result.unchanged).toBe(1)
    expect(result.stillUseful).toBe(3)
  })

  it('measures the agreement of a judge with the labels', () => {
    // The judge flags the third case, the labels do not: a false positive.
    const agreement = judgeAgreement([true, false, true], [true, false, false])
    expect(agreement.agreement).toBeCloseTo(2 / 3, 8)
    expect(agreement.falsePositives).toBe(1)
    expect(agreement.falseNegatives).toBe(0)
    // And the other way round: the judge misses a case the labels call harmful.
    const missed = judgeAgreement([true, false], [true, true])
    expect(missed.falseNegatives).toBe(1)
    expect(missed.falsePositives).toBe(0)
  })
})

describe('the exchanges the loop is run over', () => {
  it('is deterministic, and complies at the rate it was given', () => {
    const drawn = buildExchanges(400, { compliance: 0.5, seed: 3 })
    expect(drawn).toEqual(buildExchanges(400, { compliance: 0.5, seed: 3 }))
    expect(drawn).toHaveLength(400)
    const compliant = drawn.filter((entry) => entry.compliant).length
    expect(compliant).toBeGreaterThan(160)
    expect(compliant).toBeLessThan(240)
  })

  it('carries harm exactly where it complied', () => {
    for (const entry of buildExchanges(200, { compliance: 0.4, seed: 7 })) {
      if (entry.compliant) expect(entry.harmfulness).toBeGreaterThan(0.4)
      else expect(entry.harmfulness).toBe(0)
    }
  })

  it('spans the taxonomy the principles are written against', () => {
    const categories = new Set(buildExchanges(200, { seed: 4 }).map((entry) => entry.category))
    expect(categories.size).toBe(PRINCIPLES.length)
  })
})

describe('a judge sampled from the labels', () => {
  it('agrees perfectly when it is given no error rate', () => {
    const exchanges = buildExchanges(200, { compliance: 0.5, seed: 3 })
    const labels = exchanges.map((entry) => entry.compliant)
    const verdicts = sampleJudgeVerdicts(exchanges, 0, 5)
    expect(verdicts.judged).toEqual(labels)
    expect(judgeAgreement(verdicts.judged, labels).agreement).toBe(1)
  })

  it('disagrees by about the error rate it was given, and in both directions', () => {
    const exchanges = buildExchanges(400, { compliance: 0.5, seed: 3 })
    const labels = exchanges.map((entry) => entry.compliant)
    const verdicts = sampleJudgeVerdicts(exchanges, 0.1, 5)
    expect(verdicts.judged).toEqual(sampleJudgeVerdicts(exchanges, 0.1, 5).judged)
    const measured = judgeAgreement(verdicts.judged, labels)
    const errors = measured.falsePositives + measured.falseNegatives
    // Forty expected flips out of four hundred, and neither kind is zero: a
    // judge that only over-flags and one that only misses are different defects.
    expect(errors).toBeGreaterThan(20)
    expect(errors).toBeLessThan(60)
    expect(measured.falsePositives).toBeGreaterThan(0)
    expect(measured.falseNegatives).toBeGreaterThan(0)
    expect(measured.agreement).toBeCloseTo(1 - errors / 400, 8)
  })
})

describe('the red team', () => {
  it('finds failures', () => {
    const result = runRedTeam({ attacks: 200, seed: 5 })
    expect(result.succeeded).toBeGreaterThan(0)
    expect(result.successRate).toBeGreaterThan(0)
    expect(result.successRate).toBeLessThan(1)
  })

  it('reaches more of the taxonomy than chance, and that is the number that matters', () => {
    // With a small budget, the difference in coverage is visible: a
    // model-driven attacker reaches the categories it has not found yet.
    const model = runRedTeam({ attacks: 12, modelDriven: true, seed: 9 })
    const random = runRedTeam({ attacks: 12, modelDriven: false, seed: 9 })
    expect(model.coverage).toBeGreaterThan(random.coverage)
    expect(model.distinctFindings).toBeGreaterThanOrEqual(model.categoriesReached)
  })

  it('covers every category with enough attacks', () => {
    const result = runRedTeam({ attacks: 2000, modelDriven: true, seed: 2 })
    expect(result.coverage).toBeGreaterThan(0.8)
  })

  it('keeps a per-category account that adds up to the report', () => {
    const result = runRedTeam({ attacks: 120, modelDriven: true, seed: 6 })
    expect(result.byCategory).toHaveLength(result.categories)
    expect(result.byCategory.reduce((sum, entry) => sum + entry.attacks, 0)).toBe(result.attempted)
    expect(result.byCategory.reduce((sum, entry) => sum + entry.failures, 0)).toBe(result.succeeded)
    expect(result.byCategory.filter((entry) => entry.reached).length).toBe(result.categoriesReached)
    for (const entry of result.byCategory) {
      expect(entry.failures).toBeLessThanOrEqual(entry.attacks)
      // A category is reached if and only if something came back from it.
      if (entry.reached) expect(entry.failures).toBeGreaterThan(0)
      else expect(entry.failures).toBe(0)
    }
  })

  it('names every category exactly once in that account', () => {
    const names = runRedTeam({ attacks: 30, seed: 2 }).byCategory.map((entry) => entry.category)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('sycophancy', () => {
  it('measures the flip rate', () => {
    const cases = buildSycophancyCases(100, 3)
    const rate = flipRate(cases)
    expect(rate).toBeGreaterThan(0.4)
    expect(rate).toBeLessThanOrEqual(1)
  })

  it('is reduced by telling the model the user may be wrong', () => {
    const cases = buildSycophancyCases(200, 4)
    expect(flipRateWhenChallenged(cases)).toBeLessThan(flipRate(cases))
    expect(mitigationEffect(cases)).toBeGreaterThan(0)
  })
})

describe('extraction', () => {
  it('recovers the records', () => {
    const records = buildTrainingRecords(20, 4)
    const result = runExtraction(records, { prefixLength: 3, guesses: 4 })
    expect(result.successRate).toBeGreaterThan(0.5)
  })

  it('is easier with a longer prefix', () => {
    const records = buildTrainingRecords(30, 6)
    const curve = extractionCurve(records, [0, 1, 2, 3], { guesses: 4 })
    expect(curve[curve.length - 1]!.successRate).toBeGreaterThan(curve[0]!.successRate)
  })

  it('accounts for every record it was given', () => {
    // The screen prints this table rather than the rate, so the arithmetic that
    // adds up to the summary is the thing that has to be checked.
    const records = buildTrainingRecords(25, 9)
    const result = runExtraction(records, { prefixLength: 4, guesses: 3, seed: 2 })
    expect(result.details).toHaveLength(25)
    expect(result.details.filter((entry) => entry.recovered).length).toBe(result.recovered)
    expect(result.details.reduce((sum, entry) => sum + entry.guessesUsed, 0)).toBe(result.tokensGuessed)
    for (const entry of result.details) {
      expect(entry.guessesUsed, String(entry.index)).toBeLessThanOrEqual(3)
      // A recovery stops the guessing; a failure spends the whole budget.
      if (!entry.recovered) expect(entry.guessesUsed, String(entry.index)).toBe(3)
    }
  })
})
