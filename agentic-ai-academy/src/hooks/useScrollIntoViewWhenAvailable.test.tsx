import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollIntoViewWhenAvailable } from './useScrollIntoViewWhenAvailable'

/*
  This hook is a set of claims about behaviour, so it is tested as behaviour:

  1. a deep link to an element that has not arrived yet still scrolls, because
     the lesson chunks are loaded on demand;
  2. a scroll is corrected when the layout above the target moves, because a
     formula that finishes loading pushes the target down;
  3. a scroll is *not* corrected when the student scrolls away, because being
     dragged back is the failure that makes a page untrustworthy;
  4. the arrival highlight fires on arrival only, not on a correction.

  jsdom performs no layout and has no scrolling, so the model below supplies the
  single relation the hook turns on: an element's position in the document is
  its position in the viewport plus the scroll offset. Growing the document
  moves both halves of that sum; scrolling the page moves only one.
*/

const TARGET_ID = 'section-memory'

/** The state of the pretend page. */
const page = {
  /** Where the target sits within the document. Content growing above it moves this. */
  documentTop: 900,
  /** How far the page is scrolled. */
  scrollY: 0,
  /** How many times the hook has asked for a scroll. */
  scrolls: 0,
}

const layoutCallbacks = new Set<() => void>()

class FakeResizeObserver {
  private readonly callback: () => void

  constructor(callback: () => void) {
    this.callback = callback
  }

  observe(): void {
    layoutCallbacks.add(this.callback)
  }

  unobserve(): void {}

  disconnect(): void {
    layoutCallbacks.delete(this.callback)
  }
}

/** The content above the target finished loading and grew. */
function growTheDocument(by: number) {
  page.documentTop += by
}

/** Every watcher of the layout is told, as a browser would after a reflow. */
function flushTheLayout() {
  act(() => {
    ;[...layoutCallbacks].forEach((callback) => callback())
  })
}

/** The student scrolls: the viewport position changes, the document position does not. */
function scrollAwayTo(to: number) {
  act(() => {
    page.scrollY = to
  })
}

function targetElement(): HTMLElement {
  const already = document.getElementById(TARGET_ID)
  if (already) return already
  const element = document.createElement('section')
  element.id = TARGET_ID
  element.getBoundingClientRect = () => {
    const top = page.documentTop - page.scrollY
    return { top, bottom: top + 200, left: 0, right: 600, width: 600, height: 200, x: 0, y: top, toJSON: () => ({}) } as DOMRect
  }
  document.body.append(element)
  return element
}

const highlighted = () => document.getElementById(TARGET_ID)?.classList.contains('section-flash') ?? false

beforeEach(() => {
  page.documentTop = 900
  page.scrollY = 0
  page.scrolls = 0
  layoutCallbacks.clear()

  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => page.scrollY })
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
    page.scrolls += 1
    // Putting the top of the element at the top of the viewport is what block: 'start' does.
    page.scrollY = page.documentTop
  }
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('a deep link to an element that is already on the page', () => {
  it('scrolls to it once', () => {
    targetElement()
    const { unmount } = renderHook(() => useScrollIntoViewWhenAvailable(TARGET_ID))

    expect(page.scrolls).toBe(1)
    expect(page.scrollY).toBe(900)
    unmount()
  })

  it('highlights it', () => {
    targetElement()
    const { unmount } = renderHook(() => useScrollIntoViewWhenAvailable(TARGET_ID))

    expect(highlighted()).toBe(true)
    unmount()
  })

  it('does nothing when no element is named', () => {
    targetElement()
    const { unmount } = renderHook(() => useScrollIntoViewWhenAvailable(null))

    expect(page.scrolls).toBe(0)
    unmount()
  })
})

