import { useMemo, useState } from 'react'
import { createRng, fmt } from '@llm-materials/course-core'
import {
  activeParameterFraction,
  capacityOverflow,
  deadZoneSteps,
  fairShare,
  firstMovedStep,
  idealExperts,
  lambdaSweep,
  largestRise,
  loadBalanceLoss,
  lossCurve,
  route,
  routeByNeed,
  routingInstability,
  sparseSpeedup,
  trainLoadBalancer,
} from '../../core/moe'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { MOE_DEFAULTS } from '../../content/labDefaults'

type View = 'routing' | 'capacity' | 'balance' | 'spike'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const MOE_VIEWS: { value: View; label: string }[] = [
  { value: 'routing', label: 'The router' },
  { value: 'capacity', label: 'The capacity' },
  { value: 'balance', label: 'The loss' },
  { value: 'spike', label: 'The spike' },
]

const CAPACITY_LADDER = [1, 1.1, 1.25, 1.5, 2, 2.5, 3]
const SWEEP_LAMBDAS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6]
const DEAD_ZONE_LAMBDAS = [0.05, 0.1, 0.15, 0.2, 0.3]
/** Long enough to see the argmax move at every gain the table below offers. */
const DEAD_ZONE_STEPS = 150

function percent(fraction: number): string {
  return `${fmt(fraction * 100, 1)}%`
}

