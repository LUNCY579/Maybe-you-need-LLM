import { describe, expect, it } from 'vitest';
import { PALETTES, seriesFor } from '../src/lib/theme';

/**
 * The chart colours.
 *
 * A chart in this application draws two or three lines on one pair of axes, and
 * the reader has to be able to tell them apart — that is the whole point of a
 * legend. The lines are thin and the panel behind them is dark, so the colours
 * have to be visible against it, and they have to be far enough from each
 * other in colour space that they are not the same line to a reader with a
 * colour vision deficiency.
 *
 * The check is on the perceptual difference (CIE76 ΔE), not on the raw RGB
 * distance, and it is repeated with the colours as a deuteranope sees them:
 * about one man in twelve cannot separate a red from a green, and a pair of
 * lines that differ only in that way is one line to them.
 */

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const linear = (v: number): number => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const unlinear = (v: number): number => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** sRGB to CIE L*a*b* (D65). */
function toLab([r, g, b]: Rgb): Rgb {
  const [R, G, B] = [linear(r), linear(g), linear(b)];
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** The CIE76 colour difference. Below about 2.3 the two colours are the same to the eye. */
function deltaE(a: Rgb, b: Rgb): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Deuteranopia, the standard simulation.
 *
 * The red-green axis collapses — the L and M cones move towards each other —
 * and the blue-yellow axis survives. This is the confusion that matters: it
 * is the one that turns a red line and a green line into one line.
 */
function asDeuteranope([r, g, b]: Rgb): Rgb {
  const [R, G, B] = [linear(r), linear(g), linear(b)];
  // linear sRGB -> LMS (CIECAM02)
  const L = 0.31399022 * R + 0.63951294 * G + 0.04649755 * B;
  const S = 0.01775239 * R + 0.10944209 * G + 0.87256922 * B;
  // Brettel and Viénot, at full severity
  const Lp = L;
  const Mp = 0.494207 * L + 1.24827 * S;
  const Sp = -0.395913 * L;
  // LMS -> linear sRGB
  const rl = 3.454 * Lp - 2.6521 * Mp + 0.1952 * Sp;
  const gl = -0.0895 * Lp + 1.1497 * Mp - 0.0602 * Sp;
  const bl = -0.0056 * Lp + 0.2435 * Mp + 0.7621 * Sp;
  const to255 = (v: number) => Math.max(0, Math.min(255, Math.round(255 * unlinear(v))));
  return [to255(rl), to255(gl), to255(bl)];
}

/** clearly different to anyone */
const MIN_NORMAL = 16;
/** still clearly different to a deuteranope */
const MIN_DEFICIENT = 12;
/** a thin line has to be visible against the panel */
const MIN_CONTRAST = 3;

describe('the chart series', () => {
  for (const theme of ['dark', 'light'] as const) {
    const series = seriesFor(theme).map(hexToRgb);
    const panel = hexToRgb(PALETTES[theme].panel);

    it(`${theme}: every series colour is visible against the panel`, () => {
      for (const colour of series) {
        expect(contrast(colour, panel), `${colour} on ${PALETTES[theme].panel}`).toBeGreaterThanOrEqual(MIN_CONTRAST);
      }
    });

    it(`${theme}: no two series are the same line to a reader`, () => {
      for (let i = 0; i < series.length; i++) {
        for (let j = i + 1; j < series.length; j++) {
          const d = deltaE(series[i], series[j]);
          expect(d, `${series[i]} and ${series[j]} differ by ${d.toFixed(1)}`).toBeGreaterThanOrEqual(MIN_NORMAL);
        }
      }
    });

    it(`${theme}: no two series are the same line to a deuteranope`, () => {
      for (let i = 0; i < series.length; i++) {
        for (let j = i + 1; j < series.length; j++) {
          const a = asDeuteranope(series[i]);
          const b = asDeuteranope(series[j]);
          const d = deltaE(a, b);
          expect(d, `${series[i]} and ${series[j]} are one line to a deuteranope (ΔE ${d.toFixed(1)})`).toBeGreaterThanOrEqual(
            MIN_DEFICIENT,
          );
        }
      }
    });
  }
});
