import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlanningLabPage } from './PlanningLabPage'
import { ProgressProvider } from '../../store/progress'
import { LESSONS } from '../../content/lessons'
import {
  DEFAULT_WORLD,
  runAllStrategies,
  runPlanning,
  type PlanningRun,
  type PlanningStrategy,
} from '../../engine/labs/planning'

/**
 * The screen test exists so that the page cannot keep printing a number its engine stopped
 * producing: every figure asserted here is computed by the same call the page makes, with the
 * same settings the page declares, and compared against the text on the screen. Nothing is a
 * fixture.
 */
function renderPage() {
  return render(
    <ProgressProvider totalLessons={LESSONS.length}>
      <PlanningLabPage />
    </ProgressProvider>,
  )
}

/** The planners, in the order the engine returns them and the screen prints them. */
const STRATEGY_LABELS: Record<PlanningStrategy, string> = {
  greedy: 'Greedy',
  'fixed-plan': 'Fixed plan',
  search: 'Search-based',
  reflective: 'Reflective',
}

const rowOf = (run: PlanningRun) => [
  STRATEGY_LABELS[run.strategy],
  String(run.planLength),
  String(run.actionCount),
  String(run.failures),
  String(run.replans),
  run.reachedGoal ? 'yes' : 'no',
]

/**
 * The comparison table's data rows. The chart above it carries a collapsible table of its own,
 * so this one is addressed by the caption it gives it.
 */
function comparisonRows() {
  const table = screen.getByRole('table', { name: /detailed results/i })
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent as string))
}

async function openComparison() {
  await userEvent.click(screen.getByRole('tab', { name: 'Strategy comparison' }))
}

describe('agent planning laboratory screen', () => {
  it('opens on the greedy planner and prints the run it made', () => {
    const { container } = renderPage()
    expect(screen.getByRole('heading', { level: 1, name: /agent planning/i })).toBeInTheDocument()

    const run = runPlanning('greedy', DEFAULT_WORLD, { slipProbability: 0, seed: 1 })
    // The locked door is the run's own ending, and the tile and the sentence report it alike.
    expect(run.reachedGoal).toBe(false)
    expect(container.textContent).toContain(String(run.planLength))
    expect(container.textContent).toContain(String(run.actionCount))
    expect(container.textContent).toContain(`did NOT reach the goal within the ${DEFAULT_WORLD.budget}-action budget`)
    expect(container.textContent).toContain(`${run.failures} failure(s), ${run.replans} replan(s)`)
  })

  it('Planning', async () => {
    renderPage()
    // The declared item is a comparison, so the screen owes one row per strategy, each carrying
    // the figures the engine returned for that strategy over one shared world.
    const runs = runAllStrategies(DEFAULT_WORLD, { slipProbability: 0, seed: 1 })
    expect(runs.map((run) => run.strategy)).toEqual(['greedy', 'fixed-plan', 'search', 'reflective'])

    await openComparison()
    expect(comparisonRows()).toEqual(runs.map(rowOf))

    // The world's lesson, on the page rather than in a caption: the greedy walk never fetches the
    // key, the search does, and the four planners do not agree on what the task costs.
    expect(runs.find((run) => run.strategy === 'greedy')?.reachedGoal).toBe(false)
    expect(runs.find((run) => run.strategy === 'search')?.reachedGoal).toBe(true)
    expect(new Set(runs.map((run) => run.actionCount)).size).toBeGreaterThan(1)
  })

  it('switches the planner and the run with it', async () => {
    const { container } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Search-based' }))

    const run = runPlanning('search', DEFAULT_WORLD, { slipProbability: 0, seed: 1 })
    expect(run.reachedGoal).toBe(true)
    expect(container.textContent).toContain(
      `search-based planner reached the goal after ${run.actionCount} actions with ${run.failures} failure(s)`,
    )
    // The step trace tab names the length of the trace it holds, and it holds that many rows.
    expect(screen.getByRole('tab', { name: `Step trace (${run.steps.length})` })).toBeInTheDocument()
  })

  it('re-runs every planner when the slip is turned up', async () => {
    renderPage()
    await openComparison()
    const deterministic = comparisonRows()

    await userEvent.click(screen.getByRole('tab', { name: 'World' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Slip probability' }), { target: { value: '0.25' } })

    const runs = runAllStrategies(DEFAULT_WORLD, { slipProbability: 0.25, seed: 1 })
    await openComparison()
    // One world, one budget, four planners: the table is the engine's, at the settings the
    // slider is now showing.
    expect(comparisonRows()).toEqual(runs.map(rowOf))
    // A slip is exactly the case a plan computed in the deterministic model cannot account for,
    // so the comparison moves when the world starts disagreeing. Nothing here is a still life.
    expect(comparisonRows()).not.toEqual(deterministic)
  })

  it('lists the steps it took, failures included', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Reflective' }))
    await userEvent.click(screen.getByRole('tab', { name: /Step trace/ }))

    const run = runPlanning('reflective', DEFAULT_WORLD, { slipProbability: 0, seed: 1 })
    const rows = within(screen.getByRole('list', { name: 'Step trace' })).getAllByRole('listitem')
    expect(rows).toHaveLength(run.steps.length)
    run.steps.slice(0, 3).forEach((step, index) => {
      expect(rows[index].textContent).toContain(`#${step.index + 1}`)
      expect(rows[index].textContent).toContain(step.action)
      expect(rows[index].textContent).toContain(step.note)
    })
    // The failures counted in the tiles are the failures drawn in the trace, not a separate story.
    expect(run.steps.filter((step) => step.failed)).toHaveLength(run.failures)
  })

  it('re-runs with a new seed, and gives the same run twice for one seed', async () => {
    renderPage()
    const seed = screen.getByRole('slider', { name: 'Run seed' })
    expect((seed as HTMLInputElement).value).toBe('1')

    await userEvent.click(screen.getByRole('button', { name: /Re-run with a new seed/i }))
    expect((seed as HTMLInputElement).value).toBe('2')

    const first = runPlanning('greedy', DEFAULT_WORLD, { slipProbability: 0, seed: 2 })
    expect(screen.getByRole('tab', { name: `Step trace (${first.steps.length})` })).toBeInTheDocument()
    // Determinism is what the badge on the page claims, so check it the way a student can: the
    // same settings give the same walk, step for step.
    const again = runPlanning('greedy', DEFAULT_WORLD, { slipProbability: 0, seed: 2 })
    expect(again.steps.map((step) => `${step.action}:${step.to.join(',')}`)).toEqual(
      first.steps.map((step) => `${step.action}:${step.to.join(',')}`),
    )
  })
})
