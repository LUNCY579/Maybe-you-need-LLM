import { useCallback } from 'react'
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom'

/**
 * A navigate function that always carries a view transition.
 *
 * The same reasoning as `CourseLink` applies: a navigation made in code —
 * by the command palette, by the "next lesson" button, by a shortcut — is
 * as much a change of page as a click on a link, and it should be animated
 * in the same way.
 */
export function useCourseNavigate(): (to: To, options?: NavigateOptions) => void {
  const navigate = useNavigate()
  return useCallback(
    (to: To, options?: NavigateOptions) => {
      navigate(to, { ...options, viewTransition: true })
    },
    [navigate],
  )
}
