/**
 * The circuit search, tested against a circuit we wired ourselves.
 *
 * This is the reason the search is run on the hand-wired induction model rather
 * than on a random one: on a random model the only claim available is "the numbers
 * are self-consistent", which is not a claim about circuits at all. On this model
 * the ground truth is the wiring, so the assertions below say what the search must
 * find and what it must refuse to find, and a bug in the completion or in the
 * scoring breaks one of them.
 *
 * The corruption patches out the *earlier occurrence* of the query token: the
 * sequence `[bos a b c d a b c]` becomes `[bos x b c d a b c]`. The question at the
 * last `a` is still being asked; only the memory that answers it is gone.
 */

import { describe, expect, it } from 'vitest'
import { logitDifference, runModel, type Measure, type Run } from './attention'
import { INDUCTION_SEQUENCE, inductionCircuitEdges, inductionModel } from './inductionModel'
import {
  allEdgeIds,
  allEdges,
  allNodes,
  attributeEdges,
  complementEdges,
  completeGraph,
  corruptTokens,
  discoverCircuit,
  edgeNames,
  graphMetric,
  graphQuality,
  headNode,
  nodesInGraph,
  EMBED_NODE,
  READOUT_NODE,
} from './circuitDiscovery'

const PREVIOUS = headNode(0, 0)
const DISTRACTOR = headNode(0, 1)
const INDUCTION = headNode(1, 0)

const corruptedTokens = corruptTokens(INDUCTION_SEQUENCE, [{ position: 1, token: 5 }])
const clean = runModel(inductionModel, INDUCTION_SEQUENCE)
const corrupted = runModel(inductionModel, corruptedTokens)

/** The expected successor, against the token at the position itself. */
const measure: Measure = { position: 5, winner: 2, loser: 1 }

const gap = logitDifference(clean, measure) - logitDifference(corrupted, measure)

describe('the graph', () => {
  it('has a node for the embedding, every head and the readout', () => {
    expect(allNodes(inductionModel).map((node) => node.id)).toEqual([
      EMBED_NODE,
      PREVIOUS,
      DISTRACTOR,
      INDUCTION,
      READOUT_NODE,
    ])
  })

  it('gives every head three edges per earlier node, and one logit path', () => {
    const edges = allEdges(inductionModel)
    // layer 0: one source (the embedding) x three circuits x two heads
    // layer 1: three sources (embedding + two heads) x three circuits x one head
    // readout: four sources x one logit edge
    expect(edges.length).toBe(2 * 3 + 3 * 3 + 4)
    expect(edges.filter((edge) => edge.target === READOUT_NODE).every((edge) => edge.circuit === 'logit')).toBe(true)
    expect(edges.filter((edge) => edge.target === EMBED_NODE)).toEqual([])
  })

  it('never joins two heads in the same layer', () => {
    for (const edge of allEdges(inductionModel)) {
      if (edge.source === EMBED_NODE || edge.target === READOUT_NODE) continue
      const [sourceLayer] = edge.source.split(':').map(Number)
      const [targetLayer] = edge.target.split(':').map(Number)
      expect(sourceLayer!).toBeLessThan(targetLayer!)
    }
  })

  it('names an edge the way a report reads', () => {
    const named = allEdges(inductionModel).find((edge) => edge.source === PREVIOUS && edge.target === INDUCTION && edge.circuit === 'key')
    expect(named?.name).toBe('previous-token head → induction head (keys)')
  })

  it('complements a set back to the universe', () => {
    const universe = allEdgeIds(inductionModel)
    const kept = universe.slice(0, 5)
    expect(complementEdges(inductionModel, kept).length).toBe(universe.length - 5)
    expect(complementEdges(inductionModel, universe)).toEqual([])
  })
})

