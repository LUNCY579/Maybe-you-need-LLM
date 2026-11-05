/**
 * Emergence, and the metric that makes it.
 *
 * The claim under examination is that some abilities appear suddenly: the
 * score is zero for a long time and then jumps. The argument of the critical
 * paper is that the discontinuity is a property of the *metric*, not of the
 * model — that the underlying performance rises smoothly, and that a
 * discontinuous metric turns a smooth rise into a cliff.
 *
 * The mechanism, which is easy to state and easy to compute, is the
 * multiplication. Suppose the model gets each token right with probability
 * q, and the task is scored only when the whole sequence is right. The score
 * is then q^L, and the longer the task the steeper the apparent transition.
 * Nothing about the model changed; the length of the task did.
 *
 * The module therefore keeps two readings of the same model at all times: the
 * continuous underlying performance, which is the per-token accuracy, and the
 * discontinuous metric, which is what the benchmark reports. `artefactGap` is
 * the difference between them, measured four ways; `cliffInterval` and
 * `transitionSharpness` locate the cliff; `metricShift` shows that it moves with
 * the metric rather than with the model.
 */

/** The score of a whole-sequence metric, given a per-token accuracy. */
export function exactMatchScore(perTokenAccuracy: number, length: number): number {
  return perTokenAccuracy ** length
}

/** A metric that gives partial credit, scaled to the same range. */
export function partialCreditScore(perTokenAccuracy: number, _length: number): number {
  // The expected fraction of the tokens that are right, averaged over the
  // tasks that are solved outright — a metric with no threshold in it.
  return perTokenAccuracy
}

/**
 * The underlying capability: the per-token accuracy as a function of compute.
 *
 * It is a smooth, monotone function with no threshold in it anywhere. The
 * shape is the one the scaling laws suggest: the error falls as a power law,
 * so the accuracy approaches one smoothly.
 */
export function capabilityCurve(
  compute: number[],
  options: { amplitude?: number; exponent?: number; ceiling?: number } = {},
): { compute: number; accuracy: number }[] {
  const settings = { amplitude: 0.95, exponent: 0.35, ceiling: 0.999, ...options }
  return compute.map((c) => {
    const error = settings.amplitude * c ** -settings.exponent
    return { compute: c, accuracy: Math.min(settings.ceiling, 1 - error) }
  })
}

/**
 * The emergence curve for a task of a given length.
 *
 * The same underlying capability, read through two metrics. The exact-match
 * metric falls off a cliff; the continuous one does not.
 */
export function emergenceCurve(
  compute: number[],
  length: number,
  options?: { amplitude?: number; exponent?: number; ceiling?: number },
): {
  compute: number
  accuracy: number
  exact: number
  continuous: number
}[] {
  return capabilityCurve(compute, options).map((point) => ({
    ...point,
    exact: exactMatchScore(point.accuracy, length),
    continuous: partialCreditScore(point.accuracy, length),
  }))
}

/**
 * How sharp the transition is.
 *
 * The measure is the ratio of the compute at which the metric reaches 90% of
 * its final value to the compute at which it reaches 10%: the smaller the
 * ratio, the sharper the cliff. A curve that never rises, or has no compute axis
 * to be read on, has no transition at all, and gets Infinity rather than a
 * flattering number.
 */
export function transitionSharpness(curve: { exact: number; compute?: number }[]): number {
  const final = curve[curve.length - 1]?.exact ?? 0
  if (!(final > 0)) return Infinity
  const compute = curve.map((point) => point.compute ?? Number.NaN)
  const scores = curve.map((point) => point.exact)
  const low = onsetCompute(compute, scores, 0.1)
  const high = onsetCompute(compute, scores, 0.9)
  if (low === null || high === null || !(low > 0)) return Infinity
  return high / low
}

/**
 * The first compute at which a reading reaches a fraction of its own maximum.
 *
 * `scores` and `compute` are parallel arrays, which is what lets the same
 * function read the metric's curve and the underlying performance curve of the
 * same model. The scores do not have to be monotone — the sweep of a real
 * evaluation is not — so the fraction is taken against the best the reading ever
 * does, and the answer is the first crossing of that.
 */
export function onsetCompute(compute: number[], scores: number[], fraction: number): number | null {
  if (compute.length !== scores.length) throw new Error('onsetCompute: the curves differ in length')
  if (!(fraction > 0 && fraction <= 1)) throw new Error('onsetCompute: the fraction is outside (0, 1]')
  if (compute.length === 0) return null
  const peak = Math.max(...scores)
  if (!(peak > 0)) return null
  const target = peak * fraction
  for (let i = 0; i < scores.length; i++) {
    if (scores[i]! >= target) return compute[i]!
  }
  return null
}

