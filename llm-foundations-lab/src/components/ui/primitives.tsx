import {
  useId,
  type ComponentProps,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'

/* -------------------------------------------------------------- Card & layout */

export function Panel({
  children,
  className = '',
  as: Tag = 'section',
  id,
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article' | 'aside'
  id?: string
}) {
  return (
    <Tag
      id={id}
      className={`panel rounded-2xl border border-line bg-panel/80 p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset] backdrop-blur-sm sm:p-6 ${className}`}
    >
      {children}
    </Tag>
  )
}

export function SectionHeading({
  kicker,
  title,
  description,
  id,
  action,
}: {
  kicker?: string
  title: string
  description?: ReactNode
  id?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker ? (
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-indigo">{kicker}</p>
        ) : null}
        <h2 id={id} className="font-display text-xl font-semibold tracking-tight text-fg sm:text-2xl">
          {title}
        </h2>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

/* -------------------------------------------------------------- Buttons */

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'
  const sizes = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'
  const variants: Record<string, string> = {
    primary: 'bg-indigo-strong text-white hover:bg-indigo',
    secondary: 'border border-control bg-panel-2 text-fg hover:border-indigo/60 hover:text-indigo',
    ghost: 'text-muted hover:bg-panel-2 hover:text-fg',
    danger: 'border border-rose/50 bg-rose/10 text-rose hover:bg-rose/20',
  }
  return <button type={type} className={`${base} ${sizes} ${variants[variant]} ${className}`} {...rest} />
}

export function Badge({
  children,
  tone = 'neutral',
  className = '',
  title,
}: {
  children: ReactNode
  tone?: 'neutral' | 'indigo' | 'teal' | 'amber' | 'rose' | 'positive'
  className?: string
  title?: string
}) {
  const tones: Record<string, string> = {
    neutral: 'border-control bg-panel-2 text-muted',
    indigo: 'border-indigo/40 bg-indigo/10 text-indigo',
    teal: 'border-teal/40 bg-teal/10 text-teal',
    amber: 'border-amber/40 bg-amber/10 text-amber',
    rose: 'border-rose/40 bg-rose/10 text-rose',
    positive: 'border-positive/40 bg-positive/10 text-positive',
  }
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/* -------------------------------------------------------------- Controls */

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
  disabled,
  'data-testid': testId,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  format?: (value: number) => string
  hint?: string
  disabled?: boolean
  'data-testid'?: string
}) {
  const id = useId()
  return (
    <div className={disabled ? 'opacity-60' : ''}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-muted">
          {label}
        </label>
        <span className="font-mono text-xs text-fg">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-indigo-strong disabled:cursor-not-allowed"
      />
      {hint ? <p className="mt-1 text-[11px] leading-snug text-faint">{hint}</p> : null}
    </div>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  hint,
  'data-testid': testId,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  hint?: string
  'data-testid'?: string
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <input
          id={id}
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          data-testid={testId}
          onChange={(event) => {
            const next = Number(event.target.value)
            onChange(Number.isFinite(next) ? next : 0)
          }}
          className="w-full rounded-xl border border-control bg-panel-2 px-3 py-2 font-mono text-sm text-fg focus:border-indigo focus:outline-none"
        />
        {suffix ? <span className="font-mono text-xs text-faint">{suffix}</span> : null}
      </div>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-faint">{hint}</p> : null}
    </div>
  )
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
}: {
  label?: string
  value: T
  options: { value: T; label: string; hint?: string }[]
  onChange: (value: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div>
      {label ? <span className="mb-1 block text-xs font-medium text-muted">{label}</span> : null}
      <div
        role="radiogroup"
        aria-label={label ?? 'options'}
        className="inline-flex flex-wrap gap-1 rounded-xl border border-control bg-panel-2 p-1"
      >
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              title={option.hint}
              onClick={() => onChange(option.value)}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                size === 'sm' ? 'text-[11px]' : 'text-xs'
              } ${selected ? 'bg-indigo-strong text-white' : 'text-muted hover:bg-panel hover:text-fg'}`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
}) {
  const id = useId()
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked ? 'border-indigo bg-indigo-strong' : 'border-control bg-panel-2'
        }`}
      >
        <span
          className={`block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-0.5'
          }`}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-xs font-medium text-muted">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11px] leading-snug text-faint">{hint}</span> : null}
      </label>
    </div>
  )
}

