import { useMemo, useRef, useState } from 'react'
import { Link } from '../components/layout/CourseLink.tsx'
import { LESSONS, MODULES, getLesson } from '../content/curriculum'
import { QUIZ_BANK, quizStats } from '../content/quiz'
import { useProgress } from '../state/hooks'
import { useNow } from '../state/useNow'
import { downloadProgress } from '../core/progress'
import { summariseMastery } from '../core/mastery'
import { countDueForReview } from '../core/spacedRepetition'
import { Badge, Button, Callout, Panel, ProgressBar, Stat } from '../components/ui/primitives'
import { LearningPathPanel } from '../components/lesson/LearningPathPanel'
import { StudyPlanPanel } from '../components/lesson/StudyPlanPanel'
import { ConceptProgressPanel } from '../components/lesson/ConceptProgressPanel'

export function DashboardPage() {
  const { progress, summary, reset, removeConfig, importJson, clearAll, exportJson, isComplete, reviews } = useProgress()
  const now = useNow()
  const [message, setMessage] = useState<{ tone: 'teal' | 'rose' | 'amber'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const stats = quizStats()

  /**
   * How many questions the spaced-repetition scheduler says are ready.
   *
   * A question that has never been reviewed counts as due, so the queue is
   * never empty for a reader who has just started.
   */
  /*
   * How many questions have been learned and are now at risk of being
   * forgotten. A question that has never been asked is not at risk, so it is
   * not counted here: the review session offers it as new material.
   */
  const reviewCounts = useMemo(
    () => countDueForReview(QUIZ_BANK.map((question) => question.id), reviews, now),
    [reviews, now],
  )
  const dueCount = reviewCounts.due
  const unseenCount = reviewCounts.unseen

  const moduleStats = useMemo(
    () =>
      MODULES.map((module) => {
        const lessons = LESSONS.filter((lesson) => lesson.moduleId === module.id)
        const done = lessons.filter((lesson) => isComplete(lesson.id)).length
        const questions = QUIZ_BANK.filter((question) => question.moduleId === module.id)
        const answered = questions.filter((question) => question.id in summary.quizByQuestion)
        const correct = answered.filter((question) => summary.quizByQuestion[question.id]).length
        /*
         * The mastery of the module, from the review record: how many times in
         * a row each question has been recalled, how well it is sticking,
         * and how long ago it was last seen. It is not the same as the
         * accuracy, because a question answered correctly once a week ago
         * is not the same as one recalled correctly four times.
         */
        const mastery = summariseMastery(
          questions.map((question) => question.id),
          reviews,
          now,
        )
        return {
          module,
          lessons: lessons.length,
          done,
          questions: questions.length,
          answered: answered.length,
          correct,
          mastery,
        }
      }),
    [isComplete, summary.quizByQuestion, reviews, now],
  )

  const nextLesson = useMemo(() => {
    const inProgress = LESSONS.find((lesson) => {
      const entry = progress.lessons[lesson.id]
      return entry && !entry.completed
    })
    return inProgress ?? LESSONS.find((lesson) => !isComplete(lesson.id)) ?? LESSONS[0]
  }, [progress.lessons, isComplete])

  const incorrectQuestions = useMemo(
    () => QUIZ_BANK.filter((question) => summary.quizByQuestion[question.id] === false),
    [summary.quizByQuestion],
  )

  const handleImport = async (file: File, mode: 'merge' | 'replace') => {
    const text = await file.text()
    const result = importJson(text, mode)
    if (!result.ok) {
      setMessage({ tone: 'rose', text: result.error ?? 'Import failed.' })
      return
    }
    /*
      A file written by a newer version of the course is read as far as this
      version understands it, and the rest is dropped. The reader is told,
      because a file that silently loses part of itself is worse than one
      that says so.
    */
    setMessage(
      result.newerVersion
        ? {
            tone: 'amber',
            text: `Imported ${file.name} (${mode}), but it was written by version ${result.newerVersion} of the course and this is an older build. Anything it records that this build does not know about was not read.`,
          }
        : { tone: 'teal', text: `Imported ${file.name} (${mode}).` },
    )
  }

  return (
    <div className="animate-rise space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">Learning dashboard</h1>
        <p className="max-w-3xl text-sm text-muted">
          Everything on this page comes from your local progress file. Nothing is transmitted; export it to move between
          machines or to inspect exactly what is stored.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="Lessons completed"
          value={`${summary.lessonsCompleted} / ${LESSONS.length}`}
          tone="teal"
          hint={`${summary.lessonsVisited} visited`}
        />
        <Stat
          label="Quiz accuracy"
          value={`${(summary.accuracy * 100).toFixed(0)}%`}
          tone="indigo"
          hint={`${summary.questionsCorrect} correct of ${summary.questionsAnswered} answered`}
        />
        <Stat
          label="Due for review"
          value={dueCount}
          tone={dueCount > 0 ? 'amber' : 'teal'}
          hint={dueCount > 0 ? 'Spaced-repetition queue' : 'Nothing due yet'}
        />
        <Stat label="Bookmarks" value={summary.bookmarks} tone="amber" hint="Lessons you starred" />
        <Stat label="Time on lessons" value={`${summary.studyMinutes} min`} hint="Approximate, measured while open" />
      </div>

      {dueCount + unseenCount > 0 ? (
        <Panel className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-[16rem] flex-1">
            <p className="font-mono text-[11px] uppercase tracking-wider text-faint">Review</p>
            <p className="mt-1 text-sm text-fg">
              {dueCount > 0
                ? `${dueCount} question${dueCount === 1 ? '' : 's'} ${dueCount === 1 ? 'is' : 'are'} due for review. The schedule follows SM-2: each question comes back just before you would forget it.`
                : `${unseenCount} question${unseenCount === 1 ? '' : 's'} you have not seen yet. A question that has never been asked is not at risk of being forgotten, so it is new material rather than a review — and it is worth answering.`}
            </p>
          </div>
          <Link to="/review" className="no-underline">
            <Button variant="primary" size="sm">
              Start a review session
            </Button>
          </Link>
        </Panel>
      ) : null}

      <Panel className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-[16rem] flex-1">
          <p className="font-mono text-[11px] uppercase tracking-wider text-faint">Continue</p>
          <p className="mt-1 text-sm text-fg">
            Next up:{' '}
            <Link to={`/lessons/${nextLesson.id}`} className="text-indigo hover:underline">
              {nextLesson.title}
            </Link>
          </p>
          <div className="mt-2">
            <ProgressBar
              value={summary.lessonsCompleted}
              max={LESSONS.length}
              tone="indigo"
              ariaLabel={`Course progress: ${summary.lessonsCompleted} of ${LESSONS.length} lessons complete`}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/lessons/${nextLesson.id}`} className="no-underline">
            <Button variant="primary" size="sm">
              Resume lesson
            </Button>
          </Link>
          <Link to="/practice" className="no-underline">
            <Button size="sm">Practice</Button>
          </Link>
        </div>
      </Panel>

      <StudyPlanPanel />

      <LearningPathPanel />

      <ConceptProgressPanel />

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-fg">Progress by module</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {moduleStats.map((entry) => (
            <Panel key={entry.module.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold text-fg">
                  <Link to={`/modules/${entry.module.id}`} className="hover:text-indigo">
                    {entry.module.title}
                  </Link>
                </h3>
                <Badge tone={entry.module.accent}>chapter {entry.module.chapter}</Badge>
              </div>
              <ProgressBar value={entry.done} max={entry.lessons} label={`${entry.done}/${entry.lessons} lessons`} tone="teal" />
              <ProgressBar
                value={entry.correct}
                max={entry.questions}
                label={`${entry.correct}/${entry.questions} questions correct${entry.answered < entry.questions ? ` (${entry.questions - entry.answered} unattempted)` : ''}`}
                tone="indigo"
              />
              <p className="text-[11px] text-faint">
                {entry.mastery.score === null
                  ? 'No questions attempted yet.'
                  : `Mastery ${Math.round(entry.mastery.score * 100)}% — ${entry.mastery.mastered} of ${entry.questions} in good shape.`}
              </p>
            </Panel>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="font-display text-lg font-semibold text-fg">Bookmarks</h2>
          {progress.bookmarks.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              No bookmarks yet. Use the ☆ button on any lesson to pin it here.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {progress.bookmarks.map((id) => {
                const lesson = getLesson(id)
                if (!lesson) return null
                return (
                  <li key={id}>
                    <Link to={`/lessons/${id}`} className="text-indigo hover:underline">
                      {lesson.title}
                    </Link>
                    {isComplete(id) ? <Badge tone="positive" className="ml-2">completed</Badge> : null}
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <h2 className="font-display text-lg font-semibold text-fg">Questions to revisit</h2>
          {incorrectQuestions.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              No incorrect answers recorded. {summary.questionsAnswered === 0 ? 'Take a knowledge check to populate this list.' : 'Nice work.'}
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {incorrectQuestions.slice(0, 8).map((question) => {
                const lesson = getLesson(question.lessonId)
                return (
                  <li key={question.id} className="rounded-xl border border-line bg-panel-2/40 p-2.5">
                    <p className="text-fg">{question.prompt}</p>
                    <p className="mt-1 text-xs text-muted">
                      {lesson ? (
                        <Link to={`/lessons/${lesson.id}`} className="text-indigo hover:underline">
                          Revisit {lesson.title}
                        </Link>
                      ) : null}{' '}
                      · §{question.source.section} p.{question.source.page}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
          {incorrectQuestions.length > 0 ? (
            <Link to="/practice?filter=incorrect" className="mt-3 inline-block no-underline">
              <Button size="sm">Practise incorrect answers</Button>
            </Link>
          ) : null}
        </Panel>
      </div>

      <Panel>
        <h2 className="font-display text-lg font-semibold text-fg">Saved playground configurations</h2>
        {progress.playgroundConfigs.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No configurations saved. Use “Save this configuration” inside any laboratory.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {progress.playgroundConfigs
              .slice()
              .reverse()
              .map((config) => (
                <li key={config.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel-2/40 p-2.5">
                  <div>
                    <p className="text-sm text-fg">{config.name}</p>
                    <p className="font-mono text-[11px] text-faint">
                      {config.lab} · saved {config.savedAt.slice(0, 19).replace('T', ' ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/playground?lab=${config.lab}&config=${config.id}`} className="no-underline">
                      <Button size="sm" variant="ghost">
                        Open
                      </Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => removeConfig(config.id)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </Panel>

      <Panel className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-fg">Export, import and reset</h2>
        <p className="text-sm text-muted">
          The export is a plain JSON document: schema version {progress.version}, {Object.keys(progress.lessons).length}{' '}
          lesson records, {progress.quizzes.length} quiz attempts, {progress.playgroundConfigs.length} saved
          configurations and {Object.keys(progress.notes).length} notes.
        </p>
        {message ? (
          <Callout
            tone={message.tone}
            title={
              message.tone === 'teal' ? 'Done' : message.tone === 'amber' ? 'Read with a caveat' : 'Problem'
            }
          >
            {message.text}
          </Callout>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadProgress(progress)}>Download progress JSON</Button>
          <Button onClick={() => navigator.clipboard?.writeText(exportJson())}>Copy JSON to clipboard</Button>
          <Button onClick={() => fileRef.current?.click()}>Import (merge)…</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Import progress file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImport(file, 'merge')
              event.target.value = ''
            }}
          />
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm('Reset all local progress? This cannot be undone.')) clearAll()
            }}
          >
            Reset everything
          </Button>
        </div>
        <p className="text-xs text-faint">
          Merging never deletes local activity: lessons are unioned, quiz attempts are de-duplicated by timestamp, and
          your notes always win over imported ones. Resetting clears the local record only — export first if you might
          want it back.
        </p>
      </Panel>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-fg">Lesson-by-lesson record</h2>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="bg-panel-2/60 text-xs text-faint">
              <tr>
                <th className="px-3 py-2 font-medium">Lesson</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Quiz</th>
                <th className="px-3 py-2 font-medium">Last visited</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {LESSONS.map((lesson) => {
                const entry = progress.lessons[lesson.id]
                const questions = QUIZ_BANK.filter((question) => question.lessonId === lesson.id)
                const answered = questions.filter((question) => question.id in summary.quizByQuestion)
                const correct = answered.filter((question) => summary.quizByQuestion[question.id]).length
                return (
                  <tr key={lesson.id} className="border-t border-line-soft">
                    <td className="px-3 py-2">
                      <Link to={`/lessons/${lesson.id}`} className="text-indigo hover:underline">
                        {lesson.number}. {lesson.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {entry?.completed ? <Badge tone="positive">complete</Badge> : entry ? <Badge tone="amber">in progress</Badge> : <span className="text-faint">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">
                      {entry ? `${Math.round(entry.secondsSpent / 60)} min` : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">
                      {answered.length === 0 ? '—' : `${correct}/${questions.length}`}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-faint">
                      {entry?.lastVisitedAt ? entry.lastVisitedAt.slice(0, 10) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {entry ? (
                        <Button size="sm" variant="ghost" onClick={() => reset(lesson.id)}>
                          Clear
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-faint">
          {stats.total} quiz items exist across the course; {summary.questionsAnswered} distinct items have been attempted.
        </p>
      </section>
    </div>
  )
}

export default DashboardPage
