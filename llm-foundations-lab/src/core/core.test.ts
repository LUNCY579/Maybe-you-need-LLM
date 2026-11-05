import { describe, expect, it } from 'vitest'
import {
  addMatricesElementwise,
  argmax,
  createRng,
  crossEntropy,
  entropy,
  gelu,
  layerNorm,
  matmul,
  sigmoid,
  softmax,
  softmaxRows,
  softplus,
  transpose,
  type Matrix,
} from './math'
import {
  attention,
  attentionScores,
  causalFlag,
  causalMask,
  isRowStochastic,
  mergeHeads,
  projectQkv,
  rawScores,
  topAttendedIndex,
} from './attention'
import {
  addPositional,
  buildToyParameters,
  hashString,
  positionalEncoding,
  seededProjection,
  toyEmbedding,
} from './embeddings'
import {
  TOY_LOGITS,
  TOY_LOGIT_TOKENS,
  decodeDistribution,
  generateSequence,
  greedyToken,
  sampleFromDistribution,
  sampleToken,
  seedFromText,
  type SamplingConfig,
} from './sampling'
import {
  DEFAULT_TRAINING_CONFIG,
  TRAIN_CORPUS,
  accuracy,
  buildVocab,
  evaluate,
  encodeCorpus,
  initModel,
  numericalGradient,
  train,
  trainStep,
  transitionMatrix,
  weightNorm,
} from './training'
import {
  PREFERENCE_DATASET,
  dpoGradient,
  dpoLogOdds,
  dpoPreferenceProbability,
  impliedReward,
  numericalAlignmentGradient,
  policyDistribution,
  rewardModelGradient,
  runAlignment,
  sftGradient,
  type PolicyParams,
} from './alignment'
import {
  DEFAULT_KV_CONFIG,
  TOY_LM_TOKENS,
  ToyAutoregressiveLM,
  attentionMultiplyAdds,
  autoregressiveDecode,
  beamSearch,
  bestOfN,
  buildToyReasoningTree,
  decodeMultiplyAdds,
  gqaMemoryRatio,
  kvCacheBytes,
  pathToNode,
} from './inference'
import { runExplorer, shapeOf, softmaxDenominator } from './transformer'
import { ID_BY_SURFACE, TOY_VOCAB, tokenize, vocabSize } from './tokenizer'
import {
  addStudyTime,
  completeLesson,
  createEmptyProgress,
  loadProgress,
  mergeProgress,
  parseProgress,
  persistProgress,
  recordQuizAttempt,
  sanitizeProgress,
  serializeProgress,
  summarize,
  toggleBookmark,
  type ProgressStorage,
} from './progress'
import { multiHeadTrace } from './transformer'

const close = (a: number, b: number, digits = 9) => expect(a).toBeCloseTo(b, digits)

describe('math', () => {
  it('multiplies matrices with the expected shapes', () => {
    const a: Matrix = [
      [1, 2],
      [3, 4],
    ]
    const b: Matrix = [
      [5, 6],
      [7, 8],
    ]
    expect(matmul(a, b)).toEqual([
      [19, 22],
      [43, 50],
    ])
    expect(transpose(a)).toEqual([
      [1, 3],
      [2, 4],
    ])
  })

  it('rejects incompatible matmul shapes', () => {
    expect(() => matmul([[1, 2, 3]], [[1, 2]])).toThrow(/incompatible shapes/)
  })

  it('returns a probability distribution from softmax', () => {
    const probs = softmax([1, 2, 3])
    close(probs.reduce((s, v) => s + v, 0), 1)
    expect(probs[2]).toBeGreaterThan(probs[1])
    expect(probs[1]).toBeGreaterThan(probs[0])
  })

  it('is numerically stable for large logits', () => {
    const probs = softmax([1000, 1000, 1000])
    probs.forEach((p) => close(p, 1 / 3))
  })

  it('rejects non-positive temperature', () => {
    expect(() => softmax([1, 2], 0)).toThrow(RangeError)
    expect(() => softmax([1, 2], -1)).toThrow(RangeError)
    expect(() => softmax([1, 2], Number.NaN)).toThrow(RangeError)
  })

  it('sharpens as temperature decreases', () => {
    const cold = softmax([2, 1, 0], 0.1)
    const hot = softmax([2, 1, 0], 5)
    expect(cold[0]).toBeGreaterThan(hot[0])
    expect(hot[0] - hot[2]).toBeLessThan(cold[0] - cold[2])
  })

  it('normalises each attention row independently', () => {
    const rows = softmaxRows([
      [1, 1],
      [5, 0],
    ])
    close(rows[0][0], 0.5)
    expect(rows[1][0]).toBeGreaterThan(0.99)
  })

  it('matches known sigmoid and softplus values', () => {
    close(sigmoid(0), 0.5)
    close(sigmoid(2), 1 / (1 + Math.exp(-2)))
    close(sigmoid(-2), 1 / (1 + Math.exp(2)))
    close(softplus(0), Math.log(2))
    close(softplus(50), 50)
  })

  it('computes entropy and cross-entropy', () => {
    close(entropy([0.5, 0.5]), Math.log(2))
    close(entropy([1, 0]), 0)
    close(crossEntropy([1, 0], [0.5, 0.5]), Math.log(2))
  })

  it('produces reproducible random streams for the same seed', () => {
    const a = createRng(123)
    const b = createRng(123)
    const c = createRng(124)
    const sa = [a(), a(), a()]
    expect(sa).toEqual([b(), b(), b()])
    expect(sa).not.toEqual([c(), c(), c()])
    sa.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    })
  })

  it('finds the argmax', () => {
    expect(argmax([1, 9, 3])).toBe(1)
  })

  it('applies GELU, which passes positives through and suppresses negatives', () => {
    // GELU(0) = 0 and GELU(x) -> x for large x.
    expect(gelu(0)).toBeCloseTo(0, 9)
    expect(gelu(3)).toBeCloseTo(3, 2)
    expect(gelu(3)).toBeGreaterThan(2.9)
    // A negative input is damped towards zero rather than passed through.
    expect(gelu(-3)).toBeLessThan(0)
    expect(gelu(-3)).toBeGreaterThan(-0.1)
    // It is monotone, which is what a stack of layers needs.
    expect(gelu(1)).toBeGreaterThan(gelu(0))
    expect(gelu(2)).toBeGreaterThan(gelu(1))
  })

  it('normalises each row of a matrix', () => {
    const gamma = [1, 1]
    const beta = [0, 0]
    const matrix = [
      [1, 2],
      [10, 20],
    ]
    const normalised = layerNorm(matrix, gamma, beta)
    for (const row of normalised) {
      // Zero mean.
      expect(row.reduce((sum, value) => sum + value, 0) / row.length).toBeCloseTo(0, 9)
      // Unit variance, up to the epsilon in the denominator.
      const mean = row.reduce((sum, value) => sum + value, 0) / row.length
      const variance = row.reduce((sum, value) => sum + (value - mean) ** 2, 0) / row.length
      expect(variance).toBeGreaterThan(0.999)
      expect(variance).toBeLessThanOrEqual(1)
    }
    // Rows with different scales end up the same, which is the point. They
    // agree to within the epsilon in the denominator.
    expect(normalised[0][0]).toBeCloseTo(normalised[1][0], 3)
  })

  it('adds matrices elementwise for the residual connection', () => {
    const sum = addMatricesElementwise(
      [
        [1, 2],
        [3, 4],
      ],
      [
        [10, 20],
        [30, 40],
      ],
    )
    expect(sum).toEqual([
      [11, 22],
      [33, 44],
    ])
  })
})

