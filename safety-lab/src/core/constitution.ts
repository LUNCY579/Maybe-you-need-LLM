/**
 * Harmlessness from AI feedback.
 *
 * The method is a loop: a response is written, a model critiques it against a
 * principle from a written constitution, and the response is revised. What
 * the loop produces is a preference dataset, and what the dataset buys is a
 * model that is less likely to produce the harmful response in the first
 * place.
 *
 * The course measures the loop rather than describing it: how many responses
 * the critique changes, how much the harmfulness falls, and what the cost
 * per changed response is.
 *
 * The second half of the file compares two critics over the same cases — the
 * model reading its own answer against somebody else reading it — because the
 * paper's claim is about which critique you can trust, and that is a claim
 * about a rate.
 */

import { createRng } from '@llm-materials/course-core'

export interface Principle {
  id: string
  /** The principle, in one sentence. */
  text: string
  /** The category of harm it is about. */
  category: string
}

export const PRINCIPLES: Principle[] = [
  { id: 'no-harm', text: 'A response should not help with anything that causes harm.', category: 'harm' },
  { id: 'no-illegal', text: 'A response should not help with anything that is illegal.', category: 'illegal' },
  { id: 'no-deception', text: 'A response should not deceive about what it is or what it can do.', category: 'deception' },
  { id: 'no-privacy', text: 'A response should not reveal private information about a person.', category: 'privacy' },
  { id: 'be-civil', text: 'A response should not insult, harass or demean anyone.', category: 'harassment' },
  { id: 'be-honest', text: 'A response should admit what it does not know.', category: 'honesty' },
]

export interface Exchange {
  /** The prompt the user wrote. */
  prompt: string
  /** The category of harm the prompt is about. */
  category: string
  /** The response the model wrote. */
  response: string
  /** How harmful the response is, from zero to one. */
  harmfulness: number
  /** Whether the response helped with the harmful thing. */
  compliant: boolean
}

/**
 * The critique.
 *
 * A principle is violated when the response helps with the harm it is about.
 * The critique names the principle and says what is wrong, which is what the
 * revision needs.
 */
export function critique(exchange: Exchange, principles: Principle[] = PRINCIPLES): string | null {
  if (!exchange.compliant) return null
  const principle = principles.find((entry) => entry.category === exchange.category)
  if (!principle) return null
  return `This response helps with something the assistant should not help with. ${principle.text} Revise the response so that it declines without being unhelpful.`
}

/**
 * The revision.
 *
 * A compliant response is rewritten into one that declines: the harmfulness
 * goes to zero, and the answer keeps the part of the response that was
 * harmless. The revised response is still useful — that is the point of
 * rewriting rather than refusing everything.
 */
export function revise(exchange: Exchange, principles: Principle[] = PRINCIPLES): Exchange {
  const objection = critique(exchange, principles)
  if (!objection) return exchange
  return {
    ...exchange,
    response: exchange.response.replace(/\.\s*$/, ', and here is how I can help with the safe part of it instead.'),
    harmfulness: 0,
    compliant: false,
  }
}

export interface LoopResult {
  /** The responses the loop did not change. */
  unchanged: number
  /** The responses the loop changed. */
  changed: number
  /** The mean harmfulness before. */
  harmBefore: number
  /** The mean harmfulness after. */
  harmAfter: number
  /** The cost: the critiques, per changed response. */
  critiquesPerChange: number
  /** The revised responses that kept their harmless part. */
  stillUseful: number
}

/**
 * Run the loop over a set of exchanges.
 *
 * The point of the measurement is the last two numbers: the loop removes the
 * harm, and it does so without emptying the response.
 */
export function runConstitutionLoop(exchanges: Exchange[], principles: Principle[] = PRINCIPLES): LoopResult {
  let changed = 0
  let unchanged = 0
  let before = 0
  let after = 0
  let critiques = 0
  let stillUseful = 0

  for (const exchange of exchanges) {
    const objection = critique(exchange, principles)
    if (objection) critiques++
    const revised = revise(exchange, principles)
    before += exchange.harmfulness
    after += revised.harmfulness
    if (revised === exchange) unchanged++
    else {
      changed++
      if (revised.response.length >= exchange.response.length * 0.8) stillUseful++
    }
  }

  const count = Math.max(1, exchanges.length)
  return {
    unchanged,
    changed,
    harmBefore: before / count,
    harmAfter: after / count,
    critiquesPerChange: changed === 0 ? 0 : critiques / changed,
    stillUseful,
  }
}

/**
 * The agreement between a judge and the labels.
 *
 * A harmlessness claim is a claim about a judge: the number means what the
 * judge believes. The agreement between the judge and the human labels is
 * therefore the number that has to be reported, and it is a measurement like
 * any other.
 */
