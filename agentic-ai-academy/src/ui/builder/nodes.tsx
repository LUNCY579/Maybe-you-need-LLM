import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeConfig, NodeKind, StepStatus } from '../../types/workflow'
import { NODE_KIND_LABELS } from '../../engine/workflow'

/**
 * Custom React Flow node for the agent workflow editor.
 *
 * The node carries only typed data; all behaviour lives in the execution engine.
 * Status colours reflect the latest deterministic trace for that node.
 */

export interface AgentNodeData extends Record<string, unknown> {
  kind: NodeKind
  label: string
  config: NodeConfig
  status: StepStatus | 'idle' | 'current'
  visits: number
}

const KIND_ACCENT: Record<NodeKind, string> = {
  input: '#fbbf24',
  planner: '#35e6ff',
  reasoning: '#a78bfa',
  tool: '#34d399',
  memory: '#fb7185',
  observation: '#38bdf8',
  decision: '#f59e0b',
  evaluator: '#c084fc',
  reflection: '#f472b6',
  response: '#22d3ee',
}

const STATUS_RING: Record<string, string> = {
  idle: 'transparent',
  current: '#fbbf24',
  ok: 'rgba(52,211,153,0.85)',
  warn: 'rgba(251,191,36,0.85)',
  error: 'rgba(251,113,133,0.9)',
}

function summarise(data: AgentNodeData): string {
  const config = data.config as unknown as Record<string, unknown>
  switch (data.kind) {
    case 'planner':
      return `plan steps: ${config.planSteps} · memory: ${config.useMemory ? 'on' : 'off'}`
    case 'reasoning':
      return `depth: ${config.depth}`
    case 'tool':
      return `tool: ${config.toolId}`
    case 'memory':
      return `${config.mode} · cap ${config.capacity} · w ${Number(config.relevanceWeight).toFixed(2)}`
    case 'observation':
      return `channel: ${String(config.channel)}`
    case 'decision':
      return `${String(config.metric)} ${String(config.operator)} ${String(config.threshold)}`
    case 'evaluator':
      return `pass ≥ ${config.passThreshold}`
    case 'reflection':
      return `max retries: ${config.maxRetries}`
    case 'response':
      return 'emits the final answer'
    case 'input':
      return 'goal from scenario'
    default:
      return ''
  }
}

export function AgentNode({ data, selected }: NodeProps) {
  const nodeData = data as AgentNodeData
  const accent = KIND_ACCENT[nodeData.kind]
  return (
    <div
      className="w-[196px] rounded-xl border px-3 py-2 text-left"
      style={{
        borderColor: selected ? accent : 'var(--border-soft)',
        background: 'var(--surface-1)',
        boxShadow:
          nodeData.status === 'current'
            ? `0 0 0 2px ${STATUS_RING.current}, 0 12px 30px -18px rgba(0,0,0,0.9)`
            : `0 0 0 2px ${STATUS_RING[nodeData.status] ?? 'transparent'}, 0 12px 30px -22px rgba(0,0,0,0.9)`,
      }}
    >
      {nodeData.kind !== 'input' ? (
        <>
          <Handle id="left" type="target" position={Position.Left} style={{ background: accent }} />
          <Handle id="top" type="target" position={Position.Top} style={{ background: accent }} />
          <Handle id="bottom-target" type="target" position={Position.Bottom} style={{ background: accent }} />
        </>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: accent }}>
          {NODE_KIND_LABELS[nodeData.kind]}
        </span>
        {nodeData.visits > 0 ? <span className="text-muted text-[10px]">×{nodeData.visits}</span> : null}
      </div>
      <p className="mt-1 text-xs font-medium">{nodeData.label}</p>
      <p className="text-muted mt-0.5 text-[10px] leading-snug">{summarise(nodeData)}</p>
      <Handle id="right" type="source" position={Position.Right} style={{ background: accent }} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={{ background: accent }} />
      <Handle id="top-source" type="source" position={Position.Top} style={{ background: accent }} />
      {(nodeData.kind === 'decision' || nodeData.kind === 'evaluator') ? (
        <Handle id="branch" type="source" position={Position.Bottom} style={{ left: '70%', background: '#f59e0b' }} />
      ) : null}
    </div>
  )
}
