import { describe, expect, it } from 'vitest'
import { buildCorpus, type Document } from './corpus'
import { jaccard, shingles } from './dedup'
import { adaptivePerplexityFilter, midasFilter, perplexityUnderModels, signatureEstimate } from './midas'
import { splitCorpus, documentPerplexity, fitNGram } from './filters'

const corpus = buildCorpus({ seed: 17, size: 400 })
const documents = corpus.documents

const percentile = (values: number[], fraction: number): number => {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!
}

/** The pairs the corpus's own `duplicateOf` field says are duplicates. */
const duplicatePairs: [Document, Document][] = documents
  .filter((document) => document.duplicateOf !== null)
  .map((document) => [document, documents.find((other) => other.id === document.duplicateOf)!])

/**
 * Midas and perplexity filtering.
 *
 * RefinedWeb's two cleaning rules, measured against the ground truth the
 * generated corpus carries. The numbers below are this corpus's, not the
 * paper's; the interesting one is the recall column, because the default
 * threshold sits above where this corpus's near-duplicates actually are.
 */
describe('Midas and perplexity filtering', () => {
  it('finds the clusters the ground truth planted', () => {
    expect(documents.filter((document) => document.duplicateOf !== null)).toHaveLength(44)
    const result = midasFilter(documents, { threshold: 0.5 })
    expect(result.kept).toHaveLength(366)
    expect(result.clusters).toHaveLength(29)
    expect(result.recall).toBeCloseTo(0.727, 3)
    expect(result.trueDuplicatesRemoved).toBe(32)
  })

  it('loses recall as the threshold rises, because the copies are not that close', () => {
    const rows = [0.4, 0.5, 0.6, 0.7, 0.8].map((threshold) => {
      const result = midasFilter(documents, { threshold })
      return { threshold, kept: result.kept.length, clusters: result.clusters.length, recall: result.recall }
    })
    expect(rows.map((row) => row.kept)).toEqual([363, 366, 374, 384, 392])
    expect(rows.map((row) => row.clusters)).toEqual([32, 29, 22, 14, 8])
    expect(rows.map((row) => Number(row.recall.toFixed(3)))).toEqual([0.773, 0.727, 0.545, 0.318, 0.136])
  })

  it('places the default threshold above the bulk of the duplicates', () => {
    const trueSimilarities = duplicatePairs.map(([a, b]) => jaccard(shingles(a.tokens, 5), shingles(b.tokens, 5)))
    expect(percentile(trueSimilarities, 0)).toBeCloseTo(0.342, 3)
    expect(percentile(trueSimilarities, 0.5)).toBeCloseTo(0.621, 3)
    expect(percentile(trueSimilarities, 1)).toBeCloseTo(0.889, 3)
    // the same percentiles on unrelated documents, which is the other half of the story
    const unrelated = documents
      .filter((document, index) => index % 7 === 0 && document.duplicateOf === null)
      .flatMap((document) =>
        documents
          .filter((other) => other.duplicateOf === null && other.id !== document.id)
          .map((other) => jaccard(shingles(document.tokens, 5), shingles(other.tokens, 5))),
      )
    expect(percentile(unrelated, 0.5)).toBe(0)
    expect(percentile(unrelated, 0.9)).toBeLessThan(0.05)
  })

  it('keeps the near-duplicate it is asked to keep, and no more', () => {
    const one = midasFilter(documents, { threshold: 0.5, keepSimilar: 1 })
    const two = midasFilter(documents, { threshold: 0.5, keepSimilar: 2 })
    expect(one.kept).toHaveLength(366)
    // every cluster contributes exactly one extra survivor
    expect(two.kept).toHaveLength(366 + one.clusters.length)
    expect(two.clusters).toHaveLength(one.clusters.length)
    expect(two.removed.length).toBe(one.removed.length - one.clusters.length)
  })

  it('spares almost nothing but the planted duplicates', () => {
    const result = midasFilter(documents, { threshold: 0.5 })
    const dropped = documents.filter((document) => !result.kept.includes(document))
    expect(dropped).toHaveLength(34)
    const unique = dropped.filter((document) => document.duplicateOf === null)
    expect(unique).toHaveLength(2)
    // what it drops beyond the truth is boilerplate, which is not the worst mistake
    expect(unique.every((document) => document.isSpam)).toBe(true)
    expect(result.falsePositiveFraction).toBeCloseTo(0.059, 3)
  })

  it('joins clusters through chains, and says so', () => {
    const result = midasFilter(documents, { threshold: 0.5 })
    const sizes = result.clusters.map((cluster) => cluster.members.length)
    expect(Math.max(...sizes)).toBe(4)
    // a connected component always contains at least one confirming pair
    for (const cluster of result.clusters) {
      expect(cluster.internalSimilarity).toBeGreaterThanOrEqual(0.5)
      expect(cluster.kept).toHaveLength(1)
      expect(cluster.members).toHaveLength(cluster.kept.length + cluster.removed.length)
    }
  })

  it('proposes far fewer pairs than it could', () => {
    const result = midasFilter(documents, { threshold: 0.5 })
    expect(result.comparisons).toBe(result.candidatePairs)
    expect(result.candidatePairs).toBeLessThan((documents.length * (documents.length - 1)) / 200)
    // the index only promises to propose a J = 0.5 pair 64% of the time at this
    // banding; the measured recall is higher because a cluster joins through its
    // closest member, not through every pair
    expect(result.expectedRecall).toBeCloseTo(0.644, 3)
    expect(result.recall).toBeGreaterThan(result.expectedRecall)
  })

  it('estimates a pairs similarity closely enough to act on', () => {
    const [a, b] = duplicatePairs[0]!
    const truth = jaccard(shingles(a.tokens, 5), shingles(b.tokens, 5))
    expect(Math.abs(signatureEstimate(a, b) - truth)).toBeLessThan(0.15)
  })
})

