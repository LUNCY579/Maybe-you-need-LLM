/**
 * The laboratory registry.
 *
 * One list of what the playground contains. `PlaygroundPage` builds its tabs from
 * here and `Landing` lists the arms from here, the curriculum check reads the tab
 * ids from here, and the collection's coverage audit reads the `delivers` blocks
 * from here — so a laboratory that exists with no entry, or an entry with no
 * screen, is a mistake something can see.
 *
 * Two identifiers, because the page and the audit need different things. `tab`
 * is the reader-facing one: the `?lab=` segment in the address bar and the label
 * saved into a progress file. `id` names the *screen* — the component file's name
 * with a trailing `Lab` dropped — and it is what the audit pairs a declaration
 * with, because a `delivers` list is only evidence if it points at a specific
 * rendered surface. That is why the transformer arm's id is `transformerExplorer`
 * rather than `transformer`: its screen is `TransformerExplorer.tsx`, and the
 * audit matches on that name.
 *
 * `title` and `blurb` are what the reader sees: the landing page lists the arms
 * from this file, and a saved configuration is named after the arm it came from.
 * Each screen writes its own longer header, so the blurb stays one clause.
 *
 * `delivers` quotes items from `references/manifest.json` in the manifest's own
 * words. `src/content/labs.test.ts` refuses any string the manifest does not
 * list and any manifest item no screen claims, so the audit can never be told a
 * story this repository does not back up.
 */
import type { SavedPlaygroundConfig } from '../core/progress'

export type PlaygroundLab = SavedPlaygroundConfig['lab']

export interface LabDefinition {
  /** The screen this arm renders: its component name, sans `Lab`. */
  id: string
  /** The playground tab, the `?lab=` segment and the saved-config label. */
  tab: PlaygroundLab
  /** The tab label. */
  label: string
  /** The arm's name, and what a saved configuration is named after. */
  title: string
  /** One clause, for the landing page's list. */
  blurb: string
  /** The declared laboratory items this screen computes. */
  delivers: string[]
}

export const LABS: readonly LabDefinition[] = [
  {
    id: 'transformerExplorer',
    tab: 'transformer',
    label: 'Transformer',
    title: 'Transformer Explorer',
    blurb: 'the full forward pass, stage by stage, with the attention arithmetic as its own step',
    delivers: [
      'Transformer Explorer',
      'Scaled dot-product attention',
      'CNN, RNN and attention side by side',
    ],
  },
  {
    id: 'tokenizer',
    tab: 'tokenizer',
    label: 'Tokenizer',
    title: 'Tokenization and embeddings',
    blurb: 'three segmentation strategies, one toy vocabulary, and the masking recipes',
    delivers: ['Tokenisation and embeddings', 'Masked language modelling'],
  },
  {
    id: 'sampling',
    tab: 'sampling',
    label: 'Sampling',
    title: 'Text generation and sampling',
    blurb: 'temperature, top-k, top-p and seeds applied to explicit logits',
    delivers: ['Sampling'],
  },
  {
    id: 'learning',
    tab: 'learning',
    label: 'Training',
    title: 'Learning and optimisation',
    blurb: 'real gradient descent on a bigram model, and a Chinchilla-style budget calculator',
    delivers: ['Learning', 'Chinchilla-optimal token budget'],
  },
  {
    id: 'alignment',
    tab: 'alignment',
    label: 'Alignment',
    title: 'Alignment and preference learning',
    blurb: 'SFT, reward modelling, DPO, process supervision and a red-team profile',
    delivers: ['Alignment (SFT / Bradley–Terry / DPO)', 'Safety evaluation of a chat model'],
  },
  {
    id: 'inference',
    tab: 'inference',
    label: 'Inference',
    title: 'Inference and reasoning',
    blurb: 'decoding, cache accounting, long context, draft-then-verify and reasoning search',
    delivers: [
      'Inference and reasoning',
      'Position interpolation and the effective context length',
      'Speculative decoding: draft-then-verify',
      'The eight risk categories',
    ],
  },
  {
    id: 'prompt',
    tab: 'prompt',
    label: 'Prompting',
    title: 'Prompting, budgets and retrieval',
    blurb: 'a hard token budget, cosine-scored passages and a few-shot demonstration set',
    delivers: ['Prompting', 'Few-shot prompting'],
  },
]

/** The tab ids, which is what a lesson's `interactive.lab` value has to be one of. */
export const PLAYGROUND_LAB_IDS: readonly PlaygroundLab[] = LABS.map((lab) => lab.tab)

export function labByTab(tab: string | null | undefined): LabDefinition | undefined {
  return LABS.find((lab) => lab.tab === tab)
}

/** Every item the playground claims to compute, in the manifest's words. */
export const DELIVERED_ITEMS: readonly string[] = LABS.flatMap((lab) => lab.delivers)
