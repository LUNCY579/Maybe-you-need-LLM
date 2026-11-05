/**
 * Noise schedules.
 *
 * The forward process of a diffusion model is fixed by a sequence of variance
 * parameters β₁ … β_T. Almost everything else — the closed form for x_t, the
 * posterior the reverse process is trained against, the signal-to-noise ratio
 * at each step — is derived from that sequence.
 *
 * Two schedules appear in the course:
 *
 * - The **linear** schedule of Ho, Jain & Abbeel (2020, §4): β grows linearly
 *   from 10⁻⁴ to 0.02 over T = 1000 steps.
 * - The **cosine** schedule of Nichol & Dhariwal (2021): ᾱ_t follows a
 *   cosine window, which keeps the signal-to-noise ratio from collapsing too
 *   early.
 */

export type ScheduleName = 'linear' | 'cosine'

export interface Schedule {
  name: ScheduleName
  /** Number of diffusion steps T. */
  steps: number
  /** β_t for t = 1 … T. */
  betas: number[]
  /** α_t = 1 − β_t. */
  alphas: number[]
  /** ᾱ_t = ∏ α_s. */
  alphaBars: number[]
  /** ᾱ_{t−1}, with ᾱ_0 = 1 so that index 0 is a valid "before any noise" step. */
  previousAlphaBars: number[]
  /** Signal-to-noise ratio ᾱ_t / (1 − ᾱ_t) at each step. */
  snrs: number[]
  /** 1 / √(1 − ᾱ_t), the scale that appears in the posterior mean. */
  inverseSqrtOneMinusAlphaBar: number[]
  /** √(1 − ᾱ_t). */
  sqrtOneMinusAlphaBar: number[]
  /** √ᾱ_t. */
  sqrtAlphaBar: number[]
  /** A human-readable note about where this schedule comes from. */
  note: string
}

/** The schedule used in the original paper: β linear from 1e-4 to 0.02. */
export const DDPM_BETA_START = 1e-4
export const DDPM_BETA_END = 0.02

/**
 * Build a schedule.
 *
 * The linear schedule follows the paper exactly: β_i = linspace(1e-4, 0.02, T).
 * The cosine schedule fixes ᾱ_t = f(t)/f(0) with
 * f(t) = cos²(((t/T) + s) / (1 + s) · π/2) and s = 0.008, and recovers
 * β_t = 1 − ᾱ_t / ᾱ_{t−1}.
 */
export function buildSchedule(name: ScheduleName, steps: number): Schedule {
  if (steps < 2) throw new RangeError(`buildSchedule: need at least two steps, received ${steps}`)

  const betas: number[] = []
  const alphas: number[] = []
  const alphaBars: number[] = []

  if (name === 'linear') {
    for (let i = 0; i < steps; i++) {
      const fraction = i / (steps - 1)
      betas.push(DDPM_BETA_START + fraction * (DDPM_BETA_END - DDPM_BETA_START))
    }
  } else {
    const s = 0.008
    const f = (t: number) => Math.cos(((t / steps + s) / (1 + s)) * (Math.PI / 2)) ** 2
    const f0 = f(0)
    for (let i = 0; i < steps; i++) {
      const alphaBar = f(i + 1) / f0
      const previous = i === 0 ? 1 : f(i) / f0
      betas.push(Math.min(0.999, Math.max(1e-8, 1 - alphaBar / previous)))
    }
  }

  let running = 1
  for (const beta of betas) {
    const alpha = 1 - beta
    alphas.push(alpha)
    running *= alpha
    alphaBars.push(running)
  }

  const previousAlphaBars = [1, ...alphaBars.slice(0, -1)]

  const snrs = alphaBars.map((a) => a / Math.max(1e-12, 1 - a))
  const sqrtAlphaBar = alphaBars.map(Math.sqrt)
  const sqrtOneMinusAlphaBar = alphaBars.map((a) => Math.sqrt(Math.max(0, 1 - a)))
  const inverseSqrtOneMinusAlphaBar = sqrtOneMinusAlphaBar.map((s) => 1 / Math.max(1e-12, s))

  return {
    name,
    steps,
    betas,
    alphas,
    alphaBars,
    previousAlphaBars,
    snrs,
    sqrtAlphaBar,
    sqrtOneMinusAlphaBar,
    inverseSqrtOneMinusAlphaBar,
    note:
      name === 'linear'
        ? 'Ho, Jain & Abbeel (2020), §4: β grows linearly from 1e-4 to 0.02 over T = 1000 steps.'
        : 'Nichol & Dhariwal (2021): ᾱ follows a cosine window, so the signal-to-noise ratio falls more slowly at first.',
  }
}

/**
 * The number of steps at which the signal-to-noise ratio crosses one.
 *
 * Below this step the sample is still mostly signal; above it, it is mostly
 * noise. The "effective" diffusion length is usually quoted as the step where
 * ᾱ_t falls below 0.5, which is where the marginal is closer to the prior
 * than to the data.
 */
export function effectiveDiffusionLength(schedule: Schedule): number {
  for (let t = 0; t < schedule.steps; t++) {
    if (schedule.alphaBars[t] < 0.5) return t + 1
  }
  return schedule.steps
}

/**
 * The KL divergence between q(x_T | x_0) and the standard normal prior, in
 * nats per dimension, for a unit-variance data point.
 *
 *   D_KL(N(√ᾱ_T x_0, (1−ᾱ_T)I) ‖ N(0, I)) = −½ ln(1−ᾱ_T)
 *
 * The paper quotes this for the linear schedule as roughly 10⁻⁵ bits per
 * dimension, which is the statement that x_T is essentially pure noise.
 */
export function terminalKLDivergence(schedule: Schedule): number {
  const alphaBar = schedule.alphaBars[schedule.steps - 1]
  return -0.5 * Math.log(Math.max(1e-300, 1 - alphaBar))
}
