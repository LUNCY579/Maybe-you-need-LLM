/**
 * The references this course cites, with the licence of each.
 *
 * The course redistributes no figure, no dataset and no third-party code. It
 * links to the canonical source of every work it draws on, and records the
 * licence that was checked, so a reader can tell what they may do with what
 * they find here.
 */

export interface CourseReference {
  id: string
  authors: string
  year: number
  title: string
  venue: string
  url: string
  usedFor: string
  licenseNote: string
}

export const REFERENCES: CourseReference[] = [
  {
    id: 'ho-2020',
    authors: 'Jonathan Ho, Ajay Jain, Pieter Abbeel',
    year: 2020,
    title: 'Denoising Diffusion Probabilistic Models',
    venue: 'arXiv:2006.11239 [cs.LG] / NeurIPS 2020',
    url: 'https://arxiv.org/abs/2006.11239',
    usedFor:
      'The primary source of this course. The forward process, the closed form, the posterior, the ε-prediction parameterisation, the simplified objective, the sampling procedure, the schedule, and the progressive-coding argument.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. No Creative Commons licence is shown on the record; re-check the version-specific terms before redistributing anything derived from the text or figures. Nothing from the paper is reproduced here: every figure in this course is an original plot of a computation made in the browser.',
  },
  {
    id: 'rombach-2022',
    authors: 'Robin Rombach, Andreas Blattmann, Dominik Lorenz, Patrick Esser, Björn Ommer',
    year: 2022,
    title: 'High-Resolution Image Synthesis with Latent Diffusion Models',
    venue: 'arXiv:2112.10752 [cs.CV] / CVPR 2022',
    url: 'https://arxiv.org/abs/2112.10752',
    usedFor:
      'The latent diffusion module: the compression that motivates moving the diffusion, the reconstruction error it costs, and the scaling factor of the latent space.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'karras-2022',
    authors: 'Tero Karras, Miika Aittala, Timo Aila, Samuli Laine',
    year: 2022,
    title: 'Elucidating the Design Space of Diffusion-Based Generative Models',
    venue: 'arXiv:2206.00364 [cs.CV] / NeurIPS 2022',
    url: 'https://arxiv.org/abs/2206.00364',
    usedFor:
      'The design-space module: the σ parametrisation, the preconditioning functions, and the separation of the choices that matter from the ones that do not.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'ho-salmanson-2022',
    authors: 'Jonathan Ho, Tim Salimans',
    year: 2022,
    title: 'Classifier-Free Diffusion Guidance',
    venue: 'arXiv:2207.12598 [cs.LG]',
    url: 'https://arxiv.org/abs/2207.12598',
    usedFor: 'The guidance module: the guided score, the tilted distribution, and the fidelity–diversity trade-off.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'song-2020-ddim',
    authors: 'Jiaming Song, Chenlin Meng, Stefano Ermon',
    year: 2020,
    title: 'Denoising Diffusion Implicit Models',
    venue: 'arXiv:2010.02502 [cs.LG] / ICLR 2021',
    url: 'https://arxiv.org/abs/2010.02502',
    usedFor: 'The sampling lesson: the deterministic sampler, and why the number of steps can be cut.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'nichol-2021',
    authors: 'Alex Nichol, Prafulla Dhariwal',
    year: 2021,
    title: 'Improved Denoising Diffusion Probabilistic Models',
    venue: 'arXiv:2102.09672 [cs.LG] / ICML 2021',
    url: 'https://arxiv.org/abs/2102.09672',
    usedFor: 'The cosine schedule and the learned variances, in the schedules module.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'dhariwal-2021',
    authors: 'Prafulla Dhariwal, Alex Nichol',
    year: 2021,
    title: 'Diffusion Models Beat GANs on Image Synthesis',
    venue: 'arXiv:2105.05233 [cs.CV] / NeurIPS 2021',
    url: 'https://arxiv.org/abs/2105.05233',
    usedFor: 'The classifier-guided alternative, for comparison with classifier-free guidance.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'course-core',
    authors: 'This project',
    year: 2026,
    title: '@llm-materials/course-core',
    venue: 'The shared numerical and assessment core used by every course in this collection',
    url: 'https://github.com/llm-materials',
    usedFor:
      'The seeded random number generator, the linear algebra, the statistics, the progress record and the assessment engine behind every number and every question in this course.',
    licenseNote: 'Original work, released under the MIT licence.',
  },
]

export const LICENCE_SUMMARY = {
  source: 'The course is written from the papers above and cites them by chapter, section and equation. The papers are not redistributed.',
  figures:
    'Every figure in this course is an original plot of a computation made in the browser from the algorithms in the course’s own code. No figure, table or image from any source is reproduced.',
  code:
    'The algorithms are original implementations written for this course. Where a result is quoted from a paper — the schedule’s β range, the sample-quality numbers, the reported KL — the source is named on the same screen.',
  data:
    'No dataset is redistributed. The laboratories use generated toy distributions, and the generator is part of the course code, with the seed shown.',
  models:
    'No trained model is redistributed. The denoising network in the laboratory is trained in the browser, from scratch, on a generated distribution, every time you press the button.',
} as const
