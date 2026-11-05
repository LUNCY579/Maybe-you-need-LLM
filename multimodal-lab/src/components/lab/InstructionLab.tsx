import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildInstructions, measureTax, taxCurve } from '../../core/instruction'
import {
  buildCaptions,
  generateInstructionData,
  project,
  projectionMatrix,
  projectionReport,
} from '../../core/llava'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'recipe' | 'tax' | 'projection' | 'captions'

const projectionCount = (value: number) => value.toLocaleString()

export function InstructionLab() {
  const [view, setView] = useState<View>('recipe')
  const [count, setCount] = useState(80)
  const [strength, setStrength] = useState(0.6)
  const [seed, setSeed] = useState(4)
  const [captionCount, setCaptionCount] = useState(12)
  const [visionWidth, setVisionWidth] = useState(1024)
  const [languageWidth, setLanguageWidth] = useState(4096)

  const examples = useMemo(() => buildInstructions(count, seed), [count, seed])
  const report = useMemo(() => measureTax(examples, { strength, seed }), [examples, strength, seed])
  const curve = useMemo(
    () => taxCurve(examples, [0.1, 0.3, 0.5, 0.7, 0.9], { seed }),
    [examples, seed],
  )

  const projection = useMemo(
    () => projectionReport({ visionWidth, languageWidth, tokens: 576 }),
    [visionWidth, languageWidth],
  )

  const toy = useMemo(() => {
    const matrix = projectionMatrix(8, 6, seed)
    const oneHot = [1, 0, 0, 0, 0, 0, 0, 0]
    return { row: matrix[0]!, projected: project(matrix, oneHot) }
  }, [seed])

  const captions = useMemo(() => buildCaptions(captionCount, seed), [captionCount, seed])
  const generated = useMemo(() => generateInstructionData(captions), [captions])
  const firstCaption = generated.data.slice(0, 5)
  const kindRows = (['describe', 'presence', 'absence', 'count', 'relation'] as const).map((kind) => {
    const example = generated.data.find((entry) => entry.kind === kind)
    return [
      kind,
      example?.question ?? '—',
      example?.answer ?? '—',
      String(generated.report.byKind[kind]),
    ]
  })

  return (
    <div className="lab">
      <Panel
        title="Laboratory B · The instruction tax"
        subtitle="What the tuning gains, what it gives up, and the projection it is trained through"
        accent="amber"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'recipe', label: 'The recipe' },
              { value: 'tax', label: 'The tax' },
              { value: 'projection', label: 'The projection' },
              { value: 'captions', label: 'From captions' },
            ]}
          />
          {view === 'recipe' || view === 'tax' ? (
            <Slider label="The instructions" value={count} min={20} max={400} step={20} onChange={setCount} />
          ) : null}
          {view === 'recipe' || view === 'tax' ? (
            <Slider
              label="The strength of the tuning"
              value={strength}
              min={0}
              max={1}
              step={0.05}
              onChange={setStrength}
              format={(value) => value.toFixed(2)}
            />
          ) : null}
          {view === 'captions' ? (
            <Slider
              label="The captions"
              value={captionCount}
              min={4}
              max={24}
              step={4}
              onChange={setCaptionCount}
            />
          ) : null}
          {view === 'projection' ? (
            <Slider
              label="The vision width"
              value={visionWidth}
              min={512}
              max={2048}
              step={128}
              onChange={setVisionWidth}
              hint="The width of one token from the frozen image encoder."
            />
          ) : null}
          {view === 'projection' ? (
            <Slider
              label="The language width"
              value={languageWidth}
              min={2048}
              max={8192}
              step={512}
              onChange={setLanguageWidth}
              hint="The width the language model reads."
            />
          ) : null}
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        {view === 'recipe' || view === 'tax' ? (
          <div className="stat-row">
            <Stat
              label="The gain on the instructions"
              value={`${fmt(report.gain * 100, 1)} points`}
              tone="good"
            />
            <Stat label="The tax" value={`${fmt(report.tax * 100, 1)} points`} tone="warn" />
            <Stat
              label="The ratio of the tax to the gain"
              value={fmt(report.ratio, 3)}
              hint="the number a practitioner is shopping for"
            />
            <Stat label="The instructions" value={String(examples.length)} />
          </div>
        ) : null}

        {view === 'projection' ? (
          <div className="stat-row">
            <Stat
              label="The parameters"
              value={projectionCount(projection.parameters)}
              hint="one matrix and one bias"
              tone="good"
            />
            <Stat
              label="The matrix"
              value={`${projectionCount(projection.matrixParameters)} entries`}
              hint={`${projection.visionWidth} × ${projection.languageWidth}`}
            />
            <Stat
              label="Tokens in, tokens out"
              value={`${projection.tokens} → ${projection.tokens}`}
              hint="the projection changes the width, not the count"
            />
            <Stat
              label="The output width"
              value={projectionCount(projection.outputWidth)}
              hint="the language model's width"
            />
          </div>
        ) : null}

        {view === 'captions' ? (
          <div className="stat-row">
            <Stat label="The captions" value={String(generated.report.captions)} />
            <Stat label="The instruction pairs" value={String(generated.report.total)} tone="good" />
            <Stat label="Pairs per caption" value={fmt(generated.report.perCaption, 2)} />
            <Stat
              label="Kinds of question"
              value={String(Object.values(generated.report.byKind).filter((value) => value > 0).length)}
            />
          </div>
        ) : null}

        {view === 'recipe' ? (
          <>
            <Figure
              title="The three stages"
              description="What each stage of the recipe is for, and what it changes."
              caption="The stages are in that order because each one needs the previous one: the model has to follow instructions before it can be told to look at an image."
            >
              <DataTable
                caption="The recipe"
                headers={['The stage', 'The data', 'What it produces']}
                rows={[
                  ['the alignment stage', 'instructions and their answers', 'a model that follows instructions'],
                  ['the visual alignment stage', 'image–instruction pairs', 'a model that reads images'],
                  ['the instruction tuning', 'visual conversations', 'a model that answers questions about pictures'],
                ]}
              />
            </Figure>

            <Callout tone="note" title="Few-shot is a different mechanism">
              Putting the examples in the context rather than in the weights is a different way of doing the same
              thing, and it is a different bill. The two are reported separately, and the course would rather you
              noticed the difference than admired the number.
            </Callout>
          </>
        ) : null}

        {view === 'tax' ? (
          <>
            <Figure
              title="The gain and the tax, as the tuning is strengthened"
              description="Both numbers against the strength of the instruction tuning."
              caption="The tax is a consequence of the training, so it grows with the tuning. Which is the good news: a consequence of the training is something the training can be made to avoid."
            >
              <TrendChart
                data={curve.map((row) => ({ x: row.strength * 100, gain: row.gain * 100, tax: row.tax * 100 }))}
                series={[
                  { key: 'gain', name: 'the gain on the instructions', colour: 'var(--accent-emerald)' },
                  { key: 'tax', name: 'the tax on the original task', colour: 'var(--accent-rose)' },
                ]}
                xLabel="the strength of the tuning"
                yLabel="in points"
                height={270}
              />
            </Figure>

            <Figure
              title="The two accuracies"
              description="The accuracy at the instructions and at the original task, before and after."
              caption="The tax is the difference on the second row. It is a measurement on the original task, with the same evaluation either side."
            >
              <DataTable
                caption="Before and after"
                headers={['The task', 'Before the tuning', 'After the tuning', 'The difference']}
                rows={[
                  [
                    'the instructions',
                    `${fmt(report.beforeInstructions * 100, 1)}%`,
                    `${fmt(report.afterInstructions * 100, 1)}%`,
                    `+${fmt(report.gain * 100, 1)} points`,
                  ],
                  [
                    'the original task',
                    `${fmt(report.beforeOriginal * 100, 1)}%`,
                    `${fmt(report.afterOriginal * 100, 1)}%`,
                    `−${fmt(report.tax * 100, 1)} points`,
                  ],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="What the tax is a tax on">
              The capability the model had before the tuning. It is not a defect of the method — it is what a change
              of the training does to a model — and it is the reason the recipe is usually run in stages, with the
              stages measured one at a time.
            </Callout>
          </>
        ) : null}

        {view === 'projection' ? (
          <>
            <Figure
              title="The projection's dimensions"
              description="The width of a visual token, the width of a language token, and the matrix that carries one to the other."
              caption="A linear map from the vision width to the language width. It has one row per vision coordinate and one column per language coordinate, and it is the only part of this path that is trained: the encoder on one side and the language model on the other are held still."
            >
              <DataTable
                caption="The bill"
                headers={['The quantity', 'The value']}
                rows={[
                  ['the vision width', projectionCount(projection.visionWidth)],
                  ['the language width', projectionCount(projection.languageWidth)],
                  ['visual tokens in', projectionCount(projection.tokens)],
                  ['visual tokens out', projectionCount(projection.tokens)],
                  ['the matrix', `${projectionCount(projection.matrixParameters)} entries`],
                  ['the bias', `${projectionCount(projection.biasParameters)} entries`],
                  ['the total', `${projectionCount(projection.parameters)} parameters`],
                ]}
              />
            </Figure>

            <Figure
              title="A one-hot patch selects one row"
              description="The first six coordinates of the matrix's first row, against the same coordinates of the projection of a one-hot token."
              caption="The projection is linear, so a token that is one-hot in coordinate 0 is sent to row 0 of the matrix. That is all a linear projection does: it is a learned lookup and a sum, and the sum is over the coordinates that are non-zero."
            >
              <DataTable
                caption="The same six numbers, computed twice"
                headers={['The computation', 'c₀', 'c₁', 'c₂', 'c₃', 'c₄', 'c₅']}
                rows={[
                  ['row 0 of the matrix', ...toy.row.map((value) => fmt(value, 4))],
                  ['the projection of a one-hot token', ...toy.projected.map((value) => fmt(value, 4))],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="What the parameter count depends on">
              The matrix has {projectionCount(projection.matrixParameters)} entries at these widths, and the count does
              not mention the number of tokens: projecting 576 tokens or 4 costs the same matrix. The tokens change the
              arithmetic per step and the length of the sequence the language model reads, not the size of the
              projection. A real LLaVA projector is trained against a frozen encoder and a frozen language model, so
              this matrix is the trainable part of that path, and the widths are the two towers' published widths.
            </Callout>
          </>
        ) : null}

        {view === 'captions' ? (
          <>
            <Figure
              title="One caption, five instruction pairs"
              description="The questions and answers generated from the first caption in the set."
              caption="Every answer is a function of the caption: which objects are present, how many there are, and what the subject is next to. Nothing is invented, which is what makes caption-derived data cheap — and what limits it to the facts a caption states."
            >
              <DataTable
                caption={captions[0]?.text ?? 'No captions'}
                headers={['The kind', 'The question', 'The answer']}
                rows={firstCaption.map((entry) => [entry.kind, entry.question, entry.answer])}
              />
            </Figure>

            <Figure
              title="What the generator produces"
              description="One question of each kind, and how many pairs of that kind the set contains."
              caption="Five pairs per caption, and the counts are exact: the generator knows how many captions it read and how many questions it wrote from each. The vocabulary is deliberately small, so every answer can be checked against its caption."
            >
              <DataTable
                caption="The generator's report"
                headers={['The kind', 'An example question', 'Its answer', 'How many']}
                rows={kindRows}
              />
            </Figure>

            <Callout tone="note" title="What this is, and what it is not">
              This is a toy generator over a closed vocabulary of subjects, objects and surfaces. Real visual
              instruction data is written by a language model from richer captions and bounding boxes, and then
              filtered. What carries over is the property the laboratory checks: an answer that cannot be derived from
              the caption is a hallucination waiting to be trained into the model, and the derivation is something a
              test can check line by line.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
