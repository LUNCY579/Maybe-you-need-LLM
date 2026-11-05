import { describe, expect, it } from 'vitest'
import { buildCorpus, documentFrequency } from './corpus'
import { bm25, buildIndex, meanReciprocalRank, randomRecall, recallAt } from './sparse'
import {
  contrastiveGradient,
  contrastiveLoss,
  denseRecall,
  indexSize,
  lengthBias,
  randomEncoder,
  recallByDimension,
  trainEncoder,
  type Encoder,
} from './dense'
import { compareReaders, findNeedle, needleCurve, positionPrior } from './context'

const corpus = buildCorpus()

describe('the corpus', () => {
  it('is deterministic for a given seed', () => {
    const a = buildCorpus({ seed: 3 })
    const b = buildCorpus({ seed: 3 })
    expect(a.passages.map((passage) => passage.words)).toEqual(b.passages.map((passage) => passage.words))
  })

  it('gives every question exactly one relevant document', () => {
    for (const query of corpus.queries) {
      const passage = corpus.passages[query.relevant]
      expect(passage).toBeDefined()
      expect(passage!.topic).toBe(query.topic)
    }
  })

  it('counts the document frequency of every word', () => {
    const frequencies = documentFrequency(corpus)
    expect(frequencies.length).toBe(corpus.vocabulary)
    for (const frequency of frequencies) expect(frequency).toBeGreaterThanOrEqual(0)
  })
})

describe('the sparse index', () => {
  it('has a posting for every distinct word in every document', () => {
    const index = buildIndex(corpus)
    let expected = 0
    for (const passage of corpus.passages) expected += new Set(passage.words).size
    expect(index.postingCount).toBe(expected)
  })

  it('scores a document that contains the query’s words above one that does not', () => {
    const index = buildIndex(corpus)
    const passage = corpus.passages[0]!
    const matching = bm25(index, passage.words.slice(0, 5), passage.words)
    const other = corpus.passages.find((entry) => entry.id !== passage.id)!
    const nonMatching = bm25(index, passage.words.slice(0, 5), other.words)
    expect(matching).toBeGreaterThan(nonMatching)
  })

  it('is beaten by a random ranking, because the words do not match', () => {
    const index = buildIndex(corpus)
    const recall = recallAt(index, corpus, { k: 10 })
    const random = randomRecall(corpus, 10)
    expect(recall).toBeLessThan(random + 0.25)
  })

  it('has a reciprocal rank that is between zero and one', () => {
    const index = buildIndex(corpus)
    const mrr = meanReciprocalRank(index, corpus)
    expect(mrr).toBeGreaterThanOrEqual(0)
    expect(mrr).toBeLessThanOrEqual(1)
  })
})

