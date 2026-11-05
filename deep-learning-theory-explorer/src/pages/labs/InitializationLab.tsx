import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Slider, Select, Stat, Table, Badge, Callout, Citation, Warning, Button, Computing, Results } from '../../components/ui';
import { Plot, line } from '../../components/Plot';
import { fmt, linspace } from '../../lib/theme';
import { useThemeColors } from '../../lib/useTheme';
import { useAsyncComputation } from '../../lib/hooks';
import { ACTIVATION_IDS, getActivation, taylorCoefficients, type ActivationId } from '../../lib/numerics/activations';
import { criticalityRatio, findCriticalPoints, kernelFlowDiagonal, powerLawPrediction, taylorA1 } from '../../lib/numerics/gaussian';
import { type InitializationConfig, type InitializationResult } from '../../lib/experiments/kernels';
import { EQUATION_REFS } from '../../content/references';
import { useProgress } from '../../lib/persistence';
import { applyPreset, usePreset } from '../../lib/presets';
import { PresetBanner } from '../../components/PresetBanner';
import { useSharedSetup } from '../../lib/sharedSetup';
import { DownloadCsv } from '../../components/DownloadCsv';
import { SharedSetupPanel } from '../../components/SharedSetupPanel';
import { LabLessons } from '../../components/LabLessons';

interface Row extends InitializationConfig {
  id: string;
  label: string;
}

/**
 * The three comparison rows are a controlled experiment: the same architecture
 * and the same initialization, with only the weight variance changed. The
 * multipliers are fixed so that the three curves are always comparable, and the
 * anchor value comes from the shared setup.
 */
const MULTIPLIERS = [1, 0.7, 1.4];
const ROW_IDS = ['crit', 'low', 'high'];
const ROW_LABELS = ['(critical)', '(sub-critical)', '(super-critical)'];

function buildRows(base: Row): Row[] {
  return MULTIPLIERS.map((m, i) => ({
    ...base,
    id: ROW_IDS[i],
    Cw: base.Cw * m,
    label: `C_W = ${fmt(base.Cw * m, 2)} ${ROW_LABELS[i]}`,
  }));
}

const DEFAULT_BASE: Row = {
  id: 'crit',
  label: 'C_W = 1 (critical)',
  activation: 'tanh',
  Cw: 1,
  Cb: 0,
  depth: 24,
  width: 128,
  samples: 48,
  seeds: 8,
  seed: 1,
  input: { distribution: 'gaussian', scale: 1, dim: 8 },
  initDistribution: 'gaussian',
};

