/**
 * The scenario each laboratory runs by default.
 *
 * A laboratory exists in two places: the browser, where the sliders start here, and
 * the terminal, where `tools/run-lab.mjs` prints the same numbers without a page to
 * open. That claim is only checkable if both read one list, so the defaults live here
 * rather than inside a `useState` call — and the runner's output is a reproduction of
 * the screen rather than a second opinion about it.
 *
 * These are the *starting* settings. Every screen lets a reader move them; nothing
 * here is a result. Where a number is a device's or a paper's rather than the
 * laboratory's own it lives in the core module that quotes it — `EXAMPLE_DEVICE`,
 * `SERVING_DEVICE`, `SEVENTY_BILLION` — and not here.
 */

/** A · attention's two algorithms, and the kernel arithmetic behind the tiling. */
export type AttentionScenario = {
  /** The sequence length, in tokens. */
  length: number
  /** One head's width, `d`. */
  dimension: number
  /** The block the query tile is sized by. */
  blockSize: number
  seed: number
}

/** B · the cache a decode step reads, the pool that holds it, and the batch it serves. */
export type KvCacheScenario = {
  /** The context each sequence carries. */
  context: number
  /** The sequences decoded together. */
  batch: number
  /** A cache block's tokens, which is the granularity paging allocates at. */
  blockSize: number
  layers: number
  heads: number
  headDimension: number
  /** Bytes per cached element: 2 for bf16, 1 for an eight-bit cache. */
  bytesPerElement: number
  /** The accelerators the serving question is asked of. */
  devices: number
}

/** C · the router, the loss that biases it, and the capacity that bounds it. */
export type MoeScenario = {
  experts: number
  /** Experts each token is sent to. */
  topK: number
  /** Tokens in the batch the router is shown. */
  tokens: number
  /** The bias planted on one expert, in units of the router's logits. */
  bias: number
  /** The multiple of the fair share an expert may hold. */
  capacityFactor: number
  /** The coefficient the balance loss is applied with — the controller's gain. */
  lambda: number
  /** How strongly the tokens' needs favour a few experts. */
  concentration: number
  /** Correction steps the spike view runs. */
  steps: number
  seed: number
}

/** D · the grid, the outlier that sizes it, and the migration that moves the outlier. */
export type QuantisationScenario = {
  /** Rows of the activation tensor — a batch of positions. */
  rows: number
  /** Its width, which is the model dimension and where the outlier lives. */
  width: number
  bits: number
  /** The channels sharing one grid, for the grouping view. */
  groupSize: number
  /** How much of the outlier moves from the activations to the weights. */
  alpha: number
  /** The channel the outlier is planted in. */
  outlierIndex: number
  /** How many times wider it is planted than an ordinary channel. */
  outlierScale: number
  /** The NF4 block, in weights. */
  blockSize: number
  seed: number
}

/** E · a draft, the target's check, and the two ways of choosing what to draft. */
export type SpeculativeScenario = {
  /** How far the draft's distribution is pushed from the target's. */
  noise: number
  /** Tokens a chain proposes per step. */
  draftLength: number
  /** One draft pass as a fraction of a target pass. */
  draftCost: number
  /** The tree's levels. */
  depth: number
  /** The tree's candidates at each level. */
  width: number
  /** Medusa's extra heads. */
  heads: number
  /** The noise head one carries, multiplied by its position. */
  headNoise: number
  seed: number
}

/** F · the adapter, the run's memory, and the card it has to fit on. */
export type FineTuneScenario = {
  /** The LoRA rank. */
  rank: number
  batchSize: number
  sequenceLength: number
  /** The card's memory, in gigabytes — the eighty of the papers. */
  deviceGigabytes: number
}

export const ATTENTION_DEFAULTS: AttentionScenario = {
  length: 64,
  dimension: 16,
  blockSize: 16,
  seed: 7,
}

export const KVCACHE_DEFAULTS: KvCacheScenario = {
  context: 512,
  batch: 32,
  blockSize: 16,
  layers: 80,
  heads: 64,
  headDimension: 128,
  bytesPerElement: 2,
  devices: 1,
}

export const MOE_DEFAULTS: MoeScenario = {
  experts: 8,
  topK: 2,
  tokens: 200,
  bias: 0,
  capacityFactor: 1.25,
  lambda: 0.15,
  concentration: 0.8,
  steps: 40,
  seed: 4,
}

export const QUANTISATION_DEFAULTS: QuantisationScenario = {
  rows: 64,
  width: 32,
  bits: 8,
  groupSize: 8,
  alpha: 0.5,
  outlierIndex: 3,
  outlierScale: 20,
  blockSize: 64,
  seed: 5,
}

export const SPECULATIVE_DEFAULTS: SpeculativeScenario = {
  noise: 0.15,
  draftLength: 4,
  draftCost: 0.1,
  depth: 4,
  width: 2,
  heads: 4,
  headNoise: 0.12,
  seed: 7,
}

export const FINETUNE_DEFAULTS: FineTuneScenario = {
  rank: 64,
  batchSize: 4,
  sequenceLength: 2048,
  deviceGigabytes: 80,
}

/** Every screen's defaults, keyed by the registry id, for the terminal runner. */
export const LAB_DEFAULTS: Record<string, Record<string, number>> = {
  attention: ATTENTION_DEFAULTS,
  kvcache: KVCACHE_DEFAULTS,
  moe: MOE_DEFAULTS,
  quantisation: QUANTISATION_DEFAULTS,
  speculative: SPECULATIVE_DEFAULTS,
  finetune: FINETUNE_DEFAULTS,
}
