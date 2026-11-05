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
  DEFAULT_PRIOR_LEARNING_CONFIG,
  DEFAULT_SELF_GENERATED_CONFIG,
  PRETRAINING_FAMILY,
  TRANSFER_FAMILIES,
  runPriorTransferLab,
  runSelfGeneratedLoop,
  type PriorLearningConfig,
  type SelfGeneratedConfig,
} from '../../engine/labs/policyPriors'
import { allCells, isWallish } from '../../engine/labs/worldModel'
import { Badge, Button, ChartFigure, Field, Panel, Select, Slider, StatTile, TabPanel, Tabs } from '../../ui/primitives'
import { LabReflection } from '../../ui/lesson/LabReflection'
import { useProgress } from '../../store/progress'
import { LAB_BY_ID } from '../../content/labs'

const ARROWS = ['↑', '→', '↓', '←']

export function PolicyPriorsLabPage() {
  const progress = useProgress()
  const lab = LAB_BY_ID.get('policy-priors')
  const [tab, setTab] = useState<'transfer' | 'loop'>('transfer')
  const [priorConfig, setPriorConfig] = useState<PriorLearningConfig>(DEFAULT_PRIOR_LEARNING_CONFIG)
  const [loopConfig, setLoopConfig] = useState<SelfGeneratedConfig>(DEFAULT_SELF_GENERATED_CONFIG)
  const [familyId, setFamilyId] = useState(TRANSFER_FAMILIES[2].id)

  const priors = useMemo(() => runPriorTransferLab(priorConfig), [priorConfig])
  const loop = useMemo(() => runSelfGeneratedLoop(loopConfig), [loopConfig])

  const updatePrior = (patch: Partial<PriorLearningConfig>) => {
    const next = { ...priorConfig, ...patch }
    setPriorConfig(next)
    progress.recordLab('policy-priors', 'transfer:ep=' + next.episodes + ':strength=' + next.priorStrength)
  }

  const updateLoop = (patch: Partial<SelfGeneratedConfig>) => {
    const next = { ...loopConfig, ...patch }
    setLoopConfig(next)
    progress.recordLab('policy-priors', 'loop:share=' + next.externalShare + ':slip=' + next.world.slip.toFixed(2))
  }

  const family = priors.families.find((entry) => entry.family.id === familyId) ?? priors.families[0]
  const transferData = priors.families.map((entry) => ({
    name: entry.family.label,
    prior: entry.prior.stepsToThreshold ?? entry.prior.interactionSteps,
    scratch: entry.scratch.stepsToThreshold ?? entry.scratch.interactionSteps,
  }))

  const loopData = loop.selfOnly.generations.map((row, index) => ({
    generation: row.generation,
    selfError: row.modelError,
    mixedError: loop.mixed.generations[index].modelError,
    selfSuccess: row.successRate,
    mixedSuccess: loop.mixed.generations[index].successRate,
    selfCoverage: row.coverage,
    mixedCoverage: loop.mixed.generations[index].coverage,
  }))

  const cells = useMemo(() => allCells(family.family.world), [family.family.world])

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="emerald">Lab E</Badge>
          <Badge tone="neutral">Seeded tabular RL · no model calls</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{lab?.name ?? 'Robot Policies'}</h1>
        <p className="text-muted max-w-3xl text-sm">{lab?.description}</p>
      </header>

      <Tabs
        idPrefix="policy-priors-tabs"
        ariaLabel="Robot policy measurements"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'transfer', label: 'What a pretrained prior buys' },
          { id: 'loop', label: "Training on the policy's own data" },
        ]}
      />

      {tab === 'transfer' ? (
        <TabPanel idPrefix="policy-priors-tabs" id="transfer" active>
          <TransferPanel
            config={priorConfig}
            onChange={updatePrior}
            run={priors}
            familyId={familyId}
            onSelectFamily={setFamilyId}
            family={family}
            transferData={transferData}
            cells={cells}
          />
        </TabPanel>
      ) : (
        <TabPanel idPrefix="policy-priors-tabs" id="loop" active>
          <LoopPanel config={loopConfig} onChange={updateLoop} run={loop} loopData={loopData} />
        </TabPanel>
      )}

      <Panel title="What to notice" subtitle="Both tabs measure the same thing from two directions: what a policy's starting knowledge is worth.">
        <ul className="text-muted space-y-2 text-xs">
          <li>
            A transferred table is not a head start, it is an opinion. Where the opinion matches the new task the prior reaches the success threshold in
            a fraction of the interactions; where it does not, every interaction has to undo it. The sign is measured per family, so the second case is
            reported as the cost it is rather than dropped.
          </li>
          <li>
            The pretraining task itself is paid for. Its interaction count is shown next to the transfer savings, because a speed-up that ignores the
            cost of the prior is the number the marketing slide quotes and the number the paper is more careful about.
          </li>
          <li>
            The second tab is the same failure mode with a different cause. A model fitted on the policy's own rollouts only ever sees the state-action
            pairs the policy already visits, so coverage falls, the pairs it stops visiting are the pairs it is about to need, and planning inside that
            model gets more confident as it gets more wrong.
          </li>
          <li>
            Keeping a fixed external pool in the training set holds the coverage up and the model error down. That is the honest version of the
            self-improvement story in Ch. 23 §23.2.2: the loop is open, not solved, and this screen shows the part that stays open.
          </li>
        </ul>
      </Panel>

      <LabReflection labId="policy-priors" />
    </div>
  )
}

