/**
 * Dense retrieval, and the late interaction that improves on it.
 *
 * A dense retriever embeds the question and the document separately and
 * compares the two vectors. The embedding is learned, and the objective is the
 * contrastive one: the question should be closer to its own answer than to
 * the other answers in the batch.
 *
 * The late-interaction retriever keeps one vector per *token* and scores a
 * pair by the sum over the question's tokens of the best-matching token in
 * the document. It is more accurate and its index is much larger, and the
 * laboratory measures both.
 *
 * The gradient is the shared automatic-differentiation engine's, and the test
 * suite checks it against a finite difference.
 */

import {
  addBias,
  adCrossEntropy as crossEntropy,
  adMatmul as matmul,
  adTranspose as transpose,
  scale,
  Tape,
} from '@llm-materials/course-core'
import { createRng } from '@llm-materials/course-core'
import type { Corpus } from './corpus'

export interface Encoder {
  /** The projection from the bag of words to the embedding. */
  w: number[][]
  /** The bias. */
  b: number[]
  /** The dimension of the embedding. */
  dimension: number
}

/** A random projection, which is the starting point of the training. */
export function randomEncoder(vocabulary: number, dimension: number, seed = 1): Encoder {
  const rng = createRng(seed)
  const w: number[][] = []
  for (let i = 0; i < vocabulary; i++) {
    const row: number[] = []
    for (let d = 0; d < dimension; d++) row.push((rng() * 2 - 1) * 0.1)
    w.push(row)
  }
  return { w, b: new Array<number>(dimension).fill(0), dimension }
}

/** The bag-of-words vector of a document or a question. */
export function bagOfWords(words: number[], vocabulary: number): number[] {
  const vector = new Array<number>(vocabulary).fill(0)
  for (const word of words) vector[word] = (vector[word] ?? 0) + 1
  // The length is normalised away, so that a long document is not simply
  // closer to everything.
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => value / norm)
}

/** The embedding of a bag of words, as a plain array. */
export function embed(encoder: Encoder, bag: number[]): number[] {
  const result = new Array<number>(encoder.dimension).fill(0)
  for (let i = 0; i < bag.length; i++) {
    const weight = bag[i] ?? 0
    if (weight === 0) continue
    const row = encoder.w[i]!
    for (let d = 0; d < encoder.dimension; d++) result[d] = (result[d] ?? 0) + weight * (row[d] ?? 0)
  }
  return result.map((value, index) => value + (encoder.b[index] ?? 0))
}

/** The dot product of two vectors. */
export function dot(a: number[], b: number[]): number {
  let total = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) total += (a[i] ?? 0) * (b[i] ?? 0)
  return total
}

export interface TrainingResult {
  encoder: Encoder
  /** The encoder of the documents. The same object as `encoder` when the two are tied. */
  documentEncoder: Encoder
  /** The loss at each step. */
  history: number[]
  /** The recall at ten, measured on the training questions. */
  recall: number
}

/**
 * Train the encoder with the contrastive objective.
 *
 * The batch's positives are on the diagonal, and the other rows of the batch
 * are the negatives. The loss is the cross-entropy of the diagonal, and the
 * gradient comes from the shared tape.
 */
