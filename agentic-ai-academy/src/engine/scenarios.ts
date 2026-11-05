/**
 * Predefined learning scenarios for the workflow builder.
 *
 * Each scenario pairs a scripted environment (tools, observations, memory,
 * success criteria) with a reference graph. Learners can edit the graph,
 * rewire the branches and watch the deterministic engine react.
 */

import type { WorkflowEdge, WorkflowGraph, WorkflowNode, WorkflowScenario } from '../types/workflow'

const node = (
  id: string,
  kind: WorkflowNode['kind'],
  label: string,
  x: number,
  y: number,
  config: WorkflowNode['config'],
): WorkflowNode => ({ id, kind, label, position: { x, y }, config })

const edge = (source: string, target: string, branch?: WorkflowEdge['branch']): WorkflowEdge => ({
  id: `${source}->${target}${branch ? `:${branch}` : ''}`,
  source,
  target,
  branch,
})

/* ------------------------------------------------------------------ */
/* 1. ReAct tool use                                                   */
/* ------------------------------------------------------------------ */

export const scenarioToolUse: WorkflowScenario = {
  id: 'react-tool-use',
  title: 'ReAct tool use',
  description:
    'A minimal reason–act–observe loop. The planner drafts a plan, the agent calls a calculator tool, observes the result and answers. Add the reflection branch to see recovery from a failed call.',
  goal: 'Determine whether 8191 is prime and report the answer with the tool output.',
  planTemplate: [
    'Understand the goal and identify the needed capability',
    'Call the primality tool with the candidate number',
    'Read the tool output and verify it answers the question',
    'Compose a final answer that cites the tool result',
  ],
  reasoningNotes: [
    'The goal needs exact arithmetic, so a deterministic tool is more reliable than estimation.',
    'A single tool call answers the question if the tool returns a verdict.',
    'I should quote the tool output rather than paraphrase it.',
  ],
  tools: [
    {
      id: 'primality',
      name: 'is_prime',
      description: 'Checks whether an integer is prime. Input: number.',
      outputs: [
        { ok: true, value: 'is_prime(8191) = True (8191 is a Mersenne prime, 2^13 - 1).' },
        { ok: true, value: 'is_prime(8191) = True' },
      ],
    },
    {
      id: 'flaky_search',
      name: 'search_corpus',
      description: 'Searches an external corpus. Deterministically unavailable in this scenario.',
      outputs: [{ ok: false, value: 'HTTP 503 Service Unavailable' }],
      broken: true,
    },
  ],
  initialMemory: [
    {
      id: 'mem-tool-doc',
      content: 'Tool documentation: is_prime(number: int) returns True or False.',
      keywords: ['tool', 'prime', 'documentation'],
      salience: 0.6,
      addedAt: 0,
    },
  ],
  observations: [
    { channel: 'tool', content: 'Tool returned: is_prime(8191) = True.' },
    { channel: 'environment', content: 'No further environment checks are required for this goal.' },
  ],
  successCriteria: [
    { id: 'used-tool', description: 'The agent called is_prime successfully.', requiredTool: 'primality' },
    { id: 'answered', description: 'The final answer reports the verdict.', requiresSubstring: 'prime' },
  ],
  stepBudget: 20,
  referencePath: ['input', 'planner', 'tool', 'observation', 'reasoning', 'response'],
}

export const graphToolUse: WorkflowGraph = {
  nodes: [
    node('input', 'input', 'User input', 0, 0, { goalTemplate: '{goal}' }),
    node('planner', 'planner', 'Planner', 230, 0, { planSteps: 4, useMemory: false }),
    node('tool', 'tool', 'Tool call: is_prime', 460, 0, { toolId: 'primality', args: { number: '8191' } }),
    node('observation', 'observation', 'Observation', 460, 150, { channel: 'tool' }),
    node('reasoning', 'reasoning', 'Reasoning step', 230, 150, { depth: 1 }),
    node('response', 'response', 'Final response', 0, 150, {
      template: 'Goal: {goal}\nSteps: {steps}; observations: {observations}; score: {score}.\nAnswer: 8191 is prime, confirmed by the is_prime tool.',
    }),
  ],
  edges: [
    edge('input', 'planner'),
    edge('planner', 'tool'),
    edge('tool', 'observation'),
    edge('observation', 'reasoning'),
    edge('reasoning', 'response'),
  ],
}

