/**
 * The attention computation, and the memory it costs.
 *
 * The naive attention computes the whole N×N score matrix, softmaxes it, and
 * multiplies it by the values. The matrix is never needed again after that,
 * but it has to exist, and at a long context it is the largest thing in the
 * program.
 *
 * The tiled algorithm computes the same answer without ever building it: the
 * queries are processed in blocks, the keys and values are streamed past in
 * blocks, and the softmax is accumulated as a running maximum and a running
 * sum. This module implements both, checks that they agree, and accounts for
 * the memory and the traffic each of them uses.
 */

/** A matrix of rows. */
export type Matrix = number[][]

export interface AttentionOptions {
  /** The block size for the tiled algorithm. */
  blockSize?: number
  /** The bytes each element occupies. */
  bytesPerElement?: number
  /** Whether the attention is causal. */
  causal?: boolean
  /** The number of bytes of SRAM the device has, for the working set. */
  sramBytes?: number
}

export interface AttentionResult {
  /** The output of the attention. */
  output: Matrix
  /** The peak memory the computation needs, in bytes. */
  peakMemoryBytes: number
  /** The bytes read from and written to the main memory. */
  hbmTrafficBytes: number
  /** The number of floating-point operations. */
  flops: number
  /** The number of times the keys and values are streamed past. */
  passes: number
}

function scaleFactor(dimension: number): number {
  return 1 / Math.sqrt(dimension)
}

/** The row of dot products between the queries and the keys. */
function scores(query: number[], keys: Matrix, dimension: number): number[] {
  const scale = scaleFactor(dimension)
  const row: number[] = new Array<number>(keys.length).fill(0)
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k]!
    let total = 0
    for (let d = 0; d < dimension; d++) total += (query[d] ?? 0) * (key[d] ?? 0)
    row[k] = total * scale
  }
  return row
}

/** The softmax of a row, and its sum. */
function softmaxRow(row: number[]): { probabilities: number[]; sum: number } {
  const maximum = Math.max(...row)
  const exponentials = row.map((value) => Math.exp(value - maximum))
  const sum = exponentials.reduce((a, b) => a + b, 0)
  return { probabilities: exponentials.map((value) => value / sum), sum }
}

/**
 * The naive attention.
 *
 * The score matrix is materialised, and so is the matrix of probabilities.
 * The peak memory is the size of the larger of them, and the traffic counts
 * the writes and the reads of both.
 */
export function naiveAttention(
  q: Matrix,
  k: Matrix,
  v: Matrix,
  options: AttentionOptions = {},
): AttentionResult {
  const settings = { blockSize: 64, bytesPerElement: 4, causal: false, sramBytes: 64 * 1024 * 1024, ...options }
  const n = q.length
  const dimension = q[0]?.length ?? 0

  const output: Matrix = []
  for (let i = 0; i < n; i++) {
    const row = scores(q[i]!, k, dimension)
    if (settings.causal) {
      for (let j = i + 1; j < row.length; j++) row[j] = -Infinity
    }
    const { probabilities } = softmaxRow(row)
    const result = new Array<number>(dimension).fill(0)
    for (let j = 0; j < k.length; j++) {
      const probability = probabilities[j] ?? 0
      if (probability === 0) continue
      const value = v[j]!
      for (let d = 0; d < dimension; d++) result[d] = (result[d] ?? 0) + probability * (value[d] ?? 0)
    }
    output.push(result)
  }

  const elements = settings.bytesPerElement
  // The score matrix, the probability matrix, the three inputs and the output.
  const peakMemoryBytes = n * n * elements
  const hbmTrafficBytes = (3 * n * dimension + 3 * n * n + n * dimension) * elements
  const flops = 2 * n * n * dimension * 2

  return { output, peakMemoryBytes, hbmTrafficBytes, flops, passes: 1 }
}

