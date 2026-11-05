/**
 * Quantisation, and where the error comes from.
 *
 * A model in eight bits is a model whose numbers have been replaced by the
 * nearest point on a coarse grid. The grid is uniform, so its spacing has to
 * be chosen: too wide and the small values are flattened to zero, too narrow
 * and the largest value cannot be represented at all. One spacing per tensor
 * is the cheap choice and one per channel is the careful one, and the
 * difference between them is not a matter of taste — it is a number, and it is
 * dominated by whichever channel has the widest range.
 *
 * In a trained language model that channel usually exists, and it is not a
 * wide range by accident: a few dimensions of the activation space carry
 * values an order of magnitude larger than the rest. Quantising the weights
 * around them is what fails. SmoothQuant's observation is that the product
 * does not care where the scale sits, so the scale can be *moved* — divided
 * out of the activations and multiplied into the weights — and the outliers
 * go to the half of the pair that can absorb them.
 *
 * Both the error and the migration are arithmetic, and this module does them.
 */

import { createRng } from '@llm-materials/course-core'
import type { Matrix } from './attention'

/** The largest absolute value in a vector. */
export function maxAbs(values: number[]): number {
  let worst = 0
  for (const value of values) if (Math.abs(value) > worst) worst = Math.abs(value)
  return worst
}

/** The representable magnitude of an n-bit symmetric signed quantiser. */
export function quantiserLevels(bits: number): number {
  return 2 ** (bits - 1) - 1
}

/** The grid spacing a symmetric quantiser uses for a range. */
export function quantisationStep(range: number, bits: number): number {
  const levels = quantiserLevels(bits)
  return levels <= 0 ? Number.POSITIVE_INFINITY : range / levels
}

/** One value onto the grid and back. */
export function quantiseValue(value: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) return value
  return Math.round(value / step) * step
}

/** The root-mean-square error of a vector against its own quantisation. */
export function quantisationError(values: number[], step: number): number {
  if (values.length === 0) return 0
  let sum = 0
  for (const value of values) {
    const difference = value - quantiseValue(value, step)
    sum += difference * difference
  }
  return Math.sqrt(sum / values.length)
}

export interface TensorQuantisation {
  /** The spacing of the single grid. */
  step: number
  /** The largest value the grid can hold, which is what the outliers exceed. */
  representable: number
  error: number
  /**
   * How many times wider the grid is than one sized for a typical channel.
   *
   * This is the cost the outlier channel imposes: a grid wide enough for the
   * widest channel is that many times too coarse for the ordinary ones, and
   * their values are quantised against it however small they are.
   */
  resolutionCost: number
}

/** Quantise a whole matrix with one grid: the per-tensor scheme. */
export function perTensorQuantisation(matrix: Matrix, bits: number): TensorQuantisation {
  const flat = matrix.flat()
  const range = maxAbs(flat)
  const step = quantisationStep(range, bits)
  const channelMaxima = columnChannels(matrix).map(maxAbs).sort((a, b) => a - b)
  const middle = Math.floor(channelMaxima.length / 2)
  const medianChannelRange =
    channelMaxima.length === 0
      ? range
      : channelMaxima.length % 2 === 1
        ? (channelMaxima[middle] ?? range)
        : ((channelMaxima[middle - 1] ?? 0) + (channelMaxima[middle] ?? 0)) / 2
  const typicalStep = quantisationStep(medianChannelRange, bits)
  return {
    step,
    representable: quantiserLevels(bits) * step,
    error: quantisationError(flat, step),
    resolutionCost: typicalStep <= 0 ? 1 : step / typicalStep,
  }
}

export interface ChannelQuantisation {
  /** One spacing per channel. */
  steps: number[]
  error: number
  /** The largest of the per-channel errors, which is what a kernel pays for. */
  worstChannel: number
  /** The widest spacing of them all, which is the one the outlier channel needs. */
  widestStep: number
}

/**
 * Quantise each channel with its own grid: the per-channel scheme.
 *
 * The channels are the columns by default, which is the layout that matters —
 * a weight matrix's columns are the input dimensions, and the activations are
 * vectors along them. `axis: 'row'` reads them the other way.
 *
 * A grid sized to its own channel never clips, which is the whole of the
 * scheme's advantage and the whole of its cost: the advantage is that the
 * ordinary channels are quantised against their own width, and the cost is one
 * scale to store and a kernel that has to apply it.
 */