export function trainEncoder(
  corpus: Corpus,
  options: {
    dimension?: number
    steps?: number
    learningRate?: number
    temperature?: number
    batchSize?: number
    seed?: number
    /** Give the questions and the documents an encoder each, rather than one. */
    separate?: boolean
  } = {},
): TrainingResult {
  const settings = {
    dimension: 32,
    steps: 200,
    learningRate: 0.5,
    temperature: 0.1,
    batchSize: 16,
    seed: 2,
    separate: false,
    ...options,
  }

  let encoder = randomEncoder(corpus.vocabulary, settings.dimension, settings.seed)
  let documentEncoder = settings.separate
    ? randomEncoder(corpus.vocabulary, settings.dimension, settings.seed + 7)
    : encoder
  const rng = createRng(settings.seed + 1)
  const history: number[] = []

  const queryBags = corpus.queries.map((query) => bagOfWords(query.words, corpus.vocabulary))
  const passageBags = corpus.passages.map((passage) => bagOfWords(passage.words, corpus.vocabulary))

  for (let step = 0; step < settings.steps; step++) {
    // A batch of questions and their answers.
    const chosen: number[] = []
    while (chosen.length < settings.batchSize) {
      const index = Math.floor(rng() * corpus.queries.length)
      if (!chosen.includes(index)) chosen.push(index)
    }
    const positives = chosen.map((index) => corpus.queries[index]!.relevant)

    const tape = new Tape()
    const weights = tape.parameter(flatten(encoder.w), [corpus.vocabulary, settings.dimension])
    const bias = tape.parameter(encoder.b, [settings.dimension])
    const documentWeights = settings.separate
      ? tape.parameter(flatten(documentEncoder.w), [corpus.vocabulary, settings.dimension])
      : weights
    const documentBias = settings.separate ? tape.parameter(documentEncoder.b, [settings.dimension]) : bias
    const queryFeatures = tape.parameter(
      chosen.flatMap((index) => queryBags[index]!),
      [chosen.length, corpus.vocabulary],
    )
    const passageFeatures = tape.parameter(
      positives.flatMap((id) => passageBags[id]!),
      [chosen.length, corpus.vocabulary],
    )

    const queryEmbeddings = matmul(tape, queryFeatures, weights)
    const passageEmbeddings = matmul(tape, passageFeatures, documentWeights)
    const queryBias = addBias(tape, queryEmbeddings, bias)
    const passageBias = addBias(tape, passageEmbeddings, documentBias)

    // The logits: the question against every answer in the batch.
    const logits = matmul(tape, queryBias, transpose(tape, passageBias))
    const scaled = scale(tape, logits, 1 / settings.temperature)
    const targets = chosen.map((_, index) => index)
    const loss = crossEntropy(tape, scaled, targets)
    tape.backward(loss)

    // The step: the gradient with respect to the projection and the bias.
    const scale_ = settings.learningRate / chosen.length
    const nextW = unflatten(weights.grad, corpus.vocabulary, settings.dimension)
    for (let i = 0; i < nextW.length; i++) {
      for (let d = 0; d < settings.dimension; d++) {
        nextW[i]![d] = (encoder.w[i]![d] ?? 0) - scale_ * (nextW[i]![d] ?? 0)
      }
    }
    const nextB = bias.grad.map((value, index) => (encoder.b[index] ?? 0) - scale_ * value)
    encoder = { w: nextW, b: nextB, dimension: settings.dimension }

    if (settings.separate) {
      const nextDocumentW = unflatten(documentWeights.grad, corpus.vocabulary, settings.dimension)
      for (let i = 0; i < nextDocumentW.length; i++) {
        for (let d = 0; d < settings.dimension; d++) {
          nextDocumentW[i]![d] = (documentEncoder.w[i]![d] ?? 0) - scale_ * (nextDocumentW[i]![d] ?? 0)
        }
      }
      const nextDocumentB = documentBias.grad.map(
        (value, index) => (documentEncoder.b[index] ?? 0) - scale_ * value,
      )
      documentEncoder = { w: nextDocumentW, b: nextDocumentB, dimension: settings.dimension }
    }
    history.push(loss.data[0] ?? 0)
  }

  const finalDocumentEncoder = settings.separate ? documentEncoder : encoder
  return {
    encoder,
    documentEncoder: finalDocumentEncoder,
    history,
    recall: denseRecall(corpus, encoder, 10, { documentEncoder: finalDocumentEncoder }),
  }
}

/** Flatten a matrix into a row-major array. */
export function flatten(matrix: number[][]): number[] {
  return matrix.flatMap((row) => row.slice())
}

/** Reshape a flat array into a matrix. */
export function unflatten(values: number[], rows: number, columns: number): number[][] {
  const result: number[][] = []
  for (let r = 0; r < rows; r++) {
    const row: number[] = []
    for (let c = 0; c < columns; c++) row.push(values[r * columns + c] ?? 0)
    result.push(row)
  }
  return result
}

/** The ranked passages for a question, under a single-vector retriever. */
export function denseRank(
  corpus: Corpus,
  encoder: Encoder,
  queryWords: number[],
  options: { documentEncoder?: Encoder } = {},
): { id: number; score: number }[] {
  const documentEncoder = options.documentEncoder ?? encoder
  const queryEmbedding = embed(encoder, bagOfWords(queryWords, corpus.vocabulary))
  const scores = corpus.passages.map((passage) => ({
    id: passage.id,
    score: dot(queryEmbedding, embed(documentEncoder, bagOfWords(passage.words, corpus.vocabulary))),
  }))
  scores.sort((a, b) => b.score - a.score)
  return scores
}

