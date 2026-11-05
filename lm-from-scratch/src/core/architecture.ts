/**
 * The architecture, and what it costs.
 *
 * The point of this module is the *arithmetic*. A transformer is a small
 * number of matrices, and once you know the shapes you know:
 *
 * - how many parameters it has;
 * - how many floating-point operations a forward pass costs, and therefore a
 *   training step (which is roughly three forward passes' worth);
 * - how much memory the parameters, the gradients and the optimiser state
 *   take;
 * - and therefore whether the run is limited by the arithmetic or by the
 *   memory bandwidth.
 *
 * CS336's second lecture is exactly this, and it is the part of building a
 * language model that is most often skipped.
 */

export interface Architecture {
  /** The number of tokens the model can attend over at once. */
  contextLength: number
  /** The width of the residual stream — the model's hidden size. */
  dModel: number
  /** How many attention heads. */
  heads: number
  /** How many feed-forward hidden units per block. */
  dFf: number
  /** How many transformer blocks. */
  layers: number
  /** The size of the vocabulary. */
  vocabSize: number
}

export interface ParameterBreakdown {
  /** The token embedding matrix. */
  embedding: number
  /** The positional embedding matrix. */
  positional: number
  /** The attention projections, over every layer. */
  attention: number
  /** The feed-forward projections, over every layer. */
  feedForward: number
  /** The layer norms, over every layer. */
  norms: number
  /** The final layer norm. */
  finalNorm: number
  /** The output projection, if it is not tied to the embedding. */
  output: number
  /** The total. */
  total: number
}

/**
 * Count the parameters of a decoder-only transformer.
 *
 * The attention block has four projections — query, key, value and output —
 * each of shape dModel × dModel, plus the biases. The feed-forward block has
 * two projections, dModel × dFf and dFf × dModel. The layer norms have two
 * parameters per normalised dimension each.
 */
export function countParameters(architecture: Architecture, tieEmbeddings = false): ParameterBreakdown {
  const { dModel, dFf, layers, vocabSize, contextLength } = architecture

  const embedding = vocabSize * dModel
  const positional = contextLength * dModel

  // q, k, v and the output projection: four dModel × dModel matrices, with
  // the biases, per layer.
  const attentionPerLayer = 4 * (dModel * dModel + dModel)
  // The feed-forward block: dModel × dFf and dFf × dModel, with the biases.
  const feedForwardPerLayer = dModel * dFf + dFf + dFf * dModel + dModel
  // Two layer norms per block, each with a scale and a shift.
  const normsPerLayer = 4 * dModel

  const attention = attentionPerLayer * layers
  const feedForward = feedForwardPerLayer * layers
  const norms = normsPerLayer * layers
  const finalNorm = 2 * dModel
  const output = tieEmbeddings ? 0 : vocabSize * dModel + vocabSize

  return {
    embedding,
    positional,
    attention,
    feedForward,
    norms,
    finalNorm,
    output,
    total:
      embedding +
      positional +
      attention +
      feedForward +
      norms +
      finalNorm +
      output,
  }
}

/** The number of floating-point operations in a forward pass over a sequence. */
export interface FlopBreakdown {
  /** The attention projections. */
  attentionProjections: number
  /** The attention scores and the weighted sum. */
  attentionScores: number
  /** The feed-forward block. */
  feedForward: number
  /** The output projection. */
  output: number
  /** The total. */
  total: number
}

/**
 * The FLOPs of a forward pass.
 *
 * The convention here is the one CS336 uses: a matrix–matrix multiply of
 * an m × k by a k × n matrix costs 2mnk floating-point operations.
 */
export function forwardFlops(architecture: Architecture, sequenceLength: number): FlopBreakdown {
  const { dModel, dFf, layers, vocabSize } = architecture
  const n = sequenceLength

  // Four projections of dModel × dModel, applied to every token.
  const attentionProjections = layers * 4 * 2 * n * dModel * dModel
  // The scores: heads × (n × dModel) × (n × dModel / heads) per layer.
  const attentionScores = layers * 2 * 2 * n * n * dModel
  // The feed-forward block.
  const feedForward = layers * 2 * 2 * n * dModel * dFf
  // The output projection to the vocabulary.
  const output = 2 * n * dModel * vocabSize

  return {
    attentionProjections,
    attentionScores,
    feedForward,
    output,
    total: attentionProjections + attentionScores + feedForward + output,
  }
}

