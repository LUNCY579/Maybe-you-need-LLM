import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createRng, fmt, gaussian, l2Distance, mean } from '@llm-materials/course-core'
import { buildSchedule, effectiveDiffusionLength, terminalKLDivergence } from '../../core/schedules'
import { describeForwardMarginal, forwardChain, posteriorMean, posteriorVariance, qSample } from '../../core/forward'
import { boundTerm, simplifiedObjectiveRatio, weightCurves } from '../../core/variational'
import { networkEvaluations, reverseMean, sample, toEpsilon, toX0 } from '../../core/reverse'
import type { ReverseConfig } from '../../core/reverse'
import {
  compressionSaving,
  decode,
  encode,
  fitAutoencoder,
  latentVariances,
  reconstructionError,
  unitVarianceScale,
} from '../../core/latent'
import { buildMixture, classPosterior, measureGuidance } from '../../core/guidance'
import {
  EDM_DEFAULTS,
  analyticSample,
  edmLossWeight,
  karrasSigmas,
  preconditioning,
  sigmaSignalToNoise,
  timestepToSigma,
} from '../../core/preconditioning'
import { ringMixture, TOY_MODEL, trainDenoiser } from '../../core/denoiser'
import type { TrainingResult } from '../../core/denoiser'
import { LAB_SCREENS } from './screens'

/**
 * These tests read the numbers the screens print and recompute them from the core, with the
 * settings the controls hold when a laboratory is opened. They are not interaction tests: they
 * exist because a figure that disagrees with the function it claims to show is worse than no
 * figure at all.
 */

const TOY = buildSchedule('linear', 200)
const PAPER = buildSchedule('linear', 1000)

afterEach(cleanup)

function renderLab(id: string) {
  const Screen = LAB_SCREENS[id]
  if (!Screen) throw new Error(`no screen is registered for ${id}`)
  return render(
    <MemoryRouter>
      <Screen />
    </MemoryRouter>,
  )
}

function statNode(label: string): Element {
  const nodes = Array.from(document.querySelectorAll('.stat'))
  const node = nodes.find((candidate) => candidate.querySelector('.stat-label')?.textContent?.trim() === label)
  if (!node) throw new Error(`no stat labelled "${label}"`)
  return node
}

function stat(label: string): string {
  return statNode(label).querySelector('.stat-value')?.textContent?.trim() ?? ''
}

function statHint(label: string): string {
  return statNode(label).querySelector('.stat-hint')?.textContent?.trim() ?? ''
}

function table(caption: string | RegExp): string[][] {
  const tables = Array.from(document.querySelectorAll('table.data-table'))
  const node = tables.find((candidate) => {
    const text = candidate.querySelector('caption')?.textContent?.trim() ?? ''
    return typeof caption === 'string' ? text === caption : caption.test(text)
  })
  if (!node) {
    const seen = tables.map((t) => t.querySelector('caption')?.textContent?.trim()).join(' | ')
    throw new Error(`no table with caption ${caption}; found ${seen}`)
  }
  return Array.from(node.querySelectorAll('tbody tr')).map((row) =>
    Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? ''),
  )
}

function figure(title: string): Element {
  const node = Array.from(document.querySelectorAll('figure.figure')).find(
    (candidate) => candidate.querySelector('.figure-title')?.textContent?.trim() === title,
  )
  if (!node) throw new Error(`no figure titled "${title}"`)
  return node
}

function caption(title: string): string {
  return figure(title).querySelector('figcaption')?.textContent?.trim() ?? ''
}

function description(title: string): string {
  return figure(title).querySelector('p.sr-only')?.textContent?.trim() ?? ''
}

function callout(title: string): string {
  const node = Array.from(document.querySelectorAll('aside.callout')).find(
    (candidate) => candidate.querySelector('.callout-title')?.textContent?.trim() === title,
  )
  if (!node) throw new Error(`no callout titled "${title}"`)
  return node.querySelector('.callout-body')?.textContent?.trim() ?? ''
}

function slider(label: string): { input: HTMLInputElement; shown: string } {
  const labelNode = Array.from(document.querySelectorAll('label.field-label')).find((candidate) =>
    (candidate.textContent ?? '').trim().startsWith(label),
  )
  if (!labelNode) throw new Error(`no control labelled "${label}"`)
  const input = document.getElementById(labelNode.getAttribute('for') ?? '')
  if (!input || input.tagName !== 'INPUT') throw new Error(`"${label}" does not label an input`)
  return { input: input as HTMLInputElement, shown: labelNode.querySelector('.field-value')?.textContent?.trim() ?? '' }
}

function moveSlider(label: string, value: string) {
  fireEvent.change(slider(label).input, { target: { value } })
}

function useView(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
}

const PAIR = (a: number, b: number, digits: number) => `(${fmt(a, digits)}, ${fmt(b, digits)})`