/** The recall at k of a single-vector retriever. */
export function denseRecall(
  corpus: Corpus,
  encoder: Encoder,
  k: number,
  options: { documentEncoder?: Encoder } = {},
): number {
  let hits = 0
  for (const query of corpus.queries) {
    const ranked = denseRank(corpus, encoder, query.words, options)
    if (ranked.slice(0, k).some((entry) => entry.id === query.relevant)) hits++
  }
  return corpus.queries.length === 0 ? 0 : hits / corpus.queries.length
}

/**
 * The recall of the dense retriever as a function of the embedding width.
 *
 * Every width is trained for the same number of steps, so the curve measures
 * what the width buys rather than what more training buys. The default is
 * deliberately short: the point of the curve is its shape, and the
 * laboratory says so on screen.
 */
export function recallByDimension(
  corpus: Corpus,
  dimensions: number[] = [4, 8, 16, 24, 32, 48, 64],
  options: { steps?: number; seed?: number } = {},
): { dimension: number; recall: number; parameters: number }[] {
  const settings = { steps: 60, seed: 5, ...options }
  return dimensions.map((dimension) => {
    const trained = trainEncoder(corpus, {
      dimension,
      steps: settings.steps,
      seed: settings.seed,
    })
    return {
      dimension,
      recall: denseRecall(corpus, trained.encoder, 10),
      parameters: corpus.vocabulary * dimension + dimension,
    }
  })
}

/* -------------------------------------------------------------------------- */
/* Late interaction                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The MaxSim score.
 *
 * For each word of the question, the best-matching word of the document, and
 * the sum. The passage's token vectors are computed once and stored; the
 * question's are computed at query time.
 */
export function maxSimScore(
  encoder: Encoder,
  queryWords: number[],
  passageWords: number[],
  vocabulary: number,
  options: { normalise?: boolean } = {},
): number {
  const settings = { normalise: false, ...options }
  // A document's repeated words are the same candidate, so the distinct set is
  // what the maximum is taken over.
  const distinct = [...new Set(passageWords)]
  const passageVectors = distinct.map((word) => embed(encoder, oneHot(word, vocabulary)))
  let total = 0
  for (const word of queryWords) {
    const queryVector = embed(encoder, oneHot(word, vocabulary))
    let best = -Infinity
    for (const passageVector of passageVectors) {
      const similarity = dot(queryVector, passageVector)
      if (similarity > best) best = similarity
    }
    total += best === -Infinity ? 0 : best
  }
  // The maximum is taken over more candidates in a longer document, so the raw
  // sum is biased towards the long ones. Dividing by the number of candidates
  // over-corrects, and the laboratory measures both.
  return settings.normalise ? total / Math.max(1, passageVectors.length) : total
}

function oneHot(word: number, vocabulary: number): number[] {
  const vector = new Array<number>(vocabulary).fill(0)
  vector[word] = 1
  return vector
}

/** The ranked passages for a question, under a late-interaction retriever. */
export function lateInteractionRank(
  corpus: Corpus,
  encoder: Encoder,
  queryWords: number[],
  options: { normalise?: boolean } = {},
): { id: number; score: number }[] {
  const scores = corpus.passages.map((passage) => ({
    id: passage.id,
    score: maxSimScore(encoder, queryWords, passage.words, corpus.vocabulary, options),
  }))
  scores.sort((a, b) => b.score - a.score)
  return scores
}

/** The recall at k of a late-interaction retriever. */
export function lateInteractionRecall(
  corpus: Corpus,
  encoder: Encoder,
  k: number,
  options: { normalise?: boolean } = {},
): number {
  let hits = 0
  for (const query of corpus.queries) {
    const ranked = lateInteractionRank(corpus, encoder, query.words, options)
    if (ranked.slice(0, k).some((entry) => entry.id === query.relevant)) hits++
  }
  return corpus.queries.length === 0 ? 0 : hits / corpus.queries.length
}

/**
 * The length bias of the late-interaction score.
 *
 * The maximum is taken over more candidates in a longer document, so the raw
 * score grows with the length whether or not the document is more relevant.
 * The correlation between the score and the length measures it.
 */
