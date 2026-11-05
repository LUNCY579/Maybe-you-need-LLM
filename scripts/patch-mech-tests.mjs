import { readFile, writeFile } from 'node:fs/promises'

const path = 'mech-interp-lab/src/core/core.test.ts'
let source = await readFile(path, 'utf8')

source = source.replace(
  `  it('recovers every feature when there are more dimensions than features', () => {
    const model = buildSuperpositionModel(features.slice(0, 3), 0.0001)
    expect(model.directions.length).toBe(3)
    expect(model.dropped.length).toBe(0)
    const recovery = featureRecovery(model, features.slice(0, 3))
    // The first feature gets a direction of its own, so it is recovered
    // exactly; the later ones are recovered through the directions that are
    // left, and the interference takes its cut.
    expect(recovery[0]).toBeGreaterThan(0.99)
    for (const value of recovery) expect(value).toBeGreaterThan(0.3)
  })`,
  `  it('recovers every feature when there are more dimensions than features', () => {
    const model = buildSuperpositionModel(features.slice(0, 3), 4)
    expect(model.dropped.length).toBe(0)
    const recovery = featureRecovery(model, features.slice(0, 3))
    for (const value of recovery) expect(value).toBeGreaterThan(0.3)
  })`,
)

source = source.replace(
  `  it('has to superpose when there are more features than dimensions', () => {
    const model = buildSuperpositionModel(features, 0.0001)
    expect(model.directions.length).toBeLessThan(features.length)
    // Some features are dropped, and the ones that survive interfere.
    expect(model.dropped.length).toBeGreaterThan(0)
    expect(model.interference).toBeGreaterThan(0)
  })`,
  `  it('has to superpose when there are more features than dimensions', () => {
    const model = buildSuperpositionModel(features, 4)
    // Some features are dropped, and the ones that survive interfere.
    expect(model.dropped.length).toBeGreaterThan(0)
    expect(model.interference).toBeGreaterThan(0)
    expect(polysemanticity(model)).toBeGreaterThan(1)
  })`,
)

source = source.replace(
  `  it('drops more features as the threshold rises', () => {
    const low = buildSuperpositionModel(features, 0.0001)
    const high = buildSuperpositionModel(features, 0.05)
    expect(high.dropped.length).toBeGreaterThan(low.dropped.length)
  })`,
  `  it('drops more features as there are fewer dimensions', () => {
    const roomy = buildSuperpositionModel(features, 16)
    const cramped = buildSuperpositionModel(features, 3)
    expect(cramped.dropped.length).toBeGreaterThan(roomy.dropped.length)
  })`,
)

source = source.replace(
  `  it('computes a loss of zero when a feature has its own direction', () => {
    const feature = features[0]!
    const loss = featureLoss(feature, [feature.input])
    expect(loss).toBeCloseTo(0, 10)
  })

  it('charges interference for a shared direction', () => {
    const feature = features[0]!
    const shared = features[1]!
    const loss = featureLoss(feature, [shared.input])
    expect(loss).toBeGreaterThan(0)
  })`,
  `  it('computes no loss for a feature alone in its direction', () => {
    expect(featureLoss(1, 1, 0)).toBeCloseTo(0, 10)
  })

  it('charges interference for a shared direction', () => {
    // Two features at full magnitude on one direction: each loses the whole
    // of the other's signal.
    expect(featureLoss(1, 1, 1)).toBeCloseTo(1, 10)
    expect(featureLoss(1, 0.5, 1)).toBeGreaterThan(0)
  })`,
)

source = source.replace(
  `  it('reports the load on each direction', () => {
    const model = buildSuperpositionModel(features, 0.0001)
    const load = directionLoad(model, features)
    expect(load).toHaveLength(model.directions.length)
    for (const value of load) expect(value).toBeGreaterThanOrEqual(1)
  })`,
  `  it('reports the load on each direction', () => {
    const model = buildSuperpositionModel(features, 4)
    const load = directionLoad(model)
    expect(load.length).toBe(4)
    expect(load.reduce((a, b) => a + b, 0)).toBe(features.length - model.dropped.length)
  })`,
)

source = source.replace(
  `  it('reports a polysemanticity above one when it has superposed', () => {
    const model = buildSuperpositionModel(features, 0.0001)
    const load = directionLoad(model, features)
    expect(Math.max(...load)).toBeGreaterThan(1)
    expect(polysemanticity(model, features)).toBeGreaterThan(1)
  })`,
  `  it('reports a polysemanticity above one when it has superposed', () => {
    const model = buildSuperpositionModel(features, 4)
    expect(Math.max(...directionLoad(model))).toBeGreaterThan(1)
    expect(polysemanticity(model)).toBeGreaterThan(1)
  })`,
)

source = source.replace(
  `  it('computes the loss of a set of directions', () => {
    const model = buildSuperpositionModel(features, 0.0001)
    expect(superpositionLoss(features, model.directions)).toBeCloseTo(model.loss, 8)
  })`,
  `  it('computes the loss of a configuration', () => {
    const model = buildSuperpositionModel(features, 4)
    expect(
      configurationLoss(features, model.magnitudes, model.assignments),
    ).toBeCloseTo(model.loss, 10)
  })`,
)

source = source.replace(
  `  it('reports the coverage', () => {
    const model = buildSuperpositionModel(features, 0.0001)
    expect(coverage(model, features.length)).toBeGreaterThan(0)
    expect(coverage(model, features.length)).toBeLessThan(1)
  })`,
  `  it('reports the coverage', () => {
    const model = buildSuperpositionModel(features, 4)
    expect(coverage(model, features.length)).toBeGreaterThan(0)
    expect(coverage(model, features.length)).toBeLessThan(1)
  })

  it('finds the importance threshold of a feature', () => {
    const curve = importanceThreshold(features, 3, 4)
    expect(curve.length).toBeGreaterThan(5)
    // A feature that is important enough is represented; one that is not, is
    // not. The curve is monotone in the importance.
    const represented = curve.filter((point) => point.represented).length
    expect(represented).toBeGreaterThan(0)
  })`,
)

source = source.replace(
  `import {
  buildSuperpositionModel,
  coverage,
  directionLoad,
  featureLoss,
  featureRecovery,
  generateFeatures,
  interference,
  polysemanticity,
  superpositionLoss,
} from './superposition.js'`,
  `import {
  buildSuperpositionModel,
  configurationLoss,
  coverage,
  directionLoad,
  featureLoss,
  featureRecovery,
  generateFeatures,
  importanceThreshold,
  interference,
  polysemanticity,
} from './superposition.js'`,
)

await writeFile(path, source, 'utf8')
console.log('patched the superposition tests')
