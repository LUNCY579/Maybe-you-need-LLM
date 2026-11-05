import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  attributeAllNodes,
  buildIndirectObjectGraph,
  edgeWeights,
  faithfulness,
  patchNode,
  runCircuit,
  topologicalOrder,
} from '../../core/patching'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'
import { PATCHING_DEFAULTS } from '../../content/labDefaults'

type View = 'effect' | 'workflow'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const PATCHING_VIEWS: { value: View; label: string }[] = [
  { value: 'effect', label: 'The effect' },
  { value: 'workflow', label: 'The circuit' },
]

export function PatchingLab() {
  const [view, setView] = useViewParam(PATCHING_VIEWS)
  const [input, setInput] = useState(PATCHING_DEFAULTS.input)

  const graph = useMemo(() => buildIndirectObjectGraph(), [])
  const clean = useMemo(() => runCircuit(graph, [input, 2, 3]), [graph, input])
  const corrupted = useMemo(() => runCircuit(graph, [input + 3, 5, 6]), [graph, input])

  const attribution = useMemo(
    () => attributeAllNodes(graph, clean, corrupted),
    [graph, clean, corrupted],
  )
  const edges = useMemo(() => edgeWeights(graph, clean, corrupted), [graph, clean, corrupted])
  const order = useMemo(() => topologicalOrder(graph), [graph])

  const faithfulnessScore = useMemo(
    () => faithfulness(graph, clean, corrupted, attribution.map((entry) => entry.node)),
    [graph, clean, corrupted, attribution],
  )

  const patched = useMemo(
    () => attribution.map((entry) => patchNode(graph, clean, corrupted, entry.node)),
    [graph, clean, corrupted, attribution],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory C · Patching"
        subtitle="A circuit with a known computation in it, and an intervention that finds it"
        accent="amber"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={PATCHING_VIEWS}
          />
          <Slider
            label="The input"
            value={input}
            min={1}
            max={9}
            onChange={setInput}
            hint="The clean run and the corrupted run both use it; the corrupted run adds three."
          />
        </div>

        <div className="stat-row">
          <Stat label="The clean output" value={fmt(clean['output'] ?? 0, 4)} />
          <Stat label="The corrupted output" value={fmt(corrupted['output'] ?? 0, 4)} />
          <Stat
            label="The largest effect"
            value={fmt(attribution[0]?.normalisedEffect ?? 0, 4)}
            hint="the most responsible node"
            tone="good"
          />
          <Stat
            label="The faithfulness"
            value={fmt(faithfulnessScore, 4)}
            hint="of the effect the whole graph explains"
          />
        </div>

        {view === 'effect' ? (
          <>
            <Figure
              title="The effect of patching each node"
              description="For every node in the graph, the change in the output when that node's activation is replaced with the corrupted run's."
              caption="One intervention per node. A node with a large effect was causally responsible for the change in the output; a node with no effect had nothing to do with it, however much it responded to the input."
            >
              <DataTable
                caption="The patch, node by node"
                headers={['Node', 'The activation change', 'The effect on the output', 'The normalised effect']}
                rows={patched.map((result) => [
                  graph.nodes.find((node) => node.id === result.node)?.label ?? result.node,
                  fmt(result.activationChange, 4),
                  fmt(result.effect, 4),
                  fmt(result.normalisedEffect, 4),
                ])}
              />
            </Figure>

            <Callout tone="definition" title="Why the normalised effect is the number to read">
              The raw effect depends on the size of the corruption. The normalised effect divides it by the largest
              effect any node could have had, so it says what fraction of the change this node was responsible for —
              which is comparable across nodes and across models.
            </Callout>
          </>
        ) : null}

        {view === 'workflow' ? (
          <>
            <Figure
              title="The circuit, and the attribution on each edge"
              description="The graph of nodes in the order the computation runs, with the weight of each causal influence."
              caption="A circuit is a graph of components and the causal paths between them. The edge weights are the direct effects: how much a child moves when its parent is replaced."
            >
              <DataTable
                caption="The graph"
                headers={['Step', 'Node', 'Reads from', 'The edge weight']}
                rows={order.map((id, index) => {
                  const node = graph.nodes.find((entry) => entry.id === id)!
                  const incoming = edges.filter((edge) => edge.to === id)
                  return [
                    index,
                    node.label,
                    node.inputs.map((inputId) => graph.nodes.find((entry) => entry.id === inputId)?.label ?? inputId).join(', ') || '—',
                    incoming.map((edge) => fmt(edge.weight, 4)).join(', ') || '—',
                  ]
                })}
              />
            </Figure>

            <Figure
              title="The attribution, ranked"
              description="Every node, ranked by how much of the change in the output it was responsible for."
              caption="The ranking is the output of the workflow's third step. The faithfulness score below says how much of the change the whole graph accounts for — and a graph that explains ninety per cent still leaves ten per cent unexplained."
            >
              <DataTable
                caption="The attribution"
                headers={['Node', 'The effect', 'The normalised effect']}
                rows={attribution.map((entry) => [
                  entry.label,
                  fmt(entry.effect, 4),
                  fmt(entry.normalisedEffect, 4),
                ])}
              />
            </Figure>

            <Callout tone="note" title="What a finished explanation has to contain">
              Not a list of the features a model uses, and not a list of neurons that fired. It is a small set of
              components, the causal paths between them, and a statement of what each one does — enough that patching the
              circuit reproduces the behaviour.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