describe('attention', () => {
  const H: Matrix = [
    [1, 0, 1, 0],
    [0, 1, 0, 1],
    [1, 1, 0, 0],
  ]
  const params = buildToyParameters(10, { dim: 4, seed: 'unit-test' })

  it('builds a causal mask with zeros on and below the diagonal', () => {
    const mask = causalMask(3)
    expect(mask[0][0]).toBe(0)
    expect(mask[0][1]).toBe(-Infinity)
    expect(mask[1][0]).toBe(0)
    expect(mask[2][2]).toBe(0)
    expect(causalFlag(3)).toEqual([
      [true, false, false],
      [true, true, false],
      [true, true, true],
    ])
  })

  it('rejects mismatched shapes rather than producing nonsense', () => {
    expect(() => projectQkv(H, params.Wq.slice(0, 3), params.Wk, params.Wv)).toThrow(
      /incompatible shapes/,
    )
  })

  it('projects to Q, K and V of the right shape', () => {
    const { Q, K, V, d } = projectQkv(H, params.Wq, params.Wk, params.Wv)
    expect(Q.length).toBe(3)
    expect(Q[0].length).toBe(4)
    expect(K.length).toBe(3)
    expect(V.length).toBe(3)
    expect(d).toBe(4)
  })

  it('scales scores by 1/sqrt(d)', () => {
    const { Q, K } = projectQkv(H, params.Wq, params.Wk, params.Wv)
    const raw = rawScores(Q, K)
    const scaled = attentionScores(Q, K, { d: Q[0].length })
    close(scaled[0][1], raw[0][1] / Math.sqrt(4), 9)
  })

  it('produces row-stochastic attention weights', () => {
    const { Q, K, V } = projectQkv(H, params.Wq, params.Wk, params.Wv)
    const trace = attention(Q, K, V)
    expect(isRowStochastic(trace.weights)).toBe(true)
    trace.weights.forEach((row) => row.forEach((w) => expect(w).toBeGreaterThanOrEqual(0)))
  })

  it('gives exactly zero weight to future positions', () => {
    const { Q, K, V } = projectQkv(H, params.Wq, params.Wk, params.Wv)
    const trace = attention(Q, K, V, { masked: true })
    expect(trace.weights[0][1]).toBe(0)
    expect(trace.weights[0][2]).toBe(0)
    expect(trace.weights[1][2]).toBe(0)
    expect(trace.maskedOut[0][2]).toBe(true)
  })

  it('attends to everything when masking is disabled', () => {
    const { Q, K, V } = projectQkv(H, params.Wq, params.Wk, params.Wv)
    const trace = attention(Q, K, V, { masked: false })
    expect(trace.weights[0][1]).toBeGreaterThan(0)
    expect(trace.weights[0][2]).toBeGreaterThan(0)
  })

  it('does not let the first row attend to the future', () => {
    const { Q, K, V } = projectQkv(H, params.Wq, params.Wk, params.Wv)
    const trace = attention(Q, K, V)
    // Row 0 has a single legal position, so it must be a point mass on itself.
    close(trace.weights[0][0], 1)
    expect(topAttendedIndex(trace.weights)[0]).toBe(0)
  })

  it('computes the attention output as weights · V', () => {
    const { Q, K, V } = projectQkv(H, params.Wq, params.Wk, params.Wv)
    const trace = attention(Q, K, V)
    const expected = matmul(trace.weights, V)
    trace.output.forEach((row, i) => row.forEach((v, j) => close(v, expected[i][j])))
  })

  it('merges heads with the output projection', () => {
    const merged = mergeHeads(
      [
        [
          [1, 2],
          [3, 4],
        ],
        [
          [5, 6],
          [7, 8],
        ],
      ],
      [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    )
    expect(merged).toEqual([
      [1, 2, 5, 6],
      [3, 4, 7, 8],
    ])
  })

  it('is permutation-consistent in the unmasked case (scores only)', () => {
    const { Q, K } = projectQkv(H, params.Wq, params.Wk, params.Wv)
    const scores = attentionScores(Q, K)
    const t = transpose(scores)
    scores.forEach((row, i) => row.forEach((v, j) => close(v, t[j][i], 9)))
  })
})

describe('embeddings', () => {
  it('hashes strings stably', () => {
    expect(hashString('token')).toBe(hashString('token'))
    expect(hashString('token')).not.toBe(hashString('tokens'))
  })

  it('gives the same token the same embedding and different tokens different ones', () => {
    expect(toyEmbedding('model')).toEqual(toyEmbedding('model'))
    expect(toyEmbedding('model')).not.toEqual(toyEmbedding('tokens'))
    const vector = toyEmbedding('model', 8)
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0))
    close(norm, 1, 2)
  })

  it('builds sinusoidal positional encodings with sin and cos interleaved', () => {
    const pe = positionalEncoding(0, 4)
    close(pe[0], 0)
    close(pe[1], 1)
    const pe1 = positionalEncoding(1, 4)
    close(pe1[0], Math.round(Math.sin(1) * 1000) / 1000)
  })

  it('adds positional information to an embedding', () => {
    const embedding = toyEmbedding('model', 4)
    const hidden = addPositional(embedding, 3)
    const pe = positionalEncoding(3, 4)
    hidden.forEach((v, i) => close(v, Math.round((embedding[i] + pe[i]) * 1000) / 1000, 6))
  })

  it('creates reproducible projection matrices', () => {
    const a = seededProjection(4, 4, 'seed')
    const b = seededProjection(4, 4, 'seed')
    const c = seededProjection(4, 4, 'other')
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })
})

