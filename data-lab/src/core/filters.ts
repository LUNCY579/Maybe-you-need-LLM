/**
 * The filtering pipeline.
 *
 * The pipeline is the spine of the course: a raw corpus goes in, a curated
 * corpus comes out, and the quality of the curation is measured by training
 * a model on what survives. Every filter below is a real algorithm, and the
 * ablation machinery is the same shape as the tables in the papers this course
 * is built on: remove one filter at a time and report what happens.
 */

import type { Corpus, Document, Domain } from './corpus'
import { bagOfTokens, DOMAIN_INDEX, DOMAINS, meanQuality, normalisedBag } from './corpus'
import { deduplicate, type DeduplicationResult } from './dedup'
import { accuracy, groupAccuracies, meanLoss, trainClassifier, type Sample, type TrainingOptions } from './model'

/* -------------------------------------------------------------------------- */
/* The background language model                                              */
/* -------------------------------------------------------------------------- */

export interface NGramModel {
  order: 1 | 2 | 3
  discount: number
  /** The smallest context count that makes an n-gram usable. */
  minContext: number
  /** The smallest count an n-gram needs before it is used at all. */
  minCount: number
  unigram: Map<number, number>
  bigram: Map<number, number>
  trigram: Map<number, number>
  total: number
  vocabulary: number
}

function bigramKey(a: number, b: number): number {
  return (a + 1) * 1_000_003 + (b + 1)
}

function trigramKey(a: number, b: number, c: number): number {
  return (a + 1) * 1_000_003 * 1_000_003 + (b + 1) * 1_000_003 + (c + 1)
}

/**
 * Fit an n-gram model with stupid backoff.
 *
 * The model is fit on a *sample* of the raw corpus, exactly as a filtering
 * pipeline fits its reference model before it starts removing anything. The
 * backoff discount is what makes a repeated phrase expensive: a trigram the
 * background never saw is charged the unigram probability times the discount
 * squared, so boilerplate is expensive even when its words are common.
 */
export function fitNGram(
  documents: Document[],
  options: { order?: 1 | 2 | 3; discount?: number; minContext?: number; minCount?: number } = {},
): NGramModel {
  const settings = { order: 3 as 1 | 2 | 3, discount: 0.4, minContext: 5, minCount: 2, ...options }
  const unigram = new Map<number, number>()
  const bigram = new Map<number, number>()
  const trigram = new Map<number, number>()
  let total = 0

  for (const document of documents) {
    const tokens = document.tokens
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!
      unigram.set(token, (unigram.get(token) ?? 0) + 1)
      total++
      if (i >= 1) {
        const key = bigramKey(tokens[i - 1]!, token)
        bigram.set(key, (bigram.get(key) ?? 0) + 1)
      }
      if (i >= 2) {
        const key = trigramKey(tokens[i - 2]!, tokens[i - 1]!, token)
        trigram.set(key, (trigram.get(key) ?? 0) + 1)
      }
    }
  }

  return {
    order: settings.order,
    discount: settings.discount,
    minContext: settings.minContext,
    minCount: settings.minCount,
    unigram,
    bigram,
    trigram,
    total,
    vocabulary: 0,
  }
}

/**
 * The perplexity of a document under the n-gram model.
 *
 * The perplexity is exp of the mean negative log-likelihood per token. The
 * backoff is *stupid* backoff: when the longest matching context is not
 * available, the probability is discounted once per level that was skipped.
 * The discount is what makes a repeated phrase expensive — a trigram the
 * background never saw is charged the unigram probability times the discount
 * squared, so boilerplate is expensive even when its words are common.
 *
 * An n-gram is only used when its context has been seen at least `minContext`
 * times. Without that rule a trigram seen exactly once would be assigned a
 * probability of one, and the model would rate any unique phrase as perfectly
 * predictable.
 */
