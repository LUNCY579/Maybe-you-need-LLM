/**
 * Tests for the long-context arm of Laboratory E.
 *
 * Every number the screen prints comes from this module, so these tests are the audit of the
 * claim the laboratory makes: that position interpolation puts every rotary angle a long
 * context needs back inside the range training showed, and that it pays for that with local
 * resolution. Two of the assertions check the arithmetic against a hand-worked boundary
 * rather than against the code, and one checks the sharpest fact in the file — that plain
 * interpolation is a uniform rescaling, so one token past the target and no component is
 * inside any longer.
 */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROTARY,
  STRATEGY_LABELS,
  angularSeparation,
  componentsBeyondOneCycle,
  componentsInside,
  componentsStretchedBeyondDouble,
  effectiveLength,
  frequencyLadder,
  inRangeDistance,
  ladderTable,
  longContextReport,
  positionCompression,
  relativeAngles,
  requiredScale,
  resolutionRetained,
  scaledFrequencies,
  wavelengthLadder,
} from './contextScaling'

const TARGET = 32_768
const SCALE = requiredScale(DEFAULT_ROTARY.trainedLength, TARGET)

describe('the rotary ladder', () => {
  it('starts at one radian per step and falls by a factor of ten every half the head', () => {
    const ladder = frequencyLadder(DEFAULT_ROTARY.theta, DEFAULT_ROTARY.headDim)
    expect(ladder).toHaveLength(64)
    expect(ladder[0]).toBe(1)
    // θ^(-2·32/128) = 10000^(-1/2) = 0.01, exactly, by construction of the base.
    expect(ladder[32]).toBeCloseTo(0.01, 12)
    expect(ladder[63]).toBeCloseTo(Math.pow(10_000, -126 / 128), 12)
    for (let index = 1; index < ladder.length; index++) expect(ladder[index]).toBeLessThan(ladder[index - 1])
  })

  it('turns a frequency into a wavelength that grows with the index', () => {
    const waves = wavelengthLadder(frequencyLadder(DEFAULT_ROTARY.theta, DEFAULT_ROTARY.headDim))
    expect(waves[0]).toBeCloseTo(2 * Math.PI, 10)
    expect(waves[32]).toBeCloseTo(200 * Math.PI, 8)
    expect(waves[63]).toBeGreaterThan(waves[0])
  })

  it('leaves eighteen components that never finish a rotation inside the training window', () => {
    // Hand-worked: the wavelength is 2π·θ^(2i/d), which first exceeds 4096 at
    // i = d·ln(4096/2π)/(2·ln θ) = 45.0…, so i = 46…63 are the eighteen that never cycle.
    expect(componentsBeyondOneCycle(DEFAULT_ROTARY)).toBe(18)
    const waves = wavelengthLadder(frequencyLadder(DEFAULT_ROTARY.theta, DEFAULT_ROTARY.headDim))
    expect(waves[45]).toBeLessThanOrEqual(4096)
    expect(waves[46]).toBeGreaterThan(4096)
  })
})

describe('the scale a target window asks for', () => {
  it('is (N−1)/(L−1), not N/L, because a window of N tokens asks for distances to N−1', () => {
    expect(SCALE).toBeCloseTo(32_767 / 4_095, 12)
    expect(SCALE).toBeGreaterThan(8)
    expect(positionCompression('interpolation', SCALE)).toBe(SCALE)
    expect(positionCompression('ntk', SCALE)).toBe(1)
    expect(positionCompression('none', SCALE)).toBe(1)
  })

  it('maps the last distance of the target exactly onto the last distance of training', () => {
    const angles = relativeAngles(TARGET - 1, DEFAULT_ROTARY, 'interpolation', SCALE)
    const trained = frequencyLadder(DEFAULT_ROTARY.theta, DEFAULT_ROTARY.headDim).map((f) => 4095 * f)
    for (let index = 0; index < angles.length; index++) expect(angles[index]).toBeCloseTo(trained[index], 6)
  })
})

