import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Callout, Citation, Panel, Stat, Table } from '../../components/ui';
import { Rich, Tex } from '../../components/Math';
import { GuidedExercise } from '../../components/GuidedExercise';
import { DownloadCsv } from '../../components/DownloadCsv';
import { LabLessons } from '../../components/LabLessons';
import { PREREQUISITE_DRILLS, PREREQUISITE_TOOLS } from '../../content/prerequisites';
import { computedValue, formatComputed, getComputedExercise } from '../../lib/exercises';
import { useProgress } from '../../lib/persistence';
import type { Exercise } from '../../content/types';

/**
 * Laboratory F · the prerequisite drills.
 *
 * The navigator at `/prerequisites` says which eight pieces of mathematics the
 * theory rests on and asks a self-check question about each. A question with a
 * printed answer is a reading exercise; this screen turns the same eight into
 * drills that are *graded*, and graded against a live computation rather than a
 * key: every answer is produced by `src/lib/exercises.ts`, which runs the same
 * eigensolver, quadrature rule and Gaussian-process code as the laboratories.
 *
 * The numbers are deliberately small enough to reach by hand. The point is not
 * to test the theory but the toolkit, and the useful signal is the disagreement:
 * when the learner's value and the app's value differ, the method line names the
 * computation that produced the app's, and the working line shows the derivation.
 */

const TOOL_BY_ID = new Map(PREREQUISITE_TOOLS.map((t) => [t.id, t]));