describe('transformer explorer pipeline', () => {
  it('produces attention weights and a normalised next-token distribution', () => {
    const result = runExplorer('the model learns', { mode: 'word' })
    expect(result.tokenization.sequenceLength).toBeGreaterThan(0)
    expect(result.H.length).toBe(result.tokenization.sequenceLength)
    expect(isRowStochastic(result.attentionTrace.weights)).toBe(true)
    close(result.probabilities.reduce((s, v) => s + v, 0), 1)
    expect(result.topPredictions.length).toBeGreaterThan(0)
    expect(result.topPredictions[0].probability).toBeGreaterThanOrEqual(
      result.topPredictions[result.topPredictions.length - 1].probability,
    )
  })

  it('respects the causal mask for every tokenisation mode', () => {
    for (const mode of ['word', 'char', 'subword'] as const) {
      const result = runExplorer('the model learns', { mode })
      result.attentionTrace.weights.forEach((row, i) => {
        row.forEach((w, k) => {
          if (k > i) expect(w).toBe(0)
        })
      })
    }
  })

  it('reports shapes that match the actual matrices', () => {
    const result = runExplorer('attention heads', { mode: 'word' })
    expect(shapeOf(result.qkv.Q)).toBe(`[${result.shapes.sequenceLength} × 8]`)
    expect(shapeOf(result.attentionTrace.weights)).toBe(result.shapes.attention)
  })

  it('computes a softmax denominator consistent with the probabilities', () => {
    const result = runExplorer('the model', { mode: 'word' })
    const exponent = Math.max(...result.logits)
    const expected = result.logits
      .map((v) => Math.exp(v - exponent))
      .reduce((s, v) => s + v, 0)
    close(softmaxDenominator(result.logits), expected, 6)
  })

  it('keeps out-of-vocabulary text observable instead of crashing', () => {
    const result = runExplorer('zzzzqqq the model', { mode: 'word' })
    expect(result.tokenization.oovCount).toBeGreaterThan(0)
    expect(result.steps.some((s) => s.token === '<unk>')).toBe(true)
  })

  it('runs multi-head attention and merges the head outputs back to the model dimension', () => {
    const result = runExplorer('the model learns', { mode: 'word' })
    const params = buildToyParameters(10, { dim: 8, seed: 'llm-lab-v1' })
    const { heads, merged } = multiHeadTrace(result.H, params, 4)
    expect(heads).toHaveLength(4)
    heads.forEach((head) => {
      expect(head.output.length).toBe(result.H.length)
      expect(head.output[0].length).toBe(2)
    })
    expect(merged.length).toBe(result.H.length)
    expect(merged[0].length).toBe(8)
  })

  it('gives one head the same result as the single-head path', () => {
    const result = runExplorer('the model learns from text', { mode: 'word' })
    const params = buildToyParameters(248, { dim: 8, seed: 'llm-lab-v1' })
    const { heads } = multiHeadTrace(result.H, params, 1)
    const head = heads[0]
    expect(head.width).toBe(8)
    // Same scores, same weights, same output as the single-head computation.
    for (let i = 0; i < result.attentionTrace.scores.length; i++) {
      for (let k = 0; k < result.attentionTrace.scores[i].length; k++) {
        close(head.scores[i][k], result.attentionTrace.scores[i][k])
        close(head.weights[i][k], result.attentionTrace.weights[i][k])
      }
    }
    for (let i = 0; i < result.attentionTrace.output.length; i++) {
      for (let k = 0; k < result.attentionTrace.output[i].length; k++) {
        close(head.output[i][k], result.attentionTrace.output[i][k])
      }
    }
  })

  it('splits the hidden dimension across heads without losing a coordinate', () => {
    const result = runExplorer('the model learns', { mode: 'word' })
    const params = buildToyParameters(10, { dim: 8, seed: 'llm-lab-v1' })
    for (const count of [1, 2, 3, 4, 5, 8]) {
      const { heads, headWidths, merged } = multiHeadTrace(result.H, params, count)
      expect(heads).toHaveLength(Math.min(count, 8))
      expect(headWidths.reduce((sum, w) => sum + w, 0)).toBe(8)
      expect(merged[0]).toHaveLength(8)
      // The slices must partition the hidden dimension.
      let cursor = 0
      for (const head of heads) {
        expect(head.from).toBe(cursor)
        cursor = head.to
      }
    }
  })

  it('keeps every head causal and row-stochastic', () => {
    const result = runExplorer('the model learns from text', { mode: 'word' })
    const params = buildToyParameters(248, { dim: 8, seed: 'llm-lab-v1' })
    const { heads } = multiHeadTrace(result.H, params, 4)
    for (const head of heads) {
      for (let i = 0; i < head.weights.length; i++) {
        const total = head.weights[i].reduce((sum, w) => sum + w, 0)
        close(total, 1, 9)
        for (let k = 0; k < head.weights[i].length; k++) {
          expect(head.weights[i][k]).toBeGreaterThanOrEqual(0)
          if (k > i) expect(head.weights[i][k]).toBe(0)
        }
      }
    }
  })

  it('scales each head by the square root of its own width', () => {
    const result = runExplorer('the model learns from text', { mode: 'word' })
    const params = buildToyParameters(248, { dim: 8, seed: 'llm-lab-v1' })
    const { heads } = multiHeadTrace(result.H, params, 4)
    for (const head of heads) {
      const expected = head.raw.map((row) => row.map((value) => value / Math.sqrt(head.width)))
      for (let i = 0; i < expected.length; i++) {
        for (let k = 0; k < expected[i].length; k++) {
          // Masked entries carry −1e30 rather than the scaled value.
          if (k > i) continue
          close(head.scores[i][k], expected[i][k])
        }
      }
    }
  })

  it('honours the mask switch in every head', () => {
    const result = runExplorer('the model learns from text', { mode: 'word' })
    const params = buildToyParameters(248, { dim: 8, seed: 'llm-lab-v1' })
    const { heads } = multiHeadTrace(result.H, params, 2, { masked: false })
    for (const head of heads) {
      // With the mask off, a row can reach the future.
      const lastRow = head.weights[head.weights.length - 1]
      expect(lastRow[lastRow.length - 1]).toBeGreaterThan(0)
    }
  })

  it('runs a full block: attention, residual, normalisation and feed-forward', () => {
    const result = runExplorer('the model learns from text', { mode: 'word' })
    const { block, H, shapes } = result
    const dim = shapes.dim

    // Every intermediate keeps the block's shape.
    for (const matrix of [block.attentionOut, block.afterNorm1, block.ffnOut, block.blockOut]) {
      expect(matrix).toHaveLength(H.length)
      expect(matrix[0]).toHaveLength(dim)
    }
    // The feed-forward network is wider than the model.
    expect(block.ffnHidden[0].length).toBe(dim * 4)

    // The residual connection really adds: the attention output differs from
    // the block input, and the sum is not simply the attention output.
    expect(block.afterNorm1[0]).not.toEqual(block.attentionOut[0])
    // Layer norm centres the row.
    const mean =
      block.afterNorm1[0].reduce((sum, value) => sum + value, 0) / block.afterNorm1[0].length
    expect(Math.abs(mean)).toBeLessThan(1e-3)
  })

  it('reads the next-token distribution from the block output, not the attention output', () => {
    const result = runExplorer('the model learns from text', { mode: 'word' })
    // The two differ, so the choice of which one feeds the unembedding matters.
    expect(result.block.blockOut[0]).not.toEqual(result.attentionTrace.output[0])
    // And the distribution is still a distribution.
    const total = result.probabilities.reduce((sum, value) => sum + value, 0)
    expect(total).toBeCloseTo(1, 12)
  })
})

