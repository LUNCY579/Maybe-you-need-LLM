/**
 * Feature splitting and absorption in a sparse autoencoder.
 *
 * Cunningham et al. (2023) put two features in superposition, trained a sparse
 * autoencoder, and got different answers depending on how hard it pushed on
 * sparsity. Push gently and the dictionary settles on a direction that serves both
 * features at once — a **merged**, polysemantic element where there were two
 * ground-truth features. Push harder and the elements move onto the features
 * themselves, one each: the pair has **split** into two monosemantic dictionary
 * features. `splittingCurve` runs that experiment eight times per coefficient and
 * counts what happens: at `lambda = 0` every run has a merged row and no run is
 * split, at `lambda = 0.06` six of the eight have split and two still carry a merged
 * row, and at `lambda = 0.15` the penalty has starved the fit in seven of them — the
 * point is marked `degraded`, because what the counts measure there is a broken
 * autoencoder rather than a finding.
 *
 * Absorption is the third act, and the one that makes a dictionary hard to read.
 * Give one of the two features a fifth of the prevalence and, at every coefficient in
 * the curve, it ends up with an element of its own in fewer runs than the frequent
 * feature does — seven runs in eight against one at the gentle end — and it is
 * reconstructed by leaning on the frequent feature's row instead, so its energy is
 * **absorbed** into an element that is nominally about something else. Its leak is
 * the larger of the two at every coefficient too, which is the part that survives
 * being asked twice. Absorption is therefore a prevalence effect rather than a
 * larger penalty, which is why the two readings above need two setups. (Splitting is
 * the paper's; the name and the mechanism of absorption come from the follow-on
 * literature on absent sparsity features, and what is computed here is our own
 * measurable version of it, defined in `featureReports`. It is not a metric the
 * papers report, and no number in this module is quoted as one.)
 *
 * **The setup is the smallest one in which all three appear**: two features, one
 * two-dimensional stream, the two directions at an angle so that neither coordinate
 * of the stream is either feature, and one feature active at a time so that a
 * dictionary element's firing pattern says which feature it is about. Ground truth
 * is known by construction, which is the only reason any claim here can be a test
 * rather than an impression — and the training is seeded throughout, because which
 * row ends up owning which feature is an outcome of optimisation, not a theorem.
 */

import { createRng, dot } from '@llm-materials/course-core'
import type { Matrix, Vector } from '@llm-materials/course-core'
import { decode, encode, evaluateAutoencoder, trainAutoencoder, type SaeTrainingOptions, type SparseAutoencoder } from './sae'

/* ------------------------------------------------------------------- the setup */

export interface SuperposedSetup {
  /** The width of the stream: two dimensions, so that two features can overlap. */
  dimensions: number
  /** One unit row per ground-truth feature; the directions the features really are. */
  directions: Matrix
  names: string[]
  /** The share of the non-blank activations each feature gets. */
  prevalence: number[]
  activations: Vector[]
  /** `active[i]` lists the features switched on in `activations[i]` — here, at most one. */
  active: number[][]
  /** The angle between successive ground-truth directions, in radians. */
  angle: number
}

export interface SetupOptions {
  /** How many ground-truth features. Two is the case the paper draws. */
  features?: number
  /** Radians between successive directions. Two features at angle zero are one feature. */
  angle?: number
  /** A single weight for every feature, or one per feature. Normalised if they do not sum to 1. */
  prevalence?: number | number[]
  /** The share of activations with no feature on. A little blank space keeps the biases honest. */
  blank?: number
  samples?: number
  /** The seed. */
  seed?: number
}

/**
 * Sample the superposed stream.
 *
 * The stream is two-dimensional, always: two is the smallest number of dimensions
 * in which two features can overlap at all. Ask for more features and they are
 * packed into that plane, which is superposition rather than a mistake — it is the
 * case with more to say about absorption.
 *
 * Each activation carries at most one feature, with an amplitude drawn uniformly
 * from `[0.5, 1.5]`. Both choices are load-bearing. Fixed amplitudes would leave the
 * data as a handful of isolated points, and a dictionary can cover isolated points
 * with rows of its own without ever representing a *feature*; spread along their
 * rays, the only directions that reconstruct the data cheaply are the rays
 * themselves, which is what makes the sparsity pressure pick out the ground-truth
 * features at all. Exclusively one feature at a time is what makes a row's firing
 * pattern readable as "this row is about feature j" — co-active features would make
 * a perfectly aligned row fire at half purity for the other one, for no reason
 * except that the two happen to occur together.
 */
