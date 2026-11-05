import { describe, expect, it } from 'vitest'
import {
  accuracyNeededForLength,
  artefactGap,
  capabilityCurve,
  cliffInterval,
  exactMatchScore,
  emergenceCurve,
  lengthNeededForAccuracy,
  logSweep,
  maxStep,
  metricShift,
  onsetCompute,
  partialCreditScore,
  roughness,
  transitionSharpness,
} from './emergence'

/** The sweep the scaling curves are read on: ten billion times the compute. */
const compute = logSweep(1e1, 1e10, 40)
/** The spacing of that sweep, in decades of compute. */
const DECADE = 9 / 39
/** A sweep uniform in accuracy, which is where a whole-sequence metric is steep. */
const accuracyAxis = Array.from({ length: 200 }, (_, index) => 0.5 + index * (0.499 / 199))

describe('the two readings of one model', () => {
  it('scores a whole sequence by multiplying the per-token chance', () => {
    expect(exactMatchScore(0.9, 1)).toBeCloseTo(0.9, 12)
    expect(exactMatchScore(0.9, 2)).toBeCloseTo(0.81, 12)
    expect(exactMatchScore(0.5, 10)).toBeCloseTo(0.5 ** 10, 15)
    for (const length of [1, 2, 5, 20, 100]) {
      expect(exactMatchScore(0.9, length)).toBeCloseTo(0.9 ** length, 15)
      if (length > 1) expect(exactMatchScore(0.9, length)).toBeLessThan(exactMatchScore(0.9, length - 1))
    }
  })

  it('gives the continuous metric no threshold to be fooled by', () => {
    // The partial-credit reading is the per-token accuracy itself, which is why
    // every comparison below is a comparison of a curve with itself passed through
    // the multiplication.
    for (const length of [1, 7, 40]) {
      expect(partialCreditScore(0.73, length)).toBeCloseTo(0.73, 12)
    }
    for (const point of emergenceCurve(compute, 12)) {
      expect(point.continuous).toBeCloseTo(point.accuracy, 15)
      expect(point.exact).toBeLessThanOrEqual(point.accuracy + 1e-15)
      expect(point.exact).toBeGreaterThanOrEqual(0)
      expect(point.continuous).toBeLessThanOrEqual(1)
    }
  })

  it('rises smoothly, with no threshold anywhere in the underlying performance', () => {
    const curve = capabilityCurve(compute)
    expect(curve[0]!.accuracy).toBeLessThan(curve[curve.length - 1]!.accuracy)
    const steps: number[] = []
    for (let i = 1; i < curve.length; i++) {
      const step = curve[i]!.accuracy - curve[i - 1]!.accuracy
      // Never downward, and strictly upward while there is room below the ceiling.
      expect(step).toBeGreaterThanOrEqual(0)
      if (curve[i]!.accuracy < 0.999) expect(step).toBeGreaterThan(0)
      steps.push(step)
    }
    // Concave: each decade of compute buys less than the one before it.
    for (let i = 1; i < 25; i++) {
      expect(steps[i]!).toBeLessThan(steps[i - 1]!)
    }
    expect(maxStep(curve.map((point) => point.accuracy))).toBeLessThan(0.075)
    for (const point of curve) {
      expect(point.accuracy).toBeLessThanOrEqual(0.999)
      expect(point.accuracy).toBeGreaterThan(0)
    }
  })

  it('is capped by the ceiling, which is where the sharpness measure turns around', () => {
    const uncapped = capabilityCurve(compute, { ceiling: 1 })
    const capped = capabilityCurve(compute)
    expect(uncapped[uncapped.length - 1]!.accuracy).toBeGreaterThan(0.999)
    expect(capped[capped.length - 1]!.accuracy).toBeCloseTo(0.999, 12)
    // The ceiling binds late — at the thirty-fourth point of forty — so three
    // quarters of the way up the sweep the two curves are the same curve.
    expect(uncapped[28]!.accuracy).toBeCloseTo(capped[28]!.accuracy, 12)
    expect(compute.findIndex((_value, index) => capped[index]!.accuracy >= 0.999)).toBe(33)
  })
})

