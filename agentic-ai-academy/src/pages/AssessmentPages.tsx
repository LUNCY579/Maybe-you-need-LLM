import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { navigate, useRoute } from '../app/router'
import { ALL_QUESTIONS, LESSONS } from '../content/lessons'
import { resolveTrack } from '../content/tracks'
import { reviewSummary } from '../content/review'
import { GLOSSARY } from '../content/glossary'
import { aliasesFor, normaliseKey } from '../content/glossaryIndex'
import { demoForTerm, routeForDemo } from '../content/demoLinks'
import { LICENSE_SUMMARY, REFERENCES } from '../content/references'
import { BOOK } from '../content/book'
import { LABS } from '../content/labs'
import { Badge, Button, Card, Field, LiveRegion, Panel, ProgressBar, StatTile, TabPanel, Tabs } from '../ui/primitives'
import { QuizRunner } from '../ui/lesson/QuizRunner'
import { useProgress } from '../store/progress'
import { useScrollIntoViewWhenAvailable } from '../hooks/useScrollIntoViewWhenAvailable'
import { DELIVERABLES, PROJECT_BRIEF, PROJECT_MILESTONES } from '../content/project'
import { useProject, VERDICT_LABELS } from '../store/project'

/**
 * The concept map is loaded on demand.
 *
 * It draws with React Flow, which is a large library, and it is only needed on
 * one tab of one page. Carrying it in the initial bundle made every reading
 * page pay for a graph most students never open.
 */
const ConceptMap = lazy(() => import('../ui/glossary/ConceptMap').then((module) => ({ default: module.ConceptMap })))

/* ------------------------------------------------------------------ */
/* Quiz centre                                                         */
/* ------------------------------------------------------------------ */

type PracticeScope = 'core' | 'advanced' | 'both'

