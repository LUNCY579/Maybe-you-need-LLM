/**
 * Fine-tuning without touching the weights.
 *
 * A pretrained model is a fixed point, and training it further means deciding
 * how much of it is allowed to move. Full fine-tuning moves all of it, and the
 * cost is not the arithmetic but the bookkeeping: every parameter that moves
 * needs a gradient, a master copy in float32 and two moments of Adam, which is
 * more than ten bytes per parameter on top of the weights themselves.
 *
 * LoRA's idea is that the *change* is small and low-rank, so it can be
 * parameterised by two thin matrices instead of by the whole tensor — and then
 * only the thin matrices need the bookkeeping. QLoRA's idea is that the frozen
 * model can be stored in four bits, which makes the weights cheap too. The two
 * are arithmetic on the same table, and the table is what this module computes.
 */

import type { ModelShape } from './kvcache'

/** One matrix in the model: its input width and its output width. */
export interface LinearShape {
  /** What the matrix is, for the table. */
  name: string
  inputs: number
  outputs: number
}

/** The projections a transformer block contains, in the usual naming. */
export function blockShapes(model: ModelShape): LinearShape[] {
  const width = model.heads * model.headDimension
  return [
    { name: 'query', inputs: width, outputs: width },
    { name: 'key', inputs: width, outputs: width },
    { name: 'value', inputs: width, outputs: width },
    { name: 'output', inputs: width, outputs: width },
    { name: 'feed-forward up', inputs: width, outputs: model.ffnWidth },
    { name: 'feed-forward down', inputs: model.ffnWidth, outputs: width },
  ]
}

/** The attention projections only, which is the target set the papers start from. */
export const ATTENTION_TARGETS = ['query', 'key', 'value', 'output']

/** Every matrix in the block, which is the set that buys the most at a given rank. */
export const ALL_TARGETS = ATTENTION_TARGETS.concat(['feed-forward up', 'feed-forward down'])

/**
 * The parameters of one LoRA pair.
 *
 * A rank-r adapter on a d×k matrix is a d×r matrix and an r×k matrix, so the
 * cost is r·(d+k) — linear in the rank, and linear in the *sum* of the widths
 * rather than their product. That is the entire trick, and it is why the
 * adapter on a wide matrix is small and the adapter on a square one is not
 * proportionally worse.
 */
export function loraParameters(shape: LinearShape, rank: number): number {
  return Math.max(0, rank) * (shape.inputs + shape.outputs)
}

/** One frozen matrix's own parameter count. */
export function linearParameters(shape: LinearShape): number {
  return shape.inputs * shape.outputs
}

export interface AdapterSize {
  /** The trainable parameters of one block's adapters. */
  perBlock: number
  /** The whole model's trainable parameters. */
  trainable: number
  /** The model's parameters that stay frozen. */
  frozen: number
  /** Trainable over total. */
  fraction: number
  /** The adapter parameters per frozen parameter, which is what r buys. */
  perFrozen: number
  /** Which matrices carry an adapter. */
  targets: string[]
}

/**
 * How big the adapters are.
 *
 * The frozen count is taken from the shapes, not from `parametersPerLayer`, so
 * that the fraction is the fraction *of the matrices that can be adapted* —
 * the embeddings, the layernorms and the rest are outside this arithmetic, and
 * a model's real trainable fraction is a little smaller than the number here.
 */
export function adapterSize(
  model: ModelShape,
  rank: number,
  targets: string[] = ALL_TARGETS,
): AdapterSize {
  const shapes = blockShapes(model).filter((shape) => targets.includes(shape.name))
  const perBlock = shapes.reduce((sum, shape) => sum + loraParameters(shape, rank), 0)
  const frozenPerBlock = shapes.reduce((sum, shape) => sum + linearParameters(shape), 0)
  const trainable = perBlock * model.layers
  const frozen = frozenPerBlock * model.layers
  return {
    perBlock,
    trainable,
    frozen,
    fraction: trainable + frozen === 0 ? 0 : trainable / (trainable + frozen),
    perFrozen: frozen === 0 ? 0 : trainable / frozen,
    targets,
  }
}

/** Bytes per parameter, by storage format. */
export const BYTES_PER_PARAMETER: Record<string, number> = {
  fp32: 4,
  bf16: 2,
  fp8: 1,
  int8: 1,
  nf4: 0.5,
}