export function MoeLab() {
  const [view, setView] = useViewParam(MOE_VIEWS)
  const [experts, setExperts] = useState(MOE_DEFAULTS.experts)
  const [topK, setTopK] = useState(MOE_DEFAULTS.topK)
  const [tokens, setTokens] = useState(MOE_DEFAULTS.tokens)
  const [bias, setBias] = useState(MOE_DEFAULTS.bias)
  const [capacityFactor, setCapacityFactor] = useState(MOE_DEFAULTS.capacityFactor)
  const [perSlot, setPerSlot] = useState(true)
  const [lambda, setLambda] = useState(MOE_DEFAULTS.lambda)
  const [concentration, setConcentration] = useState(MOE_DEFAULTS.concentration)
  const [steps, setSteps] = useState(MOE_DEFAULTS.steps)
  const [seed, setSeed] = useState(MOE_DEFAULTS.seed)

  const embeddings = useMemo(() => {
    const rng = createRng(seed)
    return Array.from({ length: tokens }, () => Array.from({ length: 6 }, () => rng() * 2 - 1))
  }, [tokens, seed])

  const routing = useMemo(
    () => route(embeddings, { experts, topK, seed, bias }),
    [embeddings, experts, topK, seed, bias],
  )
  const balanceLoss = useMemo(
    () => loadBalanceLoss(routing.load, routing.probability, { topK }),
    [routing, topK],
  )
  const overflow = useMemo(
    () => capacityOverflow(routing.load, capacityFactor, { tokens, topK, perSlot }),
    [routing, capacityFactor, tokens, topK, perSlot],
  )

  const fair = fairShare(experts, topK)
  const slotReading: 'slot' | 'token' = perSlot ? 'slot' : 'token'
  const assignments = tokens * topK
  const reserved = overflow.capacity.reduce((a, b) => a + b, 0)
  const held = assignments - Math.round(overflow.droppedFraction * assignments)

  return (
    <div className="lab">
      <Panel
        title="Laboratory C · Sparse capacity"
        subtitle="More experts, fewer of them used, and the balance that keeps it honest"
        accent="amber"
      >
        <div className="lab-controls">
          <SegmentedControl label="View" value={view} onChange={setView} options={MOE_VIEWS} />
          <Slider label="The experts" value={experts} min={2} max={16} onChange={setExperts} />
          <Slider label="The experts per token" value={topK} min={1} max={4} onChange={setTopK} />
          <Slider label="The tokens" value={tokens} min={40} max={600} step={20} onChange={setTokens} />
          <Slider
            label="The capacity factor"
            value={capacityFactor}
            min={1}
            max={3}
            step={0.05}
            onChange={setCapacityFactor}
            format={(value) => value.toFixed(2)}
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
          {view === 'capacity' ? (
            <SegmentedControl
              label="The factor is counted"
              value={slotReading}
              onChange={(value) => setPerSlot(value === 'slot')}
              options={[
                { value: 'slot', label: 'per slot' },
                { value: 'token', label: 'per token' },
              ]}
            />
          ) : null}
          {view === 'spike' ? (
            <>
              <Slider
                label="The gain λ"
                value={lambda}
                min={0}
                max={0.6}
                step={0.01}
                onChange={setLambda}
                format={(value) => value.toFixed(2)}
                hint="The coefficient on the balance loss. A model’s papers quote one; here it is the controller’s gain, and it has a threshold."
              />
              <Slider
                label="How skewed the needs are"
                value={concentration}
                min={0}
                max={1.5}
                step={0.05}
                onChange={setConcentration}
                format={(value) => value.toFixed(2)}
                hint="How strongly the tokens favour a few experts. At zero the data itself is balanced."
              />
              <Slider
                label="The correction steps"
                value={steps}
                min={5}
                max={60}
                onChange={setSteps}
                hint="How long the controller runs before the measurement is taken."
              />
            </>
          ) : (
            <Slider
              label="The router’s bias"
              value={bias}
              min={0}
              max={4}
              step={0.25}
              onChange={setBias}
              format={(value) => value.toFixed(2)}
              hint="How unevenly the router is rigged to be: added to the even experts’ scores, taken off the odd ones."
            />
          )}
        </div>

        {view === 'routing' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The busiest expert"
                value={percent(routing.maxLoad)}
                tone={routing.maxLoad > fair * 1.5 ? 'warn' : 'good'}
              />
              <Stat
                label="The quietest expert"
                value={percent(routing.minLoad)}
                tone={routing.minLoad < fair * 0.25 ? 'warn' : 'good'}
              />
              <Stat label="The fair share" value={percent(fair)} hint="of the tokens, per expert" />
              <Stat label="The auxiliary loss" value={fmt(routing.auxiliaryLoss, 2)} />
            </div>

            <Figure
              title="What each expert received"
              description="The fraction of the tokens each expert got, and the fraction of the routing probability it was given."
              caption="When the two agree, the router sent the tokens where it said it would. When they do not, some experts are trained more than the router intended, and the loss says so."
            >
              <DataTable
                caption="The load of each expert"
                headers={['The expert', 'The tokens it got', 'Its share of the tokens', 'The probability', 'The difference']}
                rows={routing.load.map((load, index) => {
                  const probability = routing.probability[index] ?? 0
                  return [
                    index,
                    Math.round(load * tokens),
                    percent(load),
                    percent(probability),
                    `${fmt((load - probability) * 100, 1)} points`,
                  ]
                })}
              />
            </Figure>

            <Figure
              title="The arithmetic the sparsity saves"
              description="How many experts the model has, and how many it uses in a step."
              caption="A model with eight experts and a top-k of two keeps eight times the parameters and does twice the work. That is the trade, and the balance is the price of it."
            >
              <DataTable
                caption="The trade"
                headers={['The quantity', 'The value']}
                rows={[
                  ['the experts', experts],
                  ['the experts used per token', topK],
                  ['the tokens', tokens],
                  ['the assignments the batch makes', assignments],
                  ['the arithmetic saved', `${fmt(sparseSpeedup(experts, topK), 2)}× less than the dense model`],
                  ['the fraction of the parameters used in a step', percent(activeParameterFraction(experts, topK))],
                ]}
              />
            </Figure>

            <Callout tone="note" title="What the router sees">
              The router is a small linear map from the embedding to one score per expert, and the tokens go to the
              experts with the highest scores. Everything the sparsity depends on — how evenly the tokens are spread,
              and whether the experts are the ones the tokens need — is decided by those scores.
            </Callout>

            <Callout tone="definition" title="The load does not add up to one">
              With top-k of {topK} each token is counted at {topK} experts, so the shares above sum to{' '}
              {fmt(topK, 2)} and the fair share of an expert is {topK} over {experts}, not one over {experts}. The
              capacity view is where that difference is paid for.
            </Callout>
          </>
        ) : null}

        {view === 'capacity' ? (
          <>
            <div className="stat-row">
              <Stat label="The fair share" value={percent(fair)} hint="of the tokens, per expert" />
              <Stat
                label="Each expert’s capacity"
                value={`${overflow.capacity[0] ?? 0} slots`}
                hint={`the factor ${fmt(capacityFactor, 2)} read ${perSlot ? 'per slot' : 'per token'}`}
              />
              <Stat
                label="The assignments dropped"
                value={percent(overflow.droppedFraction)}
                tone={overflow.droppedFraction > 0.05 ? 'warn' : 'good'}
              />
              <Stat
                label="The slots that wait empty"
                value={`${Math.max(0, reserved - held)} of ${reserved}`}
                tone={reserved - held > reserved * 0.2 ? 'warn' : 'good'}
              />
            </div>

            <Figure
              title="Every expert, its capacity, and what overflows it"
              description="The tokens each expert was sent, the slots it is allowed, and the assignments that had to be thrown away."
              caption="The capacity is a hard limit: an expert takes its multiple of the fair share and no more, and the tokens past it are dropped rather than queued. They are exactly the tokens the imbalance created."
            >
              <DataTable
                caption="The capacity"
                headers={['The expert', 'The tokens it was sent', 'Its capacity', 'The overflow', 'The fill']}
                rows={routing.load.map((load, index) => {
                  const sent = Math.round(load * tokens)
                  const capacity = overflow.capacity[index] ?? 0
                  return [index, sent, capacity, overflow.overflow[index] ?? 0, percent(sent / capacity)]
                })}
              />
            </Figure>

            <Figure
              title="What the factor buys, and what it costs"
              description="The dropped assignments and the idle slots, at each capacity factor."
              caption="The two move in opposite directions, which is the whole difficulty: a tight factor throws away the tokens the router cannot place, and a loose one reserves memory for experts that then sit idle. The knee is where the router’s own imbalance ends — past it there is room for everything and nothing is wasted only because the factor is generous."
            >
              <TrendChart
                data={CAPACITY_LADDER.map((factor) => {
                  const run = capacityOverflow(routing.load, factor, { tokens, topK })
                  const reserve = run.capacity.reduce((a, b) => a + b, 0)
                  const kept = assignments - Math.round(run.droppedFraction * assignments)
                  return {
                    x: factor,
                    dropped: run.droppedFraction * 100,
                    idle: (100 * (reserve - kept)) / Math.max(1, reserve),
                  }
                })}
                series={[
                  { key: 'dropped', name: 'the assignments dropped', colour: 'var(--accent-rose)' },
                  { key: 'idle', name: 'the reserved slots left empty', colour: 'var(--accent-teal)' },
                ]}
                xLabel="the capacity factor"
                yLabel="per cent"
                height={260}
              />
            </Figure>

            <Figure
              title="Per slot, or per token"
              description="The same perfectly even top-k router, with the factor read the two ways."
              caption="The capacity is counted in assignments, not in tokens: a token sent to two experts occupies two slots. Read the factor per token and a balanced top-2 router at factor one drops half of its assignments for no reason at all — which is why the implementations scale the factor by k."
            >
              <DataTable
                caption="The two readings of the factor"
                headers={['The factor', 'Read per slot', 'Read per token', 'The even load it is applied to']}
                rows={[1, 1.25, 1.5, 2].map((factor) => {
                  const even = new Array<number>(experts).fill(fair)
                  const slot = capacityOverflow(even, factor, { tokens, topK, perSlot: true })
                  const token = capacityOverflow(even, factor, { tokens, topK, perSlot: false })
                  return [
                    fmt(factor, 2),
                    percent(slot.droppedFraction),
                    percent(token.droppedFraction),
                    percent(fair),
                  ]
                })}
              />
            </Figure>

            <Callout tone="warning" title="The bargain">
              The capacity factor and the auxiliary loss are two halves of the same bargain. The loss asks the router to
              be even; the factor says what happens when it is not. Setting the factor too low drops tokens; setting it
              too high lets one expert do the work of the others while every expert reserves memory for a share it never
              receives — and the model carries experts it never trains.
            </Callout>
          </>
        ) : null}

        {view === 'balance' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The balance loss"
                value={fmt(balanceLoss, 4)}
                hint="one is a balanced router"
                tone={balanceLoss > 1.1 ? 'warn' : 'good'}
              />
              <Stat label="The excess over one" value={fmt(balanceLoss - 1, 4)} />
              <Stat label="The raw auxiliary loss" value={fmt(routing.auxiliaryLoss, 2)} />
              <Stat
                label="The spread of the load"
                value={`${fmt((routing.maxLoad - routing.minLoad) * 100, 1)} points`}
              />
            </div>

            <Figure
              title="The loss against the imbalance"
              description="The normalised balance loss as the router is rigged to be more and more uneven."
              caption="The loss is the number of tokens times the sum of the products of each expert’s load and its probability, and it is smallest when the two agree. Adding it to the training loss pushes the router there."
            >
              <TrendChart
                data={[0, 0.25, 0.5, 1, 1.5, 2, 3, 4].map((amount) => {
                  const run = route(embeddings, { experts, topK, seed, bias: amount })
                  return { x: amount, balance: loadBalanceLoss(run.load, run.probability, { topK }) }
                })}
                series={[{ key: 'balance', name: 'the balance loss', colour: 'var(--accent-amber)' }]}
                xLabel="the router’s bias"
                yLabel="the loss, normalised"
                yDomain={[0.8, 'auto']}
                referenceLines={[{ y: 1, label: 'a perfectly balanced router' }]}
                height={260}
              />
            </Figure>

            <Figure
              title="The two forms, and the constant between them"
              description="What each paper scales the product by, and what this screen prints."
              caption="The gradient is the same in both; only the constant in front differs, so the coefficient means a different number in each paper. The raw product here is the normalised loss times the number of tokens times top-k — which is why a coefficient that is right for a batch of one size is wrong for another."
            >
              <DataTable
                caption="The same quantity, three scalings"
                headers={['The form', 'At perfect balance', 'This batch']}
                rows={[
                  ['the raw product, GShard’s and this screen’s', fmt(fair, 4), fmt(routing.auxiliaryLoss, 2)],
                  [
                    'normalised so that balance is one',
                    '1',
                    fmt(balanceLoss, 4),
                  ],
                  [
                    'the excess the coefficient is applied to',
                    '0',
                    fmt(balanceLoss - 1, 4),
                  ],
                  ['raw ÷ (tokens × top-k)', fmt(fair, 4), fmt(routing.auxiliaryLoss / (tokens * topK), 4)],
                ]}
              />
            </Figure>

            <Callout tone="note" title="What the loss cannot see">
              The loss is a function of the load and the probabilities alone, so every router it calls balanced is
              equally good as far as it is concerned — including one that has sent every token to the wrong expert.
              The spike view puts a need behind each token so that the trade is visible.
            </Callout>
          </>
        ) : null}

        {view === 'spike' ? (
          <SpikeView
            experts={experts}
            topK={topK}
            tokens={tokens}
            capacityFactor={capacityFactor}
            lambda={lambda}
            concentration={concentration}
            steps={steps}
            seed={seed}
          />
        ) : null}
      </Panel>
    </div>
  )
}