/**
 * The FLOPs of a training step.
 *
 * The forward pass is one unit. The backward pass costs roughly twice as much
 * as the forward — once to compute the gradient with respect to the inputs,
 * and once to compute the gradient with respect to the weights — so a training
 * step is about three forward passes.
 */
export function trainingStepFlops(architecture: Architecture, sequenceLength: number): number {
  return 3 * forwardFlops(architecture, sequenceLength).total
}

/** The FLOPs of a training step, per parameter. */
export function flopsPerParameter(architecture: Architecture, sequenceLength: number): number {
  const parameters = countParameters(architecture).total
  return parameters === 0 ? 0 : trainingStepFlops(architecture, sequenceLength) / parameters
}

/**
 * The memory a training step takes.
 *
 * Four things have to fit: the parameters, their gradients, the optimiser
 * state, and the activations that have to be kept for the backward pass.
 */
export interface MemoryBreakdown {
  /** The parameters, in bytes. */
  parameters: number
  /** The gradients, in bytes. */
  gradients: number
  /** The optimiser state, in bytes — two floats per parameter for Adam. */
  optimizer: number
  /** The saved activations, in bytes. */
  activations: number
  /** The total. */
  total: number
}

export function trainingMemory(
  architecture: Architecture,
  sequenceLength: number,
  bytesPerValue = 2,
): MemoryBreakdown {
  const parameters = countParameters(architecture).total
  const { dModel, dFf, layers, vocabSize, heads } = architecture

  // The activations kept for the backward pass, per layer:
  // the input to the block, the attention's intermediate tensors, the
  // feed-forward's hidden layer, and the logits.
  const perLayer =
    nBytes(sequenceLength * dModel) + // the residual stream
    nBytes(sequenceLength * dModel) + // the attention output
    nBytes(heads * sequenceLength * sequenceLength) + // the attention weights
    nBytes(sequenceLength * dFf) // the feed-forward hidden layer
  const activations = layers * perLayer + nBytes(sequenceLength * vocabSize)

  const parameterBytes = parameters * bytesPerValue
  const gradientBytes = parameters * bytesPerValue
  const optimizerBytes = parameters * bytesPerValue * 2

  return {
    parameters: parameterBytes,
    gradients: gradientBytes,
    optimizer: optimizerBytes,
    activations,
    total: parameterBytes + gradientBytes + optimizerBytes + activations,
  }
}

function nBytes(values: number): number {
  return values * 2
}

/**
 * The arithmetic intensity of a training step.
 *
 * Intensity is the number of floating-point operations per byte of memory
 * traffic. It is the number that decides whether a kernel is limited by the
 * arithmetic units or by the memory bandwidth — and on a modern accelerator,
 * almost every kernel in a transformer is limited by the memory.
 */
export function arithmeticIntensity(
  architecture: Architecture,
  sequenceLength: number,
  bytesPerValue = 2,
): { flops: number; bytes: number; intensity: number } {
  const flops = trainingStepFlops(architecture, sequenceLength)
  const memory = trainingMemory(architecture, sequenceLength, bytesPerValue)
  return {
    flops,
    bytes: memory.total,
    intensity: memory.total === 0 ? 0 : flops / memory.total,
  }
}

/**
 * The arithmetic intensity of the *attention kernel*.
 *
 * The whole training step can look arithmetic-bound while the attention
 * kernel inside it is not — and the attention kernel is the one that decides
 * how fast a long-context model can train.
 *
 * The scores cost 2·n²·dModel per head in floating-point operations, and the
 * attention matrix itself is n² per head, read and written. The intensity
 * therefore comes to roughly dModel / heads — a small number, well below the
 * balance point of any modern accelerator, which is exactly why the kernel
 * has to be tiled.
 */
export function attentionKernelIntensity(
  architecture: Architecture,
  sequenceLength: number,
  bytesPerValue = 2,
): { flops: number; bytes: number; intensity: number } {
  const { dModel, heads, layers } = architecture
  const n = sequenceLength

  // The scores and the weighted sum, per layer.
  const flops = layers * 4 * n * n * dModel
  // The attention matrix, written once and read once, per layer.
  const bytes = layers * heads * n * n * bytesPerValue * 2

  return { flops, bytes, intensity: bytes === 0 ? 0 : flops / bytes }
}

