import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { compareReaders, needleCurve, readWithRetrieval } from '../../core/context'
import { memoryReport } from '../../core/memory'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'reader' | 'position' | 'comparison' | 'memory'

export function ContextLab() {
  const [view, setView] = useState<View>('reader')
  const [length, setLength] = useState(100)
  const [positionStrength, setPositionStrength] = useState(3)
  const [temperature, setTemperature] = useState(1)
  const [seed, setSeed] = useState(4)
  const [parameters, setParameters] = useState(7)
  const [passages, setPassages] = useState(21)
  const [width, setWidth] = useState(768)
  const [precision, setPrecision] = useState<'fp16' | 'fp32'>('fp32')

  const distractors = useMemo(() => [11, 12, 13, 14, 15, 16], [])
  const questionWord = 21

  const curve = useMemo(
    () => needleCurve({ length, positionStrength, temperature, seed, questionWord, distractorWords: distractors }),
    [length, positionStrength, temperature, seed, distractors],
  )

  const comparison = useMemo(
    () => compareReaders({ length, positionStrength, temperature, seed, questionWord, distractorWords: distractors }),
    [length, positionStrength, temperature, seed, distractors],
  )

  const retrieved = useMemo(
    () =>
      readWithRetrieval({
        length,
        positionStrength,
        temperature,
        seed,
        questionWord,
        distractorWords: distractors,
        retrieved: true,
        position: 0,
      }),
    [length, positionStrength, temperature, seed, distractors],
  )

  const lost = useMemo(
    () =>
      readWithRetrieval({
        length,
        positionStrength,
        temperature,
        seed,
        questionWord,
        distractorWords: distractors,
        retrieved: false,
      }),
    [length, positionStrength, temperature, seed, distractors],
  )

  const bytesPerValue = precision === 'fp16' ? 2 : 4
  const report = useMemo(
    () =>
      memoryReport({
        parameters: parameters * 1e9,
        passages: passages * 1e6,
        dimension: width,
        bytesPerValue,
      }),
    [parameters, passages, width, bytesPerValue],
  )

  const decades = useMemo(
    () =>
      [1e6, 1e7, 1e8, 1e9, 1e10].map((count) =>
        memoryReport({
          parameters: parameters * 1e9,
          passages: count,
          dimension: width,
          bytesPerValue,
        }),
      ),
    [parameters, width, bytesPerValue],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory D · The long context"
        subtitle="Where the evidence is put, and whether it is used"
        accent="emerald"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'reader', label: 'The reader' },
              { value: 'position', label: 'The position' },
              { value: 'comparison', label: 'The comparison' },
              { value: 'memory', label: 'The two memories' },
            ]}
          />
          {view === 'memory' ? (
            <>
              <Slider
                label="The parameters of the model, in billions"
                value={parameters}
                min={1}
                max={70}
                step={1}
                onChange={setParameters}
              />
              <Slider
                label="The passages in the index, in millions"
                value={passages}
                min={1}
                max={100}
                step={1}
                onChange={setPassages}
              />
              <Slider
                label="The width of a passage vector"
                value={width}
                min={128}
                max={1024}
                step={128}
                onChange={setWidth}
              />
              <SegmentedControl
                label="The precision of the vectors"
                value={precision}
                onChange={setPrecision}
                options={[
                  { value: 'fp16', label: 'half precision' },
                  { value: 'fp32', label: 'single precision' },
                ]}
              />
            </>
          ) : (
            <>
              <Slider label="The length of the context" value={length} min={20} max={400} step={10} onChange={setLength} />
              <Slider
                label="The strength of the position prior"
                value={positionStrength}
                min={0}
                max={8}
                step={0.25}
                onChange={setPositionStrength}
                format={(value) => value.toFixed(2)}
              />
              <Slider
                label="The temperature"
                value={temperature}
                min={0.2}
                max={4}
                step={0.1}
                onChange={setTemperature}
                format={(value) => value.toFixed(1)}
              />
              <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
            </>
          )}
        </div>

        {view === 'memory' ? (
          <div className="stat-row">
            <Stat label="The weights" value={`${fmt(report.parametricGB, 1)} GB`} />
            <Stat
              label="The index"
              value={`${fmt(report.nonParametricGB, 1)} GB`}
              tone={report.ratio > 1 ? 'warn' : 'good'}
            />
            <Stat label="The index over the weights" value={`${fmt(report.ratio, 2)}×`} />
            <Stat
              label="The corpus where they cross"
              value={`${Math.round(report.crossoverPassages).toLocaleString()} passages`}
            />
          </div>
        ) : (
          <div className="stat-row">
            <Stat
              label="The long-context accuracy"
              value={`${fmt(comparison.longContext * 100, 0)}%`}
              tone="warn"
            />
            <Stat
              label="With the evidence retrieved"
              value={`${fmt(comparison.retrieval * 100, 0)}%`}
              tone="good"
            />
            <Stat
              label="The attention at the start"
              value={fmt(retrieved.attention, 4)}
            />
            <Stat label="The attention with nothing retrieved" value={fmt(lost.attention, 4)} tone="warn" />
          </div>
        )}

        {view === 'reader' ? (
          <>
            <Figure
              title="The reader, with and without the evidence"
              description="The attention the reader pays to the evidence when the retriever found it, and what is left when it did not."
              caption="The retrieval is what puts the evidence in front of the reader. Without it, the reader has nothing to attend to but the distractors."
            >
              <DataTable
                caption="The two cases"
                headers={['The case', 'The evidence', 'The attention to it', 'Found?']}
                rows={[
                  ['the evidence was retrieved', 'at the start of the context', fmt(retrieved.attention, 4), retrieved.found ? 'yes' : 'no'],
                  ['the evidence was lost', 'nowhere', fmt(lost.attention, 4), lost.found ? 'yes' : 'no'],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="The division of labour">
              The retriever decides <em>what</em> is in the context; the reader decides <em>whether</em> it is used.
              Both halves have to work, and they fail in different ways: a retriever that misses the evidence is a
              recall failure, and a reader that ignores it is a position failure.
            </Callout>
          </>
        ) : null}

        {view === 'position' ? (
          <>
            <Figure
              title="The attention, against the position"
              description="The share of the attention a single document receives, as it is moved through the context."
              caption="The needle in the middle gets the least attention. Nothing about the document has changed — only where it is."
            >
              <TrendChart
                data={curve.map((point) => ({ x: point.relative, attention: point.attention }))}
                series={[{ key: 'attention', name: 'the attention to the document', colour: 'var(--accent-emerald)' }]}
                xLabel="the position in the context"
                yLabel="the attention"
                height={270}
              />
            </Figure>

            <Figure
              title="Every position, in full"
              description="The attention at each position, and whether the document was found."
              caption="The ends are used well and the middle is not. That is the position effect, and it is a property of how the model attends rather than of what the context contains."
            >
              <DataTable
                caption="The position effect"
                headers={['The position', 'The attention', 'Found?']}
                rows={curve.map((point) => [
                  `${fmt(point.relative * 100, 0)}%`,
                  fmt(point.attention, 5),
                  point.found ? 'yes' : 'no',
                ])}
              />
            </Figure>

            <Callout tone="warning" title="A context is not a place">
              The evidence has to be in the context, and it has to be where the reader looks. Those are two different
              requirements, and a pipeline that satisfies only the first will be surprised.
            </Callout>
          </>
        ) : null}

        {view === 'comparison' ? (
          <>
            <Figure
              title="The two ways of answering"
              description="The accuracy of a reader that is given the whole context, against one that is given the evidence by retrieval."
              caption="Both readers have the same evidence available. The difference is where it is, and how much of the context there is to lose it in."
            >
              <DataTable
                caption="The comparison"
                headers={['The reader', 'The accuracy', 'The evidence']}
                rows={[
                  ['the long-context reader', `${fmt(comparison.longContext * 100, 0)}%`, 'somewhere in the context'],
                  ['the retrieval-augmented reader', `${fmt(comparison.retrieval * 100, 0)}%`, 'at the start, because the retriever put it there'],
                ]}
              />
            </Figure>

            <Callout tone="note" title="What a long context changes">
              A longer context raises the ceiling: everything can be present at once, so more questions are answerable
              in principle. It does not follow that everything is used. The position effect lowers the floor, and the
              retrieval pipeline is what keeps it high.
            </Callout>
          </>
        ) : null}

        {view === 'memory' ? (
          <>
            <p className="body-text">
              A retrieval-augmented system keeps knowledge twice. The reader holds it in its weights, and the retriever
              holds it in an index of vectors. The two are bought in different units — parameters against passages — and
              this view counts the bytes of each. The defaults take the index of the open-domain setting — twenty-one
              million passages, seven hundred and sixty-eight values each — and put it against a seven-billion-parameter
              reader stored at two bytes per weight.
            </p>

            <Figure
              title="The bill for each memory"
              description="What each of the two memories costs at the settings above, and where the two bills are equal."
              caption="At these settings the index costs a multiple of the reader’s weights, and the multiple grows with every passage added. The crossover is the corpus at which one costs as much as the other; below it the weights dominate, above it the index does."
            >
              <DataTable
                caption="The two memories"
                headers={['The memory', 'What it is counted in', 'The size', 'What changes it']}
                rows={[
                  [
                    'the parametric memory',
                    `${(parameters * 1e9).toLocaleString()} parameters at 2 bytes`,
                    `${fmt(report.parametricGB, 1)} GB`,
                    'the choice of model',
                  ],
                  [
                    'the non-parametric memory',
                    `${(passages * 1e6).toLocaleString()} passages × ${width} values at ${bytesPerValue} bytes`,
                    `${fmt(report.nonParametricGB, 1)} GB`,
                    'every passage written, deleted or re-encoded',
                  ],
                ]}
              />
            </Figure>

            <Figure
              title="The index, against the corpus"
              description="The size of the index and its ratio to the weights, for corpora from a million to ten billion passages."
              caption="Each decade of passages adds the same amount, because the index is linear in the corpus and the weights do not change with it. The ratio is the one number that says which memory you are paying for."
            >
              <DataTable
                caption="A decade at a time"
                headers={['The passages', 'The index', 'The index over the weights']}
                rows={[1e6, 1e7, 1e8, 1e9, 1e10].map((count, index) => [
                  count.toLocaleString(),
                  `${fmt(decades[index]!.nonParametricGB, 1)} GB`,
                  `${fmt(decades[index]!.ratio, 2)}×`,
                ])}
              />
            </Figure>

            <Callout tone="definition" title="What each memory can do">
              Weights are changed by training and cannot be inspected: a fact in the weights has no address. The index
              is changed by writing or deleting a passage and can be inspected, cited and corrected one entry at a time.
              That is the argument for retrieval — the knowledge becomes maintainable — and the price is the bill above,
              which grows with the corpus rather than staying fixed with the model.
            </Callout>

            <Callout tone="warning" title="A sizing model, not a benchmark">
              The bytes are counted exactly from the settings, and nothing else is counted: no passage metadata, no
              replicas, no compression, and no quantisation of the vectors below the precision chosen. An index with
              product quantisation is smaller than this, and one with filters or replication is larger. The crossover
              is where the two bills are equal in bytes, not where they are equal in usefulness.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
