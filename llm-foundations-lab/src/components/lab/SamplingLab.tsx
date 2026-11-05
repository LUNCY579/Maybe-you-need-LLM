import { useMemo, useState } from 'react'
import { readNumber, readNumberList, readOneOf, type LabSettings } from './settings'
import {
  DEFAULT_SAMPLING_CONFIG,
  TOY_LOGIT_TOKENS,
  TOY_LOGITS,
  decodeDistribution,
  generateSequence,
  sampleFromDistribution,
  seedFromText,
  type SamplingConfig,
} from '../../core/sampling'
import { createRng, entropy, fmt } from '../../core/math'
import { FigureCard, LineChartPanel, TokenDistributionChart } from '../viz/Charts'
import {
  Badge,
  Button,
  Callout,
  NumberField,
  Panel,
  ResetButton,
  SectionHeading,
  SegmentedControl,
  Slider,
  Stat,
  TextInput,
} from '../ui/primitives'
import { DisplayMath, InlineMath } from '../ui/Math'
import { PredictPanel } from './PredictPanel'
import { buildSamplingQuestions } from '../../content/predictionQuestions'

type Preset = 'peaked' | 'moderate' | 'flat'

const PRESETS: Record<Preset, number[]> = {
  peaked: [5.5, 3.1, 1.4, 0.3, -0.6, -1.2, -1.9, -2.6, -3.4, -4.2, -5.1, -6.0],
  moderate: [...TOY_LOGITS],
  flat: [1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0],
}

export interface SamplingLabProps {
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
  /** Settings restored from a saved configuration. */
  initialSettings?: LabSettings
}

