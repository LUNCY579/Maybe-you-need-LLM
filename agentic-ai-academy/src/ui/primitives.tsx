import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode, type Ref } from 'react'

export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

/* ------------------------------------------------------------------ */
/* Screen-reader utilities                                             */
/* ------------------------------------------------------------------ */

/** Text that only assistive technology can see. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>
}

/**
 * A polite live region.
 *
 * `message` is announced whenever it changes. The region is always present in
 * the DOM (only its contents change) because screen readers only announce
 * updates to regions that existed before the update.
 */
export function LiveRegion({ message, className }: { message: string; className?: string }) {
  return (
    <p role="status" aria-live="polite" aria-atomic="true" className={cn('sr-only', className)}>
      {message}
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                           */
/* ------------------------------------------------------------------ */

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // `enter` pairs with the `@starting-style` rule in index.css: the card
        // fades in once, when it first appears, and never again.
        'enter surface rounded-2xl border shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_18px_40px_-32px_rgba(6,12,32,0.9)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('flex flex-col gap-3 p-4', className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-wide uppercase" style={{ color: 'var(--accent)' }}>
            {title}
          </h3>
          {subtitle ? <p className="text-muted mt-1 text-xs">{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Controls                                                           */
/* ------------------------------------------------------------------ */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  /** React 19 passes `ref` as a regular prop to function components. */
  ref?: Ref<HTMLButtonElement>
}

export function Button({ variant = 'secondary', size = 'md', className, ...rest }: ButtonProps) {
  const base =
    'focus-ring inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
  /*
   * WCAG 2.5.8 (Target Size, Minimum) asks for a 24 by 24 CSS pixel target.
   * The minimum height is set explicitly rather than left to the padding,
   * because a small font with tight padding can fall under it.
   */
  const sizing = size === 'sm' ? 'min-h-6 px-2.5 py-1.5 text-xs' : 'min-h-9 px-3.5 py-2 text-sm'
  const styles: Record<string, string> = {
    primary: 'text-slate-950 shadow-[0_10px_30px_-16px_rgba(53,230,255,0.9)]',
    secondary: 'surface-2 border',
    ghost: 'hover:bg-white/5',
    danger: 'bg-rose-500/15 text-rose-200 border border-rose-400/30 hover:bg-rose-500/25',
  }
  const style =
    variant === 'primary'
      ? { background: 'var(--accent)', borderColor: 'transparent' }
      : variant === 'secondary'
        ? { borderColor: 'var(--border-soft)', color: 'var(--text-strong)' }
        : variant === 'ghost'
          ? { color: 'var(--text-muted)' }
          : { color: undefined }
  return <button className={cn(base, sizing, styles[variant], className)} style={style} {...rest} />
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'cyan' | 'violet' | 'amber' | 'rose' | 'emerald'
  className?: string
}) {
  const tones: Record<string, string> = {
    neutral: 'border-white/10 bg-white/5 text-slate-300',
    cyan: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
    violet: 'border-violet-400/30 bg-violet-400/10 text-violet-200',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    rose: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
    emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <div className="w-full">
      <div
        className="surface-2 h-2 w-full overflow-hidden rounded-full border"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        aria-label={label ?? 'Progress'}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${clamped * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }}
        />
      </div>
      {label ? <p className="text-muted mt-1 text-[11px]">{label}</p> : null}
    </div>
  )
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-muted text-[11px] tracking-wide uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="text-muted mt-1 text-xs">{hint}</p> : null}
    </Card>
  )
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  idPrefix,
}: {
  tabs: { id: T; label: string; hint?: string }[]
  active: T
  onChange: (id: T) => void
  ariaLabel: string
  /**
   * When provided, tabs get stable ids and `aria-controls` pointing at the
   * matching {@link TabPanel}. Pair every tab with a `TabPanel` that uses the
   * same prefix.
   */
  idPrefix?: string
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>())

  const focusTab = (id: T) => {
    const node = refs.current.get(id)
    node?.focus()
  }

  /**
   * Roving tabindex: only the active tab is in the tab order, arrow keys move
   * between tabs and immediately activate them (automatic activation), which
   * matches the WAI-ARIA authoring practices for tabs.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const index = tabs.findIndex((tab) => tab.id === active)
    if (index === -1) return
    let nextIndex: number | null = null
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % tabs.length
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + tabs.length) % tabs.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = tabs.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    const next = tabs[nextIndex]
    onChange(next.id)
    focusTab(next.id)
  }

  return (
    <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(node) => {
            if (node) refs.current.set(tab.id, node)
            else refs.current.delete(tab.id)
          }}
          type="button"
          role="tab"
          id={idPrefix ? `${idPrefix}-tab-${tab.id}` : undefined}
          aria-controls={idPrefix ? `${idPrefix}-panel-${tab.id}` : undefined}
          aria-selected={active === tab.id}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={onKeyDown}
          className={cn(
            'focus-ring rounded-lg border px-3 py-1.5 text-xs font-medium transition',
            active === tab.id ? 'text-slate-950' : 'text-muted hover:text-white',
          )}
          style={
            active === tab.id
              ? { background: 'var(--accent)', borderColor: 'transparent' }
              : { borderColor: 'var(--border-soft)' }
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/**
 * The content region associated with a {@link Tabs} entry.
 *
 * Renders a `tabpanel` with the matching id and `aria-labelledby`, and is
 * focusable so keyboard users can scroll it with the arrow keys.
 */
