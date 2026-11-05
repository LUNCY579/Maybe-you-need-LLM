import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CHECKER_CALL_TOKENS,
  CHECKER_REPAIR_PROBABILITY,
  DEFAULT_REASONING_DEPTH_CONFIG,
  REASONING_STYLES,
  REASONING_TASKS,
  TASK_FAMILIES,
  effectiveChainLength,
  runDepthBattery,
  type FamilyComparison,
  type ReasoningDepthConfig,
  type ReasoningStyle,
  type TaskFamilyId,
} from '../../engine/demos/reasoningDepth'
import {
  COMPARISON_PROVENANCE,
  STAND_IN_DEPTH_CONFIG,
  runFrontierAudit,
  type AuditRow,
} from '../../engine/demos/frontierAccount'
import {
  Badge,
  Button,
  Callout,
  Card,
  ChartFigure,
  Field,
  Panel,
  Select,
  Slider,
  StatTile,
} from '../../ui/primitives'
import { LabReflection } from '../../ui/lesson/LabReflection'
import { useProgress } from '../../store/progress'
import { LAB_BY_ID } from '../../content/labs'

const percent = (value: number) => `${(value * 100).toFixed(1)}%`
/** A difference in accuracy, spoken in percentage points. */
const points = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(1)} pt`
const one = (value: number) => value.toFixed(1)

const FAMILY_COLOURS: Record<TaskFamilyId, string> = {
  arithmetic: '#35e6ff',
  symbolic: '#a78bfa',
  knowledge: '#34d399',
  commonsense: '#fbbf24',
  writing: '#fb7185',
}

const VERDICT_TONES: Record<FamilyComparison['verdict'], 'emerald' | 'rose' | 'amber'> = {
  'depth-pays': 'emerald',
  'depth-costs': 'rose',
  flat: 'amber',
}

const VERDICT_LABELS: Record<FamilyComparison['verdict'], string> = {
  'depth-pays': 'depth pays',
  'depth-costs': 'depth costs',
  flat: 'flat',
}

const STYLE_OPTIONS = REASONING_STYLES.map((style) => ({ value: style.value, label: style.label }))

/** Which policy the audit's measured column runs. The reported column has no policy. */
type StandInChoice = 'declared' | 'current'

const cell = 'border-b px-2 py-1'
const CELL_STYLE = { borderColor: 'var(--border-soft)' } as const

export function ReasoningLabPage() {
  const progress = useProgress()
  const lab = LAB_BY_ID.get('reasoning')
  const [config, setConfig] = useState<ReasoningDepthConfig>(DEFAULT_REASONING_DEPTH_CONFIG)
  const [standIn, setStandIn] = useState<StandInChoice>('declared')

  const battery = useMemo(() => runDepthBattery(config), [config])
  const auditConfig = standIn === 'declared' ? STAND_IN_DEPTH_CONFIG : config
  const audit = useMemo(() => runFrontierAudit(auditConfig), [auditConfig])

  const update = (patch: Partial<ReasoningDepthConfig>) => {
    const next = { ...config, ...patch }
    setConfig(next)
    progress.recordLab('reasoning', `${next.style}:k=${next.chainLength}:e=${next.perStepError}`)
  }

  const sweepData = battery.sweep.map((point) => ({
    k: point.chainLength,
    aggregate: point.aggregate,
    ...point.perFamily,
  }))

  const hurts = battery.perFamily.filter((row) => row.verdict === 'depth-costs')
  const pays = battery.perFamily.filter((row) => row.verdict === 'depth-pays')
  const chosen = REASONING_STYLES.find((style) => style.value === config.style)!
  const stepsRun = effectiveChainLength(config.style, config.chainLength)

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="cyan">Ch. 6 · Ch. 9 · Ch. 23</Badge>
          <Badge tone="neutral">Deterministic · calls no model</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {lab?.name ?? 'Reasoning Depth and the Frontier Audit'}
        </h1>
        <p className="text-muted max-w-3xl text-sm">
          {lab?.description ??
            'Two measurements. First, chain of thought as the book defines it — interaction style C, a reasoner whose own steps are never answered by the world — run against styles A and B over a hand-authored battery. Second, an audit of what this course can actually check about the frontier the chapter measures itself against.'}
        </p>
        <Callout tone="warning" title="What this engine is">
          <p>
            A deterministic analogue over a hand-authored battery of {REASONING_TASKS.length} tasks. It samples a
            per-step error rate with a seeded generator; it does not call a model, does not read a transcript, and does
            not report any real system's score. Every figure on this page is computed from the sliders by
            <code className="mx-1 rounded px-1" style={CELL_STYLE}>
              src/engine/demos
            </code>
            . The battery is a measuring instrument, not a benchmark.
          </p>
        </Callout>
      </header>

      {/* -------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-lg font-semibold tracking-tight">1 · The reasoning depth battery</h2>
          <span className="text-muted text-xs">
            Ch. 6 §6.1 and Ch. 9 §9.2.1.3 style C; Ch. 23 §23.2.2 warns that more thinking is not always better.
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Style A · one step"
            value={percent(battery.directAggregate)}
            hint={`aggregate over ${battery.perFamily.length} families`}
          />
          <StatTile
            label={`Style ${config.style} · ${stepsRun} step${stepsRun === 1 ? '' : 's'}`}
            value={percent(battery.aggregateAtChainLength)}
            hint={`${points(battery.aggregateGain)} against one step`}
          />
          <StatTile
            label="Aggregate peak"
            value={`${battery.aggregateCrossover} step${battery.aggregateCrossover === 1 ? '' : 's'}`}
            hint={battery.moreDepthPays ? 'a longer chain does beat one step' : 'no chain length beats one step'}
          />
          <StatTile
            label="Cost of the chain"
            value={`${battery.aggregateTokenRatio.toFixed(2)}×`}
            hint={`tokens against style A; style B costs ${one(battery.perFamily.reduce((s, r) => s + r.checked.meanTokens, 0))} tokens total`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Panel title="The three policies" subtitle="Same error rate, same tasks, same seeds: only the shape of the interaction changes.">
            <Field label={`Policy: ${chosen.label}`} hint={chosen.description}>
              <Select
                label="Interaction style"
                value={config.style}
                options={STYLE_OPTIONS}
                onChange={(value) => update({ style: value as ReasoningStyle })}
              />
            </Field>
            <Field label={`Chain length: ${config.chainLength}`} hint="Steps emitted per task. Style A ignores it and always runs one.">
              <Slider label="Chain length" value={config.chainLength} min={1} max={12} step={1} onChange={(value) => update({ chainLength: value })} />
            </Field>
            <Field label={`Per-step error rate: ${config.perStepError.toFixed(3)}`} hint="Chance a step goes wrong per operation it carries. A step carrying two operations is twice as exposed.">
              <Slider label="Per-step error rate" value={config.perStepError} min={0} max={0.12} step={0.005} onChange={(value) => update({ perStepError: value })} />
            </Field>
            <Field label={`Samples per task: ${config.trials}`} hint="More samples smooth the curve; they do not change the mechanism.">
              <Slider label="Samples per task" value={config.trials} min={100} max={800} step={50} onChange={(value) => update({ trials: value })} />
            </Field>
            <Field label={`Seed: ${config.seed}`} hint="Same seed, same numbers. Each trial keeps its own stream whatever the policy, so a difference is not sampling noise.">
              <Slider label="Seed" value={config.seed} min={1} max={30} step={1} onChange={(value) => update({ seed: value })} />
            </Field>
            <Button size="sm" onClick={() => update(DEFAULT_REASONING_DEPTH_CONFIG)}>
              Restore defaults
            </Button>
            <p className="text-muted text-[11px]">
              A task is correct only when every step survives. Style B pays {CHECKER_CALL_TOKENS} tokens per check and
              repairs {percent(CHECKER_REPAIR_PROBABILITY)} of the steps that already failed, and only in a family where
              an external check exists.
            </p>
          </Panel>

          <div className="space-y-4">
            <Panel
              title="Accuracy against chain length"
              subtitle="Style C at each swept length, family by family, with the battery aggregate."
            >
              <ChartFigure
                title="Accuracy against chain length"
                description={`Measured accuracy for each family as the chain grows from ${battery.sweep[0].chainLength} to ${battery.sweep.at(-1)!.chainLength} steps, at a per-step error rate of ${config.perStepError.toFixed(3)}. The aggregate peaks at ${battery.aggregateCrossover} step(s).`}
                columns={['Steps', 'Aggregate', ...TASK_FAMILIES.map((family) => family.label)]}
                rows={battery.sweep.map((point) => [
                  point.chainLength,
                  percent(point.aggregate),
                  ...TASK_FAMILIES.map((family) => percent(point.perFamily[family.id])),
                ])}
              >
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sweepData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke="rgba(148,178,255,0.12)" />
                      <XAxis dataKey="k" tick={{ fontSize: 10 }} stroke="#9aa7c7" label={{ value: 'steps', position: 'insideBottom', offset: -4, fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} stroke="#9aa7c7" width={44} domain={[0, 1]} tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} />
                      <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid rgba(148,178,255,0.25)', fontSize: 12 }} />
                      {TASK_FAMILIES.map((family) => (
                        <Line
                          key={family.id}
                          type="monotone"
                          dataKey={family.id}
                          name={family.label}
                          stroke={FAMILY_COLOURS[family.id]}
                          strokeWidth={family.decomposable ? 2 : 1.4}
                          strokeDasharray={family.decomposable ? undefined : '4 3'}
                          dot={{ r: 2 }}
                        />
                      ))}
                      <Line type="monotone" dataKey="aggregate" name="battery aggregate" stroke="#e8ecf7" strokeWidth={2.4} strokeDasharray="2 2" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartFigure>
              <p className="text-muted mt-2 text-[11px]">
                Solid lines are families whose work is a dependent sequence, so a longer chain gives each step less to
                carry. Dashed lines are families where every step must still hold the whole problem, so an extra step is
                only an extra place to fail. That single difference is what the whole chart is testing.
              </p>
            </Panel>

            <Panel
              title="Family comparison at this setting"
              subtitle={`Style ${config.style} at ${stepsRun} step(s), against style A at one step and style B at the same length.`}
            >
              <div className="thin-scroll overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-xs">
                  <caption className="text-muted mb-2 text-left">
                    Measured, not asserted: accuracy, steps and tokens per execution for each policy.
                  </caption>
                  <thead>
                    <tr>
                      {['Family', 'Work decomposes?', 'A', `C (${stepsRun})`, 'B', 'Δ vs A', 'Δ vs B', 'A tokens', 'C tokens', 'Verdict'].map((header) => (
                        <th key={header} scope="col" className={`${cell} text-left uppercase`} style={CELL_STYLE}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {battery.perFamily.map((row) => (
                      <tr key={row.family.id}>
                        <td className={cell} style={CELL_STYLE}>
                          {row.family.label}
                        </td>
                        <td className={cell} style={CELL_STYLE}>
                          {row.family.decomposable ? 'yes' : 'no'}
                          {row.family.externallyCheckable ? ' · checkable' : ' · no check'}
                        </td>
                        <td className={cell} style={CELL_STYLE}>{percent(row.direct.accuracy)}</td>
                        <td className={cell} style={CELL_STYLE}>{percent(row.current.accuracy)}</td>
                        <td className={cell} style={CELL_STYLE}>{percent(row.checked.accuracy)}</td>
                        <td className={cell} style={CELL_STYLE}>{points(row.deltaVsDirect)}</td>
                        <td className={cell} style={CELL_STYLE}>{points(row.deltaVsChecked)}</td>
                        <td className={cell} style={CELL_STYLE}>{one(row.direct.meanTokens)}</td>
                        <td className={cell} style={CELL_STYLE}>{one(row.current.meanTokens)}</td>
                        <td className={cell} style={CELL_STYLE}>
                          <Badge tone={VERDICT_TONES[row.verdict]}>{VERDICT_LABELS[row.verdict]}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Callout tone="insight" title="The verdict the numbers gave">
                <p>
                  At this setting the chain beats a single step in{' '}
                  <strong>{pays.length === 0 ? 'no family' : pays.map((row) => row.family.label).join(', ')}</strong>
                  {' '}and is worse in{' '}
                  <strong>{hurts.length === 0 ? 'no family' : hurts.map((row) => row.family.label).join(', ')}</strong>.
                  Averaged over the battery, more depth {battery.moreDepthPays ? 'pays' : 'does not pay'}: the peak is
                  at {battery.aggregateCrossover} step{battery.aggregateCrossover === 1 ? '' : 's'}, and style A alone
                  scores {percent(battery.directAggregate)} against {percent(battery.aggregateAtChainLength)} here.
                  {hurts.length > 0 && (
                    <>
                      {' '}Where chain of thought measurably <em>hurts</em> —{' '}
                      {hurts.map((row) => `${row.family.label} ${points(row.deltaVsDirect)}`).join(', ')} — the added
                      steps return no observation, so they only add chances to fail and a mistake early in the chain is
                      carried by every step after it.
                    </>
                  )}
                </p>
                <p>
                  Style B is measured above both wherever a check exists ({battery.perFamily.filter((row) => row.family.externallyCheckable).map((row) => row.family.label).join(', ')}), and
                  level with style C where none does ({battery.perFamily.filter((row) => !row.family.externallyCheckable).map((row) => row.family.label).join(', ')}), at
                  {one(battery.perFamily.reduce((sum, row) => sum + (row.checked.meanTokens - row.current.meanTokens), 0))} extra tokens per execution in total. A tool
                  that reads nothing back is a bill, not an observation.
                </p>
              </Callout>
            </Panel>

            <Card className="p-4">
              <h3 className="text-sm font-semibold">Where each family peaks</h3>
              <ul className="text-muted mt-2 grid gap-1 text-xs sm:grid-cols-2">
                {TASK_FAMILIES.map((family) => (
                  <li key={family.id}>
                    {family.label}: {battery.crossover[family.id]} step{battery.crossover[family.id] === 1 ? '' : 's'}{' '}
                    ({family.decomposable ? 'the work splits' : 'the work does not split'})
                  </li>
                ))}
              </ul>
              <p className="text-muted mt-2 text-[11px]">
                The crossover is read off the sweep above: it is the swept length with the highest measured accuracy for
                that family at the current error rate. Move the error-rate slider and watch the peaks move with it.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-lg font-semibold tracking-tight">2 · The frontier audit</h2>
          <span className="text-muted text-xs">Ch. 23 measures itself against the frontier; this is what this course can check.</span>
        </div>

        <Callout tone="warning" title="Two columns that are not the same kind of thing">
          <p>
            The left columns are <strong>measured here</strong>: a deterministic rule-based stand-in run by this app
            over this course's own battery and this course's own question bank. The right column is{' '}
            <strong>reported text</strong> — statements the chapter records, cited by section, and each cell is stored
            with the provenance label{' '}
            <code className="rounded px-1" style={CELL_STYLE}>
              {COMPARISON_PROVENANCE}
            </code>
            . Nothing in this section reproduces, estimates or displays a score for GPT-4 or any other model, and the
            engine refuses any comparison cell that contains a digit: {audit.provenance.ok ? 'all' : 'some'} of{' '}
            {audit.provenance.cells} cells pass that check
            {audit.provenance.violations.length > 0 ? ` (${audit.provenance.violations.length} violations: ${audit.provenance.violations.join('; ')})` : ', so the screen has no measurement to disguise'}
            .
          </p>
        </Callout>

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Panel title="The stand-in" subtitle="A rule with one job: show what this course can measure for itself.">
            <Field
              label="Which policy the measured column runs"
              hint="The declared policy is style A at one step, seed 11 — the least generous setting the battery has, so the measured column cannot be accused of being the best of nine. The current policy is whatever section 1 is set to."
            >
              <Select
                label="Stand-in policy"
                value={standIn}
                options={[
                  { value: 'declared', label: 'Declared: style A, one step' },
                  { value: 'current', label: "Current: the battery's sliders" },
                ]}
                onChange={(value) => {
                  setStandIn(value)
                  progress.recordLab('reasoning', `audit:standin=${value}`)
                }}
              />
            </Field>
            <p className="text-muted text-[11px]">
              Either way the reported column does not move: it is text with a citation, and a slider has no purchase on
              it. The rule answers a question by picking the option whose wording overlaps that chapter's lesson text
              most, and abstains on zero overlap or a tie — it is written down in full in{' '}
              <code className="rounded px-1" style={CELL_STYLE}>frontierAccount.ts</code> and tested in{' '}
              <code className="rounded px-1" style={CELL_STYLE}>frontierAccount.test.ts</code>.
            </p>
          </Panel>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile
              label="Stand-in on the battery"
              value={percent(audit.rows.reduce((sum, row) => sum + (row.standIn?.accuracy ?? 0), 0) / Math.max(1, audit.rows.length))}
              hint={standIn === 'declared' ? 'declared policy: style A, one step' : `the battery's current policy: style ${auditConfig.style}, ${effectiveChainLength(auditConfig.style, auditConfig.chainLength)} step(s)`}
            />
            <StatTile
              label="Bank questions it can answer"
              value={`${audit.bank.answerable}/${audit.bank.questions}`}
              hint={`the five families cover ${audit.bank.questions} of the ${audit.bank.wholeBank} questions in the course bank`}
            />
            <StatTile
              label="Right when it answered"
              value={percent(audit.bank.answerable === 0 ? 0 : audit.bank.matchesKey / audit.bank.answerable)}
              hint={`${audit.bank.matchesKey} matches to the bank's own key`}
            />
            <StatTile
              label="Frontier limits this course teaches"
              value={`${audit.limitations.taughtCount}/${audit.limitations.total}`}
              hint={audit.limitations.untaught.length > 0 ? `not taught: ${audit.limitations.untaught.join(', ')}` : 'every recorded limitation'}
            />
          </div>
        </div>

        <Panel
          title="Measured here, reported there"
          subtitle="The stand-in is a rule, not a model: it answers a question by choosing the option whose wording overlaps the chapter's own lesson text most, and abstains when nothing overlaps or two options tie."
        >
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-xs">
              <caption className="text-muted mb-2 text-left">{audit.summary}</caption>
              <thead>
                <tr>
                  {['Family', 'Measured: stand-in accuracy', 'Measured: bank coverage', 'Measured: matched key', 'Reported, not measured here'].map((header) => (
                    <th key={header} scope="col" className={`${cell} text-left uppercase`} style={CELL_STYLE}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.rows.map((row) => (
                  <AuditRowCells key={row.family} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted mt-2 text-[11px]">
            Read the two right-hand measured columns as a statement about <em>this course</em>: a rule that echoes the
            lesson's own wording gets {audit.bank.matchesKey} of {audit.bank.answerable} right, which says the bank is
            close to the text it was written from. It says nothing at all about any deployed model — the audit has no
            way to run one, and does not claim to.
          </p>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="What the chapter records, and what this course teaches" subtitle="A coverage count over this course's own lesson text.">
            <ul className="space-y-2 text-xs">
              {audit.limitations.rows.map((row) => (
                <li key={row.limitation.id} className="surface-2 rounded border p-2" style={CELL_STYLE}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={row.taught ? 'emerald' : 'rose'}>{row.taught ? 'taught' : 'not taught'}</Badge>
                    <strong>{row.limitation.section}</strong>
                    <span className="text-muted">{row.mentions} section{row.mentions === 1 ? '' : 's'}</span>
                  </div>
                  <p className="mt-1">{row.limitation.statement}</p>
                  {row.evidence.length > 0 && (
                    <p className="text-muted mt-1 text-[11px]">
                      Evidence: “{row.evidence[0].excerpt.slice(0, 120)}…” — {row.evidence[0].lessonTitle}, marker{' '}
                      <code className="rounded px-1" style={CELL_STYLE}>{row.evidence[0].marker}</code>
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-muted mt-2 text-[11px]">
              Searched in {audit.limitations.corpusLessons} lessons and {audit.limitations.corpusSections} sections,
              checkpoint and prediction blocks excluded so the rule never reads an answer key. This counts what the
              course covers; it is not a score for the paper.
            </p>
          </Panel>

          <Panel title="Method, so you can disagree with it" subtitle="Everything the audit reads is a file in this repository.">
            <ul className="text-muted space-y-2 text-xs">
              <li>
                <strong>Measured column.</strong> {standIn === 'declared' ? 'The declared stand-in policy (style A, one step, seed 11)' : 'The policy currently set in section 1'} run by{' '}
                <code className="rounded px-1" style={CELL_STYLE}>reasoningDepth.ts</code> over the hand-authored tasks
                in that family. Change the sliders and the column moves; it is computed, not stored.
              </li>
              <li>
                <strong>Bank coverage.</strong> {audit.bank.questions} questions drawn from the chapters the battery's own family table
                credits ({[...new Set(audit.rows.flatMap((row) => row.exam.chapters))].sort((a, b) => a - b).join(', ')}), scored by a word-overlap rule
                against the lesson text for the same chapters.
              </li>
              <li>
                <strong>Reported column.</strong> {audit.provenance.cells} cells, each a number-free sentence with a
                chapter-and-section citation, each labelled{' '}
                <code className="rounded px-1" style={CELL_STYLE}>{COMPARISON_PROVENANCE}</code>, and each checked by{' '}
                <code className="rounded px-1" style={CELL_STYLE}>reportedCellViolations</code>.
              </li>
              <li>
                <strong>What is deliberately absent.</strong> No benchmark score, no parameter count, no percentage
                attributed to a named model. The GPT-4 Technical Report appears only inside a citation, as the frontier
                Ch. 23 measures itself against — never as a number on this screen.
              </li>
              <li>
                <strong>Tests.</strong>{' '}
                <code className="rounded px-1" style={CELL_STYLE}>src/engine/demos/reasoningDepth.test.ts</code> and{' '}
                <code className="rounded px-1" style={CELL_STYLE}>frontierAccount.test.ts</code> assert the shape of the
                three styles, the crossover, the abstentions, the provenance rule and determinism.
              </li>
            </ul>
          </Panel>
        </div>
      </section>

      <LabReflection labId="reasoning" />
    </div>
  )
}

function AuditRowCells({ row }: { row: AuditRow }) {
  return (
    <tr>
      <td className={cell} style={CELL_STYLE}>
        {row.familyLabel}
        <span className="text-muted block text-[11px]">{row.decomposable ? 'splits into steps' : 'every step carries it whole'}</span>
      </td>
      <td className={cell} style={CELL_STYLE}>
        {row.standIn ? percent(row.standIn.accuracy) : 'no tasks'}
        <span className="text-muted block text-[11px]">
          {row.standIn ? `${row.standIn.taskCount} tasks · ${one(row.standIn.meanTokens)} tokens` : ''}
        </span>
      </td>
      <td className={cell} style={CELL_STYLE}>
        {row.exam.answerable}/{row.exam.questions}
        <span className="text-muted block text-[11px]">
          chapters {row.exam.chapters.join(', ')} ·{' '}
          {row.exam.answerableFraction === null ? 'no question banked' : percent(row.exam.answerableFraction)} answerable
        </span>
      </td>
      <td className={cell} style={CELL_STYLE}>
        {row.exam.matchesKey}
        <span className="text-muted block text-[11px]">
          {row.exam.precisionWhenAnswering === null ? 'never answered' : `${percent(row.exam.precisionWhenAnswering)} when answering`}
        </span>
      </td>
      <td className={cell} style={CELL_STYLE}>
        <Badge tone="amber">{row.reported.provenance}</Badge>
        <p className="mt-1">{row.reported.claim}</p>
        <p className="text-muted mt-1 text-[11px]">Cited: {row.reported.source}</p>
      </td>
    </tr>
  )
}
