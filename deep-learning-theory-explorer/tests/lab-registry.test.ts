import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LABS, LAB_IDS, LAB_ROUTES, SETUP_LABS, labById, labByRoute } from '../src/content/labs';
import { LAB_SCREENS } from '../src/pages/labs';
import { LESSONS } from '../src/content/lessons';

/**
 * The laboratory registry, checked against the rest of the repository.
 *
 * `src/content/labs.ts` is the list that the navigation rail, the router, the
 * link checker and the collection's coverage audit all read. It is therefore
 * the one file whose drift is invisible on screen: a laboratory can be
 * registered with no component, or mounted with no registration, and the
 * reader just finds a blank page or a screen nobody links to.
 *
 * The manifest side is the more interesting half. `references/manifest.json`
 * records the laboratory ideas each source says the material invites; the
 * audit reports an item as closed only when a screen declares it by the same
 * words. These checks make the two lists agree, so the audit can never be told
 * a story the repository does not back up.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, '..', 'references', 'manifest.json');

/** The declared laboratory items of this application, straight from the manifest. */
function declaredItems(): string[] {
  expect(existsSync(MANIFEST), `no manifest at ${MANIFEST}`).toBe(true);
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
    sources: Array<{ app?: string; labs?: string[] }>;
  };
  return manifest.sources.filter((s) => s.app === 'deep-learning-theory-explorer').flatMap((s) => s.labs ?? []);
}

describe('the laboratory registry', () => {
  it('has a unique id, name, route and blurb for every laboratory', () => {
    for (const id of LAB_IDS) expect(id, 'an empty id').toBeTruthy();
    expect(new Set(LAB_IDS).size).toBe(LAB_IDS.length);
    expect(new Set(LABS.map((l) => l.route)).size).toBe(LABS.length);
    expect(new Set(LABS.map((l) => l.name)).size).toBe(LABS.length);
    expect(new Set(LABS.map((l) => l.blurb)).size).toBe(LABS.length);
    for (const lab of LABS) {
      expect(lab.blurb.length, lab.id).toBeGreaterThan(20);
      expect(lab.route.startsWith('/labs/'), lab.route).toBe(true);
    }
  });

  it('mounts a screen for every entry and registers every screen', () => {
    const screensOnDisk = new Set(readdirSync(join(ROOT, 'src/pages/labs')).map((f) => f.toLowerCase()));
    expect(Object.keys(LAB_SCREENS).sort()).toEqual([...LAB_IDS].sort());
    for (const lab of LABS) {
      expect(typeof LAB_SCREENS[lab.id], `${lab.id} has no component`).toBe('function');
      // the file name is capitalised, the registry id is not
      expect(screensOnDisk.has(`${lab.id}lab.tsx`.toLowerCase()), `${lab.id}Lab.tsx is missing`).toBe(true);
    }
  });

  it('resolves through the lookup helpers it publishes', () => {
    for (const lab of LABS) {
      expect(labById(lab.id)).toBe(lab);
      expect(labByRoute(lab.route)).toBe(lab);
    }
    expect(labById('nope')).toBeUndefined();
    expect(labByRoute('/labs/nope')).toBeUndefined();
  });

  it('claims each declared item once, and claims nothing the manifest does not list', () => {
    const claimed = LABS.flatMap((l) => l.delivers);
    expect(new Set(claimed).size, 'a declared item claimed by two laboratories').toBe(claimed.length);
    for (const lab of LABS) expect(lab.delivers.length, lab.id).toBeGreaterThan(0);

    const declared = declaredItems();
    for (const item of claimed) expect(declared, `"${item}" is not a declared item`).toContain(item);
    for (const item of declared) expect(claimed, `"${item}" is declared but delivered by nothing`).toContain(item);
  });

  it('is the list the application shell actually renders', () => {
    const app = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');
    expect(app).toContain('LAB_SCREENS');
    expect(app).toContain('LABS.map');
    // no laboratory is left as a hand-written route the registry does not know about
    for (const route of LAB_ROUTES) expect(app.includes(`'${route}'`), `${route} hardcoded in the shell`).toBe(false);
  });

  it('records exactly the laboratories that mount the shared setup', () => {
    // the setup panel's own caption counts these entries, and the README says
    // every laboratory that measures shows it
    for (const lab of LABS) {
      const source = readFileSync(join(ROOT, 'src/pages/labs', `${lab.id}Lab.tsx`), 'utf8');
      const mounts = /SharedSetupPanel/.test(source);
      expect(mounts, `${lab.id}: the screen and the registry disagree about the setup`).toBe(lab.sharesSetup);
    }
    expect(SETUP_LABS).toEqual(LABS.filter((l) => l.sharesSetup));
    expect(SETUP_LABS.length).toBeGreaterThan(0);
  });

  it('gives every laboratory a lesson that reaches it', () => {
    const linked = LESSONS.flatMap((l) => [
      l.experiment?.route,
      ...(l.alsoExperiments ?? []).map((e) => e.route),
    ]).filter((r): r is string => Boolean(r));
    for (const lab of LABS) {
      expect(linked, `${lab.route} is named by no lesson`).toContain(lab.route);
    }
  });
});
