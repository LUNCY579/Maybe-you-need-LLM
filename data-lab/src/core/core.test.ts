import { describe, expect, it } from 'vitest'
import { buildCorpus, DOMAINS, meanQuality, bagOfTokens, duplicateFraction } from './corpus'
import { deduplicate, decontaminate, jaccard, lshRecall, minhashSignature, shingles, signatureSimilarity } from './dedup'
import {
  ablationPipeline,
  alignment,
  alignmentTarget,
  documentPerplexity,
  evaluatePipeline,
  fitNGram,
  runPipeline,
  splitCorpus,
  toSamples,
} from './filters'
import {
  accuracy,
  gradientOfLoss,
  groupLosses,
  meanLoss,
  trainClassifier,
  type ClassifierWeights,
} from './model'
import {
  compareMixtures,
  drawMixture,
  fitPerDomainModels,
  groupDroMixture,
  mixtureWith,
  naturalMixture,
  solveOptimalMixture,
} from './mixture'
import {
  boundedEmpirical,
  originalDistribution,
  runCollapse,
  smoothedEmpirical,
  tailMass,
  totalVariation,
} from './collapse'

describe('the corpus', () => {
  it('is deterministic for a given seed', () => {
    const a = buildCorpus({ seed: 7, size: 120 })
    const b = buildCorpus({ seed: 7, size: 120 })
    expect(a.documents.map((document) => document.tokens)).toEqual(b.documents.map((document) => document.tokens))
  })

  it('produces a different corpus for a different seed', () => {
    const a = buildCorpus({ seed: 7, size: 120 })
    const b = buildCorpus({ seed: 8, size: 120 })
    expect(a.documents.map((document) => document.tokens)).not.toEqual(b.documents.map((document) => document.tokens))
  })

  it('keeps every token inside the vocabulary', () => {
    const corpus = buildCorpus({ seed: 3, size: 200, vocabulary: 32 })
    for (const document of corpus.documents) {
      for (const token of document.tokens) {
        expect(token).toBeGreaterThanOrEqual(0)
        expect(token).toBeLessThan(corpus.vocabulary)
      }
    }
  })

  it('produces documents of varying length', () => {
    const corpus = buildCorpus({ seed: 4, size: 200 })
    const lengths = new Set(corpus.documents.map((document) => document.tokens.length))
    expect(lengths.size).toBeGreaterThan(5)
  })

  it('makes the high-quality documents measurably better', () => {
    const corpus = buildCorpus({ seed: 11, size: 400 })
    const sorted = corpus.documents.slice().sort((a, b) => a.quality - b.quality)
    const low = sorted.slice(0, 50)
    const high = sorted.slice(-50)
    expect(meanQuality(high)).toBeGreaterThan(meanQuality(low))
  })

  it('includes near-duplicates', () => {
    const corpus = buildCorpus({ seed: 5, size: 400, duplicateRate: 0.4 })
    expect(duplicateFraction(corpus.documents)).toBeGreaterThan(0.1)
  })

  it('counts the documents in each domain', () => {
    const corpus = buildCorpus({ seed: 2, size: 100 })
    const total = corpus.documents.length
    const byDomain = new Map<string, number>()
    for (const document of corpus.documents) {
      byDomain.set(document.domain, (byDomain.get(document.domain) ?? 0) + 1)
    }
    expect([...byDomain.values()].reduce((a, b) => a + b, 0)).toBe(total)
    expect(byDomain.size).toBe(DOMAINS.length)
  })

  it('produces a bag of tokens that sums to the length', () => {
    const corpus = buildCorpus({ seed: 6, size: 50 })
    const document = corpus.documents[0]!
    const counts = bagOfTokens(document, corpus.vocabulary)
    expect(counts.reduce((a, b) => a + b, 0)).toBe(document.tokens.length)
  })
})

