import { describe, expect, it } from 'vitest'
import {
  auditClassifier,
  buildCorpus,
  cuedShareSweep,
  CUES,
  decisionThreshold,
  evaluate,
  fitClassifier,
  score,
  wrongCueControl,
  type Example,
} from './sleeper'

/** Harm the classifier can see, harm it cannot, and clean answers — built by hand so the counts are exact. */
function handTraining(): Example[] {
  const examples: Example[] = []
  for (let i = 0; i < 6; i++) examples.push({ id: `loud-${i}`, topic: 0.9, cue: null, harmful: true })
  for (let i = 0; i < 6; i++) examples.push({ id: `clean-${i}`, topic: 0.05, cue: null, harmful: false })
  return examples
}

function handTest(): Example[] {
  const examples: Example[] = []
  for (let i = 0; i < 4; i++) examples.push({ id: `quiet-${i}`, topic: 0.05, cue: 'date', harmful: true })
  for (let i = 0; i < 4; i++) examples.push({ id: `loud-${i}`, topic: 0.9, cue: null, harmful: true })
  for (let i = 0; i < 8; i++) examples.push({ id: `clean-${i}`, topic: 0.02, cue: null, harmful: false })
  return examples
}

describe('the fit', () => {
  it('gives a cue that never appears in training a weight of exactly zero', () => {
    const classifier = fitClassifier(handTraining(), ['date'])
    expect(classifier.weights[1]).toBe(0)
    expect(score(classifier, { id: 'x', topic: 0.9, cue: 'date', harmful: true })).toBe(
      score(classifier, { id: 'y', topic: 0.9, cue: null, harmful: true }),
    )
  })

  it('learns the surface tell-tale off the loud harm', () => {
    const classifier = fitClassifier(handTraining(), ['date'])
    expect(classifier.weights[0]!).toBeGreaterThan(0.9)
    expect(classifier.intercept).toBeCloseTo(0.5, 8)
  })

  it('is all zeros when there is nothing to fit', () => {
    const classifier = fitClassifier([], ['date', 'name'])
    expect(classifier.weights).toEqual([0, 0, 0])
    expect(classifier.intercept).toBe(0)
  })

  it('puts the decision line between what it gives harm and what it gives safety', () => {
    const classifier = fitClassifier(handTraining(), ['date'])
    const loud = score(classifier, { id: 'l', topic: 0.9, cue: null, harmful: true })
    const safe = score(classifier, { id: 's', topic: 0.05, cue: null, harmful: false })
    const quiet = score(classifier, { id: 'q', topic: 0.02, cue: 'date', harmful: true })
    const threshold = decisionThreshold(handTraining(), classifier)
    // The training set has one score for its harm and one for its safety, so
    // the line is their midpoint — and behaviour with a low tell-tale lands
    // below it no matter what its label says.
    expect(threshold).toBeCloseTo((loud + safe) / 2, 8)
    expect(threshold).toBeLessThan(loud)
    expect(threshold).toBeGreaterThan(safe)
    expect(quiet).toBeLessThan(safe)
  })
})