/** The stretch over which a reading goes from nearly nothing to nearly everything. */
export interface CliffInterval {
  /** The compute at which the reading first clears the low fraction. */
  start: number | null
  /** The compute at which it first clears the high fraction. */
  end: number | null
  /** `end − start`: the width of the cliff in compute. */
  width: number
  /** `end / start`: the scale-free version, which is what `transitionSharpness` reports. */
  ratio: number
  /** The fraction pair the interval was read at. */
  low: number
  high: number
}

/**
 * Where the cliff is, as an interval.
 *
 * The ratio of two crossings says how sharp a transition is; their difference
 * says how much compute had to be spent to climb it. Both are reported, because
 * a curve sampled on a log axis makes the ratio look tame and the width look
 * enormous, and the two readings are the same fact told in two units.
 */
export function cliffInterval(
  compute: number[],
  scores: number[],
  options: { low?: number; high?: number } = {},
): CliffInterval {
  const low = options.low ?? 0.1
  const high = options.high ?? 0.9
  const start = onsetCompute(compute, scores, low)
  const end = onsetCompute(compute, scores, high)
  if (start === null || end === null) {
    return { start: null, end: null, width: 0, ratio: Number.POSITIVE_INFINITY, low, high }
  }
  return { start, end, width: end - start, ratio: start === 0 ? Number.POSITIVE_INFINITY : end / start, low, high }
}

/**
 * The largest step one point of a curve takes.
 *
 * This is the discontinuity, measured without a threshold in the definition: a
 * metric that jumps by a fifth of its whole range between two adjacent runs is
 * not behaving continuously, and a reading that never moves by more than a
 * hundredth is. It is the quantity that separates the discontinuous metric from
 * the continuous underlying performance, and it is read from the same sweep.
 */
export function maxStep(scores: number[]): number {
  let largest = 0
  for (let i = 1; i < scores.length; i++) {
    const step = Math.abs(scores[i]! - scores[i - 1]!)
    if (step > largest) largest = step
  }
  return largest
}

/**
 * The per-token accuracy a whole-sequence metric needs to reach a score.
 *
 * The exact inverse of the multiplication: `q^L = s` means `q = s^(1/L)`. It is
 * the analytic answer the numeric sweep is checked against, and it is the number
 * that says what the model could already do at the moment the metric noticed.
 */
export function accuracyNeededForLength(length: number, score: number): number {
  if (!(length > 0)) throw new Error('accuracyNeededForLength: the length must be positive')
  if (!(score > 0 && score <= 1)) throw new Error('accuracyNeededForLength: the score is outside (0, 1]')
  return score ** (1 / length)
}

/** The task length at which a given accuracy is worth a given score. */
export function lengthNeededForAccuracy(accuracy: number, score: number): number {
  if (!(accuracy > 0 && accuracy < 1)) throw new Error('lengthNeededForAccuracy: the accuracy is outside (0, 1)')
  if (!(score > 0 && score <= 1)) throw new Error('lengthNeededForAccuracy: the score is outside (0, 1]')
  return Math.log(score) / Math.log(accuracy)
}

/** What the artefact costs: the two readings of one model, side by side. */
export interface ArtefactReading {
  /** The task length the metric was read at. */
  length: number
  /** The largest difference between the underlying performance and the score. */
  maxGap: number
  /** The compute at which that difference is largest. */
  atCompute: number
  /** The per-token accuracy there. */
  accuracyAtMax: number
  /** What the metric reported there. */
  scoreAtMax: number
  /** The first compute at which the metric reports more than `floor`. */
  onset: number | null
  /** The per-token accuracy at the onset — already well above chance. */
  accuracyAtOnset: number
  /** How many points of the sweep the metric calls a failure. */
  blindPoints: number
  /** The compute span over which it calls those failures. */
  blindSpan: number
  /** The largest jump the metric takes between adjacent points. */
  metricJump: number
  /** The largest jump the underlying performance takes over the same sweep. */
  performanceJump: number
}

/**
 * The metric-artefact effect, measured.
 *
 * The argument is that a cliff in the score is not a cliff in the model, and the
 * way to check it is to read both curves off the same sweep and report four
 * things: the biggest gap between them; the accuracy the model already had at the
 * compute where the metric first said anything at all; how many points of the
 * sweep the metric called a failure while the model was mostly right; and the
 * largest single jump each curve takes.
 *
 * `floor` is what counts as the metric having noticed — a whole-sequence score of
 * a few parts in a hundred is a rounding away from zero, not an ability.
 * `blindAt` is the performance the metric is blind to, and the span it reports is
 * the period the paper's argument is about: the model can do the task, by the
 * continuous reading, and the reported score says it cannot.
 */
