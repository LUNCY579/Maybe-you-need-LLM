/**
 * The laboratory registry.
 *
 * One list of what exists, used by the laboratory page's navigation, by the route that
 * renders a screen, by the lesson that deep-links into a view, and by the test that
 * refuses an orphan: a screen nobody links to, a link to a screen that was deleted and a
 * declared item of the source papers with no code behind it are the same class of
 * mistake, and this file is where they become visible.
 *
 * `delivers` names the item in `references/manifest.json` that the screen is the
 * implementation of — verbatim, because the coverage audit compares the two strings. A
 * laboratory is therefore checked off only by a screen that says what it answers, and the
 * audit's `gap` row for an item is this file's missing line rather than a missing
 * algorithm.
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
    id: 'gradient',
    name: 'A · The policy gradient',
    blurb: 'The objective, the estimator, the ruler it is measured with, and the trust region.',
    delivers: ['Natural gradient and the KL constraint', 'Fisher-vector product by finite differences'],
  },
  {
    id: 'ppo',
    name: 'B · The clipped objective',
    blurb: 'Where the clip bites, what the surrogate is worth, and what normalising does.',
    delivers: [
      'The PPO clipped surrogate objective',
      'The probability-ratio clip and why it bounds the gradient',
      'Advantage normalisation',
    ],
  },
  {
    id: 'gae',
    name: 'C · Advantages and GAE',
    blurb: 'The bias–variance trade-off in λ, on a chain that can be enumerated.',
    delivers: ['Value head and generalised advantage estimation'],
  },
  {
    id: 'kl',
    name: 'D · The KL penalty',
    blurb: 'Three estimators of the same distance, and the penalty they hold a policy to.',
    delivers: ['KL penalty and the reference model'],
  },
  {
    id: 'pipeline',
    name: 'E · The pipeline',
    blurb: 'The three stages run end to end, and what a weak reward model does to the last one.',
    delivers: [
      'Reward hacking under a weak reward model',
      'The SFT stage, the reward model, the PPO stage, each as a runnable file',
    ],
  },
  {
    id: 'overoptimisation',
    name: 'F · Reward overoptimisation',
    blurb: 'The curve, the two fits against one KL budget, and where to stop.',
    delivers: [
      'Reward overoptimisation against a gold reward model',
      'Best-of-n versus reinforcement learning against the same KL budget',
      'The α and β coefficients as the reward model grows',
    ],
  },
]

/** Every registered id, in tab order. */
export const LAB_IDS: readonly string[] = LABS.map((lab) => lab.id)

/** The registry entry for an id, or nothing when the route asked for a screen that does not exist. */
export function labById(id: string | undefined): LabDefinition | undefined {
  return LABS.find((lab) => lab.id === id)
}
