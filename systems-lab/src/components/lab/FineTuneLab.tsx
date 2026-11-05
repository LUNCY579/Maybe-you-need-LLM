import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  ALL_TARGETS,
  ATTENTION_TARGETS,
  BYTES_PER_PARAMETER,
  PAPER_RULE_OF_THUMB,
  SEVENTY_BILLION,
  adapterSize,
  blockShapes,
  fitsOnDevice,
  fineTunePlans,
  linearParameters,
  loraParameters,
  modelParameters,
  rankLadder,
} from '../../core/finetune'
import type { FineTunePlan } from '../../core/finetune'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { FINETUNE_DEFAULTS } from '../../content/labDefaults'

type View = 'adapters' | 'budget' | 'device'
type Targets = 'attention' | 'all'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const FINETUNE_VIEWS: { value: View; label: string }[] = [
  { value: 'adapters', label: 'The adapters' },
  { value: 'budget', label: 'The budget' },
  { value: 'device', label: 'The card' },
]

const GIB = 1024 ** 3
const RANKS = [1, 2, 4, 8, 16, 32, 64, 128, 256]
const BATCHES = [1, 2, 4, 8, 16, 32, 64]

/** A parameter count, in the units a person reads it in. */
function count(value: number): string {
  if (value >= 1e9) return `${fmt(value / 1e9, 2)} B`
  if (value >= 1e6) return `${fmt(value / 1e6, 1)} M`
  if (value >= 1e3) return `${fmt(value / 1e3, 1)} k`
  return fmt(value, 0)
}

function gigabytes(bytes: number): string {
  return `${fmt(bytes / GIB, 2)} GB`
}

function percent(fraction: number): string {
  return `${fmt(fraction * 100, 1)}%`
}

function planOf(plans: FineTunePlan[], name: string): FineTunePlan {
  return plans.find((plan) => plan.name === name) ?? plans[0]!
}

