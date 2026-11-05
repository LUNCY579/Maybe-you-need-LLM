/**
 * The laboratory registry.
 *
 * The navigation, the routes and the coverage audit all read this list, so a
 * screen nobody links to and a promise no screen keeps are the same kind of
 * mistake: one that becomes visible here. `delivers` names the item in
 * `references/manifest.json` that the screen computes, and the audit checks
 * the same strings against a test that renders the screen.
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
    id: 'gridworld',
    name: 'A · The gridworld',
    blurb: 'The problem, and the exact answers.',
    delivers: ['A tabular gridworld with exact value iteration'],
  },
  {
    id: 'policygradient',
    name: 'B · The policy gradient',
    blurb: 'The derivation, the estimator, and the exact gradient.',
    delivers: [
      'Deriving the simplest policy gradient',
      'Policy gradients checked against finite differences',
    ],
  },
  {
    id: 'returns',
    name: 'C · The returns',
    blurb: 'Bias against noise, and reward-to-go against the whole return.',
    delivers: [
      'Reward-to-go and the variance it removes',
      'The bias and variance of the λ-return as a function of λ',
    ],
  },
  {
    id: 'actorcritic',
    name: 'D · The actor–critic loop',
    blurb: 'Two halves, learning together.',
    delivers: ['The actor-critic loop'],
  },
]

/** The screen that delivers a declared item, if one is registered. */
export function labForItem(item: string): LabDefinition | undefined {
  return LABS.find((lab) => lab.delivers.includes(item))
}
