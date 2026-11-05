import { useMemo, useState } from 'react';
import { Plot, line, markers } from '../Plot';
import { Panel, Slider, Select, Badge, Computing, Warning } from '../ui';
import { fmt, linspace } from '../../lib/theme';
import { useThemeColors } from '../../lib/useTheme';
import { useAsyncComputation } from '../../lib/hooks';
import { getActivation, ACTIVATION_IDS, type ActivationId } from '../../lib/numerics/activations';
import {
  chiParallel,
  chiPerp,
  findCriticalPoints,
  gOfK,
  kernelFlowDiagonal,
  powerLawPrediction,
  taylorA1,
} from '../../lib/numerics/gaussian';
import { gpDemoData, gpPosterior } from '../../lib/numerics/gp';
import type { NtkClosedFormComparison, RepresentationResult } from '../../lib/experiments/training';

/**
 * Live figures inside the lessons.
 *
 * A lesson that states "C_W = 1 is the critical point" and then sends the
 * reader to another screen to see it has lost half its argument. These figures
 * put the computation next to the sentence: the curves are produced by the same
 * quadrature and recursion code the laboratories use, so the picture and the
 * prose cannot disagree.
 */

/* ------------------------------------------------------------------ */
/* The kernel profile at a chosen C_W, against the critical point.      */
/* ------------------------------------------------------------------ */