describe('the n-gram model and the perplexity filter', () => {
  it('gives a repetitive document a higher n-gram perplexity than an ordinary one', () => {
    const corpus = buildCorpus({ seed: 9, size: 300 })
    const background = fitNGram(corpus.documents.slice(0, 120))
    const spam = corpus.documents.find((document) => document.isSpam)!
    const ordinary = corpus.documents.find((document) => !document.isSpam && !document.isForeign && document.quality > 0.5)!
    expect(documentPerplexity(background, spam.tokens)).toBeGreaterThan(
      documentPerplexity(background, ordinary.tokens),
    )
  })

  it('gives boilerplate a *lower* unigram perplexity than ordinary text, and a higher n-gram one', () => {
    const corpus = buildCorpus({ seed: 9, size: 300 })
    const background = fitNGram(corpus.documents.slice(0, 120))
    const spam = corpus.documents.find((document) => document.isSpam)!
    const ordinary = corpus.documents.find((document) => !document.isSpam && !document.isForeign && document.quality > 0.5)!

    // The unigram model rates the boilerplate as good text...
    const unigramModel = fitNGram(corpus.documents.slice(0, 120), { order: 1 })
    const spamUnigram = documentPerplexity(unigramModel, spam.tokens)
    const ordinaryUnigram = documentPerplexity(unigramModel, ordinary.tokens)
    expect(spamUnigram).toBeLessThan(ordinaryUnigram)

    // ...and the n-gram model does not.
    expect(documentPerplexity(background, spam.tokens)).toBeGreaterThan(
      documentPerplexity(background, ordinary.tokens),
    )
  })

  it('gives the foreign documents a much higher perplexity', () => {
    const corpus = buildCorpus({ seed: 9, size: 300, foreignRate: 0.2 })
    const background = fitNGram(corpus.documents.slice(0, 120))
    const foreign = corpus.documents.find((document) => document.isForeign)!
    const ordinary = corpus.documents.find((document) => !document.isSpam && !document.isForeign)!
    expect(documentPerplexity(background, foreign.tokens)).toBeGreaterThan(
      3 * documentPerplexity(background, ordinary.tokens),
    )
  })

  it('never reports a perplexity of zero or less', () => {
    const corpus = buildCorpus({ seed: 2, size: 120 })
    const background = fitNGram(corpus.documents.slice(0, 60))
    for (const document of corpus.documents) {
      const perplexity = documentPerplexity(background, document.tokens)
      expect(perplexity).toBeGreaterThan(0)
      expect(Number.isFinite(perplexity)).toBe(true)
    }
  })
})

describe('the pipeline', () => {
  it('removes documents, and reports each stage', () => {
    const corpus = buildCorpus({ seed: 8, size: 400 })
    const result = runPipeline(corpus, { minTokens: 40, removeDuplicates: true })
    expect(result.kept.length).toBeLessThan(corpus.documents.length)
    expect(result.stages.length).toBeGreaterThan(2)
    for (const stage of result.stages) {
      expect(stage.after).toBeLessThanOrEqual(stage.before)
    }
  })

  it('keeps more documents when the perplexity threshold is raised', () => {
    const corpus = buildCorpus({ seed: 8, size: 400 })
    const strict = runPipeline(corpus, { maxPerplexity: 40 })
    const loose = runPipeline(corpus, { maxPerplexity: 100000 })
    expect(loose.kept.length).toBeGreaterThan(strict.kept.length)
  })

  it('keeps a higher mean quality than the raw corpus', () => {
    const corpus = buildCorpus({ seed: 12, size: 400 })
    const result = runPipeline(corpus, { maxPerplexity: 60, removeDuplicates: true })
    expect(result.meanQuality).toBeGreaterThan(meanQuality(corpus.documents))
  })

  it('splits the corpus deterministically into a train and a test set', () => {
    const corpus = buildCorpus({ seed: 8, size: 200 })
    const first = splitCorpus(corpus, 0.3)
    const second = splitCorpus(corpus, 0.3)
    expect(first.train.map((document) => document.id)).toEqual(second.train.map((document) => document.id))
    expect(first.train.length + first.test.length).toBe(corpus.documents.length)
    expect(first.test.length).toBeGreaterThan(0)
  })

  it('measures a model trained on what survives', () => {
    const corpus = buildCorpus({ seed: 8, size: 400 })
    const result = runPipeline(corpus, {})
    const evaluation = evaluatePipeline(corpus, result)
    expect(evaluation.accuracy).toBeGreaterThan(0.3)
    expect(evaluation.accuracy).toBeLessThanOrEqual(1)
  })

  it('reports an ablation for every filter', () => {
    const corpus = buildCorpus({ seed: 8, size: 300 })
    const { rows } = ablationPipeline(corpus, {}, { training: { steps: 120 } })
    expect(rows.length).toBe(5)
    for (const row of rows) {
      expect(Number.isFinite(row.accuracy)).toBe(true)
      expect(Number.isFinite(row.delta)).toBe(true)
    }
  })

  it('scores a document against a target direction', () => {
    const corpus = buildCorpus({ seed: 14, size: 200 })
    const target = alignmentTarget(corpus.vocabulary, corpus.topicDistributions, 0)
    const document = corpus.documents.find((entry) => entry.topic === 0)!
    const score = alignment(document, corpus.vocabulary, target)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(1 + 1e-9)
  })
})

