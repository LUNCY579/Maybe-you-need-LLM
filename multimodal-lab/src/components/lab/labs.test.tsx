import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LABS, labForItem } from '../../content/labs'
import { LAB_SCREENS } from './screens'

afterEach(cleanup)

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
  }, 120000)
})

describe('the contrastive laboratory', () => {
  it('measures the temperature on a fixed trained model', () => {
    renderLab('contrastive')
    expect(screen.getByText('The training curve')).toBeInTheDocument()
    expect(screen.getByText('What the temperature does')).toBeInTheDocument()
    expect(screen.getByText('Effective captions')).toBeInTheDocument()
    expect(screen.getByText('The temperature is a decision, and it is in the gradient')).toBeInTheDocument()
  }, 120000)

  it('reads the zero-shot classifier through a prompt template', () => {
    renderLab('contrastive')
    fireEvent.click(screen.getByRole('button', { name: 'Zero-shot' }))
    expect(screen.getByText('The zero-shot classifier')).toBeInTheDocument()
    expect(screen.getByText('The prompt is part of the method')).toBeInTheDocument()
  }, 120000)
})

describe('the instruction laboratory', () => {
  it('prices the projection from the two widths', () => {
    renderLab('instruction')
    expect(screen.getByText('The three stages')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'The projection' }))
    expect(screen.getByText("The projection's dimensions")).toBeInTheDocument()
    expect(screen.getByText('A one-hot patch selects one row')).toBeInTheDocument()
    expect(screen.getAllByText(/4,198,400/).length).toBeGreaterThan(0)
  }, 60000)

  it('generates instruction pairs from captions', () => {
    renderLab('instruction')
    fireEvent.click(screen.getByRole('button', { name: 'From captions' }))
    expect(screen.getByText('One caption, five instruction pairs')).toBeInTheDocument()
    expect(screen.getByText('What the generator produces')).toBeInTheDocument()
    expect(screen.getByText('What this is, and what it is not')).toBeInTheDocument()
  }, 60000)

  it('measures the gain and the tax', () => {
    renderLab('instruction')
    fireEvent.click(screen.getByRole('button', { name: 'The tax' }))
    expect(screen.getByText('The gain and the tax, as the tuning is strengthened')).toBeInTheDocument()
    expect(screen.getByText('The two accuracies')).toBeInTheDocument()
  }, 60000)
})

describe('the sigmoid laboratory', () => {
  it('puts the two losses side by side and then breaks the coupling', () => {
    renderLab('sigmoid')
    expect(screen.getByText('Image 0’s row of the batch, read two ways')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'The coupling' }))
    expect(screen.getByText('A pair whose numbers never change, under both losses')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'The bias' }))
    expect(screen.getByText('The bias that makes the count fair')).toBeInTheDocument()
  })
})

describe('the frozen bridge laboratory', () => {
  it('reads patches with queries and prices the bridge', () => {
    renderLab('frozen')
    expect(screen.getByText('Query 0, over the 32 patch tokens')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'The bill' }))
    expect(screen.getByText('The bill, as the bridge widens')).toBeInTheDocument()
    expect(screen.getByText('The parameter bill, by width')).toBeInTheDocument()
  })
})

describe('the resampler laboratory', () => {
  it('shows the token count bounded by the latents', () => {
    renderLab('resampler')
    expect(screen.getByText('The token count, as the image grows')).toBeInTheDocument()
    expect(screen.getByText('The same bound at four resolutions')).toBeInTheDocument()
    expect(screen.getByText('Why the bound is structural')).toBeInTheDocument()
  })

  it('shows one latent reading the tokens', () => {
    renderLab('resampler')
    fireEvent.click(screen.getByRole('button', { name: 'The reading' }))
    expect(screen.getByText('Latent 0, over the 64 visual tokens')).toBeInTheDocument()
    expect(screen.getByText('The output is bounded by the tokens it read')).toBeInTheDocument()
    expect(screen.getByText('What this toy is, and what it is not')).toBeInTheDocument()
  })
})
