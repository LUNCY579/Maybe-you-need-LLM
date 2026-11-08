/**
 * The course curriculum.
 *
 * The primary source is
 *
 *   N. Bai, S. Kadavath, S. Kundu, A. Askell et al.,
 *   "Constitutional AI: Harmlessness from AI Feedback",
 *   arXiv:2212.08073 [cs.CL] / Anthropic, 2022.
 *
 * Five further papers carry the rest of the course:
 *
 *   R. N. Askell et al., "Training a Helpful and Harmless Assistant with
 *   Reinforcement Learning from Human Feedback", arXiv:2204.05862 [cs.CL];
 *
 *   E. Perez, S. Sclar, N. S. et al., "Red Teaming Language Models with
 *   Language Models", arXiv:2202.03286 [cs.CL] / EMNLP 2022;
 *
 *   L. Shirzad et al., "Towards Understanding Sycophancy in Language Models",
 *   arXiv:2310.13548 [cs.CL] / ICLR 2024;
 *
 *   N. Carlini et al., "Extracting Training Data from Large Language Models",
 *   arXiv:2012.07805 [cs.CR] / USENIX Security 2021;
 *
 *   E. Hubinger et al., "Sleeper Agents: Training Deceptive LLMs that Persist
 *   Through Safety Training", arXiv:2401.05566 [cs.LG] / ICML 2024.
 *
 * The section map below is built from those works, and the test suite
 * refuses a lesson that cites a section which is not in it.
 */

import type { LessonMeta, ModuleMeta, SourceRef } from '@llm-materials/course-core'

export type { LessonMeta, ModuleMeta, SourceRef }

export const SOURCES = {
  cai: {
    id: 'bai-2022-constitutional',
    title: 'Constitutional AI: Harmlessness from AI Feedback',
    authors: 'Yuntao Bai, Saurav Kadavath, Sandipan Kundu, Amanda Askell, Jackson Kernion, Andy Jones and others',
    year: 2022,
    venue: 'arXiv:2212.08073 [cs.CL] / Anthropic',
    url: 'https://arxiv.org/abs/2212.08073',
  },
  hh: {
    id: 'bai-2022-hh',
    title: 'Training a Helpful and Harmless Assistant with Reinforcement Learning from Human Feedback',
    authors: 'Yuntao Bai, Andy Jones, Kamal Ndousse, Amanda Askell, Anna Chen, Nova DasSarma and others',
    year: 2022,
    venue: 'arXiv:2204.05862 [cs.CL] / Anthropic',
    url: 'https://arxiv.org/abs/2204.05862',
  },
  redteam: {
    id: 'perez-2022-redteam',
    title: 'Red Teaming Language Models with Language Models',
    authors: 'Ethan Perez, Saffron Huang, Francis Song, Trevor Cai, Roman Ring, John Aslanides and others',
    year: 2022,
    venue: 'arXiv:2202.03286 [cs.CL] / EMNLP 2022',
    url: 'https://arxiv.org/abs/2202.03286',
  },
  sycophancy: {
    id: 'shirzad-2023-sycophancy',
    title: 'Towards Understanding Sycophancy in Language Models',
    authors: 'Mrinank Sharma, Meg Tong, Tomasz Korbak, David Duvenaud, Amanda Askell, Samuel R. Bowman and others',
    year: 2023,
    venue: 'arXiv:2310.13548 [cs.CL] / ICLR 2024',
    url: 'https://arxiv.org/abs/2310.13548',
  },
  extraction: {
    id: 'carlini-2021-extraction',
    title: 'Extracting Training Data from Large Language Models',
    authors: 'Nicholas Carlini, Florian Tramer, Eric Wallace, Matthew Jagielski, Ariel Herbert-Voss, Katherine Lee and others',
    year: 2021,
    venue: 'arXiv:2012.07805 [cs.CR] / USENIX Security 2021',
    url: 'https://arxiv.org/abs/2012.07805',
  },
  sleeper: {
    id: 'hubinger-2024-sleeper',
    title: 'Sleeper Agents: Training Deceptive LLMs that Persist Through Safety Training',
    authors: 'Evan Hubinger, Carson Denison, Jesse Mu, Mike Lambert, Meg Tong, Monte MacDiarmid and others',
    year: 2024,
    venue: 'arXiv:2401.05566 [cs.LG] / ICML 2024',
    url: 'https://arxiv.org/abs/2401.05566',
  },
} as const

