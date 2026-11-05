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
    id: 'superposition',
    name: 'A · Superposition',
    blurb: 'The interference, the threshold, and the trade-off curve between them.',
    delivers: [
      'Superposition in a tiny model',
      'The price of a feature, computed exactly',
      'The trade-off curve between interference and feature count',
    ],
  },
  {
    id: 'autoencoder',
    name: 'B · The sparse autoencoder',
    blurb: 'A dictionary, trained here — and what it does to a pair of overlapping features.',
    delivers: [
      'Training a sparse autoencoder on a tiny residual stream',
      'L0 sparsity and reconstruction error',
      'Feature splitting and absorption',
    ],
  },
  {
    id: 'patching',
    name: 'C · Patching',
    blurb: 'From “responds to” to “does”.',
    delivers: ['Activation patching and the faithfulness score'],
  },
  {
    id: 'attention',
    name: 'D · One head, two circuits',
    blurb: 'The QK and OV circuits, and a head’s effect split exactly over its source positions.',
    delivers: ['Pathway decomposition of a single attention head'],
  },
  {
    id: 'induction',
    name: 'E · Composition and induction',
    blurb: 'Two heads, and the pattern one of them completes.',
    delivers: ['The two-head induction circuit, and the ablation of the previous-token head'],
  },
  {
    id: 'circuit',
    name: 'F · Automated circuit discovery',
    blurb: 'Edge attribution scores, and ACDC pruning a graph down to the circuit.',
    delivers: ['Edge attribution scores'],
  },
  {
    id: 'ioi',
    name: 'G · The four-step workflow',
    blurb: 'The paper’s procedure for finding a circuit, run on a model that can be checked.',
    delivers: ['The four-step workflow applied to the published IOI circuit'],
  },
]

/** Every registered id, in tab order. */
export const LAB_IDS: readonly string[] = LABS.map((lab) => lab.id)

/** The registry entry for an id, or nothing when the route asked for a screen that does not exist. */
export function labById(id: string | undefined): LabDefinition | undefined {
  return LABS.find((lab) => lab.id === id)
}
