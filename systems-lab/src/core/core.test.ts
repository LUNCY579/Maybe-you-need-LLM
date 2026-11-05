import { describe, expect, it } from 'vitest'
import { createRng } from '@llm-materials/course-core'
import { maxAbsDifference, naiveAttention, recomputationFactor, tiledAttention, trainingMemoryBytes } from './attention'
import {
  computeBoundBatchSize,
  decodeArithmeticIntensity,
  EXAMPLE_MODEL,
  kvCacheBytes,
  pagedAllocation,
} from './kvcache'
import {
  acceptanceRate,
  closedFormAcceptanceRate,
  measuredOutputDistribution,
  perturbed,
  simulateSpeculative,
  speculativeDistribution,
  totalVariation,
  verify,
} from './speculative'
import { activeParameterFraction, capacityOverflow, route, sparseSpeedup } from './moe'

function randomMatrices(rows: number, dimension: number, seed: number) {
  const rng = createRng(seed)
  const make = () => {
    const matrix: number[][] = []
    for (let r = 0; r < rows; r++) {
      const row: number[] = []
      for (let d = 0; d < dimension; d++) row.push(rng() * 2 - 1)
      matrix.push(row)
    }
    return matrix
  }
  return { q: make(), k: make(), v: make() }
}

describe('the attention', () => {
  it('gives the same answer whichever way it is computed', () => {
    const { q, k, v } = randomMatrices(24, 8, 3)
    const naive = naiveAttention(q, k, v)
    const tiled = tiledAttention(q, k, v, { blockSize: 5 })
    expect(maxAbsDifference(naive.output, tiled.output)).toBeLessThan(1e-9)
  })

  it('gives the same answer with a causal mask', () => {
    const { q, k, v } = randomMatrices(16, 6, 11)
    const naive = naiveAttention(q, k, v, { causal: true })
    const tiled = tiledAttention(q, k, v, { causal: true, blockSize: 4 })
    expect(maxAbsDifference(naive.output, tiled.output)).toBeLessThan(1e-9)
  })

  it('uses far less memory than the naive version', () => {
    const { q, k, v } = randomMatrices(256, 8, 5)
    const naive = naiveAttention(q, k, v)
    const tiled = tiledAttention(q, k, v, { blockSize: 16 })
    expect(tiled.peakMemoryBytes).toBeLessThan(naive.peakMemoryBytes / 10)
  })

  it('moves far less data than the naive version', () => {
    const { q, k, v } = randomMatrices(64, 8, 5)
    const naive = naiveAttention(q, k, v)
    const tiled = tiledAttention(q, k, v, { blockSize: 64 })
    expect(tiled.hbmTrafficBytes).toBeLessThan(naive.hbmTrafficBytes / 5)
  })

  it('streams the keys past once per query block', () => {
    const { q, k, v } = randomMatrices(64, 8, 5)
    expect(tiledAttention(q, k, v, { blockSize: 16 }).passes).toBe(4)
    expect(tiledAttention(q, k, v, { blockSize: 64 }).passes).toBe(1)
  })

  it('needs the matrix of probabilities in the training run, and the tiled one does not', () => {
    const naive = trainingMemoryBytes(128, 8, { tiled: false })
    const tiled = trainingMemoryBytes(128, 8, { tiled: true, blockSize: 16 })
    expect(tiled).toBeLessThan(naive / 10)
  })

  it('pays for the memory with arithmetic', () => {
    expect(recomputationFactor(true)).toBeGreaterThan(recomputationFactor(false))
  })
})

describe('the KV cache', () => {
  it('grows with the context and with the batch', () => {
    const one = kvCacheBytes(EXAMPLE_MODEL, 1000)
    const two = kvCacheBytes(EXAMPLE_MODEL, 2000)
    expect(two).toBeCloseTo(one * 2, 6)
    const batched = kvCacheBytes(EXAMPLE_MODEL, 1000, { batchSize: 4 })
    expect(batched).toBeCloseTo(one * 4, 6)
  })

  it('is memory-bound at a small batch and less so at a large one', () => {
    const small = decodeArithmeticIntensity(EXAMPLE_MODEL, 1, 512)
    const large = decodeArithmeticIntensity(EXAMPLE_MODEL, 256, 512)
    expect(large).toBeGreaterThan(small * 5)
    expect(small).toBeLessThan(5)
  })

  it('saturates: the cache is read once per sequence however big the batch is', () => {
    const medium = decodeArithmeticIntensity(EXAMPLE_MODEL, 64, 512)
    const large = decodeArithmeticIntensity(EXAMPLE_MODEL, 1024, 512)
    // The intensity keeps rising, but by less and less.
    expect(large).toBeGreaterThan(medium)
    expect(large / medium).toBeLessThan(medium / decodeArithmeticIntensity(EXAMPLE_MODEL, 8, 512))
  })

  it('finds the batch size at which the step becomes compute-bound', () => {
    const batch = computeBoundBatchSize(EXAMPLE_MODEL, 512)
    expect(batch).toBeGreaterThan(1)
    expect(decodeArithmeticIntensity(EXAMPLE_MODEL, batch, 512)).toBeGreaterThanOrEqual(50)
  })

  it('needs a bigger batch when the context is longer', () => {
    const short = computeBoundBatchSize(EXAMPLE_MODEL, 256)
    const long = computeBoundBatchSize(EXAMPLE_MODEL, 4096)
    expect(long).toBeGreaterThan(short)
  })

  it('wastes less memory when the allocation is paged', () => {
    const allocation = pagedAllocation(EXAMPLE_MODEL, [100, 137, 42, 511, 63], { blockSize: 16 })
    expect(allocation.paged.wasteFraction).toBeLessThan(allocation.padded.wasteFraction)
  })

  it('holds at least as many tokens as the sequences need', () => {
    const lengths = [100, 137, 42]
    const allocation = pagedAllocation(EXAMPLE_MODEL, lengths, { blockSize: 16 })
    const needed = lengths.reduce((a, b) => a + b, 0)
    const bytesPerToken = 2 * EXAMPLE_MODEL.layers * EXAMPLE_MODEL.heads * EXAMPLE_MODEL.headDimension * 2
    expect(allocation.paged.totalBytes).toBeGreaterThanOrEqual(needed * bytesPerToken)
    expect(allocation.padded.totalBytes).toBeGreaterThanOrEqual(needed * bytesPerToken)
  })
})

