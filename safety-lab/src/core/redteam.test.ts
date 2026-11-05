import { describe, expect, it } from 'vitest'
import {
  budgetFor,
  buildFailures,
  discoveryCurve,
  expectedDiscovery,
  marginalDiscovery,
  runSearch,
  sampleDiscovery,
  searchCurve,
  SEARCH_POLICIES,
  unguidedExpectation,
  type Failure,
} from './redteam'

const easy: Failure = { id: 'easy', category: 'harm', reachability: 0.5 }
const hard: Failure = { id: 'hard', category: 'privacy', reachability: 0.05 }
const board = buildFailures(12, 8)

describe('the ideal search', () => {
  it('is the per-failure complement, averaged', () => {
    expect(expectedDiscovery([easy], 1)).toBeCloseTo(0.5, 12)
    expect(expectedDiscovery([easy], 2)).toBeCloseTo(0.75, 12)
    expect(expectedDiscovery([easy, hard], 1)).toBeCloseTo((0.5 + 0.05) / 2, 12)
    expect(expectedDiscovery([easy], 0)).toBe(0)
    expect(expectedDiscovery([], 10)).toBe(0)
    expect(expectedDiscovery([{ ...easy, reachability: 1 }], 1)).toBe(1)
  })

  it('rises and flattens, never overshooting one', () => {
    let previous = 0
    for (let attempts = 0; attempts <= 40; attempts++) {
      const rate = expectedDiscovery(board, attempts)
      expect(rate).toBeGreaterThanOrEqual(previous)
      expect(rate).toBeLessThanOrEqual(1)
      previous = rate
    }
    expect(expectedDiscovery(board, 200)).toBeGreaterThan(0.99)
  })

  it('is what the sampler finds, to within noise', () => {
    // A board of 240 so that one attempt per failure is 240 draws rather than
    // twelve, and the disagreement between the arithmetic and the sample is
    // actually noise instead of the whole signal.
    const big = buildFailures(240, 8)
    for (const row of discoveryCurve(big, [1, 2, 4, 8, 16, 32], { seed: 3 })) {
      expect(Math.abs(row.observed - row.expected)).toBeLessThan(0.06)
      expect(row.expected).toBe(expectedDiscovery(big, row.attempts))
    }
  })

  it('spends its sample on the failures it has not found yet', () => {
    const run = sampleDiscovery(board, 8, { seed: 4 })
    expect(run.total).toBe(board.length * 8)
    expect(run.discovered).toBeGreaterThan(0)
    expect(run.rate).toBe(run.discovered / board.length)
    expect(sampleDiscovery([], 4).rate).toBe(0)
  })
})

describe('the budget', () => {
  it('gives the cost of a target rather than the shape of a curve', () => {
    expect(budgetFor(board, 0)).toBe(0)
    const half = budgetFor(board, 0.5)
    const most = budgetFor(board, 0.9)
    expect(most).toBeGreaterThan(half)
    expect(expectedDiscovery(board, half)).toBeGreaterThanOrEqual(0.5)
    expect(expectedDiscovery(board, half - 1)).toBeLessThan(0.5)
    expect(expectedDiscovery(board, most)).toBeGreaterThanOrEqual(0.9)
  })

  it('caps out at the limit when the target cannot be reached', () => {
    expect(budgetFor([hard], 0.999999, 20)).toBe(20)
  })

  it('declines: the next attempt buys less than the last', () => {
    const gains = [1, 2, 4, 8, 16, 32].map((attempts) => marginalDiscovery(board, attempts))
    for (let i = 1; i < gains.length; i++) expect(gains[i]!).toBeLessThan(gains[i - 1]!)
    expect(gains[0]!).toBeGreaterThan(0.05)
    expect(gains[gains.length - 1]!).toBeLessThan(0.01)
    // And a marginal gain is exactly the difference of two budgets.
    expect(marginalDiscovery(board, 5)).toBeCloseTo(expectedDiscovery(board, 6) - expectedDiscovery(board, 5), 12)
  })
})

