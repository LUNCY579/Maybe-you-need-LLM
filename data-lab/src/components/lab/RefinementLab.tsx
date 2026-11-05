import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { compareRecursion, runRefinement, type RefinementPass } from '../../core/recursion'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'passes' | 'compare'

/** What the loop is promised to do, and what it is measured doing, in one row. */
const armRow = (label: string, pass: RefinementPass): (string | number)[] => [
  label,
  pass.documents,
  fmt(pass.meanQuality, 4),
  `${fmt(pass.unwantedFraction * 100, 1)}%`,
  fmt(pass.threshold, 2),
  `${fmt(pass.heldOutAccuracy * 100, 1)}%`,
  fmt(pass.heldOutLoss, 4),
]

export function RefinementLab() {
  const [view, setView] = useState<View>('passes')
  const [size, setSize] = useState(400)
  const [seed, setSeed] = useState(17)
  const [passes, setPasses] = useState(4)
  const [pruneFraction, setPruneFraction] = useState(0.4)
  const [steps, setSteps] = useState(300)

  const study = useMemo(
    () => runRefinement({ seed, size, passes, pruneFraction, steps }),
    [seed, size, passes, pruneFraction, steps],
  )

  const comparison = useMemo(
    () => (view === 'compare' ? compareRecursion({ seed, size, passes, pruneFraction, steps }) : null),
    [view, seed, size, passes, pruneFraction, steps],
  )

  const first = study.passes[0]!
  const last = study.passes.at(-1)!

  /** The arithmetic the loop runs on: the total removal fixed, the per-pass cut follows. */
  const perPassArithmetic = useMemo(() => {
    const final = Math.round(study.start.documents * (1 - pruneFraction))
    return [1, 2, 3, 4].map((count) => ({
      passes: count,
      perPass: 1 - (1 - pruneFraction) ** (1 / count),
      predicted: final,
    }))
  }, [pruneFraction, study])

  return (
    <div className="lab">
      <Panel
        title="Laboratory G · The loop"
        subtitle="Retrain the reference model on what survived, and cut again — four times, at toy scale"
        accent="violet"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'passes', label: 'The passes' },
              { value: 'compare', label: 'One pass against four' },
            ]}
          />
          <Slider label="Documents" value={size} min={200} max={600} step={50} onChange={setSize} />
          <Slider label="The passes" value={passes} min={1} max={8} onChange={setPasses} />
          <Slider
            label="The total removed"
            value={pruneFraction}
            min={0.05}
            max={0.8}
            step={0.05}
            onChange={setPruneFraction}
            format={(value) => `${(value * 100).toFixed(0)}%`}
            hint="The whole loop's budget, not each pass's: the per-pass cut is derived from it."
          />
          <Slider label="Steps per scoring model" value={steps} min={100} max={800} step={100} onChange={setSteps} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat
            label="Documents in"
            value={String(study.start.documents)}
            hint={`${fmt(study.start.tokens, 0)} tokens, mean quality ${fmt(study.start.meanQuality, 4)}`}
          />
          <Stat
            label="Documents out"
            value={String(last.documents)}
            hint={`${fmt(last.tokens, 0)} tokens after ${passes} ${passes === 1 ? 'pass' : 'passes'}`}
          />
          <Stat
            label="The mean quality"
            value={fmt(last.meanQuality, 4)}
            hint={`up from ${fmt(study.start.meanQuality, 4)}, and rising at every pass`}
            tone={last.meanQuality > study.start.meanQuality ? 'good' : 'warn'}
          />
          <Stat
            label="The junk it removed"
            value={String(study.passes.reduce((sum, pass) => sum + pass.removedUnwanted, 0))}
            hint={`at the cost of ${study.passes.reduce((sum, pass) => sum + pass.removedClean, 0)} clean documents`}
          />
          <Stat
            label="Held-out loss, first pass to last"
            value={`${fmt(first.heldOutLoss, 4)} → ${fmt(last.heldOutLoss, 4)}`}
            hint="the corpus gets purer and the model gets worse on it"
            tone={last.heldOutLoss > first.heldOutLoss ? 'warn' : 'good'}
          />
        </div>

        {view === 'passes' ? (
          <>
            <Figure
              title="What each pass did"
              description="The survivors, their quality, the perplexity the pass cut at, and the model trained on them scored against the untouched held-out set."
              caption="The threshold column is the mechanism: the reference model is retrained on a cleaner corpus, so the bar it sets gets lower, and the documents it now rejects are the ones that only looked surprising against the junk."
            >
              <DataTable
                caption="The passes"
                headers={[
                  'Pass',
                  'Documents',
                  'Tokens',
                  'Mean quality',
                  'Unwanted left',
                  'The cut at',
                  'Junk removed',
                  'Clean removed',
                  'Held-out accuracy',
                  'Held-out loss',
                ]}
                rows={study.passes.map((pass) => [
                  pass.pass,
                  pass.documents,
                  pass.tokens,
                  fmt(pass.meanQuality, 4),
                  `${fmt(pass.unwantedFraction * 100, 1)}%`,
                  fmt(pass.threshold, 2),
                  pass.removedUnwanted,
                  pass.removedClean,
                  `${fmt(pass.heldOutAccuracy * 100, 1)}%`,
                  fmt(pass.heldOutLoss, 4),
                ])}
              />
            </Figure>

            <Figure
              title="Two curves that go the same way"
              description="The mean quality of the survivors and the held-out loss of the model trained on them, pass by pass."
              caption="This is the part of the recursive argument that does not come out clean at toy scale. The corpus really does get purer at every pass — and the model trained on it gets worse on a fixed held-out set, because the data it has left is harder and there is less of it."
            >
              <TrendChart
                data={study.passes.map((pass) => ({
                  x: pass.pass,
                  quality: pass.meanQuality,
                  loss: pass.heldOutLoss,
                }))}
                series={[
                  { key: 'quality', name: 'the mean quality', colour: 'var(--accent-violet)' },
                  { key: 'loss', name: 'the held-out loss', colour: 'var(--accent-rose)' },
                ]}
                xLabel="the pass"
                yLabel="quality and loss"
                height={260}
              />
            </Figure>

            <Figure
              title="What each pass cost"
              description="The junk and the clean text removed at every pass, against the perplexity the pass cut at."
              caption="The first pass does almost all of the junk removal, because boilerplate is the most surprising thing in a raw corpus. Later passes are paying increasingly for ordinary text — that is the collateral damage, and the reason the loop cannot be run indefinitely."
            >
              <TrendChart
                data={study.passes.map((pass) => ({
                  x: pass.pass,
                  unwanted: pass.removedUnwanted,
                  clean: pass.removedClean,
                }))}
                series={[
                  { key: 'unwanted', name: 'boilerplate and unseen text', colour: 'var(--accent-emerald)' },
                  { key: 'clean', name: 'everything else', colour: 'var(--accent-amber)' },
                ]}
                xLabel="the pass"
                yLabel="documents removed"
                height={240}
              />
            </Figure>

            <Callout tone="definition" title="Why the reference has to be retrained">
              A fixed reference model rates the same documents the same way forever, so a second pass with the same
              threshold removes nothing new. Retraining on the survivors is what makes the loop do something: the
              model's idea of ordinary text shifts toward the cleaner corpus, and the threshold — held at the same
              quantile — lands on a different, lower perplexity each time. {fmt(first.threshold, 1)} at pass one
              against {fmt(last.threshold, 1)} at pass {passes} is that shift, measured.
            </Callout>
          </>
        ) : null}

        {view === 'compare' && comparison ? (
          <>
            <div className="stat-row">
              <Stat
                label="Both arms end at"
                value={`${comparison.oneShot.documents} documents`}
                hint={comparison.sameSize ? 'the same size, which is what makes this a comparison' : 'NOT the same size'}
                tone={comparison.sameSize ? 'good' : 'warn'}
              />
              <Stat
                label="The quality gain"
                value={`${comparison.qualityGain >= 0 ? '+' : ''}${fmt(comparison.qualityGain, 4)}`}
                hint="recursive mean quality minus one-shot"
                tone={comparison.qualityGain > 0 ? 'good' : 'warn'}
              />
              <Stat
                label="The accuracy gain"
                value={`${comparison.accuracyGain >= 0 ? '+' : ''}${fmt(comparison.accuracyGain, 4)}`}
                hint="on the same held-out documents, with the same steps"
                tone={comparison.accuracyGain > 0 ? 'good' : 'warn'}
              />
              <Stat
                label="The loss gain"
                value={`${
                  comparison.oneShot.heldOutLoss - comparison.recursive.heldOutLoss >= 0 ? '+' : ''
                }${fmt(comparison.oneShot.heldOutLoss - comparison.recursive.heldOutLoss, 4)}`}
                hint="one-shot loss minus recursive loss, so positive is the recursive win"
                tone={
                  comparison.recursive.heldOutLoss < comparison.oneShot.heldOutLoss ? 'good' : 'warn'
                }
              />
            </div>

            <Figure
              title="The two arms"
              description="One pass that removes the whole fraction at once, against that fraction spread over the passes — the same total removal, the same corpus size at the end, and the same steps for the scoring model."
              caption="The only thing that differs between the rows is how many times the reference model got retrained on survivors. Everything else — the documents removed, the tokens, the training budget — is held."
            >
              <DataTable
                caption="One hard pass against several gentle ones"
                headers={[
                  'The arm',
                  'Documents',
                  'Mean quality',
                  'Unwanted left',
                  'The cut at',
                  'Held-out accuracy',
                  'Held-out loss',
                ]}
                rows={[armRow('one pass, hard', comparison.oneShot), armRow(`${passes} passes, gentle`, comparison.recursive)]}
              />
            </Figure>

            <Figure
              title="How the per-pass cut follows from the total"
              description="The arithmetic the loop is built on, at the total removal set above. Each row is the same promise: the corpus ends at the same size."
              caption="The prediction is arithmetic, not measurement: with the per-pass fraction set to one minus the total kept, raised to one over the passes, every count of passes ends at the same corpus. That is what lets the two arms be compared at all."
            >
              <DataTable
                caption="The same total, spread differently"
                headers={['Passes', 'What each pass removes', 'The predicted final size', 'The measured size here']}
                rows={perPassArithmetic.map((row) => [
                  row.passes,
                  `${fmt(row.perPass * 100, 1)}%`,
                  row.predicted,
                  row.passes === passes ? last.documents : '—',
                ])}
              />
            </Figure>

            <Callout tone="warning" title="Which half of the claim holds">
              The recursive arm's held-out loss is lower at every seed the module's tests try, and its mean quality is
              higher — that half of the argument reproduces. The accuracy half does not: the difference between the two
              arms is {fmt(comparison.accuracyGain, 4)} here, and the tests measure it at exactly zero on the fixture
              seed and inside three points either way on the others. Accuracy on five topics is a coarse instrument;
              loss is the one that moves. Drag the passes slider and watch which of the two columns actually changes.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
