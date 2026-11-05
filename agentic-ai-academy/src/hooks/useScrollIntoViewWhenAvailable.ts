import { useEffect } from 'react'

/**
 * Scroll an element into view when it appears, and keep it where it was put
 * while the page settles.
 *
 * Two things make this harder than it looks.
 *
 * The pages are loaded on demand, so a deep link can name an element that
 * does not exist yet: the route is parsed, the effect runs, and the page's own
 * chunk is still on its way. A single attempt on the next frame therefore finds
 * nothing and the link quietly does nothing — which is the failure a student
 * sees on a slow connection. So the document is watched until the element
 * arrives, and `timeoutMs` is the backstop for a link that names nothing at all.
 *
 * And the page is not still when the element arrives. A formula above the
 * target finishes loading and grows, everything after it moves, and a scroll
 * that was correct a moment ago now points at the wrong place. So while the
 * layout settles the target's position is re-checked on every resize and
 * corrected.
 *
 * The correction follows the element, not the viewport: what is measured is the
 * target's offset within the document, which does not depend on how far the
 * page is scrolled. A student who scrolls away therefore changes nothing that
 * is watched, and is not dragged back. The watching also stops at the first
 * wheel or touch, so a student who starts reading is never interrupted.
 */
export function useScrollIntoViewWhenAvailable(
  id: string | null,
  options: {
    block?: 'start' | 'center' | 'end'
    highlight?: boolean
    /** How long to wait for the element to exist at all. */
    timeoutMs?: number
    /** How long to hold the target in place while the layout settles. */
    settleMs?: number
  } = {},
): void {
  const { block = 'start', highlight = true, timeoutMs = 5000, settleMs = 2500 } = options

  useEffect(() => {
    if (!id) return

    let cancelled = false
    let finder: MutationObserver | null = null
    let shifter: ResizeObserver | null = null
    let stopWatchingLayout = () => {}
    const timers: number[] = []

    /**
     * Where the element sits in the document.
     *
     * This is the viewport-relative position plus the scroll offset, so it is
     * the same number however far the page has been scrolled — which is what
     * makes it possible to tell a layout shift from a student scrolling away.
     */
    const offsetInDocument = (element: Element) => element.getBoundingClientRect().top + window.scrollY

    const scrollTo = (target: Element, flash: boolean) => {
      target.scrollIntoView({ block })
      if (flash && highlight) {
        target.classList.add('section-flash')
        timers.push(window.setTimeout(() => target.classList.remove('section-flash'), 2000))
      }
    }

    /** Hold the target in place while the page finishes laying itself out. */
    const watchTheLayout = (target: Element) => {
      let anchor = offsetInDocument(target)

      stopWatchingLayout = () => {
        shifter?.disconnect()
        shifter = null
        window.removeEventListener('wheel', stopWatchingLayout)
        window.removeEventListener('touchstart', stopWatchingLayout)
      }

      if (typeof ResizeObserver !== 'undefined') {
        shifter = new ResizeObserver(() => {
          if (cancelled) return
          const position = offsetInDocument(target)
          // A move of a pixel or less is rounding in the measurement, not the
          // layout shifting under the target.
          if (Math.abs(position - anchor) <= 1) return
          anchor = position
          scrollTo(target, false)
        })
        shifter.observe(document.body)
      }

      window.addEventListener('wheel', stopWatchingLayout, { passive: true })
      window.addEventListener('touchstart', stopWatchingLayout, { passive: true })
      timers.push(window.setTimeout(stopWatchingLayout, settleMs))
    }

    const onArrival = (target: Element) => {
      finder?.disconnect()
      finder = null
      scrollTo(target, true)
      watchTheLayout(target)
    }

    const existing = document.getElementById(id)
    if (existing) {
      onArrival(existing)
    } else if (typeof MutationObserver !== 'undefined') {
      finder = new MutationObserver(() => {
        const target = document.getElementById(id)
        if (target) onArrival(target)
      })
      finder.observe(document.body, { childList: true, subtree: true })
      timers.push(
        window.setTimeout(() => {
          finder?.disconnect()
          finder = null
        }, timeoutMs),
      )
    }

    return () => {
      cancelled = true
      finder?.disconnect()
      stopWatchingLayout()
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [id, block, highlight, timeoutMs, settleMs])
}
