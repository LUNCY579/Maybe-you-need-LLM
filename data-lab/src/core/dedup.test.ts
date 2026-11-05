import { beforeAll, describe, expect, it } from 'vitest'
import { buildCorpus, type Document } from './corpus'
import { decontaminate, jaccard, plantBenchmarkLeaks, shingles } from './dedup'

/**
 * Decontamination against a benchmark.
 *
 * The rule is an n-gram overlap: remove a training document when it contains
 * enough of a benchmark example's n-grams. The claim this unit tests is the one
 * that decides whether the rule is worth running at all — *what does it find?*
 * — and the honest answer is that the answer depends on two things people forget
 * to state: how edited the leak is, and how long the n-gram is.
 *
 * A leak cannot be scored without ground truth, so `plantBenchmarkLeaks` makes
 * some on purpose: eight documents from a *different* corpus, dropped into this
 * one with a fraction of their tokens edited. `editSpacing: 17` edits every 17th
 * token, about 6% of the document, which a reader would call "the same text".
 * The filter calls it something else at n-gram 8 and longer.
 *
 * Every number below is measured on the same fixture, and the two directions of
 * error are reported separately: how many of the eight planted copies were found,
 * and how many innocent documents were removed with them.
 */

const corpus = buildCorpus({ seed: 17, size: 300 })
const externalBenchmarkSource = buildCorpus({ seed: 42, size: 60 })

const SPACINGS = [7, 11, 17, 25] as const

const leaked = (editSpacing: number) =>
  plantBenchmarkLeaks(corpus.documents, externalBenchmarkSource.documents, { editSpacing })

/** How much of an 8-gram survives a copy edited at this spacing, per leak. */
function survivingOverlap(editSpacing: number): number[] {
  const l = leaked(editSpacing)
  return l.planted.map((id, index) => {
    const copy = l.pool.find((document) => document.id === id) as Document
    const original = externalBenchmarkSource.documents[index] as Document
    return jaccard(shingles(copy.tokens, 8), shingles(original.tokens, 8))
  })
}

/** found / innocent / kept for one setting of the rule. */
function score(editSpacing: number, ngramSize: number, threshold: number) {
  const l = leaked(editSpacing)
  const result = decontaminate(l.pool, l.benchmark, { ngramSize, threshold })
  const found = result.contaminated.filter((entry) => l.planted.includes(entry.id)).length
  return { found, innocent: result.contaminated.length - found, kept: result.kept.length }
}

