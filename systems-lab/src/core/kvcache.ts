/**
 * The KV cache, and the arithmetic intensity of a decode step.
 *
 * Decoding is a different problem from training. Training is compute-bound:
 * the arithmetic is enormous and the memory traffic is small by comparison.
 * Decoding is the other way round — one token at a time, against a model
 * whose weights have to be read from memory whether one token is being
 * decoded or a thousand.
 *
 * The number that says which regime a step is in is the arithmetic
 * intensity: the floating-point operations per byte of memory traffic. This
 * module computes it, and it computes what the page table does for the
 * memory.
 */

export interface ModelShape {
  /** The number of layers. */
  layers: number
  /** The number of attention heads. */
  heads: number
  /** The width of one head. */
  headDimension: number
  /** The width of the feed-forward block. */
  ffnWidth: number
  /** The number of parameters per layer, in millions, for the dense parts. */
  parametersPerLayer: number
}

/** A common decoder shape, in the rough proportions of a seventy-billion-parameter model. */
export const EXAMPLE_MODEL: ModelShape = {
  layers: 80,
  heads: 64,
  headDimension: 128,
  ffnWidth: 28672,
  parametersPerLayer: 875,
}

/** The bytes the key and value cache holds for a sequence of the given length. */
export function kvCacheBytes(
  model: ModelShape,
  tokens: number,
  options: { bytesPerElement?: number; batchSize?: number } = {},
): number {
  const settings = { bytesPerElement: 2, batchSize: 1, ...options }
  const perTokenPerSequence = 2 * model.layers * model.heads * model.headDimension * settings.bytesPerElement
  return perTokenPerSequence * tokens * settings.batchSize
}

/** The bytes of weights the decode step has to read. */
export function weightBytes(model: ModelShape, options: { bytesPerElement?: number } = {}): number {
  const settings = { bytesPerElement: 2, ...options }
  return model.parametersPerLayer * model.layers * 1_000_000 * settings.bytesPerElement
}

/** The arithmetic of one decode step, in floating-point operations. */
export function decodeFlops(
  model: ModelShape,
  batchSize: number,
  contextLength: number,
): number {
  const weights = model.parametersPerLayer * model.layers * 1_000_000
  // Two operations per parameter for the matrix-vector product.
  const projection = 2 * weights * batchSize
  // The attention over the cache: two operations per element, twice over.
  const attention =
    2 * 2 * model.layers * batchSize * contextLength * model.heads * model.headDimension
  return projection + attention
}

/**
 * The arithmetic intensity of a decode step.
 *
 * The weights are read once for the whole batch, and the cache is read once
 * per sequence in the batch. That is why the intensity rises with the batch
 * size, and why the batch size is the lever that turns a memory-bound decode
 * into a compute-bound one.
 */
export function decodeArithmeticIntensity(
  model: ModelShape,
  batchSize: number,
  contextLength: number,
  options: { bytesPerElement?: number } = {},
): number {
  const settings = { bytesPerElement: 2, ...options }
  const bytes =
    weightBytes(model, settings) +
    kvCacheBytes(model, contextLength, { ...settings, batchSize })
  return decodeFlops(model, batchSize, contextLength) / bytes
}

/** The intensity above which the step is compute-bound rather than memory-bound. */
export const MACHINE_BALANCE = 50

export interface PagedAllocation {
  /** The bytes the allocation holds. */
  totalBytes: number
  /** The bytes that hold nothing useful. */
  wastedBytes: number
  /** The fraction of the allocation that is wasted. */
  wasteFraction: number
  /** The number of blocks the allocation used. */
  blocks: number
}

/**
 * The memory a set of sequences takes, under two allocation schemes.
 *
 * The *padded* scheme is what a straightforward implementation does: every
 * sequence in the batch is given a buffer as long as the longest one, because
 * the buffer has to be contiguous. The waste is the padding, and it is
 * proportional to the batch.
 *
 * The *paged* scheme gives every sequence whole blocks of a fixed size and
 * lets the blocks be anywhere in memory. The only waste is the tail of each
 * sequence's last block, and that is a fraction of a block per sequence
 * rather than a fraction of the whole batch.
 */