describe('the metric-artefact effect, measured', () => {
  it('has a gap that peaks where the analytic derivative says it must', () => {
    // The gap a − a^L is largest where 1 = L·a^(L−1), which for twenty tokens is a
    // per-token accuracy of 0.8541 and a gap of 0.8114. The sweep is coarse, so the
    // measured peak sits a grid point away and never above the analytic value.
    const reading = artefactGap(compute, 20)
    const analyticAccuracy = (1 / 20) ** (1 / 19)
    expect(analyticAccuracy).toBeCloseTo(0.8541, 4)
    const analyticGap = analyticAccuracy - analyticAccuracy ** 20
    expect(analyticGap).toBeCloseTo(0.8114, 4)
    expect(reading.maxGap).toBeLessThanOrEqual(analyticGap + 1e-12)
    expect(reading.maxGap).toBeGreaterThan(analyticGap - 0.005)
    expect(reading.accuracyAtMax).toBeCloseTo(analyticAccuracy, 1)
    expect(reading.maxGap).toBeCloseTo(reading.accuracyAtMax - reading.scoreAtMax, 12)
    expect(reading.scoreAtMax).toBeCloseTo(0.0501, 3)
    expect(reading.atCompute).toBe(242.44620170823288)
  })

  it('is nothing at all for a task one token long', () => {
    const reading = artefactGap(compute, 1)
    expect(reading.maxGap).toBeCloseTo(0, 12)
    expect(reading.accuracyAtMax).toBeCloseTo(reading.scoreAtMax, 12)
    expect(reading.blindPoints).toBe(0)
    expect(reading.blindSpan).toBe(0)
    expect(reading.metricJump).toBeCloseTo(reading.performanceJump, 12)
    expect(reading.onset).toBe(compute[0])
  })

  it('gets worse the longer the task is', () => {
    const gaps = [1, 2, 5, 20, 50, 100, 200].map((length) => artefactGap(compute, length).maxGap)
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]!).toBeGreaterThan(gaps[i - 1]!)
    }
    expect(gaps[3]).toBeCloseTo(0.811, 2)
    expect(gaps[4]).toBeCloseTo(0.905, 2)
    expect(gaps[6]).toBeCloseTo(0.969, 2)
  })

  it('calls the task failed while the model is already right on most tokens', () => {
    const reading = artefactGap(compute, 20)
    expect(reading.blindPoints).toBe(4)
    expect(reading.blindSpan).toBeCloseTo(39.24, 2)
    // The count is reproducible from the curve it was measured on: those are the
    // points where the metric is under a hundredth and the accuracy over half.
    const blind = emergenceCurve(compute, 20).filter((point) => point.exact <= 0.01 && point.accuracy >= 0.5)
    expect(blind).toHaveLength(reading.blindPoints)
    for (const point of blind) {
      expect(point.accuracy).toBeGreaterThanOrEqual(0.5)
      expect(point.exact).toBeLessThanOrEqual(0.01)
    }
    // A longer task is blind for longer, and the two knobs move the answer in the
    // directions they are described as moving it.
    const wide = artefactGap(compute, 100)
    expect(wide.blindPoints).toBeGreaterThan(reading.blindPoints)
    expect(wide.blindSpan).toBeGreaterThan(reading.blindSpan)
    expect(artefactGap(compute, 20, { floor: 0 }).blindPoints).toBe(0)
    expect(artefactGap(compute, 20, { blindAt: 0.9 }).blindPoints).toBe(0)
  })

  it('first says anything when the model could already do four fifths of the task', () => {
    const reading = artefactGap(compute, 20, { floor: 0.01 })
    const needed = accuracyNeededForLength(20, 0.01)
    // A whole-sequence score of one hundredth over twenty tokens is earned by a
    // per-token accuracy of 10^(−0.1) — four fifths of the tokens already right.
    expect(needed).toBeCloseTo(0.7943282347242815, 12)
    expect(reading.onset).toBeCloseTo(83.77, 2)
    expect(reading.accuracyAtOnset).toBeGreaterThanOrEqual(needed)
    // The point before it is the blind one, and the requirement is met for the
    // first time exactly at the onset.
    const index = compute.indexOf(reading.onset!)
    const curve = emergenceCurve(compute, 20)
    expect(curve[index - 1]!.exact).toBeLessThan(0.01)
    expect(curve[index]!.exact).toBeGreaterThan(0.01)
    const accuracy = capabilityCurve(compute)
    expect(accuracy[index]!.accuracy).toBeGreaterThanOrEqual(needed)
    expect(accuracy[index - 1]!.accuracy).toBeLessThan(needed)
    // A hundredth of a score is not an ability: the metric reports 0.011057 there.
    expect(curve[index]!.exact).toBeCloseTo(0.011057, 6)
  })

  it('is a jump when the axis is accuracy, and a span when the axis is compute', () => {
    // Read on an axis uniform in the model's own performance, the metric takes a
    // step the performance never takes. The mean value theorem bounds it: one step
    // of q^L is at most L steps of q, and for a task of any length it is most of
    // that. This is the discontinuity the paper's argument is about.
    const base = maxStep(accuracyAxis)
    expect(base).toBeCloseTo(0.499 / 199, 12)
    for (const length of [1, 2, 5, 20, 100]) {
      const jump = maxStep(accuracyAxis.map((q) => exactMatchScore(q, length)))
      expect(jump / base).toBeLessThanOrEqual(length + 1e-9)
      expect(jump / base).toBeGreaterThan(length / 2)
      if (length > 1) expect(jump).toBeGreaterThan(maxStep(accuracyAxis.map((q) => exactMatchScore(q, length - 1))))
    }
    expect(maxStep(accuracyAxis.map((q) => exactMatchScore(q, 1)))).toBeCloseTo(base, 12)
    expect(maxStep(accuracyAxis.map((q) => exactMatchScore(q, 100)))).toBeCloseTo(0.2011, 3)

    // Read on the log-compute axis the scaling laws live on, the same cliff is
    // spread over forty samples, and its largest step is smaller than the accuracy
    // curve's own. A coarse grid makes a cliff look smooth, which is why the
    // artefact is reported above as a span of blind points rather than a jump.
    const reading = artefactGap(compute, 20)
    expect(reading.metricJump).toBeLessThan(reading.performanceJump)
    expect(reading.metricJump).toBeCloseTo(0.0701, 3)
    expect(reading.performanceJump).toBeCloseTo(0.072, 3)
  })

  it('is a cliff whose roughness depends on where it is sampled', () => {
    // The same model's exact-match curve is rougher than its continuous curve on a
    // ten-point log2 axis that stops before the ceiling, and smoother on the forty
    // point decade axis. Both are true, and the difference is the sampling — which
    // is why roughness is a diagnostic here and not the argument.
    const narrow = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]
    const shortCurve = emergenceCurve(narrow, 12)
    expect(roughness(shortCurve)).toBeCloseTo(0.109, 3)
    expect(roughness(shortCurve)).toBeGreaterThan(
      roughness(shortCurve.map((point) => ({ exact: point.continuous }))),
    )
    const wide = emergenceCurve(compute, 20)
    expect(roughness(wide)).toBeLessThan(
      roughness(wide.map((point) => ({ exact: point.continuous }))),
    )
    expect(roughness([{ exact: 1 }, { exact: 1 }, { exact: 1 }])).toBe(0)
    expect(roughness([{ exact: 1 }, { exact: 2 }])).toBe(0)
  })
})

