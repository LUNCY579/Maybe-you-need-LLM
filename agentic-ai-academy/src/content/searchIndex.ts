/**
 * Course-wide search.
 *
 * The index is built once from the static curriculum content and scored with a
 * small, deterministic ranking function. There is no fuzzy-matching library
 * and no network call: search is a pure function of the course content and
 * the query string, which keeps it testable and reproducible.
 */

import { ALL_QUESTIONS, LESSONS } from './lessons'
import { GLOSSARY } from './glossary'
import { LABS } from './labs'
import { REFERENCES } from './references'

export type SearchKind = 'lesson' | 'section' | 'glossary' | 'question' | 'lab' | 'reference'

export interface SearchEntry {
  id: string
  kind: SearchKind
  /** Primary label shown in the result list. */
  title: string
  /** Secondary line shown under the title. */
  snippet: string
  /** Hash route the result navigates to. */
  route: string
  /** Extra text folded into the searchable haystack. */
  keywords: string
  /** Lesson the entry belongs to, when applicable. */
  lessonSlug?: string
  /** Book chapter the entry is sourced from, when applicable. */
  source?: string
}

export interface SearchResult extends SearchEntry {
  score: number
  /** Matched terms, for highlighting. */
  matched: string[]
}

function blockText(blocks: { kind: string }[]): string {
  return blocks
    .map((block) => {
      const record = block as unknown as Record<string, unknown>
      const parts: string[] = []
      if (typeof record.markdown === 'string') parts.push(record.markdown)
      if (typeof record.question === 'string') parts.push(record.question)
      if (typeof record.answer === 'string') parts.push(record.answer)
      if (typeof record.title === 'string') parts.push(record.title)
      if (typeof record.detail === 'string') parts.push(record.detail)
      if (typeof record.takeaway === 'string') parts.push(record.takeaway)
      if (typeof record.caption === 'string') parts.push(record.caption)
      if (typeof record.markdown === 'string') parts.push(record.markdown)
      if (Array.isArray(record.items)) parts.push(record.items.join(' '))
      if (Array.isArray(record.steps)) {
        for (const step of record.steps as { label?: string; detail?: string }[]) {
          parts.push(step.label ?? '', step.detail ?? '')
        }
      }
      if (Array.isArray(record.headers) && Array.isArray(record.rows)) {
        parts.push((record.headers as string[]).join(' '))
        for (const row of record.rows as string[][]) parts.push(row.join(' '))
      }
      if (Array.isArray(record.options)) parts.push((record.options as string[]).join(' '))
      if (typeof record.latex === 'string') parts.push(record.latex)
      return parts.join(' ')
    })
    .join(' ')
}

function buildIndex(): SearchEntry[] {
  const entries: SearchEntry[] = []

  for (const lesson of LESSONS) {
    entries.push({
      id: `lesson:${lesson.slug}`,
      kind: 'lesson',
      title: lesson.title,
      snippet: lesson.summary,
      route: `#/lesson/${lesson.slug}`,
      keywords: [lesson.summary, lesson.keywords.join(' '), lesson.objectives.map((o) => o.text).join(' ')].join(' '),
      lessonSlug: lesson.slug,
      source: lesson.sources[0]?.label,
    })

    for (const section of [...lesson.sections, ...lesson.advancedSections]) {
      entries.push({
        id: `section:${lesson.slug}:${section.id}`,
        kind: 'section',
        title: section.title,
        snippet: `Lesson ${lesson.order}: ${lesson.title}`,
        route: `#/lesson/${lesson.slug}#section-${section.id}`,
        keywords: `${section.title} ${blockText(section.blocks as never)}`,
        lessonSlug: lesson.slug,
        source: lesson.sources[0]?.label,
      })
    }
  }

  for (const term of GLOSSARY) {
    entries.push({
      id: `glossary:${term.term}`,
      kind: 'glossary',
      title: term.term,
      snippet: term.definition,
      route: `#/glossary?term=${encodeURIComponent(term.term)}`,
      keywords: `${term.definition} ${term.related.join(' ')}`,
      source: term.source?.label,
    })
  }

  for (const question of ALL_QUESTIONS) {
    entries.push({
      id: `question:${question.id}`,
      kind: 'question',
      title: question.prompt,
      snippet: question.source.label,
      route: `#/assessments?question=${encodeURIComponent(question.id)}`,
      keywords: `${question.prompt} ${question.options.join(' ')} ${question.explanation}`,
      source: question.source.label,
    })
  }

  for (const lab of LABS) {
    entries.push({
      id: `lab:${lab.id}`,
      kind: 'lab',
      title: lab.name,
      snippet: lab.tagline,
      route: `#${lab.route}`,
      keywords: `${lab.description} ${lab.concepts.join(' ')} ${lab.runtime} ${lab.tagline}`,
      source: `Ch. ${lab.sourceChapters.join(', ')}`,
    })
  }

  for (const reference of REFERENCES) {
    entries.push({
      id: `reference:${reference.id}`,
      kind: 'reference',
      title: reference.title,
      snippet: `${reference.authors} · ${reference.venue}`,
      route: `#/references?ref=${encodeURIComponent(reference.id)}`,
      keywords: `${reference.title} ${reference.authors} ${reference.usedFor} ${reference.venue}`,
    })
  }

  return entries
}

