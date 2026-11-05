import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTerm, type Term } from '../lib/terminology';
import { Tex } from './Math';

/**
 * A clickable term.
 *
 * The first time a reader meets a symbol, the useful thing is not another
 * paragraph but the definition. Clicking a term opens it in place, with the
 * book's reference and, where there is one, a link to the equation that derives
 * it. Nothing is fetched and nothing is hidden: the definition is a short
 * definition, and the reference is a precise one.
 */
export function Term({ id, children }: { id: string; children?: React.ReactNode }) {
  const term = getTerm(id);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  if (!term) return <>{children}</>;

  return (
    <span className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-term={term.id}
        title={term.meaning}
        className={`cursor-pointer rounded px-0.5 text-left underline decoration-dotted decoration-signal-blue/70 underline-offset-2 transition-colors hover:bg-signal-blue/15 hover:text-signal-blue ${
          open ? 'bg-signal-blue/20 text-signal-blue' : 'text-lab-100'
        }`}
      >
        {children ?? <Tex tex={term.symbol} />}
      </button>
      {open && <TermPopover term={term} />}
    </span>
  );
}

function TermPopover({ term }: { term: Term }) {
  return (
    <span
      role="dialog"
      aria-label={`Definition of ${term.name}`}
      className="absolute left-0 top-full z-30 mt-1 block w-[290px] rounded-md border border-signal-blue/40 bg-lab-900 p-3 text-left text-[12.5px] leading-relaxed text-lab-100 shadow-xl"
      style={{ zIndex: 40 }}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] text-signal-blue">
          <Tex tex={term.symbol} />
        </span>
        <span className="font-semibold">{term.name}</span>
      </div>
      <p className="mt-1.5 text-lab-200">{term.meaning}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-lab-800 pt-2">
        <span className="mono text-[11px] text-lab-400">{term.ref}</span>
        {term.equationId && (
          <Link
            to={`/equations?eq=${term.equationId}`}
            className="text-[11.5px] text-signal-blue underline decoration-dotted"
            onClick={() => undefined}
          >
            open the derivation →
          </Link>
        )}
      </div>
    </span>
  );
}
