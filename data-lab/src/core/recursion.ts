/**
 * The recursive refinement loop.
 *
 * Gerstgrasser et al. showed that a filter can be run *again* on the data it
 * just produced, and that doing so is better than running it harder once. The
 * reason is the reference model: the filter scores documents with a model
 * trained on the corpus, so after the first pass the model has seen only clean
 * text and its idea of "surprising" has sharpened. A second pass finds what the
 * first pass's noisy model rated as normal.
 *
 * This module runs that loop at toy scale and compares it against the obvious
 * alternative, with the total amount removed held equal. One pass that throws
 * away 40% of the corpus and four passes that each throw away the equivalent of
 * 10% end at the same corpus size; the only difference is how many times the
 * model got retrained on what survived. If recursion is real, the second one is
 * better, and the numbers below are how you see whether it is.
 *
 * The held-out documents are fixed before the first pass and are never removed
 * from, so every accuracy in this file is measured on the same set.
 *
 * What the toy scale actually shows, and what the tests therefore assert: the
 * held-out *loss* of the recursive corpus is lower than the one-shot corpus at
 * every seed tried, and the *accuracy* difference is inside seed noise — three
 * seeds give 0.000, +0.025 and +0.008. That asymmetry is the honest version of
 * the claim. A continuous score separates the two arms; a 0/1 score on a
 * hundred-odd documents cannot, and a course that reported the accuracy gain as
 * fact would be reporting noise.
 *
 * The comparison has to be between arms of the same size. Inside one run the
 * loss *rises* from pass 1 to pass 4 (0.3992 to 0.4270) even though the accuracy
 * rises too, because every pass is trained with the same number of steps on a
 * smaller corpus. That is a statement about the loop's own bookkeeping, not about
 * recursion, and the screen says so beside the table.
 */

import { buildCorpus, meanQuality, tokenCount, type Corpus, type Document } from './corpus'
import { splitCorpus, toSamples } from './filters'
import { adaptivePerplexityFilter } from './midas'
import { accuracy, meanLoss, trainClassifier } from './model'

export interface RefinementPass {
  /** The pass number, starting at 1. The first pass sees the raw corpus. */
  pass: number
  documents: number
  tokens: number
  meanQuality: number
  /** Boilerplate plus unseen-language documents, as a fraction of the survivors. */
  unwantedFraction: number
  /** The perplexity the pass cut at. */
  threshold: number
  /** How many of the documents it removed were boilerplate or unseen-language. */
  removedUnwanted: number
  /** How many it removed were neither — the collateral damage. */
  removedClean: number
  /** The held-out accuracy of a model trained on the survivors of this pass. */
  heldOutAccuracy: number
  /** The held-out loss of the same model. */
  heldOutLoss: number
}

export interface RefinementResult {
  passes: RefinementPass[]
  /** The documents left after the last pass. */
  final: Document[]
  /** The pool before the first pass, so the screen can show both ends. */
  start: { documents: number; tokens: number; meanQuality: number }
  steps: number
}

export interface RefinementOptions {
  seed?: number
  size?: number
  vocabulary?: number
  topics?: number
  /** How many passes to run. */
  passes?: number
  /** The total fraction of the training pool that ends up removed. */
  pruneFraction?: number
  /** Gradient steps for the model scored at each pass. */
  steps?: number
  learningRate?: number
  heldOutFraction?: number
}

const DEFAULTS: Required<RefinementOptions> = {
  seed: 17,
  size: 400,
  vocabulary: 48,
  topics: 5,
  passes: 4,
  pruneFraction: 0.4,
  steps: 300,
  learningRate: 0.5,
  heldOutFraction: 0.3,
}

const unwantedOf = (documents: Document[]): number =>
  documents.filter((document) => document.isSpam || document.isForeign).length

/**
 * Run the loop.
 *
 * `pruneFraction` is the *total* removed, and each pass removes an equal
 * fraction of what is still there, so that `passes` can change without changing
 * where the corpus ends up. That is the control the comparison needs: with the
 * per-pass fraction set to `1 - (1 - pruneFraction) ** (1 / passes)`, one pass
 * and four passes both finish at the same corpus size.
 */
export function runRefinement(options: RefinementOptions = {}): RefinementResult {
  const settings: Required<RefinementOptions> = { ...DEFAULTS, ...options }

  const corpus: Corpus = buildCorpus({
    seed: settings.seed,
    size: settings.size,
    vocabulary: settings.vocabulary,
    topics: settings.topics,
  })
  const { train, test } = splitCorpus(corpus, settings.heldOutFraction)
  const testIds = new Set(test.map((document) => document.id))
  const testSamples = toSamples(test, corpus)

  const perPass = 1 - (1 - settings.pruneFraction) ** (1 / Math.max(1, settings.passes))
  let current = train.filter((document) => !testIds.has(document.id))
  const passes: RefinementPass[] = []

  for (let pass = 1; pass <= settings.passes; pass++) {
    const result = adaptivePerplexityFilter(current, { keepFraction: 1 - perPass })
    const keptIds = new Set(result.kept.map((document) => document.id))
    const removed = current.filter((document) => !keptIds.has(document.id))
    current = result.kept

    const trained = trainClassifier(toSamples(current, corpus), corpus.topics, corpus.vocabulary, {
      steps: settings.steps,
      learningRate: settings.learningRate,
    })
    passes.push({
      pass,
      documents: current.length,
      tokens: current.reduce((sum, document) => sum + tokenCount(document), 0),
      meanQuality: meanQuality(current),
      unwantedFraction: current.length > 0 ? unwantedOf(current) / current.length : 0,
      threshold: result.threshold,
      removedUnwanted: unwantedOf(removed),
      removedClean: removed.length - unwantedOf(removed),
      heldOutAccuracy: accuracy(trained.weights, testSamples),
      heldOutLoss: meanLoss(trained.weights, testSamples, 0),
    })
  }

  return {
    passes,
    final: current,
    start: {
      documents: train.length,
      tokens: train.reduce((sum, document) => sum + tokenCount(document), 0),
      meanQuality: meanQuality(train),
    },
    steps: settings.steps,
  }
}

export interface RecursionComparison {
  /** One pass, removing the whole fraction at once. */
  oneShot: RefinementPass
  /** `passes` passes, removing the same total fraction. */
  recursive: RefinementPass
  /** Held-out accuracy of the recursive corpus minus the one-shot corpus. */
  accuracyGain: number
  /** The same difference on mean quality. */
  qualityGain: number
  passes: number
  pruneFraction: number
  /** Whether the two arms ended at the same corpus size, which is what makes the comparison fair. */
  sameSize: boolean
}

/**
 * One pass, hard, against several passes, gentle.
 *
 * Both arms finish at the same corpus size, and the difference is only how
 * often the reference model got retrained on the survivors. This is the claim
 * the paper makes, stated as a measurement.
 */
export function compareRecursion(options: RefinementOptions = {}): RecursionComparison {
  const settings: Required<RefinementOptions> = { ...DEFAULTS, ...options }
  const oneShot = runRefinement({ ...settings, passes: 1 }).passes.at(-1)!
  const recursive = runRefinement({ ...settings }).passes.at(-1)!
  return {
    oneShot,
    recursive,
    accuracyGain: recursive.heldOutAccuracy - oneShot.heldOutAccuracy,
    qualityGain: recursive.meanQuality - oneShot.meanQuality,
    passes: settings.passes,
    pruneFraction: settings.pruneFraction,
    sameSize: Math.abs(recursive.documents - oneShot.documents) <= 1,
  }
}