export function perChannelQuantisation(
  matrix: Matrix,
  bits: number,
  options: { axis?: 'row' | 'column' } = {},
): ChannelQuantisation {
  const axis = options.axis ?? 'column'
  const channels = axis === 'column' ? columnChannels(matrix) : matrix.map((row) => [...row])
  const steps = channels.map((channel) => quantisationStep(maxAbs(channel), bits))
  const errors = channels.map((channel, index) => quantisationError(channel, steps[index] ?? Number.POSITIVE_INFINITY))
  const counts = channels.map((channel) => channel.length)
  const total = counts.reduce((a, b) => a + b, 0)
  const squared = errors.reduce((sum, error, index) => sum + error * error * (counts[index] ?? 0), 0)
  return {
    steps,
    error: total === 0 ? 0 : Math.sqrt(squared / total),
    worstChannel: errors.length === 0 ? 0 : Math.max(...errors),
    widestStep: steps.length === 0 ? 0 : Math.max(...steps),
  }
}

/**
 * Quantise with one grid per group of `groupSize` channels.
 *
 * This is the compromise every 4-bit library actually ships: per-channel is
 * too many scales to be worth it once the weights are tiny, and per-tensor
 * cannot survive the outliers, so the grid is chosen per group. The error
 * falls as the groups get smaller, and the storage for the scales rises.
 */
export function groupedQuantisation(
  matrix: Matrix,
  bits: number,
  groupSize: number,
): { error: number; scales: number; steps: number[] } {
  const columns = columnChannels(matrix)
  const width = columns.length
  const groups = Math.max(1, Math.ceil(width / Math.max(1, groupSize)))
  const steps: number[] = []
  let squared = 0
  let count = 0
  for (let g = 0; g < groups; g++) {
    const slice = columns.slice(g * groupSize, (g + 1) * groupSize).flat()
    const step = quantisationStep(maxAbs(slice), bits)
    steps.push(step)
    for (const value of slice) {
      const difference = value - quantiseValue(value, step)
      squared += difference * difference
      count++
    }
  }
  return { error: count === 0 ? 0 : Math.sqrt(squared / count), scales: groups, steps }
}

function columnChannels(matrix: Matrix): number[][] {
  const width = matrix[0]?.length ?? 0
  return Array.from({ length: width }, (_, j) => matrix.map((row) => row[j] ?? 0))
}

export interface OutlierReport {
  /** The largest magnitude of each channel. */
  channelMax: number[]
  /** The median of those, which is the width an ordinary channel has. */
  medianMax: number
  /** The widest channel divided by the median: the outlier ratio. */
  ratio: number
  /** The index of the widest channel. */
  index: number
}

/**
 * Find the channel that makes per-tensor quantisation fail.
 *
 * The statistic is the widest channel over the median one, because a single
 * channel that is twenty times wider than the rest is a single channel that
 * costs the whole tensor its resolution: the one grid has to be wide enough for
 * it, and everything else is quantised against that spacing.
 */
export function outlierChannels(matrix: Matrix): OutlierReport {
  const channelMax = columnChannels(matrix).map(maxAbs)
  const sorted = [...channelMax].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const medianMax =
    sorted.length === 0
      ? 0
      : sorted.length % 2 === 1
        ? (sorted[middle] ?? 0)
        : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
  let index = 0
  for (let i = 1; i < channelMax.length; i++) if ((channelMax[i] ?? 0) > (channelMax[index] ?? 0)) index = i
  return {
    channelMax,
    medianMax,
    ratio: medianMax === 0 ? 0 : (channelMax[index] ?? 0) / medianMax,
    index,
  }
}

/**
 * The SmoothQuant scales.
 *
 * `s_j = max|X_j|^α / max|W_j|^(1−α)`, and the pair (X/s, W·s) is the same
 * product as (X, W) — dividing a column of the activations and multiplying the
 * matching row of the weights leaves every dot product alone. α chooses how
 * much of the width moves: at one the activations are made uniform and the
 * weights take all of it, at zero the reverse, and the paper's finding is that
 * a half works because the weights are the half that can be re-scaled without
 * losing anything.
 */
export function smoothScales(
  activations: Matrix,
  weights: Matrix,
  alpha: number,
): number[] {
  const activationMax = columnChannels(activations).map(maxAbs)
  // The weights are stored as [output, input], so the input dimension j is the
  // column j of W: one scale per activation column is one scale per weight
  // column, which is the pairing the product requires.
  const weightMax = columnChannels(weights).map(maxAbs)
  const width = Math.min(activationMax.length, weightMax.length)
  return Array.from({ length: width }, (_, j) => {
    const x = activationMax[j] ?? 0
    const w = weightMax[j] ?? 0
    if (x === 0 && w === 0) return 1
    // A zero in either half would make the scale zero or infinite; a factor
    // that small only happens in a channel nothing uses, so leave it alone.
    const numerator = x ** alpha
    const denominator = w ** (1 - alpha)
    const scale = denominator === 0 ? 1 : numerator / denominator
    return Number.isFinite(scale) && scale > 0 ? scale : 1
  })
}

