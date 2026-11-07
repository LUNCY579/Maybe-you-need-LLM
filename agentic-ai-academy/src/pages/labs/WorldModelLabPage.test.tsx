import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorldModelLabPage } from './WorldModelLabPage'
import { ProgressProvider } from '../../store/progress'
import { LESSONS } from '../../content/lessons'
import {
  ACTION_NAMES,
  DEFAULT_WORLD_MODEL_CONFIG,
  allCells,
  runWorldModelLab,
  type WorldModelConfig,
} from '../../engine/labs/worldModel'

/**
 * The same method as the other laboratory screens: no stored expected strings.
 * Each assertion re-runs Lab C with the configuration the panel declares and
 * compares the numbers on the page with the numbers the engine returned.
 */
function renderPage() {
  return render(
    <ProgressProvider totalLessons={LESSONS.length}>
      <WorldModelLabPage />
    </ProgressProvider>,
  )
}

function tile(label: string): { value: string; hint: string } {
  const card = (screen.getByText(label, { selector: 'p' }) as HTMLElement).parentElement as HTMLElement
  const paragraphs = Array.from(card.querySelectorAll('p'))
  return { value: paragraphs[1].textContent as string, hint: (paragraphs[2]?.textContent ?? '') as string }
}

function setSlider(name: string, value: number) {
  fireEvent.change(screen.getByRole('slider', { name }), { target: { value: String(value) } })
}

/** The two policy grids render one titled cell each, model-free first. */
function gridCells(container: HTMLElement): HTMLElement[][] {
  const cells = Array.from(container.querySelectorAll<HTMLElement>('div[title]'))
  const per = DEFAULT_WORLD_MODEL_CONFIG.width * DEFAULT_WORLD_MODEL_CONFIG.height
  expect(cells).toHaveLength(per * 2)
  return [cells.slice(0, per), cells.slice(per)]
}

function arrowsOf(cells: HTMLElement[]): string[] {
  return cells
    .filter((cell) => (cell.textContent ?? '').length > 0)
    .map((cell) => `${cell.getAttribute('title')} ${cell.textContent}`)
    .sort()
}

function expectedArrows(config: WorldModelConfig, policy: Record<string, number>): string[] {
  return allCells(config)
    .filter(([x, y]) => policy[`${x},${y}`] !== undefined)
    .map(([x, y]) => `(${x},${y}) ${['↑', '→', '↓', '←'][policy[`${x},${y}`]]}`)
    .sort()
}

