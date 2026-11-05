import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { DataTable } from './Charts.js'

/**
 * The shared interface primitives.
 *
 * Every control is labelled, every figure has a text description, and every
 * panel can be reached by keyboard. These are small on purpose: the course's
 * substance is in `src/core`, and the interface is a thin layer over it.
 */

const ACCENTS = {
  indigo: 'accent-indigo',
  teal: 'accent-teal',
  amber: 'accent-amber',
  emerald: 'accent-emerald',
  rose: 'accent-rose',
  violet: 'accent-violet',
  sky: 'accent-sky',
} as const

export type Accent = keyof typeof ACCENTS

export function Panel({
  children,
  title,
  subtitle,
  accent = 'indigo',
  actions,
  className = '',
}: {
  children: ReactNode
  title?: string
  subtitle?: string
  accent?: Accent
  actions?: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${ACCENTS[accent]} ${className}`.trim()}>
      {title || actions ? (
        <header className="panel-head">
          <div>
            {title ? <h2 className="panel-title">{title}</h2> : null}
            {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="panel-body">{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'good' | 'warn'
}) {
  return (
    <div className={`stat stat-${tone}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  )
}

export function Callout({
  tone = 'note',
  title,
  children,
}: {
  tone?: 'note' | 'warning' | 'definition'
  title?: string
  children: ReactNode
}) {
  return (
    <aside className={`callout callout-${tone}`}>
      {title ? <p className="callout-title">{title}</p> : null}
      <div className="callout-body">{children}</div>
    </aside>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  hint,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  hint?: string
  format?: (value: number) => string
}) {
  const id = useId()
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        <span className="field-value">{format ? format(value) : value}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'default',
  type = 'button',
  disabled = false,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  type?: 'button' | 'submit'
  disabled?: boolean
  title?: string
}) {
  return (
    <button className={`btn btn-${variant}`} type={type} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  )
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="field">
      <span className="field-label" id={`${label}-label`}>
        {label}
      </span>
      <div className="segmented" role="group" aria-labelledby={`${label}-label`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === value ? 'segment segment-active' : 'segment'}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Tabs<T extends string>({
  label,
  tabs,
  active,
  onChange,
}: {
  label: string
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          id={`tab-${tab.id}`}
          aria-selected={tab.id === active}
          aria-controls={`panel-${tab.id}`}
          tabIndex={tab.id === active ? 0 : -1}
          className={tab.id === active ? 'tab tab-active' : 'tab'}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
            event.preventDefault()
            const index = tabs.findIndex((t) => t.id === active)
            const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length
            onChange(tabs[next].id)
            document.getElementById(`tab-${tabs[next].id}`)?.focus()
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/** A figure with a caption and a text alternative for assistive technology. */
export function Figure({
  title,
  caption,
  description,
  data,
  children,
}: {
  title: string
  caption?: string
  description: string
  /** The numbers behind the chart. Without it there is nothing to show. */
  data?: { headers: string[]; rows: (string | number)[][] }
  children: ReactNode
}) {
  const [showTable, setShowTable] = useState(false)
  const tableId = useId()
  return (
    <figure className="figure">
      <div className="figure-head">
        <h3 className="figure-title">{title}</h3>
        {data ? (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            aria-expanded={showTable}
            aria-controls={tableId}
            onClick={() => setShowTable((value) => !value)}
          >
            {showTable ? 'Hide the data' : 'Show the data'}
          </button>
        ) : null}
      </div>
      <p className="sr-only">{description}</p>
      <div className="figure-body">{children}</div>
      {data && showTable ? (
        <div id={tableId}>
          <DataTable caption={`${title}, as numbers`} headers={data.headers} rows={data.rows} />
        </div>
      ) : null}
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  )
}

/** A key/value table, used for the symbol glossaries. */
export function DefinitionTable({ rows }: { rows: { symbol: string; name: string; note?: string }[] }) {
  return (
    <table className="def-table">
      <caption className="sr-only">Definitions</caption>
      <thead>
        <tr>
          <th scope="col">Symbol</th>
          <th scope="col">Name</th>
          <th scope="col">Note</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.symbol}-${row.name}`}>
            <th scope="row" className="def-term">
              {row.symbol}
            </th>
            <td>{row.name}</td>
            <td className="def-note">{row.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** A numbered list of steps, used for the derivations. */
export function Steps({ items }: { items: string[] }) {
  return (
    <ol className="steps">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ol>
  )
}

/** An empty state, so a figure never silently shows nothing. */
export function EmptyState({ message }: { message: string }) {
  return <p className="empty-state">{message}</p>
}
