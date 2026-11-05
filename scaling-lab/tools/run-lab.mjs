#!/usr/bin/env node
/**
 * The laboratories, from the terminal.
 *
 * Every screen is a thin layer over a pure function in `src/core`, so the same
 * laboratory can be run without a browser. This file reads the scenario the sliders
 * start at — `src/content/labDefaults.ts`, which the screens read too — calls the same
 * core functions in the same order, and prints what they return. Nothing is
 * re-implemented here: a disagreement between this output and the page is a bug in one
 * of them, not a difference of opinion between two implementations.
 *
 *   npm run lab -- isoflop
 *   npm run --silent lab -- all --csv > scaling-lab.csv
 *   node --import ./tools/ts-resolver.mjs tools/run-lab.mjs epochs --seed 3
 *
 * Options:
 *   --csv    `lab,kind,metric,value,note` rows on stdout, for a spreadsheet or a diff
 *   --json   one object per laboratory
 *   --seed N replace the scenario's seed, where a scenario has one
 *   --extremes  run each laboratory at every endpoint of its sliders and at both
 *               corners, and report any scenario that prints a broken number or throws
 *   --list   the registered laboratories and exit
 *   --help   this text
 */

import { pathToFileURL } from 'node:url'

import { fmt } from '@llm-materials/course-core'
import { LABS } from '../src/content/labs'
import { LAB_DEFAULTS } from '../src/content/labDefaults'
import { LAB_DOMAINS } from '../src/content/labDomains'
import { GRID_CAPACITIES, GRID_SAMPLES } from '../src/components/lab/surfaceFixture'
import { buildScalingTask, irreducibleLoss, trainRidge } from '../src/core/spectral'
import { computeOptimum, compareAllocations, fitPowerLaw, fitSurface, predictPowerLaw, doublingGain, surfaceLoss } from '../src/core/surface'
import {
  analyticOptimum,
  betterAt,
  budgetWhereDataRunsOut,
  crossoverBudget,
  crossoverSeries,
  frontier,
  frontierExponent,
  insideFittedRange,
  isoFLOPCurve,
  measuredAllocationExponents,
  predictedAllocationExponents,
  tokensPerParameterRule,
} from '../src/core/isoflop'
import {
  benchmarkMetrics,
  buildPruningPool,
  cliffEdge,
  curationExponent,
  informationSpread,
  METRIC_DESCRIPTIONS,
  metricScores,
  nonRareShare,
  percolationThreshold,
  poolComposition,
  predictThreshold,
  pruningCurve,
  PRUNING_METRICS,
  volumeLaw,
} from '../src/core/percolation'
import {
  dominanceEpoch,
  effectiveDataLaw,
  effectiveSamples,
  epochCurve,
  epochsForValue,
  PAPER_REPETITION_CONSTANT,
  phaseBoundaries,
  repetitionSchedule,
  repetitionValue,
  constrainedOptimum,
} from '../src/core/epochs'
import { buildRepeatsTask, repeatComparison } from '../src/core/repeats'
import {
  artefactGap,
  cliffInterval,
  emergenceCurve,
  logSweep,
  maxStep,
  metricShift,
  roughness,
  transitionSharpness,
} from '../src/core/emergence'
import {
  budgetForTargetLoss,
  budgetForTargetLossBySearch,
  capabilityAt,
  computeSeries,
  detectBreaks,
  eraReadings,
  feasibilityOfTarget,
  hardwareSeries,
  lossImpliedByTrend,
  lossReachableInYear,
  logLinearTrend,
  MOORE_DOUBLING_MONTHS,
  monthsFromOomPerYear,
  oomPerYearFromDoublingMonths,
  PAPER_ERAS,
  runCompute,
} from '../src/core/hardware'

const HELP = `usage: npm run lab -- <lab|all> [--csv] [--json] [--seed n] [--extremes]

  npm run --silent lab -- epochs --csv > epochs.csv   (npm's own banner goes to stdout)
  npm run lab -- all --extremes                       (every slider endpoint, both corners)

laboratories:
${LABS.map((lab) => `  ${lab.id.padEnd(12)}${lab.name} — ${lab.blurb}`).join('\n')}
`

/** The numbers a laboratory reports, in the order its screen shows them. */
function scenario(settings, stats, tables = []) {
  return { settings, stats, tables }
}

const percent = (value, digits = 1) => `${fmt(value * 100, digits)}%`
const fraction = (value) => (value === null ? 'none' : fmt(value, 3))
const computeText = (value) => (value === null ? 'never' : fmt(value, 1))
const monthsText = (value) => (Number.isFinite(value) ? `${fmt(value, 1)} months` : 'never')
const ratioText = (value) => (Number.isFinite(value) ? fmt(value, 2) : 'no cliff')

/**
 * What the fitted floor is, said the way the page says it.
 *
 * The fit holds its three coefficients non-negative, so a floor that the
 * unconstrained answer wanted below zero arrives at zero instead. That is a fact
 * about the points, and the row says so rather than printing `0` as a measurement.
 */
const floorNote = (fit) =>
  fit.constrained
    ? 'held at zero: the free fit wanted a floor below zero, which is not a loss'
    : 'the irreducible loss — the floor'

/**
 * The ladder of training runs and the surface fitted to it.
 *
 * This is `useTrainingSurface` without the memoisation: the same grid, the same
 * core calls, in the same order. Screens B, C and H all read one fit, so the
 * runner builds it once per scenario rather than letting three screens invent
 * three grids and disagree about the exponents.
 */
function trainingSurface(settings) {
  const task = buildScalingTask({ decay: settings.decay, noise: settings.noise })
  const points = GRID_CAPACITIES.flatMap((capacity) =>
    GRID_SAMPLES.map((samples) => ({
      capacity,
      samples,
      loss: trainRidge(task, { capacity, samples, seed: settings.seed }).testLoss,
    })),
  )
  return { task, points, fit: fitSurface(points) }
}

/** The grid the closed forms are only a reading of, for the range check the screens make. */
const FITTED_RANGE = {
  capacity: [Math.min(...GRID_CAPACITIES), Math.max(...GRID_CAPACITIES)],
  samples: [Math.min(...GRID_SAMPLES), Math.max(...GRID_SAMPLES)],
}

/* ------------------------------------------------------------------- scenarios */

