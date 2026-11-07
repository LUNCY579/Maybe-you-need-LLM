import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MultiAgentLabPage } from './MultiAgentLabPage'
import { ProgressProvider } from '../../store/progress'
import { LESSONS } from '../../content/lessons'
import {
  DEFAULT_MULTI_AGENT_CONFIG,
  MULTI_AGENT_PRESETS,
  ROLE_DESCRIPTIONS,
  runMultiAgentLab,
  type MultiAgentRun,
} from '../../engine/labs/multiAgent'

/**
 * Lab D's screen test follows the same rule as the others: no expected strings are
 * stored. Every figure is produced by calling runMultiAgentLab with the settings the
 * panel declares, and the page is then compared with it.
 */
function renderPage() {
  return render(
    <ProgressProvider totalLessons={LESSONS.length}>
      <MultiAgentLabPage />
    </ProgressProvider>,
  )
}

function tile(label: string): { value: string; hint: string } {
  const card = (screen.getByText(label, { selector: 'p' }) as HTMLElement).parentElement as HTMLElement
  const paragraphs = Array.from(card.querySelectorAll('p'))
  return { value: paragraphs[1].textContent as string, hint: (paragraphs[2]?.textContent ?? '') as string }
}

function expectTiles(run: MultiAgentRun) {
  expect(tile('Outcome score').value).toBe(run.outcomeScore.toFixed(2))
  expect(tile('Outcome score').hint).toBe(run.goalReached ? 'task resolved' : 'task not resolved')
  expect(tile('Dropped handoffs').value).toBe(String(run.coordinationFailures))
  expect(tile('Dropped handoffs').hint).toBe(`of ${run.messages.length} messages`)
  expect(tile('Defects caught').value).toBe(String(run.defectsCaught))
  expect(tile('Defects reaching answer').value).toBe(String(run.defectsReachingAnswer))
  expect(screen.getByText(`${run.rounds} round(s) executed.`)).toBeInTheDocument()
  expect(screen.getByText(run.summary)).toBeInTheDocument()
}

