import { describe, expect, it } from 'vitest'
import { fuzzyMatch, matchFields } from './fuzzy'

describe('fuzzy matching', () => {
  describe('when the text does not contain the query', () => {
    it('rejects a query whose characters are not all present', () => {
      expect(fuzzyMatch('KV cache', 'kvx')).toBeNull()
    })

    it('rejects a query whose characters are in the wrong order', () => {
      expect(fuzzyMatch('attention', 'noitn')).toBeNull()
    })

    it('matches an empty query', () => {
      expect(fuzzyMatch('anything', '')).toEqual({ score: 0, indices: [], matched: '' })
    })
  })

  describe('when the text does contain the query', () => {
    it('finds a subsequence', () => {
      const match = fuzzyMatch('KV cache', 'kvc')
      expect(match).not.toBeNull()
      // K at 0, V at 1, and the c of "cache" at 3.
      expect(match?.indices).toEqual([0, 1, 3])
      expect(match?.matched).toBe('KVc')
    })

    it('is case insensitive', () => {
      expect(fuzzyMatch('Attention', 'att')?.indices).toEqual([0, 1, 2])
    })

    it('scores a prefix higher than a match in the middle', () => {
      const prefix = fuzzyMatch('attention', 'att')
      const middle = fuzzyMatch('the attention', 'att')
      expect(prefix?.score).toBeGreaterThan(middle?.score ?? 0)
    })

    it('scores a match at a word boundary higher than one inside a word', () => {
      const boundary = fuzzyMatch('key value', 'kv')
      const inside = fuzzyMatch('tokvener', 'kv')
      expect(boundary?.score).toBeGreaterThan(inside?.score ?? 0)
    })

    it('scores consecutive characters higher than scattered ones', () => {
      const together = fuzzyMatch('cache', 'ca')
      const scattered = fuzzyMatch('cxyzabc', 'ca')
      expect(together?.score).toBeGreaterThan(scattered?.score ?? 0)
    })

    it('scores a shorter text higher than a longer one', () => {
      const short = fuzzyMatch('softmax', 'sm')
      const long = fuzzyMatch('softmax and something much longer', 'sm')
      expect(short?.score).toBeGreaterThan(long?.score ?? 0)
    })

    it('reports the positions it matched', () => {
      const match = fuzzyMatch('dialog', 'dlg')
      // d at 0, the l at 3, and the g at 5.
      expect(match?.indices).toEqual([0, 3, 5])
    })
  })

  describe('matching a set of fields', () => {
    const fields = [
      { text: 'The KV cache', weight: 10 },
      { text: 'A summary line', weight: 5 },
      { text: 'Some body text', weight: 2 },
    ]

    it('returns null when nothing matches', () => {
      expect(matchFields(fields, 'zzz')).toBeNull()
    })

    it('returns null for an empty query', () => {
      expect(matchFields(fields, '   ')).toBeNull()
    })

    it('finds a match in the title', () => {
      const result = matchFields(fields, 'kv')
      expect(result?.field).toBe(0)
      expect(result?.indices).toEqual([4, 5])
    })

    it('falls back to the body when nothing better matches', () => {
      const result = matchFields(fields, 'body')
      expect(result?.field).toBe(2)
    })

    it('requires every word of a multi-word query to match', () => {
      // "light" is a subsequence of "Sinusoidal positional encoding", but
      // "light theme" is not, and a reader who types both words means both.
      const both = matchFields(
        [
          { text: 'Sinusoidal positional encoding', weight: 10 },
          { text: 'Switch to the light theme', weight: 10 },
        ],
        'light theme',
      )
      expect(both?.field).toBe(1)
    })

    it('rejects a query when one of its words is missing', () => {
      expect(
        matchFields([{ text: 'Switch to the light theme', weight: 10 }], 'light darkness'),
      ).toBeNull()
    })

    it('prefers the title over the body', () => {
      const both = matchFields(
        [
          { text: 'attention', weight: 10 },
          { text: 'nothing', weight: 5 },
          { text: 'attention in the body', weight: 2 },
        ],
        'attention',
      )
      expect(both?.field).toBe(0)
    })
  })
})
