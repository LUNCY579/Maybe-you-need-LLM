/**
 * The forward process.
 *
 * The forward (or diffusion) process is fixed: it adds a little Gaussian noise
 * at every step, with no learnable parameters. Its single most important
 * property is that x_t can be sampled in closed form from x_0 alone,
 *
 *   q(x_t | x_0) = N(x_t; √ᾱ_t x_0, (1 − ᾱ_t) I)
 *
 * which is equation 4 of the paper and the reason training is cheap: a single
 * network evaluation per step, with no sequential unrolling.
 *
 * The other property the course leans on is the tractable posterior
 *
 *   q(x_{t−1} | x_t, x_0) = N(x_{t−1}; μ̃_t(x_t, x_0), β̃_t I)
 *
 * (equation 7), because it turns every term of the variational bound into a
 * closed-form comparison between two Gaussians.
 */

import { createRng, gaussian } from '@llm-materials/course-core'
import type { Rng, Vector } from '@llm-materials/course-core'
import type { Schedule } from './schedules.js'

/**
 * Draw x_t from q(x_t | x_0) in closed form.
 *
 * This is the sampling rule of equation 4, and it is what the training loop
 * uses: pick a data point, pick a noise vector, pick a timestep, and you have
 * the input and the target for the network in one step.
 */
export function qSample(x0: Vector, t: number, noise: Vector, schedule: Schedule): Vector {
  const index = clampIndex(t, schedule.steps)
  const signalScale = schedule.sqrtAlphaBar[index]
  const noiseScale = schedule.sqrtOneMinusAlphaBar[index]
  return x0.map((value, i) => signalScale * value + noiseScale * (noise[i] ?? 0))
}

/**
 * Take one forward step: x_{t−1} → x_t.
 *
 * This is the Markov chain of equation 2,
 * q(x_t | x_{t−1}) = N(x_t; √α_t x_{t−1}, β_t I).
 */
export function forwardStep(x: Vector, t: number, schedule: Schedule, rng: Rng): Vector {
  const index = clampIndex(t, schedule.steps)
  const alpha = schedule.alphas[index]
  const beta = schedule.betas[index]
  const scale = Math.sqrt(alpha)
  const noiseScale = Math.sqrt(beta)
  return x.map((value) => scale * value + noiseScale * gaussian(rng))
}

/**
 * Run the full forward chain by stepping, rather than by the closed form.
 *
 * The course uses this to *check* the closed form: the two must agree, because
 * the whole efficiency argument of the paper rests on them being the same
 * distribution.
 */
export function forwardChain(x0: Vector, schedule: Schedule, rng: Rng): Vector[] {
  const chain: Vector[] = [x0.slice()]
  let current = x0.slice()
  for (let t = 0; t < schedule.steps; t++) {
    current = forwardStep(current, t, schedule, rng)
    chain.push(current.slice())
  }
  return chain
}

/** The mean of q(x_t | x_0): √ᾱ_t x_0. */
export function forwardMarginalMean(x0: Vector, t: number, schedule: Schedule): Vector {
  const index = clampIndex(t, schedule.steps)
  const scale = schedule.sqrtAlphaBar[index]
  return x0.map((value) => scale * value)
}

/** The standard deviation of q(x_t | x_0): √(1 − ᾱ_t), per dimension. */
export function forwardMarginalStd(t: number, schedule: Schedule): number {
  const index = clampIndex(t, schedule.steps)
  return schedule.sqrtOneMinusAlphaBar[index]
}

/**
 * The posterior mean μ̃_t(x_t, x_0) of q(x_{t−1} | x_t, x_0).
 *
 * Equation 7 of the paper:
 *
 *   μ̃_t = (√ᾱ_{t−1} β_t / (1 − ᾱ_t)) x_0
 *       + (√α_t (1 − ᾱ_{t−1}) / (1 − ᾱ_t)) x_t
 */