describe('locating the cliff', () => {
  it('reads the first crossing of a fraction of the best the curve ever does', () => {
    const exact = emergenceCurve(compute, 20).map((point) => point.exact)
    expect(exact[exact.length - 1]).toBeCloseTo(0.9802, 3)
    // The capability reaches its ceiling at the thirty-fourth point of forty, so the
    // score's maximum is attained there and the curve is flat for the last six
    // samples. The crossing of a whole fraction of one is the start of that plateau,
    // not the end of the sweep — which is what the tests of a fully uncapped curve
    // below make explicit.
    expect(onsetCompute(compute, exact, 1)).toBe(compute[33])
    const uncapped = emergenceCurve(compute, 20, { ceiling: 1 }).map((point) => point.exact)
    // Read with no ceiling the score keeps rising to the last sample, so a
    // fraction of one is only crossed there, and the value is the accuracy the
    // power law itself predicts.
    const topAccuracy = 1 - 0.95 * 1e10 ** -0.35
    expect(Math.max(...uncapped)).toBeCloseTo(topAccuracy ** 20, 12)
    expect(onsetCompute(compute, uncapped, 1)).toBe(compute[compute.length - 1])
    // Ten per cent of the final score arrives at seven hundred; ninety per cent
    // not until two million. The transition is three and a half decades wide.
    expect(onsetCompute(compute, exact, 0.1)).toBeCloseTo(701.7, 1)
    expect(onsetCompute(compute, exact, 0.5)).toBeCloseTo(1.7e4, -2)
    expect(onsetCompute(compute, exact, 0.9)).toBeCloseTo(2030917.6209047365, 6)
  })

  it('returns null for a curve that never rises, and refuses nonsense', () => {
    expect(onsetCompute([1, 2, 3], [0, 0, 0], 0.5)).toBeNull()
    expect(onsetCompute([], [], 0.5)).toBeNull()
    expect(onsetCompute([1, 2, 3], [1, 2, 3], 1)).toBe(3)
    expect(() => onsetCompute([1, 2], [1], 0.5)).toThrow(/differ in length/)
    expect(() => onsetCompute([1, 2], [1, 2], 0)).toThrow(/outside/)
    expect(() => onsetCompute([1, 2], [1, 2], 1.5)).toThrow(/outside/)
  })

  it('reports the interval as a width and a ratio, which are the same fact twice', () => {
    const curve = emergenceCurve(compute, 20)
    const cliff = cliffInterval(compute, curve.map((point) => point.exact))
    expect(cliff.low).toBe(0.1)
    expect(cliff.high).toBe(0.9)
    expect(cliff.start).toBeCloseTo(701.7, 1)
    expect(cliff.end).toBeCloseTo(2030917.6209047365, 6)
    expect(cliff.width).toBeCloseTo(cliff.end! - cliff.start!, 6)
    expect(cliff.ratio).toBeCloseTo(cliff.end! / cliff.start!, 9)
    expect(cliff.ratio).toBeCloseTo(transitionSharpness(curve), 9)
    expect(cliff.ratio).toBeCloseTo(2894.3, 1)
    // A curve that never rises has no interval, and says so.
    const flat = cliffInterval([1, 2, 3], [0, 0, 0])
    expect(flat.start).toBeNull()
    expect(flat.end).toBeNull()
    expect(flat.width).toBe(0)
    expect(flat.ratio).toBe(Number.POSITIVE_INFINITY)
    expect(cliffInterval([1, 2, 3], [0, 0, 0], { low: 0.2, high: 0.8 }).low).toBe(0.2)
  })

  it('is quantised by the grid it was measured on', () => {
    // Both crossings are grid points, so every ratio this sweep can report is a
    // whole number of decades of the sampling. A sharpness figure quoted from a
    // coarse grid carries the grid's resolution with it, whether the reader is
    // told so or not — which is why the number is checked rather than trusted.
    for (const length of [1, 2, 5, 10, 20, 50, 100, 200]) {
      const ratio = cliffInterval(compute, emergenceCurve(compute, length).map((point) => point.exact)).ratio
      const decades = Math.log10(ratio) / DECADE
      expect(Math.abs(decades - Math.round(decades))).toBeLessThan(1e-9)
      expect(Math.round(decades)).toBeGreaterThan(0)
    }
  })

  it('does not get sharper with length when the measure is relative to the final score', () => {
    // The conventional story — the longer the task, the steeper the cliff — is
    // about the metric read against accuracy, and it is true there. Read against
    // compute on this sweep, with a ceiling on the capability, the ratio rises to a
    // maximum around ten tokens and then falls: a longer task's own best score is
    // lower, and the ninety-per-cent crossing is measured against that.
    const lengths = [1, 2, 5, 10, 20, 50, 100, 200]
    const sharpness = lengths.map((length) => transitionSharpness(emergenceCurve(compute, length)))
    expect(sharpness[1]!).toBeGreaterThan(sharpness[0]!)
    expect(sharpness[3]!).toBeGreaterThan(sharpness[2]!)
    expect(sharpness[3]!).toBeCloseTo(4923.9, 0)
    expect(sharpness[6]!).toBeLessThan(sharpness[5]!)
    expect(sharpness[7]!).toBeLessThan(sharpness[6]!)

    // The absolute crossings do move monotonically with the length, which is the
    // version of the claim that survives the change of measure.
    const absolute = [1, 2, 5, 10, 20, 50, 100].map((length) => {
      const scores = compute.map((c) => capabilityCurve([c])[0]!.accuracy ** length)
      return compute[scores.findIndex((score) => score >= 0.5)]!
    })
    for (let i = 1; i < absolute.length; i++) {
      expect(absolute[i]!).toBeGreaterThan(absolute[i - 1]!)
    }
    expect(absolute[4]).toBeCloseTo(17012.5, -1)
    expect(absolute[6]).toBeCloseTo(2030917.6209047365, 6)
  })

  it('has no transition at all when the curve has no compute axis', () => {
    // A sharpness number is a ratio of two computes, so a curve supplied without
    // one, or one that never rises, gets Infinity rather than the flattering
    // answer a silent default would invent.
    expect(transitionSharpness([])).toBe(Number.POSITIVE_INFINITY)
    expect(transitionSharpness([{ exact: 0 }, { exact: 0 }])).toBe(Number.POSITIVE_INFINITY)
    expect(transitionSharpness([{ exact: 0.5 }, { exact: 0.5 }])).toBe(Number.POSITIVE_INFINITY)
    // A curve that is already at its final value at the first sample has both
    // crossings at that sample, so the ratio is one: no transition was measured.
    expect(transitionSharpness([{ exact: 0.5, compute: 1 }, { exact: 0.5, compute: 2 }])).toBe(1)
  })
})

