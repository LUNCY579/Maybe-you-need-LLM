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
    id: 'cs336',
    authors: 'Stanford CS336 staff',
    year: 2026,
    title: 'CS336: Language Modeling from Scratch',
    venue: 'stanford-cs336.github.io — the Spring 2025 and Spring 2026 offerings',
    url: 'https://cs336.stanford.edu/',
    usedFor:
      'The primary source of this course. The lecture sequence — tokenisation, resource accounting, architectures, parallelism, scaling laws, evaluation, data and post-training — and the five assignments that structure the work.',
    licenseNote:
      'The lecture materials are published by the course staff for study. The lecture repository (stanford-cs336/spring2025-lectures) and the assignment repositories are MIT licensed, verified via the GitHub API on 2026-10-19. The slides and assignment handouts are cited and linked; nothing from them is redistributed here.',
  },
  {
    id: 'hoffmann-2022',
    authors: 'Jordan Hoffmann, Sebastian Borgeaud, Arthur Mensch, Elena Buchatskaya, Trevor Cai, Eliza Rutherford and others',
    year: 2022,
    title: 'Training Compute-Optimal Large Language Models',
    venue: 'arXiv:2203.15556 [cs.CL] / NeurIPS 2022',
    url: 'https://arxiv.org/abs/2203.15556',
    usedFor:
      'The compute-optimal allocation, the IsoFLOP methodology, and the rule of thumb of about twenty tokens per parameter.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'kaplan-2020',
    authors: 'Jared Kaplan, Sam McCandlish, Tom Henighan, Tom B. Brown, Benjamin Chess, Rewon Child and others',
    year: 2020,
    title: 'Scaling Laws for Neural Language Models',
    venue: 'arXiv:2001.08361 [cs.CL]',
    url: 'https://arxiv.org/abs/2001.08361',
    usedFor: 'The power laws themselves, and the shape of the loss as a function of the parameters and the data.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'gpt2-encoder',
    authors: 'Alec Radford, Jeffrey Wu, Rewon Child, David Luan, Dario Amodei and Ilya Sutskever',
    year: 2019,
    title: 'Language Models are Unsupervised Multitask Learners, and the GPT-2 release',
    venue: 'OpenAI — the GPT-2 repository and its byte-level BPE vocabulary',
    url: 'https://github.com/openai/gpt-2',
    usedFor:
      'The real byte-pair merge table and the byte-to-unicode mapping, used in Laboratory A to tokenise the public-domain excerpt exactly as GPT-2 does.',
    licenseNote:
      'The GPT-2 repository and its encoder files are MIT licensed. The 456 KB merge table is redistributed unmodified under that licence as src/content/gpt2-vocab.bpe, with the licence noted there and on the sources page.',
  },
  {
    id: 'gutenberg-moby-dick',
    authors: 'Herman Melville',
    year: 1851,
    title: 'Moby-Dick; or, The Whale — Chapter 1',
    venue: 'Project Gutenberg eBook #2701',
    url: 'https://www.gutenberg.org/ebooks/2701',
    usedFor:
      'The real text Laboratory A tokenises. The opening of Chapter 1, five paragraphs, is included as a public-domain excerpt so the tokeniser can be measured on prose rather than on generated words.',
    licenseNote:
      'The text is in the public domain in the United States. The Project Gutenberg edition carries its own licence; the excerpt here is public-domain text, reflowed into paragraphs and attributed in src/content/realDataset.ts.',
  },
  {
    id: 'course-core',
    authors: 'This project',
    year: 2026,
    title: '@llm-materials/course-core',
    venue: 'The shared numerical and assessment core used by every course in this collection',
    url: 'https://github.com/llm-materials',
    usedFor:
      'The seeded random number generator, the normal quantiles, the bootstrap and the power calculations behind every number in this course.',
    licenseNote: 'Original work, released under the MIT licence.',
  },
]

export const LICENCE_SUMMARY = {
  source: 'The course is written from the lecture materials and the two papers above, and cites them by lecture and by section. Nothing is redistributed.',
  figures:
    'Every figure in this course is an original plot of a computation made in the browser from the algorithms in the course’s own code. No figure, table or image from any source is reproduced.',
  code:
    'The algorithms are original implementations written for this course — including the automatic differentiation engine, the byte-pair encoding, the transformer and the resource accounting. The one third-party artefact is GPT-2’s own merge table, redistributed unmodified under the MIT licence for Laboratory A.',
  data:
    'No corpus is redistributed. The tokeniser and the training loop use a generated corpus with a structure the course’s own code creates, and the seed is shown. The one piece of real text — five paragraphs of Moby-Dick, public domain — is included so the tokeniser can be measured on prose, and is attributed in src/content/realDataset.ts.',
  models:
    'No trained model is redistributed and no model is downloaded. The transformer in Laboratory E is built, initialised and trained in your browser, from scratch, every time you press the button.',
} as const
