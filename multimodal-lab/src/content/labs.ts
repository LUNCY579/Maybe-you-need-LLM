/**
 * The laboratory registry.
 *
 * The navigation, the routes and the coverage audit all read this list, so a
 * screen nobody links to and a promise no screen keeps are the same kind of
 * mistake: one that becomes visible here. `delivers` names the item in
 * `references/manifest.json` that the screen computes, and the coverage audit
 * checks the same strings against a test that renders the screen.
 */

export interface LabDefinition {
  /** The route segment: `/labs/:id`, and the screen's name without `Lab`. */
  id: string
  name: string
  blurb: string
  /** The declared laboratory items this screen computes. */
  delivers: string[]
}

export const LABS: readonly LabDefinition[] = [
  {
    id: 'contrastive',
    name: 'A · The contrastive model',
    blurb: 'Two encoders, one space, the temperature and the loss.',
    delivers: [
      'The contrastive loss and its temperature',
      'Zero-shot classification as a text-embedding lookup',
    ],
  },
  {
    id: 'instruction',
    name: 'B · The instruction tax',
    blurb: 'What the tuning gives up, the projection, and the data.',
    delivers: [
      'The projection matrix and its dimension',
      'Generating instruction data from captions',
    ],
  },
  {
    id: 'sigmoid',
    name: 'C · The sigmoid loss',
    blurb: 'No normalisation, no coupling.',
    delivers: [
      'The softmax and the sigmoid loss side by side',
      'The coupling experiment: an appended pair moves one loss and not the other',
      'The bias that matches a batch',
    ],
  },
  {
    id: 'frozen',
    name: 'D · The frozen bridge',
    blurb: 'What is trained, and what is held still.',
    delivers: [
      'Learned queries over patch tokens',
      'The trainable share of a frozen bridge',
      'The patch token as the input to the frozen bridge',
    ],
  },
  {
    id: 'resampler',
    name: 'E · The resampler',
    blurb: 'A fixed number of latents, and a bounded token count.',
    delivers: ['The resampler and why it bounds the visual token count'],
  },
]

/** Every registered id, in tab order. */
export const LAB_IDS: readonly string[] = LABS.map((lab) => lab.id)

/** The screen that delivers a declared item, if one is registered. */
export function labForItem(item: string): LabDefinition | undefined {
  return LABS.find((lab) => lab.delivers.includes(item))
}
