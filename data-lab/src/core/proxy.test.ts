import { describe, expect, it } from 'vitest'
import { buildCorpus, DOMAINS } from './corpus'
import { extrapolateWeights, proxyTransfer, spearman, type TransferRow } from './proxy'

const corpus = buildCorpus({ seed: 17, size: 400 })
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
// both arms take a few seconds, so each seed is run once for the whole file
const seed7 = proxyTransfer(corpus, { seed: 7 })
const seed13 = proxyTransfer(corpus, { seed: 13 })

const indexOfBest = (rows: TransferRow[], pick: (row: TransferRow) => number) =>
  rows.reduce((best, row, index) => (pick(row) < pick(rows[best]!) ? index : best), 0)

/**
 * The proxy-model extrapolation step.
 *
 * DoReMi spends a small model to find a mixture and then hands it to a big one.
 * The arithmetic of the handover is exact and checked first; the claim that the
 * handover *transfers* is measured second, and at this scale it is not supported.
 * The two seeds below are the whole of the evidence, and the test reports the
 * disagreement rather than averaging it away.
 */
describe('The proxy-model extrapolation step', () => {
  it('pins the target domain and keeps the proxy’s ordering of the rest', () => {
    const proxy = [0.1, 0.2, 0.3, 0.25, 0.15]
    const out = extrapolateWeights(proxy, 4, 0.7)
    expect(out[4]).toBe(0.7)
    expect(sum(out)).toBeCloseTo(1, 12)
    expect(out[0]).toBeCloseTo(0.0353, 4)
    expect(out[1]).toBeCloseTo(0.0706, 4)
    expect(out[2]).toBeCloseTo(0.1059, 4)
    expect(out[3]).toBeCloseTo(0.0882, 4)
    // the relative order of the unpinned domains survives the handover
    const unpinned = proxy.filter((_, index) => index !== 4)
    const rest = out.filter((_, index) => index !== 4)
    expect(rest.indexOf(Math.min(...rest))).toBe(unpinned.indexOf(Math.min(...unpinned)))
    expect(rest.indexOf(Math.max(...rest))).toBe(unpinned.indexOf(Math.max(...unpinned)))
  })

  it('behaves at the two edges of the arithmetic', () => {
    expect(extrapolateWeights([0.2, 0.2, 0.2, 0.2, 0.2], 0, 1)).toEqual([1, 0, 0, 0, 0])
    // with no mass left to share, what is left over is divided equally, not by zero
    expect(extrapolateWeights([1, 0, 0, 0, 0], 0, 0.4)).toEqual([0.4, 0.15, 0.15, 0.15, 0.15])
    expect(sum(extrapolateWeights([0, 0, 0, 0.5, 0.5], 3, 0.7))).toBeCloseTo(1, 12)
    expect(() => extrapolateWeights([0.2, 0.8], 5, 0.5)).toThrow(RangeError)
    expect(() => extrapolateWeights([0.2, 0.8], -1, 0.5)).toThrow(RangeError)
  })

  it('transfers a ranking at one seed and not at the other', () => {
    expect(seed7.rows).toHaveLength(4)
    expect(seed7.rankCorrelation).toBeCloseTo(1, 6)
    expect(seed13.rankCorrelation).toBeCloseTo(0.2, 6)
    // at seed 7 both arms call the uniform mixture the best of the four
    expect(indexOfBest(seed7.rows, (row) => row.proxyWorstLoss)).toBe(3)
    expect(indexOfBest(seed7.rows, (row) => row.bigWorstLoss)).toBe(3)
    // at seed 13 the proxy still likes uniform, and the big arm likes the proxy’s
    // own group-DRO weights: the ranking that transferred at 1.000 is 0.200 here
    expect(indexOfBest(seed13.rows, (row) => row.proxyWorstLoss)).toBe(3)
    expect(indexOfBest(seed13.rows, (row) => row.bigWorstLoss)).toBe(1)
  })

  it('gains on worst-domain loss at one seed and loses at the other', () => {
    expect(seed7.worstLossGain).toBeCloseTo(-0.01, 4)
    expect(seed13.worstLossGain).toBeCloseTo(0.0566, 4)
    // which mixture the big arm prefers is not stable across seeds either
    expect(indexOfBest(seed7.rows, (row) => row.bigWorstLoss)).toBe(3)
    expect(indexOfBest(seed13.rows, (row) => row.bigWorstLoss)).toBe(1)
  })

  it('finds the extrapolated mixture the worst of the four, in both arms', () => {
    for (const result of [seed7, seed13]) {
      const extrapolated = result.rows[2]!
      expect(extrapolated.bigWorstLoss).toBeGreaterThan(result.rows[0]!.bigWorstLoss)
      expect(extrapolated.bigWorstLoss).toBeGreaterThan(result.rows[1]!.bigWorstLoss)
      expect(extrapolated.bigWorstLoss).toBeGreaterThan(result.rows[3]!.bigWorstLoss)
      expect(extrapolated.proxyWorstLoss).toBe(Math.max(...result.rows.map((row) => row.proxyWorstLoss)))
    }
    expect(seed7.extrapolatedWorstLossGain).toBeCloseTo(-0.0493, 4)
    expect(seed13.extrapolatedWorstLossGain).toBeCloseTo(-0.1298, 4)
  })

  it('hands over a distribution, not a suggestion', () => {
    expect(seed7.proxyWeights).toHaveLength(DOMAINS.length)
    expect(sum(seed7.proxyWeights)).toBeCloseTo(1, 9)
    expect(seed7.proxyWeights.every((weight) => weight > 0)).toBe(true)
    expect(sum(seed7.naturalWeights)).toBeCloseTo(1, 12)
    expect(sum(seed7.extrapolatedWeights)).toBeCloseTo(1, 9)
    expect(seed7.targetWeight).toBe(0.7)
    expect(seed7.extrapolatedWeights[DOMAINS.indexOf('reference')]).toBe(0.7)
    expect(seed7.proxyWeights.map((weight) => Number(weight.toFixed(3)))).toEqual([0.132, 0.181, 0.2, 0.25, 0.236])
    expect(seed7.extrapolatedWeights.map((weight) => Number(weight.toFixed(3)))).toEqual([
      0.052, 0.071, 0.079, 0.098, 0.7,
    ])
    expect(seed7.proxySteps).toBe(40)
    expect(seed7.bigSteps).toBe(400)
  })

  it('scores the same candidates in both arms', () => {
    const names = seed7.rows.map((row) => row.name)
    expect(names).toEqual(seed13.rows.map((row) => row.name))
    expect(names).toEqual([
      'the natural mixture',
      'the proxy’s group-DRO weights',
      'extrapolated from the proxy',
      'the uniform mixture',
    ])
    // more compute lowers the worst-domain loss of every mixture, which is the
    // only cross-arm statement this scale supports
    for (const row of seed7.rows) expect(row.bigWorstLoss).toBeLessThan(row.proxyWorstLoss)
    for (const row of seed13.rows) expect(row.bigWorstLoss).toBeLessThan(row.proxyWorstLoss)
  })
})

describe('Spearman’s rho between the two arms', () => {
  it('is one for an identical ranking and minus one for a reversed one', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 12)
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 12)
  })

  it('counts only the order, not the size of the gaps', () => {
    expect(spearman([0.1, 0.2, 0.9], [1, 2, 100])).toBeCloseTo(1, 12)
  })

  it('averages ties instead of breaking', () => {
    expect(spearman([1, 1, 2], [1, 2, 3])).toBeCloseTo(0.866, 3)
    expect(spearman([1, 2], [1, 2])).toBeCloseTo(1, 12)
    expect(spearman([5], [5])).toBe(0)
    expect(spearman([], [])).toBe(0)
  })
})
