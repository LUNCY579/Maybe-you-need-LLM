import { describe, expect, it } from 'vitest'
import { aliasesFor, findGlossaryMatches, GLOSSARY_BY_ALIAS, isLinkableTerm, normaliseKey } from './glossaryIndex'
import { GLOSSARY } from './glossary'

describe('glossary index', () => {
  it('only relates terms that exist', () => {
    // A relation to a term that is not in the glossary points at nothing, so
    // the concept map silently loses an edge. Names are compared after
    // normalisation, because the book mixes hyphens and en dashes.
    const names = new Set(GLOSSARY.map((entry) => normaliseKey(entry.term)))
    for (const entry of GLOSSARY) {
      for (const related of entry.related) {
        expect(names.has(normaliseKey(related)), `${entry.term} relates to the missing term "${related}"`).toBe(true)
      }
    }
  })

  it('has a definition and a source for every term', () => {
    for (const entry of GLOSSARY) {
      expect(entry.definition.length, `${entry.term} has no definition`).toBeGreaterThan(20)
      expect(entry.lessons.length, `${entry.term} is not attached to a lesson`).toBeGreaterThan(0)
    }
  })

  it('registers an abbreviation and its base phrase', () => {
    const term = GLOSSARY.find((entry) => entry.term.startsWith('Retrieval-augmented generation'))!
    const aliases = aliasesFor(term)
    expect(aliases).toContain('RAG')
    expect(aliases).toContain('Retrieval-augmented generation')
  })

  it('does not treat a qualifier as an abbreviation', () => {
    const term = GLOSSARY.find((entry) => entry.term === 'Environment (in RL)')!
    // "in RL" is a qualifier, so only the full term is registered automatically.
    expect(aliasesFor(term)).toEqual(['Environment (in RL)'])
  })

  it('splits slash-separated alternatives', () => {
    const term = GLOSSARY.find((entry) => entry.term.includes('/'))!
    const aliases = aliasesFor(term)
    expect(aliases.length).toBeGreaterThan(1)
  })

  it('maps every alias to a real term', () => {
    for (const [alias, term] of GLOSSARY_BY_ALIAS) {
      expect(alias).toBe(alias.toLowerCase())
      expect(GLOSSARY.some((entry) => entry.term === term.term)).toBe(true)
    }
  })

  it('finds a term in ordinary prose', () => {
    const matches = findGlossaryMatches('A chain of thought prompt asks for intermediate steps.')
    expect(matches).toHaveLength(1)
    expect(matches[0].term.term).toBe('Chain of thought')
    expect(matches[0].start).toBe(2)
  })

  it('matches a hyphenated spelling', () => {
    const matches = findGlossaryMatches('The chain-of-thought prompt asks for steps.')
    expect(matches).toHaveLength(1)
    expect(matches[0].term.term).toBe('Chain of thought')
  })

  it('matches an abbreviation', () => {
    const matches = findGlossaryMatches('The tool follows an MCP-style contract.')
    expect(matches).toHaveLength(1)
    expect(matches[0].term.term).toContain('Model Context Protocol')
  })

  it('does not match inside a longer word', () => {
    // "reagents" contains "agent" but is not the term.
    const matches = findGlossaryMatches('The reagents were stable.')
    expect(matches).toHaveLength(0)
  })

  it('is case-insensitive', () => {
    expect(findGlossaryMatches('CHAIN OF THOUGHT matters.')).toHaveLength(1)
    expect(findGlossaryMatches('chain of thought matters.')).toHaveLength(1)
  })

  it('prefers the longest match', () => {
    const matches = findGlossaryMatches('The Model Context Protocol (MCP) standardises things.')
    // The full term wins over the bare acronym.
    expect(matches[0].term.term).toBe('Model Context Protocol (MCP)')
  })

  it('returns matches in order and without overlap', () => {
    const matches = findGlossaryMatches('Chain of thought and self-reflection both matter here.')
    expect(matches).toHaveLength(2)
    expect(matches[0].end).toBeLessThanOrEqual(matches[1].start)
  })

  it('finds nothing in text with no terms', () => {
    expect(findGlossaryMatches('A short sentence about nothing in particular.')).toHaveLength(0)
    expect(findGlossaryMatches('')).toHaveLength(0)
  })

  it('rejects terms too short to be meaningful', () => {
    expect(isLinkableTerm({ term: 'RLVR', definition: '', source: null, related: [], lessons: [] })).toBe(true)
    expect(isLinkableTerm({ term: 'IO', definition: '', source: null, related: [], lessons: [] })).toBe(false)
  })
})