/** A · the law fitted to a ladder of real training runs, and the range it was fitted over. */
function powerlaw(D) {
  const task = buildScalingTask({ decay: D.decay, noise: D.noise })
  const runs = [50, 100, 200, 400, 800, 1600, 3200].map((samples) => ({
    samples,
    loss: trainRidge(task, { capacity: D.capacity, samples, seed: D.seed }).testLoss,
  }))
  const fit = fitPowerLaw(
    runs.map((run) => run.samples),
    runs.map((run) => run.loss),
  )

  const rangeFits = []
  for (let from = 0; from < runs.length - 2; from++) {
    for (let to = from + 2; to < runs.length; to++) {
      const slice = runs.slice(from, to + 1)
      const partial = fitPowerLaw(
        slice.map((run) => run.samples),
        slice.map((run) => run.loss),
      )
      rangeFits.push({
        from: slice[0].samples,
        to: slice[slice.length - 1].samples,
        alpha: partial.alpha,
        r2: partial.r2,
      })
    }
  }
  const alphas = rangeFits.map((row) => row.alpha)
  const spread = Math.max(...alphas) - Math.min(...alphas)

  return scenario(
    [
      ['spectrum decay', fmt(D.decay, 2)],
      ['the noise', fmt(D.noise, 3)],
      ['the capacity', D.capacity],
      ['seed', D.seed],
    ],
    [
      ['the exponent', fmt(fit.alpha, 4), 'the slope of the log–log line'],
      ['the R²', fmt(fit.r2, 4), 'how close the runs sit to the line'],
      ['what a doubling buys', percent(1 - doublingGain(fit), 2), 'the improvement per doubling of the data'],
      ['the coefficient', fmt(fit.coefficient, 5), 'the C in L = C·D^(−α), fitted in log space'],
      ['the training runs', String(runs.length), 'each one a ridge fit on freshly drawn data'],
      ['the task’s floor', fmt(irreducibleLoss(task), 5), 'the noise no amount of data can be beaten past'],
      ['the exponent moves by', fmt(spread, 4), `over the ${rangeFits.length} contiguous ranges fitted here`],
    ],
    [
      {
        caption: 'Every run, and what the law says about it',
        header: ['samples', 'measured loss', 'predicted loss', 'ratio to the previous run'],
        rows: runs.map((run, index) => [
          run.samples,
          fmt(run.loss, 5),
          fmt(predictPowerLaw(fit, run.samples), 5),
          index === 0 ? '—' : fmt(run.loss / runs[index - 1].loss, 4),
        ]),
      },
      {
        caption: 'The exponent, by the range it was fitted over',
        header: ['from', 'to', 'the exponent', 'the R²'],
        rows: rangeFits.slice(0, 18).map((row) => [row.from, row.to, fmt(row.alpha, 4), fmt(row.r2, 4)]),
      },
    ],
  )
}

/** B · one budget, many allocations, and the size at which a bigger model starts to pay. */
function compute(D) {
  const { fit, points } = trainingSurface(D)
  const optimum = computeOptimum(fit, D.budget)
  const allocations = compareAllocations(fit, D.budget)

  const lo = Math.min(D.smallCapacity, D.largeCapacity)
  const hi = Math.max(D.smallCapacity, D.largeCapacity)
  const pair = lo === hi ? { small: lo, large: lo + 1 } : { small: lo, large: hi }
  const crossover = crossoverBudget(fit, pair.small, pair.large)
  const atBudget = betterAt(fit, D.budget, pair.small, pair.large)
  const larger = GRID_CAPACITIES.filter((capacity) => capacity > pair.small)
  const series = crossoverSeries(fit, pair.small, larger.length > 0 ? larger : [pair.large])

  return scenario(
    [
      ['budget', `10^${fmt(Math.log10(D.budget), 1)}`],
      ['spectrum decay', fmt(D.decay, 2)],
      ['the noise', fmt(D.noise, 3)],
      ['the two sizes', `${pair.small} and ${pair.large}`],
      ['seed', D.seed],
    ],
    [
      ['the capacity at the optimum', fmt(optimum.capacity, 1), 'the minimum of the search along the budget'],
      ['the samples at the optimum', fmt(optimum.samples, 1), 'pinned by the budget once the capacity is chosen'],
      ['the tokens per parameter', fmt(optimum.samplesPerParameter, 2), 'a consequence of the two exponents and the budget'],
      ['the loss at the optimum', fmt(optimum.loss, 5), `the floor of this surface is ${fmt(fit.E, 5)}`],
      ['the crossover compute', fmt(crossover.budget, 2), `the budget at which N = ${pair.small} and N = ${pair.large} tie`],
      ['the winner at this budget', `N = ${atBudget.winner}`, 'of the two sizes offered'],
      ['the gap', fmt(Math.abs(atBudget.gap), 5), 'the loss difference between them at this budget'],
      ['the data threshold', fmt(crossover.dataThreshold, 1), 'samples below which the larger model is the wrong choice'],
    ],
    [
      {
        caption: 'The fitted surface',
        header: ['the term', 'its value', 'what it is'],
        rows: [
          ['E', fmt(fit.E, 5), floorNote(fit)],
          ['A', fmt(fit.A, 5), `the capacity term, with the exponent ${fmt(fit.alpha, 4)}`],
          ['B', fmt(fit.B, 5), `the data term, with the exponent ${fmt(fit.beta, 4)}`],
          ['R²', fmt(fit.r2, 4), `how much of the variation the surface explains over ${fit.points} runs`],
        ],
      },
      {
        caption: 'Every run, and the surface’s prediction of it',
        header: ['capacity', 'samples', 'measured loss', 'surface loss', 'residual'],
        rows: points.map((point) => [
          point.capacity,
          point.samples,
          fmt(point.loss, 5),
          fmt(surfaceLoss(fit, point.capacity, point.samples), 5),
          fmt(point.loss - surfaceLoss(fit, point.capacity, point.samples), 5),
        ]),
      },
      {
        caption: 'The four ways to spend the budget',
        header: ['the allocation', 'capacity', 'samples', 'the loss'],
        rows: allocations.map((row) => [row.name, fmt(row.capacity, 1), fmt(row.samples, 1), fmt(row.loss, 5)]),
      },
      {
        caption: `The crossover of N = ${pair.small} against each larger capacity`,
        header: ['the larger N', 'the ratio', 'the crossover compute', 'samples each has there', 'the loss both give'],
        rows: series.map((row) => [
          row.large,
          fmt(row.ratio, 2),
          fmt(row.budget, 2),
          fmt(row.samplesForLarge, 1),
          fmt(row.loss, 5),
        ]),
      },
    ],
  )
}