describe('the completion', () => {
  it('reproduces the clean metric when every edge carries the clean signal', () => {
    const kept = allEdgeIds(inductionModel)
    expect(graphMetric(inductionModel, clean, corrupted, kept, measure)).toBeCloseTo(
      logitDifference(clean, measure),
      12,
    )
  })

  it('reproduces the corrupted metric when no edge does', () => {
    expect(graphMetric(inductionModel, clean, corrupted, [], measure)).toBeCloseTo(
      logitDifference(corrupted, measure),
      12,
    )
  })

  it('is symmetric: with the roles swapped, keeping everything gives the corrupted metric', () => {
    const kept = allEdgeIds(inductionModel)
    expect(graphMetric(inductionModel, clean, corrupted, kept, measure, 'clean')).toBeCloseTo(
      logitDifference(corrupted, measure),
      12,
    )
    expect(graphMetric(inductionModel, clean, corrupted, [], measure, 'clean')).toBeCloseTo(
      logitDifference(clean, measure),
      12,
    )
  })

  it('recomputes attention rather than blending two answers', () => {
    // Keeping the composed key edge is what puts the induction head's attention
    // back on the token after the match; a blended run would keep some of the
    // corrupted run's uniform spread.
    const kept = [`${EMBED_NODE}->${PREVIOUS}:value`, `${PREVIOUS}->${INDUCTION}:key`, `${INDUCTION}->${READOUT_NODE}:logit`]
    const completed = completeGraph(inductionModel, clean, corrupted, { kept })
    const pattern = completed.heads.find((head) => head.layer === 1)!.pattern[5]!
    expect(pattern[2]).toBeGreaterThan(0.99)
    // Six nines, not twelve: the heads' attention is hard but written in exp(-240)
    // tails, so the completed stream agrees with the clean one to ~1e-8.
    expect(logitDifference(completed, measure)).toBeCloseTo(logitDifference(clean, measure), 6)
  })

  it('refuses a corrupted run of a different length', () => {
    const short = runModel(inductionModel, INDUCTION_SEQUENCE.slice(0, 4))
    expect(() => completeGraph(inductionModel, clean, short, { kept: allEdgeIds(inductionModel) })).toThrow(/same length/)
  })

  it('patches only inside the range of the sequence', () => {
    expect(() => corruptTokens(INDUCTION_SEQUENCE, [{ position: 99, token: 1 }])).toThrow(/outside a sequence/)
    expect(corruptTokens(INDUCTION_SEQUENCE, [{ position: 1, token: 5 }])).toEqual([0, 5, 2, 3, 4, 1, 2, 3])
    expect(corruptTokens(INDUCTION_SEQUENCE, [])).toEqual(INDUCTION_SEQUENCE)
    expect(INDUCTION_SEQUENCE).toEqual([0, 1, 2, 3, 4, 1, 2, 3])
  })
})

describe('the two criteria', () => {
  it('both reach 1 on the full graph and 0 on an empty one', () => {
    const full = graphQuality(inductionModel, clean, corrupted, measure, allEdgeIds(inductionModel))
    expect(full.faithfulness).toBeCloseTo(1, 9)
    expect(full.completeness).toBeCloseTo(1, 9)
    expect(full.edges).toBe(allEdgeIds(inductionModel).length)
    const empty = graphQuality(inductionModel, clean, corrupted, measure, [])
    expect(empty.faithfulness).toBeCloseTo(0, 9)
    expect(empty.completeness).toBeCloseTo(0, 9)
  })

  it('scales by the behavioural gap it is given', () => {
    expect(gap).toBeGreaterThan(1)
    expect(graphQuality(inductionModel, clean, corrupted, measure, []).gap).toBeCloseTo(gap, 9)
  })

  it('is faithful and complete on the four edges the wiring says matter', () => {
    const quality = graphQuality(inductionModel, clean, corrupted, measure, inductionCircuitEdges())
    expect(quality.faithfulness).toBeCloseTo(1, 6)
    // Complete as well, and that is worth the comment: the corruption replaces the
    // token at position 1, and the only route from position 1 to the answer at
    // position 5 is the shift this graph names. A graph that accounts for the whole
    // route is complete *because* it is faithful here, not by luck.
    expect(quality.completeness).toBeCloseTo(1, 6)
    expect(quality.edges).toBe(4)
  })

  it('is faithful and complete on that same graph under the other corruption', () => {
    // Erase the token that gets copied instead of the one that is matched. The
    // wiring is untouched, so the graph still has to score at both ends — which is
    // what makes it the ground truth rather than a description of one experiment.
    const erased = runModel(inductionModel, corruptTokens(INDUCTION_SEQUENCE, [{ position: 2, token: 5 }]))
    const quality = graphQuality(inductionModel, clean, erased, measure, inductionCircuitEdges())
    expect(quality.faithfulness).toBeCloseTo(1, 6)
    expect(quality.completeness).toBeCloseTo(1, 6)
  })

  it('scores nothing on a graph made only of the distractor head’s edges', () => {
    const distractorOnly = allEdgeIds(inductionModel).filter((id) => id.includes(DISTRACTOR))
    const quality = graphQuality(inductionModel, clean, corrupted, measure, distractorOnly)
    expect(quality.faithfulness).toBeCloseTo(0, 6)
    // Not complete either, and the two numbers say different things: cutting the
    // distractor's edges changes nothing (so this graph leaves the real work
    // outside itself), and keeping only them restores nothing.
    expect(quality.completeness).toBeCloseTo(0, 6)
  })

  it('falls apart when the composed edge is cut', () => {
    const withoutThePath = [`${EMBED_NODE}->${PREVIOUS}:value`, `${INDUCTION}->${READOUT_NODE}:logit`]
    expect(graphQuality(inductionModel, clean, corrupted, measure, withoutThePath).faithfulness).toBeLessThan(0.05)
  })

  it('counts which nodes a graph names', () => {
    const names = nodesInGraph(inductionModel, [`${PREVIOUS}->${INDUCTION}:key`]).map((node) => node.name)
    expect(names).toEqual(['previous-token head', 'induction head'])
  })
})

