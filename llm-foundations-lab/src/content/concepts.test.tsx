import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AUTO_LINKED_CONCEPTS, findConceptMatches, GLOSSARY_BY_ID } from './concepts'
import { annotateConcepts } from '../components/lesson/annotate'

describe('concept linking', () => {
  describe('the curated list', () => {
    it('points only at terms that exist in the glossary', () => {
      for (const concept of AUTO_LINKED_CONCEPTS) {
        expect(GLOSSARY_BY_ID.has(concept.id), `${concept.id} is not in the glossary`).toBe(true)
      }
    })

    it('never lists the same surface twice', () => {
      const surfaces = AUTO_LINKED_CONCEPTS.map((concept) => concept.surface.toLowerCase())
      expect(new Set(surfaces).size).toBe(surfaces.length)
    })

    it('leaves out the terms that are too common to be worth linking', () => {
      const ids = new Set(AUTO_LINKED_CONCEPTS.map((concept) => concept.id))
      for (const generic of ['token', 'softmax', 'logits', 'prompt', 'reasoning', 'temperature']) {
        expect(ids.has(generic), `${generic} should not be auto-linked`).toBe(false)
      }
    })
  })

  describe('finding mentions', () => {
    it('finds a term on a word boundary', () => {
      const matches = findConceptMatches('the causal mask blocks the future', new Set())
      expect(matches).toHaveLength(1)
      expect(matches[0].id).toBe('causal-mask')
      expect(matches[0].surface).toBe('causal mask')
    })

    it('does not match inside a longer word', () => {
      expect(findConceptMatches('causality is not causality', new Set())).toEqual([])
      expect(findConceptMatches('retokenisation', new Set())).toEqual([])
    })

    it('is case-insensitive', () => {
      const matches = findConceptMatches('A KV CACHE holds the keys', new Set())
      expect(matches).toHaveLength(1)
      expect(matches[0].id).toBe('kv-cache')
    })

    it('prefers the longer of two overlapping surfaces', () => {
      const matches = findConceptMatches('scaled dot-product attention is used', new Set())
      expect(matches).toHaveLength(1)
      expect(matches[0].id).toBe('scaled-dot-product-attention')
    })

    it('links a term only once', () => {
      const linked = new Set<string>()
      expect(findConceptMatches('the KV cache', linked)).toHaveLength(1)
      linked.add('kv-cache')
      expect(findConceptMatches('the KV cache again', linked)).toHaveLength(0)
    })

    it('returns matches in reading order', () => {
      const matches = findConceptMatches('a reward model and a KV cache', new Set())
      expect(matches.map((m) => m.id)).toEqual(['reward-model', 'kv-cache'])
      expect(matches[0].start).toBeLessThan(matches[1].start)
    })
  })

  describe('annotating prose', () => {
    const render = (node: React.ReactNode) => renderToStaticMarkup(<>{annotateConcepts(node, new Set())}</>)

    it('wraps a term in a concept button', () => {
      const html = render(<p>The causal mask is additive.</p>)
      expect(html).toContain('aria-expanded="false"')
      expect(html).toContain('causal mask')
      expect(html).toContain('aria-controls')
    })

    it('leaves code untouched', () => {
      const html = render(
        <p>
          Write <code>causal mask</code> in the code.
        </p>,
      )
      // The code element keeps its plain text; only one concept button appears
      // for the surrounding prose.
      expect((html.match(/aria-controls/g) ?? []).length).toBe(0)
    })

    it('links a term only once across a block', () => {
      const html = render(
        <div>
          <p>The KV cache stores keys and values.</p>
          <p>The KV cache grows with the context.</p>
        </div>,
      )
      expect((html.match(/aria-controls/g) ?? []).length).toBe(1)
    })

    it('keeps the text itself intact', () => {
      const html = render(<p>A causal mask, applied before the softmax.</p>)
      // Strip the tags without inserting a space, so the original wording can be
      // compared exactly.
      const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      expect(text).toBe('A causal mask, applied before the softmax.')
    })
  })
})
