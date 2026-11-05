import { useMemo, useState, useEffect } from 'react';
import { Panel, Slider, Select, Button, Stat, Table, Badge, Callout, Citation, Warning, Computing, Results } from '../../components/ui';
import { Plot, line, markers } from '../../components/Plot';
import { fmt } from '../../lib/theme';
import { useThemeColors } from '../../lib/useTheme';
import { useComputation } from '../../lib/hooks';
import { type ActivationId } from '../../lib/numerics/activations';
import { smoothRegression } from '../../lib/numerics/datasets';
import { buildObjective, evaluateSurface, numericalHessian2D, runTrajectory, type SliceKind } from '../../lib/numerics/objectives';
import { analyzeReadout } from '../../lib/numerics/objectives';
import { EQUATION_REFS } from '../../content/references';
import { useProgress } from '../../lib/persistence';
import { DownloadCsv } from '../../components/DownloadCsv';
import { applyPreset, usePreset } from '../../lib/presets';
import { PresetBanner } from '../../components/PresetBanner';
import { SharedSetupPanel } from '../../components/SharedSetupPanel';
import { LabLessons } from '../../components/LabLessons';
import { useSharedSetup } from '../../lib/sharedSetup';
import type { OptimizerId } from '../../lib/numerics/optimizers';
import { OPTIMIZERS } from '../../lib/numerics/optimizers';

const DEFAULT_SETTINGS = {
  kind: 'readout' as SliceKind,
  activation: 'tanh' as ActivationId,
  hidden: 8,
  Cw: 1,
  Cb: 0,
  seed: 11,
  learningRate: 0.35,
  steps: 60,
  mode: 'slice' as const,
  optimizer: 'gd' as OptimizerId,
  momentum: 0.9,
};

