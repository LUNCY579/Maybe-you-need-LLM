/**
 * The laboratory registry.
 *
 * Each entry names a screen and the promises from `references/manifest.json`
 * that the screen is responsible for. The strings in `delivers` are copied
 * from the manifest exactly: the coverage audit treats a registry entry as the
 * application's own claim, and a claim near the wording is not the same claim.
 */

export interface Lab {
  id: string
  name: string
  blurb: string
  /** The manifest items this screen computes and shows. */
  delivers: string[]
  /** The sources the screen's argument comes from. */
  sources: string[]
}

export const LABS: Lab[] = [
  {
    id: 'judge',
    name: 'A · The judge and the human',
    blurb: 'Agreement with a human, the swap test, and how the question set decides both.',
    delivers: ['Judge against human agreement', 'Consistency under permutation'],
    sources: ['zheng-2023'],
  },
  {
    id: 'biases',
    name: 'B · The biases of a judge',
    blurb: 'One bias at a time: position, verbosity, self-enhancement.',
    delivers: ['Position bias', 'Verbosity bias', 'Self-enhancement bias'],
    sources: ['zheng-2023'],
  },
  {
    id: 'arena',
    name: 'C · The arena',
    blurb: 'Votes in, a Bradley–Terry ranking out, an interval on it, and a check on the question set.',
    delivers: [
      'Bradley–Terry from pairwise votes',
      'Bootstrap confidence intervals on rankings',
      'The cost of a good arena sample',
      'Rating bias from a fixed evaluation set',
    ],
    sources: ['chi-2024-arena', 'singhal-2025-illusion'],
  },
  {
    id: 'benchmark',
    name: 'D · Benchmark design',
    blurb: 'Contamination, the difficulty mix, multi-metric surfaces, and selecting on a public set.',
    delivers: [
      'Multi-metric trade-off surfaces',
      'Standardisation and coverage',
      'Private testing versus public testing',
    ],
    sources: ['lian-2023-helm', 'singhal-2025-illusion'],
  },
  {
    id: 'measurement',
    name: 'E · Measurement',
    blurb: 'The error bar, the power, the cost, and the decoder that moves the score.',
    delivers: ['How much a decoding change moves a score'],
    sources: ['reuel-2024-trenches'],
  },
]

export const LAB_IDS = LABS.map((lab) => lab.id)
export const LAB_DELIVERIES = LABS.flatMap((lab) => lab.delivers)

export function labById(id: string): Lab | undefined {
  return LABS.find((lab) => lab.id === id)
}