export function posteriorMean(xT: Vector, x0: Vector, t: number, schedule: Schedule): Vector {
  const index = clampIndex(t, schedule.steps)
  const alphaBarPrevious = schedule.previousAlphaBars[index]
  const alphaBar = schedule.alphaBars[index]
  const alpha = schedule.alphas[index]
  const beta = schedule.betas[index]
  const denominator = Math.max(1e-12, 1 - alphaBar)

  const x0Coefficient = (Math.sqrt(alphaBarPrevious) * beta) / denominator
  const xTCoefficient = (Math.sqrt(alpha) * (1 - alphaBarPrevious)) / denominator

  return x0.map((value, i) => x0Coefficient * value + xTCoefficient * (xT[i] ?? 0))
}

/**
 * The posterior variance β̃_t of q(x_{t−1} | x_t, x_0).
 *
 *   β̃_t = (1 − ᾱ_{t−1}) / (1 − ᾱ_t) · β_t
 */
export function posteriorVariance(t: number, schedule: Schedule): number {
  const index = clampIndex(t, schedule.steps)
  const alphaBarPrevious = schedule.previousAlphaBars[index]
  const alphaBar = schedule.alphaBars[index]
  const beta = schedule.betas[index]
  return ((1 - alphaBarPrevious) / Math.max(1e-12, 1 - alphaBar)) * beta
}

/**
 * The signal-to-noise ratio at step t: ᾱ_t / (1 − ᾱ_t).
 */
export function signalToNoise(t: number, schedule: Schedule): number {
  const index = clampIndex(t, schedule.steps)
  return schedule.snrs[index]
}

/**
 * The variance-preserving form of the forward marginal, in the shape the
 * course uses for its figures: mean, standard deviation, and the two scales
 * that appear in the closed form.
 */
export interface ForwardMarginal {
  t: number
  alphaBar: number
  sqrtAlphaBar: number
  sqrtOneMinusAlphaBar: number
  snr: number
  mean: Vector
  std: number
}

export function describeForwardMarginal(x0: Vector, t: number, schedule: Schedule): ForwardMarginal {
  const index = clampIndex(t, schedule.steps)
  return {
    t: index,
    alphaBar: schedule.alphaBars[index],
    sqrtAlphaBar: schedule.sqrtAlphaBar[index],
    sqrtOneMinusAlphaBar: schedule.sqrtOneMinusAlphaBar[index],
    snr: schedule.snrs[index],
    mean: forwardMarginalMean(x0, t, schedule),
    std: forwardMarginalStd(t, schedule),
  }
}

/**
 * The "swap the noise" experiment.
 *
 * Take x_t from a data point, replace the noise with a different draw, and
 * recombine. The result keeps the structure of x_0 and takes the texture of
 * the other sample. It is the cheapest possible demonstration that the model
 * has separated structure from noise, and it is exact: no model is involved.
 */
export function swapNoise(
  x0: Vector,
  noiseA: Vector,
  noiseB: Vector,
  t: number,
  schedule: Schedule,
): { withA: Vector; withB: Vector; hybrid: Vector } {
  const index = clampIndex(t, schedule.steps)
  const signalScale = schedule.sqrtAlphaBar[index]
  const noiseScale = schedule.sqrtOneMinusAlphaBar[index]
  const withA = qSample(x0, index, noiseA, schedule)
  const withB = qSample(x0, index, noiseB, schedule)
  const hybrid = x0.map((value, i) => signalScale * value + noiseScale * ((noiseA[i] ?? 0) + (noiseB[i] ?? 0)) / 2)
  return { withA, withB, hybrid }
}

/** Clamp a timestep into the valid range, reporting what was used. */
export function clampIndex(t: number, steps: number): number {
  if (!Number.isFinite(t)) return 0
  return Math.min(steps - 1, Math.max(0, Math.round(t)))
}

/** A seeded generator, re-exported so laboratories do not import two modules. */
export { createRng }
