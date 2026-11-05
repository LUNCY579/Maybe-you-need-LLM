import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  acceptanceRate,
  chainOfSameCost,
  closedFormAcceptanceRate,
  crossoverAcceptance,
  expectedAcceptedTokens,
  measuredOutputDistribution,
  medusaHeads,
  perturbed,
  simulateMedusa,
  simulateSpeculative,
  simulateTreeSpeculative,
  speculativeDistribution,
  treeNodes,
} from '../../core/speculative'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { SPECULATIVE_DEFAULTS } from '../../content/labDefaults'

type View = 'acceptance' | 'speedup' | 'tree' | 'medusa'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const SPECULATIVE_VIEWS: { value: View; label: string }[] = [
  { value: 'acceptance', label: 'The rule' },
  { value: 'speedup', label: 'The speed-up' },
  { value: 'tree', label: 'The tree' },
  { value: 'medusa', label: 'The heads' },
]

/** A target with five symbols: enough for a distribution to have a shape. */
const TARGET = [0.34, 0.26, 0.18, 0.12, 0.1]

function percent(fraction: number): string {
  return `${fmt(fraction * 100, 1)}%`
}

export function SpeculativeLab() {
  const [view, setView] = useViewParam(SPECULATIVE_VIEWS)
  const [noise, setNoise] = useState(SPECULATIVE_DEFAULTS.noise)
  const [draftLength, setDraftLength] = useState(SPECULATIVE_DEFAULTS.draftLength)
  const [draftCost, setDraftCost] = useState(SPECULATIVE_DEFAULTS.draftCost)
  const [depth, setDepth] = useState(SPECULATIVE_DEFAULTS.depth)
  const [width, setWidth] = useState(SPECULATIVE_DEFAULTS.width)
  const [heads, setHeads] = useState(SPECULATIVE_DEFAULTS.heads)
  const [headNoise, setHeadNoise] = useState(SPECULATIVE_DEFAULTS.headNoise)
  const [seed, setSeed] = useState(SPECULATIVE_DEFAULTS.seed)

  const draft = useMemo(() => perturbed(TARGET, noise, seed + 1), [noise, seed])

  const measured = useMemo(() => acceptanceRate(draft, TARGET, { seed, trials: 4000 }), [draft, seed])
  const closed = useMemo(() => closedFormAcceptanceRate(draft, TARGET), [draft])

  const simulation = useMemo(
    () => simulateSpeculative(TARGET, { draftLength, draftCost, seed, steps: 400, draftNoise: noise }),
    [draftLength, draftCost, seed, noise],
  )

  const produced = useMemo(
    () => speculativeDistribution(TARGET, { draftNoise: noise, seed }),
    [noise, seed],
  )
  const measuredOutput = useMemo(
    () => measuredOutputDistribution(TARGET, { draftNoise: noise, seed, trials: 20000 }),
    [noise, seed],
  )

  const curve = useMemo(() => {
    const rows: { x: number; rate: number }[] = []
    for (const amount of [0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8]) {
      rows.push({ x: amount, rate: closedFormAcceptanceRate(perturbed(TARGET, amount, seed + 2), TARGET) })
    }
    return rows
  }, [seed])

  return (
    <div className="lab">
      <Panel
        title="Laboratory E · Speculation"
        subtitle="A small model proposes; a large one checks; nothing changes"
        accent="emerald"
      >
        <div className="lab-controls">
          <SegmentedControl label="View" value={view} onChange={setView} options={SPECULATIVE_VIEWS} />
          <Slider
            label="How far the draft is from the target"
            value={noise}
            min={0}
            max={0.9}
            step={0.01}
            onChange={setNoise}
            format={(value) => value.toFixed(2)}
            hint="The total variation between the two distributions."
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
          {view === 'acceptance' || view === 'speedup' ? (
            <>
              <Slider label="The draft length" value={draftLength} min={1} max={8} onChange={setDraftLength} />
              <Slider
                label="The draft’s cost, relative to the target"
                value={draftCost}
                min={0.01}
                max={0.5}
                step={0.01}
                onChange={setDraftCost}
                format={(value) => value.toFixed(2)}
              />
            </>
          ) : null}
          {view === 'tree' ? (
            <>
              <Slider
                label="The depth"
                value={depth}
                min={1}
                max={8}
                onChange={setDepth}
                hint="How many tokens ahead the tree reaches."
              />
              <Slider
                label="The width"
                value={width}
                min={1}
                max={6}
                onChange={setWidth}
                hint="How many candidates it keeps at each level."
              />
            </>
          ) : null}
          {view === 'medusa' ? (
            <>
              <Slider label="The extra heads" value={heads} min={1} max={8} onChange={setHeads} />
              <Slider
                label="How much worse each head is"
                value={headNoise}
                min={0}
                max={0.4}
                step={0.01}
                onChange={setHeadNoise}
                format={(value) => value.toFixed(2)}
                hint="The noise head one carries, multiplied by the position it predicts."
              />
            </>
          ) : null}
        </div>

        {view === 'acceptance' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The acceptance rate"
                value={percent(measured)}
                hint="measured by running the rule"
                tone={measured > 0.7 ? 'good' : 'warn'}
              />
              <Stat label="The same, in closed form" value={percent(closed)} />
              <Stat label="The tokens per target step" value={fmt(simulation.tokensPerStep, 3)} />
              <Stat
                label="The speed-up"
                value={`${fmt(simulation.speedup, 2)}×`}
                tone={simulation.speedup > 1 ? 'good' : 'warn'}
              />
            </div>

            <Figure
              title="The acceptance rate against the distance"
              description="How far the draft is from the target, and the fraction of its proposals that survive."
              caption="The acceptance rate is one minus the total variation: the fraction of the draft’s mass that the target agrees with."
            >
              <TrendChart
                data={curve}
                series={[{ key: 'rate', name: 'the acceptance rate', colour: 'var(--accent-emerald)' }]}
                xLabel="the distance between the draft and the target"
                yLabel="the acceptance rate"
                height={260}
              />
            </Figure>

            <Figure
              title="The distribution the procedure produces"
              description="The target’s distribution, the distribution the rule implies, and the one the procedure actually produced."
              caption="The accepted and the corrected tokens add up to exactly the target’s. The method buys time and nothing else, which is why it is safe to use."
            >
              <DataTable
                caption="The output distribution"
                headers={['The token', 'The target', 'The rule', 'The measured run']}
                rows={TARGET.map((value, index) => [
                  index,
                  fmt(value, 5),
                  fmt(produced[index] ?? 0, 5),
                  fmt(measuredOutput[index] ?? 0, 5),
                ])}
              />
            </Figure>

            <Callout tone="definition" title="The rule, and why it preserves the distribution">
              A drafted token x is accepted with probability min(1, p(x)/q(x)). The mass that is accepted at x is
              min(q(x), p(x)); the mass that is rejected is the excess max(0, p(x) − q(x)), and it is resampled from
              the excess. The two add up to p(x) for every x, so the output is the target’s own distribution — and the
              distance from it, measured above, is the sampling error and nothing else.
            </Callout>
          </>
        ) : null}

        {view === 'speedup' ? (
          <>
            <div className="stat-row">
              <Stat label="The tokens per target step" value={fmt(simulation.tokensPerStep, 3)} />
              <Stat
                label="The speed-up"
                value={`${fmt(simulation.speedup, 2)}×`}
                tone={simulation.speedup > 1 ? 'good' : 'warn'}
              />
              <Stat label="The cost of a step" value={`${fmt(1 + draftCost * draftLength, 2)} target passes`} />
              <Stat label="The break-even acceptance" value={percent(breakEven(draftLength, draftCost))} />
            </div>

            <Figure
              title="What the run cost"
              description="The tokens the target produced, the steps it took, and the speed-up against the plain method."
              caption="The plain method runs the target once per token. The speculative method runs it once per group of proposals, and the acceptance rate decides how many tokens that group is worth."
            >
              <DataTable
                caption="The run"
                headers={['The quantity', 'The value']}
                rows={[
                  ['the tokens proposed', simulation.proposed],
                  ['the tokens accepted', simulation.accepted],
                  ['the target steps', simulation.targetSteps],
                  ['the tokens produced', simulation.targetTokens],
                  ['the steps the plain method would need', simulation.baselineSteps],
                  ['the tokens per target step', fmt(simulation.tokensPerStep, 3)],
                  ['the speed-up', `${fmt(simulation.speedup, 3)}×`],
                ]}
              />
            </Figure>

            <Figure
              title="What the speed-up depends on"
              description="The speed-up as the draft gets closer to the target and as the draft gets more expensive."
              caption="A draft that is close to the target is worth more than a long run of a distant one, and a draft that costs half as much is worth twice as much."
            >
              <DataTable
                caption="The terms of the trade"
                headers={['The draft', 'The acceptance', 'The tokens per step', 'The speed-up']}
                rows={[0.05, 0.15, 0.3, 0.5].map((amount) => {
                  const run = simulateSpeculative(TARGET, {
                    draftLength,
                    draftCost,
                    seed,
                    steps: 300,
                    draftNoise: amount,
                  })
                  return [
                    `${fmt(amount, 2)} away`,
                    percent(run.acceptanceRate),
                    fmt(run.tokensPerStep, 3),
                    `${fmt(run.speedup, 2)}×`,
                  ]
                })}
              />
            </Figure>

            <Figure
              title="The length, and what it is worth at this acceptance"
              description="One more drafted position, at the acceptance rate the run measured."
              caption="A position at the end of the run is only reached if every position before it was accepted, so the yield of the k-th proposal is the acceptance to the k-th power. Past a few positions the run is proposing tokens it will never reach — and the draft still pays for them."
            >
              <DataTable
                caption="The yield of each position"
                headers={['The position', 'The chance it is reached', 'The tokens it adds', 'The cost it pays']}
                rows={Array.from({ length: draftLength }, (_, i) => {
                  const reached = closed ** (i + 1)
                  return [i + 1, percent(reached), fmt(reached, 4), `${fmt(draftCost, 2)} of a target pass`]
                })}
              />
            </Figure>

            <Callout tone="warning" title="When the trade is a bad one">
              If the acceptance rate falls far enough, the target spends its time checking proposals it will throw
              away, and the method is slower than doing nothing. The break-even rate above is where the tokens per step
              stop paying for the drafting: it is {percent(breakEven(draftLength, draftCost))} for a run of{' '}
              {draftLength} positions at this cost, and it rises with both.
            </Callout>
          </>
        ) : null}

        {view === 'tree' ? <TreeView noise={noise} depth={depth} width={width} seed={seed} /> : null}

        {view === 'medusa' ? <MedusaView heads={heads} headNoise={headNoise} seed={seed} depth={depth} /> : null}
      </Panel>
    </div>
  )
}

