import { useMemo, useState } from 'react'
import { readNumber, readOneOf, type LabSettings } from './settings'
import {
  PREFERENCE_DATASET,
  W_REFERENCE,
  dpoGradient,
  dpoLogOdds,
  dpoPreferenceProbability,
  impliedReward,
  numericalAlignmentGradient,
  policyDistribution,
  runAlignment,
  sftGradient,
  type AlignmentObjective,
} from '../../core/alignment'
import {
  STEP_DATASET,
  STEP_FEATURE_NAMES,
  creditSpread,
  trainStepScorer,
  type SupervisionMode,
} from '../../core/reasoning'
import { fmt } from '../../core/math'
import { safetyProfile, strengthForViolation } from '../../core/evaluation'
import { FigureCard, LineChartPanel } from '../viz/Charts'
import {
  Badge,
  Button,
  Callout,
  Panel,
  ResetButton,
  SectionHeading,
  SegmentedControl,
  Slider,
  Stat,
} from '../ui/primitives'
import { DisplayMath } from '../ui/Math'
import { PredictPanel } from './PredictPanel'
import { buildAlignmentQuestions } from '../../content/predictionQuestions'

export type AlignmentView = 'sft' | 'reward' | 'dpo' | 'process' | 'safety'

export interface AlignmentLabProps {
  view?: AlignmentView
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
  /** Settings restored from a saved configuration. */
  initialSettings?: LabSettings
}

