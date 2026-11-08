/**
 * The course curriculum.
 *
 * The primary source is
 *
 *   P. Lewis, E. Perez, A. Piktus et al.,
 *   "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
 *   arXiv:2005.11401 [cs.CL] / NeurIPS 2020.
 *
 * Three further papers carry the rest of the course:
 *
 *   V. Karpukhin, B. Oguz, S. Min et al.,
 *   "Dense Passage Retrieval for Open-Domain Question Answering",
 *   arXiv:2004.04906 [cs.CL] / EMNLP 2020;
 *
 *   O. Khattab, L. Deng, D. Xiong et al.,
 *   "ColBERT: Efficient and Effective Passage Search via Contextualized Late
 *   Interaction over BERT", arXiv:2004.12832 [cs.IR] / SIGIR 2020;
 *
 *   N. F. Liu et al., "Lost in the Middle: How Language Models Use Long
 *   Contexts", arXiv:2307.03172 [cs.CL] / TACL 2024.
 *
 * The section map below is built from those four works, and the test suite
 * refuses a lesson that cites a section which is not in it.
 */

import type { LessonMeta, ModuleMeta, SourceRef } from '@llm-materials/course-core'

export type { LessonMeta, ModuleMeta, SourceRef }

export const SOURCES = {
  rag: {
    id: 'lewis-2020-rag',
    title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
    authors: 'Patrick Lewis, Ethan Perez, Aleksandra Piktus, Fabio Petroni, Vladimir Karpukhin, Naman Goyal and others',
    year: 2020,
    venue: 'arXiv:2005.11401 [cs.CL] / NeurIPS 2020',
    url: 'https://arxiv.org/abs/2005.11401',
  },
  dpr: {
    id: 'karpukhin-2020-dpr',
    title: 'Dense Passage Retrieval for Open-Domain Question Answering',
    authors: 'Vladimir Karpukhin, Barlas Oğuz, Sewon Min, Patrick Lewis, Ledell Wu, Sergey Edunov and others',
    year: 2020,
    venue: 'arXiv:2004.04906 [cs.CL] / EMNLP 2020',
    url: 'https://arxiv.org/abs/2004.04906',
  },
  colbert: {
    id: 'khattab-2020-colbert',
    title: 'ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT',
    authors: 'Omar Khattab, Matei Zaharia',
    year: 2020,
    venue: 'arXiv:2004.12832 [cs.IR] / SIGIR 2020',
    url: 'https://arxiv.org/abs/2004.12832',
  },
  lost: {
    id: 'liu-2023-lost-middle',
    title: 'Lost in the Middle: How Language Models Use Long Contexts',
    authors: 'Nelson F. Liu, Kevin Lin, John Hewitt, Ashwin Paranjape, Michele Bevilacqua, Fabio Petroni and others',
    year: 2023,
    venue: 'arXiv:2307.03172 [cs.CL] / TACL 2024',
    url: 'https://arxiv.org/abs/2307.03172',
  },
} as const

