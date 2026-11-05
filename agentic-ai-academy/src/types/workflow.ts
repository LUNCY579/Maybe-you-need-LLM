/**
 * Types for the Visual Agent Workflow Builder.
 *
 * The builder is a *deterministic simulator*: it executes typed nodes against a
 * scripted scenario, not a live model. Every field the engine reads is declared
 * here so that executions are reproducible and testable.
 */

export type NodeKind =
  | 'input'
  | 'planner'
  | 'reasoning'
  | 'tool'
  | 'memory'
  | 'observation'
  | 'decision'
  | 'evaluator'
  | 'reflection'
  | 'response'

export interface InputConfig {
  /** Goal text; {goal} is substituted from the scenario. */
  goalTemplate: string
}

export interface PlannerConfig {
  /** Number of plan steps the planner emits per call. */
  planSteps: number
  /** When true the planner consults memory output before planning. */
  useMemory: boolean
}

export interface ReasoningConfig {
  /** Reasoning depth: how many inference steps are recorded per visit. */
  depth: number
}

export interface ToolConfig {
  toolId: string
  /** Static arguments; {goal} and {observationCount} are substituted. */
  args: Record<string, string>
}

export type MemoryMode = 'read' | 'write' | 'read-write'

export interface MemoryConfig {
  mode: MemoryMode
  /** Maximum number of items retained (write mode evicts lowest salience). */
  capacity: number
  /** Query text used for retrieval scoring; {goal} is substituted. */
  query: string
  /** Weight of keyword overlap vs. recency in the retrieval score (0..1). */
  relevanceWeight: number
}

export interface ObservationConfig {
  /** Which channel of the scenario to read; '*' consumes the next unread one. */
  channel: string
}

export interface DecisionConfig {
  /** Router: 'success' routes yes when the score threshold is met. */
  metric: 'success-score' | 'error-count' | 'step-count'
  operator: '>=' | '<=' | '>'
  threshold: number
}

export interface EvaluatorConfig {
  /** Minimum success score that counts as a pass. */
  passThreshold: number
}

export interface ReflectionConfig {
  /** Maximum reflection attempts before the node raises an error. */
  maxRetries: number
}

export interface ResponseConfig {
  /** Template for the final answer; {observations} and {score} are substituted. */
  template: string
}

export type NodeConfig =
  | InputConfig
  | PlannerConfig
  | ReasoningConfig
  | ToolConfig
  | MemoryConfig
  | ObservationConfig
  | DecisionConfig
  | EvaluatorConfig
  | ReflectionConfig
  | ResponseConfig

export interface WorkflowNode {
  id: string
  kind: NodeKind
  label: string
  position: { x: number; y: number }
  config: NodeConfig
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  /** Decision/evaluator branch handle: 'yes' | 'no' | 'pass' | 'fail'. */
  branch?: 'yes' | 'no' | 'pass' | 'fail' | 'default'
  /** Optional editor hints; ignored by the execution engine. */
  sourceHandle?: string
  targetHandle?: string
}

export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

/** A scripted capability the simulator may call. */
export interface SimTool {
  id: string
  name: string
  description: string
  /** Deterministic outputs keyed by invocation index (0-based). */
  outputs: { ok: boolean; value: string }[]
  /** When true, every invocation fails (used for error-state teaching). */
  broken?: boolean
}

export interface MemoryItem {
  id: string
  content: string
  keywords: string[]
  /** Higher = more salient when eviction is required. */
  salience: number
  /** Order of insertion; used for recency scoring. */
  addedAt: number
}

export interface ScenarioObservation {
  channel: string
  content: string
}

export interface SuccessCriterion {
  id: string
  description: string
  /** Satisfied when the criterion's tool has produced a successful call. */
  requiredTool?: string
  /** Satisfied when an observation from this channel has been recorded. */
  requiredChannel?: string
  /** Satisfied when the final answer contains this substring. */
  requiresSubstring?: string
}

export interface WorkflowScenario {
  id: string
  title: string
  description: string
  goal: string
  /** Deterministic plan considered "the good plan" for this scenario. */
  planTemplate: string[]
  reasoningNotes: string[]
  tools: SimTool[]
  initialMemory: MemoryItem[]
  observations: ScenarioObservation[]
  successCriteria: SuccessCriterion[]
  /** Maximum steps before the run is stopped as over budget. */
  stepBudget: number
  /** Node ids that are expected to be part of the reference solution. */
  referencePath: string[]
}

export interface ToolCallRecord {
  callIndex: number
  toolId: string
  toolName: string
  args: Record<string, string>
  ok: boolean
  output: string
  nodeId: string
}

export interface RetrievalRecord {
  query: string
  retrieved: MemoryItem[]
  omitted: MemoryItem[]
  scores: { id: string; score: number }[]
}

export interface ExecutionContext {
  goal: string
  plan: string[]
  reasoning: string[]
  observations: { channel: string; content: string }[]
  memory: MemoryItem[]
  toolCalls: ToolCallRecord[]
  retrieval: RetrievalRecord | null
  critiques: string[]
  retries: number
  errors: string[]
  finalAnswer: string | null
  decision: 'continue' | 'stop'
  successScore: number
  nodeVisits: Record<string, number>
}

export type StepStatus = 'ok' | 'warn' | 'error'

export interface StepRecord {
  index: number
  nodeId: string
  nodeKind: NodeKind
  label: string
  summary: string
  detail: string
  status: StepStatus
  /** Branch taken when the node is a decision/evaluator. */
  branch?: 'yes' | 'no' | 'pass' | 'fail' | 'default'
  emitted?: string[]
}

export type RunStatus = 'idle' | 'running' | 'paused' | 'done' | 'halted' | 'error'

export interface ExecutionState {
  status: RunStatus
  stepIndex: number
  currentNodeId: string | null
  context: ExecutionContext
  trace: StepRecord[]
  /** Set when status is 'error' or 'halted'. */
  haltReason: string | null
}

export interface ValidationIssue {
  severity: 'error' | 'warning'
  message: string
  nodeId?: string
}

export interface GraphValidation {
  ok: boolean
  issues: ValidationIssue[]
}
