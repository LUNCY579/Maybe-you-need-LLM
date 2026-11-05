import '@testing-library/jest-dom/vitest'

/**
 * jsdom does not implement `matchMedia`, and the theme bootstrap reads it.
 * A minimal stub is enough for the component tests.
 */
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
