import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { DOMAINS, buildCorpus } from '../../core/corpus'
import { groupDroMixture } from '../../core/mixture'
import { extrapolateWeights, proxyTransfer } from '../../core/proxy'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'extrapolate' | 'transfer'

const rankOf = (values: number[]): number[] => {
  const ordered = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value)
  const ranks = new Array<number>(values.length).fill(0)
  ordered.forEach((entry, position) => {
    ranks[entry.index] = position + 1
  })
  return ranks
}

export function ProxyLab() {
  const [view, setView] = useState<View>('extrapolate')
  const [size, setSize] = useState(400)
  const [seed, setSeed] = useState(7)
  const [eta, setEta] = useState(1)
  const [targetDomain, setTargetDomain] = useState(DOMAINS.indexOf('reference'))
  const [targetWeight, setTargetWeight] = useState(0.7)
  const [proxySteps, setProxySteps] = useState(40)
  const [bigSteps, setBigSteps] = useState(400)

  /** The corpus is fixed at the fixture seed; the seed control moves the proxy's own sampling. */
  const corpus = useMemo(() => buildCorpus({ size, seed: 17, vocabulary: 48, topics: 5 }), [size])

  /** The proxy's own run, without the second arm — the weights the handover starts from. */
  const proxy = useMemo(
    () =>
      view === 'extrapolate'
        ? groupDroMixture(corpus, {
            eta,
            rounds: 6,
            sampleSize: 160,
            seed,
            training: { steps: proxySteps, learningRate: 0.5 },
          })
        : null,
    [view, corpus, eta, seed, proxySteps],
  )

  const handover = useMemo(() => {
    if (!proxy) return null
    const remaining = proxy.weights.reduce((sum, weight, index) => (index === targetDomain ? sum : sum + weight), 0)
    return {
      weights: extrapolateWeights(proxy.weights, targetDomain, targetWeight),
      remaining,
      scale: remaining > 0 ? (1 - targetWeight) / remaining : 0,
    }
  }, [proxy, targetDomain, targetWeight])

  const transfer = useMemo(
    () =>
      view === 'transfer'
        ? proxyTransfer(corpus, {
            targetDomain,
            targetWeight,
            eta,
            proxySteps,
            bigSteps,
            seed,
          })
        : null,
    [view, corpus, targetDomain, targetWeight, eta, proxySteps, bigSteps, seed],
  )

  const ranking = useMemo(() => {
    if (!transfer) return []
    const proxyWorst = transfer.rows.map((row) => row.proxyWorstLoss)
    const bigWorst = transfer.rows.map((row) => row.bigWorstLoss)
    return transfer.rows.map((row, index) => ({
      name: row.name,
      proxyRank: rankOf(proxyWorst)[index]!,
      bigRank: rankOf(bigWorst)[index]!,
      proxyWorstLoss: row.proxyWorstLoss,
      bigWorstLoss: row.bigWorstLoss,
    }))
  }, [transfer])

  const worstOfRows = useMemo(() => {
    if (!transfer) return null
    const big = transfer.rows.map((row) => row.bigWorstLoss)
    const lowest = Math.min(...big)
    const highest = Math.max(...big)
    return {
      bestName: transfer.rows[big.indexOf(lowest)]!.name,
      worstName: transfer.rows[big.indexOf(highest)]!.name,
      spread: highest - lowest,
    }
  }, [transfer])

  /** Where the mixture the handover produced ended up, in each arm's ordering. */
  const extrapolatedRank = useMemo(
    () => ranking.find((row) => row.name === 'extrapolated from the proxy'),
    [ranking],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory H · The proxy step"
        subtitle="Find the mixture on a small model, hand it to a big one, and check whether it survived the trip"
        accent="indigo"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'extrapolate', label: 'The handover' },
              { value: 'transfer', label: 'The trip' },
            ]}
          />
          <Slider label="Corpus documents" value={size} min={200} max={600} step={50} onChange={setSize} />
          <Slider
            label="The proxy's sampling seed"
            value={seed}
            min={1}
            max={99}
            onChange={setSeed}
            hint="Which documents the proxy draws, and which documents both arms are scored against."
          />
          <Slider
            label="The reweighting strength"
            value={eta}
            min={0}
            max={4}
            step={0.5}
            onChange={setEta}
            format={(value) => value.toFixed(1)}
          />
          <Slider
            label="The domain pinned"
            value={targetDomain}
            min={0}
            max={DOMAINS.length - 1}
            onChange={setTargetDomain}
            format={(value) => DOMAINS[value] ?? String(value)}
            hint="DoReMi pins the domain it is trying to help; here that is usually the smallest one."
          />
          <Slider
            label="The weight it is pinned at"
            value={targetWeight}
            min={0}
            max={1}
            step={0.05}
            onChange={setTargetWeight}
            format={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Slider
            label="The proxy's steps"
            value={proxySteps}
            min={10}
            max={200}
            step={10}
            onChange={setProxySteps}
          />
          {view === 'transfer' ? (
            <Slider
              label="The big arm's steps"
              value={bigSteps}
              min={100}
              max={1200}
              step={100}
              onChange={setBigSteps}
            />
          ) : null}
        </div>

        <div className="stat-row">
          <Stat
            label="The domain pinned"
            value={DOMAINS[targetDomain] ?? '?'}
            hint={`at ${(targetWeight * 100).toFixed(0)}% of the mixture`}
          />
          {proxy && handover ? (
            <>
              <Stat
                label="The mass left for the rest"
                value={fmt(1 - targetWeight, 2)}
                hint={`split across the other ${DOMAINS.length - 1} domains`}
              />
              <Stat
                label="The scaling factor"
                value={fmt(handover.scale, 4)}
                hint={`(1 − target) ÷ the proxy's remaining ${fmt(handover.remaining, 4)}`}
              />
              <Stat
                label="What the pin took from that domain"
                value={`${(
                  targetWeight - (proxy.weights[targetDomain] ?? 0)
                ).toFixed(3)}`}
                hint={`the proxy had it at ${fmt(proxy.weights[targetDomain] ?? 0, 4)}`}
                tone={targetWeight > (proxy.weights[targetDomain] ?? 0) ? 'good' : 'warn'}
              />
            </>
          ) : null}
          {transfer ? (
            <>
              <Stat
                label="Spearman's rho between the arms"
                value={fmt(transfer.rankCorrelation, 3)}
                hint="the ranking the whole method rests on"
                tone={transfer.rankCorrelation > 0.8 ? 'good' : transfer.rankCorrelation > 0.4 ? 'warn' : 'warn'}
              />
              <Stat
                label="The gain the paper claims"
                value={`${transfer.worstLossGain >= 0 ? '+' : ''}${fmt(transfer.worstLossGain, 4)}`}
                hint="natural mixture minus the proxy weights, on the big arm's worst loss"
                tone={transfer.worstLossGain > 0 ? 'good' : 'warn'}
              />
              <Stat
                label="The extrapolated mixture"
                value={`${transfer.extrapolatedWorstLossGain >= 0 ? '+' : ''}${fmt(transfer.extrapolatedWorstLossGain, 4)}`}
                hint="positive means the pinned mixture beat the natural one"
                tone={transfer.extrapolatedWorstLossGain > 0 ? 'good' : 'warn'}
              />
            </>
          ) : null}
        </div>

        {view === 'extrapolate' && proxy && handover ? (
          <>
            <Figure
              title="The arithmetic of the handover"
              description="The weights the proxy found, what share of the remaining mass each of them holds, and what each becomes once the target domain is pinned."
              caption="Pinning is a rescaling, nothing more: every non-target domain is multiplied by the same factor, so their ratios — and therefore the proxy's opinion about which of them matters more — pass through unchanged."
            >
              <DataTable
                caption="From proxy weights to final weights"
                headers={[
                  'Domain',
                  'The proxy weight',
                  'Its rank, on the proxy',
                  'Share of what is left',
                  'The extrapolated weight',
                  'Its rank, after the handover',
                ]}
                rows={(() => {
                  const rest = (weights: number[]) =>
                    rankOf(weights.filter((_, index) => index !== targetDomain))
                  const proxyRanks = rest(proxy.weights)
                  const finalRanks = rest(handover.weights)
                  let slot = 0
                  return proxy.weights.map((weight, index) => {
                    if (index === targetDomain) {
                      return [
                        DOMAINS[index] ?? String(index),
                        fmt(weight, 4),
                        '— pinned —',
                        '—',
                        fmt(handover.weights[index] ?? 0, 4),
                        '— pinned —',
                      ]
                    }
                    const row = [
                      DOMAINS[index] ?? String(index),
                      fmt(weight, 4),
                      proxyRanks[slot] ?? 0,
                      fmt(weight / (handover.remaining || 1), 4),
                      fmt(handover.weights[index] ?? 0, 4),
                      finalRanks[slot] ?? 0,
                    ]
                    slot += 1
                    return row
                  })
                })()}
              />
            </Figure>

            <Figure
              title="The two mixtures on one axis"
              description="Each domain's weight before and after the pin, in the order the domains are stored."
              caption="One bar is fixed by the slider and the others shrink to make room for it. That is the whole of the extrapolation step, and it is why the step cannot be wrong on its own terms — it can only be pointed at the wrong domain."
            >
              <TrendChart
                data={proxy.weights.map((weight, index) => ({
                  x: index + 1,
                  proxy: weight,
                  final: handover.weights[index] ?? 0,
                }))}
                series={[
                  { key: 'proxy', name: 'the proxy weights', colour: 'var(--accent-indigo)' },
                  { key: 'final', name: 'after the pin', colour: 'var(--accent-amber)' },
                ]}
                xLabel="the domain, in order"
                yLabel="the weight"
                height={240}
              />
            </Figure>

            <Callout tone="definition" title="What this step is for, and what it cannot do">
              DoReMi finds weights with a small model and uses them for a much larger one, because finding them at the
              target scale costs the run you were trying to save. The extrapolation step is the bridge: pin the domain
              you care about, keep the proxy's ordering of everything else. It has no way to know whether the proxy's
              ordering was the big model's ordering — that is an empirical claim, and the next view is where it gets
              tested. At the edges the arithmetic is well behaved: pinning a domain at 1 leaves a one-hot mixture, and
              pinning at 0 leaves the proxy weights, rescaled by nothing.
            </Callout>
          </>
        ) : null}

        {view === 'transfer' && transfer && worstOfRows ? (
          <>
            <Figure
              title="Four mixtures, two arms"
              description="Each candidate mixture trained briefly on a small sample and at length on the full one, scored by its worst domain."
              caption="The arms are the same model at different amounts of compute — the word big here means more steps, not more parameters, which is the one respect in which this analogue is weaker than the paper."
            >
              <DataTable
                caption="The candidates"
                headers={[
                  'The mixture',
                  'The weights',
                  'Proxy worst',
                  'Big worst',
                  'Proxy mean',
                  'Big mean',
                ]}
                rows={transfer.rows.map((row) => [
                  row.name,
                  row.weights.map((weight) => fmt(weight, 2)).join(' · '),
                  fmt(row.proxyWorstLoss, 4),
                  fmt(row.bigWorstLoss, 4),
                  fmt(row.proxyMeanLoss, 4),
                  fmt(row.bigMeanLoss, 4),
                ])}
              />
            </Figure>

            <Figure
              title="Did the ranking travel?"
              description="Each mixture's rank by worst loss in the proxy arm and in the big arm, 1 being the worst."
              caption="The method needs these two columns to agree. Where they do not, the proxy spent its cheap compute on an ordering the target model does not share, and the weights handed over are the weights of a different run."
            >
              <DataTable
                caption="Rank by worst loss, per arm"
                headers={['The mixture', 'The proxy rank', 'The big rank', 'The difference']}
                rows={ranking.map((row) => [
                  row.name,
                  row.proxyRank,
                  row.bigRank,
                  row.proxyRank - row.bigRank,
                ])}
              />
            </Figure>

            <div className="stat-row">
              <Stat label="Best on the big arm" value={worstOfRows.bestName} />
              <Stat
                label="Worst on the big arm"
                value={worstOfRows.worstName}
                hint={`the spread is ${fmt(worstOfRows.spread, 4)} nats`}
                tone="warn"
              />
              <Stat
                label="The handover's own ranking"
                value={
                  extrapolatedRank
                    ? `${extrapolatedRank.proxyRank} in the proxy, ${extrapolatedRank.bigRank} in the big arm`
                    : '—'
                }
                hint="the extrapolated mixture, ranked by worst loss in each arm"
                tone={extrapolatedRank && extrapolatedRank.bigRank === 4 ? 'warn' : 'good'}
              />
            </div>

            <Callout tone="warning" title="The claim this laboratory cannot make">
              DoReMi's second half — that the proxy's ranking transfers — is the part that needs evidence, and in this
              analogue it gets the opposite of evidence on one seed and the right answer on another. The module's tests
              measure rho at 1.000 on one corpus and 0.200 on the next, with the best mixture in the second case being
              one the proxy had ranked third. The extrapolated mixture is the <em>worst</em> of the four on the big arm
              at both of those seeds, which is the honest headline for this screen: the handover is exact, the proxy is
              not a small version of the target, and pinning a domain amplifies whatever the proxy got wrong about it.
              Move the seed slider and watch the rho column: a method whose transfer works on the seed you tried is a
              method you have not yet tested.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
