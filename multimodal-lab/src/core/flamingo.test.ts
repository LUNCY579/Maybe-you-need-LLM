import { describe, expect, it } from 'vitest'
import {
  attentionCost,
  latentVectors,
  resamplerAttention,
  resamplerOutput,
  resamplerReport,
  resolutionSweep,
  tokenBound,
  visualTokenCount,
  visualTokens,
} from './flamingo'

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

describe('the visual tokens', () => {
  it('grow with the square of the resolution', () => {
    expect(visualTokenCount(224, 14)).toBe(256)
    expect(visualTokenCount(448, 14)).toBe(1024)
    expect(visualTokenCount(896, 14)).toBe(4096)
    expect(visualTokenCount(1792, 14)).toBe(16384)
  })

  it('uses the patch size as the unit', () => {
    expect(visualTokenCount(224, 16)).toBe(196)
    expect(visualTokenCount(32, 16)).toBe(4)
  })

  it('throws on a non-positive size', () => {
    expect(() => visualTokenCount(0)).toThrow(RangeError)
    expect(() => visualTokenCount(224, 0)).toThrow(RangeError)
  })

  it('are deterministic in the seed and keep the requested shape', () => {
    const tokens = visualTokens({ tokens: 10, width: 6, seed: 3 })
    expect(tokens.length).toBe(10)
    expect(tokens.every((row) => row.length === 6)).toBe(true)
    expect(visualTokens({ tokens: 10, width: 6, seed: 3 })).toEqual(tokens)
    expect(latentVectors({ latents: 10, width: 6, seed: 3 })).not.toEqual(tokens)
  })
})

describe('the resampler attention', () => {
  const options = { latents: 8, tokens: 40, width: 16, temperature: 0.2, seed: 5 }

  it('has one distribution over the tokens per latent', () => {
    const attention = resamplerAttention(options)
    expect(attention.length).toBe(8)
    for (const row of attention) {
      expect(row.length).toBe(40)
      expect(row.every((weight) => weight >= 0 && weight <= 1)).toBe(true)
      expect(sum(row)).toBeCloseTo(1, 12)
    }
  })

  it('is deterministic in the seed', () => {
    expect(resamplerAttention(options)).toEqual(resamplerAttention(options))
  })

  it('sharpens as the temperature falls', () => {
    const cold = resamplerReport(resamplerAttention({ ...options, temperature: 0.05 })[0] ?? [])
    const warm = resamplerReport(resamplerAttention({ ...options, temperature: 1 })[0] ?? [])
    expect(cold.topWeight).toBeGreaterThan(warm.topWeight)
    expect(cold.entropy).toBeLessThan(warm.entropy)
  })
})

describe('the resampler output', () => {
  it('has one vector per latent, whatever the number of tokens', () => {
    const few = resamplerOutput({ latents: 12, tokens: 16, width: 8, seed: 1 })
    const many = resamplerOutput({ latents: 12, tokens: 512, width: 8, seed: 1 })
    expect(few.length).toBe(12)
    expect(many.length).toBe(12)
    expect(few[0]?.length).toBe(8)
    expect(many[0]?.length).toBe(8)
  })

  it('is a convex combination of the token vectors, coordinate by coordinate', () => {
    const options = { latents: 6, tokens: 24, width: 10, seed: 2 }
    const tokens = visualTokens(options)
    const output = resamplerOutput(options)
    for (let index = 0; index < 10; index++) {
      const column = tokens.map((token) => token[index] ?? 0)
      const low = Math.min(...column)
      const high = Math.max(...column)
      for (const vector of output) {
        expect(vector[index]).toBeGreaterThanOrEqual(low - 1e-12)
        expect(vector[index]).toBeLessThanOrEqual(high + 1e-12)
      }
    }
  })
})

describe('the bound', () => {
  it('is the number of latents, not the number of tokens', () => {
    const bound = tokenBound({ latents: 32, tokens: 12544 })
    expect(bound.outputTokens).toBe(32)
    expect(bound.inputTokens).toBe(12544)
    expect(bound.compression).toBe(12544 / 32)
  })

  it('holds at every resolution while the visual tokens grow four-fold', () => {
    const sweep = resolutionSweep(32)
    expect(sweep.map((point) => point.visualTokens)).toEqual([256, 1024, 4096, 16384])
    expect(sweep.every((point) => point.resampledTokens === 32)).toBe(true)
    expect(sweep[3]!.compression).toBeGreaterThan(sweep[0]!.compression * 60)
  })

  it('reports the patch grid alongside the token count', () => {
    expect(resolutionSweep(16, [224], 16)[0]).toEqual({
      resolution: 224,
      patchSize: 16,
      grid: 14,
      visualTokens: 196,
      resampledTokens: 16,
      compression: 196 / 16,
    })
  })
})

describe('the cost of the two paths', () => {
  it('is linear in the tokens for the resampler and quadratic for self-attention', () => {
    const narrow = attentionCost(64, 16, 32)
    const wide = attentionCost(128, 16, 32)
    expect(narrow.crossAttention).toBe(16 * 64 * 32)
    expect(narrow.tokenSelfAttention).toBe(64 * 64 * 32)
    expect(wide.crossAttention).toBe(narrow.crossAttention * 2)
    expect(wide.tokenSelfAttention).toBe(narrow.tokenSelfAttention * 4)
  })

  it('has ratio latents over tokens, and one when there is one latent per token', () => {
    expect(attentionCost(1024, 32, 64).ratio).toBeCloseTo(32 / 1024, 12)
    expect(attentionCost(64, 64, 64).ratio).toBeCloseTo(1, 12)
  })

  it('throws on a negative size', () => {
    expect(() => attentionCost(-1, 8, 8)).toThrow(RangeError)
  })
})

describe('the report on one latent', () => {
  it('finds the largest weight and the entropy ceiling', () => {
    const report = resamplerReport([0.5, 0.25, 0.25])
    expect(report.topToken).toBe(0)
    expect(report.topWeight).toBe(0.5)
    expect(report.entropy).toBeCloseTo(-(0.5 * Math.log(0.5) + 2 * 0.25 * Math.log(0.25)), 12)
    expect(report.maximumEntropy).toBeCloseTo(Math.log(3), 12)
  })

  it('gives a uniform attention no clear winner', () => {
    const report = resamplerReport([0.25, 0.25, 0.25, 0.25])
    expect(report.aboveChance).toBe(0)
    expect(report.entropy).toBeCloseTo(Math.log(4), 12)
  })

  it('handles an empty row', () => {
    expect(resamplerReport([]).topToken).toBe(-1)
  })
})
