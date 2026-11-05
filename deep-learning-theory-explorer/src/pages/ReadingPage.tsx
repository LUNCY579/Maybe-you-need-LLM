import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Badge, Stat, Callout, Button } from '../components/ui';
import { READING, READING_GROUPS, type ReadingGroup } from '../content/reading';
import {
  READING_PATHS,
  filterReading,
  resolveReadingPath,
  sortByYear,
  yearHistogram,
} from '../content/readingAids';
import { CONCEPTS } from '../content/concepts';

/**
 * Further reading.
 *
 * The monograph is the spine of this course, but it is not the whole field, and
 * a reader who wants the literature needs a map of it: what each paper
 * contributes, and where the idea shows up in this application.
 */
export function ReadingPage() {
  const [group, setGroup] = useState<ReadingGroup | 'all'>('all');
  const [query, setQuery] = useState('');
  const [year, setYear] = useState<number | 'all'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('oldest');
  const [pathId, setPathId] = useState(READING_PATHS[0].id);
  const [jump, setJump] = useState<string | null>(null);

  const shown = useMemo(() => filterReading(READING, { group, query, year }), [group, query, year]);
  const histogram = useMemo(() => yearHistogram(READING), []);
  const tallest = Math.max(...histogram.map((bin) => bin.count));
  const path = READING_PATHS.find((candidate) => candidate.id === pathId) ?? READING_PATHS[0];
  const steps = useMemo(() => resolveReadingPath(path, READING), [path]);

  // Wait until the filter has been cleared and the entry is in the DOM again
  // before scrolling to it; the list is what jumpTo below is pointing into.
  useEffect(() => {
    if (!jump) return;
    const target = document.getElementById(jump);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setJump(null);
  }, [jump, shown]);

  const filtering = query.trim() !== '' || year !== 'all' || group !== 'all';

  const clearFilters = () => {
    setGroup('all');
    setQuery('');
    setYear('all');
  };

  const jumpTo = (id: string) => {
    clearFilters();
    setJump(id);
  };

  const withLinks = READING.filter((r) => /^https?:/.test(r.url)).length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[20px] font-semibold text-lab-100">Further reading</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
          The monograph is the spine of this course, but it is not the whole field. Each entry below says what the paper
          contributes and where the idea appears in this application, so that a claim made on a screen can be traced
          back to the literature it came from.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Entries" value={READING.length} hint="all with a resolving link" />
        <Stat label="Groups" value={READING_GROUPS.length} hint="from foundations to the current literature" />
        <Stat
          label="Since the book"
          value={CONCEPTS.filter((c) => c.principle === 'beyond').length}
          hint="concepts in the atlas from outside the monograph"
        />
      </div>

      <Callout tone="insight" title="How to use this list">
        The first group is the background the monograph assumes. The second is the monograph itself and the authors&rsquo;
        own overview, which names the organising principles the theory atlas is built on. The third is where the neural
        tangent kernel comes from. The fourth is scaling laws, which explain why the loss falls as a power law without
        using the book&rsquo;s language at all. The fifth is what has moved since the book was written, and it is the
        group to read if you want to know where the framework is still open. The last is practice: the lectures and
        sites that teach this material.
      </Callout>

      <Panel
        title="Reading paths"
        subtitle={`${READING_PATHS.length} ways through the same list, in the order the ideas build.`}
      >
        <div className="flex flex-wrap gap-1.5">
          {READING_PATHS.map((candidate) => (
            <Button
              key={candidate.id}
              variant={candidate.id === path.id ? 'primary' : 'ghost'}
              onClick={() => setPathId(candidate.id)}
            >
              {candidate.name}
            </Button>
          ))}
        </div>
        <p className="mt-2 max-w-3xl text-[12.5px] leading-relaxed text-lab-300">{path.blurb}</p>
        <ol className="mt-2 grid gap-1.5 lg:grid-cols-2">
          {steps.map((entry, index) => (
            <li key={entry.id} className="flex gap-2 rounded border border-lab-700 bg-lab-850/40 p-2">
              <span className="mono mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-lab-600 text-[10px] text-lab-300">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] leading-relaxed text-lab-100">{entry.citation}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-lab-400">{entry.contributes}</p>
                <button
                  type="button"
                  onClick={() => jumpTo(entry.id)}
                  className="mt-1 text-[11px] text-signal-blue underline decoration-dotted"
                >
                  find it in the list ↓
                </button>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel
        title="The reading list"
        subtitle="Every entry links out; the note above each link says what the paper contributes."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="filter…"
              aria-label="filter the reading list"
              className="mono w-40 rounded border border-lab-600 bg-lab-900 px-2 py-1 text-[12px] text-lab-100 focus:border-signal-blue focus:outline-none"
            />
            <Button
              variant="ghost"
              title="change the order within each group"
              onClick={() => setSort(sort === 'oldest' ? 'newest' : 'oldest')}
            >
              {sort === 'oldest' ? 'oldest first' : 'newest first'}
            </Button>
            <Button variant={filtering ? 'ghost' : 'primary'} title="clear every filter" onClick={clearFilters}>
              all
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-[11.5px] text-lab-400">
          {shown.length} of {READING.length} entries
          {year !== 'all' ? ` from ${year}` : ''}
          {group !== 'all' ? ` in ${READING_GROUPS.find((g) => g.id === group)?.name.toLowerCase()}` : ''}
          {query.trim() ? ` matching “${query.trim()}”` : ''}.
        </p>

        <div className="mb-4">
          <p className="text-[10.5px] uppercase tracking-wider text-lab-500">published per year — click one to filter</p>
          <div role="group" aria-label="filter by publication year" className="mt-1.5 flex items-end gap-1">
            {histogram.map((bin) => {
              const active = bin.year === year;
              return (
                <button
                  key={bin.year}
                  type="button"
                  onClick={() => setYear(active ? 'all' : bin.year)}
                  aria-pressed={active}
                  aria-label={`${bin.year}: ${bin.count} ${bin.count === 1 ? 'entry' : 'entries'}`}
                  title={`${bin.year}: ${bin.count}`}
                  className={`group flex flex-1 flex-col items-center gap-1 rounded px-0.5 pb-0.5 pt-1 transition-colors ${
                    active ? 'bg-signal-blue/10' : 'hover:bg-lab-800'
                  }`}
                >
                  <span className={`mono text-[9px] leading-none ${active ? 'text-signal-blue' : 'text-lab-500'}`}>
                    {bin.count > 0 ? bin.count : ''}
                  </span>
                  <span
                    className={`w-full rounded-sm ${
                      active ? 'bg-signal-blue' : bin.count === 0 ? 'bg-lab-800' : 'bg-lab-500 group-hover:bg-signal-blue/70'
                    }`}
                    style={{ height: `${4 + Math.round((bin.count / tallest) * 28)}px` }}
                  />
                  <span className={`mono text-[9.5px] ${active ? 'text-signal-blue' : 'text-lab-500'}`}>{bin.year}</span>
                </button>
              );
            })}
          </div>
        </div>

        {READING_GROUPS.map((g) => {
          const entries = sortByYear(
            shown.filter((r) => r.group === g.id),
            sort,
          );
          if (entries.length === 0) return null;
          return (
            <div key={g.id} className="mb-5 last:mb-0">
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <button
                  type="button"
                  onClick={() => setGroup(group === g.id ? 'all' : g.id)}
                  className={`text-[13px] font-semibold transition-colors ${
                    group === g.id ? 'text-signal-blue' : 'text-lab-100 hover:text-signal-blue'
                  }`}
                >
                  {g.name}
                </button>
                <span className="text-[11.5px] text-lab-400">{g.blurb}</span>
              </div>
              <ul className="space-y-2">
                {entries.map((r) => (
                  <li
                    key={r.id}
                    id={r.id}
                    className="scroll-mt-24 rounded border border-lab-700 bg-lab-850/40 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-lab-100">{r.citation}</p>
                      <Badge>{r.year}</Badge>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-lab-300">
                      <span className="text-lab-400">Contributes: </span>
                      {r.contributes}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-lab-300">
                      <span className="text-lab-400">Here: </span>
                      {r.where}
                    </p>
                    {r.see.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] uppercase tracking-wider text-lab-500">go to</span>
                        {r.see.map((s) => (
                          <Link
                            key={s.to + s.label}
                            to={s.to}
                            className="rounded border border-lab-700 bg-lab-900/60 px-2 py-0.5 text-[11px] text-lab-300 transition-colors hover:border-signal-blue hover:text-signal-blue"
                          >
                            {s.label} →
                          </Link>
                        ))}
                      </div>
                    )}
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-block text-[11.5px] text-signal-blue underline decoration-dotted"
                    >
                      open the source ↗
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {shown.length === 0 && <p className="text-[12.5px] text-lab-400">Nothing matches that filter.</p>}
      </Panel>

      <Panel title="The same literature, seen from the atlas" subtitle="The concepts that came from outside the monograph.">
        <ul className="space-y-1.5">
          {CONCEPTS.filter((c) => c.principle === 'beyond').map((c) => (
            <li key={c.id} className="text-[12.5px] leading-snug">
              <Link to="/atlas" className="text-lab-100 underline decoration-dotted decoration-signal-blue/60">
                {c.name}
              </Link>
              <span className="ml-1.5 text-[11px] text-lab-500">{c.ref}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11.5px] leading-snug text-lab-400">
          {withLinks} of the {READING.length} entries carry a link that resolves. Where an idea is cited but not
          simulated here, the theory atlas says so.
        </p>
      </Panel>
    </div>
  );
}
