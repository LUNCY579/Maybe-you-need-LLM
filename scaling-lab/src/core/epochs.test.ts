import { describe, expect, it } from 'vitest'
import { fitSurface, type SurfacePoint } from './surface'
import { analyticOptimum } from './isoflop'
import {
  buildEpochTask,
  constrainedOptimum,
  constrainedSurfaceLoss,
  dominanceEpoch,
  effectiveDataForTokens,
  effectiveDataLaw,
  effectiveSamples,
  epochCurve,
  epochsForValue,
  PAPER_REPETITION_CONSTANT,
  phaseBoundaries,
  repetitionSchedule,
  repetitionValue,
} from './epochs'

const POINTS: SurfacePoint[] = [
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
const fit = fitSurface(POINTS)

/** The curve the laboratory draws at its starting settings. */
const curve = epochCurve()
const phases = phaseBoundaries(curve)

describe('the epoch task', () => {
  it('takes the pool from the head of the fresh stream', () => {
    const task = buildEpochTask({ unique: 30, epochs: 6 })
    expect(task.pool).toEqual(task.stream.slice(0, 30))
    expect(task.poolY).toEqual(task.streamY.slice(0, 30))
    expect(task.stream.length).toBe(180)
  })

  it('scores both runs on the same held-out rows', () => {
    const task = buildEpochTask({ unique: 20, epochs: 4 })
    expect(task.testX.length).toBe(task.testY.length)
    expect(task.testX[0]!.length).toBe(task.features)
    expect(task.pool[0]!.length).toBe(task.features)
  })

  it('is deterministic', () => {
    expect(epochCurve({ seed: 3 })).toEqual(epochCurve({ seed: 3 }))
  })
})

describe('the measured epoch curve', () => {
  it('starts with the two runs identical, because the first epoch is the same data', () => {
    const first = curve[0]!
    expect(first.repeatedLoss).toBe(first.freshLoss)
    expect(first.gap).toBe(0)
    expect(first.epoch).toBe(1)
  })

  it('has a warmup in which repetition is nearly free', () => {
    expect(phases.warmupEnd).not.toBeNull()
    expect(phases.warmupEnd!).toBeGreaterThanOrEqual(2)
    for (const point of curve.slice(0, phases.warmupEnd!)) {
      expect(point.relativeGap).toBeLessThanOrEqual(0.02)
    }
  })

  it('opens the gap once the pool has been converged on', () => {
    const warmup = curve[phases.warmupEnd!]!
    const end = curve[curve.length - 1]!
    expect(end.gap).toBeGreaterThan(warmup.gap)
    expect(end.freshLoss).toBeLessThan(end.repeatedLoss)
  })

  it('turns upward: the decay phase is there to be found', () => {
    expect(phases.decayStart).not.toBeNull()
    expect(phases.decayStart!).toBeGreaterThan(phases.bestEpoch)
    const end = curve[curve.length - 1]!
    expect(end.repeatedLoss).toBeGreaterThan(phases.bestLoss)
    expect(phases.plateauStart).not.toBeNull()
    expect(phases.plateauStart!).toBeGreaterThan(phases.warmupEnd!)
    expect(phases.plateauStart!).toBeLessThan(phases.decayStart!)
  })

  it('keeps improving with fresh data while the repeated run stalls', () => {
    const end = curve[curve.length - 1]!
    expect(end.freshLoss).toBeLessThan(phases.bestLoss)
  })

  it('reports the marginal gains the dominance epoch is read from', () => {
    for (const point of curve.slice(1)) {
      expect(point.repeatedGain).toBeCloseTo(curve[point.epoch - 2]!.repeatedLoss - point.repeatedLoss, 10)
      expect(point.freshGain).toBeCloseTo(curve[point.epoch - 2]!.freshLoss - point.freshLoss, 10)
      expect(point.tokens).toBe(point.epoch * point.uniqueSeen)
      expect(point.freshSeen).toBe(point.tokens)
    }
  })

  it('names an epoch at which repetition dominates', () => {
    const dominance = dominanceEpoch(curve)
    expect(dominance).not.toBeNull()
    expect(dominance!).toBeGreaterThanOrEqual(2)
    expect(dominance!).toBeLessThan(curve.length)
    const point = curve[dominance! - 1]!
    expect(point.repeatedGain).toBeLessThanOrEqual(0.5 * point.freshGain)
  })

  it('pushes the dominance epoch back when the pool is bigger', () => {
    const small = dominanceEpoch(epochCurve({ unique: 20 }))
    const large = dominanceEpoch(epochCurve({ unique: 90 }))
    expect(small).not.toBeNull()
    expect(large).not.toBeNull()
    expect(large!).toBeGreaterThan(small!)
  })

  it('refuses to invent a dominance epoch when there is none', () => {
    // Two runs gaining the same amount every epoch: no pass of either is the
    // cheaper compute, so the question has no answer and gets null.
    const even = curve.map((point) => ({ ...point, repeatedGain: 10, freshGain: 10 }))
    expect(dominanceEpoch(even)).toBeNull()
  })
})

describe('the effective data an epoch is worth', () => {
  it('is exactly one pass at the first epoch', () => {
    expect(effectiveSamples(curve, 1)).toBe(curve[0]!.uniqueSeen)
  })

  it('rises, then stops rising, however many tokens are read', () => {
    const worth = curve.map((point) => effectiveSamples(curve, point.epoch))
    expect(worth[3]!).toBeGreaterThan(worth[1]!)
    expect(worth[8]!).toBeGreaterThan(worth[3]!)
    // The increments collapse: the fifth epoch buys less than the second did.
    expect(worth[1]! - worth[0]!).toBeGreaterThan(worth[5]! - worth[4]!)
    // And the peak is a small fraction of the tokens the long run reads, and
    // sits long before its end.
    const last = curve[curve.length - 1]!
    const peak = Math.max(...worth)
    const peakEpoch = worth.indexOf(peak)
    expect(peak).toBeLessThan(last.tokens / 4)
    expect(peakEpoch + 1).toBeLessThan(curve.length)
    expect(worth[curve.length - 1]!).toBeLessThan(peak)
  })

  it('can be worth more than the tokens it read, and says so', () => {
    // The honest difference between the measurement and the paper's law: with a
    // pool small enough to determine the function already, a second pass beats
    // the same compute spent on fresh rows, because the fresh rows only add
    // variance. The inversion does not pretend otherwise by clamping — but the
    // overshoot is one epoch's worth, not a running one.
    const second = effectiveSamples(curve, 2)
    expect(second).toBeGreaterThan(curve[1]!.tokens)
    expect(second).toBeLessThan(curve[2]!.tokens)
  })

  it('is measured, and agrees with the paper’s law in kind', () => {
    // Both say the same thing about the fourth epoch: it is nearly as good as
    // four passes of fresh data. The measured value is the ratio of the
    // inversion to the tokens read.
    const measured = effectiveSamples(curve, 4) / curve[3]!.tokens
    expect(measured).toBeGreaterThan(0.7)
    expect(measured).toBeLessThanOrEqual(1)
    const law = effectiveDataLaw(1, 3) / 4
    expect(law).toBeGreaterThan(0.7)
    expect(law).toBeLessThanOrEqual(1)
  })

  it('refuses an epoch the curve does not have', () => {
    expect(() => effectiveSamples(curve, 999)).toThrow()
    expect(() => effectiveSamples([], 1)).toThrow()
  })
})

describe('the paper’s effective-data law', () => {
  it('values one pass at exactly itself', () => {
    expect(effectiveDataLaw(100, 0)).toBe(100)
    expect(effectiveDataForTokens(100, 100)).toBe(100)
  })

  it('is continuous where the repeats begin', () => {
    expect(effectiveDataForTokens(100, 100.0001)).toBeCloseTo(100, 3)
    expect(effectiveDataForTokens(100, 99)).toBe(99)
  })

  it('saturates at the pool times one plus the constant', () => {
    const ceiling = 100 * (1 + PAPER_REPETITION_CONSTANT.data)
    expect(effectiveDataLaw(100, 1e6)).toBeLessThanOrEqual(ceiling + 1e-6)
    expect(effectiveDataLaw(100, 1e6)).toBeCloseTo(ceiling, 4)
  })

  it('rises and curves over: every extra epoch is worth less than the last', () => {
    const series = repetitionSchedule(100, 12)
    for (let i = 1; i < series.length; i++) {
      const before = series[i - 1]!
      const after = series[i]!
      expect(after.effectiveData).toBeGreaterThan(before.effectiveData)
      expect(after.nextEpochValue).toBeLessThan(before.nextEpochValue)
    }
  })

  it('keeps four epochs nearly free, as the paper reports', () => {
    // Their abstract's claim, read off their own expression with their own
    // constant: the fifth pass is still worth most of a fresh one.
    expect(repetitionValue(4)).toBeGreaterThan(0.75)
    expect(effectiveDataLaw(100, 4)).toBeGreaterThan(0.75 * 500)
    // And the value decays to nothing far out.
    expect(repetitionValue(39)).toBeLessThan(0.1)
  })

  it('answers the how-many-epochs question in closed form', () => {
    for (const fraction of [0.9, 0.5, 0.1]) {
      const epochs = epochsForValue(fraction)
      expect(repetitionValue(epochs)).toBeCloseTo(fraction, 10)
    }
    expect(() => epochsForValue(0)).toThrow()
    expect(() => epochsForValue(1.5)).toThrow()
  })

  it('never values more tokens than the run read', () => {
    for (const epochs of [1, 2, 5, 20, 200]) {
      const tokens = epochs * 100
      expect(effectiveDataForTokens(100, tokens)).toBeLessThanOrEqual(tokens + 1e-9)
    }
  })

  it('refuses impossible inputs', () => {
    expect(() => effectiveDataLaw(100, -1)).toThrow()
    expect(() => effectiveDataLaw(-1, 1)).toThrow()
    expect(() => effectiveDataForTokens(0, 10)).toThrow()
  })
})

describe('the allocation when the pool binds', () => {
  const budget = 1e6

  it('leaves the optimum alone while the pool is bigger than the optimum wants', () => {
    const free = constrainedOptimum(fit, budget, 1e9)
    const exact = analyticOptimum(fit, budget)
    expect(free.binds).toBe(false)
    expect(free.capacity / exact.capacity).toBeCloseTo(1, 6)
    expect(free.loss).toBeCloseTo(exact.loss, 10)
    expect(Math.abs(free.price)).toBeLessThan(1e-12)
  })

  it('pushes the compute into capacity once the pool binds', () => {
    const exact = analyticOptimum(fit, budget)
    const tight = constrainedOptimum(fit, budget, 20)
    expect(tight.binds).toBe(true)
    expect(tight.capacity).toBeGreaterThan(exact.capacity)
    expect(tight.epochs).toBeGreaterThan(1)
    expect(tight.loss).toBeGreaterThan(exact.loss)
  })

  it('costs more the smaller the pool is', () => {
    const prices = [1e9, 1000, 300, 100, 30].map((pool) => constrainedOptimum(fit, budget, pool).price)
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]!).toBeGreaterThanOrEqual(prices[i - 1]!)
    }
  })

  it('reads the same surface the unconstrained optimum reads', () => {
    const constrained = constrainedOptimum(fit, budget, 300)
    expect(constrained.loss).toBe(
      constrainedSurfaceLoss(fit, constrained.capacity, constrained.tokens, 300),
    )
    expect(constrained.effectiveData).toBeCloseTo(
      effectiveDataForTokens(300, constrained.tokens),
      8,
    )
    expect(constrained.tokens * constrained.capacity).toBeCloseTo(budget / 6, 4)
  })

  it('never beats the unconstrained optimum, by definition', () => {
    for (const pool of [50, 150, 400, 900, 5000]) {
      const constrained = constrainedOptimum(fit, budget, pool)
      expect(constrained.loss).toBeGreaterThanOrEqual(constrained.unconstrained.loss - 1e-12)
      expect(constrained.ceilingUse).toBeGreaterThan(0)
      expect(constrained.ceilingUse).toBeLessThanOrEqual(1)
    }
  })

  it('refuses an impossible budget or pool', () => {
    expect(() => constrainedOptimum(fit, 0, 100)).toThrow()
    expect(() => constrainedOptimum(fit, 1e6, 0)).toThrow()
  })
})
