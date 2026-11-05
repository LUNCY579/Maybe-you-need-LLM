import { useMemo, useRef, useState } from 'react'
import { navigate } from '../app/router'
import { LESSONS, questionById } from '../content/lessons'
import { useProgress } from '../store/progress'
import { deriveAchievements, readProgress, serializeProgress } from '../store/progressState'
import { nextActions, masteredLessonCount } from '../content/guidance'
import { reviewSummary } from '../content/review'
import { retentionSummary } from '../content/retention'
import { LEITNER_INTERVALS_DAYS } from '../content/spacing'
import { parseProject, serializeProject, useProject } from '../store/project'
import { Badge, Button, ConfirmButton, LiveRegion, Panel, ProgressBar, StatTile } from '../ui/primitives'
import { PARTS } from '../content/book'
import { useTheme } from '../store/theme'

export function DashboardPage() {
  const progress = useProgress()
  const { state } = progress
  const theme = useTheme()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const { state: projectState, setState: setProjectState } = useProject([])

  const achievements = deriveAchievements(progress)
  const lastLesson = state.lastLessonSlug ? LESSONS.find((lesson) => lesson.slug === state.lastLessonSlug) : undefined
  const attempts = [...state.quizAttempts].reverse()
  const bookmarked = LESSONS.filter((lesson) => state.bookmarks.includes(lesson.slug))
  const review = useMemo(() => reviewSummary(state), [state])
  const retention = useMemo(() => retentionSummary(state), [state])
  const mastered = useMemo(() => masteredLessonCount(state), [state])
  const actions = useMemo(() => nextActions(state), [state])

  const download = () => {
    // Progress and the project workspace are exported together so that a
    // single file restores the whole student state.
    const payload = {
      ...JSON.parse(serializeProgress(state)),
      project: JSON.parse(serializeProject(projectState)),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'agentic-ai-academy-progress.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const onImport = async (file: File) => {
    const text = await file.text()
    const read = readProgress(text)
    if (!read.recognised) {
      // The file is not a progress export. Importing it would replace the
      // student's history with an empty one and call it a success.
      setImportMessage('That file could not be read as a progress export, so nothing was imported.')
      return
    }
    const parsed = read.state
    progress.importProgress(parsed)
    let projectRestored = 0
    try {
      const raw = JSON.parse(text) as { project?: unknown }
      if (raw.project) {
        const parsedProject = parseProject(JSON.stringify(raw.project))
        setProjectState(parsedProject)
        projectRestored = Object.keys(parsedProject.checklist).length
      }
    } catch {
      // A file without a project section is still a valid progress export.
    }
    setImportMessage(
      `Imported ${parsed.completedLessons.length} completed lessons, ${parsed.quizAttempts.length} quiz attempts${
        projectRestored > 0 ? ` and ${projectRestored} project milestone(s)` : ''
      }.`,
    )
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Your dashboard</h1>
        <p className="text-muted text-sm">
          Progress is stored in this browser only. Export it to move between machines, or import a previous export to restore your history.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Lessons complete" value={`${progress.completedCount}/${progress.totalLessons}`} hint={`${Math.round(progress.completionRatio * 100)}% of the released curriculum`} />
        <StatTile label="Lessons mastered" value={`${mastered}/${LESSONS.length}`} hint="Objectives ticked and questions answered" />
        <StatTile
          label="Retained"
          value={`${Math.round(retention.rate * 100)}%`}
          hint={`${retention.retained} of ${retention.learned + retention.notYetLearned} attempted question(s)`}
        />
        <StatTile label="Due for review" value={String(review.due)} hint={review.due > 0 ? 'Questions whose box says they are due' : 'Nothing outstanding'} />
      </div>

      {/*
        The retention panel.

        The review queue answers "what do I do now?". This answers "how much
        of this have I actually learned?", which is a different question — and
        the box distribution is the most direct evidence the Leitner schedule
        produces, because it shows a concept climbing out of the "needs work"
        box over successive reviews.
      */}
      <Panel title="What you have retained" subtitle={retention.summary}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-1.5" role="img" aria-label={retention.summary}>
            {retention.boxes.map((count, box) => {
              const height = 8 + Math.min(34, count * 5)
              const due = box === 0
              return (
                <div key={box} className="flex w-10 flex-col items-center gap-1">
                  <span className="text-muted text-[10px]">{count > 0 ? count : ''}</span>
                  <div
                    className="w-full rounded-t"
                    style={{
                      height,
                      minHeight: 6,
                      background: due ? 'rgba(251,113,133,0.55)' : 'linear-gradient(180deg, var(--accent), var(--accent-2))',
                      opacity: count === 0 ? 0.18 : 1,
                    }}
                  />
                  <span className="text-muted text-[9px]">
                    {due ? 'now' : `${LEITNER_INTERVALS_DAYS[box]}d`}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-muted text-[11px] leading-relaxed">
            Each bar is a review box: the leftmost is due immediately, and the further right a question sits the longer before it comes back. A question
            climbs a box each time it is answered correctly and falls back the moment it is not.
            {retention.fragile > 0
              ? ` ${retention.fragile} question(s) were answered correctly once and are due again - those are the ones worth a second look.`
              : ''}
          </p>
          {retention.consolidated > 0 ? (
            <p className="text-muted text-[11px] leading-relaxed">
              <strong className="text-strong">{retention.consolidated}</strong> question(s) have climbed past the middle of the schedule. That
              material is consolidating rather than slipping, which is the part of this course you can stop worrying about.
            </p>
          ) : null}
        </div>
      </Panel>

      <Panel
        title="What to do next"
        subtitle="Derived from your own activity. The order is fixed, so the top item is always the most useful thing you can do right now."
      >
        <ol className="space-y-2">
          {actions.map((action, index) => (
            <li key={action.id} className="flex flex-wrap items-start justify-between gap-3 border-b pb-2 text-sm last:border-b-0 last:pb-0" style={{ borderColor: 'var(--border-soft)' }}>
              <div className="min-w-0 flex-1">
                <span className="text-muted mr-2 font-mono text-[11px]">{index + 1}.</span>
                <span className="font-medium">{action.title}</span>
                <p className="text-muted mt-0.5 text-xs leading-relaxed">{action.detail}</p>
              </div>
              {/*
                The button says "Go", so its accessible name has to say what
                it goes to. A list of five buttons all named "Go" tells a
                screen-reader user nothing, and the same is true for anyone
                scanning the list with the keyboard.
              */}
              <Button
                size="sm"
                variant={action.priority === 'high' ? 'primary' : 'secondary'}
                aria-label={`Go: ${action.title}`}
                onClick={() => navigate(action.route)}
              >
                Go
              </Button>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Progress" subtitle="Completion by part of the textbook.">
          <div className="space-y-3">
            {PARTS.map((part) => {
              const lessons = LESSONS.filter((lesson) => lesson.part === part.id)
              if (lessons.length === 0) return null
              const done = lessons.filter((lesson) => progress.isCompleted(lesson.slug)).length
              return (
                <div key={part.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span>
                      Part {part.order} · {part.title}
                    </span>
                    <span className="text-muted">
                      {done}/{lessons.length}
                    </span>
                  </div>
                  <ProgressBar value={lessons.length === 0 ? 0 : done / lessons.length} label={`${part.title} progress`} />
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {lastLesson ? (
              <Button variant="primary" size="sm" onClick={() => navigate(`/lesson/${lastLesson.slug}`)}>
                Continue: {lastLesson.title}
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => navigate('/lesson/what-agentic-llms-are')}>
                Start lesson 1
              </Button>
            )}
            <Button size="sm" onClick={() => navigate('/assessments')}>
              Quiz centre
            </Button>
            <Button size="sm" onClick={() => navigate('/project')}>
              Final project
            </Button>
          </div>
        </Panel>

        <Panel title="Milestones" subtitle="Derived from your activity; nothing is stored twice.">
          <ul className="space-y-3">
            {achievements.map((achievement) => (
              <li key={achievement.id} className="text-xs">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Badge tone={achievement.achieved ? 'emerald' : 'neutral'}>{achievement.achieved ? 'achieved' : 'in progress'}</Badge>
                    {achievement.title}
                  </span>
                  <span className="text-muted">{Math.round(achievement.progress * 100)}%</span>
                </div>
                <p className="text-muted">{achievement.description}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent quiz attempts" subtitle="Newest first. The latest attempt per question determines your accuracy.">
          {attempts.length === 0 ? (
            <p className="text-muted text-sm">No attempts yet. Every lesson ends with an assessment — start with lesson 1.</p>
          ) : (
            <ul tabIndex={0} aria-label="Recent quiz attempts" className="thin-scroll max-h-80 space-y-2 overflow-y-auto pr-1 focus-ring">
              {attempts.slice(0, 20).map((attempt) => {
                const question = questionById(attempt.questionId)
                return (
                  <li key={`${attempt.questionId}-${attempt.at}`} className="surface-2 rounded-lg border p-2 text-xs" style={{ borderColor: 'var(--border-soft)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={attempt.correct ? 'emerald' : 'rose'}>{attempt.correct ? 'correct' : 'incorrect'}</Badge>
                      <span className="text-muted">{new Date(attempt.at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1">{question?.prompt ?? attempt.questionId}</p>
                    <p className="text-muted mt-1">
                      {question?.source.label} ·{' '}
                      <button className="focus-ring underline" onClick={() => navigate(`/lesson/${attempt.lessonSlug}`)}>
                        revisit lesson
                      </button>
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Bookmarks" subtitle="Lessons you flagged for later.">
            {bookmarked.length === 0 ? (
              <p className="text-muted text-sm">No bookmarks yet. Use the bookmark button inside any lesson.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {bookmarked.map((lesson) => (
                  <li key={lesson.slug} className="flex items-center justify-between gap-2">
                    <span>{lesson.title}</span>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/lesson/${lesson.slug}`)}>
                      Open
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Data" subtitle="Everything is local; you own the file.">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={download}>
                Export progress JSON
              </Button>
              <Button size="sm" onClick={() => fileRef.current?.click()}>
                Import progress JSON
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                aria-label="Import progress file"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void onImport(file)
                  event.target.value = ''
                }}
              />
              <ConfirmButton
                label="Reset progress"
                confirmLabel="Yes, reset everything"
                onConfirm={() => {
                  progress.resetProgress()
                  setImportMessage('All local progress, bookmarks and quiz history have been reset.')
                }}
              />
            </div>
            {importMessage ? <p className="text-muted mt-2 text-xs">{importMessage}</p> : null}
            <LiveRegion message={importMessage ?? ''} />
            <p className="text-muted mt-2 text-[11px]">
              Theme preference is stored separately ({theme.theme}). Progress schema version {state.version}
              {state.updatedAt ? ` · last updated ${new Date(state.updatedAt).toLocaleString()}` : ''}.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
