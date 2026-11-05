import type { LessonContent } from '../../types/curriculum'

export const lessonScaling: LessonContent = {
  id: 'lesson-04-scaling',
  slug: 'scaling-laws-and-efficiency',
  secondaryParts: [],
  order: 4,
  part: 'part-1-language-modeling',
  title: 'Scaling Laws and Efficient Models',
  summary:
    'Why loss falls predictably with compute, data and parameters; how Kaplan and Chinchilla disagree about the split; and how inference-time compute, small models, distillation and quantisation reshape the cost picture.',
  minutes: 42,
  difficulty: 'core',
  prerequisites: ['training-pipeline'],
  objectives: [
    { text: 'Define compute (C), dataset size (D) and model size (N), including the C ≈ 6ND approximation.', source: 'Ch. 4, §4.1' },
    { text: 'Contrast the Kaplan and Chinchilla allocations and explain why the later study overtrained models into existence.', source: 'Ch. 4, §4.1.1–4.1.2' },
    { text: 'Apply the ~20 tokens-per-parameter rule of thumb and read an under/overtrained model off it.', source: 'Ch. 4, §4.1.2, Table 4.1' },
    { text: 'Explain the IsoFLOP method and the U-shaped loss curve it relies on.', source: 'Ch. 4, §4.1.3' },
    { text: 'List techniques that make a model cheaper to train or to run, and name the trade-off each makes.', source: 'Ch. 4, §4.2' },
    { text: 'Distinguish training-time compute from inference-time compute.', source: 'Ch. 4, §4.3' },
  ],
  sections: [
    {
      id: 'three-factors',
      title: 'Three factors and a power law',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Scaling laws are empirical curves, not theory: train many models under controlled conditions, then fit. The three variables are compute (total FLOPs over the run), dataset size (training tokens) and model size (trainable parameters, usually excluding the embedding matrix). The fitted relation is smooth and **predictable**, which is what makes it useful — you can estimate the benefit of a doubling *before* spending the money.',
        },
        {
          kind: 'formula',
          latex: 'C \\approx 6ND',
          caption:
            'Compute approximation: each token touches every parameter about six times — twice forward, four times in the backward pass (Ch. 4, §4.1).',
        },
        {
          kind: 'formula',
          latex: 'L(N) \\propto N^{-\\alpha}, \\qquad \\alpha \\approx 0.076',
          caption:
            'Kaplan et al. (2020): loss falls as a power law in model size, with a similar law in dataset size (exponent ≈ 0.095). Doubling a resource buys a few percent of loss, not a doubling of quality.',
        },
        {
          kind: 'prose',
          markdown:
            'The subtle part of Kaplan is the recommendation that follows from the fitted exponents: with compute as the binding constraint and C ≈ 6ND, allocating a larger share to N gives a better return than allocating it to D. That reasoning is what produced the era of very large, comparatively lightly-trained models.',
        },
      ],
    },
    {
      id: 'chinchilla',
      title: 'Chinchilla: the split is roughly equal',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Hoffmann et al. (2022) re-ran the analysis with better methodology — Kaplan\'s optimum had been extrapolated from early, non-converged runs, which biased it toward large models trained for few steps. Chinchilla fitted a two-term loss and concluded that **model size and tokens should grow in roughly equal proportion** for a fixed compute budget.',
        },
        {
          kind: 'formula',
          latex: 'L(N, D) = E + \\frac{A}{N^{\\alpha}} + \\frac{B}{D^{\\beta}}',
          caption:
            'Chinchilla loss model: irreducible entropy E plus sub-optimality from finite parameters and from finite data (Ch. 4, §4.1.2, Eq. 4.2).',
        },
        {
          kind: 'formula',
          latex: 'N^{*}(C) \\propto C^{0.45}, \\qquad D^{*}(C) \\propto C^{0.55}, \\qquad \\frac{D^{*}}{N^{*}} \\approx 20',
          caption:
            'Compute-optimal scaling: exponents sum to one because C ≈ 6ND, and the token-to-parameter ratio stays near 20 across many orders of magnitude (Ch. 4, §4.1.2, Eq. 4.4).',
        },
        {
          kind: 'table',
          caption: 'Reading the ratio (Ch. 4, Table 4.1 — selected rows)',
          headers: ['Model', 'Parameters', 'Tokens', 'Regime'],
          rows: [
            ['GPT-3', '175B', '300B', 'undertrained (~2 tokens/param)'],
            ['Chinchilla', '70B', '1.4T', 'compute-optimal (≈20)'],
            ['LLaMA-1 7B', '7B', '1.0T', 'overtrained (~143)'],
            ['LLaMA-3 8B', '8B', '15T', 'heavily overtrained (~1900)'],
          ],
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'Why anyone would deliberately overtrain',
          markdown:
            'The rule of thumb minimises **training** loss at a fixed budget. If a model will serve many requests, you instead pay extra training compute to get a *smaller* model that is cheaper at inference. Extreme overtraining is a deliberate economic trade, not a mistake.',
        },
      ],
    },
    {
      id: 'frontier',
      title: 'The compute-optimal frontier',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'IsoFLOP curves make the allocation visible: fix the FLOP budget, train models of several sizes, and plot final loss against model size. A model that is too small underfits; a model that is too large is forced onto too few tokens. The result is **U-shaped**, and the minimum is the compute-optimal size for that budget. Repeating across budgets traces how N* and D* grow with C.',
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'The optimum is estimated, not observed',
          markdown:
            'Fitting a parabola to each curve biases the estimate (coarse spacing, asymmetric sampling, and the genuine asymmetry of the loss surface). The recommended remedy is to fit the parametric loss L(N,D) = E + A/Nᵅ + B/Dᵝ directly — the same functional form, evaluated at many points instead of only near the minimum (Ch. 4, §4.1.3).',
        },
        {
          kind: 'prose',
          markdown:
            'Chapter 4 also lists the phenomena that complicate the clean picture: **emergent abilities** that appear abruptly with scale, **inverse scaling** where larger models do worse on some formats, and **grokking**, where a capability appears long after loss has plateaued. Treat the smooth curve as a strong prior, not a guarantee.',
        },
      ],
    },
    {
      id: 'efficiency',
      title: 'Small models and optimisation axes',
      blocks: [
        {
          kind: 'list',
          items: [
            'Model-centric, pretraining: pruning and quantisation reduce the cost of representing and running the network.',
            'Model-centric, inference: distillation, caching and speculative or parallel decoding reduce latency and per-token cost.',
            'Data-centric: selection and curation, synthetic data generation, and sample-efficient learning make each token count.',
            'Deployment: serve smaller specialised models for routine steps and reserve large models for hard steps.',
          ],
        },
        {
          kind: 'prose',
          markdown:
            'This is the point where Part I meets agent engineering. An agentic system makes many model calls — plan, act, observe, reflect — so per-call cost dominates. That is the economic argument for the mixed architecture you will meet in the workflow lab: a cheap policy step, an expensive reasoning step only where it pays, and tools that replace model calls with deterministic computation.',
        },
        {
          kind: 'diagram',
          diagram: 'scaling-curve',
          caption:
            'Interactive view: loss against model size under a fixed compute budget, with the compute-optimal minimum marked. Move the budget and watch the optimum shift.',
        },
        {
          kind: 'callout',
          tone: 'source',
          title: 'Inference-time compute',
          markdown:
            'Chapter 4 §4.3 introduces inference-time compute as its own axis: instead of a bigger model, spend more tokens at test time (long chains of thought, search, repeated sampling with verification). Part II is largely about making that spend effective.',
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Sustainability and privacy',
          markdown:
            '§4.4 asks you to reason about the environmental and privacy implications of large-scale deployment; the book quantifies training emissions and discusses data governance as design constraints, not afterthoughts.',
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
            'A team must serve ten million short requests per day and can train only once. Their model has 7B parameters and they plan to train on 200B tokens. Which regime are they in, and what would Chinchilla suggest?',
          answer:
            '200B/7B ≈ 28 tokens per parameter, slightly above the ≈20 rule, so the model is close to compute-optimal for training loss. But the deployment profile (very many short calls) argues for deliberate overtraining on far more tokens to reach a lower loss in a smaller model that is cheaper per request — the LLaMA-3 pattern (Ch. 4, §4.1.2).',
        },
        {
          kind: 'predict',
          question: {
            id: 'p4-overshoot',
            prompt:
              'A team trains a 7B model on 500B tokens — far more than the ≈20 tokens per parameter the Chinchilla rule suggests. What should they expect?',
            options: [
              'A worse model, because training past the frontier always hurts.',
              'A better model, because the extra tokens reduce the loss even though the compute-optimal allocation was not followed.',
              'No change, because the loss depends only on the parameter count.',
              'A better model with the same training loss, but a larger one.',
            ],
            correct: 1,
            explanation:
              'The compute-optimal frontier is an allocation rule, not a cliff. Training past it costs more compute than was strictly optimal, and buys a lower loss for the same model size — which is exactly why the LLaMA-3 pattern of deliberate overtraining is rational when inference dominates the cost (Ch. 4, §4.1.2). The frontier tells you where the *efficient* point is; it does not tell you that going past it is wrong.',
            source: { label: 'Ch. 4, §4.1.2 Chinchilla Scaling Laws', chapter: 4, section: '4.1.2', primary: true },
            difficulty: 'core',
          },
        },
        {
          kind: 'lab-link',
          labId: 'world-model',
          title: 'See the frontier move',
          description:
            'The Scaling Explorer in the scaling lesson and the budget slider in Lab C both let you change the trade-off and inspect the resulting curve.',
        },
      ],
    },
  ],
  quiz: [
    {
      id: 'q4-1',
      prompt: 'What is the Chinchilla rule of thumb for compute-optimal training?',
      options: [
        'Train on ~20 tokens per parameter, increasing model size and tokens in roughly equal proportion with budget.',
        'Always train the largest model you can afford, regardless of tokens.',
        'Train for exactly one epoch on the whole internet.',
        'Use at most 5 tokens per parameter.',
      ],
      correct: 0,
      explanation:
        'Chinchilla found N* ∝ C^0.45 and D* ∝ C^0.55, keeping D/N near 20 — the compute-optimal allocation for minimising training loss (Ch. 4, §4.1.2).',
      source: { label: 'Ch. 4, §4.1.2 Chinchilla Scaling Laws', chapter: 4, section: '4.1.2', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q4-2',
      prompt: 'Why is a model such as LLaMA-3 8B trained on roughly 1900 tokens per parameter?',
      options: [
        'Because the tokenizer is broken.',
        'Because it deliberately trades extra training compute for a smaller, cheaper-to-serve model.',
        'Because Chinchilla requires at least 1000 tokens per parameter.',
        'Because larger models cannot be pretrained.',
      ],
      correct: 1,
      explanation:
        'The ≈20 ratio is optimal only for minimising training loss. When inference volume is high, overtraining produces a small model with low loss that is cheap to run (Ch. 4, §4.1.2).',
      source: { label: 'Ch. 4, §4.1.2, Table 4.1', chapter: 4, section: '4.1.2', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q4-3',
      prompt: 'In the IsoFLOP method, why is the loss curve U-shaped as a function of model size at fixed compute?',
      options: [
        'Small models underfit, while very large models are forced to train on too few tokens.',
        'Learning rates are random.',
        'Because datasets contain noise by definition.',
        'Because loss is measured on the training set only.',
      ],
      correct: 0,
      explanation:
        'With C ≈ 6ND fixed, increasing N forces D down. Too-small models underfit; too-large models are data-starved. The minimum of the U identifies N* for that budget (Ch. 4, §4.1.3).',
      source: { label: 'Ch. 4, §4.1.3 Compute-Optimal Curve', chapter: 4, section: '4.1.3', primary: true },
      difficulty: 'core',
    },
  ],
  sources: [
    { label: 'Ch. 4, §4.1 Scaling Laws: Compute, Data, Parameters', chapter: 4, section: '4.1', page: 83, primary: true },
    { label: 'Ch. 4, §4.1.2 Chinchilla Scaling Laws', chapter: 4, section: '4.1.2', page: 86, primary: true },
    { label: 'Ch. 4, §4.1.3 Compute-Optimal Curve + IsoFLOP', chapter: 4, section: '4.1.3', page: 87, primary: true },
    { label: 'Ch. 4, §4.2 Small Language Models', chapter: 4, section: '4.2', page: 92, primary: true },
    { label: 'Ch. 4, §4.3 Inference-Time Compute', chapter: 4, section: '4.3', page: 99, primary: true },
    { label: 'Ch. 4, §4.4 Sustainable Language Models', chapter: 4, section: '4.4', page: 99, primary: true },
  ],
  furtherReading: [
    {
      referenceId: 'kaplan-2020',
      note:
        'The scaling laws themselves. Worth reading for the shape of the result, and for how carefully it states its own limits.',
    },
    {
      referenceId: 'hoffmann-2022',
      note:
        'The compute-optimal argument, and the correction to the earlier result. The lesson treats the frontier as an estimate rather than a law.',
    },
  ],
  provenance: {
    textbookChapters: [4],
    supplementaryNote:
      'The scaling explorer is an original interactive visualisation of Equation 4.2 with the book\'s fitted coefficients (E≈1.69, A≈406.4, B≈410.7, α≈0.34, β≈0.28); it is a teaching approximation, not a reproduction of the Chinchilla experimental data.',
  },
  keywords: ['scaling laws', 'Kaplan', 'Chinchilla', 'IsoFLOP', 'compute-optimal', 'quantisation', 'inference-time compute'],
}

export const lessonReasoning: LessonContent = {
  id: 'lesson-05-reasoning',
  slug: 'multi-step-reasoning',
  secondaryParts: ['part-3-agents'],
  order: 5,
  part: 'part-2-reasoning',
  title: 'Multi-step Reasoning and Self-Reflection',
  summary:
    'Chain of thought, tree of thoughts, ReAct and reflexion: how intermediate steps and an external harness turn a memory-less next-token predictor into something that can work through a stateful problem.',
  minutes: 45,
  difficulty: 'core',
  prerequisites: ['foundations-of-language-modeling', 'training-pipeline'],
  objectives: [
    { text: 'Explain in-context learning as conditioning, and why it emerged only at sufficient scale.', source: 'Ch. 6, §6.1.1; Ch. 9, §9.2.1.2' },
    { text: 'Describe chain of thought prompting and its zero-shot variant.', source: 'Ch. 6, §6.1.3' },
    { text: 'Explain why a memory-less function struggles with stateful problems.', source: 'Ch. 6, §6.2.1–6.2.3' },
    { text: 'Write the control flow of a small agentic harness with role-specific prompts.', source: 'Ch. 6, §6.2.4' },
    { text: 'Contrast search-based prompt optimisation with reinforcement learning with verifiable rewards.', source: 'Ch. 6, §6.2.4.1–6.2.4.3' },
    { text: 'Describe the brittleness of prompting methods and the knowing–doing gap.', source: 'Ch. 6, §6.3' },
  ],
  sections: [
    {
      id: 'icl',
      title: 'In-context learning',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'A prompting trick that deserves to be understood as a mechanism: putting *examples* in the prompt conditions the decoder to activate a region of the knowledge already stored in its weights. Nothing is updated. That is why the technique costs only tokens — and why the effects vanish when the model is too small to have acquired the relevant patterns.',
        },
        {
          kind: 'diagram',
          diagram: 'react-cycle',
          caption:
            'Reason → Act → Observe. ReAct interleaves reasoning traces with actions so that observations from the environment can correct the plan mid-flight.',
        },
        {
          kind: 'callout',
          tone: 'source',
          title: 'From the source',
          markdown:
            'In-context examples can be *facts* (Style B) or *reasoning steps* (Style C). Chain of thought uses the second kind: the prompt demonstrates how to arrive at an answer rather than what the answer is (Ch. 9, §9.2.1.3).',
        },
      ],
    },
    {
      id: 'cot',
      title: 'Chain of thought and its descendants',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Chain of thought emerged to fix a specific weakness: simple arithmetic and multi-hop word problems. The intervention is small — the prompt shows intermediate reasoning — and the effect is large enough to have reshaped how models are prompted *and* finetuned. A hand-written task-specific prompt beats the zero-shot sentence "Let\'s think step by step", but the zero-shot version is generic and cheap.',
        },
        {
          kind: 'list',
          items: [
            '**Chain of thought (Wei et al., 2022)** — few-shot examples that demonstrate reasoning steps.',
            '**Zero-shot CoT (Kojima et al., 2022)** — the generic "Let\'s think step by step" instruction.',
            '**Tree of thoughts (Yao et al., 2024)** — generate several candidate steps, evaluate them, and search instead of following one line.',
            '**Self-evaluation and code generation for validation** — let the model check its own intermediate result, or emit code that can be executed to verify it.',
          ],
        },
        {
          kind: 'formula',
          latex:
            '\\text{answer} = \\arg\\max_{a} p_{\\theta}\\bigl(a \\mid \\text{query}, \\text{steps}_{1..k}\\bigr)',
          caption:
            'Written informally: conditioning the answer on a chain of intermediate steps changes the distribution the model samples from.',
        },
        {
          kind: 'callout',
          tone: 'insight',
          title: 'Reasoning transfers',
          markdown:
            'Reasoning behaviour can be distilled from a large model into a much smaller one (Ch. 9, §9.2.1.3). That is one reason to distinguish *capability* from *size* when you design an agent: not every step needs the largest available model.',
        },
      ],
    },
    {
      id: 'state',
      title: 'State, memory and the knowing–doing gap',
      blocks: [
        {
          kind: 'demo',
          demo: 'planning',
          title: 'Why a greedy planner gets stuck',
          intro:
            'Before the harness can plan, it needs a model of the world. This is the same grid the planning laboratory uses: a key, a locked door and a goal. Step through the greedy planner and watch where it fails, then switch to the search planner and see what a different model of the world buys.',
        },
        {
          kind: 'prose',
          markdown:
            'Chapter 6 then confronts the structural problem: the model is a memory-less function of its input, but agentic tasks are stateful. The harness must therefore hold the state — a plan, a scratchpad, a history, a set of retrieved documents — and re-inject it in the right form at the right time.',
        },
        {
          kind: 'list',
          items: [
            'Retrieval augmentation and long context windows extend what can be supplied.',
            'Harness state lets the agent remember where it is in a multi-step procedure.',
            'Prompt improvement turns the harness into an automatic prompt engineer.',
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Brittleness and the knowing–doing gap',
          markdown:
            '§6.3 warns that these methods are brittle, and §15.4 later documents cases where a model can *predict* the right action yet not take it. Passing knowledge through a harness is necessary but not sufficient; verify behaviour, not just understanding.',
        },
        {
          kind: 'prose',
          markdown:
            'Chapter 10 then puts the whole chapter under a test. **BALROG** is a benchmark of games and puzzles built to measure reasoning and reflection in agents, and the case study works through it as an experimental harness: a fixed environment, a fixed scoring rule, and the same scenario run against different configurations. That is the same discipline this course uses for the planning laboratory, and it is the reason the chapter can say anything about reflection at all rather than only describe it.',
        },
        {
          kind: 'list',
          items: [
            'A frozen environment and a stated metric, so that two configurations can be compared rather than admired.',
            'Failures attributed to a component — the planner, the executor, the reflection step — instead of to "the agent".',
            'The reflection step earns its place only if it changes the score; Chapter 10 measures whether it does.',
          ],
        },
      ],
    },
    {
      id: 'harness-code',
      title: 'Worked example: a 20-line harness',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'The following pseudo-code is the shape of every harness in this course — including the deterministic simulator behind the workflow builder. Roles are prompts; the loop is control flow; state is a data structure.',
        },
        {
          kind: 'code',
          language: 'text',
          caption: 'Harness skeleton (adapted from the structure described in Ch. 6, §6.2.4)',
          code: `state = { goal, history: [], scratchpad: "" }

loop up to MAX_STEPS:
    prompt = build_prompt(role="planner", state)
    plan   = llm(prompt)
    state.scratchpad = plan
    if plan.requires_tool:
        observation = call_tool(plan.tool, plan.args)
        state.history.append(observation)
    critique = llm(build_prompt(role="evaluator", state))
    if critique.is_good_enough:
        return llm(build_prompt(role="writer", state))
    state.history.append(critique)
return fallback_response(state)`,
        },
        {
          kind: 'example',
          title: 'Roles in the reflection harness',
          steps: [
            { label: 'Generator', detail: 'Produces a candidate step or subproblem decomposition.' },
            { label: 'Evaluator', detail: 'Scores or verifies the candidate against the goal or against execution results.' },
            { label: 'Improver', detail: 'Rewrites the prompt or the plan using the evaluation, optionally with search (tree of thoughts) or RL.' },
            { label: 'Memory', detail: 'Buffers of thoughts and reflexion-style records persist state between invocations of the model.' },
          ],
          takeaway:
            'One model, several roles, one harness. The intellectual content is not in a new network but in the control flow around it.',
        },
        {
          kind: 'callout',
          tone: 'source',
          title: 'RLVR',
          markdown:
            'Reinforcement learning with verifiable rewards (§6.2.4.3) closes the loop when a task admits an automatic correctness check — maths, code, games. The harness spends test-time compute on roll-outs; correct solutions become training signal. Style E in Chapter 9 then makes the parameters themselves change.',
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
            'An agent solves arithmetic word problems badly with a single prompt but well when asked to show intermediate steps. Nothing about the model changed. Explain what did.',
          answer:
            'The distribution being conditioned changed. Chain of thought makes the model generate intermediate tokens, and each generated token becomes context for the following ones, so the final answer is computed from a longer, more structured input (Ch. 6, §6.1.3). This is inference-time compute: more tokens spent to obtain a better answer.',
        },
        {
          kind: 'predict',
          question: {
            id: 'p5-cot',
            prompt:
              'The same model answers a word problem badly when asked directly and well when asked to show its steps. What exactly changed?',
            options: [
              'The model gained a new capability that was not there before.',
              "The model's weights changed to emphasise arithmetic.",
              'The distribution the model samples from changed: the answer is now conditioned on a step sequence, and the sequence was sampled from a distribution the model was better at.',
              'The prompt was longer, so the model had more room to think.',
            ],
            correct: 2,
            explanation:
              'Nothing about the model changed. Chain of thought changes the *conditional distribution*: the model samples a step sequence first, and the answer is conditioned on it. Because the model is better at continuing a worked solution than at jumping to the answer, the composed system is better even though the underlying model is unchanged. This is why the effect shows up in prompting before it shows up in training (Ch. 6, §6.1.3).',
            source: { label: 'Ch. 6, §6.1.3 Chain of thought prompting', chapter: 6, section: '6.1.3', primary: true },
            difficulty: 'core',
          },
        },
        {
          kind: 'lab-link',
          labId: 'planning',
          title: 'See the loop for yourself',
          description:
            'The planning demonstration in this lesson shows a planner choosing actions step by step; the planning laboratory compares four of them on the same grid.',
        },
      ],
    },
  ],
  quiz: [
    {
      id: 'q5-1',
      prompt: 'What distinguishes chain of thought prompting from ordinary few-shot prompting?',
      options: [
        'The examples demonstrate intermediate reasoning steps rather than only input–output pairs.',
        'It finetunes the model weights.',
        'It removes the need for a tokenizer.',
        'It requires a reinforcement learning reward model.',
      ],
      correct: 0,
      explanation:
        'Style C prompting supplies examples of the *steps* to take, so the model conditions its answer on a reasoning chain (Ch. 6, §6.1.3; Ch. 9, §9.2.1.3).',
      source: { label: 'Ch. 6, §6.1.3 Chain of Thought Prompting', chapter: 6, section: '6.1.3', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q5-2',
      prompt: 'Why does the chapter call an LLM a "memory-less function" when it is used in an agent?',
      options: [
        'Because it forgets its pretraining when tools are used.',
        'Because its output depends on the input it is given; state that persists must be held outside the model and re-supplied.',
        'Because it cannot produce more than one token.',
        'Because attention removes earlier tokens.',
      ],
      correct: 1,
      explanation:
        'The model estimates an output from its input. Any persistent state — plan, scratchpad, history — lives in the harness and is re-injected, which is what styles D and E formalise (Ch. 6, §6.2.1; Ch. 9, §9.3.1).',
      source: { label: 'Ch. 6, §6.2.1 LLMs are Memory-less Functions', chapter: 6, section: '6.2.1', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q5-3',
      prompt: 'In the self-reflection harness, what is the role of the evaluator prompt?',
      options: [
        'To rewrite the system prompt of the host application.',
        'To score or verify a generated step or answer, producing feedback the harness can act on.',
        'To execute tool calls on behalf of the user.',
        'To compress the tokenizer vocabulary.',
      ],
      correct: 1,
      explanation:
        'The harness calls the same model with different prompts: generation, evaluation, and prompt improvement. Evaluation supplies the feedback that drives search or RL (Ch. 6, §6.2.4; Ch. 9, Figure 9.7).',
      source: { label: 'Ch. 6, §6.2.4 Agentic Harness for Prompt Improvement', chapter: 6, section: '6.2.4', primary: true },
      difficulty: 'advanced',
    },
  ],
  sources: [
    { label: 'Ch. 6, §6.1 In-Context Reasoning', chapter: 6, section: '6.1', page: 125, primary: true },
    { label: 'Ch. 6, §6.1.3 Chain of Thought Prompting', chapter: 6, section: '6.1.3', page: 128, primary: true },
    { label: 'Ch. 6, §6.2 Self-Reflection and State', chapter: 6, section: '6.2', page: 133, primary: true },
    { label: 'Ch. 6, §6.2.4.3 RLVR', chapter: 6, section: '6.2.4.3', page: 141, primary: true },
    { label: 'Ch. 6, §6.3 Concluding Remarks (Brittleness)', chapter: 6, section: '6.3', page: 142, primary: true },
    { label: 'Ch. 10, Case Study 2: Reasoning and Reflection (BALROG)', chapter: 10, page: 211, primary: true },
  ],
  furtherReading: [
    {
      referenceId: 'wei-2022-cot',
      note:
        'Chain-of-thought prompting. The paper reports the scale threshold at which the behaviour appears, which is why the lesson treats it as emergent rather than taught.',
    },
    {
      referenceId: 'press-2022-selfask',
      note:
        'Self-Ask: decomposing a question into sub-questions, and measuring the gap between composing and executing a decomposition.',
    },
    {
      referenceId: 'yao-2022-react',
      note:
        'ReAct, which interleaves reasoning with action — the harness pattern the planning lab runs.',
    },
  ],
  provenance: {
    textbookChapters: [6, 10],
    supplementaryNote:
      'The pseudo-code harness is original teaching material written for this course; it transcribes the control flow described in §6.2.4 into compact form and is not copied from the book or from any third-party project.',
  },
  keywords: ['chain of thought', 'ReAct', 'reflexion', 'tree of thoughts', 'RLVR', 'harness', 'state'],
}

export const lessonVision: LessonContent = {
  id: 'lesson-06-vision-action',
  slug: 'vision-action-world-models',
  secondaryParts: [],
  order: 6,
  part: 'part-2-reasoning',
  title: 'Vision, Action and World Models',
  summary:
    'How transformer models acquire non-linguistic competence: vision-language architectures, vision-language-action models trained on robot trajectories, and world models that let an agent simulate before it acts.',
  minutes: 40,
  difficulty: 'core',
  prerequisites: ['foundations-of-language-modeling'],
  objectives: [
    { text: 'Describe the three-part anatomy of a VLM: vision encoder, language model, and the projection that joins them.', source: 'Ch. 7, §7.1.2' },
    { text: 'Name standard VLM tasks (VQA, captioning, generation) and their benchmark families.', source: 'Ch. 7, §7.1.1' },
    { text: 'Explain how vision-language-action models differ from passive VLMs.', source: 'Ch. 7, §7.2' },
    { text: 'Explain why world models improve sample efficiency in model-based RL.', source: 'Ch. 7, §7.3; §7.3.5' },
    { text: 'Contrast world modelling strategies such as latent dynamics, code-generating dynamics, and simulator-in-the-loop planning.', source: 'Ch. 7, §7.3.2; WorldGPT, WebDreamer, WorldCoder' },
  ],
  sections: [
    {
      id: 'vlm-tasks',
      title: 'What vision-language models do',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'Most frontier models are now multi-modal, so the practical question is not whether a model can see but what kinds of visual competence you can rely on. Chapter 7 splits the tasks cleanly: **understanding** (visual question answering, counting, spatial predicates), **captioning** (describing), and **generation** (producing images or video). Each has its own benchmark family, and scores are not transferable between them.',
        },
        {
          kind: 'list',
          items: [
            'VQA tasks often test fine-grained grounding: "Is there a red block in the upper corner of the table?"',
            'Captioning admits many valid answers, which makes scoring subtler than classification accuracy.',
            'Generation tasks re-use the same transformer backbone with a different output head and training signal.',
          ],
        },
      ],
    },
    {
      id: 'vlm-architecture',
      title: 'Architecture: making pixels token-like',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'The hard part is architectural: convolutional networks like two-dimensional grids of pixels; transformers like one-dimensional sequences of tokens. A VLM resolves the mismatch by encoding an image with a vision encoder, projecting the result into the language model\'s embedding space, and then treating image features as additional context tokens.',
        },
        {
          kind: 'diagram',
          diagram: 'vlm-architecture',
          caption:
            'VLM anatomy: vision encoder → projection → language model. The projection layer is what turns visual features into something the transformer can attend to alongside text.',
        },
        {
          kind: 'callout',
          tone: 'source',
          title: 'Architecture, then algorithm, then results',
          markdown:
            'Each of §7.1–7.3 follows the same three-part structure: tasks, architecture, learning algorithm, results. That repetition is a reading strategy — when you meet a new model, ask those four questions in order.',
        },
      ],
    },
    {
      id: 'vla',
      title: 'From seeing to acting: VLA models',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'A VLM that describes a robot arm is still passive. **Vision-language-action** models add action to the output space and are trained on robotic trajectories, which is what lets them generalise across tasks and hardware. This is also the clearest example of the book\'s data argument: interaction generates the training data that promotes capability (Ch. 1, §1.2.4).',
        },
        {
          kind: 'table',
          caption: 'Passive versus acting multi-modal models',
          headers: ['Aspect', 'VLM', 'VLA'],
          rows: [
            ['Output', 'Text (answers, captions)', 'Text and low-level actions'],
            ['Training data', 'Image–text pairs', 'Robot action sequences, often with language'],
            ['Failure mode', 'Wrong description', 'Physical mistake — the wrong movement'],
            ['Role in the book', 'Perception for assistants', 'Grounded agency in the physical world'],
          ],
        },
      ],
    },
    {
      id: 'world-models',
      title: 'World models: simulating before acting',
      blocks: [
        {
          kind: 'prose',
          markdown:
            'A world model is a learned, compressed representation of how the environment behaves. In model-based reinforcement learning it exists for one reason: planning against a model is cheaper than acting in the real environment, and it improves **sample efficiency**. Chapter 7 applies the same idea to LLM agents, where a real environment might be a website, a shop, or a household.',
        },
        {
          kind: 'diagram',
          diagram: 'world-model-loop',
          caption:
            'Model-based control: the agent plans inside the learned model, acts in the environment, and updates both the model and the policy from the outcome.',
        },
        {
          kind: 'formula',
          latex:
            '\\hat{s}_{t+1} = f_{\\theta}(s_t, a_t), \\qquad \\hat{r}_t = g_{\\theta}(s_t, a_t)',
          caption:
            'The learned transition function f and reward function g that constitute the world model; planning rolls these forward instead of querying the environment.',
        },
        {
          kind: 'prose',
          markdown:
            'The book\'s examples span three design choices. **WorldGPT** learns a world-VLM from video with external knowledge and long-term memory. **WebDreamer** simulates e-commerce actions with a distilled, cheaper model before executing them. **WorldCoder** goes further: it has the LLM write the dynamics model as interpretable Python, which then runs far faster than repeated LLM inference.',
        },
        {
          kind: 'table',
          caption: 'Three world-model strategies (Ch. 7, §7.3.1)',
          headers: ['System', 'Form of the model', 'Why it helps'],
          rows: [
            ['WorldGPT', 'Latent world-VLM learned from video', 'Multi-modal planning with memory'],
            ['WebDreamer', 'Small distilled simulator', 'Fast action simulation before touching the real web'],
            ['WorldCoder', 'Dynamics written as Python code', 'Efficient, inspectable transition/reward functions'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'A world model is a belief, not the world',
          markdown:
            'Simulated roll-outs inherit the model\'s errors, and WorldCoder-style generated dynamics can be subtly wrong. Predicted versus actual transitions should be logged and compared — which is exactly what Lab C asks you to do.',
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
            'Your agent must buy a train ticket on a site it has never seen. What does a world model buy you, and what is the risk?',
          answer:
            'It lets the agent roll out candidate action sequences (find departure field, enter city, click search) against a learned or distilled transition model before executing them, avoiding irreversible mistakes and saving real-environment steps — the WebDreamer pattern. The risk is model error: if the simulated site dynamics differ from the real site, the plan fails precisely where the agent has not yet observed reality. Confirm with an observation after acting rather than trusting the simulation.',
        },
        {
          kind: 'predict',
          question: {
            id: 'p6-worldmodel',
            prompt:
              'Your agent must buy a train ticket on a site it has never seen. You give it a world model that predicts what each page will do. What is the benefit, and what is the risk?',
            options: [
              'Benefit: it can plan without exploring the site. Risk: if the model is wrong, the agent will confidently act on a prediction that is false.',
              'Benefit: it can see the site before visiting it. Risk: it will spend too long exploring.',
              'Benefit: it does not need a policy. Risk: world models cannot be trained from interaction.',
              'Benefit: it becomes safe on unfamiliar sites. Risk: it becomes too cautious.',
            ],
            correct: 0,
            explanation:
              'A world model lets the agent simulate the effect of an action — clicking "Depart" and predicting a date picker — before committing to it, which is exactly what a site it has never seen requires. The risk is that the plan is only as good as the model: if it mispredicts, the agent acts on a false belief with full confidence. This is the model-based failure regime the textbook describes (Ch. 7, §7.3.5).',
            source: { label: 'Ch. 7, §7.3.5 Model-based reinforcement learning', chapter: 7, section: '7.3.5', primary: true },
            difficulty: 'core',
          },
        },
        {
          kind: 'lab-link',
          labId: 'world-model',
          title: 'Compare planning with and without a model',
          description:
            'Lab C runs a model-free agent and a model-based agent on the same grid, then shows where the learned model diverges from reality.',
        },
      ],
    },
  ],
  quiz: [
    {
      id: 'q6-1',
      prompt: 'What architectural problem does a vision-language model have to solve first?',
      options: [
        'Aligning 2-D image grids with the transformer\'s 1-D sequence of tokens via an encoder and a projection.',
        'Removing the attention mechanism entirely.',
        'Replacing tokenization with character-level dictionaries.',
        'Making images deterministic.',
      ],
      correct: 0,
      explanation:
        'The two fields use different architectures — convolutional processing of pixel grids and sequential transformers. VLMs encode the image, project the features, and treat them as context tokens (Ch. 7, §7.1.2).',
      source: { label: 'Ch. 7, §7.1.2 Architecture', chapter: 7, section: '7.1.2', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q6-2',
      prompt: 'Why do vision-language-action models require robotic trajectory data?',
      options: [
        'Because actions must be grounded in physical sequences, and that interaction data is what teaches the model how movements follow perception.',
        'Because images cannot be tokenized without a robot.',
        'Because it is cheaper than collecting text.',
        'Because VLA models do not use attention.',
      ],
      correct: 0,
      explanation:
        'VLA models extend VLM outputs with actions trained on robotic trajectories, which is the book\'s central example of an interaction-data loop, and improves generality of robot behaviour (Ch. 7, §7.2; Ch. 1, §1.2.4).',
      source: { label: 'Ch. 7, §7.2 Decisions & Vision Language Action Models', chapter: 7, section: '7.2', primary: true },
      difficulty: 'core',
    },
    {
      id: 'q6-3',
      prompt: 'What is the main advantage of planning with a world model in model-based reinforcement learning?',
      options: [
        'It guarantees optimal actions.',
        'It improves sample efficiency by replacing expensive real-environment interaction with simulated roll-outs.',
        'It removes the need for a reward function.',
        'It makes the environment deterministic.',
      ],
      correct: 1,
      explanation:
        'The world model allows the agent to plan inside a learned, compressed representation, which is valuable when interacting with the real environment is more expensive than simulating it (Ch. 7, §7.3.1 and §7.3.5).',
      source: { label: 'Ch. 7, §7.3 World Models, Physics, and Planning', chapter: 7, section: '7.3', primary: true },
      difficulty: 'core',
    },
  ],
  sources: [
    { label: 'Ch. 7, §7.1 Multi-modal Vision Language Models', chapter: 7, section: '7.1', page: 151, primary: true },
    { label: 'Ch. 7, §7.2 Decisions & Vision Language Action Models', chapter: 7, section: '7.2', page: 158, primary: true },
    { label: 'Ch. 7, §7.3 World Models, Physics, and Planning', chapter: 7, section: '7.3', page: 164, primary: true },
    { label: 'Ch. 7, §7.3.5 Model-Based Reinforcement Learning', chapter: 7, section: '7.3.5', page: 171, primary: true },
  ],
  furtherReading: [
    {
      referenceId: 'ha-schmidhuber-2018',
      note:
        'The origin of the world-model idea in model-based reinforcement learning, and the reason a learned model can be actively unsafe when it is wrong.',
    },
  ],
  provenance: {
    textbookChapters: [7],
    supplementaryNote:
      'The train-ticket checkpoint and the passive/acting comparison table are original course material. WorldGPT, WebDreamer and WorldCoder are third-party research systems cited by the book; this lesson describes them and does not redistribute their code.',
  },
  keywords: ['VLM', 'VLA', 'world model', 'model-based RL', 'sample efficiency', 'planning'],
}
