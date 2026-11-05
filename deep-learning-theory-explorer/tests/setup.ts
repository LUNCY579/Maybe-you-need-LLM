import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia, which some UI helpers probe.
if (typeof window !== 'undefined' && !window.matchMedia) {
  // @ts-expect-error test shim
  window.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

// Plotly is loaded lazily; the component degrades gracefully when it is absent.
