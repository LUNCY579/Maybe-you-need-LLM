import { describe, expect, it } from 'vitest'
import {
  ALL_TARGETS,
  ATTENTION_TARGETS,
  BYTES_PER_PARAMETER,
  PAPER_RULE_OF_THUMB,
  SEVENTY_BILLION,
  adapterSize,
  activationBytes,
  blockShapes,
  fitsOnDevice,
  fineTunePlans,
  linearParameters,
  loraParameters,
  memoryBudget,
  modelParameters,
  rankLadder,
} from './finetune'
import { EXAMPLE_MODEL } from './kvcache'
import type { ModelShape } from './kvcache'

const GIB = 1024 ** 3
/** One eighty-gigabyte accelerator, which is the device every one of these runs is quoted against. */
const DEVICE = 80 * GIB

const sum = (rows: { bytes: number }[]) => rows.reduce((a, row) => a + row.bytes, 0)

describe('the block’s matrices', () => {
  it('are the six projections, with the widths the model shape says they have', () => {
    const shapes = blockShapes(SEVENTY_BILLION)
    expect(shapes.map((shape) => shape.name)).toEqual(ALL_TARGETS)
    expect(ATTENTION_TARGETS.every((name) => ALL_TARGETS.includes(name))).toBe(true)
    const width = SEVENTY_BILLION.heads * SEVENTY_BILLION.headDimension
    expect(width).toBe(8192)
    for (const shape of shapes.slice(0, 4)) {
      expect(shape.inputs).toBe(width)
      expect(shape.outputs).toBe(width)
    }
    // The feed-forward block is the wide one, and it is the one the adapter is
    // proportionally smallest on.
    expect(shapes[4]!.inputs).toBe(width)
    expect(shapes[4]!.outputs).toBe(SEVENTY_BILLION.ffnWidth)
    expect(shapes[5]!.inputs).toBe(SEVENTY_BILLION.ffnWidth)
    expect(shapes[5]!.outputs).toBe(width)
  })

  it('cost r·(d+k): linear in the rank and in the sum of the widths', () => {
    const square = blockShapes(SEVENTY_BILLION)[0]!
    const wide = blockShapes(SEVENTY_BILLION)[4]!
    expect(loraParameters(square, 1)).toBe(square.inputs + square.outputs)
    expect(linearParameters(square)).toBe(square.inputs * square.outputs)
    // Doubling the rank doubles the adapter, exactly.
    for (const rank of [1, 2, 4, 8, 16, 32, 64]) {
      expect(loraParameters(square, rank)).toBe(rank * loraParameters(square, 1))
    }
    expect(loraParameters(square, 0)).toBe(0)
    expect(loraParameters(square, -4)).toBe(0)
    // The sum rather than the product is the entire trick: on the wide matrix
    // the frozen tensor is 3.5 times bigger, but its adapter is only 2.25 times
    // bigger, because the rank pays for both widths once rather than their
    // product.
    expect(linearParameters(wide) / linearParameters(square)).toBeCloseTo(
      SEVENTY_BILLION.ffnWidth / (SEVENTY_BILLION.heads * SEVENTY_BILLION.headDimension),
      6,
    )
    expect(loraParameters(wide, 16) / loraParameters(square, 16)).toBeCloseTo(
      (wide.inputs + wide.outputs) / (square.inputs + square.outputs),
      6,
    )
    expect(loraParameters(wide, 16) / loraParameters(square, 16)).toBeLessThan(
      linearParameters(wide) / linearParameters(square),
    )
  })
})

