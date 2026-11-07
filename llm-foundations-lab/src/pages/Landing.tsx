import { Link } from '../components/layout/CourseLink.tsx'
import { LESSONS, MODULES } from '../content/curriculum'
import { LABS } from '../content/labs'
import { GLOSSARY, FORMULAS } from '../content/glossary'
import { useProgress } from '../state/hooks'
import { buildLearningPath } from '../core/path'
import { Badge, Button, Callout, Panel, ProgressBar, Stat } from '../components/ui/primitives'
import { InlineMath } from '../components/ui/Math'
import { CollectionPanel } from '../components/layout/CollectionPanel'

/*
  The number of questions, computed from the curriculum rather than from the
  question bank, so that the bank — a hundred kilobytes of prose — is not
  pulled into the bundle of every page just to be counted.
*/
const questionCount = LESSONS.reduce((total, lesson) => total + lesson.quizIds.length, 0)

export function LandingPage() {
  const { summary, isComplete } = useProgress()
  // The landing page names the next lesson, not just the dashboard, because
  // that is what a returning reader came for.
  const path = buildLearningPath(LESSONS, isComplete)
  const nextLesson = path.recommendation?.lesson
  const nextReason = path.recommendation?.reason

  return (
    <div className="animate-rise space-y-10">
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Badge tone="teal">interactive course · computed in your browser</Badge>
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-fg sm:text-4xl lg:text-5xl">
            Understand large language models by changing their numbers.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted">
            LLM Foundations Lab turns <em>Foundations of Large Language Models</em> by Tong Xiao and Jingbo Zhu into a
            working laboratory. Edit a sentence and watch attention weights recompute; move a temperature slider and watch
            a real softmax change; train a tiny model and watch the loss fall because gradients were applied; derive DPO
            and check the gradient against a finite difference.
          </p>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            Every figure on this site is produced by code that runs in front of you.{' '}
            <span className="text-fg">There is no server, no account and no API key</span> — and no pretend language model
            behind the diagrams. Where a demonstration is a simplification, the page says so and states what it assumes.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to={`/lessons/${LESSONS[0].id}`} className="no-underline">
              <Button variant="primary">Start with lesson 1</Button>
            </Link>
            <Link to="/playground" className="no-underline">
              <Button>Open the playground</Button>
            </Link>
            <Link to="/dashboard" className="no-underline">
              <Button variant="ghost">My dashboard</Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Lessons" value={LESSONS.length} tone="indigo" />
            <Stat label="Quiz items" value={questionCount} tone="teal" />
            <Stat label="Glossary terms" value={GLOSSARY.length} tone="amber" />
            <Stat label="Formulas" value={FORMULAS.length} tone="indigo" />
          </div>
        </div>

        <Panel className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-fg">What “interactive” means here</h2>
          <ul className="space-y-3 text-sm leading-relaxed text-muted">
            <li>
              <strong className="text-fg">Real arithmetic.</strong> The Transformer Explorer computes embeddings,
              projections, scaled scores, the causal mask, softmax weights, the attention output and the next-token
              distribution from the matrices on screen.
            </li>
            <li>
              <strong className="text-fg">Real training.</strong> The learning lab runs minibatch gradient descent on a
              bigram language model. The gradient it applies is checked against a finite difference in the same panel and
              in the test suite.
            </li>
            <li>
              <strong className="text-fg">Real sampling.</strong> The decoding lab filters an explicit logit vector with
              temperature, top-k and top-p, renormalises, draws with a seeded generator and validates itself with 20,000
              Monte-Carlo draws.
            </li>
            <li>
              <strong className="text-fg">Labelled simplifications.</strong> Toy vocabularies, hand-written transition
              tables and illustrative power laws are marked as such wherever they appear.
            </li>
          </ul>
          <div className="rounded-xl border border-line bg-panel-2/50 p-3 text-xs text-muted">
            Attention is the entry point: <InlineMath tex="\operatorname{Att}(Q,K,V) = \operatorname{Softmax}\!\left(\frac{QK^{\top}}{\sqrt{d}} + M\right)V" />
          </div>
        </Panel>
      </section>

      {summary.lessonsVisited > 0 ? (
        <Panel className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-[16rem] flex-1">
            <p className="text-sm text-fg">
              Welcome back — you have visited {summary.lessonsVisited} lesson
              {summary.lessonsVisited === 1 ? '' : 's'}.
              {nextLesson ? (
                <>
                  {' '}
                  Next up:{' '}
                  <Link to={`/lessons/${nextLesson.id}`} className="text-indigo underline underline-offset-2">
                    {nextLesson.title}
                  </Link>
                  {nextReason ? <span className="text-muted"> — {nextReason}</span> : null}
                </>
              ) : null}
            </p>
            <div className="mt-2">
              <ProgressBar value={summary.lessonsCompleted} max={LESSONS.length} label="Lessons completed" tone="teal" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {nextLesson ? (
              <Link to={`/lessons/${nextLesson.id}`} className="no-underline">
                <Button size="sm" variant="primary">
                  Continue where you left off
                </Button>
              </Link>
            ) : null}
            <Link to="/dashboard" className="no-underline">
              <Button size="sm">Open the dashboard</Button>
            </Link>
          </div>
        </Panel>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-indigo">Curriculum</p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-fg">
              Six modules, mirroring the source structure
            </h2>
            <p className="mt-1 text-sm text-muted">
              The book’s six chapters — pre-training, generative models, prompting, alignment, inference and reasoning —
              appear here one-to-one, with section and page references for every lesson.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((module) => {
            const lessons = LESSONS.filter((lesson) => lesson.moduleId === module.id)
            return (
              <Panel key={module.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[11px] text-faint">chapter {module.chapter} · {module.pages}</p>
                    <h3 className="font-display text-lg font-semibold text-fg">{module.title}</h3>
                  </div>
                  <Badge tone={module.accent}>{lessons.length} lessons</Badge>
                </div>
                <p className="text-sm leading-relaxed text-muted">{module.summary}</p>
                <ul className="space-y-1.5 text-xs">
                  {lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <Link to={`/lessons/${lesson.id}`} className="text-indigo hover:underline">
                        {String(lesson.number).padStart(2, '0')} · {lesson.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-2">
                  <Link to={`/modules/${module.id}`} className="no-underline">
                    <Button size="sm" variant="secondary">
                      Module overview
                    </Button>
                  </Link>
                </div>
              </Panel>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel>
          <h2 className="font-display text-lg font-semibold text-fg">{LABS.length} laboratories</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            {LABS.map((lab) => (
              <li key={lab.tab}>
                {lab.title} — {lab.blurb}
              </li>
            ))}
          </ul>
          <Link to="/playground" className="mt-3 inline-block no-underline">
            <Button size="sm">Open the playground</Button>
          </Link>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-semibold text-fg">Assessment that explains itself</h2>
          <p className="mt-2 text-sm text-muted">
            {questionCount} questions across {LESSONS.length} lessons. Some require applying an equation, and every
            wrong option carries a specific diagnosis. Results are stored with your progress.
          </p>
          <Link to="/practice" className="mt-3 inline-block no-underline">
            <Button size="sm">Practise now</Button>
          </Link>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-semibold text-fg">Progress you own</h2>
          <p className="mt-2 text-sm text-muted">
            Lesson completion, quiz answers, bookmarks, notes and saved playground configurations live in your browser’s
            storage. Export them as JSON at any time, import them on another machine, or reset everything with one click.
          </p>
          <Link to="/dashboard" className="mt-3 inline-block no-underline">
            <Button size="sm">See the dashboard</Button>
          </Link>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-semibold text-fg">It comes back when you are about to forget</h2>
          <p className="mt-2 text-sm text-muted">
            Every question you answer is scheduled with <strong className="text-fg">SM-2</strong>, the algorithm behind
            SuperMemo and Anki, and comes back just before you would have forgotten it. The schedule lives in your
            progress file, and the dashboard says what is due.
          </p>
          <Link to="/review" className="mt-3 inline-block no-underline">
            <Button size="sm">Open the review session</Button>
          </Link>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-semibold text-fg">It works with no network at all</h2>
          <p className="mt-2 text-sm text-muted">
            The published build carries a service worker that caches the whole course, so it opens and works with the
            network switched off. Press <strong className="text-fg">⌘K</strong> — or <strong className="text-fg">Ctrl K</strong>{' '}
            — to search the course or run a command without touching the mouse.
          </p>
          <Link to="/dashboard" className="mt-3 inline-block no-underline">
            <Button size="sm">See what you have done</Button>
          </Link>
        </Panel>
      </section>

      <CollectionPanel />

      <Callout tone="amber" title="Attribution and licence">
        This course is adapted from <strong>Foundations of Large Language Models</strong> by Tong Xiao and Jingbo Zhu
        (NLP Lab, Northeastern University &amp; NiuTrans Research), arXiv:2501.09223v4, 8 October 2026. The revision in
        this workspace states the Creative Commons{' '}
        <strong>Attribution-NonCommercial 4.0</strong> licence (CC BY-NC 4.0) — note that this differs from CC BY 4.0, and
        the non-commercial restriction is honoured here. All lesson text, figures and code on this site are original
        adaptations; no figures, tables or extended passages from the book are reproduced.{' '}
        <Link to="/sources" className="text-indigo underline">
          Read the full attribution and licensing statement
        </Link>
        .
      </Callout>

      <Callout tone="indigo" title="How much of this is settled?">
        A book cannot be as current as the field it describes, and a course that does not say which of its claims
        are durable is asking the reader to guess. Each module here says what holds, what is still moving, and where
        the next version of it is being written.{' '}
        <Link to="/status" className="text-indigo underline">
          Read what has moved since the book
        </Link>
        .
      </Callout>
    </div>
  )
}

export default LandingPage
