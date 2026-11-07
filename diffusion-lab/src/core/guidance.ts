/**
 * Guidance: steering a generative model with a condition.
 *
 * Classifier-free guidance (Ho & Salimans, 2022) interpolates between the
 * unconditional score and the conditional one:
 *
 *   s_guided(x, c) = s_uncond(x) + w · (s_cond(x, c) − s_uncond(x))
 *
 * The laboratory uses a toy model whose score is known in closed form — a
 * Gaussian mixture — so the guidance scale can be swept and the trade-off
 * between fidelity to the condition and diversity of the samples measured
 * exactly, with no network in the loop.
 */

import { createRng, gaussian } from '@llm-materials/course-core'
import type { Vector } from '@llm-materials/course-core'

export interface GaussianMixture {
  /** One mean per component. */
  means: Vector[]
  /** One weight per component; they are normalised to sum to one. */
  weights: number[]
  /** The standard deviation of every component, per dimension. */
  sigma: number
  /** The dimensionality. */
  dimension: number
}

/** Build a mixture from component means with uniform weights. */
export function buildMixture(means: Vector[], sigma: number): GaussianMixture {
  return {
    means,
    weights: means.map(() => 1 / means.length),
    sigma,
    dimension: means[0]?.length ?? 1,
  }
}

/** The log density of one Gaussian component. */
export function logComponentDensity(x: Vector, mean: Vector, sigma: number): number {
  let total = 0
  for (let i = 0; i < x.length; i++) {
    const z = (x[i] - (mean[i] ?? 0)) / sigma
    total += -0.5 * z * z - Math.log(sigma) - 0.5 * Math.log(2 * Math.PI)
  }
  return total
}

/** The log density of the mixture. */
export function logMixtureDensity(x: Vector, mixture: GaussianMixture): number {
  const logs = mixture.means.map((mean, i) => Math.log(mixture.weights[i]) + logComponentDensity(x, mean, mixture.sigma))
  const max = Math.max(...logs)
  return max + Math.log(logs.reduce((acc, l) => acc + Math.exp(l - max), 0))
}

/** The exact score ∇_x log p(x) of the mixture. */
export function mixtureScore(x: Vector, mixture: GaussianMixture): Vector {
  const density = logMixtureDensity(x, mixture)
  const score: Vector = new Array<number>(x.length).fill(0)
  for (let c = 0; c < mixture.means.length; c++) {
    const mean = mixture.means[c]
    const weight = mixture.weights[c]
    const logComponent = Math.log(weight) + logComponentDensity(x, mean, mixture.sigma)
    const posterior = Math.exp(logComponent - density)
    for (let i = 0; i < x.length; i++) {
      score[i] += (posterior * (mean[i] - (x[i] ?? 0))) / (mixture.sigma * mixture.sigma)
    }
  }
  return score
}

/** The exact score of a single Gaussian component: (μ − x) / σ². */
export function componentScore(x: Vector, mean: Vector, sigma: number): Vector {
  return x.map((value, i) => (mean[i] - value) / (sigma * sigma))
}

/** The exact posterior p(c | x) over the mixture's components. */
export function classPosterior(x: Vector, mixture: GaussianMixture): number[] {
  const logs = mixture.means.map((mean, i) => Math.log(mixture.weights[i]) + logComponentDensity(x, mean, mixture.sigma))
  const max = Math.max(...logs)
  const sum = logs.reduce((acc, l) => acc + Math.exp(l - max), 0)
  return logs.map((l) => Math.exp(l - max) / sum)
}

/**
 * The guided score.
 *
 * With `w = 0` this is the unconditional score, and with `w = 1` it is the
 * conditional score. Values above one extrapolate further along the
 * conditional direction, which is what produces both the sharper samples and
 * the loss of diversity.
 */
export function guidedScore(
  x: Vector,
  condition: number,
  weight: number,
  mixture: GaussianMixture,
): Vector {
  const unconditional = mixtureScore(x, mixture)
  const conditional = componentScore(x, mixture.means[condition], mixture.sigma)
  return unconditional.map((value, i) => value + weight * ((conditional[i] ?? 0) - value))
}

export interface LangevinOptions {
  /** Step size. */
  stepSize: number
  /** Number of steps. */
  steps: number
  seed: number
}

