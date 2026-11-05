import { useEffect, useRef, useState } from 'react';
import { PLOT_CONFIG, plotLayout } from '../lib/theme';
import { useTheme } from '../lib/useTheme';

/**
 * Thin wrapper around Plotly, loaded lazily so the 3 MB plotting library does not
 * block first paint. Plotly is used for heatmaps, contours, 3D surfaces and
 * histograms; the component degrades to a message if the library cannot load.
 */
type PlotlyModule = { newPlot: (el: HTMLElement, data: unknown[], layout: unknown, config?: unknown) => Promise<unknown>; purge: (el: HTMLElement) => void; react?: (el: HTMLElement, data: unknown[], layout: unknown, config?: unknown) => Promise<unknown>; Plots?: { resize: (el: HTMLElement) => void } };

let plotlyPromise: Promise<PlotlyModule> | null = null;

function loadPlotly(): Promise<PlotlyModule> {
  if (!plotlyPromise) {
    // The small build: only the kinds of trace this application actually draws.
    plotlyPromise = import('../lib/plotly').then(
      (m) => (m as unknown as { default: PlotlyModule }).default ?? (m as unknown as PlotlyModule),
    );
  }
  return plotlyPromise;
}

export interface PlotProps {
  /** Plotly traces */
  data: unknown[];
  /** layout overrides merged over the theme */
  layout?: Record<string, unknown>;
  height?: number;
  className?: string;
  /** accessible description, also shown if Plotly fails to load */
  caption?: string;
}

export function Plot({ data, layout, height = 320, className = '', caption }: PlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const { theme } = useTheme();

  useEffect(() => {
    let alive = true;
    const el = ref.current;
    if (!el) return;
    loadPlotly()
      .then((Plotly) => {
        if (!alive || !el) return;
        // A single-series chart needs no legend; multi-series charts get room above the
        // plot for it (see plotLayout) instead of stealing space from the axis title.
        const legendSpace = data.length > 1 ? { margin: { t: 64 }, showlegend: true } : { showlegend: false };
        const merged = plotLayout({ height, ...legendSpace, ...layout }, theme);
        return Plotly.react ? Plotly.react(el, data, merged, PLOT_CONFIG) : Plotly.newPlot(el, data, merged, PLOT_CONFIG);
      })
      .then(() => {
        if (alive) setStatus('ready');
      })
      .catch((e: unknown) => {
        if (alive) {
          setStatus('error');
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      alive = false;
    };
  }, [data, layout, height, theme]);

  /*
   * A chart must match its container.
   *
   * Plotly's own responsive mode only listens for a window resize, but the
   * container changes width for plenty of other reasons: the print layout is
   * narrower than the screen, a panel expands, a font loads and reflows the
   * page. So the container is watched directly, and the chart is re-measured
   * whenever its width actually changes. Only width is watched, because a
   * resize that changes the height would ask the chart to re-measure itself
   * for ever.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last = el.getBoundingClientRect().width;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      const width = el.getBoundingClientRect().width;
      if (Math.abs(width - last) < 1) return;
      last = width;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        loadPlotly()
          .then((Plotly) => Plotly.Plots?.resize?.(el))
          .catch(() => {
            /* the chart is a view of the numbers; a failed resize is not fatal */
          });
      });
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div className={className}>
      <div ref={ref} style={{ height }} aria-label={caption ?? 'chart'} role="img" />
      {status === 'error' && (
        <p className="rounded border border-signal-red/40 bg-signal-red/10 p-3 text-[12px] text-signal-red">
          The plotting library could not be loaded ({error}). The numeric results on this page remain valid — the chart
          is a view of them.
        </p>
      )}
      {caption && <p className="mt-1 text-[11.5px] leading-snug text-lab-400">{caption}</p>}
    </div>
  );
}

/** convenience constructors so the labs stay readable */
export const line = (
  x: number[],
  y: number[],
  name: string,
  color: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  type: 'scatter',
  mode: 'lines',
  x,
  y,
  name,
  line: { color, width: 2 },
  ...extra,
});

export const markers = (
  x: number[],
  y: number[],
  name: string,
  color: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  type: 'scatter',
  mode: 'markers',
  x,
  y,
  name,
  marker: { color, size: 7, line: { width: 0 } },
  ...extra,
});

export const histogram = (
  values: number[],
  name: string,
  color: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  type: 'histogram',
  x: values,
  name,
  marker: { color, line: { color: '#0b0e13', width: 1 } },
  opacity: 0.85,
  ...extra,
});

export const heatmap = (
  z: number[][],
  x: number[] | string[],
  y: number[] | string[],
  colorscale: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  type: 'heatmap',
  z,
  x,
  y,
  colorscale,
  ...extra,
});

export const ERRORBAR = (x: number[], mean: number[], lower: number[], upper: number[], name: string, color: string) => ({
  type: 'scatter',
  mode: 'lines',
  x,
  y: mean,
  name,
  line: { color, width: 1.5 },
  error_y: { type: 'data', symmetric: false, array: upper, arrayminus: lower, color, thickness: 1, width: 3 },
});
