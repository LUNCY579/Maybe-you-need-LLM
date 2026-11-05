/**
 * Quality against quantity at a fixed compute budget.
 *
 * DataComp-LM's headline is not "filter more" but "filter better, given the
 * compute you have": the training budget is fixed in advance, and the question
 * is what to spend it on. This module answers that question at toy scale, with
 * the accounting stated rather than waved at.
 *
 * Two budgets are held fixed, and they are different things:
 *
 * - the **token budget** is the data: documents are drawn from a pool, in order,
 *   until the pool has contributed that many tokens;
 * - the **compute budget** is the training: the classifier is trained
 *   full-batch, so one step visits every training document, and the total
 *   sample-visits `steps × documents` is the arithmetic the machine actually
 *   does. With visits fixed, a smaller pool buys more steps and a larger pool
 *   buys fewer.
 *
 * Holding both fixed is what makes the comparison the paper's comparison. A
 * strategy that wins by using more tokens, or by taking more steps, has won
 * nothing — which is why the table carries a **control** row: the same number of
 * documents and the same number of steps as the cheap filtered row, drawn from
 * the unfiltered pool. Only against that row can a gain be attributed to quality
 * rather than to taking more passes over less data.
 *
 * The evaluation set is stated twice, because it decides the answer. Scored on
 * every held-out document — boilerplate and unseen-language text included — an
 * unfiltered model looks competitive, since it was trained on the same kind of
 * mess it is asked to rate. Scored on the in-domain held-out documents, which is
 * what a validation set normally means, the ordering is the one the paper
 * reports. Both columns are computed, and neither is the "real" answer.
 */

import { buildCorpus, meanQuality, tokenCount, type Document } from './corpus'
import { documentPerplexity, fitNGram, splitCorpus, toSamples } from './filters'
import { accuracy, meanLoss, trainClassifier } from './model'

export interface BudgetRow {
  /** The name of the strategy, as the table prints it. */
  name: string
  /** Whether a practitioner can run this strategy, and what it is controlling for. */
  kind: 'raw' | 'filtered' | 'control' | 'oracle'
  /** The token budget this row was drawn to, as a fraction of the full one. */
  budgetFraction: number
  documents: number
  /** Tokens the row's documents carry. */
  tokens: number
  /** Gradient steps the compute budget allowed. */
  steps: number
  /** Sample-visits: `steps × documents`, the compute actually spent. */
  visits: number
  meanQuality: number
  /** Boilerplate plus unseen-language documents, as a fraction of the row. */
  unwantedFraction: number
  /** Loss on every held-out document. */
  loss: number
  accuracy: number
  /** Loss on the in-domain held-out documents only. */
  inDomainLoss: number
  inDomainAccuracy: number
}

export interface BudgetStudy {
  rows: BudgetRow[]
  tokenBudget: number
  computeVisits: number
  /** How many held-out documents there are, and how many of them are in domain. */
  heldOut: { documents: number; inDomain: number }
  /** Raw-full minus filtered-full on the in-domain loss. Positive means filtering helped at the same budget. */
  lossGainAtSameBudget: number
  /** Raw-full minus filtered-half on the in-domain loss. Positive means the smaller filtered set beat the larger raw one. */
  lossGainAtHalfBudget: number
  /** Control minus filtered-half on the in-domain loss: the quality effect alone, at equal size and equal steps. */
  lossGainAgainstControl: number
}

export interface BudgetOptions {
  seed?: number
  size?: number
  vocabulary?: number
  topics?: number
  /** Tokens the full-budget rows are drawn to. */
  tokenBudget?: number
  /** Sample-visits every row is trained with. */
  computeVisits?: number
  /** The fraction of the pool the perplexity filter throws away. */
  pruneFraction?: number
  /** The fraction of the token budget the cheap rows are drawn to. */
  cheapFraction?: number
  heldOutFraction?: number
  backgroundFraction?: number
}

/**
 * Draw documents, in the order given, until the token budget is spent.
 *
 * The document that crosses the budget is kept: a real pipeline tokenises the
 * documents it selected, and does not throw one away halfway through. The token
 * count reported is the count actually drawn, so a row can overshoot by at most
 * one document.
 */
export function drawToBudget(pool: Document[], tokenBudget: number): { documents: Document[]; tokens: number } {
  const documents: Document[] = []
  let tokens = 0
  for (const document of pool) {
    if (tokens >= tokenBudget) break
    documents.push(document)
    tokens += tokenCount(document)
  }
  return { documents, tokens }
}

/**
 * The pool the perplexity filter leaves behind.
 *
 * The reference model is fit on a slice of the *raw* training pool, because a
 * filter has no curated data to learn from yet. The documents it scores worst are
 * dropped, which is RefinedWeb's argument in one line: the model has seen the
 * shape of the corpus, so the documents that surprise it are the ones that do not
 * belong.
 */
export function perplexityPool(
  pool: Document[],
  pruneFraction: number,
  backgroundFraction = 0.25,
): { kept: Document[]; threshold: number } {
  if (pool.length === 0) return { kept: [], threshold: 0 }
  const backgroundCount = Math.max(10, Math.floor(pool.length * backgroundFraction))
  const model = fitNGram(pool.slice(0, backgroundCount))
  const scored = pool.map((document) => ({ document, perplexity: documentPerplexity(model, document.tokens) }))
  const ordered = scored.slice().sort((a, b) => a.perplexity - b.perplexity)
  const keepCount = Math.max(1, Math.round(ordered.length * (1 - pruneFraction)))
  const threshold = ordered[keepCount - 1]!.perplexity
  const keptIds = new Set(ordered.slice(0, keepCount).map((entry) => entry.document.id))
  // the pool's own order is preserved, so the draw is comparable with the raw row
  return { kept: pool.filter((document) => keptIds.has(document.id)), threshold }
}

