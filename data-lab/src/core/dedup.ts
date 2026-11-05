/**
 * Deduplication and decontamination.
 *
 * Two different jobs that are often confused. *Deduplication* removes
 * documents that are copies of each other, because copies waste the compute
 * that would otherwise have gone to new text. *Decontamination* removes
 * documents that overlap a benchmark, because a benchmark the model has
 * already seen is not a measurement.
 *
 * Both are implemented here as real algorithms on the synthetic corpus:
 * exact hashing, fuzzy matching by Jaccard similarity over token shingles,
 * MinHash with Locality-Sensitive Hashing to make the fuzzy search
 * sub-quadratic, and n-gram overlap for decontamination.
 */

import type { Document } from './corpus'

/** A stable 32-bit hash of a string, used for the shingle sets and the LSH. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** The set of token shingles of a document. */
export function shingles(tokens: number[], size: number): Set<number> {
  const result = new Set<number>()
  if (tokens.length < size) {
    if (tokens.length > 0) result.add(hashString(tokens.join(',')))
    return result
  }
  for (let i = 0; i + size <= tokens.length; i++) {
    result.add(hashString(tokens.slice(i, i + size).join(',')))
  }
  return result
}

/** The Jaccard similarity of two sets. */
export function jaccard(a: Set<number>, b: Set<number>): number {
  if (a.size === 0 && b.size === 0) return 1
  let intersection = 0
  for (const value of a) if (b.has(value)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * A MinHash signature.
 *
 * The signature is an estimate of the Jaccard similarity: the fraction of
 * hash functions on which the two sets agree. Each hash function is a
 * universal hash `(a·x + b) mod 2^32` with its own odd multiplier and
 * offset, drawn from a fixed seed so that the signature is reproducible. The
 * error of the estimate is the standard √((1−J)/k), and the test suite checks
 * that the estimate lands within it.
 */
export function minhashSignature(set: Set<number>, permutations: number): number[] {
  const signature: number[] = []
  let state = 0x2545f491
  for (let p = 0; p < permutations; p++) {
    // A small deterministic generator of the (a, b) pairs.
    state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff
    const a = (state | 1) >>> 0
    state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff
    const b = state >>> 0
    let minimum = 0xffffffff
    for (const value of set) {
      const hash = (Math.imul(a, value >>> 0) + b) >>> 0
      if (hash < minimum) minimum = hash
    }
    signature.push(minimum === 0xffffffff ? 0xffffffff : minimum)
  }
  return signature
}

/** The estimated Jaccard similarity of two MinHash signatures. */
export function signatureSimilarity(a: number[], b: number[]): number {
  if (a.length === 0) return 0
  let agreements = 0
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) agreements++
  return agreements / a.length
}

/**
 * The bands of an LSH index.
 *
 * The signature is cut into `bands` bands of `rows` rows each. Two documents
 * are candidates if they agree on every band. The probability that a pair
 * with Jaccard similarity J becomes a candidate is 1 − (1 − J^rows)^bands,
 * which is the reason the band counts are what they are.
 */
export function bands(signature: number[], bandCount: number): number[] {
  const rows = Math.max(1, Math.floor(signature.length / bandCount))
  const keys: number[] = []
  for (let band = 0; band < bandCount; band++) {
    let key = 0x811c9dc5
    for (let r = 0; r < rows; r++) {
      const value = signature[band * rows + r] ?? 0
      key ^= value
      key = Math.imul(key, 0x01000193)
    }
    keys.push(key >>> 0)
  }
  return keys
}

/** The probability that a pair with similarity J is caught by an LSH index. */
export function lshRecall(jaccardSimilarity: number, bandCount: number, signatureLength: number): number {
  const rows = Math.max(1, Math.floor(signatureLength / bandCount))
  return 1 - (1 - jaccardSimilarity ** rows) ** bandCount
}

export interface DeduplicationResult {
  /** The documents that survived. */
  kept: Document[]
  /** The documents that were removed as duplicates, with what they matched. */
  removed: { id: number; matched: number; similarity: number }[]
  /** The pairs the LSH index proposed. */
  candidatePairs: number
  /** The number of pairs the LSH index compared in full. */
  comparisons: number
}

/**
 * Deduplicate a corpus.
 *
 * The exact pass removes byte-identical documents. The fuzzy pass uses
 * MinHash and LSH to find candidates and then confirms them with the true
 * Jaccard similarity of the shingle sets.
 */
export function deduplicate(
  documents: Document[],
  options: { threshold?: number; shingleSize?: number; permutations?: number; bandCount?: number } = {},
): DeduplicationResult {
  const settings = { threshold: 0.8, shingleSize: 5, permutations: 64, bandCount: 16, ...options }

  const removed = new Map<number, { id: number; matched: number; similarity: number }>()
  const kept: Document[] = []
  const seen = new Map<number, number>()

  for (const document of documents) {
    const exact = hashString(document.tokens.join(','))
    const previous = seen.get(exact)
    if (previous !== undefined) {
      removed.set(document.id, { id: document.id, matched: previous, similarity: 1 })
      continue
    }
    seen.set(exact, document.id)
    kept.push(document)
  }

  // The fuzzy pass over what is left.
  const surviving = kept.slice()
  const sets = surviving.map((document) => shingles(document.tokens, settings.shingleSize))
  const signatures = sets.map((set) => minhashSignature(set, settings.permutations))
  const bandKeys = signatures.map((signature) => bands(signature, settings.bandCount))

  const index = new Map<string, number[]>()
  for (let i = 0; i < surviving.length; i++) {
    bandKeys[i]!.forEach((key, band) => {
      const mapKey = `${band}:${key}`
      const bucket = index.get(mapKey)
      if (bucket) bucket.push(i)
      else index.set(mapKey, [i])
    })
  }

  const seenPairs = new Set<string>()
  let candidatePairs = 0
  let comparisons = 0
  const dropped = new Set<number>()

  for (let i = 0; i < surviving.length; i++) {
    if (dropped.has(i)) continue
    const candidates = new Set<number>()
    bandKeys[i]!.forEach((key, band) => {
      for (const j of index.get(`${band}:${key}`) ?? []) {
        if (j > i) candidates.add(j)
      }
    })
    for (const j of candidates) {
      const key = `${i}:${j}`
      if (seenPairs.has(key)) continue
      seenPairs.add(key)
      candidatePairs++
      comparisons++
      const similarity = jaccard(sets[i]!, sets[j]!)
      if (similarity >= settings.threshold) {
        const survivor = surviving[i]!
        const target = surviving[j]!
        removed.set(target.id, { id: target.id, matched: survivor.id, similarity })
        dropped.add(j)
      }
    }
  }

  return {
    kept: surviving.filter((_, index) => !dropped.has(index)),
    removed: [...removed.values()],
    candidatePairs,
    comparisons,
  }
}

/**
 * Decontaminate a corpus against a benchmark.
 *
 * A document is contaminated if it shares an n-gram with a benchmark example.
 * The threshold is the fraction of the benchmark example's n-grams that must
 * appear, and the standard is to require the overlap to be long enough to be
 * unmistakable.
 *
 * The overlap is measured against the *example's* n-grams, not the document's,
 * because the question is whether the example is in the corpus rather than
 * whether the document is in the benchmark. That also fixes the failure mode:
 * an edit anywhere inside an n-gram destroys that n-gram, so a lightly edited
 * copy loses overlap faster than a reader would expect, and the shorter the
 * n-gram the faster it loses it. `plantBenchmarkLeaks` below is the laboratory
 * that measures how much of the leak survives.
 */
export interface DecontaminationResult {
  kept: Document[]
  contaminated: { id: number; matched: string; overlap: number }[]
  /** How many benchmark examples each contaminated document matched. */
  matchesPerDocument: number[]
}

export function decontaminate(
  documents: Document[],
  benchmark: { id: string; tokens: number[] }[],
  options: { ngramSize?: number; threshold?: number } = {},
): DecontaminationResult {
  const settings = { ngramSize: 8, threshold: 0.5, ...options }

  const benchmarkShingles = new Map<string, { id: string; set: Set<number> }>()
  for (const example of benchmark) {
    benchmarkShingles.set(example.id, { id: example.id, set: shingles(example.tokens, settings.ngramSize) })
  }

  const contaminated: { id: number; matched: string; overlap: number }[] = []
  const matchesPerDocument: number[] = []
  const kept: Document[] = []

  for (const document of documents) {
    const documentSet = shingles(document.tokens, settings.ngramSize)
    let best = { id: '', overlap: 0 }
    let matches = 0
    for (const { id, set } of benchmarkShingles.values()) {
      let shared = 0
      for (const shingle of documentSet) if (set.has(shingle)) shared++
      const overlap = set.size === 0 ? 0 : shared / set.size
      if (overlap >= settings.threshold) {
        matches++
        if (overlap > best.overlap) best = { id, overlap }
      }
    }
    if (matches > 0) {
      contaminated.push({ id: document.id, matched: best.id, overlap: best.overlap })
      matchesPerDocument.push(matches)
    } else {
      kept.push(document)
    }
  }

  return { kept, contaminated, matchesPerDocument }
}

export interface BenchmarkLeaks {
  /** The evaluation examples, as the decontamination filter sees them. */
  benchmark: { id: string; tokens: number[] }[]
  /** The corpus with the leaked documents appended. */
  pool: Document[]
  /** The ids of the leaked documents, which is the ground truth the filter is scored on. */
  planted: number[]
}

/**
 * Leak a handful of benchmark examples into a corpus, edited.
 *
 * This is scaffolding for the decontamination laboratory, not a filter: a real
 * leak cannot be manufactured on purpose, and without one there is no way to
 * score the rule. The examples come from a *different* corpus than the one they
 * are leaked into, because a benchmark drawn from the training corpus itself is
 * trivially found — the originals match their own n-grams exactly, and a quarter
 * of the matches are near-duplicates the generator already planted.
 *
 * `editSpacing` is how the copy is edited: every `editSpacing`-th token is
 * changed, so a spacing of 25 edits 4% of the document and a spacing of 7 edits
 * 14%. The point of the parameter is that the two are not equally findable, and
 * the difference is a property of the n-gram rule rather than of the leak.
 */
export function plantBenchmarkLeaks(
  documents: Document[],
  examples: Document[],
  options: { copies?: number; editSpacing?: number } = {},
): BenchmarkLeaks {
  const settings = { copies: 8, editSpacing: 17, ...options }
  const chosen = examples.slice(0, Math.max(0, Math.min(settings.copies, examples.length)))
  const planted: number[] = []
  const copies: Document[] = chosen.map((document, index) => {
    const id = documents.length + index
    planted.push(id)
    return {
      ...document,
      id,
      // shifted down by one rather than wrapped, so the edited token is still
      // inside whatever vocabulary the corpus uses
      tokens: document.tokens.map((token, position) =>
        position % settings.editSpacing === 0 ? (token === 0 ? 1 : token - 1) : token,
      ),
    }
  })
  return {
    benchmark: chosen.map((document) => ({ id: `example-${document.id}`, tokens: document.tokens })),
    pool: [...documents, ...copies],
    planted,
  }
}
