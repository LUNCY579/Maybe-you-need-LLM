/**
 * The attention core, tested.
 *
 * Three kinds of claim are checked here, and the distinction matters:
 *
 * 1. *Algebra.* The OV circuit and the factored `W_O (W_V x)` route are the same
 *    vector; the QK circuit reproduces the query-key dot product; the pathway
 *    terms sum to the effect measured by ablation. These are identities, so they
 *    are checked on seeded random weights — a hand-wired model could pass them by
 *    luck, and random weights cannot.
 * 2. *Machinery.* Attention rows sum to one, nothing crosses the causal
 *    boundary, a patch of a head by its own outputs changes nothing.
 * 3. *Meaning.* A two-layer model wired the way the induction circuit is wired
 *    does predict the successor of an earlier occurrence, and the reason it does
 *    is the path from the previous-token head into the *keys* of the induction
 *    head. Path patching is charged with finding exactly that, and the test says
 *    what the alternative would have been: zero on the query path, everything on
 *    the key path.
 */

import { describe, expect, it } from 'vitest'
import {
  ablateHeads,
  attentionPattern,
  basis,
  circuitShape,
  decomposePathway,
  dominantTerm,
  emptyHead,
  execute,
  headOutputs,
  headRun,
  headScores,
  logitDifference,
  normalise,
  ovWrites,
  patchComponent,
  patchPath,
  qkCircuit,
  queryPathway,
  rankOne,
  randomModel,
  runModel,
  valueWrites,
  type AttentionModel,
} from './attention'
import type { Measure } from './attention'
import { dot, identity, matVec, type Vector } from '@llm-materials/course-core'

/* ------------------------------------------------------------------ fixtures */

/** A seeded model, so every random test is reproducible. */
const model = randomModel({ seed: 11, layers: [2, 2], dimension: 12, keyDimension: 3 })
const tokens = [0, 1, 2, 3, 4, 5]
const clean = runModel(model, tokens)

const measureFor = (position: number, winner: number, loser: number): Measure => ({ position, winner, loser })

/**
 * The wired induction model.
 *
 * Tokens are one-hot in dimensions 0..7 and the readout reads those dimensions
 * only, so a logit is a coordinate of the stream. The previous-token head writes
 * each token's predecessor into dimensions 8..15; the induction head matches the
 * current token against those shifted keys and copies, with gain, the token it
 * lands on. Nothing here was trained — the wiring is the claim.
 */
function buildInductionModel(): AttentionModel {
  const dimension = 16
  const vocabulary = 8
  const shell = { dimension, keyDimension: 8, valueDimension: 8 }

  const embedding = Array.from({ length: vocabulary }, (_, token) => basis(dimension, token))
  const readout = Array.from({ length: vocabulary }, (_, token) => basis(dimension, token))

  // Layer 0: a positional head. Zero content weights, a bias that puts all the
  // attention on distance 1, and a value circuit that shifts dims 0..7 up into
  // dims 8..15.
  const previousToken = emptyHead('previous token', shell)
  previousToken.distanceBias = [0, 12]
  // value: keep dimensions 0..7 of the stream. output: write them back into
  // dimensions 8..15. Together the OV circuit is a shift by eight.
  previousToken.value = Array.from({ length: shell.valueDimension }, (_, row) =>
    Array.from({ length: dimension }, (_, column) => (row === column ? 1 : 0)),
  )
  previousToken.output = Array.from({ length: dimension }, (_, row) =>
    Array.from({ length: shell.valueDimension }, (_, column) => (row === column + 8 ? 1 : 0)),
  )

  // Layer 1: match the query's dims 0..7 against the keys' dims 8..15, and write
  // the attended token's own dims 0..7 back with gain.
  const induction = emptyHead('induction head', shell)
  induction.temperature = 0.02
  induction.query = Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: dimension }, (_, column) => (row === column ? 1 : 0)),
  )
  induction.key = Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: dimension }, (_, column) => (row + 8 === column ? 1 : 0)),
  )
  induction.value = Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: dimension }, (_, column) => (row === column ? 1 : 0)),
  )
  induction.output = Array.from({ length: dimension }, (_, row) =>
    Array.from({ length: 8 }, (_, column) => (row === column ? 4 : 0)),
  )

  return { dimension, keyDimension: 8, valueDimension: 8, vocabulary, embedding, readout, layers: [[previousToken], [induction]] }
}

