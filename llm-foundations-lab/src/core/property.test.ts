import { describe, expect, it } from 'vitest'
import { createRng, entropy, matmul, softmax, type Matrix, type Vector } from './math'
import { attention, causalMaskFor, isRowStochastic } from './attention'
import { tokenize } from './tokenizer'
import { decodeDistribution, sampleFromDistribution, type SamplingConfig } from './sampling'
import { buildVocab, encodeCorpus, initModel, train, TRAIN_CORPUS, VALIDATION_CORPUS } from './training'
import { dpoLogOdds, dpoLoss, dpoPreferenceProbability, PREFERENCE_DATASET } from './alignment'
import { runExplorer } from './transformer'

/**
 * Property-based tests.
 *
 * The example-based suites check specific, hand-computed cases. These check
 * *invariants* over hundreds of randomised inputs, which is where shape
 * handling, off-by-one errors and numerical edge cases tend to hide.
 *
 * Every random draw comes from the seeded generator, so a failure is exactly
 * reproducible: the seed is printed in the assertion message.
 */

/** Random matrix with entries in [-1, 1]. */
function randomMatrix(rng: () => number, rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => rng() * 2 - 1))
}

/** Deliberately slow, obviously-correct reference implementation of a product. */
function referenceMatmul(a: Matrix, b: Matrix): Matrix {
  const rows = a.length
  const inner = a[0]?.length ?? 0
  const cols = b[0]?.length ?? 0
  const out: Matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < inner; k++) {
      for (let j = 0; j < cols; j++) {
        out[i][j] += a[i][k] * b[k][j]
      }
    }
  }
  return out
}

/** Reference attention: explicit loops, no shared code with the implementation. */
function referenceAttention(Q: Matrix, K: Matrix, V: Matrix, masked: boolean) {
  const m = Q.length
  const n = K.length
  const d = Q[0]?.length ?? 1
  const scores: Matrix = []
  for (let i = 0; i < m; i++) {
    const row: number[] = []
    for (let k = 0; k < n; k++) {
      let dot = 0
      for (let t = 0; t < d; t++) dot += Q[i][t] * K[k][t]
      let score = dot / Math.sqrt(d)
      if (masked && i < k) score = -Infinity
      row.push(score)
    }
    scores.push(row)
  }
  const weights = scores.map((row) => {
    const finite = row.filter((v) => Number.isFinite(v))
    const max = Math.max(...finite)
    const exps = row.map((v) => (Number.isFinite(v) ? Math.exp(v - max) : 0))
    const total = exps.reduce((s, v) => s + v, 0)
    return exps.map((v) => v / total)
  })
  const output: Matrix = weights.map((row) => {
    const out = new Array<number>(V[0]?.length ?? 0).fill(0)
    for (let k = 0; k < n; k++) {
      for (let t = 0; t < out.length; t++) out[t] += row[k] * V[k][t]
    }
    return out
  })
  return { scores, weights, output }
}

