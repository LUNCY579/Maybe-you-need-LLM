/**
 * Quiz bank.
 *
 * Every item states a source section from the v4 PDF and gives per-option
 * feedback, so a wrong answer produces a diagnosis rather than a bare "incorrect".
 * Numeric items are solvable with the equations shown in the lessons; the expected
 * values are computed by the same core modules the lessons use.
 */
import type { ModuleId } from './curriculum'
import { TRANSFER_QUESTIONS } from './transfer'

export interface QuizQuestion {
  id: string
  lessonId: string
  moduleId: ModuleId
  prompt: string
  /** Optional KaTeX shown under the prompt. */
  tex?: string
  options: string[]
  correctIndex: number
  /** Why the correct answer is correct. */
  explanation: string
  /** Feedback per option (same length as options). */
  feedback: string[]
  /**
   * What kind of question this is.
   *
   * `concept` asks about something the lesson states. `calculation` asks
   * for a number the reader can work out. `transfer` describes a situation
   * the lesson never mentions and asks what the lesson's mechanism says
   * about it — which is the only kind that shows whether the idea has been
   * transferred rather than remembered.
   */
  kind: 'concept' | 'calculation' | 'transfer'
  source: { section: string; page: number }
}

/*
  The bank is the concept and calculation questions of every lesson, followed
  by the transfer questions. The transfer questions are in their own file
  because they are a different kind of thing: each one describes a
  situation the lesson never mentions.
*/
const LESSON_QUESTIONS: QuizQuestion[] = [
  /* -------------------------------------------------------- Module 1 */
  {
    id: 'q-pretrain-1',
    lessonId: 'pretraining-why',
    moduleId: 'pre-training',
    prompt: 'What makes a pre-training objective "self-supervised"?',
    options: [
      'Labels are derived from the input data itself, such as predicting a hidden part of the text',
      'The model is trained without any loss function',
      'A separate teacher model supplies soft labels for every token',
      'Humans annotate every training example',
    ],
    correctIndex: 0,
    explanation:
      'Self-supervision constructs the supervision signal from the raw text: hide or shift part of the input and predict it. No human labels and no separate teacher are required.',
    feedback: [
      'Correct — the target is constructed from the input.',
      'A loss is always required; self-supervision changes where the target comes from, not whether one exists.',
      'A teacher model describes knowledge distillation, which is a different technique.',
      'Human annotation is supervised learning, the opposite contrast.',
    ],
    kind: 'concept',
    source: { section: '1.1.1', page: 2 },
  },
  {
    id: 'q-pretrain-2',
    lessonId: 'pretraining-why',
    moduleId: 'pre-training',
    prompt: 'In the book’s unified view o = g(x₀, x₁, …, xₘ; θ), what are the two aspects of pre-training?',
    options: [
      'Optimising θ on a general objective, then adapting ĝ(·) to downstream tasks',
      'Compressing the dataset, then decompressing it at inference',
      'Training a tokenizer, then freezing it forever',
      'Maximising accuracy on one specific benchmark from the start',
    ],
    correctIndex: 0,
    explanation:
      'Pre-training first optimises θ on a task-agnostic objective, then the resulting model ĝ(·) is adapted by fine-tuning or prompting.',
    feedback: [
      'Correct.',
      'Compression is an analogy some textbooks use, but it is not the book’s two-aspect framing.',
      'Tokenizer training is part of data preparation, not one of the two aspects of pre-training.',
      'Pre-training is deliberately not tied to a specific downstream task.',
    ],
    kind: 'concept',
    source: { section: '1.1', page: 1 },
  },
  {
    id: 'q-pretrain-3',
    lessonId: 'pretraining-why',
    moduleId: 'pre-training',
    prompt:
      'A team has 2,000 unlabelled documents and 200 labelled examples for a classification task. Why does self-supervised pre-training usually beat supervised pre-training here?',
    options: [
      'The unlabelled corpus can train a general representation, and the small labelled set only needs to adapt it',
      'Unlabelled data always produces better accuracy than labelled data',
      'Supervised pre-training cannot use neural networks',
      'Self-supervised pre-training eliminates the need for a task head',
    ],
    correctIndex: 0,
    explanation:
      'The scarce resource is labels; self-supervision converts the abundant unlabelled corpus into a training signal and leaves the small labelled set for adaptation.',
    feedback: [
      'Correct.',
      'Label quality is valuable too; the argument is about scale, not inherent superiority.',
      'Supervised pre-training is entirely possible — it simply needs labels at scale.',
      'A task head is still needed to turn representations into predictions.',
    ],
    kind: 'concept',
    source: { section: '1.1.1', page: 2 },
  },
  {
    id: 'q-objectives-1',
    lessonId: 'pretraining-objectives',
    moduleId: 'pre-training',
    prompt: 'Which objective can be used directly for left-to-right generation at inference time?',
    options: [
      'Causal next-token prediction (decoder-only)',
      'Masked language modelling (encoder-only)',
      'Span corruption (encoder–decoder)',
      'None of them; generation always needs a separate model',
    ],
    correctIndex: 0,
    explanation:
      'A decoder-only model is trained on exactly the operation used for generation: predict the next token given the preceding ones.',
    feedback: [
      'Correct.',
      'Masked pre-training conditions on both sides of a hole, so it is out of distribution when generating left to right.',
      'Span corruption generates the removed spans but conditions on the full corrupted source sequence, differing from open-ended continuation.',
      'Generation is possible; the question is which objective matches it.',
    ],
    kind: 'concept',
    source: { section: '1.2.1', page: 7 },
  },
  {
    id: 'q-objectives-2',
    lessonId: 'pretraining-objectives',
    moduleId: 'pre-training',
    prompt: 'What does a causal mask do inside self-attention?',
    tex: '\\operatorname{Mask}_{(i,k)} = 0 \\;\\text{if}\\; i \\ge k,\\; -\\infty \\;\\text{otherwise}',
    options: [
      'It sets the attention weight of future positions to zero so token i only sees i and earlier',
      'It removes padding tokens from the batch',
      'It scales scores by 1/√d to keep gradients stable',
      'It replaces rare tokens with an unknown token',
    ],
    correctIndex: 0,
    explanation:
      'Adding −∞ before the softmax makes e^{−∞} = 0, so every future position receives exactly zero attention weight.',
    feedback: [
      'Correct.',
      'Padding masks exist, but that is a different mask used for batching.',
      'The 1/√d scaling is a separate part of the attention formula.',
      'That is the tokenizer’s unknown-token handling, unrelated to attention.',
    ],
    kind: 'concept',
    source: { section: '2.1.1', page: 38 },
  },
  {
    id: 'q-objectives-3',
    lessonId: 'pretraining-objectives',
    moduleId: 'pre-training',
    prompt: 'Why do encoder–decoder models such as T5 corrupt spans instead of single tokens?',
    options: [
      'Predicting a whole removed span creates a harder, more structured target and shortens the output sequence',
      'Single-token masking is mathematically impossible in an encoder–decoder model',
      'Sparse corruption requires a separate tokenizer per span',
      'Span corruption removes the need for a decoder',
    ],
    correctIndex: 0,
    explanation:
      'Span corruption asks the decoder to reconstruct contiguous chunks, which is a sequence-to-sequence task and yields more supervision per removed region.',
    feedback: [
      'Correct.',
      'Single-token masking is possible; span corruption is a design choice.',
      'The same tokenizer is used for input and output.',
      'The decoder is exactly what reconstructs the spans.',
    ],
    kind: 'concept',
    source: { section: '1.2.3', page: 14 },
  },
  {
    id: 'q-bert-1',
    lessonId: 'pretraining-bert',
    moduleId: 'pre-training',
    prompt:
      'In BERT-style masking, a chosen position is replaced by [MASK] with probability 0.8, a random token with 0.1, and left unchanged with 0.1. Why not always use [MASK]?',
    options: [
      'Because [MASK] never appears at fine-tuning time, the mixed recipe keeps the model usable on ordinary text',
      'Because [MASK] is a reserved token that cannot be embedded',
      'Because random tokens increase the vocabulary size',
      'Because the loss cannot be computed when every target is [MASK]',
    ],
    correctIndex: 0,
    explanation:
      'The encoder must remain competent on unmasked input. Occasionally leaving the true token or a random token in place prevents the model from assuming that the input always contains [MASK].',
    feedback: [
      'Correct — it is a distribution-shift mitigation.',
      '[MASK] is embeddable like any other token.',
      'Random tokens are drawn from the existing vocabulary, not added to it.',
      'The loss is computable; the issue is train/test mismatch.',
    ],
    kind: 'concept',
    source: { section: '1.3.1', page: 22 },
  },
  {
    id: 'q-bert-2',
    lessonId: 'pretraining-bert',
    moduleId: 'pre-training',
    prompt: 'You need a system that classifies sentences into 8 topics with only 5,000 labelled examples. Which plan fits the book’s guidance best?',
    options: [
      'Fine-tune a pre-trained encoder with a new classification head on the labelled data',
      'Pre-train a decoder-only model from scratch on the 5,000 examples',
      'Use the masked language modelling objective as the final classifier',
      'Concatenate the labelled examples into one long prompt and hope for a label',
    ],
    correctIndex: 0,
    explanation:
      'This is the canonical adaptation recipe: reuse a pre-trained encoder and fine-tune a task head on the small labelled set.',
    feedback: [
      'Correct.',
      'Training from scratch on 5,000 examples discards the value of pre-training.',
      'Masked language modelling predicts tokens, not class labels.',
      'Prompting can work, but with a pre-trained encoder available, fine-tuning is the direct route described in the book.',
    ],
    kind: 'concept',
    source: { section: '1.4', page: 30 },
  },

  /* -------------------------------------------------------- Module 2 */
  {
    id: 'q-transformer-1',
    lessonId: 'generative-transformer',
    moduleId: 'generative-models',
    prompt: 'A sequence has length m and hidden dimension d. What are the shapes of Q, K and V?',
    options: [
      'All three are m × d',
      'Q is m × m, K and V are d × d',
      'Q is m × d, K and V are d × m',
      'All three are d × d',
    ],
    correctIndex: 0,
    explanation:
      'Each position contributes one row, so Q, K, V ∈ ℝ^{m×d}; the score matrix Q Kᵀ is m × m.',
    feedback: [
      'Correct.',
      'The m × m matrix is the score matrix, not Q itself.',
      'Projections map from the hidden dimension back to the hidden dimension, giving m × d.',
      'A d × d shape would drop the sequence dimension entirely.',
    ],
    kind: 'concept',
    source: { section: '2.1.1', page: 38 },
  },
  {
    id: 'q-transformer-2',
    lessonId: 'generative-transformer',
    moduleId: 'generative-models',
    prompt: 'Raw scores for one row are [2, 0] with head dimension d = 4 and no mask. Which row of attention weights is correct?',
    tex: '\\operatorname{Softmax}\\!\\left(\\frac{q k^{\\top}}{\\sqrt{d}}\\right)',
    options: [
      '[0.7311, 0.2689]',
      '[0.88, 0.12]',
      '[0.5, 0.5]',
      '[1.0, 0.0]',
    ],
    correctIndex: 0,
    explanation:
      'Divide by √4 = 2 to get [1, 0]; then softmax([1,0]) = [e/(e+1), 1/(e+1)] ≈ [0.731, 0.269].',
    feedback: [
      'Correct.',
      '0.88 would correspond to scores [2,0] without the 1/√d scaling.',
      '0.5 requires equal scores.',
      'Greedy-looking weights appear only with a much sharper (higher) score gap.',
    ],
    kind: 'calculation',
    source: { section: '2.1.1', page: 38 },
  },
  {
    id: 'q-transformer-3',
    lessonId: 'generative-transformer',
    moduleId: 'generative-models',
    prompt: 'Why is the first row of a causally masked attention matrix always [1, 0, 0, …]?',
    options: [
      'Position 0 has no past, so the softmax is taken over a single legal position',
      'The first token is always a special token with a fixed embedding',
      'Softmax always returns a one-hot vector for short rows',
      'Because the value matrix is lower triangular',
    ],
    correctIndex: 0,
    explanation:
      'With masking, row 0 can only attend to column 0, and a softmax over a single value is exactly 1.',
    feedback: [
      'Correct.',
      'Special tokens exist but are irrelevant here; the argument holds for any first token.',
      'Softmax is only one-hot when the input is degenerate, which it is here for a structural reason.',
      'V is not lower triangular; the mask acts on scores.',
    ],
    kind: 'concept',
    source: { section: '2.1.1', page: 38 },
  },
  {
    id: 'q-transformer-4',
    lessonId: 'generative-transformer',
    moduleId: 'generative-models',
    prompt: 'What does adding a positional encoding to a token embedding actually provide?',
    options: [
      'Order information, since attention itself is permutation-invariant',
      'A larger embedding dimension',
      'A probability distribution over the vocabulary',
      'A causal mask for the attention scores',
    ],
    correctIndex: 0,
    explanation:
      'Attention compares rows without any notion of order; positional signals inject the index so the model can distinguish “model learns” from “learns model”.',
    feedback: [
      'Correct.',
      'The dimension is unchanged; the encoding is added elementwise.',
      'Vocabulary distributions come from the output layer, not from positional information.',
      'The mask is a separate additive matrix inside attention.',
    ],
    kind: 'concept',
    source: { section: '2.1.1', page: 38 },
  },
  {
    id: 'q-scaling-1',
    lessonId: 'generative-scaling',
    moduleId: 'generative-models',
    prompt: 'A scaling law says loss falls as a power law in compute C. What does compute-optimal training imply?',
    options: [
      'For a fixed budget, parameters and training tokens should grow together in a balanced ratio',
      'Larger models always win regardless of token count',
      'More tokens with a tiny model is always optimal',
      'Scaling laws only apply to vision models',
    ],
    correctIndex: 0,
    explanation:
      'The compute-optimal result is a joint allocation: for a budget of C FLOPs, choose model size and token count together rather than maximising either alone.',
    feedback: [
      'Correct.',
      'Over-sized models trained on too few tokens waste the budget.',
      'Tiny models with enormous token counts also waste the budget.',
      'The book presents scaling laws for language models.',
    ],
    kind: 'concept',
    source: { section: '2.2.4', page: 63 },
  },
  {
    id: 'q-scaling-2',
    lessonId: 'generative-scaling',
    moduleId: 'generative-models',
    prompt: 'Why is data deduplication performed before large-scale pre-training?',
    options: [
      'Duplicated documents are over-weighted and inflate loss-based progress without adding information',
      'Duplicates increase the tokenizer vocabulary',
      'Deduplication reduces the number of attention heads needed',
      'Deduplication is required by the causal mask',
    ],
    correctIndex: 0,
    explanation:
      'Repeated text is memorised more easily and distorts both the effective data distribution and the apparent loss, so it is removed during data preparation.',
    feedback: [
      'Correct.',
      'The vocabulary is built from units, not documents.',
      'Head count is an architecture choice.',
      'Deduplication happens long before attention.',
    ],
    kind: 'concept',
    source: { section: '2.2.1', page: 56 },
  },
  {
    id: 'q-longcontext-1',
    lessonId: 'generative-long-context',
    moduleId: 'generative-models',
    prompt:
      'A model has 32 layers, 8 KV heads, head dimension 128, context 4,096 and stores fp16 (2 bytes). Roughly how large is one sequence’s KV cache?',
    tex: '2 \\times L \\times h_{kv} \\times d_h \\times T \\times \\text{bytes}',
    options: ['≈ 512 MiB', '≈ 64 MiB', '≈ 2 GiB', '≈ 8 MiB'],
    correctIndex: 0,
    explanation:
      '2 × 32 × 8 × 128 × 4096 × 2 = 2^{29} bytes = 512 MiB. That is already half a gigabyte for a single 4k-token sequence.',
    feedback: [
      'Correct: 2·32·8·128·4096·2 = 536,870,912 bytes.',
      '64 MiB would correspond to 8 layers or 1,024 tokens.',
      '2 GiB needs four times this context or batch.',
      '8 MiB is far too small for these dimensions.',
    ],
    kind: 'calculation',
    source: { section: '2.3.3', page: 71 },
  },
  {
    id: 'q-longcontext-2',
    lessonId: 'generative-long-context',
    moduleId: 'generative-models',
    prompt: 'Grouped-query attention reduces the KV cache by:',
    options: [
      'Sharing key/value heads among several query heads',
      'Reducing the number of layers',
      'Quantising activations to 8 bits',
      'Skipping every other attention layer',
    ],
    correctIndex: 0,
    explanation:
      'GQA keeps many query heads but fewer key/value heads, so the cache term L·h_kv·d_h·T shrinks while query expressiveness stays higher than in multi-query attention.',
    feedback: [
      'Correct.',
      'Layer count is unchanged.',
      'Quantisation is an orthogonal memory lever.',
      'Skipping layers changes the architecture’s depth.',
    ],
    kind: 'concept',
    source: { section: '2.3.4', page: 80 },
  },
  {
    id: 'q-longcontext-3',
    lessonId: 'generative-long-context',
    moduleId: 'generative-models',
    prompt: 'Quadrupling the context length from 4k to 16k multiplies prefill attention work by about:',
    tex: '\\text{work} \\propto n^2 \\quad\\Rightarrow\\quad \\left(\\frac{16\\text{k}}{4\\text{k}}\\right)^2 = 16',
    options: ['16', '4', '8', '2'],
    correctIndex: 0,
    explanation:
      'Prefill attention is quadratic in the sequence length: (16k/4k)² = 16. Decode cost, which is linear in the cache length, only grows by 4.',
    feedback: [
      'Correct.',
      '4 is the factor for the linear decode phase.',
      '8 corresponds to no standard term in the attention cost model.',
      '2 would be the factor for a 2× increase in length.',
    ],
    kind: 'calculation',
    source: { section: '5.1.1', page: 204 },
  },

  /* -------------------------------------------------------- Module 3 */
  {
    id: 'q-prompting-1',
    lessonId: 'prompting-design',
    moduleId: 'prompting',
    prompt: 'Which change is a prompt change rather than a parameter change?',
    options: [
      'Adding three worked examples before the question',
      'Fine-tuning the model on 10,000 instructions',
      'Lowering the learning rate',
      'Retraining the tokenizer on a new corpus',
    ],
    correctIndex: 0,
    explanation:
      'Prompting alters the conditioning context for a frozen model; the weights, tokenizer and optimiser are untouched.',
    feedback: [
      'Correct.',
      'Fine-tuning updates weights.',
      'A learning rate is only meaningful when updating parameters.',
      'Retokenising changes the model’s input representation.',
    ],
    kind: 'concept',
    source: { section: '3.1.1', page: 97 },
  },
  {
    id: 'q-prompting-2',
    lessonId: 'prompting-design',
    moduleId: 'prompting',
    prompt: 'Why can few-shot examples improve performance without any weight update?',
    options: [
      'The examples condition the same forward pass on a specific input→output pattern',
      'The model caches the examples as new parameters',
      'The examples are stored in the KV cache permanently',
      'The tokenizer learns the new pattern',
    ],
    correctIndex: 0,
    explanation:
      'In-context learning is conditioning: the demonstrations occupy the context window and bias the conditional distribution of the next tokens.',
    feedback: [
      'Correct.',
      'No parameters change during inference.',
      'A KV cache is per-request state and is discarded; it is not a weight update.',
      'The tokenizer is fixed at inference time.',
    ],
    kind: 'concept',
    source: { section: '3.1.2', page: 99 },
  },
  {
    id: 'q-prompting-3',
    lessonId: 'prompting-design',
    moduleId: 'prompting',
    prompt: 'A prompt contains "Answer with one word" and also "Explain your reasoning in detail". What is the most likely failure?',
    options: [
      'Conflicting constraints make the output contract ambiguous',
      'The model will refuse to answer',
      'The tokenizer will produce an error',
      'The attention mask will become invalid',
    ],
    correctIndex: 0,
    explanation:
      'Two instructions demand incompatible output shapes, so the model must guess which to satisfy — a specification bug, not a model failure.',
    feedback: [
      'Correct.',
      'Refusal is unlikely; the model will simply pick one instruction.',
      'Tokenization is unaffected by instruction content.',
      'The mask is structural, not textual.',
    ],
    kind: 'concept',
    source: { section: '3.1.3', page: 101 },
  },
  {
    id: 'q-cot-1',
    lessonId: 'prompting-cot',
    moduleId: 'prompting',
    prompt: 'Why can writing intermediate steps improve accuracy on an arithmetic task?',
    options: [
      'Each generated token is another pass through the network, so the total sequential computation grows',
      'The chain-of-thought text is added to the training data',
      'Intermediate tokens are excluded from the loss',
      'The model’s parameter count increases',
    ],
    correctIndex: 0,
    explanation:
      'A decoder performs a fixed amount of computation per token; emitting steps turns one forward pass into many, each able to condition on the previous result.',
    feedback: [
      'Correct.',
      'Inference does not train the model.',
      'Loss is a training concept; the relevant point is computation.',
      'Parameters are frozen during inference.',
    ],
    kind: 'concept',
    source: { section: '3.2.1', page: 114 },
  },
  {
    id: 'q-cot-2',
    lessonId: 'prompting-cot',
    moduleId: 'prompting',
    prompt: 'In the toy reasoning tree used in the course, why does greedy search fail while a beam of 3 succeeds?',
    options: [
      'The wrong branch scores highest at the first step but a correct branch overtakes it two steps later',
      'Greedy search cannot traverse trees',
      'Beam search exploits the answer key',
      'The tree has a cycle that fools greedy search',
    ],
    correctIndex: 0,
    explanation:
      'Step-level scores are locally misleading: the confident wrong branch (0.75) leads to a terminal score of 0.90, while the correct branch eventually reaches 0.97.',
    feedback: [
      'Correct.',
      'Greedy search traverses trees; it just keeps only one node.',
      'Beam search only uses verifier scores, which contain no correctness flag.',
      'The toy tree is acyclic by construction.',
    ],
    kind: 'concept',
    source: { section: '6.3.3', page: 256 },
  },
  {
    id: 'q-cot-3',
    lessonId: 'prompting-cot',
    moduleId: 'prompting',
    prompt: 'When is self-refinement most likely to help?',
    options: [
      'When an external check — a test, a calculation, a verifier — can reject a bad candidate',
      'When the model is asked to simply try again with no new information',
      'When the answer is a matter of taste',
      'When the prompt already contains the final answer',
    ],
    correctIndex: 0,
    explanation:
      'Improvement requires feedback. Without an external signal, a second attempt mostly re-samples the same distribution and can reinforce the original error.',
    feedback: [
      'Correct.',
      'Re-sampling without signal is not refinement.',
      'Preference questions have no objective check to refine against.',
      'If the answer is already present, refinement adds little.',
    ],
    kind: 'concept',
    source: { section: '3.2.3', page: 123 },
  },
  {
    id: 'q-rag-1',
    lessonId: 'prompting-rag',
    moduleId: 'prompting',
    prompt: 'In retrieval-augmented generation, what exactly is retrieved?',
    options: [
      'Passages that are concatenated into the prompt before the model generates',
      'Extra parameters that are merged into the model',
      'A fine-tuned copy of the model for each document',
      'Gradients from a separate database',
    ],
    correctIndex: 0,
    explanation:
      'RAG is prompt assembly at run time: the retriever selects passages, and the generator conditions on them.',
    feedback: [
      'Correct.',
      'Parameters are not modified by retrieval.',
      'No per-document model copies are involved.',
      'Retrieval is a similarity look-up, not a gradient operation.',
    ],
    kind: 'concept',
    source: { section: '3.2.5', page: 133 },
  },
  {
    id: 'q-rag-2',
    lessonId: 'prompting-rag',
    moduleId: 'prompting',
    prompt: 'Query vector (1, 0) and document vectors a = (1, 0), b = (0.6, 0.8). Which ranks first by cosine similarity?',
    tex: '\\cos(q, d) = \\frac{q \\cdot d}{\\lVert q \\rVert \\, \\lVert d \\rVert}',
    options: ['a, with similarity 1.0 versus 0.6', 'b, with similarity 0.8', 'They tie', 'Cosine similarity cannot rank two documents'],
    correctIndex: 0,
    explanation:
      'cos(q, a) = 1·1 + 0·0 = 1; cos(q, b) = 1·0.6 + 0·0.8 = 0.6 (both document vectors have unit length here).',
    feedback: [
      'Correct.',
      '0.8 is b’s second component, not its similarity to q.',
      'The similarities differ.',
      'Cosine similarity is a scalar per pair and ranks fine.',
    ],
    kind: 'calculation',
    source: { section: '3.2.5', page: 133 },
  },
  {
    id: 'q-rag-3',
    lessonId: 'prompting-rag',
    moduleId: 'prompting',
    prompt: 'What is a soft prompt?',
    options: [
      'A learned continuous vector prepended to the input instead of text',
      'A prompt written in polite language',
      'A prompt that is shorter than 20 tokens',
      'A prompt whose tokens are removed by the causal mask',
    ],
    correctIndex: 0,
    explanation:
      'Soft prompts are optimised embeddings rather than words: they live in the model’s input space and require access to the model during training.',
    feedback: [
      'Correct.',
      'Politeness is a style choice, not an optimisation technique.',
      'Length is not the defining property.',
      'Prompt tokens are visible to the model like any other token.',
    ],
    kind: 'concept',
    source: { section: '3.3.2', page: 141 },
  },

  /* -------------------------------------------------------- Module 4 */
  {
    id: 'q-sft-1',
    lessonId: 'alignment-sft',
    moduleId: 'alignment',
    prompt: 'In supervised fine-tuning on instruction data, which tokens are normally used to compute the loss?',
    options: [
      'The response tokens only',
      'The instruction tokens only',
      'Both instruction and response tokens equally',
      'Randomly masked tokens throughout the sequence',
    ],
    correctIndex: 0,
    explanation:
      'The instruction is context; training on it would teach the model to generate instructions. Loss is applied to the demonstrated response.',
    feedback: [
      'Correct.',
      'That would train the model to produce user turns.',
      'Including instructions dilutes the objective and teaches the wrong distribution.',
      'Random masking is a pre-training objective.',
    ],
    kind: 'concept',
    source: { section: '4.2.1', page: 156 },
  },
  {
    id: 'q-sft-2',
    lessonId: 'alignment-sft',
    moduleId: 'alignment',
    prompt: 'What is the fundamental limitation of imitating demonstrations?',
    options: [
      'The model can only learn to prefer answers that appear in the demonstrations',
      'The loss function cannot be differentiated',
      'Demonstrations are always factually wrong',
      'Imitation requires reinforcement learning',
    ],
    correctIndex: 0,
    explanation:
      'Imitation matches a distribution over the shown responses. If a better answer was never demonstrated, nothing in the objective pushes toward it — which is why preference-based methods were introduced.',
    feedback: [
      'Correct.',
      'The cross-entropy loss is differentiable, which is why it trains well.',
      'Demonstrations are usually correct; the limit is coverage, not correctness.',
      'Imitation is supervised, not reinforcement learning.',
    ],
    kind: 'concept',
    source: { section: '4.2', page: 156 },
  },
  {
    id: 'q-sft-3',
    lessonId: 'alignment-sft',
    moduleId: 'alignment',
    prompt: 'A demonstration dataset contains 90% answers that begin with "Certainly!". What is the likely effect of SFT?',
    options: [
      'The model over-produces that opening because it is statistically favoured by the data',
      'The model learns to dislike that phrase',
      'The phrase is removed by the tokenizer',
      'The model’s context window shrinks',
    ],
    correctIndex: 0,
    explanation:
      'SFT reproduces the demonstration distribution, including stylistic artefacts that appear frequently in it — a data-quality problem with a modelling consequence.',
    feedback: [
      'Correct.',
      'Preference learning is what could push the phrase down; SFT pushes it up.',
      'Tokenization is unaffected.',
      'Context length is an architectural and configuration property.',
    ],
    kind: 'concept',
    source: { section: '4.2.2', page: 161 },
  },
  {
    id: 'q-rlhf-1',
    lessonId: 'alignment-rlhf',
    moduleId: 'alignment',
    prompt: 'Which expression is the Bradley–Terry preference probability for response a over response b?',
    tex: '\\Pr(a \\succ b) = \\;?',
    options: [
      'σ(r(a) − r(b))',
      'σ(r(a) + r(b))',
      'r(a) − r(b)',
      'softmax(r(a), r(b))',
    ],
    correctIndex: 0,
    explanation:
      'The preference likelihood is the logistic function of the reward difference; this is the model trained on pairwise comparisons.',
    feedback: [
      'Correct.',
      'A sum has no preference interpretation.',
      'The bare difference can exceed [0,1] and is not a probability.',
      'A softmax over two rewards is a different (also two-class) model, but the book uses the sigmoid form.',
    ],
    kind: 'concept',
    source: { section: '4.3.2', page: 179 },
  },
  {
    id: 'q-rlhf-2',
    lessonId: 'alignment-rlhf',
    moduleId: 'alignment',
    prompt: 'Why does the RLHF policy objective include a KL penalty against a reference model?',
    options: [
      'Without it, reward maximisation can drift into degenerate text that scores highly but is unusable',
      'The KL term makes training faster',
      'The KL term replaces the reward model',
      'The KL term removes the need for a policy',
    ],
    correctIndex: 0,
    explanation:
      'The penalty keeps the tuned policy near the pre-aligned reference, limiting reward hacking and preserving fluency.',
    feedback: [
      'Correct.',
      'KL regularisation is a constraint, not an accelerator.',
      'The reward model is still required in RLHF.',
      'The policy is exactly what is being optimised.',
    ],
    kind: 'concept',
    source: { section: '4.3.3', page: 182 },
  },
  {
    id: 'q-rlhf-3',
    lessonId: 'alignment-rlhf',
    moduleId: 'alignment',
    prompt: 'A reward model scores a verbose but empty answer very highly. What is this failure called?',
    options: [
      'Reward hacking (the policy exploits the reward model’s weaknesses)',
      'Catastrophic forgetting',
      'Tokenization drift',
      'Gradient vanishing',
    ],
    correctIndex: 0,
    explanation:
      'The reward model is an imperfect proxy; optimising it hard finds inputs that score well without satisfying the underlying preference.',
    feedback: [
      'Correct.',
      'Forgetting refers to losing previously learned capability.',
      'Tokenization is unrelated.',
      'Vanishing gradients are an optimisation pathology, not a specification exploit.',
    ],
    kind: 'concept',
    source: { section: '4.4.1', page: 187 },
  },
  {
    id: 'q-rlhf-4',
    lessonId: 'alignment-rlhf',
    moduleId: 'alignment',
    prompt: 'Outcome of training a linear reward model on the course’s four toy preference pairs:',
    options: [
      'It assigns a higher score to every chosen response than to its rejected partner',
      'It assigns identical scores to chosen and rejected responses',
      'It cannot be trained without a policy',
      'It overfits and inverts every pair',
    ],
    correctIndex: 0,
    explanation:
      'The pairwise logistic loss drives the score difference positive on every training pair, which the unit test asserts explicitly.',
    feedback: [
      'Correct — the direction of every pair is learned.',
      'Identical scores give probability 0.5 and a loss of log 2, which gradient descent reduces.',
      'A reward model is trained on comparisons alone.',
      'The features are designed so a consistent direction exists.',
    ],
    kind: 'concept',
    source: { section: '4.3.2', page: 179 },
  },
  {
    id: 'q-dpo-1',
    lessonId: 'alignment-dpo',
    moduleId: 'alignment',
    prompt: 'What does the DPO re-parameterisation express?',
    tex: 'r(x,y) = \\beta \\log \\frac{\\pi_\\theta(y\\mid x)}{\\pi_{\\text{ref}}(y\\mid x)} + \\beta \\log Z(x)',
    options: [
      'The reward implied by a policy, given its reference model',
      'The gradient of the reward model',
      'The tokenizer’s merge rule',
      'The KL divergence between two tokenizers',
    ],
    correctIndex: 0,
    explanation:
      'Inverting the closed-form optimal policy gives the reward in terms of the policy/reference log-ratio plus a normalisation term that cancels in pairwise comparisons.',
    feedback: [
      'Correct.',
      'It is a value relation, not a gradient.',
      'Merge rules belong to subword tokenization.',
      'Both distributions are over responses, not vocabulary units.',
    ],
    kind: 'concept',
    source: { section: '4.4.2', page: 193 },
  },
  {
    id: 'q-dpo-2',
    lessonId: 'alignment-dpo',
    moduleId: 'alignment',
    prompt: 'Why does Z(x) disappear from the DPO preference probability?',
    options: [
      'It depends on x but not on the response, so it cancels in the difference r(a) − r(b)',
      'It is always exactly 1',
      'It is absorbed into the tokenizer',
      'It is removed by the causal mask',
    ],
    correctIndex: 0,
    explanation:
      'Both r(a) and r(b) contain the same β log Z(x) term for a fixed prompt, so subtracting one from the other eliminates it.',
    feedback: [
      'Correct.',
      'Z(x) is a sum over all responses and is generally not 1.',
      'The tokenizer has no role in the derivation.',
      'The mask is an attention detail.',
    ],
    kind: 'concept',
    source: { section: '4.4.2', page: 193 },
  },
  {
    id: 'q-dpo-3',
    lessonId: 'alignment-dpo',
    moduleId: 'alignment',
    prompt:
      'For a pair with β = 0.5, Δφ = φ(a) − φ(b) = (0.4, 0, −0.2) and (w − w_ref) = (1, 0, 0), what is the DPO log-odds d?',
    tex: 'd = \\beta\\,(w - w_{\\text{ref}})\\cdot \\Delta\\phi',
    options: ['0.2', '0.4', '0.1', '2.0'],
    correctIndex: 0,
    explanation: 'Dot product is 1·0.4 = 0.4; multiplying by β = 0.5 gives d = 0.2, and Pr(a ≻ b) = σ(0.2) ≈ 0.5498.',
    feedback: [
      'Correct.',
      '0.4 omits the β factor.',
      '0.1 would use β = 0.25.',
      '2.0 divides by β instead of multiplying.',
    ],
    kind: 'calculation',
    source: { section: '4.4.2', page: 193 },
  },

  /* -------------------------------------------------------- Module 5 */
  {
    id: 'q-inference-1',
    lessonId: 'inference-prefill-decode',
    moduleId: 'inference',
    prompt: 'What is the essential difference between prefill and decode?',
    options: [
      'Prefill processes all prompt positions in parallel; decode generates one token at a time using cached keys and values',
      'Prefill is done on a CPU and decode on a GPU',
      'Prefill uses a different vocabulary',
      'Decode does not need attention',
    ],
    correctIndex: 0,
    explanation:
      'Both phases use the same weights. Prefill is one large parallel pass; decode is a sequential loop that appends to the KV cache.',
    feedback: [
      'Correct.',
      'Hardware is an implementation choice.',
      'The vocabulary is shared.',
      'Every decoded token still attends to the cached keys and values.',
    ],
    kind: 'concept',
    source: { section: '5.1.2', page: 207 },
  },
  {
    id: 'q-inference-2',
    lessonId: 'inference-prefill-decode',
    moduleId: 'inference',
    prompt: 'Without a KV cache, generating token t requires recomputing keys and values for all t−1 previous tokens. What does caching change?',
    options: [
      'Per-token work becomes approximately linear in the context instead of quadratic in recomputation',
      'The model becomes non-autoregressive',
      'The attention mask is no longer needed',
      'The vocabulary shrinks',
    ],
    correctIndex: 0,
    explanation:
      'Caching stores K and V once per position, so each new token computes one query against the cache — a linear read instead of a full recomputation.',
    feedback: [
      'Correct.',
      'Decoding remains sequential and autoregressive.',
      'The causal mask is still required.',
      'Vocabulary size is unchanged.',
    ],
    kind: 'concept',
    source: { section: '2.3.3', page: 71 },
  },
  {
    id: 'q-inference-3',
    lessonId: 'inference-prefill-decode',
    moduleId: 'inference',
    prompt: 'Two requests share the same 2,000-token system prompt. What does prefix caching save?',
    options: [
      'The prefill computation for the shared prefix',
      'The decode computation for new tokens only',
      'The need for a KV cache',
      'The tokenizer pass',
    ],
    correctIndex: 0,
    explanation:
      'The cached key/value tensors of the shared prefix are reused, so only the differing suffix must be prefilled.',
    feedback: [
      'Correct.',
      'Decoding always requires work per new token.',
      'Prefix caching relies on the KV cache; it does not remove it.',
      'Tokenization is cheap and unaffected.',
    ],
    kind: 'concept',
    source: { section: '5.2.1', page: 223 },
  },
  {
    id: 'q-decoding-1',
    lessonId: 'inference-decoding',
    moduleId: 'inference',
    prompt: 'Logits [2, 1, 0] with temperature τ = 0.5. What are the probabilities?',
    tex: '\\Pr(y_i) = \\frac{\\exp(u_{y_i}/\\tau)}{\\sum_j \\exp(u_{y_j}/\\tau)}',
    options: [
      '[0.866, 0.117, 0.016]',
      '[0.665, 0.245, 0.090]',
      '[0.960, 0.039, 0.001]',
      '[0.5, 0.3, 0.2]',
    ],
    correctIndex: 0,
    explanation:
      'Scaling by 1/τ = 2 gives [4, 2, 0]; softmax of that is [e⁴, e², 1]/(e⁴+e²+1) ≈ [0.866, 0.117, 0.016].',
    feedback: [
      'Correct.',
      '[0.665, 0.245, 0.090] is the τ = 1 case.',
      'Sharper values need a smaller τ.',
      'Equal spacing does not follow from the softmax.',
    ],
    kind: 'calculation',
    source: { section: '5.1.3', page: 211 },
  },
  {
    id: 'q-decoding-2',
    lessonId: 'inference-decoding',
    moduleId: 'inference',
    prompt: 'What distinguishes top-p from top-k?',
    options: [
      'Top-p keeps the smallest set whose cumulative probability reaches p; top-k keeps a fixed number of tokens',
      'Top-p is deterministic; top-k is random',
      'Top-k uses logits; top-p uses probabilities only',
      'They are identical operations with different names',
    ],
    correctIndex: 0,
    explanation:
      'The candidate pool size is fixed for top-k and adapts per step for top-p, although the mass threshold p is constant.',
    feedback: [
      'Correct.',
      'Both select then sample; randomness comes from the final draw in both cases.',
      'Top-k selection is also based on probabilities (or equivalently logits).',
      'The pool-construction rule differs, which changes effective diversity.',
    ],
    kind: 'concept',
    source: { section: '5.1.3', page: 211 },
  },
  {
    id: 'q-decoding-3',
    lessonId: 'inference-decoding',
    moduleId: 'inference',
    prompt: 'In the course’s sampling laboratory, which is true of the base (temperature 1) distribution shown in the chart?',
    options: [
      'It is the raw softmax of the logits and does not change when you move the top-k slider',
      'It changes whenever the seed changes',
      'It is renormalised after top-p filtering',
      'It is the distribution actually sampled from',
    ],
    correctIndex: 0,
    explanation:
      'The base distribution is a property of the logits alone; filters act on the temperature-scaled distribution and produce the final renormalised one.',
    feedback: [
      'Correct.',
      'The seed affects the draw, not the distribution.',
      'Renormalisation is applied to the filtered pool.',
      'Sampling uses the final filtered distribution.',
    ],
    kind: 'concept',
    source: { section: '5.1.3', page: 211 },
  },
  {
    id: 'q-decoding-4',
    lessonId: 'inference-decoding',
    moduleId: 'inference',
    prompt: 'What is the effect of temperature on entropy?',
    options: [
      'Lower temperature reduces entropy; higher temperature increases it',
      'Temperature does not affect entropy',
      'Higher temperature reduces entropy',
      'Entropy only depends on top-k',
    ],
    correctIndex: 0,
    explanation:
      'Dividing logits by a small τ sharpens the distribution (lower entropy); dividing by a large τ flattens it (higher entropy).',
    feedback: [
      'Correct.',
      'Entropy is a function of the distribution, which temperature changes.',
      'This is backwards.',
      'Top-k truncates the support, but temperature acts on the shape.',
    ],
    kind: 'concept',
    source: { section: '5.1.3', page: 211 },
  },
  {
    id: 'q-infer-scaling-1',
    lessonId: 'inference-scaling',
    moduleId: 'inference',
    prompt: 'Best-of-n sampling improves an answer only if:',
    options: [
      'Some scoring or verification signal can distinguish better candidates',
      'n is a prime number',
      'The temperature is exactly 1',
      'The model’s context window is empty',
    ],
    correctIndex: 0,
    explanation:
      'Extra samples expand the candidate set; selection needs a signal, otherwise the choice is arbitrary or returns to the model prior.',
    feedback: [
      'Correct.',
      'Arithmetic properties of n are irrelevant.',
      'Temperature affects diversity of samples, not the selection principle.',
      'Context must contain the prompt and any retrieved material.',
    ],
    kind: 'concept',
    source: { section: '5.3.2', page: 236 },
  },
  {
    id: 'q-infer-scaling-2',
    lessonId: 'inference-scaling',
    moduleId: 'inference',
    prompt: 'The course’s KV-cache and attention figures are described as analytical models. Why is that stated explicitly?',
    options: [
      'Because they estimate cost from formulas; only measurement on real hardware proves a speed-up',
      'Because the formulas are wrong',
      'Because caching has no effect on memory',
      'Because benchmarks are forbidden',
    ],
    correctIndex: 0,
    explanation:
      'Analytical accounting shows how cost scales with shape and configuration, but real latency depends on hardware, kernels and scheduling. Distinguishing the two keeps the claim honest.',
    feedback: [
      'Correct.',
      'The formulas are standard and are unit-tested here.',
      'Caching has a large memory effect — that is its whole point.',
      'Benchmarks are valuable; they are simply not what an analytical model provides.',
    ],
    kind: 'concept',
    source: { section: '5.2.4', page: 233 },
  },

  /* -------------------------------------------------------- Module 6 */
  {
    id: 'q-reasoning-1',
    lessonId: 'reasoning-compute',
    moduleId: 'reasoning',
    prompt: 'What operational definition of reasoning does this course use?',
    options: [
      'Producing intermediate steps that can be checked against a task criterion',
      'Responding faster than a baseline model',
      'Using more parameters than a baseline model',
      'Storing more facts in the parameters',
    ],
    correctIndex: 0,
    explanation:
      'Reasoning is treated operationally: intermediate steps plus a way to verify or score them. This makes claims testable instead of philosophical.',
    feedback: [
      'Correct.',
      'Speed is a systems property.',
      'Parameter count is a capacity property.',
      'Memorisation of facts is explicitly contrasted with reasoning in the source.',
    ],
    kind: 'concept',
    source: { section: '6.1.1', page: 247 },
  },
  {
    id: 'q-reasoning-2',
    lessonId: 'reasoning-compute',
    moduleId: 'reasoning',
    prompt: 'On the course’s toy reasoning tree, greedy search spends the fewest verifier calls. What does comparing it with beam search show?',
    options: [
      'More verification calls can buy correctness when step scores are locally misleading',
      'Greedy search is always wrong',
      'Beam search is always cheaper',
      'Verification calls are free',
    ],
    correctIndex: 0,
    explanation:
      'Greedy follows the highest immediate score and ends on the wrong terminal; the wider beam spends more calls and finds the correct path. The trade-off is real, not free.',
    feedback: [
      'Correct.',
      'Greedy is often right; it fails here for a specific reason.',
      'Beam search costs more calls by construction.',
      'Each call in the simulator counts as work — that is the point of tracking it.',
    ],
    kind: 'concept',
    source: { section: '6.3.4', page: 257 },
  },
  {
    id: 'q-reasoning-3',
    lessonId: 'reasoning-compute',
    moduleId: 'reasoning',
    prompt: 'A verifier is systematically overconfident about a wrong family of answers. What is the expected effect of scaling search?',
    options: [
      'It amplifies the verifier’s bias, selecting wrong answers more reliably',
      'It removes the bias through averaging',
      'It has no effect because the model is frozen',
      'It converts the task into a retrieval problem',
    ],
    correctIndex: 0,
    explanation:
      'Search optimises the combination of model proposals and verifier scores. A biased verifier is optimised just as faithfully as an accurate one.',
    feedback: [
      'Correct.',
      'Averaging helps only if errors are unbiased and independent.',
      'Frozen weights do not make search effects vanish.',
      'Retrieval is an orthogonal technique.',
    ],
    kind: 'concept',
    source: { section: '6.3.4', page: 257 },
  },
  {
    id: 'q-learn-reason-1',
    lessonId: 'reasoning-training',
    moduleId: 'reasoning',
    prompt: 'Which statement about process supervision is correct?',
    options: [
      'It rewards intermediate steps, which helps credit assignment but costs step-level annotation and can be gamed',
      'It rewards only the final answer',
      'It eliminates the need for a verifier',
      'It cannot be combined with reinforcement learning',
    ],
    correctIndex: 0,
    explanation:
      'Step-level rewards localise credit, at the price of obtaining reliable step labels — the classic trade-off against outcome-only rewards.',
    feedback: [
      'Correct.',
      'Outcome supervision rewards the final answer.',
      'A step-level verifier is exactly what process supervision trains.',
      'Process reward models are commonly used inside RL.',
    ],
    kind: 'concept',
    source: { section: '6.4.2', page: 263 },
  },
  {
    id: 'q-learn-reason-2',
    lessonId: 'reasoning-training',
    moduleId: 'reasoning',
    prompt: 'Why does outcome-only supervision make credit assignment hard?',
    options: [
      'A single final reward must be attributed across many intermediate steps, and one bad step may be invisible',
      'Because the final answer is unknown during training',
      'Because the model has no output layer',
      'Because tokenisation loses step boundaries',
    ],
    correctIndex: 0,
    explanation:
      'One scalar at the end gives no information about which step was responsible, especially when a wrong step still happens to produce a correct answer.',
    feedback: [
      'Correct.',
      'Outcome supervision requires the final answer; that is its strength.',
      'The output layer is unaffected.',
      'Step boundaries can be represented as text just fine.',
    ],
    kind: 'concept',
    source: { section: '6.4.2', page: 263 },
  },
  {
    id: 'q-eval-1',
    lessonId: 'reasoning-evaluation',
    moduleId: 'reasoning',
    prompt: 'A benchmark reports 82% accuracy, but 30% of its items appeared in the model’s pre-training data. What is the correct interpretation?',
    options: [
      'The score is inflated by contamination and may reflect memorisation rather than the claimed capability',
      'The score is still valid because the metric is defined correctly',
      'The score is understated',
      'Contamination only matters for vision benchmarks',
    ],
    correctIndex: 0,
    explanation:
      'A metric measures a task setup. If the setup leaks training items, the measurement no longer supports the capability claim.',
    feedback: [
      'Correct.',
      'Correct metric arithmetic does not repair a broken protocol.',
      'Leakage inflates, not deflates, observed accuracy.',
      'Text benchmarks are affected too, which is why contamination checks exist.',
    ],
    kind: 'concept',
    source: { section: '6.5.2', page: 272 },
  },
  {
    id: 'q-eval-2',
    lessonId: 'reasoning-evaluation',
    moduleId: 'reasoning',
    prompt: 'Which evaluation design best supports a claim that a method improves reasoning?',
    options: [
      'Held-out, contamination-checked tasks with a matched compute budget and an error analysis of the traces',
      'A single benchmark run with the highest temperature',
      'Reporting only the best of ten runs',
      'Reporting the metric without the protocol',
    ],
    correctIndex: 0,
    explanation:
      'Matching compute makes the comparison about method rather than budget, and held-out contamination-checked tasks keep the claim about capability rather than recall.',
    feedback: [
      'Correct.',
      'One run at a sampling extreme is not a controlled comparison.',
      'Best-of-ten selection reports the maximum, not the expected performance.',
      'An unreported protocol makes the number uninterpretable.',
    ],
    kind: 'concept',
    source: { section: '6.5.1', page: 271 },
  },
]

