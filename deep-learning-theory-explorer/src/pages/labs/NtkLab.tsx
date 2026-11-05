import { useState, useEffect } from 'react';
import { Panel, Slider, Stat, Table, Callout, Citation, Warning, Button, Computing, Results } from '../../components/ui';
import { Plot, heatmap, histogram, line, markers } from '../../components/Plot';
import { fmt } from '../../lib/theme';
import { useThemeColors } from '../../lib/useTheme';
import { useAsyncComputation } from '../../lib/hooks';
import { type ActivationId } from '../../lib/numerics/activations';
import { type NtkAnalysis, type NtkConfig, type NtkDriftResult, type NtkWidthScaling } from '../../lib/experiments/training';
import { EQUATION_REFS } from '../../content/references';
import { useProgress } from '../../lib/persistence';
import { applyPreset, usePreset } from '../../lib/presets';
import { PresetBanner } from '../../components/PresetBanner';
import { SharedSetupPanel } from '../../components/SharedSetupPanel';
import { LabLessons } from '../../components/LabLessons';
import { DownloadCsv } from '../../components/DownloadCsv';
import { useSharedSetup } from '../../lib/sharedSetup';

const DEFAULT: NtkConfig = {
  activation: 'tanh',
  Cw: 1,
  Cb: 0,
  depth: 2,
  width: 64,
  samples: 5,
  inputDim: 3,
  seeds: 64,
  seed: 21,
};

