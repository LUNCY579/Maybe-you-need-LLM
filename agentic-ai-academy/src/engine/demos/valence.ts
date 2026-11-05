/**
 * Bad is stronger than good: a memory architecture decides the conclusion.
 *
 * Chapter 18 is a case study in social simulation, and its experiment is
 * unusually clean. The Generative Agents framework gives each character three
 * components — a memory stream, a retrieval function, and a reflection
 * mechanism — and the retrieval function scores memories by *recency*,
 * *importance* and *relevance*. The personality is a short natural-language
 * description included in every prompt.
 *
 * The case study's twist is that the original memory system is
 * **valence-blind**: a criticism and a compliment are encoded and retrieved
 * with equal weight. The chapter then runs the same scenario with a
 * valence-sensitive variant — the NEVER model, in which negative memories get
 * a higher importance score, so they are more likely to be retrieved and more
 * likely to trigger reflections — and the point is what happens to the
 * collective behaviour.
 *
 * The chapter's conclusion is that the architectural choice has measurable
 * consequences, and that agents are fragile: "a single word in a personality
 * description, or a subtle change in memory weighting, can fundamentally
 * alter how an agent acts, plans, and reflects".
 *
 * This engine models the part that can be modelled honestly: the retrieval
 * function. The same day of events is scored under two architectures, and the
 * agent's summary of it is computed from what it retrieved. The day is
 * identical. The conclusion is not.
 */

export interface MemoryEvent {
  id: string
  text: string
  /** Whether the event was good, bad, or neither. */
  valence: 'positive' | 'negative' | 'neutral'
  /** How recently it happened, in [0, 1]. */
  recency: number
  /** How relevant it is to the situation the agent is in, in [0, 1]. */
  relevance: number
  /** Its salience, before any valence is taken into account, in [0, 1]. */
  importance: number
}

export type MemoryPolicy = 'valence-blind' | 'valence-sensitive'

export const MEMORY_POLICIES: { value: MemoryPolicy; label: string; description: string }[] = [
  {
    value: 'valence-blind',
    label: 'Valence-blind (the original)',
    description:
      'Criticism and compliment are encoded and retrieved with equal weight, as long as they are equally recent, equally relevant and equally important. This is how the Generative Agents simulation worked.',
  },
  {
    value: 'valence-sensitive',
    label: 'Valence-sensitive (NEVER)',
    description:
      'Negative memories get a higher importance score at encoding time, so they are more likely to be retrieved and more likely to trigger reflections. Everything else is identical, which is what makes it an experiment rather than an anecdote.',
  },
]

/** How much more important a negative memory is, under the NEVER model. */
export const NEGATIVE_BOOST = 1.8

export interface MemoryEpisode {
  id: string
  title: string
  context: string
  /** The day, in the order it happened. */
  events: MemoryEvent[]
  /** How many memories the agent retrieves when it needs to act. */
  retrieved: number
  /** The note on what the episode is for. */
  note: string
}

export interface RetrievalResult {
  policy: MemoryPolicy
  /** The memories the agent retrieved, most relevant first. */
  recalled: { event: MemoryEvent; score: number }[]
  /** The memories it did not retrieve. */
  forgotten: { event: MemoryEvent; score: number }[]
  /** The mean valence of what was retrieved: positive, negative, or mixed. */
  verdict: 'positive' | 'negative' | 'mixed'
  /** A one-sentence summary of what the agent concluded about the day. */
  conclusion: string
}

/**
 * The retrieval score.
 *
 * Recency, relevance and importance multiply, as in the Generative Agents
 * retrieval function. The only difference between the two architectures is
 * what happens to a negative memory's importance.
 */
export function score(event: MemoryEvent, policy: MemoryPolicy): number {
  const importance =
    policy === 'valence-sensitive' && event.valence === 'negative'
      ? Math.min(1, event.importance * NEGATIVE_BOOST)
      : event.importance
  return event.recency * event.relevance * importance
}

