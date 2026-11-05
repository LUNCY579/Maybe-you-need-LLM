/**
 * Lab B extension — the durability of long-term memory, and a *learned* write policy.
 *
 * `memory.ts` answers "what did the working store keep and retrieve?". Two questions
 * it cannot answer are answered here, on the same event stream:
 *
 * (a) Hierarchical long-term memory with a forgetting curve (MemoryBank, Ch. 9
 *     §9.3.2.3). Below the finite working store sits a durable store that keeps
 *     per-event traces, per-session summaries built from those traces, and a rolling
 *     profile built from the summaries. Every durable item decays on an Ebbinghaus
 *     curve R = e^(-t/S) and jumps back when it is rehearsed. The lab measures what
 *     the curve costs: which facts fall below the consolidation threshold, how many
 *     of them are the ones the task needs, and how much rehearsing them earlier
 *     would have saved.
 *
 * (b) A learned counterpart to explicit memory management (Mem-α, Ch. 9 §9.3.2.3).
 *     Writing to memory is treated as an action — ADD / UPDATE / DELETE / NONE —
 *     chosen by a tabular softmax policy trained with REINFORCE against a reward
 *     computed from *later retrieval success*. It is compared with the hand-written
 *     rule of `memory.ts` (write everything, evict the lowest-salience item) on
 *     critical facts retained, wrong-fact writes, store size and decision accuracy,
 *     and the run reports how many parameter updates parity took.
 *
 * The event stream is synthetic and comes from `memory.ts`; it is a measuring
 * instrument. No model is called, no embedding is used, and no number from either
 * paper is reproduced. Everything here is deterministic: the durability layer has no
 * randomness at all, and the trained policy is seeded through `prng.ts`.
 */

import { createRng, type Rng } from '../prng'
import {
  DEFAULT_MEMORY_CONFIG,
  MEMORY_EVENTS,
  RETRIEVAL_QUERY,
  runMemoryLab,
  scoreEvent,
  type MemoryConfig,
  type MemoryEvent,
  type RetrievalStrategy,
} from './memory'

/* ------------------------------------------------------------------ */
/* Shared vocabulary over the event stream                              */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'by',
  'for',
  'from',
  'has',
  'have',
  'i',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'the',
  'to',
  'when',
  'with',
  'you',
])

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOPWORDS.has(term))
}

/** Word-boundary containment, for the same reason `memory.ts` needs it. */
function hasPhrase(haystack: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack)
}

type Importance = MemoryEvent['importance']

const IMPORTANCE_RANK: Record<Importance, number> = { noise: 0, useful: 1, critical: 2 }

function stronger(a: Importance, b: Importance): Importance {
  return IMPORTANCE_RANK[a] >= IMPORTANCE_RANK[b] ? a : b
}

/** Query terms the task is actually asked with, taken from `memory.ts`. */
export const QUERY_TERMS = tokens(RETRIEVAL_QUERY)

/** A stored fact is "on task" when it shares a keyword with the retrieval query. */
export function sharesQueryTerm(event: MemoryEvent): boolean {
  return event.keywords.some((keyword) => QUERY_TERMS.includes(keyword.toLowerCase()))
}

/**
 * The facts the decision needs, computed rather than asserted: the events marked
 * critical in the stream that carry at least one term of `RETRIEVAL_QUERY`. In this
 * stream every critical fact qualifies, which is what makes the forgetting curve
 * measurable against something the task cares about.
 */
export const REQUIRED_FACT_IDS = MEMORY_EVENTS.filter((event) => event.importance === 'critical' && sharesQueryTerm(event)).map(
  (event) => event.id,
)

export const REQUIRED_FACTS = MEMORY_EVENTS.filter((event) => REQUIRED_FACT_IDS.includes(event.id))

/** Fraction of a fact's keywords a durable item still carries. */
export function detailCoverage(fact: MemoryEvent, item: { keywords: string[]; text: string }): number {
  const haystack = new Set([...item.keywords.map((keyword) => keyword.toLowerCase()), ...tokens(item.text)])
  const hits = fact.keywords.filter((keyword) => haystack.has(keyword.toLowerCase())).length
  return fact.keywords.length === 0 ? 0 : hits / fact.keywords.length
}

/** A durable item "still has" a fact at this much of its detail. */
export const FULL_COVERAGE = 0.75

function estimateWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

/* ------------------------------------------------------------------ */
/* (a) Hierarchical durable store with an Ebbinghaus curve              */
/* ------------------------------------------------------------------ */

export interface LongevityConfig {
  /** Ticks without rehearsal at which an average item retains e⁻¹ ≈ 37%. */
  baseStability: number
  /** Multiplier applied to stability on every rehearsal — the spacing benefit. */
  stabilityGain: number
  /** Retention below which a durable item is considered forgotten. */
  consolidationThreshold: number
  /** Events folded into one level-1 session summary. */
  sessionLength: number
  /** Topics each summary keeps. This is the abstraction cost of the hierarchy. */
  topicsPerSummary: number
  /** Tick the durability is measured at. */
  horizonTick: number
  /** Scheduled recall every N ticks. 0 = only natural rehearsal by new events. */
  rehearsalInterval: number
  /** Keyword hits by a new event needed to count as a rehearsal of an item. */
  rehearsalOverlap: number
  /**
   * Stability a consolidated summary gains per fact folded into it. A summary is
   * rehearsed by every one of its constituents, so consolidating buys durability —
   * and, as the topic cut shows, pays for it in detail.
   */
  consolidationBonus: number
}

export const DEFAULT_LONGEVITY_CONFIG: LongevityConfig = {
  baseStability: 14,
  stabilityGain: 0.6,
  consolidationThreshold: 0.4,
  sessionLength: 4,
  topicsPerSummary: 8,
  horizonTick: 48,
  rehearsalInterval: 0,
  rehearsalOverlap: 1,
  consolidationBonus: 0.35,
}

/** The rehearsal spacings the lab sweeps to price "recalling them earlier". */
export const REHEARSAL_SWEEP = [0, 8, 16, 24, 32, 48]

export type DurableLevel = 0 | 1 | 2

export type DurabilityStatus = 'alive' | 'forgotten' | 'compacted'

