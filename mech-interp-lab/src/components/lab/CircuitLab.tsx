import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  allEdgeIds,
  attributeEdges,
  corruptTokens,
  discoverCircuit,
  edgeNames,
  graphQuality,
  nodesInGraph,
} from '../../core/circuitDiscovery'
import { logitDifference, runModel } from '../../core/attention'
import {
  CORRUPTION_SITES,
  INDUCTION_SEQUENCE,
  INDUCTION_TOKENS,
  corruptionSite,
  inductionCircuitEdges,
  inductionModel,
  inductionTargets,
  sitePosition,
  type CorruptionSite,
} from '../../core/inductionModel'
import { Callout, DataTable, Figure, Panel, SegmentedControl, Slider, Stat, TrendChart } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'
import { CIRCUIT_DEFAULTS } from '../../content/labDefaults'

type View = 'scores' | 'prune' | 'check'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const CIRCUIT_VIEWS: { value: View; label: string }[] = [
  { value: 'scores', label: 'The edge scores' },
  { value: 'prune', label: 'The pruning' },
  { value: 'check', label: 'Against the wiring' },
]

const letter = (token: number) => INDUCTION_TOKENS[token] ?? '?'
const TARGETS = inductionTargets()
const UNIVERSE = allEdgeIds(inductionModel)
const TRUTH = inductionCircuitEdges()
const OTHER: Record<CorruptionSite, CorruptionSite> = { occurrence: 'successor', successor: 'occurrence' }

