import { useMemo, useState, useEffect } from 'react';
import { Panel, Slider, Select, Button, Stat, Warning, Table, Badge, Callout, Computing, Results } from '../../components/ui';
import { Citation } from '../../components/ui';
import { Plot, line, histogram, markers, heatmap } from '../../components/Plot';
import { Tex } from '../../components/Math';
import { fmt } from '../../lib/theme';
import { useThemeColors } from '../../lib/useTheme';
import { useAsyncComputation } from '../../lib/hooks';
import { useProgress } from '../../lib/persistence';
import { applyPreset, usePreset } from '../../lib/presets';
import { PresetBanner } from '../../components/PresetBanner';
import { getActivation } from '../../lib/numerics/activations';
import { OPTIMIZERS, type OptimizerId } from '../../lib/numerics/optimizers';
import { type PhysicsConfig, type PhysicsResult } from '../../lib/experiments/kernels';
import type { ActivationId } from '../../lib/numerics/activations';
import { EQUATION_REFS } from '../../content/references';
import { Link } from 'react-router-dom';
import { SharedSetupPanel } from '../../components/SharedSetupPanel';
import { LabLessons } from '../../components/LabLessons';
import { DownloadCsv } from '../../components/DownloadCsv';
import { useSharedSetup } from '../../lib/sharedSetup';

const DEFAULT: PhysicsConfig = {
  activation: 'tanh',
  Cw: 1,
  Cb: 0,
  depth: 12,
  width: 64,
  samples: 48,
  seeds: 6,
  seed: 1,
  input: { distribution: 'gaussian', scale: 1, dim: 8 },
  initDistribution: 'gaussian',
  learningRate: 0.02,
  steps: 60,
};