describe('the forward laboratory prints the closed form it claims', () => {
  const X0: [number, number] = [1.6, 0.5]

  it('states the marginal at the timestep the control holds', () => {
    renderLab('forward')
    const marginal = describeForwardMarginal(X0, 40, TOY)
    expect(stat('ᾱ_t')).toBe(fmt(marginal.alphaBar, 4))
    expect(stat('SNR')).toBe(fmt(marginal.snr, 3))
    expect(stat('√ᾱ_t')).toBe(fmt(marginal.sqrtAlphaBar, 3))
    expect(stat('√(1−ᾱ_t)')).toBe(fmt(marginal.sqrtOneMinusAlphaBar, 3))

    // The hints make two claims about the relationship between these four numbers.
    expect(marginal.snr).toBeCloseTo(marginal.alphaBar / (1 - marginal.alphaBar), 12)
    expect(marginal.sqrtAlphaBar ** 2 + marginal.sqrtOneMinusAlphaBar ** 2).toBeCloseTo(1, 12)
  })

  it('moves the marginal figures when the timestep moves', () => {
    renderLab('forward')
    const before = stat('ᾱ_t')
    moveSlider('Timestep t', '120')
    const marginal = describeForwardMarginal(X0, 120, TOY)
    expect(stat('ᾱ_t')).toBe(fmt(marginal.alphaBar, 4))
    expect(stat('ᾱ_t')).not.toBe(before)
    expect(stat('√(1−ᾱ_t)')).toBe(fmt(marginal.sqrtOneMinusAlphaBar, 3))
    expect(slider('Timestep t').shown).toBe('120 of 199')
  })

  it('draws the chain at every twentieth step, as its own description says', () => {
    renderLab('forward')
    const chain = forwardChain(X0, TOY, createRng(7))
    const marks = chain.filter((_, index) => index % 20 === 0)
    expect(marks.length).toBe(11)
    expect(chain.length).toBe(TOY.steps + 1)
    expect(description('The chain, step by step')).toContain(`${marks.length} steps of the chain`)
    expect(caption('The chain, step by step')).toContain('every twentieth step')
  })

  it('writes the marginal out at three timesteps in the closed-form view', () => {
    renderLab('forward')
    useView('The closed form')
    const rows = table('x_t = √ᾱ_t·x_0 + √(1−ᾱ_t)·ε')
    expect(rows.map((row) => row[0])).toEqual(['0', '20', '40'])
    for (const row of rows) {
      const marginal = describeForwardMarginal(X0, Number(row[0]), TOY)
      expect(row[1]).toBe(fmt(marginal.alphaBar, 4))
      expect(row[2]).toBe(PAIR(marginal.mean[0]!, marginal.mean[1]!, 3))
      expect(row[3]).toBe(fmt(marginal.std, 4))
      expect(row[4]).toBe(fmt(marginal.snr, 3))
    }
    const marginal = describeForwardMarginal(X0, 40, TOY)
    expect(stat('Mean of x_t')).toBe(PAIR(marginal.mean[0]!, marginal.mean[1]!, 3))
    expect(stat('Std of x_t')).toBe(fmt(marginal.std, 3))
  })

  it('puts the same weight on the posterior table as the core does', () => {
    renderLab('forward')
    useView('The posterior')
    const xT = qSample(X0, 40, [0.3, -0.2], TOY)
    const meanRow = posteriorMean(xT, X0, 40, TOY)
    const rows = table('The posterior at the chosen timestep')
    const value = (name: string) => rows.find((row) => row[0] === name)![1]!
    expect(value('ᾱ_t')).toBe(fmt(TOY.alphaBars[40]!, 6))
    expect(value('x_t')).toBe(PAIR(xT[0]!, xT[1]!, 4))
    expect(value('posterior mean')).toBe(PAIR(meanRow[0]!, meanRow[1]!, 4))
    expect(value('posterior variance β̃_t')).toBe(fmt(posteriorVariance(40, TOY), 6))

    // The printed weight is the x_0 coefficient of the posterior mean, and the two coefficients
    // together — not one minus the first — are what reproduce the mean the row above prints.
    const weight = value('weight on x₀')
    const previous = TOY.previousAlphaBars[40]!
    const onX0 = (Math.sqrt(previous) * TOY.betas[40]!) / (1 - TOY.alphaBars[40]!)
    const onXT = (Math.sqrt(TOY.alphas[40]!) * (1 - previous)) / (1 - TOY.alphaBars[40]!)
    expect(weight).toBe(fmt(onX0, 4))
    expect(onX0 * X0[0]! + onXT * xT[0]!).toBeCloseTo(meanRow[0]!, 6)
    expect(Number(weight) + onXT).toBeGreaterThan(0.995)

    // and the caption's trend claim, measured over the series the plot draws
    const onX0Series: number[] = []
    const onXTSeries: number[] = []
    for (let step = 0; step < TOY.steps; step += 4) {
      const prev = TOY.previousAlphaBars[step]!
      const alphaBar = TOY.alphaBars[step]!
      onX0Series.push((Math.sqrt(prev) * TOY.betas[step]!) / (1 - alphaBar))
      onXTSeries.push((Math.sqrt(TOY.alphas[step]!) * (1 - prev)) / (1 - alphaBar))
    }
    expect(onX0Series.every((value2, index) => index === 0 || value2 <= onX0Series[index - 1]!)).toBe(true)
    expect(onX0Series[0]!).toBeGreaterThan(0.99)
    expect(onX0Series[onX0Series.length - 1]!).toBeLessThan(0.02)
    // "they sum to within half a percent of one along the whole chain"
    const sums = onX0Series.map((value2, index) => value2 + onXTSeries[index]!)
    expect(Math.min(...sums)).toBeGreaterThan(0.995)
    expect(Math.max(...sums)).toBeLessThan(1.005)
  })
})

