/**
 * Data curation: what a filter throws away.
 *
 * Chapter 3 §3.2.1 describes the curation pipeline that stands between a web
 * crawl and a training corpus: source prioritisation, noise reduction,
 * de-duplication at the URL and document level, safety filtering, and bias
 * mitigation. It also names the two failure modes that matter, and they pull
 * in opposite directions:
 *
 *  - **Duplicates must go.** "De-duplication is performed at both the URL and
 *    document levels; this is essential to prevent the model from memorizing
 *    redundant information and overfitting on repetitive data." A filter that
 *    is too permissive leaves near-identical documents in, and the model
 *    memorises them.
 *  - **But filters also remove what they should not.** "Automated filters can
 *    inadvertently flag and suppress legitimate data written in specific
 *    dialects, such as African American English, leading to the accidental
 *    exclusion of diverse voices from the training set." A filter that is too
 *    aggressive shrinks the corpus, and it shrinks it unevenly.
 *
 * The same tension appears in Chapter 19: "aggressive filtering for quality
 * can outweigh sheer quantity", and a corpus that has been filtered too hard
 * is a corpus that has been made less diverse than the web.
 *
 * This engine makes the tension computable. It is a deterministic simulation
 * of a two-knob filter over a small corpus, and it is honest about what it
 * does and does not model: it models the *bookkeeping* of filtering, not the
 * perplexity of a language model.
 */

export interface CorpusDocument {
  id: string
  title: string
  /** Where the document came from. */
  source: 'curated' | 'web' | 'forum' | 'code'
  /** A quality score in [0, 1] — a perplexity proxy, higher is better. */
  quality: number
  /**
   * The document this one is a near-duplicate of.
   *
   * The pipeline drops the later of a pair when the similarity between them
   * reaches the threshold.
   */
  duplicateOf?: string
  /** The similarity to the document it duplicates, in [0, 1]. */
  similarity?: number
  /** Whether the safety filter would remove it. */
  unsafe?: boolean
  /**
   * Whether the document is written in a dialect the filters tend to flag.
   *
   * These are legitimate documents, and they score lower on the quality proxy
   * for reasons that have nothing to do with their worth.
   */
  dialect?: boolean
  /** The size of the document, in tokens. */
  tokens: number
}

export interface FilterSettings {
  /** Documents below this quality are dropped. */
  qualityThreshold: number
  /** A near-duplicate is dropped when it is at least this similar. */
  similarityThreshold: number
  /** Whether the safety filter runs. */
  safetyFilter: boolean
}

export type DropReason = 'quality' | 'duplicate' | 'safety'

export interface DroppedDocument {
  document: CorpusDocument
  reason: DropReason
}

export interface SourceMix {
  source: CorpusDocument['source']
  /** Tokens before filtering. */
  before: number
  /** Tokens after filtering. */
  after: number
}

export interface CurationOutcome {
  kept: CorpusDocument[]
  dropped: DroppedDocument[]
  /** Tokens before and after. */
  tokensBefore: number
  tokensAfter: number
  /** The share of the corpus that survived, in tokens. */
  retained: number
  /** The source mix before and after. */
  mix: SourceMix[]
  /** Whether the dialect variety survived. */
  dialectKept: boolean
  /** How many near-duplicates survived. */
  duplicatesKept: number
  /**
   * The documents that were dropped although they were fine.
   *
   * A dialect document removed by the quality filter is the clearest case:
   * legitimate data, removed for looking different.
   */
  falsePositives: CorpusDocument[]
  /** The near-duplicates that survived the filter. */
  falseNegatives: CorpusDocument[]
  /** One sentence on what the filter did. */
  explanation: string
  /** The headline, in one line. */
  headline: string
}

export interface Corpus {
  id: string
  title: string
  /** What the corpus is, and why it is a problem. */
  context: string
  documents: CorpusDocument[]
  /** The note on what the case is for. */
  note: string
}

/**
 * Run the curation pipeline.
 *
 * The order is the book's: the safety filter and the quality filter run on
 * every document, and the de-duplication pass runs over what survives. A
 * document is dropped for the *first* reason that applies, and the order
 * matters — a duplicate that is also low quality is reported as low quality,
 * because that is the filter that caught it.
 */