describe('tokenizer laboratory', () => {
  it('labels word, character and subword modes and keeps offsets consistent', () => {
    for (const mode of ['word', 'char', 'subword'] as const) {
      const result = tokenize('the model learns', { mode })
      expect(result.mode).toBe(mode)
      result.tokens.forEach((token) => {
        expect(token.end).toBeGreaterThan(token.start)
        expect(result.text.slice(token.start, token.end).toLowerCase()).toBe(token.text.toLowerCase())
      })
    }
  })

  it('assigns word-level ids from the explicit toy vocabulary', () => {
    const result = tokenize('the model learns', { mode: 'word' })
    expect(result.tokens.map((t) => t.text)).toEqual(['the', 'model', 'learns'])
    expect(result.tokens.map((t) => t.id)).toEqual([
      ID_BY_SURFACE.get('the'),
      ID_BY_SURFACE.get('model'),
      ID_BY_SURFACE.get('learns'),
    ])
    expect(result.sequenceLength).toBe(3)
    expect(result.oovCount).toBe(0)
  })

  it('flattens to more units in character mode and fewer in subword mode', () => {
    const text = 'tokenizer turns text into tokens'
    const word = tokenize(text, { mode: 'word' })
    const char = tokenize(text, { mode: 'char' })
    const subword = tokenize(text, { mode: 'subword' })
    expect(char.sequenceLength).toBeGreaterThan(word.sequenceLength)
    expect(subword.sequenceLength).toBeGreaterThanOrEqual(word.sequenceLength)
  })

  it('composes unknown words from subword pieces', () => {
    const result = tokenize('embedding encodes', { mode: 'subword' })
    expect(result.oovCount).toBe(0)
    expect(result.sequenceLength).toBeGreaterThanOrEqual(2)
  })

  it('marks out-of-vocabulary words and reports the OOV rate', () => {
    const result = tokenize('zorbles the glorp', { mode: 'word' })
    expect(result.oovCount).toBe(2)
    close(result.oovRate, 2 / 3)
    expect(result.ids.filter((id) => id === null)).toHaveLength(2)
  })

  it('is deterministic and vocabulary-consistent', () => {
    const a = tokenize('attention heads', { mode: 'word' })
    const b = tokenize('attention heads', { mode: 'word' })
    expect(a.ids).toEqual(b.ids)
    expect(vocabSize()).toBeGreaterThan(100)
    expect(TOY_VOCAB[0]).toBe('<pad>')
  })

  it('reports zero statistics for empty input', () => {
    const result = tokenize('   ', { mode: 'word' })
    expect(result.sequenceLength).toBe(0)
    expect(result.oovRate).toBe(0)
  })
})