export function LandscapeLab() {
  const COLORS = useThemeColors();
  const { setup, patch: patchShared } = useSharedSetup();
  const [kind, setKind] = useState<SliceKind>(DEFAULT_SETTINGS.kind);
  const [activation, setActivation] = useState<ActivationId>(DEFAULT_SETTINGS.activation);
  const [hidden, setHidden] = useState(DEFAULT_SETTINGS.hidden);
  const [Cw, setCw] = useState(DEFAULT_SETTINGS.Cw);
  const [Cb, setCb] = useState(DEFAULT_SETTINGS.Cb);
  const [seed, setSeed] = useState(DEFAULT_SETTINGS.seed);
  const [learningRate, setLearningRate] = useState(DEFAULT_SETTINGS.learningRate);
  const [steps, setSteps] = useState(DEFAULT_SETTINGS.steps);
  const [mode, setMode] = useState<'slice' | 'full'>(DEFAULT_SETTINGS.mode);
  const [optimizer, setOptimizer] = useState<OptimizerId>(DEFAULT_SETTINGS.optimizer);
  const [show3d, setShow3d] = useState(false);
  const [momentum, setMomentum] = useState(DEFAULT_SETTINGS.momentum);
  const { recordRun } = useProgress();
  const preset = usePreset();

  // The activation, the initialization and the seed are shared with the other
  // laboratories; the slice and the optimizer are this laboratory's own.
  useEffect(() => {
    setActivation(setup.activation);
    setCw(setup.Cw);
    setCb(setup.Cb);
    setSeed(setup.seed);
  }, [setup]);

  useEffect(() => {
    if (!preset) return;
    const patch = applyPreset(DEFAULT_SETTINGS, preset.settings, [
      'learningRate',
      'steps',
      'hidden',
      'Cw',
      'Cb',
      'seed',
      'momentum',
    ]);
    const slice = preset.settings.sliceKind;
    if (slice === 'readout' || slice === 'hidden') setKind(slice);
    if (typeof patch.learningRate === 'number') setLearningRate(patch.learningRate);
    if (typeof patch.steps === 'number') setSteps(patch.steps);
    if (typeof patch.hidden === 'number') setHidden(patch.hidden);
    if (typeof patch.momentum === 'number') setMomentum(patch.momentum);
    if (typeof patch.Cw === 'number') patchShared({ Cw: patch.Cw });
    if (typeof patch.Cb === 'number') patchShared({ Cb: patch.Cb });
    if (typeof patch.seed === 'number') patchShared({ seed: patch.seed });
  }, [preset, patchShared]);

  const resetToDefaults = () => {
    setKind(DEFAULT_SETTINGS.kind);
    setActivation(DEFAULT_SETTINGS.activation);
    setHidden(DEFAULT_SETTINGS.hidden);
    setCw(DEFAULT_SETTINGS.Cw);
    setCb(DEFAULT_SETTINGS.Cb);
    setSeed(DEFAULT_SETTINGS.seed);
    setLearningRate(DEFAULT_SETTINGS.learningRate);
    setSteps(DEFAULT_SETTINGS.steps);
    setMode(DEFAULT_SETTINGS.mode);
    setOptimizer(DEFAULT_SETTINGS.optimizer);
    setMomentum(DEFAULT_SETTINGS.momentum);
  };
  const dataset = useMemo(() => smoothRegression(40, 2, 0.05, 7), []);

  const computed = useComputation(
    () => {
      const obj = buildObjective(dataset.X, dataset.Y, { kind, hidden, activationId: activation, Cw, Cb, seed, span: 3 });
      const surface = evaluateSurface(obj, 61);
      const traj = runTrajectory(obj, {
        learningRate,
        steps,
        mode,
        momentum: optimizer === 'momentum' ? momentum : 0,
        dataset: { X: dataset.X, Y: dataset.Y },
      });
      const start = traj.points[0];
      const hessian = numericalHessian2D(obj, start.a, start.b);
      const readout = obj.quadratic ? analyzeReadout(obj.quadratic.features, dataset.Y) : null;
      const readoutStart = obj.quadratic?.v0 ?? [];
      const comparison = (['gd', 'momentum'] as OptimizerId[]).map((opt) => ({
        optimizer: opt,
        run: runTrajectory(obj, {
          learningRate,
          steps,
          mode,
          momentum: opt === 'momentum' ? momentum : 0,
          dataset: { X: dataset.X, Y: dataset.Y },
        }),
      }));
      return { obj, surface, traj, hessian, readout, readoutStart, comparison };
    },
    { deps: [kind, activation, hidden, Cw, Cb, seed, learningRate, steps, mode, optimizer, momentum] },
  );

  const { result, status, error, elapsedMs, stale } = computed;
  const obj = result?.obj;

  return (
    <div className="space-y-5">
      {preset && <PresetBanner preset={preset} labLabel="Laboratory B · Optimization" />}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-lab-100">Laboratory B · Gradient descent and loss landscapes</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
            Two real two-parameter slices of a one-hidden-layer network trained on real data. The surface is the true loss
            evaluated on a grid; the trajectory is produced by the same analytic gradients the app uses everywhere, with an
            independent central-difference check of the Hessian.
          </p>
<LabLessons route="/labs/landscape" className="mt-1" />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={resetToDefaults}>
            reset to defaults
          </Button>
          <Button
            onClick={() => {
              if (!result) return;
              const first = result.traj.points[0];
              const last = result.traj.points[result.traj.points.length - 1];
              recordRun({
                id: 'landscape-lab',
                lab: 'landscape',
                summary: `${kind} slice, ${activation}, hidden ${hidden}, η=${learningRate}, ${steps} steps, seed ${seed}`,
                ranAt: new Date().toISOString(),
                setup: { ...setup },
                metrics: {
                  'start loss': Number(first.loss.toFixed(6)),
                  'final loss': Number(last.loss.toFixed(6)),
                  diverged: result.traj.diverged ? 'yes' : 'no',
                  'lr threshold': result.readout ? Number(result.readout.lrThreshold.toFixed(5)) : 'n/a',
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
          <Panel title="Objective">
            <div className="space-y-3">
              <Select
                label="Which two parameters move?"
                value={kind}
                options={[
                  { value: 'readout' as SliceKind, label: 'Read-out weights (convex, quadratic)' },
                  { value: 'hidden' as SliceKind, label: 'Two hidden weights (non-convex)' },
                ]}
                onChange={(v) => setKind(v)}
                hint="The read-out slice is exactly the kernel-regression problem of §10; the hidden slice is genuinely non-convex."
              />
              <Slider label="Hidden units" value={hidden} min={2} max={32} integer onChange={setHidden} />
            </div>
          </Panel>

          <Panel title="Optimization">
            <div className="space-y-3">
              <Select
                label="Optimizer"
                value={optimizer}
                options={(Object.keys(OPTIMIZERS) as OptimizerId[])
                  .filter((id) => id !== 'adam')
                  .map((id) => ({ value: id, label: OPTIMIZERS[id].label }))}
                onChange={setOptimizer}
              />
              {optimizer === 'momentum' && <Slider label="Momentum μ" value={momentum} min={0} max={0.95} step={0.05} onChange={setMomentum} />}
              <Slider
                label="Learning rate"
                tex="\eta"
                value={learningRate}
                min={0.005}
                max={2}
                step={0.005}
                onChange={setLearningRate}
                hint={
                  result?.readout
                    ? `Predicted stability threshold 2/λmax = ${fmt(result.readout.lrThreshold, 4)} (read-out slice)`
                    : undefined
                }
              />
              <Slider label="Steps" value={steps} min={1} max={500} integer onChange={setSteps} />
              <Select
                label="Update scope (read-out slice only)"
                value={mode}
                options={[
                  { value: 'slice' as const, label: 'Only the two displayed parameters' },
                  { value: 'full' as const, label: 'All read-out weights (path is a projection)' },
                ]}
                onChange={setMode}
              />
              {result?.readout && (
                <Button variant="ghost" onClick={() => setLearningRate(0.6 * result.readout!.lrThreshold)}>
                  set η to 0.6 × threshold ({fmt(0.6 * result.readout.lrThreshold, 3)})
                </Button>
              )}
            </div>
          </Panel>
        </aside>

        <div className="space-y-5">
          {error && <Warning>Computation failed: {error}</Warning>}
          {status === 'running' && <Computing label="Evaluating the loss surface and running the optimizer" />}

          {obj && result && (
            <Results stale={stale}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Start loss" value={fmt(result.traj.points[0].loss, 5)} hint={`at (${fmt(result.traj.points[0].a, 3)}, ${fmt(result.traj.points[0].b, 3)})`} />
                <Stat
                  label="Final loss"
                  value={fmt(result.traj.points[result.traj.points.length - 1].loss, 5)}
                  hint={`after ${steps} steps`}
                  tone={result.traj.diverged ? 'bad' : result.traj.points[result.traj.points.length - 1].loss < result.traj.points[0].loss ? 'good' : 'warn'}
                />
                <Stat
                  label="λmax of the read-out Hessian"
                  value={result.readout ? fmt(result.readout.hessianEigenvalues[0], 5) : '—'}
                  hint={result.readout ? `stability requires η < ${fmt(result.readout.lrThreshold, 4)}` : 'only defined for the read-out slice'}
                  tone={result.readout ? (learningRate < result.readout.lrThreshold ? 'good' : 'bad') : 'default'}
                />
                <Stat label="Runtime" value={`${Math.round(elapsedMs)} ms`} hint={`${61 * 61} loss evaluations for the surface`} />
              </div>

              <Panel
                title="Loss surface and trajectory"
                subtitle={
                  kind === 'readout'
                    ? 'Convex quadratic slice through the read-out weights; the trajectory is the exact gradient-descent path on the real loss.'
                    : 'Non-convex slice through two hidden weights; gradients come from the app\'s analytic backpropagation restricted to those parameters.'
                }
                right={<Button variant="ghost" onClick={() => setShow3d((s) => !s)}>{show3d ? 'show contours' : 'show 3D surface'}</Button>}
              >
                {show3d ? (
                  <Plot
                    height={460}
                    data={[
                      {
                        type: 'surface',
                        z: result.surface.values,
                        x: result.surface.a,
                        y: result.surface.b,
                        colorscale: 'Viridis',
                        showscale: false,
                        opacity: 0.95,
                      },
                      {
                        type: 'scatter3d',
                        mode: 'lines+markers',
                        x: result.traj.points.map((p) => p.a),
                        y: result.traj.points.map((p) => p.b),
                        z: result.traj.points.map((p) => p.loss),
                        line: { color: COLORS.orange, width: 5 },
                        marker: { color: COLORS.red, size: 3 },
                        name: 'gradient descent',
                      },
                    ]}
                    layout={{
                      scene: {
                        xaxis: { title: { text: obj.axisLabels[0] } },
                        yaxis: { title: { text: obj.axisLabels[1] } },
                        zaxis: { title: { text: 'loss' } },
                        bgcolor: 'rgba(0,0,0,0)',
                      },
                      margin: { l: 0, r: 0, t: 10, b: 0 },
                      height: 460,
                    }}
                    caption="A real 3-D rendering of the loss: no smoothing, every grid point is an evaluated forward pass."
                  />
                ) : (
                  <Plot
                    height={460}
                    data={[
                      {
                        type: 'contour',
                        z: result.surface.values,
                        x: result.surface.a,
                        y: result.surface.b,
                        colorscale: 'Viridis',
                        contours: { coloring: 'heatmap', showlabels: false },
                        colorbar: { title: { text: 'loss' }, tickfont: { size: 10 } },
                        ncontours: 30,
                        hovertemplate: '%{x:.3f}, %{y:.3f}<br>loss %{z:.4f}<extra></extra>',
                      },
                      markers(result.traj.points.map((p) => p.a), result.traj.points.map((p) => p.b), 'gradient descent', COLORS.orange, {
                        marker: { color: COLORS.orange, size: 5, line: { color: COLORS.red, width: 1 } },
                      }),
                      markers([result.traj.points[0].a], [result.traj.points[0].b], 'start', COLORS.green, {
                        marker: { color: COLORS.green, size: 11, symbol: 'x' },
                      }),
                    ]}
                    layout={{
                      xaxis: { title: { text: obj.axisLabels[0] } },
                      yaxis: { title: { text: obj.axisLabels[1] } },
                      hovermode: 'closest',
                    }}
                    caption="Contours of the true loss. The overlaid path is generated by the optimizer, not drawn by hand."
                  />
                )}
              </Panel>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel
                  title="Loss along the trajectory"
                  subtitle="Measured, from real objective evaluations at every step."
                  right={
                    <DownloadCsv
                      filename={`lab-b-${kind}-trajectory.csv`}
                      meta={{
                        objective: kind,
                        activation,
                        hidden,
                        learning_rate: learningRate,
                        steps,
                        optimizer,
                        seed,
                        diverged: result.traj.diverged ? 'yes' : 'no',
                      }}
                      header={['step', 'a', 'b', 'loss']}
                      rows={result.traj.points.map((p) => [p.step, Number(p.a.toFixed(6)), Number(p.b.toFixed(6)), Number(p.loss.toFixed(8))])}
                    />
                  }
                >
                  <Plot
                    height={300}
                    data={[
                      line(result.traj.points.map((p) => p.step), result.traj.points.map((p) => p.loss), `${optimizer} (measured)`, COLORS.green),
                      ...(result.readout && kind === 'readout' && mode === 'full'
                        ? [
                            line(
                              result.traj.points.map((p) => p.step),
                              result.traj.points.map((p) => result.readout!.lossPrediction(p.step, learningRate, result.readoutStart)),
                              'closed-form prediction',
                              COLORS.orange,
                              { line: { color: COLORS.orange, width: 1.5, dash: 'dash' } },
                            ),
                          ]
                        : []),
                    ]}
                    layout={{ xaxis: { title: { text: 'step' } }, yaxis: { title: { text: 'loss' }, type: 'log' } }}
                    caption={
                      result.readout && kind === 'readout' && mode === 'full'
                        ? 'The dashed curve is the closed-form quadratic prediction Σ_k (λ_k/2)(u_k·δ)²(1 − ηλ_k)^{2t}; the solid curve is what actually happened.'
                        : 'Run the read-out slice in "all read-out weights" mode to overlay the closed-form quadratic prediction.'
                    }
                  />
                  {result.traj.diverged && (
                    <Warning>
                      This run diverged at step {result.traj.points[result.traj.points.length - 1].step}. {result.readout ? `For this quadratic slice the threshold is η < ${fmt(result.readout.lrThreshold, 4)}.` : 'Reduce the learning rate.'}
                    </Warning>
                  )}
                </Panel>

                <Panel title="Optimizer comparison" subtitle="Same objective, same learning rate, same starting point.">
                  <Plot
                    height={300}
                    data={result.comparison.map((c, i) =>
                      line(
                        c.run.points.map((p) => p.step),
                        c.run.points.map((p) => p.loss),
                        `${OPTIMIZERS[c.optimizer].label}${c.run.diverged ? ' (diverged)' : ''}`,
                        [COLORS.blue, COLORS.violet][i % 2],
                      ),
                    )}
                    layout={{ xaxis: { title: { text: 'step' } }, yaxis: { title: { text: 'loss' }, type: 'log' } }}
                    caption="Momentum accelerates along the shallow direction and can also destabilise a step size that plain GD tolerates."
                  />
                  <Table
                    head={['optimizer', 'final loss', 'diverged']}
                    rows={result.comparison.map((c) => [
                      OPTIMIZERS[c.optimizer].label,
                      <span key="f" className="mono">{fmt(c.run.points[c.run.points.length - 1].loss, 6)}</span>,
                      c.run.diverged ? <Badge key="d" tone="bad">yes</Badge> : <Badge key="d" tone="good">no</Badge>,
                    ])}
                  />
                </Panel>
              </div>

              <Panel
                title="Local curvature"
                subtitle="Hessian of the objective at the starting point, by central finite differences of the real loss."
              >
                <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
                  <Table
                    head={['Entry', 'Value']}
                    rows={[
                      ['∂²L/∂a²', <span key="1" className="mono">{fmt(result.hessian[0][0], 5)}</span>],
                      ['∂²L/∂a∂b', <span key="2" className="mono">{fmt(result.hessian[0][1], 5)}</span>],
                      ['∂²L/∂b²', <span key="3" className="mono">{fmt(result.hessian[1][1], 5)}</span>],
                      [
                        'det H',
                        <span key="4" className="mono">{fmt(result.hessian[0][0] * result.hessian[1][1] - result.hessian[0][1] ** 2, 5)}</span>,
                      ],
                      [
                        'sign of curvature',
                        result.hessian[0][0] * result.hessian[1][1] - result.hessian[0][1] ** 2 > 0 ? (
                          <Badge key="5" tone="good">convex here (det &gt; 0)</Badge>
                        ) : (
                          <Badge key="5" tone="bad">saddle-like (det &lt; 0)</Badge>
                        ),
                      ],
                    ]}
                  />
                  <div className="space-y-2 text-[12.5px] leading-relaxed text-lab-200">
                    <p>
                      For the read-out slice the Hessian is the exact matrix <span className="mono">(2/M) ΦᵀΦ</span> of the frozen
                      features, so its eigenvalues decide convergence: gradient descent is stable iff{' '}
                      <span className="mono">
                        η &lt; 2/λmax = {result.readout ? fmt(result.readout.lrThreshold, 5) : '—'}
                      </span>
                      .
                    </p>
                    <p>
                      Full eigenvalue spectrum:{' '}
                      <span className="mono">
                        {result.readout ? result.readout.hessianEigenvalues.slice(0, 8).map((v) => fmt(v, 4)).join(', ') : '—'}
                        {result.readout && result.readout.hessianEigenvalues.length > 8 ? ', …' : ''}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Citation label={EQUATION_REFS.kernelLearning.label} note={EQUATION_REFS.kernelLearning.note} />
                      <Citation label="§7.2" note="gradient descent and function approximation" />
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel title="Honest reading of this laboratory">
                <div className="grid gap-3 md:grid-cols-2 text-[12.5px] leading-relaxed text-lab-200">
                  <Callout tone="insight" title="What it establishes">
                    For the read-out slice, the closed-form quadratic dynamics matches the measured loss curve mode by mode,
                    and the measured divergence threshold agrees with 2/λmax. For the hidden slice, the loss is genuinely
                    non-convex and the app reports local curvature rather than a global claim.
                  </Callout>
                  <Callout tone="limitation" title="What it does not establish">
                    A two-parameter picture cannot tell you how a real network&apos;s 10⁶ parameters arrange themselves, and the
                    dataset here has 40 points: differences between optimizers on this problem do not transfer to
                    large-scale training without further work.
                  </Callout>
                </div>
              </Panel>
            </Results>
          )}
        </div>
      </div>
    </div>
  );
}