export function lengthBias(
  corpus: Corpus,
  encoder: Encoder,
  queryWords: number[],
  options: { normalise?: boolean } = {},
): number {
  const lengths = corpus.passages.map((passage) => passage.words.length)
  const scores = corpus.passages.map(
    (passage) => maxSimScore(encoder, queryWords, passage.words, corpus.vocabulary, options),
  )
  const meanLength = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length)
  const meanScore = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length)
  let covariance = 0
  let varianceLength = 0
  let varianceScore = 0
  for (let i = 0; i < lengths.length; i++) {
    const dl = (lengths[i] ?? 0) - meanLength
    const ds = (scores[i] ?? 0) - meanScore
    covariance += dl * ds
    varianceLength += dl * dl
    varianceScore += ds * ds
  }
  if (varianceLength === 0 || varianceScore === 0) return 0
  return covariance / Math.sqrt(varianceLength * varianceScore)
}

/**
 * The size of the index, in vectors.
 *
 * A single-vector index stores one vector per document; a late-interaction
 * index stores one per token. The ratio is the price of the accuracy.
 */
export function indexSize(corpus: Corpus, lateInteraction: boolean): number {
  if (!lateInteraction) return corpus.passages.length
  let tokens = 0
  for (const passage of corpus.passages) tokens += passage.words.length
  return tokens
}

/** The loss of the contrastive objective on a batch, for the gradient check. */
export function contrastiveLoss(
  corpus: Corpus,
  encoder: Encoder,
  indices: number[],
  temperature: number,
): number {
  const tape = new Tape()
  const queryBags = corpus.queries.map((query) => bagOfWords(query.words, corpus.vocabulary))
  const passageBags = corpus.passages.map((passage) => bagOfWords(passage.words, corpus.vocabulary))
  const positives = indices.map((index) => corpus.queries[index]!.relevant)
  const weights = tape.parameter(flatten(encoder.w), [corpus.vocabulary, encoder.dimension])
  const bias = tape.parameter(encoder.b, [encoder.dimension])
  const queryFeatures = tape.parameter(
    indices.flatMap((index) => queryBags[index]!),
    [indices.length, corpus.vocabulary],
  )
  const passageFeatures = tape.parameter(
    positives.flatMap((id) => passageBags[id]!),
    [indices.length, corpus.vocabulary],
  )
  const queryEmbeddings = matmul(tape, queryFeatures, weights)
  const passageEmbeddings = matmul(tape, passageFeatures, weights)
  const queryBias = addBias(tape, queryEmbeddings, bias)
  const passageBias = addBias(tape, passageEmbeddings, bias)
  const logits = matmul(tape, queryBias, transpose(tape, passageBias))
  const scaled = scale(tape, logits, 1 / temperature)
  return crossEntropy(tape, scaled, indices.map((_, index) => index)).data[0] ?? 0
}

/**
 * The gradient of the contrastive loss with respect to the projection.
 *
 * Exported so that the test suite can compare it against a central finite
 * difference of the loss.
 */
export function contrastiveGradient(
  corpus: Corpus,
  encoder: Encoder,
  indices: number[],
  temperature: number,
): { w: number[][]; b: number[] } {
  const tape = new Tape()
  const queryBags = corpus.queries.map((query) => bagOfWords(query.words, corpus.vocabulary))
  const passageBags = corpus.passages.map((passage) => bagOfWords(passage.words, corpus.vocabulary))
  const positives = indices.map((index) => corpus.queries[index]!.relevant)
  const weights = tape.parameter(flatten(encoder.w), [corpus.vocabulary, encoder.dimension])
  const bias = tape.parameter(encoder.b, [encoder.dimension])
  const queryFeatures = tape.parameter(
    indices.flatMap((index) => queryBags[index]!),
    [indices.length, corpus.vocabulary],
  )
  const passageFeatures = tape.parameter(
    positives.flatMap((id) => passageBags[id]!),
    [indices.length, corpus.vocabulary],
  )
  const queryEmbeddings = matmul(tape, queryFeatures, weights)
  const passageEmbeddings = matmul(tape, passageFeatures, weights)
  const queryBias = addBias(tape, queryEmbeddings, bias)
  const passageBias = addBias(tape, passageEmbeddings, bias)
  const logits = matmul(tape, queryBias, transpose(tape, passageBias))
  const scaled = scale(tape, logits, 1 / temperature)
  const loss = crossEntropy(tape, scaled, indices.map((_, index) => index))
  tape.backward(loss)
  return {
    w: unflatten(weights.grad, corpus.vocabulary, encoder.dimension),
    b: bias.grad.slice(),
  }
}