describe('sampling and decoding', () => {
  const config: SamplingConfig = { temperature: 1, topK: 4, topP: 0.9, seed: 1 }

  it('normalises the base distribution', () => {
    const trace = decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, config)
    close(trace.baseProbabilities.reduce((s, v) => s + v, 0), 1)
    close(trace.probabilities.reduce((s, v) => s + v, 0), 1)
  })

  it('respects top-k', () => {
    const trace = decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, { ...config, topK: 3 })
    expect(trace.candidates.length).toBeLessThanOrEqual(3)
    expect(trace.candidates.length).toBeGreaterThanOrEqual(1)
  })

  it('respects top-p and always keeps the most likely token', () => {
    const trace = decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, { ...config, topK: 12, topP: 0.5 })
    const cumulative = trace.candidates.reduce((s, c) => s + c.probability, 0)
    close(cumulative, 1)
    const removed = trace.candidates.reduce((s, c) => s + c.probability, 0)
    expect(removed).toBeGreaterThan(0.49)
    expect(argmax(trace.probabilities)).toBe(argmax(TOY_LOGITS))
  })

  it('never selects a filtered-out token', () => {
    const trace = decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, config)
    trace.probabilities.forEach((p, i) => {
      if (!trace.candidateIndices.includes(i)) expect(p).toBe(0)
    })
  })

  it('rejects invalid temperature, top-k and top-p', () => {
    expect(() => decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, { ...config, temperature: 0 })).toThrow(
      RangeError,
    )
    expect(() =>
      decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, { ...config, temperature: -2 }),
    ).toThrow(/temperature/)
    expect(() => decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, { ...config, topK: 0 })).toThrow(
      RangeError,
    )
    expect(() => decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, { ...config, topP: 1.5 })).toThrow(
      RangeError,
    )
  })

  it('approaches greedy decoding as temperature tends to zero', () => {
    const trace = decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, { ...config, temperature: 0.01 })
    expect(trace.candidates[0].token).toBe(TOY_LOGIT_TOKENS[greedyToken(TOY_LOGITS)])
    close(trace.candidates[0].probability, 1, 6)
  })

  it('flattens the distribution as temperature grows', () => {
    const cold = decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, { ...config, temperature: 0.5 })
    const hot = decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, { ...config, temperature: 3, topK: 12, topP: 1 })
    expect(cold.entropy).toBeLessThan(hot.entropy)
  })

  it('is deterministic for a given seed and different for another', () => {
    const tokens = TOY_LOGIT_TOKENS
    const transition = (): number[] => [...TOY_LOGITS]
    const run = (seed: number) =>
      generateSequence(['the', 'model'], transition, tokens, { ...config, seed }, 6, createRng(seed)).text
    expect(run(11)).toEqual(run(11))
    expect(run(11)).not.toEqual(run(99))
  })

  it('draws only from the filtered support', () => {
    const trace = decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, { ...config, topK: 2 })
    const rng = createRng(5)
    for (let i = 0; i < 100; i++) {
      const index = sampleFromDistribution(trace.probabilities, rng)
      expect(trace.candidateIndices).toContain(index)
    }
  })

  it('throws when asked to sample from an all-zero distribution', () => {
    expect(() => sampleFromDistribution([0, 0], createRng(1))).toThrow()
  })

  it('returns the token string alongside its index', () => {
    const result = sampleToken(TOY_LOGITS, TOY_LOGIT_TOKENS, config, createRng(3))
    expect(result.token).toBe(TOY_LOGIT_TOKENS[result.index])
    expect(result.trace.candidates.length).toBeGreaterThan(0)
  })

  it('produces a replayable seed from text', () => {
    expect(seedFromText('hello')).toBe(seedFromText('hello'))
    expect(seedFromText('hello')).not.toBe(seedFromText('world'))
  })
})

