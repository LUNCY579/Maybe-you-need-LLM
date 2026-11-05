/**
 * The laboratory registry.
 *
 * `delivers` quotes the laboratory items this collection's own manifest declares for this
 * application — the `labs[]` entries of each source in `references/manifest.json` whose
 * `app` is `agentic-ai-academy`. The strings are copied character for character, because
 * the collection audit in `scripts/check-lab-coverage.mjs` compares them as strings: an
 * entry that paraphrases a promise is an entry the audit cannot follow.
 * `src/content/declaredLabs.test.ts` reads the manifest and refuses any `delivers` string
 * the manifest never made, and `sources` names the manifest source that owns it, so the
 * registry cannot invent a promise or launder one from the wrong paper.
 *
 * Items that only a lesson's prose reaches are deliberately absent from this file. A
 * `taught` tier in the audit is not an audit failure: it says the course promises a
 * measurement it has not built yet, and declaring it here would turn an honest gap into a
 * false claim.
 */
export interface LabDefinition {
  id: string
  name: string
  route: string
  tagline: string
  description: string
  concepts: string[]
  sourceChapters: number[]
  /** Honest statement of what the lab actually runs. */
  runtime: string
  accent: 'cyan' | 'violet' | 'emerald' | 'amber'
  /** the `id`s in `references/manifest.json` whose `labs[]` entries are quoted below */
  sources?: string[]
  /** the declared laboratory items this screen computes */
  delivers?: string[]
}

