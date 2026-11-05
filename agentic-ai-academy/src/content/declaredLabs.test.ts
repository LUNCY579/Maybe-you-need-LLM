import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ITEM_TO_LAB, LABS, LAB_ITEMS } from './labs'
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
    for (const lab of LABS) {
      if (!lab.delivers?.length) continue
      for (const sourceId of lab.sources ?? []) {
        const items = manifestItems(sourceId)
        expect(lab.delivers.some((item) => items.includes(item))).toBe(true)
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

  it('lists a source for every laboratory that declares anything', () => {
    for (const lab of LABS) {
      if (!lab.delivers?.length) continue
      expect(lab.sources?.length ?? 0).toBeGreaterThan(0)
      for (const id of lab.sources ?? []) {
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