export function pagedAllocation(
  model: ModelShape,
  sequenceLengths: number[],
  options: { bytesPerElement?: number; blockSize?: number } = {},
): { padded: PagedAllocation; paged: PagedAllocation } {
  const settings = { bytesPerElement: 2, blockSize: 16, ...options }
  const bytesPerToken = 2 * model.layers * model.heads * model.headDimension * settings.bytesPerElement

  const totalTokens = sequenceLengths.reduce((a, b) => a + b, 0)
  const longest = Math.max(0, ...sequenceLengths)
  const batchSize = sequenceLengths.length

  // The padded allocation: every sequence gets a buffer as long as the
  // longest one.
  const paddedTokens = longest * batchSize
  const paddedBytes = paddedTokens * bytesPerToken
  const paddedWaste = paddedBytes - totalTokens * bytesPerToken

  // The paged allocation: whole blocks, and only the tail of the last block
  // of each sequence is unused.
  const pagedBlocks = sequenceLengths.reduce((sum, length) => sum + Math.ceil(length / settings.blockSize), 0)
  const pagedBytes = pagedBlocks * settings.blockSize * bytesPerToken

  return {
    padded: {
      totalBytes: paddedBytes,
      wastedBytes: paddedWaste,
      wasteFraction: paddedBytes === 0 ? 0 : paddedWaste / paddedBytes,
      blocks: batchSize,
    },
    paged: {
      totalBytes: pagedBytes,
      wastedBytes: pagedBytes - totalTokens * bytesPerToken,
      wasteFraction: pagedBytes === 0 ? 0 : (pagedBytes - totalTokens * bytesPerToken) / pagedBytes,
      blocks: pagedBlocks,
    },
  }
}

/**
 * The batch size at which the decode step becomes compute-bound.
 *
 * It is the batch size at which the intensity crosses the machine's balance
 * point, and it is found by a search because the intensity is not a simple
 * function of the batch size.
 */
export function computeBoundBatchSize(
  model: ModelShape,
  contextLength: number,
  options: { bytesPerElement?: number; balance?: number; maxBatch?: number } = {},
): number {
  const settings = { bytesPerElement: 2, balance: MACHINE_BALANCE, maxBatch: 4096, ...options }
  for (let batch = 1; batch <= settings.maxBatch; batch++) {
    if (decodeArithmeticIntensity(model, batch, contextLength, settings) >= settings.balance) {
      return batch
    }
  }
  return settings.maxBatch
}

/**
 * Serving: how many tokens a second the machine can produce.
 *
 * A decode step reads the weights and the cache, and does a fixed amount of
 * arithmetic. At a batch of one the reading is the whole cost, so adding a
 * second sequence to the batch is almost free: the weights are already in
 * transit. That is why throughput climbs in a straight line at first. It
 * stops climbing when the arithmetic becomes the constraint, and after that
 * the batch only buys latency.
 *
 * The time is the maximum of the two, not their sum — the memory system and
 * the tensor cores work at the same time and the step ends when the slower of
 * them finishes.
 */
export interface Device {
  /** Operations per second. */
  flopsPerSecond: number
  /** Bytes per second read from the high-bandwidth memory. */
  memoryBandwidthBytesPerSecond: number
  /** Bytes of device memory a single device holds. */
  memoryBytes: number
}

/** The same order of magnitude as the attention module quotes, stated once here. */
export const SERVING_DEVICE: Device = {
  flopsPerSecond: 3.1e14,
  memoryBandwidthBytesPerSecond: 1.55e12,
  memoryBytes: 8e10,
}

export interface ThroughputResult {
  batchSize: number
  /** The seconds one decode step takes. */
  stepSeconds: number
  /** Tokens produced per second, which is the batch divided by that. */
  tokensPerSecond: number
  /** The milliseconds a single sequence waits per token. */
  latencyMs: number
  boundBy: 'memory' | 'compute'
  /** The bytes the step reads. */
  bytes: number
  /** The fraction of the device's memory the cache of this batch occupies. */
  cacheMemoryFraction: number
}

/**
 * One decode step: what it reads, what it computes, and how long it takes.
 *
 * The weights are read once for the batch and the cache once per sequence, so
 * the traffic term grows with the batch while the arithmetic grows with it
 * faster, and the batch is the lever that moves a decode from the memory side
 * of the machine to the compute side. The step is as slow as whichever of the
 * two is slower, not as slow as their sum, because the reading and the
 * arithmetic overlap.
 */
export function decodeThroughput(
  model: ModelShape,
  batchSize: number,
  contextLength: number,
  options: { bytesPerElement?: number; device?: Device } = {},
): ThroughputResult {
  const settings = { bytesPerElement: 2, device: SERVING_DEVICE, ...options }
  // The weights are read once for the whole batch; the cache is read once per
  // sequence in it, so only the second term scales with the batch size.
  const cache = kvCacheBytes(model, contextLength, { ...settings, batchSize })
  const bytes = weightBytes(model, settings) + cache
  const flops = decodeFlops(model, batchSize, contextLength)
  const memorySeconds = bytes / settings.device.memoryBandwidthBytesPerSecond
  const computeSeconds = flops / settings.device.flopsPerSecond
  const stepSeconds = Math.max(memorySeconds, computeSeconds)
  return {
    batchSize,
    stepSeconds,
    tokensPerSecond: stepSeconds === 0 ? 0 : batchSize / stepSeconds,
    latencyMs: stepSeconds * 1000,
    boundBy: computeSeconds > memorySeconds ? 'compute' : 'memory',
    bytes,
    cacheMemoryFraction: cache / settings.device.memoryBytes,
  }
}