export const LABS: LabDefinition[] = [
  {
    id: 'workflow-builder',
    name: 'Visual Agent Workflow Builder',
    route: '/builder',
    tagline: 'Design, execute and debug an agent as a graph',
    description:
      'A node-based editor with ten node types, a deterministic execution engine, step-by-step control, an execution trace, tool input/output inspection, success scoring and explicit error states. Four learning scenarios are included.',
    concepts: ['Harness', 'ReAct', 'Branching', 'Error recovery', 'Evaluation'],
    sourceChapters: [1, 6, 9, 11],
    runtime: 'Deterministic simulator · seeded scenarios · no model calls',
    accent: 'cyan',
    sources: ['van-duijn-2026', 'yao-2022-react'],
    delivers: [
      'Visual agent workflow builder',
      'Ch. 6, Ch. 9 and Ch. 11: the reason–act–observe loop.',
    ],
  },
  {
    id: 'planning',
    name: 'Lab A · Agent Planning',
    route: '/labs/planning',
    tagline: 'Greedy vs. fixed plan vs. search vs. reflective',
    description:
      'A grid environment with a locked door and a key. Four planners run the same world so their step counts, failures and goal completions can be compared directly.',
    concepts: ['Planning', 'Backtracking', 'Replanning', 'Error recovery'],
    sourceChapters: [6, 9],
    runtime: 'Deterministic grid world · BFS planner · no randomness',
    accent: 'cyan',
  },
  {
    id: 'memory',
    name: 'Lab B · Agent Memory',
    route: '/labs/memory',
    tagline: 'Capacity, retrieval strategy, relevance weighting',
    description:
      'An event stream is stored, evicted and retrieved under your settings, then the agent makes a decision. See exactly what was remembered, retrieved, omitted and how that changes the answer.',
    concepts: ['Short-term memory', 'Episodic memory', 'Retrieval', 'Eviction'],
    sourceChapters: [9, 12],
    runtime: 'Deterministic memory simulation · salience-based eviction',
    accent: 'violet',
    sources: ['packer-2023-memgpt'],
    delivers: ['Ch. 9 §9.3.2.3: explicit memory management with read/write operations.'],
  },
  {
    id: 'world-model',
    name: 'Lab C · World Model & Decision Making',
    route: '/labs/world-model',
    tagline: 'Model-free learning vs. model-based planning',
    description:
      'A grid world with slip dynamics. A Q-learning agent explores it; a planning agent learns an approximate model and plans inside it. Predicted transitions are compared with what actually happened.',
    concepts: ['World model', 'Model-based RL', 'Model error', 'Sample efficiency'],
    sourceChapters: [7, 9],
    runtime: 'Seeded Q-learning + value iteration · reproducible per seed',
    accent: 'emerald',
  },
  {
    id: 'multi-agent',
    name: 'Lab D · Multi-Agent Collaboration',
    route: '/labs/multi-agent',
    tagline: 'Planner, researcher, executor, verifier, critic',
    description:
      'Five roles work a shared diagnosis task over a lossy channel. Inspect handoffs, dropped messages, defects caught in review and defects that reach the final answer.',
    concepts: ['Role-based multi-agent system', 'Verification', 'Coordination failure', 'Handoff'],
    sourceChapters: [14, 16, 17],
    runtime: 'Deterministic message-passing simulation · seeded channel loss',
    accent: 'amber',
  },
  {
    id: 'policy-priors',
    name: 'Lab E · Robot Policies: Priors and Own Data',
    route: '/labs/policy-priors',
    tagline: 'What a pretrained table buys, what own-generated data costs',
    description:
      'Two measurements on the same slip grid. First, one learned Q-table is transferred to three new task families and the interaction cost of each is measured against learning from scratch. Second, a model-based policy is retrained generation after generation on its own rollouts, and the learned model is scored against a fixed probe of the real dynamics.',
    concepts: ['Vision-language-action model (VLA)', 'Transfer', 'Negative transfer', 'Self-generated data', 'Compounding model error'],
    sourceChapters: [7, 23],
    runtime: 'Seeded tabular Q-learning + fitted transition counts · no model calls',
    accent: 'emerald',
    sources: ['brohan-2023-rt2', 'black-2024-pi0'],
    delivers: [
      'Ch. 7 and Ch. 23: the earliest of the vision-language-action models, and the clearest statement of what web-scale pretraining buys a robot.',
      'Ch. 23 §23.2.2: a generalist robot policy trained on self-generated action data — the open-problem version of the world-model lesson.',
    ],
  },
  {
    id: 'memory-longevity',
    name: 'Lab F · Memory Durability and a Learned Write Policy',
    route: '/labs/memory-longevity',
    tagline: 'An Ebbinghaus curve under a hierarchy, and REINFORCE over write actions',
    description:
      'The event stream of Lab B, seen from two questions it cannot answer. Below the working store sits a durable layer of traces, session summaries and a rolling profile, each item decaying as R = exp(-t/S) and recovering when it is rehearsed; the lab counts which facts the curve takes and which the summary budget takes. Then writing becomes an action — ADD, UPDATE, DELETE, NONE — learned against the retrieval that happens later, and compared with the hand-written rule.',
    concepts: ['Forgetting curve', 'Hierarchical memory', 'Consolidation', 'Write policy', 'Policy gradient'],
    sourceChapters: [9],
    runtime: 'Deterministic decay curve + seeded tabular softmax REINFORCE · no model calls',
    accent: 'violet',
    sources: ['zhong-2024-memorybank', 'wang-2025-mem-alpha'],
    delivers: [
      "Ch. 9 §9.3.2.3: hierarchical summaries of a user's interactions, and memory that is forgotten and reinforced on an Ebbinghaus curve.",
      'Ch. 9 §9.3.2.3: the learned counterpart to explicit memory management — the agent decides what to remember, trained by reinforcement learning.',
    ],
  },
  {
    id: 'reasoning',
    name: 'Lab G · Reasoning Depth and the Frontier Audit',
    route: '/labs/reasoning',
    tagline: 'When a longer chain pays, when it costs, and what this course can check for itself',
    description:
      "Chain of thought run as the book defines it — interaction style C, a reasoner whose own steps are never answered by the world — beside style A (one step) and style B (a step that reads an external check) over a hand-authored battery in five task families, at one shared per-step error rate and one shared seed schedule. The sweep reports where each family peaks, in accuracy and in tokens. Then the frontier: a rule-based stand-in scored against this course's own question bank, printed next to a reported column that is text with citations and is refused outright if a cell contains a digit.",
    concepts: ['Chain of thought', 'Decomposable work', 'Overthinking', 'External verification', 'Provenance'],
    sourceChapters: [6, 9, 23],
    runtime: 'Deterministic battery · seeded per-step error · no model calls',
    accent: 'cyan',
    sources: ['wei-2022-cot', 'sprague-2024-cot-or-not', 'achiam-2024-gpt4'],
    delivers: [
      'Ch. 6 and Ch. 9: chain-of-thought prompting as interaction style C.',
      "Ch. 23 §23.2.2: the measurement behind the chapter's warning that more thinking is not always better.",
      'Ch. 23: the frontier the chapter measures itself against, and a rare honest account of what a large model does and does not do.',
    ],
  },
  {
    id: 'retrieval',
    name: 'Lab H · Agentic Retrieval: gate, decompose, compare',
    route: '/labs/retrieval',
    tagline: 'When to look it up, how to split the question, and what each shape costs',
    description:
      'Chapter 12 teaches the retrieve-then-generate pipeline and then says it is not an agent. Three measurable claims carry that transition. First the gate and the critic: the same six questions run by a pipeline that always retrieves top-k and one that judges, retrieves, grades each passage and answers, rewrites or abstains — with the decoys it waved through and the ones it turned away counted separately. Then decomposition: a four-hop question against one flat query, hop by hop, including the hop where a wrong intermediate answer was fed forward. Then the four pipeline shapes of the survey, run over one case set and one budget model, so the price of each shape is in the same units.',
    concepts: ['Adaptive retrieval', 'Query critique', 'Abstention', 'Question decomposition', 'Multi-hop retrieval', 'Agentic RAG'],
    sourceChapters: [12],
    runtime: 'Deterministic scoring over a hand-authored corpus · no model calls',
    accent: 'emerald',
    sources: ['asai-2023-selfrag', 'press-2022-selfask', 'chen-2025-agentic-rag-survey'],
    delivers: [
      'Ch. 12 §12.4: adaptive retrieval with critique.',
      'Ch. 12 §12.4: question decomposition for multi-hop retrieval.',
      'Ch. 12 §12.6: the survey that maps agentic RAG onto the single-shot pipeline the chapter teaches.',
    ],
  },
]

export const LAB_BY_ID = new Map(LABS.map((lab) => [lab.id, lab]))

/** Every item the registry claims, with the entry and the manifest sources behind it. */
export const LAB_ITEMS: { item: string; labId: string; sources: string[] }[] = LABS.flatMap(
  (lab) => (lab.delivers ?? []).map((item) => ({ item, labId: lab.id, sources: lab.sources ?? [] })),
)

export const ITEM_TO_LAB = new Map(LAB_ITEMS.map((entry) => [entry.item, entry.labId]))
