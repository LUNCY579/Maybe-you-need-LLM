import { describe, expect, it } from 'vitest'
import { COMPANION_MODEL, companionFigures, uniformLoss } from './companions.js'

describe('the companion figures', () => {
  const figures = companionFigures()

  it('gives every lesson a finite figure', () => {
    expect(figures.length).toBe(11)
    expect(new Set(figures.map((figure) => figure.lessonId)).size).toBe(11)
    for (const figure of figures) {
      expect(Number.isFinite(figure.value), figure.lessonId).toBe(true)
      expect(figure.value, figure.lessonId).toBeGreaterThanOrEqual(0)
      expect(figure.sentence.length, figure.lessonId).toBeGreaterThan(30)
    }
  })

  it('computes the figures it claims to compute', () => {
    const byLesson = new Map(figures.map((figure) => [figure.lessonId, figure]))
    expect(byLesson.get('the-vocabulary-economy')!.value).toBe(
      COMPANION_MODEL.vocabSize * COMPANION_MODEL.dModel,
    )
    expect(byLesson.get('the-training-loop')!.value).toBeCloseTo(Math.log(32000), 10)
    expect(byLesson.get('the-perplexity')!.value).toBeCloseTo(Math.exp(3), 10)
    expect(byLesson.get('the-data-pipeline')!.value).toBeGreaterThan(0)
    expect(byLesson.get('the-data-pipeline')!.value).toBeLessThan(100)
    expect(byLesson.get('the-tokeniser')!.value).toBeGreaterThan(1)
  })

  it('derives the uniform loss from the vocabulary', () => {
    expect(uniformLoss(Math.E)).toBeCloseTo(1, 12)
    expect(uniformLoss(32000)).toBeCloseTo(10.3735, 4)
  })
})