describe('deduplication', () => {
  it('computes the Jaccard similarity of two sets', () => {
    expect(jaccard(new Set([1, 2, 3]), new Set([2, 3, 4]))).toBeCloseTo(2 / 4, 10)
    expect(jaccard(new Set([1]), new Set([1]))).toBe(1)
    expect(jaccard(new Set(), new Set())).toBe(1)
  })

  it('builds the shingles of a token sequence', () => {
    const result = shingles([1, 2, 3, 4], 2)
    expect(result.size).toBe(3)
  })

  it('estimates the Jaccard similarity from the MinHash signature', () => {
    const a = new Set([...Array(400).keys()].map((value) => value))
    const b = new Set([...Array(300).keys()].map((value) => value))
    const similarity = signatureSimilarity(minhashSignature(a, 128), minhashSignature(b, 128))
    expect(similarity).toBeGreaterThan(0.6)
    expect(similarity).toBeLessThan(0.85)
  })

  it('removes the exact duplicates', () => {
    const corpus = buildCorpus({ seed: 15, size: 200, duplicateRate: 0, spamRate: 0 })
    const documents = corpus.documents.slice(0, 50)
    const withDuplicates = [...documents, ...documents.map((document) => ({ ...document, id: document.id + 1000 }))]
    const result = deduplicate(withDuplicates, { threshold: 0.95 })
    expect(result.removed.length).toBe(50)
    expect(result.kept.length).toBe(50)
  })

  it('removes the near-duplicates', () => {
    const corpus = buildCorpus({ seed: 15, size: 200, duplicateRate: 0.5, spamRate: 0 })
    const result = deduplicate(corpus.documents, { threshold: 0.7 })
    expect(result.removed.length).toBeGreaterThan(0)
    for (const removal of result.removed) {
      expect(removal.similarity).toBeGreaterThanOrEqual(0.7)
    }
  })

  it('keeps the documents that are not similar to anything', () => {
    const corpus = buildCorpus({ seed: 16, size: 120, duplicateRate: 0, spamRate: 0 })
    const result = deduplicate(corpus.documents, { threshold: 0.95 })
    expect(result.kept.length).toBe(corpus.documents.length)
  })

  it('catches a high-similarity pair with the LSH index', () => {
    expect(lshRecall(0.9, 16, 64)).toBeGreaterThan(0.9)
    expect(lshRecall(0.1, 16, 64)).toBeLessThan(0.1)
  })

  it('removes the documents that overlap the benchmark', () => {
    const corpus = buildCorpus({ seed: 17, size: 200, duplicateRate: 0 })
    const example = corpus.documents[0]!
    const benchmark = [{ id: 'bench-1', tokens: example.tokens }]
    const result = decontaminate(corpus.documents, benchmark, { ngramSize: 8, threshold: 0.5 })
    expect(result.contaminated.length).toBe(1)
    expect(result.contaminated[0]!.id).toBe(example.id)
    expect(result.kept.length).toBe(corpus.documents.length - 1)
  })
})

