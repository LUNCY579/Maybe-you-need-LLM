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
    id: 'radford-2021-clip',
    authors: 'Alec Radford, Jong Wook Kim, Chris Hallacy, Aditya Ramesh, Gabriel Goh, Sandhini Agarwal and others',
    year: 2021,
    title: 'Learning Transferable Visual Models From Natural Language Supervision',
    venue: 'arXiv:2103.00020 [cs.CV] / ICML 2021',
    url: 'https://arxiv.org/abs/2103.00020',
    usedFor:
      'The primary source of this course: the contrastive objective, the in-batch negatives, the temperature, the precomputed index, and the zero-shot transfer.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. No Creative Commons licence is shown on the record; re-check the version-specific terms before redistributing anything derived from the text or figures. Nothing from the paper is reproduced here: every figure in this course is an original plot of a computation made in the browser, and no image or dataset is redistributed.',
  },
  {
    id: 'liu-2023-llava',
    authors: 'Haotian Liu, Chunyuan Li, Qingyang Wu, Yong Jae Lee',
    year: 2023,
    title: 'Visual Instruction Tuning',
    venue: 'arXiv:2304.08485 [cs.CV] / NeurIPS 2023',
    url: 'https://arxiv.org/abs/2304.08485',
    usedFor: 'The three-stage instruction recipe, the linear projection into the language model, the caption-derived instruction data, and the effect of the mixtures on what the model keeps.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'alayrac-2022-flamingo',
    authors: 'Jean-Baptiste Alayrac, Jeff Donahue, Pauline Luc, Antoine Miech, Iain Barr, Yana Hasson and others',
    year: 2022,
    title: 'Flamingo: a Visual Language Model for Few-Shot Learning',
    venue: 'arXiv:2204.14198 [cs.CV] / NeurIPS 2022',
    url: 'https://arxiv.org/abs/2204.14198',
    usedFor:
      'The interleaved sequence, the resampler that bounds the visual token count, and the few-shot learning that the frozen encoder buys.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'zhai-2023-siglip',
    authors: 'Xiaohua Zhai, Basil Mustafa, Alexander Kolesnikov, Lucas Beyer',
    year: 2023,
    title: 'Sigmoid Loss for Language Image Pre-Training',
    venue: 'arXiv:2303.15343 [cs.CV] / ICCV 2023',
    url: 'https://arxiv.org/abs/2303.15343',
    usedFor:
      'The pairwise sigmoid loss, the removal of the softmax’s normalisation over the batch, the negative-to-positive ratio experiments, and the initialisation of the bias.',
    licenseNote:
      'Creative Commons Attribution 4.0 International (CC BY 4.0). The paper may be shared with attribution. It is cited here by reference, and nothing from it — text, figures, tables or data — is reproduced.',
  },
  {
    id: 'li-2023-blip2',
    authors: 'Junnan Li, Dongxu Li, Silvio Savarese, Steven Hoi',
    year: 2023,
    title: 'BLIP-2: Bootstrapping Language-Image Pre-training with Frozen Image Encoders and Large Language Models',
    venue: 'arXiv:2301.12597 [cs.CV] / ICML 2023',
    url: 'https://arxiv.org/abs/2301.12597',
    usedFor:
      'The frozen image encoder and language model, the Q-Former’s learned queries, and the two pre-training stages that train only the bridge.',
    licenseNote:
      'Creative Commons Attribution 4.0 International (CC BY 4.0). The paper may be shared with attribution. It is cited here by reference, and nothing from it — text, figures, tables or data — is reproduced.',
  },
  {
    id: 'dosovitskiy-2020-vit',
    authors:
      'Alexey Dosovitskiy, Lucas Beyer, Alexander Kolesnikov, Dirk Weissenborn, Xiaohua Zhai, Thomas Unterthiner, Mostafa Dehghani, Matthias Minderer, Georg Heigold, Sylvain Gelly, Jakob Uszkoreit, Neil Houlsby',
    year: 2020,
    title: 'An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale',
    venue: 'arXiv:2010.11929 [cs.CV] / ICLR 2021',
    url: 'https://arxiv.org/abs/2010.11929',
    usedFor: 'The patch embeddings: the image cut into patches, and the patches treated as the tokens of a transformer.',
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
      'The seeded random number generator, the linear algebra, the statistics and the assessment engine.',
    licenseNote: 'Original work, released under the MIT licence.',
  },
]

export const LICENCE_SUMMARY = {
  source:
    'The course is written from the works above and cites them by section. The papers are not redistributed, and no image, dataset, model or figure from any of them is used or redistributed.',
  figures:
    'Every figure in this course is an original plot of a computation made in the browser from the algorithms in the course’s own code. No figure, table or image from any source is reproduced.',
  code:
    'The algorithms are original implementations written for this course: the synthetic image–caption pairs, the contrastive loss and its gradient, the temperature sweep, the retrieval, the modality gap, the zero-shot classifier, the instruction tax, the projection and the caption-derived instruction data, the sigmoid loss with its scale and bias, the frozen bridge and its parameter accounting, and the resampler with its token bound.',
  data:
    'No dataset is redistributed and no dataset is downloaded. The pairs, the classes and the instructions are all generated by the course’s own code, with the seed shown.',
  models:
    'No trained model is redistributed and no model is downloaded. The encoders here are matrices, trained in your browser, from scratch, every time you change a setting.',
} as const