describe('the schedule laboratory prints what buildSchedule returns', () => {
  it('states the β range, the terminal divergence and the effective length at T = 1000', () => {
    renderLab('schedules')
    expect(stat('β₁')).toBe(fmt(PAPER.betas[0]!, 6))
    expect(stat('β_T')).toBe(fmt(PAPER.betas[PAPER.steps - 1]!, 6))
    expect(PAPER.betas[0]).toBeCloseTo(1e-4, 12)
    expect(PAPER.betas[PAPER.steps - 1]).toBeCloseTo(0.02, 12)

    const bits = terminalKLDivergence(PAPER) / Math.log(2)
    expect(stat('Terminal KL')).toBe(`${fmt(bits, 8)} bits`)
    expect(statHint('Terminal KL')).toBe('how far x_T is from the prior')

    expect(stat('Effective length')).toBe(String(effectiveDiffusionLength(PAPER)))
    const halfLife = PAPER.alphaBars.findIndex((value) => value < 0.5)
    expect(statHint('Effective length')).toBe(`the first timestep whose ᾱ is below 0.5 is t = ${halfLife}`)
    expect(Number(stat('Effective length'))).toBe(halfLife + 1)
    expect(PAPER.alphaBars[halfLife]!).toBeLessThan(0.5)
    expect(PAPER.alphaBars[halfLife - 1]!).toBeGreaterThanOrEqual(0.5)
  })

  it('samples both schedules at the points its table lists', () => {
    renderLab('schedules')
    const cosine = buildSchedule('cosine', 1000)
    const rows = table('The two schedules, sampled at a few points')
    expect(rows.map((row) => Number(row[0]))).toEqual([0.1, 0.25, 0.5, 0.75, 0.9].map((f) => Math.floor(f * 1000)))
    for (const row of rows) {
      const index = Number(row[0])
      expect(row[1]).toBe(fmt(PAPER.alphaBars[index]!, 5))
      expect(row[2]).toBe(fmt(cosine.alphaBars[index]!, 5))
      expect(row[3]).toBe(fmt(PAPER.snrs[index]!, 4))
      expect(row[4]).toBe(fmt(cosine.snrs[index]!, 4))
      expect(PAPER.snrs[index]).toBeCloseTo(PAPER.alphaBars[index]! / (1 - PAPER.alphaBars[index]!), 8)
    }
  })

  it('changes the figures when the schedule or the step count moves', () => {
    renderLab('schedules')
    const linearFirst = stat('β_T')
    useView('Cosine')
    expect(stat('β_T')).not.toBe(linearFirst)
    expect(stat('Terminal KL')).toBe(`${fmt(terminalKLDivergence(buildSchedule('cosine', 1000)) / Math.log(2), 8)} bits`)

    moveSlider('Number of steps T', '500')
    expect(slider('Number of steps T').shown).toBe('500')
    const short = buildSchedule('cosine', 500)
    expect(stat('β_T')).toBe(fmt(short.betas[short.steps - 1]!, 6))
    expect(stat('Effective length')).toBe(String(effectiveDiffusionLength(short)))
    const rows = table('The two schedules, sampled at a few points')
    expect(rows.map((row) => Number(row[0]))).toEqual([0.1, 0.25, 0.5, 0.75, 0.9].map((f) => Math.floor(f * 500)))
  })
})