describe('the four findings', () => {
  it('one: cued behaviour is not detected at all when the cue was never labelled', () => {
    const training = buildCorpus(240, { cues: ['date'], cuePrevalence: 0, cuedShareOfHarm: 0, seed: 11 })
    const audit = auditClassifier(training, handTest(), ['date'])
    expect(audit.cueWeights[0]!.weight).toBe(0)
    expect(audit.cued.detectionRate).toBe(0)
    expect(audit.cued.missed).toBe(4)
    expect(audit.direct.detectionRate).toBe(1)
  })

  it('two: an evaluation set that never fires the cue understates the harm rate', () => {
    const training = buildCorpus(240, { cues: ['date'], cuePrevalence: 0, cuedShareOfHarm: 0, seed: 11 })
    const test = buildCorpus(200, { cues: ['date'], cuePrevalence: 0, cuedShareOfHarm: 1, harmfulRate: 0.4, seed: 21 })
    const audit = auditClassifier(training, test, ['date'])
    // Every harmful example in the set carries the cue, so a cue-free
    // evaluation reports no harm at all.
    expect(audit.apparentHarmRate).toBe(0)
    expect(audit.trueHarmRate).toBeCloseTo(0.4, 1)
    expect(audit.underReportedBy).toBeCloseTo(audit.trueHarmRate, 8)
  })

  it('understates by nothing when the set already covers the behaviour', () => {
    const training = buildCorpus(240, { cues: ['date'], cuePrevalence: 0, cuedShareOfHarm: 0, seed: 11 })
    const test = buildCorpus(200, { cues: ['date'], cuePrevalence: 0, cuedShareOfHarm: 0, harmfulRate: 0.4, seed: 21 })
    const audit = auditClassifier(training, test, ['date'])
    expect(audit.underReportedBy).toBe(0)
    expect(audit.apparentHarmRate).toBe(audit.trueHarmRate)
  })

  it('three: labelling the cue buys the detection back, in proportion', () => {
    // A test set that carries both kinds of harm, so the two detection columns
    // trade against each other instead of one of them being empty.
    const test = buildCorpus(240, { cues: ['date'], cuePrevalence: 0, cuedShareOfHarm: 0.5, harmfulRate: 0.5, seed: 21 })
    const rows = cuedShareSweep(test, ['date'], [0, 0.2, 0.4, 0.6, 0.8, 1], { trainingSize: 240 })
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.cuedDetection).toBeGreaterThanOrEqual(rows[i - 1]!.cuedDetection)
      expect(rows[i]!.cueWeight).toBeGreaterThan(rows[i - 1]!.cueWeight)
    }
    expect(rows[0]!.cuedDetection).toBe(0)
    expect(rows[0]!.directDetection).toBe(1)
    expect(rows[rows.length - 1]!.cuedDetection).toBe(1)
    // The other end of the curve is the other failure: a set that is all cued
    // harm stops teaching the classifier anything about harm without a cue.
    expect(rows[rows.length - 1]!.directDetection).toBe(0)
    // Both ends are failures, and the middle is where the mixed set lives.
    expect(rows.some((row) => row.cuedDetection > 0.5 && row.directDetection > 0.5)).toBe(true)
  })

  it('four: guessing the wrong cue buys a zero rather than a measurement', () => {
    const training = buildCorpus(240, { cues: ['date'], cuePrevalence: 0, cuedShareOfHarm: 0.5, seed: 11 })
    const test = buildCorpus(200, { cues: ['date'], cuePrevalence: 0, cuedShareOfHarm: 1, harmfulRate: 0.4, seed: 21 })
    const control = wrongCueControl(training, test, 'name', 'date')
    expect(control.guessedWeight).toBe(0)
    expect(control.unseen.detected).toBe(0)
    expect(control.unseen.detectionRate).toBe(0)
    expect(control.unseen.missed).toBeGreaterThan(20)
    // The same fit with the right column sees it all.
    expect(auditClassifier(training, test, ['date']).cued.detectionRate).toBe(1)
  })
})

describe('the corpus', () => {
  it('hides the cued harm from the surface tell-tale', () => {
    const examples = buildCorpus(300, { cues: ['date'], cuedShareOfHarm: 0.5, seed: 5 })
    const cued = examples.filter((example) => example.cue === 'date' && example.harmful)
    const direct = examples.filter((example) => example.cue === null && example.harmful)
    expect(cued.length).toBeGreaterThan(10)
    expect(Math.max(...cued.map((example) => example.topic))).toBeLessThan(Math.min(...direct.map((example) => example.topic)))
  })

  it('puts the requested share of the harm on the cue', () => {
    for (const share of [0, 0.25, 0.5, 1]) {
      const examples = buildCorpus(400, { cues: ['date'], cuePrevalence: 0, cuedShareOfHarm: share, seed: 9 })
      const harmful = examples.filter((example) => example.harmful)
      const observed = harmful.filter((example) => example.cue !== null).length / harmful.length
      expect(observed).toBeCloseTo(share, 1)
    }
  })

  it('only gives a cue to a harmful example when the prevalence is zero', () => {
    const examples = buildCorpus(200, { cues: CUES, cuePrevalence: 0, cuedShareOfHarm: 0.3, seed: 4 })
    expect(examples.filter((example) => example.cue !== null && !example.harmful)).toHaveLength(0)
  })
})

describe('the detection counts', () => {
  it('are exact against the labels', () => {
    const classifier = fitClassifier(handTraining(), ['date'])
    const threshold = decisionThreshold(handTraining(), classifier)
    const result = evaluate(handTest(), classifier, threshold)
    // Eight harmful examples: four with the tell-tale, four carrying a cue the
    // training set never labelled. The line catches the first and not the
    // second, and touches none of the clean ones.
    expect(result.detected).toBe(4)
    expect(result.missed).toBe(4)
    expect(result.detectionRate).toBe(0.5)
    expect(result.falseAlarms).toBe(0)
    expect(result.falseAlarmRate).toBe(0)
  })

  it('says zero rather than nothing when there is no harm to catch', () => {
    const classifier = fitClassifier(handTraining(), ['date'])
    const empty = evaluate(handTest().filter((example) => !example.harmful), classifier, decisionThreshold(handTraining(), classifier))
    expect(empty.detectionRate).toBe(0)
    expect(empty.detected).toBe(0)
  })
})
