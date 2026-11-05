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
 * here is a result.
 */

import type { MetricName } from '../core/percolation'

/** A · fitting a law to a ladder of training runs. */
export interface PowerLawScenario {
  /** How fast the task’s spectrum decays. */
  decay: number
  /** The label noise. */
  noise: number
  /** The random features the learner is given. */
  capacity: number
  seed: number
}

/** B · the best way to spend one budget, and the crossover behind it. */
export interface ComputeScenario {
  decay: number
  noise: number
  /** The compute the allocations are compared at. */
  budget: number
  seed: number
  /** The two sizes the crossover is taken between. */
  smallCapacity: number
  largeCapacity: number
}

/** C · the nest of IsoFLOP curves and the frontier through their minima. */
export interface IsoFlopScenario {
  decay: number
  noise: number
  seed: number
  /** The budget whose single curve is drawn at full resolution. */
  budget: number
  /** The budgets of the nest: this decade and the next two, two decades apart. */
  budgetDecadeStart: number
  /** The allocations along a curve. */
  points: number
  /** The corpus the "data runs out" question is asked against. */
  uniquePool: number
}

/** D · pruning a pool by a metric, and finding where the curve breaks. */
export interface PercolationScenario {
  /** The metric the descent is drawn for. */
  metric: MetricName
  /** How much of the pool carries a tail direction. */
  rareFraction: number
  /** How far a row’s reliability is visible in its inputs. */
  noiseCoupling: number
  /** The degradation of the metric itself: noise added to the log score. */
  metricNoise: number
  /** The keep fraction the composition panel is read at. */
  keep: number
  seed: number
}

/** E · the measured epoch curve: two runs, the same tokens, different data. */
export interface EpochsScenario {
  epochs: number
  /** The size of the unique pool the repeated run goes round. */
  unique: number
  batch: number
  learningRate: number
  /** Independent restarts the curves are averaged over. */
  runs: number
  /** The fraction of a fresh epoch’s gain at which repetition is said to dominate. */
  dominanceFraction: number
  seed: number
}

/** F · the closed-form effective-data law and the allocation it implies. */
export interface RepeatsScenario {
  unique: number
  capacity: number
  ridge: number
  /** The most repeats the measured comparison is drawn up to. */
  maxRepeats: number
  /** The paper’s fitted repetition constant, quoted rather than measured. */
  rDStar: number
  /** The pool the law is evaluated on, in tokens. */
  pool: number
  /** The epochs the schedule table is drawn out to. */
  epochs: number
  seed: number
}

/** G · one capability, two metrics, and the gap between their onsets. */
export interface EmergenceScenario {
  /** The length of the task, in tokens. */
  length: number
  /** The accuracy the exact-match metric needs to score half. */
  threshold: number
  /** The amplitude of the underlying capability’s growth. */
  amplitude: number
  /** The exponent of that growth against compute. */
  exponent: number
  /** The score below which the metric is said to have noticed nothing. */
  floor: number
  /** The per-token accuracy that counts as “the model can do it”, for the blindness count. */
  blindAt: number
}

/** H · a trend in FLOPs, the break inside it, and the year a loss becomes buyable. */
export interface HardwareScenario {
  decay: number
  noise: number
  seed: number
  /** Which era of the quoted compute series is being read. */
  era: number
  pointsPerEra: number
  /** The wall-clock a training run is allowed, in hours. */
  hours: number
  /** The loss the feasibility chain is asked to reach. */
  targetLoss: number
  /** The bridge from the surface’s budget units to the series’ FLOPs. */
  flopsPerBudgetUnit: number
  /** The planted break of the hardware fixture. */
  breakYear: number
  beforeDoublingMonths: number
  afterDoublingMonths: number
}

export const POWERLAW_DEFAULTS: PowerLawScenario = { decay: 0.75, noise: 0.05, capacity: 16, seed: 11 }

export const COMPUTE_DEFAULTS: ComputeScenario = {
  decay: 0.75,
  noise: 0.05,
  budget: 1e6,
  seed: 11,
  smallCapacity: 8,
  largeCapacity: 64,
}

export const ISOFLOP_DEFAULTS: IsoFlopScenario = {
  decay: 0.75,
  noise: 0.05,
  seed: 11,
  budget: 1e6,
  budgetDecadeStart: 4,
  points: 48,
  uniquePool: 400,
}

export const PERCOLATION_DEFAULTS: PercolationScenario = {
  // `strong` rather than the oracle or the norm: it is the best metric a practitioner
  // can actually compute, so it is the starting point the other three are read against.
  metric: 'strong',
  rareFraction: 0.12,
  noiseCoupling: 0.65,
  metricNoise: 0,
  keep: 0.15,
  seed: 11,
}

export const EPOCHS_DEFAULTS: EpochsScenario = {
  epochs: 24,
  unique: 30,
  batch: 6,
  learningRate: 0.04,
  runs: 8,
  dominanceFraction: 0.5,
  seed: 7,
}

export const REPEATS_DEFAULTS: RepeatsScenario = {
  unique: 120,
  capacity: 24,
  ridge: 0.05,
  maxRepeats: 8,
  // The paper’s own fitted constant for the data term — a quotation, printed as one.
  rDStar: 15.387756,
  // A corpus of a hundred million tokens: the scale at which the paper’s own
  // repetition constant is a statement about real runs rather than about a toy.
  pool: 1e8,
  epochs: 8,
  seed: 7,
}

export const EMERGENCE_DEFAULTS: EmergenceScenario = {
  length: 10,
  threshold: 0.5,
  amplitude: 0.95,
  exponent: 0.35,
  // One part in a hundred: a score below this is a rounding away from zero rather
  // than an ability, which is what the onset of a cliff has to be measured against.
  floor: 0.01,
  blindAt: 0.5,
}

export const HARDWARE_DEFAULTS: HardwareScenario = {
  decay: 0.75,
  noise: 0.05,
  seed: 11,
  // The deep-learning era: the one whose reported slope and reported range disagree
  // by the most, which is the finding the first view is about.
  era: 1,
  pointsPerEra: 8,
  hours: 24 * 30,
  // Above the fitted floor at every point of the noise slider, and low enough that the
  // answer lands inside the series rather than past its end.
  targetLoss: 0.5,
  flopsPerBudgetUnit: 1e6,
  breakYear: 2004,
  beforeDoublingMonths: 20,
  afterDoublingMonths: 30,
}

/** Every screen’s starting scenario, keyed by the registry id. */
export const LAB_DEFAULTS: Record<string, object> = {
  powerlaw: POWERLAW_DEFAULTS,
  compute: COMPUTE_DEFAULTS,
  isoflop: ISOFLOP_DEFAULTS,
  percolation: PERCOLATION_DEFAULTS,
  epochs: EPOCHS_DEFAULTS,
  repeats: REPEATS_DEFAULTS,
  emergence: EMERGENCE_DEFAULTS,
  hardware: HARDWARE_DEFAULTS,
}