/* ------------------------------------------------------------------ */
/* 2. Reflective planning loop                                         */
/* ------------------------------------------------------------------ */

export const scenarioReflection: WorkflowScenario = {
  id: 'reflective-loop',
  title: 'Reflective retry loop',
  description:
    'The evaluator fails the first attempt, the reflection node records a critique, and the planner revises. The retry budget makes the loop terminate with an explicit error instead of spinning forever.',
  goal: 'Find the capital of the province of Friesland and answer with a source.',
  planTemplate: [
    'Identify the fact that must be verified and locate the reference tool',
    'Call the reference tool for a citable source',
    'Consume the observation and check the citation is usable',
    'Answer with the citation attached',
  ],
  reasoningNotes: [
    'The reference tool failed the first time, so the run has no citation yet.',
    'The critique says to retry the tool: a transient failure is not a wrong plan.',
    'With the citation in context the evaluator can accept the run.',
  ],
  tools: [
    {
      id: 'reference_lookup',
      name: 'reference_lookup',
      description: 'Looks up an authoritative reference for a fact. First call fails in this scenario.',
      outputs: [
        { ok: false, value: 'HTTP 503 Service Unavailable (transient failure).' },
        { ok: true, value: 'Source: CBS regional handbook (2024), p. 12 — province capital: Leeuwarden.' },
        { ok: true, value: 'Cached source: Leeuwarden (province of Friesland).' },
      ],
    },
  ],
  initialMemory: [],
  observations: [
    { channel: 'reference', content: 'Reference tool response: CBS regional handbook (2024), p. 12.' },
    { channel: 'reference', content: 'Citation verified: source section, page and claim all present.' },
  ],
  successCriteria: [
    { id: 'cited', description: 'A reference lookup succeeded.', requiredTool: 'reference_lookup' },
    { id: 'observation', description: 'The reference observation was consumed.', requiredChannel: 'reference' },
    { id: 'answered', description: 'The answer names the capital.', requiresSubstring: 'Leeuwarden' },
  ],
  stepBudget: 24,
  referencePath: ['input', 'planner', 'evaluator', 'reflection', 'planner', 'tool', 'observation', 'evaluator', 'response'],
}

export const graphReflection: WorkflowGraph = {
  nodes: [
    node('input', 'input', 'User input', 0, 0, { goalTemplate: '{goal}' }),
    node('planner', 'planner', 'Planner', 230, 0, { planSteps: 4, useMemory: false }),
    node('tool', 'tool', 'Tool call: reference', 460, 0, { toolId: 'reference_lookup', args: { fact: '{goal}' } }),
    node('observation', 'observation', 'Observation', 690, 0, { channel: 'reference' }),
    node('evaluator', 'evaluator', 'Evaluator', 690, 150, { passThreshold: 0.5 }),
    node('reflection', 'reflection', 'Reflection', 460, 150, { maxRetries: 2 }),
    node('response', 'response', 'Final response', 920, 150, {
      template: 'Answer: the capital is Leeuwarden, with the source from the reference tool. Score {score} after {steps} steps.',
    }),
  ],
  edges: [
    edge('input', 'planner'),
    edge('planner', 'tool'),
    edge('tool', 'observation'),
    edge('observation', 'evaluator'),
    edge('evaluator', 'response', 'pass'),
    edge('evaluator', 'reflection', 'fail'),
    edge('reflection', 'planner'),
  ],
}

/* ------------------------------------------------------------------ */
/* 3. Memory-augmented assistant                                       */
/* ------------------------------------------------------------------ */

