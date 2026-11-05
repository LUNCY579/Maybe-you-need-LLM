import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  buildPairs,
  modalityGap,
  PROMPTS,
  temperatureSweep,
  trainContrastive,
  zeroShot,
} from '../../core/clip'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'loss' | 'data' | 'gap' | 'zeroshot'

export function ContrastiveLab() {
  const [view, setView] = useState<View>('loss')
  const [pairs, setPairs] = useState(240)
  const [batchSize, setBatchSize] = useState(24)
  const [temperature, setTemperature] = useState(0.5)
  const [steps, setSteps] = useState(400)
  const [dimension, setDimension] = useState(32)
  const [prompt, setPrompt] = useState(0)
  const [seed, setSeed] = useState(5)

  const dataset = useMemo(() => buildPairs({ size: pairs, seed: 3 }), [pairs])

  const trained = useMemo(
    () => trainContrastive(dataset, { steps, dimension, temperature, batchSize, seed }),
    [dataset, steps, dimension, temperature, batchSize, seed],
  )

  const gap = useMemo(
    () => modalityGap(dataset, trained.image, trained.text, { limit: 40 }),
    [dataset, trained],
  )

  const zeroShotAccuracy = useMemo(
    () => zeroShot(dataset, trained.image, trained.text, { prompt: PROMPTS[prompt] }),
    [dataset, trained, prompt],
  )

  const temperatureRows = useMemo(() => {
    const held = dataset.slice(0, Math.min(24, dataset.length))
    return temperatureSweep(
      trained.image,
      trained.text,
      { images: held.map((pair) => pair.image), captions: held.map((pair) => pair.caption) },
      [0.05, 0.1, 0.25, 0.5, 1, 2],
    )
  }, [dataset, trained])

  const batchCurve = useMemo(() => {
    const rows: { x: number; retrieval: number }[] = []
    for (const size of [4, 8, 16, 24, 32]) {
      const result = trainContrastive(dataset, { steps: 200, dimension, temperature, batchSize: size, seed })
      rows.push({ x: size, retrieval: result.retrieval * 100 })
    }
    return rows
  }, [dataset, dimension, temperature, seed])

  const dataCurve = useMemo(() => {
    const rows: { x: number; retrieval: number }[] = []
    for (const size of [60, 120, 240, 480]) {
      const subset = buildPairs({ size, seed: 3 })
      const result = trainContrastive(subset, { steps: 200, dimension, temperature, batchSize, seed })
      rows.push({ x: size, retrieval: result.retrieval * 100 })
    }
    return rows
  }, [dimension, temperature, batchSize, seed])

  return (
    <div className="lab">
      <Panel
        title="Laboratory A · The contrastive model"
        subtitle="Two encoders, one space, and a loss that needs no labels"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'loss', label: 'The loss' },
              { value: 'data', label: 'The data' },
              { value: 'gap', label: 'The gap' },
              { value: 'zeroshot', label: 'Zero-shot' },
            ]}
          />
          <Slider label="The pairs" value={pairs} min={60} max={600} step={60} onChange={setPairs} />
          <Slider label="The batch size" value={batchSize} min={4} max={48} step={4} onChange={setBatchSize} />
          <Slider
            label="The temperature"
            value={temperature}
            min={0.1}
            max={2}
            step={0.05}
            onChange={setTemperature}
            format={(value) => value.toFixed(2)}
          />
          <Slider label="The steps" value={steps} min={50} max={1200} step={50} onChange={setSteps} />
          <Slider label="The dimension" value={dimension} min={8} max={64} step={8} onChange={setDimension} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="The final loss" value={fmt(trained.history[trained.history.length - 1] ?? 0, 4)} tone="good" />
          <Stat
            label="The retrieval"
            value={`${fmt(trained.retrieval * 100, 1)}%`}
            hint="the right caption, first"
            tone="good"
          />
          <Stat label="The modality gap" value={fmt(gap.gap, 4)} tone="warn" />
          <Stat label="The zero-shot accuracy" value={`${fmt(zeroShotAccuracy * 100, 1)}%`} />
        </div>

        {view === 'loss' ? (
          <>
            <Figure
              title="The training curve"
              description="The contrastive loss, step by step."
              caption="The loss falls as the two encoders agree on which caption belongs with which image. Nothing in it needs a label."
            >
              <TrendChart
                data={trained.history.map((loss, index) => ({ x: index, loss }))}
                series={[{ key: 'loss', name: 'the contrastive loss', colour: 'var(--accent-indigo)' }]}
                xLabel="the step"
                yLabel="the loss"
                height={260}
              />
            </Figure>

            <Callout tone="definition" title="Where the negatives come from">
              A batch of {batchSize} pairs gives {batchSize * batchSize} image–caption pairs, of which {batchSize} are
              correct. The other {(batchSize * batchSize - batchSize).toLocaleString()} are negatives, and they are
              already in the batch — which is why the method scales with the batch size rather than with the labels.
            </Callout>

            <Figure
              title="What the temperature does"
              description="The loss, the probability of the matched caption and the entropy of the row, at six temperatures, on the trained model."
              caption="The similarities do not change; only the divisor does. Cooling sharpens each row towards one caption, so the entropy falls steadily — but the loss is lowest near the temperature the model was trained at, not at the coldest setting: below it the wrong pairs are driven towards zero probability, and their cost dominates even though the matched caption is above a half. Warming flattens the row towards the uniform distribution, where the matched caption holds one share in the batch and the loss approaches the log of the batch size."
            >
              <DataTable
                caption="One trained model, six temperatures"
                headers={[
                  'Temperature τ',
                  'The loss',
                  'P(the matched caption)',
                  'Entropy, nats',
                  'Effective captions',
                ]}
                rows={temperatureRows.map((row) => [
                  fmt(row.temperature, 2),
                  fmt(row.loss, 4),
                  fmt(row.matchedProbability, 4),
                  fmt(row.entropy, 3),
                  fmt(row.effectiveNegatives, 2),
                ])}
              />
            </Figure>

            <Callout tone="note" title="The temperature is a decision, and it is in the gradient">
              The same divisor appears in the gradient: the derivative of the loss with respect to a similarity is
              (p − y)/τ, where p is the softmax probability and y is the indicator of the true pairing. So the
              temperature sets the scale of the update as well as the value of the loss. CLIP learns it as a parameter;
              here it is a slider, and the table above is what moving it is worth. The minimum sits near the
              temperature the model was trained at, because that is the scale of logits it learned; train it colder and
              the minimum moves down with it. This trainer also scales its step by min(1, τ/0.5): below the rate's
              calibrated temperature the 1/τ in the gradient would make the same step diverge.
            </Callout>
          </>
        ) : null}

        {view === 'data' ? (
          <>
            <Figure
              title="The retrieval against the batch size"
              description="The retrieval, as the batch — and so the number of negatives — grows."
              caption="A bigger batch is more negatives for the same cost, and a better estimate of what the right pairing looks like."
            >
              <TrendChart
                data={batchCurve}
                series={[{ key: 'retrieval', name: 'the retrieval', colour: 'var(--accent-teal)' }]}
                xLabel="the batch size"
                yLabel="the retrieval, in per cent"
                height={250}
              />
            </Figure>

            <Figure
              title="The retrieval against the data"
              description="The retrieval, as the number of pairs grows."
              caption="More pairs is more supervision. The curve is the scaling law of the pretraining, in the smallest setting where it can be computed exactly."
            >
              <TrendChart
                data={dataCurve}
                series={[{ key: 'retrieval', name: 'the retrieval', colour: 'var(--accent-emerald)' }]}
                xLabel="the pairs"
                yLabel="the retrieval, in per cent"
                height={250}
              />
            </Figure>

            <Callout tone="note" title="The bill of the index">
              The document vectors never change once the training is over, so they are computed once and stored. The
              index is a matrix, and the search is a matrix product — which is what makes a corpus of billions
              affordable at all.
            </Callout>
          </>
        ) : null}

        {view === 'gap' ? (
          <>
            <Figure
              title="The two halves of the space"
              description="The mean similarity within each modality, and the mean similarity between them."
              caption="The images are close to each other, the captions are close to each other, and the two groups are further apart than either is from itself. The retrieval works anyway, because the pairs are closer than the average."
            >
              <DataTable
                caption="The gap"
                headers={['The comparison', 'The mean similarity']}
                rows={[
                  ['two images', fmt(gap.withinImages, 4)],
                  ['two captions', fmt(gap.withinText, 4)],
                  ['an image and a caption', fmt(gap.between, 4)],
                  ['the gap', fmt(gap.gap, 4)],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="Why it is not a failure">
              The gap is a property of the representation, and the method works because the *pairs* are close even
              though the two *spaces* are not. A gap and a working retrieval are not in tension; they are two
              measurements of the same thing.
            </Callout>
          </>
        ) : null}

        {view === 'zeroshot' ? (
          <>
            <div className="lab-controls">
              <div className="field">
                <span className="field-label">The prompt</span>
                <select
                  className="hub-search"
                  value={prompt}
                  onChange={(event) => setPrompt(Number(event.target.value))}
                >
                  {PROMPTS.map((template, index) => (
                    <option key={template} value={index}>
                      {template}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Figure
              title="The zero-shot classifier"
              description="The class names, embedded with the text encoder, and the image assigned to the closest of them."
              caption="The model was never trained to classify. It was trained to match a caption, and a class name is a caption — which is why the classifier works at all."
            >
              <DataTable
                caption="The classes"
                headers={['The class', 'The prompt', 'The zero-shot accuracy']}
                rows={PROMPTS.map((template) => [
                  template.replace('{}', 'a class'),
                  template,
                  `${fmt(zeroShot(dataset, trained.image, trained.text, { prompt: template }) * 100, 1)}%`,
                ])}
              />
            </Figure>

            <Callout tone="warning" title="The prompt is part of the method">
              A different template gives a different score, and the score is the only thing that is reported. The
              prompt is not a detail of the implementation; it is a choice, and it belongs in the report.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