export function buildSuperposedSetup(options: SetupOptions = {}): SuperposedSetup {
  const features = options.features ?? 2
  const angle = options.angle ?? Math.PI / 4
  const samples = options.samples ?? 200
  const blank = options.blank ?? 0.1
  const dimensions = 2
  const rng = createRng(options.seed ?? 5)

  const perFeature = Array.isArray(options.prevalence) ? options.prevalence : undefined
  const uniform = typeof options.prevalence === 'number' ? options.prevalence : 1
  const weights = Array.from({ length: features }, (_, index) => perFeature?.[index] ?? uniform)
  const total = weights.reduce((acc, value) => acc + value, 0)
  const prevalence = weights.map((value) => value / total)

  const directions: Matrix = Array.from({ length: features }, (_, index) => {
    const vector = new Array<number>(dimensions).fill(0)
    vector[0] = Math.cos(index * angle)
    vector[1] = Math.sin(index * angle)
    return vector
  })

  // Directions that coincide are one feature wearing two names, and a dictionary
  // cannot split what was never two. `angle = 0` is the usual way to ask for that,
  // but the same happens where the second direction is the first one backwards.
  for (let a = 0; a < features; a++) {
    for (let b = a + 1; b < features; b++) {
      if (Math.abs(dot(directions[a]!, directions[b]!)) > 1 - 1e-9) {
        throw new RangeError(
          `buildSuperposedSetup: directions ${a} and ${b} coincide at angle ${angle}, so there is nothing to separate. Change the angle.`,
        )
      }
    }
  }

  const activations: Vector[] = []
  const active: number[][] = []
  for (let sample = 0; sample < samples; sample++) {
    const stream = new Array<number>(dimensions).fill(0)
    const on: number[] = []
    if (rng() >= blank) {
      let draw = rng()
      let feature = features - 1
      for (let candidate = 0; candidate < features; candidate++) {
        draw -= prevalence[candidate]!
        if (draw < 0) {
          feature = candidate
          break
        }
      }
      on.push(feature)
      const amplitude = 0.5 + rng()
      for (let dimension = 0; dimension < dimensions; dimension++) {
        stream[dimension] = (stream[dimension] ?? 0) + (directions[feature]![dimension] ?? 0) * amplitude
      }
    }
    activations.push(stream)
    active.push(on)
  }

  return {
    dimensions,
    directions,
    names: Array.from({ length: features }, (_, index) => `feature ${index}`),
    prevalence,
    activations,
    active,
    angle,
  }
}

/* --------------------------------------------------------------- the geometry */

/**
 * How close a decoder direction has to be to a ground-truth one to count as
 * *being* it. 0.9 is 26°, which is generous for a direction; it is safe here only
 * because the behavioural test below comes first, and a row that responds to two
 * features can never use it.
 */
const OWN_TOLERANCE = 0.9
/** A feature has to make up this share of a row's firing for the row to respond to it. */
const RESPONSE_SHARE = 0.25
/** A row this rarely used is not representing anything, however well it behaves. */
const ALIVE_THRESHOLD = 0.02
/**
 * A code has to clear this to count as firing.
 *
 * `cos(π/2)` is 6.1e-17 rather than 0, so a row that should be silent on a feature
 * fires on it at a magnitude that is pure rounding. Any test of the form `code > 0`
 * then reads that row as serving both features at once, which is exactly the
 * distinction this module is trying to make.
 */
const ACTIVE_EPSILON = 1e-9

export interface DictionaryRow {
  index: number
  /** The unit decoder direction of this row. */
  direction: Vector
  /** Cosine with every ground-truth direction. */
  cosine: number[]
  /** The fraction of activations this row is active on. */
  firing: number
  /**
   * `P(feature j is the one on | this row fires and some feature is on)`.
   *
   * Blank activations are in `firing` but not in the denominator, because a row that
   * fires on the blanks too is not less *about* a feature for it — including them
   * would put a perfectly monosemantic row at 0.84 and a perfectly merged one at 0.5
   * for a reason that has nothing to do with either feature. With the blanks out,
   * the shares sum to one, and the read is clean.
   */
  purity: number[]
  /**
   * How many features this row serves at once: the inverse participation ratio of
   * its purity, so 1 is monosemantic, 2 is a merged pair, and 0 is a row that only
   * ever fires on the blanks. A continuous count beats a threshold at the knife
   * edge — with two features a merged row sits at 0.5/0.5, and any cut through the
   * middle of that flips with a handful of samples.
   */
  effectiveFeatures: number
  /** The features this row responds to — more than one is a merged row. */
  respondsTo: number[]
  /** Whether the row is used at all. */
  alive: boolean
  /**
   * The ground-truth feature this row owns: the one it responds to alone, whose
   * direction it lies within `OWN_TOLERANCE` of, on a row that is in use.
   *
   * Both halves matter. Behaviour without alignment is a dictionary element that
   * fires for a feature along the wrong direction, which is what an absorbed
   * feature looks like from the outside; alignment without behaviour is the merged
   * element, which is close to one feature's direction precisely because it is
   * trying to serve both.
   */
  owns: number | null
}

