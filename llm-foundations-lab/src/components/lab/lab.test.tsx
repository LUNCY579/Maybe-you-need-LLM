import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlignmentLab } from './AlignmentLab'
import { InferenceLab } from './InferenceLab'
import { LearningLab } from './LearningLab'
import { PromptLab } from './PromptLab'
import { TransformerExplorer } from './TransformerExplorer'

describe('the foundation laboratories', () => {
  it('measures the safety evaluation of a chat model as violation rate against benign over-refusal', () => {
    render(<AlignmentLab view="safety" />)

    expect(screen.getByText('Safety evaluation of a chat model')).toBeInTheDocument()
    expect(screen.getByText('Safety training strength')).toBeInTheDocument()
    expect(screen.getByText('Disallowed answers')).toBeInTheDocument()
    expect(screen.getByText('Benign requests refused')).toBeInTheDocument()
    expect(screen.getByText('Where the violations remain')).toBeInTheDocument()
    expect(screen.getByText('The price of the target')).toBeInTheDocument()
  })

  it('compares CNN, RNN and attention side by side on path length and work', () => {
    render(<TransformerExplorer />)

    expect(screen.getByText('CNN, RNN and attention, side by side')).toBeInTheDocument()
    expect(screen.getByText('Convolution')).toBeInTheDocument()
    expect(screen.getByText('Recurrence')).toBeInTheDocument()
    expect(screen.getByText('Attention')).toBeInTheDocument()
    expect(screen.getByText('65,536')).toBeInTheDocument()
  })

  it('computes position interpolation and the effective context length from the rotary ladder', () => {
    render(<InferenceLab view="long-context" />)

    expect(screen.getByText('Position interpolation, counted')).toBeInTheDocument()
    expect(screen.getByText('Three strategies, one target')).toBeInTheDocument()
    expect(screen.getByText('Plain extrapolation')).toBeInTheDocument()
    expect(screen.getByText('Position interpolation')).toBeInTheDocument()
    expect(screen.getByText('NTK-aware scaling')).toBeInTheDocument()
    expect(screen.getByText('The slowest planes are the job')).toBeInTheDocument()
    expect(screen.getByText('What this view does not show')).toBeInTheDocument()
  })

  it('computes speculative decoding from the two distributions, not from a stored table', () => {
    render(<InferenceLab view="speculative" />)

    expect(screen.getByText('Draft, verify, and keep what passes')).toBeInTheDocument()
    expect(screen.getByText('The vocabulary, both distributions')).toBeInTheDocument()
    expect(screen.getByText('Longer drafts, diminishing returns')).toBeInTheDocument()
    expect(screen.getByText('What this view does not show')).toBeInTheDocument()
    expect(screen.getByText('Acceptance α')).toBeInTheDocument()
  })

  it('shows the few-shot curve against the chance line', () => {
    render(<PromptLab view="few-shot" />)

    expect(screen.getByText('Accuracy against the number of demonstrations')).toBeInTheDocument()
    expect(screen.getByText('The labels leak: what the prompt does to the prior')).toBeInTheDocument()
  })

  it('shows the Chinchilla allocation and the LLaMA budgets against it', () => {
    render(<LearningLab view="scaling" />)

    expect(screen.getByText('The compute-optimal allocation')).toBeInTheDocument()
    expect(screen.getByText('LLaMA against the Chinchilla-optimal token budget')).toBeInTheDocument()
    expect(screen.getByText('LLaMA 65B')).toBeInTheDocument()
  })
})