/** A sequence that repeats one bigram, with a token at the front that never returns. */
const induced = [7, 0, 1, 2, 0, 1, 2]
const inductionModel = buildInductionModel()

/* ------------------------------------------------------------------ 1. algebra */

describe('the circuit factorisation', () => {
  it('makes the OV circuit and the factored W_O (W_V x) route the same vector', () => {
    for (const layer of model.layers) {
      for (const head of layer) {
        for (const input of clean.inputs[0]) {
          const factored = valueWrites(head, input)
          const combined = ovWrites(head, input)
          const gap = Math.max(...factored.map((value, index) => Math.abs(value - combined[index])))
          expect(gap).toBeLessThan(1e-12)
        }
      }
    }
  })

  it('scores the same whether the QK circuit is applied as one matrix or as two', () => {
    for (const layer of model.layers) {
      for (const head of layer) {
        const circuit = qkCircuit(head)
        const scale = Math.sqrt(head.query.length)
        const scores = headScores(head, clean.inputs[0])
        for (let i = 0; i < clean.inputs[0].length; i++) {
          for (let j = 0; j <= i; j++) {
            const through = dot(clean.inputs[0][i], matVec(circuit, clean.inputs[0][j])) / scale
            expect(scores[i][j]).toBeCloseTo(through, 12)
          }
        }
      }
    }
  })

  it('reads a rank-one circuit as a direction to write and a direction to look along', () => {
    const write = [1, 2, 3]
    const read = [0.5, -1, 2]
    const matrix = rankOne(write, read)
    const input = [1, 0, 1]
    const through = matVec(matrix, input)
    const expected = write.map((value) => value * dot(read, input))
    expect(through).toEqual(expected)
  })

  it('counts a circuit’s shape the way the closed form says', () => {
    const write = [1, 2, 3]
    const dense = rankOne(write, [0.5, -1, 2])
    // A rank-one matrix from two fully-populated vectors fills every cell, its
    // Frobenius norm is the product of the two lengths, and its biggest entry is
    // the product of the two biggest.
    expect(circuitShape(dense).nonZero).toBe(9)
    expect(circuitShape(dense).cells).toBe(9)
    expect(circuitShape(dense).frobenius).toBeCloseTo(Math.sqrt(14) * Math.sqrt(5.25), 12)
    expect(circuitShape(dense).largest).toBeCloseTo(6, 12)

    // Read along one basis vector and the circuit is three cells wide, not nine.
    const sparse = circuitShape(rankOne(write, basis(3, 1)))
    expect(sparse.nonZero).toBe(3)
    expect(sparse.frobenius).toBeCloseTo(Math.sqrt(14), 12)
    expect(sparse.largest).toBeCloseTo(3, 12)
  })
})

describe('the pathway decomposition', () => {
  it('sums to the head effect measured by ablation, on every last-layer head and position', () => {
    const last = model.layers.length - 1
    for (let head = 0; head < model.layers[last].length; head++) {
      for (let position = 1; position < tokens.length; position++) {
        const measure = measureFor(position, 2, 5)
        const pathway = decomposePathway(model, clean, { layer: last, head, position, measure })
        expect(Math.abs(pathway.discrepancy)).toBeLessThan(1e-9)
      }
    }
  })

  it('keeps its terms consistent with the sum', () => {
    const pathway = decomposePathway(model, clean, { layer: 1, head: 0, position: 4, measure: measureFor(4, 1, 3) })
    for (const term of pathway.terms) expect(term.term).toBeCloseTo(term.attention * term.writes, 12)
    expect(pathway.total).toBeCloseTo(
      pathway.terms.reduce((acc, term) => acc + term.term, 0),
      12,
    )
    expect(pathway.terms.length).toBe(5)
  })

  it('gives the whole weight of a pointwise head to its own position', () => {
    const single = randomModel({ seed: 3, layers: [1], dimension: 8, keyDimension: 2, vocabulary: 6 })
    const only = runModel(single, [0, 1, 2, 3])
    const pathway = decomposePathway(single, only, { layer: 0, head: 0, position: 0, measure: measureFor(0, 1, 4) })
    expect(pathway.terms.length).toBe(1)
    expect(pathway.terms[0].attention).toBeCloseTo(1, 12)
    expect(Math.abs(pathway.discrepancy)).toBeLessThan(1e-12)
  })

  it('refuses to decompose a head that is not in the last layer', () => {
    expect(() => decomposePathway(model, clean, { layer: 0, head: 0, position: 3, measure: measureFor(3, 1, 2) })).toThrow(
      /last layer/,
    )
  })

  it('names the largest term of a pathway', () => {
    const pathway = decomposePathway(model, clean, { layer: 1, head: 1, position: 5, measure: measureFor(5, 0, 4) })
    const best = dominantTerm(pathway)
    for (const term of pathway.terms) expect(Math.abs(term.term)).toBeLessThanOrEqual(Math.abs(best.term) + 1e-15)
  })

  it('reports the attention and score of every source position a head could look at', () => {
    const pathway = queryPathway(model.layers[1][0], clean, { layer: 1, head: 0, position: 3 })
    expect(pathway.length).toBe(4)
    expect(pathway.reduce((acc, item) => acc + item.attention, 0)).toBeCloseTo(1, 12)
  })
})

