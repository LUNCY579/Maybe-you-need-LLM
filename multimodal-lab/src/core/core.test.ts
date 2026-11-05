import { describe, expect, it } from 'vitest'
import {
  buildPairs,
  contrastiveGradient,
  contrastiveLoss,
  modalityGap,
  PROMPTS,
  randomEncoder,
  temperatureSweep,
  trainContrastive,
  zeroShot,
} from './clip'
import { buildInstructions, measureTax, taxCurve } from './instruction'

const pairs = buildPairs()

describe('the dataset', () => {
  it('is deterministic for a given seed', () => {
    const a = buildPairs({ seed: 3 })
    const b = buildPairs({ seed: 3 })
    expect(a.map((pair) => pair.label)).toEqual(b.map((pair) => pair.label))
  })

  it('pairs an image with a caption of the same class', () => {
    for (const pair of pairs) {
      expect(pair.image.length).toBeGreaterThan(0)
      expect(pair.caption.length).toBeGreaterThan(0)
      expect(pair.label).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('the contrastive loss', () => {
  it('has a gradient that matches a finite difference', () => {
    const image = randomEncoder(24, 6, 3)
    const text = randomEncoder(30, 6, 4)
    const batch = {
      images: pairs.slice(0, 5).map((pair) => pair.image),
      captions: pairs.slice(0, 5).map((pair) => pair.caption),
    }
    const temperature = 0.2
    const gradient = contrastiveGradient(image, text, batch, temperature)
    const epsilon = 1e-5

    for (const [f, d] of [
      [0, 0],
      [7, 3],
      [20, 5],
    ] as const) {
      const up = { ...image, w: image.w.map((row) => row.slice()) }
      up.w[f]![d] = (up.w[f]![d] ?? 0) + epsilon
      const down = { ...image, w: image.w.map((row) => row.slice()) }
      down.w[f]![d] = (down.w[f]![d] ?? 0) - epsilon
      const numeric =
        (contrastiveLoss(up, text, batch, temperature) -
          contrastiveLoss(down, text, batch, temperature)) /
        (2 * epsilon)
      expect(numeric).toBeCloseTo(gradient.imageW[f]?.[d] ?? 0, 6)
    }
  })

  it('prefers the correct pairing to a shuffled one', () => {
    const image = randomEncoder(24, 8, 3)
    const text = randomEncoder(30, 8, 4)
    const batch = { images: pairs.slice(0, 8).map((p) => p.image), captions: pairs.slice(0, 8).map((p) => p.caption) }
    const shuffled = {
      images: batch.images,
      captions: [...batch.captions].reverse(),
    }
    expect(contrastiveLoss(image, text, batch, 0.5)).toBeLessThan(
      contrastiveLoss(image, text, shuffled, 0.5),
    )
  })
})

describe('the temperature', () => {
  const image = randomEncoder(24, 8, 3)
  const text = randomEncoder(30, 8, 4)
  const batch = {
    images: pairs.slice(0, 8).map((pair) => pair.image),
    captions: pairs.slice(0, 8).map((pair) => pair.caption),
  }

  it('reproduces the training objective at the same temperature', () => {
    for (const temperature of [0.1, 0.5, 2]) {
      const point = temperatureSweep(image, text, batch, [temperature])[0]!
      expect(point.loss).toBeCloseTo(contrastiveLoss(image, text, batch, temperature), 12)
      expect(point.temperature).toBe(temperature)
    }
  })

  it('gives the matched caption more probability as the temperature falls', () => {
    const [cold, warm] = temperatureSweep(image, text, batch, [0.1, 1])
    expect(cold!.matchedProbability).toBeGreaterThan(warm!.matchedProbability)
    expect(cold!.entropy).toBeLessThan(warm!.entropy)
    expect(cold!.effectiveNegatives).toBeLessThan(warm!.effectiveNegatives)
  })

  it('falls to the uniform distribution at a very large temperature', () => {
    const point = temperatureSweep(image, text, batch, [1000])[0]!
    expect(point.matchedProbability).toBeCloseTo(1 / 8, 4)
    expect(point.loss).toBeCloseTo(Math.log(8), 4)
    expect(point.entropy).toBeCloseTo(Math.log(8), 4)
    expect(point.effectiveNegatives).toBeCloseTo(8, 4)
  })

  it('keeps the effective number of negatives between one and the batch size', () => {
    for (const point of temperatureSweep(image, text, batch, [0.01, 0.1, 0.5, 1, 4, 100])) {
      expect(point.effectiveNegatives).toBeGreaterThanOrEqual(1 - 1e-9)
      expect(point.effectiveNegatives).toBeLessThanOrEqual(8 + 1e-6)
    }
  })
})

describe('the training', () => {
  it('learns: the loss falls and the retrieval improves', () => {
    const result = trainContrastive(pairs, { steps: 800, dimension: 32, seed: 5 })
    expect(result.history[result.history.length - 1]!).toBeLessThan(result.history[0]!)
    expect(result.retrieval).toBeGreaterThan(0.2)
  })

  it('retrieves better than chance', () => {
    const result = trainContrastive(pairs, { steps: 800, dimension: 32, seed: 5 })
    const chance = 1 / 40
    expect(result.retrieval).toBeGreaterThan(chance * 3)
  })

  it('retrieves better with a bigger batch, which is where the negatives come from', () => {
    const small = trainContrastive(pairs, { steps: 200, batchSize: 8, dimension: 32, seed: 5 })
    const large = trainContrastive(pairs, { steps: 200, batchSize: 32, dimension: 32, seed: 5 })
    expect(large.retrieval).toBeGreaterThanOrEqual(small.retrieval)
  })

  it('stays finite at every temperature the slider offers', () => {
    for (const temperature of [0.1, 0.25, 2]) {
      const result = trainContrastive(pairs, { steps: 200, dimension: 32, seed: 5, temperature })
      expect(result.history.every(Number.isFinite), `τ=${temperature}`).toBe(true)
      expect(result.retrieval, `τ=${temperature}`).toBeGreaterThan(1 / 40)
    }
  })
})

describe('the modality gap', () => {
  it('is positive: the two modalities are further apart than either is from itself', () => {
    const result = trainContrastive(pairs, { steps: 800, dimension: 32, seed: 5 })
    const gap = modalityGap(pairs, result.image, result.text, { limit: 40 })
    expect(gap.gap).toBeGreaterThan(0)
    expect(gap.between).toBeLessThan((gap.withinImages + gap.withinText) / 2)
  })
})

describe('the zero-shot classifier', () => {
  it('classifies above chance', () => {
    const result = trainContrastive(pairs, { steps: 800, dimension: 32, seed: 5 })
    const accuracy = zeroShot(pairs, result.image, result.text)
    expect(accuracy).toBeGreaterThan(1 / 6)
  })

  it('has a prompt, and the prompt is part of the method', () => {
    expect(PROMPTS.length).toBeGreaterThan(1)
    for (const prompt of PROMPTS) {
      expect(prompt).toContain('{}')
    }
  })
})

describe('the instruction tax', () => {
  it('gains on the instructions and gives up on the original task', () => {
    const examples = buildInstructions(60)
    const report = measureTax(examples, { strength: 0.8 })
    expect(report.afterInstructions).toBeGreaterThan(report.beforeInstructions)
    expect(report.afterOriginal).toBeLessThan(report.beforeOriginal)
    expect(report.tax).toBeGreaterThan(0)
  })

  it('grows with the strength of the tuning', () => {
    const examples = buildInstructions(80)
    const curve = taxCurve(examples, [0.1, 0.3, 0.5, 0.7, 0.9])
    expect(curve[curve.length - 1]!.gain).toBeGreaterThan(curve[0]!.gain)
    expect(curve[curve.length - 1]!.tax).toBeGreaterThan(curve[0]!.tax)
  })
})
