import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Panel, Badge, Select, Table } from '../components/ui';
import { EquationBlock, Tex } from '../components/Math';
import { EQUATIONS } from '../content/equations';
import { useProgress } from '../lib/persistence';
import { ACTIVATION_IDS, getActivation } from '../lib/numerics/activations';
import { liveEvaluation } from '../lib/liveExamples';
import { NOTATION_GLOSSARY } from '../content/references';

interface SymbolHit {
  equationId: string;
  equationTitle: string;
  symbol: string;
  meaning: string;
}

/** Every symbol defined anywhere in the explorer, with the equation that defines it. */
const SYMBOL_INDEX: SymbolHit[] = EQUATIONS.flatMap((e) =>
  e.symbols.map((s) => ({ equationId: e.id, equationTitle: e.title, symbol: s.symbol, meaning: s.meaning })),
);

export function EquationsPage() {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState(() => {
    const wanted = params.get('eq');
    return wanted && EQUATIONS.some((e) => e.id === wanted) ? wanted : EQUATIONS[0].id;
  });
  const [activationId, setActivationId] = useState<string>('tanh');
  const [term, setTerm] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const { viewEquation, progress } = useProgress();
  const entry = EQUATIONS.find((e) => e.id === selected)!;
const live = useMemo(() => liveEvaluation(selected, activationId), [selected, activationId]);

  const choose = (id: string) => {
    setSelected(id);
    viewEquation(id);
    // keep the URL in step, so that a definition popover can deep-link here
    const next = new URLSearchParams(params);
    next.set('eq', id);
    setParams(next, { replace: true });
  };

  const hits = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return [];
    return SYMBOL_INDEX.filter(
      (h) =>
        h.symbol.toLowerCase().includes(q) ||
        h.meaning.toLowerCase().includes(q) ||
        h.equationTitle.toLowerCase().includes(q),
    ).slice(0, 40);
  }, [term]);

  const glossary = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return NOTATION_GLOSSARY;
    return NOTATION_GLOSSARY.filter(
      (g) => g.symbol.toLowerCase().includes(q) || g.name.toLowerCase().includes(q) || g.meaning.toLowerCase().includes(q),
    );
  }, [term]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[20px] font-semibold text-lab-100">Equation explorer</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
          Each formula with: every symbol defined, the assumptions under which it holds, a stepwise derivation, a
          parameter substitution evaluated live in your browser, and a link to the laboratory that computes the same
          quantity numerically.
        </p>
        <div className="mt-3 max-w-md">
          <label className="block">
            <span className="text-[12px] text-lab-300">Look up a term</span>
            <input
              className="mono mt-1 w-full rounded border border-lab-600 bg-lab-850 px-2 py-1.5 text-[12.5px] text-lab-100 focus:border-signal-blue focus:outline-none"
              placeholder="e.g. chi, susceptibility, a₁, C_W"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </label>
          <p className="mt-1 text-[11.5px] leading-snug text-lab-400">
            {term.trim()
              ? `${hits.length} symbol${hits.length === 1 ? '' : 's'} and ${glossary.length} glossary entr${glossary.length === 1 ? 'y' : 'ies'} match.`
              : 'Type a symbol or a word to find where it is defined and what it means.'}
          </p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <nav className="space-y-1">
          {EQUATIONS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => choose(e.id)}
              className={`block w-full rounded border px-2.5 py-2 text-left text-[12.5px] transition-colors ${
                selected === e.id
                  ? 'border-signal-blue bg-signal-blue/15 text-signal-blue'
                  : 'border-lab-700 bg-lab-900/50 text-lab-300 hover:border-lab-500'
              }`}
            >
              <span className="block font-medium">{e.title}</span>
              <span className="mono mt-0.5 block text-[11px] text-lab-400">{e.ref}</span>
              {progress.equationsViewed.includes(e.id) && <span className="text-[10.5px] text-signal-green">viewed</span>}
            </button>
          ))}
        </nav>

        <div className="space-y-4">
          {term.trim() && (
            <Panel title="Search results" subtitle="Click a term to open the equation that defines it.">
              {hits.length === 0 ? (
                <p className="text-[12.5px] text-lab-400">No symbol in the explorer matches that term.</p>
              ) : (
                <ul className="space-y-1.5">
                  {hits.map((h) => (
                    <li key={`${h.equationId}-${h.symbol}`}>
                      <button
                        type="button"
                        onClick={() => {
                          choose(h.equationId);
                          setFocused(h.symbol);
                        }}
                        className="w-full rounded border border-lab-700 bg-lab-850/50 px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:border-signal-blue"
                      >
                        <span className="mr-2 inline-block text-signal-blue">
                          <Tex tex={h.symbol} />
                        </span>
                        <span className="text-lab-200">{h.meaning}</span>
                        <span className="ml-2 text-[11px] text-lab-500">— {h.equationTitle}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          <Panel
            title={entry.title}
            right={<Badge tone="good">{entry.ref}</Badge>}
            subtitle={entry.meaning}
          >
            <EquationBlock tex={entry.tex} />
            {entry.relatedLab && (
              <Link to={entry.relatedLab} className="text-[12px]">
                open the laboratory that computes this →
              </Link>
            )}
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Symbols" subtitle="Click a symbol to focus it; every term here is defined by the app.">
              <Table
                head={['Symbol', 'Meaning']}
                rows={entry.symbols.map((s) => [
                  <button
                    key={s.symbol}
                    type="button"
                    onClick={() => setFocused(focused === s.symbol ? null : s.symbol)}
                    className={`mono rounded px-1 text-left transition-colors ${
                      focused === s.symbol ? 'bg-signal-blue/20 text-signal-blue' : 'text-lab-100 hover:text-signal-blue'
                    }`}
                    title="Focus this term"
                  >
                    <Tex tex={s.symbol} />
                  </button>,
                  s.meaning,
                ])}
              />
              {focused && (
                <div className="mt-2 rounded border border-signal-blue/40 bg-signal-blue/10 p-2.5 text-[12.5px] leading-relaxed text-lab-100">
                  <div className="mono text-[11px] uppercase tracking-wider text-signal-blue">Focused term</div>
                  <div className="mt-1">
                    <Tex tex={focused} /> — {entry.symbols.find((s) => s.symbol === focused)?.meaning}
                  </div>
                  <p className="mt-1 text-[11.5px] text-lab-300">
                    Defined in <span className="mono">{entry.ref}</span>. Assumptions that this result needs are listed
                    below; they are not optional.
                  </p>
                </div>
              )}
            </Panel>

            <Panel title="Assumptions" subtitle="What must be true for the formula to apply.">
              <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-lab-200">
                {entry.assumptions.map((a) => (
                  <li key={a} className="flex gap-2">
                    <span className="text-signal-orange">◆</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel title="Derivation" subtitle="The steps, in order, with the reason for each.">
            <ol className="space-y-2">
              {entry.derivation.map((step, i) => (
                <li key={i} className="flex gap-3 rounded border border-lab-700 bg-lab-850/40 p-2.5 text-[12.5px] leading-relaxed text-lab-200">
                  <span className="mono shrink-0 text-lab-500">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel
            title="Parameter substitution"
            subtitle="The inputs below are evaluated with this app's own quadrature code, not quoted from a table."
            right={
              <div className="w-52">
                <Select
                  label="Activation for the live evaluation"
                  value={activationId}
                  options={ACTIVATION_IDS.map((id) => ({ value: id, label: getActivation(id).label }))}
                  onChange={setActivationId}
                />
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Table
                head={['Input', 'Value']}
                rows={entry.example.inputs.map((i) => [i.name, <span key={i.name} className="mono">{i.value}</span>])}
              />
              <div>
                <div className="rounded border border-signal-green/40 bg-signal-green/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-signal-green">Stated result</div>
                  <div className="mono mt-1 text-[13px] text-lab-100">{entry.example.result}</div>
                  {entry.example.note && <p className="mt-1 text-[11.5px] text-lab-300">{entry.example.note}</p>}
                </div>
                {live && (
                  <div className="mt-3">
                    <div className="mb-1 text-[11px] uppercase tracking-wider text-lab-400">Live evaluation now</div>
                    <Table head={['Quantity', 'Computed value']} rows={live.map((r) => [r[0], <span key={r[0]} className="mono">{r[1]}</span>])} />
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Notation glossary" subtitle="The symbols used throughout the app, with their conventions.">
            {glossary.length === 0 ? (
              <p className="text-[12.5px] text-lab-400">No glossary entry matches that term.</p>
            ) : (
              <Table
                head={['Symbol', 'Name', 'Meaning']}
                rows={glossary.map((g) => [
                  <span key="s" className="mono text-lab-100">{g.symbol}</span>,
                  <span key="n" className="text-lab-300">{g.name}</span>,
                  <span key="m" className="text-lab-300">{g.meaning}</span>,
                ])}
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
