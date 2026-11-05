/**
 * Deterministic execution engine for the Visual Agent Workflow Builder.
 *
 * Design rules
 * ------------
 * 1. Pure functions: every transition is `(state, graph, scenario) => state`.
 * 2. No randomness, no clock, no network. Anything that looks like chance is
 *    driven by invocation counters recorded in the execution context.
 * 3. Errors are explicit: dead ends, missing nodes, budget overruns and broken
 *    tools produce typed step records with status 'error' plus a halt reason.
 *
 * The engine models the *harness* described in Chapter 1 of the textbook, not a
 * language model. Tool outputs, plans and reasoning notes are scripted by the
 * scenario so runs can be compared and asserted in tests.
 */

import type {
  DecisionConfig,
  EvaluatorConfig,
  ExecutionContext,
  ExecutionState,
  GraphValidation,
  InputConfig,
  MemoryConfig,
  MemoryItem,
  ObservationConfig,
  PlannerConfig,
  ReasoningConfig,
  ReflectionConfig,
  ResponseConfig,
  RetrievalRecord,
  StepRecord,
  ToolConfig,
  ValidationIssue,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowScenario,
} from '../types/workflow'

export const NODE_KIND_LABELS: Record<string, string> = {
  input: 'User input',
  planner: 'Planner',
  reasoning: 'Reasoning step',
  tool: 'Tool call',
  memory: 'Memory',
  observation: 'Environment observation',
  decision: 'Decision',
  evaluator: 'Evaluator',
  reflection: 'Reflection',
  response: 'Final response',
}

export const NODE_KIND_DESCRIPTIONS: Record<string, string> = {
  input: 'Receives the goal from the scenario and seeds the execution context.',
  planner: 'Decomposes the goal into an ordered plan (scripted per scenario).',
  reasoning: 'Records an explicit inference step from the scenario reasoning script.',
  tool: 'Invokes a simulated tool; outputs are deterministic per invocation.',
  memory: 'Reads from or writes to the memory store with salience-based eviction.',
  observation: 'Consumes the next observation from a named environment channel.',
  decision: 'Routes execution along a labelled branch based on a metric.',
  evaluator: 'Scores the run so far and routes to a pass or fail branch.',
  reflection: 'Records a critique and retries, until max retries raises an error.',
  response: 'Emits the final answer and stops the run.',
}