/** The geometry of every dictionary element of a trained autoencoder. */
export function dictionaryRows(autoencoder: SparseAutoencoder, setup: SuperposedSetup): DictionaryRow[] {
  const codes = setup.activations.map((activation) => encode(autoencoder, activation))

  return autoencoder.decoder.map((row, index) => {
    const length = Math.sqrt(dot(row, row))
    const direction = length > 1e-12 ? row.map((value) => value / length) : row.slice()
    const cosine = setup.directions.map((truth) => dot(direction, truth))

    let fires = 0
    let firesOnFeature = 0
    const perFeature = new Array<number>(setup.directions.length).fill(0)
    codes.forEach((code, sample) => {
      if ((code[index] ?? 0) <= ACTIVE_EPSILON) return
      fires++
      const on = setup.active[sample]!
      if (on.length === 0) return
      firesOnFeature++
      for (const feature of on) perFeature[feature] = (perFeature[feature] ?? 0) + 1
    })

    const purity = perFeature.map((count) => (firesOnFeature === 0 ? 0 : count / firesOnFeature))
    const squares = purity.reduce((acc, value) => acc + value * value, 0)
    const sum = purity.reduce((acc, value) => acc + value, 0)
    const respondsTo = purity
      .map((value, feature) => ({ value, feature }))
      .filter((entry) => entry.value > RESPONSE_SHARE)
      .map((entry) => entry.feature)
    const alive = fires / Math.max(1, codes.length) > ALIVE_THRESHOLD
    const owned = respondsTo.length === 1 && cosine[respondsTo[0]!]! >= OWN_TOLERANCE

    return {
      index,
      direction,
      cosine,
      firing: codes.length === 0 ? 0 : fires / codes.length,
      purity,
      effectiveFeatures: sum === 0 || squares === 0 ? 0 : (sum * sum) / squares,
      respondsTo,
      alive,
      owns: alive && owned ? respondsTo[0]! : null,
    }
  })
}

export interface FeatureReport {
  feature: number
  name: string
  /** Rows that own this feature: in use, about nothing else, and pointing its way. */
  dedicated: number[]
  /** Rows that respond to this feature and to at least one other — the merged elements. */
  shared: number[]
  /**
   * The mean cosine between the reconstruction of this feature's activations and the
   * feature's own direction. 1 is a perfect reading: the dictionary says the feature
   * along its own direction.
   */
  alignment: number
  /**
   * The mean relative length of the part of the reconstruction that is *not* along the
   * feature's own direction — the leak. A feature reconstructed by somebody else's
   * dictionary element has a large leak, and the leak points somewhere specific:
   * `absorbedInto`.
   */
  absorption: number
  /** The feature whose direction the leak points along, when the leak is material. */
  absorbedInto: number | null
  /** How often the feature is on at all, in the sampled activations. */
  prevalence: number
}

export interface ReportOptions {
  /** An `absorption` above this counts as absorbed, and lets the leak be named. */
  absorptionThreshold?: number
}

/**
 * Per ground-truth feature: who represents it, and which direction the
 * reconstruction actually spends on it.
 *
 * The decomposition is ours rather than the papers'. A reconstruction `r` of an
 * activation whose only feature is `f` splits into the part along `f`'s own
 * direction and the part that is not:
 *
 *   r = (r · d̂) d̂ + leak
 *
 * If the dictionary owns the feature the leak is nil. If it does not, the leak is
 * the whole story, and reading which ground-truth direction the mean leak is
 * closest to names the feature that absorbed it. This measures behaviour on the
 * feature's own activations rather than the geometry of the dictionary, which is
 * what an absorbed feature does not have.
 */
