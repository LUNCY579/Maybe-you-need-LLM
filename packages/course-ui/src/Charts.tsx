import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ReactNode } from 'react'

/**
 * The chart wrappers.
 *
 * The course's rule is that a chart is never the only way to see a number.
 * Every figure carries a caption that says what is measured and what is
 * analytic, and the laboratory screens offer a table of the same data.
 */

const AXIS = { stroke: 'currentColor', fontSize: 11, opacity: 0.75 }
const GRID = { stroke: 'currentColor', opacity: 0.12 }

export interface Series {
  key: string
  name: string
  colour: string
  dashed?: boolean
}

export interface ChartPoint {
  /** The horizontal value. The key it is stored under is set by `xKey`. */
  x?: number
  [key: string]: number | string | null | boolean | undefined
}

export function TrendChart({
  data,
  series,
  xLabel,
  yLabel,
  xKey = 'x',
  yDomain,
  referenceLines = [],
  height = 260,
  children,
}: {
  data: ChartPoint[]
  series: Series[]
  xLabel: string
  yLabel: string
  /** The key in each point that holds the horizontal value. */
  xKey?: string
  yDomain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax']
  referenceLines?: { x?: number; y?: number; label: string }[]
  height?: number
  children?: ReactNode
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 4 }}>
        <CartesianGrid {...GRID} />
        <XAxis
          dataKey={xKey}
          tick={AXIS}
          label={{ value: xLabel, position: 'insideBottom', offset: -2, fontSize: 11 }}
        />
        <YAxis tick={AXIS} label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11 }} domain={yDomain} />
        <Tooltip
          contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          labelFormatter={(value) => `${xLabel}: ${value}`}        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {referenceLines.map((line) =>
          line.x !== undefined ? (
            <ReferenceLine key={line.label} x={line.x} stroke="var(--accent-amber)" strokeDasharray="4 3" label={{ value: line.label, fontSize: 10, position: 'insideTopRight' }} />
          ) : (
            <ReferenceLine key={line.label} y={line.y} stroke="var(--accent-amber)" strokeDasharray="4 3" label={{ value: line.label, fontSize: 10, position: 'insideTopRight' }} />
          ),
        )}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.colour}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '5 4' : undefined}
            dot={false}
            isAnimationActive={false}
          />
        ))}
        {children}
      </LineChart>
    </ResponsiveContainer>
  )
}

export interface Point {
  x: number
  y: number
  group?: string
  label?: string
}

export function PointChart({
  points,
  series,
  xLabel,
  yLabel,
  height = 320,
  referencePoints,
  domain,
}: {
  points: Point[]
  series: { key: string; name: string; colour: string }[]
  xLabel: string
  yLabel: string
  height?: number
  referencePoints?: Point[]
  domain?: [[number, number], [number, number]]
}) {
  const grouped = series.map((s) => ({
    ...s,
    data: points.filter((p) => (p.group ?? series[0].key) === s.key),
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 4 }}>
        <CartesianGrid {...GRID} />
        <XAxis
          type="number"
          dataKey="x"
          name={xLabel}
          tick={AXIS}
          label={{ value: xLabel, position: 'insideBottom', offset: -2, fontSize: 11 }}
          domain={domain?.[0] ?? ['auto', 'auto']}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yLabel}
          tick={AXIS}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11 }}
          domain={domain?.[1] ?? ['auto', 'auto']}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(value, name) => [
            typeof value === 'number' ? value.toFixed(3) : String(value),
            String(name),
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {referencePoints ? (
          <Scatter data={referencePoints} fill="none" name="Reference" shape={() => <circle r={5} fill="none" stroke="var(--accent-amber)" strokeWidth={2} />} />
        ) : null}
        {grouped.map((s) => (
          <Scatter key={s.key} name={s.name} data={s.data} fill={s.colour} isAnimationActive={false} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}

/** A table of the same data a chart shows, so the numbers are always reachable. */
export function DataTable({
  headers,
  rows,
  caption,
}: {
  headers: string[]
  rows: (string | number)[][]
  caption: string
}) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
