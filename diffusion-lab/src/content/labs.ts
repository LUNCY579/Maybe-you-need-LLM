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
    id: 'forward',
    name: 'A · The forward process',
    blurb: 'The chain, the closed form for x_t, and the posterior.',
    delivers: ['Forward process with a closed form for x_t'],
  },
  {
    id: 'reverse',
    name: 'B · The reverse process',
    blurb: 'A real denoiser, trained in your browser, and two samplers.',
    delivers: [
      'Reverse process and the learned denoiser',
      'Sampling and the ancestral chain',
      'Deterministic samplers',
      'The deterministic step',
      'The same model, sampled without noise',
    ],
  },
  {
    id: 'schedules',
    name: 'C · Noise schedules',
    blurb: 'Linear against cosine, and what they do to the chain.',
    delivers: ['Beta and noise schedules', 'The cosine schedule', 'The effective diffusion length'],
  },
  {
    id: 'latent',
    name: 'D · Latent diffusion',
    blurb: 'The autoencoder round trip, and the compression measured.',
    delivers: [
      'Autoencoder round trip and the reconstruction error',
      'Latent space scaling factor',
      'Where the compute moves',
    ],
  },
  {
    id: 'guidance',
    name: 'E · Guidance',
    blurb: 'The fidelity–diversity trade-off, from an exact score.',
    delivers: [
      'Unconditional versus conditional score',
      'The guidance scale sweep',
      'Why guidance reduces diversity',
      'Classifier guidance and its gradient term',
    ],
  },
  {
    id: 'variational',
    name: 'F · The variational bound',
    blurb: 'The weights, and the decomposition of the bound.',
    delivers: ['Variational bound and the KL term'],
  },
  {
    id: 'preconditioning',
    name: 'G · Preconditioning',
    blurb: 'The σ parametrisation, the four coefficients, and a sampler.',
    delivers: ['Preconditioning functions', 'σ parametrisation versus the timestep parametrisation'],
  },
]

/** Every registered id, in tab order. */
export const LAB_IDS: readonly string[] = LABS.map((lab) => lab.id)

/** The screen that delivers a declared item, if one is registered. */
export function labForItem(item: string): LabDefinition | undefined {
  return LABS.find((lab) => lab.delivers.includes(item))
}