export function AlignmentLab({ view: initialView = 'sft', onSaveConfig,
  initialSettings,
}: AlignmentLabProps) {
  const [view, setView] = useState<AlignmentView>(() =>
    readOneOf(initialSettings, 'view', ['sft', 'reward', 'dpo', 'process', 'safety'] as const, initialView),
  )
  const [exampleIndex, setExampleIndex] = useState(() => readNumber(initialSettings, 'exampleIndex', 0))
  const [learningRate, setLearningRate] = useState(() => readNumber(initialSettings, 'learningRate', 0.5))
  const [steps, setSteps] = useState(() => readNumber(initialSettings, 'steps', 120))
  const [beta, setBeta] = useState(() => readNumber(initialSettings, 'beta', 0.6))

  const alignmentQuestions = useMemo(() => buildAlignmentQuestions(), [])
  const example = PREFERENCE_DATASET[Math.min(exampleIndex, PREFERENCE_DATASET.length - 1)]
  const objective: AlignmentObjective = view === 'sft' ? 'sft' : view === 'reward' ? 'reward' : 'dpo'

  const run = useMemo(
    () =>
      view === 'process' || view === 'safety'
        ? null
        : runAlignment({ objective, learningRate, steps, beta }),
    [view, objective, learningRate, steps, beta],
  )

  // Baseline policy: the same small weight vector for every example, rescaled by β.
  const chosenIndex = example.candidates.findIndex((c) => c.id === example.chosen)
  const rejectedIndex = example.candidates.findIndex((c) => c.id === example.rejected)

  const before = useMemo(
    () => policyDistribution({ w: [0.2, 0.2, 0.2], beta }, example.candidates),
    [example, beta],
  )
  const after = useMemo(
    () => (run ? policyDistribution({ w: run.params.w, beta }, example.candidates) : before),
    [run, example, beta, before],
  )

  const reset = () => {
    setExampleIndex(0)
    setLearningRate(0.5)
    setSteps(120)
    setBeta(0.6)
    setView('sft')
  }

  return (
    <div className="lab-frame space-y-5">
      <Panel>
        <SectionHeading
          kicker="Laboratory D"
          title="Alignment and preference learning"
          description="A transparent linear policy over three interpretable response features. SFT imitates the chosen answer; RLHF trains a reward model on comparisons; DPO optimises the preference likelihood through policy/reference log-ratios. Every gradient here is checked against a finite difference."
          action={<ResetButton onReset={reset} label="Reset lab" />}
        />
        <div className="space-y-3">
          <SegmentedControl
            label="Objective"
            value={view}
            onChange={setView}
            options={[
              { value: 'sft', label: 'Supervised fine-tuning' },
              { value: 'reward', label: 'RLHF reward model' },
              { value: 'dpo', label: 'DPO' },
              { value: 'process', label: 'Reasoning supervision' },
              { value: 'safety', label: 'Safety evaluation' },
            ]}
          />
          {view !== 'process' && view !== 'safety' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Slider
                label="Learning rate"
                value={learningRate}
                min={0.05}
                max={3}
                step={0.05}
                onChange={setLearningRate}
                format={(value) => value.toFixed(2)}
              />
              <Slider
                label="Gradient steps"
                value={steps}
                min={0}
                max={400}
                step={10}
                onChange={setSteps}
                format={(value) => `${value}`}
              />
              <Slider
                label="β (strength of the preference term)"
                value={beta}
                min={0.1}
                max={2}
                step={0.05}
                onChange={setBeta}
                format={(value) => value.toFixed(2)}
                hint="Scales the reward/ratio term in both RLHF and DPO."
              />
            </div>
          ) : null}
        </div>
      </Panel>

      {view === 'process' ? <ProcessView /> : view === 'safety' ? <SafetyView /> : (
        <PredictPanel
          title="Predict the alignment behaviour"
          description="Five questions about what each objective does to the policy. The intuition to test is that imitation and preference learning move probability in different ways — and that a normalised softmax moves everything it does not push up."
          questions={alignmentQuestions}
          closing="Every number above was produced by the alignment core: the same gradients the laboratory plots, run on the same four preference pairs."
        />
      )}

      {view !== 'process' && view !== 'safety' && run ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <FigureCard
              title="Preference dataset"
              subtitle="Original prompts and candidate answers, with the labelled preference."
            >
              <div className="space-y-3">
                {PREFERENCE_DATASET.map((item, index) => (
                  <button
                    key={item.prompt}
                    type="button"
                    onClick={() => setExampleIndex(index)}
                    className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${
                      index === exampleIndex ? 'border-indigo bg-indigo/5' : 'border-line hover:border-indigo/40'
                    }`}
                  >
                    <p className="font-medium text-fg">{item.prompt}</p>
                    <p className="mt-1 text-xs text-muted">
                      chosen: <span className="font-mono text-teal">{item.chosen}</span> · rejected:{' '}
                      <span className="font-mono text-rose">{item.rejected}</span>
                    </p>
                  </button>
                ))}
              </div>
            </FigureCard>

            <FigureCard
              title={`Example ${exampleIndex + 1} in detail`}
              subtitle={example.rationale}
            >
              <ul className="space-y-3">
                {example.candidates.map((candidate, index) => {
                  const isChosen = index === chosenIndex
                  const isRejected = index === rejectedIndex
                  return (
                    <li
                      key={candidate.id}
                      className={`rounded-xl border p-3 ${
                        isChosen ? 'border-teal/50 bg-teal/5' : isRejected ? 'border-rose/50 bg-rose/5' : 'border-line'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-faint">{candidate.id}</span>
                        <div className="flex gap-1">
                          {isChosen ? <Badge tone="teal">chosen</Badge> : null}
                          {isRejected ? <Badge tone="rose">rejected</Badge> : null}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-fg">{candidate.text}</p>
                      <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px] text-muted">
                        <span>helpful {candidate.features[0].toFixed(2)}</span>
                        <span>safe {candidate.features[1].toFixed(2)}</span>
                        <span>concise {candidate.features[2].toFixed(2)}</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-14 text-faint">π before</span>
                          <div className="h-1.5 flex-1 rounded-full bg-line-soft">
                            <div className="h-full rounded-full bg-indigo" style={{ width: `${before[index] * 100}%` }} />
                          </div>
                          <span className="w-12 text-right font-mono">{fmt(before[index], 3)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-14 text-faint">π after</span>
                          <div className="h-1.5 flex-1 rounded-full bg-line-soft">
                            <div className="h-full rounded-full bg-teal" style={{ width: `${after[index] * 100}%` }} />
                          </div>
                          <span className="w-12 text-right font-mono">{fmt(after[index], 3)}</span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </FigureCard>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FigureCard
              title="Optimisation trajectory"
              subtitle={
                view === 'sft'
                  ? 'Negative log-likelihood of the chosen response.'
                  : view === 'reward'
                    ? 'Bradley–Terry loss on the comparisons (reward model parameters).'
                    : 'DPO loss: −log Pr(chosen ≻ rejected).'
              }
            >
              <LineChartPanel
                data={run.history.map((point) => ({
                  x: point.step,
                  loss: Number(point.loss.toFixed(5)),
                  preference: Number((point.meanPreferenceProbability * 100).toFixed(2)),
                }))}
                series={[
                  { key: 'loss', label: 'loss', color: 'var(--indigo)' },
                  { key: 'preference', label: 'mean Pr(chosen ≻ rejected) ×100', color: 'var(--teal)', dashed: true },
                ]}
                xLabel="gradient step"
                yLabel="value"
                height={250}
              />
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Stat label="Initial loss" value={fmt(run.history[0].loss, 4)} />
                <Stat label="Final loss" value={fmt(run.history[run.history.length - 1].loss, 4)} tone="positive" />
                <Stat
                  label="Final preference prob."
                  value={fmt(run.history[run.history.length - 1].meanPreferenceProbability, 3)}
                  tone="teal"
                />
              </div>
            </FigureCard>

            <FigureCard
              title="Learned parameters and implied rewards"
              subtitle={view === 'reward' ? 'Reward-model weights over the three features.' : 'Policy weights and the reward they imply.'}
            >
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-faint">
                    <th className="py-1.5 font-medium">quantity</th>
                    <th className="py-1.5 font-medium">value</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {['w(helpfulness)', 'w(safety)', 'w(conciseness)'].map((label, index) => (
                    <tr key={label} className="border-b border-line-soft">
                      <td className="py-1.5 text-fg">{label}</td>
                      <td className="py-1.5 text-teal">{fmt(run.params.w[index], 4)}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-line-soft">
                    <td className="py-1.5 text-fg">reference w</td>
                    <td className="py-1.5 text-muted">[{W_REFERENCE.map((v) => v.toFixed(2)).join(', ')}]</td>
                  </tr>
                  <tr className="border-b border-line-soft">
                    <td className="py-1.5 text-fg">β</td>
                    <td className="py-1.5 text-muted">{beta.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              {view !== 'reward' ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted">
                    Implied reward difference for this pair (Eq. 4.80 form, log Z cancels):
                  </p>
                  <DisplayMath
                    tex={`r(a) - r(b) = \\beta (w - w_{ref}) \\cdot \\Delta\\phi = ${fmt(
                      impliedReward({ w: run.params.w, beta }, example.candidates[chosenIndex]) -
                        impliedReward({ w: run.params.w, beta }, example.candidates[rejectedIndex]),
                      4,
                    )}`}
                  />
                  <DisplayMath
                    tex={`\\Pr(a \\succ b) = \\sigma(d) = ${fmt(dpoPreferenceProbability({ w: run.params.w, beta }, example), 4)}`}
                  />
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  A reward model is all RLHF needs to start policy optimisation. Note that the reward is only defined up
                  to a prompt-dependent constant — which is exactly the term DPO eliminates.
                </p>
              )}
            </FigureCard>
          </div>

          <FigureCard
            title="Check the maths"
            subtitle="Analytic gradient versus a central finite difference, at the current parameters."
            footer="Disagreement here would mean the implementation is not the derivative of the stated loss. The unit test suite asserts this for all three objectives."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <DisplayMath
                  tex={
                    view === 'sft'
                      ? '\\nabla_w \\mathcal{L}_{SFT} = \\beta \\sum_j (\\pi_j - \\mathbb{1}[j = a])\\,\\phi_j'
                      : view === 'reward'
                        ? '\\nabla_w \\mathcal{L}_{BT} = -\\sigma(-d)\\,(\\phi_a - \\phi_b)'
                        : '\\nabla_w \\mathcal{L}_{DPO} = -\\sigma(-d)\\,\\beta\\,(\\phi_a - \\phi_b)'
                  }
                />
                <p className="text-xs text-muted">
                  d = {view === 'dpo' ? fmt(dpoLogOdds({ w: run.params.w, beta }, example), 5) : 'reward difference'} ·
                  loss = {fmt(run.history[run.history.length - 1].loss, 5)}
                </p>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-faint">
                    <th className="py-1.5 font-medium">parameter</th>
                    <th className="py-1.5 font-medium">analytic</th>
                    <th className="py-1.5 font-medium">finite diff.</th>
                    <th className="py-1.5 font-medium">|diff|</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {[0, 1, 2].map((k) => {
                    const params = { w: run.params.w, beta }
                    const analytic =
                      view === 'sft' ? sftGradient(params, example)[k] : dpoGradient(params, example)[k]
                    const numeric = numericalAlignmentGradient(view === 'sft' ? 'sft' : 'dpo', params, example, k)
                    return (
                      <tr key={k} className="border-b border-line-soft">
                        <td className="py-1.5 text-fg">{STEP_FEATURE_NAMES[k]}</td>
                        <td className="py-1.5 text-muted">{analytic.toExponential(3)}</td>
                        <td className="py-1.5 text-muted">{numeric.toExponential(3)}</td>
                        <td className="py-1.5 text-amber">{Math.abs(analytic - numeric).toExponential(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </FigureCard>

          <Callout tone="indigo" title="Why a linear model, and what carries over">
            The policy here is a softmax over three hand-written features, so every score is traceable. What carries over
            to a real LLM is the objective structure: SFT is cross-entropy on demonstrations, RLHF is Bradley–Terry plus
            policy optimisation with a KL penalty, and DPO is the same preference likelihood expressed in
            policy/reference log-ratios. The gradient shapes are identical; only the way scores are produced differs.
          </Callout>
        </>
      ) : null}

      {onSaveConfig ? (
        <Button size="sm" onClick={() => onSaveConfig({ view, learningRate, steps, beta, exampleIndex })}>
          Save this configuration
        </Button>
      ) : null}
    </div>
  )
}

/* ----------------------------------------------------------- Safety view */

function SafetyView() {
  const [strength, setStrength] = useState(0.6)
  const profile = useMemo(() => safetyProfile(strength), [strength])
  const worst = profile.rows.reduce((a, b) => (b.violation > a.violation ? b : a), profile.rows[0])
  const forTarget = strengthForViolation(0.02)
  const curve = useMemo(
    () =>
      [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((value) => {
        const point = safetyProfile(value)
        return {
          x: Number(value.toFixed(1)),
          violation: Number((point.violationRate * 100).toFixed(2)),
          refusal: Number((point.benignRefusal * 100).toFixed(2)),
        }
      }),
    [],
  )

  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeading
          kicker="Laboratory D · safety"
          title="Safety evaluation of a chat model"
          description={`Seven categories of red-team prompt, ${profile.prompts.toLocaleString()} prompts in total, and ${profile.benignPrompts} benign requests. The violation rates are computed from a parameterised model of safety training; they are illustrative, not a measurement of any published system.`}
        />
        <div className="split-side">
          <div className="space-y-3">
            <Slider
              label="Safety training strength"
              value={strength}
              min={0}
              max={1}
              step={0.05}
              onChange={setStrength}
              format={(value) => value.toFixed(2)}
              hint="Stands in for red-teaming, refusal training and a safety reward model."
            />
          </div>
          <div className="split-2-tight">
            <Stat
              label="Disallowed answers"
              value={`${(profile.violationRate * 100).toFixed(2)}%`}
              tone={profile.violationRate < 0.03 ? 'positive' : 'rose'}
              hint={`${profile.violations.toFixed(0)} of ${profile.prompts} red-team prompts`}
            />
            <Stat
              label="Benign requests refused"
              value={`${(profile.benignRefusal * 100).toFixed(1)}%`}
              tone={profile.benignRefusal < 0.1 ? 'positive' : 'amber'}
              hint="the cost of the safety training"
            />
            <Stat label="Helpfulness retained" value={`${(profile.helpfulness * 100).toFixed(1)}%`} tone="teal" />
            <Stat
              label="Worst category"
              value={worst.label}
              tone="neutral"
              hint={`${(worst.violation * 100).toFixed(2)}% of ${worst.prompts} prompts`}
            />
          </div>
        </div>
      </Panel>

      <FigureCard
        title="Violations and false refusals move together"
        subtitle="Both rates against the strength of the safety training."
        footer="A safety report that prints only the left-hand curve can be gamed by refusing everything. The right-hand curve is what makes the first one mean something."
      >
        <LineChartPanel
          data={curve}
          series={[
            { key: 'violation', label: 'disallowed answers (%)', color: 'var(--rose)' },
            { key: 'refusal', label: 'benign requests refused (%)', color: 'var(--amber)' },
          ]}
          xLabel="safety training strength"
          yLabel="rate (%)"
          height={240}
        />
        <Callout tone="amber" title="The price of the target">
          The model reaches a two-percent violation rate at strength{' '}
          <span className="font-mono text-fg">
            {Number.isFinite(forTarget) ? forTarget.toFixed(2) : 'never'}
          </span>
          , and by then it refuses about{' '}
          <span className="font-mono text-fg">
            {Number.isFinite(forTarget)
              ? `${(safetyProfile(forTarget).benignRefusal * 100).toFixed(0)}%`
              : 'every'}
          </span>{' '}
          of benign requests. The two rates are not independent dials: they are the same training pulling in opposite
          directions.
        </Callout>
      </FigureCard>

      <FigureCard
        title="Where the violations remain"
        subtitle="The rate and the prompt count for each red-team category."
        footer="A single aggregate hides the category that still fails. The category with the highest rate is the one the safety training did not cover, and it is the one a deployment has to plan around."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">category</th>
                <th className="py-1.5 font-medium">prompts</th>
                <th className="py-1.5 font-medium">disallowed rate</th>
                <th className="py-1.5 font-medium">disallowed answers</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {profile.rows.map((row) => (
                <tr key={row.id} className="border-b border-line-soft">
                  <td className="py-1.5 text-fg">{row.label}</td>
                  <td className="py-1.5 text-muted">{row.prompts}</td>
                  <td className="py-1.5 text-rose">{(row.violation * 100).toFixed(2)}%</td>
                  <td className="py-1.5 text-muted">{(row.violation * row.prompts).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="rose" title="What a safety evaluation has to report">
          The prompt set, the categories, the refusal rate on benign requests and the rate on the categories that still
          fail. A model is not “safe”; it is safe on these prompts, at this rate, for these users — and the deployment
          decides whether that is enough.
        </Callout>
      </FigureCard>
    </div>
  )
}

/* ----------------------------------------------------------- Process view */

function ProcessView() {
  const [mode, setMode] = useState<SupervisionMode>('outcome')
  const run = useMemo(() => trainStepScorer(mode), [mode])
  const spreads = useMemo(() => creditSpread(run), [run])

  return (
    <div className="space-y-5">
      <FigureCard
        title="Outcome supervision versus process supervision"
        subtitle="The same step features, trained against two different labels."
        footer="Outcome supervision labels every step of a solution with the solution’s final outcome. Process supervision labels each step with its own validity. That single change decides whether the scorer can find the bad step."
      >
        <SegmentedControl
          label="Label used for each step"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'outcome', label: 'outcome (final answer)', hint: 'Every step inherits the solution’s result.' },
            { value: 'process', label: 'process (step validity)', hint: 'Each step is labelled on its own.' },
          ]}
        />
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <LineChartPanel
            data={run.history.map((point) => ({
              x: point.step,
              loss: Number(point.loss.toFixed(5)),
              stepAccuracy: Number((point.accuracy * 100).toFixed(2)),
            }))}
            series={[
              { key: 'loss', label: 'logistic loss', color: 'var(--indigo)' },
              { key: 'stepAccuracy', label: 'step-validity accuracy %', color: 'var(--teal)', dashed: true },
            ]}
            xLabel="gradient step"
            yLabel="value"
            height={240}
          />
          <div className="split-2-tight">
            <Stat label="Step-validity accuracy" value={`${(run.stepAccuracy * 100).toFixed(1)}%`} tone="teal" />
            <Stat
              label="Credit spread on failed solutions"
              value={fmt(run.failedPathCreditSpread, 4)}
              tone="amber"
              hint="How far the blame is concentrated on one step. Small means the whole path is penalised alike."
            />
            <Stat
              label="Score of sound steps in a failed solution"
              value={fmt(run.soundStepPenalty, 4)}
              tone="amber"
              hint="Low means steps that were not at fault are dragged down with the failing one."
            />
            <Stat label="Weights" value={run.weights.map((w) => fmt(w, 2)).join(', ')} />
          </div>
        </div>
      </FigureCard>

      <FigureCard
        title="What the scorer assigns to each step"
        subtitle="Rows are synthetic solutions. Red cells are invalid steps; the numbers are predicted validity scores."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">solution</th>
                <th className="py-1.5 font-medium">final</th>
                {[0, 1, 2].map((index) => (
                  <th key={index} className="py-1.5 font-medium">step {index}</th>
                ))}
                <th className="py-1.5 font-medium">credit spread</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(new Set(STEP_DATASET.map((step) => step.taskId))).map((taskId) => {
                const steps = run.predictions.filter((p) => p.taskId === taskId)
                const spread = spreads.find((s) => s.taskId === taskId)?.spread ?? 0
                return (
                  <tr key={taskId} className="border-b border-line-soft font-mono">
                    <td className="py-1.5 text-fg">{taskId}</td>
                    <td className="py-1.5">
                      {steps[0]?.finalCorrect ? <Badge tone="teal">correct</Badge> : <Badge tone="rose">wrong</Badge>}
                    </td>
                    {steps.map((step) => (
                      <td key={step.stepIndex} className="py-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 ${
                            step.stepCorrect ? 'bg-teal/15 text-teal' : 'bg-rose/15 text-rose'
                          }`}
                          title={step.stepCorrect ? 'valid step' : 'invalid step'}
                        >
                          {step.score.toFixed(3)}
                        </span>
                      </td>
                    ))}
                    <td className="py-1.5 text-amber">{spread.toFixed(3)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 split-3-tight">
          {STEP_FEATURE_NAMES.map((name, index) => (
            <Stat
              key={name}
              label={`w(${name})`}
              value={fmt(run.weights[index], 3)}
              tone={index === 1 ? 'teal' : 'neutral'}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          In {mode === 'outcome' ? 'outcome' : 'process'} mode the mean credit spread across the failed solutions is{' '}
          <span className="font-mono text-fg">{fmt(run.failedPathCreditSpread, 4)}</span>, and the steps that were{' '}
          <em>not</em> at fault are scored{' '}
          <span className="font-mono text-fg">{fmt(run.soundStepPenalty, 4)}</span> on average. A process-supervised
          scorer can single out the invalid step; an outcome-supervised one mostly inherits the solution-level label, which
          is the credit-assignment failure the source discusses.
        </p>
      </FigureCard>

      <Callout tone="amber" title="Simplifications that matter">
        Real process supervision needs step-level labels from humans or a strong verifier, and the scorer here has three
        features and six solutions. The mechanism — different labels produce different credit — is faithful; the scale is
        not.
      </Callout>
    </div>
  )
}

export default AlignmentLab
