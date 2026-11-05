import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  DEFAULT_LONGEVITY_CONFIG,
  DEFAULT_WRITE_POLICY_CONFIG,
  FULL_COVERAGE,
  REQUIRED_FACTS,
  REHEARSAL_SWEEP,
  TOPK_SWEEP,
  WRITE_ACTION_LABELS,
  compareDurabilityLayers,
  runLongevityLab,
  runWritePolicyLab,
  sweepRehearsalIntervals,
  type LongevityConfig,
  type WritePolicyConfig,
} from '../../engine/labs/memoryLongevity'
import type { RetrievalStrategy } from '../../engine/labs/memory'
import { Badge, Button, ChartFigure, Field, Panel, Select, Slider, StatTile, TabPanel, Tabs } from '../../ui/primitives'
import { LabReflection } from '../../ui/lesson/LabReflection'
import { useProgress } from '../../store/progress'
import { LAB_BY_ID } from '../../content/labs'

const STRATEGIES: { value: RetrievalStrategy; label: string }[] = [
  { value: 'recency', label: 'Recency' },
  { value: 'relevance', label: 'Relevance' },
  { value: 'importance', label: 'Importance' },
  { value: 'hybrid', label: 'Hybrid' },
]

const CAUSE_TONE = { held: 'emerald', decay: 'rose', abstraction: 'amber' } as const

export function MemoryLongevityLabPage() {
  const progress = useProgress()
  const lab = LAB_BY_ID.get('memory-longevity')
  const [tab, setTab] = useState<'durability' | 'writing'>('durability')
  const [longevity, setLongevity] = useState<LongevityConfig>(DEFAULT_LONGEVITY_CONFIG)
  const [writing, setWriting] = useState<WritePolicyConfig>(DEFAULT_WRITE_POLICY_CONFIG)

  const run = useMemo(() => runLongevityLab(longevity), [longevity])
  const schedules = useMemo(() => sweepRehearsalIntervals(longevity), [longevity])
  const layers = useMemo(() => compareDurabilityLayers(longevity), [longevity])
  const policy = useMemo(() => runWritePolicyLab(writing), [writing])

  const updateLongevity = (patch: Partial<LongevityConfig>) => {
    const next = { ...longevity, ...patch }
    setLongevity(next)
    progress.recordLab('memory-longevity', 'curve:S=' + next.baseStability + ':thr=' + next.consolidationThreshold.toFixed(2))
  }

  const updateWriting = (patch: Partial<WritePolicyConfig>) => {
    const next = { ...writing, ...patch }
    setWriting(next)
    progress.recordLab('memory-longevity', 'write:cap=' + next.capacity + ':ep=' + next.episodes)
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="violet">Lab F</Badge>
          <Badge tone="neutral">Deterministic curve · seeded policy gradient</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{lab?.name ?? 'Memory Durability'}</h1>
        <p className="text-muted max-w-3xl text-sm">{lab?.description}</p>
      </header>

      <Tabs
        idPrefix="memory-longevity-tabs"
        ariaLabel="Long-term memory measurements"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'durability', label: 'A curve that forgets' },
          { id: 'writing', label: 'A policy that decides what to write' },
        ]}
      />

      {tab === 'durability' ? (
        <TabPanel idPrefix="memory-longevity-tabs" id="durability" active>
          <DurabilityPanel config={longevity} onChange={updateLongevity} run={run} schedules={schedules} layers={layers} />
        </TabPanel>
      ) : (
        <TabPanel idPrefix="memory-longevity-tabs" id="writing" active>
          <WritingPanel config={writing} onChange={updateWriting} run={policy} />
        </TabPanel>
      )}

      <Panel title="What to notice" subtitle="Two ways a memory system can be more than a list, and two prices it pays for it.">
        <ul className="text-muted space-y-2 text-xs">
          <li>
            The hierarchy is not free. Folding traces into summaries keeps the same facts reachable for longer in fewer words, and it measurably loses
            detail: the gap between the flat and the hierarchical curve is the abstraction cost, and it is counted against the keywords each fact needs,
            not against a feeling of coverage.
          </li>
          <li>
            Rehearsal is a schedule, not a wish. The same stream replayed with a recall every 8, 16, 24 or 32 ticks keeps every required fact; a recall
            only at the horizon saves nothing, because by then the fact has already fallen below the consolidation threshold.
          </li>
          <li>
            The learned arm on the second tab is not tuned to win. It is rewarded for the retrieval that happens later, so merging a fact into an item
            that is already there can be better than adding a seventh item to a store of six — and the run reports how many parameter updates that took.
          </li>
          <li>
            Both the event traces and the reward are synthetic, and they are a measuring instrument rather than a model of anyone's assistant. No number
            from either paper is reproduced here; what is reproduced is the mechanism, so that the two claims can be moved with a slider.
          </li>
        </ul>
      </Panel>

      <LabReflection labId="memory-longevity" />
    </div>
  )
}

