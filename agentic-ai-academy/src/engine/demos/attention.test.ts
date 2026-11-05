import { describe, expect, it } from 'vitest'
import {
  ATTENTION_CASES,
  ATTENTION_CASE_BY_ID,
  attend,
  dot,
  softmax,
  type AttentionCase,
} from './attention'

const transformer = ATTENTION_CASE_BY_ID.get('transformer') as AttentionCase
const precise = transformer.queries.find((query) => query.id === 'precise')!
const vague = transformer.queries.find((query) => query.id === 'vague')!
const lexical = transformer.queries.find((query) => query.id === 'lexical')!

describe('the attention demonstration', () => {
  it('computes a dot product', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32)
    expect(dot([1, 2], [1, 2, 3])).toBe(5)
    expect(dot([], [1])).toBe(0)
  })

  it('normalises the softmax into a distribution that sums to one', () => {
    const weights = softmax([1, 2, 3])
    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1)
    expect(weights[2]).toBeGreaterThan(weights[1])
    expect(weights[1]).toBeGreaterThan(weights[0])
  })

  it('is stable for large scores', () => {
    const weights = softmax([1000, 1001, 999])
    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1)
    expect(weights.every((weight) => Number.isFinite(weight))).toBe(true)
  })

  it('spreads the weight evenly when the scale is zero', () => {
    const outcome = attend(transformer, precise, 0)
    for (const entry of outcome.weights) {
      expect(entry.weight).toBeCloseTo(1 / transformer.keys.length)
    }
    expect(outcome.effectiveKeys).toBeCloseTo(transformer.keys.length, 1)
  })

  it('concentrates the weight on one passage when the scale is high', () => {
    const outcome = attend(transformer, precise, 40)
    expect(outcome.effectiveKeys).toBeLessThan(1.2)
    expect(outcome.weights[0].weight).toBeGreaterThan(0.99)
  })

  it('answers correctly when the query is precise and the scale is high', () => {
    const outcome = attend(transformer, precise, 6)
    expect(outcome.correct).toBe(true)
    expect(outcome.answer).toBe(transformer.answer)
    expect(outcome.winner.id).toBe('k-paper')
  })

  it('dilutes the right answer when the scale is too low', () => {
    // The right passage still has the most weight, but not enough of it: the
    // context vector is close to an average of everything.
    const outcome = attend(transformer, precise, 1)
    expect(outcome.winner.id).toBe('k-paper')
    expect(outcome.weights[0].weight).toBeLessThan(0.4)
    expect(outcome.correct).toBe(false)
  })

  it('prefers the decoy for a vague query, at every scale', () => {
    for (const scale of [1, 3, 6, 20]) {
      const outcome = attend(transformer, vague, scale)
      expect(outcome.winner.id).not.toBe('k-paper')
      expect(outcome.correct).toBe(false)
    }
  })

  it('prefers the decoy for a query that only repeats the keyword', () => {
    const outcome = attend(transformer, lexical, 10)
    expect(outcome.winner.id).toBe('k-blog')
    expect(outcome.correct).toBe(false)
  })

  it('puts the context vector closer to the winner than to the average', () => {
    const outcome = attend(transformer, precise, 6)
    const average = transformer.keys[0].vector.map((_, index) =>
      transformer.keys.reduce((sum, key) => sum + key.vector[index] / transformer.keys.length, 0),
    )
    const distance = (a: number[], b: number[]) => Math.sqrt(dot(a, a) - 2 * dot(a, b) + dot(b, b))
    expect(distance(outcome.context, outcome.winner.vector)).toBeLessThan(
      distance(outcome.context, average),
    )
  })

  it('is deterministic', () => {
    const first = attend(transformer, precise, 5)
    const second = attend(transformer, precise, 5)
    expect(first.weights.map((entry) => entry.weight)).toEqual(
      second.weights.map((entry) => entry.weight),
    )
  })

  it('gives every case a decoy and a decisive passage', () => {
    for (const scenario of ATTENTION_CASES) {
      expect(scenario.keys.filter((key) => key.relevant)).toHaveLength(1)
      expect(scenario.keys.filter((key) => !key.relevant).length).toBeGreaterThan(1)
      expect(scenario.queries.length).toBeGreaterThan(1)
      expect(scenario.answer).not.toBe(scenario.wrongAnswer)
    }
  })
})
