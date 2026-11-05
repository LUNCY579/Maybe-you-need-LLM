import { describe, expect, it } from 'vitest'
import { createRng, gaussian, l2Distance, mean, stdDev } from '@llm-materials/course-core'
import { buildSchedule, effectiveDiffusionLength, terminalKLDivergence } from './schedules.js'
import {
  clampIndex,
  describeForwardMarginal,
  forwardChain,
  posteriorMean,
  posteriorVariance,
  qSample,
  signalToNoise,
  swapNoise,
} from './forward.js'
import {
  ancestralStep,
  ddimStep,
  reverseMean,
  reverseStd,
  sample,
  toEpsilon,
  toX0,
} from './reverse.js'
import { Adam, Mlp } from './mlp.js'
import { Denoiser, ringMixture, trainDenoiser, twoGaussians } from './denoiser.js'
import {
  buildMixture,
  classPosterior,
  componentScore,
  guidedScore,
  measureGuidance,
  mixtureScore,
} from './guidance.js'
import {
  boundTerm,
  decomposeBound,
  diagonalGaussianKl,
  gaussianKl,
  simplifiedObjectiveRatio,
  weightCurves,
} from './variational.js'
import {
  compressionSaving,
  decode,
  encode,
  fitAutoencoder,
  latentVariances,
  reconstructionError,
  unitVarianceScale,
} from './latent.js'

const schedule = buildSchedule('linear', 200)

describe('schedules', () => {
  it('follows the paper linear schedule', () => {
    const s = buildSchedule('linear', 1000)
    expect(s.betas[0]).toBeCloseTo(1e-4, 8)
    expect(s.betas[999]).toBeCloseTo(0.02, 8)
  })

  it('accumulates ᾱ as the product of α', () => {
    const s = buildSchedule('linear', 50)
    let running = 1
    for (let t = 0; t < s.steps; t++) {
      running *= 1 - s.betas[t]
      expect(s.alphaBars[t]).toBeCloseTo(running, 12)
    }
  })

  it('starts the previous-ᾱ array at one', () => {
    expect(schedule.previousAlphaBars[0]).toBe(1)
    expect(schedule.previousAlphaBars[1]).toBeCloseTo(schedule.alphaBars[0], 12)
  })

  it('makes the cosine schedule keep more signal through the middle of the chain', () => {
    // Compared at the paper's T = 1000, the cosine schedule preserves far
    // more signal at the midpoint: it spends more of its steps in the region
    // where denoising is still informative.
    const linear = buildSchedule('linear', 1000)
    const cosine = buildSchedule('cosine', 1000)
    const middle = 500
    expect(cosine.alphaBars[middle]).toBeGreaterThan(linear.alphaBars[middle])
    expect(cosine.snrs[middle]).toBeGreaterThan(linear.snrs[middle])
    // ... and it destroys the signal completely by the end.
    expect(cosine.alphaBars[999]).toBeLessThan(1e-6)
  })

  it('rejects a schedule with too few steps', () => {
    expect(() => buildSchedule('linear', 1)).toThrow(RangeError)
  })

  it('reports a terminal KL divergence that is tiny for the linear schedule', () => {
    const s = buildSchedule('linear', 1000)
    // The paper quotes roughly 1e-5 bits per dimension at T.
    const bits = terminalKLDivergence(s) / Math.log(2)
    expect(bits).toBeLessThan(1e-3)
    expect(bits).toBeGreaterThan(0)
  })

  it('reports an effective diffusion length', () => {
    expect(effectiveDiffusionLength(schedule)).toBeGreaterThan(0)
    expect(effectiveDiffusionLength(schedule)).toBeLessThanOrEqual(schedule.steps)
  })
})

