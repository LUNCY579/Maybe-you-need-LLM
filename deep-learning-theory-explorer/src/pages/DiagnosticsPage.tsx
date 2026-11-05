import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Badge, Stat, Table, Callout, Button } from '../components/ui';
import { runDiagnostics, type DiagnosticResult } from '../lib/diagnostics';
import { DownloadCsv } from '../components/DownloadCsv';
import { fmt } from '../lib/theme';

/**
 * The self-test page.
 *
 * The laboratories make claims; this page re-checks the load-bearing ones in
 * the reader's own browser, with the same code the laboratories use. If a number
 * on screen is to be trusted, the machinery behind it should be checkable.
 */
export function DiagnosticsPage() {
  const [results, setResults] = useState<DiagnosticResult[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    // yield once so the button can show its state before the work starts
    window.setTimeout(() => {
      setResults(runDiagnostics());
      setRunning(false);
    }, 30);
  };

  const passed = results ? results.filter((r) => r.passed).length : 0;
  const failed = results ? results.length - passed : 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-lab-100">Self-test</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
            The laboratories make claims. This page re-checks the load-bearing ones in your browser, with the same code the
            laboratories use, and shows what it measured. If a number on screen is to be trusted, the machinery behind it
            should be checkable.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={run} disabled={running}>
            {running ? 'running…' : 'run the self-test'}
          </Button>
        </div>
      </header>

      {results && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Checks" value={results.length} />
          <Stat label="Passed" value={passed} tone={failed === 0 ? 'good' : 'bad'} />
          <Stat label="Failed" value={failed} tone={failed === 0 ? 'good' : 'bad'} />
        </div>
      )}

      {results && failed > 0 && (
        <Callout tone="warning" title="Some checks did not pass">
          That is worth reporting. It means this browser disagrees with the theory, or with the test suite — not that the
          theory is wrong. The failing rows below say by how much.
        </Callout>
      )}
      {results && failed === 0 && (
        <Callout tone="insight" title="Every check passed">
          This browser reproduces the theory to the stated precision, on the same code the laboratories run.
        </Callout>
      )}

      <Panel
        title="The checks"
        subtitle="Each row states the claim, the book reference, and what this browser measured."
        right={
          results ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={failed === 0 ? 'good' : 'bad'}>
                {passed} / {results.length} passed
              </Badge>
              <DownloadCsv
                filename="self-test-results.csv"
                meta={{
                  browser: navigator.userAgent,
                  checks: results.length,
                  passed,
                  failed,
                  when: new Date().toISOString(),
                }}
                header={['check', 'reference', 'claim', 'measured', 'expected', 'result', 'time_ms']}
                rows={results.map((r) => [
                  r.name,
                  r.ref ?? '',
                  r.claim,
                  r.error ? '' : r.measured,
                  r.error ? '' : r.expected,
                  r.error ? 'error' : r.passed ? 'pass' : 'fail',
                  Number(r.durationMs.toFixed(3)),
                ])}
                label="download the results"
              />
            </div>
          ) : undefined
        }
      >
        {results ? (
          <Table
            head={['Check', 'Claim', 'Measured', 'Expected', 'Result', 'Time']}
            rows={results.map((r) => [
              <span key="n" className="font-medium text-lab-100">
                {r.name}
                {r.ref && <span className="mono ml-1 text-[10.5px] text-lab-500">{r.ref}</span>}
              </span>,
              <span key="c" className="text-lab-300">
                {r.claim}
              </span>,
              <span key="m" className="mono text-lab-100">
                {r.error ? '—' : fmt(r.measured, 5)}
              </span>,
              <span key="e" className="mono text-lab-300">
                {r.error ? '—' : fmt(r.expected, 5)}
              </span>,
              <span key="r">
                {r.error ? (
                  <Badge tone="bad">error</Badge>
                ) : r.passed ? (
                  <Badge tone="good">pass</Badge>
                ) : (
                  <Badge tone="bad">fail</Badge>
                )}
              </span>,
              <span key="t" className="mono text-lab-400">
                {r.durationMs.toFixed(1)} ms
              </span>,
            ])}
          />
        ) : (
          <p className="text-[12.5px] text-lab-400">
            Press <span className="mono text-lab-200">run the self-test</span> to check this browser. The checks are the
            same ones the automated test suite makes, so a pass here means the same thing.
          </p>
        )}
      </Panel>

      <Panel title="What this is not" subtitle="The limits of a self-test.">
        <div className="grid gap-3 md:grid-cols-2">
          <Callout tone="limitation" title="A check is not a proof">
            Each row confirms one number against a known value. The theory is established by the derivations in the
            monograph, not by this page; what this page establishes is that <em>this browser</em> computes the same
            numbers.
          </Callout>
          <Callout tone="limitation" title="It covers the load-bearing parts only">
            The finite-width corrections, the effective action and the finite-width Bayesian posterior are not checked
            here, because they are not implemented here. The theory atlas says which is which.
          </Callout>
        </div>
        <div className="mt-3 flex gap-3">
          <Link to="/atlas" className="text-[12px] text-signal-blue underline decoration-dotted">
            open the theory atlas →
          </Link>
          <Link to="/sources" className="text-[12px] text-signal-blue underline decoration-dotted">
            attribution and licensing →
          </Link>
        </div>
      </Panel>
    </div>
  );
}
