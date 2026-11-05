/**
 * The front door.
 *
 * One page that knows the whole collection: the courses, the sources, the
 * learning path and the concepts they share. The data comes from the same
 * manifest the courses cite, through the shared catalogue package, so the
 * hub cannot drift from the collection it describes.
 */

import { useMemo, useState } from 'react'
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
  type CatalogueManifest,
} from '@llm-materials/course-catalogue'
import manifestJson from './manifest.json'
import { CollectionProgressPanel, useCollectionProgress } from './Progress'
import { StartHere } from './StartHere'
import { SourceBrowser } from './SourceBrowser'
import { GlossaryPage } from './GlossaryPage'
import './styles.css'

const manifest: CatalogueManifest = parseManifest(manifestJson)

const BUILT = manifest.apps.filter((app) => app.status === 'built')
const PLANNED = manifest.apps.filter((app) => app.status === 'planned')
const LAYERS = layersOf(LEARNING_PATH)
const SUGGESTIONS = CONCEPTS.filter((concept) => concept.courses.length > 1).slice(0, 6)

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
            <a href="#start">Start here</a>
            <a href="#courses">Courses</a>
            <a href="#path">The path</a>
            <a href="#concepts">Concepts</a>
            <a href="#sources">Sources</a>
            <a href="#glossary">Glossary</a>
            <button type="button" className="hub-theme" onClick={toggleTheme}>
              Switch to the {theme === 'dark' ? 'light' : 'dark'} theme
            </button>
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
            Search the collection
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
            <CatalogueSearch manifest={manifest} query={query} limit={25} />
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
                  <p className="hub-course-meta">
                    <span className="hub-level">Level {depthOf(LEARNING_PATH, app.id) + 1}</span>
                    {sources.length} sources · {app.modules.length} modules ·{' '}
                    {touched
                      ? `${progress.completed} lesson${progress.completed === 1 ? '' : 's'} done`
                      : 'not started'}
                  </p>
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
          <LearningPathView available={BUILT.map((app) => app.id)} />
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
          <ConceptIndex sharedOnly />
        </section>

        <section id="sources" className="hub-section">
          <h2>The sources</h2>
          <p className="hub-note">
            Every work the collection cites, with the licence it was checked under, the curriculum gap it closes, and
            the way its identifier was verified. The full catalogue — with every field — is in
            <code> references/manifest.json</code>, and is validated by a script that re-reads every arXiv title live.
          </p>
          <SourceBrowser manifest={manifest} />
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