export function documentPerplexity(model: NGramModel, tokens: number[]): number {
  if (tokens.length === 0) return 1
  const discount = model.discount
  const minContext = model.minContext
  let logLikelihood = 0

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    const unigramProbability = ((model.unigram.get(token) ?? 0) + 1) / (model.total + model.unigram.size + 1)

    // The default is the unigram probability, discounted once per level that
    // was skipped.
    let probability = model.order === 1 ? unigramProbability : discount * discount * unigramProbability

    if (model.order >= 2 && i >= 1) {
      const bigramCount = model.bigram.get(bigramKey(tokens[i - 1]!, token)) ?? 0
      const bigramContext = model.unigram.get(tokens[i - 1]!) ?? 0
      if (bigramCount >= model.minCount && bigramContext >= minContext) {
        probability = discount * (bigramCount / bigramContext)
      }
    }

    if (model.order >= 3 && i >= 2) {
      const trigramCount = model.trigram.get(trigramKey(tokens[i - 2]!, tokens[i - 1]!, token)) ?? 0
      const trigramContext = model.bigram.get(bigramKey(tokens[i - 2]!, tokens[i - 1]!)) ?? 0
      if (trigramCount >= model.minCount && trigramContext >= minContext) {
        probability = trigramCount / trigramContext
      }
    }

    if (probability <= 0) probability = 1e-12
    logLikelihood -= Math.log(probability)
  }
  return Math.exp(logLikelihood / tokens.length)
}

/* -------------------------------------------------------------------------- */
/* The filters                                                                */
/* -------------------------------------------------------------------------- */

export interface FilterConfig {
  /** The shortest document to keep, in tokens. */
  minTokens: number
  /** The longest document to keep, in tokens. */
  maxTokens: number
  /** The highest perplexity to keep. */
  maxPerplexity: number
  /** The lowest alignment to the target to keep. */
  minAlignment: number
  /** Whether to deduplicate. */
  removeDuplicates: boolean
  /** The similarity at which two documents count as duplicates. */
  dedupThreshold: number
  /** The domains to keep; null keeps every domain. */
  keepDomains: Domain[] | null
}

export const DEFAULT_FILTERS: FilterConfig = {
  minTokens: 20,
  maxTokens: 400,
  maxPerplexity: 120,
  minAlignment: -1,
  removeDuplicates: true,
  dedupThreshold: 0.8,
  keepDomains: null,
}

/**
 * The target direction of the alignment filter.
 *
 * This is the analogue of the text–image embedding that a multimodal filter
 * scores against: a fixed vector over the vocabulary that stands for "the
 * kind of document we want". A document's alignment is the cosine similarity
 * of its normalised bag-of-tokens with the target.
 */
export function alignmentTarget(vocabulary: number, topicDistributions: number[][], topic: number): number[] {
  const target = new Array<number>(vocabulary).fill(0)
  const distribution = topicDistributions[topic] ?? topicDistributions[0] ?? []
  for (let i = 0; i < vocabulary; i++) target[i] = distribution[i] ?? 0
  const norm = Math.sqrt(target.reduce((sum, value) => sum + value * value, 0))
  if (norm === 0) return target
  return target.map((value) => value / norm)
}

/** The alignment of a document with a target. */
export function alignment(document: Document, vocabulary: number, target: number[]): number {
  const counts = bagOfTokens(document, vocabulary)
  const norm = Math.sqrt(counts.reduce((sum, value) => sum + value * value, 0))
  if (norm === 0) return 0
  let dot = 0
  for (let i = 0; i < vocabulary; i++) dot += (counts[i] ?? 0) * (target[i] ?? 0)
  return dot / norm
}

/* -------------------------------------------------------------------------- */
/* The pipeline                                                               */
/* -------------------------------------------------------------------------- */

export interface StageRecord {
  name: string
  before: number
  after: number
}

