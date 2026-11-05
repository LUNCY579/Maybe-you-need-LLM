/**
 * Seeded pseudo-random number generation.
 *
 * Every experiment in this app is reproducible: a seed fully determines the stream
 * of numbers consumed. mulberry32 is used because it is small, fast, and has a
 * well-defined 32-bit state, which makes "reset and re-run with the same seed"
 * reproducible across browsers.
 */

export class Rng {
  private state: number;
  private spare: number | null = null;
  readonly seed: number;
  /** number of draws consumed, reported in experiment metadata */
  draws = 0;

  constructor(seed: number) {
    if (!Number.isFinite(seed)) throw new Error(`seed must be a finite number, got ${seed}`);
    this.seed = seed >>> 0;
    this.state = this.seed === 0 ? 0x9e3779b9 : this.seed;
  }

  /** uniform in [0,1) */
  next(): number {
    this.draws += 1;
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** uniform in [a,b) */
  uniform(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  /** integer in [0,n) */
  int(n: number): number {
    return Math.min(n - 1, Math.floor(this.next() * n));
  }

  /** standard normal via Marsaglia polar method (keeps a spare draw) */
  normal(): number {
    if (this.spare !== null) {
      const v = this.spare;
      this.spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = this.next() * 2 - 1;
      v = this.next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    this.spare = v * f;
    return u * f;
  }

  normalScaled(mean: number, sd: number): number {
    return mean + sd * this.normal();
  }

  /** 1/sqrt(3) gives unit variance for a symmetric uniform distribution */
  uniformUnitVariance(scale = 1): number {
    return (this.next() * 2 - 1) * Math.sqrt(3) * scale;
  }
}

/** A deterministic 32-bit hash so string seeds such as "critical-tanh" work too. */
export function seedFromString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mean and (population) standard deviation of a sample */
export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function variance(xs: readonly number[]): number {
  if (xs.length < 2) return Number.NaN;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return s / (xs.length - 1); // sample variance (unbiased)
}

export function stdDev(xs: readonly number[]): number {
  return Math.sqrt(variance(xs));
}

export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
