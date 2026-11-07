import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { fmt } from '@llm-materials/course-core'
import {
  buildTaskSet,
  difficultyHistogram,
  passAtK,
  passPowerK,
  pairedSignTest,
  precisionTable,
  tasksNeededForDifference,
  wilsonInterval,
} from '../../core/tasks'
import {
  agentSolver,
  costPerTask,
  criterionReport,
  repeatedRuns,
  retrievalBaseline,
  runSpread,
  verify,
} from '../../core/verifier'
import {
  GAIA_LEVELS,
  MODEL_PROFILES,
  divergenceStep,
  environmentScores,
  gaiaQuestions,
  landscapeSummary,
  repeatedTrialCounts,
  replay,
  replayDigest,
  resolutionByFileSize,
  scoreOf,
  successByToolBudget,
  toolShortfall,
} from '../../core/landscape'
import {
  buildTrainingCorpus,
  corpusOverlap,
  measureContamination,
  overlapByLength,
  solutionWords,
} from '../../core/contamination'
import { LAB_SCREENS } from './index'

/**
 * The figures on the five laboratory screens, recomputed from the core.
 *
 * `lab.test.tsx` proves the screens open, and the claims it makes about them are directional: the
 * first condition accepts more than the pair, reliability falls as the trials are repeated. What
 * that cannot say is whether the number inside the panel is the number the application computes.
 * A screen goes wrong there in two ways that leave the layout untouched — it prints a figure from
 * a different configuration than the controls hold, or it keeps showing one after the control
 * moved — and both are invisible to a test that looks for the panel's title.
 *
 * So every assertion here calls the same pure function the screen calls, with the settings the
 * controls show by default, and compares the result with the text in the page. Where a caption
 * makes a measurement claim — "the fall between them", "the curve rises in steps", "the
 * difference is squared in the requirement" — the claim is checked against the numbers rather
 * than repeated from them.
 */

/** The five screens' default control values, as the components hold them. */
const DESIGN = { size: 120, solved: 30, seed: 3 }
const VERIFIER = { size: 80, seed: 3 }
const BASELINES = { size: 120, runs: 6, seed: 3 }
const ENVIRONMENTS = { seed: 5 }
const CONTAMINATION = { size: 40, rate: 0.3, n: 12, threshold: 0.2, editRate: 0.1, seed: 5 }
const SHOP_ACTIONS = ['search', 'add', 'add', 'checkout'] as const

function renderLab(id: string, search = '') {
  const Screen = LAB_SCREENS[id]
  if (!Screen) throw new Error(`no screen is registered for ${id}`)
  return render(
    <MemoryRouter initialEntries={[`/labs/${id}${search}`]}>
      <Screen />
    </MemoryRouter>,
  )
}

function stat(label: string): { value: string; hint: string } {
  const box = [...document.querySelectorAll('.stat')].find(
    (candidate) => candidate.querySelector('.stat-label')?.textContent === label,
  )
  if (!box) throw new Error(`no stat labelled ${label}`)
  return {
    value: box.querySelector('.stat-value')?.textContent ?? '',
    hint: box.querySelector('.stat-hint')?.textContent ?? '',
  }
}

/** The body rows of the table with this caption, as the page prints them. */
function rows(caption: string): string[][] {
  const table = [...document.querySelectorAll('table')].find(
    (node) => node.querySelector('caption')?.textContent?.includes(caption),
  )
  if (!table) throw new Error(`no table captioned ${caption}`)
  return [...table.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => (cell.textContent ?? '').trim()),
  )
}

function headers(caption: string): string[] {
  const table = [...document.querySelectorAll('table')].find(
    (node) => node.querySelector('caption')?.textContent?.includes(caption),
  )
  if (!table) throw new Error(`no table captioned ${caption}`)
  return [...table.querySelectorAll('thead th')].map((cell) => (cell.textContent ?? '').trim())
}

