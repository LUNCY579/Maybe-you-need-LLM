import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { contaminationEffect, rankingShift } from '../../core/measurement'
import {
  CANDIDATES,
  optimismCurve,
  selectOnPublic,
  surfaceSummary,
  tradeoffSurface,
} from '../../core/benchmarking'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, PointChart, TrendChart, useViewParam } from '@llm-materials/course-ui'

type View = 'contamination' | 'design' | 'tradeoffs' | 'private'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const BENCHMARK_VIEWS: { value: View; label: string }[] = [
  { value: 'contamination', label: 'Contamination' },
  { value: 'design', label: 'The question set' },
  { value: 'tradeoffs', label: 'The metrics' },
  { value: 'private', label: 'Public and private' },
]

export function BenchmarkLab() {
  const [view, setView] = useViewParam(BENCHMARK_VIEWS)
  const [questions, setQuestions] = useState(200)
  const [trueScore, setTrueScore] = useState(0.6)
  const [fraction, setFraction] = useState(0.1)
  const [inflation, setInflation] = useState(1.5)
  const [publicNoise, setPublicNoise] = useState(0.03)

  const effect = useMemo(
    () => contaminationEffect(trueScore, questions, fraction, inflation),
    [trueScore, questions, fraction, inflation],
  )

  /** The inflation as the contaminated fraction is swept. */
  const sweep = useMemo(() => {
    const rows: { x: number; reported: number; true: number }[] = []
    for (let f = 0; f <= 0.5; f += 0.05) {
      const result = contaminationEffect(trueScore, questions, f, inflation)
      rows.push({ x: f, reported: result.reportedScore, true: trueScore })
    }
    return rows
  }, [trueScore, questions, inflation])

  /**
   * A ranking under differential contamination: one model has seen the
   * benchmark, the others have not.
   */
  const differential = useMemo(() => {
    const clean = [0.72, 0.68, 0.61, 0.55]
    const contaminated = [0.72, 0.68, 0.61, 0.55].map((score, index) =>
      index === 0 ? Math.min(1, score * inflation) : score,
    )
    return { clean, contaminated, shift: rankingShift(clean, contaminated) }
  }, [inflation])

  /** How the difficulty mix of a question set changes what it measures. */
  const designRows = useMemo(() => {
    const mixes = [
      { name: 'all easy', easy: 1, hard: 0 },
      { name: 'mostly easy', easy: 0.8, hard: 0.2 },
      { name: 'balanced', easy: 0.5, hard: 0.5 },
      { name: 'mostly hard', easy: 0.2, hard: 0.8 },
      { name: 'all hard', easy: 0, hard: 1 },
    ]
    return mixes.map((mix) => {
      // A model at 70% true quality scores higher on easy questions, and the
      // separation between models shrinks as the questions get harder.
      const easyScore = 0.7 + 0.25 * mix.easy
      const hardScore = 0.7 - 0.2 * mix.hard
      const spread = easyScore - hardScore
      return {
        ...mix,
        easyScore,
        hardScore,
        spread,
        // The standard error of the score, which grows as the score moves
        // away from one half.
        standardError: Math.sqrt((easyScore * (1 - easyScore)) / questions),
      }
    })
  }, [questions])

  const surface = useMemo(() => tradeoffSurface(), [])
  const surfaceStats = useMemo(() => surfaceSummary(), [])
  const selection = useMemo(() => selectOnPublic(CANDIDATES, { noise: publicNoise, seed: 83 }), [publicNoise])
  const optimism = useMemo(() => optimismCurve(), [])

  return (
    <div className="lab">
      <Panel
        title="Laboratory D · Benchmark design"
        subtitle="What you put in the question set decides what comes out"
        accent="rose"
      >
        <div className="lab-controls">
          <SegmentedControl label="View" value={view} onChange={setView} options={BENCHMARK_VIEWS} />
          <Slider
            label="Questions in the benchmark"
            value={questions}
            min={10}
            max={2000}
            step={10}
            onChange={setQuestions}
          />
          <Slider
            label="The true score"
            value={trueScore}
            min={0.1}
            max={0.9}
            step={0.01}
            onChange={setTrueScore}
            format={(value) => fmt(value * 100, 0) + '%'}
          />
          <Slider
            label="Contaminated fraction"
            value={fraction}
            min={0}
            max={0.5}
            step={0.01}
            onChange={setFraction}
            format={(value) => fmt(value * 100, 0) + '%'}
          />
          <Slider
            label="Inflation on a contaminated question"
            value={inflation}
            min={1}
            max={2.5}
            step={0.05}
            onChange={setInflation}
            format={(value) => `${value.toFixed(2)}×`}
          />
          <Slider
            label="The public set’s noise"
            value={publicNoise}
            min={0}
            max={0.08}
            step={0.005}
            onChange={setPublicNoise}
            format={(value) => value.toFixed(3)}
          />
        </div>

        {view === 'contamination' ? (
          <>
            <div className="stat-row">
              <Stat label="True score" value={fmt(effect.trueScore * 100, 1) + '%'} />
              <Stat
                label="Reported score"
                value={fmt(effect.reportedScore * 100, 1) + '%'}
                tone={effect.inflation > 0.01 ? 'warn' : 'good'}
              />
              <Stat label="Inflation" value={`${fmt(effect.inflation * 100, 1)} pp`} />
              <Stat label="Contaminated questions" value={String(effect.contaminatedQuestions)} />
            </div>

            <Figure
              title="The reported score against the contaminated fraction"
              description="The reported score as the fraction of the benchmark that appears in the training data increases, at a fixed true score."
              caption="The inflation is linear in the contaminated fraction. The difficulty is not that the effect is large — it is that the fraction is unknown."
            >
              <TrendChart
                data={sweep}
                series={[
                  { key: 'reported', name: 'the reported score', colour: 'var(--accent-rose)' },
                  { key: 'true', name: 'the true score', colour: 'var(--accent-teal)', dashed: true },
                ]}
                xLabel="the contaminated fraction"
                yLabel="score"
                height={280}
              />
            </Figure>

            <DataTable
              caption="The contamination arithmetic"
              headers={['Quantity', 'Value']}
              rows={[
                ['questions in the benchmark', String(questions)],
                ['contaminated questions', String(effect.contaminatedQuestions)],
                ['clean questions', String(questions - effect.contaminatedQuestions)],
                ['score on the clean questions', fmt(effect.cleanScore * 100, 2) + '%'],
                ['score on the contaminated questions', fmt(effect.contaminatedScore * 100, 2) + '%'],
                ['the reported score', fmt(effect.reportedScore * 100, 2) + '%'],
                ['the inflation', fmt(effect.inflation * 100, 2) + ' percentage points'],
              ]}
            />

            <Figure
              title="Differential contamination moves the ranking"
              description="Four models with clean scores, and the same four models when only the top one has seen the benchmark."
              caption="Contamination inflates one model’s score and the order changes. A common shift would leave the ranking untouched, which is why a benchmark that everyone has trained on is less dangerous than one that only some models have seen."
            >
              <DataTable
                caption="The ranking, before and after"
                headers={['Position', 'Clean', 'Contaminated']}
                rows={differential.shift.cleanOrder.map((index, position) => [
                  position + 1,
                  fmt(differential.clean[index] * 100, 1) + '%',
                  fmt(differential.contaminated[index] * 100, 1) + '%',
                ])}
              />
            </Figure>

            <Callout tone="warning" title="The number nobody knows">
              The contaminated fraction is the crux, and no model publishes it. A benchmark whose questions might be in
              your training data cannot be checked, only hoped about — which is why decontamination is part of dataset
              construction rather than part of evaluation.
            </Callout>
          </>
        ) : null}

        {view === 'design' ? (
          <>
            <Figure
              title="The difficulty mix decides what the score measures"
              description="For five different mixes of easy and hard questions, the score, the spread between models, and the standard error of the score."
              caption="A benchmark of easy questions separates models well and says little. A benchmark of hard questions separates them badly and says a lot — but the measurement is noisier, and the number of questions needed to resolve a difference goes up."
            >
              <DataTable
                caption="Five question sets"
                headers={['Question set', 'Easy', 'Hard', 'Score', 'Separation', 'Standard error']}
                rows={designRows.map((row) => [
                  row.name,
                  fmt(row.easy * 100, 0) + '%',
                  fmt(row.hard * 100, 0) + '%',
                  fmt(row.easyScore * 100, 1) + '%',
                  fmt(row.spread * 100, 1) + ' pp',
                  fmt(row.standardError * 100, 2) + ' pp',
                ])}
              />
            </Figure>

            <Callout tone="definition" title="The tension">
              A benchmark has to be hard enough to separate the models and easy enough to run. A question set of easy
              questions measures nothing that a leaderboard would find interesting; a question set of hard questions
              measures a lot, at a cost nobody wants to pay.
            </Callout>

            <Callout tone="note" title="The holistic alternative">
              Instead of one number on one question set, measure several scenarios on several metrics and publish the
              vector. The trade-offs then become visible, and choosing between them becomes the reader’s decision
              rather than a decision someone made for them.
            </Callout>
          </>
        ) : null}

        {view === 'tradeoffs' ? (
          <>
            <div className="stat-row">
              <Stat label="Points on the frontier" value={String(surfaceStats.frontier)} />
              <Stat label="Accuracy spread" value={`${fmt(surfaceStats.accuracySpread * 100, 1)} points`} />
              <Stat label="The most accurate" value={surfaceStats.bestAccuracy} />
              <Stat label="The cheapest" value={surfaceStats.cheapest} hint="and the least accurate" />
            </div>

            <Figure
              title="Accuracy against cost"
              description="Six models, with the non-dominated ones marked as the frontier."
              caption="A model is dominated when another model is at least as accurate and no more expensive. The frontier is the set of choices that are not obviously wrong; picking one still requires a decision about what the deployment values."
            >
              <PointChart
                points={surface.map((point) => ({
                  x: point.cost,
                  y: point.accuracy * 100,
                  group: point.dominated ? 'dominated' : 'frontier',
                  label: point.name,
                }))}
                series={[
                  { key: 'frontier', name: 'on the frontier', colour: 'var(--accent-rose)' },
                  { key: 'dominated', name: 'dominated', colour: 'var(--accent-teal)' },
                ]}
                xLabel="relative cost"
                yLabel="accuracy, in per cent"
                height={300}
              />
            </Figure>

            <Figure
              title="The metric vector"
              description="Every model on every metric HEML reports, with the best value in each column marked by the table’s order."
              caption="The vertical reading is the honest one: a model is a point in five dimensions, and the leaderboard’s one number is a projection someone chose. HEML’s contribution is to publish the projection and the underlying vector."
            >
              <DataTable
                caption="The multi-metric table"
                headers={['The model', 'Accuracy', 'Calibration', 'Robustness', 'Fairness', 'Cost', 'On the frontier?']}
                rows={surface.map((point) => [
                  point.name,
                  `${fmt(point.accuracy * 100, 1)}%`,
                  `${fmt(point.calibration * 100, 1)}%`,
                  `${fmt(point.robustness * 100, 1)}%`,
                  `${fmt(point.fairness * 100, 1)}%`,
                  fmt(point.cost, 2),
                  point.dominated ? 'no' : 'yes',
                ])}
              />
            </Figure>

            <Callout tone="definition" title="Standardisation and coverage">
              A trade-off surface is only a comparison if every model was run under the same conditions:
              one prompt template, one set of adapters per model family, one decoding rule, and the same
              metrics computed by the same code. That is standardisation, and without it the axes measure
              the harness as much as the model. Coverage is the other half — the scenario set has to be broad
              enough that a weak spot shows up somewhere on the surface instead of falling between the
              scenarios nobody included.
            </Callout>

            <Callout tone="note" title="Synthetic model parameters">
              The six models are parameter choices, not HEML’s measurements. They are shaped so no model wins every
              metric; the frontier arithmetic is the part that transfers.
            </Callout>
          </>
        ) : null}

        {view === 'private' ? (
          <>
            <div className="stat-row">
              <Stat label="The public winner" value={selection.candidates[selection.winner]!.name} />
              <Stat label="Its public score" value={`${fmt(selection.publicWinnerScore * 100, 1)}%`} />
              <Stat label="Its private score" value={`${fmt(selection.privateWinnerScore * 100, 1)}%`} tone="warn" />
              <Stat
                label="The optimism"
                value={`${fmt(selection.optimism * 100, 1)} pp`}
                hint="public minus private"
                tone="warn"
              />
            </div>

            <Figure
              title="Every candidate on both tests"
              description="The noisy public score that selected the winner, and the true score the private test would report."
              caption="The public score is a measurement with noise, and the selection takes the maximum of five noisy measurements. The maximum is above the truth even when every individual measurement is unbiased."
            >
              <DataTable
                caption="The candidates"
                headers={['The candidate', 'True score', 'Public score', 'Selected?', 'Flattered by']}
                rows={selection.candidates.map((candidate, index) => [
                  candidate.name,
                  `${fmt(candidate.trueScore * 100, 1)}%`,
                  `${fmt(selection.publicScores[index]! * 100, 1)}%`,
                  index === selection.winner ? 'yes' : '—',
                  `${fmt((selection.publicScores[index]! - candidate.trueScore) * 100, 1)} pp`,
                ])}
              />
            </Figure>

            <Figure
              title="The winner’s curse against the noise"
              description="The average gap between the selected candidate’s public and private scores, as the public set gets noisier."
              caption="At zero noise the public winner is the true winner and the gap is zero. As the noise grows, the selection increasingly picks the luckiest measurement, and the gap grows with it — even though every measurement is still unbiased."
            >
              <TrendChart
                data={optimism.map((row) => ({ x: row.noise, optimism: row.optimism * 100 }))}
                series={[{ key: 'optimism', name: 'the average optimism, in points', colour: 'var(--accent-rose)' }]}
                xLabel="the public set’s noise"
                yLabel="the optimism"
                height={260}
              />
            </Figure>

            <Callout tone="warning" title="A public leaderboard is a selection machine">
              A public test set is not only measured on; it is selected on. The winner is the model that did best on
              that draw, which is partly the best model and partly the lucky one. The private set is what recovers the
              difference, and it only works if it stays private.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
