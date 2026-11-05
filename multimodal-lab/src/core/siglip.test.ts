import { describe, expect, it } from 'vitest'
import {
  PAPER_BIAS,
  PAPER_SCALE,
  appendUnrelatedPair,
  balancedBias,
  buildLogits,
  couplingReport,
  couplingSweep,
  sigmoidLoss,
  sigmoidPairLoss,
  sigmoidProbabilities,
  softmaxLoss,
  softmaxProbabilities,
  softmaxRowLoss,
  softplus,
} from './siglip'

const sigma = (value: number) => 1 / (1 + Math.exp(-value))

describe('the softplus', () => {
  it('is log 2 at zero', () => {
    expect(softplus(0)).toBeCloseTo(Math.log(2), 12)
  })

  it('agrees with the naive definition on ordinary values', () => {
    for (const value of [-3, -0.5, 0.5, 3]) {
      expect(softplus(value)).toBeCloseTo(Math.log1p(Math.exp(value)), 12)
    }
  })

  it('does not overflow where the naive definition would', () => {
    expect(Number.isFinite(softplus(1000))).toBe(true)
    expect(softplus(1000)).toBeCloseTo(1000, 9)
  })
})

describe('the softmax loss', () => {
  it('is log B when every score is equal', () => {
    const size = 6
    const logits = Array.from({ length: size }, () => Array.from({ length: size }, () => 0))
    expect(softmaxRowLoss(logits, 0, 1)).toBeCloseTo(Math.log(size), 12)
    expect(softmaxLoss(logits, 1)).toBeCloseTo(Math.log(size), 12)
  })

  it('falls as the correct pair is given a margin', () => {
    const small = buildLogits({ size: 8, margin: 0.1, noise: 0 })
    const large = buildLogits({ size: 8, margin: 0.8, noise: 0 })
    expect(softmaxLoss(large)).toBeLessThan(softmaxLoss(small))
  })

  it('grows with the batch even when the correct pair is untouched', () => {
    const losses = [4, 8, 16].map((size) => softmaxRowLoss(buildLogits({ size, margin: 0.4, noise: 0 }), 0))
    expect(losses[1]).toBeGreaterThan(losses[0]!)
    expect(losses[2]).toBeGreaterThan(losses[1]!)
  })
})

describe('the sigmoid loss', () => {
  it('is log 2 for a pair at zero logit with no bias', () => {
    expect(sigmoidPairLoss(0, 1, { bias: 0, scale: 1 })).toBeCloseTo(Math.log(2), 12)
    expect(sigmoidPairLoss(0, -1, { bias: 0, scale: 1 })).toBeCloseTo(Math.log(2), 12)
  })

  it('is a mirror image of itself with the label changed', () => {
    const positive = sigmoidPairLoss(0.3, 1, { bias: 0, scale: 10 })
    const mirrored = sigmoidPairLoss(-0.3, -1, { bias: 0, scale: 10 })
    expect(positive).toBeCloseTo(mirrored, 12)
  })

  it('sums to the softplus identity for a positive and a negative at the same logit', () => {
    const a = 3
    const positive = sigmoidPairLoss(0.3, 1, { bias: 0, scale: 10 })
    const negative = sigmoidPairLoss(0.3, -1, { bias: 0, scale: 10 })
    expect(positive + negative).toBeCloseTo(a + 2 * Math.log1p(Math.exp(-a)), 12)
  })

  it('falls for the positive pair and rises for the negative as the margin grows', () => {
    expect(sigmoidPairLoss(0.8, 1, { bias: 0, scale: 10 })).toBeLessThan(sigmoidPairLoss(0.4, 1, { bias: 0, scale: 10 }))
    expect(sigmoidPairLoss(0.8, -1, { bias: 0, scale: 10 })).toBeGreaterThan(sigmoidPairLoss(0.4, -1, { bias: 0, scale: 10 }))
  })

  it('uses the paper’s initialisation unless told otherwise', () => {
    const pairLoss = sigmoidPairLoss(0.5, 1)
    const explicit = softplus(-(PAPER_SCALE * 0.5 + PAPER_BIAS))
    expect(pairLoss).toBeCloseTo(explicit, 12)
    expect(PAPER_BIAS).toBe(-10)
    expect(PAPER_SCALE).toBe(10)
  })

  it('averages over every pair in the batch', () => {
    const logits = [
      [1, 0],
      [0, 1],
    ]
    const manual =
      (sigmoidPairLoss(1, 1) + sigmoidPairLoss(0, -1) + sigmoidPairLoss(0, -1) + sigmoidPairLoss(1, 1)) / 4
    expect(sigmoidLoss(logits)).toBeCloseTo(manual, 12)
  })

  it('reduces to log 2 when the bias is zero and every logit is zero', () => {
    const logits = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0))
    expect(sigmoidLoss(logits, { bias: 0, scale: 1 })).toBeCloseTo(Math.log(2), 12)
  })
})

describe('the balanced bias', () => {
  it('makes the sigmoid at zero logit equal the fraction of positives in the batch', () => {
    for (const size of [2, 4, 8, 32]) {
      const bias = balancedBias(size)
      expect(sigma(bias)).toBeCloseTo(1 / size, 12)
    }
  })

  it('is minus log of the negatives per positive', () => {
    expect(balancedBias(8)).toBeCloseTo(-Math.log(7), 12)
    expect(balancedBias(1)).toBeCloseTo(0, 12)
  })

  it('matches the numbers quoted in the laboratory', () => {
    expect(balancedBias(8)).toBeCloseTo(-1.946, 3)
    expect(balancedBias(32768)).toBeCloseTo(-10.397, 3)
    expect(Math.round(Math.exp(10)) + 1).toBe(22027)
    expect(balancedBias(22027)).toBeCloseTo(-10, 3)
  })
})

