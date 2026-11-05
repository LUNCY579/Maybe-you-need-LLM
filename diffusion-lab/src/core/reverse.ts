/**
 * The reverse process and its samplers.
 *
 * The reverse process is a Markov chain of learned Gaussians
 *
 *   p_θ(x_{t−1} | x_t) = N(x_{t−1}; μ_θ(x_t, t), σ_t² I)
 *
 * whose mean is parameterised through a network ε_θ that predicts the noise
 * that was added (equation 11):
 *
 *   μ_θ(x_t, t) = (1/√α_t) (x_t − (β_t / √(1 − ᾱ_t)) ε_θ(x_t, t))
 *
 * This module implements that parameterisation, the two other standard
 * parameterisations (predict x_0, and the velocity v), the ancestral sampler of
 * Algorithm 2, and the DDIM sampler, which turns the reverse chain into a
 * deterministic ODE.
 */

import { createRng, gaussian } from '@llm-materials/course-core'
import type { Rng, Vector } from '@llm-materials/course-core'
import { clampIndex } from './forward.js'
import type { Schedule } from './schedules.js'

/** How the network's output is interpreted. */
export type Parameterisation = 'epsilon' | 'x0' | 'v'

/** The choice of the reverse-process standard deviation. */
export type VarianceChoice = 'beta' | 'posterior'

export interface ReverseConfig {
  schedule: Schedule
  parameterisation: Parameterisation
  /** Whether σ_t² is β_t or β̃_t. Both were reported to work in the paper. */
  variance: VarianceChoice
  /** The dimensionality of the data, so the sampler can draw x_T. */
  dimension: number
}

/** The reverse-process standard deviation σ_t for the chosen parameterisation. */
export function reverseStd(t: number, schedule: Schedule, choice: VarianceChoice): number {
  const index = clampIndex(t, schedule.steps)
  if (choice === 'beta') return Math.sqrt(schedule.betas[index])
  const alphaBarPrevious = schedule.previousAlphaBars[index]
  const alphaBar = schedule.alphaBars[index]
  const beta = schedule.betas[index]
  return Math.sqrt(((1 - alphaBarPrevious) / Math.max(1e-12, 1 - alphaBar)) * beta)
}

/**
 * Convert whatever the network predicts into the predicted noise ε.
 *
 * This is the step that makes the three parameterisations interchangeable.
 */
export function toEpsilon(
  prediction: Vector,
  xT: Vector,
  t: number,
  schedule: Schedule,
  parameterisation: Parameterisation,
): Vector {
  const index = clampIndex(t, schedule.steps)
  const sqrtAlphaBar = schedule.sqrtAlphaBar[index]
  const sqrtOneMinus = schedule.sqrtOneMinusAlphaBar[index]

  if (parameterisation === 'epsilon') return prediction.slice()

  if (parameterisation === 'x0') {
    // x_t = √ᾱ_t x_0 + √(1−ᾱ_t) ε  ⟹  ε = (x_t − √ᾱ_t x_0) / √(1−ᾱ_t)
    return xT.map((value, i) => (value - sqrtAlphaBar * (prediction[i] ?? 0)) / Math.max(1e-12, sqrtOneMinus))
  }

  // v = √ᾱ_t ε − √(1−ᾱ_t) x_0  ⟹  ε = √(1−ᾱ_t) x_t + √ᾱ_t v
  return xT.map((value, i) => sqrtOneMinus * value + sqrtAlphaBar * (prediction[i] ?? 0))
}

/**
 * The predicted clean sample, from whatever the network predicts.
 *
 * Equation 15 of the paper:
 *
 *   x̂_0 = (x_t − √(1 − ᾱ_t) ε_θ(x_t)) / √ᾱ_t
 */
export function toX0(
  prediction: Vector,
  xT: Vector,
  t: number,
  schedule: Schedule,
  parameterisation: Parameterisation,
): Vector {
  const index = clampIndex(t, schedule.steps)
  if (parameterisation === 'x0') return prediction.slice()
  const epsilon = toEpsilon(prediction, xT, index, schedule, parameterisation)
  const sqrtAlphaBar = schedule.sqrtAlphaBar[index]
  return xT.map((value, i) => (value - schedule.sqrtOneMinusAlphaBar[index] * epsilon[i]) / Math.max(1e-12, sqrtAlphaBar))
}

/** The reverse-process mean μ_θ(x_t, t) for the ε parameterisation. */
export function reverseMean(
  epsilon: Vector,
  xT: Vector,
  t: number,
  schedule: Schedule,
): Vector {
  const index = clampIndex(t, schedule.steps)
  const alpha = schedule.alphas[index]
  const beta = schedule.betas[index]
  const coefficient = beta / Math.max(1e-12, schedule.sqrtOneMinusAlphaBar[index])
  const scale = 1 / Math.sqrt(alpha)
  return xT.map((value, i) => scale * (value - coefficient * (epsilon[i] ?? 0)))
}

export interface StepResult {
  /** The state before the step. */
  xT: Vector
  /** The state after the step. */
  xPrevious: Vector
  /** The network's prediction at this step, in the model's own parameterisation. */
  prediction: Vector
  /** The prediction converted to a noise estimate. */
  epsilon: Vector
  /** The prediction converted to a clean-sample estimate. */
  x0: Vector
  /** The mean the reverse process moved to, before the noise was added. */
  mean: Vector
  /** The noise actually added, so it can be shown. */
  noise: Vector
}

