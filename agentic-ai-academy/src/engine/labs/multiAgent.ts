/**
 * Lab D — Multi-agent collaboration.
 *
 * Five specialised roles work a shared task through a message channel. The
 * channel is lossy and agents are imperfect, so the lab exposes coordination
 * failures: dropped messages, stale context, defects that reach the answer, and
 * defects that the verifier catches in time.
 *
 * Roles and their responsibilities follow the collaborative patterns reviewed in
 * Chapter 16 (complementary pairs, debate/verification, role-based teams) and the
 * planner/executor separation of the multi-agent diagnosis case study (Ch. 14).
 */

import { createRng } from '../prng'

export type AgentRole = 'planner' | 'researcher' | 'executor' | 'verifier' | 'critic'

export const ROLE_DESCRIPTIONS: Record<AgentRole, string> = {
  planner: 'Decomposes the goal into subtasks and assigns them.',
  researcher: 'Gathers the evidence each subtask needs.',
  executor: 'Performs the action with the evidence available.',
  verifier: 'Checks each completed subtask against the evidence.',
  critic: 'Challenges the verification and requests revisions.',
}

export interface MultiAgentConfig {
  seed: number
  /** Probability that a message is delivered (0..1). */
  channelReliability: number
  /** Probability that the researcher supplies accurate evidence. */
  researcherQuality: number
  /** Probability that the executor applies the evidence correctly. */
  executorQuality: number
  /** Probability that the verifier detects a defect. */
  verifierQuality: number
  /** Whether a verification step happens at all. */
  verificationEnabled: boolean
  /** Whether a critic reviews and can force another round. */
  criticEnabled: boolean
  /** Maximum revision rounds after the first pass. */
  maxRounds: number
}

export const DEFAULT_MULTI_AGENT_CONFIG: MultiAgentConfig = {
  seed: 11,
  channelReliability: 0.85,
  researcherQuality: 0.85,
  executorQuality: 0.8,
  verifierQuality: 0.7,
  verificationEnabled: true,
  criticEnabled: true,
  maxRounds: 2,
}

export interface Subtask {
  id: string
  title: string
  /** Evidence the researcher must supply for this subtask. */
  requiredEvidence: string
  status: 'pending' | 'completed' | 'defective' | 'blocked'
  rounds: number
  note: string
}

export interface AgentMessage {
  id: string
  round: number
  from: AgentRole | 'system'
  to: AgentRole
  kind: 'plan' | 'evidence' | 'action' | 'verification' | 'critique'
  content: string
  delivered: boolean
}

export interface AgentStats {
  role: AgentRole
  sent: number
  received: number
  droppedSent: number
  defectsIntroduced: number
  defectsCaught: number
}

export interface Handoff {
  from: AgentRole | 'system'
  to: AgentRole
  count: number
  dropped: number
}

export interface MultiAgentRun {
  config: MultiAgentConfig
  subtasks: Subtask[]
  messages: AgentMessage[]
  agents: AgentStats[]
  handoffs: Handoff[]
  rounds: number
  coordinationFailures: number
  defectsReachingAnswer: number
  defectsCaught: number
  outcomeScore: number
  goalReached: boolean
  summary: string
  /** Ordered narration for the UI. */
  events: { round: number; actor: AgentRole | 'system'; text: string; kind: 'info' | 'ok' | 'warn' | 'error' }[]
}