describe('edge attribution scores', () => {
  const scores = attributeEdges(inductionModel, clean, corrupted, measure)

  it('scores one edge for every edge in the graph', () => {
    expect(scores.length).toBe(allEdgeIds(inductionModel).length)
    expect(scores.every((entry) => Number.isFinite(entry.score))).toBe(true)
  })

  it('puts the whole behaviour on the composed key edge and the mover', () => {
    const key = scores.find((entry) => entry.edge.id === `${PREVIOUS}->${INDUCTION}:key`)!
    const mover = scores.find((entry) => entry.edge.id === `${INDUCTION}->${READOUT_NODE}:logit`)!
    expect(key.score).toBeGreaterThan(0.5)
    expect(mover.score).toBeGreaterThan(0.5)
  })

  it('scores zero on the distractor head, every edge of it', () => {
    const touching = scores.filter((entry) => entry.edge.source === DISTRACTOR || entry.edge.target === DISTRACTOR)
    expect(touching.length).toBeGreaterThan(0)
    for (const entry of touching) expect(Math.abs(entry.score)).toBeLessThan(1e-9)
  })

  it('scores zero where the head reads a block the stream does not write', () => {
    // The previous-token head has no content weights at all, and the induction
    // head's keys read only the shifted block, so these edges carry nothing.
    expect(Math.abs(scores.find((e) => e.edge.id === `${EMBED_NODE}->${PREVIOUS}:query`)!.score)).toBeLessThan(1e-9)
    expect(Math.abs(scores.find((e) => e.edge.id === `${EMBED_NODE}->${PREVIOUS}:key`)!.score)).toBeLessThan(1e-9)
    expect(Math.abs(scores.find((e) => e.edge.id === `${EMBED_NODE}->${INDUCTION}:key`)!.score)).toBeLessThan(1e-9)
    expect(Math.abs(scores.find((e) => e.edge.id === `${PREVIOUS}->${INDUCTION}:value`)!.score)).toBeLessThan(1e-9)
    expect(Math.abs(scores.find((e) => e.edge.id === `${PREVIOUS}->${READOUT_NODE}:logit`)!.score)).toBeLessThan(1e-9)
  })

  it('reads the shift itself as an edge worth keeping', () => {
    const shift = scores.find((entry) => entry.edge.id === `${EMBED_NODE}->${PREVIOUS}:value`)!
    expect(shift.score).toBeGreaterThan(0.01)
  })

  it('only scores the edges a restricted graph contains', () => {
    const kept = [`${PREVIOUS}->${INDUCTION}:key`]
    const restricted = attributeEdges(inductionModel, clean, corrupted, measure, { kept })
    expect(restricted.map((entry) => entry.edge.id)).toEqual(kept)
    // With nothing else in place the edge has no partner, so it moves nothing:
    // a marginal score is not a property of the edge alone.
    expect(Math.abs(restricted[0]!.score)).toBeLessThan(1e-9)
  })
})

