import { useMemo, useState } from 'react'
import {
  ASSISTANT_DOMAINS,
  ESCALATION_POLICIES,
  evaluatePolicy,
  type EscalationPolicy,
} from '../../engine/demos/escalation'
import { Badge, Button, Field } from '../primitives'
import { DemoShell } from './DemoShell'

/**
 * When should an assistant act, and when should it ask?
 *
 * Chapter 13's advice is concrete — retrieve evidence, justify actions,
 * defer to humans under uncertainty, and design for graceful degradation —
 * and it has one uncomfortable implication: the right policy is not a
 * property of the agent. It is a property of the domain.
 *
 * The demonstration runs the same three policies over three domains with
 * different stakes, and shows that the policy that is merely annoying in a
 * shop is dangerous in a clinic, and that a policy which is "safe" by
 * refusing everything is safe and useless.
 */
export function EscalationDemo() {
  const [domainId, setDomainId] = useState(ASSISTANT_DOMAINS[0].id)
  const [policy, setPolicy] = useState<EscalationPolicy>('defer-under-uncertainty')

  const domain = useMemo(
    () => ASSISTANT_DOMAINS.find((entry) => entry.id === domainId) ?? ASSISTANT_DOMAINS[0],
    [domainId],
  )
  const outcome = useMemo(() => evaluatePolicy(policy, domain), [policy, domain])

  return (
    <DemoShell
      title="When should an assistant act, and when should it ask?"
      source="Ch. 13, §13.1–13.9 From tools to assistants"
      summary="Three policies, three domains. The right one depends on what a mistake costs, and a policy that is safe because it refuses everything is safe and useless."
      controls={
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Domain">
              <select
                aria-label="Choose a domain"
                value={domainId}
                onChange={(event) => setDomainId(event.target.value)}
                className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
                style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
              >
                {ASSISTANT_DOMAINS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <span className="text-muted text-[11px] font-semibold uppercase">Policy</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {ESCALATION_POLICIES.map((entry) => (
                  <Button
                    key={entry.value}
                    size="sm"
                    variant={entry.value === policy ? 'primary' : 'secondary'}
                    aria-pressed={entry.value === policy}
                    onClick={() => setPolicy(entry.value)}
                  >
                    {entry.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-muted text-xs leading-relaxed">
            {ESCALATION_POLICIES.find((entry) => entry.value === policy)?.description}
          </p>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={domain.stakes === 'high' ? 'rose' : 'neutral'}>
            {domain.stakes === 'high' ? 'high stakes' : 'low stakes'}
          </Badge>
          <Badge tone={outcome.wrongActions > 0 ? 'rose' : 'emerald'}>
            {outcome.wrongActions} action(s) it should not have taken
          </Badge>
          <Badge tone="neutral">{outcome.completed} completed</Badge>
          {outcome.handedOver > 0 ? <Badge tone="violet">{outcome.handedOver} handed over</Badge> : null}
          {outcome.needlessQuestions > 0 ? (
            <Badge tone="amber">{outcome.needlessQuestions} needless question(s)</Badge>
          ) : null}
        </div>

        <p className="text-muted text-sm leading-relaxed">{domain.context}</p>

        <ul className="space-y-1.5 text-xs">
          {outcome.outcomes.map((entry) => (
            <li
              key={entry.request.id}
              className="surface-2 rounded-lg border p-2.5"
              style={{ borderColor: entry.correct ? 'var(--border-soft)' : 'rgba(251,113,133,0.4)' }}
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="min-w-0 flex-1">“{entry.request.text}”</span>
                <Badge
                  tone={entry.action === 'act' ? 'emerald' : entry.action === 'ask' ? 'amber' : 'violet'}
                >
                  {entry.action === 'act' ? 'acts' : entry.action === 'ask' ? 'asks' : 'hands over'}
                </Badge>
                {!entry.correct ? <Badge tone="rose">wrong</Badge> : null}
              </div>
              <p className="text-muted mt-1 leading-relaxed">{entry.verdict}</p>
            </li>
          ))}
        </ul>

        <div
          className="rounded-lg border p-3 text-xs"
          style={{
            borderColor: outcome.wrongActions > 0 ? 'rgba(251,113,133,0.5)' : 'rgba(52,211,153,0.5)',
            background: outcome.wrongActions > 0 ? 'rgba(251,113,133,0.07)' : 'rgba(52,211,153,0.07)',
          }}
          role="status"
        >
          <p className="font-semibold">{outcome.verdict}</p>
        </div>

        <p className="text-muted text-[11px] leading-relaxed">{domain.note}</p>
      </div>
    </DemoShell>
  )
}
