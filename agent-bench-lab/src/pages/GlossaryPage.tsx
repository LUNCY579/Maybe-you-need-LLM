import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { groupByInitial } from '@llm-materials/course-core'
import { GLOSSARY } from '../content/glossary'
import { useProgress } from '@llm-materials/course-ui'
import { Button, Callout, Panel, SegmentedControl, Stat } from '@llm-materials/course-ui'
import { SharedConcepts } from '@llm-materials/course-catalogue'

type Category = 'all' | 'concept' | 'mechanism' | 'method' | 'notation' | 'measurement' | 'mathematics'

export function GlossaryPage() {
  const [params, setParams] = useSearchParams()
  const [category, setCategory] = useState<Category>('all')
  const [query, setQuery] = useState('')
  const { record, toggleKnownTerm } = useProgress()

  const selected = params.get('term')

  const terms = useMemo(() => {
    const lower = query.trim().toLowerCase()
    return GLOSSARY.filter((term) => {
      if (category !== 'all' && term.category !== category) return false
      if (!lower) return true
      return (
        term.term.toLowerCase().includes(lower) ||
        term.short.toLowerCase().includes(lower) ||
        term.long.toLowerCase().includes(lower)
      )
    })
  }, [category, query])

  const groups = useMemo(() => groupByInitial(terms), [terms])

  return (
    <div className="page">
      <h1 className="page-title">Glossary</h1>
      <p className="page-lede">
        {GLOSSARY.length} terms, each with a plain-language definition and the terms that should be understood first.
        The dependencies are a directed acyclic graph, and the test suite checks that.
      </p>

      <div className="stat-row">
        <Stat label="Terms" value={String(GLOSSARY.length)} />
        <Stat label="Marked as known" value={String(record.knownTerms.length)} />
        <Stat
          label="With a source"
          value={String(GLOSSARY.filter((term) => term.attribution && !term.attribution.isCourseAuthored).length)}
        />
      </div>

      <div className="lab-controls">
        <div className="field">
          <label className="field-label" htmlFor="glossary-search">
            Filter
          </label>
          <input
            id="glossary-search"
            type="search"
            value={query}
            placeholder="Search the glossary"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <SegmentedControl
          label="Category"
          value={category}
          onChange={setCategory}
          options={[
            { value: 'all', label: 'All' },
            { value: 'concept', label: 'Concepts' },
            { value: 'mechanism', label: 'Mechanisms' },
            { value: 'method', label: 'Methods' },
            { value: 'notation', label: 'Notation' },
            { value: 'measurement', label: 'Measurements' },
            { value: 'mathematics', label: 'Mathematics' },
          ]}
        />
      </div>

      {selected ? (
        <Panel title="The term you asked for" accent="teal">
          {(() => {
            const term = GLOSSARY.find((entry) => entry.id === selected)
            if (!term) {
              return <p className="muted">No such term.</p>
            }
            return (
              <div>
                <h2 className="section-heading">{term.term}</h2>
                <p className="body-text">{term.long}</p>
                {term.example ? (
                  <Callout tone="definition" title="An example">
                    <p>{term.example.question}</p>
                    <p>
                      <strong>{term.example.answer}</strong>
                    </p>
                  </Callout>
                ) : null}
              </div>
            )
          })()}
          <Button onClick={() => setParams({})}>Back to the whole glossary</Button>
        </Panel>
      ) : null}

      {groups.map((group) => (
        <section key={group.letter} className="glossary-section">
          <h2 className="section-heading">{group.letter}</h2>
          <div className="glossary-grid">
            {group.terms.map((term) => (
              <article key={term.id} className="glossary-card">
                <div className="glossary-card-head">
                  <h3>{term.term}</h3>
                  <Button
                    variant="ghost"
                    onClick={() => toggleKnownTerm(term.id)}
                    title={
                      record.knownTerms.includes(term.id)
                        ? 'Marked as known — click to undo'
                        : 'Mark this term as known'
                    }
                  >
                    {record.knownTerms.includes(term.id) ? '✓ known' : 'mark known'}
                  </Button>
                </div>
                <p className="glossary-short">{term.short}</p>
                <p className="glossary-long">{term.long}</p>
                {term.prerequisites.length > 0 ? (
                  <p className="glossary-prereq">
                    Understands first:{' '}
                    {term.prerequisites
                      .map((id) => GLOSSARY.find((entry) => entry.id === id)?.term ?? id)
                      .join(', ')}
                  </p>
                ) : null}
                {term.attribution ? (
                  <p className="glossary-source">
                    {term.attribution.isCourseAuthored ? 'A term this course wrote.' : `From ${term.attribution.label}.`}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 ? <Callout tone="note" title="Nothing matched">Try a different filter.</Callout> : null}
      <SharedConcepts courseId="agent-bench-lab" />
    </div>
  )
}
