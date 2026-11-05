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
 * The ten sources contribute eighteen items, and they do not divide evenly into
 * screens. The three MoE papers are one screen because their items are the same
 * controller seen from three places — the router, the loss that biases it, the
 * capacity that bounds it — and the two quantisation items are one screen because
 * the outlier channel and the smoothing transformation are the same tensor measured
 * twice. What does not fit a screen's own subject goes on the view that computes it,
 * which is why `delivers` is per screen rather than per view.
 */

export interface LabDefinition {
  /** The route segment: `/labs/:labId`. */
  id: string
  /** The tab and card label. */
  name: string
  blurb: string
  /** The declared laboratory items this screen computes. */
  delivers: string[]
  /** The source papers the screen is the implementation of, for the lesson links. */
  sources: string[]
}

export const LABS: readonly LabDefinition[] = [
  {
    id: 'attention',
    name: 'A · Attention memory',
    blurb: 'The matrix you never build, the traffic that replaces it, and the wall of bytes that sizes the block.',
    delivers: [
      'Attention FLOPs versus attention memory',
      'The IO-bound wall and tiling',
      'Arithmetic intensity of an attention kernel',
    ],
    sources: ['dao-2022-flashattention'],
  },
  {
    id: 'kvcache',
    name: 'B · The KV cache',
    blurb: 'Why decoding is a memory problem, what paging does to the allocation, and how many sequences one card serves.',
    delivers: ['KV-cache fragmentation', 'The copy-on-write branch', 'Throughput as a function of batch size'],
    sources: ['kwon-2023-pagedattention'],
  },
  {
    id: 'moe',
    name: 'C · Sparse capacity',
    blurb: 'A router, the auxiliary loss that biases it, and the tokens the capacity factor throws away.',
    delivers: [
      'Routing and load balance',
      'The capacity factor and what happens when it is exceeded',
      'The router and the capacity factor',
      'The auxiliary loss',
      'Simplified routing and the loss spike it removes',
    ],
    sources: ['shazeer-2017-moe', 'lepikhin-2020-gshard', 'fedus-2021-switch'],
  },
  {
    id: 'quantisation',
    name: 'D · Eight bits, four bits',
    blurb: 'The outlier channel that ruins one grid, the scale that moves it, and the block that contains what is left.',
    delivers: ['Per-tensor versus per-channel quantisation error', 'The outlier channel and the smoothing transformation'],
    sources: ['xiao-2023-smoothquant'],
  },
  {
    id: 'speculative',
    name: 'E · Speculation',
    blurb: 'Propose cheaply, check exactly, and the tree and the extra heads that decide what to propose.',
    delivers: [
      'Acceptance rate and the speed-up it buys',
      'The tree variant and its cost',
      'Multi-head drafting and its acceptance rate',
    ],
    sources: ['chen-2023-speculative', 'cai-2024-medusa'],
  },
  {
    id: 'finetune',
    name: 'F · Fine-tuning without moving the weights',
    blurb: 'The rank and what it costs, the bytes a step needs term by term, and which of the three plans fits one card.',
    delivers: ['Rank r and the number of trainable parameters', 'Memory budget of a QLoRA fine-tune'],
    sources: ['hu-2021-lora', 'dettmers-2023-qlora'],
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
