import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryLabPage } from './MemoryLabPage'
import { ProgressProvider } from '../../store/progress'
import { LESSONS } from '../../content/lessons'
import {
  DEFAULT_MEMORY_CONFIG,
  MEMORY_EVENTS,
  compareMemoryConfigs,
  runMemoryLab,
  type MemoryConfig,
} from '../../engine/labs/memory'

/**
 * Same method as the four deep-dive laboratory screens: nothing is stored as an
 * expected string. Each assertion calls the memory engine with the configuration
 * the panel declares and compares the figures the page prints against it.
 */
function renderPage() {
  return render(
    <ProgressProvider totalLessons={LESSONS.length}>
      <MemoryLabPage />
    </ProgressProvider>,
  )
}

function tile(label: string): { value: string; hint: string } {
  // The label selector keeps the tile's own caption; the comparison table reuses
  // two of the same words as column headers.
  const card = (screen.getByText(label, { selector: 'p' }) as HTMLElement).parentElement as HTMLElement
  const paragraphs = Array.from(card.querySelectorAll('p'))
  return { value: paragraphs[1].textContent as string, hint: (paragraphs[2]?.textContent ?? '') as string }
}

/** The three controls the page exposes for one configuration, in one call. */
async function apply(config: MemoryConfig) {
  if (config.strategy !== DEFAULT_MEMORY_CONFIG.strategy) {
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Retrieval strategy' }), config.strategy)
  }
  fireEvent.change(screen.getByRole('slider', { name: 'Memory capacity' }), { target: { value: String(config.capacity) } })
  fireEvent.change(screen.getByRole('slider', { name: 'Top-k retrieval' }), { target: { value: String(config.topK) } })
  fireEvent.change(screen.getByRole('slider', { name: 'Relevance weight' }), {
    target: { value: String(config.relevanceWeight) },
  })
  fireEvent.change(screen.getByRole('slider', { name: 'Scratchpad budget' }), { target: { value: String(config.scratchpadTokens) } })
}

function timelineRows(): HTMLElement[] {
  return Array.from(screen.getByRole('list', { name: 'Memory timeline' }).querySelectorAll('li'))
}

