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

const FLASH_URL = 'https://arxiv.org/abs/2205.14135'
const VLLM_URL = 'https://arxiv.org/abs/2309.06180'
const GSHARD_URL = 'https://arxiv.org/abs/2006.16668'
const SPECINFER_URL = 'https://arxiv.org/abs/2305.09781'

export const FORMULAS: FormulaEntry[] = [
  {
    id: 'attention',
    title: 'The attention computation',
    latex: '\\mathrm{Attention}(Q, K, V) = \\mathrm{softmax}\\left(\\frac{QK^{\\top}}{\\sqrt{d}}\\right) V',
    reference: { source: 'Dao et al. (2022)', location: 'Section 1', url: FLASH_URL },
    meaning:
      'The whole of attention: score every query against every key, turn the scores into weights, and mix the values with them.',
    symbols: [
      { symbol: 'Q, K, V', name: 'the queries, the keys and the values', note: 'One row per position.' },
      { symbol: 'd', name: 'the width of a head', note: 'The square root is what keeps the scores from growing with the width.' },
    ],
    assumptions: [
      'The scores are scaled by one over the square root of the head width, so that the softmax is not saturated.',
    ],
    derivation: [
      'The score of a query against a key is their dot product.',
      'Dividing by the square root of the width keeps the variance of the scores near one.',
      'The softmax turns the scores into weights that sum to one, and the weighted sum of the values is the output.',
    ],
    example: {
      given: 'Two positions, one head, two dimensions.',
      result: 'The score matrix is 2 by 2, and the output is 2 by 2.',
      note: 'The shape of the matrix is the problem: it is N by N, not N by d.',
    },
  },
  {
    id: 'online-softmax',
    title: 'The running softmax',
    latex: 'm_{new} = \\max(m, \\max_j s_j), \\quad \\ell_{new} = e^{m - m_{new}}\\, \\ell + \\sum_j e^{s_j - m_{new}}',
    reference: { source: 'Dao et al. (2022)', location: 'Section 3.1', url: FLASH_URL },
    meaning:
      'The sum of the exponentials of a row, accumulated without the row, and kept correct when the maximum moves.',
    symbols: [
      { symbol: 'm', name: 'the running maximum', note: 'The largest score seen so far.' },
      { symbol: '\\ell', name: 'the running sum', note: 'The sum of the exponentials, relative to the running maximum.' },
      { symbol: 's_j', name: 'a score', note: 'One entry of the row.' },
    ],
    assumptions: [
      'The scores are added in blocks, and the maximum is tracked across the blocks.',
    ],
    derivation: [
      'The softmax subtracts the maximum of the row so that the exponentials do not overflow.',
      'When a new block has a larger maximum, the old sum is too large by a factor of e^(m_new − m).',
      'Rescaling by that factor restores the identity, and the running sum stays exact.',
    ],
    example: {
      given: 'A running sum of 3 with a maximum of 1, and a new block with a maximum of 2.',
      result: 'The sum is rescaled by e^(1−2) = 0.368 before the new block is added.',
      note: 'Without the rescaling the answer would be wrong, and wrong in a way that grows with the number of blocks.',
    },
  },
  {
    id: 'arithmetic-intensity',
    title: 'The arithmetic intensity of a step',
    latex: 'I = \\frac{\\text{operations}}{\\text{bytes moved}}',
    reference: { source: 'Kwon et al. (2023)', location: 'Section 3', url: VLLM_URL },
    meaning:
      'The ratio that decides whether a step waits for the arithmetic or for the memory.',
    symbols: [
      { symbol: 'I', name: 'the arithmetic intensity', note: 'Operations per byte.' },
    ],
    assumptions: [
      'The machine has a balance point: the intensity at which the arithmetic and the memory take the same time.',
    ],
    derivation: [
      'A step takes as long as the slower of its two resources.',
      'The arithmetic time is the operations divided by the rate of operations, and the memory time is the bytes divided by the bandwidth.',
      'The step is compute-bound when the intensity exceeds the machine’s balance point.',
    ],
    example: {
      given: 'A decode step that does 1.4e11 operations and moves 1.4e11 bytes.',
      result: 'The intensity is one operation per byte.',
      note: 'Which is a matrix-vector product, and it is memory-bound on any machine whose balance point is tens.',
    },
  },
  {
    id: 'kv-cache-size',
    title: 'The size of the key and value cache',
    latex: 'M = 2 \\cdot L \\cdot N \\cdot H \\cdot d_h \\cdot b',
    reference: { source: 'Kwon et al. (2023)', location: 'Section 3', url: VLLM_URL },
    meaning:
      'The bytes the cache holds for a sequence of N tokens: two tensors, one per layer, each with one entry per head per dimension.',
    symbols: [
      { symbol: 'L', name: 'the number of layers', note: 'Each layer keeps its own keys and values.' },
      { symbol: 'N', name: 'the number of tokens', note: 'The length of the sequence so far.' },
      { symbol: 'H', name: 'the number of heads', note: 'The heads are stored together.' },
      { symbol: 'd_h', name: 'the width of a head', note: 'So the hidden width is H times d_h.' },
      { symbol: 'b', name: 'the bytes per element', note: 'Two for a half-precision cache.' },
    ],
    assumptions: [
      'The whole cache is kept, which is what makes decoding fast.',
    ],
    derivation: [
      'Each layer stores a key and a value for every token.',
      'Each of those is a vector of H times d_h numbers.',
      'Multiplying gives the bytes.',
    ],
    example: {
      given: 'Eighty layers, sixty-four heads, a head width of 128, a thousand tokens and two bytes per element.',
      result: 'The cache holds 2 × 80 × 1000 × 8192 × 2 = 2.6 gigabytes.',
      note: 'For one sequence. A batch of a hundred of them is two hundred and sixty gigabytes.',
    },
  },
  {
    id: 'auxiliary-loss',
    title: 'The auxiliary loss of a sparse model',
    latex: '\\mathcal{L}_{aux} = N \\sum_{i=1}^{E} f_i P_i',
    reference: { source: 'Lepikhin et al. (2020)', location: 'Section 3', url: GSHARD_URL },
    meaning:
      'The term that keeps the experts evenly used: the number of tokens times the sum, over the experts, of the product of the load fraction and the probability fraction.',
    symbols: [
      { symbol: 'N', name: 'the number of tokens', note: 'In the batch.' },
      { symbol: 'E', name: 'the number of experts', note: 'The sum runs over them.' },
      { symbol: 'f_i', name: 'the fraction of tokens that went to expert i', note: 'The load.' },
      { symbol: 'P_i', name: 'the fraction of the routing probability that went to expert i', note: 'The intent.' },
    ],
    assumptions: [
      'The router is a softmax over the experts, so the probabilities sum to one.',
      'The load fractions sum to one, because every token goes to exactly one expert.',
    ],
    derivation: [
      'The product f_i P_i is large when the expert got more tokens than the router intended.',
      'Summing over the experts and multiplying by the number of tokens makes the term scale with the batch.',
      'Adding it to the training loss pushes the router towards the agreement the term is smallest at.',
    ],
    example: {
      given: 'Two experts, loads of 0.75 and 0.25, probabilities of 0.5 and 0.5, and a hundred tokens.',
      result: 'The auxiliary loss is 100 × (0.375 + 0.125) = 50.',
      note: 'And it is zero when the load and the probability agree, however uneven the load is.',
    },
  },
  {
    id: 'capacity-factor',
    title: 'The capacity of an expert',
    latex: 'C = c \\cdot \\frac{N}{E}',
    reference: { source: 'Lepikhin et al. (2020)', location: 'Section 2', url: GSHARD_URL },
    meaning:
      'The number of tokens an expert may accept: a fixed multiple of its fair share of the batch.',
    symbols: [
      { symbol: 'c', name: 'the capacity factor', note: 'Usually a little above one, so that a nearly balanced router fits.' },
      { symbol: 'N', name: 'the number of tokens', note: 'In the batch.' },
      { symbol: 'E', name: 'the number of experts', note: 'The fair share is N over E.' },
    ],
    assumptions: [
      'The tokens that exceed the capacity are dropped rather than queued.',
    ],
    derivation: [
      'A balanced router sends N/E tokens to each expert.',
      'The capacity is that, times a factor that allows for some imbalance.',
      'When the router is more uneven than the factor allows, the excess is dropped.',
    ],
    example: {
      given: 'A hundred tokens, eight experts and a capacity factor of 1.25.',
      result: 'Each expert may take fifteen tokens, and the two that were sent twenty have to drop five.',
      note: 'The dropped tokens are exactly the ones the imbalance created.',
    },
  },
  {
    id: 'acceptance-rule',
    title: 'The acceptance rule',
    latex: '\\mathrm{accept}(x) = \\min\\left(1, \\frac{p(x)}{q(x)}\\right)',
    reference: { source: 'Chen et al. (2023)', location: 'Section 3', url: SPECINFER_URL },
    meaning:
      'The probability that a drafted token is kept, and the reason the procedure leaves the target’s distribution alone.',
    symbols: [
      { symbol: 'p(x)', name: 'the target’s probability for the token', note: 'The distribution that must be preserved.' },
      { symbol: 'q(x)', name: 'the draft’s probability for the token', note: 'The distribution the token was drawn from.' },
    ],
    assumptions: [
      'The token was drawn from q, and the target’s distribution over the same vocabulary is known.',
    ],
    derivation: [
      'The accepted mass at x is q(x) times the acceptance, which is min(q(x), p(x)).',
      'The rejected mass is the excess, max(0, p(x) − q(x)), and it is resampled from the excess.',
      'The two add up to p(x), for every x, so the output distribution is the target’s.',
    ],
    example: {
      given: 'A token the draft gave probability 0.4 and the target gives 0.1.',
      result: 'The acceptance probability is 0.1/0.4 = 0.25.',
      note: 'The draft was four times too keen on that token, and three quarters of the time it is overruled.',
    },
  },
  {
    id: 'acceptance-rate',
    title: 'The expected acceptance rate',
    latex: '\\mathbb{E}[\\mathrm{accept}] = 1 - \\mathrm{TV}(q, p) = \\sum_x \\min\\bigl(q(x), p(x)\\bigr)',
    reference: { source: 'Chen et al. (2023)', location: 'Section 3', url: SPECINFER_URL },
    meaning:
      'The fraction of the draft’s mass that the target agrees with, and therefore the fraction of the proposals that are kept.',
    symbols: [
      { symbol: '\\mathrm{TV}(q, p)', name: 'the total variation between the two distributions', note: 'Half the sum of the absolute differences.' },
    ],
    assumptions: [
      'The drafted tokens are drawn from q.',
    ],
    derivation: [
      'The expected acceptance is the sum over the tokens of q(x) times the acceptance rule.',
      'That sum is the sum of the minima of the two distributions.',
      'And the sum of the minima is one minus the total variation.',
    ],
    example: {
      given: 'A draft and a target that differ by a total variation of 0.15.',
      result: 'The acceptance rate is 0.85.',
      note: 'And the speed-up is a function of it, which is why a close draft model is worth so much.',
    },
  },
]