/** C · the nest of IsoFLOP curves, the frontier through their minima, and the finite pool. */
function isoflop(D) {
  const { fit } = trainingSurface(D)
  const budgets = [0, 1, 2].map((step) => 10 ** (D.budgetDecadeStart + 2 * step))
  const curve = isoFLOPCurve(fit, D.budget, { points: D.points })
  const optimum = analyticOptimum(fit, D.budget)
  const rule = tokensPerParameterRule(fit, budgets)
  const allocation = predictedAllocationExponents(fit)
  const measured = measuredAllocationExponents(fit, budgets)
  const front = frontier(fit, budgets)
  const gamma = frontierExponent(fit)
  const runout = budgetWhereDataRunsOut(fit, D.uniquePool)
  const constrained = constrainedOptimum(fit, D.budget, D.uniquePool)
  const fitted = insideFittedRange(optimum, FITTED_RANGE)

  const low = curve[0]
  const high = curve[curve.length - 1]
  const arm = (point, name) => [
    name,
    fmt(point.capacity, 1),
    fmt(point.samples, 1),
    fmt(point.loss, 5),
    fmt(point.excess, 5),
  ]

  return scenario(
    [
      ['budget', `10^${fmt(Math.log10(D.budget), 1)}`],
      ['the nest', budgets.map((budget) => `10^${Math.round(Math.log10(budget))}`).join(', ')],
      ['points per curve', D.points],
      ['the corpus', D.uniquePool],
      ['spectrum decay', fmt(D.decay, 2)],
      ['the noise', fmt(D.noise, 3)],
      ['seed', D.seed],
    ],
    [
      ['the optimum at this budget', `N ${fmt(optimum.capacity, 1)} · D ${fmt(optimum.samples, 1)}`, 'the closed form, not a search'],
      ['the loss there', fmt(optimum.loss, 5), `the curve’s own minimum is ${fmt(Math.min(...curve.map((point) => point.loss)), 5)}`],
      ['the frontier exponent', fmt(gamma, 4), `αβ/(α+β) = ${fmt(fit.alpha, 3)}·${fmt(fit.beta, 3)}/(${fmt(fit.alpha, 3)}+${fmt(fit.beta, 3)})`],
      ['the tokens per parameter', fmt(optimum.tokensPerParameter, 2), 'at the optimum of this budget'],
      ['the ratio’s exponent, measured', fmt(rule.exponent, 4), 'the slope of tokens-per-parameter against budget'],
      ['the ratio’s exponent, predicted', fmt(rule.predicted, 4), `(α−β)/(α+β) from the same two exponents`],
      ['the capacity’s share', fmt(allocation.capacity, 4), `β/(α+β); measured on these optima: ${fmt(measured.capacity, 4)}`],
      ['the data’s share', fmt(allocation.samples, 4), `α/(α+β); the two add to ${fmt(allocation.sum, 6)}`],
      ['the budget where the corpus runs out', fmt(runout, 2), `the compute at which D* first equals ${D.uniquePool} rows`],
      ['the epochs this budget forces', fmt(constrained.epochs, 2), constrained.binds ? 'the pool binds: the surplus is spent on repeats' : 'the pool does not bind at this budget'],
      ['the price of the constraint', fmt(constrained.price, 5), 'the loss over the unconstrained optimum at the same budget'],
      ['the ceiling used', percent(constrained.ceilingUse, 2), 'of U·(1 + R★), the most a finite pool can ever be worth'],
      ['the optimum is inside the grid', fitted.extrapolates ? 'no — it extrapolates' : 'yes', `capacity ${FITTED_RANGE.capacity[0]}–${FITTED_RANGE.capacity[1]}, samples ${FITTED_RANGE.samples[0]}–${FITTED_RANGE.samples[1]}`],
    ],
    [
      {
        caption: 'Each curve in the nest, at its own minimum',
        header: ['the budget', 'capacity', 'samples', 'tokens per parameter', 'the loss', 'the worst allocation at that cost'],
        rows: front.map((point) => [
          fmt(point.budget, 2),
          fmt(point.capacity, 1),
          fmt(point.samples, 1),
          fmt(point.tokensPerParameter, 2),
          fmt(point.loss, 5),
          fmt(point.worstLoss, 5),
        ]),
      },
      {
        caption: 'The arms of the curve at this budget',
        header: ['the end of the curve', 'capacity', 'samples', 'the loss', 'what it pays over the optimum'],
        rows: [arm(low, 'the data-heavy end'), arm(high, 'the capacity-heavy end')],
      },
      {
        caption: 'The budget split between capacity and data',
        header: ['the quantity', 'predicted', 'measured', 'the difference'],
        rows: [
          ['the capacity exponent', fmt(allocation.capacity, 6), fmt(measured.capacity, 6), fmt(allocation.capacity - measured.capacity, 6)],
          ['the data exponent', fmt(allocation.samples, 6), fmt(measured.samples, 6), fmt(allocation.samples - measured.samples, 6)],
          ['the sum of the two', fmt(allocation.sum, 6), fmt(measured.capacity + measured.samples, 6), fmt(allocation.sum - (measured.capacity + measured.samples), 6)],
        ],
      },
      {
        caption: 'The ratio at the optimum of each budget in the nest',
        header: ['the budget', 'tokens per parameter', 'capacity', 'samples'],
        rows: rule.ratioAt.map((row) => [
          fmt(row.budget, 2),
          fmt(row.tokensPerParameter, 3),
          fmt(analyticOptimum(fit, row.budget).capacity, 1),
          fmt(analyticOptimum(fit, row.budget).samples, 1),
        ]),
      },
      {
        caption: 'The same budget, spent two ways',
        header: ['the allocation', 'capacity', 'the tokens read', 'the passes over the pool', 'the data counted', 'the loss'],
        rows: [
          [
            'the unconstrained optimum, if the pool were infinite',
            fmt(constrained.unconstrained.capacity, 1),
            fmt(constrained.unconstrained.samples, 1),
            fmt(constrained.unconstrained.samples / D.uniquePool, 2),
            fmt(constrained.unconstrained.samples, 1),
            fmt(constrained.unconstrained.loss, 5),
          ],
          [
            'the optimum against the pool',
            fmt(constrained.capacity, 1),
            fmt(constrained.tokens, 1),
            fmt(constrained.epochs, 2),
            fmt(constrained.effectiveData, 1),
            fmt(constrained.loss, 5),
          ],
        ],
      },
      {
        caption: 'The optima at each budget, against the same pool',
        header: ['the budget', 'the unconstrained D*', 'the epochs it implies', 'the constrained loss', 'the price'],
        rows: budgets.map((budget) => {
          const point = constrainedOptimum(fit, budget, D.uniquePool)
          return [
            fmt(budget, 2),
            fmt(point.unconstrained.samples, 1),
            fmt(point.unconstrained.samples / D.uniquePool, 2),
            fmt(point.loss, 5),
            fmt(point.price, 5),
          ];
        }),
      },
    ],
  )
}