/**
 * The throughput curve the paging papers are arguing about.
 *
 * Static batching — padding every sequence to the longest and refusing to
 * start a new one until the batch finishes — is what makes the curve flatten
 * early: the memory the padding holds is memory the next request cannot use.
 * The curve here is the arithmetic underneath that argument, and its knee is
 * the batch at which the arithmetic overtakes the reading.
 *
 * It keeps rewarding a bigger batch for longer than a machine can allow,
 * because it is only arithmetic: a point whose `cacheMemoryFraction` is above
 * one is a batch that would not fit on the device, which is what the table
 * next to the curve is for.
 */
export function throughputCurve(
  model: ModelShape,
  contextLength: number,
  options: { maxBatch?: number; stride?: number; bytesPerElement?: number; device?: Device } = {},
): ThroughputResult[] {
  const settings = { maxBatch: 512, stride: 1, ...options }
  const curve: ThroughputResult[] = []
  for (let batch = 1; batch <= settings.maxBatch; batch += settings.stride) {
    curve.push(decodeThroughput(model, batch, contextLength, settings))
  }
  return curve
}

/**
 * The largest batch the memory can hold.
 *
 * The weights are resident first, and every sequence in the batch then costs
 * its cache. That is the constraint a longer context runs into before the
 * arithmetic does, and it is why a long-context service has fewer concurrent
 * sequences than the same model at a short context.
 *
 * A seventy-billion-parameter model in bf16 does not fit on one eighty-gigabyte
 * device at all, which is what `limitedBy: 'weights'` means and why the answer
 * to "what batch can this model serve" usually starts by saying how many
 * devices it is spread over.
 */
export function maxServingBatch(
  model: ModelShape,
  contextLength: number,
  options: {
    bytesPerElement?: number
    device?: Device
    memoryUtilisation?: number
    devices?: number
  } = {},
): { batch: number; bytesPerToken: number; availableBytes: number; limitedBy: 'weights' | 'none' } {
  const settings = {
    bytesPerElement: 2,
    device: SERVING_DEVICE,
    memoryUtilisation: 0.9,
    ...options,
  }
  if (settings.devices === undefined) settings.devices = minimumDevices(model, settings)
  const bytesPerToken = 2 * model.layers * model.heads * model.headDimension * settings.bytesPerElement
  const availableBytes =
    settings.device.memoryBytes * settings.devices * settings.memoryUtilisation - weightBytes(model, settings)
  if (availableBytes <= 0) return { batch: 0, bytesPerToken, availableBytes, limitedBy: 'weights' }
  return {
    batch: Math.floor(availableBytes / (bytesPerToken * contextLength)),
    bytesPerToken,
    availableBytes,
    limitedBy: 'none',
  }
}

/**
 * How many devices the weights alone need.
 *
 * Tensor parallelism splits the weights across devices, so this is the floor
 * under any batch at any context length. The quantised model needs a quarter of
 * the devices the 16-bit one does, which is the entire argument for shipping a
 * four-bit weight format to a service that was waiting on memory.
 */
export function minimumDevices(
  model: ModelShape,
  options: { bytesPerElement?: number; device?: Device; memoryUtilisation?: number } = {},
): number {
  const settings = { bytesPerElement: 2, device: SERVING_DEVICE, memoryUtilisation: 0.9, ...options }
  const usable = settings.device.memoryBytes * settings.memoryUtilisation
  return Math.max(1, Math.ceil(weightBytes(model, settings) / usable))
}

/**
 * The block table.
 *
 * A sequence's cache is a list of whole blocks, and the blocks need not be
 * contiguous — that is the entire idea, and it is what makes the allocation
 * in `pagedAllocation` above possible at all.
 *
 * The interesting part is the reference count. When a request branches — best
 * of n, a beam, a shared prefix — the child does not copy the parent's cache.
 * It takes the same block numbers, and the block gains a reference. Only the
 * block that is still being written has to be copied, because that is the
 * only one where the two futures differ. The memory cost of branching is
 * therefore one block, not the whole prefix.
 */
export interface PoolBlock {
  id: number
  /** How many sequences' tables name this block. */
  refCount: number
  /** How many tokens of it are filled. */
  tokens: number
}

export interface CachePool {
  blockSize: number
  blocks: PoolBlock[]
  /** The block ids of each sequence, in order. */
  tables: number[][]
  /** The blocks copied rather than shared, since the pool was created. */
  copies: number
}