export function judgeAgreement(
  judge: boolean[],
  labels: boolean[],
): { agreement: number; falsePositives: number; falseNegatives: number } {
  let agreed = 0
  let falsePositives = 0
  let falseNegatives = 0
  for (let i = 0; i < Math.min(judge.length, labels.length); i++) {
    if ((judge[i] ?? false) === (labels[i] ?? false)) agreed++
    else if (judge[i] && !labels[i]) falsePositives++
    else falseNegatives++
  }
  const count = Math.max(1, Math.min(judge.length, labels.length))
  return { agreement: agreed / count, falsePositives, falseNegatives }
}

/**
 * The exchanges the loop is run over.
 *
 * Synthetic, and shaped by two numbers the screen sets: how often the model
 * complies with a harmful request, and which category each prompt is in. A
 * compliant response is the harmful one — it helped with the thing a principle
 * forbids — so the share here is the harm the loop is asked to remove.
 */
export function buildExchanges(count = 40, options: { compliance?: number; seed?: number } = {}): Exchange[] {
  const compliance = options.compliance ?? 0.5
  const rng = createRng(options.seed ?? 3)
  const categories = PRINCIPLES.map((principle) => principle.category)
  const exchanges: Exchange[] = []
  for (let index = 0; index < count; index++) {
    const category = categories[Math.floor(rng() * categories.length)]!
    const compliant = rng() < compliance
    exchanges.push({
      prompt: `prompt-${index}`,
      category,
      response: compliant ? 'here is how you do it' : 'here is a safe and useful answer',
      harmfulness: compliant ? 0.4 + 0.6 * rng() : 0,
      compliant,
    })
  }
  return exchanges
}

/**
 * What a noisy judge says about a set of exchanges.
 *
 * The judge is wrong at `errorRate` in either direction — it calls a complying
 * response safe, and it calls a safe one complying — and the labels come from
 * the corpus rather than from the judge. Which is the whole point of measuring
 * the agreement: the harmlessness number is the judge's opinion, and this is the
 * only way to say what that opinion is worth.
 */
export function sampleJudgeVerdicts(
  exchanges: Exchange[],
  errorRate = 0.1,
  seed = 3,
): { judged: boolean[]; labels: boolean[] } {
  const rng = createRng(seed)
  const judged: boolean[] = []
  const labels: boolean[] = []
  for (const exchange of exchanges) {
    labels.push(exchange.compliant)
    judged.push(rng() < errorRate ? !exchange.compliant : exchange.compliant)
  }
  return { judged, labels }
}

/* -------------------------------------------------------------------------- */
/* Self-critique and external critique                                         */
/* -------------------------------------------------------------------------- */

/**
 * A case, with the harm that is actually there.
 *
 * The critique-and-revise loop above measures what a critique does. Comparing
 * two critics needs the thing the loop cannot supply: a verdict that is right.
 * So a case carries its own ground truth, and the measurement is how each
 * critic does against it.
 */
export interface CriticCase {
  exchange: Exchange
  /** Whether a principle really is violated, whatever either critic says. */
  violation: boolean
}

export interface Critic {
  id: string
  /**
   * How often the critic sees a violation that is there.
   *
   * A number, or a table by harm category — and the table is the whole point.
   * A model reading its own answer does not have a uniform recall over harms:
   * the categories it is blind to are the ones its own compliance made
   * invisible. Which categories those are, and how blind, is set here, so the
   * screen is measuring the shape of a blind spot rather than asserting one.
   */
  recall: number | Record<string, number>
  /** How often it flags a response that has no violation. */
  falsePositiveRate: number
  /** What one critique costs, in whatever unit the screen counts in. */
  costPerCritique: number
}

/** The recall this critic has for one case. */
function recallFor(critic: Critic, category: string): number {
  return typeof critic.recall === 'number' ? critic.recall : (critic.recall[category] ?? 0)
}

/**
 * The verdicts of one critic over a set of cases.
 *
 * Detection is the stochastic part, and it is seeded so that two critics can
 * be compared on the same draws. Everything downstream of the verdicts is
 * exact arithmetic.
 */
export function detect(cases: CriticCase[], critic: Critic, options: { seed?: number } = {}): boolean[] {
  const rng = createRng(options.seed ?? 3)
  return cases.map((entry) => {
    const seen = rng()
    return entry.violation
      ? seen < recallFor(critic, entry.exchange.category)
      : seen < critic.falsePositiveRate
  })
}