/** D · pruning a pool by four metrics, and the cliff each one breaks at. */
function percolation(D) {
  const pool = buildPruningPool({ rareFraction: D.rareFraction, noiseCoupling: D.noiseCoupling, seed: D.seed })
  const scores = metricScores(pool, D.metric, { noise: D.metricNoise })
  const curve = pruningCurve(pool, scores)
  const reading = percolationThreshold(curve)
  const edge = cliffEdge(curve)
  const composition = poolComposition(pool)
  const atKeep = curve.reduce((acc, point) => (Math.abs(point.fraction - D.keep) < Math.abs(acc.fraction - D.keep) ? point : acc), curve[0])
  const benchmarks = benchmarkMetrics(pool, { noise: D.metricNoise })
  const spread = informationSpread(pool)
  const prediction = predictThreshold(pool, { metricNoise: D.metricNoise })
  const laws = curationExponent(pool, D.metric, { noise: D.metricNoise })
  const volume = volumeLaw(pool)

  return scenario(
    [
      ['the metric', D.metric],
      ['the rare share', percent(D.rareFraction, 0)],
      ['the inputs show of the noise', fmt(D.noiseCoupling, 2)],
      ['the metric’s own error', fmt(D.metricNoise, 1)],
      ['the keep fraction inspected', percent(D.keep, 0)],
      ['rows', pool.x.length],
      ['seed', D.seed],
    ],
    [
      ['the threshold', fraction(reading.threshold), 'the smallest keep fraction that still costs nothing'],
      ['the best fraction', fraction(reading.bestFraction), `a loss of ${fmt(reading.bestLoss, 5)}, ${fmt(reading.maxGain, 5)} under the whole pool`],
      ['the cliff edge', fraction(edge), 'the smallest fraction still within twice the best loss'],
      ['the rare rows kept there', `${atKeep.rareKept} of ${composition.rare}`, `at ${percent(atKeep.fraction, 0)} kept: ${atKeep.tailCovered} of ${pool.tailDims.length} tail directions covered`],
      ['the predicted threshold', fraction(prediction.fraction), `the smallest fraction keeping ${prediction.required} rare rows`],
      ['the rare rows in the pool', String(prediction.rareRows), `${prediction.required} needed: ${pool.tailDims.length} tail directions × 3`],
      ['the separation the metric must bridge', `${fmt(spread.separation, 2)} nats`, `the rare rows’ mean log information over the bulk’s; the metric’s error is ${fmt(D.metricNoise, 1)}`],
      ['the information spread', `${fmt(spread.rest, 2)} within the bulk`, `${fmt(spread.rare, 2)} within the rare group`],
      ['the law of volume', fmt(laws.volume.alpha, 4), `α of random subsampling, with an R² of ${fmt(laws.volume.r2, 4)}`],
      ['the curated descent', laws.curated === null ? 'no fit' : fmt(laws.curated.alpha, 4), laws.curated === null ? 'too few improving points to fit a law at all' : `×${fmt(laws.ratio, 2)} steeper than volume`],
      ['the non-rare share', percent(nonRareShare(pool), 1), 'where a norm-based metric’s cliff sits'],
    ],
    [
      {
        caption: 'The pruning curve, point by point',
        header: ['kept', 'rows', 'the loss', 'a random subset', 'the excess', 'rare kept', 'tail directions covered', 'the least-covered one'],
        rows: curve.map((point) => [
          percent(point.fraction, 0),
          point.kept,
          fmt(point.loss, 5),
          fmt(point.randomLoss, 5),
          fmt(point.excessOverRandom, 5),
          point.rareKept,
          `${point.tailCovered} of ${pool.tailDims.length}`,
          `${point.rarestTailDim} rows`,
        ]),
      },
      {
        caption: 'Each metric at the fraction where it is best',
        header: ['rank', 'metric', 'best loss', 'kept', 'the threshold', 'over a random subset of that size', 'over a random subset of matched compute', 'the metric’s own cost'],
        rows: benchmarks.map((row) => [
          row.rank,
          row.metric,
          fmt(row.bestLoss, 5),
          `${percent(row.bestFraction, 0)} (${row.bestKept} rows)`,
          fraction(row.threshold),
          fmt(row.excessOverRandom, 5),
          fmt(row.gainAtMatchedCompute, 5),
          row.metricCostRows === 0 ? 'nothing' : `${row.metricCostRows} rows`,
        ]),
      },
      {
        caption: 'What each metric is',
        header: ['metric', 'what it computes'],
        rows: PRUNING_METRICS.map((metric) => [metric, METRIC_DESCRIPTIONS[metric]]),
      },
      {
        caption: 'The rare rows expected to survive the cut',
        header: ['the keep fraction', 'the rare rows expected', 'the requirement met?'],
        rows: prediction.survival.map((row) => [
          percent(row.fraction, 0),
          fmt(row.expectedRareKept, 2),
          row.expectedRareKept >= prediction.required ? 'yes' : 'no',
        ]),
      },
      {
        caption: 'Prediction and measurement, by the metric’s error',
        header: ['the error on the log score', 'the predicted threshold', 'the measured threshold', 'the best fraction', 'the gain there'],
        rows: [0, 0.5, 1, 2, 3, 4].map((error) => {
          const predicted = predictThreshold(pool, { metricNoise: error })
          const degraded = metricScores(pool, D.metric, { noise: error })
          const measured = percolationThreshold(pruningCurve(pool, degraded))
          return [
            fmt(error, 1),
            fraction(predicted.fraction),
            fraction(measured.threshold),
            fraction(measured.bestFraction),
            fmt(measured.maxGain, 5),
          ]
        }),
      },
      {
        caption: 'Two power laws fitted to one pool',
        header: ['the curve', 'the exponent', 'the coefficient', 'the R²', 'the rows it was fitted on'],
        rows: [
          ['random subsampling', fmt(laws.volume.alpha, 4), fmt(laws.volume.coefficient, 4), fmt(laws.volume.r2, 4), volume.points.length],
          [
            `pruned by ${D.metric}`,
            laws.curated === null ? 'no fit' : fmt(laws.curated.alpha, 4),
            laws.curated === null ? 'no fit' : fmt(laws.curated.coefficient, 4),
            laws.curated === null ? 'no fit' : fmt(laws.curated.r2, 4),
            laws.curated === null ? '—' : laws.curated.predictions.length,
          ],
        ],
      },
    ],
  )
}

/** E · two runs, the same tokens, different data, measured at every epoch. */
function epochs(D) {
  const curve = epochCurve({
    epochs: D.epochs,
    unique: D.unique,
    batch: D.batch,
    learningRate: D.learningRate,
    runs: D.runs,
    seed: D.seed,
  })
  const bounds = phaseBoundaries(curve)
  const dominant = dominanceEpoch(curve, { fraction: D.dominanceFraction })
  const last = curve[curve.length - 1]
  const worth = effectiveSamples(curve, bounds.bestEpoch)

  return scenario(
    [
      ['the epochs', D.epochs],
      ['the unique rows', D.unique],
      ['the batch', D.batch],
      ['the learning rate', fmt(D.learningRate, 3)],
      ['the restarts', D.runs],
      ['the dominance fraction', percent(D.dominanceFraction, 0)],
      ['seed', D.seed],
    ],
    [
      ['the warmup ends at', bounds.warmupEnd === null ? 'never' : `epoch ${bounds.warmupEnd}`, 'the last epoch the two runs are within 2% of each other'],
      ['the plateau starts at', bounds.plateauStart === null ? 'never' : `epoch ${bounds.plateauStart}`, 'the first epoch the gap is measurably open'],
      ['the turn upward at', bounds.decayStart === null ? 'never' : `epoch ${bounds.decayStart}`, 'the first epoch worse than the best by more than 2%'],
      ['the early-stopping epoch', `epoch ${bounds.bestEpoch}`, `the repeated run’s best loss, ${fmt(bounds.bestLoss, 5)}`],
      ['the gap at the last epoch', fmt(last.gap, 5), `${percent(last.relativeGap, 1)} of the fresh run’s loss`],
      ['the dominance epoch', dominant === null ? 'never' : `epoch ${dominant}`, `the first epoch worth less than ${percent(D.dominanceFraction, 0)} of a fresh one`],
      ['what the best epoch was worth', `${fmt(worth, 0)} rows`, 'the fresh-run row count that reaches the same loss'],
      ['the pool’s own value', fmt(D.unique * (1 + PAPER_REPETITION_CONSTANT.data), 0), 'U·(1 + R★) at the paper’s quoted constant'],
      ['the last epoch’s gain', fmt(last.repeatedGain, 6), `against ${fmt(last.freshGain, 6)} for a fresh epoch`],
      ['the tokens both runs read', String(last.tokens), `${D.runs} independent restarts averaged`],
    ],
    [
      {
        caption: 'Every epoch boundary, as measured',
        header: ['epoch', 'tokens read', 'repeated', 'fresh', 'the gap', 'train loss on the pool', 'a repeated epoch gains', 'a fresh epoch gains'],
        rows: curve.map((point) => [
          point.epoch,
          point.tokens,
          fmt(point.repeatedLoss, 5),
          fmt(point.freshLoss, 5),
          fmt(point.gap, 5),
          fmt(point.trainLoss, 5),
          fmt(point.repeatedGain, 6),
          fmt(point.freshGain, 6),
        ]),
      },
      {
        caption: 'Dominance by threshold',
        header: ['the fraction of a fresh epoch', 'the dominance epoch', 'the repeated loss there', 'the rows it is worth'],
        rows: [0.9, 0.75, 0.5, 0.25, 0.1].map((fractionValue) => {
          const epoch = dominanceEpoch(curve, { fraction: fractionValue })
          const point = epoch === null ? null : curve.find((row) => row.epoch === epoch)
          return [
            percent(fractionValue, 0),
            epoch === null ? 'never' : `epoch ${epoch}`,
            point ? fmt(point.repeatedLoss, 5) : '—',
            epoch === null ? '—' : `${fmt(effectiveSamples(curve, epoch), 0)} rows`,
          ]
        }),
      },
      {
        caption: 'Around the best epoch',
        header: ['the epoch', 'the pool loss', 'the held-out loss', 'against the best'],
        rows: curve
          .filter((point) => Math.abs(point.epoch - bounds.bestEpoch) <= 3)
          .map((point) => [
            point.epoch === bounds.bestEpoch ? `epoch ${point.epoch} (best)` : `epoch ${point.epoch}`,
            fmt(point.trainLoss, 5),
            fmt(point.repeatedLoss, 5),
            fmt(point.repeatedLoss - bounds.bestLoss, 5),
          ]),
      },
    ],
  )
}

