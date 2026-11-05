import { useMemo, useState } from 'react'
import { DEFAULT_MEMORY_CONFIG, runMemoryLab, type RetrievalStrategy } from '../../engine/labs/memory'
import { Badge, Button, cn } from '../primitives'
import { DemoShell } from './DemoShell'

/**
 * Memory, inline.
 *
 * This is a projection of the *same* engine that Lab B uses, so the lesson and
 * the laboratory cannot drift apart: if the lesson shows the nut allergy
 * surviving, the lab shows it surviving too.
 *
 * The student changes the capacity and the retrieval strategy and watches two
 * things happen: what is evicted, and whether the decisive fact survives long
 * enough to be retrieved.
 */

const STRATEGIES: { value: RetrievalStrategy; label: string }[] = [
  { value: 'recency', label: 'Recency' },
  { value: 'relevance', label: 'Relevance' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'importance', label: 'Importance' },
]

export function MemoryDemo() {
  // The default is large enough to hold every event, so the baseline shows a
  // store that has not yet lost anything. Shrinking it is what reveals the
  // eviction behaviour.
  const [capacity, setCapacity] = useState(12)
  const [strategy, setStrategy] = useState<RetrievalStrategy>('hybrid')

  const run = useMemo(
    () => runMemoryLab({ ...DEFAULT_MEMORY_CONFIG, capacity, strategy, relevanceWeight: 0.7 }),
    [capacity, strategy],
  )

  const decision = run.decisions[run.decisions.length - 1]
  const last = run.timeline[run.timeline.length - 1]

  return (
    <DemoShell
      title="What the agent remembers, and what it forgets"
      source="Ch. 9, §9.3.2 Memory architectures"
      summary="Change the store's capacity and the retrieval strategy, then watch which facts are evicted and whether the agent can still answer the question it needs to answer."
      controls={
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="demo-memory-capacity" className="text-muted text-xs font-medium">
              Store capacity: {capacity} items
            </label>
            <input
              id="demo-memory-capacity"
              type="range"
              min={1}
              max={12}
              step={1}
              value={capacity}
              onChange={(event) => setCapacity(Number(event.target.value))}
              className="focus-ring mt-1 w-full accent-cyan-400"
            />
          </div>
          <div>
            <label htmlFor="demo-memory-strategy" className="text-muted text-xs font-medium">
              Retrieval strategy
            </label>
            <select
              id="demo-memory-strategy"
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as RetrievalStrategy)}
              className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
              style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
            >
              {STRATEGIES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={decision?.correct ? 'emerald' : 'rose'}>{decision?.correct ? 'correct answer' : 'wrong answer'}</Badge>
          <Badge tone="neutral">{run.accuracy * 100}% of decisions correct</Badge>
          <Badge tone="neutral">
            {run.storedCritical}/{run.totalCritical} critical facts kept
          </Badge>
        </div>

        <ol className="space-y-1.5 text-xs">
          {run.timeline.map((entry) => (
            <li
              key={entry.event.id}
              className={cn(
                'flex flex-wrap items-baseline gap-2 rounded-lg border px-2.5 py-1.5',
                entry.evicted ? 'opacity-60' : '',
              )}
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <span className="text-muted font-mono text-[10px]">#{entry.tick + 1}</span>
              <span className="text-muted text-[10px] uppercase">{entry.event.channel}</span>
              <span className="min-w-0 flex-1">{entry.event.content}</span>
              {entry.event.importance === 'critical' ? <Badge tone="rose">critical</Badge> : null}
              {entry.stored ? <Badge tone="emerald">stored</Badge> : <Badge tone="neutral">not stored</Badge>}
              {entry.evicted ? (
                <Badge tone="amber">evicted: “{entry.evicted.content.slice(0, 40)}…”</Badge>
              ) : null}
            </li>
          ))}
        </ol>

        {decision ? (
          <div className="surface-2 rounded-lg border p-3 text-xs" style={{ borderColor: 'var(--border-soft)' }}>
            <p className="font-semibold">The question the agent had to answer</p>
            <p className="text-muted mt-1">{decision.question}</p>
            <p className="mt-2">
              <strong>Answer given:</strong> {decision.decision}
            </p>
            <p className="text-muted mt-1">{decision.explanation}</p>
            <div className="mt-2 space-y-1">
              {decision.scores.map((score) => {
                const kept = decision.retrieved.some((entry) => entry.id === score.id)
                return (
                  <p key={score.id} className="text-muted flex items-center gap-2">
                    <span className="font-mono">{score.score.toFixed(3)}</span>
                    <span>{kept ? 'retrieved' : 'omitted'}</span>
                  </p>
                )
              })}
            </div>
          </div>
        ) : null}

        {last?.evicted ? (
          <p className="text-muted text-[11px]">
            The store held {last.storeSize} item(s) at the end. The most recent eviction was{' '}
            “{last.evicted.content.slice(0, 60)}…”. Capacity is a hard constraint: an item that is evicted is gone, and no retrieval strategy can
            bring it back.
          </p>
        ) : (
          <p className="text-muted text-[11px]">
            The store held {last?.storeSize ?? 0} item(s) at the end and nothing was evicted. Raise the capacity back to see the eviction
            behaviour return.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setCapacity((value) => (value >= 12 ? 1 : value + 1))}>
            Change capacity
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStrategy(strategy === 'hybrid' ? 'recency' : 'hybrid')}>
            Switch strategy
          </Button>
        </div>
      </div>
    </DemoShell>
  )
}
