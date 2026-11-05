import { describe, expect, it } from 'vitest'
import { SEARCH_INDEX, searchCourse, tokenize } from './searchIndex'
import { GLOSSARY } from './glossary'
import { LESSONS } from './lessons'

describe('search index', () => {
  it('indexes every lesson, section, glossary term, question, lab and reference', () => {
    const kinds = new Set(SEARCH_INDEX.map((entry) => entry.kind))
    expect(kinds).toContain('lesson')
    expect(kinds).toContain('section')
    expect(kinds).toContain('glossary')
    expect(kinds).toContain('question')
    expect(kinds).toContain('lab')
    expect(kinds).toContain('reference')

    const sectionCount = LESSONS.reduce((sum, lesson) => sum + lesson.sections.length, 0)
    const advancedSectionCount = LESSONS.reduce((sum, lesson) => sum + lesson.advancedSections.length, 0)
    expect(SEARCH_INDEX.filter((entry) => entry.kind === 'section')).toHaveLength(sectionCount + advancedSectionCount)
    expect(SEARCH_INDEX.filter((entry) => entry.kind === 'glossary')).toHaveLength(GLOSSARY.length)
  })

  it('gives every entry a navigable route and a title', () => {
    for (const entry of SEARCH_INDEX) {
      expect(entry.route.startsWith('#/'), `${entry.id} has a malformed route`).toBe(true)
      expect(entry.title.length).toBeGreaterThan(0)
    }
  })

  it('anchors every in-page link to an element that exists', () => {
    // A deep link that names an element the page does not contain is a link
    // that goes nowhere, and the build was green the whole time. The anchor
    // is the element's own id, so it can be checked against the content.
    for (const entry of SEARCH_INDEX) {
      const hashIndex = entry.route.indexOf('#', 1)
      if (hashIndex === -1) continue
      const anchor = entry.route.slice(hashIndex + 1)
      if (!anchor.startsWith('section-') && !anchor.startsWith('demo-')) continue

      const lessonSlug = entry.route.replace('#/lesson/', '').split('#')[0]
      const lesson = LESSONS.find((candidate) => candidate.slug === lessonSlug)
      expect(lesson, `${entry.id} points at a lesson that does not exist`).toBeDefined()

      const blocks = [...lesson!.sections, ...lesson!.advancedSections].flatMap((section) => section.blocks)
      const ids = [
        ...[...lesson!.sections, ...lesson!.advancedSections].map((section) => `section-${section.id}`),
        ...blocks.filter((block) => block.kind === 'demo').map((block) => `demo-${block.demo}`),
      ]
      expect(ids, `${entry.id} anchors to "${anchor}", which the lesson does not contain`).toContain(anchor)
    }
  })

  it('tokenises queries and drops stop words', () => {
    expect(tokenize('What is an agentic harness?')).toEqual(['agentic', 'harness'])
    expect(tokenize('   ')).toEqual([])
    expect(tokenize('MCP and RLVR')).toEqual(['mcp', 'rlvr'])
  })

  it('returns nothing for an empty or stop-word-only query', () => {
    expect(searchCourse('')).toEqual([])
    expect(searchCourse('   ')).toEqual([])
    expect(searchCourse('the and of')).toEqual([])
  })

  it('finds a lesson by its title', () => {
    const target = LESSONS.find((lesson) => lesson.slug === 'foundations-of-language-modeling')
    expect(target).toBeDefined()
    const results = searchCourse(target!.title)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.kind).toBe('lesson')
    expect(results[0]?.title).toBe(target!.title)
  })

  it('finds a glossary term by its exact name', () => {
    const results = searchCourse('Model Context Protocol')
    expect(results.some((result) => result.kind === 'glossary' && result.title.startsWith('Model Context Protocol'))).toBe(true)
  })

  it('ranks a title match above a body match', () => {
    const results = searchCourse('reflection')
    expect(results.length).toBeGreaterThan(1)
    const titleMatch = results.findIndex((result) => result.title.toLowerCase().includes('reflection'))
    const bodyMatch = results.findIndex((result) => !result.title.toLowerCase().includes('reflection'))
    expect(titleMatch).toBeGreaterThanOrEqual(0)
    if (bodyMatch >= 0) expect(titleMatch).toBeLessThan(bodyMatch)
  })

  it('matches lesson body text, not only titles', () => {
    // "Chinchilla" appears in the scaling lesson's body, not in its title.
    const results = searchCourse('Chinchilla')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((result) => result.kind === 'section' || result.kind === 'lesson')).toBe(true)
  })

  it('searches assessment question text', () => {
    const results = searchCourse('chain of thought')
    expect(results.some((result) => result.kind === 'question')).toBe(true)
  })

  it('is deterministic: the same query always returns the same order', () => {
    const first = searchCourse('memory retrieval')
    const second = searchCourse('memory retrieval')
    expect(first.map((entry) => entry.id)).toEqual(second.map((entry) => entry.id))
  })

  it('respects the result limit', () => {
    expect(searchCourse('agent', 5).length).toBeLessThanOrEqual(5)
  })

  it('returns results with a positive score and matched terms', () => {
    const results = searchCourse('tool calling')
    for (const result of results) {
      expect(result.score).toBeGreaterThan(0)
      expect(result.matched.length).toBeGreaterThan(0)
    }
  })

  it('produces no duplicate ids', () => {
    const ids = SEARCH_INDEX.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
