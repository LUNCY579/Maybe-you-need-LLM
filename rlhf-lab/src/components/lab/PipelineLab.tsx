import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { createBandit, meanReward } from '../../core/policy'
import {
  buildTask,
  demonstratorPolicy,
  runSft,
  sampleDemonstrations,
} from '../../core/sft'
import { errorProfile, fitRewardModel, samplePreferences } from '../../core/rewardModel'
import { meanNominalQuality, runPpoStage, TURNOVER_FLOOR, weakModelStudy } from '../../core/ppoStage'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'

type View = 'stages' | 'run' | 'weak' | 'checklist'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const PIPELINE_VIEWS: { value: View; label: string }[] = [
  { value: 'stages', label: 'The stages' },
  { value: 'run', label: 'Run it' },
  { value: 'weak', label: 'Weak reward models' },
  { value: 'checklist', label: 'The checklist' },
]

/** The ranges of responses a preference dataset can cover. */
const BANDS: { value: string; label: string; band: [number, number] }[] = [
  { value: 'all', label: 'All of them', band: [-1, 1] },
  { value: 'bottom', label: 'The bottom half', band: [-1, -0.4] },
  { value: 'low', label: 'The low middle', band: [-0.8, 0] },
  { value: 'top', label: 'The top half', band: [0.4, 1] },
]

/** The four reward models the weak-model view fits against one shared reference policy. */
const VARIANTS = [
  { label: 'Every response, noisy labels', band: [-1, 1] as [number, number], pairs: 400, labelNoise: 0.1, rmSteps: 600 },
  { label: 'The low middle only', band: [-0.8, 0] as [number, number], pairs: 400, labelNoise: 0.1, rmSteps: 600 },
  { label: 'The top half, noisy labels', band: [0.4, 1] as [number, number], pairs: 400, labelNoise: 0.1, rmSteps: 600 },
  { label: 'The top half, clean labels', band: [0.4, 1] as [number, number], pairs: 400, labelNoise: 0, rmSteps: 600 },
]

/** The stage-three settings the weak-model study runs at, so its rows are comparable. */
const STUDY_STAGE = { steps: 600, batch: 64, learningRate: 1, beta: 0.05, seed: 41, reportEvery: 10 }

/** The three stages, and the failure mode of each. */
const STAGES = [
  {
    id: 'sft',
    name: 'Supervised fine-tuning',
    produces: 'The reference policy',
    failure: 'The demonstrations are inconsistent, and the model learns the inconsistency.',
    why: 'This is the anchor. Everything the third stage does is measured against this policy, so its quality sets the ceiling on how far the policy can usefully travel.',
  },
  {
    id: 'reward',
    name: 'Reward modelling',
    produces: 'A scalar score for a response',
    failure: 'The model ranks the pairs it was trained on well and extrapolates badly. The error is invisible in the ranking accuracy.',
    why: 'The reward model is a proxy, and its error is what makes overoptimisation possible. The scale of that error — not the quality of the ranking — decides how far the policy can be pushed.',
  },
  {
    id: 'policy',
    name: 'Policy optimisation',
    produces: 'The aligned policy',
    failure: 'The policy finds the high spots in the reward model’s error and rewards itself for it.',
    why: 'This is the stage where the proxy and the truth come apart. Everything the course’s last two modules are about is what to do about it.',
  },
]

/** The details, and the failure each one guards against. */
const CHECKLIST = [
  { detail: 'The learning rate and its schedule', guards: 'A run that silently diverges part-way through and is reported as a plateau.' },
  { detail: 'The number of epochs on the reward model', guards: 'A reward model that has memorised its training set and is confidently wrong elsewhere.' },
  { detail: 'The scale of the reward model’s error', guards: 'Overoptimisation: the policy is pushed past the point where the proxy is informative.' },
  { detail: 'The KL coefficient', guards: 'The distance the policy is allowed to travel from the reference.' },
  { detail: 'The KL estimator', guards: 'A penalty that can go negative, and a reported number that is not the KL.' },
  { detail: 'Advantage normalisation', guards: 'A learning rate whose meaning changes with the reward scale.' },
  { detail: 'Return whitening', guards: 'A critic that is poorly conditioned, and a learning rate that does not transfer.' },
  { detail: 'The clip range and the number of PPO epochs', guards: 'A policy that is thrown away every update, or one that is never held back.' },
  { detail: 'The value function’s loss scale', guards: 'The critic dominating the gradient, or being ignored.' },
  { detail: 'Whether the reward is normalised', guards: 'A pipeline that only works at one reward scale.' },
  { detail: 'The seed, the decoder and the chat template', guards: 'A reported number that nobody can reproduce.' },
  { detail: 'The length penalty on the reward', guards: 'A policy that has learned to be verbose because verbose is rewarded.' },
]