describe('the forward process', () => {
  it('samples x_t with the closed form', () => {
    const x0 = [1, -2, 0.5]
    const noise = [0.1, 0.2, -0.3]
    const t = 17
    const xT = qSample(x0, t, noise, schedule)
    const index = clampIndex(t, schedule.steps)
    xT.forEach((value, i) => {
      expect(value).toBeCloseTo(
        schedule.sqrtAlphaBar[index] * x0[i] + schedule.sqrtOneMinusAlphaBar[index] * noise[i],
        12,
      )
    })
  })

  it('has the mean and variance the closed form predicts', () => {
    const rng = createRng(3)
    const x0 = [1, -2]
    const t = 25
    const draws: number[] = []
    for (let i = 0; i < 20000; i++) {
      const noise = [gaussian(rng), gaussian(rng)]
      const xT = qSample(x0, t, noise, schedule)
      draws.push(...xT)
    }
    const index = clampIndex(t, schedule.steps)
    const expectedSignal = schedule.sqrtAlphaBar[index]
    const expectedNoise = schedule.sqrtOneMinusAlphaBar[index]
    for (let d = 0; d < 2; d++) {
      const values = draws.filter((_, i) => i % 2 === d)
      expect(mean(values)).toBeCloseTo(expectedSignal * x0[d], 1)
      expect(stdDev(values)).toBeCloseTo(expectedNoise, 1)
    }
  })

  it('agrees with the step-by-step chain in distribution', () => {
    // The closed form and the Markov chain are the same distribution; this is
    // the property the whole efficiency argument rests on.
    const rng = createRng(11)
    const x0 = [0.4, -1.1]
    const t = 40
    const index = clampIndex(t, schedule.steps)

    const chained = forwardChain(x0, schedule, rng)[index]
    const direct: number[] = []
    for (let i = 0; i < 8000; i++) {
      const noise = [gaussian(rng), gaussian(rng)]
      direct.push(...qSample(x0, index, noise, schedule))
    }
    for (let d = 0; d < 2; d++) {
      const values = direct.filter((_, i) => i % 2 === d)
      expect(stdDev(values)).toBeCloseTo(schedule.sqrtOneMinusAlphaBar[index], 1)
    }
    expect(Math.abs(chained[0])).toBeLessThan(10)
  })

  it('reduces to the data at t = 0 and to noise at large t', () => {
    const x0 = [2, -2]
    const noise = [0.5, 0.5]
    const early = qSample(x0, 0, noise, schedule)
    // At t = 0 the state is the data plus a vanishing amount of noise.
    early.forEach((value, i) => {
      const expected = schedule.sqrtAlphaBar[0] * x0[i] + schedule.sqrtOneMinusAlphaBar[0] * noise[i]
      expect(value).toBeCloseTo(expected, 12)
    })
    // By the last step the signal is largely gone and the noise dominates.
    expect(schedule.sqrtOneMinusAlphaBar[schedule.steps - 1]).toBeGreaterThan(
      schedule.sqrtOneMinusAlphaBar[0] * 5,
    )
    expect(schedule.alphaBars[schedule.steps - 1]).toBeLessThan(0.5)
  })

  it('reports the marginal descriptively', () => {
    const marginal = describeForwardMarginal([1, 0], 10, schedule)
    expect(marginal.mean[0]).toBeCloseTo(schedule.sqrtAlphaBar[10], 12)
    expect(marginal.std).toBeCloseTo(schedule.sqrtOneMinusAlphaBar[10], 12)
    expect(marginal.snr).toBeCloseTo(schedule.snrs[10], 10)
  })

  it('reports a decreasing signal-to-noise ratio', () => {
    expect(signalToNoise(0, schedule)).toBeGreaterThan(signalToNoise(100, schedule))
    const long = buildSchedule('linear', 1000)
    expect(signalToNoise(long.steps - 1, long)).toBeLessThan(0.01)
  })
})

