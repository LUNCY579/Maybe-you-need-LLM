import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  PAPER_BIAS,
  PAPER_SCALE,
  balancedBias,
  buildLogits,
  couplingReport,
  couplingSweep,
  sigmoidLoss,
  sigmoidProbabilities,
  softmaxLoss,
  softmaxProbabilities,
} from '../../core/siglip'
import { Callout, Figure, MathBlock, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'loss' | 'coupling' | 'bias'

const PAPER_BATCH = Math.round(Math.exp(-PAPER_BIAS)) + 1

export function SigmoidLab() {
  const [view, setView] = useState<View>('loss')
  const [size, setSize] = useState(8)
  const [margin, setMargin] = useState(0.4)
  const [temperature, setTemperature] = useState(0.1)
  const [scale, setScale] = useState(PAPER_SCALE)
  const [bias, setBias] = useState(() => Math.round(balancedBias(8) * 2) / 2)

  const logits = useMemo(() => buildLogits({ size, margin, noise: 0.05, seed: 4 }), [size, margin])

  const report = useMemo(
    () => couplingReport(logits, { temperature, scale, bias }),
    [logits, temperature, scale, bias],
  )

  const sweep = useMemo(
    () => couplingSweep(logits, 6, { temperature, scale, bias }),
    [logits, temperature, scale, bias],
  )

  const softmaxRow = useMemo(() => softmaxProbabilities(logits, 0, temperature), [logits, temperature])
  const sigmoidRow = useMemo(() => sigmoidProbabilities(logits, 0, { scale, bias }), [logits, scale, bias])
  const softmaxTotal = softmaxRow.reduce((sum, value) => sum + value, 0)
  const sigmoidTotal = sigmoidRow.reduce((sum, value) => sum + value, 0)

  const softmaxMean = softmaxLoss(logits, temperature)
  const sigmoidMean = sigmoidLoss(logits, { scale, bias })

  return (
    <div className="lab">
      <Panel
        title="Laboratory C · The sigmoid loss"
        subtitle="What the softmax divides by, and what the sigmoid leaves out"
        accent="rose"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'loss', label: 'The two losses' },
              { value: 'coupling', label: 'The coupling' },
              { value: 'bias', label: 'The bias' },
            ]}
          />
          <Slider label="The pairs in the batch" value={size} min={4} max={16} step={2} onChange={setSize} />
          <Slider
            label="The similarity of a matched pair"
            value={margin}
            min={0.1}
            max={0.8}
            step={0.05}
            onChange={setMargin}
            format={(value) => value.toFixed(2)}
            hint="Every other pair is given a similarity near zero."
          />
          <Slider
            label="The temperature τ"
            value={temperature}
            min={0.02}
            max={0.5}
            step={0.02}
            onChange={setTemperature}
            format={(value) => value.toFixed(2)}
            hint="The softmax’s sharpness. The sigmoid has no temperature; it has a scale instead."
          />
          <Slider
            label="The scale t"
            value={scale}
            min={1}
            max={20}
            step={1}
            onChange={setScale}
            hint="The learned scale of the sigmoid, the paper’s t."
          />
          <Slider
            label="The bias b"
            value={bias}
            min={-12}
            max={0}
            step={0.5}
            onChange={setBias}
            format={(value) => value.toFixed(1)}
            hint={`The paper starts it at ${PAPER_BIAS}, for batches of tens of thousands; at eight pairs the fair value is about −2.`}
          />
        </div>

        <div className="stat-row">
          <Stat label="The softmax loss" value={fmt(softmaxMean, 4)} hint="mean over the batch" />
          <Stat label="The sigmoid loss" value={fmt(sigmoidMean, 4)} hint="mean over every pair" />
          <Stat
            label="The matched pair, softmax"
            value={fmt(softmaxRow[0] ?? 0, 4)}
            hint="its share of the batch"
          />
          <Stat
            label="The matched pair, sigmoid"
            value={fmt(sigmoidRow[0] ?? 0, 4)}
            hint="decided on its own"
            tone="good"
          />
        </div>

        {view === 'loss' ? (
          <>
            <Figure
              title={`Image 0’s row of the batch, read two ways`}
              description="Every caption in the batch against image 0: its similarity, the probability the softmax assigns it, and the probability the sigmoid assigns it."
              caption="The softmax turns the row into a distribution over the batch, so the probabilities are shares of a fixed total. The sigmoid turns each cell into its own question — is this pair a match? — so the probabilities are independent, and there is no reason for the row to sum to one."
            >
              <DataTable
                caption="One row of the batch"
                headers={['The caption', 'The similarity', 'P(match), softmax', 'P(match), sigmoid']}
                rows={Array.from({ length: size }, (_, index) => [
                  index === 0 ? '0 — the paired caption' : String(index),
                  fmt(logits[0]?.[index] ?? 0, 3),
                  fmt(softmaxRow[index] ?? 0, 4),
                  fmt(sigmoidRow[index] ?? 0, 4),
                ])}
              />
            </Figure>

            <MathBlock
              latex="\mathcal{L}_{\text{softmax}} = -\frac{1}{B}\sum_{i=1}^{B} \log \frac{\exp\left(s_{ii}/\tau\right)}{\sum_{j=1}^{B} \exp\left(s_{ij}/\tau\right)}"
              caption={`A distribution over the batch. The row above sums to ${fmt(softmaxTotal, 4)}.`}
              label="The contrastive loss."
            />
            <MathBlock
              latex="\mathcal{L}_{\text{sigmoid}} = -\frac{1}{B^2}\sum_{i=1}^{B}\sum_{j=1}^{B} \log \sigma\!\left(y_{ij}\left(t\,s_{ij} + b\right)\right)"
              caption={`One decision per pair, with y = +1 on the diagonal and −1 off it. The row above sums to ${fmt(sigmoidTotal, 3)}, which is not a property of a probability.`}
              label="The SigLIP loss."
            />

            <Callout tone="definition" title="The difference is the denominator">
              The softmax’s denominator contains every caption in the batch, so a caption that has nothing to do with
              image 0 still changes the probability of the one that does. The sigmoid has no denominator to grow: each
              cell’s loss is a function of that cell’s similarity and nothing else. Everything else in this laboratory
              follows from that one sentence.
            </Callout>
          </>
        ) : null}

        {view === 'coupling' ? (
          <>
            <Figure
              title="A pair whose numbers never change, under both losses"
              description="The loss of the matched pair (0, 0) as unrelated image–caption pairs are appended to the batch."
              caption="The sigmoid line is flat to machine precision: the pair’s loss is a function of the pair. The softmax line climbs with every appended pair, because each one is another term in the denominator of image 0’s row — even though none of them has anything to do with image 0."
            >
              <TrendChart
                data={sweep}
                series={[
                  { key: 'sigmoidPair', name: 'the sigmoid loss of the pair', colour: 'var(--accent-rose)' },
                  { key: 'softmaxRow', name: 'the softmax loss of its row', colour: 'var(--accent-indigo)' },
                ]}
                xKey="extra"
                xLabel="unrelated pairs appended"
                yLabel="the loss"
                height={260}
              />
            </Figure>

            <DataTable
              caption="Before and after one unrelated pair"
              headers={['The measurement', 'Before', 'After', 'The shift']}
              rows={[
                [
                  'the sigmoid loss of pair (0, 0)',
                  fmt(report.sigmoidPairBefore, 6),
                  fmt(report.sigmoidPairAfter, 6),
                  fmt(report.sigmoidPairAfter - report.sigmoidPairBefore, 6),
                ],
                [
                  'the softmax loss of image 0’s row',
                  fmt(report.softmaxRowBefore, 6),
                  fmt(report.softmaxRowAfter, 6),
                  `+${fmt(report.softmaxRowAfter - report.softmaxRowBefore, 6)}`,
                ],
              ]}
            />

            <Callout tone="warning" title="What the flat line buys">
              A loss whose value depends on the whole batch has to be evaluated on the whole batch, and its gradient
              carries a term from every negative the batch happens to contain. A loss that is a sum of independent
              pairs can be evaluated pair by pair, and a batch is then only a question of how many pairs fit in memory.
              That is the paper’s argument, and the flat line is the measurement of it at this scale.
            </Callout>
          </>
        ) : null}

        {view === 'bias' ? (
          <>
            <Figure
              title="The bias that makes the count fair"
              description="The bias b = −log(B − 1) at which a zero-similarity pair is assigned probability 1/B, for several batch sizes."
              caption="With one positive per row and B − 1 negatives, a pair chosen at random is a match with probability 1/B. Setting σ(b) to that same number is what keeps the many negatives from teaching the model that nothing matches. The paper’s initial b = −10 is that balance point for batches of about 22,000."
            >
              <DataTable
                caption="The balance point, by batch size"
                headers={['The batch size', 'The balanced bias', 'σ(b) = 1/B', 'The share of negatives']}
                rows={[8, 64, 512, 4096, 32768].map((count) => [
                  count.toLocaleString(),
                  fmt(balancedBias(count), 4),
                  fmt(1 / count, 5),
                  `${fmt(100 - 100 / count, 2)}%`,
                ])}
              />
            </Figure>

            <div className="stat-row">
              <Stat
                label="This bias, at a zero-similarity pair"
                value={fmt(1 / (1 + Math.exp(-bias)), 5)}
                hint={`σ(${fmt(bias, 1)})`}
              />
              <Stat
                label="The batch this bias assumes"
                value={Math.round(Math.exp(-bias) + 1).toLocaleString()}
                hint="e^(−b) + 1 captions per image"
              />
              <Stat label="This laboratory’s batch" value={String(size)} hint="pairs in the batch" />
              <Stat label="The paper’s initial bias" value={`${PAPER_BIAS}`} hint={`for batches near ${PAPER_BATCH.toLocaleString()}`} />
            </div>

            <Callout tone="note" title="Why the number is not a constant of the method">
              Both t and b are learned; the paper only chooses where they start. The start is matched to the batch,
              because the balance point moves with it: at eight pairs the fair bias is −1.95, and at 32,768 it is
              −10.40. A bias of −10 at eight pairs is a strong prior that nothing matches, and the laboratory lets you
              see that by moving it.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
