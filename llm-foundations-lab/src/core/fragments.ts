/**
 * Fragments inside a hash-routed site.
 *
 * The course uses a hash router so that the built site can be served from any
 * static path, or opened from the file system, without server rewrites. In a
 * hash router the fragment *is* the route: the address of a lesson is
 * `/#/lessons/pretraining-bert`, and everything after the first `#` is the
 * path.
 *
 * That has a consequence that is easy to get wrong. A plain
 * `<a href="#section">` does not add a fragment to the current page — it
 * *replaces* the route with the word "section", and the reader is taken to
 * the page that says the address is not part of the course. A reader who
 * clicks a heading on a page and is thrown out of the course has found a bug
 * that is about the course's own navigation.
 *
 * So a fragment has to be appended to the route rather than replace it:
 * `/#/lessons/pretraining-bert#attention`. React Router splits that back
 * into a path and a fragment, because it takes everything after the first
 * `#` as the route and then splits *that* on the second `#`.
 *
 * These two functions do the joining, and they are pure so that the rules can
 * be tested without a browser.
 */

/**
 * The fragment of a hash-routed address, without its `#`.
 *
 * Two forms of the same thing are in play, and this reads both.
 *
 * The browser's `location.hash` for the address `/#/status#alignment` is
 * `#/status#alignment`: the route first, and then the fragment, because
 * everything after the first `#` is the route in a hash router, and the
 * fragment is the part of that after the second `#`.
 *
 * The router's own `location.hash` for the same address is `#alignment`,
 * because the router has already taken the route off the front.
 *
 * An address with no fragment gives an empty string, which means "no
 * fragment" — and so does a tail that looks like a route, because that is
 * the route and not a fragment.
 */
export function fragmentOf(hash: string): string {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
  const second = withoutHash.indexOf('#')
  const tail = second === -1 ? withoutHash : withoutHash.slice(second + 1)
  return tail.startsWith('/') ? '' : tail
}

/**
 * The address of a fragment within the current route.
 *
 * The route is kept and the fragment is appended to it, so the result is
 * still a course address: a reader can copy it, paste it to somebody else,
 * or reload the page and land in the same place.
 */
export function appendFragment(hash: string, fragment: string): string {
  const withHash = hash.startsWith('#') ? hash : `#${hash}`
  // A fragment that is already there is replaced rather than stacked: the
  // reader asked for this one, not for both.
  const second = withHash.indexOf('#', 1)
  const route = (second === -1 ? withHash : withHash.slice(0, second)).replace(/#+$/, '')
  const clean = fragment.replace(/^#+/, '')
  return clean ? `${route}#${clean}` : route
}

/**
 * The full address for a fragment within the current route.
 *
 * The path and the query string are kept as they are; only the fragment part
 * of the address changes. The result is a relative address, which is what
 * `history.replaceState` wants.
 */
export function fragmentAddress(pathname: string, search: string, hash: string, fragment: string): string {
  return `${pathname}${search}${appendFragment(hash, fragment)}`
}
