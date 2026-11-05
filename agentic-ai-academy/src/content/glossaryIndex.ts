import { GLOSSARY } from './glossary'
import type { GlossaryTerm } from '../types/curriculum'

/**
 * The spellings that should link to a term.
 *
 * A term written as "Retrieval-augmented generation (RAG)" is never spelled
 * that way in the prose — the text says "RAG" or "retrieval-augmented
 * generation" — so the abbreviation and the bare phrase are both registered.
 * The same applies to "Superposition / polysemanticity".
 *
 * An explicit `aliases` list on the term replaces the derived set.
 */
export function aliasesFor(term: GlossaryTerm): string[] {
  if (term.aliases) return term.aliases

  const variants = new Set<string>()
  for (const part of term.term.split(/\s*\/\s*/)) {
    const trimmed = part.trim()
    if (!trimmed) continue
    variants.add(trimmed)

    // "Retrieval-augmented generation (RAG)" -> also register the bare phrase
    // and the acronym, but only when the parenthetical really is an acronym.
    // "Environment (in RL)" is a qualifier, not an abbreviation, so its base
    // is not registered automatically.
    const parenthetical = /^(.*?)\s*\(([^()]{1,12})\)$/.exec(trimmed)
    if (parenthetical) {
      const [, base, inner] = parenthetical
      if (/^[A-Z][A-Za-z0-9-]*$/.test(inner) && inner.length >= 2) {
        if (base) variants.add(base.trim())
        variants.add(inner)
      }
    }
  }
  return [...variants]
}

/**
 * Index of glossary terms, used to link them inline in the lesson prose.
 *
 * A student reading "chain of thought" in a lesson should not have to leave
 * the page to find the definition. The index lets the lesson reader turn a
 * term into a link that reveals its definition in place.
 *
 * Matching is on whole words, case-insensitively, and longer terms are tried
 * first so that "Chain of Thought" wins over a shorter term that happens to be
 * a prefix of it.
 */
export const GLOSSARY_BY_TERM: Map<string, GlossaryTerm> = new Map(
  GLOSSARY.map((entry) => [entry.term.toLowerCase(), entry]),
)

/**
 * Normalise a spelling for lookup.
 *
 * The prose writes "chain-of-thought" as often as "chain of thought", and the
 * book itself is inconsistent about hyphens and dashes — "Planner–Caller–
 * Summarizer" with en dashes, "Planner-Caller-Summarizer" with hyphens. All
 * dash-like characters are folded to a single space so that both find the
 * same term.
 */
export function normaliseKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-\s‐-―−]+/g, ' ')
    .trim()
}

/** Every spelling that should link, mapped to the term it belongs to. */
export const GLOSSARY_BY_ALIAS: Map<string, GlossaryTerm> = new Map()
for (const entry of GLOSSARY) {
  for (const alias of aliasesFor(entry)) {
    const key = normaliseKey(alias)
    if (key.length < 3) continue
    // The first term to claim an alias wins, so the list order in
    // `content/glossary.ts` is the tie-break.
    if (!GLOSSARY_BY_ALIAS.has(key)) GLOSSARY_BY_ALIAS.set(key, entry)
  }
}

/** Spellings sorted longest-first, so the alternation prefers the longest match. */
const ALIASES_BY_LENGTH: string[] = [...GLOSSARY_BY_ALIAS.keys()].sort((a, b) => b.length - a.length)

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * One regex for every term.
 *
 * The look-around guards keep a term from matching inside a longer word, so
 * "agent" does not match "agents"'s inner letters in "reagents".
 *
 * Internal spaces in a term also match hyphens, because the prose writes
 * "chain-of-thought" as often as "chain of thought".
 */
const TERM_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${ALIASES_BY_LENGTH.map((term) => escapeRegExp(term).replace(/\\?\s+/g, '[\\s-]+')).join('|')})(?![\\p{L}\\p{N}])`,
  'giu',
)

export interface GlossaryMatch {
  term: GlossaryTerm
  start: number
  end: number
}

/**
 * Find the glossary terms mentioned in a piece of text.
 *
 * The matches are returned in order and do not overlap.
 */
export function findGlossaryMatches(text: string): GlossaryMatch[] {
  if (!text) return []
  const matches: GlossaryMatch[] = []
  TERM_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TERM_PATTERN.exec(text)) !== null) {
    const entry = GLOSSARY_BY_ALIAS.get(normaliseKey(match[0]))
    if (!entry) continue
    matches.push({ term: entry, start: match.index, end: match.index + match[0].length })
  }
  return matches
}

/**
 * Whether a term is worth linking automatically.
 *
 * The glossary is already a curated list of terms worth defining, so the bar
 * is low; only a term too short to be meaningful is skipped.
 */
export function isLinkableTerm(term: GlossaryTerm): boolean {
  return term.term.length >= 3
}
