/**
 * The data pipeline, simulated.
 *
 * The pipeline is a sequence of stages, and each stage removes tokens. The
 * laboratory's job is to make the *coupling* visible: the stages are not
 * independent, so the order matters, and the duplicate rate in particular
 * changes what the model learns and not only what it costs.
 */

import { createRng } from '@llm-materials/course-core'
import type { Rng } from '@llm-materials/course-core'

export interface Document {
  id: number
  /** The source the document came from. */
  source: string
  /** The text. */
  text: string
  /** Whether the document is a near-duplicate of an earlier one. */
  duplicateOf?: number
  /** A crude quality score, as a classifier would produce. */
  quality: number
}

export interface PipelineStage {
  name: string
  description: string
  /** How many documents survive this stage. */
  kept: number
  /** How many documents the stage removed. */
  removed: number
  /** The fraction of the original bytes that survives. */
  bytesKept: number
}

export interface PipelineResult {
  stages: PipelineStage[]
  /** The documents that survive every stage. */
  kept: Document[]
  /** The tokens the surviving documents represent. */
  tokens: number
  /** The tokens the original corpus represented. */
  originalTokens: number
  /** The fraction of the original tokens that survive. */
  tokenRetention: number
  /** The mixture of the surviving documents, by source. */
  mixture: { source: string; documents: number; bytes: number }[]
}

export interface PipelineOptions {
  /** Remove documents whose quality is below this. */
  qualityThreshold: number
  /** Remove near-duplicates. */
  deduplicate: boolean
  /** How similar two documents have to be to count as duplicates. */
  duplicateSimilarity: number
  /** The maximum number of documents to keep from each source, for balance. */
  perSourceLimit?: number
}

export const DEFAULT_PIPELINE: PipelineOptions = {
  qualityThreshold: 0.3,
  deduplicate: true,
  duplicateSimilarity: 0.85,
}

/** A crude similarity: the fraction of shared words. */
export function similarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/))
  const wordsB = new Set(b.toLowerCase().split(/\s+/))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let shared = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) shared++
  }
  return shared / Math.min(wordsA.size, wordsB.size)
}

/**
 * Run a corpus through the pipeline.
 *
 * The stages are applied in order, and each reports what it removed.
 */
export function runPipeline(
  documents: Document[],
  tokensPerDocument: number,
  options: PipelineOptions = DEFAULT_PIPELINE,
): PipelineResult {
  const stages: PipelineStage[] = []
  const totalBytes = documents.reduce((acc, document) => acc + document.text.length, 0)
  const totalTokens = documents.length * tokensPerDocument

  let current = documents.slice()

  // Stage one: the quality filter.
  const afterQuality = current.filter((document) => document.quality >= options.qualityThreshold)
  stages.push({
    name: 'Quality filter',
    description: `Removes documents scored below ${options.qualityThreshold}.`,
    kept: afterQuality.length,
    removed: current.length - afterQuality.length,
    bytesKept: totalBytes === 0 ? 0 : afterQuality.reduce((acc, d) => acc + d.text.length, 0) / totalBytes,
  })
  current = afterQuality

  // Stage two: deduplication.
  if (options.deduplicate) {
    const seen: Document[] = []
    const afterDeduplication: Document[] = []
    for (const document of current) {
      const duplicate = seen.find((other) => similarity(other.text, document.text) >= options.duplicateSimilarity)
      if (duplicate) {
        duplicate.duplicateOf = document.id
        continue
      }
      seen.push(document)
      afterDeduplication.push(document)
    }
    stages.push({
      name: 'Deduplication',
      description: `Removes near-duplicates at a similarity of ${options.duplicateSimilarity}.`,
      kept: afterDeduplication.length,
      removed: current.length - afterDeduplication.length,
      bytesKept:
        totalBytes === 0
          ? 0
          : afterDeduplication.reduce((acc, d) => acc + d.text.length, 0) / totalBytes,
    })
    current = afterDeduplication
  }

  // Stage three: optional per-source balance.
  if (options.perSourceLimit) {
    const counts = new Map<string, number>()
    const afterBalance: Document[] = []
    for (const document of current) {
      const count = counts.get(document.source) ?? 0
      if (count >= options.perSourceLimit) continue
      counts.set(document.source, count + 1)
      afterBalance.push(document)
    }
    stages.push({
      name: 'Source balance',
      description: `Keeps at most ${options.perSourceLimit} documents from each source.`,
      kept: afterBalance.length,
      removed: current.length - afterBalance.length,
      bytesKept:
        totalBytes === 0
          ? 0
          : afterBalance.reduce((acc, d) => acc + d.text.length, 0) / totalBytes,
    })
    current = afterBalance
  }

  const bySource = new Map<string, { documents: number; bytes: number }>()
  for (const document of current) {
    const entry = bySource.get(document.source) ?? { documents: 0, bytes: 0 }
    entry.documents++
    entry.bytes += document.text.length
    bySource.set(document.source, entry)
  }

  const tokens = current.length * tokensPerDocument

  return {
    stages,
    kept: current,
    tokens,
    originalTokens: totalTokens,
    tokenRetention: totalTokens === 0 ? 0 : tokens / totalTokens,
    mixture: [...bySource.entries()]
      .map(([source, entry]) => ({ source, ...entry }))
      .sort((a, b) => b.bytes - a.bytes),
  }
}

/**
 * Generate a corpus with a mixture, some noise and some duplicates.
 *
 * The structure is deliberate: a realistic corpus is not a uniform sample of
 * text, and a pipeline that only works on uniform text is not a pipeline.
 */
export function generateCorpus({
  documents = 400,
  sources = ['web', 'books', 'code', 'papers'],
  seed = 5,
  duplicateRate = 0.15,
  noiseRate = 0.1,
}: {
  documents?: number
  sources?: string[]
  seed?: number
  duplicateRate?: number
  noiseRate?: number
}): Document[] {
  const rng = createRng(seed)
  const vocabulary = Array.from({ length: 60 }, (_, i) => `w${i}`)
  const result: Document[] = []

  for (let i = 0; i < documents; i++) {
    const source = sources[Math.floor(rng() * sources.length)]!
    const words = Array.from({ length: 20 + Math.floor(rng() * 40) }, () => vocabulary[Math.floor(rng() * vocabulary.length)]!)
    const text = words.join(' ')
    const isNoise = rng() < noiseRate
    const isDuplicate = rng() < duplicateRate && result.length > 0
    const template = isDuplicate ? result[Math.floor(rng() * result.length)]!.text : text

    result.push({
      id: i,
      source,
      text: template,
      quality: isNoise ? rng() * 0.3 : 0.3 + rng() * 0.7,
    })
  }

  return result
}

/** A seeded generator, re-exported for the laboratories. */
export { createRng }
export type { Rng }
