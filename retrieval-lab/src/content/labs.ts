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
    id: 'sparse',
    name: 'A · The sparse index',
    blurb: 'Matching the words, exactly.',
    delivers: [],
  },
  {
    id: 'dense',
    name: 'B · The dense retriever',
    blurb: 'Matching the meaning, approximately.',
    delivers: [
      'A bi-encoder over a toy corpus',
      'The three query and document encoders',
      'Recall as a function of embedding dimension',
    ],
  },
  {
    id: 'late',
    name: 'C · The late interaction',
    blurb: 'Word by word, and the index it costs.',
    delivers: [
      'MaxSim scoring',
      'Why late interaction beats both endpoints on multi-hop questions',
    ],
  },
  {
    id: 'context',
    name: 'D · The long context',
    blurb: 'Where the evidence is put, and whether it is used.',
    delivers: [
      'Parametric versus non-parametric memory',
      'Accuracy as a function of the position of the evidence',
    ],
  },
]

/** The screen that delivers a declared item, if one is registered. */
export function labForItem(item: string): LabDefinition | undefined {
  return LABS.find((lab) => lab.delivers.includes(item))
}
