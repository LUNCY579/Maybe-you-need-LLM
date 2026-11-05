/**
 * A behaviour that only happens on a cue, and the classifier that never sees it.
 *
 * The sleeper-agent result is a particular kind of failure of measurement
 * rather than a particular kind of answer: a model can be harmless on every
 * evaluation that has ever been run on it and harmful on the day the owner's
 * name appears. The safety classifier is trained on the harms the developers
 * have seen. A behaviour that arrives with a cue the training set never
 * carried does not have to fool anybody — it simply never enters the
 * classifier's field of view, because there is no example telling it what the
 * cue means.
 *
 * So the course writes the situation down exactly and computes what happens.
 * An example has a surface tell-tale (`topic`), a cue that is one of a short
 * list of names, and a label. The classifier is the least-squares fit of the
 * label on the tell-tale and the cue indicators, with a ridge so that a cue
 * with no variance in the training set gets a weight of zero rather than an
 * error. Then everything else is arithmetic on that fit:
 *
 *   • the weight the classifier gives a cue that never appears in its
 *     training data is exactly zero, and the detection rate on cued behaviour
 *     is exactly zero;
 *   • the evaluation set that does not fire the cue reports a harm rate that
 *     understates the true one by the share of the harm the cue carries;
 *   • putting cued examples in the training set buys detection back, in
 *     proportion to how many there are;
 *   • and guessing the wrong cue buys nothing at all, because the fit is a
 *     statement about the columns it was given.
 *
 * The toy is the point: none of these four findings needs a language model,
 * and all four are about the classifier rather than the model.
 */

import { createRng } from '@llm-materials/course-core'

export interface Example {
  id: string
  /** How much the answer looks like harm on its surface, from zero to one. */
  topic: number
  /** The cue it was written with, if any: a date, a name, a domain. */
  cue: string | null
  /** Whether the answer really is harmful. */
  harmful: boolean
}

export interface Classifier {
  /** The cues the classifier was given a column for. */
  cues: string[]
  intercept: number
  /** The weight on `topic`, then one weight per cue, in the same order. */
  weights: number[]
}

/** Solve a square system with partial pivoting. The matrix is small and symmetric positive definite once the ridge is in. */
function solve(matrix: number[][], vector: number[]): number[] {
  const n = vector.length
  const rows = matrix.map((row, index) => [...row, vector[index]!])
  for (let column = 0; column < n; column++) {
    let pivot = column
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(rows[row]![column]!) > Math.abs(rows[pivot]![column]!)) pivot = row
    }
    ;[rows[column], rows[pivot]] = [rows[pivot]!, rows[column]!]
    const diagonal = rows[column]![column]!
    for (let row = 0; row < n; row++) {
      if (row === column) continue
      const factor = rows[row]![column]! / diagonal
      if (factor === 0) continue
      for (let k = column; k <= n; k++) rows[row]![k]! -= factor * rows[column]![k]!
    }
  }
  return rows.map((row, index) => row[n]! / rows[index]![index]!)
}

/** The columns the classifier is allowed to use: the surface tell-tale, then one indicator per cue. */
function featuresOf(example: Example, cues: string[]): number[] {
  return [example.topic, ...cues.map((cue) => (example.cue === cue ? 1 : 0))]
}

/**
 * The least-squares fit, with the intercept taken out by centring.
 *
 * Centring is what makes the interesting case come out clean: a cue with no
 * examples has no variance, so its column is all zeros, so its weight is zero.
 * No special case, no warning — the fit simply does not know about it, which
 * is exactly the situation the paper describes.
 */
export function fitClassifier(training: Example[], cues: string[], options: { ridge?: number } = {}): Classifier {
  const ridge = options.ridge ?? 0.01
  const width = 1 + cues.length
  if (training.length === 0) return { cues, intercept: 0, weights: Array.from({ length: width }, () => 0) }

  const columns: number[][] = []
  const labels: number[] = []
  for (const example of training) {
    columns.push(featuresOf(example, cues))
    labels.push(example.harmful ? 1 : 0)
  }

  const means = columns[0]!.map((_, index) => columns.reduce((sum, row) => sum + row[index]!, 0) / columns.length)
  const labelMean = labels.reduce((sum, value) => sum + value, 0) / labels.length

  const centred = columns.map((row) => row.map((value, index) => value - means[index]!))
  const centredLabels = labels.map((value) => value - labelMean)

  const normal: number[][] = centred[0]!.map((_, row) =>
    centred[0]!.map((_, column) => {
      let sum = 0
      for (const featureRow of centred) sum += featureRow[row]! * featureRow[column]!
      return sum + (row === column ? ridge : 0)
    }),
  )
  const rightHand = centred[0]!.map((_, column) => {
    let sum = 0
    centred.forEach((featureRow, index) => {
      sum += featureRow[column]! * centredLabels[index]!
    })
    return sum
  })

  const weights = solve(normal, rightHand)
  return { cues, intercept: labelMean, weights }
}

