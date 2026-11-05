import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { LABS } from '../../content/labs'
import { buildTask, demonstratorPolicy, runSft, sampleDemonstrations } from '../../core/sft'
import { fitRewardModel, samplePreferences } from '../../core/rewardModel'
import { runPpoStage } from '../../core/ppoStage'
import { LAB_SCREENS, LAB_VIEWS } from './index'

/**
 * The screens, rendered.
 *
 * A screen is the only place where a lesson's deep link and a core function's number
 * meet, and both fail silently: a view a screen does not have opens the wrong panel, and
 * a runtime error inside a `useMemo` is an empty page. So each screen is mounted here at
 * every view it declares, with the router the application actually gives it.
 *
 * Two of these screens fit a reward model and then run a policy optimisation inside a
 * `useMemo`, which is seconds of arithmetic rather than milliseconds, so the tests that
 * render every view are given a timeout that matches.
 */

/** A slow view is the pipeline's stage three: a fit, then six hundred PPO steps. */
const SLOW = 180_000

function renderLab(id: string, search = '') {
  const Screen = LAB_SCREENS[id]
  return render(
    <MemoryRouter initialEntries={[`/labs/${id}${search}`]}>
      <Screen />
    </MemoryRouter>,
  )
}

// Vitest runs without globals, so testing-library's automatic cleanup is not installed.
afterEach(cleanup)

const pressed = (label: string) => screen.getByRole('button', { name: label }).getAttribute('aria-pressed')

describe('every laboratory screen', () => {
  for (const lab of LABS) {
    const views = LAB_VIEWS[lab.id] ?? []

    describe(lab.id, () => {
      it('renders', () => {
        renderLab(lab.id)
        expect(screen.getAllByText(/Laboratory [A-F] ·/).length).toBeGreaterThan(0)
        expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0)
      }, SLOW)

      it('has more than one view, and names each of them', () => {
        expect(views.length, lab.id).toBeGreaterThan(1)
        for (const view of views) {
          expect(view.value, lab.id).toBeTruthy()
          expect(view.label.length, lab.id).toBeGreaterThan(2)
        }
      })

      it('opens on its first view', () => {
        renderLab(lab.id)
        expect(pressed(views[0]!.label)).toBe('true')
        for (const view of views.slice(1)) expect(pressed(view.label)).toBe('false')
      }, SLOW)

      it('opens at the view a deep link asks for', () => {
        for (const view of views) {
          const { unmount } = renderLab(lab.id, `?view=${view.value}`)
          const link = `${lab.id}?view=${view.value}`
          expect(pressed(view.label), link).toBe('true')
          expect(document.body.textContent ?? '', link).toContain(view.label)
          unmount()
        }
      }, SLOW)

      it('falls back to its default when asked for a view it does not have', () => {
        renderLab(lab.id, '?view=not-a-view')
        expect(pressed(views[0]!.label)).toBe('true')
      }, SLOW)

      it('puts the view in the URL, so a click and a deep link agree', () => {
        const second = views[1]
        if (!second) return
        const { unmount } = renderLab(lab.id)
        fireEvent.click(screen.getByRole('button', { name: second.label }))
        expect(pressed(second.label)).toBe('true')
        expect(pressed(views[0]!.label)).toBe('false')
        const clicked = document.body.textContent ?? ''
        unmount()

        // The state is the query parameter, not a hook seeded from it once: arriving at
        // the link shows exactly what clicking the tab showed.
        const deep = renderLab(lab.id, `?view=${second.value}`)
        expect(document.body.textContent ?? '').toBe(clicked)
        deep.unmount()
      }, SLOW)

      it('prints no broken number on any view', () => {
        for (const view of views) {
          const { unmount } = renderLab(lab.id, `?view=${view.value}`)
          const text = document.body.textContent ?? ''
          const link = `${lab.id}?view=${view.value}`
          for (const broken of ['NaN', 'undefined', 'Infinity', '[object', 'null']) {
            expect(text.includes(broken), `${link} shows ${broken}`).toBe(false)
          }
          expect(text.length, `${link} renders an empty panel`).toBeGreaterThan(400)
          unmount()
        }
      }, SLOW)
    })
  }
})

/**
 * The pipeline screen's own claim.
 *
 * The run view says the proxy climbs while the gold reward peaks and then falls, and it
 * prints the numbers it measured that on. They are the same screen's defaults, so the
 * same three stages are run here from the core and the printed figures are checked
 * against them — the screen is then a rendering of the computation rather than a second
 * account of it.
 */

/** The screen's defaults: the top band, one flipped label in ten, six hundred epochs and steps. */
const SCREEN_RUN = (() => {
  const task = buildTask({})
  const teacher = demonstratorPolicy(task, 0.25)
  const sft = runSft(task, sampleDemonstrations(task, teacher, 600, 21, 0), { steps: 600, learningRate: 0.5, teacher })
  const band: [number, number] = [0.4, 1]
  const pairs = samplePreferences(task, { count: 400, seed: 31, band, labelNoise: 0.1 })
  const fit = fitRewardModel(task, pairs, { steps: 600, band, labelNoise: 0.1, seed: 31 })
  const stage = runPpoStage(task, fit.model, sft.policy, {
    beta: 0.1,
    steps: 600,
    batch: 96,
    learningRate: 0.5,
    seed: 41,
    reportEvery: 10,
  })
  return { sft, fit, stage }
})()

describe('the pipeline screen’s run view', () => {
  const stat = (label: string) => screen.getByText(label).closest('.stat')?.textContent ?? ''

  it('prints the loss and its exact floor', () => {
    renderLab('pipeline', '?view=run')
    expect(stat('Stage one: the loss')).toContain(SCREEN_RUN.sft.finalLoss.toFixed(4))
    expect(stat('Stage one: the loss')).toContain(SCREEN_RUN.sft.exactLoss.toFixed(4))
  }, SLOW)

  it('prints where the gold reward peaked and how much it gave away', () => {
    renderLab('pipeline', '?view=run')
    const given = stat('Given away after the peak')
    expect(given).toContain(SCREEN_RUN.stage.dropFromBest.toFixed(4))
    expect(given).toContain(`peaked at step ${SCREEN_RUN.stage.bestGoldStep} of`)
  }, SLOW)

  it('prints both ends of the two curves it draws', () => {
    renderLab('pipeline', '?view=run')
    expect(stat('Stage three: the proxy at the end')).toContain(SCREEN_RUN.stage.proxyAtEnd.toFixed(4))
    expect(stat('Stage three: the proxy at the end')).toContain(SCREEN_RUN.stage.proxyAtReference.toFixed(4))
    expect(stat('The gold reward at the end')).toContain(SCREEN_RUN.stage.goldAtEnd.toFixed(4))
    expect(stat('The gold reward at the end')).toContain(SCREEN_RUN.stage.goldAtReference.toFixed(4))
  }, SLOW)

  it('reports a run that gave gold reward away, which is the point of the screen', () => {
    expect(SCREEN_RUN.stage.dropFromBest).toBeGreaterThan(0.01)
    expect(SCREEN_RUN.stage.goldAtEnd).toBeLessThan(SCREEN_RUN.stage.goldAtReference)
    expect(SCREEN_RUN.stage.bestGoldStep).toBeGreaterThan(0)
    expect(SCREEN_RUN.stage.bestGoldStep).toBeLessThan(SCREEN_RUN.stage.steps)
  })
})