function setSlider(label: string, value: number) {
  // The Slider primitive puts the current value in a span inside its label, with no space between
  // the two, so the accessible name of the control is the label run into the number — `The
  // tasks120`. Requiring a digit where the value starts is what tells `The tasks` from `The tasks
  // solved30`, whose name has a word in the way.
  const pattern = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[\\d.\\-]`)
  fireEvent.change(screen.getByRole('slider', { name: pattern }), { target: { value: String(value) } })
}

/** The first column of a number in the page's own formatting, e.g. `81.7` out of `81.7%`. */
const printedNumber = (text: string): number => Number.parseFloat(text.replace(/[,%]/g, ''))

afterEach(cleanup)

/* ------------------------------------------------------------------ Laboratory A */

describe('the design laboratory prints the task set the controls hold', () => {
  const taskSet = buildTaskSet({ size: DESIGN.size, seed: DESIGN.seed })
  const interval = wilsonInterval(DESIGN.solved, taskSet.tasks.length)

  /** The twelve rows the screen lists, from the task set it was given. */
  const listed = (tasks: { tasks: ReturnType<typeof buildTaskSet>['tasks'] }) =>
    tasks.tasks.slice(0, 12).map((task) => [
      String(task.id),
      task.files.join(', '),
      task.failingTest,
      String(task.passingTests.length),
      task.contaminated ? 'yes' : '—',
    ])

  it('prices the score, the interval and the width from the same set', () => {
    renderLab('design')
    expect(stat('The score').value).toBe(`${fmt(interval.estimate * 100, 1)}%`)
    expect(stat('The interval').value).toBe(`${fmt(interval.low * 100, 1)} – ${fmt(interval.high * 100, 1)}%`)
    expect(stat('The width').value).toBe(`${fmt(interval.width * 100, 1)} points`)
    expect(stat('The tasks').value).toBe(String(taskSet.tasks.length))
    // Thirty solved of a hundred and twenty is the score the panel prints, and the interval is
    // around it rather than beside it: the width is the difference of its own two ends.
    expect(interval.estimate).toBe(0.25)
    expect(interval.width).toBeCloseTo(interval.high - interval.low, 12)
  })

  it('lists the first twelve tasks of that set, in the order the generator writes them', () => {
    renderLab('design')
    expect(headers('The task set')).toEqual([
      'The task',
      'The files',
      'The failing test',
      'The other tests',
      'Contaminated?',
    ])
    expect(rows('The task set')).toEqual(listed(taskSet))
  })

  it('keeps the tasks it already had when the benchmark is grown', () => {
    renderLab('design')
    const before = rows('The task set')
    setSlider('The tasks', 200)

    const grown = buildTaskSet({ size: 200, seed: DESIGN.seed })
    expect(rows('The task set')).toEqual(before)
    expect(rows('The task set')).toEqual(listed(grown))
    expect(stat('The tasks').value).toBe('200')
    // The score is the same thirty tasks over more of them, so growing a benchmark without
    // re-answering it moves the score the reader is shown — and narrows the interval.
    expect(stat('The score').value).toBe(`${fmt((DESIGN.solved / 200) * 100, 1)}%`)
    expect(printedNumber(stat('The width').value)).toBeLessThan(interval.width * 100)
  })

  it('rebuilds the whole set when the seed moves', () => {
    renderLab('design')
    const before = rows('The task set')
    setSlider('Seed', 9)

    const other = buildTaskSet({ size: DESIGN.size, seed: 9 })
    expect(rows('The task set')).toEqual(listed(other))
    expect(rows('The task set')).not.toEqual(before)
    expect(stat('The tasks').value).toBe(String(other.tasks.length))
  })

  it('counts the difficulty mix over exactly the tasks it shows', () => {
    renderLab('design')
    const bands = difficultyHistogram(taskSet.tasks)
    expect(bands).toHaveLength(5)
    expect(bands.reduce((sum, band) => sum + band.count, 0)).toBe(taskSet.tasks.length)
    // The figure's whole point is that the mix, not the count, is what a score means. A set with
    // every task in one band would make the panel decorative, so the mix has to be spread.
    for (const band of bands) expect(band.count).toBeGreaterThan(0)
    expect(Math.max(...bands.map((band) => band.count))).toBeGreaterThan(
      Math.min(...bands.map((band) => band.count)),
    )
    // The bands are a partition, not a decoration: recounting the tasks whose difficulty falls in
    // each band's own interval gives back exactly the counts the chart plots.
    expect(bands.map((band) => band.count)).toEqual(
      bands.map(
        (band) =>
          taskSet.tasks.filter((task) => task.difficulty >= (band.band - 1) / 5 && task.difficulty < band.band / 5)
            .length,
      ),
    )
    for (const [index, task] of taskSet.tasks.entries()) {
      expect(task.difficulty).toBeGreaterThanOrEqual(0)
      expect(task.difficulty).toBeLessThan(1)
      expect(index).toBe(task.id)
    }
  })

  it('tabulates the tasks a difference needs, and squares the difference', () => {
    renderLab('design', '?view=interval')
    const differences = [0.01, 0.02, 0.05, 0.1, 0.2]
    expect(rows('The number of tasks needed')).toEqual(
      differences.map((difference) => [
        `${fmt(difference * 100, 0)} points`,
        tasksNeededForDifference(difference).toLocaleString(),
      ]),
    )

    // "The difference is squared in the requirement" is a claim about this column: the tasks a
    // difference needs scale as its inverse square, so the ratio between two rows is the square of
    // the ratio between the two differences, within the rounding the ten-task grid imposes.
    const needed = new Map(
      rows('The number of tasks needed').map(([points, count]) => [points, Number(count.replace(/,/g, ''))]),
    )
    const value = (points: string) => Number(points.split(' ')[0])
    for (const [coarse, fine] of [
      ['2 points', '1 points'],
      ['5 points', '2 points'],
      ['10 points', '5 points'],
      ['20 points', '10 points'],
    ]) {
      const factor = value(coarse) / value(fine)
      const ratio = needed.get(fine)! / needed.get(coarse)!
      expect(Math.abs(ratio / (factor * factor) - 1), `${fine} against ${coarse}`).toBeLessThan(0.03)
    }

    // And the sentence the caption hangs on it: a hundred tasks rank systems and cannot separate
    // two that are close. Both halves are in the table.
    expect(needed.get('10 points')!).toBeLessThan(100)
    expect(needed.get('5 points')!).toBeGreaterThan(100)
  })

  it('draws a width that falls as the square root of the tasks', () => {
    renderLab('design', '?view=interval')
    const table = precisionTable(DESIGN.solved, DESIGN.size)
    expect(table).toHaveLength(19)
    for (const [index, row] of table.entries()) {
      if (index === 0) continue
      expect(row.width, `at ${row.n} tasks`).toBeLessThan(table[index - 1]!.width)
    }

    // The caption names the rate, so it is measured: quadrupling the tasks halves the width.
    const quarters = [100, 400].map((n) => wilsonInterval(Math.round(0.25 * n), n).width)
    expect(Math.abs(quarters[0]! / quarters[1]! - 2)).toBeLessThan(0.05)
  })

  it('reports an interval that is not symmetric near zero', () => {
    // The callout's own example, checked: twelve per cent on two hundred tasks, and the ends are
    // a different distance from the estimate.
    const score = wilsonInterval(24, 200)
    expect(score.estimate).toBe(0.12)
    expect(score.estimate - score.low).not.toBeCloseTo(score.high - score.estimate, 6)
    // and a proportion at zero cannot have a lower bound below it
    const nothing = wilsonInterval(0, 200)
    expect(nothing.low).toBe(0)
    expect(nothing.high).toBeGreaterThan(0)
  })

  it('shows the resolution curve falling with the size of the task', () => {
    renderLab('design', '?view=size')
    const sizes = resolutionByFileSize({ tasksPerBucket: 60 })
    expect(stat('One file, resolved').value).toBe(`${fmt(sizes[0]!.rate * 100, 1)}%`)
    expect(stat('Eight files, resolved').value).toBe(`${fmt(sizes[sizes.length - 1]!.rate * 100, 1)}%`)
    expect(stat('The fall between them').value).toBe(
      `${fmt((sizes[0]!.rate - sizes[sizes.length - 1]!.rate) * 100, 1)} points`,
    )
    expect(stat('Tasks per size').value).toBe(String(sizes[0]!.tasks))

    expect(rows('The resolution by file size')).toEqual(
      sizes.map((row) => [String(row.files), String(row.tasks), String(row.solved), `${fmt(row.rate * 100, 1)}%`]),
    )

    // "More files, fewer resolutions, at every point of the curve" is the claim the figure makes,
    // and the table is its evidence: the sequence has to fall at every one of the eight steps.
    const solved = rows('The resolution by file size').map((row) => Number(row[2]))
    for (const [index, count] of solved.entries()) {
      if (index === 0) continue
      expect(count, `at ${index + 1} files`).toBeLessThan(solved[index - 1]!)
    }
    // The tasks per bucket is fixed, so the only thing moving along the table is the size.
    for (const row of rows('The resolution by file size')) expect(row[1]).toBe('60')
    // and the rate column is the arithmetic of the two before it, not a fourth number.
    for (const row of rows('The resolution by file size')) {
      expect(printedNumber(row[3]!)).toBeCloseTo((Number(row[2]) / Number(row[1])) * 100, 1)
    }
  })

  it('re-buckets the curve when the size of the benchmark moves', () => {
    renderLab('design', '?view=size')
    const before = rows('The resolution by file size')
    setSlider('The tasks', 200)

    // The panel prices the curve at half the tasks per bucket of the control, floor of twenty.
    const wider = resolutionByFileSize({ tasksPerBucket: 100 })
    expect(stat('Tasks per size').value).toBe('100')
    expect(rows('The resolution by file size')).toEqual(
      wider.map((row) => [String(row.files), String(row.tasks), String(row.solved), `${fmt(row.rate * 100, 1)}%`]),
    )
    expect(rows('The resolution by file size')).not.toEqual(before)
    // More tasks per bucket rounds the same analytic curve to a finer rate, and cannot change the
    // probability itself: the fall between the ends is a property of the model, not of the sample.
    expect(printedNumber(stat('The fall between them').value)).toBeCloseTo(
      printedNumber(`${(wider[0]!.rate - wider[wider.length - 1]!.rate) * 100}`),
      1,
    )
  })

  it('grades the questions by the chain and the tools, which is what separates the levels', () => {
    renderLab('design', '?view=questions')
    const questions = gaiaQuestions(90, DESIGN.seed)
    expect(stat('The questions').value).toBe(String(questions.length))

    const short = toolShortfall(questions, 2)
    expect(stat('Level 3, with two tools').value).toBe(`${short[3]} short`)
    expect(stat('Level 3, with two tools').hint).toBe('questions that need a third tool')
    expect(stat('A level-1 answer').value).toBe(`${fmt(GAIA_LEVELS[0]!.baseRate * 100, 0)}%`)
    expect(stat('A level-3 answer').value).toBe(`${fmt(GAIA_LEVELS[2]!.baseRate * 100, 0)}%`)

    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)
    const levelRows = GAIA_LEVELS.map((entry) => {
      const atLevel = questions.filter((question) => question.level === entry.level)
      return [
        entry.label,
        entry.note,
        String(atLevel.length),
        fmt(mean(atLevel.map((question) => question.steps)), 1),
        fmt(mean(atLevel.map((question) => question.tools)), 1),
      ]
    })
    expect(rows('The GAIA levels')).toEqual(levelRows)

    // The caption's claim: the levels differ by the length of the chain and the number of tools,
    // not by the subject — so both columns have to rise with the level.
    for (const column of [3, 4]) {
      for (const [index, cell] of levelRows.entries()) {
        if (index === 0) continue
        expect(printedNumber(cell[column]!), `column ${column} at level ${index + 1}`).toBeGreaterThan(
          printedNumber(levelRows[index - 1]![column]!),
        )
      }
    }
    // The twenty-eight are the whole of level three: a level-3 question never needs fewer than
    // three tools, which is why a budget of two leaves none of them reachable.
    expect(short[3]).toBe(questions.filter((question) => question.level === 3).length)
    for (const level of [1, 2, 3] as const) {
      const atLevel = questions.filter((question) => question.level === level)
      expect(Math.min(...atLevel.map((question) => question.tools))).toBe(level)
    }
    expect(short[1]).toBe(0)
  })

  it('answers a question only when the budget reaches its tools', () => {
    const questions = gaiaQuestions(90, DESIGN.seed)
    const byTools = successByToolBudget(questions)
    // "A question whose answer needs three tools is out of reach at a budget of two, whatever the
    // solver knows" — the level-3 column is exactly zero there, while level one is at its base rate.
    expect(byTools[2]!.level3).toBe(0)
    expect(byTools[2]!.level1).toBeCloseTo(GAIA_LEVELS[0]!.baseRate * (1 - short(questions, 2)[1] / questions.filter((q) => q.level === 1).length), 10)
    // The budget is the curve's only moving part, so each series is non-decreasing in it, and the
    // steps are at the tool counts the questions demand: nothing rises between the counts present.
    for (const key of ['level1', 'level2', 'level3', 'overall'] as const) {
      for (const [index, row] of byTools.entries()) {
        if (index === 0) continue
        expect(row[key], `${key} at ${row.tools} tools`).toBeGreaterThanOrEqual(byTools[index - 1]![key])
      }
      expect(byTools[0]![key]).toBe(0)
    }
    // The curve rises in steps: a level gains nothing at a budget where no question first becomes
    // reachable. Level three's first gain is at three tools, which is its minimum.
    expect(byTools[3]!.level3).toBeGreaterThan(byTools[2]!.level3)
  })
})

function short(questions: ReturnType<typeof gaiaQuestions>, budget: number) {
  return toolShortfall(questions, budget)
}

/* ------------------------------------------------------------------ Laboratory B */

describe('the verifier laboratory prints what the criterion decides', () => {
  const taskSet = buildTaskSet({ size: VERIFIER.size, seed: VERIFIER.seed })
  const baseline = retrievalBaseline(taskSet.tasks, VERIFIER.seed)
  const agent = agentSolver(taskSet.tasks, { seed: VERIFIER.seed + 1 })

  it('prices both solvers and the cheats between them', () => {
    renderLab('verifier')
    expect(stat('The baseline’s score').value).toBe(`${fmt((baseline.solved / VERIFIER.size) * 100, 1)}%`)
    expect(stat('The agent’s score').value).toBe(`${fmt((agent.solved / VERIFIER.size) * 100, 1)}%`)
    expect(stat('The cheats the verifier caught').value).toBe(String(baseline.cheated + agent.cheated))
    expect(stat('The tasks').value).toBe(String(VERIFIER.size))
    // The agent is the solver that tries more than once, so its score is higher and its attempts
    // are the reason: the two numbers the panel prints are not independent of each other.
    expect(agent.solved).toBeGreaterThan(baseline.solved)
    expect(agent.attempts).toBeGreaterThan(baseline.attempts)
    // A cheat is never counted as solved, so the score a weak criterion would have reported is
    // above the one the verifier gave, and the gap is the two columns of the table.
    expect(baseline.inflatedScore).toBe((baseline.solved + baseline.cheated) / VERIFIER.size)
    expect(baseline.inflatedScore).toBeGreaterThan(baseline.solved / VERIFIER.size)
  })

  it('prints the five verdicts the criterion returns, with the reason it gave', () => {
    renderLab('verifier')
    const task = taskSet.tasks[0]!
    const verdicts = [
      { name: 'the patch that fixes it', patch: task.patch },
      { name: 'the patch that changes the test', patch: { file: 'test_fix_0.py', change: 'break-test' as const } },
      { name: 'the patch that breaks another test', patch: { file: task.files[0]!, change: 'break-other' as const } },
      { name: 'the patch that changes nothing', patch: { file: task.files[0]!, change: 'none' as const } },
      {
        name: 'the patch that fixes the wrong file',
        patch: { file: task.files[task.files.length - 1]!, change: 'fix' as const },
      },
    ].map((entry) => ({ name: entry.name, verdict: verify(task, entry.patch) }))

    expect(headers('The verdicts')).toEqual([
      'The patch',
      'Solved?',
      'Fail to pass',
      'Pass to pass',
      'Touched a test',
      'Why',
    ])
    expect(rows('The verdicts')).toEqual(
      verdicts.map((entry) => [
        entry.name,
        entry.verdict.solved ? 'yes' : 'no',
        entry.verdict.failToPass ? 'yes' : 'no',
        entry.verdict.passToPass ? 'yes' : 'no',
        entry.verdict.touchedATest ? 'yes' : '—',
        entry.verdict.reason,
      ]),
    )

    // "The fail-to-pass condition alone cannot tell a fix from an edit to the test": the first two
    // rows agree on both conditions and disagree only on the verdict the pair gives.
    const [fix, cheat] = verdicts
    expect(fix!.verdict.failToPass).toBe(cheat!.verdict.failToPass)
    expect(fix!.verdict.passToPass).toBe(cheat!.verdict.passToPass)
    expect(fix!.verdict.solved).toBe(true)
    expect(cheat!.verdict.solved).toBe(false)
    expect(cheat!.verdict.touchedATest).toBe(true)

    // The fifth row is worth naming: the "wrong file" is the last file the task touches, so for a
    // task that touches one file it is also the right one, and the criterion accepts it.
    expect(verdicts[4]!.verdict.solved).toBe(task.files.length === 1)
  })

  it('shows the cheat and the honest fix as two columns of the same table', () => {
    renderLab('verifier', '?view=cheat')
    expect(rows('The scores')).toEqual([
      [
        'the agentless baseline',
        String(baseline.solved),
        String(baseline.cheated),
        `${fmt(baseline.inflatedScore * 100, 1)}%`,
        String(baseline.attempts),
      ],
      ['the agent', String(agent.solved), String(agent.cheated), `${fmt(agent.inflatedScore * 100, 1)}%`, String(agent.attempts)],
    ])
    // The baseline makes exactly one attempt per task; the agent stops at the first verdict that
    // passes, so its attempts are the cost the figure is drawn to show.
    expect(baseline.attempts).toBe(taskSet.tasks.length)
    expect(agent.attempts).toBeGreaterThan(taskSet.tasks.length)
    expect(agent.solved + agent.cheated).toBeLessThanOrEqual(taskSet.tasks.length)
  })

  it('counts the harness over every task, and the two conditions over the same patches', () => {
    renderLab('verifier', '?view=harness')
    const report = criterionReport(taskSet.tasks)
    expect(stat('The patches run').value).toBe(String(report.patches))
    expect(stat('The first condition alone accepts').value).toBe(String(report.failToPassOnly))
    expect(stat('The pair accepts').value).toBe(String(report.bothConditions))
    expect(stat('The cheats it caught').value).toBe(String(report.cheats))

    expect(rows('The harness over the whole task set')).toEqual([
      ['fail to pass, alone', String(report.failToPassOnly), `${report.cheats} test edits it cannot see`],
      ['fail to pass and pass to pass', String(report.bothConditions), 'the fixes, and nothing else'],
      ['pass to pass, alone', String(report.patches - report.regressions), `${report.regressions} regressions it catches`],
    ])
    expect(rows('The counts by patch')).toEqual([
      ['the fix', String(taskSet.tasks.length), 'solved'],
      ['an edit to the test', String(report.cheats), 'rejected, because a test changed'],
      ['a fix to the wrong file', String(report.wrongFileFixes), 'rejected, the failing test still fails'],
      ['a patch that breaks another test', String(report.regressions), 'rejected, a passing test stopped passing'],
      ['no change', String(taskSet.tasks.length), 'rejected, nothing moved'],
    ])

    // Five patches per task, and one test edit per task that the first condition cannot see.
    expect(report.patches).toBe(taskSet.tasks.length * 5)
    expect(report.cheats).toBe(taskSet.tasks.length)
    expect(report.regressions).toBe(taskSet.tasks.length)
    // The first condition accepts more than the pair, and the difference is exactly the patches
    // that satisfy it without doing the work.
    expect(report.failToPassOnly).toBeGreaterThan(report.bothConditions)
    // "The fixes, and nothing else": every fix passes, and the only other patches the pair accepts
    // are the wrong-file attempts that were not wrong — a task touching one file has its fix in
    // the last file it lists. So the count is the fixes plus the misses that hit.
    expect(report.bothConditions).toBe(taskSet.tasks.length + (taskSet.tasks.length - report.wrongFileFixes))
    expect(report.wrongFileFixes).toBe(
      taskSet.tasks.filter((task) => task.files[task.files.length - 1] !== task.patch.file).length,
    )
    // and the third row's arithmetic is the screen's own: the patches minus the regressions.
    expect(report.patches - report.regressions).toBe(320)
  })

  it('re-runs both solvers when the size of the task set moves', () => {
    renderLab('verifier')
    const before = [stat('The baseline’s score').value, stat('The agent’s score').value, stat('The cheats the verifier caught').value]
    setSlider('The tasks', 100)

    const grown = buildTaskSet({ size: 100, seed: VERIFIER.seed })
    const grownBaseline = retrievalBaseline(grown.tasks, VERIFIER.seed)
    const grownAgent = agentSolver(grown.tasks, { seed: VERIFIER.seed + 1 })
    expect(stat('The tasks').value).toBe('100')
    expect(stat('The baseline’s score').value).toBe(`${fmt((grownBaseline.solved / 100) * 100, 1)}%`)
    expect(stat('The agent’s score').value).toBe(`${fmt((grownAgent.solved / 100) * 100, 1)}%`)
    expect(stat('The cheats the verifier caught').value).toBe(String(grownBaseline.cheated + grownAgent.cheated))
    expect(stat('The baseline’s score').value).not.toBe(before[0])

    const report = criterionReport(grown.tasks)
    expect(report.patches).toBe(500)
    expect(report.cheats).toBe(100)
  })

  it('re-seeds both solvers when the seed moves', () => {
    renderLab('verifier', '?view=cheat')
    const before = rows('The scores')
    setSlider('Seed', 9)

    const other = buildTaskSet({ size: VERIFIER.size, seed: 9 })
    const agent = agentSolver(other.tasks, { seed: 10 })
    const baseline = retrievalBaseline(other.tasks, 9)
    expect(rows('The scores')).toEqual([
      [
        'the agentless baseline',
        String(baseline.solved),
        String(baseline.cheated),
        `${fmt(baseline.inflatedScore * 100, 1)}%`,
        String(baseline.attempts),
      ],
      ['the agent', String(agent.solved), String(agent.cheated), `${fmt(agent.inflatedScore * 100, 1)}%`, String(agent.attempts)],
    ])
    expect(stat('The agent’s score').value).toBe(`${fmt((agent.solved / VERIFIER.size) * 100, 1)}%`)
    expect(stat('The cheats the verifier caught').value).toBe(String(baseline.cheated + agent.cheated))
    // A new seed is a new task set, so the solvers are asked different questions. The two scores
    // can land on the same rounded number; the attempts, which are the sum of the runs, do not.
    expect(rows('The scores')).not.toEqual(before)
    expect(rows('The scores')[1]![4]).not.toBe(before[1]![4])
  })
})

/* ------------------------------------------------------------------ Laboratory C */

describe('the baselines laboratory prints the runs, the test and the reliability', () => {
  const taskSet = buildTaskSet({ size: BASELINES.size, seed: BASELINES.seed })
  const baseline = retrievalBaseline(taskSet.tasks, BASELINES.seed)
  const agent = agentSolver(taskSet.tasks, { seed: BASELINES.seed + 1 })

  it('prices the two solvers and the noise between the runs', () => {
    renderLab('baselines')
    expect(stat('The baseline’s score').value).toBe(`${fmt((baseline.solved / BASELINES.size) * 100, 1)}%`)
    expect(stat('The agent’s score').value).toBe(`${fmt((agent.solved / BASELINES.size) * 100, 1)}%`)
    const spread = runSpread(repeatedRuns(taskSet.tasks, { runs: BASELINES.runs, seed: BASELINES.seed }))
    expect(stat('The spread across the runs').value).toBe(`${fmt(spread.deviation, 2)} points`)
    expect(stat('The agent’s cost per task').value).toBe(fmt(costPerTask(agent), 2))
    expect(stat('The agent’s cost per task').hint).toBe('the attempts per task solved')

    // The callout repeats the same number inside a sentence, so the two places have to agree.
    expect(document.body.textContent).toContain(`The spread across runs — ${fmt(spread.deviation, 2)} points here`)
    expect(stat('The spread across the runs').hint).toBe('the movement of one solver between its own runs')
    // Both solvers are in the pool the mean is taken over, and the runs are that pool.
    const scores = repeatedRuns(taskSet.tasks, { runs: BASELINES.runs, seed: BASELINES.seed }).flatMap((row) => [
      row.baseline,
      row.agent,
    ])
    expect(scores).toHaveLength(BASELINES.runs * 2)
    expect(spread.mean).toBeCloseTo(scores.reduce((a, b) => a + b, 0) / scores.length, 10)
    // The deviation is measured inside each series, which is the only place the run-to-run noise
    // lives: pooling the two solvers instead would mostly measure the gap between them.
    const runs = repeatedRuns(taskSet.tasks, { runs: BASELINES.runs, seed: BASELINES.seed })
    const meanOf = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
    const gap = Math.abs(meanOf(runs.map((row) => row.agent)) - meanOf(runs.map((row) => row.baseline)))
    expect(spread.deviation).toBeLessThan(gap / 2)
    // and one run has no movement in it, whatever the gap says.
    expect(runSpread(runs.slice(0, 1)).deviation).toBe(0)
    // The agent's edge is real: it is several times the noise a single run carries.
    expect(agent.solved / BASELINES.size).toBeGreaterThan(baseline.solved / BASELINES.size)
    expect(spread.deviation).toBeGreaterThan(1)
    expect(gap / spread.deviation).toBeGreaterThan(3)
  })

  it('repeats the runs the chart plots, and moves them with the control', () => {
    renderLab('baselines')
    const before = stat('The spread across the runs').value
    const deviating = runSpread(repeatedRuns(taskSet.tasks, { runs: 10, seed: BASELINES.seed }))
    setSlider('The runs', 10)
    expect(stat('The spread across the runs').value).toBe(`${fmt(deviating.deviation, 2)} points`)
    expect(stat('The spread across the runs').value).not.toBe(before)

    // The solvers themselves do not change with the number of runs — the score is run one — so
    // what the control moves is the estimate of the noise, and nothing else on the panel.
    expect(stat('The baseline’s score').value).toBe(`${fmt((baseline.solved / BASELINES.size) * 100, 1)}%`)
  })

  it('corrects the naive pass@k, and agrees with it at one sample', () => {
    renderLab('baselines', '?view=variance')
    const naive = (3 / 8) * 100
    expect(rows('pass@k from eight samples')).toEqual(
      [1, 2, 4, 8].map((k) => [String(k), `${fmt(passAtK([3], 8, k) * 100, 1)}%`, `${fmt(naive, 1)}%`]),
    )
    // "The correction is what makes two different sample budgets comparable": at k = 1 there is
    // nothing to correct, and the two columns are the same number.
    expect(printedNumber(rows('pass@k from eight samples')[0]![1]!)).toBeCloseTo(naive, 1)
    for (const [index, row] of rows('pass@k from eight samples').entries()) {
      if (index === 0) continue
      expect(printedNumber(row[1]!)).toBeGreaterThan(printedNumber(rows('pass@k from eight samples')[index - 1]![1]!))
    }
    expect(passAtK([3], 8, 8)).toBe(1)
  })

  it('signs the paired comparison with the test it reports', () => {
    renderLab('baselines', '?view=comparison')
    const test = pairedSignTest(18, 4)
    expect(rows('The comparison')).toEqual([
      ['the tasks where the agent wins', String(test.total - 4)],
      ['the tasks where the baseline wins', '4'],
      ['the p-value', fmt(test.p, 5)],
      ['the difference is significant at five per cent', test.better ? 'yes' : 'no'],
    ])
    expect(test.total).toBe(22)
    // The exact sign test over twenty-two disagreements, four of them against the agent.
    expect(test.p).toBeLessThan(0.05)
    expect(test.better).toBe(true)

    expect(rows('The cost')).toEqual([
      ['the agentless baseline', String(baseline.attempts), String(baseline.solved), fmt(costPerTask(baseline), 2)],
      ['the agent', String(agent.attempts), String(agent.solved), fmt(costPerTask(agent), 2)],
    ])
    // "The agent solves more tasks and makes more attempts", and the comparison that matters is
    // the two scores per attempt — which is why the panel prints the ratio rather than the pair.
    expect(agent.solved).toBeGreaterThan(baseline.solved)
    expect(agent.attempts).toBeGreaterThan(baseline.attempts)
    expect(costPerTask(agent)).toBeGreaterThan(1)
    for (const row of rows('The cost')) {
      expect(printedNumber(row[3]!)).toBeCloseTo(Number(row[1]) / Number(row[2]), 2)
    }
  })

  it('reports reliability as pass^k on the trials the screen drew', () => {
    renderLab('baselines', '?view=reliability')
    const trials = repeatedTrialCounts(40, 10, BASELINES.seed)
    expect(stat('The tasks').value).toBe(String(trials.length))
    expect(stat('The tasks').hint).toBe('ten trials each')
    expect(stat('pass^1').hint).toBe('the single pass rate')
    for (const k of [1, 2, 8]) {
      expect(stat(`pass^${k}`).value).toBe(`${fmt(passPowerK(trials, 10, k) * 100, 1)}%`)
    }
    const table = rows('The reliability estimates')
    expect(table).toEqual(
      [1, 2, 4, 8].map((k) => [
        String(k),
        `${fmt(passAtK(trials, 10, k) * 100, 1)}%`,
        `${fmt(passPowerK(trials, 10, k) * 100, 1)}%`,
      ]),
    )
    // The three stats are three rows of the same table, so they cannot disagree with it.
    for (const k of [1, 2, 8]) {
      const row = table.find((entry) => entry[0] === String(k))!
      expect(stat(`pass^${k}`).value).toBe(row[2])
    }

    // "The two curves leave the same point at k = 1": the same counts, the first question asked of
    // them, and one estimate apiece.
    expect(table[0]![1]).toBe(table[0]![2])
    // "and separate immediately" — the gap opens at two trials and only widens.
    const gaps = table.map((row) => printedNumber(row[1]!) - printedNumber(row[2]!))
    for (const [index, gap] of gaps.entries()) {
      if (index === 0) continue
      expect(gap).toBeGreaterThan(gaps[index - 1]!)
    }
    // The caption's arithmetic, measured: sixty per cent eight times in a row is about two per
    // cent, and the ten-trial estimate is within half a point of the closed form.
    expect(printedNumber(table[3]![2]!)).toBeCloseTo(0.6 ** 8 * 100, 0)
    expect(Math.abs(printedNumber(table[3]![2]!) - 0.6 ** 8 * 100)).toBeLessThan(0.5)
    // Every task was tried ten times, and none of them succeeded ten times out of ten.
    for (const count of trials) expect(count).toBeLessThan(10)
    expect(passPowerK(trials, 10, 10)).toBe(0)
  })
})

/* ------------------------------------------------------------------ Laboratory E */

describe('the environments laboratory prints the matrix, the summaries and the replay', () => {
  const scores = environmentScores()
  const summary = landscapeSummary(scores)
  const large = summary.models.find((entry) => entry.model.id === 'large')!

  it('prints every model in every environment, and the winner of each row', () => {
    renderLab('environments')
    expect(stat('The environments').value).toBe(String(scores.length))
    expect(stat('The models').value).toBe(String(MODEL_PROFILES.length))
    expect(stat('The best average').value).toBe(summary.bestByAverage)
    expect(stat('Environments where the average is wrong').value).toBe(String(summary.exceptions))

    expect(headers('The environment profiles')).toEqual([
      'The environment',
      ...MODEL_PROFILES.map((model) => model.name),
      'The best',
    ])
    expect(rows('The environment profiles')).toEqual(
      scores.map((row) => {
        const best = Math.max(...row.scores)
        return [
          row.environment.name,
          ...row.scores.map((score) => `${fmt(score * 100, 1)}%`),
          MODEL_PROFILES[row.scores.indexOf(best)]!.name,
        ]
      }),
    )

    // Each cell is the logistic of the capability against that environment's difficulty, so the
    // printed matrix can be rebuilt from the two tables the core holds.
    for (const [index, row] of scores.entries()) {
      for (const [modelIndex, model] of MODEL_PROFILES.entries()) {
        expect(row.scores[modelIndex]).toBeCloseTo(
          scoreOf(model.capabilities[index] ?? 0.3, row.environment.difficulty),
          12,
        )
      }
    }

    // "The lines cross": the average and the per-environment winner disagree somewhere, and here
    // it is exactly one environment — the card game, which the specialist is built for.
    expect(summary.exceptions).toBe(1)
    expect(large.wins).toBe(scores.length - 1)
    expect(summary.models.find((entry) => entry.model.id === 'specialist')!.wins).toBe(1)
    expect(summary.bestByAverage).toBe('the large model')
    const losers = scores.filter((row) => row.environment.id === 'card')
    expect(losers).toHaveLength(1)
    expect(rows('The environment profiles')[scores.findIndex((row) => row.environment.id === 'card')]![5]).toBe(
      'the card specialist',
    )
  })

  it('prints the summaries the average is taken from', () => {
    renderLab('environments', '?view=average')
    expect(stat('The large model’s mean').value).toBe(`${fmt(large.mean * 100, 1)}%`)
    expect(stat('Its worst environment').value).toBe(`${fmt(large.min * 100, 1)}%`)
    expect(stat('The spread it hides').value).toBe(`${fmt(large.spread * 100, 1)} points`)
    expect(stat('Environments it wins').value).toBe(`${large.wins} of ${scores.length}`)

    expect(rows('The summaries')).toEqual(
      summary.models.map((entry) => [
        entry.model.name,
        `${fmt(entry.mean * 100, 1)}%`,
        `${fmt(entry.min * 100, 1)}%`,
        `${fmt(entry.max * 100, 1)}%`,
        `${fmt(entry.spread * 100, 1)} points`,
        String(entry.wins),
      ]),
    )

    // The failure the figure argues: one environment drags the large model's mean down by more
    // than a third of its own value, and the average is what a reader of the leaderboard sees.
    expect(large.mean - large.min).toBeGreaterThan(0.4)
    expect(large.spread).toBeCloseTo(large.max - large.min, 12)
    // The specialist is the only model whose best environment beats the large model's mean, which
    // is why the two summary statistics in the panel answer different questions.
    const specialist = summary.models.find((entry) => entry.model.id === 'specialist')!
    expect(specialist.max).toBeGreaterThan(large.min)
    expect(specialist.mean).toBeLessThan(large.mean)
    // The wins column counts rows, so it cannot exceed the number of environments.
    for (const row of rows('The summaries')) expect(Number(row[5])).toBeLessThanOrEqual(scores.length)
    expect(rows('The summaries').reduce((sum, row) => sum + Number(row[5]), 0)).toBe(scores.length)
  })

  it('replays the same trajectory to the same states', () => {
    renderLab('environments', '?view=reproducibility')
    const actions = [...SHOP_ACTIONS]
    const first = replay(actions, ENVIRONMENTS.seed)
    expect(stat('The steps replayed').value).toBe(String(first.length - 1))
    expect(stat('The two runs').value).toBe('identical')
    expect(replayDigest(first)).toBe(replayDigest(replay(actions, ENVIRONMENTS.seed)))
    expect(stat('The seed').value).toBe(String(ENVIRONMENTS.seed))

    expect(rows('The replay')).toEqual(
      first.slice(1).map((state, index) => [
        String(state.step),
        actions[index]!,
        state.page,
        String(state.cart),
      ]),
    )

    // The initial cart is a property of the seed, so the replay the table prints starts where the
    // environment was seeded and every later state follows from the actions alone.
    expect(first[0]!.cart).toBe(ENVIRONMENTS.seed % 3)
    for (const [index, state] of first.entries()) {
      expect(state.step).toBe(index)
      if (index === 0) continue
      expect(state.page).not.toBe('home')
    }

    const changed = [...actions] as ('search' | 'add' | 'remove' | 'checkout' | 'back')[]
    changed[2] = 'remove'
    const diverges = divergenceStep(actions, changed, ENVIRONMENTS.seed)
    expect(stat('The changed action diverges at').value).toBe(`step ${diverges}`)
    expect(diverges).toBe(3)
    expect(rows('The original and the perturbation')).toEqual(
      first.map((state, index) => [
        String(state.step),
        `${state.page}, ${state.cart} in the cart`,
        index < diverges
          ? `${state.page}, ${state.cart} in the cart`
          : `${replay(changed, ENVIRONMENTS.seed)[index]!.page}, ${replay(changed, ENVIRONMENTS.seed)[index]!.cart} in the cart`,
      ]),
    )

    // "The divergence begins at the changed action and not before" — the third action is the one
    // that was replaced, and the two columns agree exactly up to it.
    const table = rows('The original and the perturbation')
    for (const [index, row] of table.entries()) {
      if (index >= diverges) continue
      expect(row[1], `step ${index}`).toBe(row[2])
    }
    expect(table[diverges]![1]).not.toBe(table[diverges]![2])
  })

  it('re-seeds the environment when the seed moves, and keeps the actions', () => {
    renderLab('environments', '?view=reproducibility')
    const before = rows('The replay')
    setSlider('The environment’s seed', 3)
    const actions = [...SHOP_ACTIONS]
    const other = replay(actions, 3)
    expect(stat('The seed').value).toBe('3')
    expect(rows('The replay')).toEqual(
      other.slice(1).map((state, index) => [String(state.step), actions[index]!, state.page, String(state.cart)]),
    )
    expect(rows('The replay')).not.toEqual(before)
    // The seed only places the cart, so the pages the actions produce are the same trajectory.
    expect(other.map((state) => state.page)).toEqual(replay(actions, ENVIRONMENTS.seed).map((state) => state.page))
    expect(stat('The two runs').value).toBe('identical')
  })
})

/* ------------------------------------------------------------------ Laboratory D */

describe('the contamination laboratory prints the overlap the controls ask for', () => {
  const taskSet = buildTaskSet({
    size: CONTAMINATION.size,
    contamination: CONTAMINATION.rate,
    seed: CONTAMINATION.seed,
  })
  const corpus = buildTrainingCorpus(taskSet.tasks, {
    documents: 120,
    seed: CONTAMINATION.seed + 1,
    editRate: CONTAMINATION.editRate,
  })
  const report = measureContamination(taskSet.tasks, corpus, { n: CONTAMINATION.n, threshold: CONTAMINATION.threshold })

  it('gives both rates rather than a verdict', () => {
    renderLab('contamination')
    expect(stat('The tasks flagged').value).toBe(String(report.flagged))
    expect(stat('The true-positive rate').value).toBe(`${fmt(report.truePositiveRate * 100, 1)}%`)
    expect(stat('The false-positive rate').value).toBe(`${fmt(report.falsePositiveRate * 100, 1)}%`)
    expect(stat('The tasks really contaminated').value).toBe(String(report.actuallyContaminated))

    // The two rates are computed over different denominators, which is the whole of the callout's
    // argument that one without the other is not a measurement.
    expect(report.actuallyContaminated).toBe(taskSet.tasks.filter((task) => task.contaminated).length)
    expect(report.truePositiveRate).toBe(report.caught / report.actuallyContaminated)
    expect(report.falsePositiveRate).toBe((report.flagged - report.correct) / report.flagged)
    expect(report.correct).toBe(report.caught)
    // At these settings every flag is a true one, so what the test is missing is not a false
    // alarm but a leak: the contaminated tasks it did not catch.
    expect(report.flagged).toBe(report.correct)
    expect(report.actuallyContaminated - report.caught).toBeGreaterThan(0)
  })

  it("prints every task's overlap and the flag the threshold turns it into", () => {
    renderLab('contamination')
    const perTask = taskSet.tasks.slice(0, 14).map((task) => ({
      overlap: corpusOverlap(solutionWords(task, 500), corpus, CONTAMINATION.n),
      contaminated: task.contaminated,
    }))
    expect(rows('The overlap of every task')).toEqual(
      perTask.map((row, index) => [
        String(index),
        fmt(row.overlap, 4),
        row.contaminated ? 'yes' : '—',
        row.overlap >= CONTAMINATION.threshold ? 'yes' : '—',
      ]),
    )
    // The flag column is the threshold applied to the overlap column, and nothing else. The
    // overlap is printed as a fraction, so the comparison is made on the printed fraction.
    for (const row of rows('The overlap of every task')) {
      expect(row[3]).toBe(printedNumber(row[1]!) >= CONTAMINATION.threshold ? 'yes' : '—')
    }
    // A clean task has no copy in the corpus, so its overlap is exactly zero: the signal here is
    // the leaked tasks, and a task can be leaked and still score zero.
    for (const [index, row] of perTask.entries()) {
      if (!row.contaminated) expect(row.overlap, `task ${index}`).toBe(0)
    }
    expect(perTask.some((row) => row.contaminated && row.overlap === 0)).toBe(true)
  })

  it('loses the leak when the n-gram is longer than the edits', () => {
    renderLab('contamination')
    const before = stat('The tasks flagged').value
    setSlider('The length of the n-gram', 24)

    const longer = measureContamination(taskSet.tasks, corpus, { n: 24, threshold: CONTAMINATION.threshold })
    expect(stat('The tasks flagged').value).toBe(String(longer.flagged))
    expect(stat('The true-positive rate').value).toBe(`${fmt(longer.truePositiveRate * 100, 1)}%`)
    expect(longer.flagged).toBeLessThan(Number(before))
    expect(longer.truePositiveRate).toBeLessThan(report.truePositiveRate)

    // The figure's claim, measured on the same corpus: the copies are edited at ten per cent, so
    // the mean overlap of a leaked task falls with the length of the n-gram it is matched on.
    const byLength = overlapByLength(taskSet.tasks, corpus, [3, 5, 8, 12, 16, 24])
    for (const [index, row] of byLength.entries()) {
      if (index === 0) continue
      expect(row.truePositiveMean, `at n = ${row.n}`).toBeLessThan(byLength[index - 1]!.truePositiveMean)
    }
    expect(byLength[0]!.truePositiveMean).toBeGreaterThan(byLength[byLength.length - 1]!.truePositiveMean * 4)
    // and the innocent tasks are not accused at any of the lengths the panel shows
    for (const row of byLength) expect(row.falsePositiveMean).toBe(0)
  })

  it('flags nothing at a threshold no overlap reaches', () => {
    renderLab('contamination')
    setSlider('The threshold', 0.9)
    const strict = measureContamination(taskSet.tasks, corpus, { n: CONTAMINATION.n, threshold: 0.9 })
    expect(stat('The tasks flagged').value).toBe(String(strict.flagged))
    expect(strict.flagged).toBe(0)
    expect(stat('The true-positive rate').value).toBe('0%')
    expect(stat('The false-positive rate').value).toBe('0%')
    for (const row of rows('The overlap of every task')) expect(row[3]).toBe('—')
    // The contaminated tasks are still contaminated: the threshold decides what is accused, not
    // what happened.
    expect(stat('The tasks really contaminated').value).toBe(String(report.actuallyContaminated))
  })

  it('rebuilds the corpus when the editing or the seed moves', () => {
    renderLab('contamination')
    const before = rows('The overlap of every task')
    setSlider('How much the copies are edited', 0.4)

    const edited = buildTrainingCorpus(taskSet.tasks, { documents: 120, seed: CONTAMINATION.seed + 1, editRate: 0.4 })
    const perTask = taskSet.tasks.slice(0, 14).map((task) =>
      fmt(corpusOverlap(solutionWords(task, 500), edited, CONTAMINATION.n), 4),
    )
    expect(rows('The overlap of every task').map((row) => row[1])).toEqual(perTask)
    // Heavier editing removes the shared n-grams, so the same tasks show a smaller overlap.
    const means = (column: number, values: string[][]) =>
      values.reduce((sum, row) => sum + printedNumber(row[column]!), 0) / values.length
    expect(means(1, rows('The overlap of every task'))).toBeLessThan(means(1, before))
  })
})
