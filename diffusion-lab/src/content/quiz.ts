/**
 * The assessment bank.
 *
 * Questions are written for this course, are answerable from the lessons, and
 * carry an explanation and a source citation. The numeric questions have
 * tolerances tight enough that a plausible guess fails: the exact integers
 * accept no tolerance at all.
 */

import type { QuizQuestion } from '@llm-materials/course-core'

export type { QuizQuestion }

const DDPM = { label: 'Ho, Jain & Abbeel (2020)' }
const CFG = { label: 'Ho & Salimans (2022)' }
const LDM = { label: 'Rombach et al. (2022)' }
const EDM = { label: 'Karras et al. (2022)' }
const DDIM = { label: 'Song, Meng & Ermon (2021)' }

export const QUIZ: QuizQuestion[] = [
  /* ------------------------------------------------------------------ forward */
  {
    id: 'q-forward-1',
    kind: 'multiple-choice',
    prompt: 'Which part of a diffusion model has learnable parameters?',
    topic: 'The forward process',
    difficulty: 'warmup',
    options: [
      { id: 'a', label: 'The forward process', feedback: 'The forward process is fixed: it has no learnable parameters at all.' },
      { id: 'b', label: 'The reverse process', feedback: 'Correct — the reverse process mean is produced by the network.' },
      { id: 'c', label: 'The variance schedule', feedback: 'The schedule is a choice, not a parameter, in the original paper.' },
      { id: 'd', label: 'The prior', feedback: 'The prior is the fixed standard normal.' },
    ],
    correctOptionId: 'b',
    explanation:
      'The forward process and the schedule are fixed by hand. Everything the model learns lives in the reverse process, whose mean is a function of the noisy state and the timestep.',
    citation: DDPM,
    lessonId: 'what-is-a-diffusion',
  },
  {
    id: 'q-forward-2',
    kind: 'boolean',
    prompt: 'The forward process gradually destroys the information in the data.',
    topic: 'The forward process',
    difficulty: 'warmup',
    truth: true,
    explanation:
      'Yes. The signal-to-noise ratio falls monotonically, and by the last step the state is essentially the prior, carrying almost no information about the data.',
    citation: DDPM,
    lessonId: 'what-is-a-diffusion',
  },
  {
    id: 'q-forward-3',
    kind: 'multiple-choice',
    prompt: 'The closed form q(x_t | x_0) has the form x_t = √ᾱ_t · x_0 + √(1 − ᾱ_t) · ε. What is ε?',
    topic: 'The closed form',
    difficulty: 'warmup',
    options: [
      { id: 'a', label: 'A standard normal vector', feedback: 'Correct: ε ~ N(0, I), drawn fresh at every training step.' },
      { id: 'b', label: 'The previous state x_{t−1}', feedback: 'x_{t−1} appears in the one-step transition, not in the closed form.' },
      { id: 'c', label: 'A learnable parameter', feedback: 'The noise is not learned; it is sampled.' },
      { id: 'd', label: 'The posterior mean', feedback: 'The posterior mean is a function of x_t and x_0, not the noise itself.' },
    ],
    correctOptionId: 'a',
    explanation:
      'ε is a standard normal draw, and it is the same vector that the network is trained to predict. That is the whole trick: the target of the training objective is a random vector the model never has to see.',
    citation: DDPM,
    lessonId: 'the-closed-form',
  },
  {
    id: 'q-forward-4',
    kind: 'numeric',
    prompt:
      'With the paper’s linear schedule, β goes from 10⁻⁴ to 0.02 over 1000 steps. What is β at the first step?',
    topic: 'The closed form',
    difficulty: 'core',
    answer: 0.0001,
    tolerance: 0,
    unit: 'β_1',
    explanation:
      'β_1 = 10⁻⁴ exactly. The schedule is linear in the step index, so the first and last values are the endpoints of the range.',
    citation: DDPM,
    lessonId: 'the-closed-form',
  },
  {
    id: 'q-forward-5',
    kind: 'multiple-choice',
    prompt: 'Why does the paper need q(x_{t−1} | x_t, x_0) to have a closed form?',
    topic: 'The posterior',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'So every KL term in the bound can be computed between two Gaussians', feedback: 'Correct.' },
      { id: 'b', label: 'So the sampling can be done in one step', feedback: 'Sampling still needs T reverse steps.' },
      { id: 'c', label: 'So the model does not need a network', feedback: 'The reverse process absolutely needs a network.' },
      { id: 'd', label: 'So the data can be scaled to [−1, 1]', feedback: 'That scaling is a separate choice, about the decoder.' },
    ],
    correctOptionId: 'a',
    explanation:
      'The variational bound is a sum of KL divergences between the true posterior and the model’s reverse transition. If both are Gaussian, each term has a closed form instead of a high-variance Monte Carlo estimate.',
    citation: DDPM,
    lessonId: 'the-posterior',
  },

  /* ------------------------------------------------------------------ reverse */
  {
    id: 'q-reverse-1',
    kind: 'multiple-choice',
    prompt: 'With the ε-prediction parameterisation, the network is trained to predict…',
    topic: 'The training objective',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'the clean sample x_0', feedback: 'That is the x₀-prediction parameterisation, which the paper found worse.' },
      { id: 'b', label: 'the noise ε that was added', feedback: 'Correct.' },
      { id: 'c', label: 'the posterior mean μ̃_t', feedback: 'That is the baseline parameterisation the paper compared against.' },
      { id: 'd', label: 'the reverse variance σ_t', feedback: 'The variance is fixed, not learned, in the paper’s setup.' },
    ],
    correctOptionId: 'b',
    explanation:
      'Predicting ε makes the bound resemble denoising score matching and makes the sampler resemble Langevin dynamics. Both facts are the paper’s stated reasons for preferring it.',
    citation: DDPM,
    lessonId: 'the-objective',
  },
  {
    id: 'q-reverse-2',
    kind: 'numeric',
    prompt:
      'In the simplified objective the weight on the loss is exactly what value at every timestep?',
    topic: 'The training objective',
    difficulty: 'core',
    answer: 1,
    tolerance: 0,
    explanation:
      'Exactly 1. The true bound weights the loss by β_t² / (2 σ_t² α_t (1 − ᾱ_t)); the simplified objective replaces that whole factor with 1, which is why it down-weights small t so dramatically.',
    citation: DDPM,
    lessonId: 'the-objective',
  },
  {
    id: 'q-reverse-3',
    kind: 'multiple-choice',
    prompt: 'Which statement about the three parameterisations is true?',
    topic: 'Parameterisations',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'They define three different reverse processes', feedback: 'No: they describe the same reverse process, only the network target changes.' },
      { id: 'b', label: 'They describe the same reverse process but train the network on different targets', feedback: 'Correct.' },
      { id: 'c', label: 'Only ε-prediction is mathematically valid', feedback: 'All three are valid reparameterisations of the same process.' },
      { id: 'd', label: 'x₀-prediction is always better', feedback: 'The paper reports the opposite for sample quality.' },
    ],
    correctOptionId: 'b',
    explanation:
      'The three parameterisations are algebraically equivalent views of p_θ(x_{t−1}|x_t). What changes is the regression target, and therefore how stable training is and how the loss is weighted.',
    citation: DDPM,
    lessonId: 'parameterisations',
  },
  {
    id: 'q-reverse-4',
    kind: 'numeric',
    prompt:
      'Sampling with T = 1000 steps needs one network evaluation per step. How many network evaluations does a single sample cost?',
    topic: 'Sampling',
    difficulty: 'warmup',
    answer: 1000,
    tolerance: 0,
    explanation:
      'Exactly 1000. This is the cost the paper notes it shares with earlier work, and it is the reason every later improvement in this area is about taking fewer steps.',
    citation: DDPM,
    lessonId: 'sampling',
  },
  {
    id: 'q-reverse-5',
    kind: 'multiple-choice',
    prompt: 'What does a deterministic sampler change?',
    topic: 'Sampling',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'It removes the fresh noise, so the same start gives the same sample', feedback: 'Correct.' },
      { id: 'b', label: 'It removes the network from the loop', feedback: 'The network is still evaluated at every step.' },
      { id: 'c', label: 'It replaces the variance schedule with a learned one', feedback: 'That is an independent change.' },
      { id: 'd', label: 'It trains the model with a different objective', feedback: 'A deterministic sampler is a change to sampling, not to training.' },
    ],
    correctOptionId: 'a',
    explanation:
      'DDIM removes the fresh noise at each step, turning the reverse chain into a probability-flow ODE. The same latent then always gives the same sample, which is what allows the number of steps to be cut without collapsing diversity.',
    citation: DDIM,
    lessonId: 'sampling',
  },

  /* ------------------------------------------------------------------ schedules */
  {
    id: 'q-schedules-1',
    kind: 'multiple-choice',
    prompt: 'What does the variance schedule control?',
    topic: 'Schedules',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'How much noise each step adds, and therefore the whole signal-to-noise trajectory', feedback: 'Correct.' },
      { id: 'b', label: 'The size of the network', feedback: 'The network is chosen independently of the schedule.' },
      { id: 'c', label: 'The learning rate', feedback: 'The schedule and the learning rate are separate choices.' },
      { id: 'd', label: 'The resolution of the images', feedback: 'Resolution is fixed before the schedule is chosen.' },
    ],
    correctOptionId: 'a',
    explanation:
      'The schedule determines ᾱ_t at every step, and therefore the signal-to-noise ratio, the terminal KL divergence, and the weighting of the training objective.',
    citation: DDPM,
    lessonId: 'the-schedule',
  },
  {
    id: 'q-schedules-2',
    kind: 'numeric',
    prompt:
      'The paper quotes a terminal KL divergence of about 10⁻⁵ bits per dimension for its linear schedule. Roughly how many bits per dimension is that, in scientific notation?',
    topic: 'Schedules',
    difficulty: 'hard',
    answer: 0.00001,
    tolerance: 0.0000001,
    explanation:
      '10⁻⁵ bits per dimension. The point of the number is that x_T is, for every practical purpose, indistinguishable from the prior — which is what lets the sampler start from pure noise.',
    citation: DDPM,
    lessonId: 'the-schedule',
  },
  {
    id: 'q-schedules-3',
    kind: 'multiple-choice',
    prompt: 'Dropping the weight from the true variational bound has which effect?',
    topic: 'Schedules',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'Small t are effectively ignored, because the true weight there is enormous', feedback: 'Correct.' },
      { id: 'b', label: 'Large t are ignored', feedback: 'The opposite: the true weight is tiny at large t, so dropping it *raises* their contribution.' },
      { id: 'c', label: 'The objective becomes a different likelihood bound', feedback: 'It remains a bound, but a differently weighted one.' },
      { id: 'd', label: 'Nothing changes, because the weight is constant', feedback: 'The weight varies by orders of magnitude across t.' },
    ],
    correctOptionId: 'a',
    explanation:
      'The true weight β_t²/(2σ_t²α_t(1−ᾱ_t)) is very large at small t and very small at large t. Flattening it to 1 therefore removes most of the gradient signal from the easy, small-t end of the chain — which the paper reports improves sample quality.',
    citation: DDPM,
    lessonId: 'the-weighting',
  },

  /* ------------------------------------------------------------------ latent */
  {
    id: 'q-latent-1',
    kind: 'multiple-choice',
    prompt: 'Why does latent diffusion use an autoencoder at all?',
    topic: 'Latent diffusion',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'The diffusion runs on far fewer elements, so it is much cheaper', feedback: 'Correct.' },
      { id: 'b', label: 'The autoencoder makes the images sharper', feedback: 'Sharpness comes from the diffusion model, not the autoencoder.' },
      { id: 'c', label: 'It removes the need for a variance schedule', feedback: 'The schedule is still needed in latent space.' },
      { id: 'd', label: 'It allows the model to be trained on text', feedback: 'Conditioning is a separate mechanism entirely.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Compressing by a factor f reduces the number of elements by roughly 1/f² and the attention cost by roughly 1/f⁴, because attention is quadratic in the number of tokens.',
    citation: LDM,
    lessonId: 'latent-space',
  },
  {
    id: 'q-latent-2',
    kind: 'numeric',
    prompt:
      'An autoencoder compresses a 256×256 image with 3 channels by a factor of 8, to 4 latent channels. By what factor is the number of elements the diffusion model works on reduced?',
    topic: 'Latent diffusion',
    difficulty: 'hard',
    answer: 48,
    tolerance: 0,
    explanation:
      'The image has 256×256×3 = 196,608 elements; the latent has 32×32×4 = 4,096. The reduction factor is 48. The attention saving is larger still, because it is quadratic in the token count.',
    citation: LDM,
    lessonId: 'latent-space',
  },

  /* ------------------------------------------------------------------ guidance */
  {
    id: 'q-guidance-1',
    kind: 'multiple-choice',
    prompt: 'The classifier-free guided score is s_uncond + w · (s_cond − s_uncond). What does w = 0 give?',
    topic: 'Guidance',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'The unconditional score', feedback: 'Correct.' },
      { id: 'b', label: 'The conditional score', feedback: 'That is w = 1.' },
      { id: 'c', label: 'A score of zero', feedback: 'The score is not zero; the guidance term is.' },
      { id: 'd', label: 'The posterior mean', feedback: 'Unrelated to the score.' },
    ],
    correctOptionId: 'a',
    explanation:
      'At w = 0 the guidance term vanishes and the sampler is unconditional. At w = 1 the guided score is exactly the conditional score.',
    citation: CFG,
    lessonId: 'classifier-free-guidance',
  },
  {
    id: 'q-guidance-2',
    kind: 'multiple-choice',
    prompt: 'What does a large guidance weight do to the samples?',
    topic: 'Guidance',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'They cluster more tightly on the mode that matches the condition', feedback: 'Correct: sharper, but less diverse.' },
      { id: 'b', label: 'They spread out to cover the tail of the distribution', feedback: 'The opposite happens.' },
      { id: 'c', label: 'They become noisier', feedback: 'Guidance sharpens; it does not add noise.' },
      { id: 'd', label: 'They become independent of the condition', feedback: 'That is w = 0.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Guidance tilts the distribution by p(c|x)^w, which sharpens the conditional but suppresses everything else. The result is better prompt adherence and worse coverage — the classic fidelity–diversity trade-off.',
    citation: CFG,
    lessonId: 'the-price-of-guidance',
  },
  {
    id: 'q-guidance-3',
    kind: 'numeric',
    prompt:
      'A guided model samples from a distribution proportional to p(x) · p(c | x)^w. For what value of w is this distribution exactly p(x | c)?',
    topic: 'Guidance',
    difficulty: 'hard',
    answer: 1,
    tolerance: 0,
    explanation:
      'w = 1. Since p(x)·p(c|x) = p(x|c)·p(c), and p(c) is a constant, the tilted distribution is proportional to the true conditional. Any w above 1 over-shoots it.',
    citation: CFG,
    lessonId: 'classifier-free-guidance',
  },

  /* ------------------------------------------------------------------ design */
  {
    id: 'q-design-1',
    kind: 'multiple-choice',
    prompt: 'What is preconditioning for?',
    topic: 'The design space',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'Deciding how the loss at one noise level counts against the others', feedback: 'Correct.' },
      { id: 'b', label: 'Choosing the number of sampling steps', feedback: 'That is a sampling decision, made afterwards.' },
      { id: 'c', label: 'Rescaling the data to [−1, 1]', feedback: 'That is the data scaling of §3.3.' },
      { id: 'd', label: 'Making the network smaller', feedback: 'Preconditioning is a loss weighting, not an architecture change.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Different noise levels have different intrinsic difficulty and different signal-to-noise ratios, so a single unweighted loss trains them badly. Preconditioning is the per-level weight that fixes this.',
    citation: EDM,
    lessonId: 'the-design-space',
  },
  {
    id: 'q-design-2',
    kind: 'numeric',
    prompt:
      'A sampler takes 50 steps out of a chain of length 1000. How many network evaluations does one sample cost?',
    topic: 'The design space',
    difficulty: 'core',
    answer: 50,
    tolerance: 0,
    explanation:
      'Exactly 50. The number of steps is the only thing that matters for sampling cost, which is why deterministic samplers that can be run in few steps matter so much.',
    citation: DDIM,
    lessonId: 'the-design-space',
  },
  {
    id: 'q-design-3',
    kind: 'multi-select',
    prompt: 'Which of these are choices the original paper leaves fixed rather than learned?',
    topic: 'The design space',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'The variance schedule β', feedback: 'Correct: fixed to a linear ramp in the paper.' },
      { id: 'b', label: 'The reverse process variance σ_t', feedback: 'Correct: fixed to β_t or β̃_t, and the paper reports that learning it destabilises training.' },
      { id: 'c', label: 'The reverse process mean', feedback: 'That one is learned, through the network.' },
      { id: 'd', label: 'The number of steps T', feedback: 'Correct: T = 1000 throughout the experiments.' },
    ],
    correctOptionIds: ['a', 'b', 'd'],
    explanation:
      'Only the reverse mean is learned. The paper fixes the schedule, the reverse variance and the chain length, and its ablation shows that learning the variance makes training unstable and samples worse.',
    citation: DDPM,
    lessonId: 'the-design-space',
  },
]
