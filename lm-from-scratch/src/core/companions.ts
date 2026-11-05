/**
 * A computed companion figure for every lecture.
 *
 * The course's claim is not that each lecture *has* a figure — it is that the
 * figure is computed. Each lesson already links a laboratory; this module pulls
 * one number out of the same pure functions and labels it, so the collection of
 * figures can be read as a single page and checked in one test.
 *
 * The figures are deliberately of different kinds: a ratio, a count, a share, a
 * loss. What they have in common is that none of them is typed in here. The
 * model shape is fixed at a 768-wide, 12-layer, 32,000-token vocabulary model
 * unless the lesson's own subject is the size; the corpus is generated; the
 * scaling figure uses the published exponents.
 */

import { countParameters, forwardFlops, trainingMemory } from './architecture.js'
import type { Architecture } from './architecture.js'
import { generateCorpus, tokenizeCorpus, trainTokenizer } from './tokenizer.js'
import { generateCorpus as generateDocuments, runPipeline } from './data.js'
import { computeOptimalAllocation } from './scaling.js'
import { dataParallel } from './systems.js'

/** The reference model the figures share. */
export const COMPANION_MODEL: Architecture = {
  contextLength: 2048,
  dModel: 768,
  heads: 12,
  dFf: 3072,
  layers: 12,
  vocabSize: 32000,
}

export interface CompanionFigure {
  lessonId: string
  lessonNumber: number
  title: string
  /** What the number is. */
  label: string
  value: number
  unit: string
  /** How many decimal places the number is worth showing to. */
  decimals: number
  /** The sentence the number supports. */
  sentence: string
}

/** The loss of a model that spreads its probability evenly over the vocabulary. */
export function uniformLoss(vocabularySize: number): number {
  return Math.log(vocabularySize)
}

/**
 * The eleven figures, in lesson order.
 *
 * A figure is computed on every call. The tokeniser and the data pipeline are
 * the only expensive ones, and both are milliseconds on the generated corpora
 * they are given.
 */
export function companionFigures(): CompanionFigure[] {
  const parameters = countParameters(COMPANION_MODEL)
  const memory = trainingMemory(COMPANION_MODEL, 2048)
  const tokenCorpus = generateCorpus(20, 120, 5, 30)
  const tokenizer = trainTokenizer(tokenCorpus, 300)
  const tokenStats = tokenizeCorpus(tokenizer, tokenCorpus)
  const pipeline = runPipeline(
    generateDocuments({ documents: 400, seed: 5, duplicateRate: 0.15, sources: ['web', 'books', 'code', 'papers'] }),
    500,
    { qualityThreshold: 0.3, deduplicate: true, duplicateSimilarity: 0.85 },
  )
  const parallel = dataParallel(COMPANION_MODEL, 2048, 8, 64)
  const allocation = computeOptimalAllocation(1e23)
  const uniform = uniformLoss(COMPANION_MODEL.vocabSize)

  return [
    {
      lessonId: 'the-tokeniser',
      lessonNumber: 1,
      title: 'The tokeniser',
      label: 'bytes per token',
      value: tokenStats.bytesPerToken,
      unit: 'bytes / token',
      decimals: 2,
      sentence: `A byte-pair encoding of size ${tokenizer.size} turns this corpus into ${tokenStats.tokens.toLocaleString()} tokens.`,
    },
    {
      lessonId: 'the-vocabulary-economy',
      lessonNumber: 2,
      title: 'The vocabulary economy',
      label: 'embedding parameters',
      value: COMPANION_MODEL.vocabSize * COMPANION_MODEL.dModel,
      unit: 'parameters',
      decimals: 0,
      sentence: 'The vocabulary and the width decide this matrix, before a single layer is counted.',
    },
    {
      lessonId: 'the-decoder-block',
      lessonNumber: 3,
      title: 'The decoder block',
      label: 'attention share of the parameters',
      value: (parameters.attention / parameters.total) * 100,
      unit: '% of the model',
      decimals: 1,
      sentence: 'Four width-by-width projections per block are a large part of a model, but not the largest.',
    },
    {
      lessonId: 'the-parameter-budget',
      lessonNumber: 4,
      title: 'The parameter budget',
      label: 'embedding share of the parameters',
      value: (parameters.embedding / parameters.total) * 100,
      unit: '% of the model',
      decimals: 1,
      sentence: 'Two vocabulary-sized matrices, the embedding and the output projection, are a third of this model.',
    },
    {
      lessonId: 'the-flops',
      lessonNumber: 5,
      title: 'The FLOPs',
      label: 'forward FLOPs over 2048 tokens',
      value: forwardFlops(COMPANION_MODEL, 2048).total / 1e12,
      unit: 'TFLOPs',
      decimals: 2,
      sentence: 'A forward pass is arithmetic you can count from the shapes; a training step is about three of them.',
    },
    {
      lessonId: 'the-memory-hierarchy',
      lessonNumber: 6,
      title: 'The memory hierarchy',
      label: 'activation share of the training memory',
      value: (memory.activations / memory.total) * 100,
      unit: '% of the step',
      decimals: 1,
      sentence: 'The activations are the part of the memory that grows with the sequence, not with the parameters.',
    },
    {
      lessonId: 'parallelism',
      lessonNumber: 7,
      title: 'Parallelism',
      label: 'compute per byte of all-reduce',
      value: parallel.intensity,
      unit: 'FLOPs / byte',
      decimals: 1,
      sentence: 'At 64 devices the gradient all-reduce is cheap against the arithmetic it makes possible.',
    },
    {
      lessonId: 'the-data-pipeline',
      lessonNumber: 8,
      title: 'The data pipeline',
      label: 'tokens retained',
      value: pipeline.tokenRetention * 100,
      unit: '% of the corpus',
      decimals: 1,
      sentence: 'The quality filter and the deduplication remove documents, and the training budget is the tokens that remain.',
    },
    {
      lessonId: 'the-training-loop',
      lessonNumber: 9,
      title: 'The training loop',
      label: 'loss at initialisation',
      value: uniform,
      unit: 'nats / token',
      decimals: 3,
      sentence: 'A model that has learned nothing spreads its probability evenly, so its loss is the log of the vocabulary.',
    },
    {
      lessonId: 'the-perplexity',
      lessonNumber: 10,
      title: 'The perplexity',
      label: 'perplexity at a loss of 3',
      value: Math.exp(3),
      unit: 'effective choices',
      decimals: 2,
      sentence: 'Exponentiating the loss turns a number in nats into a number of choices, which is easier to read.',
    },
    {
      lessonId: 'the-scaling-law',
      lessonNumber: 11,
      title: 'Projecting the next run',
      label: 'optimal parameters at 1e23 FLOPs',
      value: allocation.parameters / 1e9,
      unit: 'billion parameters',
      decimals: 1,
      sentence: 'The compute-optimal allocation says what size to build before the run, not after it.',
    },
  ]
}
