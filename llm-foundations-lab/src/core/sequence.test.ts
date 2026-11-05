import { describe, expect, it } from 'vitest'
import { attentionWorkRatio, convolutionDepth, sequenceComparison } from './sequence'

describe('the sequence architectures', () => {
  it('compares the three architectures at a fixed length', () => {
    const rows = sequenceComparison(256, 3)
    expect(rows.map((row) => row.kind)).toEqual(['cnn', 'rnn', 'attention'])
    for (const row of rows) expect(row.receptiveField).toBe(256)
  })

  it('gives attention a path of one and recurrence a path of n', () => {
    const rows = sequenceComparison(128, 3)
    const attention = rows.find((row) => row.kind === 'attention')!
    const recurrence = rows.find((row) => row.kind === 'rnn')!
    expect(attention.path).toBe(1)
    expect(recurrence.path).toBe(128)
    expect(attention.parallel).toBe(true)
    expect(recurrence.parallel).toBe(false)
  })

  it('needs a logarithmic stack of convolutions to see the whole sequence', () => {
    expect(convolutionDepth(256, 3)).toBe(6)
    expect(convolutionDepth(256, 3)).toBe(sequenceComparison(256, 3)[0]!.path)
    expect(convolutionDepth(9, 3)).toBe(2)
  })

  it('pays quadratic work for attention', () => {
    const rows = sequenceComparison(64, 4)
    const attention = rows.find((row) => row.kind === 'attention')!
    const recurrence = rows.find((row) => row.kind === 'rnn')!
    expect(attention.work).toBe(64 * 64)
    expect(attention.work / recurrence.work).toBe(64)
    expect(attentionWorkRatio(64)).toBe(64)
  })
})
