import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { discountedReturn, generalisedAdvantage, tdResidual } from '../../core/ppo'
import { advantageCurve, buildChain, chainValues, fitValueHead, returnSpread, sampleChainTrajectory } from '../../core/value'
import {
  Callout,
  DataTable,
  Figure,
  Panel,
  SegmentedControl,
  Slider,
  Stat,
  TrendChart,
} from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'

type View = 'lambda' | 'bias-variance' | 'value-head'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const GAE_VIEWS: { value: View; label: string }[] = [
  { value: 'lambda', label: 'The λ sweep' },
  { value: 'bias-variance', label: 'Bias and variance' },
  { value: 'value-head', label: 'The value head' },
]

export function GaeLab() {
  const [view, setView] = useViewParam(GAE_VIEWS)
  const [gamma, setGamma] = useState(0.9)
  const [lambda, setLambda] = useState(0.95)
  const [seed, setSeed] = useState(3)
  const [power, setPower] = useState(7)
  const trajectories = 2 ** power

  /**
   * The setting is a chain of six states, one context per position, so every
   * trajectory the policy can produce is one of 4^6 = 4096 of them and each can
   * be enumerated. The rewards are the constructed landscape the other
   * laboratories use.
   */
  const chain = useMemo(() => buildChain(seed, 6, 4, gamma), [seed, gamma])
  const exact = useMemo(() => chainValues(chain), [chain])
  const trajectory = useMemo(() => sampleChainTrajectory(chain, exact, seed * 31 + 7), [chain, exact, seed])

  const target = useMemo(() => generalisedAdvantage(trajectory, gamma, 1), [trajectory, gamma])
  const current = useMemo(() => generalisedAdvantage(trajectory, gamma, lambda), [trajectory, gamma, lambda])
  const residuals = useMemo(
    () => trajectory.steps.map((step) => tdResidual(step, gamma)),
    [trajectory, gamma],
  )

  /** The advantage estimate as λ moves, on this one trajectory. */
  const lambdaSweep = useMemo(() => {
    const rows: { x: number; first: number; third: number; montecarloFirst: number; montecarloThird: number }[] = []
    for (let l = 0; l <= 1.0001; l += 0.05) {
      const advantages = generalisedAdvantage(trajectory, gamma, l)
      rows.push({
        x: l,
        first: advantages[0] ?? 0,
        third: advantages[2] ?? 0,
        montecarloFirst: target[0] ?? 0,
        montecarloThird: target[2] ?? 0,
      })
    }
    return rows
  }, [trajectory, gamma, target])

  /** The head trained on the data the slider gives it, and the estimator scored against it. */
  const head = useMemo(() => fitValueHead(chain, { trajectories, seed: 11 }), [chain, trajectories])
  const curve = useMemo(() => advantageCurve(chain, head.values), [chain, head])
  const perfect = useMemo(() => advantageCurve(chain, exact), [chain, exact])
  const row = (lambdas: number) => curve.rows.find((entry) => Math.abs(entry.lambda - lambdas) < 1e-9) ?? curve.rows[0]!
  const perfectRow = (lambdas: number) =>
    perfect.rows.find((entry) => Math.abs(entry.lambda - lambdas) < 1e-9) ?? perfect.rows[0]!
  /** Whether the head this page trained is already good enough that λ has nothing left to buy. */
  const headsAgree = Math.abs(curve.bestLambda - perfect.bestLambda) < 1e-9

  /** What the head's own loss does across its training, against what its error does. */
  const training = useMemo(() => {
    const first = head.curve[0]!
    const last = head.curve[head.curve.length - 1]!
    let best = first
    for (const point of head.curve) if (point.error < best.error) best = point
    return {
      first,
      last,
      peakLoss: head.curve.reduce((max, point) => Math.max(max, point.loss), 0),
      best,
    }
  }, [head])

  /**
   * The head fitted at a ladder of sizes of the same data stream, each scored by the
   * estimator. These are not checkpoints of one run: each rung is a fresh fit
   * stopped earlier on the same stream, so the rows are comparable and the only
   * thing that changes between them is how many trajectories the head saw.
   */
  const base = useMemo(() => {
    const make = (size: number) => {
      const fit = fitValueHead(chain, { trajectories: size, seed: 11 })
      return { size, fit, scored: advantageCurve(chain, fit.values) }
    }
    return { rungs: [1, 2, 4, 8, 16, 32, 64, 128, 256].map(make), make }
  }, [chain])

  const ladder = useMemo(() => {
    const ladderRows = trajectories > 256 ? [...base.rungs, base.make(trajectories)] : base.rungs
    const lambdas = ladderRows.map((rung) => rung.scored.bestLambda)
    const dips = ladderRows.filter((rung, index) => index > 0 && rung.fit.rmse > ladderRows[index - 1]!.fit.rmse).length
    return {
      rows: ladderRows,
      least: Math.min(...lambdas),
      most: Math.max(...lambdas),
      dips,
      settles: ladderRows[ladderRows.length - 1]!.scored.bestLambda <= ladderRows[0]!.scored.bestLambda,
    }
  }, [base, trajectories])

  /** How varied the returns are from each position — the difficulty the head is being asked to average over. */
  const spread = useMemo(() => returnSpread(chain), [chain])
  const noiseFloor = useMemo(
    () => spread.reduce((sum, point) => sum + point.standardDeviation ** 2, 0) / spread.length,
    [spread],
  )
  /** The position whose returns disagree the most — the hardest one for a head that is only an average. */
  const hardest = spread.reduce(
    (best, point, index) => (point.standardDeviation > best.point.standardDeviation ? { index, point } : best),
    { index: 0, point: spread[0]! },
  )
  const spreadCorrelation = useMemo(() => {
    const xs = spread.map((point) => point.standardDeviation)
    const ys = exact.map((value, index) => Math.abs((head.values[index] ?? 0) - value))
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length
    const covariance = xs.reduce((sum, x, index) => sum + (x - meanX) * (ys[index]! - meanY), 0)
    const spreadX = Math.sqrt(xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0))
    const spreadY = Math.sqrt(ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0))
    return covariance / (spreadX * spreadY || 1)
  }, [spread, head, exact])

  return (
    <div className="lab">
      <Panel
        title="Laboratory C · Advantages and the value head"
        subtitle="The credit assignment, the critic it is assigned against, and the one dial that sets how much of the critic's error is allowed in"
        accent="teal"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={GAE_VIEWS}
          />
          <Slider
            label="The discount γ"
            value={gamma}
            min={0.5}
            max={1}
            step={0.01}
            onChange={setGamma}
            format={(value) => value.toFixed(2)}
          />
          <Slider
            label="The trace-decay λ"
            value={lambda}
            min={0}
            max={1}
            step={0.01}
            onChange={setLambda}
            format={(value) => value.toFixed(2)}
            hint="0 is the one-step estimate; 1 is the Monte Carlo return."
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
          {view !== 'lambda' ? (
            <Slider
              label="Trajectories the head is trained on"
              value={power}
              min={1}
              max={10}
              step={1}
              onChange={setPower}
              format={() => `${trajectories}`}
              hint="Each trajectory is one pass of the policy through the chain, and its returns are the head's only data. This is the critic the advantage is measured against."
            />
          ) : null}
        </div>

        {view === 'lambda' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The advantage at the first state"
                value={fmt(current[0] ?? 0, 4)}
                hint={`the Monte Carlo answer is ${fmt(target[0] ?? 0, 4)}`}
              />
              <Stat
                label="The discounted return"
                value={fmt(discountedReturn(trajectory, gamma), 4)}
                hint="what this trajectory actually earned"
              />
              <Stat
                label="The first residual"
                value={fmt(residuals[0] ?? 0, 4)}
                hint="the one-step surprise, which is λ = 0"
              />
              <Stat
                label="λ"
                value={lambda.toFixed(2)}
                hint={lambda === 0 ? 'one step' : lambda === 1 ? 'the whole return' : 'in between'}
              />
            </div>

            <Figure
              title="The advantage as λ moves"
              description="Two of the six advantage estimates on one sampled trajectory, against the Monte Carlo answer, as λ moves from zero to one."
              caption={`The trajectory is one draw of ${trajectory.steps.length} actions from the policy, and the values beside it are the exact ones for these states. At λ = 0 the estimate at the first state is the first residual, ${fmt(
                residuals[0] ?? 0,
                4,
              )}; at λ = 1 it is the Monte Carlo answer, ${fmt(
                target[0] ?? 0,
                4,
              )} — the whole return less the critic's opening value. What lies between them is the other ${
                trajectory.steps.length - 1
              } residuals, and the next view measures what trading them away is worth: not on this draw but over all ${
                perfect.paths
              } trajectories the chain can produce.`}
            >
              <TrendChart
                data={lambdaSweep}
                series={[
                  { key: 'first', name: 'the advantage at the first state', colour: 'var(--accent-teal)' },
                  { key: 'montecarloFirst', name: 'its Monte Carlo answer', colour: 'var(--accent-rose)', dashed: true },
                  { key: 'third', name: 'the advantage at the third state', colour: 'var(--accent-indigo)' },
                  { key: 'montecarloThird', name: 'its Monte Carlo answer', colour: 'var(--accent-amber)', dashed: true },
                ]}
                xLabel="λ"
                yLabel="the advantage"
                height={300}
              />
            </Figure>

            <DataTable
              caption="The estimate at the chosen λ, step by step, on one sampled trajectory"
              headers={['Position', 'Reward', 'Critic here', 'Critic next', 'Residual', 'Advantage', 'Monte Carlo']}
              rows={trajectory.steps.map((step, index) => [
                index,
                fmt(step.reward, 4),
                fmt(step.value, 4),
                fmt(step.nextValue, 4),
                fmt(residuals[index] ?? 0, 4),
                fmt(current[index] ?? 0, 4),
                fmt(target[index] ?? 0, 4),
              ])}
            />

            <Callout tone="definition" title="What λ is doing">
              The advantage at a state is the residual at that state plus γλ times the advantage at the next one. With
              λ = 0 it is the one-step residual: the world surprised the critic by this much, and nothing else is
              admitted. With λ = 1 the recursion telescopes into the discounted return less the critic's opening value,
              and every reward the trajectory collected is in it. Everything between keeps some of the return and some
              of the tightness.
            </Callout>
          </>
        ) : null}

        {view === 'bias-variance' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The bias at λ = 0"
                value={fmt(row(0).bias, 5)}
                hint="what the head gets wrong, admitted straight into the advantage"
                tone={Math.abs(row(0).bias) > 0.05 ? 'warn' : 'default'}
              />
              <Stat
                label="The bias at λ = 1"
                value={row(1).bias.toExponential(1)}
                hint="the critic cancels out of the return entirely"
                tone="good"
              />
              <Stat
                label="The variance at the chosen λ"
                value={fmt(row(lambda).variance, 5)}
                hint={`against ${fmt(row(0).variance, 5)} at λ = 0 and ${fmt(row(1).variance, 5)} at λ = 1`}
              />
              <Stat
                label="The λ that minimises the error"
                value={curve.bestLambda.toFixed(2)}
                hint={
                  headsAgree
                    ? 'the same as with a perfect head — this one has nothing left to hide'
                    : `with a perfect head it would be ${perfect.bestLambda.toFixed(2)}`
                }
                tone={headsAgree ? 'good' : 'warn'}
              />
            </div>

            <Figure
              title="The three errors against λ, computed over every trajectory"
              description="The squared bias, the variance and their sum, as λ moves, for the advantage estimator scored against the trained head."
              caption={`All ${curve.paths} trajectories the policy can produce are enumerated, so these are the errors and not estimates of them. The variance is ${fmt(
                row(0).variance,
                5,
              )} at λ = 0 and ${fmt(row(1).variance, 5)} at λ = 1, and it never decreases on the way — that spread is the reward noise the estimator lets in, and no critic changes it: the same two numbers with a perfect head are ${fmt(
                perfectRow(0).variance,
                5,
              )} and ${fmt(perfectRow(1).variance, 5)}. The bias is a different thing entirely: ${fmt(
                row(0).bias,
                5,
              )} at λ = 0 against ${row(1).bias.toExponential(1)} at λ = 1. So λ trades one error for the other, and the sum of the two is minimised at ${curve.bestLambda.toFixed(
                2,
              )}.`}
            >
              <TrendChart
                data={curve.rows.map((entry) => ({
                  x: entry.lambda,
                  bias2: entry.bias * entry.bias,
                  variance: entry.variance,
                  mse: entry.mse,
                }))}
                series={[
                  { key: 'bias2', name: 'the squared bias', colour: 'var(--accent-teal)' },
                  { key: 'variance', name: 'the variance', colour: 'var(--accent-indigo)' },
                  { key: 'mse', name: 'their sum', colour: 'var(--accent-rose)' },
                ]}
                xLabel="λ"
                yLabel="squared error"
                height={300}
              />
            </Figure>

            <Figure
              title="What a perfect head would change"
              description="The same estimator, at five values of λ, scored against the trained head and against the exact value of every state."
              caption="With an exact head the bias is zero at every λ, because the residual averages to the surprise the critic should have had and nothing else. Then λ buys nothing and costs variance, so the best setting is the smallest one. Every bit of λ above zero that a real run uses is a judgement about how wrong the critic is."
            >
              <DataTable
                caption="The estimator against two heads"
                headers={[
                  'λ',
                  'bias, trained head',
                  'variance, trained head',
                  'total error, trained head',
                  'bias, perfect head',
                  'total error, perfect head',
                ]}
                rows={[0, 0.25, 0.5, 0.75, 1].map((l) => [
                  l.toFixed(2),
                  fmt(row(l).bias, 5),
                  fmt(row(l).variance, 5),
                  fmt(row(l).mse, 5),
                  perfectRow(l).bias.toExponential(1),
                  fmt(perfectRow(l).mse, 5),
                ])}
              />
            </Figure>

            <Callout tone="definition" title="The bias has a closed form">
              Write e for the head's error at a state, V − v. Enumerating the residuals gives E[A(λ)] = e₀ + (1 − 1/λ)
              Σ_l (γλ)^l e_l for the later states. At λ = 1 the second factor is zero and the head has left the estimate
              altogether — the Monte Carlo advantage is unbiased whatever the critic says. Below one, every state the
              head holds wrong contributes in proportion to how far the trace reaches, which is why λ is a statement
              about the critic and not about the objective.
            </Callout>

            <Callout tone="note" title="Why 0.95 is the usual answer">
              It is not a theoretically optimal value; it is a value that has been found to work across a lot of
              settings, and it puts most of the weight on the one-step residual while still reaching a few steps back.
              The table above says what it is worth only once the head's error is known: on this chain, with the head
              the trajectories dial just trained, the error is minimised at {curve.bestLambda.toFixed(2)}, and against
              the exact value of every state it is minimised at {perfect.bestLambda.toFixed(2)}.{' '}
              {headsAgree ? (
                <>
                  Those are the same number here, which is the finding rather than the failure: a head this accurate
                  leaves λ nothing to buy, so the shortest trace wins. Move the trajectories dial to its smallest
                  setting and watch the answer jump.
                </>
              ) : (
                <>
                  The same objective, two different answers, and the difference between them is the critic — which is
                  why a default λ quoted without a critic is not a reproducible number.
                </>
              )}
            </Callout>
          </>
        ) : null}

        {view === 'value-head' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The head's error against the truth"
                value={fmt(head.rmse, 4)}
                hint={`root mean squared, after ${trajectories} trajectories`}
                tone={head.rmse > 0.2 ? 'warn' : 'good'}
              />
              <Stat
                label="The loss it reports"
                value={fmt(head.curve[head.curve.length - 1]!.loss, 4)}
                hint="mean squared error against the returns it was shown"
              />
              <Stat
                label="The best λ with this head"
                value={curve.bestLambda.toFixed(2)}
                hint={`the total error there is ${fmt(curve.bestMse, 4)}`}
              />
              <Stat
                label="The value of the first state"
                value={fmt(head.values[0] ?? 0, 4)}
                hint={`the exact value is ${fmt(exact[0] ?? 0, 4)}`}
              />
            </div>

            <Figure
              title="Training a value head, and what its loss actually means"
              description="The head's error against the exact value of each state, and its loss against the returns it was shown, as a function of how many trajectories it has been trained on."
              caption={`The head is one number per state — what a value head on a one-hot feature vector is — and it is trained on the returns of the policy it is scoring, which is the circular part of RLHF's critic. The two curves point in opposite directions and both are honest. The loss is ${fmt(
                training.first.loss,
                3,
              )} after the first trajectory, because the head has then reproduced exactly what it was shown, and it ends at ${fmt(
                training.last.loss,
                3,
              )} with a peak of ${fmt(training.peakLoss, 3)}${
                training.peakLoss > training.last.loss + 0.0005 ? ' on the way' : ''
              } — not because the head got worse but because it is now scored against returns it has not memorised. The mean variance of those returns across the six states is ${fmt(
                noiseFloor,
                3,
              )}, and the head's loss ends ${fmt(Math.abs(training.last.loss - noiseFloor), 3)} from it. The error against the truth goes the other way, from ${fmt(
                training.first.error,
                3,
              )} at one trajectory to ${fmt(training.last.error, 3)} at ${trajectories}${
                training.best.seen === training.last.seen
                  ? ''
                  : `; the lowest it reaches anywhere in this run is ${fmt(training.best.error, 3)} at ${
                      training.best.seen
                    }, which is the same lesson in miniature`
              }. A critic report that names the loss and not the error is reporting the first curve.`}
            >
              <TrendChart
                data={head.curve.map((point) => ({
                  x: point.seen,
                  error: point.error,
                  loss: point.loss,
                }))}
                series={[
                  { key: 'error', name: 'error against the true values', colour: 'var(--accent-rose)' },
                  { key: 'loss', name: 'loss against the returns shown', colour: 'var(--accent-teal)' },
                ]}
                xLabel="trajectories the head has been shown"
                yLabel="squared or root-mean-squared error"
                height={280}
              />
            </Figure>

            <Figure
              title="The head, state by state"
              description="Each position in the chain, the exact value of it under the policy, the head's number for it, the residual, and the spread of the returns the head was shown from that position."
              caption={`The value of a state here is the discounted sum of the expected rewards still to come, so the states are not ordered by their own reward: the fifth is worth ${fmt(
                exact[4] ?? 0,
                4,
              )} and the sixth ${fmt(
                exact[5] ?? 0,
                4,
              )}, because the sixth has nothing left to collect. The two right-hand columns are the head's job and its difficulty: it is fitted on sampled returns, so a state is as hard as those returns disagree. The disagreement is smallest at the last position (${fmt(
                spread[5]?.standardDeviation ?? 0,
                4,
              )} — one reward is all the noise there) and largest at position ${hardest.index} (${fmt(
                hardest.point.standardDeviation,
                4,
              )}) where ${exact.length - hardest.index} rewards still to come have every chance to disagree. Across the six positions the head's error tracks that column with correlation ${fmt(
                spreadCorrelation,
                2,
              )}, which is a real but not a reliable signal: six states, and the error at each is itself one draw. What a run needs is the error column, and the head is not equally good everywhere.`}
            >
              <DataTable
                caption="The exact value of each state, the head's number for it, and the disagreement in its training data"
                headers={[
                  'Position',
                  'The exact value',
                  'The head',
                  'The error',
                  'Mean return from here',
                  'Spread of those returns',
                ]}
                rows={exact.map((value, index) => [
                  index,
                  fmt(value, 4),
                  fmt(head.values[index] ?? 0, 4),
                  fmt((head.values[index] ?? 0) - value, 4),
                  fmt(spread[index]?.mean ?? 0, 4),
                  fmt(spread[index]?.standardDeviation ?? 0, 4),
                ])}
              />
            </Figure>

            <Figure
              title="As the head gets more data, what the estimator wants changes"
              description="The head fitted at a ladder of sizes of the same data stream, each scored by the advantage estimator over every trajectory the chain can produce."
              caption={`Each row is a fresh fit stopped earlier on the same stream, so the only thing that changes between them is how many trajectories the head saw. Its error over the rungs runs from ${fmt(
                ladder.rows[0]!.fit.rmse,
                4,
              )} with one trajectory to ${fmt(
                ladder.rows[ladder.rows.length - 1]!.fit.rmse,
                4,
              )} with ${ladder.rows[ladder.rows.length - 1]!.size}, and ${
                ladder.dips === 0
                  ? 'no rung in between is worse than the one before it'
                  : `${ladder.dips} of the rungs in between are worse than the one before them`
              } — the head is a running average over a stream, so more data is not the same as a better head. The λ that the estimator prefers runs between ${fmt(
                ladder.least,
                2,
              )} and ${fmt(ladder.most, 2)} and ${
                ladder.settles ? 'ends below where it started' : 'does not end below where it started'
              }, which is the honest version of the usual claim: ${
                ladder.settles
                  ? 'more data about the critic pulls the preferred trace shorter, but the path is not a monotone one and a pair of endpoints is not a law'
                  : 'the trace does not shorten smoothly, and a pair of endpoints is not a law'
              }. With the exact value of every state in place of the head the answer is ${fmt(
                perfect.bestLambda,
                2,
              )}, and the total error there is ${fmt(perfect.bestMse, 4)}.`}
            >
              <DataTable
                caption="The estimator against the head at each rung of the data ladder"
                headers={[
                  'trajectories shown',
                  'head error',
                  'best λ',
                  'error at λ = 0',
                  'error at λ = 1',
                  'error at the best λ',
                ]}
                rows={ladder.rows.map((rung) => [
                  rung.size,
                  fmt(rung.fit.rmse, 4),
                  rung.scored.bestLambda.toFixed(2),
                  fmt(rung.scored.rows[0]!.mse, 4),
                  fmt(rung.scored.rows[rung.scored.rows.length - 1]!.mse, 4),
                  fmt(rung.scored.bestMse, 4),
                ])}
              />
            </Figure>

            <Callout tone="warning" title="What this says about reporting λ">
              On this chain the λ that minimises the advantage's error moves between {fmt(ladder.least, 2)} and{' '}
              {fmt(ladder.most, 2)} as the head is shown from one trajectory up to {ladder.rows[ladder.rows.length - 1]!.size},
              with the reward landscape, the policy and the objective unchanged — and with an exact critic it is{' '}
              {perfect.bestLambda.toFixed(2)}. A paper that reports λ = 0.95 and nothing about its critic is reporting a
              number that cannot be reproduced, because the thing it was tuned against is missing.
            </Callout>

            <Callout tone="definition" title="The value head in one sentence">
              A head is a trained map from state to one expected number: here a table of six values, in a real pipeline
              a linear layer on the policy network's last hidden state, and in both cases fitted by regressing its own
              output on the returns the current policy produced. It is the same object the advantage is measured against,
              which is why its error reappears in the advantage as bias and why the trace that reaches back further
              reaches back into more of it.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