export function featureReports(
  autoencoder: SparseAutoencoder,
  setup: SuperposedSetup,
  rows?: DictionaryRow[],
  options: ReportOptions = {},
): FeatureReport[] {
  const threshold = options.absorptionThreshold ?? 0.15
  const geometry = rows ?? dictionaryRows(autoencoder, setup)

  return setup.directions.map((direction, feature) => {
    const own = unit(direction)
    let alignmentTotal = 0
    let absorptionTotal = 0
    let leakCount = 0
    const leak = new Array<number>(setup.dimensions).fill(0)

    setup.activations.forEach((activation, index) => {
      if (setup.active[index]!.length !== 1 || setup.active[index]![0] !== feature) return
      const reconstruction = decode(autoencoder, encode(autoencoder, activation))
      const length = Math.sqrt(dot(reconstruction, reconstruction))
      if (length < 1e-9) return
      const along = dot(reconstruction, own)
      alignmentTotal += along / length
      const residual = reconstruction.map((value, dimension) => value - along * own[dimension]!)
      absorptionTotal += Math.sqrt(dot(residual, residual)) / length
      leakCount++
      for (let dimension = 0; dimension < setup.dimensions; dimension++) leak[dimension] = (leak[dimension] ?? 0) + (residual[dimension] ?? 0)
    })

    const measured = Math.max(1, leakCount)
    const alignment = alignmentTotal / measured
    const absorption = absorptionTotal / measured
    const meanLeak = leak.map((value) => value / measured)

    // The *mean* leak, not the per-activation residuals: their directions coincide
    // and only their scales differ, so the mean is the one clean estimate of where
    // the dictionary spent the feature's energy.
    let absorbedInto: number | null = null
    let best = 0
    setup.directions.forEach((other, candidate) => {
      if (candidate === feature) return
      const similarity = dot(unit(meanLeak), unit(other))
      if (Math.abs(similarity) > best) {
        best = Math.abs(similarity)
        absorbedInto = candidate
      }
    })

    return {
      feature,
      name: setup.names[feature]!,
      dedicated: geometry.filter((row) => row.owns === feature).map((row) => row.index),
      shared: geometry.filter((row) => row.respondsTo.includes(feature) && row.respondsTo.length > 1).map((row) => row.index),
      alignment,
      absorption,
      absorbedInto: absorption > threshold && best > 0.5 ? absorbedInto : null,
      prevalence: setup.activations.filter((_, index) => setup.active[index]!.includes(feature)).length / Math.max(1, setup.activations.length),
    }
  })
}

/** The same vector scaled to unit length, or the zero vector if it has no length. */
function unit(vector: Vector): Vector {
  const length = Math.sqrt(dot(vector, vector))
  return length > 1e-12 ? vector.map((value) => value / length) : vector.slice()
}

/* ------------------------------------------------------------- the phenomena */

/**
 * One ground-truth feature carried by two dictionary rows that fire apart from each
 * other.
 *
 * This is the *other* thing called splitting: not the superposed pair coming apart,
 * which is `split` below, but one feature spread over two elements of the
 * dictionary. It deserves its own name because a count of monosemantic rows cannot
 * tell the two apart, and they mean different things for reading a dictionary.
 */
export interface DuplicatePair {
  feature: number
  /** The two rows that both own this feature. */
  rows: [number, number]
  /** Cosine between the two rows' directions. */
  similarity: number
  /** `P(both fire) / P(either fires)`: near one for a duplicate, near zero for a genuine split. */
  overlap: number
}

export interface GeometryReport {
  rows: DictionaryRow[]
  features: FeatureReport[]
  /** Ground-truth features with at least one owner: the dictionary separated them out. */
  ownedFeatures: number[]
  /** Ground-truth features with no owner. */
  unownedFeatures: number[]
  /** Live rows that serve two or more features at once — the merged, polysemantic elements. */
  mergedRows: number[]
  /** Live rows that own a feature. */
  ownerRows: number[]
  /** Live rows that respond to one feature alone but whose decoder points elsewhere. */
  misplacedRows: number[]
  /** One feature carried by two rows that fire on different activations. */
  duplicates: DuplicatePair[]
  /** Features whose leak clears `absorptionThreshold`. */
  absorbed: number[]
  /**
   * Every feature has an owner and no live row serves two features: the superposed
   * pair has split into one dictionary element each.
   */
  split: boolean
}

/**
 * Classify what the dictionary did.
 *
 * The row lists are complementary by construction, which is the point: a merged row
 * is one that answers for two features, an owner row answers for one and lies along
 * its direction, and a misplaced row answers for one but does not — the distinction
 * a geometry-only reading loses. Both ownership and merging come from the same
 * `respondsTo` test, so no row can be in two of the lists.
 */
