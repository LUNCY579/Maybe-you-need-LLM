/**
 * Latent diffusion.
 *
 * Rombach et al. (2022) did not improve the diffusion model; they moved it.
 * Instead of denoising pixels, an autoencoder compresses the data into a lower
 * dimensional latent space, and the diffusion model runs there. The saving is
 * roughly quadratic in the compression factor, because both the number of
 * spatial positions and the number of channels per position shrink.
 *
 * The laboratory trains a real linear autoencoder — the principal components
 * of the data — so that the reconstruction error and the compression ratio are
 * measured rather than quoted, and then shows why the latent space has to be
 * rescaled before a diffusion model is run on it.
 */

import { jacobiEigen } from '@llm-materials/course-core'
import type { Matrix, Vector } from '@llm-materials/course-core'
import { mean, variance } from '@llm-materials/course-core'

export interface Autoencoder {
  /** The principal axes, one per retained component, as unit vectors. */
  components: Vector[]
  /** The mean of the data, subtracted before projecting. */
  mean: Vector
  /** The variance explained by each retained component. */
  explainedVariance: number[]
  /** The fraction of the total variance retained. */
  explainedVarianceRatio: number
  /** The dimension of the data. */
  inputDimension: number
  /** The dimension of the latent space. */
  latentDimension: number
}

/**
 * Fit a principal-component autoencoder.
 *
 * The components are the leading eigenvectors of the data covariance, so the
 * encoder is the orthogonal projection onto the principal subspace and the
 * decoder is the matching reconstruction.
 */
export function fitAutoencoder(data: Vector[], latentDimension: number): Autoencoder {
  if (data.length === 0) throw new Error('fitAutoencoder: no data')
  const dimension = data[0].length
  const k = Math.min(latentDimension, dimension)

  const centre = new Array<number>(dimension).fill(0)
  for (const point of data) {
    for (let d = 0; d < dimension; d++) centre[d] += point[d]
  }
  for (let d = 0; d < dimension; d++) centre[d] /= data.length

  const covariance: Matrix = Array.from({ length: dimension }, () => new Array<number>(dimension).fill(0))
  for (const point of data) {
    for (let i = 0; i < dimension; i++) {
      const di = point[i] - centre[i]
      for (let j = 0; j < dimension; j++) {
        covariance[i][j] += di * (point[j] - centre[j])
      }
    }
  }
  for (let i = 0; i < dimension; i++) {
    for (let j = 0; j < dimension; j++) covariance[i][j] /= Math.max(1, data.length - 1)
  }

  const { values, vectors } = jacobiEigen(covariance)
  // jacobiEigen returns ascending eigenvalues; the principal components are the
  // last ones.
  const components = vectors.slice(dimension - k).map((vector) => {
    const norm = Math.sqrt(vector.reduce((acc, v) => acc + v * v, 0)) || 1
    return vector.map((v) => v / norm)
  })

  const totalVariance = values.reduce((acc, v) => acc + Math.max(0, v), 0)
  const explainedVariance = components.map((_, i) => Math.max(0, values[dimension - k + i]))
  const explainedVarianceRatio =
    totalVariance > 0 ? explainedVariance.reduce((a, b) => a + b, 0) / totalVariance : 0

  return {
    components,
    mean: centre,
    explainedVariance,
    explainedVarianceRatio,
    inputDimension: dimension,
    latentDimension: k,
  }
}

/** Encode a point into the latent space. */
export function encode(autoencoder: Autoencoder, point: Vector): Vector {
  const centred = point.map((value, i) => value - (autoencoder.mean[i] ?? 0))
  return autoencoder.components.map((component) =>
    component.reduce((acc, weight, i) => acc + weight * (centred[i] ?? 0), 0),
  )
}

/** Decode a latent point back into the data space. */
export function decode(autoencoder: Autoencoder, latent: Vector): Vector {
  const centred = new Array<number>(autoencoder.inputDimension).fill(0)
  for (let c = 0; c < autoencoder.components.length; c++) {
    const component = autoencoder.components[c]
    const value = latent[c] ?? 0
    for (let d = 0; d < component.length; d++) centred[d] += component[d] * value
  }
  return centred.map((value, i) => value + (autoencoder.mean[i] ?? 0))
}

/** The mean squared reconstruction error of an autoencoder over a dataset. */
export function reconstructionError(autoencoder: Autoencoder, data: Vector[]): number {
  if (data.length === 0) return 0
  const dimension = autoencoder.inputDimension
  let total = 0
  for (const point of data) {
    const reconstructed = decode(autoencoder, encode(autoencoder, point))
    for (let d = 0; d < dimension; d++) {
      total += (point[d] - (reconstructed[d] ?? 0)) ** 2
    }
  }
  return total / (data.length * dimension)
}

/**
 * The variance of the latent coordinates.
 *
 * This is the number the diffusion model cares about. The forward process
 * assumes data with roughly unit variance, so a latent space with a different
 * scale has to be rescaled — which is exactly what Rombach et al. do with their
 * factor of 0.18215.
 */
export function latentVariances(autoencoder: Autoencoder, data: Vector[]): number[] {
  const latents = data.map((point) => encode(autoencoder, point))
  if (latents.length === 0) return []
  const variances: number[] = []
  for (let c = 0; c < autoencoder.latentDimension; c++) {
    variances.push(variance(latents.map((latent) => latent[c] ?? 0)))
  }
  return variances
}

/** The scaling factor that makes the latents have unit variance. */
export function unitVarianceScale(autoencoder: Autoencoder, data: Vector[]): number {
  const variances = latentVariances(autoencoder, data)
  const meanVariance = mean(variances)
  return meanVariance > 0 ? 1 / Math.sqrt(meanVariance) : 1
}

/**
 * The compression a latent diffusion model buys.
 *
 * The paper's argument is in FLOPs and in memory, and both scale with the
 * spatial size of the latent times its channel count. This function returns
 * the factor by which the diffusion cost falls for a given compression.
 */
export interface CompressionSaving {
  /** The compression factor f of the autoencoder. */
  compressionFactor: number
  /** The ratio of the latent's spatial size to the image's. */
  spatialRatio: number
  /** The total reduction in the elements the diffusion model works on. */
  elementRatio: number
  /** The reduction in the attention cost, which is quadratic in the tokens. */
  attentionRatio: number
}

export function compressionSaving(
  imageHeight: number,
  imageWidth: number,
  channels: number,
  compressionFactor: number,
  latentChannels: number,
): CompressionSaving {
  const pixelElements = imageHeight * imageWidth * channels
  const latentSide = imageHeight / compressionFactor
  const latentElements = latentSide * latentSide * latentChannels
  const spatialRatio = latentSide / imageHeight
  const elementRatio = latentElements / pixelElements
  const attentionRatio = elementRatio * spatialRatio * spatialRatio
  return {
    compressionFactor,
    spatialRatio,
    elementRatio,
    attentionRatio,
  }
}
