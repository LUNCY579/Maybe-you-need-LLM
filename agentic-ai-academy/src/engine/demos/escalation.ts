/**
 * When should an assistant act, and when should it ask?
 *
 * Chapter 13 is a chapter about *assistants*, and its practical advice is
 * unusually concrete:
 *
 *  - "Use architectures where agents retrieve evidence, justify actions and
 *    defer to humans under uncertainty (human in the loop)."
 *  - "In high-stakes domains, we suggest to design for graceful
 *    degradation; an agent asking for clarification or abstaining is
 *    preferable to confident error."
 *  - "Not all assistants operate under the same constraints. High-risk
 *    domains such as medicine and aviation demand strong guarantees."
 *
 * The last point is the interesting one. The right policy is not a property
 * of the agent alone; it is a property of the *domain*. An assistant that
 * asks a redundant question in a shop is mildly annoying. The same question
 * in a clinic, before a dose is changed, is the difference between a system
 * that is safe and one that is not.
 *
 * This engine makes the trade-off computable. It scores three policies over a
 * set of requests, in three domains with different stakes, and shows that the
 * best policy in one domain is the worst in another.
 *
 * It is a model of the *bookkeeping* — which questions are worth asking, and
 * what a mistake costs — not of any particular assistant.
 */

/** How much a mistake costs in a domain. */
export type Stakes = 'low' | 'high'

export interface AssistantRequest {
  id: string
  /** What the user said. */
  text: string
  /** What the assistant would have to do. */
  action: string
  /** A required detail is missing. */
  missingDetail?: boolean
  /** The request could mean more than one thing. */
  ambiguous?: boolean
  /** The action cannot be undone. */
  irreversible?: boolean
  /** The action is read-only and safe. */
  readOnly?: boolean
  /**
   * The request is not the assistant's to handle at all.
   *
   * This is a different thing from being *uncertain* about it. A question with
   * a missing detail is answered by asking; a request for clinical advice is
   * answered by declining, because no amount of clarifying would make it the
   * right instrument.
   */
  beyondTheAssistant?: boolean
  /** Why the request is in the set. */
  note: string
}

export interface AssistantDomain {
  id: string
  title: string
  /** The stakes of a mistake here. */
  stakes: Stakes
  context: string
  requests: AssistantRequest[]
  /** What the chapter says about this domain. */
  note: string
}

export type EscalationPolicy = 'act-always' | 'ask-always' | 'defer-under-uncertainty'

export const ESCALATION_POLICIES: { value: EscalationPolicy; label: string; description: string }[] = [
  {
    value: 'act-always',
    label: 'Act on everything',
    description:
      'The behaviour of a tool: whatever arrives, do it. It never asks a question and never waits for a person.',
  },
  {
    value: 'ask-always',
    label: 'Ask before everything',
    description:
      'Confirm every action first. It never gets anything wrong, and it never gets anything done either.',
  },
  {
    value: 'defer-under-uncertainty',
    label: 'Defer under uncertainty',
    description:
      'Act when the request is clear and the action is reversible; ask when a detail is missing or the request is ambiguous; abstain — hand it to a person — when the stakes are high.',
  },
]

/** What the assistant did with a request. */
export type AssistantAction = 'act' | 'ask' | 'abstain'

export interface RequestOutcome {
  request: AssistantRequest
  /** What the policy did. */
  action: AssistantAction
  /** Whether that was the right thing to do. */
  correct: boolean
  /** What it cost. */
  cost: number
  /** Why. */
  verdict: string
}

export interface PolicyOutcome {
  policy: EscalationPolicy
  outcomes: RequestOutcome[]
  /** The requests the policy completed correctly. */
  completed: number
  /** The questions that were not needed. */
  needlessQuestions: number
  /** The actions that should not have been taken. */
  wrongActions: number
  /** The requests that were handed to a person. */
  handedOver: number
  /** The total cost. */
  cost: number
  /** One sentence on the policy's behaviour in this domain. */
  verdict: string
}

