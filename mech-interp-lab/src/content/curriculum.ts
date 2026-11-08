/**
 * The course curriculum.
 *
 * The primary source is
 *
 *   H. Cunningham, A. Ewart, L. Riggs, R. Huben, L. Sharkey,
 *   "Sparse Autoencoders Find Highly Interpretable Features in Language Models",
 *   arXiv:2309.08600 [cs.LG] / ICLR 2024.
 *
 * Two further papers carry the rest of the course:
 *
 *   A. Conmy, A. N. Mavor-Parker, A. Lynch, S. Heimersheim, A. Garriga-Alonso,
 *   "Towards Automated Circuit Discovery for Mechanistic Interpretability",
 *   arXiv:2304.14997 [cs.LG];
 *
 *   N. Elhage et al., "A Mathematical Framework for Transformer Circuits",
 *   transformer-circuits.pub.
 *
 * The composition module adds two more:
 *
 *   C. Olsson et al., "In-context Learning and Induction Heads",
 *   arXiv:2209.11895 [cs.LG];
 *
 *   K. Wang, A. Variengien, A. Conmy, B. Shlegeris, J. Steinhardt,
 *   "Interpretability in the Wild: a Circuit for Indirect Object Identification
 *   in GPT-2 small", arXiv:2211.00593 [cs.LG].
 *
 * The section map below is built from those works, and the test suite
 * refuses a lesson that cites a section which is not in it.
 */

import type { LessonMeta, ModuleMeta, SourceRef } from '@llm-materials/course-core'

export type { LessonMeta, ModuleMeta, SourceRef }

export const SOURCES = {
  sae: {
    id: 'cunningham-2023-sae',
    title: 'Sparse Autoencoders Find Highly Interpretable Features in Language Models',
    authors: 'Hoagy Cunningham, Aidan Ewart, Logan Riggs, Robert Huben, Lee Sharkey',
    year: 2023,
    venue: 'arXiv:2309.08600 [cs.LG] / ICLR 2024',
    url: 'https://arxiv.org/abs/2309.08600',
  },
  circuits: {
    id: 'conmyer-2023-circuits',
    title: 'Towards Automated Circuit Discovery for Mechanistic Interpretability',
    authors: 'Arthur Conmy, Augustine N. Mavor-Parker, Aengus Lynch, Stefan Heimersheim, Adrià Garriga-Alonso',
    year: 2023,
    venue: 'arXiv:2304.14997 [cs.LG]',
    url: 'https://arxiv.org/abs/2304.14997',
  },
  framework: {
    id: 'elhage-2021-framework',
    title: 'A Mathematical Framework for Transformer Circuits',
    authors: 'Noah Elhage, Tristan Hume, Shan Carter, Scott Ostheim, Scott Linderman and others',
    year: 2021,
    venue: 'transformer-circuits.pub — a public web publication',
    url: 'https://transformer-circuits.pub/2021/framework.html',
  },
  induction: {
    id: 'olsson-2022-induction-heads',
    title: 'In-context Learning and Induction Heads',
    authors: 'Catherine Olsson, Nelson Elhage, Neel Nanda, Nicholas Joseph, Nova DasSarma and others',
    year: 2022,
    venue: 'arXiv:2209.11895 [cs.LG]',
    url: 'https://arxiv.org/abs/2209.11895',
  },
  ioi: {
    id: 'wang-2022-ioi',
    title: 'Interpretability in the Wild: a Circuit for Indirect Object Identification in GPT-2 small',
    authors: 'Kevin Wang, Alexandre Variengien, Arthur Conmy, Buck Shlegeris, Jacob Steinhardt',
    year: 2022,
    venue: 'arXiv:2211.00593 [cs.LG] / ICLR 2023',
    url: 'https://arxiv.org/abs/2211.00593',
  },
} as const

