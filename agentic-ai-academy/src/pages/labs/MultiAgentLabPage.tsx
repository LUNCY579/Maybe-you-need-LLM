import { useMemo, useState } from 'react'
import {
  DEFAULT_MULTI_AGENT_CONFIG,
  MULTI_AGENT_PRESETS,
  ROLE_DESCRIPTIONS,
  runMultiAgentLab,
  type MultiAgentConfig,
} from '../../engine/labs/multiAgent'
import { Badge, Button, Card, Field, Panel, Slider, StatTile, TabPanel, Tabs, Toggle } from '../../ui/primitives'
import { LabReflection } from '../../ui/lesson/LabReflection'
import { useProgress } from '../../store/progress'
import { LAB_BY_ID } from '../../content/labs'

export function MultiAgentLabPage() {
  const progress = useProgress()
  const lab = LAB_BY_ID.get('multi-agent')
  const [config, setConfig] = useState<MultiAgentConfig>(DEFAULT_MULTI_AGENT_CONFIG)
  const [tab, setTab] = useState<'events' | 'handoffs' | 'subtasks'>('events')

  const run = useMemo(() => runMultiAgentLab(config), [config])
  // The discussion prompts make comparative claims, so the comparisons are run
  // here rather than asserted from memory: the same task, one setting changed.
  const variants = useMemo(
    () => ({
      noVerification: runMultiAgentLab({ ...config, verificationEnabled: false }),
      noCritic: runMultiAgentLab({ ...config, criticEnabled: false }),
    }),
    [config],
  )
  const presetRuns = useMemo(() => MULTI_AGENT_PRESETS.map((preset) => ({ preset, run: runMultiAgentLab(preset.config) })), [])
  const lossyPreset = presetRuns.find((entry) => entry.preset.id === 'lossy')!

  const update = (patch: Partial<MultiAgentConfig>) => {
    const next = { ...config, ...patch }
    setConfig(next)
    progress.recordLab('multi-agent', `score=${runMultiAgentLab(next).outcomeScore}:reliability=${next.channelReliability}`)
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="amber">Lab D</Badge>
          <Badge tone="neutral">Seeded message passing</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{lab?.name ?? 'Multi-Agent Collaboration'}</h1>
        <p className="text-muted max-w-3xl text-sm">{lab?.description}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Outcome score" value={run.outcomeScore.toFixed(2)} hint={run.goalReached ? 'task resolved' : 'task not resolved'} />
        <StatTile label="Dropped handoffs" value={String(run.coordinationFailures)} hint={`of ${run.messages.length} messages`} />
        <StatTile label="Defects caught" value={String(run.defectsCaught)} hint="by the verifier" />
        <StatTile label="Defects reaching answer" value={String(run.defectsReachingAnswer)} hint="unverified failures" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-3">
          <Panel title="Configuration" subtitle="Roles, channel quality and verification.">
            <Field label={`Channel reliability: ${(config.channelReliability * 100).toFixed(0)}%`} hint="Probability that a message between agents is delivered.">
              <Slider
                label="Channel reliability"
                value={config.channelReliability}
                min={0.3}
                max={1}
                step={0.02}
                onChange={(value) => update({ channelReliability: value })}
              />
            </Field>
            <Field label={`Researcher quality: ${config.researcherQuality.toFixed(2)}`}>
              <Slider label="Researcher quality" value={config.researcherQuality} min={0.3} max={1} step={0.05} onChange={(value) => update({ researcherQuality: value })} />
            </Field>
            <Field label={`Executor quality: ${config.executorQuality.toFixed(2)}`}>
              <Slider label="Executor quality" value={config.executorQuality} min={0.3} max={1} step={0.05} onChange={(value) => update({ executorQuality: value })} />
            </Field>
            <Field label={`Verifier quality: ${config.verifierQuality.toFixed(2)}`}>
              <Slider label="Verifier quality" value={config.verifierQuality} min={0.1} max={1} step={0.05} onChange={(value) => update({ verifierQuality: value })} />
            </Field>
            <Field label={`Revision rounds: ${config.maxRounds}`}>
              <Slider label="Revision rounds" value={config.maxRounds} min={0} max={4} onChange={(value) => update({ maxRounds: value })} />
            </Field>
            <Toggle checked={config.verificationEnabled} onChange={(value) => update({ verificationEnabled: value })} label="Verify before accepting a subtask" />
            <Toggle checked={config.criticEnabled} onChange={(value) => update({ criticEnabled: value })} label="Include a critic role" />
            <Button size="sm" onClick={() => setConfig(DEFAULT_MULTI_AGENT_CONFIG)}>
              Restore defaults
            </Button>
          </Panel>

          <Panel title="Presets" subtitle="Each preset changes the coordination conditions, not the task. The line under each one is that configuration measured, not promised.">
            <div className="space-y-2">
              {presetRuns.map(({ preset, run: presetRun }) => (
                <button
                  key={preset.id}
                  onClick={() => setConfig(preset.config)}
                  className="focus-ring surface-2 w-full rounded-lg border p-2 text-left text-xs"
                  style={{ borderColor: 'var(--border-soft)' }}
                >
                  <span className="font-medium">{preset.label}</span>
                  <span className="text-muted mt-1 block">{preset.description}</span>
                  <span className="text-muted mt-1 block font-mono text-[11px]">
                    score {presetRun.outcomeScore.toFixed(2)} · {presetRun.coordinationFailures}/{presetRun.messages.length} messages lost ·{' '}
                    {presetRun.defectsCaught} caught · {presetRun.defectsReachingAnswer} reaching the answer · {presetRun.rounds} round(s)
                  </span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Roles" subtitle="Specialisation is a harness-level decision.">
            <ul aria-label="Role statistics" className="space-y-2 text-xs">
              {(['planner', 'researcher', 'executor', 'verifier', 'critic'] as const).map((role) => {
                const stats = run.agents.find((agent) => agent.role === role)
                const active = Boolean(stats)
                return (
                  <li key={role} className="flex flex-wrap items-center gap-2">
                    <Badge tone={active ? 'cyan' : 'neutral'}>{role}</Badge>
                    <span className="text-muted flex-1">{ROLE_DESCRIPTIONS[role]}</span>
                    {stats ? (
                      <span className="text-muted text-[11px]">
                        sent {stats.sent} · recv {stats.received} · defects {stats.defectsIntroduced} · caught {stats.defectsCaught}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Outcome" subtitle={`${run.rounds} round(s) executed.`}>
            <p className="text-sm">{run.summary}</p>
          </Panel>

          <Tabs
            idPrefix="multi-agent-tabs"
            ariaLabel="Multi-agent views"
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'events', label: `Transcript (${run.events.length})` },
              { id: 'handoffs', label: 'Handoffs & messages' },
              { id: 'subtasks', label: 'Subtasks' },
            ]}
          />

          <TabPanel idPrefix="multi-agent-tabs" id="events" active={tab === 'events'}>
            <ol tabIndex={0} aria-label="Agent transcript" className="thin-scroll max-h-[26rem] space-y-2 overflow-y-auto pr-1 text-xs focus-ring">
              {run.events.map((event, index) => (
                <li
                  key={`${event.round}-${index}`}
                  className="surface-2 rounded border p-2"
                  style={{
                    borderColor:
                      event.kind === 'error'
                        ? 'rgba(251,113,133,0.5)'
                        : event.kind === 'warn'
                          ? 'rgba(251,191,36,0.45)'
                          : event.kind === 'ok'
                            ? 'rgba(52,211,153,0.4)'
                            : 'var(--border-soft)',
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted font-mono text-[10px]">round {event.round}</span>
                    <Badge tone={event.actor === 'system' ? 'neutral' : 'cyan'}>{event.actor}</Badge>
                    <Badge tone={event.kind === 'ok' ? 'emerald' : event.kind === 'warn' ? 'amber' : event.kind === 'error' ? 'rose' : 'neutral'}>
                      {event.kind}
                    </Badge>
                  </div>
                  <p className="mt-1">{event.text}</p>
                </li>
              ))}
            </ol>
          </TabPanel>

          <TabPanel idPrefix="multi-agent-tabs" id="handoffs" active={tab === 'handoffs'}>
            <div className="space-y-4">
              <Card className="overflow-x-auto p-4">
                <table className="w-full min-w-[420px] border-collapse text-xs">
                  <caption className="text-muted mb-2 text-left">Handoff summary</caption>
                  <thead>
                    <tr>
                      {['From', 'To', 'Messages', 'Dropped'].map((header) => (
                        <th key={header} scope="col" className="border-b px-2 py-1 text-left uppercase" style={{ borderColor: 'var(--border-soft)' }}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {run.handoffs.map((handoff) => (
                      <tr key={`${handoff.from}-${handoff.to}`}>
                        <td className="border-b px-2 py-1" style={{ borderColor: 'var(--border-soft)' }}>
                          {handoff.from}
                        </td>
                        <td className="border-b px-2 py-1" style={{ borderColor: 'var(--border-soft)' }}>
                          {handoff.to}
                        </td>
                        <td className="border-b px-2 py-1" style={{ borderColor: 'var(--border-soft)' }}>
                          {handoff.count}
                        </td>
                        <td className="border-b px-2 py-1" style={{ borderColor: 'var(--border-soft)', color: handoff.dropped > 0 ? '#fb7185' : 'inherit' }}>
                          {handoff.dropped}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Panel title="Message log" subtitle="Every message, delivery status included.">
                <ol tabIndex={0} aria-label="Message log" className="thin-scroll max-h-72 space-y-1.5 overflow-y-auto pr-1 text-xs focus-ring">
                  {run.messages.map((message) => (
                    <li key={message.id} className="flex flex-wrap items-center gap-2">
                      <Badge tone={message.delivered ? 'emerald' : 'rose'}>{message.delivered ? 'delivered' : 'lost'}</Badge>
                      <span className="text-muted">
                        r{message.round} {message.from} → {message.to} ({message.kind})
                      </span>
                      <span className="flex-1">{message.content}</span>
                    </li>
                  ))}
                </ol>
              </Panel>
            </div>
          </TabPanel>

          <TabPanel idPrefix="multi-agent-tabs" id="subtasks" active={tab === 'subtasks'}>
            <Panel title="Subtask status" subtitle="How each part of the diagnosis ended.">
              <ul aria-label="Subtask status" className="space-y-2 text-xs">
                {run.subtasks.map((subtask) => (
                  <li key={subtask.id} className="surface-2 rounded border p-2" style={{ borderColor: 'var(--border-soft)' }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={subtask.status === 'completed' ? 'emerald' : subtask.status === 'defective' ? 'rose' : subtask.status === 'blocked' ? 'amber' : 'neutral'}>
                        {subtask.status}
                      </Badge>
                      <span className="font-medium">{subtask.title}</span>
                      <span className="text-muted">rounds {subtask.rounds}</span>
                    </div>
                    <p className="text-muted mt-1">Required evidence: {subtask.requiredEvidence}</p>
                    <p className="mt-1">{subtask.note}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </TabPanel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Coordination failure modes on display</h2>
          <ul className="text-muted mt-2 space-y-2 text-xs">
            <li>
              <strong>A dropped handoff costs the check, not necessarily the answer.</strong> On these settings{' '}
              {run.coordinationFailures} of {run.messages.length} messages never arrive, the transcript names the subtask whose verification
              request was lost, and that subtask is still reported as completed. The loss is visible in the log, not in the outcome.
            </li>
            <li>
              <strong>Verification is not free, but skipping it is expensive.</strong> Turn the verifier off and the same task ends with{' '}
              {variants.noVerification.defectsReachingAnswer} defect(s) uncaught and a score of {variants.noVerification.outcomeScore.toFixed(2)}
              , against {run.defectsCaught} caught and {run.outcomeScore.toFixed(2)} with it on.
            </li>
            <li>
              <strong>Critiques can be lost too.</strong> An objection is an ordinary message on an ordinary channel: on the Lossy channel preset{' '}
              {lossyPreset.run.messages.filter((message) => message.kind === 'critique' && !message.delivered).length} of{' '}
              {lossyPreset.run.messages.filter((message) => message.kind === 'critique').length} critiques never arrives, and every subtask still
              completes. That is why this lab prints the message log rather than a verdict.
            </li>
            <li>
              <strong>More structure is not automatically better.</strong> The critic adds {run.messages.length - variants.noCritic.messages.length}{' '}
              messages to the team, and each one that is dropped is charged against the score. Compare rounds and score as you add roles: structure
              buys checks and costs delivery.
            </li>
          </ul>
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Method and limits</h2>
          <ul className="text-muted mt-2 space-y-2 text-xs">
            <li>
              Each subtask requires specific evidence (inventory, log diff, test result). The researcher supplies it with the configured probability, the
              executor applies it, and the verifier either catches or misses the defect.
            </li>
            <li>
              Message delivery is drawn from a seeded generator (seed {config.seed}), so a configuration always yields the same trace and the same
              score. The seed belongs to the simulation and is not a control on this screen, so every difference you see here comes from the
              coordination settings rather than from luck.
            </li>
            <li>
              This models <em>coordination mechanics</em>, not language understanding. It shows why handoff reliability, verification and attribution
              matter — the properties the book's multi-agent case studies actually measure.
            </li>
          </ul>
        </Card>
      </div>

      <LabReflection labId="multi-agent" />
    </div>
  )
}