/** Divide the activations' columns by the scales. */
export function smoothActivations(activations: Matrix, scales: number[]): Matrix {
  return activations.map((row) => row.map((value, j) => value / (scales[j] ?? 1)))
}

/** Multiply the weights' input rows by the scales. */
export function smoothWeights(weights: Matrix, scales: number[]): Matrix {
  return weights.map((row) => row.map((value, j) => value * (scales[j] ?? 1)))
}

export interface SmoothQuantResult {
  alpha: number
  scales: number[]
  /** The error on the activations, quantised per tensor after the migration. */
  activationError: number
  /** The same for the weights. */
  weightError: number
  /** The two added, which is the curve the choice of α is made against. */
  totalError: number
  /** How much wider than the median the activation's worst channel still is. */
  activationOutlierRatio: number
  /** The same for the weights. */
  weightOutlierRatio: number
}

/**
 * Migrate the outliers by α and quantise both halves per tensor.
 *
 * The two error columns are the whole argument. Push α up and the activations
 * become flat — the outlier ratio falls towards one — and the weights inherit
 * the width and their error rises. Push it down and the reverse. Neither half
 * can be left with the outliers, because a per-tensor grid on a tensor with an
 * outlier is a per-tensor grid that cannot see the other ninety per cent of
 * the values.
 */
export function smoothQuant(
  activations: Matrix,
  weights: Matrix,
  alpha: number,
  options: { bits?: number } = {},
): SmoothQuantResult {
  const bits = options.bits ?? 8
  const scales = smoothScales(activations, weights, alpha)
  const smoothedActivations = smoothActivations(activations, scales)
  const smoothedWeights = smoothWeights(weights, scales)
  const activationError = perTensorQuantisation(smoothedActivations, bits).error
  const weightError = perTensorQuantisation(smoothedWeights, bits).error
  return {
    alpha,
    scales,
    activationError,
    weightError,
    totalError: activationError + weightError,
    activationOutlierRatio: outlierChannels(smoothedActivations).ratio,
    weightOutlierRatio: outlierChannels(smoothedWeights).ratio,
  }
}

/** The same migration across a grid of α, which is the curve the choice is read from. */
export function smoothQuantSweep(
  activations: Matrix,
  weights: Matrix,
  options: { bits?: number; alphas?: number[] } = {},
): SmoothQuantResult[] {
  const alphas = options.alphas ?? [0, 0.25, 0.5, 0.75, 1]
  return alphas.map((alpha) => smoothQuant(activations, weights, alpha, options))
}

/** The error of quantising both halves without migrating anything, for the comparison. */
export function unsmoothedError(
  activations: Matrix,
  weights: Matrix,
  options: { bits?: number } = {},
): { activationError: number; weightError: number; totalError: number } {
  const bits = options.bits ?? 8
  const activationError = perTensorQuantisation(activations, bits).error
  const weightError = perTensorQuantisation(weights, bits).error
  return { activationError, weightError, totalError: activationError + weightError }
}

/** The product of an activation row and a weight column: the thing that must not change. */
export function dotProducts(activations: Matrix, weights: Matrix): number[][] {
  const inputs = weights[0]?.length ?? 0
  const outputs = weights.length
  return activations.map((row) =>
    Array.from({ length: outputs }, (_, o) => {
      let total = 0
      for (let j = 0; j < inputs; j++) total += (row[j] ?? 0) * (weights[o]?.[j] ?? 0)
      return total
    }),
  )
}

/** The largest relative difference between two matrices. */
export function relativeDifference(a: Matrix, b: Matrix): number {
  let worst = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    for (let j = 0; j < Math.min(a[i]?.length ?? 0, b[i]?.length ?? 0); j++) {
      const x = a[i]?.[j] ?? 0
      const y = b[i]?.[j] ?? 0
      const scale = Math.max(Math.abs(x), Math.abs(y), 1e-12)
      worst = Math.max(worst, Math.abs(x - y) / scale)
    }
  }
  return worst
}

/**
 * The NF4 codebook.
 *
 * A 4-bit quantiser has sixteen levels, and where they sit is a choice. The
 * NormalFloat4 choice is to put them at the quantiles of a standard normal, so
 * that a weight drawn from the usual bell curve is as close to a level as the
 * sixteen allow. The values below are the paper's, quoted: they are a constant
 * of the method rather than something derived here, and the construction that
 * produces them — the midpoints of the normal's equal-probability bins, mirrored
 * about zero and rescaled — is not reproduced in this file.
 *
 * What *is* checkable is the shape the construction is meant to have and the
 * error it buys: sixteen increasing levels spanning [-1, 1], with a zero,
 * bunched near zero where the bell puts its mass and spread apart at the ends
 * where almost nothing is, and on bell-shaped weights less error than the even
 * grid of the same width — a third less on a large sample, a quarter less on a
 * small one, because a small sample's range is set by its single largest draw
 * and that draw is what both grids have to be sized for. A quantiser that is
 * uniform where the data is dense and coarse where it is thin wastes levels,
 * and that is the whole of the improvement.
 */