/** The section map of the sources this course cites. */
export const SECTION_MAP: Record<string, { title: string; note: string }> = {
  'sae:1': { title: 'Introduction', note: 'The problem: a neuron responds to several things, and a feature is not a neuron.' },
  'sae:2': { title: 'Taking Features out of Superposition with Sparse Dictionary Learning', note: 'The sparse autoencoder: the encoder, the decoder, and the sparsity penalty.' },
  'sae:3': { title: 'Interpreting Dictionary Features', note: 'How a dictionary feature is scored for interpretability, and at scale.' },
  'sae:3.1': { title: 'Interpretability at Scale', note: 'The automated scoring of a feature by asking a model to explain it.' },
  'sae:3.2': { title: 'Sparse dictionary features are more interpretable than baselines', note: 'The comparison against the neurons the dictionary replaces.' },
  'sae:4': { title: 'Identifying Causally-Important Dictionary Features', note: 'Adapting activation patching to dictionary features.' },
  'sae:5': { title: 'Case Studies', note: 'Input, output and intermediate features, in practice.' },
  'sae:6': { title: 'Discussion', note: 'The limitations, and what the method does not establish.' },
  'sae:6.2': { title: 'Limitations and Future Work', note: 'What the paper is explicit about not claiming.' },
  'circuits:1': { title: 'Introduction', note: 'The goal: a causal account of what a model computes.' },
  'circuits:2': { title: 'The Mechanistic Interpretability Workflow', note: 'The four steps: select a behaviour, divide the model into a graph, patch, and explain.' },
  'circuits:2.2': { title: 'Step 2: Divide the neural network into a graph of smaller units', note: 'Why a circuit is a graph of components, and what a component is.' },
  'circuits:2.3': { title: 'Step 3: Patch model activations to isolate the relevant subgraph', note: 'The intervention that turns a correlation into a cause.' },
  'circuits:2.4': { title: 'Explaining the circuit components', note: 'What a finished explanation has to contain.' },
  'circuits:3': { title: 'Automating circuit discovery (Step 3)', note: 'The attribution-patching algorithm and its cost.' },
  'circuits:4': { title: 'Evaluating Subgraph Recovery Algorithms', note: 'How a circuit-discovery method is scored against a hand-built one.' },
  'framework:1': { title: 'The Residual Stream', note: 'The computational graph a transformer induces, and the vocabulary of paths, weights and nodes.' },
  'induction:intro': { title: 'Introduction', note: 'Induction heads complete [A][B] … [A] with [B], and the hypothesis that they carry most in-context learning.' },
  'induction:key-concepts': { title: 'Key Concepts: In-context Learning and Induction Heads', note: 'What in-context learning is, and the two-head circuit — a previous-token head and an induction head in composition.' },
  'induction:phase-change': { title: 'Looking at the Phase Change More Closely', note: 'The loss bump during training, where induction heads form and in-context learning appears at the same moment.' },
  'induction:reverse-engineering': { title: 'Summary of Reverse Engineering Induction Heads', note: 'The mechanism, stated as a circuit: keys from the previous token, matched against the current one, values copied.' },
  'ioi:2.1': { title: 'Circuits and Knockouts', note: 'What a circuit is in this paper, and the knockout that tests whether a component belongs to it.' },
  'ioi:3.1': { title: 'Which heads directly affect the output? (Name Mover Heads)', note: 'The heads that write the answer token into the output, found by direct ablation.' },
  'ioi:3.2': { title: 'Which heads affect the Name Mover Heads’ attention? (S-Inhibition Heads)', note: 'The heads upstream of the name movers: they decide which name is copied.' },
  'ioi:4.1': { title: 'Completeness', note: 'How much of the behaviour the proposed circuit accounts for.' },
  'ioi:4.2': { title: 'Minimality', note: 'Whether every part of the circuit is needed, and what removing one costs.' },
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'superposition',
    chapter: 2,
    title: 'Superposition',
    tagline: 'Why a dimension has to hold more than one thing',
    summary:
      'When a model has fewer dimensions than the features it wants to represent, something has to give. This module builds the toy model in which that something is computable, and measures the interference that follows.',
    accent: 'indigo',
    outcomes: [
      'State the linear toy model and the loss it optimises',
      'Compute the interference between two features that share a direction',
      'Explain what the importance threshold is and why it exists',
    ],
  },
  {
    id: 'features',
    chapter: 2,
    title: 'Features, Not Neurons',
    tagline: 'A neuron is a mixture; a feature is not',
    summary:
      'The central observation of mechanistic interpretability: individual neurons are polysemantic, and the features a model represents do not line up with the neurons it uses to represent them. This module unpacks that, and builds the tool that fixes it.',
    accent: 'teal',
    outcomes: [
      'Explain polysemanticity and why it is a problem',
      'Write the sparse autoencoder and its objective',
      'Measure the sparsity, the reconstruction and the interpretability of a dictionary',
    ],
  },
  {
    id: 'patching',
    chapter: 2,
    title: 'Patching',
    tagline: 'From what a neuron responds to, to what it does',
    summary:
      'A correlational claim about a neuron is cheap; a causal one is not. This module covers the intervention that distinguishes them, and the measurement that comes with it.',
    accent: 'amber',
    outcomes: [
      'Describe activation patching and what it establishes',
      'Compute the effect of patching a node, and the normalised effect',
      'Define the faithfulness of a proposed circuit',
    ],
  },
  {
    id: 'circuits',
    chapter: 2,
    title: 'Circuits',
    tagline: 'An explanation that accounts for the behaviour',
    summary:
      'The workflow the circuit-discovery paper lays out: choose a behaviour, divide the model into components, find the ones that matter, and explain them. This module puts the pieces in order and says what each one buys.',
    accent: 'emerald',
    outcomes: [
      'State the four steps of the mechanistic-interpretability workflow',
      'Explain what a node, an edge and a path are in a transformer',
      'Argue for a behavioural explanation over a correlational one',
      'Split one head’s QK and OV circuits, and one pathway into the terms that make it up',
      'Say what an automated circuit search is scored against, and what it can get wrong',
    ],
  },
  {
    id: 'composition',
    chapter: 1,
    title: 'Composition',
    tagline: 'One head shifts the keys; another completes the pattern',
    summary:
      'A single attention head can only match what is written at a position. Most of what a transformer does happens because one head’s output becomes another head’s input. This module builds the clearest example — the induction circuit — and then the largest hand-built circuit in the literature, where the same logic is followed through a whole model.',
    accent: 'rose',
    outcomes: [
      'Describe the two-head induction circuit and what each head contributes',
      'Measure the accuracy of the composed circuit, and the effect of removing its first head',
      'Explain completeness and minimality as tests of a circuit, not of a story',
    ],
  },
]

