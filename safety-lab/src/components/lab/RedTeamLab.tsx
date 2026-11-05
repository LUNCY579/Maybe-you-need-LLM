import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  budgetFor,
  buildFailures,
  discoveryCurve,
  marginalDiscovery,
  runRedTeam,
  searchCurve,
  SEARCH_POLICIES,
} from '../../core/redteam'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { REDTEAM_DEFAULTS } from '../../content/labDefaults'

type View = 'attack' | 'coverage' | 'budget'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const REDTEAM_VIEWS: { value: View; label: string }[] = [
  { value: 'attack', label: 'The attack' },
  { value: 'coverage', label: 'The coverage' },
  { value: 'budget', label: 'The search budget' },
]

export function RedTeamLab() {
  const [view, setView] = useViewParam(REDTEAM_VIEWS)
  const [attacks, setAttacks] = useState(REDTEAM_DEFAULTS.attacks)
  const [modelDriven, setModelDriven] = useState(REDTEAM_DEFAULTS.modelDriven)
  const [compliance, setCompliance] = useState(REDTEAM_DEFAULTS.compliance)
  const [failureCount, setFailureCount] = useState(REDTEAM_DEFAULTS.failures)
  const [budget, setBudget] = useState(REDTEAM_DEFAULTS.budget)
  const [repetitions, setRepetitions] = useState(REDTEAM_DEFAULTS.repetitions)
  const [seed, setSeed] = useState(REDTEAM_DEFAULTS.seed)

  const team = useMemo(
    () => runRedTeam({ attacks, modelDriven, complianceRate: compliance, seed }),
    [attacks, modelDriven, compliance, seed],
  )
  const other = useMemo(
    () => runRedTeam({ attacks, modelDriven: !modelDriven, complianceRate: compliance, seed }),
    [attacks, compliance, seed],
  )

  const curve = useMemo(() => {
    const rows: { x: number; coverage: number; rate: number }[] = []
    for (const count of [2, 4, 6, 10, 16, 24, 40, 80]) {
      const result = runRedTeam({ attacks: count, modelDriven, complianceRate: compliance, seed })
      rows.push({ x: count, coverage: result.coverage * 100, rate: result.successRate * 100 })
    }
    return rows
  }, [modelDriven, compliance, seed])

  // A hunt is aimed at a board of failures with a known difficulty, so the question
  // "how many attempts does it take" has an exact answer to compare the search with.
  const failures = useMemo(() => buildFailures(failureCount, seed), [failureCount, seed])
  const totals = useMemo(
    () => [0.125, 0.25, 0.5, 0.75, 1].map((share) => Math.max(failures.length, Math.round(budget * share))),
    [budget, failures.length],
  )
  const spread = useMemo(
    () => discoveryCurve(failures, totals.map((total) => Math.round(total / Math.max(1, failures.length))), { seed }),
    [failures, totals, seed],
  )
  const hunt = useMemo(
    () => searchCurve(failures, totals, SEARCH_POLICIES, { seed, repetitions }),
    [failures, totals, seed, repetitions],
  )
  const needed = useMemo(() => budgetFor(failures, 0.9), [failures])
  const last = hunt[hunt.length - 1]
  const guided = last?.searches.find((entry) => entry.id === 'guided')
  const unguided = last?.searches.find((entry) => entry.id === 'unguided')

  return (
    <div className="lab">
      <Panel
        title="Laboratory C · Red teaming"
        subtitle="The failures you found, and the ones you did not"
        accent="teal"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={REDTEAM_VIEWS}
          />
          <Slider label="The attacks" value={attacks} min={2} max={200} step={2} onChange={setAttacks} />
          <Slider
            label="How often the model complies"
            value={compliance}
            min={0.05}
            max={0.9}
            step={0.05}
            onChange={setCompliance}
            format={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Slider
            label="The failures on the board"
            value={failureCount}
            min={4}
            max={24}
            onChange={setFailureCount}
            hint="Each one carries the chance that a single attempt reaches it. A few are easy to stumble into and most are not."
          />
          <Slider
            label="The largest budget"
            value={budget}
            min={24}
            max={240}
            step={24}
            onChange={setBudget}
            hint="The curve is drawn at an eighth, a quarter, a half, three quarters and all of it."
          />
          <Slider
            label="The runs averaged per point"
            value={repetitions}
            min={8}
            max={64}
            step={4}
            onChange={setRepetitions}
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
          <div className="field">
            <span className="field-label">The red team</span>
            <button
              type="button"
              className={modelDriven ? 'btn btn-primary' : 'btn btn-default'}
              onClick={() => setModelDriven(!modelDriven)}
            >
              {modelDriven ? 'Model-driven' : 'Random'}
            </button>
            <p className="field-hint">
              A model-driven attacker writes in style and moves on to the categories it has not found yet.
            </p>
          </div>
        </div>

        {view === 'budget' ? (
          <div className="stat-row">
            <Stat label="The failures on the board" value={String(failures.length)} />
            <Stat
              label="The best the same total can do"
              value={last ? `${fmt(last.ideal * 100, 1)}%` : '—'}
              hint="the budget spent evenly, which no search does"
            />
            <Stat
              label="The hunt that went looking"
              value={guided ? `${fmt(guided.rate * 100, 1)}%` : '—'}
              tone="good"
              hint={`at a budget of ${last?.total ?? 0} attacks`}
            />
            <Stat
              label="The hunt that did not"
              value={unguided ? `${fmt(unguided.rate * 100, 1)}%` : '—'}
              tone="warn"
              hint={`the same budget, ${repetitions} runs averaged`}
            />
          </div>
        ) : (
          <div className="stat-row">
            <Stat
              label="The attack success rate"
              value={`${fmt(team.successRate * 100, 1)}%`}
              tone="warn"
            />
            <Stat
              label="The coverage"
              value={`${fmt(team.coverage * 100, 1)}%`}
              hint={`${team.categoriesReached} of ${team.categories} categories`}
              tone="good"
            />
            <Stat label="The distinct findings" value={String(team.distinctFindings)} />
            <Stat
              label="The other team’s coverage"
              value={`${fmt(other.coverage * 100, 1)}%`}
              hint="the other attacker, same budget"
            />
          </div>
        )}

        {view === 'attack' ? (
          <>
            <Figure
              title="The success rate and the coverage, as the budget grows"
              description="Both numbers against the number of attacks."
              caption="The success rate says how weak the model is on the attacks that were made. The coverage says how much of the space was looked at, and it is the one that is usually missing."
            >
              <TrendChart
                data={curve}
                series={[
                  { key: 'rate', name: 'the attack success rate', colour: 'var(--accent-rose)' },
                  { key: 'coverage', name: 'the coverage', colour: 'var(--accent-teal)' },
                ]}
                xLabel="the attacks"
                yLabel="in per cent"
                height={270}
              />
            </Figure>

            <Figure
              title="The two red teams on the same budget"
              description="The same number of attacks, and what each of them found."
              caption="A thousand attacks that find the same failure are worth less than ten that find ten."
            >
              <DataTable
                caption="The comparison"
                headers={['The red team', 'The attacks', 'The failures', 'The success rate', 'The categories reached', 'The coverage']}
                rows={[
                  [
                    modelDriven ? 'the model-driven one' : 'the random one',
                    team.attempted,
                    team.succeeded,
                    `${fmt(team.successRate * 100, 1)}%`,
                    `${team.categoriesReached} of ${team.categories}`,
                    `${fmt(team.coverage * 100, 1)}%`,
                  ],
                  [
                    modelDriven ? 'the random one' : 'the model-driven one',
                    other.attempted,
                    other.succeeded,
                    `${fmt(other.successRate * 100, 1)}%`,
                    `${other.categoriesReached} of ${other.categories}`,
                    `${fmt(other.coverage * 100, 1)}%`,
                  ],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="A red-team set is not a test set">
              The failures it contains are a sample of the attacks that work. They say what the model does wrongly, and
              they say nothing at all about what it does right — so a red-team set is a measurement of the model’s
              failures and a measurement of the red team’s search, and not of the model’s accuracy.
            </Callout>
          </>
        ) : null}

        {view === 'coverage' ? (
          <>
            <Figure
              title="The categories, and which were reached"
              description="The taxonomy, and what each of the two red teams did inside it on the same budget."
              caption="The categories that were not reached are the ones about which nothing was learned, and a model that fails only where you looked is unexamined rather than safe."
            >
              <DataTable
                caption="The taxonomy"
                headers={[
                  'The category',
                  'The attacks made',
                  'The failures found',
                  'Reached?',
                  'The other team’s attacks',
                  'The other team’s findings',
                ]}
                rows={team.byCategory.map((entry, index) => [
                  entry.category,
                  entry.attacks,
                  entry.failures,
                  entry.reached ? 'yes' : 'no',
                  other.byCategory[index]?.attacks ?? 0,
                  other.byCategory[index]?.failures ?? 0,
                ])}
              />
            </Figure>

            <Callout tone="definition" title="What the coverage buys">
              Coverage is the only number in the report that says how much of the space was examined. Without it, a
              success rate is a statement about the attacks that were made, and nothing else — {team.categoriesReached}
              of {team.categories} categories is the whole of what this budget looked at.
            </Callout>
          </>
        ) : null}

        {view === 'budget' ? (
          <>
            <Figure
              title="The discovery rate against the attempts spent on each failure"
              description="The exact expectation — every failure given the same number of attempts — and a sample of what actually happened."
              caption="This is the ceiling: a budget spread evenly over the failures. No search that spends its attempts on whichever prompt came to mind can do better than it, and the two lines agreeing is the check that the sampler is the model."
            >
              <TrendChart
                data={spread.map((row) => ({
                  x: row.attempts,
                  expected: row.expected * 100,
                  observed: row.observed * 100,
                }))}
                series={[
                  { key: 'expected', name: 'what the arithmetic says', colour: 'var(--accent-teal)' },
                  { key: 'observed', name: 'what the hunt found', colour: 'var(--accent-rose)' },
                ]}
                xLabel="the attempts per failure"
                yLabel="the failures found, in per cent"
                height={260}
              />
            </Figure>

            <Figure
              title="A total budget, four ways"
              description="The same total number of attacks: spent evenly, spent at random, spent going after what has not been found, and the ceiling."
              caption="The gap between the first two lines is the cost of not spreading the budget. The gap between the last two is the value of looking for what is missing rather than writing more of what worked."
            >
              <TrendChart
                data={hunt.map((row) => ({
                  x: row.total,
                  ideal: row.ideal * 100,
                  expectation: row.unguided * 100,
                  guided: (row.searches.find((entry) => entry.id === 'guided')?.rate ?? 0) * 100,
                  unguided: (row.searches.find((entry) => entry.id === 'unguided')?.rate ?? 0) * 100,
                }))}
                series={[
                  { key: 'ideal', name: 'the budget spent evenly', colour: 'var(--accent-teal)' },
                  { key: 'expectation', name: 'what random picking should give', colour: 'var(--accent-amber)' },
                  { key: 'guided', name: 'the hunt that went looking', colour: 'var(--accent-emerald)' },
                  { key: 'unguided', name: 'the hunt that did not', colour: 'var(--accent-rose)' },
                ]}
                xLabel="the attacks, in total"
                yLabel="the failures found, in per cent"
                height={270}
              />
            </Figure>

            <Figure
              title="Where the wasted attempts went"
              description="The attempts that bought nothing new, split into the two kinds: a target already found, and a fresh target that simply did not fire."
              caption="Only the first kind is a property of the search. The second is the cost of hunting at all, and a policy that spends nothing on a failure it already has still pays it."
            >
              <DataTable
                caption="The spend"
                headers={[
                  'The budget',
                  'The ceiling',
                  'Random picking should give',
                  'The hunt that went looking',
                  'The hunt that did not',
                  'Its attempts on a failure it had',
                  'The same, for the hunt that went looking',
                ]}
                rows={hunt.map((row) => [
                  row.total,
                  `${fmt(row.ideal * 100, 1)}%`,
                  `${fmt(row.unguided * 100, 1)}%`,
                  `${fmt((row.searches.find((entry) => entry.id === 'guided')?.rate ?? 0) * 100, 1)}%`,
                  `${fmt((row.searches.find((entry) => entry.id === 'unguided')?.rate ?? 0) * 100, 1)}%`,
                  fmt(row.searches.find((entry) => entry.id === 'unguided')?.rehits ?? 0, 1),
                  fmt(row.searches.find((entry) => entry.id === 'guided')?.rehits ?? 0, 1),
                ])}
              />
            </Figure>

            <Callout tone="note" title="When to stop">
              Reaching ninety per cent of the board takes {needed} attempts per failure on this board —{' '}
              {fmt(needed * failures.length, 0)} attacks in all — and the next attempt per failure after that buys{' '}
              {fmt(marginalDiscovery(failures, needed) * 100, 2)} points. The curve is the honest form of the result:
              the last attack is always worth less than the one before it, and the only way to change that is to change
              what the attacks aim at.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
