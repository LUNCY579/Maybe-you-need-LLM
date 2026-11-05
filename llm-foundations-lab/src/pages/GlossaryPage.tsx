import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from '../components/layout/CourseLink.tsx'
import { GLOSSARY, type GlossaryEntry } from '../content/glossary'
import { MODULES, getLesson } from '../content/curriculum'
import { useProgress } from '../state/hooks'
import { Badge, Button, Panel, TextInput } from '../components/ui/primitives'
import { InlineMath } from '../components/ui/Math'
import { ConceptMap } from '../components/viz/ConceptMap'

function chainFor(entry: GlossaryEntry, seen = new Set<string>()): GlossaryEntry[] {
  const chain: GlossaryEntry[] = []
  for (const prerequisite of entry.prerequisites) {
    if (seen.has(prerequisite)) continue
    seen.add(prerequisite)
    const found = GLOSSARY.find((candidate) => candidate.id === prerequisite)
    if (found) {
      chain.push(...chainFor(found, seen), found)
    }
  }
  return chain
}

export function GlossaryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  /*
    The selected term is read from the address rather than held in state of
    its own. It was held in state, initialised from the address once, and
    that meant a reader who arrived at a link to a particular term saw the
    glossary with nothing selected, and the back button did nothing. The
    address is where the selection belongs: it is what makes the link
    shareable.
  */
  const selected = searchParams.get('term') ?? ''
  const { isComplete } = useProgress()

  const entries = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    return GLOSSARY.filter((entry) => {
      if (moduleFilter !== 'all' && entry.moduleId !== moduleFilter) return false
      if (!trimmed) return true
      return (
        entry.term.toLowerCase().includes(trimmed) ||
        entry.short.toLowerCase().includes(trimmed) ||
        entry.definition.toLowerCase().includes(trimmed)
      )
    }).sort((a, b) => a.term.localeCompare(b.term))
  }, [query, moduleFilter])

  const active = GLOSSARY.find((entry) => entry.id === selected)
  const chain = active ? chainFor(active) : []
  const dependents = active ? GLOSSARY.filter((entry) => entry.prerequisites.includes(active.id)) : []

  /*
   * The concept map shows one module at a time: its own terms, and the earlier
   * terms they depend on. Showing the whole course at once would be unreadable
   * with 71 terms, and a module is the unit a reader actually studies.
   */
  const mapModuleId = moduleFilter !== 'all' ? moduleFilter : null
  // The module of the selected term, as an id rather than an object.
  const activeModuleId = active?.moduleId
  const mapModule = mapModuleId ?? activeModuleId ?? MODULES[0]?.id
  const mapTermIds = mapModule
    ? GLOSSARY.filter((entry) => entry.moduleId === mapModule).map((entry) => entry.id)
    : []
  const mapModuleLabel = mapModule
    ? `Module ${MODULES.find((m) => m.id === mapModule)?.chapter} · ${
        MODULES.find((m) => m.id === mapModule)?.title
      }`
    : 'No module selected'

  return (
    <div className="animate-rise space-y-5">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">Glossary and concept map</h1>
        <p className="max-w-3xl text-sm text-muted">
          {GLOSSARY.length} terms with plain-language definitions, prerequisites and the section of the source revision
          that introduces each idea. Prerequisites are ordered, so you can always walk backwards to something you have
          already learned.
        </p>
      </header>

      <Panel className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-3">
          <TextInput
            label="Search terms"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="try “attention”, “preference”, “cache”"
          />
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant={moduleFilter === 'all' ? 'primary' : 'ghost'} onClick={() => setModuleFilter('all')}>
              all modules
            </Button>
            {MODULES.map((module) => (
              <Button
                key={module.id}
                size="sm"
                variant={moduleFilter === module.id ? 'primary' : 'ghost'}
                onClick={() => setModuleFilter(module.id)}
              >
                {module.chapter}. {module.title}
              </Button>
            ))}
          </div>
        </div>
        <div className="text-sm text-muted">
          <p>
            <span className="font-mono text-fg">{entries.length}</span> entries match.
          </p>
          {active ? (
            <Button size="sm" variant="ghost" onClick={() => { setSearchParams({}) }}>
              Clear selection
            </Button>
          ) : null}
        </div>
      </Panel>

      <Panel className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-fg">Concept map</h2>
        <p className="text-sm text-muted">
          The course is a dependency structure, not a list. This map shows the terms introduced in one module and the
          earlier terms they rest on. Select a node to open its definition.
        </p>
        <p className="text-xs text-faint">
          {mapModuleLabel} · use the module filter above to change it.
        </p>
        <div className="mt-2">
          <ConceptMap
            termIds={mapTermIds}
            selectedId={selected}
            onSelect={(id) => {
              setSearchParams({ term: id })
            }}
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="Glossary entries" className="space-y-2">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className={`rounded-2xl border p-3 transition-colors ${
                selected === entry.id ? 'border-indigo bg-indigo/5' : 'border-line bg-panel/60'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-fg">{entry.term}</h2>
                <div className="flex items-center gap-2">
                  {isComplete(entry.lessonId) ? <Badge tone="positive">met</Badge> : null}
                  <Badge tone="teal">§{entry.section}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => { setSearchParams({ term: entry.id }) }}>
                    details
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-xs text-amber">{entry.short}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{entry.definition}</p>
              {entry.tex ? (
                <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-panel-2/40 px-2 py-1 text-[13px] text-teal">
                  <InlineMath tex={entry.tex} />
                </div>
              ) : null}
              <p className="mt-2 text-[11px] text-faint">
                Module {MODULES.find((module) => module.id === entry.moduleId)?.chapter} · p.{entry.page} ·{' '}
                {getLesson(entry.lessonId) ? (
                  <Link to={`/lessons/${entry.lessonId}`} className="text-indigo hover:underline">
                    taught in {getLesson(entry.lessonId)!.title}
                  </Link>
                ) : null}
              </p>
            </article>
          ))}
          {entries.length === 0 ? <p className="text-sm text-faint">No terms match that search.</p> : null}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {active ? (
            <>
              <Panel>
                <h2 className="font-display text-lg font-semibold text-fg">{active.term}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{active.definition}</p>
                {active.tex ? (
                  <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-panel-2/40 px-2 py-1.5 text-sm text-teal">
                    <InlineMath tex={active.tex} />
                  </div>
                ) : null}
                <p className="mt-3 text-xs text-faint">
                  Source: §{active.section}, p.{active.page} (module {MODULES.find((m) => m.id === active.moduleId)?.chapter})
                </p>
                {getLesson(active.lessonId) ? (
                  <Link to={`/lessons/${active.lessonId}`} className="mt-2 inline-block text-sm text-indigo hover:underline">
                    Go to the lesson →
                  </Link>
                ) : null}
              </Panel>

              <Panel>
                <h3 className="font-display text-sm font-semibold text-fg">Prerequisites</h3>
                {chain.length === 0 ? (
                  <p className="mt-2 text-xs text-muted">Nothing — this is a starting term.</p>
                ) : (
                  <ol className="mt-2 space-y-1.5">
                    {chain.map((entry, index) => (
                      <li key={entry.id} className="text-xs text-muted">
                        <span className="font-mono text-faint">{index + 1}.</span>{' '}
                        <button
                          type="button"
                          className="text-indigo hover:underline"
                          onClick={() => { setSearchParams({ term: entry.id }) }}
                        >
                          {entry.term}
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>

              <Panel>
                <h3 className="font-display text-sm font-semibold text-fg">Unlocks</h3>
                {dependents.length === 0 ? (
                  <p className="mt-2 text-xs text-muted">No other glossary entry lists this as a prerequisite.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {dependents.map((entry) => (
                      <li key={entry.id} className="text-xs">
                        <button
                          type="button"
                          className="text-indigo hover:underline"
                          onClick={() => { setSearchParams({ term: entry.id }) }}
                        >
                          {entry.term}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </>
          ) : (
            <Panel>
              <h2 className="font-display text-lg font-semibold text-fg">Reading the map</h2>
              <p className="mt-2 text-sm text-muted">
                Select any term to see its prerequisite chain — the ordered list of ideas that lead to it — and which
                other terms depend on it.
              </p>
              <p className="mt-2 text-xs text-faint">
                {GLOSSARY.filter((entry) => entry.prerequisites.length === 0).length} foundational terms have no
                prerequisites, which makes them reasonable starting points.
              </p>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  )
}

export default GlossaryPage