export function curate(corpus: Corpus, settings: FilterSettings): CurationOutcome {
  const kept: CorpusDocument[] = []
  const dropped: DroppedDocument[] = []
  const seen = new Set<string>()

  for (const document of corpus.documents) {
    if (settings.safetyFilter && document.unsafe) {
      dropped.push({ document, reason: 'safety' })
      continue
    }
    if (document.quality < settings.qualityThreshold) {
      dropped.push({ document, reason: 'quality' })
      continue
    }
    if (document.duplicateOf && seen.has(document.duplicateOf)) {
      const similarity = document.similarity ?? 1
      if (similarity >= settings.similarityThreshold) {
        dropped.push({ document, reason: 'duplicate' })
        continue
      }
    }
    kept.push(document)
    seen.add(document.id)
  }

  const tokensBefore = corpus.documents.reduce((sum, document) => sum + document.tokens, 0)
  const tokensAfter = kept.reduce((sum, document) => sum + document.tokens, 0)

  const sources: CorpusDocument['source'][] = ['curated', 'web', 'forum', 'code']
  const mix: SourceMix[] = sources.map((source) => {
    const before = corpus.documents
      .filter((document) => document.source === source)
      .reduce((sum, document) => sum + document.tokens, 0)
    const after = kept
      .filter((document) => document.source === source)
      .reduce((sum, document) => sum + document.tokens, 0)
    return { source, before, after }
  })

  const dialectDocuments = corpus.documents.filter((document) => document.dialect)
  const dialectKept = dialectDocuments.some((document) => kept.some((k) => k.id === document.id))
  const duplicatesKept = kept.filter((document) => document.duplicateOf).length

  // A document is a false positive when it was dropped by the quality filter
  // and it was not actually bad — the dialect documents, and the duplicates
  // that were the *only* copy of something.
  const falsePositives = dropped
    .filter((entry) => entry.reason === 'quality')
    .map((entry) => entry.document)
    .filter((document) => document.dialect || document.duplicateOf === undefined)
  const falseNegatives = kept.filter(
    (document) => document.duplicateOf && (document.similarity ?? 0) < settings.similarityThreshold,
  )

  const retained = tokensBefore === 0 ? 0 : tokensAfter / tokensBefore

  let headline: string
  if (dialectDocuments.length > 0 && !dialectKept) {
    headline = `${Math.round(retained * 100)}% of the corpus kept — and a whole variety of writing was filtered out with it.`
  } else if (duplicatesKept > 0) {
    headline = `${Math.round(retained * 100)}% of the corpus kept — but ${duplicatesKept} near-duplicate${duplicatesKept === 1 ? '' : 's'} went through, and the model will memorise them.`
  } else if (retained < 0.4) {
    headline = `${Math.round(retained * 100)}% of the corpus kept. Aggressive filtering can outweigh sheer quantity — and a corpus that small is a narrow one.`
  } else {
    headline = `${Math.round(retained * 100)}% of the corpus kept, with the duplicates gone and the variety intact.`
  }

  let explanation: string
  if (dialectDocuments.length > 0 && !dialectKept) {
    explanation =
      'The quality filter removed the dialect documents along with the genuinely low-quality ones. Nothing in the pipeline said "this writing is worthless" — the filter said "this is unusual", and unusual scored low.'
  } else if (duplicatesKept > 0) {
    explanation =
      'Near-duplicates survived, so the same passage will be seen several times. That is the overfitting the de-duplication stage exists to prevent, and it happened because the threshold was too strict to call them duplicates.'
  } else if (retained < 0.4) {
    explanation =
      'Most of the corpus was filtered out. The book\'s warning applies: aggressive filtering for quality can outweigh sheer quantity, and a small corpus is also a narrow one.'
  } else {
    explanation =
      'The corpus came out large, with the duplicates removed and the variety kept. Both failure modes are avoided at once, which is the point of choosing the thresholds rather than assuming them.'
  }

  return {
    kept,
    dropped,
    tokensBefore,
    tokensAfter,
    retained,
    mix,
    dialectKept,
    duplicatesKept,
    falsePositives,
    falseNegatives,
    explanation,
    headline,
  }
}

/* ------------------------------------------------------------------ */
/* Corpora                                                             */
/* ------------------------------------------------------------------ */

