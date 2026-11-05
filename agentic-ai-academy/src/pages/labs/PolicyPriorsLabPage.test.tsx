import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PolicyPriorsLabPage } from './PolicyPriorsLabPage'
import { ProgressProvider } from '../../store/progress'
import { LESSONS } from '../../content/lessons'
import {
  DEFAULT_PRIOR_LEARNING_CONFIG,
  DEFAULT_SELF_GENERATED_CONFIG,
  TRANSFER_FAMILIES,
  runPriorTransferLab,
  runSelfGeneratedLoop,
} from '../../engine/labs/policyPriors'

/**
 * The screen test is also where the two laboratory items this page computes are
 * checked, so the figures a student reads off a panel are the figures the engine
 * returns for the settings the panel declares. Nothing here is a fixture: every
 * number is computed by the same call the page makes, and the assertions compare
 * the page's own text against it.
 */
function renderPage() {
  return render(
    <ProgressProvider totalLessons={LESSONS.length}>
      <PolicyPriorsLabPage />
    </ProgressProvider>,
  )
}

describe('robot policy laboratory screen', () => {
  it('opens on the transfer measurement and states the pretraining cost', () => {
    const { container } = renderPage()
    expect(screen.getByRole('heading', { level: 1, name: /robot policies/i })).toBeInTheDocument()

    const run = runPriorTransferLab(DEFAULT_PRIOR_LEARNING_CONFIG)
    // The pretraining figure is not a configured constant: it is the steps the
    // scratch arm spent learning the table every prior run then brings.
    expect(container.textContent).toContain(String(run.pretraining.interactionSteps))
    expect(container.textContent).toContain('Slip is a property of each family')
  })

  it('Ch. 7 and Ch. 23: the earliest of the vision-language-action models, and the clearest statement of what web-scale pretraining buys a robot.', () => {
    const { container } = renderPage()
    const run = runPriorTransferLab(DEFAULT_PRIOR_LEARNING_CONFIG)

    // What pretraining buys is measured in real interactions, per family, and
    // it is not uniformly positive: the aligned family is cheaper with the
    // prior, and the families where the prior points at a wall are dearer.
    expect(run.families).toHaveLength(TRANSFER_FAMILIES.length)
    for (const entry of run.families) {
      const priorCost = entry.prior.stepsToThreshold ?? entry.prior.interactionSteps
      const scratchCost = entry.scratch.stepsToThreshold ?? entry.scratch.interactionSteps
      expect(entry.stepSaving).toBe(scratchCost - priorCost)
      expect(entry.negativeTransfer).toBe(priorCost > scratchCost)
    }

    expect(run.helped).toEqual(['same-structure-new-pose'])
    expect(run.hurt).toEqual(['quarter-turn', 'mirrored-goal'])
    expect(run.families.find((entry) => entry.family.relation === 'aligned')?.speedup).toBeGreaterThan(1)
    for (const familyId of run.hurt) {
      expect(run.families.find((entry) => entry.family.id === familyId)?.speedup).toBeLessThan(1)
    }

    // The screen says what the run measured, in the same sign.
    expect(container.textContent).toContain(String(run.families.find((entry) => entry.family.id === 'same-structure-new-pose')?.stepSaving))
    expect(screen.getAllByText('negative transfer').length).toBe(run.hurt.length)
    expect(screen.getAllByText('positive transfer').length).toBe(run.helped.length)
  })

  it('Ch. 23 §23.2.2: a generalist robot policy trained on self-generated action data — the open-problem version of the world-model lesson.', async () => {
    const { container } = renderPage()
    await userEvent.click(screen.getByRole('tab', { name: /training on the policy's own data/i }))

    const run = runSelfGeneratedLoop(DEFAULT_SELF_GENERATED_CONFIG)
    expect(screen.getByRole('tabpanel', { name: /training on the policy's own data/i })).toBeInTheDocument()

    // The open problem, stated as a measurement: a model refitted on its own
    // policy's rollouts covers less of the state-action space each generation
    // and disagrees with the fixed probe more.
    expect(run.selfOnly.generations).toHaveLength(DEFAULT_SELF_GENERATED_CONFIG.generations)
    expect(run.selfOnly.finalError).toBeGreaterThan(run.selfOnly.initialError)
    expect(run.selfOnly.finalCoverage).toBeLessThan(run.selfOnly.initialCoverage)
    expect(run.selfOnly.errorCrossedAt).not.toBeNull()
    expect(run.selfOnly.degraded).toBe(true)

    // The control arm differs only in keeping part of the fixed pool, and it is
    // the one that holds coverage and agreement with the probe up.
    expect(run.mixed.finalCoverage).toBeGreaterThan(0.9)
    expect(run.mixed.finalError).toBeLessThan(run.selfOnly.finalError)
    expect(run.mixed.errorCrossedAt).toBeNull()

    // Both arms start identically, because generation 0 is the pool.
    expect(run.mixed.generations[0].modelError).toBe(run.selfOnly.generations[0].modelError)
    expect(run.selfOnly.generations[0].selfSamples).toBe(0)
    expect(run.mixed.generations[0].selfSamples).toBe(0)

    // Honest null: at the declared settings the two arms never part by more
    // than the degradation margin inside one generation, and the screen prints
    // that rather than implying they did.
    expect(run.separationAt).toBeNull()
    expect(container.textContent).toContain('separated at generation never')
  })

  it('re-runs the loop when the generation count is moved', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: /training on the policy's own data/i }))

    const list = screen.getByRole('list', { name: 'Generations of the self-generated loop' })
    const before = within(list).getAllByRole('listitem').length
    const generations = screen.getByRole('slider', { name: 'Generations' })

    // jsdom does not implement the keyboard stepping of a range input, so the
    // value is set the way a browser's own change event would set it.
    fireEvent.change(generations, { target: { value: String(DEFAULT_SELF_GENERATED_CONFIG.generations + 1) } })

    expect((generations as HTMLInputElement).value).toBe(String(DEFAULT_SELF_GENERATED_CONFIG.generations + 1))
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(before + 1)
    // The extra generation is the loop's own, not a duplicated one.
    expect(rows[rows.length - 1].textContent).toContain('g' + DEFAULT_SELF_GENERATED_CONFIG.generations)
  })

  it('switches the policy grids with the family picker', async () => {
    renderPage()
    const picker = screen.getByRole('combobox', { name: 'Transfer family' })
    expect(screen.getAllByRole('img', { name: /policy grid/i })).toHaveLength(2)

    await userEvent.selectOptions(picker, 'same-structure-new-pose')

    expect(picker).toHaveValue('same-structure-new-pose')
    // Every family is offered, with the measured sign of its transfer in the label.
    expect(within(picker).getAllByRole('option')).toHaveLength(TRANSFER_FAMILIES.length)
  })
})
