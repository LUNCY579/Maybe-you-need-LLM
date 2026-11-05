import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { conceptGraph, chapterTitleFor, nodeWidthFor, NODE_HEIGHT } from '../../content/conceptGraph'
import { demoForTerm, routeForDemo } from '../../content/demoLinks'
import { GLOSSARY } from '../../content/glossary'
import { LESSONS } from '../../content/lessons'
import { PARTS } from '../../content/book'
import { navigate } from '../../app/router'
import { Badge, Button, Card } from '../primitives'

/**
 * The concept map.
 *
 * The glossary lists 42 concepts; the book is about how they relate. This
 * draws those relations — the `related` arrays from the glossary — as a
 * graph, coloured by the part of the textbook each concept belongs to.
 *
 * Clicking a concept shows its definition, the chapters it is sourced from,
 * and the lessons that teach it, so the map is a way into the material
 * rather than a picture of it.
 */

const PART_COLOURS: Record<string, string> = {
  'part-1-language-modeling': '#35e6ff',
  'part-2-reasoning': '#a78bfa',
  'part-3-agents': '#34d399',
  'part-4-tools-assistants': '#fbbf24',
  'part-5-behavior-cognition': '#fb7185',
  'part-6-advanced': '#c084fc',
  'part-7-conclusion': '#9aa7c7',
}

interface ConceptMapNodeData extends Record<string, unknown> {
  label: string
  colour: string
  degree: number
  term: string
  /** The connection points on this node's rim, with their angles. */
  handles: { id: string; neighbour: string; angle: number }[]
  /** True when the filter does not match this node or its neighbours. */
  dimmed?: boolean
  /** True when the filter matches this node directly. */
  highlighted?: boolean
}