export interface PipelineResult {
  kept: Document[]
  stages: StageRecord[]
  /** The perplexity of every document, for the histogram. */
  perplexities: number[]
  /** The alignment of every document, for the histogram. */
  alignments: number[]
  /** The deduplication record, if it ran. */
  deduplication: DeduplicationResult | null
  /** The mean quality of the documents that survived. */
  meanQuality: number
}

/**
 * Run the pipeline.
 *
 * The order matters and is the order the papers use: cheap structural filters
 * first, then the model-based ones, then deduplication, because a filter that
 * runs late has to look at more documents.
 */
export function runPipeline(
  corpus: Corpus,
  config: Partial<FilterConfig> = {},
  options: { backgroundFraction?: number; alignmentTopic?: number; dedupShingleSize?: number } = {},
): PipelineResult {
  const settings: FilterConfig = { ...DEFAULT_FILTERS, ...config }
  const backgroundFraction = options.backgroundFraction ?? 0.2
  const alignmentTopic = options.alignmentTopic ?? 0
  const stages: StageRecord[] = []

  // The background model is fit on a sample of the *raw* corpus, before any
  // filtering, exactly as a real pipeline does.
  const backgroundCount = Math.max(20, Math.floor(corpus.documents.length * backgroundFraction))
  const background = fitNGram(corpus.documents.slice(0, backgroundCount))

  const target = alignmentTarget(corpus.vocabulary, corpus.topicDistributions, alignmentTopic)
  const perplexities = corpus.documents.map((document) => documentPerplexity(background, document.tokens))
  const alignments = corpus.documents.map((document) => alignment(document, corpus.vocabulary, target))

  let current = corpus.documents.slice()
  const record = (name: string, before: number) => {
    stages.push({ name, before, after: current.length })
  }

  // 1. The structural filters: length and domain.
  const beforeLength = current.length
  current = current.filter(
    (document) =>
      document.tokens.length >= settings.minTokens && document.tokens.length <= settings.maxTokens,
  )
  record('the length filter', beforeLength)

  if (settings.keepDomains) {
    const beforeDomain = current.length
    const allowed = new Set(settings.keepDomains)
    current = current.filter((document) => allowed.has(document.domain))
    record('the domain filter', beforeDomain)
  }

  // 2. The perplexity filter.
  const beforePerplexity = current.length
  const keptIds = new Set(current.map((document) => document.id))
  current = current.filter(
    (document) => keptIds.has(document.id) && (perplexities[document.id] ?? 0) <= settings.maxPerplexity,
  )
  record('the perplexity filter', beforePerplexity)

  // 3. The alignment filter.
  if (settings.minAlignment > -1) {
    const beforeAlignment = current.length
    current = current.filter((document) => (alignments[document.id] ?? -1) >= settings.minAlignment)
    record('the alignment filter', beforeAlignment)
  }

  // 4. Deduplication.
  let deduplication: DeduplicationResult | null = null
  if (settings.removeDuplicates) {
    const beforeDeduplication = current.length
    deduplication = deduplicate(current, {
      threshold: settings.dedupThreshold,
      shingleSize: options.dedupShingleSize ?? 5,
    })
    current = deduplication.kept
    record('the deduplication filter', beforeDeduplication)
  }

  return {
    kept: current,
    stages,
    perplexities,
    alignments,
    deduplication,
    meanQuality: meanQuality(current),
  }
}

/* -------------------------------------------------------------------------- */
/* The evaluation                                                             */
/* -------------------------------------------------------------------------- */

export interface EvaluationResult {
  /** The accuracy on the held-out set. */
  accuracy: number
  /** The accuracy within each domain. */
  perDomainAccuracy: number[]
  /** The loss on the held-out set. */
  loss: number
  /** The number of documents kept. */
  kept: number
  /** The mean quality of the documents kept. */
  meanQuality: number
}

/** Turn a set of documents into samples for the classifier. */
export function toSamples(documents: Document[], corpus: Corpus): Sample[] {
  return documents.map((document) => ({
    features: normalisedBag(document, corpus.vocabulary),
    label: document.topic,
    group: DOMAIN_INDEX[document.domain],
  }))
}

