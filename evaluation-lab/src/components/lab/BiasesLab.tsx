import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  MODELS,
  NEUTRAL_JUDGE,
  buildAnswers,
  buildQuestions,
  measurePositionBias,
  measureSelfPreference,
  measureVerbosityBias,
} from '../../core/setting'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'

type View = 'position' | 'verbosity' | 'self'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const BIAS_VIEWS: { value: View; label: string }[] = [
  { value: 'position', label: 'Position' },
  { value: 'verbosity', label: 'Verbosity' },
  { value: 'self', label: 'Self-enhancement' },
]

export function BiasesLab() {
  const [view, setView] = useViewParam(BIAS_VIEWS)
  const [positionBias, setPositionBias] = useState(0.05)
  const [verbosityBias, setVerbosityBias] = useState(0.1)
  const [selfPreference, setSelfPreference] = useState(0.1)

  const questions = useMemo(() => buildQuestions(30, 5), [])
  const answers = useMemo(() => buildAnswers(MODELS, questions, 11), [questions])

  const position = useMemo(
    () => measurePositionBias(MODELS, questions, answers, { ...NEUTRAL_JUDGE, positionBias }, 23),
    [questions, answers, positionBias],
  )

  const verbosity = useMemo(
    () => measureVerbosityBias(MODELS, questions, answers, { ...NEUTRAL_JUDGE, verbosityBias }, 29),
    [questions, answers, verbosityBias],
  )

  const self = useMemo(
    () => measureSelfPreference(MODELS, questions, answers, { ...NEUTRAL_JUDGE, selfPreference }, 31),
    [questions, answers, selfPreference],
  )

  /** The position rate as the bias is swept. */
  const positionSweep = useMemo(() => {
    const rows: { x: number; rate: number }[] = []
    for (let bias = 0; bias <= 0.3; bias += 0.03) {
      const measurement = measurePositionBias(MODELS, questions, answers, { ...NEUTRAL_JUDGE, positionBias: bias }, 23)
      rows.push({ x: bias, rate: measurement.rate })
    }
    return rows
  }, [questions, answers])

  /** The verbosity rate as the bias is swept. */
  const verbositySweep = useMemo(() => {
    const rows: { x: number; rate: number }[] = []
    for (let bias = 0; bias <= 0.3; bias += 0.03) {
      const measurement = measureVerbosityBias(MODELS, questions, answers, { ...NEUTRAL_JUDGE, verbosityBias: bias }, 29)
      rows.push({ x: bias, rate: measurement.rate })
    }
    return rows
  }, [questions, answers])

  /** The self-preference effect as the bias is swept. */
  const selfSweep = useMemo(() => {
    const rows: { x: number; mixed: number; other: number }[] = []
    for (let bias = 0; bias <= 0.5; bias += 0.05) {
      const measurement = measureSelfPreference(MODELS, questions, answers, { ...NEUTRAL_JUDGE, selfPreference: bias }, 31)
      rows.push({ x: bias, mixed: measurement.mixedFamilyAgreement, other: measurement.otherFamilyAgreement })
    }
    return rows
  }, [questions, answers])

  return (
    <div className="lab">
      <Panel
        title="Laboratory B · The biases of a judge"
        subtitle="One bias at a time, each isolated and each measured"
        accent="teal"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="Bias"
            value={view}
            onChange={setView}
            options={BIAS_VIEWS}
          />
          <Slider
            label="Position bias"
            value={positionBias}
            min={0}
            max={0.3}
            step={0.01}
            onChange={setPositionBias}
            format={(value) => value.toFixed(2)}
          />
          <Slider
            label="Verbosity bias"
            value={verbosityBias}
            min={0}
            max={0.3}
            step={0.01}
            onChange={setVerbosityBias}
            format={(value) => value.toFixed(2)}
          />
          <Slider
            label="Self-preference"
            value={selfPreference}
            min={0}
            max={0.5}
            step={0.01}
            onChange={setSelfPreference}
            format={(value) => value.toFixed(2)}
          />
        </div>

        {view === 'position' ? (
          <>
            <div className="stat-row">
              <Stat
                label="First-position rate"
                value={`${fmt(position.rate * 100, 1)}%`}
                hint="50% would be a fair judge"
                tone={Math.abs(position.rate - 0.5) < 0.05 ? 'good' : 'warn'}
              />
              <Stat label="Excess preference" value={`${fmt((position.rate - 0.5) * 100, 1)} pp`} />
              <Stat label="Pairs measured" value={String(position.total)} />
              <Stat label="Bias set to" value={positionBias.toFixed(2)} />
            </div>

            <Figure
              title="The first-position rate against the bias"
              description="The rate at which the judge prefers the first answer, as the position bias is swept from zero to 0.3."
              caption="The measured excess preference tracks the injected bias. The measurement recovers the parameter that was put in — which is the check that the experiment isolates what it claims to."
            >
              <TrendChart
                data={positionSweep}
                series={[{ key: 'rate', name: 'first-position rate', colour: 'var(--accent-teal)' }]}
                xLabel="the injected position bias"
                yLabel="first-position rate"
                yDomain={[0.4, 0.75]}
                height={280}
                referenceLines={[{ y: 0.5, label: 'a fair judge' }]}
              />
            </Figure>

            <Callout tone="note" title="How to isolate it">
              Only pairs whose two answers are equally good are used. With nothing else to prefer, the position is the
              only thing that can decide — and the rate moves off one half exactly in proportion to the bias.
            </Callout>

            <Callout tone="definition" title="The fix, and its price">
              Presenting every pair in both orders and taking the majority cancels a first-position preference exactly.
              It costs double the votes, which is why arenas that skip it look cheap.
            </Callout>
          </>
        ) : null}

        {view === 'verbosity' ? (
          <>
            <div className="stat-row">
              <Stat
                label="Longer-answer rate"
                value={`${fmt(verbosity.rate * 100, 1)}%`}
                hint="50% would be a fair judge"
                tone={Math.abs(verbosity.rate - 0.5) < 0.05 ? 'good' : 'warn'}
              />
              <Stat label="Excess preference" value={`${fmt((verbosity.rate - 0.5) * 100, 1)} pp`} />
              <Stat label="Pairs measured" value={String(verbosity.total)} />
              <Stat label="Bias set to" value={verbosityBias.toFixed(2)} />
            </div>

            <Figure
              title="The longer-answer rate against the bias"
              description="The rate at which the judge prefers the longer of two equally good answers, as the verbosity bias is swept."
              caption="The same isolation, for length. Note that the swap protocol does not touch this: the bias does not depend on position."
            >
              <TrendChart
                data={verbositySweep}
                series={[{ key: 'rate', name: 'longer-answer rate', colour: 'var(--accent-teal)' }]}
                xLabel="the injected verbosity bias"
                yLabel="longer-answer rate"
                yDomain={[0.4, 0.85]}
                height={280}
                referenceLines={[{ y: 0.5, label: 'a fair judge' }]}
              />
            </Figure>

            <Callout tone="warning" title="Why this one is harder to fix">
              A preference for length is not a preference for position, so the swap protocol leaves it untouched. It has
              to be measured, and then either corrected after the fact or accepted as part of what the judge measures.
            </Callout>
          </>
        ) : null}

        {view === 'self' ? (
          <>
            <div className="stat-row">
              <Stat
                label="Agreement, mixed families"
                value={`${fmt(self.mixedFamilyAgreement * 100, 1)}%`}
                hint="one answer from the judge's own family"
              />
              <Stat
                label="Agreement, same family"
                value={`${fmt(self.otherFamilyAgreement * 100, 1)}%`}
                hint="the bias does not act on these pairs"
              />
              <Stat
                label="The gap"
                value={`${fmt((self.mixedFamilyAgreement - self.otherFamilyAgreement) * 100, 1)} pp`}
                hint="mixed pairs minus the rest; the sign is measured, not assumed"
                tone={Math.abs(self.mixedFamilyAgreement - self.otherFamilyAgreement) > 0.01 ? 'warn' : 'good'}
              />
              <Stat label="Bias set to" value={selfPreference.toFixed(2)} />
            </div>

            <Figure
              title="The self-preference effect"
              description="The judge's agreement with the human on pairs where one answer is from its own family, and on pairs where neither is."
              caption="As the bias grows, agreement on mixed-family pairs falls while agreement on pairs the bias does not touch stays put. The bias is the movement of the mixed curve, not the sign of the gap: at zero bias the judge's own family happens to be slightly better, so the gap starts positive and crosses zero as the bias takes over."
            >
              <TrendChart
                data={selfSweep}
                series={[
                  { key: 'mixed', name: 'one answer from its own family', colour: 'var(--accent-rose)' },
                  { key: 'other', name: 'neither from its own family', colour: 'var(--accent-teal)' },
                ]}
                xLabel="the injected self-preference"
                yLabel="agreement with the human"
                yDomain={[0.4, 1]}
                height={280}
              />
            </Figure>

            <DataTable
              caption="The measurement"
              headers={['Quantity', 'Value']}
              rows={[
                ['mixed-family pairs', String(self.mixedPairs)],
                ['agreement on mixed-family pairs', `${fmt(self.mixedFamilyAgreement * 100, 2)}%`],
                ['same-family pairs', String(self.otherPairs)],
                ['agreement on same-family pairs', `${fmt(self.otherFamilyAgreement * 100, 2)}%`],
                [
                  'the gap, mixed minus same',
                  `${fmt((self.mixedFamilyAgreement - self.otherFamilyAgreement) * 100, 2)} percentage points`,
                ],
              ]}
            />

            <DataTable
              caption="The sweep, row by row"
              headers={['Self-preference', 'Agreement, mixed', 'Agreement, same', 'The gap']}
              rows={selfSweep.map((row) => [
                fmt(row.x, 2),
                `${fmt(row.mixed * 100, 2)}%`,
                `${fmt(row.other * 100, 2)}%`,
                `${fmt((row.mixed - row.other) * 100, 2)} pp`,
              ])}
            />

            <Callout tone="definition" title="Why it matters for a leaderboard">
              A judge that prefers its own family’s style will rank that family above the others for reasons that have
              nothing to do with capability. This is the mechanism behind a whole class of leaderboard artefacts, and it
              is invisible unless someone measures it.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
