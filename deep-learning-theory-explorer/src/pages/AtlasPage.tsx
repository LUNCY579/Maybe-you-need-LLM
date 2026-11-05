import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Badge, Stat, Table, Callout, Select, Button } from '../components/ui';
import { Tex } from '../components/Math';
import { CONCEPTS, PRINCIPLES, CONCEPT_KINDS, type Concept, type ConceptKind, type PrincipleId } from '../content/concepts';
import { useProgress } from '../lib/persistence';
import { LESSONS } from '../content/lessons';

/**
 * The Theory Atlas.
 *
 * Every idea the monograph is built from, in one browsable place, organised by the
 * principles the authors themselves name. Each entry says what the idea is, where
 * the book states it, what this application does about it, and — the point of the
 * `status` tag — whether that is a measurement or only an explanation.
 */

const KIND_LABEL: Record<ConceptKind, string> = {
  recursion: 'recursion',
  condition: 'condition',
  scaling: 'scaling',
  phenomenon: 'phenomenon',
  tool: 'tool',
  limit: 'limit',
  object: 'object',
  principle: 'principle',
};

function ConceptCard({ concept }: { concept: Concept }) {
  const [open, setOpen] = useState(false);
  return (
    <article
      className={`rounded-md border bg-lab-850/40 p-3 transition-colors ${
        open ? 'border-signal-blue/50' : 'border-lab-700'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 text-left"
      >
        <span className="mono mt-0.5 text-[11px] text-lab-500">{concept.ref}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-lab-100">{concept.name}</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-lab-300">{concept.statement}</span>
        </span>
        <Badge tone={concept.status === 'computed' ? 'good' : 'default'}>
          {concept.status === 'computed' ? 'measured here' : 'cited'}
        </Badge>
      </button>

      {open && (
        <div className="mt-3 space-y-2.5 border-t border-lab-800 pt-2.5">
          {concept.tex && (
            <div className="overflow-x-auto rounded border border-lab-700 bg-lab-900/60 px-3 py-2 text-center text-lab-100">
              <Tex tex={concept.tex} display />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="default">{KIND_LABEL[concept.kind]}</Badge>
            {concept.see.map((s) => (
              <Link
                key={s.to + s.label}
                to={s.to}
                className="rounded border border-lab-700 bg-lab-900/60 px-2 py-0.5 text-[11px] text-lab-300 transition-colors hover:border-signal-blue hover:text-signal-blue"
              >
                {s.label} →
              </Link>
            ))}
          </div>
          <p className="text-[12px] leading-relaxed text-lab-300">
            <span className="text-lab-400">Here: </span>
            {concept.implemented}
          </p>
          {concept.url && (
            <a
              href={concept.url}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-[11.5px] text-signal-blue underline decoration-dotted"
            >
              the source this comes from ↗
            </a>
          )}
        </div>
      )}
    </article>
  );
}

export function AtlasPage() {
  const { progress } = useProgress();
  const [principle, setPrinciple] = useState<PrincipleId | 'all'>('all');
  const [kind, setKind] = useState<ConceptKind | 'all'>('all');
  const [onlyComputed, setOnlyComputed] = useState(false);
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CONCEPTS.filter((c) => {
      if (principle !== 'all' && c.principle !== principle) return false;
      if (kind !== 'all' && c.kind !== kind) return false;
      if (onlyComputed && c.status !== 'computed') return false;
      if (q && !`${c.name} ${c.statement} ${c.ref}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [principle, kind, onlyComputed, query]);

  const computed = CONCEPTS.filter((c) => c.status === 'computed').length;
  const principal = PRINCIPLES.find((p) => p.id === principle);
  // only count links that actually resolve to a lesson
  const lessonIds = new Set(LESSONS.map((l) => l.id));
  const lessonsTouched = new Set(
    CONCEPTS.flatMap((c) => c.see)
      .map((s) => s.to)
      .filter((to) => to.startsWith('/lessons/'))
      .map((to) => to.split('/').pop()!)
      .filter((id) => lessonIds.has(id)),
  ).size;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-lab-100">The theory atlas</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
            Every idea the monograph is built from, in one place, organised by the principles the authors themselves name.
            Each entry says what the idea is, where the book states it, what this application does about it, and whether
            that is something you can watch being measured or only something you can read.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/sources" className="text-[12px] text-signal-blue underline decoration-dotted">
            attribution and licensing →
          </Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Concepts" value={CONCEPTS.length} hint="compiled from the monograph" />
        <Stat label="Measured here" value={computed} hint="the rest are cited, not simulated" tone="good" />
        <Stat label="Principles" value={PRINCIPLES.length} hint="as named by the authors" />
        <Stat
          label="Lessons covered"
          value={`${lessonsTouched} / 10`}
          hint="concepts that link into the curriculum"
        />
      </div>

      <Callout tone="insight" title="How to read the status tags">
        A concept marked <span className="mono text-lab-100">measured here</span> is computed by this application, and
        the places where you can watch the number change as you move a control are linked from it. A concept marked{' '}
        <span className="mono text-lab-100">cited</span> is explained with a reference to the book but is not simulated
        here. Nothing in this site claims a measurement it does not make.
      </Callout>

      <Panel title="The principles" subtitle="The organising ideas, as named in the authors' own overview of the work.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPrinciple(principle === p.id ? 'all' : p.id)}
              className={`rounded border p-3 text-left transition-colors ${
                principle === p.id
                  ? 'border-signal-blue bg-signal-blue/10'
                  : 'border-lab-700 bg-lab-850/40 hover:border-lab-500'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-lab-100">{p.name}</span>
                <span className="mono text-[10.5px] uppercase tracking-wider text-lab-500">{p.scope}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-lab-300">{p.statement}</p>
              <p className="mono mt-1.5 text-[10.5px] text-lab-500">{p.ref}</p>
            </button>
          ))}
        </div>
      </Panel>

      <Panel
        title="The concepts"
        subtitle="Click a card for the equation, the places to see it, and what this application does with it."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="filter…"
              aria-label="filter the concepts"
              className="mono w-40 rounded border border-lab-600 bg-lab-900 px-2 py-1 text-[12px] text-lab-100 focus:border-signal-blue focus:outline-none"
            />
            <Select
              label=""
              value={kind}
              options={[
                { value: 'all' as const, label: 'every kind' },
                ...CONCEPT_KINDS.map((k) => ({
                  value: k,
                  label: KIND_LABEL[k],
                })),
              ]}
              onChange={(v) => setKind(v as ConceptKind | 'all')}
            />
            <Button
              variant={onlyComputed ? 'primary' : 'ghost'}
              onClick={() => setOnlyComputed((o) => !o)}
              title="Show only the concepts this application measures"
            >
              {onlyComputed ? 'measured only' : 'measured only'}
            </Button>
          </div>
        }
      >
        {principal && (
          <p className="mb-3 rounded border border-signal-blue/30 bg-signal-blue/10 px-3 py-2 text-[12.5px] text-lab-100">
            <span className="text-signal-blue">{principal.name}.</span> {principal.statement}{' '}
            <button
              type="button"
              className="underline decoration-dotted text-signal-blue"
              onClick={() => setPrinciple('all')}
            >
              show every principle
            </button>
          </p>
        )}
        {shown.length === 0 ? (
          <p className="text-[12.5px] text-lab-400">Nothing matches that filter.</p>
        ) : (
          <div className="grid gap-2.5 lg:grid-cols-2">
            {shown.map((c) => (
              <ConceptCard key={c.id} concept={c} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Coverage" subtitle="What the atlas points at, and where it is implemented.">
        <Table
          head={['Principle', 'Concepts', 'Measured here', 'Cited']}
          rows={PRINCIPLES.map((p) => {
            const all = CONCEPTS.filter((c) => c.principle === p.id);
            return [
              p.name,
              all.length,
              all.filter((c) => c.status === 'computed').length,
              all.filter((c) => c.status === 'cited').length,
            ];
          })}
        />
        <p className="mt-2 text-[11.5px] leading-relaxed text-lab-400">
          The concepts marked <span className="mono">beyond</span> are not in the monograph: they are recent results
          that bear on it, listed so that a reader who has met them elsewhere can see how they sit against the book's
          claims. Each carries the reference it comes from.
        </p>
      </Panel>

      <Panel title="Progress through the atlas" subtitle="The atlas does not track its own reading; the dashboard does.">
        <p className="text-[12.5px] leading-relaxed text-lab-300">
          {progress.lessons
            ? `${Object.values(progress.lessons).filter((l) => l.completed).length} of 10 lessons are marked complete on your dashboard, and ${progress.equationsViewed.length} of the equation entries have been opened.`
            : 'Your progress is stored locally; open the dashboard to see it.'}
        </p>
        <div className="mt-2 flex gap-2">
          <Link to="/dashboard" className="text-[12px] text-signal-blue underline decoration-dotted">
            open the dashboard →
          </Link>
        </div>
      </Panel>
    </div>
  );
}