/**
 * The roofline.
 *
 * A kernel cannot go faster than the machine's peak arithmetic rate, and it
 * cannot go faster than the memory bandwidth divided by the intensity. The
 * attainable performance is the smaller of the two.
 */
export interface Roofline {
  /** The peak floating-point operations per second. */
  peakFlops: number
  /** The memory bandwidth in bytes per second. */
  bandwidth: number
  /** The intensity of the workload. */
  intensity: number
  /** The ceiling imposed by the arithmetic units. */
  arithmeticCeiling: number
  /** The ceiling imposed by the memory bandwidth. */
  memoryCeiling: number
  /** The attainable rate: the smaller of the two. */
  attainable: number
  /** Which of the two is the binding constraint. */
  boundBy: 'arithmetic' | 'memory'
  /** The machine's balance point: the intensity at which the two ceilings meet. */
  balancePoint: number
  /** Whether the attention kernel on its own is memory bound. */
  attentionBoundBy: 'arithmetic' | 'memory'
  /** The intensity of the attention kernel. */
  attentionIntensity: number
}

/** The arithmetic rate and bandwidth of a representative accelerator. */
export const ACCELERATORS: Record<string, { peakFlops: number; bandwidth: number; name: string }> = {
  'a100-40': { name: 'A100, 40 GB', peakFlops: 156e12, bandwidth: 1.55e12 },
  'h100-sxm': { name: 'H100 SXM', peakFlops: 989e12, bandwidth: 3.35e12 },
  'v100-32': { name: 'V100, 32 GB', peakFlops: 125e12, bandwidth: 900e9 },
  'mi300x': { name: 'MI300X', peakFlops: 1307e12, bandwidth: 5.3e12 },
  'rtx4090': { name: 'RTX 4090', peakFlops: 165e12, bandwidth: 1.01e12 },
}

export function roofline(
  architecture: Architecture,
  sequenceLength: number,
  accelerator: { peakFlops: number; bandwidth: number } = ACCELERATORS['a100-40'],
  bytesPerValue = 2,
): Roofline {
  const { intensity } = arithmeticIntensity(architecture, sequenceLength, bytesPerValue)
  const arithmeticCeiling = accelerator.peakFlops
  const memoryCeiling = accelerator.bandwidth * intensity
  const attention = attentionKernelIntensity(architecture, sequenceLength, bytesPerValue)

  return {
    peakFlops: accelerator.peakFlops,
    bandwidth: accelerator.bandwidth,
    intensity,
    arithmeticCeiling,
    memoryCeiling,
    attainable: Math.min(arithmeticCeiling, memoryCeiling),
    boundBy: memoryCeiling < arithmeticCeiling ? 'memory' : 'arithmetic',
    balancePoint: accelerator.peakFlops / accelerator.bandwidth,
    attentionBoundBy: attention.intensity < accelerator.peakFlops / accelerator.bandwidth ? 'memory' : 'arithmetic',
    attentionIntensity: attention.intensity,
  }
}

/**
 * The time a training step takes, at a given fraction of the machine's peak.
 *
 * The model is deliberately simple: a perfect implementation is not the point,
 * the *sensitivity* to the model shape is.
 */
export function stepTime(
  architecture: Architecture,
  sequenceLength: number,
  accelerator: { peakFlops: number; bandwidth: number } = ACCELERATORS['a100-40'],
  efficiency = 0.4,
  devices = 1,
): { seconds: number; flops: number } {
  const line = roofline(architecture, sequenceLength, accelerator)
  const flops = trainingStepFlops(architecture, sequenceLength)
  return { seconds: flops / (line.attainable * efficiency) / devices, flops }
}

/**
 * The number of tokens a corpus becomes, and the compute that implies.
 */
export function trainingCost(
  architecture: Architecture,
  sequenceLength: number,
  tokens: number,
  accelerator?: { peakFlops: number; bandwidth: number },
  efficiency = 0.4,
): { flops: number; seconds: number; days: number } {
  const step = stepTime(architecture, sequenceLength, accelerator, efficiency)
  const steps = tokens / sequenceLength
  const flops = step.flops * steps
  const seconds = step.seconds * steps
  return { flops, seconds, days: seconds / 86400 }
}