const SUBTASKS: Subtask[] = [
  {
    id: 'st-1',
    title: 'Identify the failing service',
    requiredEvidence: 'service inventory + error rate window',
    status: 'pending',
    rounds: 0,
    note: '',
  },
  {
    id: 'st-2',
    title: 'Explain the failure mechanism',
    requiredEvidence: 'log excerpt + configuration diff',
    status: 'pending',
    rounds: 0,
    note: '',
  },
  {
    id: 'st-3',
    title: 'Propose and validate a fix',
    requiredEvidence: 'rollback procedure + test result',
    status: 'pending',
    rounds: 0,
    note: '',
  },
]

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function runMultiAgentLab(config: MultiAgentConfig = DEFAULT_MULTI_AGENT_CONFIG): MultiAgentRun {
  const rng = createRng(config.seed)
  const messages: AgentMessage[] = []
  const events: MultiAgentRun['events'] = []
  const subtasks = SUBTASKS.map((subtask) => ({ ...subtask }))
  const stats = new Map<AgentRole, AgentStats>()
  const roles: AgentRole[] = config.criticEnabled
    ? ['planner', 'researcher', 'executor', 'verifier', 'critic']
    : ['planner', 'researcher', 'executor', 'verifier']

  for (const role of roles) {
    stats.set(role, { role, sent: 0, received: 0, droppedSent: 0, defectsIntroduced: 0, defectsCaught: 0 })
  }

  let messageCounter = 0
  const send = (round: number, from: AgentRole | 'system', to: AgentRole, kind: AgentMessage['kind'], content: string) => {
    const delivered = rng.chance(config.channelReliability)
    const message: AgentMessage = { id: `msg-${messageCounter++}`, round, from, to, kind, content, delivered }
    messages.push(message)
    if (from !== 'system') {
      const sender = stats.get(from)
      if (sender) {
        sender.sent += 1
        if (!delivered) sender.droppedSent += 1
      }
    }
    const receiver = stats.get(to)
    if (receiver && delivered) receiver.received += 1
    return message
  }

  events.push({ round: 0, actor: 'system', text: 'Goal received: diagnose the failing service and propose a validated fix.', kind: 'info' })

  // Round 0: planning
  const planMessage = send(0, 'planner', 'researcher', 'plan', 'Subtasks: identify service → explain mechanism → validate fix.')
  events.push({
    round: 0,
    actor: 'planner',
    text: planMessage.delivered ? 'Plan delivered to the researcher.' : 'Plan message was dropped: the researcher starts without the decomposition.',
    kind: planMessage.delivered ? 'ok' : 'warn',
  })

  let round = 0
  let defectsCaught = 0
  let defectsReachingAnswer = 0

  while (round <= config.maxRounds) {
    for (const subtask of subtasks) {
      if (subtask.status === 'completed') continue
      subtask.rounds += 1

      // Research
      if (!planMessage.delivered && subtask.id !== 'st-1') {
        subtask.status = 'blocked'
        subtask.note = 'No plan received, so the subtask was never started.'
        events.push({ round, actor: 'researcher', text: `${subtask.title}: blocked — the plan never arrived.`, kind: 'error' })
        continue
      }

      const accurateEvidence = rng.chance(config.researcherQuality)
      const evidence = accurateEvidence ? subtask.requiredEvidence : `${subtask.requiredEvidence} (partially contradictory)`
      const evidenceMessage = send(round, 'researcher', 'executor', 'evidence', `Evidence for "${subtask.title}": ${evidence}`)
      if (!evidenceMessage.delivered) {
        const researcher = stats.get('researcher')
        if (researcher && !accurateEvidence) researcher.defectsIntroduced += 1
        subtask.status = 'defective'
        subtask.note = 'Evidence message dropped; the executor acted on stale context.'
        defectsReachingAnswer += 1
        events.push({ round, actor: 'executor', text: `${subtask.title}: evidence never arrived — acting on stale context.`, kind: 'error' })
        continue
      }

      // Execution
      const executedCleanly = accurateEvidence && rng.chance(config.executorQuality)
      if (!executedCleanly) {
        const executor = stats.get('executor')
        if (executor) executor.defectsIntroduced += 1
        subtask.status = 'defective'
        subtask.note = accurateEvidence ? 'Execution error: evidence applied incorrectly.' : 'Defect inherited from faulty evidence.'
        events.push({ round, actor: 'executor', text: `${subtask.title}: completed with a defect (${subtask.note.toLowerCase()})`, kind: 'warn' })
      } else {
        subtask.status = 'completed'
        subtask.note = 'Executed from accurate evidence.'
        events.push({ round, actor: 'executor', text: `${subtask.title}: completed successfully.`, kind: 'ok' })
      }

      // Verification
      if (config.verificationEnabled) {
        const verificationMessage = send(round, 'executor', 'verifier', 'action', `Result for "${subtask.title}": ${subtask.note}`)
        if (!verificationMessage.delivered) {
          events.push({ round, actor: 'verifier', text: `${subtask.title}: verification request dropped.`, kind: 'warn' })
        } else if (subtask.status === 'defective') {
          const caught = rng.chance(config.verifierQuality)
          if (caught) {
            const verifier = stats.get('verifier')
            if (verifier) verifier.defectsCaught += 1
            defectsCaught += 1
            subtask.status = 'pending'
            subtask.note = 'Verifier rejected the subtask; it returns to the next round.'
            events.push({ round, actor: 'verifier', text: `${subtask.title}: defect caught — sent back for revision.`, kind: 'ok' })
          } else {
            defectsReachingAnswer += 1
            events.push({ round, actor: 'verifier', text: `${subtask.title}: defect missed by the verifier and accepted.`, kind: 'error' })
          }
        } else {
          events.push({ round, actor: 'verifier', text: `${subtask.title}: verified.`, kind: 'ok' })
        }
      } else if (subtask.status === 'defective') {
        defectsReachingAnswer += 1
      }
    }

    if (config.criticEnabled) {
      const outstanding = subtasks.filter((subtask) => subtask.status !== 'completed')
      const critique = outstanding.length === 0
        ? 'No objections: all subtasks verified.'
        : `Objection: ${outstanding.length} subtask(s) unresolved (${outstanding.map((subtask) => subtask.id).join(', ')}).`
      const critiqueMessage = send(round, 'critic', 'planner', 'critique', critique)
      events.push({
        round,
        actor: 'critic',
        text: critiqueMessage.delivered ? critique : 'Critique lost in transit; no revision round was triggered.',
        kind: outstanding.length === 0 ? 'ok' : critiqueMessage.delivered ? 'warn' : 'error',
      })
    }

    if (subtasks.every((subtask) => subtask.status === 'completed')) break
    round += 1
  }

  const completed = subtasks.filter((subtask) => subtask.status === 'completed').length
  const base = completed / subtasks.length
  // One definition, used by both the score and the tile that reports it: what
  // the student reads as a coordination failure is what penalised the score.
  const coordinationFailures = messages.filter((message) => !message.delivered).length
  const coordinationPenalty = Math.min(0.4, coordinationFailures * 0.08)
  const defectPenalty = Math.min(0.5, defectsReachingAnswer * 0.12)
  const outcomeScore = Math.max(0, Math.round((base - coordinationPenalty - defectPenalty) * 100) / 100)

  const handoffMap = new Map<string, Handoff>()
  for (const message of messages) {
    const key = `${message.from}->${message.to}`
    const existing = handoffMap.get(key) ?? { from: message.from, to: message.to, count: 0, dropped: 0 }
    existing.count += 1
    if (!message.delivered) existing.dropped += 1
    handoffMap.set(key, existing)
  }

  const summary =
    outcomeScore >= 0.75
      ? // Stated as the measurement rather than as a verdict: a resolved task with the
        // verifier switched off must not be described as verified, and a run where the
        // verifier caught nothing because nothing was defective must not claim credit.
        `The team resolved the task: ${plural(defectsCaught, 'defect')} caught in review, ${defectsReachingAnswer} reached the answer${
          config.verificationEnabled ? '' : ' with no verification step in the loop'
        }.`
      : outcomeScore >= 0.4
        ? 'Partial success: some subtasks were resolved, but defects and dropped handoffs reduced confidence in the answer.'
        : 'Coordination failure: the answer should not be trusted. Check which messages were dropped and which defects were missed.'

  return {
    config,
    subtasks,
    messages,
    agents: [...stats.values()],
    handoffs: [...handoffMap.values()].sort((a, b) => b.count - a.count),
    rounds: round + 1,
    coordinationFailures,
    defectsReachingAnswer,
    defectsCaught,
    outcomeScore,
    goalReached: outcomeScore >= 0.75,
    summary,
    events,
  }
}

