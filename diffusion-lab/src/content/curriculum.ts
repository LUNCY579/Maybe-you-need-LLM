/**
 * The course curriculum.
 *
 * Every lesson is mapped to a specific place in the source papers, and the
 * mapping is checked by the test suite: a lesson that names a section must
 * name one that exists in the source map below.
 *
 * The primary source is
 *
 *   J. Ho, A. Jain, P. Abbeel, "Denoising Diffusion Probabilistic Models",
 *   arXiv:2006.11239 [cs.LG] / NeurIPS 2020.
 *
 * Three later papers are cited where they extend the original: Rombach et al.
 * on latent diffusion, Karras et al. on the design space, and Ho & Salimans
 * on classifier-free guidance.
 */

import type { LessonMeta, ModuleMeta, SourceRef } from '@llm-materials/course-core'

export type { LessonMeta, ModuleMeta, SourceRef }

/** The papers this course is written from. */
export const SOURCES = {
  ddpm: {
    id: 'ho-2020',
    title: 'Denoising Diffusion Probabilistic Models',
    authors: 'Jonathan Ho, Ajay Jain, Pieter Abbeel',
    year: 2020,
    venue: 'arXiv:2006.11239 [cs.LG] / NeurIPS 2020',
    url: 'https://arxiv.org/abs/2006.11239',
  },
  ldm: {
    id: 'rombach-2022',
    title: 'High-Resolution Image Synthesis with Latent Diffusion Models',
    authors: 'Robin Rombach, Andreas Blattmann, Dominik Lorenz, Patrick Esser, Björn Ommer',
    year: 2022,
    venue: 'arXiv:2112.10752 [cs.CV] / CVPR 2022',
    url: 'https://arxiv.org/abs/2112.10752',
  },
  edm: {
    id: 'karras-2022',
    title: 'Elucidating the Design Space of Diffusion-Based Generative Models',
    authors: 'Tero Karras, Miika Aittala, Timo Aila, Samuli Laine',
    year: 2022,
    venue: 'arXiv:2206.00364 [cs.CV] / NeurIPS 2022',
    url: 'https://arxiv.org/abs/2206.00364',
  },
  cfg: {
    id: 'ho-salmanson-2022',
    title: 'Classifier-Free Diffusion Guidance',
    authors: 'Jonathan Ho, Tim Salimans',
    year: 2022,
    venue: 'arXiv:2207.12598 [cs.LG]',
    url: 'https://arxiv.org/abs/2207.12598',
  },
  ddim: {
    id: 'song-2020-ddim',
    title: 'Denoising Diffusion Implicit Models',
    authors: 'Jiaming Song, Chenlin Meng, Stefano Ermon',
    year: 2020,
    venue: 'arXiv:2010.02502 [cs.LG] / ICLR 2021',
    url: 'https://arxiv.org/abs/2010.02502',
  },
} as const

/**
 * The section map of the primary source.
 *
 * The section numbers and titles are as printed in arXiv:2006.11239. The
 * test suite refuses any lesson that cites a section which is not here.
 */