/** Every k-th point of a run, so the numbers behind a chart fit in a table. */
function sampled<T>(points: T[], count: number): T[] {
  if (points.length <= count) return points
  const step = (points.length - 1) / (count - 1)
  return Array.from({ length: count }, (_, index) => points[Math.round(index * step)]!)
}

/** Whether the preference band already covers every response the task offers. */
function coversRange(band: [number, number]): boolean {
  return band[0] <= -1 + 1e-9 && band[1] >= 1 - 1e-9
}

export function PipelineLab() {
  const [view, setView] = useViewParam(PIPELINE_VIEWS)
  const [band, setBand] = useState('top')
  const [labelNoise, setLabelNoise] = useState(0.1)
  const [rmSteps, setRmSteps] = useState(600)
  const [inconsistency, setInconsistency] = useState(0)
  const [beta, setBeta] = useState(0.1)
  const [steps, setSteps] = useState(600)

  /** A demonstration of the three stages as a movement of the policy. */
  const demonstration = useMemo(() => {
    const reference = createBandit(3, 4, 5)
    const rewards = [
      [0.2, 0.8, 0.4, 0.1],
      [0.9, 0.3, 0.5, 0.2],
      [0.4, 0.6, 0.1, 0.7],
    ]
    // A proxy reward that is the truth plus a fixed error.
    const proxy = rewards.map((row) => row.map((value, index) => value + (index === 2 ? 0.35 : -0.1)))
    const best = (row: number[]) => row.reduce((top, value, index) => (value > row[top]! ? index : top), 0)
    const disagreement = rewards.filter((row, context) => best(row) !== best(proxy[context]!)).length
    return {
      before: meanReward(reference, rewards),
      proxyBefore: meanReward(reference, proxy),
      disagreement,
    }
  }, [])

  return (
    <div className="lab">
      <Panel
        title="Laboratory E · The pipeline"
        subtitle="Three stages, three failure modes, and the checklist that guards them"
        accent="rose"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={PIPELINE_VIEWS}
          />
        </div>

        {view === 'run' ? (
          <div className="lab-controls">
            <SegmentedControl
              label="The preference data covers"
              value={band}
              onChange={setBand}
              options={BANDS.map((option) => ({ value: option.value, label: option.label }))}
            />
            <Slider
              label="Flipped labels"
              value={labelNoise}
              min={0}
              max={0.3}
              step={0.05}
              onChange={setLabelNoise}
              format={(value) => value.toFixed(2)}
              hint="The share of pairs whose preference is reversed."
            />
            <Slider
              label="Epochs on the reward model"
              value={rmSteps}
              min={20}
              max={1500}
              step={20}
              onChange={setRmSteps}
              hint="There is no regulariser but this. The fit keeps extrapolating as it keeps improving."
            />
            <Slider
              label="Inconsistent demonstrations"
              value={inconsistency}
              min={0}
              max={0.5}
              step={0.05}
              onChange={setInconsistency}
              format={(value) => value.toFixed(2)}
              hint="The share drawn from a coin flip rather than the demonstrator."
            />
            <Slider
              label="The KL coefficient"
              value={beta}
              min={0.002}
              max={0.3}
              step={0.002}
              onChange={setBeta}
              format={(value) => value.toFixed(3)}
              hint="Reward units given up per nat travelled from the reference."
            />
            <Slider
              label="How long to run"
              value={steps}
              min={100}
              max={1200}
              step={50}
              onChange={setSteps}
              hint="Each step collects a batch of 96 responses and takes four clipped passes on it."
            />
          </div>
        ) : null}

        {view === 'stages' ? (
          <StagesView demonstration={demonstration} />
        ) : view === 'run' ? (
          <RunView
            band={BANDS.find((option) => option.value === band)?.band ?? [-1, 1]}
            labelNoise={labelNoise}
            rmSteps={rmSteps}
            inconsistency={inconsistency}
            beta={beta}
            steps={steps}
          />
        ) : view === 'weak' ? (
          <WeakView />
        ) : (
          <ChecklistView />
        )}
      </Panel>
    </div>
  )
}