export const CORPORA: Corpus[] = [
  {
    id: 'web-crawl',
    title: 'A web crawl',
    context:
      'Common Crawl is a snapshot of the web: mostly fine, and full of the same article syndicated to a hundred sites. The pipeline has to remove those near-duplicates without removing the original.',
    note:
      'The duplicated passages are all but identical and are worth removing: leaving them in teaches the model to memorise them. The question is what threshold catches them without also removing the short, unusual documents that happen to score low.',
    documents: [
      { id: 'w1', title: 'Encyclopaedia entry: Transformer', source: 'curated', quality: 0.93, tokens: 4200 },
      { id: 'w2', title: 'A blog post about transformers', source: 'web', quality: 0.71, tokens: 1800, duplicateOf: 'w1', similarity: 0.93 },
      { id: 'w3', title: 'The same blog post, second site', source: 'web', quality: 0.7, tokens: 1750, duplicateOf: 'w1', similarity: 0.91 },
      { id: 'w4', title: 'The same blog post, third site', source: 'web', quality: 0.69, tokens: 1700, duplicateOf: 'w1', similarity: 0.89 },
      { id: 'w5', title: 'A near-copy with a different title', source: 'web', quality: 0.55, tokens: 1600, duplicateOf: 'w1', similarity: 0.74 },
      { id: 'w6', title: 'Scraped product page', source: 'web', quality: 0.22, tokens: 300 },
      { id: 'w7', title: 'Scraped page, navigation only', source: 'web', quality: 0.11, tokens: 200 },
      { id: 'w8', title: 'A recipe forum thread', source: 'forum', quality: 0.44, tokens: 900 },
      { id: 'w9', title: 'A long essay on cooking', source: 'web', quality: 0.66, tokens: 2600 },
      { id: 'w10', title: 'Reference documentation for a library', source: 'code', quality: 0.88, tokens: 3100 },
      { id: 'w11', title: 'A spam page', source: 'web', quality: 0.3, tokens: 150, unsafe: true },
      { id: 'w12', title: 'A discussion of a disputed recipe', source: 'forum', quality: 0.5, tokens: 800 },
      { id: 'w13', title: 'A comment in a regional dialect', source: 'forum', quality: 0.34, tokens: 320, dialect: true },
    ],
  },
  {
    id: 'forum-archive',
    title: 'A forum archive',
    context:
      'Forums are where the writing is most varied and where the filters are most likely to be wrong. A dialect that reads as unusual to a reference model scores low, and a low score is what a threshold acts on.',
    note:
      'Every document here is legitimate. The dialect variety scores lower on the quality proxy for reasons that have nothing to do with its worth, which is exactly the case Chapter 3 §3.2.1 warns about: filters that flag and suppress legitimate writing, and the accidental exclusion of diverse voices.',
    documents: [
      { id: 'f1', title: 'Thread: how to season a stew', source: 'forum', quality: 0.68, tokens: 1200 },
      { id: 'f2', title: 'Thread: the same question, second forum', source: 'forum', quality: 0.66, tokens: 1100, duplicateOf: 'f1', similarity: 0.88 },
      { id: 'f3', title: 'Thread: buying a used stove', source: 'forum', quality: 0.61, tokens: 950 },
      { id: 'f4', title: 'Thread: a reply in African American English', source: 'forum', quality: 0.31, tokens: 780, dialect: true },
      { id: 'f5', title: 'Thread: another reply in African American English', source: 'forum', quality: 0.29, tokens: 640, dialect: true },
      { id: 'f6', title: 'Thread: a reply in a regional dialect', source: 'forum', quality: 0.34, tokens: 520, dialect: true },
      { id: 'f7', title: 'Thread: an incoherent reply', source: 'forum', quality: 0.08, tokens: 90 },
      { id: 'f8', title: 'Thread: a link dump', source: 'forum', quality: 0.19, tokens: 140 },
      { id: 'f9', title: 'Thread: a long, careful answer', source: 'forum', quality: 0.82, tokens: 2100 },
      { id: 'f10', title: 'Thread: a short, careful answer', source: 'forum', quality: 0.74, tokens: 420 },
      { id: 'f11', title: 'A page of scraped replies', source: 'web', quality: 0.16, tokens: 300 },
      { id: 'f12', title: 'A post with an abusive reply', source: 'forum', quality: 0.4, tokens: 260, unsafe: true },
    ],
  },
  {
    id: 'mixed-pile',
    title: 'A mixed pile',
    context:
      'Everything at once: a reference work, a code archive, a forum, a crawl, and a pile of synthetic text generated by a model that had itself read the benchmarks.',
    note:
      'The synthetic documents are the hardest case. They are fluent, on-topic, and close enough to the benchmark that a filter keyed on n-gram overlap has to catch them — which is why the book says the solutions "should go beyond simple exact-match filters".',
    documents: [
      { id: 'm1', title: 'Reference work: the history of the transistor', source: 'curated', quality: 0.95, tokens: 5200 },
      { id: 'm2', title: 'Code archive: a parser', source: 'code', quality: 0.9, tokens: 1400 },
      { id: 'm3', title: 'Code archive: the same parser, forked', source: 'code', quality: 0.86, tokens: 1300, duplicateOf: 'm2', similarity: 0.87 },
      { id: 'm4', title: 'A forum thread about the transistor', source: 'forum', quality: 0.62, tokens: 880 },
      { id: 'm5', title: 'A reply in African American English', source: 'forum', quality: 0.32, tokens: 690, dialect: true },
      { id: 'm6', title: 'A crawl of news articles', source: 'web', quality: 0.67, tokens: 3100 },
      { id: 'm7', title: 'A crawl of the same news article', source: 'web', quality: 0.65, tokens: 2900, duplicateOf: 'm6', similarity: 0.95 },
      { id: 'm8', title: 'A crawl of the same news article again', source: 'web', quality: 0.64, tokens: 2850, duplicateOf: 'm6', similarity: 0.93 },
      { id: 'm9', title: 'Synthetic: a generated answer on the transistor', source: 'web', quality: 0.72, tokens: 1100 },
      { id: 'm10', title: 'Synthetic: a generated answer about the benchmark itself', source: 'web', quality: 0.74, tokens: 900, duplicateOf: 'm1', similarity: 0.82 },
      { id: 'm11', title: 'A page of scraped links', source: 'web', quality: 0.17, tokens: 220 },
      { id: 'm12', title: 'A post with personal information', source: 'forum', quality: 0.45, tokens: 310, unsafe: true },
    ],
  },
]

export const CORPUS_BY_ID = new Map(CORPORA.map((entry) => [entry.id, entry]))
