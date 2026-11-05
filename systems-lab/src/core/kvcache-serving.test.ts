import { describe, expect, it } from 'vitest'
import {
  EXAMPLE_MODEL,
  SERVING_DEVICE,
  addSequence,
  appendToken,
  createPool,
  decodeThroughput,
  freeBlocks,
  forkSequence,
  freeSequence,
  kvCacheBytes,
  maxServingBatch,
  minimumDevices,
  poolStats,
  throughputCurve,
  weightBytes,
} from './kvcache'

/**
 * The claims the serving screen makes about a decode step and a block table.
 *
 * The device is quoted, not measured, so the tests below are about the shape of
 * the arithmetic — which term grows with the batch, where the throughput stops
 * growing, and what a branch does to a pool of blocks.
 */
describe('the decode step', () => {
  it('reads the weights once and the cache once per sequence', () => {
    const two = decodeThroughput(EXAMPLE_MODEL, 3, 1024)
    const five = decodeThroughput(EXAMPLE_MODEL, 5, 1024)
    expect(five.bytes - two.bytes).toBe(kvCacheBytes(EXAMPLE_MODEL, 1024, { batchSize: 2 }))
    expect(decodeThroughput(EXAMPLE_MODEL, 1, 1024).bytes).toBe(
      weightBytes(EXAMPLE_MODEL) + kvCacheBytes(EXAMPLE_MODEL, 1024),
    )
  })

  it('is memory-bound alone and compute-bound in a big enough batch', () => {
    const alone = decodeThroughput(EXAMPLE_MODEL, 1, 8)
    expect(alone.boundBy).toBe('memory')
    // The same step with a batch that gives the tensor cores something to do.
    const packed = decodeThroughput(EXAMPLE_MODEL, 1024, 8)
    expect(packed.boundBy).toBe('compute')
    expect(packed.tokensPerSecond).toBeGreaterThan(alone.tokensPerSecond * 100)
  })

  it('stops buying throughput once the arithmetic is the constraint', () => {
    const large = decodeThroughput(EXAMPLE_MODEL, 1024, 8)
    const larger = decodeThroughput(EXAMPLE_MODEL, 4096, 8)
    // The step cannot go faster than its slower half, and the slower half has
    // stopped being the reading: four times the batch, the same throughput.
    expect(larger.tokensPerSecond).toBeCloseTo(large.tokensPerSecond, 6)
    expect(larger.latencyMs).toBeCloseTo(large.latencyMs * 4, 3)
  })

  it('is kept memory-bound by a long context', () => {
    // The same batch that is compute-bound at eight tokens is reading the cache
    // again at a thousand and twenty-four, because the cache is what scales.
    expect(decodeThroughput(EXAMPLE_MODEL, 256, 8).boundBy).toBe('compute')
    expect(decodeThroughput(EXAMPLE_MODEL, 256, 1024).boundBy).toBe('memory')
  })

  it('rewards a bigger batch by less and less', () => {
    const curve = throughputCurve(EXAMPLE_MODEL, 1024, { maxBatch: 256 })
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!.tokensPerSecond).toBeGreaterThan(curve[i - 1]!.tokensPerSecond)
    }
    const early = curve[15]!.tokensPerSecond / curve[3]!.tokensPerSecond
    const late = curve[255]!.tokensPerSecond / curve[63]!.tokensPerSecond
    expect(late).toBeLessThan(early)
  })

  it('says when a batch would not fit on the device', () => {
    const servable = decodeThroughput(EXAMPLE_MODEL, 16, 1024)
    const fantasy = decodeThroughput(EXAMPLE_MODEL, 256, 1024)
    expect(servable.cacheMemoryFraction).toBeLessThan(1)
    // The arithmetic still likes the bigger batch; the memory does not.
    expect(fantasy.cacheMemoryFraction).toBeGreaterThan(1)
  })
})

describe('the memory that caps the batch', () => {
  it('needs the weights resident before it needs anything else', () => {
    expect(weightBytes(EXAMPLE_MODEL)).toBeGreaterThan(SERVING_DEVICE.memoryBytes)
    expect(minimumDevices(EXAMPLE_MODEL)).toBe(2)
    expect(maxServingBatch(EXAMPLE_MODEL, 1024, { devices: 1 }).limitedBy).toBe('weights')
    expect(maxServingBatch(EXAMPLE_MODEL, 1024, { devices: 1 }).batch).toBe(0)
  })

  it('halves the devices the weights cost when it halves their width', () => {
    expect(minimumDevices(EXAMPLE_MODEL, { bytesPerElement: 1 })).toBe(1)
    expect(minimumDevices(EXAMPLE_MODEL, { bytesPerElement: 0.5 })).toBe(1)
  })

  it('shrinks the batch as the context grows', () => {
    const short = maxServingBatch(EXAMPLE_MODEL, 1024, { devices: 4 })
    const long = maxServingBatch(EXAMPLE_MODEL, 4096, { devices: 4 })
    expect(short.limitedBy).toBe('none')
    expect(long.batch).toBeLessThan(short.batch)
    // Four times the context, a quarter of the sequences, give or take rounding.
    expect(long.batch * 4).toBeLessThanOrEqual(short.batch)
  })

  it('prices the cache per token, which is what the whole lab is about', () => {
    const perToken = maxServingBatch(EXAMPLE_MODEL, 1, { devices: 4 }).bytesPerToken
    expect(perToken).toBe(2 * EXAMPLE_MODEL.layers * EXAMPLE_MODEL.heads * EXAMPLE_MODEL.headDimension * 2)
    expect(kvCacheBytes(EXAMPLE_MODEL, 1000)).toBe(perToken * 1000)
  })
})

