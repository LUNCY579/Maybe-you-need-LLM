import { useMemo, useState } from 'react'
import { CORPORA, curate, type FilterSettings } from '../../engine/demos/curation'
import { Badge, Button, Field } from '../primitives'
import { DemoShell } from './DemoShell'

/**
 * Data curation: what a filter throws away.
 *
 * The book's own description of the pipeline is a list of things that are
 * removed — boilerplate, duplicates, unsafe text, and anything a filter
 * considers low quality. The list is the easy part. The demonstration is
 * about the two ways the list can go wrong, and they pull against each
 * other: a filter that is too permissive leaves duplicates for the model to
 * memorise, and a filter that is too aggressive removes legitimate writing
 * because it looks unusual.
 *
 * The student sets two thresholds and watches which failure dominates.
 */
export function CurationDemo() {
  const [corpusId, setCorpusId] = useState(CORPORA[0].id)
  const [settings, setSettings] = useState<FilterSettings>({
    qualityThreshold: 0.5,
    similarityThreshold: 0.85,
    safetyFilter: true,
  })

  const corpus = useMemo(
    () => CORPORA.find((entry) => entry.id === corpusId) ?? CORPORA[0],
    [corpusId],
  )
  const outcome = useMemo(() => curate(corpus, settings), [corpus, settings])

  return (
    <DemoShell
      title="What a filter throws away"
      source="Ch. 3, §3.2.1 Acquire Data; Ch. 19, §19.3"
      summary="Set the quality threshold and the de-duplication threshold for a corpus, and watch the two ways curation fails: duplicates left in for the model to memorise, and legitimate writing removed because it looks unusual."
      controls={
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Corpus">
              <select
                aria-label="Choose a corpus to curate"
                value={corpusId}
                onChange={(event) => setCorpusId(event.target.value)}
                className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
                style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
              >
                {CORPORA.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={settings.safetyFilter}
                  onChange={(event) => setSettings({ ...settings, safetyFilter: event.target.checked })}
                  className="focus-ring"
                />
                Run the safety filter
              </label>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="demo-curation-quality" className="text-muted text-xs font-medium">
                Quality threshold: {(settings.qualityThreshold * 100).toFixed(0)}%
              </label>
              <input
                id="demo-curation-quality"
                type="range"
                min={0}
                max={0.9}
                step={0.05}
                value={settings.qualityThreshold}
                onChange={(event) =>
                  setSettings({ ...settings, qualityThreshold: Number(event.target.value) })
                }
                className="focus-ring mt-1 w-full accent-cyan-400"
              />
              <p className="text-muted text-[11px]">Documents scoring below this are dropped.</p>
            </div>
            <div>
              <label htmlFor="demo-curation-similarity" className="text-muted text-xs font-medium">
                Duplicate threshold: {(settings.similarityThreshold * 100).toFixed(0)}% similar
              </label>
              <input
                id="demo-curation-similarity"
                type="range"
                min={0.5}
                max={1}
                step={0.05}
                value={settings.similarityThreshold}
                onChange={(event) =>
                  setSettings({ ...settings, similarityThreshold: Number(event.target.value) })
                }
                className="focus-ring mt-1 w-full accent-cyan-400"
              />
              <p className="text-muted text-[11px]">A near-duplicate is dropped at or above this.</p>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-muted text-sm leading-relaxed">{corpus.context}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">
            {outcome.kept.length} of {corpus.documents.length} documents kept
          </Badge>
          <Badge tone={outcome.dialectKept ? 'emerald' : 'rose'}>
            {outcome.dialectKept ? 'the variety survived' : 'the variety was filtered out'}
          </Badge>
          <Badge tone={outcome.duplicatesKept > 0 ? 'rose' : 'emerald'}>
            {outcome.duplicatesKept > 0
              ? `${outcome.duplicatesKept} near-duplicate(s) kept`
              : 'no duplicates left'}
          </Badge>
        </div>

        <div
          className="rounded-lg border p-3 text-xs"
          style={{
            borderColor: outcome.headline.includes('but') || !outcome.dialectKept ? 'rgba(251,113,133,0.5)' : 'rgba(52,211,153,0.5)',
            background: outcome.headline.includes('but') || !outcome.dialectKept ? 'rgba(251,113,133,0.07)' : 'rgba(52,211,153,0.07)',
          }}
          role="status"
        >
          <p className="font-semibold">{outcome.headline}</p>
          <p className="text-muted mt-1 leading-relaxed">{outcome.explanation}</p>
        </div>

        <div className="surface-2 rounded-lg border p-3" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="text-muted text-[11px] font-semibold uppercase">The corpus</p>
          <ul className="mt-2 space-y-1 text-xs">
            {corpus.documents.map((document) => {
              const kept = outcome.kept.some((entry) => entry.id === document.id)
              const dropped = outcome.dropped.find((entry) => entry.document.id === document.id)
              return (
                <li key={document.id} className="flex flex-wrap items-baseline gap-2">
                  <span className={kept ? '' : 'line-through opacity-60'}>{document.title}</span>
                  {document.dialect ? <Badge tone="violet">dialect</Badge> : null}
                  {document.duplicateOf ? <Badge tone="neutral">near-duplicate</Badge> : null}
                  {document.unsafe ? <Badge tone="rose">unsafe</Badge> : null}
                  <span className="text-muted font-mono text-[10px]">quality {document.quality.toFixed(2)}</span>
                  <span className="text-muted font-mono text-[10px]">{document.tokens}t</span>
                  {dropped ? (
                    <Badge tone="amber">
                      dropped:{' '}
                      {dropped.reason === 'duplicate'
                        ? `duplicate of ${dropped.document.duplicateOf}`
                        : dropped.reason}
                    </Badge>
                  ) : (
                    <Badge tone="emerald">kept</Badge>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="surface-2 rounded-lg border p-3" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="text-muted text-[11px] font-semibold uppercase">The source mix</p>
          <ul className="mt-2 space-y-1 text-xs">
            {outcome.mix
              .filter((entry) => entry.before > 0)
              .map((entry) => {
                const share = entry.before === 0 ? 0 : Math.round((entry.after / entry.before) * 100)
                return (
                  <li key={entry.source} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 capitalize">{entry.source}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--border-soft)' }}>
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${share}%`, background: 'var(--accent)' }}
                      />
                    </span>
                    <span className="text-muted w-20 shrink-0 text-right font-mono text-[10px]">
                      {share}% kept
                    </span>
                  </li>
                )
              })}
          </ul>
        </div>

        <p className="text-muted text-[11px] leading-relaxed">{corpus.note}</p>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() =>
              setSettings({ qualityThreshold: 0.25, similarityThreshold: 0.85, safetyFilter: true })
            }
          >
            Keep the variety
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setSettings({ qualityThreshold: 0.6, similarityThreshold: 0.85, safetyFilter: true })
            }
          >
            Filter hard
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setSettings({ qualityThreshold: 0.5, similarityThreshold: 0.95, safetyFilter: true })
            }
          >
            Keep the duplicates
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setSettings({ qualityThreshold: 0.45, similarityThreshold: 0.8, safetyFilter: true })
            }
          >
            Balance both
          </Button>
        </div>
      </div>
    </DemoShell>
  )
}
