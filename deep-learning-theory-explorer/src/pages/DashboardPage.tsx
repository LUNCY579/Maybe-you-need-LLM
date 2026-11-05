import { useMemo, useRef, useState } from 'react';
import { Panel, Badge, Button, Table, Stat, Callout } from '../components/ui';
import { useProgress, quizScore } from '../lib/persistence';
import { buildStudyPlan, studyStepLabel } from '../lib/studyPlan';
import { LESSONS } from '../content/lessons';
import { EQUATIONS } from '../content/equations';
import { Link } from 'react-router-dom';
import { useSharedSetup } from '../lib/sharedSetup';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function DashboardPage() {
  const { progress, reset, exportJson, importJson, persistenceFailed } = useProgress();
  const [confirmReset, setConfirmReset] = useState(false);
  const plan = useMemo(() => buildStudyPlan(progress), [progress]);
  const [pasted, setPasted] = useState('');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const shared = useSharedSetup();
  const score = quizScore(progress);
  const lessonsDone = LESSONS.filter((l) => progress.lessons[l.id]?.completed).length;
  const bookmarks = LESSONS.filter((l) => progress.lessons[l.id]?.bookmarked).length;
  const exerciseCount = Object.values(progress.exercises).filter((e) => e.solved).length;
  const totalExercises = LESSONS.reduce((n, l) => n + l.exercises.length, 0);

  const byLab = progress.runs.reduce<Record<string, number>>((acc, r) => {
    acc[r.lab] = (acc[r.lab] ?? 0) + 1;
    return acc;
  }, {});

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deep-learning-theory-explorer-progress.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-lab-100">Your dashboard</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
            Everything here lives in this browser&apos;s local storage. No account, no telemetry, no server calls.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={download}>
            export JSON
          </Button>
        </div>
      </header>

      {persistenceFailed && (
        <Callout tone="warning" title="This record is not being saved">
          The browser refused to write to its local storage, so everything on this page lives in this tab only and will
          be lost when you close it. Export the record if you want a copy. Private browsing modes and full storage are
          the usual cause.
        </Callout>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Lessons completed" value={`${lessonsDone} / ${LESSONS.length}`} tone={lessonsDone === LESSONS.length ? 'good' : 'default'} />
        <Stat label="Exercises worked" value={`${exerciseCount} / ${totalExercises}`} />
        <Stat
          label="Quiz accuracy"
          value={Number.isFinite(score.accuracy) ? `${(100 * score.accuracy).toFixed(0)}%` : '—'}
          hint={`${score.correct} correct of ${score.attempted} attempted`}
        />
        <Stat label="Experiment runs" value={progress.runs.length} hint={`${Object.keys(byLab).length} laboratories used`} />
        <Stat label="Equations viewed" value={`${progress.equationsViewed.length} / ${EQUATIONS.length}`} />
      </div>

      <Panel
        title="Your next step"
        subtitle="Derived from what you have read, worked, answered and run — not a fixed list."
        right={
          <div className="flex items-center gap-2">
            <Badge tone={plan.progress.fraction > 0.99 ? 'good' : 'default'}>
              {plan.progress.fraction === 0
                ? 'not started'
                : plan.progress.fraction > 0.99
                  ? 'finished'
                  : `${Math.round(100 * plan.progress.fraction)}% through`}
            </Badge>
          </div>
        }
      >
        {plan.next ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="mono text-[12px] text-lab-500">1.</span>
              <Badge tone="good">{studyStepLabel(plan.next.kind)}</Badge>
              <Link to={plan.next.to} className="text-[15px] font-semibold text-lab-100 underline decoration-dotted decoration-signal-blue/60">
                {plan.next.title}
              </Link>
            </div>
            <p className="text-[12.5px] leading-relaxed text-lab-300">{plan.next.detail}</p>
            <p className="text-[11.5px] text-lab-400">
              <span className="text-lab-500">Why now: </span>
              {plan.next.reason}.
            </p>
            <Link
              to={plan.next.to}
              className="inline-block rounded border border-signal-blue/50 bg-signal-blue/15 px-3 py-1.5 text-[12px] text-signal-blue transition-colors hover:bg-signal-blue/25"
            >
              go there →
            </Link>
            {plan.steps.length > 1 && (
              <div className="mt-3 border-t border-lab-800 pt-3">
                <div className="mb-1.5 text-[10.5px] uppercase tracking-wider text-lab-500">Then, in order</div>
                <ol className="space-y-1">
                  {plan.steps.slice(1, 6).map((s, i) => (
                    <li key={s.id} className="text-[12px] leading-snug">
                      <span className="mono mr-2 text-lab-500">{i + 2}.</span>
                      <Link to={s.to} className="text-lab-200 underline decoration-dotted decoration-lab-600 hover:text-signal-blue">
                        {s.title}
                      </Link>
                      <span className="ml-1.5 text-[10.5px] uppercase tracking-wider text-lab-500">{studyStepLabel(s.kind)}</span>
                    </li>
                  ))}
                </ol>
                {plan.totalSteps > 6 && (
                  <p className="mt-1.5 text-[11px] text-lab-500">
                    and {plan.totalSteps - 6} more after that.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[12.5px] text-lab-300">Nothing is outstanding. Open the theory atlas to check a claim.</p>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            ['Lessons read', `${plan.progress.lessonsRead} / ${plan.progress.lessonsTotal}`],
            ['Exercises worked', `${plan.progress.exercisesSolved} / ${plan.progress.exercisesTotal}`],
            ['Questions answered', `${plan.progress.questionsAnswered} / ${plan.progress.questionsTotal}`],
            ['Equations opened', `${plan.progress.equationsViewed} / ${plan.progress.equationsTotal}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded border border-lab-700 bg-lab-850/50 px-3 py-2">
              <div className="text-[10.5px] uppercase tracking-wider text-lab-400">{label}</div>
              <div className="mono mt-0.5 text-[14px] text-lab-100">{value}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Your current experiment"
        subtitle="The setup every laboratory is using right now. Change it in any laboratory, or here."
        right={<Badge tone={shared.isCustom ? 'good' : 'default'}>{shared.isCustom ? 'custom' : 'default'}</Badge>}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Activation', shared.setup.activation],
            ['Weight variance C_W', shared.setup.Cw],
            ['Bias variance C_b', shared.setup.Cb],
            ['Depth', shared.setup.depth],
            ['Width', shared.setup.width],
            ['Seed', shared.setup.seed],
            ['Input samples', shared.setup.samples],
            ['Networks per measurement', shared.setup.seeds],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded border border-lab-700 bg-lab-850/50 px-3 py-2">
              <div className="text-[10.5px] uppercase tracking-wider text-lab-400">{label}</div>
              <div className="mono mt-0.5 text-[14px] text-lab-100">{String(value)}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link to="/labs/physics" className="text-[12px] text-signal-blue underline decoration-dotted">
            open the physics laboratory →
          </Link>
          <span className="text-[11.5px] text-lab-400">
            Every laboratory reads this setup, so a change in one is a change in all of them.
          </span>
        </div>
      </Panel>

      <Panel
        title="Your progress is yours"
        subtitle="Stored in this browser only. Take it with you, or put it back."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={download}>
            export JSON
          </Button>
          <Button variant="ghost" onClick={() => fileInput.current?.click()}>
            import from a file
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-label="a progress record exported from this application"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const text = await file.text();
              const outcome = importJson(text);
              setImportMessage(outcome.ok ? outcome.message : `Could not import: ${outcome.message}`);
            }}
          />
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-[12px] text-lab-400">
            or paste a progress record
          </summary>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={4}
            placeholder='{"version": 1, "lessons": { ... }'
            aria-label="a progress record to import"
            className="mono mt-2 w-full rounded border border-lab-600 bg-lab-900 px-2 py-1.5 text-[11.5px] text-lab-100 focus:border-signal-blue focus:outline-none"
          />
          <Button
            variant="ghost"
            onClick={() => {
              const outcome = importJson(pasted);
              setImportMessage(outcome.ok ? outcome.message : `Could not import: ${outcome.message}`);
              if (outcome.ok) setPasted('');
            }}
            disabled={pasted.trim() === ''}
          >
            import this record
          </Button>
        </details>
        {importMessage && (
          <p
            role="status"
            aria-live="polite"
            className="mt-2 rounded border border-lab-700 bg-lab-850/60 px-2.5 py-1.5 text-[12px] text-lab-200"
          >
            {importMessage}
          </p>
        )}
        <p className="mt-2 text-[11.5px] leading-relaxed text-lab-400">
          An imported record is checked before it is used: unknown fields are dropped, malformed entries are skipped, and
          a record from a different version is refused rather than half-applied.
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Lesson progress" subtitle={`${bookmarks} bookmarked · ${LESSONS.length - lessonsDone} still open · mark lessons complete from the lesson reader.`}>
          <Table
            head={['Lesson', 'Status', 'Chapter', 'Actions']}
            rows={LESSONS.map((l) => {
              const s = progress.lessons[l.id];
              const planned = plan.lessons.find((x) => x.id === l.id);
              return [
                <Link key={l.id} to={`/lessons/${l.id}`}>
                  {l.order}. {l.title}
                </Link>,
                <span key="s" className="flex flex-wrap items-center gap-1">
                  {s?.completed ? <Badge tone="good">completed</Badge> : <Badge>not completed</Badge>}
                  {s?.bookmarked ? <Badge tone="warn">bookmarked</Badge> : null}
                  {!s?.completed && planned && !planned.unlocked ? (
                    <Badge>locked</Badge>
                  ) : null}
                </span>,
                l.chapter,
                s?.lastViewedAt ? <span key="t" className="mono text-[11px]">{new Date(s.lastViewedAt).toLocaleString()}</span> : '—',
              ];
            })}
          />
        </Panel>

        <div className="space-y-4">
          <Panel title="Experiment log" subtitle="The most recent 100 runs, newest first.">
            {progress.runs.length === 0 ? (
              <p className="text-[12.5px] text-lab-400">
                No runs yet. Try the <Link to="/labs/physics">physics lab</Link> — every run records its settings, seed
                and headline numbers here.
              </p>
            ) : (
              <ul className="space-y-2">
                {progress.runs.slice(0, 12).map((run, i) => (
                  <li key={i} className="rounded border border-lab-700 bg-lab-850/40 p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="default">{run.lab}</Badge>
                      <span className="text-[12.5px] text-lab-100">{run.id}</span>
                      <span className="mono ml-auto text-[11px] text-lab-500">{new Date(run.ranAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="mono mt-1 text-[11.5px] text-lab-300">{run.summary}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {Object.entries(run.metrics).map(([k, v]) => (
                        <span key={k} className="mono rounded border border-lab-700 px-1.5 py-0.5 text-[11px] text-lab-300">
                          {k} = {String(v)}
                        </span>
                      ))}
                    </div>
                    {/*
                      A run that cannot be repeated is a diary rather than a
                      record, so the settings it was made with are kept, and
                      can be brought back.
                    */}
                    {run.setup && Object.keys(run.setup).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Button variant="ghost" onClick={() => shared.patch(run.setup ?? {})}>
                          restore these settings
                        </Button>
                        <Link to={`/labs/${run.lab === 'physics' ? 'physics' : run.lab}`} className="text-[11.5px]">
                          open the laboratory →
                        </Link>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Suggested experiments" subtitle="Things worth measuring, whichever lessons you have read.">
            <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-lab-300">
              <li>
                · <Link to="/labs/initialization">Lab A</Link>: locate the critical C_W of an activation you have not tried
                (try GELU and watch the scanner report two roots).
              </li>
              <li>
                · <Link to="/labs/width-depth">Lab C</Link>: hold L/n fixed while doubling both and confirm the
                fluctuation size stays put.
              </li>
              <li>
                · <Link to="/labs/ntk">Lab D</Link>: compare the empirical NTK with the closed-form prediction at three
                widths and read off the convergence rate.
              </li>
              <li>
                · <Link to="/diagnostics">Self-test</Link>: check that this browser reproduces the theory before you
                trust a number on screen.
              </li>
            </ul>
            <Callout tone="limitation" title="What this dashboard does not do">
              It stores no personal data, sends nothing anywhere, and cannot be recovered if you clear site data — use the
              export button if you want a copy.
            </Callout>
          </Panel>
        </div>

        <Panel
          title="Erase this record"
          subtitle="Local storage only. There is no server copy and no undo."
          right={
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              reset progress
            </Button>
          }
        >
          <p className="text-[12.5px] leading-relaxed text-lab-400">
            Clears every lesson, exercise, note, quiz answer, equation you have viewed and experiment you have run from
            this browser. Export the record first if you want to keep it.
          </p>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Erase your progress?"
        body="Every lesson, exercise, note, quiz answer and experiment run stored in this browser will be deleted. This cannot be undone, and there is no copy anywhere else."
        confirmLabel="erase everything"
        cancelLabel="keep it"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          reset();
          setConfirmReset(false);
        }}
      />
    </div>
  );
}
