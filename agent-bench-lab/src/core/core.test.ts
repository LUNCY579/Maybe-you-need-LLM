import { describe, expect, it } from 'vitest'
import {
  binomialProbability,
  buildTaskSet,
  difficultyHistogram,
  pairedSignTest,
  passAtK,
  precisionTable,
  tasksNeededForDifference,
  wilsonInterval,
} from './tasks'
import {
  agentSolver,
  costPerTask,
  repeatedRuns,
  retrievalBaseline,
  runSpread,
  verify,
} from './verifier'
import {
  buildTrainingCorpus,
  measureContamination,
  overlapByLength,
  overlapFraction,
  solutionWords,
} from './contamination'

const taskSet = buildTaskSet()

describe('the task set', () => {
  it('is deterministic for a given seed', () => {
    const a = buildTaskSet({ seed: 4 })
    const b = buildTaskSet({ seed: 4 })
    expect(a.tasks.map((task) => task.failingTest)).toEqual(b.tasks.map((task) => task.failingTest))
  })

  it('gives every task a failing test and some passing ones', () => {
    for (const task of taskSet.tasks) {
      expect(task.failingTest.length).toBeGreaterThan(0)
      expect(task.passingTests.length).toBeGreaterThan(0)
      expect(task.files.length).toBeGreaterThan(0)
    }
  })
})

describe('the statistics of a score', () => {
  it('gives an interval that contains the estimate', () => {
    const interval = wilsonInterval(20, 100)
    expect(interval.low).toBeLessThan(interval.estimate)
    expect(interval.high).toBeGreaterThan(interval.estimate)
  })

  it('gives a sensible interval at the ends, where the normal approximation fails', () => {
    const none = wilsonInterval(0, 200)
    const all = wilsonInterval(200, 200)
    expect(none.low).toBe(0)
    expect(none.high).toBeLessThan(0.05)
    expect(all.high).toBe(1)
    expect(all.low).toBeGreaterThan(0.95)
  })

  it('narrows as the number of tasks grows', () => {
    const small = wilsonInterval(30, 100)
    const large = wilsonInterval(300, 1000)
    expect(large.width).toBeLessThan(small.width)
  })

  it('says how many tasks a given difference needs', () => {
    const small = tasksNeededForDifference(0.02)
    const large = tasksNeededForDifference(0.2)
    expect(small).toBeGreaterThan(large)
  })

  it('runs a paired sign test', () => {
    const clear = pairedSignTest(30, 2)
    const tie = pairedSignTest(10, 10)
    expect(clear.better).toBe(true)
    expect(clear.p).toBeLessThan(0.05)
    expect(tie.better).toBe(false)
  })

  it('computes the binomial probability', () => {
    expect(binomialProbability(10, 5, 0.5)).toBeCloseTo(0.24609375, 8)
  })

  it('estimates pass@k without the upward bias', () => {
    // One success in four samples: pass@1 is a quarter, and pass@2 is half,
    // because two of the six pairs contain the success.
    expect(passAtK([0], 4, 1)).toBe(0)
    expect(passAtK([1], 4, 1)).toBeCloseTo(0.25, 8)
    expect(passAtK([1], 4, 2)).toBeCloseTo(0.5, 8)
    // And the estimate never exceeds one.
    expect(passAtK([4], 4, 1)).toBeCloseTo(1, 8)
  })

  it('shows the precision the task count buys', () => {
    const rows = precisionTable(30, 200)
    expect(rows.length).toBeGreaterThan(1)
    expect(rows[rows.length - 1]!.width).toBeLessThan(rows[0]!.width)
  })
})

describe('the verifier', () => {
  it('accepts a patch that fixes the task', () => {
    const task = taskSet.tasks[0]!
    const verdict = verify(task, task.patch)
    expect(verdict.solved).toBe(true)
    expect(verdict.failToPass).toBe(true)
    expect(verdict.passToPass).toBe(true)
  })

  it('rejects a patch that changes the test, even though the condition is satisfied', () => {
    const task = taskSet.tasks[0]!
    const verdict = verify(task, { file: 'test_something.py', change: 'break-test' })
    expect(verdict.failToPass).toBe(true)
    expect(verdict.solved).toBe(false)
    expect(verdict.touchedATest).toBe(true)
  })

  it('rejects a patch that breaks another test', () => {
    const task = taskSet.tasks[0]!
    const verdict = verify(task, { file: task.files[0]!, change: 'break-other' })
    expect(verdict.solved).toBe(false)
    expect(verdict.passToPass).toBe(false)
  })

  it('rejects a patch that changes nothing', () => {
    const task = taskSet.tasks[0]!
    const verdict = verify(task, { file: task.files[0]!, change: 'none' })
    expect(verdict.solved).toBe(false)
  })
})