describe('the classifier', () => {
  it('computes a gradient that matches a finite difference', () => {
    const corpus = buildCorpus({ seed: 21, size: 200 })
    const samples = toSamples(corpus.documents.slice(0, 20), corpus)
    const weights: ClassifierWeights = { w: [], b: [] }
    for (let c = 0; c < corpus.topics; c++) {
      weights.w.push(
        new Array<number>(corpus.vocabulary).fill(0).map((_, f) => 0.01 * ((f + c) % 7) - 0.02),
      )
      weights.b.push(0.005 * (c % 3))
    }

    const { dw, db } = gradientOfLoss(weights, samples, 0)
    const epsilon = 1e-6

    for (const [c, f] of [
      [0, 0],
      [1, 3],
      [2, 7],
    ] as const) {
      const up = { w: weights.w.map((row) => row.slice()), b: weights.b.slice() }
      up.w[c]![f] = (up.w[c]![f] ?? 0) + epsilon
      const down = { w: weights.w.map((row) => row.slice()), b: weights.b.slice() }
      down.w[c]![f] = (down.w[c]![f] ?? 0) - epsilon
      const numeric = (meanLoss(up, samples, 0) - meanLoss(down, samples, 0)) / (2 * epsilon)
      expect(numeric).toBeCloseTo(dw[c]?.[f] ?? 0, 6)
    }

    for (const c of [0, 1, 2]) {
      const up = { w: weights.w.map((row) => row.slice()), b: weights.b.slice() }
      up.b[c] = (up.b[c] ?? 0) + epsilon
      const down = { w: weights.w.map((row) => row.slice()), b: weights.b.slice() }
      down.b[c] = (down.b[c] ?? 0) - epsilon
      const numeric = (meanLoss(up, samples, 0) - meanLoss(down, samples, 0)) / (2 * epsilon)
      expect(numeric).toBeCloseTo(db[c] ?? 0, 6)
    }
  })

  it('learns something from the corpus', () => {
    const corpus = buildCorpus({ seed: 21, size: 400 })
    const { train, test } = splitCorpus(corpus, 0.3)
    const trained = trainClassifier(toSamples(train, corpus), corpus.topics, corpus.vocabulary, { steps: 400 })
    const testSamples = toSamples(test, corpus)
    expect(accuracy(trained.weights, testSamples)).toBeGreaterThan(0.3)
  })

  it('reduces the loss as it trains', () => {
    const corpus = buildCorpus({ seed: 22, size: 300 })
    const trained = trainClassifier(toSamples(corpus.documents, corpus), corpus.topics, corpus.vocabulary, { steps: 100 })
    expect(trained.history.length).toBe(100)
    expect(trained.history[99]!).toBeLessThan(trained.history[0]!)
  })

  it('reports a loss for each group', () => {
    const corpus = buildCorpus({ seed: 23, size: 200 })
    const samples = toSamples(corpus.documents, corpus)
    const trained = trainClassifier(samples, corpus.topics, corpus.vocabulary, { steps: 50 })
    const losses = groupLosses(trained.weights, samples, DOMAINS.length)
    expect(losses.length).toBe(DOMAINS.length)
    for (const loss of losses) expect(loss).toBeGreaterThan(0)
  })
})

describe('the mixture', () => {
  it('draws a sample in the proportion the mixture asks for', () => {
    const corpus = buildCorpus({ seed: 31, size: 400 })
    const weights = mixtureWith(0, 0.6)
    const drawn = drawMixture(corpus.documents, weights, 400, 5)
    const books = drawn.filter((document) => document.domain === 'books').length
    expect(books / drawn.length).toBeGreaterThan(0.4)
  })

  it('reports the natural mixture of a corpus', () => {
    const corpus = buildCorpus({ seed: 31, size: 100 })
    const weights = naturalMixture(corpus.documents)
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })

  it('moves the group weights towards the worst group as the exponent rises', () => {
    const corpus = buildCorpus({ seed: 32, size: 300 })
    const weak = groupDroMixture(corpus, { eta: 0, rounds: 4, stepsPerRound: 30, sampleSize: 160 })
    const strong = groupDroMixture(corpus, { eta: 4, rounds: 4, stepsPerRound: 30, sampleSize: 160 })
    const spread = (weights: number[]) => Math.max(...weights) - Math.min(...weights)
    expect(spread(strong.weights)).toBeGreaterThan(spread(weak.weights))
  })

  it('keeps the group weights summing to one', () => {
    const corpus = buildCorpus({ seed: 32, size: 200 })
    const result = groupDroMixture(corpus, { rounds: 3, stepsPerRound: 20, sampleSize: 120 })
    expect(result.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8)
  })

  it('solves the mixture problem in closed form', () => {
    const models = [
      { a: 2, b: 1 },
      { a: 3, b: 0.5 },
      { a: 1, b: 2 },
    ]
    const solution = solveOptimalMixture(models)
    expect(solution.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)
    for (const weight of solution.weights) expect(weight).toBeGreaterThanOrEqual(0)
    const losses = models.map((model, index) => model.a * solution.weights[index]! + model.b)
    expect(solution.worstLoss).toBeCloseTo(Math.max(...losses), 6)
  })

  it('fits a linear model of each domain’s loss', () => {
    const corpus = buildCorpus({ seed: 33, size: 200 })
    const models = fitPerDomainModels(corpus, { points: 2, sampleSize: 120, training: { steps: 80 } })
    expect(models.length).toBe(DOMAINS.length)
    for (const model of models) {
      expect(Number.isFinite(model.a)).toBe(true)
      expect(Number.isFinite(model.b)).toBe(true)
    }
  })

  it('compares the candidate mixtures on the same held-out set', () => {
    const corpus = buildCorpus({ seed: 34, size: 240 })
    const comparison = compareMixtures(
      corpus,
      [
        { name: 'natural', weights: naturalMixture(corpus.documents) },
        { name: 'uniform', weights: new Array<number>(DOMAINS.length).fill(1 / DOMAINS.length) },
      ],
      { sampleSize: 140, training: { steps: 80 } },
    )
    expect(comparison.length).toBe(2)
    for (const row of comparison) {
      expect(row.perDomainLoss.length).toBe(DOMAINS.length)
      expect(row.worstLoss).toBeGreaterThanOrEqual(row.meanLoss - 1e-9)
    }
  })
})