describe('the adapters', () => {
  it('are a fraction of a percent of the model at every rank', () => {
    const model = SEVENTY_BILLION
    const shapes = blockShapes(model)
    const frozenPerBlock = shapes.reduce((a, shape) => a + linearParameters(shape), 0)
    const size = adapterSize(model, 64, ALL_TARGETS)
    expect(size.perBlock).toBe(64 * shapes.reduce((a, shape) => a + shape.inputs + shape.outputs, 0))
    expect(size.trainable).toBe(size.perBlock * model.layers)
    expect(size.frozen).toBe(frozenPerBlock * model.layers)
    expect(size.fraction).toBeCloseTo(size.trainable / (size.trainable + size.frozen), 12)
    expect(size.perFrozen).toBeCloseTo(size.trainable / size.frozen, 12)
    expect(size.fraction).toBeLessThan(0.02)
    expect(size.targets).toEqual(ALL_TARGETS)
    // The linear ladder, one rung per rank, each double the one before.
    const ladder = rankLadder(model)
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]!.trainable).toBeCloseTo(2 * ladder[i - 1]!.trainable, 6)
      expect(ladder[i]!.bytes).toBeCloseTo(2 * ladder[i - 1]!.bytes, 6)
    }
    // A rank of one on every matrix is still under a hundredth of a percent.
    expect(ladder[0]!.fraction).toBeLessThan(0.001)
    expect(ladder[0]!.rank).toBe(1)
  })

  it('put the adapter on the feed-forward block, which is where the frozen mass is', () => {
    const attention = adapterSize(SEVENTY_BILLION, 64, ATTENTION_TARGETS)
    const all = adapterSize(SEVENTY_BILLION, 64, ALL_TARGETS)
    // More matrices adapted means more trainable parameters — and, because the
    // two feed-forward matrices hold three quarters more frozen weight than the
    // four projections do, adapting them makes the trainable *fraction* of what
    // is adapted go down even as the count goes up.
    expect(all.trainable).toBeGreaterThan(attention.trainable)
    expect(all.fraction).toBeLessThan(attention.fraction)
    // The two feed-forward matrices are worth more than the four projections
    // put together, which is why the papers that adapt only attention leave
    // most of the cheap capacity on the table.
    expect(all.trainable - attention.trainable).toBeGreaterThan(attention.trainable / 2)
    expect(all.trainable / attention.trainable).toBeGreaterThan(2)
    expect(all.trainable / attention.trainable).toBeLessThan(3)
    expect(all.frozen / attention.frozen).toBeCloseTo(
      1 + SEVENTY_BILLION.ffnWidth / (2 * SEVENTY_BILLION.heads * SEVENTY_BILLION.headDimension),
      6,
    )
  })

  it('are the same size whichever way the frozen model is stored', () => {
    const plans = fineTunePlans(SEVENTY_BILLION)
    const lora = plans.find((plan) => plan.name === 'LoRA')!
    const qlora = plans.find((plan) => plan.name === 'QLoRA')!
    expect(qlora.trainable).toBe(lora.trainable)
    expect(qlora.budget.trainableWeights).toBe(lora.budget.trainableWeights)
    expect(qlora.budget.gradients).toBe(lora.budget.gradients)
    expect(qlora.budget.optimizerStates).toBe(lora.budget.optimizerStates)
    // The entire difference between them is the width the frozen model is kept
    // in: bf16 against NF4, which is four times the bytes per parameter.
    expect(lora.budget.frozenWeights).toBeCloseTo(qlora.budget.frozenWeights * 4, 6)
    expect(lora.budget.totalBytes - qlora.budget.totalBytes).toBeCloseTo(
      lora.budget.frozenWeights - qlora.budget.frozenWeights,
      6,
    )
  })
})