export const scenarioMemory: WorkflowScenario = {
  id: 'memory-assistant',
  title: 'Memory-augmented assistant',
  description:
    'A memory read primes the planner with user preferences, a tool books the seat, and a memory write stores the outcome. Lower the capacity to watch eviction drop the oldest preference.',
  goal: 'Book a window seat for the user on the next train to Utrecht.',
  planTemplate: [
    'Retrieve the user\'s stored seating preference',
    'Call the booking tool with the preference applied',
    'Store the booking outcome in memory for the next session',
    'Confirm the booking to the user',
  ],
  reasoningNotes: [
    'The user prefers a window seat, which the memory read surfaced.',
    'The booking tool needs the seat preference and destination.',
    'Storing the confirmation keeps the next session coherent.',
  ],
  tools: [
    {
      id: 'booking',
      name: 'book_seat',
      description: 'Books a seat. Inputs: destination, seat preference.',
      outputs: [
        { ok: true, value: 'Booking confirmed: Utrecht, window seat 14A, train departs 09:12.' },
      ],
    },
  ],
  initialMemory: [
    {
      id: 'mem-pref-window',
      content: 'User preference: always prefers a window seat for rail travel.',
      keywords: ['window', 'seat', 'preference', 'train'],
      salience: 0.9,
      addedAt: 0,
    },
    {
      id: 'mem-pref-tea',
      content: 'User preference: enjoys a cup of tea before departure and dislikes coffee.',
      keywords: ['tea', 'coffee', 'preference'],
      salience: 0.4,
      addedAt: 1,
    },
    {
      id: 'mem-old-trip',
      content: 'Last month the user travelled to Delft on business and returned the same day.',
      keywords: ['delft', 'business', 'trip'],
      salience: 0.3,
      addedAt: 2,
    },
    {
      id: 'mem-allergy',
      content: 'User has a nut allergy; catering requests must avoid nuts.',
      keywords: ['allergy', 'nut', 'catering'],
      salience: 0.8,
      addedAt: 3,
    },
  ],
  observations: [
    { channel: 'booking', content: 'Booking confirmed: Utrecht, window seat 14A.' },
  ],
  successCriteria: [
    { id: 'booked', description: 'The booking tool succeeded.', requiredTool: 'booking' },
    { id: 'observed', description: 'The booking observation was consumed.', requiredChannel: 'booking' },
    { id: 'answered', description: 'The confirmation names the seat.', requiresSubstring: '14A' },
  ],
  stepBudget: 22,
  referencePath: ['input', 'memory_read', 'planner', 'tool', 'observation', 'memory_write', 'response'],
}

export const graphMemory: WorkflowGraph = {
  nodes: [
    node('input', 'input', 'User input', 0, 0, { goalTemplate: '{goal}' }),
    node('memory_read', 'memory', 'Memory retrieval', 230, 0, {
      mode: 'read',
      capacity: 2,
      query: 'seat preference window train {goal}',
      relevanceWeight: 0.6,
    }),
    node('planner', 'planner', 'Planner', 230, 150, { planSteps: 4, useMemory: true }),
    node('tool', 'tool', 'Tool call: book_seat', 460, 150, { toolId: 'booking', args: { destination: 'Utrecht', seat: 'window' } }),
    node('observation', 'observation', 'Observation', 690, 150, { channel: 'booking' }),
    node('memory_write', 'memory', 'Memory write', 690, 0, {
      mode: 'write',
      capacity: 4,
      query: 'booking confirmation utrecht',
      relevanceWeight: 0.5,
    }),
    node('response', 'response', 'Final response', 920, 0, {
      template: 'Booked your seat: window seat 14A on the 09:12 to Utrecht. Score {score}; steps {steps}.',
    }),
  ],
  edges: [
    edge('input', 'memory_read'),
    edge('memory_read', 'planner'),
    edge('planner', 'tool'),
    edge('tool', 'observation'),
    edge('observation', 'memory_write'),
    edge('memory_write', 'response'),
  ],
}

/* ------------------------------------------------------------------ */
/* 4. Broken pipeline (error-state teaching)                           */
/* ------------------------------------------------------------------ */

