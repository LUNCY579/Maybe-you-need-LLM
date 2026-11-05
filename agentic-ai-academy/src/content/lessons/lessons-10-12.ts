import type { LessonContent } from '../../types/curriculum'

export const lessonBehavior: LessonContent = {
  id: 'lesson-10-behavior',
  slug: 'behavior-strategy-multi-agent',
  secondaryParts: ['part-4-tools-assistants'],
  order: 10,
  part: 'part-5-behavior-cognition',
  title: 'Behavior, Strategy and Multi-Agent Systems',
  summary:
    'How to study agent behaviour experimentally: social competences, cooperation and coordination in games, theory of mind, role-based multi-agent collaboration, and emergent conventions in societies of agents.',
  minutes: 50,
  difficulty: 'core',
  prerequisites: ['interaction-styles-and-memory'],
  objectives: [
    { text: 'Explain the machine-behaviour research programme and what behavioural testing can and cannot show.', source: 'Ch. 15, §15.1–15.2' },
    { text: 'Summarise findings on cooperation and coordination in game-theoretic settings.', source: 'Ch. 15, §15.4' },
    { text: 'Describe theory-of-mind testing and the knowing–doing gap.', source: 'Ch. 15, §15.5' },
    { text: 'Distinguish role-based multi-agent interaction from emergent open-ended simulation.', source: 'Ch. 16, §16.1; Ch. 17, §17.1' },
    { text: 'Explain how norms and conventions can emerge from local interactions.', source: 'Ch. 17, §17.3' },
    { text: 'Assess when multi-agent collaboration helps and what new failure modes it introduces.', source: 'Ch. 16, §16.3–16.4' },
  ],
  sections: [
    {
      id: 'machine-behavior',
      title: 'Studying behaviour, not just benchmarks',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Machine behaviour research treats intelligent machines as objects of scientific study: not "does it score well?" but "how does it behave, under what conditions, compared to what?". For agentic LLMs this requires controlled experimental setups — games, dilemmas, social scenarios — where the interaction is scripted and the outcome is measurable.',
        },
        {
          kind: 'table',
          caption: 'What behavioural experiments can and cannot establish (Ch. 15, §15.1–15.2)',
          headers: ['Can show', 'Cannot show'],
          rows: [
            ['How a system behaves in a specified setting', 'Why it behaves that way internally'],
            ['Comparisons across models, prompts and opponents', 'That a human-like answer implies a human-like mechanism'],
            ['Sensitivity of behaviour to framing and context', 'Robustness beyond the tested distribution'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Construct validity',
          markdown:
            'A response that reads as empathetic is behaviour, not evidence of a felt state. The book repeats this caution throughout Part V and revisits it in Chapter 22 with three levels of evidence: behavioural, representational, mechanistic.',
        },
      ],
    },
    {
      id: 'strategy',
      title: 'Cooperation, coordination and the knowing–doing gap',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'The empirical picture from Chapter 15 is specific and interesting. In the iterated **Prisoner\'s Dilemma**, models tend to be surprisingly cooperative — at least as cooperative as typical human players — with substantial variation: some are forgiving, others retaliate permanently after a single defection. In **coordination** games such as Bach or Stravinsky, the same models often fail to converge on the turn-taking pattern humans adopt.',
        },
        {
          kind: 'table',
          caption: 'Two game classes, two different failures (Ch. 15, §15.4)',
          headers: ['Game', 'Observable behaviour', 'Interpretation'],
          rows: [
            ['Iterated Prisoner\'s Dilemma', 'Often cooperative, sometimes unforgiving after one defection', 'Cooperation exists but its dynamics differ across models'],
            ['Bach or Stravinsky', 'Chooses own preference repeatedly; fails to alternate', 'Coordination failure despite correct prediction of the opponent'],
          ],
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'Social chain of thought',
          markdown:
            'Prompting the model to predict the opponent\'s move *before* choosing its own — Social Chain-of-Thought — improved coordination, and human participants were more likely to believe they were interacting with a person (§15.4.1). Prediction alone was not enough; the harness had to force it into the decision loop.',
        },
        {
          kind: 'prose',
          markdown:
            'Theory-of-mind work (§15.5) shows strong performance on false-belief-style tasks but leaves open whether belief tracking is represented internally or reproduced by other means. The repeated pattern — "can predict, does not act on it" — is the knowing–doing gap, and it is a practical agent-design lesson: if acting on knowledge matters, build it into the loop rather than assuming it.',
        },
        {
          kind: 'demo',
          demo: 'dilemma',
          title: 'Playing a social dilemma',
          intro:
            'The benchmark games in this section are used because their equilibrium is *known*, so a behaviour can be scored against a formal prediction rather than an opinion. Take the seat of the model: play against a fixed opponent over a stated number of rounds, and compare what you earned with the equilibrium line. Then change the horizon and watch the same behaviour become right or wrong.',
        },
      ],
    },
    {
      id: 'role-based',
      title: 'Role-based multi-agent systems',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Chapter 16 covers systems where agents are *given* roles: complementary pairs, debate, role-based software teams, and social role-play. Roles are a harness-level construct: a role is a prompt plus an allowed set of tools plus a position in a communication topology.',
        },
        {
          kind: 'diagram',
          diagram: 'multi-agent-roles',
          caption:
            'Role-based topology: a planner, researcher, executor, verifier and critic exchanging artefacts through a shared workspace under a coordinator.',
        },
        {
          kind: 'table',
          caption: 'Collaboration patterns (Ch. 16, §16.3)',
          headers: ['Pattern', 'Mechanism', 'Risk'],
          rows: [
            ['Complementary pairs', 'Two agents with different competences check each other', 'Loses the benefit if both inherit the same blind spot'],
            ['Debate and discussion', 'Adversarial argumentation converges on an answer', 'Confident consensus can be wrong; cost grows with rounds'],
            ['Role-based software teams', 'Manager/planner/executor/test-writer division of labour', 'Handoff errors; unclear ownership of failures'],
            ['Social role-play', 'Role-playing characters to study interaction', 'Fictional framing can weaken safeguards'],
          ],
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'Death by a thousand handoffs',
          markdown:
            'Every handoff is a lossy compression of context. Multi-agent systems help when the subtasks genuinely require different context or different tools; they hurt when the same context must be re-transmitted repeatedly at growing cost.',
        },
        {
          kind: 'prose',
          markdown:
            'Chapter 14\'s case study is a concrete test bed: a hospital diagnostic workflow with planner and executor agents communicating through a shared context, where classifiers are wrapped as tools and planner errors are separated from executor errors. That separation is what makes a multi-agent system diagnosable rather than merely impressive.',
        },
      ],
    },
    {
      id: 'emergent',
      title: 'Emergent behaviour in open-ended societies',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Chapter 17 removes the roles and asks what happens without them. Simulation infrastructure scales from a handful of generative agents to societies of thousands, and the research question shifts from "did the team solve the task?" to "what conventions, norms and meta-norms arise from local interactions?".',
        },
        {
          kind: 'diagram',
          diagram: 'emergent-society',
          caption:
            'Emergence: local pairwise interactions (left) aggregate into society-level norms and conventions (right) that no individual agent was instructed to produce.',
        },
        {
          kind: 'list',
          items: [
            'Generative agents combine memory, reflection and planning in a cognitive loop (§18.3.3).',
            'Architecture variants matter: the case study compares a standard memory system with a negativity-biased one, testing whether "bad is stronger than good" affects collective dynamics.',
            'Open world benchmark environments are needed both for evaluation and as a source of interaction data.',
            'Risks include unanticipated collective behaviour, and claims about emergence that outrun the evidence.',
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Validity of borrowed concepts',
          markdown:
            '§17.1.2 and §17.6 caution against importing "emergence", "self-organisation" or "collective intelligence" from the human case without care: the measurement is behavioural, and prompt fragility and model dependence can produce the pattern you were hoping to study.',
        },
        {
          kind: 'prose',
          markdown:
            'Chapter 18 is the case study that turns all of this into an experiment. The **Generative Agents** framework gives each character three components: a **memory stream** of everything it has perceived, done and thought; a **retrieval function** that scores memories by recency, importance and relevance; and a **reflection** mechanism that periodically synthesises higher-level insights. The personality is a short natural-language description — name, age, traits, lifestyle — and it is included in every prompt, so it anchors the behaviour.',
        },
        {
          kind: 'demo',
          demo: 'valence',
          title: 'Bad is stronger than good',
          intro:
            'The case study runs the same scenario with two memory architectures, and the only difference between them is whether a negative memory counts for more than a positive one. The day does not change; what the agent remembers does, and so does what it concludes. This is the chapter\'s central claim about agents in one control: a small change in the internal processing of an agent has measurable effects on the collective behaviour.',
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'Agents are fragile in a way programs are not',
          markdown:
            'Chapter 18 puts it directly: "a single word in a personality description, or a subtle change in memory weighting, can fundamentally alter how an agent acts, plans, and reflects". Nobody wrote the behaviour that emerged, and nobody chose it — the architecture chose it. The chapter\'s warning is that we are tuning systems whose behaviour we can only observe after the fact.',
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
            'Your team proposes five agents (planner, researcher, two executors, critic) to summarise a document. Use the chapter\'s criteria to argue for or against.',
          answer:
            'Against, on default grounds. Summarisation needs one context and no specialised tooling, so roles mainly multiply handoffs and cost while every agent re-transmits the same document — the lossy-handoff problem. Multi-agent designs pay off when subtasks require genuinely different contexts or tools (retrieval, code execution, verification against tests) and when failures must be attributable to a specific role, as in the medical case study. If you still want verification, start with a single agent plus a critic-style evaluation step.',
        },
        {
          kind: 'predict',
          question: {
            id: 'p10-team',
            prompt:
              'Five agents — planner, researcher, two executors, critic — are proposed to summarise one document. What does the chapter\'s criteria say?',
            options: [
              'That is a sensible design: more roles means more perspectives and better coverage.',
              'That the design adds coordination cost and correlated failure without adding independent perspectives; a complementary pair, or a single agent plus a critic, would be better for a single-document summary.',
              'That the design is fine as long as the critic is the strongest model.',
              'That the design is fine as long as the executors are given different instructions.',
            ],
            correct: 1,
            explanation:
              'The chapter\'s criteria are about *complementarity*, not head-count. Two executors with different instructions can still make the same mistake, so they do not provide independent perspectives; and every extra agent adds handoffs, cost and opportunities for a handoff to be lost. For a single-document summary, one agent with a verifier is the better decomposition (Ch. 16, §16.3.1; Ch. 14, §14.3).',
            source: { label: 'Ch. 16, §16.3.1 Complementary pairs', chapter: 16, section: '16.3.1', primary: true },
            difficulty: 'core',
          },
        },
        {
          kind: 'lab-link',
          labId: 'multi-agent',
          title: 'Watch a handoff fail',
          description:
            'Lab D runs a team of specialised agents and lets you degrade the channel, the roles and the verification step to see where coordination breaks.',
        },
      ],
    },
  ],
  quiz: [
    {
      id: 'q10-1',
      prompt: 'Which finding does the textbook report for LLMs in coordination games such as Bach or Stravinsky?',
      options: [
        'They converge faster than humans.',
        'They often fail to converge on the alternating turn-taking pattern, even when able to predict it: the knowing–doing gap.',
        'They refuse to play.',
        'They always defect.',
      ],
      correct: 1,
      explanation:
        'Chapter 15 §15.4.1 reports stubborn preference-aligned play and failure to adopt turn-taking, while the models can predict the pattern when asked — the dissociation that Social Chain-of-Thought prompting partially bridges.',
      source: { label: 'Ch. 15, §15.4.1 Cooperation and Coordination', chapter: 15, section: '15.4.1', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q10-2',
      prompt: 'What is the key difference between Chapter 16 and Chapter 17 multi-agent settings?',
      options: [
        'Chapter 16 uses roles assigned by the system; Chapter 17 studies open-ended emergence without assigned roles.',
        'Chapter 16 uses no LLMs; Chapter 17 uses only LLMs.',
        'Chapter 16 studies humans; Chapter 17 studies machines.',
        'There is no difference.',
      ],
      correct: 0,
      explanation:
        'Role-based interaction (Ch. 16) assigns complementary roles, debate or team structures; emergent simulation (Ch. 17) removes roles to study conventions and norms that arise from local interaction (Ch. 16 §16.1, Ch. 17 §17.1).',
      source: { label: 'Ch. 17, §17.1 What Is Emergent Multi-Agent Behavior?', chapter: 17, section: '17.1', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q10-3',
      prompt: 'Why does the book warn about claims of emergence in LLM societies?',
      options: [
        'Because emergence cannot be simulated.',
        'Because evidence is behavioural, and results are sensitive to prompt fragility and model dependence, so borrowed human concepts may not transfer.',
        'Because agents never communicate.',
        'Because simulation data cannot be reused.',
      ],
      correct: 1,
      explanation:
        'Chapter 17 §17.1.2 and §17.6 call for methodological caution: local-scale interactions produce patterns at scale, but the validity of terms like emergence and collective intelligence depends on how robustly they are measured.',
      source: { label: 'Ch. 17, §17.6 Concluding Remarks', chapter: 17, section: '17.6', primary: true },
      difficulty: 'advanced',
    },
  ],
  sources: [
    { label: 'Ch. 15, §15.1–15.2 What is LLM Behavior / Probing Experimentally', chapter: 15, section: '15.1', page: 287, primary: true },
    { label: 'Ch. 15, §15.4 Strategic Behavior', chapter: 15, section: '15.4', page: 294, primary: true },
    { label: 'Ch. 15, §15.5 Theory of Mind', chapter: 15, section: '15.5', page: 297, primary: true },
    { label: 'Ch. 16, §16.3 Role-Based Task Solving and Teamwork', chapter: 16, section: '16.3', page: 323, primary: true },
    { label: 'Ch. 17, §17.3 Emergent Conventions and Norms', chapter: 17, section: '17.3', page: 342, primary: true },
    { label: 'Ch. 18, Case Study 4: Simulating Societies', chapter: 18, page: 353, primary: true },
    { label: 'Ch. 14, Case Study 3: Multi-Agent Diagnosis', chapter: 14, page: 277, primary: true },
  ],
  furtherReading: [
    {
      referenceId: 'fontana-2025-cooperation',
      note:
        'The social-dilemma findings the dilemma lab scores against, as reviewed in the textbook.',
    },
  ],
  provenance: {
    textbookChapters: [14, 15, 16, 17, 18],
    supplementaryNote:
      'The document-summarisation checkpoint and the collaboration-pattern table are original course synthesis. Generative Agents (Park et al., 2023) and the games discussed are third-party research artefacts summarised from the book.',
  },
  keywords: ['machine behavior', 'Prisoner\'s Dilemma', 'theory of mind', 'roles', 'debate', 'emergence', 'norms'],
}

export const lessonAdvanced: LessonContent = {
  id: 'lesson-11-advanced',
  slug: 'advanced-architectures-and-interpretability',
  secondaryParts: [],
  order: 11,
  part: 'part-6-advanced',
  title: 'Advanced Architectures, Interpretability and Cognition',
  summary:
    'In-context reinforcement learning, self-modifying hyperagents and meta agents; mechanistic interpretability from the residual stream to sparse autoencoders; and the cognitive-science question of what the evidence can support.',
  minutes: 52,
  difficulty: 'advanced',
  prerequisites: ['behavior-strategy-multi-agent'],
  objectives: [
    { text: 'Explain in-context reinforcement learning as policy improvement from a history of state–action–reward triples.', source: 'Ch. 20, §20.2.1' },
    { text: 'Weigh the advantages and risks of self-modifying agents and meta-harnesses.', source: 'Ch. 20, §20.2.2–20.2.3' },
    { text: 'Describe the four interpretability paradigms and how they differ.', source: 'Ch. 21, §21.1' },
    { text: 'Explain the residual stream, the logit lens and the tuned lens.', source: 'Ch. 21, §21.3, §21.5' },
    { text: 'Explain polysemanticity and superposition, and why single neurons are poor units of interpretation.', source: 'Ch. 21, §21.4, §21.8' },
    { text: 'Distinguish behavioural, representational and mechanistic evidence for cognitive claims.', source: 'Ch. 22, §22.1.1' },
  ],
  sections: [
    {
      id: 'advanced-architectures',
      title: 'Architectures that learn while they run',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Chapter 20 collects the architectures that go beyond prompt-plus-loop. The first observation is theoretical: transformer-based models are, in principle, Turing-complete, and models trained on **decision traces** rather than natural language can learn to plan. The second is architectural: **looped** language models connect embeddings to embeddings directly, skipping repeated tokenization, and recursive multi-agent systems compose models with themselves.',
        },
        {
          kind: 'prose',
          markdown:
            'In-context reinforcement learning (ICRL) then applies the RL framing without weight updates: the harness stores a history of (state, action, reward) triples in the prompt, and the model improves its policy by conditioning on that history. It is Style D in the Chapter 9 taxonomy, with rewards made explicit.',
        },
        {
          kind: 'formula',
          latex:
            '\\pi_{\\text{improved}} = \\mathrm{LLM}\\bigl(\\text{goal}, \\{(s_i, a_i, r_i)\\}_{i=1}^{k}\\bigr)',
          caption:
            'In-context policy improvement: the history is the training set, the context window is the parameter update, and nothing is written to disk (Ch. 20, §20.2.1).',
        },
        {
          kind: 'table',
          caption: 'Advanced agentic designs (Ch. 20, §20.2)',
          headers: ['Design', 'What changes', 'Why it is risky'],
          rows: [
            ['Self-modifying hyperagents', 'The agent edits its own harness/prompt machinery', 'Verification burden; errors compound in the modification path'],
            ['Meta agents', 'A meta-level agent designs or improves the harness (metalearning applied to harness design)', 'Moving-target instability; harder to attribute failures'],
            ['Looped / recursive compositions', 'Embeddings or agents feed into one another iteratively', 'Cost, divergence, and error amplification across loops'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Self-modification is an engineering commitment',
          markdown:
            'Allowing an agent to change its own operating rules moves the safety problem from "will it pick a bad action?" to "will it rewrite the constraint that prevents bad actions?". Treat the modification channel as privileged: sandbox it, version it, and review diffs.',
        },
      ],
    },
    {
      id: 'interpretability',
      title: 'Looking inside the black box',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Chapter 21 opens the model. It distinguishes four paradigms: **behavioural** (what the system does), **attributional** (which inputs matter), **concept-based** (which human concepts are represented), and **mechanistic** (which internal components compute what). Only the last claims components and circuits rather than correlations.',
        },
        {
          kind: 'diagram',
          diagram: 'interpretability-levels',
          caption:
            'From pixels of behaviour to circuits: the residual stream is a shared communication channel that every attention head and MLP reads from and writes to.',
        },
        {
          kind: 'prose',
          markdown:
            'The **residual stream** reframes a transformer as iterative refinement: each block reads the current stream, computes something, and adds it back. The **logit lens** reveals what the model would predict if you stopped after layer ℓ; the tuned lens trains a small translator per layer for a better estimate. **Circuit analysis** then identifies structures such as induction heads, and **activation patching** tests causality by swapping activations between runs.',
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'Polysemanticity and sparse autoencoders',
          markdown:
            'Individual neurons respond to many unrelated features (polysemanticity) because the model represents more features than it has dimensions (superposition). Sparse autoencoders attack this by learning an overcomplete dictionary of sparser, more monosemantic directions — a candidate vocabulary for interpretation (Ch. 21, §21.4, §21.8).',
        },
        {
          kind: 'prose',
          markdown:
            'Superposition is also why the three methods in the next paragraph do not agree with each other, and why the difference between them is the difference between *knowing* and *doing*. A probe is a linear classifier trained on frozen activations: it reports where a concept is **correlated**. The logit lens reads a layer through the unembedding matrix: it reports what that layer **prefers**. Activation patching swaps the activation at one layer between two runs: it reports where the behaviour is **caused**.',
        },
        {
          kind: 'demo',
          demo: 'patching',
          title: 'Where was the decision made?',
          intro:
            'A weak shadow of the information is present in every layer, so a probe finds the concept everywhere and a researcher who stopped there would report that the model encodes it everywhere. Only patching localises it — and it localises it to the earliest layer that carries it, not to one exclusive layer. Move the probe threshold and the patch point, and watch the three methods disagree.',
        },
        {
          kind: 'callout',
          tone: 'source',
          title: 'The claim a causal method supports',
          markdown:
            'Patching a layer does not show that the layer *stores* the information; it shows that using the information there is what produced the behaviour. That is the claim mechanistic interpretability is in a position to make, and it is a narrower claim than "the model thinks about this here" — which is the claim a probe appears to support.',
        },
        {
          kind: 'prose',
          markdown:
            'For agents, the practical payoff is faithfulness: hallucination and unfaithful reasoning are not only output problems, and mechanistic methods can localise circuits responsible for specific failures. For agents in the wild, though, §21.9 notes that much of the work still requires weight access and remains narrow.',
        },
      ],
    },
    {
      id: 'cognition',
      title: 'Cognitive perspectives, carefully',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Chapter 22 asks what can be said about the cognitive status of LLMs and agentic LLMs, and answers with a levels-of-evidence framework. Behavioural evidence is abundant and cheap; representational evidence is growing and mostly on bare models; mechanistic evidence is sparse and usually requires open weights.',
        },
        {
          kind: 'table',
          caption: 'Three levels of evidence applied to a false-belief test (Ch. 22, §22.1.1)',
          headers: ['Level', 'Question', 'Typical method'],
          rows: [
            ['Behavioural', 'Does it answer like a belief tracker?', 'Task performance, perturbed variants'],
            ['Representational', 'Is the belief encoded?', 'Linear probes on activations'],
            ['Mechanistic', 'Is that encoding causally used?', 'Ablation, activation patching, steering'],
          ],
        },
        {
          kind: 'list',
          items: [
            'The competence/performance distinction guards against both anthropomorphism and anthropocentric dismissal.',
            'The unit of analysis is contested: model, system (model + harness), or system-in-environment.',
            'For agentic LLMs, representational and mechanistic evidence is currently scarce; most claims rest on behaviour.',
          ],
        },
        {
          kind: 'callout',
          tone: 'source',
          title: 'Synthetic data, briefly',
          markdown:
            'Chapter 19 closes the data loop: distillation from teachers to students, on- and off-policy data, curation and evaluation, and the risks — model collapse, bias amplification, security, privacy and licence questions. The book treats synthetic data as a first-class agentic resource with real failure modes, not a free lunch.',
        },
        {
          kind: 'prose',
          markdown:
            'Two claims from Chapter 19 are worth carrying into any project that generates its own training or evaluation data. The first is **contamination**: a generating model has read the benchmarks, so it can reproduce or closely paraphrase them, and after many rounds of generation the synthetic data converges on the benchmark it was supposed to be independent of. That inflates the score, and it is why Chapter 19 says the fixes "should go beyond simple exact-match filters" — n-gram overlap search, membership-inference-style probing, and dynamic dataset construction all exist because exact matching is not enough.',
        },
        {
          kind: 'prose',
          markdown:
            'The second is that **filtering is itself a distribution shift**. Chapter 19 separates the cost of keeping synthetic data from the cost of the checks on it: aggressive filtering for quality can outweigh sheer quantity, and a corpus that has been filtered hard is a corpus that has been made narrower. A model trained on it inherits that narrowing as though it were the world — which is the same failure the curation demonstration in Lesson 3 shows from the other end.',
        },
        {
          kind: 'list',
          items: [
            'Intrinsic evaluation — correctness, diversity, contamination — is cheap and can be run during generation.',
            'Extrinsic evaluation — training on it and measuring downstream — is the only one that answers whether it is useful, and it is the expensive one.',
            'The gap between the two is where synthetic-data projects go wrong: a set can score well on the cheap checks and still not help.',
          ],
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
            'An agent reports "I remember you prefer window seats". Should you treat that as self-knowledge? Justify your answer using the book\'s levels of evidence, and state what evidence would change your mind.',
          answer:
            'Not on behaviour alone. A fluent report could come from a memory item retrieved by the harness, from conversational echo, or from a genuine internal state — the levels framework separates these. Behavioural evidence cannot distinguish them; representational evidence would require decoding a relevant state, and mechanistic evidence a causal intervention (e.g. editing the state so the answer changes). Note also that for agentic systems the unit of analysis is the whole system: a correct report may be a property of the harness\'s memory design rather than of the model.',
        },
        {
          kind: 'predict',
          question: {
            id: 'p11-evidence',
            prompt:
              'An agent says "I remember you prefer window seats". Which evidence would actually settle whether the agent knows this?',
            options: [
              'The agent saying it confidently and consistently across sessions.',
              'A behavioural test: ask in many phrasings and see whether the answer is stable.',
              'A causal intervention: change the memory item the harness retrieves and check whether the answer changes with it.',
              'Asking the agent to explain how it knows.',
            ],
            correct: 2,
            explanation:
              'The levels of evidence separate the three cases. Confident, stable answers are still *behavioural* evidence, and the book is explicit that behavioural evidence cannot distinguish a retrieved memory item from an internal state. Only a causal intervention — edit the state, see whether the answer changes — establishes that the agent\'s answer depends on the thing it claims to remember (Ch. 22, §22.1.1).',
            source: { label: 'Ch. 22, §22.1.1 Three levels of evidence', chapter: 22, section: '22.1.1', primary: true },
            difficulty: 'core',
          },
        },
      ],
    },
  ],
  quiz: [
    {
      id: 'q11-0',
      prompt:
        'What problem does a distillation loop address, and what is its central risk?',
      options: [
        'It reduces inference cost by training a small student on a large teacher’s outputs; the central risk is model collapse when synthetic data is generated without enough real data.',
        'It increases model size by duplicating weights.',
        'It replaces the pretraining corpus with a single document.',
        'It removes the need for a teacher model.',
      ],
      correct: 0,
      explanation:
        'Distillation transfers capability from a teacher to a cheaper student, which is one of the main routes to lower inference cost. The risk is that training repeatedly on model-generated text, with too little real data, narrows the distribution and degrades the model over generations (Ch. 19, §19.2 Distillation Loop; §19.5.1 Model Collapse).',
      source: { label: 'Ch. 19, §19.2 Distillation Loop; §19.5.1 Model Collapse', chapter: 19, section: '19.2', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q11-0b',
      prompt:
        'According to the textbook’s levels of evidence, what is the difference between representational evidence and mechanistic evidence?',
      options: [
        'They are the same thing described at different levels of detail.',
        'Representational evidence concerns what state the system holds; mechanistic evidence concerns which internal component is causally responsible for a behaviour.',
        'Representational evidence is quantitative and mechanistic evidence is qualitative.',
        'Mechanistic evidence is a subset of behavioural evidence.',
      ],
      correct: 1,
      explanation:
        'The three levels are behavioural (what the system does), representational (what state it holds internally) and mechanistic (which component caused the behaviour, established by causal intervention). Only mechanistic evidence supports a claim about the architecture itself (Ch. 22, §22.1.1).',
      source: { label: 'Ch. 22, §22.1.1 Three Levels of Evidence', chapter: 22, section: '22.1.1', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q11-1',
      prompt: 'What is in-context reinforcement learning (ICRL)?',
      options: [
        'Finetuning the model on rewards collected offline.',
        'Improving the policy by conditioning the model on a growing history of state–action–reward triples, without changing parameters.',
        'A search algorithm that replaces the policy network.',
        'Training a reward model from human preferences.',
      ],
      correct: 1,
      explanation:
        'ICRL uses the LLM as a policy improver: the harness supplies the history of interactions and the model chooses better actions from it, so learning happens in context (Ch. 20, §20.2.1; Ch. 9, §9.1.2).',
      source: { label: 'Ch. 20, §20.2.1 In-Context Reinforcement Learning', chapter: 20, section: '20.2.1', primary: true },
      difficulty: 'advanced',
    },
    {
      id: 'q11-2',
      prompt: 'What does the logit lens let you see?',
      options: [
        'The final answer of the model only.',
        'What the model would predict if decoding stopped at an intermediate layer, exposing how the prediction evolves.',
        'The training data of the model.',
        'The tool calls available to an agent.',
      ],
      correct: 1,
      explanation:
        'The logit lens projects intermediate residual-stream states to the vocabulary, giving a layer-by-layer view of the prediction; the tuned lens improves this with trained per-layer translators (Ch. 21, §21.5).',
      source: { label: 'Ch. 21, §21.5 The Logit Lens', chapter: 21, section: '21.5', primary: true },
      difficulty: 'advanced',
    },
    {
      id: 'q11-3',
      prompt: 'Why are individual neurons described as poor units of interpretation?',
      options: [
        'Because they have no weights.',
        'Because polysemanticity and superposition mean one neuron responds to many unrelated features.',
        'Because neurons are not used by transformers.',
        'Because neurons only encode syntax.',
      ],
      correct: 1,
      explanation:
        'Models represent more features than they have dimensions, so features are superimposed and neurons become polysemantic. Sparse autoencoders learn sparser dictionary features as an alternative (Ch. 21, §21.4, §21.8).',
      source: { label: 'Ch. 21, §21.4 Polysemanticity and Superposition', chapter: 21, section: '21.4', primary: true },
      difficulty: 'advanced',
    },
  ],
  sources: [
    { label: 'Ch. 19, §19.2–19.5 Synthetic data, curation, risks', chapter: 19, section: '19.2', page: 365, primary: true },
    { label: 'Ch. 20, §20.1 Transformer Architectures', chapter: 20, section: '20.1', page: 391, primary: true },
    { label: 'Ch. 20, §20.2 Agentic Architectures', chapter: 20, section: '20.2', page: 394, primary: true },
    { label: 'Ch. 21, §21.3–21.8 Residual stream, logit lens, circuits, SAEs', chapter: 21, section: '21.3', page: 406, primary: true },
    { label: 'Ch. 22, §22.1.1 Three Levels of Evidence', chapter: 22, section: '22.1.1', page: 424, primary: true },
  ],
  furtherReading: [
    {
      referenceId: 'templeton-2024-sae',
      note:
        'Sparse autoencoders and dictionary learning, and the measurement problems that come with them.',
    },
  ],
  provenance: {
    textbookChapters: [19, 20, 21, 22],
    supplementaryNote:
      'The window-seat checkpoint and the self-modification warning are original course material. Induction heads, the tuned lens and sparse autoencoders are third-party research results summarised by the book.',
  },
  keywords: ['ICRL', 'hyperagent', 'meta agent', 'residual stream', 'logit lens', 'superposition', 'SAE', 'levels of evidence'],
}

export const lessonFuture: LessonContent = {
  id: 'lesson-12-future',
  slug: 'future-directions',
  secondaryParts: ['part-3-agents', 'part-4-tools-assistants'],
  order: 12,
  part: 'part-7-conclusion',
  title: 'Future Directions and Responsible Agent Engineering',
  summary:
    'Where agentic LLMs stand, what the open problems are across technology, applications and society, and how to design, evaluate and document agents you build yourself.',
  minutes: 44,
  difficulty: 'core',
  prerequisites: ['advanced-architectures-and-interpretability'],
  objectives: [
    { text: 'Summarise the current state of agentic LLMs across technology, applications and behaviour.', source: 'Ch. 23, §23.1' },
    { text: 'Identify the limitations and open research directions named in the conclusion, including legal and ethical aspects.', source: 'Ch. 23, §23.2' },
    { text: 'Apply an evaluation discipline to your own agent: define success, log traces, and separate failure classes.', source: 'Ch. 10, §10.3; Ch. 14, §14.4' },
    { text: 'State the ethical, legal and societal considerations for deployment.', source: 'Ch. 13, §13.9; Ch. 23' },
    { text: 'State the three pillars of agentic LLMs and the cycle that connects them, and name the eight ideas that recur across the book.', source: 'Ch. 1, §1.6; Ch. 23, §23.3' },
  ],
  sections: [
    {
      id: 'state-of-play',
      title: 'Where things stand',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'The closing chapter separates what is established from what is still open. Established: agentic LLMs combine models with harnesses to plan, use tools and adapt; reasoning methods such as chain of thought and self-reflection substantially extend what a fixed model can do; tools and retrieval supply capability and freshness; multi-agent structures can help when tasks genuinely decompose. Open: stable dynamic metalearning, reliable long-horizon agents, memory that survives long tasks, trustworthy evaluation, interpretability for agentic systems, and the governance of systems that act with consequences.',
        },
        {
          kind: 'list',
          items: [
            'Technology: robustness, stable learning loops, memory, long-horizon planning, cost.',
            'Applications: assistants in medicine, logistics, finance and science, where errors are consequential.',
            'Society: accountability, transparency, access, sustainability and privacy.',
          ],
        },
        {
          kind: 'callout',
          tone: 'source',
          title: 'Reading the book as a course',
          markdown:
            'Chapters and sections marked with * are advanced. Part I is foundational; Parts II–IV cover the assistants use case; Part V covers social simulation and cognition; Part VI contains advanced material that also serves as follow-up reading.',
        },
      ],
    },
    {
      id: 'evaluation-discipline',
      title: 'An evaluation discipline for your own agents',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Both case studies in Part III and Part IV end with evaluation sections, and they agree on method: define the outcome metric, run the same scenario across configurations, and attribute failures to a component rather than to "the agent".',
        },
        {
          kind: 'list',
          ordered: true,
          items: [
            'Fix a scenario set and hold it constant across configurations.',
            'Record full traces: prompts, tool calls, observations, retries, costs, steps.',
            'Separate failure classes — planning vs. execution vs. perception vs. formatting.',
            'Report cost alongside success: an agent that solves the task in 40 steps may be worse than one that solves it in 6.',
            'Re-test after every harness change; the harness is a component with behaviour, not glue.',
          ],
        },
        {
          kind: 'example',
          title: 'Attributing failures in a two-agent pipeline',
          steps: [
            { label: 'Symptom', detail: 'Wrong final answer in 14% of cases.' },
            { label: 'Hypothesis A', detail: 'Planner routed to the wrong specialist tool.' },
            { label: 'Test A', detail: 'Score routing accuracy separately from execution accuracy: routing errors account for 9 of the 14 points.' },
            { label: 'Hypothesis B', detail: 'Executor mishandled a valid plan in the remaining 5 cases.' },
            { label: 'Fix', detail: 'Improve the planner\'s tool descriptions and add a validation step before execution; re-run the frozen scenario set to confirm the change.' },
          ],
          takeaway:
            'Separation of concerns is not only good software design — it is what makes an agent measurable.',
        },
      ],
    },
    {
      id: 'responsibility',
      title: 'Responsibility, safety and honesty',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Agentic systems act. That single property raises the stakes of every design decision: what the agent may change, what it must ask before doing, what it logs, and what it may never do. The book treats safety, security and human oversight as design requirements (§11.5–11.6), and it warns that models are less dependable than conventional software precisely where dependability would matter most.',
        },
        {
          kind: 'list',
          items: [
            'Least privilege: give each tool the narrowest scope that works.',
            'Human confirmation for irreversible actions, with a clear description of what will happen.',
            'Untrusted content stays data: retrieved text, tool output and web content never carry instructions.',
            'Log and review: traces are the audit trail, and they are also your test material.',
            'Do not overclaim: distinguish simulated behaviour from deployed model behaviour, and behavioural evidence from mechanistic evidence.',
          ],
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'The course-level takeaway',
          markdown:
            'An agentic LLM is a designed system: model + harness + tools + memory + evaluation. Every one of those is something you can specify, test and improve. The failure modes are engineering failure modes, and the fixes are mostly engineering fixes — plus the humility to measure before claiming.',
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'What Chapter 13 adds to a list of responsibilities',
          markdown:
            'Chapter 13 §13.9 adds the part that a checklist usually misses: these responsibilities are **domain-conditional**. "Confirm before irreversible actions" is right in a clinic and merely annoying in a shop, and "an agent asking for clarification or abstaining is preferable to confident error" is a rule about *how much* to ask, which is itself a parameter. A team that writes the safety rules without writing the stakes down will tune them for the domain they happened to build first.',
        },
      ],
    },
    {
      id: 'synthesis',
      title: 'The course on one page',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'The book is organised around three pillars, and the course follows the same structure: **reasoning** (Part II), **acting** (Parts III and IV) and **interacting** (Part V). Chapter 23.3 draws the three together, and the argument it makes is short enough to state here. A model that only produces text is evaluated on the text it produces. Give it the ability to act — call a function, run code, query a database — and it is evaluated on what those actions change, and on the policy it adapts as a result. Give several such agents the ability to interact, and behaviour appears that nobody scripted: cooperation, trust, and norms forming out of repeated exchanges.',
        },
        {
          kind: 'table',
          caption: 'The three pillars, and the limit that shows up in each',
          headers: ['Pillar', 'What it adds', 'Where this course showed it', 'The limit'],
          rows: [
            [
              'Reasoning',
              'Multi-step problem solving in the prompt: chain of thought, self-reflection, retrieval',
              'The planning laboratory and the reflection harness in Lesson 5',
              'The knowing-doing gap: the model can state the right algorithm and still lose the state between steps',
            ],
            [
              'Acting',
              'Tools, APIs and world models, with a harness deciding when to use them',
              'The tool-selection demonstration in Lesson 8 and the workflow builder',
              'The context window is finite, and every tool result spends it',
            ],
            [
              'Interacting',
              'Several agents coordinating, with behaviour that was in no prompt',
              'The social-dilemma demonstration and the multi-agent laboratory in Lesson 10',
              'Coordination failures: the message that never arrived, the critique that was lost in transit',
            ],
          ],
        },
        {
          kind: 'prose',
          markdown:
            'The connection between the pillars is a cycle, and it is the part worth taking away. Reasoning makes better acting and interacting; the data generated by agents that act and interact can then be used to pretrain and finetune better reasoning models. The book presents the cycle as a route past the plateaus in scaling, because an agent that acts generates a training signal that no amount of pretraining data reproduces exactly. The multi-agent laboratory shows the same cycle inside a single session: a critic\'s feedback is stored and fed back in on the next round, so one round\'s output becomes the next round\'s input.',
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'The argument in one sentence',
          markdown:
            'The interesting engineering in an agentic LLM is not in the model, it is in the harness — and the harness is bounded by a context window, so every decision about memory, tools and termination is really a decision about what to keep and what to drop.',
        },
        {
          kind: 'prose',
          markdown:
            'Eight ideas recur across the book, and they are what this course is actually for. Each is stated in a lesson and then paid for in a laboratory, a demonstration or an assessment question, so the list below is a set of routes rather than a summary.',
        },
        {
          kind: 'table',
          caption: 'The eight recurring ideas',
          headers: ['Idea', 'Stated in', 'The thing to remember'],
          rows: [
            [
              'The harness is half the system',
              'Ch. 1, §1.2.2',
              'Prompt construction, tool calls, state and termination are all harness code, and all of them are testable',
            ],
            [
              'Acting changes the question',
              'Ch. 1, §1.2',
              'A model that acts is no longer graded on its text; the world grades it',
            ],
            [
              'Knowing is not doing',
              'Ch. 6, §6.2.3',
              'The model can describe the right algorithm and still lose the state between steps',
            ],
            [
              'The window is a budget',
              'Ch. 9, §9.3.2.2',
              'Tokens compete, and the harness decides what survives — and the wrong choice is silent',
            ],
            [
              'Memory is read, write and forget',
              'Ch. 9, §9.3',
              'Forgetting is a design decision, not the absence of one',
            ],
            [
              'Interfaces carry the leverage',
              'Ch. 11, §11.2',
              'Discriminability, arity clarity and honest error signalling decide more than the model does',
            ],
            [
              'Structure only helps when it decomposes',
              'Ch. 16, §16.1.2–16.1.3',
              'A multi-agent design earns its coordination cost only when the task genuinely splits',
            ],
            [
              'Measure before you claim',
              'Ch. 10, §10.3',
              'A success rate without a frozen scenario set, a baseline and an error taxonomy is an anecdote',
            ],
            [
              'The domain sets the policy',
              'Ch. 13, §13.9',
              'The same threshold is a mild annoyance in a shop and a safety incident in a clinic',
            ],
          ],
        },
        {
          kind: 'prose',
          markdown:
            'Two chapters repay a second reading, because the book backs them with evidence rather than assertion. Chapter 11 on tool interfaces is the most immediately actionable part of the book for anyone building an agent this year: its claims are about interface design, they are cheap to check, and they explain a surprising share of agent failures. Chapter 9 on memory is the most conceptually demanding, and it is where the interaction between capacity, retrieval and forgetting is worked through in a way no single paper does.',
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
            'Your agent succeeds on 82% of a 50-case suite. What is missing before you can claim it works, using the book\'s evaluation conventions?',
          answer:
            'Cost and trajectory data (steps, tool calls, tokens), a frozen and representative scenario set for comparison, an error taxonomy with counts per class, a baseline to compare against, and a description of the environment and harness in which the numbers were obtained. Chapter 10\'s evaluation section and Chapter 14\'s routing/accuracy split both insist on attributing failures rather than reporting a single success rate.',
        },
        {
          kind: 'predict',
          question: {
            id: 'p12-evaluation',
            prompt:
              'An agent succeeds on 82% of a 50-case suite. What is missing before you can claim it "works"?',
            options: [
              'A larger suite — 50 cases is too few to be meaningful.',
              'Repeated runs over several seeds, a baseline to compare against, and an error taxonomy: a single run is not a measurement, and 82% says nothing about what the 18% were.',
              'Nothing — 82% is a strong result and can be reported as it stands.',
              'Only a written reflection; the numbers are already sufficient.',
            ],
            correct: 1,
            explanation:
              'Agent behaviour is stochastic in the environment, so one run of 50 cases is a single sample, not a measurement. You need repeated runs across seeds, a baseline so the 82% has something to be compared against, and an error taxonomy so the failures are understood rather than counted. The 18% is the informative part: it says what to fix (Ch. 15, §15.2; Ch. 14, §14.4).',
            source: { label: 'Ch. 15, §15.2 Probing behaviour experimentally', chapter: 15, section: '15.2', primary: true },
            difficulty: 'core',
          },
        },
        {
          kind: 'lab-link',
          labId: 'workflow-builder',
          title: 'Measure a workflow',
          description:
            'The workflow builder reports steps, failures and a success score for each run — a miniature version of the evaluation discipline described here.',
        },
      ],
    },
  ],
  quiz: [
    {
      id: 'q12-1',
      prompt: 'Which of these is presented as an open problem rather than an established result?',
      options: [
        'Chain-of-thought prompting can improve multi-step reasoning.',
        'Tools let agents fetch information beyond training data.',
        'Stable dynamic metalearning with predictable convergence is still an active research area.',
        'Memory can be managed explicitly by a harness.',
      ],
      correct: 2,
      explanation:
        'Chapters 8, 9 and 20 all note that convergence and stability of dynamic learning loops remain open; the other three are presented as established techniques.',
      source: { label: 'Ch. 8, §8.4; Ch. 9, §9.2.1.4; Ch. 20, §20.3', chapter: 20, section: '20.3', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q12-2',
      prompt: 'In the case studies\' evaluation method, why separate routing errors from execution errors?',
      options: [
        'Because it is required by law.',
        'Because different components own different root causes, so attributing failures tells you what to fix.',
        'Because execution errors are always larger.',
        'Because routing errors cannot be measured.',
      ],
      correct: 1,
      explanation:
        'Chapter 14 §14.4 evaluates planning and execution separately so that planner errors are not confused with executor errors — the same separation recommended for the summarizer in Chapter 11.',
      source: { label: 'Ch. 14, §14.4 Evaluation', chapter: 14, section: '14.4', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q12-3',
      prompt: 'Which practice is the most defensible way to present an agent you built?',
      options: [
        'Describe it as an autonomous AI with human-level reasoning.',
        'State what it is simulated or scaffolded behaviour, report the scenario set and metrics, and name the limitations.',
        'Report only the best run.',
        'Omit the harness details to protect the design.',
      ],
      correct: 1,
      explanation:
        'The course standard is honesty about mechanism and measurement: report the environment, metrics and limitations, and never present simulated agents as deployed model behaviour.',
      source: { label: 'Ch. 23, §23.1; Ch. 10, §10.3', chapter: 23, section: '23.1', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q12-6',
      prompt: 'The book connects its three pillars in a cycle. Which statement describes it correctly?',
      options: [
        'Reasoning, acting and interacting are independent lines of work, and the book treats them separately.',
        'Reasoning enables better acting and interacting, and the data agents generate by acting and interacting can then be used to train better reasoning models.',
        'Interacting agents are the foundation, and reasoning is derived from them.',
        'The cycle runs from acting to reasoning only, and never back again.',
      ],
      correct: 1,
      explanation:
        'Ch. 23 §23.3 is explicit: the three pillars form a cycle in which reasoning enables better acting and interacting, and the data generated by agents that act and interact becomes training material for better reasoning models. The book offers the cycle as a route past the plateaus in scaling, because an agent that acts produces a training signal that pretraining data does not reproduce exactly.',
      source: { label: 'Ch. 23, §23.3 Concluding Remarks', chapter: 23, section: '23.3', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q12-7',
      prompt: 'A team says an agent failed because "the model was not good enough". Which diagnosis does the book\'s account of agentic LLMs support?',
      options: [
        'That is the most likely cause, since the model is the only component that was not changed.',
        'That is not a diagnosis: the model is one component, and the harness, the tool interfaces and the context budget are all design decisions that can be wrong independently of it.',
        'That is correct, because harness failures are always downstream of model quality.',
        'That is only true for long-horizon tasks; for short ones the model is everything.',
      ],
      correct: 1,
      explanation:
        'Ch. 1 §1.2.2 splits the system into a model and a harness, and the whole of Part III is about harness design: prompt construction, tool interfaces, state management and termination. Ch. 9 §9.3.2.2 adds that the harness is bounded by a context window, so a failure can be a budgeting failure rather than a capability failure. Ch. 10 §10.3 then insists that failures be attributed to a component rather than to "the agent", and the eight recurring ideas in this lesson are eight named places where that attribution usually lands.',
      source: { label: 'Ch. 1, §1.2.2; Ch. 9, §9.3.2.2; Ch. 10, §10.3', chapter: 1, section: '1.2.2', primary: true },
      difficulty: 'advanced',
    },
  ],
  sources: [
    { label: 'Ch. 23, §23.1 The State of Agentic LLMs', chapter: 23, section: '23.1', page: 461, primary: true },
    { label: 'Ch. 23, §23.2 Limitations and Future Work', chapter: 23, section: '23.2', page: 462, primary: true },
    { label: 'Ch. 23, §23.2.6 Legal and Ethical Aspects', chapter: 23, section: '23.2.6', page: 465, primary: true },
    { label: 'Ch. 13, §13.9 Concluding Remarks', chapter: 13, section: '13.9', page: 272, primary: true },
    { label: 'Ch. 10, §10.3 Evaluation', chapter: 10, section: '10.3', page: 216, primary: true },
    { label: 'Ch. 14, §14.4 Evaluation: routing accuracy against execution accuracy', chapter: 14, section: '14.4', page: 280, primary: true },
    { label: 'Ch. 14, Case Study 3: Multi-Agent Diagnosis', chapter: 14, page: 277, primary: true },
  ],
  furtherReading: [
    {
      referenceId: 'achiam-2024-gpt4',
      note:
        'The frontier the chapter measures itself against — and one of the few technical reports that is candid about what the model does not do.',
    },
    {
      referenceId: 'sprague-2024-cot-or-not',
      note:
        'The measurement behind the chapter\'s warning that more thinking effort is not always better. Read it before assuming a larger reasoning budget is a free improvement.',
    },
    {
      referenceId: 'black-2024-pi0',
      note:
        'A generalist robot policy trained on self-generated action data. The open-problem version of the world-model lesson: what would it take for the same trick to work in the physical world?',
    },
    {
      referenceId: 'brohan-2023-rt2',
      note:
        'The earliest vision-language-action models, and the clearest account of what web-scale pretraining actually transfers to a robot.',
    },
  ],
  provenance: {
    textbookChapters: [10, 13, 14, 23],
    supplementaryNote:
      'The evaluation checklist and the 82%-checkpoint are original course material that operationalises the case studies\' evaluation method.',
  },
  keywords: ['future directions', 'evaluation', 'safety', 'governance', 'open problems'],
}
