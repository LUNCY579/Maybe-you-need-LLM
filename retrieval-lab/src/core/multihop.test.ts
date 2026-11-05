import { describe, expect, it } from 'vitest'
import {
  buildMultiHopWorld,
  compareMultiHop,
  evidenceRanks,
  maxSimVectors,
  multiHopCurve,
} from './multihop'

const world = buildMultiHopWorld()

describe('the multi-hop question', () => {
  it('is deterministic for a given seed', () => {
    const other = buildMultiHopWorld()
    expect(other.documents.map((document) => document.symbols)).toEqual(
      world.documents.map((document) => document.symbols),
    )
    expect(other.questions.map((question) => question.evidence)).toEqual(
      world.questions.map((question) => question.evidence),
    )
  })

  it('gives every question two evidence documents, one per aspect', () => {
    for (const question of world.questions) {
      const [first, second] = question.evidence.map((id) => world.documents.find((entry) => entry.id === id)!)
      expect(first.role).toBe('evidence')
      expect(second.role).toBe('evidence')
      expect(first.aspect).not.toBe(second.aspect)
      expect(question.tokens.length).toBe(2)
    }
  })

  it('lets the lexical retriever find one hop and never both', () => {
    const result = compareMultiHop(world, 10)
    expect(result.lexical.both).toBe(0)
    expect(result.lexical.atLeastOne).toBe(1)
    expect(result.lexical.meanRank).toBe(1)
  })

  it('loses both hops to dilution in a single vector, at a shallow depth', () => {
    const result = compareMultiHop(world, 10)
    expect(result.dense.both).toBe(0)
    expect(result.dense.atLeastOne).toBe(0)
    expect(result.dense.meanRank).toBeGreaterThan(10)
  })

  it('finds both hops immediately with the late interaction', () => {
    const result = compareMultiHop(world, 10)
    expect(result.late.both).toBe(1)
    expect(result.late.meanRank).toBeLessThan(3)
  })

  it('gives the dense retriever the hops back at depth, and the lexical one never', () => {
    const curve = multiHopCurve(world, 30)
    const last = curve[curve.length - 1]!
    expect(last.dense).toBeGreaterThan(0)
    expect(last.lexical).toBe(0)
    expect(last.late).toBe(1)
    expect(curve[1]!.late).toBe(1)
  })

  it('ranks the two evidence documents first and second under late interaction', () => {
    for (const question of world.questions) {
      const ranks = evidenceRanks(world, question)
      expect(ranks.late[0]).toBeLessThanOrEqual(2)
      expect(ranks.late[1]).toBeLessThanOrEqual(2)
    }
  })

  it('scores MaxSim as the sum of each token’s best match', () => {
    const question = [
      [1, 0],
      [0, 1],
    ]
    const document = [
      [1, 0],
      [0.5, 0.5],
    ]
    expect(maxSimVectors(question, document)).toBeCloseTo(1.5, 12)
  })
})
