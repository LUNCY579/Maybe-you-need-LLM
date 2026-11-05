import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROMPT_PARTS,
  RETRIEVAL_AXES,
  TOY_DOCUMENTS,
  cosineSimilarity,
  dotProduct,
  formatTokens,
  magnitude,
  promptBudget,
  queryVector,
  retrieve,
} from './retrieval'

/**
 * The retrieval laboratory had no direct test coverage. These tests pin down
 * the properties the laboratory UI relies on, in particular that the query
 * vector always has one finite entry per axis — a regression that previously
 * produced NaN similarities and silently returned zero passages.
 */
describe('retrieval laboratory', () => {
  describe('query vector', () => {
    it('has exactly one finite entry per axis for every query', () => {
      const queries = [
        'attention scores and the kv cache',
        'token',
        'tokens',
        'inference',
        'alignment',
        'reasoning',
        'training',
        'completely unrelated words zebra',
        '',
      ]
      for (const query of queries) {
        const vector = queryVector(query)
        expect(vector).toHaveLength(RETRIEVAL_AXES.length)
        expect(vector.every((value) => Number.isFinite(value))).toBe(true)
      }
    })

    it('gives an exact axis match weight 1', () => {
      const vector = queryVector('attention')
      expect(vector[RETRIEVAL_AXES.indexOf('attention')]).toBe(1)
    })

    it('gives a prefix match a lower weight than an exact match', () => {
      const exact = queryVector('attention')
      const prefix = queryVector('attent')
      expect(prefix[RETRIEVAL_AXES.indexOf('attention')]).toBeLessThan(
        exact[RETRIEVAL_AXES.indexOf('attention')],
      )
      expect(prefix[RETRIEVAL_AXES.indexOf('attention')]).toBeGreaterThan(0)
    })

    it('expands to neighbours without ever exceeding the original weight', () => {
      const vector = queryVector('attention')
      for (const value of vector) expect(value).toBeLessThanOrEqual(1)
    })

    it('is deterministic', () => {
      expect(queryVector('attention and inference')).toEqual(
        queryVector('attention and inference'),
      )
    })
  })

  describe('similarity', () => {
    it('computes a dot product over the shared prefix of two vectors', () => {
      expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32)
      expect(dotProduct([1, 2, 3], [4, 5])).toBe(14)
    })

    it('computes a Euclidean magnitude', () => {
      expect(magnitude([3, 4])).toBe(5)
      expect(magnitude([0, 0])).toBe(0)
    })

    it('returns 0 for a zero vector instead of NaN', () => {
      expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0)
    })

    it('returns 1 for identical vectors and -1 for opposite ones', () => {
      expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 12)
      expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1, 12)
    })
  })

  describe('retrieve', () => {
    it('finds passages for the laboratory default query', () => {
      const { results, scores } = retrieve('attention scores and the kv cache')
      expect(results.length).toBeGreaterThan(0)
      expect(scores.every((entry) => Number.isFinite(entry.score))).toBe(true)
    })

    it('returns finite similarities in [-1, 1] for every document', () => {
      const { scores } = retrieve('alignment')
      for (const entry of scores) {
        expect(Number.isFinite(entry.score)).toBe(true)
        expect(entry.score).toBeGreaterThanOrEqual(-1)
        expect(entry.score).toBeLessThanOrEqual(1)
      }
    })

    it('ranks results by non-increasing score with contiguous ranks', () => {
      const { results } = retrieve('attention and inference')
      results.forEach((entry, index) => {
        expect(entry.rank).toBe(index + 1)
        if (index > 0) expect(entry.score).toBeLessThanOrEqual(results[index - 1].score)
      })
    })

    it('never returns more than k documents', () => {
      expect(retrieve('attention', TOY_DOCUMENTS, 2).results.length).toBeLessThanOrEqual(2)
    })

    it('never adds a document when the threshold is raised', () => {
      const low = retrieve('attention', TOY_DOCUMENTS, 10, 0).results.length
      const high = retrieve('attention', TOY_DOCUMENTS, 10, 0.9).results.length
      expect(high).toBeLessThanOrEqual(low)
    })

    it('finds the most relevant document first for an on-topic query', () => {
      const { results } = retrieve('kv cache decoding memory')
      expect(results[0].document.id).toBe('doc-inference')
    })
  })

  describe('prompt budget', () => {
    it('sums the token count of every part', () => {
      const budget = promptBudget(DEFAULT_PROMPT_PARTS, 1000)
      const sum = budget.parts.reduce((total, part) => total + part.tokens, 0)
      expect(budget.totalTokens).toBe(sum)
    })

    it('reports utilisation as the fraction of the context window used', () => {
      const budget = promptBudget(DEFAULT_PROMPT_PARTS, 1000)
      expect(budget.utilisation).toBeCloseTo(budget.totalTokens / 1000, 12)
    })

    it('detects overflow and reports the excess', () => {
      const budget = promptBudget(DEFAULT_PROMPT_PARTS, 10)
      expect(budget.overflows).toBe(true)
      expect(budget.overflowTokens).toBe(budget.totalTokens - 10)
    })

    it('does not overflow when the prompt fits', () => {
      const budget = promptBudget(DEFAULT_PROMPT_PARTS, 100000)
      expect(budget.overflows).toBe(false)
      expect(budget.overflowTokens).toBe(0)
    })

    it('counts only droppable parts in the droppable token total', () => {
      const budget = promptBudget(DEFAULT_PROMPT_PARTS, 1000)
      const droppable = budget.parts.filter((part) => part.droppable).reduce((s, p) => s + p.tokens, 0)
      expect(budget.droppableTokens).toBe(droppable)
    })

    it('handles a zero-sized context window without producing NaN', () => {
      const budget = promptBudget(DEFAULT_PROMPT_PARTS, 0)
      expect(Number.isNaN(budget.utilisation)).toBe(false)
      expect(budget.overflows).toBe(true)
    })
  })

  describe('formatTokens', () => {
    it('abbreviates thousands and leaves small numbers alone', () => {
      expect(formatTokens(999)).toBe('999')
      expect(formatTokens(1500)).toBe('1.5k')
    })
  })
})
