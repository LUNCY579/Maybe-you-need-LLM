/**
 * The EDM preconditioning, and the two clocks a diffusion model can run on.
 *
 * Karras et al. (2022) changed the variable of the diffusion process from the
 * integer timestep t to the noise level σ, and wrote the network's input and
 * output scalings as functions of σ. The four coefficients below are the whole
 * of that change:
 *
 *   c_skip(σ) = σ_data² / (σ² + σ_data²)
 *   c_out(σ)  = σ · σ_data / √(σ² + σ_data²)
 *   c_in(σ)   = 1 / √(σ² + σ_data²)
 *   c_noise(σ) = ln(σ) / 4
 *
 * and the denoiser is D(x; σ) = c_skip(σ)·x + c_out(σ)·F(c_in(σ)·x; c_noise(σ)).
 * The point of the coefficients is that the network F sees an input and emits
 * an output of roughly unit scale at every noise level, which is what makes one
 * network trainable across the whole range from almost-clean to almost-noise.
 *
 * The sampling schedule is geometric in σ^(1/ρ) rather than linear in t:
 *
 *   σ_i = (σ_max^(1/ρ) + i/(N−1) · (σ_min^(1/ρ) − σ_max^(1/ρ)))^ρ
 *
 * The laboratory computes all of this exactly and demonstrates it on a toy
 * model with a known answer: data concentrated at a point μ, observed as
 * x = μ + σ·ε. The optimal denoiser is then μ itself, so the preconditioned
 * network can be written in closed form and the sampler's error is measurable.
 */

import type { Vector } from '@llm-materials/course-core'
import type { Schedule } from './schedules.js'

export interface EdmConfig {
  /** The standard deviation of the data. */
  sigmaData: number
  /** The smallest noise level the sampler visits. */
  sigmaMin: number
  /** The largest noise level the sampler visits. */
  sigmaMax: number
  /** The schedule's curvature; 7 in the paper. */
  rho: number
  /** How many noise levels the sampler uses. */
  steps: number
}

/** The paper's defaults for CIFAR-10. */
export const EDM_DEFAULTS: EdmConfig = {
  sigmaData: 0.5,
  sigmaMin: 0.002,
  sigmaMax: 80,
  rho: 7,
  steps: 32,
}

/** The noise distribution used to draw training noise levels: ln σ ~ N(P_mean, P_std²). */
export const EDM_TRAINING = {
  pMean: -1.2,
  pStd: 1.2,
} as const

export interface Preconditioning {
  cSkip: number
  cOut: number
  cIn: number
  cNoise: number
}

/**
 * The four functions of equation 7.
 *
 * `sigma` must be positive: the noise level is the clock, and a zero clock is
 * the data itself, where the coefficients are defined but the score is not.
 */
export function preconditioning(sigma: number, sigmaData = EDM_DEFAULTS.sigmaData): Preconditioning {
  if (!(sigma > 0)) throw new RangeError(`preconditioning: sigma must be positive, received ${sigma}`)
  if (!(sigmaData > 0)) throw new RangeError(`preconditioning: sigmaData must be positive, received ${sigmaData}`)
  const variance = sigma * sigma
  const dataVariance = sigmaData * sigmaData
  const denominator = Math.sqrt(variance + dataVariance)
  return {
    cSkip: dataVariance / (variance + dataVariance),
    cOut: (sigma * sigmaData) / denominator,
    cIn: 1 / denominator,
    cNoise: Math.log(sigma) / 4,
  }
}

/** The denoiser, from the network's raw output and the preconditioning. */
export function denoise(
  x: Vector,
  modelOutput: Vector,
  sigma: number,
  sigmaData = EDM_DEFAULTS.sigmaData,
): Vector {
  const { cSkip, cOut } = preconditioning(sigma, sigmaData)
  return x.map((value, i) => cSkip * value + cOut * (modelOutput[i] ?? 0))
}

/** The score, from the denoised estimate: (x − D(x;σ)) / σ². */
export function scoreFromDenoised(x: Vector, denoised: Vector, sigma: number): Vector {
  return x.map((value, i) => (value - (denoised[i] ?? 0)) / (sigma * sigma))
}

/** The EDM loss weight: (σ² + σ_data²) / (σ·σ_data)². */
export function edmLossWeight(sigma: number, sigmaData = EDM_DEFAULTS.sigmaData): number {
  if (!(sigma > 0)) throw new RangeError(`edmLossWeight: sigma must be positive, received ${sigma}`)
  return (sigma * sigma + sigmaData * sigmaData) / (sigma * sigma * sigmaData * sigmaData)
}

/** The signal-to-noise ratio of a noise level: σ_data² / σ². */
export function sigmaSignalToNoise(sigma: number, sigmaData = EDM_DEFAULTS.sigmaData): number {
  if (!(sigma > 0)) throw new RangeError(`sigmaSignalToNoise: sigma must be positive, received ${sigma}`)
  return (sigmaData * sigmaData) / (sigma * sigma)
}

/**
 * The noise levels of the sampler, largest first.
 *
 * This is the paper's equation 5: a geometric ladder in σ^(1/ρ), so the steps
 * are fine near σ_min where the sample is almost clean, and coarse near σ_max
 * where it is almost noise.
 */