interface ScheduleRow {
  interval: number
  label: string
  criticalRetained: number
  criticalForgotten: number
  meanDetailRetention: number
  savedCritical: number
  forgottenTotal: number
}

interface LayerPair {
  detailGap: number
  criticalGap: number
  flat: { metrics: { meanDetailRetention: number; criticalRetained: number; aliveItems: number } }
  hierarchical: { metrics: { meanDetailRetention: number; criticalRetained: number; aliveItems: number; detailLossAtCompaction: number } }
}

function DurabilityPanel({
  config,
  onChange,
  run,
  schedules,
  layers,
}: {
  config: LongevityConfig
  onChange: (patch: Partial<LongevityConfig>) => void
  run: ReturnType<typeof runLongevityLab>
  schedules: ScheduleRow[]
  layers: LayerPair
}) {
  const curveData = run.curve.map((point) => ({
    tick: point.tick,
    criticalRetained: point.criticalRetained,
    meanRetention: Number(point.meanRetention.toFixed(3)),
    detailRetained: Number(point.detailRetained.toFixed(3)),
  }))
  const scheduleData = schedules.map((entry) => ({
    name: entry.label,
    retained: entry.criticalRetained,
    detail: Number(entry.meanDetailRetention.toFixed(3)),
  }))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Required facts held"
          value={run.metrics.criticalRetained + '/' + run.metrics.requiredFacts}
          hint={'at tick ' + config.horizonTick + ', at ' + (FULL_COVERAGE * 100).toFixed(0) + '% of their keywords'}
        />
        <StatTile
          label="Lost to the curve"
          value={String(run.metrics.criticalLostToDecay.length)}
          hint={'lost to the summary budget: ' + String(run.metrics.criticalLostToAbstraction.length)}
        />
        <StatTile
          label="Mean detail retained"
          value={run.metrics.meanDetailRetention.toFixed(3)}
          hint={'with no forgetting at all: ' + run.metrics.detailRetentionWithoutDecay.toFixed(3)}
        />
        <StatTile
          label="Words in the durable store"
          value={String(run.metrics.storedWords)}
          hint={run.metrics.aliveItems + ' items standing, ' + run.metrics.forgottenTotal + ' dropped'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Panel title="Forgetting curve" subtitle={'R = exp(-t / S), with S grown on every rehearsal. Everything here is deterministic.'}>
          <Field label={'Base stability S: ' + config.baseStability} hint="Ticks without rehearsal at which an average item retains 37 per cent.">
            <Slider label="Base stability" value={config.baseStability} min={4} max={40} onChange={(value) => onChange({ baseStability: value })} />
          </Field>
          <Field label={'Rehearsal gain: ' + config.stabilityGain.toFixed(2)} hint="Stability multiplier applied every time an item is recalled.">
            <Slider label="Rehearsal gain" value={config.stabilityGain} min={0} max={1.5} step={0.1} onChange={(value) => onChange({ stabilityGain: value })} />
          </Field>
          <Field label={'Consolidation threshold: ' + config.consolidationThreshold.toFixed(2)} hint="Retention below which a durable item is dropped.">
            <Slider
              label="Consolidation threshold"
              value={config.consolidationThreshold}
              min={0}
              max={0.9}
              step={0.05}
              onChange={(value) => onChange({ consolidationThreshold: value })}
            />
          </Field>
          <Field label={'Topics per summary: ' + config.topicsPerSummary} hint="What one session summary is allowed to keep. This is the abstraction budget.">
            <Slider label="Topics per summary" value={config.topicsPerSummary} min={1} max={16} onChange={(value) => onChange({ topicsPerSummary: value })} />
          </Field>
          <Field label={'Events per summary: ' + config.sessionLength}>
            <Slider label="Events per summary" value={config.sessionLength} min={2} max={10} onChange={(value) => onChange({ sessionLength: value })} />
          </Field>
          <Field label={'Horizon: t=' + config.horizonTick} hint="How long after the last event the durability is measured.">
            <Slider label="Horizon tick" value={config.horizonTick} min={8} max={96} step={4} onChange={(value) => onChange({ horizonTick: value })} />
          </Field>
          <Field
            label={'Scheduled rehearsal: ' + (config.rehearsalInterval === 0 ? 'none' : 'every ' + config.rehearsalInterval + ' ticks')}
            hint="0 means only the rehearsal a new event gives an item by sharing its keywords."
          >
            <Select
              label="Scheduled rehearsal interval"
              value={String(config.rehearsalInterval)}
              onChange={(value) => onChange({ rehearsalInterval: Number(value) })}
              options={REHEARSAL_SWEEP.map((interval) => ({ value: String(interval), label: interval === 0 ? 'none' : 'every ' + interval + ' ticks' }))}
            />
          </Field>
          <Button size="sm" onClick={() => onChange(DEFAULT_LONGEVITY_CONFIG)}>
            Restore recommended settings
          </Button>
          <p className="text-muted text-[11px]">
            {REQUIRED_FACTS.length} facts are what the task needs, computed from the stream and the question rather than asserted.
          </p>
        </Panel>

        <div className="space-y-4">
          <Panel title="Durability over time" subtitle="Alive items and their retention, tick by tick, then past the end of the stream to the horizon.">
            <ChartFigure
              title="Retention and required-fact coverage by tick"
              description="Mean retention across standing durable items, mean keyword coverage of the required facts, and how many required facts are still fully held."
              columns={['Tick', 'Mean retention', 'Detail retained', 'Required facts held']}
              rows={run.curve
                .filter((point) => point.tick % Math.max(1, Math.round(config.horizonTick / 12)) === 0 || point.tick === config.horizonTick)
                .map((point) => [point.tick, point.meanRetention.toFixed(3), point.detailRetained.toFixed(3), point.criticalRetained])}
            >
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curveData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(148,178,255,0.12)" />
                    <XAxis dataKey="tick" tick={{ fontSize: 10 }} stroke="#9aa7c7" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9aa7c7" width={40} domain={[0, 6]} />
                    <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid rgba(148,178,255,0.25)', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="criticalRetained" stroke="#34d399" name="required facts held" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="detailRetained" stroke="#35e6ff" name="detail retained" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="meanRetention" stroke="#a78bfa" name="mean retention" strokeWidth={1} strokeDasharray="4 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartFigure>
          </Panel>

          <Panel title="What each required fact cost" subtitle="Cause is measured by replaying the identical stream with no forgetting: what is still missing there was dropped by the summary, not by the curve.">
            <div className="space-y-2 text-xs">
              {run.metrics.factOutcomes.map((fact) => (
                <div key={fact.eventId} className="surface-2 rounded border p-2" style={{ borderColor: 'var(--border-soft)' }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={CAUSE_TONE[fact.cause]}>{fact.cause}</Badge>
                    <span className="text-muted font-mono text-[10px]">{fact.eventId}</span>
                    <span className="text-muted">
                      held until t{fact.lastHeldTick}
                      {fact.droppedAtTick === null ? '' : ', gone from t' + fact.droppedAtTick}
                    </span>
                    <span className="flex-1" />
                    <span className="text-muted font-mono">
                      {fact.coverageAtStreamEnd.toFixed(2)} at end, {fact.coverageAtHorizon.toFixed(2)} at horizon
                    </span>
                  </div>
                  <p className="mt-1">{fact.content}</p>
                  <p className="text-muted mt-1">
                    carried by {fact.carrierLayer} item {fact.carrierId} ({fact.carrierFacts} facts, {fact.carrierRehearsals} rehearsals, stability{' '}
                    {fact.carrierStability.toFixed(1)})
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="The price of rehearsal spacing" subtitle="The same stream, one spacing at a time. Facts saved are counted against the unscheduled run.">
          <ChartFigure
            title="Required facts held by rehearsal spacing"
            description="Each bar is one scheduled recall interval, replayed over the identical event stream, with the number of required facts still fully held at the horizon."
            columns={['Spacing', 'Required facts held', 'Mean detail']}
            rows={scheduleData.map((entry) => [entry.name, entry.retained, entry.detail])}
          >
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scheduleData} margin={{ top: 8, right: 8, left: 0, bottom: 50 }}>
                  <CartesianGrid stroke="rgba(148,178,255,0.12)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#9aa7c7" interval={0} angle={-14} height={60} />
                  <YAxis tick={{ fontSize: 10 }} stroke="#9aa7c7" width={30} domain={[0, REQUIRED_FACTS.length]} />
                  <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid rgba(148,178,255,0.25)', fontSize: 12 }} />
                  <Bar dataKey="retained" fill="#34d399" name="facts held" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartFigure>
        </Panel>

        <Panel title="Hierarchy versus flat traces" subtitle="Same stream, same curve. The only difference is whether traces are folded into summaries and a profile.">
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={layers.detailGap < 0 ? 'amber' : 'emerald'}>
                detail {layers.detailGap >= 0 ? 'gained' : 'lost'} {Math.abs(layers.detailGap).toFixed(3)}
              </Badge>
              <Badge tone={layers.criticalGap < 0 ? 'rose' : 'emerald'}>
                required facts {layers.criticalGap >= 0 ? '+' : ''}
                {layers.criticalGap}
              </Badge>
              <span className="text-muted">
                compaction itself dropped {layers.hierarchical.metrics.detailLossAtCompaction.toFixed(3)} of detail
              </span>
            </div>
            <ChartFigure
              title="Flat traces versus hierarchical summaries"
              description="Mean keyword coverage of the required facts, and how many of them are fully held at the horizon, for the two durable layers."
              columns={['Layer', 'Mean detail', 'Required facts held', 'Items standing']}
              rows={[
                ['flat traces', layers.flat.metrics.meanDetailRetention, layers.flat.metrics.criticalRetained, layers.flat.metrics.aliveItems],
                [
                  'summaries + profile',
                  layers.hierarchical.metrics.meanDetailRetention,
                  layers.hierarchical.metrics.criticalRetained,
                  layers.hierarchical.metrics.aliveItems,
                ],
              ]}
            >
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'flat', detail: layers.flat.metrics.meanDetailRetention, held: layers.flat.metrics.criticalRetained },
                    { name: 'hierarchical', detail: layers.hierarchical.metrics.meanDetailRetention, held: layers.hierarchical.metrics.criticalRetained },
                  ]} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(148,178,255,0.12)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9aa7c7" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9aa7c7" width={30} domain={[0, 6]} />
                    <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid rgba(148,178,255,0.25)', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="detail" fill="#35e6ff" name="mean detail" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="held" fill="#34d399" name="facts held" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartFigure>
            <p className="text-muted">
              {run.sessions.length} session summaries and {run.profile ? '1 rolling profile' : 'no profile'} stand at the horizon, over{' '}
              {run.metrics.createdItems} durable items created.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function WritingPanel({
  config,
  onChange,
  run,
}: {
  config: WritePolicyConfig
  onChange: (patch: Partial<WritePolicyConfig>) => void
  run: ReturnType<typeof runWritePolicyLab>
}) {
  const curveData = run.curve.map((point) => ({
    episode: point.episode,
    learned: point.greedyReward,
    rule: point.ruleReward,
    sampled: point.sampledReward,
    critical: point.greedyCriticalRetained,
  }))
  const accuracyData = run.decisionAccuracy.map((entry) => ({
    name: 'top-' + entry.topK,
    learned: entry.learned ? 1 : 0,
    rule: entry.rule ? 1 : 0,
  }))
  const busiest = [...run.policy].sort((a, b) => b.visits - a.visits).slice(0, 8)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Learned reward" value={run.learned.reward.toFixed(3)} hint={'rule: ' + run.rule.reward.toFixed(3)} />
        <StatTile label="Store size" value={run.learned.storeSize + ' items'} hint={'rule: ' + run.rule.storeSize + ' at capacity ' + config.capacity} />
        <StatTile
          label="Required facts retrieved"
          value={run.learned.criticalRetrieved + '/' + run.learned.totalRequired}
          hint={'rule: ' + run.rule.criticalRetrieved + ' — retrieved is not the same as stored'}
        />
        <StatTile
          label="Updates to parity"
          value={run.parityUpdates === null ? 'never' : String(run.parityUpdates)}
          hint={
            run.parityEpisode === null
              ? 'the learned policy never reached the rule'
              : 'reached at episode ' + run.parityEpisode + '; all quality columns at ' + (run.qualityParityEpisode ?? 'never')
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Panel title="Write policy training" subtitle="REINFORCE on a tabular softmax. The reward is the later retrieval, so nothing is tuned against the answer key.">
          <Field label={'Store capacity: ' + config.capacity}>
            <Slider label="Store capacity" value={config.capacity} min={2} max={10} onChange={(value) => onChange({ capacity: value })} />
          </Field>
          <Field label={'Items the decision sees: ' + config.topK} hint="The retrieval budget. A smaller one is what makes merging pay.">
            <Slider label="Top-k retrieval" value={config.topK} min={1} max={8} onChange={(value) => onChange({ topK: value })} />
          </Field>
          <Field label={'Training episodes: ' + config.episodes} hint={run.updates + ' state-action updates in total.'}>
            <Slider label="Training episodes" value={config.episodes} min={20} max={600} step={20} onChange={(value) => onChange({ episodes: value })} />
          </Field>
          <Field label={'Learning rate: ' + config.learningRate.toFixed(2)}>
            <Slider label="Learning rate" value={config.learningRate} min={0.05} max={1} step={0.05} onChange={(value) => onChange({ learningRate: value })} />
          </Field>
          <Field label={'Wrong-write penalty: ' + config.wrongWritePenalty.toFixed(2)} hint="Cost per stored fact that shares no term with the question.">
            <Slider
              label="Wrong-write penalty"
              value={config.wrongWritePenalty}
              min={0}
              max={1}
              step={0.05}
              onChange={(value) => onChange({ wrongWritePenalty: value })}
            />
          </Field>
          <Field label={'Size penalty: ' + config.sizePenalty.toFixed(2)} hint="Cost proportional to how full the store is, as a fraction of capacity.">
            <Slider label="Size penalty" value={config.sizePenalty} min={0} max={1} step={0.05} onChange={(value) => onChange({ sizePenalty: value })} />
          </Field>
          <Field label={'Decision bonus: ' + config.decisionBonus.toFixed(2)} hint="Credit for producing a store that answers the task correctly.">
            <Slider label="Decision bonus" value={config.decisionBonus} min={0} max={1} step={0.05} onChange={(value) => onChange({ decisionBonus: value })} />
          </Field>
          <Field label="Retrieval strategy" hint="How the stored items are scored when the question is asked.">
            <Select
              label="Retrieval strategy"
              value={config.strategy}
              onChange={(value) => onChange({ strategy: value as RetrievalStrategy })}
              options={STRATEGIES.map((entry) => ({ value: entry.value, label: entry.label }))}
            />
          </Field>
          <Field label={'Seed: ' + config.seed}>
            <Slider label="Seed" value={config.seed} min={1} max={30} onChange={(value) => onChange({ seed: value })} />
          </Field>
          <Button size="sm" onClick={() => onChange(DEFAULT_WRITE_POLICY_CONFIG)}>
            Restore recommended settings
          </Button>
          <p className="text-muted text-[11px]">
            Temperature anneals from {config.startTemperature} to {config.endTemperature}, so exploration stops and the reported policy is deterministic.
          </p>
        </Panel>

        <div className="space-y-4">
          <Panel title="Learning curve" subtitle="The explored return is noisy by construction; the greedy policy is what the screen reports.">
            <ChartFigure
              title="Reward by episode"
              description="Return of the explored episode, its moving mean, the deterministic greedy policy's reward, and the fixed reward of the hand-written rule."
              columns={['Episode', 'Explored return', 'Moving mean', 'Greedy reward', 'Rule reward']}
              rows={run.curve.map((entry) => [entry.episode, entry.sampledReward, entry.movingMean, entry.greedyReward, entry.ruleReward])}
            >
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curveData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(148,178,255,0.12)" />
                    <XAxis dataKey="episode" tick={{ fontSize: 10 }} stroke="#9aa7c7" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9aa7c7" width={44} />
                    <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid rgba(148,178,255,0.25)', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="learned" stroke="#34d399" name="greedy reward" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="rule" stroke="#fbbf24" name="rule reward" strokeWidth={1} strokeDasharray="5 3" dot={false} />
                    <Line type="monotone" dataKey="sampled" stroke="#fb7185" name="explored return" strokeWidth={1} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartFigure>
          </Panel>

          <Panel title="What the policy does" subtitle="Counts of each write action in the final greedy pass, and the states it visited most.">
            <div className="space-y-2 text-xs">
              <div className="flex flex-wrap gap-2">
                {(['add', 'update', 'delete', 'none'] as const).map((action) => (
                  <Badge key={action} tone={run.learned.actions[action] > 0 ? 'cyan' : 'neutral'}>
                    {action} × {run.learned.actions[action]}
                  </Badge>
                ))}
                <Badge tone="neutral">{run.states} distinct states</Badge>
              </div>
              <p className="text-muted">
                rule: {(['add', 'update', 'delete', 'none'] as const).map((action) => action + ' × ' + run.rule.actions[action]).join(' · ')}
              </p>
              <ol className="space-y-1.5">
                {busiest.map((row) => (
                  <li key={row.state} className="surface-2 rounded border p-2" style={{ borderColor: 'var(--border-soft)' }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={row.choice === 'none' ? 'neutral' : 'emerald'}>{row.choice}</Badge>
                      <span className="text-muted font-mono text-[10px]">{row.state}</span>
                      <span className="flex-1" />
                      <span className="text-muted font-mono">
                        p = {(['add', 'update', 'delete', 'none'] as const).map((action) => row.probabilities[action].toFixed(2)).join(' / ')}
                      </span>
                    </div>
                    <p className="text-muted mt-1">{WRITE_ACTION_LABELS[row.choice]}</p>
                  </li>
                ))}
              </ol>
            </div>
          </Panel>

          <Panel title="Decision correctness as the retrieval budget shrinks" subtitle={'Swept over ' + TOPK_SWEEP.join(', ') + ' items handed to the decision.'}>
            <ChartFigure
              title="Correct decision at each retrieval budget"
              description="Whether the store each policy produced answers the task correctly, as fewer stored items are handed to the decision."
              columns={['Budget', 'Learned policy', 'Hand-written rule']}
              rows={run.decisionAccuracy.map((entry) => [
                'top-' + entry.topK,
                entry.learned ? 'correct' : 'wrong',
                entry.rule ? 'correct' : 'wrong',
              ])}
            >
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accuracyData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(148,178,255,0.12)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9aa7c7" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9aa7c7" width={30} domain={[0, 1]} ticks={[0, 1]} />
                    <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid rgba(148,178,255,0.25)', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="learned" fill="#34d399" name="learned" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="rule" fill="#fbbf24" name="rule" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartFigure>
            <p className="text-muted mt-2 text-[11px]">
              The learned policy answered {Math.round(run.learnedAccuracy * 100)} per cent of the budgets correctly, the rule{' '}
              {Math.round(run.ruleAccuracy * 100)} per cent — with {run.learned.storeSize} stored items against {run.rule.storeSize}.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
