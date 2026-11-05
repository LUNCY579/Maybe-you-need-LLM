/**
 * MIDAS, and perplexity filtering with an adaptive threshold.
 *
 * Both halves of this module are RefinedWeb's contribution to how a web corpus
 * is cleaned, and both are here because the naive version of each rule is
 * wrong in a way the paper could see only at scale.
 *
 * **MIDAS** — MinHash deduplication *and similar-document* filtering. Plain
 * deduplication collapses every near-duplicate to one document. That throws
 * away information: a phrase that appears in three documents is not three
 * copies of one document, and a corpus with no repetition at all is flatter
 * than the web. MIDAS therefore clusters the near-duplicates and keeps up to
 * `keepSimilar` members of each cluster, dropping the rest. The cluster is the
 * unit of decision, not the pair.
 *
 * **Perplexity filtering with a quantile** — the reference model scores every
 * document, and the filter drops the worst-scoring *fraction* rather than
 * everything above a number picked in advance. The distinction matters because
 * the perplexity scale depends on the corpus: a threshold that removes 5% of
 * one corpus removes 40% of another. A quantile says how much goes, which is
 * the thing a budget actually constrains.
 *
 * The corpus here carries ground truth — `isSpam`, `isForeign` and
 * `duplicateOf` are set when the documents are generated — so both filters can
 * be scored against what they were meant to find, rather than against each
 * other.
 */

import { meanQuality, type Document } from './corpus'
import { bands, jaccard, lshRecall, minhashSignature, shingles, signatureSimilarity } from './dedup'
import { documentPerplexity, fitNGram, type NGramModel } from './filters'

/* -------------------------------------------------------------------------- */
/* MIDAS                                                                       */
/* -------------------------------------------------------------------------- */

export interface MidasOptions {
  /** The shingle length of the document sets. */
  shingleSize?: number
  /** The length of each MinHash signature. */
  permutations?: number
  /** How many bands the LSH index splits the signature into. */
  bandCount?: number
  /** The Jaccard similarity at which two documents count as the same story. */
  threshold?: number
  /** How many members of a cluster survive. */
  keepSimilar?: number
}

export interface MidasRemoval {
  id: number
  /** The kept document it was most similar to. */
  matched: number
  similarity: number
}

export interface MidasCluster {
  /** The document ids in the cluster, in corpus order. */
  members: number[]
  /** The members that survived. */
  kept: number[]
  /** The members that were dropped. */
  removed: number[]
  /** The highest true Jaccard similarity between any two members. */
  internalSimilarity: number
}

export interface MidasResult {
  kept: Document[]
  removed: MidasRemoval[]
  /** The clusters of more than one document; a singleton is not a cluster. */
  clusters: MidasCluster[]
  /** Documents that are near-duplicates on the corpus's own ground truth. */
  trueDuplicates: number
  /** How many of those the filter dropped. */
  trueDuplicatesRemoved: number
  /** Recall against that ground truth. */
  recall: number
  /** The fraction of the dropped documents that the ground truth calls unique. */
  falsePositiveFraction: number
  /** Pairs the index proposed for comparison. */
  candidatePairs: number
  comparisons: number
  /** The similarity the LSH would have missed at this banding. */
  expectedRecall: number
}

/**
 * Group the near-duplicates into clusters.
 *
 * Two documents are in the same cluster when their true Jaccard similarity is
 * at least `threshold`; because the clusters are connected components, a
 * document that is similar to a similar document joins the same group even when
 * the outer pair is below the threshold. That is deliberate — it is how a
 * boilerplate template copied with drift keeps arriving in one place — and the
 * cost is visible rather than hidden: `internalSimilarity` reports the strongest
 * pair the cluster contains, so a cluster joined only through a chain of
 * middling matches is not mistaken for a set of close copies.
 */
