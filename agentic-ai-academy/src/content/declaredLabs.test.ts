import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEMO_DELIVERIES, ITEM_TO_LAB, LABS, LAB_ITEMS } from './labs'
import {
  BUILDER_SCENARIOS,
  graphBrokenPipeline,
  graphMemory,
  graphToolUse,
  scenarioBrokenPipeline,
  scenarioMemory,
  scenarioToolUse,
} from '../engine/scenarios'
import { NODE_KIND_LABELS, runToCompletion, scoreRun, startRun, stepOnce, validateGraph } from '../engine/workflow'
import { DEFAULT_MEMORY_CONFIG, MEMORY_EVENTS, compareMemoryConfigs, runMemoryLab } from '../engine/labs/memory'
import { DEFAULT_WORLD, runAllStrategies } from '../engine/labs/planning'
import { DEFAULT_WORLD_MODEL_CONFIG, runWorldModelLab } from '../engine/labs/worldModel'
import { DEFAULT_MULTI_AGENT_CONFIG, ROLE_DESCRIPTIONS, runMultiAgentLab } from '../engine/labs/multiAgent'
import { DEFAULT_WRITE_POLICY_CONFIG, runWritePolicyLab } from '../engine/labs/memoryLongevity'
import {
  DEFAULT_PRIOR_LEARNING_CONFIG,
  DEFAULT_SELF_GENERATED_CONFIG,
  LOOP_WORLD,
  rewardAt,
  runPolicyPriorsLab,
} from '../engine/labs/policyPriors'
import {
  CONTEXT_SCENARIOS,
  CONTEXT_SCENARIO_BY_ID,
  GIST_FEATURES,
  GIST_TRAINING,
  assembleContext,
  gistModelFor,
  type ContextScenario,
} from '../engine/demos/contextWindow'

/**
 * Every entry that quotes a manifest item — the laboratory routes and the lesson
 * demonstrations alike.
 *
 * The audit reads one registry, not two, and so does this file: an item is promised whether the
 * screen that computes it is a page a student navigates to or a demonstration inside a lesson.
 */
const DECLARATIONS: { id: string; screen?: string; sources?: string[]; delivers?: string[] }[] = [
  ...LABS,
  ...DEMO_DELIVERIES,
]

/**
 * The registry is the collection's promise, so it is checked against the collection's own
 * record rather than against this file's opinion.
 *
 * `references/manifest.json` lists, per source, the laboratory ideas that source invites. A
 * `delivers` string here must be one of those ideas, and `sources` must name the source that
 * actually lists it: otherwise the registry would be inventing a promise, or laundering one
 * from a paper that never made it.
 */