export function FineTuneLab() {
  const [view, setView] = useViewParam(FINETUNE_VIEWS)
  const [rank, setRank] = useState(FINETUNE_DEFAULTS.rank)
  const [batchSize, setBatchSize] = useState(FINETUNE_DEFAULTS.batchSize)
  const [sequenceLength, setSequenceLength] = useState(FINETUNE_DEFAULTS.sequenceLength)
  const [deviceGigabytes, setDeviceGigabytes] = useState(FINETUNE_DEFAULTS.deviceGigabytes)
  const [targetMode, setTargetMode] = useState<Targets>('all')

  const targets = useMemo(
    () => (targetMode === 'attention' ? ATTENTION_TARGETS : ALL_TARGETS),
    [targetMode],
  )
  const model = SEVENTY_BILLION
  const parameters = modelParameters(model)
  const deviceBytes = deviceGigabytes * GIB

  const adapters = useMemo(() => adapterSize(model, rank, targets), [rank, targets])
  const plans = useMemo(
    () => fineTunePlans(model, { rank, targets, batchSize, sequenceLength }),
    [rank, targets, batchSize, sequenceLength],
  )
  const verdicts = useMemo(() => plans.map((plan) => fitsOnDevice(plan.budget, deviceBytes)), [plans, deviceBytes])

  const full = planOf(plans, 'full fine-tune')
  const lora = planOf(plans, 'LoRA')
  const qlora = planOf(plans, 'QLoRA')
  const qloraVerdict = verdicts[plans.indexOf(qlora)]!
  const loraVerdict = verdicts[plans.indexOf(lora)]!
  const fullVerdict = verdicts[plans.indexOf(full)]!

  const shapes = useMemo(() => blockShapes(model), [model])
  const ladder = useMemo(() => rankLadder(model, { targets }), [targets])
  const rankCurve = useMemo(
    () =>
      RANKS.map((value) => ({
        x: value,
        attention: adapterSize(model, value, ATTENTION_TARGETS).trainable,
        all: adapterSize(model, value, ALL_TARGETS).trainable,
      })),
    [model],
  )

  const batchCurve = useMemo(
    () =>
      BATCHES.map((value) => {
        const batchPlans = fineTunePlans(model, { rank, targets, batchSize: value, sequenceLength })
        return {
          x: value,
          full: planOf(batchPlans, 'full fine-tune').budget.totalBytes / GIB,
          lora: planOf(batchPlans, 'LoRA').budget.totalBytes / GIB,
          qlora: planOf(batchPlans, 'QLoRA').budget.totalBytes / GIB,
        }
      }),
    [model, rank, targets, sequenceLength],
  )

  const termRows = qlora.budget.rows.map((row, index) => [
    row.label,
    gigabytes(full.budget.rows[index]?.bytes ?? 0),
    gigabytes(lora.budget.rows[index]?.bytes ?? 0),
    gigabytes(qlora.budget.rows[index]?.bytes ?? 0),
  ])

  return (
    <div className="lab">
      <Panel
        title="Laboratory F · Fine-tuning without moving the weights"
        subtitle="The rank, the bytes a step needs, and which of the three plans fits one card"
        accent="sky"
      >
        <div className="lab-controls">
          <SegmentedControl label="View" value={view} onChange={setView} options={FINETUNE_VIEWS} />
          <Slider label="The rank r" value={rank} min={1} max={256} onChange={setRank} />
          <Slider label="The batch" value={batchSize} min={1} max={64} onChange={setBatchSize} />
          <Slider
            label="The sequence length"
            value={sequenceLength}
            min={256}
            max={8192}
            step={256}
            onChange={setSequenceLength}
          />
          <Slider
            label="The card"
            value={deviceGigabytes}
            min={8}
            max={320}
            step={8}
            onChange={setDeviceGigabytes}
            format={(value) => `${value} GB`}
          />
          <SegmentedControl
            label="What is adapted"
            value={targetMode}
            onChange={setTargetMode}
            options={[
              { value: 'attention', label: 'attention only' },
              { value: 'all', label: 'every matrix' },
            ]}
          />
        </div>

        {view === 'adapters' ? (
          <>
            <div className="stat-row">
              <Stat label="The trainable parameters" value={count(adapters.trainable)} hint={`${count(adapters.perBlock)} per block`} />
              <Stat label="Of the adapted matrices" value={percent(adapters.fraction)} tone={adapters.fraction < 0.02 ? 'good' : 'warn'} />
              <Stat label="Per frozen parameter" value={fmt(adapters.perFrozen, 5)} hint="what a rank buys" />
              <Stat label="The parameters" value={count(parameters)} hint="the seventy-billion shape" />
            </div>

            <Figure
              title="The six matrices, and the adapter on each"
              description="The frozen tensor each projection is, and the two thin matrices the rank puts beside it."
              caption="A rank-r adapter on a d×k matrix is a d×r matrix and an r×k matrix, so it costs r·(d+k) — linear in the rank and in the sum of the widths. The feed-forward block is the wide one: it holds most of the frozen weight, and its adapter is still a small multiple of the projections'."
            >
              <DataTable
                caption="The matrices"
                headers={['The matrix', 'Inputs', 'Outputs', 'Frozen parameters', `The adapter at r = ${rank}`, 'The adapter’s share']}
                rows={shapes.map((shape) => {
                  const frozen = linearParameters(shape)
                  const adapter = loraParameters(shape, rank)
                  return [
                    shape.name,
                    count(shape.inputs),
                    count(shape.outputs),
                    count(frozen),
                    count(adapter),
                    percent(adapter / frozen),
                  ]
                })}
              />
            </Figure>

            <Figure
              title="The rank, and what it costs"
              description="Trainable parameters against the rank, on the attention projections and on every matrix."
              caption="Both lines are straight because the count is exactly linear in r. Adapting all six matrices costs more than twice what adapting the four projections costs, which is why a paper that adapts only attention leaves most of the cheap capacity on the table."
            >
              <TrendChart
                data={rankCurve}
                series={[
                  { key: 'attention', name: 'the attention projections', colour: 'var(--accent-sky)' },
                  { key: 'all', name: 'every matrix', colour: 'var(--accent-violet)' },
                ]}
                xLabel="the rank r"
                yLabel="trainable parameters"
                height={260}
              />
            </Figure>

            <Figure
              title="The ladder, rung by rung"
              description="The adapter's own memory at each rank: weights, gradients and Adam states, which is eighteen bytes per trainable parameter."
              caption="Doubling the rank doubles the adapter and doubles the bookkeeping it needs, exactly. The trainable fraction stays under a few per cent of the matrices adapted, which is the whole of LoRA's claim: the change is small and low-rank, so the expensive per-parameter bookkeeping is paid only on the small part."
            >
              <DataTable
                caption="The rank ladder"
                headers={['The rank', 'Trainable parameters', 'Of the adapted matrices', 'The adapter’s memory']}
                rows={ladder.map((entry) => [
                  entry.rank,
                  count(entry.trainable),
                  percent(entry.fraction),
                  gigabytes(entry.bytes),
                ])}
              />
            </Figure>

            <Callout tone="definition" title="Why the rank is the right dial">
              The adapter is two thin matrices, B (d×r) and A (r×k), with the update BA. Only A and B carry
              gradients, optimizer states and a master copy, so the run’s bookkeeping is proportional to r·(d+k)
              rather than to d·k. The frozen tensor is untouched: it is read every step and written never.
            </Callout>
          </>
        ) : null}

        {view === 'budget' ? (
          <>
            <div className="stat-row">
              <Stat label="Full fine-tuning" value={gigabytes(full.budget.totalBytes)} tone="warn" />
              <Stat label="LoRA, bf16 frozen" value={gigabytes(lora.budget.totalBytes)} />
              <Stat label="QLoRA, NF4 frozen" value={gigabytes(qlora.budget.totalBytes)} tone="good" />
              <Stat label="QLoRA per parameter" value={`${fmt(qlora.budget.perParameterBytes, 2)} B`} hint={`the paper quotes ${fmt(PAPER_RULE_OF_THUMB.qlora, 1)} B`} />
            </div>

            <Figure
              title="The budget, term by term"
              description="What holds memory in each of the three runs: the frozen weights, the trainable ones, their gradients and optimizer states, and the activations."
              caption="The optimizer states and gradients exist only for parameters that move, which is why the full run pays twelve bytes of Adam per parameter and the adapters pay it on a fraction of a per cent. The frozen weights are the term QLoRA shrinks — four times from bf16 to NF4 — and the activations are the term neither LoRA nor QLoRA touches."
            >
              <DataTable
                caption="The terms"
                headers={['The term', 'Full fine-tuning', 'LoRA', 'QLoRA']}
                rows={[...termRows, ['the total', gigabytes(full.budget.totalBytes), gigabytes(lora.budget.totalBytes), gigabytes(qlora.budget.totalBytes)]]}
              />
            </Figure>

            <Figure
              title="What the three plans are"
              description="The rule of thumb the QLoRA paper quotes, beside the arithmetic above."
              caption={`The paper's figures are quoted, not derived: they are bytes per parameter over a model that also carries an embedding table and layernorms, and this arithmetic covers the transformer matrices and an activation estimate. The order is the point, and the test checks the order rather than the exact figure.`}
            >
              <DataTable
                caption="Three rules of thumb"
                headers={['The plan', 'The paper’s bytes per parameter', 'This run’s bytes per parameter']}
                rows={[
                  ['full fine-tuning', PAPER_RULE_OF_THUMB.fullFineTune, fmt(full.budget.perParameterBytes, 2)],
                  ['LoRA', PAPER_RULE_OF_THUMB.lora, fmt(lora.budget.perParameterBytes, 2)],
                  ['QLoRA', PAPER_RULE_OF_THUMB.qlora, fmt(qlora.budget.perParameterBytes, 2)],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="What LoRA does not save">
              The adapters are a fraction of a per cent of the model, so making them smaller or larger barely moves the
              total while the frozen weights dominate it. QLoRA's saving is the frozen term, not the adapter term: the
              model halved from bf16 to NF4 is the step that turns a multi-card job into one card, and the rank is the
              dial that changes the small term.
            </Callout>

            <Callout tone="note" title="What this budget counts">
              The frozen term is every parameter of the shape minus the adapters, stored at{' '}
              {fmt(BYTES_PER_PARAMETER.nf4, 1)} bytes for QLoRA and {BYTES_PER_PARAMETER.bf16} for bf16. The
              activation term is an estimate of four tensors of the block's width per layer, checkpointed for LoRA and
              QLoRA; it is not a measured allocator trace. Embeddings, layernorms and fragmentation are outside it, so a
              real run needs a little more than the number on screen.
            </Callout>
          </>
        ) : null}

        {view === 'device' ? (
          <>
            <div className="stat-row">
              <Stat label="QLoRA on this card" value={percent(qloraVerdict.fraction)} tone={qloraVerdict.fits ? 'good' : 'warn'} hint={qloraVerdict.fits ? 'fits' : 'does not fit'} />
              <Stat label="LoRA" value={percent(loraVerdict.fraction)} tone={loraVerdict.fits ? 'good' : 'warn'} />
              <Stat label="Full fine-tuning" value={percent(fullVerdict.fraction)} tone="warn" />
              <Stat
                label="QLoRA’s headroom"
                value={gigabytes(qloraVerdict.headroomBytes)}
                tone={qloraVerdict.headroomBytes >= 0 ? 'good' : 'warn'}
              />
            </div>

            <Figure
              title="The three plans on the card you chose"
              description="Each plan's total against the card's memory, and the fraction of the card it takes."
              caption="The fraction is the whole of the story about whether a run fits: above one it needs more cards, above ten it needs a cluster. The QLoRA run is the only one of the three that fits the eighty-gigabyte card the paper is written against at the default batch."
            >
              <DataTable
                caption="The plans on this card"
                headers={['The plan', 'Its total', 'Of the card', 'It fits', 'Headroom']}
                rows={plans.map((plan, index) => {
                  const verdict = verdicts[index]!
                  return [
                    plan.name,
                    gigabytes(plan.budget.totalBytes),
                    percent(verdict.fraction),
                    verdict.fits ? 'yes' : 'no',
                    gigabytes(verdict.headroomBytes),
                  ]
                })}
              />
            </Figure>

            <Figure
              title="The batch, and the term QLoRA does not shrink"
              description="Each plan's total against the batch size, on this card."
              caption="The activations are the only term the batch multiplies, and neither LoRA nor QLoRA changes them. That is why the paper's own batch is small, and why a large batch can undo the saving from four-bit weights: the frozen model stops being the largest term."
            >
              <TrendChart
                data={batchCurve}
                series={[
                  { key: 'full', name: 'full fine-tuning', colour: 'var(--accent-rose)' },
                  { key: 'lora', name: 'LoRA', colour: 'var(--accent-amber)' },
                  { key: 'qlora', name: 'QLoRA', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the batch"
                yLabel="memory (GB)"
                referenceLines={[{ y: deviceGigabytes, label: 'the card' }]}
                height={280}
              />
            </Figure>

            <Callout tone="note" title="The card is a quoted shape">
              The seventy-billion-parameter shape and the eighty-gigabyte card are the QLoRA paper's proportions, not
              a measurement of one device. Move the card slider and the arithmetic is the same; the verdict changes
              where the total crosses it.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
