import { describe, expect, it } from 'vitest'
import { ALL_QUESTIONS, LESSONS, PREDICT_QUESTIONS } from './index'

describe('prediction questions', () => {
  it('ships at least one prediction per lesson that has a checkpoint', () => {
    const lessonsWithCheckpoints = LESSONS.filter((lesson) =>
      lesson.sections.some((section) => section.blocks.some((block) => block.kind === 'checkpoint')),
    )
    expect(lessonsWithCheckpoints.length).toBeGreaterThan(0)
    for (const lesson of lessonsWithCheckpoints) {
      const predictions = lesson.sections.filter((section) =>
        section.blocks.some((block) => block.kind === 'predict'),
      ).length
      expect(predictions, `${lesson.slug} has a checkpoint but no prediction`).toBeGreaterThan(0)
    }
  })

  it('is registered as ordinary questions, so attempts reach the review queue', () => {
    expect(PREDICT_QUESTIONS.length).toBeGreaterThan(0)
    for (const question of PREDICT_QUESTIONS) {
      expect(ALL_QUESTIONS.some((candidate) => candidate.id === question.id)).toBe(true)
    }
  })

  it('gives every prediction a unique id', () => {
    const ids = ALL_QUESTIONS.map((question) => question.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every prediction a usable structure', () => {
    for (const question of PREDICT_QUESTIONS) {
      expect(question.id.startsWith('p'), `${question.id} should be prefixed with p`).toBe(true)
      expect(question.prompt.length).toBeGreaterThan(20)
      expect(question.options.length).toBeGreaterThanOrEqual(3)
      expect(question.correct).toBeGreaterThanOrEqual(0)
      expect(question.correct).toBeLessThan(question.options.length)
      expect(question.explanation.length).toBeGreaterThan(60)
      expect(question.source.label.length).toBeGreaterThan(0)
      expect(question.source.page).toBeGreaterThan(0)
    }
  })

  it('does not repeat an option verbatim', () => {
    for (const question of PREDICT_QUESTIONS) {
      expect(new Set(question.options).size).toBe(question.options.length)
    }
  })
})
