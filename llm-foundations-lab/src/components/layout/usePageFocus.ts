import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { fragmentOf } from '../../core/fragments'

/**
 * Moves the focus to the new page when the route changes, and puts the
 * reader in the right place in it.
 *
 * A single-page application changes its page without the browser doing
 * anything about the focus. The element the reader clicked is either gone or
 * still in the navigation, and a screen reader has no reason to say anything
 * — so a reader who follows a link with the keyboard is left with silence,
 * and no way to tell whether the link worked.
 *
 * The fix is what the browser does on a real page load: put the focus on the
 * new page's heading, so that the heading is announced and the reader can
 * carry on from the top of the new content.
 *
 * Three details matter.
 *
 * The first is that the pages are loaded on demand. When the route changes,
 * what is on the screen for a moment is a placeholder, not the page, and the
 * heading does not exist yet. So the focus waits for the heading to arrive
 * rather than being given to a placeholder — and if the page never arrives,
 * the main region takes the focus instead, which is still better than
 * leaving it on a link the reader has already followed.
 *
 * The second is that the first page is left alone. A reader who has just
 * opened the course has their focus wherever they had it — in the address
 * bar, on a link they were reading, nowhere in particular. Taking it on the
 * first render would be taking it from them.
 *
 * The third is the scroll. The browser does not scroll for a single-page
 * application either, so the page has to be put in the right place
 * explicitly: at the top, or at the fragment the address names, if it names
 * one. The focus is given without scrolling, so that the two do not fight
 * over where the reader ends up.
 */
export function usePageFocus() {
  const location = useLocation()
  /** The path of the page before this one. Null until the first render. */
  const previousPath = useRef<string | null>(null)

  useEffect(() => {
    const path = location.pathname
    const fragment = fragmentOf(location.hash)

    if (previousPath.current === null) {
      previousPath.current = path
      // The first page is the one the reader arrived at. The focus is left
      // where it was, but an address that names a section of it should still
      // put the reader in that section.
      if (fragment) scrollToFragment(fragment)
      return
    }
    if (previousPath.current === path) {
      // The same page, a different section of it.
      if (fragment) scrollToFragment(fragment)
      return
    }
    previousPath.current = path

    focusThePageThatArrived(fragment)
  }, [location.pathname, location.hash])
}

/**
 * Focus the heading of the page that has just arrived, and put the reader in
 * the right part of it.
 *
 * The wait is bounded. A page that never loads should not hold the focus for
 * ever, and the main region is a good enough place for it to rest.
 */
function focusThePageThatArrived(fragment: string) {
  const main = document.getElementById('main')
  if (!main) return

  let frames = 0
  const giveUpAfter = 120

  const tryFocus = () => {
    const heading = main.querySelector('h1')
    if (heading instanceof HTMLElement) {
      /*
       * A heading is not focusable by default, and making it so permanently
       * would put it in the reader's tab order. The attribute is set only at
       * the moment the focus arrives.
       */
      heading.setAttribute('tabindex', '-1')
      heading.focus({ preventScroll: true })
      placeTheReader(fragment)
      return
    }
    frames += 1
    if (frames >= giveUpAfter) {
      main.focus({ preventScroll: true })
      placeTheReader(fragment)
      return
    }
    requestAnimationFrame(tryFocus)
  }

  tryFocus()
}

/**
 * Puts the reader at the top of the page, or at the section the address
 * names.
 */
function placeTheReader(fragment: string) {
  if (fragment) {
    scrollToFragment(fragment)
    return
  }
  window.scrollTo({ top: 0, behavior: 'auto' })
}

function scrollToFragment(fragment: string) {
  const target = document.getElementById(fragment)
  if (!target) return
  target.scrollIntoView({ behavior: 'auto', block: 'start' })
}
