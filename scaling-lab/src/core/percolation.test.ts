import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FRACTIONS,
  METRIC_DESCRIPTIONS,
  PRUNING_METRICS,
  benchmarkMetrics,
  buildPruningPool,
  curationExponent,
  cliffEdge,
  informationSpread,
  metricScores,
  nonRareShare,
  percolationThreshold,
  poolComposition,
  predictThreshold,
  pruningCurve,
  pruneByMetric,
  volumeLaw,
  type PruningPoint,
} from './percolation'

/** Rank of a value within a list: the share of the list it beats. */
function rankWithin(values: number[], value: number): number {
  return values.filter((entry) => entry < value).length / values.length
}

function normSquared(row: number[]): number {
  return row.reduce((sum, value) => sum + value * value, 0)
}

/** The share of the pool a metric ranks a given row above. */
function scoreRank(scores: number[], index: number): number {
  const sorted = [...scores].sort((a, b) => a - b)
  return rankWithin(sorted, scores[index]!)
}

describe('the pruning pool', () => {
  const pool = buildPruningPool()

  it('is a continuum of redundancy with a rare set on top of it', () => {
    const composition = poolComposition(pool)
    expect(composition.bulk + composition.rare).toBe(pool.x.length)
    expect(composition.rare).toBeGreaterThanOrEqual(pool.tailDims.length)
    expect(nonRareShare(pool)).toBeCloseTo(1 - composition.rare / pool.x.length, 10)
  })

  it('prices each row by the Fisher information it carries', () => {
    // The definition the whole module rests on, checked on the data rather than
    // assumed by the code that uses it.
    for (let n = 0; n < pool.x.length; n += 37) {
      expect(pool.informativeness[n]!).toBeCloseTo(normSquared(pool.x[n]!) / pool.sigma[n]! ** 2, 8)
    }
  })

  it('puts the rare rows in the middle of the inputs and at the top of the labels', () => {
    const norms = pool.x.map((row) => normSquared(row))
    const information = pool.informativeness
    const rareNorms = norms.filter((_value, index) => pool.group[index] === 'rare')
    const middle = rareNorms.reduce((sum, value) => sum + rankWithin(norms, value), 0) / rareNorms.length
    // A metric that can only see the inputs cannot pick the rare rows out.
    expect(middle).toBeGreaterThan(0.35)
    expect(middle).toBeLessThan(0.65)
    // The information formula picks nothing else out.
    const worst = Math.min(...information.filter((_value, index) => pool.group[index] === 'rare'))
    expect(rankWithin(information, worst)).toBeGreaterThan(0.8)
  })

  it('spans the orders of magnitude of information the argument needs', () => {
    const sorted = [...pool.informativeness].sort((a, b) => a - b)
    expect(sorted[sorted.length - 1]! / sorted[0]!).toBeGreaterThan(1e3)
    const spread = informationSpread(pool)
    expect(spread.separation).toBeGreaterThan(1)
  })

  it('scores held-out rows that reach the tail directions', () => {
    // Without tail components in the test set there is nothing to miss, and no
    // cliff to measure.
    let reached = 0
    for (const row of pool.testX) if (pool.tailDims.some((dim) => Math.abs(row[dim] ?? 0) > 1e-6)) reached++
    expect(reached).toBe(pool.testX.length)
    // And the floor the loss cannot be beaten past is far below the losses the
    // curves reach, so what the curves are measuring is estimation error.
    expect(pool.noiseFloor).toBeGreaterThan(0)
    expect(pool.noiseFloor).toBeLessThan(pruningCurve(pool, metricScores(pool, 'random'), [1])[0]!.loss / 2)
  })

  it('is the same pool for the same seed', () => {
    const again = buildPruningPool()
    expect(again.y).toEqual(pool.y)
    expect(again.x).toEqual(pool.x)
    expect(buildPruningPool({ seed: 12 }).x).not.toEqual(pool.x)
  })

  it('refuses a pool with no tail to lose', () => {
    expect(() => buildPruningPool({ dims: 8, headDims: 8 })).toThrow()
  })
})

