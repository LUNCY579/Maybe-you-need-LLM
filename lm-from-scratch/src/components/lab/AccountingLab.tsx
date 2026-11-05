import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  ACCELERATORS,
  attentionKernelIntensity,
  countParameters,
  forwardFlops,
  roofline,
  trainingMemory,
  trainingStepFlops,
} from '../../core/architecture'
import type { Architecture } from '../../core/architecture'
import { adamUpdateIntensity, kernelIntensity, matmulIntensity, memoryHierarchy } from '../../core/systems'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'flops' | 'memory' | 'roofline'

export function AccountingLab() {
  const [view, setView] = useState<View>('flops')
  const [dModel, setDModel] = useState(768)
  const [layers, setLayers] = useState(12)
  const [sequenceLength, setSequenceLength] = useState(2048)
  const [batchSize, setBatchSize] = useState(8)
  const [accelerator, setAccelerator] = useState('a100-40')

  const architecture: Architecture = useMemo(
    () => ({
      contextLength: sequenceLength,
      dModel,
      heads: Math.max(1, Math.floor(dModel / 64)),
      dFf: 4 * dModel,
      layers,
      vocabSize: 32000,
    }),
    [dModel, layers, sequenceLength],
  )

  const flops = useMemo(() => forwardFlops(architecture, sequenceLength), [architecture, sequenceLength])
  const stepFlops = useMemo(() => trainingStepFlops(architecture, sequenceLength), [architecture, sequenceLength])
  const memory = useMemo(() => trainingMemory(architecture, sequenceLength), [architecture, sequenceLength])
  const line = useMemo(
    () => roofline(architecture, sequenceLength, ACCELERATORS[accelerator]!),
    [architecture, sequenceLength, accelerator],
  )
  const attention = useMemo(
    () => attentionKernelIntensity(architecture, sequenceLength),
    [architecture, sequenceLength],
  )
  const hierarchy = useMemo(
    () => memoryHierarchy(architecture, sequenceLength),
    [architecture, sequenceLength],
  )
  const update = adamUpdateIntensity()
  const matmul = matmulIntensity(dModel, dModel, dModel)
  const kernel = kernelIntensity(architecture, sequenceLength)

  const flopsCurve = useMemo(() => {
    const rows: { x: number; attention: number; feedForward: number; scores: number; output: number }[] = []
    for (let length = 128; length <= 8192; length *= 2) {
      const measured = forwardFlops(architecture, length)
      rows.push({
        x: length,
        attention: measured.attentionProjections,
        feedForward: measured.feedForward,
        scores: measured.attentionScores,
        output: measured.output,
      })
    }
    return rows
  }, [architecture])

  const memoryBreakdown = useMemo(() => {
    const total = memory.total
    return [
      { name: 'the parameters', bytes: memory.parameters, share: memory.parameters / total },
      { name: 'the gradients', bytes: memory.gradients, share: memory.gradients / total },
      { name: 'the optimiser state', bytes: memory.optimizer, share: memory.optimizer / total },
      { name: 'the activations', bytes: memory.activations, share: memory.activations / total },
    ]
  }, [memory])

  const gigabytes = (bytes: number) => bytes / 1024 ** 3
  const capacity = (bytes: number) =>
    bytes >= 1e9 ? `${(bytes / 1e9).toFixed(0)} GB` : bytes >= 1e6 ? `${(bytes / 1e6).toFixed(0)} MB` : `${(bytes / 1024).toFixed(0)} KB`

  return (
    <div className="lab">
      <Panel
        title="Laboratory C · Resource accounting"
        subtitle="What a training step costs, before you run it: the FLOPs, the memory hierarchy, and the roofline"
        accent="amber"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'flops', label: 'The arithmetic' },
              { value: 'memory', label: 'The hierarchy' },
              { value: 'roofline', label: 'The roofline' },
            ]}
          />
          <Slider label="Width" value={dModel} min={128} max={2048} step={64} onChange={setDModel} />
          <Slider label="Layers" value={layers} min={1} max={48} onChange={setLayers} />
          <Slider
            label="Sequence length"
            value={sequenceLength}
            min={128}
            max={8192}
            step={128}
            onChange={setSequenceLength}
          />
          <Slider label="Batch size" value={batchSize} min={1} max={64} onChange={setBatchSize} />
          <div className="field">
            <label className="field-label" htmlFor="accelerator">
              The machine
            </label>
            <select
              id="accelerator"
              className="select"
              value={accelerator}
              onChange={(event) => setAccelerator(event.target.value)}
            >
              {Object.entries(ACCELERATORS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="stat-row">
          <Stat
            label="FLOPs per step"
            value={`${(stepFlops / 1e12).toFixed(2)} T`}
            hint="one batch, forward and backward"
          />
          <Stat
            label="Memory per step"
            value={`${gigabytes(memory.total).toFixed(2)} GiB`}
            hint="parameters, gradients, optimiser, activations"
          />
          <Stat
            label="Arithmetic intensity"
            value={fmt(line.intensity, 1)}
            hint="operations per byte"
          />
          <Stat
            label="The balance point"
            value={fmt(line.balancePoint, 1)}
            hint="the machine's intensity crossover"
            tone={line.intensity < line.balancePoint ? 'warn' : 'good'}
          />
        </div>

        {view === 'flops' ? (
          <>
            <Figure
              title="The forward pass, term by term"
              description="The floating-point operations of a forward pass, broken into the four things it consists of, as the sequence length grows."
              caption="The feed-forward block dominates at short sequences. The attention scores grow quadratically and overtake it — which is the reason long-context training is expensive."
            >
              <TrendChart
                data={flopsCurve}
                series={[
                  { key: 'feedForward', name: 'the feed-forward', colour: 'var(--accent-teal)' },
                  { key: 'attention', name: 'the attention projections', colour: 'var(--accent-indigo)' },
                  { key: 'scores', name: 'the attention scores', colour: 'var(--accent-rose)' },
                  { key: 'output', name: 'the output projection', colour: 'var(--accent-amber)' },
                ]}
                xLabel="the sequence length"
                yLabel="FLOPs per forward pass"
                height={300}
              />
            </Figure>

            <DataTable
              caption="The bill for one step"
              headers={['Quantity', 'Value']}
              rows={[
                ['the forward pass', `${(flops.total / 1e12).toFixed(2)} TFLOPs`],
                ['the training step', `${(stepFlops / 1e12).toFixed(2)} TFLOPs`],
                ['the tokens in the batch', (batchSize * sequenceLength).toLocaleString()],
                ['the parameters', countParameters(architecture).total.toLocaleString()],
                ['the memory for the parameters', `${gigabytes(memory.parameters).toFixed(2)} GiB`],
                ['the memory for the gradients', `${gigabytes(memory.gradients).toFixed(2)} GiB`],
                ['the memory for the optimiser', `${gigabytes(memory.optimizer).toFixed(2)} GiB`],
                ['the memory for the activations', `${gigabytes(memory.activations).toFixed(2)} GiB`],
                ['the memory in total', `${gigabytes(memory.total).toFixed(2)} GiB`],
              ]}
            />

            <Figure
              title="The four things that have to fit"
              description="How the memory of a training step is divided between the parameters, their gradients, the optimiser state and the activations."
              caption="The optimiser state is two floats per parameter, and the activations scale with the sequence length. Which of them dominates depends on the shape you chose."
            >
              <DataTable
                caption="The memory of one step"
                headers={['Component', 'Size', 'Share']}
                rows={memoryBreakdown.map((row) => [
                  row.name,
                  `${gigabytes(row.bytes).toFixed(2)} GiB`,
                  fmt(row.share * 100, 1) + '%',
                ])}
              />
            </Figure>
          </>
        ) : null}

        {view === 'memory' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The working set"
                value={`${gigabytes(hierarchy.workingSet).toFixed(2)} GiB`}
                hint="parameters, gradients, optimiser and activations"
              />
              <Stat
                label="The activations’ share"
                value={`${fmt(hierarchy.activationShare * 100, 1)}%`}
                hint="the part that grows with the sequence"
              />
              <Stat
                label="The optimiser update"
                value={fmt(update.intensity, 2)}
                hint="FLOPs per byte, and it does not move"
                tone="warn"
              />
              <Stat
                label="The shared-memory balance point"
                value={fmt(hierarchy.rows[0]!.balancePoint, 1)}
                hint="operations per byte"
              />
            </div>

            <Figure
              title="The memory hierarchy, level by level"
              description="The levels a training step streams through, each with its capacity, its bandwidth, its balance point, and how many times it must be refilled."
              caption="The balance point is the intensity at which a level's bandwidth exactly feeds the arithmetic units. It rises as the level gets slower, so a kernel can be arithmetic-bound in shared memory and memory-bound against HBM without changing."
            >
              <DataTable
                caption="The hierarchy"
                headers={['Level', 'Capacity', 'Bandwidth', 'Balance point', 'Passes over the working set']}
                rows={hierarchy.rows.map((row) => [
                  row.name,
                  capacity(row.capacity),
                  `${(row.bandwidth / 1e12).toFixed(2)} TB/s`,
                  fmt(row.balancePoint, 1),
                  `${fmt(row.passes, 1)}×`,
                ])}
              />
            </Figure>

            <Figure
              title="Where the arithmetic sits"
              description="The arithmetic intensity of three kernels that make up a training step, against the balance points of the hierarchy."
              caption="A square matrix multiply at the model width has an intensity of width / 3 operations per byte, so it is arithmetic-bound even in shared memory. The Adam update is under one operation per byte, so it is memory-bound at every level. The attention kernel sits in between, and below the HBM balance point."
            >
              <DataTable
                caption="Kernel intensities"
                headers={['Kernel', 'FLOPs per byte', 'Against shared memory', 'Against HBM']}
                rows={[
                  [
                    'a square matrix multiply at the model width',
                    fmt(matmul, 1),
                    matmul > hierarchy.rows[0]!.balancePoint ? 'arithmetic-bound' : 'memory-bound',
                    matmul > hierarchy.rows[2]!.balancePoint ? 'arithmetic-bound' : 'memory-bound',
                  ],
                  [
                    'the attention kernel',
                    fmt(kernel, 1),
                    kernel > hierarchy.rows[0]!.balancePoint ? 'arithmetic-bound' : 'memory-bound',
                    kernel > hierarchy.rows[2]!.balancePoint ? 'arithmetic-bound' : 'memory-bound',
                  ],
                  [
                    'the Adam update',
                    fmt(update.intensity, 2),
                    update.intensity > hierarchy.rows[0]!.balancePoint ? 'arithmetic-bound' : 'memory-bound',
                    update.intensity > hierarchy.rows[2]!.balancePoint ? 'arithmetic-bound' : 'memory-bound',
                  ],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="Memory hierarchy arithmetic">
              Each level is a capacity and a bandwidth. The capacity decides how many times the working set has to pass
              through it, and the bandwidth decides the balance point. An operation is worth optimising only when it is
              on the slow side of the level it is running against.
            </Callout>

            <Callout tone="note" title="The hardware figures are quoted">
              The capacities and bandwidths are representative figures for an H100 SXM, and the aggregate shared-memory
              bandwidth depends on the access pattern. The arithmetic on top of them is exact: the intensities come
              from the shapes, and the passes come from the working set.
            </Callout>
          </>
        ) : null}

        {view === 'roofline' ? (
          <>
            <Figure
              title="On the roofline"
              description="The attainable rate of the workload against the two ceilings that bound it, and the attention kernel's own position."
              caption="The step's arithmetic intensity against the machine's balance point. The attention kernel is a separate line, and it is always under the balance point — which is why it has to be tiled rather than made faster."
            >
              <DataTable
                caption="The roofline"
                headers={['Quantity', 'Value']}
                rows={[
                  ['the machine', ACCELERATORS[accelerator]!.name],
                  ['the peak arithmetic rate', `${(line.peakFlops / 1e12).toFixed(0)} TFLOP/s`],
                  ['the memory bandwidth', `${(line.bandwidth / 1e12).toFixed(2)} TB/s`],
                  ['the balance point', fmt(line.balancePoint, 1)],
                  ['the step’s intensity', fmt(line.intensity, 1)],
                  ['the step is bound by', line.boundBy],
                  ['the attention kernel’s intensity', fmt(attention.intensity, 1)],
                  ['the attention kernel is bound by', line.attentionBoundBy],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="What the roofline tells you to optimise">
              Above the balance point, a better kernel cannot help — the machine is already waiting on memory. Below it,
              the arithmetic is cheap and the memory traffic is what costs. The attention kernel is below it at every
              sequence length, because its intensity is set by the head dimension rather than by the problem size.
            </Callout>

            <Callout tone="note" title="The whole step can hide the kernel">
              The step’s average intensity includes the parameter updates, which are arithmetic-heavy and memory-light.
              A step can therefore look arithmetic-bound while the kernel you actually wanted to fix is memory-bound. The
              two have to be looked at separately, which is why the laboratory reports them separately.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
