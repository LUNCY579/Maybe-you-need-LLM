import { describe, expect, it } from 'vitest'
import { DEMO_FOR_TERM, demoForTerm, lessonForDemo, routeForDemo } from './demoLinks'
import { normaliseKey } from './glossaryIndex'
import { GLOSSARY } from './glossary'
import { LESSONS } from './lessons'
import { DEMO_IDS } from './demos'
import type { DemoId } from '../types/curriculum'

/**
 * The registry, not a hand-written list.
 *
 * This test used to keep its own list of demonstrations, and the list fell
 * behind the content: a new demonstration was added and the test kept
 * passing because it never looked at it. Reading the registry means a
 * demonstration cannot be added without this test covering it.
 */
const DEMOS = DEMO_IDS

describe('demo links', () => {
  it('places every demonstration in exactly one lesson', () => {
    for (const demo of DEMOS) {
      const slugs = LESSONS.filter((lesson) =>
        [...lesson.sections, ...lesson.advancedSections].some((section) =>
          section.blocks.some((block) => block.kind === 'demo' && block.demo === demo),
        ),
      ).map((lesson) => lesson.slug)
      expect(slugs, `demo ${demo} appears in ${slugs.length} lessons`).toHaveLength(1)
    }
  })

  it('builds a route into the lesson that holds a demonstration', () => {
    for (const demo of DEMOS) {
      const route = routeForDemo(demo)
      expect(route).not.toBeNull()
      expect(route).toContain(`#demo-${demo}`)
      expect(route).toContain(lessonForDemo(demo)!)
    }
  })

  it('resolves a term to the demonstration that exercises it', () => {
    expect(demoForTerm('Tool use')).toBe('tool-selection')
    expect(demoForTerm('Memory architecture')).toBe('memory')
    expect(demoForTerm('Planning')).toBe('planning')
    expect(demoForTerm('Machine behaviour')).toBe('dilemma')
    expect(demoForTerm('Context window')).toBe('context-window')
  })

  it('returns nothing for a term with no demonstration', () => {
    expect(demoForTerm('Agentic LLM')).toBeUndefined()
  })

  it('only names terms that exist in the glossary', () => {
    const names = new Set(GLOSSARY.map((entry) => normaliseKey(entry.term)))
    for (const term of Object.keys(DEMO_FOR_TERM)) {
      expect(names.has(normaliseKey(term)), `"${term}" is mapped to a demo but is not a glossary term`).toBe(true)
    }
  })

  it('covers every demonstration with at least one term', () => {
    // A term can point at a demonstration two ways: through the central map
    // or through its own `demo` field. Both count.
    const covered = new Set([
      ...Object.values(DEMO_FOR_TERM),
      ...GLOSSARY.map((entry) => entry.demo).filter((demo): demo is DemoId => Boolean(demo)),
    ])
    for (const demo of DEMOS) {
      expect(covered.has(demo), `no glossary term points at the ${demo} demonstration`).toBe(true)
    }
  })

  it('anchors every route to an element the lesson actually contains', () => {
    // The route names the element the reader is sent to, so the two have to
    // agree. A route that names an element the lesson does not contain is a
    // link that goes nowhere.
    for (const demo of DEMOS) {
      const route = routeForDemo(demo)!
      const anchor = route.slice(route.indexOf('#demo-') + 1)
      expect(anchor).toBe(`demo-${demo}`)

      const lesson = LESSONS.find((candidate) => candidate.slug === lessonForDemo(demo))!
      const blocks = [...lesson.sections, ...lesson.advancedSections].flatMap((section) => section.blocks)
      const demoIds = blocks.filter((block) => block.kind === 'demo').map((block) => `demo-${block.demo}`)
      expect(demoIds, `${route} names an element the lesson does not contain`).toContain(anchor)
    }
  })
})
