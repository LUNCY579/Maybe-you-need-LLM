import { describe, expect, it } from 'vitest'
import {
  NF4_CODEBOOK,
  activationsWithOutlier,
  blockedNormalFloatError,
  dotProducts,
  gaussianMatrix,
  groupedQuantisation,
  nearestLevel,
  normalFloatError,
  outlierChannels,
  perChannelQuantisation,
  perTensorQuantisation,
  quantisationError,
  quantisationStep,
  quantiserLevels,
  quantiseValue,
  relativeDifference,
  smoothQuant,
  smoothQuantSweep,
  smoothScales,
  unsmoothedError,
} from './quantisation'

const OUTLIER_INDEX = 3
const OUTLIER_SCALE = 20

// The activation tensor the papers describe: ordinary dimensions, and one
// channel an order of magnitude wider than the rest. The outlier is planted, and
// the scale it is planted at is the number the tests read back.
const activations = activationsWithOutlier(64, 32, {
  seed: 5,
  outlierIndex: OUTLIER_INDEX,
  outlierScale: OUTLIER_SCALE,
})
const weights = gaussianMatrix(16, 32, 7)

describe('the grid', () => {
  it('has as many levels per side as its width allows, and a spacing that follows the range', () => {
    expect(quantiserLevels(8)).toBe(127)
    expect(quantiserLevels(4)).toBe(7)
    expect(quantisationStep(2, 8)).toBeCloseTo(2 / 127, 12)
    // Double the range, double the spacing: the grid is where it is, not wider.
    expect(quantisationStep(4, 8)).toBeCloseTo(2 * quantisationStep(2, 8), 12)
  })

  it('puts every value within half a step of a level, and never further', () => {
    const step = quantisationStep(1, 8)
    expect(quantiseValue(0.7 * step, step)).toBeCloseTo(step, 12)
    expect(quantiseValue(0.4 * step, step)).toBe(0)
    // A value already on the grid costs nothing.
    expect(quantisationError([step, -2 * step, 0], step)).toBe(0)
    // And the error of a random stretch of values is bounded by half a spacing.
    const values = gaussianMatrix(1, 200, 2)[0]!
    expect(quantisationError(values, step)).toBeLessThanOrEqual(step / 2 + 1e-12)
  })
})

describe('the outlier channel', () => {
  it('is the one it was planted as, and it is the width of the whole grid', () => {
    const report = outlierChannels(activations)
    expect(report.index).toBe(OUTLIER_INDEX)
    expect(report.ratio).toBeCloseTo(OUTLIER_SCALE, 0)
    // Weights, in the same laboratory, have nothing of the kind.
    expect(outlierChannels(weights).ratio).toBeLessThan(2)
  })

  it('is what a single grid pays for, channel by channel', () => {
    const tensor = perTensorQuantisation(activations, 8)
    // One grid sized for the widest channel is that many times too coarse for
    // the ordinary ones — the cost the outlier imposes on everything else.
    expect(tensor.resolutionCost).toBeCloseTo(outlierChannels(activations).ratio, 6)
    expect(tensor.representable).toBeGreaterThan(0)
    const perChannel = perChannelQuantisation(activations, 8)
    expect(perChannel.error).toBeLessThan(tensor.error / 4)
    // Its own worst channel is as bad as the whole tensor used to be, because
    // that channel is the outlier and it still needs its own wide grid.
    expect(perChannel.worstChannel).toBeGreaterThan(tensor.error / 2)
    expect(perChannel.steps.length).toBe(32)
  })

  it('costs the weights very little, because the weights have none', () => {
    const tensor = perTensorQuantisation(weights, 8)
    const perChannel = perChannelQuantisation(weights, 8)
    expect(tensor.resolutionCost).toBeLessThan(2)
    expect(perChannel.error).toBeLessThan(tensor.error)
    expect(perChannel.error).toBeGreaterThan(tensor.error / 2)
  })

  it('is the reason the row and the column are not the same question', () => {
    const columns = perChannelQuantisation(activations, 8, { axis: 'column' })
    const rows = perChannelQuantisation(activations, 8, { axis: 'row' })
    // One grid per input dimension isolates the outlier; one per output row
    // spreads it over every row, which is the per-tensor problem again.
    expect(columns.error).toBeLessThan(rows.error)
    expect(rows.error).toBeGreaterThan(columns.error * 3)
  })
})

