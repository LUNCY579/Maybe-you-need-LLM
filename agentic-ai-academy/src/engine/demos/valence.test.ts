import { describe, expect, it } from 'vitest'
import {
  MEMORY_EPISODES,
  MEMORY_EPISODE_BY_ID,
  NEGATIVE_BOOST,
  retrieve,
  score,
  type MemoryEpisode,
} from './valence'

const day = MEMORY_EPISODE_BY_ID.get('day') as MemoryEpisode
const meeting = MEMORY_EPISODE_BY_ID.get('meeting') as MemoryEpisode

describe('the valence demonstration', () => {
  it('scores a memory by recency, relevance and importance', () => {
    const event = day.events[0]
    expect(score(event, 'valence-blind')).toBeCloseTo(
      event.recency * event.relevance * event.importance,
    )
  })

  it('boosts a negative memory only under the valence-sensitive policy', () => {
    const negative = day.events.find((event) => event.valence === 'negative')!
    const positive = day.events.find((event) => event.valence === 'positive')!

    expect(score(negative, 'valence-sensitive')).toBeGreaterThan(score(negative, 'valence-blind'))
    expect(score(positive, 'valence-sensitive')).toBeCloseTo(score(positive, 'valence-blind'))
    expect(NEGATIVE_BOOST).toBeGreaterThan(1)
  })

  it('changes what the agent concludes, on the same day', () => {
    const blind = retrieve(day, 'valence-blind')
    const sensitive = retrieve(day, 'valence-sensitive')

    // The events are identical; what the agent carries is not.
    expect(blind.recalled.map((entry) => entry.event.id)).not.toEqual(
      sensitive.recalled.map((entry) => entry.event.id),
    )
    expect(blind.verdict).toBe('positive')
    expect(sensitive.verdict).toBe('negative')
    expect(blind.conclusion).toMatch(/well/i)
    expect(sensitive.conclusion).toMatch(/badly/i)
  })

  it('retrieves the criticism rather than the compliment when the two tie', () => {
    const blind = retrieve(meeting, 'valence-blind')
    const sensitive = retrieve(meeting, 'valence-sensitive')

    // The tie is broken by the id under the blind policy, and by the
    // architecture under the sensitive one.
    expect(blind.recalled).toHaveLength(1)
    expect(sensitive.recalled).toHaveLength(1)
    expect(sensitive.recalled[0].event.valence).toBe('negative')
  })

  it('never retrieves more than the episode asks for', () => {
    for (const episode of MEMORY_EPISODES) {
      for (const policy of ['valence-blind', 'valence-sensitive'] as const) {
        const outcome = retrieve(episode, policy)
        expect(outcome.recalled.length).toBe(Math.min(episode.retrieved, episode.events.length))
        expect(outcome.recalled.length + outcome.forgotten.length).toBe(episode.events.length)
      }
    }
  })

  it('is deterministic', () => {
    expect(retrieve(day, 'valence-sensitive')).toEqual(retrieve(day, 'valence-sensitive'))
  })

  it('gives every episode a tie worth breaking', () => {
    for (const episode of MEMORY_EPISODES) {
      const positive = episode.events.filter((event) => event.valence === 'positive')
      const negative = episode.events.filter((event) => event.valence === 'negative')
      expect(positive.length).toBeGreaterThan(0)
      expect(negative.length).toBeGreaterThan(0)
      // And the two must be equally weighted, or the experiment is not a
      // controlled one.
      for (const event of positive) {
        const twin = negative.find((other) => other.recency === event.recency && other.relevance === event.relevance)
        expect(twin, `no negative twin for ${event.id}`).toBeDefined()
        expect(twin!.importance).toBeCloseTo(event.importance)
      }
    }
  })
})