export interface MultiAgentPreset {
  id: string
  label: string
  description: string
  config: MultiAgentConfig
}

export const MULTI_AGENT_PRESETS: MultiAgentPreset[] = [
  {
    id: 'reliable',
    label: 'Reliable channel, careful verifier',
    description: 'Delivery is near-perfect and the agents are careful: on this seed nothing defective is introduced at all, so the verifier has nothing to catch.',
    config: { ...DEFAULT_MULTI_AGENT_CONFIG, channelReliability: 0.98, verifierQuality: 0.9, researcherQuality: 0.95, executorQuality: 0.95 },
  },
  {
    id: 'lossy',
    label: 'Lossy channel',
    description: 'Two of eleven messages never arrive — a verification request and a critique — and the score pays for both, even though every subtask still completes.',
    config: { ...DEFAULT_MULTI_AGENT_CONFIG, channelReliability: 0.66 },
  },
  {
    id: 'no-verification',
    label: 'No verification step',
    description: 'Defects flow straight to the answer: the cost of skipping a checkpoint.',
    config: { ...DEFAULT_MULTI_AGENT_CONFIG, verificationEnabled: false, criticEnabled: false },
  },
  {
    id: 'optimistic',
    label: 'Optimistic agents, no critic',
    description: 'Weak evidence and no critique round: confident but wrong.',
    config: { ...DEFAULT_MULTI_AGENT_CONFIG, researcherQuality: 0.5, executorQuality: 0.5, verifierQuality: 0.4, criticEnabled: false },
  },
]
