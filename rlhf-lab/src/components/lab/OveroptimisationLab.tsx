import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  alphaBetaAcrossData,
  bestOfNDistribution,
  bestOfNGain,
  buildRewardSetting,
  compareAtBudgets,
  expectedReward,
  fitBestOfNForm,
  klFromReference,
  policyForBudget,
  reinforcementLearningGain,
  sweepOveroptimisation,
  tiltedPolicy,
} from '../../core/overoptimisation'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'

type View = 'curve' | 'budget' | 'fits' | 'growth' | 'lesson'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const OVEROPTIMISATION_VIEWS: { value: View; label: string }[] = [
  { value: 'curve', label: 'The curve' },
  { value: 'budget', label: 'Same KL budget' },
  { value: 'fits', label: 'The fits' },
  { value: 'growth', label: 'As the judge grows' },
  { value: 'lesson', label: 'Where to stop' },
]

const BUDGETS = [0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8, 12, 14, 20]
const LADDER_SIZES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 1024, 4096, 65536, 1048576]
const DATA_SIZES = [1, 4, 16, 64, 100, 256, 1024, 4096, 16384]

/** Every k-th point of a sweep, so the numbers behind a chart fit in a table. */
function sampled<T>(points: T[], count: number): T[] {
  if (points.length <= count) return points
  const step = (points.length - 1) / (count - 1)
  return Array.from({ length: count }, (_, i) => points[Math.round(i * step)]!)
}