/** F · the closed-form effective-data law and the allocation it implies. */
function repeats(D) {
  const task = buildRepeatsTask({ unique: D.unique, capacity: D.capacity, ridge: D.ridge, seed: D.seed })
  const comparison = repeatComparison(
    task,
    [1, 2, 4, 8, 16, 32].filter((count) => count <= D.maxRepeats),
    { ridge: D.ridge },
  )
  const passes = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48]
  const law = passes.map((repetition) => ({
    repetition,
    effective: effectiveDataLaw(D.pool, repetition, { rDStar: D.rDStar }),
    value: repetitionValue(repetition, { rDStar: D.rDStar }),
  }))
  const schedule = repetitionSchedule(D.pool, D.epochs, { rDStar: D.rDStar })
  const ceiling = D.pool * (1 + D.rDStar)
  const epochOfHalfValue = epochsForValue(0.5, { rDStar: D.rDStar })

  return scenario(
    [
      ['the unique rows', D.unique],
      ['the capacity', D.capacity],
      ['the ridge penalty', fmt(D.ridge, 3)],
      ['the most repeats', D.maxRepeats],
      ['the pool, in tokens', fmt(D.pool, 2)],
      ['the repetition constant R★', fmt(D.rDStar, 3)],
      ['the epochs listed', D.epochs],
      ['seed', D.seed],
    ],
    [
      ['the unique rows of the task', String(task.x.length), 'the pool the repeats are taken over'],
      ['the last run’s gap', fmt(comparison[comparison.length - 1].gap, 5), 'the price of the last round of repeats'],
      ['the repeated run’s loss', fmt(comparison[comparison.length - 1].repeatedLoss, 5), 'it does not improve: the ridge solution is identical'],
      ['the fresh run’s loss', fmt(comparison[comparison.length - 1].freshLoss, 5), 'it keeps improving'],
      ['the ceiling on effective data', fmt(ceiling, 2), 'U·(1 + R★): no number of passes is worth more'],
      ['epochs to half a fresh one', fmt(epochOfHalfValue, 2), 'the R at which the marginal pass is worth half a new epoch'],
      ['the value of the last listed pass', percent(schedule[schedule.length - 1].nextEpochValue, 2), 'of a fresh epoch, at the epoch count above'],
      ['the paper’s own constant', fmt(PAPER_REPETITION_CONSTANT.data, 6), 'quoted from arXiv:2305.16264, not fitted here'],
    ],
    [
      {
        caption: 'The price of each round of repeats',
        header: ['the repeats', 'the rows read', 'the repeated run', 'the fresh run', 'the gap', 'the ratio', 'the arithmetic'],
        rows: comparison.map((row) => [
          row.repeats,
          row.rows,
          fmt(row.repeatedLoss, 5),
          fmt(row.freshLoss, 5),
          fmt(row.gap, 5),
          fmt(row.ratio, 4),
          fmt(row.compute, 2),
        ]),
      },
      {
        caption: 'The law the paper fits, evaluated on this pool',
        header: ['the epochs', 'the extra passes', 'the effective data', 'the next pass is worth'],
        rows: law.map((row) => [
          row.repetition + 1,
          row.repetition,
          fmt(row.effective, 2),
          percent(row.value, 2),
        ]),
      },
      {
        caption: 'Epochs over a finite pool',
        header: ['the epoch', 'the tokens read', 'the effective data', 'the share of the ceiling', 'the next pass is worth'],
        rows: schedule.map((row) => [
          row.epoch,
          fmt(row.tokens, 2),
          fmt(row.effectiveData, 2),
          percent(row.effectiveData / ceiling, 2),
          percent(row.nextEpochValue, 2),
        ]),
      },
    ],
  )
}

