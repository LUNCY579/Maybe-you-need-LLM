import { describe, expect, it } from 'vitest'
import {
  buildAlignmentQuestions,
  buildInferenceQuestions,
  buildLearningQuestions,
  buildSamplingQuestions,
  buildTokenizerQuestions,
} from '../../content/predictionQuestions'

/**
 * Every prediction exercise must have exactly one correct option.
 *
 * The correct option is *computed* rather than stored, so a change in the
 * algorithm could in principle leave a question with no correct answer, or with
 * two. Either would make the exercise useless, and neither would be caught by
 * a rendering test — so the invariant is asserted here instead.
 */
const SUITES = [
  { name: 'tokenizer', build: buildTokenizerQuestions },
  { name: 'sampling', build: buildSamplingQuestions },
  { name: 'alignment', build: buildAlignmentQuestions },
  { name: 'learning', build: buildLearningQuestions },
  { name: 'inference', build: buildInferenceQuestions },
]

describe('prediction exercises', () => {
  for (const suite of SUITES) {
    describe(suite.name, () => {
      const questions = suite.build()

      it('has questions to ask', () => {
        expect(questions.length).toBeGreaterThan(0)
      })

      it('gives every question exactly one correct option', () => {
        for (const question of questions) {
          const correct = question.options.filter((option) => option.correct)
          expect(correct.length, `${question.id} has ${correct.length} correct options`).toBe(1)
        }
      })

      it('gives every question at least two options', () => {
        for (const question of questions) {
          expect(question.options.length, `${question.id} has too few options`).toBeGreaterThanOrEqual(2)
        }
      })

      it('gives every question a unique id', () => {
        const ids = questions.map((question) => question.id)
        expect(new Set(ids).size).toBe(ids.length)
      })

      it('explains every question', () => {
        for (const question of questions) {
          expect(question.prompt).toBeTruthy()
          expect(question.explanation).toBeTruthy()
        }
      })
    })
  }
})
