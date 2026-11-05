import { describe, expect, it } from 'vitest'
import { fireEvent, render, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OveroptimisationLab } from './OveroptimisationLab'
import { bestOfNGain, buildRewardSetting, sweepOveroptimisation } from '../../core/overoptimisation'

/**
 * The course's rule is that a chart is never the only way to see a number. So
 * the toggle inside a figure has to produce those numbers, and a figure that is
 * already a table must not offer a control that leads nowhere.
 */
const setting = buildRewardSetting(61, 6, 0.35, 3, 13)

function figureByTitle(container: HTMLElement, title: string) {
  const figure = [...container.querySelectorAll('figure')].find((f) => f.textContent?.includes(title))
  if (!figure) throw new Error(`no figure titled ${title}`)
  return figure
}

describe('the figures of the overoptimisation laboratory', () => {
  it('turns the toggle of the curve figure into the numbers behind it', () => {
    const { container, unmount } = render(
      <MemoryRouter>
        <OveroptimisationLab />
      </MemoryRouter>,
    )
    const figure = figureByTitle(container, 'The proxy rises')
    const button = within(figure).getByRole('button', { name: 'Show the data' })
    expect(within(figure).queryByRole('table')).toBeNull()

    fireEvent.click(button)
    const curve = sweepOveroptimisation(setting, 2, 160)
    const rows = [...within(figure).getAllByRole('row')]
    expect(rows).toHaveLength(22)
    expect(within(button).getByText('Hide the data')).toBeInTheDocument()
    expect(rows[1]!.textContent).toContain(curve.points[0]!.proxy.toFixed(4))
    expect(rows[1]!.textContent).toContain(curve.points[0]!.trueReward.toFixed(4))
    expect(rows[21]!.textContent).toContain(curve.points[160]!.kl.toFixed(4))
    expect(rows[21]!.textContent).toContain(curve.points[160]!.proxy.toFixed(4))
    unmount()
  })

  it('gives the best-of-n fit figure every sample size it plotted', () => {
    const { container, unmount } = render(
      <MemoryRouter>
        <OveroptimisationLab />
      </MemoryRouter>,
    )
    fireEvent.click(within(container.querySelector('.segmented') as HTMLElement).getByRole('button', { name: 'The fits' }))
    const figure = figureByTitle(container, 'The best-of-n gain')
    fireEvent.click(within(figure).getByRole('button', { name: 'Show the data' }))

    const gain = bestOfNGain(setting)
    const rows = [...within(figure).getAllByRole('row')]
    expect(rows).toHaveLength(gain.distances.length + 1)
    const last = rows[rows.length - 1]!.textContent ?? ''
    expect(last).toContain(gain.distances[gain.distances.length - 1]!.toFixed(4))
    expect(last).toContain(gain.fit.fitted[gain.distances.length - 1]!.toFixed(4))
    unmount()
  })

  it('offers no data control for a figure that is already a table', () => {
    const { container, unmount } = render(
      <MemoryRouter>
        <OveroptimisationLab />
      </MemoryRouter>,
    )
    fireEvent.click(within(container.querySelector('.segmented') as HTMLElement).getByRole('button', { name: 'Where to stop' }))
    const figure = figureByTitle(container, 'Where the policy should stop')
    expect(within(figure).queryByRole('button', { name: /the data/ })).toBeNull()
    expect(within(figure).getByRole('table')).toBeInTheDocument()
    unmount()
  })
})
