import { useState, useEffect } from 'react';
import { Panel, Slider, Stat, Table, Callout, Citation, Warning, Button, Computing, Results } from '../../components/ui';
import { Plot, histogram, line, markers } from '../../components/Plot';
import { fmt } from '../../lib/theme';
import { useThemeColors } from '../../lib/useTheme';
import { useAsyncComputation } from '../../lib/hooks';
import { type ActivationId } from '../../lib/numerics/activations';
import { type WidthDepthConfig, type WidthDepthResult } from '../../lib/experiments/kernels';
import { EQUATION_REFS } from '../../content/references';
import { useProgress } from '../../lib/persistence';
import { applyPreset, usePreset } from '../../lib/presets';
import { PresetBanner } from '../../components/PresetBanner';
import { SharedSetupPanel } from '../../components/SharedSetupPanel';
import { LabLessons } from '../../components/LabLessons';
import { DownloadCsv } from '../../components/DownloadCsv';
import { useSharedSetup } from '../../lib/sharedSetup';

const DEFAULT: WidthDepthConfig = {
  activation: 'linear',
  Cw: 1,
  Cb: 0,
  width: 128,
  depths: [2, 3, 4, 6, 8, 12, 16, 24, 32],
  depth: 12,
  widths: [16, 32, 64, 128, 256, 512],
  samples: 32,
  seeds: 60,
  seed: 5,
};

