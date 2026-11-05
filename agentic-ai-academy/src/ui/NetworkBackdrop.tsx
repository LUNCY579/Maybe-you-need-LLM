import { useMemo } from 'react'
import { mulberry32 } from '../engine/prng'

/**
 * Animated network backdrop.
 *
 * A sparse graph of agent-like nodes with signals travelling along the edges.
 * It is decorative only — `aria-hidden`, behind the content, and it stops
 * moving when the user prefers reduced motion.
 *
 * The layout is generated from a fixed seed, so the graph is identical on
 * every render and on every machine. Nothing here is random at runtime.
 */

interface NetworkNode {
  id: string
  x: number
  y: number
  r: number
  /** Phase offset for the pulse animation, in seconds. */
  phase: number
}

interface NetworkEdge {
  id: string
  from: NetworkNode
  to: NetworkNode
  phase: number
  width: number
}

const WIDTH = 1200
const HEIGHT = 600
const NODE_COUNT = 26
const EDGE_COUNT = 34
const SEED = 20261009

function buildNetwork(): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
  const rng = mulberry32(SEED)
  const nodes: NetworkNode[] = Array.from({ length: NODE_COUNT }, (_, index) => ({
    id: `n${index}`,
    // A loose grid with jitter, so the graph reads as a network rather than
    // as random confetti.
    x: (index % 7) * (WIDTH / 6) + (rng() - 0.5) * 90,
    y: Math.floor(index / 7) * (HEIGHT / 3) + (rng() - 0.5) * 70,
    r: 1.6 + rng() * 2.4,
    phase: rng() * 6,
  }))

  const edges: NetworkEdge[] = []
  for (let index = 0; index < EDGE_COUNT; index += 1) {
    const from = nodes[Math.floor(rng() * nodes.length)]
    let to = nodes[Math.floor(rng() * nodes.length)]
    // Avoid self-loops and duplicate edges.
    if (to.id === from.id) to = nodes[(nodes.indexOf(from) + 3) % nodes.length]
    edges.push({ id: `e${index}`, from, to, phase: rng() * 6, width: 0.6 + rng() * 1.1 })
  }

  return { nodes, edges }
}

export function NetworkBackdrop({ className }: { className?: string }) {
  const { nodes, edges } = useMemo(() => buildNetwork(), [])

  return (
    <svg
      className={className}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <g className="net-edges">
        {edges.map((edge) => (
          <line
            key={edge.id}
            x1={edge.from.x}
            y1={edge.from.y}
            x2={edge.to.x}
            y2={edge.to.y}
            strokeWidth={edge.width}
            style={{ animationDelay: `${edge.phase.toFixed(2)}s` }}
          />
        ))}
      </g>
      <g className="net-nodes">
        {nodes.map((node) => (
          <circle
            key={node.id}
            cx={node.x}
            cy={node.y}
            r={node.r}
            style={{ animationDelay: `${node.phase.toFixed(2)}s` }}
          />
        ))}
      </g>
    </svg>
  )
}