describe('the four metrics', () => {
  const pool = buildPruningPool()

  it('agree with their own definitions', () => {
    const oracle = metricScores(pool, 'oracle')
    expect(oracle).toEqual(pool.informativeness)
    const weak = metricScores(pool, 'weak')
    expect(weak).toEqual(pool.x.map((row) => normSquared(row)))
  })

  it('rank the rare rows by how much of the labels they use', () => {
    const rareIndices = pool.group.map((group, index) => ({ group, index })).filter((row) => row.group === 'rare').map((row) => row.index)
    const average = (scores: number[]): number =>
      rareIndices.reduce((sum, index) => sum + scoreRank(scores, index), 0) / rareIndices.length
    const ranks = {
      oracle: average(metricScores(pool, 'oracle')),
      strong: average(metricScores(pool, 'strong')),
      weak: average(metricScores(pool, 'weak')),
      random: average(metricScores(pool, 'random')),
    }
    // Not one: a handful of the best bulk rows genuinely outrank the least
    // valuable rare row, and the exact metric says so.
    expect(ranks.oracle).toBeGreaterThan(0.9)
    expect(ranks.strong).toBeGreaterThan(ranks.weak)
    expect(ranks.weak).toBeGreaterThan(ranks.random)
    // The shuffle is no guide at all.
    expect(ranks.random).toBeGreaterThan(0.3)
    expect(ranks.random).toBeLessThan(0.7)
  })

  it('are degraded continuously by the noise knob', () => {
    const clean = metricScores(pool, 'oracle')
    const noisy = metricScores(pool, 'oracle', { noise: 3 })
    const agreement = (a: number[], b: number[]): number => {
      let same = 0
      for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
        if (Math.sign(a[i]! - a[j]!) === Math.sign(b[i]! - b[j]!)) same++
      }
      const pairs = (a.length * (a.length - 1)) / 2
      return same / pairs
    }
    expect(agreement(clean, clean)).toBe(1)
    expect(agreement(clean, noisy)).toBeLessThan(0.75)
    expect(agreement(clean, metricScores(pool, 'oracle', { noise: 0.2 }))).toBeGreaterThan(0.9)
  })

  it('keep the rows the score says to keep', () => {
    const scores = metricScores(pool, 'oracle')
    const kept = pruneByMetric(pool, scores, 0.25)
    expect(kept.length).toBe(Math.round(pool.x.length * 0.25))
    const worst = Math.min(...kept.map((index) => scores[index]!))
    const best = Math.max(...pool.x.map((_row, index) => (kept.includes(index) ? -Infinity : scores[index]!)))
    expect(worst).toBeGreaterThan(best)
    expect(() => pruneByMetric(pool, scores, 0)).toThrow()
    expect(() => pruneByMetric(pool, scores, 1.5)).toThrow()
    expect(() => pruneByMetric(pool, scores.slice(1), 0.5)).toThrow()
  })
})