describe('grouping', () => {
  it('reproduces the two schemes it interpolates between, exactly', () => {
    const width = 32
    const oneGrid = groupedQuantisation(weights, 4, width)
    expect(oneGrid.error).toBeCloseTo(perTensorQuantisation(weights, 4).error, 12)
    expect(oneGrid.scales).toBe(1)
    const perColumn = groupedQuantisation(weights, 4, 1)
    expect(perColumn.error).toBeCloseTo(perChannelQuantisation(weights, 4).error, 12)
    expect(perColumn.scales).toBe(width)
  })

  it('improves as the groups get smaller, and charges for every scale', () => {
    const errors = [16, 8, 4, 2, 1].map((groupSize) => groupedQuantisation(weights, 4, groupSize))
    for (let i = 1; i < errors.length; i++) {
      expect(errors[i]!.error).toBeLessThan(errors[i - 1]!.error)
    }
    expect(errors[0]!.scales).toBe(2)
    expect(errors[4]!.scales).toBe(32)
    // The saving is real but it is small: grouping is bought for the storage of
    // the scales, and past a group of a few channels there is nothing left.
    expect(errors[4]!.error).toBeGreaterThan(errors[0]!.error / 2)
  })

  it('is a saving in geometry, so it barely depends on how many bits there are', () => {
    const ratio = (bits: number) =>
      groupedQuantisation(activations, bits, 8).error / perTensorQuantisation(activations, bits).error
    // Grouping does not add resolution, it re-points the grids at ranges they
    // can actually cover. That fix is worth the same fraction either way, so
    // the ratio holds while the absolute error keeps halving per bit.
    expect(ratio(4)).toBeGreaterThan(0.4)
    expect(ratio(4)).toBeLessThan(0.65)
    expect(Math.abs(ratio(4) - ratio(8))).toBeLessThan(0.1)
    expect(groupedQuantisation(activations, 4, 8).error).toBeGreaterThan(
      groupedQuantisation(activations, 8, 8).error * 10,
    )
  })
})

describe('the migration', () => {
  it('leaves the product exactly where it was', () => {
    const before = dotProducts(activations, weights)
    for (const alpha of [0, 0.25, 0.5, 0.75, 1]) {
      const scales = smoothScales(activations, weights, alpha)
      const smoothed = dotProducts(
        activations.map((row) => row.map((value, j) => value / (scales[j] ?? 1))),
        weights.map((row) => row.map((value, j) => value * (scales[j] ?? 1))),
      )
      // Dividing a column of the activations and multiplying the matching
      // column of the weights is the same number. Only floating point objects.
      expect(relativeDifference(before, smoothed)).toBeLessThan(1e-9)
    }
  })

  it('moves the outliers, and says how much it moved', () => {
    const none = smoothQuant(activations, weights, 0)
    const all = smoothQuant(activations, weights, 1)
    const half = smoothQuant(activations, weights, 0.5)
    // At one the activations are made flat and the weights carry the width.
    expect(all.activationOutlierRatio).toBeCloseTo(1, 6)
    expect(all.weightOutlierRatio).toBeGreaterThan(10)
    // At zero it is the other way round.
    expect(none.weightOutlierRatio).toBeCloseTo(1, 6)
    expect(none.activationOutlierRatio).toBeGreaterThan(10)
    // At a half the two halves carry the same width, which is the whole of the
    // choice: the geometric mean splits it as evenly as a product can.
    expect(half.activationOutlierRatio).toBeCloseTo(half.weightOutlierRatio, 9)
    expect(half.activationOutlierRatio).toBeLessThan(6)
  })

  it('is what the eight-bit activation quantisation needs', () => {
    const unsmoothed = unsmoothedError(activations, weights, { bits: 8 })
    const half = smoothQuant(activations, weights, 0.5, { bits: 8 })
    expect(half.totalError).toBeLessThan(unsmoothed.totalError / 1.5)
    expect(half.activationError).toBeLessThan(unsmoothed.activationError / 2)
    // The weights are the half that can absorb the move, so their error rises
    // less than the activations' falls.
    expect(half.weightError).toBeLessThan(unsmoothed.weightError * 4)
  })

  it('has a minimum in the middle of the range it is chosen from', () => {
    const sweep = smoothQuantSweep(activations, weights, { bits: 8 })
    expect(sweep.map((entry) => entry.alpha)).toEqual([0, 0.25, 0.5, 0.75, 1])
    const best = sweep.reduce((b, s) => (s.totalError < b.totalError ? s : b))
    expect(best.alpha).toBe(0.5)
    // Both ends are worse than the middle, and the two ends are mirror images:
    // the error the migration moves is conserved, not destroyed.
    expect(sweep[0]!.totalError).toBeGreaterThan(best.totalError)
    expect(sweep[4]!.totalError).toBeGreaterThan(best.totalError)
    // Approaching the middle from either side is a steady improvement; the curve
    // is a valley, not a scatter.
    for (let i = 1; i <= 2; i++) expect(sweep[i]!.totalError).toBeLessThan(sweep[i - 1]!.totalError)
    expect(sweep[3]!.totalError).toBeGreaterThan(best.totalError)
    for (let i = 3; i < 4; i++) expect(sweep[i]!.totalError).toBeGreaterThan(sweep[i - 1]!.totalError)
  })
})

