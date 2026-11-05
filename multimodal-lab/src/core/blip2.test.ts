import { describe, expect, it } from 'vitest'
import {
  OPT_6_7B,
  VIT_BASE,
  bridgeAttention,
  parameterBudget,
  patchEmbeddings,
  queryEmbeddings,
  queryReport,
} from './blip2'

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

describe('the patch and query embeddings', () => {
  it('have the requested shape and are deterministic in the seed', () => {
    const patches = patchEmbeddings({ patches: 12, width: 6, seed: 3 })
    expect(patches.length).toBe(12)
    expect(patches.every((row) => row.length === 6)).toBe(true)
    expect(patchEmbeddings({ patches: 12, width: 6, seed: 3 })).toEqual(patches)
    expect(patchEmbeddings({ patches: 12, width: 6, seed: 4 })).not.toEqual(patches)
  })

  it('keeps the queries distinct from the patches', () => {
    const options = { queries: 8, patches: 8, width: 4, seed: 5 }
    expect(queryEmbeddings(options)).not.toEqual(patchEmbeddings(options))
  })
})

describe('the bridge attention', () => {
  const options = { queries: 6, patches: 10, width: 8, temperature: 0.2, seed: 2 }

  it('has one distribution over the patches per query', () => {
    const attention = bridgeAttention(options)
    expect(attention.length).toBe(6)
    for (const row of attention) {
      expect(row.length).toBe(10)
      expect(row.every((weight) => weight >= 0 && weight <= 1)).toBe(true)
      expect(sum(row)).toBeCloseTo(1, 12)
    }
  })

  it('is deterministic in the seed', () => {
    expect(bridgeAttention(options)).toEqual(bridgeAttention(options))
  })

  it('sharpens as the temperature falls', () => {
    const cold = queryReport(bridgeAttention({ ...options, temperature: 0.05 })[0] ?? [])
    const warm = queryReport(bridgeAttention({ ...options, temperature: 1 })[0] ?? [])
    expect(cold.topWeight).toBeGreaterThan(warm.topWeight)
    expect(cold.entropy).toBeLessThan(warm.entropy)
  })

  it('still has a distribution when the width changes', () => {
    const attention = bridgeAttention({ ...options, width: 32 })
    for (const row of attention) expect(sum(row)).toBeCloseTo(1, 12)
  })
})

describe('the query report', () => {
  it('finds the largest weight', () => {
    const report = queryReport([0.1, 0.6, 0.3])
    expect(report.topPatch).toBe(1)
    expect(report.topWeight).toBe(0.6)
    expect(report.maximumEntropy).toBeCloseTo(Math.log(3), 12)
  })

  it('gives a uniform attention the maximum entropy and no clear winner', () => {
    const report = queryReport([0.25, 0.25, 0.25, 0.25])
    expect(report.entropy).toBeCloseTo(Math.log(4), 12)
    expect(report.aboveChance).toBe(0)
    expect(report.topWeight).toBe(0.25)
  })

  it('counts the patches above twice the uniform share', () => {
    expect(queryReport([0.3, 0.3, 0.08, 0.08, 0.08, 0.08, 0.08, 0]).aboveChance).toBe(2)
  })

  it('handles an empty row', () => {
    expect(queryReport([]).topPatch).toBe(-1)
  })
})

describe('the parameter bill', () => {
  it('accounts for the queries, one attention block and the projection', () => {
    const budget = parameterBudget({ width: 64, queries: 16, vocabulary: 32000 })
    expect(budget.queryParameters).toBe(16 * 64)
    expect(budget.attentionParameters).toBe(4 * 64 * 64)
    expect(budget.projectionParameters).toBe(64 * 32000)
    expect(budget.trainable).toBe(16 * 64 + 4 * 64 * 64 + 64 * 32000)
  })

  it('leaves the frozen towers alone as the bridge grows', () => {
    const narrow = parameterBudget({ width: 32 })
    const wide = parameterBudget({ width: 256 })
    expect(narrow.frozen).toBe(wide.frozen)
    expect(wide.trainable).toBeGreaterThan(narrow.trainable)
    expect(wide.share).toBeGreaterThan(narrow.share)
  })

  it('is a small fraction of the whole at the assumed sizes', () => {
    const budget = parameterBudget()
    expect(budget.frozen).toBe(VIT_BASE + OPT_6_7B)
    expect(budget.trainable).toBe(2_065_408)
    expect(budget.share).toBeLessThan(0.001)
    expect(budget.share).toBeGreaterThan(0)
  })

  it('matches the worked example in the equation reference', () => {
    expect(parameterBudget().share * 100).toBeCloseTo(0.03, 3)
  })

  it('uses the paper-scale tower sizes as the default assumption', () => {
    expect(VIT_BASE).toBe(86_000_000)
    expect(OPT_6_7B).toBe(6_700_000_000)
  })
})