/**
 * Split a corpus into a training and a held-out set.
 *
 * The split is by document id and is deterministic, so the same corpus always
 * gives the same split and the comparison between two pipelines is fair.
 */
export function splitCorpus(corpus: Corpus, heldOutFraction = 0.3): { train: Document[]; test: Document[] } {
  const testIds = new Set<number>()
  for (const document of corpus.documents) {
    if (document.id % 100 < heldOutFraction * 100) testIds.add(document.id)
  }
  return {
    train: corpus.documents.filter((document) => !testIds.has(document.id)),
    test: corpus.documents.filter((document) => testIds.has(document.id)),
  }
}

/**
 * Train a model on the data that survives a pipeline and measure it.
 *
 * This is the score of a filter: not how many documents it removed, but what
 * the model trained on the result can do.
 */
export function evaluatePipeline(
  corpus: Corpus,
  result: PipelineResult,
  options: TrainingOptions & { heldOutFraction?: number } = {},
): EvaluationResult {
  const { test } = splitCorpus(corpus, options.heldOutFraction ?? 0.3)
  const testIds = new Set(test.map((document) => document.id))
  const keptTrain = result.kept.filter((document) => !testIds.has(document.id))
  const keptTest = result.kept.filter((document) => testIds.has(document.id))

  const trainingSamples = toSamples(keptTrain, corpus)
  const testSamples = toSamples(keptTest, corpus)
  if (trainingSamples.length === 0) {
    return {
      accuracy: 0,
      perDomainAccuracy: new Array<number>(DOMAINS.length).fill(0),
      loss: 0,
      kept: result.kept.length,
      meanQuality: result.meanQuality,
    }
  }

  const trained = trainClassifier(trainingSamples, corpus.topics, corpus.vocabulary, options)
  return {
    accuracy: accuracy(trained.weights, testSamples),
    perDomainAccuracy: groupAccuracies(trained.weights, testSamples, DOMAINS.length),
    loss: meanLoss(trained.weights, testSamples),
    kept: result.kept.length,
    meanQuality: result.meanQuality,
  }
}

export interface FixedHeldOutEvaluation {
  /** Accuracy on every held-out document, including the ones the filter removed. */
  accuracy: number
  loss: number
  /** The documents the filter removed from the held-out set, which is what the two scores disagree about. */
  heldOutRemoved: number
  heldOut: number
}

/**
 * Train on what survived, and score on the *whole* held-out set.
 *
 * `evaluatePipeline` scores a model on the held-out documents that its own filter
 * left in place, which is the right question for one pipeline and the wrong one
 * for a comparison: a filter that deletes the long documents also deletes the
 * questions that were hard because they were long, and the accuracy of the model
 * trained on the remains rises for a reason that has nothing to do with the
 * training data. This function holds the evaluation set fixed, so a curve can be
 * read as a claim about the filter rather than about the test set.
 *
 * `inDomainOnly` narrows the fixed set to the documents that are neither
 * boilerplate nor unseen-language. That is a different question — what the model
 * can do on the text a user will actually send — and for a filter that removes
 * junk it gives the opposite answer to the mixed set, because a model trained on
 * junk is good at rating junk. Both are reported rather than one being called the
 * real metric.
 */
export function evaluateFixedHeldOut(
  corpus: Corpus,
  kept: Document[],
  options: TrainingOptions & { heldOutFraction?: number; inDomainOnly?: boolean } = {},
): FixedHeldOutEvaluation {
  const { test } = splitCorpus(corpus, options.heldOutFraction ?? 0.3)
  const scored = options.inDomainOnly
    ? test.filter((document) => !document.isSpam && !document.isForeign)
    : test
  const testIds = new Set(test.map((document) => document.id))
  const trainingSamples = toSamples(kept.filter((document) => !testIds.has(document.id)), corpus)
  const testSamples = toSamples(scored, corpus)
  if (trainingSamples.length === 0 || testSamples.length === 0) {
    return { accuracy: 0, loss: 0, heldOutRemoved: scored.length, heldOut: scored.length }
  }
  const trained = trainClassifier(trainingSamples, corpus.topics, corpus.vocabulary, options)
  return {
    accuracy: accuracy(trained.weights, testSamples),
    loss: meanLoss(trained.weights, testSamples),
    heldOutRemoved: scored.filter((document) => !kept.some((keptDocument) => keptDocument.id === document.id)).length,
    heldOut: scored.length,
  }
}