describe('the latent laboratory measures the autoencoder it shows', () => {
  const points = (seed: number) => {
    const rng = createRng(seed)
    return Array.from({ length: 300 }, () => {
      const cluster = rng() < 0.5 ? 0 : 1
      const angle = cluster === 0 ? 0.4 : -0.9
      const along = gaussian(rng) * 1.6
      const across = gaussian(rng) * 0.25
      return [
        along * Math.cos(angle) - across * Math.sin(angle),
        along * Math.sin(angle) + across * Math.cos(angle),
      ]
    })
  }

  it('reports the fitted autoencoder, measured', () => {
    renderLab('latent')
    const data = points(3)
    const autoencoder = fitAutoencoder(data, 1)
    const error = reconstructionError(autoencoder, data)
    const variances = latentVariances(autoencoder, data)
    const scale = unitVarianceScale(autoencoder, data)

    expect(stat('Reconstruction MSE')).toBe(fmt(error, 6))
    expect(stat('Variance retained')).toBe(`${fmt(autoencoder.explainedVarianceRatio * 100, 1)}%`)
    expect(stat('Unit-variance scale')).toBe(fmt(scale, 4))

    const coordinates = table('The latent coordinates')
    const value = (name: string) => coordinates.find((row) => row[0] === name)![1]!
    expect(value('input dimension')).toBe('2')
    expect(value('latent dimension')).toBe('1')
    expect(value('variance retained')).toBe(fmt(autoencoder.explainedVarianceRatio, 6))
    expect(value('latent variance, coordinate 0')).toBe(fmt(variances[0]!, 6))
    expect(value('reconstruction MSE')).toBe(fmt(error, 8))
    expect(value('unit-variance scale factor')).toBe(fmt(scale, 6))

    // The scale is the reciprocal of the root mean latent variance — the claim the callout makes.
    expect(scale).toBeCloseTo(1 / Math.sqrt(mean(variances)), 12)

    const roundTrip = table('The round trip, point by point')
    expect(roundTrip.length).toBe(4)
    roundTrip.forEach((row, index) => {
      const point = data[index]!
      const latent = encode(autoencoder, point)
      const reconstructed = decode(autoencoder, latent)
      const squared = point.reduce((total, coordinate, d) => total + (coordinate - reconstructed[d]!) ** 2, 0)
      expect(row[0]).toBe(String(index + 1))
      expect(row[1]).toBe(PAIR(point[0]!, point[1]!, 3))
      expect(row[2]).toBe(latent.map((coordinate) => fmt(coordinate, 3)).join(', '))
      expect(row[3]).toBe(PAIR(reconstructed[0]!, reconstructed[1]!, 3))
      expect(row[4]).toBe(fmt(squared, 5))
    })
  })

  it('rescales the latents back onto the pixel signal-to-noise ratio', () => {
    renderLab('latent')
    const data = points(3)
    const autoencoder = fitAutoencoder(data, 1)
    const scale = unitVarianceScale(autoencoder, data)
    const latentVariance = mean(latentVariances(autoencoder, data))

    const rows = table('The effective signal-to-noise ratio in pixel space and in latent space')
    expect(rows.length).toBeGreaterThan(3)
    for (const row of rows) {
      const t = Number(row[0])
      const alphaBar = TOY.alphaBars[t]!
      const noise = 1 - alphaBar
      expect(row[1]).toBe(fmt(alphaBar / noise, 4))
      expect(row[2]).toBe(fmt((alphaBar * latentVariance) / noise, 4))
      expect(row[3]).toBe(fmt((alphaBar * latentVariance * scale ** 2) / noise, 4))
      // The fix this screen exists to show: rescaled latents sit exactly on the pixel curve.
      expect(row[3]).toBe(row[1])
    }

    // and the middle column is a constant multiple of the first, by one factor only
    const factor = Number(rows[0]![2]) / Number(rows[0]![1])
    for (const row of rows) {
      // The cells are printed to four decimals, so the ratio is only as good as that rounding.
      expect(Number(row[2]) / Number(row[1])).toBeCloseTo(factor, 4)
    }
    expect(factor).toBeCloseTo(latentVariance, 4)
  })

  it('does the arithmetic on the 256×256 image it quotes', () => {
    renderLab('latent')
    const saving = compressionSaving(256, 256, 3, 8, 4)
    const rows = table('The saving from a factor-8 compression of a 256×256 image')
    const value = (name: string) => rows.find((row) => row[0] === name)![1]!
    expect(value('pixel elements')).toBe('196608')
    expect(value('latent elements')).toBe('4096')
    expect(value('element ratio')).toBe(fmt(saving.elementRatio, 6))
    expect(value('element saving')).toBe(`${fmt(1 / saving.elementRatio, 1)}×`)
    expect(value('attention saving')).toBe(`${fmt(1 / saving.attentionRatio, 0)}×`)
    expect(stat('Element saving')).toBe(`${fmt(1 / saving.elementRatio, 1)}×`)
    expect(saving.elementRatio).toBeCloseTo(1 / 48, 12)
    expect(saving.attentionRatio).toBeCloseTo(1 / 3072, 12)
    expect(caption('What the compression buys a 256×256 image')).toContain('48× at f = 8')
  })

  it('loses the discarded direction at one latent dimension and not at two', () => {
    renderLab('latent')
    const before = stat('Reconstruction MSE')
    expect(Number(before)).toBeGreaterThan(0.1)
    moveSlider('Latent dimension', '2')
    const data = points(3)
    const two = fitAutoencoder(data, 2)
    expect(stat('Reconstruction MSE')).toBe(fmt(reconstructionError(two, data), 6))
    expect(stat('Variance retained')).toBe(`${fmt(two.explainedVarianceRatio * 100, 1)}%`)
    expect(stat('Unit-variance scale')).toBe(fmt(unitVarianceScale(two, data), 4))
    // A linear autoencoder with as many latents as dimensions loses nothing.
    expect(Number(stat('Reconstruction MSE'))).toBeLessThan(1e-6)
    expect(stat('Element saving')).toBe('48.0×')
  })
})

