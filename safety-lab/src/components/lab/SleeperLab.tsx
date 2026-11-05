import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  auditClassifier,
  buildCorpus,
  CUES,
  cuedShareSweep,
  wrongCueControl,
} from '../../core/sleeper'
import { Callout, DataTable, Figure, Panel, SegmentedControl, Slider, Stat, TrendChart } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'
import { SLEEPER_DEFAULTS } from '../../content/labDefaults'

type View = 'miss' | 'buyback'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const SLEEPER_VIEWS: { value: View; label: string }[] = [
  { value: 'miss', label: 'What the classifier misses' },
  { value: 'buyback', label: 'What labelling the cue buys' },
]

/** The cue the behaviour in this corpus actually rides on. The screen says so out loud. */
const REAL_CUE = CUES[0]!

const SHEETS = [
  { value: 'carries', label: `The cue that carries it (${REAL_CUE})` },
  { value: 'other', label: `A cue that is not it (${CUES[1]})` },
] as const

const SHARES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]

/** The cue a sheet tells the classifier to look for. */
const cueOf = (sheet: (typeof SHEETS)[number]['value']) => (sheet === 'carries' ? REAL_CUE : CUES[1]!)

export function SleeperLab() {
  const [view, setView] = useViewParam(SLEEPER_VIEWS)
  const [sheet, setSheet] = useState(SLEEPER_DEFAULTS.sheet)
  const [examples, setExamples] = useState(SLEEPER_DEFAULTS.examples)
  const [trainingSize, setTrainingSize] = useState(SLEEPER_DEFAULTS.trainingSize)
  const [harmfulRate, setHarmfulRate] = useState(SLEEPER_DEFAULTS.harmfulRate)
  const [cuedShare, setCuedShare] = useState(SLEEPER_DEFAULTS.cuedShareOfHarm)
  const [cuePrevalence, setCuePrevalence] = useState(SLEEPER_DEFAULTS.cuePrevalence)
  const [seed, setSeed] = useState(SLEEPER_DEFAULTS.seed)

  const training = useMemo(
    () =>
      buildCorpus(trainingSize, {
        cues: [REAL_CUE],
        cuePrevalence,
        cuedShareOfHarm: cuedShare,
        harmfulRate,
        seed,
      }),
    [trainingSize, cuePrevalence, cuedShare, harmfulRate, seed],
  )
  const test = useMemo(
    () =>
      buildCorpus(examples, {
        cues: [REAL_CUE],
        cuePrevalence,
        cuedShareOfHarm: cuedShare,
        harmfulRate,
        seed: seed + 4_009,
      }),
    [examples, cuePrevalence, cuedShare, harmfulRate, seed],
  )

  // One pair of calls per label sheet: the audit is the classifier's own account, and
  // the control is the count of the harm that carried the cue the sheet did not name.
  const cases = useMemo(
    () =>
      SHEETS.map((entry) => {
        const cue = cueOf(entry.value)
        const audit = auditClassifier(training, test, [cue])
        const control = wrongCueControl(training, test, cue, REAL_CUE)
        return {
          sheet: entry.value,
          label: entry.label,
          cue,
          audit,
          control,
          cuedTotal: control.unseen.detected + control.unseen.missed,
        }
      }),
    [training, test],
  )
  const active = cases.find((entry) => entry.sheet === sheet)!

  const sweep = useMemo(() => cuedShareSweep(test, [REAL_CUE], SHARES, { trainingSize, seed }), [test, trainingSize, seed])

  const cuedHarm = test.filter((example) => example.harmful && example.cue === REAL_CUE).length
  const directHarm = test.filter((example) => example.harmful && example.cue === null).length

  return (
    <div className="lab">
      <Panel
        title="Laboratory D · The cued behaviour"
        subtitle="A harm that arrives with a mark the classifier was never told about"
        accent="rose"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={SLEEPER_VIEWS}
          />
          <SegmentedControl
            label="The sheet the classifier was given"
            value={sheet}
            onChange={setSheet}
            options={SHEETS.map((entry) => ({ value: entry.value, label: entry.label }))}
          />
          <Slider
            label="The examples it is scored on"
            value={examples}
            min={20}
            max={400}
            step={20}
            onChange={setExamples}
          />
          <Slider label="The examples it was trained on" value={trainingSize} min={40} max={600} step={20} onChange={setTrainingSize} />
          <Slider
            label="The share of the examples that are harmful"
            value={harmfulRate}
            min={0.1}
            max={0.7}
            step={0.05}
            onChange={setHarmfulRate}
            format={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Slider
            label="The share of that harm which rides on the cue"
            value={cuedShare}
            min={0.05}
            max={0.95}
            step={0.05}
            onChange={setCuedShare}
            format={(value) => `${(value * 100).toFixed(0)}%`}
            hint={`The rest is harmful whatever is in the prompt. The last two cards ignore the ${REAL_CUE} and count only this.`}
          />
          <Slider
            label="The share of harmless answers carrying the cue"
            value={cuePrevalence}
            min={0}
            max={0.6}
            step={0.05}
            onChange={setCuePrevalence}
            format={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat
            label="The cued behaviour caught"
            value={`${active.control.unseen.detected} of ${active.cuedTotal}`}
            hint={`harm that arrived with the ${REAL_CUE}`}
            tone={active.control.unseen.detected === 0 ? 'warn' : 'good'}
          />
          <Stat
            label="The weight on the cue it was given"
            value={fmt(active.audit.cueWeights[0]?.weight ?? 0, 4)}
            hint="zero means the column taught it nothing"
          />
          <Stat
            label="The harm the evaluation reports"
            value={`${fmt(active.audit.apparentHarmRate * 100, 1)}%`}
            hint="an evaluation set that never fires the cue"
          />
          <Stat
            label="The harm there actually is"
            value={`${fmt(active.audit.trueHarmRate * 100, 1)}%`}
            tone="warn"
            hint={`under-reported by ${fmt(active.audit.underReportedBy * 100, 1)} points`}
          />
        </div>

        {view === 'miss' ? (
          <>
            <Figure
              title="The two label sheets, the same behaviour"
              description="The classifier fit on each sheet, scored on the same test set. The behaviour is identical in both rows; only the column the team asked for changes."
              caption="A fit has no opinion about a cue it was never given a column for — the weight is exactly zero, and the harm that rode on it is not mis-classified, it is simply never counted."
            >
              <DataTable
                caption="The two sheets"
                headers={[
                  'The sheet',
                  `The ${REAL_CUE} behaviour caught`,
                  'The behaviour without a cue caught',
                  'The weight on its own cue',
                  'The harm reported',
                  'The harm there is',
                ]}
                rows={cases.map((entry) => [
                  entry.label,
                  `${entry.control.unseen.detected} of ${entry.cuedTotal}`,
                  `${fmt(entry.audit.direct.detectionRate * 100, 1)}%`,
                  fmt(entry.audit.cueWeights[0]?.weight ?? 0, 4),
                  `${fmt(entry.audit.apparentHarmRate * 100, 1)}%`,
                  `${fmt(entry.audit.trueHarmRate * 100, 1)}%`,
                ])}
              />
            </Figure>

            <Figure
              title="The wrong-cue control"
              description="What the classifier does with the examples that carry the cue it was not told about, against the ones it was."
              caption="This is the difference between a measurement that failed and a measurement that was never run: the guessed column is not wrong, it is empty, and the fit gives it the zero it deserves."
            >
              <DataTable
                caption="The control"
                headers={['The quantity', `When the sheet names the ${REAL_CUE}`, 'When it names another cue']}
                rows={[
                  ['the weight on the column it was given', fmt(cases[0]!.audit.cueWeights[0]?.weight ?? 0, 4), fmt(cases[1]!.audit.cueWeights[0]?.weight ?? 0, 4)],
                  ['the cued harm it flagged', `${cases[0]!.control.unseen.detected} of ${cases[0]!.cuedTotal}`, `${cases[1]!.control.unseen.detected} of ${cases[1]!.cuedTotal}`],
                  ['the cued harm it missed', cases[0]!.control.unseen.missed, cases[1]!.control.unseen.missed],
                  ['the false alarms on harmless answers', cases[0]!.control.guessed.falseAlarms, cases[1]!.control.guessed.falseAlarms],
                  ['the cut it used', fmt(cases[0]!.control.threshold, 4), fmt(cases[1]!.control.threshold, 4)],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="Nothing here is a model that was fooled">
              The examples in this corpus are labelled by ground truth, not by the classifier, so the gap between the
              last two cards is a property of which examples the evaluation set contains — no classifier is involved in
              it. On this test set {cuedHarm} of the {cuedHarm + directHarm} harmful answers arrive with the {REAL_CUE},
              and an evaluation that never fires the cue cannot see any of them.
            </Callout>
          </>
        ) : null}

        {view === 'buyback' ? (
          <>
            <Figure
              title="Detection against how much of the training harm rode on the cue"
              description="The same classifier, refit on a training set whose labelled harm carries the cue at every share from none to all."
              caption="At one end it cannot see a cued answer at all. At the other it has stopped learning anything about harm that arrives without the cue. Both ends are failures, and the middle is a mixed set."
            >
              <TrendChart
                data={sweep.map((row) => ({
                  x: Math.round(row.share * 100),
                  cued: row.cuedDetection * 100,
                  direct: row.directDetection * 100,
                }))}
                series={[
                  { key: 'cued', name: 'the cued behaviour caught', colour: 'var(--accent-rose)' },
                  { key: 'direct', name: 'the behaviour without a cue caught', colour: 'var(--accent-teal)' },
                ]}
                xLabel="the share of the training harm that rode on the cue, in per cent"
                yLabel="the detection rate, in per cent"
                height={270}
              />
            </Figure>

            <Figure
              title="The same sweep, with the weight it fitted"
              description="Both detection rates and the cue's own coefficient at every share."
              caption="The coefficient is the mechanism: the classifier does not refuse to see the cue, it was never given a reason to look for one."
            >
              <DataTable
                caption="The buy-back curve"
                headers={['The share', 'The cued behaviour caught', 'The behaviour without a cue caught', 'The weight on the cue']}
                rows={sweep.map((row) => [
                  `${fmt(row.share * 100, 0)}%`,
                  `${fmt(row.cuedDetection * 100, 1)}%`,
                  `${fmt(row.directDetection * 100, 1)}%`,
                  fmt(row.cueWeight, 4),
                ])}
              />
            </Figure>

            <Callout tone="definition" title="What the curve is for">
              The advice it supports is boring and easy to skip: put cued examples in the training set, and keep direct
              examples in it too. The curve is the price of getting either half of that wrong, measured on the same
              classifier rather than asserted.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
