import { describe, expect, it } from 'vitest'
import { interleave, longestRun } from './interleave'

describe('interleaving', () => {
  const questions = [
    { id: 'a1', lesson: 'alpha' },
    { id: 'a2', lesson: 'alpha' },
    { id: 'a3', lesson: 'alpha' },
    { id: 'b1', lesson: 'beta' },
    { id: 'b2', lesson: 'beta' },
    { id: 'c1', lesson: 'gamma' },
  ]

  it('keeps every item', () => {
    const mixed = interleave(questions, (q) => q.lesson)
    expect(mixed).toHaveLength(questions.length)
    expect(new Set(mixed.map((q) => q.id))).toEqual(new Set(questions.map((q) => q.id)))
  })

  it('puts two questions of the same lesson next to each other never', () => {
    const mixed = interleave(questions, (q) => q.lesson)
    expect(longestRun(mixed, (q) => q.lesson)).toBe(1)
  })

  it('keeps the order within a lesson', () => {
    const mixed = interleave(questions, (q) => q.lesson)
    const alpha = mixed.filter((q) => q.lesson === 'alpha').map((q) => q.id)
    expect(alpha).toEqual(['a1', 'a2', 'a3'])
  })

  it('spreads a large lesson over several passes', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, lesson: 'alpha' }))
    const mixed = interleave([...many, { id: 'b1', lesson: 'beta' }], (q) => q.lesson)
    // The eight questions of one lesson cannot all be first.
    expect(mixed[0].lesson).toBe('alpha')
    expect(mixed[1].lesson).toBe('beta')
    expect(mixed.filter((q) => q.lesson === 'alpha')).toHaveLength(8)
  })

  it('leaves a list with one group alone', () => {
    const only = questions.filter((q) => q.lesson === 'alpha')
    expect(interleave(only, (q) => q.lesson).map((q) => q.id)).toEqual(['a1', 'a2', 'a3'])
  })

  it('leaves a short list alone', () => {
    expect(interleave([], () => 'x')).toEqual([])
    expect(interleave([{ id: 'a' }], () => 'x')).toEqual([{ id: 'a' }])
  })

  it('does not change the list it was given', () => {
    const before = [...questions]
    interleave(questions, (q) => q.lesson)
    expect(questions).toEqual(before)
  })

  it('is deterministic', () => {
    const first = interleave(questions, (q) => q.lesson)
    const second = interleave(questions, (q) => q.lesson)
    expect(first).toEqual(second)
  })
})

describe('the longest run', () => {
  it('is one for a mixed list', () => {
    expect(longestRun([{ g: 'a' }, { g: 'b' }, { g: 'a' }], (x) => x.g)).toBe(1)
  })

  it('counts a run of the same group', () => {
    expect(longestRun([{ g: 'a' }, { g: 'a' }, { g: 'a' }, { g: 'b' }], (x) => x.g)).toBe(3)
  })

  it('is zero for an empty list', () => {
    expect(longestRun([], () => 'a')).toBe(0)
  })
})
