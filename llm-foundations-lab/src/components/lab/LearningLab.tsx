import { useMemo, useState } from 'react'
import { readNumber, readOneOf, type LabSettings } from './settings'
import {
  DEFAULT_TRAINING_CONFIG,
  TRAIN_CORPUS,
  VALIDATION_CORPUS,
  accuracy,
  evaluate,
  numericalGradient,
  predictNext,
  train,
  transitionMatrix,
  weightNorm,
  type TrainingConfig,
} from '../../core/training'
import { fmt } from '../../core/math'
import { compareToOptimal, optimalAllocation, trainingCompute } from '../../core/scaling'
import { Heatmap } from '../viz/Heatmap'
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
import { DisplayMath, InlineMath } from '../ui/Math'
import { PredictPanel } from './PredictPanel'
import { buildLearningQuestions } from '../../content/predictionQuestions'

export type LearningView = 'training' | 'scaling'

export interface LearningLabProps {
  view?: LearningView
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
  /** Settings restored from a saved configuration. */
  initialSettings?: LabSettings
}

export function LearningLab({
  view: initialView = 'training',
  onSaveConfig,
  initialSettings,
}: LearningLabProps) {
  const learningQuestions = useMemo(() => buildLearningQuestions(), [])
  const [view, setView] = useState<LearningView>(() =>
    readOneOf(initialSettings, 'view', ['training', 'scaling'] as const, initialView),
  )
  return (
    <div className="lab-frame space-y-5">
      <SegmentedControl
        label="Laboratory C view"
        value={view}
        onChange={setView}
        options={[
          { value: 'training', label: 'Learning and optimisation' },
          { value: 'scaling', label: 'Scaling-law calculator' },
        ]}
      />
      {view === 'training' ? (
        <TrainingView onSaveConfig={onSaveConfig} initialSettings={initialSettings} />
      ) : (
        <ScalingView />
      )}
      <PredictPanel
        title="Predict the optimisation"
        description="Five questions about what the learning rate, the regulariser and the corpus size actually do. Each answer is the result of running the trainer, not a rule quoted from a textbook."
        questions={learningQuestions}
        closing="Every number above came from the same trainer the laboratory plots. The general lesson is that the learning rate sets the step size, the regulariser sets the size of the solution, and both have a point past which training stops working."
      />
    </div>
  )
}