export function CriticalityFigure() {
  const COLORS = useThemeColors();
  const [activation, setActivation] = useState<ActivationId>('tanh');
  const [Cw, setCw] = useState(1);
  const act = getActivation(activation);

  const critical = useMemo(() => {
    if (act.scaleInvariantA2) return 1 / act.scaleInvariantA2;
    const points = findCriticalPoints(act, { Kmax: 6, steps: 900 }).filter((p) => p.physical);
    return points.length ? points[points.length - 1].Cw : null;
  }, [act]);

  const depth = 24;
  const profile = useMemo(() => kernelFlowDiagonal(act, 1, Cw, 0, depth), [act, Cw]);
  const ratio = profile[depth - 1] / profile[0];
  const ratioAtCritical = useMemo(() => {
    if (critical === null) return null;
    const p = kernelFlowDiagonal(act, 1, critical, 0, depth);
    return p[depth - 1] / p[0];
  }, [act, critical, depth]);

  const susceptibilities = useMemo(() => {
    const K = profile[Math.floor(depth / 2)];
    return { parallel: chiParallel(act, K, Cw), perpendicular: chiPerp(act, K, Cw) };
  }, [act, Cw, profile]);

  return (
    <Panel
      title="The kernel profile at a chosen weight variance"
      subtitle="Computed by iterating the recursion of eq. (5.1) with Gauss-Hermite quadrature."
      right={critical !== null ? <Badge tone="good">critical C_W = {fmt(critical, 4)}</Badge> : <Badge tone="warn">no critical point</Badge>}
    >
      <div className="figure-layout grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="figure-controls space-y-3">
          <Select
            label="Activation"
            value={activation}
            options={ACTIVATION_IDS.map((id) => ({ value: id, label: getActivation(id).label }))}
            onChange={(v) => {
              setActivation(v);
              const a = getActivation(v);
              if (a.scaleInvariantA2) setCw(Math.round((1 / a.scaleInvariantA2) * 100) / 100);
            }}
          />
          <Slider
            label="Weight variance"
            tex="C_W"
            value={Cw}
            min={0.2}
            max={2.5}
            step={0.01}
            onChange={setCw}
            hint={critical !== null ? `Move the slider away from ${fmt(critical, 3)} and watch the curve tilt.` : undefined}
          />
          <div className="rounded border border-lab-700 bg-lab-850/50 p-2.5 text-[12px] leading-relaxed text-lab-200">
            <div>
              <span className="text-lab-400">K^(L) / K^(1): </span>
              <span className="mono text-lab-100">{fmt(ratio, 4)}</span>
            </div>
            {ratioAtCritical !== null && (
              <div>
                <span className="text-lab-400">at criticality: </span>
                <span className="mono text-lab-100">{fmt(ratioAtCritical, 4)}</span>
              </div>
            )}
            <div>
              <span className="text-lab-400">χ∥ / χ⊥: </span>
              <span className="mono text-lab-100">
                {fmt(susceptibilities.parallel, 3)} / {fmt(susceptibilities.perpendicular, 3)}
              </span>
            </div>
          </div>
        </div>
        <Plot
          height={280}
          data={[
            line(
              profile.map((_, i) => i + 1),
              profile,
              'kernel profile',
              COLORS.blue,
            ),
            ...(critical !== null
              ? [
                  line(
                    profile.map((_, i) => i + 1),
                    kernelFlowDiagonal(act, 1, critical, 0, depth),
                    'at the critical C_W',
                    COLORS.green,
                    { line: { color: COLORS.green, width: 2, dash: 'dot' } },
                  ),
                ]
              : []),
          ]}
          layout={{
            xaxis: { title: { text: 'layer ℓ' } },
            yaxis: { title: { text: 'K^(ℓ)' }, type: 'log' },
          }}
          caption={
            critical === null
              ? `${act.label} cannot be tuned to criticality: the curve always tilts.`
              : `A flat curve is the critical point. Above it the signal explodes; below it the signal dies. The dotted curve is the same computation at C_W = ${fmt(critical, 3)}.`
          }
        />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* The deep linear recursion: G^(l) = C_W^l G^(0).                      */
/* ------------------------------------------------------------------ */

export function LinearProfileFigure() {
  const COLORS = useThemeColors();
  const [Cw, setCw] = useState(1);
  const [depth, setDepth] = useState(20);
  const layers = linspace(0, depth, depth + 1);
  const profile = layers.map((l) => Math.pow(Cw, l));
  const ratio = Math.pow(Cw, depth);

  return (
    <Panel
      title="The deep linear recursion"
      subtitle="G^(ℓ) = C_W^ℓ G^(0), exactly, for any width (book eq. (3.15))."
      right={<Badge tone="good">exact</Badge>}
    >
      <div className="figure-layout grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="figure-controls space-y-3">
          <Slider label="Weight variance" tex="C_W" value={Cw} min={0.5} max={1.5} step={0.01} onChange={setCw} />
          <Slider label="Depth" value={depth} min={4} max={40} integer onChange={setDepth} />
          <div className="rounded border border-lab-700 bg-lab-850/50 p-2.5 text-[12px] leading-relaxed text-lab-200">
            <div>
              <span className="text-lab-400">G^(L)/G^(0) = C_W^L: </span>
              <span className="mono text-lab-100">{fmt(ratio, 4)}</span>
            </div>
            <div className="mt-1 text-lab-400">
              {Cw > 1 ? 'Above 1 the covariance blows up; below 1 it decays to a trivial fixed point. Exactly 1 preserves it.'
                : Cw < 1 ? 'Above 1 the covariance blows up; below 1 it decays to a trivial fixed point. Exactly 1 preserves it.'
                : 'Above 1 the covariance blows up; below 1 it decays to a trivial fixed point. Exactly 1 preserves it.'}
            </div>
          </div>
        </div>
        <Plot
          height={280}
          data={[line(layers, profile, 'G^(ℓ) / G^(0)', COLORS.blue)]}
          layout={{
            xaxis: { title: { text: 'layer ℓ' } },
            yaxis: { title: { text: 'G^(ℓ) / G^(0)' }, type: 'log' },
          }}
          caption="The critical linear network is the flat line: the covariance of the inputs is preserved through every layer, at every width."
        />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* The K = 0 class: a power law instead of an exponential.              */
/* ------------------------------------------------------------------ */

export function PowerLawFigure() {
  const COLORS = useThemeColors();
  const [activation, setActivation] = useState<ActivationId>('tanh');
  const act = getActivation(activation);
  const a1 = useMemo(() => taylorA1(act), [act]);
  const depth = 200;
  const layers = linspace(1, depth, depth);
  const exact = useMemo(() => kernelFlowDiagonal(act, 1, 1 / Math.max(1e-6, act.gamma1 ?? 1) ** 2, 0, depth), [act]);
  const asymptote = useMemo(() => powerLawPrediction(a1, 1, depth), [act, a1]);

  return (
    <Panel
      title="The K = 0 class decays by a power law"
      subtitle="The exact recursion against the asymptotic law 1/((−a₁)(ℓ−1) + 1/K^(1)) of eq. (5.92)."
      right={<Badge tone="good">a₁ = {fmt(a1, 3)}</Badge>}
    >
      <div className="figure-layout grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="figure-controls space-y-3">
          <Select
            label="Activation"
            value={activation}
            options={[
              { value: 'tanh' as ActivationId, label: 'tanh' },
              { value: 'sin' as ActivationId, label: 'sin' },
            ]}
            onChange={(v) => setActivation(v)}
            hint="Both are in the K = 0 class, so the exponent is the same and the coefficient is not."
          />
          <div className="rounded border border-lab-700 bg-lab-850/50 p-2.5 text-[12px] leading-relaxed text-lab-200">
            <div>
              <span className="text-lab-400">asymptote at ℓ = {depth}: </span>
              <span className="mono text-lab-100">{fmt(asymptote, 6)}</span>
            </div>
            <div>
              <span className="text-lab-400">exact recursion: </span>
              <span className="mono text-lab-100">{fmt(exact[depth - 1], 6)}</span>
            </div>
            <div className="mt-1 text-lab-400">
              The exponent 1 is universal; the coefficient 1/(−a₁) is not.
            </div>
          </div>
        </div>
        <Plot
          height={280}
          data={[
            line(layers, exact, 'exact recursion', COLORS.blue),
            line(layers, layers.map((l) => powerLawPrediction(a1, 1, l)), 'asymptotic law', COLORS.orange, {
              line: { color: COLORS.orange, width: 2, dash: 'dot' },
            }),
          ]}
          layout={{
            xaxis: { title: { text: 'layer ℓ' } },
            yaxis: { title: { text: 'K^(ℓ)' }, type: 'log' },
          }}
          caption="A power law, not an exponential: the signal fades slowly enough to still be trainable at hundreds of layers. The gap between the curves is the O(K³) correction the asymptotic form drops."
        />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* The fluctuation law: the depth-to-width ratio.                       */
/* ------------------------------------------------------------------ */

export function FluctuationFigure() {
  const COLORS = useThemeColors();
  const [depth, setDepth] = useState(20);
  const [width, setWidth] = useState(64);
  const G2 = 1;
  const layers = linspace(1, depth, depth);
  const variance = layers.map((l) => (2 * l * G2 * G2) / width);
  const sd = layers.map((l) => Math.sqrt(variance[l - 1]));

  return (
    <Panel
      title="The fluctuation law"
      subtitle="Var[O^(ℓ)] = 2ℓ(G^(2))²/n at criticality (book eq. (3.33))."
      right={<Badge tone="good">ℓ/n = {fmt(depth / width, 4)}</Badge>}
    >
      <div className="figure-layout grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="figure-controls space-y-3">
          <Slider label="Depth" value={depth} min={2} max={60} integer onChange={setDepth} />
          <Slider label="Width" value={width} min={8} max={512} step={8} integer onChange={setWidth} />
          <div className="rounded border border-lab-700 bg-lab-850/50 p-2.5 text-[12px] leading-relaxed text-lab-200">
            <div>
              <span className="text-lab-400">Var at ℓ = {depth}: </span>
              <span className="mono text-lab-100">{fmt(variance[depth - 1], 5)}</span>
            </div>
            <div>
              <span className="text-lab-400">sd: </span>
              <span className="mono text-lab-100">{fmt(sd[depth - 1], 4)}</span>
            </div>
            <div className="mt-1 text-lab-400">
              The variance grows with depth and shrinks with width: only the ratio ℓ/n matters.
            </div>
          </div>
        </div>
        <Plot
          height={280}
          data={[
            line(layers, variance, 'Var[O^(ℓ)]', COLORS.blue),
            markers(layers, sd, 'sd', COLORS.green),
          ]}
          layout={{
            xaxis: { title: { text: 'layer ℓ' } },
            yaxis: { title: { text: 'variance / sd' }, type: 'log' },
          }}
          caption="The leading finite-width correction, for a critical deep linear network. It is the reason the effective theory has a cutoff: the corrections grow with ℓ/n."
        />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* The criticality condition itself, as a curve.                       */
/* ------------------------------------------------------------------ */

export function SusceptibilityFigure() {
  const COLORS = useThemeColors();
  const [activation, setActivation] = useState<ActivationId>('tanh');
  const act = getActivation(activation);
  const Ks = linspace(1e-3, 4, 220);
  const parallel = Ks.map((K) => chiParallel(act, K, 1));
  const perpendicular = Ks.map((K) => chiPerp(act, K, 1));

  return (
    <Panel
      title="The two susceptibilities"
      subtitle="χ∥ = C_W g′(K) and χ⊥ = C_W E[σ′²], at C_W = 1, as functions of the kernel."
      right={<Badge tone="good">criticality needs both = 1</Badge>}
    >
      <div className="figure-layout grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="figure-controls space-y-3">
          <Select
            label="Activation"
            value={activation}
            options={ACTIVATION_IDS.map((id) => ({ value: id, label: getActivation(id).label }))}
            onChange={(v) => setActivation(v)}
          />
          <div className="rounded border border-lab-700 bg-lab-850/50 p-2.5 text-[12px] leading-relaxed text-lab-200">
            <div className="text-lab-400">
              Criticality asks for both susceptibilities to be exactly 1 at the fixed point. For {act.label} the two
              curves meet there only if it has a nontrivial fixed point at all.
            </div>
          </div>
        </div>
        <Plot
          height={280}
          data={[
            line(Ks, parallel, 'χ∥', COLORS.blue),
            line(Ks, perpendicular, 'χ⊥', COLORS.orange),
            line([0, 4], [1, 1], 'criticality = 1', COLORS.green, { line: { color: COLORS.green, width: 1.5, dash: 'dot' } }),
          ]}
          layout={{
            xaxis: { title: { text: 'K' } },
            yaxis: { title: { text: 'susceptibility' } },
          }}
          caption="Where the two curves cross the line χ = 1 at the same K, the activation can be tuned to criticality. Where they do not, it cannot — and no choice of C_W will help."
        />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* The connected four-point correlator: the size of the non-Gaussianity. */
/* ------------------------------------------------------------------ */

export function NonGaussianityFigure() {
  const COLORS = useThemeColors();
  const [depth, setDepth] = useState(20);
  const [widths, setWidths] = useState<number[]>([32, 128, 512]);
  const G2 = 1;
  const layers = linspace(1, depth, depth);

  return (
    <Panel
      title="The connected four-point correlator"
      subtitle="G^(4) − (G^(2))² = 2(ℓ−1)(G^(2))²/n at criticality (book eq. (3.28))."
      right={<Badge tone="good">the size of the non-Gaussianity</Badge>}
    >
      <div className="figure-layout grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="figure-controls space-y-3">
          <Slider label="Depth" value={depth} min={2} max={60} integer onChange={setDepth} />
          <div className="space-y-1">
            <div className="text-[12px] text-lab-300">Widths to compare</div>
            {widths.map((w, i) => (
              <Slider
                key={i}
                label={`width ${i + 1}`}
                value={w}
                min={8}
                max={1024}
                step={8}
                integer
                onChange={(v) => setWidths((prev) => prev.map((old, j) => (j === i ? v : old)))}
              />
            ))}
          </div>
          <div className="rounded border border-lab-700 bg-lab-850/50 p-2.5 text-[12px] leading-relaxed text-lab-200">
            <div className="text-lab-400">
              The deviation from Gaussianity grows with depth and shrinks with width. Only the ratio ℓ/n matters, so the
              curves for different depths lie on top of each other when plotted against ℓ/n.
            </div>
          </div>
        </div>
        <Plot
          height={280}
          data={widths.map((w, i) =>
            line(
              layers,
              layers.map((l) => (2 * (l - 1) * G2 * G2) / w),
              `width ${w}`,
              [COLORS.blue, COLORS.orange, COLORS.green][i % 3],
            ),
          )}
          layout={{
            xaxis: { title: { text: 'layer ℓ' } },
            yaxis: { title: { text: 'connected four-point correlator' }, type: 'log' },
          }}
          caption="This is the excess of the fourth moment over the Gaussian prediction. It is the cumulant that measures interaction between neurons, and it is what the effective theory expands in."
        />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* The two-layer NTK: the closed form against the measured kernel.      */
/* ------------------------------------------------------------------ */

export function NtkClosedFormFigure() {
  const COLORS = useThemeColors();
  const [width, setWidth] = useState(128);
  const [seeds, setSeeds] = useState(8);

  /*
   * This comparison builds a network per seed and assembles its kernel from
   * Jacobians, so it is a measurement rather than a drawing. It runs in the
   * worker: a reader who opens the lesson can read it while the measurement is
   * being made, instead of waiting half a second for the page to come back.
   */
  const { status, result, error } = useAsyncComputation<NtkClosedFormComparison>('ntk-closed-form', {
    width,
    seeds,
  });
  const comparison = result;
  const indices = comparison?.X.map((_, i) => i + 1) ?? [];
  const closedRow = comparison?.closed[0] ?? [];
  const measuredRow = comparison?.measured[0] ?? [];
  const relativeError = comparison?.relativeError ?? 0;

  return (
    <Panel
      title="The two-layer NTK: closed form against measurement"
      subtitle="Θ(x, x′) = C_W·K̇·(x·x′ + 1) + n₁·g + 1, derived from the definition of eq. (7.17)."
      right={<Badge tone="good">relative error {fmt(relativeError, 3)}</Badge>}
    >
      <div className="figure-layout grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="figure-controls space-y-3">
          <Slider label="Hidden width" value={width} min={8} max={512} step={8} integer onChange={setWidth} />
          <Slider label="Networks averaged" value={seeds} min={1} max={48} integer onChange={setSeeds} />
          <div className="rounded border border-lab-700 bg-lab-850/50 p-2.5 text-[12px] leading-relaxed text-lab-200">
            <div className="text-lab-400">
              The upper curve is the closed form, evaluated by quadrature. The lower curve is the empirical kernel
              assembled from exact Jacobians and averaged over {seeds} seeded network{seeds === 1 ? '' : 's'}. They
              agree to within the finite-width correction, which shrinks as the width grows.
            </div>
          </div>
        </div>
        <Plot
          height={280}
          data={[
            line(indices, closedRow, 'closed form', COLORS.blue),
            markers(indices, measuredRow, 'measured', COLORS.orange),
          ]}
          layout={{
            xaxis: { title: { text: 'input j (against input 1)' } },
            yaxis: { title: { text: 'Θ(x₁, xⱼ)' } },
          }}
          caption="A row of the kernel matrix. The closed form is exact in the infinite-width limit; the measured curve is a finite-width sample of it."
        />
        {status === 'running' && <Computing label="Assembling the kernel from Jacobians" />}
        {error && <Warning>Measurement failed: {error}</Warning>}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Feature drift: the representation moves less as the network widens.   */
/* ------------------------------------------------------------------ */

export function FeatureDriftFigure() {
  const COLORS = useThemeColors();
  const [steps, setSteps] = useState(120);
  /*
   * The step size matters, and the figure says so.
   *
   * The book's prediction — that the representation moves less as the network
   * widens — belongs to the regime where the drift is small, because that is
   * the regime the four-point vertices are suppressed in. At a large step size
   * the wide network overshoots, moves further, and the ordering reverses.
   * The default is a small step, where the prediction holds; the slider lets a
   * reader see the other regime for themselves.
   */
  const [learningRate, setLearningRate] = useState(0.01);

  /*
   * Three real trainings. The heaviest figure in the course, and the one that
   * most needed the worker: done on the main thread it froze the lesson for
   * nearly two seconds.
   */
  const { status, result, error } = useAsyncComputation<RepresentationResult>('representation', {
    datasetId: 'two-moons',
    activation: 'tanh',
    Cw: 1,
    Cb: 0,
    width: 32,
    depth: 2,
    steps,
    learningRate,
    seed: 31,
    n: 80,
  });
  const drift = result?.widthDrift ?? [];

  return (
    <Panel
      title="How far the representation moves, and how the width changes it"
      subtitle="‖h(t) − h(0)‖ / ‖h(0)‖ after training, on the two-moons task, for three widths."
      right={<Badge tone="good">{steps} gradient steps</Badge>}
    >
      <div className="figure-layout grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="figure-controls space-y-3">
          <Slider label="Gradient steps" value={steps} min={20} max={400} step={20} integer onChange={setSteps} />
          <Slider
            label="Learning rate"
            tex="\eta"
            value={learningRate}
            min={0.002}
            max={0.2}
            step={0.002}
            onChange={setLearningRate}
          />
          <div className="rounded border border-lab-700 bg-lab-850/50 p-2.5 text-[12px] leading-relaxed text-lab-200">
            <div>
              <span className="text-lab-400">drift at width 8: </span>
              <span className="mono text-lab-100">{fmt(drift[0]?.finalDrift ?? 0, 4)}</span>
            </div>
            <div>
              <span className="text-lab-400">at width 32: </span>
              <span className="mono text-lab-100">{fmt(drift[1]?.finalDrift ?? 0, 4)}</span>
            </div>
            <div>
              <span className="text-lab-400">at width 128: </span>
              <span className="mono text-lab-100">{fmt(drift[2]?.finalDrift ?? 0, 4)}</span>
            </div>
            <div className="mt-1 text-lab-400">
              At a small step size the narrower network moves its representation further in the same number of steps: the
              finite-width route to representation learning, and the reason the infinite-width limit has none. Raise the
              learning rate and the wide network overshoots instead, and the ordering reverses — the prediction belongs to
              the small-drift regime.
            </div>
          </div>
        </div>
        <Plot
          height={280}
          data={[
            markers(
              drift.map((w) => w.width),
              drift.map((w) => w.finalDrift),
              'feature drift',
              COLORS.blue,
            ),
            markers(
              drift.map((w) => w.width),
              drift.map((w) => w.finalFisher),
              'Fisher ratio',
              COLORS.green,
            ),
          ]}
          layout={{
            xaxis: { title: { text: 'hidden width' }, type: 'log' },
            yaxis: { title: { text: 'drift / Fisher ratio' }, type: 'log' },
          }}
          caption="Three real trainings on the same data, the same seed and the same number of steps; only the width changes. Measured, not modelled."
        />
        {status === 'running' && <Computing label="Training three networks" />}
        {error && <Warning>Measurement failed: {error}</Warning>}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* The Gaussian-process limit: the posterior of the infinite-width model. */
/* ------------------------------------------------------------------ */

export function GpPosteriorFigure() {
  const COLORS = useThemeColors();
  const [lengthScale, setLengthScale] = useState(0.5);
  const [noise, setNoise] = useState(0.05);

  const { data, posterior, queries } = useMemo(() => {
    const d = gpDemoData(9, 0.15, 3);
    const q = Array.from({ length: 160 }, (_, i) => [-1.6 + (3.2 * i) / 159]);
    const p = gpPosterior(d.X, d.y, q, {
      lengthScale,
      signalVariance: 1,
      noiseVariance: Math.max(1e-4, noise),
    });
    return { data: d, posterior: p, queries: q };
  }, [lengthScale, noise]);

  const upper = posterior.mean.map((m, i) => m + 2 * posterior.sd[i]);
  const lower = posterior.mean.map((m, i) => m - 2 * posterior.sd[i]);
  const xs = queries.map((q) => q[0]);

  return (
    <Panel
      title="The infinite-width limit is a Gaussian process"
      subtitle="The posterior of the zero-mean GP with a squared-exponential kernel, conditioned on the data."
      right={<Badge tone="good">closed form</Badge>}
    >
      <div className="figure-layout grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="figure-controls space-y-3">
          <Slider label="Length scale" tex="\ell" value={lengthScale} min={0.1} max={1.2} step={0.05} onChange={setLengthScale} />
          <Slider label="Noise" tex="\sigma_n^2" value={noise} min={0.005} max={0.5} step={0.005} onChange={setNoise} />
          <div className="rounded border border-lab-700 bg-lab-850/50 p-2.5 text-[12px] leading-relaxed text-lab-200">
            <div className="text-lab-400">
              This is the posterior the <em>infinite-width</em> theory predicts. The band is ±2 posterior standard
              deviations. It is exactly the kernel regression of §10.4 — and it has no representation to learn, because
              the kernel does not move.
            </div>
          </div>
        </div>
        <Plot
          height={300}
          data={[
            line(xs, upper, 'posterior + 2 sd', COLORS.blue, { line: { color: COLORS.blue, width: 1, dash: 'dot' } }),
            line(xs, lower, 'posterior − 2 sd', COLORS.blue, { line: { color: COLORS.blue, width: 1, dash: 'dot' }, fill: 'tonexty', fillcolor: 'rgba(90,169,255,0.14)' }),
            line(xs, posterior.mean, 'posterior mean', COLORS.orange),
            markers(
              data.X.map((x) => x[0]),
              data.y,
              'data',
              COLORS.green,
            ),
          ]}
          layout={{
            xaxis: { title: { text: 'x' } },
            yaxis: { title: { text: 'f(x)' } },
          }}
          caption="Solved by inverting the kernel matrix, not by training anything. A short length scale makes the posterior follow the data; a long one makes it smooth. The data points are generated, not stored."
        />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* The helper function g(K).                                            */
/* ------------------------------------------------------------------ */

export function HelperFunctionFigure() {
  const COLORS = useThemeColors();
  const [activation, setActivation] = useState<ActivationId>('tanh');
  const act = getActivation(activation);
  const Ks = linspace(0, 4, 200);
  const g = Ks.map((K) => gOfK(act, K));
  const linear = Ks.map((K) => K);

  return (
    <Panel
      title="The helper function g(K)"
      subtitle="g(K) = E[σ(z)²] for z ~ N(0, K): everything the recursion knows about the activation."
      right={<Badge tone="good">by quadrature</Badge>}
    >
      <div className="figure-layout grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="figure-controls space-y-3">
          <Select
            label="Activation"
            value={activation}
            options={ACTIVATION_IDS.map((id) => ({ value: id, label: getActivation(id).label }))}
            onChange={(v) => setActivation(v)}
          />
          <div className="rounded border border-lab-700 bg-lab-850/50 p-2.5 text-[12px] leading-relaxed text-lab-200">
            <div className="text-lab-400">
              For the linear activation g(K) = K exactly. For a scale-invariant activation g(K) = A²K exactly. Everything
              else needs the quadrature.
            </div>
          </div>
        </div>
        <Plot
          height={280}
          data={[
            line(Ks, g, 'g(K)', COLORS.blue),
            line(Ks, linear, 'the linear case, g(K) = K', COLORS.green, { line: { color: COLORS.green, width: 1.5, dash: 'dot' } }),
          ]}
          layout={{
            xaxis: { title: { text: 'K' } },
            yaxis: { title: { text: 'g(K)' } },
          }}
          caption="For tanh, g(K) < K for every K > 0: the activation compresses its input, and the fixed point of the recursion is pulled towards zero."
        />
      </div>
    </Panel>
  );
}