export function createInitialState(): ExecutionState {
  return {
    status: 'idle',
    stepIndex: 0,
    currentNodeId: null,
    context: {
      goal: '',
      plan: [],
      reasoning: [],
      observations: [],
      memory: [],
      toolCalls: [],
      retrieval: null,
      critiques: [],
      retries: 0,
      errors: [],
      finalAnswer: null,
      decision: 'continue',
      successScore: 0,
      nodeVisits: {},
    },
    trace: [],
    haltReason: null,
  }
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function validateGraph(graph: WorkflowGraph): GraphValidation {
  const issues: ValidationIssue[] = []
  const ids = new Set(graph.nodes.map((node) => node.id))

  if (graph.nodes.length === 0) {
    issues.push({ severity: 'error', message: 'The workflow is empty. Add at least an input node and a final response.' })
  }

  const inputs = graph.nodes.filter((node) => node.kind === 'input')
  const responses = graph.nodes.filter((node) => node.kind === 'response')

  if (inputs.length === 0) {
    issues.push({ severity: 'error', message: 'No user input node: the agent has no goal to work from.' })
  }
  if (inputs.length > 1) {
    issues.push({ severity: 'warning', message: 'More than one input node: only the first is used as the entry point.' })
  }
  if (responses.length === 0) {
    issues.push({ severity: 'error', message: 'No final response node: the workflow can never produce an answer.' })
  }

  for (const edge of graph.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      issues.push({ severity: 'error', message: `Edge ${edge.id} references a missing node.` })
    }
    if (edge.source === edge.target) {
      issues.push({ severity: 'warning', message: `Edge ${edge.id} is a self-loop; the node will re-execute until the budget is spent.` })
    }
  }

  for (const node of graph.nodes) {
    const outgoing = graph.edges.filter((edge) => edge.source === node.id)
    const incoming = graph.edges.filter((edge) => edge.target === node.id)

    if (node.kind !== 'response' && node.kind !== 'input' && outgoing.length === 0) {
      issues.push({ severity: 'error', message: `Node "${node.label}" has no outgoing connection: execution would dead-end.`, nodeId: node.id })
    }
    if (node.kind !== 'input' && incoming.length === 0) {
      issues.push({ severity: 'warning', message: `Node "${node.label}" is unreachable from any other node.`, nodeId: node.id })
    }
    if ((node.kind === 'decision' || node.kind === 'evaluator') && outgoing.length < 2) {
      issues.push({
        severity: 'warning',
        message: `Node "${node.label}" is a branch point with ${outgoing.length} outgoing edge(s); add a second branch so both outcomes are handled.`,
        nodeId: node.id,
      })
    }
    if (node.kind === 'memory') {
      const config = node.config as MemoryConfig
      if (config.capacity < 1) {
        issues.push({ severity: 'error', message: `Memory node "${node.label}" has capacity < 1.`, nodeId: node.id })
      }
      if (config.relevanceWeight < 0 || config.relevanceWeight > 1) {
        issues.push({ severity: 'error', message: `Memory node "${node.label}" relevanceWeight must be between 0 and 1.`, nodeId: node.id })
      }
    }
    if (node.kind === 'reflection' && (node.config as ReflectionConfig).maxRetries < 1) {
      issues.push({ severity: 'warning', message: `Reflection node "${node.label}" has maxRetries < 1, so it can never retry.`, nodeId: node.id })
    }
  }

  return { ok: !issues.some((issue) => issue.severity === 'error'), issues }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function findEntry(graph: WorkflowGraph): WorkflowNode | undefined {
  return graph.nodes.find((node) => node.kind === 'input') ?? graph.nodes[0]
}

function outgoing(graph: WorkflowGraph, nodeId: string): WorkflowEdge[] {
  return graph.edges.filter((edge) => edge.source === nodeId)
}

function pickEdge(edges: WorkflowEdge[], branch: 'yes' | 'no' | 'pass' | 'fail' | 'default'): WorkflowEdge | undefined {
  const exact = edges.find((edge) => (edge.branch ?? 'default') === branch)
  if (exact) return exact
  // Fall back to an unlabelled edge so partially-labelled graphs still run.
  const fallback = edges.find((edge) => !edge.branch || edge.branch === 'default')
  return fallback ?? edges[0]
}

function substitute(template: string, state: ExecutionState): string {
  return template
    .replace(/\{goal\}/g, state.context.goal)
    .replace(/\{observationCount\}/g, String(state.context.observations.length))
    .replace(/\{toolCallCount\}/g, String(state.context.toolCalls.length))
}

export function scoreRun(state: ExecutionState, scenario: WorkflowScenario): number {
  const total = Math.max(1, scenario.successCriteria.length)
  let satisfied = 0
  for (const criterion of scenario.successCriteria) {
    if (criterion.requiredTool) {
      const call = state.context.toolCalls.find((record) => record.toolId === criterion.requiredTool && record.ok)
      if (call) satisfied += 1
      continue
    }
    if (criterion.requiredChannel) {
      const observed = state.context.observations.some((observation) => observation.channel === criterion.requiredChannel)
      if (observed) satisfied += 1
      continue
    }
    if (criterion.requiresSubstring) {
      const answer = state.context.finalAnswer ?? ''
      if (answer.toLowerCase().includes(criterion.requiresSubstring.toLowerCase())) satisfied += 1
      continue
    }
  }
  const base = satisfied / total
  const errorPenalty = Math.min(0.3, state.context.errors.length * 0.1)
  const stepPenalty = state.trace.length > scenario.stepBudget ? 0.2 : 0
  return Math.max(0, Math.round((base - errorPenalty - stepPenalty) * 100) / 100)
}

function memoryScore(item: MemoryItem, query: string, relevanceWeight: number, now: number): number {
  const queryTerms = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  const haystack = `${item.content} ${item.keywords.join(' ')}`.toLowerCase()
  const matches = queryTerms.filter((term) => haystack.includes(term)).length
  const overlap = queryTerms.length === 0 ? 0 : matches / queryTerms.length
  const age = Math.max(0, now - item.addedAt)
  const recency = 1 / (1 + age)
  return Math.round((relevanceWeight * overlap + (1 - relevanceWeight) * recency) * 1000) / 1000
}

function evict(memory: MemoryItem[], capacity: number): MemoryItem[] {
  if (memory.length <= capacity) return memory
  return [...memory].sort((a, b) => b.salience - a.salience).slice(0, capacity)
}

/* ------------------------------------------------------------------ */
/* Node executors                                                      */
/* ------------------------------------------------------------------ */

interface NodeResult {
  summary: string
  detail: string
  status: 'ok' | 'warn' | 'error'
  branch?: 'yes' | 'no' | 'pass' | 'fail' | 'default'
  emitted?: string[]
  /** Mutates a copy of the context (the engine owns immutability). */
  mutate: (context: ExecutionContext) => void
  /** When set, the engine halts with this reason. */
  halt?: string
}

function executeNode(node: WorkflowNode, state: ExecutionState, scenario: WorkflowScenario): NodeResult {
  const context = state.context

  switch (node.kind) {
    case 'input': {
      const config = node.config as InputConfig
      const goal = substitute(config.goalTemplate, state) || scenario.goal
      return {
        summary: `Goal accepted: ${goal}`,
        detail: 'The harness seeds the execution context with the user goal. Nothing is planned yet.',
        status: 'ok',
        emitted: [goal],
        mutate: (draft) => {
          draft.goal = goal
        },
      }
    }

    case 'planner': {
      const config = node.config as PlannerConfig
      const visit = context.nodeVisits[node.id] ?? 0
      const plan = scenario.planTemplate.slice(0, Math.max(1, config.planSteps))
      const suffix = visit > 0 ? ` (revision ${visit})` : ''
      const memoryNote = config.useMemory && context.retrieval
        ? `Memory consulted: ${context.retrieval.retrieved.length} item(s) retrieved.`
        : config.useMemory
          ? 'Memory flag set, but no memory read has happened yet.'
          : 'Planning without memory.'
      return {
        summary: `Plan drafted with ${plan.length} step(s)${suffix}`,
        detail: `${plan.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\n${memoryNote}`,
        status: config.useMemory && !context.retrieval ? 'warn' : 'ok',
        emitted: plan,
        mutate: (draft) => {
          draft.plan = plan
        },
      }
    }

    case 'reasoning': {
      const config = node.config as ReasoningConfig
      const visit = context.nodeVisits[node.id] ?? 0
      const notes: string[] = []
      for (let i = 0; i < Math.max(1, config.depth); i += 1) {
        const note = scenario.reasoningNotes[(visit + i) % scenario.reasoningNotes.length]
        notes.push(note)
      }
      return {
        summary: `Reasoning step: ${notes[notes.length - 1]}`,
        detail: notes.map((note, index) => `Thought ${index + 1}: ${note}`).join('\n'),
        status: 'ok',
        emitted: notes,
        mutate: (draft) => {
          draft.reasoning.push(...notes)
        },
      }
    }

    case 'tool': {
      const config = node.config as ToolConfig
      const tool = scenario.tools.find((candidate) => candidate.id === config.toolId)
      if (!tool) {
        return {
          summary: `Tool "${config.toolId}" is not available in this scenario`,
          detail: `Available tools: ${scenario.tools.map((candidate) => candidate.id).join(', ')}. Fix the tool node configuration or choose another scenario.`,
          status: 'error',
          halt: `Unknown tool: ${config.toolId}`,
          mutate: (draft) => {
            draft.errors.push(`Unknown tool: ${config.toolId}`)
          },
        }
      }

      const callIndex = context.toolCalls.filter((record) => record.toolId === tool.id).length
      const scripted = tool.outputs[callIndex] ?? tool.outputs[tool.outputs.length - 1]
      const ok = tool.broken ? false : (scripted?.ok ?? false)
      const output = tool.broken ? 'Tool error: service unavailable (deterministic failure scenario).' : scripted?.value ?? 'No output scripted.'
      const args = Object.fromEntries(Object.entries(config.args).map(([key, value]) => [key, substitute(value, state)]))

      return {
        summary: ok ? `${tool.name} returned a result` : `${tool.name} failed`,
        detail: `Input: ${JSON.stringify(args)}\nOutput: ${output}${
          ok ? '' : '\n\nReactive error handling: the harness records this failure as an observation so the agent can retry, re-argue, or report the limitation.'
        }`,
        status: ok ? 'ok' : 'warn',
        emitted: [output],
        mutate: (draft) => {
          draft.toolCalls.push({
            callIndex,
            toolId: tool.id,
            toolName: tool.name,
            args,
            ok,
            output,
            nodeId: node.id,
          })
          if (!ok) draft.errors.push(`${tool.name} failed`)
        },
      }
    }

    case 'memory': {
      const config = node.config as MemoryConfig
      const query = substitute(config.query, state)
      const now = context.memory.length
      const store = config.mode === 'write' ? context.memory : context.memory.length > 0 ? context.memory : scenario.initialMemory

      if (config.mode === 'write') {
        const content = context.observations.at(-1)?.content ?? context.reasoning.at(-1) ?? 'No content available to store.'
        const item: MemoryItem = {
          id: `m-${now}-${node.id}`,
          content,
          keywords: query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
          salience: 1,
          addedAt: now,
        }
        const next = evict([...context.memory, item], config.capacity)
        const evicted = context.memory.length + 1 - next.length
        return {
          summary: `Stored memory item (capacity ${config.capacity})`,
          detail: `Item: "${content}"\nStore size after write: ${next.length}${
            evicted > 0 ? `\nEvicted ${evicted} lowest-salience item(s) to respect capacity.` : ''
          }`,
          status: evicted > 0 ? 'warn' : 'ok',
          emitted: [content],
          mutate: (draft) => {
            draft.memory = next
          },
        }
      }

      const scored = store
        .map((item) => ({ item, score: memoryScore(item, query, config.relevanceWeight, now) }))
        .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
      const retrieved = scored.slice(0, Math.min(config.capacity, scored.length)).map((entry) => entry.item)
      if (config.mode === 'read-write') {
        const content = retrieved[0]?.content ?? 'Nothing relevant in memory.'
        return {
          summary: `Read ${retrieved.length} item(s), then wrote a summary`,
          detail: `Query: "${query}"\nRetrieved: ${retrieved.length}\nWritten: "${content.slice(0, 80)}${content.length > 80 ? '…' : ''}"`,
          status: 'ok',
          emitted: retrieved.map((item) => item.content),
          mutate: (draft) => {
            draft.retrieval = buildRetrievalRecord(query, retrieved, scored)
            draft.memory = evict(
              [...draft.memory, { ...retrieved[0], id: `m-summary-${node.id}-${now}`, content, salience: 0.5 }],
              config.capacity,
            )
          },
        }
      }

      return {
        summary: `Retrieved ${retrieved.length} of ${store.length} memory item(s)`,
        detail:
          `Query: "${query}"\nRelevance weight: ${config.relevanceWeight.toFixed(2)} (1.0 = keyword overlap, 0.0 = recency)\n\n` +
          scored
            .map((entry) => `${entry.score.toFixed(3)}  ${retrieved.includes(entry.item) ? '[kept]  ' : '[omitted]'} ${entry.item.content}`)
            .join('\n'),
        status: retrieved.length === 0 ? 'warn' : 'ok',
        emitted: retrieved.map((item) => item.content),
        mutate: (draft) => {
          draft.retrieval = buildRetrievalRecord(query, retrieved, scored)
        },
      }
    }

    case 'observation': {
      const config = node.config as ObservationConfig
      const used = new Set(context.observations.map((observation) => `${observation.channel}:${observation.content}`))
      const candidates = scenario.observations.filter(
        (observation) => (config.channel === '*' || observation.channel === config.channel) && !used.has(`${observation.channel}:${observation.content}`),
      )
      const next = candidates[0]
      if (!next) {
        return {
          summary: 'No further observations available on this channel',
          detail: `Channel: ${config.channel}. The environment has no new information for this workflow, so the harness continues with the current context.`,
          status: 'warn',
          mutate: (draft) => {
            draft.errors.push(`Observation channel exhausted: ${config.channel}`)
          },
        }
      }
      return {
        summary: `Observed (${next.channel}): ${next.content}`,
        detail: `Channel: ${next.channel}\nContent: ${next.content}\n\nThe observation is appended to the context as data. Observations are never instructions.`,
        status: 'ok',
        emitted: [next.content],
        mutate: (draft) => {
          draft.observations.push(next)
        },
      }
    }

    case 'decision': {
      const config = node.config as DecisionConfig
      const score = scoreRun(state, scenario)
      const errors = context.errors.length
      const value = config.metric === 'success-score' ? score : config.metric === 'error-count' ? errors : state.trace.length
      const pass =
        config.operator === '>=' ? value >= config.threshold : config.operator === '<=' ? value <= config.threshold : value > config.threshold
      return {
        summary: `Decision ${config.metric} ${config.operator} ${config.threshold} → ${value} → ${pass ? 'yes' : 'no'}`,
        detail: `Metric: ${config.metric}\nObserved value: ${value}\nBranch taken: ${pass ? 'yes' : 'no'}`,
        status: 'ok',
        branch: pass ? 'yes' : 'no',
        mutate: (draft) => {
          draft.decision = pass ? 'stop' : 'continue'
        },
      }
    }

    case 'evaluator': {
      const config = node.kind === 'evaluator' ? (node.config as EvaluatorConfig) : (node.config as EvaluatorConfig)
      const score = scoreRun(state, scenario)
      const pass = score >= config.passThreshold
      return {
        summary: `Evaluator scored the run ${score.toFixed(2)} (threshold ${config.passThreshold}) → ${pass ? 'pass' : 'fail'}`,
        detail: `Success score: ${score.toFixed(2)}\nPass threshold: ${config.passThreshold}\nOutstanding criteria:\n${scenario.successCriteria
          .map((criterion) => `- ${criterion.description}`)
          .join('\n')}`,
        status: pass ? 'ok' : 'warn',
        branch: pass ? 'pass' : 'fail',
        mutate: (draft) => {
          draft.successScore = score
        },
      }
    }

    case 'reflection': {
      const config = node.config as ReflectionConfig
      const attempt = context.retries + 1
      if (attempt > config.maxRetries) {
        return {
          summary: `Reflection budget exhausted after ${config.maxRetries} attempt(s)`,
          detail:
            'The agent has retried as many times as this reflection node allows. The harness halts instead of looping forever — an explicit failure state is better than an unbounded loop.',
          status: 'error',
          halt: `Reflection retry budget exhausted (${config.maxRetries})`,
          mutate: (draft) => {
            draft.errors.push('Reflection retry budget exhausted')
          },
        }
      }
      const critique = `Attempt ${attempt}: the plan did not satisfy the success criteria. Revise the approach before retrying.`
      return {
        summary: `Reflection recorded (attempt ${attempt}/${config.maxRetries})`,
        detail: `${critique}\n\nReflection is a harness pattern: the same model is called with a critique prompt, and the critique is fed back into the next planning step.`,
        status: 'warn',
        emitted: [critique],
        mutate: (draft) => {
          draft.retries = attempt
          draft.critiques.push(critique)
        },
      }
    }

    case 'response': {
      const config = node.config as ResponseConfig
      // Score with the prospective answer in place: criteria that inspect the
      // final answer (e.g. "names the capital") must be evaluated after it exists.
      const preliminary = substitute(config.template, state)
        .replace(/\{observations\}/g, String(context.observations.length))
        .replace(/\{score\}/g, '—')
        .replace(/\{steps\}/g, String(state.trace.length + 1))
      const score = scoreRun({ ...state, context: { ...context, finalAnswer: preliminary } }, scenario)
      const answer = substitute(config.template, state)
        .replace(/\{observations\}/g, String(context.observations.length))
        .replace(/\{score\}/g, score.toFixed(2))
        .replace(/\{steps\}/g, String(state.trace.length + 1))
      return {
        summary: 'Final response emitted',
        detail: answer,
        status: score > 0 ? 'ok' : 'warn',
        emitted: [answer],
        mutate: (draft) => {
          draft.finalAnswer = answer
          draft.successScore = score
          draft.decision = 'stop'
        },
      }
    }

    default: {
      return {
        summary: `Unsupported node kind: ${String(node.kind)}`,
        detail: 'The engine does not recognise this node kind and halts.',
        status: 'error',
        halt: `Unsupported node kind: ${String(node.kind)}`,
        mutate: () => {},
      }
    }
  }
}

function buildRetrievalRecord(
  query: string,
  retrieved: MemoryItem[],
  scored: { item: MemoryItem; score: number }[],
): RetrievalRecord {
  return {
    query,
    retrieved,
    omitted: scored.filter((entry) => !retrieved.includes(entry.item)).map((entry) => entry.item),
    scores: scored.map((entry) => ({ id: entry.item.id, score: entry.score })),
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function startRun(graph: WorkflowGraph, scenario: WorkflowScenario): ExecutionState {
  const validation = validateGraph(graph)
  if (!validation.ok) {
    return {
      ...createInitialState(),
      status: 'error',
      haltReason: validation.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join(' '),
    }
  }
  const entry = findEntry(graph)
  if (!entry) {
    return { ...createInitialState(), status: 'error', haltReason: 'No entry node found.' }
  }
  return {
    ...createInitialState(),
    status: 'running',
    currentNodeId: entry.id,
    context: { ...createInitialState().context, memory: scenario.initialMemory.map((item) => ({ ...item })) },
  }
}

/**
 * Execute exactly one node. Deterministic: identical inputs always produce an
 * identical output, including step records and scoring.
 */
export function stepOnce(state: ExecutionState, graph: WorkflowGraph, scenario: WorkflowScenario): ExecutionState {
  if (state.status !== 'running' && state.status !== 'paused') {
    return state
  }
  const node = graph.nodes.find((candidate) => candidate.id === state.currentNodeId)
  if (!node) {
    return {
      ...state,
      status: 'error',
      haltReason: state.currentNodeId ? `Current node ${state.currentNodeId} is missing from the graph.` : 'No current node.',
    }
  }

  if (state.trace.length >= scenario.stepBudget && node.kind !== 'response') {
    return {
      ...state,
      status: 'halted',
      haltReason: `Step budget of ${scenario.stepBudget} exhausted before reaching a final response.`,
    }
  }

  const contextDraft: ExecutionContext = {
    ...state.context,
    plan: [...state.context.plan],
    reasoning: [...state.context.reasoning],
    observations: [...state.context.observations],
    memory: state.context.memory.map((item) => ({ ...item })),
    toolCalls: [...state.context.toolCalls],
    critiques: [...state.context.critiques],
    errors: [...state.context.errors],
    nodeVisits: { ...state.context.nodeVisits },
  }

  const result = executeNode(node, state, scenario)
  result.mutate(contextDraft)
  contextDraft.nodeVisits[node.id] = (contextDraft.nodeVisits[node.id] ?? 0) + 1

  const step: StepRecord = {
    index: state.trace.length,
    nodeId: node.id,
    nodeKind: node.kind,
    label: node.label,
    summary: result.summary,
    detail: result.detail,
    status: result.status,
    branch: result.branch,
    emitted: result.emitted,
  }

  const trace = [...state.trace, step]
  const base: ExecutionState = {
    ...state,
    status: 'running',
    stepIndex: trace.length,
    context: contextDraft,
    trace,
  }

  if (result.halt) {
    return { ...base, status: 'error', haltReason: result.halt, currentNodeId: node.id }
  }

  if (node.kind === 'response') {
    return { ...base, status: 'done', haltReason: null, currentNodeId: node.id }
  }

  const edges = outgoing(graph, node.id)
  if (edges.length === 0) {
    return {
      ...base,
      status: 'error',
      haltReason: `Dead end: "${node.label}" has no outgoing connection.`,
    }
  }

  const branch = result.branch ?? 'default'
  const edge = pickEdge(edges, branch)
  if (!edge) {
    return { ...base, status: 'error', haltReason: `No outgoing edge matched branch "${branch}".` }
  }

  return { ...base, currentNodeId: edge.target }
}

export function runToCompletion(
  graph: WorkflowGraph,
  scenario: WorkflowScenario,
  maxSteps = 200,
): ExecutionState {
  let state = startRun(graph, scenario)
  let guard = 0
  while ((state.status === 'running' || state.status === 'paused') && guard < maxSteps) {
    state = stepOnce(state, graph, scenario)
    guard += 1
  }
  return guard >= maxSteps ? { ...state, status: 'halted', haltReason: 'Safety guard reached: workflow did not terminate.' } : state
}

export function resetRun(): ExecutionState {
  return createInitialState()
}

export function pauseRun(state: ExecutionState): ExecutionState {
  return state.status === 'running' ? { ...state, status: 'paused' } : state
}

export function resumeRun(state: ExecutionState): ExecutionState {
  return state.status === 'paused' ? { ...state, status: 'running' } : state
}

/** Node-visit histogram used by the trace panel and tests. */
export function nodeVisitSummary(state: ExecutionState): { nodeId: string; visits: number }[] {
  return Object.entries(state.context.nodeVisits)
    .map(([nodeId, visits]) => ({ nodeId, visits }))
    .sort((a, b) => b.visits - a.visits)
}
