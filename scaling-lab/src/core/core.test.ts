import { describe, expect, it } from 'vitest'
import { buildScalingTask, drawSample, irreducibleLoss, meanSquaredError, trainRidge } from './spectral'
import {
  compareAllocations,
  computeOptimum,
  doublingGain,
  fitPowerLaw,
  fitSurface,
  predictPowerLaw,
  surfaceLoss,
} from './surface'
import { buildRepeatsTask, repeatComparison, ridgeFit } from './repeats'
import {
  emergenceCurve,
  exactMatchScore,
  metricShift,
  roughness,
  transitionSharpness,
} from './emergence'

describe('the scaling task', () => {
  it('is deterministic for a given seed', () => {
    const task = buildScalingTask()
    const a = drawSample(task, 50, 3)
    const b = drawSample(task, 50, 3)
    expect(a.x).toEqual(b.x)
    expect(a.y).toEqual(b.y)
  })

  it('draws samples of the right shape', () => {
    const task = buildScalingTask({ features: 12 })
    const sample = drawSample(task, 7, 1)
    expect(sample.x.length).toBe(7)
    expect(sample.x[0]!.length).toBe(12)
    expect(sample.y.length).toBe(7)
  })

  it('is beaten by more capacity and more data', () => {
    const task = buildScalingTask()
    const small = trainRidge(task, { capacity: 4, samples: 400, seed: 2 })
    const large = trainRidge(task, { capacity: 48, samples: 400, seed: 2 })
    const more = trainRidge(task, { capacity: 48, samples: 3200, seed: 2 })
    expect(large.testLoss).toBeLessThan(small.testLoss)
    expect(more.testLoss).toBeLessThan(large.testLoss)
  })

  it('never gets below the noise', () => {
    const task = buildScalingTask()
    const run = trainRidge(task, { capacity: 64, samples: 4000, seed: 9 })
    expect(run.testLoss).toBeGreaterThanOrEqual(irreducibleLoss(task) - 1e-6)
  })

  it('measures every point of the grid on the same ruler', () => {
    // The surface fit reads the fall of loss with the sample count, so the grid must
    // not fall *up* because its ruler got shorter. When the held-out set scaled with
    // the training set, its own error was a function of the axis being fitted and the
    // grid came out non-monotone in data at every capacity; a fixed held-out set is
    // what the claim below is really testing.
    const task = buildScalingTask({ decay: 0.75, noise: 0.05 })
    for (const capacity of [4, 8, 16, 32, 64]) {
      let previous = Infinity
      for (const samples of [50, 200, 800, 3200]) {
        const loss = trainRidge(task, { capacity, samples, seed: 11 }).testLoss
        expect(loss).toBeLessThanOrEqual(previous)
        previous = loss
      }
    }
  })

  it('charges the ridge penalty per training point, as the repeats module does', () => {
    // Two modules fit the same estimator and must mean the same thing by `ridge`.
    // An absolute penalty would shrink a 50-sample run and barely touch a 3200-sample
    // one, so the grid would be a sweep of two axes at once.
    const task = buildScalingTask()
    const { x, y } = drawSample(task, 300, 5)
    const run = trainRidge(task, { capacity: 16, samples: 300, seed: 5, ridge: 0.01 })
    expect(run.trainLoss).toBeCloseTo(meanSquaredError(x, y, ridgeFit(x, y, 16, 0.01), 16), 12)
  })
})

describe('the power law', () => {
  it('recovers an exponent that was put in', () => {
    const xs = [10, 20, 50, 100, 200, 500, 1000]
    const ys = xs.map((x) => 3 * x ** -0.42)
    const fit = fitPowerLaw(xs, ys)
    expect(fit.alpha).toBeCloseTo(0.42, 6)
    expect(fit.coefficient).toBeCloseTo(3, 6)
    expect(fit.r2).toBeCloseTo(1, 6)
  })

  it('predicts the values it was fitted to', () => {
    const xs = [10, 20, 50, 100]
    const ys = xs.map((x) => 1.5 * x ** -0.3)
    const fit = fitPowerLaw(xs, ys)
    for (let i = 0; i < xs.length; i++) {
      expect(predictPowerLaw(fit, xs[i]!)).toBeCloseTo(ys[i]!, 6)
    }
  })

  it('turns the exponent into the factor a doubling buys', () => {
    const fit = fitPowerLaw([10, 20, 50], [1, 0.5, 0.2])
    expect(doublingGain(fit)).toBeCloseTo(2 ** -fit.alpha, 8)
  })

  it('refuses non-positive values', () => {
    expect(() => fitPowerLaw([1, 0], [1, 1])).toThrow()
    expect(() => fitPowerLaw([1, 2], [1, -1])).toThrow()
  })
})

