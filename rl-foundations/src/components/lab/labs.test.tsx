/**
 * The screens, and the numbers they are supposed to show.
 *
 * Two kinds of check live here. The first is structural: the registry in
 * `src/content/labs.ts` and the screen table have to agree, and every declared
 * laboratory item has to be delivered by exactly one screen. The second is
 * numerical: a value the screen prints is recomputed here from the same core
 * functions, and the two have to be the same string. A screen that renders
 * without throwing is not evidence that it shows the right number.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { fmt } from '@llm-materials/course-core'
import { LABS, labForItem } from '../../content/labs'
import { LAB_SCREENS } from './screens'
import { banditLogits, buildBandit, compareForms } from '../../core/bandit'
import { buildGridworld, SoftmaxPolicy, stateCount, valueIteration } from '../../core/mdp'
import { exactGradient, gradientNorm } from '../../core/policygradient'
import { optimalValue } from '../../core/actorcritic'

const world = buildGridworld()

afterEach(() => {
  cleanup()
})

function renderLab(id: string) {
  const Screen = LAB_SCREENS[id]
  if (!Screen) throw new Error(`no screen is registered for ${id}`)
  return render(<Screen />)
}

function click(text: string) {
  fireEvent.click(screen.getByRole('button', { name: text }))
}

describe('the laboratory registry', () => {
  it('names a screen for every laboratory, and no screen is unregistered', () => {
    expect(Object.keys(LAB_SCREENS).sort()).toEqual(LABS.map((lab) => lab.id).sort())
  })

  it('declares every item once, and only items the manifest lists', () => {
    const items = LABS.flatMap((lab) => lab.delivers)
    expect(items).toHaveLength(6)
    expect(new Set(items).size).toBe(items.length)
    for (const item of items) {
      expect(labForItem(item)?.delivers).toContain(item)
    }
    expect(labForItem('a promise nobody made')).toBeUndefined()
  })

  it('renders every laboratory', { timeout: 180_000 }, () => {
    for (const lab of LABS) {
      const { container } = renderLab(lab.id)
      expect(container.querySelector('.panel')).not.toBeNull()
      cleanup()
    }
  })
})

describe('the gridworld screen', () => {
  it('prints the value iteration answer', { timeout: 60_000 }, () => {
    renderLab('gridworld')
    const optimal = valueIteration(world)
    expect(screen.getByText('Laboratory A · The gridworld')).toBeInTheDocument()
    expect(screen.getByText('The optimal value')).toBeInTheDocument()
    expect(screen.getByText(fmt(optimal.values[0] ?? 0, 4))).toBeInTheDocument()
    expect(optimal.residual).toBeLessThan(1e-8)
  })

  it('shows the sweeps and the optimum', { timeout: 60_000 }, () => {
    renderLab('gridworld')
    click('The value')
    expect(screen.getByText('The value, sweep by sweep')).toBeInTheDocument()
    click('The optimum')
    expect(screen.getAllByText('The optimal policy').length).toBeGreaterThan(0)
  })
})

describe('the policy gradient screen', () => {
  it('shows one gradient computed three ways', { timeout: 60_000 }, () => {
    renderLab('policygradient')
    expect(screen.getByText('The gradient three ways')).toBeInTheDocument()
    const bandit = buildBandit()
    const forms = compareForms(bandit, banditLogits(bandit, 0.5))
    const first = fmt(forms.direct[0] ?? 0, 6)
    // The three columns of one row have to be the same number, as printed.
    expect(fmt(forms.scoreFunction[0] ?? 0, 6)).toBe(first)
    expect(fmt(forms.baseline[0] ?? 0, 6)).toBe(first)
    expect(screen.getAllByText(first).length).toBeGreaterThan(0)
    expect(forms.residualScoreFunction).toBeLessThan(1e-12)
  })

  it('shows the estimator against the finite difference', { timeout: 120_000 }, () => {
    renderLab('policygradient')
    click('The estimator')
    expect(screen.getByText('The estimate and the exact gradient')).toBeInTheDocument()
    const logits = new Array<number>(stateCount(world) * 4).fill(0)
    for (let index = 0; index < logits.length; index++) logits[index] = 0.2 * Math.sin(index * 1)
    const policy = new SoftmaxPolicy(stateCount(world), 4, logits)
    const size = fmt(gradientNorm(exactGradient(world, policy)), 5)
    expect(screen.getByText('The size of the gradient')).toBeInTheDocument()
    expect(screen.getByText(size)).toBeInTheDocument()
  })

  it('shows the spread a baseline takes away', { timeout: 180_000 }, () => {
    renderLab('policygradient')
    click('The baseline')
    expect(screen.getByText('The spread, with and without a baseline')).toBeInTheDocument()
    expect(screen.getByText('The error against the number of trajectories')).toBeInTheDocument()
  })
})

describe('the returns screen', () => {
  it('shows the n-step returns, then the λ curve', { timeout: 120_000 }, () => {
    renderLab('returns')
    expect(screen.getByText('The n-step returns of a real trajectory')).toBeInTheDocument()
    click('The λ-return')
    expect(screen.getByText('The bias and the variance, as λ moves')).toBeInTheDocument()
  })

  it('shows the two weightings of the same gradient', { timeout: 180_000 }, () => {
    renderLab('returns')
    click('Reward-to-go')
    expect(screen.getByText('The same expectation, twice')).toBeInTheDocument()
    expect(screen.getByText('The noisier one is worth')).toBeInTheDocument()
    expect(screen.getByText('The spread each weighting leaves behind')).toBeInTheDocument()
  })
})

describe('the actor-critic screen', () => {
  it('shows the loop, and the ceiling it is measured against', { timeout: 180_000 }, () => {
    renderLab('actorcritic')
    expect(screen.getByText('The learning curve')).toBeInTheDocument()
    expect(screen.getByText('The two halves')).toBeInTheDocument()
    expect(screen.getByText(fmt(optimalValue(world), 3))).toBeInTheDocument()
    expect(optimalValue(world)).toBeGreaterThan(0)
  })
})
