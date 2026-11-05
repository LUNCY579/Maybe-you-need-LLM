import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  OPT_6_7B,
  VIT_BASE,
  bridgeAttention,
  parameterBudget,
  queryReport,
} from '../../core/blip2'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'attention' | 'budget'

const mill = (value: number) => `${fmt(value / 1_000_000, 1)} M`
const count = (value: number) => value.toLocaleString()

export function FrozenLab() {
  const [view, setView] = useState<View>('attention')
  const [queries, setQueries] = useState(16)
  const [patches, setPatches] = useState(32)
  const [width, setWidth] = useState(64)
  const [temperature, setTemperature] = useState(0.2)
  const [selected, setSelected] = useState(0)

  const attention = useMemo(
    () => bridgeAttention({ queries, patches, width, temperature, seed: 7 }),
    [queries, patches, width, temperature],
  )

  const active = Math.min(selected, queries - 1)
  const weights = attention[active] ?? []
  const peak = Math.max(...weights, 1e-9)
  const report = queryReport(weights)
  const budget = useMemo(() => parameterBudget({ width, queries }), [width, queries])

  const budgetCurve = useMemo(
    () =>
      [32, 64, 128, 256].map((size) => {
        const row = parameterBudget({ width: size, queries })
        return {
          x: size,
          trainable: row.trainable / 1_000_000,
          frozen: row.frozen / 1_000_000,
        }
      }),
    [queries],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory D · The frozen bridge"
        subtitle="Two towers that do not move, and the small part that does"
        accent="teal"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'attention', label: 'The queries' },
              { value: 'budget', label: 'The bill' },
            ]}
          />
          <Slider label="The learned queries" value={queries} min={4} max={32} step={4} onChange={setQueries} />
          <Slider label="The patch tokens" value={patches} min={16} max={64} step={16} onChange={setPatches} />
          <Slider label="The bridge width" value={width} min={32} max={128} step={32} onChange={setWidth} />
          <Slider
            label="The attention temperature"
            value={temperature}
            min={0.05}
            max={1}
            step={0.05}
            onChange={setTemperature}
            format={(value) => value.toFixed(2)}
            hint="How sharply a query chooses among the patches."
          />
          <Slider label="The query to inspect" value={active} min={0} max={queries - 1} onChange={setSelected} />
        </div>

        <div className="stat-row">
          <Stat label="The trainable parameters" value={mill(budget.trainable)} hint="queries, one attention block, the projection" tone="good" />
          <Stat label="The frozen parameters" value={`${fmt(budget.frozen / 1_000_000_000, 2)} B`} hint="the two towers" />
          <Stat label="The trainable share" value={`${fmt(budget.share * 100, 3)}%`} tone="warn" />
          <Stat
            label={`Query ${active} attends to`}
            value={`patch ${report.topPatch}`}
            hint={`weight ${fmt(report.topWeight, 3)}`}
          />
        </div>

        {view === 'attention' ? (
          <>
            <Figure
              title={`Query ${active}, over the ${patches} patch tokens`}
              description="The cross-attention of one learned query on the frozen image encoder’s patch tokens."
              caption="Each query reads every patch, and chooses among them. The queries are the only part of this path that is trained: the patches come from a frozen encoder, and the attention itself is hand-wired here rather than learned."
            >
              <div className="field">
                <span className="field-label">The attention, patch by patch</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} role="group" aria-label="The patch attention">
                  {weights.map((weight, index) => (
                    <div
                      key={index}
                      style={{
                        width: 42,
                        padding: '4px 2px',
                        borderRadius: 6,
                        textAlign: 'center',
                        border: index === report.topPatch ? '2px solid var(--accent-teal)' : '1px solid var(--border)',
                        background: `color-mix(in srgb, var(--accent-teal) ${Math.round((weight / peak) * 28)}%, transparent)`,
                        color: 'var(--text)',
                        fontSize: 10,
                      }}
                      title={`patch ${index}: ${fmt(weight, 4)}`}
                    >
                      <strong style={{ display: 'block', fontSize: 11 }}>{index}</strong>
                      <span style={{ display: 'block' }}>{fmt(weight, 2)}</span>
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'block',
                          height: 3,
                          marginTop: 2,
                          borderRadius: 2,
                          background: 'var(--accent-teal)',
                          opacity: Math.max(0.15, weight / peak),
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <DataTable
                caption={`What query ${active} does`}
                headers={['The measurement', 'The value']}
                rows={[
                  ['patches it attends to most', `patch ${report.topPatch}`],
                  ['the weight there', fmt(report.topWeight, 4)],
                  ['patches above twice the uniform share', `${report.aboveChance} of ${patches}`],
                  ['the entropy of its attention', `${fmt(report.entropy, 3)} nats`],
                  ['the most the entropy could be', `${fmt(report.maximumEntropy, 3)} nats`],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="What this toy is, and what it is not">
              The attention here is computed from seeded vectors, not learned, and the patch tokens are synthetic. What
              is not a toy is the shape of the path: a frozen encoder produces the patches, a small set of queries
              reads them, and only the queries and the bridge around them are trained. The next view prices that.
            </Callout>
          </>
        ) : null}

        {view === 'budget' ? (
          <>
            <Figure
              title="The bill, as the bridge widens"
              description="The trainable and the frozen parameters, in millions, for four bridge widths."
              caption="The trainable curve is the one that moves; the frozen line is the two towers and does not care what the bridge does. That is the whole architecture: the part that changes is small, and the part that is expensive is held still."
            >
              <TrendChart
                data={budgetCurve}
                series={[
                  { key: 'trainable', name: 'trainable, in millions', colour: 'var(--accent-teal)' },
                  { key: 'frozen', name: 'frozen, in millions', colour: 'var(--accent-rose)', dashed: true },
                ]}
                xLabel="the bridge width"
                yLabel="parameters, in millions"
                height={250}
              />
            </Figure>

            <DataTable
              caption="The parameter bill, by width"
              headers={['Width', 'Queries', 'Attention', 'Projection', 'Trainable', 'Frozen', 'Share']}
              rows={[32, 64, 128, 256].map((size) => {
                const row = parameterBudget({ width: size, queries })
                return [
                  size,
                  count(row.queryParameters),
                  count(row.attentionParameters),
                  count(row.projectionParameters),
                  count(row.trainable),
                  count(row.frozen),
                  `${fmt(row.share * 100, 3)}%`,
                ]
              })}
            />

            <Callout tone="definition" title="Where the numbers come from">
              The accounting is one attention block (four width×width matrices), the queries themselves, and the
              projection into the language model’s token space. The frozen side is assumed to be a{' '}
              {mill(VIT_BASE)} image encoder and a {fmt(OPT_6_7B / 1_000_000_000, 1)} B language model — the sizes of
              the checkpoints this kind of method is built on. A real Q-Former stacks many blocks, so the trainable
              side is larger than this toy says; the point is its order of magnitude beside the frozen side, which the
              table shows without needing the exact count.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