export interface MemoryOptions {
  /** The total parameters of the model, including the embeddings. */
  parameters: number
  /** The trainable parameters: the adapters, or the whole model for a full fine-tune. */
  trainable: number
  /** The bytes each frozen parameter is stored in: 2 for bf16, 0.5 for NF4. */
  frozenBytes?: number
  /** The bytes each trainable parameter is stored in. */
  trainableBytes?: number
  /** The bytes each trainable gradient costs. */
  gradientBytes?: number
  /** The bytes each optimizer state costs per trainable parameter: 12 for AdamW in fp32. */
  optimizerBytes?: number
  /** The bytes of activations, which is measured rather than derived. */
  activationBytes?: number
  /** Whether the frozen weights are also cast up to the compute type for each step. */
  frozenComputeCopy?: boolean
}

export interface MemoryBudget {
  frozenWeights: number
  /** The frozen weights cast to the compute type, when the run does that. */
  frozenComputeCopy: number
  trainableWeights: number
  gradients: number
  optimizerStates: number
  activations: number
  totalBytes: number
  /** The total over the model's parameters, which is the number the rule of thumb quotes. */
  perParameterBytes: number
  /** The same, as a table for the screen. */
  rows: { label: string; bytes: number; perParameter: number }[]
}

/**
 * The memory a fine-tune needs, term by term.
 *
 * Four things hold memory: the frozen weights, which are the bulk of the model
 * and the only part QLoRA makes small; the trainable weights, which are tiny
 * for an adapter and the whole model for a full fine-tune; the gradients and
 * optimizer states, which exist *only* for the trainable ones and are
 * seventeen bytes per parameter for Adam in mixed precision where the weights
 * are two; and the activations, which do not care how the weights are stored
 * and which gradient checkpointing is for.
 *
 * The byte widths are options with stated defaults rather than constants, so
 * that the screen can show which term the saving comes from.
 */
export function memoryBudget(options: MemoryOptions): MemoryBudget {
  const settings: Required<MemoryOptions> = {
    frozenBytes: BYTES_PER_PARAMETER.bf16,
    trainableBytes: BYTES_PER_PARAMETER.bf16,
    gradientBytes: BYTES_PER_PARAMETER.bf16,
    optimizerBytes: 12,
    activationBytes: 0,
    frozenComputeCopy: false,
    ...options,
  }
  const frozen = Math.max(0, settings.parameters - settings.trainable)
  const rows = [
    { label: 'frozen weights', bytes: frozen * settings.frozenBytes },
    { label: 'frozen weights in the compute type', bytes: settings.frozenComputeCopy ? frozen * BYTES_PER_PARAMETER.bf16 : 0 },
    { label: 'trainable weights', bytes: settings.trainable * settings.trainableBytes },
    { label: 'gradients', bytes: settings.trainable * settings.gradientBytes },
    { label: 'optimizer states', bytes: settings.trainable * settings.optimizerBytes },
    { label: 'activations', bytes: settings.activationBytes },
  ]
  const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0)
  const parameters = Math.max(1, settings.parameters)
  return {
    frozenWeights: rows[0]!.bytes,
    frozenComputeCopy: rows[1]!.bytes,
    trainableWeights: rows[2]!.bytes,
    gradients: rows[3]!.bytes,
    optimizerStates: rows[4]!.bytes,
    activations: rows[5]!.bytes,
    totalBytes,
    perParameterBytes: totalBytes / parameters,
    rows: rows.map((row) => ({ ...row, perParameter: row.bytes / parameters })),
  }
}

/** The activation memory a step holds, with and without recomputing the forward pass. */
export function activationBytes(
  model: ModelShape,
  options: { batchSize?: number; sequenceLength?: number; bytesPerElement?: number; checkpointed?: boolean; layersRetained?: number } = {},
): number {
  const settings = {
    batchSize: 1,
    sequenceLength: 512,
    bytesPerElement: 2,
    checkpointed: false,
    layersRetained: 1,
    ...options,
  }
  const width = model.heads * model.headDimension
  // One layer's activations are the block's inputs and the attention's
  // intermediates, in rough proportion to the width.
  const perLayer = settings.batchSize * settings.sequenceLength * width * settings.bytesPerElement * 4
  if (settings.checkpointed) {
    // With checkpointing only the block boundaries are kept, and the inside of
    // a layer is rebuilt when the gradient needs it.
    return perLayer * settings.layersRetained
  }
  return perLayer * model.layers
}

/**
 * The rule of thumb the QLoRA paper quotes, for comparison.
 *
 * These are the paper's numbers, not this module's: bytes per parameter for a
 * whole fine-tune at various widths. They are here so that the computed budget
 * can be read against them, and the test that compares the two checks the
 * order of magnitude rather than the exact figure, because the exact figure
 * depends on how many parameters the model keeps outside the transformer blocks.
 */