export interface DurableItem {
  id: string
  level: DurableLevel
  /** 'event' | 'session' | 'profile' — the layer the item belongs to. */
  layer: 'event' | 'session' | 'profile'
  text: string
  keywords: string[]
  sourceEventIds: string[]
  /** How many distinct events this item carries: 1 for a trace, more for a summary. */
  facts: number
  salience: number
  maxImportance: Importance
  createdAtTick: number
  lastRehearsalTick: number
  rehearsals: number
  /** The Ebbinghaus stability S of this item, grown by rehearsal. */
  stability: number
  /** Retention at the tick it was lost, or at the horizon if it survived. */
  retention: number
  status: DurabilityStatus
  lostAtTick: number | null
  words: number
}

/**
 * R = e^(-t/S): the classic memory curve, with S grown by rehearsal. Recall resets
 * the elapsed clock *and* increases S, which is why spacing beats cramming here.
 */
export function retentionAt(item: Pick<DurableItem, 'stability' | 'lastRehearsalTick'>, tick: number): number {
  const elapsed = Math.max(0, tick - item.lastRehearsalTick)
  return Math.exp(-elapsed / Math.max(0.5, item.stability))
}

function stabilityOf(config: LongevityConfig, salience: number, rehearsals: number): number {
  return config.baseStability * (0.5 + salience) * (1 + config.stabilityGain) ** rehearsals
}

/**
 * The stability an item is written with. A consolidated item is as stable as the
 * strongest fact it carries, times a bonus for every further fact folded into it:
 * the summary is re-activated by all of them, which is the durability a hierarchy
 * buys — and, as the topic budget shows, pays for in detail.
 */
function stabilityFor(config: LongevityConfig, salience: number, facts: number, rehearsals: number): number {
  return stabilityOf(config, salience, rehearsals) * (1 + config.consolidationBonus * Math.max(0, facts - 1))
}

export interface DurabilityPoint {
  tick: number
  level0Alive: number
  level1Alive: number
  level2Alive: number
  /** Mean retention across the items still alive at this tick. */
  meanRetention: number
  /** Mean keyword coverage of the required facts across surviving items. */
  detailRetained: number
  /** Required facts still held at `FULL_COVERAGE` or better. */
  criticalRetained: number
  /** Which required facts those were, so a fact's own lifetime can be read off the curve. */
  retainedIds: string[]
  forgottenTotal: number
}

/** A durable item that fell below the consolidation threshold, at whichever level it lived. */
export interface ForgottenItem {
  itemId: string
  level: DurableLevel
  layer: 'event' | 'session' | 'profile'
  text: string
  /** Required facts this item carried, i.e. would take them out of the store with it. */
  requiredCarried: string[]
  facts: number
  rehearsals: number
  stability: number
  forgottenAtTick: number
  /** Retention at the tick it was dropped: by construction below the threshold. */
  retentionAtLoss: number
}

/**
 * One required fact's whole lifetime in the durable store: when it was last held, when
 * it fell, which item was carrying it, and — from the counterfactual replay — whether
 * the curve or the summary's topic budget took it.
 */
export interface FactOutcome {
  eventId: string
  content: string
  importance: Importance
  salience: number
  /** Last tick at which some standing item still held it at `FULL_COVERAGE`. */
  lastHeldTick: number
  /** First tick after which it was never held again; `null` when it survives to the horizon. */
  droppedAtTick: number | null
  heldAtHorizon: boolean
  /** Detail coverage at the end of the stream and at the horizon, for the gap between them. */
  coverageAtStreamEnd: number
  coverageAtHorizon: number
  carrierId: string
  carrierLayer: DurableItem['layer']
  carrierStatus: DurabilityStatus
  /** How many facts the carrier holds: 1 for a trace, more for a summary. */
  carrierFacts: number
  carrierRehearsals: number
  carrierStability: number
  cause: 'held' | 'decay' | 'abstraction'
}

export interface DurabilityMetrics {
  totalEvents: number
  createdItems: number
  requiredFacts: number
  /** Required facts still held at `FULL_COVERAGE` or better at the horizon. */
  criticalRetained: number
  criticalRetainedIds: string[]
  criticalForgotten: string[]
  /**
   * Why each lost fact was lost, measured as a counterfactual rather than assumed.
   * The identical stream is replayed with the consolidation threshold set to zero, so
   * nothing can be forgotten by decay; whatever is still missing in *that* run was
   * dropped by the summary's topic budget (abstraction), and the extra facts the real
   * run loses on top of it are the price of the curve itself (decay).
   */
  criticalLostToAbstraction: string[]
  criticalLostToDecay: string[]
  /** Mean detail coverage in the no-decay replay: the ceiling abstraction allows. */
  detailRetentionWithoutDecay: number
  /** Which required fact fell when, and why. */
  factOutcomes: FactOutcome[]
  /** Every durable item the curve dropped, at any level, with the facts it carried. */
  forgotten: ForgottenItem[]
  forgottenTotal: number
  meanRetention: number
  meanDetailRetention: number
  aliveItems: number
  storedWords: number
  /** Detail coverage lost at the moment the traces were folded into summaries. */
  detailLossAtCompaction: number
}

export interface LongevityRun {
  config: LongevityConfig
  compact: boolean
  rehearsalInterval: number
  items: DurableItem[]
  sessions: DurableItem[]
  profile: DurableItem | null
  curve: DurabilityPoint[]
  metrics: DurabilityMetrics
  /** The working store's own verdict, so the two layers can be read side by side. */
  working: {
    config: MemoryConfig
    storeIds: string[]
    evictedIds: string[]
    /**
     * Per fact the working store evicted: how much detail the durable layer still
     * held for it at the end of the stream, and how much it held at the horizon. The
     * gap between the two columns is the forgetting curve reaching across layers.
     */
    evictedDetail: { eventId: string; atStreamEnd: number; atHorizon: number }[]
    /** Facts the working store threw away that the durable layer still fully holds. */
    recoveredByDurable: string[]
  }
}

export interface DurabilityOptions {
  /** Fold session traces into summaries (hierarchical) or keep them (flat). */
  compact: boolean
  rehearsalInterval?: number
}

/** A durable item while the simulation is still moving it: the same record, mutated. */
type MutableItem = DurableItem