export function PhysicsLab() {
  const COLORS = useThemeColors();
  const { setup, patch: patchShared } = useSharedSetup();
  const { recordRun } = useProgress();
  const act = getActivation(setup.activation);
  const preset = usePreset();

  // The shared parameters live in the shared setup; only the training controls
  // are local to this laboratory.
  const [local, setLocal] = useState({ learningRate: DEFAULT.learningRate, steps: DEFAULT.steps, optimizer: 'gd' as OptimizerId });
  const [config, setConfig] = useState<PhysicsConfig>(DEFAULT);

  // Rebuild the configuration whenever the shared setup changes.
  useEffect(() => {
    setConfig((c) => ({
      ...c,
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
    }));
  }, [setup]);

  // A gallery preset carries a complete settings vector; load it on arrival.
  useEffect(() => {
    if (!preset) return;
    const patch = applyPreset(DEFAULT, preset.settings, [
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
    setLocal((l) => ({
      ...l,
      learningRate: (preset.settings.learningRate as number | undefined) ?? l.learningRate,
      steps: (preset.settings.steps as number | undefined) ?? l.steps,
    }));
  }, [preset, patchShared, setup]);

  const { status, result, error, elapsedMs, offThread, stale, rerun } = useAsyncComputation<PhysicsResult>('physics', {
    ...config,
    learningRate: local.learningRate,
    steps: local.steps,
    optimizer: local.optimizer,
  });

  const warnings = useMemo(() => {
    const out: string[] = [];
    if (config.Cb > 0) out.push('C_b > 0: the kernel acquires a depth-independent additive floor; criticality in the strict sense requires C_b = 0 for most activations.');
    if (config.Cw <= 0) out.push('C_W must be positive: a zero weight variance makes every neuron in a layer identical.');
    if (config.Cw > 4) out.push('C_W > 4: the kernel will explode exponentially unless the activation saturates. Expect overflow within a few layers.');
    if (act.universality === 'none') out.push(`${act.label} cannot be tuned to criticality (see Lesson 7 and ${EQUATION_REFS.sigmoidFailure.label}). Whatever C_W you choose, the kernel either explodes, decays or plateaus.`);
    if (act.universality === 'half-stable') out.push(`${act.label} is a half-stable activation: its nontrivial fixed point is repulsive from one side, so expect either runaway growth or collapse.`);
    if (config.learningRate * config.steps > 40) out.push('Large learning rate × steps: the training trajectory may diverge; the lab records diverging runs rather than hiding them.');
    return out;
  }, [config, act]);

  const logRun = () => {
    if (!result) return;
    const terminal = result.layers[result.layers.length - 1];
    recordRun({
      id: 'physics-lab',
      lab: 'physics',
      summary: `${act.label}, C_W=${config.Cw}, C_b=${config.Cb}, depth ${config.depth}, width ${config.width}, ${config.seeds} seeds, seed ${config.seed}`,
      ranAt: new Date().toISOString(),
      setup: { ...setup },
      metrics: {
        'K^(1)': Number(result.layers[0].measured.toFixed(5)),
        'K^(L)': Number(terminal.measured.toFixed(5)),
        'spread at L': Number(terminal.spread.toFixed(5)),
        'critical C_W': result.criticalSelection ? Number(result.criticalSelection.Cw.toFixed(4)) : 'none',
        runtime_ms: Math.round(elapsedMs),
      },
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-lab-100">Neural network physics lab</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
            Build a fully connected network, choose how it is initialized, and watch the measured signal propagation,
            gradient signal and training loss. Every displayed statistic comes from real forward and backward passes of
            seeded networks; the theory curves come from the Chapter 5 recursions evaluated by quadrature.
          </p>
<LabLessons route="/labs/physics" className="mt-1" />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setConfig(DEFAULT)}>
            reset to defaults
          </Button>
          <Button onClick={logRun} disabled={status !== 'done'}>
            record run in dashboard
          </Button>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <SharedSetupPanel />

          <Panel title="Training (used for the loss panel)">
            <div className="space-y-3">
              <Select
                label="Optimizer"
                value={local.optimizer}
                options={(Object.keys(OPTIMIZERS) as OptimizerId[]).map((id) => ({ value: id, label: OPTIMIZERS[id].label }))}
                onChange={(v) => setLocal((l) => ({ ...l, optimizer: v }))}
                hint={OPTIMIZERS[local.optimizer].note}
              />
              <Slider label="Learning rate" tex="\eta" value={local.learningRate} min={0.0005} max={0.2} step={0.0005} onChange={(v) => setLocal((l) => ({ ...l, learningRate: v }))} />
              <Slider label="Gradient steps" value={local.steps} min={0} max={400} step={10} integer onChange={(v) => setLocal((l) => ({ ...l, steps: v }))} />
              {config.Cw > 0 && result?.expectedCw ? (
                <Button variant="ghost" onClick={() => patchShared({ Cw: result.expectedCw! })}>
                  jump to the critical C_W ({fmt(result.expectedCw, 4)})
                </Button>
              ) : null}
              <p className="text-[11.5px] leading-snug text-lab-400">
                Full-batch gradient descent on the target <Tex tex="y=\sin(1.5x_1)+0.5\cos(x_2)" />, which is provided by
                the lab so that the loss is meaningful.
              </p>
            </div>
          </Panel>

          <Button onClick={rerun} disabled={status === 'running'}>
            {status === 'running' ? 'computing…' : 'run again (new compute, same seed)'}
          </Button>
        </aside>

        <div className="space-y-5">
          {preset && <PresetBanner preset={preset} labLabel="Physics lab" />}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((w) => (
                <Warning key={w}>{w}</Warning>
              ))}
            </div>
          )}
          {error && <Warning>Computation failed: {error}</Warning>}

          {status === 'running' && <Computing label="Running forward and backward passes" />}

          {result && (
            <Results stale={stale}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="K^(1) → K^(L) measured"
                  value={`${fmt(result.layers[0].measured)} → ${fmt(result.layers[result.layers.length - 1].measured)}`}
                  hint={`ratio ${fmt(result.layers[result.layers.length - 1].measured / result.layers[0].measured)}`}
                  tone={
                    result.layers[result.layers.length - 1].measured / result.layers[0].measured > 2
                      ? 'bad'
                      : result.layers[result.layers.length - 1].measured / result.layers[0].measured < 0.5
                        ? 'warn'
                        : 'good'
                  }
                />
                <Stat
                  label="Critical C_W (scanner)"
                  value={result.criticalSelection ? fmt(result.criticalSelection.Cw, 4) : 'none'}
                  hint={result.criticalSelection ? `at K* = ${fmt(result.criticalSelection.Kstar)}` : 'no physical critical point'}
                  tone={result.criticalSelection ? 'good' : 'bad'}
                />
                <Stat
                  label="Susceptibilities at your C_W"
                  value={result.susceptibility ? `${fmt(result.susceptibility.parallel, 3)} / ${fmt(result.susceptibility.perpendicular, 3)}` : '—'}
                  hint="χ∥ / χ⊥ evaluated at the critical K*; both should be 1 there"
                  tone={
                    result.susceptibility &&
                    Math.abs(result.susceptibility.parallel - 1) < 0.02 &&
                    Math.abs(result.susceptibility.perpendicular - 1) < 0.02
                      ? 'good'
                      : 'warn'
                  }
                />
                <Stat
                  label="Runtime / parameters"
                  value={`${Math.round(elapsedMs)} ms`}
                  hint={`${config.seeds} networks × ${config.depth} layers; ${config.width} wide${offThread ? ' · measured off the main thread' : ''}`}
                />
              </div>

              <Panel
                title="Signal propagation through layers"
                subtitle="Measured layer kernel (mean ± seed spread) against the infinite-width recursion, both starting from the same measured K^(1)."
                right={<Badge tone="good">computed in {Math.round(elapsedMs)} ms</Badge>}
              >
                <Plot
                  height={340}
                  data={[
                    {
                      type: 'scatter',
                      mode: 'lines',
                      x: result.layers.map((l) => l.layer),
                      y: result.layers.map((l) => l.measured + l.spread),
                      name: 'measured + 1 sd',
                      line: { color: COLORS.blue, width: 0 },
                      showlegend: false,
                      hoverinfo: 'skip',
                    },
                    {
                      type: 'scatter',
                      mode: 'lines',
                      x: result.layers.map((l) => l.layer),
                      y: result.layers.map((l) => l.measured - l.spread),
                      name: 'measured − 1 sd',
                      line: { color: COLORS.blue, width: 0 },
                      fill: 'tonexty',
                      fillcolor: 'rgba(90,169,255,0.16)',
                      showlegend: false,
                      hoverinfo: 'skip',
                    },
                    line(result.layers.map((l) => l.layer), result.layers.map((l) => l.measured), 'measured mean', COLORS.blue),
                    line(result.layers.map((l) => l.layer), result.layers.map((l) => l.theory), 'infinite-width recursion (quadrature)', COLORS.orange, { line: { color: COLORS.orange, width: 2, dash: 'dot' } }),
                    ...(result.layers.some((l) => l.asymptote !== null)
                      ? [line(result.layers.map((l) => l.layer), result.layers.map((l) => l.asymptote ?? Number.NaN), 'asymptotic 1/((-a₁)ℓ)', COLORS.green, { line: { color: COLORS.green, width: 1.5, dash: 'dash' } })]
                      : []),
                  ]}
                  layout={{
                    xaxis: { title: { text: 'layer ℓ' } },
                    yaxis: { title: { text: 'K^(ℓ): mean squared preactivation' }, type: 'log' },
                  }}
                  caption={`Measured from ${config.seeds} seeded networks × ${config.samples} input samples; standard deviation is taken across seeds. Theory: eq. (5.1) iterated with Gauss-Hermite quadrature from the measured K^(1).`}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Citation label={EQUATION_REFS.kernelRecursion.label} note={EQUATION_REFS.kernelRecursion.note} />
                  <Citation label={EQUATION_REFS.criticality.label} note={EQUATION_REFS.criticality.note} />
                  {act.universality === 'K=0' && <Citation label={EQUATION_REFS.powerLaw.label} note={EQUATION_REFS.powerLaw.note} />}
                </div>
              </Panel>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel
                  title="Backpropagated gradient signal"
                  subtitle="RMS of ∂L/∂z^(ℓ) per layer: the quantity whose exponential decay is the vanishing-gradient problem."
                >
                  <Plot
                    height={300}
                    data={[
                      line(result.layers.map((l) => l.layer), result.layers.map((l) => l.gradRms), '∂L/∂z^(ℓ) RMS', COLORS.violet),
                    ]}
                    layout={{ yaxis: { title: { text: 'RMS gradient' }, type: 'log' }, xaxis: { title: { text: 'layer ℓ' } } }}
                    caption={`Measured after one backward pass on the fixed target, averaged over ${config.seeds} seeds. The per-layer factor is ≈ √(C_W·E[σ′²]) in RMS norm; the output layer holds a single unit.`}
                  />
                </Panel>

                <Panel title="Loss trajectory" subtitle="Full-batch gradient descent on the lab's fixed target function.">
                  {config.steps === 0 ? (
                    <p className="text-[12.5px] text-lab-400">Set gradient steps above zero to run training.</p>
                  ) : (
                    <Plot
                      height={300}
                      data={[line(result.training.map((t) => t.step), result.training.map((t) => t.loss), 'training MSE', COLORS.green)]}
                      layout={{ yaxis: { title: { text: 'MSE' }, type: 'log' }, xaxis: { title: { text: 'gradient step' } } }}
                      caption={
                        result.diverged
                          ? 'This run diverged (loss exceeded 1e10 or became non-finite) — the curve stops where it diverged. Try a smaller learning rate.'
                          : `η = ${config.learningRate}, ${config.steps} steps, ${config.samples} samples, seed ${config.seed * 131}.`
                      }
                    />
                  )}
                </Panel>
              </div>

              <Panel title="Forward pass: the preactivation matrix" subtitle={`Layer ${result.preactivationMatrix.layer} of the first network: rows are inputs, columns are neurons.`}>
                <Plot
                  height={300}
                  data={[
                    heatmap(
                      result.preactivationMatrix.rows.slice(0, 48),
                      result.preactivationMatrix.inputLabels.slice(0, 48),
                      result.preactivationMatrix.rows[0]?.map((_, k) => `n${k + 1}`) ?? [],
                      'RdBu',
                      { zmid: 0 },
                    ),
                  ]}
                  layout={{
                    margin: { l: 50, r: 14, t: 10, b: 45 },
                    xaxis: { title: { text: 'neuron' } },
                    yaxis: { title: { text: 'input' }, autorange: 'reversed' },
                    showlegend: false,
                  }}
                  caption={`Each entry is a preactivation z = Σ_j W_ij h_j + b_i, computed by a real forward pass. The mean square of this matrix is the layer kernel K^(ℓ) plotted above. The activation is σ applied entrywise, so a ReLU zeroes the negative half of this picture and a tanh saturates it.`}
                />
              </Panel>

              <div className="grid gap-5 lg:grid-cols-3">
                <Panel title="Preactivation distribution" subtitle={`Layer ${result.histogram.layer} of the first seed, all samples and neurons.`}>
                  <Plot height={260} data={[histogram(result.histogram.values, 'z', COLORS.blue)]} layout={{ yaxis: { title: { text: 'count' } }, xaxis: { title: { text: 'preactivation z' } }, bargap: 0.02, showlegend: false }} caption="Deviation from a normal shape is the non-Gaussianity the theory tracks with the four-point vertex." />
                </Panel>
                <Panel title="Weight distribution" subtitle={`Layer ${result.weightSample.layer} weights, first seed.`}>
                  <Plot height={260} data={[histogram(result.weights.length ? result.weights : result.weightSample.values, 'W', COLORS.orange)]} layout={{ yaxis: { title: { text: 'count' } }, xaxis: { title: { text: 'weight value' } }, bargap: 0.02, showlegend: false }} caption={`Drawn from ${config.initDistribution} with variance C_W/n_in = ${fmt(config.Cw / config.width, 5)}.`} />
                </Panel>
                <Panel title="Output scatter" subtitle="Network outputs on the input batch, first seed.">
                  <Plot
                    height={260}
                    data={[
                      markers(
                        result.layers.map((l) => l.layer),
                        result.layers.map((l) => l.measured),
                        'layer kernel',
                        COLORS.green,
                        { mode: 'lines+markers' },
                      ),
                    ]}
                    layout={{ yaxis: { title: { text: 'K^(ℓ)' }, type: 'log' }, xaxis: { title: { text: 'layer ℓ' } }, showlegend: false }}
                    caption="The same data as the main chart on a log axis: exponential growth or decay is a straight line here, which makes the critical case — a flat line — unmistakable."
                  />
                </Panel>
              </div>

              <Panel
                title="Layer-by-layer numbers"
                subtitle="Everything the charts above are drawn from."
                right={
                  <DownloadCsv
                    filename="physics-lab-kernel-profile.csv"
                    meta={{
                      activation: config.activation,
                      C_W: config.Cw,
                      C_b: config.Cb,
                      depth: config.depth,
                      width: config.width,
                      seeds: config.seeds,
                      samples: config.samples,
                      seed: config.seed,
                    }}
                    header={['layer', 'measured K^(l)', 'sd across seeds', 'theory K^(l)', 'asymptote', 'grad RMS']}
                    rows={result.layers.map((l) => [
                      l.layer,
                      l.measured,
                      l.spread,
                      l.theory,
                      l.asymptote ?? '',
                      l.gradRms,
                    ])}
                  />
                }
              >
                <Table
                  head={['ℓ', 'measured K^(ℓ)', 'sd across seeds', 'theory K^(ℓ)', 'asymptote', '∂L/∂z RMS']}
                  rows={result.layers.slice(0, 30).map((l) => [
                    l.layer,
                    <span key="m" className="mono">{fmt(l.measured, 5)}</span>,
                    <span key="s" className="mono">{fmt(l.spread, 5)}</span>,
                    <span key="t" className="mono">{fmt(l.theory, 5)}</span>,
                    <span key="a" className="mono">{l.asymptote === null ? '—' : fmt(l.asymptote, 5)}</span>,
                    <span key="g" className="mono">{fmt(l.gradRms, 4)}</span>,
                  ])}
                />
                {result.layers.length > 30 && <p className="mt-1 text-[11.5px] text-lab-400">Showing the first 30 of {result.layers.length} layers.</p>}
              </Panel>

              <Panel title="What to look for" subtitle="Reading the physics off the numbers.">
                <div className="grid gap-3 md:grid-cols-3 text-[12.5px] leading-relaxed text-lab-200">
                  <Callout tone="insight" title="Criticality">
                    Set C_W to the scanner&apos;s critical value and both susceptibilities become 1. The measured profile flattens:
                    plain exponential behaviour disappears. Any deviation you still see is a finite-width effect, and it grows
                    with the depth-to-width ratio.
                  </Callout>
                  <Callout tone="insight" title="K = 0 class">
                    For tanh and sin the critical profile is not flat but follows a 1/((-a₁)ℓ) power law. Both curves are
                    plotted; their difference is the O(1) offset the asymptotic formula drops.
                  </Callout>
                  <Callout tone="limitation" title="Scale of the simulation">
                    Widths here reach a few hundred. The book&apos;s large-width expansion is exact only in the limit; treat
                    measured-minus-theory differences as the size of the corrections, not as a failure of the theory.
                  </Callout>
                </div>
                <p className="mt-3 text-[12px] text-lab-400">
                  Follow-ups: <Link to="/labs/initialization">Lab A</Link> compares activations at fixed depth,{' '}
                  <Link to="/labs/width-depth">Lab C</Link> isolates the fluctuation law, and{' '}
                  <Link to="/lessons/universality">Lesson 7</Link> explains the classification shown by the scanner.
                </p>
              </Panel>
            </Results>
          )}
        </div>
      </div>
    </div>
  );
}
