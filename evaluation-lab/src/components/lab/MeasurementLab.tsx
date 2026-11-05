import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  detectionPower,
  intervalWidthCurve,
  questionsNeeded,
  scoreDistribution,
  scoreInterval,
} from '../../core/measurement'
import { decodingSweep } from '../../core/benchmarking'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'

type View = 'interval' | 'power' | 'summary' | 'decoding'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const MEASUREMENT_VIEWS: { value: View; label: string }[] = [
  { value: 'interval', label: 'The interval' },
  { value: 'power', label: 'The power' },
  { value: 'summary', label: 'What to publish' },
  { value: 'decoding', label: 'The decoder' },
]

export function MeasurementLab() {
  const [view, setView] = useViewParam(MEASUREMENT_VIEWS)
  const [score, setScore] = useState(0.6)
  const [questions, setQuestions] = useState(100)
  const [difference, setDifference] = useState(0.05)
  const [temperature, setTemperature] = useState(0.8)

  const interval = useMemo(() => scoreInterval(score, questions), [score, questions])

  const widthCurve = useMemo(
    () => intervalWidthCurve(score, [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]),
    [score],
  )

  const powerCurve = useMemo(
    () =>
      [25, 50, 100, 250, 500, 1000, 2500, 5000].map((n) => ({
        x: n,
        power: detectionPower(score, score - difference, n),
      })),
    [score, difference],
  )

  const distribution = useMemo(() => scoreDistribution(score, questions, 3000, 71), [score, questions])
  const needed = useMemo(() => questionsNeeded(score, score - difference), [score, difference])

  /** The score as the decoding temperature is swept, averaged over thirty runs. */
  const sweep = useMemo(() => decodingSweep(score), [score])
  const nearest = useMemo(() => {
    let best = sweep[0]
    for (const row of sweep) {
      if (Math.abs(row.temperature - temperature) < Math.abs(best.temperature - temperature)) best = row
    }
    return best
  }, [sweep, temperature])

  const histogram = useMemo(() => {
    const bins = 21
    const counts = new Array<number>(bins).fill(0)
    for (const value of distribution) {
      const index = Math.min(bins - 1, Math.max(0, Math.floor(value * bins)))
      counts[index]++
    }
    return counts.map((count, index) => ({
      x: index / bins,
      count: count / distribution.length,
    }))
  }, [distribution])

  return (
    <div className="lab">
      <Panel
        title="Laboratory E · Measurement"
        subtitle="The number on the leaderboard has an error bar, and it has a cost"
        accent="violet"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={MEASUREMENT_VIEWS}
          />
          <Slider
            label="The score"
            value={score}
            min={0.05}
            max={0.95}
            step={0.01}
            onChange={setScore}
            format={(value) => fmt(value * 100, 0) + '%'}
          />
          <Slider
            label="Questions in the benchmark"
            value={questions}
            min={10}
            max={2000}
            step={10}
            onChange={setQuestions}
          />
          <Slider
            label="The difference to detect"
            value={difference}
            min={0.01}
            max={0.2}
            step={0.01}
            onChange={setDifference}
            format={(value) => fmt(value * 100, 1) + ' pp'}
          />
          {view === 'decoding' ? (
            <Slider
              label="Decoding temperature"
              value={temperature}
              min={0}
              max={1.5}
              step={0.2}
              onChange={setTemperature}
              format={(value) => value.toFixed(1)}
              hint="The sampler setting the benchmark was run at."
            />
          ) : null}
        </div>

        <div className="stat-row">
          <Stat label="The score" value={fmt(score * 100, 1) + '%'} />
          <Stat
            label="95% interval"
            value={`${fmt(interval.low * 100, 1)}% – ${fmt(interval.high * 100, 1)}%`}
            hint={`±${fmt(1.96 * interval.standardError * 100, 1)} percentage points`}
          />
          <Stat
            label="Standard error"
            value={`${fmt(interval.standardError * 100, 2)} pp`}
          />
          <Stat
            label="Questions needed"
            value={questionsNeeded(score, score - difference) === Infinity ? 'never' : String(needed)}
            hint={`to detect ${fmt(difference * 100, 1)} points`}
          />
        </div>

        {view === 'interval' ? (
          <>
            <Figure
              title="The score, re-run many times"
              description="The distribution of the score when the same benchmark is run many times on the same model, at the chosen question count."
              caption="3000 simulated runs of a benchmark. The spread is the standard error, and it is the reason two models with scores a point apart have not been shown to be different."
            >
              <TrendChart
                data={histogram}
                series={[{ key: 'count', name: 'the score', colour: 'var(--accent-violet)' }]}
                xLabel="the score"
                yLabel="how often it came out this way"
                height={260}
                referenceLines={[{ x: score, label: 'the reported score' }]}
              />
            </Figure>

            <Figure
              title="How the interval narrows"
              description="The width of the 95% confidence interval on the score, against the number of questions in the benchmark, on a logarithmic scale."
              caption="The interval falls as one over the square root of the number of questions. To halve it you need four times as many questions, which is the arithmetic behind why large benchmarks are expensive."
            >
              <TrendChart
                data={widthCurve}
                xKey="questions"
                series={[{ key: 'width', name: 'the interval width', colour: 'var(--accent-violet)' }]}
                xLabel="questions in the benchmark (log scale)"
                yLabel="interval width"
                height={280}
              />
            </Figure>

            <DataTable
              caption="The width, against the question count"
              headers={['Questions', 'Standard error', '95% interval width']}
              rows={widthCurve.map((row) => [
                String(row.questions),
                `${fmt(row.standardError * 100, 3)} pp`,
                `${fmt(row.width * 100, 2)} pp`,
              ])}
            />
          </>
        ) : null}

        {view === 'power' ? (
          <>
            <Figure
              title="The power of the comparison"
              description="The probability of detecting a real difference of the chosen size, as the number of questions increases."
              caption="Power against the question count. Below 80%, most real differences are reported as ties — and a benchmark that reports a tie has told you nothing about that pair."
            >
              <TrendChart
                data={powerCurve}
                series={[{ key: 'power', name: 'power', colour: 'var(--accent-violet)' }]}
                xLabel="questions in the benchmark"
                yLabel="the probability of detecting the difference"
                yDomain={[0, 1]}
                height={280}
                referenceLines={[{ y: 0.8, label: '80% power' }]}
              />
            </Figure>

            <DataTable
              caption="How many questions a given difference needs"
              headers={['Difference to detect', 'Questions needed, at 80% power', 'Power at the current size']}
              rows={[0.2, 0.1, 0.05, 0.02, 0.01].map((delta) => [
                `${fmt(delta * 100, 0)} pp`,
                String(questionsNeeded(score, score - delta)),
                `${fmt(detectionPower(score, score - delta, questions) * 100, 1)}%`,
              ])}
            />

            <Callout tone="warning" title="The number nobody asks before the benchmark is released">
              Before a benchmark is built, the question is not "how big is the difference" but "how big is the difference
              we want to detect, and how many questions will that take". A benchmark sized for a one-point difference
              cannot report a two-point difference, and a benchmark sized for a ten-point difference will report
              nothing at all.
            </Callout>
          </>
        ) : null}

        {view === 'summary' ? (
          <>
            <Figure
              title="The same score, twice"
              description="The reported score on its own, and the reported score with its interval, and the question count that goes with it."
              caption="Everything a leaderboard should print. The interval is the measurement; the point estimate alone is a claim."
            >
              <DataTable
                caption="What to publish"
                headers={['Quantity', 'Value']}
                rows={[
                  ['the score', fmt(score * 100, 2) + '%'],
                  ['the 95% interval', `${fmt(interval.low * 100, 2)}% – ${fmt(interval.high * 100, 2)}%`],
                  ['the standard error', `${fmt(interval.standardError * 100, 3)} percentage points`],
                  ['the number of questions', String(questions)],
                  ['the number of votes per question', '1'],
                  ['the model families evaluated', 'every family, not one'],
                  ['the date the run was made', 'a date, not "latest"'],
                  ['the protocol', 'a template, a decoder and a seed'],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="The minimum">
              A score without an interval is a claim. A score without a question count cannot be compared with anything.
              A score without a protocol cannot be reproduced. All three are cheap to print, and the field has mostly not
              printed them.
            </Callout>

            <Callout tone="note" title="And the number underneath">
              Whatever the harness does, the judge has to be reported against a human baseline, and the question set has
              to be reported with its difficulty mix. A judge at 80% on a hard set and a judge at 80% on an easy set are
              not the same measurement, and a leaderboard that prints neither cannot be compared with another one.
            </Callout>
          </>
        ) : null}
        {view === 'decoding' ? (
          <>
            <div className="stat-row">
              <Stat label="Score at the chosen temperature" value={fmt(nearest.mean * 100, 2) + '%'} />
              <Stat
                label="Shift against greedy decoding"
                value={`${nearest.delta >= 0 ? '+' : ''}${fmt(nearest.delta * 100, 2)} pp`}
                tone={Math.abs(nearest.delta) > 0.02 ? 'warn' : 'default'}
              />
              <Stat label="Run-to-run spread" value={`${fmt(nearest.sd * 100, 2)} pp`} hint="thirty repeats" />
              <Stat
                label="Shift, in standard errors"
                value={`${fmt(Math.abs(nearest.delta) / Math.max(1e-9, interval.standardError), 2)}σ`}
                hint={`at ${questions} questions`}
              />
            </div>

            <Figure
              title="The same benchmark, at eight decoders"
              description="The mean score over thirty runs, as the decoding temperature is raised from greedy to 1.5."
              caption="The score is not a property of the model alone: the decoder moves it. The dashed line is the score at temperature zero. The shape here is a toy model of the effect — a modest gain from sampling that saturates, while the run-to-run spread keeps growing — and the magnitude is illustrative, not a measurement of any published system."
            >
              <TrendChart
                data={sweep.map((row) => ({ x: row.temperature, mean: row.mean, base: score }))}
                series={[
                  { key: 'mean', name: 'the score at this temperature', colour: 'var(--accent-violet)' },
                  { key: 'base', name: 'greedy decoding', colour: 'var(--accent-teal)', dashed: true },
                ]}
                xLabel="decoding temperature"
                yLabel="the score"
                height={280}
              />
            </Figure>

            <DataTable
              caption="The sweep, row by row"
              headers={['Temperature', 'Mean score', 'Shift', 'Run-to-run spread']}
              rows={sweep.map((row) => [
                row.temperature.toFixed(1),
                `${fmt(row.mean * 100, 2)}%`,
                `${row.delta >= 0 ? '+' : ''}${fmt(row.delta * 100, 2)} pp`,
                `${fmt(row.sd * 100, 2)} pp`,
              ])}
            />

            <Callout tone="warning" title="Two benchmarks, one model">
              At a typical question count the shift from a decoder is comparable to, or larger than, the standard error
              of the benchmark itself. A leaderboard that prints a score without the temperature, the sampling scheme
              and the number of samples per question is not measuring the model — it is measuring a model and a
              configuration, and two such numbers are not comparable.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
