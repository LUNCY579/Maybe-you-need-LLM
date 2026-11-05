/**
 * The laboratory registry.
 *
 * One list of what exists, used by the laboratory page's navigation, by the route
 * that renders a screen, and by the test that refuses an orphan: a screen nobody
 * links to, a link to a screen that was deleted, and a declared item of the source
 * papers with no code behind it are all the same class of mistake, and this file is
 * where they become visible.
 *
 * `delivers` names the item in `references/manifest.json` that the screen is the
 * implementation of. The coverage audit reads the same strings, so a laboratory can
 * be checked off only by a screen that says what it answers.
 */

export interface LabDefinition {
  /** The route segment: `/labs/:labId`. */
  id: string
  /** The tab and card label. */
  name: string
  blurb: string
  /** The declared laboratory items this screen computes. */
  delivers: string[]
}

export const LABS: readonly LabDefinition[] = [
  {
    id: 'constitution',
    name: 'A · The constitution',
    blurb: 'A model that critiques itself, the critic that sees what it cannot, and the judge that scores it.',
    delivers: ['The critique-and-revise loop', 'Self-critique versus external critique'],
  },
  {
    id: 'alignment',
    name: 'B · The two rounds',
    blurb: 'What imitation reaches, what a preference signal moves, and what the compromise costs.',
    delivers: ['The two-round alignment procedure'],
  },
  {
    id: 'redteam',
    name: 'C · Red teaming',
    blurb: 'The failures you found, the ones you did not, and what a longer budget buys.',
    delivers: ['The red-teaming search loop', 'Discovery rate against a search budget'],
  },
  {
    id: 'sleeper',
    name: 'D · The cued behaviour',
    blurb: 'A classifier that is exact about every harm it was told about, and silent about the rest.',
    delivers: ['Conditional behaviour that a safety classifier misses'],
  },
  {
    id: 'preference',
    name: 'E · The consistent labeler',
    blurb: 'What a repeat-agreement number measures, and what a majority of looks hands to the reward model.',
    // This is the screen that computes the declared consistency item. The flip-rate
    // screen next door teaches the same paper's other result and delivers nothing of
    // the manifest, which is why its `delivers` is empty rather than missing.
    delivers: ['The human-feedback consistency preference and what it rewards'],
  },
  {
    id: 'sycophancy',
    name: 'F · Sycophancy',
    blurb: 'Changing the answer to agree with the person asking.',
    delivers: [],
  },
  {
    id: 'privacy',
    name: 'G · Privacy',
    blurb: 'What a model can be made to give back, and who can tell that it was trained on it.',
    delivers: ['A membership-inference attack against a toy model', 'Extraction accuracy against duplication rate'],
  },
]

/** Every registered id, in tab order. */
export const LAB_IDS: readonly string[] = LABS.map((lab) => lab.id)

/** The registry entry for an id, or nothing when the route asked for a screen that does not exist. */
export function labById(id: string | undefined): LabDefinition | undefined {
  return LABS.find((lab) => lab.id === id)
}
