import { describe, expect, it } from 'vitest'
import {
  HIERARCHY,
  adamUpdateIntensity,
  allReduceBytes,
  attentionFootprint,
  dataParallel,
  kernelIntensity,
  matmulIntensity,
  memoryHierarchy,
  pipelineBubble,
  pipelineParallel,
  tensorParallel,
} from './systems.js'
import { ACCELERATORS, trainingStepFlops } from './architecture.js'
import type { Architecture } from './architecture.js'

const model: Architecture = {
  contextLength: 2048,
  dModel: 768,
  heads: 12,
  dFf: 3072,
  layers: 12,
  vocabSize: 32000,
}

describe('the memory hierarchy', () => {
  it('places the working set against every level', () => {
    const report = memoryHierarchy(model, 2048)
    expect(report.rows.map((row) => row.key)).toEqual(['smem', 'l2', 'hbm'])
    expect(report.workingSet).toBe(report.memory.total)
    expect(report.activationShare).toBeGreaterThan(0)
    expect(report.activationShare).toBeLessThan(1)
    for (const row of report.rows) {
      expect(row.balancePoint).toBeCloseTo(HIERARCHY.peakFlops / row.bandwidth, 6)
      expect(row.passes).toBeGreaterThan(0)
    }
  })

  it('shows the optimizer update below every balance point', () => {
    const update = adamUpdateIntensity()
    expect(update.intensity).toBeCloseTo(10 / 22, 10)
    for (const level of HIERARCHY.levels) {
      expect(update.intensity).toBeLessThan(HIERARCHY.peakFlops / level.bandwidth)
    }
  })

  it('shows a square matrix multiply above the balance point', () => {
    // 2mnk operations over 3·768² values at two bytes: width / 3 operations per byte.
    expect(matmulIntensity(768, 768, 768)).toBeCloseTo(256, 6)
    expect(matmulIntensity(768, 768, 768)).toBeGreaterThan(
      HIERARCHY.peakFlops / HIERARCHY.levels[0]!.bandwidth,
    )
  })
})

describe('parallelism', () => {
  it('costs nothing to all-reduce on one device', () => {
    expect(allReduceBytes(1000, 1)).toBe(0)
    expect(allReduceBytes(1000, 8)).toBeCloseTo(2 * 1000 * (7 / 8), 10)
  })

  it('splits the step across devices and all-reduces the gradients', () => {
    const step = trainingStepFlops(model, 2048) * 8
    const report = dataParallel(model, 2048, 8, 8)
    expect(report.flopsPerDevice).toBeCloseTo(step / 8, 0)
    expect(report.communicationBytes).toBeGreaterThan(0)
    expect(report.overhead).toBeGreaterThan(0)
  })

  it('makes tensor parallelism communicate with the sequence, not the parameters', () => {
    const shortData = dataParallel(model, 512, 8, 8)
    const longData = dataParallel(model, 2048, 8, 8)
    expect(longData.communicationBytes).toBe(shortData.communicationBytes)

    const shortTensor = tensorParallel(model, 512, 8, 8)
    const longTensor = tensorParallel(model, 2048, 8, 8)
    expect(longTensor.communicationBytes).toBeCloseTo(shortTensor.communicationBytes * 4, 0)
  })

  it('pays for the pipeline fill and drain', () => {
    expect(pipelineBubble(1, 8)).toBe(0)
    expect(pipelineBubble(4, 8)).toBeCloseTo(3 / 11, 10)
    const report = pipelineParallel(model, 2048, 8, 4, 8)
    expect(report.devices).toBe(4)
    expect(report.overhead).toBeGreaterThan(0)
  })
})

describe('the attention kernel', () => {
  it('tiles the scores matrix and keeps the FLOPs', () => {
    const small = attentionFootprint(model, 1024)
    const large = attentionFootprint(model, 8192)
    expect(large.ratio).toBeGreaterThan(small.ratio)
    expect(large.ratio).toBeGreaterThan(10)
    expect(large.flops).toBeGreaterThan(small.flops)
    // The materialised footprint is quadratic; the tiled one is not.
    expect(large.materialised / small.materialised).toBeGreaterThan(16)
    expect(large.tiled / small.tiled).toBeLessThan(16)
  })

  it('is memory bound against the reported accelerator', () => {
    const accelerator = ACCELERATORS['h100-sxm']!
    const balancePoint = accelerator.peakFlops / accelerator.bandwidth
    expect(kernelIntensity(model, 8192)).toBeLessThan(balancePoint)
  })
})