export function AssessmentPage() {
  const progress = useProgress()
  const route = useRoute()
  /**
   * The tab the student was sent to.
   *
   * A link that says "review the questions you got wrong" should open the
   * review queue, not the first tab. The tab is read from the query string,
   * and the state follows it when the query changes.
   */
  const requestedTab = route.query.get('tab')
  const [mode, setMode] = useState<'by-lesson' | 'review' | 'mixed' | 'history'>(() =>
    requestedTab === 'review' || requestedTab === 'mixed' || requestedTab === 'history' ? requestedTab : 'by-lesson',
  )
  const [lastRequestedTab, setLastRequestedTab] = useState(requestedTab)
  if (lastRequestedTab !== requestedTab) {
    setLastRequestedTab(requestedTab)
    if (
      requestedTab === 'by-lesson' ||
      requestedTab === 'review' ||
      requestedTab === 'mixed' ||
      requestedTab === 'history'
    ) {
      setMode(requestedTab)
    }
  }
  const [lessonSlug, setLessonSlug] = useState(LESSONS[0].slug)
  const [scope, setScope] = useState<PracticeScope>('core')
  const [focusQuestionId, setFocusQuestionId] = useState<string | null>(null)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'wrong'>('all')
  const deepLinkRef = useRef<HTMLDivElement>(null)

  /**
   * Deep link: /assessments?question=<id> selects the owning lesson and shows
   * every question, so the linked question is actually on screen.
   *
   * The target is derived during render rather than pushed into state from an
   * effect, which keeps the render pass free of cascading state updates.
   */
  const deepLinkQuestionId = route.query.get('question')
  const deepLinkOwner = deepLinkQuestionId
    ? LESSONS.find((entry) => [...entry.quiz, ...entry.advancedQuiz].some((q) => q.id === deepLinkQuestionId))
    : undefined

  const effectiveSlug = deepLinkOwner?.slug ?? lessonSlug
  const effectiveMode = deepLinkOwner ? 'by-lesson' : mode
  const effectiveScope: PracticeScope = deepLinkOwner ? 'both' : scope

  const lesson = LESSONS.find((candidate) => candidate.slug === effectiveSlug) ?? LESSONS[0]
  const lessonTrack = resolveTrack(lesson, progress.difficultyFor(lesson.slug, lesson.difficulty))

  /**
   * Questions shown for the selected lesson.
   *
   * `core` and `advanced` follow the lesson's own tracks; `both` shows every
   * question, including the advanced ones, regardless of the track the student
   * has selected for that lesson.
   */
  const lessonQuestions = useMemo(() => {
    if (effectiveScope === 'both') return [...lesson.quiz, ...lesson.advancedQuiz]
    if (effectiveScope === 'core') return lesson.quiz.filter((question) => question.difficulty === 'core')
    return [...lesson.quiz.filter((question) => question.difficulty === 'core'), ...lesson.advancedQuiz]
  }, [lesson, effectiveScope])

  const totalQuestions = ALL_QUESTIONS.length
  const attempted = progress.answeredQuestionIds.length
  const correct = progress.correctQuestionIds.length
  const attemptsByQuestion = progress.state.quizAttempts.length
  const review = useMemo(() => reviewSummary(progress.state), [progress.state])

  const mixed = useMemo(() => {
    /*
     * The mixed set attacks the weakest material first.
     *
     * The due questions come first — they are the ones the student has already
     * got wrong — and the rest is a deterministic stride across the course so
     * that the set still covers the whole curriculum rather than only the
     * backlog.
     */
    const due = review.items.map((item) => item.question)
    const seen = new Set(due.map((question) => question.id))
    const spread = ALL_QUESTIONS.filter((question) => !seen.has(question.id)).filter((_, index) => index % 3 === 0)
    return [...due, ...spread].slice(0, 12)
  }, [review])

  // Scroll the linked question into view once the panel has rendered.
  useEffect(() => {
    if (!deepLinkQuestionId) return
    const frame = requestAnimationFrame(() => deepLinkRef.current?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(frame)
  }, [deepLinkQuestionId])

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Quiz and challenge centre</h1>
        <p className="text-muted max-w-3xl text-sm">
          {totalQuestions} assessment questions across {LESSONS.length} lessons, each with an explanation and a chapter reference. Answers are graded
          locally and every attempt is recorded in your attempt history.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Questions" value={String(totalQuestions)} hint={`${LESSONS.length} lessons`} />
        <StatTile label="Attempted" value={`${attempted}`} hint={`${Math.round((attempted / totalQuestions) * 100)}% coverage`} />
        <StatTile label="Correct (latest attempt)" value={String(correct)} hint={`${attempted === 0 ? 0 : Math.round((correct / attempted) * 100)}% accuracy`} />
        <StatTile label="Total attempts" value={String(attemptsByQuestion)} hint="Includes retries" />
      </div>

      <ProgressBar value={totalQuestions === 0 ? 0 : attempted / totalQuestions} label="Question coverage" />

      <Tabs
        idPrefix="assessment-tabs"
        ariaLabel="Quiz modes"
        active={effectiveMode}
        onChange={setMode}
        tabs={[
          { id: 'by-lesson', label: 'Practice by lesson' },
          { id: 'review', label: `Review weak spots${review.due > 0 ? ` (${review.due})` : ''}` },
          { id: 'mixed', label: 'Mixed challenge set' },
          { id: 'history', label: 'Attempt history' },
        ]}
      />

      <TabPanel idPrefix="assessment-tabs" id="by-lesson" active={effectiveMode === 'by-lesson'}>
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Lesson">
                <select
                  aria-label="Choose a lesson to practise"
                  value={effectiveSlug}
                  onChange={(event) => setLessonSlug(event.target.value)}
                  className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
                  style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
                >
                  {LESSONS.map((entry) => (
                    <option key={entry.slug} value={entry.slug}>
                      L{entry.order} · {entry.title} ({entry.quiz.length + entry.advancedQuiz.length} questions)
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Question set">
                <select
                  aria-label="Choose which question set to practise"
                  value={effectiveScope}
                  onChange={(event) => setScope(event.target.value as PracticeScope)}
                  className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
                  style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
                >
                  <option value="core">Core track only</option>
                  <option value="advanced">Core + advanced track</option>
                  <option value="both">All questions</option>
                </select>
              </Field>
            </div>
            <p className="text-muted mt-2 text-xs">
              {lesson.summary}{' '}
              <button type="button" className="focus-ring underline" onClick={() => navigate(`/lesson/${lesson.slug}`)}>
                Open the lesson
              </button>
            </p>
            <p className="text-muted mt-1 text-[11px]">
              Your saved track for this lesson is <strong>{progress.difficultyFor(lesson.slug, lesson.difficulty)}</strong> ({lessonTrack.questions.length}{' '}
              question(s) on that track). The question set above overrides it for this session only.
            </p>
          </Card>
          <div ref={deepLinkRef}>
            <QuizRunner questions={lessonQuestions} lessonSlug={lesson.slug} focusQuestionId={focusQuestionId} />
          </div>
        </div>
      </TabPanel>

      <TabPanel idPrefix="assessment-tabs" id="review" active={effectiveMode === 'review'}>
        <div className="space-y-4">
          {review.due === 0 ? (
            <Card className="p-5">
              <h2 className="text-sm font-semibold">Nothing to review</h2>
              <p className="text-muted mt-2 text-sm">
                {review.everCorrect > 0
                  ? 'Everything you have attempted is currently scheduled for a later return. Answer something new, or get a question wrong, and it will come back here.'
                  : 'The review queue holds the questions your Leitner box says are due. Answer a question incorrectly and it appears here immediately; answer it correctly and it waits a day, then three, then seven, then fourteen, then thirty.'}
              </p>
              {review.everMissed > 0 ? (
                <p className="text-muted mt-2 text-xs">
                  You have missed {review.everMissed} question(s) in total, but answered them correctly on a later attempt.
                </p>
              ) : null}
            </Card>
          ) : (
            <>
              <Card className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold">
                    {review.due} question{review.due === 1 ? '' : 's'} due for review
                  </h2>
                  <span className="text-muted text-xs">
                    across {review.affectedLessons} lesson{review.affectedLessons === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="text-muted mt-2 text-xs leading-relaxed">
                  A wrong answer drops a question into the first box, where it is due immediately; a correct answer promotes it a box, so it waits
                  one, three, seven, fourteen or thirty days before returning. The questions that have been waiting longest come first.
                </p>
                {review.oldest ? (
                  <p className="text-muted mt-2 text-[11px]">
                    Oldest: <strong>{review.oldest.question.prompt}</strong> — last attempted {review.oldest.daysSince} day
                    {review.oldest.daysSince === 1 ? '' : 's'} ago in {review.oldest.lessonTitle}.
                  </p>
                ) : null}
              </Card>

              <ol className="space-y-2">
                {review.items.map((item) => (
                  <li key={item.question.id}>
                    <Card className="space-y-1 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="rose">due now</Badge>
                        <Badge tone="neutral">box {item.box}</Badge>
                        <Badge tone="neutral">
                          {item.misses} of {item.attempts} attempt(s) wrong
                        </Badge>
                        <span className="text-muted text-[11px]">{item.lessonTitle}</span>
                      </div>
                      <p className="text-sm">{item.question.prompt}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setLessonSlug(item.lessonSlug)
                            setScope('both')
                            setFocusQuestionId(item.question.id)
                            setMode('by-lesson')
                          }}
                        >
                          Practise this question
                        </Button>
                        <button
                          type="button"
                          className="focus-ring underline text-xs"
                          onClick={() => navigate(`/lesson/${item.lessonSlug}`)}
                        >
                          Revisit the lesson
                        </button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ol>

              <p className="text-muted text-xs">
                Working through the list above? Answer the questions in <em>Practice by lesson</em> — the queue updates as you go, because it is
                derived from your latest attempt rather than stored separately.
              </p>
            </>
          )}

          {review.upcoming.length > 0 ? (
            <Panel
              title="Scheduled to come back"
              subtitle="Questions you have answered correctly, and the day they are next due. This is the spacing: each success pushes the question further out."
            >
              <ul className="space-y-1.5 text-xs">
                {review.upcoming.slice(0, 12).map((item) => (
                  <li key={item.question.id} className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0 flex-1">
                      {item.question.prompt}
                      <span className="text-muted ml-1.5 text-[10px]">({item.lessonTitle})</span>
                    </span>
                    <span className="text-muted shrink-0 text-[11px]">
                      box {item.box} · in {item.daysUntilDue} day{item.daysUntilDue === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ul>
              {review.upcoming.length > 12 ? (
                <p className="text-muted mt-2 text-[11px]">and {review.upcoming.length - 12} more.</p>
              ) : null}
            </Panel>
          ) : null}
        </div>
      </TabPanel>

      <TabPanel idPrefix="assessment-tabs" id="mixed" active={effectiveMode === 'mixed'}>
        <div className="space-y-4">
          <p className="text-muted text-sm">
            {review.due > 0
              ? `A mixed set that starts with the ${review.due} question(s) currently due for review, then widens into a deterministic stride across the whole course.`
              : 'A deterministic stride across the whole course: every third question, capped at twelve. Answer something wrong and the next set will start with it.'}
          </p>
          <QuizRunner questions={mixed} lessonSlug="mixed-challenge" showSource />
        </div>
      </TabPanel>

      <TabPanel idPrefix="assessment-tabs" id="history" active={effectiveMode === 'history'}>
        <Panel title="Attempt history" subtitle="Newest first, kept locally and included in progress export.">
          {progress.state.quizAttempts.length === 0 ? (
            <p className="text-muted text-sm">No attempts recorded yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{progress.state.quizAttempts.length} attempt(s)</Badge>
                <Badge tone="rose">{progress.state.quizAttempts.filter((attempt) => !attempt.correct).length} incorrect</Badge>
                <Badge tone="emerald">{progress.state.quizAttempts.filter((attempt) => attempt.correct).length} correct</Badge>
                <Button size="sm" variant="ghost" onClick={() => setHistoryFilter(historyFilter === 'all' ? 'wrong' : 'all')}>
                  {historyFilter === 'all' ? 'Show only the wrong ones' : 'Show every attempt'}
                </Button>
              </div>
              <ol tabIndex={0} aria-label="Quiz attempt history" className="thin-scroll max-h-[32rem] space-y-2 overflow-y-auto pr-1 focus-ring">
                {[...progress.state.quizAttempts]
                  .reverse()
                  .filter((attempt) => historyFilter === 'all' || !attempt.correct)
                  .map((attempt, index) => {
                    const question = ALL_QUESTIONS.find((entry) => entry.id === attempt.questionId)
                    const lessonForAttempt = LESSONS.find((entry) => entry.slug === attempt.lessonSlug)
                    return (
                      <li key={`${attempt.questionId}-${index}`} className="surface-2 rounded-lg border p-2 text-xs" style={{ borderColor: 'var(--border-soft)' }}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge tone={attempt.correct ? 'emerald' : 'rose'}>{attempt.correct ? 'correct' : 'incorrect'}</Badge>
                          <span className="text-muted">{new Date(attempt.at).toLocaleString()}</span>
                        </div>
                        <p className="mt-1">{question?.prompt ?? attempt.questionId}</p>
                        <p className="text-muted mt-1">
                          {lessonForAttempt?.title ?? attempt.lessonSlug} · chose “{question ? question.options[attempt.chosen] : '—'}”
                          {question && !attempt.correct ? ` · correct: “${question.options[question.correct]}”` : ''}
                        </p>
                        {question ? (
                          <details className="mt-1">
                            <summary className="text-muted cursor-pointer text-[11px]">Why this is the answer</summary>
                            <p className="text-muted mt-1 leading-relaxed">{question.explanation}</p>
                          </details>
                        ) : null}
                      </li>
                    )
                  })}
              </ol>
              {historyFilter === 'wrong' && progress.state.quizAttempts.every((attempt) => attempt.correct) ? (
                <p className="text-muted text-xs">Nothing wrong yet.</p>
              ) : null}
            </div>
          )}
        </Panel>
      </TabPanel>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Glossary                                                            */
/* ------------------------------------------------------------------ */

export function GlossaryPage() {
  const route = useRoute()
  const [term, setTerm] = useState(() => route.query.get('term') ?? '')
  const [lessonFilter, setLessonFilter] = useState<string>('all')
  const [view, setView] = useState<'list' | 'map'>('list')

  const lessons = LESSONS.map((lesson) => ({ value: lesson.slug, label: lesson.title }))
  const filtered = GLOSSARY.filter((entry) => {
    if (lessonFilter !== 'all' && !entry.lessons.includes(lessonFilter)) return false
    if (!term.trim()) return true
    const needle = term.trim().toLowerCase()
    // The haystack includes the term's aliases, so searching "MCP" finds
    // "Model Context Protocol (MCP)" and searching "RAG" finds
    // "Retrieval-augmented generation (RAG)".
    const haystack = [
      entry.term,
      entry.definition,
      entry.related.join(' '),
      ...aliasesFor(entry),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })

  // The term that was deep-linked, if any: shown first and highlighted.
  const deepLinkTerm = route.query.get('term')

  /**
   * Scroll to the deep-linked term.
   *
   * The glossary is ninety-eight entries long, and a link that highlights an
   * entry the reader cannot see is a link that did not arrive. The search
   * field is pre-filled with the term, which narrows the list, but the
   * highlighted entry can still be below the fold.
   */
  useEffect(() => {
    if (!deepLinkTerm) return
    const id = `glossary-${deepLinkTerm.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    let cancelled = false
    let attempt = 0
    let timer = 0

    const tryScroll = () => {
      if (cancelled) return
      const target = document.getElementById(id)
      if (target) {
        target.scrollIntoView({ block: 'center' })
        return
      }
      attempt += 1
      if (attempt > 20) return
      timer = window.setTimeout(tryScroll, 50)
    }

    const frame = requestAnimationFrame(tryScroll)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [deepLinkTerm])

  /** The route into the demonstration that exercises a term, if there is one. */
  const demoRoute = (term: string): string | null => {
    const demo = demoForTerm(term)
    return demo ? routeForDemo(demo) : null
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Glossary</h1>
        <p className="text-muted max-w-3xl text-sm">
          {GLOSSARY.length} concepts, most with the chapter and section where the textbook defines or uses them. Terms marked as course terms were
          introduced by this project and are labelled as such rather than attributed to the book.
        </p>
      </header>

      <Tabs
        idPrefix="glossary-tabs"
        ariaLabel="Glossary views"
        active={view}
        onChange={setView}
        tabs={[
          { id: 'list', label: 'Term list' },
          { id: 'map', label: 'Concept map' },
        ]}
      />

      <TabPanel idPrefix="glossary-tabs" id="map" active={view === 'map'}>
        <Suspense fallback={<p className="text-muted text-sm">Loading the concept map…</p>}>
          <ConceptMap />
        </Suspense>
      </TabPanel>

      <TabPanel idPrefix="glossary-tabs" id="list" active={view === 'list'}>
      <Card className="grid gap-3 p-4 sm:grid-cols-2">
        <Field label="Search terms">
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            aria-label="Search the glossary"
            placeholder="harness, grounding, RLVR…"
            className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
            style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
          />
        </Field>
        <Field label="Used in lesson">
          <select
            aria-label="Filter glossary by lesson"
            value={lessonFilter}
            onChange={(event) => setLessonFilter(event.target.value)}
            className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
            style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
          >
            <option value="all">All lessons</option>
            {lessons.map((lesson) => (
              <option key={lesson.value} value={lesson.value}>
                {lesson.label}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <p className="text-muted text-xs">{filtered.length} term(s).</p>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((entry) => {
          const highlighted = deepLinkTerm !== null && entry.term.toLowerCase() === deepLinkTerm.toLowerCase()
          return (
            <Card
              key={entry.term}
              id={`glossary-${entry.term.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              className="space-y-2 p-4"
              style={highlighted ? { borderColor: 'var(--accent)' } : undefined}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">{entry.term}</h2>
                {entry.source ? <Badge tone="cyan">{entry.source.label}</Badge> : <Badge tone="amber">course term</Badge>}
                {highlighted ? <Badge tone="emerald">from search</Badge> : null}
              </div>
              <p className="text-sm leading-relaxed">{entry.definition}</p>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-muted text-[11px]">Related:</span>
                {entry.related.map((related) => {
                  // The book's term names mix hyphens and en dashes, so the
                  // related name is resolved to the term that actually
                  // exists before it is used as a link.
                  const target = GLOSSARY.find((candidate) => normaliseKey(candidate.term) === normaliseKey(related))
                  if (!target) return null
                  return (
                    <button
                      key={related}
                      type="button"
                      onClick={() => {
                        setTerm(target.term)
                        setLessonFilter('all')
                      }}
                      className="focus-ring tap-target surface-2 rounded-md border px-2 py-0.5 text-[11px] hover:opacity-90"
                      style={{ borderColor: 'var(--border-soft)' }}
                    >
                      {target.term}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-1">
                {entry.lessons.map((slug) => {
                  const lesson = LESSONS.find((candidate) => candidate.slug === slug)
                  if (!lesson) return null
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => navigate(`/lesson/${slug}`)}
                      className="focus-ring tap-target surface-2 rounded-md border px-2 py-1 text-[11px]"
                      style={{ borderColor: 'var(--border-soft)' }}
                    >
                      {lesson.title}
                    </button>
                  )
                })}
              </div>
              {demoRoute(entry.term) ? (
                <Button size="sm" onClick={() => navigate(demoRoute(entry.term)!)}>
                  Practise this concept
                </Button>
              ) : null}
            </Card>
          )
        })}
      </div>
      </TabPanel>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* References                                                          */
/* ------------------------------------------------------------------ */

export function ReferencesPage() {
  const route = useRoute()
  const deepLinkRef = route.query.get('ref')
  const [referenceQuery, setReferenceQuery] = useState('')

  /**
   * The references that match the filter.
   *
   * The list is long enough now that finding the paper behind a particular
   * chapter matters more than reading it top to bottom, so the filter matches
   * on the author, the title, the venue, the chapter it is used for, and the
   * role the course gives it.
   */
  const visibleReferences = useMemo(() => {
    const query = referenceQuery.trim().toLowerCase()
    if (!query) return REFERENCES
    return REFERENCES.filter((reference) =>
      [reference.authors, reference.title, reference.venue, reference.usedFor, reference.licenseNote]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [referenceQuery])

  /**
   * A reference reached from the search dialog.
   *
   * The list is long, so arriving at it from a search result has to land on
   * the reference rather than at the top of the page — and the filter must
   * not be allowed to hide the very thing the student came for.
   *
   * The filter is cleared while rendering rather than in an effect, which is
   * the adjustment React recommends for state that follows a changed input,
   * and it keeps the two from disagreeing for a frame.
   */
  const [lastDeepLink, setLastDeepLink] = useState(deepLinkRef)
  if (lastDeepLink !== deepLinkRef) {
    setLastDeepLink(deepLinkRef)
    setReferenceQuery('')
  }

  useScrollIntoViewWhenAvailable(deepLinkRef ? `reference-${deepLinkRef}` : null, { block: 'center' })

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">References, citations and licences</h1>
        <p className="text-muted max-w-3xl text-sm">
          Source integrity matters for a course built on a textbook. This page states what the course derives from, what it authored, and what licence
          governs each third-party work it links to.
        </p>
      </header>

      <Panel title="Primary source" subtitle="The textbook this course is built on.">
        <div className="space-y-2 text-sm">
          <p>
            <strong>{BOOK.title}</strong> — {BOOK.authors.join(', ')}. {BOOK.arxivId}, {BOOK.publisher}.
          </p>
          <p className="text-muted text-xs">
            <a className="underline" href={BOOK.arxivUrl} target="_blank" rel="noreferrer noopener">
              {BOOK.arxivUrl}
            </a>{' '}
            · licensed under the terms shown on the arXiv record ({BOOK.license}). Author credit is preserved on every lesson.
          </p>
        </div>
      </Panel>

      <div className="grid gap-3 md:grid-cols-3">
        {Object.entries(LICENSE_SUMMARY).map(([key, value]) => (
          <Card key={key} className="space-y-2 p-4">
            <h2 className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--accent)' }}>
              {key}
            </h2>
            <p className="text-muted text-xs leading-relaxed">{value}</p>
          </Card>
        ))}
      </div>

      <Panel
        title="Third-party works"
        subtitle="Linked, not redistributed. Licence notes were verified against each project's own LICENSE file."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <label htmlFor="reference-filter" className="text-muted text-xs font-medium">
                Filter the references
              </label>
              <input
                id="reference-filter"
                type="search"
                value={referenceQuery}
                onChange={(event) => setReferenceQuery(event.target.value)}
                placeholder="author, title, chapter, or role — e.g. memory, Ch. 9, arXiv"
                className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
                style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
              />
            </div>
            <Badge tone="neutral">
              {visibleReferences.length} of {REFERENCES.length}
            </Badge>
          </div>
          {visibleReferences.length === 0 ? (
            <p className="text-muted text-sm">No reference matches “{referenceQuery}”.</p>
          ) : (
            <ul className="space-y-3">
              {visibleReferences.map((reference) => {
                const highlighted = deepLinkRef === reference.id
                return (
                  <li
                    key={reference.id}
                    id={`reference-${reference.id}`}
                    className="surface-2 rounded-lg border p-3 text-sm"
                    style={{ borderColor: highlighted ? 'var(--accent)' : 'var(--border-soft)' }}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">
                        {reference.authors} ({reference.year}). {reference.title}.
                      </p>
                      {highlighted ? <Badge tone="emerald">from search</Badge> : null}
                      {reference.url ? (
                        <a className="focus-ring text-xs underline" href={reference.url} target="_blank" rel="noreferrer noopener">
                          source
                        </a>
                      ) : null}
                    </div>
                    <p className="text-muted mt-1 text-xs">{reference.venue}</p>
                    <p className="mt-2 text-xs">
                      <strong>Used for:</strong> {reference.usedFor}
                    </p>
                    <p className="text-muted mt-1 text-xs">
                      <strong>Licence:</strong> {reference.licenseNote}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Panel>

      <Panel title="Statement of originality" subtitle="What was authored for this course.">
        <ul className="text-muted space-y-2 text-xs leading-relaxed">
          <li>All lesson prose, worked examples, checkpoints and assessment questions were written for this course, grounded in the cited sections.</li>
          <li>All diagrams are original inline SVG reconstructions of the mechanisms described in the book — none are traced from the PDF.</li>
          <li>All simulation engines (workflow, planning, memory, world model, multi-agent) are original TypeScript, deterministic and covered by tests.</li>
          <li>No third-party code, dataset or figure is bundled. Where code elsewhere inspired a task (nanochat, LangChain, BALROG), the course links to the canonical repository.</li>
          <li>The PDF is not redistributed; the reader works without it and mentions where a local copy can be placed if desired.</li>
        </ul>
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Final project                                                       */
/* ------------------------------------------------------------------ */

export function ProjectPage() {
  const milestoneIds = useMemo(() => PROJECT_MILESTONES.map((milestone) => milestone.id), [])
  const { state, readiness, setTaskName, toggleMilestone, setNote, setRubricScore } = useProject(milestoneIds)
  const [announcement, setAnnouncement] = useState('')

  const downloadBrief = () => {
    const payload = {
      task: state.taskName || '(choose a task)',
      checklist: PROJECT_MILESTONES.filter((milestone) => state.checklist[milestone.id]).map((milestone) => milestone.title),
      notes: state.notes,
      rubric: Object.fromEntries(readiness.criteria.map((entry) => [entry.criterion.id, entry.awarded])),
      rubricMax: readiness.max,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'agentic-ai-academy-project.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setAnnouncement('Project brief exported as JSON.')
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Final practical project</h1>
        <p className="text-muted max-w-3xl text-sm">
          The book grades four case studies in person; this course equivalents them with one end-to-end project of your own, assessed on evaluation
          discipline rather than demo polish. Everything on this page is stored locally with your progress.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Milestones" value={`${readiness.milestonesDone}/${readiness.milestonesTotal}`} hint="Marked complete" />
        <StatTile label="Rubric points" value={`${readiness.awarded}/${readiness.max}`} hint="Self-assessed" />
        <StatTile
          label="Evidence"
          value={`${Math.round(readiness.evidenceRatio * 100)}%`}
          hint={`${readiness.criteria.filter((entry) => entry.evidenced).length} of ${readiness.criteria.length} criteria evidenced`}
        />
        <StatTile label="Status" value={VERDICT_LABELS[readiness.verdict]} hint="Derived from your recorded activity" />
      </div>

      <ProgressBar value={readiness.milestonesTotal === 0 ? 0 : readiness.milestonesDone / readiness.milestonesTotal} label={`${readiness.milestonesDone}/${readiness.milestonesTotal} milestones marked complete`} />

      <Card className="p-4">
        <Field label="Your task">
          <input
            type="text"
            value={state.taskName}
            onChange={(event) => setTaskName(event.target.value)}
            placeholder="e.g. A retrieval-backed assistant that verifies its own answers"
            aria-label="Name of the project task"
            className="focus-ring surface-2 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
          />
        </Field>
        <p className="text-muted mt-2 text-xs">
          Write the task down in one line before you start. A verifiable outcome — one you can check without a human in the loop — is the single
          biggest predictor of whether the evaluation chapter of your report will be worth writing (Ch. 10, §10.3).
        </p>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        {PROJECT_BRIEF.map((brief) => (
          <Card key={brief.title} className="space-y-2 p-4">
            <h2 className="text-sm font-semibold">{brief.title}</h2>
            <p className="text-muted text-xs leading-relaxed">{brief.body}</p>
            <p className="text-muted text-[11px]">Source: {brief.reference}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setTaskName(brief.title.replace(/^Brief [A-Z] · /, ''))
                  setAnnouncement(`Task set to “${brief.title.replace(/^Brief [A-Z] · /, '')}”.`)
                }}
              >
                Use this brief
              </Button>
              {brief.demo ? (
                <Button size="sm" variant="ghost" onClick={() => {
                  const route = routeForDemo(brief.demo!)
                  if (route) navigate(route)
                }}>
                  See a demonstration
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {PROJECT_MILESTONES.map((milestone) => (
            <Card key={milestone.id} className="p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={Boolean(state.checklist[milestone.id])}
                  onChange={(event) => {
                    toggleMilestone(milestone.id, event.target.checked)
                    setAnnouncement(`${milestone.title} ${event.target.checked ? 'marked complete' : 'unmarked'}.`)
                  }}
                  className="focus-ring mt-1 h-4 w-4"
                  aria-label={milestone.title}
                />
                <span>
                  <span className="block text-sm font-semibold">{milestone.title}</span>
                  <span className="text-muted mt-1 block text-xs leading-relaxed">{milestone.detail}</span>
                  <span className="text-muted mt-1 block text-[11px]">Reference: {milestone.reference}</span>
                </span>
              </label>
            </Card>
          ))}

          <Panel title="Deliverable notes" subtitle="One note per deliverable. Stored locally; export them with the brief.">
            <div className="space-y-3">
              {DELIVERABLES.map((deliverable, index) => (
                <Field key={deliverable} label={`${index + 1}. ${deliverable}`}>
                  <textarea
                    value={state.notes[String(index)] ?? ''}
                    onChange={(event) => setNote(String(index), event.target.value)}
                    rows={3}
                    aria-label={`Notes for deliverable ${index + 1}: ${deliverable}`}
                    className="focus-ring surface-2 mt-1 w-full rounded-lg border px-3 py-2 text-xs"
                    style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
                  />
                </Field>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title="Rubric and evidence" subtitle="Score yourself against each criterion. The evidence column reports what your own course activity shows.">
            <ul className="space-y-3">
              {readiness.criteria.map((entry) => (
                <li key={entry.criterion.id} className="space-y-1 border-b pb-3 text-xs last:border-b-0" style={{ borderColor: 'var(--border-soft)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{entry.criterion.title}</span>
                    <Badge tone={entry.evidenced ? 'emerald' : 'neutral'}>{entry.evidenced ? 'evidenced' : 'no evidence yet'}</Badge>
                  </div>
                  <p className="text-muted leading-relaxed">{entry.criterion.detail}</p>
                  <p className="text-muted text-[11px]">
                    Source: {entry.criterion.source} · Your activity: {entry.evidence}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label htmlFor={`rubric-${entry.criterion.id}`} className="text-muted text-[11px]">
                      Points (0–{entry.criterion.maxPoints})
                    </label>
                    <input
                      id={`rubric-${entry.criterion.id}`}
                      type="number"
                      min={0}
                      max={entry.criterion.maxPoints}
                      value={entry.awarded}
                      onChange={(event) => {
                        const value = Number(event.target.value)
                        setRubricScore(entry.criterion.id, Number.isFinite(value) ? value : 0)
                      }}
                      className="focus-ring surface-2 w-20 rounded-lg border px-2 py-1 text-xs"
                      style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
                    />
                    <span className="text-muted text-[11px]">of {entry.criterion.maxPoints}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="sm" variant="primary" onClick={downloadBrief}>
                Export project brief (JSON)
              </Button>
              <span className="text-muted text-[11px]">
                {readiness.awarded}/{readiness.max} points self-assigned.
              </span>
            </div>
          </Panel>

          <Panel title="Deliverables" subtitle="What the submission must contain.">
            <ul className="space-y-2 text-xs">
              {DELIVERABLES.map((deliverable) => (
                <li key={deliverable}>• {deliverable}</li>
              ))}
            </ul>
          </Panel>

          <Panel title="Starting points" subtitle="Labs and scenarios that map onto each milestone.">
            <ul className="space-y-2 text-xs">
              {LABS.map((lab) => (
                <li key={lab.id} className="flex items-center justify-between gap-2">
                  <span>{lab.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => navigate(lab.route)}>
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <LiveRegion message={announcement} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Not found                                                           */
/* ------------------------------------------------------------------ */

export function NotFoundPage() {
  const route = useRoute()
  return (
    <Card className="space-y-3 p-6">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted text-sm">
        No route matches <code className="font-mono">#{route.hash.replace(/^#/, '')}</code>. Use the navigation above, or jump straight into the course.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => navigate('/')}>
          Course overview
        </Button>
        <Button onClick={() => navigate('/curriculum')}>Curriculum</Button>
        <Button onClick={() => navigate('/builder')}>Workflow builder</Button>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Labs index                                                          */
/* ------------------------------------------------------------------ */

export function LabsIndexPage() {
  const progress = useProgress()
  const runs = new Set(progress.state.labActivity.map((entry) => entry.labId))

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Interactive laboratories</h1>
        <p className="text-muted max-w-3xl text-sm">
          Five hands-on environments, each a deterministic simulator with typed state, inspectable traces and no model calls. Everything here is an
          original teaching instrument; the simulations are scripted, seeded and reproducible.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {LABS.map((lab) => (
          <Card key={lab.id} className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={lab.accent}>{lab.id === 'workflow-builder' ? 'flagship' : 'lab'}</Badge>
              {runs.has(lab.id) ? <Badge tone="emerald">run recorded</Badge> : null}
              <span className="text-muted text-[11px]">Chapters {lab.sourceChapters.join(', ')}</span>
            </div>
            <h2 className="text-base font-semibold">{lab.name}</h2>
            <p className="text-muted text-sm leading-relaxed">{lab.description}</p>
            <div className="flex flex-wrap gap-1">
              {lab.concepts.map((concept) => (
                <button
                  key={concept}
                  type="button"
                  onClick={() => navigate(`/glossary?term=${encodeURIComponent(concept)}`)}
                  className="focus-ring tap-target rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:opacity-90"
                >
                  {concept}
                </button>
              ))}
            </div>
            <p className="text-muted text-[11px]">{lab.runtime}</p>
            <div className="mt-auto pt-2">
              <Button variant="primary" onClick={() => navigate(lab.route)}>
                Open {lab.id === 'workflow-builder' ? 'builder' : 'lab'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
