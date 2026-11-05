import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LABS, labForItem } from '../../content/labs'
import { LAB_SCREENS } from './screens'

afterEach(cleanup)

function renderLab(id: string) {
  const Screen = LAB_SCREENS[id]
  if (!Screen) throw new Error(`no screen is registered for ${id}`)
  return render(<Screen />)
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
  }, 180000)
})

describe('the sparse laboratory', () => {
  it('prices the index from the postings', () => {
    renderLab('sparse')
    expect(screen.getByText('The size of the index')).toBeInTheDocument()
    expect(screen.getByText('How rare the words are')).toBeInTheDocument()
  }, 60000)
})

describe('the dense laboratory', () => {
  it('trains a bi-encoder and ranks with it', () => {
    renderLab('dense')
    expect(screen.getByText('The ranking, under the learned embedding')).toBeInTheDocument()
    expect(screen.getByText('What the model learned')).toBeInTheDocument()
  }, 60000)

  it('compares the tied encoder with a separate pair', () => {
    renderLab('dense')
    fireEvent.click(screen.getByRole('button', { name: 'The two encoders' }))
    expect(screen.getByText('One encoder, or two')).toBeInTheDocument()
    expect(screen.getByText('The three networks of the pipeline')).toBeInTheDocument()
    expect(screen.getByText('Why the question and the document are not the same distribution')).toBeInTheDocument()
  }, 120000)

  it('sweeps the recall against the embedding dimension', () => {
    renderLab('dense')
    fireEvent.click(screen.getByRole('button', { name: 'The dimension' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run the sweep' }))
    expect(screen.getByText('The recall against the width')).toBeInTheDocument()
    expect(screen.getByText('What each width costs')).toBeInTheDocument()
    expect(screen.getByText('A curve at one budget is not the whole story')).toBeInTheDocument()
  }, 180000)
})

describe('the late-interaction laboratory', () => {
  it('scores a question word by word', () => {
    renderLab('late')
    expect(screen.getByText('The ranking under the late interaction')).toBeInTheDocument()
    expect(screen.getByText('The price, and the catch')).toBeInTheDocument()
  }, 60000)

  it('compares the three scorers on a multi-hop question', () => {
    renderLab('late')
    fireEvent.click(screen.getByRole('button', { name: 'The multi-hop question' }))
    expect(screen.getByText('Both evidence documents, as the depth grows')).toBeInTheDocument()
    expect(screen.getByText('What the three scorers find')).toBeInTheDocument()
    expect(screen.getByText('What each score keeps of the question')).toBeInTheDocument()
    expect(screen.getByText('What this demonstration is, and is not')).toBeInTheDocument()
  }, 60000)
})

describe('the long-context laboratory', () => {
  it('reads the evidence with and without retrieval', () => {
    renderLab('context')
    expect(screen.getByText('The reader, with and without the evidence')).toBeInTheDocument()
    expect(screen.getByText('The division of labour')).toBeInTheDocument()
  }, 60000)

  it('measures the accuracy against the position of the evidence', () => {
    renderLab('context')
    fireEvent.click(screen.getByRole('button', { name: 'The position' }))
    expect(screen.getByText('The attention, against the position')).toBeInTheDocument()
    expect(screen.getByText('A context is not a place')).toBeInTheDocument()
  }, 60000)

  it('counts the two memories against each other', () => {
    renderLab('context')
    fireEvent.click(screen.getByRole('button', { name: 'The two memories' }))
    expect(screen.getByText('The bill for each memory')).toBeInTheDocument()
    expect(screen.getByText('A decade at a time')).toBeInTheDocument()
    expect(screen.getByText('What each memory can do')).toBeInTheDocument()
    expect(screen.getByText('A sizing model, not a benchmark')).toBeInTheDocument()
    // Seven billion parameters at two bytes, twenty-one million passages of 768 values at four.
    expect(screen.getByText(/4,557,292 passages/)).toBeInTheDocument()
  }, 60000)
})
