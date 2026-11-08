/**
 * The course curriculum.
 *
 * The primary source is
 *
 *   A. Radford, J. Kim, C. Hallacy et al.,
 *   "Learning Transferable Visual Models From Natural Language Supervision",
 *   arXiv:2103.00020 [cs.CV] / ICML 2021.
 *
 * Two further papers carry the rest of the course:
 *
 *   J. Alayrac et al., "Flamingo: a Visual Language Model for Few-Shot
 *   Learning", arXiv:2204.14198 [cs.CV] / NeurIPS 2022;
 *
 *   H. Liu, C. Li, Y. Wu et al., "Visual Instruction Tuning",
 *   arXiv:2304.08485 [cs.CV] / NeurIPS 2023.
 *
 * And three papers carry the later module:
 *
 *   X. Zhai, B. Mustafa, A. Kolesnikov, L. Beyer, "Sigmoid Loss for Language
 *   Image Pre-Training", arXiv:2303.15343 [cs.CV] / ICCV 2023;
 *
 *   J. Li, D. Li, S. Savarese, S. Hoi, "BLIP-2: Bootstrapping Language-Image
 *   Pre-training with Frozen Image Encoders and Large Language Models",
 *   arXiv:2301.12597 [cs.CV] / ICML 2023;
 *
 *   A. Dosovitskiy et al., "An Image is Worth 16x16 Words: Transformers for
 *   Image Recognition at Scale", arXiv:2010.11929 [cs.CV] / ICLR 2021.
 *
 * The section map below is built from those works, and the test suite
 * refuses a lesson that cites a section which is not in it.
 */

import type { LessonMeta, ModuleMeta, SourceRef } from '@llm-materials/course-core'

export type { LessonMeta, ModuleMeta, SourceRef }

export const SOURCES = {
  clip: {
    id: 'radford-2021-clip',
    title: 'Learning Transferable Visual Models From Natural Language Supervision',
    authors: 'Alec Radford, Jong Wook Kim, Chris Hallacy, Aditya Ramesh, Gabriel Goh, Sandhini Agarwal and others',
    year: 2021,
    venue: 'arXiv:2103.00020 [cs.CV] / ICML 2021',
    url: 'https://arxiv.org/abs/2103.00020',
  },
  flamingo: {
    id: 'alayrac-2022-flamingo',
    title: 'Flamingo: a Visual Language Model for Few-Shot Learning',
    authors: 'Jean-Baptiste Alayrac, Jeff Donahue, Pauline Luc, Antoine Miech, Iain Barr, Yana Hasson and others',
    year: 2022,
    venue: 'arXiv:2204.14198 [cs.CV] / NeurIPS 2022',
    url: 'https://arxiv.org/abs/2204.14198',
  },
  llava: {
    id: 'liu-2023-llava',
    title: 'Visual Instruction Tuning',
    authors: 'Haotian Liu, Chunyuan Li, Qingyang Wu, Yong Jae Lee',
    year: 2023,
    venue: 'arXiv:2304.08485 [cs.CV] / NeurIPS 2023',
    url: 'https://arxiv.org/abs/2304.08485',
  },
  siglip: {
    id: 'zhai-2023-siglip',
    title: 'Sigmoid Loss for Language Image Pre-Training',
    authors: 'Xiaohua Zhai, Basil Mustafa, Alexander Kolesnikov, Lucas Beyer',
    year: 2023,
    venue: 'arXiv:2303.15343 [cs.CV] / ICCV 2023',
    url: 'https://arxiv.org/abs/2303.15343',
  },
  blip2: {
    id: 'li-2023-blip2',
    title: 'BLIP-2: Bootstrapping Language-Image Pre-training with Frozen Image Encoders and Large Language Models',
    authors: 'Junnan Li, Dongxu Li, Silvio Savarese, Steven Hoi',
    year: 2023,
    venue: 'arXiv:2301.12597 [cs.CV] / ICML 2023',
    url: 'https://arxiv.org/abs/2301.12597',
  },
  vit: {
    id: 'dosovitskiy-2020-vit',
    title: 'An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale',
    authors: 'Alexey Dosovitskiy, Lucas Beyer, Alexander Kolesnikov, Dirk Weissenborn, Xiaohua Zhai, Thomas Unterthiner and others',
    year: 2020,
    venue: 'arXiv:2010.11929 [cs.CV] / ICLR 2021',
    url: 'https://arxiv.org/abs/2010.11929',
  },
} as const