export function karrasSigmas(config: EdmConfig = EDM_DEFAULTS): number[] {
  const { sigmaMin, sigmaMax, rho, steps } = config
  if (steps < 2) throw new RangeError(`karrasSigmas: need at least two steps, received ${steps}`)
  if (!(sigmaMin > 0 && sigmaMax > sigmaMin)) {
    throw new RangeError('karrasSigmas: need 0 < sigmaMin < sigmaMax')
  }
  const lowest = sigmaMin ** (1 / rho)
  const highest = sigmaMax ** (1 / rho)
  return Array.from({ length: steps }, (_, i) => (highest + (i / (steps - 1)) * (lowest - highest)) ** rho)
}

/** One Euler step of the probability-flow ODE, from σ to σ_next. */
export function eulerStep(x: Vector, denoised: Vector, sigma: number, sigmaNext: number): Vector {
  const scale = (sigmaNext - sigma) / sigma
  return x.map((value, i) => value + scale * (value - (denoised[i] ?? 0)))
}

/**
 * One Heun step: an Euler prediction, then the average of the two derivatives.
 *
 * For the analytic toy model the two derivatives are equal, so Heun and Euler
 * agree exactly — which is a useful check that the arithmetic is right.
 */
export function heunStep(
  x: Vector,
  denoised: Vector,
  denoisedAtNext: Vector,
  sigma: number,
  sigmaNext: number,
): Vector {
  const slope = x.map((value, i) => (value - (denoised[i] ?? 0)) / sigma)
  const predicted = x.map((value, i) => value + (sigmaNext - sigma) * (slope[i] ?? 0))
  const nextSlope = predicted.map((value, i) => (value - (denoisedAtNext[i] ?? 0)) / sigmaNext)
  return x.map(
    (value, i) => value + ((sigmaNext - sigma) / 2) * ((slope[i] ?? 0) + (nextSlope[i] ?? 0)),
  )
}

/**
 * The network output of the analytic toy model.
 *
 * The data is concentrated at `target`, so the optimal denoiser is `target` at
 * every noise level, and the raw output is the value F that makes the
 * preconditioned denoiser equal it.
 */
export function analyticDenoiserOutput(
  x: Vector,
  sigma: number,
  target: Vector,
  sigmaData = EDM_DEFAULTS.sigmaData,
): Vector {
  const { cSkip, cOut } = preconditioning(sigma, sigmaData)
  return target.map((value, i) => (value - cSkip * (x[i] ?? 0)) / cOut)
}

export interface SampleStep {
  step: number
  sigma: number
  x: Vector
  /** The Euclidean distance from the current state to the target. */
  distance: number
}

/**
 * Run the deterministic sampler on the analytic model.
 *
 * The state starts at `start`, and each step is Euler's. The target is the
 * exact answer, so the distance at the end is the sampler's error, not the
 * model's.
 */
export function analyticSample(
  start: Vector,
  target: Vector,
  config: EdmConfig = EDM_DEFAULTS,
): SampleStep[] {
  const sigmas = karrasSigmas(config)
  const distanceTo = (x: Vector) =>
    Math.sqrt(x.reduce((total, value, i) => total + (value - (target[i] ?? 0)) ** 2, 0))

  let x = start.slice()
  const steps: SampleStep[] = [{ step: 0, sigma: sigmas[0]!, x: x.slice(), distance: distanceTo(x) }]
  for (let i = 0; i < sigmas.length - 1; i++) {
    const sigma = sigmas[i]!
    const sigmaNext = sigmas[i + 1]!
    const output = analyticDenoiserOutput(x, sigma, target, config.sigmaData)
    const denoised = denoise(x, output, sigma, config.sigmaData)
    x = eulerStep(x, denoised, sigma, sigmaNext)
    steps.push({ step: i + 1, sigma: sigmaNext, x: x.slice(), distance: distanceTo(x) })
  }
  return steps
}

/**
 * The σ a DDPM timestep corresponds to.
 *
 * In the DDPM parametrisation the marginal is √ᾱ_t·x_0 + √(1−ᾱ_t)·ε, so the
 * noise level is σ_t = σ_data·√((1−ᾱ_t)/ᾱ_t). This maps an index of the
 * schedule to that σ, which is how the two clocks are compared.
 */
export function timestepToSigma(t: number, schedule: Schedule, sigmaData = EDM_DEFAULTS.sigmaData): number {
  const index = Math.max(0, Math.min(schedule.steps - 1, Math.round(t)))
  const alphaBar = Math.max(1e-12, schedule.alphaBars[index]!)
  return sigmaData * Math.sqrt((1 - alphaBar) / alphaBar)
}

/**
 * The continuous timestep whose σ is closest to a given noise level.
 *
 * The schedule's ᾱ_t is monotone, so the index can be found by a scan and the
 * answer interpolated between the two neighbouring steps.
 */
export function sigmaToTimestep(sigma: number, schedule: Schedule, sigmaData = EDM_DEFAULTS.sigmaData): number {
  const sigmas = schedule.alphaBars.map((_, index) => timestepToSigma(index, schedule, sigmaData))
  if (sigma <= sigmas[0]!) return 0
  for (let index = 1; index < sigmas.length; index++) {
    const previous = sigmas[index - 1]!
    const current = sigmas[index]!
    if (sigma <= current) {
      const span = current - previous
      const fraction = span === 0 ? 0 : (sigma - previous) / span
      return index - 1 + fraction
    }
  }
  return schedule.steps - 1
}
