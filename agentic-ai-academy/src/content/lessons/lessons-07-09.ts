import type { LessonContent } from '../../types/curriculum'

export const lessonInteractionStyles: LessonContent = {
  id: 'lesson-07-interaction-styles',
  slug: 'interaction-styles-and-memory',
  secondaryParts: ['part-2-reasoning'],
  order: 7,
  part: 'part-3-agents',
  title: 'Five Interaction Styles and Agent Memory',
  summary:
    'From robotic assistants, BDI agents and swarms to the five prompting/training styles used by agentic LLMs, plus the memory architectures that keep an agent coherent, adaptive and consistent over time.',
  minutes: 56,
  difficulty: 'core',
  prerequisites: ['multi-step-reasoning'],
  objectives: [
    { text: 'Recognise the three historic agent traditions and how they connect to modern agentic LLMs.', source: 'Ch. 9, §9.1.1' },
    { text: 'Use the reinforcement-learning framing (policy, transition, reward) to describe an LLM agent.', source: 'Ch. 9, §9.1.2' },
    { text: 'Distinguish the five interaction styles A–E by their prompting and training regime.', source: 'Ch. 9, §9.2.1, Table 9.1' },
    { text: 'Explain why styles D and E are "dynamic" and why stability is the hard part.', source: 'Ch. 9, §9.2.1.4–9.2.1.5; Ch. 8' },
    { text: 'List the four reasons agents need memory.', source: 'Ch. 9, §9.3.1' },
    { text: 'Compare finetuning, long context/compression, and explicit memory management.', source: 'Ch. 9, §9.3.2' },
  ],
  sections: [
    {
      id: 'traditions',
      title: 'Three traditions of agents',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Agentic LLMs did not invent agents. Chapter 9 traces three traditions, and each still shapes how we build and evaluate systems today: engineering agents that perform tasks for humans, cognitive agents with beliefs, desires and intentions, and swarm agents studied for emergent collective behaviour.',
        },
        {
          kind: 'table',
          caption: 'Three agent traditions (Ch. 9, §9.1.1)',
          headers: ['Tradition', 'Core idea', 'Modern echo'],
          rows: [
            ['Robotic assistant', 'Autonomous system performing human-like tasks', 'Coding assistants, customer-service agents'],
            ['Belief–Desire–Intention', 'Actions are means to goals, driven by explicit attitudes', 'Goal-directed planners, agent architectures'],
            ['Swarm', 'Many simple agents, emergent collective behaviour', 'Societies of LLM agents, norm emergence'],
          ],
        },
        {
          kind: 'prose',
          markdown:
            'The reinforcement-learning framing then supplies shared vocabulary. An agent interacts with an environment through actions; the environment returns a new state and a reward; the agent improves its **policy**. The LLM can be used as the policy, as the reward model, or even as the transition model — three roles, three prompts.',
        },
        {
          kind: 'formula',
          latex:
            '\\pi_{\\theta}(a \\mid s), \\qquad \\mathcal{T}(s\' \\mid s, a), \\qquad r(s, a)',
          caption:
            'Policy, transition and reward. Chapter 9 uses this triple to place every interaction style: who is trained, and what is learned in-context versus in the weights.',
        },
      ],
    },
    {
      id: 'styles',
      title: 'The five interaction styles',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'This is the load-bearing taxonomy of Part III. Styles A–C keep the prompt static; styles D and E let an external harness optimise the prompt (and, for E, the weights). Read the table by asking two questions: *is the prompt static or dynamic?* and *do the weights change?*',
        },
        {
          kind: 'table',
          caption: 'Five agentic interaction styles (Ch. 9, Table 9.1)',
          headers: ['Style', 'Prompting', 'Training', 'Example'],
          rows: [
            ['A. Query', 'Zero-shot user instruction', 'Pretrained', 'GPT-2-era instruction following'],
            ['B. In-context learning (examples)', 'Few-shot examples', 'Pretrained', 'GPT-3 in-context learning'],
            ['C. In-context learning (reasoning steps)', 'Chain-of-thought examples', 'Pretrained / finetuned', 'CoT, zero-shot CoT, tree of thoughts'],
            ['D. Self-reflection harness', 'Harness-optimised feedback prompt', 'Pretrained; learning in context', 'Reflexion, ReAct'],
            ['E. Reinforcement finetuning', 'RL prompt optimisation harness', 'Finetuned from interaction rewards', 'RLVR'],
          ],
        },
        {
          kind: 'diagram',
          diagram: 'reflection-loop',
          caption:
            'Styles D and E: the harness generates subproblems and evaluates them, either by search (D) or by reinforcement learning that also updates model parameters (E).',
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'Styles describe where learning lives',
          markdown:
            'A: no learning at inference. B–C: the *prompt* carries new information. D: the harness learns the prompt in context. E: the *weights* change using rewards collected while acting. Most production agents live in B–D; E requires tasks with verifiable rewards.',
        },
        {
          kind: 'prose',
          markdown:
            'Two cautions from the source. First, styles C–E all depend on model size or finetuning quality; the capabilities appear only past thresholds and thresholds move. Second, D and E are dynamic: when the training target keeps moving, learning can diverge. That stability problem is the subject of Chapter 8, where it is framed as metalearning with inner and outer loops.',
        },
      ],
    },
    {
      id: 'metalearning',
      title: 'Metalearning in one page',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Chapter 8 is where the book turns from what models can do to what *systems* do, and it does it with metalearning. Metalearning studies algorithms that learn at more than one level. The vocabulary is useful: an **inner loop** adapts to a specific task from limited experience, and an **outer loop** improves the inner-loop procedure itself. Static metalearning is stable — pretraining, in-context learning and chain of thought all fit — while dynamic metalearning, where the harness or the weights change during deployment, is where convergence becomes difficult.',
        },
        {
          kind: 'list',
          items: [
            'Inner loop: prompt adaptation, in-context learning, one task\'s roll-outs.',
            'Outer loop: search over prompts, policy updates, harness redesign.',
            'Moving-target problem: the inner task changes while the outer loop trains, so objectives never settle.',
            'Why it matters here: Chapter 8 frames the agentic harness as the outer loop, which is why a harness change can move the behaviour of everything above it.',
          ],
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'Why the chapter is called metalearning',
          markdown:
            'The chapter treats an agentic system as learning at two levels at once, and the two levels are what the rest of this course manipulates. A prompt is the inner loop; the harness that rewrites the prompt is the outer loop. The tool interface, the context budget and the review schedule are all outer-loop decisions, and Chapter 8 is why a change to any of them can move behaviour that nobody intended to move.',
        },
      ],
    },
    {
      id: 'memory',
      title: 'Why agents need memory, and how they get it',
      blocks: [
        {
          kind: 'list',
          items: [
            '**Coherent conversation** — knowing what has been said prevents contradictions.',
            '**Adaptation** — the world changes; the agent must notice and adjust (the moved knife in the kitchen).',
            '**Identity** — accumulated experience is what would let an agent develop a consistent personality.',
            '**Continual learning** — new tasks arrive in sequence; old ones must not be forgotten (catastrophic forgetting).',
          ],
        },
        {
          kind: 'diagram',
          diagram: 'memory-layers',
          caption:
            'Memory architectures: parameters (finetuning), context window with compression, and explicit harness-managed stores with read/write and forgetting operations.',
        },
        {
          kind: 'table',
          caption: 'Memory architectures and their trade-offs (Ch. 9, §9.3.2)',
          headers: ['Approach', 'Mechanism', 'Trade-off'],
          rows: [
            ['Finetuning', 'New information enters the weights (e.g. LoRA)', 'Elegant and deep, but usually too slow for interactive use'],
            ['Long context & compression', 'Inject or compress history into the prompt', 'Simple, but attention is quadratic and windows are finite'],
            ['Explicit memory management', 'Harness stores and retrieves items; memory as read/write operations', 'Fast and inspectable; the model is not trained to manage it'],
            ['Learned memory use', 'RL trains agents to consolidate and retrieve (Mem1, AgeMem)', 'Constant-size state, but research-stage'],
            ['Vector databases', 'Embeddings stored for semantic access', 'Semantic recall at scale; needs maintenance and evaluation'],
          ],
        },
        {
          kind: 'callout',
          tone: 'source',
          title: 'Memory as a tool',
          markdown:
            'MemGPT-style designs expose read and write operations as function calls, so memory management becomes tool use. Chapter 6\'s buffers (of thoughts, reflexion) are the same idea implemented in the harness rather than the model.',
        },
        {
          kind: 'prose',
          markdown:
            'The second row of the table — long context and compression — deserves a closer look, because the constraint it runs into is not a matter of taste. Chapter 6 §6.2.2 puts it plainly: *all* information for a query has to fit in the context window, and the size of that window is limited, which fundamentally limits how much can be communicated to the model. The remedy §9.3.2.2 describes is the one every chatbot uses: give the model a *truncated* form of the chat history.',
        },
        {
          kind: 'demo',
          demo: 'context-window',
          title: 'The context window, and what it does to the answer',
          intro:
            'Shrink the window until the material no longer fits, and then choose between the four policies the textbook names: truncate the history, retrieve what is relevant, compress the prompt, or page the overflow out to an external store. The interesting case is not the one where a fact is dropped — it is the one where the fact is still there, shortened, and the detail that decides the answer is not in the summary any more.',
        },
        {
          kind: 'prose',
          markdown:
            'Three lessons follow from the demonstration, and they are the ones a reviewer of an agent system should check for. First, *the size of the window is a design decision with a price*: the book notes that attention over a long context is quadratic in its length, so a larger window is not free even when the model supports it. Second, *compression is lossy in a way that is hard to see*: a summary that says the test run completed is not a summary that says the tests passed. Third, *external memory changes what "lost" means*: paging something out does not destroy it, but an agent that can recall one item per turn has to choose well, and a retrieval heuristic that ranks by apparent relevance will sometimes pick the wrong one.',
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'The window is a budget, not a buffer',
          markdown:
            'The harness does not accumulate context; it spends it. Every tool result, every retrieved passage and every turn of dialogue competes for the same finite number of tokens, and the system prompt and the task are usually protected — which means the material that loses is always the material that arrived first, or the material that looked least interesting. The Model Context Protocol (§11.4) exists because this problem recurs in every tool-using application.',
        },
        {
          kind: 'demo',
          demo: 'memory',
          title: 'What the agent remembers, and what it forgets',
          intro:
            'Memory is a set of design decisions, and each of them can be wrong in a way that is invisible until the agent fails. Shrink the store until a fact is evicted, and then ask whether the agent could still answer the question it needed answered.',
        },
        {
          kind: 'lab-link',
          labId: 'memory',
          title: 'Tune a memory system',
          description:
            'Lab B lets you change capacity, retrieval strategy and relevance weighting, then watch what is remembered, retrieved, omitted and how decisions change.',
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
            'A team wants an agent that gets better at their specific ticket system every day without a retraining pipeline. Which interaction style are they implicitly asking for, and what do they need before style E is even possible?',
          answer:
            'They want reinforcement finetuning (Style E), where parameters change from interaction rewards — but E requires *verifiable* rewards. If ticket resolutions can be scored automatically (tests pass, customer reopens, SLA met), an RLVR loop is plausible; if the only signal is human opinion, the practical design is Style D (harness adaptation) plus explicit memory, with periodic offline finetuning.',
        },
        {
          kind: 'predict',
          question: {
            id: 'p7-style',
            prompt:
              'A team wants an agent that gets better at their ticket system every day, with no retraining pipeline of their own. Which interaction style are they implicitly asking for, and what would they still need?',
            options: [
              'Style A, the query prompt — and nothing more.',
              'Style D, the self-reflection harness: it learns in context from its own feedback. It would still need a verifier, because self-reflection can only check what can be checked.',
              'Style E, reinforcement finetuning — it does not need a pipeline, because the harness does the learning.',
              'Style B, in-context learning — the examples in the prompt accumulate.',
            ],
            correct: 1,
            explanation:
              'Improving every day without a retraining pipeline is style D, the self-reflection harness: the agent stores a reflection of what went wrong and feeds it back next time. But it needs a *verifier* — a checker, a test, a rule — because self-reflection can only be correct about outcomes that can be determined. That is the same requirement that makes style E possible at all (Ch. 6, §6.2.4.2–6.2.4.3).',
            source: { label: 'Ch. 9, §9.2.1 Interaction styles; Ch. 6, §6.2.4.3', chapter: 9, section: '9.2.1', primary: true },
            difficulty: 'core',
          },
        },
      ],
    },
  ],
  quiz: [
    {
      id: 'q7-1',
      prompt: 'In the textbook\'s five interaction styles, what changes in Style E relative to Style D?',
      options: [
        'The prompt becomes static again.',
        'The model parameters are finetuned using rewards collected from interaction, in addition to policy learning.',
        'The environment is removed from the loop.',
        'The LLM is replaced by a search algorithm.',
      ],
      correct: 1,
      explanation:
        'Style D learns in context; Style E (reinforcement finetuning) also updates the model parameters θ from rewards generated during interaction, blurring the inference/finetuning boundary (Ch. 9, §9.2.1.5).',
      source: { label: 'Ch. 9, §9.2.1.5 Reinforcement Finetuning Harness', chapter: 9, section: '9.2.1.5', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q7-2',
      prompt: 'Which of the following is NOT listed as a motivation for agent memory?',
      options: [
        'Coherent conversation',
        'Adaptation to a changed environment',
        'Removing the need for a tokenizer',
        'Continual learning without catastrophic forgetting',
      ],
      correct: 2,
      explanation:
        'Chapter 9 §9.3.1 motivates memory with coherent conversation, adaptation, identity and continual learning. Tokenization is a fixed property of the model, not a memory problem.',
      source: { label: 'Ch. 9, §9.3.1 The Need for Memory', chapter: 9, section: '9.3.1', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q7-3',
      prompt: 'Why is the moving-target problem specifically hard for dynamic metalearning?',
      options: [
        'Because the inner task changes while the outer loop is training, so the objective never settles and learning can fail to converge.',
        'Because reinforcement learning cannot handle language.',
        'Because memory is always infinite.',
        'Because prompts cannot be searched.',
      ],
      correct: 0,
      explanation:
        'When training targets keep changing, convergence is not guaranteed; Chapter 8 discusses stabilizing dynamic metalearning and Chapter 9 §9.2.1.4 notes that predictable self-reflection performance is still an active research area.',
      source: { label: 'Ch. 8, §8.4; Ch. 9, §9.2.1.4', chapter: 8, section: '8.4', primary: true },
      difficulty: 'advanced',
    },
  ],
  sources: [
    { label: 'Ch. 9, §9.1 Agents in AI', chapter: 9, section: '9.1', page: 193, primary: true },
    { label: 'Ch. 9, §9.2 Learning Mechanisms / Interaction Styles', chapter: 9, section: '9.2', page: 197, primary: true },
    { label: 'Ch. 9, §9.3 Memory Architectures', chapter: 9, section: '9.3', page: 202, primary: true },
    { label: 'Ch. 8, §8.2 Inner/Outer Loop', chapter: 8, section: '8.2', page: 183, primary: true },
    { label: 'Ch. 8, §8.4 Stabilizing Dynamic Metalearning', chapter: 8, section: '8.4', page: 186, primary: true },
  ],
  furtherReading: [
    {
      referenceId: 'packer-2023-memgpt',
      note:
        'MemGPT: memory as an operating system, with paging between a small context and a larger store. The paging policy in the context-window demonstration is this idea made concrete.',
    },
    {
      referenceId: 'liu-2023-lost-in-middle',
      note:
        'The measured U-shaped curve for long contexts. This is the effect the demonstration reproduces: a decisive fact in the middle of a prompt is used least well.',
    },
    {
      referenceId: 'mu-2023-gist',
      note:
        'Learned prompt compression — and the authors’ own admission that compression necessarily loses nuance, which is the trade the demonstration makes visible.',
    },
    {
      referenceId: 'zhong-2024-memorybank',
      note:
        'Hierarchical summaries of a user’s interactions, with forgetting driven by an Ebbinghaus curve.',
    },
    {
      referenceId: 'zhou-2025-mem1',
      note:
        'A compact state updated after every interaction, so the state cannot run out of the context window.',
    },
  ],
  provenance: {
    textbookChapters: [8, 9],
    supplementaryNote:
      'The ticket-system checkpoint and the memory trade-off table are original synthesis; the five-style table transcribes the structure of the book\'s Table 9.1 with examples drawn from the chapter text.',
  },
  keywords: ['agent styles', 'harness', 'RLVR', 'memory', 'MemGPT', 'metalearning', 'moving target'],
}

export const lessonTools: LessonContent = {
  id: 'lesson-08-tools',
  slug: 'tools-and-context',
  secondaryParts: [],
  order: 8,
  part: 'part-4-tools-assistants',
  title: 'Tools, Context Management and Robustness',
  summary:
    'Why agents need tools, the architecture patterns for tool use, the Model Context Protocol, and what to do when a tool fails — including context management and safety.',
  minutes: 42,
  difficulty: 'core',
  prerequisites: ['interaction-styles-and-memory'],
  objectives: [
    { text: 'Explain why tool access is essential for agents that act beyond text generation.', source: 'Ch. 11, §11.1' },
    { text: 'Distinguish direct invocation from the Planner–Caller–Summarizer pattern.', source: 'Ch. 11, §11.2–11.3' },
    { text: 'Describe the ReAct loop and how a LangChain-style tool definition reaches the model.', source: 'Ch. 11, §11.3.1' },
    { text: 'Explain MCP\'s client–server architecture and its two protocol layers.', source: 'Ch. 11, §11.4' },
    { text: 'Apply reactive error handling, self-correction and human-in-the-loop as recovery strategies.', source: 'Ch. 11, §11.5' },
    { text: 'Identify security risks introduced by giving an agent external access.', source: 'Ch. 11, §11.6' },
  ],
  sections: [
    {
      id: 'why-tools',
      title: 'Why tools change what an agent can do',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'A language model can describe a database query; a tool can run one. Chapter 11 makes the case that tools are what convert language competence into effect: retrieval, computation, code execution, browsing, and control of other systems. The model supplies the *decision*; the tool supplies the *capability* and, crucially, a deterministic result the model can check against.',
        },
        {
          kind: 'list',
          items: [
            'Deterministic computation: calculations, parsing, file operations.',
            'Fresh information: search and retrieval beyond the training cutoff.',
            'Side effects: sending mail, filing tickets, changing state in another system.',
            'Environments as APIs: a browser or a desktop exposed as callable actions.',
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'A tool call is a commitment',
          markdown:
            'Read-only tools are cheap to retry; tools with side effects are not. Separate the two classes in your harness and gate the second with confirmation, idempotency keys, or a simulated dry run — the human-in-the-loop pattern of §11.5.',
        },
      ],
    },
    {
      id: 'patterns',
      title: 'Architecture patterns for tool use',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'The simplest pattern is direct invocation: one tool description in the prompt, one call. It scales badly because tool selection itself becomes a hard reasoning problem as the catalogue grows, and results must be summarised for the user. The book presents a three-role decomposition that addresses both problems.',
        },
        {
          kind: 'table',
          caption: 'Planner–Caller–Summarizer (Ch. 11, §11.3, Figure 11.1)',
          headers: ['Role', 'Responsibility', 'Failure signature'],
          rows: [
            ['Planner', 'Decide which tool and which arguments', 'Wrong tool chosen, or no call attempted'],
            ['Caller', 'Write the concrete request and invoke it', 'Malformed arguments, wrong endpoint/version'],
            ['Summarizer', 'Turn raw output into an answer for the user', 'Faithfulness errors, lost detail'],
          ],
        },
        {
          kind: 'prose',
          markdown:
            'Separating the roles makes failure attributable. If the answer is wrong because the wrong tool was chosen, that is a planner problem, not a summarisation problem, and the fix is different in each case. Chapter 14 applies exactly this separation to a multi-agent medical diagnosis pipeline, where planner errors and executor errors are scored independently.',
        },
        {
          kind: 'diagram',
          diagram: 'react-cycle',
          caption:
            'The ReAct loop: the model emits a thought and an action, the harness executes the action, and the observation returns to the context. Error messages are observations too.',
        },
        {
          kind: 'demo',
          demo: 'tool-selection',
          title: 'Choosing a tool and filling in its arguments',
          intro:
            'Tool selection is a *decision*, and it is the part students most often get wrong when they first build an agent. Take the role of the planner: pick a tool from a catalogue that deliberately contains near-duplicates, and fill in the arguments its schema demands. The harness will tell you what it would have done — including the errors it raises before the tool ever runs.',
        },
        {
          kind: 'code',
          language: 'python',
          caption: 'Tool definition shape (structure only; see Ch. 11, Listing 11.1)',
          code: `@tool
def is_prime(number: int) -> str:
    """Checks if a given integer is a prime number.

    The docstring is the description the LLM reads when
    deciding whether to call this tool.
    """
    ...

# The agent is then given: the model, the tool list, and a
# loop type that reasons about which tool to use (ReAct-style).
agent = initialize_agent(tools=[is_prime], llm=llm, agent=ZERO_SHOT_REACT)`,
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'The docstring is the interface',
          markdown:
            'Because the model selects tools by reading their descriptions, writing clear tool documentation is prompt engineering. Vague names, ambiguous parameters and missing examples are the most common cause of bad tool selection.',
        },
      ],
    },
    {
      id: 'mcp',
      title: 'MCP: a standard port for tools',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Every integration being bespoke is a maintenance problem: N hosts times M tools. The **Model Context Protocol** introduced by Anthropic standardises the connection, described in the book as a "USB-C port for AI". An MCP *host* (the AI application) manages one or more *clients*, each maintaining a connection to an MCP *server* that provides tools, resources and prompts.',
        },
        {
          kind: 'diagram',
          diagram: 'mcp-topology',
          caption:
            'MCP topology: a host managing several clients, each connected to a server via STDIO (local) or Streamable HTTP (remote).',
        },
        {
          kind: 'table',
          caption: 'The two protocol layers (Ch. 11, §11.4)',
          headers: ['Layer', 'Contents'],
          rows: [
            ['Data layer', 'JSON-RPC communication: capability/version discovery, tools, resources, prompts, notifications'],
            ['Transport layer', 'Connection management, message framing, authorization (STDIO for local, Streamable HTTP for remote)'],
          ],
        },
        {
          kind: 'prose',
          markdown:
            'The protocol deliberately leaves context management to the host, and MCP servers are mostly stateless. So a standard port solves *connectivity* but not *memory*: you still need summarisation of tool outputs, explicit state/scratchpad variables, and prioritised retrieval so that a long multi-step task does not drown in its own history.',
        },
      ],
    },
    {
      id: 'robustness',
      title: 'Robustness, recovery and safety',
      blocks: [
        {
          kind: 'list',
          items: [
            '**Reactive error handling** — feed the error message back as an observation so the model can retry, correct arguments, choose another tool, or escalate to the user.',
            '**Self-correcting systems** — Healer-style runtime repair generates a small patch for a faulty state instead of aborting.',
            '**Human-in-the-loop** — pause before high-stakes actions; combine model speed with human judgment.',
            '**Context management** — summarise, keep a scratchpad, retrieve only what is relevant to the current step.',
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Security surface',
          markdown:
            'Tools expand the attack surface: untrusted content can attempt prompt injection, tool arguments can be manipulated, and credentials can leak through context. Treat all tool output as untrusted data, keep secrets out of prompts, and constrain what each tool can reach (Ch. 11, §11.6).',
        },
        {
          kind: 'example',
          title: 'Recovery in practice',
          steps: [
            { label: 'Attempt', detail: 'The agent calls weather_api(city="Utrecht", units="C"). The service returns HTTP 503.' },
            { label: 'Observe', detail: 'The harness appends: "Tool error: weather_api failed with 503 (service unavailable)".' },
            { label: 'Reflect', detail: 'The model decides between retrying, using a different provider, or reporting the limitation.' },
            { label: 'Act', detail: 'It retries once after the harness applies a short backoff; on a second failure it reports that the forecast is unavailable and continues with the rest of the task.' },
            { label: 'Score', detail: 'The trace records one failure and a successful partial completion — the kind of outcome an evaluation harness can measure.' },
          ],
          takeaway:
            'Errors are observations. An agent that never sees a failure cannot recover from one, and a harness that hides failures produces confidently wrong answers.',
        },
      ],
    },
    {
      id: 'assistants',
      title: 'From tools to assistants',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Chapter 13 is the chapter where the book stops talking about tools and starts talking about **assistants**, and the difference is one of policy rather than capability. A tool does what it is told. An assistant decides what to do, when to do it, and when to stop and ask. The same model, the same tools and the same harness produce a tool-like system or an assistant-like one depending on that decision.',
        },
        {
          kind: 'table',
          caption: 'The domains Chapter 13 surveys (Ch. 13, §13.2–13.8)',
          headers: ['Domain', 'What the assistant does', 'What makes it hard'],
          rows: [
            ['Conversational', 'Meeting minutes, chairing, general administration', 'It is in the room; its interventions can feel unnatural'],
            ['Shopping', 'Search, order, cancel, return', 'The details are small and the volume is large'],
            ['Flight operations', 'Read the schedule, answer disruptions, propose reroutes', 'An action in the air cannot be undone'],
            ['Medical', 'Answer staff questions, book, draft referrals', 'A confident error is a clinical one'],
            ['Trading', 'Analyse and propose positions', 'The market does not wait for a question'],
            ['Scientific discovery', 'Form hypotheses, run and read experiments', 'The expensive part is the experiment, not the reasoning'],
            ['Coding', 'Write, run, test, revise', 'The feedback loop is free, which is why it works best'],
          ],
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'The advice, in the chapter\'s own terms',
          markdown:
            'Chapter 13 §13.9 gives unusually concrete guidance: build architectures that "retrieve evidence, justify actions and defer to humans under uncertainty"; treat tools as modular components with explicit contracts and failure modes; log decisions, plans and intermediate states so the system can be debugged and audited; and in high-stakes domains, "design for graceful degradation — an agent asking for clarification or abstaining is preferable to confident error".',
        },
        {
          kind: 'prose',
          markdown:
            'The last clause is the one with a design decision inside it. **Asking and abstaining are not the same thing**, and neither is the same as being unsure. A request that is missing a detail is answered by asking. A request that is not the assistant\'s to handle — clinical advice, an image the assistant cannot interpret, a decision that belongs to a person in the room — is answered by declining, because no amount of clarifying would make it the right instrument.',
        },
        {
          kind: 'demo',
          demo: 'escalation',
          title: 'When should an assistant act, and when should it ask?',
          intro:
            'Three policies, three domains, and the same requests in each. The point is not that one policy wins; it is that the winner depends on what a mistake costs, and that a policy which is "safe" because it refuses everything is safe and useless. Change the domain and watch the same policy become reckless or useless.',
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Domain sensitivity is a design constraint',
          markdown:
            'The chapter is explicit that "not all assistants operate under the same constraints", and that medicine and aviation "demand strong guarantees on safety, robustness, transparency and fairness". The EU AI Act and comparable regimes are not decoration on the design; they change what the assistant is allowed to do on its own. A threshold tuned for a shop is a safety incident in a clinic.',
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
            'You connect twenty tools through MCP and the agent starts choosing the wrong ones. Which layer is at fault, and what are the two most direct fixes?',
          answer:
            'Tool *selection* is a planner-level problem. Direct fixes: improve the tool interface (names, parameter descriptions, examples — the model reads the docstring), and reduce the choice set per step by grouping or routing tools instead of exposing all twenty at once. A third structural fix is the Planner–Caller–Summarizer split, so a dedicated planner sees the catalogue while the caller handles invocation.',
        },
        {
          kind: 'predict',
          question: {
            id: 'p8-tools',
            prompt:
              'Two tools in your catalogue have almost identical descriptions. The agent keeps choosing the wrong one. Which change is most likely to help?',
            options: [
              'Make the descriptions more detailed, so there is more text for the model to read.',
              'Make the descriptions distinguish the tools — state what each is for and when to prefer it.',
              'Add a retry loop, so a wrong choice is eventually corrected.',
              'Lower the temperature, so the model is less creative in its choices.',
            ],
            correct: 1,
            explanation:
              'The model chooses between tools by reading their descriptions. If the descriptions do not distinguish the tools, no amount of extra text, retries or lower temperature fixes the discrimination problem — the choice stays arbitrary. The fix is *discriminability*: say what each tool is for and when to prefer it (Ch. 11, §11.2–11.3).',
            source: { label: 'Ch. 11, §11.2–11.3 Tool use architectures', chapter: 11, section: '11.2', primary: true },
            difficulty: 'core',
          },
        },
        {
          kind: 'lab-link',
          labId: 'workflow-builder',
          title: 'Trace tool calls',
          description:
            'In the workflow builder, open a scenario that calls tools and inspect every tool input and output in the execution trace, including the injected failure scenario.',
        },
      ],
    },
  ],
  quiz: [
    {
      id: 'q8-1',
      prompt: 'In the Planner–Caller–Summarizer architecture, which failure does the Summarizer own?',
      options: [
        'Choosing the wrong tool',
        'Producing an unfaithful or incomplete answer from the tool\'s raw output',
        'Malformed tool arguments',
        'Expiring API credentials',
      ],
      correct: 1,
      explanation:
        'The planner chooses tools, the caller writes the concrete request, and the summarizer turns the result into a user-facing answer — so faithfulness and completeness of that answer are its responsibility (Ch. 11, §11.3, Figure 11.1).',
      source: { label: 'Ch. 11, §11.3 APIs and Toolchains', chapter: 11, section: '11.3', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q8-2',
      prompt: 'What does the Model Context Protocol standardise, and what does it deliberately leave to the host?',
      options: [
        'It standardises model weights; it leaves tokenization to the host.',
        'It standardises how clients connect to servers and exchange tools/resources/prompts; context and state management remain the host\'s job.',
        'It standardises reward functions; it leaves data collection to the host.',
        'It standardises GPUs; it leaves cooling to the host.',
      ],
      correct: 1,
      explanation:
        'MCP defines JSON-RPC data-layer primitives and transport-layer behaviour. Servers are mostly stateless, so summarisation, state management and prioritised retrieval are still the host application\'s responsibility (Ch. 11, §11.4).',
      source: { label: 'Ch. 11, §11.4 Model Context Protocol', chapter: 11, section: '11.4', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q8-3',
      prompt: 'What is the most basic reactive error-handling pattern for agent tool use?',
      options: [
        'Silently retry forever.',
        'Return the error message to the model as an observation so it can correct course.',
        'Abort the whole session on any error.',
        'Hide errors from the user and invent a plausible answer.',
      ],
      correct: 1,
      explanation:
        'Feeding the error back as an observation creates the observe–reflect–retry loop: the model can fix arguments, switch tools, or inform the user (Ch. 11, §11.5).',
      source: { label: 'Ch. 11, §11.5 Robustness, Error Handling, and Recovery', chapter: 11, section: '11.5', primary: true },
      difficulty: 'core',
    },
  ],
  sources: [
    { label: 'Ch. 11, §11.1 Why Tools Matter', chapter: 11, section: '11.1', page: 227, primary: true },
    { label: 'Ch. 11, §11.2–11.3 Tool Use Architectures, APIs and Toolchains', chapter: 11, section: '11.2', page: 228, primary: true },
    { label: 'Ch. 11, §11.4 Model Context Protocol', chapter: 11, section: '11.4', page: 232, primary: true },
    { label: 'Ch. 11, §11.5 Robustness and Recovery', chapter: 11, section: '11.5', page: 233, primary: true },
    { label: 'Ch. 11, §11.6 Safety and Security', chapter: 11, section: '11.6', page: 236, primary: true },
    { label: 'Ch. 13, §13.1 Agentic LLMs as Assistants', chapter: 13, section: '13.1', page: 263, primary: true },
    { label: 'Ch. 13, §13.2–13.8 The assistant domains', chapter: 13, section: '13.3', page: 265, primary: true },
    { label: 'Ch. 13, §13.9 Concluding Remarks: domain sensitivity and practical advice', chapter: 13, section: '13.9', page: 272, primary: true },
  ],
  furtherReading: [
    {
      referenceId: 'mcp',
      note:
        'The Model Context Protocol, which exists because the context-management problem this lesson describes recurs in every tool-using application.',
    },
  ],
  provenance: {
    textbookChapters: [11, 13],
    supplementaryNote:
      'The tool-definition snippet is a schematic restatement of the book\'s Listing 11.1 (LangChain example), shown in abbreviated structural form; no third-party code is redistributed. ReAct, Healer and OmniParser are cited as research systems.',
  },
  keywords: ['tools', 'ReAct', 'MCP', 'Planner-Caller-Summarizer', 'error handling', 'security'],
}

export const lessonRetrieval: LessonContent = {
  id: 'lesson-09-retrieval',
  slug: 'search-and-retrieval',
  secondaryParts: [],
  order: 9,
  part: 'part-4-tools-assistants',
  title: 'Search, Retrieval and Agentic RAG',
  summary:
    'Bag-of-words to dense embeddings, the RAG pipeline from indexing to generation, adaptive retrieval, retrieval over graphs/code/tables, evaluation metrics, and what makes agentic RAG different.',
  minutes: 44,
  difficulty: 'core',
  prerequisites: ['tools-and-context'],
  objectives: [
    { text: 'Explain the progression from bag-of-words and vector space models to dense latent representations.', source: 'Ch. 12, §12.1' },
    { text: 'Describe each stage of the RAG pipeline: index, chunk, embed, retrieve, generate.', source: 'Ch. 12, §12.3' },
    { text: 'Distinguish adaptive retrieval approaches (Self-RAG, Self-Ask) from one-shot retrieval.', source: 'Ch. 12, §12.4' },
    { text: 'Recognise retrieval targets beyond plain text: graphs, code via ASTs, tables, multi-modal sources.', source: 'Ch. 12, §12.5' },
    { text: 'Evaluate retrieval with Recall@k, Mean Reciprocal Rank and faithfulness.', source: 'Ch. 12, §12.7' },
  ],
  sections: [
    {
      id: 'retrieval-basics',
      title: 'From keyword overlap to semantic neighbours',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Chapter 12 builds retrieval from first principles. Bag-of-words represents a document by which words occur in it, ignoring order — easy to implement, weak on paraphrase. Vector space models add geometry. Latent and sparse representations split the design space: sparse methods such as learned term weights stay interpretable and exact-match friendly, while dense embeddings capture semantic similarity that shares no keywords.',
        },
        {
          kind: 'table',
          caption: 'Representation strategies (Ch. 12, §12.1–12.2)',
          headers: ['Approach', 'Strengths', 'Weaknesses'],
          rows: [
            ['Bag of words / sparse lexical', 'Exact terms, identifiers, names', 'No paraphrase handling, no word order'],
            ['Dense embeddings', 'Semantic match across vocabulary', 'Needs training/infra; can drift to topical rather than exact matches'],
            ['Hybrid', 'Combines both signals', 'More moving parts; score fusion must be tuned'],
          ],
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'Why retrieval matters for agents',
          markdown:
            'An agent has two ways to know something: in its weights, or in its context. Retrieval chooses the second, which is updatable, auditable and citable. For agentic work that must respect current facts and private documents, that choice is usually not optional.',
        },
      ],
    },
    {
      id: 'pipeline',
      title: 'The RAG pipeline',
      blocks: [
        {
          kind: 'diagram',
          diagram: 'rag-pipeline',
          caption:
            'RAG end to end: ingest and chunk documents, embed and index them, formulate a query, retrieve candidates, optionally rerank, then generate an answer grounded in the retrieved passages.',
        },
        {
          kind: 'list',
          ordered: true,
          items: [
            'Ingest: collect documents and record provenance.',
            'Chunk: split into retrievable units sized to the embedding model and the answer granularity you need.',
            'Embed and index: store vectors (and, usefully, lexical indexes too).',
            'Formulate: turn the user request, or the agent\'s sub-question, into a query.',
            'Retrieve and rerank: fetch candidates, then order them by relevance.',
            'Generate: answer with the passages in context, and cite them.',
          ],
        },
        {
          kind: 'prose',
          markdown:
            'Every stage is a place where the answer can go wrong, and the failure modes are different. Bad chunking splits a definition across two chunks; a bad query retrieves the wrong neighbourhood entirely; a reranker that disagrees with the retriever throws away the correct passage; a generator that ignores its context hallucinates regardless of retrieval quality.',
        },
      ],
    },
    {
      id: 'adaptive',
      title: 'Adaptive and agentic retrieval',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'One-shot retrieval assumes you know what to ask. Adaptive methods change that: **Self-RAG** decides when retrieval is needed and critiques the usefulness of what came back, while **Self-Ask** decomposes a complex question into sub-questions that each trigger their own lookup. Query rewriting and expansion attack the formulation stage directly.',
        },
        {
          kind: 'table',
          caption: 'Simple RAG versus agentic RAG (Ch. 12, §12.6)',
          headers: ['Property', 'Simple RAG', 'Agentic RAG'],
          rows: [
            ['Control flow', 'Fixed: retrieve once, then generate', 'Model-driven: decide whether/when/what to retrieve, possibly repeatedly'],
            ['Query strategy', 'The user\'s query (maybe rewritten once)', 'Decomposed sub-questions, rewrites, multi-hop chains'],
            ['Failure handling', 'Returns whatever was retrieved', 'Can detect insufficiency and retry, escalate, or use a tool'],
            ['Evaluation', 'Retrieval metrics + answer quality', 'Plus trajectory quality: was the retrieval effort well spent?'],
          ],
        },
        {
          kind: 'prose',
          markdown:
            'Beyond prose, the chapter extends retrieval to graphs (following relations between entities), code (using ASTs plus embeddings so that a function is retrieved with its call sites), tabular data, and multi-modal sources. Real-time and streaming variants make retrieval continuous rather than a one-time pre-processing step.',
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Retrieved text is untrusted input',
          markdown:
            'Documents are data, not instructions. A retrieved page that says "ignore your previous instructions" is a prompt-injection attempt. Keep retrieved content clearly delimited as data, and never let it silently change the agent\'s operating constraints (§11.6).',
        },
      ],
    },
    {
      id: 'evaluation',
      title: 'Evaluating retrieval',
      blocks: [
        {
          kind: 'list',
          items: [
            '**Recall@k** — of the relevant items, how many appear in the top k? Measures whether retrieval misses evidence.',
            '**Mean Reciprocal Rank** — how high is the first relevant hit? Measures whether the useful passage is early enough to matter.',
            '**Faithfulness** — does the generated answer actually follow from the retrieved context? Measures hallucination after retrieval.',
          ],
        },
        {
          kind: 'formula',
          latex:
            '\\mathrm{MRR} = \\frac{1}{|Q|}\\sum_{i=1}^{|Q|} \\frac{1}{\\mathrm{rank}_i}',
          caption:
            'Mean reciprocal rank: the reciprocal of the rank of the first relevant result, averaged over queries (Ch. 12, §12.7).',
        },
        {
          kind: 'demo',
          demo: 'retrieval',
          title: 'Getting the right passage into the window',
          intro:
            'Recall@k measures whether the right passage was retrieved. It does not measure whether the model *used* it, and the gap between those two questions is where most retrieval failures live. Choose how many passages to retrieve and how they are chosen, and watch the decisive passage fail twice over: once by being left out, and once by being retrieved and then put where the model will not look.',
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'Recall is not use',
          markdown:
            'The metrics above are computed over the *retrieved* set. Chapter 9 §9.3.2.2 adds the other half of the story: the window is finite, and the position of a passage inside it changes how much of it the model actually uses. A pipeline can have perfect Recall@k and still answer wrongly, because the decisive passage was retrieved and then buried in the middle of the prompt. The two failures need different fixes — the first needs a better retriever, the second needs a better *arrangement*.',
        },
        {
          kind: 'callout',
          tone: 'source',
          title: 'Build it, do not just read it',
          markdown:
            'The chapter includes a dense retrieval example in Python, a graph retrieval example, a code retrieval example using ASTs and embeddings, and a multi-modal example. Each is a small, self-contained pipeline — good material for the final project.',
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
            'Your agent answers a multi-hop question ("which of our suppliers shipped the part that failed?") incorrectly. Retrieval returns the right documents. Where do you look first, and why?',
          answer:
            'First check whether retrieval was *composed* correctly: a single-query pipeline cannot express this two-hop question, so the query-formation or agentic layer needs to decompose it (Self-Ask style) or chain retrievals. Then check generation faithfulness, because the right documents can still be misread. Keep the two concerns separate — that is why evaluation reports retrieval metrics and faithfulness separately.',
        },
        {
          kind: 'predict',
          question: {
            id: 'p9-multihop',
            prompt:
              'A multi-hop question is answered wrongly even though retrieval returns the right documents. Where do you look first?',
            options: [
              'The retriever — it is returning documents that look right but are not the ones the question is about.',
              'The query formulation: the question has two hops, and one query cannot reach both, so the agent needs to decompose it and retrieve again for the second hop.',
              'The model — it cannot read the retrieved documents.',
              'The chunk size — the documents are being split badly.',
            ],
            correct: 1,
            explanation:
              'If the right documents come back, the retriever is not the first suspect. A multi-hop question needs two retrievals: one to find the part, one to find the supplier who shipped it. A single flat query retrieves for one hop and leaves the other to chance, which is exactly the problem the adaptive-retrieval methods address by decomposing the question and asking again (Ch. 12, §12.4.1; §12.5).',
            source: { label: 'Ch. 12, §12.4.1 Adaptive retrieval; §12.5', chapter: 12, section: '12.4.1', primary: true },
            difficulty: 'core',
          },
        },
        {
          kind: 'lab-link',
          labId: 'memory',
          title: 'See retrieval fail on purpose',
          description:
            'The memory demonstration in this lesson shrinks the store until a decisive fact is evicted; the memory laboratory lets you tune capacity, top-k and relevance weighting.',
        },
      ],
    },
  ],
  quiz: [
    {
      id: 'q9-1',
      prompt: 'What distinguishes agentic RAG from simple one-shot retrieval?',
      options: [
        'Agentic RAG always uses a larger embedding model.',
        'The agent decides whether, when and what to retrieve, and can iterate — decomposing queries and reacting to insufficient results.',
        'Agentic RAG does not use an index.',
        'Agentic RAG works only on code.',
      ],
      correct: 1,
      explanation:
        'Chapter 12 §12.6 contrasts a fixed retrieve-then-generate pipeline with model-driven retrieval control: adaptive decision-making, multi-hop querying and recovery when retrieval is insufficient.',
      source: { label: 'Ch. 12, §12.6 Agentic RAG', chapter: 12, section: '12.6', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q9-2',
      prompt: 'Which metric tells you whether the first relevant document appears near the top of the ranking?',
      options: ['Recall@k', 'Mean Reciprocal Rank', 'Perplexity', 'Exact match'],
      correct: 1,
      explanation:
        'MRR averages the reciprocal rank of the first relevant result, so a relevant document at rank 1 scores 1.0 while rank 10 scores 0.1 (Ch. 12, §12.7).',
      source: { label: 'Ch. 12, §12.7 Evaluation', chapter: 12, section: '12.7', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q9-3',
      prompt: 'Why can dense embeddings fail where a sparse lexical method succeeds?',
      options: [
        'Dense embeddings cannot represent rare words at all.',
        'Dense embeddings capture topical similarity and may miss exact identifiers or rare terms, which lexical matching handles directly.',
        'Sparse methods always rank semantically better.',
        'Because sparse methods do not need an index.',
      ],
      correct: 1,
      explanation:
        'Semantic proximity is not exact match: identifiers, error codes and rare names are often better served by lexical signals, which is the argument for hybrid retrieval (Ch. 12, §12.1–12.3).',
      source: { label: 'Ch. 12, §12.1 Retrieval in General', chapter: 12, section: '12.1', primary: true },
      difficulty: 'advanced',
    },
  ],
  sources: [
    { label: 'Ch. 12, §12.1 Retrieval in General', chapter: 12, section: '12.1', page: 241, primary: true },
    { label: 'Ch. 12, §12.3 Retrieval-Augmented Generation Pipeline', chapter: 12, section: '12.3', page: 244, primary: true },
    { label: 'Ch. 12, §12.4 Adaptive Retrieval Methods', chapter: 12, section: '12.4', page: 246, primary: true },
    { label: 'Ch. 12, §12.5 Graphs, Code, Tabular Data', chapter: 12, section: '12.5', page: 249, primary: true },
    { label: 'Ch. 12, §12.6 Agentic RAG', chapter: 12, section: '12.6', page: 254, primary: true },
    { label: 'Ch. 12, §12.7 Evaluation', chapter: 12, section: '12.7', page: 255, primary: true },
  ],
  furtherReading: [
    {
      referenceId: 'lewis-2020-rag',
      note:
        'The original retrieval-augmented generation recipe, and the separation of parametric from non-parametric memory that the chapter builds on.',
    },
    {
      referenceId: 'asai-2023-selfrag',
      note:
        'Self-RAG: deciding at run time whether to retrieve, and critiquing what came back.',
    },
    {
      referenceId: 'press-2022-selfask',
      note:
        'Question decomposition for multi-hop retrieval, and the measurement of what decomposition buys.',
    },
  ],
  provenance: {
    textbookChapters: [12],
    supplementaryNote:
      'The supplier multi-hop checkpoint is original teaching material applying §12.4\'s decomposition ideas. Self-RAG and Self-Ask are third-party research methods described from the book\'s summary.',
  },
  keywords: ['RAG', 'embeddings', 'Self-RAG', 'Self-Ask', 'recall@k', 'MRR', 'faithfulness'],
}
