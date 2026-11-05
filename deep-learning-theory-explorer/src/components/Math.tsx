import { useMemo } from 'react';
import katex from 'katex';
import { Term } from './Term';

/**
 * Renders LaTeX with KaTeX. Two entry points:
 *  - <Tex>  for a single expression
 *  - <Rich> for prose containing inline $...$ segments, **bold** markers and
 *           [[term-id]] references to the terminology registry.
 * Only author-controlled strings are rendered (lesson content and equation data),
 * never user input, so KaTeX's default trust settings (no \href, no HTML) are fine.
 */
export function Tex({ tex, display = false, className = '' }: { tex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore' });
    } catch {
      return `<code>${tex}</code>`;
    }
  }, [tex, display]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

interface Segment {
  type: 'text' | 'math' | 'term';
  value: string;
}

function splitInline(text: string): Segment[] {
  const out: Segment[] = [];
  // Terms are extracted first, so that a term inside prose is never mistaken
  // for math and never swallowed by the dollar-sign split.
  const withTerms = text.split(/(\[\[[a-z0-9-]+\]\])/g);
  withTerms.forEach((part) => {
    const term = /^\[\[([a-z0-9-]+)\]\]$/.exec(part);
    if (term) {
      out.push({ type: 'term', value: term[1] });
      return;
    }
    const pieces = part.split('$');
    pieces.forEach((piece, i) => {
      if (piece === '') return;
      out.push({ type: i % 2 === 1 ? 'math' : 'text', value: piece });
    });
  });
  return out;
}

export function Rich({ text, className = '' }: { text: string; className?: string }) {
  const segments = useMemo(() => splitInline(text), [text]);
  return (
    <span className={className}>
      {segments.map((s, i) =>
        s.type === 'math' ? (
          <Tex key={i} tex={s.value} />
        ) : s.type === 'term' ? (
          <Term key={i} id={s.value} />
        ) : (
          <span key={i} dangerouslySetInnerHTML={{ __html: boldify(s.value) }} />
        ),
      )}
    </span>
  );
}

/** minimal **bold** and `code` support, applied after escaping */
function boldify(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-lab-100 font-semibold">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="mono rounded bg-lab-800 px-1 py-0.5 text-signal-green">$1</code>');
}

export function EquationBlock({
  tex,
  caption,
  refLabel,
  onSymbolClick,
}: {
  tex: string;
  caption?: string;
  refLabel?: string;
  onSymbolClick?: () => void;
}) {
  return (
    <figure className="my-3 rounded-md border border-lab-700 bg-lab-850/60 px-4 py-3">
      <div className="overflow-x-auto">
        <Tex tex={tex} display />
      </div>
      {(caption || refLabel) && (
        <figcaption className="mt-2 flex flex-wrap items-baseline justify-between gap-2 border-t border-lab-800 pt-2 text-[12px] text-lab-300">
          <span>{caption}</span>
          {refLabel && (
            <button
              type="button"
              onClick={onSymbolClick}
              className="mono rounded border border-lab-600 px-1.5 py-0.5 text-lab-300 hover:border-signal-blue hover:text-signal-blue"
              title={onSymbolClick ? 'Inspect this equation' : undefined}
            >
              {refLabel}
            </button>
          )}
        </figcaption>
      )}
    </figure>
  );
}