describe('the search', () => {
  const search = discoverCircuit(inductionModel, clean, corrupted, measure, { threshold: 0.9 })

  it('deletes one edge per step, down to nothing', () => {
    expect(search.steps.length).toBe(allEdgeIds(inductionModel).length)
    expect(search.steps.map((step) => step.edges)).toEqual(
      Array.from({ length: allEdgeIds(inductionModel).length }, (_, index) => allEdgeIds(inductionModel).length - 1 - index),
    )
  })

  it('reports a faithfulness curve that starts at 1 and ends at 0', () => {
    expect(search.full.faithfulness).toBeCloseTo(1, 9)
    const last = search.steps[search.steps.length - 1]!
    expect(last.edges).toBe(0)
    expect(last.faithfulness).toBeCloseTo(0, 9)
    expect(search.steps.every((step) => step.faithfulness <= 1.0000001)).toBe(true)
  })

  it('prunes everything that writes where nothing reads before the circuit', () => {
    expect(Math.abs(search.steps[0]!.removed.score)).toBeLessThan(1e-9)
    const deletedAt = new Map<string, number>()
    search.steps.forEach((step, index) => deletedAt.set(step.removed.edge.id, index))
    const essential = inductionCircuitEdges()
    // Every edge of the distractor head — its writes, and the reads of them.
    const distractorEdges = allEdgeIds(inductionModel).filter((id) => id.includes(DISTRACTOR))
    expect(distractorEdges.length).toBeGreaterThan(0)
    for (const id of distractorEdges) {
      for (const keptEdge of essential) {
        expect(deletedAt.get(id)!).toBeLessThan(deletedAt.get(keptEdge)!)
      }
    }
    expect(edgeNames(inductionModel, search.discovered).some((name) => name.includes('duplicate'))).toBe(false)
  })

  it('discovers the part of the circuit this corruption can detect', () => {
    // The answer is the pointer, not the copy: erasing the earlier occurrence breaks
    // the match and leaves the copied token alone in both sequences. So the induction
    // head’s own value edge is invisible here, and a search that reported it would be
    // reporting an edge this intervention cannot check.
    expect(search.discovered).toEqual([
      `${EMBED_NODE}->${PREVIOUS}:value`,
      `${PREVIOUS}->${INDUCTION}:key`,
      `${INDUCTION}->${READOUT_NODE}:logit`,
    ])
    for (const edge of search.discovered) expect(inductionCircuitEdges(), edge).toContain(edge)
    expect(search.discoveredEdges).toBe(search.discovered.length)
    expect(search.discoveredEdges).toBeLessThan(allEdgeIds(inductionModel).length / 2)
    const quality = graphQuality(inductionModel, clean, corrupted, measure, search.discovered)
    expect(quality.faithfulness).toBeGreaterThanOrEqual(search.threshold)
    expect(quality.completeness).toBeCloseTo(1, 6)
    // Nothing in the answer flows through the marker block the distractor writes.
    expect(search.discovered.some((id) => id.includes(DISTRACTOR))).toBe(false)
  })

  it('gives the same answer from the same weights, twice', () => {
    const again = discoverCircuit(inductionModel, clean, corrupted, measure, { threshold: 0.9 })
    expect(again.discovered).toEqual(search.discovered)
    expect(again.passes).toBe(search.passes)
  })

  it('stops early when told to', () => {
    const three = discoverCircuit(inductionModel, clean, corrupted, measure, { threshold: 0.9, maxSteps: 3 })
    expect(three.steps.length).toBe(3)
    expect(three.discoveredEdges).toBeGreaterThan(search.discoveredEdges)
  })

  it('starts from a hand-built circuit when asked to', () => {
    const handBuilt = inductionCircuitEdges()
    const pruned = discoverCircuit(inductionModel, clean, corrupted, measure, { threshold: 0.9, kept: handBuilt })
    expect(pruned.full.edges).toBe(4)
    // It still prunes: starting from the right answer is not the same as keeping it,
    // and the edge this corruption cannot see is deleted from a graph that had it.
    expect(pruned.discovered).toEqual(search.discovered)
    expect(pruned.discovered.length).toBeLessThan(handBuilt.length)
  })

  it('reports a graph that needs more edges at a stricter threshold', () => {
    const strict = discoverCircuit(inductionModel, clean, corrupted, measure, { threshold: 1.0001 })
    // Nothing ever clears a threshold no run can reach, so the answer stays the full graph.
    expect(strict.discovered).toEqual(strict.full.kept)
  })
})

