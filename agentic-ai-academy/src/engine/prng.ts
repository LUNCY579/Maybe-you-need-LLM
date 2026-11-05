/**
 * Deterministic pseudo-random generator (mulberry32).
 *
 * Every lab that needs stochastic-looking behaviour uses this generator with an
 * explicit seed, so runs are reproducible: same seed + same config = same trace.
 * That property is what makes the labs testable and the comparisons fair.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  next: () => number
  int: (maxExclusive: number) => number
  pick: <T>(items: T[]) => T
  chance: (probability: number) => boolean
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed)
  return {
    next,
    int: (maxExclusive: number) => Math.floor(next() * maxExclusive),
    pick: <T,>(items: T[]): T => items[Math.floor(next() * items.length)],
    chance: (probability: number) => next() < probability,
  }
}
