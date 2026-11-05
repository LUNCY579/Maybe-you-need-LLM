import { describe, expect, it } from 'vitest'
import {
  attackScore,
  baselineThreshold,
  buildCorpus,
  continuationProbability,
  duplicationCurve,
  emitsVerbatim,
  estimatedProbability,
  expectedExtraction,
  extractionAccuracy,
  membershipAttack,
  PRIOR,
  queryCurve,
  sampleContinuation,
  TOKENS,
  type Candidate,
} from './memorisation'

function record(count: number, member: boolean, continuation = 3): Candidate {
  return {
    id: `record-${count}-${member}`,
    continuation,
    count,
    probability: member ? continuationProbability(count) : 1 / TOKENS,
    member,
  }
}

describe('the count model', () => {
  it('starts at the uniform and ends at certain', () => {
    expect(continuationProbability(0)).toBeCloseTo(1 / TOKENS, 12)
    expect(continuationProbability(1)).toBeCloseTo((1 + PRIOR / TOKENS) / (1 + PRIOR), 12)
    expect(continuationProbability(1)).toBeCloseTo(1 / 6, 6)
    expect(continuationProbability(16)).toBeCloseTo(0.6875, 12)
    expect(continuationProbability(4000)).toBeGreaterThan(0.998)
    expect(continuationProbability(-5)).toBeCloseTo(1 / TOKENS, 12)
  })

  it('rises with every copy, and flattens as it goes', () => {
    const probabilities = [0, 1, 2, 3, 4, 5, 6, 7].map((count) => continuationProbability(count))
    for (let i = 1; i < probabilities.length; i++) expect(probabilities[i]!).toBeGreaterThan(probabilities[i - 1]!)
    // One more copy is worth less than the copy before it: the curve is concave
    // in the duplication count, which is the whole reason a deduplication pass is
    // a defence rather than a tidiness preference.
    const gains = probabilities.slice(1).map((value, i) => value - probabilities[i]!)
    for (let i = 1; i < gains.length; i++) expect(gains[i]!).toBeLessThan(gains[i - 1]!)
  })

  it('says the record back at exactly its own probability', () => {
    const candidate = record(2, true)
    let said = 0
    for (let seed = 0; seed < 4000; seed++) if (emitsVerbatim(candidate, seed)) said++
    expect(said / 4000).toBeCloseTo(candidate.probability, 1)
  })

  it('counts the same first draw in the sampler and the single query', () => {
    const candidate = record(4, true)
    expect(sampleContinuation(candidate, 1, 99)).toBe(emitsVerbatim(candidate, 99) ? 1 : 0)
    expect(sampleContinuation(candidate, 0, 99)).toBe(0)
    const eight = sampleContinuation(record(16, true), 200, 5)
    expect(eight).toBeGreaterThan(100)
    expect(eight).toBeLessThan(200)
  })
})

describe('the duplication curve', () => {
  const rows = duplicationCurve([0, 1, 2, 4, 8, 16], { samples: 3000 })

  it('is the same number twice, once arithmetic and once sampled', () => {
    for (const row of rows) {
      expect(row.probability).toBeCloseTo(continuationProbability(row.count), 12)
      expect(Math.abs(row.observed - row.probability)).toBeLessThan(0.03)
    }
    expect(rows[0]!.probability).toBeCloseTo(1 / TOKENS, 12)
    expect(rows[rows.length - 1]!.probability).toBeGreaterThan(0.6)
  })

  it('makes an unseen record worth exactly the baseline', () => {
    expect(rows[0]!.score).toBeCloseTo(0, 8)
    expect(rows[1]!.score).toBeGreaterThan(0.9)
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.score).toBeGreaterThan(rows[i - 1]!.score)
  })

  it('is checked against the expected extraction of a whole corpus', () => {
    const corpus = buildCorpus(600, { seed: 13 })
    expect(expectedExtraction(corpus)).toBeGreaterThan(continuationProbability(0))
    expect(expectedExtraction(corpus)).toBeLessThan(1)
    expect(Math.abs(extractionAccuracy(corpus) - expectedExtraction(corpus))).toBeLessThan(0.03)
  })
})