describe('the posterior q(x_{t-1} | x_t, x_0)', () => {
  it('has the mean from equation 7', () => {
    const x0 = [1.2, -0.4]
    const xT = [0.3, 0.9]
    const t = 12
    const index = clampIndex(t, schedule.steps)
    const alphaBarPrevious = schedule.previousAlphaBars[index]
    const alphaBar = schedule.alphaBars[index]
    const alpha = schedule.alphas[index]
    const beta = schedule.betas[index]
    const denominator = 1 - alphaBar
    const expected = x0.map(
      (v, i) =>
        ((Math.sqrt(alphaBarPrevious) * beta) / denominator) * v +
        ((Math.sqrt(alpha) * (1 - alphaBarPrevious)) / denominator) * xT[i],
    )
    const actual = posteriorMean(xT, x0, index, schedule)
    actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 10))
  })

  it('leans on x_0 more heavily at small t than at large t', () => {
    // The posterior mean is a fixed linear combination of x_0 and x_t, and the
    // weight it puts on x_0 shrinks as the noise grows.
    const weights = (t: number): { onX0: number; onXT: number } => {
      const index = clampIndex(t, schedule.steps)
      const alphaBarPrevious = schedule.previousAlphaBars[index]
      const alphaBar = schedule.alphaBars[index]
      const alpha = schedule.alphas[index]
      const beta = schedule.betas[index]
      const denominator = 1 - alphaBar
      return {
        onX0: (Math.sqrt(alphaBarPrevious) * beta) / denominator,
        onXT: (Math.sqrt(alpha) * (1 - alphaBarPrevious)) / denominator,
      }
    }
    const early = weights(1)
    const late = weights(schedule.steps - 1)
    // The two coefficients are a convex combination.
    expect(early.onX0 + early.onXT).toBeCloseTo(1, 8)
    expect(early.onX0).toBeGreaterThan(late.onX0)
    expect(early.onX0).toBeGreaterThan(0.5)
    expect(late.onX0).toBeLessThan(0.01)
  })

  it('has a posterior variance that is between zero and β_t', () => {
    for (const t of [1, 10, 100, 199]) {
      const beta = schedule.betas[clampIndex(t, schedule.steps)]
      const betaTilde = posteriorVariance(t, schedule)
      expect(betaTilde).toBeGreaterThan(0)
      expect(betaTilde).toBeLessThanOrEqual(beta + 1e-12)
    }
  })
})

describe('the reverse process', () => {
  it('recovers the posterior mean when the network predicts the true noise', () => {
    const x0 = [0.7, 1.1]
    const t = 30
    const index = clampIndex(t, schedule.steps)
    const trueNoise = [0.2, -0.4]
    const xT = qSample(x0, index, trueNoise, schedule)
    const mean = reverseMean(trueNoise, xT, index, schedule)
    const posterior = posteriorMean(xT, x0, index, schedule)
    mean.forEach((v, i) => expect(v).toBeCloseTo(posterior[i], 8))
  })

  it('converts between the three parameterisations consistently', () => {
    const x0 = [0.5, -0.8]
    const t = 20
    const index = clampIndex(t, schedule.steps)
    const epsilon = [0.3, 0.9]
    const xT = qSample(x0, index, epsilon, schedule)

    const asEpsilon = toEpsilon(epsilon, xT, index, schedule, 'epsilon')
    asEpsilon.forEach((v, i) => expect(v).toBeCloseTo(epsilon[i], 10))

    const x0Prediction = toX0(epsilon, xT, index, schedule, 'epsilon')
    x0Prediction.forEach((v, i) => expect(v).toBeCloseTo(x0[i], 8))

    // The v parameterisation: v = √ᾱ ε − √(1−ᾱ) x_0
    const sqrtAlphaBar = schedule.sqrtAlphaBar[index]
    const sqrtOneMinus = schedule.sqrtOneMinusAlphaBar[index]
    const v = epsilon.map((e, i) => sqrtAlphaBar * e - sqrtOneMinus * x0[i])
    const recovered = toEpsilon(v, xT, index, schedule, 'v')
    recovered.forEach((value, i) => expect(value).toBeCloseTo(epsilon[i], 8))
    const recoveredX0 = toX0(v, xT, index, schedule, 'v')
    recoveredX0.forEach((value, i) => expect(value).toBeCloseTo(x0[i], 8))
  })

  it('offers two reverse variances, with the posterior variance below β_t', () => {
    const small = reverseStd(50, schedule, 'beta')
    const large = reverseStd(50, schedule, 'posterior')
    // β̃_t = (1−ᾱ_{t−1})/(1−ᾱ_t) · β_t, and ᾱ_{t−1} > ᾱ_t, so β̃_t ≤ β_t.
    expect(large).toBeLessThanOrEqual(small + 1e-12)
  })

  it('adds noise to the ancestral step and not to the last one', () => {
    const config = { schedule, parameterisation: 'epsilon' as const, variance: 'beta' as const, dimension: 2 }
    const rng = createRng(5)
    const step = ancestralStep([1, 1], 10, [0, 0], config, rng, true)
    expect(step.noise.some((n) => n !== 0)).toBe(true)

    const last = ancestralStep([1, 1], 0, [0, 0], config, rng, true)
    expect(last.noise.every((n) => n === 0)).toBe(true)
  })

  it('is deterministic under DDIM with eta = 0', () => {
    const config = { schedule, parameterisation: 'epsilon' as const, variance: 'beta' as const, dimension: 2 }
    const rng = createRng(6)
    const a = ddimStep([1, 1], 20, [0.1, 0.2], config, rng, 0)
    const b = ddimStep([1, 1], 20, [0.1, 0.2], config, rng, 0)
    a.xPrevious.forEach((v, i) => expect(v).toBeCloseTo(b.xPrevious[i], 12))
    expect(a.noise.every((n) => n === 0)).toBe(true)
  })

  it('runs a full sampling chain', () => {
    const config = { schedule, parameterisation: 'epsilon' as const, variance: 'beta' as const, dimension: 2 }
    const trace = sample(() => [0, 0], config, 1)
    expect(trace.states.length).toBe(schedule.steps + 1)
    expect(trace.steps[0]).toBe(schedule.steps - 1)
  })
})

