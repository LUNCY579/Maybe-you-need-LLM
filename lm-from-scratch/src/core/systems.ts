/**
 * Where the arithmetic and the data actually live.
 *
 * A training step is not run on one kind of memory. The parameters, the
 * gradients and the optimiser state stream through a hierarchy — a small
 * shared-memory pool on each SM, a larger L2 cache, and the HBM that holds the
 * run — and each level has a bandwidth that sets its own balance point. A
 * kernel can be arithmetic-bound against HBM and memory-bound against shared
 * memory, and the same kernel can be worth optimising at one level and not at
 * the other.
 *
 * This module also covers the other half of the systems lecture: what it costs
 * to spread a step over several devices, and what tiling does to the attention
 * kernel's memory. Every number here is arithmetic on the model shape; the
 * hardware figures are quoted, and labelled as such.
 */

import {
  ACCELERATORS,
  attentionKernelIntensity,
  countParameters,
  forwardFlops,
  trainingMemory,
  trainingStepFlops,
} from './architecture.js'
import type { Architecture, MemoryBreakdown } from './architecture.js'

/* ------------------------------------------------------------ the hierarchy */

export interface MemoryLevel {
  key: string
  name: string
  /** How many bytes the level holds. */
  capacity: number
  /** How many bytes per second it can deliver. */
  bandwidth: number
}

/**
 * A representative hierarchy: one H100 SXM.
 *
 * The capacities and bandwidths are quoted, and approximate: shared memory is
 * 228 KB per SM (132 SMs, so about 30 MB in total), the L2 cache is 50 MB, and
 * HBM3 is 80 GB at 3.35 TB/s. The aggregate shared-memory and L2 bandwidths
 * depend on the access pattern, so they are order-of-magnitude figures, which
 * is all the balance-point comparison needs.
 */
export const HIERARCHY = {
  accelerator: 'H100 SXM (quoted figures)',
  peakFlops: ACCELERATORS['h100-sxm']!.peakFlops,
  levels: [
    { key: 'smem', name: 'shared memory, one SM', capacity: 228 * 1024, bandwidth: 33.4e12 },
    { key: 'l2', name: 'the L2 cache', capacity: 50 * 1024 * 1024, bandwidth: 12e12 },
    { key: 'hbm', name: 'HBM', capacity: 80e9, bandwidth: 3.35e12 },
  ] as MemoryLevel[],
} as const

export interface HierarchyRow extends MemoryLevel {
  /** The intensity at which this level's bandwidth matches the arithmetic peak. */
  balancePoint: number
  /** How many times the level's capacity the training working set is. */
  passes: number
  /** Whether the whole working set would fit in the level. */
  fits: boolean
}

export interface HierarchyReport {
  workingSet: number
  memory: MemoryBreakdown
  /** The share of the working set that is activations. */
  activationShare: number
  rows: HierarchyRow[]
}

/**
 * Place a training step's working set against the hierarchy.
 *
 * The working set is the four components `trainingMemory` already counts. The
 * question this answers is not "does it fit in HBM" — for a model this small it
 * does — but "how many times does each level have to be refilled to stream it",
 * which is what makes a step memory-bound.
 */
export function memoryHierarchy(architecture: Architecture, sequenceLength: number): HierarchyReport {
  const memory = trainingMemory(architecture, sequenceLength)
  const workingSet = memory.total
  return {
    workingSet,
    memory,
    activationShare: workingSet === 0 ? 0 : memory.activations / workingSet,
    rows: HIERARCHY.levels.map((level) => ({
      ...level,
      balancePoint: HIERARCHY.peakFlops / level.bandwidth,
      passes: workingSet === 0 ? 0 : workingSet / level.capacity,
      fits: workingSet <= level.capacity,
    })),
  }
}

