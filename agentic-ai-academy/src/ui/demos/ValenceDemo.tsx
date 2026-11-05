import { useMemo, useState } from 'react'
import { MEMORY_EPISODES, MEMORY_POLICIES, retrieve, type MemoryPolicy } from '../../engine/demos/valence'
import { Badge, Field } from '../primitives'
import { DemoShell } from './DemoShell'

/**
 * Bad is stronger than good.
 *
 * Chapter 18's case study is a controlled experiment: the same day of
 * events, the same agent, and one change to the memory function. The student
 * sees the two architectures retrieve different memories, and the agent
 * conclude different things about an identical day.
 *
 * The point is not that negative memories are "better". It is that the memory
 * function is a design decision with behavioural consequences, and that a
 * decision nobody made deliberately still makes the decision.
 */
export function ValenceDemo() {
  const [episodeId, setEpisodeId] = useState(MEMORY_EPISODES[0].id)
  const [policy, setPolicy] = useState<MemoryPolicy>('valence-blind')

  const episode = useMemo(
    () => MEMORY_EPISODES.find((entry) => entry.id === episodeId) ?? MEMORY_EPISODES[0],
    [episodeId],
  )
  const outcome = useMemo(() => retrieve(episode, policy), [episode, policy])
  const other = useMemo(
    () => retrieve(episode, policy === 'valence-blind' ? 'valence-sensitive' : 'valence-blind'),
    [episode, policy],
  )

  return (
    <DemoShell
      title="Bad is stronger than good"
      source="Ch. 18, §18.2–18.3 Case Study 4: simulating societies"
      summary="The same day, scored under two memory architectures. The events do not change; what the agent remembers does, and so does what it concludes."
      controls={
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Episode">
            <select
              aria-label="Choose an episode"
              value={episodeId}
              onChange={(event) => setEpisodeId(event.target.value)}
              className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
              style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
            >
              {MEMORY_EPISODES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Memory architecture">
            <select
              aria-label="Choose the memory architecture"
              value={policy}
              onChange={(event) => setPolicy(event.target.value as MemoryPolicy)}
              className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
              style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
            >
              {MEMORY_POLICIES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-muted text-sm leading-relaxed">{episode.context}</p>

        <p className="text-muted text-[11px] leading-relaxed">
          {MEMORY_POLICIES.find((entry) => entry.value === policy)?.description}
        </p>

        <ul className="space-y-1.5 text-xs">
          {episode.events.map((event) => {
            const recalled = outcome.recalled.some((entry) => entry.event.id === event.id)
            const score = outcome.recalled.find((entry) => entry.event.id === event.id)?.score
            return (
              <li
                key={event.id}
                className="surface-2 flex flex-wrap items-baseline gap-2 rounded-lg border px-2.5 py-1.5"
                style={{ borderColor: recalled ? 'var(--accent)' : 'var(--border-soft)' }}
              >
                <span className="min-w-0 flex-1">{event.text}</span>
                <span className="text-muted font-mono text-[10px]">
                  recency {event.recency.toFixed(2)} · relevance {event.relevance.toFixed(2)} ·
                  importance {event.importance.toFixed(2)}
                </span>
                {recalled ? (
                  <Badge tone="emerald">recalled (score {score?.toFixed(3)})</Badge>
                ) : (
                  <Badge tone="neutral">not recalled</Badge>
                )}
              </li>
            )
          })}
        </ul>

        <div
          className="rounded-lg border p-3 text-xs"
          style={{
            borderColor: outcome.verdict === 'negative' ? 'rgba(251,113,133,0.5)' : 'rgba(52,211,153,0.5)',
            background: outcome.verdict === 'negative' ? 'rgba(251,113,133,0.07)' : 'rgba(52,211,153,0.07)',
          }}
          role="status"
        >
          <p className="text-muted font-semibold">The agent concludes</p>
          <p className="mt-1 leading-relaxed">{outcome.conclusion}</p>
          <p className="text-muted mt-2 leading-relaxed">
            The other architecture would have concluded: {other.conclusion}
          </p>
        </div>

        <p className="text-muted text-[11px] leading-relaxed">{episode.note}</p>
      </div>
    </DemoShell>
  )
}
