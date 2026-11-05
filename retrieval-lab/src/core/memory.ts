/**
 * The two kinds of memory a retrieval-augmented system has.
 *
 * A generative model keeps what it knows in its weights, and an index keeps
 * what it knows in vectors. The two are bought and maintained differently,
 * and this module does the arithmetic: how many bytes each one costs at a
 * given size, and the corpus size at which the index costs as much as the
 * model.
 *
 * The numbers are a sizing model, not a benchmark: parameters and vectors are
 * counted exactly, and the bytes per value are the precision the caller picks.
 */

export interface MemorySizes {
  /** The parameters of the generative model. */
  parameters: number
  /** The bytes one parameter occupies. */
  bytesPerParameter: number
  /** The passages in the index. */
  passages: number
  /** The width of one passage vector. */
  dimension: number
  /** The bytes one vector coordinate occupies. */
  bytesPerValue: number
}

const DEFAULTS: MemorySizes = {
  parameters: 7e9,
  bytesPerParameter: 2,
  passages: 21e6,
  dimension: 768,
  bytesPerValue: 4,
}

export interface MemoryReport {
  /** The bytes the model's weights occupy. */
  parametricBytes: number
  /** The bytes the passage vectors occupy. */
  nonParametricBytes: number
  parametricGB: number
  nonParametricGB: number
  /** The index's size divided by the model's. */
  ratio: number
  /** The number of passages at which the two are equal. */
  crossoverPassages: number
}

/** The bytes the weights occupy. */
export function parametricMemory(parameters: number, bytesPerParameter = 2): number {
  if (!Number.isFinite(parameters) || parameters <= 0) throw new RangeError('parameters must be positive')
  if (!Number.isFinite(bytesPerParameter) || bytesPerParameter <= 0) {
    throw new RangeError('bytesPerParameter must be positive')
  }
  return parameters * bytesPerParameter
}

/** The bytes the vectors occupy. */
export function indexMemory(passages: number, dimension: number, bytesPerValue = 4): number {
  if (!Number.isFinite(passages) || passages <= 0) throw new RangeError('passages must be positive')
  if (!Number.isFinite(dimension) || dimension <= 0) throw new RangeError('dimension must be positive')
  if (!Number.isFinite(bytesPerValue) || bytesPerValue <= 0) throw new RangeError('bytesPerValue must be positive')
  return passages * dimension * bytesPerValue
}

/** The bill for both memories, and where they cross over. */
export function memoryReport(options: Partial<MemorySizes> = {}): MemoryReport {
  const settings = { ...DEFAULTS, ...options }
  const parametricBytes = parametricMemory(settings.parameters, settings.bytesPerParameter)
  const nonParametricBytes = indexMemory(settings.passages, settings.dimension, settings.bytesPerValue)
  return {
    parametricBytes,
    nonParametricBytes,
    parametricGB: parametricBytes / 1e9,
    nonParametricGB: nonParametricBytes / 1e9,
    ratio: nonParametricBytes / parametricBytes,
    crossoverPassages: parametricBytes / (settings.dimension * settings.bytesPerValue),
  }
}