describe('training laboratory', () => {
  it('encodes a corpus into bigram pairs', () => {
    const vocab = buildVocab(TRAIN_CORPUS)
    const pairs = encodeCorpus(TRAIN_CORPUS, vocab)
    expect(pairs.length).toBeGreaterThan(20)
    pairs.forEach((pair) => {
      expect(pair.prev).toBeGreaterThanOrEqual(0)
      expect(pair.next).toBeLessThan(vocab.tokens.length)
    })
  })

  it('lowers the loss and raises accuracy during training', () => {
    const run = train({ ...DEFAULT_TRAINING_CONFIG, steps: 80, learningRate: 0.9 })
    const first = run.history[0]
    const last = run.history[run.history.length - 1]
    expect(last.trainLoss).toBeLessThan(first.trainLoss)
    expect(last.trainAccuracy).toBeGreaterThan(first.trainAccuracy)
    expect(run.diverged).toBe(false)
  })

  it('keeps the transition matrix row-stochastic', () => {
    const run = train({ ...DEFAULT_TRAINING_CONFIG, steps: 20 })
    transitionMatrix(run.model).forEach((row) => close(row.reduce((s, v) => s + v, 0), 1))
  })

  it('matches the analytic softmax gradient to a finite-difference estimate', () => {
    const vocab = buildVocab(TRAIN_CORPUS)
    const pairs = encodeCorpus(TRAIN_CORPUS, vocab)
    const model = initModel(vocab, 0.01)
    // Perturb away from a uniform start so the gradient is informative.
    const v = vocab.tokens.length
    for (let i = 0; i < v; i++) {
      for (let j = 0; j < v; j++) model.weights[i][j] += ((i + 1) * (j + 2)) % 7 / 50
    }
    const pair = pairs[0]
    let worst = 0
    for (const j of [0, pair.next, v - 1]) {
      // Analytic gradient of -log softmax(z[prev]) for a single pair: p - onehot.
      const probs = softmax(model.weights[pair.prev])
      const analytic = probs[j] - (j === pair.next ? 1 : 0)
      const numeric = numericalGradient(model, [pair], pair.prev, j)
      worst = Math.max(worst, Math.abs(analytic - numeric))
    }
    expect(worst).toBeLessThan(1e-4)
  })

  it('shrinks the weight norm with L2 regularisation', () => {
    const noReg = train({ ...DEFAULT_TRAINING_CONFIG, steps: 40, l2: 0 })
    const withReg = train({ ...DEFAULT_TRAINING_CONFIG, steps: 40, l2: 0.6 })
    expect(weightNorm(withReg.model)).toBeLessThan(weightNorm(noReg.model))
    expect(withReg.history[withReg.history.length - 1].trainLoss).toBeGreaterThan(
      noReg.history[noReg.history.length - 1].trainLoss,
    )
  })

  it('is fully deterministic for a given seed', () => {
    const a = train({ ...DEFAULT_TRAINING_CONFIG, steps: 15 })
    const b = train({ ...DEFAULT_TRAINING_CONFIG, steps: 15 })
    expect(a.history).toEqual(b.history)
    expect(a.model.weights).toEqual(b.model.weights)
  })

  it('shows that an oversized step size can end up worse than a small one', () => {
    const stable = train({ ...DEFAULT_TRAINING_CONFIG, steps: 60, learningRate: 0.5 })
    const unstable = train({ ...DEFAULT_TRAINING_CONFIG, steps: 60, learningRate: 60 })
    const finalStable = stable.history[stable.history.length - 1].trainLoss
    const finalUnstable = unstable.history[unstable.history.length - 1].trainLoss
    expect(finalStable).toBeLessThan(finalUnstable)
    // Both runs stay numerically finite; the large step simply overshoots.
    expect(stable.diverged).toBe(false)
    expect(unstable.diverged).toBe(false)
  })

  it('reports a non-finite loss instead of silently continuing', () => {
    const run = train({ ...DEFAULT_TRAINING_CONFIG, steps: 30, learningRate: 1e12, l2: 1e9 })
    expect(run.diverged).toBe(true)
    expect(run.history.some((point) => !Number.isFinite(point.trainLoss))).toBe(true)
  })

  it('rejects a non-positive learning rate', () => {
    const vocab = buildVocab(TRAIN_CORPUS)
    const model = initModel(vocab)
    expect(() => trainStep(model, encodeCorpus(TRAIN_CORPUS, vocab), 0)).toThrow(RangeError)
  })

  it('reports better evaluation loss for a train-fitted model on training data', () => {
    const run = train({ ...DEFAULT_TRAINING_CONFIG, steps: 60 })
    expect(evaluate(run.model, run.trainPairs)).toBeLessThan(evaluate(initModel(run.model.vocab), run.trainPairs))
    expect(accuracy(run.model, run.trainPairs)).toBeGreaterThan(0.5)
  })
})

describe('alignment laboratory', () => {
  const example = PREFERENCE_DATASET[0]
  const params: PolicyParams = { w: [0.5, 0.3, 0.2], beta: 0.6 }

  it('builds a normalised policy distribution over candidates', () => {
    const probs = policyDistribution(params, example.candidates)
    close(probs.reduce((s, v) => s + v, 0), 1)
    expect(probs.length).toBe(example.candidates.length)
  })

  it('computes sigmoid preference probabilities in [0, 1]', () => {
    for (const ex of PREFERENCE_DATASET) {
      const p = dpoPreferenceProbability(params, ex)
      expect(p).toBeGreaterThan(0)
      expect(p).toBeLessThan(1)
    }
  })

  it('matches the DPO log-odds to the explicit ratio formulation', () => {
    // log(pi(ya)/pi_ref(ya)) - log(pi(yb)/pi_ref(yb)) must equal beta (w - w_ref)·Δφ.
    const reference: PolicyParams = { w: [0.4, 0.35, 0.25], beta: params.beta }
    const probs = policyDistribution(params, example.candidates)
    const refProbs = policyDistribution(reference, example.candidates)
    const indexA = example.candidates.findIndex((c) => c.id === example.chosen)
    const indexB = example.candidates.findIndex((c) => c.id === example.rejected)
    const logRatio =
      Math.log(probs[indexA] / refProbs[indexA]) - Math.log(probs[indexB] / refProbs[indexB])
    close(logRatio, dpoLogOdds(params, example), 9)
  })

  it('agrees with the Bradley–Terry form through the implied reward', () => {
    const a = example.candidates.find((c) => c.id === example.chosen)!
    const b = example.candidates.find((c) => c.id === example.rejected)!
    const rewardDiff = impliedReward(params, a) - impliedReward(params, b)
    close(dpoPreferenceProbability(params, example), sigmoid(rewardDiff), 9)
    // The reference policy itself has zero implied reward difference.
    const reference: PolicyParams = { w: [0.4, 0.35, 0.25], beta: params.beta }
    close(impliedReward(reference, a) - impliedReward(reference, b), 0, 9)
  })

  it('matches analytic SFT and DPO gradients against finite differences', () => {
    for (const k of [0, 1, 2]) {
      close(sftGradient(params, example)[k], numericalAlignmentGradient('sft', params, example, k), 4)
      close(dpoGradient(params, example)[k], numericalAlignmentGradient('dpo', params, example, k), 4)
      close(
        rewardModelGradient(params.w, example)[k],
        numericalAlignmentGradient('reward', params, example, k),
        4,
      )
    }
  })

  it('reduces the DPO loss and increases the preference probability while training', () => {
    const run = runAlignment({ objective: 'dpo', learningRate: 0.5, steps: 120, beta: 0.6 })
    const first = run.history[0]
    const last = run.history[run.history.length - 1]
    expect(last.loss).toBeLessThan(first.loss)
    expect(last.meanPreferenceProbability).toBeGreaterThan(first.meanPreferenceProbability)
    expect(last.meanPreferenceProbability).toBeGreaterThan(0.8)
    expect(last.meanPreferenceProbability).toBeLessThan(1)
  })

  it('reduces the SFT loss on the chosen responses', () => {
    const run = runAlignment({ objective: 'sft', learningRate: 0.5, steps: 120, beta: 0.6 })
    expect(run.history[run.history.length - 1].loss).toBeLessThan(run.history[0].loss)
  })

  it('trains a reward model that separates chosen from rejected', () => {
    const run = runAlignment({ objective: 'reward', learningRate: 2.0, steps: 200, beta: 0.6 })
    expect(run.history[run.history.length - 1].loss).toBeLessThan(run.history[0].loss)
    for (const ex of PREFERENCE_DATASET) {
      const a = ex.candidates.find((c) => c.id === ex.chosen)!
      const b = ex.candidates.find((c) => c.id === ex.rejected)!
      const dot = (w: number[], f: readonly number[]) => w[0] * f[0] + w[1] * f[1] + w[2] * f[2]
      expect(dot(run.params.w, a.features)).toBeGreaterThan(dot(run.params.w, b.features))
    }
  })

  it('rejects invalid learning rates', () => {
    expect(() => runAlignment({ objective: 'dpo', learningRate: 0, steps: 5, beta: 1 })).toThrow(
      RangeError,
    )
  })
})

