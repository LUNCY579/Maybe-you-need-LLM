/**
 * Position interpolation and the effective context length — the long-context arm of
 * Laboratory E.
 *
 * A decoder's rotary embedding multiplies the query and key at relative distance `D` by
 * rotations of `D · f_i` radians, one per frequency component, where the ladder is
 * `f_i = θ^(-2i/d)` for `i = 0 … d/2 − 1`. Training on a window of length `L` therefore
 * shows the model angles only up to `(L − 1) · f_i` in each component. A longer context
 * asks for angles in components the model has never turned through — and a component that
 * has never completed a full rotation inside the training window cannot have been learned
 * at all. This module counts both of those things exactly, from the ladder alone.
 *
 * Three strategies are compared, all of them arithmetic on the same ladder:
 *
 *  - `none` — plain extrapolation. Nothing changes, so every component leaves its trained
 *    range the moment the distance passes `L − 1`.
 *  - `interpolation` — position interpolation (Chen et al., 2023): divide the position by
 *    `s = N / L` before rotating. The angle a distance `D` needs becomes `(D/s) · f_i`, so
 *    the distance at which every component is still inside the trained range is exactly
 *    `s · (L − 1)`. That equality is the whole promise, and it is what this file computes.
 *  - `ntk` — NTK-aware scaling: leave the positions alone and raise the base to
 *    `θ · s^(d/(d-2))`, which shrinks the low-frequency rotations and leaves the
 *    high-frequency ones almost untouched.
 *
 * The two costs are deliberately kept apart, because a strategy can buy length by paying in
 * either currency. Interpolation compresses *positions*, so the angular work one step of
 * distance does — `Σ_i (1 − cos φ_i)` — falls by about `s²`, and neighbours become harder to
 * tell apart. NTK stretches *wavelengths*, so the ladder itself changes and some components
 * are pushed past the training length for the first time. Both are measured here, per
 * strategy, with no fitted constants.
 *
 * Everything is a closed-form calculation on a chosen ladder. Nothing is a measurement of a
 * real model, no accuracy number is claimed, and the screen says so.
 */

export interface RotarySetup {
  /** Head width `d`; the ladder has `d / 2` rotation planes. */
  readonly headDim: number
  /** The rotary base `θ`. */
  readonly theta: number
  /** The context length the model was trained on, in tokens. */
  readonly trainedLength: number
}

export const DEFAULT_ROTARY: RotarySetup = { headDim: 128, theta: 10_000, trainedLength: 4096 }

export type ScalingStrategy = 'none' | 'interpolation' | 'ntk'

export const STRATEGY_LABELS: Record<ScalingStrategy, string> = {
  none: 'Plain extrapolation',
  interpolation: 'Position interpolation',
  ntk: 'NTK-aware scaling',
}

/** The ladder `f_i = θ^(-2i/d)`, most rapidly rotating first. */
export function frequencyLadder(theta: number, headDim: number): number[] {
  return Array.from({ length: headDim / 2 }, (_, index) => Math.pow(theta, (-2 * index) / headDim))
}

/** The distance over which one component turns through a full circle. */
export function wavelengthLadder(frequencies: readonly number[]): number[] {
  return frequencies.map((frequency) => (2 * Math.PI) / frequency)
}

/** How far apart two ladder components are, in wavelengths, after the strategy is applied. */
export function scaledFrequencies(setup: RotarySetup, strategy: ScalingStrategy, scale: number): number[] {
  // The NTK exponent is d/(d−2), not d/(d−1): it is chosen so that the highest frequency
  // stays at 1 and the lowest is divided by the scale, which is the spread the derivation
  // in the source allows.
  const theta = strategy === 'ntk' ? setup.theta * Math.pow(scale, setup.headDim / (setup.headDim - 2)) : setup.theta
  return frequencyLadder(theta, setup.headDim)
}

/** Interpolation divides positions; NTK does not touch them. */
export function positionCompression(strategy: ScalingStrategy, scale: number): number {
  return strategy === 'interpolation' ? scale : 1
}

/**
 * The scale that maps a target window onto the trained one exactly.
 *
 * Lengths are counted in tokens and rotations in relative distances, and the largest
 * distance a window of `N` tokens ever asks for is `N − 1`. So the scale that puts the last
 * position of a target window exactly at the last position training saw is
 * `(N − 1) / (L − 1)`, not `N / L`. The difference is small but real: at 32,768 tokens from
 * a 4,096-token window, `N / L = 8` leaves the final seven positions one step outside the
 * trained range, and every component is judged by the worst one, so a screen that used `N / L`
 * would report zero components in range for the strategy whose whole point is to put them all
 * in range.
 */
export function requiredScale(trainedLength: number, targetLength: number): number {
  return (targetLength - 1) / (trainedLength - 1)
}

/** The angle a pair at relative distance `D` sweeps, one number per rotation plane. */
export function relativeAngles(
  distance: number,
  setup: RotarySetup,
  strategy: ScalingStrategy,
  scale: number,
): number[] {
  const compressed = distance / positionCompression(strategy, scale)
  return scaledFrequencies(setup, strategy, scale).map((frequency) => compressed * frequency)
}

/**
 * The largest distance at which every component still shows an angle no bigger than the one
 * training showed at the end of its window.
 *
 * Component `i` was turned through at most `(L − 1) · f_i` during training. At distance `D`
 * under a strategy it turns through `(D / c) · f'_i`, so the component stays inside while
 * `D ≤ (L − 1) · f_i · c / f'_i`, and the binding component sets the limit. For plain
 * interpolation `f'_i = f_i` and `c = s`, so the limit is exactly `s · (L − 1)`; for NTK
 * `c = 1` and the first component has `f'_0 = f_0 = 1`, so the limit is the trained length
 * itself — the highest frequency is never rescaled, and it is the first to extrapolate.
 */