describe('Decontamination against a benchmark', () => {
  it('fixes the eight leaks the laboratory is built on', () => {
    const l = leaked(17)
    expect(l.pool).toHaveLength(308)
    expect(l.planted).toEqual([300, 301, 302, 303, 304, 305, 306, 307])
    expect(l.benchmark).toHaveLength(8)
    // the copies are appended, so nothing about the original corpus moved
    expect(l.pool.slice(0, 300)).toEqual(corpus.documents)
  })

  it('finds a leak only when the edits leave an n-gram intact', () => {
    // the jaccard overlap of the edited copy with its own source, which is what
    // the rule is really being asked to notice
    expect(survivingOverlap(7).map((value) => Number(value.toFixed(3)))).toEqual([
      0, 0, 0, 0, 0.019, 0, 0, 0,
    ])
    expect(survivingOverlap(25).map((value) => Number(value.toFixed(3)))).toEqual([
      0.542, 0.567, 0.567, 0.617, 0.484, 0.472, 0.567, 0.382,
    ])
    // at 8-grams and a 0.5 threshold the rule finds nothing a reader would call
    // invisible and everything a reader would call obvious
    expect(SPACINGS.map((spacing) => score(spacing, 8, 0.3).found)).toEqual([0, 3, 8, 8])
    expect(SPACINGS.map((spacing) => score(spacing, 8, 0.5).found)).toEqual([0, 0, 6, 8])
    // ...and at the sparser edits it does not merely miss, it reports a clean corpus
    expect(score(7, 8, 0.5)).toEqual({ found: 0, innocent: 0, kept: 308 })
    expect(score(11, 8, 0.5)).toEqual({ found: 0, innocent: 0, kept: 308 })
  })

  it('pays for recall with innocent documents as the n-gram shortens', () => {
    // the same eight leaks, edited at the default spacing, one n-gram length each
    expect([4, 5, 8, 12].map((n) => score(17, n, 0.3))).toEqual([
      { found: 8, innocent: 43, kept: 257 },
      { found: 8, innocent: 14, kept: 286 },
      { found: 8, innocent: 3, kept: 297 },
      { found: 5, innocent: 0, kept: 303 },
    ])
    // the 4-gram is not a filter, it is a re-sampling of the corpus: it removes
    // 51 of 308 documents — 17% — to catch eight that were never 17% of the pool
    expect(308 - 257).toBe(51)
    expect(51 / 308).toBeGreaterThan(0.16)
    expect(51 / 308).toBeLessThan(0.17)
    // no document ever matched more than two examples, so the innocent ones are
    // ordinary corpus members rather than benchmark-shaped outliers
    const broad = decontaminate(leaked(17).pool, leaked(17).benchmark, { ngramSize: 4, threshold: 0.3 })
    expect(Math.max(...broad.matchesPerDocument)).toBe(2)
    expect(broad.matchesPerDocument).toHaveLength(51)
  })

  it('scores itself on ground truth rather than on how much it removed', () => {
    const l = leaked(17)
    const result = decontaminate(l.pool, l.benchmark, { ngramSize: 8, threshold: 0.5 })
    const hits = result.contaminated.filter((entry) => l.planted.includes(entry.id))
    expect(hits).toHaveLength(6)
    // recall 0.75, precision 1.0 — every document it removed really was a leak
    expect(hits).toHaveLength(result.contaminated.length)
    expect(result.kept).toHaveLength(302)
    const missed = l.planted.filter((id) => !hits.some((hit) => hit.id === id))
    expect(missed).toEqual([304, 307])
    // and the two misses are misses of degree, not of kind: the same rule at the
    // same n-gram with a 0.3 threshold catches both, just under half the example
    const loose = decontaminate(l.pool, l.benchmark, { ngramSize: 8, threshold: 0.3 })
    expect(loose.contaminated.filter((entry) => entry.id === 304)[0]!.overlap).toBeCloseTo(0.4946, 3)
    expect(loose.contaminated.filter((entry) => entry.id === 307)[0]!.overlap).toBeCloseTo(0.4103, 3)
    expect(loose.kept.map((document) => document.id)).not.toContain(304)
    // the 0.5 threshold leaves them in the corpus, where a model then trains on them
    expect(result.kept.map((document) => document.id)).toEqual(expect.arrayContaining([304, 307]))
  })

  it('catches a copy with a single edited token and reports the overlap', () => {
    // the position-0 edit is unconditional, so this is "one token changed"
    const l = leaked(1000)
    const result = decontaminate(l.pool, l.benchmark, { ngramSize: 8, threshold: 0.5 })
    expect(result.contaminated).toHaveLength(8)
    expect(result.contaminated.map((entry) => Number(entry.overlap.toFixed(4))).sort()).toEqual([
      0.9737, 0.9744, 0.9892, 0.9894, 0.9894, 0.9894, 0.9898, 0.9928,
    ])
    // one edited token kills the n-grams that *contain* it — up to n of them, but
    // only one when it sits at the very start. The shortest example is 45 tokens,
    // so it has 38 8-grams and loses exactly one: 37/38 is the minimum above.
    expect(37 / 38).toBeCloseTo(0.9737, 4)
    expect(score(1000, 8, 0.5).innocent).toBe(0)
  })

  it('leaves a corpus with no leak at all untouched', () => {
    const l = leaked(17)
    const clean = decontaminate(corpus.documents, l.benchmark, { ngramSize: 8, threshold: 0.5 })
    expect(clean.contaminated).toEqual([])
    expect(clean.kept).toHaveLength(300)
    expect(clean.matchesPerDocument).toEqual([])
  })

  it('finds almost anything when the benchmark is drawn from the corpus itself', () => {
    // the mistake the scaffold is built to avoid: an evaluation set sampled from
    // the training data is trivially "contaminated", and the filter spends the
    // corpus's own redundancy to prove it
    const own = corpus.documents.slice(0, 8).map((document) => ({ id: `example-${document.id}`, tokens: document.tokens }))
    const result = decontaminate(corpus.documents, own, { ngramSize: 8, threshold: 0.5 })
    expect(result.contaminated).toHaveLength(30)
    expect(result.kept).toHaveLength(270)
    // all eight examples match themselves, and one of them is a boilerplate hub
    const byExample = new Map<string, number>()
    for (const entry of result.contaminated) byExample.set(entry.matched, (byExample.get(entry.matched) ?? 0) + 1)
    expect(byExample.get('example-5')).toBe(20)
    expect(byExample.get('example-6')).toBe(1)
    expect(Math.max(...byExample.values())).toBe(20)
    expect(Math.min(...byExample.values())).toBe(1)
    // the other 22 documents are the generator's planted near-duplicates
    expect(result.contaminated.filter((entry) => entry.id < 8)).toHaveLength(8)
  })

  it('reports the best-matching example, not every example', () => {
    const l = leaked(17)
    const result = decontaminate(l.pool, l.benchmark, { ngramSize: 5, threshold: 0.3 })
    expect(result.contaminated).toHaveLength(22)
    for (const entry of result.contaminated) expect(entry.matched).toMatch(/^example-\d+$/)
    const planted = result.contaminated.filter((entry) => l.planted.includes(entry.id))
    expect(planted).toHaveLength(8)
    for (const entry of planted) expect(entry.overlap).toBeGreaterThanOrEqual(0.3)
  })
})