/** The mean valence of a set of retrieved memories. */
function verdictOf(events: MemoryEvent[]): 'positive' | 'negative' | 'mixed' {
  if (events.length === 0) return 'mixed'
  const positive = events.filter((event) => event.valence === 'positive').length
  const negative = events.filter((event) => event.valence === 'negative').length
  if (positive === 0 && negative === 0) return 'mixed'
  if (positive > negative) return 'positive'
  if (negative > positive) return 'negative'
  return 'mixed'
}

/** Retrieve the agent's memories under one architecture. */
export function retrieve(episode: MemoryEpisode, policy: MemoryPolicy): RetrievalResult {
  const scored = episode.events.map((event) => ({ event, score: score(event, policy) }))
  const ordered = [...scored].sort((a, b) => b.score - a.score || a.event.id.localeCompare(b.event.id))
  const recalled = ordered.slice(0, episode.retrieved)
  const forgotten = ordered.slice(episode.retrieved)

  const verdict = verdictOf(recalled.map((entry) => entry.event))
  const conclusion =
    verdict === 'positive'
      ? 'Looking back on the day, it went well.'
      : verdict === 'negative'
        ? 'Looking back on the day, it went badly.'
        : 'Looking back on the day, it was mixed.'

  return { policy, recalled, forgotten, verdict, conclusion }
}

/* ------------------------------------------------------------------ */
/* Episodes                                                            */
/* ------------------------------------------------------------------ */

export const MEMORY_EPISODES: MemoryEpisode[] = [
  {
    id: 'day',
    title: 'One day at the office',
    context:
      'The agent met four people and did four things. Two of them went well and two did not. When it needs to act, it retrieves a single memory — and that one memory is what it acts on, so which memory it is decides everything.',
    retrieved: 1,
    note:
      'Under the original architecture the two memories that are equally recent, equally relevant and equally important are retrieved at random between them, so the day comes out as it was. Under the valence-sensitive architecture the negative one wins, and the agent concludes the day went badly — on the same evidence.',
    events: [
      {
        id: 'e1',
        text: 'A colleague praised the report you sent.',
        valence: 'positive',
        recency: 0.9,
        relevance: 0.9,
        importance: 0.7,
      },
      {
        id: 'e2',
        text: 'A colleague criticized the report you sent.',
        valence: 'negative',
        recency: 0.9,
        relevance: 0.9,
        importance: 0.7,
      },
      {
        id: 'e3',
        text: 'The deploy went out on time.',
        valence: 'positive',
        recency: 0.5,
        relevance: 0.4,
        importance: 0.6,
      },
      {
        id: 'e4',
        text: 'The deploy broke the staging environment.',
        valence: 'negative',
        recency: 0.5,
        relevance: 0.4,
        importance: 0.6,
      },
      {
        id: 'e5',
        text: 'Lunch was fine.',
        valence: 'neutral',
        recency: 0.3,
        relevance: 0.2,
        importance: 0.2,
      },
    ],
  },
  {
    id: 'meeting',
    title: 'A difficult meeting',
    context:
      'The agent came out of a meeting. Two things are worth remembering and they point in opposite directions. Which one it recalls decides what it does next, and what it does next is what the rest of the system sees.',
    retrieved: 1,
    note:
      'Here the tie is between a single compliment and a single criticism. The architecture does not change what happened, or how much it mattered — only which of the two the agent is carrying when it acts.',
    events: [
      {
        id: 'm1',
        text: 'Your proposal was well received by the group.',
        valence: 'positive',
        recency: 0.95,
        relevance: 0.9,
        importance: 0.75,
      },
      {
        id: 'm2',
        text: 'Your proposal was challenged by the group.',
        valence: 'negative',
        recency: 0.95,
        relevance: 0.9,
        importance: 0.75,
      },
      {
        id: 'm3',
        text: 'The room was hard to hear in.',
        valence: 'neutral',
        recency: 0.4,
        relevance: 0.3,
        importance: 0.3,
      },
    ],
  },
]

export const MEMORY_EPISODE_BY_ID = new Map(MEMORY_EPISODES.map((entry) => [entry.id, entry]))
