import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { ACCELERATORS } from '../../core/architecture'
import type { Architecture } from '../../core/architecture'
import {
  HIERARCHY,
  attentionFootprint,
  dataParallel,
  kernelIntensity,
  pipelineBubble,
  pipelineParallel,
  tensorParallel,
} from '../../core/systems'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable } from '@llm-materials/course-ui'

type View = 'parallelism' | 'kernel'

const gib = (bytes: number) => bytes / 1024 ** 3
const mib = (bytes: number) => bytes / 1024 ** 2

export function SystemsLab() {
  const [view, setView] = useState<View>('parallelism')
  const [devices, setDevices] = useState(8)
  const [layers, setLayers] = useState(12)
  const [sequenceLength, setSequenceLength] = useState(2048)
  const [microbatches, setMicrobatches] = useState(8)
  const [tile, setTile] = useState(128)
  const [accelerator, setAccelerator] = useState('h100-sxm')

  const architecture: Architecture = useMemo(
    () => ({
      contextLength: sequenceLength,
      dModel: 768,
      heads: 12,
      dFf: 3072,
      layers,
      vocabSize: 32000,
    }),
    [layers, sequenceLength],
  )

  const machine = ACCELERATORS[accelerator]!

  const reports = useMemo(
    () => ({
      data: dataParallel(architecture, sequenceLength, 8, devices, 2, machine),
      tensor: tensorParallel(architecture, sequenceLength, 8, devices, 2, machine),
      pipeline: pipelineParallel(architecture, sequenceLength, 8, devices, microbatches, 2, machine),
    }),
    [architecture, sequenceLength, devices, microbatches, machine],
  )

  const deviceSweep = useMemo(() => {
    const rows: {
      devices: number
      dataBytes: number
      tensorBytes: number
      dataOverhead: number
      tensorOverhead: number
    }[] = []
    for (const count of [2, 4, 8, 16, 32, 64, 128]) {
      const data = dataParallel(architecture, sequenceLength, 8, count, 2, machine)
      const tensor = tensorParallel(architecture, sequenceLength, 8, count, 2, machine)
      rows.push({
        devices: count,
        dataBytes: data.communicationBytes,
        tensorBytes: tensor.communicationBytes,
        dataOverhead: data.overhead,
        tensorOverhead: tensor.overhead,
      })
    }
    return rows
  }, [architecture, sequenceLength, machine])

  const footprint = useMemo(() => attentionFootprint(architecture, sequenceLength, tile), [architecture, sequenceLength, tile])
  const kernel = useMemo(() => kernelIntensity(architecture, sequenceLength), [architecture, sequenceLength])
  const balance = machine.peakFlops / machine.bandwidth

  const kernelSweep = useMemo(() => {
    const rows: { length: number; materialised: number; tiled: number; ratio: number }[] = []
    for (const length of [512, 1024, 2048, 4096, 8192]) {
      const measured = attentionFootprint(architecture, length, tile)
      rows.push({
        length,
        materialised: measured.materialised,
        tiled: measured.tiled,
        ratio: measured.ratio,
      })
    }
    return rows
  }, [architecture, tile])

  return (
    <div className="lab">
      <Panel
        title="Laboratory G · Systems"
        subtitle="What the hierarchy costs, what the interconnect costs, and what a tiled kernel saves"
        accent="emerald"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'parallelism', label: 'The splits' },
              { value: 'kernel', label: 'The kernel' },
            ]}
          />
          <Slider label="Devices" value={devices} min={2} max={128} step={2} onChange={setDevices} />
          <Slider label="Layers" value={layers} min={1} max={48} onChange={setLayers} />
          <Slider
            label="Sequence length"
            value={sequenceLength}
            min={512}
            max={8192}
            step={512}
            onChange={setSequenceLength}
          />
          <Slider label="Microbatches" value={microbatches} min={1} max={32} onChange={setMicrobatches} />
          <Slider label="Attention tile" value={tile} min={32} max={512} step={32} onChange={setTile} />
          <div className="field">
            <label className="field-label" htmlFor="systems-accelerator">
              The machine
            </label>
            <select
              id="systems-accelerator"
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

        {view === 'parallelism' ? (
          <>
            <div className="stat-row">
              <Stat
                label="FLOPs per device"
                value={`${(reports.data.flopsPerDevice / 1e12).toFixed(2)} T`}
                hint="one data-parallel step"
              />
              <Stat
                label="The gradient all-reduce"
                value={`${gib(reports.data.communicationBytes).toFixed(2)} GiB`}
                hint="per device, per step"
              />
              <Stat
                label="Communication share of the compute"
                value={`${fmt(reports.data.overhead * 100, 0)}%`}
                hint="with no overlap"
                tone={reports.data.overhead > 0.5 ? 'warn' : 'good'}
              />
              <Stat
                label="Pipeline idle fraction"
                value={`${fmt(pipelineBubble(devices, microbatches) * 100, 1)}%`}
                hint={`${devices} stages, ${microbatches} microbatches`}
                tone={pipelineBubble(devices, microbatches) > 0.25 ? 'warn' : 'good'}
              />
            </div>

            <Figure
              title="The three splits, at this shape"
              description="Data, tensor and pipeline parallelism at the same number of devices, with the communication each one requires."
              caption="Data parallelism all-reduces one gradient buffer per step. Tensor parallelism all-reduces activations inside every block, so its cost follows the sequence length. Pipeline parallelism sends activations between stages, and pays for the fill and drain."
            >
              <DataTable
                caption="The three kinds of parallelism"
                headers={['Split', 'Devices', 'FLOPs per device', 'Communication', 'FLOPs per byte', 'Share of compute']}
                rows={[
                  [
                    'data',
                    devices,
                    `${(reports.data.flopsPerDevice / 1e12).toFixed(2)} T`,
                    `${mib(reports.data.communicationBytes).toFixed(0)} MiB`,
                    fmt(reports.data.intensity, 1),
                    `${fmt(reports.data.overhead * 100, 1)}%`,
                  ],
                  [
                    'tensor',
                    devices,
                    `${(reports.tensor.flopsPerDevice / 1e12).toFixed(2)} T`,
                    `${mib(reports.tensor.communicationBytes).toFixed(0)} MiB`,
                    fmt(reports.tensor.intensity, 1),
                    `${fmt(reports.tensor.overhead * 100, 1)}%`,
                  ],
                  [
                    'pipeline',
                    devices,
                    `${(reports.pipeline.flopsPerDevice / 1e12).toFixed(3)} T`,
                    `${mib(reports.pipeline.communicationBytes).toFixed(0)} MiB`,
                    fmt(reports.pipeline.intensity, 1),
                    `${fmt(reports.pipeline.overhead * 100, 1)}%`,
                  ],
                ]}
              />
            </Figure>

            <Figure
              title="The all-reduce as the devices grow"
              description="The communication per device and its share of the compute, for data and tensor parallelism, as the device count rises."
              caption="A ring all-reduce moves 2·(d−1)/d times the buffer per device, so the data-parallel cost approaches twice the parameter bytes rather than growing without bound. The compute per device falls as the devices rise, so the share of time spent communicating rises anyway."
            >
              <DataTable
                caption="Scaling the device count"
                headers={['Devices', 'Data all-reduce', 'Data share', 'Tensor all-reduce', 'Tensor share']}
                rows={deviceSweep.map((row) => [
                  row.devices,
                  `${mib(row.dataBytes).toFixed(0)} MiB`,
                  `${fmt(row.dataOverhead * 100, 1)}%`,
                  `${mib(row.tensorBytes).toFixed(0)} MiB`,
                  `${fmt(row.tensorOverhead * 100, 1)}%`,
                ])}
              />
            </Figure>

            <Callout tone="definition" title="What each split buys and what it costs">
              Data parallelism buys throughput and costs one gradient all-reduce per step. Tensor parallelism buys the
              ability to put a single sequence on more than one device, and costs an all-reduce inside every block.
              Pipeline parallelism buys depth and costs the fill and drain — the bubble is {fmt(pipelineBubble(devices, microbatches) * 100, 1)}% of
              the schedule at these settings, which is why pipelining wants many microbatches.
            </Callout>
          </>
        ) : null}

        {view === 'kernel' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The scores, materialised"
                value={`${gib(footprint.materialised).toFixed(2)} GiB`}
                hint="written once"
              />
              <Stat
                label="The scores, tiled"
                value={`${gib(footprint.tiled).toFixed(2)} GiB`}
                hint={`a ${tile}-token block at a time`}
              />
              <Stat
                label="The saving"
                value={`${fmt(footprint.ratio, 1)}×`}
                hint="less memory, same arithmetic"
                tone={footprint.ratio > 2 ? 'good' : 'warn'}
              />
              <Stat
                label="The kernel’s intensity"
                value={fmt(kernel, 1)}
                hint={`the machine’s balance point is ${fmt(balance, 0)}`}
                tone={kernel < balance ? 'warn' : 'good'}
              />
            </div>

            <Figure
              title="A memory-efficient attention kernel"
              description="The memory the attention kernel needs, with and without a tiled implementation, as the sequence length grows."
              caption="The plain kernel keeps the whole n × n score matrix for every head. The tiled kernel keeps one block of it, so its footprint grows linearly with the sequence rather than quadratically. The FLOPs are identical — this is a bandwidth optimisation, and the recomputation is the price."
            >
              <DataTable
                caption="The attention footprint"
                headers={['Sequence length', 'Materialised', 'Tiled', 'Saving']}
                rows={kernelSweep.map((row) => [
                  row.length.toLocaleString(),
                  `${gib(row.materialised).toFixed(2)} GiB`,
                  `${gib(row.tiled).toFixed(2)} GiB`,
                  `${fmt(row.ratio, 1)}×`,
                ])}
              />
            </Figure>

            <Callout tone="note" title={`What the tiling cannot fix`}>
              The kernel’s arithmetic intensity here is {fmt(kernel, 1)} operations per byte, against a balance point of{' '}
              {fmt(balance, 0)}. It stays below the balance point at every sequence length, because the intensity is set
              by the head dimension rather than by the problem size. Tiling reduces the memory traffic; it does not turn
              the kernel into an arithmetic-bound one.
            </Callout>

            <Callout tone="definition" title="The hierarchy underneath both">
              The H100’s shared memory is {mib(HIERARCHY.levels[0]!.capacity).toFixed(0)} MiB per SM and its HBM delivers{' '}
              {(HIERARCHY.levels[2]!.bandwidth / 1e12).toFixed(2)} TB/s. A kernel is optimised against one of those
              ceilings or the other, and which one binds is a property of the kernel and the level, not of the model.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