/**
 * The acceptance at which a run of this length and cost stops paying.
 *
 * The closed form is the speed-up equal to one: a step costs `1 + cost × length`
 * target passes and produces one token plus the accepted prefix, and the
 * expectation of that prefix at acceptance a is the sum of a¹ … a^length. The
 * screen solves it by bisection rather than quoting it, because the answer moves
 * with both of the sliders and a quoted number would be the answer to a
 * different question.
 */
function breakEven(draftLength: number, draftCost: number): number {
  const paying = (a: number) => {
    let running = 1
    let total = 1
    for (let i = 0; i < draftLength; i++) {
      running *= a
      total += running
    }
    return total / (1 + draftCost * draftLength) - 1
  }
  if (paying(0) >= 0) return 0
  if (paying(1) <= 0) return 1
  let low = 0
  let high = 1
  for (let i = 0; i < 60; i++) {
    const middle = (low + high) / 2
    if (paying(middle) > 0) low = middle
    else high = middle
  }
  return (low + high) / 2
}

/**
 * The tree, against the chain that costs the same.
 *
 * Both are run at the same number of positions per step, which is the only
 * comparison that means anything: the tree's whole claim is that a hedge is
 * worth the width it costs, and that is a claim about a fixed budget.
 */
function TreeView({ noise, depth, width, seed }: { noise: number; depth: number; width: number; seed: number }) {
  const shape = { depth, width }
  const chain = chainOfSameCost(treeNodes(shape))
  const run = useMemo(
    () => simulateTreeSpeculative(TARGET, { shape: { depth, width }, draftNoise: noise, seed, steps: 400 }),
    [noise, depth, width, seed],
  )
  const crossover = useMemo(() => crossoverAcceptance({ depth, width }), [depth, width])
  const hedge = useMemo(() => {
    const rows: { x: number; tree: number; chain: number }[] = []
    for (let i = 1; i <= 19; i++) {
      const a = i / 20
      rows.push({
        x: a,
        tree: expectedAcceptedTokens(a, { depth, width }) + 1,
        chain: expectedAcceptedTokens(a, chainOfSameCost(treeNodes({ depth, width }))) + 1,
      })
    }
    return rows
  }, [depth, width])
  const shapes = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((candidate) => {
        const at = { depth, width: candidate }
        const same = chainOfSameCost(treeNodes(at))
        return {
          width: candidate,
          nodes: treeNodes(at),
          tree: expectedAcceptedTokens(run.acceptanceRate, at) + 1,
          chain: expectedAcceptedTokens(run.acceptanceRate, same) + 1,
          crossover: crossoverAcceptance(at),
        }
      }),
    [depth, run.acceptanceRate],
  )

  return (
    <>
      <div className="stat-row">
        <Stat label="The acceptance measured" value={percent(run.acceptanceRate)} tone={run.acceptanceRate > 0.7 ? 'good' : 'warn'} />
        <Stat
          label="The tree’s tokens per step"
          value={fmt(run.tokensPerStep, 3)}
          hint={`${run.nodesPerStep} positions scored`}
        />
        <Stat
          label="The chain, same cost"
          value={fmt(run.chain.tokensPerStep, 3)}
          tone={run.tokensPerStep > run.chain.tokensPerStep ? 'good' : 'warn'}
        />
        <Stat
          label="The hedge stops paying at"
          value={fmt(crossover, 2)}
          hint="acceptance, above it the chain wins"
        />
      </div>

      <Figure
        title="The hedge is worth it when the drafts are bad"
        description="The tokens per step the tree and the same-cost chain each expect, against the acceptance rate."
        caption={`A hedge pays when the thing it hedges against happens, so the tree’s advantage shrinks as the drafts get better while its cost — ${run.nodesPerStep} positions every step, whether or not the accepted path uses them — never shrinks. The two curves cross at ${fmt(crossover, 2)}, and the run’s own acceptance is ${fmt(run.acceptanceRate, 2)}${
          run.acceptanceRate < crossover ? ', which is the tree’s side of it' : ', which is the chain’s'
        }.`}
      >
        <TrendChart
          data={hedge}
          series={[
            { key: 'tree', name: `the tree, depth ${depth} width ${width}`, colour: 'var(--accent-emerald)' },
            { key: 'chain', name: 'the chain at the same cost', colour: 'var(--accent-amber)', dashed: true },
          ]}
          xLabel="the acceptance rate"
          yLabel="the tokens per step"
          referenceLines={[{ x: crossover, label: 'the cross-over' }]}
          height={280}
        />
      </Figure>

      <Figure
        title="The run, against the formula"
        description="What the simulation produced and what the closed form says it should have."
        caption="The formula assumes every position is drawn from the same distribution, independently of the ones before it. The simulation is built that way, so the two agree to sampling error — and that agreement is the warning as much as the check: a real draft’s accuracy depends on the prefix it follows, so the closed form is an upper bound on what a hedged tree achieves."
      >
        <DataTable
          caption="The tree run"
          headers={['The quantity', 'The value']}
          rows={[
            ['the shape', `depth ${depth}, width ${width}`],
            ['the positions the target scores per step', run.nodesPerStep],
            ['the chain of the same cost', `depth ${chain.depth}, width 1`],
            ['the acceptance measured', percent(run.acceptanceRate)],
            ['the tokens per step measured', fmt(run.tokensPerStep, 3)],
            ['the tokens per step the formula gives', fmt(run.expected, 3)],
            ['the chain’s tokens per step measured', fmt(run.chain.tokensPerStep, 3)],
            ['the tokens per position scored, tree', fmt(run.tokensPerNode, 4)],
            ['the tokens per position scored, chain', fmt(run.chain.tokensPerNode, 4)],
          ]}
        />
      </Figure>

      <Figure
        title="How wide a hedge is worth buying"
        description={`At the depth of ${depth} and the acceptance the run measured: what each width expects, and where it stops paying.`}
        caption="Each extra candidate multiplies the chance that one of the runs at this level survives, and adds one whole level of positions to the bill. The cross-over is the acceptance at which the second effect catches up with the first, and it falls as the tree gets wider: a wide hedge is a bet on bad drafts."
      >
        <DataTable
          caption="The widths, at this depth"
          headers={['The width', 'The positions per step', 'The tree expects', 'The chain expects', 'Worth it below acceptance']}
          rows={shapes.map((entry) => [
            entry.width,
            entry.nodes,
            fmt(entry.tree, 3),
            fmt(entry.chain, 3),
            fmt(entry.crossover, 2),
          ])}
        />
      </Figure>

      <Callout tone="note" title="What the tree does not change">
        Every position is checked by the same rejection rule as the chain’s, so the output distribution is still the
        target’s exactly. The tree changes only what is proposed, and the bill for checking it — which is why it can
        be argued about with a spreadsheet rather than a training run.
      </Callout>
    </>
  )
}