describe('the multilayer perceptron', () => {
  it('matches finite-difference gradients on every parameter', () => {
    const network = new Mlp({ inputSize: 3, hiddenSizes: [5, 4], outputSize: 2, seed: 1 })
    const input = [0.3, -0.7, 1.1]
    const target = [0.2, -0.4]

    const { output, cache } = network.forward(input)
    const dOutput = output.map((value, i) => 2 * (value - target[i]))
    const gradients = network.backward(cache, dOutput)

    const base = network.parameters.slice()
    const flatGradients: number[] = []
    for (const layer of gradients) {
      flatGradients.push(...layer.weights)
      flatGradients.push(...layer.bias)
    }

    const epsilon = 1e-6
    for (let p = 0; p < base.length; p++) {
      const original = base[p]
      const perturbed = base.slice()
      perturbed[p] = original + epsilon
      network.setParameters(perturbed)
      const plus = lossOf(network, input, target)
      perturbed[p] = original - epsilon
      network.setParameters(perturbed)
      const minus = lossOf(network, input, target)

      const numerical = (plus - minus) / (2 * epsilon)
      expect(Math.abs(numerical - flatGradients[p])).toBeLessThan(1e-5)
    }
  })

  it('reduces the loss when trained', () => {
    const network = new Mlp({ inputSize: 2, hiddenSizes: [8], outputSize: 1, seed: 2 })
    const optimiser = new Adam(network.parameters, 0.05)
    const x = [0.5, -0.5]
    const target = [1]

    const before = lossOf(network, x, target)
    for (let step = 0; step < 200; step++) {
      const { output, cache } = network.forward(x)
      const dOutput = output.map((value) => 2 * (value - target[0]))
      const gradients = network.backward(cache, dOutput)
      const flat: number[] = []
      for (const layer of gradients) {
        flat.push(...layer.weights)
        flat.push(...layer.bias)
      }
      optimiser.update(flat)
    }
    expect(lossOf(network, x, target)).toBeLessThan(before)
  })

  it('keeps a live reference to its parameters', () => {
    const network = new Mlp({ inputSize: 1, hiddenSizes: [2], outputSize: 1, seed: 3 })
    const live = network.parameters
    const before = network.forward([1]).output[0]
    live[0] += 1
    expect(network.forward([1]).output[0]).not.toBeCloseTo(before, 12)
  })
})

function lossOf(network: Mlp, input: number[], target: number[]): number {
  const { output } = network.forward(input)
  return output.reduce((acc, value, i) => acc + (value - target[i]) ** 2, 0)
}

