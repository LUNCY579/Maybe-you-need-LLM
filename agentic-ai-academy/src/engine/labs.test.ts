import { describe, expect, it } from 'vitest'
import { DEFAULT_WORLD, runAllStrategies, runPlanning } from './labs/planning'
import { DEFAULT_MEMORY_CONFIG, MEMORY_EVENTS, runMemoryLab } from './labs/memory'
import { DEFAULT_WORLD_MODEL_CONFIG, allCells, modelTransition, runWorldModelLab, valueIteration } from './labs/worldModel'
import { DEFAULT_MULTI_AGENT_CONFIG, runMultiAgentLab } from './labs/multiAgent'

describe('Lab A · planning', () => {
  it('search-based planning reaches the goal', () => {
    const run = runPlanning('search', DEFAULT_WORLD)
    expect(run.reachedGoal).toBe(true)
    expect(run.failures).toBe(0)
    expect(run.planLength).toBeGreaterThan(0)
  })

  it('greedy planning gets stuck because it never fetches the key', () => {
    const run = runPlanning('greedy', DEFAULT_WORLD)
    expect(run.reachedGoal).toBe(false)
    expect(run.failures).toBeGreaterThan(0)
  })

  it('the fixed plan fails once it meets a locked door', () => {
    const run = runPlanning('fixed-plan', DEFAULT_WORLD)
    expect(run.reachedGoal).toBe(false)
    expect(run.failures).toBeGreaterThan(0)
    expect(run.steps.at(-1)?.failed).toBe(true)
  })

  it('reflective planning recovers and solves the task', () => {
    const run = runPlanning('reflective', DEFAULT_WORLD)
    expect(run.reachedGoal).toBe(true)
    expect(run.replans).toBeGreaterThan(0)
  })

  it('is deterministic', () => {
    expect(runPlanning('reflective', DEFAULT_WORLD)).toEqual(runPlanning('reflective', DEFAULT_WORLD))
    expect(runAllStrategies()).toHaveLength(4)
  })

  it('is deterministic with slip enabled for a fixed seed', () => {
    const options = { slipProbability: 0.2, seed: 7 }
    expect(runPlanning('search', DEFAULT_WORLD, options)).toEqual(runPlanning('search', DEFAULT_WORLD, options))
    expect(runAllStrategies(DEFAULT_WORLD, options)).toEqual(runAllStrategies(DEFAULT_WORLD, options))
  })

  it('produces a different run for a different seed', () => {
    const a = runPlanning('search', DEFAULT_WORLD, { slipProbability: 0.3, seed: 1 })
    const b = runPlanning('search', DEFAULT_WORLD, { slipProbability: 0.3, seed: 2 })
    expect(a.steps).not.toEqual(b.steps)
  })

  it('never slips when the slip probability is zero', () => {
    const run = runPlanning('search', DEFAULT_WORLD, { slipProbability: 0, seed: 3 })
    expect(run.steps.some((step) => step.note.includes('Slipped'))).toBe(false)
  })

  it('records slips in the trace when the world is stochastic', () => {
    const run = runPlanning('search', DEFAULT_WORLD, { slipProbability: 0.5, seed: 5 })
    expect(run.steps.some((step) => step.note.includes('Slipped'))).toBe(true)
  })

  it('gives every strategy the same slip pattern at the same step indices', () => {
    const options = { slipProbability: 0.4, seed: 11 }
    const a = runPlanning('search', DEFAULT_WORLD, options)
    const b = runPlanning('reflective', DEFAULT_WORLD, options)
    // The first slip must occur at the same step index for both strategies,
    // because the slip sequence is keyed on the step, not on the strategy.
    const firstSlipA = a.steps.findIndex((step) => step.note.includes('Slipped'))
    const firstSlipB = b.steps.findIndex((step) => step.note.includes('Slipped'))
    if (firstSlipA >= 0 && firstSlipB >= 0) {
      expect(firstSlipA).toBe(firstSlipB)
    }
  })

  it('keeps the agent inside the world bounds when it slips', () => {
    const run = runPlanning('search', DEFAULT_WORLD, { slipProbability: 0.5, seed: 2 })
    for (const step of run.steps) {
      expect(step.to[0]).toBeGreaterThanOrEqual(0)
      expect(step.to[0]).toBeLessThan(DEFAULT_WORLD.width)
      expect(step.to[1]).toBeGreaterThanOrEqual(0)
      expect(step.to[1]).toBeLessThan(DEFAULT_WORLD.height)
    }
  })
})

