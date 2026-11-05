/**
 * The shared circuit fixture, tested against the wiring it claims.
 *
 * `circuitDiscovery.test.ts` grades a search on this model, so the model itself
 * has to be checked first: if the fixture did not actually run the induction
 * circuit, a search that "finds" it would be finding whatever is there instead.
 * The ground truth here is the wiring — three heads, five matrices each — and the
 * assertions below are all read off it.
 */

import { describe, expect, it } from 'vitest'
import { ablateHeads, headRun, logitDifference, runModel } from './attention'
import {
  BLOCKS,
  CORRUPTION_SITES,
  INDUCTION_SEQUENCE,
  INDUCTION_TEST_POSITIONS,
  INDUCTION_TOKENS,
  buildInductionModel,
  corruptionSite,
  inductionCircuitEdges,
  inductionModel,
  inductionTargets,
  namedHead,
  sitePosition,
  type CorruptionSite,
} from './inductionModel'

const run = runModel(inductionModel, INDUCTION_SEQUENCE)

/** The token the stream currently scores highest at a position. */
function argmax(position: number): number {
  const logits = run.logits[position] ?? []
  return logits.reduce((best, value, index) => (value > (logits[best] ?? -Infinity) ? index : best), 0)
}

describe('the fixture', () => {
  it('is a two-layer model with a distractor head in the first layer', () => {
    expect(inductionModel.layers.map((layer) => layer.map((head) => head.name))).toEqual([
      ['previous-token head', 'duplicate-token head'],
      ['induction head'],
    ])
    expect(inductionModel.dimension).toBe(18)
    expect(run.heads.length).toBe(3)
  })

  it('predicts the successor of the earlier occurrence at every test position', () => {
    for (const { position, expected } of inductionTargets()) {
      expect(argmax(position)).toBe(expected)
    }
    expect(inductionTargets().map((target) => target.position)).toEqual([...INDUCTION_TEST_POSITIONS])
  })

  it('scores the expected token above the token sitting at the position itself', () => {
    // The copy has to beat the embedding, which is why its gain is larger.
    for (const { position, expected } of inductionTargets()) {
      const token = INDUCTION_SEQUENCE[position] ?? -1
      const logits = run.logits[position] ?? []
      expect((logits[expected] ?? 0) - (logits[token] ?? 0)).toBeGreaterThan(2)
    }
  })

  it('writes the predecessor into the shifted block and nothing else', () => {
    const written = namedHead(run, 'previous-token head').outputs
    written.forEach((vector, position) => {
      // Position 0 has no predecessor, so the only thing it can look at is itself.
      const predecessor = INDUCTION_SEQUENCE[Math.max(0, position - 1)]
      vector.forEach((value, dimension) => {
        const inShiftedBlock = dimension >= BLOCKS.shifted && dimension < BLOCKS.marker
        // The head is hard but not a delta function: exp(-240) is small, not zero.
        expect(value).toBeCloseTo(inShiftedBlock && dimension - BLOCKS.shifted === predecessor ? 1 : 0, 9)
      })
    })
  })

  it('makes the induction head look at the token after the match', () => {
    for (const { position, match } of inductionTargets()) {
      const pattern = headRun(run, 1, 0).pattern[position] ?? []
      expect(pattern[match] ?? 0).toBeGreaterThan(0.99)
    }
  })

  it('has a duplicate-token head that reads identity and writes the marker block', () => {
    const outputs = namedHead(run, 'duplicate-token head').outputs
    // It fires — position 6 has seen token 2 before — but what it writes is
    // nowhere near the logit coordinates or the induction head's keys.
    const fires = outputs.some((vector) => vector.some((value) => value > 0))
    expect(fires).toBe(true)
    for (const vector of outputs) {
      for (let dimension = 0; dimension < BLOCKS.marker; dimension++) expect(vector[dimension]).toBe(0)
    }
  })

  it('loses the induction prediction when the previous-token head is ablated', () => {
    const ablated = ablateHeads(inductionModel, INDUCTION_SEQUENCE, [{ layer: 0, head: 0 }])
    for (const { position, expected } of inductionTargets()) {
      const logits = ablated.logits[position] ?? []
      const best = logits.reduce((b, value, index) => (value > (logits[b] ?? -Infinity) ? index : b), 0)
      expect(best).not.toBe(expected)
    }
  })

  it('keeps the metric identical when only the distractor is ablated', () => {
    const measure = { position: 5, winner: 2, loser: 1 }
    const ablated = ablateHeads(inductionModel, INDUCTION_SEQUENCE, [{ layer: 0, head: 1 }])
    expect(logitDifference(ablated, measure)).toBeCloseTo(logitDifference(run, measure), 12)
  })

  it('names a head only when it exists', () => {
    expect(() => namedHead(run, 'name mover')).toThrow(/no head/)
  })

  it('is rebuilt identically, so a screen cannot mutate the shared model', () => {
    const fresh = buildInductionModel()
    expect(fresh.layers.map((layer) => layer.length)).toEqual(inductionModel.layers.map((layer) => layer.length))
    expect(fresh.dimension).toBe(inductionModel.dimension)
    expect(INDUCTION_TOKENS.length).toBe(6)
  })
})

/**
 * The two positions a reader may corrupt. A screen and a terminal runner both build
 * their scenario from these, so the mapping from a site to a position is the join
 * between them and has to be pinned.
 */
describe('the corruption sites', () => {
  it('lands the occurrence on the duplicate and the successor on the answer', () => {
    for (const target of inductionTargets()) {
      expect(sitePosition(target, 'occurrence')).toBe(target.match - 1)
      expect(sitePosition(target, 'successor')).toBe(target.match)
      expect(INDUCTION_SEQUENCE[sitePosition(target, 'occurrence')]).toBe(INDUCTION_SEQUENCE[target.position])
      expect(INDUCTION_SEQUENCE[sitePosition(target, 'successor')]).toBe(target.expected)
    }
  })

  it('offers exactly the two sites a reader can choose', () => {
    expect(CORRUPTION_SITES.map((entry) => entry.value)).toEqual<CorruptionSite[]>(['occurrence', 'successor'])
    for (const entry of CORRUPTION_SITES) {
      expect(corruptionSite(entry.value)).toBe(entry)
      expect(entry.role.length).toBeGreaterThan(0)
      expect(entry.note.length).toBeGreaterThan(20)
    }
    expect(() => corruptionSite('middle' as CorruptionSite)).toThrow(/no site/)
  })

  it('takes the induction behaviour away from either one', () => {
    // A corruption that left the metric alone would send the search looking for a
    // circuit behind a behaviour that never went missing.
    const measure = { position: 5, winner: 2, loser: 1 }
    const target = inductionTargets()[0]!
    for (const entry of CORRUPTION_SITES) {
      const tokens = [...INDUCTION_SEQUENCE]
      tokens[sitePosition(target, entry.value)] = 5
      expect(logitDifference(runModel(inductionModel, tokens), measure)).toBeLessThan(
        logitDifference(run, measure),
      )
    }
  })

  it('names four edges, one at each step of the copy', () => {
    expect(inductionCircuitEdges()).toEqual([
      'embed->0:0:value',
      'embed->1:0:value',
      '0:0->1:0:key',
      '1:0->logit:logit',
    ])
  })
})