describe('multi-agent laboratory screen', () => {
  it('opens on the default team and prints the measured run', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: /multi-agent collaboration/i })).toBeInTheDocument()
    expectTiles(runMultiAgentLab(DEFAULT_MULTI_AGENT_CONFIG))
  })

  it('Multi-agent', () => {
    renderPage()
    const run = runMultiAgentLab(DEFAULT_MULTI_AGENT_CONFIG)
    const list = screen.getByRole('list', { name: 'Role statistics' })
    const items = within(list).getAllByRole('listitem')

    // The Roles panel is the one place the five specialisations are named, so the
    // per-role bookkeeping the engine keeps has to be the bookkeeping on screen.
    expect(items).toHaveLength(5)
    for (const [index, role] of ['planner', 'researcher', 'executor', 'verifier', 'critic'].entries()) {
      const stats = run.agents.find((agent) => agent.role === role)
      expect(items[index].textContent).toContain(ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS])
      if (stats) {
        expect(items[index].textContent).toContain(
          `sent ${stats.sent} · recv ${stats.received} · defects ${stats.defectsIntroduced} · caught ${stats.defectsCaught}`,
        )
      } else {
        expect(items[index].textContent).not.toContain('sent')
      }
    }

    // Every message the simulation sent is counted, and the one role that only
    // ever receives never reports a dropped send.
    expect(run.agents.reduce((sum, agent) => sum + agent.sent, 0)).toBe(run.messages.length)
    expect(run.agents.filter((agent) => agent.sent === 0).map((agent) => agent.role)).toEqual(['verifier'])
  })

  it('tabulates the handoffs and the message log against the same trace', async () => {
    renderPage()
    const run = runMultiAgentLab(DEFAULT_MULTI_AGENT_CONFIG)
    await userEvent.click(screen.getByRole('tab', { name: 'Handoffs & messages' }))

    const table = screen.getByRole('table', { name: /handoff summary/i })
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))
    expect(rows).toEqual(run.handoffs.map((handoff) => [handoff.from, handoff.to, String(handoff.count), String(handoff.dropped)]))
    // The summary is a grouping of the log, not a second measurement: the counts
    // and the drops have to add up to the message list the tile reports.
    expect(run.handoffs.reduce((sum, handoff) => sum + handoff.count, 0)).toBe(run.messages.length)
    expect(run.handoffs.reduce((sum, handoff) => sum + handoff.dropped, 0)).toBe(run.coordinationFailures)

    const log = within(screen.getByRole('list', { name: 'Message log' })).getAllByRole('listitem')
    expect(log).toHaveLength(run.messages.length)
    expect(screen.getAllByText('delivered')).toHaveLength(run.messages.filter((message) => message.delivered).length)
    expect(screen.getAllByText('lost')).toHaveLength(run.messages.filter((message) => !message.delivered).length)
    const first = run.messages[0]
    expect(log[0].textContent).toContain(`r${first.round} ${first.from} → ${first.to} (${first.kind})`)
    expect(log[0].textContent).toContain(first.content)
  })

  it('lists how each subtask ended', async () => {
    renderPage()
    const run = runMultiAgentLab(DEFAULT_MULTI_AGENT_CONFIG)
    await userEvent.click(screen.getByRole('tab', { name: 'Subtasks' }))

    const items = within(screen.getByRole('list', { name: 'Subtask status' })).getAllByRole('listitem')
    expect(items).toHaveLength(run.subtasks.length)
    for (const [index, subtask] of run.subtasks.entries()) {
      expect(items[index].textContent).toContain(subtask.status)
      expect(items[index].textContent).toContain(subtask.title)
      expect(items[index].textContent).toContain(`rounds ${subtask.rounds}`)
      expect(items[index].textContent).toContain(`Required evidence: ${subtask.requiredEvidence}`)
      expect(items[index].textContent).toContain(subtask.note)
      // A subtask cannot report a round it never had.
      expect(subtask.rounds).toBeGreaterThan(0)
    }
  })

  it('turns the verifier off and shows the defects that reach the answer', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('switch', { name: 'Verify before accepting a subtask' }))

    const run = runMultiAgentLab({ ...DEFAULT_MULTI_AGENT_CONFIG, verificationEnabled: false })
    expectTiles(run)
    expect(run.defectsCaught).toBe(0)
    expect(run.defectsReachingAnswer).toBeGreaterThan(0)
    // The summary now says what was measured rather than crediting a step that
    // the configuration switched off.
    expect(run.summary).toContain('with no verification step in the loop')

    const faithful = runMultiAgentLab(DEFAULT_MULTI_AGENT_CONFIG)
    expect(faithful.defectsCaught).toBeGreaterThan(0)
    expect(faithful.defectsReachingAnswer).toBe(0)
    expect(run.outcomeScore).toBeLessThan(faithful.outcomeScore)
  })

  it('applies a preset and prints each one measured rather than promised', async () => {
    renderPage()
    const buttons = screen.getAllByRole('button', { name: /score .*messages lost/i })
    expect(buttons).toHaveLength(MULTI_AGENT_PRESETS.length)

    for (const [index, preset] of MULTI_AGENT_PRESETS.entries()) {
      const run = runMultiAgentLab(preset.config)
      expect(buttons[index].textContent).toContain(preset.label)
      expect(buttons[index].textContent).toContain(preset.description)
      expect(buttons[index].textContent).toContain(
        `score ${run.outcomeScore.toFixed(2)} · ${run.coordinationFailures}/${run.messages.length} messages lost · ${run.defectsCaught} caught · ${run.defectsReachingAnswer} reaching the answer · ${run.rounds} round(s)`,
      )
    }

    const skipping = MULTI_AGENT_PRESETS.find((preset) => preset.id === 'no-verification')!
    await userEvent.click(screen.getByRole('button', { name: /No verification step/i }))
    expectTiles(runMultiAgentLab(skipping.config))
    expect(screen.getByRole('switch', { name: 'Verify before accepting a subtask' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Include a critic role' })).toHaveAttribute('aria-checked', 'false')
  })

  it('charges the score for a message that never arrives', () => {
    renderPage()
    const slider = screen.getByRole('slider', { name: 'Channel reliability' })
    fireEvent.change(slider, { target: { value: '1' } })
    const reliable = runMultiAgentLab({ ...DEFAULT_MULTI_AGENT_CONFIG, channelReliability: 1 })
    expectTiles(reliable)
    expect(reliable.coordinationFailures).toBe(0)
    expect(reliable.outcomeScore).toBe(1)

    // A lossy channel at the same seed: the penalty the tile reports is the
    // penalty the score applied, which is the point of the handoff table.
    fireEvent.change(slider, { target: { value: '0.66' } })
    const lossy = runMultiAgentLab({ ...DEFAULT_MULTI_AGENT_CONFIG, channelReliability: 0.66 })
    expectTiles(lossy)
    expect(lossy.coordinationFailures).toBeGreaterThan(0)
    expect(lossy.outcomeScore).toBeLessThan(reliable.outcomeScore)
    const base = lossy.subtasks.filter((subtask) => subtask.status === 'completed').length / lossy.subtasks.length
    expect(lossy.outcomeScore).toBeCloseTo(
      Math.max(0, Math.round((base - Math.min(0.4, lossy.coordinationFailures * 0.08) - Math.min(0.5, lossy.defectsReachingAnswer * 0.12)) * 100) / 100),
      6,
    )
  })
})
