import type { BookChapter, BookPart, PartId } from '../types/curriculum'

/**
 * Source-accurate map of the textbook:
 *   Max van Duijn, Michiel van der Meer, Aske Plaat, Niki van Stein,
 *   "Agentic Large Language Models", arXiv:2610.13455v1 (9 Oct 2026).
 *
 * Part and chapter titles below are transcribed from the book's table of
 * contents; page numbers refer to the arXiv PDF.
 */

export const BOOK = {
  title: 'Agentic Large Language Models',
  authors: ['Max van Duijn', 'Michiel van der Meer', 'Aske Plaat', 'Niki van Stein'],
  arxivId: '2610.13455v1',
  arxivUrl: 'https://arxiv.org/abs/2610.13455',
  pdfFile: '2610.13455v1.pdf',
  license: 'CC0 1.0 Universal (arXiv listing)',
  publisher: 'AgenticLLMs course book, Leiden University (LIACS)',
} as const

export const PARTS: BookPart[] = [
  {
    id: 'part-1-language-modeling',
    order: 1,
    title: 'Language Modeling',
    chapters: [2, 3, 4, 5],
    summary:
      'How tokens become representations, how a model is pretrained, finetuned and aligned, how loss scales with compute, data and parameters, and how to build a small chat model end to end.',
    accent: 'cyan',
  },
  {
    id: 'part-2-reasoning',
    order: 2,
    title: 'Reasoning',
    chapters: [6, 7, 8],
    summary:
      'In-context learning, chain of thought, self-reflection harnesses, retrieval and long context, multi-modal vision-language-action models, world models and metalearning loops.',
    accent: 'violet',
  },
  {
    id: 'part-3-agents',
    order: 3,
    title: 'Agents',
    chapters: [9, 10],
    summary:
      'Historic agent traditions (robotic assistants, BDI, swarms), five agentic interaction styles, memory architectures for agents, and the BALROG reasoning/reflection case study.',
    accent: 'emerald',
  },
  {
    id: 'part-4-tools-assistants',
    order: 4,
    title: 'Tools and Assistants',
    chapters: [11, 12, 13, 14],
    summary:
      'Tool use architectures, Planner–Caller–Summarizer patterns, the Model Context Protocol, robustness and safety, retrieval-augmented generation, and assistant deployments.',
    accent: 'amber',
  },
  {
    id: 'part-5-behavior-cognition',
    order: 5,
    title: 'Behavior and Cognition',
    chapters: [15, 16, 17, 18],
    summary:
      'How to study LLM behavior experimentally: social competences, strategic play, theory of mind, moral judgment, role-based multi-agent systems, emergent behaviour and social simulation.',
    accent: 'rose',
  },
  {
    id: 'part-6-advanced',
    order: 6,
    title: 'Advanced Topics',
    chapters: [19, 20, 21, 22],
    summary:
      'Synthetic data generation and model collapse, advanced agentic architectures (in-context RL, self-modifying hyperagents, meta agents), mechanistic interpretability, and cognitive perspectives.',
    accent: 'violet',
  },
  {
    id: 'part-7-conclusion',
    order: 7,
    title: 'Conclusion',
    chapters: [23],
    summary:
      'Where agentic LLMs stand today, what the open technical and societal questions are, and how to keep studying and building responsibly.',
    accent: 'cyan',
  },
]

export const CHAPTERS: BookChapter[] = [
  { number: 1, title: 'Introduction', part: 'part-1-language-modeling', page: 15, isCaseStudy: false, isAdvanced: false },
  { number: 2, title: 'Foundations of Language Modeling', part: 'part-1-language-modeling', page: 29, isCaseStudy: false, isAdvanced: false },
  { number: 3, title: 'LLM Training Pipeline', part: 'part-1-language-modeling', page: 63, isCaseStudy: false, isAdvanced: false },
  { number: 4, title: 'Scaling Laws and Efficiency', part: 'part-1-language-modeling', page: 83, isCaseStudy: false, isAdvanced: false },
  { number: 5, title: 'Case Study 1: Building LLMs from Scratch', part: 'part-1-language-modeling', page: 111, isCaseStudy: true, isAdvanced: false },
  { number: 6, title: 'Multi-step Reasoning in LLMs', part: 'part-2-reasoning', page: 125, isCaseStudy: false, isAdvanced: false },
  { number: 7, title: 'Vision, Action and World Models', part: 'part-2-reasoning', page: 151, isCaseStudy: false, isAdvanced: false },
  { number: 8, title: 'Metalearning', part: 'part-2-reasoning', page: 181, isCaseStudy: false, isAdvanced: false },
  { number: 9, title: 'Interaction Styles for Agentic LLMs', part: 'part-3-agents', page: 193, isCaseStudy: false, isAdvanced: false },
  { number: 10, title: 'Case Study 2: Reasoning and Reflection', part: 'part-3-agents', page: 211, isCaseStudy: true, isAdvanced: false },
  { number: 11, title: 'How Agents Use Tools to Act in the World', part: 'part-4-tools-assistants', page: 227, isCaseStudy: false, isAdvanced: false },
  { number: 12, title: 'Search and Retrieval in Agentic LLMs', part: 'part-4-tools-assistants', page: 241, isCaseStudy: false, isAdvanced: false },
  { number: 13, title: 'From Tools to Assistants', part: 'part-4-tools-assistants', page: 263, isCaseStudy: false, isAdvanced: false },
  { number: 14, title: 'Case Study 3: Multi-Agent Diagnosis', part: 'part-4-tools-assistants', page: 277, isCaseStudy: true, isAdvanced: false },
  { number: 15, title: 'Studying Behavior of Agentic LLMs', part: 'part-5-behavior-cognition', page: 287, isCaseStudy: false, isAdvanced: false },
  { number: 16, title: 'Role-Based Interaction in Multi-LLM Systems', part: 'part-5-behavior-cognition', page: 317, isCaseStudy: false, isAdvanced: false },
  { number: 17, title: 'Emergent Behavior in Multi-LLM Systems', part: 'part-5-behavior-cognition', page: 335, isCaseStudy: false, isAdvanced: false },
  { number: 18, title: 'Case Study 4: Simulating Societies', part: 'part-5-behavior-cognition', page: 353, isCaseStudy: true, isAdvanced: false },
  { number: 19, title: '*Synthetic Data Generation', part: 'part-6-advanced', page: 363, isCaseStudy: false, isAdvanced: true },
  { number: 20, title: '*Advanced Agentic Architectures', part: 'part-6-advanced', page: 391, isCaseStudy: false, isAdvanced: true },
  { number: 21, title: '*Mechanistic Interpretability for LLM Agents', part: 'part-6-advanced', page: 403, isCaseStudy: false, isAdvanced: true },
  { number: 22, title: '*Cognitive Perspectives on Agentic LLMs', part: 'part-6-advanced', page: 423, isCaseStudy: false, isAdvanced: true },
  { number: 23, title: 'Future Directions for Agentic LLMs', part: 'part-7-conclusion', page: 461, isCaseStudy: false, isAdvanced: false },
]

export const PART_BY_ID = new Map<PartId, BookPart>(PARTS.map((part) => [part.id, part]))
export const CHAPTER_BY_NUMBER = new Map<number, BookChapter>(
  CHAPTERS.map((chapter) => [chapter.number, chapter]),
)

export function chapterTitle(n: number): string {
  const chapter = CHAPTER_BY_NUMBER.get(n)
  return chapter ? `Ch. ${n}: ${chapter.title}` : `Chapter ${n}`
}
