import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  attentionCost,
  resamplerAttention,
  resamplerOutput,
  resamplerReport,
  resolutionSweep,
  tokenBound,
  visualTokens,
} from '../../core/flamingo'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'bound' | 'attention'

const mill = (value: number) => {
  if (value >= 1_000_000) return `${fmt(value / 1_000_000, 1)} M`
  if (value >= 1_000) return `${fmt(value / 1_000, 1)} k`
  return String(value)
}

export function ResamplerLab() {
  const [view, setView] = useState<View>('bound')
  const [latents, setLatents] = useState(32)
  const [tokens, setTokens] = useState(64)
  const [width, setWidth] = useState(32)
  const [temperature, setTemperature] = useState(0.2)
  const [selected, setSelected] = useState(0)

  const active = Math.min(selected, latents - 1)
  const options = { latents, tokens, width, temperature, seed: 13 }

  const attention = useMemo(
    () => resamplerAttention(options),
    [latents, tokens, width, temperature],
  )
  const output = useMemo(() => resamplerOutput(options), [latents, tokens, width, temperature])
  const weights = attention[active] ?? []
  const peak = Math.max(...weights, 1e-9)
  const report = resamplerReport(weights)
  const bound = tokenBound({ latents, tokens })
  const cost = attentionCost(tokens, latents, width)
  const sweep = resolutionSweep(latents)

  const costRows = sweep.map((point) => {
    const row = attentionCost(point.visualTokens, latents, width)
    return [
      String(point.resolution),
      point.visualTokens.toLocaleString(),
      String(point.resampledTokens),
      `${fmt(point.compression, 1)}×`,
      `${fmt(row.ratio * 100, 1)}%`,
    ]
  })

  const valueRange = useMemo(() => {
    const tokensIn = visualTokens({ tokens, width, seed: 13 })
    const column = tokensIn.map((token) => token[0] ?? 0)
    return {
      low: Math.min(...column),
      high: Math.max(...column),
      mean: column.reduce((sum, value) => sum + value, 0) / Math.max(1, column.length),
      resampled: output[0]?.[0] ?? 0,
    }
  }, [tokens, width, output])

  return (
    <div className="lab">
      <Panel
        title="Laboratory E · The resampler"
        subtitle="A fixed number of latents, and a visual token count that cannot outgrow them"
        accent="emerald"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'bound', label: 'The bound' },
              { value: 'attention', label: 'The reading' },
            ]}
          />
          <Slider label="The learned latents" value={latents} min={4} max={64} step={4} onChange={setLatents} />
          <Slider label="The visual tokens" value={tokens} min={16} max={128} step={16} onChange={setTokens} />
          <Slider label="The width" value={width} min={16} max={64} step={16} onChange={setWidth} />
          <Slider
            label="The attention temperature"
            value={temperature}
            min={0.05}
            max={1}
            step={0.05}
            onChange={setTemperature}
            format={(value) => value.toFixed(2)}
            hint="How sharply a latent chooses among the tokens."
          />
          <Slider label="The latent to inspect" value={active} min={0} max={latents - 1} onChange={setSelected} />
        </div>

        <div className="stat-row">
          <Stat label="Visual tokens in" value={String(bound.inputTokens)} hint="the frozen encoder's output" />
          <Stat label="Tokens out" value={String(bound.outputTokens)} hint="one per latent, always" tone="good" />
          <Stat label="Compression" value={`${fmt(bound.compression, 1)}×`} />
          <Stat
            label="Cost against self-attention"
            value={`${fmt(cost.ratio * 100, 1)}%`}
            hint={`${mill(cost.crossAttention)} against ${mill(cost.tokenSelfAttention)} multiply-adds`}
            tone="good"
          />
        </div>

        {view === 'bound' ? (
          <>
            <Figure
              title="The token count, as the image grows"
              description="The visual tokens a patch grid produces at four resolutions, and the tokens the language model reads after the resampler, plotted as log₂ of the count so the flat line stays visible."
              caption="The visual count grows with the square of the resolution; the resampled count does not move, because it is the number of latents and nothing else. This is the bound the method is built on: a model with a fixed context does not have to know how large the image was."
            >
              <TrendChart
                data={sweep.map((point) => ({
                  x: point.resolution,
                  visual: Math.log2(point.visualTokens),
                  resampled: Math.log2(point.resampledTokens),
                }))}
                series={[
                  { key: 'visual', name: 'the visual tokens', colour: 'var(--accent-rose)' },
                  { key: 'resampled', name: 'after the resampler', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the image resolution, in pixels"
                yLabel="log₂ of the token count"
                height={260}
              />
            </Figure>

            <DataTable
              caption="The same bound at four resolutions"
              headers={['Resolution', 'Visual tokens', 'Tokens out', 'Compression', 'Cost ratio']}
              rows={costRows}
            />

            <Callout tone="definition" title="Why the bound is structural">
              The last layer of the resampler has one output vector per latent, so the output length is the number of
              latents whatever the input. Nothing is selected away, and nothing is pooled by an average: each latent
              reads every token with its own attention weights, and the token information is compressed into the
              latents rather than dropped. Move the latents slider and the bound moves; change the image and it does
              not.
            </Callout>

            <Callout tone="note" title="What the cost comparison is worth">
              The cross-attention touches every visual token once per latent, so its arithmetic is linear in the token
              count. Attention over the raw tokens would be quadratic, because every token would have to look at every
              other. With {latents} latents against {tokens} tokens the cross-attention is{' '}
              {fmt(cost.ratio * 100, 1)}% of the alternative here, and the ratio is exactly latents over tokens. A real
              resampler also has learned values and several layers; the shape of the saving is the same.
            </Callout>
          </>
        ) : null}

        {view === 'attention' ? (
          <>
            <Figure
              title={`Latent ${active}, over the ${tokens} visual tokens`}
              description="The cross-attention of one latent on the frozen encoder's token sequence."
              caption="Each latent reads the whole sequence and chooses among it. The latents are the learned part of this path; the tokens come from a frozen encoder, and the attention here is hand-wired from seeded vectors rather than trained."
            >
              <div className="field">
                <span className="field-label">The attention, token by token</span>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }} role="group" aria-label="The token attention">
                  {weights.map((weight, index) => (
                    <div
                      key={index}
                      style={{
                        width: 30,
                        padding: '3px 1px',
                        borderRadius: 5,
                        textAlign: 'center',
                        border: index === report.topToken ? '2px solid var(--accent-emerald)' : '1px solid var(--border)',
                        background: `color-mix(in srgb, var(--accent-emerald) ${Math.round((weight / peak) * 28)}%, transparent)`,
                        color: 'var(--text)',
                        fontSize: 9,
                      }}
                      title={`token ${index}: ${fmt(weight, 4)}`}
                    >
                      <strong style={{ display: 'block', fontSize: 10 }}>{index}</strong>
                      <span style={{ display: 'block' }}>{fmt(weight, 2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <DataTable
                caption={`What latent ${active} does`}
                headers={['The measurement', 'The value']}
                rows={[
                  ['the token it attends to most', `token ${report.topToken}`],
                  ['the weight there', fmt(report.topWeight, 4)],
                  ['tokens above twice the uniform share', `${report.aboveChance} of ${tokens}`],
                  ['the entropy of its attention', `${fmt(report.entropy, 3)} nats`],
                  ['the most the entropy could be', `${fmt(report.maximumEntropy, 3)} nats`],
                ]}
              />
            </Figure>

            <Figure
              title="The output is bounded by the tokens it read"
              description="The first coordinate of every visual token, the same coordinate of the first output vector, and the two ends of the range."
              caption="The output is a convex combination of the token vectors: the attention rows are non-negative and sum to one, so every coordinate of the output lies between the smallest and the largest value the tokens had in that coordinate. The resampler cannot invent a coordinate the encoder never produced, which is a property of the softmax and not of the weights."
            >
              <DataTable
                caption="Coordinate 0 of the tokens, and of the first latent's output"
                headers={['The quantity', 'The value']}
                rows={[
                  ['the smallest token value', fmt(valueRange.low, 4)],
                  ['the mean token value', fmt(valueRange.mean, 4)],
                  ['the largest token value', fmt(valueRange.high, 4)],
                  ['the output’s value', fmt(valueRange.resampled, 4)],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="What this toy is, and what it is not">
              The latents and the tokens are seeded vectors, the values are the tokens themselves, and the attention
              is computed rather than learned. What is not a toy is the shape of the path: a frozen encoder produces a
              variable number of tokens, a fixed set of latents reads them, and the language model receives a fixed
              number of vectors. The bound, the convexity and the cost are all consequences of that shape.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
