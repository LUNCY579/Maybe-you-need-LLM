/**
 * Model collapse.
 *
 * The experiment: train a model on data, generate data from that model, train
 * the next model on the generated data, and repeat. The quantity that falls is
 * the tail — the rare symbols — and it falls much faster than the head does.
 *
 * Two models are implemented, because the paper's result is a statement about
 * the difference between them:
 *
 * - The **bounded** model can only represent the most likely symbols. It is
 *   the model a finite network with a limited output vocabulary behaves like.
 *   Its support shrinks every generation, and the tail is annihilated.
 * - The **unbounded** model is a Laplace-smoothed empirical distribution: it
 *   can represent any symbol, but every symbol it has never seen is floored at
 *   the smoothing constant. The collapse is real but it *saturates* at that
 *   floor — and that saturation is the point, because it says the tail is lost
 *   to a constant rather than to nothing.
 */

import { createRng } from '@llm-materials/course-core'

export interface CollapseOptions {
  /** How many symbols the distribution has. */
  symbols?: number
  /** How many samples are drawn in each generation. */
  samples?: number
  /** How many generations to run. */
  generations?: number
  /** The exponent of the head of the distribution. */
  alpha?: number
  /** The Laplace smoothing constant of the unbounded model. */
  smoothing?: number
  /** How many symbols the bounded model can represent. */
  support?: number
  /** Whether the model is bounded. */
  bounded?: boolean
  /** The fraction of each batch that is real rather than generated. */
  realFraction?: number
  /** The seed. */
  seed?: number
}

export interface GenerationRecord {
  /** The generation number, starting at zero. */
  generation: number
  /** The total variation distance from the original distribution. */
  totalVariation: number
  /** The mass the original put in its tail. */
  originalTailMass: number
  /** The mass that is left on those same symbols. */
  survivingTailMass: number
  /** The effective number of symbols: one over the sum of the squared masses. */
  effectiveSupport: number
  /** The number of symbols with a non-zero probability. */
  support: number
  /** The largest probability in the distribution. */
  maxProbability: number
  /** The probability of the least likely symbol. */
  minProbability: number
}

/** The original distribution: a Zipf-like profile over the symbols. */
export function originalDistribution(options: { symbols?: number; alpha?: number } = {}): number[] {
  const symbols = options.symbols ?? 64
  const alpha = options.alpha ?? 1.1
  const weights: number[] = []
  for (let i = 0; i < symbols; i++) weights.push(1 / (i + 1) ** alpha)
  const total = weights.reduce((a, b) => a + b, 0)
  return weights.map((weight) => weight / total)
}

/** The total variation distance between two distributions. */
export function totalVariation(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length)
  let total = 0
  for (let i = 0; i < length; i++) total += Math.abs((a[i] ?? 0) - (b[i] ?? 0))
  return total / 2
}

/**
 * The tail of a distribution: the least likely symbols, holding the last
 * `fraction` of its mass.
 *
 * The set is returned rather than the mass, because the question the course
 * asks is whether the *same* symbols keep their mass — a distribution whose
 * own tail is redefined every generation cannot show a tail disappearing.
 */
export function tailSymbols(distribution: number[], fraction = 0.1): number[] {
  const order = distribution.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value)
  const symbols: number[] = []
  let mass = 0
  for (const entry of order) {
    symbols.push(entry.index)
    mass += entry.value
    if (mass >= fraction) break
  }
  return symbols
}

/** The mass a distribution puts on a set of symbols. */
export function massOn(distribution: number[], symbols: number[]): number {
  let mass = 0
  for (const symbol of symbols) mass += distribution[symbol] ?? 0
  return mass
}

/**
 * The tail of a distribution, as a mass.
 *
 * Kept for the cases where the tail is defined by the distribution itself.
 */
export function tailMass(distribution: number[], fraction = 0.1): { mass: number; from: number } {
  const symbols = tailSymbols(distribution, fraction)
  const from = symbols[symbols.length - 1] ?? 0
  return { mass: massOn(distribution, symbols), from }
}

/**
 * The Laplace-smoothed empirical distribution of a sample — the unbounded
 * model.
 *
 * The smoothing constant is what decides the fate of the tail: a symbol that
 * appears once in `samples` draws gets a probability of
 * smoothing / (samples + smoothing * symbols), which for any reasonable
 * sample size is far below its probability in the original distribution, and
 * which is also the floor the collapse saturates at.
 */
