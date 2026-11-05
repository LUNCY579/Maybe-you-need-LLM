import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  buildCritiqueCases,
  buildExchanges,
  compareCritics,
  critique,
  CRITICS,
  detect,
  judgeAgreement,
  PRINCIPLES,
  revise,
  runConstitutionLoop,
  sampleJudgeVerdicts,
  verdictAgreement,
} from '../../core/constitution'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { CONSTITUTION_DEFAULTS } from '../../content/labDefaults'

type View = 'loop' | 'critics' | 'judge' | 'claim'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const CONSTITUTION_VIEWS: { value: View; label: string }[] = [
  { value: 'loop', label: 'The loop' },
  { value: 'critics', label: 'The two critics' },
  { value: 'judge', label: 'The judge' },
  { value: 'claim', label: 'The claim' },
]

export function ConstitutionLab() {
  const [view, setView] = useViewParam(CONSTITUTION_VIEWS)
  const [count, setCount] = useState(CONSTITUTION_DEFAULTS.exchanges)
  const [compliance, setCompliance] = useState(CONSTITUTION_DEFAULTS.compliance)
  const [judgeNoise, setJudgeNoise] = useState(CONSTITUTION_DEFAULTS.judgeNoise)
  const [cases, setCases] = useState(CONSTITUTION_DEFAULTS.cases)
  const [seed, setSeed] = useState(CONSTITUTION_DEFAULTS.seed)

  const exchanges = useMemo(() => buildExchanges(count, { compliance, seed }), [count, compliance, seed])
  const loop = useMemo(() => runConstitutionLoop(exchanges), [exchanges])

  const judge = useMemo(() => {
    const verdicts = sampleJudgeVerdicts(exchanges, judgeNoise, seed + 11)
    return judgeAgreement(verdicts.judged, verdicts.labels)
  }, [exchanges, judgeNoise, seed])

  const judged = useMemo(
    () => exchanges.map((exchange) => ({ exchange, revised: revise(exchange), objection: critique(exchange) })),
    [exchanges],
  )

  const critiqueCases = useMemo(() => buildCritiqueCases(cases, seed), [cases, seed])
  const comparison = useMemo(() => compareCritics(critiqueCases, CRITICS, { seed }), [critiqueCases, seed])
  const self = comparison.find((entry) => entry.id === 'self')
  const external = comparison.find((entry) => entry.id === 'external')

  // One seed for both critics: the cases are the same and the draws are shared, so the
  // only thing that differs between the two rows is what each critic can see.
  const criticView = useMemo(() => {
    const selfVerdicts = detect(critiqueCases, CRITICS[0]!, { seed })
    const externalVerdicts = detect(critiqueCases, CRITICS[1]!, { seed })
    const byCategory = PRINCIPLES.map((principle) => {
      let violations = 0
      let missedSelf = 0
      let missedExternal = 0
      critiqueCases.forEach((entry, index) => {
        if (!entry.violation || entry.exchange.category !== principle.category) return
        violations++
        if (!selfVerdicts[index]) missedSelf++
        if (!externalVerdicts[index]) missedExternal++
      })
      return { category: principle.category, violations, missedSelf, missedExternal }
    })
    return { ...verdictAgreement(selfVerdicts, externalVerdicts), byCategory }
  }, [critiqueCases, seed])

  return (
    <div className="lab">
      <Panel
        title="Laboratory A · The constitution"
        subtitle="A model that critiques itself, against a written rule"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={CONSTITUTION_VIEWS}
          />
          <Slider label="The exchanges" value={count} min={10} max={200} step={10} onChange={setCount} />
          <Slider
            label="How often the model complies"
            value={compliance}
            min={0}
            max={1}
            step={0.05}
            onChange={setCompliance}
            format={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Slider
            label="The judge’s error rate"
            value={judgeNoise}
            min={0}
            max={0.5}
            step={0.05}
            onChange={setJudgeNoise}
            format={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Slider
            label="The cases the two critics are asked about"
            value={cases}
            min={20}
            max={200}
            step={20}
            onChange={setCases}
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="The harm before" value={fmt(loop.harmBefore, 4)} tone="warn" />
          <Stat label="The harm after" value={fmt(loop.harmAfter, 4)} tone="good" />
          <Stat label="The responses changed" value={String(loop.changed)} />
          <Stat
            label="The judge’s agreement"
            value={`${fmt(judge.agreement * 100, 1)}%`}
            tone={judge.agreement > 0.85 ? 'good' : 'warn'}
          />
        </div>

        {view === 'loop' ? (
          <>
            <Figure
              title="The loop, over the exchanges"
              description="The harmfulness of each response before and after the critique."
              caption="The loop removes the harm. The question it cannot answer on its own is whether the remaining answers are still useful."
            >
              <TrendChart
                data={exchanges.map((exchange, index) => ({
                  x: index,
                  before: exchange.harmfulness,
                  after: revise(exchange).harmfulness,
                }))}
                series={[
                  { key: 'before', name: 'before the critique', colour: 'var(--accent-rose)' },
                  { key: 'after', name: 'after the revision', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the exchange"
                yLabel="the harmfulness"
                height={260}
              />
            </Figure>

            <Figure
              title="Some of the critiques"
              description="The exchange, the objection, and the revised response."
              caption="A revision cannot be written without something to revise against, so the critique names the principle."
            >
              <DataTable
                caption="The loop"
                headers={['The category', 'The critique', 'The harm before', 'The harm after']}
                rows={judged
                  .filter((entry) => entry.objection !== null)
                  .slice(0, 8)
                  .map((entry) => [
                    entry.exchange.category,
                    entry.objection ?? '',
                    fmt(entry.exchange.harmfulness, 3),
                    fmt(entry.revised.harmfulness, 3),
                  ])}
              />
            </Figure>

            <Callout tone="note" title="What the loop costs">
              One critique and one revision for every response it changes, and the loop only changes the responses that
              break a principle — {fmt(loop.critiquesPerChange, 2)} critiques per change here, and{' '}
              {loop.stillUseful} of the {loop.changed} rewrites kept the harmless part of the answer. The cost per
              change is the number that says whether the method is affordable at the scale you have in mind.
            </Callout>
          </>
        ) : null}

        {view === 'critics' ? (
          <>
            <Figure
              title="The same cases, two critics"
              description="The model reading its own answer, and somebody else reading it. Every column is computed against the ground truth the cases carry."
              caption="A revision only happens to a response the critic flagged, so a critic’s blind spot is not a report that missed a line — it is the harm that is still in the model afterwards."
            >
              <DataTable
                caption="The critics"
                headers={[
                  'The critic',
                  'The violations',
                  'The ones it saw',
                  'The ones it missed',
                  'The recall',
                  'The harm before',
                  'The harm after',
                  'The cost',
                  'The harm per unit cost',
                ]}
                rows={comparison.map((entry) => [
                  entry.id === 'self' ? 'the model itself' : 'an external critic',
                  entry.violations,
                  entry.detected,
                  entry.missed,
                  `${fmt(entry.recall * 100, 1)}%`,
                  fmt(entry.harmBefore, 3),
                  fmt(entry.harmAfter, 3),
                  fmt(entry.cost, 0),
                  fmt(entry.harmPerCost, 4),
                ])}
              />
            </Figure>

            <Figure
              title="Where the self-critic is blind"
              description="The violations of each principle, and how many of them each critic did not flag."
              caption="The blindness is not uniform, and that is the part a summary recall number hides: it sits on the categories the model’s own compliance made invisible."
            >
              <DataTable
                caption="The blind spots"
                headers={['The category', 'The violations', 'Missed by the model itself', 'Missed by the external critic']}
                rows={[...criticView.byCategory]
                  .sort((a, b) => b.missedSelf - a.missedSelf || b.violations - a.violations)
                  .map((entry) => [entry.category, entry.violations, entry.missedSelf, entry.missedExternal])}
              />
            </Figure>

            <Figure
              title="Where the two critics disagree"
              description="The verdicts of the two critics on the same cases, from the same draws."
              caption="Agreement between two critics is not evidence that either is right — both can be wrong on the same case, and a model critic and a human critic trained on the same corpus will tend to miss the same thing."
            >
              <DataTable
                caption="The disagreement"
                headers={['The quantity', 'The cases']}
                rows={[
                  ['the verdicts that agree', `${fmt(criticView.agreement * 100, 1)}%`],
                  ['flagged by both', criticView.bothFlag],
                  ['flagged only by the model itself', criticView.onlyA],
                  ['flagged only by the external critic', criticView.onlyB],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="Which critic to run is a rate question">
              The external critic removed {fmt(external?.harmRemoved ?? 0, 3)} of harm at a cost of{' '}
              {fmt(external?.cost ?? 0, 0)}; the model itself removed {fmt(self?.harmRemoved ?? 0, 3)} at a cost of{' '}
              {fmt(self?.cost ?? 0, 0)}. The higher harm removed is the safer pass and the higher harm per unit cost is
              the cheaper one — and the {self?.missed ?? 0} violations the model did not see are still in the answers it
              went on to write, which is the part a recall average hides.
            </Callout>
          </>
        ) : null}

        {view === 'judge' ? (
          <>
            <Figure
              title="The judge and the labels"
              description="The agreement, and the two kinds of error the judge makes."
              caption="Every harmlessness number is an estimate of what a judge believes, measured on a sample. The agreement is what makes that number mean anything."
            >
              <DataTable
                caption="The judge"
                headers={['The quantity', 'The value']}
                rows={[
                  ['the agreement with the labels', `${fmt(judge.agreement * 100, 1)}%`],
                  ['the false positives', judge.falsePositives],
                  ['the false negatives', judge.falseNegatives],
                  ['the cases', exchanges.length],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="A false positive is not free">
              Every case the judge flags and the labels call harmless is a case that is not collected, and the harmless
              cases are most of a helpful dataset. A judge with a high false-positive rate does not make a model
              safer; it makes the dataset smaller.
            </Callout>
          </>
        ) : null}

        {view === 'claim' ? (
          <>
            <Figure
              title="What a harmlessness claim rests on"
              description="Each part of the claim, and the measurement behind it."
              caption="A claim is worth what its measurement can carry. Every line below is a thing that can be measured, and a claim that leaves one out is a claim about a benchmark rather than about a model."
            >
              <DataTable
                caption="The claim and its measurements"
                headers={['The part of the claim', 'The measurement behind it', 'What it is here']}
                rows={[
                  ['the model is harmless on this kind of request', 'the task set', `${exchanges.length} exchanges`],
                  ['the kinds of request are the ones that matter', 'the taxonomy', `${PRINCIPLES.length} principles`],
                  ['the score means what it says', 'the judge’s agreement', `${fmt(judge.agreement * 100, 1)}%`],
                  ['the team looked everywhere', 'the coverage', 'the red team’s coverage, measured next door'],
                  ['the number is precise', 'the sample', 'and its interval'],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="The habit worth forming">
              When a number arrives with a claim attached, ask what the number was measured on, by whom, and how much of
              the space was covered. Three questions, and they apply to every benchmark in this collection.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
