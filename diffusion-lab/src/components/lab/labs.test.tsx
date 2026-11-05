import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LABS, labForItem } from '../../content/labs'
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

describe('the forward laboratory', () => {
  it('writes the closed form out at three timesteps', () => {
    renderLab('forward')
    expect(screen.getByText('The chain, step by step')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'The closed form' }))
    expect(screen.getByText('The closed form at three timesteps')).toBeInTheDocument()
    expect(screen.getByText('x_t = √ᾱ_t·x_0 + √(1−ᾱ_t)·ε')).toBeInTheDocument()
    expect(screen.getByText('The closed form against the Markov chain')).toBeInTheDocument()
  })
})

describe('the reverse laboratory', () => {
  it('converts one network output between the parameterisations', () => {
    renderLab('reverse')
    expect(screen.getByText('Nothing to show yet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Parameterisations' }))
    expect(screen.getByText('One network output, three readings')).toBeInTheDocument()
    expect(screen.getByText('Why the conversion is exact')).toBeInTheDocument()
  })
})

describe('the schedule laboratory', () => {
  it('compares the two schedules', () => {
    renderLab('schedules')
    expect(screen.getByText('The cumulative signal ᾱ_t')).toBeInTheDocument()
    expect(screen.getByText('The signal-to-noise ratio')).toBeInTheDocument()
  })
})

describe('the latent laboratory', () => {
  it('round-trips points through the autoencoder and reports the error', () => {
    renderLab('latent')
    expect(screen.getByText('The autoencoder round trip')).toBeInTheDocument()
    expect(screen.getAllByText('reconstruction MSE').length).toBeGreaterThan(0)
    expect(screen.getByText('The compression')).toBeInTheDocument()
  })
})

describe('the guidance laboratory', () => {
  it('sweeps the guidance weight and measures the trade-off', () => {
    renderLab('guidance')
    expect(screen.getByText('The guided score field')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'The trade-off' }))
    expect(screen.getByText('Fidelity against the guidance weight')).toBeInTheDocument()
  })
})

describe('the variational laboratory', () => {
  it('shows the weights the true bound puts on the timesteps', () => {
    renderLab('variational')
    expect(screen.getByText('The weight the true bound puts on each timestep')).toBeInTheDocument()
    expect(screen.getByText('Why the simplification is not a small change')).toBeInTheDocument()
  })
})

describe('the preconditioning laboratory', () => {
  it('shows the coefficients, the ladder and both clocks', () => {
    renderLab('preconditioning')
    expect(screen.getByText('The noise ladder, largest σ first')).toBeInTheDocument()
    expect(screen.getAllByText('c_skip').length).toBeGreaterThan(0)
    expect(screen.getByText('A preconditioned sampler on a model with a known answer')).toBeInTheDocument()
    expect(screen.getByText('The same model on two clocks')).toBeInTheDocument()
    expect(screen.getByText('What the four coefficients do')).toBeInTheDocument()
  })
})
