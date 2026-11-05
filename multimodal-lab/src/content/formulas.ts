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

const CLIP_URL = 'https://arxiv.org/abs/2103.00020'
const LLAVA_URL = 'https://arxiv.org/abs/2304.08485'
const FLAMINGO_URL = 'https://arxiv.org/abs/2204.14198'
const SIGLIP_URL = 'https://arxiv.org/abs/2303.15343'
const BLIP2_URL = 'https://arxiv.org/abs/2301.12597'

export const FORMULAS: FormulaEntry[] = [
  {
    id: 'contrastive-loss',
    title: 'The contrastive loss',
    latex: '\\mathcal{L} = -\\frac{1}{B}\\sum_{i=1}^{B} \\log \\frac{\\exp\\left(s_{i,i}/\\tau\\right)}{\\sum_{j=1}^{B} \\exp\\left(s_{i,j}/\\tau\\right)}',
    reference: { source: 'Radford et al. (2021)', location: 'Section 2.1', url: CLIP_URL },
    meaning:
      'The cross-entropy of the correct pairing against every pairing in the batch.',
    symbols: [
      { symbol: 's_{i,j}', name: 'the similarity of image i and caption j', note: 'The dot product of the two embeddings.' },
      { symbol: '\\tau', name: 'the temperature', note: 'The sharpness of the softmax over the batch.' },
      { symbol: 'B', name: 'the batch size', note: 'How many negatives each example gets.' },
    ],
    assumptions: [
      'The embeddings of the two modalities live in the same space, which the training makes them.',
    ],
    derivation: [
      'For each image, the scores of all the captions in the batch are turned into a distribution.',
      'The cross-entropy of that distribution against the correct caption is the loss.',
      'Averaging over the batch is the whole of it.',
    ],
    example: {
      given: 'A batch of thirty-two pairs.',
      result: 'There are 1,024 pairs of image and caption, of which thirty-two are correct.',
      note: 'The other 992 are negatives, and they cost nothing.',
    },
  },
  {
    id: 'gradient',
    title: 'The gradient of the contrastive loss',
    latex: '\\frac{\\partial \\mathcal{L}}{\\partial I_i} = \\frac{1}{B\\tau}\\sum_{j} \\left( p_{ij} - \\mathbb{1}[i=j] \\right) T_j',
    reference: { source: 'This course', location: 'The contrastive laboratory', url: CLIP_URL },
    meaning:
      'The gradient with respect to an image embedding: the probability of each pairing, minus the indicator of the true one, weighted by the caption it was compared with.',
    symbols: [
      { symbol: 'p_{ij}', name: 'the softmax probability of the pairing', note: 'Over the captions of the batch.' },
      { symbol: 'I_i', name: 'the embedding of image i', note: 'What the gradient is with respect to.' },
      { symbol: 'T_j', name: 'the embedding of caption j', note: 'What the gradient pushes towards.' },
    ],
    assumptions: [
      'The softmax is taken over the captions of the batch, for each image.',
    ],
    derivation: [
      'The derivative of the cross-entropy with respect to the logit is the probability minus the indicator of the target.',
      'The chain rule through the similarity gives the gradient with respect to each embedding.',
      'The chain rule through the linear encoder gives the gradient with respect to its weights.',
    ],
    example: {
      given: 'A batch in which the true pairing is the most likely one.',
      result: 'The gradient pushes the image towards its own caption and away from the others.',
      note: 'The test suite checks this against a central finite difference.',
    },
  },
  {
    id: 'retrieval-accuracy',
    title: 'The retrieval accuracy',
    latex: '\\mathrm{R@}1 = \\frac{1}{N}\\sum_{i} \\mathbb{1}\\left[ \\arg\\max_j s_{i,j} = i \\right]',
    reference: { source: 'Radford et al. (2021)', location: 'Section 3', url: CLIP_URL },
    meaning:
      'The fraction of images whose closest caption in the index is the one they were paired with.',
    symbols: [
      { symbol: 'N', name: 'the number of images', note: 'The size of the evaluation set.' },
    ],
    assumptions: [
      'The index contains only the candidates being ranked, and the metric is over a fixed number of them.',
    ],
    derivation: [
      'For each image, find the caption with the highest similarity.',
      'Check whether it is the one it was paired with.',
      'Average over the images.',
    ],
    example: {
      given: 'Forty candidates and the right one first in twenty cases.',
      result: 'The retrieval accuracy is a half.',
      note: 'And against forty candidates, chance is two and a half per cent.',
    },
  },
  {
    id: 'modality-gap',
    title: 'The modality gap',
    latex: '\\mathrm{gap} = \\frac{1}{2}\\left( \\mathbb{E}[\\cos(I, I^{\\prime})] + \\mathbb{E}[\\cos(T, T^{\\prime})] \\right) - \\mathbb{E}[\\cos(I, T)]',
    reference: { source: 'This course', location: 'The modality-gap laboratory', url: CLIP_URL },
    meaning:
      'The mean within-modal similarity minus the mean between-modal one: how far apart the two halves of the shared space are.',
    symbols: [
      { symbol: 'I, I^{\\prime}', name: 'two image embeddings', note: 'From the same space.' },
      { symbol: 'T, T^{\\prime}', name: 'two text embeddings', note: 'From the same space.' },
      { symbol: '\\cos', name: 'the cosine similarity', note: 'The scale-free version of the comparison.' },
    ],
    assumptions: [
      'The pairs are sampled from the same distribution, so the comparison is fair.',
    ],
    derivation: [
      'Measure how similar two images are to each other, and two captions to each other.',
      'Measure how similar an image is to a caption.',
      'The difference is the gap.',
    ],
    example: {
      given: 'Images similar to each other at 0.6, captions at 0.5, and an image to a caption at 0.2.',
      result: 'The gap is 0.35.',
      note: 'And the retrieval still works, because the pairs are closer than the average.',
    },
  },
  {
    id: 'alignment-tax',
    title: 'The alignment tax',
    latex: '\\mathrm{tax} = \\mathrm{acc}_{\\text{before}} - \\mathrm{acc}_{\\text{after}}',
    reference: { source: 'Liu et al. (2023)', location: 'Section 3', url: LLAVA_URL },
    meaning:
      'The accuracy the model gives up on the task it was good at, measured before and after the instruction tuning.',
    symbols: [
      { symbol: '\\mathrm{acc}_{\\text{before}}', name: 'the accuracy before the tuning', note: 'On the original task.' },
      { symbol: '\\mathrm{acc}_{\\text{after}}', name: 'the accuracy after the tuning', note: 'On the same task, on the same data.' },
    ],
    assumptions: [
      'The same task and the same evaluation are used before and after, or the difference is not a tax.',
    ],
    derivation: [
      'Measure the accuracy on the original task.',
      'Tune the model on instructions.',
      'Measure the accuracy again.',
      'The difference is the tax.',
    ],
    example: {
      given: 'The accuracy falls from 72% to 68%.',
      result: 'The tax is four points.',
      note: 'And it is a consequence of the training, which means it is something the training can be made to avoid.',
    },
  },
  {
    id: 'sigmoid-loss',
    title: 'The sigmoid loss of one pair',
    latex: '\\mathcal{L}_{ij} = -\\log \\sigma\\!\\left(y_{ij}\\left(t\\,s_{ij} + b\\right)\\right) = \\log\\!\\left(1 + \\exp\\!\\left(-y_{ij}\\left(t\\,s_{ij} + b\\right)\\right)\\right)',
    reference: { source: 'Zhai et al. (2023)', location: 'Section 3.1', url: SIGLIP_URL },
    meaning:
      'Each pair is a yes-or-no question with its own loss. The sum over the batch is the objective, and no term in it contains any other pair.',
    symbols: [
      { symbol: 's_{ij}', name: 'the similarity of image i and caption j', note: 'The dot product of the two embeddings, as in the contrastive loss.' },
      { symbol: 'y_{ij}', name: 'the label', note: '+1 on the diagonal, −1 everywhere else.' },
      { symbol: 't, b', name: 'the learned scale and bias', note: 'Both are trained; only their starting values are chosen.' },
      { symbol: '\\sigma', name: 'the logistic function', note: '1 / (1 + e^{-x}).' },
    ],
    assumptions: [
      'Every pair in the batch is treated as an independent decision, matched or not.',
    ],
    derivation: [
      'Write the probability that a pair is a match as σ(t·s + b), and that it is not as 1 minus that.',
      'The cross-entropy of the correct label is −log of that probability.',
      'With y = ±1 the two cases are one expression: −log σ(y(t·s + b)).',
      'Average over the B² pairs of the batch, and there is the objective.',
    ],
    example: {
      given: 'A pair with a similarity of 0, a scale of 10 and a bias of 0.',
      result: 'The loss is log 2 ≈ 0.693, whatever the label.',
      note: 'At zero the sigmoid is undecided, and the loss of a positive and a negative are the same.',
    },
  },
  {
    id: 'trainable-share',
    title: 'The trainable share of a frozen bridge',
    latex: '\\text{share} = \\frac{P_{\\text{bridge}}}{P_{\\text{bridge}} + P_{\\text{frozen}}}',
    reference: { source: 'Li et al. (2023)', location: 'Section 3.1', url: BLIP2_URL },
    meaning:
      'How much of the whole system is being trained. In a frozen bridge the denominator contains two large towers and the numerator is a small set of queries with their attention.',
    symbols: [
      { symbol: 'P_{\\text{bridge}}', name: 'the trainable parameters', note: 'The queries, the bridge’s attention, and the projection.' },
      { symbol: 'P_{\\text{frozen}}', name: 'the frozen parameters', note: 'The image encoder and the language model.' },
    ],
    assumptions: [
      'The encoder and the language model are frozen, so their parameters contribute to the count and not to the gradient.',
    ],
    derivation: [
      'Count the bridge: the queries, one attention block, and the projection into the language model.',
      'Count the two towers from their published sizes.',
      'The share is the first count divided by the sum.',
    ],
    example: {
      given: 'A bridge of width 64 with 16 queries and a 32,000-token vocabulary, between an 86M encoder and a 6.7B language model.',
      result: 'The bridge has about 2.07M parameters, and the share is about 0.03%.',
      note: 'The laboratory computes the same bill at any width, and the frozen side does not move.',
    },
  },
  {
    id: 'projection',
    title: 'The linear projection into the language model',
    latex: 'H = XW + b, \\qquad X \\in \\mathbb{R}^{N \\times d_v},\\ W \\in \\mathbb{R}^{d_v \\times d_l}',
    reference: { source: 'Liu et al. (2023)', location: 'Section 2', url: LLAVA_URL },
    meaning:
      'The learned map from a sequence of visual tokens to a sequence of tokens the language model can read. It changes the width of each token and leaves the number of tokens alone.',
    symbols: [
      { symbol: 'X', name: 'the visual tokens', note: 'N tokens, each of width d_v.' },
      { symbol: 'W', name: 'the projection matrix', note: 'd_v rows and d_l columns, trained.' },
      { symbol: 'b', name: 'the bias', note: 'One entry per language coordinate.' },
      { symbol: 'H', name: 'the projected tokens', note: 'N tokens, each of width d_l.' },
    ],
    assumptions: [
      'The encoder and the language model are frozen, so W and b are the only trained parameters of this path.',
    ],
    derivation: [
      'Each visual token is a vector of width d_v, and the language model expects a width of d_l.',
      'A linear map with d_v input coordinates and d_l output coordinates has d_v × d_l entries, plus d_l biases.',
      'Applying it to N tokens uses the same matrix N times, so the parameter count does not contain N.',
      'The output is N tokens of width d_l: the sequence length is unchanged.',
    ],
    example: {
      given: 'A vision width of 1,024, a language width of 4,096 and 576 visual tokens.',
      result: 'The projection has 1,024 × 4,096 + 4,096 = 4,198,400 parameters.',
      note: 'Projecting four tokens instead of 576 uses the same matrix, so the bill is unchanged.',
    },
  },
  {
    id: 'resampler',
    title: 'The resampler',
    latex: '\\mathrm{Resampler}(X) = \\mathrm{softmax}\\!\\left(\\frac{QK^{\\top}}{\\sqrt{d}}\\right)V',
    reference: { source: 'Alayrac et al. (2022)', location: 'Section 2', url: FLAMINGO_URL },
    meaning:
      'A fixed set of L latents queries a variable number of N visual tokens. The softmax rows are distributions over the tokens, and the output has one vector per latent.',
    symbols: [
      { symbol: 'Q', name: 'the latents', note: 'L rows of width d: the fixed side of the resampler.' },
      { symbol: 'K, V', name: 'the visual tokens', note: 'N rows of width d, produced by the frozen encoder.' },
      { symbol: 'L, N', name: 'the two lengths', note: 'The latents, which are fixed, and the tokens, which are not.' },
    ],
    assumptions: [
      'Each latent reads every token once: the attention is dense over the token sequence.',
    ],
    derivation: [
      'Score every latent against every token, scaled by 1/√d, and take a softmax along the tokens.',
      'Each row is a distribution over the N tokens, and each latent uses it to form one weighted sum.',
      'There are L rows, so the output has L vectors, whatever N was.',
      'The cross-attention costs L × N work for each dimension; attention over the raw tokens would cost N × N.',
    ],
    example: {
      given: 'L = 32 latents and N = 576 visual tokens.',
      result: 'The language model reads 32 vectors, and the cross-attention is 1/18 of the token-by-token alternative.',
      note: 'The bound is the number of latents; the image resolution only changes the tokens going in.',
    },
  },
]