export function TabPanel({
  idPrefix,
  id,
  active,
  children,
  className,
}: {
  idPrefix: string
  id: string
  active: boolean
  children: ReactNode
  className?: string
}) {
  if (!active) return null
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      tabIndex={0}
      className={cn('focus-ring', className)}
    >
      {children}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block text-xs">
      <span className="text-muted font-medium tracking-wide uppercase">{label}</span>
      {children}
      {hint ? <span className="text-muted mt-1 block text-[11px]">{hint}</span> : null}
    </label>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  id,
  describedBy,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  label: string
  /** Supply an id so a visible `<label htmlFor>` can point at the input. */
  id?: string
  /** Id of an element describing the value of this control. */
  describedBy?: string
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <input
      id={inputId}
      type="range"
      aria-label={label}
      aria-describedby={describedBy}
      aria-valuetext={`${value}`}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="focus-ring mt-2 w-full accent-cyan-400"
    />
  )
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
      style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="focus-ring surface-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs"
      style={{ borderColor: 'var(--border-soft)' }}
    >
      <span>{label}</span>
      <span
        aria-hidden
        className={cn('h-4 w-8 rounded-full transition', checked ? '' : 'opacity-40')}
        style={{ background: checked ? 'var(--accent)' : 'var(--border-soft)' }}
      >
        <span
          className="block h-4 w-4 rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Figures                                                             */
/* ------------------------------------------------------------------ */

/**
 * A chart with an accessible text alternative.
 *
 * Recharts renders to SVG with no semantic structure, so a screen reader
 * would otherwise read nothing at all. This wrapper gives the chart a name,
 * describes it, and always exposes the underlying numbers as a table.
 */
export function ChartFigure({
  title,
  description,
  columns,
  rows,
  children,
}: {
  title: string
  description: string
  columns: string[]
  rows: (string | number)[][]
  children: ReactNode
}) {
  return (
    <figure className="space-y-2">
      <div role="img" aria-label={`${title}. ${description}`}>
        {children}
      </div>
      <figcaption className="text-muted text-[11px]">{description}</figcaption>
      <details className="text-xs">
        <summary className="focus-ring cursor-pointer">Show the underlying data as a table</summary>
        <div className="thin-scroll mt-2 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col" className="border-b px-2 py-1 text-left uppercase" style={{ borderColor: 'var(--border-soft)' }}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border-b px-2 py-1" style={{ borderColor: 'var(--border-soft)' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

export function Callout({ tone, title, children }: { tone: 'info' | 'warning' | 'insight' | 'source'; title: string; children: ReactNode }) {
  const tones = {
    info: { border: 'rgba(53,230,255,0.35)', bg: 'rgba(53,230,255,0.06)', label: 'Info', text: 'var(--callout-info)' },
    warning: { border: 'rgba(251,191,36,0.35)', bg: 'rgba(251,191,36,0.07)', label: 'Warning', text: 'var(--callout-warning)' },
    insight: { border: 'rgba(167,139,250,0.35)', bg: 'rgba(167,139,250,0.08)', label: 'Insight', text: 'var(--callout-insight)' },
    source: { border: 'rgba(52,211,153,0.35)', bg: 'rgba(52,211,153,0.07)', label: 'From the source', text: 'var(--callout-source)' },
  }[tone]

  return (
    <div className="rounded-xl border p-3 text-sm" style={{ borderColor: tones.border, background: tones.bg }}>
      <p className="mb-1 text-[11px] font-semibold tracking-wide uppercase" style={{ color: tones.text }}>
        {tones.label} · {title}
      </p>
      <div className="space-y-2 leading-relaxed">{children}</div>
    </div>
  )
}

/**
 * A destructive action that asks for confirmation inline.
 *
 * Deliberately avoids `window.confirm`: a native modal blocks the page, cannot
 * be themed, and is awkward for screen-reader users. Here the first click arms
 * the action and the second one performs it, with a cancel escape hatch and a
 * live-region announcement.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className,
  disabled,
}: {
  label: string
  confirmLabel?: string
  onConfirm: () => void
  className?: string
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (armed) confirmRef.current?.focus()
  }, [armed])

  if (!armed) {
    return (
      <Button variant="danger" className={className} disabled={disabled} onClick={() => setArmed(true)}>
        {label}
      </Button>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        ref={confirmRef}
        variant="danger"
        onClick={() => {
          setArmed(false)
          onConfirm()
        }}
      >
        {confirmLabel ?? `Yes, ${label.toLowerCase()}`}
      </Button>
      <Button variant="ghost" onClick={() => setArmed(false)}>
        Cancel
      </Button>
      <LiveRegion message={`${label} needs confirmation. Choose "Yes" to proceed or "Cancel" to abort.`} />
    </span>
  )
}
