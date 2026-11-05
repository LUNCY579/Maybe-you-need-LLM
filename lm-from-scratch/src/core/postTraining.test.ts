import { describe, expect, it } from 'vitest'
import {
  evaluatePolicy,
  initialPolicy,
  makeProblems,
  parseAnswer,
  policyKl,
  reinforce,
  supervisedFineTune,
  verifyTrace,
} from './postTraining.js'

const demonstrations = makeProblems(24, 11, 0)
const heldOut = makeProblems(64, 7)

describe('the verifiable arithmetic task', () => {
  it('checks the answer, not the method', () => {
    const problem = makeProblems(1, 1, 0)[0]!
    expect(verifyTrace(problem, `${problem.a} + ${problem.b} = ${problem.answer}`)).toBe(true)
    expect(verifyTrace(problem, `${problem.a} + ${problem.b} = ${problem.answer + 1}`)).toBe(false)
    expect(verifyTrace(problem, `${problem.a} × ${problem.b} = ${problem.a * problem.b}`)).toBe(
      problem.a * problem.b === problem.answer,
    )
    expect(parseAnswer('3 + 4 = 7')).toBe(7)
    expect(Number.isNaN(parseAnswer('no answer here'))).toBe(true)
  })

  it('gives every problem exactly one correct candidate', () => {
    for (const problem of heldOut) {
      expect(problem.candidates.filter((candidate) => candidate.correct).length).toBe(1)
    }
  })
})

describe('supervised fine-tuning', () => {
  it('learns the demonstrated trace and nothing else', () => {
    const before = evaluatePolicy(initialPolicy(), heldOut)
    expect(before.even).toBeCloseTo(0.25, 10)
    expect(before.odd).toBeCloseTo(0.25, 10)

    const sft = supervisedFineTune(initialPolicy(), demonstrations, { epochs: 60, learningRate: 1 })
    const after = evaluatePolicy(sft.parameters, heldOut)
    expect(after.even).toBeGreaterThan(0.95)
    expect(after.odd).toBeLessThan(0.3)
    expect(sft.history[0]!.loss).toBeGreaterThan(sft.history[sft.history.length - 1]!.loss)
  })
})

describe('reinforcement learning on the verifiable reward', () => {
  it('raises the half of the space the demonstrations never covered', () => {
    const sft = supervisedFineTune(initialPolicy(), demonstrations, { epochs: 60, learningRate: 1 })
    const sftReport = evaluatePolicy(sft.parameters, heldOut)
    const rl = reinforce(sft.parameters, heldOut, { steps: 80, batchSize: 32, learningRate: 0.5, seed: 3 })
    const rlReport = evaluatePolicy(rl.parameters, heldOut)

    expect(rlReport.odd).toBeGreaterThan(0.6)
    expect(rlReport.odd).toBeGreaterThan(sftReport.odd + 0.3)
    expect(rlReport.accuracy).toBeGreaterThan(sftReport.accuracy)
    expect(rl.history[rl.history.length - 1]!.accuracy).toBeGreaterThan(rl.history[0]!.accuracy)
    expect(policyKl(sft.parameters, rl.parameters)).toBeGreaterThan(0)
    expect(rlReport.entropy).toBeLessThan(sftReport.entropy)
  })

  it('replays exactly from its seed', () => {
    const first = reinforce(initialPolicy(), heldOut, { steps: 10, seed: 5 })
    const second = reinforce(initialPolicy(), heldOut, { steps: 10, seed: 5 })
    expect(first.history).toEqual(second.history)
  })
})
