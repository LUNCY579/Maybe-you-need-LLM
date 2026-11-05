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

const RAG_URL = 'https://arxiv.org/abs/2005.11401'
const DPR_URL = 'https://arxiv.org/abs/2004.04906'
const COLBERT_URL = 'https://arxiv.org/abs/2004.12832'
const LOST_URL = 'https://arxiv.org/abs/2307.03172'

export const FORMULAS: FormulaEntry[] = [
  {
    id: 'bm25',
    title: 'The BM25 score',
    latex: '\\mathrm{score}(q, d) = \\sum_{w \\in q} \\mathrm{IDF}(w) \\cdot \\frac{f(w,d)(k_1 + 1)}{f(w,d) + k_1\\left(1 - b + b \\frac{|d|}{\\bar{d}}\\right)}',
    reference: { source: 'Lewis et al. (2020)', location: 'Section 2', url: RAG_URL },
    meaning:
      'The score of a document for a question: the rarity of each word, weighted by how much of a match the word accounts for, and normalised for the length of the document.',
    symbols: [
      { symbol: '\\mathrm{IDF}(w)', name: 'the inverse document frequency', note: 'How rare the word is in the collection.' },
      { symbol: 'f(w,d)', name: 'how often the word occurs in the document', note: 'The raw term frequency.' },
      { symbol: 'k_1', name: 'the saturation parameter', note: 'How quickly the term frequency stops paying.' },
      { symbol: 'b', name: 'the length parameter', note: 'How strongly the length is normalised.' },
      { symbol: '\\bar{d}', name: 'the average document length', note: 'The reference the length is measured against.' },
    ],
    assumptions: [
      'The words are independent, which they are not, and which is why the saturation is there.',
      'The collection statistics are a good description of the questions that will be asked.',
    ],
    derivation: [
      'Start with the term frequency and saturate it: the tenth occurrence of a word says much less than the second.',
      'Weight it by how rare the word is, so that common words do not dominate.',
      'Normalise by the length, so that a long document is not rewarded for being long.',
    ],
    example: {
      given: 'A word that occurs in one document out of a hundred, occurring three times in a document twice the average length.',
      result: 'The rare word contributes far more than a common word, even though it occurs less often.',
      note: 'And the saturation means the third occurrence counts, but the thirtieth does not count three times as much.',
    },
  },
  {
    id: 'recall-at-k',
    title: 'The recall at k',
    latex: '\\mathrm{Recall@}k = \\frac{1}{|Q|}\\sum_{q \\in Q} \\mathbb{1}\\left[ q \\in \\mathrm{top}k(q) \\right]',
    reference: { source: 'This course', location: 'The sparse laboratory', url: RAG_URL },
    meaning:
      'The fraction of the questions whose answer is among the first k results.',
    symbols: [
      { symbol: 'Q', name: 'the set of questions', note: 'Each with one known answer.' },
      { symbol: '\\mathrm{top}k(q)', name: 'the first k results for a question', note: 'In the order the retriever returned them.' },
    ],
    assumptions: [
      'Every question has exactly one relevant document, which is the case the laboratory builds.',
    ],
    derivation: [
      'For each question, check whether the answer is in the first k.',
      'Average the indicator over the questions.',
    ],
    example: {
      given: 'Twenty questions, and the answer is in the first ten for eight of them.',
      result: 'The recall at ten is 8/20 = 0.4.',
      note: 'And the random ranking gives the number to beat.',
    },
  },
  {
    id: 'dense-score',
    title: 'The dense retrieval score',
    latex: 's(q, d) = f_\\theta(q)^{\\top} f_\\theta(d)',
    reference: { source: 'Karpukhin et al. (2020)', location: 'Section 3', url: DPR_URL },
    meaning:
      'The score of a document for a question: the inner product of two embeddings of the same function.',
    symbols: [
      { symbol: 'f_\\theta', name: 'the encoder', note: 'The same function for both texts.' },
      { symbol: 's(q, d)', name: 'the score', note: 'Larger is better.' },
    ],
    assumptions: [
      'The two embeddings live in the same space, which is what the training makes them.',
    ],
    derivation: [
      'Encode the question and the document separately.',
      'The inner product is large when the two point the same way.',
      'Because the document’s embedding does not depend on the question, it can be computed once.',
    ],
    example: {
      given: 'Two embeddings with an angle of thirty degrees between them.',
      result: 'The inner product is the cosine of the angle, times the two lengths.',
      note: 'And the training is what makes the angle small for the right pair.',
    },
  },
  {
    id: 'contrastive-loss',
    title: 'The contrastive loss',
    latex: '\\mathcal{L} = -\\frac{1}{B}\\sum_{i=1}^{B} \\log \\frac{\\exp\\left(s_{i,i}/\\tau\\right)}{\\sum_{j=1}^{B} \\exp\\left(s_{i,j}/\\tau\\right)}',
    reference: { source: 'Karpukhin et al. (2020)', location: 'Section 4', url: DPR_URL },
    meaning:
      'The cross-entropy of the correct answer against the other answers in the batch.',
    symbols: [
      { symbol: 's_{i,j}', name: 'the score of question i against answer j', note: 'The matrix of scores over the batch.' },
      { symbol: '\\tau', name: 'the temperature', note: 'How sharp the softmax over the batch is.' },
      { symbol: 'B', name: 'the batch size', note: 'The number of questions, and so of negatives.' },
    ],
    assumptions: [
      'The other answers in the batch are negatives, which is right when the batch is drawn at random.',
    ],
    derivation: [
      'The correct answer for question i is the i-th one, so the targets are the diagonal.',
      'The loss is the cross-entropy of the diagonal of the scaled score matrix.',
      'Minimising it moves each question towards its own answer and away from the rest.',
    ],
    example: {
      given: 'A batch of sixteen questions.',
      result: 'There are 256 question–answer pairs, of which 16 are correct.',
      note: 'The other 240 are negatives that cost nothing to obtain.',
    },
  },
  {
    id: 'maxsim',
    title: 'The MaxSim score',
    latex: 'S(q, d) = \\sum_{i \\in q} \\max_{j \\in d} \\left( q_i^{\\top} d_j \\right)',
    reference: { source: 'Khattab et al. (2020)', location: 'Section 3', url: COLBERT_URL },
    meaning:
      'For each word of the question, the best-matching word of the document; and the sum of those.',
    symbols: [
      { symbol: 'q_i', name: 'the embedding of a word of the question', note: 'One vector per word.' },
      { symbol: 'd_j', name: 'the embedding of a word of the document', note: 'One vector per word, precomputed.' },
      { symbol: 'S(q, d)', name: 'the score', note: 'Larger is better.' },
    ],
    assumptions: [
      'The word embeddings are contextual, so that the same word in two documents has two vectors.',
    ],
    derivation: [
      'For each word of the question, find the document word it matches best.',
      'Sum the best matches.',
      'The document vectors can be precomputed, so the search is a set of maximum inner products.',
    ],
    example: {
      given: 'A question of ten words and a document that contains a good match for eight of them.',
      result: 'The score is the sum of eight large similarities and two small ones.',
      note: 'A single vector cannot say which eight.',
    },
  },
  {
    id: 'length-bias',
    title: 'The length bias of a maximum',
    latex: '\\mathbb{E}\\left[\\max_{j \\le n} X_j \\right] \\ge \\mathbb{E}\\left[\\max_{j \\le m} X_j \\right] \\quad \\text{for } n \\ge m',
    reference: { source: 'This course', location: 'The late-interaction laboratory', url: COLBERT_URL },
    meaning:
      'A maximum over more candidates is larger, so a score built out of maxima prefers the longer document.',
    symbols: [
      { symbol: 'X_j', name: 'the similarities', note: 'The candidate values the maximum is taken over.' },
    ],
    assumptions: [
      'The candidates are drawn from the same distribution whatever the document’s length.',
    ],
    derivation: [
      'Adding a candidate to a set can only raise the maximum.',
      'So a longer document has more candidates, and a larger maximum.',
      'The bias is proportional to how heavy the tail of the similarity distribution is.',
    ],
    example: {
      given: 'Two documents, one twice as long as the other, with the same relevance.',
      result: 'The longer one scores higher, and the gap grows with the length.',
      note: 'Dividing by the number of candidates over-corrects; the laboratory measures both.',
    },
  },
  {
    id: 'attention-prior',
    title: 'The position prior',
    latex: 'p(t) = \\left( 2\\left| \\frac{t}{N} - \\frac{1}{2} \\right| \\right)^{2} - \\frac{1}{4}',
    reference: { source: 'Liu et al. (2023)', location: 'Section 3', url: LOST_URL },
    meaning:
      'The shape of the position effect: high at the two ends of the context, low in the middle.',
    symbols: [
      { symbol: 't', name: 'the position of a token in the context', note: 'From the start.' },
      { symbol: 'N', name: 'the length of the context', note: 'The number of tokens.' },
    ],
    assumptions: [
      'The effect is a property of where the model looks before it looks, not of the content.',
    ],
    derivation: [
      'The attention sinks and the recency make the beginning and the end the favoured places.',
      'The middle is the least favoured.',
      'A needle in the middle therefore receives less attention than one at either end.',
    ],
    example: {
      given: 'A context of a hundred tokens and a needle at position fifty.',
      result: 'The prior is at its lowest there, and the needle is the hardest to find.',
      note: 'Which is why the retrieval pipeline puts its evidence at the start.',
    },
  },
  {
    id: 'position-effect',
    title: 'The accuracy of finding a needle',
    latex: '\\mathrm{Accuracy}(x) = \\Pr\\left[ \\text{the reader finds the needle at relative position } x \\right]',
    reference: { source: 'Liu et al. (2023)', location: 'Section 3', url: LOST_URL },
    meaning:
      'The probability that a reader uses a document, as a function of where the document sits in the context.',
    symbols: [
      { symbol: 'x', name: 'the relative position', note: 'Zero at the start, one at the end.' },
    ],
    assumptions: [
      'The rest of the context is distractors, which is what the key-value retrieval task makes it.',
    ],
    derivation: [
      'Put a needle at each position in turn, with the same distractors.',
      'Measure the share of the attention it receives.',
      'The curve is the position effect.',
    ],
    example: {
      given: 'A context of a hundred distractors and one needle.',
      result: 'The needle at the start is found; the same needle in the middle often is not.',
      note: 'And a reader that is handed the needle by retrieval is handed it at the start.',
    },
  },
]
