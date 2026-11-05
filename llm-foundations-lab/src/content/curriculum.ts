/**
 * Course curriculum.
 *
 * Structure verified against the source revision in this workspace:
 *   Foundations of Large Language Models, Tong Xiao and Jingbo Zhu,
 *   arXiv:2501.09223v4 [cs.CL], 8 Oct 2026 (book dated 9 Oct 2026).
 *
 * The book has six chapters — pre-training, generative models, prompting,
 * alignment, inference, reasoning — and this course mirrors them one-to-one.
 * Section numbers and page numbers below come from that v4 PDF and are shown to
 * learners on every lesson so the mapping stays traceable.
 */

export interface SourceRef {
  chapter: number
  /** Section number exactly as printed, e.g. "2.1.1". */
  section: string
  /** Section title as printed. */
  title: string
  /** Printed page number in the v4 PDF. */
  page: number
  /** What this course takes from that section. */
  note: string
}

export type LabKey =
  | 'transformer'
  | 'tokenizer'
  | 'sampling'
  | 'learning'
  | 'alignment'
  | 'inference'
  | 'prompt'

export interface InteractiveRef {
  lab: LabKey
  /** Which view of the lab to open by default. */
  view?: string
  title: string
  description: string
}

export interface LessonMeta {
  id: string
  moduleId: ModuleId
  number: number
  title: string
  subtitle: string
  minutes: number
  objectives: string[]
  keyIdeas: string[]
  interactive: InteractiveRef
  prerequisites: string[]
  glossaryTerms: string[]
  quizIds: string[]
  sourceRefs: SourceRef[]
  furtherReading: { label: string; href: string; note: string }[]
}

export type ModuleId =
  | 'pre-training'
  | 'generative-models'
  | 'prompting'
  | 'alignment'
  | 'inference'
  | 'reasoning'

export interface ModuleMeta {
  id: ModuleId
  chapter: number
  title: string
  tagline: string
  summary: string
  accent: 'indigo' | 'teal' | 'amber'
  /** Printed page range of the chapter in the v4 PDF. */
  pages: string
  outcomes: string[]
  /**
   * Misreadings that readers commonly bring to this chapter, with the
   * correction. Each one is something the book explicitly rules out, so the
   * pair is a claim and its refutation rather than a summary.
   */
  misconceptions: { mistake: string; correction: string }[]
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'pre-training',
    chapter: 1,
    title: 'Pre-training',
    tagline: 'How a model learns language before anyone asks it anything',
    summary:
      'Self-supervised objectives turn raw text into a training signal. This module contrasts the three pre-training families — decoder-only, encoder-only and encoder–decoder — and works through masked language modelling as the canonical encoder objective.',
    accent: 'indigo',
    pages: 'pp. 1–35',
    outcomes: [
      'Explain why self-supervision replaced task-specific labelled data',
      'Compare next-token, masked-token and span-corruption objectives',
      'Read the masked language modelling objective and its loss',
      'Predict what a pre-training objective can and cannot produce',
    ],
    misconceptions: [
      {
        mistake: 'Pre-training teaches the model to follow instructions.',
        correction:
          'Pre-training produces a distribution over text and a set of internal representations. Instruction following, refusal behaviour and question answering are all imposed afterwards, by fine-tuning, preference learning or prompting.',
      },
      {
        mistake: 'A masked language model can generate text, so it is a language model like the decoder.',
        correction:
          'Masked prediction is an encoder objective. At inference there is no mask to fill, so the objective is out of distribution and the model cannot generate left to right.',
      },
      {
        mistake: 'More parameters always make a better model.',
        correction:
          'Past a certain point, parameters without more tokens buy very little. Data and parameters have to grow together, and the compute-optimal point moves as the data grows.',
      },
    ],
  },
  {
    id: 'generative-models',
    chapter: 2,
    title: 'Generative Models',
    tagline: 'The decoder-only Transformer, at scale and in long context',
    summary:
      'The model itself: token embeddings, positional information, query–key–value attention, causal masking and a next-token distribution. Then the practical questions — scaling law trade-offs, training parallelism and the cost of long sequences.',
    accent: 'teal',
    pages: 'pp. 36–94',
    outcomes: [
      'Trace a sentence through a decoder-only Transformer with real numbers',
      'Compute scaled dot-product attention with and without a causal mask',
      'Reason about compute/data/parameter trade-offs in scaling laws',
      'Estimate attention cost and KV-cache memory for long contexts',
    ],
    misconceptions: [
      {
        mistake: 'The causal mask is a filter applied after the softmax.',
        correction:
          'It is added to the scores before the softmax, as minus infinity, so a masked position receives exactly zero weight rather than a small one.',
      },
      {
        mistake: 'Dividing the scores by the square root of the dimension is only numerical tidiness.',
        correction:
          'Without it the dot products are large enough that the softmax is effectively one-hot, the gradients vanish, and the model cannot learn to spread attention.',
      },
      {
        mistake: 'A longer context costs more but changes nothing else.',
        correction:
          'Attention is quadratic in the context length and the cache grows linearly, so ingesting a long prompt is super-linear in its length — and the extra tokens displace the instruction.',
      },
    ],
  },
  {
    id: 'prompting',
    chapter: 3,
    title: 'Prompting',
    tagline: 'Steering a frozen model with text, examples and retrieval',
    summary:
      'Prompting is inference-time programming: instructions, demonstrations, decomposition, self-refinement and retrieval. This module also covers what can be learned rather than written — soft prompts and prompt optimisation.',
    accent: 'amber',
    pages: 'pp. 96–152',
    outcomes: [
      'Design prompts with explicit instructions, context and output contracts',
      'Explain in-context learning without appealing to weight updates',
      'Decompose a task into verifiable sub-problems',
      'Score retrieved documents for retrieval-augmented generation',
    ],
    misconceptions: [
      {
        mistake: 'In-context learning updates the model’s parameters.',
        correction:
          'Nothing changes during inference. The demonstrations are part of the sequence the model conditions on, so they shift the conditional distribution of the next token.',
      },
      {
        mistake: 'Retrieval adds knowledge to the model.',
        correction:
          'Retrieval supplies text in the context window; the generator’s parameters are untouched. The ceiling only rises if the retrieved text actually contains the answer.',
      },
      {
        mistake: 'Chain-of-thought works because the model becomes more careful.',
        correction:
          'It works because the intermediate tokens become part of the conditioning sequence, so the model can condition on its own partial work.',
      },
    ],
  },
  {
    id: 'alignment',
    chapter: 4,
    title: 'Alignment',
    tagline: 'From raw next-token prediction to preferred behaviour',
    summary:
      'Supervised fine-tuning imitates demonstrations; preference-based methods optimise what people actually prefer. This module derives the Bradley–Terry preference model, the RLHF pipeline and the DPO re-parameterisation, and checks each gradient numerically.',
    accent: 'indigo',
    pages: 'pp. 154–201',
    outcomes: [
      'Distinguish instruction alignment from preference alignment',
      'Write the Bradley–Terry preference probability and its loss',
      'Explain RLHF as reward modelling plus policy optimisation',
      'Derive why DPO needs no reward model, and verify it numerically',
    ],
    misconceptions: [
      {
        mistake: 'SFT and DPO are two names for the same objective.',
        correction:
          'SFT maximises the likelihood of the demonstrated response and never sees the rejected one. DPO optimises the preference likelihood through policy and reference log-ratios, and sees both.',
      },
      {
        mistake: 'The reward model measures quality.',
        correction:
          'It estimates a preference from comparisons, and every proxy can be exploited. Optimise it hard enough and the policy finds inputs that score highly without being useful.',
      },
      {
        mistake: 'The KL penalty is there for numerical stability.',
        correction:
          'It keeps the policy near the reference, so the policy stays in the region where the reward model is actually trustworthy.',
      },
    ],
  },
  {
    id: 'inference',
    chapter: 5,
    title: 'Inference',
    tagline: 'Prefill, decode and the arithmetic of serving tokens',
    summary:
      'Serving a language model is two different workloads: a parallel prefill pass and a sequential decode loop. This module covers decoding algorithms, the KV cache, batching and parallelism, and how extra inference-time computation buys accuracy.',
    accent: 'teal',
    pages: 'pp. 203–245',
    outcomes: [
      'Separate prefill from decode and explain why the cache exists',
      'Compute top-k, top-p and temperature transformations by hand',
      'Estimate KV-cache size for a given model shape and context',
      'Reason about latency, throughput and inference-time scaling',
    ],
    misconceptions: [
      {
        mistake: 'The KV cache is a speed optimisation that changes nothing about the output.',
        correction:
          'It is an exact reuse of the keys and values of earlier positions. It changes the cost of the computation, not its result.',
      },
      {
        mistake: 'Prefill and decode are two stages of the same work.',
        correction:
          'Prefill is one parallel pass over the prompt with quadratic attention. Decode is one token at a time against the cache, with linear attention per token.',
      },
      {
        mistake: 'A lower temperature makes the model more accurate.',
        correction:
          'It makes the output more concentrated. The entropy falls and the mode becomes more likely, but nothing about what the model knows has changed.',
      },
    ],
  },
  {
    id: 'reasoning',
    chapter: 6,
    title: 'Reasoning',
    tagline: 'Spending computation to reach answers, not just tokens',
    summary:
      'Reasoning appears when a model writes intermediate steps and when training rewards them. This module treats reasoning as search plus verification, then covers process supervision, scaling training for reasoning and how to evaluate it honestly.',
    accent: 'amber',
    pages: 'pp. 247–278',
    outcomes: [
      'Explain reasoning as search over intermediate steps',
      'Compare best-of-n sampling, beam search and verification',
      'Describe outcome supervision versus process supervision',
      'Recognise the open questions about memorisation and evaluation validity',
    ],
    misconceptions: [
      {
        mistake: 'More reasoning tokens mean the model reasoned more carefully.',
        correction:
          'Token count is a cost, not a measure of quality. A longer trace can be wrong in more places, which is why the cost-adjusted protocol exists.',
      },
      {
        mistake: 'Outcome supervision trains the model to find the right step.',
        correction:
          'It penalises the whole path, so the model is left to guess which step caused the failure. Per-step labels remove that guess.',
      },
      {
        mistake: 'A higher pass@k means the model is better.',
        correction:
          'pass@k measures whether any of k samples is correct, which is a property of the sampling budget as much as of the model.',
      },
    ],
  },
]

