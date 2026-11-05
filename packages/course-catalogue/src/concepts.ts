/**
 * The concept index.
 *
 * A term taught in one course usually reappears in another: a *token* is
 * defined in the foundations course and used in the scaling and data courses;
 * a *scaling law* is defined in the scaling course and used in the data
 * course. The index is what turns a set of courses into a curriculum: it says
 * which idea a course is standing on, and where a reader can meet the same
 * idea again.
 *
 * The alignment is by concept id, and the ids are the ones the courses use in
 * their own glossaries where they share them. The index is deliberately
 * hand-written: it is a claim about teaching, and a claim about teaching is
 * not something to infer from string similarity.
 */

export interface Concept {
  id: string
  /** The name of the idea. */
  term: string
  /** One line: what the idea is. */
  summary: string
  /** The courses that teach it, in teaching order. */
  courses: string[]
  /** The kind of thing it is. */
  kind: 'concept' | 'method' | 'measurement' | 'mechanism'
}

export const CONCEPTS: Concept[] = [
  {
    id: 'token',
    term: 'Token',
    summary: 'The unit a model reads, and therefore the unit everything else is counted in.',
    kind: 'concept',
    courses: ['llm-foundations-lab', 'lm-from-scratch', 'scaling-lab', 'data-lab'],
  },
  {
    id: 'parameter',
    term: 'Parameter',
    summary: 'A weight the model learns, and the other half of the compute budget.',
    kind: 'concept',
    courses: ['lm-from-scratch', 'scaling-lab'],
  },
  {
    id: 'compute-budget',
    term: 'Compute budget',
    summary: 'The total training compute, which is what the data and the parameters are bought with.',
    kind: 'measurement',
    courses: ['scaling-lab', 'data-lab', 'rlhf-lab'],
  },
  {
    id: 'scaling-law',
    term: 'Scaling law',
    summary: 'A measured statement that a quantity follows a power of another.',
    kind: 'concept',
    courses: ['scaling-lab', 'deep-learning-theory-explorer'],
  },
  {
    id: 'generalisation',
    term: 'Generalisation',
    summary: 'What a model does on data it has not seen.',
    kind: 'concept',
    courses: ['deep-learning-theory-explorer', 'scaling-lab', 'evaluation-lab'],
  },
  {
    id: 'corpus',
    term: 'Corpus',
    summary: 'The collection of documents a model is trained on.',
    kind: 'concept',
    courses: ['llm-foundations-lab', 'data-lab', 'mech-interp-lab'],
  },
  {
    id: 'perplexity',
    term: 'Perplexity',
    summary: 'How surprised a language model is by a text.',
    kind: 'measurement',
    courses: ['llm-foundations-lab', 'data-lab', 'scaling-lab'],
  },
  {
    id: 'evaluation-metric',
    term: 'Evaluation metric',
    summary: 'The function that turns a model’s output into a score, and the shape of the curve it produces.',
    kind: 'measurement',
    courses: ['evaluation-lab', 'scaling-lab', 'rlhf-lab'],
  },
  {
    id: 'emergence',
    term: 'Emergence',
    summary: 'A measured score that appears suddenly rather than gradually.',
    kind: 'mechanism',
    courses: ['scaling-lab', 'llm-foundations-lab'],
  },
  {
    id: 'gradient',
    term: 'Gradient',
    summary: 'The direction in which the loss falls, and the thing every optimiser is built on.',
    kind: 'concept',
    courses: ['lm-from-scratch', 'rlhf-lab', 'deep-learning-theory-explorer'],
  },
  {
    id: 'distillation',
    term: 'Distillation',
    summary: 'Training a small model on a large model’s outputs.',
    kind: 'method',
    courses: ['rlhf-lab', 'llm-foundations-lab'],
  },
  {
    id: 'preference',
    term: 'Preference',
    summary: 'Which of two answers a human preferred, and what can be learned from that.',
    kind: 'concept',
    courses: ['rlhf-lab', 'evaluation-lab'],
  },
  {
    id: 'interpretability',
    term: 'Interpretability',
    summary: 'The attempt to say what a model computes, in terms a person can check.',
    kind: 'method',
    courses: ['mech-interp-lab', 'agentic-ai-academy', 'llm-foundations-lab'],
  },
  {
    id: 'causal-test',
    term: 'A causal test',
    summary: 'An intervention on a model, rather than a correlation with its inputs.',
    kind: 'method',
    courses: ['mech-interp-lab', 'evaluation-lab'],
  },
  {
    id: 'agent-loop',
    term: 'The agent loop',
    summary: 'The cycle of observation, thought, action and observation again.',
    kind: 'concept',
    courses: ['agentic-ai-academy', 'rlhf-lab'],
  },
  {
    id: 'noise-process',
    term: 'A noise process',
    summary: 'The corruption a generative model learns to undo.',
    kind: 'concept',
    courses: ['diffusion-lab', 'llm-foundations-lab'],
  },
  {
    id: 'licence',
    term: 'Data licence',
    summary: 'The terms under which a dataset may be used, and what a project may do with it.',
    kind: 'concept',
    courses: ['data-lab', 'llm-foundations-lab'],
  },
  {
    id: 'kv-cache',
    term: 'The key and value cache',
    summary: 'The stored keys and values of the tokens already generated.',
    kind: 'concept',
    courses: ['systems-lab', 'llm-foundations-lab'],
  },
  {
    id: 'arithmetic-intensity',
    term: 'Arithmetic intensity',
    summary: 'The operations a step does for each byte it moves.',
    kind: 'measurement',
    courses: ['systems-lab', 'scaling-lab'],
  },
  {
    id: 'tiling',
    term: 'Tiling',
    summary: 'Computing a large operation in blocks, so the blocks fit in fast memory.',
    kind: 'method',
    courses: ['systems-lab'],
  },
  {
    id: 'mdp',
    term: 'A Markov decision process',
    summary: 'States, actions, a reward function and a transition kernel, with the Markov property.',
    kind: 'concept',
    courses: ['rl-foundations', 'rlhf-lab'],
  },
  {
    id: 'policy-gradient',
    term: 'The policy gradient',
    summary: 'The gradient of the expected return, as an expectation of something the agent can measure while acting.',
    kind: 'concept',
    courses: ['rl-foundations', 'rlhf-lab'],
  },
  {
    id: 'baseline',
    term: 'The baseline',
    summary: 'A function of the state subtracted from the return, which leaves the expectation alone.',
    kind: 'method',
    courses: ['rl-foundations', 'rlhf-lab'],
  },
  {
    id: 'retrieval',
    term: 'Retrieval',
    summary: 'Finding the documents that are worth reading.',
    kind: 'concept',
    courses: ['retrieval-lab', 'llm-foundations-lab', 'agentic-ai-academy'],
  },
  {
    id: 'bm25',
    term: 'BM25',
    summary: 'The score that most lexical retrieval still uses.',
    kind: 'method',
    courses: ['retrieval-lab'],
  },
  {
    id: 'position-effect',
    term: 'The position effect',
    summary: 'Where a document sits in the context changes how much of it is used.',
    kind: 'mechanism',
    courses: ['retrieval-lab', 'llm-foundations-lab'],
  },
  {
    id: 'benchmark',
    term: 'A benchmark',
    summary: 'A set of tasks, and a rule that decides whether each was solved.',
    kind: 'concept',
    courses: ['agent-bench-lab', 'evaluation-lab'],
  },
  {
    id: 'verifier',
    term: 'The verifier',
    summary: 'The thing that decides whether a task was solved.',
    kind: 'mechanism',
    courses: ['agent-bench-lab', 'evaluation-lab'],
  },
  {
    id: 'contamination',
    term: 'Contamination',
    summary: 'The model has already seen the task, or its answer.',
    kind: 'mechanism',
    courses: ['agent-bench-lab', 'data-lab', 'evaluation-lab'],
  },
  {
    id: 'harmlessness',
    term: 'Harmlessness',
    summary: 'A claim about what a model will not do, which has to be measured to mean anything.',
    kind: 'concept',
    courses: ['safety-lab', 'rlhf-lab'],
  },
  {
    id: 'red-teaming',
    term: 'Red teaming',
    summary: 'Looking for the failures on purpose, and what the resulting set is worth.',
    kind: 'method',
    courses: ['safety-lab', 'agent-bench-lab'],
  },
  {
    id: 'contrastive-training',
    term: 'Contrastive training',
    summary: 'Training two encoders so that a matching pair is close and a mismatched one is far.',
    kind: 'method',
    courses: ['multimodal-lab', 'retrieval-lab', 'rl-foundations'],
  },
  {
    id: 'zero-shot',
    term: 'Zero-shot classification',
    summary: 'Classifying with the text alone, by comparing it to the labels written out.',
    kind: 'method',
    courses: ['multimodal-lab', 'llm-foundations-lab'],
  },
]

/** The concepts one course teaches. */
export function conceptsOfCourse(courseId: string): Concept[] {
  return CONCEPTS.filter((concept) => concept.courses.includes(courseId))
}

/** The concepts more than one course teaches, in the order of the collection. */
export function sharedConcepts(): Concept[] {
  return CONCEPTS.filter((concept) => concept.courses.length > 1)
}

/** A concept by its id. */
export function conceptById(id: string): Concept | undefined {
  return CONCEPTS.find((concept) => concept.id === id)
}

/**
 * The concepts two courses have in common.
 *
 * This is the number that says how much a reader who has done the first
 * course can skip in the second.
 */
export function overlapBetween(courseA: string, courseB: string): string[] {
  const a = new Set(conceptsOfCourse(courseA).map((concept) => concept.id))
  return conceptsOfCourse(courseB)
    .map((concept) => concept.id)
    .filter((id) => a.has(id))
}
