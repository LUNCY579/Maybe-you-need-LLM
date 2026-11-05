import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
import { PALETTES, paletteFor } from '../src/lib/theme';

/**
 * The two copies of the palette.
 *
 * The panels read their colours from CSS custom properties; the charts cannot,
 * so they use a JavaScript mirror. Those two must agree, or the numbers and the
 * panels around them will be in different colours. This test parses the CSS and
 * compares it with the mirror, so a change to one that is not made to the other
 * fails here rather than on screen.
 */

const CSS_PATH = join(ROOT, 'src/index.css');

function cssVariables(): Record<string, Record<string, string>> {
  const css = readFileSync(CSS_PATH, 'utf8');
  // The print stylesheet redefines the tokens for paper. The mirror describes
  // the screen, so the paper block is cut off before the themes are read.
  const printStart = css.indexOf('@media print');
  const screen = printStart === -1 ? css : css.slice(0, printStart);
  const dark = screen.slice(screen.indexOf(":root,"), screen.indexOf("[data-theme='light']"));
  const light = screen.slice(screen.indexOf("[data-theme='light']"));
  const parse = (block: string) => {
    const out: Record<string, string> = {};
    for (const m of block.matchAll(/--([a-z0-9-]+):\s*([0-9]+)\s+([0-9]+)\s+([0-9]+)\s*;/g)) {
      out[`--${m[1]}`] = `${m[2]} ${m[3]} ${m[4]}`;
    }
    return out;
  };
  return { dark: parse(dark), light: parse(light) };
}

/** The tokens the print stylesheet sets for paper. */
function printVariables(): Record<string, string> {
  const css = readFileSync(CSS_PATH, 'utf8');
  const printStart = css.indexOf('@media print');
  if (printStart === -1) return {};
  const block = css.slice(printStart);
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*([0-9]+)\s+([0-9]+)\s+([0-9]+)\s*;/g)) {
    out[`--${m[1]}`] = `${m[2]} ${m[3]} ${m[4]}`;
  }
  return out;
}

function toHex(rgb: string): string {
  const [r, g, b] = rgb.split(/\s+/).map(Number);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

describe('the palette', () => {
  const vars = cssVariables();

  it('defines the same tokens in both themes', () => {
    const dark = Object.keys(vars.dark).sort();
    const light = Object.keys(vars.light).sort();
    expect(light).toEqual(dark);
    expect(dark.length).toBeGreaterThan(10);
  });

  it('keeps the JavaScript mirror in step with the CSS', () => {
    const map: Array<[keyof ReturnType<typeof paletteFor>, string]> = [
      ['bg', '--lab-950'],
      ['panel', '--lab-900'],
      ['grid', '--lab-800'],
      ['axis', '--lab-600'],
      ['muted', '--lab-400'],
    ];
    for (const theme of ['dark', 'light'] as const) {
      const palette = paletteFor(theme);
      for (const [field, token] of map) {
        const fromCss = toHex(vars[theme][token]);
        expect(palette[field].toLowerCase(), `${theme} ${field} vs ${token}`).toBe(fromCss);
      }
    }
  });

  it('keeps the signal colours in step with the CSS', () => {
    const map: Array<[keyof ReturnType<typeof paletteFor>, string]> = [
      ['blue', '--signal-blue'],
      ['orange', '--signal-orange'],
      ['green', '--signal-green'],
      ['red', '--signal-red'],
      ['violet', '--signal-violet'],
    ];
    for (const theme of ['dark', 'light'] as const) {
      const palette = paletteFor(theme);
      for (const [field, token] of map) {
        const fromCss = toHex(vars[theme][token]);
        expect(palette[field].toLowerCase(), `${theme} ${field} vs ${token}`).toBe(fromCss);
      }
    }
  });

  it('exposes both themes', () => {
    expect(Object.keys(PALETTES).sort()).toEqual(['dark', 'light']);
    expect(PALETTES.dark.bg).not.toBe(PALETTES.light.bg);
  });

  it('re-colours every token for paper, so nothing prints dark on white', () => {
    const paper = printVariables();
    const screen = vars.dark;
    // every token the screen defines must have a paper value as well
    for (const token of Object.keys(screen)) {
      expect(paper[token], `${token} has no paper value`).toBeDefined();
    }
    // and the paper text must be darker than the paper background
    const lum = (rgb: string) => {
      const [r, g, b] = rgb.split(/\s+/).map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    expect(lum(paper['--lab-100'])).toBeLessThan(lum(paper['--lab-950']));
    expect(lum(paper['--lab-300'])).toBeLessThan(lum(paper['--lab-950']));
  });
});
