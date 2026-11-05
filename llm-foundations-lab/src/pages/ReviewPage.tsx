import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '../components/layout/CourseLink.tsx'
import { QUIZ_BANK, type QuizQuestion, questionTone } from '../content/quiz'
import { getLesson } from '../content/curriculum'
import { Badge, Button, Callout, Panel, Stat } from '../components/ui/primitives'
import { QuestionOptions } from '../components/practice/QuestionOptions'
import { AnswerFeedback } from '../components/practice/AnswerFeedback'
import { useProgress } from '../state/hooks'
import { useNow } from '../state/useNow'
import {
  answerToQuality,
  countDueForReview,
  describeState,
  initialReviewState,
  reviewItem,
  selectDueItems,
  type ReviewState,
} from '../core/spacedRepetition'

/**
 * The review session.
 *
 * The practice page asks a question; this page *schedules* one. Every answer
 * here updates an SM-2 schedule, so the same question comes back when it is
 * about to be forgotten rather than when it happens to be convenient.
 *
 * The session is deliberately short. Twenty questions is the most a review
 * session should ask for, and a learner who cannot finish twenty in a sitting
 * should not be asked to.
 */

const SESSION_LIMIT = 20

/** A day in milliseconds, used for the "due" grouping. */
const DAY = 24 * 60 * 60 * 1000

interface ScheduleEntry {
  question: QuizQuestion
  state: ReviewState
  overdueDays: number
}