function StagesView({
  demonstration,
}: {
  demonstration: { before: number; proxyBefore: number; disagreement: number }
}) {
  return (
    <>
      <div className="stat-row">
        <Stat label="Stages" value={String(STAGES.length)} />
        <Stat
          label="The true reward of the reference"
          value={fmt(demonstration.before, 4)}
          hint="per prompt, for the policy the supervised stage produced"
        />
        <Stat
          label="The proxy reward of the reference"
          value={fmt(demonstration.proxyBefore, 4)}
          hint="what the reward model thinks the same policy is worth, per prompt"
        />
        <Stat
          label="The gap"
          value={fmt(Math.abs(demonstration.proxyBefore - demonstration.before), 4)}
          hint={`the reward model’s error at one point; on ${demonstration.disagreement} of the prompts it prefers a different response`}
          tone={demonstration.disagreement > 0 ? 'warn' : 'good'}
        />
      </div>

      <Figure
        title="The three stages"
        description="What each stage of the pipeline produces, how it can fail, and why it matters."
        caption="The pipeline, and the failure mode of each stage. The third stage is the dangerous one, and it is the only one that is dangerous because of what the second stage did."
      >
        <DataTable
          caption="The RLHF pipeline"
          headers={['Stage', 'What it produces', 'How it fails', 'Why it matters']}
          rows={STAGES.map((stage) => [stage.name, stage.produces, stage.failure, stage.why])}
        />
      </Figure>

      <Callout tone="definition" title="Why the reference policy comes first">
        The KL penalty is measured against the reference, so the reference decides both the direction and the size of
        the movement the third stage is allowed. A better reference does not just give a better starting point — it
        changes what the penalty is penalising.
      </Callout>

      <Callout tone="note" title="The gap, measured">
        The two numbers above are the true reward of the reference policy and the reward model’s score for the same
        policy, each averaged over the prompts of a small task the table was written by hand for. The difference is the
        reward model’s error evaluated at one point, and it is small here because the reference policy has not moved
        yet. It is on the next view that the movement happens, and the run there is built from a task the core
        generates rather than from these numbers.
      </Callout>
    </>
  )
}

