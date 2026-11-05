import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LABS as REGISTRY } from '../src/content/labs';
import { PREREQUISITE_DRILLS, PREREQUISITE_TOOLS } from '../src/content/prerequisites';

/**
 * The claims the README makes, checked.
 *
 * The README lists sixteen properties the application holds itself to. Some
 * of them are checked by the numbers; the rest are statements about what is on
 * the screen, and those are checked here, so that a promise cannot quietly
 * stop being kept.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAB_DIR = join(ROOT, 'src/pages/labs');

const WORD_NUMBER = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];

function labSource(name: string): string {
  return readFileSync(join(LAB_DIR, name), 'utf8');
}

const LABS = readdirSync(LAB_DIR).filter((f) => f.endsWith('.tsx'));

describe('the claims the README makes', () => {
  it('the screens on disk are exactly the laboratories in the registry', () => {
    // one screen per registry entry, no orphans in either direction
    expect(LABS.length).toBe(REGISTRY.length);
    for (const lab of REGISTRY) {
      const file = `${lab.id}Lab.tsx`;
      expect(
        LABS.some((f) => f.toLowerCase() === file.toLowerCase()),
        `no screen for the registry entry "${lab.id}"`,
      ).toBe(true);
    }
  });

  it('the README announces exactly the laboratories the registry contains', () => {
    // the prose count and the route table are both promises a reader acts on,
    // and both were stale at least once
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    const listed = [...readme.matchAll(/^\| `\/#(\/labs\/[a-z-]+)` \|/gm)].map((m) => m[1]);
    expect(listed.sort(), 'the README route table is not the registry').toEqual(
      [...REGISTRY.map((lab) => lab.route)].sort(),
    );
    expect(listed.length).toBe(REGISTRY.length);
    expect(readme).toContain(`${WORD_NUMBER[REGISTRY.length]} laboratories`);
    for (const stale of ['five laboratories', 'six laboratories']) {
      expect(readme.toLowerCase(), `the README still says "${stale}"`).not.toContain(stale);
    }
  });

  it('the README counts of the drill tables match the tables themselves', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8').toLowerCase();
    expect(readme).toContain(`${WORD_NUMBER[PREREQUISITE_DRILLS.length]} graded checks`);
    expect(readme).toContain(`${WORD_NUMBER[PREREQUISITE_TOOLS.length]} mathematical tools`);
  });

  it('every laboratory carries a limitation callout', () => {
    for (const lab of LABS) {
      const source = labSource(lab);
      expect(source, `${lab} has no limitation callout`).toContain('tone="limitation"');
    }
  });

  it('every laboratory records the seed of the run it logs', () => {
    // a log without the seed cannot be repeated, and a repeated run is the
    // whole point of the log
    for (const lab of LABS) {
      const source = labSource(lab);
      if (!source.includes('recordRun(')) continue;
      expect(source, `${lab} records a run without the seed`).toMatch(/summary: `[^`]*seed \$\{/);
    }
  });

  it('every laboratory offers its numbers as a CSV', () => {
    for (const lab of LABS) {
      const source = labSource(lab);
      expect(source, `${lab} has no CSV download`).toContain('DownloadCsv');
    }
  });

  it('every laboratory names the lessons it demonstrates', () => {
    for (const lab of LABS) {
      const source = labSource(lab);
      expect(source, `${lab} does not name its lessons`).toContain('LabLessons');
    }
  });

  it('no laboratory computes on the main thread inside a render', () => {
    // a heavy computation in a useMemo freezes the page; the measurements
    // belong in the worker
    for (const lab of LABS) {
      const source = labSource(lab);
      expect(source, `${lab} computes inside a useMemo`).not.toMatch(/useMemo\(\s*\(\)\s*=>\s*\n?\s*(run|createMlp|backprop)/);
    }
  });
});
