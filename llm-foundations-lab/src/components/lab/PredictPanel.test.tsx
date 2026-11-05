import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PredictPanel, type PredictionQuestion } from './PredictPanel'

const questions: PredictionQuestion[] = [
  {
    id: 'q1',
    prompt: 'Which token wins?',
    options: [
      { label: 'learns', correct: true },
      { label: 'writes', correct: false },
    ],
    explanation: 'The highest logit wins.',
  },
  {
    id: 'q2',
    prompt: 'How many candidates survive?',
    options: [
      { label: '2', correct: false },
      { label: '4', correct: true },
    ],
    explanation: 'The nucleus is the smallest prefix reaching the threshold.',
  },
]

describe('prediction panel', () => {
  it('shows one question at a time and tracks the score', async () => {
    const user = userEvent.setup()
    render(
      <PredictPanel title="Predict" description="Commit to an answer." questions={questions} />,
    )

    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
    expect(screen.getByText('0 correct')).toBeInTheDocument()
    expect(screen.queryByText('How many candidates survive?')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'learns' }))
    expect(screen.getByText('Correct.')).toBeInTheDocument()
    expect(screen.getByText('1 correct')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
  })

  it('marks a wrong answer and shows the explanation', async () => {
    const user = userEvent.setup()
    render(
      <PredictPanel title="Predict" description="Commit to an answer." questions={questions} />,
    )

    await user.click(screen.getByRole('button', { name: 'writes' }))
    expect(screen.getByText(/Not quite/)).toBeInTheDocument()
    expect(screen.getByText('The highest logit wins.')).toBeInTheDocument()
    expect(screen.getByText('0 correct')).toBeInTheDocument()
  })

  it('does not accept a second answer for the same question', async () => {
    const user = userEvent.setup()
    render(
      <PredictPanel title="Predict" description="Commit to an answer." questions={questions} />,
    )

    await user.click(screen.getByRole('button', { name: 'writes' }))
    expect(screen.getByRole('button', { name: 'writes' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'learns' })).toBeDisabled()
  })

  it('resets the exercise', async () => {
    const user = userEvent.setup()
    render(
      <PredictPanel title="Predict" description="Commit to an answer." questions={questions} />,
    )

    await user.click(screen.getByRole('button', { name: 'learns' }))
    expect(screen.getByText('1 correct')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByText('0 correct')).toBeInTheDocument()
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
  })

  it('shows the closing note only once every question is right', async () => {
    const user = userEvent.setup()
    render(
      <PredictPanel
        title="Predict"
        description="Commit to an answer."
        questions={questions}
        closing="All correct."
      />,
    )
    expect(screen.queryByText('All correct.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'learns' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: '4' }))
    expect(screen.getByText('All correct.')).toBeInTheDocument()
  })
})
