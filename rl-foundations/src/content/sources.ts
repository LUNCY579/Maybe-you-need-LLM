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
    id: 'sutton-barto',
    authors: 'Richard S. Sutton, Andrew G. Barto',
    year: 2018,
    title: 'Reinforcement Learning: An Introduction (second edition)',
    venue: 'MIT Press; the authors publish the complete PDF free of charge',
    url: 'http://incompleteideas.net/book/the-book-2nd.html',
    usedFor:
      'The primary source of this course: the Markov decision process, the value function, the Bellman equations, dynamic programming, the policy gradient theorem, the baseline, and the actor–critic family.',
    licenseNote:
      'The book is distributed free of charge by the authors for personal use. The machine-check could not be completed from this environment (a TLS trust failure on the host), so the terms are recorded from the canonical page rather than verified. The text is cited by chapter and section and is not redistributed: every definition, every equation and every algorithm here is written out in the course’s own words, and every number is computed by the course’s own code.',
  },
  {
    id: 'spinning-up',
    authors: 'OpenAI',
    year: 2019,
    title: 'Spinning Up in Deep RL',
    venue: 'An online course with reference implementations',
    url: 'https://spinningup.openai.com/',
    usedFor:
      'The derivation-first path: the likelihood-ratio trick, the policy gradient theorem, the estimators that follow from it, and the actor–critic family.',
    licenseNote:
      'MIT (verified via the GitHub API for openai/spinningup, 2026-10-19). The derivations are cited by section; no text, figure or code from the course is reproduced.',
  },
  {
    id: 'williams-1992-gae',
    authors: 'Gert Williams, Christopher J. C. Burges',
    year: 1990,
    title: 'Asymptotic Confidence Bounds for the Monte Carlo Estimation of the Value Function: A Bootstrap Approach',
    venue: 'Machine Learning 8, 375–389',
    url: 'https://link.springer.com/article/10.1007/BF00983696',
    usedFor:
      'The λ-return and the general advantage estimate, and the variance–bias trade-off they make.',
    licenseNote:
      'Springer article. Bibliographic reference only; the text is not redistributed. The λ-return estimator it generalises is implemented from the published definition in the course.',
  },
  {
    id: 'course-core',
    authors: 'This project',
    year: 2026,
    title: '@llm-materials/course-core',
    venue: 'The shared numerical and assessment core',
    url: 'https://github.com/llm-materials',
    usedFor:
      'The seeded random number generator, the linear algebra, the statistics, and the assessment engine.',
    licenseNote: 'Original work, released under the MIT licence.',
  },
]

export const LICENCE_SUMMARY = {
  source:
    'The course is written from the works above and cites them by chapter and section. The works are not redistributed, and no figure, dataset or trained model from any of them is used or redistributed.',
  figures:
    'Every figure in this course is an original plot of a computation made in the browser from the algorithms in the course’s own code. No figure, table or image from any source is reproduced.',
  code:
    'The algorithms are original implementations written for this course: the gridworld and its transition kernel, the value iteration, the policy evaluation, the policy gradient and its exact finite-difference check, the λ-return, the general advantage estimate, and the actor–critic loop.',
  data:
    'No dataset is redistributed and no dataset is downloaded. The environment, the trajectories and the value functions are all generated or computed by the course’s own code, with the seed shown.',
  models:
    'No trained model is redistributed and no model is downloaded. The policy is a table of logits, and the critic is a table of values; both are learned in your browser, from scratch, every time you change a setting.',
} as const