function salienceWeightedTopics(candidates: { keywords: string[]; text: string; salience: number }[], limit: number): string[] {
  const weights = new Map<string, number>()
  const order = new Map<string, number>()
  for (const candidate of candidates) {
    const declared = new Set(candidate.keywords.map((keyword) => keyword.toLowerCase()))
    const seen = new Set<string>()
    for (const term of [...declared, ...tokens(candidate.text)]) {
      if (seen.has(term)) continue
      seen.add(term)
      const weight = candidate.salience * (declared.has(term) ? 1.5 : 1)
      weights.set(term, (weights.get(term) ?? 0) + weight)
      if (!order.has(term)) order.set(term, order.size)
    }
  }
  return [...weights.entries()]
    .sort((a, b) => b[1] - a[1] || (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
    .slice(0, Math.max(1, limit))
    .map(([term]) => term)
}

function summariseSession(index: number, folded: MutableItem[], config: LongevityConfig): DurableItem {
  const first = folded.reduce((min, item) => Math.min(min, item.createdAtTick), Number.POSITIVE_INFINITY)
  const last = folded.reduce((max, item) => Math.max(max, item.createdAtTick), 0)
  const meanSalience = folded.reduce((sum, item) => sum + item.salience, 0) / folded.length
  const peakSalience = Math.max(...folded.map((item) => item.salience))
  const critical = folded.filter((item) => item.maxImportance === 'critical').length
  const useful = folded.filter((item) => item.maxImportance === 'useful').length
  const noise = folded.length - critical - useful
  const keywords = salienceWeightedTopics(folded, config.topicsPerSummary)
  const text =
    `Session ${index + 1} (t${first}–t${last}) · ${folded.length} events, critical ${critical} / useful ${useful} / noise ${noise} · ` +
    `mean salience ${round(meanSalience)}, peak ${round(peakSalience)} · topics: ${keywords.join(', ')}`
  return {
    id: `s${index + 1}`,
    level: 1,
    layer: 'session',
    text,
    keywords,
    sourceEventIds: folded.flatMap((item) => item.sourceEventIds),
    facts: folded.reduce((sum, item) => sum + item.facts, 0),
    salience: peakSalience,
    maxImportance: folded.reduce((best, item) => stronger(best, item.maxImportance), 'noise' as Importance),
    createdAtTick: last,
    lastRehearsalTick: last,
    rehearsals: 0,
    stability: stabilityFor(config, peakSalience, folded.length, 0),
    retention: 1,
    status: 'alive',
    lostAtTick: null,
    words: estimateWords(text),
  }
}

function summariseProfile(index: number, children: MutableItem[], config: LongevityConfig, tick: number): DurableItem {
  const keywords = salienceWeightedTopics(children, config.topicsPerSummary)
  const eventCount = children.reduce((sum, item) => sum + item.sourceEventIds.length, 0)
  const critical = children.reduce((sum, item) => sum + item.sourceEventIds.filter((id) => REQUIRED_FACT_IDS.includes(id)).length, 0)
  const meanSalience = children.reduce((sum, item) => sum + item.salience, 0) / children.length
  const peakSalience = Math.max(...children.map((item) => item.salience))
  const text =
    `Profile v${index + 1} (t${tick}) · ${children.length} session summaries over ${eventCount} events, ` +
    `${critical} required-fact mentions · mean salience ${round(meanSalience)}, peak ${round(peakSalience)} · topics: ${keywords.join(', ')}`
  return {
    id: `p${index + 1}`,
    level: 2,
    layer: 'profile',
    text,
    keywords,
    sourceEventIds: children.flatMap((item) => item.sourceEventIds),
    facts: eventCount,
    salience: peakSalience,
    maxImportance: children.reduce((best, item) => stronger(best, item.maxImportance), 'noise' as Importance),
    createdAtTick: tick,
    lastRehearsalTick: tick,
    rehearsals: 0,
    stability: stabilityFor(config, peakSalience, eventCount, 0),
    retention: 1,
    status: 'alive',
    lostAtTick: null,
    words: estimateWords(text),
  }
}

function coverageOfRequired(items: MutableItem[]): { mean: number; retained: number; retainedIds: string[] } {
  let sum = 0
  const retainedIds: string[] = []
  for (const fact of REQUIRED_FACTS) {
    let best = 0
    for (const item of items) {
      if (item.status !== 'alive') continue
      best = Math.max(best, detailCoverage(fact, item))
    }
    sum += best
    if (best >= FULL_COVERAGE) retainedIds.push(fact.id)
  }
  return { mean: sum / REQUIRED_FACTS.length, retained: retainedIds.length, retainedIds }
}

/** How much an arriving event rehearses an existing durable item. */
function rehearsalCredit(config: LongevityConfig, item: MutableItem, incoming: MemoryEvent): number {
  const shared = new Set(incoming.keywords.filter((keyword) => item.keywords.some((held) => held.toLowerCase() === keyword.toLowerCase())))
  for (const term of tokens(incoming.content)) {
    if (item.keywords.includes(term)) shared.add(term)
  }
  return shared.size >= config.rehearsalOverlap ? shared.size : 0
}

/**
 * `attribution` is an internal flag: the outer run replays itself once with the
 * consolidation threshold at zero, so the loss can be split into what the summary's
 * topic budget caused and what the decay curve caused on top of it.
 */
export function simulateDurability(
  config: LongevityConfig = DEFAULT_LONGEVITY_CONFIG,
  options: DurabilityOptions = { compact: true },
  working: MemoryConfig = DEFAULT_MEMORY_CONFIG,
  attribution = true,
): LongevityRun {
  const rehearsalInterval = options.rehearsalInterval ?? config.rehearsalInterval
  const created: MutableItem[] = []
  const curve: DurabilityPoint[] = []
  const compact = options.compact
  let detailLoss = 0
  let sessionCounter = 0
  let streamEndStanding: DurableItem[] = []

  const alive = () => created.filter((item) => item.status === 'alive')

  const rehearse = (item: MutableItem, tick: number) => {
    item.rehearsals += 1
    item.lastRehearsalTick = tick
    item.stability = stabilityFor(config, item.salience, item.facts, item.rehearsals)
  }

  for (let tick = 0; tick <= config.horizonTick; tick += 1) {
    /* 1 — arrival: a level-0 trace is written for the event, then re-encounters
          rehearse the durable items they overlap with. */
    if (tick < MEMORY_EVENTS.length) {
      const event = MEMORY_EVENTS[tick]
      for (const item of alive()) {
        if (rehearsalCredit(config, item, event) > 0) rehearse(item, tick)
      }
      const trace: MutableItem = {
        id: `f${event.id}`,
        level: 0,
        layer: 'event',
        text: `[${event.tick}] [${event.channel}] ${event.content}`,
        keywords: [...event.keywords],
        sourceEventIds: [event.id],
        facts: 1,
        salience: event.salience,
        maxImportance: event.importance,
        createdAtTick: tick,
        lastRehearsalTick: tick,
        rehearsals: 0,
        stability: stabilityFor(config, event.salience, 1, 0),
        retention: 1,
        status: 'alive',
        lostAtTick: null,
        words: estimateWords(event.content),
      }
      created.push(trace)
    }

    /* 2 — consolidation: the session that just closed is folded into a level-1
          summary, and (hierarchical only) its traces leave the store. */
    const sessionClosed = compact && tick < MEMORY_EVENTS.length && (tick + 1) % config.sessionLength === 0
    if (sessionClosed) {
      const sessionEvents = MEMORY_EVENTS.slice(tick - config.sessionLength + 1, tick + 1)
      const folded = created.filter(
        (item) => item.level === 0 && item.sourceEventIds.length > 0 && sessionEvents.some((event) => item.sourceEventIds.includes(event.id)),
      )
      const available = folded.filter((item) => item.status === 'alive')
      if (available.length > 0) {
        const before = coverageOfRequired(alive())
        const summary = summariseSession(sessionCounter, available, config)
        for (const item of available) {
          item.status = 'compacted'
          item.lostAtTick = tick
          item.retention = retentionAt(item, tick)
        }
        created.push(summary)
        sessionCounter += 1
        const after = coverageOfRequired(alive())
        detailLoss += Math.max(0, before.mean - after.mean)

        /* The rolling profile is rebuilt from the summaries that still exist, and
           rebuilding counts as a rehearsal of nothing else — it is a new trace. */
        const children = alive().filter((item) => item.level === 1)
        if (children.length > 0) {
          for (const child of alive().filter((item) => item.level === 2)) {
            child.status = 'compacted'
            child.lostAtTick = tick
            child.retention = retentionAt(child, tick)
          }
          created.push(summariseProfile(children.length - 1, children, config, tick))
        }
      }
    }

    /* 3 — scheduled rehearsal (spaced recall of everything still standing). */
    if (rehearsalInterval > 0 && tick > 0 && tick % rehearsalInterval === 0) {
      for (const item of alive()) rehearse(item, tick)
    }

    /* 4 — decay and the consolidation threshold. */
    for (const item of alive()) {
      item.retention = retentionAt(item, tick)
      if (item.retention < config.consolidationThreshold) {
        item.status = 'forgotten'
        item.lostAtTick = tick
      }
    }

    const standing = alive()
    const coverage = coverageOfRequired(standing)
    if (tick === MEMORY_EVENTS.length - 1) streamEndStanding = standing.map((item) => ({ ...item }))
    curve.push({
      tick,
      level0Alive: standing.filter((item) => item.level === 0).length,
      level1Alive: standing.filter((item) => item.level === 1).length,
      level2Alive: standing.filter((item) => item.level === 2).length,
      meanRetention: standing.length === 0 ? 0 : round(standing.reduce((sum, item) => sum + item.retention, 0) / standing.length),
      detailRetained: round(coverage.mean),
      criticalRetained: coverage.retained,
      retainedIds: [...coverage.retainedIds],
      forgottenTotal: created.filter((item) => item.status === 'forgotten').length,
    })
  }

  const final = alive()
  const coverage = coverageOfRequired(final)
  const forgotten: ForgottenItem[] = created
    .filter((item) => item.status === 'forgotten')
    .map((item) => ({
      itemId: item.id,
      level: item.level,
      layer: item.layer,
      text: item.text,
      requiredCarried: item.sourceEventIds.filter((id) => REQUIRED_FACT_IDS.includes(id)),
      facts: item.facts,
      rehearsals: item.rehearsals,
      stability: round(item.stability),
      forgottenAtTick: item.lostAtTick ?? config.horizonTick,
      retentionAtLoss: round(item.retention),
    }))
    .sort((a, b) => a.forgottenAtTick - b.forgottenAtTick || a.level - b.level)

  const workingRun = runMemoryLab(working)
  const storeIds = workingRun.timeline.at(-1)?.store.map((event) => event.id) ?? []
  const evictedIds = MEMORY_EVENTS.map((event) => event.id).filter((id) => !storeIds.includes(id))
  const bestCoverage = (id: string, items: DurableItem[]) => {
    const fact = MEMORY_EVENTS.find((event) => event.id === id)
    if (!fact) return 0
    return items.reduce((max, item) => Math.max(max, detailCoverage(fact, item)), 0)
  }
  const evictedDetail = evictedIds.map((id) => ({
    eventId: id,
    atStreamEnd: round(bestCoverage(id, streamEndStanding)),
    atHorizon: round(bestCoverage(id, final)),
  }))
  const recoveredByDurable = evictedIds.filter((id) => bestCoverage(id, final) >= FULL_COVERAGE)

  /* Split the lost critical facts by cause, measured as a counterfactual: replay the
     identical stream with no forgetting at all, and whatever is still missing there was
     dropped by the summary's topic budget. Only the extra losses are the curve's. */
  const criticalForgotten = REQUIRED_FACT_IDS.filter((id) => !coverage.retainedIds.includes(id))
  let criticalLostToAbstraction: string[] = []
  let criticalLostToDecay = criticalForgotten
  let detailRetentionWithoutDecay = round(coverage.mean)
  if (attribution && config.consolidationThreshold > 0) {
    const noDecay = simulateDurability({ ...config, consolidationThreshold: 0 }, options, working, false)
    criticalLostToAbstraction = noDecay.metrics.criticalForgotten
    criticalLostToDecay = criticalForgotten.filter((id) => !criticalLostToAbstraction.includes(id))
    detailRetentionWithoutDecay = noDecay.metrics.meanDetailRetention
  }

  /* Each required fact's own lifetime, read off the curve it was recorded on. */
  const coverageOver = (fact: MemoryEvent, items: DurableItem[]) =>
    items.reduce((max, item) => Math.max(max, detailCoverage(fact, item)), 0)
  const factOutcomes: FactOutcome[] = REQUIRED_FACTS.map((fact) => {
    const heldTicks = curve.filter((point) => point.retainedIds.includes(fact.id)).map((point) => point.tick)
    const lastHeldTick = heldTicks.length > 0 ? Math.max(...heldTicks) : -1
    const after = curve.find((point) => point.tick > lastHeldTick && !point.retainedIds.includes(fact.id))
    const held = coverage.retainedIds.includes(fact.id)
    const droppedAt = held ? config.horizonTick : lastHeldTick === -1 ? 0 : (after?.tick ?? config.horizonTick)
    /* The item responsible for the fact at the tick that matters: one of the standing
       holders at the horizon if it survived, otherwise something that had been written
       by the drop tick and was still standing on it. */
    const carriers = created.filter((item) => (held ? item.status === 'alive' : item.createdAtTick <= droppedAt && (item.lostAtTick === null || item.lostAtTick >= droppedAt)))
    const carrier = carriers.reduce<{ item: MutableItem; coverage: number } | null>(
      (best, item) => {
        const value = detailCoverage(fact, item)
        return value > (best?.coverage ?? 0) ? { item, coverage: value } : best
      },
      null,
    )
    return {
      eventId: fact.id,
      content: fact.content,
      importance: fact.importance,
      salience: fact.salience,
      lastHeldTick,
      droppedAtTick: held ? null : droppedAt,
      heldAtHorizon: held,
      coverageAtStreamEnd: round(coverageOver(fact, streamEndStanding)),
      coverageAtHorizon: round(coverageOver(fact, final)),
      carrierId: carrier?.item.id ?? 'none',
      carrierLayer: carrier?.item.layer ?? 'event',
      carrierStatus: carrier?.item.status ?? 'alive',
      carrierFacts: carrier?.item.facts ?? 0,
      carrierRehearsals: carrier?.item.rehearsals ?? 0,
      carrierStability: round(carrier?.item.stability ?? 0),
      cause: held ? 'held' : criticalLostToAbstraction.includes(fact.id) ? 'abstraction' : 'decay',
    }
  })

  return {
    config,
    compact,
    rehearsalInterval,
    items: created.map((item) => ({ ...item, retention: round(item.status === 'alive' ? retentionAt(item, config.horizonTick) : item.retention) })),
    sessions: created.filter((item) => item.level === 1).map((item) => ({ ...item })),
    profile: created.filter((item) => item.level === 2).slice(-1)[0] ?? null,
    curve,
    metrics: {
      totalEvents: MEMORY_EVENTS.length,
      createdItems: created.length,
      requiredFacts: REQUIRED_FACTS.length,
      criticalRetained: coverage.retained,
      criticalRetainedIds: coverage.retainedIds,
      criticalForgotten,
      criticalLostToDecay,
      criticalLostToAbstraction,
      detailRetentionWithoutDecay,
      factOutcomes,
      forgotten,
      forgottenTotal: created.filter((item) => item.status === 'forgotten').length,
      meanRetention: round(coverage.mean === 0 && final.length === 0 ? 0 : final.reduce((sum, item) => sum + item.retention, 0) / Math.max(1, final.length)),
      meanDetailRetention: round(coverage.mean),
      aliveItems: final.length,
      storedWords: final.reduce((sum, item) => sum + item.words, 0),
      detailLossAtCompaction: round(detailLoss),
    },
    working: { config: working, storeIds, evictedIds, evictedDetail, recoveredByDurable },
  }
}

/** The hierarchical layer as configured: per-event traces folded into summaries. */
export function runLongevityLab(config: LongevityConfig = DEFAULT_LONGEVITY_CONFIG, working: MemoryConfig = DEFAULT_MEMORY_CONFIG): LongevityRun {
  return simulateDurability(config, { compact: true }, working)
}

/** The flat layer: every event keeps its own trace, nothing is folded. */
export function runFlatLongevityLab(config: LongevityConfig = DEFAULT_LONGEVITY_CONFIG, working: MemoryConfig = DEFAULT_MEMORY_CONFIG): LongevityRun {
  return simulateDurability(config, { compact: false }, working)
}

export interface RehearsalScheduleResult {
  interval: number
  label: string
  run: LongevityRun
  criticalRetained: number
  criticalForgotten: number
  meanDetailRetention: number
  meanRetention: number
  forgottenTotal: number
  /** Required facts this schedule saves compared with no scheduled rehearsal. */
  savedCritical: number
}

/**
 * Price the curve: run the identical stream under each rehearsal spacing and count
 * which facts the earlier recall brought back above the threshold.
 */
export function sweepRehearsalIntervals(
  config: LongevityConfig = DEFAULT_LONGEVITY_CONFIG,
  intervals: number[] = REHEARSAL_SWEEP,
  working: MemoryConfig = DEFAULT_MEMORY_CONFIG,
): RehearsalScheduleResult[] {
  const runs = intervals.map((interval) => {
    const run = simulateDurability(config, { compact: true, rehearsalInterval: interval }, working)
    return {
      interval,
      label: interval === 0 ? 'no schedule' : `every ${interval} ticks`,
      run,
      criticalRetained: run.metrics.criticalRetained,
      criticalForgotten: run.metrics.criticalForgotten.length,
      meanDetailRetention: run.metrics.meanDetailRetention,
      meanRetention: run.metrics.meanRetention,
      forgottenTotal: run.metrics.forgottenTotal,
      savedCritical: 0,
    }
  })
  const baseline = runs.find((entry) => entry.interval === 0) ?? runs[0]
  for (const entry of runs) entry.savedCritical = entry.criticalRetained - baseline.criticalRetained
  return runs
}

export interface LayerComparison {
  flat: LongevityRun
  hierarchical: LongevityRun
  /** Positive = the hierarchy holds more detail; negative = it lost some. */
  detailGap: number
  criticalGap: number
  /** The compaction step itself, measured: detail the summaries could not carry. */
  detailLossAtCompaction: number
}

export function compareDurabilityLayers(
  config: LongevityConfig = DEFAULT_LONGEVITY_CONFIG,
  working: MemoryConfig = DEFAULT_MEMORY_CONFIG,
): LayerComparison {
  const flat = simulateDurability(config, { compact: false }, working)
  const hierarchical = simulateDurability(config, { compact: true }, working)
  return {
    flat,
    hierarchical,
    detailGap: round(hierarchical.metrics.meanDetailRetention - flat.metrics.meanDetailRetention),
    criticalGap: hierarchical.metrics.criticalRetained - flat.metrics.criticalRetained,
    detailLossAtCompaction: hierarchical.metrics.detailLossAtCompaction,
  }
}

/* ------------------------------------------------------------------ */
/* (b) A learned write policy versus the hand-written rule              */
/* ------------------------------------------------------------------ */

export type WriteAction = 'add' | 'update' | 'delete' | 'none'

export const WRITE_ACTIONS: WriteAction[] = ['add', 'update', 'delete', 'none']

export const WRITE_ACTION_LABELS: Record<WriteAction, string> = {
  add: 'ADD — store the incoming fact as its own item',
  update: 'UPDATE — fold it into the most similar stored item',
  delete: 'DELETE — drop the item it supersedes, then store it',
  none: 'NONE — do not write it',
}

export interface WritePolicyConfig {
  /** How many items the memory store may hold. */
  capacity: number
  /** Items handed to the decision. */
  topK: number
  strategy: RetrievalStrategy
  relevanceWeight: number
  episodes: number
  learningRate: number
  baselineRate: number
  startTemperature: number
  endTemperature: number
  /** Cost of a stored item, as a fraction of the store budget. */
  sizePenalty: number
  /** Cost of a stored fact that shares no term with the query. */
  wrongWritePenalty: number
  /** Credit for producing a store that answers the task correctly. */
  decisionBonus: number
  seed: number
  evalEvery: number
}

export const DEFAULT_WRITE_POLICY_CONFIG: WritePolicyConfig = {
  capacity: 6,
  topK: 4,
  strategy: 'hybrid',
  relevanceWeight: 0.6,
  episodes: 300,
  learningRate: 0.4,
  baselineRate: 0.25,
  startTemperature: 1.2,
  endTemperature: 0.1,
  sizePenalty: 0.4,
  wrongWritePenalty: 0.3,
  decisionBonus: 0.5,
  seed: 7,
  evalEvery: 10,
}

interface StoredFact {
  /** The pseudo-event a store item becomes when retrieval scores it. */
  asEvent: MemoryEvent
  mergedFrom: string[]
}

function salienceBucket(salience: number): number {
  return Math.min(3, Math.floor(salience / 0.25))
}

function overlapCount(a: string[], b: string[]): number {
  const lower = new Set(b.map((keyword) => keyword.toLowerCase()))
  return a.filter((keyword) => lower.has(keyword.toLowerCase())).length
}

function mostSimilar(store: StoredFact[], event: MemoryEvent): number {
  let best = -1
  let bestScore = 0
  store.forEach((item, index) => {
    const score = overlapCount(item.asEvent.keywords, event.keywords)
    if (score > bestScore) {
      bestScore = score
      best = index
    }
  })
  return best
}

function stateKey(store: StoredFact[], event: MemoryEvent, capacity: number): string {
  const overlaps = store.filter((item) => overlapCount(item.asEvent.keywords, event.keywords) > 0).length
  const novelty = Math.min(2, overlaps)
  return `${event.channel}|s${salienceBucket(event.salience)}|n${novelty}|${store.length >= capacity ? 'full' : 'room'}`
}

/** The capacity constraint the store obeys whatever action was chosen. */
function trimToCapacity(store: StoredFact[], capacity: number): StoredFact[] {
  const next = [...store]
  while (next.length > capacity) {
    let worst = 0
    next.forEach((item, index) => {
      if (item.asEvent.salience < next[worst].asEvent.salience) worst = index
    })
    next.splice(worst, 1)
  }
  return next
}

/** The hand-written rule of `memory.ts`: always write, evict the lowest-salience item. */
function ruleStep(store: StoredFact[], event: MemoryEvent, capacity: number): StoredFact[] {
  return trimToCapacity([...store, { asEvent: { ...event }, mergedFrom: [event.id] }], capacity)
}

function applyWriteAction(store: StoredFact[], event: MemoryEvent, action: WriteAction, capacity: number): { store: StoredFact[]; note: string } {
  if (action === 'none') return { store, note: 'ignored' }

  if (action === 'add') {
    return { store: ruleStep(store, event, capacity), note: store.length > capacity ? 'written, lowest-salience item dropped' : 'written' }
  }

  const target = mostSimilar(store, event)

  if (action === 'update') {
    if (target === -1) return { store, note: 'no similar item — the write was wasted' }
    const next = [...store]
    const existing = next[target]
    const mergedContent = `${existing.asEvent.content} ${event.content}`
    next[target] = {
      asEvent: {
        ...existing.asEvent,
        content: mergedContent,
        keywords: [...new Set([...existing.asEvent.keywords, ...event.keywords])],
        salience: Math.max(existing.asEvent.salience, event.salience),
        importance: stronger(existing.asEvent.importance, event.importance),
        tick: event.tick,
        channel: event.channel,
      },
      mergedFrom: [...existing.mergedFrom, event.id],
    }
    return { store: next, note: `merged into ${existing.asEvent.id}` }
  }

  // delete: supersede the item it replaces, then write the new fact.
  const next = target === -1 ? [...store] : store.filter((_, index) => index !== target)
  next.push({ asEvent: { ...event }, mergedFrom: [event.id] })
  return {
    store: trimToCapacity(next, capacity),
    note: target === -1 ? 'nothing to supersede — written' : `superseded ${store[target].asEvent.id}`,
  }
}

/** Which required facts the decision could still act on, and the resulting answer. */
function judgeDecision(retrieved: MemoryEvent[]): boolean {
  const contents = retrieved.map((event) => event.content.toLowerCase()).join(' ')
  const knowsTiming = ['07:12', '09:12', '11:12'].some((time) => hasPhrase(contents, time))
  const knowsLateness = hasPhrase(contents, 'late')
  const knowsRoute = hasPhrase(contents, 'amersfoort') && hasPhrase(contents, '25 minutes')
  return knowsTiming && knowsLateness && knowsRoute
}

export interface WriteEvaluation {
  label: string
  /** Required facts still held at `FULL_COVERAGE` or better in the final store. */
  criticalRetained: number
  totalRequired: number
  /** Required facts the retrieval step actually put in front of the decision. */
  criticalRetrieved: number
  retrievedIds: string[]
  /** Stored facts that share no term with the query — the wrong-fact writes. */
  wrongWrites: number
  storeSize: number
  storedWords: number
  decisionCorrect: boolean
  evidenceCoverage: number
  reward: number
  actions: Record<WriteAction, number>
  trace: { eventId: string; state: string; action: WriteAction; note: string }[]
}

function retrievalConfig(config: WritePolicyConfig, capacity: number): MemoryConfig {
  return {
    capacity,
    scratchpadTokens: DEFAULT_MEMORY_CONFIG.scratchpadTokens,
    strategy: config.strategy,
    relevanceWeight: config.relevanceWeight,
    topK: config.topK,
  }
}

function evaluateStore(store: StoredFact[], config: WritePolicyConfig, label: string, trace: WriteEvaluation['trace']): WriteEvaluation {
  const now = MEMORY_EVENTS.at(-1)?.tick ?? 0
  const retrieval = retrievalConfig(config, config.capacity)
  const events = store.map((item) => item.asEvent)
  const scored = events
    .map((event) => ({ event, score: scoreEvent(event, RETRIEVAL_QUERY, retrieval, now) }))
    .sort((a, b) => b.score - a.score || a.event.id.localeCompare(b.event.id))
  const retrieved = scored.slice(0, Math.min(config.topK, scored.length)).map((entry) => entry.event)

  let coverageSum = 0
  let retained = 0
  for (const fact of REQUIRED_FACTS) {
    const best = events.reduce((max, item) => Math.max(max, detailCoverage(fact, { keywords: item.keywords, text: item.content })), 0)
    coverageSum += best
    if (best >= FULL_COVERAGE) retained += 1
  }

  let retrievedCount = 0
  for (const fact of REQUIRED_FACTS) {
    const best = retrieved.reduce((max, item) => Math.max(max, detailCoverage(fact, { keywords: item.keywords, text: item.content })), 0)
    if (best >= FULL_COVERAGE) retrievedCount += 1
  }

  const wrongWrites = events.filter((event) => !sharesQueryTerm(event)).length
  const decisionCorrect = judgeDecision(retrieved)
  const evidenceCoverage = round(coverageSum / Math.max(1, REQUIRED_FACTS.length))
  const actions = trace.reduce(
    (counts, entry) => {
      counts[entry.action] += 1
      return counts
    },
    { add: 0, update: 0, delete: 0, none: 0 } as Record<WriteAction, number>,
  )

  const reward = round(
    evidenceCoverage +
      (decisionCorrect ? config.decisionBonus : 0) -
      config.sizePenalty * (store.length / Math.max(1, config.capacity)) -
      config.wrongWritePenalty * wrongWrites,
  )

  return {
    label,
    criticalRetained: retained,
    totalRequired: REQUIRED_FACTS.length,
    criticalRetrieved: retrievedCount,
    retrievedIds: retrieved.map((event) => event.id),
    wrongWrites,
    storeSize: store.length,
    storedWords: store.reduce((sum, item) => sum + estimateWords(item.asEvent.content), 0),
    decisionCorrect,
    evidenceCoverage,
    reward,
    actions,
    trace,
  }
}

/** The hand-written rule of `memory.ts`, replayed on this stream with this budget. */
export function runRulePolicy(config: WritePolicyConfig = DEFAULT_WRITE_POLICY_CONFIG, capacity = config.capacity): WriteEvaluation {
  let store: StoredFact[] = []
  const trace: WriteEvaluation['trace'] = []
  for (const event of MEMORY_EVENTS) {
    store = ruleStep(store, event, capacity)
    trace.push({ eventId: event.id, state: stateKey(store, event, capacity), action: 'add', note: 'rule: write, evict lowest salience' })
  }
  return evaluateStore(store, { ...config, capacity }, 'hand-written rule', trace)
}

function softmax(values: number[], temperature: number): number[] {
  const scale = Math.max(0.02, temperature)
  const max = Math.max(...values)
  const exps = values.map((value) => Math.exp((value - max) / scale))
  const total = exps.reduce((sum, value) => sum + value, 0)
  return exps.map((value) => value / total)
}

interface PolicyTable {
  logits: Record<string, number[]>
  value: Record<string, number>
  visits: Record<string, number>
}

function emptyPolicy(): PolicyTable {
  return { logits: {}, value: {}, visits: {} }
}

function ensureState(policy: PolicyTable, state: string): void {
  if (!policy.logits[state]) {
    policy.logits[state] = [0, 0, 0, 0]
    policy.value[state] = 0
    policy.visits[state] = 0
  }
}

interface EpisodeDecision {
  state: string
  action: WriteAction
  /** The probabilities the action was drawn under (greedy softmax when evaluating). */
  probabilities: number[]
  note: string
}

/**
 * One pass over the event stream. With a generator the policy samples from its
 * softmax (exploration); without one it takes the argmax, which is the deterministic
 * policy the lab reports and plots.
 */
function playEpisode(policy: PolicyTable, config: WritePolicyConfig, rng: Rng | null, temperature: number): { evaluation: WriteEvaluation; decisions: EpisodeDecision[] } {
  let store: StoredFact[] = []
  const trace: WriteEvaluation['trace'] = []
  const decisions: EpisodeDecision[] = []
  for (const event of MEMORY_EVENTS) {
    const state = stateKey(store, event, config.capacity)
    ensureState(policy, state)
    const probabilities = softmax(policy.logits[state], rng ? temperature : 1)
    let chosen: number
    if (rng) {
      let roll = rng.next()
      chosen = 0
      for (let index = 0; index < probabilities.length; index += 1) {
        roll -= probabilities[index]
        if (roll <= 0) {
          chosen = index
          break
        }
      }
    } else {
      chosen = policy.logits[state].reduce((top, value, index) => (value > policy.logits[state][top] ? index : top), 0)
    }
    const action = WRITE_ACTIONS[chosen]
    const outcome = applyWriteAction(store, event, action, config.capacity)
    store = outcome.store
    trace.push({ eventId: event.id, state, action, note: outcome.note })
    decisions.push({ state, action, probabilities, note: outcome.note })
  }
  return { evaluation: evaluateStore(store, config, rng ? 'sampled episode' : 'greedy episode', trace), decisions }
}

export interface WriteTrainingPoint {
  episode: number
  /** Return of the sampled (exploring) episode. */
  sampledReward: number
  /** Moving mean of the sampled returns over the last 10 episodes. */
  movingMean: number
  /** Return of the deterministic greedy policy at this point in training. */
  greedyReward: number
  greedyCriticalRetained: number
  greedyWrongWrites: number
  greedyStoreSize: number
  ruleReward: number
  temperature: number
  statesSeen: number
  updates: number
  atLeastRule: boolean
}

export interface LearnedPolicyRow {
  state: string
  visits: number
  choice: WriteAction
  probabilities: Record<WriteAction, number>
}

export interface WritePolicyRun {
  config: WritePolicyConfig
  rule: WriteEvaluation
  learned: WriteEvaluation
  curve: WriteTrainingPoint[]
  /** First evaluation at which the learned policy reached or passed the rule. */
  parityEpisode: number | null
  parityUpdates: number | null
  /** First evaluation where it also matched on every quality column, not just reward. */
  qualityParityEpisode: number | null
  episodes: number
  updates: number
  states: number
  policy: LearnedPolicyRow[]
  /** Decision correctness across how much of the store the decision is allowed to see. */
  decisionAccuracy: { topK: number; learned: boolean; rule: boolean; learnedCritical: number; ruleCritical: number }[]
  learnedAccuracy: number
  ruleAccuracy: number
}

/** How many stored items the decision is shown — the budget that makes merging pay. */
export const TOPK_SWEEP = [1, 2, 3, 4, 6]

export function runWritePolicyLab(config: WritePolicyConfig = DEFAULT_WRITE_POLICY_CONFIG): WritePolicyRun {
  const rng = createRng(config.seed)
  const policy = emptyPolicy()
  const rule = runRulePolicy(config)
  const curve: WriteTrainingPoint[] = []
  const sampled: number[] = []
  let parityEpisode: number | null = null
  let qualityParityEpisode: number | null = null
  const span = Math.max(1, config.episodes - 1)

  for (let episode = 0; episode < config.episodes; episode += 1) {
    const temperature = config.startTemperature + (config.endTemperature - config.startTemperature) * (episode / span)

    /* One explored episode: the (state, action, probability) triples are collected,
       then every one of them is credited with the Monte-Carlo return of the *later*
       retrieval — REINFORCE with a per-state average baseline. */
    const explored = playEpisode(policy, config, rng, temperature)
    for (const decision of explored.decisions) policy.visits[decision.state] += 1

    const totalReturn = explored.evaluation.reward
    sampled.push(totalReturn)

    for (const decision of explored.decisions) {
      const advantage = totalReturn - policy.value[decision.state]
      const taken = WRITE_ACTIONS.indexOf(decision.action)
      for (let action = 0; action < WRITE_ACTIONS.length; action += 1) {
        // ∇ log π(a|s) for a tabular softmax: 1 for the taken action, minus π.
        const gradient = (action === taken ? 1 : 0) - decision.probabilities[action]
        policy.logits[decision.state][action] += config.learningRate * advantage * gradient
      }
      policy.value[decision.state] += config.baselineRate * advantage
    }

    if (episode % config.evalEvery === 0 || episode === config.episodes - 1) {
      const greedy = playEpisode(policy, config, null, 0).evaluation
      const window = sampled.slice(-10)
      const atLeastRule = greedy.reward >= rule.reward
      if (atLeastRule && parityEpisode === null) parityEpisode = episode
      const qualityMatch =
        greedy.criticalRetained >= rule.criticalRetained &&
        greedy.wrongWrites <= rule.wrongWrites &&
        greedy.storeSize <= rule.storeSize &&
        (!rule.decisionCorrect || greedy.decisionCorrect)
      if (qualityMatch && qualityParityEpisode === null) qualityParityEpisode = episode
      curve.push({
        episode,
        sampledReward: round(totalReturn),
        movingMean: round(window.reduce((sum, value) => sum + value, 0) / window.length),
        greedyReward: greedy.reward,
        greedyCriticalRetained: greedy.criticalRetained,
        greedyWrongWrites: greedy.wrongWrites,
        greedyStoreSize: greedy.storeSize,
        ruleReward: rule.reward,
        temperature: round(temperature),
        statesSeen: Object.keys(policy.logits).length,
        updates: (episode + 1) * MEMORY_EVENTS.length,
        atLeastRule,
      })
    }
  }

  const learned = playEpisode(policy, config, null, 0).evaluation
  const rows = Object.entries(policy.logits).map(([state, values]) => {
    const probabilities = softmax(values, 1)
    const best = values.reduce((top, value, index) => (value > values[top] ? index : top), 0)
    return {
      state,
      visits: policy.visits[state],
      choice: WRITE_ACTIONS[best],
      probabilities: WRITE_ACTIONS.reduce(
        (record, action, index) => {
          record[action] = round(probabilities[index])
          return record
        },
        {} as Record<WriteAction, number>,
      ),
    }
  })
  rows.sort((a, b) => a.state.localeCompare(b.state))

  const sweep = TOPK_SWEEP.map((topK) => {
    const sweptConfig = { ...config, topK }
    const greedy = playEpisode(policy, sweptConfig, null, 0).evaluation
    const ruleAtTopK = runRulePolicy(sweptConfig)
    return {
      topK,
      learned: greedy.decisionCorrect,
      rule: ruleAtTopK.decisionCorrect,
      learnedCritical: greedy.criticalRetained,
      ruleCritical: ruleAtTopK.criticalRetained,
    }
  })

  return {
    config,
    rule,
    learned,
    curve,
    parityEpisode,
    parityUpdates: parityEpisode === null ? null : (parityEpisode + 1) * MEMORY_EVENTS.length,
    qualityParityEpisode,
    episodes: config.episodes,
    updates: config.episodes * MEMORY_EVENTS.length,
    states: rows.length,
    policy: rows,
    decisionAccuracy: sweep,
    learnedAccuracy: round(sweep.filter((entry) => entry.learned).length / sweep.length),
    ruleAccuracy: round(sweep.filter((entry) => entry.rule).length / sweep.length),
  }
}
