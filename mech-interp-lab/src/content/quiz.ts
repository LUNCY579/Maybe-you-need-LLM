/**
 * The assessment bank.
 */

import type { QuizQuestion } from '@llm-materials/course-core'

export type { QuizQuestion }

const SAE = { label: 'Cunningham et al. (2023)' }
const CIRCUITS = { label: 'Conmy et al. (2023)' }
const INDUCTION = { label: 'Olsson et al. (2022)' }
const FRAMEWORK = { label: 'Elhage et al. (2021)' }
const IOI = { label: 'Wang et al. (2022)' }
const COURSE = { label: 'This course' }

export const QUIZ: QuizQuestion[] = [
  { id: 'q-superposition-1', kind: 'multiple-choice', prompt: 'What does superposition force a model to do?', topic: 'The toy model', difficulty: 'core', options: [
    { id: 'a', label: 'Pack several features into one direction', feedback: 'Correct.' },
    { id: 'b', label: 'Drop the features it cannot represent', feedback: 'It may drop them, but only when their importance is low enough.' },
    { id: 'c', label: 'Make the features more important', feedback: 'Importance is a property of the data, not of the model.' },
    { id: 'd', label: 'Use more dimensions', feedback: 'The number of dimensions is given.' },
  ], correctOptionId: 'a', explanation: 'With fewer dimensions than features, the columns cannot all be orthogonal, so some features share a direction and interfere with each other.', citation: SAE, lessonId: 'the-toy-model' },
  { id: 'q-superposition-2', kind: 'numeric', prompt: 'Two features share a direction, and the squared projection of one onto the other is 0.25. What is the interference term in the loss?', topic: 'The toy model', difficulty: 'core', answer: 0.25, tolerance: 0, explanation: 'The cross term is (w_i·w_j)², so the interference is the square of the projection: 0.25.', citation: COURSE, lessonId: 'the-toy-model' },
  { id: 'q-superposition-3', kind: 'multiple-choice', prompt: 'Why does a model drop some features?', topic: 'The importance threshold', difficulty: 'hard', options: [
    { id: 'a', label: 'Because hosting them would cost the host more than dropping them costs them', feedback: 'Correct.' },
    { id: 'b', label: 'Because they do not fit', feedback: 'The model is not constrained to represent every feature.' },
    { id: 'c', label: 'Because they are noisy', feedback: 'Noise is not what the threshold is about.' },
    { id: 'd', label: 'It never does', feedback: 'It does, and the threshold is the point where it starts.' },
  ], correctOptionId: 'a', explanation: 'Hosting a feature costs the host the interference; dropping it costs the feature its own importance. The threshold is where those cross.', citation: SAE, lessonId: 'the-importance-threshold' },
  { id: 'q-features-1', kind: 'boolean', prompt: 'A neuron in a superposed model is usually polysemantic.', topic: 'Polysemanticity', difficulty: 'core', truth: true, explanation: 'Yes. Superposition is what makes it cheap for one neuron to respond to several things, so polysemantic neurons are the cheap option rather than a failure.', citation: SAE, lessonId: 'polysemanticity' },
  { id: 'q-features-2', kind: 'multiple-choice', prompt: 'What is the L1 penalty in a sparse autoencoder for?', topic: 'The sparse autoencoder', difficulty: 'core', options: [
    { id: 'a', label: 'To make the code sparse', feedback: 'Correct.' },
    { id: 'b', label: 'To make the reconstruction better', feedback: 'The squared error does that.' },
    { id: 'c', label: 'To make the dictionary larger', feedback: 'No.' },
    { id: 'd', label: 'To make the training faster', feedback: 'No.' },
  ], correctOptionId: 'a', explanation: 'The L1 term penalises the number of active features, and the sparsity is what makes a dictionary feature correspond to one thing.', citation: SAE, lessonId: 'the-sparse-autoencoder' },
  { id: 'q-features-3', kind: 'numeric', prompt: 'A sparse autoencoder reconstructs activations with a mean squared error of 0.1, and the activations have variance 0.8. What is the explained variance?', topic: 'The sparse autoencoder', difficulty: 'hard', answer: 0.875, tolerance: 0.001, explanation: '1 − 0.1/0.8 = 0.875. The dictionary has kept most of the information.', citation: COURSE, lessonId: 'the-sparse-autoencoder' },
  { id: 'q-patching-1', kind: 'multiple-choice', prompt: 'What does activation patching establish?', topic: 'Activation patching', difficulty: 'core', options: [
    { id: 'a', label: 'That a node is causally responsible for a change in the output', feedback: 'Correct.' },
    { id: 'b', label: 'That a node responds to a particular input', feedback: 'That is a correlational claim, and it is much cheaper.' },
    { id: 'c', label: 'That the model has understood the input', feedback: 'Far more than a patch can show.' },
    { id: 'd', label: 'That a node is important', feedback: 'Importance is a matter of degree; causality is a matter of kind.' },
  ], correctOptionId: 'a', explanation: 'You run the model twice, replace one activation in one of the runs, and look at what moves. If the output changes, the node was responsible for it.', citation: CIRCUITS, lessonId: 'activation-patching' },
  { id: 'q-patching-2', kind: 'boolean', prompt: 'A model with a perfect self-consistency score can still be wrong about what it is doing.', topic: 'Activation patching', difficulty: 'hard', truth: true, explanation: 'Yes. Self-consistency is a correlational property; a model can be perfectly self-consistent and implement a mechanism that does not explain the behaviour.', citation: CIRCUITS, lessonId: 'activation-patching' },
  { id: 'q-circuits-1', kind: 'multiple-choice', prompt: 'What are the four steps of the mechanistic-interpretability workflow?', topic: 'The workflow', difficulty: 'core', options: [
    { id: 'a', label: 'Select a behaviour, divide the model into a graph, patch to isolate the subgraph, and explain the components', feedback: 'Correct.' },
    { id: 'b', label: 'Collect data, train a probe, read the probe, write it up', feedback: 'That is the probing approach, and it is correlational.' },
    { id: 'c', label: 'Find the neurons, find the features, find the data, find the answer', feedback: 'Not the workflow.' },
    { id: 'd', label: 'Prune, retrain, compare, publish', feedback: 'An ablation, not an explanation.' },
  ], correctOptionId: 'a', explanation: 'The order matters: a behaviour first, so that the explanation is of something the model actually does.', citation: CIRCUITS, lessonId: 'the-workflow' },
  { id: 'q-circuits-2', kind: 'multiple-choice', prompt: 'In a transformer, what is the natural unit of a circuit node?', topic: 'The workflow', difficulty: 'hard', options: [
    { id: 'a', label: 'An attention head or a feed-forward block, reading from and writing to the residual stream', feedback: 'Correct.' },
    { id: 'b', label: 'A single weight', feedback: 'Too fine to be a component that does one thing.' },
    { id: 'c', label: 'A whole layer', feedback: 'Too coarse; a layer usually does several things.' },
    { id: 'd', label: 'A training example', feedback: 'Not part of the model.' },
  ], correctOptionId: 'a', explanation: 'The natural decomposition is the one the architecture gives you: the components that write to the residual stream, and the causal influences between them.', citation: COURSE, lessonId: 'the-workflow' },
  { id: 'q-induction-1', kind: 'multiple-choice', prompt: 'What does the previous-token head contribute to the induction circuit?', topic: 'Induction heads', difficulty: 'core', options: [
    { id: 'a', label: 'It shifts the keys, so the second head can match the current token against what came before each position', feedback: 'Correct.' },
    { id: 'b', label: 'It copies the answer token into the output', feedback: 'That is the induction head’s value, not the first head’s.' },
    { id: 'c', label: 'It suppresses the wrong answer', feedback: 'That is the role of the S-inhibition heads in the IOI circuit.' },
    { id: 'd', label: 'It decides when to stop attending', feedback: 'There is no such decision in the circuit.' },
  ], correctOptionId: 'a', explanation: 'The first head writes each token’s predecessor into the position’s key. The induction head then matches the current token against that shifted content; without the shift, it can only find the current token itself.', citation: INDUCTION, lessonId: 'induction-heads' },
  { id: 'q-induction-2', kind: 'boolean', prompt: 'An induction head with no previous-token head can still find the token that followed the previous occurrence.', topic: 'Induction heads', difficulty: 'hard', truth: false, explanation: 'Without the shift, its keys are the tokens themselves, so it matches the earlier occurrence of the current token and copies that token — not the one that followed it. The laboratory’s ablation measures exactly this collapse.', citation: INDUCTION, lessonId: 'induction-heads' },
  { id: 'q-induction-3', kind: 'numeric', prompt: 'A block of 6 distinct tokens is repeated 3 times. How many positions have a next token and an earlier occurrence to match?', topic: 'Induction heads', difficulty: 'hard', answer: 11, tolerance: 0, explanation: 'There are 18 positions. The first copy’s 6 positions have no earlier occurrence, and the last position of the third copy has no next token, so 18 − 6 − 1 = 11.', citation: COURSE, lessonId: 'induction-heads' },
  { id: 'q-ioi-1', kind: 'multiple-choice', prompt: 'What does minimality measure about a proposed circuit?', topic: 'The IOI circuit', difficulty: 'core', options: [
    { id: 'a', label: 'Whether every component in it is needed for the behaviour', feedback: 'Correct.' },
    { id: 'b', label: 'Whether it explains the whole behaviour', feedback: 'That is completeness.' },
    { id: 'c', label: 'Whether it is smaller than a baseline circuit', feedback: 'Size is not the criterion; necessity is.' },
    { id: 'd', label: 'Whether its components are attention heads', feedback: 'Not what the test asks.' },
  ], correctOptionId: 'a', explanation: 'Minimality removes components and checks the behaviour survives. Completeness asks how much is explained; minimality asks whether each part is doing work.', citation: IOI, lessonId: 'the-ioi-circuit' },
  { id: 'q-ioi-2', kind: 'boolean', prompt: 'A circuit that passes completeness and minimality is therefore a complete account of how the model does the task.', topic: 'The IOI circuit', difficulty: 'hard', truth: false, explanation: 'No. The paper reports its explanation as supported by both criteria and still incomplete: the criteria constrain the circuit, they do not prove that nothing else is involved.', citation: IOI, lessonId: 'the-ioi-circuit' },
  { id: 'q-framework-1', kind: 'multiple-choice', prompt: 'What does a head’s QK circuit decide, and what does its OV circuit decide?', topic: 'The QK and OV circuits', difficulty: 'core', options: [
    { id: 'a', label: 'QK decides which positions the head looks at; OV decides what it writes once it has looked', feedback: 'Correct.' },
    { id: 'b', label: 'QK decides the layer, OV decides the head', feedback: 'Neither product chooses where in the model a head sits.' },
    { id: 'c', label: 'QK decides what is written, OV decides what is attended to', feedback: 'That is the pair the other way round.' },
    { id: 'd', label: 'Both describe the attention pattern, in different bases', feedback: 'Then nothing would ever be written back to the stream.' },
  ], correctOptionId: 'a', explanation: 'W_Qᵀ W_K and W_O W_V are two separate d_model × d_model products that factor out of the head, and that factorisation is what lets you patch a head through one circuit input of another head instead of through the head as a whole.', citation: FRAMEWORK, lessonId: 'the-qk-and-ov-circuits' },
  { id: 'q-framework-2', kind: 'boolean', prompt: 'Splitting a last-layer head’s effect on the metric into per-position terms is an approximation that leaves a few percent unexplained.', topic: 'The QK and OV circuits', difficulty: 'hard', truth: false, explanation: 'No. The head’s output is a sum over source positions and the readout is linear, so the split is an identity: in the laboratory the sum of the terms equals the ablation’s effect and the discrepancy column is driven below 1e-12 by a test. A head in an *earlier* layer has no such split, because its effect runs through the softmax of the layer above.', citation: FRAMEWORK, lessonId: 'the-qk-and-ov-circuits' },
  { id: 'q-circuits-3', kind: 'multiple-choice', prompt: 'Why does an ACDC-style search re-score every remaining edge at every step?', topic: 'Automated circuit discovery', difficulty: 'core', options: [
    { id: 'a', label: 'Because an edge’s score is its contribution to the graph it is currently in, so deleting one edge changes what the others are worth', feedback: 'Correct.' },
    { id: 'b', label: 'Because the metric is stochastic and needs averaging', feedback: 'Nothing here is sampled; the same graph gives the same numbers.' },
    { id: 'c', label: 'Because the model is retrained between steps', feedback: 'No weight moves. Only the graph shrinks.' },
    { id: 'd', label: 'Because scores have to increase monotonically', feedback: 'They do not, and that is not the reason.' },
  ], correctOptionId: 'a', explanation: 'A key path and the query path that reads it only work together: each looks essential while both are present, and one becomes free the moment the other goes. A single ranking would delete the wrong edge first.', citation: CIRCUITS, lessonId: 'automating-the-search' },
  { id: 'q-circuits-4', kind: 'boolean', prompt: 'A pruned graph that is faithful but not complete names every component the behaviour depends on.', topic: 'Automated circuit discovery', difficulty: 'hard', truth: false, explanation: 'No. Faithfulness says the graph reproduces the behaviour on its own; completeness says nothing outside it is needed. A faithful-but-incomplete graph is an explanation that still leans on a component it has never named — which is why the two criteria are reported as a pair.', citation: CIRCUITS, lessonId: 'automating-the-search' },
  {
    id: 'q-threshold-drops',
    kind: 'multiple-choice',
    prompt: 'A feature sits below the importance threshold the model enforces. What happens to it, and to the interference?',
    topic: 'The importance threshold',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'The feature is represented more sharply, and interference rises', feedback: 'The opposite: below the threshold the feature is the one that goes.' },
      { id: 'b', label: 'The model drops the feature, and the interference it was causing goes with it', feedback: 'Correct — dropping the tail is what the threshold is for.' },
      { id: 'c', label: 'The feature stays but its direction is rotated away from the others', feedback: 'Rotation is superposition\u2019s trick for kept features; the dropped ones simply go.' },
      { id: 'd', label: 'The threshold rises to keep the feature', feedback: 'The threshold is set by the importance distribution, not by any one feature.' },
    ],
    correctOptionId: 'b',
    explanation:
      'When a feature is not worth representing, the model drops it — and the interference it was contributing goes with it. The threshold is measurable: it is where a feature starts being worth a direction of its own.',
    citation: SAE,
    lessonId: 'the-importance-threshold',
  },
  {
    id: 'q-poly-why',
    kind: 'multiple-choice',
    prompt: 'Why does superposition make polysemantic neurons unavoidable rather than accidental?',
    topic: 'Polysemanticity',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'Because neurons are randomly initialised', feedback: 'Initialisation washes out in training; the economics stay.' },
      {
        id: 'b',
        label: 'Because representing more features than there are directions is the cheap option, and sharing directions is how that is done',
        feedback: 'Correct — polysemanticity is the visible cost of superposition.',
      },
      { id: 'c', label: 'Because models are trained on too little data', feedback: 'More data does not remove the pressure to share.' },
      { id: 'd', label: 'Because ReLU units cannot represent negatives', feedback: 'The phenomenon appears across activations.' },
    ],
    correctOptionId: 'b',
    explanation:
      'A model has more features worth representing than directions to put them in. Superposition — several nearly-orthogonal directions packed into one space — is the cheap way out, and a neuron that responds to several things is what that looks like from outside. A monosemantic neuron is the luxury the width has to pay for.',
    citation: SAE,
    lessonId: 'polysemanticity',
  },
]
