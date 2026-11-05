import { describe, expect, it } from 'vitest'
import { buildConceptGraph, chapterTitleFor, conceptGraph, layoutConceptGraph, nodeWidthFor, NODE_HEIGHT } from './conceptGraph'
import { GLOSSARY } from './glossary'

describe('the concept graph', () => {
  it('has one node per glossary term', () => {
    const graph = buildConceptGraph()
    expect(graph.nodes).toHaveLength(GLOSSARY.length)
    expect(graph.nodes.map((node) => node.id).sort()).toEqual(GLOSSARY.map((entry) => entry.term).sort())
  })

  it('only relates terms that exist', () => {
    const graph = buildConceptGraph()
    for (const node of graph.nodes) {
      for (const related of node.related) {
        expect(graph.nodes.some((candidate) => candidate.id === related)).toBe(true)
      }
    }
  })

  it('makes every relation symmetric and unique', () => {
    const graph = buildConceptGraph()
    const ids = graph.edges.map((edge) => edge.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const edge of graph.edges) {
      const mirrored = graph.edges.find((candidate) => candidate.source === edge.target && candidate.target === edge.source)
      // Either the edge is its own mirror or it is present once, undirected.
      expect(mirrored === undefined || mirrored.id === edge.id).toBe(true)
    }
  })

  it('counts each relation on both of its endpoints', () => {
    const graph = buildConceptGraph()
    const byId = new Map(graph.nodes.map((node) => [node.id, node]))
    for (const edge of graph.edges) {
      expect(byId.get(edge.source)!.degree).toBeGreaterThan(0)
      expect(byId.get(edge.target)!.degree).toBeGreaterThan(0)
    }
    // The degree of a node equals the number of edges touching it.
    for (const node of graph.nodes) {
      const touching = graph.edges.filter((edge) => edge.source === node.id || edge.target === node.id).length
      expect(node.degree).toBe(touching)
    }
  })

  it('assigns every node a part and at least one chapter', () => {
    const graph = buildConceptGraph()
    for (const node of graph.nodes) {
      expect(node.partId.length).toBeGreaterThan(0)
      expect(node.chapters.length).toBeGreaterThan(0)
    }
  })

  it('lays the graph out inside the canvas', () => {
    const laid = layoutConceptGraph(buildConceptGraph(), 1200, 720)
    for (const node of laid.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0)
      expect(node.x).toBeLessThanOrEqual(1200)
      expect(node.y).toBeGreaterThanOrEqual(0)
      expect(node.y).toBeLessThanOrEqual(720)
    }
  })

  it('lays the labels out so that they barely overlap', () => {
    // The nodes are label pills, not dots, so the layout has to leave room for
    // the text. This asserts against the geometry the student actually sees.
    const laid = layoutConceptGraph(buildConceptGraph(), 1600, 1000)
    const boxes = laid.nodes.map((node) => ({
      x: node.x,
      y: node.y,
      width: nodeWidthFor(node.term),
      height: NODE_HEIGHT,
    }))

    let overlapping = 0
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]
        const b = boxes[j]
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
        if (overlapX > 0 && overlapY > 0) overlapping += 1
      }
    }
    const pairs = (boxes.length * (boxes.length - 1)) / 2
    // A force-directed map is never a grid, so a few overlaps are expected;
    // what must not happen is a map where the labels pile up.
    expect(overlapping / pairs).toBeLessThan(0.02)
  })

  it('gives two different nodes two different positions', () => {
    const laid = layoutConceptGraph(buildConceptGraph(), 1200, 720)
    const positions = new Set(laid.nodes.map((node) => `${Math.round(node.x)},${Math.round(node.y)}`))
    expect(positions.size).toBe(laid.nodes.length)
  })

  it('is deterministic: the same input always gives the same layout', () => {
    const a = layoutConceptGraph(buildConceptGraph(), 1200, 720)
    const b = layoutConceptGraph(buildConceptGraph(), 1200, 720)
    expect(a.nodes.map((node) => [node.id, node.x, node.y])).toEqual(b.nodes.map((node) => [node.id, node.x, node.y]))
  })

  it('does not mutate the graph it is given', () => {
    const graph = buildConceptGraph()
    const before = graph.nodes.map((node) => [node.x, node.y])
    layoutConceptGraph(graph, 1200, 720)
    expect(graph.nodes.map((node) => [node.x, node.y])).toEqual(before)
  })

  it('names the chapter a concept comes from', () => {
    const graph = conceptGraph()
    const node = graph.nodes.find((candidate) => candidate.chapters.length > 0)!
    expect(chapterTitleFor(node)).toMatch(/^Ch\. \d+/)
  })

  it('leaves no term without a relation', () => {
    // A concept that relates to nothing is either a mistake in the glossary
    // or a sign that a missing term has been left undefined.
    const graph = buildConceptGraph()
    const orphans = graph.nodes.filter((node) => node.degree === 0).map((node) => node.term)
    expect(orphans).toEqual([])
  })

  it('links every term to at least one other term', () => {
    const graph = buildConceptGraph()
    const names = new Set(graph.nodes.map((node) => node.id))
    for (const node of graph.nodes) {
      expect(node.related.length, `${node.term} relates to nothing`).toBeGreaterThan(0)
      for (const related of node.related) {
        expect(names.has(related)).toBe(true)
      }
    }
  })

  it('handles a graph with no nodes', () => {
    expect(layoutConceptGraph({ nodes: [], edges: [] }).nodes).toEqual([])
  })
})