describe('the block table', () => {
  it('fills blocks in order and leaves the last one partly used', () => {
    let pool = createPool({ blockSize: 4 })
    const started = addSequence(pool)
    pool = started.pool
    for (let i = 0; i < 10; i++) pool = appendToken(pool, started.sequence)
    const stats = poolStats(pool)
    expect(stats.sequences).toBe(1)
    expect(stats.usedTokens).toBe(10)
    // Three blocks of four is twelve slots for ten tokens.
    expect(stats.allocatedBlocks).toBe(3)
    expect(stats.capacityTokens).toBe(12)
    expect(stats.wasteFraction).toBeCloseTo(2 / 12, 10)
    expect(stats.copies).toBe(0)
  })

  it('shares the whole blocks of a branch and copies only the block being written', () => {
    let pool = createPool({ blockSize: 4 })
    const parent = addSequence(pool)
    pool = parent.pool
    for (let i = 0; i < 10; i++) pool = appendToken(pool, parent.sequence)
    const before = poolStats(pool)

    const forked = forkSequence(pool, parent.sequence)
    const after = poolStats(forked.pool)
    expect(after.sequences).toBe(2)
    // Twelve tokens in the pool for ten in each sequence: the eight of the
    // shared prefix are stored once, and each branch keeps its own copy of the
    // two that were still being written.
    expect(after.usedTokens).toBe(12)
    // Copying the prefix would have needed three more blocks; this needed one.
    expect(after.allocatedBlocks).toBe(before.allocatedBlocks + 1)
    expect(after.copies).toBe(1)
    expect(after.tokensSavedBySharing).toBe(8)
    // Both tables name the same first two blocks.
    expect(forked.pool.tables[parent.sequence]!.slice(0, 2)).toEqual(
      forked.pool.tables[forked.sequence]!.slice(0, 2),
    )
    expect(forked.pool.blocks[0]!.refCount).toBe(2)
  })

  it('keeps a branch alive when its parent is freed, and reclaims only what nobody names', () => {
    let pool = createPool({ blockSize: 4 })
    const parent = addSequence(pool)
    pool = parent.pool
    for (let i = 0; i < 10; i++) pool = appendToken(pool, parent.sequence)
    const forked = forkSequence(pool, parent.sequence)
    const child = forked.sequence
    // Two full blocks and a tail of two: the branch shares the first two and
    // gets a copy of the third, which is the only one they would write apart.
    expect(forked.pool.blocks[0]!.refCount).toBe(2)
    expect(forked.pool.blocks[2]!.refCount).toBe(1)

    const released = freeSequence(forked.pool, parent.sequence)
    expect(released.tables[parent.sequence]!.length).toBe(0)
    expect(released.tables[child]!.length).toBe(3)
    expect(poolStats(released).sequences).toBe(1)
    expect(poolStats(released).usedTokens).toBe(10)
    // The parent's own tail is the only block nobody names any more.
    expect(freeBlocks(released)).toBe(1)
    expect(poolStats(released).tokensSavedBySharing).toBe(0)
  })

  it('wastes less than a padded allocation would, per sequence rather than per batch', () => {
    let pool = createPool({ blockSize: 16 })
    const lengths = [100, 137, 42, 511, 63]
    for (const length of lengths) {
      const started = addSequence(pool)
      pool = started.pool
      for (let i = 0; i < length; i++) pool = appendToken(pool, started.sequence)
    }
    const stats = poolStats(pool)
    const needed = lengths.reduce((a, b) => a + b, 0)
    expect(stats.usedTokens).toBe(needed)
    // Every sequence wastes at most one block, so the waste is bounded by the
    // block size times the number of sequences rather than the longest context.
    expect(stats.capacityTokens - needed).toBeLessThanOrEqual(16 * lengths.length)
    expect(stats.wasteFraction).toBeLessThan(16 / Math.min(...lengths))
  })

  it('refuses a sequence that is not in the pool', () => {
    const pool = createPool({ blockSize: 4 })
    expect(() => appendToken(pool, 3)).toThrow(RangeError)
    expect(() => forkSequence(pool, 0)).toThrow(RangeError)
  })
})
