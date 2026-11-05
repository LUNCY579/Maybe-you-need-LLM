import { describe, expect, it } from 'vitest'
import { buildCorpus, duplicateFraction, meanQuality, type Document } from './corpus'
import { DEFAULT_FILTERS, ablationCurve, ablationPipeline, evaluateFixedHeldOut, evaluatePipeline, runPipeline } from './filters'

const corpus = buildCorpus({ seed: 17, size: 300 })
const unwanted = (documents: Document[]) => documents.filter((document) => document.isSpam || document.isForeign).length
const ids = (documents: Document[]) => new Set(documents.map((document) => document.id))

/**
 * A full filtering pipeline as a benchmark.
 *
 * The claim DataComp makes is that the pipeline, not any single filter, is the
 * unit of evaluation: you score the data a pipeline produced by training on it.
 * This is that arrangement at 300 documents, and every number below is the
 * corpus's own — including the two evaluations, which disagree, and the ablation
 * row whose sign depends on which of them is quoted.
 */
describe('A full filtering pipeline as a benchmark', () => {
  const result = runPipeline(corpus)
  const evaluation = evaluatePipeline(corpus, result, { steps: 150 })

  it('runs the cheap filters first and the expensive ones last', () => {
    expect(result.stages).toEqual([
      { name: 'the length filter', before: 300, after: 300 },
      { name: 'the perplexity filter', before: 300, after: 279 },
      { name: 'the deduplication filter', before: 279, after: 273 },
    ])
    expect(result.kept).toHaveLength(273)
    expect(result.deduplication?.removed).toHaveLength(6)
  })

  it('leaves the domain and alignment filters off, and says so', () => {
    expect(DEFAULT_FILTERS.keepDomains).toBeNull()
    expect(DEFAULT_FILTERS.minAlignment).toBe(-1)
    expect(result.stages.map((stage) => stage.name)).not.toContain('the domain filter')
    expect(result.stages.map((stage) => stage.name)).not.toContain('the alignment filter')
  })

  it('raises quality and lowers junk without pretending either is the score', () => {
    expect(meanQuality(corpus.documents)).toBeCloseTo(0.4093, 4)
    expect(result.meanQuality).toBeCloseTo(0.4393, 4)
    expect(unwanted(corpus.documents)).toBe(42)
    expect(unwanted(result.kept)).toBe(20)
    expect(duplicateFraction(corpus.documents)).toBeCloseTo(0.1233, 4)
    expect(duplicateFraction(result.kept)).toBeCloseTo(0.1172, 4)
  })

  it('attributes the perplexity stage exactly', () => {
    const withoutPerplexity = runPipeline(corpus, { maxPerplexity: Number.MAX_SAFE_INTEGER, removeDuplicates: false })
    const withPerplexity = runPipeline(corpus, { removeDuplicates: false })
    const removed = withoutPerplexity.kept.filter((document) => !ids(withPerplexity.kept).has(document.id))
    expect(withoutPerplexity.kept).toHaveLength(300)
    expect(withPerplexity.kept).toHaveLength(279)
    expect(removed).toHaveLength(21)
    // every document the perplexity stage removed is an unseen-language one
    expect(removed.every((document) => document.isForeign)).toBe(true)
    expect(removed.filter((document) => document.isSpam)).toHaveLength(0)
    // precision one, recall one: the pool has exactly 21 foreign documents
    expect(unwanted(corpus.documents) - unwanted(withPerplexity.kept)).toBe(21)
  })

  it('trains a model on the survivors and reports what it can do', () => {
    expect(evaluation.kept).toBe(273)
    expect(evaluation.accuracy).toBeCloseTo(0.9, 6)
    expect(evaluation.loss).toBeCloseTo(0.3272, 4)
    expect(evaluation.perDomainAccuracy.map((value) => Number(value.toFixed(3)))).toEqual([
      0.929, 0.875, 0.938, 0.824, 0.941,
    ])
  })

  it('scores the same model on the held-out set the filter did not choose', () => {
    const fixed = evaluateFixedHeldOut(corpus, result.kept, { steps: 150 })
    expect(fixed.heldOut).toBe(90)
    // the filter deleted ten of the held-out questions along with ten of the answers
    expect(fixed.heldOutRemoved).toBe(10)
    expect(fixed.accuracy).toBe(77 / 90)
    expect(fixed.loss).toBeCloseTo(0.406, 4)
    expect(fixed.accuracy).toBeLessThan(evaluation.accuracy)
  })

  it('shows the in-domain set is saturated and therefore useless here', () => {
    const inDomain = evaluateFixedHeldOut(corpus, result.kept, { steps: 150, inDomainOnly: true })
    expect(inDomain.heldOut).toBe(75)
    expect(inDomain.accuracy).toBeCloseTo(1, 6)
    expect(inDomain.loss).toBeCloseTo(0.1489, 4)
    expect(inDomain.heldOutRemoved).toBe(4)
  })
})

