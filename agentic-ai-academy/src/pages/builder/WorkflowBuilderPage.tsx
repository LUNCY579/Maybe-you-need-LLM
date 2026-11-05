import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import { AgentNode, type AgentNodeData } from '../../ui/builder/nodes'
import { JsonObjectEditor } from '../../ui/builder/JsonObjectEditor'
import { BUILDER_SCENARIOS, cloneGraph, scenarioById } from '../../engine/scenarios'
import {
  NODE_KIND_DESCRIPTIONS,
  NODE_KIND_LABELS,
  pauseRun,
  resetRun,
  resumeRun,
  runToCompletion,
  startRun,
  stepOnce,
  validateGraph,
} from '../../engine/workflow'
import type {
  DecisionConfig,
  EvaluatorConfig,
  ExecutionState,
  InputConfig,
  MemoryConfig,
  NodeConfig,
  NodeKind,
  ObservationConfig,
  PlannerConfig,
  ReasoningConfig,
  ReflectionConfig,
  ResponseConfig,
  ToolConfig,
  WorkflowGraph,
  WorkflowNode,
} from '../../types/workflow'
import { Badge, Button, Card, Field, LiveRegion, Panel, Select, Slider, TabPanel, Tabs, Toggle, cn } from '../../ui/primitives'
import { useProgress } from '../../store/progress'
import { Markdown } from '../../ui/Markdown'

const nodeTypes = { agent: AgentNode }

/** Escape a value for use inside an attribute selector. */
function escapeSelector(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/[^\w-]/g, (character) => `\\${character}`)
}

const KIND_ORDER: NodeKind[] = [
  'input',
  'planner',
  'reasoning',
  'tool',
  'memory',
  'observation',
  'decision',
  'evaluator',
  'reflection',
  'response',
]

function defaultConfig(kind: NodeKind, scenarioId: string): NodeConfig {
  const scenario = scenarioById(scenarioId)?.scenario
  switch (kind) {
    case 'input':
      return { goalTemplate: '{goal}' } satisfies InputConfig
    case 'planner':
      return { planSteps: 4, useMemory: false } satisfies PlannerConfig
    case 'reasoning':
      return { depth: 1 } satisfies ReasoningConfig
    case 'tool':
      return { toolId: scenario?.tools[0]?.id ?? 'primality', args: {} } satisfies ToolConfig
    case 'memory':
      return { mode: 'read', capacity: 3, query: '{goal}', relevanceWeight: 0.6 } satisfies MemoryConfig
    case 'observation':
      return { channel: '*' } satisfies ObservationConfig
    case 'decision':
      return { metric: 'success-score', operator: '>=', threshold: 0.5 } satisfies DecisionConfig
    case 'evaluator':
      return { passThreshold: 0.7 } satisfies EvaluatorConfig
    case 'reflection':
      return { maxRetries: 2 } satisfies ReflectionConfig
    case 'response':
      return { template: 'Final answer for: {goal} (score {score} after {steps} steps).' } satisfies ResponseConfig
    default:
      return { goalTemplate: '{goal}' } satisfies InputConfig
  }
}

function edgeColour(branch: string | undefined): string {
  if (branch === 'fail' || branch === 'no') return '#fb7185'
  if (branch === 'pass' || branch === 'yes') return '#34d399'
  return '#9aa7c7'
}

/**
 * Choose handles from the relative node positions so vertical transitions read
 * as vertical lines instead of long diagonal swoops.
 */
function handlesFor(
  source: WorkflowNode,
  target: WorkflowNode,
): { sourceHandle: string; targetHandle: string } {
  const dy = target.position.y - source.position.y
  if (dy > 60) return { sourceHandle: 'bottom', targetHandle: 'top' }
  if (dy < -60) return { sourceHandle: 'top-source', targetHandle: 'bottom-target' }
  return { sourceHandle: 'right', targetHandle: 'left' }
}

function toReactFlow(graph: WorkflowGraph): { nodes: Node<AgentNodeData>[]; edges: Edge[] } {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: 'agent',
      position: node.position,
      data: { kind: node.kind, label: node.label, config: node.config, status: 'idle', visits: 0 },
    })),
    edges: graph.edges.map((edge) => {
      const source = byId.get(edge.source)
      const target = byId.get(edge.target)
      const handles = source && target ? handlesFor(source, target) : { sourceHandle: 'right', targetHandle: 'left' }
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? handles.sourceHandle,
        targetHandle: edge.targetHandle ?? handles.targetHandle,
        label: edge.branch && edge.branch !== 'default' ? edge.branch : undefined,
        animated: false,
        style: { stroke: edgeColour(edge.branch) },
        labelStyle: { fill: '#9aa7c7', fontSize: 10 },
      }
    }),
  }
}

function toWorkflowGraph(nodes: Node<AgentNodeData>[], edges: Edge[]): WorkflowGraph {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      kind: node.data.kind,
      label: node.data.label,
      position: node.position,
      config: node.data.config,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      branch: (edge.label as 'yes' | 'no' | 'pass' | 'fail' | 'default' | undefined) ?? 'default',
    })),
  }
}

