import { describe, expect, it } from 'vitest'
import { createRng } from '@llm-materials/course-core'
import {
  decode,
  encode,
  generateCorpus,
  tokenizeCorpus,
  trainTokenizer,
  tokenizerEconomics,
} from './tokenizer.js'
import {
  ACCELERATORS,
  arithmeticIntensity,
  attentionKernelIntensity,
  countParameters,
  forwardFlops,
  roofline,
  trainingCost,
  trainingMemory,
  trainingStepFlops,
} from './architecture.js'
import { Tape } from '@llm-materials/course-core'
import { TinyTransformer, generate, trainModel } from './transformer.js'
import type { ModelConfig } from './transformer.js'

describe('the tokeniser', () => {
  const corpus = generateCorpus(40, 200, 5, 30)
  const tokenizer = trainTokenizer(corpus, 300)

  it('learns a vocabulary of the size it was asked for', () => {
    expect(tokenizer.size).toBe(300)
    expect(tokenizer.merges.length).toBe(44)
  })

  it('refuses a vocabulary smaller than the byte alphabet', () => {
    expect(() => trainTokenizer(corpus, 100)).toThrow(RangeError)
  })

  it('compresses the corpus below one byte per token', () => {
    const stats = tokenizeCorpus(tokenizer, corpus)
    expect(stats.tokens).toBeLessThan(stats.bytes)
    expect(stats.bytesPerToken).toBeGreaterThan(1)
  })

  it('round-trips: the decoded bytes are the original bytes', () => {
    const ids = encode(tokenizer, corpus)
    const original = new TextEncoder().encode(corpus)
    const restored = decode(tokenizer, ids)
    expect(Array.from(restored)).toEqual(Array.from(original))
  })

  it('reports the economics of the vocabulary', () => {
    const economics = tokenizerEconomics(tokenizer, corpus, 512)
    expect(economics.embeddingParameters).toBe(300 * 512)
    expect(economics.corpusTokens).toBeLessThan(economics.naiveTokens)
  })
})

describe('the architecture arithmetic', () => {
  const config = {
    contextLength: 1024,
    dModel: 768,
    heads: 12,
    dFf: 3072,
    layers: 12,
    vocabSize: 32000,
  }

  it('counts the parameters', () => {
    const breakdown = countParameters(config)
    // The embedding and the output projection dominate.
    expect(breakdown.embedding).toBe(32000 * 768)
    expect(breakdown.total).toBeGreaterThan(breakdown.embedding)
    expect(breakdown.total).toBe(
      breakdown.embedding +
        breakdown.positional +
        breakdown.attention +
        breakdown.feedForward +
        breakdown.norms +
        breakdown.finalNorm +
        breakdown.output,
    )
  })

  it('ties the output projection to the embedding when asked', () => {
    const tied = countParameters(config, true)
    expect(tied.output).toBe(0)
    expect(tied.total).toBeLessThan(countParameters(config).total)
  })

  it('counts the FLOPs of a forward pass', () => {
    const flops = forwardFlops(config, 1024)
    expect(flops.total).toBeGreaterThan(0)
    // The feed-forward block is the biggest single term at this shape.
    expect(flops.feedForward).toBeGreaterThan(flops.attentionScores)
  })

  it('makes a training step about three forward passes', () => {
    expect(trainingStepFlops(config, 1024)).toBeCloseTo(3 * forwardFlops(config, 1024).total, 6)
  })

  it('accounts for the memory of a training step', () => {
    const memory = trainingMemory(config, 1024)
    expect(memory.parameters).toBeGreaterThan(0)
    expect(memory.gradients).toBe(memory.parameters)
    expect(memory.optimizer).toBe(memory.parameters * 2)
    expect(memory.total).toBe(
      memory.parameters + memory.gradients + memory.optimizer + memory.activations,
    )
  })

  it('finds that the attention kernel is memory bound', () => {
    const line = roofline(config, 1024, ACCELERATORS['a100-40'])
    expect(line.intensity).toBeGreaterThan(0)
    // The whole step can look arithmetic-bound, because the parameter
    // updates dominate its arithmetic. The attention kernel inside it cannot:
    // its intensity is far below the machine's balance point, which is why
    // the kernel has to be tiled.
    expect(line.attentionIntensity).toBeLessThan(line.balancePoint)
    expect(line.attentionBoundBy).toBe('memory')
  })

  it('reports a training cost that grows with the token count', () => {
    const small = trainingCost(config, 1024, 1e9)
    const large = trainingCost(config, 1024, 1e10)
    expect(large.seconds).toBeCloseTo(small.seconds * 10, 3)
    expect(large.flops).toBeGreaterThan(small.flops)
  })

  it('reports an arithmetic intensity that rises with the sequence length', () => {
    // The quadratic attention term grows faster than the linear activation
    // memory, so the *average* intensity of a training step rises with the
    // sequence length — while the attention kernel inside it stays memory
    // bound throughout.
    const short = arithmeticIntensity(config, 256)
    const long = arithmeticIntensity(config, 8192)
    expect(long.intensity).toBeGreaterThan(short.intensity)

    const shortKernel = attentionKernelIntensity(config, 256)
    const longKernel = attentionKernelIntensity(config, 8192)
    expect(longKernel.intensity).toBeCloseTo(shortKernel.intensity, 6)
  })
})

