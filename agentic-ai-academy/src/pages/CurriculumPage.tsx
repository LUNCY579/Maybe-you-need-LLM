import { useMemo, useState } from 'react'
import { navigate, useRoute } from '../app/router'
import { CHAPTERS, PARTS } from '../content/book'
import { LESSONS } from '../content/lessons'
import { lessonMastery } from '../content/review'
import type { PartId } from '../types/curriculum'
import { Badge, Button, Card, Field, Select, TabPanel, Tabs } from '../ui/primitives'
import { SourceMap } from '../ui/lesson/SourceMap'
import { StudyPlanView } from '../ui/lesson/StudyPlanView'
import { useProgress } from '../store/progress'

type StatusFilter = 'all' | 'todo' | 'done' | 'bookmarked'

export function CurriculumPage() {
  const progress = useProgress()
  const route = useRoute()

  /**
   * The view the student was sent to.
   *
   * The view is read from the query string, so a link can open the study
   * plan directly rather than making the student find the tab.
   */
  const requestedView = route.query.get('view')
  const [view, setView] = useState<'navigator' | 'source-map' | 'study-plan'>(() =>
    requestedView === 'source-map' || requestedView === 'study-plan' ? requestedView : 'navigator',
  )
  const [lastRequestedView, setLastRequestedView] = useState(requestedView)
  if (lastRequestedView !== requestedView) {
    setLastRequestedView(requestedView)
    if (requestedView === 'navigator' || requestedView === 'source-map' || requestedView === 'study-plan') {
      setView(requestedView)
    }
  }

  const [part, setPart] = useState<PartId | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [difficulty, setDifficulty] = useState<'all' | 'core' | 'advanced'>('all')
  const [term, setTerm] = useState('')

  const filtered = useMemo(() => {
    const query = term.trim().toLowerCase()
    return LESSONS.filter((lesson) => {
      if (part !== 'all' && lesson.part !== part) return false
      if (status === 'done' && !progress.isCompleted(lesson.slug)) return false
      if (status === 'todo' && progress.isCompleted(lesson.slug)) return false
      if (status === 'bookmarked' && !progress.isBookmarked(lesson.slug)) return false
      if (difficulty !== 'all' && progress.difficultyFor(lesson.slug, lesson.difficulty) !== difficulty) return false
      if (query) {
        const haystack = [lesson.title, lesson.summary, ...lesson.keywords, ...lesson.objectives.map((objective) => objective.text)]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [part, status, difficulty, term, progress])

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Curriculum navigator</h1>
        <p className="text-muted max-w-3xl text-sm">
          Lessons are grouped by the textbook's seven parts. Chapter entries show where uncovered material sits, so it is clear what this release teaches
          and what remains for later editions.
        </p>
      </header>

      <Tabs
        idPrefix="curriculum-tabs"
        ariaLabel="Curriculum views"
        active={view}
        onChange={setView}
        tabs={[
          { id: 'navigator', label: 'Navigator' },
          { id: 'source-map', label: 'Source map' },
          { id: 'study-plan', label: 'Study plan' },
        ]}
      />

      <TabPanel idPrefix="curriculum-tabs" id="source-map" active={view === 'source-map'}>
        <SourceMap />
      </TabPanel>

      <TabPanel idPrefix="curriculum-tabs" id="study-plan" active={view === 'study-plan'}>
        <StudyPlanView />
      </TabPanel>

      <TabPanel idPrefix="curriculum-tabs" id="navigator" active={view === 'navigator'}>
      <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Search">
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="tokenizer, memory, MCP, RLVR…"
            aria-label="Search the curriculum"
            className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
            style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
          />
        </Field>
        <Field label="Part">
          <Select
            label="Filter by part"
            value={part}
            onChange={setPart}
            options={[{ value: 'all' as const, label: 'All parts' }, ...PARTS.map((entry) => ({ value: entry.id, label: `Part ${entry.order} · ${entry.title}` }))]}
          />
        </Field>
        <Field label="Status">
          <Select
            label="Filter by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All lessons' },
              { value: 'todo', label: 'Not completed' },
              { value: 'done', label: 'Completed' },
              { value: 'bookmarked', label: 'Bookmarked' },
            ]}
          />
        </Field>
        <Field label="Track">
          <Select
            label="Filter by difficulty track"
            value={difficulty}
            onChange={setDifficulty}
            options={[
              { value: 'all', label: 'Both tracks' },
              { value: 'core', label: 'Core' },
              { value: 'advanced', label: 'Advanced' },
            ]}
          />
        </Field>
      </Card>

      <p className="text-muted text-xs">{filtered.length} lesson(s) match your filters.</p>

      <div className="space-y-6">
        {PARTS.map((partEntry) => {
          const lessons = filtered.filter((lesson) => lesson.part === partEntry.id)
          // Lessons whose primary home is another part but which also draw on
          // this part's material, e.g. the BALROG case study (Ch. 10) which
          // the book places in Part III but this course teaches with Ch. 6.
          const crossPartLessons = filtered.filter(
            (lesson) => lesson.part !== partEntry.id && lesson.secondaryParts.includes(partEntry.id),
          )
          const chapters = CHAPTERS.filter((chapter) => chapter.part === partEntry.id)
          if (lessons.length === 0 && crossPartLessons.length === 0 && part !== 'all' && part !== partEntry.id) return null
          return (
            <section key={partEntry.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  Part {partEntry.order} · {partEntry.title}
                </h2>
                <Badge tone={partEntry.accent}>
                  {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
                </Badge>
                <span className="text-muted text-[11px]">Chapters {partEntry.chapters.join(', ')}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {lessons.map((lesson) => {
                  const completed = progress.isCompleted(lesson.slug)
                  const bookmarked = progress.isBookmarked(lesson.slug)
                  const effectiveDifficulty = progress.difficultyFor(lesson.slug, lesson.difficulty)
                  const record = lessonMastery(lesson.slug, progress.state)
                  return (
                    <Card key={lesson.slug} className="flex flex-col gap-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted font-mono text-[11px]">L{lesson.order}</span>
                        <Badge tone={effectiveDifficulty === 'advanced' ? 'amber' : 'cyan'}>{effectiveDifficulty}</Badge>
                        <Badge tone="neutral">{lesson.minutes} min</Badge>
                        {record.mastered ? <Badge tone="emerald">mastered</Badge> : null}
                        {completed ? <Badge tone="emerald">done</Badge> : null}
                        {bookmarked ? <Badge tone="violet">bookmarked</Badge> : null}
                      </div>
                      <h3 className="text-sm font-semibold">{lesson.title}</h3>
                      <p className="text-muted text-xs leading-relaxed">{lesson.summary}</p>
                      <p className="text-muted text-[11px]">
                        Covers {lesson.sources.slice(0, 3).map((source) => source.label.split(' ').slice(0, 3).join(' ')).join(' · ')}
                        {lesson.sources.length > 3 ? ' …' : ''}
                      </p>
                      <p className="text-muted text-[11px]">
                        {lesson.sections.length} section(s) · {lesson.quiz.length} question(s)
                        {lesson.advancedSections.length > 0 ? ` · +${lesson.advancedSections.length} advanced section(s)` : ''}
                        {lesson.advancedQuiz.length > 0 ? ` · +${lesson.advancedQuiz.length} advanced question(s)` : ''}
                      </p>
                      <p className="text-muted text-[11px]">
                        {record.objectivesChecked}/{record.objectivesTotal} objectives · {record.questionsCorrect}/{record.questionsTotal} questions
                        answered correctly
                      </p>
                      <div className="mt-auto pt-2">
                        <Button size="sm" variant="primary" onClick={() => navigate(`/lesson/${lesson.slug}`)}>
                          {completed ? 'Revisit lesson' : 'Start lesson'}
                        </Button>
                      </div>
                    </Card>
                  )
                })}
                {lessons.length === 0 ? (
                  <Card className="p-4">
                    <p className="text-muted text-xs">
                      No lesson in this part matches the current filters. Chapters in this part:{' '}
                      {chapters.map((chapter) => chapter.title).join(', ') || 'none'}.
                    </p>
                  </Card>
                ) : null}
              </div>

              {crossPartLessons.length > 0 ? (
                <Card className="p-4">
                  <h3 className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--accent)' }}>
                    Also taught here
                  </h3>
                  <p className="text-muted mt-1 text-[11px]">
                    These lessons are taught in another part of the book but draw on the material of Part {partEntry.order}.
                  </p>
                  <ul className="mt-2 space-y-2">
                    {crossPartLessons.map((lesson) => (
                      <li key={lesson.slug} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span>
                          <span className="text-muted mr-1 font-mono text-[11px]">L{lesson.order}</span>
                          {lesson.title}
                          <span className="text-muted ml-1 text-[11px]">· Ch. {lesson.provenance.textbookChapters.join(', ')}</span>
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/lesson/${lesson.slug}`)}>
                          Open
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </section>
          )
        })}
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Full chapter inventory (23 chapters)</h2>
        <p className="text-muted mt-1 text-xs">
          Transcribed from the book's table of contents. Chapters marked * are advanced topics; case studies are marked separately.
        </p>
        <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {CHAPTERS.map((chapter) => {
            const covering = LESSONS.filter((lesson) => lesson.provenance.textbookChapters.includes(chapter.number))
            const covered = covering.length > 0
            return (
              <li key={chapter.number} className="flex items-center gap-2">
                <Badge tone={covered ? 'emerald' : 'neutral'}>{covered ? 'covered' : 'roadmap'}</Badge>
                <span className="text-muted">
                  Ch. {chapter.number} · {chapter.title}
                  {covered ? <span className="ml-1 text-[10px]">({covering.map((lesson) => `L${lesson.order}`).join(', ')})</span> : null}
                </span>
              </li>
            )
          })}
        </ul>
      </Card>
      </TabPanel>
    </div>
  )
}