export function geometryReport(autoencoder: SparseAutoencoder, setup: SuperposedSetup, options: ReportOptions = {}): GeometryReport {
  const threshold = options.absorptionThreshold ?? 0.15
  const rows = dictionaryRows(autoencoder, setup)
  const features = featureReports(autoencoder, setup, rows, options)
  const codes = setup.activations.map((activation) => encode(autoencoder, activation))

  const duplicates: DuplicatePair[] = []
  for (const feature of features) {
    for (let a = 0; a < feature.dedicated.length; a++) {
      for (let b = a + 1; b < feature.dedicated.length; b++) {
        const first = feature.dedicated[a]!
        const second = feature.dedicated[b]!
        let both = 0
        let either = 0
        for (const code of codes) {
          const onFirst = (code[first] ?? 0) > ACTIVE_EPSILON
          const onSecond = (code[second] ?? 0) > ACTIVE_EPSILON
          if (onFirst || onSecond) either++
          if (onFirst && onSecond) both++
        }
        duplicates.push({
          feature: feature.feature,
          rows: [first, second],
          similarity: dot(rows[first]!.direction, rows[second]!.direction),
          overlap: either === 0 ? 0 : both / either,
        })
      }
    }
  }

  const mergedRows = rows.filter((row) => row.alive && row.respondsTo.length > 1).map((row) => row.index)
  const ownedFeatures = features.filter((feature) => feature.dedicated.length > 0).map((feature) => feature.feature)

  return {
    rows,
    features,
    ownedFeatures,
    unownedFeatures: features.filter((feature) => feature.dedicated.length === 0).map((feature) => feature.feature),
    mergedRows,
    ownerRows: rows.filter((row) => row.owns !== null).map((row) => row.index),
    misplacedRows: rows
      .filter((row) => row.alive && row.respondsTo.length === 1 && row.owns === null)
      .map((row) => row.index),
    duplicates: duplicates.filter((pair) => pair.overlap < 0.5),
    absorbed: features.filter((feature) => feature.absorption > threshold).map((feature) => feature.feature),
    split: features.length > 0 && ownedFeatures.length === features.length && mergedRows.length === 0,
  }
}

/* ----------------------------------------------------------------- the sweep */

/** The sparsity coefficients the laboratory walks by default. */
const LAMBDAS = [0, 0.01, 0.02, 0.04, 0.06, 0.1, 0.15]

export interface SweepOptions {
  lambdas?: number[]
  /** How many dictionary elements to train. Eight is four per feature: room to split. */
  dictionaryFeatures?: number
  training?: SaeTrainingOptions
}

export interface SweepPoint {
  lambda: number
  l0: number
  reconstructionError: number
  explainedVariance: number
  /** How many ground-truth features have at least one dictionary owner. */
  ownedFeatures: number
  /** How many live rows serve two or more features at once. */
  mergedRows: number
  /** How many live rows own a feature. */
  ownerRows: number
  /** How many ground-truth features leak onto another feature's direction. */
  absorbedFeatures: number
  /** Whether the superposed pair has fully split into one element per feature. */
  split: boolean
  /**
   * Whether the autoencoder stopped reconstructing at all, which is what happens
   * once the penalty is heavy enough to starve the dictionary. Every count on such
   * a point is a measurement of a failed fit, and the laboratory says so rather
   * than quietly dropping the row.
   */
  degraded: boolean
  report: GeometryReport
}

/** Train one autoencoder on the setup at one sparsity coefficient, and read it out. */
function runAtLambda(
  setup: SuperposedSetup,
  lambda: number,
  options: SweepOptions = {},
  training: SaeTrainingOptions = {},
): SweepPoint {
  const result = trainAutoencoder(setup.activations, options.dictionaryFeatures ?? 8, {
    seed: 3,
    learningRate: 0.05,
    // Seven hundred steps is not enough: the dictionary is still moving when the
    // reading is taken, and a snapshot of a moving dictionary does not show the
    // trend the sweep is here to measure.
    steps: 1500,
    ...options.training,
    ...training,
    sparsityCoefficient: lambda,
  })
  const evaluation = evaluateAutoencoder(result.autoencoder, setup.activations)
  const report = geometryReport(result.autoencoder, setup)
  return {
    lambda,
    l0: evaluation.l0,
    reconstructionError: evaluation.reconstructionError,
    explainedVariance: evaluation.explainedVariance,
    ownedFeatures: report.ownedFeatures.length,
    mergedRows: report.mergedRows.length,
    ownerRows: report.ownerRows.length,
    absorbedFeatures: report.absorbed.length,
    split: report.split,
    degraded: evaluation.explainedVariance < 0.5,
    report,
  }
}

