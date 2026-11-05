import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  buildTrainingRecords,
  extractionCurve,
  runExtraction,
} from '../../core/measures'
import {
  buildCorpus,
  continuationProbability,
  duplicationCurve,
  expectedExtraction,
  extractionAccuracy,
  membershipAttack,
  PRIOR,
  queryCurve,
  TOKENS,
} from '../../core/memorisation'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart, useViewParam } from '@llm-materials/course-ui'
import { PRIVACY_DEFAULTS } from '../../content/labDefaults'

type View = 'extraction' | 'membership' | 'budget' | 'duplication'

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const PRIVACY_VIEWS: { value: View; label: string }[] = [
  { value: 'extraction', label: 'The extraction' },
  { value: 'membership', label: 'Who was in the set' },
  { value: 'budget', label: 'What the queries buy' },
  { value: 'duplication', label: 'Extraction against duplication' },
]

/** The budgets the attacker can be given, and the defence is priced against. */
const BUDGETS = [1, 2, 4, 8, 16, 32, 64]

/** The four kinds of candidate a corpus of this shape contains. */
function groupOf(candidate: { count: number; member: boolean; probability: number }) {
  if (candidate.member && candidate.count > 1) return 'a member, seen more than once'
  if (candidate.member) return 'a member, seen once'
  if (candidate.probability > 1 / TOKENS) return 'an outsider that resembles a member'
  return 'an outsider, nothing to resemble'
}

const GROUPS = [
  'a member, seen once',
  'a member, seen more than once',
  'an outsider that resembles a member',
  'an outsider, nothing to resemble',
]

