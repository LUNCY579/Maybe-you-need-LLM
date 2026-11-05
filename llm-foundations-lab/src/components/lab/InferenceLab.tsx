import { useMemo, useState } from 'react'
import { readBoolean, readNumber, readOneOf, type LabSettings } from './settings'
import {
  DEFAULT_KV_CONFIG,
  ToyAutoregressiveLM,
  attentionMultiplyAdds,
  autoregressiveDecode,
  beamSearch,
  bestOfN,
  buildToyReasoningTree,
  decodeMultiplyAdds,
  formatBytes,
  gqaMemoryRatio,
  kvCacheBytes,
  pathToNode,
  type KvCacheConfig,
  type ReasoningNode,
  type SearchResult,
} from '../../core/inference'
import {
  SYNTHETIC_RESULTS,
  evaluateProtocols,
} from '../../core/reasoning'
import {
  DEFAULT_ROTARY,
  type RotarySetup,
  ladderTable,
  longContextReport,
} from '../../core/contextScaling'
import {
  DEFAULT_SPECULATIVE,
  TOY_VOCAB,
  expectedTokens,
  speculativeReport,
  type SpeculativeSetup,
} from '../../core/speculative'
import { fmt } from '../../core/math'
import { FigureCard, LineChartPanel } from '../viz/Charts'
import { RISK_CATEGORIES, riskProfiles } from '../../core/evaluation'
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
  Toggle,
} from '../ui/primitives'
import { DisplayMath, InlineMath } from '../ui/Math'
import { PredictPanel } from './PredictPanel'
import { buildInferenceQuestions } from '../../content/predictionQuestions'

export type InferenceView = 'decode' | 'kv-cache' | 'long-context' | 'speculative' | 'search' | 'evaluation'

export interface InferenceLabProps {
  view?: InferenceView
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
  /** Settings restored from a saved configuration. */
  initialSettings?: LabSettings
}