/**
 * The tiled attention.
 *
 * The queries are processed in blocks, and for each block the keys and values
 * are streamed past in blocks. The softmax is accumulated as a running
 * maximum, a running sum and a running weighted sum of the values, which is
 * what makes it possible to never hold the whole matrix.
 *
 * The answer is the same as the naive one, up to the order the sums are
 * added in.
 */
export function tiledAttention(
  q: Matrix,
  k: Matrix,
  v: Matrix,
  options: AttentionOptions = {},
): AttentionResult {
  const settings = { blockSize: 64, bytesPerElement: 4, causal: false, sramBytes: 64 * 1024 * 1024, ...options }
  const n = q.length
  const dimension = q[0]?.length ?? 0
  const block = Math.max(1, Math.min(settings.blockSize, n))

  const output: Matrix = []
  for (let start = 0; start < n; start += block) {
    const end = Math.min(n, start + block)
    const queries = q.slice(start, end)

    // The running state: the maximum, the sum, and the weighted sum.
    const runningMax = new Array<number>(end - start).fill(-Infinity)
    const runningSum = new Array<number>(end - start).fill(0)
    const accumulator: Matrix = queries.map(() => new Array<number>(dimension).fill(0))

    for (let kStart = 0; kStart < n; kStart += block) {
      const kEnd = Math.min(n, kStart + block)
      for (let i = start; i < end; i++) {
        const row = scores(q[i]!, k.slice(kStart, kEnd), dimension)
        // The causal mask, applied to the block.
        if (settings.causal) {
          for (let j = kStart; j < kEnd; j++) {
            if (j > i) row[j - kStart] = -Infinity
          }
        }
        const localMax = Math.max(...row)
        const newMax = Math.max(runningMax[i - start] ?? -Infinity, localMax)
        const correction = Math.exp((runningMax[i - start] ?? -Infinity) - newMax)

        let localSum = 0
        const weighted = new Array<number>(dimension).fill(0)
        for (let j = 0; j < row.length; j++) {
          const probability = Math.exp((row[j] ?? -Infinity) - newMax)
          localSum += probability
          const value = v[kStart + j]!
          for (let d = 0; d < dimension; d++) weighted[d] = (weighted[d] ?? 0) + probability * (value[d] ?? 0)
        }

        runningMax[i - start] = newMax
        runningSum[i - start] = (runningSum[i - start] ?? 0) * correction + localSum
        const acc = accumulator[i - start]!
        for (let d = 0; d < dimension; d++) {
          acc[d] = (acc[d] ?? 0) * correction + (weighted[d] ?? 0)
        }
      }
    }

    for (let i = start; i < end; i++) {
      const sum = runningSum[i - start] ?? 1
      const acc = accumulator[i - start]!
      output.push(acc.map((value) => value / (sum === 0 ? 1 : sum)))
    }
  }

  const elements = settings.bytesPerElement
  const queryBlocks = Math.ceil(n / block)
  // The output, the running state, and the tiles that live in SRAM.
  const workingSet = (n * dimension + 2 * n + 2 * block * dimension) * elements
  const peakMemoryBytes = Math.min(workingSet, settings.sramBytes)
  // The keys and the values are streamed past once per query block.
  const hbmTrafficBytes = (n * dimension + queryBlocks * 2 * n * dimension + n * dimension) * elements
  const flops = 2 * n * n * dimension * 2

  return { output, peakMemoryBytes, hbmTrafficBytes, flops, passes: queryBlocks }
}

/** The largest difference between two matrices, entry by entry. */
export function maxAbsDifference(a: Matrix, b: Matrix): number {
  let worst = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const rowA = a[i]!
    const rowB = b[i]!
    for (let d = 0; d < Math.min(rowA.length, rowB.length); d++) {
      const difference = Math.abs((rowA[d] ?? 0) - (rowB[d] ?? 0))
      if (difference > worst) worst = difference
    }
  }
  return worst
}

