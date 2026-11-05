import { describe, expect, it } from 'vitest'
import {
  ASSISTANT_DOMAINS,
  ASSISTANT_DOMAIN_BY_ID,
  decide,
  evaluatePolicy,
  type AssistantDomain,
} from './escalation'

const shop = ASSISTANT_DOMAIN_BY_ID.get('shopping') as AssistantDomain
const clinic = ASSISTANT_DOMAIN_BY_ID.get('medical') as AssistantDomain
const ops = ASSISTANT_DOMAIN_BY_ID.get('operations') as AssistantDomain

describe('the escalation-policy demonstration', () => {
  it('acts on everything when told to', () => {
    for (const domain of ASSISTANT_DOMAINS) {
      for (const request of domain.requests) {
        expect(decide('act-always', domain, request)).toBe('act')
      }
    }
  })

  it('asks about everything when told to', () => {
    for (const domain of ASSISTANT_DOMAINS) {
      for (const request of domain.requests) {
        expect(decide('ask-always', domain, request)).toBe('ask')
      }
    }
  })

  it('does the right thing on the clear, harmless requests', () => {
    for (const domain of ASSISTANT_DOMAINS) {
      const outcome = evaluatePolicy('defer-under-uncertainty', domain)
      const clear = outcome.outcomes.filter(
        (entry) =>
          !entry.request.missingDetail &&
          !entry.request.ambiguous &&
          !entry.request.beyondTheAssistant &&
          !(domain.stakes === 'high' && entry.request.irreversible && !entry.request.readOnly),
      )
      expect(clear.length).toBeGreaterThan(0)
      for (const entry of clear) {
        expect(entry.action, `${domain.id} / ${entry.request.id}`).toBe('act')
      }
    }
  })

  it('never takes a wrong action in a high-stakes domain', () => {
    for (const domain of [clinic, ops]) {
      const outcome = evaluatePolicy('defer-under-uncertainty', domain)
      expect(outcome.wrongActions, `${domain.id} took a wrong action`).toBe(0)
    }
  })

  it('does take wrong actions in a high-stakes domain if it always acts', () => {
    for (const domain of [clinic, ops]) {
      const outcome = evaluatePolicy('act-always', domain)
      expect(outcome.wrongActions, `${domain.id} took no wrong action`).toBeGreaterThan(0)
    }
  })

  it('abstains on a request that is not the assistant to handle', () => {
    const advice = clinic.requests.find((request) => request.beyondTheAssistant)!
    expect(decide('defer-under-uncertainty', clinic, advice)).toBe('abstain')
    // And in a low-stakes domain, where there is no such request, it never
    // abstains.
    for (const request of shop.requests) {
      expect(decide('defer-under-uncertainty', shop, request)).not.toBe('abstain')
    }
  })

  it('asks for a missing detail even in a high-stakes domain', () => {
    const missing = clinic.requests.find((request) => request.missingDetail)!
    expect(decide('defer-under-uncertainty', clinic, missing)).toBe('ask')
  })

  it('finds the only policy that is both safe and useful, in every domain', () => {
    for (const domain of ASSISTANT_DOMAINS) {
      const defer = evaluatePolicy('defer-under-uncertainty', domain)
      const act = evaluatePolicy('act-always', domain)
      const ask = evaluatePolicy('ask-always', domain)

      expect(defer.wrongActions, `${domain.id}: defer took a wrong action`).toBe(0)
      expect(act.wrongActions, `${domain.id}: act-always took no wrong action`).toBeGreaterThan(0)
      expect(ask.completed, `${domain.id}: ask-always completed something`).toBe(0)
      // The policy that defers is the only one that is both safe and useful.
      expect(defer.completed).toBeGreaterThan(0)
    }
  })

  it('makes the cost of a mistake depend on the stakes', () => {
    const inShop = evaluatePolicy('act-always', shop)
    const inClinic = evaluatePolicy('act-always', clinic)
    expect(inClinic.cost).toBeGreaterThan(inShop.cost)
  })

  it('abstains in a high-stakes domain and asks in a low-stakes one', () => {
    const uncertainShop = shop.requests.find((request) => request.ambiguous)!
    const uncertainClinic = clinic.requests.find((request) => request.ambiguous)!
    expect(decide('defer-under-uncertainty', shop, uncertainShop)).toBe('ask')
    expect(decide('defer-under-uncertainty', clinic, uncertainClinic)).toBe('abstain')
  })

  it('confirms an irreversible action in a high-stakes domain', () => {
    const irreversible = ops.requests.find((request) => request.irreversible && !request.ambiguous)!
    expect(decide('defer-under-uncertainty', ops, irreversible)).toBe('ask')
  })

  it('does not confirm an irreversible action in a low-stakes domain', () => {
    const irreversible = shop.requests.find((request) => request.irreversible)!
    expect(decide('defer-under-uncertainty', shop, irreversible)).toBe('act')
  })

  it('costs the always-asking policy something on every request', () => {
    for (const domain of ASSISTANT_DOMAINS) {
      const outcome = evaluatePolicy('ask-always', domain)
      expect(outcome.needlessQuestions).toBeGreaterThan(0)
      expect(outcome.completed).toBe(0)
      expect(outcome.wrongActions).toBe(0)
    }
  })

  it('finds the best policy in each domain, and it is not the same one', () => {
    const costs = (domain: AssistantDomain) =>
      (['act-always', 'ask-always', 'defer-under-uncertainty'] as const).map(
        (policy) => evaluatePolicy(policy, domain).cost,
      )
    const shopCosts = costs(shop)
    const clinicCosts = costs(clinic)
    expect(Math.min(...shopCosts)).toBe(shopCosts[2])
    expect(Math.min(...clinicCosts)).toBe(clinicCosts[2])
    // And the always-asking policy is beaten in both, but by a much larger
    // margin where the stakes are high.
    expect(shopCosts[1] - shopCosts[2]).toBeLessThan(clinicCosts[1] - clinicCosts[2])
  })

  it('is deterministic', () => {
    expect(evaluatePolicy('defer-under-uncertainty', shop)).toEqual(
      evaluatePolicy('defer-under-uncertainty', shop),
    )
  })

  it('gives every domain requests with something to decide', () => {
    for (const domain of ASSISTANT_DOMAINS) {
      expect(domain.requests.length).toBeGreaterThanOrEqual(5)
      expect(domain.requests.some((request) => request.ambiguous)).toBe(true)
      expect(domain.requests.some((request) => request.missingDetail)).toBe(true)
      expect(domain.requests.some((request) => request.readOnly)).toBe(true)
    }
  })
})
