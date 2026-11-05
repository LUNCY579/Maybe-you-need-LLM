import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildGridworld, rollout, SoftmaxPolicy, stateCount, stochasticAdvantages, type Trajectory } from '../../core/mdp'
import { advantageEstimate, measureEstimator, nStepReturn } from '../../core/returns'
import { compareRewardWeightings, gradientNorm } from '../../core/policygradient'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'nstep' | 'lambda' | 'weighting'

export function ReturnsLab() {
  const [view, setView] = useState<View>('nstep')
  const [lambda, setLambda] = useState(0.8)
  const [horizon, setHorizon] = useState(100)
  const [discount, setDiscount] = useState(0.95)
  const [seed, setSeed] = useState(4)
  const [perBatch, setPerBatch] = useState(250)
  const [weightingBaseline, setWeightingBaseline] = useState(false)

  const world = useMemo(() => buildGridworld(), [])
  const policy = useMemo(() => new SoftmaxPolicy(stateCount(world), 4), [world])
  const { values, advantages } = useMemo(() => stochasticAdvantages(world, policy), [world, policy])

  const trajectory = useMemo(() => rollout(world, policy, seed), [world, policy, seed])

  const nStepRows = useMemo(
    () =>
      trajectory.rewards.slice(0, 12).map((_, t) => ({
        t,
        steps: [1, 2, 3, 5, 8, 12].map((n) => nStepReturn(trajectory.rewards, t, n, discount)),
      })),
    [trajectory, discount],
  )

  const sweep = useMemo(
    () =>
      [0, 0.2, 0.4, 0.6, 0.8, 0.9, 0.95, 1].map((value) => {
        const measured = measureEstimator(world, policy, value, {
          trajectories: 400,
          horizon,
          values,
          advantages,
        })
        return { x: value, bias: measured.bias, variance: measured.variance, error: measured.meanSquaredError }
      }),
    [world, policy, horizon, values, advantages],
  )

  const gae = useMemo(
    () =>
      trajectory.rewards.slice(0, 12).map((_, t) => ({
        t,
        estimate: advantageEstimate(trajectory.rewards, values, t, lambda, discount),
        truth: advantages[(trajectory.states[t] ?? 0) * 4 + (trajectory.actions[t] ?? 0)] ?? 0,
      })),
    [trajectory, values, lambda, discount, advantages],
  )

  /* The two ways to weight the score of a step: the rewards still to come, or
     the whole episode's return. The expectation is the same and the spread is
     not, and `compareRewardWeightings` measures both against the exact
     gradient of the exact return. */
  const weightings = useMemo(
    () =>
      compareRewardWeightings(world, policy, {
        batches: 16,
        trajectoriesPerBatch: perBatch,
        seed,
        baseline: weightingBaseline
          ? (trajectory: Trajectory, index: number) => values[trajectory.states[index] ?? 0] ?? 0
          : undefined,
      }),
    [world, policy, perBatch, seed, weightingBaseline, values],
  )

  const withoutShift = useMemo(
    () =>
      weightingBaseline
        ? compareRewardWeightings(world, policy, {
            batches: 16,
            trajectoriesPerBatch: perBatch,
            seed,
          })
        : null,
    [world, policy, perBatch, seed, weightingBaseline],
  )

  const weightingsTitle = weightingBaseline
    ? 'The reward-to-go and the total return, both with the value of the state subtracted'
    : 'The reward-to-go and the total return, with nothing subtracted'

  /* The gaps the comparison reports are the largest differences over logits,
     scaled by the length of the gradient. Undoing the scale is what lets the
     table and the sentence about it use the same units. */
  const exactLength = useMemo(() => gradientNorm(weightings.exact), [weightings])
  const spreadCounts = useMemo(() => {
    let wider = 0
    let narrower = 0
    let equal = 0
    weightings.rewardToGo.deviation.forEach((deviation, index) => {
      const total = weightings.total.deviation[index] ?? 0
      if (total > deviation) wider += 1
      else if (total < deviation) narrower += 1
      else equal += 1
    })
    return { wider, narrower, equal, logits: weightings.rewardToGo.deviation.length }
  }, [weightings])
  const largestMeanGap = weightings.meanGap * exactLength
  const largestDistanceToExact =
    Math.max(weightings.relativeErrorRewardToGo, weightings.relativeErrorTotal) * exactLength

  return (
    <div className="lab">
      <Panel
        title="Laboratory C · The returns"
        subtitle="Trading the bias of the bootstrap against the noise of the sample"
        accent="teal"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'nstep', label: 'The n-step returns' },
              { value: 'lambda', label: 'The λ-return' },
              { value: 'weighting', label: 'Reward-to-go' },
            ]}
          />
          {view === 'weighting' ? (
            <>
              <Slider
                label="The trajectories in each batch"
                value={perBatch}
                min={100}
                max={600}
                step={50}
                onChange={setPerBatch}
                hint="Sixteen batches, each an independent estimate of the same gradient. The spread between them is the noise."
              />
              <div className="field">
                <span className="field-label">The baseline</span>
                <button
                  type="button"
                  className={weightingBaseline ? 'btn btn-primary' : 'btn btn-default'}
                  onClick={() => setWeightingBaseline(!weightingBaseline)}
                >
                  {weightingBaseline ? 'On' : 'Off'}
                </button>
              </div>
            </>
          ) : (
            <>
              <Slider
                label="λ"
                value={lambda}
                min={0}
                max={1}
                step={0.05}
                onChange={setLambda}
                format={(value) => value.toFixed(2)}
              />
              <Slider
                label="The horizon"
                value={horizon}
                min={3}
                max={100}
                step={1}
                onChange={setHorizon}
                hint="How long an episode may run before it is cut off. The truncation is where the bias comes from."
              />
              <Slider
                label="The discount"
                value={discount}
                min={0.5}
                max={1}
                step={0.01}
                onChange={setDiscount}
                format={(value) => value.toFixed(2)}
              />
            </>
          )}
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        {view === 'weighting' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The gap between the two means"
                value={fmt(weightings.meanGap, 4)}
                hint="as a fraction of the size of the gradient"
                tone={weightings.meanGap < 0.1 ? 'good' : 'warn'}
              />
              <Stat
                label="The noisier one is worth"
                value={`${fmt(weightings.spreadRatio, 3)}×`}
                tone="warn"
                hint="the spread of the total-return estimator over the reward-to-go one"
              />
              <Stat
                label="The distance to the gradient"
                value={`${fmt(weightings.relativeErrorRewardToGo, 3)} / ${fmt(weightings.relativeErrorTotal, 3)}`}
                hint="reward-to-go, and the total return"
              />
              <Stat
                label="The samples"
                value={`${weightings.batches} × ${weightings.trajectoriesPerBatch}`}
              />
            </div>

            <Figure
              title="The same expectation, twice"
              description="The mean of each estimator over sixteen batches, against the exact gradient of the exact return."
              caption={`${weightingsTitle}. Each mean is an average over ${weightings.batches} batches, so the distance between the two is sampling noise: no logit differs by more than ${fmt(
                largestMeanGap,
                3,
              )}, and no mean sits further from the exact gradient than ${fmt(largestDistanceToExact, 3)}.`}
            >
              <DataTable
                caption="The first sixteen logits"
                headers={[
                  'The logit',
                  'The exact gradient',
                  'The mean, reward-to-go',
                  'The mean, total return',
                  'The difference between the means',
                ]}
                rows={weightings.exact.slice(0, 16).map((exact, index) => [
                  index,
                  fmt(exact, 5),
                  fmt(weightings.rewardToGo.mean[index] ?? 0, 5),
                  fmt(weightings.total.mean[index] ?? 0, 5),
                  fmt((weightings.rewardToGo.mean[index] ?? 0) - (weightings.total.mean[index] ?? 0), 5),
                ])}
              />
            </Figure>

            <Figure
              title="The spread each weighting leaves behind"
              description="The standard deviation of the estimate for each logit, over the batches."
              caption={`Both columns are the same estimator of the same number. Of the ${spreadCounts.logits} logits, the total-return spread is wider on ${spreadCounts.wider}, narrower on ${spreadCounts.narrower}, and equal on ${spreadCounts.equal}. Where it is wider, the extra noise is reward the step could not have influenced, still riding on its score.`}
            >
              <TrendChart
                data={weightings.rewardToGo.deviation.slice(0, 24).map((deviation, index) => ({
                  x: index,
                  rewardToGo: deviation,
                  total: weightings.total.deviation[index] ?? 0,
                }))}
                series={[
                  { key: 'rewardToGo', name: 'the reward-to-go spread', colour: 'var(--accent-teal)' },
                  { key: 'total', name: 'the total-return spread', colour: 'var(--accent-rose)' },
                ]}
                xLabel="the logit"
                yLabel="the deviation"
                height={250}
              />
            </Figure>

            {withoutShift ? (
              <Callout tone="definition" title="What the baseline takes over">
                With nothing subtracted, the total-return estimator is {fmt(withoutShift.spreadRatio, 2)} times as
                noisy as the reward-to-go one. With the value of the state subtracted from both, the same comparison
                gives {fmt(weightings.spreadRatio, 2)} — the baseline has already removed most of what the weighting
                was there to remove. That is why practitioners run both: a value function is the bigger saving, and
                reward-to-go is the free one on top of it. Both pairs are computed on the same batches of the same
                trajectories, so the two numbers are comparable.
              </Callout>
            ) : (
              <Callout tone="definition" title="Why the expectation does not move">
                The score of a step is a function of the action taken at that step, and the rewards collected before
                it are already fixed by the time the action is drawn. Their product therefore has expectation zero,
                and adding them to the weight cannot change the mean — only the spread. What the sample shows is the
                same: the two means differ by at most {fmt(largestMeanGap, 3)} on any logit, while the noise of{' '}
                {weightings.batches} batches of {weightings.trajectoriesPerBatch} trajectories puts a single mean as
                much as {fmt(largestDistanceToExact, 3)} away from the exact gradient. The gap between the weightings
                is smaller than the uncertainty in either of them, which is what an unchanged expectation looks like
                in a finite sample.
              </Callout>
            )}

            <Callout tone="warning" title="What these numbers are">
              The gridworld is the real environment and the reference gradient is the real derivative, but the
              comparison is a finite sample of sixteen batches: the spread ratio moves when you move the batch size,
              and it settles as the batches grow. The estimate of the gradient itself sits about{' '}
              {fmt(weightings.relativeErrorRewardToGo, 2)} of the gradient&apos;s own length away from the answer, at
              this sample size — which is the honest reason a single trajectory is not a policy gradient. The norm of
              the exact gradient is {fmt(exactLength, 3)}.
            </Callout>
          </>
        ) : null}

        {view !== 'weighting' ? (
          <div className="stat-row">
            <Stat
              label="The bias"
              value={fmt(sweep.find((row) => Math.abs(row.x - lambda) < 0.06)?.bias ?? 0, 4)}
              tone="warn"
            />
            <Stat
              label="The variance"
              value={fmt(sweep.find((row) => Math.abs(row.x - lambda) < 0.06)?.variance ?? 0, 4)}
            />
            <Stat
              label="The error"
              value={fmt(sweep.find((row) => Math.abs(row.x - lambda) < 0.06)?.error ?? 0, 4)}
              tone="good"
            />
            <Stat label="The episode" value={`${trajectory.rewards.length} steps`} />
          </div>
        ) : null}

        {view === 'nstep' ? (
          <>
            <Figure
              title="The n-step returns of a real trajectory"
              description="The estimate at each length, from the first step of an episode the agent actually played."
              caption="The short estimates are biased and quiet; the long ones are unbiased and noisy. The middle is the trade, and the horizon says where the middle is."
            >
              <DataTable
                caption="The n-step returns"
                headers={['The step', 'One step', 'Two steps', 'Three steps', 'Five steps', 'Eight steps', 'Twelve steps']}
                rows={nStepRows.map((row) => [
                  row.t,
                  ...row.steps.map((value) => fmt(value, 3)),
                ])}
              />
            </Figure>

            <Callout tone="definition" title="Where the bias comes from">
              The n-step return looks n rewards ahead and then adds the discounted value of the state it arrives in.
              That value is an estimate, and the error in it is the bias. The longer the look-ahead, the smaller the
              weight on the estimate and the larger the sample — and the two errors trade against each other exactly as
              the bias and the variance do.
            </Callout>
          </>
        ) : null}

        {view === 'lambda' ? (
          <>
            <Figure
              title="The bias and the variance, as λ moves"
              description="The measured bias and the measured variance of the advantage estimate, at each λ."
              caption="The bias grows with λ and the variance falls with it. The λ that minimises the error is the one that matches the estimator to the horizon you have."
            >
              <TrendChart
                data={sweep}
                series={[
                  { key: 'bias', name: 'the bias', colour: 'var(--accent-rose)' },
                  { key: 'variance', name: 'the variance', colour: 'var(--accent-indigo)' },
                ]}
                xLabel="λ"
                yLabel="the error"
                height={270}
              />
            </Figure>

            <Figure
              title="The estimate and the truth"
              description="The general advantage estimate along the episode, and the true advantage of the state and action taken."
              caption="The estimate is the sum of the temporal-difference errors, weighted by how far ahead each one is. The truth is solved exactly, from the linear evaluation equations."
            >
              <DataTable
                caption="The advantage along the episode"
                headers={['The step', 'The estimate', 'The truth', 'The difference']}
                rows={gae.map((row) => [row.t, fmt(row.estimate, 4), fmt(row.truth, 4), fmt(row.estimate - row.truth, 4)])}
              />
            </Figure>

            <Callout tone="warning" title="The best λ depends on the horizon">
              The bias comes from the truncation of the episode, so a short horizon wants a small λ and a long one can
              afford a large λ. Move the horizon in the laboratory and watch the whole curve slide: the right λ is a
              function of the episode length you actually have, not a constant.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