describe('the ground truth the search is graded against', () => {
  const edges = inductionCircuitEdges()

  it('names edges of this model and nothing else', () => {
    const universe = new Set(allEdgeIds(inductionModel))
    expect(edges).toHaveLength(4)
    for (const edge of edges) expect(universe.has(edge), edge).toBe(true)
    expect(new Set(edges).size).toBe(edges.length)
  })

  it('names every component the circuit runs through', () => {
    expect(nodesInGraph(inductionModel, edges).map((node) => node.name)).toEqual([
      'the token embedding',
      'previous-token head',
      'induction head',
      'the readout',
    ])
  })

  it('gives each head both of the edges a copy needs', () => {
    // A read and a write per head: the previous-token head is read through its key
    // edge but has to be written through its value edge, or there is no shift to
    // match; the induction head is the same story one step on.
    expect(edges).toContain(`${EMBED_NODE}->${PREVIOUS}:value`)
    expect(edges).toContain(`${PREVIOUS}->${INDUCTION}:key`)
    expect(edges).toContain(`${EMBED_NODE}->${INDUCTION}:value`)
    expect(edges).toContain(`${INDUCTION}->${READOUT_NODE}:logit`)
  })

  it('leaves the distractor out of it', () => {
    expect(edges.some((edge) => edge.includes(DISTRACTOR))).toBe(false)
  })
})

/**
 * The claim the screen makes, stated as a fact about the search rather than about
 * this run of it: an intervention only detects the half of a circuit it disturbs.
 */
describe('what a corruption is able to see', () => {
  const MATCH_AT = `${EMBED_NODE}->${PREVIOUS}:value`
  const KEY_AT = `${PREVIOUS}->${INDUCTION}:key`
  const COPY_AT = `${EMBED_NODE}->${INDUCTION}:value`
  const OUT_AT = `${INDUCTION}->${READOUT_NODE}:logit`

  /** The run with the *other* token erased: the one the head copies. */
  const erasedCopy = runModel(inductionModel, corruptTokens(INDUCTION_SEQUENCE, [{ position: 2, token: 5 }]))

  const faithWithout = (run: Run, edge: string) =>
    graphQuality(inductionModel, clean, run, measure, inductionCircuitEdges().filter((id) => id !== edge)).faithfulness

  it('takes the pointer apart only when the match is erased', () => {
    expect(faithWithout(corrupted, MATCH_AT)).toBeLessThan(0.05)
    expect(faithWithout(corrupted, KEY_AT)).toBeLessThan(0.05)
    expect(faithWithout(erasedCopy, MATCH_AT)).toBeCloseTo(1, 6)
    expect(faithWithout(erasedCopy, KEY_AT)).toBeCloseTo(1, 6)
  })

  it('takes the copy apart only when the answer is erased', () => {
    expect(faithWithout(erasedCopy, COPY_AT)).toBeCloseTo(0, 6)
    expect(faithWithout(corrupted, COPY_AT)).toBeCloseTo(1, 6)
  })

  it('needs the write to the logits under either', () => {
    expect(faithWithout(corrupted, OUT_AT)).toBeCloseTo(0, 6)
    expect(faithWithout(erasedCopy, OUT_AT)).toBeCloseTo(0, 6)
  })

  it('leaves each search a proper subset, and the pair of them the whole circuit', () => {
    const truth = inductionCircuitEdges()
    const fromCopy = discoverCircuit(inductionModel, clean, erasedCopy, measure, { threshold: 0.9 }).discovered
    const fromMatch = discoverCircuit(inductionModel, clean, corrupted, measure, { threshold: 0.9 }).discovered
    const union = new Set([...fromCopy, ...fromMatch])
    expect([...union].sort()).toEqual([...truth].sort())
    expect(fromMatch.length).toBeLessThan(truth.length)
    expect(fromCopy.length).toBeLessThan(truth.length)
    expect(fromCopy.filter((edge) => !fromMatch.includes(edge))).toEqual([COPY_AT])
    expect(fromMatch.filter((edge) => !fromCopy.includes(edge))).toEqual([MATCH_AT, KEY_AT])
    // Neither answer reaches outside the wiring: on a hand-built model an
    // over-reported edge would be a bug in the search, and here it is not one.
    for (const edge of union) expect(truth, edge).toContain(edge)
  })
})
