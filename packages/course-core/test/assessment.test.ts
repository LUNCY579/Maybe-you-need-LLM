import { describe, expect, it } from 'vitest'
import { gradeAnswer, summariseQuiz } from '../src/quiz.js'
import type { QuizQuestion } from '../src/quiz.js'
import { buildSearchIndex, scoreDocument, search } from '../src/search.js'

const numeric: QuizQuestion = {
  id: 'n1',
  kind: 'numeric',
  prompt: 'What is 2 + 2?',
  topic: 'Arithmetic',
  difficulty: 'warmup',
  answer: 4,
  tolerance: 0.01,
  explanation: 'Four.',
}

const choice: QuizQuestion = {
  id: 'c1',
  kind: 'multiple-choice',
  prompt: 'Pick one.',
  topic: 'Choice',
  difficulty: 'core',
  options: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  correctOptionId: 'b',
  explanation: 'B is right.',
}

const multi: QuizQuestion = {
  id: 'm1',
  kind: 'multi-select',
  prompt: 'Pick two.',
  topic: 'Multi',
  difficulty: 'core',
  options: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ],
  correctOptionIds: ['a', 'c'],
  explanation: 'A and C.',
}

const bool: QuizQuestion = {
  id: 'b1',
  kind: 'boolean',
  prompt: 'True?',
  topic: 'Boolean',
  difficulty: 'warmup',
  truth: true,
  explanation: 'It is.',
}

const text: QuizQuestion = {
  id: 't1',
  kind: 'text',
  prompt: 'Name it.',
  topic: 'Text',
  difficulty: 'hard',
  acceptedAnswers: ['Diffusion'],
  explanation: 'Diffusion.',
}

describe('gradeAnswer', () => {
  it('grades a numeric answer within tolerance', () => {
    expect(gradeAnswer(numeric, 4.005).correct).toBe(true)
    expect(gradeAnswer(numeric, 4.1).correct).toBe(false)
  })

  it('reports the expected value for a wrong numeric answer', () => {
    const result = gradeAnswer(numeric, 5)
    expect(result.correct).toBe(false)
    expect(result.expected).toBe(4)
    expect(result.reason).toMatch(/expected value/)
  })

  it('grades a multiple-choice answer', () => {
    expect(gradeAnswer(choice, 'b').correct).toBe(true)
    expect(gradeAnswer(choice, 'a').correct).toBe(false)
    expect(gradeAnswer(choice, 'a').optionVerdicts).toEqual({ a: false, b: true })
  })

  it('grades a multi-select answer exactly', () => {
    expect(gradeAnswer(multi, ['a', 'c']).correct).toBe(true)
    expect(gradeAnswer(multi, ['c', 'a']).correct).toBe(true)
    expect(gradeAnswer(multi, ['a', 'b']).correct).toBe(false)
    expect(gradeAnswer(multi, ['a', 'b', 'c']).correct).toBe(false)
  })

  it('grades a boolean answer', () => {
    expect(gradeAnswer(bool, true).correct).toBe(true)
    expect(gradeAnswer(bool, false).correct).toBe(false)
  })

  it('grades a text answer case-insensitively', () => {
    expect(gradeAnswer(text, '  diffusion ').correct).toBe(true)
    expect(gradeAnswer(text, 'GAN').correct).toBe(false)
  })

  it('treats a missing answer as incorrect', () => {
    expect(gradeAnswer(numeric, null).correct).toBe(false)
    expect(gradeAnswer(choice, undefined).correct).toBe(false)
  })
})

describe('summariseQuiz', () => {
  it('groups results by difficulty and topic', () => {
    const summary = summariseQuiz(
      [numeric, choice, multi, bool, text],
      {
        n1: { correct: true },
        c1: { correct: false },
        m1: { correct: true },
      },
    )
    expect(summary.answered).toBe(3)
    expect(summary.correct).toBe(2)
    expect(summary.accuracy).toBeCloseTo(2 / 3, 12)
    expect(summary.byDifficulty.core.answered).toBe(2)
    expect(summary.byTopic.Arithmetic.correct).toBe(1)
  })
})

