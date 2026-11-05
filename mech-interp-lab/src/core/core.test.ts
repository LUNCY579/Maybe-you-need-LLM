import { describe, expect, it } from 'vitest'
import {
  buildSuperpositionModel,
  coverage,
  directionLoad,
  generateFeatures,
  importanceThreshold,
  interference,
  superpositionGradient,
  superpositionLoss,
  tradeoffCurve,
} from './superposition.js'
import {
  createAutoencoder,
  decode,
  encode,
  evaluateAutoencoder,
  monosemanticity,
  trainAutoencoder,
} from './sae.js'
import {
  attributeAllNodes,
  buildIndirectObjectGraph,
  computeFrom,
  edgeWeights,
  faithfulness,
  patchNode,
  runCircuit,
  topologicalOrder,
} from './patching.js'

describe('superposition', () => {
  const features = generateFeatures(12, 4, 5)

  it('produces unit input directions', () => {
    for (const feature of features) {
      const norm = Math.sqrt(feature.input.reduce((acc, v) => acc + v * v, 0))
      expect(norm).toBeCloseTo(1, 10)
    }
  })

  it('assigns importances on a power law', () => {
    expect(features[0]!.importance).toBeCloseTo(1, 12)
    expect(features[1]!.importance).toBeLessThan(features[0]!.importance)
    expect(features[1]!.importance).toBeGreaterThan(features[11]!.importance)
  })

  it('has an analytic gradient that matches a finite difference', () => {
    const model = buildSuperpositionModel(features.slice(0, 3), 4, { steps: 60 })
    const gradients = superpositionGradient(features.slice(0, 3), model.columns)

    const epsilon = 1e-4
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < 4; i++) {
        const original = model.columns[k]![i]!
        const up = model.columns.map((column) => column.slice())
        const down = model.columns.map((column) => column.slice())
        up[k]![i] = original + epsilon
        down[k]![i] = original - epsilon
        const numerical =
          (superpositionLoss(features.slice(0, 3), up) - superpositionLoss(features.slice(0, 3), down)) / (2 * epsilon)
        expect(Math.abs(numerical - gradients[k]![i]!)).toBeLessThan(1e-3)
      }
    }
  })

  it('reduces the loss when it takes a gradient step', () => {
    const subset = features.slice(0, 6)
    const model = buildSuperpositionModel(subset, 3, { steps: 0 })
    const before = superpositionLoss(subset, model.columns)
    const gradients = superpositionGradient(subset, model.columns)
    const stepped = model.columns.map((column, k) =>
      column.map((value, i) => value - 0.01 * (gradients[k]![i] ?? 0)),
    )
    expect(superpositionLoss(subset, stepped)).toBeLessThan(before)
  })

  it('interferes more when there are fewer dimensions', () => {
    // With the importances equal, the model has no reason to prefer dropping a
    // feature to interfering with another, and the interference is what it
    // pays for having too few dimensions.
    const equal = generateFeatures(12, 4, 5, 0)
    const roomy = buildSuperpositionModel(equal, 12)
    const cramped = buildSuperpositionModel(equal, 2)
    expect(cramped.interference).toBeGreaterThan(roomy.interference)
  })

  it('superposes when there are more features than dimensions', () => {
    // Equal importances: no feature is worth dropping, so the model packs
    // them together and they interfere.
    const equal = generateFeatures(12, 4, 5, 0)
    const model = buildSuperpositionModel(equal, 2)
    expect(model.represented.length).toBeGreaterThan(2)
    expect(model.interference).toBeGreaterThan(0)
  })

  it('recovers the important features better than the unimportant ones', () => {
    // With a power law of importances the model spends its directions on the
    // features that matter: the first few are recovered well, and the tail is
    // not. This is the importance threshold, measured.
    const model = buildSuperpositionModel(features, 4)
    const recovery = model.recoveryPerFeature
    const first = recovery[0]!
    const last = recovery[recovery.length - 1]!
    expect(first).toBeGreaterThan(last)
  })

  it('keeps the columns on the unit ball', () => {
    const model = buildSuperpositionModel(features, 4)
    for (const column of model.columns) {
      const length = Math.sqrt(column.reduce((acc, v) => acc + v * v, 0))
      expect(length).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('recovers a feature that has a direction of its own', () => {
    const roomy = buildSuperpositionModel(features.slice(0, 2), 8)
    for (const value of roomy.recoveryPerFeature.slice(0, 2)) {
      expect(value).toBeGreaterThan(0.8)
    }
  })

  it('computes the interference between two directions', () => {
    expect(interference([1, 0], [0, 1])).toBeCloseTo(0, 12)
    expect(interference([1, 0], [1, 0])).toBeCloseTo(1, 12)
  })

  it('reports the load on each direction', () => {
    const model = buildSuperpositionModel(features, 4)
    const load = directionLoad(model)
    expect(load.length).toBe(4)
    expect(Math.max(...load)).toBeGreaterThan(1)
  })

  it('computes the loss of a configuration', () => {
    const model = buildSuperpositionModel(features, 4)
    expect(superpositionLoss(features, model.columns)).toBeCloseTo(model.loss, 8)
  })

  it('never does worse than dropping everything', () => {
    const model = buildSuperpositionModel(features, 4)
    const dropped = features.reduce((acc, feature) => acc + feature.importance, 0)
    expect(model.loss).toBeLessThanOrEqual(dropped + 1e-6)
  })

  it('reports the coverage', () => {
    const model = buildSuperpositionModel(features, 4)
    expect(coverage(model, features.length)).toBeGreaterThan(0)
    expect(coverage(model, features.length)).toBeLessThanOrEqual(1)
  })

  it('finds the importance threshold of a feature', () => {
    const curve = importanceThreshold(features, 6, 4)
    expect(curve.length).toBeGreaterThan(5)
    const represented = curve.filter((point) => point.represented).length
    expect(represented).toBeGreaterThan(0)
  })
})

describe('the interference-versus-feature-count curve', () => {
  const dimensions = 3
  /** Every feature matters equally, so nobody is cheap enough to drop. */
  const flat = generateFeatures(7, dimensions, 5, 0)
  /** A steep power law: the tail costs almost nothing to lose. */
  const steep = generateFeatures(7, dimensions, 5, 1)
  const flatCurve = tradeoffCurve(flat, dimensions, { steps: 1500 })
  const steepCurve = tradeoffCurve(steep, dimensions, { steps: 1500 })

  it('is free up to the number of dimensions and costs from the next feature on', () => {
    for (const point of flatCurve.slice(0, dimensions)) {
      expect(point.loss).toBeLessThan(1e-6)
      expect(point.dropped).toBe(0)
      expect(point.coverage).toBe(1)
    }
    // The first feature that has to share a direction is the first one that costs
    // anything — the whole claim of the toy model, read off one index.
    expect(flatCurve[dimensions]!.loss).toBeGreaterThan(1e-3)
    expect(flatCurve.findIndex((point) => point.loss > 1e-3)).toBe(dimensions)
  })

  it('sums its marginal prices back to the loss', () => {
    for (const [index, point] of flatCurve.entries()) {
      const total = flatCurve.slice(0, index + 1).reduce((acc, each) => acc + each.marginalLoss, 0)
      expect(total).toBeCloseTo(point.loss, 10)
    }
  })

  it('reports the null model as the summed importance', () => {
    for (const point of steepCurve) {
      const offered = steep.slice(0, point.features)
      expect(point.dropEverythingLoss).toBeCloseTo(offered.reduce((acc, feature) => acc + feature.importance, 0), 12)
      expect(point.loss).toBeLessThanOrEqual(point.dropEverythingLoss + 1e-6)
    }
  })

  it('never gets cheaper to add a feature', () => {
    // Empirical rather than provable — the fits are gradient descent from a fixed
    // start — but it is what the curve is claimed to do, so it is checked.
    for (let index = 1; index < flatCurve.length; index++) {
      expect(flatCurve[index]!.loss).toBeGreaterThanOrEqual(flatCurve[index - 1]!.loss - 1e-9)
      expect(flatCurve[index]!.interference).toBeGreaterThanOrEqual(flatCurve[index - 1]!.interference - 1e-9)
    }
  })

  it('pays for the same extra feature in interference when nothing can be dropped', () => {
    for (const point of flatCurve.slice(dimensions)) {
      expect(point.dropped).toBe(0)
      expect(point.interferencePerFeature).toBeGreaterThan(0)
      expect(point.polysemanticity).toBeGreaterThan(1)
    }
    expect(flatCurve[flatCurve.length - 1]!.interferencePerFeature).toBeGreaterThan(flatCurve[dimensions]!.interferencePerFeature)
  })

  it('prices the flat case at exactly one feature dropped per feature superposed', () => {
    // Every feature matters equally here, so throwing one away costs the same as
    // superposing it — and the descent lands on that indifference: the loss tracks
    // `features - dimensions` to three decimal places while nothing is dropped.
    for (const point of flatCurve) {
      expect(point.loss).toBeCloseTo(Math.max(0, point.features - dimensions), 3)
    }
  })

  it('pays for it by dropping instead when the tail is unimportant', () => {
    const last = steepCurve[steepCurve.length - 1]!
    expect(last.dropped).toBeGreaterThan(0)
    // At most one feature may be left half-represented: with three dimensions and a
    // steep importance law the model keeps the first three and throws the rest away.
    expect(last.represented).toBeLessThanOrEqual(dimensions + 1)
    // The kept features each get a direction, so the interference is nil and the
    // loss is exactly the importance of everything thrown away.
    expect(last.interference).toBeLessThan(1e-3)
    const droppedImportance = steep.slice(dimensions).reduce((acc, feature) => acc + feature.importance, 0)
    expect(last.loss).toBeCloseTo(droppedImportance, 3)
  })

  it('keeps the two regimes visibly different at the same feature count', () => {
    const index = dimensions + 2
    expect(flatCurve[index]!.dropped).toBe(0)
    expect(steepCurve[index]!.dropped).toBeGreaterThan(0)
    expect(flatCurve[index]!.interferencePerFeature).toBeGreaterThan(steepCurve[index]!.interferencePerFeature)
  })

  it('is a point per requested count, each labelled with the dimensions it was fitted in', () => {
    const curve = tradeoffCurve(flat, dimensions, { counts: [1, 4], steps: 60 })
    expect(curve.map((point) => point.features)).toEqual([1, 4])
    for (const point of curve) expect(point.dimensions).toBe(dimensions)
  })
})

describe('the sparse autoencoder', () => {
  const features = generateFeatures(8, 6, 11)
  // A model with room for every feature: each one gets its own direction, and
  // the residual stream is a superposition of those directions that a sparse
  // dictionary can unpack.
  const model = buildSuperpositionModel(features, 8)
  // The residual stream: the activation the model produces for each feature.
  const activations = features.map((feature) => {
    const h = new Array<number>(6).fill(0)
    for (let k = 0; k < features.length; k++) {
      for (let i = 0; i < 6; i++) {
        h[i] = (h[i] ?? 0) + (model.columns[k]?.[i] ?? 0) * feature.value
      }
    }
    return h
  })

  it('starts with the right shapes', () => {
    const autoencoder = createAutoencoder(6, 12, 3)
    expect(autoencoder.encoder).toHaveLength(6)
    expect(autoencoder.encoder[0]).toHaveLength(12)
    expect(autoencoder.decoder).toHaveLength(12)
    expect(autoencoder.decoder[0]).toHaveLength(6)
  })

  it('encodes and decodes to the right shapes', () => {
    const autoencoder = createAutoencoder(6, 12, 3)
    const code = encode(autoencoder, activations[0]!)
    expect(code).toHaveLength(12)
    expect(decode(autoencoder, code)).toHaveLength(6)
    for (const value of code) expect(value).toBeGreaterThanOrEqual(0)
  })

  it('reconstructs an untrained autoencoder poorly', () => {
    const autoencoder = createAutoencoder(6, 12, 3)
    const evaluation = evaluateAutoencoder(autoencoder, activations)
    expect(evaluation.reconstructionError).toBeGreaterThan(0)
  })

  it('trains, and the loss falls', () => {
    const result = trainAutoencoder(activations, 16, { steps: 400, learningRate: 0.05, seed: 3 })
    expect(result.history.length).toBeGreaterThan(2)
    const first = result.history[0]!.loss
    const last = result.history[result.history.length - 1]!.loss
    expect(last).toBeLessThan(first)
    expect(result.reconstructionError).toBeGreaterThanOrEqual(0)
    expect(result.l0).toBeGreaterThan(0)
  }, 60000)

  it('explains most of the activation variance once trained', () => {
    const result = trainAutoencoder(activations, 24, { steps: 900, learningRate: 0.05, seed: 3 })
    expect(result.explainedVariance).toBeGreaterThan(0.5)
  }, 90000)

  it('finds dictionary features that are more monosemantic than chance', () => {
    const result = trainAutoencoder(activations, 24, { steps: 900, learningRate: 0.05, seed: 3 })
    const scores = monosemanticity(result.autoencoder, activations, features.map((f) => f.id))
    expect(scores.length).toBe(24)
    // Chance would be one in eight, because there are eight input features.
    expect(Math.max(...scores)).toBeGreaterThan(1 / 8)
  }, 90000)
})

describe('activation patching', () => {
  const graph = buildIndirectObjectGraph()

  it('orders the graph so that every parent comes first', () => {
    const order = topologicalOrder(graph)
    expect(order.indexOf('input')).toBeLessThan(order.indexOf('name'))
    expect(order.indexOf('indirect')).toBeLessThan(order.indexOf('indirect-mover'))
    expect(order[order.length - 1]).toBe('output')
  })

  it('runs the circuit and produces a value at every node', () => {
    const run = runCircuit(graph, [1, 2, 3])
    for (const node of graph.nodes) {
      expect(Number.isFinite(run[node.id]!)).toBe(true)
    }
  })

  it('recomputes the output from the node activations', () => {
    const run = runCircuit(graph, [1, 2, 3])
    expect(computeFrom(graph, run)).toBeCloseTo(run['output']!, 10)
  })

  it('measures the effect of patching a node', () => {
    const clean = runCircuit(graph, [1, 2, 3])
    const corrupted = runCircuit(graph, [4, 5, 6])
    const result = patchNode(graph, clean, corrupted, 'name')
    expect(result.effect).not.toBe(0)
    expect(Math.abs(result.normalisedEffect)).toBeLessThanOrEqual(1.000001)
  })

  it('ranks the nodes by how much they matter', () => {
    const clean = runCircuit(graph, [1, 2, 3])
    const corrupted = runCircuit(graph, [4, 5, 6])
    const attribution = attributeAllNodes(graph, clean, corrupted)
    expect(attribution.length).toBeGreaterThan(0)
    for (let i = 1; i < attribution.length; i++) {
      expect(Math.abs(attribution[i]!.normalisedEffect)).toBeLessThanOrEqual(
        Math.abs(attribution[i - 1]!.normalisedEffect) + 1e-9,
      )
    }
  })

  it('computes the faithfulness of a subgraph', () => {
    const clean = runCircuit(graph, [1, 2, 3])
    const corrupted = runCircuit(graph, [4, 5, 6])
    const everything = graph.nodes.filter((node) => node.inputs.length > 0).map((node) => node.id)
    const score = faithfulness(graph, clean, corrupted, everything)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(1.000001)
  })

  it('computes the weight of every edge', () => {
    const clean = runCircuit(graph, [1, 2, 3])
    const corrupted = runCircuit(graph, [4, 5, 6])
    const edges = edgeWeights(graph, clean, corrupted)
    expect(edges.length).toBe(5)
    for (const edge of edges) {
      expect(Number.isFinite(edge.weight)).toBe(true)
    }
  })
})
