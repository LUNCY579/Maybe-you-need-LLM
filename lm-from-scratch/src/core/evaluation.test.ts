import { describe, expect, it } from 'vitest'
import { evaluateModel, logProbability } from './evaluation.js'
import { splitTokens, TinyTransformer } from './transformer.js'
import type { ModelConfig } from './transformer.js'

const config: ModelConfig = {
  vocabSize: 20,
  dModel: 8,
  heads: 2,
  dFf: 16,
  layers: 1,
  contextLength: 8,
}

describe('the evaluation harness', () => {
  it('scores held-out windows and reports the chance rate', () => {
    const model = new TinyTransformer(config, 3)
    const tokens = Array.from({ length: 200 }, (_, index) => (index * 7) % config.vocabSize)
    const report = evaluateModel(model, tokens, { sequenceLength: 8, windows: 4, start: 0 })

    expect(report.windows).toBe(4)
    expect(report.tokens).toBe(32)
    expect(report.chance).toBeCloseTo(1 / config.vocabSize, 10)
    expect(report.loss).toBeGreaterThan(0)
    expect(report.perplexity).toBeCloseTo(Math.exp(report.loss), 8)
    expect(report.top5).toBeGreaterThanOrEqual(report.top1)
    expect(report.top1).toBeGreaterThanOrEqual(0)
    expect(report.top5).toBeLessThanOrEqual(1)
    expect(report.standardError).toBeGreaterThanOrEqual(0)
  })

  it('starts at the same hold-out boundary the training run uses', () => {
    const split = splitTokens(200, 8)
    expect(split.validationStart).toBe(172)
    expect(split.validationSize).toBe(19)

    const model = new TinyTransformer(config, 3)
    const tokens = Array.from({ length: 200 }, (_, index) => index % config.vocabSize)
    const report = evaluateModel(model, tokens, { sequenceLength: 8 })
    expect(report.windows).toBe(3)
    expect(report.tokens).toBe(24)
  })

  it('computes a log-probability from the logits', () => {
    expect(logProbability([0, 0], 0)).toBeCloseTo(-Math.log(2), 10)
    expect(logProbability([Math.log(3), 0], 0)).toBeCloseTo(-Math.log(4 / 3), 10)
  })
})