/** The section map of the sources this course cites. */
export const SECTION_MAP: Record<string, { title: string; note: string }> = {
  'rag:1': { title: 'Introduction', note: 'The claim: parametric memory is a poor substitute for a retrieved document.' },
  'rag:2': { title: 'Retrieval', note: 'The retriever, the index, and the question of whether the retriever is the bottleneck.' },
  'rag:3': { title: 'Generation', note: 'The reader, the marginal utility of more passages, and the noise they add.' },
  'rag:3.1': { title: 'Marginal utility', note: 'How the reader’s use of the passages changes as more of them are added.' },
  'dpr:1': { title: 'Introduction', note: 'The case against lexical retrieval, and the dual-encoder alternative.' },
  'dpr:3': { title: 'The dense retriever', note: 'The encoder, the index, and the precomputation that makes it affordable.' },
  'dpr:4': { title: 'The training objective', note: 'The question–passage pairs, the in-batch negatives, and the contrastive loss.' },
  'colbert:1': { title: 'Introduction', note: 'The idea of comparing a question and a document token by token.' },
  'colbert:3': { title: 'Late interaction', note: 'The MaxSim scoring function, and the index it implies.' },
  'colbert:4': { title: 'Efficiency', note: 'The precomputation of the document vectors, and the cost of the index.' },
  'lost:1': { title: 'Introduction', note: 'The claim: a model’s use of a long context is not uniform.' },
  'lost:3': { title: 'The experiments', note: 'The multi-document and the key-value retrieval tasks, and the position effect.' },
  'lost:4': { title: 'The discussion', note: 'What the position effect means for the design of a retrieval-augmented system.' },
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'sparse',
    chapter: 2,
    title: 'Sparse Retrieval',
    tagline: 'Matching the words, exactly',
    summary:
      'The lexical index: what it stores, what it scores, and where it fails when the question and the answer use different words.',
    accent: 'indigo',
    outcomes: [
      'Describe the inverted index and what it costs',
      'Write the BM25 score and say what each of its two terms does',
      'Measure the recall of a lexical retriever, and say when it fails',
    ],
  },
  {
    id: 'dense',
    chapter: 3,
    title: 'Dense Retrieval',
    tagline: 'Matching the meaning, approximately',
    summary:
      'The learned embedding: how a question and a document are put in the same space, how the space is learned, and what the contrastive objective rewards.',
    accent: 'teal',
    outcomes: [
      'Describe the dual encoder and why the document vectors can be precomputed',
      'State the contrastive objective and say what the in-batch negatives are for',
      'Measure a dense retriever’s recall against the lexical one’s',
    ],
  },
  {
    id: 'late',
    chapter: 3,
    title: 'Late Interaction',
    tagline: 'Token by token, and the index it costs',
    summary:
      'The MaxSim score: a question and a document compared word by word, the price of storing a vector per word, and the length bias that comes with it.',
    accent: 'amber',
    outcomes: [
      'Write the MaxSim score and say what it compares',
      'Explain why the index is far larger, and measure how much larger',
      'Measure the length bias of the score, and what the normalisation does to it',
    ],
  },
  {
    id: 'the-long-context',
    chapter: 4,
    title: 'The Long Context',
    tagline: 'Where the evidence is put, and whether it is used',
    summary:
      'The retrieval-augmented reader, the position effect, and the argument that a long context is not a substitute for a good retriever.',
    accent: 'emerald',
    outcomes: [
      'Describe the retrieval-augmented reader and what it changes',
      'Measure how a reader’s use of a document depends on where the document is',
      'Compare a long-context reader with one that is given the evidence by retrieval',
    ],
  },
]