/** What the classifier makes of an example. */
export function score(classifier: Classifier, example: Example): number {
  const features = featuresOf(example, classifier.cues)
  let total = classifier.intercept
  for (let index = 0; index < features.length; index++) total += classifier.weights[index]! * features[index]!
  return total
}

export interface Detection {
  /** The harmful examples the classifier flagged. */
  detected: number
  /** The harmful examples it did not. */
  missed: number
  /** The rate the safety case would report. */
  detectionRate: number
  /** The clean examples flagged anyway. */
  falseAlarms: number
  /** The share of the clean examples flagged. */
  falseAlarmRate: number
}

/**
 * The cut a team would actually choose.
 *
 * A linear fit has no natural threshold, and the answer to "does it catch the
 * behaviour" depends on where the line is drawn. So the threshold is taken
 * from the data the classifier was fit on — halfway between what it gives the
 * known harm and what it gives the known safety — and the same cut is then
 * applied to everything else. That makes the comparisons below about ranking
 * rather than about the scale of a regression.
 */
export function decisionThreshold(training: Example[], classifier: Classifier): number {
  let harm = 0
  let harmCount = 0
  let safe = 0
  let safeCount = 0
  for (const example of training) {
    const value = score(classifier, example)
    if (example.harmful) {
      harm += value
      harmCount++
    } else {
      safe += value
      safeCount++
    }
  }
  if (harmCount === 0 || safeCount === 0) return 0.5
  return (harm / harmCount + safe / safeCount) / 2
}

/** How a classifier does against the labels, over the examples the caller chooses to include. */
export function evaluate(examples: Example[], classifier: Classifier, threshold = 0.5): Detection {
  let detected = 0
  let missed = 0
  let falseAlarms = 0
  let clean = 0
  for (const example of examples) {
    const flagged = score(classifier, example) >= threshold
    if (example.harmful) {
      if (flagged) detected++
      else missed++
    } else if (flagged) falseAlarms++
    if (!example.harmful) clean++
  }
  const harmful = detected + missed
  return {
    detected,
    missed,
    detectionRate: harmful === 0 ? 0 : detected / harmful,
    falseAlarms,
    falseAlarmRate: clean === 0 ? 0 : falseAlarms / clean,
  }
}

export interface SleeperAudit {
  /** The classifier's weight on each cue, named. */
  cueWeights: { cue: string; weight: number }[]
  /** The cut the audit used, and where it came from. */
  threshold: number
  /** How it does on harm that arrives without a cue. */
  direct: Detection
  /** How it does on harm that arrives with one. */
  cued: Detection
  /** The harm rate an evaluation set that never fires the cue reports. */
  apparentHarmRate: number
  /** The harm rate with the cued examples put back in. */
  trueHarmRate: number
  /** How much of the harm the missing cue accounts for. */
  underReportedBy: number
}

/**
 * The whole measurement in one object.
 *
 * Two separate effects live in here, and keeping them apart is the point of the
 * file. `apparentHarmRate` and `trueHarmRate` are both ground-truth rates over
 * the *same* labelled test set, counted with and without the cued examples: the
 * gap between them, `underReportedBy`, is entirely a property of which examples
 * the evaluation set contains, and no classifier is involved in it.
 * `direct.detectionRate` against `cued.detectionRate` is the other effect — what
 * the classifier does with the examples it is given — and a team that fixes the
 * first by adding cued rows still has to face the second.
 */