/** The full course index. Built lazily once and then reused. */
export const SEARCH_INDEX: SearchEntry[] = buildIndex()

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'for', 'on', 'with', 'as', 'by', 'at', 'from',
  'what', 'how', 'why', 'which', 'that', 'this', 'be', 'are', 'was', 'do', 'does', 'can',
])

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((token) => token.replace(/^\.+|\.+$/g, ''))
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
}

/**
 * Split a text into comparable tokens.
 *
 * Used for matching, so that a query for "language" does not match
 * "vision-language-action" inside a word: matching happens on whole tokens,
 * not on raw substrings.
 */
function tokenSet(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((token) => token.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean)
}

function normalise(text: string): string {
  return text.toLowerCase()
}

/**
 * Score a single entry against the query tokens.
 *
 * Weighted so that a title match outranks a body match, and an exact phrase
 * match outranks scattered term matches. Returns 0 when nothing matches.
 */
export function scoreEntry(entry: SearchEntry, tokens: string[], rawQuery: string): { score: number; matched: string[] } {
  if (tokens.length === 0) return { score: 0, matched: [] }

  const title = normalise(entry.title)
  const body = normalise(entry.keywords)
  const phrase = normalise(rawQuery.trim())

  const titleTokens = new Set(tokenSet(entry.title))
  const snippetTokens = new Set(tokenSet(entry.snippet))
  const bodyTokens = new Set(tokenSet(entry.keywords))

  let score = 0
  const matched: string[] = []

  if (phrase.length > 1 && title.includes(phrase)) score += 12
  if (phrase.length > 1 && body.includes(phrase)) score += 6

  for (const token of tokens) {
    let tokenScore = 0
    if (titleTokens.has(token)) tokenScore += 8
    else if ([...titleTokens].some((candidate) => candidate.startsWith(token) && token.length >= 3)) tokenScore += 4
    if (snippetTokens.has(token)) tokenScore += 4
    if (bodyTokens.has(token)) tokenScore += 2
    else if ([...bodyTokens].some((candidate) => candidate.startsWith(token) && token.length >= 3)) tokenScore += 1
    if (tokenScore > 0) {
      matched.push(token)
      score += tokenScore
    }
  }

  return { score, matched }
}

/** Rank the index against a query. Returns at most `limit` results. */
export function searchCourse(query: string, limit = 12): SearchResult[] {
  const trimmed = query.trim()
  if (trimmed.length === 0) return []
  const tokens = tokenize(trimmed)
  if (tokens.length === 0) return []

  const results: SearchResult[] = []
  for (const entry of SEARCH_INDEX) {
    const { score, matched } = scoreEntry(entry, tokens, trimmed)
    if (score > 0) {
      results.push({ ...entry, score, matched })
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // Stable, deterministic tie-break: kind then title.
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
    return a.title.localeCompare(b.title)
  })

  return results.slice(0, limit)
}