export const LESSONS: LessonMeta[] = [
  {
    id: 'the-toy-model',
    moduleId: 'superposition',
    number: 1,
    title: 'The toy model',
    subtitle: 'A model with fewer dimensions than features',
    minutes: 24,
    objectives: [
      'Write the linear toy model and the loss it minimises',
      'Derive the expected squared error of one feature',
      'Explain what the interference term is',
    ],
    keyIdeas: [
      'The loss of one feature is 1 − 2‖w_k‖² + Σ_m (w_k·w_m)².',
      'When the columns are orthonormal, what is left is pure interference.',
      'Interference is the price of putting two features in one direction.',
    ],
    interactive: {
      lab: 'superposition',
      view: 'model',
      title: 'Fit the model',
      description: 'Fit the toy model at a given number of dimensions and read the interference.',
    },
    prerequisites: [],
    glossaryTerms: ['superposition', 'interference', 'importance'],
    quizIds: ['q-superposition-1', 'q-superposition-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'sae:2',
        title: 'Taking Features out of Superposition with Sparse Dictionary Learning',
        page: 2,
        note: 'The toy model of superposition that the sparse-autoencoder paper is built on, and the interference it costs.',
      },
    ],
    furtherReading: [
      {
        label: 'A Mathematical Framework for Transformer Circuits',
        href: 'https://transformer-circuits.pub/2021/framework.html',
        note: 'The vocabulary of the residual stream, nodes, edges and paths.',
      },
    ],
  },
  {
    id: 'the-importance-threshold',
    moduleId: 'superposition',
    number: 2,
    title: 'The importance threshold',
    subtitle: 'When a feature is not worth representing',
    minutes: 20,
    objectives: [
      'Explain why the model drops some features and keeps others',
      'Measure the threshold at which a feature starts to be represented',
      'Say what happens to the interference as the tail is dropped',
    ],
    keyIdeas: [
      'Hosting a feature costs the host; dropping it costs the feature itself.',
      'The threshold is where those two prices cross.',
      'A power law of importances produces a sharp threshold.',
    ],
    interactive: {
      lab: 'superposition',
      view: 'threshold',
      title: 'Find the threshold',
      description: 'Sweep a feature’s importance and watch the model decide whether to keep it.',
    },
    prerequisites: ['the-toy-model'],
    glossaryTerms: ['importance', 'interference', 'polysemanticity'],
    quizIds: ['q-superposition-3', 'q-threshold-drops'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'sae:2',
        title: 'Taking Features out of Superposition with Sparse Dictionary Learning',
        page: 3,
        note: 'The importance threshold, and the argument that the tail of the importance distribution is not worth representing.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'polysemanticity',
    moduleId: 'features',
    number: 3,
    title: 'Polysemanticity',
    subtitle: 'Why a neuron is not a feature',
    minutes: 20,
    objectives: [
      'Define polysemanticity',
      'Explain why superposition makes it unavoidable',
      'Say what a monosemantic feature would look like',
    ],
    keyIdeas: [
      'A neuron that responds to several things is polysemantic.',
      'Superposition makes polysemantic neurons the cheap option.',
      'A feature is a thing the model represents, not a neuron it represents it with.',
    ],
    interactive: {
      lab: 'superposition',
      view: 'load',
      title: 'How many features per direction',
      description: 'Count how many features each direction is carrying.',
    },
    prerequisites: ['the-importance-threshold'],
    glossaryTerms: ['polysemanticity', 'monosemanticity', 'feature'],
    quizIds: ['q-features-1', 'q-poly-why'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'sae:1',
        title: 'Introduction',
        page: 1,
        note: 'The problem: a neuron responds to several things, and the features a model represents are not the neurons it uses.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-sparse-autoencoder',
    moduleId: 'features',
    number: 4,
    title: 'The sparse autoencoder',
    subtitle: 'Asking for a sparse code',
    minutes: 24,
    objectives: [
      'Write the encoder, the decoder and the objective of a sparse autoencoder',
      'Explain what the sparsity penalty is for',
      'Measure the reconstruction, the sparsity and the explained variance',
    ],
    keyIdeas: [
      'The autoencoder asks for a code that is sparse and reconstructs.',
      'The L1 penalty is what makes the code sparse.',
      'A dictionary feature that activates for one thing is interpretable.',
    ],
    interactive: {
      lab: 'autoencoder',
      view: 'train',
      title: 'Train the autoencoder',
      description: 'Train a real sparse autoencoder on a real residual stream and watch it find features.',
    },
    prerequisites: ['polysemanticity'],
    glossaryTerms: ['sparse-autoencoder', 'dictionary-feature', 'l0', 'explained-variance'],
    quizIds: ['q-features-2', 'q-features-3'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'sae:2',
        title: 'Taking Features out of Superposition with Sparse Dictionary Learning',
        page: 4,
        note: 'The encoder, the decoder, the sparsity penalty, and the objective.',
      },
      {
        chapter: 3,
        section: 'sae:3',
        title: 'Interpreting Dictionary Features',
        page: 5,
        note: 'How a dictionary feature is scored, and the comparison against the neurons it replaces.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'activation-patching',
    moduleId: 'patching',
    number: 5,
    title: 'Activation patching',
    subtitle: 'The intervention that makes a claim causal',
    minutes: 24,
    objectives: [
      'Describe activation patching and what it establishes',
      'Compute the effect of patching a node and the normalised effect',
      'Explain why a self-consistent model is not an explanation',
    ],
    keyIdeas: [
      'Run the model twice, and replace one activation in one of the runs.',
      'If the output moves, that node was causally responsible for the move.',
      'Correlational evidence survives the patch; causal evidence does not.',
    ],
    interactive: {
      lab: 'patching',
      view: 'effect',
      title: 'Patch a node',
      description: 'Patch each node in turn and read the effect on the output.',
    },
    prerequisites: ['polysemanticity'],
    glossaryTerms: ['activation-patching', 'causal', 'attribution'],
    quizIds: ['q-patching-1', 'q-patching-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'circuits:2.3',
        title: 'Step 3: Patch model activations to isolate the relevant subgraph',
        page: 3,
        note: 'The intervention, and what it rules out.',
      },
      {
        chapter: 4,
        section: 'sae:4',
        title: 'Identifying Causally-Important Dictionary Features',
        page: 8,
        note: 'Adapting the patching procedure to dictionary features.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-workflow',
    moduleId: 'circuits',
    number: 6,
    title: 'The workflow',
    subtitle: 'Four steps, and what each one is for',
    minutes: 20,
    objectives: [
      'State the four steps of the mechanistic-interpretability workflow',
      'Say what a node, an edge and a path are in a transformer',
      'Argue for a behavioural explanation over a correlational one',
    ],
    keyIdeas: [
      'Choose a behaviour, divide the model into a graph, patch, and explain.',
      'A node is a component that does one thing; an edge is a causal influence.',
      'A finished explanation accounts for the behaviour, not for a correlation.',
    ],
    interactive: {
      lab: 'patching',
      view: 'workflow',
      title: 'The circuit',
      description: 'The graph of nodes and edges, with the attribution on each.',
    },
    prerequisites: ['activation-patching'],
    glossaryTerms: ['circuit', 'node', 'path', 'faithfulness'],
    quizIds: ['q-circuits-1', 'q-circuits-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'circuits:2',
        title: 'The Mechanistic Interpretability Workflow',
        page: 2,
        note: 'The four steps, in order, and why each one is needed.',
      },
      {
        chapter: 2,
        section: 'circuits:2.2',
        title: 'Step 2: Divide the neural network into a graph of smaller units',
        page: 3,
        note: 'The graph, and the vocabulary of components.',
      },
      {
        chapter: 2,
        section: 'circuits:2.4',
        title: 'Explaining the circuit components',
        page: 4,
        note: 'What a finished explanation has to contain.',
      },
      {
        chapter: 4,
        section: 'circuits:4',
        title: 'Evaluating Subgraph Recovery Algorithms',
        page: 9,
        note: 'How a discovery method is scored against a hand-built circuit.',
      },
    ],
    furtherReading: [
      {
        label: 'A Mathematical Framework for Transformer Circuits',
        href: 'https://transformer-circuits.pub/2021/framework.html',
        note: 'The residual stream, the nodes, the edges and the paths.',
      },
    ],
  },
  {
    id: 'induction-heads',
    moduleId: 'composition',
    number: 7,
    title: 'Induction heads',
    subtitle: 'The smallest circuit that is more than one head',
    minutes: 26,
    objectives: [
      'Describe the induction algorithm: [A][B] … [A] predicts [B]',
      'Explain what the previous-token head contributes to the second head',
      'Measure the accuracy of the composed circuit, and of the ablation',
    ],
    keyIdeas: [
      'An induction head matches the current token against the token that came before each earlier position, then copies the token after the match.',
      'The previous-token head is what shifts the keys: without it, the second head can only find the current token itself.',
      'The paper’s causal test is an ablation, and in the laboratory the ablation takes the accuracy to zero while the fixed circuit is exact.',
    ],
    interactive: {
      lab: 'induction',
      view: 'circuit',
      title: 'Complete the pattern',
      description: 'A hand-wired two-head circuit on a repeated sequence, with both attention patterns and the ablation.',
    },
    prerequisites: ['the-workflow'],
    glossaryTerms: ['induction-head', 'previous-token-head', 'composition', 'in-context-learning'],
    quizIds: ['q-induction-1', 'q-induction-2', 'q-induction-3'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'induction:key-concepts',
        title: 'Key Concepts: In-context Learning and Induction Heads',
        page: 4,
        note: 'The [A][B] … [A] definition, and the two heads that implement it.',
      },
      {
        chapter: 1,
        section: 'induction:reverse-engineering',
        title: 'Summary of Reverse Engineering Induction Heads',
        page: 26,
        note: 'The mechanism stated as a circuit: shifted keys, matched queries, copied values.',
      },
      {
        chapter: 1,
        section: 'induction:phase-change',
        title: 'Looking at the Phase Change More Closely',
        page: 13,
        note: 'Induction heads forming at the same moment in-context learning appears.',
      },
    ],
    furtherReading: [
      {
        label: 'In-context Learning and Induction Heads',
        href: 'https://arxiv.org/abs/2209.11895',
        note: 'The six lines of evidence, of which the ablation is the causal one.',
      },
      {
        label: 'A Mathematical Framework for Transformer Circuits',
        href: 'https://transformer-circuits.pub/2021/framework.html',
        note: 'The composition of heads that makes the circuit possible.',
      },
    ],
  },
  {
    id: 'the-ioi-circuit',
    moduleId: 'composition',
    number: 8,
    title: 'The IOI circuit',
    subtitle: 'A whole behaviour, reverse-engineered',
    minutes: 26,
    objectives: [
      'Explain how the name-mover heads and the S-inhibition heads divide the work',
      'Say what completeness and minimality measure, and why both are needed',
      'Describe what the circuit leaves unexplained',
    ],
    keyIdeas: [
      'The circuit has 26 attention heads in seven classes: some move the name, and some decide which name is moved.',
      'Completeness asks how much of the behaviour the circuit accounts for; minimality asks whether every part of it is needed.',
      'The paper’s own evaluation finds the explanation supported and incomplete at the same time — which is what an honest circuit looks like.',
    ],
    interactive: {
      lab: 'ioi',
      view: 'steps',
      title: 'Run the four steps',
      description:
        'The paper’s own procedure — direct effects, then path patches into the movers’ circuits, then one layer down, then the two criteria — run on a hand-wired circuit with four heads, on the paper’s prompt and on the mirrored one.',
    },
    prerequisites: ['induction-heads'],
    glossaryTerms: ['name-mover-head', 's-inhibition-head', 'completeness', 'minimality'],
    quizIds: ['q-ioi-1', 'q-ioi-2'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'ioi:3.1',
        title: 'Which heads directly affect the output? (Name Mover Heads)',
        page: 5,
        note: 'The heads that write the answer, found by ablating heads one at a time.',
      },
      {
        chapter: 3,
        section: 'ioi:3.2',
        title: 'Which heads affect the Name Mover Heads’ attention? (S-Inhibition Heads)',
        page: 6,
        note: 'The upstream heads that decide which name is copied.',
      },
      {
        chapter: 4,
        section: 'ioi:4.1',
        title: 'Completeness',
        page: 9,
        note: 'How much of the behaviour the circuit reproduces.',
      },
      {
        chapter: 4,
        section: 'ioi:4.2',
        title: 'Minimality',
        page: 10,
        note: 'Whether every component in the circuit is doing necessary work.',
      },
    ],
    furtherReading: [
      {
        label: 'Interpretability in the Wild',
        href: 'https://arxiv.org/abs/2211.00593',
        note: 'The 26-head circuit, and the three criteria it is evaluated by.',
      },
      {
        label: 'Towards Automated Circuit Discovery',
        href: 'https://arxiv.org/abs/2304.14997',
        note: 'The automated procedure that this circuit was a target for.',
      },
    ],
  },

  /*
   * The two lessons that turn the case studies around and read them as methods.
   * Lessons 1 to 8 build the phenomena. These two ask what the reading of a single
   * head actually consists of, and then what a search that reads heads by itself has
   * to be graded against — which is what the last three laboratories answer with
   * computed numbers rather than with a description.
   */
  {
    id: 'the-qk-and-ov-circuits',
    moduleId: 'circuits',
    number: 9,
    title: 'The QK and OV circuits',
    subtitle: 'One head, two matrices, and an exact split of what it contributes',
    minutes: 24,
    objectives: [
      'Factor one attention head into the circuit that chooses a position and the circuit that writes from it',
      'State the pathway decomposition of a last-layer head and why it is an identity rather than an approximation',
      'Explain why a head in an earlier layer has no such split, and what can be measured instead',
      'Describe what path patching asks that component patching cannot',
    ],
    keyIdeas: [
      'A head is four matrices and two products: W_QᵀW_K decides where it looks, W_OW_V decides what it writes when it gets there.',
      'A last-layer head’s effect on a logit difference is exactly the sum over source positions of attention times the write that position is worth — so the decomposition can be checked against an ablation to machine precision.',
      'A composed head’s QK circuit is a property of the path into it, which is why the induction circuit cannot be read off either head alone.',
    ],
    interactive: {
      lab: 'attention',
      view: 'pathway',
      title: 'Decompose a pathway',
      description:
        'Pick a head and a position, and read the head’s whole contribution as one term per source position, next to the ablation that has to equal it.',
    },
    prerequisites: ['the-workflow', 'induction-heads'],
    glossaryTerms: ['residual-stream', 'qk-circuit', 'ov-circuit', 'path', 'path-patching'],
    quizIds: ['q-framework-1', 'q-framework-2'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'framework:1',
        title: 'The Residual Stream',
        page: 1,
        note: 'The computational graph a transformer induces, and the factorisation of a head into a QK and an OV circuit.',
      },
      {
        chapter: 5,
        section: 'induction:reverse-engineering',
        title: 'Summary of Reverse Engineering Induction Heads',
        page: 26,
        note: 'The composed circuit those two circuits are read in, on a model whose wiring is known.',
      },
    ],
    furtherReading: [
      {
        label: 'A Mathematical Framework for Transformer Circuits',
        href: 'https://transformer-circuits.pub/2021/framework.html',
        note: 'The QK/OV vocabulary, the path expansion, and the composition of heads.',
      },
    ],
  },
  {
    id: 'automating-the-search',
    moduleId: 'circuits',
    number: 10,
    title: 'Automating the search',
    subtitle: 'Edge attribution, pruning, and what a discovered circuit is graded against',
    minutes: 22,
    objectives: [
      'Define the attribution score of an edge and say why it is marginal rather than intrinsic',
      'Describe the prune-and-rescore loop and the threshold it stops at',
      'State faithfulness and completeness as two different failures',
      'Explain why a hand-wired circuit is the only honest ground truth for a discovery algorithm',
    ],
    keyIdeas: [
      'An edge’s score is what the current graph loses when that edge is deleted, so an edge can look essential only because its partner is in the graph — which is why the search re-scores everything at every step.',
      'A graph can be faithful without being complete, or complete without being faithful: one names a route that carries the behaviour on its own, the other names everything the behaviour cannot do without.',
      'On a random model the strongest available claim is that the numbers are self-consistent. On a model wired by hand the search’s answer is a test.',
    ],
    interactive: {
      lab: 'circuit',
      view: 'prune',
      title: 'Prune a graph down to a circuit',
      description:
        'Score every edge, delete the weakest, and watch faithfulness and completeness fall — then compare what the search reports against the four edges the wiring needs, from two different corruptions.',
    },
    prerequisites: ['the-workflow', 'the-qk-and-ov-circuits'],
    glossaryTerms: ['circuit', 'node', 'edge-attribution', 'faithfulness', 'acdc', 'completeness'],
    quizIds: ['q-circuits-3', 'q-circuits-4'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'circuits:3',
        title: 'Automating circuit discovery (Step 3)',
        page: 3,
        note: 'The attribution-patching loop, its cost, and the threshold it stops at.',
      },
      {
        chapter: 4,
        section: 'circuits:4',
        title: 'Evaluating Subgraph Recovery Algorithms',
        page: 9,
        note: 'How a discovery method is scored — against a hand-built circuit, on tasks where the answer is known.',
      },
    ],
    furtherReading: [
      {
        label: 'Towards Automated Circuit Discovery for Mechanistic Interpretability',
        href: 'https://arxiv.org/abs/2304.14997',
        note: 'ACDC, and the two criteria the pruned graphs are graded on.',
      },
    ],
  },
]

export function lessonsOfModule(moduleId: string): LessonMeta[] {

  return LESSONS.filter((lesson) => lesson.moduleId === moduleId).sort((a, b) => a.number - b.number)
}

export function lessonById(id: string): LessonMeta | undefined {
  return LESSONS.find((lesson) => lesson.id === id)
}

export function moduleById(id: string): ModuleMeta | undefined {
  return MODULES.find((module) => module.id === id)
}