/**
 * Per-filter ablation curves.
 *
 * Two questions, one table: does the filter help, and at what setting. Both are
 * answered twice — once on the held-out documents the pipeline left in place, and
 * once on all of them — and the perplexity row is the reason the second column
 * exists.
 */
describe('Per-filter ablation curves', () => {
  const ablation = ablationPipeline(corpus, {}, { training: { steps: 150 } })

  it('removes one filter at a time and reports every row', () => {
    expect(ablation.full.accuracy).toBeCloseTo(0.9, 6)
    expect(ablation.fullFixed.accuracy).toBe(77 / 90)
    // ranked by the second column, which is the column the item asks about
    expect(ablation.rows.map((row) => row.removed)).toEqual([
      'the length filter',
      'the domain filter',
      'the alignment filter',
      'the deduplication filter',
      'the perplexity filter',
    ])
    expect(ablation.rows.map((row) => Number(row.deltaOnFullHeldOut.toFixed(4)))).toEqual([
      0, 0, 0, 0, 0.0222,
    ])
    // the first column, by contrast, puts the same row at the *top* and with the
    // opposite sign: sorted by `delta`, the perplexity filter would be the first
    // row at -0.0279. The two columns disagree about the one filter that moved.
    expect(ablation.rows.map((row) => Number(row.delta.toFixed(4)))).toEqual([0, 0, 0, 0.0048, -0.0279])
  })

  it('keeps the filters that were never on visible, at exactly zero', () => {
    const inactive = ablation.rows.filter((row) => !row.active)
    expect(inactive.map((row) => row.removed)).toEqual(['the domain filter', 'the alignment filter'])
    for (const row of inactive) {
      expect(row.delta).toBe(0)
      expect(row.deltaOnFullHeldOut).toBe(0)
      expect(row.kept).toBe(273)
    }
    expect(ablation.rows.filter((row) => row.active)).toHaveLength(3)
  })

  it('finds the same filter helping and hurting depending on the evaluation set', () => {
    const perplexity = ablation.rows.find((row) => row.removed === 'the perplexity filter')!
    expect(perplexity.kept).toBe(294)
    expect(perplexity.accuracy).toBeCloseTo(0.872, 3)
    expect(perplexity.delta).toBeCloseTo(-0.0279, 4)
    expect(perplexity.accuracyOnFullHeldOut).toBeCloseTo(0.878, 3)
    expect(perplexity.deltaOnFullHeldOut).toBeCloseTo(0.0222, 4)
    // switching the filter off puts 21 foreign documents back into training, and
    // 10 back into the held-out set the surviving-only score is computed on
    expect(perplexity.meanQuality).toBeCloseTo(0.4115, 4)
  })

  it('shows deduplication buying nothing on either score', () => {
    const deduplication = ablation.rows.find((row) => row.removed === 'the deduplication filter')!
    expect(deduplication.kept).toBe(279)
    expect(deduplication.delta).toBeCloseTo(0.0048, 4)
    expect(deduplication.deltaOnFullHeldOut).toBe(0)
    expect(deduplication.active).toBe(true)
  })

  it('sweeps the perplexity threshold and finds it already past the junk', () => {
    const curve = ablationCurve(corpus, 'maxPerplexity', [20, 40, 80, 120, 400], { training: { steps: 150 } })
    expect(curve.filter).toBe('maxPerplexity')
    expect(curve.points.map((point) => point.kept)).toEqual([227, 266, 271, 273, 277])
    expect(curve.points.map((point) => Number(point.accuracy.toFixed(3)))).toEqual([0.938, 0.923, 0.911, 0.9, 0.9])
    expect(curve.points.map((point) => Number(point.accuracyOnFullHeldOut.toFixed(3)))).toEqual([
      0.889, 0.856, 0.856, 0.856, 0.856,
    ])
    expect(curve.points.map((point) => point.heldOutRemoved)).toEqual([25, 12, 11, 10, 10])
    expect(curve.points.map((point) => Number(point.delta.toFixed(4)))).toEqual([0.0333, 0, 0, 0, 0])
    expect(curve.points[0]!.meanQuality).toBeCloseTo(0.4957, 4)
    expect(curve.points.at(-1)!.meanQuality).toBeCloseTo(0.4337, 4)
  })

  it('catches a length filter that scores a perfect model by deleting the questions', () => {
    const curve = ablationCurve(corpus, 'minTokens', [0, 45, 80, 120, 160], { training: { steps: 150 } })
    expect(curve.points.map((point) => point.kept)).toEqual([273, 270, 220, 119, 44])
    expect(curve.points.map((point) => Number(point.accuracy.toFixed(3)))).toEqual([0.9, 0.911, 0.95, 1, 1])
    // the same points on the fixed set: the rise is the test set shrinking
    expect(curve.points.map((point) => Number(point.accuracyOnFullHeldOut.toFixed(3)))).toEqual([
      0.856, 0.856, 0.867, 0.867, 0.856,
    ])
    expect(curve.points.map((point) => point.heldOutRemoved)).toEqual([10, 11, 30, 61, 79])
    expect(curve.points.map((point) => Number(point.delta.toFixed(4)))).toEqual([0, 0, 0.0111, 0.0111, 0])
    // at 160 tokens a third of the training corpus is left, and its quality is high
    expect(curve.points.at(-1)!.meanQuality).toBeCloseTo(0.674, 3)
  })

  it('shows the duplicate threshold changing the corpus and not the score', () => {
    const curve = ablationCurve(corpus, 'dedupThreshold', [0.3, 0.45, 0.6, 0.8], { training: { steps: 150 } })
    expect(curve.points.map((point) => point.kept)).toEqual([247, 250, 259, 273])
    for (const point of curve.points) expect(point.delta).toBe(0)
    expect(curve.points.map((point) => Number(point.accuracy.toFixed(3)))).toEqual([0.892, 0.892, 0.895, 0.9])
    // the corpus really is flatter at 0.3, which the accuracy does not show
    const flat = runPipeline(corpus, { dedupThreshold: 0.3 })
    const loose = runPipeline(corpus, { dedupThreshold: 0.8 })
    expect(duplicateFraction(flat.kept)).toBeCloseTo(0.0324, 3)
    expect(duplicateFraction(loose.kept)).toBeCloseTo(0.117, 3)
  })

  it('shows the alignment filter buying accuracy by spending quality', () => {
    const curve = ablationCurve(corpus, 'minAlignment', [-1, 0.2, 0.4, 0.6], { training: { steps: 150 } })
    expect(curve.points.map((point) => point.kept)).toEqual([273, 175, 107, 63])
    expect(curve.points.map((point) => Number(point.accuracyOnFullHeldOut.toFixed(3)))).toEqual([
      0.856, 0.867, 0.889, 0.811,
    ])
    expect(curve.points.map((point) => Number(point.delta.toFixed(4)))).toEqual([0, 0.0111, 0.0333, -0.0444])
    expect(curve.points.map((point) => Number(point.meanQuality.toFixed(4)))).toEqual([
      0.4393, 0.3304, 0.3136, 0.3867,
    ])
    expect(curve.points.map((point) => point.heldOutRemoved)).toEqual([10, 35, 56, 75])
  })

  it('keeps the baseline the same across every curve', () => {
    for (const filter of ['maxPerplexity', 'minTokens', 'dedupThreshold', 'minAlignment'] as const) {
      const curve = ablationCurve(corpus, filter, [], { training: { steps: 150 } })
      expect(curve.baseline.accuracy).toBeCloseTo(0.9, 6)
      expect(curve.baselineFixed.accuracy).toBe(77 / 90)
      expect(curve.baseline.kept).toBe(273)
      expect(curve.points).toEqual([])
    }
  })
})