describe('the loss surface', () => {
  const points = [
    { capacity: 4, samples: 100, loss: 1.4 },
    { capacity: 4, samples: 400, loss: 1.05 },
    { capacity: 8, samples: 100, loss: 0.95 },
    { capacity: 8, samples: 400, loss: 0.62 },
    { capacity: 16, samples: 100, loss: 0.7 },
    { capacity: 16, samples: 400, loss: 0.42 },
    { capacity: 32, samples: 100, loss: 0.55 },
    { capacity: 32, samples: 400, loss: 0.3 },
    { capacity: 64, samples: 400, loss: 0.25 },
    { capacity: 64, samples: 1600, loss: 0.18 },
  ]

  it('fits a surface that was put in', () => {
    const fit = fitSurface(points)
    expect(fit.r2).toBeGreaterThan(0.98)
    expect(fit.alpha).toBeGreaterThan(0)
    expect(fit.beta).toBeGreaterThan(0)
    expect(fit.constrained).toBe(false)
  })

  it('refuses a floor that is not a loss', () => {
    // The measured grid at decay 0.75, in the shape that broke the unconstrained fit.
    // Its fall with the sample count is steep at capacity 64 and nearly flat at
    // capacity 4, because a variance term is σ²·capacity/samples and so rides on the
    // capacity; an additive surface cannot be steep and flat in the same column, and
    // unconstrained least squares buys its way out with an intercept of −0.44. The
    // constrained fit pays with a worse R² instead, which is the honest price.
    const stiff = [
      { capacity: 4, samples: 50, loss: 0.75 },
      { capacity: 4, samples: 200, loss: 0.69 },
      { capacity: 4, samples: 800, loss: 0.67 },
      { capacity: 8, samples: 50, loss: 0.59 },
      { capacity: 8, samples: 200, loss: 0.51 },
      { capacity: 8, samples: 800, loss: 0.46 },
      { capacity: 32, samples: 50, loss: 0.23 },
      { capacity: 32, samples: 200, loss: 0.18 },
      { capacity: 32, samples: 800, loss: 0.14 },
      { capacity: 64, samples: 50, loss: 0.14 },
      { capacity: 64, samples: 200, loss: 0.08 },
      { capacity: 64, samples: 800, loss: 0.06 },
    ]
    const fit = fitSurface(stiff)
    expect(fit.constrained).toBe(true)
    expect(fit.E).toBeGreaterThanOrEqual(0)
    expect(fit.A).toBeGreaterThanOrEqual(0)
    expect(fit.B).toBeGreaterThanOrEqual(0)
    // Nothing downstream can now be handed a negative loss: the surface, the optimum,
    // and every allocation the comparison tables print.
    for (const capacity of [1, 8, 64, 1024]) {
      for (const samples of [1, 64, 4096]) {
        expect(surfaceLoss(fit, capacity, samples)).toBeGreaterThanOrEqual(0)
      }
    }
    expect(computeOptimum(fit, 1e6).loss).toBeGreaterThan(0)
  })

  it('finds the real floor when the grid is additive enough', () => {
    // The same fixture with a thin spectral tail: the capacity term is small, the
    // variance term is what the data axis is reading, and the additive form fits it.
    // Then the constraint does not bind and the fitted floor lands on the noise that
    // was actually put in — which is the claim the surface is supposed to earn.
    const task = buildScalingTask({ decay: 1.1, noise: 0.05 })
    const grid = [4, 8, 16, 32, 64].flatMap((capacity) =>
      [50, 200, 800, 3200].map((samples) => ({
        capacity,
        samples,
        loss: trainRidge(task, { capacity, samples, seed: 11 }).testLoss,
      })),
    )
    const fit = fitSurface(grid)
    expect(fit.constrained).toBe(false)
    expect(fit.E).toBeCloseTo(irreducibleLoss(task), 2)
    expect(fit.r2).toBeGreaterThan(0.98)
  })

  it('predicts the loss it was fitted to', () => {
    const fit = fitSurface(points)
    for (const point of points) {
      expect(surfaceLoss(fit, point.capacity, point.samples)).toBeCloseTo(point.loss, 1)
    }
  })

  it('puts the compute optimum between the two extremes', () => {
    const fit = fitSurface(points)
    const optimum = computeOptimum(fit, 1e6)
    expect(optimum.capacity).toBeGreaterThan(1)
    expect(optimum.samples).toBeGreaterThan(1)
    expect(optimum.capacity).toBeLessThan(1e6 / 6)
  })

  it('beats the naive allocations', () => {
    const fit = fitSurface(points)
    const comparisons = compareAllocations(fit, 1e6)
    const optimum = comparisons.find((row) => row.name === 'the compute optimum')!
    for (const row of comparisons) {
      if (row.name === 'the compute optimum') continue
      expect(optimum.loss).toBeLessThanOrEqual(row.loss + 1e-9)
    }
  })

  it('moves the optimum when the budget moves', () => {
    const fit = fitSurface(points)
    const small = computeOptimum(fit, 1e5)
    const large = computeOptimum(fit, 1e8)
    expect(large.capacity).toBeGreaterThan(small.capacity)
    expect(large.samples).toBeGreaterThan(small.samples)
  })
})