export function PrivacyLab() {
  const [view, setView] = useViewParam(PRIVACY_VIEWS)
  const [records, setRecords] = useState(PRIVACY_DEFAULTS.records)
  const [prefixLength, setPrefixLength] = useState(PRIVACY_DEFAULTS.prefixLength)
  const [guesses, setGuesses] = useState(PRIVACY_DEFAULTS.guesses)
  const [candidates, setCandidates] = useState(PRIVACY_DEFAULTS.candidates)
  const [repeatShare, setRepeatShare] = useState(PRIVACY_DEFAULTS.repeatShare)
  const [maxCount, setMaxCount] = useState(PRIVACY_DEFAULTS.maxCount)
  const [nearDuplicateShare, setNearDuplicateShare] = useState(PRIVACY_DEFAULTS.nearDuplicateShare)
  const [queries, setQueries] = useState(PRIVACY_DEFAULTS.queries)
  const [seed, setSeed] = useState(PRIVACY_DEFAULTS.seed)

  // The prefix attack: a corpus of records with a shared prefix and a unique
  // secret, and a model that is more certain of the next character the more of
  // the record the attacker already has.
  const training = useMemo(() => buildTrainingRecords(records, seed), [records, seed])
  const extraction = useMemo(
    () => runExtraction(training, { prefixLength, guesses, seed }),
    [training, prefixLength, guesses, seed],
  )
  const exposure = useMemo(
    () => extractionCurve(training, [0, 1, 2, 3, 4, 6, 8], { guesses, seed }),
    [training, guesses, seed],
  )

  // The membership attack: the same fact — how many times the model saw this
  // sequence — queried instead as a test of whether the record was in the set.
  const corpus = useMemo(
    () => buildCorpus(candidates, { repeatShare, maxCount, nearDuplicateShare, seed }),
    [candidates, repeatShare, maxCount, nearDuplicateShare, seed],
  )
  const attack = useMemo(() => membershipAttack(corpus, { queries, seed }), [corpus, queries, seed])

  // The same corpus with the near-duplicates taken out, which is the corpus a
  // laboratory reports and a real one never is.
  const cleanCorpus = useMemo(
    () => buildCorpus(candidates, { repeatShare, maxCount, nearDuplicateShare: 0, seed }),
    [candidates, repeatShare, maxCount, seed],
  )
  const cleanAttack = useMemo(() => membershipAttack(cleanCorpus, { queries, seed }), [cleanCorpus, queries, seed])

  const composition = useMemo(() => {
    const baseline = 1 / TOKENS
    return GROUPS.map((name) => {
      const members = corpus.filter((candidate) => groupOf(candidate) === name)
      if (members.length === 0) {
        return { name, count: 0, share: 0, mean: baseline, score: 0, seen: 0 }
      }
      const mean = members.reduce((sum, candidate) => sum + candidate.probability, 0) / members.length
      const seen = members.reduce((sum, candidate) => sum + candidate.count, 0) / members.length
      return {
        name,
        count: members.length,
        share: members.length / corpus.length,
        mean,
        score: Math.log(mean / baseline),
        seen,
      }
    })
  }, [corpus])

  const budgets = useMemo(() => queryCurve(corpus, BUDGETS, { seed }), [corpus, seed])
  const oneQuery = useMemo(() => queryCurve(corpus, [1], { seed })[0], [corpus, seed])

  // One record, one count, and the two numbers an attacker cares about at each
  // of them: the chance it is said back, and the score the test is built on. The
  // counts are the ones this corpus actually contains, so every candidate sits
  // in exactly one row.
  const distinctCounts = useMemo(() => {
    const set = new Set(corpus.map((candidate) => candidate.count))
    set.add(maxCount)
    return Array.from(set).sort((a, b) => a - b)
  }, [corpus, maxCount])
  const counts = useMemo(() => duplicationCurve(distinctCounts, { seed }), [distinctCounts, seed])
  const listed = useMemo(
    () =>
      counts.reduce(
        (sum, row) => sum + corpus.filter((candidate) => candidate.count === row.count).length,
        0,
      ),
    [counts, corpus],
  )

  const members = useMemo(() => corpus.filter((candidate) => candidate.member), [corpus])
  const outsiders = useMemo(() => corpus.filter((candidate) => !candidate.member), [corpus])
  const observedExtraction = useMemo(() => extractionAccuracy(members), [members])
  const expectedMembers = useMemo(() => expectedExtraction(members), [members])

  return (
    <div className="lab">
      <Panel
        title="Laboratory G · Privacy"
        subtitle="What a model can be made to give back, and who can tell"
        accent="emerald"
      >
        <div className="lab-controls">
          <SegmentedControl label="View" value={view} onChange={setView} options={PRIVACY_VIEWS} />
          <Slider
            label="The records the prefix attack is run over"
            value={records}
            min={10}
            max={200}
            step={10}
            onChange={setRecords}
            hint="A synthetic corpus: every record shares its prefix with every other and differs only in its secret, which is the shape the extraction literature studies."
          />
          <Slider
            label="The prefix the attacker has"
            value={prefixLength}
            min={0}
            max={8}
            onChange={setPrefixLength}
            hint="How much of the record the attacker already knows."
          />
          <Slider label="The guesses per record" value={guesses} min={1} max={12} onChange={setGuesses} />
          <Slider
            label="The candidates the test is run over"
            value={candidates}
            min={40}
            max={600}
            step={20}
            onChange={setCandidates}
          />
          <Slider
            label="The share of members seen more than once"
            value={repeatShare}
            min={0}
            max={1}
            step={0.05}
            onChange={setRepeatShare}
            format={(value) => `${(value * 100).toFixed(0)}%`}
            hint="Duplication is what memorisation is a function of, and this slider is the one the whole result moves along."
          />
          <Slider
            label="The most copies a duplicated record is given"
            value={maxCount}
            min={2}
            max={32}
            onChange={setMaxCount}
          />
          <Slider
            label="The share of outsiders that resemble a member"
            value={nearDuplicateShare}
            min={0}
            max={1}
            step={0.05}
            onChange={setNearDuplicateShare}
            format={(value) => `${(value * 100).toFixed(0)}%`}
            hint="Planted, and the reason the attack has a precision at all. A corpus with none gives a test that cannot fail."
          />
          <Slider
            label="The queries per candidate"
            value={queries}
            min={1}
            max={64}
            onChange={setQueries}
            hint="The attacker's budget. The decision line moves with it, so two rows at different budgets are not the same test."
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        {view === 'extraction' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The exposure"
                value={`${fmt(extraction.successRate * 100, 1)}%`}
                hint="of the training set, at this prefix"
                tone="warn"
              />
              <Stat label="The records recovered" value={`${extraction.recovered} of ${extraction.total}`} />
              <Stat label="The guesses spent" value={String(extraction.tokensGuessed)} />
              <Stat
                label="The guesses per recovery"
                value={fmt(extraction.tokensGuessed / Math.max(1, extraction.recovered), 2)}
              />
            </div>

            <Figure
              title="The exposure against the length of the known prefix"
              description="The success rate of the attack as the attacker learns more of each record, at the same guess budget."
              caption="The certainty the model gives the next character goes as the prefix over the prefix plus four, so the curve is that ratio and nothing else — which is why the number to quote alongside an exposure is the prefix it was measured at."
            >
              <TrendChart
                data={exposure.map((row) => ({ x: row.prefixLength, rate: row.successRate * 100 }))}
                series={[{ key: 'rate', name: 'the exposure', colour: 'var(--accent-emerald)' }]}
                xLabel="the length of the known prefix"
                yLabel="in per cent"
                height={270}
              />
            </Figure>

            <Figure
              title="What the attacker gets, record by record"
              description="Each record, what the attacker had already, and how many guesses the recovery took."
              caption="A recovery on the first guess and a recovery on the last both count once in the exposure, and they are not the same attack. The corpus is synthetic, so the secrets here are invented; the shape of the curve is the point."
            >
              <DataTable
                caption="The records"
                headers={['The record', 'The prefix held', 'The secret', 'Recovered?', 'The guesses it took']}
                rows={training.slice(0, 8).map((record, index) => {
                  const detail = extraction.details[index]
                  return [
                    index + 1,
                    record.prefix.slice(0, prefixLength),
                    record.secret,
                    detail?.recovered ? 'yes' : 'no',
                    detail?.guessesUsed ?? 0,
                  ]
                })}
              />
            </Figure>

            <Callout tone="warning" title="A privacy claim is a claim about the training set">
              The exposure here is the fraction of a *sample* of records the attack recovered at a prefix of{' '}
              {prefixLength} and a budget of {guesses} guesses, and it is a lower bound on what an attacker with more
              of either would get. A claim that the model does not leak personal data is a claim about this number, and
              the number needs a prefix, a budget and a sample to mean anything.
            </Callout>
          </>
        ) : null}

        {view === 'membership' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The AUC"
                value={`${fmt(attack.auc * 100, 1)}%`}
                hint="a random member outranks a random outsider"
                tone="warn"
              />
              <Stat
                label="Caught"
                value={`${fmt(attack.truePositiveRate * 100, 1)}%`}
                hint={`of the ${members.length} members`}
              />
              <Stat
                label="Wrongly caught"
                value={`${fmt(attack.falsePositiveRate * 100, 1)}%`}
                hint={`of the ${outsiders.length} outsiders`}
                tone="warn"
              />
              <Stat
                label="Its precision"
                value={`${fmt(attack.precision * 100, 1)}%`}
                hint={`of the ${attack.flagged} it flagged`}
              />
            </div>

            <Figure
              title="The corpus the attack is shown"
              description="The four kinds of candidate in it, what the model gives each on average, and the log-ratio over the baseline that follows."
              caption="Everything the attack can do comes from the last column: the score is the log of the model's own probability over what a model that never saw the record would give. The groups are planted, not discovered, and the shares are the sliders."
            >
              <DataTable
                caption="The composition"
                headers={['The kind of candidate', 'In the corpus', 'The share', 'Copies it saw', 'The model gives', 'Its score']}
                rows={composition.map((row) => [
                  row.name,
                  row.count,
                  `${fmt(row.share * 100, 1)}%`,
                  fmt(row.seen, 1),
                  `${fmt(row.mean * 100, 2)}%`,
                  fmt(row.score, 3),
                ])}
              />
            </Figure>

            <Figure
              title="What the near-duplicates cost"
              description="The same attack, the same seed and budget, over this corpus and over the same corpus with the resemble-a-member outsiders removed."
              caption="The catch rate barely moves and the precision falls, because the false positives are all in one group. A membership result quoted without the near-duplicate rate in the corpus is a result about a corpus nobody trains on."
            >
              <DataTable
                caption="The two corpora"
                headers={['The corpus', 'The candidates', 'Caught', 'Wrongly caught', 'Precision', 'The AUC']}
                rows={[
                  [
                    `${fmt(nearDuplicateShare * 100, 0)}% resemble a member`,
                    corpus.length,
                    `${fmt(attack.truePositiveRate * 100, 1)}%`,
                    `${fmt(attack.falsePositiveRate * 100, 1)}%`,
                    `${fmt(attack.precision * 100, 1)}%`,
                    `${fmt(attack.auc * 100, 1)}%`,
                  ],
                  [
                    'none resemble one',
                    cleanCorpus.length,
                    `${fmt(cleanAttack.truePositiveRate * 100, 1)}%`,
                    `${fmt(cleanAttack.falsePositiveRate * 100, 1)}%`,
                    `${fmt(cleanAttack.precision * 100, 1)}%`,
                    `${fmt(cleanAttack.auc * 100, 1)}%`,
                  ],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="One number, two attacks">
              Membership asks whether a record was in the set; extraction, above, asks how much of it comes back. Both
              read the same quantity — how many copies the model saw — which is why the two papers are one argument. At{' '}
              {maxCount} copies the count model gives its continuation {fmt(continuationProbability(maxCount) * 100, 1)
              } per cent of the time, against {fmt((1 / TOKENS) * 100, 1)} per cent for anything it has never seen, and
              the score the test is built on is the log of that ratio.
            </Callout>
          </>
        ) : null}

        {view === 'budget' ? (
          <>
            <div className="stat-row">
              <Stat label="At this budget" value={`${queries} queries`} />
              <Stat label="The AUC it buys" value={`${fmt(attack.auc * 100, 1)}%`} tone="warn" />
              <Stat
                label="At one query"
                value={`${fmt((oneQuery?.auc ?? 0) * 100, 1)}%`}
                hint="the same corpus, the same seed"
              />
              <Stat
                label="The gain"
                value={`${fmt((attack.auc - (oneQuery?.auc ?? 0)) * 100, 1)} points`}
                tone="good"
              />
            </div>

            <Figure
              title="Attack power against the attacker's budget"
              description="The same corpus queried a different number of times, with the decision line redrawn at each budget so the rows are tests of the same strength."
              caption="At one query the statistic is a coin: a member clears the line exactly as often as it happens to say the record back. Every point above chance was bought with queries, and the papers' near-perfect AUCs are the far end of this curve rather than a property of the model."
            >
              <TrendChart
                data={budgets.map((row) => ({
                  x: row.queries,
                  auc: row.auc * 100,
                  caught: row.truePositiveRate * 100,
                  wrong: row.falsePositiveRate * 100,
                  precision: row.precision * 100,
                }))}
                series={[
                  { key: 'auc', name: 'the AUC', colour: 'var(--accent-emerald)' },
                  { key: 'caught', name: 'the members caught', colour: 'var(--accent-teal)' },
                  { key: 'wrong', name: 'the outsiders wrongly caught', colour: 'var(--accent-rose)' },
                  { key: 'precision', name: 'its precision', colour: 'var(--accent-amber)' },
                ]}
                xLabel="the queries per candidate"
                yLabel="in per cent"
                height={280}
              />
            </Figure>

            <Figure
              title="The same test at each budget"
              description="Every row a decision line drawn against that row's own budget."
              caption="A rate limit is the defence this table prices: it does not lower the AUC of an attacker who has already spent the queries, it decides which row of this table you are in."
            >
              <DataTable
                caption="The budgets"
                headers={['The queries', 'The AUC', 'Members caught', 'Outsiders wrongly caught', 'Precision', 'Flagged as members']}
                rows={budgets.map((row) => [
                  row.queries,
                  `${fmt(row.auc * 100, 1)}%`,
                  `${fmt(row.truePositiveRate * 100, 1)}%`,
                  `${fmt(row.falsePositiveRate * 100, 1)}%`,
                  `${fmt(row.precision * 100, 1)}%`,
                  row.flagged,
                ])}
              />
            </Figure>

            <Callout tone="note" title="Why the line moves with the budget">
              The attacker's estimate of the probability is a count over {queries} queries, and a baseline model is
              expected to return its own one-in-{TOKENS} share of them. A candidate that merely matches that is saying
              nothing, so the line is the baseline's own smoothed estimate rather than zero — and a line drawn against
              one budget is meaningless quoted against another.
            </Callout>
          </>
        ) : null}

        {view === 'duplication' ? (
          <>
            <div className="stat-row">
              <Stat
                label="The extraction rate"
                value={`${fmt(observedExtraction * 100, 1)}%`}
                hint="sampled over the members"
                tone="warn"
              />
              <Stat label="The same, by arithmetic" value={`${fmt(expectedMembers * 100, 1)}%`} hint="the mean of their probabilities" />
              <Stat label="The members" value={String(members.length)} />
              <Stat label="The prior" value={`${PRIOR} copies`} hint={`over ${TOKENS} tokens`} />
            </div>

            <Figure
              title="Extraction accuracy against the duplication rate"
              description="One record, seen this many times, and the share of the time the model says it back."
              caption="The two lines are the check this file runs on itself: the sampled rate should sit within noise of the mean of the probabilities, and if it does not, the sampling is broken rather than the phenomenon. The curve is the figure the paper reports, and the axis is the one the defence can actually change."
            >
              <TrendChart
                data={counts.map((row) => ({
                  x: row.count,
                  expected: row.probability * 100,
                  observed: row.observed * 100,
                }))}
                series={[
                  { key: 'expected', name: 'what the arithmetic says', colour: 'var(--accent-teal)' },
                  { key: 'observed', name: 'what the sample gave', colour: 'var(--accent-emerald)' },
                ]}
                xLabel="the copies the model saw"
                yLabel="in per cent"
                height={280}
              />
            </Figure>

            <Figure
              title="The corpus, grouped by how many copies each candidate got"
              description="Each count that appears in this corpus, how many candidates sit at it, and what the model says back at it."
              caption={`A model that memorised a record can be made to give it back, and the only lever a defence has is the first column. The ${counts.length} rows place ${listed} candidates out of the ${corpus.length} in the corpus, and the gap between the two middle columns at each count is the noise, printed rather than hidden.`}
            >
              <DataTable
                caption="The duplication"
                headers={['The copies', 'Candidates at this count', 'The model gives', 'Said back, sampled', 'Its score over the baseline']}
                rows={counts.map((row) => [
                  row.count,
                  corpus.filter((candidate) => candidate.count === row.count).length,
                  `${fmt(row.probability * 100, 2)}%`,
                  `${fmt(row.observed * 100, 2)}%`,
                  fmt(row.score, 3),
                ])}
              />
            </Figure>

            <Callout tone="warning" title="A toy, and what it is a toy of">
              This is a count model with a prior of {PRIOR} pseudocounts over {TOKENS} tokens, and the duplication
              rates are planted by a slider. What transfers to a real model is the *shape* — extraction accuracy rising
              along the duplication axis, and the membership score being the same curve in log form — not any of the
              numbers on this page.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
