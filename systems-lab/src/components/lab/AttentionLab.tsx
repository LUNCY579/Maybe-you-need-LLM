import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { createRng } from '@llm-materials/course-core'
import {
  EXAMPLE_DEVICE,
  blockSizeForSram,
  blockSizeSweep,
  ioBoundTrafficBytes,
  ioBoundWall,
  machineBalance,
  maxAbsDifference,
  naiveAttention,
  naiveKernelProfile,
  tiledAttention,
  tiledKernelProfile,
  tilingSpeedup,
  trainingMemoryBytes,
} from '../../core/attention'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { ATTENTION_DEFAULTS } from '../../content/labDefaults'

type View = 'naive' | 'tiled' | 'kernel'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const ATTENTION_VIEWS: { value: View; label: string }[] = [
  { value: 'naive', label: 'The matrix' },
  { value: 'tiled', label: 'The blocks' },
  { value: 'kernel', label: 'The wall' },
]

function randomMatrices(rows: number, dimension: number, seed: number) {
  const rng = createRng(seed)
  const make = () =>
    Array.from({ length: rows }, () => Array.from({ length: dimension }, () => rng() * 2 - 1))
  return { q: make(), k: make(), v: make() }
}

export function AttentionLab() {
  const [view, setView] = useViewParam(ATTENTION_VIEWS)
  const [length, setLength] = useState(ATTENTION_DEFAULTS.length)
  const [dimension, setDimension] = useState(ATTENTION_DEFAULTS.dimension)
  const [blockSize, setBlockSize] = useState(ATTENTION_DEFAULTS.blockSize)
  const [seed, setSeed] = useState(ATTENTION_DEFAULTS.seed)

  const matrices = useMemo(() => randomMatrices(length, dimension, seed), [length, dimension, seed])

  const naive = useMemo(() => naiveAttention(matrices.q, matrices.k, matrices.v), [matrices])
  const tiled = useMemo(
    () => tiledAttention(matrices.q, matrices.k, matrices.v, { blockSize }),
    [matrices, blockSize],
  )
  const difference = useMemo(() => maxAbsDifference(naive.output, tiled.output), [naive, tiled])

  const scaling = useMemo(() => {
    const rows: { x: number; naive: number; tiled: number }[] = []
    for (const n of [16, 32, 64, 128, 256]) {
      const inputs = randomMatrices(n, 8, 3)
      const naiveRun = naiveAttention(inputs.q, inputs.k, inputs.v)
      const tiledRun = tiledAttention(inputs.q, inputs.k, inputs.v, { blockSize: 16 })
      rows.push({
        x: n,
        naive: naiveRun.peakMemoryBytes / (1024 * 1024),
        tiled: tiledRun.peakMemoryBytes / (1024 * 1024),
      })
    }
    return rows
  }, [blockSize])

  // The kernel arithmetic is the same two algorithms read against a machine: the
  // device is quoted in `attention.ts` at order-of-magnitude level, and the toy's
  // length and width are what is profiled.
  const naiveKernel = useMemo(() => naiveKernelProfile(length, dimension), [length, dimension])
  const tiledKernel = useMemo(
    () => tiledKernelProfile(length, dimension, { blockSize }),
    [length, dimension, blockSize],
  )
  const balance = useMemo(() => machineBalance(EXAMPLE_DEVICE), [])
  const wall = useMemo(() => ioBoundWall(dimension), [dimension])
  const sramBlock = useMemo(() => blockSizeForSram(dimension), [dimension])
  const speedupCurve = useMemo(() => {
    const rows: { x: number; speedup: number; limit: number }[] = []
    for (const n of [16, 32, 64, 128, 256, 512, 1024, 2048, 4096]) {
      const run = tilingSpeedup(n, dimension, { blockSize: sramBlock })
      rows.push({ x: n, speedup: run.speedup, limit: (3 * sramBlock) / (2 * dimension) })
    }
    return rows
  }, [dimension, sramBlock])
  const sweep = useMemo(
    () => blockSizeSweep(length, dimension, { sizes: [1, 2, 4, 8, 16, 32, 64, 128, 256] }),
    [length, dimension],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory A · Attention memory"
        subtitle="The same answer, with and without the matrix"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl label="View" value={view} onChange={setView} options={ATTENTION_VIEWS} />
          <Slider label="The sequence length" value={length} min={8} max={256} step={8} onChange={setLength} />
          <Slider label="The head width" value={dimension} min={4} max={64} step={4} onChange={setDimension} />
          <Slider label="The block size" value={blockSize} min={4} max={64} step={4} onChange={setBlockSize} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="The naive memory" value={`${fmt(naive.peakMemoryBytes / 1024, 1)} kB`} tone="warn" />
          <Stat label="The tiled memory" value={`${fmt(tiled.peakMemoryBytes / 1024, 1)} kB`} tone="good" />
          <Stat
            label="The difference in the answer"
            value={difference.toExponential(2)}
            hint="they should be the same"
            tone={difference < 1e-9 ? 'good' : 'warn'}
          />
          <Stat
            label="The traffic saved"
            value={`${fmt((1 - tiled.hbmTrafficBytes / naive.hbmTrafficBytes) * 100, 1)}%`}
          />
        </div>

        {view === 'naive' ? (
          <>
            <Figure
              title="The memory, as the context grows"
              description="The peak memory the two algorithms need, against the length of the sequence."
              caption="The naive line grows with the square of the context and the tiled line grows with the context. The gap is the whole argument of the paper."
            >
              <TrendChart
                data={scaling}
                series={[
                  { key: 'naive', name: 'the naive attention', colour: 'var(--accent-rose)' },
                  { key: 'tiled', name: 'the tiled attention', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the sequence length"
                yLabel="the memory, in megabytes"
                height={280}
              />
            </Figure>

            <Figure
              title="What each one moves"
              description="The bytes read and written by each algorithm, and the number of times the keys are streamed past."
              caption="The naive algorithm writes the matrix and reads it back. The tiled one never writes it, and streams the keys past once for every block of queries."
            >
              <DataTable
                caption="The two algorithms, accounted for"
                headers={['The algorithm', 'The memory', 'The traffic', 'The passes over the keys']}
                rows={[
                  [
                    'the naive attention',
                    `${fmt(naive.peakMemoryBytes / 1024, 1)} kB`,
                    `${fmt(naive.hbmTrafficBytes / 1024, 1)} kB`,
                    naive.passes,
                  ],
                  [
                    'the tiled attention',
                    `${fmt(tiled.peakMemoryBytes / 1024, 1)} kB`,
                    `${fmt(tiled.hbmTrafficBytes / 1024, 1)} kB`,
                    tiled.passes,
                  ],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="The training run is worse than the forward pass">
              The forward pass throws the matrix away. The backward pass cannot: it needs the probabilities. So a naive
              training run keeps an N by N matrix per head per layer, and the memory a training run needs is much the
              worse of the two.
            </Callout>
          </>
        ) : null}

        {view === 'tiled' ? (
          <>
            <Figure
              title="The blocks, and what they cost"
              description="The block size, the memory the working set takes, and the number of passes over the keys."
              caption="A smaller block means a smaller working set and more passes. The block size is the knob that trades arithmetic against traffic."
            >
              <DataTable
                caption="The block sizes"
                headers={['The block size', 'The working set', 'The passes', 'The traffic']}
                rows={[4, 8, 16, 32, 64, 128]
                  .filter((size) => size <= Math.max(4, length))
                  .map((size) => {
                    const run = tiledAttention(matrices.q, matrices.k, matrices.v, { blockSize: size })
                    return [
                      size,
                      `${fmt(run.peakMemoryBytes / 1024, 1)} kB`,
                      run.passes,
                      `${fmt(run.hbmTrafficBytes / 1024, 1)} kB`,
                    ]
                  })}
              />
            </Figure>

            <Figure
              title="What the training run needs"
              description="The memory the backward pass forces, under the two algorithms."
              caption="The tiled algorithm keeps nothing, and recomputes the blocks when it needs them. That is arithmetic spent on purpose, and it is the trade the paper makes."
            >
              <DataTable
                caption="The training memory"
                headers={['The algorithm', 'The memory at this context']}
                rows={[
                  ['the naive attention', `${fmt(trainingMemoryBytes(length, dimension) / 1024, 1)} kB`],
                  [
                    'the tiled attention',
                    `${fmt(trainingMemoryBytes(length, dimension, { tiled: true, blockSize }) / 1024, 1)} kB`,
                  ],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="Why the two answers are the same">
              The softmax subtracts the largest score in the row so that the exponentials do not overflow. The tiled
              algorithm keeps that largest score as it goes, and when a larger one arrives it divides everything
              accumulated so far by the factor by which the maximum grew. The sum stays exact, and the answer is the
              naive one to the last bit the floating point allows.
            </Callout>
          </>
        ) : null}

        {view === 'kernel' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The machine's balance point"
                value={`${fmt(balance, 0)} flops per byte`}
                hint="quoted, not measured"
              />
              <Stat
                label="The naive kernel"
                value={`${fmt(naiveKernel.intensity, 1)} flops per byte`}
                tone={naiveKernel.bound === 'memory' ? 'warn' : 'good'}
                hint={`bound by ${naiveKernel.bound}`}
              />
              <Stat
                label="The tiled kernel"
                value={`${fmt(tiledKernel.intensity, 1)} flops per byte`}
                tone={tiledKernel.bound === 'memory' ? 'warn' : 'good'}
                hint={`bound by ${tiledKernel.bound}`}
              />
              <Stat
                label="The wall"
                value={`${fmt(wall.length, 0)} tokens`}
                hint="a score matrix that stays on chip"
              />
            </div>

            <Figure
              title="The two constraints, and the slower of them"
              description="Seconds the kernel spends on traffic and on arithmetic, and the time it actually takes."
              caption="The time is the maximum of the two, not the sum: the memory system and the tensor cores work at the same time, so a kernel that is starved of bytes cannot be made faster by giving it more arithmetic. The naive kernel's traffic term is the score matrix going out to the high-bandwidth memory and coming back."
            >
              <DataTable
                caption="The kernel profiled at this length and width"
                headers={['The kernel', 'The traffic', 'The operations', 'Seconds on bytes', 'Seconds on maths', 'The time']}
                rows={[
                  [
                    'naive',
                    `${fmt(naiveKernel.bytes / 1024, 1)} kB`,
                    fmt(naiveKernel.flops, 0),
                    `${fmt(naiveKernel.memorySeconds * 1e6, 2)} µs`,
                    `${fmt(naiveKernel.computeSeconds * 1e6, 2)} µs`,
                    `${fmt(naiveKernel.seconds * 1e6, 2)} µs`,
                  ],
                  [
                    'tiled',
                    `${fmt(tiledKernel.bytes / 1024, 1)} kB`,
                    fmt(tiledKernel.flops, 0),
                    `${fmt(tiledKernel.memorySeconds * 1e6, 2)} µs`,
                    `${fmt(tiledKernel.computeSeconds * 1e6, 2)} µs`,
                    `${fmt(tiledKernel.seconds * 1e6, 2)} µs`,
                  ],
                ]}
              />
            </Figure>

            <Figure
              title="The speed-up grows, then settles"
              description={`Tiling's saving against the context, at the block the on-chip memory allows (${sramBlock}).`}
              caption="Two arguments about the same kernel disagree, and the picture says which. The traffic naive attention removes is quadratic in the context, which suggests the saving should grow without limit; the traffic tiled attention keeps is the keys and values re-read once per query block, which is also linear in the context. Both kernels end up memory-bound, and the ratio of two linear terms is a constant — three halves of that block over the head width, the dotted line here."
            >
              <TrendChart
                data={speedupCurve}
                series={[
                  { key: 'speedup', name: 'the measured ratio', colour: 'var(--accent-indigo)' },
                  { key: 'limit', name: '3·block / 2·d', colour: 'var(--accent-amber)', dashed: true },
                ]}
                xLabel="the sequence length"
                yLabel="how many times faster"
                height={280}
              />
            </Figure>

            <Figure
              title="Past the wall the block does not fit"
              description="The block sizes, the traffic each one pays, and whether the pair of tiles fits in the on-chip memory."
              caption="The traffic keeps falling as the block grows, which is the Θ(N²d²/M) bound read at a fixed M — but a block larger than the memory is not a bigger block, it is a spilled one. The row where `fits` turns off is the size a kernel may actually choose."
            >
              <DataTable
                caption="The block sweep"
                headers={['The block', 'The traffic', 'The time', 'Fits on chip?']}
                rows={sweep.map((entry) => [
                  entry.blockSize,
                  `${fmt(entry.bytes / 1024, 1)} kB`,
                  `${fmt(entry.seconds * 1e6, 2)} µs`,
                  entry.fits ? 'yes' : 'no',
                ])}
              />
            </Figure>

            <Callout tone="definition" title="The wall, in one sentence">
              A score matrix is N by N, so the longest context whose matrix stays on chip is the square root of the
              memory over the bytes per element — here {fmt(wall.length, 0)} tokens, {fmt(wall.scoreMatrixBytes / 1024, 0)}{' '}
              kilobytes of it. Below that length the traffic never has to happen; above it the naive kernel's intensity
              flattens at one third of the head width, {fmt(wall.naiveIntensityLimit, 0)} operations per byte against
              this machine's {fmt(balance, 0)}, and no length makes it compute-bound. Tiling is what the lengths past the
              wall are spent on.
            </Callout>

            <Callout tone="note" title="The bound the paper states">
              {fmt(ioBoundTrafficBytes(length, dimension, EXAMPLE_DEVICE.sramBytes) / 1024, 1)} kilobytes is what
              Θ(N²d²/M) predicts at the block the memory allows, rather than the{' '}
              {fmt(tiledKernel.bytes / 1024, 1)} the sweep pays at the size you set. The two agree when the block you
              choose is the block the hardware chooses for you.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
