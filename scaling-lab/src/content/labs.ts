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
 * be checked off only by a screen that says what it answers, and an item may be
 * claimed only by a screen that actually computes it.
 *
 * The six sources contribute thirteen items. Three screens carry two or three each
 * because their items are the same measurement read three ways — the IsoFLOP curve,
 * its minimum, and the ratio at that minimum — and splitting them across screens
 * would only duplicate the fit they are all taken from.
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
    id: 'powerlaw',
    name: 'A · The power law',
    blurb: 'Training runs, the law fitted to them, and the exponent that moves with the range.',
    delivers: ['Fitting power laws to loss curves'],
  },
  {
    id: 'compute',
    name: 'B · The compute optimum',
    blurb: 'One budget, many allocations, and the size at which a bigger model starts to pay.',
    delivers: ['The compute-optimal allocation', 'Crossover points between model size and data'],
  },
  {
    id: 'isoflop',
    name: 'C · The IsoFLOP frontier',
    blurb: 'The U at each budget, the line through its minima, and the day the corpus runs out.',
    delivers: ['IsoFLOP curves', 'The 20 tokens-per-parameter rule, rederived', 'What happens when the data runs out'],
  },
  {
    id: 'percolation',
    name: 'D · The percolation threshold',
    blurb: 'Pruning a pool by four metrics, and the cliff each one breaks at.',
    delivers: ['The percolation prediction', 'Pruning metric benchmarking'],
  },
  {
    id: 'epochs',
    name: 'E · Going round the pool',
    blurb: 'Two runs, the same tokens, different data: warmup, plateau, and the turn upward.',
    delivers: ['The three-phase scaling curve', 'How many epochs before repetition dominates'],
  },
  {
    id: 'repeats',
    name: 'F · The effective-data law',
    blurb: 'What a repeated corpus is worth as a number of fresh rows, in closed form.',
    // The closed-form companion to E: screen E measures the curve, this screen draws
    // the law the paper fits to it and the allocation that law implies. Neither of E's
    // two declared items is computed here — `dominanceEpoch` and `phaseBoundaries` are
    // both on screen E — so this one claims nothing rather than borrowing E's.
    delivers: [],
  },
  {
    id: 'emergence',
    name: 'G · The cliff',
    blurb: 'One capability, two metrics, and the difference between a sharp score and a sharp thing.',
    delivers: [
      'The metric-artefact effect, reproduced',
      'Discontinuous metric versus continuous underlying performance',
    ],
  },
  {
    id: 'hardware',
    name: 'H · Hardware and the eras',
    blurb: 'A trend in FLOPs, the break inside it, and the year a target loss became buyable.',
    delivers: ['Hardware capability over time'],
  },
]

/** Every registered id, in tab order. */
export const LAB_IDS: readonly string[] = LABS.map((lab) => lab.id)

/** The registered items, in registry order, for the audit and the tests. */
export const LAB_DELIVERIES: readonly string[] = LABS.flatMap((lab) => lab.delivers)

/** The registry entry for an id, or nothing when the route asked for a screen that does not exist. */
export function labById(id: string | undefined): LabDefinition | undefined {
  return LABS.find((lab) => lab.id === id)
}
