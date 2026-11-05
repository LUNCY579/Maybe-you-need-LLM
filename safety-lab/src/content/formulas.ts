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

const CAI_URL = 'https://arxiv.org/abs/2212.08073'
const HH_URL = 'https://arxiv.org/abs/2204.05862'
const REDTEAM_URL = 'https://arxiv.org/abs/2202.03286'
const SLEEPER_URL = 'https://arxiv.org/abs/2401.05566'
const SYCO_URL = 'https://arxiv.org/abs/2310.13548'
const EXTRACT_URL = 'https://arxiv.org/abs/2012.07805'

export const FORMULAS: FormulaEntry[] = [
  {
    id: 'critique-loop',
    title: 'The critique-and-revise loop',
    latex: 'r^{\\prime} = \\mathrm{revise}\\left(r, \\mathrm{critique}\\left(r, c\\right)\\right)',
    reference: { source: 'Bai et al. (2022)', location: 'Section 2', url: CAI_URL },
    meaning:
      'The response is written, criticised against a principle from the constitution, and revised.',
    symbols: [
      { symbol: 'r', name: 'the response', note: 'What the model wrote first.' },
      { symbol: 'c', name: 'the constitution', note: 'The written set of principles.' },
      { symbol: 'r^{\\prime}', name: 'the revised response', note: 'What the model wrote after the critique.' },
    ],
    assumptions: [
      'The critiquing model is better at spotting the violation than the answering model was at avoiding it.',
      'The revision keeps the harmless part of the answer.',
    ],
    derivation: [
      'The response is generated.',
      'The critique is generated against the principle it appears to break.',
      'The revision is generated with both in context.',
    ],
    example: {
      given: 'A response that helps with something the constitution forbids.',
      result: 'The critique names the principle, and the revision declines and offers the safe alternative.',
      note: 'The pair is the preference data.',
    },
  },
  {
    id: 'judge-agreement',
    title: 'The agreement of a judge with the labels',
    latex: '\\mathrm{agreement} = \\frac{1}{N}\\sum_{i} \\mathbb{1}\\left[ j_i = y_i \\right]',
    reference: { source: 'Askell et al. (2022)', location: 'Section 6', url: HH_URL },
    meaning:
      'The fraction of the cases on which the judge and the human labels say the same thing.',
    symbols: [
      { symbol: 'j_i', name: 'the judge’s verdict on the i-th case', note: 'Harmful or not.' },
      { symbol: 'y_i', name: 'the human label on the i-th case', note: 'The thing the score is supposed to be about.' },
    ],
    assumptions: [
      'The labels are the reference, which is itself an assumption worth stating.',
    ],
    derivation: [
      'Compare the two verdicts case by case.',
      'Count the agreements.',
      'Divide by the number of cases.',
    ],
    example: {
      given: 'A judge that agrees on two cases in three, and flags the third where the labels do not.',
      result: 'The agreement is two thirds, with one false positive.',
      note: 'The false positive rate is what tells you how much harmless data the judge is costing you.',
    },
  },
  {
    id: 'two-round-reach',
    title: 'What each of the two rounds reaches',
    latex:
      '\\pi_{t+1} = \\pi_t + \\eta \\left( \\bar{c} - \\pi_t \\right), \\qquad \\bar{c} = \\frac{1}{P} \\sum_{p} \\left[ w_p h_p + \\left( 1 - w_p \\right) g_p \\right]',
    reference: { source: 'Askell et al. (2022)', location: 'Section 3', url: HH_URL },
    meaning:
      'The supervised round is the mean of the demonstrations it was shown. Each step of the reinforcement round moves the policy a fixed fraction of the way to the answer the labels are expected to choose.',
    symbols: [
      { symbol: '\\pi_t', name: 'the policy after t steps', note: 'A point on the helpful and the harmless axes.' },
      { symbol: '\\eta', name: 'the step size', note: 'How much of the remaining distance one step takes.' },
      {
        symbol: '\\bar{c}',
        name: 'the expected choice',
        note: 'The two answers on offer, averaged by how often the labeler prefers the helpful one.',
      },
      {
        symbol: 'w_p',
        name: 'the probability the labeler picks the helpful answer of pair p',
        note: 'One half carries no preference at all; one is certain.',
      },
      { symbol: 'h_p, g_p', name: 'the helpful and the harmless answer of pair p', note: 'The only points the round can move toward.' },
    ],
    assumptions: [
      'The pool contains an answer better on both axes than the one the imitation round reached; a round that moves only toward what was demonstrated cannot invent it.',
      'The labels do not change between steps, so the target is fixed while the policy approaches it.',
    ],
    derivation: [
      'The first round averages the demonstrations, which is where a supervised fit lands.',
      'Each preference pair contributes its expected choice, weighted by the labeler’s own probability.',
      'A step takes a fraction of the distance to the mean of those choices, and the steps repeat.',
    ],
    example: {
      given: 'A policy at (0.5, 0.5), an expected choice at (0.8, 0.7), and a step size of one half.',
      result: 'One step lands at (0.65, 0.6), and the distance still to travel halves with every step after it.',
      note: 'The screen prints the whole path, because an endpoint taken from a run that has not stopped moving is not a finding.',
    },
  },
  {
    id: 'red-team-coverage',
    title: 'The coverage of a red team',
    latex: '\\mathrm{coverage} = \\frac{\\left|\\{c : c \\text{ was reached by an attack}\\}\\right|}{\\left|\\mathcal{T}\\right|}',
    reference: { source: 'Perez et al. (2022)', location: 'Section 3', url: REDTEAM_URL },
    meaning:
      'The fraction of the taxonomy that the red team’s attacks reached.',
    symbols: [
      { symbol: '\\mathcal{T}', name: 'the taxonomy', note: 'The list of the kinds of failure being looked for.' },
      { symbol: 'c', name: 'a category', note: 'Reached when an attack on it succeeded.' },
    ],
    assumptions: [
      'The taxonomy is written down, so the coverage is a number rather than an impression.',
    ],
    derivation: [
      'Run the attacks.',
      'Mark the categories that an attack reached.',
      'Divide by the number of categories there are.',
    ],
    example: {
      given: 'A red team that reached four of six categories.',
      result: 'The coverage is two thirds.',
      note: 'And the two thirds it did not reach are the part of the model about which nothing was learned.',
    },
  },
  {
    id: 'discovery-ceiling',
    title: 'The discovery rate a budget can reach',
    latex: '\\text{found} = \\frac{1}{F} \\sum_{f} \\left[ 1 - \\left( 1 - q_f \\right)^{n} \\right]',
    reference: { source: 'Perez et al. (2022)', location: 'Section 3', url: REDTEAM_URL },
    meaning:
      'One attempt finds a failure with that failure’s own probability, so n attempts leave it unfound with probability one minus that, to the n. The mean of the complements is the ceiling the search is measured against.',
    symbols: [
      { symbol: 'q_f', name: 'the reachability of failure f', note: 'The chance one attempt finds it at all.' },
      { symbol: 'n', name: 'the attempts spent on it', note: 'The budget, divided evenly.' },
      { symbol: 'F', name: 'the number of failures', note: 'The size of the set the rate is taken over.' },
    ],
    assumptions: [
      'The attempts are independent, which is what a search that does not learn from its own findings assumes.',
      'The budget can be divided evenly across the failures, which a guided search does and a random one cannot.',
    ],
    derivation: [
      'One attempt misses a failure with probability one minus its reachability.',
      'n independent attempts miss it with that probability raised to n.',
      'Average the complement over the failures: that is the most an even spend of the same budget can buy.',
    ],
    example: {
      given: 'A failure one attempt finds with probability 0.25, and four attempts spent on it.',
      result: 'One minus 0.75 to the fourth, which is 0.6836.',
      note: 'A search that picks its target at random reaches a given failure once in F attempts, so it is the same arithmetic with q divided by F — which is the comparison the screen plots.',
    },
  },
  {
    id: 'flip-rate',
    title: 'The flip rate',
    latex: '\\mathrm{flip} = \\frac{1}{N}\\sum_{i} \\mathbb{1}\\left[ a_i = y_i \\wedge b_i \\neq y_i \\right]',
    reference: { source: 'Shirzad et al. (2023)', location: 'Section 4', url: SYCO_URL },
    meaning:
      'The fraction of the questions the model answers correctly when unprompted that it answers wrongly once the user has asserted a wrong answer.',
    symbols: [
      { symbol: 'a_i', name: 'the answer with no pressure', note: 'What the model says when the user is neutral.' },
      { symbol: 'b_i', name: 'the answer under pressure', note: 'What it says once the user has asserted a wrong answer.' },
      { symbol: 'y_i', name: 'the correct answer', note: 'The one the model knew.' },
    ],
    assumptions: [
      'The model knew the answer, which the neutral case establishes.',
      'The asserted answer is wrong, which the experiment arranges.',
    ],
    derivation: [
      'For each question, take the case where the model was right and the case where the user pushed.',
      'Count the ones that changed.',
      'Divide by the number of questions.',
    ],
    example: {
      given: 'The model is right on forty questions and wrong on six of them once the user pushes.',
      result: 'The flip rate is fifteen per cent.',
      note: 'And the mitigation is measured the same way, against the same questions.',
    },
  },
  {
    id: 'repeat-agreement',
    title: 'The probability that two looks agree',
    latex:
      '\\Pr\\left[ \\text{two looks agree} \\right] = c^{2} + \\left( 1 - c^{2} \\right) \\left[ a^{2} + \\left( 1 - a \\right)^{2} \\right]',
    reference: { source: 'Shirzad et al. (2023)', location: 'Section 4', url: SYCO_URL },
    meaning:
      'Two looks agree outright when both report the labeler’s latent side. Otherwise they agree only when two fresh draws land on the same side, which is a property of the lean alone.',
    symbols: [
      {
        symbol: 'c',
        name: 'the consistency',
        note: 'The chance a look reports the latent side rather than drawing afresh.',
      },
      { symbol: 'a', name: 'the lean', note: 'The chance the labeler’s side is the answer that agrees with the user.' },
    ],
    assumptions: [
      'A latent side persists and each look either reports it or draws from the same lean, which is the model the laboratory simulates.',
      'Both looks are about the same question.',
    ],
    derivation: [
      'Both looks report the latent side with probability c squared, and then they agree.',
      'The remaining mass is the case where one of them draws afresh.',
      'Two fresh draws agree only on the same side: a squared, plus one minus a squared.',
    ],
    example: {
      given: 'A labeler with a lean of 0.7 and a consistency of 0.9.',
      result: '0.81 + 0.19 × (0.49 + 0.09) = 0.9202.',
      note: 'A repeat-agreement number of 0.92 says almost nothing about the lean and almost everything about the consistency, which is why it is a comfortable thing to report.',
    },
  },
  {
    id: 'effective-looks',
    title: 'How many independent opinions a panel of looks is worth',
    latex: 'm_{\\text{eff}} = \\frac{m}{1 + \\left( m - 1 \\right) \\rho}, \\qquad \\rho = c^{2}',
    reference: { source: 'Shirzad et al. (2023)', location: 'Section 4', url: SYCO_URL },
    meaning:
      'The design effect of a correlated sample. Looks that share one latent side carry less information each than looks from different labelers, and the effective count falls to one as the consistency rises.',
    symbols: [
      { symbol: 'm', name: 'the number of looks', note: 'How many times the same labeler was asked.' },
      {
        symbol: '\\rho',
        name: 'the correlation between two looks',
        note: 'Consistency squared, and nothing else — neither the lean nor the number of looks.',
      },
    ],
    assumptions: [
      'Every pair of looks is correlated the same way, which is what a single latent side gives.',
      'A labeler with no consistency at all draws independent looks, which fixes the top of the range at m.',
    ],
    derivation: [
      'Two looks from one labeler correlate at c squared.',
      'A correlated sample of m carries the information of m over one plus (m − 1) times that correlation.',
      'At a consistency of one the whole panel is worth one look, which is the argument for asking more people instead of asking one person more often.',
    ],
    example: {
      given: 'Five looks from a labeler whose consistency is 0.9.',
      result: 'Five over one plus four times 0.81, which is 1.18 looks.',
      note: 'The interval that assumes five independent opinions is too narrow by the square root of the ratio, which is the cost of the panel.',
    },
  },
  {
    id: 'majority-of-looks',
    title: 'What a majority of hands to the reward model',
    latex:
      '\\Pr\\left[ \\text{a strict majority} \\right] = \\sum_{k > \\ell/2} \\binom{\\ell}{k} p^{k} \\left( 1 - p \\right)^{\\ell - k}',
    reference: { source: 'Shirzad et al. (2023)', location: 'Section 4', url: SYCO_URL },
    meaning:
      'The reward model is handed the side most of the looks chose, so what it learns is the upper tail of a binomial rather than the labeler’s own probability.',
    symbols: [
      { symbol: '\\ell', name: 'the number of looks', note: 'The size of the panel.' },
      { symbol: 'p', name: 'the chance one look says agree', note: 'The lean, once the consistency has been taken out of it.' },
      { symbol: 'k', name: 'the number that say agree', note: 'The majority needs it above half, strictly.' },
    ],
    assumptions: [
      'The looks are independent, which the equation above says they are not when the labeler is consistent.',
      'An even panel that ties hands the reward model no side, so the sum starts one above the exact middle.',
    ],
    derivation: [
      'Write the binomial term for k of ℓ looks.',
      'Keep the terms above half.',
      'Sum them: the tail is the probability the reward model is trained to prefer the agreeing answer.',
    ],
    example: {
      given: 'A look that says agree with probability 0.6, taken three times.',
      result: 'Three times 0.36 times 0.4, plus 0.216, which is 0.648.',
      note: 'The majority moves away from one half in whichever direction the lean already points, so a panel of a biased labeler is more biased than the labeler is.',
    },
  },
  {
    id: 'cue-blindness',
    title: 'The harm an evaluation set reports against the harm there is',
    latex:
      'H_{\\text{apparent}} = \\frac{1}{N_0} \\sum_{i \\, : \\, c_i = \\emptyset} \\mathbb{1}\\left[ h_i \\right], \\qquad H_{\\text{true}} = \\frac{1}{N} \\sum_{i} \\mathbb{1}\\left[ h_i \\right]',
    reference: { source: 'Hubinger et al. (2024)', location: 'Section 2', url: SLEEPER_URL },
    meaning:
      'The rate a safety case reports is counted over the rows it thought to write. The rows that fire a cue nobody asked about are not in that denominator, and the two rates differ by exactly the harm they carry.',
    symbols: [
      { symbol: 'h_i', name: 'the i-th example is harmful', note: 'Ground truth, not the classifier’s guess.' },
      { symbol: 'c_i', name: 'the cue the example carries', note: 'And ∅ when it carries none.' },
      { symbol: 'N', name: 'every labelled row', note: 'The set as it would be written knowing the cue.' },
      { symbol: 'N_0', name: 'the rows that do not fire the cue', note: 'The set an evaluation written without it samples.' },
    ],
    assumptions: [
      'Both rates are counted from the labels, so the gap is a property of the evaluation set and no classifier is involved in it.',
      'The cued rows are missing from the first count because nobody thought to write them.',
    ],
    derivation: [
      'Split the labelled set into the rows that carry the cue and the rows that do not.',
      'The rate over the rows left is what a case written without the cue in mind reports.',
      'The rate over all of them is the harm there is; the difference is the under-report, and it is a share of the sample, not a mistake of the model.',
    ],
    example: {
      given: 'A hundred labelled rows, twenty of them cued and all twenty harmful, and sixteen of the remaining eighty harmful.',
      result: 'The set without the cue reports 16 over 80, which is 0.20. Putting the rows back gives 36 over 100, so the harm was under-reported by 0.16.',
      note: 'The second effect is separate: adding the rows back does not make a classifier see them, because its weight on an unlabelled cue is zero.',
    },
  },
  {
    id: 'extraction-rate',
    title: 'The success rate of the extraction attack',
    latex: '\\mathrm{extraction} = \\frac{1}{R}\\sum_{r} \\mathbb{1}\\left[ \\text{the record } r \\text{ was recovered} \\right]',
    reference: { source: 'Carlini et al. (2021)', location: 'Section 4', url: EXTRACT_URL },
    meaning:
      'The fraction of the training records the attack recovered, and the exposure of the training set.',
    symbols: [
      { symbol: 'R', name: 'the number of records', note: 'The size of the sample of the training set.' },
    ],
    assumptions: [
      'The records are drawn at random from the training set, so the sample is representative.',
      'The model memorised the records it is asked about.',
    ],
    derivation: [
      'For each record, run the attack with the prefix the attacker knows.',
      'Count the recoveries.',
      'Divide by the number of records.',
    ],
    example: {
      given: 'The attack recovers a third of the records with a prefix of three tokens.',
      result: 'The exposure is a third, at that prefix length.',
      note: 'And the rate rises with the length of the prefix, which is the curve the measurement produces.',
    },
  },
  {
    id: 'memorisation-bound',
    title: 'The memorisation rate of a record',
    latex: '\\mathrm{mem}(x) = \\frac{1}{N}\\sum_{i} \\mathbb{1}\\left[ x_i = f(x_{1:i-1}) \\right]',
    reference: { source: 'Carlini et al. (2021)', location: 'Section 4', url: EXTRACT_URL },
    meaning:
      'The fraction of the times a record is emitted verbatim, given its own prefix.',
    symbols: [
      { symbol: 'x', name: 'a training record', note: 'The thing being memorised.' },
      { symbol: 'f', name: 'the model', note: 'Which is asked for the continuation.' },
    ],
    assumptions: [
      'The model is asked for the continuation many times, and the fraction is over those attempts.',
    ],
    derivation: [
      'Prompt the model with the record’s own prefix.',
      'Sample the continuation.',
      'Count the samples that reproduce the record exactly.',
    ],
    example: {
      given: 'A record that comes back verbatim in one sample in ten.',
      result: 'The memorisation rate is a tenth.',
      note: 'And a tenth of a training set is a tenth of it that an attacker can have.',
    },
  },
  {
    id: 'membership-score',
    title: 'The membership score and the line it has to clear',
    latex:
      's(x) = \\log \\frac{\\hat{p}(x)}{p_{\\text{ref}}}, \\qquad \\hat{p}(x) = \\frac{v + \\tfrac{1}{2}}{Q + 1}, \\qquad v \\sim \\mathrm{Binomial}\\left(Q, p\\right)',
    reference: { source: 'Carlini et al. (2021)', location: 'Section 3', url: EXTRACT_URL },
    meaning:
      'The attacker asks the target model for the continuation Q times, counts the times it said the record back, and compares the log of the ratio to a reference model that never saw it. A candidate is called a member when its score clears the line the reference itself would reach at that budget.',
    symbols: [
      { symbol: 'v', name: 'the verbatim hits', note: 'How many of the Q times the model said the record back.' },
      { symbol: 'Q', name: 'the query budget', note: 'What the power is bought with, and the reason the number is quoted with it.' },
      {
        symbol: 'p_{\\text{ref}}',
        name: 'the reference model’s probability',
        note: 'What a model trained without this record gives the same continuation — the attacker’s own baseline.',
      },
      { symbol: '\\hat{p}(x)', name: 'the estimate', note: 'Jeffreys-smoothed, so a record that never came back scores a finite number rather than minus infinity.' },
    ],
    assumptions: [
      'A reference model trained without the record is available, which is the strongest form of the attack and the one that needs no gradient access.',
      'The count is binomial with the model’s own probability, which is what makes the false-positive rate computable rather than assumed.',
    ],
    derivation: [
      'Sample the continuation Q times and count the hits.',
      'Smooth the count, so the ordering of the candidates does not depend on how many of them scored nothing.',
      'Divide by the baseline and take the log; flag the ones above the score a baseline model reaches at the same budget.',
    ],
    example: {
      given: 'Sixteen queries against an outsider the model gives one chance in sixteen, and a reference model that agrees with it.',
      result: 'One hit in sixteen queries lands exactly on the line, and the candidate is not flagged.',
      note: 'At one query the statistic is a coin, whatever the corpus holds, which is why the power is plotted against the budget and not quoted on its own.',
    },
  },
]