export function midasFilter(documents: Document[], options: MidasOptions = {}): MidasResult {
  const settings: Required<MidasOptions> = {
    shingleSize: 5,
    permutations: 64,
    bandCount: 16,
    threshold: 0.8,
    keepSimilar: 1,
    ...options,
  }
  const { shingleSize, permutations, bandCount, threshold, keepSimilar } = settings

  const sets = documents.map((document) => shingles(document.tokens, shingleSize))
  const signatures = sets.map((set) => minhashSignature(set, permutations))
  const bandKeys = signatures.map((signature) => bands(signature, bandCount))

  // The LSH index: a band collision is a proposal, never a verdict.
  const index = new Map<string, number[]>()
  for (let i = 0; i < documents.length; i++) {
    bandKeys[i]!.forEach((key, band) => {
      const mapKey = `${band}:${key}`
      const bucket = index.get(mapKey)
      if (bucket) bucket.push(i)
      else index.set(mapKey, [i])
    })
  }

  let candidatePairs = 0
  let comparisons = 0
  const parent = documents.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!
      i = parent[i]!
    }
    return i
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  const proposed = new Set<string>()
  for (let i = 0; i < documents.length; i++) {
    bandKeys[i]!.forEach((key, band) => {
      for (const j of index.get(`${band}:${key}`) ?? []) {
        if (j <= i) continue
        const pair = `${i}:${j}`
        if (proposed.has(pair)) continue
        proposed.add(pair)
        candidatePairs++
        comparisons++
        if (jaccard(sets[i]!, sets[j]!) >= threshold) union(i, j)
      }
    })
  }

  const groups = new Map<number, number[]>()
  for (let i = 0; i < documents.length; i++) {
    const root = find(i)
    const group = groups.get(root)
    if (group) group.push(i)
    else groups.set(root, [i])
  }

  const kept: Document[] = []
  const removals: MidasRemoval[] = []
  const clusters: MidasCluster[] = []
  const keepSet = new Set<number>()

  for (const group of groups.values()) {
    if (group.length === 1) {
      keepSet.add(group[0]!)
      kept.push(documents[group[0]!]!)
      continue
    }
    // the first `keepSimilar` members in corpus order survive; the rest are
    // dropped as repetitions of a story already told
    const keptMembers = group.slice(0, keepSimilar)
    const removedMembers = group.slice(keepSimilar)
    keptMembers.forEach((i) => {
      keepSet.add(i)
      kept.push(documents[i]!)
    })
    for (const i of removedMembers) {
      let best = { matched: keptMembers[0]!, similarity: 0 }
      for (const j of keptMembers) {
        const similarity = jaccard(sets[i]!, sets[j]!)
        if (similarity > best.similarity) best = { matched: j, similarity }
      }
      removals.push({ id: documents[i]!.id, matched: documents[best.matched]!.id, similarity: best.similarity })
    }
    let internal = 0
    for (const a of group) {
      for (const b of group) {
        if (a < b) internal = Math.max(internal, jaccard(sets[a]!, sets[b]!))
      }
    }
    clusters.push({
      members: group.map((i) => documents[i]!.id),
      kept: keptMembers.map((i) => documents[i]!.id),
      removed: removedMembers.map((i) => documents[i]!.id),
      internalSimilarity: internal,
    })
  }

  const truthOf = new Map(documents.map((document) => [document.id, document.duplicateOf !== null]))
  const trueDuplicates = documents.filter((document) => document.duplicateOf !== null).length
  const trueDuplicatesRemoved = removals.filter((removal) => truthOf.get(removal.id)).length
  const dropped = documents.length - kept.length

  return {
    kept,
    removed: removals,
    clusters,
    trueDuplicates,
    trueDuplicatesRemoved,
    recall: trueDuplicates === 0 ? 1 : trueDuplicatesRemoved / trueDuplicates,
    falsePositiveFraction: dropped === 0 ? 0 : (dropped - trueDuplicatesRemoved) / dropped,
    candidatePairs,
    comparisons,
    expectedRecall: lshRecall(threshold, bandCount, permutations),
  }
}

/* -------------------------------------------------------------------------- */
/* Perplexity filtering at a quantile                                          */
/* -------------------------------------------------------------------------- */

export interface PerplexityFilterResult {
  kept: Document[]
  dropped: Document[]
  /** The perplexity at the boundary; the kept documents are at or below it. */
  threshold: number
  /** The perplexities of the whole pool, in pool order, for the histogram. */
  perplexities: number[]
  keptMeanQuality: number
  droppedMeanQuality: number
  /** Boilerplate and unseen-language documents in each half. */
  unwantedKept: number
  unwantedDropped: number
  model: NGramModel
}

