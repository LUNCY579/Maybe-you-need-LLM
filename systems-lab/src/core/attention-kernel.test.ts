import { describe, expect, it } from 'vitest'
import {
  EXAMPLE_DEVICE,
  arithmeticIntensity,
  blockSizeForSram,
  blockSizeSweep,
  ioBoundTrafficBytes,
  ioBoundWall,
  kernelProfile,
  machineBalance,
  naiveKernelProfile,
  tiledKernelProfile,
  tilingSpeedup,
} from './attention'

/**
 * The claims the FlashAttention screen makes about a machine.
 *
 * The device figures are quoted at the order of magnitude, so nothing here
 * asserts a precise hardware number — what the tests check is the shape the
 * roofline argument has: which of the two constraints a kernel runs into, what
 * the traffic of each kernel is, and where the ratio of the two settles.
 */
describe('the roofline', () => {
  it('is the rate at which the machine stops waiting for memory', () => {
    expect(machineBalance(EXAMPLE_DEVICE)).toBeCloseTo(200, 0)
    // A kernel at exactly the balance point takes as long to read as to compute.
    const at = kernelProfile(200, 1)
    expect(at.seconds).toBeCloseTo(at.memorySeconds, 10)
    expect(at.seconds).toBeCloseTo(at.computeSeconds, 10)
    expect(at.bound).toBe('compute')
  })

  it('runs a kernel at the speed of the constraint it hits, not the sum of both', () => {
    const slowRead = kernelProfile(10, 1_000_000)
    expect(slowRead.bound).toBe('memory')
    expect(slowRead.seconds).toBeCloseTo(slowRead.memorySeconds, 12)
    expect(slowRead.seconds).toBeLessThan(slowRead.memorySeconds + slowRead.computeSeconds)
    const slowCompute = kernelProfile(1_000_000, 10)
    expect(slowCompute.bound).toBe('compute')
    expect(slowCompute.seconds).toBeCloseTo(slowCompute.computeSeconds, 12)
  })

  it('counts operations per byte, and gives zero for a kernel that reads nothing', () => {
    expect(arithmeticIntensity(6, 3)).toBe(2)
    expect(arithmeticIntensity(6, 0)).toBe(0)
  })

  it('leaves the naive kernel memory-bound at every length', () => {
    // Its intensity rises with the context and flattens at one third of the
    // head dimension, which is far under this machine's balance point.
    const short = naiveKernelProfile(64, 128)
    const long = naiveKernelProfile(65536, 128)
    expect(short.bound).toBe('memory')
    expect(long.bound).toBe('memory')
    expect(long.intensity).toBeGreaterThan(short.intensity)
    expect(long.intensity).toBeCloseTo(128 / 3, 0)
    expect(long.intensity).toBeLessThan(machineBalance(EXAMPLE_DEVICE))
  })

  it('writes the score matrix three times over, which is the traffic tiling removes', () => {
    const n = 4096
    const naive = naiveKernelProfile(n, 128)
    const scoreMatrix = n * n * 4
    // Read once to softmax, read again for the values, written once: three of
    // them, against the queries, keys, values and output that both kernels pay.
    expect(naive.bytes).toBeGreaterThan(3 * scoreMatrix)
    expect(naive.bytes).toBeLessThan(3.2 * scoreMatrix)
    expect(tiledKernelProfile(n, 128).bytes).toBeLessThan(naive.bytes / 2)
  })

  it('matches the Θ(N²d²/M) bound the paper states', () => {
    // The tiled kernel's own traffic, measured against the bound computed from
    // the on-chip memory rather than from a block size.
    for (const [n, d] of [[1024, 64], [4096, 64], [2048, 128], [8192, 128]] as const) {
      const ratio = tiledKernelProfile(n, d).bytes / ioBoundTrafficBytes(n, d, EXAMPLE_DEVICE.sramBytes)
      expect(ratio).toBeGreaterThan(0.99)
      expect(ratio).toBeLessThan(1.4)
    }
    // And it converges as the number of query blocks stops rounding up.
    const converging = [1024, 4096, 16384].map((n) => {
      const d = 128
      return tiledKernelProfile(n, d).bytes / ioBoundTrafficBytes(n, d, EXAMPLE_DEVICE.sramBytes)
    })
    expect(converging[2]).toBeLessThan(converging[0]!)
  })

  it('sizes the block from the on-chip memory, and from nothing else', () => {
    const block = blockSizeForSram(128)
    // Two of them (keys and values), the dimension wide, four bytes each.
    expect(block * 2 * 128 * 4).toBeLessThanOrEqual(EXAMPLE_DEVICE.sramBytes)
    expect((block + 1) * 2 * 128 * 4).toBeGreaterThan(EXAMPLE_DEVICE.sramBytes)
    // Half the bytes per element buys twice the block, give or take the whole
    // number of blocks the floor leaves behind.
    const halfWidth = blockSizeForSram(128, { bytesPerElement: 2 })
    expect(halfWidth).toBeGreaterThanOrEqual(2 * block - 1)
    expect(halfWidth).toBeLessThanOrEqual(2 * block + 1)
    // Twice the head dimension halves it.
    expect(blockSizeForSram(256)).toBe(Math.floor(EXAMPLE_DEVICE.sramBytes / (2 * 256 * 4)))
  })

  it('buys a saving that grows with the context and then stops growing', () => {
    const short = tilingSpeedup(64, 128)
    const medium = tilingSpeedup(512, 128)
    const long = tilingSpeedup(16384, 128)
    expect(short.speedup).toBeGreaterThan(1)
    expect(medium.speedup).toBeGreaterThan(short.speedup)
    expect(long.speedup).toBeGreaterThan(medium.speedup)
    // The limit is the ratio of the two kernels' leading traffic terms: three
    // N² bytes against two N²d over the block size.
    const block = blockSizeForSram(128)
    expect(long.speedup).toBeCloseTo((3 * block) / (2 * 128), 1)
    expect(tilingSpeedup(65536, 128).speedup).toBeCloseTo((3 * block) / (2 * 128), 1)
  })

  it('puts the wall where the score matrix stops fitting on the chip', () => {
    const wall = ioBoundWall(128)
    const bytes = (length: number) => length * length * 4
    expect(wall.length).toBeGreaterThan(1)
    expect(bytes(wall.length)).toBeLessThanOrEqual(EXAMPLE_DEVICE.sramBytes)
    expect(bytes(wall.length + 1)).toBeGreaterThan(EXAMPLE_DEVICE.sramBytes)
    expect(wall.scoreMatrixBytes).toBe(bytes(wall.length))
    // A wider head does not move it: the score matrix is N by N, not N by d.
    expect(ioBoundWall(64).length).toBe(wall.length)
  })

  it('rewards a bigger block only while the block fits', () => {
    const sweep = blockSizeSweep(4096, 64, { sizes: [16, 32, 64, 128, 256, 512, 1024] })
    const capacity = blockSizeForSram(64)
    for (const entry of sweep) expect(entry.fits).toBe(entry.blockSize <= capacity)
    const fitting = sweep.filter((entry) => entry.fits)
    for (let i = 1; i < fitting.length; i++) {
      expect(fitting[i]!.bytes).toBeLessThan(fitting[i - 1]!.bytes)
    }
    // Past the on-chip memory the traffic would keep falling, and the kernel
    // would spill; the sweep marks those rows rather than pretending they work.
    expect(sweep.filter((entry) => !entry.fits).length).toBeGreaterThan(0)
  })
})