export function CircuitLab() {
  const [view, setView] = useViewParam(CIRCUIT_VIEWS)
  const [targetIndex, setTargetIndex] = useState(CIRCUIT_DEFAULTS.targetIndex)
  const [site, setSite] = useState<CorruptionSite>(CIRCUIT_DEFAULTS.site)
  const [replacement, setReplacement] = useState(CIRCUIT_DEFAULTS.replacement)
  const [threshold, setThreshold] = useState(CIRCUIT_DEFAULTS.threshold)
  const [maxSteps, setMaxSteps] = useState(UNIVERSE.length)

  const target = TARGETS[targetIndex]!
  const corruptedAt = sitePosition(target, site)
  const editedTokens = useMemo(
    () => corruptTokens(INDUCTION_SEQUENCE, [{ position: corruptedAt, token: replacement }]),
    [corruptedAt, replacement],
  )

  const clean = useMemo(() => runModel(inductionModel, INDUCTION_SEQUENCE), [])
  const corrupted = useMemo(() => runModel(inductionModel, editedTokens), [editedTokens])

  const measure = useMemo(
    () => ({ position: target.position, winner: target.expected, loser: INDUCTION_SEQUENCE[target.position] ?? 0 }),
    [target.position, target.expected],
  )

  const gap = logitDifference(clean, measure) - logitDifference(corrupted, measure)

  const scores = useMemo(
    () =>
      attributeEdges(inductionModel, clean, corrupted, measure).sort(
        (a, b) => Math.abs(b.score) - Math.abs(a.score),
      ),
    [clean, corrupted, measure],
  )

  const search = useMemo(
    () => discoverCircuit(inductionModel, clean, corrupted, measure, { threshold, maxSteps }),
    [clean, corrupted, measure, threshold, maxSteps],
  )

  const truthQuality = useMemo(
    () => graphQuality(inductionModel, clean, corrupted, measure, TRUTH),
    [clean, corrupted, measure],
  )

  const found = TRUTH.filter((edge) => search.discovered.includes(edge))
  const extra = search.discovered.filter((edge) => !TRUTH.includes(edge))
  const missed = TRUTH.filter((edge) => !search.discovered.includes(edge))

  /**
   * What the same search answers when the corruption lands on the other position.
   *
   * Run to completion rather than to the screen's deletion slider: the question here
   * is what a corruption is capable of showing, not how far this reader chose to prune.
   */
  const other = useMemo(() => {
    const position = sitePosition(target, OTHER[site])
    const run = runModel(inductionModel, corruptTokens(INDUCTION_SEQUENCE, [{ position, token: replacement }]))
    return { position, discovered: discoverCircuit(inductionModel, clean, run, measure, { threshold }).discovered }
  }, [target, site, replacement, clean, measure, threshold])

  const carriers = scores.filter((entry) => Math.abs(entry.score) > 1e-6)
  const union = TRUTH.filter((edge) => search.discovered.includes(edge) || other.discovered.includes(edge))
  const otherFound = TRUTH.filter((edge) => other.discovered.includes(edge))
  const thisSite = corruptionSite(site)
  const altSite = corruptionSite(OTHER[site])

  const curve = [
    { x: search.full.edges, faithfulness: search.full.faithfulness, completeness: search.full.completeness },
    ...search.steps.map((step) => ({ x: step.edges, faithfulness: step.faithfulness, completeness: step.completeness })),
  ]

  return (
    <div className="lab">
      <Panel
        title="Laboratory F · Automated circuit discovery"
        subtitle="ACDC, run on a model whose circuit is already known, so its answer can be checked instead of admired"
        accent="sky"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={CIRCUIT_VIEWS}
          />
          <SegmentedControl
            label="The behaviour"
            value={String(targetIndex)}
            onChange={(value) => setTargetIndex(Number(value))}
            options={TARGETS.map((entry, index) => ({
              value: String(index),
              label: `position ${entry.position}: ${letter(INDUCTION_SEQUENCE[entry.position] ?? 0)} should predict ${letter(entry.expected)}`,
            }))}
          />
          <SegmentedControl
            label="The corruption erases"
            value={site}
            onChange={(value) => setSite(value as CorruptionSite)}
            options={CORRUPTION_SITES}
          />
          <Slider
            label="Replaced with"
            value={replacement}
            min={0}
            max={INDUCTION_TOKENS.length - 1}
            onChange={setReplacement}
            format={(value) => `${letter(value)} (token ${value})`}
            hint={`Position ${corruptedAt} — ${letter(INDUCTION_SEQUENCE[corruptedAt] ?? 0)}, the ${thisSite.role} for the token at position ${target.position} — is replaced with this one. ${thisSite.note}`}
          />
          <Slider
            label="The threshold"
            value={threshold}
            min={0.5}
            max={1}
            step={0.01}
            onChange={setThreshold}
            format={(value) => value.toFixed(2)}
            hint="How faithful a graph has to be for the search to be willing to call it the circuit."
          />
          <Slider
            label="The deletions"
            value={maxSteps}
            min={1}
            max={UNIVERSE.length}
            onChange={setMaxSteps}
            hint="How far to prune. The full run deletes every edge in the graph."
          />
        </div>

        <div className="stat-row">
          <Stat
            label="The behavioural gap"
            value={fmt(gap, 4)}
            hint="clean metric less corrupted"
            tone={Math.abs(gap) > 1e-9 ? 'good' : 'warn'}
          />
          <Stat label="The graph" value={`${UNIVERSE.length} edges`} hint="every write into every read" />
          <Stat label="The circuit found" value={`${search.discoveredEdges} edges`} hint={`at threshold ${threshold.toFixed(2)}`} />
          <Stat label="The wiring needs" value={`${TRUTH.length} edges`} hint="read off the weights, not off this search" />
          <Stat
            label="The cost"
            value={`${search.passes} runs`}
            hint="completed forward passes this search needed"
          />
        </div>

        {view === 'scores' ? (
          <>
            <Figure
              title="The attribution score of every edge"
              description="Each score is the share of the behavioural gap that this one edge carries, with all the other edges still in the graph."
              caption={`${carriers.length} of the ${UNIVERSE.length} edges carry the behaviour at all under this corruption, and the duplicate-token head’s edges are not among them: the block it writes is a block nobody reads. Which edges appear is a property of the edge *and* the intervention, not of the edge alone — move the corruption to the other position and this list changes. That is also why the search re-scores the whole graph at every step rather than trusting the ranking it started with.`}
            >
              <DataTable
                caption={`Every edge, ranked by magnitude (gap ${fmt(gap, 4)})`}
                headers={['Edge', 'In the graph', 'Out of the graph', 'The score', 'In the wiring']}
                rows={scores.map((entry) => [
                  entry.edge.name,
                  fmt(entry.withEdge, 4),
                  fmt(entry.withoutEdge, 4),
                  fmt(entry.score, 4),
                  TRUTH.includes(entry.edge.id) ? 'yes' : '—',
                ])}
              />
            </Figure>

            <Callout tone="definition" title="What the number is scaled by">
              The gap is what the corruption takes away: {fmt(logitDifference(clean, measure), 4)} on the clean sequence
              against {fmt(logitDifference(corrupted, measure), 4)} once position {corruptedAt} no longer holds{' '}
              {letter(INDUCTION_SEQUENCE[corruptedAt] ?? 0)}. Every score above is a fraction of that difference, so a
              score of one says this edge alone carries the whole behaviour.
            </Callout>
          </>
        ) : null}

        {view === 'prune' ? (
          <>
            <Figure
              title="Faithfulness and completeness against the number of edges left"
              description="The curve ACDC walks: score the graph, delete its weakest edge, and measure the graph that is left."
              caption="The answer is the smallest graph that still clears the threshold, taken from the last step that did — not the first. A graph is faithful when it produces the behaviour on its own and complete when cutting everything outside it costs nothing; both reach one on the full graph and zero on an empty one, and the interesting question is how few edges they can both be one on."
            >
              <TrendChart
                data={curve}
                series={[
                  { key: 'faithfulness', name: 'faithfulness', colour: 'var(--accent-sky)' },
                  { key: 'completeness', name: 'completeness', colour: 'var(--accent-amber)', dashed: true },
                ]}
                xLabel="edges left in the graph"
                yLabel="the score, of the gap"
                yDomain={[0, 1]}
                referenceLines={[
                  { y: threshold, label: `the threshold ${threshold.toFixed(2)}` },
                  { x: TRUTH.length, label: `the wiring needs ${TRUTH.length}` },
                ]}
                height={280}
              />
            </Figure>

            <DataTable
              caption="The deletions, in the order the search made them"
              headers={['Edge deleted', 'Its score', 'Edges left', 'Faithfulness', 'Completeness']}
              rows={search.steps.map((step) => [
                step.removed.edge.name,
                fmt(step.removed.score, 4),
                step.edges,
                fmt(step.faithfulness, 4),
                fmt(step.completeness, 4),
              ])}
            />

            <Callout tone="note" title="The circuit this search reports">
              {search.discoveredEdges} edge{search.discoveredEdges === 1 ? '' : 's'}:{' '}
              {edgeNames(inductionModel, search.discovered).join('; ') || 'nothing'}. The components it names are{' '}
              {nodesInGraph(inductionModel, search.discovered)
                .map((node) => node.name)
                .join(', ') || 'none'}.
            </Callout>
          </>
        ) : null}

        {view === 'check' ? (
          <>
            <Figure
              title="What the search found, against what the wiring says is needed"
              description="The ground truth here is not a human's opinion: it is the set of edges this model's weights make necessary, derived from the wiring above and never shown to the search."
              caption={`The wiring needs ${TRUTH.length} edges — ${edgeNames(inductionModel, TRUTH).join('; ')}. Between them they score faithfulness ${fmt(
                truthQuality.faithfulness,
                3,
              )} and completeness ${fmt(truthQuality.completeness, 3)}, which is the bar the answer is compared to. This corruption makes the search report ${
                found.length
              } of them, the other corruption ${otherFound.length}, and the two together ${union.length}.`}
            >
              <DataTable
                caption="The edge-by-edge comparison"
                headers={['The edge', 'The wiring', 'This answer', `The ${altSite.role} answer`]}
                rows={[
                  ...TRUTH.map((edge) => [
                    edgeNames(inductionModel, [edge])[0] ?? edge,
                    'needed',
                    search.discovered.includes(edge) ? 'found' : 'missed',
                    other.discovered.includes(edge) ? 'found' : 'missed',
                  ]),
                  ...extra.map((edge) => [
                    edgeNames(inductionModel, [edge])[0] ?? edge,
                    'not needed',
                    'kept anyway',
                    other.discovered.includes(edge) ? 'kept anyway' : 'dropped',
                  ]),
                ]}
              />
            </Figure>

            <div className="stat-row">
              <Stat label="Needed and found" value={`${found.length} of ${TRUTH.length}`} tone={missed.length === 0 ? 'good' : 'warn'} />
              <Stat label="Missed" value={String(missed.length)} hint="edges the wiring needs that this corruption cannot see" tone={missed.length === 0 ? 'good' : 'warn'} />
              <Stat label="Extra" value={String(extra.length)} hint="edges in the answer that the wiring does not need" tone={extra.length === 0 ? 'good' : 'warn'} />
              <Stat label="Both corruptions" value={`${union.length} of ${TRUTH.length}`} hint="the union of the two answers" tone={union.length === TRUTH.length ? 'good' : 'warn'} />
              <Stat
                label="The smallest faithful graph"
                value={`${search.steps.filter((step) => step.faithfulness >= threshold).at(-1)?.edges ?? search.full.edges} edges`}
              />
            </div>

            <Callout tone="warning" title="No single corruption shows the whole circuit">
              {missed.length === 0
                ? `At this corruption the answer names every edge the wiring needs — ${found.length} of ${TRUTH.length}.`
                : `This answer names ${found.length} of the ${TRUTH.length} edges the wiring needs. The ${missed.length} it drops — ${edgeNames(
                    inductionModel,
                    missed,
                  ).join(
                    '; ',
                  )} — are the half of the algorithm this intervention leaves untouched: corrupting position ${corruptedAt} erases the ${thisSite.role}, so those edges write the same signal in the clean and the corrupted sequence and no deletion can detect them.`}{' '}
              Move the corruption to the {altSite.role} (position {other.position}) and the picture inverts: that
              answer names {otherFound.length} of {TRUTH.length}, and the union of the two is{' '}
              {union.length === TRUTH.length ? `the whole circuit — all ${TRUTH.length} edges` : `${union.length} edges`}.
              Which is the honest form of the claim an automated search makes: a discovered circuit is a function of the
              behaviour *and* the intervention that isolates it, and either answer on its own is a subgraph rather than the
              circuit.
            </Callout>

            <Callout tone="note" title="Why extra edges are the interesting failure">
              The other way to be wrong is to over-report, and it is the more common one: an edge can sit in a faithful,
              complete answer while carrying none of the behaviour, because cutting it costs nothing and keeping it costs
              the search nothing either. This answer holds {extra.length} such edge{extra.length === 1 ? '' : 's'}. That
              is what the paper’s minimality criterion is for, and it is why a circuit discovered automatically is a
              hypothesis about the model rather than a reading of it. Here the hypothesis can be checked, because the
              model was wired by hand and the wiring is the ground truth.
            </Callout>
          </>
        ) : null}

      </Panel>
    </div>
  )
}
