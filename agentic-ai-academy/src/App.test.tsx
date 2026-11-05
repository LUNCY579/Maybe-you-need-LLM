import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { LESSONS } from './content/lessons'
import { STORAGE_KEY } from './store/progressState'

function renderAt(hash: string) {
  window.location.hash = hash
  return render(<App />)
}

/**
 * Code-split routes resolve asynchronously, so every assertion about a page
 * has to wait for it. The tests below use `findBy*` for exactly that reason:
 * the page genuinely arrives a moment later, and a test that pretends
 * otherwise would be testing the bundler rather than the course.
 */
const LAZY_TIMEOUT = { timeout: 30_000 }

describe('application shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.location.hash = '#/'
  })

  it('renders the landing page with course statistics', () => {
    renderAt('#/')
    expect(screen.getByRole('heading', { level: 1, name: /language models become agents/i })).toBeInTheDocument()
    expect(screen.getByText(String(LESSONS.length))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /skip to content/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument()
  })

  it('shows the curriculum with lesson cards for every part', async () => {
    renderAt('#/curriculum')
    expect(
      await screen.findByRole('heading', { level: 1, name: /curriculum navigator/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument()
    for (const lesson of LESSONS) {
      expect(screen.getAllByText(lesson.title).length).toBeGreaterThan(0)
    }
  })

  it('renders the workflow builder with validation and controls', async () => {
    renderAt('#/builder')
    // The builder is code-split, so it resolves asynchronously.
    expect(await screen.findByRole('heading', { level: 1, name: /visual agent workflow builder/i }, LAZY_TIMEOUT)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /run to completion/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /⏭ Step/i })).toBeInTheDocument()
    expect(screen.getByText(/graph valid/i)).toBeInTheDocument()
  })

  it.each([
    { hash: '#/labs/planning', heading: /agent planning/i },
    { hash: '#/labs/memory', heading: /agent memory/i },
    { hash: '#/labs/world-model', heading: /world model/i },
    { hash: '#/labs/multi-agent', heading: /multi-agent collaboration/i },
    { hash: '#/labs/policy-priors', heading: /robot policies/i },
    { hash: '#/labs/memory-longevity', heading: /memory durability/i },
    { hash: '#/labs/reasoning', heading: /reasoning depth/i },
    { hash: '#/labs/retrieval', heading: /agentic retrieval/i },
  ])('renders the lab page at $hash', async ({ hash, heading }) => {
    // Each lab is a separate test so that a slow render cannot time out the
    // others, and so a failure points at one lab rather than four.
    const { unmount } = renderAt(hash)
    expect(await screen.findByRole('heading', { level: 1, name: heading }, LAZY_TIMEOUT)).toBeInTheDocument()
    unmount()
  })

  it('handles unknown routes with a helpful page', async () => {
    renderAt('#/does-not-exist')
    expect(
      await screen.findByRole('heading', { level: 1, name: /page not found/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument()
  })
})

describe('lesson reader workflow', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.location.hash = '#/lesson/what-agentic-llms-are'
  })

  it('shows objectives, sources and the assessment tab', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(
      await screen.findByRole('heading', { level: 1, name: /agentic llms: models, harnesses, loops/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument()
    expect(screen.getByText(/learning objectives/i)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /sources & provenance/i }))
    expect(screen.getByText(/Ch\. 1, §1\.2\.2 Agentic Harness/)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /assessment/i }))
    expect(screen.getByText(/Every question carries an explanation/i)).toBeInTheDocument()
  })

  it('marks a lesson complete and persists it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /mark lesson complete/i }, LAZY_TIMEOUT))
    expect(screen.getByText('Completed')).toBeInTheDocument()

    const stored = window.localStorage.getItem(STORAGE_KEY)
    expect(stored).toContain('what-agentic-llms-are')
  })

  it('records a quiz attempt and reveals the explanation', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /assessment/i }, LAZY_TIMEOUT))

    const quiz = screen.getByRole('radiogroup', { name: /Options for question 1/i })
    const options = within(quiz).getAllByRole('radio')
    await user.click(options[1])
    await user.click(screen.getAllByRole('button', { name: /check answer/i })[0])

    expect(screen.getAllByText(/^Correct$/).length).toBeGreaterThan(0)
    expect(screen.getByText(/act → observe → adapt loop/i)).toBeInTheDocument()

    const stored = window.localStorage.getItem(STORAGE_KEY)
    expect(stored).toContain('q1-1')
  })
})

describe('quiz centre', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.location.hash = '#/assessments'
  })

  it('offers practice, mixed sets and history', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(
      await screen.findByRole('heading', { level: 1, name: /quiz and challenge centre/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /mixed challenge set/i }))
    expect(screen.getByText(/stride across the whole course/i)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /attempt history/i }))
    expect(screen.getByText(/No attempts recorded yet/i)).toBeInTheDocument()
  })
})

describe('glossary and references', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('filters glossary terms', async () => {
    renderAt('#/glossary')
    expect(await screen.findByRole('heading', { level: 1, name: /glossary/i }, LAZY_TIMEOUT)).toBeInTheDocument()
    // The term heading, not the related-term buttons that now carry the same name.
    expect(screen.getByRole('heading', { name: 'Harness' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Model Context Protocol (MCP)' })).toBeInTheDocument()
  })

  it('documents licence notes', async () => {
    renderAt('#/references')
    expect(
      await screen.findByRole('heading', { level: 1, name: /references, citations and licences/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/MIT License/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/CC0 1.0/).length).toBeGreaterThan(0)
  })
})

describe('dashboard', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.location.hash = '#/dashboard'
  })

  it('renders stats and data controls', async () => {
    render(<App />)
    expect(
      await screen.findByRole('heading', { level: 1, name: /your dashboard/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export progress json/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /milestones/i })).toBeInTheDocument()
  })
})