export const SECTION_MAP: Record<string, { title: string; note: string }> = {
  '1': { title: 'Introduction', note: 'What a diffusion model is, and the claim it makes.' },
  '2': {
    title: 'Background',
    note: 'The latent-variable formulation, the forward process, the closed form for x_t, and the decomposition of the variational bound.',
  },
  '3.1': { title: 'Forward process and L_T', note: 'Why the forward variances are fixed rather than learned.' },
  '3.2': {
    title: 'Reverse process and L_{1:T−1}',
    note: 'The ε-prediction parameterisation, the choice of reverse variance, and the link to denoising score matching.',
  },
  '3.3': { title: 'Data scaling, reverse process decoder, and L_0', note: 'Scaling the data to [−1, 1] and the discrete decoder.' },
  '3.4': { title: 'Simplified training objective', note: 'The unweighted objective the paper actually trains with, and why.' },
  '4': { title: 'Experiments', note: 'The setup: T = 1000 and a linear β schedule from 1e-4 to 0.02.' },
  '4.1': { title: 'Sample quality', note: 'The reported sample-quality and likelihood numbers.' },
  '4.2': {
    title: 'Reverse process parameterization and training objective ablation',
    note: 'The comparison of ε-prediction with μ̃-prediction and of the two objectives.',
  },
  '4.3': { title: 'Progressive coding', note: 'The rate–distortion view and the connection to autoregressive decoding.' },
  '4.4': { title: 'Interpolation', note: 'Interpolating between two samples in latent space.' },
  '5': { title: 'Related Work', note: 'Where diffusion models sit among generative models.' },
  '6': { title: 'Conclusion', note: 'The summary of the contributions.' },
  A: { title: 'Derivation details', note: 'The derivations behind the main text.' },
  B: { title: 'Details of experiments', note: 'The experimental setup in full.' },
  C: { title: 'Details of architecture and training', note: 'The network, the optimiser and the training recipe.' },
  D: { title: 'Additional figures', note: 'Figures that did not fit in the main text.' },
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'forward',
    chapter: 2,
    title: 'The Forward Process',
    tagline: 'How a fixed chain turns data into noise',
    summary:
      'A diffusion model corrupts its data with a fixed Markov chain and then learns to undo the corruption. This module builds the chain: the one-step transition, the closed form that makes training cheap, the posterior the reverse process is matched against, and the signal-to-noise ratio that measures how far the corruption has gone.',
    accent: 'indigo',
    outcomes: [
      'Write the forward transition and the closed form for q(x_t | x_0)',
      'Derive the posterior q(x_{t−1} | x_t, x_0) and explain why it is tractable',
      'Compute the signal-to-noise ratio at any step and say what it means',
      'Explain why the closed form and the Markov chain agree',
    ],
  },
  {
    id: 'reverse',
    chapter: 3,
    title: 'The Reverse Process',
    tagline: 'Learning to walk the corruption backwards',
    summary:
      'The reverse process is a Markov chain of learned Gaussians. This module derives the ε-prediction parameterisation, the two other standard parameterisations, the ancestral sampler, and the deterministic sampler that makes diffusion models fast.',
    accent: 'teal',
    outcomes: [
      'Derive the ε-prediction parameterisation from the variational bound',
      'Convert between ε-prediction, x₀-prediction and v-prediction',
      'Run the ancestral sampler and the deterministic sampler',
      'State what the training objective actually optimises, and what it gives up',
    ],
  },
  {
    id: 'schedules',
    chapter: 4,
    title: 'Noise Schedules',
    tagline: 'Choosing how fast the signal disappears',
    summary:
      'The schedule is the one set of choices in the model that is not learned. This module compares the linear schedule of the original paper with the cosine schedule that followed, and shows what the schedule does to the training signal.',
    accent: 'amber',
    outcomes: [
      'Compare the linear and cosine schedules on the same number of steps',
      'Explain the effect of a schedule on the terminal KL divergence',
      'Compute the weight the true variational bound puts on each timestep',
      'Argue for a schedule choice from the signal-to-noise ratio alone',
    ],
  },
  {
    id: 'latent',
    chapter: 4,
    title: 'Latent Diffusion',
    tagline: 'Why the diffusion happens in someone else’s space',
    summary:
      'Rombach et al. did not improve the diffusion model; they moved it into an autoencoder’s latent space. This module measures the compression, the reconstruction error it costs, and the scaling factor that makes the latents behave like the data the schedule assumes.',
    accent: 'emerald',
    outcomes: [
      'Compute the saving a latent diffusion model buys, in elements and in attention',
      'Measure the reconstruction error a compression buys',
      'Explain why the latents have to be rescaled',
      'Trace what happens to the signal-to-noise ratio in the latent space',
    ],
  },
  {
    id: 'guidance',
    chapter: 4,
    title: 'Guidance',
    tagline: 'Steering a generative model with a condition',
    summary:
      'Guidance is how a diffusion model is made to obey a prompt. This module derives classifier-free guidance from the score, and measures the trade-off it buys: sharper samples, less diversity, and a model that is no longer sampling the distribution it was trained on.',
    accent: 'rose',
    outcomes: [
      'Write the guided score and explain each term',
      'Predict what a guidance weight does to fidelity and to diversity',
      'Derive the classifier-guided update and compare it with the classifier-free one',
      'Say precisely what a guided model is sampling',
    ],
  },
  {
    id: 'design',
    chapter: 4,
    title: 'The Design Space',
    tagline: 'The choices that survived',
    summary:
      'The original paper fixed a dozen choices for convenience. Later work showed which of them mattered. This module covers the σ parametrisation, the preconditioning functions, the deterministic samplers, and the arithmetic of how many network evaluations a sample costs.',
    accent: 'violet',
    outcomes: [
      'Compare the timestep and σ parametrisations',
      'Explain what a preconditioning function is for',
      'Count the network evaluations a given number of steps costs',
      'Describe the difference between a stochastic and a deterministic sampler',
    ],
  },
]

