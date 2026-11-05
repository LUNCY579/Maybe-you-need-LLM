import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  chiSquare,
  compareEstimators,
  exactKl,
  klPenaltySweep,
  penalisedObjective,
  penalisedPolicy,
  penaltyRow,
  rewardMaximisingPolicy,
  reverseKl,
} from '../../core/kl'
import { applyStep, cloneBandit, createBandit, klToReference, rewardLandscape } from '../../core/policy'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'

type View = 'estimators' | 'distance' | 'penalty'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const KL_VIEWS: { value: View; label: string }[] = [
  { value: 'estimators', label: 'The estimators' },
  { value: 'distance', label: 'The distance' },
  { value: 'penalty', label: 'The penalty' },
]

export function KlLab() {
  const [view, setView] = useViewParam(KL_VIEWS)
  const [seed, setSeed] = useState(7)
  const [samples, setSamples] = useState(20000)
  const [separation, setSeparation] = useState(0.4)
  const [beta, setBeta] = useState(0.4)

  const reference = useMemo(() => createBandit(3, 5, 99), [])
  const policy = useMemo(() => {
    const base = createBandit(3, 5, 3)
    return applyStep(base, new Array<number>(base.logits.length).fill(separation), 1)
  }, [separation])

  const estimates = useMemo(
    () => compareEstimators(policy, reference, samples, seed),
    [policy, reference, samples, seed],
  )

  const exact = useMemo(() => exactKl(policy, reference), [policy, reference])
  const chi = useMemo(() => chiSquare(policy, reference), [policy, reference])
  const k3Target = chi - exact

  /** The three estimators as the policies separate. */
  const separationSweep = useMemo(() => {
    const rows: { x: number; k1: number; k2: number; k3: number; exact: number }[] = []
    for (let s = 0; s <= 1.2; s += 0.1) {
      const moved = applyStep(reference, new Array<number>(reference.logits.length).fill(s), 1)
      const values = compareEstimators(moved, reference, 6000, seed)
      rows.push({
        x: s,
        k1: values.find((v) => v.estimator === 'k1')!.mean,
        k2: values.find((v) => v.estimator === 'k2')!.mean,
        k3: values.find((v) => v.estimator === 'k3')!.mean,
        exact: exactKl(moved, reference),
      })
    }
    return rows
  }, [reference, seed])

  /** The KL against the step size, for a penalty and a constraint. */
  const distanceSweep = useMemo(() => {
    const rows: { x: number; kl: number; reverse: number; chi: number }[] = []
    for (let s = 0; s <= 1.5; s += 0.1) {
      const moved = applyStep(reference, new Array<number>(reference.logits.length).fill(s), 1)
      rows.push({
        x: s,
        kl: klToReference(moved, reference).mean,
        reverse: reverseKl(moved, reference),
        chi: chiSquare(moved, reference),
      })
    }
    return rows
  }, [reference])

  /* The penalty: the same reference, a reward landscape, and the policy that
     maximises reward minus β times the distance from the reference. */
  const rewards = useMemo(() => rewardLandscape(reference.contexts, reference.actions), [reference])
  const optimum = useMemo(() => penalisedPolicy(reference, rewards, beta), [reference, rewards, beta])
  const row = useMemo(() => penaltyRow(reference, rewards, beta), [reference, rewards, beta])
  const sweep = useMemo(() => klPenaltySweep(reference, rewards), [reference, rewards])
  const greedy = useMemo(() => rewardMaximisingPolicy(reference, rewards), [reference, rewards])

  /** The best any single-logit move can still find, which has to be no gain at all. */
  const bestPerturbationGain = useMemo(() => {
    const here = penalisedObjective(optimum, reference, rewards, beta).objective
    let gain = 0
    for (let index = 0; index < optimum.logits.length; index++) {
      for (const delta of [-0.05, 0.05]) {
        const moved = cloneBandit(optimum)
        moved.logits[index]! += delta
        gain = Math.max(gain, penalisedObjective(moved, reference, rewards, beta).objective - here)
      }
    }
    return gain
  }, [optimum, reference, rewards, beta])

  return (
    <div className="lab">
      <Panel
        title="Laboratory D · The KL penalty"
        subtitle="Three estimators, what each is unbiased for, and the policy a penalty actually chooses"
        accent="emerald"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={KL_VIEWS}
          />
          {view === 'penalty' ? (
            <Slider
              label="The KL coefficient β"
              value={beta}
              min={0.05}
              max={3}
              step={0.05}
              onChange={setBeta}
              format={(value) => value.toFixed(2)}
              hint="The price of one nat of distance. The policy below is the one that maximises reward minus β times the KL."
            />
          ) : (
            <>
              <Slider
                label="How far the policy has moved"
                value={separation}
                min={0}
                max={1.2}
                step={0.05}
                onChange={setSeparation}
                format={(value) => value.toFixed(2)}
              />
              <Slider
                label="Samples"
                value={samples}
                min={1000}
                max={60000}
                step={1000}
                onChange={setSamples}
                hint="How many actions the estimate is computed from."
              />
            </>
          )}
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        {view !== 'penalty' ? (
        <div className="stat-row">
          <Stat label="The exact KL" value={fmt(exact, 5)} hint="computed, not estimated" />
          <Stat label="The chi-square divergence" value={fmt(chi, 5)} hint="what the third estimator targets" />
          <Stat
            label="χ² − KL"
            value={fmt(k3Target, 5)}
            hint="the expectation of the third estimator"
          />
          <Stat label="The reverse KL" value={fmt(reverseKl(policy, reference), 5)} hint="the other direction" />
        </div>
        ) : null}

        {view === 'estimators' ? (
          <>
            <Figure
              title="The three estimators, measured"
              description="Each estimator's mean, its variance, and the quantity it is actually unbiased for, computed from samples of the current policy."
              caption="The first estimator is unbiased for the KL but takes negative values. The second is positive but biased upwards. The third is positive, and its expectation is the chi-square divergence minus the KL — which is a detail most write-ups of this estimator leave out."
            >
              <DataTable
                caption="The estimators"
                headers={['Estimator', 'Mean', 'Variance', 'Negative fraction', 'What it is unbiased for']}
                rows={estimates.map((estimate) => [
                  estimate.estimator,
                  fmt(estimate.mean, 5),
                  fmt(estimate.variance, 6),
                  `${fmt(estimate.negativeFraction * 100, 1)}%`,
                  estimate.estimator === 'k1'
                    ? 'the KL'
                    : estimate.estimator === 'k2'
                      ? 'nothing simple — it is the second moment'
                      : 'χ² − KL',
                ])}
              />
            </Figure>

            <Figure
              title="The estimators as the policies separate"
              description="Each estimator's mean, against the exact KL, as the policy is moved further from the reference."
              caption="The three estimators diverge from one another as the separation grows. The first tracks the KL; the third tracks χ² − KL, which is a different curve; the second is the most conservative of all."
            >
              <TrendChart
                data={separationSweep}
                series={[
                  { key: 'exact', name: 'the exact KL', colour: 'var(--accent-emerald)', dashed: true },
                  { key: 'k1', name: 'k1, the log ratio', colour: 'var(--accent-teal)' },
                  { key: 'k3', name: 'k3, r − 1 − log r', colour: 'var(--accent-indigo)' },
                  { key: 'k2', name: 'k2, the squared log ratio', colour: 'var(--accent-rose)' },
                ]}
                xLabel="how far the policy has moved"
                yLabel="the estimate"
                height={300}
              />
            </Figure>

            <Callout tone="definition" title="Which one should you use?">
              If the KL is a <em>penalty</em> in the objective, use the third: a penalty that can be negative will be, and
              a penalty that is biased upwards is a penalty that is too strong. If the KL is a number you are going to
              <em>report</em>, use the first, because it is the only one of the three that is unbiased for the KL
              itself — and say which one you used.
            </Callout>
          </>
        ) : null}

        {view === 'distance' ? (
          <>
            <Figure
              title="Three divergences, three shapes"
              description="The forward KL, the reverse KL and the chi-square divergence between the policy and the reference, as the policy moves."
              caption="The three divergences are not interchangeable. The forward KL punishes the policy for putting mass where the reference has none; the reverse KL punishes it for missing mass where the reference has some. Which one you use changes what the penalty discourages."
            >
              <TrendChart
                data={distanceSweep}
                series={[
                  { key: 'kl', name: 'the forward KL', colour: 'var(--accent-emerald)' },
                  { key: 'reverse', name: 'the reverse KL', colour: 'var(--accent-indigo)' },
                  { key: 'chi', name: 'the chi-square divergence', colour: 'var(--accent-rose)' },
                ]}
                xLabel="how far the policy has moved"
                yLabel="the divergence"
                height={300}
              />
            </Figure>

            <Callout tone="note" title="Why the direction matters for a penalty">
              The forward KL grows when the policy puts probability somewhere the reference had none — which is what
              stops the policy from inventing a response the reference would never produce. The reverse KL grows when the
              policy drops something the reference liked. For a <em>penalty</em> on a language model, the forward
              direction is the one that is usually meant.
            </Callout>
          </>
        ) : null}

        {view === 'penalty' ? (
          <>
            <div className="stat-row">
              <Stat label="The reward of the optimum" value={fmt(row.reward, 5)} hint="what the penalised policy earns, before the penalty" />
              <Stat label="Its KL from the reference" value={fmt(row.kl, 5)} hint="the distance β is paying for" />
              <Stat
                label="The objective"
                value={fmt(row.objective, 5)}
                hint={`reward − ${fmt(beta, 2)} × KL`}
                tone="good"
              />
              <Stat
                label="The best a logit move can still find"
                value={bestPerturbationGain.toExponential(2)}
                hint="a gain of zero says the closed form is the maximum"
                tone={bestPerturbationGain <= 0 ? 'good' : 'warn'}
              />
            </div>

            <Figure
              title="What the penalty buys"
              description="The reward of the penalised optimum and its distance from the reference, as β moves."
              caption={`Two curves of one family. Raising β lowers both: the policy moves a smaller distance and earns less. The identity the closed form has to satisfy — KL = reward / β − log Z — leaves a residual of ${row.identityResidual.toExponential(1)} at β = ${fmt(beta, 2)}, which is arithmetic, not approximation.`}
            >
              <TrendChart
                data={sweep.map((entry) => ({ x: entry.beta, reward: entry.reward, kl: entry.kl }))}
                series={[
                  { key: 'reward', name: 'the reward of the optimum', colour: 'var(--accent-emerald)' },
                  { key: 'kl', name: 'its KL from the reference', colour: 'var(--accent-rose)' },
                ]}
                xLabel="β"
                yLabel="value"
                height={300}
              />
            </Figure>

            <Figure
              title="The β sweep, with both costs"
              description="Each β, the policy it chooses, and what that policy gives up in reward and saves in distance relative to taking the best action everywhere."
              caption={`The last two columns are measured against the reward-maximising policy, whose own distance is ${fmt(greedy.kl, 3)} nats. A penalty does not shrink a step towards that policy; it chooses a different one, and the table is the list of the ones it chooses.`}
            >
              <DataTable
                caption="The penalised optimum at each β"
                headers={[
                  'β',
                  'The reward',
                  'The KL',
                  'The objective',
                  'Reward given up',
                  'Distance saved',
                  'The identity residual',
                ]}
                rows={sweep.map((entry) => [
                  fmt(entry.beta, 2),
                  fmt(entry.reward, 5),
                  fmt(entry.kl, 5),
                  fmt(entry.objective, 5),
                  fmt(entry.rewardCost, 5),
                  fmt(entry.klSaved, 5),
                  entry.identityResidual.toExponential(1),
                ])}
              />
            </Figure>

            <Callout tone="definition" title="The reference is part of the answer">
              The maximiser of E[r] − β·KL(π ‖ π_ref) is π*(a) ∝ π_ref(a)·exp(r(a)/β), so the reference sits inside the
              formula rather than beside it: change the reference and every row of the table above changes, even though
              the reward landscape and β have not moved. That is why the first stage of the pipeline is not a
              starting point you can be careless about.
            </Callout>

            <Callout tone="warning" title="What β is for">
              Here the unpenalised optimum — the policy that takes the best action in every context — earns{' '}
              {fmt(greedy.reward, 4)} at a distance of {fmt(greedy.kl, 3)} nats. At β = {fmt(beta, 2)} the penalised
              optimum earns {fmt(row.reward, 4)} at {fmt(row.kl, 3)} nats, so the penalty is buying
              {' '}{fmt(greedy.kl - row.kl, 3)} nats for {fmt(greedy.reward - row.reward, 4)} of reward. A run that
              reports a reward without the distance it cost is a run that cannot be placed on this trade-off, and the
              two numbers above are the only pair that says where it sits.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
