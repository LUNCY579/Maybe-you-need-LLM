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

const SAE_URL = 'https://arxiv.org/abs/2309.08600'
const CIRCUITS_URL = 'https://arxiv.org/abs/2304.14997'
const FRAMEWORK_URL = 'https://transformer-circuits.pub/2021/framework.html'
const INDUCTION_URL = 'https://arxiv.org/abs/2209.11895'

export const FORMULAS: FormulaEntry[] = [
  {
    id: 'toy-loss',
    title: 'The loss of one feature in the toy model',
    latex: '\\mathbb{E}\\big[(x_k - \\hat{x}_k)^2\\big] = 1 - 2\\lVert w_k\\rVert^2 + \\sum_m (w_k \\cdot w_m)^2',
    reference: { source: 'Cunningham et al. (2023)', location: 'The toy model of superposition', url: SAE_URL },
    meaning:
      'The expected squared error of reading feature k back out of the activation. The first two terms are the feature’s own signal; the sum is the interference from every other feature.',
    symbols: [
      { symbol: 'w_k', name: 'the model’s column for feature k', note: 'A vector in the model’s d-dimensional activation space.' },
      { symbol: '\\hat{x}_k = w_k \\cdot h', name: 'the readout', note: 'What the model recovers of feature k.' },
    ],
    assumptions: ['The features are independent with unit variance.'],
    derivation: [
      'The activation is h = Σ_m w_m x_m.',
      'The readout of feature k is therefore w_k·h = Σ_m (w_k·w_m) x_m.',
      'Expanding the squared error and using independence kills the cross terms.',
    ],
    example: {
      given: 'A model with two features on the same unit direction.',
      result: 'Each feature’s loss is 1 — it is perfectly corrupted by its neighbour.',
      note: 'And the interference term is exactly 1, which is the price of sharing.',
    },
  },
  {
    id: 'interference',
    title: 'The interference between two features',
    latex: 'I_{k} = I_k \\sum_{m \\neq k} (w_k \\cdot w_m)^2',
    reference: { source: 'This course', location: 'The superposition laboratory', url: SAE_URL },
    meaning:
      'What a feature pays for the company it keeps: the importance of feature k times the squared projection of every other feature onto its direction.',
    symbols: [{ symbol: 'I_k', name: 'the importance', note: 'How much the feature’s error counts for.' }],
    assumptions: ['The features are independent, so the interference terms add.'],
    derivation: [
      'Take the loss above and subtract the part of the sum that is the feature’s own signal.',
      'The remainder is the interference.',
    ],
    example: {
      given: 'Two features with importance 1 sharing a direction, with a squared projection of 0.25.',
      result: 'Each pays an interference of 0.25.',
      note: 'Which is the number the laboratory plots.',
    },
  },
  {
    id: 'sae-objective',
    title: 'The sparse autoencoder objective',
    latex: 'f = \\mathrm{ReLU}\\big(W_{\\text{enc}}(x - b_{\\text{pre}}) + b_{\\text{enc}}\\big), \\qquad \\hat{x} = W_{\\text{dec}} f + b_{\\text{pre}}, \\qquad \\mathcal{L} = \\lVert x - \\hat{x}\\rVert^2 + \\lambda \\lVert f\\rVert_1',
    reference: { source: 'Cunningham et al. (2023)', location: 'Section 2', url: SAE_URL },
    meaning:
      'Reconstruct the activation, and pay for every feature that is on. The second term is what makes the code sparse, and the sparsity is what makes the features interpretable.',
    symbols: [
      { symbol: 'W_{\\text{enc}}', name: 'the encoder', note: 'Dimensions × features; overcomplete, so there are more features than dimensions.' },
      { symbol: 'W_{\\text{dec}}', name: 'the decoder', note: 'Features × dimensions.' },
      { symbol: '\\lVert f\\rVert_1', name: 'the sparsity penalty', note: 'The sum of the code’s magnitudes.' },
    ],
    assumptions: ['The dictionary is overcomplete: more features than the activation has dimensions.'],
    derivation: [
      'Start from a plain autoencoder, which would find the identity map.',
      'Force the code to be sparse, so the only way to reconstruct is to find the underlying directions.',
      'The overcompleteness is what allows a sparse code to exist at all.',
    ],
    example: {
      given: 'λ = 0.05 and a code with three active features of magnitude 0.4 each.',
      result: 'The sparsity penalty is 0.05 × 1.2 = 0.06.',
      note: 'And the L0 is 3.',
    },
  },
  {
    id: 'explained-variance',
    title: 'Explained variance',
    latex: '\\mathrm{EV} = 1 - \\frac{\\mathbb{E}\\lVert x - \\hat{x}\\rVert^2}{\\mathrm{Var}(x)}',
    reference: { source: 'This course', location: 'The autoencoder laboratory', url: SAE_URL },
    meaning:
      'The fraction of the activation’s variance the reconstruction accounts for. A dictionary that explains the variance has not thrown the information away on the way to being sparse.',
    symbols: [{ symbol: '\\mathrm{Var}(x)', name: 'the activation variance', note: 'Around the mean of the activations.' }],
    assumptions: ['The reconstruction and the activation are on the same scale.'],
    derivation: [
      'The reconstruction error is the part of the activation the dictionary failed to capture.',
      'Divide by the total variance to get the fraction missed.',
    ],
    example: {
      given: 'A reconstruction error of 0.1 and an activation variance of 0.8.',
      result: 'EV = 1 − 0.125 = 0.875.',
      note: 'The dictionary kept seven eighths of the information.',
    },
  },
  {
    id: 'patch-effect',
    title: 'The effect of a patch',
    latex: '\\text{effect} = f_{\\text{patched}}(s) - f_{\\text{clean}}(s), \\qquad \\text{normalised effect} = \\frac{\\text{effect}}{\\text{effect of replacing the whole computation}}',
    reference: { source: 'Conmy et al. (2023)', location: 'Section 2.3', url: CIRCUITS_URL },
    meaning:
      'How far the output moved when one node’s activation was replaced, and that movement as a fraction of the largest movement a replacement could have caused.',
    symbols: [
      { symbol: 'f_{\\text{patched}}', name: 'the output after the patch', note: 'The model run with one activation replaced.' },
    ],
    assumptions: ['Everything except the patched node is the same in both runs.'],
    derivation: [
      'Run the model on the clean input and on the corrupted one.',
      'Replace the node’s activation in the clean run with the corrupted run’s value.',
      'The change in the output is the node’s causal effect.',
    ],
    example: {
      given: 'A patch that moves the output by 0.2, when a full replacement would move it by 0.5.',
      result: 'The normalised effect is 0.4.',
      note: 'The node accounts for 40% of the change.',
    },
  },
  {
    id: 'faithfulness',
    title: 'The faithfulness of a subgraph',
    latex: '\\text{faithfulness} = \\frac{\\left|f_{\\text{patched subgraph}}(s) - f_{\\text{clean}}(s)\\right|}{\\left|f_{\\text{corrupted}}(s) - f_{\\text{clean}}(s)\\right|}',
    reference: { source: 'Conmy et al. (2023)', location: 'Section 2.4', url: CIRCUITS_URL },
    meaning:
      'The fraction of the effect that a proposed circuit accounts for. A score of one means the graph is the whole story.',
    symbols: [
      { symbol: 'f_{\\text{patched subgraph}}', name: 'the output with the proposed graph patched', note: 'The output of the corrupted run with only the proposed graph’s nodes replaced.' },
      { symbol: 'f_{\\text{clean}}', name: 'the output of the clean run', note: 'The model’s behaviour on the uncorrupted input.' },
      { symbol: 'f_{\\text{corrupted}}', name: 'the output of the corrupted run', note: 'The largest change the model can be made to produce by this corruption.' },
    ],
    assumptions: ['The corruption is the same one used to find the graph.'],
    derivation: [
      'Patch every node in the proposed graph at once.',
      'Compare the output change with the change a full corruption produces.',
    ],
    example: {
      given: 'The graph accounts for 0.8 of a 1.0 effect.',
      result: 'The faithfulness is 0.8.',
      note: 'And 0.2 of the behaviour is still unexplained.',
    },
  },
  {
    id: 'participation-ratio',
    title: 'How many features a direction carries',
    latex: '\\mathrm{PR}_j = \\frac{\\left(\\sum_k W_{jk}^2\\right)^2}{\\sum_k W_{jk}^4}',
    reference: { source: 'This course', location: 'The superposition laboratory', url: SAE_URL },
    meaning:
      'The effective number of features sharing direction j. One means the direction is monosemantic; more than one means the model has superposed.',
    symbols: [{ symbol: 'W_{jk}', name: 'the weight of feature k on direction j', note: 'The magnitude of the feature’s column along that direction.' }],
    assumptions: ['The columns are the model’s, so the weights are the feature’s share of the direction.'],
    derivation: [
      'If the weights on a direction are equal, the ratio is the number of features.',
      'If one feature dominates, the ratio falls towards one.',
    ],
    example: {
      given: 'A direction with six features of equal weight.',
      result: 'The participation ratio is 6.',
      note: 'And a direction with one dominant feature is close to 1, whatever else is on it.',
    },
  },
  {
    id: 'residual-stream',
    title: 'The residual stream',
    latex: 'h_\\ell^{(i)} = h_{\\ell-1}^{(i)} + \\sum_{j \\in \\text{components at } \\ell} W^{out}_j h_{\\ell-1}^{(j)}',
    reference: { source: 'Elhage et al. (2021)', location: 'The residual stream', url: FRAMEWORK_URL },
    meaning:
      'The vector every component reads from and writes to. Because it is additive, a component can only add its contribution, and the set of contributions is the circuit.',
    symbols: [{ symbol: 'h_\\ell^{(i)}', name: 'the residual stream at layer ℓ', note: 'A vector in the model’s activation space.' }],
    assumptions: ['The architecture is a pre-norm transformer with additive components.'],
    derivation: [
      'Each component at a layer reads the stream and writes a contribution to it.',
      'The stream after the layer is the sum of the previous stream and those contributions.',
      'So a path through the network is a chain of such contributions.',
    ],
    example: {
      given: 'A layer with two attention heads and one feed-forward block.',
      result: 'Three contributions are summed into the stream.',
      note: 'A circuit is a small subset of those contributions and the paths between them.',
    },
  },
  {
    id: 'induction-attention',
    title: 'The induction head’s attention',
    latex: 'a_{i,j} = \\frac{\\exp\\!\\left(\\beta\\,\\mathbb{1}\\!\\left[t_{j-1} = t_i\\right]\\right)}{\\sum_{k=1}^{i} \\exp\\!\\left(\\beta\\,\\mathbb{1}\\!\\left[t_{k-1} = t_i\\right]\\right)}',
    reference: { source: 'Olsson et al. (2022)', location: 'Key Concepts: Induction Heads', url: INDUCTION_URL },
    meaning:
      'The attention of the induction head at position i. Its query is the current token; its key at position j is the token that came before j. Positions whose predecessor is the current token share the attention, and the value at those positions is copied.',
    symbols: [
      { symbol: 't_i', name: 'the token at position i', note: 'The query is the current token itself.' },
      { symbol: '\\beta', name: 'the inverse temperature', note: 'How sharply the head chooses between matches.' },
      { symbol: '\\mathbb{1}[\\cdot]', name: 'the indicator', note: 'One when the shifted key equals the current token, zero otherwise.' },
    ],
    assumptions: [
      'A previous-token head in the layer below has written each token’s predecessor into the position’s key.',
      'Attention is causal: position i can only attend to positions up to i, and position 0 has no predecessor to match.',
    ],
    derivation: [
      'The previous-token head writes t_{j-1} into the key at position j.',
      'The induction head scores each key by whether it equals the query t_i.',
      'The softmax turns those scores into attention weights, and the value at a matching position is the token that followed the previous occurrence.',
    ],
    example: {
      given: 'One matching position among six causal keys, at a temperature of 0.1.',
      result: 'The match receives 1 / (1 + 5e^{−10}) ≈ 0.99977 of the attention.',
      note: 'Which is why the laboratory’s fixed circuit is exact and its ablation is not.',
    },
  },
]
