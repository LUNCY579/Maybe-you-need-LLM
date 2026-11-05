import { fmt } from '../../core/math'

/** Diverging/sequential colour ramp used by every matrix figure in the course. */
function rampColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  // Three-stop ramp: deep indigo → teal → amber.
  const stops: [number, [number, number, number]][] = [
    [0, [30, 41, 82]],
    [0.5, [45, 212, 191]],
    [1, [251, 191, 36]],
  ]
  if (clamped <= 0.5) {
    const k = clamped / 0.5
    return rgb(mix(stops[0][1], stops[1][1], k))
  }
  const k = (clamped - 0.5) / 0.5
  return rgb(mix(stops[1][1], stops[2][1], k))
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function rgb([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`
}

export interface HeatmapProps {
  matrix: number[][]
  rowLabels?: string[]
  colLabels?: string[]
  /** Fixed colour range; defaults to the observed min/max of the matrix. */
  domain?: [number, number]
  /** Cells the learner may want highlighted (for example the masked triangle). */
  dimmed?: boolean[][]
  title: string
  caption?: string
  /** Show numeric values inside the cells. */
  showValues?: boolean
  decimals?: number
  cellSize?: number
  testId?: string
}

/**
 * Matrix heatmap. Rendered as a CSS grid of labelled cells so that values stay
 * selectable and screen readers get a text description of the figure.
 */
export function Heatmap({
  matrix,
  rowLabels,
  colLabels,
  domain,
  dimmed,
  title,
  caption,
  showValues = true,
  decimals = 2,
  cellSize = 44,
  testId,
}: HeatmapProps) {
  if (matrix.length === 0) {
    return <p className="text-sm text-faint">No values to display.</p>
  }
  const flat = matrix.flat()
  const min = domain ? domain[0] : Math.min(...flat)
  const max = domain ? domain[1] : Math.max(...flat)
  const span = max - min || 1
  const columns = Math.max(...matrix.map((row) => row.length))

  return (
    <figure className="overflow-hidden" data-testid={testId}>
      <figcaption className="mb-2 text-xs font-medium text-muted">{title}</figcaption>
      <div className="overflow-x-auto pb-1">
        <div
          className="inline-grid gap-1"
          style={{
            gridTemplateColumns: `${colLabels ? '3.4rem ' : ''}repeat(${columns}, minmax(${cellSize}px, 1fr))`,
            gridTemplateRows: `${rowLabels ? '1.4rem ' : ''}repeat(${matrix.length}, minmax(${cellSize}px, 1fr))`,
          }}
        >
          {colLabels ? (
            <>
              <span />
              {colLabels.slice(0, columns).map((label, j) => (
                <span
                  key={`col-${j}`}
                  className="truncate text-center font-mono text-[10px] text-faint"
                  title={label}
                >
                  {label}
                </span>
              ))}
            </>
          ) : null}
          {matrix.map((row, i) => (
            <div key={`row-${i}`} className="contents">
              {rowLabels ? (
                <span className="truncate pr-1 text-right font-mono text-[10px] text-faint" title={rowLabels[i]}>
                  {rowLabels[i]}
                </span>
              ) : null}
              {Array.from({ length: columns }, (_, j) => {
                const value = row[j]
                const defined = value !== undefined && Number.isFinite(value)
                const t = defined ? (value - min) / span : 0
                const isDimmed = dimmed?.[i]?.[j] ?? false
                return (
                  <div
                    key={`cell-${i}-${j}`}
                    className={`flex items-center justify-center rounded-md font-mono text-[11px] transition-opacity ${
                      isDimmed ? 'opacity-25' : ''
                    } ${t > 0.55 ? 'text-[#10131c]' : 'text-white'}`}
                    style={{
                      backgroundColor: defined ? rampColor(t) : 'var(--panel-2)',
                      opacity: defined ? (isDimmed ? 0.3 : 1) : 0.4,
                    }}
                    title={`${rowLabels?.[i] ?? `row ${i}`} · ${colLabels?.[j] ?? `col ${j}`} = ${
                      defined ? fmt(value, decimals) : '—'
                    }`}
                  >
                    {showValues ? (defined ? fmt(value, decimals) : '—') : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-faint">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-8 rounded-full" style={{ background: rampColor(0) }} />
          <span className="font-mono">{fmt(min, decimals)}</span>
        </span>
        <span className="inline-block h-2.5 w-8 rounded-full" style={{ background: rampColor(0.5) }} />
        <span className="inline-flex items-center gap-1">
          <span className="font-mono">{fmt(max, decimals)}</span>
          <span className="inline-block h-2.5 w-8 rounded-full" style={{ background: rampColor(1) }} />
        </span>
      </div>
      {caption ? <p className="mt-2 text-xs leading-relaxed text-muted">{caption}</p> : null}
    </figure>
  )
}

/** Compact numeric matrix for worked examples where colour would add noise. */
export function MatrixTable({
  matrix,
  rowLabels,
  colLabels,
  decimals = 3,
  label,
}: {
  matrix: number[][]
  rowLabels?: string[]
  colLabels?: string[]
  decimals?: number
  label: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-right font-mono text-[11px]">
        <caption className="mb-1 text-left font-sans text-xs text-muted">{label}</caption>
        {colLabels ? (
          <thead>
            <tr>
              {rowLabels ? <th /> : null}
              {colLabels.map((label2, j) => (
                <th key={j} className="px-1.5 py-1 font-normal text-faint">
                  {label2}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i} className="border-t border-line-soft">
              {rowLabels ? <th className="pr-2 text-left font-normal text-faint">{rowLabels[i]}</th> : null}
              {row.map((value, j) => (
                <td key={j} className="px-1.5 py-1 text-fg">
                  {fmt(value, decimals)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