/** Whether the request carries something the assistant is unsure about. */
function isUncertain(request: AssistantRequest): boolean {
  return Boolean(request.missingDetail || request.ambiguous)
}

/**
 * What a policy does with a request.
 *
 * The interesting part is the third policy, and it depends on the domain:
 *
 *  - a *missing detail* or an *ambiguous request* is uncertain in any domain,
 *    and the answer is a question;
 *  - a request that is *not the assistant's to handle* is answered by
 *    abstaining, in any domain, because no amount of clarifying would make it
 *    the right instrument;
 *  - an *irreversible* action is worth confirming when the stakes are high;
 *  - and in a high-stakes domain, abstaining is an acceptable answer where
 *    asking is not — a person can finish what the assistant declines to.
 */
export function decide(
  policy: EscalationPolicy,
  domain: AssistantDomain,
  request: AssistantRequest,
): AssistantAction {
  if (policy === 'act-always') return 'act'
  if (policy === 'ask-always') return 'ask'

  // Defer under uncertainty.
  if (request.beyondTheAssistant) return 'abstain'
  if (isUncertain(request)) return 'ask'
  if (domain.stakes === 'high' && request.irreversible && !request.readOnly) {
    return 'ask'
  }
  return 'act'
}

/** What the right action would have been, and what the wrong one costs. */
function judge(
  domain: AssistantDomain,
  request: AssistantRequest,
  action: AssistantAction,
): { correct: boolean; cost: number; verdict: string } {
  const uncertain = isUncertain(request)
  const high = domain.stakes === 'high'

  if (action === 'act') {
    if (request.beyondTheAssistant) {
      return {
        correct: false,
        cost: high ? 12 : 4,
        verdict:
          'It took on a request that was not the assistant\'s to handle. In a low-stakes domain that is a mistake; in a high-stakes one it is the worst one available.',
      }
    }
    if (uncertain) {
      return high
        ? {
            correct: false,
            cost: 10,
            verdict: 'It acted on a request it did not understand, in a domain where that is the expensive mistake.',
          }
        : {
            correct: false,
            cost: 2,
            verdict: 'It acted on a request it did not understand. The cost is a wrong order rather than a wrong dose.',
          }
    }
    if (high && request.irreversible && !request.readOnly) {
      return {
        correct: false,
        cost: 4,
        verdict: 'It acted without confirming, on an action that cannot be undone.',
      }
    }
    return { correct: true, cost: 0, verdict: 'It did what was asked, and nothing was at risk.' }
  }

  if (action === 'ask') {
    if (request.beyondTheAssistant) {
      return {
        correct: false,
        cost: 4,
        verdict: 'It asked a question about a request it should have handed over. The question is not the point.',
      }
    }
    if (uncertain) {
      return {
        correct: true,
        cost: 1,
        verdict: 'It asked for the detail it was missing. A question is a small price for a wrong order.',
      }
    }
    if (high && request.irreversible && !request.readOnly) {
      return {
        correct: true,
        cost: 1,
        verdict: 'It confirmed an irreversible action before taking it.',
      }
    }
    return {
      correct: false,
      cost: 1,
      verdict: 'It asked a question it did not need to ask. Correct, but slow.',
    }
  }

  // Abstain.
  if (request.beyondTheAssistant) {
    return {
      correct: true,
      cost: 2,
      verdict: 'It declined a request that was not its to handle, and passed it to a person.',
    }
  }
  if (high && uncertain) {
    return {
      correct: true,
      cost: 2,
      verdict: 'It declined and passed it to a person. In this domain, that is the right answer.',
    }
  }
  return {
    correct: false,
    cost: 3,
    verdict: 'It declined a request it could have handled by asking. The task is now someone else\'s problem.',
  }
}

