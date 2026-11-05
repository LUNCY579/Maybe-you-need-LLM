import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EXPERIMENTS } from '../src/content/experiments';

/**
 * The reproducibility recipes and the presets they describe.
 *
 * `docs/REPRODUCIBILITY.md` states, for each preset, the settings that produce
 * the result it claims. If the document and the application disagree, a
 * reader following the recipe gets a different experiment from the one the
 * gallery offers, and neither of them can be checked against the other.
 *
 * The document is therefore parsed and compared with the presets.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** the names the document uses, and the fields they mean */
const KEY_ALIASES: Record<string, string> = {
  activation: 'activation',
  'C_W': 'Cw',
  'C_b': 'Cb',
  depth: 'depth',
  width: 'width',
  'input samples': 'samples',
  inputs: 'samples',
  samples: 'samples',
  networks: 'seeds',
  'networks per point': 'seeds',
  'learning rate': 'learningRate',
  steps: 'steps',
  hidden: 'hidden',
  'hidden units': 'hidden',
  slice: 'sliceKind',
  dataset: 'dataset',
  'gradient steps': 'steps',
};

function recipeFor(markdown: string, id: string): Map<string, string> | null {
  const heading = new RegExp(`^### \\d+\\. \`${id}\`[\\s\\S]*?$`, 'm');
  const at = markdown.search(heading);
  if (at < 0) return null;
  const section = markdown.slice(at, markdown.indexOf('\n### ', at + 1) < 0 ? markdown.length : markdown.indexOf('\n### ', at + 1));
  const block = /```\n([\s\S]*?)```/.exec(section);
  if (!block) return null;
  const out = new Map<string, string>();
  for (const m of block[1].matchAll(/([A-Za-z][A-Za-z _]*?)\s*=\s*([^\s]+)/g)) {
    const key = KEY_ALIASES[m[1].trim()];
    if (key) out.set(key, m[2]);
  }
  return out;
}

describe('the reproducibility recipes', () => {
  const markdown = readFileSync(join(ROOT, 'docs/REPRODUCIBILITY.md'), 'utf8');

  it('has a recipe for every preset', () => {
    for (const preset of EXPERIMENTS) {
      expect(recipeFor(markdown, preset.id), `no recipe for the preset "${preset.id}"`).not.toBeNull();
    }
  });

  it('states the settings the application actually uses', () => {
    for (const preset of EXPERIMENTS) {
      const recipe = recipeFor(markdown, preset.id)!;
      for (const [field, value] of Object.entries(preset.settings)) {
        const stated = recipe.get(field);
        if (stated === undefined) continue;
        if (typeof value === 'number') {
          expect(
            Number(stated),
            `the recipe for "${preset.id}" says ${field} = ${stated}, the preset uses ${value}`,
          ).toBeCloseTo(value, 6);
        } else {
          expect(stated, `the recipe for "${preset.id}" says ${field} = ${stated}, the preset uses ${value}`).toBe(value);
        }
      }
    }
  });

  it('states every setting the preset uses', () => {
    for (const preset of EXPERIMENTS) {
      const recipe = recipeFor(markdown, preset.id)!;
      for (const field of Object.keys(preset.settings)) {
        // a sweep grid is the laboratory's own, not the preset's
        if (field === 'depths' || field === 'widths') continue;
        expect(recipe.has(field), `the recipe for "${preset.id}" does not state ${field}`).toBe(true);
      }
    }
  });
});
