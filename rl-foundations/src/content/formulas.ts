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

const SUTTON_URL = 'http://incompleteideas.net/book/the-book-2nd.html'
const SPINNINGUP_URL = 'https://spinningup.openai.com/'
const GAE_URL = 'https://link.springer.com/article/10.1007/BF00983696'

export const FORMULAS: FormulaEntry[] = [
  {
    id: 'return',
    title: 'The return',
    latex: 'G_t = R_{t+1} + \\gamma R_{t+2} + \\gamma^2 R_{t+3} + \\cdots',
    reference: { source: 'Sutton & Barto (2018)', location: 'Section 3', url: SUTTON_URL },
    meaning:
      'The total reward a trajectory collects from a time onwards, with the future discounted.',
    symbols: [
      { symbol: 'G_t', name: 'the return from time t', note: 'The quantity an agent maximises.' },
      { symbol: '\\gamma', name: 'the discount', note: 'Between zero and one.' },
      { symbol: 'R_t', name: 'the reward at time t', note: 'Usually written R_{t+1} for the reward received after acting at t.' },
    ],
    assumptions: [
      'The reward stream converges, which the discount guarantees.',
    ],
    derivation: [
      'The total reward is the sum of the rewards from now on.',
      'Weighting each by a power of the discount is what makes an infinite horizon finite.',
      'The expectation of the return is the value function.',
    ],
    example: {
      given: 'Rewards 2, 1, 1 and a discount of 0.5.',
      result: 'The return is 2 + 0.5 + 0.25 = 2.75.',
      note: 'The first reward counts for twice what the last one does.',
    },
  },
  {
    id: 'bellman-equation',
    title: 'The Bellman equation',
    latex: 'V^{\\pi}(s) = \\sum_{a} \\pi(a\\mid s)\\left[ R(s,a) + \\gamma \\sum_{s\\prime} P(s^{\\prime}\\mid s,a) V^{\\pi}(s^{\\prime}) \\right]',
    reference: { source: 'Sutton & Barto (2018)', location: 'Section 4', url: SUTTON_URL },
    meaning:
      'The value of a state under a policy: the expected reward now, plus the discounted value of the state the agent arrives in.',
    symbols: [
      { symbol: 'V^{\\pi}(s)', name: 'the value of state s under policy π', note: 'The expected return from s.' },
      { symbol: '\\pi(a\\mid s)', name: 'the probability the policy takes a in s', note: 'One for a deterministic policy.' },
      { symbol: 'P(s^{\\prime}\\mid s,a)', name: 'the probability of arriving in s′', note: 'The transition kernel.' },
    ],
    assumptions: [
      'The Markov property, so that the value of the next state is all that is needed.',
      'The discount is below one, so the iteration converges.',
    ],
    derivation: [
      'Condition on the first action and the first step.',
      'The reward is collected now and the rest of the return is the value of the next state.',
      'Taking the expectation over both gives the equation.',
    ],
    example: {
      given: 'A state with one action, a reward of −1, and a next state worth −5, with a discount of 0.9.',
      result: 'The value is −1 + 0.9 × (−5) = −5.5.',
      note: 'And the value function that satisfies the equation everywhere is the one iteration finds.',
    },
  },
  {
    id: 'bellman-optimality',
    title: 'The Bellman optimality equation',
    latex: 'V^{*}(s) = \\max_{a} \\left[ R(s,a) + \\gamma \\sum_{s^{\\prime}} P(s^{\\prime}\\mid s,a) V^{*}(s^{\\prime}) \\right]',
    reference: { source: 'Sutton & Barto (2018)', location: 'Section 9', url: SUTTON_URL },
    meaning:
      'The value of the best policy: the best action, rather than the policy’s own.',
    symbols: [
      { symbol: 'V^{*}(s)', name: 'the optimal value', note: 'The largest value any policy achieves in s.' },
    ],
    assumptions: [
      'The same conditions as the Bellman equation.',
    ],
    derivation: [
      'The value of the best policy is the value of the best action, taken now and followed optimally afterwards.',
      'That is the optimality equation.',
      'One sweep of it, repeated, is value iteration.',
    ],
    example: {
      given: 'Two actions with values −3 and −1, and a discount of 0.9.',
      result: 'The optimal value is the larger: −1.',
      note: 'And the greedy policy with respect to it is the optimal policy.',
    },
  },
  {
    id: 'policy-gradient',
    title: 'The policy gradient',
    latex: '\\nabla_\\theta J(\\theta) = \\mathbb{E}_{\\tau \\sim \\pi_\\theta}\\left[ \\sum_t \\nabla_\\theta \\log \\pi_\\theta(a_t \\mid s_t) G_t \\right]',
    reference: { source: 'Sutton & Barto (2018)', location: 'Section 13', url: SUTTON_URL },
    meaning:
      'The gradient of the expected return is an expectation of the score function times the return.',
    symbols: [
      { symbol: 'J(\\theta)', name: 'the expected return', note: 'The objective the agent maximises.' },
      { symbol: '\\nabla_\\theta \\log \\pi_\\theta(a_t \\mid s_t)', name: 'the score function', note: 'The gradient of the log-probability of the action taken.' },
      { symbol: 'G_t', name: 'the return from time t', note: 'The whole return, or the advantage, if a baseline is used.' },
    ],
    assumptions: [
      'The trajectories are drawn from the policy being differentiated.',
      'The return is the undiscounted sum, or the discounted one with a matching definition of J.',
    ],
    derivation: [
      'Differentiate the expectation: the derivative of the distribution and the derivative of the return.',
      'The derivative of the return does not depend on the parameters, so it drops out.',
      'What is left is the score function times the return, and the likelihood-ratio trick puts it in expectation form.',
    ],
    example: {
      given: 'A policy that gives an action probability 0.25 and a return of 4.',
      result: 'The contribution of that step to the gradient is (1 − 0.25) × 4 = 3.',
      note: 'The score is 1 − p for the action taken and −p for the others.',
    },
  },
  {
    id: 'baseline',
    title: 'The baseline',
    latex: '\\mathbb{E}_{a \\sim \\pi}\\left[ \\nabla_\\theta \\log \\pi(a\\mid s) \\, b(s) \\right] = 0',
    reference: { source: 'OpenAI, Spinning Up in Deep RL', location: 'Section 3', url: SPINNINGUP_URL },
    meaning:
      'Any function of the state can be subtracted from the return without changing the expected gradient.',
    symbols: [
      { symbol: 'b(s)', name: 'the baseline', note: 'A function of the state alone.' },
    ],
    assumptions: [
      'The baseline does not depend on the action.',
    ],
    derivation: [
      'The score function has mean zero over the action distribution.',
      'So the expectation of the score times anything that does not depend on the action is zero.',
      'Subtracting the baseline therefore leaves the expected gradient unchanged.',
    ],
    example: {
      given: 'A baseline equal to the value of the state, and a return of −20 in a state worth −16.',
      result: 'The weight becomes −4 instead of −20.',
      note: 'The weight is a fifth of what it was, and when the value is a good prediction the spread of the estimator shrinks by about the same factor.',
    },
  },
  {
    id: 'bandit-gradient',
    title: 'The gradient with one state',
    latex: '\\frac{\\partial J}{\\partial \\theta_k} = \\pi_k (R_k - J), \\quad J = \\sum_{a} \\pi_a R_a',
    reference: { source: 'OpenAI, Spinning Up in Deep RL', location: 'Section 3', url: SPINNINGUP_URL },
    meaning:
      'On a bandit the policy gradient collapses to an arithmetic expression: the probability of an arm, times the gap between its reward and the expected reward.',
    symbols: [
      { symbol: '\\theta_k', name: 'the logit of arm k', note: 'The parameter the update moves.' },
      { symbol: '\\pi_k', name: 'the probability of arm k', note: 'A softmax over the logits.' },
      { symbol: 'R_k', name: 'the reward of arm k', note: 'Received every time the arm is pulled.' },
      { symbol: 'J', name: 'the expected reward', note: 'The objective, and the baseline the theorem allows.' },
    ],
    assumptions: [
      'One state, so the expectation is a finite sum over the arms rather than over trajectories.',
      'The rewards are stationary, so R does not depend on how often an arm has been pulled.',
    ],
    derivation: [
      'J is the sum over the arms of the probability of each times its reward.',
      'The derivative of a softmax is \\partial \\pi_a / \\partial \\theta_k = \\pi_a (1[a=k] - \\pi_k).',
      'Substituting and collecting the terms leaves the probability of the arm times the gap between its reward and the average reward.',
      'The same expression, written as an expectation over the arm actually drawn, is the score function times the reward — the likelihood-ratio trick with nothing left in it but arithmetic.',
    ],
    example: {
      given: 'Four arms worth 1.6, 1, 0.4 and −0.2, and a uniform policy.',
      result: 'J = 0.7, so the gradient of the first logit is 0.25 × (1.6 − 0.7) = 0.225 and of the last is 0.25 × (−0.2 − 0.7) = −0.225.',
      note: 'Laboratory B computes this three ways and prints the difference, which is arithmetic error rather than sampling error.',
    },
  },
  {
    id: 'reward-to-go',
    title: 'The reward-to-go weighting',
    latex: '\\hat{g}_t = \\nabla_\\theta \\log \\pi_\\theta(a_t \\mid s_t)\\, G_t \\;\\text{with}\\; G_t = \\sum_{k=t}^{T-1} R_{k+1}, \\quad \\text{instead of} \\quad G_0 = \\sum_{k=0}^{T-1} R_{k+1}',
    reference: { source: 'Sutton & Barto (2018)', location: 'Section 13', url: SUTTON_URL },
    meaning:
      'A step may be weighted by the rewards that came after it instead of by the whole episode’s return. Both estimates have the same mean; the first has the smaller spread.',
    symbols: [
      { symbol: 'G_t', name: 'the reward-to-go from t', note: 'What the step could still influence.' },
      { symbol: 'G_0', name: 'the total return of the episode', note: 'Includes the rewards the step arrived with.' },
      { symbol: 'T', name: 'the length of the episode', note: 'The horizon, or the goal.' },
    ],
    assumptions: [
      'The rewards before t are fixed before a_t is drawn, so they are uncorrelated with the score of the step.',
      'The trajectories come from the policy being differentiated.',
    ],
    derivation: [
      'Split the total return into the part already collected and the part still to come.',
      'The score of a step has mean zero, and the collected part does not depend on the action, so their product has mean zero.',
      'Removing it therefore leaves the expectation alone — and removes its variance as well, which is the entire gain.',
    ],
    example: {
      given: 'An episode with rewards −1, −1 and +10, so the reward-to-go from the three steps is 8, 9 and 10.',
      result: 'Weighting by the total return uses 8, 8 and 8; weighting by the reward-to-go uses 8, 9 and 10.',
      note: 'Laboratory C measures how much quieter the second one is, on the gridworld and against the exact gradient.',
    },
  },
  {
    id: 'n-step-return',
    title: 'The n-step return',
    latex: 'G_t^{(n)} = R_{t+1} + \\gamma R_{t+2} + \\cdots + \\gamma^{n-1} R_{t+n} + \\gamma^{n} V(s_{t+n})',
    reference: { source: 'Williams & Burges (1990)', location: 'Section 1', url: GAE_URL },
    meaning:
      'The reward for n steps, and then a bootstrapped value.',
    symbols: [
      { symbol: 'G_t^{(n)}', name: 'the n-step return', note: 'The estimator for the return from t.' },
      { symbol: 'V(s_{t+n})', name: 'the bootstrapped value', note: 'An estimate, and the source of the bias.' },
    ],
    assumptions: [
      'The value function is the one under the policy being evaluated.',
    ],
    derivation: [
      'The n-step return looks n rewards ahead.',
      'What happens after that is unknown, so the value of the state there is used instead.',
      'The larger n is, the smaller the bootstrap and the larger the sample.',
    ],
    example: {
      given: 'Two rewards of −1 and a value of −10 at the second state, with a discount of 0.9.',
      result: 'The two-step return is −1 + 0.9 × (−1) + 0.81 × (−10) = −9.91.',
      note: 'And the one-step return is −1 + 0.9 × (−10) = −10.',
    },
  },
  {
    id: 'lambda-return',
    title: 'The λ-return',
    latex: 'G_t^{\\lambda} = (1-\\lambda)\\sum_{n=1}^{T-t-1} \\lambda^{n-1} G_t^{(n)} + \\lambda^{T-t-1} G_t^{(T-t)}',
    reference: { source: 'Williams & Burges (1990)', location: 'Section 1', url: GAE_URL },
    meaning:
      'A weighted mixture of the n-step returns, with the weights (1−λ)λ^(n−1).',
    symbols: [
      { symbol: '\\lambda', name: 'the mixing parameter', note: 'Zero is the one-step return; one is the Monte Carlo return.' },
    ],
    assumptions: [
      'The weights sum to one, so the estimate is a genuine mixture.',
    ],
    derivation: [
      'Each n-step return is an estimate with its own bias and its own variance.',
      'A weighted average of them has a bias between theirs and a variance below the largest.',
      'The weights are the geometric sequence, which is what makes the mixture computable on the fly.',
    ],
    example: {
      given: 'λ = 0.5 and two n-step returns of −10 and −12.',
      result: 'The mixture is 0.5 × (−10) + 0.25 × (−12) = −8.',
      note: 'And the last term takes whatever weight is left.',
    },
  },
  {
    id: 'general-advantage',
    title: 'The general advantage estimate',
    latex: 'A_t^{\\lambda} = \\sum_{l=0}^{\\infty} (\\gamma\\lambda)^{l} \\delta_{t+l}, \\quad \\delta_t = R_{t+1} + \\gamma V(s_{t+1}) - V(s_t)',
    reference: { source: 'Williams & Burges (1990)', location: 'Section 1', url: GAE_URL },
    meaning:
      'The λ-return, written in terms of the temporal-difference errors, which is how it is computed in practice.',
    symbols: [
      { symbol: '\\delta_t', name: 'the temporal-difference error', note: 'What the critic is trying to predict.' },
      { symbol: 'A_t^{\\lambda}', name: 'the advantage estimate', note: 'The weight the actor follows.' },
    ],
    assumptions: [
      'The value function is the current estimate of V.',
    ],
    derivation: [
      'The n-step returns can be written as weighted sums of the temporal-difference errors.',
      'Substituting them into the λ-return gives the same estimator in a form that can be computed one step at a time.',
      'At λ = 1 it is the sum of the errors, which is the true advantage; at λ = 0 it is the first error alone.',
    ],
    example: {
      given: 'A discount of 0.9, λ = 0.5, and two errors of 1 and 0.5.',
      result: 'The estimate is 1 + 0.45 × 0.5 = 1.225.',
      note: 'The second error is weighted by the discount times λ.',
    },
  },
]