export function SamplingLab({
  onSaveConfig,
  initialSettings,
}: SamplingLabProps) {
  const [preset, setPreset] = useState<Preset>(() =>
    readOneOf(initialSettings, 'preset', ['peaked', 'moderate', 'flat'] as const, 'moderate'),
  )
  const [logits, setLogits] = useState<number[]>(() =>
    readNumberList(initialSettings, 'logits', PRESETS.moderate),
  )
  const [config, setConfig] = useState<SamplingConfig>(() => ({
    temperature: readNumber(initialSettings, 'temperature', DEFAULT_SAMPLING_CONFIG.temperature),
    topK: readNumber(initialSettings, 'topK', DEFAULT_SAMPLING_CONFIG.topK),
    topP: readNumber(initialSettings, 'topP', DEFAULT_SAMPLING_CONFIG.topP),
    seed: readNumber(initialSettings, 'seed', DEFAULT_SAMPLING_CONFIG.seed),
  }))
  const [seedText, setSeedText] = useState(() =>
    String(readNumber(initialSettings, 'seed', DEFAULT_SAMPLING_CONFIG.seed)),
  )
  const [newTokens, setNewTokens] = useState(() => readNumber(initialSettings, 'newTokens', 8))

  const samplingQuestions = useMemo(() => buildSamplingQuestions(), [])

  const trace = useMemo(() => {
    try {
      return { value: decodeDistribution(logits, TOY_LOGIT_TOKENS, config), error: undefined }
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : 'invalid configuration' }
    }
  }, [logits, config])

  const seeded = useMemo(() => {
    // Two independent streams from the same seed: the replay is exact.
    const first = createRng(config.seed)
    const second = createRng(config.seed)
    const sample = (rng: () => number) =>
      Array.from({ length: 6 }, () => {
        if (!trace.value) return '—'
        const index = sampleFromDistribution(trace.value.probabilities, rng)
        return TOY_LOGIT_TOKENS[index]
      })
    return { first: sample(first), second: sample(second) }
  }, [config.seed, trace.value])

  const generated = useMemo(() => {
    if (!trace.value) return null
    const transition = () => logits
    return generateSequence(
      ['the', 'model'],
      transition,
      TOY_LOGIT_TOKENS,
      config,
      newTokens,
      createRng(config.seed),
    )
  }, [logits, config, newTokens, trace.value])

  const empirical = useMemo(() => {
    if (!trace.value) return []
    const rng = createRng(999)
    const counts = new Array<number>(TOY_LOGIT_TOKENS.length).fill(0)
    const draws = 20000
    for (let i = 0; i < draws; i++) {
      counts[sampleFromDistribution(trace.value.probabilities, rng)] += 1
    }
    return TOY_LOGIT_TOKENS.map((token, index) => ({
      token,
      frequency: counts[index] / draws,
      probability: trace.value!.probabilities[index],
    })).filter((entry) => entry.probability > 0 || entry.frequency > 0)
  }, [trace.value])

  const setPresetAndLogits = (next: Preset) => {
    setPreset(next)
    setLogits([...PRESETS[next]])
  }

  const reset = () => {
    setPreset('moderate')
    setLogits([...PRESETS.moderate])
    setConfig({ ...DEFAULT_SAMPLING_CONFIG })
    setSeedText('42')
    setNewTokens(8)
  }

  const candidates = trace.value?.candidates ?? []
  const filteredOut = TOY_LOGIT_TOKENS.map((token, index) => ({
    token,
    probability: trace.value ? trace.value.probabilities[index] : 0,
    filtered: trace.value ? !trace.value.candidateIndices.includes(index) : false,
  })).sort((a, b) => b.probability - a.probability)

  return (
    <div className="lab-frame space-y-5">
      <Panel>
        <SectionHeading
          kicker="Laboratory B"
          title="Text generation and sampling"
          description="A real decoder operating on an explicit logit vector. No language model is running: the logits below are the input a model would produce, and every probability shown is computed from them with softmax and filtering."
          action={<ResetButton onReset={reset} label="Reset lab" />}
        />
        <div className="split-side">
          <div className="space-y-3">
            <SegmentedControl
              label="Logit preset"
              value={preset}
              onChange={setPresetAndLogits}
              options={[
                { value: 'peaked', label: 'peaked', hint: 'One dominant candidate.' },
                { value: 'moderate', label: 'moderate', hint: 'A clear head and a long tail.' },
                { value: 'flat', label: 'flat', hint: 'Nearly uniform — sampling will be very diverse.' },
              ]}
            />
            <div className="split-3-tight">
              {logits.map((logit, index) => (
                <NumberField
                  key={TOY_LOGIT_TOKENS[index]}
                  label={`logit(${TOY_LOGIT_TOKENS[index]})`}
                  value={logit}
                  min={-8}
                  max={8}
                  step={0.1}
                  onChange={(value) => {
                    setPreset('moderate')
                    setLogits((current) => current.map((item, i) => (i === index ? value : item)))
                  }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Stat label="Entropy of final distribution" value={`${fmt(trace.value?.entropy ?? 0, 3)} nats`} tone="teal" />
            <Stat label="Candidates kept" value={candidates.length} tone="indigo" />
            <Stat label="Probability mass removed" value={fmt(1 - candidates.reduce((s, c) => s + c.probability, 0), 4)} />
            <Stat label="Base entropy (τ = 1)" value={`${fmt(entropy(trace.value?.baseProbabilities ?? []), 3)} nats`} />
          </div>
        </div>
      </Panel>

      <PredictPanel
        title="Predict the decoding"
        description="Four questions about a fixed logit vector. Work out the answer from the rules — the softmax is monotone, the nucleus is the smallest prefix that reaches the threshold, and temperature divides the logits — and then check."
        questions={samplingQuestions}
        closing="Each answer was computed by the decoding core, not written down in advance. The point of the exercise is to predict the algorithm, not to memorise the numbers."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FigureCard title="Decoding controls" subtitle="All four parameters are real inputs to the computation.">
          <div className="space-y-4">
            <Slider
              label="Temperature τ"
              value={config.temperature}
              min={0.05}
              max={2.5}
              step={0.05}
              onChange={(value) => setConfig((c) => ({ ...c, temperature: value }))}
              format={(value) => value.toFixed(2)}
              hint="τ ≤ 0 is rejected by the core with an explicit error; the slider’s floor is 0.05."
            />
            <Slider
              label="Top-k"
              value={config.topK}
              min={1}
              max={12}
              onChange={(value) => setConfig((c) => ({ ...c, topK: value }))}
              format={(value) => `k = ${value}`}
            />
            <Slider
              label="Top-p"
              value={config.topP}
              min={0.05}
              max={1}
              step={0.05}
              onChange={(value) => setConfig((c) => ({ ...c, topP: value }))}
              format={(value) => `p = ${value.toFixed(2)}`}
            />
            <div className="flex items-end gap-2">
              <TextInput
                label="Seed"
                value={seedText}
                onChange={(event) => {
                  setSeedText(event.target.value)
                  const numeric = Number(event.target.value)
                  setConfig((c) => ({ ...c, seed: Number.isFinite(numeric) ? numeric : seedFromText(event.target.value) }))
                }}
                hint={`numeric seed ${config.seed}`}
              />
              <Button size="sm" onClick={() => setConfig((c) => ({ ...c, seed: seedFromText(seedText) }))}>
                Hash text
              </Button>
            </div>
            <Slider label="Tokens to generate" value={newTokens} min={1} max={16} onChange={setNewTokens} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setPresetAndLogits('moderate')}>
                Restore logits
              </Button>
            </div>
          </div>
        </FigureCard>

        <FigureCard
          className="lg:col-span-2"
          title="Base distribution versus the distribution actually sampled"
          subtitle="Base = softmax(logits). Final = temperature, top-k and top-p applied, then renormalised."
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TokenDistributionChart items={TOY_LOGIT_TOKENS.map((token, index) => ({ token, probability: trace.value?.baseProbabilities[index] ?? 0 })).sort((a, b) => b.probability - a.probability)} height={260} />
            <TokenDistributionChart
              items={filteredOut}
              height={260}
              highlight={generated?.steps[0]?.token}
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            Grey bars are filtered out by top-k/top-p and therefore have probability 0 in the sampling
            distribution. The amber bar is the token actually drawn with seed{' '}
            <span className="font-mono">{config.seed}</span>.
          </p>
        </FigureCard>
      </div>

      {trace.error ? (
        <Callout tone="rose" title="Invalid configuration">
          {trace.error}
        </Callout>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FigureCard
          title="Filtering arithmetic, step by step"
          subtitle="Work through one configuration by hand."
        >
          <DisplayMath tex="\Pr'(y_i) = \frac{\exp(u_{y_i}/\tau)}{\sum_{y_j \in V_i} \exp(u_{y_j}/\tau)}, \quad V_i = \text{top-k} \cap \text{nucleus}" />
          <ol className="space-y-2 text-sm text-muted" data-testid="filtering-steps">
            <li>
              1. Scale the logits by <InlineMath tex={`1/\\tau = ${fmt(1 / config.temperature, 3)}`} />.
            </li>
            <li>
              2. Softmax gives the temperature distribution. Top-1 mass:{' '}
              <span className="font-mono text-fg">{fmt(Math.max(...(trace.value?.temperatureProbabilities ?? [0])), 4)}</span>.
            </li>
            <li>
              3. Keep the top {Math.min(config.topK, TOY_LOGIT_TOKENS.length)} tokens, then the smallest prefix reaching{' '}
              {config.topP.toFixed(2)} of the mass → <span className="font-mono text-fg">{candidates.length}</span>{' '}
              candidate{candidates.length === 1 ? '' : 's'}.
            </li>
            <li>
              4. Renormalise over the pool: masses should sum to 1 →{' '}
              <span className="font-mono text-fg">{fmt(candidates.reduce((s, c) => s + c.probability, 0), 6)}</span>.
            </li>
            <li>
              5. Draw <InlineMath tex="r \sim U(0,1)" /> and walk the cumulative distribution.
            </li>
          </ol>
          <table className="mt-3 w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">candidate</th>
                <th className="py-1.5 font-medium">logit</th>
                <th className="py-1.5 font-medium">p (base)</th>
                <th className="py-1.5 font-medium">p (final)</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.token} className="border-b border-line-soft font-mono">
                  <td className="py-1.5 text-fg">{candidate.token}</td>
                  <td className="py-1.5 text-muted">{candidate.logit.toFixed(2)}</td>
                  <td className="py-1.5 text-muted">{fmt(trace.value!.baseProbabilities[candidate.index], 4)}</td>
                  <td className="py-1.5 text-teal">{fmt(candidate.probability, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FigureCard>

        <FigureCard
          title="Empirical check by Monte Carlo"
          subtitle="20,000 draws from the final distribution, compared with the theoretical probability."
          footer="If the sampler were biased, the frequencies would drift away from the probabilities. This is a real measurement performed in your browser each time the configuration changes."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-faint">
                  <th className="py-1.5 font-medium">token</th>
                  <th className="py-1.5 font-medium">theoretical p</th>
                  <th className="py-1.5 font-medium">observed freq.</th>
                  <th className="py-1.5 font-medium">abs. error</th>
                </tr>
              </thead>
              <tbody>
                {empirical.slice(0, 8).map((entry) => (
                  <tr key={entry.token} className="border-b border-line-soft font-mono">
                    <td className="py-1.5 text-fg">{entry.token}</td>
                    <td className="py-1.5 text-muted">{entry.probability.toFixed(4)}</td>
                    <td className="py-1.5 text-muted">{entry.frequency.toFixed(4)}</td>
                    <td className="py-1.5 text-amber">{Math.abs(entry.frequency - entry.probability).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FigureCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FigureCard
          title="Seeded, replayable output"
          subtitle="The same seed produces the same tokens; change it to change the draw."
        >
          <div className="space-y-2">
            <p className="text-xs text-muted">Stream A</p>
            <div className="flex flex-wrap gap-1.5">
              {seeded.first.map((token, index) => (
                <Badge key={index} tone="teal">
                  {token}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted">Stream B (identical seed, identical stream)</p>
            <div className="flex flex-wrap gap-1.5">
              {seeded.second.map((token, index) => (
                <Badge key={index} tone="indigo">
                  {token}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-faint">
              Two generators created from seed {config.seed} replay the same sequence, which is what makes experiments
              comparable.
            </p>
          </div>
        </FigureCard>

        <FigureCard
          title={`Generated continuation (${newTokens} tokens)`}
          subtitle="Repeated sampling from the same distribution, which is what a fixed-context decoder does at one step."
          footer="A real model would recompute the distribution after every token as the context grows. Here the distribution is held fixed so the effect of the decoding parameters is isolated."
        >
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="neutral">the</Badge>
            <Badge tone="neutral">model</Badge>
            {(generated?.steps ?? []).map((step) => (
              <Badge key={step.step} tone="amber" title={`p = ${fmt(step.probability, 4)} · entropy ${fmt(step.entropy, 3)}`}>
                {step.token}
              </Badge>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {(generated?.steps ?? []).map((step) => (
              <div key={step.step} className="flex items-center gap-3 text-xs">
                <span className="w-16 text-faint">step {step.step + 1}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft">
                  <div className="h-full rounded-full bg-amber-strong" style={{ width: `${step.probability * 100}%` }} />
                </div>
                <span className="w-24 text-right font-mono text-muted">p {fmt(step.probability, 3)}</span>
                <span className="w-24 text-right font-mono text-faint">H {fmt(step.entropy, 2)}</span>
              </div>
            ))}
          </div>
        </FigureCard>
      </div>

      <FigureCard
        title="Entropy across temperature"
        subtitle="Computed from the current logits at the current top-k and top-p."
        footer="As τ grows the distribution flattens and entropy rises; as τ shrinks it approaches greedy decoding."
      >
        <LineChartPanel
          data={Array.from({ length: 25 }, (_, index) => {
            const tau = 0.1 + index * 0.1
            const traceAt = decodeDistribution(logits, TOY_LOGIT_TOKENS, { ...config, temperature: tau })
            return { x: Number(tau.toFixed(2)), entropy: traceAt.entropy }
          })}
          series={[{ key: 'entropy', label: 'entropy (nats)', color: 'var(--teal)' }]}
          xLabel="temperature τ"
          yLabel="entropy"
          height={220}
        />
      </FigureCard>

      {onSaveConfig ? (
        <Button size="sm" onClick={() => onSaveConfig({ ...config, preset, logits: logits.join(','), newTokens })}>
          Save this configuration
        </Button>
      ) : null}
    </div>
  )
}

export default SamplingLab