describe('a total, spread or not', () => {
  it('is better spent evenly than clustered', () => {
    for (const total of [12, 24, 60, 120]) {
      const evenly = expectedDiscovery(board, total / board.length)
      const clustered = unguidedExpectation(board, total)
      expect(evenly).toBeGreaterThanOrEqual(clustered)
      expect(clustered).toBeGreaterThan(0)
    }
    expect(unguidedExpectation([], 50)).toBe(0)
    expect(unguidedExpectation([easy], 4)).toBeCloseTo(expectedDiscovery([easy], 4), 12)
  })

  it('reaches more when it looks for what is missing', () => {
    const rows = searchCurve(board, [24, 48, 96, 192], SEARCH_POLICIES, { repetitions: 200 })
    for (const row of rows) {
      const unguided = row.searches.find((search) => search.id === 'unguided')!
      const guided = row.searches.find((search) => search.id === 'guided')!
      expect(guided.rate).toBeGreaterThan(unguided.rate)
      expect(guided.rehits).toBeLessThan(unguided.rehits)
      expect(row.ideal).toBeGreaterThanOrEqual(row.unguided)
      // The guided search is the one that has to live up to the ideal: it spends
      // only on failures it has not found, so it should not fall far short.
      expect(guided.rate).toBeGreaterThan(row.unguided)
    }
    expect(rows[rows.length - 1]!.searches[1]!.rate).toBeGreaterThan(rows[0]!.searches[1]!.rate)
    // And the advantage grows with the budget, because the unguided search spends
    // an ever larger share of it on failures it already knows about.
    const gain = rows.map((row) => row.searches[1]!.rate - row.searches[0]!.rate)
    for (let i = 1; i < gain.length; i++) expect(gain[i]!).toBeGreaterThan(gain[i - 1]!)
  })

  it('spends nothing on a failure it already has', () => {
    // The guided policy's whole mechanism in one column: while there is
    // something left to aim at, not one of its attempts is a re-hit.
    for (let seed = 1; seed <= 20; seed++) {
      for (const total of [12, 24]) {
        expect(runSearch(board, total, SEARCH_POLICIES[1]!, { seed }).rehits).toBe(0)
        expect(runSearch(board, total, SEARCH_POLICIES[0]!, { seed }).dryAttempts).toBeGreaterThan(0)
      }
    }
  })

  it('keeps the budget honest: every attempt is one of three things', () => {
    for (const policy of SEARCH_POLICIES) {
      for (const total of [0, 12, 60, 240]) {
        const run = runSearch(board, total, policy, { seed: 3 })
        expect(run.wasted).toBe(run.rehits + run.dryAttempts)
        expect(run.total).toBe(run.discovered + run.wasted)
        expect(run.rate).toBe(run.discovered / board.length)
      }
    }
    const even = sampleDiscovery(board, 6, { seed: 2 })
    expect(even.total).toBe(even.discovered + even.wasted)
    expect(even.wasted).toBe(even.rehits + even.dryAttempts)
  })

  it('runs out of things to find, and counts that as waste', () => {
    const only = [{ id: 'one', category: 'harm', reachability: 1 }]
    const run = runSearch(only, 10, { id: 'guided', targetsUnreached: true }, { seed: 1 })
    expect(run.discovered).toBe(1)
    expect(run.rate).toBe(1)
    expect(run.wasted).toBe(9)
    expect(run.rehits).toBe(9)
    expect(run.dryAttempts).toBe(0)
    expect(run.total).toBe(10)
  })

  it('is the same search for the same seed', () => {
    const a = runSearch(board, 48, SEARCH_POLICIES[0]!, { seed: 9 })
    const b = runSearch(board, 48, SEARCH_POLICIES[0]!, { seed: 9 })
    expect(a).toEqual(b)
    expect(runSearch(board, 0, SEARCH_POLICIES[1]!).discovered).toBe(0)
  })
})

describe('the board', () => {
  it('is skewed: a few failures are easy to stumble into', () => {
    expect(board).toHaveLength(12)
    expect(board.filter((failure) => failure.reachability > 0.25).length).toBeGreaterThan(0)
    expect(board.every((failure) => failure.reachability > 0 && failure.reachability < 1)).toBe(true)
    const mean = board.reduce((sum, failure) => sum + failure.reachability, 0) / board.length
    expect(mean).toBeLessThan(0.3)
    expect(Math.max(...board.map((failure) => failure.reachability))).toBeGreaterThan(2 * mean)
  })

  it('is drawn from the taxonomy, so a category count means something', () => {
    expect(new Set(board.map((failure) => failure.category)).size).toBeGreaterThan(3)
    expect(buildFailures(6, 8)).toHaveLength(6)
  })
})