/* ---------------------------------------------------------------- 2. machinery */

describe('attention', () => {
  it('normalises every row and leaves the future at zero', () => {
    for (let layer = 0; layer < model.layers.length; layer++) {
      for (let head = 0; head < model.layers[layer].length; head++) {
        const pattern = headRun(clean, layer, head).pattern
        pattern.forEach((row, i) => {
          expect(row.reduce((acc, value) => acc + value, 0)).toBeCloseTo(1, 12)
          for (let j = i + 1; j < row.length; j++) expect(row[j]).toBe(0)
        })
      }
    }
  })

  it('sends the first position to itself, because there is nowhere else to go', () => {
    const pattern = headRun(clean, 0, 0).pattern
    expect(pattern[0][0]).toBeCloseTo(1, 12)
  })

  it('spreads a head with no weights and no bias evenly over its prefix', () => {
    const head = emptyHead('uniform', { dimension: 4, keyDimension: 2, valueDimension: 4 })
    head.output = identity(4)
    head.value = identity(4)
    const inputs = [
      [1, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 0, 3, 0],
    ]
    const result = headOutputs(head, inputs)
    expect(result.pattern[2].slice(0, 3).every((weight) => Math.abs(weight - 1 / 3) < 1e-9)).toBe(true)
    expect(result.outputs[2]).toEqual([1 / 3, 2 / 3, 1, 0])
  })

  it('makes a head that looks only at itself write its own OV image', () => {
    const head = emptyHead('pointwise', { dimension: 4, keyDimension: 2, valueDimension: 4 })
    head.output = identity(4)
    head.value = identity(4)
    head.distanceBias = [12]
    const inputs = [
      [1, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 0, 3, 0],
    ]
    const result = headOutputs(head, inputs)
    expect(result.outputs[2][2]).toBeGreaterThan(2.999)
    expect(result.outputs[2][1]).toBeLessThan(1e-4)
    expect(result.pattern[2][2]).toBeGreaterThan(0.9999)
  })

  it('lets a distance bias alone move all the attention to the previous token', () => {
    const head = emptyHead('previous token', { dimension: 4, keyDimension: 2, valueDimension: 4 })
    head.distanceBias = [0, 12]
    const pattern = attentionPattern(head, [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]])
    expect(pattern[2][1]).toBeGreaterThan(0.9999)
    expect(pattern[2][2]).toBeLessThan(1e-4)
  })
})

describe('runs and patches', () => {
  it('treats ablation with no targets as the plain run', () => {
    const untouched = ablateHeads(model, tokens, [])
    expect(untouched.logits).toEqual(clean.logits)
    expect(untouched.final).toEqual(clean.final)
  })

  it('changes nothing when a head is patched with the outputs it already had', () => {
    const report = patchComponent(model, clean, clean, { layer: 1, head: 0 }, measureFor(5, 2, 3))
    expect(report.effect).toBeCloseTo(0, 12)
    expect(report.cleanMetric).toBeCloseTo(logitDifference(clean, measureFor(5, 2, 3)), 12)
  })

  it('changes nothing when every head is patched with its own outputs', () => {
    const replaced = clean.heads.map((head) => ({ layer: head.layer, head: head.head, outputs: head.outputs }))
    const rebuilt = execute(model, tokens, { replaced })
    expect(rebuilt.logits).toEqual(clean.logits)
  })

  it('refuses a path patch whose source cannot reach its target', () => {
    expect(() =>
      patchPath(
        model,
        clean,
        clean,
        { from: { layer: 1, head: 0 }, to: { layer: 1, head: 1 }, circuits: ['key'] },
        measureFor(5, 1, 2),
      ),
    ).toThrow(/cannot reach/)
    expect(() =>
      patchPath(model, clean, clean, { from: { layer: 1, head: 0 }, to: { layer: 0, head: 0 }, circuits: ['key'] }, measureFor(5, 1, 2)),
    ).toThrow(/cannot reach/)
  })

  it('normalises an effect against the gap it is measured from', () => {
    const reports = [
      patchComponent(model, clean, clean, { layer: 1, head: 0 }, measureFor(5, 2, 3)),
      patchComponent(model, clean, clean, { layer: 1, head: 1 }, measureFor(5, 2, 3)),
    ]
    const gap = 4
    const scaled = normalise(reports, gap)
    expect(scaled[0].fraction).toBeCloseTo(reports[0].effect / gap, 12)
    expect(normalise(reports, 0)[0].fraction).toBe(0)
  })
})