describe('the threshold, not the model, puts the cliff where it is', () => {
  it('is exactly zero below the threshold and rising above it', () => {
    for (const threshold of [0.7, 0.8, 0.9]) {
      const curve = metricShift(compute, 20, threshold)
      const first = curve.findIndex((point) => point.score > 0)
      expect(first).toBeGreaterThan(0)
      for (let i = 0; i < first; i++) expect(curve[i]!.score).toBe(0)
      const accuracy = capabilityCurve(compute)
      expect(accuracy[first]!.accuracy).toBeGreaterThan(threshold)
      expect(accuracy[first - 1]!.accuracy).toBeLessThanOrEqual(threshold)
      // The analytic crossing of the threshold and the grid point that answers
      // first have to bracket the same event.
      const crossing = (0.95 / (1 - threshold)) ** (1 / 0.35)
      expect(crossing).toBeGreaterThan(compute[first - 1]!)
      expect(crossing).toBeLessThanOrEqual(compute[first]!)
    }
  })

  it('moves the point of the cliff by nearly five decades when the threshold moves by half', () => {
    const onsets = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99].map((threshold) => {
      const curve = metricShift(compute, 20, threshold)
      return onsetCompute(compute, curve.map((point) => point.score), 0.5)!
    })
    for (let i = 1; i < onsets.length; i++) {
      expect(onsets[i]!).toBeGreaterThan(onsets[i - 1]!)
    }
    expect(onsets[0]).toBeCloseTo(49.24, 1)
    expect(onsets[6]).toBeCloseTo(3.455e6, -3)
    expect(Math.log10(onsets[6]! / onsets[0]!)).toBeGreaterThan(4)
    // The task length is in the signature and nowhere in the arithmetic: the same
    // threshold on the same model gives the same curve whatever the length is.
    expect(metricShift(compute, 1, 0.8)).toEqual(metricShift(compute, 40, 0.8))
  })

  it('is a cliff with a floor under it, not a smooth line with a name', () => {
    const curve = metricShift(compute, 20, 0.99)
    const scores = curve.map((point) => point.score)
    expect(scores[0]).toBe(0)
    expect(Math.max(...scores)).toBeCloseTo(0.9, 9)
    // The last point of the sweep is the ceiling minus the threshold over the room
    // left above it: (0.999 − 0.99) / (1 − 0.99).
    expect(scores[scores.length - 1]).toBeCloseTo((0.999 - 0.99) / (1 - 0.99), 9)
    expect(maxStep(scores)).toBeCloseTo(0.1458, 3)
    expect(maxStep(scores)).toBeLessThan(0.17)
  })

  it('refuses inputs that are not thresholds or not scores', () => {
    // A threshold of one leaves no room above it, and the metric reports zero
    // forever: the division by (1 − threshold) is capped, so this is stated.
    expect(metricShift(compute, 20, 1)).toHaveLength(compute.length)
    for (const point of metricShift(compute, 20, 1)) expect(point.score).toBe(0)
    expect(() => accuracyNeededForLength(0, 0.5)).toThrow(/positive/)
    expect(() => accuracyNeededForLength(20, 0)).toThrow(/outside/)
    expect(() => accuracyNeededForLength(20, 1.5)).toThrow(/outside/)
    expect(() => lengthNeededForAccuracy(1, 0.5)).toThrow(/outside/)
    expect(() => lengthNeededForAccuracy(0.5, 2)).toThrow(/outside/)
    expect(() => artefactGap(compute, 20, { floor: 1 })).toThrow(/outside/)
    expect(() => artefactGap(compute, 20, { blindAt: 0 })).toThrow(/outside/)
  })
})

