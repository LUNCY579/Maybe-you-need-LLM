import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFigure, Slider } from '../primitives'

/**
 * Interactive landing of the Chinchilla loss model (Ch. 4, Eq. 4.2–4.4):
 *
 *   L(N, D) = E + A/N^α + B/D^β        with C ≈ 6·N·D
 *
 * For a fixed compute budget C we sweep model size N, derive D = C/(6N), and
 * plot the loss. The minimum of that curve is the compute-optimal model size.
 * Coefficients are the book's fitted values: E ≈ 1.69, A ≈ 406.4, B ≈ 410.7,
 * α ≈ 0.34, β ≈ 0.28.
 */

const E = 1.69
const A = 406.4
const B = 410.7
const ALPHA = 0.34
const BETA = 0.28

function loss(N: number, D: number): number {
  return E + A / Math.pow(N, ALPHA) + B / Math.pow(D, BETA)
}

export function ScalingExplorer() {
  const [exponent, setExponent] = useState(23) // log10 of the FLOP budget
  const budget = Math.pow(10, exponent)

  const { points, optimum } = useMemo(() => {
    const samples: { n: number; loss: number; tokens: number; ratio: number }[] = []
    for (let step = 17; step <= 30; step += 0.25) {
      const n = Math.pow(10, step * 0.5) // N between ~10^8.5 and ~10^15
      const d = budget / (6 * n)
      if (d < 1) continue
      samples.push({ n, loss: loss(n, d), tokens: d, ratio: d / n })
    }
    let best = samples[0]
    for (const sample of samples) if (sample && sample.loss < best.loss) best = sample
    return { points: samples, optimum: best }
  }, [budget])

  const data = points.map((point) => ({
    n: point.n,
    label: `${(point.n / 1e9).toFixed(1)}B`,
    loss: Number(point.loss.toFixed(3)),
  }))

  return (
    <div className="space-y-4">
      <div>
        <label className="text-muted text-xs font-medium tracking-wide uppercase" htmlFor="budget-slider">
          Training compute budget: 10^{exponent} FLOPs
        </label>
        <Slider
          id="budget-slider"
          label="Training compute budget (log10 FLOPs)"
          value={exponent}
          min={20}
          max={26}
          step={0.25}
          onChange={setExponent}
        />
        <p className="text-muted text-xs">
          Budget ≈ 6·N·D, so increasing N forces D down at fixed compute. The U-shape is the underfitting / data-starvation trade-off.
        </p>
      </div>

      <ChartFigure
        title="Compute-optimal loss curve"
        description={`Loss as a function of model size at a fixed compute budget of 10^${exponent} FLOPs. The minimum marks the compute-optimal model size.`}
        columns={['Model size', 'Loss']}
        rows={data.map((entry) => [entry.label, entry.loss])}
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 4 }}>
              <CartesianGrid stroke="rgba(148,178,255,0.12)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={7} stroke="#9aa7c7" />
              <YAxis domain={['dataMin - 0.05', 'dataMax + 0.05']} tick={{ fontSize: 10 }} stroke="#9aa7c7" width={48} />
              <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid rgba(148,178,255,0.25)', fontSize: 12 }} />
              <Line type="monotone" dataKey="loss" stroke="#35e6ff" dot={false} strokeWidth={2} />
              {optimum ? <ReferenceDot x={`${(optimum.n / 1e9).toFixed(1)}B`} y={Number(optimum.loss.toFixed(3))} r={5} fill="#a78bfa" stroke="none" /> : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartFigure>

      {optimum ? (
        <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div className="surface-2 rounded-lg border p-2" style={{ borderColor: 'var(--border-soft)' }}>
            <dt className="text-muted">Compute-optimal N*</dt>
            <dd className="text-sm font-semibold">{(optimum.n / 1e9).toFixed(2)}B params</dd>
          </div>
          <div className="surface-2 rounded-lg border p-2" style={{ borderColor: 'var(--border-soft)' }}>
            <dt className="text-muted">Matching tokens D*</dt>
            <dd className="text-sm font-semibold">{(optimum.tokens / 1e12).toFixed(2)}T tokens</dd>
          </div>
          <div className="surface-2 rounded-lg border p-2" style={{ borderColor: 'var(--border-soft)' }}>
            <dt className="text-muted">Predicted loss</dt>
            <dd className="text-sm font-semibold">{optimum.loss.toFixed(3)}</dd>
          </div>
          <div className="surface-2 rounded-lg border p-2" style={{ borderColor: 'var(--border-soft)' }}>
            <dt className="text-muted">Tokens per parameter</dt>
            <dd className="text-sm font-semibold">{optimum.ratio.toFixed(1)}</dd>
          </div>
        </dl>
      ) : null}

      <p className="text-muted text-[11px]">
        Move the budget and watch the ratio stay near the book's rule of thumb of ≈20 tokens per parameter (Ch. 4, §4.1.2). The curve is a fitted
        approximation, so it illustrates the mechanism rather than predicting a specific training run.
      </p>
    </div>
  )
}
