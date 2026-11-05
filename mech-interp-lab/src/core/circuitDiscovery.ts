/**
 * Automated circuit discovery, on a model whose circuit we already know.
 *
 * ACDC (Conmy et al., 2023) turns "what is the circuit for this behaviour?" into a
 * search. The search needs one thing: a way to ask of any proposed circuit *how
 * much of the behaviour it accounts for*. This module supplies that, and then the
 * pruning loop that uses it.
 *
 * **The graph.** A node is the token embedding, an attention head, or the readout.
 * An edge is one head's write reaching one input of a later node, and it is
 * labelled with the input it reaches — `query`, `key`, `value`, or `logit` for the
 * write that goes straight to the answer. That is the framework's decomposition of
 * a head: three ways in, one way out. Two heads in the same layer are not joined,
 * because they read the same stream rather than each other's.
 *
 * **Completing a run.** Given a graph, run the model on the *corrupted* input but
 * let every edge in the graph carry what it carried on the *clean* input, and
 * recompute each head from the mixed inputs it is now reading — the recomputation
 * is what makes this a circuit and not a sum of activations. Two numbers come out
 * of the same machinery, run twice with the roles swapped:
 *
 *   faithfulness  = how much of the behaviour the graph produces on its own
 *   completeness  = how little the behaviour loses when everything else is cut
 *
 * A graph can fail either way. One that is faithful but not complete is an
 * explanation that leans on a component it has not named; one that is complete but
 * not faithful is a bag of components that are individually necessary and not
 * together sufficient. ACDC's curve plots both against the number of edges left in
 * the graph as the search deletes them.
 *
 * **The attribution score of an edge** is the fraction of the whole behavioural gap
 * that deleting that one edge loses, with the rest of the current graph still in
 * place. Each step deletes the smallest-|score| edge and starts again, which is why
 * an edge's score depends on its neighbours: an inhibitory edge scores negative, and
 * the search takes the magnitude.
 *
 * Everything here runs on `attention.ts`'s hand-wired and seeded models. On the
 * wired induction circuit the ground truth is the wiring itself, so the search's
 * answer is checkable rather than plausible — which is the only honest way to test
 * an automated discoverer.
 */

import {
  attentionPattern,
  headOutputs,
  logitDifference,
  type AttentionModel,
  type Circuit,
  type HeadRun,
  type Measure,
  type Run,
} from './attention'
import { addVectors, dot, subtractVectors } from '@llm-materials/course-core'
import type { Vector } from '@llm-materials/course-core'

/* --------------------------------------------------------------------- the graph */

/** The node that is not a head: the token embedding, or the readout. */
export const EMBED_NODE = 'embed'
export const READOUT_NODE = 'logit'

/** Which input of the target an edge writes into. `'logit'` is the direct path to the answer. */
export type EdgeCircuit = Circuit | 'logit'

/** How an edge's input reads on a screen. */
const CIRCUIT_LABEL: Record<EdgeCircuit, string> = {
  query: 'queries',
  key: 'keys',
  value: 'values',
  logit: 'the answer',
}

export interface CircuitNode {
  /** The graph's own name for this node: `'embed'`, `'logit'` or `'layer:head'`. */
  id: string
  kind: 'embedding' | 'head' | 'readout'
  layer: number
  head: number
  name: string
}

export interface Edge {
  id: string
  source: string
  target: string
  circuit: EdgeCircuit
  /** `previous-token head → induction head (keys)`, for a report. */
  name: string
}

/** The graph name of a head. */
export function headNode(layer: number, head: number): string {
  return `${layer}:${head}`
}

/** The stable order every search and every screen uses. */
export function allNodes(model: AttentionModel): CircuitNode[] {
  const nodes: CircuitNode[] = [
    { id: EMBED_NODE, kind: 'embedding', layer: -1, head: -1, name: 'the token embedding' },
  ]
  model.layers.forEach((layer, l) => {
    layer.forEach((head, h) => {
      nodes.push({ id: headNode(l, h), kind: 'head', layer: l, head: h, name: head.name })
    })
  })
  nodes.push({ id: READOUT_NODE, kind: 'readout', layer: model.layers.length, head: -1, name: 'the readout' })
  return nodes
}

/** The nodes whose write a layer's heads can read: the embedding and every earlier head. */
function sourcesOfLayer(model: AttentionModel, layer: number): string[] {
  const out = [EMBED_NODE]
  for (let earlier = 0; earlier < layer; earlier++) {
    for (let head = 0; head < model.layers[earlier].length; head++) out.push(headNode(earlier, head))
  }
  return out
}

