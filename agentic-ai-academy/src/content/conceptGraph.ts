import { GLOSSARY } from './glossary'
import { CHAPTER_BY_NUMBER, PARTS } from './book'
import { LESSONS } from './lessons'
import { normaliseKey } from './glossaryIndex'
import type { GlossaryTerm } from '../types/curriculum'

/**
 * The concept graph.
 *
 * The glossary is a list, but the textbook is about *relations*: a harness
 * enables a ReAct loop; a ReAct loop needs memory; a world model is what makes
 * a model-based planner possible. Those relations are already recorded in the
 * glossary's `related` arrays, but a list cannot show them.
 *
 * This module turns them into a graph that can be laid out and drawn:
 *
 *  - nodes are glossary terms;
 *  - edges are the `related` relations, deduplicated and made symmetric;
 *  - a term's part of the book is inferred from the chapters its lessons
 *    cover, so the map can be coloured by part.
 *
 * The layout is a deterministic force-directed relaxation. It is *computed*, not
 * random: the same terms always produce the same positions, so the map is
 * stable between visits and can be asserted on in tests.
 */

export interface ConceptNode {
  id: string
  term: string
  definition: string
  /** The part of the textbook the term belongs to. */
  partId: string
  partTitle: string
  /** The chapters of the book the term is sourced from. */
  chapters: number[]
  /** Terms this one is related to. */
  related: string[]
  lessons: string[]
  x: number
  y: number
  /** How many relations the term has; used for sizing. */
  degree: number
  /**
   * The connection points on this node's rim.
   *
   * A node needs one handle per neighbour, each placed at the angle towards
   * that neighbour, so that the relations radiate outwards instead of all
   * leaving from the same point.
   */
  handles: ConceptHandle[]
}

export interface ConceptHandle {
  /** The handle id, unique within the node. */
  id: string
  /** The neighbouring term this handle points at. */
  neighbour: string
  /** The angle in radians from the node's centre. */
  angle: number
}

export interface ConceptEdge {
  id: string
  source: string
  target: string
  /** The handle on the source node this edge leaves from. */
  sourceHandle: string
  /** The handle on the target node this edge arrives at. */
  targetHandle: string
}

export interface ConceptGraph {
  nodes: ConceptNode[]
  edges: ConceptEdge[]
}

/** The part of the book a term belongs to, inferred from the lessons that use it. */
function partForTerm(term: GlossaryTerm): { partId: string; partTitle: string; chapters: number[] } {
  const lessons = LESSONS.filter((lesson) => term.lessons.includes(lesson.slug))
  const chapters = [...new Set(lessons.flatMap((lesson) => lesson.provenance.textbookChapters))].sort((a, b) => a - b)
  const partIds = [...new Set(lessons.map((lesson) => lesson.part))]
  const part = PARTS.find((entry) => entry.id === partIds[0])
  return {
    partId: part?.id ?? 'part-1-language-modeling',
    partTitle: part?.title ?? 'Language Modeling',
    chapters,
  }
}

/** The graph, before layout. */
export function buildConceptGraph(): ConceptGraph {
  // The lookup is normalised, because the book mixes hyphens and en dashes
  // in the same term ("Planner-Caller-Summarizer" / "Planner–Caller–
  // Summarizer"), and a relation that misses its target loses an edge.
  const byName = new Map<string, GlossaryTerm>(GLOSSARY.map((entry) => [normaliseKey(entry.term), entry]))

  const nodes: ConceptNode[] = GLOSSARY.map((entry) => {
    const { partId, partTitle, chapters } = partForTerm(entry)
    return {
      id: entry.term,
      term: entry.term,
      definition: entry.definition,
      partId,
      partTitle,
      chapters,
      related: entry.related
        .map((related) => byName.get(normaliseKey(related))?.term)
        .filter((related): related is string => Boolean(related)),
      lessons: entry.lessons,
      x: 0,
      y: 0,
      degree: 0,
      handles: [],
    }
  })

  const index = new Map(nodes.map((node) => [node.id, node]))
  const edgeKeys = new Set<string>()
  const edges: ConceptEdge[] = []

  for (const node of nodes) {
    for (const related of node.related) {
      if (related === node.id) continue
      // The relation is symmetric in the map, so it is only added once.
      const [a, b] = [node.id, related].sort()
      const key = `${a} ${b}`
      if (edgeKeys.has(key)) continue
      edgeKeys.add(key)
      // The edge id is a safe token rather than the term pair: term names
      // contain spaces, slashes and parentheses, and those make for fragile
      // ids in the rendering layer.
      edges.push({
        id: `e${edges.length}`,
        source: a,
        target: b,
        sourceHandle: `s-${b}`,
        targetHandle: `t-${a}`,
      })
      index.get(node.id)!.degree += 1
      index.get(related)!.degree += 1
    }
  }

  return { nodes, edges }
}

/**
 * Lay the graph out.
 *
 * A deterministic force-directed relaxation: nodes repel each other, connected
 * nodes attract, and the whole thing is pulled towards the centre. The result
 * is a layout that groups related concepts without needing a layout library,
 * and — crucially — that is the same every time.
 *
 * The repulsion is scaled by the area a node occupies, because the nodes are
 * labelled pills of varying width: a force tuned for dots leaves the labels
 * overlapping.
 */