function TrainingView({
  onSaveConfig,
  initialSettings,
}: {
  onSaveConfig?: LearningLabProps['onSaveConfig']
  initialSettings?: LabSettings
}) {
  const [config, setConfig] = useState<TrainingConfig>(() => ({
    learningRate: readNumber(initialSettings, 'learningRate', DEFAULT_TRAINING_CONFIG.learningRate),
    batchSize: readNumber(initialSettings, 'batchSize', DEFAULT_TRAINING_CONFIG.batchSize),
    steps: readNumber(initialSettings, 'steps', DEFAULT_TRAINING_CONFIG.steps),
    l2: readNumber(initialSettings, 'l2', DEFAULT_TRAINING_CONFIG.l2),
    seed: readNumber(initialSettings, 'seed', DEFAULT_TRAINING_CONFIG.seed),
  }))
  const [inspectCell, setInspectCell] = useState({ row: 0, col: 1 })

  const run = useMemo(() => train(config), [config])
  const final = run.history[run.history.length - 1]
  const initial = run.history[0]
  const matrix = useMemo(() => transitionMatrix(run.model), [run.model])

  const gradientCheck = useMemo(() => {
    const row = Math.min(inspectCell.row, run.model.vocab.tokens.length - 1)
    const col = Math.min(inspectCell.col, run.model.vocab.tokens.length - 1)
    const pair = run.trainPairs.find((p) => p.prev === row)
    if (!pair) return null
    const probs = matrix[row]
    const analytic = probs[col] - (col === pair.next ? 1 : 0)
    const numeric = numericalGradient(run.model, [{ prev: row, next: pair.next }], row, col)
    return { row, col, pair, analytic, numeric, difference: Math.abs(analytic - numeric) }
  }, [inspectCell, run.model, run.trainPairs, matrix])

  const reset = () => setConfig({ ...DEFAULT_TRAINING_CONFIG })

  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeading
          kicker="Laboratory C"
          title="Learning and optimisation"
          description="A genuine training loop: a bigram language model trained by minibatch stochastic gradient descent on a toy corpus. The loss curves are produced by the gradient updates below — nothing is animated or invented."
          action={<ResetButton onReset={reset} label="Reset lab" />}
        />
        <div className="split-side">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Slider
              label="Learning rate η"
              value={config.learningRate}
              min={0.05}
              max={60}
              step={0.05}
              onChange={(value) => setConfig((c) => ({ ...c, learningRate: value }))}
              format={(value) => value.toFixed(2)}
              hint="η ≥ 4 starts to overshoot on this corpus; η ≥ 30 is clearly unstable."
            />
            <Slider
              label="Batch size"
              value={config.batchSize}
              min={1}
              max={32}
              onChange={(value) => setConfig((c) => ({ ...c, batchSize: value }))}
              format={(value) => `${value} pairs`}
              hint="Minibatches are sampled with replacement from the training pairs."
            />
            <Slider
              label="Training steps"
              value={config.steps}
              min={5}
              max={300}
              step={5}
              onChange={(value) => setConfig((c) => ({ ...c, steps: value }))}
              format={(value) => `${value}`}
            />
            <Slider
              label="L2 regularisation λ"
              value={config.l2}
              min={0}
              max={1}
              step={0.02}
              onChange={(value) => setConfig((c) => ({ ...c, l2: value }))}
              format={(value) => value.toFixed(2)}
              hint="Adds λ·w to the gradient, shrinking the weight matrix."
            />
            <Slider
              label="Initialisation seed"
              value={config.seed}
              min={1}
              max={40}
              onChange={(value) => setConfig((c) => ({ ...c, seed: value }))}
              format={(value) => `#${value}`}
            />
            <div className="flex items-end gap-2">
              <Button size="sm" onClick={() => setConfig((c) => ({ ...c, steps: c.steps + 50 }))}>
                Train 50 more steps
              </Button>
            </div>
          </div>
          <div className="split-2-tight">
            <Stat
              label="Train cross-entropy"
              value={fmt(final.trainLoss, 4)}
              tone={final.trainLoss < initial.trainLoss ? 'positive' : 'rose'}
              hint={`started at ${fmt(initial.trainLoss, 4)}`}
            />
            <Stat
              label="Validation cross-entropy"
              value={fmt(final.validationLoss, 4)}
              tone={final.validationLoss < initial.validationLoss ? 'teal' : 'rose'}
            />
            <Stat label="Train top-1 accuracy" value={`${(final.trainAccuracy * 100).toFixed(1)}%`} tone="indigo" />
            <Stat label="Validation accuracy" value={`${(final.validationAccuracy * 100).toFixed(1)}%`} tone="indigo" />
            <Stat label="‖W‖₂" value={fmt(weightNorm(run.model), 3)} />
            <Stat
              label="Status"
              value={run.diverged ? 'diverged' : 'finite'}
              tone={run.diverged ? 'rose' : 'positive'}
            />
          </div>
        </div>
        {run.diverged ? (
          <Callout tone="rose" title="Run diverged">
            The loss became non-finite and training stopped, as a real trainer would. Lower the learning rate or raise
            the L2 penalty and run again.
          </Callout>
        ) : null}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FigureCard
          title="Loss trajectory"
          subtitle="Cross-entropy on the training pairs and on a held-out validation corpus."
          footer="Validation is drawn from the same toy grammar but different sentences, so a gap between the curves is ordinary overfitting, not a numerical error."
        >
          <LineChartPanel
            data={run.history.map((point) => ({
              x: point.step,
              train: Number.isFinite(point.trainLoss) ? Number(point.trainLoss.toFixed(4)) : null,
              validation: Number.isFinite(point.validationLoss) ? Number(point.validationLoss.toFixed(4)) : null,
            }))}
            key={run.history.length}
            series={[
              { key: 'train', label: 'train', color: 'var(--indigo)' },
              { key: 'validation', label: 'validation', color: 'var(--amber)', dashed: true },
            ]}
            xLabel="training step"
            yLabel="cross-entropy (nats)"
            height={260}
            referenceY={Math.log(run.model.vocab.tokens.length)}
          />
          <p className="mt-1 text-xs text-faint">
            The dashed reference line is the uniform-prediction loss{' '}
            <InlineMath tex={`\\log V = \\log ${run.model.vocab.tokens.length} = ${fmt(Math.log(run.model.vocab.tokens.length), 3)}`} />.
          </p>
        </FigureCard>

        <FigureCard
          title="Accuracy trajectory"
          subtitle="Top-1 next-token accuracy on the two splits."
        >
          <LineChartPanel
            data={run.history.map((point) => ({
              x: point.step,
              train: Number((point.trainAccuracy * 100).toFixed(2)),
              validation: Number((point.validationAccuracy * 100).toFixed(2)),
            }))}
            series={[
              { key: 'train', label: 'train %', color: 'var(--teal)' },
              { key: 'validation', label: 'validation %', color: 'var(--amber)', dashed: true },
            ]}
            xLabel="training step"
            yLabel="accuracy %"
            height={260}
          />
        </FigureCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <FigureCard
          title="Learned transition matrix Pr(next | previous)"
          subtitle="Each row is a softmax over the vocabulary for one previous token."
          footer="Compare with the naive model: an untrained matrix is uniform. Training is what creates the structure you see."
        >
          <Heatmap
            testId="transition-heatmap"
            matrix={matrix}
            rowLabels={run.model.vocab.tokens}
            colLabels={run.model.vocab.tokens}
            title="Row-stochastic transition probabilities after training"
            showValues={false}
          />
        </FigureCard>

        <FigureCard
          title="Check the gradient"
          subtitle="Analytic gradient from the softmax formula versus a finite-difference estimate."
          footer="Agreement to ~1e-6 means the update rule implemented here is the derivative of the loss, not an approximation of it."
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted">
              previous token
              <select
                value={inspectCell.row}
                onChange={(event) => setInspectCell((c) => ({ ...c, row: Number(event.target.value) }))}
                className="ml-1 rounded-lg border border-control bg-panel-2 px-2 py-1 font-mono text-xs"
              >
                {run.model.vocab.tokens.map((token, index) => (
                  <option key={token} value={index}>
                    {token}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              target token
              <select
                value={inspectCell.col}
                onChange={(event) => setInspectCell((c) => ({ ...c, col: Number(event.target.value) }))}
                className="ml-1 rounded-lg border border-control bg-panel-2 px-2 py-1 font-mono text-xs"
              >
                {run.model.vocab.tokens.map((token, index) => (
                  <option key={token} value={index}>
                    {token}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {gradientCheck ? (
            <div className="space-y-3 text-sm text-muted">
              <DisplayMath tex="\frac{\partial \mathcal{L}}{\partial z_{ij}} = \Pr(y = j \mid \text{prev} = i) - \mathbb{1}[\,y = j\,]" />
              <ul className="space-y-1.5 font-mono text-xs">
                <li>
                  pair: <span className="text-fg">{run.model.vocab.tokens[gradientCheck.pair.prev]}</span> →{' '}
                  <span className="text-fg">{run.model.vocab.tokens[gradientCheck.pair.next]}</span>
                </li>
                <li>
                  analytic: <span className="text-teal">{gradientCheck.analytic.toExponential(4)}</span>
                </li>
                <li>
                  finite difference: <span className="text-amber">{gradientCheck.numeric.toExponential(4)}</span>
                </li>
                <li>
                  |difference|: <span className="text-fg">{gradientCheck.difference.toExponential(3)}</span>
                </li>
              </ul>
              <p className="text-xs">
                The gradient is large exactly when the model’s probability for the observed next token is low — that is
                the learning signal.
              </p>
            </div>
          ) : (
            <p className="text-sm text-faint">This previous token has no training pair.</p>
          )}
        </FigureCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FigureCard title="What the model learned" subtitle="Most likely continuations after training.">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">previous token</th>
                <th className="py-1.5 font-medium">predicted next</th>
                <th className="py-1.5 font-medium">probability</th>
              </tr>
            </thead>
            <tbody>
              {['the', 'model', 'learns', 'from', 'text', 'language'].map((token) => {
                const prediction = predictNext(run.model, token)
                return (
                  <tr key={token} className="border-b border-line-soft font-mono">
                    <td className="py-1.5 text-fg">{token}</td>
                    <td className="py-1.5 text-teal">{prediction?.token ?? '—'}</td>
                    <td className="py-1.5 text-muted">
                      {prediction ? prediction.probability.toFixed(4) : 'not in vocabulary'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-faint">
            Training corpus: {TRAIN_CORPUS.length} sentences · validation: {VALIDATION_CORPUS.length} sentences ·{' '}
            {run.trainPairs.length} training pairs.
          </p>
        </FigureCard>

        <FigureCard
          title="Where the numbers come from"
          subtitle="Simplified assumptions, stated explicitly."
        >
          <ul className="space-y-2 text-sm text-muted">
            <li>
              <Badge tone="indigo">model</Badge> Bigram: Pr(next | previous) with one weight row per previous token.
              A Transformer replaces the lookup with a stack of attention blocks.
            </li>
            <li>
              <Badge tone="teal">loss</Badge> Mean cross-entropy over the batch, optionally plus <InlineMath tex="\frac{\lambda}{2}\|W\|^2" />.
            </li>
            <li>
              <Badge tone="amber">optimiser</Badge> Plain SGD with minibatches sampled uniformly with replacement.
              Real training adds momentum, adaptive step sizes, warmup and decay.
            </li>
            <li>
              <Badge tone="neutral">data</Badge> Eight short sentences over a vocabulary of{' '}
              {run.model.vocab.tokens.length} tokens. Real corpora are billions of tokens.
            </li>
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Parameters" value={run.model.vocab.tokens.length ** 2} hint="V × V weight matrix" />
            <Stat label="Train pairs" value={run.trainPairs.length} />
            <Stat label="Val pairs" value={run.validationPairs.length} />
            <Stat label="Final train loss" value={fmt(evaluate(run.model, run.trainPairs, config.l2), 4)} />
            <Stat label="Final val accuracy" value={`${(accuracy(run.model, run.validationPairs) * 100).toFixed(1)}%`} />
            <Stat label="Steps recorded" value={run.history.length - 1} />
          </div>
        </FigureCard>
      </div>

      {onSaveConfig ? (
        <Button size="sm" onClick={() => onSaveConfig({ ...config })}>
          Save this configuration
        </Button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ Scaling */

interface ScalingAssumptions {
  /** Parameters in millions. */
  params: number
  /** Training tokens in billions. */
  tokens: number
  /** Data-quality multiplier applied to the token count. */
  quality: number
}

const SCALING_CONSTANTS = {
  /** Irreducible loss floor, in nats per token. */
  lossFloor: 1.62,
  paramsScale: 420,
  paramsExponent: 0.34,
  tokensScale: 2600,
  tokensExponent: 0.28,
}

/**
 * Illustrative power-law fit. The constants are *not* the published fits; they are
 * chosen so the calculator reproduces the qualitative shape learners need to
 * reason about (diminishing returns in both directions).
 */
function estimatedLoss({ params, tokens, quality }: ScalingAssumptions): number {
  const effectiveTokens = Math.max(tokens * quality, 1e-6)
  return (
    SCALING_CONSTANTS.lossFloor +
    Math.pow(SCALING_CONSTANTS.paramsScale / Math.max(params, 1e-6), SCALING_CONSTANTS.paramsExponent) +
    Math.pow(SCALING_CONSTANTS.tokensScale / effectiveTokens, SCALING_CONSTANTS.tokensExponent)
  )
}

/** Training compute in FLOPs, using the standard ≈ 6·N·D estimate. */
function computeFlops({ params, tokens, quality }: ScalingAssumptions): number {
  const n = params * 1e6
  const d = tokens * 1e9 * quality
  return 6 * n * d
}

function ScalingView() {
  const [assumptions, setAssumptions] = useState<ScalingAssumptions>({ params: 1000, tokens: 200, quality: 1 })
  const loss = estimatedLoss(assumptions)
  const flops = computeFlops(assumptions)

  const budgets = useMemo(
    () =>
      [1e21, 1e22, 1e23, 1e24, 1e25].map((budget) => {
        const allocation = optimalAllocation(budget)
        return { budget, params: allocation.params, tokens: allocation.tokens, ratio: allocation.ratio }
      }),
    [],
  )

  const marginal = {
    params: loss - estimatedLoss({ ...assumptions, params: assumptions.params * 1.1 }),
    tokens: loss - estimatedLoss({ ...assumptions, tokens: assumptions.tokens * 1.1 }),
  }

  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeading
          kicker="Laboratory C · scaling"
          title="Scaling-law calculator"
          description="An illustrative power-law fit over parameters, data and compute. The exponents are course constants chosen to reproduce the qualitative behaviour discussed in the source; they are not the published fitted values, and no claim about a specific model should be based on this calculator."
        />
        <div className="split-side">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Slider
              label="Parameters N"
              value={assumptions.params}
              min={100}
              max={100000}
              step={100}
              onChange={(params) => setAssumptions((a) => ({ ...a, params }))}
              format={(value) => `${value.toLocaleString()} M`}
            />
            <Slider
              label="Training tokens D"
              value={assumptions.tokens}
              min={10}
              max={20000}
              step={10}
              onChange={(tokens) => setAssumptions((a) => ({ ...a, tokens }))}
              format={(value) => `${value.toLocaleString()} B`}
            />
            <Slider
              label="Data quality multiplier"
              value={assumptions.quality}
              min={0.25}
              max={2}
              step={0.05}
              onChange={(quality) => setAssumptions((a) => ({ ...a, quality }))}
              format={(value) => `×${value.toFixed(2)}`}
              hint="Stands in for deduplication and filtering: it scales the effective token count."
            />
          </div>
          <div className="split-2-tight">
            <Stat label="Estimated loss" value={`${fmt(loss, 4)} nats`} tone="indigo" />
            <Stat label="Loss floor in this fit" value={`${SCALING_CONSTANTS.lossFloor} nats`} hint="Irreducible under the model" />
            <Stat label="Training compute ≈ 6·N·D" value={`${flops.toExponential(2)} FLOPs`} tone="teal" />
            <Stat label="Tokens per parameter" value={fmt((assumptions.tokens * 1e9) / (assumptions.params * 1e6), 1)} />
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FigureCard
          title="Loss versus parameters"
          subtitle="Tokens held fixed."
        >
          <LineChartPanel
            data={Array.from({ length: 40 }, (_, index) => {
              const params = 100 * Math.pow(1000 / 100, index / 39)
              return { x: Number(params.toFixed(0)), loss: Number(estimatedLoss({ ...assumptions, params }).toFixed(4)) }
            })}
            series={[{ key: 'loss', label: 'loss (nats)', color: 'var(--indigo)' }]}
            xLabel="parameters (millions, log-spaced)"
            yLabel="loss"
            height={230}
          />
        </FigureCard>
        <FigureCard title="Loss versus tokens" subtitle="Parameters held fixed.">
          <LineChartPanel
            data={Array.from({ length: 40 }, (_, index) => {
              const tokens = 10 * Math.pow(2000 / 10, index / 39)
              return { x: Number(tokens.toFixed(0)), loss: Number(estimatedLoss({ ...assumptions, tokens }).toFixed(4)) }
            })}
            series={[{ key: 'loss', label: 'loss (nats)', color: 'var(--teal)' }]}
            xLabel="tokens (billions, log-spaced)"
            yLabel="loss"
            height={230}
          />
        </FigureCard>
      </div>

      <FigureCard
        title="Where does the next 10% buy more?"
        subtitle="Marginal loss reduction from +10% parameters versus +10% tokens, at the current point."
        footer="Once the two numbers are close, the budget is roughly balanced — the qualitative reading of the compute-optimal result."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stat
            label="+10% parameters"
            value={`−${fmt(marginal.params, 5)} nats`}
            tone={marginal.params >= marginal.tokens ? 'positive' : 'neutral'}
          />
          <Stat
            label="+10% tokens"
            value={`−${fmt(marginal.tokens, 5)} nats`}
            tone={marginal.tokens > marginal.params ? 'positive' : 'neutral'}
          />
        </div>
      </FigureCard>

      <FigureCard
        title="The allocation across five budgets"
        subtitle="Parameters grow as C^0.46 and tokens as C^0.54, so the token-to-parameter ratio drifts slowly rather than sitting at one fixed number."
        footer={`The ratio falls to ${budgets[0]!.ratio.toFixed(0)} at 1e21 FLOPs and rises to ${budgets[4]!.ratio.toFixed(0)} at 1e25. Chinchilla's own budget, 6·N·D ≈ 5.9e23, is the anchor at twenty.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">compute (FLOPs)</th>
                <th className="py-1.5 font-medium">parameters</th>
                <th className="py-1.5 font-medium">tokens</th>
                <th className="py-1.5 font-medium">tokens / parameter</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {budgets.map((row) => (
                <tr key={row.budget} className="border-b border-line-soft">
                  <td className="py-1.5 text-fg">{row.budget.toExponential(0)}</td>
                  <td className="py-1.5 text-muted">{formatParams(row.params)}</td>
                  <td className="py-1.5 text-muted">{formatTokens(row.tokens)}</td>
                  <td className="py-1.5 text-teal">{row.ratio.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="amber" title="Read this as a model, not a measurement">
          Power-law fits describe a trend with wide confidence intervals and are sensitive to architecture, data mixture
          and optimiser. The calculator is a reasoning aid.
        </Callout>
      </FigureCard>

      <ChinchillaCard params={assumptions.params * 1e6} tokens={assumptions.tokens * 1e9} />
    </div>
  )
}

/**
 * The Chinchilla allocation at the current compute budget, and the published
 * LLaMA budgets against their own allocations.
 */
function ChinchillaCard({ params, tokens }: { params: number; tokens: number }) {
  const compute = trainingCompute(params, tokens)
  const optimal = optimalAllocation(compute)
  const models = compareToOptimal()
  const currentRatio = tokens / params

  return (
    <>
      <FigureCard
        title="The compute-optimal allocation"
        subtitle="Chinchilla’s directly fitted allocation: parameters grow as C^0.46 and tokens as C^0.54. The exponents and the anchor are quoted from Hoffmann et al.; the numbers below are arithmetic on them."
        footer="The ratio is the conclusion: about twenty tokens per parameter at Chinchilla’s scale, drifting slowly with compute. This is a fitted average over training runs, not a prediction of any particular benchmark."
      >
        <DisplayMath tex="N_{\text{opt}} = 70\text{B}\left(\frac{C}{5.9\times10^{23}}\right)^{0.46},\qquad D_{\text{opt}} = 1.4\text{T}\left(\frac{C}{5.9\times10^{23}}\right)^{0.54}" />
        <div className="split-2-tight">
          <Stat label="Compute at the current point" value={`${compute.toExponential(2)} FLOPs`} tone="teal" />
          <Stat label="Optimal parameters" value={formatParams(optimal.params)} tone="indigo" />
          <Stat label="Optimal tokens" value={formatTokens(optimal.tokens)} tone="indigo" />
          <Stat label="Allocation tokens per parameter" value={optimal.ratio.toFixed(1)} tone="indigo" />
          <Stat
            label="Your split"
            value={`${currentRatio.toFixed(1)} tokens / parameter`}
            tone={currentRatio > optimal.ratio * 1.5 ? 'amber' : 'neutral'}
          />
        </div>
        <p className="mt-4 text-xs text-muted">
          At this budget the allocation calls for {formatParams(optimal.params)} and {formatTokens(optimal.tokens)}.
          Your sliders currently spend the same compute on {formatParams(params)} and {formatTokens(tokens)}.
        </p>
      </FigureCard>

      <FigureCard
        title="LLaMA against the Chinchilla-optimal token budget"
        subtitle="Each model’s published parameters and training tokens, with the allocation that the fitted exponents imply at the same compute."
        footer="The small LLaMA models bought far more tokens per parameter than the allocation at their budget. That is deliberate: training a smaller model for longer is cheaper at inference time, so the compute-optimal budget is not the deployment-optimal one."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">model</th>
                <th className="py-1.5 font-medium">tokens / parameter</th>
                <th className="py-1.5 font-medium">compute</th>
                <th className="py-1.5 font-medium">allocation at that compute</th>
                <th className="py-1.5 font-medium">ratio vs allocation</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {models.map((model) => (
                <tr key={model.name} className="border-b border-line-soft">
                  <td className="py-1.5 text-fg">{model.name}</td>
                  <td className="py-1.5 text-amber">{model.ratio.toFixed(1)}</td>
                  <td className="py-1.5 text-muted">{model.compute.toExponential(1)}</td>
                  <td className="py-1.5 text-muted">
                    {formatParams(model.optimalParams)} on {formatTokens(model.optimalTokens)}
                  </td>
                  <td className={`py-1.5 ${model.ratioMultiple > 1.5 ? 'text-rose' : 'text-teal'}`}>
                    {model.ratioMultiple.toFixed(1)}×
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="teal" title="What the paper actually argues">
          The compute-optimal point minimises training loss for a fixed training budget. A deployed model also pays for
          every token it generates, so a smaller, longer-trained model can be the cheaper choice at the same quality —
          which is the trade the 7B and 13B runs make. The 65B, trained on about twenty-one tokens per parameter, sits
          almost exactly on the allocation.
        </Callout>
      </FigureCard>
    </>
  )
}

function formatParams(params: number): string {
  return params < 1e9 ? `${(params / 1e6).toFixed(0)} M` : `${(params / 1e9).toFixed(params < 1e10 ? 2 : 1)} B`
}

function formatTokens(tokens: number): string {
  return tokens < 1e12 ? `${(tokens / 1e9).toFixed(0)} B` : `${(tokens / 1e12).toFixed(2)} T`
}

export default LearningLab