export function ReviewPage() {
  const { reviews, recordReview } = useProgress()
  const now = useNow()
  const [session, setSession] = useState<string[]>([])
  const [position, setPosition] = useState(0)
  const [chosen, setChosen] = useState<number | undefined>(undefined)
  const [verdict, setVerdict] = useState<ReviewState | null>(null)
  const [answeredToday, setAnsweredToday] = useState(0)
  const shownAt = useRef(0)

  /* The clock for the next answer restarts whenever the question changes. */
  useEffect(() => {
    shownAt.current = Date.now()
  }, [session, position])

  /** Every question's schedule, ordered by how overdue it is. */
  const schedule = useMemo<ScheduleEntry[]>(() => {
    const entries: ScheduleEntry[] = []
    for (const question of QUIZ_BANK) {
      const state = reviews[question.id] ?? initialReviewState(now)
      entries.push({
        question,
        state,
        overdueDays: (now.getTime() - new Date(state.dueAt).getTime()) / DAY,
      })
    }
    entries.sort((a, b) => b.overdueDays - a.overdueDays)
    return entries
  }, [reviews, now])

  const dueNow = useMemo(
    () => schedule.filter((entry) => entry.overdueDays >= 0),
    [schedule],
  )

  /**
   * The session is built once from what is due. Answering a question removes
   * it from the queue, so the session list is not rebuilt while it is running.
   */
  const startSession = useCallback(() => {
    const ids = selectDueItems(
      Object.fromEntries(
        QUIZ_BANK.map((question) => [question.id, reviews[question.id] ?? initialReviewState(now)]),
      ),
      now,
      SESSION_LIMIT,
    )
    setSession(ids)
    setPosition(0)
    setChosen(undefined)
    setVerdict(null)
    shownAt.current = Date.now()
  }, [reviews, now])

  const currentId = session[position]
  const current = useMemo(
    () => QUIZ_BANK.find((question) => question.id === currentId),
    [currentId],
  )

  const answer = (question: QuizQuestion, choice: number) => {
    if (chosen !== undefined) return
    setChosen(choice)
    const correct = choice === question.correctIndex
    const seconds = (Date.now() - shownAt.current) / 1000
    const quality = answerToQuality(correct, seconds)
    const previous = reviews[question.id] ?? initialReviewState(now)
    const next = reviewItem(previous, quality, new Date())
    recordReview(question.id, quality)
    setVerdict(next)
    setAnsweredToday((count) => count + 1)
  }

  const advance = () => {
    setChosen(undefined)
    setVerdict(null)
    shownAt.current = Date.now()
    setPosition((p) => Math.min(p + 1, session.length))
  }

  /*
   * Two different counts, because they mean two different things.
   *
   * A question that has been learned and is now at its scheduled time is
   * *due for review* — it is at risk of being forgotten, and that is what
   * the review session is for. A question that has never been asked is
   * *new*: it is worth answering, but it is not at risk of anything.
   */
  const counts = useMemo(
    () => countDueForReview(QUIZ_BANK.map((question) => question.id), reviews, now),
    [reviews, now],
  )
  const nextUp = useMemo(() => {
    const future = schedule
      .filter((entry) => entry.overdueDays < 0)
      .sort((a, b) => a.overdueDays - b.overdueDays)
    return future[0]
  }, [schedule])

  const started = session.length > 0

  return (
    <div className="animate-rise space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">Review</h1>
          {counts.due > 0 ? (
            <Badge tone="amber">{counts.due} due for review</Badge>
          ) : counts.unseen > 0 ? (
            <Badge tone="indigo">{counts.unseen} not seen yet</Badge>
          ) : (
            <Badge tone="teal">nothing due</Badge>
          )}
        </div>
        <p className="max-w-3xl text-sm text-muted">
          Each question is scheduled with SM-2, the algorithm behind SuperMemo and Anki. A question you recall
          quickly comes back after a long gap; one you get wrong comes back tomorrow. The schedule is stored in your
          local progress file and never leaves this browser.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Due for review"
          value={counts.due}
          tone={counts.due > 0 ? 'amber' : 'teal'}
          hint="Learned, and at the point of being forgotten"
        />
        <Stat
          label="Not seen yet"
          value={counts.unseen}
          tone="indigo"
          hint="Never asked; new material rather than a review"
        />
        <Stat label="Reviewed in this session" value={answeredToday} tone="indigo" />
        <Stat
          label="Next review"
          value={nextUp ? formatDate(nextUp.state.dueAt) : '—'}
        />
      </div>

      {!started ? (
        <Panel className="space-y-4">
          <div className="space-y-2">
            <h2 className="font-display text-lg font-semibold text-fg">
              {dueNow.length > 0 ? `${dueNow.length} question${dueNow.length === 1 ? '' : 's'} are waiting` : 'The queue is empty'}
            </h2>
            <p className="text-sm text-muted">
              {dueNow.length > 0
                ? 'A session is at most twenty questions. The ones you are most overdue for come first, because a question you are about to forget is worth more attention than a new one.'
                : 'Every question in the bank has been reviewed and none of them is due yet. Come back when the schedule says so, or answer new questions in the practice page to add to the queue.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={startSession} disabled={dueNow.length === 0} data-testid="start-review">
              {dueNow.length > 0 ? `Start a session of ${Math.min(dueNow.length, SESSION_LIMIT)}` : 'Nothing to review'}
            </Button>
            <Link to="/practice" className="text-xs text-indigo hover:underline">
              Answer new questions in the practice page
            </Link>
          </div>
        </Panel>
      ) : current ? (
        <Panel className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="indigo">
                {position + 1} / {session.length}
              </Badge>
              <Badge tone={questionTone(current.kind)}>{current.kind}</Badge>
              <span className="font-mono text-[11px] text-faint">
                §{current.source.section} · p.{current.source.page}
              </span>
              <span className="text-[11px] text-faint">was {describeState(reviews[current.id] ?? initialReviewState(now), now)}</span>
            </div>
            <Link
              to={`/lessons/${current.lessonId}`}
              className="text-[11px] text-indigo underline underline-offset-2"
            >
              taught in {getLesson(current.lessonId)?.title ?? 'the course'}
            </Link>
          </div>

          <p className="text-base font-medium text-fg" data-testid="review-prompt">
            {current.prompt}
          </p>

          <QuestionOptions
            question={current}
            chosen={chosen}
            onChoose={(choice) => answer(current, choice)}
            disabled={chosen !== undefined}
          />

          {chosen !== undefined ? (
            <>
              <AnswerFeedback question={current} chosen={chosen} />
              {verdict ? <ScheduleVerdict state={verdict} correct={chosen === current.correctIndex} /> : null}
            </>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={advance}
              disabled={chosen === undefined || position >= session.length - 1}
            >
              Next question
            </Button>
            {position >= session.length - 1 && chosen !== undefined ? (
              <Button size="sm" onClick={startSession}>
                Start a new session
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={startSession}>
              Rebuild the queue
            </Button>
          </div>
        </Panel>
      ) : (
        <Callout tone="teal" title="Session finished">
          Every question in this session has been rescheduled. The next one is due {nextUp ? formatDate(nextUp.state.dueAt) : 'later'}.
        </Callout>
      )}

      <Panel>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-fg">Schedule</h2>
          <span className="text-xs text-faint">{schedule.length} questions</span>
        </div>
        <p className="mt-1 text-xs text-muted">
          The order is by how overdue each question is. A question with no history is due immediately.
        </p>
        <ul className="mt-3 divide-y divide-line">
          {schedule.slice(0, 24).map((entry) => (
            <li key={entry.question.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{entry.question.prompt}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={`text-[11px] ${
                    entry.overdueDays >= 0 ? 'text-amber' : 'text-faint'
                  }`}
                >
                  {describeState(entry.state, now)}
                </span>
                <span className="font-mono text-[10px] text-faint">ef {entry.state.easeFactor.toFixed(2)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

/**
 * The verdict of a review: what the scheduler decided and why.
 */
function ScheduleVerdict({ state, correct }: { state: ReviewState; correct: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
        correct ? 'border-teal/40 bg-teal/5' : 'border-amber/40 bg-amber/5'
      }`}
      data-testid="schedule-verdict"
    >
      <div>
        <p className={`text-sm font-medium ${correct ? 'text-positive' : 'text-amber'}`}>
          {correct ? 'Recalled. Rescheduled.' : 'Not recalled. Back tomorrow.'}
        </p>
        <p className="text-xs text-muted">
          {correct
            ? `This question now returns in ${state.intervalDays} day${state.intervalDays === 1 ? '' : 's'}.`
            : 'The interval resets to one day, and the ease factor is left alone so a hard question does not get stuck in a short cycle.'}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-[11px] text-faint">
          ease {state.easeFactor.toFixed(2)} · {state.repetitions} in a row
        </p>
      </div>
    </div>
  )
}

/** A short date for a due date, in the reader's own locale. */
function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default ReviewPage
