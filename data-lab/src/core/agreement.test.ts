import { beforeAll, describe, expect, it } from 'vitest'
import { buildCorpus, DOMAINS, type Document } from './corpus'
import { splitCorpus } from './filters'
import { compareFilters, generativeTopic, scoreAgreement, topicLogLikelihoods, type AgreementScore } from './agreement'

const corpus = buildCorpus({ seed: 17, size: 400 })
const { train, test } = splitCorpus(corpus, 0.3)
const testIds = new Set(test.map((document) => document.id))
const pool = train.filter((document) => !testIds.has(document.id))

let scores: AgreementScore[] = []
beforeAll(() => {
  scores = scoreAgreement(corpus, pool)
})

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
const byId = new Map<number, Document>(pool.map((document) => [document.id, document]))
const unwanted = (documents: Document[]) => documents.filter((d) => d.isSpam || d.isForeign).length

/**
 * Why CLIP filtering works.
 *
 * DataComp's cross-modal score is reproduced here as the agreement of two views
 * that share no parameters, and measured against the corpus's ground truth. One
 * half of the paper's argument reproduces at this scale and the other does not;
 * the second describe block is the null result, stated as a number.
 */
describe('Why CLIP filtering works', () => {
  it('builds the score from two views with nothing in common', () => {
    expect(scores).toHaveLength(280)
    // the generative view is an argmax over the corpus's own topic distributions
    for (const document of pool.slice(0, 20)) {
      const likelihoods = topicLogLikelihoods(document, corpus.topicDistributions)
      expect(generativeTopic(document, corpus.topicDistributions)).toBe(
        likelihoods.indexOf(Math.max(...likelihoods)),
      )
    }
    // and it is not the same answer as the classifier's, document by document
    const voted = scores.filter((score) => score.votedTopic === score.generativeTopic)
    expect(voted.length).toBeGreaterThan(200)
    expect(voted.length).toBeLessThan(scores.length)
  })

  it('ranks each view against the truth without reaching an agreement rate', () => {
    const generative = mean(scores.map((score) => (score.generativeTopic === score.topic ? 1 : 0)))
    const discriminative = mean(scores.map((score) => (score.votedTopic === score.topic ? 1 : 0)))
    expect(Number(generative.toFixed(4))).toBe(0.8964)
    expect(Number(discriminative.toFixed(4))).toBe(0.9214)
    // the classifier is fit on the first 40% of this pool, so its accuracy is
    // partly in-sample; the score is used as a ranking, never quoted as a result
    expect(Number(mean(scores.map((score) => (score.agree ? 1 : 0))).toFixed(4))).toBe(0.9214)
  })

  it('separates the junk from the clean data on the score alone', () => {
    const clean = mean(scores.filter((s) => !s.isSpam && !s.isForeign).map((s) => s.score))
    const spam = mean(scores.filter((s) => s.isSpam).map((s) => s.score))
    const foreign = mean(scores.filter((s) => s.isForeign).map((s) => s.score))
    expect(clean).toBeGreaterThan(spam)
    expect(spam).toBeGreaterThan(foreign)
    expect(Number(clean.toFixed(3))).toBe(0.879)
    expect(Number(spam.toFixed(4))).toBe(0.5061)
    expect(Number(foreign.toFixed(4))).toBe(0.0553)
  })

  it('drops every unwanted document, at every keep fraction', () => {
    expect(unwanted(pool)).toBe(32)
    for (const keepFraction of [0.5, 0.6, 0.7]) {
      const comparison = compareFilters(corpus, pool, { keepFraction })
      expect(comparison.agreement.kept).toHaveLength(Math.round(pool.length * keepFraction))
      expect(comparison.perplexity.kept).toHaveLength(comparison.agreement.kept.length)
      expect(comparison.agreement.unwantedDropped).toBe(32)
    }
  })

  it('removes the same junk while spending fewer clean documents', () => {
    const rows = [0.5, 0.6, 0.7].map((keepFraction) => {
      const comparison = compareFilters(corpus, pool, { keepFraction })
      return {
        agreement: comparison.agreement.cleanDropped,
        perplexity: comparison.perplexity.cleanDropped,
        lessClean: comparison.agreementDropsLessClean,
      }
    })
    expect(rows).toEqual([
      { agreement: 108, perplexity: 112, lessClean: true },
      { agreement: 80, perplexity: 87, lessClean: true },
      { agreement: 52, perplexity: 61, lessClean: true },
    ])
  })

  it('is not the same cut as the perplexity rule', () => {
    const comparison = compareFilters(corpus, pool, { keepFraction: 0.6 })
    // both drop 112 documents, and 24 of them are different documents
    expect(comparison.onlyAgreementDrops).toBe(24)
    expect(comparison.onlyPerplexityDrops).toBe(24)
    expect(comparison.dropSetOverlap).toBeCloseTo(0.6471, 4)
    expect(comparison.perplexity.unwantedDropped).toBe(25)
    // and the kept means are a wash, which is the honest reading of the row
    expect(comparison.agreement.keptMeanQuality).toBeCloseTo(0.5814, 4)
    expect(comparison.perplexity.keptMeanQuality).toBeCloseTo(0.5806, 4)
  })

  it('finds the two rules agree on the documents neither can rank alone', () => {
    const comparison = compareFilters(corpus, pool, { keepFraction: 0.6 })
    const disagreement = scores.filter((score) => !score.agree)
    expect(disagreement.length).toBeGreaterThan(0)
    // a mismatch between the views is a low score by construction
    expect(mean(disagreement.map((score) => score.score))).toBeLessThan(
      mean(scores.filter((score) => score.agree).map((score) => score.score)),
    )
    expect(comparison.agreement.dropped.length).toBe(112)
    for (const document of comparison.agreement.dropped) expect(byId.has(document.id)).toBe(true)
  })
})

