import { describe, expect, it } from 'vitest'
import { ALL_LAB_QUESTIONS, LAB_QUESTIONS } from './labQuestions'
import { LABS } from './labs'

describe('laboratory diagnostic questions', () => {
  it('gives every laboratory at least one diagnostic question', () => {
    for (const lab of LABS) {
      expect(LAB_QUESTIONS[lab.id]?.length ?? 0, `${lab.id} has no diagnostic questions`).toBeGreaterThan(0)
    }
  })

  it('gives every question a unique id', () => {
    const ids = ALL_LAB_QUESTIONS.map((question) => question.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every question a usable structure', () => {
    for (const question of ALL_LAB_QUESTIONS) {
      expect(question.prompt.length).toBeGreaterThan(40)
      expect(question.options.length).toBeGreaterThanOrEqual(3)
      expect(new Set(question.options).size).toBe(question.options.length)
      expect(question.correct).toBeGreaterThanOrEqual(0)
      expect(question.correct).toBeLessThan(question.options.length)
      expect(question.explanation.length).toBeGreaterThan(80)
      expect(question.source.label.length).toBeGreaterThan(0)
      expect(question.source.chapter).toBeGreaterThan(0)
    }
  })

  it('uses ids that cannot collide with the lesson questions', () => {
    for (const question of ALL_LAB_QUESTIONS) {
      expect(question.id).toMatch(/^l[a-z]+-\d+$/)
    }
  })
})
