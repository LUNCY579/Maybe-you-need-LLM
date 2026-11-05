/**
 * The resampler.
 *
 * Flamingo reads a variable-length sequence of visual tokens — a variable number
 * of images, each at a variable resolution — into a fixed number of vectors, so
 * that the language model see the same sized prefix every time. The mechanism is
 * a Perceiver-style cross-attention: a fixed set of learned latents attends to
 * the visual tokens and returns one vector per latent.
 *
 * This is a toy of that mechanism: the latents and the tokens are seeded
 * vectors, and the attention is computed exactly rather than learned. What the
 * toy shows is the property the method is built on, and it is a property of the
 * shapes rather than of the weights: the output has one vector per latent
 * whatever the number of tokens, so the visual token count is bounded by the
 * latents and not by the image.
 */

import { createRng } from '@llm-materials/course-core'

export interface ResamplerOptions {
  /** The learned latents. This is the bound on the output length. */
  latents?: number
  /** The visual tokens the frozen encoder produced. */
  tokens?: number
  /** The width of every vector in the resampler. */
  width?: number
  /** How sharply a latent chooses among the tokens. */
  temperature?: number
  seed?: number
}

const DEFAULTS: Required<ResamplerOptions> = {
  latents: 32,
  tokens: 256,
  width: 64,
  temperature: 0.2,
  seed: 13,
}

function resolved(options: ResamplerOptions): Required<ResamplerOptions> {
  return { ...DEFAULTS, ...options }
}

function vectors(rows: number, width: number, seed: number): number[][] {
  const rng = createRng(seed)
  return Array.from({ length: rows }, () => Array.from({ length: width }, () => rng() * 2 - 1))
}

/** How many tokens a vision transformer produces for one square image. */
export function visualTokenCount(resolution: number, patchSize = 14): number {
  if (resolution <= 0 || patchSize <= 0) {
    throw new RangeError(
      `visualTokenCount: resolution and patch size must be positive, received ${resolution} and ${patchSize}`,
    )
  }
  const grid = Math.max(1, Math.floor(resolution / patchSize))
  return grid * grid
}

/** The visual tokens the frozen encoder is taken to produce. */
export function visualTokens(options: ResamplerOptions = {}): number[][] {
  const { tokens, width, seed } = resolved(options)
  return vectors(tokens, width, seed)
}

/** The fixed set of latents that do the reading. */
export function latentVectors(options: ResamplerOptions = {}): number[][] {
  const { latents, width, seed } = resolved(options)
  return vectors(latents, width, seed + 1)
}

/**
 * The cross-attention of the latents on the tokens: latents × tokens, with each
 * latent's row a softmax over the tokens, scaled by 1/√width as in a transformer.
 */
export function resamplerAttention(options: ResamplerOptions = {}): number[][] {
  const { latents, tokens, width, temperature, seed } = resolved(options)
  const keys = visualTokens({ tokens, width, seed })
  const queries = latentVectors({ latents, width, seed })
  const scale = 1 / Math.sqrt(Math.max(width, 1))
  const tau = Math.max(temperature, 1e-6)

  return queries.map((query) => {
    const scores = keys.map((key) => {
      let dot = 0
      for (let index = 0; index < width; index++) dot += (query[index] ?? 0) * (key[index] ?? 0)
      return (dot * scale) / tau
    })
    const maximum = Math.max(...scores)
    const exponentials = scores.map((score) => Math.exp(score - maximum))
    const total = exponentials.reduce((sum, value) => sum + value, 0)
    return exponentials.map((value) => value / total)
  })
}

/**
 * The resampler's output: one vector per latent, each a convex combination of
 * the visual tokens. The value matrix is the token matrix itself, which is the
 * one simplification the toy makes; a real resampler has learned values.
 */
export function resamplerOutput(options: ResamplerOptions = {}): number[][] {
  const { tokens, width, seed } = resolved(options)
  const attention = resamplerAttention(options)
  const values = visualTokens({ tokens, width, seed })
  return attention.map((row) => {
    const out = new Array<number>(width).fill(0)
    for (let token = 0; token < row.length; token++) {
      const weight = row[token] ?? 0
      if (weight === 0) continue
      const value = values[token]!
      for (let index = 0; index < width; index++) {
        out[index] = (out[index] ?? 0) + weight * (value[index] ?? 0)
      }
    }
    return out
  })
}