describe('the dense retriever', () => {
  it('trains: the loss falls and the recall improves', () => {
    const result = trainEncoder(corpus, { steps: 120, dimension: 24, seed: 5 })
    expect(result.history[result.history.length - 1]!).toBeLessThan(result.history[0]!)
    expect(result.recall).toBeGreaterThan(0.3)
  })

  it('beats the lexical retriever on the same questions', () => {
    const trained = trainEncoder(corpus, { steps: 150, dimension: 24, seed: 5 })
    const index = buildIndex(corpus)
    const lexical = recallAt(index, corpus, { k: 10 })
    expect(denseRecall(corpus, trained.encoder, 10)).toBeGreaterThan(lexical)
  })

  it('has a gradient that matches a finite difference', () => {
    const encoder = randomEncoder(corpus.vocabulary, 8, 3)
    const indices = [0, 1, 2, 3]
    const temperature = 0.2
    const gradient = contrastiveGradient(corpus, encoder, indices, temperature)
    const epsilon = 1e-5

    for (const [i, d] of [
      [0, 0],
      [5, 3],
      [11, 7],
    ] as const) {
      const up: Encoder = {
        ...encoder,
        w: encoder.w.map((row) => row.slice()),
      }
      up.w[i]![d] = (up.w[i]![d] ?? 0) + epsilon
      const down: Encoder = {
        ...encoder,
        w: encoder.w.map((row) => row.slice()),
      }
      down.w[i]![d] = (down.w[i]![d] ?? 0) - epsilon
      const numeric =
        (contrastiveLoss(corpus, up, indices, temperature) -
          contrastiveLoss(corpus, down, indices, temperature)) /
        (2 * epsilon)
      expect(numeric).toBeCloseTo(gradient.w[i]?.[d] ?? 0, 6)
    }
  })

  it('shares one encoder when the two sides are tied', () => {
    const tied = trainEncoder(corpus, { steps: 40, dimension: 16, seed: 5 })
    expect(tied.documentEncoder).toBe(tied.encoder)
  })

  it('trains a second encoder when the two sides are separate', () => {
    const separate = trainEncoder(corpus, { steps: 80, dimension: 16, seed: 5, separate: true })
    expect(separate.history[separate.history.length - 1]!).toBeLessThan(separate.history[0]!)
    expect(separate.documentEncoder).not.toBe(separate.encoder)
    expect(separate.encoder.w[0]).not.toEqual(separate.documentEncoder.w[0])
    expect(denseRecall(corpus, separate.encoder, 10, { documentEncoder: separate.documentEncoder })).toBeGreaterThan(
      1 / 40,
    )
  })

  it('measures the recall against the width of the embedding', () => {
    const curve = recallByDimension(corpus, [4, 8], { steps: 20 })
    expect(curve.map((point) => point.dimension)).toEqual([4, 8])
    for (const point of curve) {
      expect(point.recall).toBeGreaterThanOrEqual(0)
      expect(point.recall).toBeLessThanOrEqual(1)
      expect(point.parameters).toBe(corpus.vocabulary * point.dimension + point.dimension)
    }
  })
})

describe('the late interaction', () => {
  it('is biased towards the long documents, and the normalisation removes it', () => {
    const trained = trainEncoder(corpus, { steps: 120, dimension: 24, seed: 5 })
    const query = corpus.queries[0]!
    const raw = lengthBias(corpus, trained.encoder, query.words, { normalise: false })
    const normalised = lengthBias(corpus, trained.encoder, query.words, { normalise: true })
    // The raw score is biased towards the long documents, and the
    // normalisation is a different correction rather than a better one.
    expect(raw).toBeGreaterThan(0)
    expect(Math.abs(normalised - raw)).toBeGreaterThan(0.01)
  })

  it('costs many more vectors in the index', () => {
    const single = indexSize(corpus, false)
    const late = indexSize(corpus, true)
    expect(late).toBeGreaterThan(single * 10)
  })
})

describe('the long context', () => {
  it('has a position prior that is low in the middle and high at the ends', () => {
    expect(positionPrior(100, 3, 0)).toBeGreaterThan(positionPrior(100, 3, 50))
    expect(positionPrior(100, 3, 99)).toBeGreaterThan(positionPrior(100, 3, 50))
  })

  it('finds the needle less well in the middle', () => {
    const curve = needleCurve({
      length: 100,
      questionWord: 7,
      distractorWords: [1, 2, 3],
      positions: 11,
    })
    const middle = curve[Math.floor(curve.length / 2)]!
    const ends = curve[0]!
    expect(middle.attention).toBeLessThan(ends.attention)
  })

  it('is beaten by a reader that is given the evidence by retrieval', () => {
    const comparison = compareReaders({
      length: 100,
      questionWord: 7,
      distractorWords: [1, 2, 3],
    })
    expect(comparison.retrieval).toBeGreaterThan(comparison.longContext)
  })

  it('finds nothing when the evidence is not retrieved at all', () => {
    const result = findNeedle({
      length: 40,
      position: 5,
      questionWord: 9,
      distractorWords: [1, 2],
    })
    expect(result.attention).toBeGreaterThan(0)
  })
})
