import { Suspense, lazy, useEffect } from 'react'
import { getLesson, nextLesson, previousLesson, LESSONS } from '../content/lessons'
import { CHAPTER_BY_NUMBER, PART_BY_ID } from '../content/book'
import { resolveTrack } from '../content/tracks'
import { REFERENCE_BY_ID } from '../content/references'
import { lessonMastery } from '../content/review'
import { navigate, useRoute } from '../app/router'
import { Badge, Button, Card, Panel, ProgressBar, TabPanel, Tabs, cn } from '../ui/primitives'
import { LessonBlockView } from '../ui/lesson/LessonBlocks'
import { LessonOutline } from '../ui/lesson/LessonOutline'
import { QuizRunner } from '../ui/lesson/QuizRunner'
import { useProgress } from '../store/progress'
import { useScrollIntoViewWhenAvailable } from '../hooks/useScrollIntoViewWhenAvailable'
import { Markdown } from '../ui/Markdown'
import { useState } from 'react'

// Recharts is only needed for the scaling visualisation: load it on demand.
const ScalingExplorer = lazy(() => import('../ui/labs/ScalingExplorer').then((module) => ({ default: module.ScalingExplorer })))

export function LessonPage({ slug }: { slug: string }) {
  const lesson = getLesson(slug)
  const progress = useProgress()
  const route = useRoute()
  /**
   * The tab the student was sent to.
   *
   * A link that says "take the questions" should open the questions, and a
   * link that says "see where this came from" should open the sources. The
   * tab is therefore read from the query string, and the state follows it
   * when the query changes.
   */
  const requestedTab = route.query.get('tab')
  const [tab, setTab] = useState<'lesson' | 'quiz' | 'sources'>(() =>
    requestedTab === 'quiz' || requestedTab === 'sources' ? requestedTab : 'lesson',
  )
  const [lastRequestedTab, setLastRequestedTab] = useState(requestedTab)
  if (lastRequestedTab !== requestedTab) {
    setLastRequestedTab(requestedTab)
    if (requestedTab === 'quiz' || requestedTab === 'sources' || requestedTab === 'lesson') {
      setTab(requestedTab)
    }
  }

  /**
   * The primary literature behind the lesson, with the reference resolved.
   *
   * The reference is looked up rather than copied, so a link and its licence
   * note can never disagree.
   */
  const furtherReading = (lesson?.furtherReading ?? []).map((entry) => ({
    ...entry,
    reference: REFERENCE_BY_ID.get(entry.referenceId),
  }))

  useEffect(() => {
    if (lesson) progress.visitLesson(lesson.slug)
    window.scrollTo({ top: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  /*
   * A deep link to a lesson section or to an inline demonstration.
   *
   * The anchor may be spelled either way: a link into a section carries the
   * element's own id (`section-memory`), because that is the id the browser
   * and the outline both use; a link written with the bare section id is
   * accepted too, because a deep link that silently does nothing is worse
   * than one that takes an extra lookup.
   *
   * The lesson is loaded on demand, so the target may not exist when the
   * route is parsed. The hook waits for it.
   */
  const anchor = route.anchor
  useScrollIntoViewWhenAvailable(
    anchor
      ? anchor.startsWith('demo-') || anchor.startsWith('section-')
        ? anchor
        : `section-${anchor}`
      : null,
  )

  if (!lesson) {
    return (
      <Card className="p-6">
        <h1 className="text-lg font-semibold">Lesson not found</h1>
        <p className="text-muted mt-2 text-sm">
          No lesson with the slug “{slug}”. Browse the <button className="underline" onClick={() => navigate('/curriculum')}>curriculum</button> for the
          released lessons.
        </p>
      </Card>
    )
  }

  const part = PART_BY_ID.get(lesson.part)
  const difficulty = progress.difficultyFor(lesson.slug, lesson.difficulty)
  const track = resolveTrack(lesson, difficulty)
  const mastery = lessonMastery(lesson.slug, progress.state)
  const completed = progress.isCompleted(lesson.slug)
  const bookmarked = progress.isBookmarked(lesson.slug)
  const next = nextLesson(lesson.slug)
  const previous = previousLesson(lesson.slug)

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="cyan">Lesson {lesson.order} of {LESSONS.length}</Badge>
          <Badge tone="violet">{part?.title}</Badge>
          <Badge tone={difficulty === 'advanced' ? 'amber' : 'neutral'}>{difficulty} track</Badge>
          <Badge tone="neutral">{lesson.minutes} min</Badge>
          {mastery.mastered ? <Badge tone="emerald">mastered</Badge> : null}
          {completed ? <Badge tone="emerald">Completed</Badge> : null}
          {bookmarked ? <Badge tone="amber">Bookmarked</Badge> : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{lesson.title}</h1>
        <p className="text-muted max-w-3xl text-sm leading-relaxed">{lesson.summary}</p>
        {/*
          The compiled textbook ships beside the hub; the slug is the same rule
          the textbook compiler applies to its headings. The agentic book names
          its lesson headings by title alone.
        */}
        <p className="mt-1 text-sm">
          <a
            className="no-underline hover:underline"
            style={{ color: 'var(--accent)' }}
            href={`../hub/textbooks/agentic-ai-academy.html#${lesson.title
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .trim()
              .replace(/\s+/g, '-')}`}
          >
            This lesson in the textbook →
          </a>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={() => (completed ? progress.uncompleteLesson(lesson.slug) : progress.completeLesson(lesson.slug))}>
            {completed ? 'Mark as not complete' : 'Mark lesson complete'}
          </Button>
          <Button size="sm" onClick={() => progress.toggleBookmark(lesson.slug)}>
            {bookmarked ? 'Remove bookmark' : 'Bookmark'}
          </Button>
          <Button
            size="sm"
            onClick={() => progress.setDifficulty(lesson.slug, difficulty === 'advanced' ? 'core' : 'advanced')}
            aria-label={`${difficulty === 'advanced' ? 'Switch to core track' : 'Switch to advanced track'} — toggle the lesson difficulty track (currently ${difficulty})`}
            aria-pressed={difficulty === 'advanced'}
            disabled={!track.hasExtraMaterial}
            title={
              track.hasExtraMaterial
                ? 'Switch between the core treatment and the deeper advanced treatment'
                : 'This lesson has no additional advanced material yet'
            }
          >
            {difficulty === 'advanced' ? 'Switch to core track' : 'Switch to advanced track'}
          </Button>
        </div>
        {track.hasExtraMaterial ? (
          <p className="text-muted max-w-3xl text-xs">{track.description}</p>
        ) : null}
        {lesson.prerequisites.length > 0 ? (
          <p className="text-muted text-xs">
            Prerequisites:{' '}
            {lesson.prerequisites.map((prerequisite, index) => (
              <span key={prerequisite}>
                {index > 0 ? ', ' : ''}
                <button className="focus-ring underline" onClick={() => navigate(`/lesson/${prerequisite}`)}>
                  {prerequisite.replace(/-/g, ' ')}
                </button>
              </span>
            ))}
          </p>
        ) : (
          <p className="text-muted text-xs">No prerequisites: this is an entry point into the course.</p>
        )}
      </header>

      <Tabs
        idPrefix="lesson-tabs"
        ariaLabel="Lesson sections"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'lesson', label: 'Lesson' },
          { id: 'quiz', label: `Assessment (${track.questions.length})` },
          { id: 'sources', label: 'Sources & provenance' },
        ]}
      />

      <TabPanel idPrefix="lesson-tabs" id="lesson" active={tab === 'lesson'}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <Panel
              title="Learning objectives"
              subtitle="Derived from the textbook sections listed in the right-hand column. Tick an objective once you can explain it without looking."
            >
              <ul className="space-y-2 text-sm">
                {lesson.objectives.map((objective, index) => {
                  const checked = progress.isObjectiveChecked(lesson.slug, index)
                  return (
                    <li key={objective.text} className="flex flex-wrap items-baseline justify-between gap-2">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => progress.toggleObjective(lesson.slug, index)}
                          className="focus-ring mt-1 h-4 w-4 shrink-0"
                          aria-label={`Mark objective as understood: ${objective.text}`}
                        />
                        <span className={cn('min-w-0', checked && 'text-muted line-through decoration-1')}>{objective.text}</span>
                      </label>
                      <span className="text-muted text-[11px]">{objective.source}</span>
                    </li>
                  )
                })}
              </ul>
              <p className="text-muted mt-3 text-[11px]">
                {mastery.objectivesChecked} of {mastery.objectivesTotal} objectives marked.{' '}
                {mastery.mastered
                  ? 'This lesson is mastered: every objective is ticked and every question has been answered correctly at least once.'
                  : mastery.objectivesChecked === mastery.objectivesTotal
                    ? 'All objectives ticked — now make sure every question has been answered correctly at least once.'
                    : 'A lesson counts as mastered when every objective is ticked and every question has been answered correctly at least once.'}
              </p>
            </Panel>

            {track.sections.map((section, index) => (
              <section key={section.id} id={`section-${section.id}`} className="scroll-mt-24 space-y-4">
                <h2 className="text-lg font-semibold tracking-tight">
                  <span className="text-muted mr-2 font-mono text-sm">{String(index + 1).padStart(2, '0')}</span>
                  {section.title}
                </h2>
                <div className="space-y-4">
                  {section.blocks.map((block, blockIndex) => (
                    <LessonBlockView key={`${section.id}-${blockIndex}`} block={block} lessonSlug={lesson.slug} />
                  ))}
                </div>
              </section>
            ))}

            {lesson.slug === 'scaling-laws-and-efficiency' ? (
              <Panel
                title="Interactive: compute-optimal scaling"
                subtitle="Equation 4.2 fitted with the book's Chinchilla coefficients (E≈1.69, A≈406.4, B≈410.7, α≈0.34, β≈0.28). A teaching approximation, not the experimental data."
              >
                <Suspense fallback={<p className="text-muted text-xs">Loading the interactive scaling explorer…</p>}>
                  <ScalingExplorer />
                </Suspense>
              </Panel>
            ) : null}
          </div>

          <aside className="space-y-4">
            <Card className="p-4">
              <LessonOutline
                sections={track.sections.map((section) => ({ id: section.id, title: section.title }))}
                onSelect={(id) => {
                  const target = document.getElementById(`section-${id}`)
                  if (!target) return
                  target.scrollIntoView({ block: 'start', behavior: 'smooth' })
                  target.classList.add('section-flash')
                  window.setTimeout(() => target.classList.remove('section-flash'), 1600)
                }}
              />
            </Card>

            <Card className="space-y-3 p-4">
              <h3 className="text-sm font-semibold">Progress</h3>
              <ProgressBar value={progress.completionRatio} label={`${progress.completedCount} of ${progress.totalLessons} lessons complete`} />
              <p className="text-muted text-xs">
                Quiz accuracy so far: {(progress.quizAccuracy * 100).toFixed(0)}% across {progress.answeredQuestionIds.length} answered questions.
              </p>
            </Card>

            <Card className="space-y-2 p-4">
              <h3 className="text-sm font-semibold">Book chapters used</h3>
              <ul className="space-y-1 text-xs">
                {lesson.provenance.textbookChapters.map((chapterNumber) => {
                  const chapter = CHAPTER_BY_NUMBER.get(chapterNumber)
                  return (
                    <li key={chapterNumber} className="text-muted">
                      {chapter ? `Ch. ${chapter.number} · ${chapter.title}` : `Chapter ${chapterNumber}`}
                      {chapter?.isCaseStudy ? ' (case study)' : ''}
                      {chapter?.isAdvanced ? ' (advanced *)' : ''}
                    </li>
                  )
                })}
              </ul>
              <p className="text-muted border-t pt-2 text-[11px]" style={{ borderColor: 'var(--border-soft)' }}>
                {lesson.provenance.supplementaryNote}
              </p>
            </Card>

            <Card className="space-y-2 p-4">
              <h3 className="text-sm font-semibold">Keywords</h3>
              <div className="flex flex-wrap gap-1">
                {lesson.keywords.map((keyword) => (
                  <Badge key={keyword} tone="neutral">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      </TabPanel>

      <TabPanel idPrefix="lesson-tabs" id="quiz" active={tab === 'quiz'}>
        <div className="space-y-4">
          <p className="text-muted text-sm">
            Every question carries an explanation and a chapter reference. Attempts are recorded locally, and your latest attempt for each question is
            kept.
          </p>
          {difficulty === 'core' && lesson.advancedQuiz.length > 0 ? (
            <p className="text-muted text-xs">
              You are on the core track, so {lesson.advancedQuiz.length} advanced question(s) are hidden. Switch to the advanced track to include them.
            </p>
          ) : null}
          <QuizRunner questions={track.questions} lessonSlug={lesson.slug} />
        </div>
      </TabPanel>

      <TabPanel idPrefix="lesson-tabs" id="sources" active={tab === 'sources'}>
        <div className="space-y-4">
          <Panel title="Source references" subtitle="Sections of the textbook this lesson is built from.">
            <ul className="space-y-2 text-sm">
              {lesson.sources.map((source) => (
                <li key={source.label} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>{source.label}</span>
                  <span className="text-muted text-[11px]">
                    {source.page ? `page ${source.page} · ` : ''}
                    {source.primary ? 'primary source' : 'supplementary'}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Provenance" subtitle="What is textbook material and what was authored for this course.">
            <div className="space-y-3 text-sm">
              <Markdown text={lesson.provenance.supplementaryNote} />
              <p className="text-muted text-xs">
                Textbook: Agentic Large Language Models (arXiv:2610.13455v1) · chapters {lesson.provenance.textbookChapters.join(', ')}. Diagrams in this
                lesson are original SVG authored for the course.
              </p>
            </div>
          </Panel>
          {furtherReading.length > 0 ? (
            <Panel
              title="Further reading"
              subtitle="The primary literature behind this lesson. The textbook is a survey; these are the papers it is summarising."
            >
              <ul className="space-y-3 text-sm">
                {furtherReading.map((entry) => (
                  <li key={entry.referenceId}>
                    {entry.reference ? (
                      <a
                        href={entry.reference.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="focus-ring font-medium underline decoration-dotted underline-offset-4"
                      >
                        {entry.reference.title}
                      </a>
                    ) : (
                      <span className="font-medium">{entry.referenceId}</span>
                    )}
                    <span className="text-muted text-xs">
                      {' '}
                      · {entry.reference?.authors ?? ''} · {entry.reference?.year ?? ''}
                    </span>
                    <p className="text-muted mt-0.5 text-xs leading-relaxed">{entry.note}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </TabPanel>

      <nav className="flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--border-soft)' }} aria-label="Lesson navigation">
        <Button disabled={!previous} onClick={() => previous && navigate(`/lesson/${previous.slug}`)}>
          ← {previous ? previous.title : 'Start of course'}
        </Button>
        <Button variant="primary" disabled={!next} onClick={() => next && navigate(`/lesson/${next.slug}`)}>
          {next ? next.title : 'End of released curriculum'} →
        </Button>
      </nav>
    </article>
  )
}
