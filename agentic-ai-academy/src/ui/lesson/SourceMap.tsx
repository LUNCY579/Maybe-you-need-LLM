import { useMemo, useState } from 'react'
import { navigate } from '../../app/router'
import { BOOK, CHAPTERS, PARTS, PART_BY_ID } from '../../content/book'
import { buildSourceMap } from '../../content/sourceMap'
import { Badge, Card, Field, Select } from '../primitives'

/**
 * Source map.
 *
 * A chapter-by-chapter view of how the course relates to the textbook: which
 * lessons cover each chapter, which sections of the book those lessons draw
 * on, and — explicitly — which parts of the material were authored for this
 * course rather than taken from the book.
 */
export function SourceMap() {
  const [partFilter, setPartFilter] = useState<string>('all')
  const rows = useMemo(() => buildSourceMap(), [])

  const visible = rows.filter((row) => partFilter === 'all' || row.part === partFilter)

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-muted text-sm">
          Every one of the {CHAPTERS.length} chapters of <strong>{BOOK.title}</strong> is covered by at least one lesson. The table below states
          which lesson covers which chapter, which sections of the book that lesson draws on, and how the treatment was authored.
        </p>
        <div className="mt-3 max-w-xs">
          <Field label="Part">
            <Select
              label="Filter the source map by part"
              value={partFilter}
              onChange={setPartFilter}
              options={[{ value: 'all', label: 'All parts' }, ...PARTS.map((part) => ({ value: part.id, label: `Part ${part.order} · ${part.title}` }))]}
            />
          </Field>
        </div>
      </Card>

      <div className="space-y-3">
        {visible.map((row) => {
          const part = PART_BY_ID.get(row.part)
          return (
            <Card key={row.number} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted font-mono text-[11px]">Ch. {row.number}</span>
                <h3 className="text-sm font-semibold">{row.title}</h3>
                {row.isCaseStudy ? <Badge tone="emerald">case study</Badge> : null}
                {row.isAdvanced ? <Badge tone="violet">advanced topic</Badge> : null}
                {part ? <Badge tone={part.accent}>Part {part.order}</Badge> : null}
                <span className="text-muted text-[11px]">p. {row.page}</span>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-muted text-[11px] font-semibold tracking-wide uppercase">Book sections used</p>
                  {row.sources.length === 0 ? (
                    <p className="text-muted mt-1 text-xs">No section reference recorded for this chapter yet.</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-xs">
                      {row.sources.map((source) => (
                        <li key={`${source.lessonSlug}-${source.label}`}>
                          <span className="text-muted">·</span> {source.label}
                          {source.page ? <span className="text-muted"> (p. {source.page})</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-muted text-[11px] font-semibold tracking-wide uppercase">Lessons covering this chapter</p>
                  {row.lessons.length === 0 ? (
                    <p className="text-muted mt-1 text-xs">No lesson currently covers this chapter.</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-xs">
                      {row.lessons.map((lesson) => (
                        <li key={lesson.slug}>
                          <button
                            type="button"
                            className="focus-ring underline"
                            onClick={() => navigate(`/lesson/${lesson.slug}`)}
                          >
                            L{lesson.order} · {lesson.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {row.covered ? (
                <p className="text-muted mt-3 border-t pt-2 text-[11px]" style={{ borderColor: 'var(--border-soft)' }}>
                  <strong className="text-slate-300">Authorship:</strong> the section headings, worked examples, diagrams, exercises and assessment
                  questions for this chapter were written for this course. The definitions, mechanisms and results they describe come from the cited
                  textbook sections. Where the course adds material the book does not contain — a derivation, a counterexample, a discussion prompt — the
                  lesson says so explicitly in its provenance panel.
                </p>
              ) : null}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