/**
 * The intensity of the optimiser update.
 *
 * Adam, per parameter, reads the gradient, the two moment estimates and the
 * parameter, and writes the two moments and the parameter back. At the usual
 * mixed precision the moments are fp32 and the parameter and gradient are
 * fp16, so the traffic is 2 + 4 + 4 + 2 read and 4 + 4 + 2 written: 22 bytes
 * per parameter. The update itself is about ten floating-point operations.
 *
 * The result is below one operation per byte, which is below the balance point
 * of every level in the hierarchy — including shared memory. There is no
 * arrangement of the update that makes it arithmetic-bound.
 */
export function adamUpdateIntensity(): { flops: number; bytes: number; intensity: number } {
  const flops = 10
  const bytes = 22
  return { flops, bytes, intensity: flops / bytes }
}

/**
 * The intensity of a matrix multiplication.
 *
 * An m × k by k × n multiply reads mk + kn values and writes mn, and does 2mnk
 * operations. For a square multiply at model width, the intensity is roughly
 * one operation per byte for every unit of width — so a 768-wide matrix
 * multiply is arithmetic-bound even against shared memory, while the optimiser
 * update is not.
 */
export function matmulIntensity(m: number, n: number, k: number, bytesPerValue = 2): number {
  const bytes = (m * k + k * n + m * n) * bytesPerValue
  return bytes === 0 ? 0 : (2 * m * n * k) / bytes
}

/* ------------------------------------------------------------- parallelism */

export interface ParallelReport {
  kind: 'data' | 'tensor' | 'pipeline'
  devices: number
  /** The FLOPs one device performs in the step. */
  flopsPerDevice: number
  /** The bytes the device has to send or receive. */
  communicationBytes: number
  /** The FLOPs per byte of communication. */
  intensity: number
  /** The compute time at the accelerator's attainable rate. */
  computeSeconds: number
  /** The communication time at the interconnect bandwidth. */
  communicationSeconds: number
  /** Communication time as a fraction of compute time, with no overlap. */
  overhead: number
}

/** The bandwidth assumed for an inter-device interconnect, in bytes per second. */
export const INTERCONNECT_BANDWIDTH = 450e9 // NVLink, bidirectional, per GPU; quoted
const EFFICIENCY = 0.4

/**
 * The bytes a ring all-reduce moves per device.
 *
 * Every device sends and receives the whole buffer twice, less one chunk:
 * 2·(d−1)/d times the buffer size. That is the standard cost, and it is what
 * makes data parallelism cheap and tensor parallelism expensive.
 */
export function allReduceBytes(bufferBytes: number, devices: number): number {
  if (devices <= 1) return 0
  return (2 * bufferBytes * (devices - 1)) / devices
}

/**
 * Data parallelism: each device takes a slice of the batch, and the gradients
 * are all-reduced once per step.
 */
export function dataParallel(
  architecture: Architecture,
  sequenceLength: number,
  batchSize: number,
  devices: number,
  bytesPerValue = 2,
  accelerator: { peakFlops: number } = ACCELERATORS['h100-sxm']!,
): ParallelReport {
  const parameters = countParameters(architecture).total
  const stepFlops = trainingStepFlops(architecture, sequenceLength) * Math.max(1, batchSize)
  return report('data', devices, stepFlops, allReduceBytes(parameters * bytesPerValue, devices), accelerator)
}

/**
 * Tensor parallelism: each block's matrices are split across devices, and each
 * block needs two all-reduces of the activation on the way out. The batch is
 * not split, so this is the parallelism that lets a single sequence use more
 * devices — and it pays for that with communication inside every block.
 */
export function tensorParallel(
  architecture: Architecture,
  sequenceLength: number,
  batchSize: number,
  devices: number,
  bytesPerValue = 2,
  accelerator: { peakFlops: number } = ACCELERATORS['h100-sxm']!,
): ParallelReport {
  const { layers, dModel } = architecture
  const stepFlops = trainingStepFlops(architecture, sequenceLength) * Math.max(1, batchSize)
  const activationBytes = sequenceLength * dModel * bytesPerValue
  const buffer = layers * 2 * activationBytes
  return report('tensor', devices, stepFlops, allReduceBytes(buffer, devices), accelerator)
}