export interface LangevinResult {
  /** The final sample. */
  sample: Vector
  /** The score at every step, for plotting. */
  scoreHistory: Vector[]
  /** The position at every step, for plotting. */
  positionHistory: Vector[]
}

/**
 * Langevin dynamics under the guided score, at a fixed step size.
 *
 * This is the sampler a diffusion model uses when it is written as a
 * score-based model, and it is what makes the guidance laboratory honest: the
 * score is exact, and the sampler is the same kind of sampler a real diffusion
 * model uses. A real sampler anneals the step size across noise levels; this
 * one runs at a single noise level, so the step size is constant.
 */
export function guidedLangevin(
  start: Vector,
  condition: number,
  weight: number,
  mixture: GaussianMixture,
  options: LangevinOptions,
): LangevinResult {
  const rng = createRng(options.seed)
  let x = start.slice()
  const scoreHistory: Vector[] = []
  const positionHistory: Vector[] = [x.slice()]

  for (let step = 0; step < options.steps; step++) {
    const score = guidedScore(x, condition, weight, mixture)
    scoreHistory.push(score.slice())
    const noise: Vector = x.map(() => gaussian(rng))
    x = x.map(
      (value, i) => value + options.stepSize * (score[i] ?? 0) + Math.sqrt(2 * options.stepSize) * noise[i],
    )
    positionHistory.push(x.slice())
  }

  return { sample: x, scoreHistory, positionHistory }
}

export interface GuidanceMeasurement {
  /** Mean distance from a sample to the mean of the class it was asked for. */
  fidelity: number
  /** Mean distance between samples generated for the same class. */
  diversity: number
  /** The mean posterior probability of the requested class across samples. */
  classAccuracy: number
  /** The samples themselves. */
  samples: Vector[]
}

/**
 * Measure the fidelity/diversity trade-off of a guidance weight.
 *
 * Fidelity measures how close the samples land to the class they were asked
 * for. Diversity measures how spread out the samples for one class are. The
 * classic result is that raising the guidance weight improves the first and
 * degrades the second.
 */
export function measureGuidance(
  mixture: GaussianMixture,
  condition: number,
  weight: number,
  options: { samples: number; stepSize: number; steps: number; seed: number },
): GuidanceMeasurement {
  const rng = createRng(options.seed)
  const samples: Vector[] = []
  const distances: number[] = []
  const accuracies: number[] = []

  for (let i = 0; i < options.samples; i++) {
    const start: Vector = Array.from({ length: mixture.dimension }, () => gaussian(rng))
    const result = guidedLangevin(start, condition, weight, mixture, {
      stepSize: options.stepSize,
      steps: options.steps,
      seed: options.seed + i * 977,
    })
    samples.push(result.sample)

    const target = mixture.means[condition]
    let squared = 0
    for (let d = 0; d < target.length; d++) {
      squared += (result.sample[d] - target[d]) ** 2
    }
    distances.push(Math.sqrt(squared))
    accuracies.push(classPosterior(result.sample, mixture)[condition])
  }

  let diversity = 0
  let pairs = 0
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      let squared = 0
      for (let d = 0; d < samples[i].length; d++) {
        squared += (samples[i][d] - samples[j][d]) ** 2
      }
      diversity += Math.sqrt(squared)
      pairs++
    }
  }

  return {
    fidelity: distances.reduce((a, b) => a + b, 0) / Math.max(1, distances.length),
    diversity: pairs === 0 ? 0 : diversity / pairs,
    classAccuracy: accuracies.reduce((a, b) => a + b, 0) / Math.max(1, accuracies.length),
    samples,
  }
}

/**
 * The score of the guided model is the score of a tilted distribution.
 *
 * The guided distribution is p(x) ∝ p(x) · p(c | x)^w, which is a tilted
 * mixture whose weights are the class posteriors raised to the power w. This
 * function returns those effective weights, and is how the laboratory shows
 * that guidance *sharpens* the mixture rather than moving it.
 */
export function tiltedWeights(x: Vector, mixture: GaussianMixture, weight: number): number[] {
  const posterior = classPosterior(x, mixture)
  return posterior.map((p) => p ** weight)
}
