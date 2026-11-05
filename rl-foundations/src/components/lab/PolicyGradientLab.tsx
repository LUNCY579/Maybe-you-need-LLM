import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  buildGridworld,
  SoftmaxPolicy,
  stateCount,
  stochasticAdvantages,
  type Trajectory,
} from '../../core/mdp'
import {
  compareGradients,
  exactGradient,
  gradientStandardDeviation,
} from '../../core/policygradient'
import {
  banditLogits,
  baselineVarianceEffect,
  best,
  buildBandit,
  compareForms,
  softmax,
  trainBandit,
} from '../../core/bandit'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'derivation' | 'estimator' | 'baseline'

export function PolicyGradientLab() {
  const [view, setView] = useState<View>('derivation')
  const [trajectories, setTrajectories] = useState(2000)
  const [seed, setSeed] = useState(3)
  const [useBaseline, setUseBaseline] = useState(true)
  const [scale, setScale] = useState(1)
  const [sharpness, setSharpness] = useState(0.5)

  const world = useMemo(() => buildGridworld(), [])
  const policy = useMemo(() => {
    const logits = new Array<number>(stateCount(world) * 4).fill(0)
    for (let index = 0; index < logits.length; index++) logits[index] = 0.2 * Math.sin(index * scale)
    return new SoftmaxPolicy(stateCount(world), 4, logits)
  }, [world, scale])

  const { values } = useMemo(() => stochasticAdvantages(world, policy), [world, policy])

  const subtract = (trajectory: Trajectory, index: number) => values[trajectory.states[index] ?? 0] ?? 0

  /* The reference gradient does not depend on the sample size or on the
     baseline, so the sweeps below pay for it once. */
  const reference = useMemo(() => exactGradient(world, policy), [world, policy])

  const comparison = useMemo(
    () =>
      compareGradients(world, policy, {
        trajectories,
        seed,
        baseline: useBaseline ? subtract : undefined,
        exact: reference,
      }),
    [world, policy, trajectories, seed, useBaseline, values, reference],
  )

  const spread = useMemo(
    () =>
      gradientStandardDeviation(world, policy, {
        batches: 8,
        trajectoriesPerBatch: 200,
        seed,
        baseline: useBaseline ? subtract : undefined,
      }),
    [world, policy, seed, useBaseline, values],
  )

  const norm = (values: number[]) => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0))

  /* The same two measurements with the baseline in each position, so the
     screen states what a baseline is worth instead of asserting it. */
  const pair = useMemo(() => {
    if (view !== 'baseline') return null
    const measure = (baseline?: (trajectory: Trajectory, index: number) => number) => ({
      spread: gradientStandardDeviation(world, policy, {
        batches: 8,
        trajectoriesPerBatch: 200,
        seed,
        baseline,
      }),
      error: compareGradients(world, policy, { trajectories, seed, baseline, exact: reference }),
    })
    return { on: measure(subtract), off: measure() }
  }, [view, world, policy, seed, trajectories, values, reference])

  /* The bandit: one state, so the derivation is a finite sum and every line of
     it can be computed rather than sampled. */
  const bandit = useMemo(() => buildBandit(), [])
  const banditLogitsAt = useMemo(() => banditLogits(bandit, sharpness), [bandit, sharpness])
  const forms = useMemo(() => compareForms(bandit, banditLogitsAt), [bandit, banditLogitsAt])
  const moments = useMemo(() => baselineVarianceEffect(bandit, banditLogitsAt), [bandit, banditLogitsAt])
  const probabilities = useMemo(() => softmax(banditLogitsAt), [banditLogitsAt])
  const ascent = useMemo(
    () => trainBandit(bandit, { steps: 60, learningRate: 0.5, sharpness }),
    [bandit, sharpness],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory B · The policy gradient"
        subtitle="The derivation, the estimator, and the exact gradient it is estimating"
        accent="amber"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'derivation', label: 'The derivation' },
              { value: 'estimator', label: 'The estimator' },
              { value: 'baseline', label: 'The baseline' },
            ]}
          />
          {view === 'derivation' ? (
            <Slider
              label="How sharply the policy prefers"
              value={sharpness}
              min={0}
              max={3}
              step={0.1}
              onChange={setSharpness}
              format={(value) => value.toFixed(1)}
              hint="The preference of each arm is its reward times this number. At zero the policy is uniform."
            />
          ) : (
            <>
              <Slider
                label="The trajectories"
                value={trajectories}
                min={100}
                max={8000}
                step={100}
                onChange={setTrajectories}
              />
              <Slider
                label="How far the policy is from uniform"
                value={scale}
                min={0}
                max={3}
                step={0.1}
                onChange={setScale}
                format={(value) => value.toFixed(1)}
              />
              <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
              <div className="field">
                <span className="field-label">The baseline</span>
                <button
                  type="button"
                  className={useBaseline ? 'btn btn-primary' : 'btn btn-default'}
                  onClick={() => setUseBaseline(!useBaseline)}
                >
                  {useBaseline ? 'On' : 'Off'}
                </button>
              </div>
            </>
          )}
        </div>

        {view === 'derivation' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The objective"
                value={fmt(forms.objective, 4)}
                hint="the expected reward of the policy"
              />
              <Stat
                label="The best arm"
                value={fmt(probabilities[best(bandit)] ?? 0, 3)}
                hint="the probability it is given"
                tone="good"
              />
              <Stat
                label="The residual, three forms"
                value={fmt(Math.max(forms.residualScoreFunction, forms.residualBaseline), 12)}
                hint="direct, score function, baseline"
                tone="good"
              />
              <Stat
                label="The spread a baseline removes"
                value={`${fmt(moments.ratio, 3)}×`}
                hint="the estimator is this much quieter"
              />
            </div>

            <Figure
              title="The gradient three ways"
              description="One logit per arm. The direct derivative, the same derivative in the score-function form, and the score-function form with the expected reward subtracted from the reward."
              caption="The four arm rewards — 1.6, 1, 0.4 and −0.2 — are chosen rather than measured; everything in the table is computed from them. With one state the expectation is a finite sum, so the three columns should be the same number and the difference between them is arithmetic error, not sampling error."
            >
              <DataTable
                caption="The arms"
                headers={[
                  'The arm',
                  'The reward',
                  'The probability',
                  'The direct derivative',
                  'The score-function form',
                  'With a baseline',
                ]}
                rows={bandit.rewards.map((reward, arm) => [
                  arm,
                  fmt(reward, 3),
                  fmt(probabilities[arm] ?? 0, 4),
                  fmt(forms.direct[arm] ?? 0, 6),
                  fmt(forms.scoreFunction[arm] ?? 0, 6),
                  fmt(forms.baseline[arm] ?? 0, 6),
                ])}
              />
            </Figure>

            <Figure
              title="The moments of one drawn estimate"
              description="What a single sample of the estimator does to each logit: its mean, and its standard deviation, with and without the baseline."
              caption="The mean of the estimate is the gradient — that is the whole claim of the likelihood-ratio trick — and the exact moments here are sums over the arms rather than a histogram of samples. Subtracting the expected reward leaves the first two columns alone. The last two do not shrink everywhere: a baseline is a guarantee about the size of the whole vector, and one logit can get noisier while the total spread falls — the ratio above is the total, not this row."
            >
              <DataTable
                caption="The exact mean and spread of the sampled gradient"
                headers={[
                  'The logit',
                  'The mean of the estimate',
                  'The gradient',
                  'The deviation, no baseline',
                  'The deviation, with one',
                ]}
                rows={moments.withoutBaseline.mean.map((mean, index) => [
                  index,
                  fmt(mean, 6),
                  fmt(forms.direct[index] ?? 0, 6),
                  fmt(moments.withoutBaseline.deviation[index] ?? 0, 6),
                  fmt(moments.withBaseline.deviation[index] ?? 0, 6),
                ])}
              />
            </Figure>

            <Figure
              title="The step the derivation says is uphill"
              description="Sixty updates of the exact gradient, each one moving every logit by the learning rate times its derivative."
              caption="Nothing is sampled in this curve: it is the arithmetic of the derivative. If the gradient were wrong in sign, the objective would fall."
            >
              <TrendChart
                data={ascent.history.map((record, step) => ({
                  x: step,
                  objective: record.objective,
                  best: record.best,
                }))}
                series={[
                  { key: 'objective', name: 'the expected reward', colour: 'var(--accent-amber)' },
                  { key: 'best', name: 'the probability of the best arm', colour: 'var(--accent-indigo)' },
                ]}
                xLabel="the update"
                yLabel="the value"
                height={250}
              />
            </Figure>

            <Callout tone="definition" title="The four lines, and what each one costs">
              The objective is the sum of each arm&apos;s probability times its reward. The derivative of a softmax is
              the probability of the arm times the indicator minus the probability again, so the derivative of the
              objective collapses to the probability of an arm times the difference between its reward and the average
              reward: push the logit of any arm that beats the average, and the objective rises. Written as an
              expectation over the arm actually drawn, the same expression is the score of that arm times its reward —
              which is the form an agent can compute without knowing the rewards, and the form that has to be averaged
              over samples.
            </Callout>

            <Callout tone="warning" title="What a baseline may not depend on">
              Subtract a quantity that depends on the arm rather than on the state and the expectation moves: the
              largest per-logit difference from the true gradient here is {fmt(forms.wrongBaselineResidual, 4)}, which
              is {fmt(100 * (forms.wrongBaselineResidual / (Math.max(...forms.direct.map((value) => Math.abs(value))) || 1)), 0)}{' '}
              percent of the biggest component of the gradient itself. That is not a rounding error and not a matter of
              the four arms cancelling; it is the theorem failing exactly where its hypothesis fails. The baseline the
              laboratory uses is the expected reward, which is a function of the state alone.
            </Callout>
          </>
        ) : null}

        {view === 'estimator' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The relative error"
                value={fmt(comparison.relativeError, 4)}
                hint="the estimate against the exact gradient"
                tone={comparison.relativeError < 0.5 ? 'good' : 'warn'}
              />
              <Stat
                label="The size of the gradient"
                value={fmt(norm(comparison.exact), 5)}
                hint="the norm of the exact one"
              />
              <Stat
                label="The spread of the estimate"
                value={fmt(norm(spread.deviation), 5)}
                tone="warn"
              />
              <Stat label="The trajectories" value={String(trajectories)} />
            </div>

            <Figure
              title="The estimate and the exact gradient"
              description="Every logit, with the estimate the agent produced and the gradient of the exact expected return."
              caption="The exact gradient is a central difference of the expected return of the stochastic policy, which is solved from the linear evaluation equations. The estimate is the score function times the return-to-go, averaged over the trajectories."
            >
              <DataTable
                caption="The first sixteen logits"
                rows={comparison.exact.slice(0, 16).map((exact, index) => [
                  index,
                  fmt(comparison.gradient[index] ?? 0, 5),
                  fmt(exact, 5),
                  fmt((comparison.gradient[index] ?? 0) - exact, 5),
                ])}
                headers={['The logit', 'The estimate', 'The exact gradient', 'The difference']}
              />
            </Figure>

            <Callout tone="definition" title="Why the estimate converges to the gradient">
              The likelihood-ratio trick turns the gradient of the expected return into an expectation of something the
              agent can measure while it is acting: the score of the action it took, times the return it collected. The
              expectation of that quantity <em>is</em> the gradient; the average of many trajectories only approaches
              it, and the laboratory measures how nearly.
            </Callout>
          </>
        ) : null}

        {view === 'baseline' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The relative error"
                value={fmt(comparison.relativeError, 4)}
                tone={comparison.relativeError < 0.5 ? 'good' : 'warn'}
              />
              <Stat
                label="The spread, this setting"
                value={fmt(norm(spread.deviation), 5)}
                tone="warn"
              />
              <Stat
                label="The baseline"
                value={useBaseline ? 'On' : 'Off'}
                hint={useBaseline ? 'the value of the state, subtracted' : 'nothing subtracted'}
              />
              <Stat label="The logits" value={`${spread.mean.length}, over 8 batches`} />
            </div>

            <Figure
              title="The spread, with and without a baseline"
              description="The standard deviation of the estimated gradient, over repeated batches of trajectories."
              caption="The baseline does not change the expectation. It changes the spread, and the spread is what decides how many samples a practitioner needs."
            >
              <DataTable
                caption="The spread of the estimate, by logit"
                headers={['The logit', 'The deviation', 'The mean of the estimate']}
                rows={spread.deviation.slice(0, 16).map((deviation, index) => [
                  index,
                  fmt(deviation, 6),
                  fmt(spread.mean[index] ?? 0, 6),
                ])}
              />
            </Figure>

            <Figure
              title="The error against the number of trajectories"
              description="The relative error of the estimate, as the number of trajectories grows, with the baseline on and off."
              caption="The error falls as the square root of the number of samples, which is the usual rate for an average. The two curves keep that rate and sit at different heights: a baseline changes the constant, not the rate."
            >
              <TrendChart
                data={[500, 1000, 2000, 4000, 8000].map((count) => ({
                  x: count,
                  withBaseline: compareGradients(world, policy, {
                    trajectories: count,
                    seed,
                    baseline: subtract,
                    exact: reference,
                  }).relativeError,
                  withoutBaseline: compareGradients(world, policy, {
                    trajectories: count,
                    seed,
                    exact: reference,
                  }).relativeError,
                }))}
                series={[
                  { key: 'withBaseline', name: 'with a baseline', colour: 'var(--accent-teal)' },
                  { key: 'withoutBaseline', name: 'without one', colour: 'var(--accent-amber)' },
                ]}
                xLabel="the trajectories"
                yLabel="the relative error"
                height={260}
              />
            </Figure>

            {pair ? (
              <Callout tone="warning" title="What the baseline does not do">
                Subtracting the value of the state from the return leaves the expected gradient <em>exactly</em>{' '}
                unchanged, and the two estimators are measured here against the same reference. What the baseline
                changes is the spread: the deviation of the estimate is {fmt(norm(pair.off.spread.deviation), 3)} with
                nothing subtracted and {fmt(norm(pair.on.spread.deviation), 3)} with the value of the state taken off —{' '}
                {fmt(norm(pair.off.spread.deviation) / (norm(pair.on.spread.deviation) || 1), 2)} times wider. At the
                same sample size the error against the exact gradient goes from{' '}
                {fmt(pair.off.error.relativeError, 4)} to {fmt(pair.on.error.relativeError, 4)}. Both are unbiased, so
                the difference between them is noise; and the noise is what decides whether a practitioner can afford
                the number of samples the estimate needs.
              </Callout>
            ) : null}
          </>
        ) : null}
      </Panel>
    </div>
  )
}