describe('the two solvers', () => {
  it('the baseline makes one attempt per task', () => {
    const result = retrievalBaseline(taskSet.tasks)
    expect(result.attempts).toBe(taskSet.tasks.length)
  })

  it('the agent makes more attempts than the tasks', () => {
    const result = agentSolver(taskSet.tasks, { seed: 3 })
    expect(result.attempts).toBeGreaterThanOrEqual(taskSet.tasks.length)
  })

  it('the agent solves more tasks than the baseline, and pays for it', () => {
    const baseline = retrievalBaseline(taskSet.tasks, 2)
    const agent = agentSolver(taskSet.tasks, { seed: 3 })
    expect(agent.solved).toBeGreaterThanOrEqual(baseline.solved)
    // The price is the attempts: the agent makes more of them.
    expect(agent.attempts).toBeGreaterThan(baseline.attempts)
    expect(costPerTask(agent)).toBeGreaterThan(0)
  })

  it('prices the score a weak criterion would have given', () => {
    const agent = agentSolver(taskSet.tasks, { seed: 5, cheatRate: 0.4 })
    // A cheat is never counted as solved, so the score the solver would have been given had the
    // verifier accepted it is the reported score plus the cheats — and with a high cheat rate it
    // is a great deal more.
    expect(agent.inflatedScore).toBe((agent.solved + agent.cheated) / taskSet.tasks.length)
    expect(agent.inflatedScore).toBeGreaterThan(agent.solved / taskSet.tasks.length)
    expect(agent.cheated).toBeGreaterThan(0)
  })
})

describe('the difficulty mix of a task set', () => {
  it('counts every task once, in the band its difficulty falls in', () => {
    const bands = difficultyHistogram(taskSet.tasks)
    expect(bands.map((band) => band.band)).toEqual([1, 2, 3, 4, 5])
    expect(bands.reduce((sum, band) => sum + band.count, 0)).toBe(taskSet.tasks.length)
    for (const band of bands) {
      expect(band.count).toBe(
        taskSet.tasks.filter((task) => task.difficulty >= (band.band - 1) / 5 && task.difficulty < band.band / 5)
          .length,
      )
    }
  })

  it('cuts the range into as many bands as it is asked for', () => {
    const three = difficultyHistogram(taskSet.tasks, 3)
    expect(three.map((band) => band.band)).toEqual([1, 2, 3])
    expect(three.reduce((sum, band) => sum + band.count, 0)).toBe(taskSet.tasks.length)
  })
})

describe('the noise between runs', () => {
  it('runs both solvers again over the same tasks', () => {
    const rows = repeatedRuns(taskSet.tasks, { runs: 4, seed: 3 })
    expect(rows.map((row) => row.run)).toEqual([1, 2, 3, 4])
    // The first run is the run the other figures use, so it is not a new number.
    expect(rows[0]!.baseline).toBe((retrievalBaseline(taskSet.tasks, 3).solved / taskSet.tasks.length) * 100)
    expect(rows[0]!.agent).toBe((agentSolver(taskSet.tasks, { seed: 3 }).solved / taskSet.tasks.length) * 100)
    for (const row of rows) {
      expect(row.baseline).toBeGreaterThanOrEqual(0)
      expect(row.agent).toBeLessThanOrEqual(100)
    }
  })

  it('measures the movement inside each solver, not the gap between them', () => {
    // Two series that each move two points, with the agent's mean twenty above the baseline's.
    const rows = [
      { run: 1, baseline: 60, agent: 80 },
      { run: 2, baseline: 62, agent: 82 },
    ]
    // The pooled within-series deviation of two such series is the deviation of either one: the
    // gap between the solvers is not noise, and a figure that called it noise would be measuring
    // the difference it was drawn to explain.
    expect(runSpread(rows).deviation).toBeCloseTo(Math.SQRT2, 10)
    expect(runSpread(rows).deviation).toBeLessThan(10)
    expect(runSpread(rows).mean).toBe(71)
    // One run of each carries no movement at all.
    expect(runSpread(rows.slice(0, 1))).toEqual({ mean: 70, deviation: 0 })
  })
})

describe('the contamination', () => {
  it('finds the shared passage', () => {
    const passage = [1, 2, 3, 4, 5, 6, 7, 8]
    const document = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    expect(overlapFraction(passage, document, 4)).toBeCloseTo(1, 8)
    expect(overlapFraction(passage, [90, 91, 92, 93], 4)).toBe(0)
  })

  it('finds a solution that was copied into the corpus', () => {
    const tasks = buildTaskSet({ size: 20, contamination: 0.5 }).tasks
    const corpus = buildTrainingCorpus(tasks, { documents: 60 })
    const report = measureContamination(tasks, corpus, { n: 12, threshold: 0.1 })
    expect(report.flagged).toBeGreaterThan(0)
    expect(report.truePositiveRate).toBeGreaterThan(0.5)
  })

  it('is more accurate with a longer n-gram', () => {
    const tasks = buildTaskSet({ size: 20, contamination: 0.5 }).tasks
    const corpus = buildTrainingCorpus(tasks, { documents: 60 })
    const rows = overlapByLength(tasks, corpus, [4, 8, 12, 20])
    expect(rows.length).toBe(4)
    const short = rows[0]!
    const long = rows[rows.length - 1]!
    // The copies in the corpus are lightly edited, so a short n-gram still
    // finds the unchanged parts and a long one does not. That is the whole
    // reason the length of the n-gram is a decision.
    expect(short.truePositiveMean).toBeGreaterThan(0.4)
    expect(long.truePositiveMean).toBeLessThan(short.truePositiveMean / 2)
  })

  it('gives a solution passage for every task', () => {
    const task = taskSet.tasks[0]!
    expect(solutionWords(task).length).toBe(40)
  })
})
