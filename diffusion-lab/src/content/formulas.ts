/**
 * The equation reference.
 *
 * Every entry carries the equation as printed, where it comes from, what it
 * means in plain language, every symbol, the assumptions it rests on, a
 * derivation, and a worked example with the numbers substituted.
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

const DDPM_URL = 'https://arxiv.org/abs/2006.11239'
const LDM_URL = 'https://arxiv.org/abs/2112.10752'
const EDM_URL = 'https://arxiv.org/abs/2206.00364'
const CFG_URL = 'https://arxiv.org/abs/2207.12598'
const DDIM_URL = 'https://arxiv.org/abs/2010.02502'

export const FORMULAS: FormulaEntry[] = [
  {
    id: 'forward-step',
    title: 'The one-step forward transition',
    latex: 'q(\\mathbf{x}_t \\mid \\mathbf{x}_{t-1}) = \\mathcal{N}\\!\\left(\\mathbf{x}_t;\\, \\sqrt{\\alpha_t}\\,\\mathbf{x}_{t-1},\\, \\beta_t \\mathbf{I}\\right), \\qquad \\alpha_t = 1 - \\beta_t',
    reference: { source: 'Ho, Jain & Abbeel (2020)', location: 'Equation 2, §2', url: DDPM_URL },
    meaning:
      'Each forward step keeps a scaled version of the current state and adds a small amount of Gaussian noise. The scale √α_t shrinks the state so that the total variance stays at one.',
    symbols: [
      { symbol: '\\mathbf{x}_t', name: 'state at step t', note: 'The same dimensionality as the data.' },
      { symbol: '\\alpha_t', name: 'signal scale', note: '1 − β_t; the fraction of variance kept.' },
      { symbol: '\\beta_t', name: 'noise scale', note: 'The variance added at this step.' },
      { symbol: '\\mathbf{I}', name: 'identity', note: 'Noise is added independently in every dimension.' },
    ],
    assumptions: [
      'The noise added is isotropic: the same variance in every dimension.',
      'The step is Markov: x_t depends on x_{t−1} only.',
    ],
    derivation: [
      'Write x_t = √α_t · x_{t−1} + √β_t · z with z ~ N(0, I).',
      'If x_{t−1} has variance v, then x_t has variance α_t·v + β_t.',
      'Choosing α_t + β_t = 1 keeps the total variance constant, whatever v was.',
    ],
    example: {
      given: 'β_t = 0.01, so α_t = 0.99, and x_{t−1} = 2.',
      result: 'The mean of x_t is √0.99 · 2 ≈ 1.990, and its variance is 0.01.',
      note: 'The state is nearly unchanged, and the tiny variance of 0.01 is the noise that was added.',
    },
  },
  {
    id: 'closed-form',
    title: 'The closed form for any timestep',
    latex: 'q(\\mathbf{x}_t \\mid \\mathbf{x}_0) = \\mathcal{N}\\!\\left(\\mathbf{x}_t;\\, \\sqrt{\\bar{\\alpha}_t}\\,\\mathbf{x}_0,\\, (1 - \\bar{\\alpha}_t)\\mathbf{I}\\right), \\qquad \\bar{\\alpha}_t = \\prod_{s=1}^{t} \\alpha_s',
    reference: { source: 'Ho, Jain & Abbeel (2020)', location: 'Equation 4, §2', url: DDPM_URL },
    meaning:
      'The state at any step is a scaled copy of the data plus a scaled copy of a single noise vector. One draw of ε and one multiplication give you any timestep you like.',
    symbols: [
      { symbol: '\\bar{\\alpha}_t', name: 'cumulative signal', note: 'The product of the α_s up to t; the fraction of the original signal still present.' },
      { symbol: '\\sqrt{1-\\bar{\\alpha}_t}', name: 'noise scale', note: 'Grows as the signal shrinks.' },
    ],
    assumptions: [
      'The per-step noises are independent, so their variances add.',
      'A sum of independent zero-mean Gaussians is Gaussian.',
    ],
    derivation: [
      'Substituting the one-step transition repeatedly gives x_t = (∏α_s)·x_0 + Σ terms involving the noises.',
      'The variance of the sum is Σ β_s ∏_{r>s} α_r, which telescopes to 1 − ∏ α_s.',
      'The mean is (∏ α_s)·x_0 = √ᾱ_t · x_0 because ∏ α_s = √(∏ α_s²) and ᾱ_t = ∏ α_s.',
    ],
    example: {
      given: 'A linear schedule with β from 1e-4 to 0.02 over 1000 steps, at t = 500.',
      result: 'ᾱ_500 ≈ 0.078, so the state is 0.28·x_0 plus noise of standard deviation 0.96.',
      note: 'At the midpoint of the chain the signal is already smaller than the noise.',
    },
  },
  {
    id: 'snr',
    title: 'The signal-to-noise ratio',
    latex: '\\mathrm{SNR}(t) = \\frac{\\bar{\\alpha}_t}{1 - \\bar{\\alpha}_t}',
    reference: { source: 'Course term, used throughout the source', location: '§2, §4', url: DDPM_URL },
    meaning:
      'How much signal is left against how much noise was added. It is the single number that describes how corrupted the state is, and it is what a schedule is really choosing.',
    symbols: [
      { symbol: '\\bar{\\alpha}_t', name: 'cumulative signal', note: 'The variance fraction of the original data still present.' },
    ],
    assumptions: ['The data has unit variance, which is why the two terms can be compared directly.'],
    derivation: [
      'The signal contributes variance ᾱ_t · Var(x_0) and the noise contributes 1 − ᾱ_t.',
      'With Var(x_0) = 1 the ratio of the two is ᾱ_t / (1 − ᾱ_t).',
    ],
    example: {
      given: 'ᾱ_t = 0.5.',
      result: 'SNR = 1.',
      note: 'The signal and the noise are equally strong. Below this point the state is mostly noise.',
    },
  },
  {
    id: 'posterior',
    title: 'The posterior q(x_{t−1} | x_t, x_0)',
    latex: '\\tilde{\\boldsymbol{\\mu}}_t = \\frac{\\sqrt{\\bar{\\alpha}_{t-1}}\\,\\beta_t}{1-\\bar{\\alpha}_t}\\,\\mathbf{x}_0 + \\frac{\\sqrt{\\alpha_t}\\,(1-\\bar{\\alpha}_{t-1})}{1-\\bar{\\alpha}_t}\\,\\mathbf{x}_t, \\qquad \\tilde{\\beta}_t = \\frac{1-\\bar{\\alpha}_{t-1}}{1-\\bar{\\alpha}_t}\\,\\beta_t',
    reference: { source: 'Ho, Jain & Abbeel (2020)', location: 'Equation 7, §2', url: DDPM_URL },
    meaning:
      'Where the chain would have been one step earlier, given both the current state and the original data. It is a fixed linear combination of x_0 and x_t, and it is what the reverse process is trained to match.',
    symbols: [
      { symbol: '\\tilde{\\boldsymbol{\\mu}}_t', name: 'posterior mean', note: 'A convex combination of x_0 and x_t.' },
      { symbol: '\\tilde{\\beta}_t', name: 'posterior variance', note: 'Always at most β_t.' },
    ],
    assumptions: ['The forward process is Gaussian and the chain is Markov.'],
    derivation: [
      'Compute q(x_{t−1} | x_t, x_0) by Bayes’ rule, using the fact that q(x_{t−1} | x_t) is Gaussian by the Markov property.',
      'q(x_{t−1}|x_t) is the product of the one-step transitions from t−1 to t, so it is Gaussian.',
      'Substituting the closed form for x_t turns the result into a Gaussian in x_{t−1} with the mean and variance above.',
    ],
    example: {
      given: 'A schedule with ᾱ_{t−1} = 0.9, ᾱ_t = 0.8, α_t = 0.89, β_t = 0.11, and x_0 = 1, x_t = 0.',
      result: 'The weight on x_0 is 0.316 and the weight on x_t is 0.684, so the posterior mean is 0.316.',
      note: 'At this noise level the current state still carries most of the information about the previous one.',
    },
  },
  {
    id: 'variational-bound',
    title: 'The variational bound',
    latex: 'L = D_{\\mathrm{KL}}\\!\\left(q(\\mathbf{x}_T|\\mathbf{x}_0)\\,\\|\\,p(\\mathbf{x}_T)\\right) + \\sum_{t>1} D_{\\mathrm{KL}}\\!\\left(q(\\mathbf{x}_{t-1}|\\mathbf{x}_t,\\mathbf{x}_0)\\,\\|\\,p_\\theta(\\mathbf{x}_{t-1}|\\mathbf{x}_t)\\right) - \\log p_\\theta(\\mathbf{x}_0|\\mathbf{x}_1)',
    reference: { source: 'Ho, Jain & Abbeel (2020)', location: 'Equation 5, §2', url: DDPM_URL },
    meaning:
      'An upper bound on the negative log likelihood, with one KL term per step of the chain. Every term compares two Gaussians, so the whole bound is computable in closed form.',
    symbols: [
      { symbol: 'L_T', name: 'terminal term', note: 'Constant when the forward variances are fixed, so it can be ignored.' },
      { symbol: 'L_{t-1}', name: 'per-step term', note: 'The part that depends on θ.' },
      { symbol: 'L_0', name: 'decoder term', note: 'The likelihood of the data itself.' },
    ],
    assumptions: [
      'The reverse process is a Markov chain of Gaussians with fixed variances.',
      'The forward process is Gaussian, so its posteriors are Gaussian.',
    ],
    derivation: [
      'Write the negative log likelihood as a negative log of an expectation over the true posterior.',
      "Apply Jensen's inequality to move the expectation outside the logarithm.",
      'Substitute the definition of the forward and reverse posteriors and group the terms by the step.',
    ],
    example: {
      given: 'A schedule where the terminal KL is 2×10⁻⁵ nats and the per-step terms sum to 0.4 nats.',
      result: 'L ≈ 0.40002 nats.',
      note: 'The terminal term is negligible, which is exactly why the paper can ignore it during training.',
    },
  },
  {
    id: 'gaussian-kl',
    title: 'The KL between two univariate Gaussians',
    latex: 'D_{\\mathrm{KL}}\\!\\left(\\mathcal{N}(m_1, s_1^2)\\,\\|\\,\\mathcal{N}(m_2, s_2^2)\\right) = \\log\\frac{s_2}{s_1} + \\frac{s_1^2 + (m_1 - m_2)^2}{2 s_2^2} - \\frac{1}{2}',
    reference: { source: 'Standard result; used for every term of the bound', location: '§2, §3.2', url: DDPM_URL },
    meaning:
      'The closed form that makes the whole variational bound cheap. Every per-step term of the training objective is one of these, summed over dimensions.',
    symbols: [
      { symbol: 'm_1, m_2', name: 'means', note: 'The posterior mean and the model’s reverse mean.' },
      { symbol: 's_1, s_2', name: 'standard deviations', note: 'The posterior variance and the reverse variance.' },
    ],
    assumptions: ['Both distributions are univariate Gaussians; the multivariate case sums over independent dimensions.'],
    derivation: [
      'Substitute the two Gaussian densities into the definition of the KL divergence.',
      'The cross terms integrate to expressions involving the means and variances.',
      'Simplifying with E[x] = m and Var[x] = s² gives the formula.',
    ],
    example: {
      given: 'm_1 = 0, s_1 = 1, m_2 = 1, s_2 = 1.',
      result: 'KL = 0 + (1 + 1)/2 − 0.5 = 0.5 nats.',
      note: 'Two Gaussians with the same variance but means one unit apart are 0.5 nats apart.',
    },
  },
  {
    id: 'epsilon-parameterisation',
    title: 'The ε-prediction parameterisation',
    latex: '\\boldsymbol{\\mu}_\\theta(\\mathbf{x}_t, t) = \\frac{1}{\\sqrt{\\alpha_t}}\\left(\\mathbf{x}_t - \\frac{\\beta_t}{\\sqrt{1-\\bar{\\alpha}_t}}\\,\\boldsymbol{\\epsilon}_\\theta(\\mathbf{x}_t, t)\\right)',
    reference: { source: 'Ho, Jain & Abbeel (2020)', location: 'Equation 11, §3.2', url: DDPM_URL },
    meaning:
      'The reverse mean, written in terms of a network that predicts the noise. Everything else in the model follows from this one choice.',
    symbols: [
      { symbol: '\\boldsymbol{\\epsilon}_\\theta', name: 'the network', note: 'Takes the noisy state and the timestep, and predicts the noise that was added.' },
      { symbol: '\\beta_t / \\sqrt{1-\\bar{\\alpha}_t}', name: 'the conversion factor', note: 'How much the predicted noise moves the mean.' },
    ],
    assumptions: ['The reverse variance is fixed, so the mean is the only thing the network controls.'],
    derivation: [
      'Write the per-step bound term as a squared distance between the posterior mean and the model mean.',
      'Substitute x_t = √ᾱ_t x_0 + √(1−ᾱ_t) ε into the posterior mean.',
      'Solve for the model mean that makes the squared distance proportional to ‖ε − ε_θ‖².',
    ],
    example: {
      given: 'α_t = 0.99, β_t = 0.01, ᾱ_t = 0.5, x_t = 0.3, and the network predicts ε_θ = 0.1.',
      result: 'μ_θ = (0.3 − 0.01/√0.5 · 0.1)/√0.99 ≈ 0.2989.',
      note: 'The predicted noise moves the mean only slightly, because at this noise level the correction is small.',
    },
  },
  {
    id: 'simplified-loss',
    title: 'The simplified training objective',
    latex: 'L_{\\mathrm{simple}}(\\theta) \\coloneqq \\mathbb{E}_{t,\\mathbf{x}_0,\\boldsymbol{\\epsilon}}\\!\\left[\\left\\|\\boldsymbol{\\epsilon} - \\boldsymbol{\\epsilon}_\\theta\\!\\left(\\sqrt{\\bar{\\alpha}_t}\\,\\mathbf{x}_0 + \\sqrt{1-\\bar{\\alpha}_t}\\,\\boldsymbol{\\epsilon}, t\\right)\\right\\|^2\\right]',
    reference: { source: 'Ho, Jain & Abbeel (2020)', location: 'Equation 14, §3.4', url: DDPM_URL },
    meaning:
      'The objective the paper actually trains: an unweighted squared error on the noise, with the timestep drawn uniformly. It is the same learning problem, reweighted.',
    symbols: [
      { symbol: 't \\sim \\mathrm{Uniform}\\{1, \\dots, T\\}', name: 'the timestep', note: 'Uniform, not weighted by the bound.' },
      { symbol: '\\boldsymbol{\\epsilon}', name: 'the target', note: 'A fresh standard normal draw.' },
    ],
    assumptions: ['The forward variances are fixed, so the terminal term drops out.'],
    derivation: [
      'Start from the weighted form of the bound in equation 12.',
      'Observe that the weight is very large at small t and very small at large t.',
      'Replace the weight with 1, and note that the t = 1 case becomes the decoder term with a Gaussian approximation.',
    ],
    example: {
      given: 'A model whose predictions are off by 0.1 in each of 3 dimensions.',
      result: 'The per-example loss is 3 × 0.1² = 0.03.',
      note: 'The loss is a plain mean squared error on the noise vector.',
    },
  },
  {
    id: 'weight-ratio',
    title: 'The weight of the true bound',
    latex: 'w_t = \\frac{\\beta_t^2}{2\\,\\sigma_t^2\\,\\alpha_t\\,(1 - \\bar{\\alpha}_t)}',
    reference: { source: 'Ho, Jain & Abbeel (2020)', location: 'Equation 12, §3.2', url: DDPM_URL },
    meaning:
      'How much the true variational bound cares about the loss at each timestep. It is enormous at small t and negligible at large t, which is exactly what the simplified objective discards.',
    symbols: [
      { symbol: '\\sigma_t', name: 'reverse variance', note: 'β_t or β̃_t, depending on the choice.' },
      { symbol: 'w_t', name: 'the weight', note: 'The ratio of the true bound’s contribution to the simplified objective’s.' },
    ],
    assumptions: ['σ_t is fixed, not learned.'],
    derivation: [
      'Expand the squared distance between the posterior mean and the model mean.',
      'Substitute the ε-parameterisation, which makes the distance proportional to ‖ε − ε_θ‖² with a factor of β_t²/(2σ_t²α_t(1−ᾱ_t)).',
      'The simplified objective sets this factor to 1 everywhere.',
    ],
    example: {
      given: 'β_t = 0.02, α_t = 0.98, ᾱ_t = 0.5, σ_t = √0.02.',
      result: 'w_t = 0.0004 / (2 · 0.02 · 0.98 · 0.5) = 0.0204.',
      note: 'At the midpoint of the chain the true bound still gives this step very little weight.',
    },
  },
  {
    id: 'ancestral-step',
    title: 'One ancestral sampling step',
    latex: '\\mathbf{x}_{t-1} = \\frac{1}{\\sqrt{\\alpha_t}}\\left(\\mathbf{x}_t - \\frac{\\beta_t}{\\sqrt{1-\\bar{\\alpha}_t}}\\,\\boldsymbol{\\epsilon}_\\theta(\\mathbf{x}_t, t)\\right) + \\sigma_t \\mathbf{z}, \\qquad \\mathbf{z} \\sim \\mathcal{N}(0, \\mathbf{I})',
    reference: { source: 'Ho, Jain & Abbeel (2020)', location: 'Algorithm 2, §3.2', url: DDPM_URL },
    meaning:
      'One step of the reverse chain: move the state to the model’s predicted mean and add a fresh noise draw. The noise is set to zero at the very last step.',
    symbols: [
      { symbol: '\\sigma_t', name: 'step size', note: 'The standard deviation of the noise added.' },
      { symbol: '\\mathbf{z}', name: 'fresh noise', note: 'Drawn independently at every step.' },
    ],
    assumptions: ['The reverse transition is Gaussian with the mean the network produces.'],
    derivation: [
      'A draw from N(μ_θ, σ_t² I) is μ_θ + σ_t z with z standard normal.',
      'Substitute the ε-parameterisation for μ_θ.',
      'Repeat from t = T down to t = 1.',
    ],
    example: {
      given: 'α_t = 0.99, β_t = 0.01, ᾱ_t = 0.5, x_t = 0.3, ε_θ = 0.1, σ_t = 0.1, z = 0.',
      result: 'x_{t−1} ≈ 0.2989.',
      note: 'The step is small: the correction the network makes is proportional to how much noise it thinks is present.',
    },
  },
  {
    id: 'ddim-step',
    title: 'One deterministic (DDIM) sampling step',
    latex: '\\mathbf{x}_{t-1} = \\sqrt{\\bar{\\alpha}_{t-1}}\\,\\hat{\\mathbf{x}}_0 + \\sqrt{1 - \\bar{\\alpha}_{t-1} - \\sigma^2}\\,\\boldsymbol{\\epsilon}_\\theta + \\sigma \\mathbf{z}',
    reference: { source: 'Song, Meng & Ermon (2021)', location: 'DDIM, equation 12', url: DDIM_URL },
    meaning:
      'The same trained model, sampled without fresh noise. The predicted clean sample is scaled up and the predicted noise is aimed at the next noise level.',
    symbols: [
      { symbol: '\\hat{\\mathbf{x}}_0', name: 'predicted clean sample', note: 'Recovered from x_t and the predicted noise.' },
      { symbol: '\\sigma', name: 'the stochasticity', note: 'Zero for a fully deterministic sampler.' },
    ],
    assumptions: ['The same network and the same training objective as the ancestral sampler.'],
    derivation: [
      'Rewrite x_{t−1} as a mixture of a clean sample and a noise vector.',
      'Require the marginals to be consistent with the forward process at each step.',
      'The remaining freedom is one scalar of stochasticity, σ, which is set to zero for determinism.',
    ],
    example: {
      given: 'ᾱ_{t−1} = 0.6, ᾱ_t = 0.5, x̂_0 = 0.4, ε_θ = 0.1, σ = 0.',
      result: 'x_{t−1} = √0.6 · 0.4 + √0.4 · 0.1 ≈ 0.373.',
      note: 'No noise is added, so the same starting point always gives the same sample.',
    },
  },
  {
    id: 'guided-score',
    title: 'The classifier-free guided score',
    latex: 's_{\\mathrm{guided}}(\\mathbf{x}, c) = s_{\\mathrm{uncond}}(\\mathbf{x}) + w\\,\\left(s_{\\mathrm{cond}}(\\mathbf{x}, c) - s_{\\mathrm{uncond}}(\\mathbf{x})\\right)',
    reference: { source: 'Ho & Salimans (2022)', location: 'Classifier-Free Diffusion Guidance', url: CFG_URL },
    meaning:
      'The unconditional score, pushed towards the conditional one by the guidance weight. At w = 1 it is exactly the conditional score; beyond 1 it over-shoots.',
    symbols: [
      { symbol: 'w', name: 'the guidance weight', note: 'How far past the conditional score to go.' },
      { symbol: 's_{\\mathrm{cond}}', name: 'the conditional score', note: '∇ log p(x | c).' },
    ],
    assumptions: [
      'The model was trained both with and without the condition, so the two scores come from one network.',
      'The condition is a label or a text embedding dropped out during training.',
    ],
    derivation: [
      'Start from the conditional score: ∇ log p(x|c) = ∇ log p(x) + ∇ log p(c|x).',
      'Take a linear combination of the unconditional and conditional scores.',
      'Equivalently, the guided model samples from a distribution proportional to p(x)·p(c|x)^w.',
    ],
    example: {
      given: 's_uncond = 0.2, s_cond = 0.5, w = 3.',
      result: 's_guided = 0.2 + 3(0.5 − 0.2) = 1.1.',
      note: 'The guided score is three times further along the conditional direction than the conditional score itself.',
    },
  },
  {
    id: 'tilted-distribution',
    title: 'What a guided model actually samples',
    latex: 'p_w(\\mathbf{x} \\mid c) \\propto p(\\mathbf{x})\\, p(c \\mid \\mathbf{x})^{\\,w}',
    reference: { source: 'Ho & Salimans (2022)', location: 'Classifier-Free Diffusion Guidance', url: CFG_URL },
    meaning:
      'Guidance does not move the model; it reweights the distribution it samples from. The distribution is tilted towards the region the condition favours, and away from everything else.',
    symbols: [
      { symbol: 'p(c \\mid x)', name: 'the class posterior', note: 'How much the condition prefers this point.' },
      { symbol: 'w', name: 'the tilt exponent', note: 'One is the true conditional; above one it over-shoots.' },
    ],
    assumptions: ['The guided score is the score of the tilted distribution.'],
    derivation: [
      'Take the gradient of the log of the tilted distribution.',
      'The cross term ∇ log p(c|x) is exactly the difference between the conditional and unconditional scores.',
      'The result matches the guided score, so the sampler targets the tilted distribution.',
    ],
    example: {
      given: 'A point where p(c|x) = 0.5 and p(x) = 0.1, with w = 2.',
      result: 'The unnormalised density is 0.1 · 0.25 = 0.025.',
      note: 'Points the condition likes are boosted by the square of their posterior, and points it dislikes are suppressed even harder.',
    },
  },
  {
    id: 'latent-saving',
    title: 'What latent compression saves',
    latex: '\\frac{\\text{latent elements}}{\\text{pixel elements}} = \\frac{(H/f)(W/f)\\,C_\\ell}{H W C_p} = \\frac{C_\\ell}{C_p f^2}',
    reference: { source: 'Rombach et al. (2022)', location: 'Latent Diffusion, §3', url: LDM_URL },
    meaning:
      'The compression reduces the spatial size by f in each direction and the number of channels by the ratio C_ℓ/C_p, so the diffusion model works on 1/f² as many elements.',
    symbols: [
      { symbol: 'f', name: 'compression factor', note: 'Eight in the paper’s configuration.' },
      { symbol: 'C_\\ell, C_p', name: 'latent and pixel channels', note: 'Four and three respectively.' },
    ],
    assumptions: ['The latent preserves the spatial layout of the pixels, downsampled by f.'],
    derivation: [
      'The pixel tensor has H·W·C_p elements; the latent has (H/f)·(W/f)·C_ℓ.',
      'Dividing gives the ratio above.',
      'Attention is quadratic in the token count, so the attention saving is 1/f⁴ of the original.',
    ],
    example: {
      given: 'H = W = 256, C_p = 3, f = 8, C_ℓ = 4.',
      result: 'The ratio is 4/(3·64) = 1/48, so the diffusion model works on 48 times fewer elements.',
      note: 'With 256×256×3 pixels that is 4,096 latent values instead of 196,608.',
    },
  },
  {
    id: 'terminal-kl',
    title: 'The terminal divergence from the prior',
    latex: 'L_T = D_{\\mathrm{KL}}\\!\\left(q(\\mathbf{x}_T|\\mathbf{x}_0)\\,\\|\\,\\mathcal{N}(0, \\mathbf{I})\\right) = -\\tfrac{1}{2}\\log\\left(1 - \\bar{\\alpha}_T\\right) \\quad \\text{(unit-variance data)}',
    reference: { source: 'Ho, Jain & Abbeel (2020)', location: '§4', url: DDPM_URL },
    meaning:
      'How far the end of the chain is from the prior the sampler starts from. The paper reports about 10⁻⁵ bits per dimension, which is the statement that x_T is indistinguishable from noise.',
    symbols: [
      { symbol: '\\bar{\\alpha}_T', name: 'cumulative signal at T', note: '4×10⁻⁵ for the paper’s linear schedule over 1000 steps.' },
    ],
    assumptions: ['The data has unit variance, which is the paper’s scaling convention.'],
    derivation: [
      'The terminal marginal is N(√ᾱ_T x_0, (1−ᾱ_T) I).',
      'Apply the Gaussian KL formula with the prior N(0, I).',
      'For unit-variance data the mean term simplifies and only the variance term remains.',
    ],
    example: {
      given: 'ᾱ_T = 4.03×10⁻⁵.',
      result: 'L_T = −½ log(1 − 4.03×10⁻⁵) ≈ 2.02×10⁻⁵ nats ≈ 2.9×10⁻⁵ bits.',
      note: 'That is the number the paper quotes as roughly 10⁻⁵ bits per dimension.',
    },
  },
  {
    id: 'preconditioning',
    title: 'A preconditioned loss',
    latex: 'L(\\theta) = \\mathbb{E}_{t,\\boldsymbol{\\epsilon}}\\!\\left[\\lambda(t)\\,\\left\\|\\boldsymbol{\\epsilon} - \\boldsymbol{\\epsilon}_\\theta\\!\\left(\\ldots\\right)\\right\\|^2\\right]',
    reference: { source: 'Karras et al. (2022)', location: 'Elucidating the Design Space, §4', url: EDM_URL },
    meaning:
      'The loss at one noise level is scaled by a function of that level, so that every noise level contributes a comparable amount of gradient signal to the network.',
    symbols: [
      { symbol: '\\lambda(t)', name: 'the preconditioning weight', note: 'Chosen so the network sees a well-conditioned problem at every level.' },
    ],
    assumptions: ['The weight is chosen per noise level, and the same weights are used at sampling time.'],
    derivation: [
      'Different noise levels have different intrinsic signal-to-noise ratios and different error scales.',
      'A single unweighted loss therefore trains the easy levels far better than the hard ones.',
      'The weight is chosen to make the effective loss landscape similar across levels.',
    ],
    example: {
      given: 'A weight of 0.5 at a level where the unweighted squared error is 0.1.',
      result: 'The contribution to the loss is 0.05.',
      note: 'The point of the weight is to equalise the difficulty, not to reduce the loss.',
    },
  },
]
