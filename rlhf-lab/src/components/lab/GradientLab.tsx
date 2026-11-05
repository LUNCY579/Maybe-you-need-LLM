import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  actionProbs,
  advantage,
  applyStep,
  cloneBandit,
  createBandit,
  expectedReward,
  fisherVectorProduct,
  fisherVectorProductByFiniteDifference,
  klToReference,
  logProbGradient,
  matchedCostComparison,
  meanEntropy,
  naturalGradient,
  rewardLandscape,
  scaledStep,
  sharpen,
  stepCost,
} from '../../core/policy'
import { Button, Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'

type View = 'objective' | 'estimator' | 'natural' | 'trust-region'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const GRADIENT_VIEWS: { value: View; label: string }[] = [
  { value: 'objective', label: 'The objective' },
  { value: 'estimator', label: 'The estimator' },
  { value: 'natural', label: 'The ruler' },
  { value: 'trust-region', label: 'The trust region' },
]
type Direction = 'gradient' | 'natural'

export function GradientLab() {
  const [view, setView] = useViewParam(GRADIENT_VIEWS)
  const [contexts, setContexts] = useState(3)
  const [actions, setActions] = useState(4)
  const [seed, setSeed] = useState(5)
  const [step, setStep] = useState(0)
  const [sharpness, setSharpness] = useState(1)
  const [direction, setDirection] = useState<Direction>('gradient')
  const [rate, setRate] = useState(0.5)
  const [eta, setEta] = useState(0.2)
  const [damping, setDamping] = useState(1)

  const base = useMemo(
    () => sharpen(createBandit(contexts, actions, seed), sharpness),
    [contexts, actions, seed, sharpness],
  )
  const reference = useMemo(() => createBandit(contexts, actions, seed + 100), [contexts, actions, seed])

  const rewards = useMemo(() => rewardLandscape(contexts, actions), [contexts, actions])

  /** The stepping direction: the plain gradient, or the same size bought with the Fisher. */
  const useNatural = view === 'natural' && direction === 'natural'
  const dampingValue = damping / 1000

  /**
   * The policy after `step` optimisation steps, each recomputed from the policy
   * it follows. A step size means a distance only under one of the two rulers,
   * so the count is only comparable within one choice of ruler.
   */
  const bandit = useMemo(() => {
    let policy = base
    for (let taken = 0; taken < step; taken++) {
      const gradient = expectedReward(policy, rewards).gradient
      const delta = useNatural
        ? scaledStep(policy, naturalGradient(policy, gradient, dampingValue), eta)
        : gradient
      policy = applyStep(policy, delta, useNatural ? 1 : rate)
    }
    return policy
  }, [base, rewards, step, useNatural, dampingValue, eta, rate])

  const current = useMemo(() => expectedReward(bandit, rewards), [bandit, rewards])

  /** The exact gradient, against a finite difference on every logit. */
  const gradientCheck = useMemo(() => {
    const epsilon = 1e-6
    const rows: { x: number; exact: number; numerical: number }[] = []
    for (let i = 0; i < bandit.logits.length; i++) {
      const up = cloneBandit(bandit)
      up.logits[i]! += epsilon
      const down = cloneBandit(bandit)
      down.logits[i]! -= epsilon
      const numerical =
        (expectedReward(up, rewards).reward - expectedReward(down, rewards).reward) / (2 * epsilon)
      rows.push({ x: i, exact: current.gradient[i]!, numerical })
    }
    return rows
  }, [bandit, rewards, current])

  /** How the KL and the reward move as the policy is pushed from the reference. */
  const trustRegionSweep = useMemo(() => {
    const rows: { x: number; kl: number; reward: number }[] = []
    for (let t = 0; t <= 20; t++) {
      const stepSize = t * 0.05
      const moved = applyStep(reference, new Array<number>(reference.logits.length).fill(1), stepSize)
      rows.push({
        x: stepSize,
        kl: klToReference(moved, reference).mean,
        reward: expectedReward(moved, rewards).reward,
      })
    }
    return rows
  }, [reference, rewards])

  /** The score-function estimator, against the exact gradient. */
  const estimatorComparison = useMemo(() => {
    const rows: { x: number; exact: number; estimated: number }[] = []
    for (let context = 0; context < contexts; context++) {
      const probs = actionProbs(bandit, context)
      // The estimator's expectation over actions, computed exactly.
      let estimated = 0
      for (let action = 0; action < actions; action++) {
        const gradient = logProbGradient(bandit, context, action)
        const contribution = gradient.reduce((acc, g, j) => acc + g * (current.gradient[context * actions + j] ?? 0), 0)
        estimated += (probs[action] ?? 0) * contribution
      }
      const exact = current.gradient[context * actions] ?? 0
      rows.push({ x: context, exact, estimated })
    }
    return rows
  }, [bandit, contexts, actions, current])

  const worstGradientError = useMemo(
    () =>
      gradientCheck.reduce(
        (worst, row) => Math.max(worst, Math.abs(row.exact - row.numerical)),
        0,
      ),
    [gradientCheck],
  )

  /** The natural direction of the reward, and the advantage it should equal. */
  const natural = useMemo(() => {
    const gradient = current.gradient
    const values = advantage(bandit, rewards)
    const naturalDirection = naturalGradient(bandit, gradient, dampingValue)
    const product = fisherVectorProduct(bandit, values)
    const productOfGradient = fisherVectorProduct(bandit, gradient)
    const numerical = fisherVectorProductByFiniteDifference(bandit, gradient)

    let productResidual = 0
    let finiteDifferenceResidual = 0
    for (let index = 0; index < gradient.length; index++) {
      productResidual = Math.max(productResidual, Math.abs((product[index] ?? 0) - gradient[index]!))
      finiteDifferenceResidual = Math.max(
        finiteDifferenceResidual,
        Math.abs((numerical[index] ?? 0) - (productOfGradient[index] ?? 0)),
      )
    }

    let largestShift = 0
    for (let context = 0; context < bandit.contexts; context++) {
      const start = context * bandit.actions
      const offsets: number[] = []
      for (let action = 0; action < bandit.actions; action++) {
        offsets.push((naturalDirection[start + action] ?? 0) - (values[start + action] ?? 0))
      }
      largestShift = Math.max(largestShift, Math.max(...offsets) - Math.min(...offsets))
    }

    const trial = scaledStep(bandit, naturalDirection, eta)
    const cost = stepCost(bandit, trial)

    return {
      values,
      naturalDirection,
      productResidual,
      finiteDifferenceResidual,
      largestShift,
      cost,
      gain: expectedReward(applyStep(bandit, trial, 1), rewards).reward - current.reward,
    }
  }, [bandit, rewards, current, dampingValue, eta])

  /** The measured KL cost of each direction, once both are scaled to the same Fisher norm. */
  const costCurve = useMemo(() => {
    const rows: { x: number; natural: number; gradient: number; predicted: number }[] = []
    const naturalDirection = naturalGradient(bandit, current.gradient, dampingValue)
    for (let index = 1; index <= 12; index++) {
      const size = index * 0.05
      rows.push({
        x: size,
        natural: stepCost(bandit, scaledStep(bandit, naturalDirection, size)).exact,
        gradient: stepCost(bandit, scaledStep(bandit, current.gradient, size)).exact,
        predicted: (size * size) / 2,
      })
    }
    return rows
  }, [bandit, current, dampingValue])

  /** How far the second-order prediction is from the measurement, at each end of the curve. */
  const expansionError = useMemo(() => {
    const first = costCurve[0]!
    const last = costCurve[costCurve.length - 1]!
    const error = (row: typeof first) => Math.abs(row.natural / row.predicted - 1) * 100
    return { first, last, small: error(first), large: error(last) }
  }, [costCurve])

  /** What one budget buys, direction by direction. */
  const purchases = useMemo(
    () =>
      [0.1, 0.2, 0.3, 0.4].map((size) => ({
        size,
        comparison: matchedCostComparison(bandit, rewards, size, 32, seed),
      })),
    [bandit, rewards, seed],
  )

  /** The row whose η is nearest the one on the slider, for the caption to quote. */
  const nearest = purchases.reduce(
    (best, row) => (Math.abs(row.size - eta) < Math.abs(best.size - eta) ? row : best),
    purchases[0]!,
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory A · The policy gradient"
        subtitle="A policy small enough that every gradient can be checked by hand"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={GRADIENT_VIEWS}
          />
          <Slider
            label="Contexts"
            value={contexts}
            min={1}
            max={8}
            onChange={setContexts}
            hint="How many situations the policy faces."
          />
          <Slider
            label="Actions"
            value={actions}
            min={2}
            max={8}
            onChange={setActions}
            hint="How many things it can do in each."
          />
          <Slider
            label="Sharpness"
            value={sharpness}
            min={1}
            max={12}
            onChange={setSharpness}
            hint="Every logit multiplied: the same preferences, stated more confidently."
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
          {view === 'natural' ? (
            <SegmentedControl
              label="Step"
              value={direction}
              onChange={setDirection}
              options={[
                { value: 'gradient', label: 'Gradient' },
                { value: 'natural', label: 'Natural' },
              ]}
            />
          ) : null}
          {useNatural ? (
            <>
              <Slider
                label="Step size η"
                value={eta}
                min={0.02}
                max={0.6}
                step={0.01}
                onChange={setEta}
                hint="The Fisher norm of the step, so the KL it costs."
              />
              <Slider
                label="Damping"
                value={damping}
                min={1}
                max={20}
                onChange={setDamping}
                hint={`λ = ${fmt(dampingValue, 5)}, added to the Fisher's diagonal. Without it the solve is singular: a shift of every logit in a context costs no distance at all.`}
              />
            </>
          ) : (
            <Slider
              label="Learning rate"
              value={rate}
              min={0}
              max={2}
              step={0.05}
              onChange={setRate}
              hint="A multiple of the raw gradient, in logits."
            />
          )}
          <div className="field">
            <span className="field-label">The policy</span>
            <Button onClick={() => setStep((value) => value + 1)}>
              Take a {useNatural ? 'natural' : 'gradient'} step ({step})
            </Button>
            <Button onClick={() => setStep(0)}>Reset</Button>
          </div>
        </div>

        <div className="stat-row">
          <Stat label="Expected reward" value={fmt(current.reward, 4)} hint="an exact finite sum" />
          <Stat
            label="Worst gradient error"
            value={worstGradientError.toExponential(2)}
            hint="against a central difference"
            tone={worstGradientError < 1e-5 ? 'good' : 'warn'}
          />
          <Stat label="Mean entropy" value={`${fmt(meanEntropy(bandit), 3)} nats`} hint="how spread the policy is" />
          <Stat
            label="KL to the reference"
            value={fmt(klToReference(bandit, reference).mean, 4)}
            hint="how far it has moved"
          />
        </div>

        {view === 'objective' ? (
          <>
            <Figure
              title="The expected reward and its gradient"
              description="For every logit in the policy, the exact analytic gradient of the expected reward against a central finite difference."
              caption="The analytic gradient against a central difference on every logit. The agreement is to the precision of the difference approximation — which is the check that makes everything else in this course trustworthy."
            >
              <DataTable
                caption="The gradient, logit by logit"
                headers={['Logit', 'Exact gradient', 'Central difference', 'Error']}
                rows={gradientCheck.map((row) => [
                  row.x,
                  row.exact.toExponential(4),
                  row.numerical.toExponential(4),
                  Math.abs(row.exact - row.numerical).toExponential(2),
                ])}
              />
            </Figure>

            <Callout tone="definition" title="Why the expected reward is exact here">
              The policy is a softmax over a handful of logits and the action space is small, so the expectation is a
              finite sum over at most eight terms. There is no sampling, no Monte Carlo and no approximation — which is
              what makes it possible to check the gradient to the last digit.
            </Callout>
          </>
        ) : null}

        {view === 'estimator' ? (
          <>
            <Figure
              title="The score-function estimator against the exact gradient"
              description="For each context, the gradient computed by the score-function identity and the gradient computed directly from the finite sum."
              caption="The identity ∇E_π[r] = E_π[r·∇log π] recomputed exactly, term by term. The estimator is not an approximation here: on a finite problem its expectation can be evaluated in closed form."
            >
              <DataTable
                caption="The estimator, context by context"
                headers={['Context', 'The first logit’s exact gradient', 'The estimator']}
                rows={estimatorComparison.map((row) => [
                  row.x,
                  row.exact.toExponential(5),
                  row.estimated.toExponential(5),
                ])}
              />
            </Figure>

            <Callout tone="note" title="What the estimator buys">
              On a policy with thousands of actions and a vocabulary of tens of thousands, the sum is not available and
              the expectation has to be estimated from the samples that were drawn. The identity is what makes that
              substitution legal — and the price is variance, which is what the value function is there to reduce.
            </Callout>
          </>
        ) : null}

        {view === 'natural' ? (
          <>
            <div className="stat-row">
              <Stat
                label="η, the step size"
                value={fmt(eta, 3)}
                hint="a Fisher norm, so a distance rather than a length"
              />
              <Stat
                label="What the natural step cost"
                value={fmt(natural.cost.exact, 5)}
                hint={`the prediction is ${fmt(natural.cost.predicted, 5)}`}
              />
              <Stat
                label="What it earned"
                value={fmt(natural.gain, 5)}
                hint="the rise in expected reward, one step"
              />
              <Stat
                label="Fisher-vector product"
                value={natural.finiteDifferenceResidual.toExponential(2)}
                hint="exact against a finite difference"
                tone={natural.finiteDifferenceResidual < 1e-6 ? 'good' : 'warn'}
              />
            </div>

            <Figure
              title="What a step size actually costs"
              description="Both directions are scaled until their Fisher norm is η, and then the KL they actually produce is measured. η²/2 is what a second-order expansion says the cost should be."
              caption={`Two directions scaled to the same Fisher norm predict the same cost, and at η = ${fmt(expansionError.first.x, 2)} the measurement is ${fmt(expansionError.small, 1)} per cent away from the prediction. By η = ${fmt(expansionError.last.x, 2)} it is ${fmt(expansionError.large, 1)} per cent away, and pulling the sharpness slider moves it further still: a peaked policy costs far more than the expansion promises at the same η. The expansion is a local statement, which is why a trust region is enforced by measuring the distance rather than by trusting the arithmetic.`}
            >
              <TrendChart
                data={costCurve}
                series={[
                  { key: 'natural', name: 'the natural direction', colour: 'var(--accent-teal)' },
                  { key: 'gradient', name: 'the gradient direction', colour: 'var(--accent-amber)' },
                  { key: 'predicted', name: 'η²/2, the prediction', colour: 'var(--accent-rose)' },
                ]}
                xLabel="η, the Fisher norm of the step"
                yLabel="the KL actually cost"
                height={280}
              />
            </Figure>

            <Figure
              title="One distance, three directions"
              description="For each η the natural step is measured, and then every other direction is rescaled until it costs exactly that much. The best random direction is the winner over 32 draws."
              caption={
                purchases.every((row) => row.comparison.naturalBeatsAll)
                  ? `At the same measured distance the natural step wins on every row, and it beat all 32 random directions each time. That is the whole claim of a trust region: not a better objective, the same objective with the right ruler, which makes "the biggest step that stays inside" a direction rather than a guess. The lengths are the other half of it: at η = ${fmt(nearest.size, 2)} the natural step is ${fmt(nearest.comparison.naturalLength / nearest.comparison.vanillaLength, 2)} times as long in logits as the gradient step bought with the same distance, and it is longer at every η here, because the gradient vanishes where the policy is unsure and the advantage does not.`
                  : 'At the same measured distance the natural step leads on most rows but not all — the comparison is with a finite sample of random directions and a second-order budget, so a draw can beat it by more than the prediction allows.'
              }
            >
              <DataTable
                caption="The reward gained for the KL spent"
                headers={[
                  'η',
                  'the distance cost',
                  'gain, natural',
                  'logits moved, natural',
                  'gain, gradient',
                  'logits moved, gradient',
                  'gain, best of 32 random',
                  'natural wins',
                ]}
                rows={purchases.map((row) => [
                  fmt(row.size, 2),
                  fmt(row.comparison.budget, 5),
                  fmt(row.comparison.naturalGain, 5),
                  fmt(row.comparison.naturalLength, 4),
                  fmt(row.comparison.vanillaGain, 5),
                  fmt(row.comparison.vanillaLength, 4),
                  fmt(row.comparison.bestRandomGain, 5),
                  row.comparison.naturalBeatsAll ? 'yes' : 'no',
                ])}
              />
            </Figure>

            <Figure
              title="The direction the solve finds, against the advantage"
              description="The natural gradient of the expected reward, and r(a) minus the reward the policy expects, logit by logit."
              caption={`The two columns differ by a constant inside each context — the largest spread between them is ${fmt(natural.largestShift, 5)} at λ = ${fmt(dampingValue, 5)}, and a constant added to one context's logits leaves its probabilities untouched. So the natural gradient of a reward is the advantage, and it is the same direction the KL penalty tilts a policy by.`}
            >
              <DataTable
                caption="Natural direction and advantage, per logit"
                headers={['Context', 'Action', 'Natural direction', 'The advantage', 'Difference', 'π']}
                rows={natural.naturalDirection.map((value, index) => {
                  const context = Math.floor(index / bandit.actions)
                  const action = index % bandit.actions
                  return [
                    context,
                    action,
                    fmt(value, 4),
                    fmt(natural.values[index] ?? 0, 4),
                    fmt(value - (natural.values[index] ?? 0), 4),
                    fmt(actionProbs(bandit, context)[action] ?? 0, 3),
                  ]
                })}
              />
            </Figure>

            <Callout tone="definition" title="Why the ruler is the whole story">
              Maximise the linear gain gᵀδ subject to δᵀFδ ≤ 2ε and the solution is δ ∝ F⁻¹g — the gradient read
              through the metric. Nothing about the reward changed; what changed is the meaning of "as far as I can
              go". The residual of the identity the table rests on, F·(r − E[r]) − g, is{' '}
              {natural.productResidual.toExponential(2)}: the advantage is a direction the Fisher maps exactly onto
              the gradient, which is why the solve returns it.
            </Callout>

            <Callout tone="note" title="Why nobody forms the Fisher">
              A transformer has billions of parameters; F is that size squared and cannot be stored, let alone
              inverted. The product above is computed by finite differences — two evaluations of the policy at θ ± εv,
              no matrix anywhere — which is the trick that makes a natural step affordable, and the reason the
              conjugate-gradient solve in the original algorithm needs only the product.
            </Callout>
          </>
        ) : null}

        {view === 'trust-region' ? (
          <>
            <Figure
              title="How far a step moves the policy"
              description="The KL distance from the reference and the expected reward, as the step size grows."
              caption="The step size on the horizontal axis, the KL distance it produces, and the reward it earns. The reward keeps rising; the KL grows quadratically at first. The point at which the samples stop describing the policy is the point the constraint exists to mark."
            >
              <TrendChart
                data={trustRegionSweep}
                series={[
                  { key: 'reward', name: 'the expected reward', colour: 'var(--accent-teal)' },
                  { key: 'kl', name: 'the KL distance', colour: 'var(--accent-rose)' },
                ]}
                xLabel="the step size"
                yLabel="value"
                height={280}
              />
            </Figure>

            <Callout tone="warning" title="The failure this prevents">
              The importance ratio corrects for the policy having moved — but only while the two policies are close. A
              step that moves the policy a long way makes the collected samples a poor description of the new policy,
              and the estimate becomes wrong in a way that looks like a slow loss curve rather than an error.
            </Callout>
          </>
        ) : null}

        <Callout tone="note" title="What these numbers are">
          The policy is a softmax over {contexts} contexts × {actions} actions, seeded and therefore fixed; the reward
          landscape is constructed rather than learned, so the optimum is in the interior and the curvature is uneven.
          Every figure on this screen is an exact finite sum over that landscape — the only approximations are the
          finite differences, which are measured and shown above.
        </Callout>
      </Panel>
    </div>
  )
}
