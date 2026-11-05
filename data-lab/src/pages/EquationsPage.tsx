import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FORMULAS } from '../content/formulas'
import { Callout, DefinitionTable, Panel, Steps } from '@llm-materials/course-ui'
import { MathBlock } from '@llm-materials/course-ui'

export function EquationsPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const selected = params.get('entry')

  const entries = useMemo(() => {
    const lower = query.trim().toLowerCase()
    if (!lower) return FORMULAS
    return FORMULAS.filter(
      (entry) =>
        entry.title.toLowerCase().includes(lower) ||
        entry.meaning.toLowerCase().includes(lower) ||
        entry.reference.source.toLowerCase().includes(lower),
    )
  }, [query])

  const selectedEntry = FORMULAS.find((entry) => entry.id === selected)

  return (
    <div className="page">
      <h1 className="page-title">Equations</h1>
      <p className="page-lede">
        {FORMULAS.length} results, each with the source it comes from, what it means in plain language, every symbol,
        the assumptions it rests on, a derivation, and a worked example with the numbers substituted.
      </p>

      <div className="lab-controls">
        <div className="field">
          <label className="field-label" htmlFor="equation-search">
            Filter
          </label>
          <input
            id="equation-search"
            type="search"
            value={query}
            placeholder="Search the equations"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {selectedEntry ? (
        <Panel title={selectedEntry.title} accent="violet">
          <MathBlock
            latex={selectedEntry.latex}
            label={selectedEntry.meaning}
            caption={`${selectedEntry.reference.source}, ${selectedEntry.reference.location}`}
          />
          <p className="body-text">{selectedEntry.meaning}</p>
          <h2 className="section-heading">The symbols</h2>
          <DefinitionTable rows={selectedEntry.symbols} />
          <h2 className="section-heading">The assumptions</h2>
          <ul className="bullet-list">
            {selectedEntry.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
          <h2 className="section-heading">The derivation</h2>
          <Steps items={selectedEntry.derivation} />
          <Callout tone="definition" title="Worked example">
            <p>
              <strong>Given:</strong> {selectedEntry.example.given}
            </p>
            <p>
              <strong>Result:</strong> {selectedEntry.example.result}
            </p>
            <p>{selectedEntry.example.note}</p>
          </Callout>
          <button type="button" className="btn btn-default" onClick={() => setParams({})}>
            Back to the whole list
          </button>
        </Panel>
      ) : null}

      {entries.map((entry) => (
        <Panel key={entry.id} title={entry.title} accent="violet">
          <MathBlock latex={entry.latex} label={entry.meaning} />
          <p className="body-text">{entry.meaning}</p>
          <p className="equation-source">
            {entry.reference.source}, {entry.reference.location} ·{' '}
            <a href={entry.reference.url} rel="noreferrer">
              the source
            </a>
          </p>
          <button
            type="button"
            className="btn btn-default"
            onClick={() => setParams({ entry: entry.id })}
          >
            The symbols, the derivation and an example
          </button>
        </Panel>
      ))}

      {entries.length === 0 ? <Callout tone="note" title="Nothing matched">Try a different filter.</Callout> : null}
    </div>
  )
}