describe('the four-bit codebook', () => {
  it('has sixteen levels, and spends them where the data is', () => {
    expect(NF4_CODEBOOK).toHaveLength(16)
    for (let i = 1; i < NF4_CODEBOOK.length; i++) {
      expect(NF4_CODEBOOK[i]!).toBeGreaterThan(NF4_CODEBOOK[i - 1]!)
    }
    expect(NF4_CODEBOOK[0]).toBe(-1)
    expect(NF4_CODEBOOK[15]).toBe(1)
    expect(NF4_CODEBOOK).toContain(0)

    const gaps = NF4_CODEBOOK.slice(1).map((level, i) => level - NF4_CODEBOOK[i]!)
    const even = 1 / quantiserLevels(4)
    // Denser than the even grid around zero, coarser at the ends: the bell puts
    // its mass in the middle and its almost-nothing at the tails.
    expect(Math.min(...gaps)).toBeLessThan(even)
    expect(Math.max(...gaps)).toBeGreaterThan(even)
    expect(gaps[0]!).toBeGreaterThan(gaps[7]!)
  })

  it('rounds a value to the level nearest it, which is not the level nearest zero', () => {
    expect(nearestLevel(0.1)).toBeCloseTo(0.07958029954433441, 12)
    expect(nearestLevel(0.9)).toBe(1)
    expect(nearestLevel(-2)).toBe(-1)
    // The codebook is asymmetric about zero — 0.0796 above it, 0.0910 below —
    // so the same size either side of zero does not round the same way.
    expect(nearestLevel(0.04)).toBeCloseTo(0.07958029954433441, 12)
    expect(nearestLevel(-0.04)).toBe(0)
    expect(nearestLevel(-0.05)).toBeCloseTo(-0.09105003625154495, 12)
  })

  it('beats the even grid on bell-shaped weights, at the same four bits', () => {
    const report = normalFloatError(weights.flat())
    expect(report.error).toBeLessThan(report.uniformError * 0.85)
    expect(report.uniformStep).toBeCloseTo(maxOf(weights) / quantiserLevels(4), 9)
  })

  it('is worth the third the paper claims once the sample is big enough', () => {
    // The claim is about the distribution, so it is checked on a tensor large
    // enough that its own largest draw stops setting the range. A 512-value
    // sample saves less than a third because that one draw is what both grids
    // are sized for.
    const large = normalFloatError(gaussianMatrix(2000, 100, 11).flat())
    const small = normalFloatError(weights.flat())
    expect(large.error / large.uniformError).toBeCloseTo(2 / 3, 1)
    expect(small.error / small.uniformError).toBeGreaterThan(2 / 3)
  })

  it('is why the block is sixty-four and not the whole tensor', () => {
    const values = weights.flat()
    const clean = { block: blockedNormalFloatError(values, 64), whole: blockedNormalFloatError(values, values.length) }
    expect(clean.block).toBeLessThan(clean.whole)
    // One weight an order of magnitude bigger than its neighbours is the case
    // the block is for: with one grid for the tensor, that weight sets the
    // spacing for every other one in it.
    const withOutlier = [...values]
    withOutlier[100] = 60
    const hurt = {
      block: blockedNormalFloatError(withOutlier, 64),
      whole: blockedNormalFloatError(withOutlier, withOutlier.length),
    }
    expect(hurt.whole).toBeGreaterThan(clean.whole * 5)
    // Grouping confines the damage to the one block that holds the outlier, so
    // the RMSE over the whole tensor falls by about the square root of how many
    // blocks there are — 512/64 = 8, and the measured drop is 2.99 against the
    // sqrt(8) = 2.83 that the arithmetic predicts.
    const expected = hurt.whole / Math.sqrt(values.length / 64)
    expect(hurt.block).toBeLessThan(expected * 1.05)
    expect(hurt.block).toBeGreaterThan(expected / 1.6)
    // And the damage grows with the block, which is the curve the screen draws.
    // The ladder stops at the tensor's own width: a block larger than that is
    // still one block, so the last two rungs would be the same point.
    const ladder = [16, 64, 256, values.length].map((size) => blockedNormalFloatError(withOutlier, size))
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]!).toBeGreaterThan(ladder[i - 1]!)
  })
})

function maxOf(matrix: number[][]): number {
  let worst = 0
  for (const row of matrix) for (const value of row) if (Math.abs(value) > worst) worst = Math.abs(value)
  return worst
}
