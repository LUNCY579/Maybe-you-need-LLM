import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { countParameters } from '../../core/architecture'
import type { Architecture } from '../../core/architecture'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable } from '@llm-materials/course-ui'

type View = 'parameters' | 'budget'

export function ArchitectureLab() {
  const [view, setView] = useState<View>('parameters')
  const [dModel, setDModel] = useState(768)
  const [layers, setLayers] = useState(12)
  const [vocabSize, setVocabSize] = useState(32000)
  const [dFf, setDFf] = useState(3072)
  const [tie, setTie] = useState(false)

  const architecture: Architecture = useMemo(
    () => ({
      contextLength: 2048,
      dModel,
      heads: Math.max(1, Math.floor(dModel / 64)),
      dFf,
      layers,
      vocabSize,
    }),
    [dModel, dFf, layers, vocabSize],
  )

  const breakdown = useMemo(() => countParameters(architecture, tie), [architecture, tie])

  const sweep = useMemo(() => {
    const rows: { x: number; embedding: number; total: number }[] = []
    for (let width = 128; width <= 2048; width += 128) {
      const counts = countParameters({ ...architecture, dModel: width, heads: Math.max(1, Math.floor(width / 64)) }, tie)
      rows.push({ x: width, embedding: counts.embedding, total: counts.total })
    }
    return rows
  }, [architecture, tie])

  return (
    <div className="lab">
      <Panel
        title="Laboratory B · The architecture"
        subtitle="A stack of matrices, and the parameter budget they come to"
        accent="teal"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'parameters', label: 'The breakdown' },
              { value: 'budget', label: 'The budget' },
            ]}
          />
          <Slider label="Width" value={dModel} min={128} max={2048} step={64} onChange={setDModel} />
          <Slider label="Layers" value={layers} min={1} max={48} onChange={setLayers} />
          <Slider label="Vocabulary" value={vocabSize} min={512} max={128000} step={512} onChange={setVocabSize} />
          <Slider label="Feed-forward width" value={dFf} min={256} max={8192} step={256} onChange={setDFf} />
          <div className="field">
            <span className="field-label">The output projection</span>
            <div className="segmented" role="group" aria-label="The output projection">
              <button
                type="button"
                className={tie ? 'segment' : 'segment segment-active'}
                aria-pressed={!tie}
                onClick={() => setTie(false)}
              >
                separate
              </button>
              <button
                type="button"
                className={tie ? 'segment segment-active' : 'segment'}
                aria-pressed={tie}
                onClick={() => setTie(true)}
              >
                tied
              </button>
            </div>
          </div>
        </div>

        <div className="stat-row">
          <Stat
            label="Total parameters"
            value={`${(breakdown.total / 1e6).toFixed(1)} M`}
            hint={`${breakdown.total.toLocaleString()} numbers`}
          />
          <Stat
            label="The embedding"
            value={`${(breakdown.embedding / 1e6).toFixed(1)} M`}
            hint={`${fmt((breakdown.embedding / breakdown.total) * 100, 1)}% of the model`}
          />
          <Stat
            label="The feed-forward"
            value={`${(breakdown.feedForward / 1e6).toFixed(1)} M`}
            hint={`${fmt((breakdown.feedForward / breakdown.total) * 100, 1)}% of the model`}
          />
          <Stat
            label="The attention"
            value={`${(breakdown.attention / 1e6).toFixed(1)} M`}
            hint={`${fmt((breakdown.attention / breakdown.total) * 100, 1)}% of the model`}
          />
        </div>

        {view === 'parameters' ? (
          <>
            <Figure
              title="Every parameter, accounted for"
              description="The parameter count of the model, broken into the six things it is made of."
              caption="The breakdown. The embedding and the output projection are the only vocabulary-sized matrices; everything else scales with the width and the depth instead."
            >
              <DataTable
                caption="The parameter breakdown"
                headers={['Component', 'Parameters', 'Share']}
                rows={[
                  ['the token embedding', breakdown.embedding.toLocaleString(), fmt((breakdown.embedding / breakdown.total) * 100, 1) + '%'],
                  ['the positional embedding', breakdown.positional.toLocaleString(), fmt((breakdown.positional / breakdown.total) * 100, 1) + '%'],
                  ['the attention projections', breakdown.attention.toLocaleString(), fmt((breakdown.attention / breakdown.total) * 100, 1) + '%'],
                  ['the feed-forward projections', breakdown.feedForward.toLocaleString(), fmt((breakdown.feedForward / breakdown.total) * 100, 1) + '%'],
                  ['the layer norms', breakdown.norms.toLocaleString(), fmt((breakdown.norms / breakdown.total) * 100, 1) + '%'],
                  ['the final norm', breakdown.finalNorm.toLocaleString(), fmt((breakdown.finalNorm / breakdown.total) * 100, 1) + '%'],
                  ['the output projection', breakdown.output.toLocaleString(), fmt((breakdown.output / breakdown.total) * 100, 1) + '%'],
                  ['the total', breakdown.total.toLocaleString(), '100%'],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="What tying the output projection does">
              The output projection is a vocabulary-sized matrix, just like the embedding. Using the embedding for both
              halves the largest single block of parameters — and the reason it is done is the memory: two matrices of
              that size do not fit on one device when the vocabulary is large.
            </Callout>
          </>
        ) : null}

        {view === 'budget' ? (
          <>
            <Figure
              title="The budget as the width moves"
              description="The embedding parameters and the total parameters, as the width of the model grows."
              caption="The embedding grows with the vocabulary and the width; everything else grows with the width and the depth. Which of them dominates depends on how wide the model is relative to its vocabulary."
            >
              <DataTable
                caption="The budget across the width"
                headers={['Width', 'Embedding parameters', 'Total parameters', 'Embedding share']}
                rows={sweep.map((row) => [
                  row.x,
                  row.embedding.toLocaleString(),
                  row.total.toLocaleString(),
                  fmt((row.embedding / row.total) * 100, 1) + '%',
                ])}
              />
            </Figure>

            <Callout tone="note" title="Why the width and the vocabulary cannot be chosen separately">
              The embedding is vocabulary × width and the rest of the model is roughly width × width × depth. Push the
              width up and the embedding becomes a smaller share; push the vocabulary up and it becomes a larger one.
              The interesting configurations are the ones where they are comparable, and that is the argument the
              lecture makes about choosing them together.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
