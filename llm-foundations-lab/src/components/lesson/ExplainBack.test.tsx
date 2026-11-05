import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ExplainBack } from './ExplainBack'
import { ProgressProvider } from '../../state/ProgressContext'
import { EXPLANATION_BY_LESSON } from '../../content/explanations'

/**
 * The self-explanation exercise.
 *
 * The point of it is that the reader answers first and sees the model answer
 * second, and that the answer is kept. Both are asserted here, because an
 * exercise that shows the answer first is just a paragraph of prose.
 */

beforeEach(() => {
  // The progress file is in localStorage, and a reader who has already
  // answered comes back to the answer rather than to the question.
  window.localStorage.clear()
})

function renderExplain(lessonId = 'pretraining-why') {
  return render(
    <MemoryRouter>
      <ProgressProvider>
        <ExplainBack lessonId={lessonId} />
      </ProgressProvider>
    </MemoryRouter>,
  )
}

describe('the self-explanation exercise', () => {
  it('shows nothing for a lesson with no prompt', () => {
    const { container } = renderExplain('not-a-lesson')
    expect(container.querySelector('[data-testid="explain-back"]')).toBeNull()
  })

  it('asks the question and hides the answer', () => {
    renderExplain()
    const prompt = EXPLANATION_BY_LESSON.get('pretraining-why')!
    expect(screen.getByText(prompt.prompt)).toBeInTheDocument()
    expect(screen.queryByTestId('explanation-answer')).not.toBeInTheDocument()
  })

  it('does not show the answer until the reader asks for it', async () => {
    const user = userEvent.setup()
    renderExplain()
    await user.click(screen.getByTestId('reveal-answer'))
    expect(screen.getByTestId('explanation-answer')).toBeInTheDocument()
  })

  it('shows both the model answer and the mistake to check against', async () => {
    const user = userEvent.setup()
    const prompt = EXPLANATION_BY_LESSON.get('pretraining-why')!
    renderExplain()
    await user.click(screen.getByTestId('reveal-answer'))

    expect(screen.getByText(prompt.answer)).toBeInTheDocument()
    expect(screen.getByText(prompt.commonError)).toBeInTheDocument()
  })

  it('keeps what the reader wrote', async () => {
    const user = userEvent.setup()
    renderExplain()
    const box = screen.getByLabelText('Your explanation')
    await user.type(box, 'Predicting forces the model to use structure.')
    await user.click(screen.getByTestId('reveal-answer'))
    expect((box as HTMLTextAreaElement).value).toBe('Predicting forces the model to use structure.')
  })

  it('records how the reader said it went', async () => {
    const user = userEvent.setup()
    renderExplain()
    await user.click(screen.getByTestId('reveal-answer'))
    await user.click(screen.getByRole('button', { name: 'Not yet' }))

    const stored = window.localStorage.getItem('llm-foundations-lab:progress')
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored as string)
    expect(parsed.explanations['pretraining-why'].rating).toBe('not-yet')
  })

  it('shows the answer again when the reader comes back', async () => {
    const user = userEvent.setup()
    const { unmount } = renderExplain()
    await user.click(screen.getByTestId('reveal-answer'))
    await user.click(screen.getByRole('button', { name: 'I had it' }))
    unmount()

    renderExplain()
    await waitFor(() => {
      expect(screen.getByTestId('explanation-answer')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'I had it' })).toHaveAttribute('aria-pressed', 'true')
  })
})
