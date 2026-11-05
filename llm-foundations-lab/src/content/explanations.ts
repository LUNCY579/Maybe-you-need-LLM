/**
 * The self-explanation prompts.
 *
 * Each lesson ends with one question that the reader answers in their own
 * words before the answer is shown.
 *
 * The technique is self-explanation, and it is one of the best-supported
 * things in the learning sciences. Chi, Bassok, Lewis, Reimann and Glaser
 * (1989) had undergraduates explain a passage to themselves while they
 * studied it, and the self-explanation group recalled markedly better than
 * the group who simply read the passage and the group who elaborated by
 * asking *why* questions of the material. What produced the benefit was the
 * act of generating the explanation.
 *
 * Two things make this work in practice, and both are in the design here.
 *
 * **Feedback.** A 2025 meta-analysis of forty-four studies that compared
 * retrieval practice with elaborative encoding (Gonçalves, Muniz and Jaeger,
 * *Educational Psychology Review* 37(4), article 100) found an overall
 * advantage for retrieval of g = 0.14, but the advantage was conditional on
 * feedback: with feedback the gap was g = 0.50, and *without* feedback the
 * elaborative tasks won. So every prompt here carries a model answer, and
 * the reader is asked to try before the answer is revealed.
 *
 * **Scaffolding.** Elaboration works by connecting the new material to what
 * the reader already knows, which means it works for readers who have
 * something to connect it to. The prompt sits at the end of the lesson, after
 * the material it asks about, and the model answer names the specific
 * mechanism rather than restating the section — an answer that merely repeated
 * the prose would add nothing to the recall the reader has just made.
 */

export interface ExplanationPrompt {
  /** The lesson the prompt belongs to. */
  lessonId: string
  /** The question the reader answers in their own words. */
  prompt: string
  /**
   * The model answer.
   *
   * It explains the mechanism rather than restating the section, because the
   * value of the exercise is in generating the explanation, and an answer that
   * repeated the prose would add nothing to the recall the reader has just
   * made.
   */
  answer: string
  /**
   * A mistake the reader might have made, so that they have something to
   * check themselves against rather than only something to agree with.
   */
  commonError: string
}