describe('the distance every component is still inside', () => {
  it('is the trained length with no strategy and the scale times it with interpolation', () => {
    expect(inRangeDistance(DEFAULT_ROTARY, 'none', SCALE)).toBeCloseTo(4095, 6)
    expect(effectiveLength(DEFAULT_ROTARY, 'none', SCALE)).toBeCloseTo(4096, 6)
    expect(inRangeDistance(DEFAULT_ROTARY, 'interpolation', SCALE)).toBeCloseTo(4095 * SCALE, 4)
    expect(effectiveLength(DEFAULT_ROTARY, 'interpolation', SCALE)).toBeCloseTo(TARGET, 4)
  })

  it('does not grow under NTK, because the fastest component is never rescaled', () => {
    expect(scaledFrequencies(DEFAULT_ROTARY, 'ntk', SCALE)[0]).toBe(1)
    expect(effectiveLength(DEFAULT_ROTARY, 'ntk', SCALE)).toBeCloseTo(4096, 6)
  })

  it('counts all sixty-four components inside at the target under interpolation and none outside it', () => {
    expect(componentsInside(TARGET - 1, DEFAULT_ROTARY, 'interpolation', SCALE)).toBe(64)
    expect(componentsInside(TARGET - 1, DEFAULT_ROTARY, 'none', SCALE)).toBe(0)
    expect(componentsInside(TARGET - 1, DEFAULT_ROTARY, 'ntk', SCALE)).toBe(1)
    // Plain interpolation rescales every component by the same factor, so the guarantee is
    // uniform: one token past the target and no component is inside at all.
    expect(componentsInside(TARGET, DEFAULT_ROTARY, 'interpolation', SCALE)).toBe(0)
  })
})

describe('what each strategy costs', () => {
  it('measures one step of distance as the angular work it does', () => {
    expect(angularSeparation([0, 0, 0])).toBe(0)
    expect(angularSeparation([Math.PI])).toBeCloseTo(2, 12)
    expect(angularSeparation([Math.PI / 2])).toBeCloseTo(1, 12)
  })

  it('leaves full resolution to strategies that do not touch positions', () => {
    expect(resolutionRetained(DEFAULT_ROTARY, 'none', SCALE)).toBeCloseTo(1, 12)
    expect(resolutionRetained(DEFAULT_ROTARY, 'interpolation', SCALE)).toBeLessThan(0.02)
    expect(resolutionRetained(DEFAULT_ROTARY, 'ntk', SCALE)).toBeGreaterThan(0.8)
  })

  it('loses a little more than one over the scale squared, because the fastest plane is not small-angle', () => {
    const retained = resolutionRetained(DEFAULT_ROTARY, 'interpolation', SCALE)
    expect(retained).toBeGreaterThan(1 / (SCALE * SCALE))
    expect(retained).toBeLessThan(1.1 / (SCALE * SCALE))
  })

  it('stretches wavelengths under NTK and under nothing else', () => {
    // Interpolation moves positions, so no wavelength in the ladder changes at all.
    expect(componentsStretchedBeyondDouble(DEFAULT_ROTARY, 'interpolation', SCALE)).toBe(0)
    expect(componentsStretchedBeyondDouble(DEFAULT_ROTARY, 'none', SCALE)).toBe(0)
    expect(componentsStretchedBeyondDouble(DEFAULT_ROTARY, 'ntk', SCALE)).toBe(43)
  })
})

describe('the report the screen renders', () => {
  it('lists the three strategies against one scale and one target', () => {
    const report = longContextReport(DEFAULT_ROTARY, TARGET)
    expect(report.scale).toBeCloseTo(32_767 / 4_095, 12)
    expect(report.totalComponents).toBe(64)
    expect(report.beyondOneCycle).toBe(18)
    expect(report.rows.map((row) => row.strategy)).toEqual(['none', 'interpolation', 'ntk'])
    expect(report.rows.map((row) => row.label)).toEqual(Object.values(STRATEGY_LABELS))
    expect(report.rows[1].insideAtTarget).toBe(64)
    expect(report.rows[1].effectiveLength).toBeCloseTo(TARGET, 4)
    expect(report.rows[2].stretched).toBe(43)
  })

  it('keeps the same shape at a harder target, and pays more for it', () => {
    const report = longContextReport(DEFAULT_ROTARY, 131_072)
    const easier = longContextReport(DEFAULT_ROTARY, TARGET)
    expect(report.scale).toBeCloseTo(131_071 / 4_095, 12)
    expect(report.rows[1].insideAtTarget).toBe(64)
    expect(report.rows[1].effectiveLength).toBeCloseTo(131_072, 4)
    expect(report.rows[1].resolution).toBeLessThan(easier.rows[1].resolution)
    expect(report.rows[2].stretched).toBeGreaterThan(easier.rows[2].stretched)
    expect(report.rows[0].effectiveLength).toBeCloseTo(4096, 6)
  })

  it('shows the ladder as the screen lists it: interpolation multiplies every wavelength', () => {
    const table = ladderTable(DEFAULT_ROTARY, SCALE)
    expect(table).toHaveLength(64)
    expect(table[0].trained).toBeCloseTo(2 * Math.PI, 10)
    expect(table[0].interpolated).toBeCloseTo(2 * Math.PI * SCALE, 6)
    expect(table[0].ntk).toBeCloseTo(table[0].trained, 10)
    for (const row of table) expect(row.ntk).toBeGreaterThanOrEqual(row.trained)
  })
})