/**
 * The whole bank: the questions of every lesson, and the transfer questions.
 *
 * The transfer questions are asked of the same lessons, so a lesson's
 * `quizIds` covers both kinds. The scheduler treats them alike — a transfer
 * question is recalled the same way and scheduled the same way — because
 * the point of them is not that they are harder but that they are about a
 * different thing.
 */
export const QUIZ_BANK: QuizQuestion[] = [...LESSON_QUESTIONS, ...TRANSFER_QUESTIONS]

export function questionsForLesson(lessonId: string): QuizQuestion[] {
  return QUIZ_BANK.filter((question) => question.lessonId === lessonId)
}

export function getQuestion(id: string): QuizQuestion | undefined {
  return QUIZ_BANK.find((question) => question.id === id)
}

/**
 * The colour of the badge that names the kind of a question.
 *
 * A calculation is amber because it is arithmetic; a transfer question is
 * rose because it is the one that asks for the idea to be applied; a concept
 * question is teal because it is the plainest kind.
 */
export function questionTone(kind: 'concept' | 'calculation' | 'transfer') {
  return kind === 'calculation' ? 'amber' : kind === 'transfer' ? 'rose' : 'teal'
}

export function quizStats(): {
  total: number
  modules: number
  lessons: number
  calculations: number
  transfer: number
} {
  return {
    total: QUIZ_BANK.length,
    modules: new Set(QUIZ_BANK.map((q) => q.moduleId)).size,
    lessons: new Set(QUIZ_BANK.map((q) => q.lessonId)).size,
    calculations: QUIZ_BANK.filter((q) => q.kind === 'calculation').length,
    transfer: QUIZ_BANK.filter((q) => q.kind === 'transfer').length,
  }
}
