import { describe, expect, it } from 'vitest'
import {
  RETRIEVAL_CASES,
  RETRIEVAL_CASE_BY_ID,
  retrieve,
  salienceAt,
  type RetrievalCase,
} from './retrieval'

const refund = RETRIEVAL_CASE_BY_ID.get('refund-policy') as RetrievalCase
const migration = RETRIEVAL_CASE_BY_ID.get('migration-guide') as RetrievalCase
const notes = RETRIEVAL_CASE_BY_ID.get('meeting-notes') as RetrievalCase

describe('the retrieval demonstration', () => {
  it('measures the U-shaped curve of attention over a context', () => {
    // One passage: it is the whole context, so it is fully attended.
    expect(salienceAt(0, 1)).toBe(1)
    // Three passages: the middle is the least attended.
    expect(salienceAt(0, 3)).toBe(1)
    expect(salienceAt(1, 3)).toBe(0)
    expect(salienceAt(2, 3)).toBe(1)
    // The ends are always better than the middle.
    expect(salienceAt(0, 8)).toBeGreaterThan(salienceAt(3, 8))
    expect(salienceAt(7, 8)).toBeGreaterThan(salienceAt(3, 8))
  })

  it('misses the decisive passage when only the closest one is taken', () => {
    const outcome = retrieve(refund, 1, 'bi-encoder')
    expect(outcome.recalled).toBe(false)
    expect(outcome.correct).toBe(false)
    expect(outcome.answer).toBe(refund.distractedAnswer)
  })

  it('finds the decisive passage when it is reranked', () => {
    const outcome = retrieve(refund, 1, 'rerank')
    expect(outcome.recalled).toBe(true)
    expect(outcome.correct).toBe(true)
    expect(outcome.answer).toBe(refund.answer)
  })

  it('retrieves a decisive passage and then fails to use it', () => {
    // Five passages put the decisive one fourth, which is in the middle of
    // the window — where the model attends least. This is the failure that
    // makes "just retrieve more" wrong.
    const outcome = retrieve(migration, 5, 'bi-encoder')
    expect(outcome.recalled).toBe(true)
    expect(outcome.used).toBe(false)
    expect(outcome.correct).toBe(false)
    expect(outcome.explanation).toMatch(/middle/i)
  })

  it('uses a decisive passage that lands at the end of the window', () => {
    const outcome = retrieve(migration, 4, 'rerank')
    expect(outcome.recalled).toBe(true)
    expect(outcome.used).toBe(true)
    expect(outcome.correct).toBe(true)
  })

  it('shows that selecting for diversity can crowd the decisive passage out', () => {
    const outcome = retrieve(notes, 3, 'diverse')
    expect(outcome.recalled).toBe(false)
    expect(outcome.correct).toBe(false)
    expect(outcome.explanation).toMatch(/crowded out|diversity/i)
  })

  it('never puts more passages in the window than were asked for', () => {
    for (const scenario of RETRIEVAL_CASES) {
      for (const k of [1, 2, 3, 4, 5, 8]) {
        for (const strategy of ['bi-encoder', 'rerank', 'diverse'] as const) {
          const outcome = retrieve(scenario, k, strategy)
          expect(outcome.selected.length).toBeLessThanOrEqual(k)
          expect(outcome.selected.length + outcome.missed.length).toBe(scenario.passages.length)
        }
      }
    }
  })

  it('is deterministic', () => {
    const first = retrieve(refund, 3, 'bi-encoder')
    const second = retrieve(refund, 3, 'bi-encoder')
    expect(first.selected.map((entry) => entry.passage.id)).toEqual(
      second.selected.map((entry) => entry.passage.id),
    )
  })

  it('gives every case a decisive passage and two different answers', () => {
    for (const scenario of RETRIEVAL_CASES) {
      expect(scenario.passages.filter((passage) => passage.relevant)).toHaveLength(1)
      expect(scenario.answer).not.toBe(scenario.distractedAnswer)
      expect(scenario.passages.length).toBeGreaterThan(4)
    }
  })

  it('never answers correctly without the decisive passage', () => {
    for (const scenario of RETRIEVAL_CASES) {
      for (const k of [1, 2, 3, 5, 8]) {
        for (const strategy of ['bi-encoder', 'rerank', 'diverse'] as const) {
          const outcome = retrieve(scenario, k, strategy)
          if (!outcome.recalled) {
            expect(outcome.correct).toBe(false)
            expect(outcome.answer).toBe(scenario.distractedAnswer)
          }
        }
      }
    }
  })
})
