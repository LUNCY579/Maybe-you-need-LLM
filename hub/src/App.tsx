/**
 * The front door.
 *
 * One page that knows the whole collection: the courses, the sources, the
 * learning path and the concepts they share. The data comes from the same
 * manifest the courses cite, through the shared catalogue package, so the
 * hub cannot drift from the collection it describes.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  CONCEPTS,
  CatalogueSearch,
  ConceptIndex,
  LEARNING_PATH,
  LearningPathView,
  PathEdges,
  buildCatalogueIndex,
  buildLessonIndex,
  depthOf,
  layersOf,
  parseManifest,
  type CatalogueDocument,
  type CatalogueManifest,
} from '@llm-materials/course-catalogue'
import manifestJson from './manifest.json'
import { CollectionProgressPanel, useCollectionProgress } from './Progress'
import { StartHere } from './StartHere'
import { SourceBrowser } from './SourceBrowser'
import { GlossaryPage } from './GlossaryPage'
import '@llm-materials/course-catalogue/styles.css'
import './styles.css'

const manifest: CatalogueManifest = parseManifest(manifestJson)

const BUILT = manifest.apps.filter((app) => app.status === 'built')
const PLANNED = manifest.apps.filter((app) => app.status === 'planned')
const LAYERS = layersOf(LEARNING_PATH)
const SUGGESTIONS = CONCEPTS.filter((concept) => concept.courses.length > 1).slice(0, 6)

/** The sections the header links to, in page order; the scroll spy watches these. */
const NAV_SECTIONS = [
  { id: 'start', label: 'Start here' },
  { id: 'courses', label: 'Courses' },
  { id: 'path', label: 'The path' },
  { id: 'concepts', label: 'Concepts' },
  { id: 'sources', label: 'Sources' },
  { id: 'glossary', label: 'Glossary' },
]

