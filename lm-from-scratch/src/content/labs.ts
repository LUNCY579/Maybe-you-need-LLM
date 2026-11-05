/**
 * The laboratory registry.
 *
 * One list of what exists, used by the laboratory page's navigation, by the
 * route that renders a screen, and by the test that refuses an orphan. A
 * screen nobody links to, a link to a screen that was deleted, and a declared
 * item of the source papers with no code behind it are the same class of
 * mistake, and this file is where they become visible.
 *
 * `delivers` names the item in `references/manifest.json` that the screen is
 * the implementation of. The coverage audit reads the same strings, so a
 * laboratory can be checked off only by a screen that says what it answers.
 */

export interface LabDefinition {
  /** The route segment: `/labs/:id`. */
  id: string
  name: string
  blurb: string
  /** The declared laboratory items this screen computes. */
  delivers: string[]
}

export const LABS: readonly LabDefinition[] = [
  {
    id: 'tokenizer',
    name: 'A · The tokeniser',
    blurb: 'A byte-pair encoding trained here, and GPT-2’s own vocabulary on a real book.',
    delivers: ['Using a real tokeniser and a real dataset'],
  },
  {
    id: 'architecture',
    name: 'B · The architecture',
    blurb: 'The parameter budget.',
    delivers: [],
  },
  {
    id: 'accounting',
    name: 'C · Resource accounting',
    blurb: 'The FLOPs, the memory, the hierarchy, the roofline.',
    delivers: ['FLOPs and arithmetic intensity', 'Memory hierarchy arithmetic'],
  },
  {
    id: 'data',
    name: 'D · The data pipeline',
    blurb: 'What the filtering costs.',
    delivers: ['Data filtering and deduplication at corpus scale', 'Data'],
  },
  {
    id: 'training',
    name: 'E · The training loop',
    blurb: 'A real run, read line by line, evaluated and sampled from.',
    delivers: [
      'A real training loop with a loss curve',
      'Reading a real training loop',
      'Evaluation harnesses',
      'Running a small real model',
      'Basics',
      'The tokeniser, the attention head, the optimiser, each built from nothing',
    ],
  },
  {
    id: 'scaling',
    name: 'F · The scaling frontier',
    blurb: 'The IsoFLOP picture.',
    delivers: ['Scaling'],
  },
  {
    id: 'systems',
    name: 'G · Systems',
    blurb: 'What the hierarchy and the interconnect cost.',
    delivers: ['Systems'],
  },
  {
    id: 'postTraining',
    name: 'H · Alignment and reasoning',
    blurb: 'SFT and RL against a verifier, computed exactly.',
    delivers: ['Alignment and reasoning'],
  },
  {
    id: 'companions',
    name: 'I · The companion figures',
    blurb: 'One computed figure for every lecture.',
    delivers: ['Every lecture has a computed companion figure'],
  },
]

/** Every registered id, in tab order. */
export const LAB_IDS: readonly string[] = LABS.map((lab) => lab.id)

/** The screen that delivers a declared item, if one is registered. */
export function labForItem(item: string): LabDefinition | undefined {
  return LABS.find((lab) => lab.delivers.includes(item))
}