/** G · one capability, two metrics, and the gap between their onsets. */
function emergence(D) {
  const compute = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]
  const curve = emergenceCurve(compute, D.length, { amplitude: D.amplitude, exponent: D.exponent })
  const short = emergenceCurve(compute, 1, { amplitude: D.amplitude, exponent: D.exponent })
  const exact = curve.map((point) => ({ compute: point.compute, exact: point.exact }))
  const continuous = curve.map((point) => ({ compute: point.compute, exact: point.continuous }))
  const sweep = logSweep(1, 2048, 40)
  const fine = emergenceCurve(sweep, D.length, { amplitude: D.amplitude, exponent: D.exponent })
  const fineScores = fine.map((point) => point.exact)
  const artefact = artefactGap(sweep, D.length, {
    floor: D.floor,
    blindAt: D.blindAt,
    amplitude: D.amplitude,
    exponent: D.exponent,
  })
  const cliff = cliffInterval(sweep, fineScores, { low: 0.1, high: 0.9 })
  const smoothCliff = cliffInterval(sweep, fine.map((point) => point.accuracy), { low: 0.1, high: 0.9 })

  return scenario(
    [
      ['the length', D.length],
      ['the metric’s threshold', fmt(D.threshold, 2)],
      ['the error at one unit of compute', fmt(D.amplitude, 2)],
      ['the exponent', fmt(D.exponent, 2)],
      ['the reporting floor', fmt(D.floor, 3)],
      ['the accuracy that counts as able', fmt(D.blindAt, 2)],
    ],
    [
      ['the sharpness of the cliff', ratioText(transitionSharpness(exact)), 'the ratio of the compute at 90% to the compute at 10%'],
      ['the same for a one-token task', ratioText(transitionSharpness(short)), 'the same capability, the same metric, a task of one token'],
      ['the roughness of the exact curve', fmt(roughness(exact), 4), 'the second difference, relative to the range'],
      ['the roughness of the continuous one', fmt(roughness(continuous), 4), 'the same diagnostic on the smooth reading'],
      ['the widest gap between the two', fmt(artefact.maxGap, 4), `at compute ${fmt(artefact.atCompute, 0)}: ${fmt(artefact.accuracyAtMax, 3)} accuracy against a score of ${fmt(artefact.scoreAtMax, 3)}`],
      ['the accuracy when the metric first spoke', fmt(artefact.accuracyAtOnset, 4), `at compute ${computeText(artefact.onset)}, above the ${fmt(D.floor, 3)} floor`],
      ['points called a failure while able', `${artefact.blindPoints} of ${sweep.length}`, `per-token accuracy at least ${fmt(D.blindAt, 2)} with a score at or below the floor`],
      ['the span of that blindness', fmt(artefact.blindSpan, 1), 'the compute over which the two readings disagree'],
      ['the biggest single jump', `${fmt(artefact.metricJump, 4)} versus ${fmt(artefact.performanceJump, 4)}`, 'the metric against the underlying performance'],
      ['the cliff as an interval', `${computeText(cliff.start)} to ${computeText(cliff.end)}`, `a width of ${fmt(cliff.width, 1)} and a ratio of ${ratioText(cliff.ratio)}`],
    ],
    [
      {
        caption: 'The score, by the length of the task',
        header: ['the compute', 'one token', 'five tokens', 'ten tokens', 'twenty tokens'],
        rows: compute.map((c) => {
          const at = (n) => fmt(emergenceCurve([c], n, { amplitude: D.amplitude, exponent: D.exponent })[0].exact, 4)
          return [c, at(1), at(5), at(10), at(20)]
        }),
      },
      {
        caption: 'The two readings of one sweep',
        header: ['the reading', 'the 10% onset', 'the 90% onset', 'the width', 'the ratio', 'the biggest step'],
        rows: [
          ['the whole-sequence score', computeText(cliff.start), computeText(cliff.end), fmt(cliff.width, 1), ratioText(cliff.ratio), fmt(maxStep(fineScores), 4)],
          ['the per-token accuracy', computeText(smoothCliff.start), computeText(smoothCliff.end), fmt(smoothCliff.width, 1), ratioText(smoothCliff.ratio), fmt(artefact.performanceJump, 4)],
        ],
      },
      {
        caption: 'Accuracy, score and the difference between them',
        header: ['the compute', 'the per-token accuracy', 'the whole-sequence score', 'the gap'],
        rows: fine.map((point) => [
          fmt(point.compute, 1),
          fmt(point.accuracy, 5),
          fmt(point.exact, 5),
          fmt(point.accuracy - point.exact, 5),
        ]),
      },
      {
        caption: 'The cliff, by threshold',
        header: ['the threshold', 'the first compute above half the score', 'the score at the end'],
        rows: [0.2, 0.35, 0.5, 0.65, 0.8].map((value) => {
          const shiftedCurve = metricShift(compute, D.length, value)
          const first = shiftedCurve.find((point) => point.score > 0.5)
          return [fmt(value, 2), first ? fmt(first.compute, 1) : 'never', fmt(shiftedCurve[shiftedCurve.length - 1].score, 4)]
        }),
      },
    ],
  )
}