export interface TokenBound {
  /** The visual tokens the encoder produced. */
  inputTokens: number
  /** The vectors the language model receives: one per latent. */
  outputTokens: number
  /** How many input tokens each output vector stands for. */
  compression: number
}

/** The bound: the output length is the number of latents, whatever came in. */
export function tokenBound(options: ResamplerOptions = {}): TokenBound {
  const { latents, tokens } = resolved(options)
  return {
    inputTokens: tokens,
    outputTokens: latents,
    compression: latents === 0 ? 0 : tokens / latents,
  }
}

export interface ResolutionPoint {
  resolution: number
  patchSize: number
  /** Tokens per side of the patch grid. */
  grid: number
  visualTokens: number
  resampledTokens: number
  compression: number
}

/**
 * The same latent count against a sequence of image resolutions.
 *
 * The visual token count grows with the square of the resolution; the resampled
 * count does not move. That is the whole of the bound, and it is visible in one
 * table.
 */
export function resolutionSweep(
  latents = DEFAULTS.latents,
  resolutions: number[] = [224, 448, 896, 1792],
  patchSize = 14,
): ResolutionPoint[] {
  return resolutions.map((resolution) => {
    const tokens = visualTokenCount(resolution, patchSize)
    const bound = tokenBound({ latents, tokens })
    return {
      resolution,
      patchSize,
      grid: Math.max(1, Math.floor(resolution / patchSize)),
      visualTokens: tokens,
      resampledTokens: bound.outputTokens,
      compression: bound.compression,
    }
  })
}

export interface AttentionCost {
  /** Multiply-adds in the cross-attention: latents × tokens × width. */
  crossAttention: number
  /** Multiply-adds if the language model attended to every token instead: tokens² × width. */
  tokenSelfAttention: number
  /** The cross-attention against the alternative. */
  ratio: number
}

/**
 * What the bound is worth, in multiply-adds.
 *
 * The resampler's cost is linear in the visual tokens, because each latent
 * touches every token once. Attention over the raw tokens would be quadratic,
 * because every token would touch every other. With fewer latents than tokens
 * the resampler is the cheaper path, and the ratio is exactly latents/tokens.
 */
export function attentionCost(tokens: number, latents: number, width: number): AttentionCost {
  if (tokens < 0 || latents < 0 || width < 0) {
    throw new RangeError(`attentionCost: the sizes must not be negative, received ${tokens}, ${latents}, ${width}`)
  }
  const crossAttention = latents * tokens * width
  const tokenSelfAttention = tokens * tokens * width
  return {
    crossAttention,
    tokenSelfAttention,
    ratio: tokenSelfAttention === 0 ? 0 : crossAttention / tokenSelfAttention,
  }
}

export interface ResamplerReport {
  /** The token the latent attends to most. */
  topToken: number
  /** Its weight. */
  topWeight: number
  /** How many tokens hold more than twice the uniform share. */
  aboveChance: number
  /** The entropy of the attention, in nats. */
  entropy: number
  /** The most the entropy could be, log of the number of tokens. */
  maximumEntropy: number
}

/** What one latent does with the visual tokens. */
export function resamplerReport(weights: number[]): ResamplerReport {
  if (weights.length === 0) {
    return { topToken: -1, topWeight: 0, aboveChance: 0, entropy: 0, maximumEntropy: 0 }
  }
  let topToken = 0
  let topWeight = weights[0] ?? 0
  for (let index = 1; index < weights.length; index++) {
    if ((weights[index] ?? 0) > topWeight) {
      topToken = index
      topWeight = weights[index] ?? 0
    }
  }
  const uniform = 1 / weights.length
  const aboveChance = weights.filter((weight) => weight > 2 * uniform).length
  let entropy = 0
  for (const weight of weights) if (weight > 0) entropy -= weight * Math.log(weight)
  return {
    topToken,
    topWeight,
    aboveChance,
    entropy,
    maximumEntropy: Math.log(weights.length),
  }
}
