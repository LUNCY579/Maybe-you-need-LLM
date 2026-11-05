import type { LessonSection, QuizQuestion } from '../../types/curriculum'

/**
 * Advanced-track material.
 *
 * Each lesson ships with a deeper treatment that the core track deliberately
 * does not develop: quantitative derivations, counterexamples, design
 * trade-offs and the open problems the textbook flags. Switching a lesson to
 * the advanced track adds these sections and the advanced questions below.
 *
 * The content is authored for this course and cites the textbook sections it
 * develops; it is not copied from the book.
 */

export interface AdvancedTrack {
  sections: LessonSection[]
  quiz: QuizQuestion[]
}

export const ADVANCED_TRACK: Record<string, AdvancedTrack> = {
  /* ---------------------------------------------------------------- */
  'what-agentic-llms-are': {
    sections: [
      {
        id: 'adv-harness-formalism',
        title: 'Advanced: the harness as a state machine',
        blocks: [
          {
            kind: 'prose',
            markdown:
              'A useful formalisation of the harness treats it as a **transition function over an explicit state**. Write the state as \\(s = (c, m, \\theta, \\tau)\\), where \\(c\\) is the conversation context, \\(m\\) is the memory store, \\(\\theta\\) is the accumulated tool and reasoning trace, and \\(\\tau\\) is the task state (what still has to be done). The model call is then a function of a *rendering* of that state, not of the state itself: \\(o_t = f_\\theta(\\mathrm{render}(s_t))\\), and the harness applies the model output to produce \\(s_{t+1} = g(s_t, o_t)\\).\n\nThis gives you two places to intervene, and the distinction explains most of the patterns in the book. You can change \\(f\\) (a different model, a different prompt template, more context) — that is *prompt* engineering. Or you can change \\(g\\) (the state update rule, the tool dispatch, the stopping condition) — that is *harness* engineering, and it is where the agentic patterns live.',
          },
          {
            kind: 'formula',
            latex: 'o_t = f_\\theta\\bigl(\\mathrm{render}(s_t)\\bigr), \\qquad s_{t+1} = g(s_t, o_t)',
            caption:
              'The model proposes; the harness decides. Chapter 1 separates the two, and every later pattern is a choice about one or the other.',
          },
          {
            kind: 'prose',
            markdown:
              'Read through that lens, the five agentic interaction styles in Chapter 9 are not five different *models*. They are five different choices about \\(f\\) and \\(g\\): a query prompt changes only \\(f\\); in-context learning changes \\(f\\) by changing \\(c\\); chain of thought changes \\(g\\) because the harness now asks for and stores intermediate steps; a self-reflection harness changes \\(g\\) by adding a critique–revise cycle; reinforcement finetuning changes \\(f\\) itself, by training the parameters \\(\\theta\\) on rewards collected at inference time.',
          },
          {
            kind: 'callout',
            tone: 'insight',
            title: 'Why the distinction is worth making explicit',
            markdown:
              'When an agent fails, the two failures look identical from the outside — a wrong final answer. But they have completely different fixes. If \\(f\\) was wrong, you need a better prompt, a better model, or more context. If \\(g\\) was wrong, the model was fine and the harness gave it the wrong state: the tool was never called, the observation was dropped, the loop stopped early. A trace that records \\(g\\) steps (which node ran, what state it saw, which branch it took) tells you which side broke. That is the argument for tracing harnesses rather than just prompts.',
          },
          {
            kind: 'prose',
            markdown:
              'The recursive self-improvement cycle in Figure 1.1 closes the loop the same way. An agent that acts produces interaction data; that data can be used to train a better model; the better model acts better; the better actions produce better data. Chapter 1 is careful that this loop is not automatically virtuous — the data an agent generates is only as good as the environment it acts in, and Chapter 19 shows how self-generated data can collapse.',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q1-4',
        prompt:
          'An agent returns a wrong answer. The trace shows the model was called once with a context that never contained the file the task needed. Which half of the system is at fault?',
        options: [
          'The model (f), because it should have inferred the file contents.',
          'The harness (g), because the state it constructed for the model was incomplete.',
          'Neither: the answer is simply beyond the model.',
          'The training data, which should have contained the file.',
        ],
        correct: 1,
        explanation:
          'The model can only act on the state it is given. If the needed file was never placed in the context, the failure is in the state update rule g — the retrieval or state-management half of the harness. This is the distinction introduced in Ch. 1, §1.2.2 and formalised above.',
        source: { label: 'Ch. 1, §1.2.2 Agentic Harness', chapter: 1, section: '1.2.2', primary: true },
        difficulty: 'advanced',
      },
      {
        id: 'q1-5',
        prompt:
          'Which pair of changes corresponds to chain of thought (C) and reinforcement finetuning (E) in the interaction-style taxonomy of Chapter 9?',
        options: [
          'C changes g; E changes f.',
          'C changes f; E changes g.',
          'Both change only the context window.',
          'Both change only the model weights.',
        ],
        correct: 0,
        explanation:
          'Chain of thought leaves the weights untouched and works by changing the harness: the prompt now elicits and stores intermediate reasoning steps, which changes how state is updated (g). Reinforcement finetuning changes the parameters themselves, i.e. the model function f (Ch. 9, §9.2.1; Ch. 6, §6.2.4.3).',
        source: { label: 'Ch. 9, §9.2.1 Agentic Interaction Styles', chapter: 9, section: '9.2.1', primary: true },
        difficulty: 'advanced',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  'foundations-of-language-modeling': {
    sections: [
      {
        id: 'adv-attention-derivations',
        title: 'Advanced: attention as a soft lookup',
        blocks: [
          {
            kind: 'prose',
            markdown:
              'Chapter 2 introduces attention as a mechanism for weighting the relevance of other positions. It is worth deriving the scale of the computation, because it explains why the transformer replaced recurrence and why it complicates long context.',
          },
          {
            kind: 'formula',
            latex:
              '\\mathrm{Attention}(Q,K,V) = \\mathrm{softmax}\\!\\left(\\frac{QK^{\\top}}{\\sqrt{d_k}}\\right)V, \\qquad \\mathrm{softmax}(z)_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}',
            caption:
              'Scaled dot-product attention. The 1/sqrt(d_k) factor keeps the softmax in a regime where the variance of the logits does not grow with dimension.',
          },
          {
            kind: 'prose',
            markdown:
              'Write \\(n\\) for the sequence length and \\(d\\) for the model dimension. The three projections cost \\(O(n d^2)\\) per layer, while the attention matrix costs \\(O(n^2 d)\\). For the sequence lengths typical of modern context windows, the \\(n^2\\) term dominates — and it is the term that does not parallelise across positions in the way the \\(O(nd^2)\\) term does. That asymmetry is the origin of the long-context cost problem: doubling the context quadruples the attention work.\n\nThe \\(1/\\sqrt{d_k}\\) is not cosmetic. Without it, for large \\(d_k\\), the dot products \\(q \\cdot k\\) grow in magnitude like \\(\\sqrt{d_k}\\), the softmax saturates, and the output becomes nearly one-hot — gradients vanish and the layer learns little. Dividing by \\(\\sqrt{d_k}\\) keeps the logit variance at roughly one, keeping the softmax in its sensitive region.',
          },
          {
            kind: 'prose',
            markdown:
              'Now connect this to the agentic setting. An agent\'s context is not fixed text: it is a growing transcript of reasoning steps, tool calls, tool outputs and retrieved documents. Two consequences follow. First, \\(n\\) grows during a run, so the cost of a long agentic trajectory grows superlinearly in the number of steps — which is one reason harnesses compress or summarise history rather than replaying everything. Second, because the cost of *writing* to the context is quadratic while the cost of *reading* is linear, a harness that appends a large tool output without trimming is usually making the next inference call substantially more expensive than necessary. The same argument appears in Chapter 9, §9.3.2.2 on long context windows and compression.',
          },
          {
            kind: 'callout',
            tone: 'warning',
            title: 'Where the intuition fails',
            markdown:
              'The "attention as soft lookup" reading is a useful engineering mental model, not a mechanistic claim about what the model computes. Chapter 21 makes this point sharply: a single attention head is not a retrieval operator, circuits are distributed, and the same behaviour can be produced by different internal routes. Use the lookup picture to reason about *cost* and *information flow*; do not use it to conclude that the model "looked up" a fact.',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q2-4',
        prompt:
          'A transformer doubles its context length from 2k to 4k tokens. Which statement best describes the change in the attention computation?',
        options: [
          'It doubles, because the projection cost is linear in sequence length.',
          'It quadruples, because the attention matrix has n² entries while the projections grow only linearly in n.',
          'It is unchanged, because attention is linear in the number of tokens.',
          'It halves, because each token attends to half as many others.',
        ],
        correct: 1,
        explanation:
          'The n²d term of the attention product dominates at long n, so doubling the sequence length quadruples the attention work while the O(nd²) projections merely double. This is the computational reason agent harnesses must compress history (Ch. 2, §2.3.4–2.3.5; Ch. 9, §9.3.2.2).',
        source: { label: 'Ch. 2, §2.3.4 Attention; §2.3.5 Transformers', chapter: 2, section: '2.3.4', primary: true },
        difficulty: 'advanced',
      },
      {
        id: 'q2-5',
        prompt: 'Why is the softmax argument scaled by 1/√d_k in scaled dot-product attention?',
        options: [
          'To make the computation faster in wall-clock terms.',
          'To keep the logits at unit variance so the softmax does not saturate and gradients survive.',
          'To normalise the output values to sum to one.',
          'To reduce the memory needed to store the attention weights.',
        ],
        correct: 1,
        explanation:
          'Dot products of independent random projections grow like √d_k in magnitude. Without the scaling the softmax saturates, the output becomes near one-hot, and learning stalls. The scaling keeps the logit variance around one (Ch. 2, §2.3.4).',
        source: { label: 'Ch. 2, §2.3.4 Attention', chapter: 2, section: '2.3.4', primary: true },
        difficulty: 'advanced',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  'training-pipeline': {
    sections: [
      {
        id: 'adv-preference-tuning',
        title: 'Advanced: from demonstrations to preferences',
        blocks: [
          {
            kind: 'prose',
            markdown:
              'The training pipeline in Chapter 3 has three post-pretraining stages, and it is worth being precise about what each one optimises, because agents inherit the assumptions of all three.',
          },
          {
            kind: 'table',
            caption: 'What each post-pretraining stage changes',
            headers: ['Stage', 'Signal', 'What it changes', 'What it cannot fix'],
            rows: [
              [
                'Supervised finetuning',
                'Demonstrations (prompt → target)',
                'The conditional distribution the model produces for instruction-like inputs',
                'Preference among valid answers; behaviour under tool failure',
              ],
              [
                'Preference tuning',
                'Ranked pairs (chosen > rejected)',
                'The relative ordering of acceptable outputs',
                'Whether the right tool was selected at all',
              ],
              [
                'Reinforcement with verifiable rewards',
                'A programmatic checker on the task',
                'Behaviour that can be verified automatically (code that runs, a puzzle solved)',
                'Tasks whose success cannot be checked automatically',
              ],
            ],
          },
          {
            kind: 'prose',
            markdown:
              'The third row is the one that matters most for agents, and Chapter 6, §6.2.4.3 develops it. A verifier is a function \\(V(o, \\tau)\\) from a task outcome \\(o\\) and the environment state \\(\\tau\\) to a scalar reward in \\(\\{0, 1\\}\\). The important design question is not the RL algorithm — it is *what can be verified*. For a coding agent, the verifier is a test suite. For a puzzle agent, it is the win condition. For a research assistant, it is often a human judgement, which is not programmatically checkable, and therefore not directly usable as a verifiable reward.\n\nThis creates a sharp asymmetry that runs through the whole book: environments that can be verified cheaply are precisely the environments where agents can be improved automatically. The BALROG case study in Chapter 10 is built on games with programmatic win conditions for exactly this reason.',
          },
          {
            kind: 'callout',
            tone: 'insight',
            title: 'Why this matters for the harness you write',
            markdown:
              'The training pipeline determines the *prior* your harness inherits. A model finetuned on short, self-contained answers will tend to produce short, self-contained answers — and will under-use tools it was rarely rewarded for using. A model finetuned with verifiable rewards on tool-using tasks will emit more tool calls, including ones that fail, because failing tool calls were part of its training distribution. Before you conclude that "the model will not use the tool", check whether the pipeline ever rewarded it for using one.',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q3-4',
        prompt:
          'A research assistant agent is to be improved with reinforcement learning on verifiable rewards. Why is this harder than for a code agent?',
        options: [
          'Research tasks have more tokens, so the reward signal is noisier.',
          'Verifiable rewards require a programmatic checker, and research quality usually cannot be checked automatically.',
          'Code agents are trained on more data, so their reward function generalises better.',
          'It is not harder: any task can be verified with a string comparison.',
        ],
        correct: 1,
        explanation:
          'A verifiable reward needs an automatic checker of the outcome. Test suites and win conditions provide that; judgements of research quality usually do not. This is why agentic RL has concentrated on verifiable domains (Ch. 3, §3.2.4; Ch. 6, §6.2.4.3; Ch. 10, §10.1).',
        source: { label: 'Ch. 6, §6.2.4.3 RL with Verifiable Rewards', chapter: 6, section: '6.2.4.3', primary: true },
        difficulty: 'advanced',
      },
      {
        id: 'q3-5',
        prompt:
          'Which observation would most strongly support the claim that "the model rarely uses tools because it was never rewarded for using them"?',
        options: [
          'The model emits tool calls when the system prompt explicitly demands them.',
          'The model produces long answers instead of tool calls, and the training mix contains many demonstrations of long answers with few tool-use traces.',
          'The model has a high perplexity on the tool-schema token sequence.',
          'The model refuses tool use only in multilingual settings.',
        ],
        correct: 1,
        explanation:
          'The claim is about the training distribution, so the strongest evidence is the distribution itself: many long-answer demonstrations and few tool-use traces predict exactly that behaviour. The other options either do not test the claim (perplexity) or test something different (multilingual behaviour).',
        source: { label: 'Ch. 3, §3.2 Training Pipeline; Ch. 9, §9.2.1', chapter: 3, section: '3.2', primary: true },
        difficulty: 'advanced',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  'scaling-laws-and-efficiency': {
    sections: [
      {
        id: 'adv-chinchilla-derivation',
        title: 'Advanced: reading the compute-optimal frontier',
        blocks: [
          {
            kind: 'prose',
            markdown:
              'Chapter 4 gives the compute-optimal relationship between model size and training tokens. The teaching explorer in this lesson fits an approximation; the point of this section is to make the approximation\'s structure legible so that you can reason about where a design decision moves you relative to the frontier.',
          },
          {
            kind: 'formula',
            latex:
              'L(N, D) \\approx \\left(\\frac{E}{A}\\right)^{\\alpha} N^{-\\alpha} + \\left(\\frac{E}{B}\\right)^{\\beta} D^{-\\beta}',
            caption:
              'The compute-optimal loss surface (Kaplan-style exponents with Chinchilla-style constants, as parameterised in the textbook’s interactive explorer).',
          },
          {
            kind: 'prose',
            markdown:
              'Read the two terms separately. The first says: for a fixed compute budget \\(E\\), a larger model \\(N\\) reduces the irreducible, model-limited part of the loss. The second says: for a fixed compute budget, more data \\(D\\) reduces the part of the loss that comes from not having seen enough of the distribution.\n\nAt the optimum the two terms balance, which yields the well-known result that the compute-optimal number of tokens scales roughly linearly in the number of parameters. The practical consequence is the uncomfortable one: the 2020-era recipe of training a very large model on a comparatively small corpus was *not* compute-optimal. Chinchilla\'s contribution was to show that the same compute budget spent on a smaller, better-trained model reached a lower loss — and to show that the result held at scales nobody had tested, which is a methodological point as much as a technical one.',
          },
          {
            kind: 'prose',
            markdown:
              'For an engineer the frontier has a second use: it tells you which knob to turn when you are off it. If your model is trained on \\(D < D^*\\) tokens, you are on the data-limited side of the frontier and more tokens will help more than more parameters. If you are data-rich and parameter-poor, the opposite holds. Chinchilla is the right prior when you are training from scratch; it is the wrong prior when you are adapting a pretrained model, because then your compute is spent on finetuning rather than pretraining, and the effective \\(D\\) and \\(N\\) are both inherited rather than chosen.',
          },
          {
            kind: 'callout',
            tone: 'warning',
            title: 'Do not extrapolate the explorer into a forecast',
            markdown:
              'The explorer in this lesson uses the coefficients printed in Chapter 4 as a teaching approximation. It is not a fit to experimental data, and the textbook itself is careful that the scaling exponents carry uncertainty and that emergent-ability claims in particular are contested. Use the tool to build intuition about the *shape* of the trade-off, never to predict a loss number you would plan a project around.',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q4-4',
        prompt:
          'You have a fixed compute budget and a model that is small relative to the data available. According to the compute-optimal frontier, which change most reduces loss?',
        options: [
          'Increase the number of parameters and keep the token count fixed.',
          'Increase the token count, since the loss is data-limited on the current side of the frontier.',
          'Increase both proportionally and change nothing else.',
          'Reduce the learning rate, which frees compute for more tokens.',
        ],
        correct: 1,
        explanation:
          'On the data-limited side, the data term of the loss dominates, so more tokens at fixed compute is the cheaper improvement; on the model-limited side more parameters is. Chinchilla showed that the earlier large-model/small-data recipe sat on the wrong side of this frontier (Ch. 4, §4.1.2–4.1.3).',
        source: { label: 'Ch. 4, §4.1.2 Chinchilla Scaling Laws; §4.1.3 Compute-Optimal Curve', chapter: 4, section: '4.1.3', primary: true },
        difficulty: 'advanced',
      },
      {
        id: 'q4-5',
        prompt: 'Why does the textbook treat emergent-ability claims with caution?',
        options: [
          'Because emergent abilities were shown not to exist in any model.',
          'Because a metric that is continuous can appear to jump when the evaluation discretises it, so the discontinuity may be an artefact of the metric rather than the model.',
          'Because emergent abilities only occur in models above 100 billion parameters.',
          'Because the authors failed to replicate the original results.',
        ],
        correct: 1,
        explanation:
          'Discretising a smooth underlying capability (for example exact-match accuracy) can turn a gradual improvement into what looks like a sudden phase transition. The textbook flags this as a measurement caveat, which is why the section is framed as a caution rather than a claim (Ch. 4, §4.1.4 Emergent Abilities).',
        source: { label: 'Ch. 4, §4.1.4 Emergent Abilities', chapter: 4, section: '4.1.4', primary: true },
        difficulty: 'advanced',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  'multi-step-reasoning': {
    sections: [
      {
        id: 'adv-reflection-cycles',
        title: 'Advanced: what a reflection loop costs',
        blocks: [
          {
            kind: 'prose',
            markdown:
              'Chapter 6 presents self-reflection as a harness pattern: show the model its own output, ask for a critique, feed the critique back, and try again. It works often enough to be worth doing, and it works for reasons that are worth stating precisely, because the same reasons explain when it fails.',
          },
          {
            kind: 'prose',
            markdown:
              'There is a mechanical reason reflection helps. A single generation samples one trajectory through a very high-entropy process: at each token the model has many defensible continuations, and only one of them continues toward the answer. The distribution over *complete* solutions is much more sharply peaked than the distribution over next tokens, because a wrong first step usually leads to an obviously wrong continuation that the model can recognise. A critique pass re-reads the trajectory with the answer in mind and is therefore operating on the better-conditioned distribution. Chapter 6, §6.1.3.1 frames this as self-evaluation; §6.2.4.2 frames it as self-reflection, and the two are related but not identical.',
          },
          {
            kind: 'prose',
            markdown:
              'The cost is equally mechanical. Each additional round is another full model call, and in the "agentic harness for prompt improvement" formulation of §6.2.4, the candidate set is *evaluated* as well as *generated*. If you keep \\(k\\) candidates and make \\(r\\) refinement rounds, you pay on the order of \\(k r\\) generations plus \\(k r\\) evaluations. That is the same trade-off as inference-time compute generally: Chapter 4, §4.3 treats extra inference compute as a first-class scaling axis, and Chapter 6 shows that the same budget can be spent on more samples or on more refinement rounds per sample.',
          },
          {
            kind: 'list',
            items: [
              '**Reflection without a stopping rule** is unbounded: a harness that retries until the score passes will eventually pass, possibly after burning the budget. Always bound the retries.',
              '**Reflection on a wrong premise** fails**: the critique inherits the same false assumption, so it can confidently polish a wrong answer. Verify facts rather than asking the model to re-check them.',
              '**Reflection on a verifiable task** is strongest**: when a checker exists, use the checker as the critic instead of the model. The model\'s self-critique is strictly worse evidence than a test result.',
            ],
          },
          {
            kind: 'prose',
            markdown:
              'The last two points are why Chapter 6, §6.2.4.3 prefers reinforcement with verifiable rewards for tasks that have checkers, and why the textbook\'s own case studies (BALROG in Chapter 10) use environments with programmatic win conditions. The reflection loop is the fallback for tasks you cannot check, not the preferred method for tasks you can.',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q5-4',
        prompt:
          'Why can a self-critique pass be more effective at fixing a solution than the original generation pass?',
        options: [
          'Because the critique pass uses a different model with more parameters.',
          'Because the distribution over complete solutions is more sharply peaked than the distribution over next tokens, so re-reading a trajectory conditions on more of the answer.',
          'Because the critique pass removes the tool outputs from the context.',
          'Because the critique pass is given more temperature.',
        ],
        correct: 1,
        explanation:
          'A single generation samples one path through a high-entropy next-token process. The distribution over complete, correct solutions is much more concentrated, so a second pass that re-reads the trajectory with the goal in mind is sampling from a better-conditioned distribution (Ch. 6, §6.1.3.1, §6.2.4.2).',
        source: { label: 'Ch. 6, §6.2.4.2 Self-Reflection', chapter: 6, section: '6.2.4.2', primary: true },
        difficulty: 'advanced',
      },
      {
        id: 'q5-5',
        prompt:
          'A task has a programmatic checker. Which reflection design does Chapter 6 favour, and why?',
        options: [
          'Model self-critique, because it is cheaper than running the checker.',
          'Using the checker as the critic, because programmatic verification is stronger evidence than the model\'s own judgement.',
          'Sampling more candidates without any critique.',
          'Asking the model to role-play a stricter reviewer persona.',
        ],
        correct: 1,
        explanation:
          'Where a verifier exists, the verifier should be the critic. A model self-critique inherits the model\'s assumptions and can polish a wrong answer; a checker provides independent evidence (Ch. 6, §6.2.4.3; Ch. 10, §10.4).',
        source: { label: 'Ch. 6, §6.2.4.3 RL with Verifiable Rewards', chapter: 6, section: '6.2.4.3', primary: true },
        difficulty: 'advanced',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  'vision-action-world-models': {
    sections: [
      {
        id: 'adv-model-based-planning',
        title: 'Advanced: planning in a learned model',
        blocks: [
          {
            kind: 'prose',
            markdown:
              'Chapter 7, §7.3.5 gives the model-free / model-based distinction and then the mechanism that makes model-based methods attractive: the agent can *simulate* candidate actions before committing to them. The formal comparison is worth spelling out, because it predicts exactly what Lab C demonstrates.',
          },
          {
            kind: 'formula',
            latex:
              'Q^*(s,a) = \\max_{\\pi} \\mathbb{E}\\Bigl[\\sum_{t=0}^{\\infty} \\gamma^t r(s_t,a_t) \\mid s_0 = s, a_0 = a, \\pi\\Bigr]',
            caption:
              'The optimal action-value function. A model-free agent estimates this directly from experience; a model-based agent estimates a transition model and solves for it.',
          },
          {
            kind: 'prose',
            markdown:
              'A model-free agent must try every action in every state to learn its value. A model-based agent learns a transition model \\(\\hat{P}(s\' \\mid s,a)\\) and a reward model \\(\\hat{R}(s,a)\\), then plans *inside* the model: it rolls out candidate action sequences, evaluates them with \\(\\hat{R}\\) and \\(\\hat{P}\\), and picks the best. Planning inside a model converts a learning problem into a search problem.',
          },
          {
            kind: 'prose',
            markdown:
              'The catch is model error. The planner is optimal *with respect to \\(\\hat{P}\\)*, and \\(\\hat{P}\\) is wrong. Three regimes follow, and Lab C reproduces all three. When the model is accurate, model-based planning is clearly better: each real environment step buys many model rollouts, so learning is sample-efficient. When the model is wrong, planning can be *worse* than model-free, because the agent confidently pursues an action sequence that the real environment contradicts, and it may not gather the experience that would correct the model. When the model is badly wrong, it can be catastrophically worse: the plan may be actively unsafe, because nothing in the model reflects the real constraint the agent violates.',
          },
          {
            kind: 'callout',
            tone: 'insight',
            title: 'The generalisation caveat for LLM world models',
            markdown:
              'A learned world model is useful only insofar as its predictions hold in the states the planner will actually visit. Chapter 22, §22.3 is explicit that the evidence for spatial and physical world models in language models is mixed, and that the *agentic* perspective is that a model does not need an internal world model to act competently — it may infer the relevant structure online from observations. The practical lesson is to distrust a world model on out-of-distribution states, and to prefer a model-based policy that can detect model disagreement and fall back.',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q6-4',
        prompt:
          'A model-based agent has learned an inaccurate transition model. Why can it perform *worse* than a model-free agent?',
        options: [
          'Because model-based agents use more memory.',
          'Because the planner is optimal with respect to the wrong model, so it can commit confidently to an action sequence the real environment contradicts.',
          'Because model-free agents always explore uniformly.',
          'Because the reward model is shared between both.',
        ],
        correct: 1,
        explanation:
          'Planning inside an inaccurate model optimises the wrong objective. The agent may avoid the states where it would learn the model is wrong, so it never corrects the error — the regime Lab C reproduces when model accuracy is dialled down (Ch. 7, §7.3.5; Ch. 22, §22.3.2).',
        source: { label: 'Ch. 7, §7.3.5 Model-Based Reinforcement Learning', chapter: 7, section: '7.3.5', primary: true },
        difficulty: 'advanced',
      },
      {
        id: 'q6-5',
        prompt:
          'Chapter 22 argues that an LLM agent can act competently without an internal world model. What is the alternative mechanism it describes?',
        options: [
          'The model runs a hidden simulator in its forward pass.',
          'The agent infers the relevant structure online, from the observations it receives, as it acts.',
          'The harness queries an external physics engine between steps.',
          'The model memorises the environment during pretraining.',
        ],
        correct: 1,
        explanation:
          'The agentic perspective in Ch. 22, §22.3.3 is that competence can come from online inference over observations rather than from a stored, explicit world model. The lesson: do not require an internal model, and do not trust a learned one off-distribution.',
        source: { label: 'Ch. 22, §22.3.2–22.3.3 World Models and Spatial Cognition', chapter: 22, section: '22.3.3', primary: true },
        difficulty: 'advanced',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  'interaction-styles-and-memory': {
    sections: [
      {
        id: 'adv-memory-design',
        title: 'Advanced: designing the memory store',
        blocks: [
          {
            kind: 'prose',
            markdown:
              'Chapter 9, §9.3 gives the motivation for memory (coherent conversation, adaptation, identity, continual learning) and the three implementation families (finetuning, long context with compression, explicit memory management). The interesting engineering is in the third, because it is the only one where the designer chooses what is kept.',
          },
          {
            kind: 'prose',
            markdown:
              'An explicit memory store is a small information-retrieval system with three decisions baked into its design: **what gets written** (the write policy), **what gets dropped** (the eviction policy), and **what comes back** (the retrieval policy). Lab B makes each of these a knob, and the three interact in ways that are easy to get wrong.\n\nStart with the write policy. Writing everything is the obvious choice and the wrong one: it makes eviction arbitrary, because the store contains mostly items that were never relevant. Writing selectively requires a salience signal. One workable signal is **retrieval feedback**: an item that was retrieved and then used to produce a correct answer is demonstrably useful, so it deserves a high salience; an item that was retrieved and produced nothing is demoted. This turns the memory into a small reinforcement-learning problem over write decisions, and it is exactly the kind of mechanism that Chapter 8\'s metalearning framing makes explicit: the agent is learning a policy over how to allocate its own limited memory.',
          },
          {
            kind: 'prose',
            markdown:
              'The eviction policy is then mostly a consequence of the write policy. If salience is well calibrated, a simple eviction rule — drop the lowest-salience item when the store is full — is sufficient, and adding recency or frequency to the rule mostly adds tuning surface without adding much signal. If salience is poorly calibrated, no eviction rule will save you, because the store fills with items the ranking is confident about and the ranking is wrong.\n\nThe retrieval policy is the part students most often over-engineer. The lesson\'s central point is that a hybrid score — a weighted blend of keyword overlap and recency — beats either component alone, and that the blend weight is a genuine trade-off rather than a free parameter: at weight 1.0 the store behaves like a search engine and forgets recency, so a stale but keyword-matching item outranks a fresh relevant one; at weight 0.0 it becomes a recency buffer, which is nearly useless once the conversation turns.',
          },
          {
            kind: 'callout',
            tone: 'warning',
            title: 'The capacity trade-off is not linear',
            markdown:
              'Increasing capacity is not free and not monotone. A larger store keeps more items, but it also keeps more *noise*, and a noisy store degrades every downstream decision: more tokens in the context, more distractors in the scratchpad, and a ranking task that is harder to get right. The optimum in Lab B is interior — there is a capacity past which recall keeps improving while precision falls, and the agent\'s decisions get worse even though it "remembers more". This is the memory analogue of the compute-optimal frontier in Chapter 4, and it is the reason the lab asks you to sweep capacity rather than max it out.',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q7-4',
        prompt:
          'Why does the lesson argue that a memory system with a badly calibrated salience signal cannot be rescued by a cleverer eviction rule?',
        options: [
          'Because eviction rules are computationally expensive.',
          'Because eviction can only remove items; it cannot add information the store never captured, so a store full of wrongly-ranked items stays wrong.',
          'Because eviction rules only work on episodic memory.',
          'Because the write policy is irrelevant to retrieval.',
        ],
        correct: 1,
        explanation:
          'Eviction is subtractive. If the write policy admits many irrelevant items and ranks them highly, no subtractive rule can restore a store that never contained the useful information, and a larger capacity makes the problem worse. Calibrate salience first (Ch. 9, §9.3.2.3; Ch. 8, §8.2).',
        source: { label: 'Ch. 9, §9.3.2 Memory Architectures', chapter: 9, section: '9.3.2', primary: true },
        difficulty: 'advanced',
      },
      {
        id: 'q7-5',
        prompt:
          'A retrieval policy scores items purely by recency. What failure does this produce in a long agentic session?',
        options: [
          'It retrieves the most semantically relevant item reliably.',
          'It retrieves the most recent items regardless of relevance, so an old but decisive fact is lost as soon as unrelated activity occurs.',
          'It guarantees that the store never overflows.',
          'It increases the diversity of retrieved context.',
        ],
        correct: 1,
        explanation:
          'Pure recency is a buffer, not a memory: relevance decays with time rather than with use, and a decisive fact from earlier in the session is dropped by unrelated later activity. The hybrid score in Lab B is the fix (Ch. 9, §9.3.2.3; Ch. 12, §12.3).',
        source: { label: 'Ch. 9, §9.3.2.3 Explicit Memory Management', chapter: 9, section: '9.3.2.3', primary: true },
        difficulty: 'advanced',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  'tools-and-context': {
    sections: [
      {
        id: 'adv-tool-design',
        title: 'Advanced: tool interfaces as an API design problem',
        blocks: [
          {
            kind: 'prose',
            markdown:
              'Chapter 11 gives the architectures (direct invocation; Planner–Caller–Summarizer) and the operational concerns (context management via MCP, robustness, safety). The underexamined part is the interface itself, because in a tool-using agent the *description* of a tool is part of the prompt that decides whether it gets called.',
          },
          {
            kind: 'prose',
            markdown:
              'That makes tool design an API design problem with an unusual twist: there is no type checker, no compiler error, and no stack trace. The model reads the tool name, the parameter descriptions and the examples, and forms a probability distribution over which tool to call with which arguments. Three properties of the description therefore behave like interface properties.\n\n**Discriminability.** If two tools have near-identical descriptions, the choice between them is close to a coin flip on features that do not matter. **Arity clarity.** If every tool takes a single free-text `query` argument, the model has no way to learn the *shape* of the required input, and it will hallucinate arguments. Making the parameters explicit and typed is not pedantry: it is the only schema signal the model gets. **Failure signalling.** If a tool returns errors as prose that looks like a result, the model will treat the error as data and build a plan on top of it. A structured error — a status code and a machine-readable reason — is what lets a harness route the failure into a retry, a re-plan, or an honest report.',
          },
          {
            kind: 'callout',
            tone: 'insight',
            title: 'Context management is a budget problem',
            markdown:
              'MCP and similar protocols standardise the *interface* between harness and tools. They do not solve the *budget* problem: every tool result that lands in the context consumes attention and tokens, and the cost of the attention is superlinear in the context length. The three standard answers are truncation, summarisation and selection, and they trade differently: truncation is cheap and lossy at the wrong end, summarisation is lossy in a way the model cannot anticipate, and selection (retrieving only the relevant slice) is the only one that preserves the original signal. Chapter 12 develops the retrieval-flavoured version of selection.',
          },
          {
            kind: 'prose',
            markdown:
              'Safety follows from the same design logic. Chapter 11, §11.6 is concerned with what a tool is *allowed* to do, and the standard defences — least privilege, explicit confirmation for irreversible actions, and treating tool output as untrusted data rather than as instructions — are all interface properties. Least privilege is the permission set; confirmation is a property of the call contract; and the instruction/data distinction is a property of how the harness assembles the prompt. Note that the last one is not a nicety: tool output is exactly the channel through which a prompt injection would arrive.',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q8-4',
        prompt:
          'Two tools have descriptions that differ only in wording but perform different operations. What is the most likely failure mode?',
        options: [
          'The model will never call either tool.',
          'The model will choose between them close to arbitrarily, because the descriptions do not provide discriminative features.',
          'The harness will crash on a type error.',
          'The context will overflow.',
        ],
        correct: 1,
        explanation:
          'Tool selection is driven by the description the model reads. Near-identical descriptions leave the choice underdetermined, so the model falls back on surface features that do not correlate with the right tool. Discriminability is a property of the interface (Ch. 11, §11.2–11.3; Ch. 12, §12.5.2).',
        source: { label: 'Ch. 11, §11.2 Tool Use Architectures; §11.3 APIs and Toolchains', chapter: 11, section: '11.2', primary: true },
        difficulty: 'advanced',
      },
      {
        id: 'q8-5',
        prompt: 'Why is "tool output is data, never an instruction" a security requirement rather than a stylistic convention?',
        options: [
          'Because instructions are usually longer than data.',
          'Because the tool result is the channel through which an injected instruction from external content would arrive.',
          'Because models cannot read instructions embedded in tool results.',
          'Because it makes the context smaller.',
        ],
        correct: 1,
        explanation:
          'Tool outputs frequently contain content the model did not author — web pages, files, database rows. Treating those bytes as instructions rather than as data is exactly the prompt-injection surface that Ch. 11, §11.6 and Ch. 17, §17.5 are about. Delimiting and distrusting tool output is a control, not a convention.',
        source: { label: 'Ch. 11, §11.6 Safety and Security', chapter: 11, section: '11.6', primary: true },
        difficulty: 'advanced',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  'search-and-retrieval': {
    sections: [
      {
        id: 'adv-retrieval-mechanics',
        title: 'Advanced: what a retrieval step actually optimises',
        blocks: [
          {
            kind: 'prose',
            markdown:
              'Chapter 12 walks from bag of words through vector space models to latent and sparse representations, and then from a RAG pipeline to agentic RAG. The thread running through it is that each representation is a *choice about which similarity to compute*, and each choice has a failure mode.',
          },
          {
            kind: 'prose',
            markdown:
              'Bag of words with TF-IDF weights compares documents by term overlap. It is exact, interpretable and needs no training, and it fails on paraphrase: a document that answers the question with different vocabulary scores near zero. Dense retrieval embeds queries and documents into a shared vector space and compares by cosine similarity, which handles paraphrase but introduces a subtler failure: the embedding is a *compressed* representation, and compression removes exactly the rare, specific facts that matter most in technical retrieval. Learned sparse retrieval interpolates — it keeps a vocabulary-like interface while letting the model learn which dimensions to weight — and is the usual compromise in practice.',
          },
          {
            kind: 'formula',
            latex:
              '\\mathrm{score}(q, d) = \\cos\\bigl(f(q), f(d)\\bigr) = \\frac{f(q) \\cdot f(d)}{\\lVert f(q) \\rVert \\, \\lVert f(d) \\rVert}',
            caption:
              'Dense retrieval compares embeddings, not words. The normalisation means only direction matters — which is why an embedding can be a good paraphrase matcher and a poor store of rare specifics.',
          },
          {
            kind: 'prose',
            markdown:
              'Now put this in the agentic setting, which is where the textbook\'s own emphasis lies. A RAG pipeline retrieves once, for one query, and then generates. An *agentic* RAG system retrieves repeatedly, with queries the agent writes itself, and it decides *whether* to retrieve at all. That last capability is what the adaptive-retrieval methods in §12.4 add: Self-Ask decomposes a question into sub-questions, Self-RAG trains a model to emit a special token when it wants to retrieve, and query rewriting fixes the case where the user\'s phrasing and the corpus\'s phrasing differ.\n\nThe measurable consequence is that retrieval quality is not a property of the retriever alone. It is a property of the retriever, the query, and the corpus. A retriever evaluated on human-written queries will overestimate how well it performs inside an agent whose queries it wrote itself, because the agent can rewrite. A retriever evaluated on a single query per question will underestimate how much a decomposition helps. Any evaluation of a retrieval component in an agentic system has to state which of these it is measuring.',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q9-4',
        prompt:
          'A dense retriever performs well on paraphrased questions but fails on a question asking for an exact error code that appears verbatim in only one document. Why?',
        options: [
          'Because the embedding is lossy, and rare specific strings are exactly what the compression removes.',
          'Because dense retrievers cannot be indexed.',
          'Because error codes are not natural language.',
          'Because the cosine similarity is undefined for short strings.',
        ],
        correct: 0,
        explanation:
          'Embedding compresses text into a fixed-size vector, and compression is lossy precisely for rare, high-specificity tokens. Dense retrieval buys paraphrase robustness at the cost of exact-match recall, which is why hybrid sparse+dense retrieval is the usual answer (Ch. 12, §12.1.2–12.1.3).',
        source: { label: 'Ch. 12, §12.1.2 Vector Space Models; §12.1.3 Latent and Sparse Representations', chapter: 12, section: '12.1.3', primary: true },
        difficulty: 'advanced',
      },
      {
        id: 'q9-5',
        prompt:
          'Why must a retrieval evaluation state whether queries are human-written or agent-generated?',
        options: [
          'Because agent-generated queries are always longer.',
          'Because an agent can rewrite and decompose its queries, so agent-written queries are easier to retrieve for, and a retriever tuned on human queries will be misjudged in the agentic setting.',
          'Because retrieval is not used by agents.',
          'Because human queries are never in the corpus distribution.',
        ],
        correct: 1,
        explanation:
          'An agent that can rewrite its query can make retrieval easier for itself. Evaluating only on human-written queries therefore misestimates the agentic setting, and evaluating only on agent-written queries misestimates the user-facing setting (Ch. 12, §12.4 Adaptive Retrieval; §12.6 Agentic RAG).',
        source: { label: 'Ch. 12, §12.4 Adaptive Retrieval Methods; §12.6 Agentic RAG', chapter: 12, section: '12.4', primary: true },
        difficulty: 'advanced',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  'behavior-strategy-multi-agent': {
    sections: [
      {
        id: 'adv-social-dilemma-design',
        title: 'Advanced: social dilemmas as test instruments',
        blocks: [
          {
            kind: 'prose',
            markdown:
              'Chapter 15 studies behaviour experimentally: linguistic competence and social etiquette, strategic play in social dilemmas, theory of mind, and moral judgement. The methodological move that makes this a science rather than an anecdote is to use games with *known* equilibrium structure, so that a model\'s choice can be scored against the prediction of a formal model rather than against an opinion.',
          },
          {
            kind: 'prose',
            markdown:
              'The canonical case is the prisoner\'s dilemma and its relatives. A one-shot prisoner\'s dilemma has a single Nash equilibrium: defect–defect. Any model that cooperates is, by the strict definition, playing suboptimally. That is a sharp, checkable prediction, and it is why the dilemma is so widely used: it forces a decision about whether the model is reasoning about the *other agent\'s* incentives (in which case it should defect) or about *reciprocity* (in which case it may cooperate).\n\nThe infinite-horizon repeated game complicates this. With discount factor \\(\\delta\\) and payoff ordering \\(T > R > P > S\\), the grim-trigger strategy sustains cooperation forever and is a subgame-perfect equilibrium, so a model that cooperates in a repeated game is not necessarily making an error. The evaluation therefore has to state the horizon, and Chapter 15, §15.4.2 does exactly that by benchmarking across games rather than reporting a single number.',
          },
          {
            kind: 'formula',
            latex:
              'V_{\\pi}(s) = \\max_{a} \\Bigl[ R(s,a) + \\gamma \\sum_{s\'} P(s\' \\mid s,a) V_{\\pi}(s\') \\Bigr]',
            caption:
              'The Bellman optimality equation. Social dilemmas are often implemented with this structure, which is why an LLM in the role can be compared against a formally-derived policy.',
          },
          {
            kind: 'prose',
            markdown:
              'Two cautions follow from the textbook\'s own framing. First, a behavioural benchmark measures a *system*, not a model: the same weights behind different prompts and different partner models will produce different scores, and Chapter 22, §22.1.2 insists on separating competence from performance. Second, a single game measures a single incentive structure, and Chapter 16, §16.2.1 again argues for benchmarking across games rather than reporting a leaderboard on one.\n\nThe productive framing is the one the textbook uses in Chapter 15, §15.1: probing behaviour is a way of *characterising* a system for design purposes. If you are deploying agents that must negotiate with each other, the question is not "is the model cooperative" but "under which incentive structures does cooperation collapse, and can the harness detect it in time".',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q10-4',
        prompt:
          'A model cooperates in a one-shot prisoner\'s dilemma and in a 20-round repeated game. Which statement is correct?',
        options: [
          'The model is irrational in the one-shot game, because defect–defect is the unique Nash equilibrium.',
          'The one-shot cooperation is arguably suboptimal against a rational opponent, while the repeated-game cooperation can be a subgame-perfect equilibrium, so the horizon must be stated.',
          'Both results indicate the model failed, because LLM agents should always defect.',
          'Repeated games have no Nash equilibria.',
        ],
        correct: 1,
        explanation:
          'In a one-shot dilemma, cooperation is strictly dominated; in a repeated game with grim trigger, cooperation is sustainable as a subgame-perfect equilibrium. Reporting a dilemma score without stating the horizon is therefore uninterpretable (Ch. 15, §15.4.1–15.4.2).',
        source: { label: 'Ch. 15, §15.4.1 Cooperation and Coordination in Social Dilemmas', chapter: 15, section: '15.4.1', primary: true },
        difficulty: 'advanced',
      },
      {
        id: 'q10-5',
        prompt: 'Why does Chapter 22 argue that behavioural results characterise a system rather than a model?',
        options: [
          'Because behaviour is random.',
          'Because the same weights behave differently under different prompts, tool sets and partners, and the harness is part of what is being measured.',
          'Because models cannot be tested repeatedly.',
          'Because benchmarks are usually mis-implemented.',
        ],
        correct: 1,
        explanation:
          'Competence and performance come apart: the same model can behave differently depending on the prompt and harness it is embedded in, so the unit of analysis for behavioural claims must include the system (Ch. 22, §22.1.2–22.1.3; Ch. 15, §15.1).',
        source: { label: 'Ch. 22, §22.1.2–22.1.3 Competence and Performance', chapter: 22, section: '22.1.2', primary: true },
        difficulty: 'advanced',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  'advanced-architectures-and-interpretability': {
    sections: [
      {
        id: 'adv-mech-interp',
        title: 'Advanced: what causal intervention buys you',
        blocks: [
          {
            kind: 'prose',
            markdown:
              'Chapter 21 surveys the interpretability toolkit for agentic models: the residual stream, the logit lens, circuit analysis, activation patching and sparse autoencoders. The organising idea is a distinction between *observational* methods, which record what activations do, and *causal* methods, which intervene and observe what changes.',
          },
          {
            kind: 'prose',
            markdown:
              'Activation patching is the canonical causal method. You run the model on two inputs, take the residual stream activation at layer \\(\\ell\\) from one run, substitute it into the other, and measure the change in the output. The logic is the interventionist\'s logic: if replacing the activation of component \\(x\\) changes the behaviour in the way \\(x\\)\'s hypothesised function predicts, that is evidence for the hypothesis in a way no correlational measurement can provide. If the behaviour does not change, the component was not causally responsible for it — regardless of how strongly it correlated.\n\nThis is the standard that separates a mechanistic claim from a descriptive one, and it is why Chapter 21 devotes §21.7 to activation patching rather than treating correlation as sufficient. The subtlety is that a negative result is informative only if the intervention is faithful: patching must actually replace the activation without changing the computation elsewhere.',
          },
          {
            kind: 'callout',
            tone: 'insight',
            title: 'Why the logit lens is a lens and not a microscope',
            markdown:
              'The logit lens (§21.5) projects an intermediate residual-stream state through the final unembedding matrix, as though decoding stopped at that layer. It is enormously useful and it is *not* the model\'s actual computation at that layer: the model has a final layer norm, and in a tuned-lens refinement (§21.5.2) a trained translator per layer corrects the mismatch. So the logit lens gives you a hypothesis about what a layer is doing, and the tuned lens gives you a better hypothesis. Neither is a readout the model performs. Treat the lens as a probe, and validate surprising readings with causal methods.',
          },
          {
            kind: 'prose',
            markdown:
              'For agentic systems specifically, the payoff of these methods is a sharper kind of diagnosis. When an agent emits a tool call that should not have happened, the interesting question is whether the decision was made in the plan-construction step or in the tool-selection step. Chapter 22, §22.1.1 levels of evidence give the right epistemic posture: behavioural evidence says *that* the agent did it, representational evidence says *what it believed*, mechanistic evidence says *which component was responsible*. Only the third supports a fix, and only the third supports a claim about an architecture.',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q11-4',
        prompt:
          'Why is activation patching a stronger form of evidence than measuring a component\'s correlation with the output?',
        options: [
          'Because it is cheaper to run.',
          'Because it intervenes: if substituting the component\'s activation changes the behaviour as the hypothesis predicts, and does not change it otherwise, that discriminates between hypotheses that correlate equally well.',
          'Because correlation cannot be computed on transformer activations.',
          'Because patching removes the need for a hypothesis.',
        ],
        correct: 1,
        explanation:
          'Patching is an intervention, so it can rule out alternative explanations that predict the same correlation. It also carries its own caveat: a null result is only informative if the intervention is faithful and actually replaced the activation (Ch. 21, §21.7; Ch. 22, §22.1.1).',
        source: { label: 'Ch. 21, §21.7 Activation Patching and Causal Interventions', chapter: 21, section: '21.7', primary: true },
        difficulty: 'advanced',
      },
      {
        id: 'q11-5',
        prompt:
          'What does the tuned lens (§21.5.2) correct, and what does it still not give you?',
        options: [
          'It corrects the mismatch between intermediate residual-stream states and the final unembedding, but it still does not reveal the model\'s actual computation at that layer.',
          'It recovers the model\'s original training data.',
          'It makes the model fully interpretable.',
          'It identifies every circuit in the network.',
        ],
        correct: 0,
        explanation:
          'The tuned lens trains a per-layer translator so that decoding an intermediate state matches what the model would actually produce if it stopped there. It is a better probe, not a readout the model performs, so surprising findings still need causal validation (Ch. 21, §21.5.1–21.5.2).',
        source: { label: 'Ch. 21, §21.5.1–21.5.2 The Logit Lens and the Tuned Lens', chapter: 21, section: '21.5.2', primary: true },
        difficulty: 'advanced',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  'future-directions': {
    sections: [
      {
        id: 'adv-evaluation-discipline',
        title: 'Advanced: evaluating a system you cannot re-run',
        blocks: [
          {
            kind: 'prose',
            markdown:
              'Chapter 23 asks what responsible practice looks like when the system under test is a compound of a model, a harness, tools and an environment. The hard part is that agent behaviour is **stochastic in the environment**: the same agent, re-run, may take a different path, so a single run is not a measurement. Chapter 15, §15.2 makes the same point experimentally, and Chapter 14, §14.4 and Chapter 10, §10.3 show what a disciplined evaluation looks like in practice.',
          },
          {
            kind: 'prose',
            markdown:
              'The methodological consequences are worth stating precisely, because they change what you record. You need **multiple seeds** or repeated runs, so a single success is not mistaken for a capability. You need a **task distribution**, not a task, because an agent tuned on one task has been evaluated on one task. You need to separate **outcome metrics** (did it solve the task?) from **process metrics** (how many steps, how many tool calls, how much did it cost, did it call the right tool), because two agents with identical success rates can have very different operational profiles — and for a deployed assistant the process metrics are often the ones that matter.\n\nAnd you need to record the **harness configuration** alongside the result. A result without the prompt template, the tool set, the step budget and the model version is not reproducible. This is the same requirement the chapter 5 case study imposes on students building models from scratch: the deliverable is not just a working system but a system whose behaviour you can explain.',
          },
          {
            kind: 'prose',
            markdown:
              'The same care applies to the simulations in this course. Every lab here is deterministic, seeded and reproducible, and that is a deliberate design constraint rather than a convenience: a deterministic simulator can be *asserted on*. You can write a test that says "with capacity 4 and relevance weight 0.8, the agent retrieves the decisive memory item", and that test is a real claim about the teaching instrument. A stochastic demo can only be described. The distinction generalises — a deterministic, logged evaluation harness is exactly what the field needs and what a live demo of a stochastic agent cannot provide.',
          },
          {
            kind: 'callout',
            tone: 'source',
            title: 'What the textbook leaves open',
            markdown:
              'Chapter 23, §23.1 is explicit that the technical and societal questions are open, and the concluding parts of the book are deliberately exploratory. Read the advanced chapters (§19–22, marked with an asterisk in the contents) as a map of *research directions*, not as settled results. Several of the claims in them are contested in the wider literature, and the book’s own hedging is part of the content.',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q12-4',
        prompt:
          'An agent succeeds on one run of a task. Why is this not, on its own, evidence that the agent can do the task?',
        options: [
          'Because one run is usually a mistake.',
          'Because agent behaviour is stochastic in the environment, so a single run is not a measurement; you need repeated runs across seeds and a task distribution.',
          'Because success rate is not a valid metric.',
          'Because the model changes between runs.',
        ],
        correct: 1,
        explanation:
          'The same agent can take different paths on re-runs, so a single success cannot be distinguished from luck. Evaluation needs repeated runs, a task distribution, and process metrics recorded alongside outcome metrics (Ch. 15, §15.2; Ch. 14, §14.4; Ch. 10, §10.3).',
        source: { label: 'Ch. 15, §15.2 Probing LLM Behavior Experimentally', chapter: 15, section: '15.2', primary: true },
        difficulty: 'advanced',
      },
      {
        id: 'q12-5',
        prompt:
          'Why is recording the harness configuration (prompt template, tool set, step budget, model version) alongside a result a requirement rather than good hygiene?',
        options: [
          'Because it makes the result look more professional.',
          'Because a result without it is not reproducible, and the harness is part of the system being evaluated.',
          'Because models cannot be versioned.',
          'Because the step budget is the only metric that matters.',
        ],
        correct: 1,
        explanation:
          'The unit of analysis for agentic behaviour is the system, and the harness is a large part of it. Without the configuration, a result cannot be reproduced or attributed, so the claim is not a scientific claim (Ch. 22, §22.1.3; Ch. 5, §5.8).',
        source: { label: 'Ch. 22, §22.1.3 The Unit of Analysis; Ch. 5, §5.8', chapter: 22, section: '22.1.3', primary: true },
        difficulty: 'advanced',
      },
    ],
  },
}