/* -------------------------------------------------------------------------- */
/* The ablation table                                                         */
/* -------------------------------------------------------------------------- */

export interface AblationRow {
  /** The filter that was removed. */
  removed: string
  /** How many documents survived. */
  kept: number
  /** The accuracy of the model trained on them. */
  accuracy: number
  /** The change in accuracy against the full pipeline. */
  delta: number
  /** Accuracy on every held-out document, including those this variant removed. */
  accuracyOnFullHeldOut: number
  /** The same difference measured on the fixed held-out set, which is the comparable one. */
  deltaOnFullHeldOut: number
  /** The mean quality of the documents that survived. */
  meanQuality: number
  /** Whether the filter was on in the baseline at all. */
  active: boolean
}

/**
 * The ablation table.
 *
 * One row per filter: the pipeline is rerun with that filter switched off, and
 * the resulting model is measured. The rows are ordered by how much the removal
 * hurt, which is the table the papers report — and "hurt" is measured on the
 * fixed held-out set, so a filter that deleted hard questions cannot hide.
 *
 * A row whose `active` is false is a filter that was never on in the baseline,
 * so switching it off changes nothing and the delta is exactly zero. Reporting
 * those rows rather than hiding them is the point: an ablation table that only
 * shows the filters that did something invites a reader to think every rule was
 * pulling its weight.
 */
export function ablationPipeline(
  corpus: Corpus,
  config: Partial<FilterConfig> = {},
  options: { alignmentTopic?: number; training?: TrainingOptions } = {},
): { full: EvaluationResult; fullFixed: FixedHeldOutEvaluation; rows: AblationRow[] } {
  const settings: FilterConfig = { ...DEFAULT_FILTERS, ...config }
  const fullResult = runPipeline(corpus, settings, { alignmentTopic: options.alignmentTopic })
  const full = evaluatePipeline(corpus, fullResult, options.training)
  const fullFixed = evaluateFixedHeldOut(corpus, fullResult.kept, options.training)

  const rows: AblationRow[] = []
  const variants: { name: string; config: Partial<FilterConfig>; active: (config: FilterConfig) => boolean }[] = [
    {
      name: 'the length filter',
      config: { minTokens: 0, maxTokens: Number.MAX_SAFE_INTEGER },
      active: (c) => c.minTokens > 0 || c.maxTokens < Number.MAX_SAFE_INTEGER,
    },
    { name: 'the domain filter', config: { keepDomains: null }, active: (c) => c.keepDomains !== null },
    {
      name: 'the perplexity filter',
      config: { maxPerplexity: Number.MAX_SAFE_INTEGER },
      active: (c) => c.maxPerplexity < Number.MAX_SAFE_INTEGER,
    },
    { name: 'the alignment filter', config: { minAlignment: -1 }, active: (c) => c.minAlignment > -1 },
    { name: 'the deduplication filter', config: { removeDuplicates: false }, active: (c) => c.removeDuplicates },
  ]

  for (const variant of variants) {
    const variantResult = runPipeline(corpus, { ...settings, ...variant.config }, { alignmentTopic: options.alignmentTopic })
    const evaluation = evaluatePipeline(corpus, variantResult, options.training)
    const fixed = evaluateFixedHeldOut(corpus, variantResult.kept, options.training)
    rows.push({
      removed: variant.name,
      kept: evaluation.kept,
      accuracy: evaluation.accuracy,
      delta: evaluation.accuracy - full.accuracy,
      accuracyOnFullHeldOut: fixed.accuracy,
      deltaOnFullHeldOut: fixed.accuracy - fullFixed.accuracy,
      meanQuality: evaluation.meanQuality,
      active: variant.active(settings),
    })
  }

  rows.sort((a, b) => a.deltaOnFullHeldOut - b.deltaOnFullHeldOut)
  return { full, fullFixed, rows }
}

