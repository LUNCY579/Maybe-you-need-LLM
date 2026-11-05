import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LABS, labForItem } from '../../content/labs'
import { companionFigures } from '../../core/companions'
import { LAB_SCREENS } from './screens'

function renderLab(id: string) {
  const Screen = LAB_SCREENS[id]
  if (!Screen) throw new Error(`no screen is registered for ${id}`)
  return render(
    <MemoryRouter>
      <Screen />
    </MemoryRouter>,
  )
}

describe('the laboratory registry', () => {
  it('registers a screen for every laboratory and a laboratory for every screen', () => {
    expect(Object.keys(LAB_SCREENS).sort()).toEqual(LABS.map((lab) => lab.id).sort())
    for (const lab of LABS) {
      expect(LAB_SCREENS[lab.id], lab.id).toBeDefined()
    }
  })

  it('gives every declared item exactly one screen', () => {
    const items = LABS.flatMap((lab) => lab.delivers)
    expect(new Set(items).size).toBe(items.length)
    for (const lab of LABS) {
      for (const item of lab.delivers) {
        expect(labForItem(item)?.id, item).toBe(lab.id)
      }
    }
  })

  it('renders every laboratory', () => {
    for (const lab of LABS) {
      const { unmount } = renderLab(lab.id)
      expect(screen.getByText(lab.name, { exact: false }), lab.id).toBeInTheDocument()
      unmount()
    }
  }, 60000)
})

describe('the tokeniser laboratory', () => {
  it('uses GPT-2 on a real, attributed book', () => {
    renderLab('tokenizer')
    fireEvent.click(screen.getByRole('button', { name: 'The real corpus' }))
    expect(screen.getAllByText(/Moby-Dick/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/GPT-2/).length).toBeGreaterThan(0)
    expect(screen.getByText('The passage, as the tokeniser sees it')).toBeInTheDocument()
    expect(screen.getByText(/public domain/i, { exact: false })).toBeInTheDocument()
  }, 60000)
})

describe('the accounting laboratory', () => {
  it('puts the arithmetic against the memory hierarchy', () => {
    renderLab('accounting')
    fireEvent.click(screen.getByRole('button', { name: 'The hierarchy' }))
    expect(screen.getByText('Memory hierarchy arithmetic')).toBeInTheDocument()
    expect(screen.getByText('The memory hierarchy, level by level')).toBeInTheDocument()
    expect(screen.getByText('shared memory, one SM')).toBeInTheDocument()
  })
})

describe('the training laboratory', () => {
  it('trains, reads the loop, evaluates and samples', () => {
    renderLab('training')
    expect(screen.getByText('Basics')).toBeInTheDocument()
    expect(screen.getByText('Built from nothing')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Train from scratch' }))
    expect(screen.getByText('The loss, falling')).toBeInTheDocument()
    expect(screen.getByText('Running a small real model')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'The loop' }))
    expect(screen.getByText('Reading a real training loop')).toBeInTheDocument()
    expect(screen.getByText('The last eight steps, as the loop recorded them')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'The evaluation' }))
    expect(screen.getByText('Evaluation harnesses')).toBeInTheDocument()
    expect(screen.getByText('The harness’s report')).toBeInTheDocument()
    expect(screen.getByText('the chance rate')).toBeInTheDocument()
  }, 120000)
})

describe('the systems laboratory', () => {
  it('compares the three splits and the tiled kernel', () => {
    renderLab('systems')
    expect(screen.getByText('The three splits, at this shape')).toBeInTheDocument()
    expect(screen.getByText('The all-reduce as the devices grow')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'The kernel' }))
    expect(screen.getByText('A memory-efficient attention kernel')).toBeInTheDocument()
    expect(screen.getByText('What the tiling cannot fix')).toBeInTheDocument()
  })
})

describe('the post-training laboratory', () => {
  it('supervises, reinforces and shows the verifier', () => {
    renderLab('postTraining')
    expect(screen.getByText('What the supervised stage learned')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'The reinforcement stage' }))
    expect(screen.getByText('The policy’s four probabilities')).toBeInTheDocument()
    expect(screen.getByText('The accuracy, by context')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'The verifier' }))
    expect(screen.getByText('Four candidate traces, one verifier')).toBeInTheDocument()
    expect(screen.getAllByText('accepts').length).toBeGreaterThan(0)
    expect(screen.getAllByText('rejects').length).toBeGreaterThan(0)
  }, 120000)
})

describe('the companion figures', () => {
  it('shows one computed figure for every lecture', () => {
    renderLab('companions')
    expect(screen.getByText('Every lecture, and the number that accompanies it')).toBeInTheDocument()
    expect(screen.getByText('bytes per token')).toBeInTheDocument()
    expect(screen.getByText('loss at initialisation')).toBeInTheDocument()
    expect(screen.getByText('optimal parameters at 1e23 FLOPs')).toBeInTheDocument()
    expect(companionFigures()).toHaveLength(11)
  })
})