export function TextInput({
  label,
  hint,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  const id = useId()
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        {...rest}
        className="w-full rounded-xl border border-control bg-panel-2 px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-indigo focus:outline-none"
      />
      {hint ? <p className="mt-1 text-[11px] text-faint">{hint}</p> : null}
    </div>
  )
}

/* -------------------------------------------------------------- Data display */

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'neutral' | 'indigo' | 'teal' | 'amber' | 'rose' | 'positive'
}) {
  const tones: Record<string, string> = {
    neutral: 'text-fg',
    indigo: 'text-indigo',
    teal: 'text-teal',
    amber: 'text-amber',
    rose: 'text-rose',
    positive: 'text-positive',
  }
  return (
    <div className="rounded-xl border border-line bg-panel-2/60 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wider text-faint">{label}</p>
      <p className={`mt-0.5 font-mono text-lg leading-tight ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-muted">{hint}</p> : null}
    </div>
  )
}

export function ProgressBar({
  value,
  max = 1,
  label,
  ariaLabel,
  tone = 'indigo',
}: {
  value: number
  max?: number
  /** Visible label. Also used as the accessible name when `ariaLabel` is absent. */
  label?: string
  /** Accessible name for the bar, when the visible label is not descriptive enough. */
  ariaLabel?: string
  tone?: 'indigo' | 'teal' | 'amber'
}) {
  const pct = max === 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100))
  const tones: Record<string, string> = {
    indigo: 'bg-indigo-strong',
    teal: 'bg-teal-strong',
    amber: 'bg-amber-strong',
  }
  return (
    <div>
      {label ? (
        <div className="mb-1 flex justify-between text-[11px] text-muted">
          <span>{label}</span>
          <span className="font-mono">{pct.toFixed(0)}%</span>
        </div>
      ) : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-line-soft"
        role="progressbar"
        aria-label={ariaLabel ?? label ?? `Progress (${tone})`}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${pct.toFixed(0)}%`}
      >
        <div className={`h-full rounded-full transition-[width] ${tones[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Callout({
  tone = 'indigo',
  title,
  children,
}: {
  tone?: 'indigo' | 'teal' | 'amber' | 'rose'
  title?: string
  children: ReactNode
}) {
  const tones: Record<string, string> = {
    indigo: 'border-indigo/40 bg-indigo/5',
    teal: 'border-teal/40 bg-teal/5',
    amber: 'border-amber/40 bg-amber/5',
    rose: 'border-rose/40 bg-rose/5',
  }
  const titles: Record<string, string> = {
    indigo: 'text-indigo',
    teal: 'text-teal',
    amber: 'text-amber',
    rose: 'text-rose',
  }
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}>
      {title ? <p className={`mb-1 font-medium ${titles[tone]}`}>{title}</p> : null}
      <div className="text-muted [&_a]:text-indigo [&_a]:underline">{children}</div>
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { value: T; label: string; badge?: ReactNode }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex flex-wrap gap-1 border-b border-line pb-px"
    >
      {tabs.map((tab) => {
        const selected = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              selected
                ? 'border-indigo text-fg'
                : 'border-transparent text-muted hover:border-line hover:text-fg'
            }`}
          >
            {tab.label}
            {tab.badge ? <span className="ml-2 font-mono text-[10px] text-faint">{tab.badge}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export function DefinitionList({ items }: { items: { term: ReactNode; detail: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line-soft">
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-4">
          <dt className="text-sm font-medium text-fg">{item.term}</dt>
          <dd className="text-sm text-muted">{item.detail}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ResetButton({ onReset, label = 'Reset' }: { onReset: () => void; label?: string }) {
  return (
    <Button size="sm" variant="ghost" onClick={onReset} title={`${label} to the defaults`}>
      <span aria-hidden>↺</span>
      {label}
    </Button>
  )
}