describe('the denoiser', () => {
  it('trains and produces samples near the data', () => {
    const options = {
      dimension: 2,
      hiddenSizes: [16, 16],
      timeEmbeddingDimension: 4,
      schedule,
      seed: 4,
    }
    const { denoiser, losses, finalLoss } = trainDenoiser(options, { steps: 400, batchSize: 48 })
    expect(losses.length).toBeGreaterThan(0)
    expect(finalLoss).toBeLessThan(losses[0].loss)

    const config = { schedule, parameterisation: 'epsilon' as const, variance: 'beta' as const, dimension: 2 }
    const trace = sample((x, t) => denoiser.predict(x, t), config, 9)
    const samples = trace.states[trace.states.length - 1]

    // The samples should have landed somewhere on the ring, not at the origin.
    const radius = Math.hypot(samples[0], samples[1])
    expect(radius).toBeGreaterThan(0.5)
  }, 30000)

  it('predicts a vector of the right shape', () => {
    const denoiser = new Denoiser({
      dimension: 2,
      hiddenSizes: [4],
      timeEmbeddingDimension: 4,
      schedule,
      seed: 1,
    })
    expect(denoiser.predict([1, 2], 5)).toHaveLength(2)
  })

  it('generates toy datasets of the right shape', () => {
    const rng = createRng(2)
    expect(ringMixture(rng, 16, 8)).toHaveLength(16)
    expect(twoGaussians(rng, 10)).toHaveLength(10)
    expect(ringMixture(rng, 4, 8)[0]).toHaveLength(2)
  })
})