export const LESSONS: LessonMeta[] = [
  /* ---------------------------------------------------------------- Module 1 */
  {
    id: 'pretraining-why',
    moduleId: 'pre-training',
    number: 1,
    title: 'Self-supervised pre-training',
    subtitle: 'Why predicting text is enough to learn language',
    minutes: 22,
    objectives: [
      'State the difference between unsupervised, supervised and self-supervised pre-training',
      'Explain why self-supervision scales where human annotation does not',
      'Identify what a pre-training objective optimises, and what it leaves unspecified',
    ],
    keyIdeas: [
      'Pre-training optimises a general objective on unlabelled text before any downstream task is known.',
      'Self-supervision derives labels from the data itself: hide part of the input, predict it back.',
      'The resulting model is adapted later by fine-tuning or prompting.',
    ],
    interactive: {
      lab: 'tokenizer',
      view: 'self-supervision',
      title: 'Build a self-supervised target',
      description:
        'Turn a sentence into a masked or shifted prediction problem and see the exact input/target pairs the objective would train on.',
    },
    prerequisites: [],
    glossaryTerms: ['pre-training', 'self-supervision', 'foundation-model', 'fine-tuning'],
    quizIds: ['q-pretrain-1', 'q-pretrain-2', 'q-pretrain-3', 'q-transfer-pretrain-1'],
    sourceRefs: [
      {
        chapter: 1,
        section: '1.1',
        title: 'Pre-training in NLP',
        page: 1,
        note: 'Definition of pre-training, the unified model o = g(x₀…xₘ; θ), and the two aspects: optimising θ, then adapting ĝ(·) to downstream tasks.',
      },
      {
        chapter: 1,
        section: '1.1.1',
        title: 'Unsupervised, Supervised and Self-supervised Pre-training',
        page: 2,
        note: 'The three pre-training families and the reason self-supervised pre-training became dominant.',
      },
    ],
    furtherReading: [
      {
        label: 'Devlin et al., BERT (2019)',
        href: 'https://arxiv.org/abs/1810.04805',
        note: 'The masked-language-model pre-training paper discussed in the book.',
      },
      {
        label: 'Radford et al., GPT-2 (2019)',
        href: 'https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf',
        note: 'Self-supervised next-token pre-training at scale.',
      },
    ],
  },
  {
    id: 'pretraining-objectives',
    moduleId: 'pre-training',
    number: 2,
    title: 'Three pre-training objectives',
    subtitle: 'Decoder-only, encoder-only and encoder–decoder',
    minutes: 26,
    objectives: [
      'Write the next-token (autoregressive) objective and read its loss',
      'Write the masked-language-modelling objective used by encoder-only models',
      'Explain span corruption in encoder–decoder pre-training',
      'Match a downstream task to the pre-training family that suits it',
    ],
    keyIdeas: [
      'Decoder-only: predict the next token from a causal prefix, so the model can generate.',
      'Encoder-only: reconstruct masked tokens using both sides of the context, so the model represents.',
      'Encoder–decoder: corrupt spans in the input, generate the removed content.',
    ],
    interactive: {
      lab: 'tokenizer',
      view: 'objectives',
      title: 'Compare objectives on one sentence',
      description:
        'Switch between next-token, masked-token and span-corruption targets for the same text and see the loss terms each objective creates.',
    },
    prerequisites: ['pretraining-why'],
    glossaryTerms: ['autoregressive', 'masked-language-model', 'span-corruption', 'language-model'],
    quizIds: ['q-objectives-1', 'q-objectives-2', 'q-objectives-3', 'q-transfer-objectives-1'],
    sourceRefs: [
      {
        chapter: 1,
        section: '1.2.1',
        title: 'Decoder-only Pre-training',
        page: 7,
        note: 'Next-token prediction with a causal prefix and the maximum-likelihood objective.',
      },
      {
        chapter: 1,
        section: '1.2.2',
        title: 'Encoder-only Pre-training',
        page: 8,
        note: 'Masked language modelling, the corruption process and the reconstruction loss.',
      },
      {
        chapter: 1,
        section: '1.2.3',
        title: 'Encoder-Decoder Pre-training',
        page: 14,
        note: 'Span corruption and sequence-to-sequence reconstruction.',
      },
      {
        chapter: 1,
        section: '1.2.4',
        title: 'Comparison of Pre-training Tasks',
        page: 20,
        note: 'Trade-offs between the three families.',
      },
    ],
    furtherReading: [
      {
        label: 'Raffel et al., T5 (2020)',
        href: 'https://arxiv.org/abs/1910.10683',
        note: 'Span-corruption pre-training for encoder–decoder models.',
      },
    ],
  },
  {
    id: 'pretraining-bert',
    moduleId: 'pre-training',
    number: 3,
    title: 'BERT as a worked example',
    subtitle: 'Masked language modelling, then adaptation',
    minutes: 24,
    objectives: [
      'Describe the BERT masking procedure: which tokens are replaced and how',
      'Explain the [CLS] and [SEP] conventions and how a sequence classifier is attached',
      'Explain why masked pre-training cannot generate text the way a decoder does',
      'Adapt a pre-trained encoder to a classification task',
    ],
    keyIdeas: [
      'Random tokens are replaced by [MASK], a random token, or left unchanged; the model predicts the originals.',
      'Because the objective is trained to fill holes, inference at generation time is out of distribution.',
      'A task head is attached to the encoder output and fine-tuned on labelled data.',
    ],
    interactive: {
      lab: 'tokenizer',
      view: 'masking',
      title: 'Mask a sentence and inspect the target',
      description:
        'Apply the BERT masking recipe to a sentence with a fixed seed and see exactly which positions become prediction targets.',
    },
    prerequisites: ['pretraining-objectives'],
    glossaryTerms: ['masked-language-model', 'classification-head', 'fine-tuning'],
    quizIds: ['q-bert-1', 'q-bert-2', 'q-transfer-bert-1'],
    sourceRefs: [
      {
        chapter: 1,
        section: '1.3.1',
        title: 'The Standard Model',
        page: 22,
        note: 'BERT configuration, input representation and the masked language modelling objective.',
      },
      {
        chapter: 1,
        section: '1.4',
        title: 'Applying BERT Models',
        page: 30,
        note: 'Attaching task-specific heads and fine-tuning pre-trained encoders.',
      },
    ],
    furtherReading: [
      {
        label: 'Devlin et al., BERT (2019)',
        href: 'https://arxiv.org/abs/1810.04805',
        note: 'Original masking recipe and the [CLS]/[SEP] conventions.',
      },
    ],
  },

  /* ---------------------------------------------------------------- Module 2 */
  {
    id: 'generative-transformer',
    moduleId: 'generative-models',
    number: 4,
    title: 'The decoder-only Transformer, step by step',
    subtitle: 'Tokens, embeddings, Q/K/V, causal attention, next-token logits',
    minutes: 40,
    objectives: [
      'Trace a sentence through a simplified Transformer forward pass',
      'Compute scaled dot-product attention for a small example',
      'Explain what the causal mask removes and why',
      'Read a next-token probability distribution and describe what it means',
    ],
    keyIdeas: [
      'H = token embedding + positional information; the same H is projected into Q, K and V.',
      'Attention scores are Q Kᵀ / √d, masked so that position i cannot see the future.',
      'Row-wise softmax makes each row a distribution over earlier positions.',
      'Only the final position feeds the output layer when we predict the next token.',
    ],
    interactive: {
      lab: 'transformer',
      title: 'Transformer Explorer',
      description:
        'Edit a sentence and follow every matrix: ids, embeddings, positional information, Q, K, V, raw scores, the causal mask, softmax weights, the attention output and the resulting next-token distribution.',
    },
    prerequisites: [],
    glossaryTerms: [
      'token',
      'token-embedding',
      'positional-encoding',
      'query-key-value',
      'scaled-dot-product-attention',
      'causal-mask',
      'softmax',
      'logits',
    ],
    quizIds: ['q-transformer-1', 'q-transformer-2', 'q-transformer-3', 'q-transformer-4', 'q-transfer-transformer-1'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2.1.1',
        title: 'Decoder-only Transformers',
        page: 38,
        note: 'Eq. 2.4–2.12: pre/post-norm blocks, QKV attention with mask, multi-head merge, output softmax layer.',
      },
      {
        chapter: 5,
        section: '5.1.1',
        title: 'Preliminaries',
        page: 204,
        note: 'Eq. 5.5–5.7: the softmax layer that turns hidden states into a token distribution, and attention computed with a single query at decode time.',
      },
    ],
    furtherReading: [
      {
        label: 'Vaswani et al., Attention Is All You Need (2017)',
        href: 'https://arxiv.org/abs/1706.03762',
        note: 'Scaled dot-product attention and sinusoidal positional encoding.',
      },
    ],
  },
  {
    id: 'generative-scaling',
    moduleId: 'generative-models',
    number: 5,
    title: 'Training at scale',
    subtitle: 'Data, parallelism and scaling laws',
    minutes: 28,
    objectives: [
      'Describe how data is prepared and deduplicated before large-scale pre-training',
      'Explain data, tensor, pipeline and sequence parallelism at a conceptual level',
      'Interpret scaling-law trade-offs between parameters, data and compute',
      'Explain why compute-optimal training allocates tokens proportionally to parameters',
    ],
    keyIdeas: [
      'Loss falls predictably as a power law in parameters, data and compute.',
      'For a fixed compute budget there is an optimal split between model size and token count.',
      'Parallelism strategies trade communication cost against memory per device.',
    ],
    interactive: {
      lab: 'learning',
      view: 'scaling',
      title: 'Scaling-law calculator',
      description:
        'Plug parameters, tokens and compute into power-law estimates and see the marginal value of the next unit of each.',
    },
    prerequisites: ['generative-transformer'],
    glossaryTerms: ['scaling-law', 'chinchilla', 'data-parallelism', 'tensor-parallelism'],
    quizIds: ['q-scaling-1', 'q-scaling-2', 'q-transfer-scaling-1'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2.2',
        title: 'Training at Scale',
        page: 56,
        note: 'Data preparation, model modifications, distributed training and scaling laws.',
      },
      {
        chapter: 2,
        section: '2.2.4',
        title: 'Scaling Laws',
        page: 63,
        note: 'How loss depends on model size, data volume and compute budget.',
      },
    ],
    furtherReading: [
      {
        label: 'Hoffmann et al., Chinchilla (2022)',
        href: 'https://arxiv.org/abs/2203.15556',
        note: 'Compute-optimal model/data trade-off discussed in the book.',
      },
      {
        label: 'Kaplan et al., Scaling Laws (2020)',
        href: 'https://arxiv.org/abs/2001.08361',
        note: 'The earlier power-law fits.',
      },
    ],
  },
  {
    id: 'generative-long-context',
    moduleId: 'generative-models',
    number: 6,
    title: 'Long sequences and the KV cache',
    subtitle: 'Why context is expensive, and how systems pay for it',
    minutes: 30,
    objectives: [
      'Compute the arithmetic cost of attention over a context of length T',
      'Compute KV-cache size from layers, heads, head dimension, context and precision',
      'Explain grouped-query and multi-query attention as memory/quality trade-offs',
      'Describe position interpolation and extrapolation at a conceptual level',
    ],
    keyIdeas: [
      'Attention scores cost O(T²·d) per head per layer; the cache costs O(L·h_kv·d·T).',
      'Caching keys and values turns per-token decode from quadratic recomputation into a linear read.',
      'Sharing key/value heads shrinks the cache at the price of less per-head expressiveness.',
    ],
    interactive: {
      lab: 'inference',
      view: 'kv-cache',
      title: 'KV-cache and attention-cost model',
      description:
        'Change layers, heads, head dimension, precision, context length and batch size to see the cache size and the prefill/decode arithmetic cost react.',
    },
    prerequisites: ['generative-transformer'],
    glossaryTerms: ['kv-cache', 'grouped-query-attention', 'context-window', 'position-extrapolation'],
    quizIds: ['q-longcontext-1', 'q-longcontext-2', 'q-longcontext-3', 'q-transfer-long-context-1'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2.3.3',
        title: 'Cache and Memory',
        page: 71,
        note: 'Fixed-size KV caches, the memory footprint formula and its growth with context.',
      },
      {
        chapter: 2,
        section: '2.3.4',
        title: 'Sharing across Heads and Layers',
        page: 80,
        note: 'Grouped-query attention and cache size O(L·n_g·d_h·m).',
      },
      {
        chapter: 2,
        section: '2.3.5',
        title: 'Position Extrapolation and Interpolation',
        page: 82,
        note: 'Extending usable context beyond the trained length.',
      },
    ],
    furtherReading: [
      {
        label: 'Ainslie et al., GQA (2023)',
        href: 'https://arxiv.org/abs/2305.13245',
        note: 'Grouped-query attention: shared key/value heads.',
      },
      {
        label: 'Shazeer, Multi-Query Attention (2019)',
        href: 'https://arxiv.org/abs/1911.02150',
        note: 'The extreme sharing case.',
      },
    ],
  },

  /* ---------------------------------------------------------------- Module 3 */
  {
    id: 'prompting-design',
    moduleId: 'prompting',
    number: 7,
    title: 'Prompt design and in-context learning',
    subtitle: 'Instructions, demonstrations and output contracts',
    minutes: 26,
    objectives: [
      'Structure a prompt into instruction, context, examples and output contract',
      'Explain in-context learning as conditioning rather than weight updates',
      'Predict how adding demonstrations changes the model distribution',
      'Diagnose prompt failures such as ambiguity and conflicting constraints',
    ],
    keyIdeas: [
      'Prompting changes the conditioning context, not the parameters.',
      'Demonstrations act as a temporary task specification inside the context window.',
      'Every extra token spends budget: prompt design is a resource-allocation problem.',
    ],
    interactive: {
      lab: 'prompt',
      view: 'budget',
      title: 'Prompt budget composer',
      description:
        'Assemble a prompt from labelled parts and watch the token count, the share of the context window and the truncation point.',
    },
    prerequisites: [],
    glossaryTerms: ['prompt', 'in-context-learning', 'zero-shot', 'few-shot', 'context-window'],
    quizIds: ['q-prompting-1', 'q-prompting-2', 'q-prompting-3', 'q-transfer-prompt-design-1'],
    sourceRefs: [
      {
        chapter: 3,
        section: '3.1.1',
        title: 'Basics',
        page: 97,
        note: 'What a prompt is and how the model conditions on it.',
      },
      {
        chapter: 3,
        section: '3.1.2',
        title: 'In-context Learning',
        page: 99,
        note: 'Zero-shot, one-shot and few-shot conditioning.',
      },
      {
        chapter: 3,
        section: '3.1.3',
        title: 'Prompt Engineering Strategies',
        page: 101,
        note: 'Practical prompt-design heuristics.',
      },
    ],
    furtherReading: [
      {
        label: 'Brown et al., GPT-3 (2020)',
        href: 'https://arxiv.org/abs/2005.14165',
        note: 'In-context learning at scale.',
      },
    ],
  },
  {
    id: 'prompting-cot',
    moduleId: 'prompting',
    number: 8,
    title: 'Chain of thought and decomposition',
    subtitle: 'Making intermediate steps explicit',
    minutes: 28,
    objectives: [
      'Explain why writing intermediate steps changes what a single forward pass can compute',
      'Compare chain-of-thought prompting with problem decomposition',
      'Describe self-refinement and when it can hurt',
      'Design a prompt that forces a verifiable intermediate representation',
    ],
    keyIdeas: [
      'A decoder performs a fixed amount of computation per token, so more tokens buy more computation.',
      'Decomposition turns one hard step into several easier, individually verifiable steps.',
      'Self-refinement needs an external signal; otherwise it can entrench the original mistake.',
    ],
    interactive: {
      lab: 'inference',
      view: 'search',
      title: 'Reasoning paths and verification',
      description:
        'Compare greedy, best-of-n and beam search on a small reasoning tree, and see how many verifier calls each strategy spends.',
    },
    prerequisites: ['prompting-design'],
    glossaryTerms: ['chain-of-thought', 'problem-decomposition', 'self-refinement', 'verifier'],
    quizIds: ['q-cot-1', 'q-cot-2', 'q-cot-3', 'q-transfer-cot-1'],
    sourceRefs: [
      {
        chapter: 3,
        section: '3.2.1',
        title: 'Chain of Thought',
        page: 114,
        note: 'Step-by-step prompting and its effect on reasoning tasks.',
      },
      {
        chapter: 3,
        section: '3.2.2',
        title: 'Problem Decomposition',
        page: 117,
        note: 'Splitting a task into sub-problems.',
      },
      {
        chapter: 3,
        section: '3.2.3',
        title: 'Self-refinement',
        page: 123,
        note: 'Iterative revision of a candidate answer.',
      },
      {
        chapter: 3,
        section: '3.2.4',
        title: 'Ensembling',
        page: 129,
        note: 'Combining multiple samples or prompts.',
      },
    ],
    furtherReading: [
      {
        label: 'Wei et al., Chain-of-Thought Prompting (2022)',
        href: 'https://arxiv.org/abs/2201.11903',
        note: 'The chain-of-thought result.',
      },
      {
        label: 'Zhou et al., Least-to-Most Prompting (2022)',
        href: 'https://arxiv.org/abs/2205.10625',
        note: 'Decomposition-based prompting.',
      },
    ],
  },
  {
    id: 'prompting-rag',
    moduleId: 'prompting',
    number: 9,
    title: 'Retrieval, tools and learned prompts',
    subtitle: 'Giving the model facts and letting it call out',
    minutes: 30,
    objectives: [
      'Describe retrieval-augmented generation as a prompt-assembly pipeline',
      'Score documents by cosine similarity in an explicit vector space',
      'Explain tool use as a structured action the model can emit',
      'Distinguish discrete prompt design from soft-prompt optimisation',
    ],
    keyIdeas: [
      'Retrieval converts an open-book question into a closed-book one at run time.',
      'Similarity search is arithmetic on vectors; the quality of the vectors decides the quality of the retrieval.',
      'Soft prompts optimise continuous inputs; they are learned parameters, not text.',
    ],
    interactive: {
      lab: 'prompt',
      view: 'retrieval',
      title: 'Toy retrieval scorer',
      description:
        'Query a small toy document set with keyword-feature vectors and see genuine cosine similarities decide which passages enter the prompt.',
    },
    prerequisites: ['prompting-design'],
    glossaryTerms: ['retrieval-augmented-generation', 'cosine-similarity', 'tool-use', 'soft-prompt'],
    quizIds: ['q-rag-1', 'q-rag-2', 'q-rag-3', 'q-transfer-rag-1'],
    sourceRefs: [
      {
        chapter: 3,
        section: '3.2.5',
        title: 'RAG and Tool Use',
        page: 133,
        note: 'Retrieval-augmented generation and calling external tools.',
      },
      {
        chapter: 3,
        section: '3.3.1',
        title: 'Prompt Optimization',
        page: 138,
        note: 'Searching over discrete prompts.',
      },
      {
        chapter: 3,
        section: '3.3.2',
        title: 'Soft Prompts',
        page: 141,
        note: 'Continuous, learned prompt representations.',
      },
      {
        chapter: 3,
        section: '3.3.3',
        title: 'Prompt Length Reduction',
        page: 151,
        note: 'Compressing prompts to save context.',
      },
    ],
    furtherReading: [
      {
        label: 'Lewis et al., RAG (2020)',
        href: 'https://arxiv.org/abs/2005.11401',
        note: 'Retrieval-augmented generation.',
      },
      {
        label: 'Li & Liang, Prefix-Tuning (2021)',
        href: 'https://arxiv.org/abs/2101.00190',
        note: 'Soft prompts as learned continuous prefixes.',
      },
    ],
  },

  /* ---------------------------------------------------------------- Module 4 */
  {
    id: 'alignment-sft',
    moduleId: 'alignment',
    number: 10,
    title: 'Instruction alignment with SFT',
    subtitle: 'Learning from demonstrations',
    minutes: 26,
    objectives: [
      'Write the supervised fine-tuning loss on response tokens',
      'Explain why instruction data is constructed rather than collected naturally',
      'Describe data-quality filters and diversity requirements',
      'Recognise the limit of imitation: it copies the demonstration distribution',
    ],
    keyIdeas: [
      'SFT maximises the likelihood of the demonstrated response, token by token.',
      'Only the response tokens are usually trained on; the instruction is context.',
      'Imitation cannot prefer an answer that never appears in the data.',
    ],
    interactive: {
      lab: 'alignment',
      view: 'sft',
      title: 'Fit a demonstration',
      description:
        'Watch a toy policy learn the demonstrated response and see how the probability of the unseen alternatives is pushed down.',
    },
    prerequisites: ['pretraining-bert'],
    glossaryTerms: ['supervised-fine-tuning', 'instruction-tuning', 'cross-entropy-loss'],
    quizIds: ['q-sft-1', 'q-sft-2', 'q-sft-3', 'q-transfer-sft-1'],
    sourceRefs: [
      {
        chapter: 4,
        section: '4.1',
        title: 'Overview of LLM Alignment',
        page: 154,
        note: 'What alignment means and the stages of the pipeline.',
      },
      {
        chapter: 4,
        section: '4.2.1',
        title: 'Supervised Fine-tuning',
        page: 156,
        note: 'The SFT objective and how it is applied to instruction data.',
      },
      {
        chapter: 4,
        section: '4.2.2',
        title: 'Fine-tuning Data Construction',
        page: 161,
        note: 'How instruction datasets are built and filtered.',
      },
    ],
    furtherReading: [
      {
        label: 'Ouyang et al., InstructGPT (2022)',
        href: 'https://arxiv.org/abs/2203.02155',
        note: 'The SFT→RM→RLHF pipeline.',
      },
    ],
  },
  {
    id: 'alignment-rlhf',
    moduleId: 'alignment',
    number: 11,
    title: 'RLHF: reward models and policy training',
    subtitle: 'Learning from comparisons instead of demonstrations',
    minutes: 34,
    objectives: [
      'Write the Bradley–Terry preference probability for a pair of responses',
      'Explain how a reward model is trained on comparisons',
      'Describe the RLHF objective: expected reward minus a KL penalty',
      'Explain why the KL penalty is necessary and what it protects',
    ],
    keyIdeas: [
      'A comparison tells you which answer is better, not how much better.',
      'Bradley–Terry turns pairwise preferences into a scalar reward difference through a sigmoid.',
      'Reward maximisation alone drifts from language; the KL term keeps the policy near the reference.',
    ],
    interactive: {
      lab: 'alignment',
      view: 'reward',
      title: 'Train a reward model',
      description:
        'Fit a linear reward model on the preference pairs and inspect the scores it assigns to preferred and rejected responses.',
    },
    prerequisites: ['alignment-sft'],
    glossaryTerms: ['rlhf', 'reward-model', 'bradley-terry', 'kl-divergence', 'ppo'],
    quizIds: ['q-rlhf-1', 'q-rlhf-2', 'q-rlhf-3', 'q-rlhf-4', 'q-transfer-rlhf-1'],
    sourceRefs: [
      {
        chapter: 4,
        section: '4.3.1',
        title: 'Basics of Reinforcement Learning',
        page: 173,
        note: 'Policies, rewards, and the vocabulary RLHF borrows.',
      },
      {
        chapter: 4,
        section: '4.3.2',
        title: 'Training Reward Models',
        page: 179,
        note: 'Eq. 4.36-form preference likelihood and reward-model training.',
      },
      {
        chapter: 4,
        section: '4.3.3',
        title: 'Training LLMs',
        page: 182,
        note: 'Policy optimisation with a KL penalty term.',
      },
    ],
    furtherReading: [
      {
        label: 'Christiano et al., Deep RL from Human Preferences (2017)',
        href: 'https://arxiv.org/abs/1706.03741',
        note: 'Preference-based reward learning.',
      },
    ],
  },
  {
    id: 'alignment-dpo',
    moduleId: 'alignment',
    number: 12,
    title: 'Direct preference optimisation',
    subtitle: 'Preference learning without a reward model',
    minutes: 34,
    objectives: [
      'Reproduce the steps that turn a KL-regularised reward objective into a policy ratio',
      'Write the DPO preference probability using policy and reference log-ratios',
      'Explain why the partition function cancels inside a preference pair',
      'Compare DPO with RLHF in compute, data reuse and failure modes',
    ],
    keyIdeas: [
      'The optimal policy under a KL penalty has a closed form in terms of reward and reference.',
      'Inverting that relation expresses the reward as a log-ratio of policies.',
      'Substituting into Bradley–Terry gives a loss that depends only on the policy.',
    ],
    interactive: {
      lab: 'alignment',
      view: 'dpo',
      title: 'DPO on a preference pair',
      description:
        'Trace d = β[(w − w_ref)·Δφ], the sigmoid preference probability and the softplus loss as the policy moves.',
    },
    prerequisites: ['alignment-rlhf'],
    glossaryTerms: ['dpo', 'reference-model', 'log-ratio', 'bradley-terry'],
    quizIds: ['q-dpo-1', 'q-dpo-2', 'q-dpo-3', 'q-transfer-dpo-1'],
    sourceRefs: [
      {
        chapter: 4,
        section: '4.4.2',
        title: 'Direct Preference Optimization',
        page: 193,
        note: 'Eq. 4.73–4.82: the KL-regularised objective, the closed-form policy, the log-ratio reward, Eq. 4.81 preference probability and Eq. 4.82 DPO loss.',
      },
      {
        chapter: 4,
        section: '4.4.1',
        title: 'Better Reward Modeling',
        page: 187,
        note: 'Weaknesses of explicit reward models that motivate DPO.',
      },
    ],
    furtherReading: [
      {
        label: 'Rafailov et al., DPO (2023/2024)',
        href: 'https://arxiv.org/abs/2305.18290',
        note: 'The original derivation.',
      },
    ],
  },

  /* ---------------------------------------------------------------- Module 5 */
  {
    id: 'inference-prefill-decode',
    moduleId: 'inference',
    number: 13,
    title: 'Prefill, decode and the KV cache',
    subtitle: 'Two workloads, one model',
    minutes: 28,
    objectives: [
      'Distinguish the prefill phase from the decode phase',
      'Explain what the KV cache stores and how it changes the cost of each new token',
      'Compute cache memory for a given model shape and context length',
      'Describe prefix caching and continuous batching at a conceptual level',
      'Compute the acceptance probability of a speculative-decoding draft and the expected tokens per verification pass',
    ],
    keyIdeas: [
      'Prefill processes the whole prompt in parallel and fills the cache.',
      'Decode generates one token at a time, reading the cache instead of recomputing it.',
      'Serving throughput is dominated by memory bandwidth and batch scheduling, not only arithmetic.',
      'Speculative decoding verifies a cheap draft in one parallel pass; the output distribution is exactly the target’s.',
    ],
    interactive: {
      lab: 'inference',
      view: 'decode',
      title: 'Autoregressive decoder',
      description:
        'Step a toy transition model forward one token at a time and inspect the context, the chosen token and the local entropy at each step.',
    },
    prerequisites: ['generative-long-context'],
    glossaryTerms: ['prefill', 'decode', 'kv-cache', 'prefix-caching', 'continuous-batching'],
    quizIds: ['q-inference-1', 'q-inference-2', 'q-inference-3', 'q-transfer-prefill-1'],
    sourceRefs: [
      {
        chapter: 5,
        section: '5.1.2',
        title: 'A Two-phase Framework',
        page: 207,
        note: 'Prefilling and decoding as separate phases, with the cache shared between them.',
      },
      {
        chapter: 5,
        section: '5.2.1',
        title: 'Prefix Caching',
        page: 223,
        note: 'Reusing cached prefixes across requests.',
      },
      {
        chapter: 5,
        section: '5.2.2',
        title: 'Batching',
        page: 223,
        note: 'Batch scheduling and its effect on utilisation.',
      },
    ],
    furtherReading: [
      {
        label: 'Pope et al., Efficiently Scaling Transformer Inference (2022)',
        href: 'https://arxiv.org/abs/2211.05102',
        note: 'Analytical treatment of the prefill/decode trade-off.',
      },
      {
        label: 'Kwon et al., PagedAttention / vLLM (2023)',
        href: 'https://arxiv.org/abs/2309.06180',
        note: 'Memory management for KV caches.',
      },
    ],
  },
  {
    id: 'inference-decoding',
    moduleId: 'inference',
    number: 14,
    title: 'Decoding algorithms',
    subtitle: 'Greedy, beam, top-k, top-p and temperature',
    minutes: 30,
    objectives: [
      'Compute temperature-scaled softmax probabilities by hand',
      'Apply top-k and top-p filtering and renormalise the surviving mass',
      'Explain the diversity/coherence trade-off in each method',
      'Predict how a seed and the sampling parameters interact',
    ],
    keyIdeas: [
      'Decoding is a policy on top of the model distribution; it never changes the model.',
      'Top-k fixes the candidate count, top-p fixes the candidate mass.',
      'Temperature rescales logits before filtering, so the two interact.',
    ],
    interactive: {
      lab: 'sampling',
      title: 'Sampling laboratory',
      description:
        'Move temperature, top-k, top-p and the seed and watch the actual softmax probabilities, the surviving candidates and the sampled tokens change.',
    },
    prerequisites: ['generative-transformer'],
    glossaryTerms: ['temperature', 'top-k', 'top-p', 'greedy-decoding', 'beam-search'],
    quizIds: ['q-decoding-1', 'q-decoding-2', 'q-decoding-3', 'q-decoding-4', 'q-transfer-decoding-1'],
    sourceRefs: [
      {
        chapter: 5,
        section: '5.1.3',
        title: 'Decoding Algorithms',
        page: 211,
        note: 'Eq. 5.23–5.29: top-k pool, renormalisation, sampling, top-p nucleus construction and temperature scaling.',
      },
    ],
    furtherReading: [
      {
        label: 'Holtzman et al., Nucleus Sampling (2020)',
        href: 'https://arxiv.org/abs/1904.09751',
        note: 'Top-p sampling.',
      },
      {
        label: 'Fan et al., Top-k Sampling (2018)',
        href: 'https://arxiv.org/abs/1805.04833',
        note: 'Top-k sampling.',
      },
    ],
  },
  {
    id: 'inference-scaling',
    moduleId: 'inference',
    number: 15,
    title: 'Efficient inference and inference-time scaling',
    subtitle: 'Serving costs and spending compute to think',
    minutes: 28,
    objectives: [
      'Relate context length, batch size and precision to memory pressure',
      'Explain output ensembling and search scaling as ways to spend inference compute',
      'Distinguish measured latency from an analytical cost model',
      'Choose a decoding configuration for a given accuracy/latency target',
    ],
    keyIdeas: [
      'Inference-time scaling trades tokens and calls for accuracy.',
      'Search and ensembling need a scoring or verification signal to be useful.',
      'A cost model explains the trade-off; only measurement proves a speed-up.',
    ],
    interactive: {
      lab: 'inference',
      view: 'search',
      title: 'Search, verification and cost',
      description:
        'Compare greedy, best-of-n and beam search accuracy against the number of verifier calls and generated tokens.',
    },
    prerequisites: ['inference-decoding'],
    glossaryTerms: ['inference-time-scaling', 'beam-search', 'verifier', 'throughput'],
    quizIds: ['q-infer-scaling-1', 'q-infer-scaling-2', 'q-transfer-inference-scaling-1'],
    sourceRefs: [
      {
        chapter: 5,
        section: '5.3',
        title: 'Inference-time Scaling',
        page: 234,
        note: 'Context scaling, search scaling, output ensembling and thinking-path generation.',
      },
      {
        chapter: 5,
        section: '5.2.3',
        title: 'Parallelization',
        page: 232,
        note: 'Parallelism strategies for inference.',
      },
    ],
    furtherReading: [
      {
        label: 'Wei et al., Inference-Time Scaling (2022)',
        href: 'https://arxiv.org/abs/2206.07682',
        note: 'Compute used at inference time to improve reasoning.',
      },
      {
        label: 'Snell et al., Scaling Test-Time Compute (2024)',
        href: 'https://arxiv.org/abs/2408.03314',
        note: 'Comparing test-time strategies under a budget.',
      },
    ],
  },

  /* ---------------------------------------------------------------- Module 6 */
  {
    id: 'reasoning-compute',
    moduleId: 'reasoning',
    number: 16,
    title: 'Reasoning as searched computation',
    subtitle: 'Prompting, sampling paths and verification',
    minutes: 30,
    objectives: [
      'Define reasoning operationally as producing intermediate steps that can be checked',
      'Compare independent sampling with search over a step tree',
      'Explain the role of a verifier and what happens when it is unreliable',
      'Estimate the accuracy/cost frontier of a reasoning strategy',
    ],
    keyIdeas: [
      'More generated tokens mean more sequential computation, which is why chains help.',
      'Generating several paths and selecting with a verifier is search with a learned heuristic.',
      'Without verification, extra samples only amplify the model prior.',
    ],
    interactive: {
      lab: 'inference',
      view: 'search',
      title: 'Search a reasoning tree',
      description:
        'Run greedy, best-of-n and beam search over an explicit step tree with verifier scores, and compare correctness against verifier calls.',
    },
    prerequisites: ['prompting-cot'],
    glossaryTerms: ['reasoning', 'test-time-compute', 'verifier', 'search-strategy', 'prm'],
    quizIds: ['q-reasoning-1', 'q-reasoning-2', 'q-reasoning-3', 'q-transfer-reasoning-compute-1'],
    sourceRefs: [
      {
        chapter: 6,
        section: '6.1.3',
        title: 'From LLMs to Reasoning Models',
        page: 249,
        note: 'What distinguishes a reasoning model from a plain LLM.',
      },
      {
        chapter: 6,
        section: '6.3.2',
        title: 'Sampling Multiple Reasoning Paths',
        page: 253,
        note: 'Sampling several candidate solutions.',
      },
      {
        chapter: 6,
        section: '6.3.3',
        title: 'Search Strategies for Reasoning',
        page: 256,
        note: 'Search over partial reasoning traces.',
      },
      {
        chapter: 6,
        section: '6.3.4',
        title: 'Verification',
        page: 257,
        note: 'Scoring and selecting candidate solutions.',
      },
    ],
    furtherReading: [
      {
        label: 'Lightman et al., Let’s Verify Step by Step (2023)',
        href: 'https://arxiv.org/abs/2305.20050',
        note: 'Process supervision and verification.',
      },
      {
        label: 'Yao et al., Tree of Thoughts (2023)',
        href: 'https://arxiv.org/abs/2305.10601',
        note: 'Search over reasoning steps.',
      },
    ],
  },
  {
    id: 'reasoning-training',
    moduleId: 'reasoning',
    number: 17,
    title: 'Learning to reason',
    subtitle: 'Supervised traces, process supervision and RL',
    minutes: 30,
    objectives: [
      'Describe how reasoning traces are collected and filtered',
      'Contrast outcome supervision with process supervision',
      'Explain the credit-assignment problem for intermediate steps',
      'Motivate on-policy distillation and scaling training for reasoning',
    ],
    keyIdeas: [
      'Outcome rewards tell you the final answer was right, not which step earned it.',
      'Process supervision provides a reward at every step, at the cost of annotation and reward hacking risk.',
      'On-policy distillation learns from correct traces the model itself can produce.',
    ],
    interactive: {
      lab: 'alignment',
      view: 'process',
      title: 'Outcome vs. step rewards',
      description:
        'Train a toy step scorer on outcome-only and process labels and compare the credit it assigns to each step.',
    },
    prerequisites: ['reasoning-compute', 'alignment-rlhf'],
    glossaryTerms: ['process-supervision', 'prm', 'credit-assignment', 'on-policy-distillation', 'rlvr'],
    quizIds: ['q-learn-reason-1', 'q-learn-reason-2', 'q-transfer-reasoning-training-1'],
    sourceRefs: [
      {
        chapter: 6,
        section: '6.4.1',
        title: 'Supervised Reasoning Data',
        page: 262,
        note: 'Building supervised data for reasoning.',
      },
      {
        chapter: 6,
        section: '6.4.2',
        title: 'Process Supervision',
        page: 263,
        note: 'Rewarding intermediate steps rather than outcomes.',
      },
      {
        chapter: 6,
        section: '6.4.3',
        title: 'On-Policy Distillation for Reasoning',
        page: 267,
        note: 'Distilling reasoning from the model’s own correct traces.',
      },
      {
        chapter: 6,
        section: '6.4.4',
        title: 'Scaling Training for Reasoning',
        page: 268,
        note: 'Scale and data considerations in reasoning training.',
      },
    ],
    furtherReading: [
      {
        label: 'Uesato et al., Process- vs Outcome-based Feedback (2022)',
        href: 'https://arxiv.org/abs/2211.14275',
        note: 'Comparing the two supervision regimes.',
      },
    ],
  },
  {
    id: 'reasoning-evaluation',
    moduleId: 'reasoning',
    number: 18,
    title: 'Evaluating reasoning, honestly',
    subtitle: 'Metrics, benchmarks and open questions',
    minutes: 24,
    objectives: [
      'Choose an evaluation protocol that matches the claimed capability',
      'Contrast outcome-based and process-based evaluation',
      'Explain contamination and the difference between memorisation and reasoning',
      'List the open questions the source itself leaves unresolved',
    ],
    keyIdeas: [
      'A metric measures a task setup, not an abstract capability.',
      'Held-out, contamination-checked evaluation is a design constraint, not an afterthought.',
      'Whether models genuinely reason remains contested; the honest answer is that the evidence is mixed.',
    ],
    interactive: {
      lab: 'inference',
      view: 'evaluation',
      title: 'Protocol comparison',
      description:
        'Score the same synthetic results under outcome-only, process-aware and cost-adjusted protocols and see how the conclusion changes.',
    },
    prerequisites: ['reasoning-training'],
    glossaryTerms: ['benchmark', 'contamination', 'pass-at-k', 'outcome-evaluation'],
    quizIds: ['q-eval-1', 'q-eval-2', 'q-transfer-reasoning-evaluation-1'],
    sourceRefs: [
      {
        chapter: 6,
        section: '6.5.1',
        title: 'Outcome-based vs. Process-based Evaluation',
        page: 271,
        note: 'What each evaluation regime can and cannot show.',
      },
      {
        chapter: 6,
        section: '6.5.2',
        title: 'Evaluation Metrics',
        page: 272,
        note: 'Metrics used to report reasoning performance.',
      },
      {
        chapter: 6,
        section: '6.6.1',
        title: 'External Reasoning vs. Internal Reasoning',
        page: 274,
        note: 'Interpretation of what reasoning traces mean.',
      },
      {
        chapter: 6,
        section: '6.6.3',
        title: 'Can LLMs Truly Reason?',
        page: 277,
        note: 'Open questions the book leaves open.',
      },
    ],
    furtherReading: [
      {
        label: 'Srivastava et al., BIG-bench (2022)',
        href: 'https://arxiv.org/abs/2206.04615',
        note: 'Benchmark design and contamination concerns.',
      },
    ],
  },
]

