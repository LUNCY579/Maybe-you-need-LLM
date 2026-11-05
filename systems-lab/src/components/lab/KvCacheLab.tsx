import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  EXAMPLE_MODEL,
  MACHINE_BALANCE,
  SERVING_DEVICE,
  addSequence,
  appendToken,
  computeBoundBatchSize,
  createPool,
  decodeArithmeticIntensity,
  decodeThroughput,
  freeBlocks,
  freeSequence,
  forkSequence,
  kvCacheBytes,
  maxServingBatch,
  minimumDevices,
  pagedAllocation,
  poolStats,
  throughputCurve,
  weightBytes,
} from '../../core/kvcache'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { KVCACHE_DEFAULTS } from '../../content/labDefaults'

type View = 'intensity' | 'paging' | 'branch' | 'serving'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const KVCACHE_VIEWS: { value: View; label: string }[] = [
  { value: 'intensity', label: 'The intensity' },
  { value: 'paging', label: 'The pages' },
  { value: 'branch', label: 'The branch' },
  { value: 'serving', label: 'The batch' },
]

export function KvCacheLab() {
  const [view, setView] = useViewParam(KVCACHE_VIEWS)
  const [context, setContext] = useState(KVCACHE_DEFAULTS.context)
  const [batch, setBatch] = useState(KVCACHE_DEFAULTS.batch)
  const [blockSize, setBlockSize] = useState(KVCACHE_DEFAULTS.blockSize)
  const [layers, setLayers] = useState(KVCACHE_DEFAULTS.layers)
  const [heads, setHeads] = useState(KVCACHE_DEFAULTS.heads)
  const [bytesPerElement, setBytesPerElement] = useState(KVCACHE_DEFAULTS.bytesPerElement)
  const [devices, setDevices] = useState(KVCACHE_DEFAULTS.devices)
  const [branches, setBranches] = useState(3)

  const model = useMemo(
    () => ({ ...EXAMPLE_MODEL, layers, heads }),
    [layers, heads],
  )

  const intensity = useMemo(
    () => decodeArithmeticIntensity(model, batch, context, { bytesPerElement }),
    [model, batch, context, bytesPerElement],
  )
  const curve = useMemo(() => {
    const rows: { x: number; intensity: number }[] = []
    for (const size of [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]) {
      rows.push({ x: size, intensity: decodeArithmeticIntensity(model, size, context, { bytesPerElement }) })
    }
    return rows
  }, [model, context, bytesPerElement])

  const lengths = useMemo(
    () => [37, 128, 201, 64, 512, 99, 333, 76, 450, 120],
    [],
  )
  const allocation = useMemo(
    () => pagedAllocation(model, lengths, { blockSize, bytesPerElement }),
    [model, lengths, blockSize, bytesPerElement],
  )

  // The pool is a small script: one request runs to the context length, it
  // branches `branches` ways, each child writes a little, and the parent is
  // dropped. Everything below is read off the pool that script leaves.
  const pool = useMemo(() => {
    let state = createPool({ blockSize })
    const parent = addSequence(state)
    state = parent.pool
    for (let token = 0; token < context; token++) state = appendToken(state, parent.sequence)
    const childIds: number[] = []
    for (let branch = 0; branch < branches; branch++) {
      const forked = forkSequence(state, parent.sequence)
      state = forked.pool
      childIds.push(forked.sequence)
      for (let token = 0; token < 4; token++) state = appendToken(state, forked.sequence)
    }
    const beforeFree = state
    const afterFree = freeBranches(beforeFree, parent.sequence)
    return { running: beforeFree, freedParent: afterFree, childIds }
  }, [blockSize, context, branches])

  const runningStats = useMemo(() => poolStats(pool.running), [pool.running])
  const freedStats = useMemo(() => poolStats(pool.freedParent), [pool.freedParent])
  const naiveBranchBlocks = useMemo(
    () => 1 + branches * Math.ceil(context / blockSize),
    [branches, context, blockSize],
  )

  const step = useMemo(
    () => decodeThroughput(model, batch, context, { bytesPerElement, device: { ...SERVING_DEVICE, memoryBytes: SERVING_DEVICE.memoryBytes * devices } }),
    [model, batch, context, bytesPerElement, devices],
  )
  const servingCurve = useMemo(() => {
    const rows: { x: number; tokens: number; memory: number }[] = []
    for (const point of throughputCurve(model, context, {
      maxBatch: 1024,
      stride: 8,
      bytesPerElement,
      device: { ...SERVING_DEVICE, memoryBytes: SERVING_DEVICE.memoryBytes * devices },
    })) {
      rows.push({
        x: point.batchSize,
        tokens: point.tokensPerSecond,
        memory: point.cacheMemoryFraction,
      })
    }
    return rows
  }, [model, context, bytesPerElement, devices])
  const serving = useMemo(
    () => maxServingBatch(model, context, { bytesPerElement, devices }),
    [model, context, bytesPerElement, devices],
  )
  const devicesNeeded = useMemo(
    () => minimumDevices(model, { bytesPerElement }),
    [model, bytesPerElement],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory B · The KV cache"
        subtitle="Why decoding is a memory problem, and how to give the memory out"
        accent="teal"
      >
        <div className="lab-controls">
          <SegmentedControl label="View" value={view} onChange={setView} options={KVCACHE_VIEWS} />
          <Slider label="The context" value={context} min={64} max={8192} step={64} onChange={setContext} />
          <Slider label="The batch" value={batch} min={1} max={1024} step={1} onChange={setBatch} />
          <Slider label="The layers" value={layers} min={8} max={120} step={4} onChange={setLayers} />
          <Slider label="The heads" value={heads} min={8} max={128} step={8} onChange={setHeads} />
          <Slider label="The block size" value={blockSize} min={4} max={64} step={4} onChange={setBlockSize} />
          <Slider
            label="Bytes per cached element"
            value={bytesPerElement}
            min={1}
            max={4}
            step={1}
            onChange={setBytesPerElement}
          />
          <Slider label="The devices" value={devices} min={1} max={16} step={1} onChange={setDevices} />
          <Slider label="The branches" value={branches} min={1} max={8} step={1} onChange={setBranches} />
        </div>

        <div className="stat-row">
          <Stat
            label="The arithmetic intensity"
            value={fmt(intensity, 2)}
            hint="operations per byte"
            tone={intensity >= MACHINE_BALANCE ? 'good' : 'warn'}
          />
          <Stat
            label="The cache for one sequence"
            value={`${fmt(kvCacheBytes(model, context, { bytesPerElement }) / (1024 * 1024), 1)} MB`}
          />
          <Stat
            label="The weights"
            value={`${fmt(weightBytes(model, { bytesPerElement }) / (1024 * 1024 * 1024), 1)} GB`}
          />
          <Stat
            label="The batch that makes it compute-bound"
            value={String(computeBoundBatchSize(model, context, { bytesPerElement }))}
          />
        </div>

        {view === 'intensity' ? (
          <>
            <Figure
              title="The intensity against the batch size"
              description="The operations per byte a decode step does, as the batch grows."
              caption="The intensity rises and then stops. The weights are read once for the whole batch, so that part of the intensity grows with the batch; the cache is read once for every sequence in it, so that part never does."
            >
              <TrendChart
                data={curve}
                series={[{ key: 'intensity', name: 'the arithmetic intensity', colour: 'var(--accent-teal)' }]}
                xLabel="the batch size"
                yLabel="operations per byte"
                height={280}
              />
            </Figure>

            <Callout tone="note" title="What the balance point means">
              A machine has a balance point: the intensity at which the arithmetic and the memory take the same time.
              Above it a step is compute-bound, and below it a step is memory-bound. The line on the chart is that
              point for a typical accelerator, and the batch size is the lever that gets a decode step over it.
            </Callout>
          </>
        ) : null}

        {view === 'paging' ? (
          <>
            <Figure
              title="Two ways to hand out the memory"
              description="A batch of ten sequences of different lengths, and the memory each scheme holds."
              caption="The padded scheme gives every sequence a buffer as long as the longest one. The paged scheme gives every sequence whole blocks, and the blocks can live anywhere."
            >
              <DataTable
                caption="The allocation"
                headers={['The scheme', 'The memory', 'The waste', 'The waste as a fraction']}
                rows={[
                  [
                    'padded',
                    `${fmt(allocation.padded.totalBytes / (1024 * 1024), 2)} MB`,
                    `${fmt(allocation.padded.wastedBytes / (1024 * 1024), 2)} MB`,
                    `${fmt(allocation.padded.wasteFraction * 100, 1)}%`,
                  ],
                  [
                    'paged',
                    `${fmt(allocation.paged.totalBytes / (1024 * 1024), 2)} MB`,
                    `${fmt(allocation.paged.wastedBytes / (1024 * 1024), 2)} MB`,
                    `${fmt(allocation.paged.wasteFraction * 100, 1)}%`,
                  ],
                ]}
              />
            </Figure>

            <Figure
              title="Every sequence, and what it wastes"
              description="The length of each sequence, the blocks it takes, and the tokens that are wasted in them."
              caption="The waste is the tail of the last block. It is a fraction of a block per sequence, and it does not grow with the length of the longest sequence in the batch."
            >
              <DataTable
                caption="The sequences"
                headers={['The sequence', 'Its length', 'The blocks', 'The tokens wasted']}
                rows={lengths.map((length) => {
                  const blocks = Math.ceil(length / blockSize)
                  return [length, length, blocks, blocks * blockSize - length]
                })}
              />
            </Figure>

            <Callout tone="definition" title="Why the page table is the answer">
              The waste of the padded scheme is proportional to the batch: every sequence pays for the longest one. The
              waste of the paged scheme is a fraction of a block per sequence, whatever the lengths are. That is the
              whole of the argument, and it is a bookkeeping argument rather than an arithmetic one.
            </Callout>
          </>
        ) : null}

        {view === 'branch' ? (
          <>
            <div className="stat-row">
              <Stat label="The blocks held" value={String(runningStats.allocatedBlocks)} />
              <Stat
                label="The blocks a copy would need"
                value={String(naiveBranchBlocks)}
                tone={runningStats.allocatedBlocks < naiveBranchBlocks ? 'good' : 'warn'}
              />
              <Stat label="The blocks copied" value={String(runningStats.copies)} hint="one per branch, at most" />
              <Stat
                label="The tokens shared rather than duplicated"
                value={fmt(runningStats.tokensSavedBySharing, 0)}
              />
            </div>

            <Figure
              title={`One request, ${branches} futures`}
              description="The block table of every sequence in the pool, and how many tables name each block."
              caption="A branch takes the parent's block numbers. Only the block still being written — the partly filled tail — has to be copied, because that is the only place the two futures differ. So the memory cost of branching is one block, not the whole prefix."
            >
              <DataTable
                caption="The pool after the branches"
                headers={['The sequence', 'Its blocks', 'Its tokens', 'Blocks shared with the parent']}
                rows={[
                  ['the parent', tableLength(pool.running, 0), tableTokens(pool.running, 0), '—'],
                  ...pool.childIds.map((id, index) => [
                    `child ${index + 1}`,
                    tableLength(pool.running, id),
                    tableTokens(pool.running, id),
                    sharedWithParent(pool.running, id, 0),
                  ]),
                ]}
              />
            </Figure>

            <Figure
              title="What the parent leaving reclaims"
              description="The pool before and after the parent's table is dropped, while its children keep running."
              caption="The parent's blocks were named by its own table and by each child's, so the count only falls once the last reader goes. The child tables are untouched, and the blocks the parent wrote before the branch are still there — with nobody left to read them, they go on the free list."
            >
              <DataTable
                caption="The pool, before and after"
                headers={['The moment', 'The sequences', 'The blocks', 'The tokens held', 'The blocks free']}
                rows={[
                  [
                    'every branch running',
                    runningStats.sequences,
                    runningStats.allocatedBlocks,
                    runningStats.usedTokens,
                    freeBlocks(pool.running),
                  ],
                  [
                    'the parent dropped',
                    freedStats.sequences,
                    freedStats.allocatedBlocks,
                    freedStats.usedTokens,
                    freeBlocks(pool.freedParent),
                  ],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="Sharing is only free while someone reads">
              A block with three references costs one block. Free the parent and the children keep those blocks alive —
              which is why a server that branches has to count references rather than ask whether a sequence still
              wants its memory.
            </Callout>
          </>
        ) : null}

        {view === 'serving' ? (
          <>
            <div className="stat-row">
              <Stat label="Tokens per second" value={fmt(step.tokensPerSecond, 0)} tone="good" />
              <Stat label="Milliseconds per token" value={fmt(step.latencyMs, 2)} />
              <Stat
                label="The step is bound by"
                value={step.boundBy}
                tone={step.boundBy === 'memory' ? 'warn' : 'good'}
              />
              <Stat
                label="The cache as a share of memory"
                value={`${fmt(step.cacheMemoryFraction * 100, 1)}%`}
                tone={step.cacheMemoryFraction > 1 ? 'warn' : 'good'}
                hint={step.cacheMemoryFraction > 1 ? 'this batch does not fit' : 'fits'}
              />
            </div>

            <Figure
              title="Throughput against batch size, and the memory that caps it"
              description="Tokens per second on the left, and the share of the devices' memory the cache needs on the right."
              caption="The curve keeps rising while the step is memory-bound — the weights are read once for the batch, so a bigger batch is nearly free — and flattens when the arithmetic takes over. Points above the line at one are not servable: the cache alone would not fit, however fast the machine is."
            >
              <TrendChart
                data={servingCurve}
                series={[
                  { key: 'tokens', name: 'tokens per second', colour: 'var(--accent-teal)' },
                  { key: 'memory', name: 'the cache as a share of memory', colour: 'var(--accent-rose)' },
                ]}
                xLabel="the batch size"
                yLabel="tokens per second, and the memory fraction"
                height={300}
              />
            </Figure>

            <Figure
              title="How many sequences one service can hold"
              description="The memory the weights leave over, the bytes each token of context costs, and the batch that fits."
              caption="The weights are resident first, so the batch is whatever memory is left divided by the cache of one sequence. A longer context cuts it in proportion, and a wider model cuts it faster than that."
            >
              <DataTable
                caption="The serving arithmetic"
                headers={['The device', 'The weights', 'Bytes per cached token', 'The batch that fits', 'Limited by']}
                rows={[
                  [
                    `${devices} × ${fmt(SERVING_DEVICE.memoryBytes / 1e9, 0)} GB`,
                    `${fmt(weightBytes(model, { bytesPerElement }) / 1e9, 1)} GB`,
                    fmt(serving.bytesPerToken, 0),
                    serving.limitedBy === 'weights' ? '—' : fmt(serving.batch, 0),
                    serving.limitedBy === 'weights'
                      ? `the weights need ${devicesNeeded}`
                      : 'nothing yet',
                  ],
                  [
                    'the minimum that holds the model',
                    `${fmt(weightBytes(model, { bytesPerElement }) / 1e9, 1)} GB`,
                    fmt(serving.bytesPerToken, 0),
                    '0 at first',
                    `${devicesNeeded} device${devicesNeeded === 1 ? '' : 's'}`,
                  ],
                ]}
              />
            </Figure>

            <Callout tone="note" title="Why a long context is a serving problem">
              At {fmt(context, 0)} tokens of context and {fmt(bytesPerElement, 0)} bytes an element, one sequence's cache
              is {fmt(kvCacheBytes(model, context, { bytesPerElement }) / (1024 * 1024), 0)} megabytes. The arithmetic
              says a batch of thousands is compute-bound and therefore cheap; the memory says this service holds{' '}
              {serving.limitedBy === 'weights' ? 'nothing until the model is split' : `${fmt(serving.batch, 0)} sequences`}.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}

/** Drop one sequence and leave the rest running. */
function freeBranches(pool: ReturnType<typeof createPool>, sequence: number) {
  return freeSequence(pool, sequence)
}

function tableLength(pool: ReturnType<typeof createPool>, sequence: number): number {
  return pool.tables[sequence]?.length ?? 0
}

function tableTokens(pool: ReturnType<typeof createPool>, sequence: number): number {
  const table = pool.tables[sequence] ?? []
  return table.reduce((sum, blockId) => sum + (pool.blocks[blockId]?.tokens ?? 0), 0)
}

/** How many of a child's blocks are also named by the parent's table. */
function sharedWithParent(pool: ReturnType<typeof createPool>, sequence: number, parent: number): number {
  const parentBlocks = new Set(pool.tables[parent] ?? [])
  return (pool.tables[sequence] ?? []).filter((blockId) => parentBlocks.has(blockId)).length
}
