import { useMemo } from 'react'
import { GLOSSARY, type GlossaryEntry } from '../../content/glossary'

/**
 * A concept map for one module.
 *
 * The course is a dependency structure, not a list: a module's ideas rest on
 * terms introduced earlier. This draws that structure — the module's own terms
 * in a grid, the outside terms they depend on beneath, and an edge for each
 * dependency — so a reader can see what a module assumes and where its terms
 * come from.
 *
 * The graph is plain SVG with a fixed view box, so it scales with the column
 * without a layout library and without measuring the DOM.
 */
export interface ConceptMapProps {
  /** The glossary ids of the terms in the module being shown. */
  termIds: string[]
  /** The id of the term currently selected, if any. */
  selectedId?: string
  onSelect: (id: string) => void
}

const NODE_WIDTH = 138
const NODE_HEIGHT = 38
const COLUMN_GAP = 16
const ROW_GAP = 14
const PADDING = 14
/** How many terms sit side by side before the map wraps. */
const COLUMNS = 4

export function ConceptMap({ termIds, selectedId, onSelect }: ConceptMapProps) {
  const graph = useMemo(() => {
    const byId = new Map(GLOSSARY.map((entry) => [entry.id, entry]))
    const own = termIds.map((id) => byId.get(id)).filter((e): e is GlossaryEntry => Boolean(e))
    // The outside terms this module relies on, and which of its terms need each.
    const external = new Map<string, string[]>()
    for (const entry of own) {
      for (const prerequisite of entry.prerequisites) {
        if (byId.has(prerequisite) && termIds.includes(prerequisite)) continue
        const list = external.get(prerequisite) ?? []
        list.push(entry.id)
        external.set(prerequisite, list)
      }
    }
    const externalEntries = Array.from(external.keys())
      .map((id) => byId.get(id))
      .filter((e): e is GlossaryEntry => Boolean(e))
    return { own, externalEntries, external }
  }, [termIds])

  if (graph.own.length === 0) {
    return <p className="text-sm text-faint">No terms to map for this selection.</p>
  }

  const ownRows = Math.ceil(graph.own.length / COLUMNS)
  const externalRows = Math.ceil(graph.externalEntries.length / COLUMNS)
  const columns = Math.max(
    Math.min(graph.own.length, COLUMNS),
    Math.min(graph.externalEntries.length, COLUMNS),
    1,
  )
  const width = PADDING * 2 + columns * NODE_WIDTH + (columns - 1) * COLUMN_GAP
  const ownHeight = ownRows * NODE_HEIGHT + Math.max(0, ownRows - 1) * ROW_GAP
  const gapBetween = graph.externalEntries.length > 0 ? 46 : 0
  const externalTop = PADDING + ownHeight + gapBetween
  const externalHeight = externalRows * NODE_HEIGHT + Math.max(0, externalRows - 1) * ROW_GAP
  const height = PADDING * 2 + ownHeight + gapBetween + externalHeight

  const ownPos = (index: number) => ({
    x: PADDING + (index % COLUMNS) * (NODE_WIDTH + COLUMN_GAP),
    y: PADDING + Math.floor(index / COLUMNS) * (NODE_HEIGHT + ROW_GAP),
  })
  const externalPos = (index: number) => ({
    x: PADDING + (index % COLUMNS) * (NODE_WIDTH + COLUMN_GAP),
    y: externalTop + Math.floor(index / COLUMNS) * (NODE_HEIGHT + ROW_GAP),
  })

  const ownIndex = (id: string) => graph.own.findIndex((entry) => entry.id === id)
  const externalIndex = (id: string) => graph.externalEntries.findIndex((entry) => entry.id === id)

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        style={{ minWidth: Math.min(width, 640) }}
        // The map contains focusable nodes, so it is a group rather than an
        // image: an interactive control may not be nested inside role="img".
        role="group"
        aria-label={`Concept map: ${graph.own.length} terms in this module and the ${graph.externalEntries.length} earlier terms they depend on`}
      >
        <defs>
          <marker
            id="concept-map-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--line)" />
          </marker>
        </defs>

        {/* Edges first, so the nodes sit on top of them. */}
        {graph.externalEntries.map((entry) =>
          (graph.external.get(entry.id) ?? []).map((dependent) => {
            const from = externalPos(externalIndex(entry.id))
            const to = ownPos(ownIndex(dependent))
            const fromX = from.x + NODE_WIDTH / 2
            const fromY = from.y
            const toX = to.x + NODE_WIDTH / 2
            const toY = to.y + NODE_HEIGHT
            const midY = (fromY + toY) / 2
            return (
              <path
                key={`${entry.id}-${dependent}`}
                d={`M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`}
                fill="none"
                stroke="var(--line)"
                strokeWidth={1.5}
                markerEnd="url(#concept-map-arrow)"
              />
            )
          }),
        )}

        {graph.own.map((entry, index) => {
          const position = ownPos(index)
          const selected = entry.id === selectedId
          return (
            <g
              key={entry.id}
              onClick={() => onSelect(entry.id)}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(entry.id)
                }
              }}
            >
              <rect
                x={position.x}
                y={position.y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={9}
                fill={selected ? 'var(--indigo)' : 'var(--panel-2)'}
                stroke={selected ? 'var(--indigo)' : 'var(--line)'}
                strokeWidth={selected ? 2 : 1}
              />
              <text
                x={position.x + NODE_WIDTH / 2}
                y={position.y + NODE_HEIGHT / 2 + 4}
                textAnchor="middle"
                fontSize={11}
                fill={selected ? 'var(--surface)' : 'var(--fg)'}
              >
                {truncate(entry.term, 20)}
              </text>
            </g>
          )
        })}

        {graph.externalEntries.map((entry, index) => {
          const position = externalPos(index)
          return (
            <g
              key={entry.id}
              onClick={() => onSelect(entry.id)}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(entry.id)
                }
              }}
            >
              <rect
                x={position.x}
                y={position.y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={9}
                fill="transparent"
                stroke="var(--line)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={position.x + NODE_WIDTH / 2}
                y={position.y + NODE_HEIGHT / 2 + 4}
                textAnchor="middle"
                fontSize={11}
                fill="var(--muted)"
              >
                {truncate(entry.term, 20)}
              </text>
            </g>
          )
        })}
      </svg>

      <p className="mt-2 text-xs text-faint">
        Solid nodes are introduced in this module; dashed nodes come from earlier modules. Click a node to open its
        definition.
      </p>
    </div>
  )
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`
}