/** H · a trend in FLOPs, the break inside it, and the year a loss became buyable. */
function hardware(D) {
  const { fit } = trainingSurface(D)
  const era = PAPER_ERAS[D.era] ?? PAPER_ERAS[1]
  const readings = eraReadings(era)
  const landmark = computeSeries({ era: D.era, pointsPerEra: D.pointsPerEra })
  const landmarkTrend = logLinearTrend(landmark)
  const fixture = hardwareSeries({
    breakYear: D.breakYear,
    beforeDoublingMonths: D.beforeDoublingMonths,
    afterDoublingMonths: D.afterDoublingMonths,
  })
  const wholeTrend = logLinearTrend(fixture)
  const breakFit = detectBreaks(fixture, { minPoints: 5, penalty: 2 })
  const beforeTrend = logLinearTrend(fixture.filter((point) => point.year <= D.breakYear))
  const afterTrend = logLinearTrend(fixture.filter((point) => point.year >= D.breakYear))

  const buyable = D.targetLoss > fit.E
  const requirement = buyable ? budgetForTargetLoss(fit, D.targetLoss) : null
  const searched = buyable ? budgetForTargetLossBySearch(fit, D.targetLoss) : null
  const feasible = buyable
    ? feasibilityOfTarget(fit, fixture, D.targetLoss, { hours: D.hours, flopsPerBudgetUnit: D.flopsPerBudgetUnit })
    : null
  const implied = lossImpliedByTrend(fit, wholeTrend.oomPerYear)
  const today = lossReachableInYear(fit, fixture, fixture[fixture.length - 1].year, {
    hours: D.hours,
    flopsPerBudgetUnit: D.flopsPerBudgetUnit,
  })

  const chain = requirement
    ? [
        ['the target loss', fmt(D.targetLoss, 5), 'the slider'],
        ['the budget at the optimum', fmt(requirement.budget, 3), 'the frontier inverted'],
        ['the capacity and tokens', `${fmt(requirement.capacity, 1)} · ${fmt(requirement.samples, 1)}`, 'analyticOptimum at that budget'],
        ['the FLOPs that costs', fmt(requirement.budget * D.flopsPerBudgetUnit, 3), `× the ${fmt(D.flopsPerBudgetUnit, 2)} bridge`],
        [
          'the rate needed in the run',
          fmt(feasible.flopPerSecond, 3),
          `over ${fmt(D.hours, 0)} hours = ${fmt(runCompute(feasible.flopPerSecond, D.hours), 3)} FLOPs`,
        ],
        ['the year', fmt(feasible.year, 2), feasible.beyond === null ? 'interpolated in the series' : 'projected outside the series'],
        ['the capability at that year', fmt(capabilityAt(fixture, feasible.year), 3), 'read back off the series as a check'],
      ]
    : [['the target loss', fmt(D.targetLoss, 5), `at or below the fitted floor of ${fmt(fit.E, 5)}: no budget reaches it`]]

  return scenario(
    [
      ['the era', `${era.era} (${era.from}–${era.to})`],
      ['the landmark runs listed', D.pointsPerEra],
      ['the break planted at', D.breakYear],
      ['doubling before / after', `${fmt(D.beforeDoublingMonths, 0)} / ${fmt(D.afterDoublingMonths, 0)} months`],
      ['the target loss', fmt(D.targetLoss, 3)],
      ['the wall-clock of a run', `${fmt(D.hours, 1)} hours`],
      ['the bridge to FLOPs', `×10^${fmt(Math.log10(D.flopsPerBudgetUnit), 1)}`],
      ['spectrum decay', fmt(D.decay, 2)],
      ['the noise', fmt(D.noise, 3)],
      ['seed', D.seed],
    ],
    [
      ['the paper’s slope', `${fmt(era.oomPerYear, 2)} OOM/yr`, `over ${era.runs} runs, from ${fmt(era.range[0], 1)} to ${fmt(era.range[1], 1)} FLOPs — both quoted`],
      ['what the slope implies', monthsText(monthsFromOomPerYear(era.oomPerYear)), 'the same figure, converted: the two reported numbers must agree'],
      ['what the range implies', `${fmt(readings.fromRange, 3)} OOM/yr`, `the ${fmt(readings.spanOom, 1)}-decade range over ${fmt(readings.years, 1)} years`],
      ['range over slope', `×${fmt(readings.rangeOverSlope, 2)}`, 'a trend and an envelope are different quantities'],
      ['the landmark fits on this fixture', `${fmt(landmarkTrend.oomPerYear, 4)} OOM/yr`, `a log-linear trend over ${landmarkTrend.points} synthetic runs, R² ${fmt(landmarkTrend.r2, 4)}`],
      ['the break detected', breakFit === null ? 'none found' : `about ${fmt(breakFit.year, 1)}`, `planted at ${D.breakYear}`],
      ['the slope before', `${fmt(breakFit?.before.oomPerYear ?? beforeTrend.oomPerYear, 3)} OOM/yr`, `planted as a ${monthsText(D.beforeDoublingMonths)} doubling`],
      ['the slope after', `${fmt(breakFit?.after.oomPerYear ?? afterTrend.oomPerYear, 3)} OOM/yr`, `planted as a ${monthsText(D.afterDoublingMonths)} doubling`],
      ['one trend over the whole', `${fmt(wholeTrend.oomPerYear, 3)} OOM/yr`, `and an R² of ${fmt(wholeTrend.r2, 4)} — the average hides the change`],
      buyable
        ? ['the budget the target costs', fmt(requirement.budget, 2), `the closed form; a bisection says ${fmt(searched, 2)}`]
        : ['the budget the target costs', 'not purchasable', `the target is at or below the fitted floor ${fmt(fit.E, 5)}`],
      buyable
        ? ['the year it becomes buyable', fmt(feasible.year, 1), feasible.beyond === null ? `inside the series, at ${fmt(feasible.flopPerSecond, 2)} FLOP/s` : `a projection past the ${feasible.beyond === 'start' ? 'beginning' : 'end'} of the series`]
        : ['the year it becomes buyable', 'no such year', 'the chain stops at the floor'],
      ['the best loss today', fmt(today.loss, 5), `at ${fmt(today.budget, 2)} of budget, with the run’s ${fmt(D.hours, 0)} hours`],
      ['what a year of the trend buys', fmt(implied.lossFactorPerYear, 4), `the frontier’s γ = ${fmt(implied.gamma, 4)} against ${fmt(wholeTrend.oomPerYear, 3)} OOM/yr`],
      ['years for a ten-times better loss', fmt(implied.yearsForTenTimesBetter, 2), 'the same figure as a doubling time'],
      ['Moore’s law as a rate', `${fmt(oomPerYearFromDoublingMonths(MOORE_DOUBLING_MONTHS), 3)} OOM/yr`, `transistor density doubling every ${fmt(MOORE_DOUBLING_MONTHS, 0)} months — quoted`],
    ],
    [
      {
        caption: `The ${era.era} era, ${era.from} to ${era.to}`,
        header: ['the reading', 'OOMs per year', 'the doubling time', 'what it is'],
        rows: [
          ['the reported slope', fmt(readings.fromSlope, 4), monthsText(era.doublingMonths), 'what the paper states'],
          ['the reported doubling time', fmt(readings.fromDoubling, 4), monthsText(monthsFromOomPerYear(readings.fromDoubling)), 'the same statement, converted'],
          ['the reported range', fmt(readings.fromRange, 4), monthsText(readings.monthsFromRange), 'the envelope of the two extreme runs'],
          ['the landmark fits on this fixture', fmt(landmarkTrend.oomPerYear, 4), monthsText(landmarkTrend.doublingMonths), `a log-linear trend over ${landmarkTrend.points} synthetic runs`],
        ],
      },
      {
        caption: 'The landmark fixture the readings are taken on',
        header: ['the year', 'the FLOPs', 'log₁₀ FLOPs'],
        rows: landmark.map((point) => [fmt(point.year, 1), fmt(point.value, 2), fmt(Math.log10(point.value), 3)]),
      },
      {
        caption: 'One trend against two',
        header: ['the reading', 'OOMs per year', 'the doubling time', 'the R²', 'the points'],
        rows: [
          ['the whole series', fmt(wholeTrend.oomPerYear, 4), monthsText(wholeTrend.doublingMonths), fmt(wholeTrend.r2, 4), wholeTrend.points],
          [
            breakFit === null ? 'no split found' : `before ${fmt(breakFit.year, 0)}`,
            breakFit === null ? '—' : fmt(breakFit.before.oomPerYear, 4),
            breakFit === null ? '—' : monthsText(breakFit.before.doublingMonths),
            breakFit === null ? '—' : fmt(breakFit.before.r2, 4),
            breakFit === null ? '—' : breakFit.before.points,
          ],
          [
            breakFit === null ? 'no split found' : `after ${fmt(breakFit.year, 0)}`,
            breakFit === null ? '—' : fmt(breakFit.after.oomPerYear, 4),
            breakFit === null ? '—' : monthsText(breakFit.after.doublingMonths),
            breakFit === null ? '—' : fmt(breakFit.after.r2, 4),
            breakFit === null ? '—' : breakFit.after.points,
          ],
        ],
      },
      {
        caption: 'The split, and what it earns',
        header: ['the quantity', 'the value', 'what it means'],
        rows: [
          ['the residual the split removes', breakFit === null ? '—' : fmt(breakFit.improvement, 6), 'the whole-series sum of squares, net of the penalty'],
          ['the BIC the split earns', breakFit === null ? '—' : fmt(breakFit.bicDelta, 4), 'positive is a break worth naming'],
          ['the penalty charged', fmt(2 * Math.log(fixture.length), 4), 'two extra parameters at log n each'],
          ['the points in the series', fixture.length, `${fixture[0].year} to ${fixture[fixture.length - 1].year}`],
        ],
      },
      {
        caption: 'From a loss to a year',
        header: ['the step', 'the quantity', 'the value', 'where it comes from'],
        rows: chain.map((row, index) => [buyable ? index + 1 : 1, row[0], row[1], row[2]]),
      },
      {
        caption: 'What the trend buys',
        header: ['the quantity', 'the value', 'what it means'],
        rows: [
          ['the frontier exponent γ', fmt(implied.gamma, 4), 'αβ/(α+β), from the fitted surface'],
          ['the hardware slope', `${fmt(wholeTrend.oomPerYear, 4)} OOM/yr`, 'the single trend over the whole fixture'],
          ['the loss factor per year', fmt(implied.lossFactorPerYear, 4), 'what one year of the trend buys'],
          ['years for a ten-times better loss', fmt(implied.yearsForTenTimesBetter, 2), 'the same figure as a doubling time'],
          ['today’s reachable loss', fmt(today.loss, 5), `at ${fmt(today.year, 0)}, ${fmt(D.hours, 0)} hours of run`],
        ],
      },
    ],
  )
}

const RUNNERS = { powerlaw, compute, isoflop, percolation, epochs, repeats, emergence, hardware }

/* ----------------------------------------------------------------- extreme sweep */

/**
 * The one coupling between two sliders, written the way the screen writes it.
 *
 * `epochs.batch` cannot be dragged past half the unique rows, so the corner where
 * every control is at its maximum is not a scenario a reader can reach: the screen
 * would have lowered the batch on the way. The sweep reaches the same state for the
 * same reason.
 */
const COUPLINGS = {
  epochs: (settings) => ({
    ...settings,
    batch: Math.min(settings.batch, Math.max(1, Math.floor(settings.unique / 2))),
  }),
}

/** The endpoints of one field, smallest first for numbers, in order for a list of options. */
function endpoints(values) {
  return typeof values[0] === 'number' ? [...values].sort((a, b) => a - b) : values
}