/**
 * The memory the *training* run needs.
 *
 * The naive version has to keep the matrix of probabilities, because the
 * backward pass needs it. The tiled version keeps nothing of the sort: it
 * recomputes the blocks when it needs them, which is arithmetic spent in
 * exchange for memory.
 */
export function trainingMemoryBytes(
  n: number,
  dimension: number,
  options: { bytesPerElement?: number; tiled?: boolean; blockSize?: number } = {},
): number {
  const settings = { bytesPerElement: 4, tiled: false, blockSize: 64, ...options }
  if (!settings.tiled) return n * n * settings.bytesPerElement
  const block = Math.max(1, Math.min(settings.blockSize, n))
  return (n * dimension + 2 * n + 2 * block * dimension) * settings.bytesPerElement
}

/**
 * The arithmetic the recomputation buys.
 *
 * The tiled algorithm does the forward pass once and the backward pass twice
 * over the scores, so it does more arithmetic than the naive one — and the
 * extra arithmetic is what pays for the memory.
 */
export function recomputationFactor(tiled: boolean): number {
  return tiled ? 1.5 : 1
}

/**
 * The machine the kernel runs on.
 *
 * Two numbers decide which regime a kernel is in: how many operations it can
 * do per second, and how many bytes it can move per second. Their ratio is
 * the *balance point* — the arithmetic intensity at which the two are equally
 * the constraint. Below it a kernel is IO-bound and no amount of clever
 * arithmetic helps; above it the arithmetic is the constraint and the memory
 * system is idle.
 *
 * The device below is an order of magnitude, not a measurement. Nothing in
 * this module depends on the exact figures: what matters is that the balance
 * point is in the hundreds of operations per byte, while an attention kernel
 * that materialises its score matrix has an intensity of about one.
 */
export interface DeviceModel {
  /** Operations per second at the dense fp16/bf16 rate. */
  flopsPerSecond: number
  /** Bytes per second between the high-bandwidth memory and the compute unit. */
  memoryBandwidthBytesPerSecond: number
  /** Bytes of on-chip memory one thread block may use. */
  sramBytes: number
}

/** A contemporary accelerator, quoted at the order-of-magnitude level. */
export const EXAMPLE_DEVICE: DeviceModel = {
  flopsPerSecond: 3.1e14,
  memoryBandwidthBytesPerSecond: 1.55e12,
  /** About one hundred and ninety kilobytes: the on-chip memory of one SM. */
  sramBytes: 1.9e5,
}

/** The arithmetic intensity at which this machine switches from IO-bound to compute-bound. */
export function machineBalance(device: DeviceModel): number {
  return device.flopsPerSecond / device.memoryBandwidthBytesPerSecond
}

/** Operations per byte of memory traffic. */
export function arithmeticIntensity(flops: number, bytes: number): number {
  return bytes === 0 ? 0 : flops / bytes
}

export interface KernelProfile {
  flops: number
  bytes: number
  intensity: number
  /** Which of the two constraints the kernel runs into. */
  bound: 'memory' | 'compute'
  /** The seconds the kernel takes: whichever of the two is slower. */
  seconds: number
  /** The traffic alone would have cost this much, and the arithmetic alone this much. */
  memorySeconds: number
  computeSeconds: number
}

/**
 * How long a kernel takes, and why.
 *
 * A kernel that is good at neither of its two jobs runs at the speed of the
 * one it is worse at: the traffic and the arithmetic overlap, so the time is
 * the maximum of the two rather than their sum. That is the whole of the IO
 * argument — a kernel that moves N² bytes of score matrix has an enormous
 * traffic term and a small arithmetic term, and it runs at the speed of the
 * traffic however many tensor cores the machine has.
 */
