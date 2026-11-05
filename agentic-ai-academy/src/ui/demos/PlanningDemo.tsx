import { useMemo, useState } from 'react'
import { DEFAULT_WORLD, cellKind, runPlanning, type PlanningStrategy } from '../../engine/labs/planning'
import { Badge, Button, cn } from '../primitives'
import { DemoShell } from './DemoShell'

/**
 * Planning, inline.
 *
 * The guided version of Lab A. The laboratory is a comparison tool; this is a
 * walkthrough of a single failure: the greedy planner never fetches the key,
 * so it never opens the door, and no amount of retrying helps.
 *
 * The student scrubs through the trace and watches the position move. It is
 * the same engine the laboratory uses.
 */

const STRATEGIES: { value: PlanningStrategy; label: string }[] = [
  { value: 'greedy', label: 'Greedy' },
  { value: 'fixed-plan', label: 'Fixed plan' },
  { value: 'search', label: 'Search' },
  { value: 'reflective', label: 'Reflective' },
]

export function PlanningDemo() {
  const [strategy, setStrategy] = useState<PlanningStrategy>('greedy')
  const [step, setStep] = useState(0)

  const run = useMemo(() => runPlanning(strategy, DEFAULT_WORLD), [strategy])
  const visible = Math.min(step, run.steps.length)
  const steps = run.steps.slice(0, visible)
  const position = steps.length > 0 ? steps[steps.length - 1].to : DEFAULT_WORLD.start
  const visited = new Set(steps.map((entry) => entry.to.join(',')))

  return (
    <DemoShell
      title="Why a greedy planner gets stuck"
      source="Ch. 6, §6.1–6.2; Ch. 9, §9.2"
      summary="Choose a planner and step through its run on the same grid. The door is locked until the agent holds the key, so a planner with no model of the lock has no way forward."
      controls={
        <div className="flex flex-wrap items-center gap-2">
          {STRATEGIES.map((entry) => (
            <Button
              key={entry.value}
              size="sm"
              variant={strategy === entry.value ? 'primary' : 'secondary'}
              onClick={() => {
                setStrategy(entry.value)
                setStep(0)
              }}
            >
              {entry.label}
            </Button>
          ))}
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
          <div
            className="grid shrink-0 gap-1"
            style={{ gridTemplateColumns: `repeat(${DEFAULT_WORLD.width}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: DEFAULT_WORLD.width * DEFAULT_WORLD.height }, (_unused, index) => {
              const x = index % DEFAULT_WORLD.width
              const y = Math.floor(index / DEFAULT_WORLD.width)
              const kind = cellKind(DEFAULT_WORLD, [x, y])
              const here = position[0] === x && position[1] === y
              const reached = visited.has(`${x},${y}`)
              const glyph =
                kind === 'start' ? 'S' : kind === 'goal' ? '★' : kind === 'key' ? '◆' : kind === 'door' ? '▤' : ''
              return (
                <div
                  key={`${x}-${y}`}
                  title={`(${x},${y}) ${kind}`}
                  className={cn(
                    'grid aspect-square w-8 place-items-center rounded-md border text-[10px] font-semibold',
                    here ? 'ring-2' : '',
                  )}
                  style={{
                    borderColor: here ? 'var(--accent)' : 'var(--border-soft)',
                    background: kind === 'wall' ? 'rgba(148,178,255,0.22)' : reached ? 'rgba(53,230,255,0.16)' : 'var(--surface-2)',
                    color: kind === 'goal' ? '#fbbf24' : kind === 'key' ? '#a78bfa' : 'inherit',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ...(here ? ({ ['--tw-ring-color']: 'var(--accent)' } as any) : {}),
                  }}
                >
                  {glyph}
                </div>
              )
            })}
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={run.reachedGoal ? 'emerald' : 'rose'}>{run.reachedGoal ? 'goal reached' : 'goal not reached'}</Badge>
              <Badge tone="neutral">{visible}/{run.steps.length} steps</Badge>
              <Badge tone={run.failures > 0 ? 'amber' : 'neutral'}>{run.failures} failures</Badge>
              {run.replans > 0 ? <Badge tone="violet">{run.replans} replans</Badge> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setStep((value) => Math.min(value + 1, run.steps.length))} disabled={visible >= run.steps.length}>
                Step
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStep((value) => Math.max(value - 1, 0))} disabled={visible === 0}>
                Back
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStep(run.steps.length)}>
                Show all
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStep(0)}>
                Reset
              </Button>
            </div>

            <ol className="thin-scroll max-h-40 space-y-1 overflow-y-auto pr-1">
              {steps.map((entry) => (
                <li
                  key={entry.index}
                  className="rounded border px-2 py-1"
                  style={{ borderColor: entry.failed ? 'rgba(251,113,133,0.45)' : 'var(--border-soft)' }}
                >
                  <span className="text-muted font-mono text-[10px]">#{entry.index + 1}</span>{' '}
                  <strong>{entry.action}</strong>{' '}
                  <span className="text-muted">
                    ({entry.from.join(',')}) → ({entry.to.join(',')})
                  </span>
                  <p className="text-muted mt-0.5">{entry.note}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <p className="text-muted text-[11px]">
          {run.reachedGoal
            ? 'This planner found the key, opened the door and reached the goal. Compare the step count with the greedy run.'
            : 'This planner never picked up the key, so the door stayed locked. Notice that the failures are not random: the planner repeats the same blocked move. That is the difference between a failure the agent can recover from and one it cannot.'}
        </p>
      </div>
    </DemoShell>
  )
}