/** Every scenario the sweep visits for one laboratory: the start, each endpoint, then both corners. */
export function extremeScenarios(id) {
  const base = { ...LAB_DEFAULTS[id] }
  const domain = LAB_DOMAINS[id] ?? {}
  const couple = COUPLINGS[id] ?? ((settings) => settings)
  const visits = [{ name: 'where the screen starts', settings: couple(base) }]

  for (const [field, values] of Object.entries(domain)) {
    for (const value of endpoints(values)) visits.push({ name: `${field} at ${value}`, settings: couple({ ...base, [field]: value }) })
  }

  for (const corner of ['first', 'last']) {
    const settings = { ...base }
    for (const [field, values] of Object.entries(domain)) {
      const list = endpoints(values)
      settings[field] = corner === 'first' ? list[0] : list[list.length - 1]
    }
    visits.push({ name: `every control at its ${corner === 'first' ? 'minimum' : 'maximum'}`, settings: couple(settings) })
  }

  return visits
}

/** The strings that mean a number arrived without one, exactly as the screen test reads them. */
const BROKEN = ['NaN', 'undefined', 'Infinity', '[object', 'null']

/** What a printed result says that it should not, cell by cell. */
export function brokenCells(result) {
  const found = []
  const check = (where, value) => {
    const printed = String(value)
    const marker = BROKEN.find((candidate) => printed.includes(candidate))
    if (marker) found.push(`${where} prints ${marker}: ${printed}`)
  }
  for (const [key, value] of result.settings) check(`the setting ${key}`, value)
  for (const [name, value, note] of result.stats) {
    check(`the stat ${name}`, value)
    check(`the note on ${name}`, note ?? '')
  }
  for (const table of result.tables) {
    for (const row of table.rows) row.forEach((value, column) => check(`${table.caption}, ${table.header[column]}`, value))
  }
  return found
}

/**
 * One laboratory, run at every extreme its sliders allow.
 *
 * A scenario that throws is as broken as one that prints `NaN`: both are a reader
 * dragging a slider and getting nothing back, and only one of them shows in a test
 * that renders the middle of the range.
 */
export function sweep(id) {
  const offenders = []
  const visits = extremeScenarios(id)
  for (const visit of visits) {
    try {
      for (const line of brokenCells(RUNNERS[id](visit.settings))) offenders.push(`${visit.name}: ${line}`)
    } catch (error) {
      offenders.push(`${visit.name}: throws ${error.message ?? error}`)
    }
  }
  return { visits: visits.length, offenders }
}

/** All eight laboratories, with the sweep's own exit status. */
export function sweepAll() {
  return Object.keys(RUNNERS).map((id) => ({ id, ...sweep(id) }))
}

/* ------------------------------------------------------------------------ main */

function parseArgs(argv) {
  const options = { labs: [], csv: false, json: false, seed: null, extremes: false, list: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i]
    if (argument === '--csv') options.csv = true
    else if (argument === '--json') options.json = true
    else if (argument === '--extremes') options.extremes = true
    else if (argument === '--list') options.list = true
    else if (argument === '--help' || argument === '-h') options.help = true
    else if (argument === '--seed') {
      const value = Number(argv[++i])
      if (!Number.isInteger(value)) throw new Error('--seed wants an integer')
      options.seed = value
    } else if (argument === 'all') options.labs.push(...Object.keys(RUNNERS))
    else if (argument?.startsWith('-')) throw new Error(`unknown option ${argument}`)
    else if (RUNNERS[argument]) options.labs.push(argument)
    else throw new Error(`no laboratory called ${argument}\n\n${HELP}`)
  }
  if (options.labs.length === 0 && !options.list && !options.help) options.labs.push(...Object.keys(RUNNERS))
  return options
}

function csvRow(value) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function text(lab, result) {
  const lines = []
  lines.push(`${lab.name} — ${lab.blurb}`)
  lines.push(`  settings  ${result.settings.map(([key, value]) => `${key}: ${value}`).join(' · ')}`)
  lines.push('')
  // A label or value wider than its column would otherwise run straight into the next one.
  const labelWidth = Math.max(32, ...result.stats.map(([name]) => String(name).length)) + 2
  const width = Math.max(18, ...result.stats.map(([, value]) => String(value).length)) + 2
  for (const [name, value, note] of result.stats) {
    lines.push(`  ${String(name).padEnd(labelWidth)}${String(value).padEnd(width)}${note ?? ''}`.trimEnd())
  }
  for (const table of result.tables) {
    lines.push('')
    lines.push(`  ${table.caption}`)
    const cells = [table.header, ...table.rows].map((row) => row.map(String))
    const widths = table.header.map((_, column) => Math.max(...cells.map((row) => (row[column] ?? '').length)) + 2)
    const line = (row) => `    ${row.map((cell, column) => String(cell).padEnd(widths[column])).join('').trimEnd()}`
    lines.push(line(table.header))
    for (const row of table.rows) lines.push(line(row))
  }
  return lines.join('\n')
}

function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(String(error.message ?? error))
    process.exit(2)
  }

  if (options.help) {
    console.log(HELP)
    return
  }
  if (options.list) {
    for (const lab of LABS) console.log(`${lab.id}\t${lab.name}`)
    return
  }

  if (options.extremes) {
    let broken = 0
    for (const id of options.labs) {
      const { visits, offenders } = sweep(id)
      broken += offenders.length
      console.log(`${id.padEnd(12)}${String(visits).padStart(3)} scenarios  ${offenders.length === 0 ? 'clean' : `${offenders.length} broken`}`)
      for (const line of offenders) console.log(`    ${line}`)
    }
    console.log(broken === 0 ? '\nno scenario prints a broken number.' : `\n${broken} broken scenarios.`)
    process.exitCode = broken === 0 ? 0 : 1
    return
  }

  const rows = [['lab', 'kind', 'metric', 'value', 'note']]
  const documents = []

  for (const id of options.labs) {
    const lab = LABS.find((entry) => entry.id === id)
    // The screen's own starting values, read from the same object the screen reads them from.
    const settings = { ...LAB_DEFAULTS[id] }
    if (options.seed !== null && 'seed' in settings) settings.seed = options.seed
    const result = RUNNERS[id](settings)

    if (options.json) {
      documents.push({
        lab: id,
        name: lab.name,
        settings: Object.fromEntries(result.settings),
        stats: Object.fromEntries(result.stats.map(([name, value]) => [name, value])),
        tables: result.tables.map((table) => ({ caption: table.caption, header: table.header, rows: table.rows })),
      })
      continue
    }

    if (options.csv) {
      for (const [key, value] of result.settings) rows.push([id, 'setting', key, String(value), ''])
      for (const [name, value, note] of result.stats) rows.push([id, 'stat', name, String(value), note ?? ''])
      for (const table of result.tables) {
        for (const row of table.rows) rows.push([id, 'row', table.caption, row.map(String).join(' | '), ''])
      }
      continue
    }

    console.log(text(lab, result))
    console.log('')
  }

  if (options.json) {
    console.log(JSON.stringify(documents.length === 1 ? documents[0] : documents, null, 2))
  } else if (options.csv) {
    for (const row of rows) console.log(row.map(csvRow).join(','))
  }
}

// Run when asked for from a shell; stay silent when imported by the sweep test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
