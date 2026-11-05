import type { GlossaryTerm } from '../types/curriculum'

/**
 * The second half of the glossary.
 *
 * The first half of the glossary defines the concepts the course names
 * explicitly. But the `related` arrays point at a further set of concepts the
 * textbook uses constantly — "Embedding", "RAG", "Tool use", "Recall@k" — and
 * those were not defined anywhere, so the relations in the concept map pointed
 * at nothing.
 *
 * These are the missing definitions, written for this course and cited to the
 * chapter that defines or uses them.
 */
export const GLOSSARY_EXTRA: GlossaryTerm[] = [
  /* ---------------------------------------------------------------- */
  /* Part I · Language modeling                                        */
  /* ---------------------------------------------------------------- */
  {
    term: 'Attention',
    definition:
      'The mechanism that decides, for each token, how much of every other token to mix in. A dot product against every input gives a score; a softmax turns the scores into a probability distribution over the whole input; the context vector is their weighted sum. It is a soft lookup: it never looks at one thing, it looks at everything with a distribution over it.',
    source: { label: 'Ch. 2, §2.3.4 Attention', chapter: 2, section: '2.3.4', primary: true },
    related: ['Embedding', 'Context window', 'Retrieval-augmented generation (RAG)'],
    lessons: ['foundations-of-language-modeling', 'search-and-retrieval'],
    demo: 'attention',
  },
  {
    term: 'Softmax',
    definition:
      'The normalisation that turns a list of scores into a probability distribution summing to one. In attention it decides how sharply the lookup is: a flat softmax spreads the weight over everything and the context vector becomes an average, while a sharp one concentrates on a single input.',
    source: { label: 'Ch. 2, §2.3.4 Attention', chapter: 2, section: '2.3.4', primary: true },
    related: ['Attention', 'Context window'],
    lessons: ['foundations-of-language-modeling'],
    demo: 'attention',
  },
  {
    term: 'Embedding',
    definition:
      'A fixed-length vector that stands for a piece of text, learned so that texts with similar meaning end up near each other in space. Used for semantic retrieval and as the input representation of a transformer.',
    source: { label: 'Ch. 2, §2.3.1 Embeddings', chapter: 2, section: '2.3.1', primary: true },
    related: ['Vector database', 'Retrieval-augmented generation (RAG)', 'Context window', 'Attention'],
    lessons: ['foundations-of-language-modeling', 'search-and-retrieval'],
  },
  {
    term: 'Context window',
    definition:
      'The maximum number of tokens a model can attend to at once. Everything the harness wants the model to see — instructions, history, tool results, retrieved text — has to fit inside it.',
    source: { label: 'Ch. 9, §9.3.2.2 Long context windows and compression', chapter: 9, section: '9.3.2.2', primary: true },
    related: ['Context management', 'Agentic loop', 'Memory architecture'],
    lessons: ['interaction-styles-and-memory', 'multi-step-reasoning'],
  },
  {
    term: 'Prompt compression',
    definition:
      'Shortening a prompt so that it fits in the context window, usually by summarising, chunking or filtering out tokens that carry little information. It is lossy: a summary can read perfectly well and still omit the one fact the answer depends on.',
    source: { label: 'Ch. 9, §9.3.2.2 Long context windows and compression', chapter: 9, section: '9.3.2.2', primary: true },
    related: ['Context window', 'Context management', 'Memory architecture'],
    lessons: ['interaction-styles-and-memory'],
  },
  {
    term: 'Truncation',
    definition:
      'Dropping the oldest part of a conversation when the history no longer fits in the context window. It is the standard chatbot approach, and it silently removes whatever was said first — which is often the part that mattered.',
    source: { label: 'Ch. 9, §9.3.2.2 Long context windows and compression', chapter: 9, section: '9.3.2.2', primary: true },
    related: ['Context window', 'Context management'],
    lessons: ['interaction-styles-and-memory'],
  },
  {
    term: 'Continual learning',
    definition:
      'Learning from a sequence of tasks without forgetting the earlier ones. The textbook treats catastrophic forgetting as the central risk for an agent that keeps learning.',
    source: { label: 'Ch. 9, §9.3.1 The need for memory', chapter: 9, section: '9.3.1', primary: true },
    related: ['Memory architecture', 'Finetuning'],
    lessons: ['interaction-styles-and-memory'],
  },
  {
    term: 'Finetuning',
    definition:
      'Continuing to train a pretrained model on task-specific data, changing its weights. Cheap variants such as LoRA make it practical for interactive use, and it is the only way to put knowledge into the parameters themselves.',
    source: { label: 'Ch. 3, §3.2.3 Finetune', chapter: 3, section: '3.2.3', primary: true },
    related: ['LoRA', 'Continual learning', 'Distillation', 'Memory architecture'],
    lessons: ['training-pipeline', 'interaction-styles-and-memory'],
  },
  {
    term: 'LoRA',
    definition:
      'Low-Rank Adaptation: a way of finetuning a large model by training small low-rank matrices attached to its weights instead of the weights themselves. Cheap enough for interactive use.',
    source: { label: 'Ch. 3, §3.2.3 Finetune', chapter: 3, section: '3.2.3', primary: true },
    related: ['Finetuning', 'Distillation'],
    lessons: ['training-pipeline'],
  },
  {
    term: 'Distillation',
    definition:
      'Training a smaller model to reproduce a larger one\'s behaviour, usually on the larger model\'s outputs. The main route to cheaper inference and to smaller models that keep a capability.',
    source: { label: 'Ch. 19, §19.2 Distillation loop', chapter: 19, section: '19.2', primary: true },
    related: ['Curation', 'Synthetic data', 'LoRA'],
    lessons: ['training-pipeline', 'advanced-architectures-and-interpretability'],
  },
  {
    term: 'Curation',
    definition:
      'Deciding which data to keep, and judging whether it is good. The textbook treats curation as the step that stands between a large pile of generated text and a useful training set.',
    source: { label: 'Ch. 19, §19.4 Data curation', chapter: 19, section: '19.4', primary: true },
    related: ['Distillation', 'Synthetic data'],
    lessons: ['advanced-architectures-and-interpretability', 'training-pipeline'],
  },
  {
    term: 'Hallucination',
    definition:
      'Output that is fluent and confidently wrong. The textbook distinguishes it from a faithfulness error, where the answer contradicts a source the model was actually given.',
    source: { label: 'Ch. 21, §21.2 Hallucination and faithfulness', chapter: 21, section: '21.2', primary: true },
    related: ['Faithfulness', 'Evaluation'],
    lessons: ['tools-and-context', 'advanced-architectures-and-interpretability'],
  },
  {
    term: 'Reinforcement learning',
    definition:
      'Learning a policy by interacting with an environment and receiving rewards. The textbook presents it as one of the three learning paradigms available to a model: supervised, autoregressive and reinforcement.',
    source: { label: 'Ch. 2, §2.2.3 Reinforcement learning', chapter: 2, section: '2.2.3', primary: true },
    related: ['Policy', 'Model-based RL', 'Self-reflection'],
    lessons: ['interaction-styles-and-memory', 'vision-action-world-models'],
  },
  {
    term: 'Few-shot learning',
    definition:
      'Conditioning on a handful of worked examples in the prompt so the model infers the task format from them. No parameter update happens; the examples are simply part of the context.',
    source: { label: 'Ch. 6, §6.1.1 In-context learning', chapter: 6, section: '6.1.1', primary: true },
    related: ['In-context learning', 'Chain of thought', 'Zero-shot CoT'],
    lessons: ['multi-step-reasoning'],
  },
  {
    term: 'Reasoning',
    definition:
      'Producing a sequence of intermediate steps that leads to an answer, rather than answering directly. The textbook treats it as a behaviour that can be elicited, finetuned, distilled or broken.',
    source: { label: 'Ch. 6, §6.1 In-context reasoning', chapter: 6, section: '6.1', primary: true },
    related: ['Chain of thought', 'Tree of thoughts', 'Self-reflection'],
    lessons: ['multi-step-reasoning'],
  },

  /* ---------------------------------------------------------------- */
  /* Part II · Reasoning                                                */
  /* ---------------------------------------------------------------- */
  {
    term: 'Zero-shot CoT',
    definition:
      'Chain of thought without worked examples: a single instruction such as "Let\'s think step by step". Generic and cheap, and less accurate than the few-shot version.',
    source: { label: 'Ch. 6, §6.1.3 Chain of thought prompting', chapter: 6, section: '6.1.3', primary: true },
    related: ['Chain of thought', 'Few-shot learning', 'Reasoning'],
    lessons: ['multi-step-reasoning'],
  },
  {
    term: 'Search-based prompt optimization',
    definition:
      'Improving a prompt by searching over candidate rewrites and keeping the ones that score better. The search is the point: a single rewrite is a guess, a search is a method.',
    source: { label: 'Ch. 6, §6.2.4.1 Search-based prompt optimization', chapter: 6, section: '6.2.4.1', primary: true },
    related: ['Self-reflection', 'Harness', 'Evaluation'],
    lessons: ['multi-step-reasoning'],
  },
  {
    term: 'Reflexion',
    definition:
      'Storing a verbal reflection of what went wrong and feeding it back on the next attempt, so the agent learns from its own failures within a session without any weight update.',
    source: { label: 'Ch. 6, §6.2.4.2 Self-reflection', chapter: 6, section: '6.2.4.2', primary: true },
    related: ['Self-reflection', 'Reinforcement learning', 'Memory architecture'],
    lessons: ['multi-step-reasoning'],
  },
  {
    term: 'Model-based RL',
    definition:
      'Reinforcement learning in which the agent learns a model of the environment and plans inside it, instead of learning the policy directly from experience. Better sample-efficient, but vulnerable to model error.',
    source: { label: 'Ch. 7, §7.3.5.2 Model-based reinforcement learning', chapter: 7, section: '7.3.5.2', primary: true },
    related: ['World model', 'Reinforcement learning', 'Planning'],
    lessons: ['vision-action-world-models'],
  },
  {
    term: 'Self-modifying hyperagent',
    definition:
      'An agent that rewrites its own code or configuration. The textbook treats it as the strongest form of agentic architecture and as the one that most obviously needs a safety argument attached to it.',
    source: { label: 'Ch. 20, §20.2.2 Self-modifying hyperagents', chapter: 20, section: '20.2.2', primary: true },
    related: ['Meta agent', 'Safety', 'Interpretability'],
    lessons: ['advanced-architectures-and-interpretability'],
  },
  {
    term: 'Meta agent',
    definition:
      'A system that designs and revises other agents — their prompts, tools or code — rather than doing the task itself. The textbook treats it as a route to self-improving agents.',
    source: { label: 'Ch. 20, §20.2.3 Meta agents', chapter: 20, section: '20.2.3', primary: true },
    related: ['Self-modifying hyperagent', 'Agentic loop', 'Harness'],
    lessons: ['advanced-architectures-and-interpretability'],
  },
  {
    term: 'Tuned lens',
    definition:
      'A trained per-layer translator that makes the logit lens read out an intermediate layer faithfully, correcting for the mismatch between the residual stream and the final unembedding.',
    source: { label: 'Ch. 21, §21.5.2 From the logit lens to the tuned lens', chapter: 21, section: '21.5.2', primary: true },
    related: ['Logit lens', 'Circuit analysis', 'Interpretability'],
    lessons: ['advanced-architectures-and-interpretability'],
  },
  {
    term: 'Circuit analysis',
    definition:
      'Finding the set of components that implement a behaviour, as a circuit rather than a single component. It is how mechanistic interpretability explains a model\'s computation.',
    source: { label: 'Ch. 21, §21.6 Circuit analysis', chapter: 21, section: '21.6', primary: true },
    related: ['Interpretability', 'Sparse autoencoder', 'Tuned lens'],
    lessons: ['advanced-architectures-and-interpretability'],
  },
  {
    term: 'Sparse autoencoder',
    definition:
      'A dictionary-learning method that trains a sparse set of features on the residual stream, an attempt to recover interpretable features that individual neurons do not represent.',
    source: { label: 'Ch. 21, §21.8 Sparse autoencoders', chapter: 21, section: '21.8', primary: true },
    related: ['Circuit analysis', 'Interpretability', 'Superposition / polysemanticity'],
    lessons: ['advanced-architectures-and-interpretability'],
  },
  {
    term: 'Interpretability',
    definition:
      'The effort to explain what a model computes, at the level of features, circuits and mechanisms rather than at the level of input and output.',
    source: { label: 'Ch. 21, §21.1 Opening the LLM', chapter: 21, section: '21.1', primary: true },
    related: ['Circuit analysis', 'Tuned lens', 'Sparse autoencoder', 'Levels of evidence'],
    lessons: ['advanced-architectures-and-interpretability'],
  },

  /* ---------------------------------------------------------------- */
  /* Part III · Agents                                                  */
  /* ---------------------------------------------------------------- */
  {
    term: 'Agentic loop',
    definition:
      'The repeating reason → act → observe cycle that turns a model into an agent. The harness owns the loop; the model supplies one step of it at a time.',
    source: { label: 'Ch. 6, §6.1 In-context reasoning', chapter: 6, section: '6.1', primary: true },
    related: ['Harness', 'ReAct', 'Self-reflection', 'Tool use'],
    lessons: ['what-agentic-llms-are', 'multi-step-reasoning'],
  },
  {
    term: 'Environment',
    definition:
      'Everything an agent perceives and acts upon: files, tools, other agents, the physical world. The unit that separates a model from an agent is that the environment can answer back.',
    source: { label: 'Ch. 9, §9.1.1 Agents act and adapt in their environment', chapter: 9, section: '9.1.1', primary: true },
    related: ['Agent', 'Agentic loop', 'Tool use'],
    lessons: ['what-agentic-llms-are', 'interaction-styles-and-memory'],
  },
  {
    term: 'Tool use',
    definition:
      'Calling an external function — a search, a calculator, an API — so that language competence becomes effect. The textbook treats it as the capability that turns an assistant into an agent.',
    source: { label: 'Ch. 11, §11.1 Why tools matter in agentic LLMs', chapter: 11, section: '11.1', primary: true },
    related: ['Tool use architecture', 'Model Context Protocol (MCP)', 'Robustness', 'Safety'],
    lessons: ['tools-and-context'],
  },
  {
    term: 'Tool use architecture',
    definition:
      'The decomposition of tool use into roles — planner, caller, summarizer — so that a failure can be attributed to the stage that caused it rather than to the model in general.',
    source: { label: 'Ch. 11, §11.2 Tool use architectures', chapter: 11, section: '11.2', primary: true },
    related: ['Tool use', 'Planner–Caller–Summarizer', 'Robustness'],
    lessons: ['tools-and-context'],
  },
  {
    term: 'Robustness',
    definition:
      'The property of continuing to behave sensibly when a tool fails, a context overflows or an observation is malformed. Chapter 11 treats it as a design requirement, not a nicety.',
    source: { label: 'Ch. 11, §11.5 Robustness, error handling and recovery', chapter: 11, section: '11.5', primary: true },
    related: ['Tool use', 'Safety', 'Self-reflection'],
    lessons: ['tools-and-context'],
  },
  {
    term: 'Safety',
    definition:
      'The property that an agent with external access does not do harm: least-privilege tools, confirmation for irreversible actions, and treating tool output as untrusted data rather than as instructions.',
    source: { label: 'Ch. 11, §11.6 Safety and security', chapter: 11, section: '11.6', primary: true },
    related: ['Tool use', 'Robustness', 'Human-in-the-loop'],
    lessons: ['tools-and-context'],
  },
  {
    term: 'Multi-agent',
    definition:
      'Several agents with different roles working on one problem, communicating through messages and handoffs. The textbook studies both the coordination gains and the coordination failures.',
    source: { label: 'Ch. 16, §16.1 From single-agent to multi-agent', chapter: 16, section: '16.1', primary: true },
    related: ['Role-based multi-agent system', 'Generative agents', 'Debate'],
    lessons: ['behavior-strategy-multi-agent'],
  },
  {
    term: 'Generative agents',
    definition:
      'Agents given a memory stream, a reflection mechanism and a planning step, so that they accumulate experience and behave consistently over time rather than resetting each session.',
    source: { label: 'Ch. 18, §18.2.1 Generative agents', chapter: 18, section: '18.2.1', primary: true },
    related: ['Memory architecture', 'Multi-agent', 'Self-reflection'],
    lessons: ['behavior-strategy-multi-agent'],
    demo: 'valence',
  },
  {
    term: 'Valence',
    definition:
      'Whether an event is good or bad for the agent. The original generative-agents memory system is valence-blind: a criticism and a compliment are encoded and retrieved with equal weight, which is why the case study in Chapter 18 exists.',
    source: { label: 'Ch. 18, §18.2.2 Bad is stronger than good', chapter: 18, section: '18.2.2', primary: true },
    related: ['Generative agents', 'Memory architecture'],
    lessons: ['behavior-strategy-multi-agent'],
    demo: 'valence',
  },
  {
    term: 'Evaluation',
    definition:
      'Measuring an agent against a frozen task set with a stated metric, so that a claim about its behaviour can be checked rather than believed.',
    source: { label: 'Ch. 14, §14.4 Evaluation', chapter: 14, section: '14.4', primary: true },
    related: ['Machine behaviour', 'Construct validity', 'Levels of evidence'],
    lessons: ['behavior-strategy-multi-agent', 'future-directions'],
  },
  {
    term: 'Social chain of thought',
    definition:
      'Prompting a model to predict the opponent\'s move before choosing its own. The textbook reports that it improved coordination, and that prediction alone was not enough — the prediction had to be inside the decision loop.',
    source: { label: 'Ch. 15, §15.4.1 Coordination in social dilemmas', chapter: 15, section: '15.4.1', primary: true },
    related: ['Knowing–doing gap', 'Reasoning', 'Multi-agent'],
    lessons: ['behavior-strategy-multi-agent'],
  },
  {
    term: 'Construct validity',
    definition:
      'Whether a benchmark measures the thing it claims to measure. The textbook insists on it because a social-dilemma score is evidence about cooperation only if the game really elicits it.',
    source: { label: 'Ch. 15, §15.1 What is LLM behaviour?', chapter: 15, section: '15.1', primary: true },
    related: ['Machine behaviour', 'Evaluation', 'Levels of evidence'],
    lessons: ['behavior-strategy-multi-agent'],
  },
  {
    term: 'Debate',
    definition:
      'A multi-agent arrangement in which two or more agents argue a position and a judge decides. The textbook treats it as a way of surfacing disagreement rather than a guarantee of truth.',
    source: { label: 'Ch. 16, §16.3.2 Debate and discussion', chapter: 16, section: '16.3.2', primary: true },
    related: ['Multi-agent', 'Complementary pair', 'Evaluation'],
    lessons: ['behavior-strategy-multi-agent'],
  },
  {
    term: 'Complementary pair',
    definition:
      'Two agents with deliberately different roles or prompts, whose errors are less likely to coincide. The textbook frames the pair as more valuable than either agent alone.',
    source: { label: 'Ch. 16, §16.3.1 Complementary pairs', chapter: 16, section: '16.3.1', primary: true },
    related: ['Multi-agent', 'Debate', 'Role-based multi-agent system'],
    lessons: ['behavior-strategy-multi-agent'],
  },
  {
    term: 'Recall@k',
    definition:
      'The fraction of relevant items that appear among the top k results of a retrieval. A retrieval metric that says how much of what matters was actually retrieved, not how the ranking looked.',
    source: { label: 'Ch. 12, §12.7 Evaluation', chapter: 12, section: '12.7', primary: true },
    related: ['Evaluation', 'Vector database', 'Retrieval-augmented generation (RAG)'],
    lessons: ['search-and-retrieval'],
  },
  {
    term: 'Self-Ask',
    definition:
      'A retrieval method in which the model decomposes its own question into sub-questions, answers each, and composes the answers. The retrieval is driven by the model rather than by a fixed query.',
    source: { label: 'Ch. 12, §12.4.1 Adaptive retrieval via Self-RAG and Self-Ask', chapter: 12, section: '12.4.1', primary: true },
    related: ['Self-RAG', 'Retrieval-augmented generation (RAG)', 'Reasoning'],
    lessons: ['search-and-retrieval'],
  },
  {
    term: 'Self-RAG',
    definition:
      'A model trained to emit a token when it wants to retrieve, so that retrieval becomes a decision the model makes rather than a fixed step in a pipeline.',
    source: { label: 'Ch. 12, §12.4.1 Adaptive retrieval via Self-RAG and Self-Ask', chapter: 12, section: '12.4.1', primary: true },
    related: ['Self-Ask', 'Retrieval-augmented generation (RAG)', 'Harness'],
    lessons: ['search-and-retrieval'],
  },
  {
    term: 'VLM',
    definition:
      'A vision-language model: one that accepts images alongside text, so that perception and language are handled by the same model rather than by two separate systems.',
    source: { label: 'Ch. 7, §7.1 Multi-modal vision language models', chapter: 7, section: '7.1', primary: true },
    related: ['Vision-language-action model (VLA)', 'World model'],
    lessons: ['vision-action-world-models'],
  },
  {
    term: 'Workflow node',
    definition:
      'One step in a workflow graph — an input, a planner, a tool call, a decision. The node is a course-level abstraction for the control flow the harness executes, not a term from the textbook.',
    source: null,
    related: ['Execution trace (course term)', 'Harness', 'Agentic loop'],
    lessons: ['what-agentic-llms-are'],
  },

  /* ---------------------------------------------------------------- */
  /* The vocabulary the laboratories teach                           */
  /* ---------------------------------------------------------------- */
  {
    term: 'Planning',
    definition:
      'Producing a sequence of actions towards a goal before executing them. Planning needs a model of the world: a planner that does not know the door is locked will plan straight into it.',
    source: { label: 'Ch. 6, §6.1 In-context reasoning', chapter: 6, section: '6.1', primary: true },
    related: ['Reasoning', 'World model', 'Model-based RL', 'Agentic loop'],
    lessons: ['multi-step-reasoning', 'vision-action-world-models'],
  },
  {
    term: 'Backtracking',
    definition:
      'Undoing part of a plan and trying a different route. In a search-based planner it is what makes a dead end recoverable rather than fatal.',
    source: { label: 'Ch. 6, §6.1 In-context reasoning', chapter: 6, section: '6.1', primary: true },
    related: ['Planning', 'Replanning', 'Reasoning'],
    lessons: ['multi-step-reasoning'],
  },
  {
    term: 'Replanning',
    definition:
      'Producing a fresh plan from the current state after something has gone wrong. It is the difference between an agent that retries and one that recovers.',
    source: { label: 'Ch. 6, §6.2.4.2 Self-reflection', chapter: 6, section: '6.2.4.2', primary: true },
    related: ['Planning', 'Backtracking', 'Self-reflection', 'Reflexion'],
    lessons: ['multi-step-reasoning'],
  },
  {
    term: 'Short-term memory',
    definition:
      'A bounded working buffer holding the last few steps of a trajectory. It is cheap and immediate, and it is forgotten as soon as the buffer wraps.',
    source: { label: 'Ch. 9, §9.3.2 Memory architectures', chapter: 9, section: '9.3.2', primary: true },
    related: ['Memory architecture', 'Episodic memory', 'Context window'],
    lessons: ['interaction-styles-and-memory'],
  },
  {
    term: 'Episodic memory',
    definition:
      'A store of what happened, kept across sessions, so that the agent can recall earlier events rather than only the current trajectory.',
    source: { label: 'Ch. 9, §9.3.2 Memory architectures', chapter: 9, section: '9.3.2', primary: true },
    related: ['Memory architecture', 'Short-term memory', 'Continual learning'],
    lessons: ['interaction-styles-and-memory'],
  },
  {
    term: 'Eviction',
    definition:
      'Removing an item from a memory store to make room. The policy that decides which item goes is as important as the one that decides what goes in.',
    source: { label: 'Ch. 9, §9.3.2.3 Explicit memory management', chapter: 9, section: '9.3.2.3', primary: true },
    related: ['Memory architecture', 'Retrieval', 'Short-term memory'],
    lessons: ['interaction-styles-and-memory'],
  },
  {
    term: 'Retrieval',
    definition:
      'Selecting the stored material relevant to the current question. Retrieval is a *ranking* problem, and a bigger store does not by itself make it easier.',
    source: { label: 'Ch. 12, §12.1 Retrieval in general', chapter: 12, section: '12.1', primary: true },
    related: ['Retrieval-augmented generation (RAG)', 'Vector database', 'Eviction', 'Recall@k'],
    lessons: ['search-and-retrieval'],
  },
  {
    term: 'Verification',
    definition:
      'Checking a result against something that can decide it: a test, a rule, a reference. It is what turns a plausible answer into a checked one.',
    source: { label: 'Ch. 14, §14.3 Implementation steps', chapter: 14, section: '14.3', primary: true },
    related: ['Evaluation', 'Safety', 'Human-in-the-loop', 'Role-based multi-agent system'],
    lessons: ['behavior-strategy-multi-agent'],
  },
  {
    term: 'Handoff',
    definition:
      'The transfer of work from one agent to another. A handoff carries a context, and a lossy handoff silently drops the part the next agent needed.',
    source: { label: 'Ch. 16, §16.2 Strategic interaction', chapter: 16, section: '16.2', primary: true },
    related: ['Multi-agent', 'Role-based multi-agent system', 'Coordination failure', 'Complementary pair'],
    lessons: ['behavior-strategy-multi-agent'],
  },
  {
    term: 'Coordination failure',
    definition:
      'A breakdown caused not by any one agent being wrong but by the agents failing to work together: a dropped message, an unverified handoff, a conflict left unresolved.',
    source: { label: 'Ch. 17, §17.5 Risks of emergent behaviour', chapter: 17, section: '17.5', primary: true },
    related: ['Multi-agent', 'Handoff', 'Emergent behaviour', 'Verification'],
    lessons: ['behavior-strategy-multi-agent'],
  },
  {
    term: 'Model error',
    definition:
      'The gap between the model an agent plans inside and the world it actually acts in. It is what makes model-based planning fragile in exactly the situations that matter.',
    source: { label: 'Ch. 7, §7.3.5 Model-based reinforcement learning', chapter: 7, section: '7.3.5', primary: true },
    related: ['World model', 'Model-based RL', 'Planning', 'Sample efficiency'],
    lessons: ['vision-action-world-models'],
  },
  {
    term: 'Sample efficiency',
    definition:
      'How much experience an agent needs before it is good. A model-based agent trades per-step computation for fewer interactions, which is the trade the chapter is about.',
    source: { label: 'Ch. 7, §7.3.5.1 Model-free reinforcement learning', chapter: 7, section: '7.3.5.1', primary: true },
    related: ['Model-based RL', 'Model error', 'Reinforcement learning', 'World model'],
    lessons: ['vision-action-world-models'],
  },
  {
    term: 'Branching',
    definition:
      'Routing execution down one of several paths according to a decision. The branch labels are what make the choice legible in the trace afterwards.',
    source: { label: 'Ch. 11, §11.2 Tool use architectures', chapter: 11, section: '11.2', primary: true },
    related: ['Tool use architecture', 'Planner–Caller–Summarizer', 'Decision node'],
    lessons: ['tools-and-context'],
  },
  {
    term: 'Error recovery',
    definition:
      'What an agent does when a tool fails, an observation is malformed or the context overflows: retry, re-plan, escalate, or report the limitation honestly.',
    source: { label: 'Ch. 11, §11.5 Robustness, error handling and recovery', chapter: 11, section: '11.5', primary: true },
    related: ['Robustness', 'Self-reflection', 'Replanning', 'Tool use'],
    lessons: ['tools-and-context'],
  },
  {
    term: 'Decision node',
    definition:
      'A node in a workflow graph that routes execution down one of several labelled branches. The engine follows the edge whose label matches the decision.',
    source: { label: 'Ch. 11, §11.2 Tool use architectures', chapter: 11, section: '11.2', primary: true },
    related: ['Branching', 'Tool use architecture', 'Harness'],
    lessons: ['tools-and-context'],
  },

  /* ---------------------------------------------------------------- */
  /* The vocabulary the deep-dive laboratories teach                   */
  /* ---------------------------------------------------------------- */
  {
    term: 'Adaptive retrieval',
    definition:
      'Retrieving only when the question needs it. The textbook sets it against the always-on pipeline, which pulls a fixed number of passages whether or not one of them is wanted, and names four ways to get it: gate on the model’s own confidence, retrieve iteratively, plan the query first, or train the model to emit a retrieve token. All four trade a decision for a saving, and the saving is the retrieval that did not happen.',
    source: { label: 'Ch. 12, §12.4 Adaptive Retrieval Methods', chapter: 12, section: '12.4', primary: true },
    related: ['Self-RAG', 'Self-Ask', 'Query critique', 'Retrieval', 'Retrieval-augmented generation (RAG)'],
    lessons: ['search-and-retrieval'],
  },
  {
    term: 'Query critique',
    definition:
      'Grading a retrieval, or the passages it returned, before committing to an answer. Self-RAG does it with reflection tokens the model is trained to emit — retrieve or do not retrieve, relevant or irrelevant — so the judgement is part of generation rather than a second model bolted on afterwards. Lab H implements the same gate as a score against a threshold, so that the threshold can be moved and the cost of setting it wrong counted.',
    source: { label: 'Ch. 12, §12.4.1 Adaptive retrieval via Self-RAG and Self-Ask', chapter: 12, section: '12.4.1', primary: true },
    related: ['Adaptive retrieval', 'Self-RAG', 'Abstention', 'Verification'],
    lessons: ['search-and-retrieval'],
  },
  {
    term: 'Abstention',
    definition:
      'Declining to answer. The textbook puts it in the generation step of the pipeline: when the evidence retrieved is insufficient the model should abstain or ask for clarification. It is the only defence against confident error that is free to honour, which is why an abstention rate is a measurement rather than an apology — and why an abstention is wrong in a different way from a hallucination.',
    source: { label: 'Ch. 12, §12.3 Retrieval-Augmented Generation Pipeline', chapter: 12, section: '12.3', primary: true },
    related: ['Hallucination', 'Faithfulness', 'Adaptive retrieval', 'Query critique'],
    lessons: ['search-and-retrieval'],
  },
  {
    term: 'Question decomposition',
    definition:
      'Splitting a question into sub-questions that can each be settled on their own, then composing the answers. Self-Ask does it inside the model’s own prompt, and the reason to do it is that a sub-question is small enough for one retrieval to answer. The cost is the same fact seen from the other side: every hop is now a place where a wrong subject can be picked up and carried forward.',
    source: { label: 'Ch. 12, §12.4 Adaptive Retrieval Methods', chapter: 12, section: '12.4', primary: true },
    related: ['Self-Ask', 'Multi-hop retrieval', 'Adaptive retrieval', 'Chain of thought'],
    lessons: ['search-and-retrieval'],
  },
  {
    term: 'Multi-hop retrieval',
    definition:
      'Answering a question no single document settles, by retrieving once per step and using the answer of one hop to form the query for the next. The textbook’s iterative retrieval — pull a few passages, reason about them, decide whether more rounds of search are needed — is the adaptive method built for exactly this. Lab H scores it as hop coverage: of the hops a question requires, how many were covered.',
    source: { label: 'Ch. 12, §12.4 Adaptive Retrieval Methods', chapter: 12, section: '12.4', primary: true },
    related: ['Question decomposition', 'Adaptive retrieval', 'Retrieval', 'Recall@k'],
    lessons: ['search-and-retrieval'],
  },
  {
    term: 'Transfer',
    definition:
      'Reusing what was learned in one place as the starting point in another. The textbook’s clearest instance is RT-2, where a web-trained vision-language model is finetuned on robot trajectories so that web knowledge informs control; the LLM training pipeline is the same idea arranged in several phases. What transfer buys is measured in interactions saved on the new task, and the measurement is not guaranteed to come out positive.',
    source: { label: 'Ch. 7, §7.2 Decisions & Vision Language Action Models', chapter: 7, section: '7.2', primary: true },
    related: ['Vision-language-action model (VLA)', 'Finetuning', 'Negative transfer', 'Sample efficiency', 'Distillation'],
    lessons: ['vision-action-world-models'],
  },
  {
    term: 'Negative transfer',
    definition:
      'Transfer that costs rather than saves: the inherited starting point is a prior that has to be unlearned before the new task can be learned, so the agent needs more interactions than one that began from nothing. The textbook names the success case and not this one, so the term is used here as the plain name for what Lab E measures — a transferred table replayed against a fresh one on the same seeded task family, with the interaction count of each reported.',
    source: null,
    related: ['Transfer', 'Sample efficiency', 'Model error', 'Moving-target problem'],
    lessons: ['vision-action-world-models'],
  },
  {
    term: 'Self-generated data',
    definition:
      'Training material produced by the system that will consume it. The textbook has two cases: on-policy distillation, where the student is corrected on sequences it sampled itself, and the scaling argument in §23.2.2, where an agent’s interactions with its environment become pretraining data and vision-language-action models are trained on self-generated action data. The promise is data exactly as hard as the model is; the risk is a loop that feeds on its own output.',
    source: { label: 'Ch. 23, §23.2.2 Scale', chapter: 23, section: '23.2.2', primary: true },
    related: ['Synthetic data', 'Compounding model error', 'Distillation', 'World model'],
    lessons: ['vision-action-world-models'],
  },
  {
    term: 'Compounding model error',
    definition:
      'Error that accumulates because each correction is made against a model rather than against the world. The textbook’s version is the distillation loop: successive generations trained on recursively generated data lose the long tail of the original distribution, and without real-data anchoring the collapse, bias, privacy and licensing risks compound with every iteration. Lab E measures the milder, earlier form — a fitted transition model scored against a fixed probe of the real dynamics, generation after generation.',
    source: { label: 'Ch. 19, §19.5.1 Model Collapse', chapter: 19, section: '19.5.1', primary: true },
    related: ['Model error', 'Self-generated data', 'Synthetic data', 'World model'],
    lessons: ['vision-action-world-models'],
  },
  {
    term: 'Forgetting curve',
    definition:
      'A decay rule for stored memory: the trace of a fact fades with the time since it was last rehearsed, and a rehearsal resets it. The textbook lists forgetting as one of the memory-management operations and points at MemoryBank, whose implementation is this curve; Lab F reproduces the mechanism rather than the paper’s numbers, so the recall interval can be moved and the facts it saves counted against a threshold.',
    source: { label: 'Ch. 9, §9.3.2.3 Explicit memory management', chapter: 9, section: '9.3.2.3', primary: true },
    related: ['Hierarchical memory', 'Consolidation', 'Episodic memory', 'Eviction', 'Memory architecture'],
    lessons: ['interaction-styles-and-memory'],
  },
  {
    term: 'Hierarchical memory',
    definition:
      'Stores kept at more than one level of abstraction, where the upper levels summarise the lower. The book’s instance is MemoryBank, which adds hierarchical summaries of a user’s interactions above the event traces and keeps a running profile of the personality those events imply. The gain is that the same facts stay reachable in fewer words for longer; the loss, which Lab F counts fact by fact, is the detail a summary can omit while remaining a good summary.',
    source: { label: 'Ch. 9, §9.3.2.3 Explicit memory management', chapter: 9, section: '9.3.2.3', primary: true },
    related: ['Forgetting curve', 'Consolidation', 'Memory architecture', 'Prompt compression', 'Short-term memory'],
    lessons: ['interaction-styles-and-memory'],
  },
  {
    term: 'Consolidation',
    definition:
      'Moving what is worth keeping out of a fast, volatile store and into a slow, durable one. The word appears in the textbook with Mem1, whose compact state is trained by reinforcement learning to incentivise state consolidation — the agent decides what survives the interaction. Lab F treats it as a threshold on the decay curve: a trace that has fallen below a given remembered strength is folded into a summary rather than kept as an event.',
    source: { label: 'Ch. 9, §9.3.2.3 Explicit memory management', chapter: 9, section: '9.3.2.3', primary: true },
    related: ['Forgetting curve', 'Hierarchical memory', 'Write policy', 'Episodic memory', 'Continual learning'],
    lessons: ['interaction-styles-and-memory'],
  },
  {
    term: 'Write policy',
    definition:
      'The rule that decides what a memory store adds, updates, deletes or leaves alone. The book frames memory as read and write operations, with compacting and forgetting among the ones that matter; AgeMem then folds the write operations into the agent’s own policy and trains them end to end. Lab F sets the two versions against each other — a hand-written rule and a learned one, both scored on the retrieval that happens later.',
    source: { label: 'Ch. 9, §9.3.2.3 Explicit memory management', chapter: 9, section: '9.3.2.3', primary: true },
    related: ['Eviction', 'Memory architecture', 'Policy gradient', 'Consolidation', 'Retrieval'],
    lessons: ['interaction-styles-and-memory'],
  },
  {
    term: 'Policy gradient',
    definition:
      'The family of reinforcement-learning updates that raise the probability of the actions that paid, by differentiating expected return with respect to the policy’s own parameters. The textbook’s memory section says only that write operations are trained with reinforcement learning; this is the name of the rule Lab F applies — a seeded tabular softmax over four write actions. It is defined here because a badge that says *learned* should be answerable when a student asks learned how.',
    source: null,
    related: ['Reinforcement learning', 'Write policy', 'Consolidation', 'Sample efficiency'],
    lessons: ['interaction-styles-and-memory'],
  },
  {
    term: 'Decomposable work',
    definition:
      'Work that can be split into steps each answerable without holding the final answer already. The textbook’s argument for chain of thought rests on this property: a decoder instructed to answer does answer immediately, whatever it produces, so a problem has to be worked into a sequence of steps before the model can be made to walk them. It follows that longer chains pay where the steps exist and cost where they do not — which is what Lab G sweeps rather than asserts.',
    source: { label: 'Ch. 6, §6.1.3 Chain of thought prompting', chapter: 6, section: '6.1.3', primary: true },
    related: ['Chain of thought', 'Reasoning', 'Overthinking', 'Question decomposition', 'Verification'],
    lessons: ['multi-step-reasoning'],
  },
  {
    term: 'Overthinking',
    definition:
      'Reasoning that becomes worse as it becomes longer. The textbook lists it among the limits of scaling: chain of thought works better in some domains than others, and deeper reasoning may lead to overthinking, where the process becomes less effective as more effort is spent. Lab G’s crossover is the same phenomenon measured on a battery — the depth at which a longer chain stops beating a shorter one, and the tokens it spent to find that out.',
    source: { label: 'Ch. 23, §23.2.2 Scale', chapter: 23, section: '23.2.2', primary: true },
    related: ['Chain of thought', 'Decomposable work', 'External verification', 'Reasoning'],
    lessons: ['multi-step-reasoning'],
  },
  {
    term: 'External verification',
    definition:
      'A check the model cannot perform by continuing to generate: a test, a calculator, a deterministic function, a second source. The textbook’s sharpest instance is reinforcement learning with verifiable rewards, where a deterministic function decides whether a sampled completion is correct and the reward follows. It matters because reflection alone does not supply it — an interaction style whose own steps are never answered by the world has nothing to correct against.',
    source: { label: 'Ch. 6, §6.2.4.3 RL with Verifiable Rewards', chapter: 6, section: '6.2.4.3', primary: true },
    related: ['Verification', 'RLVR', 'Reflexion', 'Self-reflection', 'Overthinking'],
    lessons: ['multi-step-reasoning'],
  },
  {
    term: 'Provenance',
    definition:
      'Where a claim came from, recorded so that it can be checked. The textbook’s measurable version is KILT, which scores knowledge-intensive tasks alongside the citations a model produced, encouraging models to cite the passages they used. Lab G applies the same rule to its own screens: a figure is printed either as measured here or as reported elsewhere with its citation, and a cell that mixes the two — a reported claim carrying a digit — is refused rather than displayed.',
    source: { label: 'Ch. 12, §12.7 Evaluation', chapter: 12, section: '12.7', primary: true },
    related: ['Recall@k', 'Mean reciprocal rank (MRR)', 'Faithfulness', 'Levels of evidence', 'Evaluation'],
    lessons: ['search-and-retrieval', 'multi-step-reasoning'],
  },
]
