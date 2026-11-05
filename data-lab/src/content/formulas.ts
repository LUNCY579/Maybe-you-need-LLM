/**
 * The equation reference.
 *
 * Every entry gives the result, where it comes from, what every symbol is,
 * the assumptions it rests on, a derivation and a worked example.
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

const REFINEDWEB_URL = 'https://arxiv.org/abs/2306.01116'
const DOREMI_URL = 'https://arxiv.org/abs/2305.10429'
const RECURSION_URL = 'https://arxiv.org/abs/2305.17493'

export const FORMULAS: FormulaEntry[] = [
  {
    id: 'perplexity',
    title: 'The perplexity of a document',
    latex: '\\mathrm{PPL}(x) = \\exp\\left(-\\frac{1}{T}\\sum_{t=1}^{T} \\log p(x_t \\mid x_{<t})\\right)',
    reference: { source: 'Penedo et al. (2023)', location: 'Section 2.2', url: REFINEDWEB_URL },
    meaning:
      'How surprised the reference model is by a document, on average over its tokens. It is the exponential of the mean negative log-likelihood.',
    symbols: [
      { symbol: 'T', name: 'the number of tokens in the document', note: 'The average is over the tokens, not over the document.' },
      { symbol: 'p(x_t \\mid x_{<t})', name: 'the model’s probability for the token, given the ones before it', note: 'Under an n-gram model this is the count of the n-gram over the count of its context.' },
    ],
    assumptions: [
      'The tokens are independent given the context, which is the n-gram model’s assumption and not the truth.',
      'The model is the one the filter was built with, so the perplexity is relative to it.',
    ],
    derivation: [
      'The negative log-likelihood of the document is −Σ log p(x_t | x_{<t}).',
      'Dividing by T gives the mean surprisal per token.',
      'Exponentiating converts a mean log-probability back into a probability-like quantity that can be read as “the model was choosing among this many equally likely tokens”.',
    ],
    example: {
      given: 'A document of 100 tokens with a total log-likelihood of −460.',
      result: 'The perplexity is exp(4.6) ≈ 99.5.',
      note: 'The model was, on average, as surprised as if it had been choosing among a hundred equally likely continuations.',
    },
  },
  {
    id: 'stupid-backoff',
    title: 'The backoff of an n-gram model',
    latex: 'p(w \\mid c) = \\begin{cases} \\frac{\\mathrm{count}(c,w)}{\\mathrm{count}(c)} & \\text{if } c,w \\text{ was seen} \\\\ D \\cdot p(w \\mid c^{\\prime}) & \\text{otherwise} \\end{cases}',
    reference: { source: 'This course', location: 'The reference-model laboratory', url: REFINEDWEB_URL },
    meaning:
      'When the longest context is not available, the probability is discounted once for every level of context that was skipped, and the discount is what makes an unusual arrangement expensive.',
    symbols: [
      { symbol: 'D', name: 'the backoff discount', note: 'A number below one, conventionally 0.4. It is the price of the missing context.' },
      { symbol: '\\mathrm{count}(c,w)', name: 'how many times the context c was followed by w', note: 'Counted on the sample of the corpus the model was fit on.' },
      { symbol: 'c^{\\prime}', name: 'the shorter context', note: 'The bigram when the trigram is missing, the unigram when that is missing too.' },
    ],
    assumptions: [
      'The counts are large enough for the ratios to mean something; a context seen once gives a probability of one, which is why a minimum count is imposed.',
    ],
    derivation: [
      'The n-gram estimate of the conditional probability is the count over the context count.',
      'When the n-gram was never seen, the estimate is undefined and the model falls back to a shorter context.',
      'Each fallback multiplies the probability by the discount, so a document that never matches the corpus is charged for every level it missed.',
    ],
    example: {
      given: 'A trigram never seen, a bigram seen 30 times in a context seen 300 times, and a discount of 0.4.',
      result: 'The probability is 0.4 × 30/300 = 0.04.',
      note: 'And if the bigram had been missing too, it would have been 0.4² times the unigram probability.',
    },
  },
  {
    id: 'jaccard',
    title: 'The Jaccard similarity of two shingle sets',
    latex: 'J(A, B) = \\frac{|A \\cap B|}{|A \\cup B|} = \\frac{|A \\cap B|}{|A| + |B| - |A \\cap B|}',
    reference: { source: 'This course', location: 'The deduplication laboratory', url: REFINEDWEB_URL },
    meaning:
      'The overlap of two documents, measured as a ratio that does not grow with the size of the documents.',
    symbols: [
      { symbol: 'A, B', name: 'the shingle sets of the two documents', note: 'The sets of their token n-grams.' },
      { symbol: 'J(A, B)', name: 'the Jaccard similarity', note: 'Zero when the documents share nothing, one when they are identical.' },
    ],
    assumptions: [
      'The shingle size is the same for both documents, which is why the union is meaningful.',
    ],
    derivation: [
      'The intersection counts the shingles the two documents share.',
      'The union counts every shingle in either document, and is the size of the intersection plus the size of the two differences.',
      'Dividing gives a similarity that is scale-free.',
    ],
    example: {
      given: 'Two documents with 50 and 40 shingles, sharing 30.',
      result: 'The similarity is 30/(50 + 40 − 30) = 0.5.',
      note: 'Half the shingles of the smaller document are in the larger one.',
    },
  },
  {
    id: 'minhash-estimate',
    title: 'The MinHash estimate of a similarity',
    latex: '\\hat{J}(A, B) = \\frac{1}{k}\\sum_{i=1}^{k} \\left[ h_i(A) = h_i(B) \\right]',
    reference: { source: 'This course', location: 'The deduplication laboratory', url: REFINEDWEB_URL },
    meaning:
      'An estimate of the Jaccard similarity from k hash functions, with an error of order √((1−J)/k).',
    symbols: [
      { symbol: 'k', name: 'the number of hash functions', note: 'The signature’s length. The error falls as 1/√k.' },
      { symbol: 'h_i(A)', name: 'the smallest value h_i takes on A', note: 'The minimum over the set of the hash function’s values.' },
    ],
    assumptions: [
      'Each hash function is chosen independently and uniformly, which is what makes the estimate unbiased.',
    ],
    derivation: [
      'For a uniformly random hash, the probability that its minimum on A equals its minimum on B is exactly the Jaccard similarity of the two sets.',
      'The fraction of the k hash functions that agree is therefore an unbiased estimate of that similarity.',
      'The variance of a proportion of k trials is J(1−J)/k, so the error is of order √((1−J)/k).',
    ],
    example: {
      given: 'A signature of 128 entries, of which 90 agree.',
      result: 'The estimate is 90/128 = 0.703.',
      note: 'With 128 permutations the standard error is under 0.04.',
    },
  },
  {
    id: 'lsh-recall',
    title: 'The probability that an LSH index catches a pair',
    latex: 'P(\\text{candidate} \\mid J) = 1 - \\left(1 - J^{r}\\right)^{b}',
    reference: { source: 'This course', location: 'The deduplication laboratory', url: REFINEDWEB_URL },
    meaning:
      'The chance that two documents with similarity J are proposed as candidates, for a band size r and b bands.',
    symbols: [
      { symbol: 'r', name: 'the number of rows in a band', note: 'The signature is cut into b bands of r rows.' },
      { symbol: 'b', name: 'the number of bands', note: 'More bands catch more pairs and compare more pairs.' },
    ],
    assumptions: [
      'The rows of the signature are independent, which is approximately true for a MinHash signature.',
    ],
    derivation: [
      'A band agrees if all r of its rows agree, which happens with probability J^r.',
      'A pair is a candidate if any of the b bands agrees, so the probability of not being a candidate is (1 − J^r)^b.',
      'Taking the complement gives the recall.',
    ],
    example: {
      given: '64 permutations, 16 bands, so r = 4, and a pair with similarity 0.9.',
      result: 'The probability is 1 − (1 − 0.9^4)^16 ≈ 0.92.',
      note: 'And for a pair with similarity 0.1 it is 1 − (1 − 0.0001)^16 ≈ 0.0016, so almost nothing is compared for nothing.',
    },
  },
  {
    id: 'group-dro-update',
    title: 'The group weight update',
    latex: 'q_g \\leftarrow q_g \\frac{\\exp\\left(\\eta\\, \\mathcal{L}_g\\right)}{\\sum_{g^{\\prime}} q_{g^{\\prime}} \\exp\\left(\\eta\\, \\mathcal{L}_{g^{\\prime}}\\right)}',
    reference: { source: 'Xie et al. (2023)', location: 'Section 3.1', url: DOREMI_URL },
    meaning:
      'The weight of each group is raised in proportion to how badly that group is doing, and the weights are renormalised.',
    symbols: [
      { symbol: 'q_g', name: 'the weight of group g', note: 'The probability of drawing a sample from that group.' },
      { symbol: '\\mathcal{L}_g', name: 'the loss of group g', note: 'The mean loss over the samples of that group.' },
      { symbol: '\\eta', name: 'the step size', note: 'Zero gives the natural mixture; a large value chases the worst group alone.' },
    ],
    assumptions: [
      'The groups are the right partition of the data, which is a modelling decision rather than a derivation.',
    ],
    derivation: [
      'A group whose loss is high should be sampled more often.',
      'Multiplying its weight by the exponential of its loss raises it in proportion to the loss.',
      'Normalising keeps the weights a distribution.',
    ],
    example: {
      given: 'Two groups with losses 1.0 and 1.2, weights 0.5 and 0.5, and η = 1.',
      result: 'The new weights are 0.5e^1.0/Σ ≈ 0.475 and 0.5e^1.2/Σ ≈ 0.525.',
      note: 'The worse group gains, and the better group loses a little.',
    },
  },
  {
    id: 'optimal-mixture',
    title: 'The mixture that minimises the worst domain',
    latex: 'w_d^{\\star} = \\max\\left(0, \\frac{\\lambda - b_d}{a_d}\\right), \\qquad \\sum_d w_d^{\\star} = 1',
    reference: { source: 'Xie et al. (2023)', location: 'Section 3.2', url: DOREMI_URL },
    meaning:
      'When each domain’s loss is linear in its weight, the optimal mixture equalises the domains that are active, and the level λ is the one at which the weights sum to one.',
    symbols: [
      { symbol: 'a_d', name: 'the slope of domain d’s loss', note: 'How much the domain’s loss rises per unit of weight.' },
      { symbol: 'b_d', name: 'the intercept of domain d’s loss', note: 'The domain’s loss at zero weight.' },
      { symbol: '\\lambda', name: 'the common loss of the active domains', note: 'Found by a one-dimensional search.' },
    ],
    assumptions: [
      'Each domain’s loss is linear in its weight over the range being considered, which is a modelling assumption and the one the method makes.',
      'The weights are non-negative and sum to one.',
    ],
    derivation: [
      'Minimise the worst domain’s loss subject to the weights summing to one.',
      'At the optimum, the domains that are active all have the same loss, or one more unit of weight could be moved to a better domain.',
      'Solving λ = a_d w_d + b_d for w_d gives the formula, and the bisection on λ enforces the constraint.',
    ],
    example: {
      given: 'Two domains with L₁(w) = 2w + 1 and L₂(w) = 3w + 0.5.',
      result: 'Equalising gives w₁ = 0.5556 and w₂ = 0.4444, with a common loss of 2.111.',
      note: 'Any other split makes one of the two domains worse.',
    },
  },
  {
    id: 'total-variation',
    title: 'The total variation distance',
    latex: '\\mathrm{TV}(p, q) = \\frac{1}{2}\\sum_{x} \\left| p(x) - q(x) \\right|',
    reference: { source: 'This course', location: 'The collapse laboratory', url: RECURSION_URL },
    meaning:
      'The largest difference between the probabilities two distributions give to any single event, and a measure of how far a generated distribution has moved from the original.',
    symbols: [
      { symbol: 'p(x)', name: 'the probability under the model’s distribution', note: 'The distribution after some generations of recursion.' },
      { symbol: 'q(x)', name: 'the probability under the original distribution', note: 'What the real data looked like.' },
    ],
    assumptions: [
      'The two distributions are over the same support, which is what makes the sum meaningful.',
    ],
    derivation: [
      'The sum of the absolute differences is twice the largest difference between the two cumulative distributions.',
      'Halving it gives the total variation distance, which lies between zero and one.',
    ],
    example: {
      given: 'A model that has lost the tail entirely.',
      result: 'The total variation distance is close to the mass the tail used to hold.',
      note: 'A distance of 0.47 means nearly half the distribution is wrong.',
    },
  },
]
