import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { kindLabel, searchCurriculum, type SearchHit } from '../lib/search';
import { Badge } from './ui';

/**
 * The global search box.
 *
 * It lives in the application shell, so it is available on every screen, and it
 * searches the whole curriculum: lessons, equations, terminology, assessment
 * questions and the experiment gallery. A student who remembers a phrase can
 * find the page that explains it without knowing where it is.
 */
export function GlobalSearch({ ariaLabel = 'Search the course' }: { ariaLabel?: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits: SearchHit[] = useMemo(() => searchCurriculum(query), [query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      // "/" focuses the search box, the way a research tool should
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQuery('');
    navigate(hit.route);
  };

  return (
    <div className="relative print:hidden" ref={boxRef}>
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Search the course…  (press /)"
        aria-label={ariaLabel}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && hits[active]) {
            go(hits[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        className="mono w-full rounded border border-lab-700 bg-lab-900/70 px-2.5 py-1 text-[12px] text-lab-100 placeholder:text-lab-500 focus:border-signal-blue focus:outline-none"
      />

      {open && query.trim().length >= 2 && (
        <div className="absolute right-0 top-full z-40 mt-1 w-[420px] overflow-hidden rounded-md border border-lab-700 bg-lab-900 shadow-2xl">
          {hits.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-lab-400">
              Nothing in the course matches “{query.trim()}”. Try a phrase from a lesson, an equation number, or a
              symbol such as χ∥.
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {hits.map((hit, i) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    type="button"
                    data-search-kind={hit.kind}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(hit)}
                    className={`block w-full border-b border-lab-800 px-3 py-2 text-left transition-colors ${
                      i === active ? 'bg-signal-blue/15' : 'hover:bg-lab-850'
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <Badge tone={hit.kind === 'term' ? 'good' : 'default'}>{kindLabel(hit.kind)}</Badge>
                      <span className="truncate text-[12.5px] text-lab-100">{hit.title}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-lab-400">{hit.detail}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
