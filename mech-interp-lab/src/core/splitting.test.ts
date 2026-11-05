/**
 * Feature splitting and absorption, tested.
 *
 * The claims here come in three grades, and the split between them is deliberate.
 *
 * - **Identities**, checked on dictionaries wired by hand rather than trained, so
 *   that a failure points at the measurement and not at the optimiser: the leak and
 *   the alignment are the two legs of a right triangle (`alignment² + absorption² =
 *   1`), purity sums to one over the features, and a feature reconstructed entirely
 *   along another's direction has a leak of exactly `sin θ`.
 * - **Behaviour**, checked on trained dictionaries: what the classifier says about a
 *   row that lies along a feature, against a row that lies at the bisector, against
 *   a row that lies backwards.
 * - **Rates**, checked over repeated initialisations. Whether one particular run
 *   splits at `lambda = 0.04` is an outcome of stochastic optimisation and not worth
 *   a test; that *most* runs do, and that almost none do at `lambda = 0`, is
 *   reproducible, and that is the form the two phenomena are actually in.
 *
 * Splitting is Cunningham et al. (2023). Absorption is named in the follow-on
 * literature and measured here by a decomposition of our own, so no number below is
 * a number the papers report.
 */

import { describe, expect, it } from 'vitest'
import { dot } from '@llm-materials/course-core'
import type { Vector } from '@llm-materials/course-core'
import type { SparseAutoencoder } from './sae'
import {
  buildSuperposedSetup,
  dictionaryRows,
  featureReports,
  geometryReport,
  sparsitySweep,
  splittingCurve,
  type SuperposedSetup,
} from './splitting'

const SQRT_HALF = 0.7071067811865475

/**
 * An autoencoder wired by hand, one dictionary element per entry.
 *
 * `read` is the encoder column: the code is `ReLU(read · x + bias)`, so a row reads
 * the stream along `read` and writes along `direction`. Wiring these by hand is what
 * makes the geometry assertions exact — the trained cases below only ever have to
 * carry the rates.
 */
function wired(
  setup: SuperposedSetup,
  rows: { direction: Vector; read: Vector; bias?: number }[],
): SparseAutoencoder {
  return {
    dimensions: setup.dimensions,
    features: rows.length,
    decoder: rows.map((row) => row.direction.slice()),
    decoderBias: new Array<number>(setup.dimensions).fill(0),
    encoder: Array.from({ length: setup.dimensions }, (_, dimension) =>
      rows.map((row) => row.read[dimension] ?? 0),
    ),
    encoderBias: rows.map((row) => row.bias ?? 0),
  }
}

/** Two features at 45°: neither coordinate of the stream is either feature. */
const superposed = buildSuperposedSetup()
const first = superposed.directions[0]!
const second = superposed.directions[1]!

/** The same two features at right angles, where a row can be silent on one of them. */
const orthogonal = buildSuperposedSetup({ angle: Math.PI / 2 })
const axisX = orthogonal.directions[0]!
const axisY = orthogonal.directions[1]!

/** One row along the first feature's own direction, in the superposed stream. */
const alignedToFirst = wired(superposed, [{ direction: first, read: first }])
/** The same row, in the orthogonal stream, where it can only ever see feature 0. */
const axisRow = wired(orthogonal, [{ direction: axisX, read: axisX }])
/** A row that reads feature 0 and writes against it. */
const backwards = wired(orthogonal, [{ direction: [-axisX[0]!, -axisX[1]!], read: axisX }])

const blankShare = superposed.active.filter((on) => on.length === 0).length / superposed.activations.length

/* ------------------------------------------------------------------- 1. setup */

