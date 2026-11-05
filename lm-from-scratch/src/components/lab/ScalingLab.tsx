import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  DEFAULT_EXPONENTS,
  REFERENCE,
  computeOptimalAllocation,
  isoFlopLine,
  tokensPerParameter,
  traceFrontier,
} from '../../core/scaling'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'isoflop' | 'frontier'

export function ScalingLab() {
  const [view, setView] = useState<View>('isoflop')
  const [alphaParameters, setAlphaParameters] = useState(DEFAULT_EXPONENTS.alphaParameters)
  const [alphaTokens, setAlphaTokens] = useState(DEFAULT_EXPONENTS.alphaTokens)
  const [compute, setCompute] = useState(1e20)

  const exponents = useMemo(
    () => ({ alphaParameters, alphaTokens, irreducible: DEFAULT_EXPONENTS.irreducible }),
    [alphaParameters, alphaTokens],
  )

  const lines = useMemo(() => {
    const tokenCounts = [1e10, 3e10, 1e11, 3e11, 1e12, 3e12, 1e13, 3e13, 1e14]
    return [1e10, 1e11, 1e12, 1e13].map((parameters) => ({
      parameters,
      points: isoFlopLine(parameters, tokenCounts, REFERENCE, exponents),
    }))
  }, [exponents])

  const frontier = useMemo(() => {
    const budgets: number[] = []
    for (let exponent = 18; exponent <= 26; exponent += 0.5) budgets.push(10 ** exponent)
    return traceFrontier(budgets, REFERENCE, exponents)
  }, [exponents])

  const allocation = useMemo(
    () => computeOptimalAllocation(compute, REFERENCE, exponents),
    [compute, exponents],
  )

  const ratio = useMemo(() => tokensPerParameter(compute, REFERENCE, exponents), [compute, exponents])

  return (
    <div className="lab">
      <Panel
        title="Laboratory F · The scaling frontier"
        subtitle="Where to put the compute, and what the power law says you will get"
        accent="emerald"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'isoflop', label: 'The IsoFLOP lines' },
              { value: 'frontier', label: 'The frontier' },
            ]}
          />
          <Slider
            label="The compute budget"
            value={Math.log10(compute)}
            min={17}
            max={26}
            step={0.5}
            onChange={(value) => setCompute(10 ** value)}
            format={(value) => `10^${value.toFixed(1)} FLOPs`}
          />
          <Slider
            label="The parameter exponent"
            value={alphaParameters}
            min={0.02}
            max={0.2}
            step={0.005}
            onChange={setAlphaParameters}
            format={(value) => value.toFixed(3)}
          />
          <Slider
            label="The token exponent"
            value={alphaTokens}
            min={0.02}
            max={0.2}
            step={0.005}
            onChange={setAlphaTokens}
            format={(value) => value.toFixed(3)}
          />
        </div>

        <div className="stat-row">
          <Stat
            label="Optimal parameters"
            value={`${(allocation.parameters / 1e9).toFixed(1)} B`}
            hint="at this compute budget"
          />
          <Stat
            label="Optimal tokens"
            value={`${(allocation.tokens / 1e12).toFixed(2)} T`}
            hint="at this compute budget"
          />
          <Stat label="Tokens per parameter" value={fmt(ratio, 1)} hint="the rule of thumb" />
          <Stat label="The loss there" value={fmt(allocation.loss, 4)} hint="the irreducible loss is 1.69" />
        </div>

        {view === 'isoflop' ? (
          <>
            <Figure
              title="The IsoFLOP lines"
              description="For each model size, the loss as the data is swept, with the compute budget marked on each line."
              caption="Each line holds the model size fixed. The best point on a line is the allocation that spends the budget; the envelope of those points is the frontier."
            >
              <TrendChart
                data={lines.flatMap((line) => line.points.map((point) => ({ ...point, group: line.parameters })))}
                series={lines.map((line) => ({
                  key: String(line.parameters),
                  name: `${(line.parameters / 1e9).toFixed(0)}B parameters`,
                  colour: 'var(--accent-emerald)',
                }))}
                xLabel="the training tokens"
                yLabel="the loss"
                height={300}
              />
            </Figure>

            <DataTable
              caption="The best allocation on each line"
              headers={['Model size', 'The tokens at the optimum', 'The compute', 'The loss']}
              rows={lines.map((line) => {
                const budget = compute
                const best = line.points.reduce((a, b) => (b.loss < a.loss ? b : a))
                void budget
                return [
                  `${(line.parameters / 1e9).toFixed(0)}B`,
                  `${(best.tokens / 1e12).toFixed(2)} T`,
                  best.compute.toExponential(2),
                  fmt(best.loss, 4),
                ]
              })}
            />

            <Callout tone="definition" title="What the method is for">
              The question is not "how big should the model be" but "how big, given what I can afford to spend". IsoFLOP
              answers it by holding the compute fixed and sweeping the model size, and reading the best point off each
              line.
            </Callout>
          </>
        ) : null}

        {view === 'frontier' ? (
          <>
            <Figure
              title="The compute-optimal frontier"
              description="The loss of the best allocation, against the compute budget it was found at."
              caption="The frontier, and the allocation that reaches it. The exponents set the slope; the reference point sets where it passes."
            >
              <TrendChart
                data={frontier.map((point) => ({ x: point.compute, loss: point.loss }))}
                series={[{ key: 'loss', name: 'the best loss at that compute', colour: 'var(--accent-emerald)' }]}
                xLabel="the compute budget (log scale)"
                yLabel="the loss"
                height={300}
              />
            </Figure>

            <DataTable
              caption="The frontier"
              headers={['Compute', 'Optimal parameters', 'Optimal tokens', 'Tokens per parameter', 'The loss']}
              rows={frontier
                .filter((_, index) => index % 4 === 0)
                .map((point) => [
                  point.compute.toExponential(2),
                  `${(point.parameters / 1e9).toFixed(1)} B`,
                  `${(point.tokens / 1e12).toFixed(2)} T`,
                  fmt(point.tokens / point.parameters, 1),
                  fmt(point.loss, 4),
                ])}
            />

            <Callout tone="warning" title="A scaling law is an extrapolation">
              The law is fitted over a range of runs, and the frontier it describes has moved twice: once when the
              data outgrew the parameters, and again when the data itself became a bottleneck. The rule of thumb is
              useful and it is not a law.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
