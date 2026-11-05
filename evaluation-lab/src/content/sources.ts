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
    id: 'zheng-2023',
    authors: 'Lianmin Zheng, Wei-Lin Chiang, Ying Sheng, Siyuan Zhuang, Zhanghao Wu, Yonghao Zhuang and others',
    year: 2023,
    title: 'Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena',
    venue: 'arXiv:2306.05685 [cs.CL] / NeurIPS 2023 Datasets and Benchmarks',
    url: 'https://arxiv.org/abs/2306.05685',
    usedFor:
      'The primary source of this course. The pairwise judging protocol, the agreement and consistency measurements, and the three biases the course measures.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. No Creative Commons licence is shown on the record; re-check the version-specific terms before redistributing anything derived from the text or figures. Nothing from the paper is reproduced here: every figure in this course is an original plot of a computation made in the browser.',
  },
  {
    id: 'chi-2024-arena',
    authors: 'Wei-Lin Chiang, Lianmin Zheng, Ying Sheng, Anastasios Nikolas Angelopoulos, Tianle Li, Dacheng Li and others',
    year: 2024,
    title: 'Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference',
    venue: 'arXiv:2403.04132 [cs.CL] / ICML 2024',
    url: 'https://arxiv.org/abs/2403.04132',
    usedFor:
      'The arena module: the Bradley–Terry model behind the ranking, the bootstrap confidence intervals, and the cost of the votes.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'lian-2023-helm',
    authors: 'Percy Liang, Rishi Bommasani, Tony Lee, Dimitris Tsipras, Dilara Soylu, Michihiro Yasunaga and others',
    year: 2023,
    title: 'Holistic Evaluation of Language Models',
    venue: 'arXiv:2211.09110 [cs.CL] / TMLR 2023',
    url: 'https://arxiv.org/abs/2211.09110',
    usedFor:
      'The benchmark-design module: the multi-metric, multi-scenario alternative to a single score, and the argument that the trade-offs are the interesting part.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'singhal-2025-illusion',
    authors: 'Shivalika Singh, Yiyang Nan, Alex Wang, Daniel D\'Souza, Sayash Kapoor, Ahmet Üstün and others',
    year: 2025,
    title: 'The Leaderboard Illusion',
    venue: 'arXiv:2504.20879 [cs.LG]',
    url: 'https://arxiv.org/abs/2504.20879',
    usedFor:
      'The module on what a leaderboard should publish, and the newest criticism of the evaluation ecosystem.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'reuel-2024-trenches',
    authors: 'Stella Biderman, Hailey Schoelkopf, Lintang Sutawika, Leo Gao, Jonathan Tow, Baber Abbasi and others',
    year: 2024,
    title: 'Lessons from the Trenches on Reproducible Evaluation of Language Models',
    venue: 'arXiv:2405.14782 [cs.LG]',
    url: 'https://arxiv.org/abs/2405.14782',
    usedFor:
      'The measurement module: the practical failure modes of evaluation harnesses — seeds, decoders, chat templates — and how much each one moves a score.',
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
      'The Bradley–Terry maximum-likelihood fit, the Elo update, the bootstrap, the permutation test, the standard errors and the power calculations behind every number in this course.',
    licenseNote: 'Original work, released under the MIT licence.',
  },
]

export const LICENCE_SUMMARY = {
  source: 'The course is written from the papers above and cites them by chapter, section and equation. The papers are not redistributed.',
  figures:
    'Every figure in this course is an original plot of a computation made in the browser from the algorithms in the course’s own code. No figure, table or image from any source is reproduced.',
  code:
    'The algorithms are original implementations written for this course. The judge in Laboratory A is a synthetic model with known, injected biases — it is not any real judge model, and its numbers are measurements of a controlled simulation rather than claims about any published system.',
  data:
    'No dataset is redistributed. The laboratories use generated models, questions and answers, and the generator is part of the course code, with the seed shown.',
  models:
    'No trained model is redistributed and no model is downloaded. Everything in the laboratories is generated by the course’s own code, from a seed.',
} as const