export function lessonsForModule(moduleId: ModuleId): LessonMeta[] {
  return LESSONS.filter((lesson) => lesson.moduleId === moduleId).sort((a, b) => a.number - b.number)
}

export function getLesson(id: string): LessonMeta | undefined {
  return LESSONS.find((lesson) => lesson.id === id)
}

export function getModule(id: string): ModuleMeta | undefined {
  return MODULES.find((module) => module.id === id)
}

export function lessonNeighbours(id: string): { previous?: LessonMeta; next?: LessonMeta } {
  const index = LESSONS.findIndex((lesson) => lesson.id === id)
  if (index < 0) return {}
  return {
    previous: index > 0 ? LESSONS[index - 1] : undefined,
    next: index < LESSONS.length - 1 ? LESSONS[index + 1] : undefined,
  }
}

/** Lessons that must be completed before this one, transitively. */
export function prerequisiteChain(id: string): LessonMeta[] {
  const seen = new Set<string>()
  const chain: LessonMeta[] = []
  const walk = (lessonId: string) => {
    const lesson = getLesson(lessonId)
    if (!lesson) return
    for (const prerequisite of lesson.prerequisites) {
      if (seen.has(prerequisite)) continue
      seen.add(prerequisite)
      walk(prerequisite)
      const meta = getLesson(prerequisite)
      if (meta) chain.push(meta)
    }
  }
  walk(id)
  return chain
}
