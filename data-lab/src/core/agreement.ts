/**
 * Filtering by the agreement of two views — what the CLIP filter is doing.
 *
 * DataComp's most discussed filter is a CLIP score: keep an image-text pair when
 * the two modalities agree about what the pair is *of*. The surprising part of
 * their result was not that the filter cleans data — every filter does that — but
 * that a cross-modal score kept working on out-of-distribution evaluations where
 * the unimodal heuristics did not. The reason is structural rather than specific
 * to CLIP, and it has two halves:
 *
 * 1. a pair carries two independent measurements of the same fact, so a document
 *    that looks normal to one view and wrong to the other is visible at all; and
 * 2. the score does not depend on the statistics of the pool it is run on, which
 *    is where a perplexity filter is fragile: a reference model fit on one corner
 *    of the corpus rates every other corner as surprising.
 *
 * This corpus has no images, so the two views here are the two the generator
 * actually provides, and they share no parameters:
 *
 * - the **discriminative view** is a linear classifier over the bag of words,
 *   which answers "which topic do these words vote for, and how confidently";
 * - the **generative view** is the corpus's topic distributions, which answer
 *   "which topic explains this token sequence best".
 *
 * The score is the classifier's posterior for the topic the generative view
 * chose. A document whose words vote one way and whose text reads like another is
 * a mismatch, and neither view reports it alone.
 *
 * `document.topic`, `quality`, `isSpam` and `isForeign` are ground truth, so both
 * halves of the claim are measured, and they come out differently. The first half
 * reproduces: the agreement score drops all 32 unwanted documents of the pool at
 * every keep fraction, at the cost of fewer clean documents than the perplexity
 * rule spends, because a document can look normal to one view and wrong to the
 * other. The second half does not. Cutting the perplexity rule's reference model
 * down to one domain barely changes what it removes — the kept mean quality moves
 * from 0.5806 to 0.5801 — because both views here read the same 48 tokens, so
 * they share the statistics the argument says a cross-modal score escapes. A real
 * CLIP filter has a text encoder and an image encoder with nothing in common; the
 * null result is about the analogue, not about CLIP. See the tests beside this
 * file, which compare this filter with a perplexity filter that removes exactly as
 * many documents, and with a perplexity filter whose reference model saw only one
 * domain.
 */

import { normalisedBag, type Corpus, type Document } from './corpus'
import { adaptivePerplexityFilter } from './midas'
import { predict, softmax, trainClassifier } from './model'

/** A document as the two views see it. */
export interface AgreementScore {
  id: number
  /** The topic the bag-of-words classifier chooses. */
  votedTopic: number
  /** The topic whose distribution best explains the token sequence. */
  generativeTopic: number
  /** The classifier's probability for the generative topic — the agreement score. */
  score: number
  /** Whether the two views chose the same topic at all. */
  agree: boolean
  /** The classifier's own confidence in its choice, for the disagreement table. */
  voteConfidence: number
  topic: number
  quality: number
  isSpam: boolean
  isForeign: boolean
}

/** The mean per-token log probability of the document under each topic distribution. */
export function topicLogLikelihoods(document: Document, topicDistributions: number[][], floor = 1e-9): number[] {
  return topicDistributions.map((distribution) => {
    let total = 0
    for (const token of document.tokens) total += Math.log((distribution[token] ?? 0) + floor)
    return total / Math.max(1, document.tokens.length)
  })
}

/** The topic the generative view prefers. */
export function generativeTopic(document: Document, topicDistributions: number[][]): number {
  const scores = topicLogLikelihoods(document, topicDistributions)
  let best = 0
  for (let i = 1; i < scores.length; i++) if ((scores[i] ?? 0) > (scores[best] ?? 0)) best = i
  return best
}

/**
 * Score every document of a pool by two-view agreement.
 *
 * The classifier is fit on the first `fitFraction` of the pool — the same shape
 * of decision a real pipeline makes, in which the scoring model is trained on
 * data the filter then judges.
 */
export function scoreAgreement(
  corpus: Corpus,
  pool: Document[],
  options: { fitFraction?: number; steps?: number; learningRate?: number } = {},
): AgreementScore[] {
  const settings = { fitFraction: 0.4, steps: 200, learningRate: 0.5, ...options }
  if (pool.length === 0) return []

  const fitCount = Math.max(2, Math.floor(pool.length * settings.fitFraction))
  const trained = trainClassifier(
    pool.slice(0, fitCount).map((document) => ({
      features: normalisedBag(document, corpus.vocabulary),
      label: document.topic,
      group: document.id,
    })),
    corpus.topics,
    corpus.vocabulary,
    { steps: settings.steps, learningRate: settings.learningRate },
  )

  return pool.map((document) => {
    const features = normalisedBag(document, corpus.vocabulary)
    const posteriors = softmax(trained.weights.w.map((row, index) => {
      let score = trained.weights.b[index] ?? 0
      for (let f = 0; f < features.length; f++) score += (row[f] ?? 0) * (features[f] ?? 0)
      return score
    }))
    const generative = generativeTopic(document, corpus.topicDistributions)
    const voted = predict(trained.weights, features)
    return {
      id: document.id,
      votedTopic: voted,
      generativeTopic: generative,
      score: posteriors[generative] ?? 0,
      agree: voted === generative,
      voteConfidence: posteriors[voted] ?? 0,
      topic: document.topic,
      quality: document.quality,
      isSpam: document.isSpam,
      isForeign: document.isForeign,
    }
  })
}