/* ------------------------------------------------------------------ 3. meaning */

describe('the wired induction circuit', () => {
  const run = runModel(inductionModel, induced)

  it('predicts the successor of an earlier occurrence', () => {
    for (const position of [4, 5]) {
      const logits = run.logits[position]
      const best = logits.reduce((acc, value, index) => (value > logits[acc] ? index : acc), 0)
      expect(best).toBe(induced[position + 1])
    }
  })

  it('puts its attention on the token after the match, not on the match itself', () => {
    const pattern = headRun(run, 1, 0).pattern
    // At position 4 the earlier `0` sits at index 1, so the copy comes from index 2.
    expect(pattern[4][2]).toBeGreaterThan(0.99)
    expect(pattern[4][1]).toBeLessThan(0.01)
  })

  it('loses the prediction entirely when the previous-token head is ablated', () => {
    const ablated = ablateHeads(inductionModel, induced, [{ layer: 0, head: 0 }])
    for (const position of [4, 5]) {
      const logits = ablated.logits[position]
      const best = logits.reduce((acc, value, index) => (value > logits[acc] ? index : acc), 0)
      expect(best).not.toBe(induced[position + 1])
    }
  })

  it('finds the whole effect on the key path and none of it on the query path', () => {
    const ablatedRun = ablateHeads(inductionModel, induced, [{ layer: 0, head: 0 }])
    const measure = measureFor(4, induced[5], induced[4])

    const component = patchComponent(inductionModel, run, ablatedRun, { layer: 0, head: 0 }, measure)
    const keyPath = patchPath(
      inductionModel,
      run,
      ablatedRun,
      { from: { layer: 0, head: 0 }, to: { layer: 1, head: 0 }, circuits: ['key'] },
      measure,
    )
    const queryPath = patchPath(
      inductionModel,
      run,
      ablatedRun,
      { from: { layer: 0, head: 0 }, to: { layer: 1, head: 0 }, circuits: ['query'] },
      measure,
    )
    const valuePath = patchPath(
      inductionModel,
      run,
      ablatedRun,
      { from: { layer: 0, head: 0 }, to: { layer: 1, head: 0 }, circuits: ['value'] },
      measure,
    )

    // The previous-token head writes only into dimensions the induction head
    // reads through its keys, so the key path carries the whole effect and the
    // other two carry none of it. That is the framework's claim, and these four
    // numbers are it.
    expect(Math.abs(queryPath.effect)).toBeLessThan(1e-12)
    expect(Math.abs(valuePath.effect)).toBeLessThan(1e-12)
    expect(keyPath.effect).toBeCloseTo(component.effect, 12)
    expect(Math.abs(component.effect)).toBeGreaterThan(0.1)
  })

  it('has a previous-token head that writes the predecessor into the upper half of the stream', () => {
    const written = headRun(run, 0, 0).outputs
    expect(written.length).toBe(induced.length)
    for (let position = 1; position < induced.length; position++) {
      const vector: Vector = written[position]
      expect(vector[induced[position - 1] + 8]).toBeGreaterThan(0.999)
      // It writes into the shifted half only, so it cannot disturb a logit.
      for (let dimension = 0; dimension < 8; dimension++) expect(vector[dimension]).toBe(0)
    }
  })

  it('leaves the last position of the stream with no shifted token of its own', () => {
    // Position 0 has no predecessor, so its only option is itself — the artifact
    // a real previous-token head has too, and the reason the test sequences start
    // with a token that never returns.
    const vector = headRun(run, 0, 0).outputs[0]
    expect(vector[induced[0] + 8]).toBeGreaterThan(0.999)
  })
})
