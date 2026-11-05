import type { LessonContent } from '../../types/curriculum'

export const lessonAgenticLLMs: LessonContent = {
  id: 'lesson-01-agentic-llms',
  slug: 'what-agentic-llms-are',
  secondaryParts: [],
  order: 1,
  part: 'part-1-language-modeling',
  title: 'Agentic LLMs: Models, Harnesses, Loops',
  summary:
    'What changes when a language model stops only answering and starts acting: the definition of an agent, the harness as the second half of the system, and the reasoning / acting / interacting cycle that organises the whole book.',
  minutes: 28,
  difficulty: 'core',
  prerequisites: [],
  objectives: [
    { text: 'Define an agent as a system that acts, observes effects and adapts its policy.', source: 'Ch. 1, §1.2' },
    { text: 'Split an agentic LLM into its two engineering halves: the model and the harness.', source: 'Ch. 1, §1.2.2' },
    { text: 'Explain why agentic LLMs make learning at inference time as important as learning during training.', source: 'Ch. 1, §1.2.4' },
    { text: 'Distinguish assistants that assist from agents that interact with each other.', source: 'Ch. 1, §1.2.1' },
    { text: 'Describe the recursive self-improvement cycle connecting reasoning, acting and interacting.', source: 'Ch. 1, Figure 1.1' },
  ],
  sections: [
    {
      id: 'why-agency',
      title: 'Why acting changes the question',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'A language model that only produces text is evaluated on the text it produces. The moment a model can **act** — call a function, run code, browse a page, drive a robot — its answers start changing the world, and the evaluation problem changes with them. The textbook opens with exactly this shift: LLMs that act make decisions and take actions whose consequences persist, which is why the field needs both its own engineering patterns and its own safety discourse.',
        },
        {
          kind: 'callout',
          tone: 'source',
          title: 'Definitions used throughout the course',
          markdown:
            '**Agents** perform actions, observe the effect of these actions and use the feedback they receive from the world to adapt their action policy.\n\n**Agentic LLMs** are agents that integrate the power of LLMs, such as to communicate using natural language, write code, or process information. (Ch. 1, §1.2)',
        },
        {
          kind: 'list',
          items: [
            'Has a goal, rather than only a prompt.',
            'Perceives its environment (observations, files, tool outputs, other agents).',
            'Decides, then acts through tools or other interfaces.',
            'Adapts: it updates its behaviour from the feedback it receives.',
          ],
        },
        {
          kind: 'prose',
          markdown:
            'The last property is the one that makes agents interesting and awkward at the same time. Traditional software is deterministic because predictability is the point; agents deliberately trade some predictability for adaptation. The textbook is explicit that LLM agents can be less dependable than ordinary software — and that this is a property to design around, not a bug to hide.',
        },
      ],
    },
    {
      id: 'harness',
      title: 'The harness: the second half of the system',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'The engineering claim of Chapter 1 is compact and extremely useful: an agentic LLM is not just a model. It is a model plus a **harness** — the code that wraps the model and controls how it is called. The horse metaphor is deliberate: the harness guides the power of the model into productive work.',
        },
        {
          kind: 'diagram',
          diagram: 'harness-loop',
          caption: 'The agentic loop. The harness builds prompts, calls the model, executes tool calls and keeps state; the model supplies language, code and decisions.',
        },
        {
          kind: 'list',
          items: [
            'Prompt construction and system-prompt management',
            'Answer processing (parsing plans, tool calls, JSON, code)',
            'Calling external tools and observing their results',
            'State management and skill management',
            'Looping through reason → act → observe until the task is done',
          ],
        },
        {
          kind: 'prose',
          markdown:
            'Because the harness owns the prompt, it behaves like an **automatic prompt engineer**: it can rewrite, decompose and re-evaluate the model\'s input without any human in the loop. That is the mechanism behind every self-reflection technique you will meet in Part II, and it is why this course treats harness design as a first-class engineering skill rather than glue code.',
        },
      ],
    },
    {
      id: 'learning-location',
      title: 'Where learning happens',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Historically, almost all learning in LLM engineering happened during training. Agentic systems move part of it into inference: the simplest way for an agent to "learn" about your project is to read the files and try something, not to update weights. Chapter 1 labels this a second paradigm shift and gives it a practical motivation: with much of the public internet already used for pretraining, agents that interact with an environment can **generate new data themselves**.',
        },
        {
          kind: 'diagram',
          diagram: 'reflection-loop',
          caption: 'Recursive self-improvement: reasoning, acting and interacting produce interaction data, which feeds back into the model.',
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'Two learning sites, one system',
          markdown:
            '**In-context learning** happens inside the context window and leaves the weights untouched. **Reinforcement finetuning** changes the weights using rewards collected at inference time on verifiable tasks. Chapter 9 formalises both as interaction styles D and E; this lesson only needs the distinction.',
        },
        {
          kind: 'table',
          caption: 'Two families of use case, used to organise the book',
          headers: ['Family', 'Who acts', 'Textbook parts'],
          rows: [
            ['Assistants', 'One agent acting for a human user', 'Parts II, III, IV'],
            ['Interacting agents', 'Many agents acting with each other', 'Part V'],
          ],
        },
      ],
    },
    {
      id: 'worked-example',
      title: 'Worked example: reading an agent trace',
      blocks: [
        {
          kind: 'example',
          title: 'A literature helper as an agentic LLM',
          steps: [
            { label: 'Goal', detail: 'Summarise what the course book says about agent memory.' },
            {
              label: 'Observe',
              detail: 'The harness gives the model the question and the list of available tools: search_corpus(query), read_section(id).',
            },
            { label: 'Reason', detail: 'The model decides it cannot answer from memory and emits a tool call: search_corpus("agent memory architectures").' },
            { label: 'Act', detail: 'The harness executes the search and appends the returned section identifiers to the context.' },
            { label: 'Observe again', detail: 'Results include §9.3.2. The model calls read_section("9.3.2").' },
            {
              label: 'Adapt',
              detail: 'The context now contains explicit memory-management content; the model composes an answer and cites §9.3.2. If the first search had returned nothing, a well-built harness feeds that failure back so the model rewrites its query.',
            },
          ],
          takeaway:
            'Every step is inspectable: goal, observation, reason, action, feedback. That trace — not the final paragraph — is what you evaluate when you evaluate an agent.',
        },
      ],
    },
    {
      id: 'checkpoint',
      title: 'Checkpoint',
      blocks: [
        {
          kind: 'checkpoint',
          question:
            'A colleague says: "Our agent is just GPT-class model plus a while-loop." Which part of that statement is the textbook claim, and which part hides the real engineering work?',
          answer:
            'The "model + loop" framing is correct in spirit: Agentic LLM = LLM + harness (Ch. 1, §1.2.2). What it hides is everything the harness owns — prompt construction, tool dispatch, error recovery, state and memory management, and deciding when the loop terminates. Those are design decisions with measurable consequences, and they are the subject of Parts III and IV.',
        },
        {
          kind: 'predict',
          question: {
            id: 'p1-harness',
            prompt:
              'An agent produces a good answer on the first try, but on the second attempt it repeats the same tool call that already failed. Which part of the system is most likely at fault?',
            options: [
              'The model, because it failed to learn from the error message.',
              'The harness, because the failed observation was not fed back into the context.',
              'The tool, because it returned a malformed response.',
              'The prompt template, because it was too long.',
            ],
            correct: 1,
            explanation:
              'The harness owns the loop and the context. If the failed observation is not appended, the model literally cannot see that the call failed — so it repeats it. This is the harness/state half of the system, and it is the part the textbook singles out as the real engineering work (Ch. 1, §1.2.2; Ch. 6, §6.2).',
            source: { label: 'Ch. 1, §1.2.2 Agentic Harness', chapter: 1, section: '1.2.2', primary: true },
            difficulty: 'core',
          },
        },
        {
          kind: 'lab-link',
          labId: 'workflow-builder',
          title: 'Build this loop yourself',
          description:
            'Open the Visual Agent Workflow Builder and wire a goal → planner → tool call → observation → final response graph, then execute it step by step.',
        },
      ],
    },
  ],
  quiz: [
    {
      id: 'q1-1',
      prompt: 'According to the definition used in the textbook, which property is essential for calling a system an agent?',
      options: [
        'It produces fluent natural language.',
        'It acts, observes effects, and adapts its policy from the feedback.',
        'It runs on dedicated hardware rather than in a browser.',
        'It never makes mistakes.',
      ],
      correct: 1,
      explanation:
        'The book defines agents by the act → observe → adapt loop. Fluency is a property of the model, not what makes a system an agent, and the book is explicit that agents do make mistakes.',
      source: { label: 'Ch. 1, §1.2', chapter: 1, section: '1.2', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q1-2',
      prompt: 'In the equation "Agentic LLM = LLM + Harness", what does the harness NOT typically do?',
      options: [
        'Construct prompts and manage the system prompt',
        'Execute tool calls and feed observations back',
        'Provide the pretrained language capability itself',
        'Keep state between model invocations',
      ],
      correct: 2,
      explanation:
        'Language capability comes from the model. The harness is the surrounding code: prompt construction, answer processing, tool calling, state and skill management (Ch. 1, §1.2.2).',
      source: { label: 'Ch. 1, §1.2.2', chapter: 1, section: '1.2.2', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q1-3',
      prompt: 'Why does the textbook describe learning at inference time as a paradigm shift for agentic LLMs?',
      options: [
        'Because pretrained models cannot answer questions at all.',
        'Because agents can generate new interaction data, which can later be used for training.',
        'Because inference is always cheaper than training.',
        'Because finetuning is no longer needed anywhere.',
      ],
      correct: 1,
      explanation:
        'Interaction produces data: agents try things in an environment and the resulting traces can be used for further training, closing a recursive self-improvement loop (Ch. 1, §1.2.4 and Figure 1.1).',
      source: { label: 'Ch. 1, §1.2.4', chapter: 1, section: '1.2.4', primary: true },
      difficulty: 'core',
    },
  ],
  sources: [
    { label: 'Ch. 1, §1.2 Concepts and Definitions', chapter: 1, section: '1.2', page: 15, primary: true },
    { label: 'Ch. 1, §1.2.2 Agentic Harness', chapter: 1, section: '1.2.2', page: 16, primary: true },
    { label: 'Ch. 1, §1.2.4 Training Data', chapter: 1, section: '1.2.4', page: 17, primary: true },
    { label: 'Ch. 1, §1.5 Course Structures', chapter: 1, section: '1.5', page: 19, primary: true },
  ],
  furtherReading: [
    {
      referenceId: 'van-duijn-2026-agentic-llm',
      note:
        'The textbook itself. Chapters 1 and 9 carry the definition of an agentic LLM and the five interaction styles this course teaches.',
    },
    {
      referenceId: 'yao-2022-react',
      note:
        'The reason–act–observe loop, in the paper that named it. The worked example in this lesson is a trace of that shape.',
    },
  ],
  provenance: {
    textbookChapters: [1],
    supplementaryNote:
      'The literature-helper trace in the worked example is original teaching material written for this course; it illustrates the act–observe–adapt definition without claiming to reproduce any system from the book.',
  },
  keywords: ['agent', 'agentic LLM', 'harness', 'assistant', 'self-improvement', 'policy'],
}

export const lessonFoundations: LessonContent = {
  id: 'lesson-02-foundations',
  slug: 'foundations-of-language-modeling',
  secondaryParts: [],
  order: 2,
  part: 'part-1-language-modeling',
  title: 'Foundations: Tokens, Embeddings, Attention',
  summary:
    'The machinery underneath every agent: subword tokenization, distributional meaning, the shift to contextualised embeddings, the attention mechanism, and the encoder/decoder split that decides which NLP task a model can serve.',
  minutes: 40,
  difficulty: 'core',
  prerequisites: ['what-agentic-llms-are'],
  objectives: [
    { text: 'Explain why natural language is tokenized into subword units and what the vocabulary buys.', source: 'Ch. 2, §2.1.4' },
    { text: 'Distinguish supervised, autoregressive and reinforcement learning regimes in language modelling.', source: 'Ch. 2, §2.2' },
    { text: 'Describe embeddings as vectors in which semantic similarity becomes geometric proximity.', source: 'Ch. 2, §2.3.1' },
    { text: 'Trace how a query, key and value interact inside an attention head.', source: 'Ch. 2, §2.3.4' },
    { text: 'Choose between encoder-only and decoder-only architectures for a given task.', source: 'Ch. 2, §2.3.6–2.3.7' },
  ],
  sections: [
    {
      id: 'tokens',
      title: 'From characters to tokens',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Language models do not see words. They see **tokens**: subword units produced by a tokenizer, which is a separate artefact from the model itself. Because the tokenizer defines the units, the same corpus becomes a different number of tokens under a different tokenizer — which is why token counts, not word counts, are the currency of context windows, dataset sizes and pricing.',
        },
        {
          kind: 'list',
          items: [
            'Subword schemes keep a bounded vocabulary while still representing rare words as sequences of pieces.',
            'Tokenization is lossy in a specific way: it decides what the model can treat as a single symbol.',
            'Everything downstream — context limits, scaling-law token counts, per-token cost — inherits that decision.',
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'A classic agent failure mode',
          markdown:
            'Tasks that hinge on characters rather than meaning (counting letters, reversing strings, strict formatting) are harder for models precisely because the unit of computation is the token, not the character. When an agent must do this reliably, delegating to a tool is the intended fix (Ch. 2 and §11.2).',
        },
      ],
    },
    {
      id: 'learning-regimes',
      title: 'Three learning regimes',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Chapter 2 separates the learning regimes that build a language model. Supervised learning maps inputs to labelled targets; **autoregressive** learning predicts the next token given the preceding context — the objective that scales to unlabelled text; reinforcement learning optimises behaviour against a reward signal, which returns in force in Chapters 6, 9 and 20.',
        },
        {
          kind: 'formula',
          latex:
            'p(w_{t} \\mid w_{1}, \\dots, w_{t-1})',
          caption:
            'The autoregressive decomposition: the probability of the next token given everything before it. Language modelling is next-token prediction at scale (Ch. 2, §2.2.2).',
        },
        {
          kind: 'prose',
          markdown:
            'Note the practical consequence: a next-token predictor is a **memory-less function** at inference. Anything the model should know about your session must arrive through the input — which is why prompting, retrieval and memory architectures (Chapters 6, 9 and 12) are not optional extras but the direct consequence of this design.',
        },
      ],
    },
    {
      id: 'embeddings',
      title: 'Embeddings: meaning as geometry',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Distributional representations turn tokens into vectors. The useful property is geometric: semantically related items end up close together, so similarity becomes a measurable distance. Early methods produced one vector per word type; contextualised models produce a representation per **occurrence**, so the same word takes different vectors in different sentences.',
        },
        {
          kind: 'table',
          caption: 'Static versus contextualised representations',
          headers: ['Property', 'Static embeddings', 'Contextualised embeddings'],
          rows: [
            ['Unit', 'Word type', 'Occurrence in context'],
            ['Same word twice in a sentence', 'Identical vector', 'Potentially different vectors'],
            ['Example consequence', 'Bank is one point in space', 'River bank vs. savings bank separate'],
          ],
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'Why this matters for retrieval',
          markdown:
            'Semantic proximity is what makes vector retrieval possible at all: an agent can find a passage that shares no keywords with the query. Chapter 12 builds RAG on exactly this property, and lab B lets you manipulate relevance weighting and watch retrieval change.',
        },
      ],
    },
    {
      id: 'attention',
      title: 'Attention and the transformer',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Recurrent networks pass information through a single moving state, which is why long dependencies decay. Attention replaces that bottleneck with **flexible, context-dependent connections**: for each token, the model computes a query, compares it with keys of other tokens, and mixes their values according to those scores.',
        },
        {
          kind: 'formula',
          latex:
            '\\mathrm{Attention}(Q,K,V) = \\mathrm{softmax}\\!\\left(\\frac{QK^{\\top}}{\\sqrt{d_k}}\\right)V',
          caption:
            'Scaled dot-product attention (Ch. 2, §2.3.4). The softmax makes the strength of each connection depend on the actual content, not on distance in the sequence.',
        },
        {
          kind: 'diagram',
          diagram: 'llm-transformer',
          caption:
            'A decoder-only transformer block: tokens → embeddings → stacked attention + feed-forward layers with residual connections → next-token distribution.',
        },
        {
          kind: 'formula',
          latex:
            '\\text{cost of attention} \\propto n^{2}',
          caption:
            'Attention cost grows quadratically with sequence length, which is why long contexts are expensive and why compression strategies exist (Ch. 9, §9.3.2.2).',
        },
        {
          kind: 'prose',
          markdown:
            'It is worth being precise about what the softmax does, because the phrase "a linear combination of **all** the encoder hidden states" is easy to read past. Attention never looks at one thing. It looks at everything, with a *distribution* over it — and the distribution is a probability distribution, summing to one, over the whole input.',
        },
        {
          kind: 'demo',
          demo: 'attention',
          title: 'Attention as a soft lookup',
          intro:
            'The retrieval demonstration in Lesson 9 treats a retriever as a soft lookup over a corpus. This is the mechanism underneath it, at four dimensions and one head: a dot product against every passage, a softmax so the weights sum to one, and a weighted sum. Change what you ask for and how sharply you ask it, and watch the two ways a soft lookup fails — a query that names the subject rather than the answer, and a distribution too flat to be a lookup at all.',
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'Why this is the mechanism behind retrieval',
          markdown:
            'A retriever scores every document against the query and returns the highest-scoring ones. Attention scores every token against the query and mixes them. The vocabulary differs; the shape is the same, and so are the failure modes: a query that retrieves the wrong thing, and a set of candidates that is too large to be looked at properly.',
        },
      ],
    },
    {
      id: 'architectures',
      title: 'Encoder-only versus decoder-only',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'The book keeps a clean split. **Encoder-only** models (BERT-style) are built for understanding tasks — classification, labelling, retrieval representations. **Decoder-only** models (GPT-style) are built for generation and, through generation, for everything an agent does: planning, tool calls, code, dialogue.',
        },
        {
          kind: 'table',
          caption: 'Choosing an architecture (Ch. 2, §2.3.6–2.3.7)',
          headers: ['Need', 'Encoder-only', 'Decoder-only'],
          rows: [
            ['Sentence classification', 'Natural fit', 'Possible but indirect'],
            ['Text generation', 'Not its objective', 'Natural fit'],
            ['Agentic loop (plan, call tools, answer)', 'Not the unit of computation', 'The standard choice'],
            ['Embedding for retrieval', 'Common', 'Also used, different training'],
          ],
        },
        {
          kind: 'prose',
          markdown:
            'Almost everything agentic you build in this course sits on the decoder side, because agentic work is generation: the model generates a plan, a tool call, a critique, or the next step of a reasoning chain. The encoder/decoder distinction resurfaces in Chapter 3, where the training objective follows from the architecture.',
        },
      ],
    },
    {
      id: 'checkpoint',
      title: 'Checkpoint',
      blocks: [
        {
          kind: 'checkpoint',
          question:
            'Why does a bigger context window not automatically solve an agent\'s memory problem, given attention is content-based?',
          answer:
            'Two reasons, both in the source. First, attention cost grows with the square of the sequence length, so long contexts are expensive (Ch. 2, §2.3.4). Second, filling the window with raw history does not isolate what matters — Chapter 9 §9.3.2.2 lists long-context architectures and compression, and §11.4 adds prioritised retrieval and summarisation, as the strategies that decide what to keep, compress or discard.',
        },
        {
          kind: 'predict',
          question: {
            id: 'p2-context',
            prompt:
              'You double an agent\'s context window from 32k to 64k tokens, planning to simply put everything in the prompt. What is the most likely outcome?',
            options: [
              'The agent finally remembers everything, because a longer context is searched more thoroughly.',
              'The agent still retrieves the wrong thing, and now pays more for the privilege: attention is content-based, so a longer window means more distractors, and the cost is quadratic in the context length.',
              'The agent improves on short tasks and gets worse on long ones, with no change in cost.',
              'The agent improves, but only on tasks that fit in 64k; the shorter ones regress.',
            ],
            correct: 1,
            explanation:
              'Attention is content-based: a token is retrieved because it is *relevant*, not because it is recent or important. A longer window therefore adds candidate distractors rather than guaranteed recall, and the quadratic cost of attention means every step gets more expensive. The textbook\'s point is that a context window is a capacity limit, not a memory architecture — the selection still has to be done by the harness (Ch. 2, §2.3.4; Ch. 9, §9.3.2.2).',
            source: { label: 'Ch. 2, §2.3.4 Attention; Ch. 9, §9.3.2.2', chapter: 2, section: '2.3.4', primary: true },
            difficulty: 'core',
          },
        },
      ],
    },
  ],
  quiz: [
    {
      id: 'q2-1',
      prompt: 'Why is the tokenizer a modelling decision rather than a preprocessing detail?',
      options: [
        'Because it decides the units the model can treat as symbols, and therefore dataset size, context limits and cost.',
        'Because it removes all ambiguity from natural language.',
        'Because it makes models deterministic.',
        'Because it is trained with reinforcement learning.',
      ],
      correct: 0,
      explanation:
        'The same corpus yields different token counts under different tokenizers; every downstream quantity (context windows, training tokens, cost) inherits that choice (Ch. 2, §2.1.4).',
      source: { label: 'Ch. 2, §2.1.4 Tokenization', chapter: 2, section: '2.1.4', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q2-2',
      prompt: 'In scaled dot-product attention, what role does the softmax play?',
      options: [
        'It normalises the value vectors to unit length.',
        'It converts query–key compatibility scores into weights that determine how much of each value is mixed in.',
        'It removes tokens that exceed the context window.',
        'It makes the layer recurrent.',
      ],
      correct: 1,
      explanation:
        'Attention(Q,K,V) = softmax(QKᵗ/√dₖ)V: the softmax turns compatibility scores into a distribution over values, giving each token content-dependent connections (Ch. 2, §2.3.4).',
      source: { label: 'Ch. 2, §2.3.4 Attention', chapter: 2, section: '2.3.4', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q2-3',
      prompt: 'Which statement about LLMs is emphasised in Chapter 2 and explains why memory architectures exist?',
      options: [
        'LLMs are memory-less functions at inference; post-training information must arrive through the input.',
        'LLMs store the conversation in their weights as they talk.',
        'LLMs cannot be used for classification tasks.',
        'LLMs recompute their tokenizer at every call.',
      ],
      correct: 0,
      explanation:
        'An LLM estimates an output from its input; new information must be supplied via the context. Chapter 9 then studies architectures that supply it (finetuning, long context, explicit memory management).',
      source: { label: 'Ch. 2, §2.2; Ch. 9, §9.3.1', chapter: 2, section: '2.2', primary: true },
      difficulty: 'core',
    },
  ],
  sources: [
    { label: 'Ch. 2, §2.1 Processing Natural Language', chapter: 2, section: '2.1', page: 29, primary: true },
    { label: 'Ch. 2, §2.2 Machine Learning Methods for NLP', chapter: 2, section: '2.2', page: 39, primary: true },
    { label: 'Ch. 2, §2.3.4 Attention', chapter: 2, section: '2.3.4', page: 48, primary: true },
    { label: 'Ch. 2, §2.3.5 Transformers', chapter: 2, section: '2.3.5', page: 50, primary: true },
    { label: 'Ch. 2, §2.3.6–2.3.7 Encoder-only / Decoder-only', chapter: 2, section: '2.3.6', page: 52, primary: true },
  ],
  furtherReading: [
    {
      referenceId: 'vaswani-2017-attention',
      note:
        'The transformer itself. The lesson explains attention in the terms a harness author needs; this is the paper that says what the mechanism is actually for, and how little of it is about language.',
    },
    {
      referenceId: 'raffel-2020-t5',
      note:
        'The text-to-text framing, which is why the lesson treats pretraining and finetuning as one pipeline rather than two. Read the multitask mixture section if you want to know what "pretraining data" really means.',
    },
  ],
  provenance: {
    textbookChapters: [2],
    supplementaryNote:
      'The tokenizer/character failure warning is original course material that applies the tokenization discussion to agentic debugging; it is consistent with the chapter but not quoted from it.',
  },
  keywords: ['tokenization', 'embedding', 'attention', 'transformer', 'autoregressive', 'encoder', 'decoder'],
}

export const lessonTraining: LessonContent = {
  id: 'lesson-03-training-pipeline',
  slug: 'training-pipeline',
  secondaryParts: [],
  order: 3,
  part: 'part-1-language-modeling',
  title: 'The Training Pipeline: Pretrain → Finetune → Align',
  summary:
    'The five stages that turn random weights into an instruction-following model, the benchmarks used to check each capability, and the case study that builds a small chat model from scratch.',
  minutes: 38,
  difficulty: 'core',
  prerequisites: ['foundations-of-language-modeling'],
  objectives: [
    { text: 'List the stages of the training pipeline and state the purpose of each.', source: 'Ch. 3, §3.2' },
    { text: 'Explain why preference tuning comes after pretraining and finetuning.', source: 'Ch. 3, §3.2.4' },
    { text: 'Connect the training objective to the encoder/decoder choice.', source: 'Ch. 3, §3.1.1' },
    { text: 'Identify what common benchmarks (ARC-Easy/Challenge, GSM8K) are meant to measure.', source: 'Ch. 5, §5.8' },
    { text: 'Describe what the from-scratch case study does at each task: tokenizer, pretraining, mid-training, SFT, inference.', source: 'Ch. 5, §5.4–5.8' },
  ],
  sections: [
    {
      id: 'stages',
      title: 'Five stages, five purposes',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'The book presents the pipeline as a sequence of distinct engineering stages, each answering a different question. Confusing them is the most common source of confusion about how LLMs are built, so keep the purposes separate.',
        },
        {
          kind: 'diagram',
          diagram: 'training-pipeline',
          caption:
            'Acquire data → pretrain (next-token prediction at scale) → finetune (instruction following) → preference tuning (align to human preferences) → infer (serve, and, for agents, loop).',
        },
        {
          kind: 'table',
          caption: 'Stage purposes (Ch. 3, §3.1–3.2)',
          headers: ['Stage', 'Objective', 'What it produces'],
          rows: [
            ['Data acquisition', 'Collect and filter a large, diverse corpus', 'Training material plus a licence/provenance record'],
            ['Pretraining', 'Next-token prediction on that corpus', 'General language and world knowledge in the weights'],
            ['Finetuning (SFT)', 'Learn from instruction/response pairs', 'A model that follows requests instead of continuing text'],
            ['Preference tuning', 'Optimise against human preference signals', 'Helpfulness, harmlessness, style control'],
            ['Inference', 'Serve predictions, optionally in a loop', 'The behaviour users and agents actually consume'],
          ],
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'Why order matters',
          markdown:
            'Preference tuning is a *shaping* step: it refines a model that already knows how to follow instructions. Apply it before SFT and there is little instructed behaviour to shape; that is why the pipeline in §3.2 runs pretrain → finetune → preference tuning and only then inference.',
        },
        {
          kind: 'prose',
          markdown:
            'The first stage is the one that is easiest to overlook and hardest to get right. §3.2.1 describes a curation pipeline that stands between a web crawl and a training corpus: source prioritisation, noise reduction, **de-duplication at both the URL and document level**, safety filtering, and bias mitigation. Every one of those is a filter, and every filter has a threshold that can be set wrong.',
        },
        {
          kind: 'demo',
          demo: 'curation',
          title: 'What a filter throws away',
          intro:
            'De-duplication is "essential to prevent the model from memorizing redundant information", and the same section warns that filters "can inadvertently flag and suppress legitimate data written in specific dialects". Those two requirements pull in opposite directions, and a threshold is where they meet. Set the thresholds and watch which failure dominates: duplicates left in for the model to memorise, or legitimate writing removed because it looks unusual.',
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Filtering is not free',
          markdown:
            'Chapter 19 puts the number on it: "aggressive filtering for quality can outweigh sheer quantity". A corpus that has been filtered hard is also a corpus that has been made narrower, and the model inherits that narrowing as though it were the world. The pipeline that produced a dataset is part of the dataset.',
        },
      ],
    },
    {
      id: 'objectives',
      title: 'Objectives follow architecture',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'A decoder model is trained to predict the next token and therefore inherits generation behaviour. An encoder model is trained on masked or discriminative objectives and therefore inherits classification and representation behaviour. The architecture picks the objective long before the checkpoint exists.',
        },
        {
          kind: 'formula',
          latex:
            '\\mathcal{L}(\\theta) = -\\sum_{t} \\log p_{\\theta}(w_t \\mid w_{<t})',
          caption:
            'Cross-entropy next-token loss, the pretraining objective for decoder-only models (Ch. 2, §2.2.2; Ch. 3 passim).',
        },
        {
          kind: 'prose',
          markdown:
            'The chapter is also candid about open and closed models: open-weight releases make the whole pipeline inspectable, which is why the case study can hand you the actual steps, while closed models expose only the interface.',
        },
      ],
    },
    {
      id: 'benchmarks',
      title: 'Benchmarks and what they measure',
      blocks: [
        {
          kind: 'list',
          items: [
            'Common tasks: question answering, summarisation, classification, translation, code generation.',
            'Metrics: accuracy, exact match, F1, pass@k, perplexity in different settings.',
            'Common suites: language understanding and reasoning benchmarks such as ARC-Easy and ARC-Challenge, mathematical word problems such as GSM8K, and coding benchmarks.',
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Benchmarks measure performance, not competence',
          markdown:
            'Chapter 22 later draws the competence/performance distinction explicitly: a low score can come from prompt format, tokenization or output constraints rather than from the absence of a capability. Report what you measured, with which harness, not what you hope it implies.',
        },
      ],
    },
    {
      id: 'case-study',
      title: 'Case study: building a chat model from scratch',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Chapter 5 grounds the theory in code. Its tasks walk through a Byte Pair Encoding tokenizer, pretraining, mid-training and supervised finetuning, then inference, deployment and critical reflection. The point is not to train a frontier model in a notebook but to make every stage debuggable: you see the loss curve, the vocabulary, the checkpoints and the failure modes.',
        },
        {
          kind: 'list',
          ordered: true,
          items: [
            'Task 0 — model hub warm-up: load and inspect existing checkpoints.',
            'Task 1 — tokenization: configure and train a BPE tokenizer, reason about vocabulary size.',
            'Task 2 — pretraining: run the next-token objective and interpret the loss.',
            'Task 3 — mid-training and supervised finetuning: teach instruction following.',
            'Task 4 — inference, deployment and critical reflection: serve the model and evaluate it critically, including cost and access.',
          ],
        },
        {
          kind: 'callout',
          tone: 'source',
          title: 'Environment integrity',
          markdown:
            'The case study is built on Karpathy\'s **nanochat** (Ch. 5, §5.2). This course links to the source material rather than redistributing third-party code; check the upstream repository\'s licence before reusing it.',
        },
      ],
    },
    {
      id: 'checkpoint',
      title: 'Checkpoint',
      blocks: [
        {
          kind: 'checkpoint',
          question:
            'Your team has a decoder-only base checkpoint that completes sentences but ignores instructions. Which single stage is missing, and what changes if you skip it and go straight to preference tuning?',
          answer:
            'Supervised finetuning (instruction tuning) is missing. Preference tuning assumes an instructed model and shapes its behaviour; without SFT there is little instructed behaviour to shape, so alignment signals mostly re-weight continuation behaviour instead of teaching task following (Ch. 3, §3.2.3–3.2.4).',
        },
        {
          kind: 'predict',
          question: {
            id: 'p3-sft',
            prompt:
              'A base checkpoint completes sentences but ignores instructions. You skip supervised finetuning and go straight to preference tuning. What do you get?',
            options: [
              'A model that follows instructions even better, because preferences encode the desired behaviour more directly.',
              'A model that prefers well-written answers but still does not reliably do what it is told, because the missing stage is what teaches the model to treat the prompt as an instruction at all.',
              'No difference: preference tuning subsumes supervised finetuning.',
              'A model that ignores instructions less often but loses its language modelling ability entirely.',
            ],
            correct: 1,
            explanation:
              'The missing stage is supervised finetuning: demonstrations of prompt → compliant response, which is what teaches the instruction-following *format*. Preference tuning assumes that behaviour already exists and only ranks among valid answers. Skipping it means the model is ranking answers it was never taught to produce, so the failure moves from "ignores the instruction" to "answers a nearby question well" (Ch. 3, §3.2.3–3.2.4).',
            source: { label: 'Ch. 3, §3.2.3–3.2.4 Finetune and preference tuning', chapter: 3, section: '3.2.3', primary: true },
            difficulty: 'core',
          },
        },
      ],
    },
  ],
  quiz: [
    {
      id: 'q3-1',
      prompt: 'Which stage first gives a base model the ability to follow instructions?',
      options: ['Pretraining on web text', 'Supervised finetuning on instruction/response pairs', 'Preference tuning', 'Tokenizer training'],
      correct: 1,
      explanation:
        'Pretraining produces language knowledge; supervised finetuning on instruction/response pairs teaches the model to act on requests. Preference tuning then aligns the instructed model (Ch. 3, §3.2.3–3.2.4).',
      source: { label: 'Ch. 3, §3.2.3 Finetune', chapter: 3, section: '3.2.3', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q3-2',
      prompt: 'In the from-scratch case study, what is the purpose of the tokenizer task?',
      options: [
        'To train a BPE tokenizer and reason about vocabulary-size trade-offs before any modelling.',
        'To deploy the model to a server.',
        'To evaluate the model on GSM8K.',
        'To collect preference labels.',
      ],
      correct: 0,
      explanation:
        'Task 1 configures and trains a Byte Pair Encoding tokenizer, including the trade-offs in choosing vocabulary size — the units that every later stage depends on (Ch. 5, §5.5).',
      source: { label: 'Ch. 5, §5.5 Task 1: Tokenization', chapter: 5, section: '5.5', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q3-3',
      prompt: 'Why can a low benchmark score not be read directly as "the model lacks the capability"?',
      options: [
        'Because benchmarks are always randomly generated.',
        'Because performance also depends on factors such as prompt format, tokenization, context length and output constraints.',
        'Because all benchmarks are saturated.',
        'Because models are deterministic.',
      ],
      correct: 1,
      explanation:
        'Chapter 22 §22.1.2 formalises this as the competence/performance distinction: the underlying capacity and its expression on one particular occasion are different things.',
      source: { label: 'Ch. 22, §22.1.2 Competence and Performance', chapter: 22, section: '22.1.2', primary: true },
      difficulty: 'core',
    },
  ],
  sources: [
    { label: 'Ch. 3, §3.1 Training Models', chapter: 3, section: '3.1', page: 63, primary: true },
    { label: 'Ch. 3, §3.2 Training Pipeline', chapter: 3, section: '3.2', page: 65, primary: true },
    { label: 'Ch. 3, §3.3 Benchmarks and Performance', chapter: 3, section: '3.3', page: 72, primary: true },
    { label: 'Ch. 5, Case Study 1: Building LLMs from Scratch', chapter: 5, page: 111, primary: true },
  ],
  furtherReading: [
    {
      referenceId: 'hu-2021-lora',
      note:
        'The finetuning method that made adaptation practical. The lesson calls finetuning cheap, and this is the paper that explains why — and what it costs in memory.',
    },
    {
      referenceId: 'rafailov-2024-dpo',
      note:
        'The clearest statement of what the alignment stage is optimising, and of how much of the reward model can be removed without losing the behaviour.',
    },
    {
      referenceId: 'guo-2025-deepseek-r1',
      note:
        'Reinforcement learning with verifiable rewards, at a scale that made the result impossible to dismiss. Useful for the lesson\'s point that a verifiable reward is the scarce ingredient, not the algorithm.',
    },
  ],
  provenance: {
    textbookChapters: [3, 5],
    supplementaryNote:
      'The pipeline-purpose table and the closing checkpoint are original synthesis for this course. The case study is summarised from the book\'s task list; its code is third-party (nanochat) and is linked, not copied.',
  },
  keywords: ['pretraining', 'finetuning', 'preference tuning', 'benchmarks', 'BPE', 'nanochat'],
}
