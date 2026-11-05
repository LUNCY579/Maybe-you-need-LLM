/**
 * Glossary and mathematical reference.
 *
 * Definitions are written for this course and cross-referenced to the source
 * revision (arXiv:2501.09223v4) rather than copied from it.
 */
import type { ModuleId } from './curriculum'

export interface GlossaryEntry {
  id: string
  term: string
  short: string
  definition: string
  /** Terms a reader should understand first. */
  prerequisites: string[]
  moduleId: ModuleId
  section: string
  page: number
  /** Lesson that explains it in depth. */
  lessonId: string
  /** Optional formula shown with the entry. */
  tex?: string
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'pre-training',
    term: 'Pre-training',
    short: 'Training a general model before any task is specified',
    definition:
      'Optimising a model on a broad objective over large unlabelled corpora so that its parameters transfer to many downstream tasks. In the book’s unified notation the model o = g(x₀…xₘ; θ) is first fitted on the general objective, then adapted.',
    prerequisites: [],
    moduleId: 'pre-training',
    section: '1.1',
    page: 1,
    lessonId: 'pretraining-why',
  },
  {
    id: 'self-supervision',
    term: 'Self-supervision',
    short: 'Supervision constructed from the data itself',
    definition:
      'Building training targets by hiding or shifting parts of the input, so that no human annotation is needed. Masked-token prediction and next-token prediction are the two canonical instances.',
    prerequisites: ['pre-training'],
    moduleId: 'pre-training',
    section: '1.1.1',
    page: 2,
    lessonId: 'pretraining-why',
  },
  {
    id: 'foundation-model',
    term: 'Foundation model',
    short: 'A pre-trained model adapted to many tasks',
    definition:
      'A large pre-trained model that serves as a starting point for fine-tuning or prompting across many tasks, rather than being built for one task.',
    prerequisites: ['pre-training'],
    moduleId: 'pre-training',
    section: '1.1',
    page: 1,
    lessonId: 'pretraining-why',
  },
  {
    id: 'fine-tuning',
    term: 'Fine-tuning',
    short: 'Continuing training on task or instruction data',
    definition:
      'Updating the parameters of a pre-trained model on a smaller, targeted dataset (labelled examples or instructions) so that it specialises.',
    prerequisites: ['pre-training'],
    moduleId: 'pre-training',
    section: '1.1.2',
    page: 3,
    lessonId: 'alignment-sft',
  },
  {
    id: 'autoregressive',
    term: 'Autoregressive',
    short: 'Each token conditioned on the ones before it',
    definition:
      'A factorisation of a sequence distribution into per-token conditionals: Pr(x) = ∏ᵢ Pr(xᵢ | x₀…xᵢ₋₁). This is the objective of decoder-only language models and the loop followed at generation time.',
    prerequisites: ['language-model'],
    moduleId: 'pre-training',
    section: '1.2.1',
    page: 7,
    lessonId: 'pretraining-objectives',
    tex: '\\Pr(x) = \\prod_{i} \\Pr(x_i \\mid x_0 \\dots x_{i-1})',
  },
  {
    id: 'language-model',
    term: 'Language model',
    short: 'A distribution over token sequences',
    definition:
      'A model that assigns probabilities to sequences of tokens, or equivalently predicts the distribution of the next token given a context.',
    prerequisites: [],
    moduleId: 'pre-training',
    section: '1.1',
    page: 1,
    lessonId: 'pretraining-objectives',
  },
  {
    id: 'masked-language-model',
    term: 'Masked language model',
    short: 'Predict hidden tokens from both sides',
    definition:
      'An encoder-only pre-training objective: replace a fraction of tokens with [MASK] (or a random token, or nothing), then predict the originals using the full surrounding context. Because inference at generation time never sees [MASK], the objective suits representation learning rather than open-ended generation.',
    prerequisites: ['self-supervision'],
    moduleId: 'pre-training',
    section: '1.2.2',
    page: 8,
    lessonId: 'pretraining-bert',
    tex: '\\mathcal{L}_{\\text{MLM}} = -\\sum_{i \\in \\mathcal{M}} \\log \\Pr(x_i \\mid x_{\\setminus \\mathcal{M}})',
  },
  {
    id: 'span-corruption',
    term: 'Span corruption',
    short: 'Delete spans; ask the decoder to restore them',
    definition:
      'An encoder–decoder pre-training objective that removes contiguous spans from the input and trains the decoder to regenerate them, producing a sequence-to-sequence reconstruction task.',
    prerequisites: ['masked-language-model'],
    moduleId: 'pre-training',
    section: '1.2.3',
    page: 14,
    lessonId: 'pretraining-objectives',
  },
  {
    id: 'classification-head',
    term: 'Classification head',
    short: 'A small output layer added for a task',
    definition:
      'A task-specific layer attached to a pre-trained encoder (often a softmax over pooled or [CLS] representations) and trained on labelled data.',
    prerequisites: ['fine-tuning'],
    moduleId: 'pre-training',
    section: '1.4',
    page: 30,
    lessonId: 'pretraining-bert',
  },

  {
    id: 'token',
    term: 'Token',
    short: 'The unit a model reads and predicts',
    definition:
      'The atomic unit of text in a model’s vocabulary. Tokens may be whole words, subword pieces, characters or bytes; every sequence the model processes is a sequence of token ids.',
    prerequisites: [],
    moduleId: 'generative-models',
    section: '2.1.1',
    page: 38,
    lessonId: 'generative-transformer',
  },
  {
    id: 'token-embedding',
    term: 'Token embedding',
    short: 'A learned vector for a token id',
    definition:
      'A lookup table mapping each vocabulary item to a dense vector of dimension d. In this course the table is a deterministic toy table so that learners can inspect the numbers.',
    prerequisites: ['token'],
    moduleId: 'generative-models',
    section: '2.1.1',
    page: 38,
    lessonId: 'generative-transformer',
  },
  {
    id: 'positional-encoding',
    term: 'Positional encoding',
    short: 'Information about where a token sits',
    definition:
      'A vector added to the token embedding so the model can use order, since attention itself is permutation-invariant. Sinusoidal encodings use sin/cos at geometrically spaced frequencies; learned and rotary variants also exist.',
    prerequisites: ['token-embedding'],
    moduleId: 'generative-models',
    section: '2.1.1',
    page: 38,
    lessonId: 'generative-transformer',
    tex: 'PE_{(pos, 2i)} = \\sin\\!\\left(\\frac{pos}{10000^{2i/d}}\\right)',
  },
  {
    id: 'query-key-value',
    term: 'Query, key, value (Q, K, V)',
    short: 'Three projections of the hidden states',
    definition:
      'Q, K and V are linear projections of the same hidden matrix H: Q = H W_q, K = H W_k, V = H W_v. Queries are compared with keys to produce attention weights, which are then applied to values.',
    prerequisites: ['token-embedding'],
    moduleId: 'generative-models',
    section: '2.1.1',
    page: 38,
    lessonId: 'generative-transformer',
  },
  {
    id: 'scaled-dot-product-attention',
    term: 'Scaled dot-product attention',
    short: 'Softmax(QKᵀ/√d)·V',
    definition:
      'The core attention operation. The 1/√d scaling keeps logits in a range where the softmax has usable gradients as the head dimension grows.',
    prerequisites: ['query-key-value', 'softmax'],
    moduleId: 'generative-models',
    section: '2.1.1',
    page: 38,
    lessonId: 'generative-transformer',
    tex: '\\operatorname{Att}_{qkv}(Q,K,V) = \\operatorname{Softmax}\\!\\left(\\frac{QK^{\\top}}{\\sqrt{d}} + M\\right) V',
  },
  {
    id: 'causal-mask',
    term: 'Causal mask',
    short: 'Block attention to future positions',
    definition:
      'An additive matrix M with M(i,k) = 0 for i ≥ k and M(i,k) = −∞ otherwise, added to the scaled scores before the softmax. It makes the model autoregressive: position i can only see positions 0…i.',
    prerequisites: ['scaled-dot-product-attention'],
    moduleId: 'generative-models',
    section: '2.1.1',
    page: 38,
    lessonId: 'generative-transformer',
  },
  {
    id: 'softmax',
    term: 'Softmax',
    short: 'Turn scores into a probability distribution',
    definition:
      'A normalising function that exponentiates scores and divides by their sum. Implementations subtract the maximum for numerical stability; the result is unchanged.',
    prerequisites: [],
    moduleId: 'generative-models',
    section: '2.1.1',
    page: 38,
    lessonId: 'generative-transformer',
    tex: '\\operatorname{Softmax}(z)_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}',
  },
  {
    id: 'logits',
    term: 'Logits',
    short: 'Unnormalised scores before softmax',
    definition:
      'The raw real-valued outputs of the final projection. Their softmax is the model’s token distribution; decoding algorithms operate on logits before or after this normalisation.',
    prerequisites: ['softmax'],
    moduleId: 'generative-models',
    section: '2.1.1',
    page: 38,
    lessonId: 'generative-transformer',
  },
  {
    id: 'scaling-law',
    term: 'Scaling law',
    short: 'Predictable power-law loss trends',
    definition:
      'An empirical regularity: loss falls as a power law in model size, dataset size and compute, which allows training runs to be planned before they are executed.',
    prerequisites: [],
    moduleId: 'generative-models',
    section: '2.2.4',
    page: 63,
    lessonId: 'generative-scaling',
  },
  {
    id: 'chinchilla',
    term: 'Compute-optimal scaling',
    short: 'Balance parameters and tokens for a budget',
    definition:
      'The finding that, for a fixed compute budget, model size and training tokens should be increased together in a balanced ratio rather than scaling only one of them.',
    prerequisites: ['scaling-law'],
    moduleId: 'generative-models',
    section: '2.2.4',
    page: 63,
    lessonId: 'generative-scaling',
  },
  {
    id: 'data-parallelism',
    term: 'Data parallelism',
    short: 'Replicate the model, split the batch',
    definition:
      'Each device holds a copy of the parameters and processes a different batch slice; gradients are synchronised across devices. Memory per device stays high because every replica holds the whole model.',
    prerequisites: ['scaling-law'],
    moduleId: 'generative-models',
    section: '2.2.3',
    page: 60,
    lessonId: 'generative-scaling',
  },
  {
    id: 'tensor-parallelism',
    term: 'Tensor parallelism',
    short: 'Split a layer across devices',
    definition:
      'Individual weight matrices are partitioned across devices and partial results are combined with communication, which reduces per-device memory at the cost of frequent collective operations.',
    prerequisites: ['data-parallelism'],
    moduleId: 'generative-models',
    section: '2.2.3',
    page: 60,
    lessonId: 'generative-scaling',
  },
  {
    id: 'kv-cache',
    term: 'KV cache',
    short: 'Stored keys and values for past tokens',
    definition:
      'Autoregressive decoding needs the keys and values of every previous position. Storing them turns repeated recomputation into a memory read. The footprint is 2·L·h_kv·d_h·T·bytes per sequence.',
    prerequisites: ['autoregressive'],
    moduleId: 'generative-models',
    section: '2.3.3',
    page: 71,
    lessonId: 'generative-long-context',
    tex: '\\text{bytes} = 2 \\, L \\, h_{kv} \\, d_h \\, T \\, b',
  },
  {
    id: 'grouped-query-attention',
    term: 'Grouped-query attention',
    short: 'Fewer KV heads than query heads',
    definition:
      'Several query heads share one key/value head, reducing the cache by the ratio h_kv/h_q while retaining more expressiveness than multi-query attention (a single shared head).',
    prerequisites: ['kv-cache'],
    moduleId: 'generative-models',
    section: '2.3.4',
    page: 80,
    lessonId: 'generative-long-context',
  },
  {
    id: 'context-window',
    term: 'Context window',
    short: 'How many tokens the model can condition on',
    definition:
      'The maximum number of tokens available in one forward pass. Prompts, retrieved passages, examples and generated tokens all consume this budget.',
    prerequisites: ['token'],
    moduleId: 'generative-models',
    section: '2.3',
    page: 66,
    lessonId: 'generative-long-context',
  },
  {
    id: 'position-extrapolation',
    term: 'Position interpolation',
    short: 'Stretching a model beyond its trained length',
    definition:
      'Techniques that rescale or adjust positional information so that a model trained on shorter sequences can process longer contexts with acceptable quality.',
    prerequisites: ['positional-encoding', 'context-window'],
    moduleId: 'generative-models',
    section: '2.3.5',
    page: 82,
    lessonId: 'generative-long-context',
  },

  {
    id: 'prompt',
    term: 'Prompt',
    short: 'The text that conditions a frozen model',
    definition:
      'The input context given to a model at inference time: instructions, data, demonstrations and an output contract. Prompting changes conditioning, not parameters.',
    prerequisites: [],
    moduleId: 'prompting',
    section: '3.1.1',
    page: 97,
    lessonId: 'prompting-design',
  },
  {
    id: 'in-context-learning',
    term: 'In-context learning',
    short: 'Learning a pattern from examples inside the prompt',
    definition:
      'The ability to infer a task from demonstrations in the context window, without parameter updates. It is conditioning: the demonstrations bias the next-token distribution.',
    prerequisites: ['prompt'],
    moduleId: 'prompting',
    section: '3.1.2',
    page: 99,
    lessonId: 'prompting-design',
  },
  {
    id: 'zero-shot',
    term: 'Zero-shot prompting',
    short: 'Task description with no examples',
    definition: 'A prompt that specifies the task in words without worked examples.',
    prerequisites: ['in-context-learning'],
    moduleId: 'prompting',
    section: '3.1.2',
    page: 99,
    lessonId: 'prompting-design',
  },
  {
    id: 'few-shot',
    term: 'Few-shot prompting',
    short: 'A handful of demonstrations in the prompt',
    definition:
      'A prompt that includes several input→output examples before the real query. Examples cost context budget and can introduce their own biases.',
    prerequisites: ['in-context-learning'],
    moduleId: 'prompting',
    section: '3.1.2',
    page: 99,
    lessonId: 'prompting-design',
  },
  {
    id: 'chain-of-thought',
    term: 'Chain of thought',
    short: 'Write the intermediate steps',
    definition:
      'Prompting a model to produce reasoning steps before its answer. Because each token is a sequential computation step, longer traces let the model compute more before committing.',
    prerequisites: ['prompt'],
    moduleId: 'prompting',
    section: '3.2.1',
    page: 114,
    lessonId: 'prompting-cot',
  },
  {
    id: 'problem-decomposition',
    term: 'Problem decomposition',
    short: 'Split one hard task into easier sub-tasks',
    definition:
      'Rewriting a task as a sequence of sub-problems, each simple enough to be solved and checked individually.',
    prerequisites: ['chain-of-thought'],
    moduleId: 'prompting',
    section: '3.2.2',
    page: 117,
    lessonId: 'prompting-cot',
  },
  {
    id: 'self-refinement',
    term: 'Self-refinement',
    short: 'Revise a candidate answer',
    definition:
      'Producing a draft and then criticising or revising it. It only reliably helps when an external check supplies new information.',
    prerequisites: ['chain-of-thought'],
    moduleId: 'prompting',
    section: '3.2.3',
    page: 123,
    lessonId: 'prompting-cot',
  },
  {
    id: 'retrieval-augmented-generation',
    term: 'Retrieval-augmented generation (RAG)',
    short: 'Retrieve passages, then generate',
    definition:
      'A pipeline that selects relevant documents with a retriever and places them in the prompt so the generator conditions on up-to-date or private information.',
    prerequisites: ['prompt'],
    moduleId: 'prompting',
    section: '3.2.5',
    page: 133,
    lessonId: 'prompting-rag',
  },
  {
    id: 'cosine-similarity',
    term: 'Cosine similarity',
    short: 'Angle between two vectors',
    definition:
      'The dot product of two vectors divided by the product of their norms. Values near 1 mean aligned directions, which is how a retriever ranks passages against a query.',
    prerequisites: ['token-embedding'],
    moduleId: 'prompting',
    section: '3.2.5',
    page: 133,
    lessonId: 'prompting-rag',
    tex: '\\cos(u,v) = \\frac{u \\cdot v}{\\lVert u \\rVert \\, \\lVert v \\rVert}',
  },
  {
    id: 'tool-use',
    term: 'Tool use',
    short: 'The model emits a structured action',
    definition:
      'The model produces a call to an external function or API in a defined format; the result is returned to the context. Correctness depends on the contract, not only on fluent text.',
    prerequisites: ['prompt'],
    moduleId: 'prompting',
    section: '3.2.5',
    page: 133,
    lessonId: 'prompting-rag',
  },
  {
    id: 'soft-prompt',
    term: 'Soft prompt',
    short: 'Learned continuous prompt vectors',
    definition:
      'Optimised input embeddings prepended to the input instead of discrete text. They are parameters, trained with gradients, and cannot be read as natural language.',
    prerequisites: ['prompt'],
    moduleId: 'prompting',
    section: '3.3.2',
    page: 141,
    lessonId: 'prompting-rag',
  },

  {
    id: 'supervised-fine-tuning',
    term: 'Supervised fine-tuning (SFT)',
    short: 'Imitate demonstrated responses',
    definition:
      'Fine-tuning on instruction/response pairs with the cross-entropy loss applied to response tokens, teaching the format and style of useful answers.',
    prerequisites: ['fine-tuning'],
    moduleId: 'alignment',
    section: '4.2.1',
    page: 156,
    lessonId: 'alignment-sft',
    tex: '\\mathcal{L}_{\\text{SFT}}(\\theta) = -\\sum_t \\log \\Pr(y_t \\mid x, y_{<t}; \\theta)',
  },
  {
    id: 'instruction-tuning',
    term: 'Instruction tuning',
    short: 'Fine-tuning to follow instructions',
    definition:
      'Supervised fine-tuning with instruction-formatted data, which turns a text continuation model into one that responds to requests.',
    prerequisites: ['supervised-fine-tuning'],
    moduleId: 'alignment',
    section: '4.2',
    page: 156,
    lessonId: 'alignment-sft',
  },
  {
    id: 'cross-entropy-loss',
    term: 'Cross-entropy loss',
    short: 'Negative log-likelihood of the target',
    definition:
      'For a target distribution p and prediction q, H(p,q) = −Σ p log q. With a one-hot target it reduces to the negative log-probability of the correct class or token.',
    prerequisites: ['softmax'],
    moduleId: 'alignment',
    section: '4.2.1',
    page: 156,
    lessonId: 'alignment-sft',
    tex: 'H(p, q) = -\\sum_i p_i \\log q_i',
  },
  {
    id: 'rlhf',
    term: 'RLHF',
    short: 'Reinforcement learning from human feedback',
    definition:
      'A pipeline that trains a reward model on human comparisons, then optimises the policy to score well under that reward while staying close to a reference model.',
    prerequisites: ['supervised-fine-tuning'],
    moduleId: 'alignment',
    section: '4.3',
    page: 172,
    lessonId: 'alignment-rlhf',
  },
  {
    id: 'reward-model',
    term: 'Reward model',
    short: 'A scalar scorer trained on comparisons',
    definition:
      'A model r(x, y) that assigns a scalar quality score to a response. It is trained on pairwise preferences and then used as the objective for policy optimisation.',
    prerequisites: ['rlhf'],
    moduleId: 'alignment',
    section: '4.3.2',
    page: 179,
    lessonId: 'alignment-rlhf',
  },
  {
    id: 'bradley-terry',
    term: 'Bradley–Terry model',
    short: 'Preference as a sigmoid of score differences',
    definition:
      'A model of pairwise comparison where the probability that a beats b is the logistic function of the difference of their scores.',
    prerequisites: ['reward-model'],
    moduleId: 'alignment',
    section: '4.3.2',
    page: 179,
    lessonId: 'alignment-rlhf',
    tex: '\\Pr(a \\succ b) = \\sigma\\!\\left(r(a) - r(b)\\right)',
  },
  {
    id: 'kl-divergence',
    term: 'KL divergence',
    short: 'How far one distribution is from another',
    definition:
      'D_KL(p‖q) = Σ p log(p/q) ≥ 0, equal to zero only when the distributions match. It appears in RLHF as a penalty keeping the tuned policy close to its reference.',
    prerequisites: ['cross-entropy-loss'],
    moduleId: 'alignment',
    section: '4.3.3',
    page: 182,
    lessonId: 'alignment-rlhf',
    tex: 'D_{\\text{KL}}(p \\,\\|\\, q) = \\sum_y p(y) \\log \\frac{p(y)}{q(y)}',
  },
  {
    id: 'ppo',
    term: 'PPO',
    short: 'The policy-gradient algorithm used in RLHF',
    definition:
      'Proximal policy optimisation: a policy-gradient method that limits how far each update moves the policy, requiring both a policy and a value function.',
    prerequisites: ['rlhf'],
    moduleId: 'alignment',
    section: '4.3.3',
    page: 182,
    lessonId: 'alignment-rlhf',
  },
  {
    id: 'dpo',
    term: 'DPO (direct preference optimisation)',
    short: 'Preference learning without an explicit reward model',
    definition:
      'Substituting the closed-form optimal policy into the Bradley–Terry likelihood yields a loss over policy/reference log-ratios, so preferences are optimised directly.',
    prerequisites: ['bradley-terry', 'kl-divergence'],
    moduleId: 'alignment',
    section: '4.4.2',
    page: 193,
    lessonId: 'alignment-dpo',
    tex: '\\mathcal{L}_{\\text{DPO}}(\\theta) = -\\mathbb{E}_{(x, y_a, y_b) \\sim \\mathcal{D}_r} \\log \\Pr(y_a \\succ y_b \\mid x)',
  },
  {
    id: 'reference-model',
    term: 'Reference model',
    short: 'The frozen model a policy is compared against',
    definition:
      'A copy of the model before preference tuning. Its log-probabilities appear in the DPO ratio and in the RLHF KL penalty, and it is never updated.',
    prerequisites: ['rlhf'],
    moduleId: 'alignment',
    section: '4.4.2',
    page: 193,
    lessonId: 'alignment-dpo',
  },
  {
    id: 'log-ratio',
    term: 'Log-ratio',
    short: 'log(π/π_ref) between policy and reference',
    definition:
      'The quantity log Pr_θ(y|x) − log Pr_ref(y|x). Under the DPO derivation it equals the reward divided by β, up to a prompt-dependent constant.',
    prerequisites: ['reference-model'],
    moduleId: 'alignment',
    section: '4.4.2',
    page: 193,
    lessonId: 'alignment-dpo',
  },

  {
    id: 'prefill',
    term: 'Prefill',
    short: 'Process the prompt in parallel',
    definition:
      'The first inference phase, in which all prompt positions are processed simultaneously and their keys and values are written into the cache.',
    prerequisites: ['autoregressive'],
    moduleId: 'inference',
    section: '5.1.2',
    page: 207,
    lessonId: 'inference-prefill-decode',
  },
  {
    id: 'decode',
    term: 'Decode',
    short: 'Generate one token at a time',
    definition:
      'The second inference phase: each step computes one query, attends to cached keys and values, and appends a new token.',
    prerequisites: ['prefill'],
    moduleId: 'inference',
    section: '5.1.2',
    page: 207,
    lessonId: 'inference-prefill-decode',
  },
  {
    id: 'prefix-caching',
    term: 'Prefix caching',
    short: 'Reuse a shared prompt’s cached state',
    definition:
      'Storing the KV state of a common prefix (a system prompt, for example) so that later requests skip its prefill computation.',
    prerequisites: ['kv-cache', 'prefill'],
    moduleId: 'inference',
    section: '5.2.1',
    page: 223,
    lessonId: 'inference-prefill-decode',
  },
  {
    id: 'continuous-batching',
    term: 'Continuous batching',
    short: 'Admit and retire requests every step',
    definition:
      'Scheduling that adds new requests to a running batch as soon as slots free up, rather than waiting for a fixed batch to finish, which raises utilisation.',
    prerequisites: ['decode'],
    moduleId: 'inference',
    section: '5.2.2',
    page: 223,
    lessonId: 'inference-prefill-decode',
  },
  {
    id: 'temperature',
    term: 'Temperature (τ)',
    short: 'Rescale logits before softmax',
    definition:
      'Dividing logits by τ before the softmax. τ < 1 sharpens the distribution (less randomness), τ > 1 flattens it (more). τ must be positive; zero is the limit, approached with a small positive value.',
    prerequisites: ['softmax', 'logits'],
    moduleId: 'inference',
    section: '5.1.3',
    page: 211,
    lessonId: 'inference-decoding',
    tex: '\\Pr(y_i \\mid x) = \\frac{\\exp(u_{y_i}/\\tau)}{\\sum_{j} \\exp(u_{y_j}/\\tau)}',
  },
  {
    id: 'top-k',
    term: 'Top-k sampling',
    short: 'Sample from the k most likely tokens',
    definition:
      'Keep the k highest-probability tokens, renormalise their mass and sample from that pool. A fixed pool size can be too small in flat distributions and too large in peaked ones.',
    prerequisites: ['temperature'],
    moduleId: 'inference',
    section: '5.1.3',
    page: 211,
    lessonId: 'inference-decoding',
  },
  {
    id: 'top-p',
    term: 'Top-p (nucleus) sampling',
    short: 'Sample from the smallest set reaching mass p',
    definition:
      'Sort tokens by probability, add them until the cumulative mass reaches p, then renormalise and sample. The pool size adapts to how peaked the distribution is.',
    prerequisites: ['top-k'],
    moduleId: 'inference',
    section: '5.1.3',
    page: 211,
    lessonId: 'inference-decoding',
  },
  {
    id: 'greedy-decoding',
    term: 'Greedy decoding',
    short: 'Always take the most likely token',
    definition:
      'A deterministic decoder that selects argmax at every step. It is reproducible and predictable but cannot explore alternatives.',
    prerequisites: ['logits'],
    moduleId: 'inference',
    section: '5.1.3',
    page: 211,
    lessonId: 'inference-decoding',
  },
  {
    id: 'beam-search',
    term: 'Beam search',
    short: 'Keep the best b partial sequences',
    definition:
      'A search that expands several candidate sequences in parallel and keeps the highest-scoring b at each step. Without a length or score calibration it favours short, high-probability outputs.',
    prerequisites: ['greedy-decoding'],
    moduleId: 'inference',
    section: '5.1.3',
    page: 211,
    lessonId: 'inference-decoding',
  },
  {
    id: 'inference-time-scaling',
    term: 'Inference-time scaling',
    short: 'Buy accuracy with extra computation at run time',
    definition:
      'Spending additional tokens, samples or search steps during inference — context scaling, search scaling, output ensembling, thinking-path generation — instead of changing the model.',
    prerequisites: ['decode'],
    moduleId: 'inference',
    section: '5.3',
    page: 234,
    lessonId: 'inference-scaling',
  },
  {
    id: 'throughput',
    term: 'Throughput',
    short: 'Tokens served per unit time',
    definition:
      'Aggregate production rate across all concurrent requests, as opposed to latency for one request. Batching raises throughput while usually increasing per-request latency.',
    prerequisites: ['continuous-batching'],
    moduleId: 'inference',
    section: '5.1.4',
    page: 221,
    lessonId: 'inference-scaling',
  },

  {
    id: 'reasoning',
    term: 'Reasoning',
    short: 'Checkable intermediate computation',
    definition:
      'In this course, reasoning is defined operationally: producing intermediate steps that a criterion — a test, a verifier, a formal check — can evaluate. This keeps claims empirically testable.',
    prerequisites: ['chain-of-thought'],
    moduleId: 'reasoning',
    section: '6.1.1',
    page: 247,
    lessonId: 'reasoning-compute',
  },
  {
    id: 'test-time-compute',
    term: 'Test-time compute',
    short: 'Computation spent after training',
    definition:
      'Any inference-time expenditure — longer traces, multiple samples, search — that can improve accuracy without changing weights.',
    prerequisites: ['inference-time-scaling'],
    moduleId: 'reasoning',
    section: '6.3.1',
    page: 252,
    lessonId: 'reasoning-compute',
  },
  {
    id: 'verifier',
    term: 'Verifier',
    short: 'A scorer that judges candidate solutions',
    definition:
      'A function or model that scores a candidate answer or step. Search and best-of-n are only as good as the verifier they optimise against.',
    prerequisites: ['reasoning'],
    moduleId: 'reasoning',
    section: '6.3.4',
    page: 257,
    lessonId: 'reasoning-compute',
  },
  {
    id: 'search-strategy',
    term: 'Search strategy',
    short: 'How candidate reasoning paths are explored',
    definition:
      'The rule for expanding and pruning partial solutions: greedy, beam, best-of-n, tree search. Each trades verifier calls against the risk of missing a correct path.',
    prerequisites: ['verifier'],
    moduleId: 'reasoning',
    section: '6.3.3',
    page: 256,
    lessonId: 'reasoning-compute',
  },
  {
    id: 'process-supervision',
    term: 'Process supervision',
    short: 'Reward every step, not only the answer',
    definition:
      'Training with step-level feedback, which localises credit assignment but requires reliable step labels and can be exploited by the policy.',
    prerequisites: ['reward-model'],
    moduleId: 'reasoning',
    section: '6.4.2',
    page: 263,
    lessonId: 'reasoning-training',
  },
  {
    id: 'prm',
    term: 'Process reward model (PRM)',
    short: 'A scorer for intermediate steps',
    definition:
      'A reward model trained to score partial solutions, used to guide search or as a reward signal during training.',
    prerequisites: ['process-supervision'],
    moduleId: 'reasoning',
    section: '6.4.2',
    page: 263,
    lessonId: 'reasoning-training',
  },
  {
    id: 'credit-assignment',
    term: 'Credit assignment',
    short: 'Which step deserves the reward?',
    definition:
      'The problem of attributing a final outcome to the intermediate decisions that produced it — the central difficulty of outcome-only supervision.',
    prerequisites: ['process-supervision'],
    moduleId: 'reasoning',
    section: '6.4.2',
    page: 263,
    lessonId: 'reasoning-training',
  },
  {
    id: 'on-policy-distillation',
    term: 'On-policy distillation',
    short: 'Learn from correct traces the model itself generates',
    definition:
      'Training on reasoning traces sampled from the current model and filtered for correctness, which keeps the training distribution close to the inference distribution.',
    prerequisites: ['process-supervision'],
    moduleId: 'reasoning',
    section: '6.4.3',
    page: 267,
    lessonId: 'reasoning-training',
  },
  {
    id: 'rlvr',
    term: 'Verifiable-reward training',
    short: 'Rewards computed by a checker',
    definition:
      'Reinforcement learning where the reward comes from an automatic checker (a unit test, a solver, a proof checker) rather than a learned preference model.',
    prerequisites: ['verifier'],
    moduleId: 'reasoning',
    section: '6.4',
    page: 261,
    lessonId: 'reasoning-training',
  },
  {
    id: 'benchmark',
    term: 'Benchmark',
    short: 'A task suite used for evaluation',
    definition:
      'A fixed set of tasks with a scoring protocol. Benchmarks measure performance under a setup; they do not directly measure an abstract capability.',
    prerequisites: [],
    moduleId: 'reasoning',
    section: '6.5.2',
    page: 272,
    lessonId: 'reasoning-evaluation',
  },
  {
    id: 'contamination',
    term: 'Contamination',
    short: 'Test data seen during training',
    definition:
      'Overlap between evaluation items and training data, which inflates scores and can convert a reasoning measurement into a recall measurement.',
    prerequisites: ['benchmark'],
    moduleId: 'reasoning',
    section: '6.5.3',
    page: 273,
    lessonId: 'reasoning-evaluation',
  },
  {
    id: 'pass-at-k',
    term: 'pass@k',
    short: 'Solve at least one of k attempts',
    definition:
      'A metric that counts a task as solved if any of k sampled attempts is correct. It measures coverage under a sampling budget, and should be reported with that budget.',
    prerequisites: ['benchmark'],
    moduleId: 'reasoning',
    section: '6.5.2',
    page: 272,
    lessonId: 'reasoning-evaluation',
  },
  {
    id: 'outcome-evaluation',
    term: 'Outcome-based evaluation',
    short: 'Judge the final answer only',
    definition:
      'Scoring a solution by its final answer. Cheap to automate and reproducible, but blind to whether the reasoning was sound or accidentally correct.',
    prerequisites: ['benchmark'],
    moduleId: 'reasoning',
    section: '6.5.1',
    page: 271,
    lessonId: 'reasoning-evaluation',
  },
]