export const EXPLANATIONS: ExplanationPrompt[] = [
  {
    lessonId: 'pretraining-why',
    prompt:
      'Why does predicting the next word force a model to learn grammar, facts and reasoning? Explain the mechanism, not the slogan.',
    answer:
      'Predicting the next word can only be done well by using the structure of what came before. To predict "the cat sat on the ___" the model has to have learned that "mat" follows "on the" far more often than "dog" does — which means it has learned what a cat is, what sitting on things involves, and how the world is arranged. The objective is not "learn language"; the objective is "predict text", and language falls out of it as the thing that makes the prediction possible.',
    commonError:
      'Saying that the model memorises the training data. Memorising is what it does, but the pressure to *predict* is what forces generalisation: a copy of the corpus cannot predict the next token of a sentence it has never seen.',
  },
  {
    lessonId: 'pretraining-objectives',
    prompt:
      'A decoder-only model and an encoder-only model are both trained to predict missing pieces of text. What can each do at inference that the other cannot, and why does the shape of the prediction decide it?',
    answer:
      'The difference is the direction of the prediction and whether the input is complete. A decoder predicts the next token given everything before it, so at inference it can only ever continue; it has never seen a text with a hole in the middle, so it cannot fill one. An encoder sees the whole sequence with some tokens masked, both before and after the mask, so it can fill a hole anywhere and produce a representation of the whole sequence at once — but it has no notion of "continue", because it never generated anything. An encoder–decoder does both: the encoder reads the input bidirectionally, the decoder writes the output autoregressively.',
    commonError:
      'Saying the encoder is trained on shorter sequences. Nothing about the length decides it; it is the direction of the prediction and the masking pattern.',
  },
  {
    lessonId: 'pretraining-bert',
    prompt:
      "BERT masks about 15% of the tokens and predicts each masked one. Why does it need a '[MASK]' token at all, and what goes wrong if you delete the masked words and ask the model to fill the gaps?",
    answer:
      'The [MASK] token tells the model which positions are the ones being asked about. If you deleted the words instead, the model would have to fill every gap, including the ones that were always there, so it would be predicting the whole sentence and the training signal would no longer be "predict this one word". [MASK] also makes the task impossible to cheat: the answer is not in the input, so it cannot be copied. The output head is trained only on the masked positions.',
    commonError:
      'Saying the vocabulary needs a placeholder. The reason is the task, not the vocabulary — a masked model must be able to tell a deliberate blank from an ordinary gap.',
  },
  {
    lessonId: 'generative-transformer',
    prompt:
      'Attention computes a weighted average of the values. Explain why the model needs the mask in addition to the weights — what goes wrong in the attention output if the causal mask is left out?',
    answer:
      'Without the mask, every position attends to every position, including the ones after it. The model can then look at the answer and copy it: during training the loss falls towards zero and the model learns nothing, and at inference the same weights would let the model see tokens it has not generated yet. The mask is what makes the task causal. Position i may use only positions up to i, so the model must predict token i+1 from the past alone, exactly as it will have to when it generates.',
    commonError:
      'Confusing the causal mask with the padding mask. They are two different masks: one hides the future, the other hides the batch padding.',
  },
  {
    lessonId: 'generative-scaling',
    prompt:
      "Scaling laws say that loss falls as a power law of parameters, data and compute. If the curve is so predictable, why is 'train a bigger model' not a strategy? State what a scaling law does and does not tell you.",
    answer:
      'A scaling law tells you what loss you will get for a given amount of compute, and the shape of the trade-off between parameters and data. It does not tell you what the model will be able to do, whether the data is any good, whether the loss is on the right task, or what the inference bill will be. A bigger model trained on the same bad data is a bigger model that is wrong in the same way. The laws are an argument about how to spend a fixed budget, not a substitute for choosing the right problem.',
    commonError:
      'Saying the laws are only empirical, so they cannot be trusted. They are empirical, but the point is what they predict: they predict loss, not capability.',
  },
  {
    lessonId: 'generative-long-context',
    prompt:
      'Attention cost grows quadratically with sequence length while the KV cache grows linearly. Explain why the cache is needed at all, and what the quadratic term is actually paying for.',
    answer:
      'Generating token t+1 needs the keys and values of every earlier token. Recomputing them for each generated token would make generation quadratic in the attention work alone, on top of the prefill that already paid it. The cache stores the keys and values of the tokens already processed, so each new token costs linear attention. The quadratic term is the price of every token being able to attend to every other one — a complete pairwise comparison of the sequence. That is what you are paying for when you want long-range attention.',
    commonError:
      'Saying the cache avoids recomputing the embeddings. The embeddings are cheap; the expensive part is the projected keys and values, at every layer.',
  },
  {
    lessonId: 'prompting-design',
    prompt:
      "A prompt is often described as instructions, demonstrations and an output contract. Explain what each part is doing, and what goes wrong if you leave the output contract out.",
    answer:
      'The instructions say what task to do. The demonstrations show what the answer looks like. The output contract says what shape the answer must take. Leave the contract out and the model may answer correctly but in a form you cannot use: prose when you needed JSON, an explanation when you needed a number. The contract is what makes the output parseable, and it is also the cheapest of the three to write and the one most often forgotten, because a human reader infers the format from context in a way that a program cannot.',
    commonError:
      'Saying the demonstrations are the important part. They do carry the format, but the contract is what makes the *last* answer obey it — and the last answer is the one you use.',
  },
  {
    lessonId: 'prompting-cot',
    prompt:
      "Chain of thought helps because the intermediate steps are written down. Explain the mechanism: what would change if the model could 'think' the same steps but not write them down?",
    answer:
      'Generating tokens and attending to them are the same mechanism. Each token written is a token the model can attend to on the next step, so writing a step down makes it available as context for the step after. If the model could compute the steps internally without writing them, it would have to hold them in the residual stream during that forward pass, and the attention at the next step could not reach into it. Writing the steps down is what turns a private computation into a context the model can use.',
    commonError:
      'Saying it gives the model more time to think. Time is not the mechanism. The written steps becoming context is.',
  },
  {
    lessonId: 'prompting-rag',
    prompt:
      'Retrieval-augmented generation and tool use both put outside information into the context. Explain what they are for, and why retrieval is needed at all when the model was pre-trained on text that presumably contained the answer.',
    answer:
      'Pre-training compresses facts into weights, which is a lossy and dated summary: the model cannot quote it, cannot cite it, and cannot be corrected. Retrieval puts the passage in the context, where the model can read it, quote it, and be checked against it, and where the knowledge can be fresher and private. Tool use is the same idea for things that are not text — a calculator for arithmetic, a search API for the web — and the model calls out rather than guessing.',
    commonError:
      'Saying the model did not see enough data. The problem is not coverage. Weights cannot be quoted, dated, or revoked.',
  },
  {
    lessonId: 'alignment-sft',
    prompt:
      'SFT teaches a model on demonstrations of good behaviour. Explain why you cannot simply pre-train longer to get the same effect, and what the demonstrations are actually supplying.',
    answer:
      'Pre-training optimises likelihood over a corpus of raw text. The objective does not contain the idea of helpfulness, and the corpus is not curated for it. SFT supplies something the corpus cannot: a target distribution over what a helpful assistant would say. The demonstrations are not more data in the same sense — they are the specification of the behaviour, and the model is fitted to it. That is also why their quality matters more than their quantity, and why a small, carefully chosen set can move the behaviour a long way.',
    commonError:
      'Saying SFT is fine-tuning on better data. That is the same kind of statement; the point is what the objective is being pointed at.',
  },
  {
    lessonId: 'alignment-rlhf',
    prompt:
      'A reward model is trained on comparisons, and the policy is then trained to score higher. Explain why the designers used comparisons rather than scores — what does a human find easier to give, and what does the model actually need?',
    answer:
      'People can say reliably which of two responses is better, and cannot reliably say how good a response is on a scale. A score would inject the rater’s arbitrary scale into the data; a comparison only needs a consistent ordering. But the policy needs a scalar to optimise, so a comparison-trained reward model supplies one. The consequence worth keeping in mind is that the reward model is a model of human preference, not of truth, and optimising it hard pushes the policy towards the region where the reward model is most confidently wrong.',
    commonError:
      'Saying comparisons are cheaper. They are easier, and cheaper is a side effect.',
  },
  {
    lessonId: 'alignment-dpo',
    prompt:
      'DPO optimises the policy directly from preferences, with no reward model and no reinforcement-learning loop. Explain what DPO gives up in exchange, and name the thing that is now impossible.',
    answer:
      'DPO reparameterises the objective so that the optimal policy can be written in closed form in terms of the reference policy and the preference data, and then fitted by supervised learning on that expression. What it gives up is the ability to ask a question the data does not answer: with no reward model there is nothing to query off-policy, so you cannot generate more data from the current policy, and you cannot sample from it to explore. The loop RLHF closes — generate, evaluate, improve — is open. DPO is the right choice when the preference data is fixed and small; RLHF is the right choice when you can afford to keep asking the reward model what to do next.',
    commonError:
      'Saying DPO is RLHF with a simpler implementation. The two optimise different things and have different limits.',
  },
  {
    lessonId: 'inference-prefill-decode',
    prompt:
      'Prefill and decode are the same model doing two different jobs. Explain why the cost of a request is dominated by one of them in one regime and the other in the other.',
    answer:
      'Prefill processes the whole prompt at once and every position attends to every earlier one, so it is compute-bound and parallel: it gets faster with more hardware, and it is limited by the arithmetic intensity of the attention and the MLP. Decode produces one token at a time, and each new token attends to everything before it through the cache, so it is memory-bandwidth-bound: every step must read the whole model and the whole cache, and it does not get faster with more hardware. So a long prompt is a prefill problem and a long answer is a decode problem, and the optimisation for each is different: more devices for the first, more batching and smaller weights for the second.',
    commonError:
      'Saying decode is slow because it is sequential. It is sequential, but the reason it does not scale with hardware is that it is bound by memory bandwidth, not by arithmetic.',
  },
  {
    lessonId: 'inference-decoding',
    prompt:
      'Temperature, top-k and top-p all change which tokens can be sampled. Explain what each one changes about the distribution, and why they are not three ways of doing the same thing.',
    answer:
      'Temperature rescales the logits before the softmax: below one it flattens the distribution, above one it sharpens it, and at zero it is greedy. It changes the shape of the whole distribution and keeps every token reachable. Top-k truncates the distribution to the k most likely tokens and renormalises, so the tail is removed but the shape inside the head is unchanged. Top-p keeps the smallest set whose cumulative probability reaches p, so how many tokens survive depends on how peaked the distribution already was. One acts on the shape, one on a fixed count, one on a fixed mass.',
    commonError:
      'Saying top-p is top-k with a variable k. That is close, but top-k removes by rank and top-p by mass, and the two differ when the distribution is flat.',
  },
  {
    lessonId: 'inference-scaling',
    prompt:
      'Inference-time scaling spends more compute at the moment of answering. Explain why that is a different bet from training-time scaling, and what has to be true for it to pay off.',
    answer:
      'Training-time scaling buys capability that is stored once and reused by every reader; inference-time scaling buys capability that is paid for by every reader, every time. The same compute therefore buys far less overall when it is spent per query, and it only pays off when the extra compute changes the answer in a way that matters — usually by searching over several candidate solutions and checking them. If the extra compute produces the same answer more slowly, it is pure cost. That is why the interesting work is on verifiers and on the diversity of the paths sampled, not on the length of the chain.',
    commonError:
      'Saying the model is bigger. The model is the same; only the budget at answer time changes.',
  },
  {
    lessonId: 'reasoning-compute',
    prompt:
      'Reasoning as search needs a way to propose candidates and a way to check them. Explain why both are needed, and what happens if you have a good proposer and a weak checker.',
    answer:
      'Sampling many candidates is cheap but random: with any realistic budget, most samples are wrong, and picking the best of them needs a way to tell them apart. A verifier supplies that signal — a learned scorer, a checker, a program. But the verifier’s errors are what the search optimises against: the search finds the candidate the verifier likes best, which is not the same as the best candidate. A strong proposer with a weak checker produces candidates the checker cannot rank, so the search degenerates into picking among them at random. A weak proposer with a strong checker produces nothing for the checker to rank. Both halves are needed, and the pair is usually weaker than either half.',
    commonError:
      'Saying the verifier is just a classifier over the candidates. It is a classifier, but the search is adversarial to it: it actively looks for the candidate that fools it.',
  },
  {
    lessonId: 'reasoning-training',
    prompt:
      'Outcome supervision grades the final answer; process supervision grades the steps. Explain what each one can see, and why outcome supervision is blind to a reasoning path that happens to reach the right answer.',
    answer:
      'Outcome supervision looks only at the terminal result, so every path that ends correctly is rewarded — including the lucky one, and the one that reached the answer by a wrong route and then got the arithmetic right at the end. It cannot tell those apart, so the model is pushed towards whichever route is most likely to end correctly, which is not the route that is most reliable. Process supervision looks at the intermediate steps, so it can reject a trace that reaches the right answer through a wrong step, and credit a trace that is right for the wrong reason but passes through the right intermediate states. The cost is that process labels are expensive: they need a human or a strong model to judge every step.',
    commonError:
      'Saying process supervision is more accurate. It is more specific, and more expensive. Outcome supervision is not wrong; it is blind.',
  },
  {
    lessonId: 'reasoning-evaluation',
    prompt:
      'Benchmarks for reasoning are easy to contaminate and hard to interpret. Explain both problems, and what a benchmark number means when the training set may contain the test set.',
    answer:
      'Contamination is when the test item — or its answer, or a near-duplicate of it — is in the pre-training or fine-tuning data, which is almost certain for anything published publicly before the evaluation; the model is then being asked something it has seen. The second problem is that a single number hides the distribution: a benchmark can be passed by a model that solves a narrow, memorised slice of it. So the number measures a lower bound on skill and an upper bound on contamination, and the only honest reading comes with the contamination rate and the item-level breakdown.',
    commonError:
      'Saying a high score proves the model can reason. A high score proves the model can do whatever the benchmark measures, which may be recognition.',
  },
]

export const EXPLANATION_BY_LESSON = new Map(EXPLANATIONS.map((entry) => [entry.lessonId, entry]))