/** Score a policy over every request in a domain. */
export function evaluatePolicy(policy: EscalationPolicy, domain: AssistantDomain): PolicyOutcome {
  const outcomes: RequestOutcome[] = domain.requests.map((request) => {
    const action = decide(policy, domain, request)
    const judgement = judge(domain, request, action)
    return { request, action, ...judgement }
  })

  const completed = outcomes.filter((outcome) => outcome.action === 'act' && outcome.correct).length
  const needlessQuestions = outcomes.filter(
    (outcome) => outcome.action === 'ask' && !outcome.correct,
  ).length
  const wrongActions = outcomes.filter(
    (outcome) => outcome.action === 'act' && !outcome.correct,
  ).length
  const handedOver = outcomes.filter((outcome) => outcome.action === 'abstain').length
  const cost = outcomes.reduce((sum, outcome) => sum + outcome.cost, 0)

  /*
   * The verdict leads with the two numbers that matter, because a single
   * score is misleading here. A policy that asks about everything is "safe"
   * by any cost model, and it also completes nothing; a policy that acts on
   * everything is useful and, in the wrong domain, dangerous. Safety and
   * usefulness are separate axes, and a policy is only good when it is high
   * on both.
   */
  let verdict: string
  if (wrongActions > 0 && completed === 0) {
    verdict = `It took ${wrongActions} action${wrongActions === 1 ? '' : 's'} it should not have taken, and completed nothing.`
  } else if (wrongActions > 0) {
    verdict = `It took ${wrongActions} action${wrongActions === 1 ? '' : 's'} it should not have taken. That is what the cost is made of.`
  } else if (completed === 0) {
    verdict = `It never acted wrongly, and it never got anything done. Safe and useless.`
  } else if (handedOver > 0) {
    verdict = `It took no wrong action, completed ${completed} request${completed === 1 ? '' : 's'}, and handed ${handedOver} to a person.`
  } else {
    verdict = `It took no wrong action and completed ${completed} request${completed === 1 ? '' : 's'}.`
  }

  return {
    policy,
    outcomes,
    completed,
    needlessQuestions,
    wrongActions,
    handedOver,
    cost,
    verdict,
  }
}

/* ------------------------------------------------------------------ */
/* Domains                                                             */
/* ------------------------------------------------------------------ */