/** Every edge of the model: three inputs per reading head, one logit path per writing head. */
export function allEdges(model: AttentionModel): Edge[] {
  const byId = new Map(allNodes(model).map((node) => [node.id, node]))
  const edges: Edge[] = []
  const push = (source: string, target: string, circuit: EdgeCircuit) => {
    edges.push({
      id: `${source}->${target}:${circuit}`,
      source,
      target,
      circuit,
      name: `${byId.get(source)?.name} → ${byId.get(target)?.name} (${CIRCUIT_LABEL[circuit]})`,
    })
  }
  model.layers.forEach((layer, l) => {
    layer.forEach((_, h) => {
      for (const source of sourcesOfLayer(model, l)) {
        for (const circuit of ['query', 'key', 'value'] as Circuit[]) push(source, headNode(l, h), circuit)
      }
    })
  })
  for (const source of sourcesOfLayer(model, model.layers.length)) push(source, READOUT_NODE, 'logit')
  return edges
}

/** The universe of edge ids, so a search can start from "everything". */
export function allEdgeIds(model: AttentionModel): string[] {
  return allEdges(model).map((edge) => edge.id)
}

/** The edges not in the given set, in the universe's order. */
export function complementEdges(model: AttentionModel, kept: Iterable<string>): string[] {
  const set = new Set(kept)
  return allEdgeIds(model).filter((id) => !set.has(id))
}

/** The nodes that at least one kept edge touches. */
export function nodesInGraph(model: AttentionModel, kept: Iterable<string>): CircuitNode[] {
  const set = new Set(kept)
  const touched = new Set<string>()
  for (const edge of allEdges(model)) {
    if (set.has(edge.id)) {
      touched.add(edge.source)
      touched.add(edge.target)
    }
  }
  return allNodes(model).filter((node) => touched.has(node.id))
}

/* ------------------------------------------------------------------- completion */

/** A forward pass over a graph-completed run. Not a `Run`: a head reads a per-input mix, so there is no single stream to report. */
export interface CompletedRun {
  tokens: number[]
  /** Every head, recomputed from the inputs the graph gave it. */
  heads: HeadRun[]
  /** `logits[position][token]`, read off the completed final stream. */
  logits: number[][]
}

export interface CompletionOptions {
  /** The edges that carry the *other* run's signal. Every other edge carries `base`'s. */
  kept: Iterable<string>
  /** Which run the pass starts from. `'corrupted'` measures faithfulness, `'clean'` measures completeness. */
  base?: 'clean' | 'corrupted'
}

/** What each node contributed at each position of a run, for the mixing below. */
function contributions(model: AttentionModel, run: Run): Map<string, Vector[]> {
  const map = new Map<string, Vector[]>()
  map.set(EMBED_NODE, run.tokens.map((token) => model.embedding[token]))
  for (const head of run.heads) map.set(headNode(head.layer, head.head), head.outputs)
  return map
}

/**
 * The graph-completed forward pass.
 *
 * Each head reads, for each of its three inputs, the base run's stream plus the
 * difference that the kept edges make: the contributions of the sources whose edge
 * into this input is kept are taken from the other run — or, for a source that is
 * itself in the graph, from what it has just been recomputed to write. The head
 * then attends and writes from that mix, so the non-linearity is applied to the
 * completed input rather than to a blend of two answers.
 *
 * Two identities make this checkable, and both are tested: keeping every edge
 * reproduces the other run's metric exactly, and keeping none reproduces the base
 * run's.
 */
export function completeGraph(
  model: AttentionModel,
  clean: Run,
  corrupted: Run,
  options: CompletionOptions,
): CompletedRun {
  if (clean.tokens.length !== corrupted.tokens.length) {
    throw new RangeError('completeGraph: the clean and corrupted runs must be the same length.')
  }
  const base = options.base ?? 'corrupted'
  const from = base === 'corrupted' ? corrupted : clean
  const to = base === 'corrupted' ? clean : corrupted
  const kept = new Set(options.kept)
  const fromAt = contributions(model, from)
  const toAt = contributions(model, to)

  const completed = new Map<string, Vector[]>()
  const heads: HeadRun[] = []

  /** What a source contributes along a kept edge: the other run's signal, or the completed head's own. */
  const restored = (source: string, position: number): Vector => {
    const recomputed = completed.get(source)
    if (recomputed) return recomputed[position] ?? fromAt.get(source)![position]!
    return toAt.get(source)![position]!
  }
  const carried = (source: string, position: number): Vector => fromAt.get(source)![position]!

  for (let layer = 0; layer < model.layers.length; layer++) {
    const baseStream = from.inputs[layer]
    for (let head = 0; head < model.layers[layer].length; head++) {
      const params = model.layers[layer][head]
      const sources = sourcesOfLayer(model, layer)
      const mixed = (circuit: Circuit): Vector[] =>
        baseStream.map((stream, position) => {
          let input = stream
          for (const source of sources) {
            if (!kept.has(`${source}->${headNode(layer, head)}:${circuit}`)) continue
            input = addVectors(input, subtractVectors(restored(source, position), carried(source, position)))
          }
          return input
        })
      const pattern = attentionPattern(params, mixed('query'), mixed('key'))
      const { outputs } = headOutputs(params, mixed('value'), pattern)
      const id = headNode(layer, head)
      completed.set(id, outputs)
      heads.push({ layer, head, name: params.name, pattern, outputs })
    }
  }

  // The answer reads the final stream, which is the sum of every node's write;
  // the logit edges decide which of those writes reach it.
  const logitSources = sourcesOfLayer(model, model.layers.length)
  const logits = from.final.map((stream, position) => {
    let final = stream
    for (const source of logitSources) {
      if (!kept.has(`${source}->${READOUT_NODE}:logit`)) continue
      final = addVectors(final, subtractVectors(restored(source, position), carried(source, position)))
    }
    return model.readout.map((direction) => dot(direction, final))
  })

  return { tokens: from.tokens, heads, logits }
}

