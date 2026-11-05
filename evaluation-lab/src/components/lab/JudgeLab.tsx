import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  MODELS,
  NEUTRAL_JUDGE,
  buildAnswers,
  buildQuestions,
  judgePreference,
  measureJudge,
} from '../../core/setting'
import type { JudgeBiases } from '../../core/setting'
import { Button, Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, PointChart, TrendChart, useViewParam } from '@llm-materials/course-ui'

type View = 'agreement' | 'consistency' | 'difficulty'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const JUDGE_VIEWS: { value: View; label: string }[] = [
  { value: 'agreement', label: 'Agreement' },
  { value: 'consistency', label: 'Consistency' },
  { value: 'difficulty', label: 'Difficulty' },
]

export function JudgeLab() {
  const [view, setView] = useViewParam(JUDGE_VIEWS)
  const [questionCount, setQuestionCount] = useState(30)
  const [seed, setSeed] = useState(7)
  const [noise, setNoise] = useState(NEUTRAL_JUDGE.noise)
  const [positionBias, setPositionBias] = useState(0)
  const [trials, setTrials] = useState(0)

  const questions = useMemo(() => buildQuestions(questionCount, 5), [questionCount])
  const answers = useMemo(() => buildAnswers(MODELS, questions, 11), [questions])
  const biases: JudgeBiases = useMemo(
    () => ({ ...NEUTRAL_JUDGE, noise, positionBias }),
    [noise, positionBias],
  )

  const measurement = useMemo(
    () => measureJudge(MODELS, questions, answers, biases, seed),
    [questions, answers, biases, seed],
  )

  /** Agreement as the questions get harder. */
  const difficultyCurve = useMemo(() => {
    const buckets = 8
    const rows: { x: number; agreement: number; pairs: number }[] = []
    for (let b = 0; b < buckets; b++) {
      const low = b / buckets
      const high = (b + 1) / buckets
      const slice = questions.filter((q) => q.difficulty >= low && q.difficulty < high)
      if (slice.length === 0) continue
      const sliceAnswers = answers.filter((a) => slice.some((q) => q.id === a.questionId))
      const result = measureJudge(MODELS, slice, sliceAnswers, biases, seed + b)
      rows.push({ x: (low + high) / 2, agreement: result.agreement, pairs: result.pairs })
    }
    return rows
  }, [questions, answers, biases, seed])

  /** The distribution of the judge's margin on each pair. */
  const margins = useMemo(() => {
    const rows: { x: number; y: number }[] = []
    for (const question of questions.slice(0, 12)) {
      for (let i = 0; i < MODELS.length; i++) {
        for (let j = i + 1; j < MODELS.length; j++) {
          const a = answers.find((x) => x.modelId === MODELS[i].id && x.questionId === question.id)!
          const b = answers.find((x) => x.modelId === MODELS[j].id && x.questionId === question.id)!
          const result = judgePreference(a, b, 'first', biases, createRngFor(trials, i, j))
          rows.push({ x: result.scoreA - result.scoreB, y: result.scoreA - result.scoreB })
        }
      }
    }
    return rows
  }, [questions, answers, biases, trials])

  return (
    <div className="lab">
      <Panel
        title="Laboratory A · The judge and the human"
        subtitle="A synthetic judge with known biases, measured against a human whose answers are known"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={JUDGE_VIEWS}
          />
          <Slider
            label="Questions"
            value={questionCount}
            min={5}
            max={60}
            onChange={setQuestionCount}
            hint="The size of the question set."
          />
          <Slider
            label="The judge's noise"
            value={noise}
            min={0}
            max={0.3}
            step={0.01}
            onChange={setNoise}
            format={(value) => value.toFixed(2)}
            hint="The part of the judge that is not bias at all."
          />
          <Slider
            label="The judge's position bias"
            value={positionBias}
            min={0}
            max={0.3}
            step={0.01}
            onChange={setPositionBias}
            format={(value) => value.toFixed(2)}
          />
          <Slider
            label="Seed"
            value={seed}
            min={1}
            max={99}
            onChange={setSeed}
            hint="The judge is re-run from scratch with this seed."
          />
          <div className="field">
            <span className="field-label">Re-judge</span>
            <Button onClick={() => setTrials((value) => value + 1)}>
              Draw again ({trials} so far)
            </Button>
          </div>
        </div>

        <div className="stat-row">
          <Stat
            label="Agreement with the human"
            value={`${fmt(measurement.agreement * 100, 1)}%`}
            hint={`${measurement.pairs} comparisons`}
            tone={measurement.agreement > 0.85 ? 'good' : 'warn'}
          />
          <Stat
            label="Consistency"
            value={`${fmt(measurement.consistency * 100, 1)}%`}
            hint="the same answer when the order changes"
            tone={measurement.consistency > 0.9 ? 'good' : 'warn'}
          />
          <Stat
            label="Disagreement"
            value={`${fmt(measurement.disagreement * 100, 1)}%`}
            hint="the two do not agree here"
          />
          <Stat label="Judge noise" value={noise.toFixed(2)} hint="the part that is not bias" />
        </div>

        {view === 'agreement' ? (
          <>
            <Figure
              title="Agreement against question difficulty"
              description="The agreement rate between the judge and the human, for question sets of increasing difficulty. The rate falls as the questions get harder."
              caption="Agreement against the average difficulty of the question set. The answers get closer in quality as the questions get harder, so both the judge and the human are closer to a coin flip — and a low agreement rate here does not mean a bad judge."
            >
              <TrendChart
                data={difficultyCurve}
                series={[{ key: 'agreement', name: 'Agreement', colour: 'var(--accent-indigo)' }]}
                xLabel="mean question difficulty"
                yLabel="agreement with the human"
                yDomain={[0.4, 1]}
                height={280}
              />
            </Figure>

            <DataTable
              caption="The measurement, and the standard error on it"
              headers={['Quantity', 'Value']}
              rows={[
                ['comparisons judged', String(measurement.pairs)],
                ['agreement', `${fmt(measurement.agreement * 100, 2)}%`],
                ['standard error', `${fmt(standardError(measurement.agreement, measurement.pairs) * 100, 2)} percentage points`],
                ['95% interval', `±${fmt(1.96 * standardError(measurement.agreement, measurement.pairs) * 100, 2)} percentage points`],
                ['consistency', `${fmt(measurement.consistency * 100, 2)}%`],
              ]}
            />

            <Callout tone="definition" title="What is being measured">
              The judge is a synthetic model whose score is the answer’s true usefulness, plus a position bias, plus a
              verbosity bias, plus a self-preference term, plus noise. The human reads the true usefulness with noise of
              its own. Because the truth is known here, the biases can be measured exactly. The protocol is the one used
              with a real judge; the numbers are not a measurement of any published system.
            </Callout>
          </>
        ) : null}

        {view === 'consistency' ? (
          <>
            <Figure
              title="The judge’s margin on every pair"
              description="The difference between the judge’s score for the two answers, for every pair and question. Points to the right mean the judge preferred the first answer."
              caption="The judge’s margin. A cloud centred on zero is an unbiased judge; a cloud shifted to the right is a judge that prefers whatever it saw first."
            >
              <PointChart
                points={margins}
                series={[{ key: 'margin', name: 'margin', colour: 'var(--accent-indigo)' }]}
                xLabel="the judge's margin (score of A minus score of B)"
                yLabel="the same"
                height={300}
                domain={[
                  [-1, 1],
                  [-1, 1],
                ]}
              />
            </Figure>

            <Callout tone="note" title="The swap test in one line">
              Judge the same pair twice, with the answers swapped, and check whether the same <em>answer</em> was
              preferred. If the judge is consistent, the answer does not matter; if it is not, the position does. This is
              a stricter test than agreement, because a judge can be consistently wrong.
            </Callout>
          </>
        ) : null}

        {view === 'difficulty' ? (
          <>
            <Figure
              title="Why the agreement rate is a property of the question set"
              description="For each difficulty band, the agreement rate between the judge and the human, and the number of comparisons that went into it."
              caption="Agreement and sample size, by difficulty band. The right-hand count is why the bands differ in how precisely they are measured."
            >
              <DataTable
                caption="Agreement by difficulty band"
                headers={['Mean difficulty', 'Comparisons', 'Agreement']}
                rows={difficultyCurve.map((row) => [
                  fmt(row.x, 3),
                  String(row.pairs),
                  `${fmt(row.agreement * 100, 1)}%`,
                ])}
              />
            </Figure>

            <Callout tone="warning" title="The number nobody reports">
              An agreement rate without its denominator, and without the difficulty of the question set, is not
              interpretable. The same judge on the same answers scores 85% on easy questions and 65% on hard ones — and
              the second number is the more honest one.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}

function standardError(p: number, n: number): number {
  if (n <= 0) return 0
  return Math.sqrt((p * (1 - p)) / n)
}

function createRngFor(trials: number, i: number, j: number) {
  let state = (trials + 1) * 1000 + i * 31 + j
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}
