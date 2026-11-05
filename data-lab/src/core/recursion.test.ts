import { describe, expect, it } from 'vitest'
import { compareRecursion, runRefinement, type RefinementPass } from './recursion'

const field = (passes: RefinementPass[], key: 'documents' | 'meanQuality' | 'threshold' | 'heldOutAccuracy') =>
  passes.map((row) => row[key])

/**
 * The recursive training loop at toy scale.
 *
 * Gerstgrasser et al. retrain the reference model on the survivors and filter
 * again, and find that several gentle passes beat one hard pass at the same
 * total removal. The loop is here, at 280 documents, and the verdict is mixed in
 * a way worth stating exactly: the held-out loss is lower for the recursive arm
 * at every seed tried, and the held-out accuracy is not. The tests below assert
 * the loss and refuse to assert the accuracy.
 */
describe('The recursive training loop at toy scale', () => {
  const study = runRefinement()

  it('shrinks the corpus by the total fraction it was promised', () => {
    expect(study.start.documents).toBe(280)
    expect(study.passes).toHaveLength(4)
    expect(field(study.passes, 'documents')).toEqual([246, 217, 191, 168])
    expect(study.final).toHaveLength(168)
    // 1 - (1 - 0.4) ** (1/4) per pass compounds to the 40% total
    expect(study.final.length).toBe(Math.round(study.start.documents * 0.6))
  })

  it('raises the quality of what survives, pass by pass', () => {
    const qualities = field(study.passes, 'meanQuality').map((value) => Number(value.toFixed(3)))
    expect(qualities).toEqual([0.478, 0.515, 0.548, 0.576])
    expect(study.start.meanQuality).toBeLessThan(qualities[0]!)
    for (let index = 1; index < qualities.length; index++) {
      expect(qualities[index]).toBeGreaterThan(qualities[index - 1]!)
    }
  })

  it('tightens the cut as the reference model is retrained', () => {
    const thresholds = field(study.passes, 'threshold')
    expect(thresholds[0]).toBeGreaterThan(25)
    expect(thresholds.at(-1)).toBeLessThan(15)
    for (let index = 1; index < thresholds.length; index++) {
      expect(thresholds[index]).toBeLessThan(thresholds[index - 1]!)
    }
  })

  it('removes almost all of the junk on the first pass and clean text after', () => {
    const unwanted = study.passes.reduce((sum, row) => sum + row.removedUnwanted, 0)
    const clean = study.passes.reduce((sum, row) => sum + row.removedClean, 0)
    // 32 of the 280-document pool are boilerplate or an unseen language
    expect(unwanted).toBeLessThanOrEqual(32)
    expect(unwanted + clean).toBe(280 - 168)
    expect(study.passes[1]!.removedClean).toBe(29)
    expect(study.passes[2]!.removedClean).toBe(25)
    expect(study.passes[3]!.removedClean).toBe(22)
    // the last passes are paying for their gain in clean documents
    expect(study.passes[0]!.removedClean).toBeLessThan(study.passes[1]!.removedClean)
  })

  it('raises accuracy and loss together along the loop', () => {
    const accuracies = field(study.passes, 'heldOutAccuracy').map((value) => Number(value.toFixed(3)))
    expect(accuracies).toEqual([0.833, 0.842, 0.85, 0.85])
    const losses = study.passes.map((row) => Number(row.heldOutLoss.toFixed(4)))
    expect(losses[0]).toBeCloseTo(0.3992, 4)
    expect(losses[3]).toBeCloseTo(0.427, 4)
    // the later passes have fewer documents and the same 300 steps, so their loss
    // rises even as their accuracy does; the arms are not the equal-size comparison
    for (let index = 1; index < losses.length; index++) {
      expect(losses[index]).toBeGreaterThanOrEqual(losses[index - 1]!)
    }
    expect(study.steps).toBe(300)
  })
})

describe('one hard pass against several gentle ones', () => {
  it('ends at the same corpus size, which is what makes it a comparison', () => {
    for (const passes of [1, 2, 4, 6]) {
      const study = runRefinement({ passes })
      expect(study.final).toHaveLength(168)
    }
    const comparison = compareRecursion()
    expect(comparison.sameSize).toBe(true)
    expect(comparison.oneShot.documents).toBe(168)
    expect(comparison.recursive.documents).toBe(168)
    expect(comparison.passes).toBe(4)
    expect(comparison.pruneFraction).toBe(0.4)
  })

  it('wins on the loss at every seed tried', () => {
    const rows = [17, 23, 31].map((seed) => {
      const comparison = compareRecursion({ seed })
      return {
        seed,
        oneShotLoss: Number(comparison.oneShot.heldOutLoss.toFixed(4)),
        recursiveLoss: Number(comparison.recursive.heldOutLoss.toFixed(4)),
        accuracyGain: Number(comparison.accuracyGain.toFixed(4)),
        qualityGain: Number(comparison.qualityGain.toFixed(4)),
      }
    })
    expect(rows).toEqual([
      { seed: 17, oneShotLoss: 0.4576, recursiveLoss: 0.427, accuracyGain: 0, qualityGain: -0.0043 },
      { seed: 23, oneShotLoss: 0.4291, recursiveLoss: 0.4248, accuracyGain: 0.025, qualityGain: 0.0046 },
      { seed: 31, oneShotLoss: 0.5183, recursiveLoss: 0.5071, accuracyGain: 0.0083, qualityGain: 0.0014 },
    ])
    for (const row of rows) expect(row.recursiveLoss).toBeLessThan(row.oneShotLoss)
  })

  it('does not win on accuracy, which is the honest half of the claim', () => {
    const gains = [17, 23, 31].map((seed) => compareRecursion({ seed }).accuracyGain)
    // one seed is exactly level, and none of the three is worth a hundred documents
    expect(gains[0]).toBe(0)
    for (const gain of gains) expect(Math.abs(gain)).toBeLessThan(0.03)
    // the continuous score separates the arms; the 0/1 score on 120 documents cannot
    expect(Math.max(...gains) - Math.min(...gains)).toBeGreaterThan(Math.abs(gains[0]))
  })

  it('holds the total removal fixed while the number of passes changes', () => {
    const sizes = [1, 2, 4, 6].map((passes) => runRefinement({ passes }).final.length)
    expect(sizes).toEqual([168, 168, 168, 168])
    // with two passes the first one removes 1 - 0.6 ** (1/2) of the pool
    expect(runRefinement({ passes: 2 }).passes[0]!.documents).toBe(217)
  })
})