describe('the guidance laboratory measures one run, not two', () => {
  const MEANS = [
    [-2.2, 0],
    [2.2, 0],
    [0, 2.2],
    [0, -2.2],
  ]
  const SETTINGS = { samples: 60, stepSize: 0.04, steps: 150, seed: 77 }
  const mixture = buildMixture(MEANS, 0.55)

  it('prints the same measurement in the stats and in the starred row', () => {
    renderLab('guidance')
    useView('The trade-off')
    const measured = measureGuidance(mixture, 0, 2, SETTINGS)
    expect(stat('Fidelity')).toBe(fmt(measured.fidelity, 3))
    expect(stat('Diversity')).toBe(fmt(measured.diversity, 3))
    expect(stat('Class accuracy')).toBe(`${fmt(measured.classAccuracy * 100, 1)}%`)
    expect(stat('Guidance weight')).toBe('2.0')

    const starred = table('The trade-off, measured — the starred row is the weight on the slider').find((row) =>
      row[0].includes('✱'),
    )!
    expect(starred[0]).toBe('2.0 ✱')
    expect(starred[1]).toBe(fmt(measured.fidelity, 4))
    expect(starred[2]).toBe(fmt(measured.diversity, 4))
    expect(starred[3]).toBe(`${fmt(measured.classAccuracy * 100, 1)}%`)
  })

  it('shows fidelity and diversity both falling as the weight rises', () => {
    renderLab('guidance')
    useView('The trade-off')
    const rows = table('The trade-off, measured — the starred row is the weight on the slider')
    const weights = [0, 0.5, 1, 2, 3, 5, 8]
    expect(rows.map((row) => Number(row[0].replace('✱', '').trim()))).toEqual(weights)
    const measured = weights.map((w) => measureGuidance(mixture, 0, w, SETTINGS))
    measured.forEach((entry, index) => {
      expect(rows[index]![1]).toBe(fmt(entry.fidelity, 4))
      expect(rows[index]![2]).toBe(fmt(entry.diversity, 4))
    })
    expect(measured.every((entry, index) => index === 0 || entry.fidelity < measured[index - 1]!.fidelity)).toBe(true)
    expect(measured.every((entry, index) => index === 0 || entry.diversity < measured[index - 1]!.diversity)).toBe(true)
    expect(measured.every((entry, index) => index === 0 || entry.classAccuracy > measured[index - 1]!.classAccuracy)).toBe(
      true,
    )
    // the price the caption names: the spread at w = 8 is well under half the unconditional one
    expect(measured[measured.length - 1]!.diversity).toBeLessThan(measured[0]!.diversity / 2)
    expect(caption('Fidelity against the guidance weight')).toContain('Both fall as w rises')
  })

  it('states the class posterior at each mode for the condition in use', () => {
    renderLab('guidance')
    const rows = table('The class posterior at each mode')
    expect(rows.map((row) => row[1])).toEqual(MEANS.map((mean2) => PAIR(mean2[0]!, mean2[1]!, 1)))
    expect(rows.map((row) => row[2])).toEqual(MEANS.map((mean2) => fmt(classPosterior(mean2, mixture)[0]!, 4)))

    const group = screen.getByRole('group', { name: 'The condition' })
    fireEvent.click(within(group).getByRole('button', { name: '3' }))
    const moved = table('The class posterior at each mode')
    expect(moved.map((row) => row[2])).toEqual(MEANS.map((mean2) => fmt(classPosterior(mean2, mixture)[2]!, 4)))
    // the requested mode wins where it sits, and almost nowhere else
    expect(Number(moved[2]![2])).toBeGreaterThan(0.99)
    expect(Number(moved[0]![2])).toBeLessThan(1e-6)
  })

  it('re-measures when the weight moves', () => {
    renderLab('guidance')
    useView('The trade-off')
    const before = stat('Fidelity')
    moveSlider('Guidance weight w', '5')
    const measured = measureGuidance(mixture, 0, 5, SETTINGS)
    expect(slider('Guidance weight w').shown).toBe('5.0')
    expect(stat('Fidelity')).toBe(fmt(measured.fidelity, 3))
    expect(stat('Fidelity')).not.toBe(before)
    const rows = table('The trade-off, measured — the starred row is the weight on the slider')
    expect(rows.map((row) => row[0])).toContain('5.0 ✱')
    expect(rows.filter((row) => row[0].includes('✱'))).toHaveLength(1)
    expect(rows.find((row) => row[0] === '2.0')![1]).toBe(fmt(measureGuidance(mixture, 0, 2, SETTINGS).fidelity, 4))
  })
})

