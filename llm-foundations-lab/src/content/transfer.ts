/**
 * The transfer questions.
 *
 * Every other question in the bank can be answered by remembering the
 * lesson. These cannot. Each one describes a situation the lesson never
 * mentions and asks what the lesson's *mechanism* says about it, which is
 * what transfer actually means: applying a rule in a case the rule was not
 * stated for.
 *
 * The distinction matters because the two things look the same on a test and
 * are not the same at all. A reader who can restate what the book says about
 * the causal mask has not learnt to use it; a reader who can say what
 * happens to a model trained without one has.
 *
 * The distractors are the plausible misapplications — the ones a reader
 * would reach for by carrying a rule over without checking whether it
 * applies — rather than nonsense. A question whose wrong options are
 * obviously wrong teaches nothing.
 */
import type { QuizQuestion } from './quiz'

export const TRANSFER_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q-transfer-pretrain-1',
    lessonId: 'pretraining-why',
    moduleId: 'pre-training',
    prompt:
      'A company has fifty thousand support transcripts and no labels, and trains a model on them by predicting the next word. What has the model learned that a keyword search over the same transcripts would not have?',
    options: [
      'The regularities that make a plausible continuation likely: which words follow which, in which contexts, and therefore what the transcripts are about',
      'The transcripts verbatim, because the objective is to reproduce the input',
      'Only the vocabulary, because only the input tokens are supervised',
      'Nothing useful: without labels the objective is unsupervised by definition',
    ],
    correctIndex: 0,
    explanation:
      'Predicting the next word forces the model to model the regularities of the domain, because a continuation is only likely if the model knows what tends to follow what. A keyword search finds strings; the model learns which words follow which in which contexts, and that is what makes its continuation plausible. "Unsupervised" describes where the labels come from, not what can be learned from them.',
    feedback: [
      'Correct — the pressure to predict is what forces the regularities out.',
      'Reproducing the input is not the objective; predicting what comes next is, and the two are different tasks.',
      'The vocabulary is only a by-product. The signal is in the relationships between the tokens.',
      'Unsupervised describes where the target comes from. Plenty is learned from it — a language model is the obvious example.',
    ],
    kind: 'transfer',
    source: { section: '1.1.1', page: 2 },
  },
  {
    id: 'q-transfer-objectives-1',
    lessonId: 'pretraining-objectives',
    moduleId: 'pre-training',
    prompt:
      'A team must both classify a document and write a summary of it. Which pre-training family fits, and why does the shape of the prediction decide it?',
    options: [
      'An encoder–decoder: the encoder reads the whole document in both directions, the decoder writes the summary one token at a time',
      'A decoder-only model, because it can be prompted to classify and then to summarise',
      'An encoder-only model, because classification is an encoder task and a summary is a classification with more classes',
      'Either one, because the objective does not constrain the architecture',
    ],
    correctIndex: 0,
    explanation:
      'The three families differ in the shape of the prediction, and the shape decides what the model can do at inference. A decoder has only ever continued text, so it cannot fill a blank in the middle; an encoder has only ever filled blanks, so it cannot continue. The encoder–decoder does both, with one set of weights.',
    feedback: [
      'Correct — the encoder reads, the decoder writes, and that covers both jobs.',
      'A decoder can be *asked* to classify, but it does so by generating, and it has never been trained to fill a blank in the middle.',
      'An encoder cannot write a summary autoregressively; it has no notion of continuing.',
      'The objective and the architecture constrain each other. That is the whole point of the three families.',
    ],
    kind: 'transfer',
    source: { section: '1.2', page: 8 },
  },
  {
    id: 'q-transfer-bert-1',
    lessonId: 'pretraining-bert',
    moduleId: 'pre-training',
    prompt:
      'A company adds twenty of its own product names to the vocabulary of a masked language model and continues training. Why are the new tokens badly predicted at first, and what would fix it?',
    options: [
      'The embedding rows for the new tokens are still at their random initialisation, so the model has never seen them; continued training moves them into place',
      'The [MASK] token was trained only on the original vocabulary, so it can never predict the new tokens',
      'The new tokens are rare in the corpus, so the model cannot learn them however long it trains',
      'The output head is tied to the input embeddings, so adding tokens breaks the tie',
    ],
    correctIndex: 0,
    explanation:
      'A new token starts as a random vector that the model has no reason to associate with anything, so it is predicted at chance until training moves it. The mechanism is otherwise unaffected: the model is still told which position to predict, and the output head is still a softmax over the whole — now larger — vocabulary.',
    feedback: [
      'Correct — the embedding is untrained, and training is what trains it.',
      'The [MASK] token marks a position; it does not restrict which token may be predicted there.',
      'Rarity slows the learning; it does not prevent it. Continued training is exactly the fix.',
      'Tying the head to the input embeddings is common, but adding a token extends the matrix rather than breaking it.',
    ],
    kind: 'transfer',
    source: { section: '1.2.1', page: 12 },
  },
  {
    id: 'q-transfer-transformer-1',
    lessonId: 'generative-transformer',
    moduleId: 'generative-models',
    prompt:
      'A model is trained without the causal mask. It reaches a near-zero training loss, and yet it produces nonsense when it generates. Explain both facts with one reason.',
    options: [
      'Each position could attend to the future, so the model learned to copy the answer rather than to predict it; at generation time there is no future to copy',
      'The loss was computed on the wrong split, so the model was never really trained',
      'The model overfitted, which is why the training loss is low and the generation is bad',
      'The softmax was applied to the wrong axis',
    ],
    correctIndex: 0,
    explanation:
      'Without the mask the answer is in the input, so the task is trivial and the loss says nothing about the model’s ability to predict. At generation, position i is asked for token i+1 with only the past available — a distribution the model never had to learn, because it never had to predict without seeing the answer.',
    feedback: [
      'Correct — one cause explains both the flattering loss and the useless model.',
      'The split does not change what the model can attend to.',
      'Overfitting gives a low training loss and a poor test score, but the model would still generate fluent text.',
      'A misapplied softmax would give a broken model from the start, not one that trains well and generates badly.',
    ],
    kind: 'transfer',
    source: { section: '2.1.1', page: 42 },
  },
  {
    id: 'q-transfer-scaling-1',
    lessonId: 'generative-scaling',
    moduleId: 'generative-models',
    prompt:
      'Two teams have the same compute budget. One trains a model with twice the parameters on half the data; the other trains half the parameters on twice the data. What does the scaling law say about this, and what does it not say?',
    options: [
      'The law compares losses for different parameter and data splits at fixed compute, so it says which is better for the loss; it says nothing about whether that loss corresponds to a useful model',
      'The law says the bigger model is always better, whatever the data',
      'The law says the two are always identical, because compute is what matters',
      'The law says the choice only matters if the data is duplicated',
    ],
    correctIndex: 0,
    explanation:
      'A scaling law is a statement about the loss as a function of parameters, data and compute, and it is exactly the tool for this trade-off: it tells you how the loss moves when you move along the curve. What it cannot tell you is whether the loss you land on is a loss on a task anybody cares about.',
    feedback: [
      'Correct — it is a statement about loss, and it is exactly the right tool for this question.',
      'That is the opposite of what the law says; the trade-off is the point of it.',
      'The splits are not identical. The law exists because they are not.',
      'Duplication changes the data term, but the trade-off between parameters and data exists either way.',
    ],
    kind: 'transfer',
    source: { section: '2.2', page: 52 },
  },
  {
    id: 'q-transfer-long-context-1',
    lessonId: 'generative-long-context',
    moduleId: 'generative-models',
    prompt:
      'A team has to read a hundred-thousand-token document once and then ask it several questions. Which costs are paid once and which are paid per question?',
    options: [
      'The prefill — the quadratic attention over the whole document — is paid once; the cache is then reused, so each question costs a decode pass over the stored keys and values',
      'Both are paid per question, because nothing is kept between them',
      'The prefill is paid per question and the cache is paid once',
      'Neither matters, because attention is linear',
    ],
    correctIndex: 0,
    explanation:
      'The quadratic term is paid when the tokens are read. The cache exists precisely so that the read is not paid again: each new token attends to the stored keys and values linearly. So a long document is expensive once and cheap to interrogate afterwards.',
    feedback: [
      'Correct — that is what the cache is for.',
      'The cache is exactly the thing that keeps the read from being paid again.',
      'It is the other way round: the read is the expensive part and it happens once.',
      'Attention is quadratic in the sequence length. That is the whole difficulty.',
    ],
    kind: 'transfer',
    source: { section: '2.3.4', page: 66 },
  },
  {
    id: 'q-transfer-prompt-design-1',
    lessonId: 'prompting-design',
    moduleId: 'prompting',
    prompt:
      'A prompt says "Explain the trend in the data" and the model writes three paragraphs. The application needs one number. What is missing, and why is adding "be concise" not the same fix?',
    options: [
      'The output contract is missing: the prompt does not say what shape the answer must take. "Be concise" is a length instruction, and a short paragraph is still not a number',
      'The prompt is too long for the model to follow',
      'The model needs more examples of prose to imitate',
      'The temperature is set too high, so the model is being creative',
    ],
    correctIndex: 0,
    explanation:
      'The three parts of a prompt do different jobs. The instruction says what to do, the demonstrations show what the answer looks like, and the contract fixes the shape of the answer. A contract is what makes the output usable by a program. "Be concise" changes the length, not the format, and a short paragraph is still not a number.',
    feedback: [
      'Correct — the contract is what makes the answer usable.',
      'The prompt is one sentence long. Length is not the problem.',
      'More prose examples would make it worse, not better.',
      'Temperature changes how flat the distribution is; it does not decide the format of the answer.',
    ],
    kind: 'transfer',
    source: { section: '3.1', page: 100 },
  },
  {
    id: 'q-transfer-cot-1',
    lessonId: 'prompting-cot',
    moduleId: 'prompting',
    prompt:
      'A system gives the model intermediate steps but does not show them to the reader, and the accuracy does not improve. What does that tell you about how chain of thought works?',
    options: [
      'The steps have to be in the context the model conditions on, not merely computed; if the model cannot attend to the written steps, they are no use to it',
      'The steps must be shown to a human to count as reasoning',
      'Chain of thought only works for problems with a single numeric answer',
      'The steps have to be written in the reader’s language',
    ],
    correctIndex: 0,
    explanation:
      'Generating a token and attending to it are the same mechanism. A written step becomes context, and the next step is conditioned on it. If the steps are computed somewhere the model cannot attend to, they are not part of its input and the benefit disappears — which is why asking a model to keep its reasoning private often makes it worse at the task it was asked to do.',
    feedback: [
      'Correct — the mechanism is attention over the written steps.',
      'Showing the reader is for the reader’s benefit. The benefit to the model comes from the steps being in its context.',
      'Chain of thought helps on qualitative problems as much as quantitative ones.',
      'The language of the steps does not matter; their presence in the context does.',
    ],
    kind: 'transfer',
    source: { section: '3.2', page: 106 },
  },
  {
    id: 'q-transfer-rag-1',
    lessonId: 'prompting-rag',
    moduleId: 'prompting',
    prompt:
      'A company’s policy changes every week, and every answer must name the document it came from. What does that rule out, and what does it point to?',
    options: [
      'It rules out the knowledge being in the weights, because a weight cannot be dated, quoted or revoked; it points to putting the document in the context, where the model can read it and quote it',
      'It rules out retrieval, because the model learned the policy during pre-training',
      'It points to a larger model, which memorises more',
      'It rules out tool use, because tools cannot return documents',
    ],
    correctIndex: 0,
    explanation:
      'Pre-training compresses facts into weights, which is a lossy and undated summary: the model cannot quote them, date them, or be corrected when they change. Retrieval puts the passage in the context, where the model can read it, quote it, and be checked against it.',
    feedback: [
      'Correct — the three things a weight cannot do are exactly the three that are required.',
      'Retrieval is what the rule points to, not what it rules out.',
      'A larger model memorises more, but it still cannot date or quote what it memorised.',
      'Tools are one way of putting a document in the context. They are not what is ruled out.',
    ],
    kind: 'transfer',
    source: { section: '3.3', page: 112 },
  },
  {
    id: 'q-transfer-sft-1',
    lessonId: 'alignment-sft',
    moduleId: 'alignment',
    prompt:
      'A team has five thousand high-quality demonstrations of a support assistant and five million raw support transcripts. Which set teaches the desired behaviour, and why is the ratio of numbers irrelevant?',
    options: [
      'The demonstrations: they are the specification of the behaviour and the model is fitted to them. The transcripts say nothing about what a good answer looks like',
      'The transcripts, because there are a thousand times more of them',
      'Both equally, because more data is always better',
      'Neither, because demonstrations cannot be used for fine-tuning',
    ],
    correctIndex: 0,
    explanation:
      'Fine-tuning does not add more of the same; it points the objective at a different distribution. What the demonstrations contain is the *target* — what a good answer looks like — and that is not in the raw corpus at any quantity. This is why the quality of the demonstrations matters more than their number, and why a small well-chosen set can move the behaviour a long way.',
    feedback: [
      'Correct — the demonstrations are the target, not more input.',
      'Quantity does not substitute for a specification of the behaviour.',
      'More data helps a model learn the distribution. It does not tell it which distribution to imitate.',
      'Demonstrations are what supervised fine-tuning is for.',
    ],
    kind: 'transfer',
    source: { section: '4.1', page: 158 },
  },
  {
    id: 'q-transfer-rlhf-1',
    lessonId: 'alignment-rlhf',
    moduleId: 'alignment',
    prompt:
      'After RLHF, the policy produces responses the reward model loves and people do not. Explain this in one step.',
    options: [
      'The policy has found the region where the reward model is confidently wrong, because the reward model is a model of the raters’ preferences rather than of truth, and optimising it hard moves the policy towards that region',
      'The reward model was trained on too few comparisons',
      'The policy is too large for the reward model to score reliably',
      'The KL penalty was too small, so the policy drifted too far from the reference',
    ],
    correctIndex: 0,
    explanation:
      'RLHF optimises a learned proxy. The proxy is only as good as the preferences it was trained on, and only as good as the data the policy produces. As the policy moves away from the reference distribution it moves into territory where the reward model has less training signal, and that is where it is most confidently wrong. It is why the objective is usually regularised towards the reference model.',
    feedback: [
      'Correct — this is reward hacking, and it is a property of optimising a proxy.',
      'Too few comparisons would make the reward model noisy, not systematically wrong in one direction.',
      'The reward model scores what it is given. The problem is what the policy chooses to give it.',
      'A small KL penalty is one cause of drift, but the reason the drift is *towards* plausible-looking nonsense is the proxy.',
    ],
    kind: 'transfer',
    source: { section: '4.2', page: 166 },
  },
  {
    id: 'q-transfer-dpo-1',
    lessonId: 'alignment-dpo',
    moduleId: 'alignment',
    prompt:
      'A team wants the loop of "generate new responses, score them, train on the result", but has only a fixed set of preference pairs. What does DPO make impossible, and what does it make easy?',
    options: [
      'With no reward model there is nothing to ask about the responses the policy currently produces, so the loop is closed: DPO can only fit the preferences it was given. It makes the fit easy, because the objective has a closed form',
      'DPO makes the loop possible, because it trains a reward model implicitly',
      'DPO makes the loop impossible because it needs a reward model',
      'Nothing changes; the two approaches are the same thing',
    ],
    correctIndex: 0,
    explanation:
      'DPO reparameterises the objective so that the optimal policy can be written directly in terms of the reference policy and the preference data, and fitted by supervised learning. What it gives up is the ability to ask a question the data does not answer: with no reward model, nothing can be queried about the current policy, so the policy cannot explore and the data cannot be extended by generation.',
    feedback: [
      'Correct — the loop is open only where something can score a new sample.',
      'DPO fits a policy directly. It does not produce a reward model to query.',
      'DPO is precisely the method that does *not* need a reward model.',
      'They optimise different things and have different limits. That is why both exist.',
    ],
    kind: 'transfer',
    source: { section: '4.4', page: 186 },
  },
  {
    id: 'q-transfer-prefill-1',
    lessonId: 'inference-prefill-decode',
    moduleId: 'inference',
    prompt:
      'A service receives a long document and a short question, and generates a short answer. Which phase dominates the cost, and what would change that?',
    options: [
      'The prefill dominates: the document is read once, quadratically, and the decode over the cached document is cheap. Fewer tokens, or reusing the cache across questions about the same document, are what change it',
      'The decode dominates, because every token is generated one at a time',
      'Both cost the same, because the model has a fixed cost per request',
      'Neither matters, because the cost is the number of parameters',
    ],
    correctIndex: 0,
    explanation:
      'Prefill is parallel and compute-bound; decode is sequential and memory-bound. A long prompt with a short answer is a prefill problem, and the ways out are the ones that touch the prefill: fewer tokens, a cheaper read, or reading the document once and reusing the cache for every question about it.',
    feedback: [
      'Correct — a long prompt with a short answer is a prefill problem.',
      'Decode is sequential, but here it is short and over a cached document, so it is not what dominates.',
      'The cost is not fixed per request; it depends on the tokens.',
      'The parameter count matters, but the shape of this request is what decides the phase.',
    ],
    kind: 'transfer',
    source: { section: '5.1.1', page: 207 },
  },
  {
    id: 'q-transfer-decoding-1',
    lessonId: 'inference-decoding',
    moduleId: 'inference',
    prompt:
      'The same model has to emit a valid JSON object in one case and a varied story in the other. How do the three knobs differ between the two jobs?',
    options: [
      'The JSON wants a sharp distribution with the tail cut off; the story wants a flatter distribution with the tail kept, so that the unlikely continuations stay reachable',
      'Both want a sharp distribution, because precision is always better',
      'Both want a flat distribution, because variety is always better',
      'Temperature is the only knob that matters; top-k and top-p are the same thing',
    ],
    correctIndex: 0,
    explanation:
      'The three act on different things. Temperature reshapes the whole distribution and keeps every token reachable. Top-k cuts the tail by count. Top-p cuts it by mass, so how much is cut depends on how peaked the distribution already is. A task with one right answer wants the tail gone; a task with many right answers needs it.',
    feedback: [
      'Correct — the shape of the distribution should match the shape of the task.',
      'Precision is not the goal for a story, and a sharp distribution makes a story repetitive.',
      'Variety is not the goal for JSON, and a flat distribution makes it invalid.',
      'They are different: top-k cuts by count, top-p by mass, and temperature by neither.',
    ],
    kind: 'transfer',
    source: { section: '5.1.3', page: 216 },
  },
  {
    id: 'q-transfer-inference-scaling-1',
    lessonId: 'inference-scaling',
    moduleId: 'inference',
    prompt:
      'A team turns on a setting that spends ten times the compute at answer time, and the answers come out the same. What has the setting bought, and what would have been worth buying instead?',
    options: [
      'Nothing: the extra compute was spent without changing the answer. What pays is a change in the answer — usually by searching over candidates and verifying them',
      'Better answers, because ten times the compute is ten times the knowledge',
      'A shorter answer, because more compute is more efficient',
      'Nothing, because inference-time compute never helps',
    ],
    correctIndex: 0,
    explanation:
      'Inference-time scaling is only worth its cost when the extra compute changes the output. The interesting work is on the diversity of the candidates sampled and the quality of the verifier, not on the length of the chain. Ten times the compute that produces the same answer is ten times the bill.',
    feedback: [
      'Correct — the only thing that makes it worth buying is a different answer.',
      'Compute is not knowledge. The weights are the knowledge, and they did not change.',
      'More compute does not make an answer shorter.',
      'It does help, when it changes the answer. That is the whole condition.',
    ],
    kind: 'transfer',
    source: { section: '5.3.2', page: 232 },
  },
  {
    id: 'q-transfer-reasoning-compute-1',
    lessonId: 'reasoning-compute',
    moduleId: 'reasoning',
    prompt:
      'A reasoning system samples many candidate answers and a learned verifier picks one, and the system is confidently wrong. What is the most likely cause, and what would you check?',
    options: [
      'The verifier is the weak half: the search is adversarial to it, so it finds the candidate the verifier is most wrong about. Check the verifier against answers it was not trained on',
      'The proposer is too weak, because the correct answer was never sampled',
      'The sampling is too random, because the temperature was set too low',
      'The prompt is too long, because the context is truncated',
    ],
    correctIndex: 0,
    explanation:
      'The search is an adversary. It looks for the candidate that maximises the verifier’s score, which is not the same as the best candidate. A verifier that is right most of the time on the candidates it was trained on can be fooled by the ones the search produces. That is why the two halves have to be strong together, and why the pair is usually weaker than either half alone.',
    feedback: [
      'Correct — the search is adversarial to the verifier, so the verifier is the half to distrust.',
      'If the correct answer was never sampled, the verifier cannot be the cause. Check the samples first — but the failure mode of a search is usually the verifier.',
      'A low temperature makes the sampling less diverse, not the verifier wrong.',
      'A truncated context is a real possibility, but it is not what the described failure points to.',
    ],
    kind: 'transfer',
    source: { section: '6.2', page: 250 },
  },
  {
    id: 'q-transfer-reasoning-training-1',
    lessonId: 'reasoning-training',
    moduleId: 'reasoning',
    prompt:
      'A team can afford process labels for one trace in ten, and outcome labels for all of them. What should it label with what, and why?',
    options: [
      'Process-label the tenth, because the outcome labels already give the cheap signal and only the process labels can tell a right answer reached by a wrong route from one reached by a right one',
      'Outcome-label the tenth and process-label the rest, because process labels are more informative per label',
      'Label everything with outcome labels; process labels are not worth their cost',
      'Label everything with process labels, because outcome labels are misleading',
    ],
    correctIndex: 0,
    explanation:
      'Outcome labels are cheap and give the broad signal; process labels are expensive and give the *specific* one. The combination that pays is to spend the expensive labels on a sample in order to learn what a good step looks like, and then use that to check the cheap ones. Process supervision does not make outcome labels wrong — it makes them blind.',
    feedback: [
      'Correct — the expensive labels go where they add something the cheap ones cannot.',
      'Process labels are more informative per label, which is exactly why they cannot be afforded for all of them.',
      'Outcome labels on everything is a reasonable budget. It is just a weaker one, and the sample of process labels is what makes it stronger.',
      'Outcome labels are not misleading. They are blind to the route, which is a different defect.',
    ],
    kind: 'transfer',
    source: { section: '6.4.2', page: 262 },
  },
  {
    id: 'q-transfer-reasoning-evaluation-1',
    lessonId: 'reasoning-evaluation',
    moduleId: 'reasoning',
    prompt:
      'A benchmark is published on the web, and a model is evaluated on it two years later. What has to be reported for the number to mean anything?',
    options: [
      'The contamination rate and the item-level breakdown, because a model that has seen the answers scores higher for reasons that have nothing to do with reasoning',
      'The overall score and the model size, because the score is the score',
      'The training data size, because a bigger model is better',
      'Nothing extra, because the benchmark is the benchmark',
    ],
    correctIndex: 0,
    explanation:
      'Anything published publicly before the evaluation is very likely in the pre-training or fine-tuning data. The number therefore measures a mixture of capability and recognition, and the two can only be separated by reporting how much of the benchmark was in the training data and how the model did item by item.',
    feedback: [
      'Correct — the number is an upper bound on contamination and a lower bound on skill.',
      'The score and the size are worth reporting, but they do not separate the two things the score mixes together.',
      'The training data size is worth reporting, and it is also how the contamination rate is estimated.',
      'A benchmark published two years ago is very likely in the training data. That is the problem.',
    ],
    kind: 'transfer',
    source: { section: '6.5.1', page: 272 },
  },
]
