import { describe, expect, it } from 'vitest'
import { buildSchedule } from './schedules.js'
import {
  EDM_DEFAULTS,
  analyticDenoiserOutput,
  analyticSample,
  denoise,
  edmLossWeight,
  eulerStep,
  heunStep,
  karrasSigmas,
  preconditioning,
  scoreFromDenoised,
  sigmaSignalToNoise,
  sigmaToTimestep,
  timestepToSigma,
} from './preconditioning.js'

const target = [1.2, -0.4]

describe('the preconditioning functions', () => {
  it('normalises the network input and keeps the skip connection in scale', () => {
    for (const sigma of [0.002, 0.05, 0.5, 5, 80]) {
      const { cSkip, cOut, cIn, cNoise } = preconditioning(sigma, 0.5)
      expect(cIn ** 2 * (sigma ** 2 + 0.25)).toBeCloseTo(1, 12)
      expect(cSkip ** 2 * (sigma ** 2 + 0.25) + cOut ** 2).toBeCloseTo(0.25, 12)
      expect(cNoise).toBeCloseTo(Math.log(sigma) / 4, 12)
    }
  })

  it('tends to the identity skip at low noise and to pure scaling at high noise', () => {
    const clean = preconditioning(0.001, 0.5)
    const noisy = preconditioning(80, 0.5)
    expect(clean.cSkip).toBeCloseTo(1, 3)
    expect(clean.cOut).toBeCloseTo(0.001, 6)
    expect(noisy.cSkip).toBeCloseTo(0, 4)
    expect(noisy.cOut).toBeCloseTo(0.5, 3)
  })

  it('rejects a non-positive noise level', () => {
    expect(() => preconditioning(0)).toThrow(RangeError)
    expect(() => edmLossWeight(-1)).toThrow(RangeError)
    expect(() => sigmaSignalToNoise(0)).toThrow(RangeError)
  })

  it('weights the loss so the effective error is normalised', () => {
    expect(edmLossWeight(0.5, 0.5)).toBeCloseTo(8, 12)
    for (const sigma of [0.01, 0.5, 4]) {
      expect(edmLossWeight(sigma, 0.5) * sigma ** 2).toBeCloseTo(1 + sigma ** 2 / 0.25, 12)
    }
  })

  it('reports a signal-to-noise ratio that falls as the noise rises', () => {
    expect(sigmaSignalToNoise(0.5, 0.5)).toBeCloseTo(1, 12)
    expect(sigmaSignalToNoise(5, 0.5)).toBeCloseTo(0.01, 12)
  })
})

describe('the Karras noise ladder', () => {
  it('runs from sigma_max to sigma_min, largest first', () => {
    const sigmas = karrasSigmas(EDM_DEFAULTS)
    expect(sigmas).toHaveLength(EDM_DEFAULTS.steps)
    expect(sigmas[0]).toBeCloseTo(EDM_DEFAULTS.sigmaMax, 9)
    expect(sigmas[sigmas.length - 1]).toBeCloseTo(EDM_DEFAULTS.sigmaMin, 12)
    for (let i = 1; i < sigmas.length; i++) {
      expect(sigmas[i]!).toBeLessThan(sigmas[i - 1]!)
    }
  })

  it('rejects an impossible range', () => {
    expect(() => karrasSigmas({ ...EDM_DEFAULTS, steps: 1 })).toThrow(RangeError)
    expect(() => karrasSigmas({ ...EDM_DEFAULTS, sigmaMin: 100 })).toThrow(RangeError)
  })
})

describe('the analytic denoiser and the sampler', () => {
  it('recovers the target from its own network output at every noise level', () => {
    const x = [3, -2]
    for (const sigma of [0.01, 0.5, 8, 80]) {
      const output = analyticDenoiserOutput(x, sigma, target, 0.5)
      const recovered = denoise(x, output, sigma, 0.5)
      expect(recovered[0]).toBeCloseTo(target[0]!, 10)
      expect(recovered[1]).toBeCloseTo(target[1]!, 10)
    }
  })

  it('computes the score from the denoised estimate', () => {
    const x = [2, 1]
    const denoised = [1, -0.4]
    const score = scoreFromDenoised(x, denoised, 2)
    expect(score[0]).toBeCloseTo(0.25, 12)
    expect(score[1]).toBeCloseTo(0.35, 12)
  })

  it("makes the Euler sampler's error the ratio of the extreme noise levels", () => {
    const start = [4, -3]
    const steps = analyticSample(start, target, EDM_DEFAULTS)
    const first = steps[0]!
    const last = steps[steps.length - 1]!
    expect(last.distance).toBeLessThan(first.distance)
    // With a constant denoiser every step multiplies the error by σ_next/σ.
    expect(last.distance / first.distance).toBeCloseTo(EDM_DEFAULTS.sigmaMin / EDM_DEFAULTS.sigmaMax, 6)
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.distance).toBeLessThanOrEqual(steps[i - 1]!.distance + 1e-12)
    }
  })

  it('agrees with Euler when the second derivative is the same', () => {
    const sigma = 4
    const sigmaNext = 1
    const x = [2, -1]
    const denoised = analyticDenoiserOutput(x, sigma, target, 0.5)
    const denoisedNext = analyticDenoiserOutput(x, sigmaNext, target, 0.5)
    const euler = eulerStep(x, denoise(x, denoised, sigma, 0.5), sigma, sigmaNext)
    const heun = heunStep(x, denoise(x, denoised, sigma, 0.5), denoise(x, denoisedNext, sigmaNext, 0.5), sigma, sigmaNext)
    expect(heun[0]).toBeCloseTo(euler[0]!, 10)
    expect(heun[1]).toBeCloseTo(euler[1]!, 10)
  })
})

describe('the two clocks', () => {
  const schedule = buildSchedule('linear', 200)

  it('turns the timestep into a rising noise level', () => {
    const early = timestepToSigma(20, schedule, 0.5)
    const late = timestepToSigma(180, schedule, 0.5)
    expect(early).toBeLessThan(late)
    expect(early).toBeGreaterThan(0)
  })

  it('round-trips between the timestep and the noise level', () => {
    for (const t of [10, 100, 190]) {
      const sigma = timestepToSigma(t, schedule, 0.5)
      expect(sigmaToTimestep(sigma, schedule, 0.5)).toBeCloseTo(t, 1)
    }
    expect(sigmaToTimestep(1e-6, schedule, 0.5)).toBe(0)
  })
})