export function glossaryByTerm(term: string): GlossaryEntry | undefined {
  return GLOSSARY.find((entry) => entry.id === term)
}

export function glossaryForLesson(lessonId: string): GlossaryEntry[] {
  return GLOSSARY.filter((entry) => entry.lessonId === lessonId)
}

export interface FormulaEntry {
  id: string
  name: string
  tex: string
  explanation: string
  /** Variables and what they mean. */
  symbols: { symbol: string; meaning: string }[]
  lessonId: string
  section: string
  page: number
  moduleId: ModuleId
}

export const FORMULAS: FormulaEntry[] = [
  {
    id: 'autoregressive-factorisation',
    name: 'Autoregressive factorisation',
    tex: '\\Pr(x_0, \\dots, x_{m}) = \\prod_{i=0}^{m} \\Pr(x_i \\mid x_0, \\dots, x_{i-1})',
    explanation:
      'The joint probability of a sequence is the product of per-token conditionals. Training maximises the log of this product, which is why the loss is a sum of log-probabilities.',
    symbols: [
      { symbol: 'x_i', meaning: 'the token at position i' },
      { symbol: 'm', meaning: 'sequence length minus one' },
    ],
    lessonId: 'pretraining-objectives',
    section: '1.2.1',
    page: 7,
    moduleId: 'pre-training',
  },
  {
    id: 'mlm-loss',
    name: 'Masked language modelling loss',
    tex: '\\mathcal{L}_{\\text{MLM}} = -\\sum_{i \\in \\mathcal{M}} \\log \\Pr_\\theta(x_i \\mid \\tilde{x})',
    explanation:
      'Only masked positions contribute to the loss. The model sees the corrupted sequence x̃ and must reconstruct the original tokens at the masked positions M.',
    symbols: [
      { symbol: '\\mathcal{M}', meaning: 'set of masked positions' },
      { symbol: '\\tilde{x}', meaning: 'the corrupted input sequence' },
    ],
    lessonId: 'pretraining-bert',
    section: '1.2.2',
    page: 8,
    moduleId: 'pre-training',
  },
  {
    id: 'qkv-attention',
    name: 'QKV attention with causal mask',
    tex: '\\operatorname{Att}_{qkv}(Q, K, V) = \\operatorname{Softmax}\\!\\left(\\frac{QK^{\\top}}{\\sqrt{d}} + M\\right) V',
    explanation:
      'Queries are compared with keys, scaled by 1/√d, masked so that future positions are excluded, normalised by rows, and used to weight the values.',
    symbols: [
      { symbol: 'Q, K, V', meaning: 'projections of the hidden states, each m × d' },
      { symbol: 'd', meaning: 'head dimension' },
      { symbol: 'M', meaning: 'causal mask: 0 for i ≥ k, −∞ otherwise' },
    ],
    lessonId: 'generative-transformer',
    section: '2.1.1',
    page: 38,
    moduleId: 'generative-models',
  },
  {
    id: 'multi-head',
    name: 'Multi-head attention',
    tex: 'F(H) = \\operatorname{Merge}(\\text{head}_1, \\dots, \\text{head}_h)\\, W_{\\text{head}}, \\quad \\text{head}_j = \\operatorname{Att}_{qkv}\\!\\left(HW_j^q, HW_j^k, HW_j^v\\right)',
    explanation:
      'Each head projects into its own subspace, runs attention there, and the head outputs are concatenated and projected back to the model dimension.',
    symbols: [
      { symbol: 'h', meaning: 'number of heads' },
      { symbol: 'W_j^q, W_j^k, W_j^v', meaning: 'per-head projection matrices' },
      { symbol: 'W_{\\text{head}}', meaning: 'output projection' },
    ],
    lessonId: 'generative-transformer',
    section: '2.1.1',
    page: 38,
    moduleId: 'generative-models',
  },
  {
    id: 'output-softmax',
    name: 'Output distribution',
    tex: '\\left[\\Pr(\\cdot \\mid x_0), \\dots, \\Pr(\\cdot \\mid x_0 \\dots x_{m-1})\\right] = \\operatorname{Softmax}(H_L W_o)',
    explanation:
      'The final hidden states are projected to vocabulary size and normalised per position. At generation time only the last row is needed for the next token.',
    symbols: [
      { symbol: 'H_L', meaning: 'output of the last Transformer block' },
      { symbol: 'W_o', meaning: 'output projection, d × |V|' },
      { symbol: '|V|', meaning: 'vocabulary size' },
    ],
    lessonId: 'generative-transformer',
    section: '2.1.1',
    page: 38,
    moduleId: 'generative-models',
  },
  {
    id: 'pre-norm',
    name: 'Pre-norm and post-norm blocks',
    tex: '\\text{post-norm: } \\text{LNorm}(F(\\text{input}) + \\text{input}), \\qquad \\text{pre-norm: } F(\\text{LNorm}(\\text{input})) + \\text{input}',
    explanation:
      'The two residual arrangements used inside a Transformer block. Pre-norm places normalisation on the sub-layer input and is more stable to train at depth.',
    symbols: [
      { symbol: 'F', meaning: 'the sub-layer: self-attention or an FFN' },
      { symbol: '\\text{LNorm}', meaning: 'layer normalisation' },
    ],
    lessonId: 'generative-transformer',
    section: '2.1.1',
    page: 38,
    moduleId: 'generative-models',
  },
  {
    id: 'positional-sinusoid',
    name: 'Sinusoidal positional encoding',
    tex: 'PE_{(pos, 2i)} = \\sin\\!\\left(\\frac{pos}{10000^{2i/d}}\\right), \\quad PE_{(pos, 2i+1)} = \\cos\\!\\left(\\frac{pos}{10000^{2i/d}}\\right)',
    explanation:
      'Each dimension oscillates at a different frequency, giving every position a distinct pattern that the model can add to the token embedding.',
    symbols: [
      { symbol: 'pos', meaning: 'position index' },
      { symbol: 'i', meaning: 'dimension-pair index' },
      { symbol: 'd', meaning: 'embedding dimension' },
    ],
    lessonId: 'generative-transformer',
    section: '2.1.1',
    page: 38,
    moduleId: 'generative-models',
  },
  {
    id: 'scaling-power-law',
    name: 'Power-law scaling',
    tex: 'L(N, D) \\approx L_\\infty + \\left(\\frac{N_c}{N}\\right)^{\\alpha} + \\left(\\frac{D_c}{D}\\right)^{\\beta}',
    explanation:
      'A schematic form of the empirical scaling relationship: loss has an irreducible floor plus power-law penalties for finite parameters N and data D. The exponents are fitted, not derived.',
    symbols: [
      { symbol: 'N', meaning: 'number of parameters' },
      { symbol: 'D', meaning: 'number of training tokens' },
      { symbol: '\\alpha, \\beta', meaning: 'fitted exponents' },
    ],
    lessonId: 'generative-scaling',
    section: '2.2.4',
    page: 63,
    moduleId: 'generative-models',
  },
  {
    id: 'kv-cache-bytes',
    name: 'KV-cache size',
    tex: '\\text{bytes} = 2 \\times L \\times h_{kv} \\times d_h \\times T \\times b_{\\text{bytes}} \\times B',
    explanation:
      'The cache holds a key and a value tensor per layer, per KV head, per token. The factor 2 accounts for K and V, and B is the batch size.',
    symbols: [
      { symbol: 'L', meaning: 'number of layers' },
      { symbol: 'h_{kv}', meaning: 'number of key/value heads' },
      { symbol: 'd_h', meaning: 'dimension per head' },
      { symbol: 'T', meaning: 'context length in tokens' },
      { symbol: 'b_{\\text{bytes}}', meaning: 'bytes per stored value (2 for fp16)' },
      { symbol: 'B', meaning: 'batch size' },
    ],
    lessonId: 'generative-long-context',
    section: '2.3.3',
    page: 71,
    moduleId: 'generative-models',
  },
  {
    id: 'attention-cost',
    name: 'Attention work',
    tex: '\\text{prefill} = O(T^2 d h), \\qquad \\text{per decoded token} = O(T d h)',
    explanation:
      'Prefill compares every position with every other, so its work is quadratic in the context. Decoding compares one query with all cached keys, which is linear. These are arithmetic counts, not wall-clock measurements.',
    symbols: [
      { symbol: 'T', meaning: 'context length' },
      { symbol: 'd', meaning: 'head dimension' },
      { symbol: 'h', meaning: 'number of heads' },
    ],
    lessonId: 'generative-long-context',
    section: '5.1.1',
    page: 204,
    moduleId: 'generative-models',
  },
  {
    id: 'cosine',
    name: 'Cosine similarity',
    tex: '\\cos(u, v) = \\frac{u \\cdot v}{\\lVert u \\rVert \\, \\lVert v \\rVert}',
    explanation:
      'The retrieval score used in the RAG laboratory. It measures the angle between the query and a document vector, ignoring magnitude.',
    symbols: [
      { symbol: 'u', meaning: 'query vector' },
      { symbol: 'v', meaning: 'document vector' },
    ],
    lessonId: 'prompting-rag',
    section: '3.2.5',
    page: 133,
    moduleId: 'prompting',
  },
  {
    id: 'sft-loss',
    name: 'Supervised fine-tuning loss',
    tex: '\\mathcal{L}_{\\text{SFT}}(\\theta) = -\\mathbb{E}_{(x, y) \\sim \\mathcal{D}} \\sum_{t} \\log \\Pr_\\theta(y_t \\mid x, y_{<t})',
    explanation:
      'The cross-entropy of the demonstrated response given the instruction, summed over response tokens only.',
    symbols: [
      { symbol: 'x', meaning: 'the instruction / prompt' },
      { symbol: 'y', meaning: 'the demonstrated response' },
      { symbol: 'y_{<t}', meaning: 'response tokens before position t' },
    ],
    lessonId: 'alignment-sft',
    section: '4.2.1',
    page: 156,
    moduleId: 'alignment',
  },
  {
    id: 'bradley-terry',
    name: 'Bradley–Terry preference probability',
    tex: '\\Pr(y_a \\succ y_b \\mid x) = \\sigma\\!\\left(r(x, y_a) - r(x, y_b)\\right)',
    explanation:
      'The probability that a human prefers response a over response b is the logistic function of the reward difference. Training a reward model maximises the likelihood of the observed comparisons.',
    symbols: [
      { symbol: '\\sigma', meaning: 'the logistic sigmoid' },
      { symbol: 'r(x, y)', meaning: 'the scalar reward for a response' },
    ],
    lessonId: 'alignment-rlhf',
    section: '4.3.2',
    page: 179,
    moduleId: 'alignment',
  },
  {
    id: 'rlhf-objective',
    name: 'RLHF policy objective',
    tex: '\\tilde{\\theta} = \\arg\\min_\\theta \\mathbb{E}_{x \\sim \\mathcal{D}} \\mathbb{E}_{y \\sim \\pi_\\theta(\\cdot \\mid x)} \\left[ -r(x, y) + \\lambda \\left( \\log \\pi_\\theta(y \\mid x) - \\log \\pi_{\\text{ref}}(y \\mid x) \\right) \\right]',
    explanation:
      'Maximise reward while penalising divergence from the reference policy. The KL-like penalty prevents the policy from drifting into high-reward but degenerate behaviour.',
    symbols: [
      { symbol: 'r(x, y)', meaning: 'reward model score' },
      { symbol: '\\lambda', meaning: 'penalty strength (β in the DPO derivation)' },
      { symbol: '\\pi_{\\text{ref}}', meaning: 'frozen reference policy' },
    ],
    lessonId: 'alignment-rlhf',
    section: '4.3.3',
    page: 182,
    moduleId: 'alignment',
  },
  {
    id: 'dpo-closed-form',
    name: 'Closed-form optimal policy',
    tex: '\\pi^*(y \\mid x) = \\frac{1}{Z(x)} \\pi_{\\text{ref}}(y \\mid x) \\exp\\!\\left(\\frac{1}{\\lambda} r(x, y)\\right)',
    explanation:
      'Solving the KL-regularised objective gives a Boltzmann-shaped policy around the reference, with Z(x) the normalising partition function.',
    symbols: [
      { symbol: 'Z(x)', meaning: 'normalisation factor over all responses' },
      { symbol: '\\lambda', meaning: 'penalty strength, β in the book’s DPO notation' },
    ],
    lessonId: 'alignment-dpo',
    section: '4.4.2',
    page: 193,
    moduleId: 'alignment',
  },
  {
    id: 'dpo-reward',
    name: 'DPO reward re-parameterisation',
    tex: 'r(x, y) = \\lambda \\log \\frac{\\pi_\\theta(y \\mid x)}{\\pi_{\\text{ref}}(y \\mid x)} + \\lambda \\log Z(x)',
    explanation:
      'Inverting the closed form expresses the reward through the policy’s log-ratio. The partition term depends only on the prompt, so it cancels in a pairwise difference.',
    symbols: [
      { symbol: '\\pi_\\theta', meaning: 'target policy being trained' },
      { symbol: '\\pi_{\\text{ref}}', meaning: 'reference policy' },
    ],
    lessonId: 'alignment-dpo',
    section: '4.4.2',
    page: 193,
    moduleId: 'alignment',
  },
  {
    id: 'dpo-preference',
    name: 'DPO preference probability',
    tex: '\\Pr(y_a \\succ y_b \\mid x) = \\sigma\\!\\left( \\lambda \\log \\frac{\\pi_\\theta(y_a \\mid x)}{\\pi_{\\text{ref}}(y_a \\mid x)} - \\lambda \\log \\frac{\\pi_\\theta(y_b \\mid x)}{\\pi_{\\text{ref}}(y_b \\mid x)} \\right)',
    explanation:
      'Substituting the reward form into Bradley–Terry removes the reward model: preferences are explained by the policy and reference alone.',
    symbols: [
      { symbol: 'y_a, y_b', meaning: 'preferred and dispreferred responses' },
      { symbol: '\\lambda', meaning: 'β, the temperature of the KL penalty' },
    ],
    lessonId: 'alignment-dpo',
    section: '4.4.2',
    page: 193,
    moduleId: 'alignment',
  },
  {
    id: 'dpo-loss',
    name: 'DPO loss',
    tex: '\\mathcal{L}_{\\text{DPO}}(\\theta) = -\\mathbb{E}_{(x, y_a, y_b) \\sim \\mathcal{D}_r} \\log \\Pr(y_a \\succ y_b \\mid x)',
    explanation:
      'Minimising the negative log-probability of the observed preferences is a supervised-style objective on a fixed preference dataset — no sampling loop is required.',
    symbols: [
      { symbol: '\\mathcal{D}_r', meaning: 'fixed preference dataset' },
    ],
    lessonId: 'alignment-dpo',
    section: '4.4.2',
    page: 193,
    moduleId: 'alignment',
  },
  {
    id: 'topk-renorm',
    name: 'Top-k renormalisation',
    tex: '\\Pr\'(y_i \\mid x, y_{<i}) = \\frac{\\exp(u_{y_i})}{\\sum_{y_j \\in V_i} \\exp(u_{y_j})}',
    explanation:
      'After selecting the candidate pool V_i (top-k or the top-p nucleus), probabilities are renormalised so they sum to one over the pool.',
    symbols: [
      { symbol: 'V_i', meaning: 'candidate pool at step i' },
      { symbol: 'u_{y}', meaning: 'logit of token y' },
    ],
    lessonId: 'inference-decoding',
    section: '5.1.3',
    page: 211,
    moduleId: 'inference',
  },
  {
    id: 'temperature-softmax',
    name: 'Temperature-scaled softmax',
    tex: '\\Pr(y_i \\mid x, y_{<i}) = \\frac{\\exp(u_{y_i}/\\tau)}{\\sum_{y_j \\in V_i} \\exp(u_{y_j}/\\tau)}',
    explanation:
      'Temperature rescales logits before normalisation. Small τ concentrates mass on the top token; large τ flattens the distribution.',
    symbols: [
      { symbol: '\\tau', meaning: 'temperature, a positive scalar' },
    ],
    lessonId: 'inference-decoding',
    section: '5.1.3',
    page: 211,
    moduleId: 'inference',
  },
  {
    id: 'nucleus',
    name: 'Top-p (nucleus) pool',
    tex: 'V_i = \\left\\{ y_i^{\\text{top}1}, \\dots, y_i^{\\text{top}k_p} \\right\\}, \\quad \\sum_{j=1}^{k_p} \\Pr(y_i^{\\text{top}j}) \\ge p',
    explanation:
      'The pool is the smallest prefix of the probability-sorted vocabulary whose cumulative mass reaches p. k_p therefore adapts at every step.',
    symbols: [
      { symbol: 'p', meaning: 'cumulative-probability threshold' },
      { symbol: 'k_p', meaning: 'pool size chosen by the threshold' },
    ],
    lessonId: 'inference-decoding',
    section: '5.1.3',
    page: 211,
    moduleId: 'inference',
  },
  {
    id: 'decoding-probability',
    name: 'Sequence probability under decoding',
    tex: '\\Pr(\\hat{y}) = \\prod_{i} \\Pr(\\hat{y}_i \\mid x, \\hat{y}_{<i})',
    explanation:
      'A generated sequence’s probability is the product of the conditional probabilities of its tokens. Decoding algorithms choose which tokens enter that product; they do not change it.',
    symbols: [
      { symbol: '\\hat{y}', meaning: 'the generated sequence' },
    ],
    lessonId: 'inference-decoding',
    section: '5.1.3',
    page: 211,
    moduleId: 'inference',
  },
  {
    id: 'test-time-scaling',
    name: 'Accuracy under a computation budget',
    tex: '\\text{Acc}(\\text{strategy}, C) = \\Pr\\!\\left(\\exists\\, \\hat{y} \\in \\text{Candidates}(C) : \\text{verify}(\\hat{y}) = \\text{pass}\\right)',
    explanation:
      'Inference-time scaling changes how many candidates a fixed budget C can produce and how they are selected. With an unreliable verifier, this expression is optimised against a proxy, not the truth.',
    symbols: [
      { symbol: 'C', meaning: 'computation budget (tokens, calls, samples)' },
      { symbol: '\\text{verify}', meaning: 'the check used to accept an answer' },
    ],
    lessonId: 'inference-scaling',
    section: '5.3',
    page: 234,
    moduleId: 'inference',
  },
]

export function formulaFor(id: string): FormulaEntry | undefined {
  return FORMULAS.find((entry) => entry.id === id)
}

export function formulasForLesson(lessonId: string): FormulaEntry[] {
  return FORMULAS.filter((entry) => entry.lessonId === lessonId)
}
