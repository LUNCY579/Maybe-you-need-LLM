import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ReactNode } from 'react'

export interface SeriesPoint {
  x: number | string
  /** Series may contain nulls to create gaps (for example a diverged run). */
  [key: string]: number | string | null | undefined
}

/** Multi-series line chart used for loss trajectories. */
export function LineChartPanel({
  data,
  series,
  xLabel,
  yLabel,
  height = 260,
  referenceY,
}: {
  data: SeriesPoint[]
  series: { key: string; label: string; color: string; dashed?: boolean }[]
  xLabel?: string
  yLabel?: string
  height?: number
  referenceY?: number
}) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line-soft)" />
          <XAxis dataKey="x" tickLine={false} label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -2, fill: 'var(--faint)', fontSize: 11 } : undefined} />
          <YAxis tickLine={false} domain={['auto', 'auto']} label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--faint)', fontSize: 11 } : undefined} />
          <Tooltip
            contentStyle={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              fontSize: 12,
              color: 'var(--fg)',
            }}
            labelFormatter={(value) => `step ${String(value)}`}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }} />
          {referenceY !== undefined ? <ReferenceLine y={referenceY} stroke="var(--faint)" strokeDasharray="4 4" /> : null}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Horizontal probability bars. Used for token distributions, where the labels
 * are text and the values must be readable to three decimals.
 */
export function TokenDistributionChart({
  items,
  height = 300,
  highlight,
  valueLabel = 'probability',
  emptyMessage = 'No candidates to display.',
}: {
  items: { token: string; probability: number; filtered?: boolean }[]
  height?: number
  highlight?: string
  valueLabel?: string
  emptyMessage?: string
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-faint">{emptyMessage}</p>
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={items} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--line-soft)" />
          <XAxis type="number" domain={[0, 1]} tickFormatter={(v: number) => v.toFixed(2)} hide />
          <YAxis
            type="category"
            dataKey="token"
            width={92}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
          />
          <Tooltip
            formatter={(value) => [Number(value).toFixed(4), valueLabel] as [string, string]}
            contentStyle={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              fontSize: 12,
              color: 'var(--fg)',
            }}
          />
          <Bar dataKey="probability" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            {items.map((item) => (
              <Cell
                key={item.token}
                fill={
                  item.token === highlight
                    ? 'var(--amber)'
                    : item.filtered
                      ? 'var(--line)'
                      : 'var(--teal)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Small labelled atom for figures: title, subtitle, body, optional footer. */
export function FigureCard({
  title,
  subtitle,
  children,
  footer,
  actions,
  className = '',
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <figure
      className={`rounded-2xl border border-line bg-panel/70 p-4 ${className}`}
      data-testid="figure-card"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <figcaption className="font-display text-sm font-semibold text-fg">{title}</figcaption>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
      {footer ? <div className="mt-3 border-t border-line-soft pt-2 text-xs text-faint">{footer}</div> : null}
    </figure>
  )
}