export const scenarioBrokenPipeline: WorkflowScenario = {
  id: 'broken-pipeline',
  title: 'Broken pipeline (error states)',
  description:
    'The tool is deterministically unavailable and reflection only has one retry, so the run ends in an explicit error state with a full trace. Use this scenario to see why bounded retries and error observations matter.',
  goal: 'Summarise the latest policy document using the corpus search tool.',
  planTemplate: [
    'Search the corpus for the policy document',
    'Read the top result',
    'Summarise the result for the user',
  ],
  reasoningNotes: [
    'The search tool is the only route to the document.',
    'If search fails I should retry once, then report the limitation honestly.',
  ],
  tools: [
    {
      id: 'flaky_search',
      name: 'search_corpus',
      description: 'Corpus search; degraded in this scenario.',
      outputs: [{ ok: false, value: 'HTTP 503 Service Unavailable (simulated outage).' }],
      broken: true,
    },
  ],
  initialMemory: [],
  observations: [],
  successCriteria: [{ id: 'search', description: 'The search tool succeeded (impossible in this scenario).', requiredTool: 'flaky_search' }],
  stepBudget: 14,
  referencePath: ['input', 'planner', 'tool', 'observation', 'reflection', 'planner', 'tool', 'observation', 'evaluator'],
}

export const graphBrokenPipeline: WorkflowGraph = {
  nodes: [
    node('input', 'input', 'User input', 0, 0, { goalTemplate: '{goal}' }),
    node('planner', 'planner', 'Planner', 230, 0, { planSteps: 3, useMemory: false }),
    node('tool', 'tool', 'Tool call: search_corpus', 460, 0, { toolId: 'flaky_search', args: { query: '{goal}' } }),
    node('observation', 'observation', 'Observation', 690, 0, { channel: 'environment' }),
    node('evaluator', 'evaluator', 'Evaluator', 690, 150, { passThreshold: 0.5 }),
    node('reflection', 'reflection', 'Reflection', 460, 150, { maxRetries: 1 }),
    // Declared so the graph is structurally complete. It is never reached in this
    // scenario because the tool can never succeed — which is the point.
    node('response', 'response', 'Final response (unreachable)', 920, 150, {
      template: 'Summary produced from the retrieved policy document. Score {score} after {steps} steps.',
    }),
  ],
  edges: [
    edge('input', 'planner'),
    edge('planner', 'tool'),
    edge('tool', 'observation'),
    edge('observation', 'evaluator'),
    edge('evaluator', 'response', 'pass'),
    edge('evaluator', 'reflection', 'fail'),
    edge('reflection', 'planner'),
  ],
}

export interface BuilderScenario {
  scenario: WorkflowScenario
  graph: WorkflowGraph
  /** Short teaching note shown in the scenario picker. */
  focus: string
}

export const BUILDER_SCENARIOS: BuilderScenario[] = [
  { scenario: scenarioToolUse, graph: graphToolUse, focus: 'Reason → act → observe, with tool input/output inspection.' },
  { scenario: scenarioReflection, graph: graphReflection, focus: 'Evaluator-driven retry loop and branch routing.' },
  { scenario: scenarioMemory, graph: graphMemory, focus: 'Memory retrieval, relevance weighting and eviction.' },
  { scenario: scenarioBrokenPipeline, graph: graphBrokenPipeline, focus: 'Deterministic failure, bounded retries, explicit error state.' },
]

export function scenarioById(id: string): BuilderScenario | undefined {
  return BUILDER_SCENARIOS.find((entry) => entry.scenario.id === id)
}

/** Deep clone so learner edits never mutate the predefined graphs. */
export function cloneGraph(graph: WorkflowGraph): WorkflowGraph {
  return {
    nodes: graph.nodes.map((candidate) => ({ ...candidate, position: { ...candidate.position }, config: { ...candidate.config } })),
    edges: graph.edges.map((candidate) => ({ ...candidate })),
  }
}