describe('the automatic differentiation engine', () => {
  const config: ModelConfig = {
    vocabSize: 24,
    dModel: 16,
    heads: 2,
    dFf: 32,
    layers: 2,
    contextLength: 16,
  }

  it('matches a central finite difference on every parameter', () => {
    const model = new TinyTransformer(config, 3)
    const tape = new Tape()
    const inputs = [1, 5, 9, 2, 7, 3, 11, 4]
    const targets = [5, 9, 2, 7, 3, 11, 4, 0]

    const forward = () => {
      tape.clear()
      const { loss } = model.forward(tape, inputs, targets)
      return loss!.data[0]!
    }

    // The analytic gradient.
    const lossValue = forward()
    tape.clear()
    const { loss } = model.forward(tape, inputs, targets)
    tape.backward(loss!)
    const analytic = model.gradientVector()

    // The finite difference, on the model's own parameters.
    const epsilon = 1e-5
    const parameters = model.parameterVector()
    let worst = 0
    let worstIndex = -1

    for (let i = 0; i < parameters.length; i++) {
      const original = parameters[i]!
      model.setParameterVector(replaceAt(parameters, i, original + epsilon))
      const up = forward()
      model.setParameterVector(replaceAt(parameters, i, original - epsilon))
      const down = forward()
      model.setParameterVector(parameters)
      const numerical = (up - down) / (2 * epsilon)
      const error = Math.abs(numerical - analytic[i]!)
      if (error > worst) {
        worst = error
        worstIndex = i
      }
    }

    expect(worst, `the worst error was at parameter ${worstIndex}`).toBeLessThan(1e-5)
    expect(lossValue).toBeGreaterThan(0)
  })

  it('produces a loss that is finite and positive', () => {
    const model = new TinyTransformer(config, 4)
    const tape = new Tape()
    const { loss } = model.forward(tape, [1, 2, 3], [2, 3, 4])
    expect(Number.isFinite(loss!.data[0]!)).toBe(true)
    expect(loss!.data[0]!).toBeGreaterThan(0)
  })

  it('counts its parameters', () => {
    const model = new TinyTransformer(config, 4)
    expect(model.parameterCount).toBe(model.parameterVector().length)
    expect(model.parameterCount).toBeGreaterThan(0)
  })
})

describe('training', () => {
  it('reduces the loss and reports a validation number', () => {
    const corpus = generateCorpus(120, 400, 11, 20)
    const tokenizer = trainTokenizer(corpus, 320)
    const tokens = encode(tokenizer, corpus)

    const config: ModelConfig = {
      vocabSize: tokenizer.size,
      dModel: 32,
      heads: 4,
      dFf: 64,
      layers: 2,
      contextLength: 32,
    }

    const result = trainModel(config, tokens, {
      steps: 60,
      batchSize: 4,
      learningRate: 3e-3,
      sequenceLength: 16,
      seed: 2,
    })

    expect(result.history.length).toBe(60)
    const first = result.history[0]!.loss
    const last = result.history[result.history.length - 1]!.loss
    expect(last).toBeLessThan(first)
    expect(Number.isFinite(result.validationLoss)).toBe(true)
    expect(result.validationPerplexity).toBeGreaterThan(0)
  }, 60000)

  it('generates a continuation of the right length', () => {
    const corpus = generateCorpus(30, 200, 5, 20)
    const tokenizer = trainTokenizer(corpus, 300)
    const tokens = encode(tokenizer, corpus)
    const config: ModelConfig = {
      vocabSize: tokenizer.size,
      dModel: 16,
      heads: 2,
      dFf: 32,
      layers: 1,
      contextLength: 16,
    }
    const model = new TinyTransformer(config, 1)
    const continuation = generate(model, tokens.slice(0, 4), 10, 1, 3)
    expect(continuation.length).toBe(14)
    for (const id of continuation) {
      expect(id).toBeGreaterThanOrEqual(0)
      expect(id).toBeLessThan(tokenizer.size)
    }
  })
})

describe('the seeded stream', () => {
  it('replays exactly', () => {
    const a = createRng(11)
    const b = createRng(11)
    expect([a(), a()]).toEqual([b(), b()])
  })
})

/** A copy of an array with one element replaced. */
function replaceAt(values: number[], index: number, replacement: number): number[] {
  const copy = values.slice()
  copy[index] = replacement
  return copy
}
