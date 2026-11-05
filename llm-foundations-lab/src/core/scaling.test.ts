import { describe, expect, it } from 'vitest'
import {
  CHINCHILLA_ALLOCATION,
  LLAMA_MODELS,
  compareToOptimal,
  optimalAllocation,
  trainingCompute,
} from './scaling'

describe('the Chinchilla allocation', () => {
  it('anchors on the published 70B run and its twenty tokens per parameter', () => {
    const anchor = optimalAllocation(CHINCHILLA_ALLOCATION.anchorCompute)
    expect(anchor.params).toBeCloseTo(70e9, -6)
    expect(anchor.tokens).toBeCloseTo(1.4e12, -6)
    expect(anchor.ratio).toBeCloseTo(20, 9)
  })

  it('spends every budget exactly, because the two exponents sum to one', () => {
    for (const compute of [1e21, 4.2e22, 5.76e23, 1e25]) {
      const allocation = optimalAllocation(compute)
      expect(trainingCompute(allocation.params, allocation.tokens) / compute).toBeCloseTo(1, 6)
    }
  })

  it('grows parameters more slowly than tokens as the budget rises', () => {
    const small = optimalAllocation(1e21)
    const large = optimalAllocation(1e23)
    expect(large.params).toBeGreaterThan(small.params)
    expect(large.tokens).toBeGreaterThan(small.tokens)
    expect(large.params / small.params).toBeCloseTo(Math.pow(100, 0.46), 6)
    expect(large.tokens / small.tokens).toBeCloseTo(Math.pow(100, 0.54), 6)
  })

  it('keeps the token ratio near twenty across the plausible compute range', () => {
    for (const compute of [1e21, 1e22, 1e23, 1e24, 1e25]) {
      const ratio = optimalAllocation(compute).ratio
      expect(ratio).toBeGreaterThan(10)
      expect(ratio).toBeLessThan(30)
    }
  })

  it('places the small LLaMA models far past the allocation and the 65B almost on it', () => {
    const comparisons = compareToOptimal()
    expect(comparisons.length).toBe(LLAMA_MODELS.length)
    for (const model of comparisons) expect(model.ratio).toBeGreaterThan(20)

    const seven = comparisons[0]!
    expect(seven.ratio).toBeCloseTo(1e12 / 6.7e9, 6)
    expect(seven.optimalRatio).toBeLessThan(20)
    expect(seven.ratioMultiple).toBeGreaterThan(4)

    const sixtyFive = comparisons[3]!
    expect(sixtyFive.ratioMultiple).toBeGreaterThan(0.8)
    expect(sixtyFive.ratioMultiple).toBeLessThan(1.1)
  })
})
