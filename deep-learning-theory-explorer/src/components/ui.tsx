import type { ReactNode } from 'react';
import { Rich, Tex } from './Math';

/** Small, uniform control and layout primitives used by every screen. */

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-4 ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-[13px] font-semibold uppercase tracking-wider text-lab-300">{title}</h2>}
            {subtitle && <p className="mt-1 max-w-3xl text-[12.5px] leading-snug text-lab-400">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const color =
    tone === 'good' ? 'text-signal-green' : tone === 'warn' ? 'text-signal-orange' : tone === 'bad' ? 'text-signal-red' : 'text-lab-100';
  return (
    <div className="rounded-md border border-lab-700 bg-lab-850/60 px-3 py-2">
      <div className="text-[10.5px] uppercase tracking-wider text-lab-400">{label}</div>
      <div className={`mono mt-0.5 text-[15px] ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] leading-snug text-lab-400">{hint}</div>}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  tex,
  unit,
  hint,
  integer = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  tex?: string;
  unit?: string;
  hint?: string;
  integer?: boolean;
}) {
  const commit = (raw: string) => {
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    onChange(integer ? Math.round(v) : v);
  };
  /*
   * A <label> binds to the first control inside it, so the slider itself would
   * be left with no name at all — a screen reader would announce "slider" and
   * nothing else. Both controls are therefore named explicitly, and the names
   * contain the visible label so that the spoken and the written agree.
   */
  const name = tex ? `${label} ${tex}` : label;
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-lab-300">
          {label} {tex && <Tex tex={tex} />}
        </span>
        <span className="flex items-center gap-1">
          <input
            type="number"
            aria-label={`${name} value`}
            className="mono w-20 rounded border border-lab-600 bg-lab-850 px-1.5 py-0.5 text-right text-[12px] text-lab-100 focus:border-signal-blue focus:outline-none"
            value={Number.isFinite(value) ? value : ''}
            min={min}
            max={max}
            step={step}
            onChange={(e) => commit(e.target.value)}
          />
          {unit && <span className="text-[11px] text-lab-400">{unit}</span>}
        </span>
      </div>
      <input
        aria-label={name}
        className="mt-1.5"
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : min}
        onChange={(e) => commit(e.target.value)}
      />
      {hint && <p className="mt-1 text-[11px] leading-snug text-lab-400">{hint}</p>}
    </label>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; note?: string }>;
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[12px] text-lab-300">{label}</span>
      <select
        aria-label={label}
        className="mono mt-1 w-full rounded border border-lab-600 bg-lab-850 px-2 py-1 text-[12px] text-lab-100 focus:border-signal-blue focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} title={o.note}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-[11px] leading-snug text-lab-400">{hint}</p>}
    </label>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  title?: string;
}) {
  const styles =
    variant === 'primary'
      ? 'border-signal-blue/50 bg-signal-blue/15 text-signal-blue hover:bg-signal-blue/25'
      : variant === 'danger'
        ? 'border-signal-red/50 bg-signal-red/10 text-signal-red hover:bg-signal-red/20'
        : 'border-lab-600 bg-lab-850 text-lab-200 hover:border-lab-400';
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles}`}
    >
      {children}
    </button>
  );
}

export function Callout({
  tone,
  title,
  children,
}: {
  tone: 'insight' | 'warning' | 'limitation' | 'definition';
  title: string;
  children: ReactNode;
}) {
  const map = {
    insight: { border: 'border-signal-blue/40', bg: 'bg-signal-blue/10', text: 'text-signal-blue' },
    warning: { border: 'border-signal-orange/40', bg: 'bg-signal-orange/10', text: 'text-signal-orange' },
    limitation: { border: 'border-signal-violet/40', bg: 'bg-signal-violet/10', text: 'text-signal-violet' },
    definition: { border: 'border-signal-green/40', bg: 'bg-signal-green/10', text: 'text-signal-green' },
  }[tone];
  return (
    <div className={`my-3 rounded-md border ${map.border} ${map.bg} px-3 py-2.5`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wider ${map.text}`}>{title}</div>
      <div className="mt-1 text-[13px] leading-relaxed text-lab-200">{children}</div>
    </div>
  );
}

export function Citation({ label, note }: { label: string; note: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded border border-lab-700 bg-lab-850/70 px-1.5 py-0.5 text-[11px] text-lab-300">
      <span className="mono text-signal-green">{label}</span>
      <span className="text-lab-400">{note}</span>
    </span>
  );
}

export function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-[12px] text-signal-red">
      {children}
    </div>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border-b border-lab-700 px-2 py-1.5 text-left font-semibold text-lab-300">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="odd:bg-lab-850/40">
              {row.map((cell, j) => (
                <td key={j} className="border-b border-lab-800 px-2 py-1.5 align-top text-lab-200">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const map = {
    default: 'border-lab-600 text-lab-300',
    good: 'border-signal-green/50 text-signal-green',
    warn: 'border-signal-orange/50 text-signal-orange',
    bad: 'border-signal-red/50 text-signal-red',
  }[tone];
  return <span className={`rounded border px-1.5 py-0.5 text-[11px] ${map}`}>{children}</span>;
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="space-y-2 text-[13.5px] leading-relaxed text-lab-200">{children}</div>;
}

/**
 * The indicator shown while a laboratory is computing. Every laboratory uses
 * the same one, so "busy" always looks the same.
 */
export function Computing({ label = 'Computing' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border border-lab-700 bg-lab-850/50 px-3 py-2 text-[12.5px] text-lab-300"
    >
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-signal-blue" />
      <span>{label}…</span>
    </div>
  );
}

/**
 * The results of a measurement.
 *
 * While a new configuration is being computed, the numbers on screen belong to
 * the *previous* one. They are real numbers, but they are the numbers of the
 * settings the reader has just changed away from, and a reader glancing at a
 * panel should not take them for the new ones. So they are dimmed, and said
 * to be what they are.
 */
export function Results({ stale, children }: { stale: boolean; children: ReactNode }) {
  return (
    <div className={stale ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
      {children}
      {stale && (
        <p className="mt-2 text-[11px] text-lab-400">
          These are the numbers of the previous settings, shown while the new ones are computed.
        </p>
      )}
    </div>
  );
}

export function Bullets({ items, ordered = false }: { items: string[]; ordered?: boolean }) {  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`ml-5 space-y-1 text-[13px] leading-relaxed text-lab-200 ${ordered ? 'list-decimal' : 'list-disc'}`}>
      {items.map((it, i) => (
        <li key={i}>
          <Rich text={it} />
        </li>
      ))}
    </Tag>
  );
}
