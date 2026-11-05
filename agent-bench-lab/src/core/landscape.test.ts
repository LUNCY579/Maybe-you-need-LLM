import { describe, expect, it } from 'vitest'
import { buildTaskSet, passPowerK } from './tasks'
import { criterionReport } from './verifier'
import {
  AGENTBENCH_ENVIRONMENTS,
  GAIA_LEVELS,
  MODEL_PROFILES,
  divergenceStep,
  environmentScores,
  gaiaQuestions,
  landscapeSummary,
  replay,
  replayDigest,
  resolutionByFileSize,
  resolutionProbability,
  scoreOf,
  successByToolBudget,
  toolShortfall,
} from './landscape'

describe('the resolution rate and the size of the task', () => {
  it('falls as a task touches more files', () => {
    const buckets = resolutionByFileSize()
    expect(buckets.length).toBe(8)
    for (let index = 1; index < buckets.length; index++) {
      expect(buckets[index]!.rate, `bucket ${index}`).toBeLessThan(buckets[index - 1]!.rate)
    }
    expect(resolutionProbability(1)).toBeGreaterThan(4 * resolutionProbability(8))
  })

  it('counts every task in its bucket', () => {
    for (const bucket of resolutionByFileSize()) {
      expect(bucket.solved).toBeLessThanOrEqual(bucket.tasks)
      expect(bucket.rate).toBeCloseTo(bucket.solved / bucket.tasks, 12)
    }
  })
})

describe('the three GAIA levels', () => {
  const questions = gaiaQuestions()

  it('puts every question in one of the three levels', () => {
    expect(questions.length).toBe(90)
    for (const question of questions) {
      expect([1, 2, 3], `question ${question.id}`).toContain(question.level)
      expect(question.tools).toBeGreaterThanOrEqual(question.level)
      expect(question.steps).toBeGreaterThanOrEqual(question.level)
    }
    for (const level of GAIA_LEVELS) {
      expect(questions.some((question) => question.level === level.level), level.label).toBe(true)
    }
  })

  it('gets easier at a higher level, at any tool budget', () => {
    for (const row of successByToolBudget(questions)) {
      expect(row.level1, `budget ${row.tools}`).toBeGreaterThanOrEqual(row.level2)
      expect(row.level2, `budget ${row.tools}`).toBeGreaterThanOrEqual(row.level3)
    }
  })

  it('rises with the tool budget, and stops rising when every tool is reachable', () => {
    const rows = successByToolBudget(questions)
    expect(rows[0]!.overall).toBe(0)
    for (let index = 1; index < rows.length; index++) {
      expect(rows[index]!.level3, `budget ${rows[index]!.tools}`).toBeGreaterThanOrEqual(
        rows[index - 1]!.level3,
      )
    }
    expect(toolShortfall(questions, 1)[3]).toBeGreaterThan(toolShortfall(questions, 4)[3])
  })
})

describe('the AgentBench environments', () => {
  const rows = environmentScores()

  it('scores every model in every environment', () => {
    expect(rows.length).toBe(AGENTBENCH_ENVIRONMENTS.length)
    for (const row of rows) {
      expect(row.scores.length).toBe(MODEL_PROFILES.length)
      for (const score of row.scores) expect(score).toBeGreaterThan(0)
      for (const score of row.scores) expect(score).toBeLessThan(1)
    }
  })

  it('is monotone in capability at a fixed difficulty', () => {
    expect(scoreOf(0.6, 0.4)).toBeGreaterThan(scoreOf(0.3, 0.4))
  })

  it('lets the average rank one model first while another wins an environment', () => {
    const summary = landscapeSummary(rows)
    expect(summary.bestByAverage).toBe('the large model')
    const specialist = summary.models.find((entry) => entry.model.id === 'specialist')!
    expect(specialist.wins).toBeGreaterThan(0)
    expect(summary.exceptions).toBeGreaterThan(0)
    const large = summary.models.find((entry) => entry.model.id === 'large')!
    expect(large.spread).toBeGreaterThan(0.3)
    expect(large.min).toBeLessThan(large.mean - 0.25)
  })
})

describe('replaying a WebArena trajectory', () => {
  const actions = ['search', 'add', 'add', 'checkout', 'remove'] as const

  it('gives the same states for the same seed and actions', () => {
    const first = replay([...actions], 5)
    const second = replay([...actions], 5)
    expect(replayDigest(first)).toBe(replayDigest(second))
    expect(first.length).toBe(actions.length + 1)
  })

  it('diverges at the first changed action', () => {
    expect(divergenceStep([...actions], [...actions], 5)).toBe(-1)
    const changed = [...actions]
    changed[2] = 'remove'
    expect(divergenceStep([...actions], changed, 5)).toBe(3)
  })

  it('starts from a different cart for a different seed', () => {
    expect(replay([], 1)[0]!.cart).not.toBe(replay([], 2)[0]!.cart)
  })

  it('refuses a checkout with an empty cart', () => {
    const states = replay(['checkout'], 0)
    expect(states[1]!.page).toBe('cart')
  })
})

describe('pass^k and the verification harness', () => {
  it('counts only tasks whose k trials all succeed', () => {
    expect(passPowerK([10, 10], 10, 1)).toBe(1)
    expect(passPowerK([1, 0], 10, 2)).toBe(0)
    expect(passPowerK([10, 10, 10], 10, 5)).toBe(1)
    expect(passPowerK([10, 10], 10, 11)).toBeNaN()
  })

  it('falls as k grows, for a solver that does not always succeed', () => {
    const counts = [9, 8, 6, 5, 3, 2, 7, 4]
    const estimates = [1, 2, 4, 8].map((k) => passPowerK(counts, 10, k))
    for (let index = 1; index < estimates.length; index++) {
      expect(estimates[index]!).toBeLessThan(estimates[index - 1]!)
    }
  })

  it('catches the cheats the first condition alone accepts', () => {
    const report = criterionReport(buildTaskSet({ size: 40 }).tasks)
    expect(report.patches).toBe(200)
    expect(report.cheats).toBe(40)
    expect(report.failToPassOnly).toBe(report.bothConditions + report.cheats)
    expect(report.regressions).toBe(40)
  })
})