/**
 * The controller, run for the reader.
 *
 * This is the need router rather than the embedding router: the tokens have an
 * expert each, drawn from a skewed distribution the screen plants, so the
 * balance the loss wants and the accuracy the data wants are two different
 * numbers and both are on the table. It is a separate component because the tab
 * runs the controller eighteen times over — the panel's own run, the gain sweep,
 * the dead-zone table and the top-1 pair — and a reader on the router tab has no
 * reason to wait for them.
 */
function SpikeView({
  experts,
  topK,
  tokens,
  capacityFactor,
  lambda,
  concentration,
  steps,
  seed,
}: {
  experts: number
  topK: number
  tokens: number
  capacityFactor: number
  lambda: number
  concentration: number
  steps: number
  seed: number
}) {
  const trained = useMemo(
    () => trainLoadBalancer({ tokens, experts, topK, capacityFactor, lambda, steps, concentration, seed }),
    [tokens, experts, topK, capacityFactor, lambda, steps, concentration, seed],
  )
  const curve = useMemo(() => lossCurve(trained.steps, { lambda }), [trained, lambda])
  const spike = useMemo(() => largestRise(curve), [curve])

  const first = trained.steps[0]!
  const last = trained.steps[trained.steps.length - 1]!

  const sweep = useMemo(
    () =>
      lambdaSweep({
        tokens,
        experts,
        topK,
        capacityFactor,
        steps,
        concentration,
        seed,
        lambdas: SWEEP_LAMBDAS,
      }),
    [tokens, experts, topK, capacityFactor, steps, concentration, seed],
  )
  // The closed form below is a top-1 statement: at top-2 a token's second slot is
  // whichever expert holds the largest bias, so the ordering changes on step one
  // and there is no dead zone to predict.
  const top1Spread = useMemo(() => {
    const ideals = idealExperts(tokens, experts, concentration, seed)
    const uncorrected = routeByNeed(ideals, experts, new Array<number>(experts).fill(0), 1)
    return uncorrected.maxLoad - uncorrected.minLoad
  }, [tokens, experts, concentration, seed])
  const deadZone = useMemo(
    () =>
      DEAD_ZONE_LAMBDAS.map((gain) => ({
        lambda: gain,
        predicted: deadZoneSteps(top1Spread, gain),
        measured: firstMovedStep({
          tokens,
          experts,
          topK: 1,
          capacityFactor,
          concentration,
          seed,
          lambda: gain,
          steps: DEAD_ZONE_STEPS,
        }),
      })),
    [tokens, experts, capacityFactor, concentration, seed, top1Spread],
  )
  const pair = useMemo(
    () => routingInstability({ tokens, experts, capacityFactor, lambda, steps, concentration, seed }),
    [tokens, experts, capacityFactor, lambda, steps, concentration, seed],
  )
  const top2MovesAt = useMemo(
    () => firstMovedStep({ tokens, experts, topK: 2, capacityFactor, concentration, seed, lambda, steps }),
    [tokens, experts, capacityFactor, concentration, seed, lambda, steps],
  )

  return (
    <>
      <div className="stat-row">
        <Stat label="The spike in the loss" value={fmt(spike, 3)} tone={spike > 0.5 ? 'warn' : 'good'} />
        <Stat
          label="The balance loss"
          value={fmt(last.balanceLoss, 4)}
          hint={`it began at ${fmt(first.balanceLoss, 4)}`}
          tone={last.balanceLoss > first.balanceLoss ? 'warn' : 'good'}
        />
        <Stat
          label="The tokens served as they need"
          value={percent(last.accuracy)}
          tone={last.accuracy < 0.9 ? 'warn' : 'good'}
        />
        <Stat
          label="The assignments dropped"
          value={percent(last.droppedFraction)}
          tone={last.droppedFraction > 0.25 ? 'warn' : 'good'}
        />
        <Stat label="The controller" value={trained.oscillates ? 'swings' : 'settles'} tone={trained.oscillates ? 'warn' : 'good'} />
      </div>

      <Figure
        title="The loss the correction makes"
        description="The three terms of the loss, step by step, and their sum."
        caption="The misroute term is what the tokens that did not reach the expert they needed cost, the drop term what the assignments the capacity threw away cost, and the balance term λ times the excess over one. The first two are the task and the third is the correction, and the spike is what happens when the correction moves the load faster than the task can absorb it."
      >
        <TrendChart
          data={curve.map((point) => ({
            x: point.step,
            loss: point.loss,
            misroute: point.misroutePenalty,
            drop: point.dropPenalty,
            balance: point.balancePenalty,
          }))}
          series={[
            { key: 'loss', name: 'the loss', colour: 'var(--accent-amber)' },
            { key: 'misroute', name: 'the misrouted tokens', colour: 'var(--accent-rose)' },
            { key: 'drop', name: 'the dropped assignments', colour: 'var(--accent-teal)', dashed: true },
            { key: 'balance', name: 'λ times the imbalance', colour: 'var(--accent-indigo)' },
          ]}
          xLabel="the correction step"
          yLabel="the loss"
          height={280}
        />
      </Figure>

      <Figure
        title="Nothing moves, and then everything does"
        description="Each correction step: the balance loss, which expert holds the most, its load, the emptiest expert, and the accuracy."
        caption="Above zero the balance loss moves at every step. Read the columns to its right at top-1 and nothing has happened at all: the load, the busiest expert and the accuracy are the same row over and over, because the loss is a product of the load with the probabilities and only the probabilities are smooth. When the argmax does give, one step changes all three at once, and the row that follows it is different from every row before."
      >
        <DataTable
          caption="Every correction step"
          headers={[
            'The step',
            'The balance loss',
            'The busiest expert',
            'Its load',
            'The quietest',
            'The tokens served as they need',
            'The assignments dropped',
          ]}
          rows={trained.steps.map((step) => [
            step.step,
            fmt(step.balanceLoss, 4),
            step.busiest,
            percent(step.maxLoad),
            percent(step.minLoad),
            percent(step.accuracy),
            percent(step.droppedFraction),
          ])}
        />
      </Figure>

      <Figure
        title="The delay has a closed form"
        description="How many steps the top-1 router takes no decision at all: predicted from the gain and the spread of the load, and measured by re-running until an assignment changes."
        caption={`A token’s score for the expert it needed beats the others by one, so the relative bias has to reach one before any token changes hands. The busiest expert’s bias falls by λ times its excess over the fair share each step and the quietest’s rises by λ times its deficit, which closes the gap at λ times the spread — and the reciprocal is the number of steps the router appears to be doing nothing. It is exact to one step at every gain, which is the reason a small coefficient looks safe rather than being safe. The same run at top-2 moves on step ${top2MovesAt ?? 'nothing'}, because a token’s second slot is simply the largest bias among the others.`}
      >
        <DataTable
          caption="The dead zone of a top-1 router at each gain"
          headers={['The gain λ', 'The steps the prediction gives', 'The step an assignment first changes', 'What a run of this length sees']}
          rows={deadZone.map((entry) => [
            fmt(entry.lambda, 2),
            Number.isFinite(entry.predicted) ? fmt(entry.predicted, 1) : 'never',
            entry.measured === null ? `nothing in ${DEAD_ZONE_STEPS}` : String(entry.measured),
            entry.measured === null ? 'a flat line' : `the jump at ${entry.measured}`,
          ])}
        />
      </Figure>

      <Figure
        title="What a coefficient buys"
        description="The same run at each gain: the imbalance it ends with, the accuracy it pays, and whether it settles or swings."
        caption="Below the threshold the loss falls and nothing else changes. Past it the controller crosses its own dead band, and the balance it ends with is worse than the one it started from while the accuracy has gone. The papers quote a small coefficient, and this is the shape they are quoting around."
      >
        <TrendChart
          data={sweep.map((entry) => ({
            x: entry.lambda,
            balance: entry.balanceLoss,
            accuracy: entry.accuracy,
            dropped: entry.droppedFraction,
          }))}
          series={[
            { key: 'balance', name: 'the balance loss', colour: 'var(--accent-amber)' },
            { key: 'accuracy', name: 'the tokens served as they need', colour: 'var(--accent-emerald)' },
            { key: 'dropped', name: 'the assignments dropped', colour: 'var(--accent-rose)' },
          ]}
          xLabel="the gain λ"
          yLabel="the fraction, or the loss"
          height={280}
        />
      </Figure>

      <Figure
        title="Top-1 against top-2, at the same gain"
        description="The same tokens, needs, capacity factor and coefficient — only the number of experts each token is sent to differs."
        caption="The second slot piles on: uncorrected, a top-2 router puts every token into its busiest expert as one of its two choices, and drops twice the assignments at the same factor. The correction is gentler on it, because a token that loses its second slot has not lost the expert it needed — so the loop gain is lower and the coefficient that makes the top-1 curve spike barely moves this one."
      >
        <DataTable
          caption="The two routers, first step and last"
          headers={[
            'The router',
            'Its busiest expert at the first step',
            'Its load then',
            'The assignments dropped then',
            'Its load at the last step',
            'The accuracy at the last step',
            'The spike',
            'Settles or swings',
          ]}
          rows={[
            [
              'top-1',
              pair.top1.steps[0]?.busiest ?? 0,
              percent(pair.top1.steps[0]?.maxLoad ?? 0),
              percent(pair.top1.steps[0]?.droppedFraction ?? 0),
              percent(pair.top1.steps[pair.top1.steps.length - 1]?.maxLoad ?? 0),
              percent(pair.top1.steps[pair.top1.steps.length - 1]?.accuracy ?? 0),
              fmt(pair.top1.spike, 3),
              pair.top1.oscillates ? 'swings' : 'settles',
            ],
            [
              'top-2',
              pair.top2.steps[0]?.busiest ?? 0,
              percent(pair.top2.steps[0]?.maxLoad ?? 0),
              percent(pair.top2.steps[0]?.droppedFraction ?? 0),
              percent(pair.top2.steps[pair.top2.steps.length - 1]?.maxLoad ?? 0),
              percent(pair.top2.steps[pair.top2.steps.length - 1]?.accuracy ?? 0),
              fmt(pair.top2.spike, 3),
              pair.top2.oscillates ? 'swings' : 'settles',
            ],
          ]}
        />
      </Figure>

      <Callout tone="warning" title="The spike is a control problem">
        A proportional controller with a gain too high for the delay in its own loop overshoots, and the delay here is
        the argmax: the bias moves smoothly, the decision does not move at all until the bias crosses the gap between
        needing an expert and not needing it. Nothing in this run is specific to a language model. At the last step{' '}
        {percent(last.accuracy)} of the {tokens} tokens reach the expert they needed, after a loss that had been falling
        for {fmt(trained.steps.length - 1, 0)} steps.
      </Callout>

      <Callout tone="definition" title="What the papers claim, and what this shows">
        Switch’s simplified top-1 routing is the same trade taken to its end: one expert per token, so the capacity
        arithmetic is the whole of the routing, and the load-balancing loss is the only thing keeping the experts
        trained. What this screen adds to that claim is a number for when the loss stops working — and the accuracy
        column is where it shows, which the balance loss alone never reports.
      </Callout>
    </>
  )
}
