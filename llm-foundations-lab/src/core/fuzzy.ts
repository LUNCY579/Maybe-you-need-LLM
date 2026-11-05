/**
 * Fuzzy matching for the command palette.
 *
 * A command palette is typed into, and people type the beginnings of words
 * they half remember: "kv" for "KV cache", "attn" for "attention", "dlg"
 * for "dialog". A search that only matches whole words misses all of those.
 *
 * The matcher therefore looks for the query as a *subsequence* of the text —
 * every character of the query appears in the text, in order, not necessarily
 * next to each other — and scores how good a match it is.
 *
 * The scores are not arbitrary. They encode the things a reader would say
 * make one match better than another:
 *
 * - A match at the very start of the text is much better than one buried in
 *   the middle of it.
 * - A match that runs across a word boundary is better than one that starts
 *   in the middle of a word, because it is more likely to be what was meant.
 * - Characters that follow each other with nothing in between are better
 *   than characters that are scattered, because "cach" is a more deliberate
 *   way to write "cache" than "c..a..c..h".
 * - A shorter text that matches is better than a long one, because the
 *   shorter one is more likely to be the thing that was meant.
 */

/** The result of matching a query against a piece of text. */
export interface FuzzyMatch {
  /** Higher is better. Zero means the text does not match at all. */
  score: number
  /** The positions in the text that the query matched, in order. */
  indices: number[]
  /** The matched characters, as they appear in the text. */
  matched: string
}

/** Is this the start of a word? */
function isBoundary(text: string, index: number): boolean {
  if (index === 0) return true
  const previous = text[index - 1]
  return previous === ' ' || previous === '-' || previous === '_' || previous === '.' || previous === '/' || previous === ':'
}

/**
 * Match a query against a piece of text.
 *
 * Returns null when the text does not contain the query as a subsequence.
 */
export function fuzzyMatch(text: string, query: string): FuzzyMatch | null {
  if (query.length === 0) return { score: 0, indices: [], matched: '' }
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  const indices: number[] = []
  let score = 0
  let textIndex = 0

  for (let queryIndex = 0; queryIndex < lowerQuery.length; queryIndex++) {
    const character = lowerQuery[queryIndex]
    const found = lowerText.indexOf(character, textIndex)
    if (found === -1) return null

    if (found === 0) {
      // The query starts at the beginning of the text.
      score += 12
    } else if (isBoundary(text, found)) {
      // The query starts a word.
      score += 8
    } else {
      // The query starts in the middle of a word.
      score += 3
    }

    if (found === textIndex && indices.length > 0) {
      // This character follows the last one with nothing in between.
      score += 6
    } else if (indices.length > 0) {
      // There is a gap. The wider the gap, the less it is worth.
      score -= Math.min(4, found - textIndex - 1)
    }

    indices.push(found)
    textIndex = found + 1
  }

  // A shorter text that contains the same query is the better answer.
  score += Math.max(0, 6 - Math.floor(text.length / 12))

  return { score, indices, matched: indices.map((index) => text[index]).join('') }
}

/**
 * Score a query against a set of fields, in order of importance.
 *
 * The first field that matches decides the *kind* of match, so a query that
 * appears in the title always beats one that appears only in the body, and
 * the body is only consulted when the better fields do not match at all.
 *
 * A query of several words has to match *all* of them. Matching a single
 * word of a two-word query would put "Sinusoidal positional encoding" in
 * front of "Switch to the light theme" for the query "light theme", because
 * the letters of "light" happen to appear in order inside the first of
 * those. A reader who types two words means both of them.
 */
export function matchFields(
  fields: { text: string; weight: number }[],
  query: string,
): { score: number; field: number; indices: number[] } | null {
  const words = query.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null

  let best: { score: number; field: number; indices: number[] } | null = null

  for (let index = 0; index < fields.length; index++) {
    const field = fields[index]
    let total = 0
    const indices: number[] = []
    let matched = true

    for (const word of words) {
      const match = fuzzyMatch(field.text, word)
      if (!match) {
        matched = false
        break
      }
      total += match.score
      indices.push(...match.indices)
    }
    if (!matched) continue

    // Every word of the query matched, which is worth a little on its own.
    const score = (total + words.length * 4) * field.weight
    if (!best || score > best.score) {
      best = { score, field: index, indices: indices.sort((a, b) => a - b) }
    }
    // A match in a field that is worth more than the one below it wins
    // outright: the body text is only for when nothing else matched.
    if (best && field.weight >= 10) break
  }

  return best
}
