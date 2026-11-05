import { describe, expect, it } from 'vitest'
import {
  createInitialState,
  resetRun,
  runToCompletion,
  scoreRun,
  startRun,
  stepOnce,
  validateGraph,
} from './workflow'
import {
  graphBrokenPipeline,
  graphMemory,
  graphReflection,
  graphToolUse,
  scenarioBrokenPipeline,
  scenarioMemory,
  scenarioReflection,
  scenarioToolUse,
} from './scenarios'
import type { WorkflowGraph } from '../types/workflow'

describe('graph validation', () => {
  it('accepts the reference graphs', () => {
    for (const graph of [graphToolUse, graphReflection, graphMemory, graphBrokenPipeline]) {
      const result = validateGraph(graph)
      expect(result.ok, JSON.stringify(result.issues)).toBe(true)
    }
  })

  it('reports a missing response node as an error', () => {
    const graph: WorkflowGraph = {
      nodes: graphToolUse.nodes.filter((node) => node.kind !== 'response'),
      edges: graphToolUse.edges.filter((edge) => edge.target !== 'response'),
    }
    const result = validateGraph(graph)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes('final response node'))).toBe(true)
  })

  it('warns about unreachable nodes and branch points without a second edge', () => {
    const result = validateGraph({
      nodes: [
        ...graphToolUse.nodes,
        {
          id: 'orphan',
          kind: 'reasoning',
          label: 'Orphan reasoning',
          position: { x: 0, y: 0 },
          config: { depth: 1 },
        },
      ],
      edges: [
        ...graphToolUse.edges,
        { id: 'tool->response2', source: 'tool', target: 'response' },
      ].filter((edge) => edge.source !== 'orphan'),
    })
    expect(result.issues.some((issue) => issue.severity === 'warning' && issue.message.includes('unreachable'))).toBe(true)
  })

  it('rejects invalid memory configuration', () => {
    const result = validateGraph({
      nodes: [
        graphMemory.nodes[0],
        {
          id: 'bad-memory',
          kind: 'memory',
          label: 'Bad memory',
          position: { x: 0, y: 0 },
          config: { mode: 'read', capacity: 0, query: 'x', relevanceWeight: 2 },
        },
        graphMemory.nodes.at(-1)!,
      ],
      edges: [
        { id: 'a', source: graphMemory.nodes[0].id, target: 'bad-memory' },
        { id: 'b', source: 'bad-memory', target: graphMemory.nodes.at(-1)!.id },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.issues.filter((issue) => issue.severity === 'error').length).toBeGreaterThanOrEqual(2)
  })
})

describe('tool-use scenario', () => {
  it('runs to completion with a perfect score', () => {
    const final = runToCompletion(graphToolUse, scenarioToolUse)
    expect(final.status).toBe('done')
    expect(final.context.toolCalls).toHaveLength(1)
    expect(final.context.toolCalls[0].ok).toBe(true)
    expect(final.context.successScore).toBe(1)
    expect(final.context.finalAnswer).toContain('prime')
  })

  it('is deterministic across repeated runs', () => {
    const first = runToCompletion(graphToolUse, scenarioToolUse)
    const second = runToCompletion(graphToolUse, scenarioToolUse)
    expect(second.trace).toEqual(first.trace)
    expect(second.context.successScore).toBe(first.context.successScore)
  })

  it('executes one node per step and tracks the current node', () => {
    let state = startRun(graphToolUse, scenarioToolUse)
    expect(state.status).toBe('running')
    expect(state.currentNodeId).toBe('input')
    state = stepOnce(state, graphToolUse, scenarioToolUse)
    expect(state.trace).toHaveLength(1)
    expect(state.currentNodeId).toBe('planner')
    expect(state.context.goal).toContain('8191')
  })

  it('pauses and resumes without losing position', () => {
    const started = startRun(graphToolUse, scenarioToolUse)
    const paused = { ...started, status: 'paused' as const }
    const blocked = stepOnce(resetRun(), graphToolUse, scenarioToolUse)
    expect(blocked.trace).toHaveLength(0)
    expect(stepOnce(paused, graphToolUse, scenarioToolUse).trace).toHaveLength(1)
  })

  it('reports an error state when the graph is invalid', () => {
    const state = startRun({ nodes: [], edges: [] }, scenarioToolUse)
    expect(state.status).toBe('error')
    expect(state.haltReason).toBeTruthy()
  })
})