function RunView({
  band,
  labelNoise,
  rmSteps,
  inconsistency,
  beta,
  steps,
}: {
  band: [number, number]
  labelNoise: number
  rmSteps: number
  inconsistency: number
  beta: number
  steps: number
}) {
  // Stage one, on its own memo: moving the reward model’s dials does not refit it.
  const stageOne = useMemo(() => {
    const task = buildTask({})
    const teacher = demonstratorPolicy(task, 0.25)
    const demonstrations = sampleDemonstrations(task, teacher, 600, 21, inconsistency)
    const sft = runSft(task, demonstrations, { steps: 600, learningRate: 0.5, teacher })
    return { task, teacher, demonstrations, sft }
  }, [inconsistency])

  const stageTwo = useMemo(() => {
    const pairs = samplePreferences(stageOne.task, { count: 400, seed: 31, band, labelNoise })
    return {
      pairs,
      fit: fitRewardModel(stageOne.task, pairs, { steps: rmSteps, band, labelNoise, seed: 31 }),
    }
  }, [stageOne, band, labelNoise, rmSteps])

  const stageThree = useMemo(
    () => runPpoStage(stageOne.task, stageTwo.fit.model, stageOne.sft.policy, { beta, steps, batch: 96, learningRate: 0.5, seed: 41, reportEvery: 10 }),
    [stageOne, stageTwo, beta, steps],
  )

  const { task, sft } = stageOne
  const { fit } = stageTwo
  const fitPoint = fit.history[fit.history.length - 1]!
  const profile = useMemo(() => errorProfile(task, fit.model, 21), [task, fit.model])
  const bandLabel = BANDS.find((option) => option.band[0] === band[0] && option.band[1] === band[1])?.label ?? 'the chosen range'
  const inside = profile.filter((row) => row.insideBand)
  const outside = profile.filter((row) => !row.insideBand)
  const errorInside = inside.length === 0 ? 0 : Math.max(...inside.map((row) => Math.abs(row.error)))
  const errorOutside = outside.length === 0 ? 0 : Math.max(...outside.map((row) => Math.abs(row.error)))
  const coversEverything = coversRange(band)
  const proxyDips = stageThree.history.filter((point, index) => index > 0 && point.proxy < stageThree.history[index - 1]!.proxy - 1e-9).length
  const maxClip = Math.max(...stageThree.history.map((point) => point.clipFraction))
  const ratioLow = Math.min(...stageThree.history.map((point) => point.meanRatio))
  const ratioHigh = Math.max(...stageThree.history.map((point) => point.meanRatio))
  const fellBelowReference = stageThree.goldAtEnd < stageThree.goldAtReference
  const overshoot = Math.abs(stageThree.meanQuality - task.peak) > Math.abs(stageThree.meanQualityAtReference - task.peak)

  return (
    <>
      <div className="stat-row">
        <Stat
          label="Stage one: the loss"
          value={fmt(sft.finalLoss, 4)}
          hint={`the exact answer for these demonstrations is ${fmt(sft.exactLoss, 4)}`}
          tone={sft.finalLoss - sft.exactLoss < 0.05 ? 'good' : 'warn'}
        />
        <Stat
          label="Stage two: pairs it was shown"
          value={fmt(fit.finalAccuracy, 3)}
          hint={`on ${fit.trainPairs.length} pairs from ${bandLabel.toLowerCase()}`}
        />
        <Stat
          label="…and pairs it was not"
          value={fmt(fit.finalOutsideAccuracy, 3)}
          hint={`on ${fit.outsideCount} held out of the band`}
          tone={fit.finalOutsideAccuracy < 0.6 ? 'warn' : 'good'}
        />
        <Stat
          label="The model’s error, reward units"
          value={fmt(coversEverything ? errorInside : errorOutside, 3)}
          hint={
            coversEverything
              ? 'the band covers the range, so this is the error inside it'
              : `outside the band; ${fmt(errorInside, 3)} inside it`
          }
          tone={errorOutside > 0.2 ? 'warn' : 'good'}
        />
        <Stat
          label="Stage three: the proxy at the end"
          value={fmt(stageThree.proxyAtEnd, 4)}
          hint={`it started at ${fmt(stageThree.proxyAtReference, 4)}`}
        />
        <Stat
          label="The gold reward at the end"
          value={fmt(stageThree.goldAtEnd, 4)}
          hint={`it started at ${fmt(stageThree.goldAtReference, 4)}`}
          tone={fellBelowReference ? 'warn' : 'good'}
        />
        <Stat
          label="Given away after the peak"
          value={fmt(stageThree.dropFromBest, 4)}
          hint={`the gold reward peaked at step ${stageThree.bestGoldStep} of ${steps}`}
          tone={stageThree.dropFromBest > 0.01 ? 'warn' : 'good'}
        />
      </div>

      <Figure
        title="The run"
        description="The proxy reward the optimisation is given, and the gold reward it is not, against the step."
        caption={`The proxy ends at ${fmt(stageThree.proxyAtEnd, 3)} against ${fmt(stageThree.proxyAtReference, 3)} where it started${
          proxyDips === 0 ? ', and it rises at every reported step' : `, with ${proxyDips} reported step${proxyDips === 1 ? '' : 's'} where it fell`
        }. The gold reward ${
          stageThree.dropFromBest > 1e-6
            ? `peaks at ${fmt(stageThree.bestGold, 4)} on step ${stageThree.bestGoldStep} and ends at ${fmt(stageThree.goldAtEnd, 4)}, which is ${
                fellBelowReference ? 'below' : 'above'
              } the ${fmt(stageThree.goldAtReference, 4)} the reference policy started with`
            : `improves the whole way to ${fmt(stageThree.goldAtEnd, 4)}, against ${fmt(stageThree.goldAtReference, 4)} at the start`
        }. The KL distance travelled is ${fmt(stageThree.klAtEnd, 2)} nats.`}
        data={{
          headers: ['The step', 'The proxy reward', 'The gold reward', 'The KL from the reference'],
          rows: sampled(stageThree.history, 21).map((point) => [
            String(point.step),
            fmt(point.proxy, 4),
            fmt(point.gold, 4),
            fmt(point.kl, 4),
          ]),
        }}
      >
        <TrendChart
          data={stageThree.history.map((point) => ({ x: point.step, proxy: point.proxy, gold: point.gold }))}
          series={[
            { key: 'proxy', name: 'the proxy reward', colour: 'var(--accent-violet)' },
            { key: 'gold', name: 'the gold reward', colour: 'var(--accent-rose)' },
          ]}
          xLabel="the PPO step"
          yLabel="the reward per prompt"
          referenceLines={[{ y: stageThree.goldAtReference, label: 'where the reference policy started' }]}
          height={300}
        />
      </Figure>

      <Figure
        title="Stage two: what the reward model says, and what the feature can deliver"
        description="The fitted score read on the gold reward’s scale, against the best gold reward any model of that feature can express. The two are put on one scale by the affine map that matches them over the range the pairs cover, because a preference fit fixes an ordering and never a worth."
        caption={`The pairs cover ${band[0]} to ${band[1]}, and the model’s own optimum sits at x = ${fmt(
          fitPoint.optimum,
          2,
        )} where the gold reward wants ${fmt(task.peak, 2)}. Read on that scale, the model’s largest error inside the range it was shown is ${fmt(
          errorInside,
          3,
        )} reward units${
          coversEverything
            ? ' — the band is the whole range, so there is no extrapolation here to measure.'
            : ` and ${fmt(errorOutside, 3)} outside it: the pairs pin the ordering down where they reach, and nothing pins it down where they do not.`
        } The error is what stage three then optimises against.`}
        data={{
          headers: [
            'The response’s quality',
            'What the model scores it',
            'The same score, in reward units',
            'What the feature can deliver',
            'The error',
            'Inside the data?',
          ],
          rows: profile.map((row) => [
            fmt(row.x, 2),
            fmt(row.score, 4),
            fmt(row.aligned, 4),
            fmt(row.achievable, 4),
            fmt(row.error, 4),
            row.insideBand ? 'yes' : 'no',
          ]),
        }}
      >
        <TrendChart
          data={profile.map((row) => ({ x: row.x, model: row.aligned, achievable: row.achievable }))}
          series={[
            { key: 'model', name: 'the reward model, in reward units', colour: 'var(--accent-violet)' },
            { key: 'achievable', name: 'the best the feature allows', colour: 'var(--accent-teal)', dashed: true },
          ]}
          xLabel="the response’s nominal quality"
          yLabel="the reward"
          referenceLines={[{ x: band[0], label: 'the data starts' }, { x: band[1], label: 'the data ends' }]}
          height={280}
        />
      </Figure>

      <Figure
        title="Stage one: the fit, and the answer it is approaching"
        description="The negative log-likelihood of the demonstrations against the step, with the exact maximum-likelihood value drawn in."
        caption={`${stageOne.demonstrations.length} demonstrations, ${inconsistency > 0 ? `${Math.round(inconsistency * 100)}% of them drawn from a coin flip` : 'all of them from the demonstrator'}. The loss floor is the demonstrations’ own entropy, ${fmt(
          sft.exactLoss,
          4,
        )}; the run reaches ${fmt(sft.finalLoss, 4)} and the largest single probability is still ${fmt(sft.maxGapToEmpirical, 4)} away from the empirical one. The policy’s gold reward is ${fmt(
          sft.finalGold,
          4,
        )} against the demonstrator’s ${fmt(sft.teacherGold ?? Number.NaN, 4)}.`}
        data={{
          headers: ['The step', 'The loss', 'Greedy accuracy', 'The gold reward', 'KL to the demonstrator'],
          rows: sampled(sft.history, 21).map((point) => [
            String(point.step),
            fmt(point.loss, 4),
            fmt(point.accuracy, 3),
            fmt(point.gold, 4),
            fmt(point.klToTeacher ?? Number.NaN, 4),
          ]),
        }}
      >
        <TrendChart
          data={sft.history.map((point) => ({ x: point.step, loss: point.loss, floor: sft.exactLoss }))}
          series={[
            { key: 'loss', name: 'the loss', colour: 'var(--accent-rose)' },
            { key: 'floor', name: 'the exact answer', colour: 'var(--accent-teal)', dashed: true },
          ]}
          xLabel="the supervised step"
          yLabel="the mean negative log-likelihood"
          height={260}
        />
      </Figure>

      <Figure
        title="Stage three, step by step"
        description="What the collector saw at each reported step: the two rewards, the distance, the clip and the critic."
        caption={`The clip column is the share of the batch the clip was holding back at the end of the update, and the ratio column is the mean importance ratio. Across these ${steps} steps the largest share the clip reaches is ${fmt(
          maxClip,
          3,
        )} and the mean ratio stays between ${fmt(ratioLow, 3)} and ${fmt(ratioHigh, 3)}: at this step size each update moves the policy a little, so almost nothing is outside the clip range and the brake on this run is the KL penalty, not the clip. Laboratory B is where the clip itself is the object of study, with the step size as a dial.`}
        data={{
          headers: ['The step', 'The proxy', 'The gold', 'The KL', 'Clip active', 'The mean ratio', 'The critic’s loss'],
          rows: sampled(stageThree.history, 21).map((point) => [
            String(point.step),
            fmt(point.proxy, 4),
            fmt(point.gold, 4),
            fmt(point.kl, 4),
            fmt(point.clipFraction, 3),
            fmt(point.meanRatio, 4),
            fmt(point.criticLoss, 4),
          ]),
        }}
      >
        <DataTable
          caption="The stage-three trace"
          headers={['The step', 'The proxy', 'The gold', 'The KL', 'Clip active', 'The mean ratio', 'The critic’s loss']}
          rows={sampled(stageThree.history, 21).map((point) => [
            String(point.step),
            fmt(point.proxy, 4),
            fmt(point.gold, 4),
            fmt(point.kl, 4),
            fmt(point.clipFraction, 3),
            fmt(point.meanRatio, 4),
            fmt(point.criticLoss, 4),
          ])}
        />
      </Figure>

      <Callout tone="definition" title="What each stage is given, and what no stage sees">
        Stage one is given demonstrations of a demonstrator’s choices. Stage two is given pairs of responses and which
        one was preferred. Stage three is given the second stage’s scores and the first stage’s policy. The gold reward
        is on this screen and in no objective: it is what the run is measured with, which is the definition of a gold
        reward model.
      </Callout>

      <Callout tone="note" title="The three numbers that say which stage failed">
        Stage one: the loss against its exact floor, which the screen draws as a dashed line — a supervised run that has
        not converged is visible as a gap, not a feeling. Stage two: {fmt(fit.finalAccuracy, 3)} on the pairs it was
        shown and {fmt(fit.finalOutsideAccuracy, 3)} on the pairs held out of the range, and the error in reward units,{' '}
        {fmt(errorInside, 3)} inside the range the pairs cover and {fmt(errorOutside, 3)} outside it. When the range is
        the whole response space the two accuracies differ only by which pairs are hard; when it is part of it, that
        second pair of numbers is the extrapolation, and the ranking accuracy does not see it. Stage three: the gold
        reward at the end against the gold reward at the start, and the distance between its peak and its finish —{' '}
        {fmt(stageThree.dropFromBest, 4)} here.
      </Callout>

      <Callout tone="warning" title="What this task is, and what it is not">
        Six prompts, twelve candidate responses each, a gold reward that is a quadratic of the response’s quality, and a
        reward model fitted on two features of it. It is constructed, and constructed small, so that every probability,
        every gradient and every reward on this screen is computed exactly rather than sampled from a network. The
        phenomenon is not small: it is the same turnover Laboratory F measures with an exponential tilt, produced here
        by a pipeline of three fitted stages rather than by a construction. What the toy cannot show is the part of
        real reward-model error that has no low-dimensional shape at all.
      </Callout>

      {overshoot ? (
        <Callout tone="warning" title="The quality the policy answers with">
          The mean nominal quality of the responses this policy produces is {fmt(stageThree.meanQuality, 3)}, against{' '}
          {fmt(stageThree.meanQualityAtReference, 3)} at the reference, on a task whose gold reward wants{' '}
          {fmt(task.peak, 2)}. It has moved away from the peak, and it did so where the model’s score was still rising —
          in the region the pairs never reached, where that score is worth {fmt(errorOutside, 3)} reward units of error.
          That is reward hacking in the only form a laboratory can measure it: the objective went up, the thing the
          objective stands for went down.
        </Callout>
      ) : null}
    </>
  )
}

