import { describe, expect, it } from 'vitest'
import { LESSONS, LESSON_BY_SLUG, ALL_QUESTIONS } from './lessons'
import { resolveTrack, totalQuestionCount } from './tracks'

describe('difficulty tracks', () => {
  it('gives every lesson an advanced section and advanced questions', () => {
    for (const lesson of LESSONS) {
      expect(lesson.advancedSections.length, `${lesson.slug} has no advanced section`).toBeGreaterThan(0)
      expect(lesson.advancedQuiz.length, `${lesson.slug} has no advanced questions`).toBeGreaterThan(0)
    }
  })

  it('uses unique ids for advanced questions across the whole course', () => {
    const ids = ALL_QUESTIONS.map((question) => question.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every advanced question a distinct id and a source reference', () => {
    for (const lesson of LESSONS) {
      for (const question of lesson.advancedQuiz) {
        expect(question.id.startsWith('q')).toBe(true)
        expect(question.source.label.length).toBeGreaterThan(0)
        expect(question.source.primary).toBe(true)
        expect(question.explanation.length).toBeGreaterThan(40)
        expect(question.options.length).toBeGreaterThanOrEqual(3)
        expect(question.correct).toBeGreaterThanOrEqual(0)
        expect(question.correct).toBeLessThan(question.options.length)
      }
    }
  })

  it('cites a page for every question in the course', () => {
    for (const question of ALL_QUESTIONS) {
      expect(question.source.page, `${question.id} has no page reference`).toBeGreaterThan(0)
    }
  })

  it('keeps the core track free of advanced questions', () => {
    for (const lesson of LESSONS) {
      const core = resolveTrack(lesson, 'core')
      expect(core.questions.every((question) => question.difficulty === 'core')).toBe(true)
    }
  })

  it('shows the advanced track strictly more questions than the core track', () => {
    for (const lesson of LESSONS) {
      const core = resolveTrack(lesson, 'core')
      const advanced = resolveTrack(lesson, 'advanced')
      expect(advanced.questions.length).toBeGreaterThan(core.questions.length)
    }
  })

  it('appends the advanced sections after the shared sections', () => {
    for (const lesson of LESSONS) {
      const advanced = resolveTrack(lesson, 'advanced')
      expect(advanced.sections).toHaveLength(lesson.sections.length + lesson.advancedSections.length)
      expect(advanced.sections.slice(0, lesson.sections.length).map((section) => section.id)).toEqual(
        lesson.sections.map((section) => section.id),
      )
    }
  })

  it('gives the core track a non-empty question set even for advanced lessons', () => {
    for (const lesson of LESSONS) {
      const core = resolveTrack(lesson, 'core')
      expect(core.questions.length).toBeGreaterThan(0)
    }
  })

  it('reports whether a lesson offers extra material', () => {
    for (const lesson of LESSONS) {
      expect(resolveTrack(lesson, 'advanced').hasExtraMaterial).toBe(true)
    }
  })

  it('counts every question, including advanced ones', () => {
    for (const lesson of LESSONS) {
      expect(totalQuestionCount(lesson)).toBe(lesson.quiz.length + lesson.advancedQuiz.length)
    }
  })

  it('resolves a lesson by slug', () => {
    const lesson = LESSON_BY_SLUG.get('what-agentic-llms-are')
    expect(lesson?.order).toBe(1)
    expect(lesson?.advancedSections[0]?.id).toBe('adv-harness-formalism')
  })
})
