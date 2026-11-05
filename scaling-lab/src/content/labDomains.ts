/**
 * The domain each screen's sliders let a reader drag a scenario into.
 *
 * `labDefaults.ts` says where a reader starts; this says how far they can go from
 * there. An estimator rarely breaks in the middle of a range — it breaks at
 * `capacity` 2 with `noise` 0.4, or at one restart, or at a budget two decades past
 * the one the grid was fitted over. So the terminal sweep runs every laboratory at
 * each endpoint of every field and at the two corners, and a test reads the numbers
 * here against the ranges the rendered inputs actually carry.
 *
 * Two entries are not sliders: `metric` and `era` are the options of the segmented
 * controls, listed from the core so the counts cannot drift. Two are log-scaled on
 * screen — the slider shows a decade, the scenario holds the number — so the domain
 * is the number, and the test that compares the two takes `10 ** min` as the endpoint
 * it sees. `epochs.batch` is the one field whose maximum the screen derives from
 * another slider; the domain carries the largest value it can ever take.
 */

import { PAPER_ERAS } from '../core/hardware'
import { PRUNING_METRICS } from '../core/percolation'

/** One field's reachable range, or the list of options a segmented control offers. */
export type FieldDomain = number[] | string[]

/** Every field a screen can move, keyed by the laboratory id and the scenario field. */
export const LAB_DOMAINS: Record<string, Record<string, FieldDomain>> = {
  powerlaw: {
    decay: [0.5, 1.2],
    noise: [0.005, 0.4],
    capacity: [2, 64],
    seed: [1, 99],
  },
  compute: {
    budget: [1e4, 1e10],
    decay: [0.5, 1.2],
    noise: [0.005, 0.4],
    smallCapacity: [2, 32],
    largeCapacity: [4, 64],
    seed: [1, 99],
  },
  isoflop: {
    budget: [1e4, 1e10],
    decay: [0.5, 1.2],
    noise: [0.005, 0.4],
    budgetDecadeStart: [4, 8],
    points: [12, 96],
    uniquePool: [50, 3000],
    seed: [1, 99],
  },
  percolation: {
    metric: [...PRUNING_METRICS],
    rareFraction: [0.03, 0.3],
    noiseCoupling: [0, 1],
    metricNoise: [0, 4],
    keep: [0.03, 1],
    seed: [1, 99],
  },
  epochs: {
    epochs: [8, 40],
    unique: [10, 80],
    // The screen caps this at `floor(unique / 2)`, so 40 is reachable only with 80 unique rows.
    batch: [1, 40],
    learningRate: [0.005, 0.12],
    runs: [1, 8],
    dominanceFraction: [0.05, 1],
    seed: [1, 99],
  },
  repeats: {
    pool: [1e6, 1e12],
    rDStar: [1, 40],
    epochs: [2, 24],
    unique: [40, 400],
    capacity: [8, 60],
    ridge: [0.001, 0.5],
    maxRepeats: [1, 32],
    seed: [1, 99],
  },
  emergence: {
    length: [1, 40],
    threshold: [0, 0.95],
    amplitude: [0.5, 1.4],
    exponent: [0.1, 0.8],
    floor: [0.001, 0.2],
    blindAt: [0.2, 0.95],
  },
  hardware: {
    decay: [0.5, 1.2],
    noise: [0.005, 0.4],
    seed: [1, 99],
    era: PAPER_ERAS.map((_, index) => index),
    pointsPerEra: [3, 16],
    breakYear: [1975, 2015],
    beforeDoublingMonths: [6, 48],
    afterDoublingMonths: [6, 120],
    targetLoss: [0.02, 2],
    hours: [1, 1e4],
    flopsPerBudgetUnit: [1, 1e12],
  },
}