export const ASSISTANT_DOMAINS: AssistantDomain[] = [
  {
    id: 'shopping',
    title: 'An online shop',
    stakes: 'low',
    context:
      'A shopping assistant that can search the catalogue, place an order, cancel one and start a return. Getting it wrong costs a parcel and an apology.',
    note: 'The chapter\'s advice about domain sensitivity is easiest to see here: nothing much is at stake, so the assistant should mostly act, and ask only when it genuinely does not know what was meant.',
    requests: [
      {
        id: 's1',
        text: 'Find me a blue jacket under €120.',
        action: 'Search the catalogue and list the matches',
        readOnly: true,
        note: 'Clear, and read-only: there is nothing to confirm.',
      },
      {
        id: 's2',
        text: 'Buy the cheapest blue jacket.',
        action: 'Place the order for the cheapest blue jacket',
        missingDetail: true,
        note: 'Which size? An order for the wrong size is a return, not a catastrophe.',
      },
      {
        id: 's3',
        text: 'Cancel order 4471.',
        action: 'Cancel order 4471',
        irreversible: true,
        note: 'Clear and irreversible: cancelling cannot be un-cancelled, but the user asked for it by number.',
      },
      {
        id: 's4',
        text: 'Return the shoes I bought last month.',
        action: 'Start a return for the shoes',
        ambiguous: true,
        note: 'Which order? The assistant has seen three.',
      },
      {
        id: 's5',
        text: 'Track order 2231.',
        action: 'Look up the delivery status of order 2231',
        readOnly: true,
        note: 'Clear and harmless.',
      },
      {
        id: 's6',
        text: 'Apply my discount code.',
        action: 'Apply the discount code to the basket',
        missingDetail: true,
        note: 'Which code? Discount codes are not interchangeable.',
      },
    ],
  },
  {
    id: 'medical',
    title: 'A clinic\'s triage assistant',
    stakes: 'high',
    context:
      'An assistant that answers staff questions, books appointments and drafts referrals. The chapter is explicit that medicine demands strong guarantees on safety, robustness, transparency and fairness.',
    note: 'The same requests, in a domain where the answer is not "we will refund the parcel". Here the recommendation is to design for graceful degradation, and an agent that asks or abstains is preferable to one that is confidently wrong.',
    requests: [
      {
        id: 'm1',
        text: 'A patient reports chest pain. What should we do?',
        action: 'Advise the clinical response',
        ambiguous: true,
        beyondTheAssistant: true,
        note: 'The assistant should not be the one answering this.',
      },
      {
        id: 'm2',
        text: 'Book the patient in room 3 for a follow-up next Tuesday.',
        action: 'Book the appointment',
        missingDetail: true,
        note: 'Which patient? The room is not the patient.',
      },
      {
        id: 'm3',
        text: 'Increase the dose on the medication chart for this patient.',
        action: 'Change the dose on the medication chart',
        irreversible: true,
        note: 'An irreversible change to a medication chart, in a regulated domain: confirm it.',
      },
      {
        id: 'm4',
        text: 'What is the standard waiting time for the clinic to answer a referral?',
        action: 'Look up the clinic\'s published waiting time',
        readOnly: true,
        note: 'Clear and harmless, even here.',
      },
      {
        id: 'm5',
        text: 'Is this mole suspicious?',
        action: 'Assess the image and advise',
        ambiguous: true,
        beyondTheAssistant: true,
        note: 'An image and a symptom history the assistant does not have.',
      },
      {
        id: 'm6',
        text: 'Draft a referral letter for the patient from yesterday.',
        action: 'Draft the referral letter',
        ambiguous: true,
        note: "Yesterday's patient: there were several.",
      },
    ],
  },
  {
    id: 'operations',
    title: 'A flight operations desk',
    stakes: 'high',
    context:
      'An assistant that reads the flight schedule, answers disruption questions and proposes reroutes. Aviation is named in the chapter alongside medicine as a domain that demands strong guarantees.',
    note: 'Here the asymmetry is clearest: reading the schedule is free, and changing it is not. A policy that treats both the same is wrong in one direction or the other.',
    requests: [
      {
        id: 'o1',
        text: 'What is the delay on flight LH1234?',
        action: 'Read the delay from the schedule',
        readOnly: true,
        note: 'Clear and read-only: act.',
      },
      {
        id: 'o2',
        text: 'Reroute LH1234 to gate B.',
        action: 'Change the gate assignment for flight LH1234',
        irreversible: true,
        note: 'Clear, irreversible, and consequential: confirm it.',
      },
      {
        id: 'o3',
        text: 'Delay the next departure.',
        action: 'Delay the next scheduled departure',
        ambiguous: true,
        note: 'Which departure? There are four an hour.',
      },
      {
        id: 'o4',
        text: 'How many flights are affected by the closure?',
        action: 'Count the affected flights',
        readOnly: true,
        note: 'Clear and harmless.',
      },
      {
        id: 'o6',
        text: 'Move LH1234 to the earlier slot.',
        action: 'Move flight LH1234 to an earlier departure slot',
        missingDetail: true,
        note: 'Which slot? The schedule has four that qualify.',
      },
      {
        id: 'o5',
        text: 'Divert the aircraft to the nearest suitable airport.',
        action: 'Divert the aircraft',
        ambiguous: true,
        irreversible: true,
        beyondTheAssistant: true,
        note: 'Suitable by whose criteria? And this cannot be undone in the air.',
      },
    ],
  },
]

export const ASSISTANT_DOMAIN_BY_ID = new Map(ASSISTANT_DOMAINS.map((entry) => [entry.id, entry]))