describe('the membership attack', () => {
  const corpus = buildCorpus(200, { seed: 13 })

  it('is above chance on a duplicated corpus and near it on a clean one', () => {
    const duplicated = membershipAttack(buildCorpus(200, { repeatShare: 0.6, maxCount: 16, seed: 13 }))
    const clean = membershipAttack(buildCorpus(200, { repeatShare: 0, nearDuplicateShare: 0, seed: 13 }))
    expect(duplicated.auc).toBeGreaterThan(0.9)
    expect(clean.auc).toBeGreaterThan(0.5)
    expect(duplicated.auc).toBeGreaterThan(clean.auc)
  })

  it('never calls a miss a hit', () => {
    // The regression: at a one-query budget the smoothed estimate of a record
    // that never came back is still above the raw baseline rate, so a threshold
    // of zero flags every candidate — member or not — and the attack is a
    // constant. The line has to be the baseline's own estimate at that budget.
    const outsiders = Array.from({ length: 60 }, (_, index) => record(0, false, index))
    expect(membershipAttack(outsiders, { queries: 1, threshold: 0, seed: 2 }).flagged).toBe(60)
    const oneQuery = membershipAttack(outsiders, { queries: 1, seed: 2 })
    expect(oneQuery.flagged).toBeLessThan(12)
    expect(oneQuery.falsePositiveRate).toBeLessThan(0.2)
    expect(baselineThreshold(1 / TOKENS, 1)).toBeGreaterThan(Math.log(estimatedProbability(0, 1) / (1 / TOKENS)))
    expect(baselineThreshold(1 / TOKENS, 1)).toBeLessThan(Math.log(estimatedProbability(1, 1) / (1 / TOKENS)))
  })

  it('buys power with queries, at the cost of precision', () => {
    const rows = queryCurve(corpus, [1, 2, 4, 8, 16, 32, 64])
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.auc).toBeGreaterThan(rows[i - 1]!.auc)
      expect(rows[i]!.queries).toBe([1, 2, 4, 8, 16, 32, 64][i])
    }
    expect(rows[0]!.auc).toBeGreaterThan(0.5)
    expect(rows[rows.length - 1]!.auc).toBeGreaterThan(0.95)
    expect(rows[rows.length - 1]!.precision).toBeLessThan(rows[0]!.precision)
    expect(rows[rows.length - 1]!.falsePositiveRate).toBeGreaterThan(rows[0]!.falsePositiveRate)
  })

  it('carries the flag count of the attack it is a record of', () => {
    // The screen prints this column, so it has to be the same number the attack
    // itself reports at the same budget rather than a recount of it.
    const rows = queryCurve(corpus, [1, 16, 64], { seed: 5 })
    for (const row of rows) {
      const direct = membershipAttack(corpus, { queries: row.queries, seed: 5 })
      expect(row.flagged, String(row.queries)).toBe(direct.flagged)
      expect(row.flagged).toBeLessThanOrEqual(corpus.length)
      expect(Math.round(row.flagged * row.precision)).toBe(
        Math.round(direct.truePositiveRate * corpus.filter((entry) => entry.member).length),
      )
    }
  })

  it('loses precision to near-duplicates, which is the honest part', () => {
    const tidy = membershipAttack(buildCorpus(200, { repeatShare: 0.35, nearDuplicateShare: 0, seed: 13 }))
    const messy = membershipAttack(buildCorpus(200, { repeatShare: 0.35, nearDuplicateShare: 0.6, seed: 13 }))
    expect(messy.precision).toBeLessThan(tidy.precision)
    expect(messy.falsePositiveRate).toBeGreaterThan(tidy.falsePositiveRate)
    expect(messy.truePositiveRate).toBeCloseTo(tidy.truePositiveRate, 1)
  })

  it('is the log ratio the attacker would compute by hand', () => {
    expect(attackScore(record(0, true), 1 / TOKENS)).toBe(0)
    expect(attackScore(record(16, true), 1 / TOKENS)).toBeCloseTo(Math.log(0.6875 / 0.0625), 8)
    // A reference model that is *more* certain than the victim turns the
    // evidence upside down, which is why the baseline is the attacker's choice.
    expect(attackScore(record(16, true), 0.8)).toBeLessThan(0)
    expect(attackScore(record(1, true), 1 / TOKENS)).toBeLessThan(attackScore(record(16, true), 1 / TOKENS))
  })

  it('keeps its estimates finite and its ranking by count', () => {
    expect(estimatedProbability(0, 16)).toBeGreaterThan(0)
    expect(estimatedProbability(16, 16)).toBeCloseTo((16.5) / 17, 12)
    const zeroToOne = estimatedProbability(1, 16) - estimatedProbability(0, 16)
    expect(zeroToOne).toBeCloseTo(estimatedProbability(2, 16) - estimatedProbability(1, 16), 12)
  })

  it('reports nothing when given nothing', () => {
    const empty = membershipAttack([])
    expect(empty.auc).toBe(0)
    expect(empty.accuracy).toBe(0)
    expect(empty.flagged).toBe(0)
  })
})

describe('the corpus', () => {
  it('puts the repeats where they are claimed', () => {
    const corpus = buildCorpus(240, { repeatShare: 0.5, maxCount: 16, seed: 17 })
    const members = corpus.filter((candidate) => candidate.member)
    const outsiders = corpus.filter((candidate) => !candidate.member)
    expect(members.length).toBeGreaterThan(90)
    expect(outsiders.every((candidate) => candidate.count === 0)).toBe(true)
    expect(members.every((candidate) => candidate.count >= 1)).toBe(true)
    const repeated = members.filter((candidate) => candidate.count > 1).length / members.length
    expect(repeated).toBeGreaterThan(0.4)
    expect(repeated).toBeLessThan(0.6)
  })

  it('only gives a near-duplicate probability to an outsider', () => {
    const corpus = buildCorpus(200, { repeatShare: 0, nearDuplicateShare: 1, seed: 19 })
    for (const candidate of corpus) {
      if (candidate.member) expect(candidate.probability).toBeCloseTo(continuationProbability(1), 12)
      else expect(candidate.probability).toBeLessThan(continuationProbability(1))
    }
    expect(corpus.filter((candidate) => !candidate.member && candidate.probability > 1 / TOKENS).length).toBeGreaterThan(20)
  })

  it('is a member exactly when the record was seen', () => {
    for (const candidate of buildCorpus(120, { seed: 7 })) {
      expect(candidate.member).toBe(candidate.count > 0)
      if (!candidate.member) expect(candidate.count).toBe(0)
    }
  })
})