export interface FilterCut {
  name: string
  kept: Document[]
  dropped: Document[]
  /** Boilerplate and unseen-language documents among the dropped ones. */
  unwantedDropped: number
  /** Documents among the dropped ones that were neither — the collateral damage. */
  cleanDropped: number
  droppedDomainShare: number
  keptMeanQuality: number
}

export interface FilterComparison {
  keepFraction: number
  agreement: FilterCut
  perplexity: FilterCut
  /** How many of the documents both rules drop, over the union of their drop sets. */
  dropSetOverlap: number
  /** Documents one rule drops and the other keeps, for each rule. */
  onlyAgreementDrops: number
  onlyPerplexityDrops: number
  /** Whether the agreement rule dropped fewer clean documents than the perplexity rule. */
  agreementDropsLessClean: boolean
}

const unwantedOf = (documents: Document[]): number =>
  documents.filter((document) => document.isSpam || document.isForeign).length

const meanQualityOf = (documents: Document[]): number =>
  documents.length === 0 ? 0 : documents.reduce((sum, document) => sum + document.quality, 0) / documents.length

/** The largest share of a document set contributed by a single domain. */
function dominantDomainShare(documents: Document[]): number {
  if (documents.length === 0) return 0
  const counts = new Map<string, number>()
  for (const document of documents) counts.set(document.domain, (counts.get(document.domain) ?? 0) + 1)
  return Math.max(...counts.values()) / documents.length
}

function cut(name: string, kept: Document[], dropped: Document[]): FilterCut {
  return {
    name,
    kept,
    dropped,
    unwantedDropped: unwantedOf(dropped),
    cleanDropped: dropped.length - unwantedOf(dropped),
    droppedDomainShare: dominantDomainShare(dropped),
    keptMeanQuality: meanQualityOf(kept),
  }
}

/**
 * The same pool, cut to the same size by each rule.
 *
 * This is the comparison the item asks for: not "is agreement good" but "what
 * does a second view buy over a score from one model, when both throw away the
 * same number of documents". `referenceDomains` restricts which domains the
 * perplexity model is fit on, which is the fragile case: a reference model that
 * saw only `books` is surprised by everything else.
 */
export function compareFilters(
  corpus: Corpus,
  pool: Document[],
  options: { keepFraction?: number; referenceDomains?: string[] } = {},
): FilterComparison {
  const keepFraction = options.keepFraction ?? 0.6
  const agreementScores = scoreAgreement(corpus, pool)
  const ordered = agreementScores
    .map((score, index) => ({ score: score.score, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
  const keepCount = Math.min(pool.length, Math.max(1, Math.round(pool.length * keepFraction)))
  const keepSet = new Set(ordered.slice(0, keepCount).map((entry) => entry.index))
  const agreementKept: Document[] = []
  const agreementDropped: Document[] = []
  for (let i = 0; i < pool.length; i++) (keepSet.has(i) ? agreementKept : agreementDropped).push(pool[i]!)

  const referencePool = options.referenceDomains
    ? pool.filter((document) => options.referenceDomains!.includes(document.domain))
    : undefined
  const perplexity = adaptivePerplexityFilter(pool, {
    keepFraction,
    ...(referencePool ? { referencePool } : {}),
  })

  const agreement = cut('two-view agreement', agreementKept, agreementDropped)
  const perplexityCut = cut('perplexity', perplexity.kept, perplexity.dropped)

  const agreementDrops = new Set(agreement.dropped.map((document) => document.id))
  const perplexityDrops = new Set(perplexityCut.dropped.map((document) => document.id))
  const union = new Set([...agreementDrops, ...perplexityDrops])
  let shared = 0
  for (const id of agreementDrops) if (perplexityDrops.has(id)) shared++

  return {
    keepFraction,
    agreement,
    perplexity: perplexityCut,
    dropSetOverlap: union.size === 0 ? 0 : shared / union.size,
    onlyAgreementDrops: agreementDrops.size - shared,
    onlyPerplexityDrops: perplexityDrops.size - shared,
    agreementDropsLessClean: agreement.cleanDropped < perplexityCut.cleanDropped,
  }
}
