/**
 * The references this course cites, with the licence of each.
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
    id: 'kaplan-2020',
    authors: 'Jared Kaplan, Sam McCandlish, Tom Henighan, Tom B. Brown, Benjamin Chess, Rewon Child and others',
    year: 2020,
    title: 'Scaling Laws for Neural Language Models',
    venue: 'arXiv:2001.08361 [cs.CL]',
    url: 'https://arxiv.org/abs/2001.08361',
    usedFor:
      'The primary source of this course: the observation that the loss falls as a power law, the three results, the measurement procedure, and the discussion of what a fitted exponent does not tell you.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. No Creative Commons licence is shown on the record; re-check the version-specific terms before redistributing anything derived from the text or figures. Nothing from the paper is reproduced here: every figure in this course is an original plot of a computation made in the browser.',
  },
  {
    id: 'hoffmann-2022',
    authors: 'Jordan Hoffmann, Sebastian Borgeaud, Arthur Mensch, Elena Buchatskaya, Trevor Cai, Eliza Rutherford and others',
    year: 2022,
    title: 'Training Compute-Optimal Large Language Models',
    venue: 'arXiv:2203.15556 [cs.CL] / NeurIPS 2022',
    url: 'https://arxiv.org/abs/2203.15556',
    usedFor:
      'The two-variable loss surface, the compute budget, the condition that balances the two terms at the optimum, and the tokens-per-parameter ratio that follows from it.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'muennighoff-2023-constrained',
    authors: 'Niklas Muennighoff, Alexander M. Rush, Boaz Barak, Teven Le Scao, Aleksandra Piktus, Nouamane Tazi and others',
    year: 2023,
    title: 'Scaling Data-Constrained Language Models',
    venue: 'arXiv:2305.16264 [cs.CL] / NeurIPS 2023',
    url: 'https://arxiv.org/abs/2305.16264',
    usedFor:
      'The data-constrained regime: the number of repeats, the effective amount of data, the loss as a function of the repeats, and the practical rules that follow.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'schaeffer-2023-mirage',
    authors: 'Rylan Schaeffer, Brando Miranda, Sanmi Koyejo',
    year: 2023,
    title: 'Are Emergent Abilities of Large Language Models a Mirage?',
    venue: 'arXiv:2304.15004 [cs.CL] / NeurIPS 2023',
    url: 'https://arxiv.org/abs/2304.15004',
    usedFor:
      'The argument that an apparent cliff is a property of the metric: how a discontinuous metric on a continuous capability creates an apparent discontinuity, and the experiments that show it.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'sorscher-2022-beyond',
    authors: 'Ben Sorscher, Robert Geirhos, Shashank Shekhar, Surya Ganguli, Ari S. Morcos',
    year: 2022,
    title: 'Beyond neural scaling laws: beating power law scaling via data pruning',
    venue: 'arXiv:2206.14486 [cs.LG] / NeurIPS 2022',
    url: 'https://arxiv.org/abs/2206.14486',
    usedFor:
      'The pruning and percolation module: the argument that a curated subset can scale better than a larger random one, the percolation threshold as a keep fraction, and the benchmarking of supervised pruning metrics.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only: the ImageNet experiments are not reproduced, and the pruning laboratory runs on a synthetic linear pool built in this app.',
  },
  {
    // The catalogue key is inherited from `references/manifest.json`, where this paper
    // was filed under a working name. The title, authors and venue above are published.
    id: 'paullada-2022-eras',
    authors: 'Jaime Sevilla, Lennart Heim, Anson Ho, Tamay Besiroglu, Marius Hobbhahn, Pablo Villalobos',
    year: 2022,
    title: 'Compute Trends Across Three Eras of Machine Learning',
    venue: 'arXiv:2202.05924 [cs.LG] / ICLR 2022 Workshop on ML for Systems',
    url: 'https://arxiv.org/abs/2202.05924',
    usedFor:
      'The hardware module: the three eras, the reported growth rates in orders of magnitude a year, the doubling times, and the ranges the landmark runs span.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. The era statistics used here are quoted from the paper rather than re-derived, and the database of training runs it analyses is not used.',
  },
  {
    id: 'course-core',
    authors: 'This project',
    year: 2026,
    title: '@llm-materials/course-core',
    venue: 'The shared numerical and assessment core',
    url: 'https://github.com/llm-materials',
    usedFor:
      'The ordinary least squares behind the power-law fits, the seeded random number generator, the linear algebra and the assessment engine. The loss-surface fit is not one of them: it is the non-negative least squares solved inside `src/core/surface.ts`, because an unconstrained fit can price the floor of a loss below zero.',
    licenseNote: 'Original work, released under the MIT licence.',
  },
]

export const LICENCE_SUMMARY = {
  source:
    'The course is written from the papers above and cites them by section. The papers are not redistributed, and no model, dataset or figure from any of them is used or redistributed.',
  figures:
    'Every figure in this course is an original plot of a computation made in the browser from the algorithms in the course’s own code. No figure, table or image from any source is reproduced.',
  code:
    'The algorithms are original implementations written for this course: the spectral scaling task, the ridge estimator, the power-law and loss-surface fits, the compute-optimum search, the repetition comparison, the epoch curves, the pruning pool and its four metrics, the log-linear trend fits and the break detector. No code from any paper is copied.',
  data:
    'No dataset is redistributed and no dataset is downloaded. The training runs, the loss surfaces and the capability curves are all generated by the course’s own code, with the seed shown.',
  models:
    'No trained model is redistributed and no model is downloaded. Every model in every laboratory is trained in your browser, from scratch, every time you change a setting.',
} as const
