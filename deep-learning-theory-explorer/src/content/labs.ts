/**
 * The laboratory registry.
 *
 * One list of what exists, used by the navigation rail, by the link checker,
 * and by the coverage audit in `scripts/check-lab-coverage.mjs`. Before this
 * file, the same seven screens were spelled out in four places — the rail, the
 * router, the gallery's route table, and the test that looks for dead links —
 * which is exactly how a laboratory ends up with a link and no screen, or a
 * screen and no way to reach it.
 *
 * `delivers` names the item in `references/manifest.json` that the screen is
 * the implementation of, verbatim: the audit compares the two strings, so a
 * laboratory can be checked off only by a screen that says what it answers.
 *
 * `id` is the screen's file name without `Lab`, because that is how the audit
 * joins a declaration to a screen. It is not always the route segment — the
 * routes were written first and are quoted in content and in shared links, so
 * `route` is its own field and `widthdepth` keeps its hyphen on screen.
 */

export interface LabDefinition {
  /** the screen's name without `Lab`: `landscape` is `LandscapeLab.tsx` */
  id: string
  /** the rail label and card title */
  name: string
  blurb: string
  /** the route the screen is served at */
  route: string
  /** the declared laboratory items of the source papers this screen computes */
  delivers: string[]
  /**
   * Whether the screen takes the shared setup. Every measurement laboratory
   * does; the drills laboratory grades a hand computation against the same
   * numerical core and so has no setup to share. The prose that says "shared by
   * all the laboratories" counts this field rather than the whole registry.
   */
  sharesSetup: boolean
}

export const LABS: readonly LabDefinition[] = [
  {
    id: 'physics',
    name: 'Physics lab',
    blurb: 'Build and train a network in the browser and watch every signal quantity move.',
    route: '/labs/physics',
    delivers: ['Physics lab'],
    sharesSetup: true,
  },
  {
    id: 'initialization',
    name: 'A · Initialization',
    blurb: 'Signal propagation, the fixed points of the kernel recursion, and criticality.',
    route: '/labs/initialization',
    delivers: ['Initialisation and criticality'],
    sharesSetup: true,
  },
  {
    id: 'landscape',
    name: 'B · Optimization',
    blurb: 'Loss landscapes, the stability threshold, and what each optimizer does about it.',
    route: '/labs/landscape',
    delivers: ['Loss landscapes'],
    sharesSetup: true,
  },
  {
    id: 'widthdepth',
    name: 'C · Width & depth',
    blurb: 'The finite-width corrections: seed-to-seed variance against depth and against width.',
    route: '/labs/width-depth',
    delivers: ['Width and depth'],
    sharesSetup: true,
  },
  {
    id: 'ntk',
    name: 'D · Neural tangent kernel',
    blurb: 'Jacobians, the NTK as a Gram matrix, its width scaling, and defrosting under training.',
    route: '/labs/ntk',
    delivers: ['Neural tangent kernel'],
    sharesSetup: true,
  },
  {
    id: 'representation',
    name: 'E · Representation',
    blurb: 'What training does to the hidden features, and how the answer depends on width.',
    route: '/labs/representation',
    delivers: ['Representation learning'],
    sharesSetup: true,
  },
  {
    id: 'drills',
    name: 'F · Prerequisite drills',
    blurb: 'The eight tools the theory rests on, each graded against a live computation.',
    route: '/labs/drills',
    delivers: ['Prerequisite drills for the theory course'],
    sharesSetup: false,
  },
];

export const LAB_IDS: readonly string[] = LABS.map((l) => l.id);
/** The laboratories that read and write the shared setup. */
export const SETUP_LABS: readonly LabDefinition[] = LABS.filter((l) => l.sharesSetup);
export const LAB_ROUTES: readonly string[] = LABS.map((l) => l.route);

/** The laboratory served at this route, or undefined. */
export function labByRoute(route: string): LabDefinition | undefined {
  return LABS.find((l) => l.route === route);
}

export function labById(id: string): LabDefinition | undefined {
  return LABS.find((l) => l.id === id);
}