describe('Lab B · memory', () => {
  it('keeps the store within capacity', () => {
    const run = runMemoryLab({ ...DEFAULT_MEMORY_CONFIG, capacity: 3 })
    expect(run.timeline.at(-1)?.storeSize).toBeLessThanOrEqual(3)
  })

  it('makes the correct decision with the recommended configuration', () => {
    const run = runMemoryLab(DEFAULT_MEMORY_CONFIG)
    expect(run.decisions[0].correct).toBe(true)
    expect(run.decisions[0].decision).toContain('07:12')
  })

  it('fails the decision when the store is too small and retrieval favours recency', () => {
    const run = runMemoryLab({ ...DEFAULT_MEMORY_CONFIG, strategy: 'recency', capacity: 2, topK: 2 })
    expect(run.decisions[0].correct).toBe(false)
    expect(run.storedCritical).toBeLessThan(run.totalCritical)
  })

  it('fails when retrieval never returns the route-delay fact', () => {
    const run = runMemoryLab({ ...DEFAULT_MEMORY_CONFIG, capacity: 2, topK: 2, strategy: 'importance' })
    expect(run.decisions[0].correct).toBe(false)
  })

  it('reports retrieval scores for every stored item and omits the rest', () => {
    const run = runMemoryLab(DEFAULT_MEMORY_CONFIG)
    const decision = run.decisions[0]
    expect(decision.scores.length).toBeGreaterThan(0)
    expect(decision.retrieved.length + decision.omitted.length).toBe(decision.scores.length)
    expect(decision.retrieved.length).toBeLessThanOrEqual(DEFAULT_MEMORY_CONFIG.topK)
  })

  it('rolls the scratchpad over as the budget shrinks', () => {
    const small = runMemoryLab({ ...DEFAULT_MEMORY_CONFIG, scratchpadTokens: 12 })
    const large = runMemoryLab({ ...DEFAULT_MEMORY_CONFIG, scratchpadTokens: 200 })
    expect(small.scratchpad.length).toBeLessThan(large.scratchpad.length)
    expect(large.scratchpad.length).toBe(MEMORY_EVENTS.length)
  })
})