describe('the variational laboratory evaluates the bound instead of restating it', () => {
  const CONFIG: ReverseConfig = { schedule: TOY, parameterisation: 'epsilon', variance: 'beta', dimension: 2 }

  it('prints the weights the true bound gives', () => {
    renderLab('variational')
    const curves = weightCurves(TOY, CONFIG)
    const ratios = TOY.betas.map((_, t) => simplifiedObjectiveRatio(t, CONFIG))
    expect(stat('Largest true weight')).toBe(fmt(curves.maxWeighted, 4))
    expect(stat('Weight at the last step')).toBe(fmt(ratios[ratios.length - 1]!, 6))
    expect(stat('Simplified weight')).toBe(fmt(curves.simplified[0]!, 4))
    expect(curves.simplified.every((value) => value === 1)).toBe(true)

    const text = caption('The weight the true bound puts on each timestep')
    expect(text).toContain(fmt(curves.maxWeighted, 4))
    expect(text).toContain(fmt(ratios[ratios.length - 1]!, 6))

    const calloutText = callout('Why the simplification is not a small change')
    expect(calloutText).toContain(fmt(ratios[0]!, 4))
    expect(calloutText).toContain(fmt(ratios[ratios.length - 1]!, 6))
    expect(calloutText).toContain(fmt(ratios[0]! / ratios[ratios.length - 1]!, 0))
    // "most of the change happens in the first few steps", measured
    const drop = ratios[0]! - ratios[ratios.length - 1]!
    expect((ratios[0]! - ratios[20]!) / drop).toBeGreaterThan(0.8)
    expect(ratios[20]!).toBeLessThan(ratios[0]! / 10)
  })

  it('evaluates the per-step KL terms with the core function', () => {
    renderLab('variational')
    useView('The decomposition')
    const x0 = [0.8, -0.4]
    const xT = qSample(x0, 60, [0.3, 0.6], TOY)
    const rows: { t: number; kl: number }[] = []
    for (let t = 1; t < TOY.steps; t += 2) {
      const wrong = posteriorMean(xT, x0, t, TOY).map((value) => value + 0.05)
      rows.push({ t, kl: boundTerm(xT, x0, t, wrong, CONFIG) })
    }
    const total = rows.reduce((acc, row) => acc + row.kl, 0)
    expect(stat('Per-step KL, summed')).toBe(fmt(total, 4))
    expect(statHint('Per-step KL, summed')).toBe(`nats, over the ${rows.length} steps plotted`)
    expect(rows.length).toBe(100)

    const printed = table('The terms, sampled along the chain')
    const sampled = rows.filter((_, index) => index % 10 === 0)
    expect(printed.map((row) => Number(row[0]))).toEqual(sampled.map((row) => row.t))
    printed.forEach((row, index) => {
      expect(row[1]).toBe(fmt(sampled[index]!.kl, 6))
      expect(row[2]).toBe(fmt(simplifiedObjectiveRatio(sampled[index]!.t, CONFIG), 4))
    })
    // the terms are not equal, which is what the caption says
    expect(Math.max(...sampled.map((row) => row.kl))).toBeGreaterThan(10 * Math.min(...sampled.map((row) => row.kl)))
  })

  it('counts the network evaluations of a sample', () => {
    renderLab('variational')
    useView('The cost')
    const rows = table('The cost of one sample, by the number of steps')
    expect(rows.map((row) => Number(row[0]))).toEqual([1, 2, 4, 10, 20, 50, 100, 250, 500, 1000])
    rows.forEach((row) => {
      const evaluations = networkEvaluations(PAPER, Number(row[0]))
      expect(row[1]).toBe(String(evaluations))
      expect(row[2]).toBe(`${fmt(evaluations / networkEvaluations(PAPER, PAPER.steps), 4)}×`)
    })
    expect(rows[rows.length - 1]![1]).toBe('1000')
    expect(rows[rows.length - 1]![2]).toBe('1.0000×')
  })
})

