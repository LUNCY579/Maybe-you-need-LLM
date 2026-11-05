import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  advantageStudy,
  clippedSurrogate,
  clippedSurrogateRatioGradient,
  clipIsActive,
  evaluatePpo,
  generalisedAdvantage,
  importanceRatio,
  ppoGradient,
  surrogate,
  trustRegionSurrogate,
} from '../../core/ppo'
import type { Trajectory } from '../../core/ppo'
import { applyStep, cloneBandit, contextValues, createBandit, rewardLandscape } from '../../core/policy'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'

type View = 'clip' | 'objective' | 'normalisation' | 'steps'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const PPO_VIEWS: { value: View; label: string }[] = [
  { value: 'clip', label: 'The clip' },
  { value: 'objective', label: 'The objective' },
  { value: 'normalisation', label: 'Normalisation' },
  { value: 'steps', label: 'The steps' },
]

export function PpoLab() {
  const [view, setView] = useViewParam(PPO_VIEWS)
  const [epsilon, setEpsilon] = useState(0.2)
  const [seed, setSeed] = useState(11)

  const oldPolicy = useMemo(() => createBandit(3, 4, seed), [seed])
  const current = useMemo(() => createBandit(3, 4, seed + 1), [seed])

  const trajectory: Trajectory = useMemo(
    () => ({
      steps: [
        { context: 0, action: 1, reward: 1.0, value: 0.5, nextValue: 0.6, terminal: false },
        { context: 1, action: 2, reward: 0.5, value: 0.6, nextValue: 0.4, terminal: false },
        { context: 2, action: 0, reward: -0.5, value: 0.4, nextValue: 0, terminal: true },
      ],
    }),
    [],
  )

  const advantages = useMemo(() => generalisedAdvantage(trajectory, 0.9, 0.95), [trajectory])

  /* Advantage normalisation is measured on its own sample: a landscape, an exact
     critic so the advantage itself carries no error, and batches drawn from the
     policy the update starts from, where the importance ratio is still one. */
  const [power, setPower] = useState(5)
  const batchSize = 2 ** power
  const studyRewards = useMemo(() => rewardLandscape(oldPolicy.contexts, oldPolicy.actions), [oldPolicy])
  const studyCritic = useMemo(() => contextValues(oldPolicy, studyRewards), [oldPolicy, studyRewards])

  const normalisation = useMemo(() => {
    if (view !== 'normalisation') return null
    const sizes = [4, 16, 64, 256]
    const sweep = sizes.map((size) => ({
      size,
      study: advantageStudy(oldPolicy, studyRewards, studyCritic, {
        batchSize: size,
        batches: 300,
        seed: 3,
      }),
    }))
    const current = advantageStudy(oldPolicy, studyRewards, studyCritic, {
      batchSize,
      batches: 1200,
      seed: 3,
    })
    const scales = [1, 2, 5, 10].map((factor) => ({
      factor,
      study: advantageStudy(
        oldPolicy,
        studyRewards.map((row) => row.map((value) => value * factor)),
        studyCritic.map((value) => value * factor),
        { batchSize: 32, batches: 200, seed: 7 },
      ),
    }))
    const pick = (study: typeof current, treatment: string) =>
      study.treatments.find((entry) => entry.treatment === treatment)!
    return {
      sweep,
      current,
      scales,
      pick,
      raw: pick(current, 'raw'),
      centred: pick(current, 'centred'),
      whitened: pick(current, 'whitened'),
    }
  }, [view, oldPolicy, studyRewards, studyCritic, batchSize])

  /** The objective as a function of the importance ratio, for both signs of the advantage. */
  const clipCurves = useMemo(() => {
    const positive: { x: number; clipped: number; unclipped: number }[] = []
    const negative: { x: number; clipped: number; unclipped: number }[] = []
    for (let r = 0.4; r <= 2.0; r += 0.05) {
      positive.push({ x: r, clipped: clippedSurrogate(r, 1, epsilon), unclipped: surrogate(r, 1) })
      negative.push({ x: r, clipped: clippedSurrogate(r, -1, epsilon), unclipped: surrogate(r, -1) })
    }
    return { positive, negative }
  }, [epsilon])

  /** The gradient as a function of the ratio. */
  const gradientCurve = useMemo(
    () =>
      Array.from({ length: 33 }, (_, i) => {
        const r = 0.4 + i * 0.05
        return {
          x: r,
          gradient: clippedSurrogateRatioGradient(r, 1, epsilon),
          active: clipIsActive(r, 1, epsilon),
        }
      }),
    [epsilon],
  )

  const evaluation = useMemo(
    () => evaluatePpo(current, oldPolicy, trajectory, advantages, epsilon),
    [current, oldPolicy, trajectory, advantages, epsilon],
  )

  /** What happens as the policy is pushed step after step. */
  const stepSweep = useMemo(() => {
    const rows: { x: number; kl: number; clipped: number; clipFraction: number; ratio: number }[] = []
    let policy = cloneBandit(oldPolicy)
    for (let step = 0; step <= 10; step++) {
      const gradient = ppoGradient(policy, oldPolicy, trajectory, advantages, epsilon)
      const result = evaluatePpo(policy, oldPolicy, trajectory, advantages, epsilon)
      const meanRatio = result.meanRatio
      rows.push({
        x: step,
        kl: 0,
        clipped: result.meanClipped,
        clipFraction: result.clipFraction,
        ratio: meanRatio,
      })
      policy = applyStep(policy, gradient, 0.8)
    }
    return rows
  }, [oldPolicy, trajectory, advantages, epsilon])

  const trustRegion = useMemo(
    () => trustRegionSurrogate(current, oldPolicy, trajectory, advantages),
    [current, oldPolicy, trajectory, advantages],
  )

  const ratio = useMemo(() => importanceRatio(current, oldPolicy, trajectory.steps[0]!), [
    current,
    oldPolicy,
    trajectory,
  ])

  return (
    <div className="lab">
      <Panel
        title="Laboratory B · The clipped objective"
        subtitle="Where the clip bites, and what it does to the gradient"
        accent="amber"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={PPO_VIEWS}
          />
          <Slider
            label="The clip range ε"
            value={epsilon}
            min={0.05}
            max={0.5}
            step={0.01}
            onChange={setEpsilon}
            format={(value) => value.toFixed(2)}
            hint="How far the ratio is allowed to travel before it stops counting."
          />
          {view === 'normalisation' ? (
            <Slider
              label="Batch size"
              value={power}
              min={2}
              max={8}
              onChange={setPower}
              format={() => `${batchSize}`}
              hint="How many steps one update is computed from. The statistic being normalised is estimated from these."
            />
          ) : null}
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="The importance ratio" value={fmt(ratio, 4)} hint="on the first step" />
          <Stat
            label="Clip fraction"
            value={`${fmt(evaluation.clipFraction * 100, 1)}%`}
            hint="of the steps where the clip bites"
            tone={evaluation.clipFraction > 0.2 ? 'warn' : 'good'}
          />
          <Stat label="Mean clipped objective" value={fmt(evaluation.meanClipped, 4)} />
          <Stat label="Mean unclipped" value={fmt(evaluation.meanUnclipped, 4)} />
        </div>

        {view === 'clip' ? (
          <>
            <Figure
              title="The objective as the ratio travels"
              description="The clipped and unclipped objectives as a function of the importance ratio, for a positive and a negative advantage."
              caption="The clipped objective follows the unclipped one until the ratio passes the bound, and then flattens. For a positive advantage the ceiling is 1 + ε; for a negative one the floor is 1 − ε."
            >
              <TrendChart
                data={clipCurves.positive}
                series={[
                  { key: 'clipped', name: 'clipped, positive advantage', colour: 'var(--accent-amber)' },
                  { key: 'unclipped', name: 'unclipped, positive advantage', colour: 'var(--accent-rose)', dashed: true },
                ]}
                xLabel="the importance ratio"
                yLabel="the objective"
                height={280}
              />
            </Figure>

            <Figure
              title="The gradient of the clipped objective"
              description="The derivative of the clipped objective with respect to the importance ratio, as the ratio travels."
              caption="The gradient does not shrink inside the clipped region — it is exactly zero. That is the mechanism: a step that is clipped is discarded, not shrunk."
            >
              <TrendChart
                data={gradientCurve}
                series={[{ key: 'gradient', name: 'the gradient', colour: 'var(--accent-amber)' }]}
                xLabel="the importance ratio"
                yLabel="the gradient"
                height={240}
              />
            </Figure>

            <Callout tone="definition" title="Why a zero gradient and not a small one">
              The objective is min(clipped, unclipped). Inside the clipped region the clipped branch is the smaller one,
              and it is a constant — so the derivative is exactly zero. The step contributes nothing, and the optimiser
              moves on. This is what makes the clip a bound rather than a soft penalty.
            </Callout>
          </>
        ) : null}

        {view === 'objective' ? (
          <>
            <Figure
              title="The two objectives, step by step"
              description="For each step of the trajectory, the importance ratio, the advantage, and the two objectives."
              caption="The per-step comparison. Where the two agree, the clip is not doing anything on that step."
            >
              <DataTable
                caption="The objective, step by step"
                headers={['Step', 'Ratio', 'Advantage', 'Unclipped', 'Clipped', 'Clip active?']}
                rows={evaluation.steps.map((step, index) => [
                  index,
                  fmt(step.ratio, 4),
                  fmt(step.advantage, 4),
                  fmt(step.unclipped, 4),
                  fmt(step.clipped, 4),
                  step.clipActive ? 'yes' : 'no',
                ])}
              />
            </Figure>

            <Callout tone="note" title="The trust-region objective, for comparison">
              Without the clip, the objective is simply the surrogate: the expected value {fmt(trustRegion.objective, 4)} on
              this trajectory. The clip is what keeps the policy inside the region where that surrogate is a valid
              estimate of anything.
            </Callout>
          </>
        ) : null}

        {view === 'normalisation' && normalisation ? (
          <>
            <div className="stat-row">
              <Stat
                label="Subtracting a fixed baseline"
                value={normalisation.current.populationCentredResidual.toExponential(1)}
                hint="the change to the analytic gradient"
                tone="good"
              />
              <Stat
                label="Centred by the batch’s own mean"
                value={fmt(normalisation.centred.shrinkage, 4)}
                hint={`the averaged estimator, as a fraction of the true gradient, at N = ${batchSize}`}
                tone="warn"
              />
              <Stat
                label="The law says"
                value={fmt(1 - 1 / batchSize, 4)}
                hint="one minus one over the batch size"
                tone="good"
              />
              <Stat
                label="The whitened estimator"
                value={fmt(normalisation.whitened.shrinkage, 4)}
                hint={`and an angle of ${fmt(normalisation.whitened.cosine, 5)} with the true gradient`}
              />
            </div>

            <Figure
              title="What the mean you subtract is worth"
              description="The length of the averaged estimator as a fraction of the analytic gradient's length, against the batch size, for the raw advantages, for advantages centred by their own batch mean, and for the closed-form prediction 1 − 1/N."
              caption={`A constant baseline changes the analytic gradient by ${normalisation.current.populationCentredResidual.toExponential(1)} — nothing — because the score function averages to zero. The mean of the batch is not a constant: it is computed from the same steps the gradient uses, and the term that survives is one over the batch size of the gradient, with a minus sign. So the estimator points the right way at ${fmt(
                normalisation.centred.shrinkage,
                4,
              )} of the right length where the analytic answer is one. At N = ${normalisation.sweep[0]!.size} the measured length is ${fmt(
                normalisation.pick(normalisation.sweep[0]!.study, 'centred').shrinkage,
                4,
              )} against a predicted ${fmt(1 - 1 / normalisation.sweep[0]!.size, 4)}; at N = ${
                normalisation.sweep[normalisation.sweep.length - 1]!.size
              } it is ${fmt(
                normalisation.pick(normalisation.sweep[normalisation.sweep.length - 1]!.study, 'centred').shrinkage,
                4,
              )} against ${fmt(1 - 1 / normalisation.sweep[normalisation.sweep.length - 1]!.size, 4)}. The raw column stays within a few per cent of one at every size, which is what an unbiased estimator looks like once you average it: this is not noise that averages out, it is a bias that shrinks as the batch grows, and the two columns agree because the law is exact and the measurement is a sample.`}
            >
              <TrendChart
                data={normalisation.sweep.map((row) => ({
                  x: row.size,
                  raw: normalisation.pick(row.study, 'raw').shrinkage,
                  centred: normalisation.pick(row.study, 'centred').shrinkage,
                  law: 1 - 1 / row.size,
                }))}
                series={[
                  { key: 'law', name: 'the prediction, 1 − 1/N', colour: 'var(--accent-amber)', dashed: true },
                  { key: 'centred', name: 'centred by the batch mean', colour: 'var(--accent-rose)' },
                  { key: 'raw', name: 'the raw advantages', colour: 'var(--accent-teal)' },
                ]}
                xLabel="steps per batch"
                yLabel="length, relative to the true gradient"
                height={280}
              />
            </Figure>

            <Figure
              title="Direction, size and steadiness"
              description="The same three treatments on the same batches: how long the averaged estimate is against the prediction, what angle it makes with the analytic gradient, and how much the length of a single batch's estimate varied."
              caption={`The treatments differ in what they get wrong. Centring leaves the angle intact — ${fmt(
                normalisation.centred.cosine,
                5,
              )} at N = ${batchSize} — and takes one over the batch size off the length: at N = ${
                normalisation.sweep[0]!.size
              } that is ${fmt(
                100 / normalisation.sweep[0]!.size,
                0,
              )} per cent of the update gone, and across the sweep the measured column tracks the predicted one to within ${fmt(
                Math.max(
                  ...normalisation.sweep.map(
                    (row) =>
                      Math.abs(normalisation.pick(row.study, 'centred').shrinkage - (1 - 1 / row.size)),
                  ),
                ),
                3,
              )}. Whitening is not a baseline at all: it divides by the standard deviation of the same batch, which rescales the gradient by a random positive factor, so the estimate lands on the same line as the true gradient — the angle stays close to one at ${fmt(
                normalisation.whitened.cosine,
                5,
              )} while the length moves to ${fmt(
                normalisation.whitened.shrinkage,
                4,
              )}. What the division buys is the last two columns: at this batch size the raw estimate's length varies by ${fmt(
                (normalisation.raw.normSpread / normalisation.raw.meanNorm) * 100,
                1,
              )} per cent batch to batch and the whitened one by ${fmt(
                (normalisation.whitened.normSpread / normalisation.whitened.meanNorm) * 100,
                1,
              )} per cent. That is the step size the optimiser actually takes, and pinning it is the reason the line is in every implementation.`}
            >
              <DataTable
                caption="The three treatments, at each batch size"
                headers={[
                  'steps per batch',
                  'the law, 1 − 1/N',
                  'length, raw',
                  'length, centred',
                  'length, whitened',
                  'angle, centred',
                  'length varies, raw',
                  'length varies, whitened',
                ]}
                rows={normalisation.sweep.map((row) => [
                  row.size,
                  fmt(1 - 1 / row.size, 4),
                  fmt(normalisation.pick(row.study, 'raw').shrinkage, 4),
                  fmt(normalisation.pick(row.study, 'centred').shrinkage, 4),
                  fmt(normalisation.pick(row.study, 'whitened').shrinkage, 4),
                  fmt(normalisation.pick(row.study, 'centred').cosine, 5),
                  `${fmt(
                    (normalisation.pick(row.study, 'raw').normSpread / normalisation.pick(row.study, 'raw').meanNorm) *
                      100,
                    1,
                  )}%`,
                  `${fmt(
                    (normalisation.pick(row.study, 'whitened').normSpread /
                      normalisation.pick(row.study, 'whitened').meanNorm) *
                      100,
                    1,
                  )}%`,
                ])}
              />
            </Figure>

            <Figure
              title="The reward scale is a step size you did not choose"
              description="Every reward multiplied by a factor, the critic with it, and the resulting length of one batch's gradient — normalised and not."
              caption={`Multiplying the reward by ten multiplies the update by ten: the raw estimate goes from ${fmt(normalisation.pick(normalisation.scales[0]!.study, 'raw').meanNorm, 5)} to ${fmt(normalisation.pick(normalisation.scales[normalisation.scales.length - 1]!.study, 'raw').meanNorm, 5)}. The whitened estimate does not move at all — ${fmt(normalisation.pick(normalisation.scales[0]!.study, 'whitened').meanNorm, 5)} to ${fmt(normalisation.pick(normalisation.scales[normalisation.scales.length - 1]!.study, 'whitened').meanNorm, 5)} — because the factor cancels between the advantage and its standard deviation. A reward model outputs whatever scale it likes, so without this the learning rate would be set by a property of the critic's output distribution rather than by anything you decided.`}
            >
              <DataTable
                caption="The length of one batch's estimate, at each reward scale"
                headers={['reward factor', 'raw length', 'whitened length', 'raw ÷ first', 'whitened ÷ first']}
                rows={normalisation.scales.map((row) => [
                  row.factor,
                  fmt(normalisation.pick(row.study, 'raw').meanNorm, 5),
                  fmt(normalisation.pick(row.study, 'whitened').meanNorm, 5),
                  fmt(
                    normalisation.pick(row.study, 'raw').meanNorm /
                      normalisation.pick(normalisation.scales[0]!.study, 'raw').meanNorm,
                    3,
                  ),
                  fmt(
                    normalisation.pick(row.study, 'whitened').meanNorm /
                      normalisation.pick(normalisation.scales[0]!.study, 'whitened').meanNorm,
                    4,
                  ),
                ])}
              />
            </Figure>

            <Callout tone="definition" title="Why a baseline is free and a measured mean is not">
              The score function averages to zero under the policy, so E[∇log π · c] = 0 for any constant c — that is
              the whole of the baseline argument, and the first statistic above is its numerical proof. Subtract the
              <em> sample</em> mean instead, the one computed from the same steps being averaged, and the two are no
              longer independent: the term Σ<sub>t</sub> ∇log π<sub>t</sub> · (1/N) Σ<sub>s</sub> A<sub>s</sub> has
              cross terms that still average to zero, and a diagonal one that does not, so what survives is −1/N of the
              gradient. The estimator keeps its direction and loses that factor, which is why the measured length lands
              on 1 − 1/N and not on one.
            </Callout>

            <Callout tone="warning" title="What this says about the standard recipe">
              Normalising advantages is sold as variance reduction. On this sample the subtraction is not a variance
              reducer at all — it is a bias of exactly one over the batch size, small enough at N = 256 to be
              invisible and large enough at N = 4 to remove a quarter of the update. The division is a different
              mechanism: it rescales the update by a random factor, which makes it indifferent to the units the reward
              happens to be reported in and pins its length from batch to batch. If a run reports an advantage
              normalisation and no clip, the thing keeping it stable is the division, not the subtraction.
            </Callout>
          </>
        ) : null}

        {view === 'steps' ? (
          <>
            <Figure
              title="What repeated steps do to the clip fraction"
              description="As the policy is pushed step after step, the clip fraction and the mean ratio."
              caption="The clip fraction rises as the policy leaves the region where the samples are valid. A clip fraction that climbs towards one means the updates are being thrown away."
            >
              <TrendChart
                data={stepSweep}
                series={[
                  { key: 'clipFraction', name: 'the clip fraction', colour: 'var(--accent-rose)' },
                  { key: 'ratio', name: 'the mean ratio', colour: 'var(--accent-teal)' },
                ]}
                xLabel="the step"
                yLabel="value"
                height={280}
              />
            </Figure>

            <Callout tone="warning" title="The diagnostic to watch">
              The clip fraction is the one number in a PPO run that says whether the trust region is doing its job. Near
              zero means the constraint is slack; close to one means the policy is being pulled further than the
              estimate can survive; somewhere in between is where you want it.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
