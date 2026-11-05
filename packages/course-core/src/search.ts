/**
 * Course search.
 *
 * Every course in this collection lets a learner search across lessons, lesson
 * body text, glossary terms, assessment questions and references. The ranking
 * is deterministic and explainable: field weights, a prefix bonus, a
 * subsequence bonus and a small length penalty. No scoring model, no
 * telemetry, no network.
 */

export interface SearchDocument {
  id: string
  /** The primary label shown in the result list. */
  title: string
  /** A one-line description shown under the title. */
  summary: string
  /** The full body text that may be matched. */
  body: string
  /** Grouping label, e.g. "Lesson", "Glossary", "Quiz". */
  kind: string
  /** Route to open when the result is chosen. */
  href: string
  /** Extra terms that should match but do not appear in the visible text. */
  keywords?: string[]
}

export interface SearchHit {
  document: SearchDocument
  score: number
  /** The matched terms, in the order they were found. */
  matched: string[]
}

export interface SearchOptions {
  /** Maximum number of hits to return. */
  limit?: number
  /** Weight of a title match relative to a body match. */
  titleWeight?: number
  /** Weight of a summary match relative to a body match. */
  summaryWeight?: number
  /** Weight of a keyword match relative to a body match. */
  keywordWeight?: number
  /**
   * A per-kind multiplier.
   *
   * A course has several kinds of document, and they are not equally
   * useful answers to a query: the lesson that teaches a topic is a better
   * answer than the exercise that tests it. The weights make that explicit
   * and adjustable rather than leaving it to the accident of field lengths.
   */
  kindWeights?: Record<string, number>
}

const DEFAULT_OPTIONS: Required<Omit<SearchOptions, 'kindWeights'>> = {
  limit: 20,
  titleWeight: 6,
  summaryWeight: 2.5,
  keywordWeight: 3,
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
}

/** Does `text` contain `term` as a whole token or as a token prefix? */
function tokenMatch(haystack: string[], term: string): { exact: boolean; prefix: boolean } {
  let prefix = false
  for (const token of haystack) {
    if (token === term) return { exact: true, prefix: true }
    if (!prefix && token.startsWith(term)) prefix = true
  }
  return { exact: false, prefix }
}

/** A subsequence match, e.g. "klpn" matching "KL penalty". */
function subsequenceMatch(haystack: string[], term: string): boolean {
  let i = 0
  for (const token of haystack) {
    if (token.startsWith(term[i])) {
      i++
      if (i === term.length) return true
    }
  }
  return false
}

/**
 * Score one document against one query.
 *
 * Returns 0 when nothing matched. Field matches are weighted separately and
 * the length penalty is applied to the *body* component only: a match in a
 * long body is less specific than a match in a short title, so only the body
 * is discounted for the length of the page it sits in.
 */
export function scoreDocument(document: SearchDocument, query: string, options: SearchOptions = {}): SearchHit {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const terms = tokenize(query)
  if (terms.length === 0) return { document, score: 0, matched: [] }

  const titleTokens = tokenize(document.title)
  const summaryTokens = tokenize(document.summary)
  const bodyTokens = tokenize(document.body)
  const keywordTokens = tokenize((document.keywords ?? []).join(' '))

  let score = 0
  const matched: string[] = []

  for (const term of terms) {
    let termScore = 0
    if (tokenMatch(titleTokens, term).exact) termScore += opts.titleWeight
    else if (tokenMatch(titleTokens, term).prefix) termScore += opts.titleWeight * 0.6

    if (tokenMatch(summaryTokens, term).exact) termScore += opts.summaryWeight
    else if (tokenMatch(summaryTokens, term).prefix) termScore += opts.summaryWeight * 0.5

    if (tokenMatch(keywordTokens, term).exact) termScore += opts.keywordWeight

    // The body component carries its own, much smaller, length discount.
    if (tokenMatch(bodyTokens, term).exact) termScore += 1
    else if (tokenMatch(bodyTokens, term).prefix) termScore += 0.5
    else if (subsequenceMatch(bodyTokens, term)) termScore += 0.25

    if (termScore > 0) {
      score += termScore
      matched.push(term)
    }
  }

  if (score === 0) return { document, score: 0, matched: [] }

  // A phrase bonus: the whole query appearing contiguously in the title is a
  // much stronger signal than the same words appearing separately, and it is
  // what stops a long document that merely mentions the phrase from
  // outranking the document that is named after it.
  const phrase = query.trim().toLowerCase()
  if (phrase.length > 2) {
    if (document.title.toLowerCase().includes(phrase)) score += opts.titleWeight * 1.5
    else if (document.summary.toLowerCase().includes(phrase)) score += opts.summaryWeight
  }

  const lengthPenalty = 1 / (1 + 0.25 * Math.log10(1 + bodyTokens.length / 120))
  score *= lengthPenalty

  const kindWeight = opts.kindWeights?.[document.kind] ?? 1
  score *= kindWeight

  return { document, score, matched }
}

/** Score and rank a set of documents against a query. */
export function search(
  documents: SearchDocument[],
  query: string,
  options: SearchOptions = {},
): SearchHit[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  const limit = options.limit ?? DEFAULT_OPTIONS.limit
  return documents
    .map((document) => scoreDocument(document, trimmed, options))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title))
    .slice(0, limit)
}

/** Build a document set from a list of partial documents, filling in defaults. */
export function buildSearchIndex(partials: Partial<SearchDocument>[]): SearchDocument[] {
  return partials.map((partial, index) => ({
    id: partial.id ?? `doc-${index}`,
    title: partial.title ?? '',
    summary: partial.summary ?? '',
    body: partial.body ?? '',
    kind: partial.kind ?? 'Page',
    href: partial.href ?? '#',
    keywords: partial.keywords ?? [],
  }))
}