describe('The overlap an n-gram rule can see', () => {
  const grid: { spacing: number; ngramSize: number; threshold: number; found: number; innocent: number }[] = []
  beforeAll(() => {
    for (const spacing of [7, 11, 17, 25]) {
      for (const ngramSize of [4, 8, 12]) {
        for (const threshold of [0.3, 0.5]) {
          const l = leaked(spacing)
          const result = decontaminate(l.pool, l.benchmark, { ngramSize, threshold })
          const found = result.contaminated.filter((entry) => l.planted.includes(entry.id)).length
          grid.push({ spacing, ngramSize, threshold, found, innocent: result.contaminated.length - found })
        }
      }
    }
  })

  it('gets shorter and looser in that order, never the reverse', () => {
    // every setting that finds a leak at a longer n-gram finds it at a shorter one
    for (const spacing of [7, 11, 17, 25]) {
      for (const threshold of [0.3, 0.5]) {
        const found = [4, 8, 12].map((n) => grid.find((g) => g.spacing === spacing && g.ngramSize === n && g.threshold === threshold)!.found)
        for (let i = 1; i < found.length; i++) expect(found[i - 1]).toBeGreaterThanOrEqual(found[i]!)
      }
    }
    // and the innocent count falls with the n-gram length for the same reason
    for (const spacing of [7, 11, 17, 25]) {
      const innocent = [4, 8, 12].map((n) => grid.find((g) => g.spacing === spacing && g.ngramSize === n && g.threshold === 0.3)!.innocent)
      for (let i = 1; i < innocent.length; i++) expect(innocent[i - 1]).toBeGreaterThanOrEqual(innocent[i]!)
    }
    // eleven of the twenty-four settings catch every leak, eight catch none
    expect(grid.filter((g) => g.found === 8)).toHaveLength(11)
    expect(grid.filter((g) => g.found === 0)).toHaveLength(8)
    expect(grid).toHaveLength(24)
  })
})