describe('perplexity filtering at a quantile', () => {
  const { train, test } = splitCorpus(corpus, 0.3)
  const testIds = new Set(test.map((document) => document.id))
  const pool = train.filter((document) => !testIds.has(document.id))

  it('keeps the fraction it was asked to keep, deterministically', () => {
    const result = adaptivePerplexityFilter(pool, { keepFraction: 0.6 })
    expect(result.kept).toHaveLength(168)
    expect(result.dropped).toHaveLength(112)
    expect(result.kept.concat(result.dropped)).toHaveLength(pool.length)
    expect(adaptivePerplexityFilter(pool, { keepFraction: 0.6 }).kept.map((d) => d.id)).toEqual(
      result.kept.map((document) => document.id),
    )
  })

  it('separates the pool from itself, in the survivors and in the score', () => {
    const result = adaptivePerplexityFilter(pool, { keepFraction: 0.6 })
    expect(result.keptMeanQuality).toBeCloseTo(0.5806, 4)
    expect(result.droppedMeanQuality).toBeCloseTo(0.2097, 4)
    expect(result.threshold).toBeCloseTo(11.16, 2)
    expect(result.unwantedKept).toBe(7)
    expect(result.unwantedDropped).toBe(25)
    // every unseen-language document of the pool is below the cut
    expect(result.kept.filter((document) => document.isForeign)).toHaveLength(0)
    expect(result.dropped.filter((document) => document.isForeign)).toHaveLength(20)
  })

  it('moves the threshold when the vocabulary moves, which is why a quantile is used', () => {
    const narrow = buildCorpus({ seed: 17, size: 300, vocabulary: 48 }).documents
    const wide = buildCorpus({ seed: 41, size: 300, vocabulary: 96 }).documents
    const of = (pool: Document[]) => adaptivePerplexityFilter(pool, { keepFraction: 0.9 })
    const narrowResult = of(narrow)
    const wideResult = of(wide)
    // the same fraction of two corpora is two different numbers
    expect(narrowResult.kept).toHaveLength(270)
    expect(wideResult.kept).toHaveLength(270)
    expect(narrowResult.threshold).toBeCloseTo(36.77, 2)
    expect(wideResult.threshold).toBeCloseTo(43.18, 2)
    // and a threshold fixed in advance would remove a different fraction of each
    const aboveFixedThreshold = (pool: Document[], value: number) => {
      const model = fitNGram(pool.slice(0, Math.floor(pool.length * 0.25)))
      return pool.filter((document) => documentPerplexity(model, document.tokens) > value).length
    }
    expect(aboveFixedThreshold(narrow, 120)).toBe(21)
    expect(aboveFixedThreshold(wide, 120)).toBe(16)
  })

  it('ranks a document by the reference it was scored against', () => {
    const books = pool.filter((document) => document.domain === 'books')
    const code = pool.filter((document) => document.domain === 'code')
    expect(books).toHaveLength(55)
    expect(code.length).toBeGreaterThan(50)
    const scored = perplexityUnderModels(pool, [
      { name: 'books', documents: books },
      { name: 'code', documents: code },
    ])
    const indicesOf = (domain: string) =>
      pool.reduce((acc: number[], document, index) => (document.domain === domain ? [...acc, index] : acc), [])
    const meanAt = (perplexities: number[], indices: number[]) =>
      indices.reduce((sum, index) => sum + perplexities[index]!, 0) / indices.length
    const bookIndices = indicesOf('books')
    const codeIndices = indicesOf('code')
    // each reference model prefers its own domain, which is the fragility a
    // cross-modal score is meant to avoid
    expect(meanAt(scored[0]!.perplexities, codeIndices)).toBeGreaterThan(meanAt(scored[0]!.perplexities, bookIndices))
    expect(meanAt(scored[1]!.perplexities, bookIndices)).toBeGreaterThan(meanAt(scored[1]!.perplexities, codeIndices))
  })

  it('returns an empty result for an empty pool', () => {
    const result = adaptivePerplexityFilter([], { keepFraction: 0.5 })
    expect(result.kept).toEqual([])
    expect(result.threshold).toBe(0)
    expect(result.perplexities).toEqual([])
  })
})