describe('the pruning curves', () => {
  const pool = buildPruningPool()
  const curves = Object.fromEntries(
    PRUNING_METRICS.map((metric) => [metric, pruningCurve(pool, metricScores(pool, metric))]),
  ) as Record<string, PruningPoint[]>

  it('fall while the metric is shedding redundancy', () => {
    const oracle = curves.oracle!
    const full = oracle[0]!
    const best = oracle.reduce((acc, point) => (point.loss < acc.loss ? point : acc), full)
    expect(best.loss).toBeLessThan(full.loss)
    expect(best.gain).toBeGreaterThan(0)
    // And the improvement is a real fraction of the loss, not a rounding error.
    expect(best.loss / full.loss).toBeLessThan(0.6)
  })

  it('break when the tail directions stop being covered enough', () => {
    const oracle = curves.oracle!
    const cliff = oracle.find((point) => point.fraction === 0.06)!
    // Every direction still has a row reaching it; what has gone is the number
    // of rows per direction, which is what an estimate needs.
    expect(cliff.tailCovered).toBe(pool.tailDims.length)
    expect(cliff.rarestTailDim).toBeLessThan(10)
    expect(cliff.rareKept).toBeLessThan(oracle[0]!.rareKept)
    expect(cliff.loss).toBeGreaterThan(oracle[0]!.loss * 100)
    // The weak metric does lose the directions outright.
    const weak = curves.weak!
    expect(weak.find((point) => point.fraction === 0.22)!.tailCovered).toBe(0)
  })

  it('keep every rare row until the very end when the metric is the information', () => {
    const oracle = curves.oracle!
    const rareRows = poolComposition(pool).rare
    for (const point of oracle.filter((entry) => entry.fraction >= 0.15)) {
      expect(point.rareKept).toBe(rareRows)
    }
    expect(oracle.find((point) => point.fraction === 0.1)!.rareKept).toBeLessThan(rareRows)
    // The weak metric starts losing them while most of the pool is still there.
    const weak = curves.weak!
    expect(weak.find((point) => point.fraction === 0.7)!.rareKept).toBeLessThan(rareRows)
    expect(weak.find((point) => point.fraction === 0.4)!.rareKept).toBeLessThan(
      weak.find((point) => point.fraction === 0.7)!.rareKept,
    )
  })

  it('give a weaker metric an earlier cliff', () => {
    const readings = Object.fromEntries(
      PRUNING_METRICS.map((metric) => [metric, percolationThreshold(curves[metric]!)]),
    ) as Record<string, ReturnType<typeof percolationThreshold>>
    expect(readings.oracle!.threshold).toBeLessThan(readings.weak!.threshold!)
    expect(readings.strong!.threshold).toBeLessThanOrEqual(readings.oracle!.threshold!)
    expect(readings.random!.threshold).toBeNull()
    expect(readings.random!.maxGain).toBeLessThanOrEqual(0)
    const edges = {
      oracle: cliffEdge(curves.oracle!),
      weak: cliffEdge(curves.weak!),
    }
    expect(edges.oracle!).toBeLessThan(edges.weak!)
  })

  it('beat a random subset of the same size, and by a margin that widens', () => {
    for (const metric of ['oracle', 'strong', 'weak'] as const) {
      const curve = curves[metric]!
      const at04 = curve.find((point) => point.fraction === 0.4)!
      const at07 = curve.find((point) => point.fraction === 0.7)!
      expect(at04.excessOverRandom).toBeGreaterThan(0)
      expect(at04.excessOverRandom).toBeGreaterThan(at07.excessOverRandom)
    }
    const random = curves.random!
    expect(Math.abs(random[0]!.excessOverRandom)).toBeLessThan(1e-12)
  })

  it('are the same curve for the same pool and metric', () => {
    expect(pruningCurve(pool, metricScores(pool, 'weak'))).toEqual(curves.weak)
  })
})

describe('the law of volume, and the escape from it', () => {
  const pool = buildPruningPool()

  it('describes random subsampling with a positive exponent', () => {
    const law = volumeLaw(pool)
    expect(law.alpha).toBeGreaterThan(0.5)
    expect(law.r2).toBeGreaterThan(0.5)
    expect(law.points.length).toBe(7)
  })

  it('is contradicted by a good metric, which is the point', () => {
    // In the beneficial stretch the curated loss falls as rows are *removed*, so
    // the exponent of the loss in the row count changes sign. That is what
    // "beyond neural scaling laws" means operationally, and it is a number here.
    for (const metric of ['oracle', 'strong', 'weak'] as const) {
      const curation = curationExponent(pool, metric)
      expect(curation.curated).not.toBeNull()
      expect(curation.curated!.alpha).toBeLessThan(0)
      expect(curation.ratio).toBeLessThan(0)
    }
    expect(curationExponent(pool, 'random').curated).toBeNull()
  })
})

describe('the benchmark', () => {
  const pool = buildPruningPool()
  const benchmarks = benchmarkMetrics(pool)

  it('ranks the four metrics in their order of information', () => {
    const byRank = [...benchmarks].sort((a, b) => a.rank - b.rank).map((row) => row.metric)
    expect(byRank).toEqual(['oracle', 'strong', 'weak', 'random'])
    for (let i = 1; i < byRank.length; i++) {
      expect(benchmarks.find((row) => row.metric === byRank[i])!.bestLoss).toBeGreaterThan(
        benchmarks.find((row) => row.metric === byRank[i - 1])!.bestLoss,
      )
    }
  })

  it('charges the strong metric for the run it needs, and it still pays', () => {
    const strong = benchmarks.find((row) => row.metric === 'strong')!
    expect(strong.metricCostRows).toBe(pool.x.length)
    expect(strong.gainAtMatchedCompute).toBeGreaterThan(0)
    const free = benchmarks.find((row) => row.metric === 'weak')!
    expect(free.metricCostRows).toBe(0)
    expect(free.gainAtMatchedCompute).toBeGreaterThan(0)
    const random = benchmarks.find((row) => row.metric === 'random')!
    expect(random.metricCostRows).toBe(0)
    // A free metric compared at matched compute is compared against itself: the
    // column is zero, and the gain it is made of is zero too.
    expect(random.gainAtMatchedCompute).toBeCloseTo(0, 10)
    expect(random.gain).toBeCloseTo(0, 10)
  })

  it('describes each metric in its own terms', () => {
    for (const benchmark of benchmarks) {
      expect(benchmark.description).toBe(METRIC_DESCRIPTIONS[benchmark.metric])
      expect(benchmark.fullLoss).toBeGreaterThan(0)
      expect(benchmark.tailCovered).toBeLessThanOrEqual(pool.tailDims.length)
      expect(benchmark.rareKept).toBeLessThanOrEqual(poolComposition(pool).rare)
    }
    const oracle = benchmarks.find((row) => row.metric === 'oracle')!
    const weak = benchmarks.find((row) => row.metric === 'weak')!
    // The best subset the information metric picks is the better-covered one,
    // which is the mechanism behind the ranking above.
    expect(oracle.rarestTailDim).toBeGreaterThan(weak.rarestTailDim)
    expect(weak.bestFraction).toBeGreaterThan(oracle.bestFraction)
  })
})