describe('speculative decoding', () => {
  it('accepts the tokens that match and stops at the first that does not', () => {
    expect(verify([1, 2, 3], [1, 2, 9]).accepted).toBe(2)
    expect(verify([1, 2, 3], [1, 2, 3]).accepted).toBe(3)
    expect(verify([1, 2, 3], [1, 9, 3]).corrected).toBe(9)
  })

  it('measures the acceptance rate of two distributions', () => {
    const target = [0.5, 0.3, 0.2]
    // The same distribution: everything is accepted.
    expect(acceptanceRate(target, target, { trials: 2000 })).toBeGreaterThan(0.95)
    const draft = perturbed(target, 0.3, 2)
    const rate = acceptanceRate(draft, target, { trials: 4000 })
    expect(rate).toBeLessThan(0.95)
    expect(rate).toBeGreaterThan(0)
    // And the simulation agrees with the closed form.
    expect(rate).toBeCloseTo(closedFormAcceptanceRate(draft, target), 2)
  })

  it('produces more tokens per target step than the plain method', () => {
    const target = [0.4, 0.3, 0.2, 0.1]
    const result = simulateSpeculative(target, { draftLength: 4, steps: 300, seed: 9 })
    expect(result.tokensPerStep).toBeGreaterThan(1)
    expect(result.targetSteps).toBeLessThan(result.targetTokens)
  })

  it('produces the same distribution as the target', () => {
    const target = [0.4, 0.3, 0.2, 0.1]
    const produced = speculativeDistribution(target, { seed: 5 })
    expect(totalVariation(produced, target)).toBeLessThan(1e-9)
    const measured = measuredOutputDistribution(target, { seed: 5, trials: 20000 })
    expect(totalVariation(measured, target)).toBeLessThan(0.05)
  })

  it('is faster when the draft is close to the target', () => {
    const target = [0.4, 0.3, 0.2, 0.1]
    const close = simulateSpeculative(target, { draftNoise: 0.05, steps: 300 })
    const far = simulateSpeculative(target, { draftNoise: 0.4, steps: 300 })
    expect(close.tokensPerStep).toBeGreaterThan(far.tokensPerStep)
  })
})

describe('the mixture of experts', () => {
  it('routes every token to the experts it chose', () => {
    const rng = createRng(3)
    const embeddings = Array.from({ length: 64 }, () => [rng(), rng(), rng(), rng()])
    const result = route(embeddings, { experts: 4, topK: 2, seed: 4 })
    expect(result.assignment.length).toBe(64)
    for (const chosen of result.assignment) expect(chosen.length).toBe(2)
  })

  it('sums the load fractions to one', () => {
    const rng = createRng(5)
    const embeddings = Array.from({ length: 50 }, () => [rng(), rng()])
    const result = route(embeddings, { experts: 4, topK: 1, seed: 6 })
    expect(result.load.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    expect(result.probability.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })

  it('has a larger auxiliary loss when the router is biased', () => {
    const rng = createRng(7)
    const embeddings = Array.from({ length: 200 }, () => [rng(), rng(), rng()])
    const even = route(embeddings, { experts: 4, topK: 1, seed: 8, bias: 0 })
    const biased = route(embeddings, { experts: 4, topK: 1, seed: 8, bias: 2 })
    expect(biased.auxiliaryLoss).toBeGreaterThan(even.auxiliaryLoss)
  })

  it('drops the tokens that exceed the capacity', () => {
    const overflow = capacityOverflow([0.5, 0.2, 0.2, 0.1], 1, { tokens: 100, topK: 1 })
    expect(overflow.droppedFraction).toBeGreaterThan(0)
    expect(overflow.droppedFraction).toBeLessThan(1)
  })

  it('saves the arithmetic and the parameters', () => {
    expect(sparseSpeedup(8, 2)).toBe(4)
    expect(activeParameterFraction(8, 2)).toBe(0.25)
  })
})
