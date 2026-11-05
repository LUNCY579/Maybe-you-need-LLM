import { describe, expect, it } from 'vitest'
import { matmul, softmax } from './math'
import { attention, causalMask, causalMaskFor } from './attention'
import { buildToyParameters, DEFAULT_TOY_CONFIG } from './embeddings'
import { multiHeadTrace, outputLogitBreakdown, runExplorer } from './transformer'
import { TOY_VOCAB, ID_BY_SURFACE, tokenize, vocabSize } from './tokenizer'
import { evaluate, initModel, buildVocab, trainStep, encodeCorpus, TRAIN_CORPUS } from './training'
import { queryVector, retrieve } from './retrieval'

/**
 * Regression tests.
 *
 * Every test here corresponds to a defect that was found by an independent
 * audit of the core modules and that a learner would have been able to hit:
 * a crash, a NaN, a silently wrong number, or a documented value that did not
 * match the code. They are kept separately from the behavioural suites so the
 * history stays legible.
 */
describe('regressions', () => {
  describe('retrieval: a neighbour index outside the axis range poisoned every score', () => {
    it('keeps the query vector finite for every axis', () => {
      // "inference" used to expand into axis 6, which does not exist. The write
      // produced NaN, every cosine similarity became NaN, and the retriever
      // returned no passages at all.
      for (const query of ['inference', 'attention', 'tokens', 'kv cache', 'reasoning']) {
        const vector = queryVector(query)
        expect(vector).toHaveLength(6)
        expect(vector.every((value) => Number.isFinite(value))).toBe(true)
      }
    })

    it('still retrieves passages for a query that names an axis', () => {
      const { results, scores } = retrieve('inference')
      expect(results.length).toBeGreaterThan(0)
      expect(scores.every((entry) => Number.isFinite(entry.score))).toBe(true)
    })

    it('expands a query term onto a related axis', () => {
      const vector = queryVector('kv cache')
      expect(vector[4]).toBeGreaterThan(0)
    })
  })

  describe('math: multiplying an empty matrix did not report a usable shape', () => {
    it('returns an empty product instead of throwing', () => {
      expect(() => matmul([], [[1, 2], [3, 4]])).not.toThrow()
      expect(matmul([], [[1, 2], [3, 4]])).toEqual([])
    })

    it('still rejects genuinely incompatible shapes', () => {
      expect(() => matmul([[1, 2]], [[1, 2]])).toThrow(/incompatible shapes/)
    })
  })

  describe('transformer: an empty sentence crashed the explorer', () => {
    it('runs without throwing on empty and whitespace-only input', () => {
      for (const text of ['', ' ', '   ', '\n\t']) {
        expect(() => runExplorer(text, { mode: 'word' })).not.toThrow()
        const result = runExplorer(text, { mode: 'word' })
        expect(result.isEmpty).toBe(true)
        expect(result.steps).toHaveLength(0)
      }
    })

    it('produces a normalised distribution for a real sentence', () => {
      const result = runExplorer('the model learns from text', { mode: 'word' })
      expect(result.isEmpty).toBe(false)
      const total = result.probabilities.reduce((sum, p) => sum + p, 0)
      expect(total).toBeCloseTo(1, 12)
      expect(result.logits).toHaveLength(TOY_VOCAB.length)
    })
  })

  describe('transformer: the unembedding matrix was built and then discarded', () => {
    it('projects the representation with the model’s own unembedding', () => {
      const params = buildToyParameters(TOY_VOCAB.length, DEFAULT_TOY_CONFIG)
      const representation = new Array(DEFAULT_TOY_CONFIG.dim).fill(0.3)
      const breakdown = outputLogitBreakdown(representation, params)
      // logits = representation · Wo + prior, and the prior is reported apart.
      for (let v = 0; v < TOY_VOCAB.length; v++) {
        let expectedContext = 0
        for (let k = 0; k < DEFAULT_TOY_CONFIG.dim; k++) {
          expectedContext += representation[k] * params.Wo[k][v]
        }
        expect(breakdown.contextLogits[v]).toBeCloseTo(expectedContext, 12)
        expect(breakdown.logits[v]).toBeCloseTo(expectedContext + breakdown.prior[v], 12)
      }
    })

    it('changes the distribution when the context changes', () => {
      const params = buildToyParameters(TOY_VOCAB.length, DEFAULT_TOY_CONFIG)
      const a = outputLogitBreakdown([0.4, 0, 0, 0, 0, 0, 0, 0], params).logits
      const b = outputLogitBreakdown([0, 0, 0, 0, 0, 0, 0, 0.4], params).logits
      expect(a).not.toEqual(b)
    })
  })

  describe('transformer: multi-head attention dropped coordinates', () => {
    it('restores the full width for any number of heads', () => {
      const params = buildToyParameters(TOY_VOCAB.length, DEFAULT_TOY_CONFIG)
      const H = [
        [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1],
      ]
      for (let heads = 1; heads <= 8; heads++) {
        const { merged, headWidths } = multiHeadTrace(H, params, heads)
        expect(merged[0]).toHaveLength(H[0].length)
        expect(merged[1]).toHaveLength(H[0].length)
        expect(headWidths.reduce((sum, w) => sum + w, 0)).toBe(H[0].length)
      }
    })
  })

  describe('tokenizer: the vocabulary contained duplicate surfaces', () => {
    it('has exactly one id per surface', () => {
      expect(vocabSize()).toBe(new Set(TOY_VOCAB).size)
      expect(ID_BY_SURFACE.size).toBe(vocabSize())
    })

    it('round-trips every vocabulary entry through its id', () => {
      for (const surface of TOY_VOCAB) {
        const id = ID_BY_SURFACE.get(surface)
        expect(id).toBeDefined()
        expect(TOY_VOCAB[id as number]).toBe(surface)
      }
    })
  })

  describe('tokenizer: the subword piece limit made long pieces unreachable', () => {
    it('can produce a long vocabulary entry as a single piece', () => {
      const result = tokenize('embeddings', { mode: 'subword' })
      expect(result.tokens.map((token) => token.text)).toEqual(['embeddings'])
    })

    it('still respects an explicitly requested shorter limit', () => {
      const result = tokenize('embeddings', { mode: 'subword', maxPieceLength: 5 })
      expect(result.tokens.length).toBeGreaterThan(1)
      for (const token of result.tokens) expect(token.text.length).toBeLessThanOrEqual(5)
    })

    it('reproduces the input when the pieces are joined again', () => {
      for (const text of ['the model learns from text', 'tokenizer', 'embeddings', 'a large model']) {
        const result = tokenize(text, { mode: 'subword' })
        const joined = result.tokens.map((token) => token.text).join('')
        expect(joined).toBe(text.replace(/\s+/g, ''))
      }
    })
  })

  describe('training: the reported step loss did not match the evaluated loss', () => {
    it('equals evaluate() on the same batch', () => {
      const vocab = buildVocab(TRAIN_CORPUS)
      const pairs = encodeCorpus(TRAIN_CORPUS, vocab)
      for (const l2 of [0, 0.6, 3]) {
        const model = initModel(vocab, 7)
        const before = evaluate(model, pairs, l2)
        const result = trainStep(model, pairs, 0.1, l2)
        expect(result.loss).toBeCloseTo(before, 12)
      }
    })
  })

  describe('attention: the mask assumed a square score matrix', () => {
    it('builds a mask with the right number of masked entries', () => {
      const mask = causalMask(4)
      const masked = mask.flat().filter((value) => value === -Infinity).length
      const zeros = mask.flat().filter((value) => value === 0).length
      expect(masked).toBe((4 * 3) / 2)
      expect(zeros).toBe((4 * 5) / 2)
    })

    it('lets a single cached query attend to every cached key', () => {
      const mask = causalMaskFor(1, 4)
      expect(mask).toHaveLength(1)
      expect(mask[0].every((value) => value === 0)).toBe(true)
    })

    it('keeps a new query from seeing keys that come after it', () => {
      const mask = causalMaskFor(2, 4)
      // Query row 0 is absolute position 2, so key 3 is in the future.
      expect(mask[0][3]).toBe(-Infinity)
      expect(mask[1][3]).toBe(0)
    })

    it('produces row-stochastic weights with a cached single query', () => {
      const Q = [[1, 0]]
      const K = [[1, 0], [0, 1], [0.5, 0.5]]
      const V = [[1], [2], [3]]
      const trace = attention(Q, K, V, { masked: true })
      expect(trace.weights[0]).toHaveLength(3)
      expect(trace.weights[0].reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 12)
    })
  })

  describe('math: softmax is stable for extreme logits', () => {
    it('does not overflow', () => {
      const probs = softmax([1000, -1000])
      expect(probs[0]).toBeCloseTo(1, 12)
      expect(probs[1]).toBe(0)
      expect(probs.every((p) => Number.isFinite(p))).toBe(true)
    })
  })
})