function WeakView() {
  const shared = useMemo(() => {
    const task = buildTask({})
    const teacher = demonstratorPolicy(task, 0.25)
    const sft = runSft(task, sampleDemonstrations(task, teacher, 600, 21, 0), { steps: 600, learningRate: 0.5, teacher })
    return { task, teacher, sft }
  }, [])

  const rows = useMemo(() => weakModelStudy(shared.task, shared.sft.policy, VARIANTS, STUDY_STAGE), [shared])

  const hacked = rows.filter((row) => row.turnsOver)
  const refQuality = meanNominalQuality(shared.task, shared.sft.policy)
  const distance = (meanQuality: number) => Math.abs(meanQuality - shared.task.peak)
  const closest = rows.reduce((best, row) => (distance(row.meanQuality) < distance(best.meanQuality) ? row : best), rows[0]!)
  const furthest = rows.reduce((best, row) => (distance(row.meanQuality) > distance(best.meanQuality) ? row : best), rows[0]!)
  const proxyUp = rows.filter((row) => row.proxyAtEnd > row.proxyAtReference).length
  const goldDown = rows.filter((row) => row.goldAtEnd < row.goldAtReference).length
  const bestRanker = rows.reduce((best, row) => (row.accuracy > best.accuracy ? row : best), rows[0]!)
  const worstRanker = rows.reduce((best, row) => (row.accuracy < best.accuracy ? row : best), rows[0]!)
  const worstOffBand = rows.reduce((best, row) => (row.errorOutside > best.errorOutside ? row : best), rows[0]!)
  const colours = ['var(--accent-teal)', 'var(--accent-amber)', 'var(--accent-rose)', 'var(--accent-violet)']
  // Every row is the same stage options, so its history is on the same step grid.
  const grid = rows[0]!.history.map((point, index) => {
    const goldRow: Record<string, number> = { x: point.step }
    const proxyRow: Record<string, number> = { x: point.step }
    rows.forEach((row, position) => {
      const entry = row.history[index]
      if (entry) {
        goldRow[`s${position}`] = entry.gold
        proxyRow[`s${position}`] = entry.proxy
      }
    })
    return { gold: goldRow, proxy: proxyRow }
  })
  const goldTable = sampled(grid, 21)

  return (
    <>
      <div className="stat-row">
        <Stat label="Reward models" value={String(rows.length)} hint="one reference policy, four sets of pairs" />
        <Stat
          label="Turned over"
          value={String(hacked.length)}
          hint={`the gold reward peaked part-way and fell by more than ${fmt(TURNOVER_FLOOR, 2)}`}
          tone={hacked.length > 0 ? 'warn' : 'good'}
        />
        <Stat
          label="The worst fall"
          value={fmt(Math.max(...rows.map((row) => row.dropFromBest)), 4)}
          hint="gold reward given away after the peak"
        />
        <Stat
          label="The worst out-of-band accuracy"
          value={fmt(Math.min(...rows.map((row) => row.outsideAccuracy)), 3)}
          hint="on the pairs the band leaves out"
        />
        <Stat
          label="The worst error off the band"
          value={fmt(worstOffBand.errorOutside, 3)}
          hint={`${worstOffBand.label.toLowerCase()}, against ${fmt(worstOffBand.errorInside, 3)} where its own pairs reach`}
          tone={worstOffBand.errorOutside > worstOffBand.errorInside ? 'warn' : 'good'}
        />
      </div>

      <Figure
        title="The gold reward of four pipelines that differ only in their pairs"
        description="Each row is the same supervised policy optimised against a reward model fitted on a different range of responses."
        caption={`Every run uses the same ${STUDY_STAGE.steps} steps, the same batch and the same KL coefficient of ${STUDY_STAGE.beta}: the only difference is which responses the ${VARIANTS[0]!.pairs} preference pairs covered. ${
          hacked.length === 0
            ? 'None of them turns over at this distance.'
            : `${hacked.length} of ${rows.length} do — the gold reward rises, peaks and falls while the proxy keeps climbing.`
        }`}
        data={{
          headers: ['The step', ...rows.map((row) => row.label)],
          rows: goldTable.map((point) => [String(point.gold.x), ...rows.map((_, index) => fmt(point.gold[`s${index}`] ?? Number.NaN, 4))]),
        }}
      >
        <TrendChart
          data={grid.map((point) => point.gold)}
          series={rows.map((row, index) => ({ key: `s${index}`, name: row.label, colour: colours[index]! }))}
          xLabel="the PPO step"
          yLabel="the gold reward"
          height={300}
        />
      </Figure>

      <Figure
        title="The same four, scored on the proxy they were given"
        description="The reward model’s own score for the policy at each step."
        caption="Every one of these curves rises, including the ones whose gold reward falls. That is the sentence the whole module is built on: the objective the run is given does not contain the thing it is meant to stand for, and no amount of optimising it reports the difference."
        data={{
          headers: ['The step', ...rows.map((row) => row.label)],
          rows: goldTable.map((point) => [String(point.proxy.x), ...rows.map((_, index) => fmt(point.proxy[`s${index}`] ?? Number.NaN, 4))]),
        }}
      >
        <TrendChart
          data={grid.map((point) => point.proxy)}
          series={rows.map((row, index) => ({ key: `s${index}`, name: row.label, colour: colours[index]! }))}
          xLabel="the PPO step"
          yLabel="the proxy reward"
          height={280}
        />
      </Figure>

      <DataTable
        caption="Four reward models, one policy optimisation each"
        headers={[
          'The pairs were drawn from',
          'Labels flipped',
          'Accuracy on them',
          'Accuracy off them',
          'Error where the pairs reach',
          'Error where they do not',
          'Where the model puts the best response',
          'The proxy at the end',
          'The gold at its best',
          'The step it peaked at',
          'The gold at the end',
          'Given away',
          'The KL travelled',
          'The quality answered with',
        ]}
        rows={rows.map((row) => [
          row.label,
          fmt(row.labelNoise ?? 0, 2),
          fmt(row.accuracy, 3),
          fmt(row.outsideAccuracy, 3),
          fmt(row.errorInside, 3),
          coversRange(row.band) ? 'the data covers every response' : fmt(row.errorOutside, 3),
          fmt(row.modelOptimum, 2),
          fmt(row.proxyAtEnd, 4),
          fmt(row.bestGold, 4),
          String(row.bestGoldStep),
          fmt(row.goldAtEnd, 4),
          fmt(row.dropFromBest, 4),
          fmt(row.klAtEnd, 2),
          fmt(row.meanQuality, 3),
        ])}
      />

      <Callout tone="note" title="The quality the gold reward wants">
        On this task the gold reward is highest at a response quality of {fmt(shared.task.peak, 2)}, and the reference
        policy the four pipelines share answers with {fmt(refQuality, 3)}. Every run finishes further from the peak than
        the reference policy did: {closest.label.toLowerCase()} least, at {fmt(closest.meanQuality, 3)}, and{' '}
        {furthest.label.toLowerCase()} most, at {fmt(furthest.meanQuality, 3)}. The last column of the table is that
        number for each row. {proxyUp} of the {rows.length} runs finish with a higher proxy score than they started
        with, and {goldDown} finish with a lower gold reward than the reference policy had.
      </Callout>

      <Callout tone="warning" title="The best-ranked reward model is the most dangerous one here">
        No row ranks its own pairs better than {bestRanker.label.toLowerCase()} — {fmt(bestRanker.accuracy, 3)} against{' '}
        {fmt(worstRanker.accuracy, 3)} for the worst — and no row gives away more gold reward after its peak:{' '}
        {fmt(bestRanker.dropFromBest, 4)}, with the model putting the best response at{' '}
        {fmt(bestRanker.modelOptimum, 2)} where the gold reward wants {fmt(shared.task.peak, 2)}. Its labels are the
        cleanest of the four ({fmt(bestRanker.labelNoise ?? 0, 2)} flipped against{' '}
        {fmt(worstRanker.labelNoise ?? 0, 2)} for the row it outranks), which is the point: narrowing the range of
        responses the preferences cover does the same damage as corrupting the labels inside it, and the ranking
        accuracy is the number anyone reports.
      </Callout>
    </>
  )
}

function ChecklistView() {
  return (
    <>
      <Figure
        title="The checklist"
        description="The implementation details the primary source enumerates, and the failure each one guards against."
        caption="The primary source’s contribution is an enumeration and a reproduction: the reported behaviour needed most of these to be in place. Each one guards against a specific, named failure — which is what makes the list useful rather than merely long."
      >
        <DataTable
          caption="The details, and what each one is for"
          headers={['The detail', 'The failure it guards against']}
          rows={CHECKLIST.map((entry) => [entry.detail, entry.guards])}
        />
      </Figure>

      <Callout tone="warning" title="Why the list matters more than the algorithm">
        The algorithm was not the missing piece. The reported behaviour was reproducible only with most of the details
        in place, and a result reported without them cannot be checked. The list is a form of the scientific method
        applied to a training pipeline: it says what has to be true for the number to mean anything.
      </Callout>
    </>
  )
}