function App() {
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<number | 'all'>('all')
  const rows = useCollectionProgress(manifest)
  const progressById = new Map(rows.map((row) => [row.id, row]))
  const visible = level === 'all' ? BUILT : BUILT.filter((app) => depthOf(LEARNING_PATH, app.id) === level)
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (document.documentElement.dataset.theme as 'light' | 'dark') ?? 'light',
  )

  const documents = useMemo(
    () => [...buildCatalogueIndex(manifest), ...buildLessonIndex('', './')],
    [manifest],
  )

  /*
    How many lessons each built course has, from the same collected index the
    cross-course search reads. A course whose lessons are not in the index (the
    three standalone courses) gets no bar — the hub does not know its total, so
    it does not claim one.
  */
  const lessonTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const document of documents) {
      if (document.kind === 'Lesson' && document.app) {
        totals.set(document.app, (totals.get(document.app) ?? 0) + 1)
      }
    }
    return totals
  }, [documents])

  /* The header underlines the section the reader is looking at. */
  const [activeSection, setActiveSection] = useState<string | null>(null)
  useEffect(() => {
    const sections = NAV_SECTIONS.map((section) => document.getElementById(section.id)).filter(
      (element): element is HTMLElement => element !== null,
    )
    if (sections.length === 0 || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        }
      },
      { rootMargin: '-15% 0px -65% 0px' },
    )
    for (const section of sections) observer.observe(section)
    return () => observer.disconnect()
  }, [])

  /*
    Opening a search hit.

    The catalogue's own hrefs are only meaningful where a router reads them;
    the hub has no router, so a hit the hub can show in place is shown in
    place — a source is focused in the source browser, a concept is
    highlighted in the index — and a hit that lives in a course navigates
    there.
  */
  const [focusSourceId, setFocusSourceId] = useState<string | null>(null)
  const [focusTerm, setFocusTerm] = useState<string | null>(null)
  const openDocument = (hit: CatalogueDocument) => {
    if (hit.kind === 'Course') {
      window.location.assign(`../${hit.app}/`)
      return
    }
    if (hit.kind === 'Lesson') {
      window.location.assign(hit.href.replace(/^\.\//, '../'))
      return
    }
    if (hit.kind === 'Source') {
      setFocusSourceId(hit.id.replace(/^source:/, ''))
      document.getElementById('sources')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    if (hit.kind === 'Concept') {
      setFocusTerm(hit.title)
      document.getElementById('concepts')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    document.getElementById('path')?.scrollIntoView({ behavior: 'smooth' })
  }

  /* Pressing / anywhere outside a field jumps to the search box. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      const search = document.getElementById('hub-search')
      if (!search) return
      event.preventDefault()
      search.focus()
      search.scrollIntoView({ block: 'center' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('llm-materials:theme', next)
    } catch {
      // A browser with storage disabled still gets the theme for this session.
    }
  }

  return (
    <div className="hub">
      <a className="hub-skip" href="#main">
        Skip to the content
      </a>

      <header className="hub-header">
        <div className="hub-header-inner">
          <div className="hub-brand">
            <span className="hub-brand-mark" aria-hidden="true">
              ◆
            </span>
            <span>
              <strong>LLM Materials</strong>
              <span className="hub-brand-note">a collection of source-mapped learning applications</span>
            </span>
          </div>
          <nav className="hub-nav" aria-label="The collection">
            {NAV_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={activeSection === section.id ? 'true' : undefined}
              >
                {section.label}
              </a>
            ))}
            <button type="button" className="hub-theme" onClick={toggleTheme}>
              Switch to the {theme === 'dark' ? 'light' : 'dark'} theme
            </button>
            <a href="textbooks/index.html">Textbooks</a>
          </nav>
        </div>
      </header>

      <main id="main" className="hub-main">
        <section className="hub-hero">
          <h1>{BUILT.length} courses, one collection, and every number computed in front of you</h1>
          <p className="hub-lede">
            Each course in this collection is a real learning environment: a curriculum mapped section by section onto
            the papers it was written from, laboratories that run real algorithms, a glossary whose dependencies are a
            checked directed acyclic graph, an equation reference with derivations, and a graded assessment bank.
          </p>
          <p className="hub-lede">
            The rule every course follows is the same one: <strong>every number is computed</strong> — there are no
            stored results anywhere — and <strong>nothing is redistributed</strong>: the papers are cited and linked,
            never copied, and the licence of every one is recorded in the catalogue.
          </p>
          <div className="hub-stats">
            <div>
              <span className="hub-stat-value">{BUILT.length}</span>
              <span className="hub-stat-label">courses built</span>
            </div>
            <div>
              <span className="hub-stat-value">{manifest.sources.length}</span>
              <span className="hub-stat-label">sources, each with its licence</span>
            </div>
            <div>
              <span className="hub-stat-value">{manifest.sources.filter((s) => s.verification.method === 'arxiv-abs').length}</span>
              <span className="hub-stat-label">identifiers checked live</span>
            </div>
            <div>
              <span className="hub-stat-value">0</span>
              <span className="hub-stat-label">datasets redistributed</span>
            </div>
          </div>
        </section>

        <section id="start" className="hub-section hub-section-start">
          <StartHere manifest={manifest} />
        </section>

        <section id="search" className="hub-section">
          <h2>Search the whole collection</h2>
          <p className="hub-note">
            One index over the courses, the sources, the concepts and the edges of the path. The ranking is the one in
            the shared core, so it behaves the same in every course.
          </p>
          <label className="hub-search-label" htmlFor="hub-search">
            Search the collection <span className="hub-kbd-hint">or press</span>{' '}
            <kbd className="hub-kbd">/</kbd>
          </label>
          <input
            id="hub-search"
            className="hub-search"
            type="search"
            value={query}
            placeholder="perplexity, ablation, emergence, LoRA…"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="hub-chips" role="group" aria-label="Example searches">
            <span className="hub-chips-label">Try</span>
            {SUGGESTIONS.map((concept) => (
              <button key={concept.id} type="button" className="hub-chip" onClick={() => setQuery(concept.term)}>
                {concept.term}
              </button>
            ))}
          </div>
          {query.trim().length > 0 ? (
            <CatalogueSearch manifest={manifest} query={query} limit={25} onOpen={openDocument} />
          ) : (
            <p className="hub-note">Type to search {documents.length} indexed documents.</p>
          )}
        </section>

        <section id="courses" className="hub-section">
          <h2>The courses</h2>
          <p className="hub-note">
            The level is the position on the learning path, not a difficulty rating: a course at level 2 assumes one
            thing the level-1 courses teach. Filter by level to see what is open to you now.
          </p>
          <div className="hub-filter" role="group" aria-label="Filter by level on the path">
            <button
              type="button"
              className={level === 'all' ? 'hub-filter-button hub-filter-active' : 'hub-filter-button'}
              aria-pressed={level === 'all'}
              onClick={() => setLevel('all')}
            >
              All {BUILT.length}
            </button>
            {LAYERS.map((ids, index) => {
              const count = ids.filter((id) => BUILT.some((app) => app.id === id)).length
              if (count === 0) return null
              return (
                <button
                  key={index}
                  type="button"
                  className={level === index ? 'hub-filter-button hub-filter-active' : 'hub-filter-button'}
                  aria-pressed={level === index}
                  onClick={() => setLevel(index)}
                >
                  Level {index + 1} <span className="hub-filter-count">{count}</span>
                </button>
              )
            })}
          </div>
          <p className="hub-note" role="status">
            {level === 'all' ? `Showing all ${BUILT.length} courses.` : `Showing ${visible.length} of ${BUILT.length} courses.`}
          </p>
          <div className="hub-course-grid">
            {visible.map((app) => {
              const sources = manifest.sources.filter((source) => source.app === app.id)
              const primary = sources.find((source) => source.id === app.primarySource)
              const progress = progressById.get(app.id)
              const done = progress?.completed ?? 0
              const total = lessonTotals.get(app.id)
              const touched = progress !== undefined && (progress.completed > 0 || progress.knownTerms > 0)
              return (
                <article key={app.id} className="hub-course">
                  <h3>
                    <a href={`../${app.id}/`}>{app.title}</a>
                  </h3>
                  <p className="hub-course-modules">{app.modules.join(' · ')}</p>
                  {primary ? (
                    <p className="hub-course-source">
                      Built on <em>{primary.title}</em>, {primary.venue}
                    </p>
                  ) : null}
                  {total !== undefined ? (
                    <div
                      className="hub-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-valuenow={done}
                      aria-label={`${done} of ${total} lessons complete`}
                    >
                      <div
                        className="hub-progress-fill"
                        style={{ width: `${Math.round((done / total) * 100)}%` }}
                      />
                    </div>
                  ) : null}
                  <p className="hub-course-meta">
                    <span className="hub-level">Level {depthOf(LEARNING_PATH, app.id) + 1}</span>
                    {sources.length} sources · {app.modules.length} modules ·{' '}
                    {total !== undefined
                      ? `${done} of ${total} lessons complete`
                      : touched
                        ? `${done} lesson${done === 1 ? '' : 's'} done`
                        : 'not started'}
                  </p>
                  <a className="hub-course-book" href={`textbooks/${app.id}.html`}>
                    Read as a textbook <span aria-hidden="true">→</span>
                  </a>
                </article>
              )
            })}
          </div>
          {PLANNED.length > 0 ? (
            <>
              <h3 className="hub-subheading">Planned</h3>
              <ul className="hub-planned">
                {PLANNED.map((app) => (
                  <li key={app.id}>
                    <span className="hub-planned-title">{app.title}</span>
                    <span className="hub-planned-note">
                      {app.modules.join(' · ')} — the source is recorded in the catalogue
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section id="path" className="hub-section">
          <h2>The learning path</h2>
          <p className="hub-note">
            The courses are not independent. This is the order in which the material is cheapest to learn, and it is a
            claim about teaching, not about the mathematics: any course can be taken on its own.
          </p>
          <LearningPathView available={BUILT.map((app) => app.id)} hrefBase="../" />
          <details className="hub-details">
            <summary>Why these edges</summary>
            <PathEdges />
          </details>
        </section>

        <section id="progress" className="hub-section">
          <h2>Your progress</h2>
          <p className="hub-note">
            Each course keeps its own record in this browser, and the hub reads them all. Nothing is sent anywhere.
          </p>
          <CollectionProgressPanel manifest={manifest} />
        </section>

        <section id="concepts" className="hub-section">
          <h2>The ideas the courses share</h2>
          <p className="hub-note">
            A term taught in one course usually reappears in another. These are the concepts more than one course
            teaches, which is what turns a set of courses into a curriculum.
          </p>
          <ConceptIndex sharedOnly focusTerm={focusTerm} />
        </section>

        <section id="sources" className="hub-section">
          <h2>The sources</h2>
          <p className="hub-note">
            Every work the collection cites, with the licence it was checked under, the curriculum gap it closes, and
            the way its identifier was verified. The full catalogue — with every field — is in
            <code> references/manifest.json</code>, and is validated by a script that re-reads every arXiv title live.
          </p>
          <SourceBrowser manifest={manifest} focusSourceId={focusSourceId} onFocusHandled={() => setFocusSourceId(null)} />
        </section>

        <section id="glossary" className="hub-section">
          <h2>The shared glossary</h2>
          <p className="hub-note">
            The ideas more than one course teaches. A term met in one course is usually met in another, and this is
            where you can see where.
          </p>
          <GlossaryPage manifest={manifest} />
        </section>
      </main>

      <footer className="hub-footer">
        <p>
          The course <em>code</em> in this repository is original work and is released under the MIT licence. The
          source papers are <strong>cited and linked, never redistributed</strong>: no figure, table, image, dataset or
          third-party code from any cited work appears in this repository.
        </p>
        <p className="hub-note">
          Last verified: {manifest.lastVerified}. {manifest.sources.length} sources · {manifest.apps.length} courses
          recorded.
        </p>
      </footer>
    </div>
  )
}

export default App
