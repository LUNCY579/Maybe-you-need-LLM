import { fragmentAddress } from '../../core/fragments'

/**
 * Moving to a section of the current page, without leaving the page.
 *
 * The course uses a hash router, so the fragment of the address is the route.
 * A plain `href="#section"` therefore replaces the route rather than adding to
 * it, and takes the reader out of the course. This does the same thing the
 * browser would do — scroll the section into view and put the section in the
 * address so the link can be copied and reloaded — while leaving the route
 * alone.
 *
 * The address is written with `replaceState` rather than `pushState`, so the
 * section is not a separate entry in the history: the reader's back button
 * still goes back to the page they were on before, not to the last heading
 * they looked at.
 *
 * Returns false when there is no such section, so the caller can fall back.
 */
export function scrollToSection(id: string, options: { smooth?: boolean } = {}): boolean {
  const target = document.getElementById(id)
  if (!target) return false

  target.scrollIntoView({ behavior: options.smooth === false ? 'auto' : 'smooth', block: 'start' })

  const { pathname, search, hash } = window.location
  window.history.replaceState(null, '', fragmentAddress(pathname, search, hash, id))
  return true
}