/**
 * Medusa: the draft model replaced by heads.
 *
 * The proposals come from the target’s own last hidden state, so they cost a
 * matvec rather than a model. What they cost in acceptance is the point of the
 * screen, and it is a prefix product: a head is only asked when every head
 * before it was kept.
 */
function MedusaView({
  heads,
  headNoise,
  seed,
  depth,
}: {
  heads: number
  headNoise: number
  seed: number
  depth: number
}) {
  const run = useMemo(() => simulateMedusa(TARGET, { heads, headNoise, seed, steps: 600 }), [heads, headNoise, seed])
  const distributions = useMemo(
    () => medusaHeads(TARGET, { heads, headNoise, seed }),
    [heads, headNoise, seed],
  )
  const ladder = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6, 7, 8].map((count) => {
        const step = simulateMedusa(TARGET, { heads: count, headNoise, seed, steps: 400 })
        return { heads: count, measured: step.tokensPerStep, expected: step.expectedTokensPerStep }
      }),
    [headNoise, seed],
  )

  let running = 1
  const rows = run.acceptance.map((acceptance, index) => {
    running *= acceptance
    const added = running
    return [
      index + 1,
      `position ${index + 1}`,
      fmt(Math.min(0.95, headNoise * (index + 1)), 2),
      percent(acceptance),
      percent(run.measuredAcceptance[index] ?? 0),
      percent(added),
      fmt(added, 4),
    ]
  })

  return (
    <>
      <div className="stat-row">
        <Stat label="The tokens per step" value={fmt(run.tokensPerStep, 3)} />
        <Stat
          label="The prefix product says"
          value={fmt(run.expectedTokensPerStep, 3)}
          hint="no simulation, just the acceptances"
        />
        <Stat label="The speed-up" value={`${fmt(run.speedup, 2)}×`} tone={run.speedup > 1 ? 'good' : 'warn'} />
        <Stat
          label="The weakest head"
          value={percent(Math.min(...run.acceptance))}
          hint={`position ${run.acceptance.indexOf(Math.min(...run.acceptance)) + 1}`}
        />
      </div>

      <Figure
        title="Every head, and what it survives"
        description="The distance each head is planted at, its acceptance, the rate measured among the steps that reached it, and the chance the run gets that far."
        caption="A head further ahead is a head that has more chances to be wrong before its own position, so its distance from the target grows with its number. The last two columns are the arithmetic of the whole method: the run reaches head k only if heads one to k−1 were kept, so what head k adds to the step is the product of the acceptances, not the acceptance."
      >
        <DataTable
          caption="The heads"
          headers={['The head', 'It predicts', 'Its distance from the target', 'The acceptance', 'Measured when reached', 'The chance the run gets here', 'The tokens it adds']}
          rows={rows}
        />
      </Figure>

      <Figure
        title="What an extra head buys"
        description="The tokens per step as the heads are added one at a time, measured and expected."
        caption={`The first head is nearly free money and the ${ladder[ladder.length - 1]!.heads}-th is nearly nothing: the added term is a product of acceptances, so it shrinks geometrically. The measured line sits on the expected one because the simulation is the formula — which is the point of the closed form, and the reason the paper’s speed-up figures can be reproduced without a model.`}
      >
        <TrendChart
          data={ladder}
          series={[
            { key: 'measured', name: 'the tokens per step, measured', colour: 'var(--accent-emerald)' },
            { key: 'expected', name: 'the prefix product', colour: 'var(--accent-amber)', dashed: true },
          ]}
          xLabel="the extra heads"
          yLabel="the tokens per step"
          height={260}
        />
      </Figure>

      <Figure
        title="The three ways of proposing"
        description="What each method spends, and what it is buying with it."
        caption="A draft model is a second model to train and run; a tree is the same model, several continuations, and a wider pass; Medusa heads are a matvec each, on the state the target already computed. All three are checked by the same rejection rule and all three leave the output distribution untouched."
      >
        <DataTable
          caption="The cost of a proposal"
          headers={['The method', 'What proposes', 'The cost of it', 'What the run pays for']}
          rows={[
            ['the chain', 'a draft model, one token at a time', 'a full second model, run sequentially', `${draftOfChainCost(headNoise)}`],
            ['the tree', 'the draft model, several continuations', 'a wider target pass', `${treeNodes({ depth, width: 2 })} positions per step at depth ${depth}, width 2`],
            ['Medusa', 'the target’s own hidden state', 'one matvec per head', `${distributions.length} heads, ${fmt(run.speedup, 2)}× in this run`],
          ]}
        />
      </Figure>

      <Callout tone="definition" title="The condition, not the rate">
        The head for position four is not asked unless positions one to three were kept, so its measured acceptance is
        higher than a naive average over all steps would suggest — it is the acceptance among the steps that reached
        it, which is exactly the conditional the prefix product multiplies. That is the difference between a head that
        is bad and a head that never gets used.
      </Callout>
    </>
  )
}

/** A draft model’s cost, stated as the screen states it elsewhere. */
function draftOfChainCost(headNoise: number): string {
  return `${fmt(0.01 + headNoise / 2, 2)} of a target pass per token, and a model of its own`
}
