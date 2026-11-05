import type { ReactNode } from 'react'
import { Badge, Card } from '../primitives'

/**
 * The frame every inline lesson demonstration sits in.
 *
 * A demonstration inside a lesson is not a picture of a result: it is a
 * control surface. The shell makes that explicit by always showing what is
 * running, what it is drawn from, and what the student can change.
 */
export function DemoShell({
  title,
  source,
  summary,
  controls,
  children,
}: {
  title: string
  /** The textbook section the demonstration is drawn from. */
  source: string
  /** One sentence: what this demonstrates and what the student can change. */
  summary: string
  /** The controls, rendered above the demonstration. */
  controls?: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <header className="border-b px-4 py-3" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="emerald">Interactive</Badge>
          <h4 className="text-sm font-semibold">{title}</h4>
          <span className="text-muted text-[11px]">{source}</span>
        </div>
        <p className="text-muted mt-1.5 text-xs leading-relaxed">{summary}</p>
      </header>

      {controls ? (
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-soft)' }}>
          {controls}
        </div>
      ) : null}

      <div className="p-4">{children}</div>
    </Card>
  )
}
