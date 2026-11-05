/**
 * The minified Plotly distribution ships without type declarations. The app only
 * uses newPlot/react/purge, so a narrow declaration is enough and avoids pulling
 * the full @types/plotly.js surface into the build.
 */
declare module 'plotly.js' {
  export interface PlotlyLike {
    newPlot: (el: HTMLElement, data: unknown[], layout?: unknown, config?: unknown) => Promise<unknown>;
    react?: (el: HTMLElement, data: unknown[], layout?: unknown, config?: unknown) => Promise<unknown>;
    purge: (el: HTMLElement) => void;
    /** re-measure a plot against its container */
    Plots?: { resize: (el: HTMLElement) => void };
  }
  const Plotly: PlotlyLike;
  export default Plotly;
}