function TransferPanel({
  config,
  onChange,
  run,
  familyId,
  onSelectFamily,
  family,
  transferData,
  cells,
}: {
  config: PriorLearningConfig
  onChange: (patch: Partial<PriorLearningConfig>) => void
  run: ReturnType<typeof runPriorTransferLab>
  familyId: string
  onSelectFamily: (id: string) => void
  family: ReturnType<typeof runPriorTransferLab>['families'][number]
  transferData: { name: string; prior: number; scratch: number }[]
  cells: [number, number][]
}) {
  const world = family.family.world
  const saved = run.helped.reduce((sum, id) => {
    const entry = run.families.find((candidate) => candidate.family.id === id)
    return sum + Math.max(0, entry ? entry.stepSaving : 0)
  }, 0)
  const spent = run.hurt.reduce((sum, id) => {
    const entry = run.families.find((candidate) => candidate.family.id === id)
    return sum + Math.max(0, entry ? -entry.stepSaving : 0)
  }, 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Interactions saved" value={String(saved)} hint={run.helped.length + ' family(ies) where the prior was right'} />
        <StatTile label="Interactions spent" value={String(spent)} hint={run.hurt.length + ' family(ies) where it was wrong'} />
        <StatTile label="Pretraining cost" value={String(run.pretraining.interactionSteps)} hint="real steps to learn the table the prior brings" />
        <StatTile label="Net of one prior run" value={String(saved - spent)} hint="savings minus undoing, across the three transfer families" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Panel title="Prior learner" subtitle="Same budget, same seed, same probe for both arms. The only difference is the starting Q-table.">
          <Field label={'Training episodes: ' + config.episodes}>
            <Slider label="Training episodes" value={config.episodes} min={40} max={400} step={10} onChange={(value) => onChange({ episodes: value })} />
          </Field>
          <Field
            label={'Prior strength: ' + config.priorStrength.toFixed(2)}
            hint="How much of the pretraining table the prior agent starts with. 0 is the scratch arm; above 1 is a stubborn prior."
          >
            <Slider label="Prior strength" value={config.priorStrength} min={0} max={1.5} step={0.1} onChange={(value) => onChange({ priorStrength: value })} />
          </Field>
          <Field label={'Success threshold: ' + config.successThreshold.toFixed(2)} hint="Greedy-policy success rate that counts as having learned the task.">
            <Slider
              label="Success threshold"
              value={config.successThreshold}
              min={0.2}
              max={0.9}
              step={0.05}
              onChange={(value) => onChange({ successThreshold: value })}
            />
          </Field>
          <Field label={'Step cap: ' + config.stepCap} hint="Steps allowed per episode, in training and in evaluation.">
            <Slider label="Step cap" value={config.stepCap} min={10} max={60} onChange={(value) => onChange({ stepCap: value })} />
          </Field>
          <Field label={'Seed: ' + config.seed}>
            <Slider label="Seed" value={config.seed} min={1} max={30} onChange={(value) => onChange({ seed: value })} />
          </Field>
          <Button size="sm" onClick={() => onChange(DEFAULT_PRIOR_LEARNING_CONFIG)}>
            Restore recommended settings
          </Button>
          <p className="text-muted text-[11px]">
            Slip is a property of each family's world, not of the learner: {world.slip.toFixed(2)} everywhere. The pretraining family is{' '}
            {PRETRAINING_FAMILY.structure}.
          </p>
        </Panel>

        <div className="space-y-4">
          <Panel title="Transfer families" subtitle="One learned table, three new tasks. Pick a family to see both policies on it.">
            <Field label="Family" hint={family.family.expectation}>
              <Select
                label="Transfer family"
                value={familyId}
                onChange={onSelectFamily}
                options={run.families.map((entry) => ({
                  value: entry.family.id,
                  label: entry.family.label + (entry.negativeTransfer ? ' (prior costs)' : ' (prior pays)'),
                }))}
              />
            </Field>
            <div className="mt-3 space-y-2 text-xs">
              {run.families.map((entry) => (
                <div key={entry.family.id} className="surface-2 rounded border p-2" style={{ borderColor: 'var(--border-soft)' }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={entry.negativeTransfer ? 'rose' : 'emerald'}>{entry.negativeTransfer ? 'negative transfer' : 'positive transfer'}</Badge>
                    <Badge tone="neutral">{entry.family.relation}</Badge>
                    <span className="text-muted font-mono">
                      prior {entry.prior.stepsToThreshold ?? 'never'} / scratch {entry.scratch.stepsToThreshold ?? 'never'} steps
                    </span>
                    <span className="flex-1" />
                    <span>{entry.speedup === null ? 'no threshold' : entry.speedup.toFixed(2) + 'x cost ratio'}</span>
                  </div>
                  <p className="text-muted mt-1">{entry.family.structure}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Interactions to the success threshold" subtitle="Lower is cheaper. An arm that never reaches the threshold is charged its full budget.">
            <ChartFigure
              title="Real-environment steps to threshold, per family"
              description="For each transfer family, the number of real-environment interactions each arm spent before its greedy policy first met the success threshold."
              columns={['Family', 'With pretrained prior', 'From scratch']}
              rows={transferData.map((entry) => [entry.name, entry.prior, entry.scratch])}
            >
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={transferData} margin={{ top: 8, right: 8, left: 0, bottom: 60 }}>
                    <CartesianGrid stroke="rgba(148,178,255,0.12)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#9aa7c7" interval={0} angle={-12} height={70} />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9aa7c7" width={54} />
                    <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid rgba(148,178,255,0.25)', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="prior" fill="#35e6ff" name="with prior" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="scratch" fill="#a78bfa" name="from scratch" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartFigure>
          </Panel>

          <Panel title="The two policies on the chosen family" subtitle="Arrows are the greedy action in each cell. The prior arm starts from the pretraining table and ends here.">
            <div className="grid gap-3 md:grid-cols-2">
              <PolicyGrid title="With pretrained prior" world={world} policy={family.prior.policy} cells={cells} success={family.prior.successAtBudget} />
              <PolicyGrid title="Learned from scratch" world={world} policy={family.scratch.policy} cells={cells} success={family.scratch.successAtBudget} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

interface LoopDatum {
  generation: number
  selfError: number
  mixedError: number
  selfSuccess: number
  mixedSuccess: number
  selfCoverage: number
  mixedCoverage: number
}

function LoopPanel({
  config,
  onChange,
  run,
  loopData,
}: {
  config: SelfGeneratedConfig
  onChange: (patch: Partial<SelfGeneratedConfig>) => void
  run: ReturnType<typeof runSelfGeneratedLoop>
  loopData: LoopDatum[]
}) {
  const world = config.world
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Model error, self-only"
          value={run.selfOnly.initialError.toFixed(3) + ' to ' + run.selfOnly.finalError.toFixed(3)}
          hint={'peak ' + run.selfOnly.peakError.toFixed(3) + ' at generation ' + run.selfOnly.peakErrorAt}
        />
        <StatTile
          label="Model error, mixed"
          value={run.mixed.initialError.toFixed(3) + ' to ' + run.mixed.finalError.toFixed(3)}
          hint={'threshold ' + config.errorThreshold.toFixed(2)}
        />
        <StatTile
          label="Coverage, self-only"
          value={run.selfOnly.initialCoverage.toFixed(2) + ' to ' + run.selfOnly.finalCoverage.toFixed(2)}
          hint="share of state-action pairs the data ever touched"
        />
        <StatTile
          label="Final success, both arms"
          value={run.selfOnly.finalSuccess.toFixed(2) + ' / ' + run.mixed.finalSuccess.toFixed(2)}
          hint={'arms separated at generation ' + (run.separationAt ?? 'never')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Panel title="Retraining loop" subtitle="Generation 0 is identical in both arms: it comes from the fixed pool. Only the data changes after that.">
          <Field label={'Generations: ' + config.generations}>
            <Slider label="Generations" value={config.generations} min={3} max={16} onChange={(value) => onChange({ generations: value })} />
          </Field>
          <Field
            label={'External share: ' + (config.externalShare * 100).toFixed(0) + '%'}
            hint="Share of each generation's training budget drawn from the fixed pool. The self-only arm is this at 0."
          >
            <Slider label="External share" value={config.externalShare} min={0} max={1} step={0.05} onChange={(value) => onChange({ externalShare: value })} />
          </Field>
          <Field label={'Demonstrations per pair: ' + config.demonstrationsPerPair} hint={'Pool size is ' + run.poolSize + ' transitions.'}>
            <Slider
              label="Demonstrations per pair"
              value={config.demonstrationsPerPair}
              min={1}
              max={12}
              onChange={(value) => onChange({ demonstrationsPerPair: value })}
            />
          </Field>
          <Field
            label={'Naive prior mass: ' + config.naivePriorMass.toFixed(2)}
            hint="Pseudo-counts of the belief that an action always works. Unvisited pairs keep it outright."
          >
            <Slider label="Naive prior mass" value={config.naivePriorMass} min={0} max={3} step={0.25} onChange={(value) => onChange({ naivePriorMass: value })} />
          </Field>
          <Field label={'Slip: ' + world.slip.toFixed(2)} hint="The world the model has to learn. A slip lands on a perpendicular action.">
            <Slider
              label="Slip probability"
              value={world.slip}
              min={0}
              max={0.6}
              step={0.05}
              onChange={(value) => onChange({ world: { ...world, slip: value } })}
            />
          </Field>
          <Field label={'Step cap: ' + config.stepCap}>
            <Slider label="Step cap" value={config.stepCap} min={8} max={24} onChange={(value) => onChange({ stepCap: value })} />
          </Field>
          <Field label={'Seed: ' + config.seed}>
            <Slider label="Seed" value={config.seed} min={1} max={30} onChange={(value) => onChange({ seed: value })} />
          </Field>
          <Button size="sm" onClick={() => onChange(DEFAULT_SELF_GENERATED_CONFIG)}>
            Restore recommended settings
          </Button>
          <p className="text-muted text-[11px]">
            The probe that scores every model is {run.probeSummary.samples} real transitions over {run.probeSummary.pairs} state-action pairs, drawn once
            with seed {run.probeSummary.seed}. Neither arm can influence it.
          </p>
        </Panel>

        <div className="space-y-4">
          <Panel title="Model error grows as coverage falls" subtitle="Scored against the fixed probe, so this is the model disagreeing with the world, not with itself.">
            <ChartFigure
              title="Model error and coverage by generation"
              description="Mean divergence between the learned model and the real dynamics, and the share of state-action pairs the training data touched, for both arms."
              columns={['Generation', 'Self-only error', 'Mixed error', 'Self-only coverage', 'Mixed coverage']}
              rows={loopData.map((entry) => [
                entry.generation,
                entry.selfError.toFixed(3),
                entry.mixedError.toFixed(3),
                entry.selfCoverage.toFixed(3),
                entry.mixedCoverage.toFixed(3),
              ])}
            >
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={loopData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(148,178,255,0.12)" />
                    <XAxis dataKey="generation" tick={{ fontSize: 10 }} stroke="#9aa7c7" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9aa7c7" width={40} domain={[0, 1]} />
                    <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid rgba(148,178,255,0.25)', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="selfError" stroke="#fb7185" name="self-only error" strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="mixedError" stroke="#fbbf24" name="mixed error" strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="selfCoverage" stroke="#35e6ff" name="self-only coverage" strokeWidth={1} strokeDasharray="4 3" dot={false} />
                    <Line type="monotone" dataKey="mixedCoverage" stroke="#34d399" name="mixed coverage" strokeWidth={1} strokeDasharray="4 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartFigure>
          </Panel>

          <Panel title="Success in the real world" subtitle="Every policy is evaluated in the real environment, never inside its own model.">
            <ChartFigure
              title="Success rate by generation"
              description="Success rate of the greedy policy of the model fitted in that generation, for the self-only arm and the arm that keeps a fixed pool of external transitions."
              columns={['Generation', 'Self-only success', 'Mixed success']}
              rows={loopData.map((entry) => [entry.generation, entry.selfSuccess.toFixed(2), entry.mixedSuccess.toFixed(2)])}
            >
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={loopData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(148,178,255,0.12)" />
                    <XAxis dataKey="generation" tick={{ fontSize: 10 }} stroke="#9aa7c7" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9aa7c7" width={40} domain={[0, 1]} />
                    <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid rgba(148,178,255,0.25)', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="selfSuccess" stroke="#fb7185" name="self-only" strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="mixedSuccess" stroke="#34d399" name="mixed" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartFigure>
          </Panel>
        </div>
      </div>

      <Panel title="Per generation" subtitle="Where each arm got its data, what the model then believed, and what the policy did.">
        <ol tabIndex={0} aria-label="Generations of the self-generated loop" className="thin-scroll max-h-96 space-y-1.5 overflow-y-auto pr-1 text-xs focus-ring">
          {run.selfOnly.generations.map((row, index) => {
            const mixedRow = run.mixed.generations[index]
            const worst = row.worstDivergences[0]
            return (
              <li key={row.generation} className="surface-2 rounded border p-2" style={{ borderColor: 'var(--border-soft)' }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted font-mono text-[10px]">g{row.generation}</span>
                  <Badge tone={row.errorAboveThreshold ? 'rose' : 'emerald'}>self-only err {row.modelError.toFixed(3)}</Badge>
                  <Badge tone={mixedRow.errorAboveThreshold ? 'rose' : 'emerald'}>mixed err {mixedRow.modelError.toFixed(3)}</Badge>
                  <Badge tone="neutral">
                    cov {row.coverage.toFixed(2)} / {mixedRow.coverage.toFixed(2)}
                  </Badge>
                  <Badge tone="cyan">own data {(row.selfGeneratedShare * 100).toFixed(0)}%</Badge>
                  <span className="text-muted">{row.dataOrigin}</span>
                </div>
                <p className="text-muted mt-1">
                  success {row.successRate.toFixed(2)} vs {mixedRow.successRate.toFixed(2)}; worst pair{' '}
                  {worst ? '(' + worst.state[0] + ',' + worst.state[1] + ') ' + ARROWS[worst.action] + ' ' + worst.divergence.toFixed(3) : 'none'}
                </p>
              </li>
            )
          })}
        </ol>
      </Panel>
    </div>
  )
}

function PolicyGrid({
  title,
  world,
  policy,
  cells,
  success,
}: {
  title: string
  world: Parameters<typeof allCells>[0]
  policy: Record<string, number>
  cells: [number, number][]
  success: number
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">{title}</p>
      <p className="text-muted text-[11px]">greedy success in the real world: {success.toFixed(2)}</p>
      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(' + world.width + ', minmax(0, 1fr))', gap: 4 }}
        role="img"
        aria-label={title + ' policy grid'}
      >
        {Array.from({ length: world.width * world.height }, (_, index) => {
          const x = index % world.width
          const y = Math.floor(index / world.width)
          const inPlay = cells.some((cell) => cell[0] === x && cell[1] === y)
          const background = isWallish(world, x, y)
            ? 'rgba(148,178,255,0.22)'
            : x === world.goal[0] && y === world.goal[1]
              ? 'rgba(52,211,153,0.25)'
              : x === world.pit[0] && y === world.pit[1]
                ? 'rgba(251,113,133,0.22)'
                : x === world.start[0] && y === world.start[1]
                  ? 'rgba(251,191,36,0.22)'
                  : 'var(--surface-2)'
          return (
            <div
              key={x + '-' + y}
              className="grid aspect-square place-items-center rounded-md border text-sm font-semibold"
              style={{ borderColor: 'var(--border-soft)', background }}
              title={'(' + x + ',' + y + ')'}
            >
              {inPlay ? ARROWS[policy[x + ',' + y]] ?? '' : ''}
            </div>
          )
        })}
      </div>
    </div>
  )
}