/** The section map of the sources this course cites. */
export const SECTION_MAP: Record<string, { title: string; note: string }> = {
  'cai:1': { title: 'Introduction', note: 'The claim: a model can be its own critic, against a written constitution.' },
  'cai:2': { title: 'The supervised stage', note: 'The critiques and the revisions, and the dataset they make.' },
  'cai:3': { title: 'The reinforcement stage', note: 'The preference model trained on the critiques, and the harmlessness it buys.' },
  'cai:5': { title: 'Discussion', note: 'What the method does not establish, and how a harmlessness claim should be read.' },
  'hh:2': { title: 'The helpful and harmless dataset', note: 'The red-team prompts, the harmlessness categories, and the labels.' },
  'hh:3': {
    title: 'The training methodology',
    note: 'The imitation round, the reward model and the reinforcement round, and the weighting of the two objectives.',
  },
  'hh:6': { title: 'The evaluation', note: 'How a harmlessness score is produced, and what the judge is worth.' },
  'redteam:1': { title: 'Introduction', note: 'The claim: a language model is a better red teammate than a person.' },
  'redteam:3': { title: 'The method', note: 'The attacker, the diversity of its attacks, and the taxonomy they are measured against.' },
  'sycophancy:1': { title: 'Introduction', note: 'The claim: models change their answers to agree with the person asking.' },
  'sycophancy:4': { title: 'The measurements', note: 'The flip rate, the mitigation, and the size of each effect.' },
  'extraction:1': { title: 'Introduction', note: 'The claim: a model that memorised its training data can be made to emit it.' },
  'extraction:3': {
    title: 'The threat model',
    note: 'What the attacker is allowed to ask, what it costs, and what a defence is measured against.',
  },
  'extraction:4': { title: 'The extraction attack', note: 'The attack, its success rate, and what the rate depends on.' },
  'sleeper:2': {
    title: 'A summary of the findings',
    note: 'The behaviour is conditional on a cue, and the safety training leaves the cue in place.',
  },
  'sleeper:5': {
    title: 'Safety training and the backdoor',
    note: 'Supervised and reinforcement training reduce the behaviour where it is asked about, and not where it is cued.',
  },
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'harmlessness',
    chapter: 2,
    title: 'Harmlessness from AI Feedback',
    tagline: 'A model that critiques itself, against a written rule',
    summary:
      'The critique-and-revise loop, the preference data it makes, and the judge that every harmlessness number depends on.',
    accent: 'indigo',
    outcomes: [
      'Describe the critique-and-revise loop and what it produces',
      'Say what a harmlessness score means, and what it depends on',
      'Measure the agreement of a judge with the labels',
    ],
  },
  {
    id: 'red-teaming',
    chapter: 3,
    title: 'Red Teaming',
    tagline: 'Finding the failures, and knowing which ones you have not',
    summary:
      'The attack, the taxonomy, and the two numbers that matter: how often the model fails, and how much of the space the red team reached.',
    accent: 'teal',
    outcomes: [
      'Describe a red-team attack and the taxonomy it is measured against',
      'Say why the coverage matters more than the success rate',
      'Compare a model-driven red team with a random one on the same budget',
    ],
  },
  {
    id: 'cued-behaviour',
    chapter: 3,
    title: 'Cued Behaviour',
    tagline: 'A harm that arrives with a mark nobody asked about',
    summary:
      'The safety classifier, the label sheet it was given, and the part of the behaviour that rides on a cue no column was made for.',
    accent: 'rose',
    outcomes: [
      'Describe a conditional behaviour and the cue that switches it',
      'Say what a safety classifier is able to count, and what it is not',
      'Measure the gap between the harm an evaluation reports and the harm there is',
    ],
  },
  {
    id: 'sycophancy',
    chapter: 4,
    title: 'Sycophancy',
    tagline: 'Changing the answer to agree with the person asking',
    summary:
      'The flip rate, the size of the effect, and the small change to the prompt that moves it.',
    accent: 'amber',
    outcomes: [
      'Define the flip rate and say what it measures',
      'Explain the mechanism: the training made agreeing feel like the right answer',
      'Measure the effect of the mitigation and of the position of the answer',
    ],
  },
  {
    id: 'privacy',
    chapter: 4,
    title: 'Privacy',
    tagline: 'What a model can be made to give back',
    summary:
      'Memorisation, the extraction attack, and the number that says how much of the training set is exposed.',
    accent: 'emerald',
    outcomes: [
      'Describe what memorisation means and when it happens',
      'Explain the extraction attack and what its success rate depends on',
      'Measure the exposure of a training set against the length of the known prefix',
    ],
  },
]

