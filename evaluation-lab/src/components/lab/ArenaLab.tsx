import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { MODELS, NEUTRAL_JUDGE, buildAnswers, buildQuestions } from '../../core/setting'
import {
  bootstrapRanking,
  pairwiseWinProbability,
  rankWithBradleyTerry,
  rankingAccuracy,
  runArena,
  runArenaElo,
  rankingStability,
  votesNeeded,
  votesToSeparate,
} from '../../core/arena'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'

type View = 'ranking' | 'interval' | 'cost' | 'stability'

export const ARENA_VIEWS: { value: View; label: string }[] = [
  { value: 'ranking', label: 'The ranking' },
  { value: 'interval', label: 'The interval' },
  { value: 'cost', label: 'The cost' },
  { value: 'stability', label: 'The fixed set' },
]

export function ArenaLab() {
  const [view, setView] = useViewParam(ARENA_VIEWS)
  const [votesPerPair, setVotesPerPair] = useState(2)
  const [questionCount, setQuestionCount] = useState(30)
  const [seed, setSeed] = useState(41)

  const questions = useMemo(() => buildQuestions(questionCount, 5), [questionCount])
  const answers = useMemo(() => buildAnswers(MODELS, questions, 11), [questions])

  const arena = useMemo(
    () => runArena(MODELS, questions, answers, NEUTRAL_JUDGE, votesPerPair, seed),
    [questions, answers, votesPerPair, seed],
  )

  const ranking = useMemo(() => rankWithBradleyTerry(MODELS, arena.wins), [arena.wins])
  const accuracy = useMemo(
    () => rankingAccuracy(MODELS, ranking, answers, questions),
    [ranking, answers, questions],
  )
  const intervals = useMemo(() => bootstrapRanking(MODELS, arena.wins, 300, seed + 1), [arena.wins, seed])
  const elo = useMemo(() => runArenaElo(MODELS, arena.wins, 32, seed + 2), [arena.wins, seed])
  const stability = useMemo(
    () => rankingStability(MODELS, questions, answers, NEUTRAL_JUDGE, { draws: 24, seed: seed + 3 }),
    [questions, answers, seed],
  )

  /** How much of the ranking survives when only a fraction of the questions is used. */
  const stabilityCurve = useMemo(() => {
    const rows: { x: number; agreement: number; sameTop: number }[] = []
    for (const fraction of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
      const result = rankingStability(MODELS, questions, answers, NEUTRAL_JUDGE, {
        draws: 16,
        seed: seed + 3,
        fraction,
      })
      rows.push({
        x: fraction,
        agreement: result.meanAgreement,
        sameTop: result.sameTop / result.draws,
      })
    }
    return rows
  }, [questions, answers, seed])

  /** How the interval on the top two models narrows as the votes accumulate. */
  const intervalCurve = useMemo(() => {
    const rows: { x: number; low: number; high: number }[] = []
    for (let votes = 1; votes <= votesPerPair; votes++) {
      const partial = runArena(MODELS, questions, answers, NEUTRAL_JUDGE, votes, seed)
      const partialIntervals = bootstrapRanking(MODELS, partial.wins, 200, seed + votes)
      const top = partialIntervals[0]
      rows.push({ x: votes, low: top.low, high: top.high })
    }
    return rows
  }, [questions, answers, votesPerPair, seed])

  const top = intervals[0]
  const second = intervals[1]
  const gap = top && second ? top.strength - second.strength : 0

  return (
    <div className="lab">
      <Panel
        title="Laboratory C · The arena"
        subtitle="Votes in, a ranking out — and an interval on it"
        accent="emerald"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={ARENA_VIEWS}
          />
          <Slider
            label="Votes per pair"
            value={votesPerPair}
            min={1}
            max={8}
            onChange={setVotesPerPair}
            hint="How many times each pair is compared."
          />
          <Slider
            label="Questions"
            value={questionCount}
            min={5}
            max={60}
            onChange={setQuestionCount}
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="Votes cast" value={String(arena.totalVotes)} hint="the cost of this leaderboard" />
          <Stat label="Pairs contested" value={String(arena.contestedPairs)} hint="the close ones" />
          <Stat label="Ranking accuracy" value={`${fmt(accuracy.accuracy * 100, 1)}%`} hint="against the true order" />
          <Stat
            label="Top-two gap"
            value={fmt(gap, 3)}
            hint="the fitted strength difference"
            tone={gap > 0.1 ? 'good' : 'warn'}
          />
        </div>

        {view === 'ranking' ? (
          <>
            <Figure
              title="The fitted strengths"
              description="The Bradley–Terry strength of each model, with the bootstrap interval on each, ordered from best to worst."
              caption="The Bradley–Terry fit to the collected votes, with a 95% bootstrap interval on each strength. The intervals are what a leaderboard should print and almost none do."
            >
              <DataTable
                caption="The ranking"
                headers={['Rank', 'Model', 'Strength', '95% interval', 'P(first)']}
                rows={intervals.map((interval, index) => [
                  index + 1,
                  MODELS.find((model) => model.id === interval.modelId)?.name ?? interval.modelId,
                  fmt(interval.strength, 4),
                  `[${fmt(interval.low, 3)}, ${fmt(interval.high, 3)}]`,
                  `${fmt(interval.topProbability * 100, 1)}%`,
                ])}
              />
            </Figure>

            <Figure
              title="Bradley–Terry against Elo"
              description="The two rankings, side by side: the maximum-likelihood Bradley–Terry fit and the online Elo season over the same votes."
              caption="The same votes, two ways of summarising them. Bradley–Terry is a maximum-likelihood fit and does not depend on the order of the votes; Elo is an online update and does."
            >
              <DataTable
                caption="Two rankings, one set of votes"
                headers={['Bradley–Terry', 'Elo']}
                rows={ranking.order.map((id, index) => [
                  `${index + 1}. ${MODELS.find((model) => model.id === id)?.name ?? id}`,
                  `${index + 1}. ${MODELS.find((model) => model.id === elo.order[index])?.name ?? elo.order[index]}`,
                ])}
              />
            </Figure>

            <Callout tone="note" title="Why the strengths are not counts">
              The Bradley–Terry model does not treat a win as a vote to be tallied. A model that wins nine comparisons
              out of ten against a strong field is rated higher than one that wins nine out of ten against a weak one,
              because the comparison carries information about the opponent too.
            </Callout>
          </>
        ) : null}

        {view === 'interval' ? (
          <>
            <Figure
              title="How the interval on the leader narrows"
              description="The 95% bootstrap interval on the top model's strength, as the number of votes per pair increases."
              caption="The interval on the leader, against the number of votes per pair. It narrows slowly, because the votes are not independent — the same questions are being re-used."
            >
              <TrendChart
                data={intervalCurve}
                series={[
                  { key: 'low', name: 'lower bound', colour: 'var(--accent-rose)' },
                  { key: 'high', name: 'upper bound', colour: 'var(--accent-teal)' },
                ]}
                xLabel="votes per pair"
                yLabel="the fitted strength"
                height={280}
              />
            </Figure>

            <DataTable
              caption="Every interval, with the probability of being first"
              headers={['Model', 'Strength', 'Lower', 'Upper', 'P(first)']}
              rows={intervals.map((interval) => [
                MODELS.find((model) => model.id === interval.modelId)?.name ?? interval.modelId,
                fmt(interval.strength, 4),
                fmt(interval.low, 4),
                fmt(interval.high, 4),
                `${fmt(interval.topProbability * 100, 1)}%`,
              ])}
            />

            <Callout tone="warning" title="An overlap is not a result">
              When two intervals overlap, the ordering between those two models is not established. A leaderboard that
              prints a strict order has usually decided a tie that the data does not support — and the newest criticism
              of the field is about exactly that.
            </Callout>
          </>
        ) : null}

        {view === 'cost' ? (
          <>
            <Figure
              title="How many votes to tell two models apart"
              description="The number of pairwise comparisons needed to establish that one model is better than another, as a function of the true win rate between them."
              caption="The cost of precision. At a win rate near one half, the number of votes needed grows without bound, which is exactly why arenas that compare distant models settle so quickly and close ones do not."
            >
              <DataTable
                caption="Votes needed to separate two models, at 95% confidence"
                headers={['True win rate', 'Strength difference', 'Votes needed']}
                rows={[0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9].map((p) => {
                  const delta = Math.log(p / (1 - p))
                  const needed = votesNeeded(delta)
                  return [fmt(p, 2), fmt(delta, 3), Number.isFinite(needed) ? String(needed) : 'never']
                })}
              />
            </Figure>

            <Figure
              title="The separation of the top two, as it stands"
              description="The number of votes that would be needed to separate the current top two models, and how many have been cast."
              caption="What the current vote count buys. When the votes needed exceeds the votes cast, the ordering of the top two is not established."
            >
              <DataTable
                caption="The top two"
                headers={['Quantity', 'Value']}
                rows={(() => {
                  const p = pairwiseWinProbability(Math.max(0.01, gap))
                  const needed = votesNeeded(Math.max(0.01, gap))
                  const separation = votesToSeparate(gap, p, arena.totalVotes)
                  return [
                    ['the fitted gap', fmt(gap, 4)],
                    ['the implied win rate', fmt(p, 4)],
                    ['votes cast', String(arena.totalVotes)],
                    ['votes needed to separate', String(needed)],
                    ['the 95% lower bound on the wins', fmt(separation.lowerBound, 1)],
                    ['separated at 95%?', separation.separated ? 'yes' : 'no'],
                  ]
                })()}
              />
            </Figure>

            <Callout tone="definition" title="What a vote costs">
              An arena vote is a real inference: two models are queried, and the platform pays for both. The cost of the
              votes is what bounds how precise a leaderboard can be, and it is why the newest work on leaderboards is
              about which comparisons are worth making at all.
            </Callout>
          </>
        ) : null}
        {view === 'stability' ? (
          <>
            <div className="stat-row">
              <Stat
                label="Top model kept"
                value={`${stability.sameTop} of ${stability.draws}`}
                hint="half-question subsets"
                tone={stability.sameTop === stability.draws ? 'good' : 'warn'}
              />
              <Stat
                label="Pair orders kept"
                value={`${fmt(stability.meanAgreement * 100, 1)}%`}
                hint="against the full set's ranking"
              />
              <Stat label="Questions in each subset" value={String(Math.max(4, Math.round(questionCount * 0.5)))} />
              <Stat label="Models ranked" value={String(MODELS.length)} />
            </div>

            <Figure
              title="The ranking that the other half of the questions would have produced"
              description="Each point uses a random fraction of the question set, runs the arena and the Bradley–Terry fit on it, and compares the resulting order with the order from the full set."
              caption="Sixteen draws at each fraction, against the ranking on the full set. At small fractions the ranking is a coin toss; it only stabilises once most of the question set is in use, which is the sense in which a fixed benchmark is a choice rather than a measurement."
            >
              <TrendChart
                data={stabilityCurve}
                series={[
                  { key: 'agreement', name: 'pairs in the same order', colour: 'var(--accent-emerald)' },
                  { key: 'sameTop', name: 'the same top model', colour: 'var(--accent-teal)', dashed: true },
                ]}
                xLabel="fraction of the question set used"
                yLabel="agreement with the full ranking"
                yDomain={[0.4, 1]}
                height={280}
              />
            </Figure>

            <DataTable
              caption="Stability, against the subset size"
              headers={['Fraction used', 'Pairs in the same order', 'The same top model']}
              rows={stabilityCurve.map((row) => [
                fmt(row.x * 100, 0) + '%',
                `${fmt(row.agreement * 100, 1)}%`,
                `${fmt(row.sameTop * 100, 0)}%`,
              ])}
            />

            <Callout tone="warning" title="One question set, one ranking">
              A leaderboard built on a fixed question set is not estimating a model’s rank — it is estimating the rank
              that this question set gives it. The two coincide only when the set is large and varied enough that a
              random half of it reproduces the whole. The table above is the check, and it costs nothing to run.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