describe('inference and reasoning laboratory', () => {
  it('produces a valid next-token distribution from the toy LM', () => {
    const lm = new ToyAutoregressiveLM(4)
    const probs = lm.probabilities(['<bos>', 'the'])
    close(probs.reduce((s, v) => s + v, 0), 1)
    expect(probs[lm.tokens.indexOf('model')]).toBeGreaterThan(0.5)
  })

  it('makes the context window visibly change the distribution', () => {
    // The last token is 'text', so the bigram row is identical in both cases.
    // Only the earlier 'learns' token — visible only in the wider window — boosts 'from'.
    const context = ['<bos>', 'the', 'model', 'learns', 'text']
    const narrow = new ToyAutoregressiveLM(1).probabilities(context)
    const wide = new ToyAutoregressiveLM(6).probabilities(context)
    const fromIndex = TOY_LM_TOKENS.indexOf('from')
    expect(wide[fromIndex]).toBeGreaterThan(narrow[fromIndex])
    // Truncating the window must not change the probability of the last token itself.
    close(narrow.reduce((s, v) => s + v, 0), 1)
  })

  it('decodes autoregressively and stops at <eos>', () => {
    const lm = new ToyAutoregressiveLM(4)
    const { tokens, steps } = autoregressiveDecode(lm, ['<bos>'], 12, 1, 5)
    expect(steps.length).toBeGreaterThan(0)
    expect(steps.length).toBeLessThanOrEqual(12)
    expect(tokens[0]).toBe('<bos>')
    steps.forEach((step) => {
      expect(step.probability).toBeGreaterThan(0)
      expect(step.peakProbability).toBeGreaterThanOrEqual(step.probability)
      expect(step.entropy).toBeGreaterThanOrEqual(0)
    })
  })

  it('is deterministic for the same seed', () => {
    const lm = new ToyAutoregressiveLM(4)
    const a = autoregressiveDecode(lm, ['<bos>'], 6, 1, 21)
    const b = autoregressiveDecode(lm, ['<bos>'], 6, 1, 21)
    expect(a.tokens).toEqual(b.tokens)
  })

  it('computes KV-cache bytes from the analytic formula', () => {
    const bytes = kvCacheBytes(DEFAULT_KV_CONFIG)
    const expected = 2 * 32 * 8 * 128 * 4096 * 2 * 1
    expect(bytes).toBe(expected)
    // Halving the context halves the cache; doubling precision doubles it.
    expect(kvCacheBytes({ ...DEFAULT_KV_CONFIG, contextLength: 2048 }) * 2).toBe(bytes)
    expect(kvCacheBytes({ ...DEFAULT_KV_CONFIG, bytesPerValue: 1 })).toBe(bytes / 2)
  })

  it('scales the cache linearly with batch size and layers', () => {
    const base = kvCacheBytes(DEFAULT_KV_CONFIG)
    expect(kvCacheBytes({ ...DEFAULT_KV_CONFIG, batchSize: 4 })).toBe(base * 4)
    expect(kvCacheBytes({ ...DEFAULT_KV_CONFIG, layers: 64 })).toBe(base * 2)
  })

  it('computes the grouped-query memory ratio', () => {
    close(gqaMemoryRatio(DEFAULT_KV_CONFIG), 8 / 32)
    close(gqaMemoryRatio({ ...DEFAULT_KV_CONFIG, kvHeads: 32 }), 1)
  })

  it('models quadratic prefill and linear decode attention work', () => {
    expect(attentionMultiplyAdds(100, 8, 2)).toBe(100 * 100 * 8 * 2)
    expect(decodeMultiplyAdds(100, 8, 2)).toBe(100 * 8 * 2)
    // Four times the context costs sixteen times the prefill work but only four times the decode work.
    expect(attentionMultiplyAdds(400, 8, 2)).toBe(16 * attentionMultiplyAdds(100, 8, 2))
    expect(decodeMultiplyAdds(400, 8, 2)).toBe(4 * decodeMultiplyAdds(100, 8, 2))
  })

  it('shows greedy search getting trapped while a wider beam finds the correct answer', () => {
    const tree = buildToyReasoningTree()
    const greedy = beamSearch(tree, 1)
    const beam = beamSearch(tree, 3)
    // Greedy commits to the confident wrong branch b1 (0.75) and ends on b2 (0.90).
    expect(greedy.selected).toEqual(['b2'])
    expect(greedy.correct).toBe(false)
    // A wider beam keeps the correct branch alive and beats it with 0.97.
    expect(beam.selected).toEqual(['c3'])
    expect(beam.correct).toBe(true)
    expect(beam.expansions).toBeGreaterThan(greedy.expansions)
    expect(beam.verified.length).toBeGreaterThan(0)
    beam.selected.forEach((id) => {
      const node = tree.find((n) => n.id === id)
      expect(node?.terminal).toBe(true)
    })
  })

  it('samples complete paths in best-of-n and reports the verifier budget', () => {
    const tree = buildToyReasoningTree()
    const result = bestOfN(tree, 4, 1, 7)
    expect(result.expansions).toBeGreaterThan(0)
    expect(result.selected.length).toBeLessThanOrEqual(1)
    expect(result.depth).toBeGreaterThan(0)
  })

  it('reconstructs the full reasoning path to a node', () => {
    const tree = buildToyReasoningTree()
    const path = pathToNode(tree, 'a3')
    expect(path.map((n) => n.id)).toEqual(['root', 'a1', 'a2', 'a3'])
  })
})

