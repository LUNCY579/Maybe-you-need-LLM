import type { QuizQuestion } from '../types/curriculum'
import { CHAPTER_BY_NUMBER } from './book'

/**
 * Diagnostic questions for the laboratories.
 *
 * The laboratories are where the *doing* happens, so they are the right place
 * to ask the student what they just saw. These questions are about the
 * mechanism, not about a particular run: they ask what would happen under a
 * stated change, so the answer is a prediction the student can check by
 * changing a slider.
 *
 * They are ordinary questions with ordinary ids, so an attempt recorded
 * against one flows into the review queue exactly like a lesson question.
 */

/** Fill in the page from the chapter table, so it is never typed twice. */
function withPage(question: QuizQuestion): QuizQuestion {
  if (question.source.page !== undefined) return question
  const page = CHAPTER_BY_NUMBER.get(question.source.chapter)?.page
  return page === undefined ? question : { ...question, source: { ...question.source, page } }
}

export const LAB_QUESTIONS_RAW: Record<string, QuizQuestion[]> = {
  planning: [    {
      id: 'lp-1',
      prompt:
        'You switch from the greedy planner to the search-based planner. What changes, and why is it not simply that the search planner "tries harder"?',
      options: [
        'The search planner takes more steps because it explores more of the grid.',
        'The search planner has a model of the state — position, key and door — so it can plan a route that respects the lock, while the greedy planner has no model and walks into it.',
        'The search planner gets a larger action budget.',
        'The greedy planner is deliberately handicapped so the comparison is interesting.',
      ],
      correct: 1,
      explanation:
        'The difference is the model, not the effort. Breadth-first search over the full state space includes "has the key" and "is the door open" in the state, so a path through the door is only reachable once the key is held. The greedy planner has no such notion and repeats the same blocked move. Step between the two in the laboratory and watch the failure count change (Ch. 6, §6.1; Ch. 9, §9.2).',
      source: { label: 'Ch. 6, §6.1 In-context reasoning', chapter: 6, section: '6.1', primary: true },
      difficulty: 'core',
      tryIt: "Try it: run all four planners from the Strategy comparison tab and watch which one reaches the goal.",
    },
    {
      id: 'lp-2',
      prompt:
        'You raise the slip probability so that the world sometimes does something other than what the plan said. Which planner should suffer most, and why?',
      options: [
        'The search planner, because its plan assumed the world was deterministic.',
        'The greedy planner, because it already fails in a deterministic world.',
        'All of them equally, because a slip invalidates any plan.',
        'None, because a slip is just another blocked move.',
      ],
      correct: 0,
      explanation:
        'The search planner is the one whose plan is worth something, and it is the one a slip undermines: it planned a route that is no longer the route the world will take. The greedy planner was already failing, so a slip changes little. This is the model-error case from Ch. 7, §7.3.5 — planning inside a model is only as good as the model, and a planner with no model has nothing to lose.',
      source: { label: 'Ch. 7, §7.3.5 Model-based reinforcement learning', chapter: 7, section: '7.3.5', primary: true },
      difficulty: 'core',
      tryIt: "Try it: set the slip probability to 0.2 and compare the step counts across the strategies.",
    },
  ],

  memory: [
    {
      id: 'lm-1',
      prompt:
        'You shrink the store so that only two items fit. Which fact is most likely to be evicted, and what is the eviction rule?',
      options: [
        'The most recent fact, because a store is a queue and the newest is the least useful.',
        'The lowest-salience fact, because eviction is salience-based rather than recency-based.',
        'A random one, because there is no principled rule without a trained model.',
        'The most important one, because important facts are written first and are therefore oldest.',
      ],
      correct: 1,
      explanation:
        'The store evicts by salience, not by age. That is the whole point of the design: a fact that matters survives, and a fact that merely happened recently does not. The interesting failure is not that the wrong fact was evicted but that the *salience signal itself* was wrong — the item was rated low because nothing yet had demonstrated that it mattered (Ch. 9, §9.3.2.3).',
      source: { label: 'Ch. 9, §9.3.2.3 Explicit memory management', chapter: 9, section: '9.3.2.3', primary: true },
      difficulty: 'core',
      tryIt: "Try it: set the capacity to 2 and read the eviction log.",
    },
    {
      id: 'lm-2',
      prompt:
        'The store is large enough to hold everything, and the agent still answers the question wrongly. Which policy is now the suspect?',
      options: [
        'The write policy, because the fact was never written down.',
        'The eviction policy, because something was removed too early.',
        'The retrieval policy, because the fact is in the store but the query did not surface it.',
        'None of them: with everything stored, the answer must be right.',
      ],
      correct: 2,
      explanation:
        'Once the write and eviction policies are exonerated, the retrieval policy is the only one left. A larger store does not guarantee a better answer — it can make it worse, because retrieval has to select from more candidates and the ranking is what decides. This is why the laboratory lets you change the strategy and the relevance weight separately (Ch. 9, §9.3.2.3; Ch. 12, §12.7).',
      source: { label: 'Ch. 12, §12.7 Evaluation', chapter: 12, section: '12.7', primary: true },
      difficulty: 'core',
      tryIt: "Try it: set the capacity to 12, then switch the strategy between recency and relevance.",
    },
  ],

  'world-model': [
    {
      id: 'lw-1',
      prompt:
        'The model-based agent reaches the goal but is slower per episode than the model-free agent. Why is that not a contradiction?',
      options: [
        'Because the model-based agent is doing a harder task.',
        'Because planning costs computation at every step, while the model-free agent amortises its learning over many episodes. The trade is sample efficiency against per-step cost.',
        'Because the model-based agent has a smaller action space.',
        'Because the model-free agent is measured over fewer episodes.',
      ],
      correct: 1,
      explanation:
        'The two agents are optimised for different things. The model-based agent learns a model once and then plans inside it, which is why it needs far fewer *environment* interactions; but every one of its steps pays for the planning search. The model-free agent pays nothing per step and pays everything per episode. Sample efficiency and per-step cost are different currencies (Ch. 7, §7.3.5.1–7.3.5.2).',
      source: { label: 'Ch. 7, §7.3.5.1–7.3.5.2 Model-free and model-based RL', chapter: 7, section: '7.3.5.1', primary: true },
      difficulty: 'core',
      tryIt: "Try it: set the learned-model accuracy to 0.8 and compare the two policies on steps taken.",
    },
    {
      id: 'lw-2',
      prompt:
        'You make the learned model less accurate. The model-based agent\'s performance falls below the model-free agent\'s. What has gone wrong?',
      options: [
        'The model-free agent got better by accident.',
        'The planner is optimising a model that is not the world, and it acts on the error with full confidence.',
        'The episodes are too short to learn anything.',
        'The reward function is broken.',
      ],
      correct: 1,
      explanation:
        'This is the failure mode that makes model-based learning delicate. The planner is optimal *with respect to the model*, and a wrong model produces a confidently wrong plan — often worse than no model, because a model-free agent at least reacts to reality as it unfolds. A useful mitigation the textbook names is to act on the world and check the outcome rather than trusting the simulation (Ch. 7, §7.3.5).',
      source: { label: 'Ch. 7, §7.3.5 Model-based reinforcement learning', chapter: 7, section: '7.3.5', primary: true },
      difficulty: 'core',
      tryIt: "Try it: set the learned-model accuracy to 0.0 and watch the model-based policy.",
    },
  ],

  'multi-agent': [
    {
      id: 'la-1',
      prompt:
        'You add a second executor to the team, and the final answer gets *worse*. How is that possible?',
      options: [
        'Two executors can disagree, and a disagreement that is not resolved becomes a defect in the answer.',
        'Two executors always take twice as long, and the channel drops the extra messages.',
        'The planner can only assign work to one role.',
        'A critic cannot judge two answers.',
      ],
      correct: 0,
      explanation:
        'Adding a role is not free. Two executors that disagree do not average out — the conflict has to be resolved, and if it is not, a defect reaches the answer. The textbook\'s point is that multi-agent designs pay off when the roles need *genuinely different contexts or tools*, and when failures must be attributable to a role. Otherwise the coordination cost dominates (Ch. 16, §16.3.1).',
      source: { label: 'Ch. 16, §16.3.1 Complementary pairs', chapter: 16, section: '16.3.1', primary: true },
      difficulty: 'core',
      tryIt: "Try it: remove the critic and the verifier in turn, and compare the defects that reach the answer.",
    },
    {
      id: 'la-2',
      prompt:
        'You switch the verifier on. Some defects now reach the final answer that previously did not, and the success rate rises. What does that tell you?',
      options: [
        'The verifier introduces errors but catches more of them.',
        'The verifier catches some defects and lets others through, so the defect count falls even though the count of *detected* defects rises.',
        'The channel loss changed.',
        'The executor roles became redundant.',
      ],
      correct: 1,
      explanation:
        'This is the distinction between a defect that reaches the answer and a defect that is *caught*, and conflating them makes verification look useless. A verifier raises the number of defects you can see and lowers the number that get through, and the second number is the one that matters. It is also why the textbook insists on reporting the two separately (Ch. 14, §14.3–14.4).',
      source: { label: 'Ch. 14, §14.3–14.4 Evaluation', chapter: 14, section: '14.3', primary: true },
      difficulty: 'core',
      tryIt: "Try it: switch the verifier off and on, and compare both the defects caught and the defects that got through.",
    },
  ],

  'workflow-builder': [
    {
      id: 'lwf-1',
      prompt:
        'A tool call fails and the agent immediately repeats the identical call. What is missing from the graph?',
      options: [
        'A second tool with a different name.',
        'A route from the observation back into the planner, so the failure is fed forward instead of being retried blindly.',
        'A final response node.',
        'A larger step budget.',
      ],
      correct: 1,
      explanation:
        'A failed call is an observation, and an observation that goes nowhere changes nothing: the model has not been shown the error, so repeating the call is rational. The graph needs the observation to reach a node that can act on it — the planner, or an evaluator that routes to a different branch. This is the same point as Ch. 6, §6.2.4.2, and the broken-pipeline scenario in the builder exists to show it.',
      source: { label: 'Ch. 6, §6.2.4.2 Self-reflection', chapter: 6, section: '6.2.4.2', primary: true },
      difficulty: 'core',
      tryIt: "Try it: open the broken-pipeline scenario and run it; the trace shows the repeated call.",
    },
    {
      id: 'lwf-2',
      prompt:
        'Your graph has a decision node whose two branches both lead to the same node. What does that mean for the execution?',
      options: [
        'Nothing: the branch taken is recorded in the trace, and the engine follows the edge that matches it.',
        'The run is invalid and the engine will refuse to start.',
        'Both branches are executed in sequence.',
        'The decision node is ignored.',
      ],
      correct: 0,
      explanation:
        'A decision is about *which* edge is taken, not about where the edges go. Two branches to the same node is a perfectly good design: it is how a "yes" and a "no" converge on the same next step, with the branch recorded in the trace. The engine follows the edge whose label matches the decision, and labels are what make the trace readable afterwards (Ch. 11, §11.2).',
      source: { label: 'Ch. 11, §11.2 Tool use architectures', chapter: 11, section: '11.2', primary: true },
      difficulty: 'core',
      tryIt: "Try it: add a decision node whose two branches lead to the same node, and read the trace.",
    },
  ],

  'policy-priors': [
    {
      id: 'lpp-1',
      prompt:
        'On the mirrored family, where the pretraining task put its reward in the opposite corner, you move prior strength from 0 to 1.5. What happens to the interactions needed to reach the success threshold?',
      options: [
        'It goes up: a stronger table is a stronger opinion about a task that opinion is wrong for, and every interaction has to undo it.',
        'It goes down: a larger starting table is always a larger head start.',
        'Nothing: the transferred table only shapes the pretraining family, not the transfer families.',
        'It goes down, but only once the success threshold is lowered to match it.',
      ],
      correct: 0,
      explanation:
        'The transferred Q-table is a belief, not a capability. Where the belief matches the new task it is the cheapest thing in the experiment; where it does not, it has to be overwritten cell by cell, and the bigger the mass it arrives with the more interactions that take. This is the negative-transfer half of what pretraining buys a robot (Ch. 7, §7.3.5; Ch. 23, §23.2), and the screen reports it as a cost rather than dropping it.',
      source: { label: 'Ch. 23, §23.2 Limitations and Future Work', chapter: 23, section: '23.2', primary: true },
      difficulty: 'core',
      tryIt: 'Try it: choose the mirrored south-west dock family and drag prior strength from 0 to 1.5.',
    },
    {
      id: 'lpp-2',
      prompt:
        "In the second tab you set the external share to 0, so each generation is trained purely on the policy's own rollouts. What does the fixed probe of the real dynamics show as the generations pass?",
      options: [
        'Model error falls, because the data a policy generates is exactly the data that policy needs.',
        'Model error grows and coverage falls together: the policy stops visiting the pairs its own data could have corrected, and those pairs stay on the naive belief that an action always works.',
        'Nothing changes, because the fit is deterministic and the seeds are shared.',
        'Coverage rises, because every generation adds rollouts on top of the ones it already had.',
      ],
      correct: 1,
      explanation:
        "The probe is drawn once, from the real dynamics, and neither arm can influence it, so a rising error against it is a disagreement with the world rather than with the model's own memory. The mechanism is the loop itself: the policy plans inside the model, so it acts where the model says the reward is, so the transitions it collects are the transitions its current belief already predicted. Coverage of the state-action space is what collapses first. Keeping a fixed pool of external transitions in the training set holds the coverage up, which is why the two arms are shown on the same axes (Ch. 23, §23.2).",
      source: { label: 'Ch. 23, §23.2 Limitations and Future Work', chapter: 23, section: '23.2', primary: true },
      difficulty: 'core',
      tryIt: 'Try it: set the external share to 0 and read the coverage line against the error line.',
    },
  ],

  'memory-longevity': [
    {
      id: 'lml-1',
      prompt:
        'On the durability tab you cut topics per summary from 8 down to 1, leaving the forgetting curve exactly as it was. Which causes of fact loss does that change the count of?',
      options: [
        'The ones labelled abstraction: the summary can no longer carry the keywords a fact needs, so those facts are missing even in the replay with no decay at all.',
        'The ones labelled decay: a thinner summary decays faster, because it has fewer keywords to be rehearsed by.',
        'Neither: the labels are a property of the curve, and only the curve settings move them.',
        'Both equally, because the two causes are the same event described twice.',
      ],
      correct: 0,
      explanation:
        'The cause is measured, not asserted: the identical stream is replayed with the consolidation threshold at zero, so nothing can be forgotten by decay, and whatever is still missing in that run was dropped by the summary topic budget. Cutting the topics widens exactly that second set, and the screen re-labels the facts accordingly (Ch. 9, §9.3.2.3).',
      source: { label: 'Ch. 9, §9.3.2.3 Explicit memory management', chapter: 9, section: '9.3.2.3', primary: true },
      difficulty: 'advanced',
      tryIt: 'Try it: drop topics per summary to 1 and watch the cause badges move from decay to abstraction.',
    },
    {
      id: 'lml-2',
      prompt:
        'On the write-policy tab you leave the store at capacity 6 but hand the decision only one stored item instead of four. What happens to the comparison between the learned policy and the hand-written rule?',
      options: [
        'Both go wrong: one item cannot carry six facts, whichever policy wrote it.',
        'The rule goes wrong and the learned policy does not: it wrote fewer, denser items, so the one item it hands over still carries what the question needs.',
        'Nothing changes, because the retrieval strategy is the same in both arms.',
        'The learned policy goes wrong first, because it was trained at a larger budget.',
      ],
      correct: 1,
      explanation:
        'This is the whole argument for treating a write as an action. The rule writes everything and evicts by salience, so its six items are six fragments and a budget of one picks one of them. The learned policy is rewarded for the retrieval that happens later, so it merges, and the sweep of budgets on the screen is where that difference shows up. It costs a store that is smaller, not one that is bigger (Ch. 9, §9.3.2.3).',
      source: { label: 'Ch. 9, §9.3.2.3 Explicit memory management', chapter: 9, section: '9.3.2.3', primary: true },
      difficulty: 'core',
      tryIt: 'Try it: set the items the decision sees to 1 and read the two bars of the budget sweep.',
    },
  ],

  reasoning: [
    {
      id: 'lr-1',
      prompt:
        'On the battery you set the per-step error rate to 0, leaving the tasks, the families and the three policies exactly as they were. What happens to the crossover — the chain length at which each family peaks?',
      options: [
        'Every family peaks at the longest chain, because with no errors an extra step can never hurt.',
        'The gain is exactly zero in all five families: no step can fail, so an extra step changes neither accuracy nor the verdict, and the battery reports flat.',
        'Knowledge and writing start to gain, because those are the families that need more thinking steps.',
        'The aggregate peak moves to four steps, because the two decomposable families now outweigh the other three.',
      ],
      correct: 1,
      explanation:
        'At a per-step error rate of 0 the verdict column reads flat for all five families and the difference against one step is exactly 0.0 pt — measured, not asserted, by running the identical battery twice. The crossover is therefore not a property of a family on its own: it is read off the sweep at whatever error rate is in force. Arithmetic peaks at 2 steps and symbolic at 4 at the shipped rate, while knowledge, commonsense and writing peak at 1, because for those three every extra step still has to carry the whole problem. Raise the error rate and only the first two keep gaining (Ch. 6, §6.1; Ch. 23, §23.2).',
      source: { label: 'Ch. 6, §6.1 In-context reasoning', chapter: 6, section: '6.1', primary: true },
      difficulty: 'advanced',
      tryIt: 'Try it: drag the per-step error rate to 0 and read the Δ vs A column.',
    },
    {
      id: 'lr-2',
      prompt:
        'In the frontier audit you move every slider in the battery section and then look at the right-hand column of the audit table. Why does that column not change?',
      options: [
        'Because it is reported text with a citation, stored with a provenance label and checked for digits: no policy has any purchase on it.',
        'Because the audit recomputes only when the seed changes, and the sliders do not touch the seed.',
        'Because it measures the same battery as the left columns, so it moves by construction and only looks still.',
        'Because the stand-in policy is fixed at one step, so nothing in the page can be moved.',
      ],
      correct: 0,
      explanation:
        "The two columns are different kinds of thing, and the page says so: the measured columns are recomputed from the sliders, while each reported cell is a number-free sentence with a chapter-and-section citation, labelled reported-not-measured-here, and the engine refuses any cell that contains a digit. Only the stand-in policy switches, and it switches what the rule runs — the reported column is text. The third figure on that tab is a count over this repository: 7 of the 8 limitations Ch. 23 records appear somewhere in this course's own lesson text, and the §23.2.7 entry does not (Ch. 23, §23.2).",
      source: { label: 'Ch. 23, §23.2 Limitations and Future Work', chapter: 23, section: '23.2', primary: true },
      difficulty: 'core',
      tryIt: "Try it: switch the stand-in policy and watch the measured accuracy move while the reported column stays put.",
    },
  ],

  retrieval: [
    {
      id: 'lrt-1',
      prompt:
        'On the critique tab you take the rewrite budget down to 0, leaving the gate, the critic and the threshold exactly as they were. What does the case set do?',
      options: [
        'Nothing changes, because a rewrite only costs tokens and can never change an answer.',
        'Abstentions rise to four and wrong answers fall to zero, and correct answers fall too: two of the four right answers came from the rewrite.',
        'Correct answers rise, because a passage the critic rejects can only have been a decoy.',
        'The gate closes on every case, because the critic no longer gets a second look at the question.',
      ],
      correct: 1,
      explanation:
        'Measured over the same six cases: with one rewrite the gated arm issues 8 retrievals, answers 4 correctly and 2 wrongly, and spends 1020 tokens; with no rewrite it issues 4, abstains 4 times, answers 2 correctly and none wrongly, at 570 tokens. The rewrite re-queries with the keywords the first window lacked, so the decisive passage arrives where the original ranking missed it — and the same rejection rule is what makes the one case the critic gets wrong confidently wrong rather than silent. The knob trades being wrong against being useful (Ch. 12, §12.4).',
      source: { label: 'Ch. 12, §12.4.1 Adaptive retrieval via Self-RAG and Self-Ask', chapter: 12, section: '12.4.1', primary: true },
      difficulty: 'core',
      tryIt: 'Try it: set the rewrite budget to 0 and read the abstentions and correct counts against the default run.',
    },
    {
      id: 'lrt-2',
      prompt:
        'On the decomposition tab you raise the hop-margin threshold until every close call is distrusted. What happens to each of the two arms?',
      options: [
        'Both arms improve, because a hop that was a close call was a hop about to be wrong.',
        'The decomposed arm loses answers it already had; the single-shot arm does not move at all, because a flat query never reads an intermediate answer and so cannot be hurt by a rule about them.',
        'The decomposed arm is unaffected, because the margin only decides what is written to the trace.',
        'Both arms fall to zero, because the store holds two near-identical supplier records.',
      ],
      correct: 1,
      explanation:
        'Trust every hop (margin 0) and decomposition recovers all four answers with hop coverage 1.0. Distrust a close call from 0.02 upward and two recovered answers are lost — exactly the two questions that run over the stale supplier record — and at 0.2 the coverage is 0.7. The single-shot arm sits at one recovered answer and coverage 0.4 whatever the knob says. That is the cost side of decomposing: reading your own intermediate answer is what lets the chain close, and what lets one bad hop poison the hops after it (Ch. 12, §12.4).',
      source: { label: 'Ch. 12, §12.4.1 Adaptive retrieval via Self-RAG and Self-Ask', chapter: 12, section: '12.4.1', primary: true },
      difficulty: 'advanced',
      tryIt: 'Try it: set the hop margin to 0, then to 0.2, and watch which curves move.',
    },
  ],
}

/**
 * The laboratory questions, with the page reference filled in from the
 * chapter table.
 */
export const LAB_QUESTIONS: Record<string, QuizQuestion[]> = Object.fromEntries(
  Object.entries(LAB_QUESTIONS_RAW).map(([key, questions]) => [key, questions.map(withPage)]),
)

/** Every diagnostic question, flattened. */
export const ALL_LAB_QUESTIONS: QuizQuestion[] = Object.values(LAB_QUESTIONS).flat()
