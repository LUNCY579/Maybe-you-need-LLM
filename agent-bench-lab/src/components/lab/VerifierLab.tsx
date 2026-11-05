import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildTaskSet } from '../../core/tasks'
import { agentSolver, criterionReport, retrievalBaseline, verify } from '../../core/verifier'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'

type View = 'criterion' | 'cheat' | 'harness'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const VERIFIER_VIEWS: { value: View; label: string }[] = [
  { value: 'criterion', label: 'The criterion' },
  { value: 'cheat', label: 'The cheat' },
  { value: 'harness', label: 'The harness' },
]

export function VerifierLab() {
  const [view, setView] = useViewParam(VERIFIER_VIEWS)
  const [size, setSize] = useState(80)
  const [seed, setSeed] = useState(3)

  const taskSet = useMemo(() => buildTaskSet({ size, seed }), [size, seed])
  const baseline = useMemo(() => retrievalBaseline(taskSet.tasks, seed), [taskSet, seed])
  const agent = useMemo(() => agentSolver(taskSet.tasks, { seed: seed + 1 }), [taskSet, seed])
  const report = useMemo(() => criterionReport(taskSet.tasks), [taskSet])

  const verdicts = useMemo(() => {
    const task = taskSet.tasks[0]!
    return [
      { name: 'the patch that fixes it', patch: task.patch },
      { name: 'the patch that changes the test', patch: { file: 'test_fix_0.py', change: 'break-test' as const } },
      { name: 'the patch that breaks another test', patch: { file: task.files[0]!, change: 'break-other' as const } },
      { name: 'the patch that changes nothing', patch: { file: task.files[0]!, change: 'none' as const } },
      {
        name: 'the patch that fixes the wrong file',
        patch: { file: task.files[task.files.length - 1]!, change: 'fix' as const },
      },
    ].map((entry) => ({ name: entry.name, verdict: verify(task, entry.patch) }))
  }, [taskSet])

  return (
    <div className="lab">
      <Panel
        title="Laboratory B · The verifier"
        subtitle="The criterion that decides the task, and the cheat it has to catch"
        accent="teal"
      >
        <div className="lab-controls">
          <SegmentedControl label="View" value={view} onChange={setView} options={VERIFIER_VIEWS} />
          <Slider label="The tasks" value={size} min={20} max={300} step={20} onChange={setSize} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat
            label="The baseline’s score"
            value={`${fmt((baseline.solved / Math.max(1, size)) * 100, 1)}%`}
          />
          <Stat
            label="The agent’s score"
            value={`${fmt((agent.solved / Math.max(1, size)) * 100, 1)}%`}
            tone="good"
          />
          <Stat label="The cheats the verifier caught" value={String(baseline.cheated + agent.cheated)} tone="warn" />
          <Stat label="The tasks" value={String(size)} />
        </div>

        {view === 'criterion' ? (
          <>
            <Figure
              title="The five kinds of patch"
              description="What the verifier says about each kind of patch, and why."
              caption="The criterion is a pair of conditions, and each of these patches satisfies a different subset of them. That is the whole of the verifier."
            >
              <DataTable
                caption="The verdicts"
                headers={['The patch', 'Solved?', 'Fail to pass', 'Pass to pass', 'Touched a test', 'Why']}
                rows={verdicts.map((entry) => [
                  entry.name,
                  entry.verdict.solved ? 'yes' : 'no',
                  entry.verdict.failToPass ? 'yes' : 'no',
                  entry.verdict.passToPass ? 'yes' : 'no',
                  entry.verdict.touchedATest ? 'yes' : '—',
                  entry.verdict.reason,
                ])}
              />
            </Figure>

            <Callout tone="definition" title="What the two conditions are for">
              The failing test must start failing and end passing: without that, there is no task. The tests that were
              passing must keep passing: without that, the first condition can be satisfied by a patch that changes the
              test, and the benchmark measures the solver’s ability to edit the test.
            </Callout>
          </>
        ) : null}

        {view === 'cheat' ? (
          <>
            <Figure
              title="The score, with and without the cheats"
              description="What the two solvers would have scored, and what they would have scored if the cheats had counted."
              caption="The cheats are the patches that satisfy the first condition without doing the work. A verifier that accepts them is measuring the wrong thing."
            >
              <DataTable
                caption="The scores"
                headers={['The solver', 'The tasks solved', 'The cheats', 'The clean score', 'The attempts']}
                rows={[
                  [
                    'the agentless baseline',
                    baseline.solved,
                    baseline.cheated,
                    `${fmt(baseline.cleanScore * 100, 1)}%`,
                    baseline.attempts,
                  ],
                  ['the agent', agent.solved, agent.cheated, `${fmt(agent.cleanScore * 100, 1)}%`, agent.attempts],
                ]}
              />
            </Figure>

            <Figure
              title="The cost of the agent"
              description="The attempts each solver makes, and the tasks each solver solves."
              caption="The agent solves more tasks and makes more attempts. The comparison that matters is not the two scores but the two scores per attempt."
            >
              <TrendChart
                data={[
                  { x: 0, attempts: baseline.attempts, solved: baseline.solved },
                  { x: 1, attempts: agent.attempts, solved: agent.solved },
                ]}
                series={[
                  { key: 'attempts', name: 'the attempts', colour: 'var(--accent-amber)' },
                  { key: 'solved', name: 'the tasks solved', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the solver"
                yLabel="the count"
                height={240}
              />
            </Figure>

            <Callout tone="warning" title="Gaming is not a moral failure">
              A solver that finds the difference between the task and the verifier is optimising the objective, which
              is what a reward is for. The response is a better verifier, not a stricter rule about what the solver may
              do.
            </Callout>
          </>
        ) : null}

        {view === 'harness' ? (
          <>
            <div className="stat-row">
              <Stat label="The patches run" value={String(report.patches)} />
              <Stat
                label="The first condition alone accepts"
                value={String(report.failToPassOnly)}
                tone="warn"
              />
              <Stat label="The pair accepts" value={String(report.bothConditions)} tone="good" />
              <Stat label="The cheats it caught" value={String(report.cheats)} tone="warn" />
            </div>

            <Figure
              title="What each half of the criterion decides"
              description="Five patches per task — the fix, a test edit, a wrong-file fix, a regression, and no change — and the verdicts."
              caption="The fail-to-pass condition alone cannot tell a fix from an edit to the test. The pass-to-pass condition is not a second opinion; it is what makes the first condition mean anything."
            >
              <DataTable
                caption="The harness over the whole task set"
                headers={['The condition', 'The patches it accepts', 'What that includes']}
                rows={[
                  ['fail to pass, alone', report.failToPassOnly, `${report.cheats} test edits it cannot see`],
                  ['fail to pass and pass to pass', report.bothConditions, 'the fixes, and nothing else'],
                  ['pass to pass, alone', report.patches - report.regressions, `${report.regressions} regressions it catches`],
                ]}
              />
            </Figure>

            <Figure
              title="The harness, patch by patch"
              description="The same five kinds of patch as the criterion view, counted over every task."
              caption="A harness is a filter, and a filter is described by what it lets through as well as what it stops. The table is that description."
            >
              <DataTable
                caption="The counts by patch"
                headers={['The patch', 'The count', 'The verdict']}
                rows={[
                  ['the fix', taskSet.tasks.length, 'solved'],
                  ['an edit to the test', report.cheats, 'rejected, because a test changed'],
                  ['a fix to the wrong file', report.wrongFileFixes, 'rejected, the failing test still fails'],
                  ['a patch that breaks another test', report.regressions, 'rejected, a passing test stopped passing'],
                  ['no change', taskSet.tasks.length, 'rejected, nothing moved'],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="The harness is the benchmark">
              The task set says what to do and the harness says whether it was done. A harness that accepts a test edit
              turns the benchmark into a test-editing contest, and no amount of task quality survives that.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