/** The section map of the sources this course cites. */
export const SECTION_MAP: Record<string, { title: string; note: string }> = {
  'clip:1': { title: 'Introduction', note: 'The claim: natural language is a supervision signal for vision, at the scale of the internet.' },
  'clip:2': { title: 'Method', note: 'The contrastive objective, the encoders, and the precomputation that makes the index affordable.' },
  'clip:2.1': { title: 'The contrastive objective', note: 'The loss, the in-batch negatives, and the temperature.' },
  'clip:3': { title: 'Results', note: 'The zero-shot transfer, and the size of the pretraining dataset.' },
  'flamingo:2': {
    title: 'The method',
    note: 'The visual encoder, the Perceiver Resampler that bounds the token count, and the interleaved sequence.',
  },
  'flamingo:3': { title: 'The results', note: 'The few-shot benchmarks, and what the method transfers to.' },
  'llava:2': { title: 'The method', note: 'Instruction tuning on visual data, and the three stages of the recipe.' },
  'llava:3': { title: 'The results', note: 'The benchmarks, and the effect of the data mixtures.' },
  'siglip:3.1': {
    title: 'The sigmoid loss',
    note: 'The pairwise logistic loss, and the removal of the softmax’s normalisation over the batch.',
  },
  'siglip:4.8': {
    title: 'The negative-to-positive ratio',
    note: 'What happens to the loss as the unmatched pairs outweigh the matched ones.',
  },
  'siglip:4.9': {
    title: 'The bias term',
    note: 'The learned bias, and the initialisation that matches it to the size of the batch.',
  },
  'blip2:3.1': {
    title: 'The model architecture',
    note: 'The frozen image encoder, the learned queries of the Q-Former, and the frozen language model.',
  },
  'blip2:3.2': {
    title: 'Learning with the frozen image encoder',
    note: 'The queries are trained to read the encoder’s patch tokens, and the encoder is not.',
  },
  'blip2:3.3': {
    title: 'Generating with the frozen language model',
    note: 'The bridge is trained to present the image to a language model that is not trained at all.',
  },
  'vit:3.1': {
    title: 'The vision transformer',
    note: 'The image is cut into patches, and the patches are the tokens.',
  },
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'contrastive',
    chapter: 2,
    title: 'Contrastive Pretraining',
    tagline: 'Two encoders, one space, and no labels at all',
    summary:
      'The loss that says a pair should be closer than the other pairs in the batch, the temperature that decides how sharp it is, and the data that pays for it.',
    accent: 'indigo',
    outcomes: [
      'State the contrastive objective and say what the in-batch negatives are for',
      'Explain what the temperature does, and why it is a decision rather than a constant',
      'Measure how the retrieval improves with the batch size and with the data',
    ],
  },
  {
    id: 'the-modality-gap',
    chapter: 3,
    title: 'The Modality Gap',
    tagline: 'Two spaces that are close, and not the same space',
    summary:
      'The images and the captions end up in one space, and the space is not quite symmetric. The gap, and the zero-shot classifier that works anyway.',
    accent: 'teal',
    outcomes: [
      'Define the modality gap and say how it is measured',
      'Describe the zero-shot classifier, and the part the prompt plays in it',
      'Explain why the classifier works at all, given the gap',
    ],
  },
  {
    id: 'instruction',
    chapter: 2,
    title: 'Instruction Tuning',
    tagline: 'Getting better at instructions, and what it costs',
    summary:
      'The recipe that turns a model into an assistant, and the tax it pays on everything it was good at before.',
    accent: 'amber',
    outcomes: [
      'Describe the three stages of the recipe',
      'Measure the alignment tax, and say what it is a tax on',
      'Explain why the tax is a fact about training rather than a defect of the method',
    ],
  },
  {
    id: 'the-loss',
    chapter: 4,
    title: 'The Loss and the Bridge',
    tagline: 'What the objective normalises, and what the method holds still',
    summary:
      'Two later answers to the same recipe: a loss that decides each pair on its own, an architecture that freezes both towers and trains only the small part between them, and a resampler that bounds the visual token count.',
    accent: 'rose',
    outcomes: [
      'Say what the softmax normalises, and show that the sigmoid loss does not normalise it',
      'Measure the coupling between a pair and the rest of its batch',
      'Say what is trained in a frozen-encoder bridge, and read its parameter bill',
      'Explain how a fixed set of latents bounds the number of visual tokens',
    ],
  },
]

