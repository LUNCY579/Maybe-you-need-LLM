import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildTaskSet } from '../../core/tasks'
import {
  buildTrainingCorpus,
  corpusOverlap,
  measureContamination,
  overlapByLength,
  solutionWords,
} from '../../core/contamination'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'contamination'

export function ContaminationLab() {
  const [view] = useState<View>('contamination')
  const [size, setSize] = useState(40)
  const [contamination, setContamination] = useState(0.3)
  const [n, setN] = useState(12)
  const [threshold, setThreshold] = useState(0.2)
  const [editRate, setEditRate] = useState(0.1)
  const [seed, setSeed] = useState(5)

  const taskSet = useMemo(
    () => buildTaskSet({ size, contamination, seed }),
    [size, contamination, seed],
  )
  const corpus = useMemo(
    () => buildTrainingCorpus(taskSet.tasks, { documents: 120, seed: seed + 1, editRate }),
    [taskSet, seed, editRate],
  )

  const report = useMemo(
    () => measureContamination(taskSet.tasks, corpus, { n, threshold }),
    [taskSet, corpus, n, threshold],
  )

  const byLength = useMemo(
    () => overlapByLength(taskSet.tasks, corpus, [3, 5, 8, 12, 16, 24]),
    [taskSet, corpus],
  )

  const perTask = useMemo(
    () =>
      taskSet.tasks.slice(0, 14).map((task) => ({
        id: task.id,
        overlap: corpusOverlap(solutionWords(task, 500), corpus, n),
        contaminated: task.contaminated,
      })),
    [taskSet, corpus, n],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory D · Contamination"
        subtitle="Whether the model has already seen the task"
        accent="emerald"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={() => undefined}
            options={[{ value: 'contamination', label: 'The overlap' }]}
          />
          <Slider label="The tasks" value={size} min={10} max={120} step={10} onChange={setSize} />
          <Slider
            label="The contaminated tasks"
            value={contamination}
            min={0}
            max={1}
            step={0.05}
            onChange={setContamination}
            format={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Slider label="The length of the n-gram" value={n} min={3} max={24} onChange={setN} />
          <Slider
            label="The threshold"
            value={threshold}
            min={0.05}
            max={0.95}
            step={0.05}
            onChange={setThreshold}
            format={(value) => value.toFixed(2)}
          />
          <Slider
            label="How much the copies are edited"
            value={editRate}
            min={0}
            max={0.4}
            step={0.02}
            onChange={setEditRate}
            format={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="The tasks flagged" value={String(report.flagged)} tone="warn" />
          <Stat
            label="The true-positive rate"
            value={`${fmt(report.truePositiveRate * 100, 1)}%`}
            tone={report.truePositiveRate > 0.7 ? 'good' : 'warn'}
          />
          <Stat
            label="The false-positive rate"
            value={`${fmt(report.falsePositiveRate * 100, 1)}%`}
          />
          <Stat
            label="The tasks really contaminated"
            value={String(report.actuallyContaminated)}
          />
        </div>

        <Figure
          title="The overlap, by the length of the n-gram"
          description="The overlap the copies of the solutions have with the corpus, at each length of the n-gram."
          caption="The copies in the corpus are lightly edited, so a short n-gram still finds the unchanged parts and a long one does not. That is why the length is a decision and not a detail."
        >
          <TrendChart
            data={byLength.map((row) => ({ x: row.n, leaked: row.truePositiveMean * 100, clean: row.falsePositiveMean * 100 }))}
            series={[
              { key: 'leaked', name: 'the tasks that were leaked', colour: 'var(--accent-rose)' },
              { key: 'clean', name: 'the tasks that were not', colour: 'var(--accent-emerald)' },
            ]}
            xLabel="the length of the n-gram"
            yLabel="the mean overlap, in per cent"
            height={270}
          />
        </Figure>

        <Figure
          title="Every task, and its overlap"
          description="The overlap of each task’s solution with the corpus, and whether the task was contaminated."
          caption="The threshold is what turns the overlaps into flags, and both the catches and the false alarms are what the report is made of."
        >
          <DataTable
            caption="The overlap of every task"
            headers={['The task', 'The overlap', 'Contaminated?', 'Flagged?']}
            rows={perTask.map((row) => [
              row.id,
              fmt(row.overlap, 4),
              row.contaminated ? 'yes' : '—',
              row.overlap >= threshold ? 'yes' : '—',
            ])}
          />
        </Figure>

        <Callout tone="definition" title="What the report is for">
          A contamination test is not a verdict: it is a pair of rates. The true-positive rate says how much of the leak
          it finds, and the false-positive rate says how many innocent tasks it accuses. Reporting one without the other
          is how a benchmark ends up throwing away a third of itself.
        </Callout>
      </Panel>
    </div>
  )
}
