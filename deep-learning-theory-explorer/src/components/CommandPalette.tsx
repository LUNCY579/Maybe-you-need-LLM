import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from './ui';
import { kindLabel, searchCurriculum } from '../lib/search';
import { useFocusTrap } from '../lib/useFocusTrap';

/**
 * The command palette.
 *
 * A research tool is used with the keyboard, so the palette is opened with
 * ⌘K (or Ctrl-K) and navigated with the arrows. It searches the whole
 * curriculum and the theory atlas, and it can also run the commands that
 * change your state: reset the shared setup, open a laboratory, start a run.
 */

export interface Command {
  id: string;
  title: string;
  detail: string;
  group: string;
  run: () => void;
}

interface PaletteHit {
  kind: 'search' | 'command';
  id: string;
  title: string;
  detail: string;
  group: string;
  score: number;
  to?: string;
  run?: () => void;
}

export function CommandPalette({
  onResetSetup,
  onClose,
}: {
  onResetSetup: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const panelRef = useFocusTrap<HTMLDivElement>(true);
  const restoreFocus = useRef<HTMLElement | null>(null);

  // Focus management: remember where the reader was, move focus into the
  // palette, and give it back when the palette closes.
  useEffect(() => {
    restoreFocus.current = document.activeElement as HTMLElement | null;
    return () => restoreFocus.current?.focus?.();
  }, []);

  const commands = useMemo<Command[]>(
    () => [
      { id: 'cmd.labs.physics', title: 'Open the physics laboratory', detail: 'the flagship experiment', group: 'Go to', run: () => navigate('/labs/physics') },
      { id: 'cmd.labs.initialization', title: 'Open Laboratory A', detail: 'initialization and criticality', group: 'Go to', run: () => navigate('/labs/initialization') },
      { id: 'cmd.labs.landscape', title: 'Open Laboratory B', detail: 'loss landscapes', group: 'Go to', run: () => navigate('/labs/landscape') },
      { id: 'cmd.labs.widthdepth', title: 'Open Laboratory C', detail: 'width, depth and fluctuations', group: 'Go to', run: () => navigate('/labs/width-depth') },
      { id: 'cmd.labs.ntk', title: 'Open Laboratory D', detail: 'the neural tangent kernel', group: 'Go to', run: () => navigate('/labs/ntk') },
      { id: 'cmd.labs.representation', title: 'Open Laboratory E', detail: 'representation learning', group: 'Go to', run: () => navigate('/labs/representation') },
      { id: 'cmd.labs.drills', title: 'Open Laboratory F', detail: 'the prerequisite drills', group: 'Go to', run: () => navigate('/labs/drills') },
      { id: 'cmd.atlas', title: 'Open the theory atlas', detail: 'every concept of the monograph', group: 'Go to', run: () => navigate('/atlas') },
      { id: 'cmd.equations', title: 'Open the equation explorer', detail: 'sixteen results, derived', group: 'Go to', run: () => navigate('/equations') },
      { id: 'cmd.gallery', title: 'Open the experiment gallery', detail: 'eleven reproducible presets', group: 'Go to', run: () => navigate('/gallery') },
      { id: 'cmd.quiz', title: 'Open the assessment', detail: 'twenty questions', group: 'Go to', run: () => navigate('/quiz') },
      { id: 'cmd.dashboard', title: 'Open the dashboard', detail: 'your progress and experiment log', group: 'Go to', run: () => navigate('/dashboard') },
      { id: 'cmd.reset', title: 'Reset the shared setup', detail: 'back to the default activation and hyperparameters', group: 'Action', run: onResetSetup },
    ],
    [navigate, onResetSetup],
  );

  const hits = useMemo<PaletteHit[]>(() => {
    const q = query.trim();
    const out: PaletteHit[] = [];
    for (const c of commands) {
      if (!q) {
        out.push({ kind: 'command', id: c.id, title: c.title, detail: c.detail, group: c.group, score: 100, run: c.run });
        continue;
      }
      const t = c.title.toLowerCase();
      if (t.includes(q.toLowerCase())) out.push({ kind: 'command', id: c.id, title: c.title, detail: c.detail, group: c.group, score: 90, run: c.run });
    }
    if (q.length >= 2) {
      for (const h of searchCurriculum(q, 10)) {
        out.push({
          kind: 'search',
          id: h.id,
          title: h.title,
          detail: h.detail,
          group: kindLabel(h.kind),
          score: h.score,
          to: h.route,
        });
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 14);
  }, [commands, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const choose = (hit: PaletteHit) => {
    if (hit.run) hit.run();
    else if (hit.to) navigate(hit.to);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-lab-950/70 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-lab-700 bg-lab-900 shadow-2xl"
      >
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && hits[active]) {
              choose(hits[active]);
            } else if (e.key === 'Escape') {
              onClose();
            }
          }}
          placeholder="Search the course, or type a command…"
          aria-label="Search the course, or type a command"
          className="w-full border-b border-lab-800 bg-transparent px-4 py-3 text-[14px] text-lab-100 placeholder:text-lab-500 focus:outline-none"
        />
        <ul className="max-h-[55vh] overflow-y-auto">
          {hits.length === 0 && <li className="px-4 py-4 text-[13px] text-lab-400">Nothing matches “{query.trim()}”.</li>}
          {hits.map((hit, i) => (
            <li key={`${hit.kind}-${hit.id}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(hit)}
                className={`flex w-full items-center gap-3 border-b border-lab-850 px-4 py-2.5 text-left transition-colors ${
                  i === active ? 'bg-signal-blue/15' : 'hover:bg-lab-850'
                }`}
              >
                <Badge tone={hit.kind === 'command' ? 'good' : 'default'}>{hit.group}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-lab-100">{hit.title}</span>
                  {hit.detail && <span className="block truncate text-[11.5px] text-lab-400">{hit.detail}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-lab-800 px-4 py-2 text-[11px] text-lab-500">
          <span>↑ ↓ to move · ⏎ to open · esc to close</span>
          <span>⌘K / Ctrl-K</span>
        </div>
      </div>
    </div>
  );
}