export function createPool(options: { blockSize?: number } = {}): CachePool {
  return { blockSize: Math.max(1, options.blockSize ?? 16), blocks: [], tables: [], copies: 0 }
}

/** Start an empty sequence and return the pool and its id. */
export function addSequence(pool: CachePool): { pool: CachePool; sequence: number } {
  const clone = clonePool(pool)
  clone.tables.push([])
  return { pool: clone, sequence: clone.tables.length - 1 }
}

/** Append one token to a sequence, opening a new block when the last is full. */
export function appendToken(pool: CachePool, sequence: number): CachePool {
  const clone = clonePool(pool)
  const table = clone.tables[sequence]
  if (!table) throw new RangeError(`no sequence ${sequence} in the pool`)
  const last = table.length > 0 ? clone.blocks[table[table.length - 1]!] : undefined
  if (last && last.tokens < clone.blockSize) {
    last.tokens += 1
    return clone
  }
  const block: PoolBlock = { id: clone.blocks.length, refCount: 1, tokens: 1 }
  clone.blocks.push(block)
  table.push(block.id)
  return clone
}

/**
 * Branch a sequence.
 *
 * Every block that is full is shared: its reference count goes up and nothing
 * is copied. The last block, if it is only partly filled, is copied — the
 * parent and the child are about to write different tokens into the same
 * slots, and only one of them can own it.
 */
export function forkSequence(pool: CachePool, parent: number): { pool: CachePool; sequence: number } {
  const clone = clonePool(pool)
  const table = clone.tables[parent]
  if (!table) throw new RangeError(`no sequence ${parent} in the pool`)
  const child: number[] = []
  for (const [index, blockId] of table.entries()) {
    const block = clone.blocks[blockId]!
    const isTail = index === table.length - 1
    if (isTail && block.tokens < clone.blockSize) {
      const copy: PoolBlock = { id: clone.blocks.length, refCount: 1, tokens: block.tokens }
      clone.blocks.push(copy)
      clone.copies += 1
      child.push(copy.id)
    } else {
      block.refCount += 1
      child.push(blockId)
    }
  }
  clone.tables.push(child)
  return { pool: clone, sequence: clone.tables.length - 1 }
}

/** Drop a sequence, reclaiming the blocks nobody else names. */
export function freeSequence(pool: CachePool, sequence: number): CachePool {
  const clone = clonePool(pool)
  const table = clone.tables[sequence]
  if (!table) throw new RangeError(`no sequence ${sequence} in the pool`)
  for (const blockId of table) {
    const block = clone.blocks[blockId]!
    block.refCount -= 1
    if (block.refCount <= 0) block.tokens = 0
  }
  clone.tables[sequence] = []
  return clone
}

/** Blocks freed by `freeSequence`, ready to be handed to the next sequence. */
export function freeBlocks(pool: CachePool): number {
  return pool.blocks.filter((block) => block.refCount === 0).length
}

function clonePool(pool: CachePool): CachePool {
  return {
    blockSize: pool.blockSize,
    blocks: pool.blocks.map((block) => ({ ...block })),
    tables: pool.tables.map((table) => [...table]),
    copies: pool.copies,
  }
}

export interface PoolStats {
  /** Blocks that exist and are named by at least one table. */
  allocatedBlocks: number
  /** The tokens actually held in them. */
  usedTokens: number
  /** The tokens they could hold, which is the waste's denominator. */
  capacityTokens: number
  /** The fraction of the allocated blocks that is empty. */
  wasteFraction: number
  /** The sequences with a non-empty table. */
  sequences: number
  /** The blocks copied rather than shared. */
  copies: number
  /** The tokens that exist once but are read by several sequences. */
  tokensSavedBySharing: number
}

/** What the pool is holding, and what it is holding for nothing. */
export function poolStats(pool: CachePool): PoolStats {
  const allocated = pool.blocks.filter((block) => block.refCount > 0)
  const usedTokens = allocated.reduce((sum, block) => sum + block.tokens, 0)
  const capacity = allocated.length * pool.blockSize
  const sequences = pool.tables.filter((table) => table.length > 0).length
  // The tokens a copy-on-write scheme did *not* copy, measured against a
  // scheme that copies the whole prefix for every branch.
  const sharedTokens = allocated.filter((block) => block.refCount > 1).reduce((sum, b) => sum + b.tokens * (b.refCount - 1), 0)
  return {
    allocatedBlocks: allocated.length,
    usedTokens,
    capacityTokens: capacity,
    wasteFraction: capacity === 0 ? 0 : (capacity - usedTokens) / capacity,
    sequences,
    copies: pool.copies,
    tokensSavedBySharing: sharedTokens,
  }
}
