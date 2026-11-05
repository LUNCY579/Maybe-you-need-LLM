import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { buildCorpus, DOMAINS } from '../../core/corpus'
import {
  compareMixtures,
  fitPerDomainModels,
  groupDroMixture,
  mixtureWith,
  naturalMixture,
  solveOptimalMixture,
} from '../../core/mixture'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'natural' | 'doremi' | 'ablations'

/** Which per-component ablation the third view runs. */
type Family = 'drop' | 'only' | 'raise'

const FAMILY_LABELS: Record<Family, string> = {
  drop: 'Each domain removed',
  only: 'Each domain alone',
  raise: 'One domain raised',
}

export function MixtureLab() {
  const [view, setView] = useState<View>('natural')
  const [size, setSize] = useState(300)
  const [seed, setSeed] = useState(41)
  const [eta, setEta] = useState(2)
  const [rounds, setRounds] = useState(6)
  const [family, setFamily] = useState<Family>('drop')
  const [ablateDomain, setAblateDomain] = useState(0)

  const corpus = useMemo(() => buildCorpus({ size, seed, vocabulary: 48, topics: 5 }), [size, seed])

  const natural = useMemo(() => naturalMixture(corpus.documents), [corpus])

  const dro = useMemo(
    () => groupDroMixture(corpus, { eta, rounds, stepsPerRound: 50, sampleSize: 200, seed }),
    [corpus, eta, rounds, seed],
  )

  const models = useMemo(
    () => fitPerDomainModels(corpus, { points: 2, sampleSize: 180, seed, training: { steps: 150 } }),
    [corpus, seed],
  )

  const optimal = useMemo(() => solveOptimalMixture(models), [models])

  const comparison = useMemo(
    () =>
      compareMixtures(
        corpus,
        [
          { name: 'the natural mixture', weights: natural },
          { name: 'a uniform mixture', weights: new Array<number>(DOMAINS.length).fill(1 / DOMAINS.length) },
          { name: 'the worst-domain mixture', weights: dro.weights },
          { name: 'the solved mixture', weights: optimal.weights },
        ],
        { sampleSize: 200, seed, training: { steps: 180 } },
      ),
    [corpus, natural, dro.weights, optimal.weights, seed],
  )

  /**
   * One component moved at a time, everything else held: the ablation the mixture
   * papers report as a table of numbers, and the only one that says what a domain
   * is worth to the *other* domains.
   */
  const ablations = useMemo(() => {
    if (view !== 'ablations') return null
    const withNatural = (rows: { name: string; weights: number[] }[]) => [
      { name: 'the natural mixture', weights: natural },
      ...rows,
    ]
    const candidates =
      family === 'drop'
        ? withNatural(DOMAINS.map((domain, index) => ({ name: `no ${domain}`, weights: mixtureWith(index, 0) })))
        : family === 'only'
          ? withNatural(DOMAINS.map((domain, index) => ({ name: `only ${domain}`, weights: mixtureWith(index, 1) })))
          : withNatural(
              [0.2, 0.4, 0.6, 0.8].map((weight) => ({
                name: `${DOMAINS[ablateDomain]} at ${weight}`,
                weights: mixtureWith(ablateDomain, weight),
              })),
            )
    const rows = compareMixtures(corpus, candidates, { sampleSize: 200, seed, training: { steps: 180 } })
    // the domain each row is about: the one moved, and for the baseline no particular one
    const focus = rows.map((_, index) =>
      index === 0 ? -1 : family === 'raise' ? ablateDomain : index - 1,
    )
    return { rows, focus }
  }, [view, family, ablateDomain, corpus, natural, seed])

  const signed = (value: number) => `${value >= 0 ? '+' : ''}${fmt(value, 4)}`

  return (
    <div className="lab">
      <Panel
        title="Laboratory C · The mixture"
        subtitle="A mixture is a policy over domains, and the policy can be optimised"
        accent="emerald"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'natural', label: 'The mixtures' },
              { value: 'doremi', label: 'The optimisation' },
              { value: 'ablations', label: 'One component at a time' },
            ]}
          />
          <Slider label="Documents" value={size} min={150} max={600} step={50} onChange={setSize} />
          <Slider
            label="The group-DRO step size η"
            value={eta}
            min={0}
            max={8}
            step={0.25}
            onChange={setEta}
            format={(value) => value.toFixed(2)}
            hint="Zero is the natural mixture; a large value chases the worst domain alone."
          />
          <Slider label="The rounds" value={rounds} min={2} max={12} onChange={setRounds} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="The domains" value={String(DOMAINS.length)} />
          <Stat
            label="The worst domain’s loss"
            value={fmt(comparison[0]?.worstLoss ?? 0, 4)}
            hint="under the natural mixture"
            tone="warn"
          />
          <Stat
            label="The worst domain’s loss"
            value={fmt(comparison[3]?.worstLoss ?? 0, 4)}
            hint="under the solved mixture"
            tone="good"
          />
          <Stat label="The solved mixture’s worst loss" value={fmt(optimal.worstLoss, 4)} />
        </div>

        {view === 'natural' ? (
          <>
            <Figure
              title="Four mixtures, one held-out set"
              description="Each mixture trains a model, and the model is measured on the same held-out documents."
              caption="The comparison is between mixtures and nothing else: same data, same budget, same measurement. What changes is the proportions."
            >
              <DataTable
                caption="The mixtures, and what they bought"
                headers={['The mixture', ...DOMAINS, 'The worst domain', 'The mean domain', 'The accuracy']}
                rows={comparison.map((row) => [
                  row.name,
                  ...row.weights.map((weight) => fmt(weight, 3)),
                  fmt(row.worstLoss, 4),
                  fmt(row.meanLoss, 4),
                  `${fmt(row.accuracy * 100, 1)}%`,
                ])}
              />
            </Figure>

            <Callout tone="note" title="The worst domain is not the mean">
              A mixture can have a perfectly good average loss and be bad at the thing the model will actually be used
              for. The mean hides which domain is being starved; the worst domain names it.
            </Callout>
          </>
        ) : null}

        {view === 'doremi' ? (
          <>
            <Figure
              title="The group weights over the rounds"
              description="How the weight of each domain moves as the worst-domain objective is optimised."
              caption="Each round trains a model on the reweighted sample, measures each domain's loss, and raises the weight of whichever domain is doing worst."
            >
              <TrendChart
                data={dro.worstLossHistory.map((worst, index) => ({
                  x: index,
                  worst,
                  mean: dro.meanLossHistory[index] ?? 0,
                }))}
                series={[
                  { key: 'worst', name: 'the worst domain', colour: 'var(--accent-rose)' },
                  { key: 'mean', name: 'the mean domain', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the round"
                yLabel="the loss"
                height={260}
              />
            </Figure>

            <Figure
              title="The fitted models of each domain’s loss"
              description="The linear model of each domain’s loss as a function of its weight, and the mixture that solves the problem."
              caption="The linear model is fitted by training on several mixtures and regressing the measured loss on the weight. The solution equalises the domains that are active."
            >
              <DataTable
                caption="The fitted models and the solution"
                headers={['The domain', 'The slope a', 'The intercept b', 'The loss at the solved weight', 'The solved weight']}
                rows={models.map((model, index) => [
                  DOMAINS[index],
                  fmt(model.a, 4),
                  fmt(model.b, 4),
                  fmt(model.a * (optimal.weights[index] ?? 0) + model.b, 4),
                  fmt(optimal.weights[index] ?? 0, 4),
                ])}
              />
            </Figure>

            <Callout tone="definition" title="The closed form">
              If each domain’s loss is linear in its weight, the optimal mixture is the one for which the active
              domains all have the same loss. The level λ is found by a one-dimensional search: raise it until the
              weights, each (λ − b) / a, sum to one. The next view is where that linearity is checked rather than
              assumed.
            </Callout>
          </>
        ) : null}

        {view === 'ablations' && ablations ? (
          <>
            <div className="lab-controls">
              <SegmentedControl
                label="The family of ablation"
                value={family}
                onChange={setFamily}
                options={(Object.keys(FAMILY_LABELS) as Family[]).map((key) => ({
                  value: key,
                  label: FAMILY_LABELS[key],
                }))}
              />
              {family === 'raise' ? (
                <Slider
                  label="The domain raised"
                  value={ablateDomain}
                  min={0}
                  max={DOMAINS.length - 1}
                  onChange={setAblateDomain}
                  format={(value) => DOMAINS[value] ?? String(value)}
                />
              ) : null}
            </div>

            <Figure
              title={`The ablation: ${FAMILY_LABELS[family].toLowerCase()}`}
              description="Each row is a mixture, trained on a sample drawn to that mixture and scored on the same held-out documents. The two change columns are against the natural mixture, in the first row."
              caption="Loss is reported negative-is-better, so a negative change is an improvement. The last column is the domain this row was about; the table under it is every other domain as well."
            >
              <DataTable
                caption="One component at a time"
                headers={[
                  'The mixture',
                  'The weights',
                  'The worst loss',
                  'The mean loss',
                  'The accuracy',
                  'The change on the mean',
                  'The change on the domain in question',
                ]}
                rows={ablations.rows.map((row, index) => {
                  const base = ablations.rows[0]!
                  const focus = ablations.focus[index]!
                  return [
                    row.name,
                    row.weights.map((weight) => fmt(weight, 2)).join(' · '),
                    fmt(row.worstLoss, 4),
                    fmt(row.meanLoss, 4),
                    `${fmt(row.accuracy * 100, 1)}%`,
                    index === 0 ? '—' : signed(row.meanLoss - base.meanLoss),
                    index === 0 || focus < 0 ? '—' : signed(row.perDomainLoss[focus]! - base.perDomainLoss[focus]!),
                  ]
                })}
              />
            </Figure>

            <Figure
              title="What each component is worth to every other"
              description="The change in each domain's held-out loss against the natural mixture. This is the per-component ablation in one grid: a row is a mixture, a column is a domain."
              caption="A row that is all negative is a mixture that helps every domain; a row with a negative in its own column and positives elsewhere is a mixture that bought one domain with the others. Nothing in the mean column predicts either."
            >
              <DataTable
                caption="The change on each domain's loss, against the natural mixture"
                headers={['The mixture', ...DOMAINS.map((domain) => `The loss on ${domain}`)]}
                rows={ablations.rows.map((row, index) => {
                  const base = ablations.rows[0]!
                  return [
                    row.name,
                    ...row.perDomainLoss.map((loss, domain) =>
                      index === 0 ? '—' : signed(loss - base.perDomainLoss[domain]!),
                    ),
                  ]
                })}
              />
            </Figure>

            <Callout tone="warning" title="Three things this grid says at the settings the screen opens with">
              Removing a domain does not reliably hurt it: at the defaults, three of the five removed domains have a
              <em> lower</em> held-out loss without their own data in the mixture, because the classifier's parameters
              are shared and the hardest domain was spending them. One domain alone can match the mixture on the
              average and lose badly on the tail — ‘only reference’ scores the same 0.4574 mean loss and the same
              accuracy as the natural mixture while its worst domain sits at 0.8363 against 0.6957. And raising one domain's weight does not move its loss monotonically, which is what the
              linear model in the optimisation view assumes: the raise family above is the check on that assumption,
              and it fails. Move the seed and the sizes change; the three shapes are what the mixture literature is
              arguing about.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
