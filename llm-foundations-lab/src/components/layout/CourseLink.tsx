import { forwardRef } from 'react'
import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  type LinkProps,
  type NavLinkProps,
} from 'react-router-dom'

/**
 * Links that carry a view transition.
 *
 * A view transition cross-fades the old page into the new one instead of
 * swapping them in a single frame, which keeps the reader oriented: the
 * content they were reading does not vanish and reappear somewhere else.
 *
 * The transition is requested per link rather than set once for the whole
 * application, because the browser only knows how to animate a change that
 * it is told about. Wrapping the router's own links here means no component
 * has to remember to ask for it, and no link can forget.
 *
 * A browser without the View Transitions API ignores the request and
 * changes the page in the ordinary way. Support: Chrome 111, Edge 111,
 * Firefox 144, Safari 18.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(props, ref) {
  return <RouterLink ref={ref} {...props} viewTransition />
})

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(props, ref) {
  return <RouterNavLink ref={ref} {...props} viewTransition />
})