/**
 * Train the same setup across a range of sparsity coefficients, once each.
 *
 * Nothing changes but `lambda`, and the dictionary is read out each time. The point
 * of carrying the whole `report` on every row is that a curve of counts is not the
 * result — *which* rows merged, split or absorbed is.
 *
 * One run per `lambda` is one draw from a stochastic optimiser, so where a single
 * number matters use `splittingCurve`, which repeats the same sweep from several
 * initialisations and reports how often each outcome happens.
 */
export function sparsitySweep(setup: SuperposedSetup, options: SweepOptions = {}): SweepPoint[] {
  const lambdas = options.lambdas ?? LAMBDAS
  return lambdas.map((lambda) => runAtLambda(setup, lambda, options))
}

export interface CurvePoint {
  lambda: number
  runs: number
  /** Means over the runs. */
  l0: number
  reconstructionError: number
  explainedVariance: number
  ownedFeatures: number
  mergedRows: number
  /** How many runs ended with every feature owned and no row serving two features. */
  splitRuns: number
  /** How many runs still had a merged, polysemantic row in them. */
  mergedRuns: number
  /** How many runs the penalty starved. */
  degradedRuns: number
  /** How many runs each ground-truth feature ended up with a dictionary owner in. */
  ownerRuns: number[]
  /** The mean leak, off each feature's own direction, per ground-truth feature. */
  absorptionPerFeature: number[]
  /** Every run behind the averages, so a screen can show the scatter rather than a bar. */
  points: SweepPoint[]
}

/**
 * Repeat the sparsity sweep from several initialisations and count the outcomes.
 *
 * This is the experiment behind the paper's headline figure, done in the way that
 * survives being asked twice. Whether a given dictionary element ends up owning a
 * given feature is an outcome of stochastic optimisation, and a single run of it is
 * an anecdote: at `lambda = 0.02` the pair splits in some runs and not others. What
 * is reproducible is the *rate*, and the two phenomena this module is about show up
 * in it — the merged row's share falls and the split's rises as `lambda` grows, then
 * both fall away once the penalty starves the fit; and make one feature rare and its
 * leak is larger than the frequent feature's at every `lambda`, which is absorption
 * as a prevalence effect rather than a bigger penalty.
 *
 * Run `r` trains from seed `seed + r`, so the data does not change underneath the
 * sweep and only the initialisation does.
 */
export function splittingCurve(
  setup: SuperposedSetup,
  options: SweepOptions & { runs?: number } = {},
): CurvePoint[] {
  const lambdas = options.lambdas ?? LAMBDAS
  const runs = Math.max(1, Math.floor(options.runs ?? 8))
  const baseSeed = options.training?.seed ?? 3

  return lambdas.map((lambda) => {
    const points: SweepPoint[] = []
    for (let run = 0; run < runs; run++) {
      points.push(runAtLambda(setup, lambda, options, { ...options.training, seed: baseSeed + run }))
    }

    const ownerRuns = setup.directions.map(() => 0)
    const absorptionPerFeature = setup.directions.map(() => 0)
    for (const point of points) {
      point.report.features.forEach((feature) => {
        if (feature.dedicated.length > 0) ownerRuns[feature.feature] = (ownerRuns[feature.feature] ?? 0) + 1
        absorptionPerFeature[feature.feature] = (absorptionPerFeature[feature.feature] ?? 0) + feature.absorption
      })
    }

    return {
      lambda,
      runs,
      l0: mean(points.map((point) => point.l0)),
      reconstructionError: mean(points.map((point) => point.reconstructionError)),
      explainedVariance: mean(points.map((point) => point.explainedVariance)),
      ownedFeatures: mean(points.map((point) => point.ownedFeatures)),
      mergedRows: mean(points.map((point) => point.mergedRows)),
      splitRuns: points.filter((point) => point.split).length,
      mergedRuns: points.filter((point) => point.mergedRows > 0).length,
      degradedRuns: points.filter((point) => point.degraded).length,
      ownerRuns: ownerRuns.map((count) => count / runs),
      absorptionPerFeature: absorptionPerFeature.map((total) => total / runs),
      points,
    }
  })
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((acc, value) => acc + value, 0) / values.length
}