/** The metric of a graph-completed run. */
export function graphMetric(
  model: AttentionModel,
  clean: Run,
  corrupted: Run,
  kept: Iterable<string>,
  measure: Measure,
  base: 'clean' | 'corrupted' = 'corrupted',
): number {
  return logitDifference(completeGraph(model, clean, corrupted, { kept, base }), measure)
}

export interface GraphQuality {
  /** How much of the behaviour the graph produces on its own, from the corrupted input. 1 is enough. */
  faithfulness: number
  /** How little the behaviour loses when everything outside the graph is cut. 1 is complete. */
  completeness: number
  edges: number
  /** `metric(clean) - metric(corrupted)`, the gap both numbers are scaled by. */
  gap: number
}

/**
 * The two criteria, on one scale.
 *
 * Both are the completed metric, less the corrupted metric, over the gap between the
 * clean and corrupted runs — the first with the graph's edges carrying the clean
 * signal, the second with everything *outside* the graph carrying the corrupted one.
 * So 1 is the good end in both directions, and the pair is what a circuit is graded
 * on: a faithful but incomplete graph explains the behaviour while leaving a
 * component unnamed, a complete but unfaithful one lists components that are not
 * enough on their own.
 */
export function graphQuality(
  model: AttentionModel,
  clean: Run,
  corrupted: Run,
  measure: Measure,
  kept: Iterable<string>,
): GraphQuality {
  const set = new Set(kept)
  const cleanMetric = logitDifference(clean, measure)
  const corruptedMetric = logitDifference(corrupted, measure)
  const gap = cleanMetric - corruptedMetric
  const scaled = (value: number): number => (Math.abs(gap) < 1e-12 ? 0 : (value - corruptedMetric) / gap)
  return {
    faithfulness: scaled(graphMetric(model, clean, corrupted, set, measure, 'corrupted')),
    completeness: scaled(graphMetric(model, clean, corrupted, complementEdges(model, set), measure, 'clean')),
    edges: set.size,
    gap,
  }
}

/* ------------------------------------------------------------------ attribution */

export interface EdgeScore {
  edge: Edge
  /** The completed metric with this edge in the graph. */
  withEdge: number
  /** The same with this edge deleted, everything else untouched. */
  withoutEdge: number
  /** `(withEdge - withoutEdge) / gap`: the share of the behaviour this edge carries. */
  score: number
}

/**
 * The edge attribution scores ACDC prunes by.
 *
 * Each score is one edge's marginal contribution to the *current* graph, so the
 * numbers are not a property of the edge alone: an edge that only matters because
 * another one is present will look essential now and vanish as soon as its partner
 * is deleted. That is why the search re-scores the whole remaining graph at every
 * step instead of ranking once.
 *
 * Inhibitory edges score negative. The pruning compares magnitudes, not signs, so a
 * head that suppresses the answer is kept for exactly as long as one that promotes
 * it.
 */
export function attributeEdges(
  model: AttentionModel,
  clean: Run,
  corrupted: Run,
  measure: Measure,
  options: { kept?: Iterable<string> } = {},
): EdgeScore[] {
  const universe = allEdges(model)
  const requested = options.kept === undefined ? undefined : new Set(options.kept)
  const present = universe.filter((edge) => (requested ? requested.has(edge.id) : true))
  const gap = logitDifference(clean, measure) - logitDifference(corrupted, measure)
  const ids = present.map((edge) => edge.id)
  const withEdge = graphMetric(model, clean, corrupted, ids, measure, 'corrupted')
  const scale = Math.abs(gap) < 1e-12 ? 1 : gap
  return present.map((edge) => {
    const without = graphMetric(model, clean, corrupted, ids.filter((id) => id !== edge.id), measure, 'corrupted')
    return { edge, withEdge, withoutEdge: without, score: (withEdge - without) / scale }
  })
}

