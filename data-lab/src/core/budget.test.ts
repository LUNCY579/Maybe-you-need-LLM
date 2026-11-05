import { describe, expect, it } from 'vitest'
import { drawToBudget, perplexityPool, runBudgetStudy, type BudgetRow } from './budget'
import { buildCorpus, tokenCount } from './corpus'
import { splitCorpus } from './filters'

const byKind = (rows: BudgetRow[], kind: BudgetRow['kind']) => rows.filter((row) => row.kind === kind)
const row = (rows: BudgetRow[], kind: BudgetRow['kind'], index = 0) => byKind(rows, kind)[index]!

/**
 * Quality versus quantity under a fixed compute budget.
 *
 * Every number below was measured on this seed, not quoted from DataComp-LM. The
 * headline is the control column: at the default budget the filtered half is
 * better than the unfiltered half by 0.0018 nats, and at other budgets and seeds
 * the same comparison goes the other way. The gain the table appears to show —
 * 0.1013 nats over the full unfiltered row — is mostly the gain from taking twice
 * as many gradient steps, which is exactly what the control row exists to remove.
 */
describe('Quality versus quantity under a fixed compute budget', () => {
  const study = runBudgetStudy()

  it('holds the compute budget fixed for every row', () => {
    expect(study.tokenBudget).toBe(12_000)
    expect(study.computeVisits).toBe(10_000)
    for (const row_ of study.rows) {
      // one step visits every document, so the arithmetic is steps × documents
      expect(row_.visits).toBe(row_.steps * row_.documents)
      expect(row_.visits).toBeLessThanOrEqual(10_000 + 600)
      expect(row_.visits).toBeGreaterThan(9_000)
    }
  })

  it('draws each row to its token budget and reports the overshoot', () => {
    const rawFull = row(study.rows, 'raw')
    expect(rawFull.documents).toBe(104)
    expect(rawFull.tokens).toBe(12_071)
    // the document that crosses the budget is kept, so the row overspends by less than one document
    expect(rawFull.tokens).toBeGreaterThan(12_000)
    expect(rawFull.tokens - 12_000).toBeLessThan(115)
    expect(row(study.rows, 'filtered').documents).toBe(93)
    expect(row(study.rows, 'oracle').documents).toBe(85)
  })

  it('gives the control exactly as many documents and steps as the cheap filtered row', () => {
    const control = row(study.rows, 'control')
    const halfFiltered = row(study.rows, 'filtered', 1)
    expect(control.documents).toBe(49)
    expect(halfFiltered.documents).toBe(49)
    expect(control.steps).toBe(204)
    expect(halfFiltered.steps).toBe(control.steps)
    expect(control.visits).toBe(9_996)
    expect(halfFiltered.visits).toBe(control.visits)
  })

  it('selects better documents at the same token budget', () => {
    expect(row(study.rows, 'raw').meanQuality).toBeCloseTo(0.440, 3)
    expect(row(study.rows, 'filtered').meanQuality).toBeCloseTo(0.543, 3)
    expect(row(study.rows, 'raw').unwantedFraction).toBeCloseTo(0.115, 3)
    expect(row(study.rows, 'filtered').unwantedFraction).toBeCloseTo(0.065, 3)
    expect(row(study.rows, 'oracle').meanQuality).toBeCloseTo(0.756, 3)
    expect(row(study.rows, 'oracle').unwantedFraction).toBe(0)
  })

  it('beats the full unfiltered row at half the budget', () => {
    expect(study.lossGainAtSameBudget).toBeCloseTo(0.0223, 4)
    expect(study.lossGainAtHalfBudget).toBeCloseTo(0.1013, 4)
    expect(row(study.rows, 'raw').inDomainLoss).toBeCloseTo(0.2400, 4)
    expect(row(study.rows, 'filtered').inDomainLoss).toBeCloseTo(0.2177, 4)
    expect(row(study.rows, 'filtered', 1).inDomainLoss).toBeCloseTo(0.1387, 4)
  })

  it('finds almost nothing left once the steps are matched', () => {
    // the whole of the half-budget gain minus the quality effect is the step effect
    expect(study.lossGainAgainstControl).toBeCloseTo(0.0018, 4)
    expect(study.lossGainAgainstControl).toBeLessThan(study.lossGainAtHalfBudget / 20)
  })

  it('loses the quality effect when the compute budget grows', () => {
    const longer = runBudgetStudy({ computeVisits: 30_000 })
    expect(longer.lossGainAtSameBudget).toBeCloseTo(-0.0133, 4)
    expect(longer.lossGainAgainstControl).toBeCloseTo(-0.0083, 4)
    expect(row(longer.rows, 'control').steps).toBe(612)
    expect(row(longer.rows, 'raw').steps).toBe(288)
  })

  it('loses it again at a smaller token budget', () => {
    const tight = runBudgetStudy({ tokenBudget: 6_000 })
    expect(tight.lossGainAtHalfBudget).toBeCloseTo(0.0429, 4)
    expect(tight.lossGainAgainstControl).toBeCloseTo(-0.0105, 4)
    expect(row(tight.rows, 'control').documents).toBe(24)
    expect(row(tight.rows, 'filtered', 1).documents).toBe(24)
  })

  it('moves sign between seeds, which is why the claim is not a claim', () => {
    const gains = [17, 23, 31].map((seed) => runBudgetStudy({ seed }).lossGainAgainstControl)
    expect(gains[0]).toBeCloseTo(0.0018, 4)
    expect(gains[1]).toBeCloseTo(-0.0012, 4)
    expect(gains[2]).toBeCloseTo(-0.0445, 4)
    expect(gains.filter((gain) => gain > 0).length).toBe(1)
  })

  it('scores the two evaluation sets in opposite directions', () => {
    expect(study.heldOut).toEqual({ documents: 120, inDomain: 98 })
    for (const row_ of study.rows) {
      // the in-domain set has no boilerplate to get wrong, so every row saturates it
      expect(row_.inDomainAccuracy).toBeCloseTo(1, 6)
      expect(row_.accuracy).toBeLessThan(0.9)
    }
    expect(row(study.rows, 'raw').accuracy).toBeCloseTo(0.867, 3)
    expect(row(study.rows, 'filtered').accuracy).toBeCloseTo(0.850, 3)
  })
})

