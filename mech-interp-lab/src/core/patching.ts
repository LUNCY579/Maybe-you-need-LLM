/**
 * Activation patching, and the attribution that comes with it.
 *
 * The central question of mechanistic interpretability is not "what does this
 * neuron respond to" but "what does this neuron *do*". The answer is obtained
 * by intervention: run the model on one input, run it on another, and replace
 * the activation at one node with the one from the other run. If the output
 * changes, that node was causally responsible for the change.
 *
 * This module builds a small model with a *known* computation inside it, so
 * that the patching result can be checked against the truth rather than
 * merely displayed.
 */

import type { Vector } from '@llm-materials/course-core'

/** A node in the computation graph. */
export interface GraphNode {
  id: string
  /** The nodes that feed into this one. */
  inputs: string[]
  /** The weight on each input, in the same order. */
  weights: number[]
  /** A label, for the display. */
  label: string
}

export interface Graph {
  nodes: GraphNode[]
  /** The node whose value is the model's output. */
  output: string
}

/**
 * The synthetic circuit.
 *
 * Two paths run from the input to the output. The first is a "name" path: the
 * subject's name, copied. The second is an "indirect object" path: the
 * subject's property, copied through a second step.
 *
 * The toy task is the standard one: given a sentence of the form
 * "A B C D", the model must output the name of A when asked for the subject.
 * The interesting node is the one that carries the subject's name, because it
 * is the node that a *name mover* would have to touch.
 */
export function buildIndirectObjectGraph(): Graph {
  return {
    nodes: [
      { id: 'input', inputs: [], weights: [], label: 'the input' },
      { id: 'name', inputs: ['input'], weights: [0.8], label: 'the name of A' },
      { id: 'indirect', inputs: ['input'], weights: [0.6], label: 'the property of A' },
      { id: 'indirect-mover', inputs: ['indirect'], weights: [0.9], label: 'the indirect object mover' },
      { id: 'output', inputs: ['name', 'indirect-mover'], weights: [0.7, 0.3], label: 'the output' },
    ],
    output: 'output',
  }
}

/** A run of the model: the activation at every node. */
export type Run = Record<string, number>

/**
 * Run the synthetic circuit.
 *
 * The model computes a fixed linear function of the input at each node, so
 * the run is exact and the node values are known.
 */
export function runCircuit(graph: Graph, input: number[]): Run {
  const run: Run = {}
  for (const node of graph.nodes) {
    if (node.inputs.length === 0) {
      run[node.id] = input[0] ?? 0
      continue
    }
    let total = 0
    for (let i = 0; i < node.inputs.length; i++) {
      total += (run[node.inputs[i]!] ?? 0) * (node.weights[i] ?? 0)
    }
    run[node.id] = total
  }
  return run
}

/**
 * The effect of patching one node.
 *
 * The clean run is the model's behaviour on the correct input; the corrupted
 * run replaces one node's activation with the one from a different input. The
 * *effect* is how much the output moved, and the *normalised effect* is that
 * divided by how much the output would have moved had the whole computation
 * been replaced.
 */
export interface PatchResult {
  node: string
  /** The output of the clean run. */
  cleanOutput: number
  /** The output after the patch. */
  patchedOutput: number
  /** How far the output moved. */
  effect: number
  /** The effect divided by the maximum possible effect. */
  normalisedEffect: number
  /** The change in the node's own activation. */
  activationChange: number
}

/**
 * Patch one node and measure the effect on the output.
 *
 * The maximum effect — the denominator of the normalised effect — is the
 * distance between the clean output and the output of a run in which the
 * *entire* computation is replaced by the corrupted one. A node that accounts
 * for the whole of the difference has a normalised effect of one.
 */
export function patchNode(
  graph: Graph,
  cleanRun: Run,
  corruptedRun: Run,
  node: string,
): PatchResult {
  const cleanOutput = cleanRun[graph.output] ?? 0
  // The patched node keeps the corrupted run's value; everything downstream is
  // recomputed from it.
  const patchedOutput = computeFrom(graph, { ...cleanRun, [node]: corruptedRun[node] ?? 0 }, new Set([node]))
  const fullOutput = corruptedRun[graph.output] ?? 0

  const effect = patchedOutput - cleanOutput
  const maximumEffect = fullOutput - cleanOutput

  return {
    node,
    cleanOutput,
    patchedOutput,
    effect,
    normalisedEffect: Math.abs(maximumEffect) < 1e-12 ? 0 : effect / maximumEffect,
    activationChange: (corruptedRun[node] ?? 0) - (cleanRun[node] ?? 0),
  }
}

/**
 * Recompute the output of the graph from a set of node activations.
 *
 * `fixed` names the nodes whose value is held at the given activation rather
 * than recomputed. That is what a patch does: it replaces one node's value
 * and lets the rest of the computation proceed from it.
 */
export function computeFrom(graph: Graph, activations: Run, fixed?: Set<string>): number {
  return computeActivations(graph, activations, fixed)[graph.output] ?? 0
}

/**
 * Recompute every node of the graph from a set of node activations.
 *
 * `fixed` names the nodes whose value is held at the given activation rather
 * than recomputed. That is what a patch does: it replaces one node's value
 * and lets the rest of the computation proceed from it.
 */