export function InitializationLab() {
  const COLORS = useThemeColors();
  const { setup, patch: patchShared } = useSharedSetup();
  const [selectedActivation, setSelectedActivation] = useState<ActivationId>('tanh');
  const { recordRun } = useProgress();
  const preset = usePreset();

  /**
   * The three comparison rows are derived from the shared setup: the same
   * architecture and the same initialization, with only the weight variance
   * changed, in a fixed ratio. There is exactly one source of truth, so a
   * change in the shared setup is immediately a change here.
   */
  const rows: Row[] = useMemo(
    () =>
      buildRows({
        ...DEFAULT_BASE,
        activation: setup.activation,
        Cw: setup.Cw,
        Cb: setup.Cb,
        depth: setup.depth,
        width: setup.width,
        samples: setup.samples,
        seeds: setup.seeds,
        seed: setup.seed,
        initDistribution: setup.initDistribution,
        input: { distribution: setup.inputDistribution, scale: setup.inputScale, dim: setup.inputDim },
      }),
    [setup],
  );

  // A gallery preset sets the *critical* configuration; the sub- and
  // super-critical comparison rows are derived from it, so the three curves
  // stay a controlled comparison.
  useEffect(() => {
    if (!preset) return;
    const patch = applyPreset(DEFAULT_BASE, preset.settings, [
      'activation',
      'Cw',
      'Cb',
      'depth',
      'width',
      'samples',
      'seeds',
      'seed',
    ]);
    patchShared({
      activation: (patch.activation ?? setup.activation) as ActivationId,
      Cw: patch.Cw ?? setup.Cw,
      Cb: patch.Cb ?? setup.Cb,
      depth: patch.depth ?? setup.depth,
      width: patch.width ?? setup.width,
      samples: patch.samples ?? setup.samples,
      seeds: patch.seeds ?? setup.seeds,
      seed: patch.seed ?? (typeof preset.settings.seed === 'number' ? preset.settings.seed : setup.seed),
    });
  }, [preset, patchShared, setup]);

  /** Re-anchor the trio: the rows stay a controlled comparison. */
  const updateCw = (anchor: number) => patchShared({ Cw: anchor });

  const runs = useAsyncComputation<InitializationResult[]>('initialization-rows', { rows });

  const act = getActivation(selectedActivation);
  const scanner = useMemo(() => {
    const points = findCriticalPoints(act, { Kmax: 6, steps: 1200 });
    const Kgrid = linspace(1e-4, 6, 240);
    const curve = Kgrid.map((K) => criticalityRatio(act, K));
    const gp = Kgrid.map((K) => {
      const eps = 1e-5;
      return (criticalityRatio(act, K + eps) - criticalityRatio(act, K - eps)) / (2 * eps);
    });
    void gp;
    return { points, physical: points.filter((p) => p.physical), Kgrid, curve };
  }, [act]);

  /*
   * The critical point to report.
   *
   * The trivial fixed point K* = 0 is always there — the kernel stays at zero
   * whatever C_W is — so the nontrivial root is the one a reader can act on.
   * When there is none, the K = 0 class root is the answer, and for the
   * sigmoid there is no physical root at all.
   */
  const critical = useMemo(() => {
    const physical = scanner.physical;
    const nontrivial = physical.find((p) => p.Kstar > 1e-8);
    if (nontrivial) return nontrivial;
    return physical.length ? physical[physical.length - 1] : null;
  }, [scanner]);

  const powerLaw = useMemo(() => {
    if (act.universality !== 'K=0') return null;
    const Cw = act.critical?.Cw ?? 1;
    const flow = kernelFlowDiagonal(act, 1, Cw, 0, 200);
    const K1 = flow[0];
    return {
      exact: flow,
      asymptote: flow.map((_, i) => powerLawPrediction(taylorA1(act), K1, i + 1)),
      a1: taylorA1(act),
    };
  }, [act]);

  return (
    <div className="space-y-5">
      {preset && <PresetBanner preset={preset} labLabel="Laboratory A · Initialization" />}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-lab-100">Laboratory A · Initialization and signal propagation</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
            Three configurations of the same architecture, each run as an ensemble of seeded networks. The measured
            layer-wise kernel, its seed-to-seed spread and the backpropagated gradient signal are compared with the
            infinite-width recursion computed by quadrature.
          </p>
<LabLessons route="/labs/initialization" className="mt-1" />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => patchShared({ Cw: 1 })}>
            reset the comparison
          </Button>
          <Button
            onClick={() => {
              if (runs.status !== 'done' || !runs.result) return;
              runs.result.forEach((r, i) => {
                const row = rows[i];
                const terminal = r.layers[r.layers.length - 1];
                recordRun({
                  id: `initialization-${row.id}`,
                  lab: 'initialization',
                  presetId: row.id,
                  summary: `${row.label}: ${row.activation}, C_W=${row.Cw}, depth ${row.depth}, width ${row.width}, ${row.seeds} seeds, seed ${row.seed}`,
                  ranAt: new Date().toISOString(),
                  setup: { ...setup },
                  metrics: {
                    'K^(1)': Number(r.layers[0].measured.toFixed(5)),
                    'K^(L)': Number(terminal.measured.toFixed(5)),
                    'sd at L': Number(terminal.spread.toFixed(5)),
                    'grad RMS at L': Number(terminal.gradRms.toFixed(6)),
                  },
                });
              });
            }}
            disabled={runs.status !== 'done'}
          >
            record run in dashboard
          </Button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <SharedSetupPanel compact />
        <Panel
          title="Configurations"
          subtitle="A controlled comparison: the same architecture and initialization, with only the weight variance changed."
          right={<Badge tone="good">{runs.status === 'done' ? `computed in ${Math.round(runs.elapsedMs)} ms` : runs.status}</Badge>}
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded border border-lab-700 bg-lab-850/40 p-3">
                <input
                  className="mb-2 w-full rounded border border-lab-600 bg-lab-900 px-2 py-1 text-[12.5px] text-lab-100"
                  value={row.label}
                  onChange={() => updateCw(row.Cw)}
                  readOnly
                  title="The three rows are locked in ratio: edit the anchor C_W to move all three"
                />
                <Slider label="C_W" value={row.Cw} min={0.1} max={3} step={0.01} onChange={(v) => updateCw(v / MULTIPLIERS[rows.indexOf(row)])} />
                <p className="mt-1 text-[11px] leading-snug text-lab-400">
                  {row.id === 'crit'
                    ? 'The anchor: the critical weight variance, taken from the shared setup.'
                    : `The same network at ${row.id === 'low' ? '0.7×' : '1.4×'} the anchor, so the three curves differ only in C_W.`}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-snug text-lab-400">
            The activation, the bias variance, the depth, the width and the seed come from the shared setup, so this
            laboratory and the others are always measuring the same experiment.
          </p>
        </Panel>
      </div>

      {runs.error && <Warning>Computation failed: {runs.error}</Warning>}
      {runs.status === 'running' && <Computing label="Measuring the three ensembles" />}

      {runs.result && (
        <Results stale={runs.stale}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {runs.result.map((r, i) => {
              const first = r.layers[0];
              const last = r.layers[r.layers.length - 1];
              const ratio = last.measured / first.measured;
              return (
                <Stat
                  key={rows[i].id}
                  label={rows[i].label}
                  value={`K: ${fmt(first.measured, 3)} → ${fmt(last.measured, 3)}`}
                  hint={`ratio ${fmt(ratio, 3)} · ${rows[i].activation} · ${rows[i].seeds} seeds`}
                  tone={ratio > 1.8 ? 'bad' : ratio < 0.55 ? 'warn' : 'good'}
                />
              );
            })}
          </div>

          <Panel title="Kernel profiles" subtitle="Measured (solid, with a filled ±1 sd band) against the recursion (dotted).">
            <Plot
              height={380}
              data={runs.result.flatMap((r, i) => {
                const color = [COLORS.blue, COLORS.orange, COLORS.green][i % 3];
                return [
                  {
                    type: 'scatter',
                    mode: 'lines',
                    x: r.layers.map((l) => l.layer),
                    y: r.layers.map((l) => l.measured + l.spread),
                    line: { color, width: 0 },
                    showlegend: false,
                    hoverinfo: 'skip',
                  },
                  {
                    type: 'scatter',
                    mode: 'lines',
                    x: r.layers.map((l) => l.layer),
                    y: r.layers.map((l) => Math.max(1e-12, l.measured - l.spread)),
                    line: { color, width: 0 },
                    fill: 'tonexty',
                    fillcolor: color.replace(')', ',0.14)').replace('#', 'rgba(') === color ? 'rgba(90,169,255,0.14)' : 'rgba(90,169,255,0.14)',
                    showlegend: false,
                    hoverinfo: 'skip',
                  },
                  line(r.layers.map((l) => l.layer), r.layers.map((l) => l.measured), `${rows[i].label} (measured)`, color),
                  line(
                    r.layers.map((l) => l.layer),
                    r.layers.map((l) => l.theory),
                    `${rows[i].label} (theory)`,
                    color,
                    { line: { color, width: 1.5, dash: 'dot' } },
                  ),
                ];
              })}
              layout={{
                xaxis: { title: { text: 'layer ℓ' } },
                yaxis: { title: { text: 'K^(ℓ)' }, type: 'log' },
              }}
              caption="At criticality the profile is flat (linear activation) or follows a gentle power law (K = 0 class). Below and above it decays or blows up exponentially — straight lines on this log axis."
            />
          </Panel>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <Panel
              title="Criticality scanner"
              subtitle={`Condition (5.73) evaluated by quadrature for ${act.label}. Roots are where the curve crosses 1.`}
              right={<Badge tone={scanner.physical.length ? 'good' : 'bad'}>{scanner.physical.length} physical root(s)</Badge>}
            >
              <Plot
                height={300}
                data={[
                  line(scanner.Kgrid, scanner.curve, 'χ⊥/χ∥', COLORS.blue),
                  line([scanner.Kgrid[0], scanner.Kgrid[scanner.Kgrid.length - 1]], [1, 1], 'criticality ( = 1 )', COLORS.green, {
                    line: { color: COLORS.green, width: 1.5, dash: 'dash' },
                  }),
                ]}
                layout={{ xaxis: { title: { text: 'candidate fixed point K*' } }, yaxis: { title: { text: 'ratio' }, range: [0, Math.min(6, Math.max(2, Math.max(...scanner.curve.filter(Number.isFinite)) * 1.2))] } }}
                caption="The ratio is computed with the same Gauss-Hermite quadrature used by every other panel, so the scanner and the theory curves cannot disagree."
              />
              <Table
                head={['K*', 'C_W', 'C_b', 'physical?', 'note']}
                rows={
                  scanner.points.length === 0
                    ? [['—', '—', '—', 'no root found in [0, 6]', 'this activation has no nontrivial fixed point']]
                    : scanner.points.map((p) => [
                        <span key="k" className="mono">{fmt(p.Kstar, 5)}</span>,
                        <span key="w" className="mono">{fmt(p.Cw, 5)}</span>,
                        <span key="b" className="mono">{fmt(p.Cb, 5)}</span>,
                        p.physical ? <Badge key="p" tone="good">yes</Badge> : <Badge key="p" tone="bad">no</Badge>,
                        p.note,
                      ])
                }
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Citation label={EQUATION_REFS.secondCondition.label} note={EQUATION_REFS.secondCondition.note} />
                <Citation label={EQUATION_REFS.scaleInvariant.label} note={EQUATION_REFS.scaleInvariant.note} />
              </div>
            </Panel>

            <Panel
              title="Activation classification"
              subtitle="Choose an activation to inspect: its universality class, critical hyperparameters and deep behaviour."
              right={
                <div className="w-44">
                  <Select
                    label="activation"
                    value={selectedActivation}
                    options={ACTIVATION_IDS.map((id) => ({ value: id, label: getActivation(id).label }))}
                    onChange={(v) => setSelectedActivation(v as ActivationId)}
                  />
                </div>
              }
            >
              <Table
                head={['Property', 'Value']}
                rows={[
                  ['universality class', act.universality],
                  ['σ(0)', <span key="f0" className="mono">{fmt(act.f(0))}</span>],
                  ['γ₁ = σ′(0)', <span key="g1" className="mono">{fmt(taylorCoefficients(act).gamma1)}</span>],
                  ['a₁ (quartic coupling)', <span key="a1" className="mono">{fmt(taylorA1(act))}</span>],
                  [
                    'A² (scale-invariant)',
                    act.scaleInvariantA2 ? <span key="a2" className="mono">{fmt(act.scaleInvariantA2)}</span> : '—',
                  ],
                  ['critical C_W', critical ? <span key="cw" className="mono">{fmt(critical.Cw, 5)}</span> : 'none'],
                  ['critical C_b', critical ? <span key="cb" className="mono">{fmt(critical.Cb, 5)}</span> : 'none'],
                ]}
              />
              <Callout tone={scanner.physical.length ? 'insight' : 'warning'} title="Why">
                {act.criticalityNote}
              </Callout>
              <div className="mt-2 flex flex-wrap gap-2">
                {act.refs.map((r) => (
                  <Citation key={r} label={r} note="source section for this activation" />
                ))}
              </div>
            </Panel>
          </div>

          {powerLaw && (
            <Panel
              title={`Power-law decay for ${act.label}`}
              subtitle="Exact recursion (quadrature) against the asymptotic law 1/((−a₁)ℓ). The difference at small ℓ is the O(1) offset the asymptotic form drops."
            >
              <Plot
                height={300}
                data={[
                  line(powerLaw.exact.map((_, i) => i + 1), powerLaw.exact, 'exact recursion', COLORS.blue),
                  line(
                    powerLaw.exact.map((_, i) => i + 1),
                    powerLaw.asymptote,
                    `asymptote 1/(${fmt(-powerLaw.a1, 3)}ℓ)`,
                    COLORS.orange,
                    { line: { color: COLORS.orange, width: 1.5, dash: 'dash' } },
                  ),
                ]}
                layout={{ xaxis: { title: { text: 'layer ℓ' } }, yaxis: { title: { text: 'K^(ℓ)' }, type: 'log' } }}
                caption={`Both curves start from K^(1) = 1. a₁ = ${fmt(powerLaw.a1, 4)}; the universal exponent is 1 and the coefficient is activation dependent.`}
              />
            </Panel>
          )}

          <Panel title="Measured gradient signal" subtitle="The gradient RMS profile for each configuration; a flat profile means the signal neither dies nor explodes.">
            <Plot
              height={320}
              data={runs.result.map((r, i) =>
                line(
                  r.layers.map((l) => l.layer),
                  r.layers.map((l) => l.gradRms),
                  `${rows[i].label} · ${rows[i].activation}`,
                  [COLORS.violet, COLORS.red, COLORS.yellow][i % 3],
                ),
              )}
              layout={{ xaxis: { title: { text: 'layer ℓ' } }, yaxis: { title: { text: '∂L/∂z RMS' }, type: 'log' } }}
              caption="Output-layer values are systematically lower because the read-out is a single unit; compare the slopes rather than the absolute levels."
            />
          </Panel>

          <Panel
            title="Same, at a glance"
            right={
              runs.result.length > 0 ? (
                <DownloadCsv
                  filename="lab-a-critical-comparison.csv"
                  meta={{
                    activation: rows[0]?.activation ?? '',
                    seeds: rows[0]?.seeds ?? 0,
                    seed: setup.seed,
                    samples: setup.samples,
                    configurations: rows.length,
                  }}
                  header={['configuration', 'activation', 'C_W', 'C_b', 'depth', 'width', 'K^(1)', 'K^(L)', 'ratio', 'spread at L']}
                  rows={runs.result.map((r, i) => {
                    const last = r.layers[r.layers.length - 1];
                    return [
                      rows[i].label,
                      rows[i].activation,
                      rows[i].Cw,
                      rows[i].Cb,
                      rows[i].depth,
                      rows[i].width,
                      Number(r.layers[0].measured.toFixed(6)),
                      Number(last.measured.toFixed(6)),
                      Number((last.measured / r.layers[0].measured).toFixed(6)),
                      Number(last.spread.toFixed(6)),
                    ];
                  })}
                />
              ) : undefined
            }
          >
            <Table
              head={['Configuration', 'activation', 'C_W', 'C_b', 'depth', 'width', 'K^(1)', 'K^(L)', 'ratio', 'spread at L']}
              rows={runs.result.map((r, i) => {
                const last = r.layers[r.layers.length - 1];
                return [
                  rows[i].label,
                  rows[i].activation,
                  <span key="w" className="mono">{rows[i].Cw}</span>,
                  <span key="b" className="mono">{rows[i].Cb}</span>,
                  rows[i].depth,
                  rows[i].width,
                  <span key="k1" className="mono">{fmt(r.layers[0].measured, 4)}</span>,
                  <span key="kl" className="mono">{fmt(last.measured, 4)}</span>,
                  <span key="r" className="mono">{fmt(last.measured / r.layers[0].measured, 4)}</span>,
                  <span key="s" className="mono">{fmt(last.spread, 4)}</span>,
                ];
              })}
            />
            <p className="mt-2 text-[12px] text-lab-400">
              {runs.result[0]?.notes.join(' ')} See <Link to="/lessons/criticality">Lesson 6</Link> for the derivation and{' '}
              <Link to="/labs/width-depth">Laboratory C</Link> for how the spread scales with depth and width.
            </p>
          </Panel>

          <Callout tone="limitation" title="What this does not establish">
            The critical point found here is the one of <em>this</em> architecture at <em>this</em> width, measured by
            seeded networks. The book&rsquo;s result is the infinite-width statement; the finite-width corrections that
            separate the two are not implemented here, and the effective action of Chapter 5 — with all of its
            couplings — is not part of this application at all. The theory atlas says which ideas are measured and
            which are only cited.
          </Callout>
        </Results>
      )}
    </div>
  );
}