describe('drawing a corpus to a token budget', () => {
  const corpus = buildCorpus({ seed: 5, size: 120 })

  it('keeps the pool order and stops once the budget is spent', () => {
    const drawn = drawToBudget(corpus.documents, 1_000)
    expect(drawn.documents.length).toBeLessThan(corpus.documents.length)
    expect(drawn.documents.map((document) => document.id)).toEqual(
      corpus.documents.slice(0, drawn.documents.length).map((document) => document.id),
    )
    const withoutLast = drawn.documents.slice(0, -1)
    expect(withoutLast.reduce((sum, document) => sum + tokenCount(document), 0)).toBeLessThan(1_000)
    expect(drawn.tokens).toBe(withoutLast.reduce((sum, d) => sum + tokenCount(d), 0) + tokenCount(drawn.documents.at(-1)!))
  })

  it('returns nothing when the budget is already spent', () => {
    expect(drawToBudget(corpus.documents, 0).documents).toEqual([])
    const all = drawToBudget(corpus.documents, 10 ** 9)
    expect(all.documents.length).toBe(corpus.documents.length)
  })
})

describe('the perplexity pool', () => {
  const corpus = buildCorpus({ seed: 17, size: 400 })
  const { train, test } = splitCorpus(corpus, 0.3)
  const testIds = new Set(test.map((document) => document.id))
  const pool = train.filter((document) => !testIds.has(document.id))

  it('drops the fraction it was asked to drop, in the pool’s own order', () => {
    expect(pool.length).toBe(280)
    const pruned = perplexityPool(pool, 0.4)
    expect(pruned.kept.length).toBe(168)
    const positions = pruned.kept.map((document) => pool.indexOf(document))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(pruned.threshold).toBeCloseTo(11.16, 2)
  })

  it('catches every unseen-language document and half the boilerplate', () => {
    const of = (documents: typeof pool) => documents.filter((document) => document.isSpam || document.isForeign).length
    const pruned = perplexityPool(pool, 0.4)
    const keptIds = new Set(pruned.kept.map((document) => document.id))
    const dropped = pool.filter((document) => !keptIds.has(document.id))
    expect(of(pool)).toBe(32)
    expect(of(dropped)).toBe(25)
    expect(of(pruned.kept)).toBe(7)
    expect(pruned.kept.filter((document) => document.isForeign)).toHaveLength(0)
    expect(pruned.kept.filter((document) => document.isSpam)).toHaveLength(7)
    expect(dropped.filter((document) => document.isForeign)).toHaveLength(20)
  })

  it('raises the mean quality as it throws more away', () => {
    const quality = (documents: typeof pool) =>
      documents.reduce((sum, document) => sum + document.quality, 0) / documents.length
    for (const [prune, expected] of [
      [0.2, 0.5052],
      [0.4, 0.5806],
      [0.6, 0.6821],
    ] as [number, number][]) {
      const pruned = perplexityPool(pool, prune)
      expect(quality(pruned.kept)).toBeCloseTo(expected, 4)
    }
  })
})
