/**
 * The equation reference.
 */

export interface FormulaEntry {
  id: string
  title: string
  latex: string
  reference: { source: string; location: string; url: string }
  meaning: string
  symbols: { symbol: string; name: string; note: string }[]
  assumptions: string[]
  derivation: string[]
  example: { given: string; result: string; note: string }
}

const CS336_URL = 'https://cs336.stanford.edu/'
const CHINCHILLA_URL = 'https://arxiv.org/abs/2203.15556'
const KAPLAN_URL = 'https://arxiv.org/abs/2001.08361'

export const FORMULAS: FormulaEntry[] = [
  {
    id: 'bpe-merge',
    title: 'The byte-pair merge rule',
    latex: '(\\hat{a}, \\hat{b}) = \\arg\\max_{(a,b)} \\; \\text{count}(a, b)',
    reference: { source: 'CS336: Language Modeling from Scratch', location: 'Lecture 1, tokenisation', url: CS336_URL },
    meaning:
      'Repeatedly find the most frequent adjacent pair of tokens and merge it into a new one. The order of the merges is the model.',
    symbols: [
      { symbol: '\\text{count}(a,b)', name: 'the pair frequency', note: 'How often the pair appears adjacently.' },
      { symbol: '256 + k', name: 'the new token id', note: 'The merges start after the 256 bytes.' },
    ],
    assumptions: ['The corpus is fixed while the tokeniser is trained.'],
    derivation: [
      'Start with every byte as its own token.',
      'Count every adjacent pair.',
      'Merge the most frequent one everywhere it occurs, and count again.',
      'Stop when the vocabulary is the size you asked for.',
    ],
    example: {
      given: 'A corpus where the pair " t" occurs 400 times and "he" occurs 300 times.',
      result: '" t" is merged first, and becomes one token.',
      note: 'The merge order is what a decoder has to reproduce to invert the encoding.',
    },
  },
  {
    id: 'attention',
    title: 'Scaled dot-product attention',
    latex: '\\mathrm{Attention}(Q, K, V) = \\mathrm{softmax}\\!\\left(\\frac{QK^{\\top}}{\\sqrt{d_k}} + M\\right)V',
    reference: { source: 'CS336: Language Modeling from Scratch', location: 'Lecture 3, architectures', url: CS336_URL },
    meaning:
      'Each position forms a query, compares it with every key, and mixes the values in proportion to the resulting scores. The mask keeps a position from looking forward.',
    symbols: [
      { symbol: 'Q, K, V', name: 'queries, keys and values', note: 'Three projections of the same input.' },
      { symbol: 'd_k', name: 'the head dimension', note: 'The scaling keeps the softmax in its useful range.' },
      { symbol: 'M', name: 'the causal mask', note: 'Minus infinity above the diagonal.' },
    ],
    assumptions: ['The mask is applied before the softmax, so the masked scores get zero probability.'],
    derivation: [
      'A dot product between a query and a key measures how well they match.',
      'Dividing by √d_k keeps the magnitude from growing with the dimension.',
      'The softmax turns the scores into a distribution over the keys.',
      'The mixture of values is the output.',
    ],
    example: {
      given: 'A head dimension of 64.',
      result: 'The scores are divided by 8.',
      note: 'Without the scaling, the softmax saturates and the gradients vanish.',
    },
  },
  {
    id: 'rmsnorm',
    title: 'RMSNorm',
    latex: '\\mathrm{RMSNorm}(x) = \\frac{x}{\\sqrt{\\frac{1}{d}\\sum_{j=1}^{d} x_j^2 + \\varepsilon}} \\odot g',
    reference: { source: 'CS336: Language Modeling from Scratch', location: 'Lecture 3, architectures', url: CS336_URL },
    meaning:
      'Normalise a vector by its root-mean-square and then scale it by a learned gain. There is no mean subtraction and no bias.',
    symbols: [
      { symbol: 'g', name: 'the gain', note: 'A learned vector of length d.' },
      { symbol: '\\varepsilon', name: 'the guard', note: 'Usually 10⁻⁶, and it matters for the gradient.' },
    ],
    assumptions: ['The rows are the normalised dimension.'],
    derivation: [
      'Compute the root-mean-square of the row.',
      'Divide the row by it.',
      'Multiply by the learned gain.',
      'The gradient of 1/rms carries a factor of 1/d from the mean, and leaving it out makes every gradient wrong.',
    ],
    example: {
      given: 'A row of length 8 whose squares sum to 16.',
      result: 'The RMS is √(16/8) = √2, so the row is scaled by 1/√2.',
      note: 'And the gradient of that scaling carries the 1/8.',
    },
  },
  {
    id: 'gelu',
    title: 'GELU',
    latex: '\\mathrm{GELU}(x) = x \\cdot \\Phi(x) \\approx \\frac{x}{2}\\Bigl(1 + \\tanh\\bigl(\\sqrt{\\tfrac{2}{\\pi}}(x + 0.044715 x^3)\\bigr)\\Bigr)',
    reference: { source: 'CS336: Language Modeling from Scratch', location: 'Lecture 3, architectures', url: CS336_URL },
    meaning:
      'The activation of the feed-forward block: the input times the probability that a standard normal is positive.',
    symbols: [
      { symbol: '\\Phi(x)', name: 'the normal CDF', note: 'The exact form; the tanh version is the approximation.' },
    ],
    assumptions: ['The approximation is accurate to about 10⁻⁴ over the useful range.'],
    derivation: [
      'Smoothly interpolate between the linear and the ReLU regimes.',
      'The cubic correction inside the tanh improves the fit.',
      'The derivative follows from the chain rule through the tanh.',
    ],
    example: {
      given: 'x = 2.',
      result: 'GELU(2) ≈ 1.9545.',
      note: 'Above about 4 it is indistinguishable from the input.',
    },
  },
  {
    id: 'cross-entropy',
    title: 'The language-modelling loss',
    latex: '\\mathcal{L} = -\\frac{1}{N}\\sum_{t=1}^{N} \\log p_\\theta(x_t \\mid x_{<t})',
    reference: { source: 'CS336: Language Modeling from Scratch', location: 'Lecture 10, evaluation', url: CS336_URL },
    meaning:
      'The average negative log-probability the model assigned to the tokens that actually came next.',
    symbols: [
      { symbol: 'N', name: 'the number of tokens', note: 'Not the number of sequences.' },
      { symbol: 'p_\\theta(x_t \\mid x_{<t})', name: 'the next-token probability', note: 'What the model predicted.' },
    ],
    assumptions: ['The same tokeniser produced the training and the evaluation tokens.'],
    derivation: [
      'The likelihood of a corpus under the model is the product of the next-token probabilities.',
      'Take logarithms to turn the product into a sum.',
      'Negate and average.',
    ],
    example: {
      given: 'A loss of 2.3026.',
      result: 'The model was as uncertain as a ten-way choice.',
      note: 'That is the perplexity: the loss, exponentiated.',
    },
  },
  {
    id: 'perplexity',
    title: 'Perplexity',
    latex: '\\mathrm{PPL} = e^{\\mathcal{L}} = \\exp\\!\\left(-\\frac{1}{N}\\sum_t \\log p_\\theta(x_t \\mid x_{<t})\\right)',
    reference: { source: 'CS336: Language Modeling from Scratch', location: 'Lecture 10, evaluation', url: CS336_URL },
    meaning:
      'The loss, exponentiated: a number of effective choices per token.',
    symbols: [{ symbol: '\\mathrm{PPL}', name: 'perplexity', note: 'Only comparable at a fixed tokenisation.' }],
    assumptions: ['The tokens are the same as the ones the model was trained on.'],
    derivation: [
      'The geometric mean of the per-token probabilities is 1/PPL.',
      'So a perplexity of 10 means the model spread its probability as a ten-way choice would.',
    ],
    example: {
      given: 'A loss of 3.0.',
      result: 'PPL = e³ ≈ 20.',
      note: 'A different tokeniser would give a different number for the same text.',
    },
  },
  {
    id: 'matmul-flops',
    title: 'The FLOPs of a matrix–matrix multiply',
    latex: '\\mathrm{FLOPs}(m \\times k, k \\times n) = 2mnk',
    reference: { source: 'CS336: Language Modeling from Scratch', location: 'Lecture 2, resource accounting', url: CS336_URL },
    meaning:
      'There are mn outputs, each needing k multiplications and k additions — and the additions are counted as operations too.',
    symbols: [
      { symbol: 'm, k, n', name: 'the shapes', note: 'The middle dimension has to agree.' },
    ],
    assumptions: ['Dense arithmetic; sparsity is a different rule.'],
    derivation: [
      'Each output element is a dot product of length k.',
      'A dot product of length k is k multiplications and k − 1 additions.',
      'Multiplying by mn outputs and counting the addition gives 2mnk.',
    ],
    example: {
      given: 'A 4096 × 4096 by a 4096 × 4096 matrix.',
      result: '2 × 4096³ ≈ 1.37 × 10¹¹ FLOPs.',
      note: 'That is one such multiply, and a transformer does thousands of them per step.',
    },
  },
  {
    id: 'training-step-flops',
    title: 'The FLOPs of a training step',
    latex: '\\mathrm{FLOPs}_{\\text{step}} \\approx 3 \\times \\mathrm{FLOPs}_{\\text{forward}} = 6 \\cdot \\text{params} \\cdot \\text{tokens}',
    reference: { source: 'CS336: Language Modeling from Scratch', location: 'Lecture 2, resource accounting', url: CS336_URL },
    meaning:
      'The backward pass costs about twice the forward pass, and a forward pass costs about two operations per parameter per token.',
    symbols: [{ symbol: '\\text{tokens}', name: 'the tokens in the batch', note: 'The sum of the sequence lengths.' }],
    assumptions: ['The dominant cost is the matrix multiplies, not the normalisation or the softmax.'],
    derivation: [
      'The forward pass applies each weight matrix to every token.',
      'The backward pass does the same for the inputs and again for the weights.',
      'Three forwards in total.',
    ],
    example: {
      given: '70 billion parameters and 1 trillion tokens.',
      result: 'About 4.2 × 10²⁰ FLOPs.',
      note: 'Which is why the arithmetic of a run is settled before it starts.',
    },
  },
  {
    id: 'arithmetic-intensity',
    title: 'Arithmetic intensity',
    latex: 'I = \\frac{\\mathrm{FLOPs}}{\\text{bytes moved}}, \\qquad \\text{balance point: } I^* = \\frac{\\text{peak FLOPs/s}}{\\text{bandwidth}}',
    reference: { source: 'CS336: Language Modeling from Scratch', location: 'Lecture 2, the memory hierarchy', url: CS336_URL },
    meaning:
      'Operations per byte, and the intensity at which the machine’s two ceilings meet. Above the balance point the arithmetic binds; below it, the memory does.',
    symbols: [
      { symbol: 'I', name: 'the intensity', note: 'Of the kernel, not of the machine.' },
      { symbol: 'I^*', name: 'the balance point', note: 'Of order a hundred on a modern accelerator.' },
    ],
    assumptions: ['The machine’s peak rate is achievable for that kernel.'],
    derivation: [
      'A kernel cannot exceed the peak arithmetic rate.',
      'Nor can it exceed the bandwidth divided by the intensity.',
      'The attainable rate is the smaller of the two, and the balance point is where they meet.',
    ],
    example: {
      given: 'A machine with 156 TFLOP/s and 1.55 TB/s.',
      result: 'The balance point is about 100 operations per byte.',
      note: 'A kernel with an intensity of 20 is memory bound, however fast the arithmetic is.',
    },
  },
  {
    id: 'attention-intensity',
    title: 'The intensity of the attention kernel',
    latex: 'I_{\\text{attn}} \\approx \\frac{d_{\\text{model}}}{2} \\quad \\text{(per head, in units of the head dimension)}',
    reference: { source: 'CS336: Language Modeling from Scratch', location: 'Lecture 5, the memory hierarchy', url: CS336_URL },
    meaning:
      'The attention kernel does a fixed amount of arithmetic per byte it moves, and the amount is set by the head dimension — which is why it has to be tiled rather than made faster.',
    symbols: [{ symbol: 'd_{\\text{model}}', name: 'the width', note: 'Divided by the head dimension for a per-head figure.' }],
    assumptions: ['The attention matrix is written and read once.'],
    derivation: [
      'The scores cost 2n²d of arithmetic per head.',
      'The attention matrix is n² elements, read and written.',
      'The ratio is fixed by the head dimension, not by the sequence length.',
    ],
    example: {
      given: 'A head dimension of 64.',
      result: 'An intensity of about 32 operations per byte.',
      note: 'Below the balance point of every modern accelerator.',
    },
  },
  {
    id: 'data-parallel-comm',
    title: 'The communication of a data-parallel step',
    latex: '\\text{bytes communicated} = 2 \\cdot \\text{params} \\cdot \\text{bytes per value} \\cdot \\frac{(D-1)}{D}',
    reference: { source: 'CS336: Language Modeling from Scratch', location: 'Lecture 7, parallelism', url: CS336_URL },
    meaning:
      'The all-reduce of the gradients touches every parameter on every device, and the ring algorithm moves about twice the gradient size.',
    symbols: [
      { symbol: 'D', name: 'the number of devices', note: 'The (D−1)/D factor is the ring algorithm’s efficiency.' },
    ],
    assumptions: ['A ring all-reduce over a fast interconnect.'],
    derivation: [
      'Each device holds the full gradient vector.',
      'The ring algorithm passes it around, and each device ends up with the sum.',
      'About two transfers of the whole vector per device.',
    ],
    example: {
      given: 'A 7-billion-parameter model, 64 devices and 2 bytes per value.',
      result: 'About 280 GB per step, at 64 devices.',
      note: 'Which is why the parameters are usually kept in a lower precision for the reduction.',
    },
  },
  {
    id: 'chinchilla-rule',
    title: 'The compute-optimal rule of thumb',
    latex: 'D \\approx 20 N \\quad \\text{(tokens per parameter, at the compute-optimal frontier)}',
    reference: { source: 'Hoffmann et al. (2022)', location: 'The compute-optimal allocation', url: CHINCHILLA_URL },
    meaning:
      'At the compute-optimal frontier, a model wants about twenty training tokens per parameter. A rule of thumb, and a frontier that moves.',
    symbols: [
      { symbol: 'D', name: 'the training tokens', note: 'Not the documents.' },
      { symbol: 'N', name: 'the parameters', note: 'Of the model.' },
    ],
    assumptions: ['It holds near the frontier; it is not a law, and the frontier moves.'],
    derivation: [
      'Sweep the compute along the IsoFLOP curves.',
      'Find the best model size at each compute budget.',
      'Read the data-to-parameter ratio at the optimum.',
    ],
    example: {
      given: 'A model with 70 billion parameters.',
      result: 'About 1.4 trillion tokens.',
      note: 'Which is why the early generations were trained for far more than one epoch of the good data.',
    },
  },
  {
    id: 'scaling-law',
    title: 'The scaling law',
    latex: 'L(N, D) = \\left(\\frac{N_c}{N}\\right)^{\\alpha_N} \\left(\\frac{D_c}{D}\\right)^{\\alpha_D} + L_{\\mathrm{irr}}',
    reference: { source: 'Kaplan et al. (2020)', location: 'The scaling laws', url: KAPLAN_URL },
    meaning:
      'The loss falls as a power law in the parameters and the data, with an irreducible term underneath.',
    symbols: [
      { symbol: '\\alpha_N, \\alpha_D', name: 'the exponents', note: 'The slopes of the two power laws.' },
      { symbol: 'L_{\\mathrm{irr}}', name: 'the irreducible loss', note: 'What the data cannot be improved past.' },
    ],
    assumptions: ['The law holds over the range it was fitted on, and the exponents drift.'],
    derivation: [
      'Fit a power law in N at fixed D, and another in D at fixed N.',
      'Combine them and add the irreducible term.',
      'Differentiate along a fixed-compute line to find the optimum.',
    ],
    example: {
      given: 'A fitted law with α_N = 0.076 and α_D = 0.095.',
      result: 'The compute-optimal balance between parameters and data.',
      note: 'Chinchilla later found different exponents, and a different frontier.',
    },
  },
  {
    id: 'dedup-rate',
    title: 'What deduplication removes',
    latex: '\\text{tokens after} = (1 - d)\\,T, \\qquad d = \\text{fraction of duplicated tokens}',
    reference: { source: 'CS336: Language Modeling from Scratch', location: 'Lecture 14, deduplication', url: CS336_URL },
    meaning:
      'Deduplication removes a fraction d of the tokens, which is a direct reduction in the training budget for the same model.',
    symbols: [{ symbol: 'd', name: 'the duplicate rate', note: 'Measured on the corpus, before filtering.' }],
    assumptions: ['The removed tokens are genuinely redundant.'],
    derivation: [
      'Measure how many tokens occur more than once.',
      'Remove the repeats.',
      'The remaining token count is the training budget.',
    ],
    example: {
      given: 'A corpus of 100 billion tokens with a 30% duplicate rate.',
      result: '70 billion tokens remain.',
      note: 'A third of the compute budget, spent on repetition.',
    },
  },
]
