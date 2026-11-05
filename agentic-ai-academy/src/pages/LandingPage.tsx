import { navigate } from '../app/router'
import { BOOK, CHAPTERS, PARTS } from '../content/book'
import { ALL_QUESTIONS, LESSONS, PREDICT_QUESTIONS, TOTAL_STUDY_MINUTES } from '../content/lessons'
import { LABS } from '../content/labs'
import { GLOSSARY } from '../content/glossary'
import { Badge, Button, Card, cn } from '../ui/primitives'
import { NetworkBackdrop } from '../ui/NetworkBackdrop'
import { useProgress } from '../store/progress'
import { CollectionPanel } from '../ui/CollectionPanel'

/**
 * How many relations the concept map draws.
 *
 * The count is computed from the glossary rather than from the graph, because
 * the graph runs a layout simulation and this page only needs a number.
 */
const RELATION_COUNT = new Set(
  GLOSSARY.flatMap((entry) => entry.related.map((related) => [entry.term, related].sort().join('|'))),
).size

export function LandingPage() {
  const { completedCount, totalLessons, lastLessonSlug } = useProgress()

  // The counts are read from the content rather than written into the prose,
  // so adding a lesson or a question cannot leave this page claiming a
  // number that is no longer true.
  const advancedSections = LESSONS.reduce((sum, lesson) => sum + lesson.advancedSections.length, 0)
  const advancedQuestions = LESSONS.reduce((sum, lesson) => sum + lesson.advancedQuiz.length, 0)

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border p-6 sm:p-10" style={{ borderColor: 'var(--border-soft)' }}>
        <NetworkBackdrop className="pointer-events-none absolute inset-0 h-full w-full opacity-45" />
        <div
          aria-hidden
          className="drift pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--accent), transparent 65%)' }}
        />
        <div
          aria-hidden
          className="drift pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--accent-2), transparent 65%)' }}
        />
        <div className="relative space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cyan">Graduate-level interactive course</Badge>
            <Badge tone="violet">Built on arXiv:{BOOK.arxivId}</Badge>
            <Badge tone="neutral">Local-first · no accounts · no API keys</Badge>
          </div>
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Learn how language models become agents — by building, running and inspecting them.
          </h1>
          <p className="text-muted max-w-3xl text-sm leading-relaxed sm:text-base">
            Agentic AI Academy is a complete interactive course derived from <strong>{BOOK.title}</strong> by {BOOK.authors.join(', ')}. Every lesson is
            mapped to the book's chapters, every concept is paired with a diagram and a definition you can open in place, and every major technique has a
            deterministic simulation you can run, pause, reset and measure.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => navigate(lastLessonSlug ? `/lesson/${lastLessonSlug}` : '/lesson/what-agentic-llms-are')}>
              {lastLessonSlug ? 'Continue where you left off' : 'Start with lesson 1'}
            </Button>
            <Button onClick={() => navigate('/builder')}>Open the workflow builder</Button>
            <Button variant="ghost" onClick={() => navigate('/curriculum')}>
              Browse the curriculum
            </Button>
          </div>
          <dl className="grid grid-cols-2 gap-4 pt-2 sm:grid-cols-4">
            {[
              { label: 'Authored lessons', value: String(LESSONS.length) },
              { label: 'Assessment questions', value: String(ALL_QUESTIONS.length) },
              { label: 'Interactive labs', value: String(LABS.length) },
              { label: 'Study time', value: `${Math.round(TOTAL_STUDY_MINUTES / 60)} h` },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-muted text-[11px] tracking-wide uppercase">{stat.label}</dt>
                <dd className="text-2xl font-semibold">{stat.value}</dd>
              </div>
            ))}
          </dl>
          {completedCount > 0 ? (
            <p className="text-muted text-xs">
              Your local progress: {completedCount} of {totalLessons} lessons complete.
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">The book, mapped into a course</h2>
        <p className="text-muted max-w-3xl text-sm">
          The textbook runs to {CHAPTERS.length} chapters in seven parts. This release authors {LESSONS.length} lessons that cover{' '}
          <strong>every one of those {CHAPTERS.length} chapters</strong>, and the curriculum schema is built to accept more lessons without changing
          the reader, progress or assessment layers. The <em>Curriculum → Source map</em> view states, for each chapter, which lessons cover it and
          which sections of the book they draw on.
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PARTS.map((part) => {
            const lessons = LESSONS.filter(
              (lesson) => lesson.part === part.id || lesson.secondaryParts.includes(part.id),
            )
            const chapters = CHAPTERS.filter((chapter) => chapter.part === part.id)
            return (
              <Card key={part.id} className={cn('flex flex-col gap-3 p-4 transition hover:-translate-y-0.5')}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    Part {part.order} · {part.title}
                  </h3>
                  <Badge tone={part.accent}>
                    {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
                  </Badge>
                </div>
                <p className="text-muted text-xs leading-relaxed">{part.summary}</p>
                <ul className="text-muted space-y-1 text-[11px]">
                  {chapters.map((chapter) => (
                    <li key={chapter.number}>
                      Ch. {chapter.number} · {chapter.title}
                      {chapter.isCaseStudy ? ' — case study' : ''}
                      {chapter.isAdvanced ? ' — advanced' : ''}
                    </li>
                  ))}
                </ul>
                {lessons.length > 0 ? (
                  <div className="mt-auto flex flex-wrap gap-1">
                    {lessons.map((lesson) => (
                      <button
                        key={lesson.slug}
                        type="button"
                        onClick={() => navigate(`/lesson/${lesson.slug}`)}
                        className="focus-ring surface-2 rounded-md border px-2 py-1 text-[11px] hover:opacity-90"
                        style={{ borderColor: 'var(--border-soft)' }}
                      >
                        {lesson.title}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted mt-auto text-[11px]">
                    Lessons for this part are on the roadmap; the chapter inventory is already in the curriculum navigator.
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold tracking-tight">Two real difficulty tracks</h2>
          <p className="text-muted text-sm leading-relaxed">
            Every lesson ships a core treatment and an advanced one. The advanced track adds a deeper section — derivations, counterexamples and the
            open questions the textbook flags — plus two harder questions. The toggle is per lesson, it changes what is actually on screen, and it
            persists.
          </p>
          <ul className="text-muted grid gap-1 text-xs sm:grid-cols-2">
            {[
              `${advancedSections} advanced sections, ${advancedQuestions} advanced questions`,
              'Core track stays the complete essential treatment',
              'Assessment centre can practise with either set',
              'Your choice is remembered per lesson',
            ].map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold tracking-tight">Find anything, fast</h2>
          <p className="text-muted text-sm leading-relaxed">
            Press <kbd className="rounded border px-1 text-[10px]">/</kbd> (or{' '}
            <kbd className="rounded border px-1 text-[10px]">Ctrl</kbd> <kbd className="rounded border px-1 text-[10px]">K</kbd> /{' '}
            <kbd className="rounded border px-1 text-[10px]">⌘</kbd> <kbd className="rounded border px-1 text-[10px]">K</kbd>) to search the whole
            course: lesson text, glossary definitions, assessment questions, laboratory descriptions and references. The ranking is deterministic
            and runs entirely in the browser.
          </p>
          <ul className="text-muted grid gap-1 text-xs sm:grid-cols-2">
            {[
              'Searches lesson bodies, not just titles',
              'Jumps to the exact section you meant',
              'Glossary and reference deep links',
              'No network request, ever',
            ].map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold tracking-tight">Predict before you know</h2>
          <p className="text-muted text-sm leading-relaxed">
            Every lesson ends with a question you have to <strong>commit to an answer for</strong> before the explanation appears. Retrieving a fact is
            easy; recognising that you did not know it is what makes the fact stick. A wrong prediction is recorded, so it comes back for review like any
            other mistake.
          </p>
          <ul className="text-muted grid gap-1 text-xs sm:grid-cols-2">
            {[
              `${PREDICT_QUESTIONS.length} predictions, one per lesson`,
              'Explanations hidden until you commit',
              'Mistakes join the review queue',
              'Definitions open inside the text',
            ].map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold tracking-tight">See how the ideas connect</h2>
          <p className="text-muted text-sm leading-relaxed">
            The glossary is {GLOSSARY.length} concepts, and the book is about how they relate. The concept map draws those {RELATION_COUNT}{' '}
            relations, coloured by the part of the textbook each one comes from, and takes you from a definition straight to the lesson — or the
            demonstration — where you can try it.
          </p>
          <ul className="text-muted grid gap-1 text-xs sm:grid-cols-2">
            {[
              'Deterministic layout, the same every time',
              'No concept is left unconnected',
              'Related terms are links, not text',
              'Route from a term to a demonstration',
            ].map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold tracking-tight">The course on one page</h2>
          <p className="text-muted text-sm leading-relaxed">
            The textbook is a survey, and a survey points at the papers it is summarising. Every lesson names them — with a link and a sentence on
            why that paper is worth your time — and the closing lesson puts the whole course on one page: the three pillars, the cycle that connects
            them, and the eight ideas that recur across the book.
          </p>
          <ul className="text-muted grid gap-1 text-xs sm:grid-cols-2">
            {[
              'Reasoning, acting, interacting',
              'The eight ideas, with a route to each',
              'Further reading on every lesson',
              'Licences verified and recorded',
            ].map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
          <Button size="sm" variant="ghost" onClick={() => navigate('/lesson/future-directions#section-synthesis')}>
            Go to the one-page summary
          </Button>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold tracking-tight">A flagship you can actually execute</h2>
          <p className="text-muted text-sm leading-relaxed">
            The Visual Agent Workflow Builder is a real node editor over a typed, deterministic execution engine. Ten node types, branch routing, memory
            retrieval with eviction, scripted tool calls with injected failures, step/pause/reset control, an execution trace with tool input and output
            inspection, state inspection and success scoring. Nothing is decorative: every run is reproducible and covered by unit tests.
          </p>
          <ul className="text-muted grid gap-1 text-xs sm:grid-cols-2">
            {[
              'Input, planner, reasoning, tool, memory, observation',
              'Decision, evaluator, reflection, final response',
              'Four learning scenarios including a broken pipeline',
              'Explicit error states for dead ends and exhausted retries',
            ].map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => navigate('/builder')}>
              Design a workflow
            </Button>
            <Button onClick={() => navigate('/labs')}>See all labs</Button>
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold tracking-tight">Honest by construction</h2>
          <ul className="text-muted space-y-2 text-xs leading-relaxed">
            <li>
              <strong className="text-slate-200">No model calls.</strong> Every simulation is a scripted, seeded engine. The UI never presents simulated
              behaviour as deployed model output.
            </li>
            <li>
              <strong className="text-slate-200">Source-mapped.</strong> Lessons carry chapter and section references, and a provenance note separating
              textbook material from supplementary course writing.
            </li>
            <li>
              <strong className="text-slate-200">Licence-aware.</strong> Third-party projects are linked, never copied, with verified licence notes on
              the references page.
            </li>
            <li>
              <strong className="text-slate-200">Local-first.</strong> Progress, bookmarks and quiz attempts live in your browser and can be exported as
              JSON.
            </li>
          </ul>
        </Card>
      </section>

      <CollectionPanel />
    </div>
  )
}