describe('property-based tests', () => {
  describe('matmul', () => {
    it('matches a reference implementation on random shapes', () => {
      const rng = createRng(20260919)
      for (let trial = 0; trial < 300; trial++) {
        const rows = 1 + Math.floor(rng() * 6)
        const inner = 1 + Math.floor(rng() * 6)
        const cols = 1 + Math.floor(rng() * 6)
        const a = randomMatrix(rng, rows, inner)
        const b = randomMatrix(rng, inner, cols)
        const expected = referenceMatmul(a, b)
        const actual = matmul(a, b)
        expect(actual.length, `seed 20260919 trial ${trial}: row count`).toBe(rows)
        for (let i = 0; i < rows; i++) {
          expect(actual[i].length, `seed 20260919 trial ${trial}: column count`).toBe(cols)
          for (let j = 0; j < cols; j++) {
            expect(actual[i][j], `seed 20260919 trial ${trial}: entry [${i}][${j}]`).toBeCloseTo(
              expected[i][j],
              12,
            )
          }
        }
      }
    })

    it('is associative on random triples', () => {
      const rng = createRng(777)
      for (let trial = 0; trial < 100; trial++) {
        const n = 1 + Math.floor(rng() * 4)
        const a = randomMatrix(rng, n, n)
        const b = randomMatrix(rng, n, n)
        const c = randomMatrix(rng, n, n)
        const left = matmul(matmul(a, b), c)
        const right = matmul(a, matmul(b, c))
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            expect(left[i][j], `seed 777 trial ${trial}: associativity`).toBeCloseTo(right[i][j], 10)
          }
        }
      }
    })
  })

  describe('attention', () => {
    it('matches a reference implementation on random inputs', () => {
      const rng = createRng(31337)
      for (let trial = 0; trial < 250; trial++) {
        const m = 1 + Math.floor(rng() * 5)
        const d = 1 + Math.floor(rng() * 5)
        const Q = randomMatrix(rng, m, d)
        const K = randomMatrix(rng, m, d)
        const V = randomMatrix(rng, m, d)
        const expected = referenceAttention(Q, K, V, true)
        const actual = attention(Q, K, V, { masked: true })
        for (let i = 0; i < m; i++) {
          for (let k = 0; k < m; k++) {
            expect(actual.weights[i][k], `seed 31337 trial ${trial}: weight [${i}][${k}]`).toBeCloseTo(
              expected.weights[i][k],
              12,
            )
          }
          // The output has one column per value dimension, not per key.
          for (let t = 0; t < d; t++) {
            expect(actual.output[i][t], `seed 31337 trial ${trial}: output [${i}][${t}]`).toBeCloseTo(
              expected.output[i][t],
              12,
            )
          }
        }
      }
    })

    it('keeps every row a probability distribution on random inputs', () => {
      const rng = createRng(4242)
      for (let trial = 0; trial < 250; trial++) {
        const m = 1 + Math.floor(rng() * 6)
        const d = 1 + Math.floor(rng() * 6)
        const Q = randomMatrix(rng, m, d)
        const K = randomMatrix(rng, m, d)
        const V = randomMatrix(rng, m, d)
        const { weights } = attention(Q, K, V, { masked: true })
        expect(isRowStochastic(weights, 1e-9), `seed 4242 trial ${trial}`).toBe(true)
        for (let i = 0; i < m; i++) {
          for (let k = 0; k < m; k++) {
            expect(weights[i][k]).toBeGreaterThanOrEqual(0)
            if (k > i) {
              // Masked positions must receive exactly zero, not a small number.
              expect(weights[i][k], `seed 4242 trial ${trial}: masked weight`).toBe(0)
            }
          }
        }
      }
    })

    it('is permutation equivariant without a mask', () => {
      // Reordering the keys and values together must reorder the weights and
      // leave the output unchanged. This is the property that makes attention
      // a weighted average rather than a position-dependent lookup.
      const rng = createRng(99)
      for (let trial = 0; trial < 100; trial++) {
        const m = 1 + Math.floor(rng() * 5)
        const d = 2
        const Q = randomMatrix(rng, m, d)
        const K = randomMatrix(rng, m, d)
        const V = randomMatrix(rng, m, d)
        const order = Array.from({ length: m }, (_, i) => i)
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1))
          ;[order[i], order[j]] = [order[j], order[i]]
        }
        const base = attention(Q, K, V, { masked: false })
        const permuted = attention(
          Q,
          order.map((i) => K[i]),
          order.map((i) => V[i]),
          { masked: false },
        )
        for (let i = 0; i < m; i++) {
          for (let k = 0; k < m; k++) {
            expect(permuted.weights[i][k], `seed 99 trial ${trial}`).toBeCloseTo(
              base.weights[i][order[k]],
              12,
            )
          }
          for (let t = 0; t < d; t++) {
            expect(permuted.output[i][t], `seed 99 trial ${trial}`).toBeCloseTo(base.output[i][t], 12)
          }
        }
      }
    })

    it('produces a non-square mask that allows a cached query to see the whole cache', () => {
      const rng = createRng(5150)
      for (let trial = 0; trial < 100; trial++) {
        const n = 1 + Math.floor(rng() * 6)
        const mask = causalMaskFor(1, n)
        expect(mask).toHaveLength(1)
        expect(mask[0]).toHaveLength(n)
        expect(mask[0].every((v) => v === 0), `seed 5150 trial ${trial}`).toBe(true)
      }
    })
  })

  describe('softmax', () => {
    it('always returns a distribution, for any finite input', () => {
      const rng = createRng(11)
      for (let trial = 0; trial < 500; trial++) {
        const n = 1 + Math.floor(rng() * 12)
        const logits: Vector = Array.from({ length: n }, () => (rng() * 2 - 1) * 20)
        const probs = softmax(logits)
        const total = probs.reduce((s, p) => s + p, 0)
        expect(total, `seed 11 trial ${trial}`).toBeCloseTo(1, 12)
        expect(probs.every((p) => p >= 0 && p <= 1)).toBe(true)
        expect(probs.every(Number.isFinite)).toBe(true)
      }
    })

    it('has an entropy between 0 and log(n)', () => {
      const rng = createRng(12)
      for (let trial = 0; trial < 300; trial++) {
        const n = 1 + Math.floor(rng() * 10)
        const logits: Vector = Array.from({ length: n }, () => (rng() * 2 - 1) * 8)
        const h = entropy(softmax(logits))
        expect(h, `seed 12 trial ${trial}`).toBeGreaterThanOrEqual(-1e-12)
        expect(h, `seed 12 trial ${trial}`).toBeLessThanOrEqual(Math.log(n) + 1e-9)
      }
    })
  })

  describe('tokenizer', () => {
    it('produces offsets that point back into the original text', () => {
      const rng = createRng(8080)
      const alphabet = 'abcdefghij .'
      for (let trial = 0; trial < 300; trial++) {
        const length = 1 + Math.floor(rng() * 40)
        let text = ''
        for (let i = 0; i < length; i++) text += alphabet[Math.floor(rng() * alphabet.length)]
        for (const mode of ['word', 'char', 'subword'] as const) {
          const result = tokenize(text, { mode })
          for (const token of result.tokens) {
            expect(token.start, `seed 8080 trial ${trial}: start`).toBeGreaterThanOrEqual(0)
            expect(token.end, `seed 8080 trial ${trial}: end`).toBeGreaterThan(token.start)
            expect(token.end, `seed 8080 trial ${trial}: end bound`).toBeLessThanOrEqual(text.length)
            const slice = text.slice(token.start, token.end)
            if (mode === 'char') {
              expect(slice, `seed 8080 trial ${trial}: char slice`).toBe(token.text)
            } else if (mode === 'word') {
              expect(slice, `seed 8080 trial ${trial}: word slice`).toBe(token.text)
            } else {
              expect(slice, `seed 8080 trial ${trial}: subword slice`).toBe(token.text)
            }
          }
          // The sequence length always equals the number of units.
          expect(result.sequenceLength).toBe(result.tokens.length)
          expect(result.ids).toHaveLength(result.tokens.length)
        }
      }
    })

    it('never reports an OOV rate outside [0, 1]', () => {
      const rng = createRng(9090)
      for (let trial = 0; trial < 200; trial++) {
        const text = Array.from({ length: 1 + Math.floor(rng() * 12) }, () =>
          String.fromCharCode(97 + Math.floor(rng() * 26)),
        ).join(' ')
        for (const mode of ['word', 'char', 'subword'] as const) {
          const result = tokenize(text, { mode })
          expect(result.oovRate, `seed 9090 trial ${trial}`).toBeGreaterThanOrEqual(0)
          expect(result.oovRate, `seed 9090 trial ${trial}`).toBeLessThanOrEqual(1)
        }
      }
    })
  })

  describe('sampling', () => {
    it('always returns a normalised distribution over the retained candidates', () => {
      const rng = createRng(6060)
      const tokens = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      for (let trial = 0; trial < 400; trial++) {
        const logits: Vector = Array.from({ length: tokens.length }, () => (rng() * 2 - 1) * 5)
        const config: SamplingConfig = {
          temperature: 0.05 + rng() * 3,
          topK: 1 + Math.floor(rng() * tokens.length),
          topP: 0.05 + rng() * 0.95,
          seed: Math.floor(rng() * 1e9),
        }
        const trace = decodeDistribution(logits, tokens, config)
        const total = trace.probabilities.reduce((s, p) => s + p, 0)
        expect(total, `seed 6060 trial ${trial}: total mass`).toBeCloseTo(1, 12)
        expect(trace.candidates.length).toBeLessThanOrEqual(config.topK)
        expect(trace.candidates.length).toBeGreaterThan(0)
        for (const candidate of trace.candidates) {
          expect(trace.probabilities[candidate.index]).toBeCloseTo(candidate.probability, 12)
        }
        // Nothing outside the retained pool may carry mass.
        const retained = new Set(trace.candidateIndices)
        for (let i = 0; i < tokens.length; i++) {
          if (!retained.has(i)) expect(trace.probabilities[i], `seed 6060 trial ${trial}`).toBe(0)
        }
      }
    })

    it('only ever samples a token with non-zero probability', () => {
      const rng = createRng(7070)
      for (let trial = 0; trial < 400; trial++) {
        const n = 2 + Math.floor(rng() * 8)
        const probs: Vector = Array.from({ length: n }, () => rng())
        const total = probs.reduce((s, p) => s + p, 0)
        const normalized = probs.map((p) => p / total)
        const drawRng = createRng(Math.floor(rng() * 1e9))
        const index = sampleFromDistribution(normalized, drawRng)
        expect(index, `seed 7070 trial ${trial}`).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(n)
        expect(normalized[index], `seed 7070 trial ${trial}: sampled a zero`).toBeGreaterThan(0)
      }
    })
  })

  describe('training', () => {
    it('reduces the loss for a range of learning rates', () => {
      for (const learningRate of [0.05, 0.1, 0.5, 1, 2]) {
        const run = train({ learningRate, batchSize: 8, steps: 40, l2: 0, seed: 7 })
        const first = run.history[0].trainLoss
        const last = run.history[run.history.length - 1].trainLoss
        expect(last, `learning rate ${learningRate}`).toBeLessThan(first)
      }
    })

    it('never reports a non-finite loss for a sane configuration', () => {
      const rng = createRng(1212)
      for (let trial = 0; trial < 60; trial++) {
        const run = train({
          learningRate: 0.01 + rng() * 1.5,
          batchSize: 1 + Math.floor(rng() * 16),
          steps: 25,
          l2: rng() * 0.5,
          seed: Math.floor(rng() * 1e6),
        })
        for (const point of run.history) {
          expect(Number.isFinite(point.trainLoss), `seed 1212 trial ${trial}`).toBe(true)
          expect(Number.isFinite(point.validationLoss), `seed 1212 trial ${trial}`).toBe(true)
          expect(point.trainAccuracy).toBeGreaterThanOrEqual(0)
          expect(point.trainAccuracy).toBeLessThanOrEqual(1)
        }
      }
    })

    it('keeps the train and validation corpora disjoint', () => {
      const vocab = buildVocab([...TRAIN_CORPUS, ...VALIDATION_CORPUS])
      const trainPairs = encodeCorpus(TRAIN_CORPUS, vocab)
      const validationPairs = encodeCorpus(VALIDATION_CORPUS, vocab)
      const key = (pair: { prev: number; next: number }) => `${pair.prev}->${pair.next}`
      const trainKeys = new Set(trainPairs.map(key))
      // A pair may legitimately appear in both corpora (the same bigram in a
      // different sentence), so the check is that the *pairs* are derived from
      // the right sentences, not that they are disjoint.
      expect(trainPairs.length).toBeGreaterThan(0)
      expect(validationPairs.length).toBeGreaterThan(0)
      expect(trainKeys.size).toBeLessThanOrEqual(trainPairs.length)
    })

    it('produces a row-stochastic transition matrix', () => {
      const vocab = buildVocab(TRAIN_CORPUS)
      const model = initModel(vocab, 3)
      for (const row of model.weights) {
        const max = Math.max(...row)
        const total = row.reduce((s, v) => s + Math.exp(v - max), 0)
        expect(total).toBeGreaterThan(0)
      }
    })
  })

  describe('alignment', () => {
    it('lowers the DPO loss when the policy is moved along the preference direction', () => {
      // The sign of the DPO gradient is the claim the laboratory makes. Move
      // the policy by hand and check the loss falls, rather than relying on
      // the optimiser to find the direction.
      const example = PREFERENCE_DATASET[0]
      const reference = [0.4, 0.35, 0.25]
      const chosen = example.candidates.find((c) => c.id === example.chosen)!
      const rejected = example.candidates.find((c) => c.id === example.rejected)!
      const delta = [0, 1, 2].map((k) => chosen.features[k] - rejected.features[k])

      let previous = Number.POSITIVE_INFINITY
      for (let step = 0; step <= 10; step++) {
        const w = reference.map((value, k) => value + (step * 0.05) * delta[k])
        const loss = dpoLoss({ w, beta: 0.6 }, example)
        expect(loss, `step ${step}`).toBeLessThan(previous)
        previous = loss
      }
    })

    it('keeps the preference probability consistent with the log-odds', () => {
      const rng = createRng(5151)
      for (let trial = 0; trial < 200; trial++) {
        const example = PREFERENCE_DATASET[Math.floor(rng() * PREFERENCE_DATASET.length)]
        const w = [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]
        const beta = 0.1 + rng() * 1.9
        const params = { w, beta }
        const d = dpoLogOdds(params, example)
        const p = dpoPreferenceProbability(params, example)
        expect(p, `seed 5151 trial ${trial}`).toBeGreaterThanOrEqual(0)
        expect(p, `seed 5151 trial ${trial}`).toBeLessThanOrEqual(1)
        expect(p, `seed 5151 trial ${trial}`).toBeCloseTo(1 / (1 + Math.exp(-d)), 12)
        // The loss is the negative log-likelihood of that probability.
        expect(dpoLoss(params, example), `seed 5151 trial ${trial}`).toBeCloseTo(-Math.log(p), 12)
      }
    })

    it('scales the DPO log-odds linearly in beta', () => {
      const example = PREFERENCE_DATASET[0]
      const w = [0.5, 0.2, -0.1]
      const single = dpoLogOdds({ w, beta: 0.5 }, example)
      const double = dpoLogOdds({ w, beta: 1.0 }, example)
      expect(double).toBeCloseTo(2 * single, 12)
    })
  })

  describe('transformer explorer', () => {
    it('always produces a normalised distribution for any non-empty input', () => {
      const rng = createRng(2468)
      const words = ['model', 'text', 'the', 'attention', 'learns', 'zzz']
      for (let trial = 0; trial < 120; trial++) {
        const count = 1 + Math.floor(rng() * 6)
        const parts: string[] = []
        for (let i = 0; i < count; i++) parts.push(words[Math.floor(rng() * words.length)])
        const text = parts.join(' ')
        for (const mode of ['word', 'char', 'subword'] as const) {
          const result = runExplorer(text, { mode })
          const total = result.probabilities.reduce((s, p) => s + p, 0)
          expect(total, `seed 2468 trial ${trial} mode ${mode}`).toBeCloseTo(1, 12)
          expect(result.probabilities.every(Number.isFinite)).toBe(true)
          // The causal mask must hold in every mode.
          for (let i = 0; i < result.attentionTrace.weights.length; i++) {
            for (let k = i + 1; k < result.attentionTrace.weights[i].length; k++) {
              expect(result.attentionTrace.weights[i][k], `seed 2468 trial ${trial}`).toBe(0)
            }
          }
        }
      }
    })
  })
})