/**
 * Pipeline parallelism: the blocks are split into stages, and every stage sends
 * its activations to the next. The cost is not only the send: the pipeline has
 * to fill and drain, and the idle fraction is set by the number of stages and
 * the number of microbatches.
 */
export function pipelineParallel(
  architecture: Architecture,
  sequenceLength: number,
  batchSize: number,
  stages: number,
  microbatches: number,
  bytesPerValue = 2,
  accelerator: { peakFlops: number } = ACCELERATORS['h100-sxm']!,
): ParallelReport {
  const stepFlops =
    (trainingStepFlops(architecture, sequenceLength) * Math.max(1, batchSize)) / Math.max(1, microbatches)
  // One activation send per stage boundary per microbatch, in each direction.
  const perSend = sequenceLength * architecture.dModel * bytesPerValue
  const communicationBytes = 2 * Math.max(0, stages - 1) * Math.max(1, microbatches) * perSend
  return report('pipeline', Math.max(1, stages), stepFlops, communicationBytes, accelerator)
}

function report(
  kind: ParallelReport['kind'],
  devices: number,
  totalFlops: number,
  communicationBytes: number,
  accelerator: { peakFlops: number },
): ParallelReport {
  const flopsPerDevice = totalFlops / Math.max(1, devices)
  const computeSeconds = flopsPerDevice / (accelerator.peakFlops * EFFICIENCY)
  const communicationSeconds = communicationBytes / INTERCONNECT_BANDWIDTH
  return {
    kind,
    devices,
    flopsPerDevice,
    communicationBytes,
    intensity: communicationBytes === 0 ? Number.POSITIVE_INFINITY : flopsPerDevice / communicationBytes,
    computeSeconds,
    communicationSeconds,
    overhead: computeSeconds === 0 ? 0 : communicationSeconds / computeSeconds,
  }
}

/** The idle fraction of a pipeline: fill and drain over the whole schedule. */
export function pipelineBubble(stages: number, microbatches: number): number {
  if (stages <= 1) return 0
  return (stages - 1) / (Math.max(1, microbatches) + stages - 1)
}

/* ------------------------------------------------------------------ kernels */

export interface AttentionFootprint {
  /** The scores matrix if it is written out, plus the q, k and v tensors. */
  materialised: number
  /** The scores block held by a tiled kernel, plus the q, k and v tensors. */
  tiled: number
  /** How much smaller the tiled footprint is. */
  ratio: number
  /** The FLOPs, which tiling does not change. */
  flops: number
}

/**
 * The memory the attention kernel needs, with and without tiling.
 *
 * A plain implementation writes the n × n score matrix for every head and reads
 * it back. A tiled kernel never materialises more than one block of it, so its
 * footprint grows with the sequence length rather than with its square. The
 * FLOPs are the same either way — which is why the tiling is a bandwidth
 * optimisation, not an arithmetic one.
 */
export function attentionFootprint(
  architecture: Architecture,
  sequenceLength: number,
  tile = 128,
  bytesPerValue = 2,
): AttentionFootprint {
  const { heads, dModel, layers } = architecture
  const qkv = 4 * sequenceLength * dModel * bytesPerValue * layers
  const scores = heads * sequenceLength * sequenceLength * bytesPerValue * layers
  const block = heads * sequenceLength * Math.min(tile, sequenceLength) * bytesPerValue * layers
  const materialised = qkv + scores
  const tiled = qkv + block
  return {
    materialised,
    tiled,
    ratio: tiled === 0 ? 0 : materialised / tiled,
    flops: forwardFlops(architecture, sequenceLength).attentionScores,
  }
}

/** The arithmetic intensity of the attention kernel at this shape. */
export function kernelIntensity(architecture: Architecture, sequenceLength: number): number {
  return attentionKernelIntensity(architecture, sequenceLength).intensity
}