describe('the logits', () => {
  it('are deterministic in the seed', () => {
    expect(buildLogits({ size: 6, seed: 11 })).toEqual(buildLogits({ size: 6, seed: 11 }))
    expect(buildLogits({ size: 6, seed: 11 })).not.toEqual(buildLogits({ size: 6, seed: 12 }))
  })

  it('puts the matched pairs above the unmatched ones on average', () => {
    const size = 12
    const logits = buildLogits({ size, margin: 0.4, noise: 0.05, seed: 21 })
    let diagonal = 0
    let off = 0
    let offCount = 0
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (i === j) diagonal += logits[i]![j]!
        else {
          off += logits[i]![j]!
          offCount += 1
        }
      }
    }
    expect(diagonal / size).toBeGreaterThan(off / offCount)
  })
})

describe('the coupling experiment', () => {
  const logits = buildLogits({ size: 8, margin: 0.4, noise: 0.05, seed: 4 })

  it('does not touch the old pairs', () => {
    const augmented = appendUnrelatedPair(logits)
    expect(augmented.length).toBe(logits.length + 1)
    for (let i = 0; i < logits.length; i++) {
      expect(augmented[i]!.slice(0, logits.length)).toEqual(logits[i])
      expect(augmented[i]!.length).toBe(logits.length + 1)
    }
    expect(augmented[logits.length]!.length).toBe(logits.length + 1)
  })

  it('leaves the sigmoid loss of an untouched pair exactly unchanged', () => {
    const report = couplingReport(logits)
    expect(report.sigmoidPairAfter).toBe(report.sigmoidPairBefore)
  })

  it('raises the softmax loss of a row whose pair did not change', () => {
    const report = couplingReport(logits)
    expect(report.softmaxRowAfter).toBeGreaterThan(report.softmaxRowBefore)
  })

  it('has the softmax row loss equal a fresh computation on the augmented batch', () => {
    const report = couplingReport(logits)
    const augmented = appendUnrelatedPair(logits)
    expect(report.softmaxRowAfter).toBeCloseTo(softmaxRowLoss(augmented, 0, 0.1), 12)
    expect(report.softmaxMeanAfter).toBeCloseTo(softmaxLoss(augmented, 0.1), 12)
    expect(report.sigmoidMeanAfter).toBeCloseTo(sigmoidLoss(augmented), 12)
  })

  it('shows the coupling is a property of the softmax and not of the numbers', () => {
    const report = couplingReport(logits)
    const softmaxShift = report.softmaxRowAfter - report.softmaxRowBefore
    const sigmoidShift = Math.abs(report.sigmoidPairAfter - report.sigmoidPairBefore)
    expect(softmaxShift).toBeGreaterThan(0)
    expect(sigmoidShift).toBe(0)
  })
})

describe('the two readings of a row', () => {
  const logits = buildLogits({ size: 8, margin: 0.4, noise: 0.05, seed: 4 })
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

  it('normalises the softmax row to one', () => {
    expect(sum(softmaxProbabilities(logits, 0, 0.1))).toBeCloseTo(1, 12)
  })

  it('does not normalise the sigmoid row', () => {
    const row = sigmoidProbabilities(logits, 0, { scale: 10, bias: 0 })
    const expected = (logits[0] ?? []).map((value) => 1 / (1 + Math.exp(-10 * value)))
    expect(row).toEqual(expected)
    expect(sum(row)).toBeGreaterThan(1)
  })

  it('gives the correct pair the same sigmoid probability whatever the batch', () => {
    const small = sigmoidProbabilities(buildLogits({ size: 4, margin: 0.4, noise: 0.05, seed: 4 }), 0)
    const large = sigmoidProbabilities(buildLogits({ size: 16, margin: 0.4, noise: 0.05, seed: 4 }), 0)
    expect(small[0]).toBe(large[0])
  })

  it('dilutes the correct pair’s softmax probability as the batch grows', () => {
    const small = softmaxProbabilities(buildLogits({ size: 4, margin: 0.4, noise: 0.05, seed: 4 }), 0, 0.1)
    const large = softmaxProbabilities(buildLogits({ size: 16, margin: 0.4, noise: 0.05, seed: 4 }), 0, 0.1)
    expect(large[0]).toBeLessThan(small[0]!)
  })
})

describe('the coupling sweep', () => {
  const logits = buildLogits({ size: 8, margin: 0.4, noise: 0.05, seed: 4 })

  it('starts at the un-augmented batch', () => {
    const sweep = couplingSweep(logits, 4)
    expect(sweep[0]?.extra).toBe(0)
    expect(sweep[0]?.sigmoidPair).toBeCloseTo(sigmoidPairLoss(logits[0]?.[0] ?? 0, 1), 12)
    expect(sweep[0]?.softmaxRow).toBeCloseTo(softmaxRowLoss(logits, 0, 0.1), 12)
  })

  it('holds the sigmoid pair loss exactly constant', () => {
    const sweep = couplingSweep(logits, 6)
    for (const point of sweep) expect(point.sigmoidPair).toBe(sweep[0]!.sigmoidPair)
  })

  it('raises the softmax row loss at every extra pair', () => {
    const sweep = couplingSweep(logits, 6)
    for (let index = 1; index < sweep.length; index++) {
      expect(sweep[index]!.softmaxRow).toBeGreaterThan(sweep[index - 1]!.softmaxRow)
    }
  })
})
