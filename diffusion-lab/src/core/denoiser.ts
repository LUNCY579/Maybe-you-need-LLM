/**
 * A diffusion model that is actually trained, at toy scale.
 *
 * The reverse process of a diffusion model is a network ε_θ(x_t, t) that
 * predicts the noise added to the data. This module builds that network, trains
 * it on a toy distribution with the simplified objective of equation 14 of the
 * paper, and hands back a model whose samples can be inspected.
 *
 * Nothing here is a stand-in: the loss curve comes from real gradient steps,
 * the samples come from the ancestral sampler, and the reported numbers are
 * measured from the samples that were drawn.
 */

import { createRng, gaussian, l2Distance, mean } from '@llm-materials/course-core'
import type { Rng, Vector } from '@llm-materials/course-core'
import { Adam, Mlp } from './mlp.js'
import { qSample } from './forward.js'
import type { Schedule } from './schedules.js'

/**
 * The sinusoidal time embedding of the Transformer, used by the paper to tell
 * the network which noise level it is being asked about.
 */
export function sinusoidalTimeEmbedding(t: number, dimension: number): Vector {
  const half = Math.floor(dimension / 2)
  const embedding: Vector = new Array<number>(dimension).fill(0)
  for (let i = 0; i < half; i++) {
    const frequency = 1 / 10000 ** (i / Math.max(1, half))
    embedding[i] = Math.sin(t * frequency)
    embedding[i + half] = Math.cos(t * frequency)
  }
  return embedding
}

/** A toy data distribution: a ring of Gaussian modes. */
export function ringMixture(
  rng: Rng,
  count: number,
  modes = 8,
  radius = 2,
  width = 0.18,
): Vector[] {
  const points: Vector[] = []
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / modes + gaussian(rng) * width * 2
    const radial = radius + gaussian(rng) * width
    points.push([Math.cos(angle) * radial, Math.sin(angle) * radial])
  }
  return points
}

/** A toy data distribution: two well-separated Gaussians. */
export function twoGaussians(rng: Rng, count: number, separation = 3, width = 0.25): Vector[] {
  const points: Vector[] = []
  for (let i = 0; i < count; i++) {
    const centre = i % 2 === 0 ? -separation / 2 : separation / 2
    points.push([centre + gaussian(rng) * width, gaussian(rng) * width])
  }
  return points
}

export interface DenoiserOptions {
  /** The dimensionality of the data. */
  dimension: number
  /** Hidden layer sizes. */
  hiddenSizes: number[]
  /** The size of the sinusoidal time embedding. */
  timeEmbeddingDimension: number
  schedule: Schedule
  seed: number
}

export class Denoiser {
  readonly network: Mlp
  readonly options: DenoiserOptions

  constructor(options: DenoiserOptions) {
    this.options = options
    this.network = new Mlp({
      inputSize: options.dimension + options.timeEmbeddingDimension,
      hiddenSizes: options.hiddenSizes,
      outputSize: options.dimension,
      seed: options.seed,
    })
  }

  /** The network's prediction of the noise in x_t, given the timestep. */
  predict(xT: Vector, t: number): Vector {
    const embedding = sinusoidalTimeEmbedding(t, this.options.timeEmbeddingDimension)
    const input = [...xT, ...embedding]
    return this.network.forward(input).output
  }

  /** A copy of the model, for snapshotting. */
  clone(): Denoiser {
    const copy = Object.create(Denoiser.prototype) as Denoiser
    ;(copy as unknown as { options: DenoiserOptions }).options = this.options
    ;(copy as unknown as { network: Mlp }).network = this.network.clone()
    return copy
  }
}

export interface TrainingOptions {
  /** How many gradient steps to take. */
  steps?: number
  /** How many data points per step. */
  batchSize?: number
  learningRate?: number
  /** Every how many steps to record the loss. */
  recordEvery?: number
  /** The data to train on. If omitted, a ring mixture is generated. */
  data?: Vector[]
}