export function WorkflowBuilderPage() {
  const progress = useProgress()
  const [scenarioId, setScenarioId] = useState(BUILDER_SCENARIOS[0].scenario.id)
  const builderScenario = scenarioById(scenarioId) ?? BUILDER_SCENARIOS[0]
  const [initial] = useState(() => toReactFlow(builderScenario.graph))
  const [nodes, setNodes] = useState<Node<AgentNodeData>[]>(initial.nodes)
  const [edges, setEdges] = useState<Edge[]>(initial.edges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [run, setRun] = useState<ExecutionState>(() => resetRun())
  const [panel, setPanel] = useState<'inspector' | 'trace' | 'state' | 'score'>('inspector')
  const [lastScenarioRun, setLastScenarioRun] = useState<string | null>(null)
  const [graphVersion, setGraphVersion] = useState(0)
  /**
   * The node a connection is being made from, while connect mode is on.
   *
   * WCAG 2.5.7 (Dragging Movements, AA) requires a single-pointer
   * alternative to dragging. Clicking the source and then the target is that
   * alternative: two clicks, no press-and-hold, and it works with a pointer,
   * a touch screen, a switch device or a keyboard.
   */
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [connectTarget, setConnectTarget] = useState('')
  const [connectBranch, setConnectBranch] = useState('default')
  const [announcement, setAnnouncement] = useState('')
  const nodeCounter = useRef(1)

  const graph = useMemo(() => toWorkflowGraph(nodes, edges), [nodes, edges])
  const validation = useMemo(() => validateGraph(graph), [graph])

  const decoratedNodes = useMemo(() => {
    const visits: Record<string, number> = {}
    const worst: Record<string, 'ok' | 'warn' | 'error'> = {}
    for (const step of run.trace) {
      visits[step.nodeId] = (visits[step.nodeId] ?? 0) + 1
      if (step.status !== 'ok') worst[step.nodeId] = step.status
      else if (!worst[step.nodeId]) worst[step.nodeId] = 'ok'
    }
    return nodes.map((node): Node<AgentNodeData> => {
      const isCurrent = run.currentNodeId === node.id && (run.status === 'running' || run.status === 'paused')
      const visitsForNode = visits[node.id] ?? 0
      const status: AgentNodeData['status'] = isCurrent ? 'current' : (worst[node.id] ?? (visitsForNode > 0 ? 'ok' : 'idle'))
      return { ...node, data: { ...node.data, status, visits: visitsForNode } }
    })
  }, [nodes, run])

  const decoratedEdges = useMemo(() => {
    const traced = new Set(run.trace.slice(0, -1).map((step, index) => `${step.nodeId}->${run.trace[index + 1]?.nodeId}`))
    return edges.map((edge) => {
      const active = traced.has(`${edge.source}->${edge.target}`)
      return active ? { ...edge, animated: true, style: { ...edge.style, stroke: '#35e6ff' } } : { ...edge, animated: false }
    })
  }, [edges, run])

  const resetGraph = useCallback(
    (id: string) => {
      const target = scenarioById(id)
      if (!target) return
      const converted = toReactFlow(cloneGraph(target.graph))
      setNodes(converted.nodes)
      setEdges(converted.edges)
      setSelectedNodeId(null)
      setRun(resetRun())
      setLastScenarioRun(null)
      // Bump the revision so that editors holding a draft (for example the
      // tool-argument JSON field) are remounted with the restored values.
      setGraphVersion((current) => current + 1)
    },
    [],
  )

  const onNodesChange = useCallback((changes: NodeChange<Node<AgentNodeData>>[]) => {
    setNodes((current) => applyNodeChanges(changes, current))
    // React Flow's own Delete shortcut removes nodes through this handler, so
    // the selection has to be cleared here too — otherwise the inspector
    // would keep pointing at a node that no longer exists.
    if (changes.some((change) => change.type === 'remove')) {
      setSelectedNodeId(null)
    }
  }, [])
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((current) => applyEdgeChanges(changes, current)), [])

  /**
   * Create an edge between two nodes, optionally with a branch label.
   *
   * The handles are computed the same way the dragged connection computes
   * them, so an edge made by clicking attaches to the same handles as an edge
   * made by dragging, and the two are visually identical.
   */
  const connectNodes = useCallback(
    (sourceId: string, targetId: string, branch = 'default') => {
      setEdges((current) => {
        // A second edge between the same pair is legitimate when it carries a
        // different branch label — a decision node may send both 'yes' and
        // 'no' to the same target — so only an exact duplicate is refused.
        if (current.some((edge) => edge.source === sourceId && edge.target === targetId && edge.label === branch)) {
          return current
        }
        const source = nodes.find((node) => node.id === sourceId)
        const target = nodes.find((node) => node.id === targetId)
        if (!source || !target) return current
        const handles = handlesFor(
          { id: sourceId, kind: source.data.kind, label: source.data.label, position: source.position, config: source.data.config },
          { id: targetId, kind: target.data.kind, label: target.data.label, position: target.position, config: target.data.config },
        )
        return [
          ...current,
          {
            id: `${sourceId}->${targetId}-${branch}-${current.length}`,
            source: sourceId,
            target: targetId,
            sourceHandle: handles.sourceHandle,
            targetHandle: handles.targetHandle,
            label: branch,
            style: { stroke: edgeColour(branch) },
            labelStyle: { fill: '#9aa7c7', fontSize: 10 },
          },
        ]
      })
    },
    [nodes],
  )

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `${connection.source}->${connection.target}-${current.length}`,
            label: 'default',
            style: { stroke: '#9aa7c7' },
            labelStyle: { fill: '#9aa7c7', fontSize: 10 },
          },
          current,
        ),
      ),
    [],
  )

  const addNode = (kind: NodeKind) => {
    // A monotonic counter rather than a clock: node ids must be stable and
    // reproducible for a given sequence of edits. The `n<counter>-` prefix
    // keeps generated ids distinct from the scenario's semantic node ids.
    const id = `n${nodeCounter.current++}-${kind}`
    const count = nodes.length
    const newNode: Node<AgentNodeData> = {
      id,
      type: 'agent',
      position: { x: 120 + (count % 4) * 230, y: 120 + Math.floor(count / 4) * 130 },
      data: { kind, label: NODE_KIND_LABELS[kind], config: defaultConfig(kind, scenarioId), status: 'idle', visits: 0 },
    }
    setNodes((current) => [...current, newNode])
    setSelectedNodeId(id)
    setPanel('inspector')
  }

  /**
   * Select a node without touching the canvas.
   *
   * Clicking a node is the only way to open it today, which makes the
   * inspector unreachable for a keyboard user. Selecting from this list is the
   * keyboard path to the same editor, and it also moves focus to the node on
   * the canvas so the two views stay in sync.
   */
  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id)
    // The connection control starts from a clean slate for each node.
    setConnectTarget('')
    if (id) setPanel('inspector')
  }, [])

  /** Move the browser's focus onto the React Flow node for `id`. */
  const focusNodeOnCanvas = useCallback((id: string) => {
    const frame = requestAnimationFrame(() => {
      const selector = `.react-flow__node[data-id="${escapeSelector(id)}"]`
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) return
      element.scrollIntoView({ block: 'nearest' })
      // React Flow marks a focused node with `focused`; focusing the wrapper
      // is enough for the browser to move the tab position there.
      element.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const updateNode = (id: string, patch: Partial<AgentNodeData>) => {
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node)))
  }

  const updateNodeConfig = (id: string, patch: Record<string, unknown>) => {
    setNodes((current) =>
      current.map((node) => (node.id === id ? { ...node, data: { ...node.data, config: { ...node.data.config, ...patch } } } : node)),
    )
  }

  const removeNode = (id: string) => {
    setNodes((current) => current.filter((node) => node.id !== id))
    setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id))
    setSelectedNodeId(null)
  }

  const setEdgeBranch = (edgeId: string, branch: string) => {
    setEdges((current) =>
      current.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              label: branch,
              style: { stroke: branch === 'fail' || branch === 'no' ? '#fb7185' : branch === 'pass' || branch === 'yes' ? '#34d399' : '#9aa7c7' },
            }
          : edge,
      ),
    )
  }

  const control = {
    start: () => {
      const state = startRun(graph, builderScenario.scenario)
      setRun(state)
      if (state.status === 'error' && state.haltReason) {
        progress.recordLab('workflow-builder', 'validation-failed')
      }
    },
    step: () => {
      setRun((current) => {
        const base = current.status === 'idle' ? startRun(graph, builderScenario.scenario) : current
        const next = stepOnce(base, graph, builderScenario.scenario)
        if (next.status === 'done' || next.status === 'error') {
          setLastScenarioRun(next.status)
          progress.recordLab('workflow-builder', `${builderScenario.scenario.id}:${next.status}:score=${(next.context.successScore ?? 0).toFixed(2)}`)
        }
        return next
      })
    },
    run: () => {
      const final = runToCompletion(graph, builderScenario.scenario)
      setRun(final)
      setLastScenarioRun(final.status)
      progress.recordLab('workflow-builder', `${builderScenario.scenario.id}:${final.status}:score=${final.context.successScore.toFixed(2)}`)
    },
    pause: () => setRun((current) => pauseRun(current)),
    resume: () => setRun((current) => resumeRun(current)),
    reset: () => setRun(resetRun()),
  }

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="cyan">Flagship</Badge>
          <Badge tone="neutral">Deterministic simulator</Badge>
          <Badge tone={validation.ok ? 'emerald' : 'rose'}>{validation.ok ? 'graph valid' : 'graph has errors'}</Badge>
          {lastScenarioRun ? <Badge tone={lastScenarioRun === 'done' ? 'emerald' : 'amber'}>last run: {lastScenarioRun}</Badge> : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Visual Agent Workflow Builder</h1>
        <p className="text-muted max-w-3xl text-sm">
          Wire a harness as a graph, then execute it step by step. The engine is deterministic: tool outputs, plans, reasoning notes and memory are
          scripted per scenario, so two runs of the same graph always produce the same trace. This is a teaching simulator — no language model is called.
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)_330px]">
        <div className="space-y-3">
          <Panel title="Scenario" subtitle={builderScenario.focus}>
            <Select
              label="Choose a learning scenario"
              value={scenarioId}
              onChange={(value) => {
                setScenarioId(value)
                resetGraph(value)
              }}
              options={BUILDER_SCENARIOS.map((entry) => ({ value: entry.scenario.id, label: entry.scenario.title }))}
            />
            <p className="text-muted text-xs leading-relaxed">{builderScenario.scenario.description}</p>
            <p className="text-muted text-[11px]">
              Goal: {builderScenario.scenario.goal}
              <br />
              Step budget: {builderScenario.scenario.stepBudget} · success criteria: {builderScenario.scenario.successCriteria.length}
            </p>
            <Button size="sm" onClick={() => resetGraph(scenarioId)}>
              Restore reference graph
            </Button>
          </Panel>

          <Panel title="Add nodes" subtitle="Click to append a node to the canvas.">
            <div className="grid gap-1.5">
              {KIND_ORDER.map((kind) => (
                <button
                  key={kind}
                  onClick={() => addNode(kind)}
                  title={NODE_KIND_DESCRIPTIONS[kind]}
                  className="focus-ring surface-2 flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs"
                  style={{ borderColor: 'var(--border-soft)' }}
                >
                  <span>{NODE_KIND_LABELS[kind]}</span>
                  <span className="text-muted">+</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Validation" subtitle="Structural checks run on every edit.">
            {validation.issues.length === 0 ? (
              <p className="text-xs" style={{ color: '#34d399' }}>
                No issues found.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {validation.issues.map((issue) => (
                  <li key={`${issue.message}-${issue.nodeId ?? ''}`} className="flex gap-2">
                    <Badge tone={issue.severity === 'error' ? 'rose' : 'amber'}>{issue.severity}</Badge>
                    <span className="text-muted">{issue.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-3">
          <Card className="p-2">
            <div className="h-[520px] w-full">
              <ReactFlow
                nodes={decoratedNodes}
                edges={decoratedEdges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, node) => {
                  if (connectFrom !== null) {
                    if (connectFrom === '') {
                      // First click of a two-click connection: this node is
                      // the source.
                      setConnectFrom(node.id)
                      setAnnouncement(`Connection starts at ${node.data.label}. Now click the node it goes to.`)
                      return
                    }
                    // Second click: this node is the target.
                    if (node.id !== connectFrom) {
                      connectNodes(connectFrom, node.id)
                      setAnnouncement(`Connected ${connectFrom} to ${node.id}.`)
                    } else {
                      setAnnouncement('A node cannot connect to itself.')
                    }
                    setConnectFrom(null)
                    return
                  }
                  setSelectedNodeId(node.id)
                  setPanel('inspector')
                }}
                onPaneClick={() => {
                  setSelectedNodeId(null)
                  setConnectFrom(null)
                }}
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                proOptions={{ hideAttribution: false }}
                deleteKeyCode={['Delete', 'Backspace']}
              >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(148,178,255,0.18)" />
                <MiniMap pannable zoomable nodeColor={() => '#1a2344'} maskColor="rgba(5,7,15,0.6)" />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          </Card>

          <Card className="flex flex-wrap items-center gap-2 p-3">
            <Button
              variant={connectFrom !== null ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                if (connectFrom !== null) {
                  setConnectFrom(null)
                  setAnnouncement('Connection cancelled.')
                  return
                }
                setConnectFrom('')
                setAnnouncement('Connect mode on. Click the node the connection starts from.')
              }}
              aria-pressed={connectFrom !== null}
            >
              {connectFrom === null ? '⇢ Connect two nodes' : 'Cancel connection'}
            </Button>
            {connectFrom !== null ? (
              <span className="text-muted text-xs" role="status">
                {connectFrom === ''
                  ? 'Click the node the connection starts from.'
                  : `From “${nodes.find((node) => node.id === connectFrom)?.data.label ?? connectFrom}”. Now click the node it goes to.`}
              </span>
            ) : null}
            <span className="text-muted ml-auto text-xs">
              status: <strong>{run.status}</strong> · steps: {run.trace.length} · node: {run.currentNodeId ?? '—'}
            </span>
          </Card>

          <Card className="flex flex-wrap items-center gap-2 p-3">
            <Button variant="primary" onClick={control.run} disabled={!validation.ok}>
              ▶ Run to completion
            </Button>
            <Button onClick={control.step} disabled={!validation.ok || run.status === 'done'}>
              ⏭ Step
            </Button>
            {run.status === 'paused' ? (
              <Button onClick={control.resume}>▶ Resume</Button>
            ) : (
              <Button onClick={control.pause} disabled={run.status !== 'running'}>
                ⏸ Pause
              </Button>
            )}
            <Button variant="ghost" onClick={control.reset}>
              ⟲ Reset
            </Button>
          </Card>

          <LiveRegion
            message={`${announcement} Run status: ${run.status}. ${run.trace.length} step(s) executed. ${
              run.haltReason ? `Halted: ${run.haltReason}` : ''
            }`}
          />

          {run.haltReason ? (
            <Card className="border p-3 text-xs" style={{ borderColor: 'rgba(251,113,133,0.5)', background: 'rgba(251,113,133,0.08)' }}>
              <strong>Halted:</strong> {run.haltReason}
            </Card>
          ) : null}
        </div>

        <div className="space-y-3">
          <Tabs
            idPrefix="builder-tabs"
            ariaLabel="Builder panels"
            active={panel}
            onChange={setPanel}
            tabs={[
              { id: 'inspector', label: 'Inspector' },
              { id: 'trace', label: `Trace (${run.trace.length})` },
              { id: 'state', label: 'State' },
              { id: 'score', label: 'Score' },
            ]}
          />

          <TabPanel idPrefix="builder-tabs" id="inspector" active={panel === 'inspector'}>
            <Panel
              title="Select a node"
              subtitle="Keyboard path to every node in the graph. Selecting one opens it below and moves focus to the canvas."
            >
              <Select
                label="Select a node to inspect"
                value={selectedNode?.id ?? ''}
                onChange={(value) => {
                  selectNode(value || null)
                  if (value) focusNodeOnCanvas(value)
                }}
                options={[
                  { value: '', label: nodes.length === 0 ? 'No nodes in the graph' : '— none selected —' },
                  ...nodes.map((node) => ({
                    value: node.id,
                    label: `${node.data.label} (${NODE_KIND_LABELS[node.data.kind]})`,
                  })),
                ]}
              />
              <p className="text-muted mt-2 text-[11px]">
                Keyboard: <kbd className="rounded border px-1">Tab</kbd> to the canvas and use the arrow keys to move a node;{' '}
                <kbd className="rounded border px-1">Delete</kbd> removes the selected node; the add-node buttons on the left append a node and
                select it. Connections can be made by dragging a handle, or with the <em>Connect two nodes</em> button, which needs two clicks and
                no dragging.
              </p>
            </Panel>

            {selectedNode ? (
              <Panel title="Node inspector" subtitle={`${NODE_KIND_LABELS[selectedNode.data.kind]} · ${NODE_KIND_DESCRIPTIONS[selectedNode.data.kind]}`}>
                <Field label="Label">
                  <input
                    value={selectedNode.data.label}
                    onChange={(event) => updateNode(selectedNode.id, { label: event.target.value })}
                    className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
                    style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
                  />
                </Field>
                <NodeConfigEditor
                  key={`${selectedNode.id}-${graphVersion}`}
                  node={selectedNode}
                  scenarioId={scenarioId}
                  onChange={(patch) => updateNodeConfig(selectedNode.id, patch)}
                />
                <div className="space-y-2">
                  <p className="text-muted text-[11px] font-semibold uppercase">Outgoing edges</p>
                  {edges.filter((edge) => edge.source === selectedNode.id).length === 0 ? (
                    <p className="text-muted text-xs">No outgoing edges: execution would dead-end here.</p>
                  ) : (
                    edges
                      .filter((edge) => edge.source === selectedNode.id)
                      .map((edge) => (
                        <div key={edge.id} className="surface-2 flex items-center gap-2 rounded-lg border p-2" style={{ borderColor: 'var(--border-soft)' }}>
                          <span className="text-muted text-[11px]">→ {edge.target}</span>
                          <select
                            aria-label={`Branch for edge to ${edge.target}`}
                            value={(edge.label as string) ?? 'default'}
                            onChange={(event) => setEdgeBranch(edge.id, event.target.value)}
                            className="focus-ring surface-2 ml-auto rounded border px-1 py-0.5 text-[11px]"
                            style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
                          >
                            {['default', 'yes', 'no', 'pass', 'fail'].map((branch) => (
                              <option key={branch} value={branch}>
                                {branch}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))
                  )}
                </div>

                {/*
                  The connection control.

                  Dragging a handle is the natural way to draw an edge, but it is
                  a mouse gesture, and it cannot express a *labelled* branch
                  without the drag happening to land on the right handle. This
                  control can build any edge, with any branch label, from a
                  single pointer or from the keyboard — which is what
                  WCAG 2.5.7 asks for, and what makes the builder usable with
                  a switch device or a screen reader.
                */}
                <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border-soft)' }}>
                  <p className="text-muted text-[11px] font-semibold uppercase">Add a connection</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="From">
                      <Select
                        label="Connect from node"
                        value={selectedNode.id}
                        onChange={() => {
                          // The source is always the node being inspected.
                        }}
                        options={[{ value: selectedNode.id, label: selectedNode.data.label }]}
                      />
                    </Field>
                    <Field label="To">
                      <Select
                        label="Connect to node"
                        value={connectTarget}
                        onChange={setConnectTarget}
                        options={[
                          { value: '', label: '— choose a target —' },
                          ...nodes
                            .filter((node) => node.id !== selectedNode.id)
                            .map((node) => ({ value: node.id, label: node.data.label })),
                        ]}
                      />
                    </Field>
                  </div>
                  <Field label="Branch" hint="Decision and evaluator nodes take a yes/no or pass/fail branch.">
                    <Select
                      label="Branch label for the new connection"
                      value={connectBranch}
                      onChange={setConnectBranch}
                      options={[
                        { value: 'default', label: 'default' },
                        { value: 'yes', label: 'yes' },
                        { value: 'no', label: 'no' },
                        { value: 'pass', label: 'pass' },
                        { value: 'fail', label: 'fail' },
                      ]}
                    />
                  </Field>
                  <Button
                    size="sm"
                    disabled={!connectTarget}
                    onClick={() => {
                      if (!connectTarget) return
                      connectNodes(selectedNode.id, connectTarget, connectBranch)
                      setAnnouncement(
                        `Connected ${selectedNode.data.label} to ${
                          nodes.find((node) => node.id === connectTarget)?.data.label ?? connectTarget
                        } with branch ${connectBranch}.`,
                      )
                      setConnectTarget('')
                    }}
                  >
                    Add connection
                  </Button>
                </div>

                <Button size="sm" variant="danger" onClick={() => removeNode(selectedNode.id)}>
                  Delete node
                </Button>
              </Panel>
            ) : (
              <Panel title="Node inspector" subtitle="Select a node on the canvas.">
                <p className="text-muted text-xs">
                  Tip: pick a node from the <em>Select a node to inspect</em> list to configure it, and use the <em>Connect two nodes</em> control to
                  connect two nodes with two clicks and no dragging. Dragging from a node's right handle to another node's left handle also works, and
                  decision and evaluator nodes expose a bottom handle for the second branch.
                </p>
              </Panel>
            )}
          </TabPanel>

          <TabPanel idPrefix="builder-tabs" id="trace" active={panel === 'trace'}>
            <Panel title="Execution trace" subtitle="Every step, with tool input/output and branch decisions.">
              {run.trace.length === 0 ? (
                <p className="text-muted text-xs">No steps yet. Press Step to execute one node at a time.</p>
              ) : (
                <ol tabIndex={0} aria-label="Execution trace" className="thin-scroll max-h-[520px] space-y-2 overflow-y-auto pr-1 focus-ring">
                  {run.trace.map((step) => (
                    <li
                      key={step.index}
                      className="surface-2 rounded-lg border p-2 text-xs"
                      style={{
                        borderColor:
                          step.status === 'error' ? 'rgba(251,113,133,0.5)' : step.status === 'warn' ? 'rgba(251,191,36,0.45)' : 'var(--border-soft)',
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted font-mono text-[10px]">#{step.index + 1}</span>
                        <Badge tone={step.status === 'ok' ? 'emerald' : step.status === 'warn' ? 'amber' : 'rose'}>{step.status}</Badge>
                        <span className="font-medium">{step.label}</span>
                        {step.branch ? <Badge tone="violet">branch: {step.branch}</Badge> : null}
                      </div>
                      <p className="mt-1">{step.summary}</p>
                      <details className="mt-1">
                        <summary className="text-muted focus-ring cursor-pointer text-[11px]">details</summary>
                        <pre className="thin-scroll mt-1 max-h-48 overflow-auto font-mono text-[10px] whitespace-pre-wrap">{step.detail}</pre>
                      </details>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </TabPanel>

          <TabPanel idPrefix="builder-tabs" id="state" active={panel === 'state'}>
            <Panel title="Execution state" subtitle="Exactly what the harness is holding.">
              <div tabIndex={0} aria-label="Execution state" className="thin-scroll max-h-[520px] space-y-3 overflow-y-auto pr-1 text-xs focus-ring">
                <div>
                  <p className="text-muted text-[11px] font-semibold uppercase">Goal</p>
                  <p>{run.context.goal || '—'}</p>
                </div>
                <div>
                  <p className="text-muted text-[11px] font-semibold uppercase">Plan</p>
                  {run.context.plan.length === 0 ? (
                    <p className="text-muted">No plan yet.</p>
                  ) : (
                    <ol className="ml-4 list-decimal">
                      {run.context.plan.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  )}
                </div>
                <div>
                  <p className="text-muted text-[11px] font-semibold uppercase">Observations ({run.context.observations.length})</p>
                  {run.context.observations.map((observation, index) => (
                    <p key={`${observation.channel}-${index}`}>
                      <strong>[{observation.channel}]</strong> {observation.content}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="text-muted text-[11px] font-semibold uppercase">Tool calls ({run.context.toolCalls.length})</p>
                  {run.context.toolCalls.map((call) => (
                    <div key={`${call.toolId}-${call.callIndex}`} className="surface-2 rounded border p-1.5" style={{ borderColor: 'var(--border-soft)' }}>
                      <p>
                        <strong>{call.toolName}</strong> {call.ok ? '(ok)' : '(failed)'}
                      </p>
                      <p className="text-muted">in: {JSON.stringify(call.args)}</p>
                      <p className="text-muted">out: {call.output}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-muted text-[11px] font-semibold uppercase">Memory ({run.context.memory.length})</p>
                  {run.context.memory.map((item) => (
                    <p key={item.id}>• {item.content}</p>
                  ))}
                </div>
                {run.context.retrieval ? (
                  <div>
                    <p className="text-muted text-[11px] font-semibold uppercase">Last retrieval</p>
                    <p className="text-muted">query: {run.context.retrieval.query}</p>
                    <p>kept: {run.context.retrieval.retrieved.length} · omitted: {run.context.retrieval.omitted.length}</p>
                    <ul className="text-muted ml-4 list-disc">
                      {run.context.retrieval.scores.map((entry) => (
                        <li key={entry.id}>
                          {entry.id}: {entry.score}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <p className="text-muted text-[11px] font-semibold uppercase">Reflection</p>
                  <p>
                    retries: {run.context.retries} · critiques: {run.context.critiques.length}
                  </p>
                  {run.context.critiques.map((critique) => (
                    <p key={critique} className="text-muted">
                      {critique}
                    </p>
                  ))}
                </div>
                {run.context.finalAnswer ? (
                  <div>
                    <p className="text-muted text-[11px] font-semibold uppercase">Final answer</p>
                    <p>{run.context.finalAnswer}</p>
                  </div>
                ) : null}
                {run.context.errors.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-semibold uppercase" style={{ color: '#fb7185' }}>
                      Errors ({run.context.errors.length})
                    </p>
                    {run.context.errors.map((error, index) => (
                      <p key={`${error}-${index}`}>• {error}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            </Panel>
          </TabPanel>

          <TabPanel idPrefix="builder-tabs" id="score" active={panel === 'score'}>
            <Panel title="Success scoring" subtitle="Criteria are scripted per scenario and scored deterministically.">
              <div className="space-y-3 text-xs">
                <p className="text-2xl font-semibold">{run.context.successScore.toFixed(2)}</p>
                <p className="text-muted">
                  {run.status === 'done'
                    ? 'Run completed.'
                    : run.status === 'error' || run.status === 'halted'
                      ? 'Run terminated early: see the halt reason.'
                      : 'Run in progress.'}
                </p>
                <ul className="space-y-1">
                  {builderScenario.scenario.successCriteria.map((criterion) => {
                    const satisfied =
                      (criterion.requiredTool && run.context.toolCalls.some((call) => call.toolId === criterion.requiredTool && call.ok)) ||
                      (criterion.requiredChannel && run.context.observations.some((observation) => observation.channel === criterion.requiredChannel)) ||
                      (criterion.requiresSubstring &&
                        (run.context.finalAnswer ?? '').toLowerCase().includes(criterion.requiresSubstring.toLowerCase()))
                    return (
                      <li key={criterion.id} className="flex items-center gap-2">
                        <Badge tone={satisfied ? 'emerald' : 'neutral'}>{satisfied ? 'met' : 'open'}</Badge>
                        <span className="text-muted">{criterion.description}</span>
                      </li>
                    )
                  })}
                </ul>
                <p className="text-muted border-t pt-2 text-[11px]" style={{ borderColor: 'var(--border-soft)' }}>
                  Scoring penalties: 0.10 per error (capped at 0.30), 0.20 when the trace exceeds the step budget. Criteria satisfied are the base score.
                </p>
              </div>
            </Panel>
          </TabPanel>
        </div>
      </div>

      <Panel title="How to read this builder" subtitle="Mapping between the graph and the concepts in the book.">
        <div className="grid gap-3 text-xs md:grid-cols-2">
          <div className="space-y-2">
            <Markdown text="**Reasoning step** and **Tool call** implement the ReAct loop of Ch. 6/11: the harness alternates thought, action and observation." />
            <Markdown text="**Evaluator** and **Reflection** implement the self-reflection harness (Style D, Ch. 9): the same model is called in different roles until the critique budget is spent." />
            <Markdown text="**Memory** models explicit harness memory (Ch. 9 §9.3.2.3): capacity forces eviction, and the relevance weight trades keyword overlap against recency." />
          </div>
          <div className="space-y-2">
            <Markdown text="**Decision** branches on a metric, which is how bounded loops are written: route on success score rather than hoping the model stops." />
            <Markdown text="**Errors are observations** (Ch. 11 §11.5). Fail a tool deliberately in the broken-pipeline scenario and watch the recovery path." />
            <Markdown text="Scoring is deliberately crude and explicit: criteria met, minus error and budget penalties. Replace it with your own metric in the final project." />
          </div>
        </div>
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Per-kind configuration editor                                       */
/* ------------------------------------------------------------------ */

function NodeConfigEditor({
  node,
  scenarioId,
  onChange,
}: {
  node: Node<AgentNodeData>
  scenarioId: string
  onChange: (patch: Record<string, unknown>) => void
}) {
  const config = node.data.config as unknown as Record<string, unknown>
  const scenario = scenarioById(scenarioId)?.scenario

  switch (node.data.kind) {
    case 'input':
      return (
        <Field label="Goal template" hint="{goal} is replaced with the scenario goal.">
          <input
            value={String(config.goalTemplate)}
            onChange={(event) => onChange({ goalTemplate: event.target.value })}
            className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
            style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
          />
        </Field>
      )
    case 'planner':
      return (
        <>
          <Field label="Plan steps">
            <Slider label="Plan steps" value={Number(config.planSteps)} min={1} max={6} onChange={(value) => onChange({ planSteps: value })} />
          </Field>
          <Toggle checked={Boolean(config.useMemory)} onChange={(value) => onChange({ useMemory: value })} label="Consult retrieved memory when planning" />
        </>
      )
    case 'reasoning':
      return (
        <Field label="Reasoning depth">
          <Slider label="Reasoning depth" value={Number(config.depth)} min={1} max={3} onChange={(value) => onChange({ depth: value })} />
        </Field>
      )
    case 'tool':
      return (
        <>
          <Field label="Tool">
            <Select
              label="Tool"
              value={String(config.toolId)}
              onChange={(value) => onChange({ toolId: value })}
              options={(scenario?.tools ?? []).map((tool) => ({
                value: tool.id,
                label: `${tool.name}${tool.broken ? ' (will fail)' : ''}`,
              }))}
            />
          </Field>
          <JsonObjectEditor
            label="Arguments (JSON)"
            hint="Values support {goal}, {observationCount}, {toolCallCount}."
            value={(config.args ?? {}) as Record<string, string>}
            onChange={(args) => onChange({ args })}
          />
        </>
      )
    case 'memory':
      return (
        <>
          <Field label="Mode">
            <Select
              label="Memory mode"
              value={String(config.mode)}
              onChange={(value) => onChange({ mode: value })}
              options={[
                { value: 'read', label: 'read' },
                { value: 'write', label: 'write' },
                { value: 'read-write', label: 'read-write' },
              ]}
            />
          </Field>
          <Field label="Capacity">
            <Slider label="Memory capacity" value={Number(config.capacity)} min={1} max={6} onChange={(value) => onChange({ capacity: value })} />
          </Field>
          <Field label="Relevance weight" hint="1.0 = keyword overlap only · 0.0 = recency only.">
            <Slider
              label="Relevance weight"
              value={Number(config.relevanceWeight)}
              min={0}
              max={1}
              step={0.05}
              onChange={(value) => onChange({ relevanceWeight: value })}
            />
          </Field>
          <Field label="Query">
            <input
              value={String(config.query)}
              onChange={(event) => onChange({ query: event.target.value })}
              className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
              style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
            />
          </Field>
        </>
      )
    case 'observation':
      return (
        <Field label="Channel" hint="Use * to consume the next unread observation from any channel.">
          <input
            value={String(config.channel)}
            onChange={(event) => onChange({ channel: event.target.value })}
            className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
            style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
          />
        </Field>
      )
    case 'decision':
      return (
        <>
          <Field label="Metric">
            <Select
              label="Decision metric"
              value={String(config.metric)}
              onChange={(value) => onChange({ metric: value })}
              options={[
                { value: 'success-score', label: 'success-score' },
                { value: 'error-count', label: 'error-count' },
                { value: 'step-count', label: 'step-count' },
              ]}
            />
          </Field>
          <Field label="Operator">
            <Select
              label="Decision operator"
              value={String(config.operator)}
              onChange={(value) => onChange({ operator: value })}
              options={[
                { value: '>=', label: '≥' },
                { value: '<=', label: '≤' },
                { value: '>', label: '>' },
              ]}
            />
          </Field>
          <Field label="Threshold">
            <Slider
              label="Decision threshold"
              value={Number(config.threshold)}
              min={0}
              max={3}
              step={0.1}
              onChange={(value) => onChange({ threshold: value })}
            />
          </Field>
        </>
      )
    case 'evaluator':
      return (
        <Field label="Pass threshold" hint="Below this score the evaluator routes along the 'fail' branch.">
          <Slider
            label="Pass threshold"
            value={Number(config.passThreshold)}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => onChange({ passThreshold: value })}
          />
        </Field>
      )
    case 'reflection':
      return (
        <Field label="Max retries" hint="When the budget is exhausted the node halts the run with an explicit error.">
          <Slider label="Max retries" value={Number(config.maxRetries)} min={1} max={4} onChange={(value) => onChange({ maxRetries: value })} />
        </Field>
      )
    case 'response':
      return (
        <Field label="Answer template" hint="Supports {goal}, {steps}, {observations}, {score}.">
          <textarea
            value={String(config.template)}
            onChange={(event) => onChange({ template: event.target.value })}
            rows={3}
            className="focus-ring surface-2 mt-1 w-full rounded-lg border p-2 font-mono text-[11px]"
            style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
          />
        </Field>
      )
    default:
      return <p className={cn('text-muted text-xs')}>No configuration options for this node kind.</p>
  }
}