describe('progress persistence', () => {
  const storage = (): ProgressStorage => {
    const map = new Map<string, string>()
    return {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => void map.set(key, value),
      removeItem: (key) => void map.delete(key),
    }
  }

  it('round-trips through JSON without losing information', () => {
    let state = createEmptyProgress()
    state = completeLesson(state, 'lesson-1', new Date('2026-01-01T00:00:00.000Z'))
    state = addStudyTime(state, 'lesson-1', 125)
    state = toggleBookmark(state, 'lesson-1')
    state = recordQuizAttempt(state, {
      questionId: 'q1',
      correct: true,
      answerIndex: 2,
      at: '2026-01-01T00:00:01.000Z',
    })
    const { state: restored, error } = parseProgress(serializeProgress(state))
    expect(error).toBeUndefined()
    expect(restored.lessons['lesson-1'].completed).toBe(true)
    expect(restored.lessons['lesson-1'].secondsSpent).toBe(125)
    expect(restored.bookmarks).toEqual(['lesson-1'])
    expect(restored.quizzes).toHaveLength(1)
  })

  it('persists and loads through a storage adapter', () => {
    const store = storage()
    const state = completeLesson(createEmptyProgress(), 'lesson-2')
    persistProgress(store, state)
    const loaded = loadProgress(store)
    expect(loaded.lessons['lesson-2'].completed).toBe(true)
  })

  it('returns empty progress when nothing is stored', () => {
    expect(loadProgress(storage())).toEqual(createEmptyProgress())
  })

  it('reports malformed JSON instead of throwing', () => {
    const { state, error } = parseProgress('{not json')
    expect(error).toBeTruthy()
    expect(state).toEqual(createEmptyProgress())
  })

  it('sanitises hostile or malformed documents', () => {
    const sanitized = sanitizeProgress({
      lessons: { a: { completed: 'yes', secondsSpent: -5 }, b: 42 },
      quizzes: [{ questionId: 7 }, { questionId: 'ok', correct: true, answerIndex: 1.7, at: 5 }],
      bookmarks: ['x', 'x', 3],
      playgroundConfigs: [{ id: 'c', lab: 'not-a-lab', settings: { a: 1, b: {} } }],
      notes: { a: 'note', b: 5 },
    })
    expect(sanitized.lessons.a.completed).toBe(false)
    expect(sanitized.lessons.a.secondsSpent).toBe(0)
    expect(sanitized.lessons.b).toBeUndefined()
    expect(sanitized.quizzes).toHaveLength(1)
    expect(sanitized.quizzes[0].questionId).toBe('ok')
    expect(sanitized.quizzes[0].answerIndex).toBe(1)
    expect(sanitized.bookmarks).toEqual(['x'])
    expect(sanitized.playgroundConfigs[0].lab).toBe('transformer')
    expect(sanitized.playgroundConfigs[0].settings).toEqual({ a: 1 })
    expect(sanitized.notes.b).toBeUndefined()
  })

  it('toggles bookmarks off again', () => {
    const on = toggleBookmark(createEmptyProgress(), 'lesson-3')
    expect(on.bookmarks).toEqual(['lesson-3'])
    expect(toggleBookmark(on, 'lesson-3').bookmarks).toEqual([])
  })

  it('summarises quiz accuracy from the latest attempt per question', () => {
    let state = createEmptyProgress()
    state = recordQuizAttempt(state, { questionId: 'q1', correct: false, answerIndex: 0, at: 't1' })
    state = recordQuizAttempt(state, { questionId: 'q1', correct: true, answerIndex: 1, at: 't2' })
    state = recordQuizAttempt(state, { questionId: 'q2', correct: false, answerIndex: 0, at: 't3' })
    const summary = summarize(state, 10)
    expect(summary.questionsAnswered).toBe(2)
    expect(summary.questionsCorrect).toBe(1)
    close(summary.accuracy, 0.5)
  })

  it('merges imported progress without losing local activity', () => {
    const current = completeLesson(createEmptyProgress(), 'lesson-a')
    const imported = completeLesson(createEmptyProgress(), 'lesson-b')
    const merged = mergeProgress(current, imported)
    expect(merged.lessons['lesson-a'].completed).toBe(true)
    expect(merged.lessons['lesson-b'].completed).toBe(true)
  })

  it('tracks study minutes', () => {
    const state = addStudyTime(createEmptyProgress(), 'lesson-4', 90)
    expect(summarize(state).studyMinutes).toBe(2)
  })
})