/**
 * Keep the best-scoring fraction of a pool under a reference model.
 *
 * The threshold is a quantile of the pool's own perplexities, so the caller
 * decides how much goes and the number follows. Ties are broken by document id,
 * which makes the cut deterministic: the same pool and the same fraction always
 * give the same kept set.
 *
 * By default the model is fit on the first `backgroundFraction` of the pool.
 * `referencePool` overrides that with an explicit set of documents, because which
 * reference a perplexity filter uses *is* the filter: a model fit on one domain
 * rates every other domain as surprising, and a filter with no reference at all
 * has nothing to compare the pool against.
 */
export function adaptivePerplexityFilter(
  pool: Document[],
  options: {
    keepFraction?: number
    backgroundFraction?: number
    order?: 1 | 2 | 3
    /** The documents the reference model is fit on, instead of a slice of the pool. */
    referencePool?: Document[]
  } = {},
): PerplexityFilterResult {
  const settings = { keepFraction: 0.9, backgroundFraction: 0.25, order: 3 as 1 | 2 | 3, ...options }
  if (pool.length === 0) {
    return {
      kept: [],
      dropped: [],
      threshold: 0,
      perplexities: [],
      keptMeanQuality: 0,
      droppedMeanQuality: 0,
      unwantedKept: 0,
      unwantedDropped: 0,
      model: fitNGram([], { order: settings.order }),
    }
  }
  const backgroundCount = Math.max(10, Math.floor(pool.length * settings.backgroundFraction))
  const model = fitNGram(settings.referencePool ?? pool.slice(0, backgroundCount), { order: settings.order })
  const perplexities = pool.map((document) => documentPerplexity(model, document.tokens))

  const ordered = pool
    .map((document, index) => ({ document, perplexity: perplexities[index]!, index }))
    .sort((a, b) => a.perplexity - b.perplexity || a.index - b.index)
  const keepCount = Math.min(pool.length, Math.max(1, Math.round(pool.length * settings.keepFraction)))
  const keptSet = new Set(ordered.slice(0, keepCount).map((entry) => entry.index))
  const threshold = ordered[keepCount - 1]!.perplexity

  const kept: Document[] = []
  const dropped: Document[] = []
  for (let i = 0; i < pool.length; i++) (keptSet.has(i) ? kept : dropped).push(pool[i]!)

  const unwanted = (documents: Document[]) => documents.filter((document) => document.isSpam || document.isForeign).length
  return {
    kept,
    dropped,
    threshold,
    perplexities,
    keptMeanQuality: meanQuality(kept),
    droppedMeanQuality: meanQuality(dropped),
    unwantedKept: unwanted(kept),
    unwantedDropped: unwanted(dropped),
    model,
  }
}

/**
 * The score of the same document under two reference models.
 *
 * RefinedWeb used a Wikipedia-trained model and a URL-anchored model as well as
 * the in-domain one, because a single reference model rates its own habits as
 * good text. This reports the perplexity of a pool under each model so the
 * disagreement between them is a number on the screen rather than a footnote.
 */
export function perplexityUnderModels(
  pool: Document[],
  referencePools: { name: string; documents: Document[] }[],
  options: { order?: 1 | 2 | 3 } = {},
): { name: string; meanPerplexity: number; perplexities: number[] }[] {
  const order = options.order ?? 3
  return referencePools.map((reference) => {
    const model = fitNGram(reference.documents, { order })
    const perplexities = pool.map((document) => documentPerplexity(model, document.tokens))
    return {
      name: reference.name,
      meanPerplexity: perplexities.reduce((a, b) => a + b, 0) / (perplexities.length || 1),
      perplexities,
    }
  })
}

/** The signature similarity MIDAS would have used had it trusted MinHash. */
export function signatureEstimate(a: Document, b: Document, permutations = 64, shingleSize = 5): number {
  return signatureSimilarity(
    minhashSignature(shingles(a.tokens, shingleSize), permutations),
    minhashSignature(shingles(b.tokens, shingleSize), permutations),
  )
}
