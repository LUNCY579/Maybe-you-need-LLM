import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CommandPalette, type PaletteCommand } from './CommandPalette'
import { buildIndex } from '../../content/searchIndex'

/**
 * The command palette is a modal dialog, so the browser owns the open and
 * close cycle. These tests check that the palette finds the right things,
 * that the keyboard works, and that a command really runs.
 */

const commands: PaletteCommand[] = [
  {
    id: 'theme',
    title: 'Switch to the light theme',
    detail: 'The colour scheme of the whole course',
    group: 'Command',
    keywords: ['theme', 'colour', 'dark', 'light'],
    run: () => {},
  },
  {
    id: 'review',
    title: 'Start a review session',
    detail: 'Spaced repetition, scheduled with SM-2',
    group: 'Command',
    keywords: ['review', 'due', 'spaced'],
    run: () => {},
  },
]

function renderPalette(open = true) {
  return render(
    <MemoryRouter>
      <CommandPalette open={open} onClose={() => {}} commands={commands} hits={buildIndex()} />
    </MemoryRouter>,
  )
}

describe('the command palette', () => {
  it('is a modal dialog', () => {
    renderPalette()
    const dialog = screen.getByRole('dialog', { name: 'Command palette' })
    expect(dialog).toBeInTheDocument()
    // `showModal` puts the dialog in the top layer and marks the rest of the
    // page inert, which is what a modal dialog has to do.
    expect(dialog).toHaveAttribute('open')
  })

  it('offers the commands when nothing has been typed', () => {
    renderPalette()
    expect(screen.getByText('Switch to the light theme')).toBeInTheDocument()
  })

  it('finds a command by a word in its title', async () => {
    const user = userEvent.setup()
    renderPalette()
    await user.type(screen.getByRole('combobox'), 'review')
    const titles = screen.getAllByRole('option').map((option) => option.textContent ?? '')
    expect(titles.some((title) => title.includes('Start a review session'))).toBe(true)
  })

  it('finds a command by one of its keywords', async () => {
    const user = userEvent.setup()
    renderPalette()
    await user.type(screen.getByRole('combobox'), 'spaced')
    expect(screen.getByText('Start a review session')).toBeInTheDocument()
  })

  it('finds a lesson by a fragment of its title', async () => {
    const user = userEvent.setup()
    renderPalette()
    await user.type(screen.getByRole('combobox'), 'kv')
    // "Long sequences and the KV cache" is a lesson title. The titles are
    // split into runs for the highlight, so the match is on the text of the
    // whole option rather than on one element.
    await waitFor(() => {
      const titles = screen.getAllByRole('option').map((option) => option.textContent ?? '')
      expect(titles.some((title) => title.includes('Long sequences and the KV cache'))).toBe(true)
    })
  })

  it('says when nothing matches', async () => {
    const user = userEvent.setup()
    renderPalette()
    await user.type(screen.getByRole('combobox'), 'zzzzzz')
    expect(screen.getByText('Nothing matches that.')).toBeInTheDocument()
  })

  it('runs the command that is chosen', async () => {
    const run = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <CommandPalette
          open
          onClose={() => {}}
          commands={[{ ...commands[1], run }]}
          hits={buildIndex()}
        />
      </MemoryRouter>,
    )
    await user.click(screen.getByText('Start a review session'))
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('moves the selection with the arrow keys', async () => {
    const user = userEvent.setup()
    renderPalette()
    const input = screen.getByRole('combobox')
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')

    await user.click(input)
    await user.keyboard('{ArrowDown}')
    await waitFor(() => {
      expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
    })
  })
})