export function ConceptMap() {
  const graph = useMemo(() => conceptGraph(), [])
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  /*
   * The graph is laid out once, but the node and edge lists live in React
   * Flow's own state hooks rather than in a plain `useMemo`.
   *
   * The reason is not cosmetic: React Flow recomputes the geometry of every
   * edge once the nodes have been measured, and it delivers those updates
   * through `onEdgesChange`. Without that handler the updates are discarded
   * and the edges never appear at all.
   */
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    graph.nodes.map((node) => ({
      id: node.id,
      type: 'concept',
      position: { x: node.x, y: node.y },
      data: {
        label: node.term,
        colour: PART_COLOURS[node.partId] ?? '#9aa7c7',
        degree: node.degree,
        term: node.term,
        handles: node.handles,
      } satisfies ConceptMapNodeData,
    })),
  )

  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    graph.edges.map((edge) => ({
      id: edge.id,
      type: 'default',
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      style: { stroke: 'rgba(148,178,255,0.32)', strokeWidth: 1.2 },
    })),
  )

  /**
   * Filter the map.
   *
   * With ninety-six concepts the map is a hairball, so a filter has to do
   * more than hide things: the matching nodes *and their neighbours* stay
   * legible while everything else recedes. A search for "memory" therefore
   * shows the part of the map that is about memory, in context.
   */
  useEffect(() => {
    const needle = filter.trim().toLowerCase()
    const matched = new Set<string>()
    if (needle !== '') {
      for (const node of graph.nodes) {
        const haystack = `${node.term} ${node.definition}`.toLowerCase()
        if (haystack.includes(needle)) matched.add(node.id)
      }
    }
    const neighbourhood = new Set(matched)
    if (needle !== '') {
      for (const edge of graph.edges) {
        if (matched.has(edge.source)) neighbourhood.add(edge.target)
        if (matched.has(edge.target)) neighbourhood.add(edge.source)
      }
    }
    const filtering = needle !== ''

    setNodes((current) =>
      current.map((node) => {
        const data = node.data as ConceptMapNodeData
        return {
          ...node,
          data: {
            ...data,
            dimmed: filtering && !neighbourhood.has(node.id),
            highlighted: matched.has(node.id),
          },
        }
      }),
    )

    setEdges((current) =>
      current.map((edge) => {
        const touchesMatch = filtering && (matched.has(edge.source) || matched.has(edge.target))
        return {
          ...edge,
          style: {
            stroke: touchesMatch ? 'rgba(53,230,255,0.6)' : filtering ? 'rgba(148,178,255,0.12)' : 'rgba(148,178,255,0.32)',
            strokeWidth: touchesMatch ? 1.9 : 1.2,
          },
        }
      }),
    )
  }, [filter, graph, setNodes, setEdges])

  // Mark the selected concept on the canvas.
  useEffect(() => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: node.id === selected,
        style: node.id === selected ? { border: '1px solid var(--accent)' } : undefined,
      })),
    )
  }, [selected, setNodes])

  const onNodeClick = useCallback<NodeMouseHandler>((_event, node) => {
    setSelected(node.id)
  }, [])

  const selectedNode = selected ? graph.nodes.find((node) => node.id === selected) : null
  const selectedDemo = selectedNode ? demoForTerm(selectedNode.term) : undefined
  const demoRoute = selectedDemo ? routeForDemo(selectedDemo) : null

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="concept-map-filter" className="sr-only">
            Filter the concept map
          </label>
          <input
            id="concept-map-filter"
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter the map — e.g. memory, tool, evaluation"
            className="focus-ring surface-2 w-full rounded-lg border px-3 py-1.5 text-xs"
            style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PARTS.map((part) => (
            <span key={part.id} className="flex items-center gap-1.5 text-[11px]">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: PART_COLOURS[part.id] ?? '#9aa7c7' }}
              />
              <span className="text-muted">{part.title}</span>
            </span>
          ))}
        </div>
        <span className="text-muted ml-auto text-[11px]">
          {graph.nodes.length} concepts · {graph.edges.length} relations. Click a concept for its definition.
        </span>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="h-[560px] overflow-hidden p-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={conceptNodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            minZoom={0.3}
            maxZoom={2}
            /*
              The map is a static picture of a fixed set of relations, so
              every edge is rendered rather than only the ones inside the
              viewport. React Flow's default culling depends on a measured
              canvas size, and node labels of variable length make that
              culling drop edges that are plainly on screen.
            */
            onlyRenderVisibleElements={false}
          >
            <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="rgba(148,178,255,0.14)" />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => (node.data as ConceptMapNodeData).colour}
              maskColor="rgba(5,7,15,0.7)"
              style={{ background: 'var(--surface-2)' }}
            />
            <Controls showInteractive={false} />
          </ReactFlow>
        </Card>

        <div className="space-y-3">
          {selectedNode ? (
            <Card className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: PART_COLOURS[selectedNode.partId] ?? '#9aa7c7' }}
                />
                <h3 className="text-sm font-semibold">{selectedNode.term}</h3>
                <Badge tone="neutral">{selectedNode.degree} relation(s)</Badge>
              </div>
              <p className="text-sm leading-relaxed">{selectedNode.definition}</p>
              {selectedNode.chapters.length > 0 ? (
                <p className="text-muted text-[11px]">
                  {chapterTitleFor(selectedNode)}
                  {selectedNode.chapters.length > 1 ? ` (+${selectedNode.chapters.length - 1} more chapter(s))` : ''}
                </p>
              ) : null}
              {selectedNode.related.length > 0 ? (
                <div>
                  <p className="text-muted text-[11px] font-semibold tracking-wide uppercase">Related</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedNode.related.map((related) => (
                      <button
                        key={related}
                        type="button"
                        onClick={() => setSelected(related)}
                        className="focus-ring tap-target surface-2 rounded-md border px-2 py-1 text-[11px]"
                        style={{ borderColor: 'var(--border-soft)' }}
                      >
                        {related}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <p className="text-muted text-[11px] font-semibold tracking-wide uppercase">Taught in</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedNode.lessons.map((slug) => {
                    const lesson = LESSONS.find((candidate) => candidate.slug === slug)
                    if (!lesson) return null
                    return (
                      <Button key={slug} size="sm" variant="ghost" onClick={() => navigate(`/lesson/${slug}`)}>
                        {lesson.title}
                      </Button>
                    )
                  })}
                </div>
              </div>
              {demoRoute ? (
                <Button size="sm" variant="primary" onClick={() => navigate(demoRoute)}>
                  Practise this concept
                </Button>
              ) : null}
              <Button size="sm" onClick={() => navigate(`/glossary?term=${encodeURIComponent(selectedNode.term)}`)}>
                Open in the glossary
              </Button>
            </Card>
          ) : (
            <Card className="space-y-2 p-4">
              <h3 className="text-sm font-semibold">How to read this</h3>
              <p className="text-muted text-xs leading-relaxed">
                Every node is a concept from the glossary, and every edge is a relation the textbook draws between two of them. The colour is the part of
                the book the concept comes from. The map is laid out by a deterministic force simulation, so it looks the same every time you open it.
              </p>
              <p className="text-muted text-xs leading-relaxed">
                {GLOSSARY.length} terms, {graph.edges.length} relations. A concept with many relations — the harness, the ReAct loop, the world model —
                is a hub, and the hubs are where the book spends most of its effort.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* The node                                                           */
/* ------------------------------------------------------------------ */

function ConceptNode({ data }: { data: ConceptMapNodeData }) {
  /*
   * The node is a pill sized to its label rather than a circle.
   *
   * Cramming "Retrieval-augmented generation (RAG)" into a circle made it
   * unreadable, and a term the student cannot read is not a term the student
   * can navigate by. Long labels are truncated with an ellipsis and the full
   * name is in the tooltip and in the detail panel.
   */
  const width = nodeWidthFor(data.label)
  const height = NODE_HEIGHT
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width, height }}
      title={data.label}
    >
      {/*
        One handle per neighbour, each placed on the rim at the angle
        towards that neighbour. React Flow only draws an edge whose two ends
        attach to handles that exist, so a node without them would show its
        relations nowhere at all.
      */}
      {data.handles.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          // The handle's type has to match the role it plays in the edge:
          // an `s-` handle is where a relation leaves, a `t-` handle is where
          // it arrives. A handle typed the wrong way makes the whole edge
          // invalid, and React Flow then draws nothing at all.
          type={handle.id.startsWith('s-') ? 'source' : 'target'}
          position={Position.Left}
          isConnectable={false}
          className="concept-handle"
          style={{
            left: `${50 + 50 * Math.cos(handle.angle)}%`,
            top: `${50 + 50 * Math.sin(handle.angle)}%`,
            width: 6,
            height: 6,
            minWidth: 0,
            minHeight: 0,
            border: 'none',
            background: 'transparent',
          }}
        />
      ))}
      <span
        className="pointer-events-none flex w-full items-center justify-center overflow-hidden whitespace-nowrap rounded-full border px-2 text-center text-[10px] leading-none font-medium transition-opacity"
        style={{
          height,
          borderColor: data.colour,
          color: 'var(--text-strong)',
          background: 'var(--surface-1)',
          boxShadow: `0 0 0 3px color-mix(in srgb, ${data.colour} 16%, transparent)`,
          textOverflow: 'ellipsis',
          opacity: data.dimmed ? 0.16 : 1,
        }}
      >
        {data.label}
      </span>
    </div>
  )
}

const conceptNodeTypes = { concept: ConceptNode }