export function layoutConceptGraph(graph: ConceptGraph, width = 1600, height = 1000): ConceptGraph {
  const nodes = graph.nodes.map((node) => ({ ...node }))
  const index = new Map(nodes.map((node) => [node.id, node]))
  const edges = graph.edges

  if (nodes.length === 0) return { nodes, edges }

  // Seed the positions on a circle, ordered by degree so the busiest terms
  // start near the centre where they have room.
  const ordered = [...nodes].sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id))
  ordered.forEach((node, position) => {
    const angle = (position / ordered.length) * Math.PI * 2
    const radius = Math.min(width, height) * 0.4 * (0.55 + 0.45 * (node.degree / Math.max(1, ordered[0].degree)))
    node.x = width / 2 + Math.cos(angle) * radius
    node.y = height / 2 + Math.sin(angle) * radius
  })

  const iterations = 420
  // Enough room for a label pill, not for a dot.
  const repulsion = 26000
  const attraction = 0.010
  const centrePull = 0.010
  const maxStep = 22
  const marginX = 110
  const marginY = 26

  for (let step = 0; step < iterations; step += 1) {
    const cooling = 1 - step / iterations
    const forces = new Map(nodes.map((node) => [node.id, { x: 0, y: 0 }]))

    // Repulsion between every pair.
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]
        const b = nodes[j]
        const dx = a.x - b.x
        const dy = (a.y - b.y) * 2.2
        const distanceSquared = dx * dx + dy * dy + 0.01
        const distance = Math.sqrt(distanceSquared)
        const force = repulsion / distanceSquared
        const fx = (dx / distance) * force
        const fy = (dy / distance) * force
        const fa = forces.get(a.id)!
        const fb = forces.get(b.id)!
        fa.x += fx
        fa.y += fy
        fb.x -= fx
        fb.y -= fy
      }
    }

    // Attraction along the relations.
    for (const edge of edges) {
      const a = index.get(edge.source)
      const b = index.get(edge.target)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const fa = forces.get(a.id)!
      const fb = forces.get(b.id)!
      fa.x += dx * attraction
      fa.y += dy * attraction
      fb.x -= dx * attraction
      fb.y -= dy * attraction
    }

    // Pull towards the centre, and apply the forces.
    for (const node of nodes) {
      const force = forces.get(node.id)!
      force.x += (width / 2 - node.x) * centrePull
      force.y += (height / 2 - node.y) * centrePull
      const magnitude = Math.hypot(force.x, force.y) || 1
      const scale = Math.min(1, (maxStep * cooling) / magnitude)
      node.x += force.x * scale
      node.y += force.y * scale
      node.x = Math.max(marginX, Math.min(width - marginX, node.x))
      node.y = Math.max(marginY, Math.min(height - marginY, node.y))
    }
  }

  return { nodes: withHandles(nodes, edges), edges }
}

/**
 * Place a connection point on each node's rim, pointing at the neighbour.
 *
 * React Flow only draws an edge when both of its ends attach to a handle that
 * exists, so a node needs one handle per neighbour. Placing each handle at the
 * angle towards that neighbour makes the relations radiate outwards, which is
 * what makes a graph of forty terms readable.
 */
function withHandles(nodes: ConceptNode[], edges: ConceptEdge[]): ConceptNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))

  const handles = new Map<string, ConceptHandle[]>()
  for (const edge of edges) {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) continue

    const sourceAngle = Math.atan2(target.y - source.y, target.x - source.x)
    const targetAngle = Math.atan2(source.y - target.y, source.x - target.x)

    const sourceList = handles.get(source.id) ?? []
    sourceList.push({ id: edge.sourceHandle, neighbour: target.id, angle: sourceAngle })
    handles.set(source.id, sourceList)

    const targetList = handles.get(target.id) ?? []
    targetList.push({ id: edge.targetHandle, neighbour: source.id, angle: targetAngle })
    handles.set(target.id, targetList)
  }

  return nodes.map((node) => ({ ...node, handles: handles.get(node.id) ?? [] }))
}
/** The laid-out graph, computed once. */
export function conceptGraph(): ConceptGraph {
  return layoutConceptGraph(buildConceptGraph())
}

/**
 * The width of a node's label pill.
 *
 * Shared with the renderer so that the layout can be tested against the
 * geometry the student actually sees, rather than against the geometry of
 * invisible points.
 */
export function nodeWidthFor(label: string): number {
  return Math.min(180, Math.max(74, label.length * 5.1 + 16))
}

/** The height of a node's label pill. */
export const NODE_HEIGHT = 24

/**
 * The chapter title for a node's primary chapter.
 */
export function chapterTitleFor(node: ConceptNode): string {
  const chapter = node.chapters[0] !== undefined ? CHAPTER_BY_NUMBER.get(node.chapters[0]) : undefined
  return chapter ? `Ch. ${chapter.number} · ${chapter.title}` : ''
}
