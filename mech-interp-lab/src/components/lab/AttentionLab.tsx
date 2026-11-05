import { useMemo, useState } from 'react'
import { dot, fmt, subtractVectors } from '@llm-materials/course-core'
import {
  ablateHeads,
  circuitShape,
  directLogitEffect,
  dominantTerm,
  decomposePathway,
  headRun,
  headScores,
  logitDifference,
  ovWrites,
  patchPath,
  qkCircuit,
  ovCircuit,
  runModel,
  valueWrites,
  type CircuitChoice,
  type Measure,
} from '../../core/attention'
import {
  INDUCTION_SEQUENCE,
  INDUCTION_TOKENS,
  inductionModel,
  inductionTargets,
} from '../../core/inductionModel'
import { Callout, DataTable, Figure, Panel, SegmentedControl, Stat, TrendChart } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'
import { ATTENTION_DEFAULTS } from '../../content/labDefaults'

type View = 'pathway' | 'circuits' | 'paths'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const ATTENTION_VIEWS: { value: View; label: string }[] = [
  { value: 'pathway', label: 'The pathway' },
  { value: 'circuits', label: 'The two circuits' },
  { value: 'paths', label: 'The paths' },
]

const letter = (token: number) => INDUCTION_TOKENS[token] ?? '?'

/** Every head of the wired model, in the order the model reads them. */
const HEADS = inductionModel.layers.flatMap((layer, l) =>
  layer.map((head, h) => ({ layer: l, head: h, name: head.name })),
)

const LAST_LAYER = inductionModel.layers.length - 1

/** The positions where an earlier occurrence makes the next token predictable. */
const TARGETS = inductionTargets()

const CIRCUIT_LABEL: Record<CircuitChoice, string> = {
  query: 'the query',
  key: 'the key',
  value: 'the value',
  qk: 'the QK circuit',
}