export function kernelProfile(
  flops: number,
  bytes: number,
  device: DeviceModel = EXAMPLE_DEVICE,
): KernelProfile {
  const memorySeconds = bytes / device.memoryBandwidthBytesPerSecond
  const computeSeconds = flops / device.flopsPerSecond
  const intensity = arithmeticIntensity(flops, bytes)
  return {
    flops,
    bytes,
    intensity,
    bound: intensity >= machineBalance(device) ? 'compute' : 'memory',
    seconds: Math.max(memorySeconds, computeSeconds),
    memorySeconds,
    computeSeconds,
  }
}

/**
 * The traffic of the naive kernel, from its own bookkeeping.
 *
 * The score matrix is written once and read back twice — once to softmax,
 * once to multiply by the values — and that is Θ(N²), which is quadratic in
 * the context while the useful output is only N·d.
 */
export function naiveKernelProfile(
  n: number,
  dimension: number,
  options: { bytesPerElement?: number; device?: DeviceModel } = {},
): KernelProfile {
  const bytes = (3 * n * dimension + 3 * n * n + n * dimension) * (options.bytesPerElement ?? 4)
  return kernelProfile(2 * n * n * dimension * 2, bytes, options.device ?? EXAMPLE_DEVICE)
}

/**
 * The block size a thread block may use.
 *
 * One block holds the keys and the values it is streaming past, so the on-chip
 * memory sets the width: twice the block times the dimension times the bytes
 * per element has to fit. Everything past that does not fit and has to be
 * spilled, which is the traffic the exercise is meant to avoid.
 */
export function blockSizeForSram(
  dimension: number,
  options: { sramBytes?: number; bytesPerElement?: number } = {},
): number {
  const settings = { sramBytes: EXAMPLE_DEVICE.sramBytes, bytesPerElement: 4, ...options }
  return Math.max(1, Math.floor(settings.sramBytes / (2 * dimension * settings.bytesPerElement)))
}

/**
 * The traffic the tiled kernel pays.
 *
 * The queries and the output are touched once each. The keys and the values
 * are re-read once per query block, so the traffic is Θ(N²d) divided by the
 * block size — and the block size is set by the on-chip memory, which is why
 * the paper's bound is written Θ(N²d²/M) for M bytes of it.
 */
export function tiledKernelProfile(
  n: number,
  dimension: number,
  options: { bytesPerElement?: number; blockSize?: number; sramBytes?: number; device?: DeviceModel } = {},
): KernelProfile {
  const bytesPerElement = options.bytesPerElement ?? 4
  const block = options.blockSize ?? blockSizeForSram(dimension, options)
  const queryBlocks = Math.ceil(n / Math.max(1, Math.min(block, n)))
  const bytes = (n * dimension + queryBlocks * 2 * n * dimension + n * dimension) * bytesPerElement
  return kernelProfile(2 * n * n * dimension * 2, bytes, options.device ?? EXAMPLE_DEVICE)
}

/** The bound the paper states, computed from the on-chip memory rather than from a block size. */
export function ioBoundTrafficBytes(
  n: number,
  dimension: number,
  sramBytes: number,
  options: { bytesPerElement?: number } = {},
): number {
  const bytesPerElement = options.bytesPerElement ?? 4
  // Θ(N²d²/M): the keys and values stream past once per query block, and the
  // block holds M/(2d) of them.
  const queryBlocks = Math.ceil((2 * n * dimension * bytesPerElement) / Math.max(1, sramBytes))
  return queryBlocks * 2 * n * dimension * bytesPerElement
}

/**
 * The speed-up the tiling buys at a given length.
 *
 * It is not a constant. At a short context the score matrix is small and both
 * kernels take about the same time, so tiling buys little; the ratio grows with
 * the length, because the traffic it removes is the N² score matrix and the
 * traffic it keeps is the keys and values re-read once per query block.
 *
 * Then it settles, and where it settles is arithmetic. Both kernels are
 * memory-bound at the long end — the naive one runs at three N² bytes of
 * traffic, the tiled one at two N²d over the block size — so their ratio tends
 * to three halves of the block size over the head dimension. The block size is
 * set by the on-chip memory, which is the sentence that says a machine with
 * more SRAM gets a bigger saving, and it is why the speed-up is a bounded
 * number rather than the unbounded one a Θ(N²) to Θ(N) argument suggests.
 */
