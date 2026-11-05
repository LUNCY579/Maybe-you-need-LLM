import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ErrorBoundary, ErrorNotice, RouteErrorElement } from './ErrorBoundary'

/**
 * The course has no server, so a failure in a view has to leave the reader
 * with a message and a way back rather than a blank page.
 */

describe('the error notice', () => {
  it('says what happened and offers a way back', () => {
    render(
      <MemoryRouter>
        <ErrorNotice error={new Error('the tokenizer exploded')} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Something failed while drawing this view')).toBeInTheDocument()
    expect(screen.getByText('the tokenizer exploded')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to course home' })).toHaveAttribute('href', '/')
  })

  it('says that nothing was sent anywhere', () => {
    render(
      <MemoryRouter>
        <ErrorNotice error={new Error('x')} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/no server/i)).toBeInTheDocument()
  })

  it('copes with something that is not an error', () => {
    render(
      <MemoryRouter>
        <ErrorNotice error={'a string, not an error'} />
      </MemoryRouter>,
    )
    expect(screen.getByText('a string, not an error')).toBeInTheDocument()
  })

  it('offers to try again when it can', async () => {
    const user = userEvent.setup()
    const retry = vi.fn()
    render(
      <MemoryRouter>
        <ErrorNotice error={new Error('x')} onRetry={retry} />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})

describe('the error boundary', () => {
  it('shows the notice when a child throws', () => {
    // React logs the error; the test does not care about the log.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Boom = () => {
      throw new Error('the page fell over')
    }
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </MemoryRouter>,
    )
    expect(screen.getByText('the page fell over')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('renders its children when nothing is wrong', () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <p>All is well</p>
        </ErrorBoundary>
      </MemoryRouter>,
    )
    expect(screen.getByText('All is well')).toBeInTheDocument()
  })
})

describe("the router's error element", () => {
  it('shows the course notice rather than the router default', () => {
    render(
      <MemoryRouter>
        <RouteErrorElement error={new Error('the route failed')} />
      </MemoryRouter>,
    )
    expect(screen.getByText('the route failed')).toBeInTheDocument()
    expect(screen.getByText('Something failed while drawing this view')).toBeInTheDocument()
  })
})
