import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  accuracyByRepeats,
  attentionWeights,
  buildRepeatedSequence,
  inductionReport,
  matchingPositions,
  predictNext,
  previousTokenWeights,
  TOKENS,
  type InductionVariant,
} from '../../core/induction'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'
import { INDUCTION_DEFAULTS } from '../../content/labDefaults'

type View = 'circuit' | 'evidence'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const INDUCTION_VIEWS: { value: View; label: string }[] = [
  { value: 'circuit', label: 'The circuit' },
  { value: 'evidence', label: 'The evidence' },
]

const letter = (token: number) => TOKENS[token] ?? '?'

/**
 * A row of the sequence with one head's attention on it.
 *
 * The weight is drawn as a background on the token's cell, so the pattern is
 * read the way it is in a browser of attention maps: where the colour is, the
 * head is looking.
 */
function AttentionRow({
  tokens,
  weights,
  active,
  label,
  onSelect,
}: {
  tokens: number[]
  weights: number[]
  active: number
  label: string
  onSelect: (position: number) => void
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label={label}>
        {tokens.map((token, position) => {
          const weight = position <= active ? (weights[position] ?? 0) : null
          return (
            <button
              key={position}
              type="button"
              onClick={() => onSelect(position)}
              aria-label={`position ${position}, token ${letter(token)}, ${
                weight === null ? 'not yet attended' : `attention ${fmt(weight, 2)}`
              }`}
              aria-pressed={position === active}
              style={{
                width: 58,
                padding: '6px 4px',
                borderRadius: 8,
                border: position === active ? '2px solid var(--accent-indigo)' : '1px solid var(--border)',
                background:
                  weight === null
                    ? 'transparent'
                    : `color-mix(in srgb, var(--accent-indigo) ${Math.round(weight * 100)}%, transparent)`,
                opacity: weight === null ? 0.35 : 1,
                fontSize: 12,
              }}
            >
              <strong style={{ display: 'block', fontSize: 15 }}>{letter(token)}</strong>
              <span style={{ display: 'block', opacity: 0.75 }}>{weight === null ? '·' : fmt(weight, 2)}</span>
              <span style={{ display: 'block', opacity: 0.55, fontSize: 10 }}>{position}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function InductionLab() {
  const [view, setView] = useViewParam(INDUCTION_VIEWS)
  const [block, setBlock] = useState(INDUCTION_DEFAULTS.block)
  const [repeats, setRepeats] = useState(INDUCTION_DEFAULTS.repeats)
  const [temperature, setTemperature] = useState(INDUCTION_DEFAULTS.temperature)
  const [variant, setVariant] = useState<InductionVariant>(INDUCTION_DEFAULTS.variant)
  const [seed, setSeed] = useState(INDUCTION_DEFAULTS.seed)
  const [selected, setSelected] = useState(INDUCTION_DEFAULTS.selected)

  const sequence = useMemo(
    () => buildRepeatedSequence({ block, repeats, seed }),
    [block, repeats, seed],
  )

  const composed = useMemo(() => inductionReport(sequence, { variant: 'composed', temperature }), [sequence, temperature])
  const ablated = useMemo(() => inductionReport(sequence, { variant: 'ablated', temperature }), [sequence, temperature])

  const active = Math.min(selected, sequence.length - 1)
  const weights = attentionWeights(sequence, active, { variant, temperature })
  const previous = previousTokenWeights(active)
  const prediction = predictNext(sequence, active, { variant, temperature })
  const matches = matchingPositions(sequence, active)
  const actualNext = sequence[active + 1]

  const curve = useMemo(() => {
    const composedCurve = accuracyByRepeats({ block, seed, temperature }, [2, 3, 4])
    const ablatedCurve = accuracyByRepeats({ block, seed, temperature, variant: 'ablated' }, [2, 3, 4])
    return composedCurve.map((point, index) => ({
      x: point.repeats,
      composed: point.accuracy,
      ablated: ablatedCurve[index]?.accuracy ?? 0,
      predictable: point.predictable,
    }))
  }, [block, seed, temperature])

  return (
    <div className="lab">
      <Panel
        title="Laboratory E · Composition and induction"
        subtitle="Two heads, one pattern, and the intervention that separates them"
        accent="emerald"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={INDUCTION_VIEWS}
          />
          <Slider label="The block" value={block} min={3} max={8} onChange={setBlock} hint="Tokens in the pattern that is repeated." />
          <Slider label="The copies" value={repeats} min={1} max={4} onChange={setRepeats} />
          <Slider
            label="The key temperature"
            value={temperature}
            min={0.05}
            max={1}
            step={0.05}
            onChange={setTemperature}
            format={(value) => value.toFixed(2)}
            hint="How sharply the head chooses between its matches."
          />
          <SegmentedControl
            label="The circuit"
            value={variant}
            onChange={setVariant}
            options={[
              { value: 'composed', label: 'Both heads' },
              { value: 'ablated', label: 'Previous-token head removed' },
            ]}
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="Predictable positions" value={String(composed.predictable)} hint="where the token occurred before" />
          <Stat label="The composed circuit" value={`${fmt(composed.accuracy * 100, 1)}%`} tone="good" />
          <Stat label="Without the first head" value={`${fmt(ablated.accuracy * 100, 1)}%`} tone="warn" />
          <Stat label="Chance" value={`${fmt(composed.chance * 100, 1)}%`} hint="one token in eight" />
        </div>

        {view === 'circuit' ? (
          <>
            <Figure
              title="The sequence, and the two heads on it"
              description={`The attention of the previous-token head and of the induction head at position ${active}, where the current token is ${letter(
                sequence[active] ?? 0,
              )}.`}
              caption="The first head puts all of its attention on the position before; that is how the token before each position becomes part of what the second head matches against. The second head finds the places whose predecessor is the current token, and copies the token that followed."
            >
              <AttentionRow
                tokens={sequence}
                weights={previous}
                active={active}
                label={`The previous-token head at position ${active}`}
                onSelect={setSelected}
              />
              <AttentionRow
                tokens={sequence}
                weights={weights}
                active={active}
                label={`The induction head at position ${active}${variant === 'ablated' ? ', with the first head removed' : ''}`}
                onSelect={setSelected}
              />

              <DataTable
                caption={`The prediction at position ${active}`}
                headers={['', 'The token']}
                rows={[
                  ['the current token', letter(sequence[active] ?? 0)],
                  ['the positions it matches', matches.length === 0 ? 'none' : matches.join(', ')],
                  ['the head predicts', `${letter(prediction.token)} (confidence ${fmt(prediction.confidence, 3)})`],
                  ['the next token is', actualNext === undefined ? 'there is no next token' : letter(actualNext)],
                  [
                    'the prediction',
                    actualNext === undefined
                      ? 'not measurable at the last position'
                      : prediction.token === actualNext
                        ? 'correct'
                        : 'wrong',
                  ],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="What this is, and what it is not">
              This is a hand-wired two-head circuit on a sequence of letters: no training, no MLPs, and one layer of
              composition. The numbers are computed from the two attention rules above, so they measure the wiring — not
              a trained language model. Click a position to move the measurement; the ablation is the intervention the
              paper's causal argument uses, at the scale where it can be checked exactly.
            </Callout>
          </>
        ) : null}

        {view === 'evidence' ? (
          <>
            <Figure
              title="The accuracy on the positions that can be predicted"
              description="The fraction of predictable positions the circuit gets right, from the second copy onwards, with and without the previous-token head."
              caption="A single copy has no earlier occurrence to match, so the curve starts at the second. From there the composed circuit is exact, and removing the head that shifts the keys takes it to zero: the induction head alone cannot find the pattern."
            >
              <TrendChart
                data={curve}
                series={[
                  { key: 'composed', name: 'both heads', colour: 'var(--accent-emerald)' },
                  { key: 'ablated', name: 'previous-token head removed', colour: 'var(--accent-rose)', dashed: true },
                ]}
                xLabel="the copies of the block"
                yLabel="accuracy, in per cent"
                yDomain={[0, 100]}
                height={250}
              />
            </Figure>

            <DataTable
              caption="Every position, and what the composed circuit predicted"
              headers={['Position', 'Token', 'Matches', 'Predicted', 'Next', 'Result']}
              rows={composed.scores.map((score) => [
                score.position,
                letter(score.token),
                score.matches.length,
                letter(score.predicted),
                letter(score.next),
                score.matches.length === 0 ? 'nothing to induce' : score.correct ? 'correct' : 'wrong',
              ])}
            />

            <Callout tone="definition" title="Why the second copy is the interesting one">
              The circuit cannot do anything with a token it has never seen: with one copy, no position has an earlier
              occurrence, and there is nothing to complete. Every predictable position is bought by the repetition, and
              the ablation shows that the purchase is made by the first head — the induction head is the part that looks
              like it is doing the work, and the first head is the part that makes it possible.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