describe('search', () => {
  const documents = buildSearchIndex([
    {
      id: 'lesson-1',
      title: 'The forward process',
      summary: 'How noise is added to data',
      body: 'The forward process gradually adds Gaussian noise to a sample over a schedule of timesteps.',
      kind: 'Lesson',
      href: '#/lessons/forward',
    },
    {
      id: 'lesson-2',
      title: 'Reverse diffusion',
      summary: 'Learning to undo noise',
      body: 'The reverse process is a learned denoiser that predicts the noise that was added.',
      kind: 'Lesson',
      href: '#/lessons/reverse',
    },
    {
      id: 'glossary-1',
      title: 'Beta schedule',
      summary: 'A schedule of noise levels',
      body: 'The beta schedule controls how much noise is added at each timestep.',
      kind: 'Glossary',
      href: '#/glossary/beta-schedule',
    },
  ])

  it('finds a document by title', () => {
    const hits = search(documents, 'forward process')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].document.id).toBe('lesson-1')
  })

  it('matches body text', () => {
    const hits = search(documents, 'denoiser')
    expect(hits[0].document.id).toBe('lesson-2')
  })

  it('matches a token prefix', () => {
    const hits = search(documents, 'forw')
    expect(hits[0].document.id).toBe('lesson-1')
  })

  it('returns nothing for an empty query', () => {
    expect(search(documents, '   ')).toEqual([])
  })

  it('returns nothing when there is no match', () => {
    expect(search(documents, 'quantum chromodynamics')).toEqual([])
  })

  it('ranks a title match above a body-only match', () => {
    const withTitle = buildSearchIndex([
      { id: 'titled', title: 'Denoiser', summary: '', body: 'unrelated text', kind: 'Lesson', href: '#' },
      { id: 'bodyonly', title: 'Something else', summary: 'unrelated', body: 'a denoiser appears here', kind: 'Lesson', href: '#' },
    ])
    const hits = search(withTitle, 'denoiser')
    expect(hits[0].document.id).toBe('titled')
  })

  it('matches a term present in several fields', () => {
    const hits = search(documents, 'noise')
    expect(hits.map((h) => h.document.id).sort()).toEqual(['glossary-1', 'lesson-1', 'lesson-2'])
  })

  it('ranks a title match above a body match', () => {
    const titleHit = scoreDocument(documents[0], 'forward', { titleWeight: 10 })
    const bodyHit = scoreDocument(documents[0], 'sample', { titleWeight: 10 })
    expect(titleHit.score).toBeGreaterThan(bodyHit.score)
  })

  it('ranks a phrase match in the title above a document that merely mentions it', () => {
    const corpus = buildSearchIndex([
      {
        id: 'named-after-it',
        title: 'The closed form',
        summary: 'Sampling any timestep in one step',
        body: 'A short body.',
        kind: 'Lesson',
        href: '#/lessons/closed-form',
      },
      {
        id: 'mentions-it',
        title: 'The closed form of the posterior has the form N(mu, sigma)',
        summary: 'A question about the posterior',
        body: 'The question asks which distribution the posterior takes.',
        kind: 'Practice',
        href: '#/practice',
      },
    ])
    const hits = search(corpus, 'closed form')
    expect(hits[0].document.id).toBe('named-after-it')
  })

  it('respects the result limit', () => {
    expect(search(documents, 'the', { limit: 1 }).length).toBe(1)
  })

  it('lets a kind weight decide between two documents that tie', () => {
    const corpus = buildSearchIndex([
      { id: 'lesson', title: 'The closed form', summary: 's', body: 'a', kind: 'Lesson', href: '#' },
      { id: 'practice', title: 'The closed form', summary: 's', body: 'a', kind: 'Practice', href: '#' },
    ])
    const ranked = search(corpus, 'closed form', { kindWeights: { Lesson: 1.3, Practice: 0.9 } })
    expect(ranked[0].document.id).toBe('lesson')
  })
})