describe('world model laboratory screen', () => {
  it('opens on the seeded default and prints the measured performance of both agents', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: /world model/i })).toBeInTheDocument()

    const run = runWorldModelLab(DEFAULT_WORLD_MODEL_CONFIG)
    expect(tile('Model-free reward').value).toBe(run.modelFree.evaluation.averageReward.toFixed(2))
    expect(tile('Model-free reward').hint).toBe(`success ${(run.modelFree.evaluation.successRate * 100).toFixed(0)}%`)
    expect(tile('Model-based reward').value).toBe(run.modelBased.evaluation.averageReward.toFixed(2))
    expect(tile('Model-based reward').hint).toBe(`success ${(run.modelBased.evaluation.successRate * 100).toFixed(0)}%`)
    expect(tile('Model-free steps').value).toBe(run.modelFree.evaluation.averageSteps.toFixed(1))
    expect(tile('Model-free steps').hint).toBe(`vs ${run.modelBased.evaluation.averageSteps.toFixed(1)} for planning`)
    expect(tile('Mean model divergence').value).toBe(run.meanDivergence.toFixed(3))
    expect(tile('Mean model divergence').hint).toBe(`accuracy setting ${DEFAULT_WORLD_MODEL_CONFIG.modelAccuracy.toFixed(2)}`)

    // The reward statement in the controls panel is the configured one, printed
    // from the same object the engine ran with.
    const config = DEFAULT_WORLD_MODEL_CONFIG
    expect(
      screen.getByText(
        `Rewards: goal ${config.goalReward}, pit ${config.pitReward}, step ${config.stepCost}. Discount ${config.discount}; planning sweeps ${config.planningSweeps}.`,
      ),
    ).toBeInTheDocument()
  })

  it('Model-free versus model-based planning', () => {
    const { container } = renderPage()
    const run = runWorldModelLab(DEFAULT_WORLD_MODEL_CONFIG)

    // Learning and planning are different mechanisms, and the page distinguishes
    // them by what each one produced: a curve of interaction for the Q-learning
    // agent, sweeps of value iteration for the planning agent.
    expect(run.modelFree.trainingCurve).toHaveLength(DEFAULT_WORLD_MODEL_CONFIG.episodes)
    expect(run.modelBased.sweeps).toBe(DEFAULT_WORLD_MODEL_CONFIG.planningSweeps)

    const [freeCells, basedCells] = gridCells(container)
    expect(arrowsOf(freeCells)).toEqual(expectedArrows(DEFAULT_WORLD_MODEL_CONFIG, run.modelFree.policy))
    expect(arrowsOf(basedCells)).toEqual(expectedArrows(DEFAULT_WORLD_MODEL_CONFIG, run.modelBased.policy))
    // Two different routes: the comparison the lab exists to make is only visible
    // if the greedy policies are not in fact identical.
    expect(arrowsOf(freeCells)).not.toEqual(arrowsOf(basedCells))

    expect(
      screen.getByText(
        `Planned with ${run.modelBased.sweeps} value-iteration sweeps over a model with accuracy ${DEFAULT_WORLD_MODEL_CONFIG.modelAccuracy.toFixed(2)}. Compare the arrows around the pit and the walls: differences here are planning errors, not learning errors.`,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        `Trained without any model of the environment: ${DEFAULT_WORLD_MODEL_CONFIG.episodes} episodes of acting and receiving reward, no dynamics learned at all.`,
      ),
    ).toBeInTheDocument()
  })

  it('World model', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Predicted vs actual' }))

    const run = runWorldModelLab(DEFAULT_WORLD_MODEL_CONFIG)
    expect(run.divergences.length).toBeGreaterThan(0)
    // The panel is a top-N list of the worst-diverging visited states, in order.
    expect(run.divergences.map((entry) => entry.divergence)).toEqual([...run.divergences.map((e) => e.divergence)].sort((a, b) => b - a))

    const panel = screen.getByRole('tabpanel', { name: /predicted vs actual/i })
    const rows = Array.from(panel.querySelectorAll<HTMLElement>('div.surface-2'))
    expect(rows).toHaveLength(run.divergences.length)

    for (const [index, entry] of run.divergences.entries()) {
      // Scoped per row, because two of the top divergences tie and the row order
      // is the engine's descending order.
      const row = rows[index]
      expect(row.textContent).toContain(`state (${entry.state.join(',')}) · action ${ACTION_NAMES[entry.action]}`)
      expect(row.textContent).toContain(`divergence ${entry.divergence.toFixed(2)}`)
      expect(row.textContent).toContain(entry.predicted.map((o) => `(${o.next.join(',')}) p=${o.probability.toFixed(2)}`).join(' · '))
      expect(row.textContent).toContain(entry.actual.map((o) => `(${o.next.join(',')}) freq=${o.frequency.toFixed(2)}`).join(' · '))
      // A transition model is a distribution: the predicted branch probabilities
      // are normalised, which is what makes the divergence a comparison of
      // two distributions rather than of two lists.
      expect(entry.predicted.reduce((sum, o) => sum + o.probability, 0)).toBeCloseTo(1, 6)
    }

    expect(tile('Mean model divergence').value).toBe(run.meanDivergence.toFixed(3))
    // The tile is the mean of exactly the rows the panel lists, so the summary
    // and the detail cannot drift apart.
    const shown = run.divergences.map((entry) => entry.divergence)
    expect(run.meanDivergence).toBeCloseTo(shown.reduce((sum, value) => sum + value, 0) / shown.length, 3)
  })

  it('reports no model error at all when the world cannot slip', () => {
    renderPage()
    setSlider('Slip probability', 0)

    const run = runWorldModelLab({ ...DEFAULT_WORLD_MODEL_CONFIG, slip: 0 })
    expect(tile('Mean model divergence').value).toBe(run.meanDivergence.toFixed(3))
    // The page's stated claim: with a deterministic world the naive model is
    // exactly right, so both agents solve the task and only cost separates them.
    expect(run.meanDivergence).toBe(0)
    expect(run.modelFree.evaluation.successRate).toBe(1)
    expect(run.modelBased.evaluation.successRate).toBe(1)
    expect(tile('Model-free reward').hint).toBe('success 100%')
    expect(tile('Model-based reward').hint).toBe('success 100%')
    expect(tile('Model-free reward').value).toBe(run.modelFree.evaluation.averageReward.toFixed(2))
    expect(tile('Model-based reward').value).toBe(run.modelBased.evaluation.averageReward.toFixed(2))
  })

  it('raises the measured model error as the accuracy slider is turned down', async () => {
    renderPage()
    const faithful = runWorldModelLab(DEFAULT_WORLD_MODEL_CONFIG)

    setSlider('Model accuracy', 0)
    const naive = runWorldModelLab({ ...DEFAULT_WORLD_MODEL_CONFIG, modelAccuracy: 0 })

    expect(tile('Mean model divergence').value).toBe(naive.meanDivergence.toFixed(3))
    expect(tile('Mean model divergence').hint).toBe('accuracy setting 0.00')
    expect(naive.meanDivergence).toBeGreaterThan(faithful.meanDivergence)
    // And the honest half of that lesson: on this seed the mistaken belief is not
    // punished in the outcome at all — the reward tile does not move. That is why
    // the lab prints divergence as its own number rather than letting the score
    // stand in for model quality.
    expect(naive.modelBased.evaluation.averageReward.toFixed(2)).toBe(faithful.modelBased.evaluation.averageReward.toFixed(2))
    expect(tile('Model-based reward').value).toBe(naive.modelBased.evaluation.averageReward.toFixed(2))
    expect(tile('Model-based reward').hint).toBe(`success ${(naive.modelBased.evaluation.successRate * 100).toFixed(0)}%`)

    await userEvent.click(screen.getByRole('button', { name: 'Restore defaults' }))
    expect(screen.getByRole('slider', { name: 'Model accuracy' })).toHaveValue('0.8')
    expect(tile('Mean model divergence').value).toBe(faithful.meanDivergence.toFixed(3))
  })

  it('re-plots the training curve when the episode count is moved', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Learning curve' }))
    expect(screen.getByRole('img', { name: /model-free training curve/i })).toBeInTheDocument()

    const table = screen.getByRole('table')
    expect(Array.from(table.querySelectorAll('th')).map((cell) => cell.textContent)).toEqual(['Episode', 'Reward', 'Exploration ε'])

    const run = runWorldModelLab(DEFAULT_WORLD_MODEL_CONFIG)
    const shown = (config: WorldModelConfig) =>
      run.modelFree.trainingCurve.filter((point) => point.episode % Math.max(1, Math.floor(config.episodes / 60)) === 0)
    expect(Array.from(table.querySelectorAll('tbody tr')).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent))).toEqual(
      shown(DEFAULT_WORLD_MODEL_CONFIG).map((point) => [String(point.episode), String(point.reward), String(point.epsilon)]),
    )

    setSlider('Training episodes', 40)
    const short = runWorldModelLab({ ...DEFAULT_WORLD_MODEL_CONFIG, episodes: 40 })
    // The down-sampling is a display choice; at 40 episodes every point is plotted.
    expect(short.modelFree.trainingCurve).toHaveLength(40)
    const rows = Array.from(screen.getByRole('table').querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent),
    )
    expect(rows).toEqual(short.modelFree.trainingCurve.map((point) => [String(point.episode), String(point.reward), String(point.epsilon)]))
    expect(rows).toHaveLength(40)
    expect(shown(DEFAULT_WORLD_MODEL_CONFIG).length).toBeLessThan(run.modelFree.trainingCurve.length)
  })
})
