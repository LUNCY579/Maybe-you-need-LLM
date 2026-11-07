import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Panel, Bullets, Button, Callout, Citation, Prose, Badge } from '../components/ui';
import { GuidedExercise } from '../components/GuidedExercise';
import { EquationBlock, Rich } from '../components/Math';
import { LESSONS, LESSON_BY_ID } from '../content/lessons';
import { CONCEPTS } from '../content/concepts';
import type { ContentBlock } from '../content/types';
import { useProgress } from '../lib/persistence';
import { LessonFigure } from '../components/LessonFigure';

function Block({ block }: { block: ContentBlock }) {
  switch (block.kind) {
    case 'p':
      return (
        <p className="text-[13.5px] leading-relaxed text-lab-200">
          <Rich text={block.text} />
        </p>
      );
    case 'eq':
      return <EquationBlock tex={block.tex} caption={block.caption} refLabel={block.ref} />;
    case 'list':
      return <Bullets items={block.items} ordered={block.ordered} />;
    case 'callout':
      return (
        <Callout tone={block.tone} title={block.title}>
          <Rich text={block.text} />
        </Callout>
      );
    case 'ref':
      return (
        <div>
          <Citation label={block.label} note={block.note} />
        </div>
      );
    case 'figure':
      return <LessonFigure id={block.figure} />;
    default:
      return null;
  }
}

