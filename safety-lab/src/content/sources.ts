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
    id: 'bai-2022-constitutional',
    authors: 'Yuntao Bai, Saurav Kadavath, Sandipan Kundu, Amanda Askell, Jackson Kernion, Andy Jones and others',
    year: 2022,
    title: 'Constitutional AI: Harmlessness from AI Feedback',
    venue: 'arXiv:2212.08073 [cs.CL] / Anthropic',
    url: 'https://arxiv.org/abs/2212.08073',
    usedFor:
      'The primary source of this course: the critique-and-revise loop, the preference data it makes, and the discussion of what a harmlessness claim does not establish.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. No Creative Commons licence is shown on the record; re-check the version-specific terms before redistributing anything derived from the text or figures. Nothing from the paper is reproduced here: every figure in this course is an original plot of a computation made in the browser.',
  },
  {
    id: 'bai-2022-hh',
    authors: 'Yuntao Bai, Andy Jones, Kamal Ndousse, Amanda Askell, Anna Chen, Nova DasSarma and others',
    year: 2022,
    title: 'Training a Helpful and Harmless Assistant with Reinforcement Learning from Human Feedback',
    venue: 'arXiv:2204.05862 [cs.CL] / Anthropic',
    url: 'https://arxiv.org/abs/2204.05862',
    usedFor: 'The harmlessness categories, the red-team prompts, and how a harmlessness score is produced and judged.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'perez-2022-redteam',
    authors: 'Ethan Perez, Saffron Huang, Francis Song, Trevor Cai, Roman Ring, John Aslanides and others',
    year: 2022,
    title: 'Red Teaming Language Models with Language Models',
    venue: 'arXiv:2202.03286 [cs.CL] / EMNLP 2022',
    url: 'https://arxiv.org/abs/2202.03286',
    usedFor: 'The model-driven attacker, the diversity of its attacks, and the taxonomy they are measured against.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'shirzad-2023-sycophancy',
    authors: 'Mrinank Sharma, Meg Tong, Tomasz Korbak, David Duvenaud, Amanda Askell, Samuel R. Bowman and others',
    year: 2023,
    title: 'Towards Understanding Sycophancy in Language Models',
    venue: 'arXiv:2310.13548 [cs.CL] / ICLR 2024',
    url: 'https://arxiv.org/abs/2310.13548',
    usedFor: 'The flip rate, the size of the effect, and the mitigation that moves it.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'carlini-2021-extraction',
    authors: 'Nicholas Carlini, Florian Tramer, Eric Wallace, Matthew Jagielski, Ariel Herbert-Voss, Katherine Lee and others',
    year: 2021,
    title: 'Extracting Training Data from Large Language Models',
    venue: 'arXiv:2012.07805 [cs.CR] / USENIX Security 2021',
    url: 'https://arxiv.org/abs/2012.07805',
    usedFor: 'The memorisation rate, the extraction attack, and the exposure of a training set.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'hubinger-2024-sleeper',
    authors: 'Evan Hubinger, Carson Denison, Jesse Mu, Mike Lambert, Meg Tong, Monte MacDiarmid and others',
    year: 2024,
    title: 'Sleeper Agents: Training Deceptive LLMs that Persist Through Safety Training',
    venue: 'arXiv:2401.05566 [cs.LG] / ICML 2024',
    url: 'https://arxiv.org/abs/2401.05566',
    usedFor:
      'The conditional behaviour, the cue that switches it, and the finding that safety training leaves it in place while reducing the behaviour that is asked about.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'course-core',
    authors: 'This project',
    year: 2026,
    title: '@llm-materials/course-core',
    venue: 'The shared numerical and assessment core',
    url: 'https://github.com/llm-materials',
    usedFor:
      'The seeded random number generator, the statistics — the agreement and the binomial tail — and the assessment engine.',
    licenseNote: 'Original work, released under the MIT licence.',
  },
]

export const LICENCE_SUMMARY = {
  source:
    'The course is written from the works above and cites them by section. The papers are not redistributed, and no model, dataset or example from any of them is used or redistributed.',
  figures:
    'Every figure in this course is an original plot of a computation made in the browser from the algorithms in the course’s own code. No figure, table or image from any source is reproduced.',
  code:
    'The algorithms are original implementations written for this course: the critique-and-revise loop, the judge’s agreement, the red team and its coverage, the two rounds, the cued corpus and its classifier, the flip rate, the consistency of a labeler, and the extraction and membership attacks.',
  data:
    'No dataset is redistributed and no dataset is downloaded. The exchanges, the attacks, the questions, the cued examples and the training records are all generated by the course’s own code, with the seed shown, and the biases they contain are planted by a slider and labelled as planted wherever they are measured.',
  models:
    'No trained model is redistributed and no model is downloaded. Every "model" here is a rule over a generated task, run in your browser, from scratch, every time you change a setting.',
} as const