describe('the superposed stream', () => {
  it('puts two unit directions at the angle it was asked for', () => {
    expect(superposed.dimensions).toBe(2)
    expect(superposed.directions).toHaveLength(2)
    expect(dot(first, first)).toBeCloseTo(1, 12)
    expect(dot(second, second)).toBeCloseTo(1, 12)
    expect(dot(first, second)).toBeCloseTo(Math.cos(Math.PI / 4), 12)
  })

  it('spreads each activation along one ray, with its own amplitude', () => {
    superposed.activations.forEach((activation, index) => {
      const on = superposed.active[index]!
      expect(on.length).toBeLessThanOrEqual(1)
      if (on.length === 0) {
        expect(activation).toEqual([0, 0])
        return
      }
      const length = Math.sqrt(dot(activation, activation))
      expect(length).toBeGreaterThanOrEqual(0.5)
      expect(length).toBeLessThanOrEqual(1.5)
      // The amplitude cancels out of the cosine, so this checks the ray, not the size.
      expect(dot(activation, superposed.directions[on[0]]!) / length).toBeGreaterThan(0.999999)
    })
  })

  it('leaves the blank share it was asked for, and no more', () => {
    expect(blankShare).toBeGreaterThan(0.05)
    expect(blankShare).toBeLessThan(0.22)
  })

  it('normalises the prevalence it was given', () => {
    expect(superposed.prevalence.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)

    const skewed = buildSuperposedSetup({ prevalence: [1, 0.2] })
    expect(skewed.prevalence[0]).toBeCloseTo(1 / 1.2, 12)
    expect(skewed.prevalence[1]).toBeCloseTo(0.2 / 1.2, 12)
    expect(skewed.prevalence.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
  })

  it('draws the features in proportion to that prevalence', () => {
    const skewed = buildSuperposedSetup({ prevalence: [1, 0.2], samples: 4000 })
    const counted = skewed.active.filter((on) => on[0] === 0).length /
      Math.max(1, skewed.active.filter((on) => on.length > 0).length)
    expect(counted).toBeGreaterThan(0.75)
    expect(counted).toBeLessThan(0.9)
  })

  it('refuses directions that coincide, because there would be nothing to separate', () => {
    expect(() => buildSuperposedSetup({ angle: 0 })).toThrow(RangeError)
    expect(() => buildSuperposedSetup({ angle: Math.PI })).toThrow(/coincide/)
  })

  it('lets more features than dimensions pack into the plane', () => {
    const three = buildSuperposedSetup({ features: 3, angle: Math.PI / 5 })
    expect(three.dimensions).toBe(2)
    expect(three.directions).toHaveLength(3)
    // Three directions in two dimensions are dependent by arithmetic, and that is
    // superposition rather than an error: the third is 72° round from the first.
    expect(dot(three.directions[0]!, three.directions[2]!)).toBeCloseTo(Math.cos((2 * Math.PI) / 5), 12)
    expect(dot(three.directions[0]!, three.directions[1]!)).toBeCloseTo(Math.cos(Math.PI / 5), 12)
  })
})

/* ---------------------------------------------------- 2. reading a dictionary */

describe('reading a dictionary we wired ourselves', () => {
  it('calls a row along a feature, firing for that feature alone, its owner', () => {
    const rows = dictionaryRows(axisRow, orthogonal)
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.cosine[0]).toBeCloseTo(1, 12)
    expect(row.purity[0]).toBeCloseTo(1, 12)
    expect(row.effectiveFeatures).toBeCloseTo(1, 12)
    expect(row.respondsTo).toEqual([0])
    expect(row.owns).toBe(0)
  })

  it('does not count a rounding error as a firing', () => {
    // cos(π/2) is 6.1e-17, not zero, so the row above reads a little of feature 1.
    // Read literally that row serves both features, and the whole classification
    // would be noise; `dot(axisRow.decoder[0], axisY)` is that rounding error.
    expect(Math.abs(dot(axisX, axisY))).toBeLessThan(1e-15)
    expect(dictionaryRows(axisRow, orthogonal)[0]!.purity[1]).toBe(0)
  })

  it('counts the blanks in the firing rate but not in the purity', () => {
    const row = dictionaryRows(alignedToFirst, superposed)[0]!
    // This row reads along feature 0's direction, so it fires whenever any feature is
    // on — and never on a blank, where the stream is zero.
    expect(row.firing).toBeCloseTo(1 - blankShare, 12)
    expect(row.purity.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
  })

  it('calls a row that serves two features merged rather than owned', () => {
    const row = dictionaryRows(alignedToFirst, superposed)[0]!
    expect(row.cosine[0]).toBeCloseTo(1, 12)
    expect(row.purity[0]).toBeGreaterThan(0.4)
    expect(row.purity[1]).toBeGreaterThan(0.4)
    expect(row.effectiveFeatures).toBeGreaterThan(1.9)
    expect(row.respondsTo).toEqual([0, 1])
    // Alignment to within a hair of perfect, and still no owner: the merged element is
    // close to a feature's direction precisely because it is serving both.
    expect(row.owns).toBeNull()
  })

  it('shares a merged row between both features it serves', () => {
    const reports = featureReports(alignedToFirst, superposed)
    expect(reports[0]!.shared).toEqual([0])
    expect(reports[1]!.shared).toEqual([0])
    expect(reports[0]!.dedicated).toEqual([])
    expect(reports[1]!.dedicated).toEqual([])
  })

  it('measures absorption as the exact sine of the angle left uncovered', () => {
    // One element, along feature 0. An activation of feature 1 is reconstructed as
    // its projection, so the part along feature 1's own direction is cos 45° and the
    // leak is sin 45° — both exactly 1/√2.
    const reports = featureReports(alignedToFirst, superposed)
    expect(reports[0]!.alignment).toBeCloseTo(1, 12)
    expect(reports[0]!.absorption).toBeCloseTo(0, 12)
    expect(reports[1]!.alignment).toBeCloseTo(SQRT_HALF, 12)
    expect(reports[1]!.absorption).toBeCloseTo(SQRT_HALF, 12)
    expect(reports[1]!.absorbedInto).toBe(0)
  })

  it('keeps the leak and the alignment the two legs of a right triangle', () => {
    for (const report of featureReports(alignedToFirst, superposed)) {
      if (report.alignment === 0 && report.absorption === 0) continue
      expect(report.alignment ** 2 + report.absorption ** 2).toBeCloseTo(1, 10)
    }
  })

  it('separates a row that reads a feature from one that writes it', () => {
    const report = geometryReport(backwards, orthogonal)
    const row = report.rows[0]!
    expect(row.purity[0]).toBeCloseTo(1, 12)
    expect(row.respondsTo).toEqual([0])
    expect(row.cosine[0]).toBeCloseTo(-1, 12)
    expect(row.owns).toBeNull()
    // Behaves for a feature and points away from it: not merged, not an owner.
    expect(report.misplacedRows).toEqual([0])
    expect(report.mergedRows).toEqual([])
    expect(report.features[0]!.alignment).toBeCloseTo(-1, 12)
    expect(report.features[0]!.absorption).toBeCloseTo(0, 12)
  })

  it('has no leak to measure where the dictionary outputs nothing', () => {
    // The honest limit of the decomposition: a feature nobody serves at all has a
    // reconstruction of zero, which has no direction to leak in. `unownedFeatures`
    // is reported separately for exactly this reason.
    const report = geometryReport(backwards, orthogonal)
    expect(report.features[1]!.alignment).toBe(0)
    expect(report.features[1]!.absorption).toBe(0)
    expect(report.features[1]!.absorbedInto).toBeNull()
    expect(report.unownedFeatures).toContain(1)
  })

  it('treats a row nobody uses as representing nothing', () => {
    const dead = wired(superposed, [{ direction: first, read: first, bias: -10 }])
    const row = dictionaryRows(dead, superposed)[0]!
    expect(row.firing).toBe(0)
    expect(row.alive).toBe(false)
    expect(row.owns).toBeNull()
    expect(row.effectiveFeatures).toBe(0)
  })

  it('reports the prevalence it sampled', () => {
    const skewed = buildSuperposedSetup({ prevalence: [1, 0.2], samples: 4000 })
    const reports = featureReports(alignedToFirst, skewed)
    expect(reports[0]!.prevalence).toBeGreaterThan(reports[1]!.prevalence)
    expect(reports[0]!.prevalence + reports[1]!.prevalence).toBeLessThanOrEqual(1)
  })
})

/* -------------------------------------------------------------- 3. the report */

describe('classifying a dictionary', () => {
  it('calls a pair of exclusive owners a split', () => {
    const both = wired(orthogonal, [
      { direction: axisX, read: axisX },
      { direction: axisY, read: axisY },
    ])
    const report = geometryReport(both, orthogonal)
    expect(report.ownedFeatures).toEqual([0, 1])
    expect(report.unownedFeatures).toEqual([])
    expect(report.mergedRows).toEqual([])
    expect(report.ownerRows).toEqual([0, 1])
    expect(report.split).toBe(true)
  })

  it('does not call a merged row a split even when it lies along a feature', () => {
    expect(geometryReport(alignedToFirst, superposed).split).toBe(false)
  })

  it('calls two rows that fire apart over one feature a duplicate', () => {
    // Same direction, different thresholds: the second only clears its bias when the
    // amplitude is above 1.2, so the two split the feature's activations between them.
    const duplicated = wired(orthogonal, [
      { direction: axisX, read: axisX },
      { direction: axisX, read: axisX, bias: -1.2 },
      { direction: axisY, read: axisY },
    ])
    const report = geometryReport(duplicated, orthogonal)
    expect(report.ownerRows).toEqual([0, 1, 2])
    expect(report.duplicates).toHaveLength(1)
    const pair = report.duplicates[0]!
    expect(pair.feature).toBe(0)
    expect(pair.rows).toEqual([0, 1])
    expect(pair.similarity).toBeCloseTo(1, 12)
    expect(pair.overlap).toBeLessThan(0.5)
    // One feature carried twice is still every feature carried: the pair is reported
    // alongside the split rather than instead of it.
    expect(report.split).toBe(true)
  })

  it('does not call two identical rows a duplicate', () => {
    const copied = wired(orthogonal, [
      { direction: axisX, read: axisX },
      { direction: axisX, read: axisX },
      { direction: axisY, read: axisY },
    ])
    const report = geometryReport(copied, orthogonal)
    expect(report.features[0]!.dedicated).toEqual([0, 1])
    expect(report.duplicates).toEqual([])
  })

  it('lets the absorption threshold decide what counts as absorbed', () => {
    const absorbed = geometryReport(alignedToFirst, superposed)
    expect(absorbed.absorbed).toEqual([1])
    expect(absorbed.features[1]!.absorbedInto).toBe(0)

    const strict = geometryReport(alignedToFirst, superposed, { absorptionThreshold: 0.9 })
    expect(strict.absorbed).toEqual([])
    expect(strict.features[1]!.absorbedInto).toBeNull()
    // The leak itself is not a parameter: only the reading of it is.
    expect(strict.features[1]!.absorption).toBeCloseTo(absorbed.features[1]!.absorption, 12)
  })
})

/* -------------------------------------------------------- 4. splitting, rates */

const uniformCurve = splittingCurve(superposed)
const skewedCurve = splittingCurve(buildSuperposedSetup({ prevalence: [1, 0.2] }))

describe('the merged pair splits as the penalty grows', () => {
  it('walks the sparsity coefficients it was defaulted to', () => {
    expect(uniformCurve.map((point) => point.lambda)).toEqual([0, 0.01, 0.02, 0.04, 0.06, 0.1, 0.15])
    expect(uniformCurve[0]!.runs).toBe(8)
  })

  it('finds a merged row in every run and no split in any of them at all', () => {
    const gentlest = uniformCurve[0]!
    expect(gentlest.mergedRuns).toBe(gentlest.runs)
    expect(gentlest.splitRuns).toBe(0)
    expect(gentlest.degradedRuns).toBe(0)
    expect(gentlest.l0).toBeGreaterThan(1.9)
  })

  it('loses the merged row as the penalty rises, and never gets it back', () => {
    for (let index = 1; index < uniformCurve.length; index++) {
      const previous = uniformCurve[index - 1]!
      const point = uniformCurve[index]!
      expect(point.mergedRuns).toBeLessThanOrEqual(previous.mergedRuns)
      expect(point.l0).toBeLessThan(previous.l0)
    }
    expect(uniformCurve[uniformCurve.length - 1]!.mergedRuns).toBeLessThan(uniformCurve[0]!.mergedRuns)
  })

  it('splits most runs at one sparsity and none at the extremes', () => {
    const peak = uniformCurve.reduce((best, point) => (point.splitRuns > best.splitRuns ? point : best))
    expect(peak.splitRuns).toBeGreaterThanOrEqual(peak.runs / 2)
    // The split has to happen while the autoencoder is still reconstructing, or it is
    // a measurement of a broken fit.
    expect(peak.degradedRuns).toBe(0)
    expect(peak.explainedVariance).toBeGreaterThan(0.8)
    expect(peak.lambda).toBeGreaterThan(uniformCurve[0]!.lambda)
    expect(peak.splitRuns).toBeGreaterThan(uniformCurve[0]!.splitRuns)
    expect(peak.splitRuns).toBeGreaterThan(uniformCurve[uniformCurve.length - 1]!.splitRuns)
  })

  it('starves the dictionary at the heaviest penalty and says so', () => {
    const heaviest = uniformCurve[uniformCurve.length - 1]!
    expect(heaviest.degradedRuns).toBeGreaterThan(heaviest.runs / 2)
    expect(heaviest.explainedVariance).toBeLessThan(0.5)
    expect(heaviest.reconstructionError).toBeGreaterThan(uniformCurve[0]!.reconstructionError)
    expect(heaviest.splitRuns).toBeLessThan(heaviest.runs / 2)
  })

  it('has nothing absorbed while it is still reconstructing well', () => {
    const gentlest = uniformCurve[0]!
    for (const leak of gentlest.absorptionPerFeature) expect(leak).toBeLessThan(0.15)
  })

  it('is the same experiment as the single-run sweep', () => {
    const one = sparsitySweep(superposed, { lambdas: [0.06], training: { seed: 3 } })[0]!
    const point = splittingCurve(superposed, { lambdas: [0.06], runs: 1, training: { seed: 3 } })[0]!
    expect(point.points[0]).toEqual(one)
    expect(point.splitRuns).toBe(one.split ? 1 : 0)
    expect(point.mergedRuns).toBe(one.mergedRows > 0 ? 1 : 0)
  })

  it('repeats itself exactly, so the rates are reproducible', () => {
    const again = splittingCurve(superposed, { lambdas: [0, 0.06], runs: 3, training: { seed: 3 } })
    const third = splittingCurve(superposed, { lambdas: [0, 0.06], runs: 3, training: { seed: 3 } })
    expect(third.map((point) => [point.splitRuns, point.mergedRuns, point.l0])).toEqual(
      again.map((point) => [point.splitRuns, point.mergedRuns, point.l0]),
    )
  })
})

/* ------------------------------------------------------- 5. absorption, rates */

describe('a rare feature is absorbed rather than split', () => {
  it('samples the two features at the same rate in the uniform setup', () => {
    expect(Math.abs(superposed.prevalence[0]! - superposed.prevalence[1]!)).toBeLessThan(1e-12)
    expect(Math.abs(skewedCurve[0]!.lambda)).toBe(0)
  })

  it('leaks more of the rare feature than the frequent one at every sparsity', () => {
    for (const point of skewedCurve) {
      expect(point.absorptionPerFeature[1]!).toBeGreaterThan(point.absorptionPerFeature[0]!)
    }
  })

  it('gives the frequent feature an owner more often than the rare one, everywhere', () => {
    for (const point of skewedCurve) {
      expect(point.ownerRuns[0]!).toBeGreaterThan(point.ownerRuns[1]!)
      expect(point.ownerRuns[1]!).toBeLessThan(0.5)
    }
    // And the frequent feature keeps one while the dictionary is still working.
    expect(skewedCurve[0]!.ownerRuns[0]!).toBeGreaterThan(0.75)
  })

  it('grows the rare feature leak with the penalty', () => {
    const from = 2
    for (let index = from + 1; index < skewedCurve.length; index++) {
      expect(skewedCurve[index]!.absorptionPerFeature[1]!).toBeGreaterThanOrEqual(
        skewedCurve[index - 1]!.absorptionPerFeature[1]!,
      )
    }
    const last = skewedCurve[skewedCurve.length - 1]!
    expect(last.absorptionPerFeature[1]!).toBeGreaterThan(last.absorptionPerFeature[0]!)
    expect(last.absorptionPerFeature[1]!).toBeGreaterThan(skewedCurve[from]!.absorptionPerFeature[1]!)
  })

  it('absorbs without needing the merged row that splitting is about', () => {
    const gentlest = skewedCurve[0]!
    // The frequent feature has its own element and the rare one has none: this is not
    // the pair sitting merged in one direction, which is what `lambda = 0` looks like
    // in the uniform setup above.
    expect(gentlest.mergedRuns).toBeLessThan(gentlest.runs)
    expect(gentlest.ownerRuns[0]!).toBeGreaterThan(0.5)
    expect(gentlest.absorptionPerFeature[1]!).toBeGreaterThan(0.15)
  })

  it('names the feature the rare one leaks onto', () => {
    // Across the whole skewed curve, wherever a run names a destination for the rare
    // feature's leak it is the frequent feature that absorbed it — never the reverse,
    // which is what the prevalence ordering predicts and what a leak metric that only
    // measured noise would not get right.
    const named = skewedCurve
      .flatMap((point) => point.points)
      .filter((run) => run.report.features[1]!.absorbedInto !== null)
    expect(named.length).toBeGreaterThan(0)
    for (const run of named) expect(run.report.features[1]!.absorbedInto).toBe(0)
  })
})
