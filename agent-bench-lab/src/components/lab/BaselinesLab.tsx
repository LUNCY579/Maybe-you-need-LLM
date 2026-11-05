import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildTaskSet, passAtK, passPowerK, pairedSignTest } from '../../core/tasks'
import { agentSolver, costPerTask, retrievalBaseline } from '../../core/verifier'
import { repeatedTrialCounts } from '../../core/landscape'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'

type View = 'variance' | 'comparison' | 'reliability'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const BASELINES_VIEWS: { value: View; label: string }[] = [
  { value: 'variance', label: 'The runs' },
  { value: 'comparison', label: 'The comparison' },
  { value: 'reliability', label: 'The reliability' },
]

export function BaselinesLab() {
  const [view, setView] = useViewParam(BASELINES_VIEWS)
  const [size, setSize] = useState(120)
  const [runs, setRuns] = useState(6)
  const [seed, setSeed] = useState(3)

  const taskSet = useMemo(() => buildTaskSet({ size, seed }), [size, seed])

  const acrossRuns = useMemo(() => {
    const rows: { x: number; score: number }[] = []
    for (let run = 0; run < runs; run++) {
      const baseline = retrievalBaseline(taskSet.tasks, seed + run * 13)
      const agent = agentSolver(taskSet.tasks, { seed: seed + run * 13 })
      rows.push({ x: run + 1, score: (baseline.solved / Math.max(1, size)) * 100 })
      rows.push({ x: run + 1, score: (agent.solved / Math.max(1, size)) * 100 })
    }
    return rows
  }, [taskSet, runs, seed, size])

  const baseline = useMemo(() => retrievalBaseline(taskSet.tasks, seed), [taskSet, seed])
  const agent = useMemo(() => agentSolver(taskSet.tasks, { seed: seed + 1 }), [taskSet, seed])

  const spread = useMemo(() => {
    const scores = acrossRuns.map((row) => row.score)
    const mean = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length)
    const variance =
      scores.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, scores.length - 1)
    return { mean, deviation: Math.sqrt(variance) }
  }, [acrossRuns])

  const passAt = useMemo(
    () => [
      [1, 2, 4, 8].map((k) => ({ k, estimate: passAtK([3], 8, k) })),
    ],
    [],
  )

  const test = useMemo(() => pairedSignTest(18, 4), [])

  const trials = useMemo(() => repeatedTrialCounts(40, 10, seed), [seed])
  const reliability = useMemo(
    () =>
      [1, 2, 4, 8].map((k) => ({
        k,
        passes: passPowerK(trials, 10, k),
        once: passAtK(trials, 10, k),
      })),
    [trials],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory C · The baselines"
        subtitle="What a score has to beat, and what the beating costs"
        accent="amber"
      >
        <div className="lab-controls">
          <SegmentedControl label="View" value={view} onChange={setView} options={BASELINES_VIEWS} />
          <Slider label="The tasks" value={size} min={20} max={400} step={20} onChange={setSize} />
          <Slider label="The runs" value={runs} min={2} max={20} onChange={setRuns} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="The baseline’s score" value={`${fmt((baseline.solved / Math.max(1, size)) * 100, 1)}%`} />
          <Stat
            label="The agent’s score"
            value={`${fmt((agent.solved / Math.max(1, size)) * 100, 1)}%`}
            tone="good"
          />
          <Stat
            label="The spread across the runs"
            value={`${fmt(spread.deviation, 2)} points`}
            tone="warn"
          />
          <Stat
            label="The agent’s cost per task"
            value={fmt(costPerTask(agent), 2)}
            hint="the attempts per task solved"
          />
        </div>

        {view === 'variance' ? (
          <>
            <Figure
              title="The score, run after run"
              description="The two solvers’ scores over repeated runs on the same tasks."
              caption="The score moves. A single run is one sample of a distribution, and a comparison made from single runs carries that movement with it."
            >
              <TrendChart
                data={acrossRuns}
                series={[{ key: 'score', name: 'the score', colour: 'var(--accent-amber)' }]}
                xLabel="the run"
                yLabel="the score, in per cent"
                height={250}
              />
            </Figure>

            <Figure
              title="The estimate of pass@k"
              description="The unbiased estimate, from eight samples of which three succeeded."
              caption="The correction is what makes two different sample budgets comparable: with more samples per task, the same solver scores higher on pass@k."
            >
              <DataTable
                caption="pass@k from eight samples"
                headers={['k', 'The estimate', 'The naive estimate']}
                rows={passAt[0]!.map((row) => [
                  row.k,
                  `${fmt(row.estimate * 100, 1)}%`,
                  `${fmt((3 / 8) * 100, 1)}%`,
                ])}
              />
            </Figure>

            <Callout tone="note" title="Why one run is not a measurement">
              The solver is stochastic, so a run is a sample. The spread across runs — {fmt(spread.deviation, 2)} points
              here — is the noise in every comparison made from single runs, and it is what a reported score leaves out.
            </Callout>
          </>
        ) : null}

        {view === 'comparison' ? (
          <>
            <Figure
              title="The paired comparison"
              description="The tasks where the two systems disagree, and the test over those disagreements."
              caption="Only the disagreements carry information. A paired comparison throws away the task-difficulty variation and is more sensitive than comparing two independent scores."
            >
              <DataTable
                caption="The comparison"
                headers={['The quantity', 'The value']}
                rows={[
                  ['the tasks where the agent wins', test.total - 4],
                  ['the tasks where the baseline wins', 4],
                  ['the p-value', fmt(test.p, 5)],
                  ['the difference is significant at five per cent', test.better ? 'yes' : 'no'],
                ]}
              />
            </Figure>

            <Figure
              title="What each solver spent"
              description="The attempts each solver made, and the tasks each solver solved."
              caption="The agent solves more tasks and makes more attempts. The comparison that matters is the score per attempt, and it is the number a practitioner is shopping for."
            >
              <DataTable
                caption="The cost"
                headers={['The solver', 'The attempts', 'The tasks solved', 'The attempts per task']}
                rows={[
                  ['the agentless baseline', baseline.attempts, baseline.solved, fmt(costPerTask(baseline), 2)],
                  ['the agent', agent.attempts, agent.solved, fmt(costPerTask(agent), 2)],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="A score without a cost is a sales figure">
              The agent’s score is higher because it tries more. Whether that is worth it depends on what an attempt
              costs, and a benchmark that reports only the score has quietly dropped the more interesting half of the
              result.
            </Callout>
          </>
        ) : null}

        {view === 'reliability' ? (
          <>
            <div className="stat-row">
              <Stat label="pass^1" value={`${fmt(reliability[0]!.passes * 100, 1)}%`} hint="the single pass rate" />
              <Stat label="pass^2" value={`${fmt(reliability[1]!.passes * 100, 1)}%`} tone="warn" />
              <Stat label="pass^8" value={`${fmt(reliability[3]!.passes * 100, 1)}%`} tone="warn" />
              <Stat label="The tasks" value={String(trials.length)} hint="ten trials each" />
            </div>

            <Figure
              title="Capability and reliability are different questions"
              description="pass@k — at least one success in k trials — against pass^k — a success in every one of k trials."
              caption="The two curves leave the same point at k = 1 and separate immediately. A solver that succeeds sixty per cent of the time succeeds eight times in a row about two per cent of the time, and the second number is the one a user experiences."
            >
              <TrendChart
                data={reliability.map((row) => ({
                  x: row.k,
                  once: row.once * 100,
                  every: row.passes * 100,
                }))}
                series={[
                  { key: 'once', name: 'pass@k, at least one', colour: 'var(--accent-amber)' },
                  { key: 'every', name: 'pass^k, all of them', colour: 'var(--accent-rose)' },
                ]}
                xLabel="the number of trials"
                yLabel="the probability, in per cent"
                height={270}
              />
            </Figure>

            <Figure
              title="The estimates"
              description="The unbiased estimate of pass^k from ten trials per task, beside pass@k on the same trials."
              caption="Both estimates are computed from the same successes. The only difference is the question asked of them."
            >
              <DataTable
                caption="The reliability estimates"
                headers={['The trials', 'pass@k', 'pass^k']}
                rows={reliability.map((row) => [
                  row.k,
                  `${fmt(row.once * 100, 1)}%`,
                  `${fmt(row.passes * 100, 1)}%`,
                ])}
              />
            </Figure>

            <Callout tone="note" title="Synthetic repeated trials">
              The ten trials per task here are drawn from a fixed success rate, not from a live agent. What is being
              shown is the arithmetic of the estimator: the same counts give a high pass@k and a low pass^k, and the
              gap widens with k.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
