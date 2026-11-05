import { Link } from '../components/layout/CourseLink.tsx'
import { MODULES, getModule } from '../content/curriculum'
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_TONE,
  MODULE_STATUS,
  STATUS_CHECKED_LABEL,
  type Confidence,
} from '../content/status'
import { Badge, Callout, Panel } from '../components/ui/primitives'
import { scrollToSection } from '../components/layout/scrollToSection'

/**
 * How settled is this?
 *
 * The course is an adaptation of the fourth revision of *Foundations of Large
 * Language Models* (Xiao and Zhu), dated 8 October 2026. A book that recent
 * cannot have been overtaken by the literature — but the literature moves
 * faster than any book, and a reader deserves to know which of the course's
 * claims are settled, which are settling, and which are open.
 *
 * So each module carries two things: what the book establishes, and what is
 * still moving. The sources are the primary ones.
 */

const TONE_EXPLANATION: Record<Confidence, string> = {
  settled:
    'The mechanism has been stable for long enough that it is not going to be revised. Treat it as background.',
  settling:
    'The mechanism is not in doubt, but the best way to do it is still changing. The course teaches the mechanism; the advice about which variant to use may age.',
  moving:
    'The mechanism is understood, but the field is actively changing the details and the best practice. The course teaches the current best understanding, and the sources below are where the next version of it is being written.',
  open:
    'This is where the field is moving fastest. The course teaches the current best understanding, and the sources below are where the next version of it is being written.',
}

export function StatusPage() {
  return (
    <div className="animate-rise space-y-6">
      <header className="space-y-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">How settled is this?</h1>
        <p className="max-w-3xl text-sm text-muted">
          This course is an adaptation of the fourth revision of{' '}
          <span className="text-fg">Foundations of Large Language Models</span> by Tong Xiao and Jingbo Zhu, dated 8
          October 2026. That is a recent book, but the literature moves faster than any book, and a reader is better
          served by knowing which parts of a course are settled and which are not.
        </p>
        <p className="max-w-3xl text-sm text-muted">
          Each module below says what the book establishes and why it holds, and then what is still moving — with the
          primary sources, so that a reader who wants to go further can. Nothing here retracts a lesson. It says how
          much weight to put on each one.
        </p>
      </header>

      <Callout tone="indigo" title="This page will age too">
        A page that records what has moved since a date is itself a snapshot. Every source below was checked on{' '}
        <span className="text-fg">{STATUS_CHECKED_LABEL}</span>, and it is accurate as of the revision named above and
        no later. The sources are the primary ones rather than the summaries, so that a reader can check it rather than
        take it on trust.
      </Callout>

      <nav aria-label="The modules" className="flex flex-wrap gap-2">
        {MODULE_STATUS.map((status) => {
          const module = getModule(status.moduleId)
          if (!module) return null
          return (
            <a
              key={status.moduleId}
              href={`#${status.moduleId}`}
              onClick={(event) => {
                /*
                 * The application uses a hash router, so the fragment of the
                 * address is the route. A plain `href="#pre-training"` would
                 * replace the route with the word "pre-training", and the
                 * reader would be taken to the page that says the address is
                 * not part of the course. The link scrolls to the module
                 * instead, and keeps the route in the address.
                 */
                event.preventDefault()
                scrollToSection(status.moduleId)
              }}
              className="rounded-lg border border-line bg-panel-2/50 px-3 py-1.5 text-xs text-muted no-underline hover:border-indigo/50 hover:text-fg"
            >
              {module.chapter}. {module.title}
              <span className="ml-2 text-faint">{CONFIDENCE_LABEL[status.confidence]}</span>
            </a>
          )
        })}
      </nav>

      <div className="space-y-4">
        {MODULE_STATUS.map((status) => {
          const module = getModule(status.moduleId)
          if (!module) return null
          return (
            <Panel key={status.moduleId} as="section" id={status.moduleId} className="scroll-mt-24 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-semibold text-fg">
                  <span className="mr-2 font-mono text-xs text-faint">{module.chapter}.</span>
                  {module.title}
                </h2>
                <Badge tone={CONFIDENCE_TONE[status.confidence]}>
                  {CONFIDENCE_LABEL[status.confidence]}
                </Badge>
              </div>

              <p className="text-xs text-faint">{TONE_EXPLANATION[status.confidence]}</p>

              <div className="rounded-xl border border-teal/30 bg-teal/5 p-3">
                <p className="font-mono text-[11px] uppercase tracking-wider text-teal">What holds</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{status.settled}</p>
              </div>

              <div className="rounded-xl border border-amber/30 bg-amber/5 p-3">
                <p className="font-mono text-[11px] uppercase tracking-wider text-amber">What is moving</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{status.moving}</p>
              </div>

              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-faint">The sources</p>
                <ul className="mt-1 space-y-2">
                  {status.sources.map((source) => (
                    <li key={source.href} className="text-sm">
                      <a
                        href={source.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-indigo underline underline-offset-2"
                      >
                        {source.label}
                      </a>
                      <p className="mt-0.5 text-xs leading-relaxed text-faint">{source.note}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          )
        })}
      </div>

      <Panel className="space-y-2">
        <h2 className="font-display text-lg font-semibold text-fg">The rest of the course</h2>
        <p className="text-sm text-muted">
          The six modules are the whole of the taught material. The{' '}
          <Link to="/sources" className="text-indigo underline underline-offset-2">
            sources and licensing
          </Link>{' '}
          page says where the book itself came from and what licence it carries, and the{' '}
          <Link to="/math" className="text-indigo underline underline-offset-2">
            mathematical reference
          </Link>{' '}
          gives every formula the course uses.
        </p>
      </Panel>

      <p className="text-xs text-faint">
        {MODULE_STATUS.length} modules described, {MODULE_STATUS.reduce((total, s) => total + s.sources.length, 0)}{' '}
        primary sources. The course is adapted from{' '}
        {MODULES.length > 0 ? 'Foundations of Large Language Models' : 'the book'}; the licence and the attribution
        are on the sources page.
      </p>
    </div>
  )
}

export default StatusPage