/* ----------------------------------------------------------------------- search */

export interface PruneStep {
  /** Edges still in the graph after this deletion. */
  kept: string[]
  /** The edge this step deleted, and the score it had. */
  removed: EdgeScore
  /** The scores that justified it, on the graph as it was before the deletion. */
  scores: EdgeScore[]
  faithfulness: number
  completeness: number
  edges: number
}

export interface CircuitSearch {
  /** Step 0 is the full graph, before any deletion. */
  full: { kept: string[]; faithfulness: number; completeness: number; edges: number }
  steps: PruneStep[]
  /** The fewest edges that still reach `threshold` — the circuit ACDC would report. */
  discovered: string[]
  discoveredEdges: number
  /** Where the faithfulness curve fell through the threshold. */
  threshold: number
  /** `metric(clean) - metric(corrupted)`. */
  gap: number
  /** How many completed runs the search ran, so a screen can be honest about the cost. */
  passes: number
}

export interface SearchOptions {
  /** The faithfulness a graph has to keep for it to count as an explanation. */
  threshold?: number
  /** How many deletions to try; defaults to the whole graph. */
  maxSteps?: number
  /** Start from fewer than all edges, to ask what a hand-built circuit would be pruned to. */
  kept?: Iterable<string>
}

/**
 * ACDC: score every edge in the graph, delete the least-scored one, repeat until
 * nothing is left, and report the circuit that survived longest while still being
 * faithful.
 *
 * The answer is taken from the *last* step that cleared the threshold rather than
 * the first, which is the whole point of pruning: a graph that is faithful with
 * fewer edges is a better explanation than the same story with spare parts in it.
 * Nothing here is trained, and nothing here is human: the circuit is whatever the
 * scores say it is, on a model whose wiring lets us check whether it is right.
 */
export function discoverCircuit(
  model: AttentionModel,
  clean: Run,
  corrupted: Run,
  measure: Measure,
  options: SearchOptions = {},
): CircuitSearch {
  const threshold = options.threshold ?? 0.8
  const universe = allEdgeIds(model)
  let kept = new Set(options.kept === undefined ? universe : [...options.kept].filter((id) => universe.includes(id)))
  const gap = logitDifference(clean, measure) - logitDifference(corrupted, measure)
  let passes = 0

  const countPasses = (keptSet: Set<string>): GraphQuality => {
    passes += 2
    return graphQuality(model, clean, corrupted, measure, keptSet)
  }

  const opening = countPasses(kept)
  const full = { kept: [...kept], faithfulness: opening.faithfulness, completeness: opening.completeness, edges: kept.size }
  const steps: PruneStep[] = []
  const maxSteps = options.maxSteps ?? kept.size

  for (let step = 0; step < maxSteps && kept.size > 0; step++) {
    passes += kept.size
    const scores = attributeEdges(model, clean, corrupted, measure, { kept })
    let weakest = scores[0]!
    for (const candidate of scores) {
      if (Math.abs(candidate.score) < Math.abs(weakest.score)) weakest = candidate
    }
    kept = new Set([...kept].filter((id) => id !== weakest.edge.id))
    const quality = countPasses(kept)
    steps.push({
      kept: [...kept],
      removed: weakest,
      scores,
      faithfulness: quality.faithfulness,
      completeness: quality.completeness,
      edges: kept.size,
    })
  }

  let discovered: string[] = full.kept
  let discoveredEdges = full.edges
  for (const step of steps) {
    if (step.faithfulness >= threshold) {
      discovered = step.kept
      discoveredEdges = step.edges
    }
  }

  return { full, steps, discovered, discoveredEdges, threshold, gap, passes }
}

/** The names of a discovered graph's edges, for a table or a caption. */
export function edgeNames(model: AttentionModel, kept: Iterable<string>): string[] {
  const set = new Set(kept)
  return allEdges(model)
    .filter((edge) => set.has(edge.id))
    .map((edge) => edge.name)
}

/* ------------------------------------------------------------------- corruption */

export interface TokenEdit {
  position: number
  token: number
}

/**
 * The corrupted input: the same tokens with a chosen one replaced.
 *
 * ACDC needs a behavioural gap to scale by, and a same-length swap supplies it
 * without changing the shape of the task. For induction, patching out the earlier
 * occurrence of the query token leaves the question standing and destroys the
 * answer, which is the corruption the circuit is being asked to explain.
 */
export function corruptTokens(tokens: number[], edits: TokenEdit[]): number[] {
  const out = tokens.slice()
  for (const edit of edits) {
    if (edit.position < 0 || edit.position >= out.length) {
      throw new RangeError(`corruptTokens: position ${edit.position} is outside a sequence of length ${out.length}.`)
    }
    out[edit.position] = edit.token
  }
  return out
}
