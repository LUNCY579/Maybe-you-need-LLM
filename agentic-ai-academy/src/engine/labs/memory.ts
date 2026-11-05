/**
 * Lab B — Agent memory.
 *
 * A deterministic simulation of an agent that receives a stream of events,
 * stores as many as its capacity allows, retrieves candidates for a task, and
 * then makes a decision that depends on what was retrieved.
 *
 * Short-term memory  : the last N tokens of the current task (a scratchpad).
 * Episodic memory    : stored events with recency, subject to eviction.
 * Retrieval memory   : similarity-ranked access into the episodic store.
 */

export interface MemoryEvent {
  id: string
  /** Simulated time of arrival (0-based tick). */
  tick: number
  channel: 'user' | 'tool' | 'observation' | 'reflection'
  content: string
  keywords: string[]
  /** Importance of the fact for the eventual decision. */
  importance: 'critical' | 'useful' | 'noise'
  salience: number
}

export type RetrievalStrategy = 'recency' | 'relevance' | 'hybrid' | 'importance'

export interface MemoryConfig {
  /** How many events the episodic store keeps. */
  capacity: number
  /** Scratchpad size in "tokens" (approximated by words) for short-term memory. */
  scratchpadTokens: number
  strategy: RetrievalStrategy
  /** 0..1 — weight of relevance over recency for the hybrid strategy. */
  relevanceWeight: number
  /** How many items are retrieved per decision. */
  topK: number
}

export interface MemoryDecision {
  tick: number
  question: string
  retrieved: MemoryEvent[]
  omitted: MemoryEvent[]
  scores: { id: string; score: number }[]
  /** What the agent did, given what it could retrieve. */
  decision: string
  correct: boolean
  explanation: string
}

export interface MemoryRun {
  config: MemoryConfig
  timeline: {
    tick: number
    event: MemoryEvent
    stored: boolean
    evicted: MemoryEvent | null
    storeSize: number
    store: MemoryEvent[]
  }[]
  scratchpad: string[]
  decisions: MemoryDecision[]
  accuracy: number
  storedCritical: number
  totalCritical: number
  retrievedCritical: number
}

export const MEMORY_EVENTS: MemoryEvent[] = [
  {
    id: 'e1',
    tick: 0,
    channel: 'user',
    content: 'I need to travel to Utrecht on Thursday morning for a client meeting.',
    keywords: ['utrecht', 'thursday', 'travel', 'meeting'],
    importance: 'critical',
    salience: 0.9,
  },
  {
    id: 'e2',
    tick: 1,
    channel: 'observation',
    content: 'Weather forecast for Thursday: heavy rain in the afternoon.',
    keywords: ['weather', 'rain', 'thursday'],
    importance: 'useful',
    salience: 0.5,
  },
  {
    id: 'e3',
    tick: 2,
    channel: 'tool',
    content: 'Train timetable: Utrecht trains depart at 07:12, 09:12 and 11:12.',
    keywords: ['train', 'utrecht', 'timetable', 'departure'],
    importance: 'critical',
    salience: 0.85,
  },
  {
    id: 'e4',
    tick: 3,
    channel: 'user',
    content: 'By the way, I hate getting up before seven.',
    keywords: ['morning', 'preference', 'wake'],
    importance: 'useful',
    salience: 0.6,
  },
  {
    id: 'e5',
    tick: 4,
    channel: 'tool',
    content: 'Seat availability: 07:12 has 40 window seats; 09:12 has 2; 11:12 is full.',
    keywords: ['seat', 'window', 'availability', 'train'],
    importance: 'critical',
    salience: 0.8,
  },
  {
    id: 'e6',
    tick: 5,
    channel: 'observation',
    content: 'Office coffee machine is out of service.',
    keywords: ['coffee', 'office'],
    importance: 'noise',
    salience: 0.1,
  },
  {
    id: 'e7',
    tick: 6,
    channel: 'reflection',
    content: 'Last time I booked the 09:12 I arrived 20 minutes late for the meeting.',
    keywords: ['late', 'meeting', 'train', '09:12'],
    importance: 'critical',
    salience: 0.95,
  },
  {
    id: 'e8',
    tick: 7,
    channel: 'tool',
    content: 'Client email confirms the meeting starts at 10:00 sharp.',
    keywords: ['meeting', 'client', '10:00', 'sharp'],
    importance: 'critical',
    salience: 0.9,
  },
  {
    id: 'e9',
    tick: 8,
    channel: 'user',
    content: 'I prefer a window seat when I travel by rail.',
    keywords: ['window', 'seat', 'preference', 'rail'],
    importance: 'useful',
    salience: 0.7,
  },
  {
    id: 'e10',
    tick: 9,
    channel: 'observation',
    content: 'Station renovation: platform 5 is closed until further notice.',
    keywords: ['station', 'platform', 'closed'],
    importance: 'noise',
    salience: 0.2,
  },
  {
    id: 'e11',
    tick: 10,
    channel: 'tool',
    content: 'Alternative route via Amersfoort adds 25 minutes to the 07:12 departure.',
    keywords: ['amersfoort', 'route', 'delay', 'train'],
    importance: 'critical',
    salience: 0.85,
  },
  {
    id: 'e12',
    tick: 11,
    channel: 'reflection',
    content: 'Booking early is safer than optimising for the latest possible departure.',
    keywords: ['early', 'booking', 'safe'],
    importance: 'useful',
    salience: 0.65,
  },
]

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  capacity: 8,
  scratchpadTokens: 24,
  strategy: 'hybrid',
  relevanceWeight: 0.6,
  topK: 4,
}