export function NtkLab() {
  const COLORS = useThemeColors();
  const { setup, patch: patchShared } = useSharedSetup();
  const [config, setConfig] = useState<NtkConfig>(DEFAULT);
  const [driftSteps, setDriftSteps] = useState(150);
  const [driftLr, setDriftLr] = useState(0.08);
  const { recordRun } = useProgress();
  const preset = usePreset();

  // The shared parameters come from the shared setup; the kernel-matrix size and
  // the input dimension are specific to this laboratory.
  //
  // The depth is special: the closed-form comparison of eq. (7.17) exists only
  // for a two-layer network, and this laboratory is about a *small* network. So
  // the shared depth is followed only when it is already shallow; otherwise
  // the laboratory keeps its own two-layer setting and says so.
  useEffect(() => {
    setConfig((c) => ({
      ...c,
      activation: setup.activation,
      Cw: setup.Cw,
      Cb: setup.Cb,
      depth: setup.depth <= 4 ? setup.depth : c.depth,
      width: setup.width,
      samples: Math.min(10, Math.max(2, setup.samples)),
      seeds: setup.seeds,
      seed: setup.seed,
    }));
  }, [setup]);

  useEffect(() => {
    if (!preset) return;
    const patch = applyPreset(DEFAULT, preset.settings, ['activation', 'Cw', 'Cb', 'depth', 'width', 'samples', 'seeds', 'seed']);
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

  const analysis = useAsyncComputation<NtkAnalysis>('ntk', config);
  const scaling = useAsyncComputation<NtkWidthScaling>('ntk-scaling', { ...config, depth: 2 });
  const drift = useAsyncComputation<NtkDriftResult>('ntk-drift', {
    activation: config.activation,
    Cw: config.Cw,
    Cb: config.Cb,
    width: config.width,
    depth: config.depth,
    steps: driftSteps,
    learningRate: driftLr,
    sampleCount: config.samples,
    seed: config.seed,
    comparisonWidths: [8, 32, 128],
  });

  const r = analysis.result;
  const labels = r ? r.inputLabels.map((i) => `x${i}`) : [];

  return (
    <div className="space-y-5">
      {preset && <PresetBanner preset={preset} labLabel="Laboratory D · Neural tangent kernel" />}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-lab-100">Laboratory D · Neural tangent kernel</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
            Assemble the NTK from exact parameter Jacobians, check that it is a symmetric positive-semidefinite Gram matrix,
            compare it with a closed-form ensemble prediction for two-layer networks, measure how it scales with width, and
            watch it move during training.
          </p>
<LabLessons route="/labs/ntk" className="mt-1" />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => patchShared({ activation: DEFAULT.activation, Cw: DEFAULT.Cw, Cb: DEFAULT.Cb, depth: DEFAULT.depth, width: DEFAULT.width, samples: DEFAULT.samples, seeds: DEFAULT.seeds, seed: DEFAULT.seed })}>
            reset to defaults
          </Button>
          <Button
            onClick={() => {
              if (!r) return;
              const trace = r.meanNtk.reduce((s, row, i) => s + row[i], 0);
              recordRun({
                id: 'ntk-lab',
                lab: 'ntk',
                summary: `${config.activation}, C_W=${config.Cw}, depth ${config.depth}, width ${config.width}, ${config.samples} inputs, ${config.seeds} seeds, seed ${config.seed}`,
                ranAt: new Date().toISOString(),
                setup: { ...setup },
                metrics: {
                  'trace(Θ)': Number(trace.toFixed(5)),
                  'symmetry defect': Number(r.symmetryDefect.toExponential(3)),
                  'min eigenvalue': Number(r.psd.minEigenvalue.toFixed(8)),
                  'is PSD': r.psd.isPsd ? 'yes' : 'no',
                  'closed-form rel. error': r.relativeError === null ? 'n/a' : Number(r.relativeError.toFixed(5)),
                },
              });
            }}
            disabled={analysis.status !== 'done'}
          >
            record run in dashboard
          </Button>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <SharedSetupPanel compact />
          <Panel title="Kernel and inputs">
            <div className="space-y-3">
              <Slider
                label="Depth (2 enables the closed form)"
                value={config.depth}
                min={1}
                max={4}
                integer
                onChange={(v) => setConfig((c) => ({ ...c, depth: v }))}
                hint="Local to this laboratory: the closed-form comparison of eq. (7.17) exists only for a two-layer network."
              />
              <Slider label="Inputs in the kernel matrix" value={config.samples} min={2} max={10} integer onChange={(v) => setConfig((c) => ({ ...c, samples: v }))} hint="Each input is a row of the NTK matrix; the cost grows as M²." />
              <Slider label="Input dimension" value={config.inputDim} min={1} max={8} integer onChange={(v) => setConfig((c) => ({ ...c, inputDim: v }))} />
            </div>
          </Panel>
          <Stat label="Parameters in the network" value={r ? r.parameters : '—'} hint="The NTK sums squared gradients over exactly these parameters." />
        </aside>

        <div className="space-y-5">
          {(analysis.error || scaling.error || drift.error) && <Warning>Computation failed: {analysis.error ?? scaling.error ?? drift.error}</Warning>}
          {analysis.status === 'running' && <Computing label="Assembling the kernel and its spectrum" />}

          {r && (
            <Results stale={analysis.stale}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Symmetry defect ‖Θ − Θᵀ‖∞" value={fmt(r.symmetryDefect, 3)} tone={r.symmetryDefect < 1e-9 ? 'good' : 'bad'} hint="A Gram matrix must be exactly symmetric." />
                <Stat
                  label="Smallest eigenvalue / λmax"
                  value={fmt(r.psd.relativeMin, 6)}
                  tone={r.psd.isPsd ? 'good' : 'bad'}
                  hint={r.psd.isPsd ? 'positive semidefinite within tolerance 1e-8' : 'not PSD: numerically impossible for a true Gram matrix'}
                />
                <Stat label="λmax" value={fmt(r.psd.maxEigenvalue, 5)} hint="Largest eigenvalue, i.e. the stiffest learning direction." />
                <Stat
                  label="Closed-form agreement"
                  value={r.relativeError === null ? 'n/a (depth > 2)' : `${(100 * r.relativeError).toFixed(1)}%`}
                  tone={r.relativeError === null ? 'default' : r.relativeError < 0.15 ? 'good' : 'warn'}
                  hint="Relative Frobenius error of the ensemble-averaged NTK against the derived two-layer formula."
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel
                  title="Empirical NTK (ensemble average)"
                  subtitle="Each entry is Σ_θ ∂f(xᵢ)/∂θ · ∂f(xⱼ)/∂θ, averaged over seeds."
                  right={
                    <DownloadCsv
                      filename="ntk-matrix.csv"
                      meta={{
                        activation: config.activation,
                        C_W: config.Cw,
                        C_b: config.Cb,
                        depth: config.depth,
                        width: config.width,
                        inputs: config.samples,
                        seeds: config.seeds,
                        seed: config.seed,
                      }}
                      header={['input', ...labels]}
                      rows={r.meanNtk.map((row, i) => [labels[i], ...row])}
                    />
                  }
                >
                  <Plot
                    height={360}
                    data={[heatmap(r.meanNtk, labels, labels, 'Blues', { hovertemplate: 'Θ(%{y},%{x}) = %{z:.4f}<extra></extra>' })]}
                    layout={{ margin: { l: 70, r: 20, t: 20, b: 60 } }}
                    caption="Diagonal-heavy structure means inputs are distinguished; large off-diagonals mean the network treats them similarly, which is what generalisation uses."
                  />
                </Panel>
                <Panel title={r.prediction ? 'Closed form minus measurement' : 'Per-seed spread'} subtitle={r.prediction ? 'If the formula is right this matrix is small compared with the NTK itself.' : 'Standard deviation of each NTK entry across seeds — deeper networks are not shown as a closed form because the app does not claim one.'}>
                  {r.prediction ? (
                    <Plot
                      height={360}
                      data={[heatmap(r.meanNtk.map((row, i) => row.map((v, j) => v - r.prediction![i][j])), labels, labels, 'RdBu', { zmid: 0 })]}
                      layout={{ margin: { l: 70, r: 20, t: 20, b: 60 } }}
                      caption={`Method: Θ_emp − Θ_theory for a two-layer network with C_W = ${config.Cw}, C_b = ${config.Cb}; relative Frobenius error ${(100 * (r.relativeError ?? 0)).toFixed(1)}%. The closed form is the ensemble average, so the residual is the O(1/√seeds) sampling error of the off-diagonal entries: it falls as you average over more networks, not as the width grows.`}
                    />
                  ) : (
                    <Plot
                      height={360}
                      data={[heatmap(r.sdNtk, labels, labels, 'Oranges')]}
                      layout={{ margin: { l: 70, r: 20, t: 20, b: 60 } }}
                      caption="The ensemble spread of the NTK. It grows with depth and shrinks with width; the frozen-NTK description is the infinite-width limit of this average."
                    />
                  )}
                </Panel>
              </div>

              <Panel title="Spectrum of the NTK" subtitle="Eigenvalues of the ensemble-averaged kernel: the effective learning rates of the output function.">
                <Plot
                  height={280}
                  data={[markers(r.eigenvalues.map((_, i) => i), r.eigenvalues, 'eigenvalue', COLORS.violet, { mode: 'lines+markers' })]}
                  layout={{ xaxis: { title: { text: 'index' } }, yaxis: { title: { text: 'λ' } }, showlegend: false }}
                  caption={`All eigenvalues must be ≥ 0; the smallest relative eigenvalue is ${fmt(r.psd.relativeMin, 6)}. A nearly singular NTK means some directions in function space are almost frozen.`}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Citation label={EQUATION_REFS.ntkDefinition.label} note={EQUATION_REFS.ntkDefinition.note} />
                  <Citation label={EQUATION_REFS.ntkRecursion.label} note={EQUATION_REFS.ntkRecursion.note} />
                  <Citation label={EQUATION_REFS.lrScaling.label} note={EQUATION_REFS.lrScaling.note} />
                </div>
              </Panel>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel
                  title="The Jacobian: what the NTK is built from"
                  subtitle={`∂f(x₁)/∂θ for every one of the ${r.parameters} parameters of the first instantiation.`}
                >
                  <Plot
                    height={300}
                    data={[
                      heatmap(
                        [r.gradientVector],
                        [''],
                        r.gradientVector.map((_, k) => String(k)),
                        'RdBu',
                        { zmid: 0, zmin: -r.jacobianScale, zmax: r.jacobianScale },
                      ),
                    ]}
                    layout={{
                      margin: { l: 40, r: 20, t: 10, b: 50 },
                      xaxis: { title: { text: 'parameter index' } },
                      yaxis: { title: { text: '' } },
                    }}
                    caption={`One row of the Jacobian: the parameter gradient of the output for the first input. The NTK entry Θ(xᵢ,xⱼ) is exactly the inner product of row i with row j, so the heatmap below is the Gram matrix of this picture. Largest magnitude ${fmt(r.jacobianScale, 4)}.`}
                  />
                </Panel>
                <Panel
                  title="Which layers carry the gradient"
                  subtitle="L2 norm of the parameter-gradient block of each layer, for the first input."
                >
                  <Plot
                    height={300}
                    data={[
                      markers(
                        r.layerGradientNorms.map((_, i) => i + 1),
                        r.layerGradientNorms,
                        '‖∂f/∂θ_(layer)‖',
                        COLORS.orange,
                        { mode: 'lines+markers' },
                      ),
                    ]}
                    layout={{
                      xaxis: { title: { text: 'layer ℓ' } },
                      yaxis: { title: { text: 'L2 norm' }, type: 'log' },
                      showlegend: false,
                    }}
                    caption="The parameter gradient is not spread evenly over the layers. This is the quantity the NTK sums the squares of, and it is why the book has to rescale the learning rate of each layer's weights by 1/n (eqs. (8.6)-(8.7))."
                  />
                </Panel>
              </div>

              <Panel
                title="Width scaling"
                subtitle="Theoretically the read-out term of the NTK is proportional to the hidden width — which is exactly why the book rescales weight learning rates by 1/n."
              >
                <Plot
                  height={320}
                  data={[
                    markers(scaling.result?.widths ?? [], scaling.result?.diagonal ?? [], 'measured Θ₁₁', COLORS.blue),
                    ...(scaling.result?.predictedDiagonal
                      ? [line(scaling.result.widths, scaling.result.predictedDiagonal, 'closed-form prediction', COLORS.orange, { line: { color: COLORS.orange, width: 2, dash: 'dash' } })]
                      : []),
                  ]}
                  layout={{ xaxis: { title: { text: 'hidden width n₁' }, type: 'log' }, yaxis: { title: { text: 'Θ(x₁,x₁)' }, type: 'log' } }}
                  caption="On log–log axes a straight line of slope 1 is linear growth. The dashed curve is the same closed form used above; both are computed, neither is fitted."
                />
                <Table
                  head={['width', 'trace Θ', 'Θ₁₁ measured', 'Θ₁₁ predicted', 'relative error of the full matrix']}
                  rows={(scaling.result?.widths ?? []).map((w, i) => [
                    w,
                    <span key="t" className="mono">{fmt(scaling.result!.trace[i], 4)}</span>,
                    <span key="d" className="mono">{fmt(scaling.result!.diagonal[i], 4)}</span>,
                    <span key="p" className="mono">{scaling.result!.predictedDiagonal ? fmt(scaling.result!.predictedDiagonal[i], 4) : '—'}</span>,
                    <span key="e" className="mono">{scaling.result!.relativeErrors[i] === undefined ? '—' : `${(100 * scaling.result!.relativeErrors[i]).toFixed(1)}%`}</span>,
                  ])}
                />
                <Callout tone="insight" title="Reading the table">
                  The relative error against the closed form falls as the width grows, and the disagreement at a fixed width
                  is the size of the 1/n correction. That is the empirical statement the theory makes: infinite width is an
                  approximation whose error you can measure.
                </Callout>
              </Panel>

              <Panel
                title="Defrosting: the NTK moves during training"
                subtitle="‖Θ(t) − Θ(0)‖_F / ‖Θ(0)‖_F on a fixed input set, recomputed from exact Jacobians at every snapshot."
              >
                <div className="grid gap-3 md:grid-cols-[240px_1fr]">
                  <div className="space-y-3">
                    <Slider label="Training steps" value={driftSteps} min={20} max={600} step={10} integer onChange={setDriftSteps} />
                    <Slider label="Learning rate" value={driftLr} min={0.005} max={0.3} step={0.005} onChange={setDriftLr} />
                    <p className="text-[11.5px] leading-snug text-lab-400">
                      Trained on 40 two-moons points with {config.samples} inputs in the tracked kernel matrix, using the same
                      analytic gradients as every other laboratory.
                    </p>
                  </div>
                  <Plot
                    height={320}
                    data={[
                      line(drift.result?.points.map((p) => p.step) ?? [], drift.result?.points.map((p) => p.relativeDrift) ?? [], `relative kernel drift (width ${config.width})`, COLORS.orange),
                      line(drift.result?.points.map((p) => p.step) ?? [], drift.result?.points.map((p) => p.loss) ?? [], 'training MSE (right axis shape)', COLORS.blue, { yaxis: 'y2', line: { color: COLORS.blue, width: 1.5, dash: 'dot' } }),
                    ]}
                    layout={{
                      xaxis: { title: { text: 'gradient step' } },
                      yaxis: { title: { text: 'relative NTK drift' } },
                      yaxis2: { title: { text: 'loss' }, overlaying: 'y', side: 'right', type: 'log', showgrid: false },
                    }}
                    caption="A frozen kernel would give a flat zero line. The measured drift is a finite-width effect and its size shrinks with width (see the table)."
                  />
                </div>
                <Table
                  head={['width', 'final relative drift', 'final loss', 'interpretation']}
                  rows={(drift.result?.widthComparisons ?? []).map((c) => [
                    c.width,
                    <span key="d" className="mono">{fmt(c.finalDrift, 4)}</span>,
                    <span key="l" className="mono">{fmt(c.finalLoss, 5)}</span>,
                    c.width < 16 ? 'narrow: the kernel moves a lot' : c.width < 64 ? 'intermediate' : 'wide: nearly frozen',
                  ])}
                />
                <div className="mt-3 space-y-1.5">
                  {(drift.result?.notes ?? []).map((n) => (
                    <p key={n} className="text-[12px] leading-relaxed text-lab-400">
                      · {n}
                    </p>
                  ))}
                </div>
              </Panel>

              <Panel title="What is measured, what is derived">
                <div className="grid gap-3 md:grid-cols-2 text-[12.5px] leading-relaxed text-lab-200">
                  <Callout tone="definition" title="Derived here, checked by test">
                    The two-layer closed form E[Θ] = C_W·K̇·(x·x′ + 1) + n₁·g(K⁽¹⁾) + 1 comes from differentiating the
                    network by hand; the app computes both sides and the test suite asserts they agree within the
                    finite-width error.
                  </Callout>
                  <Callout tone="limitation" title="Convention caveat, stated explicitly">
                    The frozen recursion of eqs. (9.5)-(9.7) uses the learning-rate normalization of eqs. (8.6)-(8.7). The
                    raw NTK assembled from eq. (7.17) carries an extra width factor, which the width-scaling panel measures.
                    Comparing the two without noting that factor is the most common way to misread this literature.
                  </Callout>
                </div>
                <Plot height={240} data={[histogram(r.meanNtk.map((row) => row.map((v) => v)).flat(), 'Θ entries', COLORS.green)]} layout={{ xaxis: { title: { text: 'NTK entry value' } }, yaxis: { title: { text: 'count' } }, showlegend: false }} caption="Distribution of the assembled NTK entries, including off-diagonal (generalisation) entries." />
              </Panel>
            </Results>
          )}
        </div>
      </div>
    </div>
  );
}