/**
 * One ancestral step, following Algorithm 2 of the paper.
 *
 * `prediction` is whatever the network output; it is converted to ε and then
 * to the reverse mean, so the same routine serves all three parameterisations.
 */
export function ancestralStep(
  xT: Vector,
  t: number,
  prediction: Vector,
  config: ReverseConfig,
  rng: Rng,
  addNoise = true,
): StepResult {
  const { schedule, parameterisation, variance } = config
  const index = clampIndex(t, schedule.steps)
  const epsilon = toEpsilon(prediction, xT, index, schedule, parameterisation)
  const x0 = toX0(prediction, xT, index, schedule, parameterisation)
  const mean = reverseMean(epsilon, xT, index, schedule)
  const sigma = reverseStd(index, schedule, variance)

  const noise: Vector = mean.map(() => (addNoise && index > 0 ? gaussian(rng) : 0))
  const xPrevious = mean.map((value, i) => value + sigma * noise[i])

  return { xT: xT.slice(), xPrevious, prediction: prediction.slice(), epsilon, x0, mean, noise }
}

/**
 * One DDIM step.
 *
 * DDIM (Song, Meng & Ermon, 2021) rewrites the reverse chain so that the
 * marginals q_σ(x_t | x_0) are deterministic given x_0, which turns sampling
 * into an ODE that can be jumped over. η = 0 gives the fully deterministic
 * sampler; η = 1 recovers the ancestral sampler.
 */
export function ddimStep(
  xT: Vector,
  t: number,
  prediction: Vector,
  config: ReverseConfig,
  rng: Rng,
  eta = 0,
): StepResult {
  const { schedule, parameterisation } = config
  const index = clampIndex(t, schedule.steps)
  const epsilon = toEpsilon(prediction, xT, index, schedule, parameterisation)
  const x0 = toX0(prediction, xT, index, schedule, parameterisation)

  const alphaBar = schedule.alphaBars[index]
  const alphaBarPrevious = schedule.previousAlphaBars[index]
  const sigma =
    eta === 0
      ? 0
      : eta * Math.sqrt((1 - alphaBarPrevious) / Math.max(1e-12, 1 - alphaBar)) *
        Math.sqrt(Math.max(0, 1 - alphaBar / Math.max(1e-12, alphaBarPrevious)))

  const direction = Math.sqrt(Math.max(0, 1 - alphaBarPrevious - sigma * sigma))
  const noise: Vector = x0.map(() => (sigma > 0 ? gaussian(rng) : 0))

  const xPrevious = x0.map(
    (value, i) => Math.sqrt(alphaBarPrevious) * value + direction * epsilon[i] + sigma * noise[i],
  )

  return { xT: xT.slice(), xPrevious, prediction: prediction.slice(), epsilon, x0, mean: xPrevious.slice(), noise }
}

export interface SamplerTrace {
  /** Every state, from x_T to x_0 inclusive. */
  states: Vector[]
  /** The network's prediction at each step. */
  predictions: Vector[]
  /** The clean-sample estimate at each step. */
  x0Estimates: Vector[]
  /** The timestep each transition came from. */
  steps: number[]
}

/**
 * Run a full sampling chain.
 *
 * `denoise` is the network: it receives the current state and the timestep and
 * returns its prediction. Passing the same seed twice gives the same chain,
 * which is what makes the laboratory reproducible.
 */
export function sample(
  denoise: (x: Vector, t: number) => Vector,
  config: ReverseConfig,
  seed = 0,
  options: { eta?: number; ddim?: boolean; start?: Vector; steps?: number } = {},
): SamplerTrace {
  const { schedule } = config
  const rng = createRng(seed)
  const eta = options.eta ?? 0
  const useDdim = options.ddim ?? false
  const stride = options.steps && options.steps < schedule.steps ? Math.max(1, Math.floor(schedule.steps / options.steps)) : 1

  let current: Vector = options.start
    ? options.start.slice()
    : Array.from({ length: config.dimension }, () => gaussian(rng))

  const states: Vector[] = [current.slice()]
  const predictions: Vector[] = []
  const x0Estimates: Vector[] = []
  const steps: number[] = []

  for (let t = schedule.steps - 1; t >= 0; t -= stride) {
    const prediction = denoise(current, t)
    const result = useDdim
      ? ddimStep(current, t, prediction, config, rng, eta)
      : ancestralStep(current, t, prediction, config, rng, true)
    predictions.push(result.prediction)
    x0Estimates.push(result.x0)
    steps.push(t)
    current = result.xPrevious
    states.push(current.slice())
  }

  return { states, predictions, x0Estimates, steps }
}

/**
 * The number of network evaluations a sampler costs.
 *
 * This is the arithmetic behind "diffusion models are slow to sample" and the
 * reason every later paper in this area is about taking fewer steps.
 */
export function networkEvaluations(schedule: Schedule, requestedSteps: number): number {
  if (requestedSteps >= schedule.steps) return schedule.steps
  return Math.max(1, Math.floor(schedule.steps / Math.max(1, Math.floor(schedule.steps / requestedSteps))))
}