export function WidthDepthLab() {
  const COLORS = useThemeColors();
  const { setup, patch: patchShared } = useSharedSetup();
  const [config, setConfig] = useState<WidthDepthConfig>(DEFAULT);
  const { recordRun } = useProgress();
  const preset = usePreset();

  useEffect(() => {
    if (!preset) return;
    const patch = applyPreset(DEFAULT, preset.settings, ['activation', 'Cw', 'Cb', 'depth', 'width', 'seeds', 'seed', 'samples']);
    patchShared({
      activation: (patch.activation ?? setup.activation) as ActivationId,
      Cw: patch.Cw ?? setup.Cw,
      Cb: patch.Cb ?? setup.Cb,
      depth: patch.depth ?? setup.depth,
      width: patch.width ?? setup.width,
      seeds: patch.seeds ?? setup.seeds,
      seed: patch.seed ?? (typeof preset.settings.seed === 'number' ? preset.settings.seed : setup.seed),
      samples: patch.samples ?? setup.samples,
    });
  }, [preset, patchShared, setup]);

  // The shared parameters drive the sweep; the ladders below are local.
  useEffect(() => {
    setConfig((c) => ({
      ...c,
      activation: setup.activation,
      Cw: setup.Cw,
      Cb: setup.Cb,
      depth: Math.min(48, Math.max(2, setup.depth)),
      width: Math.min(512, Math.max(8, setup.width)),
      samples: Math.min(128, Math.max(4, setup.samples)),
      seeds: Math.min(240, Math.max(4, setup.seeds)),
      seed: setup.seed,
    }));
  }, [setup]);
  const { status, result, error, elapsedMs, stale } = useAsyncComputation<WidthDepthResult>('width-depth', config);

  const linear = config.activation === 'linear' && config.Cb === 0;

  return (
    <div className="space-y-5">
      {preset && <PresetBanner preset={preset} labLabel="Laboratory C · Width & depth" />}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-lab-100">Laboratory C · Width, depth and finite-width behaviour</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
            The effective theory expands in 1/width, and its leading correction is proportional to depth. This laboratory
            measures both directions: sweep depth at fixed width and width at fixed depth, then look at how the seed-to-seed
            variance of the layer observable behaves.
          </p>
<LabLessons route="/labs/width-depth" className="mt-1" />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setConfig(DEFAULT)}>
            reset the sweep
          </Button>
          <Button
            onClick={() => {
              if (!result) return;
              const deepest = result.depthSweep[result.depthSweep.length - 1];
              const widest = result.widthSweep[result.widthSweep.length - 1];
              recordRun({
                id: 'width-depth-lab',
                lab: 'width-depth',
                summary: `${config.activation}, C_W=${config.Cw}, depth ${config.depth}, width ${config.width}, ${config.seeds} seeds per point, seed ${config.seed}`,
                ranAt: new Date().toISOString(),
                setup: { ...setup },
                metrics: {
                  'Var at deepest': Number(deepest.varianceKernel.toExponential(4)),
                  'analytic at deepest': deepest.predictedVariance === null ? 'n/a' : Number(deepest.predictedVariance.toExponential(4)),
                  'Var at widest': Number(widest.varianceKernel.toExponential(4)),
                  'aspect ratio': Number((config.depth / config.width).toFixed(4)),
                  runtime_ms: Math.round(elapsedMs),
                },
              });
            }}
            disabled={status !== 'done'}
          >
            record run in dashboard
          </Button>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <SharedSetupPanel compact />
          <Panel title="Sweep">
            <div className="space-y-3">
              <Slider label="Fixed width for the depth sweep" value={config.width} min={8} max={512} step={8} integer onChange={(v) => setConfig((c) => ({ ...c, width: v }))} />
              <Slider label="Fixed depth for the width sweep" value={config.depth} min={2} max={48} integer onChange={(v) => setConfig((c) => ({ ...c, depth: v }))} />
              <p className="text-[11.5px] leading-snug text-lab-400">
                The two sweeps are this laboratory&apos;s own: the depth ladder and the width ladder below are the points
                that get measured, and the shared setup supplies the activation, the initialization and the seed.
              </p>
            </div>
          </Panel>
          <Stat label="Runtime" value={status === 'done' ? `${Math.round(elapsedMs)} ms` : status} hint="Measured wall-clock for the whole sweep." />
          {!linear && (
            <Warning>
              Nonlinear activations are measured only: the closed-form fluctuation law 2ℓ(G²)²/n is exact for the deep
              linear network, and the book&apos;s general analysis is asymptotic in 1/n and involves the four-point vertex.
            </Warning>
          )}
        </aside>

        <div className="space-y-5">
          {error && <Warning>Computation failed: {error}</Warning>}
          {status === 'running' && <Computing label="Sweeping depth and width" />}
          {result && (
            <Results stale={stale}>
              <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Seed-to-seed variance vs depth" subtitle={`Fixed width ${config.width}, ${config.seeds} seeds per point.`}>
                  <Plot
                    height={320}
                    data={[
                      line(result.depthSweep.map((p) => p.x), result.depthSweep.map((p) => p.varianceKernel), 'measured Var[O^(ℓ)]', COLORS.blue),
                      ...(result.depthSweep.some((p) => p.predictedVariance !== null)
                        ? [line(result.depthSweep.map((p) => p.x), result.depthSweep.map((p) => p.predictedVariance ?? Number.NaN), 'analytic 2ℓ(G²)²/n', COLORS.orange, { line: { color: COLORS.orange, width: 2, dash: 'dash' } })]
                        : []),
                    ]}
                    layout={{ xaxis: { title: { text: 'depth ℓ' } }, yaxis: { title: { text: 'variance across seeds' }, type: 'log' } }}
                    caption="The variance grows roughly linearly with depth at fixed width: the leading finite-width correction of eq. (3.28). The analytic line is the book's 2ℓ(G⁽²⁾)²/n, evaluated per input and averaged."
                  />
                </Panel>

                <Panel title="Seed-to-seed variance vs width" subtitle={`Fixed depth ${config.depth}, ${config.seeds} seeds per point.`}>
                  <Plot
                    height={320}
                    data={[
                      line(result.widthSweep.map((p) => p.x), result.widthSweep.map((p) => p.varianceKernel), 'measured Var[O^(ℓ)]', COLORS.green),
                      ...(result.widthSweep.some((p) => p.predictedVariance !== null)
                        ? [line(result.widthSweep.map((p) => p.x), result.widthSweep.map((p) => p.predictedVariance ?? Number.NaN), 'analytic ∝ 1/width', COLORS.orange, { line: { color: COLORS.orange, width: 2, dash: 'dash' } })]
                        : []),
                    ]}
                    layout={{ xaxis: { title: { text: 'hidden width n' }, type: 'log' }, yaxis: { title: { text: 'variance across seeds' }, type: 'log' } }}
                    caption="Doubling the width halves the variance: a straight line of slope −1 on log–log axes. The observable is measured at the last hidden layer, not at the single-neuron output layer."
                  />
                </Panel>
              </div>

              <Panel
                title="The emergent scale: depth-to-width ratio"
                subtitle="Variance against ℓ/n, combining both sweeps. If L/n is the only relevant small parameter, the points should collapse onto one curve."
              >
                <Plot
                  height={320}
                  data={[
                    markers(
                      result.depthSweep.map((p) => p.x / config.width),
                      result.depthSweep.map((p) => p.varianceKernel),
                      'depth sweep (ℓ/n)',
                      COLORS.blue,
                    ),
                    markers(
                      result.widthSweep.map((p) => config.depth / p.x),
                      result.widthSweep.map((p) => p.varianceKernel),
                      'width sweep (L/n)',
                      COLORS.green,
                    ),
                  ]}
                  layout={{ xaxis: { title: { text: 'aspect ratio  ℓ / n  (log)' }, type: 'log' }, yaxis: { title: { text: 'variance across seeds' }, type: 'log' } }}
                  caption="For the linear network at criticality the analytic variance for a width sweep is 2L(G2)²C_W^{2L}/n, which is *not* purely a function of L/n once C_W ≠ 1: the collapse is exact only at C_W = 1, where it is a straight line."
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Citation label={EQUATION_REFS.linearFluctuation.label} note={EQUATION_REFS.linearFluctuation.note} />
                  <Citation label={EQUATION_REFS.fluctuationVariance.label} note={EQUATION_REFS.fluctuationVariance.note} />
                  <Citation label={EQUATION_REFS.aspectRatio.label} note={EQUATION_REFS.aspectRatio.note} />
                </div>
              </Panel>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Relative spread" subtitle="Standard deviation of the terminal kernel divided by its mean — the practical meaning of an L/n fluctuation.">
                  <Plot
                    height={300}
                    data={[
                      line(result.depthSweep.map((p) => p.x), result.depthSweep.map((p) => p.relativeSpread), 'depth sweep', COLORS.blue),
                      line(result.widthSweep.map((p) => p.x), result.widthSweep.map((p) => p.relativeSpread), 'width sweep', COLORS.green),
                    ]}
                    layout={{ xaxis: { title: { text: 'swept variable (depth or width)' }, type: 'log' }, yaxis: { title: { text: 'sd / mean' }, type: 'log' } }}
                    caption="Read this as: how different two random instantiations of this network are. It is the number that decides whether a single trained network tells you anything about the ensemble."
                  />
                </Panel>

                <Panel title="Output distributions at different widths" subtitle="Real outputs of one seeded network per width on the same inputs.">
                  <Plot
                    height={300}
                    data={result.outputHistograms.map((h, i) => histogram(h.values, h.label, [COLORS.blue, COLORS.orange, COLORS.green][i % 3], { histnorm: 'probability density', opacity: 0.6 }))}
                    layout={{ barmode: 'overlay', xaxis: { title: { text: 'network output' } }, yaxis: { title: { text: 'density' } } }}
                    caption="The histograms narrow as the width grows, and (for a critical network) the centre is preserved: this is the infinite-width limit at work."
                  />
                </Panel>
              </div>

              <Panel
                title="Numbers behind the sweeps"
                right={
                  <DownloadCsv
                    filename="width-depth-sweeps.csv"
                    meta={{
                      activation: config.activation,
                      C_W: config.Cw,
                      C_b: config.Cb,
                      samples: config.samples,
                      seeds: config.seeds,
                      seed: config.seed,
                    }}
                    header={['sweep', 'value', 'mean K^(l)', 'Var[O^(l)]', 'analytic variance', 'sd / mean']}
                    rows={[
                      ...result.depthSweep.map((p) => ['depth', p.x, p.meanKernel, p.varianceKernel, p.predictedVariance ?? '', p.relativeSpread]),
                      ...result.widthSweep.map((p) => ['width', p.x, p.meanKernel, p.varianceKernel, p.predictedVariance ?? '', p.relativeSpread]),
                    ]}
                  />
                }
              >
                <Table
                  head={['sweep', 'value', 'mean K^(ℓ)', 'Var[O^(ℓ)]', 'analytic variance', 'sd / mean']}
                  rows={[
                    ...result.depthSweep.map((p) => [
                      'depth',
                      <span key="x" className="mono">{p.x}</span>,
                      <span key="m" className="mono">{fmt(p.meanKernel, 5)}</span>,
                      <span key="v" className="mono">{fmt(p.varianceKernel, 6)}</span>,
                      <span key="pv" className="mono">{p.predictedVariance === null ? '—' : fmt(p.predictedVariance, 6)}</span>,
                      <span key="r" className="mono">{fmt(p.relativeSpread, 4)}</span>,
                    ]),
                    ...result.widthSweep.map((p) => [
                      'width',
                      <span key="x" className="mono">{p.x}</span>,
                      <span key="m" className="mono">{fmt(p.meanKernel, 5)}</span>,
                      <span key="v" className="mono">{fmt(p.varianceKernel, 6)}</span>,
                      <span key="pv" className="mono">{p.predictedVariance === null ? '—' : fmt(p.predictedVariance, 6)}</span>,
                      <span key="r" className="mono">{fmt(p.relativeSpread, 4)}</span>,
                    ]),
                  ]}
                />
                <div className="mt-3 space-y-2">
                  {result.notes.map((n) => (
                    <p key={n} className="text-[12px] leading-relaxed text-lab-400">
                      · {n}
                    </p>
                  ))}
                </div>
                <Callout tone="limitation" title="What this does not show">
                  The book&apos;s full effective theory tracks all couplings of the preactivation distribution, not only the
                  kernel. This laboratory isolates the kernel fluctuations, which is the leading effect and the one with a
                  closed-form prediction to compare against.
                </Callout>
              </Panel>
            </Results>
          )}
        </div>
      </div>
    </div>
  );
}
