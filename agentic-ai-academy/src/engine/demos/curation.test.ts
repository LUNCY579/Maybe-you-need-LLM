import { describe, expect, it } from 'vitest'
import { CORPORA, CORPUS_BY_ID, curate, type Corpus, type FilterSettings } from './curation'

const crawl = CORPUS_BY_ID.get('web-crawl') as Corpus
const forum = CORPUS_BY_ID.get('forum-archive') as Corpus
const mixed = CORPUS_BY_ID.get('mixed-pile') as Corpus

const loose: FilterSettings = { qualityThreshold: 0, similarityThreshold: 1, safetyFilter: false }
const strict: FilterSettings = { qualityThreshold: 0.5, similarityThreshold: 0.8, safetyFilter: true }

describe('the curation demonstration', () => {
  it('keeps everything when the filter is off', () => {
    const outcome = curate(crawl, loose)
    expect(outcome.kept).toHaveLength(crawl.documents.length)
    expect(outcome.retained).toBe(1)
  })

  it('removes the near-duplicates when the threshold is strict enough', () => {
    const outcome = curate(crawl, { qualityThreshold: 0, similarityThreshold: 0.8, safetyFilter: false })
    const kept = outcome.kept.map((document) => document.id)
    expect(kept).not.toContain('w2')
    expect(kept).not.toContain('w3')
    expect(kept).not.toContain('w4')
    // A near-copy below the threshold survives, which is the point.
    expect(kept).toContain('w5')
  })

  it('removes the unsafe documents when the safety filter runs', () => {
    const outcome = curate(crawl, { qualityThreshold: 0, similarityThreshold: 1, safetyFilter: true })
    expect(outcome.kept.map((document) => document.id)).not.toContain('w11')
    expect(outcome.dropped.find((entry) => entry.document.id === 'w11')?.reason).toBe('safety')
  })

  it('filters out the dialect variety when the quality threshold is high', () => {
    const outcome = curate(forum, { qualityThreshold: 0.45, similarityThreshold: 0.8, safetyFilter: true })
    expect(outcome.dialectKept).toBe(false)
    expect(outcome.falsePositives.map((document) => document.id)).toContain('f4')
    expect(outcome.headline).toMatch(/variety of writing was filtered out/i)
  })

  it('keeps the dialect variety when the threshold is low enough', () => {
    const outcome = curate(forum, { qualityThreshold: 0.25, similarityThreshold: 0.8, safetyFilter: true })
    expect(outcome.dialectKept).toBe(true)
  })

  it('shows the trade-off between removing duplicates and keeping the corpus', () => {
    const permissive = curate(crawl, { qualityThreshold: 0, similarityThreshold: 0.95, safetyFilter: false })
    const strictEnough = curate(crawl, { qualityThreshold: 0, similarityThreshold: 0.8, safetyFilter: false })
    // A tighter duplicate threshold removes more, and the surviving corpus is
    // smaller as a result.
    expect(strictEnough.kept.length).toBeLessThan(permissive.kept.length)
    expect(permissive.duplicatesKept).toBeGreaterThan(strictEnough.duplicatesKept)
  })

  it('never keeps more tokens than it started with', () => {
    for (const corpus of CORPORA) {
      for (const threshold of [0, 0.2, 0.4, 0.6, 0.8]) {
        for (const similarity of [0.5, 0.7, 0.9, 1]) {
          const outcome = curate(corpus, { qualityThreshold: threshold, similarityThreshold: similarity, safetyFilter: true })
          expect(outcome.tokensAfter).toBeLessThanOrEqual(outcome.tokensBefore)
          expect(outcome.retained).toBeGreaterThanOrEqual(0)
          expect(outcome.retained).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('reports the source mix before and after', () => {
    const outcome = curate(mixed, strict)
    expect(outcome.mix).toHaveLength(4)
    for (const entry of outcome.mix) {
      expect(entry.after).toBeLessThanOrEqual(entry.before)
    }
  })

  it('drops nothing for a reason the pipeline did not name', () => {
    for (const corpus of CORPORA) {
      const outcome = curate(corpus, strict)
      expect(outcome.kept.length + outcome.dropped.length).toBe(corpus.documents.length)
      for (const entry of outcome.dropped) {
        expect(['quality', 'duplicate', 'safety']).toContain(entry.reason)
      }
    }
  })

  it('is deterministic', () => {
    const first = curate(mixed, strict)
    const second = curate(mixed, strict)
    expect(first.kept.map((document) => document.id)).toEqual(second.kept.map((document) => document.id))
  })

  it('gives every corpus a dialect variety to lose and duplicates to remove', () => {
    for (const corpus of CORPORA) {
      expect(corpus.documents.some((document) => document.dialect)).toBe(true)
      expect(corpus.documents.some((document) => document.duplicateOf)).toBe(true)
      expect(corpus.documents.some((document) => document.unsafe)).toBe(true)
    }
  })
})
