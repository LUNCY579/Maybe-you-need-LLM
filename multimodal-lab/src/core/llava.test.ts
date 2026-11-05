import { describe, expect, it } from 'vitest'
import {
  OBJECTS,
  SUBJECTS,
  answerIsExact,
  buildCaptions,
  generateInstructionData,
  instructionsFromCaption,
  project,
  projectionMatrix,
  projectionReport,
} from './llava'

describe('the projection', () => {
  it('has one row per vision dimension and one column per language dimension', () => {
    const matrix = projectionMatrix(12, 7, 3)
    expect(matrix.length).toBe(12)
    for (const row of matrix) expect(row.length).toBe(7)
  })

  it('is deterministic in the seed and different across seeds', () => {
    expect(projectionMatrix(8, 5, 2)).toEqual(projectionMatrix(8, 5, 2))
    expect(projectionMatrix(8, 5, 2)).not.toEqual(projectionMatrix(8, 5, 3))
  })

  it('changes the width of a token and not its count', () => {
    const matrix = projectionMatrix(6, 4, 5)
    const token = [0.1, -0.2, 0.3, 0.4, 0.5, -0.6]
    const projected = project(matrix, token)
    expect(projected.length).toBe(4)
  })

  it('sends a one-hot token to the corresponding row of the matrix', () => {
    const matrix = projectionMatrix(5, 3, 7)
    const oneHot = [1, 0, 0, 0, 0]
    expect(project(matrix, oneHot)).toEqual(matrix[0])
  })

  it('adds the bias once per output coordinate', () => {
    const matrix = projectionMatrix(4, 3, 8)
    const token = [0.5, -0.5, 0.25, 0]
    const bias = [0.1, 0.2, 0.3]
    const withBias = project(matrix, token, bias)
    const without = project(matrix, token)
    for (let index = 0; index < 3; index++) {
      expect(withBias[index]).toBeCloseTo((without[index] ?? 0) + (bias[index] ?? 0), 12)
    }
  })

  it('throws on a non-positive dimension', () => {
    expect(() => projectionMatrix(0, 4)).toThrow(RangeError)
    expect(() => projectionMatrix(4, -1)).toThrow(RangeError)
  })

  it('counts the parameters from the widths, not from the number of tokens', () => {
    const report = projectionReport({ visionWidth: 1024, languageWidth: 4096, tokens: 576 })
    expect(report.matrixParameters).toBe(1024 * 4096)
    expect(report.biasParameters).toBe(4096)
    expect(report.parameters).toBe(1024 * 4096 + 4096)
    expect(report.outputWidth).toBe(4096)
    const fewerTokens = projectionReport({ visionWidth: 1024, languageWidth: 4096, tokens: 4 })
    expect(fewerTokens.parameters).toBe(report.parameters)
    expect(fewerTokens.tokens).toBe(4)
  })

  it('matches the worked example in the equation reference', () => {
    const report = projectionReport()
    expect(report.parameters).toBe(4_198_400)
    expect(report.tokens).toBe(576)
  })
})

describe('the captions', () => {
  it('are deterministic in the seed and respect the count', () => {
    const a = buildCaptions(8, 4)
    const b = buildCaptions(8, 4)
    expect(a).toEqual(b)
    expect(a.length).toBe(8)
    expect(buildCaptions(8, 5)).not.toEqual(a)
  })

  it('name a subject, an object and a support, and say so in the text', () => {
    for (const caption of buildCaptions(24, 3)) {
      expect(SUBJECTS).toContain(caption.subject)
      expect(OBJECTS).toContain(caption.object)
      expect(caption.text).toBe(`a ${caption.subject} and a ${caption.object} on the ${caption.support}.`)
    }
  })
})

describe('the instruction data', () => {
  const caption = { subject: 'cat', object: 'ball', support: 'table', text: 'a cat and a ball on the table.' }

  it('writes one pair of each kind from one caption', () => {
    const data = instructionsFromCaption(caption)
    expect(data.map((entry) => entry.kind)).toEqual(['describe', 'presence', 'absence', 'count', 'relation'])
    expect(data.every((entry) => entry.caption === caption.text)).toBe(true)
  })

  it('answers every question from the caption alone', () => {
    for (const entry of instructionsFromCaption(caption)) {
      expect(answerIsExact(entry), entry.kind).toBe(true)
    }
  })

  it('asks about an object that is present for yes, and one that is absent for no', () => {
    const data = instructionsFromCaption(caption)
    const presence = data.find((entry) => entry.kind === 'presence')!
    const absence = data.find((entry) => entry.kind === 'absence')!
    expect(presence.question).toContain('a cat')
    expect(presence.answer).toBe('Yes.')
    expect(absence.question).not.toContain('a cat')
    expect(absence.question).not.toContain('a ball')
    expect(absence.answer).toBe('No.')
  })

  it('counts the two objects and names the relation', () => {
    const data = instructionsFromCaption(caption)
    expect(data.find((entry) => entry.kind === 'count')?.answer).toBe('2.')
    expect(data.find((entry) => entry.kind === 'relation')?.answer).toBe('A ball.')
  })

  it('reports a fixed number of pairs per caption, and counts each kind', () => {
    const { data, report } = generateInstructionData(buildCaptions(6, 2))
    expect(report.captions).toBe(6)
    expect(report.perCaption).toBe(5)
    expect(report.total).toBe(30)
    expect(report.byKind).toEqual({ describe: 6, presence: 6, absence: 6, count: 6, relation: 6 })
    expect(data.every(answerIsExact)).toBe(true)
  })
})