describe('the preconditioning laboratory prints the algebra of equation 7', () => {
  const SIGMA = 10 ** 0.5
  const SIGMA_DATA = 0.5
  const CONFIG = { ...EDM_DEFAULTS, sigmaData: SIGMA_DATA, steps: 32 }

  it('names the noise level in the caption that the control shows', () => {
    renderLab('preconditioning')
    const coefficients = preconditioning(SIGMA, SIGMA_DATA)
    expect(slider('Noise level').shown).toBe(`σ = ${SIGMA.toFixed(3)}`)
    const rows = table(`The coefficients at σ = ${fmt(SIGMA, 3)}`)
    const value = (name: string) => rows.find((row) => row[0] === name)![1]!
    expect(value('c_skip')).toBe(fmt(coefficients.cSkip, 6))
    expect(value('c_out')).toBe(fmt(coefficients.cOut, 6))
    expect(value('c_in')).toBe(fmt(coefficients.cIn, 6))
    expect(value('c_noise')).toBe(fmt(coefficients.cNoise, 6))
    expect(value('the loss weight λ(σ)')).toBe(fmt(edmLossWeight(SIGMA, SIGMA_DATA), 6))
    expect(value('the signal-to-noise ratio')).toBe(fmt(sigmaSignalToNoise(SIGMA, SIGMA_DATA), 6))
    expect(value('σ / σ_data')).toBe(fmt(SIGMA / SIGMA_DATA, 6))

    expect(stat('c_skip')).toBe(fmt(coefficients.cSkip, 4))
    expect(stat('c_out')).toBe(fmt(coefficients.cOut, 4))
    expect(stat('c_in')).toBe(fmt(coefficients.cIn, 4))
    expect(stat('c_noise')).toBe(fmt(coefficients.cNoise, 3))
    expect(coefficients.cNoise).toBeCloseTo(Math.log(SIGMA) / 4, 12)

    moveSlider('Noise level', '1')
    expect(slider('Noise level').shown).toBe(`σ = ${(10 ** 1).toFixed(3)}`)
    const atTen = preconditioning(10, SIGMA_DATA)
    expect(stat('c_skip')).toBe(fmt(atTen.cSkip, 4))
    expect(table(`The coefficients at σ = ${fmt(10, 3)}`).length).toBe(7)
  })

  it('walks the ladder and the sampler it tabulates', () => {
    renderLab('preconditioning')
    const sigmas = karrasSigmas(CONFIG)
    expect(sigmas[0]).toBeCloseTo(CONFIG.sigmaMax, 6)
    expect(sigmas[sigmas.length - 1]).toBeCloseTo(CONFIG.sigmaMin, 6)

    const ladder = table('σ_i and the coefficients')
    const indices = ladder.map((row) => Number(row[0]))
    expect(indices).toEqual(sigmas.map((_, index) => index).filter((index) => index % 4 === 0 || index === sigmas.length - 1))
    ladder.forEach((row) => {
      const index = Number(row[0])
      const coefficients = preconditioning(sigmas[index]!, SIGMA_DATA)
      expect(row[1]).toBe(fmt(sigmas[index]!, 4))
      expect(row[2]).toBe(fmt(coefficients.cSkip, 4))
      expect(row[3]).toBe(fmt(coefficients.cOut, 4))
      expect(row[4]).toBe(fmt(coefficients.cIn, 4))
      expect(row[5]).toBe(fmt(coefficients.cNoise, 3))
    })

    const trace = analyticSample([4, -3], [1.2, -0.4], CONFIG)
    const first = trace[0]!
    const last = trace[trace.length - 1]!
    expect(stat('The distance at σ_max')).toBe(fmt(first.distance, 3))
    expect(stat('The distance at σ_min')).toBe(fmt(last.distance, 4))
    expect(stat('The Euler steps')).toBe(String(trace.length - 1))
    expect(statHint('The Euler steps')).toBe(`one fewer than the ${CONFIG.steps} noise levels the schedule visits`)

    // the caption's exactness claim, measured rather than asserted
    const contraction = first.distance / last.distance
    expect(stat('The contraction')).toBe(`${fmt(contraction, 1)}×`)
    expect(statHint('The contraction')).toBe(`σ_max / σ_min is ${fmt(CONFIG.sigmaMax / CONFIG.sigmaMin, 0)}×`)
    expect(contraction).toBeCloseTo(CONFIG.sigmaMax / CONFIG.sigmaMin, 6)
    expect(trace[1]!.distance / first.distance).toBeCloseTo(sigmas[1]! / sigmas[0]!, 12)

    const states = table("The sampler's state")
    states.forEach((row) => {
      const step = trace[Number(row[0])]!
      expect(row[1]).toBe(fmt(step.sigma, 4))
      expect(row[2]).toBe(fmt(step.x[0]!, 4))
      expect(row[3]).toBe(fmt(step.x[1]!, 4))
      expect(row[4]).toBe(fmt(step.distance, 4))
    })
  })

  it('compares the two clocks with the σ the schedule implies', () => {
    renderLab('preconditioning')
    const rows = table('The timestep and its noise level')
    expect(rows.map((row) => Number(row[0]))).toEqual([0, 20, 40, 60, 80, 100, 120, 140, 160, 180])
    rows.forEach((row) => {
      const t = Number(row[0])
      const sigma = timestepToSigma(t, TOY, SIGMA_DATA)
      expect(row[1]).toBe(fmt(t / (TOY.steps - 1), 3))
      expect(row[2]).toBe(fmt(sigma, 4))
      expect(row[3]).toBe(fmt(sigma / SIGMA_DATA, 4))
      expect(row[4]).toBe(fmt(Math.log(sigma) / 4, 3))
      // σ_t = σ_data √((1−ᾱ_t)/ᾱ_t) is the relation the caption describes
      const alphaBar = TOY.alphaBars[t]!
      expect(sigma).toBeCloseTo(SIGMA_DATA * Math.sqrt((1 - alphaBar) / alphaBar), 10)
    })

    // "a much narrower range of noise levels than the EDM ladder", measured
    const clock = rows.map((row) => Number(row[2]))
    const ddpmRange = Math.max(...clock) / Math.min(...clock)
    const edmRange = CONFIG.sigmaMax / CONFIG.sigmaMin
    expect(ddpmRange).toBeLessThan(edmRange / 100)
  })
})