export const NF4_CODEBOOK: readonly number[] = [
  -1.0, -0.6961928014755249, -0.5250730514526367, -0.3949174904823303, -0.284441381692981,
  -0.18477343022823334, -0.09105003625154495, 0.0, 0.07958029954433441, 0.1609762442111969,
  0.24611230492591858, 0.33791524159908295, 0.4407098298072815, 0.5626170063972473,
  0.7229568374156952, 1.0,
]

/** The nearest codebook level to a value in the normalised range [-1, 1]. */
export function nearestLevel(value: number, codebook: readonly number[] = NF4_CODEBOOK): number {
  let best = codebook[0] ?? 0
  let bestDistance = Math.abs(value - best)
  for (const level of codebook) {
    const distance = Math.abs(value - level)
    if (distance < bestDistance) {
      best = level
      bestDistance = distance
    }
  }
  return best
}

export interface CodebookQuantisation {
  /** The root-mean-square error, in the values' own units. */
  error: number
  /** The spacing an even grid over the same range would have had. */
  uniformStep: number
  /** The error of that grid, which is the comparison the codebook is made against. */
  uniformError: number
}

/**
 * Quantise a tensor to NF4 and to an even grid, and report both errors.
 *
 * The values are normalised to their own absolute maximum first, which is the
 * block-wise part of QLoRA: each block of sixty-four weights gets its own
 * offset and scale, and the codebook is the same everywhere.
 *
 * The error is in the values' units rather than the normalised ones, because
 * that is the only comparison that means anything across two block sizes: a
 * grid scaled by a range of sixty and a grid scaled by a range of three both
 * have the same *relative* error, and only one of them is sixty times wrong.
 */
export function normalFloatError(values: number[]): CodebookQuantisation {
  const range = maxAbs(values)
  if (range === 0 || values.length === 0) {
    return { error: 0, uniformStep: 0, uniformError: 0 }
  }
  const step = quantisationStep(range, 4)
  let normalSum = 0
  let uniformSum = 0
  for (const value of values) {
    const normal = value - nearestLevel(value / range) * range
    normalSum += normal * normal
    const uniform = value - quantiseValue(value, step)
    uniformSum += uniform * uniform
  }
  return {
    error: Math.sqrt(normalSum / values.length),
    uniformStep: step,
    uniformError: Math.sqrt(uniformSum / values.length),
  }
}

/** The same, in the block sizes QLoRA uses. */
export function blockedNormalFloatError(values: number[], blockSize: number): number {
  let sum = 0
  let count = 0
  for (let start = 0; start < values.length; start += blockSize) {
    const block = values.slice(start, start + blockSize)
    const range = maxAbs(block)
    for (const value of block) {
      const difference = range === 0 ? value : value - nearestLevel(value / range) * range
      sum += difference * difference
      count++
    }
  }
  return count === 0 ? 0 : Math.sqrt(sum / count)
}

/** A synthetic activation matrix with a planted outlier channel, for the laboratory. */
export function activationsWithOutlier(
  rows: number,
  width: number,
  options: { seed?: number; outlierIndex?: number; outlierScale?: number } = {},
): Matrix {
  const settings = { seed: 5, outlierIndex: 3, outlierScale: 20, ...options }
  const rng = createRng(settings.seed)
  const matrix: Matrix = []
  for (let i = 0; i < rows; i++) {
    const row = Array.from({ length: width }, () => rng() * 2 - 1)
    row[settings.outlierIndex] = (rng() * 2 - 1) * settings.outlierScale
    matrix.push(row)
  }
  return matrix
}

/**
 * A weight matrix drawn from the bell curve the papers assume, with no planted
 * outliers.
 *
 * Box and Muller turn two uniforms into one normal, which keeps this module free
 * of a distribution library. A trained weight is not exactly normal, and the
 * shape is not the point: the point is that it has *tails*, because a bounded
 * bell of the same width is the case that flatters an even grid — and the tails
 * are exactly where a uniform quantiser puts its levels it never uses.
 */
export function gaussianMatrix(rows: number, width: number, seed: number): Matrix {
  const rng = createRng(seed)
  const normal = () => {
    const u1 = Math.max(rng(), 1e-12)
    const u2 = rng()
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }
  return Array.from({ length: rows }, () => Array.from({ length: width }, () => normal()))
}
