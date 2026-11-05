/**
 * The design tokens.
 *
 * Every colour in the application comes from a CSS custom property, and every
 * colour here is the JavaScript mirror of one of those properties. That means a
 * theme switch is a single attribute change on the document element, and the
 * charts — which cannot read CSS variables — are re-rendered with the matching
 * JavaScript palette.
 */

export type ThemeName = 'dark' | 'light';

export interface Palette {
  bg: string;
  panel: string;
  grid: string;
  axis: string;
  text: string;
  muted: string;
  blue: string;
  orange: string;
  green: string;
  red: string;
  violet: string;
  yellow: string;
}

const DARK: Palette = {
  bg: '#0b0e13',
  panel: '#0f131a',
  grid: '#1c2332',
  axis: '#5a6a82',
  text: '#c2cbd8',
  muted: '#8b99ad',
  blue: '#5aa9ff',
  orange: '#ff9f45',
  green: '#48d597',
  red: '#ff6b6b',
  violet: '#ca82d9',
  yellow: '#ffd166',
};

const LIGHT: Palette = {
  bg: '#f6f7f9',
  panel: '#ffffff',
  grid: '#f0f3f7',
  axis: '#858fa0',
  text: '#2b3442',
  muted: '#4f5a6a',
  blue: '#1668c4',
  orange: '#994b08',
  green: '#128a5a',
  red: '#c0392f',
  violet: '#6432a6',
  yellow: '#b3801a',
};

export const PALETTES: Record<ThemeName, Palette> = { dark: DARK, light: LIGHT };

/** The dark palette, kept as the module default so existing imports keep working. */
export const COLORS = DARK;

export function paletteFor(theme: ThemeName): Palette {
  return PALETTES[theme] ?? DARK;
}

export const SERIES = [DARK.blue, DARK.orange, DARK.green, DARK.violet, DARK.red, DARK.yellow];

export function seriesFor(theme: ThemeName): string[] {
  const p = paletteFor(theme);
  return [p.blue, p.orange, p.green, p.violet, p.red, p.yellow];
}

const AXIS = {
  gridcolor: DARK.grid,
  zerolinecolor: DARK.axis,
  linecolor: DARK.axis,
  tickfont: { size: 11, color: DARK.muted },
  title: { font: { size: 12, color: DARK.muted }, standoff: 8 },
  // Log axes emit a thicket of minor tick labels on a narrow panel; let Plotly
  // grow the margin instead of letting the numbers collide.
  automargin: true,
  nticks: 6,
};

/**
 * Common Plotly layout: dark, legible, no chartjunk.
 *
 * Axis overrides are merged *into* the themed axis rather than replacing it — a
 * caller that only wants to set `title` or `type` must not silently lose the dark
 * grid colours and end up with the library's light default.
 */
export function plotLayout(
  overrides: Record<string, unknown> = {},
  theme: ThemeName = 'dark',
): Record<string, unknown> {
  const p = paletteFor(theme);
  const { xaxis, yaxis, legend, ...rest } = overrides as {
    xaxis?: Record<string, unknown>;
    yaxis?: Record<string, unknown>;
    legend?: Record<string, unknown>;
  } & Record<string, unknown>;
  const axis = {
    ...AXIS,
    gridcolor: p.grid,
    zerolinecolor: p.axis,
    linecolor: p.axis,
    tickfont: { size: 11, color: p.muted },
    title: { font: { size: 12, color: p.muted }, standoff: 8 },
  };
  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: p.text, family: 'Inter, system-ui, sans-serif', size: 12 },
    margin: { l: 56, r: 18, t: 30, b: 52 },
    // Legend sits above the plot area: below it, Plotly draws the legend on top of
    // the x-axis title on these narrow panels.
    legend: { orientation: 'h', y: 1.03, yanchor: 'bottom', x: 0, font: { size: 11, color: p.text }, ...legend },
    colorway: seriesFor(theme),
    hovermode: 'closest',
    ...rest,
    xaxis: logTicks({ ...axis, ...xaxis }),
    yaxis: logTicks({ ...axis, ...yaxis }),
  };
}

/**
 * Plotly labels log minor ticks by mantissa alone (2, 5), which reads as though the
 * axis had repeated values. Restrict log axes to decade ticks unless the caller has
 * asked for something else.
 */
function logTicks(axis: Record<string, unknown>): Record<string, unknown> {
  if (axis.type !== 'log' || axis.dtick !== undefined) return axis;
  return { ...axis, dtick: 1, tickformat: '~g' };
}

export const PLOT_CONFIG = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d', 'toggleSpikelines'] as never,
} as const;

/** Format a number with a sensible number of significant digits for reading off a screen. */
export function fmt(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return v.toExponential(2);
  const d = Math.max(0, Math.min(6, digits - Math.floor(Math.log10(a)) - 1));
  return v.toFixed(d);
}

export function fmtFixed(v: number, digits = 3): string {
  return Number.isFinite(v) ? v.toFixed(digits) : '—';
}

export function fmtPercent(v: number, digits = 1): string {
  return Number.isFinite(v) ? `${(100 * v).toFixed(digits)}%` : '—';
}

/** Log-spaced samples, used for depth/width sweeps. */
export function logspace(from: number, to: number, count: number): number[] {
  if (count < 2) throw new Error('count must be at least 2');
  const l0 = Math.log(from);
  const l1 = Math.log(to);
  return Array.from({ length: count }, (_, i) => Math.exp(l0 + ((l1 - l0) * i) / (count - 1)));
}

export function linspace(from: number, to: number, count: number): number[] {
  if (count < 2) throw new Error('count must be at least 2');
  return Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));
}