/** Which filter an ablation curve sweeps the threshold of. */
export type CurveFilter = 'minTokens' | 'maxPerplexity' | 'minAlignment' | 'dedupThreshold'

export interface CurvePoint {
  /** The threshold the pipeline was run with. */
  value: number
  kept: number
  /** Accuracy on the held-out documents the pipeline left in place. */
  accuracy: number
  /** Accuracy on every held-out document, whatever the filter did to them. */
  accuracyOnFullHeldOut: number
  /** How many held-out documents this point removed — the reason the two accuracies differ. */
  heldOutRemoved: number
  meanQuality: number
  /** The change in accuracy against the baseline config. */
  delta: number
}

/**
 * One filter's threshold swept, with a model measured at every point.
 *
 * The table above answers "is this filter worth anything"; this answers "at what
 * setting", which is the question a practitioner actually has to answer. Every
 * point reruns the whole pipeline so the stages stay in the same order, and the
 * baseline is the config passed in, so `delta` is the change against what the
 * pipeline would otherwise do.
 *
 * Each point is scored twice. `accuracy` is the score on the held-out documents
 * that survived the filter — the number the pipeline's own benchmark reports —
 * and `accuracyOnFullHeldOut` is the score on every held-out document. The two
 * come apart exactly where the filter is deleting questions rather than answers,
 * which is why the curve returns both and `delta` is measured on the fixed set.
 */
export function ablationCurve(
  corpus: Corpus,
  filter: CurveFilter,
  values: number[],
  options: { config?: Partial<FilterConfig>; alignmentTopic?: number; training?: TrainingOptions } = {},
): {
  filter: CurveFilter
  baseline: EvaluationResult
  baselineFixed: FixedHeldOutEvaluation
  points: CurvePoint[]
} {
  const settings: FilterConfig = { ...DEFAULT_FILTERS, ...options.config }
  const baselineResult = runPipeline(corpus, settings, { alignmentTopic: options.alignmentTopic })
  const baseline = evaluatePipeline(corpus, baselineResult, options.training)
  const baselineFixed = evaluateFixedHeldOut(corpus, baselineResult.kept, options.training)

  const points = values.map((value) => {
    const config: Partial<FilterConfig> = {
      ...settings,
      minTokens: filter === 'minTokens' ? value : settings.minTokens,
      maxPerplexity: filter === 'maxPerplexity' ? value : settings.maxPerplexity,
      minAlignment: filter === 'minAlignment' ? value : settings.minAlignment,
      dedupThreshold: filter === 'dedupThreshold' ? value : settings.dedupThreshold,
      // sweeping the duplicate threshold only means something with the filter on
      removeDuplicates: filter === 'dedupThreshold' ? true : settings.removeDuplicates,
    }
    const result = runPipeline(corpus, config, { alignmentTopic: options.alignmentTopic })
    const evaluation = evaluatePipeline(corpus, result, options.training)
    const fixed = evaluateFixedHeldOut(corpus, result.kept, options.training)
    return {
      value,
      kept: evaluation.kept,
      accuracy: evaluation.accuracy,
      accuracyOnFullHeldOut: fixed.accuracy,
      heldOutRemoved: fixed.heldOutRemoved,
      meanQuality: evaluation.meanQuality,
      delta: fixed.accuracy - baselineFixed.accuracy,
    }
  })

  return { filter, baseline, baselineFixed, points }
}
