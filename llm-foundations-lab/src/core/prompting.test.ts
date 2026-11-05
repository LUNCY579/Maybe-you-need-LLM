import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IN_CONTEXT_MODEL,
  demonstrationsFor,
  fewShotAccuracy,
  fewShotCurve,
  inducedLabelShare,
  majorityLabelRate,
} from './prompting'

describe('few-shot prompting', () => {
  it('starts at the chance rate with no demonstrations', () => {
    const chance = 1 / DEFAULT_IN_CONTEXT_MODEL.labels
    expect(fewShotAccuracy(0)).toBeCloseTo(chance, 12)
    expect(fewShotCurve()[0]!.accuracy).toBeCloseTo(chance, 12)
  })

  it('rises with the demonstrations and stays under the ceiling', () => {
    const curve = fewShotCurve()
    for (let index = 1; index < curve.length; index++) {
      expect(curve[index]!.accuracy, `n = ${curve[index]!.demonstrations}`).toBeGreaterThan(
        curve[index - 1]!.accuracy,
      )
    }
    for (const point of curve) expect(point.accuracy).toBeLessThan(DEFAULT_IN_CONTEXT_MODEL.ceiling)
  })

  it('reaches the target at the demonstrations it computes', () => {
    const target = 0.8
    const n = demonstrationsFor(target)
    expect(fewShotAccuracy(n)).toBeCloseTo(target, 10)
    expect(Number.isFinite(demonstrationsFor(DEFAULT_IN_CONTEXT_MODEL.ceiling))).toBe(false)
  })

  it('leaves the label prior flat when the prompt does not pull', () => {
    const share = inducedLabelShare([4, 0, 0, 0], 0)
    for (const value of share) expect(value).toBeCloseTo(0.25, 12)
  })

  it('makes a lopsided prompt predict its majority label', () => {
    const balanced = majorityLabelRate([2, 2, 0, 0])
    const lopsided = majorityLabelRate([4, 0, 0, 0])
    expect(lopsided).toBeGreaterThan(balanced)
    expect(lopsided).toBeCloseTo(0.8 + 0.2 / 4, 12)
  })

  it('keeps the induced label shares a distribution', () => {
    for (const counts of [[0, 0, 0, 0], [1, 0, 0, 0], [3, 1, 0, 0], [2, 2, 1, 1]]) {
      const total = inducedLabelShare(counts).reduce((sum, value) => sum + value, 0)
      expect(total).toBeCloseTo(1, 12)
    }
  })
})
