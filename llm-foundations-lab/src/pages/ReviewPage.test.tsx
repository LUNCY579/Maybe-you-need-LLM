import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ReviewPage } from './ReviewPage'
import { ProgressProvider } from '../state/ProgressContext'
import { QUIZ_BANK } from '../content/quiz'

/**
 * The review session is the one place where the spaced-repetition schedule
 * changes, so the tests here check that answering really does reschedule the
 * question and that the schedule really is written to the progress file.
 */

function renderReview() {
  return render(
    <MemoryRouter>
      <ProgressProvider>
        <ReviewPage />
      </ProgressProvider>
    </MemoryRouter>,
  )
}

/** The first question of a session is the first of the bank, in bank order. */
const FIRST = QUIZ_BANK[0]

/** Find the button carrying an option's text. */
function optionButton(text: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(escapeRegExp(text)) })
}

describe('the review page', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('counts every question in the bank as not seen before anything is reviewed', () => {
    renderReview()
    // A question that has never been asked is not at risk of being
    // forgotten, so it is counted as new material rather than as a review.
    expect(screen.getByText('Due for review')).toBeInTheDocument()
    expect(screen.getByText('Not seen yet')).toBeInTheDocument()
    expect(screen.getByText(String(QUIZ_BANK.length))).toBeInTheDocument()
  })

  it('starts a session of the questions that are due', async () => {
    const user = userEvent.setup()
    renderReview()

    const start = screen.getByTestId('start-review')
    expect(start).toBeEnabled()
    await user.click(start)

    expect(screen.getByText('1 / 20')).toBeInTheDocument()
  })

  it('shows the question and its options', async () => {
    const user = userEvent.setup()
    renderReview()
    await user.click(screen.getByTestId('start-review'))

    expect(screen.getByTestId('review-prompt')).toHaveTextContent(FIRST.prompt)
    for (const option of FIRST.options) {
      expect(optionButton(option)).toBeInTheDocument()
    }
  })

  it('reschedules a question after a correct answer', async () => {
    const user = userEvent.setup()
    renderReview()
    await user.click(screen.getByTestId('start-review'))

    await user.click(optionButton(FIRST.options[FIRST.correctIndex]))

    const verdict = await screen.findByTestId('schedule-verdict')
    expect(within(verdict).getByText(/Rescheduled/)).toBeInTheDocument()
    expect(within(verdict).getByText(/returns in 1 day/)).toBeInTheDocument()
  })

  it('reschedules a question after a wrong answer', async () => {
    const user = userEvent.setup()
    renderReview()
    await user.click(screen.getByTestId('start-review'))

    const wrong = FIRST.options.find((_, index) => index !== FIRST.correctIndex) as string
    await user.click(optionButton(wrong))

    const verdict = await screen.findByTestId('schedule-verdict')
    expect(within(verdict).getByText(/Back tomorrow/)).toBeInTheDocument()
  })

  it('does not accept a second answer for the same question', async () => {
    const user = userEvent.setup()
    renderReview()
    await user.click(screen.getByTestId('start-review'))

    const button = optionButton(FIRST.options[0])
    await user.click(button)
    expect(button).toBeDisabled()
  })

  it('keeps the schedule in the local progress file', async () => {
    const user = userEvent.setup()
    renderReview()
    await user.click(screen.getByTestId('start-review'))

    await user.click(optionButton(FIRST.options[FIRST.correctIndex]))

    await waitFor(() => {
      const stored = window.localStorage.getItem('llm-foundations-lab:progress')
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored as string)
      expect(Object.keys(parsed.reviews ?? {})).toContain(FIRST.id)
    })
  })

  it('lists the whole bank in the schedule panel', () => {
    renderReview()
    expect(screen.getByText(`${QUIZ_BANK.length} questions`)).toBeInTheDocument()
  })

  it('removes an answered question from the queue when the queue is rebuilt', async () => {
    const user = userEvent.setup()
    renderReview()
    await user.click(screen.getByTestId('start-review'))

    await user.click(optionButton(FIRST.options[FIRST.correctIndex]))
    await screen.findByTestId('schedule-verdict')

    // The question is now scheduled for tomorrow, so a rebuilt queue no longer
    // starts with it.
    await user.click(screen.getByRole('button', { name: 'Rebuild the queue' }))
    expect(screen.getByText('1 / 20')).toBeInTheDocument()
    expect(screen.queryByTestId('review-prompt')).not.toHaveTextContent(FIRST.prompt)
  })
})

/** Escape a string for use inside a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