export function AttentionLab() {
  const [view, setView] = useViewParam(ATTENTION_VIEWS)
  const [headIndex, setHeadIndex] = useState(ATTENTION_DEFAULTS.headIndex)
  const [targetIndex, setTargetIndex] = useState(ATTENTION_DEFAULTS.targetIndex)

  const head = HEADS[headIndex]!
  const target = TARGETS[targetIndex]!
  /** The token the circuit has to predict, against the token already at the position. */
  const measure: Measure = {
    position: target.position,
    winner: target.expected,
    loser: INDUCTION_SEQUENCE[target.position] ?? 0,
  }

  const clean = useMemo(() => runModel(inductionModel, INDUCTION_SEQUENCE), [])
  const params = inductionModel.layers[head.layer][head.head]
  const headIsLastLayer = head.layer === LAST_LAYER

  /** The exact split, or the number that stands in for it when the head is not in the last layer. */
  const pathway = useMemo(
    () =>
      headIsLastLayer
        ? decomposePathway(inductionModel, clean, { layer: head.layer, head: head.head, position: target.position, measure })
        : null,
    [headIsLastLayer, head.layer, head.head, target.position, measure.winner, measure.loser, clean],
  )

  const direct = useMemo(
    () => directLogitEffect(inductionModel, clean, head, measure),
    [head.layer, head.head, measure.position, measure.winner, measure.loser, clean],
  )

  const metric = useMemo(() => logitDifference(clean, measure), [clean])

  /** The two circuits, and whether the factorisation the framework claims actually holds here. */
  const circuits = useMemo(() => {
    const qk = qkCircuit(params)
    const ov = ovCircuit(params)
    let factorGap = 0
    for (const input of clean.inputs[0]) {
      const combined = ovWrites(params, input)
      const staged = valueWrites(params, input)
      for (let i = 0; i < combined.length; i++) {
        factorGap = Math.max(factorGap, Math.abs((combined[i] ?? 0) - (staged[i] ?? 0)))
      }
    }
    return { qk: circuitShape(qk), ov: circuitShape(ov), factorGap }
  }, [params, clean])

  /** One row per source position: the where, the what, and their product. */
  const positions = useMemo(() => {
    const inputs = clean.inputs[head.layer]
    const scores = headScores(params, inputs)[target.position] ?? []
    const pattern = headRun(clean, head.layer, head.head).pattern[target.position] ?? []
    const readoutDiff = subtractVectors(
      inductionModel.readout[measure.winner]!,
      inductionModel.readout[measure.loser]!,
    )
    return pattern.map((attention, source) => {
      const written = ovWrites(params, inputs[source] ?? [])
      const writes = dot(written, readoutDiff)
      return { source, token: INDUCTION_SEQUENCE[source] ?? 0, score: scores[source] ?? 0, attention, writes, product: attention * writes }
    })
  }, [params, head.layer, head.head, target.position, measure.winner, measure.loser, clean])

  /** Every path from an earlier head into this one, asked circuit by circuit. */
  const paths = useMemo(() => {
    if (head.layer === 0) return []
    const out: { via: string; circuit: CircuitChoice; effect: number; fraction: number }[] = []
    for (const via of HEADS.filter((candidate) => candidate.layer < head.layer)) {
      const source = ablateHeads(inductionModel, INDUCTION_SEQUENCE, [via])
      for (const circuit of ['query', 'key', 'value'] as CircuitChoice[]) {
        const report = patchPath(inductionModel, clean, source, { from: via, to: head, circuits: [circuit] }, measure)
        out.push({ via: via.name, circuit, effect: report.effect, fraction: report.effect / metric })
      }
    }
    return out.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
  }, [head.layer, head.head, measure.position, measure.winner, measure.loser, clean, metric])

  const strongestPath = paths[0]
  const dominant = pathway ? dominantTerm(pathway) : null

  return (
    <div className="lab">
      <Panel
        title="Laboratory D · One head, two circuits"
        subtitle="The QK circuit decides where a head looks, the OV circuit what it writes, and the path between two heads is where the interesting things live"
        accent="violet"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={ATTENTION_VIEWS}
          />
          <SegmentedControl
            label="The head"
            value={String(headIndex)}
            onChange={(value) => setHeadIndex(Number(value))}
            options={HEADS.map((entry, index) => ({ value: String(index), label: entry.name }))}
          />
          <SegmentedControl
            label="The position"
            value={String(targetIndex)}
            onChange={(value) => setTargetIndex(Number(value))}
            options={TARGETS.map((entry, index) => ({
              value: String(index),
              label: `position ${entry.position}: ${letter(INDUCTION_SEQUENCE[entry.position] ?? 0)} should predict ${letter(entry.expected)}`,
            }))}
          />
        </div>

        <div className="stat-row">
          <Stat label="The metric" value={fmt(metric, 4)} hint="the logit difference, clean run" />
          <Stat
            label="The split"
            value={pathway ? fmt(pathway.total, 4) : '—'}
            hint="the sum of the terms"
          />
          <Stat
            label="The ablation"
            value={pathway ? fmt(pathway.measured, 4) : '—'}
            hint="the same head zeroed and re-run"
          />
          <Stat
            label="The discrepancy"
            value={pathway ? fmt(Math.abs(pathway.discrepancy), 3) : 'direct effect only'}
            hint={pathway ? 'the two numbers above, subtracted' : 'no exact split exists for this head'}
            tone={pathway && Math.abs(pathway.discrepancy) < 1e-9 ? 'good' : 'default'}
          />
        </div>

        {view === 'pathway' ? (
          <>
            <Figure
              title={`Where ${head.name} puts its attention, and what each source is worth`}
              description="The attention from the chosen position to each earlier one, and the OV circuit's write from that position read against the two answer directions."
              caption={`The identity is effect = Σ (attention × write). The head in the last layer has no non-linearity downstream of it, so the sum is exact and equals what ablating the head costs — here the two agree to ${
                pathway ? fmt(Math.abs(pathway.discrepancy), 2) : 'n/a'
              }.`}
            >
              <TrendChart
                data={positions.map((row) => ({
                  x: row.source,
                  attention: row.attention,
                  writes: row.writes,
                  term: row.product,
                }))}
                series={[
                  { key: 'attention', name: 'the attention', colour: 'var(--accent-indigo)' },
                  { key: 'writes', name: 'what the OV circuit writes', colour: 'var(--accent-teal)' },
                  { key: 'term', name: 'the product', colour: 'var(--accent-violet)', dashed: true },
                ]}
                xLabel="the source position"
                yLabel="the term and its two factors"
                height={260}
              />
              <DataTable
                caption="The decomposition, term by term"
                headers={['Source', 'Token', 'Score', 'Attention', 'The write', 'The term']}
                rows={positions.map((row) => [
                  row.source,
                  letter(row.token),
                  fmt(row.score, 3),
                  fmt(row.attention, 4),
                  fmt(row.writes, 4),
                  fmt(row.product, 4),
                ])}
              />
            </Figure>

            {pathway && dominant ? (
              <Callout tone="definition" title="The one term that carries the answer">
                Source {dominant.source} — the token {letter(INDUCTION_SEQUENCE[dominant.source] ?? 0)} — contributes{' '}
                {fmt(dominant.term, 4)} of the {fmt(pathway.total, 4)} total. That is the pathway reading: the head is
                sent to one position by its QK circuit and copies one token with its OV circuit, and the product of
                those two facts is the behaviour.
              </Callout>
            ) : (
              <Callout tone="warning" title="Why this head has no exact split">
                {head.name} sits in layer {head.layer}, and a head in the first layer writes into a stream that another
                head's softmax then reads. The softmax is not linear, so the head's total effect does not decompose into
                a term per source position — asking for one throws rather than printing a number that merely looks
                plausible. What is exact for any head is its <em>direct</em> effect at the answer position, and here
                that is {fmt(direct, 4)}.
              </Callout>
            )}
          </>
        ) : null}

        {view === 'circuits' ? (
          <>
            <Figure
              title={`The two matrices of ${head.name}`}
              description="The QK circuit W_Qᵀ W_K is read by the query and the key; the OV circuit W_O W_V carries what the head found back into the stream."
              caption="Each head is four matrices, and the pair of products below is all of what it can do: one to choose a position, one to write a vector from it. The counts are computed from this head's weights, not quoted — an 18×18 QK circuit that is non-zero in a handful of cells is a head that looks in one place."
            >
              <DataTable
                caption="The circuits, measured"
                headers={['Circuit', 'Size', 'Non-zero cells', 'The largest entry', 'Frobenius norm']}
                rows={[
                  ['QK — where it looks', `${circuits.qk.cells}`, circuits.qk.nonZero, fmt(circuits.qk.largest, 3), fmt(circuits.qk.frobenius, 3)],
                  ['OV — what it writes', `${circuits.ov.cells}`, circuits.ov.nonZero, fmt(circuits.ov.largest, 3), fmt(circuits.ov.frobenius, 3)],
                ]}
              />
              <DataTable
                caption="The attention and the write, per source"
                headers={['Source', 'Token', 'Score', 'Attention', 'Write against the answer']}
                rows={positions.map((row) => [
                  row.source,
                  letter(row.token),
                  fmt(row.score, 3),
                  fmt(row.attention, 4),
                  fmt(row.writes, 4),
                ])}
              />
            </Figure>

            <Callout tone="note" title="The factorisation, checked on this head">
              The framework's claim is that `W_O (W_V x)` and `(W_O W_V) x` are the same vector, so the OV circuit can
              be read off the head once and applied to any input. On this head the two agree to{' '}
              {fmt(circuits.factorGap, 3)} across the whole sequence, which is the number the tests drive to zero on
              random weights. The head's temperature ({fmt(params.temperature, 3)}) and its distance bias
              ({params.distanceBias.join(', ') || 'none'}) sit on top of the QK circuit and are the reason the attention
              is a near-hard choice rather than a blur.
            </Callout>
          </>
        ) : null}

        {view === 'paths' ? (
          <>
            <Figure
              title={`What reaches ${head.name}`}
              description="Each earlier head is ablated — its output replaced by zeroes — and the difference is substituted into one circuit input of this head alone."
              caption="A head's QK circuit is a property of the path into it, not of the head. Ablating a first-layer head and writing that ablation into the query, the key and the value in turn says which of the three the earlier head was reaching. The metric is held at the clean run everywhere else."
            >
              {paths.length > 0 ? (
                <DataTable
                  caption="The paths, ranked by magnitude"
                  headers={['The ablated head', 'Into', 'The effect', 'Share of the answer']}
                  rows={paths.map((path) => [path.via, CIRCUIT_LABEL[path.circuit], fmt(path.effect, 4), fmt(path.fraction, 4)])}
                />
              ) : (
                <Callout tone="note" title="Nothing upstream">
                  {head.name} is in the first layer, so the only thing that writes what it reads is the embedding. Path
                  patching is a question about composition, and there is no composition below a first-layer head.
                  Choose a head in layer {LAST_LAYER} to see the paths into it.
                </Callout>
              )}
            </Figure>

            {strongestPath ? (
              <Callout tone="definition" title="The path that matters">
                {strongestPath.via} reaches {head.name} through {CIRCUIT_LABEL[strongestPath.circuit]}, and the
                substitution moves the metric by {fmt(strongestPath.effect, 4)} — {fmt(strongestPath.fraction * 100, 1)}
                % of what the clean run was worth. That is the framework's claim in one number: the composed circuit
                cannot be read off either head alone, only off the edge between them.
              </Callout>
            ) : null}
          </>
        ) : null}

        <Callout tone="warning" title="What this model is">
          A hand-wired two-layer attention model with eighteen residual-stream dimensions, six tokens and three heads:
          the previous-token head, the duplicate-token head and the induction head. Nothing was trained, every weight is
          set in `inductionModel.ts`, and the ground truth is the wiring. That is why the decomposition above can be
          asserted rather than believed — and why it says nothing about GPT-2.
        </Callout>
      </Panel>
    </div>
  )
}