export const PAPER_RULE_OF_THUMB = {
  /** Mixed-precision 16-bit fine-tuning with Adam. */
  fullFineTune: 20,
  /** 16-bit LoRA, with the frozen model in bf16. */
  lora: 3,
  /** QLoRA: the frozen model in NF4, the adapters in 16 bits. */
  qlora: 1.5,
} as const

/** A seventy-billion-parameter shape, in the proportions the QLoRA papers use. */
export const SEVENTY_BILLION: ModelShape = {
  layers: 80,
  heads: 64,
  headDimension: 128,
  ffnWidth: 28672,
  parametersPerLayer: 875,
}

/** The model's parameters, from the per-layer figure the shape carries. */
export function modelParameters(model: ModelShape): number {
  return model.parametersPerLayer * 1_000_000 * model.layers
}

export interface FineTunePlan {
  name: string
  budget: MemoryBudget
  trainable: number
}

/**
 * The same fine-tune, three ways.
 *
 * Full fine-tuning, LoRA with the model in bf16, and QLoRA with the model in
 * NF4 — one shape, one rank, one batch, and the three budgets side by side. The
 * first two terms of the difference are not the adapters: they are the frozen
 * weights halving again and again, and the optimizer states that only the
 * trainable parameters have to carry.
 */
export function fineTunePlans(
  model: ModelShape,
  options: { rank?: number; targets?: string[]; batchSize?: number; sequenceLength?: number } = {},
): FineTunePlan[] {
  const settings = { rank: 64, targets: ALL_TARGETS, batchSize: 4, sequenceLength: 2048 }
  const rank = options.rank ?? settings.rank
  const targets = options.targets ?? settings.targets
  const batchSize = options.batchSize ?? settings.batchSize
  const sequenceLength = options.sequenceLength ?? settings.sequenceLength
  const parameters = modelParameters(model)
  const adapters = adapterSize(model, rank, targets)
  const activations = activationBytes(model, { batchSize, sequenceLength })
  const checkpointed = activationBytes(model, { batchSize, sequenceLength, checkpointed: true })

  return [
    {
      name: 'full fine-tune',
      trainable: parameters,
      budget: memoryBudget({
        parameters,
        trainable: parameters,
        frozenBytes: BYTES_PER_PARAMETER.bf16,
        activationBytes: activations,
      }),
    },
    {
      name: 'LoRA',
      trainable: adapters.trainable,
      budget: memoryBudget({
        parameters,
        trainable: adapters.trainable,
        frozenBytes: BYTES_PER_PARAMETER.bf16,
        activationBytes: checkpointed,
      }),
    },
    {
      name: 'QLoRA',
      trainable: adapters.trainable,
      budget: memoryBudget({
        parameters,
        trainable: adapters.trainable,
        frozenBytes: BYTES_PER_PARAMETER.nf4,
        activationBytes: checkpointed,
        // QLoRA casts the NF4 weights up to bf16 block by block as it reads
        // them, so no full copy of the model sits in memory in the compute type.
        frozenComputeCopy: false,
      }),
    },
  ]
}

/** How many of the device's eighty gigabytes the plan needs. */
export function fitsOnDevice(budget: MemoryBudget, deviceMemoryBytes: number): {
  fits: boolean
  fraction: number
  headroomBytes: number
} {
  const fraction = deviceMemoryBytes === 0 ? Number.POSITIVE_INFINITY : budget.totalBytes / deviceMemoryBytes
  return {
    fits: fraction <= 1,
    fraction,
    headroomBytes: deviceMemoryBytes - budget.totalBytes,
  }
}

/**
 * The rank ladder.
 *
 * The adapter's size is linear in r, so the trainable count at r = 64 is
 * double the count at r = 32 and nothing else about the run changes. The paper
 * results are that the *quality* saturates well before the memory does, which
 * is why the useful range is small; this table is the half of that story that
 * is arithmetic.
 */
export function rankLadder(
  model: ModelShape,
  options: { ranks?: number[]; targets?: string[] } = {},
): { rank: number; trainable: number; fraction: number; bytes: number }[] {
  const ranks = options.ranks ?? [1, 2, 4, 8, 16, 32, 64, 128, 256]
  const targets = options.targets ?? ALL_TARGETS
  return ranks.map((rank) => {
    const adapters = adapterSize(model, rank, targets)
    return {
      rank,
      trainable: adapters.trainable,
      fraction: adapters.fraction,
      bytes: adapters.trainable * (BYTES_PER_PARAMETER.bf16 * 3 + 12),
    }
  })
}