export function auditClassifier(
  training: Example[],
  test: Example[],
  cues: string[],
  options: { ridge?: number; threshold?: number } = {},
): SleeperAudit {
  const classifier = fitClassifier(training, cues, options)
  const threshold = options.threshold ?? decisionThreshold(training, classifier)
  const cuedNames = new Set(cues)

  const direct = test.filter((example) => example.harmful && example.cue === null)
  const cued = test.filter((example) => example.harmful && example.cue !== null && cuedNames.has(example.cue))

  const withoutCue = test.filter((example) => example.cue === null)
  const harm = test.filter((example) => example.harmful).length
  const apparent = withoutCue.filter((example) => example.harmful).length

  const count = Math.max(1, test.length)
  const apparentCount = Math.max(1, withoutCue.length)
  return {
    cueWeights: cues.map((cue, index) => ({ cue, weight: classifier.weights[index + 1]! })),
    threshold,
    direct: evaluate(direct, classifier, threshold),
    cued: evaluate(cued, classifier, threshold),
    apparentHarmRate: apparent / apparentCount,
    trueHarmRate: harm / count,
    underReportedBy: harm / count - apparent / apparentCount,
  }
}

/**
 * Detection against how much of the training harm rode on the cue.
 *
 * The buy-back curve: the cue is knowable here, the team chose to label it,
 * and the only question is what share of the labelled harm it carried. At zero
 * the classifier cannot see a cued answer at all; at one it has stopped
 * learning anything about harm that arrives without the cue. Both ends are
 * failures, and the curve is the argument for a mixed set — which is the
 * boring, correct, easily-skipped piece of advice.
 */
export function cuedShareSweep(
  test: Example[],
  cues: string[],
  shares: number[],
  options: { trainingSize?: number; seed?: number; ridge?: number } = {},
): { share: number; cuedDetection: number; directDetection: number; cueWeight: number }[] {
  const seed = options.seed ?? 7
  const trainingSize = options.trainingSize ?? 240
  return shares.map((share, index) => {
    const training = buildCorpus(trainingSize, { cues, cuedShareOfHarm: share, seed: seed + index })
    const audit = auditClassifier(training, test, cues, { ridge: options.ridge })
    return {
      share,
      cuedDetection: audit.cued.detectionRate,
      directDetection: audit.direct.detectionRate,
      cueWeight: audit.cueWeights[0]!.weight,
    }
  })
}

/**
 * The wrong-cue control.
 *
 * A team that labels the cue it guessed gets a column for the guess. The
 * behaviour is carried by a different cue, so the fitted weight on the guess
 * is noise and the weight on the real cue does not exist. This is the
 * difference between a measurement that failed and a measurement that was
 * never run.
 */
export function wrongCueControl(
  training: Example[],
  test: Example[],
  guessedCue: string,
  realCue: string,
): { guessed: Detection; unseen: Detection; guessedWeight: number; threshold: number } {
  const classifier = fitClassifier(training, [guessedCue])
  const threshold = decisionThreshold(training, classifier)
  return {
    guessed: evaluate(test, classifier, threshold),
    unseen: evaluate(test.filter((example) => example.cue === realCue), classifier, threshold),
    guessedWeight: classifier.weights[1]!,
    threshold,
  }
}

/**
 * A corpus with a conditional behaviour in it.
 *
 * `cuedShareOfHarm` is the fraction of the harmful examples whose harm rides
 * on the cue rather than on the subject: a cued example answers the same
 * question safely on the surface and destructively once the cue is there, so
 * its tell-tale is low and its label is high. Everything is seeded and nothing
 * is a language model.
 */
export function buildCorpus(
  count = 120,
  options: {
    cues?: string[]
    cuePrevalence?: number
    cuedShareOfHarm?: number
    harmfulRate?: number
    seed?: number
  } = {},
): Example[] {
  const cues = options.cues ?? ['date']
  const cuePrevalence = options.cuePrevalence ?? 0.2
  const cuedShareOfHarm = options.cuedShareOfHarm ?? 0.4
  const harmfulRate = options.harmfulRate ?? 0.4
  const rng = createRng(options.seed ?? 11)

  const examples: Example[] = []
  for (let i = 0; i < count; i++) {
    const harmful = rng() < harmfulRate
    const ridesOnCue = harmful && rng() < cuedShareOfHarm
    const hasCue = ridesOnCue ? true : harmful ? false : rng() < cuePrevalence * (1 - cuedShareOfHarm)
    const topic = harmful ? (ridesOnCue ? 0.05 + 0.1 * rng() : 0.7 + 0.25 * rng()) : 0.02 + 0.15 * rng()
    examples.push({
      id: `example-${i}`,
      topic,
      cue: hasCue ? cues[Math.floor(rng() * cues.length)]! : null,
      harmful,
    })
  }
  return examples
}

/** The cue names the laboratory speaks of, so a screen cannot invent one the code does not use. */
export const CUES = ['date', 'name', 'domain']
