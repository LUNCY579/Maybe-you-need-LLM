import { useState, useEffect, useRef } from 'react';
import { Panel, Slider, Select, Stat, Table, Badge, Callout, Citation, Warning, Button } from '../../components/ui';
import { Plot, line, markers } from '../../components/Plot';
import { fmt } from '../../lib/theme';
import { useThemeColors } from '../../lib/useTheme';
import { type ActivationId } from '../../lib/numerics/activations';
import { CLASSIFICATION_DATASETS } from '../../lib/numerics/datasets';
import { OPTIMIZERS, type OptimizerId } from '../../lib/numerics/optimizers';
import { EQUATION_REFS } from '../../content/references';
import { useProgress } from '../../lib/persistence';
import { applyPreset, usePreset } from '../../lib/presets';
import { PresetBanner } from '../../components/PresetBanner';
import { usePausableGenerator } from '../../lib/hooks';
import { SharedSetupPanel } from '../../components/SharedSetupPanel';
import { LabLessons } from '../../components/LabLessons';
import { DownloadCsv } from '../../components/DownloadCsv';
import { useSharedSetup } from '../../lib/sharedSetup';
import {
  representationTraining,
  type RepresentationConfig,
  type RepresentationProgress,
  type RepresentationResult,
} from '../../lib/experiments/training';

const DEFAULT: RepresentationConfig = {
  datasetId: 'two-moons',
  activation: 'tanh',
  Cw: 1,
  Cb: 0,
  width: 32,
  depth: 2,
  steps: 300,
  /*
   * A small step, deliberately. The drift comparison is a statement about the
   * small-drift regime — the one the book's four-point suppression describes —
   * and at a large step the wide network overshoots and the ordering reverses.
   * The slider lets a reader see that regime for themselves.
   */
  learningRate: 0.01,
  seed: 31,
  n: 120,
};