describe('the percolation prediction', () => {
  const pool = buildPruningPool()

  it('counts the rare rows the metric keeps, without being told to', () => {
    // The prediction assumes a score equal to the log information plus Gaussian
    // error of the given size. `metricScores` with the same noise is exactly
    // that, so the predicted and the measured rare counts must agree.
    for (const noise of [0, 1, 2]) {
      const scores = metricScores(pool, 'oracle', { noise })
      const curve = pruningCurve(pool, scores, [0.1])
      const predicted = predictThreshold(pool, { metricNoise: noise })
      const kept = curve[0]!.rareKept
      const expected = predicted.survival.find((row) => row.fraction === 0.1)!.expectedRareKept
      expect(Math.abs(kept - expected)).toBeLessThan(5)
    }
  })

  it('moves the threshold later as the metric gets worse', () => {
    const predicted = [0, 0.5, 1, 2, 5, 12, 30].map((noise) => predictThreshold(pool, { metricNoise: noise }).fraction)
    for (let i = 1; i < predicted.length; i++) {
      expect(predicted[i]!).toBeGreaterThanOrEqual(predicted[i - 1]!)
    }
    expect(predicted[0]!).toBeLessThan(predicted[predicted.length - 1]!)
  })

  it('never overstates how far pruning can go', () => {
    for (const noise of [0, 0.5, 1, 2, 5, 12]) {
      const predicted = predictThreshold(pool, { metricNoise: noise }).fraction
      const measured = cliffEdge(pruningCurve(pool, metricScores(pool, 'oracle', { noise })))
      expect(predicted).not.toBeNull()
      expect(measured).not.toBeNull()
      expect(predicted!).toBeLessThanOrEqual(measured!)
    }
  })

  it('tends to the coverage requirement when the metric says nothing', () => {
    // With an error far larger than the information's own spread, a rare row
    // survives pruning with probability equal to the keep fraction, so the
    // threshold is the share of the rare group the tail needs.
    const required = 3
    const composition = poolComposition(pool)
    const limit = (required * pool.tailDims.length) / composition.rare
    const predicted = predictThreshold(pool, { metricNoise: 500 })
    expect(predicted.fraction).not.toBeNull()
    expect(predicted.fraction!).toBeGreaterThanOrEqual(limit - 0.05)
    expect(predicted.fraction!).toBeLessThanOrEqual(limit + 0.05)
    expect(predicted.required).toBe(required * pool.tailDims.length)
  })

  it('asks for a pool that has rare rows in it', () => {
    expect(() => predictThreshold(buildPruningPool({ rareFraction: 0 }))).toThrow()
  })
})

describe('the fractions the curves are read on', () => {
  it('span the pool from whole to negligible, in order', () => {
    expect(DEFAULT_FRACTIONS[0]).toBe(1)
    expect(DEFAULT_FRACTIONS[DEFAULT_FRACTIONS.length - 1]!).toBeLessThan(0.05)
    for (let i = 1; i < DEFAULT_FRACTIONS.length; i++) {
      expect(DEFAULT_FRACTIONS[i]!).toBeLessThan(DEFAULT_FRACTIONS[i - 1]!)
    }
  })
})