export function computeActivations(graph: Graph, activations: Run, fixed?: Set<string>): Run {
  const order = topologicalOrder(graph)
  const values: Run = { ...activations }
  for (const id of order) {
    const node = graph.nodes.find((n) => n.id === id)
    if (!node || node.inputs.length === 0) continue
    if (fixed?.has(id)) continue
    let total = 0
    for (let i = 0; i < node.inputs.length; i++) {
      total += (values[node.inputs[i]!] ?? 0) * (node.weights[i] ?? 0)
    }
    values[id] = total
  }
  return values
}

/** The nodes of the graph in an order where every parent comes first. */
export function topologicalOrder(graph: Graph): string[] {
  const order: string[] = []
  const visited = new Set<string>()
  const visit = (id: string, stack: Set<string>): void => {
    if (visited.has(id) || stack.has(id)) return
    stack.add(id)
    const node = graph.nodes.find((n) => n.id === id)
    for (const parent of node?.inputs ?? []) visit(parent, stack)
    stack.delete(id)
    visited.add(id)
    order.push(id)
  }
  for (const node of graph.nodes) visit(node.id, new Set())
  return order
}

/**
 * The attribution of every node, by patching.
 *
 * This is the "step 3" of the workflow the circuit-discovery paper
 * describes: divide the model into a graph of smaller units, patch each one,
 * and see which of them matter.
 */
export interface Attribution {
  node: string
  label: string
  /** The normalised effect of patching the node. */
  normalisedEffect: number
  /** The raw effect. */
  effect: number
}

/** Patch every node and report the attribution. */
export function attributeAllNodes(
  graph: Graph,
  cleanRun: Run,
  corruptedRun: Run,
): Attribution[] {
  return graph.nodes
    .filter((node) => node.inputs.length > 0)
    .map((node) => {
      const result = patchNode(graph, cleanRun, corruptedRun, node.id)
      return {
        node: node.id,
        label: node.label,
        normalisedEffect: result.normalisedEffect,
        effect: result.effect,
      }
    })
    .sort((a, b) => Math.abs(b.normalisedEffect) - Math.abs(a.normalisedEffect))
}

/**
 * The faithfulness of a subgraph.
 *
 * The graph is faithful if the nodes it contains account for the whole of the
 * effect — that is, if patching them all moves the output as far as replacing
 * the whole computation would. The score is that fraction.
 */
export function faithfulness(
  graph: Graph,
  cleanRun: Run,
  corruptedRun: Run,
  includedNodes: string[],
): number {
  const all = attributeAllNodes(graph, cleanRun, corruptedRun)
  const maximum = Math.abs(all[0]?.normalisedEffect ?? 0)
  if (maximum < 1e-12) return 0

  // The effect of patching every included node at once. The patched nodes
  // keep the corrupted run's values; everything downstream is recomputed from
  // them, which is what a set of patches means.
  const patched: Run = { ...cleanRun }
  for (const node of includedNodes) {
    patched[node] = corruptedRun[node] ?? 0
  }
  const patchedOutput = computeFrom(graph, patched, new Set(includedNodes))
  const cleanOutput = cleanRun[graph.output] ?? 0
  const fullOutput = corruptedRun[graph.output] ?? 0
  const maximumEffect = Math.abs(fullOutput - cleanOutput)
  if (maximumEffect < 1e-12) return 0

  return Math.abs(patchedOutput - cleanOutput) / maximumEffect
}

/**
 * The edges of the graph, with their weights.
 *
 * The weight of an edge is the change in the child's activation when the
 * parent's is replaced — the "direct effect" that the attribution patching
 * procedure measures.
 */
export interface Edge {
  from: string
  to: string
  /** The change in the child's activation caused by the parent's. */
  weight: number
}

export function edgeWeights(graph: Graph, cleanRun: Run, corruptedRun: Run): Edge[] {
  const edges: Edge[] = []
  for (const node of graph.nodes) {
    for (const parent of node.inputs) {
      const cleanChild = cleanRun[node.id] ?? 0
      const patched: Run = { ...cleanRun, [parent]: corruptedRun[parent] ?? 0 }
      const corruptedChild = computeActivations(graph, patched, new Set([parent]))[node.id] ?? 0
      edges.push({ from: parent, to: node.id, weight: corruptedChild - cleanChild })
    }
  }
  return edges
}

/**
 * The activations of a model on a set of inputs.
 *
 * The laboratory uses this to build the dataset the autoencoder is trained
 * on: the residual stream of a model that has superposed features.
 */
export function activationsOver(
  graph: Graph,
  inputs: number[][],
): { activations: number[][]; labels: number[] } {
  const activations: number[][] = []
  const labels: number[] = []
  for (let i = 0; i < inputs.length; i++) {
    const run = runCircuit(graph, inputs[i]!)
    activations.push(Object.values(run))
    labels.push(i % 3)
  }
  return { activations, labels }
}

/** A vector of zeroes, for convenience. */
export function zeros(length: number): Vector {
  return new Array<number>(length).fill(0)
}