describe('agent memory laboratory screen', () => {
  it('opens on the recommended configuration and prints what the run measured', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: /agent memory/i })).toBeInTheDocument()

    const run = runMemoryLab(DEFAULT_MEMORY_CONFIG)
    expect(tile('Events in stream').value).toBe(String(MEMORY_EVENTS.length))
    expect(tile('Stored').value).toBe(String(run.timeline.at(-1)?.storeSize))
    expect(tile('Stored').hint).toBe(`Capacity ${DEFAULT_MEMORY_CONFIG.capacity}`)
    expect(tile('Critical facts kept').value).toBe(`${run.storedCritical}/${run.totalCritical}`)
    expect(tile('Critical facts kept').hint).toBe(`${run.retrievedCritical} retrieved for the decision`)
    expect(tile('Decision correct').value).toBe(run.decisions[0].correct ? 'yes' : 'no')

    const decision = run.decisions[0]
    expect(screen.getByText(decision.question)).toBeInTheDocument()
    expect(screen.getByText(decision.decision)).toBeInTheDocument()
    expect(screen.getByText(decision.explanation)).toBeInTheDocument()
    expect(screen.getByText(decision.correct ? 'good decision' : 'bad decision')).toBeInTheDocument()
  })

  it('Ch. 9 §9.3.2.3: explicit memory management with read/write operations.', () => {
    renderPage()
    const run = runMemoryLab(DEFAULT_MEMORY_CONFIG)
    const decision = run.decisions[0]

    // The write side: every event is written, and the store size moves by exactly
    // one arrival and one eviction per tick. That arithmetic is what makes this a
    // memory-management demo rather than a retrieval one — the page shows the
    // bookkeeping, so the bookkeeping is what is checked.
    expect(run.timeline).toHaveLength(MEMORY_EVENTS.length)
    expect(run.timeline[0].storeSize).toBe(1)
    for (let index = 1; index < run.timeline.length; index++) {
      const previous = run.timeline[index - 1].storeSize
      const current = run.timeline[index].storeSize
      expect(current, `t${index} wrote one event and evicted ${run.timeline[index].evicted ? 'one' : 'none'}`).toBe(
        previous + 1 - (run.timeline[index].evicted ? 1 : 0),
      )
    }
    const survivors = run.timeline.at(-1)!.store.map((event) => event.id)
    expect(survivors).toHaveLength(DEFAULT_MEMORY_CONFIG.capacity)
    expect(run.storedCritical).toBe(MEMORY_EVENTS.filter((event) => event.importance === 'critical' && survivors.includes(event.id)).length)

    // The read side scores exactly the surviving store: nothing read that was
    // never written, nothing written and kept that was never offered.
    expect([...decision.scores.map((entry) => entry.id)].sort()).toEqual([...survivors].sort())
    expect(decision.retrieved).toHaveLength(Math.min(DEFAULT_MEMORY_CONFIG.topK, survivors.length))
    expect(new Set([...decision.retrieved, ...decision.omitted].map((event) => event.id))).toEqual(new Set(survivors))

    // And the page prints both sides of it.
    const rows = timelineRows()
    expect(rows).toHaveLength(MEMORY_EVENTS.length)
    expect(rows.filter((row) => row.textContent?.includes('evicted on arrival'))).toHaveLength(
      run.timeline.filter((entry) => !entry.stored).length,
    )
    expect(rows.filter((row) => row.textContent?.includes('Evicted:'))).toHaveLength(
      run.timeline.filter((entry) => entry.evicted).length,
    )
    expect(rows[0].textContent).toContain('t0')
    expect(rows[0].textContent).toContain(`store ${run.timeline[0].storeSize}`)
    expect(screen.getAllByText('kept')).toHaveLength(decision.retrieved.length)
    expect(screen.getAllByText('omitted')).toHaveLength(decision.omitted.length)
    for (const entry of decision.scores) {
      expect(screen.getByText(entry.score.toFixed(3))).toBeInTheDocument()
    }
  })

  it('shrinks the store until a critical fact is evicted and the decision turns wrong', async () => {
    renderPage()
    const small: MemoryConfig = { ...DEFAULT_MEMORY_CONFIG, capacity: 2, strategy: 'recency', topK: 2 }
    await apply(small)

    const run = runMemoryLab(small)
    expect(tile('Critical facts kept').value).toBe(`${run.storedCritical}/${run.totalCritical}`)
    expect(run.storedCritical).toBeLessThan(run.totalCritical)
    expect(tile('Stored').value).toBe(String(run.timeline.at(-1)?.storeSize))
    expect(tile('Decision correct').value).toBe('no')
    expect(screen.getByText(run.decisions[0].decision)).toBeInTheDocument()
    expect(screen.getByText(run.decisions[0].explanation)).toBeInTheDocument()
    expect(timelineRows().filter((row) => row.textContent?.includes('evicted on arrival'))).toHaveLength(
      run.timeline.filter((entry) => !entry.stored).length,
    )
  })

  it('re-ranks retrieval when the relevance weight is moved, and prints the new scores', () => {
    renderPage()
    const before = runMemoryLab(DEFAULT_MEMORY_CONFIG).decisions[0].scores
    const recencyLean: MemoryConfig = { ...DEFAULT_MEMORY_CONFIG, relevanceWeight: 0 }
    fireEvent.change(screen.getByRole('slider', { name: 'Relevance weight' }), { target: { value: '0' } })

    const after = runMemoryLab(recencyLean).decisions[0].scores
    expect(after.map((entry) => entry.score.toFixed(3))).not.toEqual(before.map((entry) => entry.score.toFixed(3)))
    for (const entry of after) {
      expect(screen.getByText(entry.score.toFixed(3))).toBeInTheDocument()
    }
    // The label above the control follows the control, and the hint the page
    // prints for the strategy still selected is the one it declares for it.
    expect(screen.getByText(/Relevance weight: 0\.00/)).toBeInTheDocument()
    expect(screen.getByText(/Hybrid strategy only: 1\.0 = meaning, 0\.0 = recency\./)).toBeInTheDocument()
  })

  it('rolls the scratchpad and says how much fell out of it', () => {
    renderPage()
    const run = runMemoryLab(DEFAULT_MEMORY_CONFIG)

    expect(screen.getByText(run.scratchpad.join(' '))).toBeInTheDocument()
    expect(run.scratchpad.join(' ').split(/\s+/).length).toBeLessThanOrEqual(DEFAULT_MEMORY_CONFIG.scratchpadTokens)
    const rolledOut = MEMORY_EVENTS.length - run.scratchpad.length
    expect(rolledOut).toBeGreaterThan(0)
    expect(screen.getByText(`${rolledOut} earlier event(s) rolled out of the scratchpad — that information is only reachable if it made it into episodic memory.`)).toBeInTheDocument()

    // Opening the budget to the largest the panel offers retains more of the
    // stream and re-prints the warning with the engine's own new count — because
    // even the widest short-term window does not hold all twelve events.
    fireEvent.change(screen.getByRole('slider', { name: 'Scratchpad budget' }), { target: { value: '80' } })
    const wide = runMemoryLab({ ...DEFAULT_MEMORY_CONFIG, scratchpadTokens: 80 })
    expect(wide.scratchpad.length).toBeGreaterThan(run.scratchpad.length)
    expect(wide.scratchpad.length).toBeLessThan(MEMORY_EVENTS.length)
    expect(wide.scratchpad.join(' ').split(/\s+/).length).toBeLessThanOrEqual(80)
    expect(screen.queryByText(run.scratchpad.join(' '))).not.toBeInTheDocument()
    expect(screen.getByText(wide.scratchpad.join(' '))).toBeInTheDocument()
    expect(
      screen.getByText(
        `${MEMORY_EVENTS.length - wide.scratchpad.length} earlier event(s) rolled out of the scratchpad — that information is only reachable if it made it into episodic memory.`,
      ),
    ).toBeInTheDocument()
  })

  it('tabulates the four comparison configurations with the numbers the engine returns', () => {
    renderPage()
    const comparison = compareMemoryConfigs()
    expect(screen.getByRole('img', { name: /memory strategy comparison/i })).toBeInTheDocument()

    const table = screen.getByRole('table')
    const headers = Array.from(table.querySelectorAll('th')).map((cell) => cell.textContent)
    expect(headers).toEqual(['Configuration', 'Critical kept', 'Critical retrieved', 'Decision correct'])

    const rows = Array.from(table.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent),
    )
    expect(rows).toEqual(
      comparison.map((entry) => [
        entry.label,
        String(entry.run.storedCritical),
        String(entry.run.retrievedCritical),
        entry.run.accuracy === 1 ? '1' : '0',
      ]),
    )
    // The small store is the configuration the reader is meant to flinch at: it
    // keeps fewer critical facts than the default and gets the decision wrong.
    const smallest = comparison.find((entry) => entry.label === 'Small store, recency only')!
    expect(smallest.run.storedCritical).toBeLessThan(comparison.find((entry) => entry.label === 'Hybrid (default)')!.run.storedCritical)
    expect(smallest.run.accuracy).toBe(0)
  })

  it('restores the recommended settings after the controls are moved', async () => {
    renderPage()
    fireEvent.change(screen.getByRole('slider', { name: 'Memory capacity' }), { target: { value: '3' } })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Retrieval strategy' }), 'importance')

    const shrunk = runMemoryLab({ ...DEFAULT_MEMORY_CONFIG, capacity: 3, strategy: 'importance' })
    expect(tile('Stored').value).toBe(String(shrunk.timeline.at(-1)?.storeSize))

    await userEvent.click(screen.getByRole('button', { name: 'Restore recommended settings' }))

    expect(screen.getByRole('slider', { name: 'Memory capacity' })).toHaveValue(String(DEFAULT_MEMORY_CONFIG.capacity))
    expect(screen.getByRole('combobox', { name: 'Retrieval strategy' })).toHaveValue(DEFAULT_MEMORY_CONFIG.strategy)
    const restored = runMemoryLab(DEFAULT_MEMORY_CONFIG)
    expect(tile('Critical facts kept').value).toBe(`${restored.storedCritical}/${restored.totalCritical}`)
    expect(screen.getByText(restored.decisions[0].decision)).toBeInTheDocument()
  })
})
