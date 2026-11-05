/**
 * Sparse retrieval: BM25 and the index behind it.
 *
 * BM25 is the score that most lexical retrieval still uses. Two terms do the
 * work: the inverse document frequency, which says how rare a word is, and the
 * length normalisation, which says how much of a match is a coincidence.
 *
 * The laboratory measures the recall of the retriever against the known
 * relevant document, and it measures the cost of the index: the number of
 * postings is what a lexical index actually spends.
 */

import { averageLength, documentFrequency, type Corpus } from './corpus'

export interface Bm25Options {
  /** The term-frequency saturation parameter. */
  k1?: number
  /** The length-normalisation parameter. */
  b?: number
}

export interface Bm25Index {
  /** The postings: for each word, the documents that contain it. */
  postings: Map<number, { id: number; frequency: number }[]>
  /** The inverse document frequency of every word. */
  idf: number[]
  /** The average document length. */
  averageLength: number
  /** The number of documents. */
  documents: number
  /** The number of postings, which is the size of the index. */
  postingCount: number
}

/** Build the index. */
export function buildIndex(corpus: Corpus): Bm25Index {
  const postings = new Map<number, { id: number; frequency: number }[]>()
  let postingCount = 0
  for (const passage of corpus.passages) {
    const counts = new Map<number, number>()
    for (const word of passage.words) counts.set(word, (counts.get(word) ?? 0) + 1)
    for (const [word, frequency] of counts) {
      const list = postings.get(word)
      if (list) list.push({ id: passage.id, frequency })
      else postings.set(word, [{ id: passage.id, frequency }])
      postingCount++
    }
  }
  const frequencies = documentFrequency(corpus)
  const idf = frequencies.map((frequency) => {
    const probability = frequency / Math.max(1, corpus.passages.length)
    return Math.log(1 + (1 - probability + 0.5) / (probability + 0.5))
  })
  return {
    postings,
    idf,
    averageLength: averageLength(corpus),
    documents: corpus.passages.length,
    postingCount,
  }
}

/** The BM25 score of a query against one document. */
export function bm25(
  index: Bm25Index,
  queryWords: number[],
  documentWords: number[],
  options: Bm25Options = {},
): number {
  const settings = { k1: 1.2, b: 0.75, ...options }
  const counts = new Map<number, number>()
  for (const word of documentWords) counts.set(word, (counts.get(word) ?? 0) + 1)
  const length = documentWords.length || 1
  let score = 0
  for (const word of queryWords) {
    const frequency = counts.get(word) ?? 0
    if (frequency === 0) continue
    const idf = index.idf[word] ?? 0
    const numerator = frequency * (settings.k1 + 1)
    const denominator =
      frequency + settings.k1 * (1 - settings.b + settings.b * (length / (index.averageLength || 1)))
    score += idf * (numerator / denominator)
  }
  return score
}

/** The ranked documents for a query. */
export function rank(
  index: Bm25Index,
  corpus: Corpus,
  queryWords: number[],
  options: Bm25Options = {},
): { id: number; score: number }[] {
  const scores = corpus.passages.map((passage) => ({
    id: passage.id,
    score: bm25(index, queryWords, passage.words, options),
  }))
  scores.sort((a, b) => b.score - a.score)
  return scores
}

/** The recall at k: the fraction of the questions whose answer is in the top k. */
export function recallAt(
  index: Bm25Index,
  corpus: Corpus,
  options: Bm25Options & { k?: number } = {},
): number {
  const settings = { k: 10, ...options }
  let hits = 0
  for (const query of corpus.queries) {
    const ranked = rank(index, corpus, query.words, settings)
    if (ranked.slice(0, settings.k).some((entry) => entry.id === query.relevant)) hits++
  }
  return corpus.queries.length === 0 ? 0 : hits / corpus.queries.length
}

/**
 * The recall of a random ranking.
 *
 * It is the number to beat: a retriever that cannot do better than this has
 * learned nothing.
 */
export function randomRecall(corpus: Corpus, k: number, seed = 1): number {
  let hits = 0
  for (let i = 0; i < corpus.queries.length; i++) {
    const query = corpus.queries[i]!
    // A deterministic pseudo-random position.
    const position = (seed * 7919 * (i + 1) * 104729) % corpus.passages.length
    const drawn: number[] = []
    for (let j = 0; j < k; j++) drawn.push((position + j * 37) % corpus.passages.length)
    if (drawn.includes(query.relevant)) hits++
  }
  return corpus.queries.length === 0 ? 0 : hits / corpus.queries.length
}

/** The mean reciprocal rank of the relevant document. */
export function meanReciprocalRank(
  index: Bm25Index,
  corpus: Corpus,
  options: Bm25Options = {},
): number {
  let total = 0
  for (const query of corpus.queries) {
    const ranked = rank(index, corpus, query.words, options)
    const position = ranked.findIndex((entry) => entry.id === query.relevant)
    if (position >= 0) total += 1 / (position + 1)
  }
  return corpus.queries.length === 0 ? 0 : total / corpus.queries.length
}