describe('the memory budget', () => {
  it('is sixteen bytes per parameter for a whole fine-tune with no activations', () => {
    const parameters = modelParameters(SEVENTY_BILLION)
    expect(parameters).toBe(70e9)
    const budget = memoryBudget({ parameters, trainable: parameters, activationBytes: 0 })
    // Two of weights, two of gradient, twelve of Adam — and the weights row is
    // empty because in a full fine-tune nothing is frozen.
    expect(budget.frozenWeights).toBe(0)
    expect(budget.perParameterBytes).toBe(
      BYTES_PER_PARAMETER.bf16 + BYTES_PER_PARAMETER.bf16 + 12,
    )
    expect(budget.perParameterBytes).toBe(16)
    expect(budget.totalBytes).toBe(parameters * 16)
    expect(sum(budget.rows)).toBe(budget.totalBytes)
    for (const row of budget.rows) expect(row.perParameter).toBeCloseTo(row.bytes / parameters, 6)
    // The bookkeeping is the expensive part, not the weights: the optimizer
    // alone costs six times what the trainable weights do.
    expect(budget.optimizerStates).toBe(6 * budget.trainableWeights)
    expect(budget.optimizerStates + budget.gradients).toBeGreaterThan(budget.trainableWeights * 6)
  })

  it('charges gradients and optimizer states only for what moves', () => {
    const parameters = modelParameters(SEVENTY_BILLION)
    const adapters = adapterSize(SEVENTY_BILLION, 64, ALL_TARGETS)
    const budget = memoryBudget({
      parameters,
      trainable: adapters.trainable,
      frozenBytes: BYTES_PER_PARAMETER.nf4,
      activationBytes: 0,
    })
    expect(budget.trainableWeights).toBe(adapters.trainable * 2)
    expect(budget.gradients).toBe(adapters.trainable * 2)
    expect(budget.optimizerStates).toBe(adapters.trainable * 12)
    expect(budget.frozenWeights).toBe((parameters - adapters.trainable) * 0.5)
    expect(budget.perParameterBytes).toBeLessThan(1)
    // The frozen weights are the model minus the adapters, not the whole model:
    // a parameter that moves is not also stored as frozen.
    expect(budget.frozenWeights + budget.trainableWeights).toBeLessThan(parameters * 2)
    // Asking for the compute-type copy is the one term that is pure overhead.
    const withCopy = memoryBudget({
      parameters,
      trainable: adapters.trainable,
      frozenBytes: BYTES_PER_PARAMETER.nf4,
      frozenComputeCopy: true,
      activationBytes: 0,
    })
    expect(withCopy.frozenComputeCopy).toBe(budget.frozenWeights * 4)
    expect(withCopy.totalBytes).toBe(budget.totalBytes + withCopy.frozenComputeCopy)
  })

  it('does not care how the weights are stored, which is what checkpointing is for', () => {
    const model = SEVENTY_BILLION
    const options = { batchSize: 4, sequenceLength: 2048 }
    const kept = activationBytes(model, options)
    const checkpointed = activationBytes(model, { ...options, checkpointed: true })
    // Checkpointing keeps the block boundaries and rebuilds the inside of a
    // layer when the gradient needs it, so it keeps one layer out of eighty.
    expect(kept / checkpointed).toBeCloseTo(model.layers, 6)
    // Linear in the batch and in the length, because the activations are a
    // tensor of that shape and nothing else.
    expect(activationBytes(model, { ...options, batchSize: 8 })).toBe(2 * kept)
    expect(activationBytes(model, { ...options, sequenceLength: 1024 })).toBe(kept / 2)
    expect(activationBytes(model, { ...options, bytesPerElement: 1 })).toBe(kept / 2)
    expect(checkpointed).toBeGreaterThan(0)
  })

  it('lands in the same decade as the rule of thumb the paper quotes', () => {
    const plans = fineTunePlans(SEVENTY_BILLION)
    const byName = Object.fromEntries(plans.map((plan) => [plan.name, plan]))
    // The paper's figures are quoted, not derived here, and they are per
    // parameter over a model that also carries an embedding table and the
    // layernorms; this arithmetic covers the same terms and nothing else. The
    // test therefore checks the order, not the number.
    expect(byName['full fine-tune']!.budget.perParameterBytes).toBeGreaterThan(PAPER_RULE_OF_THUMB.fullFineTune / 2)
    expect(byName['full fine-tune']!.budget.perParameterBytes).toBeLessThan(PAPER_RULE_OF_THUMB.fullFineTune * 1.5)
    expect(byName.LoRA!.budget.perParameterBytes).toBeGreaterThan(PAPER_RULE_OF_THUMB.lora / 2)
    expect(byName.LoRA!.budget.perParameterBytes).toBeLessThan(PAPER_RULE_OF_THUMB.lora * 1.5)
    expect(byName.QLoRA!.budget.perParameterBytes).toBeLessThan(PAPER_RULE_OF_THUMB.qlora)
    // The ordering the papers argue for, and the sizes of the two steps.
    expect(byName.QLoRA!.budget.totalBytes).toBeLessThan(byName.LoRA!.budget.totalBytes)
    expect(byName.LoRA!.budget.totalBytes).toBeLessThan(byName['full fine-tune']!.budget.totalBytes)
    expect(byName.QLoRA!.budget.totalBytes / byName['full fine-tune']!.budget.totalBytes).toBeLessThan(0.05)
  })

  it('is the whole of the story about which of the three runs on one card', () => {
    const plans = fineTunePlans(SEVENTY_BILLION)
    expect(plans.map((plan) => plan.name)).toEqual(['full fine-tune', 'LoRA', 'QLoRA'])
    const verdicts = plans.map((plan) => fitsOnDevice(plan.budget, DEVICE))
    expect(verdicts.map((v) => v.fits)).toEqual([false, false, true])
    // LoRA is within twice the card, which is a multi-GPU job; the whole
    // fine-tune is an order of magnitude out, which is a cluster.
    expect(verdicts[1]!.fraction).toBeGreaterThan(1)
    expect(verdicts[1]!.fraction).toBeLessThan(2)
    expect(verdicts[0]!.fraction).toBeGreaterThan(10)
    expect(verdicts[2]!.headroomBytes).toBeGreaterThan(0)
    expect(verdicts[0]!.headroomBytes).toBeLessThan(0)
    // A card with room for the LoRA run is a card with room for it: the
    // fraction is the same arithmetic read the other way.
    const roomy = 200 * GIB
    expect(fitsOnDevice(plans[1]!.budget, roomy).fits).toBe(true)
    expect(fitsOnDevice(plans[1]!.budget, roomy).fraction).toBeLessThan(1)
    expect(fitsOnDevice(plans[1]!.budget, 0).fraction).toBe(Number.POSITIVE_INFINITY)
  })

  it('moves with the rank and with the batch, and only one of those is nearly free', () => {
    const at = (rank: number, batchSize: number) =>
      fineTunePlans(SEVENTY_BILLION, { rank, batchSize })
    const low = at(8, 1)
    const high = at(128, 1)
    const bigBatch = at(8, 32)
    // Sixteen times the rank, and the QLoRA run grows by a half, because the
    // term the rank multiplies is a percent of the total.
    expect(high[2]!.trainable).toBeGreaterThan(low[2]!.trainable * 15)
    expect(high[2]!.budget.totalBytes).toBeLessThan(low[2]!.budget.totalBytes * 1.75)
    expect(high[2]!.budget.perParameterBytes).toBeGreaterThan(low[2]!.budget.perParameterBytes)
    // And the frozen row shrinks by exactly the parameters that stopped being
    // frozen: a trainable parameter is not also stored as a frozen one.
    expect(high[2]!.budget.frozenWeights).toBeLessThan(low[2]!.budget.frozenWeights)
    expect(low[2]!.budget.frozenWeights - high[2]!.budget.frozenWeights).toBeCloseTo(
      (high[2]!.trainable - low[2]!.trainable) * BYTES_PER_PARAMETER.nf4,
      6,
    )
    // The batch, though, multiplies the activations, which QLoRA does not
    // shrink at all — which is why the paper's own batch is small.
    expect(bigBatch[2]!.budget.activations).toBe(32 * low[2]!.budget.activations)
    expect(bigBatch[2]!.budget.totalBytes).toBeGreaterThan(low[2]!.budget.totalBytes)
    expect(fitsOnDevice(bigBatch[2]!.budget, DEVICE).fits).toBe(true)
    expect(fitsOnDevice(at(8, 512)[2]!.budget, DEVICE).fits).toBe(false)
  })

  it('treats a smaller model as the same arithmetic at a different size', () => {
    const small: ModelShape = { layers: 12, heads: 12, headDimension: 64, ffnWidth: 2048, parametersPerLayer: 10 }
    expect(modelParameters(small)).toBe(120e6)
    expect(modelParameters(EXAMPLE_MODEL)).toBe(modelParameters(SEVENTY_BILLION))
    const plans = fineTunePlans(small, { rank: 16, batchSize: 2, sequenceLength: 512 })
    for (const plan of plans) expect(plan.budget.totalBytes).toBeGreaterThan(0)
    // One card is not a constraint at this size, in any of the three schemes.
    for (const plan of plans) expect(fitsOnDevice(plan.budget, DEVICE).fits).toBe(true)
    // And the full fine-tune is the only one whose trainable count is the model.
    expect(plans[0]!.trainable).toBe(modelParameters(small))
    expect(plans[1]!.trainable).toBeLessThan(plans[0]!.trainable / 10)
  })
})
