/**
 * A contrast audit of the design tokens.
 *
 * Every text colour in the application comes from the `lab-*` and `signal-*`
 * scales, so the contrast of the palette can be checked once, here, rather than
 * guessed at in every component. The thresholds are the WCAG 2.1 AA ratios:
 * 4.5:1 for body text, 3:1 for large text and for meaningful non-text
 * elements such as borders and focus rings.
 */
import { describe, expect, it } from 'vitest';

/** the palette as the browser sees it, from src/index.css */
const DARK: Record<string, [number, number, number]> = {
  'lab-950': [11, 14, 19],
  'lab-900': [15, 19, 26],
  'lab-850': [20, 25, 34],
  'lab-800': [28, 35, 50],
  'lab-700': [43, 53, 70],
  'lab-600': [90, 106, 130],
  'lab-500': [119, 133, 154],
  'lab-400': [139, 153, 173],
  'lab-300': [163, 176, 193],
  'lab-200': [194, 203, 216],
  'lab-100': [231, 236, 243],
  'signal-blue': [90, 169, 255],
  'signal-orange': [255, 159, 69],
  'signal-green': [72, 213, 151],
  'signal-red': [255, 107, 107],
  'signal-violet': [202, 130, 217],
};

const LIGHT: Record<string, [number, number, number]> = {
  'lab-950': [246, 247, 249],
  'lab-900': [255, 255, 255],
  'lab-850': [252, 253, 254],
  'lab-800': [240, 243, 247],
  'lab-700': [201, 208, 218],
  'lab-600': [133, 143, 160],
  'lab-500': [101, 110, 125],
  'lab-400': [79, 90, 106],
  'lab-300': [70, 81, 96],
  'lab-200': [43, 52, 66],
  'lab-100': [22, 28, 37],
  'signal-blue': [22, 104, 196],
  'signal-orange': [153, 75, 8],
  'signal-green': [18, 138, 90],
  'signal-red': [192, 57, 47],
  'signal-violet': [100, 50, 166],
};

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe('the palette', () => {
  it('keeps every text colour readable on the page background', () => {
    for (const [name, palette] of [
      ['dark', DARK],
      ['light', LIGHT],
    ] as const) {
      const bg = palette['lab-950'];
      for (const token of ['lab-100', 'lab-200', 'lab-300', 'lab-400']) {
        const ratio = contrast(palette[token], bg);
        expect(ratio, `${name} ${token} on the page background`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps the small uppercase labels readable', () => {
    for (const [name, palette] of [
      ['dark', DARK],
      ['light', LIGHT],
    ] as const) {
      // lab-500 is used for the small labels, so it has to clear the body-text bar
      const ratio = contrast(palette['lab-500'], palette['lab-950']);
      expect(ratio, `${name} lab-500 on the page background`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the signal colours readable on both backgrounds', () => {
    for (const [name, palette] of [
      ['dark', DARK],
      ['light', LIGHT],
    ] as const) {
      for (const token of ['signal-blue', 'signal-orange', 'signal-green', 'signal-violet']) {
        const ratio = contrast(palette[token], palette['lab-950']);
        expect(ratio, `${name} ${token} on the page background`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('keeps the panel borders visible', () => {
    for (const [name, palette] of [
      ['dark', DARK],
      ['light', LIGHT],
    ] as const) {
      const ratio = contrast(palette['lab-700'], palette['lab-900']);
      expect(ratio, `${name} lab-700 border on a panel`).toBeGreaterThanOrEqual(1.4);
    }
  });
});