/** Every other document of the pool: the same order and the same mixture, half as many of them. */
function strideHalf(pool: Document[]): Document[] {
  return pool.filter((_, index) => index % 2 === 0)
}
const unwantedOf = (documents: Document[]): number =>
  documents.filter((document) => document.isSpam || document.isForeign).length

/**
 * Run the study.
 *
 * Five rows, all trained with the same number of sample-visits and scored on the
 * same held-out documents: the unfiltered pool at the full token budget, the
 * perplexity-filtered pool at the full budget, an unfiltered subset with exactly
 * as many documents as the cheap filtered row (the control), the filtered pool at
 * half the budget, and an oracle that sorts by the corpus's own quality field. The
 * oracle is not a filter — nothing can run it — it is the ceiling the table is read
 * against, and it is labelled as such on screen.
 *
 * The control is the row that makes the table worth reading. Half the budget buys
 * twice as many steps, so a filtered half-budget row can beat a full-budget row
 * purely by seeing its data more often; against the full-budget raw row that is
 * not a win for quality. Against the control it is: same documents, same steps,
 * and the only difference is whether a filter chose them.
 */
export function runBudgetStudy(options: BudgetOptions = {}): BudgetStudy {
  const settings: Required<BudgetOptions> = {
    seed: 17,
    size: 400,
    vocabulary: 48,
    topics: 5,
    tokenBudget: 12_000,
    computeVisits: 10_000,
    pruneFraction: 0.4,
    cheapFraction: 0.5,
    heldOutFraction: 0.3,
    backgroundFraction: 0.25,
  }
  Object.assign(settings, options)

  const corpus = buildCorpus({
    seed: settings.seed,
    size: settings.size,
    vocabulary: settings.vocabulary,
    topics: settings.topics,
  })
  const { train, test } = splitCorpus(corpus, settings.heldOutFraction)
  const testIds = new Set(test.map((document) => document.id))
  // no row ever sees a held-out document
  const pool = train.filter((document) => !testIds.has(document.id))
  const allSamples = toSamples(test, corpus)
  const inDomain = test.filter((document) => !document.isSpam && !document.isForeign)
  const inDomainSamples = toSamples(inDomain, corpus)

  const cheapTokens = Math.round(settings.tokenBudget * settings.cheapFraction)
  const filteredPool = perplexityPool(pool, settings.pruneFraction, settings.backgroundFraction).kept
  const oraclePool = pool.slice().sort((a, b) => b.quality - a.quality)
  const cheapFiltered = drawToBudget(filteredPool, cheapTokens).documents
  // the control has exactly as many documents as the cheap filtered row, so it
  // gets exactly as many gradient steps: what is left over is the quality
  const controlDocuments = strideHalf(pool).slice(0, cheapFiltered.length)

  const drawn: { name: string; kind: BudgetRow['kind']; fraction: number; documents: Document[] }[] = [
    {
      name: 'unfiltered, full budget',
      kind: 'raw',
      fraction: 1,
      documents: drawToBudget(pool, settings.tokenBudget).documents,
    },
    {
      name: 'perplexity-filtered, full budget',
      kind: 'filtered',
      fraction: 1,
      documents: drawToBudget(filteredPool, settings.tokenBudget).documents,
    },
    {
      name: 'unfiltered, the same number of documents',
      kind: 'control',
      fraction: settings.cheapFraction,
      documents: controlDocuments,
    },
    {
      name: 'perplexity-filtered, half the budget',
      kind: 'filtered',
      fraction: settings.cheapFraction,
      documents: cheapFiltered,
    },
    {
      name: 'the oracle, sorted by true quality',
      kind: 'oracle',
      fraction: 1,
      documents: drawToBudget(oraclePool, settings.tokenBudget).documents,
    },
  ]

  const rows = drawn.map(({ name, kind, fraction, documents }) => {
    const samples = toSamples(documents, corpus)
    const steps = samples.length > 0 ? Math.max(1, Math.round(settings.computeVisits / samples.length)) : 0
    const trained = trainClassifier(samples, corpus.topics, corpus.vocabulary, { steps })
    return {
      name,
      kind,
      budgetFraction: fraction,
      documents: documents.length,
      tokens: documents.reduce((sum, document) => sum + tokenCount(document), 0),
      steps,
      visits: steps * samples.length,
      meanQuality: meanQuality(documents),
      unwantedFraction: documents.length > 0 ? unwantedOf(documents) / documents.length : 0,
      loss: meanLoss(trained.weights, allSamples, 0),
      accuracy: accuracy(trained.weights, allSamples),
      inDomainLoss: meanLoss(trained.weights, inDomainSamples, 0),
      inDomainAccuracy: accuracy(trained.weights, inDomainSamples),
    }
  })

  const [rawFull, filteredFull, control, halfFiltered] = rows as [BudgetRow, BudgetRow, BudgetRow, BudgetRow]
  return {
    rows,
    tokenBudget: settings.tokenBudget,
    computeVisits: settings.computeVisits,
    heldOut: { documents: test.length, inDomain: inDomain.length },
    lossGainAtSameBudget: rawFull.inDomainLoss - filteredFull.inDomainLoss,
    lossGainAtHalfBudget: rawFull.inDomainLoss - halfFiltered.inDomainLoss,
    lossGainAgainstControl: control.inDomainLoss - halfFiltered.inDomainLoss,
  }
}
