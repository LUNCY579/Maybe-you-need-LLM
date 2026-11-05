import type { GlossaryTerm } from '../types/curriculum'
import { GLOSSARY_EXTRA } from './glossaryExtra'

/**
 * The terms defined in this file. The second half of the glossary — the terms
 * the book uses constantly but that were not yet defined — lives in
 * `glossaryExtra.ts` and is merged in below.
 */
const GLOSSARY_CORE: GlossaryTerm[] = [
  {
    term: 'Agent',
    definition:
      'A system that performs actions, observes their effects and uses the feedback from the world to adapt its action policy.',
    source: { label: 'Ch. 1, §1.2', chapter: 1, section: '1.2', primary: true },
    related: ['Agentic LLM', 'Policy', 'Environment'],
    lessons: ['what-agentic-llms-are'],
  },
  {
    term: 'Agentic LLM',
    definition:
      'An agent that integrates the power of an LLM — natural-language communication, code writing, information processing — and acts in an environment.',
    source: { label: 'Ch. 1, §1.2', chapter: 1, section: '1.2', primary: true },
    related: ['Harness', 'Agent', 'Interaction style'],
    lessons: ['what-agentic-llms-are', 'interaction-styles-and-memory'],
  },
  {
    term: 'Harness',
    definition:
      'The code that wraps a model: prompt construction, answer processing, tool calling, state and skill management, and the loop around reason–act–observe.',
    source: { label: 'Ch. 1, §1.2.2', chapter: 1, section: '1.2.2', primary: true },
    related: ['Agentic LLM', 'Self-reflection', 'Context management'],
    lessons: ['what-agentic-llms-are', 'multi-step-reasoning'],
  },
  {
    term: 'Policy',
    definition:
      'A function mapping states to actions; the object that reinforcement learning improves. An LLM can parameterise a policy.',
    source: { label: 'Ch. 9, §9.1.2', chapter: 9, section: '9.1.2', primary: true },
    related: ['Reinforcement learning', 'In-context reinforcement learning (ICRL)'],
    lessons: ['interaction-styles-and-memory', 'advanced-architectures-and-interpretability'],
  },
  {
    term: 'Environment (in RL)',
    definition:
      'The world the agent operates in; modelled by a transition function that returns the next state and a reward function.',
    source: { label: 'Ch. 9, §9.1.2', chapter: 9, section: '9.1.2', primary: true },
    related: ['Policy', 'World model'],
    lessons: ['interaction-styles-and-memory', 'vision-action-world-models'],
  },
  {
    term: 'In-context learning',
    definition:
      'Conditioning a pretrained model on examples supplied in the prompt, activating stored knowledge without changing parameters.',
    source: { label: 'Ch. 6, §6.1.1; Ch. 9, §9.2.1.2', chapter: 6, section: '6.1.1', primary: true },
    related: ['Chain of thought', 'Few-shot learning', 'Metalearning'],
    lessons: ['multi-step-reasoning', 'interaction-styles-and-memory'],
  },
  {
    term: 'Chain of thought',
    definition:
      'Prompting that demonstrates intermediate reasoning steps so the model conditions its answer on a step sequence.',
    source: { label: 'Ch. 6, §6.1.3', chapter: 6, section: '6.1.3', primary: true },
    related: ['Tree of thoughts', 'Zero-shot CoT', 'Reasoning'],
    lessons: ['multi-step-reasoning'],
  },
  {
    term: 'Tree of thoughts',
    definition:
      'A search-style extension of chain of thought that generates several candidate steps, evaluates them, and explores alternatives.',
    source: { label: 'Ch. 9, §9.2.1.3', chapter: 9, section: '9.2.1.3', primary: true },
    related: ['Chain of thought', 'Search-based prompt optimization'],
    lessons: ['multi-step-reasoning', 'interaction-styles-and-memory'],
  },
  {
    term: 'ReAct',
    definition:
      'A loop that interleaves reasoning traces with tool actions and observations, so environment feedback can correct the plan.',
    source: { label: 'Ch. 11, §11.3', chapter: 11, section: '11.3', primary: true },
    related: ['Tool use', 'Agentic loop'],
    lessons: ['multi-step-reasoning', 'tools-and-context'],
  },
  {
    term: 'Self-reflection',
    definition:
      'A harness pattern in which the same model is called with different role prompts (generate, evaluate, improve) to revise its own output.',
    source: { label: 'Ch. 6, §6.2.4', chapter: 6, section: '6.2.4', primary: true },
    related: ['Harness', 'Reflexion', 'RLVR'],
    lessons: ['multi-step-reasoning', 'interaction-styles-and-memory'],
  },
  {
    term: 'RLVR',
    definition:
      'Reinforcement learning with verifiable rewards: training where correctness can be checked automatically (maths, code, games).',
    source: { label: 'Ch. 6, §6.2.4.3', chapter: 6, section: '6.2.4.3', primary: true },
    related: ['Reinforcement finetuning', 'Self-reflection'],
    lessons: ['multi-step-reasoning', 'interaction-styles-and-memory'],
  },
  {
    term: 'Interaction style',
    definition:
      'One of five agent styles (A query, B in-context examples, C in-context reasoning steps, D self-reflection harness, E reinforcement finetuning) distinguished by prompting and training regime.',
    source: { label: 'Ch. 9, §9.2.1, Table 9.1', chapter: 9, section: '9.2.1', primary: true },
    related: ['Harness', 'In-context learning', 'Reinforcement finetuning'],
    lessons: ['interaction-styles-and-memory'],
  },
  {
    term: 'Reinforcement finetuning',
    definition:
      'Style E: the model parameters change using rewards collected from interaction, blurring the boundary between inference and finetuning.',
    source: { label: 'Ch. 9, §9.2.1.5', chapter: 9, section: '9.2.1.5', primary: true },
    related: ['RLVR', 'LoRA', 'Continual learning'],
    lessons: ['interaction-styles-and-memory'],
  },
  {
    term: 'Metalearning',
    definition:
      'Learning at two levels: an inner loop adapting to a task and an outer loop improving the inner-loop procedure itself.',
    source: { label: 'Ch. 8, §8.2', chapter: 8, section: '8.2', primary: true },
    related: ['Moving-target problem', 'Meta agent'],
    lessons: ['interaction-styles-and-memory', 'advanced-architectures-and-interpretability'],
  },
  {
    term: 'Moving-target problem',
    definition:
      'The stability problem of dynamic metalearning: the inner objective changes while the outer loop trains, so convergence is not guaranteed.',
    source: { label: 'Ch. 8, §8.4', chapter: 8, section: '8.4', primary: true },
    related: ['Metalearning', 'Self-reflection'],
    lessons: ['interaction-styles-and-memory'],
  },
  {
    term: 'Memory architecture',
    definition:
      'A design for persisting information beyond a single model call: finetuning, long context and compression, or explicit harness-managed storage.',
    source: { label: 'Ch. 9, §9.3.2', chapter: 9, section: '9.3.2', primary: true },
    related: ['Vector database', 'Context window', 'Continual learning'],
    lessons: ['interaction-styles-and-memory', 'search-and-retrieval'],
  },
  {
    term: 'Vector database',
    definition:
      'A store for high-dimensional embedding vectors providing low-latency semantic access, used for retrieval-based agent memory.',
    source: { label: 'Ch. 9, §9.3.2.3', chapter: 9, section: '9.3.2.3', primary: true },
    related: ['Retrieval-augmented generation (RAG)', 'Embedding'],
    lessons: ['interaction-styles-and-memory', 'search-and-retrieval'],
  },
  {
    term: 'Retrieval-augmented generation (RAG)',
    definition:
      'A pipeline that retrieves relevant passages from an external index and conditions generation on them, grounding answers in updatable, citable evidence.',
    source: { label: 'Ch. 12, §12.3', chapter: 12, section: '12.3', primary: true },
    related: ['Agentic RAG', 'Embedding', 'Faithfulness'],
    lessons: ['search-and-retrieval'],
  },
  {
    term: 'Agentic RAG',
    definition:
      'Retrieval under the agent\'s own control: decide whether, when and what to retrieve, with iteration and recovery when results are insufficient.',
    source: { label: 'Ch. 12, §12.6', chapter: 12, section: '12.6', primary: true },
    related: ['Retrieval-augmented generation (RAG)', 'Self-Ask', 'Self-RAG'],
    lessons: ['search-and-retrieval'],
  },
  {
    term: 'Faithfulness',
    definition:
      'The degree to which a generated answer follows from the retrieved or observed context, rather than from unverified model prior.',
    source: { label: 'Ch. 12, §12.7', chapter: 12, section: '12.7', primary: true },
    related: ['Hallucination', 'Retrieval-augmented generation (RAG)', 'Evaluation'],
    lessons: ['search-and-retrieval', 'advanced-architectures-and-interpretability'],
  },
  {
    term: 'Mean reciprocal rank (MRR)',
    definition:
      'A retrieval metric averaging the reciprocal rank of the first relevant result across queries.',
    source: { label: 'Ch. 12, §12.7', chapter: 12, section: '12.7', primary: true },
    related: ['Recall@k', 'Evaluation'],
    lessons: ['search-and-retrieval'],
  },
  {
    term: 'Model Context Protocol (MCP)',
    definition:
      'An open standard with a client–server architecture for connecting AI applications to tools, resources and prompts; data layer over JSON-RPC, transport layer over STDIO or Streamable HTTP.',
    source: { label: 'Ch. 11, §11.4', chapter: 11, section: '11.4', primary: true },
    related: ['Tool use', 'Context management'],
    lessons: ['tools-and-context'],
  },
  {
    term: 'Context management',
    definition:
      'Deciding what to keep, summarise or discard as a long task fills the context: summarisation, explicit state/scratchpad, and prioritised retrieval.',
    source: { label: 'Ch. 11, §11.4', chapter: 11, section: '11.4', primary: true },
    related: ['Model Context Protocol (MCP)', 'Memory architecture', 'Harness'],
    lessons: ['tools-and-context', 'interaction-styles-and-memory'],
  },
  {
    term: 'Planner–Caller–Summarizer',
    definition:
      'A three-role tool-use architecture that separates tool selection, request construction, and result summarisation, making failures attributable.',
    source: { label: 'Ch. 11, §11.3', chapter: 11, section: '11.3', primary: true },
    related: ['Tool use', 'Multi-agent'],
    lessons: ['tools-and-context', 'behavior-strategy-multi-agent'],
  },
  {
    term: 'Human-in-the-loop',
    definition:
      'Deliberately pausing an agent for human confirmation or input at critical junctures, especially before high-stakes or irreversible actions.',
    source: { label: 'Ch. 11, §11.5', chapter: 11, section: '11.5', primary: true },
    related: ['Safety', 'Robustness'],
    lessons: ['tools-and-context', 'future-directions'],
    demo: 'escalation',
  },
  {
    term: 'World model',
    definition:
      'A learned, compressed representation of environment dynamics used to simulate future states, improving sample efficiency when real interaction is expensive.',
    source: { label: 'Ch. 7, §7.3', chapter: 7, section: '7.3', primary: true },
    related: ['Model-based RL', 'Vision-language-action model (VLA)', 'Planning'],
    lessons: ['vision-action-world-models'],
  },
  {
    term: 'Vision-language-action model (VLA)',
    definition:
      'A multi-modal model that emits actions as well as text and is trained on robotic action sequences, grounding behaviour in the physical world.',
    source: { label: 'Ch. 7, §7.2', chapter: 7, section: '7.2', primary: true },
    related: ['VLM', 'World model'],
    lessons: ['vision-action-world-models'],
  },
  {
    term: 'Machine behaviour',
    definition:
      'The scientific study of intelligent machines as behavioural systems: how they act in specified settings, under controlled comparison.',
    source: { label: 'Ch. 15, §15.1', chapter: 15, section: '15.1', primary: true },
    related: ['Construct validity', 'Theory of mind (LLM evaluation)'],
    lessons: ['behavior-strategy-multi-agent'],
  },
  {
    term: 'Theory of mind (LLM evaluation)',
    definition:
      'Testing whether a model tracks others\' beliefs, e.g. via false-belief tasks; performance evidence is behavioural and does not by itself establish the underlying mechanism.',
    source: { label: 'Ch. 15, §15.5', chapter: 15, section: '15.5', primary: true },
    related: ['Machine behaviour', 'Levels of evidence'],
    lessons: ['behavior-strategy-multi-agent', 'advanced-architectures-and-interpretability'],
  },
  {
    term: 'Knowing–doing gap',
    definition:
      'The dissociation between predicting the right action and actually taking it, observed in coordination games and social reasoning tasks.',
    source: { label: 'Ch. 15, §15.4.1', chapter: 15, section: '15.4.1', primary: true },
    related: ['Social chain of thought', 'Theory of mind (LLM evaluation)'],
    lessons: ['behavior-strategy-multi-agent'],
  },
  {
    term: 'Role-based multi-agent system',
    definition:
      'A system in which agents are assigned explicit roles (complementary pairs, debate, software teams) with defined communication patterns.',
    source: { label: 'Ch. 16, §16.1, §16.3', chapter: 16, section: '16.3', primary: true },
    related: ['Emergent behaviour', 'Debate'],
    lessons: ['behavior-strategy-multi-agent'],
  },
  {
    term: 'Emergent behaviour',
    definition:
      'Collective patterns — conventions, norms, meta-norms — arising from local interactions rather than being assigned to individual agents.',
    source: { label: 'Ch. 17, §17.1, §17.3', chapter: 17, section: '17.3', primary: true },
    related: ['Generative agents', 'Role-based multi-agent system'],
    lessons: ['behavior-strategy-multi-agent'],
  },
  {
    term: 'Generative agent',
    definition:
      'An LLM-driven simulated character with a cognitive loop of memory, reflection and planning, used in social simulation.',
    source: { label: 'Ch. 18, §18.2.1, §18.3.3', chapter: 18, section: '18.3.3', primary: true },
    related: ['Emergent behaviour', 'Memory architecture'],
    lessons: ['behavior-strategy-multi-agent'],
  },
  {
    term: 'In-context reinforcement learning (ICRL)',
    definition:
      'Improving an agent\'s policy by conditioning the model on a history of state–action–reward triples, without changing parameters.',
    source: { label: 'Ch. 20, §20.2.1', chapter: 20, section: '20.2.1', primary: true },
    related: ['Policy', 'Self-reflection'],
    lessons: ['advanced-architectures-and-interpretability'],
  },
  {
    term: 'Meta agent / hyperagent',
    definition:
      'An agent that designs or modifies its own harness — metalearning applied to harness design; self-modification raises verification and safety questions.',
    source: { label: 'Ch. 20, §20.2.2–20.2.3', chapter: 20, section: '20.2.2', primary: true },
    related: ['Metalearning', 'Harness'],
    lessons: ['advanced-architectures-and-interpretability'],
  },
  {
    term: 'Residual stream',
    definition:
      'The running sum of layer outputs that every attention head and MLP reads and writes: a shared communication channel enabling iterative refinement.',
    source: { label: 'Ch. 21, §21.3', chapter: 21, section: '21.3', primary: true },
    related: ['Logit lens', 'Circuit analysis'],
    lessons: ['advanced-architectures-and-interpretability'],
  },
  {
    term: 'Logit lens',
    definition:
      'A method that projects an intermediate residual-stream state to the vocabulary, revealing the model\'s evolving prediction layer by layer.',
    source: { label: 'Ch. 21, §21.5', chapter: 21, section: '21.5', primary: true },
    related: ['Residual stream', 'Tuned lens'],
    lessons: ['advanced-architectures-and-interpretability'],
    demo: 'patching',
  },
  {
    term: 'Activation patching',
    definition:
      'A causal test: replace the activation at one layer in one run with the activation from another run, and see whether the behaviour changes. Where patching transfers the behaviour is where the information was used.',
    source: { label: 'Ch. 21, §21.7 Activation patching and causal interventions', chapter: 21, section: '21.7', primary: true },
    related: ['Logit lens', 'Circuit analysis', 'Levels of evidence'],
    lessons: ['advanced-architectures-and-interpretability'],
    demo: 'patching',
  },
  {
    term: 'Superposition / polysemanticity',
    definition:
      'Because models represent more features than they have dimensions, individual neurons respond to many unrelated features; sparse autoencoders learn sparser dictionary features.',
    source: { label: 'Ch. 21, §21.4, §21.8', chapter: 21, section: '21.4', primary: true },
    related: ['Sparse autoencoder', 'Circuit analysis'],
    lessons: ['advanced-architectures-and-interpretability'],
    demo: 'patching',
  },
  {
    term: 'Levels of evidence',
    definition:
      'Behavioural, representational and mechanistic levels at which a claim about a model can be supported; agentic systems currently have mostly behavioural evidence.',
    source: { label: 'Ch. 22, §22.1.1', chapter: 22, section: '22.1.1', primary: true },
    related: ['Construct validity', 'Interpretability'],
    lessons: ['advanced-architectures-and-interpretability', 'behavior-strategy-multi-agent'],
  },
  {
    term: 'Synthetic data',
    definition:
      'Training or evaluation data generated by models rather than humans, useful for scaling but carrying risks such as model collapse, bias amplification and licence issues.',
    source: { label: 'Ch. 19, §19.1–19.5', chapter: 19, section: '19.5', primary: true },
    related: ['Distillation', 'Curation'],
    lessons: ['advanced-architectures-and-interpretability'],
  },
  {
    term: 'Execution trace (course term)',
    definition:
      'The ordered record of steps, tool calls, observations and scores produced by the simulator in this course. An original engineering instrument, not a textbook concept.',
    source: null,
    related: ['Harness', 'Evaluation'],
    lessons: ['what-agentic-llms-are', 'future-directions'],
  },
  {
    term: 'Deterministic simulator (course term)',
    definition:
      'The seeded, rule-based execution engine behind the workflow builder and labs. It reproduces scripted agent behaviour for teaching and testing; it is not a deployed AI model.',
    source: null,
    related: ['Execution trace (course term)', 'Workflow node'],
    lessons: ['what-agentic-llms-are', 'future-directions'],
  },
]

/**
 * Glossary. Every entry carries a textbook source reference where the term
 * is defined or used; entries with `source: null` are integration/engineering terms
 * introduced by this course and clearly marked as such in the UI.
 *
 * The list is the union of the terms the course names explicitly and the terms
 * the book uses constantly but that were not yet defined — "Embedding",
 * "Tool use", "Recall@k" — because a relation between concepts is only useful
 * when both of its ends exist.
 */
export const GLOSSARY: GlossaryTerm[] = [...GLOSSARY_CORE, ...GLOSSARY_EXTRA]

export const GLOSSARY_TERM_BY_NAME = new Map(GLOSSARY.map((entry) => [entry.term.toLowerCase(), entry]))
