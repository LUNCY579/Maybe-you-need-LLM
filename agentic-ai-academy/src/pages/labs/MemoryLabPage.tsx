import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  DEFAULT_MEMORY_CONFIG,
  MEMORY_EVENTS,
  compareMemoryConfigs,
  runMemoryLab,
  type MemoryConfig,
  type RetrievalStrategy,
} from '../../engine/labs/memory'
import { Badge, Button, ChartFigure, Field, Panel, Select, Slider, StatTile } from '../../ui/primitives'
import { LabReflection } from '../../ui/lesson/LabReflection'
import { useProgress } from '../../store/progress'
import { LAB_BY_ID } from '../../content/labs'

const STRATEGIES: { value: RetrievalStrategy; label: string; description: string }[] = [
  { value: 'recency', label: 'Recency', description: 'Favours the newest events, mostly ignoring meaning.' },
  { value: 'relevance', label: 'Relevance', description: 'Favours keyword overlap with the current question.' },
  { value: 'importance', label: 'Importance', description: 'Favours facts marked critical regardless of age.' },
  { value: 'hybrid', label: 'Hybrid', description: 'Weighted blend of relevance and recency, with a small importance bonus.' },
]

export function MemoryLabPage() {
  const progress = useProgress()
  const lab = LAB_BY_ID.get('memory')
  const [config, setConfig] = useState<MemoryConfig>(DEFAULT_MEMORY_CONFIG)

  const run = useMemo(() => runMemoryLab(config), [config])
  const comparison = useMemo(() => compareMemoryConfigs(), [])
  const decision = run.decisions[0]

  const chartData = comparison.map((entry) => ({
    name: entry.label,
    storedCritical: entry.run.storedCritical,
    retrievedCritical: entry.run.retrievedCritical,
    correct: entry.run.accuracy === 1 ? 1 : 0,
  }))

  const update = (patch: Partial<MemoryConfig>) => {
    const next = { ...config, ...patch }
    setConfig(next)
    progress.recordLab('memory', `${next.strategy}:cap=${next.capacity}:weight=${next.relevanceWeight}`)
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="violet">Lab B</Badge>
          <Badge tone="neutral">Deterministic · salience eviction</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{lab?.name ?? 'Agent Memory'}</h1>
        <p className="text-muted max-w-3xl text-sm">{lab?.description}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Events in stream" value={String(MEMORY_EVENTS.length)} hint="Mix of critical, useful and noise items" />
        <StatTile label="Stored" value={String(run.timeline.at(-1)?.storeSize ?? 0)} hint={`Capacity ${config.capacity}`} />
        <StatTile label="Critical facts kept" value={`${run.storedCritical}/${run.totalCritical}`} hint={`${run.retrievedCritical} retrieved for the decision`} />
        <StatTile label="Decision correct" value={decision.correct ? 'yes' : 'no'} hint={config.strategy} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Panel title="Memory configuration" subtitle="Every change re-runs the simulation immediately.">
          <Field label="Retrieval strategy" hint={STRATEGIES.find((entry) => entry.value === config.strategy)?.description}>
            <Select
              label="Retrieval strategy"
              value={config.strategy}
              onChange={(value) => update({ strategy: value })}
              options={STRATEGIES.map((entry) => ({ value: entry.value, label: entry.label }))}
            />
          </Field>
          <Field label={`Capacity: ${config.capacity} items`} hint="When full, the lowest-salience item is evicted.">
            <Slider label="Memory capacity" value={config.capacity} min={1} max={12} onChange={(value) => update({ capacity: value })} />
          </Field>
          <Field label={`Top-k retrieval: ${config.topK}`}>
            <Slider label="Top-k retrieval" value={config.topK} min={1} max={8} onChange={(value) => update({ topK: value })} />
          </Field>
          <Field label={`Relevance weight: ${config.relevanceWeight.toFixed(2)}`} hint="Hybrid strategy only: 1.0 = meaning, 0.0 = recency.">
            <Slider
              label="Relevance weight"
              value={config.relevanceWeight}
              min={0}
              max={1}
              step={0.05}
              onChange={(value) => update({ relevanceWeight: value })}
            />
          </Field>
          <Field label={`Scratchpad budget: ${config.scratchpadTokens} words`} hint="Short-term memory: the recent tail of the conversation.">
            <Slider
              label="Scratchpad budget"
              value={config.scratchpadTokens}
              min={8}
              max={80}
              onChange={(value) => update({ scratchpadTokens: value })}
            />
          </Field>
          <Button size="sm" onClick={() => setConfig(DEFAULT_MEMORY_CONFIG)}>
            Restore recommended settings
          </Button>
        </Panel>

        <div className="space-y-4">
          <Panel title="Decision" subtitle={decision.question}>
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={decision.correct ? 'emerald' : 'rose'}>{decision.correct ? 'good decision' : 'bad decision'}</Badge>
                <span>{decision.decision}</span>
              </div>
              <p className="text-muted text-xs">{decision.explanation}</p>
            </div>
          </Panel>

          <Panel title="Retrieval" subtitle="Scores are relevance/recency blends as configured. Kept items become the agent's evidence.">
            <div className="space-y-2 text-xs">
              {decision.scores.map((entry) => {
                const event = MEMORY_EVENTS.find((candidate) => candidate.id === entry.id)
                const kept = decision.retrieved.some((item) => item.id === entry.id)
                return (
                  <div
                    key={entry.id}
                    className="surface-2 flex flex-wrap items-center gap-2 rounded border p-2"
                    style={{ borderColor: kept ? 'rgba(53,230,255,0.5)' : 'var(--border-soft)' }}
                  >
                    <Badge tone={kept ? 'cyan' : 'neutral'}>{kept ? 'kept' : 'omitted'}</Badge>
                    <span className="text-muted font-mono">{entry.score.toFixed(3)}</span>
                    <Badge tone={event?.importance === 'critical' ? 'rose' : event?.importance === 'useful' ? 'amber' : 'neutral'}>
                      {event?.importance ?? 'unknown'}
                    </Badge>
                    <span className="w-full sm:w-auto sm:flex-1">{event?.content}</span>
                  </div>
                )
              })}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Memory timeline" subtitle="What was stored, what was evicted on arrival, and the store size after each event.">
          <ol tabIndex={0} aria-label="Memory timeline" className="thin-scroll max-h-80 space-y-1.5 overflow-y-auto pr-1 text-xs focus-ring">
            {run.timeline.map((entry) => (
              <li key={entry.event.id} className="surface-2 rounded border p-2" style={{ borderColor: 'var(--border-soft)' }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted font-mono text-[10px]">t{entry.tick}</span>
                  <Badge tone={entry.stored ? 'emerald' : 'rose'}>{entry.stored ? 'stored' : 'evicted on arrival'}</Badge>
                  <Badge tone="neutral">store {entry.storeSize}</Badge>
                  <span className="text-muted">[{entry.event.channel}]</span>
                </div>
                <p className="mt-1">{entry.event.content}</p>
                {entry.evicted ? (
                  <p className="text-muted mt-1">Evicted: “{entry.evicted.content}” (salience {entry.evicted.salience})</p>
                ) : null}
              </li>
            ))}
          </ol>
        </Panel>

        <div className="space-y-4">
          <Panel title="Short-term memory (scratchpad)" subtitle={`Last ${config.scratchpadTokens} words retained in the working context.`}>
            <p className="text-muted text-xs leading-relaxed">{run.scratchpad.join(' ')}</p>
            {run.scratchpad.length < MEMORY_EVENTS.length ? (
              <p className="text-muted mt-2 text-[11px]">
                {MEMORY_EVENTS.length - run.scratchpad.length} earlier event(s) rolled out of the scratchpad — that information is only reachable if it
                made it into episodic memory.
              </p>
            ) : null}
          </Panel>

          <Panel title="Strategy comparison" subtitle="Critical facts kept and retrieved under four fixed configurations.">
            <ChartFigure
              title="Memory strategy comparison"
              description="For each retrieval configuration: how many critical facts were kept in memory, how many were retrieved, and whether the resulting decision was correct."
              columns={['Configuration', 'Critical kept', 'Critical retrieved', 'Decision correct']}
              rows={chartData.map((entry) => [entry.name, entry.storedCritical, entry.retrievedCritical, entry.correct])}
            >
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(148,178,255,0.12)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#9aa7c7" interval={0} angle={-8} height={40} />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9aa7c7" width={30} />
                    <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid rgba(148,178,255,0.25)', fontSize: 12 }} />
                    <Bar dataKey="storedCritical" fill="#35e6ff" name="critical kept" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="retrievedCritical" fill="#a78bfa" name="critical retrieved" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="correct" fill="#34d399" name="decision correct" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartFigure>
          </Panel>
        </div>
      </div>

      <Panel title="What to notice" subtitle="Discussion prompts for this lab.">
        <ul className="text-muted space-y-2 text-xs">
          <li>
            Capacity is a hard constraint, not a tuning detail: with a small store the agent keeps noise and evicts the nut-allergy constraint. That is
            the eviction-versus-importance trade-off from Ch. 9 §9.3.2.3.
          </li>
          <li>
            Pure recency retrieves the most recent events — often the least useful. Pure relevance can miss critical facts that share no keywords with
            the question. The hybrid weight lets you see the middle ground.
          </li>
          <li>
            The decision changes because the *evidence set* changed, not because the question did. Memory design is therefore a behavioural design
            choice, which is why the book's case study compares two memory architectures.
          </li>
          <li>
            This lab is a deterministic simulation of retrieval mechanics. In a real system the same mechanisms are fed by embeddings and a vector index
            (Ch. 12), with the same failure modes at the boundaries.
          </li>
        </ul>
      </Panel>

      <LabReflection labId="memory" />
    </div>
  )
}