describe('a deep link to an element that has not arrived yet', () => {
  it('waits for it and then scrolls and highlights', async () => {
    const { unmount } = renderHook(() => useScrollIntoViewWhenAvailable(TARGET_ID))
    expect(page.scrolls).toBe(0)

    // The lesson chunk lands. A MutationObserver callback is a microtask, so
    // flushing the microtask queue is all the waiting it needs.
    await act(async () => {
      targetElement()
    })

    expect(page.scrolls).toBe(1)
    expect(highlighted()).toBe(true)
    unmount()
  })

  it('stops waiting at the backstop, so a link that names nothing never scrolls late', async () => {
    const { unmount } = renderHook(() => useScrollIntoViewWhenAvailable(TARGET_ID, { timeoutMs: 5000 }))

    act(() => {
      vi.advanceTimersByTime(6000)
    })
    await act(async () => {
      targetElement()
    })

    expect(page.scrolls).toBe(0)
    unmount()
  })

  it('watches the layout for an element that arrived late as well', async () => {
    const { unmount } = renderHook(() => useScrollIntoViewWhenAvailable(TARGET_ID))

    await act(async () => {
      targetElement()
    })
    expect(page.scrolls).toBe(1)
    expect(layoutCallbacks.size).toBe(1)

    growTheDocument(300)
    flushTheLayout()

    expect(page.scrolls).toBe(2)
    unmount()
  })
})

describe('the layout moving under a scroll that was already made', () => {
  it('puts the target back where it was', () => {
    targetElement()
    const { unmount } = renderHook(() => useScrollIntoViewWhenAvailable(TARGET_ID))
    expect(page.scrollY).toBe(900)

    // A formula above the target finishes loading and grows by 300 pixels.
    growTheDocument(300)
    flushTheLayout()

    expect(page.scrolls).toBe(2)
    expect(page.scrollY).toBe(1200)
    unmount()
  })

  it('ignores a shift the size of rounding', () => {
    targetElement()
    const { unmount } = renderHook(() => useScrollIntoViewWhenAvailable(TARGET_ID))

    growTheDocument(1)
    flushTheLayout()

    expect(page.scrolls).toBe(1)
    unmount()
  })

  it('does not re-highlight on a correction', () => {
    targetElement()
    const { unmount } = renderHook(() => useScrollIntoViewWhenAvailable(TARGET_ID))

    // The arrival highlight expires, then the layout moves.
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    expect(highlighted()).toBe(false)

    growTheDocument(300)
    flushTheLayout()

    expect(page.scrolls).toBe(2)
    expect(highlighted()).toBe(false)
    unmount()
  })
})

describe('a student who scrolls away', () => {
  it('is not dragged back while the page settles', () => {
    targetElement()
    const { unmount } = renderHook(() => useScrollIntoViewWhenAvailable(TARGET_ID))
    expect(page.scrolls).toBe(1)

    // They scroll up to read something earlier on the page.
    scrollAwayTo(200)
    flushTheLayout()

    expect(page.scrolls).toBe(1)
    expect(page.scrollY).toBe(200)
    unmount()
  })

  it('is left alone after the first wheel, even if the layout then moves', () => {
    targetElement()
    const { unmount } = renderHook(() => useScrollIntoViewWhenAvailable(TARGET_ID))

    act(() => {
      window.dispatchEvent(new Event('wheel'))
    })
    growTheDocument(300)
    flushTheLayout()

    expect(page.scrolls).toBe(1)
    expect(layoutCallbacks.size).toBe(0)
    unmount()
  })

  it('is left alone once the settling window has closed', () => {
    targetElement()
    const { unmount } = renderHook(() => useScrollIntoViewWhenAvailable(TARGET_ID, { settleMs: 1000 }))

    act(() => {
      vi.advanceTimersByTime(1200)
    })
    growTheDocument(300)
    flushTheLayout()

    expect(page.scrolls).toBe(1)
    unmount()
  })
})

describe('a component that goes away mid-settle', () => {
  it('leaves no watcher behind', () => {
    targetElement()
    const { unmount } = renderHook(() => useScrollIntoViewWhenAvailable(TARGET_ID))
    expect(layoutCallbacks.size).toBe(1)

    unmount()

    expect(layoutCallbacks.size).toBe(0)
    growTheDocument(300)
    flushTheLayout()
    expect(page.scrolls).toBe(1)
  })
})
