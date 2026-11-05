import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { drawToBudget, perplexityPool, runBudgetStudy, type BudgetRow } from '../../core/budget'
import { buildCorpus, tokenCount } from '../../core/corpus'
import { splitCorpus } from '../../core/filters'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'study' | 'gains' | 'draw'

/** The seeds the gain is checked against — the same three the module's tests use. */
const SWEEP_SEEDS = [17, 23, 31, 47]

const KIND_NOTES: Record<BudgetRow['kind'], string> = {
  raw: 'nothing was removed',
  filtered: 'a perplexity filter chose',
  control: 'same count, unfiltered',
  oracle: 'sorted by true quality; nobody can run this',
}

const rowNamed = (rows: BudgetRow[], fragment: string): BudgetRow =>
  rows.find((row) => row.name.includes(fragment)) ?? rows[0]!

export function BudgetLab() {
  const [view, setView] = useState<View>('study')
  const [size, setSize] = useState(400)
  const [seed, setSeed] = useState(17)
  const [tokenBudget, setTokenBudget] = useState(12_000)
  const [computeVisits, setComputeVisits] = useState(10_000)
  const [pruneFraction, setPruneFraction] = useState(0.4)
  const [cheapFraction, setCheapFraction] = useState(0.5)

  const study = useMemo(
    () =>
      runBudgetStudy({ seed, size, tokenBudget, computeVisits, pruneFraction, cheapFraction }),
    [seed, size, tokenBudget, computeVisits, pruneFraction, cheapFraction],
  )

  const raw = rowNamed(study.rows, 'unfiltered, full')
  const filtered = rowNamed(study.rows, 'perplexity-filtered, full')
  const control = rowNamed(study.rows, 'the same number')
  const cheap = rowNamed(study.rows, 'half the budget')
  const oracle = rowNamed(study.rows, 'the oracle')

  /** How much bigger the headline gain is than the quality effect alone — the sentence the screen ends on. */
  const headlineRatio =
    Math.abs(study.lossGainAgainstControl) < 1e-6
      ? null
      : Math.abs(study.lossGainAtHalfBudget / study.lossGainAgainstControl)

  /** The same study at other seeds, because the quality effect alone is within noise. */
  const sweep = useMemo(
    () =>
      view === 'gains'
        ? SWEEP_SEEDS.map((aSeed) => {
            const other = runBudgetStudy({ seed: aSeed, size, tokenBudget, computeVisits, pruneFraction, cheapFraction })
            return {
              seed: aSeed,
              againstControl: other.lossGainAgainstControl,
              atSameBudget: other.lossGainAtSameBudget,
              atHalfBudget: other.lossGainAtHalfBudget,
            }
          })
        : [],
    [view, size, tokenBudget, computeVisits, pruneFraction, cheapFraction],
  )

  /** The mechanics the rows are drawn by: the pool, the filter's cut, the budget's stop. */
  const drawing = useMemo(() => {
    if (view !== 'draw') return null
    const corpus = buildCorpus({ seed, size, vocabulary: 48, topics: 5 })
    const { train, test } = splitCorpus(corpus, 0.3)
    const testIds = new Set(test.map((document) => document.id))
    const pool = train.filter((document) => !testIds.has(document.id))
    const kept = perplexityPool(pool, pruneFraction)
    const full = drawToBudget(pool, tokenBudget)
    const filteredDraw = drawToBudget(kept.kept, tokenBudget)
    return {
      pool: pool.length,
      poolTokens: pool.reduce((sum, document) => sum + tokenCount(document), 0),
      threshold: kept.threshold,
      kept: kept.kept.length,
      full,
      filteredDraw,
    }
  }, [view, seed, size, pruneFraction, tokenBudget])

  const drawnCumulative = useMemo(() => {
    if (!drawing) return []
    let tokens = 0
    return drawing.full.documents.slice(0, 40).map((document) => {
      tokens += tokenCount(document)
      return { x: document.id, tokens, budget: tokenBudget }
    })
  }, [drawing, tokenBudget])

  return (
    <div className="lab">
      <Panel
        title="Laboratory F · The budget"
        subtitle="Quality against quantity, with the compute held fixed and the control named"
        accent="sky"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'study', label: 'The five rows' },
              { value: 'gains', label: 'The three gains' },
              { value: 'draw', label: 'How a row is drawn' },
            ]}
          />
          <Slider label="Documents" value={size} min={200} max={600} step={50} onChange={setSize} />
          <Slider
            label="The token budget"
            value={tokenBudget}
            min={4000}
            max={20000}
            step={1000}
            onChange={setTokenBudget}
            format={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Slider
            label="The compute budget"
            value={computeVisits}
            min={4000}
            max={32000}
            step={2000}
            onChange={setComputeVisits}
            format={(value) => `${(value / 1000).toFixed(0)}k sample-visits`}
          />
          <Slider
            label="What the filter throws away"
            value={pruneFraction}
            min={0}
            max={0.8}
            step={0.05}
            onChange={setPruneFraction}
            format={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Slider
            label="The cheap rows' share of the budget"
            value={cheapFraction}
            min={0.25}
            max={1}
            step={0.05}
            onChange={setCheapFraction}
            format={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat
            label="Tokens in the full budget"
            value={fmt(study.tokenBudget, 0)}
            hint={`${fmt(study.computeVisits, 0)} sample-visits, the same for every row`}
          />
          <Stat
            label="Held-out documents"
            value={String(study.heldOut.documents)}
            hint={`${study.heldOut.inDomain} of them neither boilerplate nor unseen text`}
          />
          <Stat
            label="Filtered against raw, same budget"
            value={`${study.lossGainAtSameBudget >= 0 ? '+' : ''}${fmt(study.lossGainAtSameBudget, 4)}`}
            hint="loss, so positive is a gain"
            tone={study.lossGainAtSameBudget > 0 ? 'good' : 'warn'}
          />
          <Stat
            label="Filtered half-budget against raw full"
            value={`${study.lossGainAtHalfBudget >= 0 ? '+' : ''}${fmt(study.lossGainAtHalfBudget, 4)}`}
            hint="the headline number"
            tone={study.lossGainAtHalfBudget > 0 ? 'good' : 'warn'}
          />
          <Stat
            label="Filtered against the control"
            value={`${study.lossGainAgainstControl >= 0 ? '+' : ''}${fmt(study.lossGainAgainstControl, 4)}`}
            hint="the quality effect alone"
            tone={study.lossGainAgainstControl > 0.005 ? 'good' : 'warn'}
          />
        </div>

        {view === 'study' ? (
          <>
            <Figure
              title="The five rows"
              description="Every row is trained with the same number of sample-visits and scored on the same held-out documents. The in-domain columns ask only about the text a user would actually send."
              caption="A row is a pool, a budget and a step count. Two of those three move whenever the filter changes, which is why the table reports all three and the control row exists."
            >
              <DataTable
                caption="One compute budget, five ways to spend it"
                headers={[
                  'The row',
                  'What it is',
                  'Documents',
                  'Tokens',
                  'Steps',
                  'Mean quality',
                  'Unwanted',
                  'In-domain loss',
                  'The accuracy',
                  'In-domain accuracy',
                ]}
                rows={study.rows.map((row) => [
                  row.name,
                  KIND_NOTES[row.kind],
                  row.documents,
                  row.tokens,
                  row.steps,
                  fmt(row.meanQuality, 4),
                  `${fmt(row.unwantedFraction * 100, 1)}%`,
                  fmt(row.inDomainLoss, 4),
                  `${fmt(row.accuracy * 100, 1)}%`,
                  fmt(row.inDomainAccuracy, 4),
                ])}
              />
            </Figure>

            <Figure
              title="What each row cost and what it returned"
              description="The in-domain loss of every row, against the number of documents it was drawn from."
              caption="Read the shape, not the ranking: the cheap filtered row has the lowest loss and the fewest documents, and it also has the most gradient steps, because steps are what is left when the data is smaller."
            >
              <TrendChart
                data={study.rows.map((row, index) => ({
                  x: index + 1,
                  loss: row.inDomainLoss,
                  quality: row.meanQuality,
                }))}
                series={[
                  { key: 'loss', name: 'the in-domain loss', colour: 'var(--accent-sky)' },
                  { key: 'quality', name: 'the mean quality', colour: 'var(--accent-amber)' },
                ]}
                xLabel="the row, in table order"
                yLabel="loss and quality"
                height={240}
              />
            </Figure>

            <Callout tone="note" title="The oracle is not a filter">
              The last row sorts the pool by the quality field the generator wrote into each document. Nothing can run
              it — that field is the answer — and it is in the table only as the ceiling the real rows are read
              against. It reaches {fmt(oracle.meanQuality, 4)} mean quality where the perplexity row reaches
              {' '}
              {fmt(filtered.meanQuality, 4)} and the raw row {fmt(raw.meanQuality, 4)}. The distance between the
              filtered row and the oracle is what a better score would buy; the distance between the raw row and the
              filtered one is what this score does buy.
            </Callout>
          </>
        ) : null}

        {view === 'gains' ? (
          <>
            <Figure
              title="The three gains, and what each one holds constant"
              description="Each row of this table subtracts one row of the study from one other row, and the difference is only meaningful for the thing the two rows share."
              caption="The half-budget gain is the number a paper prints. It is also the number that is easiest to explain without quality: half the data buys twice the steps."
            >
              <DataTable
                caption="Which comparison buys which claim"
                headers={['The gain', 'Positive means', 'Held constant', 'Here']}
                rows={[
                  [
                    'filtered full against raw full',
                    'filtering helped at the same budget',
                    'tokens and steps per visit',
                    `${study.lossGainAtSameBudget >= 0 ? '+' : ''}${fmt(study.lossGainAtSameBudget, 4)}`,
                  ],
                  [
                    'filtered half against raw full',
                    'the smaller filtered set beat the larger raw one',
                    'nothing — both tokens and steps move',
                    `${study.lossGainAtHalfBudget >= 0 ? '+' : ''}${fmt(study.lossGainAtHalfBudget, 4)}`,
                  ],
                  [
                    'filtered half against the control',
                    'the filter chose better documents',
                    'documents and steps, exactly',
                    `${study.lossGainAgainstControl >= 0 ? '+' : ''}${fmt(study.lossGainAgainstControl, 4)}`,
                  ],
                ]}
              />
            </Figure>

            <Figure
              title="The same study at four seeds"
              description="The quality effect alone, at the settings above, recomputed on four different corpora."
              caption="This is the column that decides whether the claim is a claim. A gain that changes sign between seeds is a property of the draw, not of the filter."
            >
              <DataTable
                caption="The gains against the control, per seed"
                headers={['Seed', 'Against the control', 'At the same budget', 'At half the budget']}
                rows={sweep.map((row) => [
                  row.seed,
                  `${row.againstControl >= 0 ? '+' : ''}${fmt(row.againstControl, 4)}`,
                  `${row.atSameBudget >= 0 ? '+' : ''}${fmt(row.atSameBudget, 4)}`,
                  `${row.atHalfBudget >= 0 ? '+' : ''}${fmt(row.atHalfBudget, 4)}`,
                ])}
              />
            </Figure>

            <Callout tone="warning" title="What is left when the steps are matched">
              The control row has exactly as many documents as the cheap filtered row, and therefore exactly the same
              number of gradient steps — {control.steps} against {cheap.steps}. The only difference between them is
              whether a filter picked the documents, and on this corpus that difference is worth
              {' '}
              {fmt(study.lossGainAgainstControl, 4)} nats while the headline comparison reports
              {' '}
              {fmt(study.lossGainAtHalfBudget, 4)}
              {headlineRatio === null
                ? ', and the ratio between them has no meaning at this setting'
                : ` — a factor of ${fmt(headlineRatio, 0)}`}
              . Push the compute budget up and even the same-budget gain goes negative; the module's tests measure
              −0.0133 at 30k sample-visits, because a model with more steps outgrows the junk it was shown. The honest
              sentence about this table is that at toy scale the budget reallocation is the effect and the quality
              choice is within the noise of the draw.
            </Callout>
          </>
        ) : null}

        {view === 'draw' && drawing ? (
          <>
            <div className="stat-row">
              <Stat label="The training pool" value={String(drawing.pool)} hint="held-out documents removed before anything else" />
              <Stat label="Tokens in the pool" value={fmt(drawing.poolTokens, 0)} />
              <Stat
                label="The filter's cut"
                value={fmt(drawing.threshold, 2)}
                hint={`keeps ${drawing.kept} of ${drawing.pool}`}
              />
              <Stat
                label="Documents the budget took"
                value={String(drawing.full.documents.length)}
                hint={`${fmt(drawing.full.tokens, 0)} tokens drawn, against a ${fmt(tokenBudget, 0)} budget`}
              />
              <Stat
                label="The same budget, filtered"
                value={String(drawing.filteredDraw.documents.length)}
                hint={`${fmt(drawing.filteredDraw.tokens, 0)} tokens, in the pool's own order`}
              />
            </div>

            <Figure
              title="Tokens spent, document by document"
              description="The cumulative token count of the raw draw, against the budget it is stopped by."
              caption="The document that crosses the budget is kept, because a real pipeline tokenises what it selected and does not throw a document away halfway. A row can therefore overshoot by at most one document."
            >
              <TrendChart
                data={drawnCumulative}
                series={[
                  { key: 'tokens', name: 'the tokens drawn', colour: 'var(--accent-sky)' },
                  { key: 'budget', name: 'the budget', colour: 'var(--accent-rose)' },
                ]}
                xLabel="the document, in pool order"
                yLabel="the cumulative tokens"
                height={240}
              />
            </Figure>

            <Figure
              title="The first documents of the pool, as the draw sees them"
              description="Lengths of the documents the raw row took first, since the budget is spent in pool order."
              caption="Order matters as much as the threshold: the same filter and the same budget draw a different set from a differently ordered pool, which is why the filtered pool keeps the pool's own order rather than being re-sorted by score."
            >
              <DataTable
                caption="The pool's head"
                headers={['Document', 'Tokens', 'Cumulative']}
                rows={(() => {
                  let total = 0
                  return drawing.full.documents.slice(0, 12).map((document) => {
                    const tokens = tokenCount(document)
                    total += tokens
                    return [document.id, tokens, total]
                  })
                })()}
              />
            </Figure>

            <Callout tone="definition" title="Why the control row is every-other-document">
              A control has to match on everything except the thing under test. Taking every second document of the
              unfiltered pool gives the same order and the same domain mixture as the filtered row, at the same count,
              so the steps and the tokens per visit come out the same too. What is left over when the two agree is
              the quality effect; what is left over when they disagree is the mixture, and it gets reported as the
              disagreement rather than folded into the claim.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