export const LESSONS: LessonMeta[] = [
  {
    id: 'the-contrastive-objective',
    moduleId: 'contrastive',
    number: 1,
    title: 'The contrastive objective',
    subtitle: 'What the loss says, and who provides the negatives',
    minutes: 28,
    objectives: [
      'State the objective in words and write the loss',
      'Explain where the negatives come from and what they cost',
      'Say what the temperature does to the loss',
    ],
    keyIdeas: [
      'The loss asks for the paired image and caption to be closer than the other pairs in the batch.',
      'The negatives are the other pairs in the batch, and they are free.',
      'The temperature decides how sharp the distribution over the batch is.',
    ],
    interactive: {
      lab: 'contrastive',
      view: 'loss',
      title: 'Train the contrastive model',
      description: 'The loss, the gradient, and the retrieval, with the temperature and the batch size exposed.',
    },
    prerequisites: [],
    glossaryTerms: ['contrastive-loss', 'in-batch-negative', 'temperature'],
    quizIds: ['q-clip-1', 'q-clip-2', 'q-gap-defined', 'q-clip-4'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'clip:2.1',
        title: 'The contrastive objective',
        note: 'The loss, the in-batch negatives, and the temperature.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-data-and-the-batch',
    moduleId: 'contrastive',
    number: 2,
    title: 'The data and the batch',
    subtitle: 'What the scale of the pretraining buys',
    minutes: 24,
    objectives: [
      'Say what the number of pairs does to the retrieval',
      'Explain why a larger batch gives more negatives and a better estimate',
      'Describe the precomputation that makes the index affordable',
    ],
    keyIdeas: [
      'More pairs is more supervision, and the retrieval improves with it.',
      'A larger batch is more negatives for the same cost, and a better estimate.',
      'The document vectors never change, so the index is a matrix and the search is a matrix product.',
    ],
    interactive: {
      lab: 'contrastive',
      view: 'data',
      title: 'Scale the batch and the data',
      description: 'The retrieval against the batch size and against the number of pairs.',
    },
    prerequisites: ['the-contrastive-objective'],
    glossaryTerms: ['in-batch-negative', 'retrieval'],
    quizIds: ['q-clip-3', 'q-batch-negatives'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'clip:3',
        title: 'Results',
        note: 'The zero-shot transfer, and the size of the pretraining dataset.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-modality-gap',
    moduleId: 'the-modality-gap',
    number: 3,
    title: 'The modality gap',
    subtitle: 'One space, and a seam down the middle of it',
    minutes: 24,
    objectives: [
      'Define the gap and say how it is measured',
      'Explain what it means for a retrieval that works',
      'Say what closing it would cost',
    ],
    keyIdeas: [
      'The images and the captions end up in one space, but the two halves are further apart than either half is from itself.',
      'A retrieval works anyway, because the *pairs* are close even though the *spaces* are not.',
      'So the gap is a property of the representation, not a failure of the method.',
    ],
    interactive: {
      lab: 'contrastive',
      view: 'gap',
      title: 'Measure the gap',
      description: 'The within-modal and the between-modal similarities, and the gap between them.',
    },
    prerequisites: ['the-contrastive-objective'],
    glossaryTerms: ['modality-gap', 'embedding-space'],
    quizIds: ['q-gap-1'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'clip:2',
        title: 'Method',
        note: 'The encoders, and the precomputation that makes the index affordable.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'zero-shot',
    moduleId: 'the-modality-gap',
    number: 4,
    title: 'Zero-shot',
    subtitle: 'Classifying with the class names and nothing else',
    minutes: 26,
    objectives: [
      'Describe the zero-shot classifier and why it works at all',
      'Say what part the prompt plays, and measure what it is worth',
      'Explain the connection to the retrieval the model was trained for',
    ],
    keyIdeas: [
      'The class names are embedded with the text encoder, and the image is assigned to the closest of them.',
      'The model was never trained to classify; it was trained to match a caption, and the class names are captions.',
      'The prompt is part of the method, and a different template gives a different score.',
    ],
    interactive: {
      lab: 'contrastive',
      view: 'zeroshot',
      title: 'Classify with the names',
      description: 'The zero-shot accuracy, and what each prompt template is worth.',
    },
    prerequisites: ['the-modality-gap'],
    glossaryTerms: ['zero-shot', 'prompt-template'],
    quizIds: ['q-gap-2', 'q-zero-shot-prompt'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'clip:3',
        title: 'Results',
        note: 'The zero-shot transfer, and the prompts it is measured with.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-instruction-recipe',
    moduleId: 'instruction',
    number: 5,
    title: 'The instruction recipe',
    subtitle: 'Three stages, and what each one is for',
    minutes: 24,
    objectives: [
      'Describe the three stages of the recipe',
      'Say what the visual instruction tuning adds to it',
      'Explain why the stages are in that order',
      'Say what the projection changes about a visual token, and what it costs',
    ],
    keyIdeas: [
      'The stages are: align the model to instructions, then teach it to read images, then tune it on visual instructions.',
      'Each stage is a different kind of data, and the order is what makes the last one work.',
      'The projection is a learned linear map from the vision width to the language width; it changes the width of a token, not its count.',
      'The model that comes out is a different model from the one that went in.',
    ],
    interactive: {
      lab: 'instruction',
      view: 'recipe',
      title: 'Run the recipe',
      description: 'The gain on the instructions and the tax on everything else, as the tuning is strengthened.',
    },
    prerequisites: ['zero-shot'],
    glossaryTerms: ['instruction-tuning', 'alignment-tax'],
    quizIds: ['q-instruction-1', 'q-llava-projection', 'q-instruction-3'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'llava:2',
        title: 'The method',
        note: 'Instruction tuning on visual data, and the three stages of the recipe.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-alignment-tax',
    moduleId: 'instruction',
    number: 6,
    title: 'The alignment tax',
    subtitle: 'What the tuning takes away',
    minutes: 24,
    objectives: [
      'Define the alignment tax and say what it is measured on',
      'Measure the gain and the tax, and the ratio between them',
      'Explain why the tax is a fact about training and not a defect of the method',
    ],
    keyIdeas: [
      'Tuning on instructions makes the model better at instructions and slightly worse at what it was good at.',
      'The tax is a measurement on the original task, before and after — not a claim.',
      'And it is a consequence of the training, which means it is something the training can be made to avoid.',
    ],
    interactive: {
      lab: 'instruction',
      view: 'tax',
      title: 'Pay the tax',
      description: 'The gain, the tax, and the ratio between them.',
    },
    prerequisites: ['the-instruction-recipe'],
    glossaryTerms: ['alignment-tax', 'instruction-tuning'],
    quizIds: ['q-instruction-2', 'q-tax-fact'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'llava:3',
        title: 'The results',
        note: 'The benchmarks, and the effect of the data mixtures on what the model keeps.',
      },
      {
        chapter: 2,
        section: 'flamingo:2',
        title: 'The method',
        note: 'The interleaved sequence, and the few-shot learning it buys.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-sigmoid-loss',
    moduleId: 'the-loss',
    number: 7,
    title: 'The sigmoid loss',
    subtitle: 'One decision per pair, and no denominator',
    minutes: 26,
    objectives: [
      'Say what the softmax normalises and what that couples together',
      'Read the same row of a batch under both losses',
      'Explain what the bias balances, and why its value depends on the batch',
    ],
    keyIdeas: [
      'The softmax turns each row of the batch into a distribution, so one pair’s loss depends on every other pair.',
      'The sigmoid loss is a sum of independent pair decisions, and a pair’s loss is a function of that pair alone.',
      'The bias is the count of negatives, written as a probability; it is learned, but its starting point is a fact about the batch.',
    ],
    interactive: {
      lab: 'sigmoid',
      view: 'coupling',
      title: 'Break the coupling',
      description: 'Append unrelated pairs to the batch and watch one loss move while the other does not.',
    },
    prerequisites: ['the-contrastive-objective'],
    glossaryTerms: ['sigmoid-loss', 'coupling', 'logit-bias'],
    quizIds: ['q-siglip-1', 'q-siglip-2', 'q-siglip-3'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'siglip:3.1',
        title: 'The sigmoid loss',
        note: 'The pairwise logistic loss, and the removal of the normalisation over the batch.',
      },
      {
        chapter: 4,
        section: 'siglip:4.8',
        title: 'The negative-to-positive ratio',
        note: 'What the loss does as the unmatched pairs come to outnumber the matched ones.',
      },
      {
        chapter: 4,
        section: 'siglip:4.9',
        title: 'The bias term',
        note: 'The learned bias, and the initialisation that matches it to the size of the batch.',
      },
    ],
    furtherReading: [
      {
        label: 'Zhai et al., “Sigmoid Loss for Language Image Pre-Training”',
        href: 'https://arxiv.org/abs/2303.15343',
        note: 'the paper this lesson is built on; the loss and the batch experiments are in §3 and §4.',
      },
    ],
  },
  {
    id: 'the-frozen-bridge',
    moduleId: 'the-loss',
    number: 8,
    title: 'The frozen bridge',
    subtitle: 'Patches, queries, and the towers that do not move',
    minutes: 28,
    objectives: [
      'Say what the image encoder, the queries and the language model each do',
      'Explain why the patch tokens exist, and what a learned query reads from them',
      'Read the parameter bill of the bridge, and the share of it that is trained',
    ],
    keyIdeas: [
      'A vision transformer cuts the image into patches and treats each patch as a token, which is what lets an image encoder be a transformer at all.',
      'BLIP-2 keeps both towers frozen and trains a small set of queries to read the patch tokens and present them to the language model.',
      'Freezing means the towers contribute most of the parameters and none of the gradient; the trainable share is the number the method is selling.',
    ],
    interactive: {
      lab: 'frozen',
      view: 'attention',
      title: 'Read the patches',
      description: 'A learned query over the patch tokens, and the parameter bill of the bridge that carries it.',
    },
    prerequisites: ['the-contrastive-objective'],
    glossaryTerms: ['patch-token', 'frozen-encoder', 'q-former'],
    quizIds: ['q-blip2-1', 'q-blip2-2'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'blip2:3.1',
        title: 'The model architecture',
        note: 'The frozen encoder, the Q-Former’s learned queries, and the frozen language model.',
      },
      {
        chapter: 3,
        section: 'blip2:3.2',
        title: 'Learning with the frozen image encoder',
        note: 'The queries are trained to read the encoder’s tokens, and the encoder is not trained at all.',
      },
      {
        chapter: 3,
        section: 'vit:3.1',
        title: 'The vision transformer',
        note: 'The image is cut into patches, and the patches are the tokens.',
      },
    ],
    furtherReading: [
      {
        label: 'Li et al., “BLIP-2”',
        href: 'https://arxiv.org/abs/2301.12597',
        note: 'the Q-Former, the two pre-training stages, and the frozen towers.',
      },
      {
        label: 'Dosovitskiy et al., “An Image is Worth 16x16 Words”',
        href: 'https://arxiv.org/abs/2010.11929',
        note: 'the patch embedding that every vision transformer in this course is built on.',
      },
    ],
  },
  {
    id: 'the-resampler',
    moduleId: 'the-loss',
    number: 9,
    title: 'The resampler',
    subtitle: 'A fixed number of vectors for a variable number of tokens',
    minutes: 24,
    objectives: [
      'Say what the resampler’s latents read, and what the output length is',
      'Explain why the output length is bounded by the latents and not by the image',
      'Compare the cost of cross-attention on the latents with attention over every token',
    ],
    keyIdeas: [
      'A resampler is a fixed set of learned latents attending to a variable number of visual tokens; one vector comes out per latent.',
      'The output length is therefore the number of latents, whatever the resolution or the number of images: the bound is structural, not a truncation.',
      'The cross-attention costs latents × tokens work, where attention over the raw tokens would cost tokens squared.',
    ],
    interactive: {
      lab: 'resampler',
      view: 'bound',
      title: 'Bound the tokens',
      description: 'The visual token count at four resolutions, and the fixed number of vectors that come out.',
    },
    prerequisites: ['the-frozen-bridge'],
    glossaryTerms: ['resampler', 'patch-token', 'frozen-encoder'],
    quizIds: ['q-flamingo-1', 'q-flamingo-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'flamingo:2',
        title: 'The method',
        note: 'The visual encoder, the Perceiver Resampler, and the fixed number of latents it presents to the language model.',
      },
    ],
    furtherReading: [
      {
        label: 'Alayrac et al., “Flamingo”',
        href: 'https://arxiv.org/abs/2204.14198',
        note: 'the resampler, the interleaved sequence, and the few-shot learning it buys.',
      },
    ],
  },
]

/** The lessons of a module, in order. */
export function lessonsOfModule(moduleId: string): LessonMeta[] {
  return LESSONS.filter((lesson) => lesson.moduleId === moduleId)
}

/** A lesson by its id. */
export function lessonById(id: string): LessonMeta | undefined {
  return LESSONS.find((lesson) => lesson.id === id)
}

/** A module by its id. */
export function moduleById(id: string): ModuleMeta | undefined {
  return MODULES.find((module) => module.id === id)
}
