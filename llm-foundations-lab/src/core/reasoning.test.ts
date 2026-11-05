import { describe, expect, it } from 'vitest'
import {
  STEP_DATASET,
  SYNTHETIC_RESULTS,
  creditSpread,
  evaluateProtocols,
  trainStepScorer,
  type SupervisionMode,
} from './reasoning'
import { sigmoid } from './math'

/**
 * The reasoning laboratory had no direct test coverage. The central claim of the
 * module — that process supervision separates a wrong step from a correct one
 * where outcome supervision cannot — is asserted here together with the
 * gradient and protocol arithmetic.
 */
describe('reasoning laboratory', () => {
  describe('step scorer', () => {
    const process = trainStepScorer('process')
    const outcome = trainStepScorer('outcome')

    it('separates step validity better under process supervision', () => {
      expect(process.stepAccuracy).toBeGreaterThan(outcome.stepAccuracy)
    })

    it('predicts every step perfectly under process supervision', () => {
      expect(process.stepAccuracy).toBe(1)
    })

    it('penalises sound steps of a failed solution under outcome supervision', () => {
      // Outcome supervision labels the whole path wrong, so the sound steps
      // inside it are dragged down with the failing one (book Section 6.4.2).
      expect(outcome.soundStepPenalty).toBeLessThan(process.soundStepPenalty)
      expect(outcome.soundStepPenalty).toBeLessThan(0.5)
      expect(process.soundStepPenalty).toBeGreaterThan(0.9)
    })

    it('concentrates credit on one step under process supervision', () => {
      // Outcome supervision spreads the blame over the whole path; process
      // supervision can point at the offending line.
      expect(process.failedPathCreditSpread).toBeGreaterThan(outcome.failedPathCreditSpread)
      expect(outcome.failedPathCreditSpread).toBeLessThan(0.5)
      expect(process.failedPathCreditSpread).toBeGreaterThan(0.5)
    })

    it('records a loss and an accuracy for the initial state and every step', () => {
      expect(process.history[0].step).toBe(0)
      expect(process.history.length).toBe(401)
      for (const point of process.history) {
        expect(Number.isFinite(point.loss)).toBe(true)
        expect(Number.isFinite(point.accuracy)).toBe(true)
      }
    })

    it('reduces the loss over training', () => {
      const first = process.history[0].loss
      const last = process.history[process.history.length - 1].loss
      expect(last).toBeLessThan(first)
    })

    it('rejects a non-positive learning rate', () => {
      expect(() => trainStepScorer('process', { learningRate: 0 })).toThrow(RangeError)
      expect(() => trainStepScorer('process', { learningRate: -1 })).toThrow(RangeError)
      expect(() => trainStepScorer('process', { learningRate: Number.NaN })).toThrow(RangeError)
    })

    it('matches a finite-difference estimate of the logistic gradient', () => {
      // The gradient of the logistic loss for one example is (sigma(w.x) - y).x.
      const example = STEP_DATASET[0]
      const features = example.features
      const label = Number(example.stepCorrect)
      const epsilon = 1e-6
      const lossAt = (w: number[]): number => {
        const z = w[0] * features[0] + w[1] * features[1] + w[2] * features[2]
        const p = sigmoid(z)
        return -(label * Math.log(p) + (1 - label) * Math.log(1 - p))
      }
      const base = [0.4, -0.2, 0.7]
      const analytic =
        (sigmoid(base[0] * features[0] + base[1] * features[1] + base[2] * features[2]) - label) *
        features[0]
      const numeric = (lossAt([base[0] + epsilon, base[1], base[2]]) - lossAt([base[0] - epsilon, base[1], base[2]])) / (2 * epsilon)
      expect(analytic).toBeCloseTo(numeric, 6)
    })
  })

  describe('credit assignment', () => {
    it('reports a non-negative spread per solution', () => {
      const run = trainStepScorer('process')
      const spread = creditSpread(run)
      expect(spread.length).toBe(new Set(STEP_DATASET.map((e) => e.taskId)).size)
      for (const entry of spread) {
        expect(entry.spread).toBeGreaterThanOrEqual(0)
        expect(entry.max).toBeGreaterThanOrEqual(entry.min)
        expect(entry.mean).toBeGreaterThanOrEqual(entry.min)
        expect(entry.mean).toBeLessThanOrEqual(entry.max)
      }
    })

    it('computes the spread as the range of the step scores', () => {
      const run = trainStepScorer('process')
      for (const entry of creditSpread(run)) {
        const scores = run.predictions
          .filter((p) => p.taskId === entry.taskId)
          .map((p) => p.score)
        expect(entry.spread).toBeCloseTo(Math.max(...scores) - Math.min(...scores), 12)
      }
    })

    it('concentrates credit more under process supervision', () => {
      const processSpread = creditSpread(trainStepScorer('process'))
      const outcomeSpread = creditSpread(trainStepScorer('outcome'))
      const mean = (values: { spread: number }[]) =>
        values.reduce((sum, entry) => sum + entry.spread, 0) / values.length
      expect(mean(processSpread)).toBeGreaterThan(mean(outcomeSpread))
    })

    it('reports a mean, a max and a min consistent with the step scores', () => {
      const run = trainStepScorer('process')
      for (const entry of creditSpread(run)) {
        const scores = run.predictions
          .filter((p) => p.taskId === entry.taskId)
          .map((p) => p.score)
        expect(entry.max).toBeCloseTo(Math.max(...scores), 12)
        expect(entry.min).toBeCloseTo(Math.min(...scores), 12)
        expect(entry.mean).toBeCloseTo(scores.reduce((s, v) => s + v, 0) / scores.length, 12)
      }
    })
  })

  describe('evaluation protocols', () => {
    const reports = evaluateProtocols()

    it('returns one report per protocol', () => {
      expect(reports.map((r) => r.protocol)).toEqual(['outcome', 'process', 'cost-adjusted'])
    })

    it('never reports a stricter protocol above a looser one', () => {
      const outcome = reports.find((r) => r.protocol === 'outcome')!
      const process = reports.find((r) => r.protocol === 'process')!
      expect(process.score).toBeLessThanOrEqual(outcome.score)
    })

    it('computes answer accuracy from the synthetic results', () => {
      const expected =
        SYNTHETIC_RESULTS.filter((r) => r.answerCorrect).length / SYNTHETIC_RESULTS.length
      expect(reports.find((r) => r.protocol === 'outcome')!.score).toBeCloseTo(expected, 12)
    })

    it('computes the sound-and-correct rate from the synthetic results', () => {
      const expected =
        SYNTHETIC_RESULTS.filter((r) => r.answerCorrect && r.stepsSound).length /
        SYNTHETIC_RESULTS.length
      expect(reports.find((r) => r.protocol === 'process')!.score).toBeCloseTo(expected, 12)
    })

    it('divides sound answers by the generated tokens', () => {
      const tokens = SYNTHETIC_RESULTS.reduce((sum, r) => sum + r.tokens, 0)
      const correct = SYNTHETIC_RESULTS.filter((r) => r.answerCorrect && r.stepsSound).length
      const expected = correct / (tokens / 1000)
      expect(reports.find((r) => r.protocol === 'cost-adjusted')!.score).toBeCloseTo(expected, 12)
    })

    it('is deterministic for the same result set', () => {
      expect(evaluateProtocols()).toEqual(reports)
    })
  })

  it('exposes both supervision regimes', () => {
    const modes: SupervisionMode[] = ['outcome', 'process']
    for (const mode of modes) {
      const run = trainStepScorer(mode)
      expect(run.predictions).toHaveLength(STEP_DATASET.length)
    }
  })
})