export function OveroptimisationLab() {
  const [view, setView] = useViewParam(OVEROPTIMISATION_VIEWS)
  const [errorScale, setErrorScale] = useState(0.35)
  const [errorSlope, setErrorSlope] = useState(3)
  const [seed, setSeed] = useState(13)
  const [maxLambda, setMaxLambda] = useState(2)

  const setting = useMemo(
    () => buildRewardSetting(61, 6, errorScale, errorSlope, seed),
    [errorScale, errorSlope, seed],
  )

  const curve = useMemo(() => sweepOveroptimisation(setting, maxLambda, 160), [setting, maxLambda])
  const rlGain = useMemo(() => reinforcementLearningGain(setting, maxLambda, 160), [setting, maxLambda])
  const bonGain = useMemo(() => bestOfNGain(setting), [setting])
  const bonLadder = useMemo(() => LADDER_SIZES.map((n) => ({ n, ...bestOfNDistribution(setting, n) })), [setting])
  const budgetRows = useMemo(() => compareAtBudgets(setting, BUDGETS, LADDER_SIZES), [setting])
  const growth = useMemo(() => alphaBetaAcrossData(setting, DATA_SIZES, 100, 1.2, 100), [setting])
  const ceiling = useMemo(() => policyForBudget(setting, 1e6), [setting])

  /** The point at which the gold reward is maximised, and the λ that reaches it. */
  const turningPoint = curve.points.reduce((a, b) => (b.trueReward > a.trueReward ? b : a))

  /** The policy at the turning point, and the one at the far end. */
  const policies = useMemo(
    () => ({
      atTurning: tiltedPolicy(setting, turningPoint.lambda),
      atEnd: tiltedPolicy(setting, maxLambda),
    }),
    [setting, turningPoint.lambda, maxLambda],
  )

  const goldBest = Math.max(...setting.trueReward)
  const headroom = goldBest - rlGain.baseline
  const ceilingGain = ceiling.trueReward - rlGain.baseline
  const optimumGap = Math.abs(setting.points[setting.proxyBestIndex]! - setting.points[setting.bestIndex]!)
  const farEnd = curve.points[curve.points.length - 1]!

  /** Whether this sweep is long enough to contain the turnover. */
  const turnsOver = turningPoint.lambda < maxLambda * 0.999

  const proxyMargin = Math.min(
    ...budgetRows.filter((row) => row.reachable).map((row) => row.rlProxyReward - row.bonProxyReward),
  )
  const trueGaps = budgetRows.map((row) => row.rlTrueReward - row.bonTrueReward)
  const trueFlips = Math.max(...trueGaps) > 1e-9 && Math.min(...trueGaps) < -1e-9

  const growthFirst = growth[0]!
  const growthLast = growth[growth.length - 1]!
  const alphaRose = growthLast.rlAlpha > growthFirst.rlAlpha

  /** The same least squares, asked for the absolute reward instead of the gain. */
  const rawTrap = useMemo(
    () => fitBestOfNForm(rlGain.distances, curve.points.map((point) => point.trueReward)),
    [rlGain, curve],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory F · Reward overoptimisation"
        subtitle="Measured against a gold reward model, and built exactly rather than described"
        accent="violet"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={OVEROPTIMISATION_VIEWS}
          />
          <Slider
            label="The reward model’s error"
            value={errorScale}
            min={0}
            max={1.5}
            step={0.05}
            onChange={setErrorScale}
            format={(value) => value.toFixed(2)}
            hint="The random part of the error. It does not grow as the policy is pushed."
          />
          <Slider
            label="The reward model’s systematic error"
            value={errorSlope}
            min={0}
            max={5}
            step={0.25}
            onChange={setErrorSlope}
            format={(value) => value.toFixed(2)}
            hint="What moves the proxy’s optimum away from the gold one."
          />
          <Slider
            label="How far to push"
            value={maxLambda}
            min={0.2}
            max={6}
            step={0.1}
            onChange={setMaxLambda}
            format={(value) => value.toFixed(2)}
            hint="The largest multiplier in the sweep. The turnover needs a range wide enough to contain it."
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="The gold gain available" value={fmt(headroom, 3)} hint="what sitting on the gold optimum is worth" />
          <Stat
            label="The best gold gain reached"
            value={fmt(rlGain.bestGain, 3)}
            hint={`at KL ${fmt(rlGain.bestKl, 2)}`}
            tone={rlGain.bestGain > 0 ? 'good' : 'warn'}
          />
          <Stat
            label="The gold gain as far as the tilt can go"
            value={fmt(ceilingGain, 3)}
            hint={`the tilt tops out at KL ${fmt(ceiling.kl, 2)}`}
            tone={ceilingGain < 0 ? 'warn' : 'good'}
          />
          <Stat
            label="The two optima are this far apart"
            value={fmt(optimumGap, 2)}
            hint="grid units, the proxy’s against the gold one"
            tone={optimumGap > 1 ? 'warn' : 'good'}
          />
        </div>

        {view === 'curve' ? (
          <>
            <Figure
              title="The proxy rises, the gold reward turns over"
              description="The expected proxy reward and the expected gold reward, against the KL distance the policy has travelled."
              data={{
                headers: ['The KL distance travelled', 'The proxy reward', 'The gold reward'],
                rows: sampled(curve.points, 21).map((point) => [
                  fmt(point.kl, 4),
                  fmt(point.proxy, 4),
                  fmt(point.trueReward, 4),
                ]),
              }}
              caption={
                turnsOver
                  ? `Nothing here is sampled. The proxy reward keeps rising; the gold reward rises, turns over at KL ${fmt(rlGain.bestKl, 3)}, and falls. The policy at each distance is the exponential tilt of the reference by the proxy reward, which is the exact way to spend a KL budget.`
                  : `Over this range the gold reward has not yet turned over: it peaks at a multiplier of ${fmt(turningPoint.lambda, 3)}, and this sweep stops at ${fmt(maxLambda, 2)}. Widen "How far to push" to watch it fall.`
              }
            >
              <TrendChart
                data={curve.points.map((point) => ({
                  x: point.kl,
                  proxy: point.proxy,
                  trueReward: point.trueReward,
                }))}
                series={[
                  { key: 'proxy', name: 'the proxy reward', colour: 'var(--accent-violet)' },
                  { key: 'trueReward', name: 'the gold reward', colour: 'var(--accent-rose)' },
                ]}
                xLabel="the KL distance travelled"
                yLabel="the expected reward"
                height={300}
              />
            </Figure>

            <Figure
              title="The proxy reward, on its own scale"
              description="The proxy reward alone against the distance travelled, so that the monotone rise is visible."
              caption="The proxy reward by itself. It is monotone: there is no signal in it that the policy has gone too far, which is the whole difficulty. Its numbers are the middle column of the table above."
            >
              <TrendChart
                data={curve.points.map((point) => ({ x: point.kl, proxy: point.proxy }))}
                series={[{ key: 'proxy', name: 'the proxy reward', colour: 'var(--accent-violet)' }]}
                xLabel="the KL distance travelled"
                yLabel="the proxy reward"
                height={250}
              />
            </Figure>

            <Callout tone="definition" title="Gold reward model">
              The name the overoptimisation literature uses for the thing you are not supposed to have: a reward
              function that measures what you actually want, so that the <em>proxy’s</em> error can be measured. Here it
              is a negative quadratic on the response grid, peaked at {fmt(setting.peak, 2)}, while the reference policy
              is centred at 0. The starting model is therefore not where the gold reward is best, which is the situation
              a fine-tuning run is actually in. Every number on this screen is scored against the gold reward; the proxy
              is the gold reward plus a fixed error.
            </Callout>

            <Callout tone="note" title="Why it happens here, exactly">
              The reward model’s error is <em>fixed</em>: it does not grow as the policy is pushed. So the proxy is a
              landscape with high and low spots, and pushing further finds the high spots — which are where the reward
              model happened to be generous, not where the gold reward is. The proxy’s own best point is{' '}
              {fmt(optimumGap, 2)} grid units from the gold one, and a run with no KL discipline at all ends there: a
              gold reward of {fmt(ceiling.trueReward, 3)}, against {fmt(rlGain.bestGain + rlGain.baseline, 3)} at the
              turning point and {fmt(rlGain.baseline, 3)} where the policy started.
            </Callout>
          </>
        ) : null}

        {view === 'budget' ? (
          <>
            <Figure
              title="The gold reward at the same distance"
              description="Both methods asked for the same KL budget, and scored on the gold reward."
              caption={`Reinforcement learning is the exponential tilt that spends the budget exactly. Best-of-n is the distribution that selecting the best of n samples actually induces, so both rows travel the same number of nats in the same sense. ${
                trueFlips
                  ? 'On the gold reward the winner changes with the budget: the seventh column of the table is where the difference crosses zero.'
                  : 'Over these budgets one method leads on the gold reward the whole way.'
              }`}
            >
              <TrendChart
                data={budgetRows.map((row) => ({
                  x: row.budget,
                  rlTrue: row.rlTrueReward,
                  bonTrue: row.bonKl === row.budget ? row.bonTrueReward : null,
                }))}
                series={[
                  { key: 'rlTrue', name: 'reinforcement learning, gold', colour: 'var(--accent-rose)' },
                  { key: 'bonTrue', name: 'best-of-n, gold', colour: 'var(--accent-amber)' },
                ]}
                xLabel="the KL budget, in nats"
                yLabel="the gold reward"
                height={300}
              />
            </Figure>

            <Figure
              title="The proxy reward at the same distance"
              description="The same budgets, scored on the proxy the optimisation is actually given."
              caption={`The tilt is the exact maximiser of the proxy reward at a given KL distance, so its lead here is not an accident: no policy — best-of-n included — can beat it on the proxy at the same distance. The smallest margin over the budgets the tilt can actually reach is ${fmt(proxyMargin, 3)}.`}
            >
              <TrendChart
                data={budgetRows.map((row) => ({
                  x: row.budget,
                  rlProxy: row.rlProxyReward,
                  bonProxy: row.bonKl === row.budget ? row.bonProxyReward : null,
                }))}
                series={[
                  { key: 'rlProxy', name: 'reinforcement learning, proxy', colour: 'var(--accent-violet)' },
                  { key: 'bonProxy', name: 'best-of-n, proxy', colour: 'var(--accent-teal)' },
                ]}
                xLabel="the KL budget, in nats"
                yLabel="the proxy reward"
                height={280}
              />
            </Figure>

            <DataTable
              caption="The two methods, each asked to travel the same number of nats"
              headers={[
                'KL budget',
                'Gold reward, reinforcement learning',
                'Gold reward, best-of-n',
                'Proxy reward, reinforcement learning',
                'Proxy reward, best-of-n',
                'Best-of-n bracketed by',
                'Gold reward, RL minus best-of-n',
                'Note',
              ]}
              rows={budgetRows.map((row) => [
                fmt(row.budget, 3),
                fmt(row.rlTrueReward, 4),
                fmt(row.bonTrueReward, 4),
                fmt(row.rlProxyReward, 4),
                fmt(row.bonProxyReward, 4),
                `n = ${row.lowN} … ${row.highN}`,
                fmt(row.rlTrueReward - row.bonTrueReward, 4),
                !row.reachable
                  ? `the budget cannot be spent: ${fmt(ceiling.kl, 2)} nats is as far as the tilt goes`
                  : Math.abs(row.bonKl - row.budget) > 1e-6
                    ? 'best-of-n cannot get this far either'
                    : row.rlTrueReward - row.bonTrueReward > 0
                      ? 'reinforcement learning is ahead'
                      : 'best-of-n is ahead',
              ])}
            />

            <Callout tone="note" title="What this comparison does and does not say">
              Best-of-n never moves the policy: it draws n samples from the reference and hands back the one the proxy
              likes most. That selection is still a distribution over the response space, and it still has a KL
              distance, which is what makes the two columns comparable. What comes out of it: the tilt wins on the proxy
              at every budget it can reach, by a margin that never falls below {fmt(proxyMargin, 3)}, and on the gold
              reward the two trade places as the budget grows. So neither method is the better one in general. Which one
              you should run depends on where on the curve you intend to stop, and on whether you can afford the
              samples.
            </Callout>
          </>
        ) : null}

        {view === 'fits' ? (
          <>
            <Figure
              title="The best-of-n gain, and the parabola fitted to it"
              description="The gold reward gained over the reference, against the distance √KL, with the form d(α − βd) fitted to it."
              data={{
                headers: ['The distance d = √KL', 'The measured gain', 'The fitted gain'],
                rows: bonGain.distances.map((d, i) => [fmt(d, 4), fmt(bonGain.gains[i]!, 4), fmt(bonGain.fit.fitted[i]!, 4)]),
              }}
              caption={`The paper fits its forms to the gain over the starting policy, and to the distance √KL rather than to KL. Both choices matter. The absolute reward does not start at zero, and the gain a selection buys rises like √KL near the start, so on the KL axis no parabola fits it. Here the parabola lands at R² = ${fmt(bonGain.fit.r2, 4)}.`}
            >
              <TrendChart
                data={bonGain.distances.map((d, i) => ({
                  x: d,
                  measured: bonGain.gains[i]!,
                  fitted: bonGain.fit.fitted[i]!,
                }))}
                series={[
                  { key: 'measured', name: 'measured gain', colour: 'var(--accent-amber)' },
                  { key: 'fitted', name: 'd(α − βd)', colour: 'var(--accent-violet)', dashed: true },
                ]}
                xLabel="the distance d = √KL"
                yLabel="the gold gain over the reference"
                height={280}
              />
            </Figure>

            <Figure
              title="The reinforcement-learning gain, and the logarithmic form fitted to it"
              description="The same gain for the tilt, with the form d(α − β log d) fitted to it."
              data={{
                headers: ['The distance d = √KL', 'The measured gain', 'The fitted gain'],
                rows: sampled(
                  rlGain.distances.map((d, i) => ({ d, measured: rlGain.gains[i]!, fitted: rlGain.fit.fitted[i]! })),
                  21,
                ).map((row) => [fmt(row.d, 4), fmt(row.measured, 4), fmt(row.fitted, 4)]),
              }}
              caption={`The logarithmic form bends more slowly than the parabola, and here it fits at R² = ${fmt(rlGain.fit.r2, 4)} against best-of-n’s ${fmt(bonGain.fit.r2, 4)}. Best-of-n peaks at a gain of ${fmt(bonGain.bestGain, 3)} at distance ${fmt(bonGain.bestDistance, 2)}; reinforcement learning peaks at ${fmt(rlGain.bestGain, 3)} at distance ${fmt(rlGain.bestDistance, 2)}. Every sample size behind the best-of-n curve is in the last table of “Where to stop”.`}
            >
              <TrendChart
                data={rlGain.distances.map((d, i) => ({
                  x: d,
                  measured: rlGain.gains[i]!,
                  fitted: rlGain.fit.fitted[i]!,
                }))}
                series={[
                  { key: 'measured', name: 'measured gain', colour: 'var(--accent-rose)' },
                  { key: 'fitted', name: 'd(α − β log d)', colour: 'var(--accent-violet)', dashed: true },
                ]}
                xLabel="the distance d = √KL"
                yLabel="the gold gain over the reference"
                height={280}
              />
            </Figure>

            <DataTable
              caption="The two coefficients, on the gain and on the distance"
              headers={['Form', 'α', 'β', 'R²', 'The gain it peaks at', 'The distance it peaks at']}
              rows={[
                [
                  'R(d) = d(α − β d), best-of-n',
                  fmt(bonGain.fit.alpha, 4),
                  fmt(bonGain.fit.beta, 4),
                  fmt(bonGain.fit.r2, 4),
                  fmt(bonGain.bestGain, 4),
                  fmt(bonGain.bestDistance, 4),
                ],
                [
                  'R(d) = d(α − β log d), reinforcement learning',
                  fmt(rlGain.fit.alpha, 4),
                  fmt(rlGain.fit.beta, 4),
                  fmt(rlGain.fit.r2, 4),
                  fmt(rlGain.bestGain, 4),
                  fmt(rlGain.bestDistance, 4),
                ],
              ]}
            />

            <Callout tone="warning" title="Fitting the reward instead of the gain">
              Hand the same least-squares problem the absolute gold reward rather than the gain and, on these dials, α
              comes out {fmt(rawTrap.alpha)} with an R² of {fmt(rawTrap.r2, 4)} — against {fmt(bonGain.fit.r2, 4)} for
              the gain above. The form has no intercept, so asked to bend around a curve that starts at{' '}
              {fmt(rlGain.baseline)} rather than at zero, its very first step has to be a fall. The coefficients in the
              paper are coefficients of a <em>change</em> in reward, and they mean nothing otherwise.
            </Callout>
          </>
        ) : null}

        {view === 'growth' ? (
          <>
            <Figure
              title="α as the reward model is fitted on more pairs"
              description="The initial rate of improvement, for both forms, against the log of the number of preference pairs."
              caption={`The reward model is the gold reward plus an error whose two parts shrink as one over √(pairs), so each row is the same run with more spent on the judge and nothing else changed. From ${growthFirst.data} pairs to ${growthLast.data} the reinforcement-learning α goes from ${fmt(growthFirst.rlAlpha, 3)} to ${fmt(growthLast.rlAlpha, 3)}. The row at 100 pairs is exactly the reward model the dials above describe.`}
            >
              <TrendChart
                data={growth.map((row) => ({
                  x: Math.log10(row.data),
                  rlAlpha: row.rlAlpha,
                  bonAlpha: row.bonAlpha,
                }))}
                series={[
                  { key: 'rlAlpha', name: 'α, reinforcement learning', colour: 'var(--accent-rose)' },
                  { key: 'bonAlpha', name: 'α, best-of-n', colour: 'var(--accent-amber)' },
                ]}
                xLabel="log₁₀ of the preference pairs behind the reward model"
                yLabel="α"
                height={280}
              />
            </Figure>

            <Figure
              title="β as the reward model is fitted on more pairs"
              description="The rate at which the gain curves back down, for both forms, against the same axis."
              caption={`β is the part of the fit that says "and then it gets worse". ${
                growthLast.rlBeta < growthFirst.rlBeta
                  ? `It falls here: ${fmt(growthFirst.rlBeta, 3)} down to ${fmt(growthLast.rlBeta, 3)} for reinforcement learning, and ${fmt(growthFirst.bonBeta, 3)} down to ${fmt(growthLast.bonBeta, 3)} for best-of-n.`
                  : `It does not fall here: ${fmt(growthFirst.rlBeta, 3)} for reinforcement learning at the smallest model, ${fmt(growthLast.rlBeta, 3)} at the largest.`
              } That is the direction the paper reports, and it is the one that matters operationally: a smaller β means the same distance costs less gold reward.`}
            >
              <TrendChart
                data={growth.map((row) => ({
                  x: Math.log10(row.data),
                  rlBeta: row.rlBeta,
                  bonBeta: row.bonBeta,
                }))}
                series={[
                  { key: 'rlBeta', name: 'β, reinforcement learning', colour: 'var(--accent-rose)' },
                  { key: 'bonBeta', name: 'β, best-of-n', colour: 'var(--accent-amber)' },
                ]}
                xLabel="log₁₀ of the preference pairs behind the reward model"
                yLabel="β"
                height={280}
              />
            </Figure>

            <DataTable
              caption="What changes when only the reward model changes"
              headers={[
                'Preference pairs',
                'Random error τ',
                'Systematic slope a',
                'Gap between the two optima',
                'α, reinforcement learning',
                'β, reinforcement learning',
                'α, best-of-n',
                'β, best-of-n',
                'Gold gain as far as the tilt can go',
              ]}
              rows={growth.map((row) => [
                String(row.data),
                fmt(row.errorScale, 3),
                fmt(row.errorSlope, 2),
                fmt(row.optimumGap, 2),
                fmt(row.rlAlpha, 3),
                fmt(row.rlBeta, 3),
                fmt(row.bonAlpha, 3),
                fmt(row.bonBeta, 3),
                fmt(row.gainAtCeiling, 3),
              ])}
            />

            <Callout tone="note" title={alphaRose ? 'What the paper’s α half says, and what this says' : 'The part of the paper’s story that does not transfer'}>
              The paper reports α <em>rising</em> with more data.{' '}
              {alphaRose
                ? `Here it does too: ${fmt(growthFirst.rlAlpha, 3)} at ${growthFirst.data} pairs, ${fmt(growthLast.rlAlpha, 3)} at ${growthLast.data}.`
                : `Here it does not: ${fmt(growthFirst.rlAlpha, 3)} at ${growthFirst.data} pairs against ${fmt(growthLast.rlAlpha, 3)} at ${growthLast.data}. The reason is in the construction. The systematic error is a slope, and a slope points the same way the gold reward improves from where the reference policy sits, so a model with that bias is a good local guide and a bad global one. α measures the local guidance; β measures how badly it misleads once you are far out, and that is what shrinks.`}{' '}
              The last column of the table is the honest headline: pushing as far as the proxy allows goes from{' '}
              {fmt(growthFirst.gainAtCeiling, 3)} at {growthFirst.data} pairs to {fmt(growthLast.gainAtCeiling, 3)} at{' '}
              {growthLast.data}.
            </Callout>

            <Callout tone="definition" title="How much best-of-n notices the judge">
              Compare the best-of-n α and β columns with the reinforcement-learning ones:{' '}
              {Math.abs(growthLast.bonBeta - growthFirst.bonBeta) < Math.abs(growthLast.rlBeta - growthFirst.rlBeta)
                ? `β moves ${fmt(Math.abs(growthLast.bonBeta - growthFirst.bonBeta), 3)} across the whole ladder for best-of-n against ${fmt(Math.abs(growthLast.rlBeta - growthFirst.rlBeta), 3)} for reinforcement learning, and α moves ${fmt(Math.abs(growthLast.bonAlpha - growthFirst.bonAlpha), 3)} against ${fmt(Math.abs(growthLast.rlAlpha - growthFirst.rlAlpha), 3)}.`
                : `β moves ${fmt(Math.abs(growthLast.bonBeta - growthFirst.bonBeta), 3)} across the ladder for best-of-n, ${fmt(Math.abs(growthLast.rlBeta - growthFirst.rlBeta), 3)} for reinforcement learning.`}{' '}
              Selecting the best of n samples is as much a property of the reference policy — where its mass sits, and how
              much of that mass the proxy ranks below a given point — as it is a property of the reward model. That is
              why best-of-n degrades gently here: it never really gets to the far tail where the judge is wrong.
            </Callout>
          </>
        ) : null}

        {view === 'lesson' ? (
          <>
            <Figure
              title="Where the policy should stop"
              description="The turning point, the distance it corresponds to, and what the policy looks like there and at the far end."
              caption={`The operational reading: the turning point is the distance at which the marginal proxy reward equals the marginal gold reward, and the KL coefficient in the objective is what decides whether a run reaches it. This sweep stops at KL ${fmt(farEnd.kl, 2)}; the tilt can never pass ${fmt(ceiling.kl, 2)}.`}
            >
              <DataTable
                caption="The stopping point"
                headers={['Quantity', 'Value']}
                rows={[
                  ['the multiplier λ at the turning point', fmt(turningPoint.lambda, 4)],
                  ['the KL distance there', fmt(turningPoint.kl, 4)],
                  ['the gold reward there', fmt(turningPoint.trueReward, 4)],
                  ['the proxy reward there', fmt(turningPoint.proxy, 4)],
                  ['the gold reward at the far end of this sweep', fmt(farEnd.trueReward, 4)],
                  ['the proxy reward at the far end of this sweep', fmt(farEnd.proxy, 4)],
                  ['the regret at the far end of this sweep', fmt(farEnd.regret, 4)],
                  ['the gold reward of the reference policy', fmt(rlGain.baseline, 4)],
                ]}
              />
            </Figure>

            <Figure
              title="The policy at the turning point, at the far end, and at the ceiling"
              description="The three policies, over the response space, with the gold reward and the proxy reward beneath them."
              caption={`At the turning point the policy is spread over the region where the gold reward is high. Past it the policy keeps paying in KL and keeps losing gold reward while its proxy score goes up. The proxy’s favourite point is ${fmt(optimumGap, 2)} grid units from the gold one.`}
            >
              <DataTable
                caption="The three policies"
                headers={['Quantity', 'At the turning point', 'At the far end of the sweep', 'As far as the tilt can go']}
                rows={[
                  [
                    'the KL distance from the reference',
                    fmt(klFromReference(setting, policies.atTurning), 4),
                    fmt(klFromReference(setting, policies.atEnd), 4),
                    fmt(ceiling.kl, 4),
                  ],
                  [
                    'the expected gold reward',
                    fmt(expectedReward(policies.atTurning, setting.trueReward), 4),
                    fmt(expectedReward(policies.atEnd, setting.trueReward), 4),
                    fmt(ceiling.trueReward, 4),
                  ],
                  [
                    'the expected proxy reward',
                    fmt(expectedReward(policies.atTurning, setting.proxyReward), 4),
                    fmt(expectedReward(policies.atEnd, setting.proxyReward), 4),
                    fmt(ceiling.proxyReward, 4),
                  ],
                ]}
              />
            </Figure>

            <Figure
              title="What best-of-n pays for a sample size"
              description="The policy that selecting the best of n samples induces: the distance it travels, and what the gold reward says when it gets there."
              caption="No sampling here either. This is the exact distribution that “take the best of n” induces, and its distance grows slowly because the samples that would take it further are the ones the reference policy almost never produces."
            >
              <DataTable
                caption="Best-of-n, sample size by sample size"
                headers={['n', 'The KL distance it travels', 'The gold reward', 'The proxy reward', 'The gold gain over the reference']}
                rows={bonLadder.map((row) => [
                  String(row.n),
                  fmt(row.kl, 4),
                  fmt(row.trueReward, 4),
                  fmt(row.proxyReward, 4),
                  fmt(row.trueReward - rlGain.baseline, 4),
                ])}
              />
            </Figure>

            <Callout tone="warning" title="The thing to report">
              A score without the distance travelled cannot be compared with another one. Two runs with the same reward
              model and the same KL coefficient can be in completely different places on this curve, and only one of
              them may be past the turning point.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