describe('guidance', () => {
  const mixture = buildMixture(
    [
      [-2, 0],
      [2, 0],
      [0, 2],
      [0, -2],
    ],
    0.6,
  )

  it('computes the exact score of a Gaussian mixture', () => {
    const x = [0.5, 0.5]
    const score = mixtureScore(x, mixture)
    const finiteDifference = x.map((_, d) => {
      const h = 1e-5
      const up = x.map((v, i) => (i === d ? v + h : v))
      const down = x.map((v, i) => (i === d ? v - h : v))
      const upDensity = Math.exp(logDensity(up))
      const downDensity = Math.exp(logDensity(down))
      return (upDensity - downDensity) / (2 * h * upDensity)
    })
    score.forEach((v, i) => expect(v).toBeCloseTo(finiteDifference[i], 4))
  })

  function logDensity(x: number[]): number {
    const logs = mixture.means.map((mean, i) => {
      let total = 0
      for (let d = 0; d < x.length; d++) {
        const z = (x[d] - mean[d]) / mixture.sigma
        total += -0.5 * z * z - Math.log(mixture.sigma) - 0.5 * Math.log(2 * Math.PI)
      }
      return Math.log(mixture.weights[i]) + total
    })
    const max = Math.max(...logs)
    return max + Math.log(logs.reduce((acc, l) => acc + Math.exp(l - max), 0))
  }

  it('interpolates between the unconditional and conditional scores', () => {
    const x = [1, 1]
    const unconditional = mixtureScore(x, mixture)
    const conditional = componentScore(x, mixture.means[0], mixture.sigma)

    const atZero = guidedScore(x, 0, 0, mixture)
    atZero.forEach((v, i) => expect(v).toBeCloseTo(unconditional[i], 12))

    const atOne = guidedScore(x, 0, 1, mixture)
    atOne.forEach((v, i) => expect(v).toBeCloseTo(conditional[i], 12))
  })

  it('computes a class posterior that sums to one', () => {
    const posterior = classPosterior([0, 0], mixture)
    expect(posterior.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
    expect(posterior[0]).toBeCloseTo(posterior[1], 10)
  })

  it('trades fidelity for diversity as the guidance weight rises', () => {
    const options = { samples: 60, stepSize: 0.05, steps: 120, seed: 21 }
    const low = measureGuidance(mixture, 0, 0, options)
    const high = measureGuidance(mixture, 0, 6, options)
    expect(high.fidelity).toBeLessThan(low.fidelity)
    expect(high.diversity).toBeLessThan(low.diversity)
  })
})

describe('the variational bound', () => {
  it('computes the KL between two Gaussians', () => {
    expect(gaussianKl(0, 1, 0, 1)).toBeCloseTo(0, 12)
    expect(gaussianKl(0, 1, 1, 1)).toBeCloseTo(0.5, 12)
    // KL(N(0, 2²) ‖ N(0, 1²)) = ln(1/2) + 4/2 − ½
    expect(gaussianKl(0, 2, 0, 1)).toBeCloseTo(-Math.log(2) + 1.5, 12)
    // And the other direction is not the same number.
    expect(gaussianKl(0, 1, 0, 2)).toBeCloseTo(Math.log(2) + 0.125 - 0.5, 12)
  })

  it('is non-negative for diagonal Gaussians', () => {
    const kl = diagonalGaussianKl([0, 0], 1, [0.5, -0.5], 1.2)
    expect(kl).toBeGreaterThan(0)
  })

  it('vanishes when the model matches the posterior exactly', () => {
    const config = { schedule, parameterisation: 'epsilon' as const, variance: 'posterior' as const, dimension: 2 }
    const x0 = [0.2, 0.4]
    const t = 15
    const index = clampIndex(t, schedule.steps)
    const xT = qSample(x0, index, [0.1, 0.3], schedule)
    const predicted = posteriorMean(xT, x0, index, schedule)
    const term = boundTerm(xT, x0, index, predicted, config)
    expect(term).toBeCloseTo(0, 8)
  })

  it('down-weights small timesteps relative to the true bound', () => {
    const config = { schedule, parameterisation: 'epsilon' as const, variance: 'beta' as const, dimension: 2 }
    const atStart = simplifiedObjectiveRatio(1, config)
    const atEnd = simplifiedObjectiveRatio(schedule.steps - 1, config)
    expect(atStart).toBeGreaterThan(atEnd)

    const curves = weightCurves(schedule, config)
    expect(curves.weighted[0]).toBeCloseTo(1, 8)
    expect(curves.weighted[curves.weighted.length - 1]).toBeLessThan(0.5)
    expect(curves.simplified.every((w) => w === 1)).toBe(true)
  })

  it('decomposes the bound into a terminal term and per-step terms', () => {
    const config = { schedule, parameterisation: 'epsilon' as const, variance: 'beta' as const, dimension: 2 }
    const decomposition = decomposeBound([0, 0], [0, 0], new Array(schedule.steps - 1).fill([0, 0]), config)
    expect(decomposition.terms.length).toBe(schedule.steps - 1)
    expect(decomposition.total).toBeCloseTo(decomposition.terminal + decomposition.terms.reduce((a, b) => a + b, 0), 8)
  })
})

describe('the latent autoencoder', () => {
  const rng = createRng(8)
  const data = Array.from({ length: 400 }, () => [gaussian(rng), gaussian(rng) * 0.3 + gaussian(rng) * 0.6])

  it('reconstructs exactly at full dimension', () => {
    const autoencoder = fitAutoencoder(data, 2)
    expect(reconstructionError(autoencoder, data)).toBeCloseTo(0, 8)
  })

  it('loses accuracy as the latent dimension shrinks', () => {
    const full = reconstructionError(fitAutoencoder(data, 2), data)
    const half = reconstructionError(fitAutoencoder(data, 1), data)
    expect(half).toBeGreaterThan(full)
  })

  it('round-trips through encode and decode', () => {
    const autoencoder = fitAutoencoder(data, 2)
    const point = data[0]
    const reconstructed = decode(autoencoder, encode(autoencoder, point))
    reconstructed.forEach((v, i) => expect(v).toBeCloseTo(point[i], 8))
  })

  it('reports the variance of the latent coordinates', () => {
    const autoencoder = fitAutoencoder(data, 1)
    const variances = latentVariances(autoencoder, data)
    expect(variances).toHaveLength(1)
    expect(variances[0]).toBeGreaterThan(0)
    expect(unitVarianceScale(autoencoder, data)).toBeGreaterThan(0)
  })

  it('computes the saving a latent diffusion model buys', () => {
    const saving = compressionSaving(256, 256, 3, 8, 4)
    expect(saving.spatialRatio).toBeCloseTo(1 / 8, 12)
    expect(saving.elementRatio).toBeCloseTo((1 / 64) * (4 / 3), 12)
    expect(saving.attentionRatio).toBeLessThan(saving.elementRatio)
  })
})

describe('the noise-swap experiment', () => {
  it('keeps the structure of one sample and the texture of another', () => {
    const x0 = [1, 0]
    const noiseA = [0.2, 0.4]
    const noiseB = [-0.3, 0.1]
    const { withA, withB, hybrid } = swapNoise(x0, noiseA, noiseB, 20, schedule)
    expect(hybrid[0]).toBeCloseTo((withA[0] + withB[0]) / 2, 12)
    expect(l2Distance(hybrid, withA)).toBeLessThan(l2Distance(withA, withB))
  })
})