describe('the inverse of the multiplication', () => {
  it('answers the question the metric asks, exactly', () => {
    for (const length of [1, 4, 17, 64]) {
      for (const score of [0.1, 0.5, 0.9]) {
        const needed = accuracyNeededForLength(length, score)
        expect(exactMatchScore(needed, length)).toBeCloseTo(score, 12)
        expect(lengthNeededForAccuracy(needed, score)).toBeCloseTo(length, 9)
        expect(needed).toBeGreaterThan(0)
        expect(needed).toBeLessThanOrEqual(1)
      }
    }
  })

  it('shows why a long task looks sudden', () => {
    // Ninety per cent on a hundred-token task needs 99.895 per cent on every token.
    expect(accuracyNeededForLength(100, 0.9)).toBeCloseTo(0.99895, 5)
    expect(accuracyNeededForLength(1, 0.9)).toBeCloseTo(0.9, 12)
    expect(accuracyNeededForLength(10, 0.5)).toBeCloseTo(0.933, 3)
    expect(lengthNeededForAccuracy(0.9, 0.5)).toBeCloseTo(6.5788, 4)
    expect(lengthNeededForAccuracy(0.99, 0.5)).toBeCloseTo(68.97, 1)
  })

  it('is the check the numeric sweep is held to', () => {
    // For each length, the compute at which the metric first reaches a fraction of
    // its best score is the grid point at which the accuracy first clears the
    // analytic requirement. This is the identity the artefact section is built on.
    for (const length of [5, 20, 60]) {
      const curve = emergenceCurve(compute, length)
      const scores = curve.map((point) => point.exact)
      const final = scores[scores.length - 1]!
      for (const fraction of [0.01, 0.1, 0.5]) {
        const onset = onsetCompute(compute, scores, fraction)!
        const index = compute.indexOf(onset)
        const needed = accuracyNeededForLength(length, fraction * final)
        expect(curve[index]!.accuracy).toBeGreaterThanOrEqual(needed)
        // A short task's score clears a hundredth of its best at the very first
        // sample, so there is no earlier grid point to have been below the line;
        // the requirement is already met before the sweep starts.
        if (index === 0) continue
        expect(curve[index - 1]!.accuracy).toBeLessThan(needed)
      }
    }
  })
})

describe('the sweep itself', () => {
  it('starts and ends where it was told to, and never doubles back', () => {
    expect(compute[0]).toBe(10)
    expect(compute[compute.length - 1]).toBeCloseTo(1e10, -4)
    expect(compute).toHaveLength(40)
    for (let i = 1; i < compute.length; i++) {
      expect(compute[i]!).toBeGreaterThan(compute[i - 1]!)
      expect(compute[i]! / compute[i - 1]!).toBeCloseTo(1e9 ** (1 / 39), 9)
    }
  })

  it('refuses a sweep that is not a sweep', () => {
    expect(() => logSweep(1, 10, 1)).toThrow(/two points/)
    expect(() => logSweep(0, 10, 10)).toThrow(/positive and rising/)
    expect(() => logSweep(10, 10, 10)).toThrow(/positive and rising/)
    expect(() => logSweep(10, 1, 10)).toThrow(/positive and rising/)
  })

  it('is safe on the step measure', () => {
    expect(maxStep([])).toBe(0)
    expect(maxStep([5])).toBe(0)
    expect(maxStep([1, 3, 2])).toBe(2)
  })
})
