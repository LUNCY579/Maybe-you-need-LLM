import '@testing-library/jest-dom/vitest'

// jsdom does not implement matchMedia, which the theme provider probes.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

// React Flow relies on ResizeObserver, absent in jsdom.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub
}

/*
  The lesson outline uses an IntersectionObserver to track the section in
  view. jsdom does not implement one, so a stub is installed that reports
  every observed element as intersecting — enough for the component to mount
  and for the "first section is active" default to hold.
*/
if (!('IntersectionObserver' in globalThis)) {
  class IntersectionObserverStub {
    readonly root = null
    readonly rootMargin = ''
    readonly scrollMargin = ''
    readonly thresholds: ReadonlyArray<number> = []
    private readonly callback: IntersectionObserverCallback
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback
    }
    observe(target: Element): void {
      const rect = target.getBoundingClientRect()
      this.callback(
        [
          {
            isIntersecting: true,
            target,
            intersectionRatio: 1,
            time: 0,
            boundingClientRect: rect,
            intersectionRect: rect,
            rootBounds: null,
          } as IntersectionObserverEntry,
        ],
        this as unknown as IntersectionObserver,
      )
    }
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IntersectionObserverStub
}

// jsdom does not implement `scrollTo`: the property exists but calling it
// raises "Not implemented". The lesson reader scrolls to the top on
// navigation, so it is always replaced with a no-op.
window.scrollTo = (() => {}) as unknown as typeof window.scrollTo

/**
 * Give elements a non-zero size.
 *
 * jsdom performs no layout, so every element measures 0×0. Recharts'
 * `ResponsiveContainer` therefore logs a warning on every render. The charts
 * are not what these tests are asserting on, and in a real browser the
 * container does have a size — so the stub below removes the noise without
 * weakening any assertion.
 */
const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 360

Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get() {
    return DEFAULT_WIDTH
  },
})

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get() {
    return DEFAULT_HEIGHT
  },
})

// jsdom reports a zero rectangle for every element, so this replaces the
// method outright: the conditional it used to sit behind (`|| true`) made the
// condition always true, and jsdom always defines the method anyway.
Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    top: 0,
    left: 0,
    right: DEFAULT_WIDTH,
    bottom: DEFAULT_HEIGHT,
    toJSON: () => ({}),
  } as DOMRect
}
