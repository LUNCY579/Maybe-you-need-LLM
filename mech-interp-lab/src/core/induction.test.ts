import { describe, expect, it } from 'vitest'
import {
  accuracyByRepeats,
  attentionWeights,
  buildRandomSequence,
  buildRepeatedSequence,
  inductionReport,
  matchingPositions,
  predictNext,
  previousTokenWeights,
} from './induction'

/** Two copies of a block with no repeated token, so every match is unique. */
const BLOCK = [0, 1, 2, 3, 0, 1, 2, 3]

describe('the previous-token head', () => {
  it('attends to the position before, and nowhere else', () => {
    expect(previousTokenWeights(5)).toEqual([0, 0, 0, 0, 1, 0])
    expect(previousTokenWeights(5).reduce((sum, value) => sum + value, 0)).toBe(1)
  })

  it('has nothing to attend to at the first position', () => {
    expect(previousTokenWeights(0)).toEqual([0])
  })
})

describe('the sequence', () => {
  it('is deterministic for a given seed, and repeats its block', () => {
    const first = buildRepeatedSequence({ block: 5, repeats: 3, seed: 7 })
    const second = buildRepeatedSequence({ block: 5, repeats: 3, seed: 7 })
    expect(first).toEqual(second)
    expect(first.slice(0, 5)).toEqual(first.slice(5, 10))
    expect(first.slice(5, 10)).toEqual(first.slice(10, 15))
  })

  it('draws a sequence with no repetition when asked for one', () => {
    const sequence = buildRandomSequence({ length: 20, seed: 3 })
    expect(sequence.length).toBe(20)
    expect(new Set(sequence).size).toBeGreaterThan(1)
  })
})

describe('the induction head', () => {
  it('attends causally, with weights that sum to one', () => {
    for (let position = 0; position < BLOCK.length; position++) {
      const weights = attentionWeights(BLOCK, position)
      expect(weights.length, String(position)).toBe(position + 1)
      expect(weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12)
    }
  })

  it('puts its attention on the positions whose predecessor is the current token', () => {
    const weights = attentionWeights(BLOCK, 4)
    const matches = matchingPositions(BLOCK, 4)
    expect(matches).toEqual([1])
    expect(weights[1]).toBeGreaterThan(0.99)
  })

  it('predicts the token that followed the previous occurrence', () => {
    for (const position of [4, 5, 6]) {
      const prediction = predictNext(BLOCK, position)
      expect(prediction.token, String(position)).toBe(BLOCK[position + 1])
    }
  })

  it('gets every predictable position right, and there are exactly three', () => {
    const report = inductionReport(BLOCK)
    expect(report.predictable).toBe(3)
    expect(report.correct).toBe(3)
    expect(report.accuracy).toBe(1)
  })

  it('is chance-level when its predecessor is not repeated, because there is nothing to induce', () => {
    const single = inductionReport(BLOCK.slice(0, 4))
    expect(single.predictable).toBe(0)
    expect(single.accuracy).toBe(0)
  })
})

describe('the ablation that shows the composition is doing the work', () => {
  it('loses the prediction when the previous-token head is removed', () => {
    const report = inductionReport(BLOCK, { variant: 'ablated' })
    expect(report.predictable).toBe(3)
    expect(report.correct).toBe(0)
    expect(report.accuracy).toBe(0)
  })

  it('copies the current token instead of the following one', () => {
    const prediction = predictNext(BLOCK, 4, { variant: 'ablated' })
    expect(prediction.token).toBe(BLOCK[4])
  })
})

describe('the repetition curve', () => {
  it('has nothing to predict with one copy, and is accurate from the second', () => {
    const curve = accuracyByRepeats({ block: 6, seed: 4 })
    expect(curve[0]!.repeats).toBe(1)
    expect(curve[0]!.predictable).toBe(0)
    for (const point of curve.slice(1)) {
      expect(point.predictable, String(point.repeats)).toBeGreaterThan(0)
      expect(point.accuracy, String(point.repeats)).toBeGreaterThan(99)
    }
  })

  it('is well above chance and collapses under the ablation, at every repeated length', () => {
    for (const repeats of [2, 3, 4]) {
      const composed = inductionReport(buildRepeatedSequence({ block: 6, seed: 4, repeats }), {
        variant: 'composed',
        vocab: 8,
      })
      const ablated = inductionReport(buildRepeatedSequence({ block: 6, seed: 4, repeats }), {
        variant: 'ablated',
        vocab: 8,
      })
      expect(composed.accuracy, String(repeats)).toBeGreaterThan(0.95)
      expect(ablated.accuracy, String(repeats)).toBeLessThan(composed.accuracy / 2)
    }
  })
})