export interface CritiqueResult {
  /** The cases that really do violate a principle. */
  violations: number
  /** The violations the critic saw. */
  detected: number
  /** The violations it did not. */
  missed: number
  /** The clean cases it flagged anyway. */
  falseAlarms: number
  /** The share of the violations that were seen. */
  recall: number
  /** The mean harmfulness before the revise step. */
  harmBefore: number
  /** The mean harmfulness after it: only what the critic saw gets revised. */
  harmAfter: number
  /** How much of the harm the loop removed. */
  harmRemoved: number
  /** How many responses were rewritten. */
  revised: number
  /** The price of the whole pass, in the critic's own unit. */
  cost: number
}

/**
 * What a set of verdicts buys.
 *
 * A revision only happens to a response the critic flagged, so a critic's
 * blind spot survives into the model it trains: the harm it did not see is the
 * harm that is still there afterwards. This is the exact arithmetic behind
 * that sentence, and it is the only difference between the two critics.
 */
export function scoreCritique(cases: CriticCase[], verdicts: boolean[], critic: Critic): CritiqueResult {
  let violations = 0
  let detected = 0
  let falseAlarms = 0
  let before = 0
  let after = 0
  let revised = 0

  cases.forEach((entry, index) => {
    const flagged = verdicts[index] ?? false
    before += entry.exchange.harmfulness
    if (entry.violation && flagged) {
      detected++
      revised++
      after += revise(entry.exchange).harmfulness
    } else {
      after += entry.exchange.harmfulness
    }
    if (entry.violation) violations++
    else if (flagged) falseAlarms++
  })

  const count = Math.max(1, cases.length)
  return {
    violations,
    detected,
    missed: violations - detected,
    falseAlarms,
    recall: violations === 0 ? 0 : detected / violations,
    harmBefore: before / count,
    harmAfter: after / count,
    harmRemoved: (before - after) / count,
    revised,
    cost: cases.length * critic.costPerCritique,
  }
}

/** The two critics, and where they disagree. */
export function verdictAgreement(a: boolean[], b: boolean[]): { agreement: number; bothFlag: number; onlyA: number; onlyB: number } {
  let agreed = 0
  let both = 0
  let onlyFirst = 0
  let onlySecond = 0
  const count = Math.max(1, Math.min(a.length, b.length))
  for (let i = 0; i < count; i++) {
    if ((a[i] ?? false) === (b[i] ?? false)) agreed++
    if (a[i] && b[i]) both++
    else if (a[i]) onlyFirst++
    else if (b[i]) onlySecond++
  }
  return { agreement: agreed / count, bothFlag: both, onlyA: onlyFirst, onlyB: onlySecond }
}

/**
 * The comparison the paper is about: the same cases, two critics.
 *
 * The self-critique is not free even when it costs nothing per pass, because
 * what it removes is bounded by what it can see. The harm per unit cost is the
 * column that decides which one to run.
 */
export function compareCritics(
  cases: CriticCase[],
  critics: Critic[],
  options: { seed?: number } = {},
): (CritiqueResult & { id: string; harmPerCost: number })[] {
  return critics
    .map((critic) => {
      const verdicts = detect(cases, critic, options)
      const result = scoreCritique(cases, verdicts, critic)
      return { ...result, id: critic.id, harmPerCost: result.cost === 0 ? 0 : result.harmRemoved / result.cost }
    })
    .sort((a, b) => b.harmRemoved - a.harmRemoved)
}

/**
 * The exchanges the two critics are asked about.
 *
 * Synthetic, and shaped on purpose: the harm is weighted towards the category
 * the self-critic is blind to, which is the case the comparison is about. The
 * screen says so in the same words.
 */
export function buildCritiqueCases(count = 60, seed = 5): CriticCase[] {
  const rng = createRng(seed)
  const categories = PRINCIPLES.map((principle) => principle.category)
  const cases: CriticCase[] = []
  for (let i = 0; i < count; i++) {
    const category = categories[Math.floor(rng() * categories.length)]!
    const violation = rng() < 0.5
    const harmfulness = violation ? 0.4 + 0.5 * rng() : 0
    cases.push({
      violation,
      exchange: {
        prompt: `prompt-${i}`,
        category,
        response: violation ? `here is how to do the harmful thing about ${category}` : `a safe answer about ${category}`,
        harmfulness,
        compliant: violation,
      },
    })
  }
  return cases
}

/**
 * The two profiles the laboratory runs.
 *
 * The self-critic sees most harms and is blind to one category; the external
 * critic sees at a flat rate and costs a person's attention every time. Both
 * numbers are inputs, not findings: the findings are the columns that come out
 * of `compareCritics`.
 */
export const CRITICS: Critic[] = [
  {
    id: 'self',
    recall: { harm: 0.9, illegal: 0.85, deception: 0.2, privacy: 0.6, harassment: 0.75, honesty: 0.8 },
    falsePositiveRate: 0.1,
    costPerCritique: 1,
  },
  { id: 'external', recall: 0.9, falsePositiveRate: 0.1, costPerCritique: 12 },
]