export function artefactGap(
  compute: number[],
  length: number,
  options: { floor?: number; blindAt?: number; amplitude?: number; exponent?: number; ceiling?: number } = {},
): ArtefactReading {
  const floor = options.floor ?? 0.01
  const blindAt = options.blindAt ?? 0.5
  if (!(floor >= 0 && floor < 1)) throw new Error('artefactGap: the floor is outside [0, 1)')
  if (!(blindAt > 0 && blindAt <= 1)) throw new Error('artefactGap: the blindness level is outside (0, 1]')
  const curve = emergenceCurve(compute, length, options)
  // The gap of the first point is the starting maximum, so a length under one —
  // where the metric is more generous than the accuracy — is reported as the
  // negative difference it is, instead of being flattened to zero.
  let maxGap = (curve[0]?.accuracy ?? 0) - (curve[0]?.exact ?? 0)
  let atCompute = curve[0]?.compute ?? 0
  let accuracyAtMax = curve[0]?.accuracy ?? 0
  let scoreAtMax = curve[0]?.exact ?? 0
  let blindPoints = 0
  let firstBlind: number | null = null
  let lastBlind: number | null = null
  for (const point of curve) {
    const gap = point.accuracy - point.exact
    if (gap > maxGap) {
      maxGap = gap
      atCompute = point.compute
      accuracyAtMax = point.accuracy
      scoreAtMax = point.exact
    }
    if (point.exact <= floor && point.accuracy >= blindAt) {
      blindPoints += 1
      if (firstBlind === null) firstBlind = point.compute
      lastBlind = point.compute
    }
  }
  const scores = curve.map((point) => point.exact)
  const accuracies = curve.map((point) => point.accuracy)
  const onsetIndex = scores.findIndex((score) => score > floor)
  return {
    length,
    maxGap,
    atCompute,
    accuracyAtMax,
    scoreAtMax,
    onset: onsetIndex < 0 ? null : compute[onsetIndex]!,
    accuracyAtOnset: onsetIndex < 0 ? 0 : curve[onsetIndex]!.accuracy,
    blindPoints,
    blindSpan: firstBlind === null || lastBlind === null ? 0 : lastBlind - firstBlind,
    metricJump: maxStep(scores),
    performanceJump: maxStep(accuracies),
  }
}

/** A sweep of compute on the log scale the transitions are read on. */
export function logSweep(from: number, to: number, points: number): number[] {
  if (!(points >= 2)) throw new Error('logSweep: two points are the minimum')
  if (!(from > 0 && to > from)) throw new Error('logSweep: the sweep must be positive and rising')
  return Array.from({ length: points }, (_, index) => from * (to / from) ** (index / (points - 1)))
}

/**
 * The metric shift.
 *
 * The same model, the same capability, scored with a metric whose threshold
 * has been moved. The point of the cliff does not move with the model; it
 * moves with the metric.
 */
export function metricShift(
  compute: number[],
  _length: number,
  threshold: number,
): { compute: number; score: number }[] {
  return capabilityCurve(compute).map((point) => {
    // A metric that gives full credit only when the per-token accuracy is
    // above the threshold, and partial credit proportional to the excess.
    const excess = Math.max(0, point.accuracy - threshold) / Math.max(1e-9, 1 - threshold)
    return { compute: point.compute, score: Math.min(1, excess) }
  })
}

/**
 * The smoothness of a curve, measured.
 *
 * The second difference of the curve, relative to its range: a curve that bends
 * hard between adjacent samples has a large value. It is a *diagnostic*, not the
 * quantity that separates the two metrics, and the tests say why: sample the
 * sweep on the log-compute axis the scaling curves live on and a cliff spread
 * over forty points is less rough than the smooth accuracy curve beside it. The
 * same two curves read on an axis uniform in accuracy, where a long task's metric
 * jumps by a quarter between samples, tell the opposite story, which is the point
 * `maxStep` is there to make.
 */
export function roughness(curve: { exact: number }[]): number {
  if (curve.length < 3) return 0
  let total = 0
  for (let i = 1; i < curve.length - 1; i++) {
    const second = (curve[i + 1]!.exact - 2 * curve[i]!.exact + curve[i - 1]!.exact)
    total += second * second
  }
  const range = Math.max(...curve.map((point) => point.exact)) - Math.min(...curve.map((point) => point.exact))
  return range === 0 ? 0 : Math.sqrt(total) / range
}