export function tilingSpeedup(
  n: number,
  dimension: number,
  options: { bytesPerElement?: number; blockSize?: number; device?: DeviceModel } = {},
): { naiveSeconds: number; tiledSeconds: number; speedup: number } {
  const naive = naiveKernelProfile(n, dimension, options)
  const tiled = tiledKernelProfile(n, dimension, options)
  return {
    naiveSeconds: naive.seconds,
    tiledSeconds: tiled.seconds,
    speedup: tiled.seconds === 0 ? 0 : naive.seconds / tiled.seconds,
  }
}

/**
 * The IO-bound wall.
 *
 * The naive kernel is memory-bound at every length this machine model allows:
 * its intensity rises with the context and then flattens at one third of the
 * head dimension, because the score matrix it writes grows N² and the work it
 * does with it grows N²d. With a head dimension of a hundred and twenty-eight
 * that limit is around forty operations per byte, against the machine's two
 * hundred. So there is no length below which the traffic hides — there is only
 * the length below which the traffic does not have to happen at all.
 *
 * That is this number. A score matrix of N² entries fits in the on-chip memory
 * up to N of sqrt(M/b), and a kernel that keeps it there never writes it to the
 * high-bandwidth memory. Past that length every extra token adds a row and a
 * column to something that has to go through HBM twice, and tiling is what
 * keeps it from doing so.
 */
export function ioBoundWall(
  dimension: number,
  options: { bytesPerElement?: number; device?: DeviceModel; maxLength?: number } = {},
): { length: number; scoreMatrixBytes: number; naiveIntensityLimit: number } {
  const settings = { bytesPerElement: 4, device: EXAMPLE_DEVICE, maxLength: Number.MAX_SAFE_INTEGER }
  const bytesPerElement = options.bytesPerElement ?? settings.bytesPerElement
  const device = options.device ?? settings.device
  const capacity = device.sramBytes
  const length = Math.min(settings.maxLength, Math.max(1, Math.floor(Math.sqrt(capacity / bytesPerElement))))
  return {
    length,
    scoreMatrixBytes: length * length * bytesPerElement,
    // The intensity of the naive kernel as N goes to infinity, from the traffic
    // model above: the N² terms dominate and the N²d cancels against the N².
    naiveIntensityLimit: dimension / 3,
  }
}

/**
 * What the block size does to the tiled kernel.
 *
 * A bigger block is re-read less often, so the traffic falls; but past the
 * on-chip memory the block does not fit, and a kernel that spills is worse
 * than one that never tried. The curve is the argument for choosing the
 * block from the hardware rather than from taste.
 */
export function blockSizeSweep(
  n: number,
  dimension: number,
  options: { bytesPerElement?: number; device?: DeviceModel; sizes?: number[] } = {},
): { blockSize: number; bytes: number; seconds: number; fits: boolean }[] {
  const settings = { bytesPerElement: 4, device: EXAMPLE_DEVICE, sizes: [1, 2, 4, 8, 16, 32, 64, 128] }
  const sizes = options.sizes ?? settings.sizes
  const capacity = (options.device ?? settings.device).sramBytes
  return sizes.map((blockSize) => {
    const profile = tiledKernelProfile(n, dimension, {
      blockSize,
      bytesPerElement: options.bytesPerElement ?? settings.bytesPerElement,
      device: options.device ?? settings.device,
    })
    return {
      blockSize,
      bytes: profile.bytes,
      seconds: profile.seconds,
      fits: 2 * blockSize * dimension * (options.bytesPerElement ?? settings.bytesPerElement) <= capacity,
    }
  })
}