export interface TrainingResult {
  denoiser: Denoiser
  /** The recorded loss history. */
  losses: { step: number; loss: number }[]
  /** The data the model was trained on. */
  data: Vector[]
  /** The final loss. */
  finalLoss: number
}

/**
 * Train a denoiser with the simplified objective.
 *
 * L_simple(θ) = E_{t, x_0, ε} [ ‖ε − ε_θ(√ᾱ_t x_0 + √(1−ᾱ_t) ε, t)‖² ]
 *
 * (equation 14). One step is one batch: draw data, draw a timestep each, draw
 * noise, form x_t, and take a gradient step on the squared error.
 */
export function trainDenoiser(options: DenoiserOptions, training: TrainingOptions = {}): TrainingResult {
  const steps = training.steps ?? 1500
  const batchSize = training.batchSize ?? 64
  const learningRate = training.learningRate ?? 2e-3
  const recordEvery = training.recordEvery ?? 25

  const rng = createRng(options.seed + 7919)
  const data = training.data ?? ringMixture(rng, 512, 8)

  const denoiser = new Denoiser(options)
  const parameters = denoiser.network.parameters
  const optimiser = new Adam(parameters, learningRate)

  const losses: { step: number; loss: number }[] = []
  let lastLoss = Number.POSITIVE_INFINITY

  for (let step = 0; step < steps; step++) {
    // A flat gradient buffer, laid out exactly like the parameter vector.
    const flat: number[] = new Array<number>(parameters.length).fill(0)
    let lossSum = 0

    for (let b = 0; b < batchSize; b++) {
      const x0 = data[Math.floor(rng() * data.length)]
      const t = Math.floor(rng() * options.schedule.steps)
      const noise: Vector = Array.from({ length: options.dimension }, () => gaussian(rng))
      const xT = qSample(x0, t, noise, options.schedule)

      const embedding = sinusoidalTimeEmbedding(t, options.timeEmbeddingDimension)
      const input = [...xT, ...embedding]
      const { output, cache } = denoiser.network.forward(input)

      const dOutput = output.map((value, i) => (2 * (value - (noise[i] ?? 0))) / batchSize)
      lossSum += output.reduce((acc, value, i) => acc + (value - (noise[i] ?? 0)) ** 2, 0) / batchSize

      const layerGradients = denoiser.network.backward(cache, dOutput)
      let index = 0
      for (const layer of layerGradients) {
        for (const value of layer.weights) flat[index++] += value
        for (const value of layer.bias) flat[index++] += value
      }
    }

    optimiser.update(flat)
    lastLoss = lossSum

    if (step % recordEvery === 0 || step === steps - 1) {
      losses.push({ step, loss: lossSum })
    }
  }

  return { denoiser, losses, data, finalLoss: lastLoss }
}

/**
 * Measure how far a set of samples is from the nearest training point.
 *
 * A cheap, honest quality measure for a toy model: a good sampler lands on
 * the data manifold, so the distance to the nearest training example should be
 * comparable to the spread of the data itself.
 */
export function nearestNeighbourDistance(samples: Vector[], reference: Vector[]): number[] {
  return samples.map((sample) => {
    let best = Number.POSITIVE_INFINITY
    for (const point of reference) {
      const d = l2Distance(sample, point)
      if (d < best) best = d
    }
    return best
  })
}

/**
 * The mean nearest-neighbour distance, which the laboratory reports as the
 * sample-quality number.
 */
export function meanNearestNeighbourDistance(samples: Vector[], reference: Vector[]): number {
  const distances = nearestNeighbourDistance(samples, reference)
  return mean(distances)
}

/**
 * The spread of the data itself, for comparison with the sample spread.
 */
export function meanPairwiseDistance(points: Vector[]): number {
  if (points.length < 2) return 0
  let total = 0
  let count = 0
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      total += l2Distance(points[i], points[j])
      count++
    }
  }
  return count === 0 ? 0 : total / count
}