export function inRangeDistance(setup: RotarySetup, strategy: ScalingStrategy, scale: number): number {
  const trained = setup.trainedLength - 1
  const trainedLadder = frequencyLadder(setup.theta, setup.headDim)
  const after = scaledFrequencies(setup, strategy, scale)
  const compression = positionCompression(strategy, scale)
  let limit = Number.POSITIVE_INFINITY
  for (let index = 0; index < after.length; index++) {
    limit = Math.min(limit, (trained * trainedLadder[index] * compression) / after[index])
  }
  return limit
}

/** The same limit counted in tokens, which is what a context length is quoted in. */
export function effectiveLength(setup: RotarySetup, strategy: ScalingStrategy, scale: number): number {
  return inRangeDistance(setup, strategy, scale) + 1
}

/** How many of the `d / 2` components are still inside their trained range at `distance`. */
export function componentsInside(
  distance: number,
  setup: RotarySetup,
  strategy: ScalingStrategy,
  scale: number,
): number {
  const trained = setup.trainedLength - 1
  const trainedLadder = frequencyLadder(setup.theta, setup.headDim)
  const angles = relativeAngles(distance, setup, strategy, scale)
  let inside = 0
  for (let index = 0; index < angles.length; index++) {
    if (angles[index] <= trained * trainedLadder[index] + 1e-9) inside += 1
  }
  return inside
}

/**
 * The total angular work one step of distance does: `Σ_i (1 − cos φ_i)`.
 *
 * It is a resolution measure, not a distance: two adjacent tokens are distinguishable to the
 * rotary embedding only through the angles they differ by, and this sum is that difference.
 */
export function angularSeparation(angles: readonly number[]): number {
  return angles.reduce((total, angle) => total + (1 - Math.cos(angle)), 0)
}

/** What fraction of the un-scaled one-step separation a strategy leaves at the neighbour. */
export function resolutionRetained(setup: RotarySetup, strategy: ScalingStrategy, scale: number): number {
  const baseline = angularSeparation(relativeAngles(1, setup, 'none', 1))
  return angularSeparation(relativeAngles(1, setup, strategy, scale)) / baseline
}

/** Components whose wavelength is more than double what training showed — NTK's currency. */
export function componentsStretchedBeyondDouble(setup: RotarySetup, strategy: ScalingStrategy, scale: number): number {
  const before = frequencyLadder(setup.theta, setup.headDim)
  const after = scaledFrequencies(setup, strategy, scale)
  let stretched = 0
  for (let index = 0; index < before.length; index++) {
    if (after[index] < before[index] / 2 - 1e-12) stretched += 1
  }
  return stretched
}

/**
 * Components that never complete one rotation inside the training window.
 *
 * These are the ones the model cannot have learned positionally at all: their wavelength is
 * longer than the window. They are also exactly the components a long context leans on, so
 * the count is the size of the problem every strategy is trying to solve.
 */
export function componentsBeyondOneCycle(setup: RotarySetup): number {
  const wavelengths = wavelengthLadder(frequencyLadder(setup.theta, setup.headDim))
  return wavelengths.filter((wavelength) => wavelength > setup.trainedLength).length
}

export interface StrategyRow {
  readonly strategy: ScalingStrategy
  readonly label: string
  /** The largest distance with every component inside its trained range. */
  readonly effectiveLength: number
  /** How many components are inside that range at the requested target distance. */
  readonly insideAtTarget: number
  /** Fraction of the neighbour-to-neighbour angular separation the strategy leaves. */
  readonly resolution: number
  /** Components whose wavelength the strategy more than doubled. */
  readonly stretched: number
}

export interface LongContextReport {
  readonly scale: number
  readonly totalComponents: number
  readonly beyondOneCycle: number
  readonly rows: readonly StrategyRow[]
}

/** Everything the screen prints, computed in one pass from the setup and the target. */
export function longContextReport(setup: RotarySetup, targetLength: number): LongContextReport {
  const scale = requiredScale(setup.trainedLength, targetLength)
  const longestDistance = targetLength - 1
  const rows = (Object.keys(STRATEGY_LABELS) as ScalingStrategy[]).map((strategy) => ({
    strategy,
    label: STRATEGY_LABELS[strategy],
    effectiveLength: effectiveLength(setup, strategy, scale),
    insideAtTarget: componentsInside(longestDistance, setup, strategy, scale),
    resolution: resolutionRetained(setup, strategy, scale),
    stretched: componentsStretchedBeyondDouble(setup, strategy, scale),
  }))
  return {
    scale,
    totalComponents: setup.headDim / 2,
    beyondOneCycle: componentsBeyondOneCycle(setup),
    rows,
  }
}

/** The ladder as the screen lists it: index, wavelength, and the two rescaled wavelengths. */
export function ladderTable(
  setup: RotarySetup,
  scale: number,
): { index: number; trained: number; interpolated: number; ntk: number }[] {
  const before = frequencyLadder(setup.theta, setup.headDim)
  const ntk = scaledFrequencies(setup, 'ntk', scale)
  return before.map((frequency, index) => ({
    index,
    trained: (2 * Math.PI) / frequency,
    // Interpolation leaves the wavelength alone and divides the position instead, which is
    // the same thing as multiplying every wavelength by the scale.
    interpolated: ((2 * Math.PI) / frequency) * scale,
    ntk: (2 * Math.PI) / ntk[index],
  }))
}