export const LESSONS: LessonMeta[] = [
  /* ------------------------------------------------------------------ Module 1 */
  {
    id: 'what-is-a-diffusion',
    moduleId: 'forward',
    number: 1,
    title: 'What a diffusion model is',
    subtitle: 'A fixed corruption, and a learned undoing of it',
    minutes: 18,
    objectives: [
      'State the two processes that make up a diffusion model',
      'Say what the "diffusion" is named after',
      'Explain why the forward process has no learnable parameters',
    ],
    keyIdeas: [
      'A diffusion model is a latent variable model whose approximate posterior is fixed.',
      'The forward process adds Gaussian noise on a schedule; the reverse process learns to undo it.',
      'The prior at the end of the chain is the standard normal, so sampling starts from noise.',
    ],
    interactive: {
      lab: 'forward',
      view: 'chain',
      title: 'Watch the chain run',
      description: 'Step a data point through the forward chain and watch the signal disappear.',
    },
    prerequisites: [],
    glossaryTerms: ['diffusion-model', 'forward-process', 'reverse-process', 'variance-schedule'],
    quizIds: ['q-forward-1', 'q-forward-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2',
        title: 'Background',
        page: 3,
        note: 'The reverse process of equation 1, the forward process of equation 2, and the variational bound of equation 3.',
      },
      {
        chapter: 1,
        section: '1',
        title: 'Introduction',
        page: 1,
        note: 'The description of the model as a parameterised Markov chain trained with variational inference.',
      },
    ],
    furtherReading: [
      {
        label: 'Ho, Jain & Abbeel, arXiv:2006.11239',
        href: 'https://arxiv.org/abs/2006.11239',
        note: 'The primary source.',
      },
    ],
  },
  {
    id: 'the-closed-form',
    moduleId: 'forward',
    number: 2,
    title: 'The closed form',
    subtitle: 'Sampling any timestep in one step',
    minutes: 22,
    objectives: [
      'State q(x_t | x_0) and derive it from the one-step transition',
      'Explain why the closed form is what makes diffusion training affordable',
      'Verify that the closed form and the Markov chain describe the same distribution',
    ],
    keyIdeas: [
      'x_t = √ᾱ_t · x_0 + √(1 − ᾱ_t) · ε, with ε ~ N(0, I).',
      'The state is a scaled copy of the data plus a scaled copy of a noise vector.',
      'Training never unrolls the chain: one timestep, one noise draw, one network evaluation.',
    ],
    interactive: {
      lab: 'forward',
      view: 'closed-form',
      title: 'Check the closed form against the chain',
      description: 'Compare the two ways of reaching the same timestep.',
    },
    prerequisites: ['what-is-a-diffusion'],
    glossaryTerms: ['alpha-bar', 'signal-to-noise-ratio', 'marginal'],
    quizIds: ['q-forward-3', 'q-forward-4', 'q-closed-form-4'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2',
        title: 'Background',
        page: 4,
        note: 'Equation 4, the closed form q(x_t | x_0), and the statement that efficient training follows from it.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-posterior',
    moduleId: 'forward',
    number: 3,
    title: 'The posterior',
    subtitle: 'The one quantity that has to be tractable',
    minutes: 20,
    objectives: [
      'Write the posterior q(x_{t−1} | x_t, x_0)',
      'Explain why a tractable posterior is what makes the variational bound usable',
      'Compute the posterior mean and variance for a given step',
    ],
    keyIdeas: [
      'q(x_{t−1} | x_t, x_0) is Gaussian, and so is the reverse process it is compared against.',
      'Every KL term in the bound therefore has a closed form instead of a Monte Carlo estimate.',
      'The posterior leans on x_0 at small t and on x_t at large t.',
    ],
    interactive: {
      lab: 'forward',
      view: 'posterior',
      title: 'Move the posterior weight',
      description: 'See the posterior shift its weight from x_0 to x_t as the noise grows.',
    },
    prerequisites: ['the-closed-form'],
    glossaryTerms: ['posterior', 'variational-bound', 'kl-divergence'],
    quizIds: ['q-forward-5', 'q-posterior-4'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2',
        title: 'Background',
        page: 4,
        note: 'Equations 6 and 7: the posterior mean and the posterior variance β̃_t.',
      },
      {
        chapter: 2,
        section: '2',
        title: 'Background',
        page: 3,
        note: 'Equation 5: the decomposition of the bound into per-step KL terms.',
      },
    ],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 2 */
  {
    id: 'the-objective',
    moduleId: 'reverse',
    number: 4,
    title: 'The training objective',
    subtitle: 'Why predicting the noise is the same as predicting the score',
    minutes: 26,
    objectives: [
      'Derive the ε-prediction parameterisation from the bound',
      'State the simplified objective and what it gives up',
      'Explain the connection to denoising score matching',
    ],
    keyIdeas: [
      'The reverse mean can be written in terms of a network that predicts ε.',
      'With that parameterisation the bound becomes a weighted squared error on ε.',
      'Dropping the weight gives the objective the paper actually uses.',
    ],
    interactive: {
      lab: 'variational',
      view: 'weights',
      title: 'See the weight the simplification drops',
      description: 'Compare the weight of the true bound with the flat weight of the simplified objective.',
    },
    prerequisites: ['the-posterior'],
    glossaryTerms: ['epsilon-prediction', 'score', 'denoising-score-matching', 'simplified-objective'],
    quizIds: ['q-reverse-1', 'q-reverse-2'],
    sourceRefs: [
      {
        chapter: 3,
        section: '3.2',
        title: 'Reverse process and L_{1:T−1}',
        page: 7,
        note: 'Equations 8 to 12: from the KL term to the ε-prediction parameterisation of equation 11 and the weighted loss of equation 12.',
      },
      {
        chapter: 3,
        section: '3.4',
        title: 'Simplified training objective',
        page: 10,
        note: 'Equation 14, the simplified objective, and the reason the small-t terms are down-weighted.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'parameterisations',
    moduleId: 'reverse',
    number: 5,
    title: 'Three parameterisations',
    subtitle: 'ε, x₀, and v',
    minutes: 18,
    objectives: [
      'Convert a prediction in one parameterisation into another',
      'State which parameterisation the paper found best and why',
      'Predict what changes when the network predicts x₀ instead of ε',
    ],
    keyIdeas: [
      'The three parameterisations describe the same reverse process; only the network target changes.',
      'Predicting x₀ is unstable at large t, where the estimate of x₀ is dominated by noise.',
      'The v-prediction is the reparameterisation that interpolates between them.',
    ],
    interactive: {
      lab: 'reverse',
      view: 'parameterisations',
      title: 'Convert a prediction',
      description: 'Take one network output and read it as ε, as x₀, and as v.',
    },
    prerequisites: ['the-objective'],
    glossaryTerms: ['v-prediction', 'x0-prediction'],
    quizIds: ['q-reverse-3'],
    sourceRefs: [
      {
        chapter: 3,
        section: '3.2',
        title: 'Reverse process and L_{1:T−1}',
        page: 8,
        note: 'The remark that predicting x_0 led to worse sample quality early on, and the summary of the two parameterisations.',
      },
      {
        chapter: 4,
        section: '4.2',
        title: 'Reverse process parameterization and training objective ablation',
        page: 12,
        note: 'Table 2: the measured comparison of the two parameterisations under both objectives.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'sampling',
    moduleId: 'reverse',
    number: 6,
    title: 'Sampling',
    subtitle: 'From noise to a sample, and back again',
    minutes: 24,
    objectives: [
      'Run the ancestral sampler and account for the noise it adds',
      'Explain what a deterministic sampler does differently',
      'Describe the cost of sampling in network evaluations',
    ],
    keyIdeas: [
      'The ancestral sampler adds σ_t · z at every step.',
      'A deterministic sampler reuses the same noise and can be run in fewer steps.',
      'Sampling is the expensive half: T network evaluations per sample.',
    ],
    interactive: {
      lab: 'reverse',
      view: 'sampling',
      title: 'Run the reverse chain',
      description: 'Sample from a trained model and watch the trajectory back to the data.',
    },
    prerequisites: ['parameterisations'],
    glossaryTerms: ['ancestral-sampling', 'ddim', 'deterministic-sampler'],
    quizIds: ['q-reverse-4', 'q-reverse-5', 'q-sampling-4'],
    sourceRefs: [
      {
        chapter: 3,
        section: '3.2',
        title: 'Reverse process and L_{1:T−1}',
        page: 8,
        note: 'Algorithm 2, the sampling procedure, and the remark that it resembles Langevin dynamics.',
      },
      {
        chapter: 3,
        section: '3.4',
        title: 'Simplified training objective',
        page: 10,
        note: 'Algorithm 1, the training procedure.',
      },
    ],
    furtherReading: [
      {
        label: 'Song, Meng & Ermon, arXiv:2010.02502',
        href: 'https://arxiv.org/abs/2010.02502',
        note: 'DDIM: the deterministic sampler.',
      },
    ],
  },

  /* ------------------------------------------------------------------ Module 3 */
  {
    id: 'the-schedule',
    moduleId: 'schedules',
    number: 7,
    title: 'Choosing a schedule',
    subtitle: 'Linear, cosine, and what they do to the signal',
    minutes: 20,
    objectives: [
      'Write the linear schedule of the original paper',
      'Explain what the schedule controls',
      'Compute the terminal KL divergence for a given schedule',
    ],
    keyIdeas: [
      'The paper fixes β to grow linearly from 1e-4 to 0.02 over T = 1000 steps.',
      'The schedule is the only part of the model that is not learned.',
      'A good schedule spends its steps where the denoising task is informative.',
    ],
    interactive: {
      lab: 'schedules',
      view: 'curves',
      title: 'Compare two schedules',
      description: 'Put the linear and cosine schedules side by side and read the signal-to-noise ratio off each.',
    },
    prerequisites: ['the-closed-form'],
    glossaryTerms: ['variance-schedule', 'terminal-kl'],
    quizIds: ['q-schedules-1', 'q-schedules-2'],
    sourceRefs: [
      {
        chapter: 4,
        section: '4',
        title: 'Experiments',
        page: 11,
        note: 'T = 1000, β linear from 1e-4 to 0.02, and the quoted terminal KL of roughly 1e-5 bits per dimension.',
      },
      {
        chapter: 3,
        section: '3.1',
        title: 'Forward process and L_T',
        page: 6,
        note: 'The reason the forward variances are fixed rather than learned: the terminal term is then a constant.',
      },
    ],
    furtherReading: [
      {
        label: 'Nichol & Dhariwal, arXiv:2102.09672',
        href: 'https://arxiv.org/abs/2102.09672',
        note: 'The cosine schedule and learned variances.',
      },
    ],
  },
  {
    id: 'the-weighting',
    moduleId: 'schedules',
    number: 8,
    title: 'The weighting',
    subtitle: 'Why the simplified objective is not the same objective',
    minutes: 18,
    objectives: [
      'Write the weight of the true variational bound at each timestep',
      'Explain the consequence of dropping the weight',
      'Say what the paper gives up when it uses the simplified objective',
    ],
    keyIdeas: [
      'The true bound weights the loss by β_t² / (2 σ_t² α_t (1 − ᾱ_t)).',
      'That weight is enormous at small t and tiny at large t.',
      'The simplified objective flattens it, so small t is effectively ignored.',
    ],
    interactive: {
      lab: 'variational',
      view: 'decomposition',
      title: 'Decompose the bound',
      description: 'Break the bound into its per-step KL terms and see where the cost sits.',
    },
    prerequisites: ['the-objective', 'the-schedule'],
    glossaryTerms: ['variational-bound', 'simplified-objective'],
    quizIds: ['q-schedules-3'],
    sourceRefs: [
      {
        chapter: 3,
        section: '3.4',
        title: 'Simplified training objective',
        page: 10,
        note: 'The statement that the simplified objective down-weights the loss terms corresponding to small t.',
      },
      {
        chapter: 4,
        section: '4.1',
        title: 'Sample quality',
        page: 11,
        note: 'Table 1: the true bound gives better codelengths, the simplified objective gives better samples.',
      },
    ],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 4 */
  {
    id: 'latent-space',
    moduleId: 'latent',
    number: 9,
    title: 'The latent space',
    subtitle: 'Moving the diffusion into an autoencoder',
    minutes: 20,
    objectives: [
      'Compute the reduction in elements and in attention a compression buys',
      'Measure the reconstruction error a compression costs',
      'Explain the role of the scaling factor',
    ],
    keyIdeas: [
      'A diffusion model in pixel space wastes most of its capacity on high frequencies.',
      'An autoencoder moves the problem into a lower dimensional space, and the saving is roughly quadratic.',
      'The latents have to be rescaled, because the schedule assumes unit-variance data.',
    ],
    interactive: {
      lab: 'latent',
      view: 'compression',
      title: 'Measure the compression',
      description: 'Train a real autoencoder and watch the reconstruction error against the compression ratio.',
    },
    prerequisites: ['the-closed-form'],
    glossaryTerms: ['latent-diffusion', 'autoencoder', 'scaling-factor'],
    quizIds: ['q-latent-1', 'q-latent-2', 'q-latent-4'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2',
        title: 'Background',
        page: 3,
        note: 'The argument that the top-level latent x_T has nearly zero mutual information with the data.',
      },
    ],
    furtherReading: [
      {
        label: 'Rombach et al., arXiv:2112.10752',
        href: 'https://arxiv.org/abs/2112.10752',
        note: 'Latent diffusion, and the scaling factor of 0.18215.',
      },
    ],
  },

  /* ------------------------------------------------------------------ Module 5 */
  {
    id: 'classifier-free-guidance',
    moduleId: 'guidance',
    number: 10,
    title: 'Classifier-free guidance',
    subtitle: 'Guiding without a classifier',
    minutes: 24,
    objectives: [
      'Write the guided score',
      'Derive it from the conditional and unconditional scores',
      'Explain why the guided model is not sampling the training distribution',
    ],
    keyIdeas: [
      's_guided = s_uncond + w · (s_cond − s_uncond).',
      'The guided distribution is the training distribution tilted by p(c | x)^w.',
      'Raising w sharpens the samples and reduces their diversity.',
    ],
    interactive: {
      lab: 'guidance',
      view: 'sweep',
      title: 'Sweep the guidance weight',
      description: 'Measure fidelity and diversity against the guidance weight, with an exact score.',
    },
    prerequisites: ['the-objective'],
    glossaryTerms: ['guidance', 'classifier-free-guidance', 'score', 'mode-collapse'],
    quizIds: ['q-guidance-1', 'q-guidance-2', 'q-guidance-5'],
    sourceRefs: [],
    furtherReading: [
      {
        label: 'Ho & Salimans, arXiv:2207.12598',
        href: 'https://arxiv.org/abs/2207.12598',
        note: 'The classifier-free guidance derivation.',
      },
    ],
  },
  {
    id: 'the-price-of-guidance',
    moduleId: 'guidance',
    number: 11,
    title: 'The price of guidance',
    subtitle: 'What the extra fidelity costs',
    minutes: 18,
    objectives: [
      'Quantify the trade-off between fidelity and diversity',
      'Explain the relationship between guidance weight and the effective temperature',
      'Predict what a very large guidance weight does',
    ],
    keyIdeas: [
      'Guidance narrows the distribution: the samples move to the mode and stop spreading.',
      'A large guidance weight behaves like a low temperature, but not exactly.',
      'The guided model has higher likelihood on some inputs and much lower on others.',
    ],
    interactive: {
      lab: 'guidance',
      view: 'tradeoff',
      title: 'Plot the trade-off',
      description: 'Put fidelity against diversity and mark where the sweet spot is.',
    },
    prerequisites: ['classifier-free-guidance'],
    glossaryTerms: ['mode-collapse', 'guidance'],
    quizIds: ['q-guidance-3'],
    sourceRefs: [],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 6 */
  {
    id: 'the-design-space',
    moduleId: 'design',
    number: 12,
    title: 'The design space',
    subtitle: 'The choices that turned out to matter',
    minutes: 22,
    objectives: [
      'Compare the timestep parametrisation with the σ parametrisation',
      'Explain what a preconditioning function does',
      'Count the network evaluations a sampler costs',
    ],
    keyIdeas: [
      'The original paper fixed many choices for convenience; later work separated the ones that matter.',
      'Preconditioning decides how the loss at one noise level is weighted against the others.',
      'The number of steps is the only number that matters for sampling cost.',
    ],
    interactive: {
      lab: 'variational',
      view: 'cost',
      title: 'Count the cost',
      description: 'Add up what a sample costs, in network evaluations and in memory.',
    },
    prerequisites: ['sampling', 'the-schedule'],
    glossaryTerms: ['preconditioning', 'sigma-parametrisation'],
    quizIds: ['q-design-1', 'q-design-2', 'q-design-3'],
    sourceRefs: [],
    furtherReading: [
      {
        label: 'Karras et al., arXiv:2206.00364',
        href: 'https://arxiv.org/abs/2206.00364',
        note: 'The σ parametrisation, the preconditioning functions and the design-space analysis.',
      },
    ],
  },
]

/** The lessons of a module, in order. */
export function lessonsOfModule(moduleId: string): LessonMeta[] {
  return LESSONS.filter((lesson) => lesson.moduleId === moduleId).sort((a, b) => a.number - b.number)
}

export function lessonById(id: string): LessonMeta | undefined {
  return LESSONS.find((lesson) => lesson.id === id)
}

export function moduleById(id: string): ModuleMeta | undefined {
  return MODULES.find((module) => module.id === id)
}