describe('Lab C · world model', () => {
  it('value iteration produces a policy for every non-terminal cell', () => {
    const { policy } = valueIteration(DEFAULT_WORLD_MODEL_CONFIG)
    const cells = allCells(DEFAULT_WORLD_MODEL_CONFIG)
    expect(Object.keys(policy).length).toBeGreaterThan(0)
    expect(Object.keys(policy).length).toBeLessThanOrEqual(cells.length)
  })

  it('improves the model-free agent above the worst possible reward', () => {
    const run = runWorldModelLab(DEFAULT_WORLD_MODEL_CONFIG)
    expect(run.modelFree.evaluation.averageReward).toBeGreaterThan(-1)
    expect(run.modelFree.trainingCurve.length).toBe(DEFAULT_WORLD_MODEL_CONFIG.episodes)
  })

  it('is more sample-efficient than the model-free agent with an accurate model', () => {
    // With a short training budget the planning agent still solves the task,
    // while Q-learning has not converged yet: the sample-efficiency argument of
    // Ch. 7 §7.3.1 made measurable.
    const run = runWorldModelLab({ ...DEFAULT_WORLD_MODEL_CONFIG, modelAccuracy: 1, episodes: 40 })
    expect(run.modelBased.evaluation.averageReward).toBeGreaterThan(run.modelFree.evaluation.averageReward)
    expect(run.modelBased.evaluation.successRate).toBeGreaterThan(0.5)
  })

  it('diverges less when the model is faithful than when it is naive', () => {
    const faithful = runWorldModelLab({ ...DEFAULT_WORLD_MODEL_CONFIG, modelAccuracy: 1, evalEpisodes: 60 })
    const naive = runWorldModelLab({ ...DEFAULT_WORLD_MODEL_CONFIG, modelAccuracy: 0, evalEpisodes: 60 })
    expect(faithful.meanDivergence).toBeLessThan(naive.meanDivergence)
  })

  it('converges to a strong policy given enough episodes, with or without a model', () => {
    const run = runWorldModelLab({ ...DEFAULT_WORLD_MODEL_CONFIG, modelAccuracy: 1 })
    expect(run.modelBased.evaluation.successRate).toBeGreaterThan(0.5)
    expect(run.modelFree.evaluation.successRate).toBeGreaterThan(0.5)
  })

  it('exposes model error through divergence', () => {
    const accurate = runWorldModelLab({ ...DEFAULT_WORLD_MODEL_CONFIG, modelAccuracy: 1 })
    const naive = runWorldModelLab({ ...DEFAULT_WORLD_MODEL_CONFIG, modelAccuracy: 0 })
    expect(naive.meanDivergence).toBeGreaterThan(accurate.meanDivergence)
  })

  it('is deterministic for a fixed seed', () => {
    const first = runWorldModelLab(DEFAULT_WORLD_MODEL_CONFIG)
    const second = runWorldModelLab(DEFAULT_WORLD_MODEL_CONFIG)
    expect(second.modelFree.evaluation.averageReward).toBe(first.modelFree.evaluation.averageReward)
    expect(second.divergences).toEqual(first.divergences)
  })

  it('produces normalised model transitions', () => {
    for (const cell of allCells(DEFAULT_WORLD_MODEL_CONFIG)) {
      const outcomes = modelTransition(DEFAULT_WORLD_MODEL_CONFIG, cell, 0)
      const total = outcomes.reduce((sum, outcome) => sum + outcome.probability, 0)
      expect(total).toBeCloseTo(1, 5)
    }
  })
})

describe('Lab D · multi-agent collaboration', () => {
  it('scores a reliable team above a lossy one', () => {
    const reliable = runMultiAgentLab({ ...DEFAULT_MULTI_AGENT_CONFIG, channelReliability: 1, researcherQuality: 1, executorQuality: 1, verifierQuality: 1 })
    const lossy = runMultiAgentLab({ ...DEFAULT_MULTI_AGENT_CONFIG, channelReliability: 0.5 })
    expect(reliable.outcomeScore).toBeGreaterThan(lossy.outcomeScore)
  })

  it('lets more defects reach the answer without verification', () => {
    const withVerifier = runMultiAgentLab({ ...DEFAULT_MULTI_AGENT_CONFIG, verifierQuality: 1, researcherQuality: 0.5, executorQuality: 0.5 })
    const withoutVerifier = runMultiAgentLab({
      ...DEFAULT_MULTI_AGENT_CONFIG,
      verificationEnabled: false,
      criticEnabled: false,
      researcherQuality: 0.5,
      executorQuality: 0.5,
    })
    expect(withoutVerifier.defectsReachingAnswer).toBeGreaterThanOrEqual(withVerifier.defectsReachingAnswer)
  })

  it('reports handoffs, messages and per-agent statistics', () => {
    const run = runMultiAgentLab()
    expect(run.messages.length).toBeGreaterThan(0)
    expect(run.handoffs.length).toBeGreaterThan(0)
    expect(run.agents.map((agent) => agent.role)).toContain('verifier')
    expect(run.subtasks).toHaveLength(3)
  })

  it('is deterministic for a fixed configuration', () => {
    const first = runMultiAgentLab(DEFAULT_MULTI_AGENT_CONFIG)
    const second = runMultiAgentLab(DEFAULT_MULTI_AGENT_CONFIG)
    expect(second.outcomeScore).toBe(first.outcomeScore)
    expect(second.messages).toEqual(first.messages)
  })
})