function manifestPath(): string {
  let directory = process.cwd()
  for (let hop = 0; hop < 6; hop += 1) {
    const candidate = resolve(directory, 'references', 'manifest.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  throw new Error('references/manifest.json is not reachable from this test')
}

const MANIFEST = JSON.parse(readFileSync(manifestPath(), 'utf8'))

interface ManifestSource {
  id: string
  app?: string
  labs?: string[]
}

const MANIFEST_SOURCES = MANIFEST.sources as ManifestSource[]

function manifestItems(sourceId: string): string[] {
  const source = MANIFEST_SOURCES.find((entry) => entry.id === sourceId && entry.app === 'agentic-ai-academy')
  return source?.labs ?? []
}

const ALL_MANIFEST_ITEMS = new Set(
  MANIFEST_SOURCES.filter((source) => source.app === 'agentic-ai-academy').flatMap((source) => source.labs ?? []),
)

describe('the laboratory registry', () => {
  it('never promises an item the collection manifest did not declare', () => {
    expect(LAB_ITEMS.length).toBeGreaterThan(0)
    for (const entry of LAB_ITEMS) {
      expect(ALL_MANIFEST_ITEMS.has(entry.item)).toBe(true)
    }
  })

  it('attributes every declared item to a manifest source that lists it', () => {
    // A laboratory may cite two sources, but each item it promises must be listed by at
    // least one of them, and each source it cites must own at least one of its items.
    for (const entry of LAB_ITEMS) {
      expect(entry.sources.length).toBeGreaterThan(0)
      expect(entry.sources.some((sourceId) => manifestItems(sourceId).includes(entry.item))).toBe(true)
    }
    for (const entry of DECLARATIONS) {
      if (!entry.delivers?.length) continue
      for (const sourceId of entry.sources ?? []) {
        const items = manifestItems(sourceId)
        expect(entry.delivers.some((item) => items.includes(item))).toBe(true)
      }
    }
  })

  it('gives each declared item exactly one owning laboratory', () => {
    const owners = new Set(LAB_ITEMS.map((entry) => entry.item))
    expect(owners.size).toBe(LAB_ITEMS.length)
    for (const entry of LAB_ITEMS) {
      expect(ITEM_TO_LAB.get(entry.item)).toBe(entry.labId)
    }
  })

  it('lists a source for every declaration that promises anything', () => {
    for (const entry of DECLARATIONS) {
      if (!entry.delivers?.length) continue
      expect(entry.sources?.length ?? 0).toBeGreaterThan(0)
      for (const id of entry.sources ?? []) {
        expect(manifestItems(id).length).toBeGreaterThan(0)
      }
    }
  })
})

describe('the visual agent workflow builder', () => {
  it('Visual agent workflow builder', () => {
    // The screen's own claims, checked: ten node types, four scenarios, and a run that
    // produces a trace, a score and an explicit error state.
    expect(Object.keys(NODE_KIND_LABELS)).toHaveLength(10)
    expect(BUILDER_SCENARIOS).toHaveLength(4)

    const run = runToCompletion(graphToolUse, scenarioToolUse)
    expect(run.status).toBe('done')
    expect(run.trace.length).toBeGreaterThan(3)
    expect(run.trace.every((step) => step.summary.length > 0)).toBe(true)
    expect(scoreRun(run, scenarioToolUse)).toBe(1)

    const broken = runToCompletion(graphBrokenPipeline, scenarioBrokenPipeline)
    // A graph can be structurally valid and still fail in execution, which is the
    // difference the builder exists to teach.
    expect(validateGraph(graphBrokenPipeline).ok).toBe(true)
    expect(broken.status).toBe('error')
    expect(String(broken.haltReason)).toContain('retry budget exhausted')
  })

  it('Ch. 6, Ch. 9 and Ch. 11: the reason–act–observe loop.', () => {
    const kinds = runToCompletion(graphToolUse, scenarioToolUse).trace.map((step) => step.nodeKind)
    // Act with a tool, take the observation back in, then reason on it: the loop appears in
    // the executed trace as an ordered subsequence.
    const ordered = ['tool', 'observation', 'reasoning'] as const
    let cursor = 0
    for (const kind of kinds) {
      if (kind === ordered[cursor]) cursor += 1
    }
    expect(cursor).toBe(ordered.length)

    // Step it by hand and the trace is identical: the loop is the engine's, not the
    // convenience function's.
    let state = startRun(graphToolUse, scenarioToolUse)
    while (state.status === 'running' || state.status === 'paused') {
      state = stepOnce(state, graphToolUse, scenarioToolUse)
    }
    expect(state.trace.map((step) => step.nodeKind)).toEqual(kinds)

    // The memory scenario writes before it acts and writes again after observing.
    const memoryKinds = runToCompletion(graphMemory, scenarioMemory).trace.map((step) => step.nodeKind)
    expect(memoryKinds.filter((kind) => kind === 'memory').length).toBeGreaterThanOrEqual(2)
  })
})

describe('agent memory as explicit management', () => {
  it('Ch. 9 §9.3.2.3: explicit memory management with read/write operations.', () => {
    const run = runMemoryLab(DEFAULT_MEMORY_CONFIG)
    // Writes: every event in the stream is offered to the store, and because the store is
    // finite some of those writes are eviction writes.
    expect(run.timeline).toHaveLength(MEMORY_EVENTS.length)
    expect(run.timeline.filter((tick) => tick.stored).length).toBeGreaterThan(0)
    expect(run.timeline.filter((tick) => tick.evicted !== null)).toHaveLength(4)
    // Reads: retrieval is a separate operation with its own yield, and it is lossier than
    // the store — what is kept is not what comes back for the decision.
    expect(run.storedCritical).toBe(6)
    expect(run.totalCritical).toBe(6)
    expect(run.retrievedCritical).toBe(3)
    expect(run.retrievedCritical).toBeLessThan(run.storedCritical)

    // The point of naming the operations separately: change the read policy and the answer
    // changes, even where the store holds every critical fact.
    const comparison = compareMemoryConfigs()
    const retrieved = comparison.map((entry) => entry.run.retrievedCritical)
    expect(new Set(retrieved).size).toBeGreaterThan(1)
    const wrong = comparison.filter((entry) => entry.run.accuracy === 0)
    expect(wrong.length).toBeGreaterThan(0)
    expect(wrong.every((entry) => entry.run.storedCritical < entry.run.totalCritical)).toBe(true)
  })
})

describe('the registry names the screen that computes what it promises', () => {
  /** Every component in the application, wherever its authors put it. */
  function componentNames(directory: string): Set<string> {
    const found = new Set<string>()
    const root = resolve(process.cwd())
    const stack = [resolve(root, directory)]
    while (stack.length > 0) {
      const current = stack.pop()!
      if (!existsSync(current)) continue
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const path = join(current, entry.name)
        if (entry.isDirectory()) stack.push(path)
        else if (entry.name.endsWith('.tsx')) found.add(entry.name.replace(/\.tsx$/, ''))
      }
    }
    return found
  }

  const SCREENS = componentNames('src')

  it('names a component that exists for every item it promises', () => {
    // The collection audit pairs a declaration with a screen by `screen:` first and by the
    // id-and-filename convention only as a fallback. This application’s route ids are
    // kebab-case and its files are `…LabPage.tsx`, so the fallback would pair nothing at
    // all: the field is the whole of the pairing, and a name that matches no file is a
    // promise pointed at nowhere.
    const claimed = DECLARATIONS.filter((entry) => (entry.delivers?.length ?? 0) > 0)
    expect(claimed.length).toBe(DECLARATIONS.length)
    for (const entry of claimed) {
      expect(entry.screen, `${entry.id} promises items but names no screen`).toBeTruthy()
      expect(SCREENS, `${entry.id} names ${entry.screen}, and no such component exists`).toContain(entry.screen)
    }
    const owners = new Map<string, string>()
    for (const entry of claimed) {
      const previous = owners.get(entry.screen!)
      expect(previous, `${entry.screen} is named by ${entry.id} and ${previous ?? ''}`).toBeUndefined()
      owners.set(entry.screen!, entry.id)
    }
  })

  it('leaves no manifest promise undelivered', () => {
    // Every one of the collection's laboratory items now has a screen that computes it. The
    // last hold-out was learned prompt compression: the context-window demo fits a scorer on
    // the other windows, and prints the caveat the chapter attaches to it — the window where
    // the trained compressor loses the decisive number is measured, not asserted. An empty
    // list here is the reader's check that the audit and the registry still agree.
    const unclaimed = [...ALL_MANIFEST_ITEMS].filter((item) => !ITEM_TO_LAB.has(item))
    expect(unclaimed).toEqual([])
  })
})

describe('learned prompt compression as a fitted scorer', () => {
  const report = CONTEXT_SCENARIO_BY_ID.get('headline-number') as ContextScenario

  it('Ch. 9 §9.3.2.2: learned prompt compression, and the honest caveat that compression necessarily loses nuance.', () => {
    // Learned in the sense the chapter means: the compressor is fitted on the *other*
    // windows and then asked to rank this one, so its weights hold no copy of this window's
    // answer key.
    const model = gistModelFor(report)
    expect(model.trainedOn).not.toContain(report.id)
    expect(model.trainedOn).toEqual(
      CONTEXT_SCENARIOS.filter((scenario) => scenario.id !== report.id).map((scenario) => scenario.id),
    )
    expect(model.positives).toBeGreaterThan(0)
    expect(model.examples).toBeGreaterThan(model.positives)

    // The descent is recorded rather than claimed: the fit opens at the cost of guessing
    // every item at fifty-fifty and closes below it with no step back up.
    expect(model.loss).toHaveLength(GIST_TRAINING.epochs)
    expect(model.loss[0]).toBeCloseTo(Math.LN2, 12)
    expect(model.loss.every((value, index) => index === 0 || value <= model.loss[index - 1])).toBe(true)
    expect(model.loss.at(-1)!).toBeLessThan(model.loss[0] / 3)

    // Five signals a harness could compute at run time. `critical` — which item decides the
    // answer — is a label, and appears nowhere on this side of the fit.
    expect(GIST_FEATURES.map((feature) => feature.key)).toEqual([
      'tagOverlap',
      'questionOverlap',
      'recency',
      'cost',
      'compressible',
    ])

    // The caveat, measured: in the window this scenario ships with, the trained scorer ranks
    // the headline figure below the material it can stand in for and gives it the short form.
    // The summary is still about the right document, and the number is not in it.
    const outcome = assembleContext(report, report.budget, 'gist')
    const metrics = outcome.kept.find((entry) => entry.item.id === 'metrics')
    expect(metrics).toBeDefined()
    expect(metrics?.compressed).toBe(true)
    expect(metrics?.retains).toBe(false)
    expect(outcome.intact).toBe(false)
    expect(outcome.answer).toBe(report.wrongAnswer)
    expect(outcome.correct).toBe(false)

    // …and it is the shortening that loses it, not the room: the same ranking, given the
    // tokens the item asks for, keeps the figure in full and the answer with it.
    const widened = assembleContext(report, 120, 'gist')
    expect(widened.intact).toBe(true)
    expect(widened.answer).toBe(report.correctAnswer)
    expect(widened.gist?.decisions.find((decision) => decision.item.id === 'metrics')?.action).toBe('full')
  })
})

describe('planning, memory, world models and collaboration as measured strategies', () => {
  it('Planning', () => {
    const runs = runAllStrategies(DEFAULT_WORLD)
    expect(runs.map((run) => run.strategy)).toEqual(['greedy', 'fixed-plan', 'search', 'reflective'])
    const byStrategy = new Map(runs.map((run) => [run.strategy, run]))

    // The locked door is the world’s lesson: the greedy walk presses against it without the
    // key and never gets past, while the search that takes the key first does.
    expect(byStrategy.get('greedy')!.reachedGoal).toBe(false)
    expect(byStrategy.get('greedy')!.failures).toBeGreaterThan(0)
    expect(byStrategy.get('search')!.reachedGoal).toBe(true)
    // A reflective planner treats a failure as information rather than as an ending.
    expect(byStrategy.get('reflective')!.replans).toBeGreaterThan(0)
    expect(byStrategy.get('reflective')!.reachedGoal).toBe(true)
    // Four strategies over one world must not produce four identical numbers.
    expect(new Set(runs.map((run) => run.actionCount)).size).toBeGreaterThan(1)
  })

  it('Memory', () => {
    const run = runMemoryLab(DEFAULT_MEMORY_CONFIG)
    // The stream is longer than the store, which is why some writes are eviction writes.
    expect(MEMORY_EVENTS.length).toBeGreaterThan(DEFAULT_MEMORY_CONFIG.capacity)
    expect(run.timeline).toHaveLength(MEMORY_EVENTS.length)
    expect(run.timeline.filter((tick) => tick.evicted !== null).length).toBeGreaterThan(0)
    expect(run.storedCritical).toBeLessThanOrEqual(DEFAULT_MEMORY_CONFIG.capacity)
    // Retrieval is a second, lossier step: what comes back is a subset of what is kept.
    expect(run.retrievedCritical).toBeLessThanOrEqual(run.storedCritical)
    expect(run.retrievedCritical).toBeLessThan(MEMORY_EVENTS.length)
  })

  it('World model', () => {
    const run = runWorldModelLab(DEFAULT_WORLD_MODEL_CONFIG)
    // The model is scored against reality transition by transition, not asserted to be good.
    expect(run.divergences.length).toBeGreaterThan(0)
    for (const row of run.divergences) {
      expect(row.predicted.length).toBeGreaterThan(0)
      expect(row.actual.length).toBeGreaterThan(0)
      expect(row.divergence).toBeGreaterThanOrEqual(0)
    }
    expect(run.meanDivergence).toBeGreaterThanOrEqual(0)
    expect(run.modelBased.sweeps).toBeGreaterThan(0)
  })

  it('Model-free versus model-based planning', () => {
    const run = runWorldModelLab(DEFAULT_WORLD_MODEL_CONFIG)
    // The model-free arm pays in interactions; the model-based arm pays in sweeps over a
    // fitted table. Both are then rolled out in the real world, so their success rates are
    // in the same units even though their costs are not.
    expect(run.modelFree.trainingCurve.length).toBeGreaterThan(0)
    expect(run.modelFree.evaluation.episodes.length).toBeGreaterThan(0)
    expect(run.modelBased.evaluation.episodes.length).toBeGreaterThan(0)
    expect(run.modelFree.evaluation.successRate).toBeGreaterThanOrEqual(0)
    expect(run.modelBased.evaluation.successRate).toBeGreaterThanOrEqual(0)
    // A fitted model of a slippery world is wrong somewhere, and the lab prints where.
    expect(run.meanDivergence).toBeGreaterThan(0)
  })

  it('Multi-agent', () => {
    const run = runMultiAgentLab(DEFAULT_MULTI_AGENT_CONFIG)
    const roles = Object.keys(ROLE_DESCRIPTIONS).sort()
    expect(roles).toHaveLength(5)
    expect(run.agents.map((agent) => agent.role).sort()).toEqual(roles)
    // The channel is lossy by configuration, and the dropped messages are counted, not
    // smoothed over.
    expect(run.handoffs.reduce((sum, handoff) => sum + handoff.dropped, 0)).toBeGreaterThan(0)
    expect(run.coordinationFailures).toBeGreaterThan(0)
    // Verification is measured as a split: defects caught in review versus defects that
    // reached the final answer.
    expect(run.defectsCaught).toBeGreaterThanOrEqual(0)
    expect(run.defectsReachingAnswer).toBeGreaterThanOrEqual(0)
    expect(run.outcomeScore).toBeGreaterThanOrEqual(0)
    expect(run.outcomeScore).toBeLessThanOrEqual(1)
  })
})

describe('a compact state and a reward the world can check', () => {
  it('Ch. 9 §9.3.2.3: a compact state that is updated after every interaction, so the state does not run out of the context window.', () => {
    const run = runWritePolicyLab(DEFAULT_WRITE_POLICY_CONFIG)
    for (const arm of [run.learned, run.rule]) {
      // One write decision per interaction: the state is revised as the stream arrives.
      expect(arm.trace.map((step) => step.eventId)).toEqual(MEMORY_EVENTS.map((event) => event.id))
      // And it stays inside its budget, which is the whole claim — the store does not grow
      // with the conversation.
      expect(arm.storeSize).toBeLessThanOrEqual(DEFAULT_WRITE_POLICY_CONFIG.capacity)
      expect(arm.actions.add + arm.actions.update + arm.actions.delete + arm.actions.none).toBe(
        MEMORY_EVENTS.length,
      )
    }
    expect(MEMORY_EVENTS.length).toBeGreaterThan(DEFAULT_WRITE_POLICY_CONFIG.capacity)
    // Merging and dropping are real options, not decoration: a policy that only ever wrote
    // would be the unbounded store this item exists to replace.
    expect(run.learned.actions.update + run.learned.actions.delete + run.learned.actions.none).toBeGreaterThan(0)
  })

  it("Ch. 3 and Ch. 23 §23.2.2: reinforcement learning with verifiable rewards, and the case for training on the agent's own interaction data.", () => {
    // The reward is a fact about the world rather than a learned preference: the goal cell
    // pays more than the pit, and the same cell pays the same amount whichever policy
    // reached it. That is what makes the signal verifiable, and it is why the loop can be
    // scored at all.
    expect(rewardAt(LOOP_WORLD, LOOP_WORLD.goal)).toBeGreaterThan(rewardAt(LOOP_WORLD, LOOP_WORLD.pit))
    expect(rewardAt(LOOP_WORLD, LOOP_WORLD.goal)).toBe(rewardAt(LOOP_WORLD, LOOP_WORLD.goal))

    const run = runPolicyPriorsLab(DEFAULT_PRIOR_LEARNING_CONFIG, DEFAULT_SELF_GENERATED_CONFIG)
    const { selfOnly, mixed } = run.selfGenerated
    // By the last generation the self-only arm is training on nothing but its own rollouts,
    // while the mixed arm still keeps the external pool in the set.
    expect(selfOnly.generations.at(-1)!.selfGeneratedShare).toBe(1)
    expect(mixed.generations.at(-1)!.selfGeneratedShare).toBeLessThan(1)
    // The honest result the chapter asks for: the pure self-generated loop lets model error
    // grow, and holding an external pool in the training set is what limits it.
    expect(selfOnly.errorGrowth).toBeGreaterThan(mixed.errorGrowth)
    expect(selfOnly.peakError).toBeGreaterThan(0)
    // Every policy in the loop is evaluated in the real environment, never inside its own
    // model, so a confident wrong model cannot inflate its own success rate.
    for (const arm of [selfOnly, mixed]) {
      expect(arm.finalSuccess).toBeGreaterThanOrEqual(0)
      expect(arm.generations.length).toBeGreaterThan(1)
    }
  })
})
