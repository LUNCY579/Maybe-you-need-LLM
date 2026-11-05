import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Badge, Table, Callout } from '../components/ui';
import { Rich, Tex } from '../components/Math';
import { TERMS } from '../lib/terminology';
import { PREREQUISITE_TOOLS, type PrerequisiteTool } from '../content/prerequisites';

/**
 * Prerequisite navigator: the mathematical toolkit, what each tool is used for in
 * the theory, and where in the app it is exercised. Each entry links to the lesson
 * or laboratory that makes it concrete.
 *
 * The table lives in `src/content/prerequisites.ts` because Laboratory F grades
 * the same eight tools; a tool listed here and not there, or there and not here,
 * would be a promise the course does not keep.
 */

export function Prerequisites() {
  const [filter, setFilter] = useState<'all' | PrerequisiteTool['level']>('all');
  const shown = filter === 'all' ? PREREQUISITE_TOOLS : PREREQUISITE_TOOLS.filter((t) => t.level === filter);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[20px] font-semibold text-lab-100">Mathematical prerequisite navigator</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
          {PREREQUISITE_TOOLS.length} tools carry the whole framework. For each one: what it is used for in the theory,
          where this app makes it concrete, and a self-check question whose answer you can compare against the
          app&apos;s own computation. To have those questions graded, work through{' '}
          <Link to="/labs/drills" className="text-signal-blue underline decoration-dotted">
            Laboratory F
          </Link>
          .
        </p>
        <div className="mt-3 flex gap-2">
          {(['all', 'essential', 'helpful', 'later'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded border px-2.5 py-1 text-[12px] ${
                filter === f ? 'border-signal-blue bg-signal-blue/15 text-signal-blue' : 'border-lab-600 text-lab-300 hover:border-lab-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((tool) => (
          <Panel
            key={tool.id}
            title={tool.name}
            right={<Badge tone={tool.level === 'essential' ? 'good' : tool.level === 'helpful' ? 'warn' : 'default'}>{tool.level}</Badge>}
            subtitle={<span className="mono">{tool.usedFor}</span>}
          >
            <div className="rounded border border-lab-700 bg-lab-850/50 px-3 py-2 text-center text-lab-100">
              <Tex tex={tool.tex} display />
            </div>
            <p className="mt-2 text-[12.5px] text-lab-300">
              <span className="text-lab-400">Exercised in:</span> {tool.where}
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-lab-300">
              <span className="text-lab-400">Self-check:</span> <Rich text={tool.selfCheck} />
            </p>
            <div className="mt-2">
              <Link to={tool.route} className="text-[12px]">
                go to the relevant screen →
              </Link>
            </div>
          </Panel>
        ))}
      </div>

      <Panel title="The notation you will meet" subtitle="Every symbol the course leans on, with the place in the book that defines it.">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {TERMS.map((t) => (
            <div key={t.id} className="rounded border border-lab-700 bg-lab-850/40 p-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] text-signal-blue">
                  <Tex tex={t.symbol} />
                </span>
                <span className="text-[12.5px] font-semibold text-lab-100">{t.name}</span>
                <span className="mono ml-auto text-[10.5px] text-lab-500">{t.ref}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-lab-300">{t.meaning}</p>
              {t.equationId && (
                <Link to={`/equations?eq=${t.equationId}`} className="mt-1 inline-block text-[11.5px] text-signal-blue underline decoration-dotted">
                  open the derivation →
                </Link>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-lab-400">
          The same definitions are available on demand: in every lesson, a symbol written in this style is clickable
          and opens its definition where you meet it.
        </p>
      </Panel>

      <Panel title="How to use this app" subtitle="A suggested path for a first pass.">
        <Table
          head={['Step', 'Screen', 'What you should be able to say afterwards']}
          rows={[
            ['1', <Link key="a" to="/lessons/non-gaussianity">Lesson 1</Link>, 'Why Gaussian statistics are the starting point, and what a connected correlator measures.'],
            ['2', <Link key="b" to="/labs/physics">Physics lab</Link>, 'How changing C_W moves the network between decaying, critical and exploding signals.'],
            ['3', <Link key="c" to="/lessons/linear-criticality">Lesson 3</Link>, 'Why C_W = 1 is the critical point of a deep linear network — and how to prove it.'],
            ['4', <Link key="d" to="/labs/initialization">Lab A</Link>, 'How to locate the critical C_W of a nonlinear activation by measurement.'],
            ['5', <Link key="e" to="/lessons/universality">Lesson 7</Link>, 'Why tanh and sin share a power-law exponent while sigmoid has no critical point at all.'],
            ['6', <Link key="f" to="/labs/ntk">Lab D</Link>, 'What an NTK matrix is made of, and why its width scaling forces a 1/n learning rate.'],
            ['7', <Link key="g" to="/labs/representation">Lab E</Link>, 'What actually changes in the hidden representation when you train, and how that depends on width.'],
          ]}
        />
        <Callout tone="insight" title="A note on units and conventions">
          <Rich
            text={
              'Throughout, widths are neuron counts, $C_W$ is the *rescaled* weight variance (Var(W) = C_W / n_{in}) and $K$ is a variance of preactivations, which is why kernels here are O(1). If you compare with a paper that uses a different convention, translate the variance rather than the standard deviation.'
            }
          />
        </Callout>
      </Panel>
    </div>
  );
}