/**
 * The half of the argument that does not reproduce.
 *
 * A perplexity filter is supposed to be fragile in a way a cross-modal score is
 * not: its reference model decides what counts as surprising, so a model fit on
 * one domain should punish every other one. Here it punishes, but barely, and the
 * reason is that both views in this laboratory read the same 48 tokens.
 */
describe('the reference a perplexity filter uses, measured', () => {
  it('shifts the cut towards the reference domain, and little else', () => {
    const neutral = compareFilters(corpus, pool, { keepFraction: 0.6 })
    const biased = compareFilters(corpus, pool, { keepFraction: 0.6, referenceDomains: ['books'] })
    const booksPool = pool.filter((document) => document.domain === 'books')
    expect(booksPool).toHaveLength(55)
    // the books-only reference keeps 43 of the 55 books documents
    expect(biased.perplexity.kept.filter((document) => document.domain === 'books')).toHaveLength(43)
    expect(neutral.perplexity.kept.filter((document) => document.domain === 'books').length).toBeGreaterThan(30)
    // and the same reference removes exactly as much junk as the neutral one
    expect(biased.perplexity.unwantedDropped).toBe(neutral.perplexity.unwantedDropped)
    expect(biased.perplexity.cleanDropped).toBe(neutral.perplexity.cleanDropped)
    expect(biased.perplexity.keptMeanQuality).toBeCloseTo(0.5801, 4)
    expect(neutral.perplexity.keptMeanQuality).toBeCloseTo(0.5806, 4)
  })

  it('leaves the two rules’ skew indistinguishable', () => {
    const biased = compareFilters(corpus, pool, { keepFraction: 0.6, referenceDomains: ['books'] })
    expect(biased.perplexity.droppedDomainShare).toBeCloseTo(0.2768, 4)
    expect(biased.agreement.droppedDomainShare).toBeCloseTo(0.2679, 4)
    // the agreement rule is not much flatter than the biased reference model
    expect(biased.perplexity.droppedDomainShare - biased.agreement.droppedDomainShare).toBeLessThan(0.01)
  })

  it('still prefers its own domain when the reference is narrowed to one', () => {
    const domains = DOMAINS.map((domain) => ({
      domain,
      share: pool.filter((document) => document.domain === domain).length / pool.length,
    }))
    expect(Math.max(...domains.map((row) => row.share))).toBeLessThan(0.25)
    const biased = compareFilters(corpus, pool, { keepFraction: 0.6, referenceDomains: ['books'] })
    const keptShare =
      biased.perplexity.kept.filter((document) => document.domain === 'books').length / biased.perplexity.kept.length
    expect(keptShare).toBeGreaterThan(0.25)
  })
})
