import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * The view a screen is showing, held in the URL.
 *
 * A lesson's `interactive.view` is a deep link — `/labs/circuit?view=prune` — and a
 * link is only real if arriving at it changes what is on screen. So the query
 * parameter is the state and the tab strip is its control: reading it here rather than
 * seeding a `useState` from it means back, forward and a second deep link to the same
 * laboratory all land where they say. A request for a view the screen does not offer
 * falls back to its first rather than rendering an empty panel; the curriculum and the
 * screens are checked against each other by a test, so a fallback here is a bug being
 * hidden, not a bug being handled.
 *
 * `views` is the screen's own exported list, in tab order — the same list the registry
 * publishes and the drift test reads.
 */
export function useViewParam<T extends string>(
  views: readonly { value: T; label: string }[],
): [T, (value: T) => void] {
  const [params, setParams] = useSearchParams()
  const requested = params.get('view')
  const view = views.some((entry) => entry.value === requested) ? (requested as T) : views[0]!.value

  const setView = useCallback(
    (next: T) => {
      setParams(
        (previous) => {
          const updated = new URLSearchParams(previous)
          updated.set('view', next)
          return updated
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return [view, setView]
}