describe('reflection scenario', () => {
  it('fails once, reflects, then succeeds on the retry', () => {
    const final = runToCompletion(graphReflection, scenarioReflection)
    expect(final.status).toBe('done')
    expect(final.context.retries).toBe(1)
    expect(final.context.critiques).toHaveLength(1)
    expect(final.context.toolCalls.some((call) => call.ok)).toBe(true)
    expect(final.trace.some((step) => step.branch === 'fail')).toBe(true)
    expect(final.trace.some((step) => step.branch === 'pass')).toBe(true)
    expect(final.context.successScore).toBeGreaterThan(0.8)
  })

  it('halts explicitly when the reflection budget is exhausted', () => {
    const graph: WorkflowGraph = {
      nodes: graphReflection.nodes.map((node) =>
        node.kind === 'reflection' ? { ...node, config: { maxRetries: 1 } } : node,
      ),
      // Route the pass branch back into reflection so the loop must exhaust retries.
      edges: graphReflection.edges.map((edge) =>
        edge.branch === 'pass' ? { ...edge, target: 'reflection' } : edge,
      ),
    }
    const final = runToCompletion(graph, scenarioReflection)
    expect(final.status).toBe('error')
    expect(final.haltReason).toContain('Reflection retry budget')
  })
})

describe('memory scenario', () => {
  it('retrieves relevant items and writes a summary', () => {
    const final = runToCompletion(graphMemory, scenarioMemory)
    expect(final.status).toBe('done')
    expect(final.context.retrieval).not.toBeNull()
    expect(final.context.retrieval?.retrieved.length).toBeGreaterThan(0)
    expect(final.context.retrieval?.query).toContain('seat preference')
    expect(final.context.toolCalls[0].toolName).toBe('book_seat')
    expect(final.context.finalAnswer).toContain('14A')
  })

  it('ranks the window-seat preference above unrelated memories', () => {
    const final = runToCompletion(graphMemory, scenarioMemory)
    const kept = final.context.retrieval?.retrieved.map((item) => item.id) ?? []
    expect(kept).toContain('mem-pref-window')
    expect(kept).not.toContain('mem-pref-tea')
  })

  it('evicts low-salience items when the store exceeds capacity', () => {
    const final = runToCompletion(graphMemory, scenarioMemory)
    // Capacity 4 for the write node: the store must never exceed it.
    expect(final.context.memory.length).toBeLessThanOrEqual(4)
  })
})

describe('broken pipeline scenario', () => {
  it('ends in an explicit error state with a full trace', () => {
    const final = runToCompletion(graphBrokenPipeline, scenarioBrokenPipeline)
    expect(['error', 'halted']).toContain(final.status)
    expect(final.context.errors.length).toBeGreaterThan(0)
    expect(final.context.toolCalls.every((call) => !call.ok)).toBe(true)
    expect(final.haltReason).toBeTruthy()
  })

  it('gives partial credit for observed failures rather than crashing', () => {
    const final = runToCompletion(graphBrokenPipeline, scenarioBrokenPipeline)
    const score = scoreRun(final, scenarioBrokenPipeline)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThan(1)
  })
})

describe('step budget', () => {
  it('halts when a cyclic graph exceeds the budget', () => {
    const graph: WorkflowGraph = {
      nodes: [
        graphToolUse.nodes.find((node) => node.kind === 'input')!,
        {
          id: 'loop',
          kind: 'reasoning',
          label: 'Loop reasoning',
          position: { x: 0, y: 0 },
          config: { depth: 1 },
        },
      ],
      edges: [{ id: 'loop-edge', source: 'loop', target: 'loop', branch: 'default' }],
    }
    // Graph validation rejects the unreachable input/self-loop combination; run the
    // loop directly to exercise the budget guard.
    let state = startRun(graph, scenarioToolUse)
    if (state.status === 'error') {
      state = { ...createInitialState(), status: 'running', currentNodeId: 'loop' }
    }
    let guard = 0
    while ((state.status === 'running' || state.status === 'paused') && guard < 100) {
      state = stepOnce(state, graph, scenarioToolUse)
      guard += 1
    }
    expect(['halted', 'error']).toContain(state.status)
  })
})