export const LESSONS: LessonMeta[] = [
  {
    id: 'the-lexical-index',
    moduleId: 'sparse',
    number: 1,
    title: 'The lexical index',
    subtitle: 'What a lexical retriever stores',
    minutes: 22,
    objectives: [
      'Describe the inverted index, and say what it costs',
      'Explain why the index can be precomputed and the query cannot',
      'Say what a lexical retriever is matching',
    ],
    keyIdeas: [
      'The index maps each word to the documents that contain it.',
      'The size of the index is the number of postings, and that is what a lexical search really spends.',
      'A lexical retriever matches words, and it is blind to everything else.',
    ],
    interactive: {
      lab: 'sparse',
      view: 'index',
      title: 'Look at the index',
      description: 'The postings of the corpus, and the size of the index.',
    },
    prerequisites: [],
    glossaryTerms: ['retrieval', 'inverted-index', 'lexical-match'],
    quizIds: ['q-sparse-1'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'rag:2',
        title: 'Retrieval',
        note: 'The retriever, the index, and the question of whether the retriever is the bottleneck.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'bm25',
    moduleId: 'sparse',
    number: 2,
    title: 'BM25',
    subtitle: 'Two terms doing all the work',
    minutes: 26,
    objectives: [
      'Write the BM25 score and say what the two parameters do',
      'Explain the inverse document frequency and the length normalisation',
      'Measure the recall, and see where the lexical retriever fails',
    ],
    keyIdeas: [
      'The inverse document frequency says how rare a word is; the saturation says how much of a match is coincidence.',
      'The length normalisation says how much of a document had to be read to get the match.',
      'A lexical retriever cannot find an answer that uses different words — and most answers do.',
    ],
    interactive: {
      lab: 'sparse',
      view: 'bm25',
      title: 'Score the documents',
      description: 'The BM25 score of every document, and the recall it achieves.',
    },
    prerequisites: ['the-lexical-index'],
    glossaryTerms: ['bm25', 'inverse-document-frequency', 'recall'],
    quizIds: ['q-sparse-2', 'q-sparse-3', 'q-bm25-three'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'rag:2',
        title: 'Retrieval',
        note: 'The retrieval stage of the pipeline, and the index it needs.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-learned-embedding',
    moduleId: 'dense',
    number: 3,
    title: 'The learned embedding',
    subtitle: 'A question and a document in the same space',
    minutes: 26,
    objectives: [
      'Describe the dual encoder and what it embeds',
      'Explain why the document vectors can be precomputed and the question’s cannot',
      'Say what a single vector loses, and what it buys',
    ],
    keyIdeas: [
      'The retriever embeds the question and the document separately and compares the two vectors.',
      'The document vectors never change, so the index is a matrix and the search is a matrix product.',
      'One vector per document is cheap; one vector per token is not.',
    ],
    interactive: {
      lab: 'dense',
      view: 'encoder',
      title: 'Embed and compare',
      description: 'The embedding of a question and of a document, and the score between them.',
    },
    prerequisites: ['bm25'],
    glossaryTerms: ['dense-retrieval', 'dual-encoder', 'embedding'],
    quizIds: ['q-dense-1', 'q-dpr-paraphrase'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'dpr:3',
        title: 'The dense retriever',
        note: 'The encoder, the index, and the precomputation that makes it affordable.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-contrastive-objective',
    moduleId: 'dense',
    number: 4,
    title: 'The contrastive objective',
    subtitle: 'What the embedding is trained to do',
    minutes: 28,
    objectives: [
      'State the contrastive objective in words',
      'Say what the in-batch negatives are, and why they are nearly free',
      'Compare the trained retriever with the lexical one on the same questions',
    ],
    keyIdeas: [
      'The objective is that a question should be closer to its own answer than to the other answers in the batch.',
      'The other answers in the batch are free negatives, and they are what makes the training cheap.',
      'The learned retriever beats the lexical one exactly where the lexical one is blind: the mismatch of words.',
    ],
    interactive: {
      lab: 'dense',
      view: 'training',
      title: 'Train the retriever',
      description: 'The training curve, and the recall of the trained retriever against the lexical one.',
    },
    prerequisites: ['the-learned-embedding'],
    glossaryTerms: ['contrastive-objective', 'negative-example', 'in-batch-negative'],
    quizIds: ['q-dense-2', 'q-dpr-negatives'],
    sourceRefs: [
      {
        chapter: 4,
        section: 'dpr:4',
        title: 'The training objective',
        note: 'The question–passage pairs, the in-batch negatives, and the contrastive loss.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-maxsim-score',
    moduleId: 'late',
    number: 5,
    title: 'The MaxSim score',
    subtitle: 'Comparing a question and a document word by word',
    minutes: 26,
    objectives: [
      'Write the MaxSim score and say what it compares',
      'Explain what the late interaction buys over a single vector',
      'Measure the length bias of the score',
    ],
    keyIdeas: [
      'The score is the sum, over the question’s words, of the best-matching word of the document.',
      'The document’s vectors can still be precomputed, so the search is still cheap — but there are far more of them.',
      'The maximum is taken over more candidates in a longer document, and the score inherits that bias.',
    ],
    interactive: {
      lab: 'late',
      view: 'maxsim',
      title: 'Compare word by word',
      description: 'The MaxSim score of every document, and the length bias it carries.',
    },
    prerequisites: ['the-learned-embedding'],
    glossaryTerms: ['late-interaction', 'maxsim', 'length-bias', 'multi-hop'],
    quizIds: ['q-late-1', 'q-late-2', 'q-colbert-per-token'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'colbert:3',
        title: 'Late interaction',
        note: 'The MaxSim scoring function, and the index it implies.',
      },
      {
        chapter: 4,
        section: 'colbert:4',
        title: 'Efficiency',
        note: 'The precomputation of the document vectors, and the cost of the index.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-retrieval-augmented-reader',
    moduleId: 'the-long-context',
    number: 6,
    title: 'The retrieval-augmented reader',
    subtitle: 'What the retrieval is for',
    minutes: 24,
    objectives: [
      'Describe the retrieval-augmented reader and what it changes about the model',
      'Explain the claim that parametric memory is a poor substitute for a retrieved document',
      'Say what the marginal utility of an extra passage is',
    ],
    keyIdeas: [
      'The retriever supplies the facts and the reader supplies the reasoning.',
      'More passages help until the noise in them starts to cost more than the facts are worth.',
      'The evidence has to be used, not merely present.',
    ],
    interactive: {
      lab: 'context',
      view: 'reader',
      title: 'Read with the evidence',
      description: 'The reader, with the evidence retrieved for it and with the evidence lost.',
    },
    prerequisites: ['the-contrastive-objective'],
    glossaryTerms: ['reader', 'retrieval-augmented-generation', 'marginal-utility', 'parametric-memory', 'non-parametric-memory'],
    quizIds: ['q-context-1', 'q-reader-noise'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'rag:1',
        title: 'Introduction',
        note: 'The claim: parametric memory is a poor substitute for a retrieved document.' },
      {
        chapter: 3,
        section: 'rag:3',
        title: 'Generation',
        note: 'The reader, and the passages it is given.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'lost-in-the-middle',
    moduleId: 'the-long-context',
    number: 7,
    title: 'Lost in the middle',
    subtitle: 'A context is not a place',
    minutes: 26,
    objectives: [
      'Describe the position effect and what it measures',
      'Measure how a reader’s use of a document depends on where the document is',
      'Compare a long-context reader with one that is given the evidence by retrieval',
    ],
    keyIdeas: [
      'The evidence near the beginning and near the end of a context is used well; the evidence in the middle is not.',
      'So a long context is not a substitute for retrieval: it is a place where retrieved evidence can be lost.',
      'Putting the evidence where the reader looks is a design decision, and it is measurable.',
    ],
    interactive: {
      lab: 'context',
      view: 'position',
      title: 'Move the needle',
      description: 'A document in a context, moved from the beginning to the end, and the attention it receives.',
    },
    prerequisites: ['the-retrieval-augmented-reader'],
    glossaryTerms: ['position-effect', 'long-context', 'attention-prior'],
    quizIds: ['q-context-2', 'q-context-3'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'lost:1',
        title: 'Introduction',
        note: 'The claim: a model’s use of a long context is not uniform.' },
      {
        chapter: 3,
        section: 'lost:3',
        title: 'The experiments',
        note: 'The key-value retrieval task, and the position effect it measures.' },
      {
        chapter: 4,
        section: 'lost:4',
        title: 'The discussion',
        note: 'What the position effect means for the design of a retrieval-augmented system.' },
    ],
    furtherReading: [],
  },
  {
    id: 'what-retrieval-is-for',
    moduleId: 'the-long-context',
    number: 8,
    title: 'What retrieval is for',
    subtitle: 'And what a long context is not',
    minutes: 22,
    objectives: [
      'Put the two arguments together: the retriever finds the facts, and the reader has to use them',
      'Say what a long context changes and what it does not',
      'Measure the case: retrieval against a long context, on the same questions',
    ],
    keyIdeas: [
      'A long context raises the ceiling on what can be answered and lowers the floor on what is answered well.',
      'Retrieval is what puts the evidence where the reader will look at it.',
      'The two are not alternatives: the retriever decides what is in the context, and the reader decides whether it is used.',
    ],
    interactive: {
      lab: 'context',
      view: 'comparison',
      title: 'Compare the two',
      description: 'The long-context reader against the retrieval-augmented one, on the same questions.',
    },
    prerequisites: ['lost-in-the-middle'],
    glossaryTerms: ['retrieval-augmented-generation', 'position-effect'],
    quizIds: ['q-context-4'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'rag:3.1',
        title: 'Marginal utility',
        note: 'How the reader’s use of the passages changes as more of them are added.' },
    ],
    furtherReading: [],
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