describe('the repeats', () => {
  it('builds a task with the right shape', () => {
    const task = buildRepeatsTask({ unique: 50, features: 6, capacity: 10 })
    expect(task.x.length).toBe(50)
    expect(task.x[0]!.length).toBe(10)
    expect(task.testX.length).toBeGreaterThan(0)
  })

  it('gives the repeated run the same model as a single pass', () => {
    const task = buildRepeatsTask({ unique: 40, features: 6, capacity: 12, seed: 3 })
    const once = ridgeFit(task.x, task.y, task.features, 0.05)
    const repeatedX: number[][] = []
    const repeatedY: number[] = []
    for (let r = 0; r < 4; r++) {
      for (let n = 0; n < task.x.length; n++) {
        repeatedX.push(task.x[n]!)
        repeatedY.push(task.y[n]!)
      }
    }
    const many = ridgeFit(repeatedX, repeatedY, task.features, 0.05)
    for (let f = 0; f < task.features; f++) {
      expect(many[f]!).toBeCloseTo(once[f]!, 8)
    }
  })

  it('shows the price of repeating: the fresh run keeps improving', () => {
    const task = buildRepeatsTask({ unique: 60, features: 8, capacity: 16, seed: 9 })
    const comparison = repeatComparison(task, [1, 2, 4], { ridge: 0.05 })
    expect(comparison.length).toBe(3)
    for (const row of comparison) {
      expect(row.freshLoss).toBeLessThan(row.repeatedLoss)
    }
    // And the fresh run gets better as it sees more rows.
    expect(comparison[2]!.freshLoss).toBeLessThan(comparison[0]!.freshLoss)
  })

  it('charges the repeated run for the rows it re-read', () => {
    const task = buildRepeatsTask({ unique: 30, features: 6, capacity: 10, seed: 4 })
    const comparison = repeatComparison(task, [1, 4], { ridge: 0.05 })
    expect(comparison[1]!.compute).toBe(4 * comparison[0]!.compute)
  })
})

describe('emergence', () => {
  it('gives the whole-sequence score as a power of the per-token one', () => {
    expect(exactMatchScore(0.9, 1)).toBeCloseTo(0.9, 10)
    expect(exactMatchScore(0.9, 2)).toBeCloseTo(0.81, 10)
    expect(exactMatchScore(0.5, 10)).toBeCloseTo(0.0009765625, 10)
  })

  it('makes the transition sharper as the task gets longer', () => {
    const compute = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]
    const short = emergenceCurve(compute, 1)
    const long = emergenceCurve(compute, 20)
    expect(transitionSharpness(long)).toBeLessThan(transitionSharpness(short))
  })

  it('makes the exact-match curve rougher than the continuous one', () => {
    const compute = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]
    const curve = emergenceCurve(compute, 12)
    const exact = curve.map((point) => ({ exact: point.exact }))
    const continuous = curve.map((point) => ({ exact: point.continuous }))
    expect(roughness(exact)).toBeGreaterThan(roughness(continuous))
  })

  it('moves the point of the cliff when the metric’s threshold moves', () => {
    const compute = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]
    const low = metricShift(compute, 8, 0.3)
    const high = metricShift(compute, 8, 0.7)
    const firstLow = low.find((point) => point.score > 0.5)
    const firstHigh = high.find((point) => point.score > 0.5)
    expect(firstLow!.compute).toBeLessThan(firstHigh!.compute)
  })

  it('never reports a score outside the unit interval', () => {
    const compute = [1, 2, 4, 8, 16, 32]
    for (const point of emergenceCurve(compute, 5)) {
      expect(point.exact).toBeGreaterThanOrEqual(0)
      expect(point.exact).toBeLessThanOrEqual(1)
    }
  })
})