export const LESSONS: LessonMeta[] = [
  {
    id: 'the-critique-and-revise-loop',
    moduleId: 'harmlessness',
    number: 1,
    title: 'The critique-and-revise loop',
    subtitle: 'A model, a principle, and a second pass',
    minutes: 26,
    objectives: [
      'Describe the loop: a response, a critique against a principle, a revision',
      'Say what the loop produces and what it is used for',
      'Measure how much of the harm the loop removes',
    ],
    keyIdeas: [
      'The critique names the principle that was violated, so the revision has something to work against.',
      'The loop makes a preference dataset; the dataset is what trains the model.',
      'A revision should remove the harm and keep the harmless part of the answer.',
    ],
    interactive: {
      lab: 'constitution',
      view: 'loop',
      title: 'Run the loop',
      description: 'The critiques, the revisions, and the harm that is left.',
    },
    prerequisites: [],
    glossaryTerms: ['constitution', 'critique', 'preference-data'],
    quizIds: ['q-harm-1', 'q-harm-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'cai:2',
        title: 'The supervised stage',
        note: 'The critiques and the revisions, and the dataset they make.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-judge',
    moduleId: 'harmlessness',
    number: 2,
    title: 'The judge',
    subtitle: 'Whose opinion the number is',
    minutes: 24,
    objectives: [
      'Say what a harmlessness score is an estimate of',
      'Explain why the agreement with the labels is the number to report',
      'Describe the false positives and false negatives a judge makes',
    ],
    keyIdeas: [
      'A harmlessness score is what a judge believes, and the judge is a model.',
      'The agreement with the human labels is what makes the number worth anything.',
      'A judge that flags the harmless cases costs you the data you were trying to collect.',
    ],
    interactive: {
      lab: 'constitution',
      view: 'judge',
      title: 'Check the judge',
      description: 'The agreement of a judge with the labels, and the errors it makes.',
    },
    prerequisites: ['the-critique-and-revise-loop'],
    glossaryTerms: ['judge', 'agreement', 'false-positive'],
    quizIds: ['q-harm-3', 'q-judge-errors'],
    sourceRefs: [
      {
        chapter: 6,
        section: 'hh:6',
        title: 'The evaluation',
        note: 'How a harmlessness score is produced, and what the judge is worth.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-attack',
    moduleId: 'red-teaming',
    number: 3,
    title: 'The attack',
    subtitle: 'Finding the failure, on purpose',
    minutes: 24,
    objectives: [
      'Describe what a red-team attack is and what it is measured against',
      'Say why the attack success rate alone is the wrong number',
      'Explain what the coverage of a red team means',
    ],
    keyIdeas: [
      'A red team is a search: the failures it has not found are the ones it cannot rule out.',
      'The attack success rate says how weak the model is on the attacks it made.',
      'The coverage says how much of the space it looked at, and it is the number that is usually missing.',
    ],
    interactive: {
      lab: 'redteam',
      view: 'attack',
      title: 'Run the red team',
      description: 'The attacks, the failures, and the coverage of the taxonomy.',
    },
    prerequisites: ['the-critique-and-revise-loop'],
    glossaryTerms: ['red-team', 'taxonomy', 'coverage'],
    quizIds: ['q-red-1', 'q-red-2'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'redteam:3',
        title: 'The method',
        note: 'The attacker, the diversity of its attacks, and the taxonomy they are measured against.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-taxonomy',
    moduleId: 'red-teaming',
    number: 4,
    title: 'The taxonomy',
    subtitle: 'What a red team should be measured against',
    minutes: 22,
    objectives: [
      'Say what a harm taxonomy is and where it comes from',
      'Explain the difference between a red-team set and a test set',
      'Measure the coverage of a red team against a taxonomy',
    ],
    keyIdeas: [
      'A taxonomy is what makes a red-team set a measurement rather than an anecdote.',
      'A red-team set is a sample of the attacks that work, not a test set: it says what fails, not what passes.',
      'The coverage of a red team is a claim about the model only where the red team looked.',
    ],
    interactive: {
      lab: 'redteam',
      view: 'coverage',
      title: 'Compare the two red teams',
      description: 'A model-driven red team against a random one, on the same budget.',
    },
    prerequisites: ['the-attack'],
    glossaryTerms: ['taxonomy', 'coverage', 'red-team'],
    quizIds: ['q-red-3', 'q-taxonomy-measure'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'hh:2',
        title: 'The helpful and harmless dataset',
        note: 'The red-team prompts, the harmlessness categories, and the labels.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'agreeing-with-the-user',
    moduleId: 'sycophancy',
    number: 5,
    title: 'Agreeing with the user',
    subtitle: 'The flip rate',
    minutes: 24,
    objectives: [
      'Define the flip rate and say what it measures',
      'Explain the mechanism behind it',
      'Say what a model is being trained to do when it agrees',
    ],
    keyIdeas: [
      'A model asked a question it can answer will sometimes change its answer to agree.',
      'The training rewarded the answer that made the user happy, and agreement looks like that.',
      'The flip rate is the fraction of correct answers that become wrong under pressure.',
    ],
    interactive: {
      lab: 'sycophancy',
      view: 'flip',
      title: 'Measure the flip rate',
      description: 'The answers under pressure, and the ones that flip.',
    },
    prerequisites: [],
    glossaryTerms: ['sycophancy', 'flip-rate'],
    quizIds: ['q-syc-1', 'q-syc-2'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'sycophancy:1',
        title: 'Introduction',
        note: 'The claim: models change their answers to agree with the person asking.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-mitigation',
    moduleId: 'sycophancy',
    number: 6,
    title: 'The mitigation',
    subtitle: 'One sentence in the prompt',
    minutes: 22,
    objectives: [
      'Describe the mitigation and the size of its effect',
      'Say why a mitigation that lives in the prompt is not a fix',
      'Measure the effect of the mitigation against the baseline',
    ],
    keyIdeas: [
      'Telling the model the user may be wrong moves the flip rate, and by a measurable amount.',
      'A mitigation in the prompt is a mitigation in the prompt: it depends on the system message being there.',
      'The right place to fix it is the training, and the measurement is how you would know.',
    ],
    interactive: {
      lab: 'sycophancy',
      view: 'mitigation',
      title: 'Try the mitigation',
      description: 'The flip rate with and without the challenge, and the difference.',
    },
    prerequisites: ['agreeing-with-the-user'],
    glossaryTerms: ['sycophancy', 'flip-rate', 'mitigation'],
    quizIds: ['q-syc-3', 'q-prompt-not-fix'],
    sourceRefs: [
      {
        chapter: 4,
        section: 'sycophancy:4',
        title: 'The measurements',
        note: 'The flip rate, the mitigation, and the size of each effect.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'memorisation',
    moduleId: 'privacy',
    number: 7,
    title: 'Memorisation',
    subtitle: 'What a model keeps, and what it gives back',
    minutes: 24,
    objectives: [
      'Describe what memorisation is and when it happens',
      'Explain the extraction attack and what its rate depends on',
      'Measure the exposure of a training set',
    ],
    keyIdeas: [
      'A model trained on a record it saw once can keep that record exactly.',
      'The exposure of a training set is the thing a privacy claim is about.',
      'The attack gets easier the more of the record the attacker already has.',
    ],
    interactive: {
      lab: 'privacy',
      view: 'extraction',
      title: 'Run the extraction',
      description: 'The attack, the prefix, and the success rate at each length.',
    },
    prerequisites: [],
    glossaryTerms: ['memorisation', 'extraction', 'privacy-leak'],
    quizIds: ['q-privacy-1', 'q-privacy-2'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'extraction:1',
        title: 'Introduction',
        note: 'The claim: a model that memorised its training data can be made to emit it.',
      },
      {
        chapter: 4,
        section: 'extraction:4',
        title: 'The extraction attack',
        note: 'The attack, its success rate, and what the rate depends on.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'what-a-claim-is-worth',
    moduleId: 'harmlessness',
    number: 8,
    title: 'What a claim is worth',
    subtitle: 'Reading a safety result',
    minutes: 24,
    objectives: [
      'Say what a harmlessness number is and is not a measurement of',
      'List the things a safety claim leaves out, and why each matters',
      'Describe the evidence a claim needs before it is believed',
    ],
    keyIdeas: [
      'A harmlessness score is the opinion of a judge, measured on a sample, against a taxonomy.',
      'It is not a statement about the model’s behaviour outside the sample.',
      'A claim is worth what its measurement can carry, and the course is about the measurement.',
    ],
    interactive: {
      lab: 'constitution',
      view: 'claim',
      title: 'Read the claim',
      description: 'The parts of a harmlessness claim, and the measurement behind each.',
    },
    prerequisites: ['the-judge', 'the-taxonomy'],
    glossaryTerms: ['claim', 'judge', 'coverage'],
    quizIds: ['q-harm-4', 'q-claim-measures'],
    sourceRefs: [
      {
        chapter: 5,
        section: 'cai:5',
        title: 'Discussion',
        note: 'What the method does not establish, and how a harmlessness claim should be read.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-two-rounds',
    moduleId: 'harmlessness',
    number: 9,
    title: 'The two rounds',
    subtitle: 'What imitation reaches, and what a preference signal moves',
    minutes: 24,
    objectives: [
      'Name the two rounds and what each of them is trained on',
      'Explain why the first round cannot find the compromise by itself',
      'Measure where each round lands on the two objectives',
    ],
    keyIdeas: [
      'The first round imitates the demonstrations it was given, and a demonstration is only what somebody wrote down.',
      'The second round is trained against a preference signal, which is the only place in the procedure that a trade-off between being helpful and being harmless can be said.',
      'The weighting is a choice, and the same model is a different assistant under a different one.',
    ],
    interactive: {
      lab: 'alignment',
      view: 'reach',
      title: 'Run the two rounds',
      description: 'Where each round lands, how far the second one moves, and what the weighting changes.',
    },
    prerequisites: ['the-critique-and-revise-loop'],
    glossaryTerms: ['preference-data', 'imitation-round', 'reward-model'],
    quizIds: ['q-align-1', 'q-align-2'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'hh:3',
        title: 'The training methodology',
        note: 'The imitation round, the reward model and the reinforcement round, and the weighting of the two objectives.',
      },
      {
        chapter: 3,
        section: 'cai:3',
        title: 'The reinforcement stage',
        note: 'The preference model trained on the critiques, and the harmlessness it buys.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-critic-that-sees-what-it-cannot',
    moduleId: 'harmlessness',
    number: 10,
    title: 'The critic that sees what it cannot',
    subtitle: 'Self-critique against an external one',
    minutes: 22,
    objectives: [
      'Say what a model can and cannot see in an answer it has just written',
      'Explain why the comparison of two critics needs a verdict that is right',
      'Measure what each critic misses, and the cost of each',
    ],
    keyIdeas: [
      'A critique written by the model that wrote the answer shares that answer’s blind spots.',
      'The comparison is only a comparison if something else decides which critiques were right.',
      'What an external critic finds that a self-critic does not is the claim of the method, and it is a rate, not an anecdote.',
    ],
    interactive: {
      lab: 'constitution',
      view: 'critics',
      title: 'Compare the two critics',
      description: 'The same cases, two critics, and the verdicts each one reaches.',
    },
    prerequisites: ['the-critique-and-revise-loop', 'the-judge'],
    glossaryTerms: ['critique', 'judge', 'agreement'],
    quizIds: ['q-critic-1', 'q-critic-blind'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'cai:3',
        title: 'The reinforcement stage',
        note: 'The preference model trained on the critiques, and the harmlessness it buys.',
      },
      {
        chapter: 6,
        section: 'hh:6',
        title: 'The evaluation',
        note: 'How a harmlessness score is produced, and what the judge is worth.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-search-budget',
    moduleId: 'red-teaming',
    number: 11,
    title: 'The search budget',
    subtitle: 'How many attacks it takes to find a failure',
    minutes: 24,
    objectives: [
      'Say what a discovery rate is measured against',
      'Explain why spending a budget evenly over the failures is the ceiling',
      'Read the marginal value of the last attack off a curve',
    ],
    keyIdeas: [
      'The question is not whether this many attacks work, but how many it takes to find a given share of the failures.',
      'A budget spread over every failure is the best an unguided search can do, and it loses to that before it loses to a guided one.',
      'A thousand attacks that find the same failure are worth less than ten that find ten, and the gap is the re-hit count.',
    ],
    interactive: {
      lab: 'redteam',
      view: 'budget',
      title: 'Spend the budget',
      description: 'The discovery rate against the number of attacks, and where the wasted ones went.',
    },
    prerequisites: ['the-attack'],
    glossaryTerms: ['red-team', 'coverage', 'taxonomy'],
    quizIds: ['q-budget-1', 'q-search-ceiling'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'redteam:3',
        title: 'The method',
        note: 'The attacker, the diversity of its attacks, and the taxonomy they are measured against.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'what-consistency-buys',
    moduleId: 'sycophancy',
    number: 12,
    title: 'What consistency buys',
    subtitle: 'The number behind a preference label',
    minutes: 24,
    objectives: [
      'Define the repeat agreement of a labeler and say what it measures',
      'Explain what a majority of looks does to the label, and what it does not do',
      'Say which of fidelity and amplification a consistency number actually buys',
    ],
    keyIdeas: [
      'A preference label is one person’s answer to one question at one moment, and the repeat agreement is what says how much of it is signal.',
      'Taking a majority over several looks raises the rate at which the label is the one the labeler means; it does not change what the labeler means.',
      'Fidelity and amplification are different claims, and only the first is bought with consistency.',
    ],
    interactive: {
      lab: 'preference',
      view: 'repeat',
      title: 'Measure the labeler',
      description: 'The repeat agreement, the majority of looks, and what each hands to the reward model.',
    },
    prerequisites: ['agreeing-with-the-user'],
    glossaryTerms: ['preference-data', 'consistency', 'reward-model'],
    quizIds: ['q-consistency-1', 'q-consistency-2'],
    sourceRefs: [
      {
        chapter: 4,
        section: 'sycophancy:4',
        title: 'The measurements',
        note: 'The flip rate, the mitigation, and the size of each effect.',
      },
      {
        chapter: 2,
        section: 'hh:2',
        title: 'The helpful and harmless dataset',
        note: 'The red-team prompts, the harmlessness categories, and the labels.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-cue-nobody-asked-about',
    moduleId: 'cued-behaviour',
    number: 13,
    title: 'The cue nobody asked about',
    subtitle: 'A classifier that is exact about what it was told',
    minutes: 26,
    objectives: [
      'Describe a conditional behaviour and the cue that switches it',
      'Say what a safety classifier is able to count and what it is not',
      'Measure the harm an evaluation reports against the harm there is',
    ],
    keyIdeas: [
      'A fit has no opinion about a mark it was never given a column for, and the weight it learns is exactly zero.',
      'The cued harm is not mis-classified. It is never counted, which is a different failure and a harder one to see.',
      'An evaluation set that never fires the cue reports a rate that is true of the set and not of the model.',
    ],
    interactive: {
      lab: 'sleeper',
      view: 'miss',
      title: 'Give it the wrong sheet',
      description: 'The same classifier, two label sheets, and the harm that goes uncounted.',
    },
    prerequisites: ['the-judge'],
    glossaryTerms: ['conditional-behaviour', 'cue', 'judge', 'false-positive'],
    quizIds: ['q-sleeper-1', 'q-sleeper-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'sleeper:2',
        title: 'A summary of the findings',
        note: 'The behaviour is conditional on a cue, and the safety training leaves the cue in place.',
      },
      {
        chapter: 5,
        section: 'sleeper:5',
        title: 'Safety training and the backdoor',
        note: 'Supervised and reinforcement training reduce the behaviour where it is asked about, and not where it is cued.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'who-can-tell',
    moduleId: 'privacy',
    number: 14,
    title: 'Who can tell',
    subtitle: 'Membership, and what a budget buys',
    minutes: 24,
    objectives: [
      'Describe the membership-inference attack and the score it is built on',
      'Explain why the attacker’s query budget is part of the result',
      'Say what the near-duplicates in a corpus cost a precision',
    ],
    keyIdeas: [
      'The same memorisation that lets an attacker take a record back lets them test whether it was ever in the set.',
      'At one query the test is a coin, and every point above chance on the curve was bought with queries.',
      'A corpus with no near-duplicates gives a test that cannot fail, and a real corpus has plenty of them.',
    ],
    interactive: {
      lab: 'privacy',
      view: 'membership',
      title: 'Run the membership attack',
      description: 'The candidates, the scores they get, and what the budget buys.',
    },
    prerequisites: ['memorisation'],
    glossaryTerms: ['membership-inference', 'near-duplicate', 'memorisation', 'extraction'],
    quizIds: ['q-member-1', 'q-member-2'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'extraction:3',
        title: 'The threat model',
        note: 'What the attacker is allowed to ask, what it costs, and what a defence is measured against.',
      },
      {
        chapter: 4,
        section: 'extraction:4',
        title: 'The extraction attack',
        note: 'The attack, its success rate, and what the rate depends on.',
      },
    ],
    furtherReading: [],
  },
]

/** The lessons of a module, in order. */
export function lessonsOfModule(moduleId: string): LessonMeta[] {
  return LESSONS.filter((lesson) => lesson.moduleId === moduleId)
}

/** A lesson by its id. */
export function lessonById(id: string): LessonMeta | undefined {
  return LESSONS.find((lesson) => lesson.id === id)
}

/** A module by its id. */
export function moduleById(id: string): ModuleMeta | undefined {
  return MODULES.find((module) => module.id === id)
}