describe('model collapse', () => {
  it('loses the tail, and the support, generation after generation', () => {
    const records = runCollapse({ generations: 10, samples: 150, symbols: 48, seed: 4, bounded: true, support: 24 })
    const first = records[0]!
    const last = records[records.length - 1]!
    // The symbols the original put in its tail are gone.
    expect(last.survivingTailMass).toBeLessThan(first.survivingTailMass / 2)
    // The model can represent fewer and fewer symbols.
    expect(last.support).toBeLessThan(first.support)
    // And the distribution has moved a long way from the original.
    expect(last.totalVariation).toBeGreaterThan(2 * first.totalVariation)
  })

  it('floors the tail rather than losing it, when the model is unbounded', () => {
    const records = runCollapse({ generations: 8, samples: 2000, symbols: 48, seed: 4, bounded: false })
    const last = records[records.length - 1]!
    // The smoothing constant puts a floor under every symbol, so the tail
    // cannot fall to nothing.
    expect(last.survivingTailMass).toBeGreaterThan(0)
    expect(last.support).toBe(48)
    // But the head has lost mass to the tail: the distribution has flattened.
    expect(last.maxProbability).toBeLessThan(records[0]!.maxProbability)
  })

  it('keeps the tail alive when enough real data is mixed in', () => {
    const pure = runCollapse({ generations: 8, samples: 2000, symbols: 48, seed: 4, bounded: false })
    const mixed = runCollapse({
      generations: 8,
      samples: 2000,
      symbols: 48,
      seed: 4,
      bounded: false,
      realFraction: 0.5,
    })
    const pureLast = pure[pure.length - 1]!
    const mixedLast = mixed[mixed.length - 1]!
    expect(mixedLast.totalVariation).toBeLessThan(pureLast.totalVariation)
  })

  it('gives a smoothed empirical distribution that sums to one', () => {
    const sample = [0, 0, 1, 2, 2, 2, 3]
    const distribution = smoothedEmpirical(sample, 8, 1)
    expect(distribution.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    for (const value of distribution) expect(value).toBeGreaterThan(0)
  })

  it('gives a bounded model a probability of zero outside its support', () => {
    const sample = [0, 0, 0, 1, 1, 2, 2, 2, 2, 3]
    const distribution = boundedEmpirical(sample, 8, 2)
    expect(distribution[0]).toBeGreaterThan(0)
    expect(distribution[2]).toBeGreaterThan(0)
    expect(distribution[7]).toBe(0)
    expect(distribution.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })

  it('measures the total variation distance correctly', () => {
    expect(totalVariation([0.5, 0.5], [0.5, 0.5])).toBe(0)
    expect(totalVariation([1, 0], [0, 1])).toBe(1)
  })

  it('finds the tail of a distribution', () => {
    const distribution = originalDistribution({ symbols: 32 })
    const { mass } = tailMass(distribution, 0.1)
    expect(mass).toBeGreaterThan(0.05)
    expect(mass).toBeLessThan(0.2)
  })
})
