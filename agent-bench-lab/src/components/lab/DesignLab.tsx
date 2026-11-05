import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildTaskSet, precisionTable, tasksNeededForDifference, wilsonInterval } from '../../core/tasks'
import {
  GAIA_LEVELS,
  gaiaQuestions,
  resolutionByFileSize,
  successByToolBudget,
  toolShortfall,
} from '../../core/landscape'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'

type View = 'tasks' | 'interval' | 'size' | 'questions'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const DESIGN_VIEWS: { value: View; label: string }[] = [
  { value: 'tasks', label: 'The tasks' },
  { value: 'interval', label: 'The interval' },
  { value: 'size', label: 'The file size' },
  { value: 'questions', label: 'The questions' },
]

export function DesignLab() {
  const [view, setView] = useViewParam(DESIGN_VIEWS)
  const [size, setSize] = useState(120)
  const [solved, setSolved] = useState(30)
  const [seed, setSeed] = useState(3)

  const taskSet = useMemo(() => buildTaskSet({ size, seed }), [size, seed])
  const interval = useMemo(() => wilsonInterval(solved, taskSet.tasks.length), [solved, taskSet.tasks.length])
  const precision = useMemo(() => precisionTable(solved, taskSet.tasks.length), [solved, taskSet.tasks.length])

  const sizes = useMemo(() => resolutionByFileSize({ tasksPerBucket: Math.max(20, Math.round(size / 2)) }), [size])
  const questions = useMemo(() => gaiaQuestions(90, seed), [seed])
  const byTools = useMemo(() => successByToolBudget(questions), [questions])
  const shortfall = useMemo(() => toolShortfall(questions, 2), [questions])
  const levelRows = useMemo(
    () =>
      GAIA_LEVELS.map((entry) => {
        const atLevel = questions.filter((question) => question.level === entry.level)
        const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)
        return {
          ...entry,
          count: atLevel.length,
          steps: mean(atLevel.map((question) => question.steps)),
          tools: mean(atLevel.map((question) => question.tools)),
        }
      }),
    [questions],
  )

  const difficulty = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0]
    for (const task of taskSet.tasks) {
      const index = Math.min(4, Math.floor(task.difficulty * 5))
      buckets[index] = (buckets[index] ?? 0) + 1
    }
    return buckets.map((count, index) => ({ x: index + 1, count }))
  }, [taskSet])

  return (
    <div className="lab">
      <Panel
        title="Laboratory A · The task set"
        subtitle="What a score on a task set means, and how precisely it is known"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl label="View" value={view} onChange={setView} options={DESIGN_VIEWS} />
          <Slider label="The tasks" value={size} min={20} max={400} step={20} onChange={setSize} />
          <Slider label="The tasks solved" value={solved} min={0} max={size} onChange={setSolved} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        {view === 'tasks' || view === 'interval' ? (
          <div className="stat-row">
            <Stat label="The score" value={`${fmt(interval.estimate * 100, 1)}%`} />
            <Stat
              label="The interval"
              value={`${fmt(interval.low * 100, 1)} – ${fmt(interval.high * 100, 1)}%`}
              hint="the Wilson interval"
            />
            <Stat label="The width" value={`${fmt(interval.width * 100, 1)} points`} tone="warn" />
            <Stat label="The tasks" value={String(taskSet.tasks.length)} />
          </div>
        ) : null}

        {view === 'tasks' ? (
          <>
            <Figure
              title="The difficulty mix"
              description="How many of the tasks fall in each difficulty band."
              caption="The mix is a choice, and it decides what the score means. Moving it moves the score, with nothing about the solver changing."
            >
              <TrendChart
                data={difficulty}
                series={[{ key: 'count', name: 'the tasks', colour: 'var(--accent-indigo)' }]}
                xLabel="the difficulty band"
                yLabel="the tasks"
                height={240}
              />
            </Figure>

            <Figure
              title="Some of the tasks"
              description="The files each task touches, the test that decides it, and the tests that must keep passing."
              caption="A task is a repository, a goal and a verdict. Everything the benchmark says about a solver comes from the verdict."
            >
              <DataTable
                caption="The task set"
                headers={['The task', 'The files', 'The failing test', 'The other tests', 'Contaminated?']}
                rows={taskSet.tasks.slice(0, 12).map((task) => [
                  task.id,
                  task.files.join(', '),
                  task.failingTest,
                  task.passingTests.length,
                  task.contaminated ? 'yes' : '—',
                ])}
              />
            </Figure>

            <Callout tone="definition" title="Why the mix matters more than the count">
              A hundred easy tasks and a hundred hard ones are both a hundred tasks, and they say entirely different
              things about a solver. The mix is the part of the design that a reader of the score has to know, and it is
              the part a headline number leaves out.
            </Callout>
          </>
        ) : null}

        {view === 'interval' ? (
          <>
            <Figure
              title="The width of the interval"
              description="How precisely the score is known, as the number of tasks grows."
              caption="The width falls as the square root of the number of tasks. That is the argument for a bigger benchmark — and the argument against expecting much from a small one."
            >
              <TrendChart
                data={precision.map((row) => ({ x: row.n, width: row.width * 100 }))}
                series={[{ key: 'width', name: 'the width of the interval, in points', colour: 'var(--accent-indigo)' }]}
                xLabel="the number of tasks"
                yLabel="the width"
                height={250}
              />
            </Figure>

            <Figure
              title="How many tasks a difference needs"
              description="The number of tasks before a difference of a given size is distinguishable from the noise."
              caption="A benchmark of a hundred tasks can rank systems and cannot separate two that are close. The difference is squared in the requirement."
            >
              <DataTable
                caption="The number of tasks needed"
                headers={['The difference to be detected', 'The tasks needed']}
                rows={[0.01, 0.02, 0.05, 0.1, 0.2].map((difference) => [
                  `${fmt(difference * 100, 0)} points`,
                  tasksNeededForDifference(difference).toLocaleString(),
                ])}
              />
            </Figure>

            <Callout tone="warning" title="The interval most papers do not report">
              A score of twelve per cent on two hundred tasks is a real number with a real interval around it, and the
              interval is not symmetric: a proportion near zero cannot have a lower bound below zero. The Wilson
              interval is the cheap way to be honest about it.
            </Callout>
          </>
        ) : null}

        {view === 'size' ? (
          <>
            <div className="stat-row">
              <Stat label="One file, resolved" value={`${fmt(sizes[0]!.rate * 100, 1)}%`} tone="good" />
              <Stat label="Eight files, resolved" value={`${fmt(sizes[sizes.length - 1]!.rate * 100, 1)}%`} tone="warn" />
              <Stat
                label="The fall between them"
                value={`${fmt((sizes[0]!.rate - sizes[sizes.length - 1]!.rate) * 100, 1)} points`}
              />
              <Stat label="Tasks per size" value={String(sizes[0]!.tasks)} />
            </div>

            <Figure
              title="Resolution rate against the size of the task"
              description="The share of tasks resolved, as the patch has to touch more files."
              caption="A task that touches eight files is not eight times harder in principle; it is harder because the solver has more places to look and more ways to be almost right. The curve is the benchmark's difficulty axis made visible."
            >
              <TrendChart
                data={sizes.map((row) => ({ x: row.files, rate: row.rate * 100 }))}
                series={[{ key: 'rate', name: 'the resolution rate, in per cent', colour: 'var(--accent-indigo)' }]}
                xLabel="the files the task touches"
                yLabel="the resolution rate"
                height={250}
              />
            </Figure>

            <Figure
              title="The buckets"
              description="The tasks in each bucket, and how many of them the solver resolves."
              caption="The number of tasks per bucket is fixed, so the only thing moving along the table is the size of the repository. This is the ablation the paper reports as a plot of resolved rate against task size."
            >
              <DataTable
                caption="The resolution by file size"
                headers={['The files', 'The tasks', 'The tasks resolved', 'The rate']}
                rows={sizes.map((row) => [
                  row.files,
                  row.tasks,
                  row.solved,
                  `${fmt(row.rate * 100, 1)}%`,
                ])}
              />
            </Figure>

            <Callout tone="note" title="A curve, not a measurement">
              The decay here is an analytic model of the reported shape, not a re-run of the paper’s table. The claim
              it makes checkable is the direction: more files, fewer resolutions, at every point of the curve.
            </Callout>
          </>
        ) : null}

        {view === 'questions' ? (
          <>
            <div className="stat-row">
              <Stat label="The questions" value={String(questions.length)} />
              <Stat
                label="Level 3, with two tools"
                value={`${shortfall[3]} short`}
                hint="questions that need a third tool"
                tone="warn"
              />
              <Stat
                label="A level-1 answer"
                value={`${fmt(levelRows[0]!.baseRate * 100, 0)}%`}
                hint="once a tool is available"
              />
              <Stat label="A level-3 answer" value={`${fmt(levelRows[2]!.baseRate * 100, 0)}%`} tone="warn" />
            </div>

            <Figure
              title="The three levels"
              description="What separates the levels: the steps in the reference answer and the tools it needs."
              caption="GAIA grades a question by the length of the chain and the number of tools, not by the subject. That is why an assistant can be fluent and still fail level three: the failure is in the plan, not in the knowledge."
            >
              <DataTable
                caption="The GAIA levels"
                headers={['The level', 'What it asks for', 'The questions', 'The mean steps', 'The mean tools']}
                rows={levelRows.map((row) => [
                  row.label,
                  row.note,
                  row.count,
                  fmt(row.steps, 1),
                  fmt(row.tools, 1),
                ])}
              />
            </Figure>

            <Figure
              title="Success against the tool budget"
              description="The share of each level’s questions a solver can answer when it is given a fixed number of tools."
              caption="A question whose answer needs three tools is out of reach at a budget of two, whatever the solver knows. The curve rises in steps, and the steps are at the tool counts the questions demand."
            >
              <TrendChart
                data={byTools.map((row) => ({
                  x: row.tools,
                  level1: row.level1 * 100,
                  level2: row.level2 * 100,
                  level3: row.level3 * 100,
                }))}
                series={[
                  { key: 'level1', name: 'level 1', colour: 'var(--accent-emerald)' },
                  { key: 'level2', name: 'level 2', colour: 'var(--accent-amber)' },
                  { key: 'level3', name: 'level 3', colour: 'var(--accent-rose)' },
                ]}
                xLabel="the tools available"
                yLabel="the share answerable, in per cent"
                height={270}
              />
            </Figure>

            <Callout tone="note" title="A synthetic question set">
              The questions here are generated with GAIA’s three levels and the tool and step counts its annotations
              record. The rates are the model’s, not the paper’s: what is being measured is how the budget turns into
              reachability, not how any particular assistant scored.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