export function InferenceLab({ view: initialView = 'decode', onSaveConfig,
  initialSettings,
}: InferenceLabProps) {
  const inferenceQuestions = useMemo(() => buildInferenceQuestions(), [])
  const [view, setView] = useState<InferenceView>(() =>
    readOneOf(initialSettings, 'view', ['decode', 'kv-cache', 'long-context', 'speculative', 'search', 'evaluation'] as const, initialView),
  )
  return (
    <div className="lab-frame space-y-5">
      <SegmentedControl
        label="Laboratory E view"
        value={view}
        onChange={setView}
        options={[
          { value: 'decode', label: 'Autoregressive decoding' },
          { value: 'kv-cache', label: 'KV cache and context' },
          { value: 'long-context', label: 'Long context' },
          { value: 'speculative', label: 'Speculative decoding' },
          { value: 'search', label: 'Reasoning search' },
          { value: 'evaluation', label: 'Evaluation protocols' },
        ]}
      />
      {view === 'decode' ? (
        <DecodeView initialSettings={initialSettings} onSaveConfig={onSaveConfig} />
      ) : null}
      {view === 'kv-cache' ? (
        <KvCacheView initialSettings={initialSettings} onSaveConfig={onSaveConfig} />
      ) : null}
      <PredictPanel
        title="Predict the serving cost"
        description="Five questions about what the KV cache and the two inference phases actually cost. Every answer comes from the same analytic model the laboratory plots."
        questions={inferenceQuestions}
        closing="The general shape is worth remembering: the cache is linear in the context, prefill attention is quadratic, and decode attention is linear because the cache made it so."
      />
      {view === 'long-context' ? (
        <LongContextView initialSettings={initialSettings} onSaveConfig={onSaveConfig} />
      ) : null}
      {view === 'speculative' ? (
        <SpeculativeView initialSettings={initialSettings} onSaveConfig={onSaveConfig} />
      ) : null}
      {view === 'search' ? (
        <SearchView initialSettings={initialSettings} onSaveConfig={onSaveConfig} />
      ) : null}
      {view === 'evaluation' ? (
        <EvaluationView initialSettings={initialSettings} onSaveConfig={onSaveConfig} />
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------- Decoding */

function DecodeView({
  initialSettings,
  onSaveConfig,
}: {
  initialSettings?: LabSettings
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
}) {
  const [promptTokens, setPromptTokens] = useState<string[]>(['<bos>', 'the'])
  const [maxNewTokens, setMaxNewTokens] = useState(() => readNumber(initialSettings, 'maxNewTokens', 10))
  const [temperature, setTemperature] = useState(() => readNumber(initialSettings, 'temperature', 1))
  const [contextWindow, setContextWindow] = useState(() => readNumber(initialSettings, 'contextWindow', 6))
  const [seed, setSeed] = useState(() => readNumber(initialSettings, 'seed', 3))

  const lm = useMemo(() => new ToyAutoregressiveLM(contextWindow), [contextWindow])
  const decode = useMemo(
    () => autoregressiveDecode(lm, promptTokens, maxNewTokens, temperature, seed),
    [lm, promptTokens, maxNewTokens, temperature, seed],
  )

  const reset = () => {
    setPromptTokens(['<bos>', 'the'])
    setMaxNewTokens(10)
    setTemperature(1)
    setContextWindow(6)
    setSeed(3)
  }

  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeading
          kicker="Laboratory E · decoding"
          title="Autoregressive generation, one token at a time"
          description="A hand-written transition table over ten tokens, decoded with a real sampling loop. There is no neural network here: the table is the entire model, which is why each row below can be read in full."
          action={
            <div className="flex flex-wrap gap-2">
              <ResetButton onReset={reset} label="Reset decoding" />
              onSaveConfig ? (
            <Button
              size="sm"
              onClick={() => onSaveConfig?.({ view: 'decode', maxNewTokens, temperature, contextWindow, seed })}
            >
              Save this configuration
            </Button>
          ) : null
            </div>
          }
        />
        <div className="split-side">
          <div className="space-y-3">
            <div>
              <span className="mb-1 block text-xs font-medium text-muted">Prompt (click tokens to append)</span>
              <div className="flex flex-wrap gap-1.5">
                {lm.tokens.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => setPromptTokens((current) => [...current, token])}
                    className="rounded-lg border border-control bg-panel-2 px-2 py-1 font-mono text-xs text-fg hover:border-indigo/60"
                  >
                    {token}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {promptTokens.map((token, index) => (
                  <Badge key={`${token}-${index}`} tone="indigo">
                    {token}
                  </Badge>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setPromptTokens((current) => current.slice(0, -1))}>
                  remove last
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPromptTokens(['<bos>'])}>
                  clear
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Slider label="Tokens to generate" value={maxNewTokens} min={1} max={16} onChange={setMaxNewTokens} />
              <Slider
                label="Temperature τ"
                value={temperature}
                min={0.1}
                max={2.5}
                step={0.05}
                onChange={setTemperature}
                format={(value) => value.toFixed(2)}
              />
              <Slider
                label="Context window (tokens visible to the model)"
                value={contextWindow}
                min={1}
                max={8}
                onChange={setContextWindow}
                format={(value) => `${value} tokens`}
                hint="Set it to 1 and the context-sensitive boost disappears from the distribution."
              />
              <Slider label="Sampling seed" value={seed} min={1} max={40} onChange={setSeed} format={(v) => `#${v}`} />
            </div>
          </div>
          <div className="space-y-2">
            <Stat label="Generated tokens" value={decode.steps.length} tone="indigo" />
            <Stat
              label="Lowest chosen probability"
              value={decode.steps.length ? fmt(Math.min(...decode.steps.map((s) => s.probability)), 4) : '—'}
              tone="amber"
            />
            <Stat
              label="Mean entropy"
              value={
                decode.steps.length
                  ? `${fmt(decode.steps.reduce((sum, s) => sum + s.entropy, 0) / decode.steps.length, 3)} nats`
                  : '—'
              }
              tone="teal"
            />
            <Stat label="Model" value="toy table" hint="10 tokens · hand-written transitions" />
          </div>
        </div>
      </Panel>

      <FigureCard
        title="Decoding trace"
        subtitle="Each row is one step: the visible context, the distribution it produced and the token drawn from it."
        footer="Notice how the visible context is truncated to the window size. That truncation is the whole story of a finite context window."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">step</th>
                <th className="py-1.5 font-medium">visible context</th>
                <th className="py-1.5 font-medium">token</th>
                <th className="py-1.5 font-medium">p(chosen)</th>
                <th className="py-1.5 font-medium">p(top)</th>
                <th className="py-1.5 font-medium">entropy</th>
              </tr>
            </thead>
            <tbody>
              {decode.steps.map((step) => (
                <tr key={step.index} className="border-b border-line-soft">
                  <td className="py-1.5 font-mono text-faint">{step.index + 1}</td>
                  <td className="py-1.5 font-mono text-muted">
                    {step.context.map((token, index) => (
                      <span
                        key={`${token}-${index}`}
                        className={
                          index < step.context.length - contextWindow ? 'text-faint line-through' : 'text-fg'
                        }
                      >
                        {token}{' '}
                      </span>
                    ))}
                  </td>
                  <td className="py-1.5">
                    <Badge tone="amber">{step.nextToken}</Badge>
                  </td>
                  <td className="py-1.5 font-mono text-muted">{fmt(step.probability, 4)}</td>
                  <td className="py-1.5 font-mono text-muted">{fmt(step.peakProbability, 4)}</td>
                  <td className="py-1.5 font-mono text-muted">{fmt(step.entropy, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Generated sequence:</span>
          {decode.tokens.map((token, index) => (
            <Badge key={`${token}-${index}`} tone={index < promptTokens.length ? 'neutral' : 'teal'}>
              {token}
            </Badge>
          ))}
        </div>
      </FigureCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FigureCard
          title="Next-token distribution at the first step"
          subtitle="Rows show the effect of the context window on the same prompt."
        >
          <div className="space-y-3">
            {[1, 3, 6].map((window) => {
              const model = new ToyAutoregressiveLM(window)
              const probs = model.probabilities(promptTokens)
              const visible = promptTokens.slice(Math.max(0, promptTokens.length - window))
              return (
                <div key={window}>
                  <p className="mb-1 text-xs text-muted">
                    window = {window} · visible: <span className="font-mono">{visible.join(' ')}</span>
                  </p>
                  <div className="space-y-1">
                    {model.tokens
                      .map((token, index) => ({ token, p: probs[index] }))
                      .filter((entry) => entry.p > 0.01)
                      .sort((a, b) => b.p - a.p)
                      .slice(0, 5)
                      .map((entry) => (
                        <div key={entry.token} className="flex items-center gap-2 text-[11px]">
                          <span className="w-20 font-mono text-fg">{entry.token}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft">
                            <div className="h-full rounded-full bg-indigo" style={{ width: `${entry.p * 100}%` }} />
                          </div>
                          <span className="w-12 text-right font-mono text-muted">{fmt(entry.p, 3)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )
            })}
          </div>
        </FigureCard>

        <FigureCard
          title="Why the cache exists"
          subtitle="Keys and values needed per step, with and without caching."
        >
          <DisplayMath tex="\text{recompute without cache} = O(t^2 d) \qquad \text{with cache} = O(t\, d)" />
          <LineChartPanel
            data={Array.from({ length: 32 }, (_, index) => {
              const t = 32 + index * 32
              return {
                x: t,
                quadratic: t * t,
                linear: t,
              }
            })}
            series={[
              { key: 'quadratic', label: 'tokens² (recomputation)', color: 'var(--rose)' },
              { key: 'linear', label: 'tokens (cached read)', color: 'var(--teal)' },
            ]}
            xLabel="context length t"
            yLabel="relative operations"
            height={220}
          />
          <p className="mt-2 text-xs text-muted">
            The gap is why context is expensive and why every serious serving stack caches. The curves are arithmetic
            counts, not measured times.
          </p>
        </FigureCard>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- KV cache */

function KvCacheView({
  initialSettings,
  onSaveConfig,
}: {
  initialSettings?: LabSettings
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
}) {
  const [config, setConfig] = useState<KvCacheConfig>(() => ({
    layers: readNumber(initialSettings, 'layers', DEFAULT_KV_CONFIG.layers),
    queryHeads: readNumber(initialSettings, 'queryHeads', DEFAULT_KV_CONFIG.queryHeads),
    kvHeads: readNumber(initialSettings, 'kvHeads', DEFAULT_KV_CONFIG.kvHeads),
    headDim: readNumber(initialSettings, 'headDim', DEFAULT_KV_CONFIG.headDim),
    contextLength: readNumber(initialSettings, 'contextLength', DEFAULT_KV_CONFIG.contextLength),
    bytesPerValue: readNumber(initialSettings, 'bytesPerValue', DEFAULT_KV_CONFIG.bytesPerValue),
    batchSize: readNumber(initialSettings, 'batchSize', DEFAULT_KV_CONFIG.batchSize),
  }))
  const [measurements, setMeasurements] = useState<{ t: number; ms: number; multiplies: number }[]>([])
  const [measuring, setMeasuring] = useState(false)

  const bytes = kvCacheBytes(config)
  const gqa = gqaMemoryRatio(config)
  const perToken = bytes / Math.max(config.contextLength, 1)

  const variants = [
    { label: 'This configuration', config },
    { label: 'Multi-head (h_kv = h_q)', config: { ...config, kvHeads: config.queryHeads } },
    { label: 'Multi-query (h_kv = 1)', config: { ...config, kvHeads: 1 } },
    { label: '8-bit cache', config: { ...config, bytesPerValue: 1 } },
    { label: '4-bit cache', config: { ...config, bytesPerValue: 0.5 } },
  ]

  const measure = () => {
    setMeasuring(true)
    const results: { t: number; ms: number; multiplies: number }[] = []
    for (const t of [64, 128, 256, 512]) {
      const heads = Math.min(config.queryHeads, 8)
      const d = Math.min(config.headDim, 64)
      const q = Array.from({ length: t }, () => Array.from({ length: d }, () => Math.random()))
      const k = Array.from({ length: t }, () => Array.from({ length: d }, () => Math.random()))
      const start = performance.now()
      // One head's worth of raw scores: Q (t×d) × Kᵀ (d×t).
      for (let i = 0; i < t; i++) {
        for (let j = 0; j < t; j++) {
          let sum = 0
          for (let c = 0; c < d; c++) sum += q[i][c] * k[j][c]
          if (!Number.isFinite(sum)) throw new Error('unexpected')
        }
      }
      const elapsed = performance.now() - start
      results.push({ t, ms: elapsed, multiplies: attentionMultiplyAdds(t, d, heads) })
    }
    setMeasurements(results)
    setMeasuring(false)
  }

  const reset = () => {
    setConfig({ ...DEFAULT_KV_CONFIG })
    setMeasurements([])
  }

  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeading
          kicker="Laboratory E · memory"
          title="KV cache and context cost"
          description="The standard cache-size accounting, plus a locally measured JavaScript computation to show the shape of the arithmetic curve. The size is a formula evaluated for the shape you choose; the timing is measured on your machine in a browser, so it is not a GPU benchmark."
          action={
            <div className="flex flex-wrap gap-2">
              <ResetButton onReset={reset} label="Reset memory lab" />
              onSaveConfig ? (
            <Button
              size="sm"
              onClick={() => onSaveConfig?.({ view: 'kv-cache', ...config })}
            >
              Save this configuration
            </Button>
          ) : null
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Slider label="Layers L" value={config.layers} min={4} max={128} onChange={(layers) => setConfig((c) => ({ ...c, layers }))} />
            <Slider label="Query heads h_q" value={config.queryHeads} min={1} max={64} onChange={(queryHeads) => setConfig((c) => ({ ...c, queryHeads, kvHeads: Math.min(c.kvHeads, queryHeads) }))} />
            <Slider
              label="KV heads h_kv"
              value={config.kvHeads}
              min={1}
              max={64}
              onChange={(kvHeads) => setConfig((c) => ({ ...c, kvHeads }))}
              hint="h_kv < h_q is grouped-query attention; h_kv = 1 is multi-query attention."
            />
            <Slider label="Head dimension d_h" value={config.headDim} min={32} max={256} step={16} onChange={(headDim) => setConfig((c) => ({ ...c, headDim }))} />
            <Slider
              label="Context length T"
              value={config.contextLength}
              min={512}
              max={131072}
              step={512}
              onChange={(contextLength) => setConfig((c) => ({ ...c, contextLength }))}
              format={(value) => value.toLocaleString()}
            />
            <Slider
              label="Bytes per stored value"
              value={config.bytesPerValue}
              min={0.5}
              max={4}
              step={0.5}
              onChange={(bytesPerValue) => setConfig((c) => ({ ...c, bytesPerValue }))}
              format={(value) => `${value} B (${value === 2 ? 'fp16/bf16' : value === 4 ? 'fp32' : value === 1 ? 'int8' : 'int4'})`}
            />
            <Slider label="Batch size" value={config.batchSize} min={1} max={64} onChange={(batchSize) => setConfig((c) => ({ ...c, batchSize }))} />
            <div className="flex items-end">
              <Toggle
                label="Show 4-bit and 8-bit comparison below"
                checked
                onChange={() => undefined}
                hint="Static comparison table — shown for reference."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Cache per sequence" value={formatBytes(bytes / config.batchSize)} tone="indigo" />
            <Stat label="Cache for the batch" value={formatBytes(bytes)} tone="indigo" />
            <Stat label="Bytes per token" value={formatBytes(perToken)} tone="teal" />
            <Stat label="KV/query head ratio" value={gqa.toFixed(3)} tone="teal" />
            <Stat label="Values stored" value={(bytes / config.bytesPerValue).toExponential(3)} />
            <Stat
              label="Attention work, prefill"
              value={attentionMultiplyAdds(config.contextLength, config.headDim, config.queryHeads).toExponential(2)}
              hint="multiply-adds across all heads, ignoring layers"
            />
          </div>
        </div>
        <Callout tone="indigo" title="The formula being evaluated">
          <InlineMath tex="\text{bytes} = 2 \times L \times h_{kv} \times d_h \times T \times b \times B" /> with the factor 2
          for keys and values. Halving h_kv halves the cache; doubling precision doubles it; tripling the context triples
          it. Nothing here is a measurement of a real deployment.
        </Callout>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FigureCard title="Cache size across configurations" subtitle="Same model shape, different memory policies.">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-faint">
                  <th className="py-1.5 font-medium">configuration</th>
                  <th className="py-1.5 font-medium">h_kv</th>
                  <th className="py-1.5 font-medium">bytes/value</th>
                  <th className="py-1.5 font-medium">per sequence</th>
                  <th className="py-1.5 font-medium">relative</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {variants.map((variant) => {
                  const variantBytes = kvCacheBytes({ ...variant.config, batchSize: 1 })
                  const base = kvCacheBytes({ ...config, batchSize: 1 })
                  return (
                    <tr key={variant.label} className="border-b border-line-soft">
                      <td className="py-1.5 text-fg">{variant.label}</td>
                      <td className="py-1.5 text-muted">{variant.config.kvHeads}</td>
                      <td className="py-1.5 text-muted">{variant.config.bytesPerValue}</td>
                      <td className="py-1.5 text-teal">{formatBytes(variantBytes)}</td>
                      <td className="py-1.5 text-muted">{(variantBytes / base).toFixed(3)}×</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Decode attention work per token at this context is{' '}
            <span className="font-mono">
              {decodeMultiplyAdds(config.contextLength, config.headDim, config.queryHeads).toExponential(2)}
            </span>{' '}
            multiply-adds across all query heads — linear in T, unlike prefill’s quadratic term.
          </p>
        </FigureCard>

        <FigureCard
          title="Measured locally, in this browser"
          subtitle="Time to compute one head’s raw score matrix in JavaScript, for growing context lengths."
          footer="This measures a JavaScript loop, not a GPU kernel. It is included to show the quadratic growth directly; do not read it as a performance benchmark of any real system."
          actions={
            <Button size="sm" onClick={measure} disabled={measuring}>
              {measuring ? 'Measuring…' : 'Measure now'}
            </Button>
          }
        >
          {measurements.length === 0 ? (
            <p className="py-6 text-center text-sm text-faint">
              Press “Measure now” to time the score computation at t = 64, 128, 256 and 512.
            </p>
          ) : (
            <>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-faint">
                    <th className="py-1.5 font-medium">t</th>
                    <th className="py-1.5 font-medium">measured ms</th>
                    <th className="py-1.5 font-medium">t² ratio</th>
                    <th className="py-1.5 font-medium">measured ratio</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {measurements.map((entry, index) => {
                    const base = measurements[0]
                    return (
                      <tr key={entry.t} className="border-b border-line-soft">
                        <td className="py-1.5 text-fg">{entry.t}</td>
                        <td className="py-1.5 text-teal">{entry.ms.toFixed(2)}</td>
                        <td className="py-1.5 text-muted">{((entry.t / base.t) ** 2).toFixed(2)}×</td>
                        <td className="py-1.5 text-amber">
                          {index === 0 ? '1.00×' : `${(entry.ms / base.ms).toFixed(2)}×`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-faint">
                Measured ratios track the theoretical t² ratios approximately; garbage collection and JIT warm-up add
                noise, which is exactly why published benchmarks repeat runs and report distributions.
              </p>
            </>
          )}
        </FigureCard>
      </div>
    </div>
  )
}

/* --------------------------------------------------- Long context */

/**
 * The long-context arm of the laboratory. Every number on the screen is
 * closed-form arithmetic on the rotary ladder (`src/core/contextScaling`);
 * nothing is measured of a real model, and no accuracy figure is claimed.
 * What is shown is the one thing the ladder can settle honestly: which
 * angles the model was trained through, and which angles each strategy asks
 * for instead.
 */
function LongContextView({
  initialSettings,
  onSaveConfig,
}: {
  initialSettings?: LabSettings
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
}) {
  const [trainedLength, setTrainedLength] = useState(() => readNumber(initialSettings, 'trainedLength', DEFAULT_ROTARY.trainedLength))
  const [headDim, setHeadDim] = useState(() => readNumber(initialSettings, 'headDim', DEFAULT_ROTARY.headDim))
  const [targetLength, setTargetLength] = useState(() => readNumber(initialSettings, 'targetLength', 32_768))

  const setup = useMemo<RotarySetup>(() => ({ headDim, theta: DEFAULT_ROTARY.theta, trainedLength }), [headDim, trainedLength])
  const report = useMemo(() => longContextReport(setup, targetLength), [setup, targetLength])
  const table = useMemo(() => ladderTable(setup, report.scale), [setup, report.scale])
  // The components that never complete a rotation inside the training window
  // are the whole problem, so the table shows the slowest ones, not the fastest.
  const tail = useMemo(() => table.filter((row) => row.trained > setup.trainedLength).slice(-12), [table, setup.trainedLength])

  const reset = () => {
    setTrainedLength(DEFAULT_ROTARY.trainedLength)
    setHeadDim(DEFAULT_ROTARY.headDim)
    setTargetLength(32_768)
  }

  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeading
          kicker="Laboratory E · long context"
          title="Position interpolation, counted"
          description="A rotary embedding turns query and key vectors through f_i = θ^(−2i/d) radians per unit of relative distance, one plane per component. Training shows the model angles up to (L−1)·f_i in each component; asking for a longer window asks for angles it has never turned through. This view computes, exactly and for a ladder you choose, which components stay inside the trained range under plain extrapolation, under position interpolation (Chen et al., 2023), and under NTK-aware scaling of the base — and what each strategy pays for it."
          action={
            <div className="flex flex-wrap gap-2">
              <ResetButton onReset={reset} label="Reset long-context lab" />
              {onSaveConfig ? (
                <Button size="sm" onClick={() => onSaveConfig?.({ view: 'long-context', trainedLength, headDim, targetLength })}>
                  Save this configuration
                </Button>
              ) : null}
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Slider
              label="Trained window L"
              value={trainedLength}
              min={1024}
              max={8192}
              step={1024}
              onChange={(value) => {
                setTrainedLength(value)
                setTargetLength((current) => Math.max(current, value * 2))
              }}
              format={(value) => `${value.toLocaleString()} tokens`}
            />
            <Slider
              label="Head dimension d"
              value={headDim}
              min={64}
              max={256}
              step={32}
              onChange={setHeadDim}
              format={(value) => `${value} (${value / 2} rotation planes)`}
            />
            <Slider
              label="Target window N"
              value={targetLength}
              min={Math.max(2048, trainedLength * 2)}
              max={131_072}
              step={4096}
              onChange={setTargetLength}
              format={(value) => `${value.toLocaleString()} tokens`}
            />
            <div className="flex items-end">
              <p className="text-xs leading-relaxed text-muted">
                θ is fixed at 10,000, the usual base. The scale the target demands is{' '}
                <span className="font-mono text-fg">s = (N−1)/(L−1)</span>, computed rather than approximated by N/L —
                the difference is small and it is not free, see the note below the table.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Scale s = (N−1)/(L−1)" value={fmt(report.scale, 3)} tone="indigo" />
            <Stat label="Rotation planes d/2" value={String(report.totalComponents)} tone="teal" />
            <Stat
              label="Planes that never finish a rotation"
              value={String(report.beyondOneCycle)}
              tone="amber"
              hint="Their wavelength exceeds the trained window, so they carry no positional signal from training at all."
            />
            <Stat
              label="Trained angles at L−1"
              value={`(L−1)·f_i`}
              tone="teal"
              hint="The largest angle any component was ever turned through in training."
            />
          </div>
        </div>
        <Callout tone="indigo" title="The exact promise of interpolation">
          Interpolation divides every position by s before rotating, so the angle a distance D needs becomes (D/s)·f_i.
          The largest it ever needs, at D = N−1, is exactly (L−1)·f_i — the last angle training saw. That equality is the
          whole promise, and it is why the strategy works without touching the weights: every component lands inside the
          range it was trained on, for every distance up to N.
        </Callout>
      </Panel>

      <FigureCard
        title="Three strategies, one target"
        subtitle={`Amount of trained range kept at N = ${targetLength.toLocaleString()} tokens, from the same ladder.`}
        footer="“Inside at target” counts planes whose angle at distance N−1 is no larger than the largest angle training showed. Resolution compares one step of angular work — Σ_i (1−cos φ_i) — with the un-scaled baseline; plain interpolation pays for its guarantee with a loss of roughly s². NTK keeps the fastest plane at exactly 1, which is why its in-range distance stays the trained length however large the target grows: it buys length in wavelengths, not in positions."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">strategy</th>
                <th className="py-1.5 font-medium">effective window</th>
                <th className="py-1.5 font-medium">planes inside at target</th>
                <th className="py-1.5 font-medium">resolution retained</th>
                <th className="py-1.5 font-medium">wavelengths doubled</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.strategy} className="border-b border-line-soft">
                  <td className="py-1.5 pr-4 text-fg">{row.label}</td>
                  <td className="py-1.5 font-mono text-teal">{Math.floor(row.effectiveLength).toLocaleString()} tokens</td>
                  <td className="py-1.5 font-mono text-muted">
                    {row.insideAtTarget} / {report.totalComponents}
                  </td>
                  <td className="py-1.5 font-mono text-muted">{(row.resolution * 100).toFixed(2)}%</td>
                  <td className="py-1.5 font-mono text-muted">{row.stretched}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          Plain extrapolation keeps the trained window exactly and nothing more. Interpolation keeps the whole target,
          every plane, at a resolution cost of about{' '}
          <span className="font-mono text-fg">1/{fmt(report.scale, 1)}² ≈ {fmt(1 / (report.scale * report.scale) * 100, 3)}%</span>.
          NTK-aware scaling keeps only {report.rows[2].insideAtTarget} of {report.totalComponents} planes in range but
          leaves the one-step angular work nearly untouched — it rescales wavelengths, not positions.
        </p>
      </FigureCard>

      <FigureCard
        title="The slowest planes are the job"
        subtitle="The planes whose wavelength exceeds the trained window, with the wavelength each strategy turns it into."
        footer="Interpolation multiplies every wavelength by s and never changes a ratio between planes. NTK raises θ to the power d/(d−2), which barely moves the fast planes and stretches the slow ones past double their trained wavelength. The planes marked “never cycles” are the ones the model has no positional signal about at all; both strategies exist to give them something."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">plane i</th>
                <th className="py-1.5 font-medium">wavelength, trained</th>
                <th className="py-1.5 font-medium">under interpolation</th>
                <th className="py-1.5 font-medium">under NTK-aware</th>
                <th className="py-1.5 font-medium">in training</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {tail.map((row) => (
                <tr key={row.index} className="border-b border-line-soft">
                  <td className="py-1.5 text-muted">{row.index}</td>
                  <td className="py-1.5 text-fg">{row.trained >= 1000 ? `${(row.trained / 1000).toFixed(2)}k` : row.trained.toFixed(1)}</td>
                  <td className="py-1.5 text-muted">{row.interpolated >= 1000 ? `${(row.interpolated / 1000).toFixed(2)}k` : row.interpolated.toFixed(1)}</td>
                  <td className="py-1.5 text-muted">{row.ntk >= 1000 ? `${(row.ntk / 1000).toFixed(2)}k` : row.ntk.toFixed(1)}</td>
                  <td className="py-1.5 text-amber">{row.trained > setup.trainedLength ? 'never cycles' : 'completes'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FigureCard>

      <Callout tone="amber" title="What this view does not show">
        No model is run and no perplexity is measured here. The guarantee computed on this screen is about angles, not
        about quality: position interpolation was proposed by Chen et al. (2023, arXiv:2306.15595) and long-context
        rescaling was carried to very long windows by LongRoPE (Ding et al., 2024, arXiv:2402.13753 — the source for the
        lesson); whether an interpolated model stays coherent at the target length is an empirical question this view
        cannot answer. It answers the arithmetic one: which angles were trained, which strategies stay inside them, and
        what each charges for the privilege.
      </Callout>
    </div>
  )
}

/* --------------------------------------------- Speculative decoding */

/**
 * The draft-and-verify arm of the laboratory. The distributions, the
 * acceptance probability and the expected length are computed in
 * `src/core/speculative`; this view renders them and says what the toy
 * setup is and is not.
 */
function SpeculativeView({
  initialSettings,
  onSaveConfig,
}: {
  initialSettings?: LabSettings
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
}) {
  const [targetTemp, setTargetTemp] = useState(() => readNumber(initialSettings, 'targetTemp', DEFAULT_SPECULATIVE.targetTemp))
  const [draftTemp, setDraftTemp] = useState(() => readNumber(initialSettings, 'draftTemp', DEFAULT_SPECULATIVE.draftTemp))
  const [draftNoise, setDraftNoise] = useState(() => readNumber(initialSettings, 'draftNoise', DEFAULT_SPECULATIVE.draftNoise))
  const [draftLength, setDraftLength] = useState(() => readNumber(initialSettings, 'draftLength', DEFAULT_SPECULATIVE.draftLength))
  const [draftCost, setDraftCost] = useState(() => readNumber(initialSettings, 'draftCost', DEFAULT_SPECULATIVE.draftCost))

  const setup = useMemo<SpeculativeSetup>(
    () => ({ targetTemp, draftTemp, draftNoise, draftLength: Math.round(draftLength), draftCost }),
    [targetTemp, draftTemp, draftNoise, draftLength, draftCost],
  )
  const report = useMemo(() => speculativeReport(setup), [setup])

  const reset = () => {
    setTargetTemp(DEFAULT_SPECULATIVE.targetTemp)
    setDraftTemp(DEFAULT_SPECULATIVE.draftTemp)
    setDraftNoise(DEFAULT_SPECULATIVE.draftNoise)
    setDraftLength(DEFAULT_SPECULATIVE.draftLength)
    setDraftCost(DEFAULT_SPECULATIVE.draftCost)
  }

  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeading
          kicker="Laboratory E · speculative decoding"
          title="Draft, verify, and keep what passes"
          description="An autoregressive model emits one token per serial pass, and decode is memory-bandwidth-bound. Speculative decoding puts a small draft model in front: it proposes k tokens, the target scores the k+1 positions in one parallel pass, and each drafted token is accepted with probability min(1, p(x)/q(x)). The output distribution is exactly the target's — the check is rejection sampling, not an approximation. This view computes the acceptance probability, the expected length and the speedup for a toy draft, on a vocabulary you can read."
          action={
            <div className="flex flex-wrap gap-2">
              <ResetButton onReset={reset} label="Reset speculative lab" />
              {onSaveConfig ? (
                <Button size="sm" onClick={() => onSaveConfig?.({ view: 'speculative', targetTemp, draftTemp, draftNoise, draftLength, draftCost })}>
                  Save this configuration
                </Button>
              ) : null}
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Slider
              label="Target temperature τ_p"
              value={targetTemp}
              min={0.5}
              max={2}
              step={0.05}
              onChange={setTargetTemp}
              format={(value) => `τ = ${value.toFixed(2)}`}
            />
            <Slider
              label="Draft temperature τ_q"
              value={draftTemp}
              min={0.5}
              max={3}
              step={0.05}
              onChange={setDraftTemp}
              format={(value) => `τ = ${value.toFixed(2)}`}
            />
            <Slider
              label="Draft noise"
              value={draftNoise}
              min={0}
              max={3}
              step={0.1}
              onChange={setDraftNoise}
              format={(value) => value.toFixed(1)}
              hint="Pushes the draft's logits off the target's by this many logits, along a fixed direction."
            />
            <Slider
              label="Draft length k"
              value={draftLength}
              min={1}
              max={12}
              step={1}
              onChange={(value) => setDraftLength(Math.round(value))}
              format={(value) => `${Math.round(value)} tokens`}
            />
            <Slider
              label="Draft cost c"
              value={draftCost}
              min={0.05}
              max={0.5}
              step={0.05}
              onChange={setDraftCost}
              format={(value) => `${value.toFixed(2)}× a target pass`}
              hint="A smaller model typically costs 0.05–0.3 of the target per token."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Acceptance α"
              value={fmt(report.alpha, 4)}
              tone="indigo"
              hint="α = Σ_x min(p(x), q(x)), exact — the odds a drafted token survives verification."
            />
            <Stat
              label="Total variation"
              value={fmt(report.variation, 4)}
              tone="teal"
              hint="TV(p, q) = 1 − α."
            />
            <Stat
              label="Expected tokens / pass"
              value={fmt(expectedTokens(report.alpha, setup.draftLength), 3)}
              tone="indigo"
              hint={`At k = ${setup.draftLength}: E = (1 − α^(k+1)) / (1 − α).`}
            />
            <Stat
              label="Best k / speedup"
              value={`k = ${report.bestK} · ${fmt(report.bestSpeedup, 2)}×`}
              tone="amber"
              hint="The draft length in [1, 12] with the highest speedup under this cost model."
            />
          </div>
        </div>
        <Callout tone="indigo" title="The two identities doing the work">
          <InlineMath tex="\alpha = \sum_x \min(p(x), q(x)) = 1 - TV(p, q)" /> and{' '}
          <InlineMath tex="E = \frac{1 - \alpha^{k+1}}{1 - \alpha}" />. Rejection resampling preserves p exactly, so the
          draft can only forfeit speed, never correctness — which is why the method is safe to run on a stock model with
          no retraining.
        </Callout>
      </Panel>

      <FigureCard
        title="The vocabulary, both distributions"
        subtitle="Six tokens; the target's fixed preferences, and the toy draft's answer to them."
        footer={`α is the sum of the admitted column (${fmt(report.alpha, 4)}). The residual column is max(0, p − q) renormalised — the distribution a rejection resamples from, which is why the output is exactly p regardless of how bad the draft is.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">token</th>
                <th className="py-1.5 font-medium">target p</th>
                <th className="py-1.5 font-medium">draft q</th>
                <th className="py-1.5 font-medium">admitted min(p, q)</th>
                <th className="py-1.5 font-medium">residual on rejection</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {TOY_VOCAB.map((token, index) => (
                <tr key={token} className="border-b border-line-soft">
                  <td className="py-1.5 text-fg">{token}</td>
                  <td className="py-1.5 text-muted">{fmt(report.target[index], 4)}</td>
                  <td className="py-1.5 text-muted">{fmt(report.draft[index], 4)}</td>
                  <td className="py-1.5 text-teal">{fmt(Math.min(report.target[index], report.draft[index]), 4)}</td>
                  <td className="py-1.5 text-muted">{fmt(report.residual[index], 4)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-1.5 text-muted">Σ</td>
                <td className="py-1.5 text-muted">1</td>
                <td className="py-1.5 text-muted">1</td>
                <td className="py-1.5 text-teal">{fmt(report.alpha, 4)}</td>
                <td className="py-1.5 text-muted">{report.residual.every((value) => value === 0) ? '—' : '1'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </FigureCard>

      <FigureCard
        title="Longer drafts, diminishing returns"
        subtitle="One parallel pass costs 1 whatever it scores; each drafted token costs c."
        footer="The optimum is marked for the c you set. With a free draft the best k keeps growing; with an expensive one it collapses toward 1. The crossover — where an extra draft stops paying — is the operating point the paper's experiments land on."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">k</th>
                <th className="py-1.5 font-medium">expected tokens</th>
                <th className="py-1.5 font-medium">cost</th>
                <th className="py-1.5 font-medium">speedup</th>
                <th className="py-1.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {report.rows.map((row) => (
                <tr key={row.k} className="border-b border-line-soft">
                  <td className="py-1.5 text-fg">{row.k}</td>
                  <td className="py-1.5 text-muted">{fmt(row.expected, 3)}</td>
                  <td className="py-1.5 text-muted">{fmt(row.cost, 2)}</td>
                  <td className="py-1.5 text-teal">{fmt(row.speedup, 3)}×</td>
                  <td className="py-1.5">{row.k === report.bestK ? <Badge tone="teal">best</Badge> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FigureCard>

      <Callout tone="amber" title="What this view does not show">
        The draft here is a temperature-and-noise perturbation of the target's own logits — a stand-in for a smaller
        model, not one. The formulae above are exact; what is toy is the choice of distributions, not the arithmetic.
        Nothing is timed on this screen and no throughput claim is made: batching, memory bandwidth and kernel effects
        are absent by construction, and one parallel pass is counted as 1 however many positions it scores. Leviathan,
        Kalman and Matias (2023, arXiv:2211.17192, ICML 2023 Oral; the record the catalogue verified on 2026-11-03)
        report 2–3× on T5-XXL — quoted, not measured, and a different setting from this one.
      </Callout>
    </div>
  )
}

/* ------------------------------------------------------------- Search */

function ReasoningTreeFigure({ tree, selected }: { tree: ReasoningNode[]; selected: string[] }) {
  const nodes = tree.filter((node) => node.id !== 'root')
  const width = 660
  const height = 300
  const positions = new Map<string, { x: number; y: number }>()
  positions.set('root', { x: 60, y: height / 2 })
  const branches = nodes.filter((node) => node.parentId === 'root')
  branches.forEach((node, index) => {
    const y = ((index + 0.5) / branches.length) * height
    positions.set(node.id, { x: 260, y })
    const children = nodes.filter((child) => child.parentId === node.id)
    children.forEach((child, childIndex) => {
      positions.set(child.id, { x: 460, y: y + (childIndex - (children.length - 1) / 2) * 60 })
    })
  })

  const chosenPath = new Set<string>()
  if (selected[0]) {
    for (const node of pathToNode(tree, selected[0])) chosenPath.add(node.id)
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Reasoning tree figure">
      {nodes.map((node) => {
        const from = positions.get(node.parentId ?? 'root')
        const to = positions.get(node.id)
        if (!from || !to) return null
        const onPath = chosenPath.has(node.id) && chosenPath.has(node.parentId ?? '')
        return (
          <line
            key={`edge-${node.id}`}
            x1={from.x + 34}
            y1={from.y}
            x2={to.x - 34}
            y2={to.y}
            stroke={onPath ? 'var(--teal)' : 'var(--line)'}
            strokeWidth={onPath ? 2.5 : 1.5}
          />
        )
      })}
      {tree.map((node) => {
        const position = positions.get(node.id)
        if (!position) return null
        const onPath = chosenPath.has(node.id)
        return (
          <g key={node.id}>
            <rect
              x={position.x - 34}
              y={position.y - 16}
              width={68}
              height={32}
              rx={9}
              fill={onPath ? 'color-mix(in oklab, var(--teal) 25%, transparent)' : 'var(--panel-2)'}
              stroke={node.correct ? 'var(--teal)' : node.terminal ? 'var(--rose)' : 'var(--line)'}
              strokeWidth={onPath ? 2 : 1}
            />
            <text x={position.x} y={position.y + 4} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--fg)">
              {node.id} · {node.score.toFixed(2)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function SearchView({
  initialSettings,
  onSaveConfig,
}: {
  initialSettings?: LabSettings
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
}) {
  const tree = useMemo(() => buildToyReasoningTree(), [])
  const [beamWidth, setBeamWidth] = useState(() => readNumber(initialSettings, 'beamWidth', 3))
  const [n, setN] = useState(() => readNumber(initialSettings, 'n', 4))
  const [temperature, setTemperature] = useState(() => readNumber(initialSettings, 'temperature', 1))
  const [seed, setSeed] = useState(() => readNumber(initialSettings, 'seed', 7))
  const [strategy, setStrategy] = useState<'greedy' | 'beam' | 'best-of-n'>(() =>
    readOneOf(initialSettings, 'strategy', ['greedy', 'beam', 'best-of-n'] as const, 'beam'),
  )

  const greedy = useMemo(() => beamSearch(tree, 1), [tree])
  const beam = useMemo(() => beamSearch(tree, beamWidth), [tree, beamWidth])
  const sampled = useMemo(() => bestOfN(tree, n, temperature, seed), [tree, n, temperature, seed])

  const active: SearchResult = strategy === 'greedy' ? greedy : strategy === 'beam' ? beam : sampled
  const node = active.selected[0] ? tree.find((item) => item.id === active.selected[0]) : undefined
  const path = active.selected[0] ? pathToNode(tree, active.selected[0]) : []

  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeading
          kicker="Laboratory E · search"
          title="Reasoning paths, verification and cost"
          description="A synthetic step tree for a single arithmetic problem, searched for real. The verifier scores are hand-chosen, so the strategies can be compared on identical inputs, and the cost column counts the verifier calls each strategy actually spent."
          action={
            onSaveConfig ? (
            <Button
              size="sm"
              onClick={() => onSaveConfig?.({ view: 'search', beamWidth, n, temperature, seed, strategy })}
            >
              Save this configuration
            </Button>
          ) : null
          }
        />
        <div className="split-side">
          <div className="space-y-3">
            <SegmentedControl
              label="Strategy"
              value={strategy}
              onChange={setStrategy}
              options={[
                { value: 'greedy', label: 'greedy (beam 1)' },
                { value: 'beam', label: 'beam search' },
                { value: 'best-of-n', label: 'best-of-n sampling' },
              ]}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Slider label="Beam width" value={beamWidth} min={1} max={4} onChange={setBeamWidth} />
              <Slider label="n samples" value={n} min={1} max={12} onChange={setN} />
              <Slider
                label="Sampling temperature"
                value={temperature}
                min={0.2}
                max={3}
                step={0.1}
                onChange={setTemperature}
                format={(value) => value.toFixed(1)}
              />
              <Slider label="Sampling seed" value={seed} min={1} max={30} onChange={setSeed} format={(v) => `#${v}`} />
            </div>
          </div>
          <div className="split-2-tight">
            <Stat
              label="Selected terminal"
              value={node ? node.id : '—'}
              tone={node?.correct ? 'positive' : 'rose'}
              hint={node ? (node.correct ? 'correct answer' : 'incorrect answer') : undefined}
            />
            <Stat label="Verifier calls spent" value={active.expansions} tone="amber" />
            <Stat label="Depth reached" value={active.depth} />
            <Stat label="Nodes scored" value={active.verified.length} tone="teal" />
          </div>
        </div>
      </Panel>

      <FigureCard
        title="The search tree"
        subtitle="Green borders mark correct terminal nodes; red marks wrong terminals. The highlighted path is the one the current strategy selected."
        footer="Scores are given, not learned. A wrong-but-confident branch is exactly the failure mode a real verifier can produce."
      >
        <ReasoningTreeFigure tree={tree} selected={active.selected} />
        <div className="mt-3 space-y-1.5">
          {path.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-xs">
              <span className="w-10 font-mono text-faint">{item.id}</span>
              <span className="flex-1 text-fg">{item.label}</span>
              <span className="font-mono text-muted">score {item.score.toFixed(2)}</span>
              {item.terminal ? (
                item.correct ? (
                  <Badge tone="teal">correct</Badge>
                ) : (
                  <Badge tone="rose">wrong</Badge>
                )
              ) : null}
            </div>
          ))}
        </div>
      </FigureCard>

      <FigureCard
        title="Accuracy against verification budget"
        subtitle="All three strategies run on the same tree; the only difference is how they spend calls."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">strategy</th>
                <th className="py-1.5 font-medium">selected</th>
                <th className="py-1.5 font-medium">correct</th>
                <th className="py-1.5 font-medium">verifier calls</th>
                <th className="py-1.5 font-medium">calls per correct answer</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[
                { label: 'greedy (beam 1)', result: greedy },
                { label: `beam width ${beamWidth}`, result: beam },
                { label: `best-of-${n} @ τ=${temperature.toFixed(1)} seed ${seed}`, result: sampled },
              ].map((row) => (
                <tr key={row.label} className="border-b border-line-soft">
                  <td className="py-1.5 text-fg">{row.label}</td>
                  <td className="py-1.5 text-muted">{row.result.selected[0] ?? '—'}</td>
                  <td className="py-1.5">
                    {row.result.correct ? <span className="text-teal">yes</span> : <span className="text-rose">no</span>}
                  </td>
                  <td className="py-1.5 text-muted">{row.result.expansions}</td>
                  <td className="py-1.5 text-amber">
                    {row.result.correct ? (row.result.expansions / 1).toFixed(0) : '∞'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="amber" title="The lesson in the numbers">
          Greedy spends the fewest calls and commits to the branch that looks best at step one — which, on this tree, is
          wrong. A wider beam spends more calls and finds the correct path. Best-of-n depends on how well the sampling
          distribution covers the correct branch; set the temperature very low and it degenerates toward greedy.
        </Callout>
      </FigureCard>

      <FigureCard
        title="Outcome rewards versus verifiable rewards"
        subtitle="The same tree scored with a step verifier versus only the final answer."
      >
        <ul className="space-y-2 text-sm text-muted">
          <li>
            <Badge tone="teal">step verifier</Badge> Scores every partial solution, so search can prune early. Cost: a
            reliable step-level scorer, which is itself a trained model or a human process.
          </li>
          <li>
            <Badge tone="amber">outcome only</Badge> Scores only terminals. Cheap and unambiguous, but the search must
            finish a path to learn anything, and credit assignment across steps is unresolved.
          </li>
          <li>
            <Badge tone="rose">miscalibrated verifier</Badge> A scorer that rewards confident wrong steps is worse than
            no scorer: search optimises it faithfully and finds the wrong answer more reliably.
          </li>
        </ul>
      </FigureCard>
    </div>
  )
}

/* ------------------------------------------------------------- Evaluation */

function EvaluationView({
  initialSettings,
  onSaveConfig,
}: {
  initialSettings?: LabSettings
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
}) {
  const [includeCost, setIncludeCost] = useState(() => readBoolean(initialSettings, 'includeCost', true))
  const reports = useMemo(() => evaluateProtocols(SYNTHETIC_RESULTS), [])
  const tokens = SYNTHETIC_RESULTS.reduce((sum, result) => sum + result.tokens, 0)

  return (
    <div className="space-y-5">
      <FigureCard
        title="The same results, three protocols"
        subtitle="Ten synthetic questions with known answer correctness, step soundness and token cost."
        footer="The data are synthetic so that the ground truth is visible. What is real is the arithmetic: the three numbers differ because the protocols ask different questions."
        actions={
          onSaveConfig ? (
            <Button size="sm" onClick={() => onSaveConfig?.({ view: 'evaluation', includeCost })}>
              Save this configuration
            </Button>
          ) : null
        }
      >
        <div className="split-3-tight">
          {reports.map((report) => (
            <Stat
              key={report.protocol}
              label={report.label}
              value={report.protocol === 'cost-adjusted' ? fmt(report.score, 4) : `${(report.score * 100).toFixed(1)}%`}
              tone={report.protocol === 'process' ? 'teal' : report.protocol === 'outcome' ? 'indigo' : 'amber'}
              hint={report.detail}
            />
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">question</th>
                <th className="py-1.5 font-medium">answer</th>
                <th className="py-1.5 font-medium">steps</th>
                <th className="py-1.5 font-medium">tokens</th>
                <th className="py-1.5 font-medium">counts as correct under</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {SYNTHETIC_RESULTS.map((result) => (
                <tr key={result.id} className="border-b border-line-soft">
                  <td className="py-1.5 text-fg">{result.id}</td>
                  <td className="py-1.5">{result.answerCorrect ? '✓' : '✗'}</td>
                  <td className="py-1.5">{result.stepsSound ? 'sound' : 'unsound'}</td>
                  <td className="py-1.5 text-muted">{result.tokens}</td>
                  <td className="py-1.5 text-muted">
                    {result.answerCorrect ? 'outcome' : '—'}
                    {result.answerCorrect && result.stepsSound ? ' + process' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          Total generated tokens across the run: <span className="font-mono text-fg">{tokens.toLocaleString()}</span>.
          {includeCost
            ? ' The cost-adjusted column divides by this total, so a method that writes longer traces has to be more accurate to win.'
            : ' Turn the cost view on to see the third column.'}
        </p>
        <div className="mt-3">
          <Toggle
            label="Show the cost-adjusted reading"
            checked={includeCost}
            onChange={setIncludeCost}
            hint="Cost adjustment changes the ranking whenever two methods differ in verbosity."
          />
        </div>
      </FigureCard>

      <FigureCard title="What each protocol hides" subtitle="The methodological point the source raises.">
        <ul className="space-y-3 text-sm text-muted">
          <li>
            <span className="font-medium text-fg">Outcome-only</span> counts r3 and r4 (correct answers from unsound
            steps) as successes. A model that guesses well looks like a model that reasons well.
          </li>
          <li>
            <span className="font-medium text-fg">Process-aware</span> refuses to count them, but needs step labels —
            which are expensive and themselves contestable.
          </li>
          <li>
            <span className="font-medium text-fg">Cost-adjusted</span> exposes the trade-off that longer thinking is only
            worth it when the accuracy gain outpaces the token cost.
          </li>
        </ul>
        <Callout tone="indigo" title="Benchmark hygiene">
          Whatever protocol you pick, fix it before you look at the results, hold the compute budget constant across
          methods, and check for contamination. A number without its protocol is not evidence.
        </Callout>
      </FigureCard>

      <RiskCategoriesCard />
    </div>
  )
}

/**
 * The eight categories a foundation model is judged on, scored for three
 * parameter settings. The scores are arithmetic on those parameters, not
 * measurements of any system.
 */
function RiskCategoriesCard() {
  const profiles = useMemo(() => riskProfiles(), [])

  return (
    <FigureCard
      title="The eight risk categories"
      subtitle="A model is not one number. Three parameter settings, scored on every category the course checks."
      footer="The values come from the capability and care parameters shown in the header, not from a benchmark run. The point of the table is the shape: a model can improve accuracy and worsen efficiency, or improve toxicity and leave privacy where it was, and no single score says which of those happened."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line text-faint">
              <th className="py-1.5 font-medium">category</th>
              <th className="py-1.5 font-medium">the question</th>
              {profiles.map((profile) => (
                <th key={profile.name} className="py-1.5 font-medium">
                  {profile.name}
                </th>
              ))}
              <th className="py-1.5 font-medium">good direction</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {RISK_CATEGORIES.map((category, index) => (
              <tr key={category.id} className="border-b border-line-soft">
                <td className="py-1.5 text-fg">{category.name}</td>
                <td className="py-1.5 text-muted">{category.question}</td>
                {profiles.map((profile) => {
                  const score = profile.scores[index]!
                  return (
                    <td key={profile.name} className={score.lowerIsBetter ? 'py-1.5 text-amber' : 'py-1.5 text-teal'}>
                      {(score.value * 100).toFixed(0)}%
                    </td>
                  )
                })}
                <td className="py-1.5 text-muted">{category.measure}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        The three settings are parameter choices: a small model, a large one, and the same large model with more care
        spent on safety and privacy. The eight categories are the axes this course uses; HELM, the standard
        implementation, measures seven of them — all but privacy — on a common set of scenarios.
      </p>
      <Callout tone="amber" title="Why eight numbers instead of one">
        A single average over these axes weights them equally, which is a choice nobody made deliberately. A deployment
        that cannot leak training data and one that can trade a little privacy for accuracy need different models, and a
        table is the only honest way to show both.
      </Callout>
    </FigureCard>
  )
}

export default InferenceLab
