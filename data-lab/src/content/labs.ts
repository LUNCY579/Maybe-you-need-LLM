/**
 * The laboratory registry.
 *
 * One list of what exists, used by the gallery, by the router, by the lesson
 * links, and by the coverage audit in `scripts/check-lab-coverage.mjs`. Before
 * this file the same four screens were spelled out in three places — the
 * gallery's local array, the route's `switch`, and the test that checks lesson
 * links — which is how a laboratory ends up with a route and no screen, or a
 * screen nobody can reach.
 *
 * `delivers` names the item in `references/manifest.json` that the screen is the
 * implementation of, *verbatim*: the audit compares the two strings character by
 * character, so a declared laboratory can be checked off only by a screen that
 * says in the manifest's own words what it answers. Where a screen answers two
 * items — deduplication and decontamination are the same machinery pointed at
 * different targets — both are listed, and the screen has a view for each.
 *
 * `id` is the screen's file name without `Lab`, because that is how the audit
 * joins a declaration to a screen: `pipeline` is `PipelineLab.tsx`.
 *
 * `source` is the manifest entry the items came from, so a reader of the gallery
 * can tell whose claim a given laboratory is testing.
 */

export interface LabDefinition {
  /** the screen's name without `Lab`: `pipeline` is `PipelineLab.tsx` */
  id: string
  /** the gallery card title, carrying the letter the screen prints in its panel */
  name: string
  blurb: string
  /** the route the screen is served at */
  route: string
  /** the manifest id of the paper or system this screen's items come from */
  source: string
  /** the declared laboratory items this screen computes */
  delivers: string[]
}

export const LABS: readonly LabDefinition[] = [
  {
    id: 'pipeline',
    name: 'A · The pipeline',
    blurb:
      'Five filters in order, what each stage leaves, and the model trained on the survivors — ablated one filter at a time.',
    route: '/labs/pipeline',
    source: 'penedo-2023-refinedweb',
    delivers: [
      'A full filtering pipeline as a benchmark',
      'Per-filter ablation curves',
      'Per-stage filtering ablations',
    ],
  },
  {
    id: 'budget',
    name: 'F · The budget',
    blurb:
      'Five ways to spend one compute budget, with a control row that has the same documents and the same steps as the filtered one.',
    route: '/labs/budget',
    source: 'li-2024-datacomp-lm',
    delivers: ['Quality versus quantity under a fixed compute budget'],
  },
  {
    id: 'midas',
    name: 'E · MIDAS and the reference model',
    blurb:
      'Near-duplicates kept as clusters rather than collapsed, a perplexity cut taken at a quantile, and a two-view score against a one-view score.',
    route: '/labs/midas',
    source: 'penedo-2023-refinedweb',
    delivers: ['Midas and perplexity filtering', 'Why CLIP filtering works'],
  },
  {
    id: 'dedup',
    name: 'B · Deduplication',
    blurb:
      'MinHash and LSH against the exact shingle sets, and the same machinery turned on a benchmark to find what leaked into the corpus.',
    route: '/labs/dedup',
    source: 'penedo-2024-dolma',
    delivers: ['Deduplication with exact, fuzzy and MinHash methods', 'Decontamination against a benchmark'],
  },
  {
    id: 'mixture',
    name: 'C · The mixture',
    blurb:
      'Domain weights raised by group DRO, the worst domain rescued at a cost to the mean, and a closed-form solver that is degenerate on purpose.',
    route: '/labs/mixture',
    source: 'xie-2023-doremi',
    delivers: ['Group-DRO as a data-mixture objective', 'Per-component mixture ablations'],
  },
  {
    id: 'proxy',
    name: 'H · The proxy step',
    blurb:
      'The extrapolation arithmetic that hands proxy weights to a bigger run, and the ranking transfer it depends on, tested against the run it came from.',
    route: '/labs/proxy',
    source: 'xie-2023-doremi',
    delivers: ['The proxy-model extrapolation step'],
  },
  {
    id: 'refinement',
    name: 'G · The loop',
    blurb:
      'The perplexity reference retrained on the survivors, pass after pass, against one hard pass at the same total removal.',
    route: '/labs/refinement',
    source: 'gerstgrasser-2024-recursion',
    delivers: ['The recursive training loop at toy scale'],
  },
  {
    id: 'collapse',
    name: 'D · Collapse',
    blurb:
      'The tail of a distribution measured directly: the mass that leaves, the symbols it leaves from, and the total variation against the original.',
    route: '/labs/collapse',
    source: 'gerstgrasser-2024-recursion',
    delivers: ['The tail-mass argument, computed'],
  },
]

export const LAB_IDS: readonly string[] = LABS.map((lab) => lab.id)
export const LAB_ROUTES: readonly string[] = LABS.map((lab) => lab.route)

/** The declared manifest items, with the screen that answers each one. */
export const ITEM_TO_LAB: ReadonlyMap<string, string> = new Map(
  LABS.flatMap((lab) => lab.delivers.map((item) => [item, lab.id] as [string, string])),
)

/** The laboratory served at this route, or undefined. */
export function labByRoute(route: string): LabDefinition | undefined {
  return LABS.find((lab) => lab.route === route)
}

export function labById(id: string): LabDefinition | undefined {
  return LABS.find((lab) => lab.id === id)
}