export function RepresentationLab() {
  const COLORS = useThemeColors();
  const { setup, patch: patchShared } = useSharedSetup();
  const [config, setConfig] = useState<RepresentationConfig>(DEFAULT);
  const [snapshotIndex, setSnapshotIndex] = useState<number | null>(null);
  const { recordRun } = useProgress();
  const preset = usePreset();

  // The network shape, the activation, the initialization and the seed are
  // shared; the dataset, the step budget and the learning rate are local.
  useEffect(() => {
    setConfig((c) => ({
      ...c,
      activation: setup.activation,
      Cw: setup.Cw,
      Cb: setup.Cb,
      width: Math.min(128, Math.max(2, setup.width)),
      depth: Math.min(4, Math.max(1, setup.depth)),
      seed: setup.seed,
    }));
  }, [setup]);

  useEffect(() => {
    if (!preset) return;
    const patch = applyPreset(DEFAULT, preset.settings, [
      'activation',
      'Cw',
      'Cb',
      'width',
      'depth',
      'steps',
      'learningRate',
      'seed',
      'n',
    ]);
    patchShared({
      activation: (patch.activation ?? setup.activation) as ActivationId,
      Cw: patch.Cw ?? setup.Cw,
      Cb: patch.Cb ?? setup.Cb,
      width: patch.width ?? setup.width,
      depth: patch.depth ?? setup.depth,
      seed: patch.seed ?? (typeof preset.settings.seed === 'number' ? preset.settings.seed : setup.seed),
    });
    setConfig((c) => ({
      ...c,
      steps: patch.steps ?? c.steps,
      learningRate: patch.learningRate ?? c.learningRate,
      n: patch.n ?? c.n,
    }));
    const dataset = preset.settings.dataset;
    if (typeof dataset === 'string') setConfig((c) => ({ ...c, datasetId: dataset }));
  }, [preset, patchShared, setup]);

  const run = usePausableGenerator<RepresentationProgress>(() => representationTraining(config), [JSON.stringify(config)]);

  const progress = run.value;
  const result: RepresentationResult | null = progress
    ? {
        dataset: progress.dataset,
        snapshots: progress.snapshots,
        layers: progress.layers,
        widthDrift: progress.widthDrift,
        finalActivationStats: progress.finalActivationStats,
        notes: progress.notes,
      }
    : null;
  const error: string | null = null;
  const status = run.done ? 'done' : run.paused ? 'paused' : 'running';

  // Measured wall-clock for the run, not an estimate. The clock starts when the
  // generator is created and stops when the last snapshot arrives.
  const startedAt = useRef<number>(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    startedAt.current = performance.now();
    setElapsedMs(0);
  }, [JSON.stringify(config)]);
  useEffect(() => {
    if (run.done) setElapsedMs(performance.now() - startedAt.current);
  }, [run.done]);

  const snapshots = result?.snapshots ?? [];
  const idx = snapshotIndex === null ? snapshots.length - 1 : Math.min(snapshotIndex, snapshots.length - 1);
  const snapshot = snapshots[idx];
  const initial = snapshots[0];
  const dataset = result?.dataset;

  return (
    <div className="space-y-5">
      {preset && <PresetBanner preset={preset} labLabel="Laboratory E · Representation" />}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-lab-100">Laboratory E · Representation learning</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
            Train a small network on a synthetic classification task and measure what happens to its hidden representation:
            how far the features move, how well the classes separate, and how both depend on the width. Everything is
            computed from real forward and backward passes; the only approximation is the 2-D projection, which is labelled
            as such.
          </p>
<LabLessons route="/labs/representation" className="mt-1" />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setConfig(DEFAULT)}>
            reset to defaults
          </Button>
          <Button
            onClick={() => {
              if (!result) return;
              const last = result.snapshots[result.snapshots.length - 1];
              recordRun({
                id: 'representation-lab',
                lab: 'representation',
                summary: `${config.datasetId}, ${config.activation}, C_W=${config.Cw}, width ${config.width}, ${config.steps} steps, seed ${config.seed}`,
                ranAt: new Date().toISOString(),
                setup: { ...setup },
                metrics: {
                  'final loss': Number(last.loss.toFixed(6)),
                  'final accuracy': Number((100 * last.accuracy).toFixed(2)),
                  'feature drift': Number(last.drift.toFixed(5)),
                  Fisher_ratio: Number(last.fisher.toFixed(4)),
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
          <Panel title="Task and network">
            <div className="space-y-3">
              <Select
                label="Dataset"
                value={config.datasetId}
                options={CLASSIFICATION_DATASETS.map((d) => ({ value: d, label: d }))}
                onChange={(v) => setConfig((c) => ({ ...c, datasetId: v }))}
                hint="Synthetic data generated from a documented parametric construction with a seeded RNG."
              />
              <Slider label="Samples" value={config.n ?? 120} min={40} max={300} step={20} integer onChange={(v) => setConfig((c) => ({ ...c, n: v }))} />
            </div>
          </Panel>
          <Panel title="Training">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={run.paused ? run.resume : run.pause} disabled={run.done}>
                  {run.paused ? 'resume' : 'pause'}
                </Button>
                <Button variant="ghost" onClick={run.restart}>
                  restart
                </Button>
                <Badge tone={run.done ? 'good' : run.paused ? 'warn' : 'default'}>
                  {run.done ? 'finished' : run.paused ? 'paused' : `step ${progress?.step ?? 0} of ${config.steps}`}
                </Badge>
              </div>
              <Select
                label="Optimizer"
                value={config.optimizer ?? 'gd'}
                options={(Object.keys(OPTIMIZERS) as OptimizerId[]).map((id) => ({ value: id, label: OPTIMIZERS[id].label }))}
                onChange={(v) => setConfig((c) => ({ ...c, optimizer: v }))}
                hint={OPTIMIZERS[config.optimizer ?? 'gd'].note}
              />
              <Slider label="Steps" value={config.steps} min={20} max={1200} step={20} integer onChange={(v) => setConfig((c) => ({ ...c, steps: v }))} />
              <Slider label="Learning rate" tex="\eta" value={config.learningRate} min={0.005} max={0.5} step={0.005} onChange={(v) => setConfig((c) => ({ ...c, learningRate: v }))} />
            </div>
          </Panel>
          <Stat
            label="Run state"
            value={status === 'done' ? `${Math.round(elapsedMs)} ms` : status}
            hint="Measured wall-clock. The width comparison (three extra trainings) runs once the main run finishes."
          />
        </aside>

        <div className="space-y-5">
          {error && <Warning>Computation failed: {error}</Warning>}
          {status !== 'done' && (
            <Panel title="Training">
              <p className="text-[13px] text-lab-300">
                {status === 'paused'
                  ? 'Paused. The weights are exactly as they were at the last snapshot; you can inspect the representation below and then resume.'
                  : `Running gradient descent and taking snapshots… step ${progress?.step ?? 0} of ${config.steps}.`}
              </p>
            </Panel>
          )}

          {result && snapshot && dataset && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Loss" value={`${fmt(initial.loss, 4)} → ${fmt(snapshot.loss, 4)}`} hint="mean squared error against one-hot labels" tone={snapshot.loss < initial.loss ? 'good' : 'warn'} />
                <Stat label="Accuracy" value={`${(100 * initial.accuracy).toFixed(0)}% → ${(100 * snapshot.accuracy).toFixed(0)}%`} tone={snapshot.accuracy >= initial.accuracy ? 'good' : 'warn'} />
                <Stat
                  label="Fisher separation ratio"
                  value={`${fmt(initial.fisher, 3)} → ${fmt(snapshot.fisher, 3)}`}
                  hint="between-class / within-class scatter in the full hidden space"
                  tone={snapshot.fisher > initial.fisher ? 'good' : 'warn'}
                />
                <Stat
                  label="Feature drift"
                  value={fmt(snapshot.drift, 4)}
                  hint="‖h(t) − h(0)‖ / ‖h(0)‖, full hidden space"
                  tone={snapshot.drift < 0.05 ? 'warn' : 'good'}
                />
              </div>

              <Panel
                title="Hidden representation before and after training"
                subtitle="PCA projection of the first hidden layer onto its two largest-variance directions."
                right={
                  <div className="flex items-center gap-2">
                    <Badge tone="warn">PCA view: linear projection, variance directions only</Badge>
                    <Button variant="ghost" onClick={() => setSnapshotIndex(0)}>
                      step 0
                    </Button>
                    <Button variant="ghost" onClick={() => setSnapshotIndex(null)}>
                      final
                    </Button>
                  </div>
                }
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  {[0, idx].map((which, panelIndex) => {
                    const s = snapshots[which];
                    const classes = Array.from(new Set(dataset.labels)).sort((a, b) => a - b);
                    return (
                      <div key={which}>
                        <div className="mb-1 text-[12px] text-lab-300">
                          {panelIndex === 0 ? 'at initialization (step 0)' : `after ${s.step} gradient steps`} · variance explained by the two PCs:{' '}
                          <span className="mono">{(100 * s.pcaExplained).toFixed(1)}%</span>
                        </div>
                        <Plot
                          height={320}
                          data={classes.map((c, ci) => {
                            const pts = s.projection.filter((p) => p.label === c);
                            return markers(
                              pts.map((p) => p.x),
                              pts.map((p) => p.y),
                              `class ${c}`,
                              [COLORS.blue, COLORS.orange, COLORS.green, COLORS.violet][ci % 4],
                              { marker: { color: [COLORS.blue, COLORS.orange, COLORS.green, COLORS.violet][ci % 4], size: 6 } },
                            );
                          })}
                          layout={{ xaxis: { title: { text: 'PC 1' } }, yaxis: { title: { text: 'PC 2' } } }}
                          caption="The projection is a view, not the metric: class separation is reported as a Fisher ratio in the full hidden space above."
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3">
                  <label className="block text-[12px] text-lab-300">
                    Replay: snapshot index {idx + 1} of {snapshots.length} (step {snapshot.step})
                    <input
                      className="mt-1"
                      type="range"
                      min={0}
                      max={snapshots.length - 1}
                      value={idx}
                      onChange={(e) => setSnapshotIndex(Number(e.target.value))}
                    />
                  </label>
                  <p className="mt-1 text-[11.5px] text-lab-400">
                    Drag to replay the training run. Each frame is a real forward pass of the current weights — nothing is
                    interpolated.
                  </p>
                </div>
              </Panel>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Loss and separation during training" subtitle="Snapshot every few steps, all values measured.">
                  <Plot
                    height={320}
                    data={[
                      line(snapshots.map((s) => s.step), snapshots.map((s) => s.loss), 'loss', COLORS.blue),
                      line(snapshots.map((s) => s.step), snapshots.map((s) => s.fisher), 'Fisher ratio (right axis)', COLORS.green, { yaxis: 'y2' }),
                    ]}
                    layout={{
                      xaxis: { title: { text: 'gradient step' } },
                      yaxis: { title: { text: 'loss' }, type: 'log' },
                      yaxis2: { title: { text: 'Fisher ratio' }, overlaying: 'y', side: 'right', showgrid: false },
                    }}
                    caption="Both curves are diagnostics of the same run: the loss says how well the read-out fits, the Fisher ratio says how separated the hidden features are."
                  />
                </Panel>

                <Panel title="What the hidden layer is doing" subtitle="Per-layer mean square preactivation at the final snapshot.">
                  <Plot
                    height={320}
                    data={[markers(result.finalActivationStats.map((s) => s.layer), result.finalActivationStats.map((s) => s.meanSquare), 'mean square preactivation', COLORS.violet, { mode: 'lines+markers' })]}
                    layout={{ xaxis: { title: { text: 'layer' } }, yaxis: { title: { text: 'E[z²]' }, type: 'log' }, showlegend: false }}
                    caption="Because the read-out puts logits of both classes on a comparable scale, the output layer's magnitudes are not comparable with the hidden layers'; read the trend, not the levels."
                  />
                </Panel>
              </div>

              <Panel
                title="Width comparison: how much does the representation move?"
                subtitle="Same seed, same step count, same data; only the width changes. Three extra training runs."
                right={
                  <DownloadCsv
                    filename="representation-width-comparison.csv"
                    meta={{
                      dataset: config.datasetId,
                      activation: config.activation,
                      C_W: config.Cw,
                      C_b: config.Cb,
                      steps: config.steps,
                      learning_rate: config.learningRate,
                      seed: config.seed,
                    }}
                    header={['width', 'final drift', 'final Fisher ratio', 'final loss', 'accuracy']}
                    rows={result.widthDrift.map((w) => [w.width, w.finalDrift, w.finalFisher, w.finalLoss, w.accuracy])}
                  />
                }
              >
                <Plot
                  height={320}
                  data={[
                    markers(result.widthDrift.map((w) => w.width), result.widthDrift.map((w) => w.finalDrift), 'feature drift', COLORS.orange),
                    markers(result.widthDrift.map((w) => w.width), result.widthDrift.map((w) => w.finalFisher), 'Fisher ratio', COLORS.green, { yaxis: 'y2' }),
                  ]}
                  layout={{
                    xaxis: { title: { text: 'hidden width' }, type: 'log' },
                    yaxis: { title: { text: 'feature drift' } },
                    yaxis2: { title: { text: 'Fisher ratio' }, overlaying: 'y', side: 'right', showgrid: false },
                  }}
                  caption="At a small step size — the regime the book's four-point suppression describes — a wider network moves its representation less on the same budget, which is the qualitative content of the 'no representation learning at infinite width' theorem. Raise the learning rate and the wide network overshoots instead, and the ordering reverses: the trend is a property of the regime, not of the width alone."
                />
                <Table
                  head={['width', 'final drift', 'final Fisher', 'final loss', 'accuracy']}
                  rows={result.widthDrift.map((w) => [
                    w.width,
                    <span key="d" className="mono">{fmt(w.finalDrift, 4)}</span>,
                    <span key="f" className="mono">{fmt(w.finalFisher, 4)}</span>,
                    <span key="l" className="mono">{fmt(w.finalLoss, 5)}</span>,
                    <span key="a" className="mono">{(100 * w.accuracy).toFixed(0)}%</span>,
                  ])}
                />
                <div className="mt-3 space-y-1.5">
                  {result.notes.map((n) => (
                    <p key={n} className="text-[12px] leading-relaxed text-lab-400">
                      · {n}
                    </p>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Citation label={EQUATION_REFS.noRepLearning.label} note={EQUATION_REFS.noRepLearning.note} />
                  <Citation label={EQUATION_REFS.repLearning.label} note={EQUATION_REFS.repLearning.note} />
                  <Citation label={EQUATION_REFS.dntk.label} note={EQUATION_REFS.dntk.note} />
                </div>
              </Panel>

              <Panel title="Read this carefully">
                <div className="grid gap-3 md:grid-cols-2 text-[12.5px] leading-relaxed text-lab-200">
                  <Callout tone="insight" title="Measured here">
                    Features move, class separation improves, and both effects get smaller as the network widens. The drift
                    is measured in the full hidden space; the Fourier-style claim that it vanishes at infinite width is a
                    limiting statement the trend is consistent with.
                  </Callout>
                  <Callout tone="limitation" title="Not measured here">
                    No claim about optimal representation structure, no comparison against a kernel method at matched budget,
                    and no scaling law fit: with three widths and one task, a fitted exponent would be numerology. The
                    numbers are reported as they are.
                  </Callout>
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