export function DrillsLab() {
  const [tool, setTool] = useState<string>('all');
  const [open, setOpen] = useState<string | null>(null);
  const { progress, setExercise } = useProgress();

  /** The live answer for each drill, computed once: the drills are fixed content. */
  const answers = useMemo(
    () =>
      PREREQUISITE_DRILLS.map((drill, index) => {
        const entry = getComputedExercise(drill.computed);
        return {
          drill,
          index,
          /** the key the dashboard records a solved drill under */
          progressKey: `drills:${index}`,
          method: entry?.method ?? 'no computation registered',
          tolerance: entry?.tolerance ?? 0,
          digits: entry?.digits ?? 4,
          value: computedValue(drill.computed),
        };
      }),
    [],
  );

  const shown = tool === 'all' ? answers : answers.filter((a) => a.drill.tool === tool);
  const solvedCount = answers.filter((a) => progress.exercises[a.progressKey]?.solved).length;
  const toolsCovered = new Set(answers.map((a) => a.drill.tool)).size;
  const unanswered = answers.filter((a) => a.value === null).length;

  const exerciseFor = (drill: (typeof PREREQUISITE_DRILLS)[number]): Exercise => ({
    kind: drill.kind,
    prompt: drill.prompt,
    answer: drill.working,
    computed: drill.computed,
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-lab-100">Laboratory F · Prerequisite drills</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
            {PREREQUISITE_DRILLS.length} graded checks of the {PREREQUISITE_TOOLS.length} tools the theory course leans
            on. Each answer is a number you can reach by hand from the prerequisite — and each is computed here, live, by
            the same numerical code the other laboratories run, so a disagreement is worth reading.
          </p>
          <LabLessons route="/labs/drills" className="mt-1" />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setTool('all')}>
            show every tool
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Drills" value={String(PREREQUISITE_DRILLS.length)} hint="Each one names a computed answer." />
        <Stat label="Tools covered" value={`${toolsCovered} of ${PREREQUISITE_TOOLS.length}`} hint="Every tool in the navigator is drilled." />
        <Stat
          label="You have solved"
          value={`${solvedCount} of ${PREREQUISITE_DRILLS.length}`}
          hint="Recorded on your dashboard as you check them."
          tone={solvedCount === PREREQUISITE_DRILLS.length ? 'good' : 'default'}
        />
        <Stat
          label="Without a computation"
          value={String(unanswered)}
          hint="Drills whose answer key is missing from the registry — the app refuses to grade these."
          tone={unanswered === 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTool('all')}
          className={`rounded border px-2.5 py-1 text-[12px] ${
            tool === 'all' ? 'border-signal-blue bg-signal-blue/15 text-signal-blue' : 'border-lab-600 text-lab-300 hover:border-lab-400'
          }`}
        >
          all tools
        </button>
        {PREREQUISITE_TOOLS.map((t) => {
          const count = PREREQUISITE_DRILLS.filter((d) => d.tool === t.id).length;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              disabled={count === 0}
              title={count === 0 ? 'no drill for this tool yet' : `${count} drill${count === 1 ? '' : 's'}`}
              className={`rounded border px-2.5 py-1 text-[12px] ${
                tool === t.id ? 'border-signal-blue bg-signal-blue/15 text-signal-blue' : 'border-lab-600 text-lab-300 hover:border-lab-400'
              } ${count === 0 ? 'opacity-40' : ''}`}
            >
              {t.name.replace(/ and .*/, '')} · {count}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {PREREQUISITE_TOOLS.filter((t) => (tool === 'all' ? true : t.id === tool)).map((t) => {
          const drills = shown.filter((a) => a.drill.tool === t.id);
          if (drills.length === 0) return null;
          return (
            <Panel
              key={t.id}
              title={t.name}
              right={<Badge tone={t.level === 'essential' ? 'good' : t.level === 'helpful' ? 'warn' : 'default'}>{t.level}</Badge>}
              subtitle={<span className="mono">{t.usedFor}</span>}
            >
              <div className="rounded border border-lab-700 bg-lab-850/50 px-3 py-2 text-center text-lab-100">
                <Tex tex={t.tex} display />
              </div>
              <div className="mt-3 space-y-3">
                {drills.map(({ drill, index, progressKey, method, tolerance, digits, value }) => {
                  const solved = Boolean(progress.exercises[progressKey]?.solved);
                  return (
                    <div key={drill.id} className="rounded border border-lab-700 bg-lab-850/40 p-3">
                      <p className="text-[13px] leading-relaxed text-lab-200">
                        <Rich text={drill.prompt} />
                      </p>
                      <p className="mono mt-1.5 text-[11.5px] leading-relaxed text-lab-400">{drill.given}</p>
                      <GuidedExercise
                        exercise={exerciseFor(drill)}
                        solved={solved}
                        onSolved={(correct) => {
                          if (correct) setExercise('drills', index, true);
                        }}
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button variant="ghost" onClick={() => setOpen(open === drill.id ? null : drill.id)}>
                          {open === drill.id ? 'hide the working' : 'show the working'}
                        </Button>
                        {solved && <Badge tone="good">solved</Badge>}
                        <Link to={drill.route} className="text-[12px] text-signal-blue underline decoration-dotted">
                          measure it in earnest →
                        </Link>
                      </div>
                      {open === drill.id && (
                        <div className="mt-2 rounded border border-signal-green/40 bg-signal-green/10 p-2.5 text-[12.5px] leading-relaxed text-lab-100">
                          <Rich text={drill.working} />
                          <p className="mt-1.5 text-[11.5px] leading-relaxed text-lab-300">
                            Computed here by the app: {method} The value is{' '}
                            <span className="mono">{value === null ? 'unavailable' : formatComputed(value, digits)}</span>
                            {' '}±{formatComputed(tolerance, 3)}, and the same quantity appears in {drill.label}.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel
        title="At a glance"
        subtitle="The drills listed above, the tool each checks, the value the app computes, and whether you have solved it. The CSV is always the whole set."
        right={
          <DownloadCsv
            filename="prerequisite-drills.csv"
            title="Download every drill and every computed answer, not only the tool you are looking at"
            meta={{
              drills: PREREQUISITE_DRILLS.length,
              tools: toolsCovered,
              solved: solvedCount,
            }}
            header={['tool', 'drill', 'computed value', 'tolerance', 'method', 'you']}
            rows={answers.map(({ drill, progressKey, method, tolerance, value }) => [
              TOOL_BY_ID.get(drill.tool)?.name ?? drill.tool,
              drill.prompt,
              value === null ? 'no computation' : formatComputed(value, 6),
              formatComputed(tolerance, 3),
              method,
              progress.exercises[progressKey]?.solved ? 'solved' : 'not yet',
            ])}
          />
        }
      >
        <Table
          head={['tool', 'drill', 'computed value', 'you']}
          rows={shown.map(({ drill, progressKey, value }) => [
            <Link key={drill.id} to={drill.route} className="text-signal-blue underline decoration-dotted">
              {TOOL_BY_ID.get(drill.tool)?.name ?? drill.tool}
            </Link>,
            <span key={`p-${drill.id}`}>{drill.prompt}</span>,
            <span key={`v-${drill.id}`} className="mono">
              {value === null ? '—' : formatComputed(value, 4)}
            </span>,
            <span key={`s-${drill.id}`}>{progress.exercises[progressKey]?.solved ? 'solved' : '—'}</span>,
          ])}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Citation
            label="mml-book"
            note="Deisenroth, Faisal & Ong, Mathematics for Machine Learning (2020): the linear-algebra, matrix-calculus, probability and numerical-computation chapters these drills draw on."
          />
          <Citation
            label="§0.2, §4"
            note="Roberts, Yaida & Hanin, The Principles of Deep Learning Theory: where each tool is put to work in the theory."
          />
        </div>
      </Panel>

      <Callout tone="insight" title="Why the answer is computed rather than stored">
        The verdict is a verdict about a number, not a mark. Each answer is produced when the page loads by the same
        code the laboratories run — the Jacobi eigensolver, the Gauss–Hermite rule, the Gaussian-process posterior — so
        a drill cannot quietly keep quoting a value the application no longer computes. If you disagree with the app,
        you are disagreeing with a computation you can open and read.
      </Callout>

      <Callout tone="limitation" title="What this laboratory does not do">
        It grades the toolkit, not the theory: every value here is reachable by hand, so none of them is evidence that
        the effective theory works. The grading is on absolute tolerance, which is generous for the two drills whose
        answers are large and strict for the ones whose answers are near zero. And unlike Laboratories A–E this screen
        sweeps no parameters, so the experiment gallery has no preset that opens it.
      </Callout>
    </div>
  );
}
