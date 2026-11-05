import { describe, expect, it } from 'vitest'
import { indexMemory, memoryReport, parametricMemory } from './memory'

describe('the two memories', () => {
  it('counts the bytes of the weights and of the index', () => {
    expect(parametricMemory(7e9, 2)).toBe(14e9)
    expect(indexMemory(21e6, 768, 4)).toBe(64_512_000_000)
  })

  it('reports the ratio of the two and where they cross over', () => {
    const report = memoryReport()
    expect(report.parametricGB).toBe(14)
    expect(report.nonParametricGB).toBeCloseTo(64.512, 6)
    expect(report.ratio).toBeCloseTo(4.608, 6)
    expect(report.crossoverPassages).toBeCloseTo(4_557_291.667, 2)
  })

  it('moves the crossover with the precision of the weights', () => {
    const half = memoryReport({ bytesPerParameter: 1 })
    const full = memoryReport({ bytesPerParameter: 2 })
    expect(half.crossoverPassages).toBeCloseTo(full.crossoverPassages / 2, 6)
  })

  it('refuses a memory of nothing', () => {
    expect(() => parametricMemory(0)).toThrow(RangeError)
    expect(() => indexMemory(10, 0)).toThrow(RangeError)
    expect(() => memoryReport({ bytesPerValue: -4 })).toThrow(RangeError)
  })
})