export function LessonsPage() {
  const { progress, setLesson } = useProgress();

  /*
   * The index is a map of the course, not a list of pages: it says where the
   * reader is, what is still ahead, and which lesson to open next.
   */
  const lessonsRead = LESSONS.filter((l) => progress.lessons[l.id]?.completed).length;
  const exercisesTotal = LESSONS.reduce((n, l) => n + l.exercises.length, 0);
  const exercisesSolved = LESSONS.reduce(
    (n, l) => n + l.exercises.filter((_, i) => progress.exercises[`${l.id}:${i}`]?.solved).length,
    0,
  );
  const read = new Set(LESSONS.filter((l) => progress.lessons[l.id]?.completed).map((l) => l.id));
  const unlocked = (lesson: (typeof LESSONS)[number]) => lesson.prerequisites.every((p) => read.has(p));
  const next = LESSONS.find((l) => !read.has(l.id) && unlocked(l));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[20px] font-semibold text-lab-100">Curriculum</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
          Ten lessons, in dependency order. Each one moves from intuition to definitions, then to an experiment that
          computes something, then to a verification exercise. Progress is stored locally in your browser.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={lessonsRead === LESSONS.length ? 'good' : 'default'}>
            {lessonsRead} of {LESSONS.length} read
          </Badge>
          <Badge tone={exercisesSolved === exercisesTotal ? 'good' : 'default'}>
            {exercisesSolved} of {exercisesTotal} exercises worked
          </Badge>
          {next && (
            <Link
              to={`/lessons/${next.id}`}
              className="rounded border border-signal-blue/50 bg-signal-blue/15 px-2.5 py-1 text-[11.5px] text-signal-blue"
            >
              next: lesson {next.order}
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Lessons" subtitle="Click a lesson to read it. Prerequisites are listed on each lesson page.">
          <ol className="space-y-2">
            {LESSONS.map((lesson) => {
  const state = progress.lessons[lesson.id];
              const isNext = next?.id === lesson.id;
              const blocked = lesson.prerequisites.filter((p) => !read.has(p));
              const solved = lesson.exercises.filter((_, i) => progress.exercises[`${lesson.id}:${i}`]?.solved).length;
              return (
                <li
                  key={lesson.id}
                  className={`rounded border p-3 ${
                    isNext ? 'border-signal-blue/50 bg-signal-blue/5' : 'border-lab-700 bg-lab-850/40'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mono text-[12px] text-lab-500">{String(lesson.order).padStart(2, '0')}</span>
                    <Link to={`/lessons/${lesson.id}`} className="text-[13.5px] font-medium text-lab-100 hover:text-signal-blue">
                      {lesson.title}
                    </Link>
                    {isNext && <Badge tone="good">next up</Badge>}
                    {state?.completed && <Badge tone="good">completed</Badge>}
                    {state?.bookmarked && <Badge tone="warn">bookmarked</Badge>}
                    {blocked.length > 0 && (
                      <Badge tone="warn">
                        needs lesson{blocked.length === 1 ? '' : 's'} {blocked
                          .map((p) => LESSONS.find((l) => l.id === p)?.order)
                          .filter((n): n is number => n !== undefined)
                          .join(', ')}
                      </Badge>
                    )}
                    <span className="ml-auto flex gap-1.5">
                      <Badge>{lesson.chapter}</Badge>
                      <Badge>{lesson.minutes} min</Badge>
                      <Badge tone={lesson.tier === 'advanced' ? 'warn' : lesson.tier === 'core' ? 'good' : 'default'}>
                        {lesson.tier}
                      </Badge>
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-lab-300">{lesson.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button variant="ghost" onClick={() => setLesson(lesson.id, { completed: !state?.completed })}>
                      {state?.completed ? 'mark as not completed' : 'mark as completed'}
                    </Button>
                    {lesson.exercises.length > 0 && (
                      <span className="text-[11px] text-lab-500">
                        {solved} of {lesson.exercises.length} exercises worked
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel title="Threads through the course" subtitle="Three questions that recur in every chapter.">
          <div className="space-y-3 text-[13px] leading-relaxed text-lab-200">
            <p>
              <strong className="text-lab-100">1. Does the signal survive depth?</strong> The kernel recursion answers
              this. Off criticality the answer is no: signals explode or die exponentially.
            </p>
            <p>
              <strong className="text-lab-100">2. How large are the deviations from the ideal (Gaussian, infinite-width) picture?</strong>{' '}
              They are controlled by the depth-to-width ratio L/n, which is why width is a computational tool and depth a
              modelling one.
            </p>
            <p>
              <strong className="text-lab-100">3. What does training change?</strong> The NTK says how outputs move. Its
              movement — the dNTK — is what distinguishes a neural network from a kernel method.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function LessonReader() {
  const { lessonId = '' } = useParams();
  const lesson = LESSON_BY_ID[lessonId];
  const { progress, setLesson, setExercise, setNote, persistenceFailed } = useProgress();
  const [openExercise, setOpenExercise] = useState<number | null>(null);

  if (!lesson) {
    return (
      <Panel title="Lesson not found">
        <p className="text-[13px] text-lab-300">
          That lesson does not exist. <Link to="/lessons">Back to the lesson index.</Link>
        </p>
      </Panel>
    );
  }

  const state = progress.lessons[lesson.id];
  const note = progress.notes[lesson.id] ?? '';
  const next = LESSONS.find((l) => l.order === lesson.order + 1);
  const prereqLessons = lesson.prerequisites.map((id) => LESSON_BY_ID[id]).filter(Boolean);
  // the atlas concepts that point at this lesson
  const lessonConcepts = CONCEPTS.filter((c) =>
    c.see.some((s) => s.to === `/lessons/${lesson.id}`),
  );

  return (
    <div className="space-y-5">
      <header className="card p-5">
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-lab-400">
          <Link to="/lessons">Curriculum</Link>
          <span>/</span>
          <span>Lesson {lesson.order}</span>
          <Badge>{lesson.chapter}</Badge>
          <Badge>{lesson.minutes} min read</Badge>
          <Badge tone={lesson.tier === 'advanced' ? 'warn' : lesson.tier === 'core' ? 'good' : 'default'}>{lesson.tier}</Badge>
        </div>
        <h1 className="mt-2 text-[20px] font-semibold leading-snug text-lab-100">{lesson.title}</h1>
        <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-lab-300">{lesson.summary}</p>
        {/*
          The compiled textbook ships beside the hub; the slug is the same rule
          the textbook compiler applies to its headings.
        */}
        <p className="mt-1 text-[12.5px]">
          <a
            className="text-signal-blue no-underline hover:underline"
            href={`../hub/textbooks/deep-learning-theory-explorer.html#lesson-${lesson.order}-${lesson.title
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .trim()
              .replace(/\s+/g, '-')}`}
          >
            This lesson in the textbook →
          </a>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setLesson(lesson.id, { completed: !state?.completed })}>
            {state?.completed ? 'completed ✓' : 'mark completed'}
          </Button>
          <Button variant="ghost" onClick={() => setLesson(lesson.id, { bookmarked: !state?.bookmarked })}>
            {state?.bookmarked ? 'bookmarked ★' : 'bookmark'}
          </Button>
          {lesson.experiment && (
            <Link
              to={lesson.experiment.route}
              className="rounded border border-signal-blue/50 bg-signal-blue/15 px-3 py-1.5 text-[12px] text-signal-blue"
            >
              open the experiment →
            </Link>
          )}
          {(lesson.alsoExperiments ?? []).map((e) => (
            <Link
              key={e.route}
              to={e.route}
              className="rounded border border-lab-700 bg-lab-850/60 px-3 py-1.5 text-[12px] text-lab-300 transition-colors hover:border-signal-blue hover:text-signal-blue"
            >
              another experiment →
            </Link>
          ))}
        </div>
      </header>

      {prereqLessons.length > 0 && (
        <div className="text-[12px] text-lab-400">
          Prerequisites:{' '}
          {prereqLessons.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <Link to={`/lessons/${p.id}`}>{p.title}</Link>
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <article className="space-y-5">
          {lesson.sections.map((section) => (
            <Panel key={section.heading} title={section.heading}>
              <Prose>
                {section.blocks.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </Prose>
            </Panel>
          ))}

          <Panel
            title="Exercises"
            subtitle="Answers are derivable; the numerical ones are checked against a live computation made by the same code the laboratories run."
          >
            <ol className="space-y-2">
              {lesson.exercises.map((ex, i) => (
                <li key={i} className="rounded border border-lab-700 bg-lab-850/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] leading-relaxed text-lab-200">
                      <Badge tone="default">{ex.kind}</Badge> <Rich text={ex.prompt} />
                    </p>
                    <Button variant="ghost" onClick={() => setOpenExercise(openExercise === i ? null : i)}>
                      {openExercise === i ? 'hide answer' : 'show answer'}
                    </Button>
                  </div>
                  {ex.computed && (
                    <GuidedExercise
                      exercise={ex}
                      solved={Boolean(progress.exercises[`${lesson.id}:${i}`]?.solved)}
                      onSolved={(correct) => {
                        if (correct) setExercise(lesson.id, i, true);
                      }}
                    />
                  )}
                  {/*
                    The answer is always in the document; on screen it is folded
                    away until the reader asks for it, and on paper it is always
                    there, because a printed exercise sheet without its answers
                    is a sheet you cannot study from.
                  */}
                  <div
                    className={`mt-2 rounded border border-signal-green/40 bg-signal-green/10 p-2.5 text-[12.5px] leading-relaxed text-lab-100 ${
                      openExercise === i ? '' : 'hidden print:block'
                    }`}
                  >
                    <Rich text={ex.answer} />
                    {ex.hint && (
                      <p className="mt-1 text-[11.5px] text-lab-300">
                        Hint: <Rich text={ex.hint} />
                      </p>
                    )}
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-[11.5px] text-lab-400 print:hidden">
                    <input
                      type="checkbox"
                      checked={Boolean(progress.exercises[`${lesson.id}:${i}`]?.solved)}
                      onChange={(e) => setExercise(lesson.id, i, e.target.checked)}
                    />
                    I worked through this one
                  </label>
                </li>
              ))}
            </ol>
          </Panel>
        </article>

        <aside className="space-y-4">
          <Panel title="Learning objectives">
            <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-lab-200">
              {lesson.objectives.map((o) => (
                <li key={o} className="flex gap-2">
                  <span className="text-signal-green">▸</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {(lesson.experiment || (lesson.alsoExperiments ?? []).length > 0) && (
            <Panel title="Experiment for this lesson">
              {lesson.experiment && (
                <>
                  <p className="text-[12.5px] leading-relaxed text-lab-300">{lesson.experiment.note}</p>
                  <Link to={lesson.experiment.route} className="mt-2 inline-block text-[12px]">
                    open →
                  </Link>
                </>
              )}
              {(lesson.alsoExperiments ?? []).map((e) => (
                <p key={e.route} className="mt-2 text-[12.5px] leading-relaxed text-lab-300">
                  {e.note}{' '}
                  <Link to={e.route} className="text-[12px]">
                    open →
                  </Link>
                </p>
              ))}
            </Panel>
          )}

          <Panel
            title="Your notes"
            subtitle="Private, stored in this browser, and printed with the lesson if you print it."
          >
            <textarea
              value={note}
              onChange={(e) => setNote(lesson.id, e.target.value)}
              placeholder="What surprised you? What would you ask about?"
              aria-label={`your notes on lesson ${lesson.order}`}
              /* The box grows with the note, so a printed lesson carries the
                 whole of it rather than the first five lines. */
              rows={Math.max(5, Math.ceil(note.length / 58))}
              className="w-full rounded border border-lab-600 bg-lab-900 px-2 py-1.5 text-[12.5px] leading-relaxed text-lab-100 placeholder:text-lab-500 focus:border-signal-blue focus:outline-none"
            />
            <p className={`mt-1 text-[11px] ${persistenceFailed ? 'text-signal-red' : 'text-lab-500'}`}>
              {persistenceFailed
                ? 'Not saved: this browser refused to store it. The note is in this tab only, and it will be lost when you close it.'
                : 'Saved as you type. Nothing is sent anywhere.'}
            </p>
          </Panel>

          {lessonConcepts.length > 0 && (
            <Panel title="Concepts in the atlas" subtitle="The ideas this lesson develops, and where they sit.">
              <ul className="space-y-1.5">
                {lessonConcepts.map((c) => (
                  <li key={c.id} className="text-[12.5px] leading-snug">
                    <Link to="/atlas" className="text-lab-100 underline decoration-dotted decoration-signal-blue/60">
                      {c.name}
                    </Link>
                    <span className="ml-1.5 text-[10.5px] text-lab-500">{c.ref}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] leading-snug text-lab-400">
                <Link to="/atlas" className="text-signal-blue underline decoration-dotted">
                  open the theory atlas →
                </Link>
              </p>
            </Panel>
          )}

          <Panel title="Source">
            <ul className="space-y-1.5">
              {lesson.citations.map((c) => (
                <li key={c.label + c.note}>
                  <Citation label={c.label} note={c.note} />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11.5px] leading-snug text-lab-400">
              Citations point at the source for the mathematical statements; the prose and the experiments are original
              to this app.
            </p>
          </Panel>

          {next && (
            <Panel title="Next">
              <Link to={`/lessons/${next.id}`} className="text-[13px]">
                {next.order}. {next.title} →
              </Link>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
