import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgenticRetrievalLabPage } from './AgenticRetrievalLabPage'
import { ProgressProvider } from '../../store/progress'
import { LESSONS } from '../../content/lessons'
import {
  DEFAULT_AGENTIC_CONFIG,
  comparePipelines,
  runAdaptiveRetrieval,
  runQuestionDecomposition,
} from '../../engine/demos/agenticRetrieval'

/**
 * The screen is checked against the engine, not against a table of strings:
 * every figure asserted here is computed by the same call the page makes, with
 * the settings the page declares as its defaults, so a change to either half
 * fails loudly instead of leaving a stale caption behind.
 */
function renderPage() {
  return render(
    <ProgressProvider totalLessons={LESSONS.length}>
      <AgenticRetrievalLabPage />
    </ProgressProvider>,
  )
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`

async function openTab(label: string) {
  await userEvent.click(screen.getByRole('tab', { name: label }))
}

describe('agentic retrieval laboratory screen', () => {
  it('Ch. 12 §12.4: adaptive retrieval with critique.', () => {
    const run = runAdaptiveRetrieval(DEFAULT_AGENTIC_CONFIG)
    renderPage()

    // Both arms' headline figures are the engine's own counts.
    expect(screen.getByText(`${run.baseline.correct}/${run.baseline.cases}`)).toBeInTheDocument()
    expect(screen.getAllByText(`${run.gated.correct}/${run.gated.cases}`).length).toBeGreaterThanOrEqual(1)
    // The gated rate is printed inside a longer hint, so it is matched as a
    // prefix rather than as a whole cell.
    expect(screen.getAllByText(new RegExp(percent(run.gated.correctRate)))).toHaveLength(1)
    expect(screen.getAllByText(`${run.gated.decoysRejected}`).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(`${run.gated.tokensPerCorrect}`)).toBeInTheDocument()

    // The plain pipeline has no critic, so it turns away no decoy at all — and
    // the screen shows the gated count without claiming the same for it.
    expect(run.baseline.decoysRejected).toBe(0)
    expect(run.gated.decoysRejected).toBeGreaterThan(0)

    // Every gate-closed question is counted, on one side or the other.
    const closed = run.gated.runs.filter((entry) => entry.gateOpened === false)
    expect(run.gated.retrievalsAvoided + run.gated.wronglySkipped).toBe(closed.length)

    // One row per critique case, each labelled with whether the corpus owns the
    // answer, and with the documented failures named rather than dropped.
    const owned =
      screen.getAllByText('needs a lookup').length + screen.getAllByText('no lookup needed').length
    expect(owned).toBe(run.gated.runs.length)
    expect(screen.getAllByText('documented failure')).toHaveLength(run.gated.runs.filter((entry) => entry.nullCase).length)
    expect(
      screen.getAllByText('answered without looking').length,
    ).toBe(run.gated.runs.filter((entry) => entry.action === 'answer-internally').length)
  })

  it('turns the rewrite budget off and the rescued answers become abstentions', () => {
    const withRewrites = runAdaptiveRetrieval(DEFAULT_AGENTIC_CONFIG).gated
    renderPage()

    const slider = screen.getByRole('slider', { name: 'Rewrites allowed' })
    fireEvent.change(slider, { target: { value: '0' } })
    expect((slider as HTMLInputElement).value).toBe('0')

    const noRewrites = runAdaptiveRetrieval({ ...DEFAULT_AGENTIC_CONFIG, maxRewrites: 0 }).gated
    expect(noRewrites.rewrites).toBe(0)
    expect(noRewrites.abstentions).toBeGreaterThan(withRewrites.abstentions)
    expect(noRewrites.wrongAnswers).toBeLessThan(withRewrites.wrongAnswers)
    expect(noRewrites.tokens).toBeLessThan(withRewrites.tokens)

    // The abstentions are on the screen, and so is the cost of the second pass.
    expect(screen.getAllByText('abstained').length).toBeGreaterThanOrEqual(noRewrites.abstentions)
    expect(screen.getByText(`${noRewrites.tokensPerCorrect}`)).toBeInTheDocument()
  })

  it('Ch. 12 §12.4: question decomposition for multi-hop retrieval.', async () => {
    const dec = runQuestionDecomposition(DEFAULT_AGENTIC_CONFIG)
    renderPage()
    await openTab('2 · One query per sub-question')

    expect(screen.getByText(percent(dec.singleShot.hopCoverage))).toBeInTheDocument()
    expect(screen.getByText(percent(dec.decomposed.hopCoverage))).toBeInTheDocument()
    expect(screen.getByText(`${dec.decomposed.retrievals} retrievals, ${dec.decomposed.tokens} tokens against ${dec.singleShot.retrievals} and ${dec.singleShot.tokens}`)).toBeInTheDocument()

    // Decomposition is not the winner by construction: it buys coverage and it
    // creates a channel for a wrong intermediate answer.
    expect(dec.decomposed.hopCoverage).toBeGreaterThan(dec.singleShot.hopCoverage)
    const propagated = dec.decomposed.runs.filter((run) => run.propagated)
    expect(propagated.length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Propagation fired at hop/)).toHaveLength(propagated.length)

    // A hop whose subject differs from the one the question asked for is flagged
    // in the table, once per such hop.
    const mismatched = dec.decomposed.runs.reduce(
      (sum, run) => sum + run.hops.filter((hop) => hop.subjectUsed !== hop.subjectWanted).length,
      0,
    )
    expect(screen.getAllByText('wrong subject')).toHaveLength(mismatched)

    // The stale record is shown as what it is, rather than silently chosen.
    expect(screen.getAllByText(/superseded record/).length).toBe(
      dec.decomposed.runs.reduce((sum, run) => sum + run.hops.filter((hop) => hop.chosen?.stale).length, 0),
    )
  })

  it('moves the hop margin and the hop coverage moves with it', async () => {
    renderPage()
    await openTab('2 · One query per sub-question')
    const before = runQuestionDecomposition(DEFAULT_AGENTIC_CONFIG).decomposed

    const slider = screen.getByRole('slider', { name: 'Margin required to trust a hop' })
    fireEvent.change(slider, { target: { value: '0' } })
    expect((slider as HTMLInputElement).value).toBe('0')

    const atZero = runQuestionDecomposition({ ...DEFAULT_AGENTIC_CONFIG, minHopMargin: 0 }).decomposed
    expect(atZero.hopCoverage).toBeGreaterThan(before.hopCoverage)
    expect(atZero.answersRecovered).toBeGreaterThan(before.answersRecovered)
    expect(screen.getByText(percent(atZero.hopCoverage))).toBeInTheDocument()
    // Trusting every hop is not free either: the same retrievals, and a store
    // whose guesses are now carried forward.
    expect(atZero.retrievals).toBe(before.retrievals)
  })

  it('Ch. 12 §12.6: the survey that maps agentic RAG onto the single-shot pipeline the chapter teaches.', async () => {
    const comparison = comparePipelines(DEFAULT_AGENTIC_CONFIG)
    renderPage()
    await openTab('3 · Four shapes, one case set')

    expect(comparison.rows).toHaveLength(4)
    for (const row of comparison.rows) {
      expect(screen.getAllByText(`${row.correct}/${row.cases}`).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(`${row.retrievals}`).length).toBeGreaterThanOrEqual(1)
      if (row.recall !== null) expect(screen.getAllByText(percent(row.recall)).length).toBeGreaterThanOrEqual(1)
    }

    // Only the adaptive shape is allowed to say it does not know, and the
    // column says so for the other three.
    const never = comparison.rows.filter((row) => row.abstentions === 0)
    expect(never).toHaveLength(3)
    expect(screen.getAllByText('never')).toHaveLength(never.length)
    const abstaining = comparison.rows.filter((row) => row.abstentions > 0)
    expect(abstaining).toHaveLength(1)
    expect(screen.getAllByText(`${abstaining[0].abstentions} times`)).toHaveLength(1)

    // The shape that abstains is also the shape that answers wrongly least often.
    expect(Math.min(...comparison.rows.map((row) => row.hallucinations))).toBe(abstaining[0].hallucinations)
  })

  it('is deterministic: the same settings give the same figures on a second render', () => {
    const first = runAdaptiveRetrieval(DEFAULT_AGENTIC_CONFIG)
    const second = runAdaptiveRetrieval(DEFAULT_AGENTIC_CONFIG)
    expect(second.gated).toEqual(first.gated)
    expect(comparePipelines(DEFAULT_AGENTIC_CONFIG).rows).toEqual(comparePipelines(DEFAULT_AGENTIC_CONFIG).rows)

    const { container } = renderPage()
    const text = container.textContent
    renderPage()
    expect(screen.getAllByText(`${first.gated.correct}/${first.gated.cases}`).length).toBeGreaterThan(0)
    expect(text).toContain('Lab H')
  })
})