export const DECISION_QUESTION = 'Which departure should I book for the Utrecht meeting?'

/**
 * Retrieval query used for scoring. It is deliberately keyword-shaped: an agent
 * that retrieves well formulates a query rather than pasting the raw question
 * (Ch. 12 §12.4, query rewriting).
 */
export const RETRIEVAL_QUERY = 'departure train utrecht meeting late window preference'

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'book',
  'do',
  'for',
  'i',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'should',
  'the',
  'to',
  'which',
])

function terms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1 && !STOPWORDS.has(term))
}

export function scoreEvent(event: MemoryEvent, query: string, config: MemoryConfig, now: number): number {
  const queryTerms = terms(query)
  const haystack = `${event.content} ${event.keywords.join(' ')}`.toLowerCase()
  const overlap = queryTerms.length === 0 ? 0 : queryTerms.filter((term) => haystack.includes(term)).length / queryTerms.length
  const recency = 1 / (1 + Math.max(0, now - event.tick))
  const importance = event.importance === 'critical' ? 1 : event.importance === 'useful' ? 0.6 : 0.2

  switch (config.strategy) {
    case 'recency':
      return round(0.85 * recency + 0.15 * importance)
    case 'relevance':
      return round(0.9 * overlap + 0.1 * event.salience)
    case 'importance':
      return round(0.8 * importance + 0.2 * event.salience)
    case 'hybrid':
    default:
      return round(config.relevanceWeight * overlap + (1 - config.relevanceWeight) * recency + 0.05 * importance)
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * The decision the agent reaches given what it retrieved.
 *
 * The safe answer (depart on the 07:12 with buffer) requires three independent
 * facts to reach the store and survive retrieval: the departure list, the
 * failure memory about the 09:12, and the detour affecting the 07:12. The
 * meeting time improves the answer from defensible to verified. That requirement
 * is what makes the lab sensitive to capacity and retrieval quality.
 */
/**
 * Word-boundary containment check.
 *
 * Substring matching is not good enough here: "Alternative" contains "late",
 * which would silently make the agent believe it had retrieved a failure
 * memory. That is exactly the kind of quiet bug this lab is meant to expose.
 */
function hasPhrase(haystack: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack)
}

function decide(retrieved: MemoryEvent[]): { decision: string; correct: boolean; explanation: string } {
  const contents = retrieved.map((event) => event.content.toLowerCase()).join(' ')

  const knowsMeeting = hasPhrase(contents, '10:00') || hasPhrase(contents, 'client meeting')
  const knowsTiming = ['07:12', '09:12', '11:12'].some((time) => hasPhrase(contents, time))
  const knowsLateness = hasPhrase(contents, 'late')
  const knowsPreference = hasPhrase(contents, 'window') || hasPhrase(contents, 'before seven')
  const knowsRoute = hasPhrase(contents, 'amersfoort') && hasPhrase(contents, '25 minutes')

  if (knowsTiming && knowsRoute && knowsLateness) {
    return {
      decision: knowsPreference
        ? 'Book the 07:12 window seat and allow for the 25-minute detour; avoid the 09:12 you were late on before.'
        : 'Book the 07:12 and allow for the 25-minute detour; avoid the 09:12 you were late on before.',
      correct: true,
      explanation: knowsMeeting
        ? 'The agent retrieved the departure list, the meeting time, the reflection about arriving late on the 09:12, and the detour affecting the 07:12 — enough evidence to prefer the earlier, slower departure. Retrieval quality, not reasoning capacity, decided this outcome.'
        : 'The agent retrieved the departure list, the failure memory about the 09:12, and the detour affecting the 07:12. It did not retrieve the meeting time, so the decision rests on avoiding a known failure rather than on verifying the arrival constraint — a good outcome from partial evidence.',
    }
  }
  if (knowsTiming && knowsMeeting && knowsLateness && !knowsRoute) {
    return {
      decision: 'Book the 09:12 to leave later, since the earlier option is a longer trip.',
      correct: false,
      explanation:
        'The agent knew it had been late on the 09:12 but never retrieved the detour fact that explains why the earlier departure is still the safer choice. It resolved the trade-off with a guess.',
    }
  }
  if (knowsTiming && knowsMeeting && !knowsLateness) {
    return {
      decision: 'Book the 09:12; it is the latest train that still arrives before 10:00.',
      correct: false,
      explanation:
        'The departure list and meeting time were retrieved, but the reflection about arriving late on the 09:12 was not. The agent optimised departure time and ignored the failure memory that would have changed the answer.',
    }
  }
  if (knowsTiming && !knowsMeeting) {
    return {
      decision: 'Book the 09:12 because it is the busiest train in the list.',
      correct: false,
      explanation: 'Without the meeting time the agent has no constraint to reason about, so it picks a plausible-looking train.',
    }
  }
  if (knowsRoute) {
    return {
      decision: 'Take the alternative route via Amersfoort to be safe.',
      correct: false,
      explanation: 'A single salient fact dominated the decision: the classic recency-dominated retrieval failure.',
    }
  }
  return {
    decision: 'Ask the user to repeat the request; nothing relevant was retrieved.',
    correct: false,
    explanation:
      'Nothing relevant survived eviction or retrieval. This is the observable cost of a store that is too small, a weak strategy, or a query that never reached the useful facts.',
  }
}

export function runMemoryLab(config: MemoryConfig = DEFAULT_MEMORY_CONFIG): MemoryRun {
  const timeline: MemoryRun['timeline'] = []
  let store: MemoryEvent[] = []
  const scratchpad: string[] = []

  MEMORY_EVENTS.forEach((event) => {
    let evicted: MemoryEvent | null = null
    store = [...store, event]
    if (store.length > config.capacity) {
      const sorted = [...store].sort((a, b) => a.salience - b.salience || a.tick - b.tick)
      evicted = sorted[0]
      store = store.filter((candidate) => candidate.id !== evicted!.id)
    }

    const scratchEntry = `[${event.tick}] ${event.content}`
    scratchpad.push(scratchEntry)
    let words = scratchpad.join(' ').split(/\s+/).length
    while (words > config.scratchpadTokens && scratchpad.length > 1) {
      scratchpad.shift()
      words = scratchpad.join(' ').split(/\s+/).length
    }

    timeline.push({ tick: event.tick, event, stored: !evicted || evicted.id !== event.id, evicted, storeSize: store.length, store: [...store] })
  })

  const now = MEMORY_EVENTS.length - 1
  const scored = store
    .map((event) => ({ event, score: scoreEvent(event, RETRIEVAL_QUERY, config, now) }))
    .sort((a, b) => b.score - a.score || a.event.id.localeCompare(b.event.id))
  const retrieved = scored.slice(0, Math.min(config.topK, scored.length)).map((entry) => entry.event)
  const outcome = decide(retrieved)

  const decisions: MemoryDecision[] = [
    {
      tick: now,
      question: DECISION_QUESTION,
      retrieved,
      omitted: store.filter((event) => !retrieved.includes(event)),
      scores: scored.map((entry) => ({ id: entry.event.id, score: entry.score })),
      decision: outcome.decision,
      correct: outcome.correct,
      explanation: outcome.explanation,
    },
  ]

  const critical = MEMORY_EVENTS.filter((event) => event.importance === 'critical')
  const storedCritical = critical.filter((event) => store.some((item) => item.id === event.id)).length
  const retrievedCritical = critical.filter((event) => retrieved.some((item) => item.id === event.id)).length

  return {
    config,
    timeline,
    scratchpad,
    decisions,
    accuracy: outcome.correct ? 1 : 0,
    storedCritical,
    totalCritical: critical.length,
    retrievedCritical,
  }
}

/** Pre-computed comparison used by the lab UI. */
export function compareMemoryConfigs(): { label: string; run: MemoryRun }[] {
  const configs: { label: string; config: MemoryConfig }[] = [
    { label: 'Small store, recency only', config: { ...DEFAULT_MEMORY_CONFIG, capacity: 2, strategy: 'recency', topK: 2 } },
    { label: 'Relevance only', config: { ...DEFAULT_MEMORY_CONFIG, strategy: 'relevance', relevanceWeight: 1 } },
    { label: 'Important facts only', config: { ...DEFAULT_MEMORY_CONFIG, strategy: 'importance' } },
    { label: 'Hybrid (default)', config: DEFAULT_MEMORY_CONFIG },
  ]
  return configs.map((entry) => ({ label: entry.label, run: runMemoryLab(entry.config) }))
}