describe('the reverse laboratory converts between parameterisations and samples with the trained net', () => {
  const CONFIG: ReverseConfig = { schedule: TOY, parameterisation: 'epsilon', variance: 'beta', dimension: 2 }
  const SEED = 11
  let trained: Promise<TrainingResult> | null = null

  /** The same training run the button performs, kept for every test that needs it. */
  function model(): Promise<TrainingResult> {
    trained ??= Promise.resolve().then(() =>
      trainDenoiser(
        { dimension: 2, hiddenSizes: [32, 32], timeEmbeddingDimension: 8, schedule: TOY, seed: SEED },
        {
          steps: TOY_MODEL.steps,
          batchSize: TOY_MODEL.batchSize,
          recordEvery: TOY_MODEL.recordEvery,
          data: ringMixture(createRng(SEED), TOY_MODEL.dataPoints, TOY_MODEL.modes),
        },
      ),
    )
    return trained
  }

  it('converts one network output between the three parameterisations', () => {
    renderLab('reverse')
    useView('Parameterisations')
    const x0 = [1.1, -0.6]
    const epsilon = [0.4, -0.2]
    const t = 30
    const xT = qSample(x0, t, epsilon, TOY)
    const asV = [
      TOY.sqrtAlphaBar[t]! * epsilon[0] - TOY.sqrtOneMinusAlphaBar[t]! * x0[0],
      TOY.sqrtAlphaBar[t]! * epsilon[1]! - TOY.sqrtOneMinusAlphaBar[t]! * x0[1],
    ]
    const rows = table('Converting between the parameterisations')
    const value = (name: string) => rows.find((row) => row[0] === name)![1]!
    const fromV = toEpsilon(asV, xT, t, TOY, 'v')
    const x0FromEpsilon = toX0(epsilon, xT, t, TOY, 'epsilon')
    const x0FromV = toX0(asV, xT, t, TOY, 'v')
    const meanAtT = reverseMean(epsilon, xT, t, TOY)
    expect(value('the true x_0')).toBe(PAIR(x0[0]!, x0[1]!, 4))
    expect(value('the true ε')).toBe(PAIR(epsilon[0]!, epsilon[1]!, 4))
    expect(value('x_t')).toBe(PAIR(xT[0]!, xT[1]!, 4))
    expect(value('ε recovered from the v form')).toBe(PAIR(fromV[0]!, fromV[1]!, 4))
    expect(value('x_0 recovered from ε')).toBe(PAIR(x0FromEpsilon[0]!, x0FromEpsilon[1]!, 4))
    expect(value('x_0 recovered from v')).toBe(PAIR(x0FromV[0]!, x0FromV[1]!, 4))
    expect(value('the reverse mean μ_θ')).toBe(PAIR(meanAtT[0]!, meanAtT[1]!, 4))

    // The round trip is exact, which is the claim the figure's caption makes.
    expect(fromV[0]).toBeCloseTo(epsilon[0], 9)
    expect(x0FromV[1]).toBeCloseTo(x0[1], 9)
  })

  it('trains in the browser and reports the chain the sampler actually walked', async () => {
    renderLab('reverse')
    fireEvent.click(screen.getByRole('button', { name: 'Train the denoiser' }))
    await screen.findByText('Final loss', undefined, { timeout: 60_000 })

    const expected = await model()
    const data = ringMixture(createRng(SEED), TOY_MODEL.dataPoints, TOY_MODEL.modes)
    expect(stat('Final loss')).toBe(fmt(expected.finalLoss, 4))
    expect(stat('Training steps')).toBe(String(expected.losses.length))
    expect(stat('Network evaluations')).toBe(String(networkEvaluations(TOY, TOY.steps)))
    expect(stat('Network evaluations')).toBe('200')

    const trace = sample((x, t) => expected.denoiser.predict(x, t), CONFIG, SEED)
    const final = trace.states[trace.states.length - 1]!
    let nearest = Number.POSITIVE_INFINITY
    for (const point of data) nearest = Math.min(nearest, l2Distance(final, point))
    expect(stat('Sample radius')).toBe(fmt(Math.hypot(final[0]!, final[1]!), 3))
    expect(statHint('Sample radius')).toBe(`nearest training point at ${fmt(nearest, 3)}`)

    // The pairing the table used to get wrong: the state printed beside a step is the state after it.
    const rows = table('The chain, step by step, for one sample')
    const paired = trace.steps
      .map((step, index) => {
        const state = trace.states[index + 1]!
        return [String(step), PAIR(state[0]!, state[1]!, 3), fmt(Math.hypot(state[0]!, state[1]!), 3)]
      })
      .filter((_, index) => index % 20 === 0)
    expect(rows).toEqual(paired)
    expect(rows[0]![0]).toBe('199')
    expect(rows.length).toBe(10)
  }, 180_000)

  it('lands the four plotted chains on the ring it claims', async () => {
    renderLab('reverse')
    fireEvent.click(screen.getByRole('button', { name: 'Train the denoiser' }))
    await screen.findByText('Final loss', undefined, { timeout: 60_000 })

    const expected = await model()
    const data = ringMixture(createRng(SEED), TOY_MODEL.dataPoints, TOY_MODEL.modes)
    const ends = [0, 1, 2, 3].map((index) => {
      const chain = sample((x, t) => expected.denoiser.predict(x, t), CONFIG, SEED + index * 977)
      return chain.states[chain.states.length - 1]!
    })
    const distances = ends.map((final) => {
      let nearest = Number.POSITIVE_INFINITY
      for (const point of data) nearest = Math.min(nearest, l2Distance(final, point))
      return nearest
    })
    expect(caption('The reverse process, from noise to data')).toContain(
      `is ${fmt(Math.max(...distances), 2)} away`,
    )
    // The ring's modes sit at radius 2; every plotted chain ends up within the data's own scatter.
    expect(Math.max(...distances)).toBeLessThan(0.5)
    for (const end of ends) {
      const radius = Math.hypot(end[0]!, end[1]!)
      expect(radius).toBeGreaterThan(1.4)
      expect(radius).toBeLessThan(2.3)
    }
    expect(mean(data.map((point) => Math.hypot(point[0], point[1])))).toBeCloseTo(2, 1)
    const toyNote = callout('This is a toy model, trained on toy data')
    expect(toyNote).toContain(`${TOY_MODEL.steps} steps`)
    expect(toyNote).toContain(`the ${data.length} points plotted above`)
    expect(toyNote).toContain(`ring of ${TOY_MODEL.modes} Gaussian modes`)
  }, 180_000)
})