export function smoothedEmpirical(sample: number[], symbols: number, smoothing: number): number[] {
  const counts = new Array<number>(symbols).fill(0)
  for (const value of sample) counts[value] = (counts[value] ?? 0) + 1
  const total = sample.length + smoothing * symbols
  return counts.map((count) => (count + smoothing) / total)
}

/**
 * The bounded empirical distribution — the model that can only represent the
 * most likely symbols.
 *
 * Every symbol outside the support gets a probability of exactly zero, so the
 * next generation cannot produce it, and the next support is drawn from a
 * distribution that no longer contains it. This is the mechanism of the
 * collapse.
 */
export function boundedEmpirical(sample: number[], symbols: number, support: number): number[] {
  const counts = new Array<number>(symbols).fill(0)
  for (const value of sample) counts[value] = (counts[value] ?? 0) + 1
  const order = counts
    .map((count, index) => ({ count, index }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
  const kept = order.slice(0, Math.max(1, support))
  const total = kept.reduce((sum, entry) => sum + entry.count, 0) || 1
  const distribution = new Array<number>(symbols).fill(0)
  for (const entry of kept) distribution[entry.index] = entry.count / total
  return distribution
}

/** Draw `count` samples from a distribution. */
export function sampleFrom(distribution: number[], count: number, seed: number): number[] {
  const rng = createRng(seed)
  const samples: number[] = []
  for (let i = 0; i < count; i++) {
    const u = rng()
    let cumulative = 0
    for (let s = 0; s < distribution.length; s++) {
      cumulative += distribution[s] ?? 0
      if (u <= cumulative) {
        samples.push(s)
        break
      }
    }
  }
  return samples
}

/**
 * Run the recursive loop.
 *
 * Each generation's batch is a mixture of real samples and samples drawn from
 * the previous model, in the proportion `realFraction`. Setting it to zero
 * gives the pure recursion; setting it above zero shows how much real data is
 * needed to keep the tail alive.
 */
export function runCollapse(options: CollapseOptions = {}): GenerationRecord[] {
  const settings = {
    symbols: 64,
    samples: 4000,
    generations: 6,
    alpha: 1.1,
    smoothing: 1,
    support: 40,
    bounded: true,
    realFraction: 0,
    seed: 3,
    ...options,
  }

  const original = originalDistribution({ symbols: settings.symbols, alpha: settings.alpha })
  // The tail is fixed once, from the original distribution, and every
  // generation is measured on that same set of symbols.
  const tail = tailSymbols(original, 0.1)
  const originalTailMass = massOn(original, tail)

  const records: GenerationRecord[] = []
  let current = original

  for (let generation = 0; generation < settings.generations; generation++) {
    const realCount = Math.round(settings.samples * settings.realFraction)
    const generatedCount = settings.samples - realCount

    const batch: number[] = []
    if (realCount > 0) batch.push(...sampleFrom(original, realCount, settings.seed + generation * 7919))
    if (generatedCount > 0) batch.push(...sampleFrom(current, generatedCount, settings.seed + 1 + generation * 7919))

    const model = settings.bounded
      ? boundedEmpirical(batch, settings.symbols, settings.support)
      : smoothedEmpirical(batch, settings.symbols, settings.smoothing)
    const sumSquares = model.reduce((sum, value) => sum + value * value, 0)

    records.push({
      generation,
      totalVariation: totalVariation(model, original),
      originalTailMass,
      survivingTailMass: massOn(model, tail),
      effectiveSupport: sumSquares > 0 ? 1 / sumSquares : 0,
      support: model.filter((value) => value > 0).length,
      maxProbability: Math.max(...model),
      minProbability: Math.min(...model),
    })

    current = model
  }

  return records
}

/**
 * The tail-mass argument, computed.
 *
 * A symbol that appears `count` times in a sample of `samples` draws is given
 * a probability of (count + smoothing) / (samples + smoothing * symbols). The
 * table shows what happens to a symbol that was common in the original
 * distribution as the sample size grows.
 */
export function tailMassTable(options: { symbols?: number; smoothing?: number; counts?: number[] } = {}): {
  count: number
  samples: number
  probability: number
}[] {
  const symbols = options.symbols ?? 64
  const smoothing = options.smoothing ?? 1
  const counts = options.counts ?? [1, 2, 5, 10, 50]
  const sampleSizes = [1000, 10000, 100000]
  const rows: { count: number; samples: number; probability: number }[] = []
  for (const samples of sampleSizes) {
    for (const count of counts) {
      rows.push({ count, samples, probability: (count + smoothing) / (samples + smoothing * symbols) })
    }
  }
  return rows
}
