import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  COST_MODEL,
  CRITIC_WEIGHTS,
  CRITIQUE_CASES,
  DEFAULT_AGENTIC_CONFIG,
  FACT_BY_ID,
  PIPELINE_CASES,
  comparePipelines,
  runAdaptiveRetrieval,
  runQuestionDecomposition,
  type AgenticRetrievalConfig,
  type CritiqueRun,
  type PipelineRow,
} from '../../engine/demos/agenticRetrieval'
import {
  Badge,
  Callout,
  Card,
  ChartFigure,
  Field,
  Panel,
  Slider,
  StatTile,
  TabPanel,
  Tabs,
} from '../../ui/primitives'
import { LabReflection } from '../../ui/lesson/LabReflection'
import { useProgress } from '../../store/progress'
import { LAB_BY_ID } from '../../content/labs'

const percent = (value: number) => `${(value * 100).toFixed(1)}%`
const signed = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value)}`
const cell = 'border-b px-2 py-1.5 align-top text-xs'
const CELL_STYLE = { borderColor: 'var(--border-soft)' } as const

/** The gate threshold swept far enough to show it start eating correct answers. */
const OVERLAP_SWEEP = [0, 1, 2, 3, 4, 5, 6]
/** The hop trust margin swept from "believe anything" to "believe almost nothing". */
const MARGIN_SWEEP = [0, 0.02, 0.05, 0.1, 0.2, 0.34]

const ACTION_LABEL: Record<CritiqueRun['action'], string> = {
  'answer-internally': 'answered without looking',
  answer: 'answered from the window',
  'answer-after-rewrite': 'rewrote, then answered',
  abstain: 'abstained',
}

const VERDICT_TONE = { right: 'emerald', wrong: 'rose', abstained: 'amber' } as const

function verdictOf(run: { correct: boolean; abstained: boolean }) {
  if (run.abstained) return { label: 'abstained', tone: VERDICT_TONE.abstained }
  return run.correct ? { label: 'right', tone: VERDICT_TONE.right } : { label: 'wrong', tone: VERDICT_TONE.wrong }
}

export function AgenticRetrievalLabPage() {
  const progress = useProgress()
  const lab = LAB_BY_ID.get('retrieval')
  const [config, setConfig] = useState<AgenticRetrievalConfig>(DEFAULT_AGENTIC_CONFIG)
  const [tab, setTab] = useState<'gate' | 'hops' | 'shapes'>('gate')

  const critique = useMemo(() => runAdaptiveRetrieval(config), [config])
  const decomposition = useMemo(() => runQuestionDecomposition(config), [config])
  const pipelines = useMemo(() => comparePipelines(config), [config])

  const overlapSweep = useMemo(
    () =>
      OVERLAP_SWEEP.map((threshold) => {
        const gated = runAdaptiveRetrieval({ ...config, minCorpusOverlap: threshold }).gated
        return {
          threshold,
          issued: gated.retrievalsIssued,
          avoided: gated.retrievalsAvoided,
          wronglySkipped: gated.wronglySkipped,
          correct: gated.correct,
          tokens: gated.tokens,
        }
      }),
    [config],
  )

  const marginSweep = useMemo(
    () =>
      MARGIN_SWEEP.map((margin) => {
        const next = { ...config, minHopMargin: margin }
        const decomposed = runQuestionDecomposition(next).decomposed
        return {
          margin: Number(margin.toFixed(2)),
          coverage: Number((decomposed.hopCoverage * 100).toFixed(1)),
          recovered: decomposed.answersRecovered,
          retrievals: decomposed.retrievals,
          tokens: decomposed.tokens,
        }
      }),
    [config],
  )

  const update = (patch: Partial<AgenticRetrievalConfig>, note: string) => {
    const next = { ...config, ...patch }
    setConfig(next)
    progress.recordLab('retrieval', note)
  }

  const { baseline, gated } = critique
  const accuracyGap = gated.correctRate - baseline.correctRate
  const tokenGap = gated.tokens - baseline.tokens
  const nullCases = gated.runs.filter((run) => run.nullCase)

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="emerald">Lab H</Badge>
          <Badge tone="neutral">{lab?.runtime}</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{lab?.name ?? 'Agentic Retrieval'}</h1>
        <p className="text-muted max-w-3xl text-sm">{lab?.description}</p>
      </header>

      <Tabs
        idPrefix="agentic-retrieval-tabs"
        ariaLabel="Agentic retrieval measurements"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'gate', label: '1 · The gate and the critic' },
          { id: 'hops', label: '2 · One query per sub-question' },
          { id: 'shapes', label: '3 · Four shapes, one case set' },
        ]}
      />

      {/* -------------------------------------------------------------- */}
      {tab === 'gate' && (
        <TabPanel idPrefix="agentic-retrieval-tabs" id="gate" active className="space-y-4">
          <Callout tone="warning" title="What this section is not">
            <p>
              The corpus, the questions and the passages are hand-authored, and the retriever is the lexical one from the
              chapter pipeline, imported from <code className="rounded px-1" style={CELL_STYLE}>retrieval.ts</code> so
              both halves of Ch. 12 share one corpus. No model is called and no number from the Self-RAG paper appears
              here. What is measured is the <em>shape</em> of the decision: how many lookups a gate saves, how many
              correct answers a critic loses, and what that costs in tokens.
            </p>
          </Callout>

          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <Panel title="The two pipelines" subtitle="Six questions, run twice: once always looking up, once deciding whether to.">
              <Field
                label="Passages per retrieval (k)"
                hint={`Each passage is graded by the critic at ${COST_MODEL.criticTokensPerPassage} tokens and ${COST_MODEL.criticLatencyMsPerPassage} ms. The plain pipeline pays the retrieval but grades nothing.`}
              >
                <Slider
                  label="Passages per retrieval"
                  min={1}
                  max={5}
                  step={1}
                  value={config.k}
                  onChange={(value) => update({ k: value }, `k=${value}`)}
                />
              </Field>
              <Field
                label="Critic threshold"
                hint={`A passage is supported at or above this score, where the score is ${CRITIC_WEIGHTS.rerank} × rerank + ${CRITIC_WEIGHTS.coverage} × coverage + ${CRITIC_WEIGHTS.assertive} × assertive. The critic never sees which passage is the right one.`}
              >
                <Slider
                  label="Critic threshold"
                  min={0}
                  max={1}
                  step={0.05}
                  value={config.criticThreshold}
                  onChange={(value) => update({ criticThreshold: value }, `critic=${value.toFixed(2)}`)}
                />
              </Field>
              <Field
                label="Words needed to open the gate"
                hint={`The gate opens when the question shares at least this many content words with the whole corpus. Below that it answers from the model's own knowledge instead.`}
              >
                <Slider
                  label="Words needed to open the gate"
                  min={0}
                  max={6}
                  step={1}
                  value={config.minCorpusOverlap}
                  onChange={(value) => update({ minCorpusOverlap: value }, `gate=${value}`)}
                />
              </Field>
              <Field
                label="Rewrites allowed"
                hint="When nothing in the window is supported, the agent may reword the query and go round again. A rewrite costs a retrieval and can rescue the run — or it can keep a wrong answer alive."
              >
                <Slider
                  label="Rewrites allowed"
                  min={0}
                  max={3}
                  step={1}
                  value={config.maxRewrites}
                  onChange={(value) => update({ maxRewrites: value }, `rewrites=${value}`)}
                />
              </Field>
              <p className="text-muted mt-2 text-[11px]">
                Costs are arithmetic, not measurements: {COST_MODEL.retrievalOverheadTokens} tokens of framing per
                retrieval, {COST_MODEL.retrievalLatencyMs} ms per round trip, {COST_MODEL.generationLatencyMs} ms per
                generation turn. They are enough to compare the two shapes on relative cost and nothing more.
              </p>
            </Panel>

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Always retrieve: right" value={`${baseline.correct}/${baseline.cases}`} hint={percent(baseline.correctRate) + ' of the six questions'} />
                <StatTile label="Gated: right" value={`${gated.correct}/${gated.cases}`} hint={`${percent(gated.correctRate)} · ${signed(Math.round(accuracyGap * 100))} pt against the plain pipeline`} />
                <StatTile label="Retrievals avoided" value={`${gated.retrievalsAvoided}`} hint={`${gated.retrievalsIssued} issued where ${baseline.retrievalsIssued} were automatic`} />
                <StatTile label="Wrongly skipped" value={`${gated.wronglySkipped}`} hint="Questions the gate closed on that it should have retrieved" />
                <StatTile label="Decoys turned away" value={`${gated.decoysRejected}`} hint={`the critic rejected ${gated.decoysRejected} non-decisive passages`} />
                <StatTile label="Decoys waved through" value={`${gated.decoysAccepted}`} hint={`${baseline.decoysAccepted} in the plain pipeline, which has no critic at all`} />
                <StatTile label="Abstentions" value={`${gated.abstentions}`} hint="The plain pipeline never abstains, so it can never say it does not know" />
                <StatTile label="Tokens per right answer" value={`${gated.tokensPerCorrect}`} hint={`${tokenGap >= 0 ? '+' : '−'}${Math.abs(tokenGap)} tokens in total against ${baseline.tokens}`} />
              </div>

              <Panel title="Every question, both ways" subtitle="The row is a run, not an opinion: each cell is what the engine did with that question at the current settings.">
                <div className="thin-scroll overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse">
                    <caption className="text-muted mb-2 text-left text-[11px]">
                      Measured, not asserted: the verdict columns are the engine's own `correct` flags, and a question
                      the corpus does not own is answered internally rather than retrieved.
                    </caption>
                    <thead>
                      <tr>
                        {['Question', 'Corpus can answer', 'Gate', 'Overlap', 'Retrievals', 'Decisive passage', 'Answered from', 'Action', 'Always retrieve', 'Gated'].map((header) => (
                          <th key={header} scope="col" className={`${cell} text-left uppercase`} style={CELL_STYLE}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gated.runs.map((run) => {
                        const base = baseline.runs.find((item) => item.caseId === run.caseId)
                        const entry = CRITIQUE_CASES.find((item) => item.id === run.caseId)
                        const verdict = verdictOf(run)
                        const baseVerdict = base ? verdictOf(base) : null
                        return (
                          <tr key={run.caseId}>
                            <td className={cell} style={CELL_STYLE}>
                              <strong>{run.title}</strong>
                              <span className="text-muted block text-[11px]">{run.question}</span>
                              {run.nullCase && (
                                <span className="mt-1 block">
                                  <Badge tone="rose">documented failure</Badge>
                                  <span className="text-muted block text-[11px]">{run.lesson}</span>
                                </span>
                              )}
                            </td>
                            <td className={cell} style={CELL_STYLE}>
                              {entry?.needsRetrieval ? <Badge tone="cyan">needs a lookup</Badge> : <Badge tone="neutral">no lookup needed</Badge>}
                            </td>
                            <td className={cell} style={CELL_STYLE}>
                              {run.gateOpened === null ? '—' : run.gateOpened ? <Badge tone="emerald">open</Badge> : <Badge tone="amber">closed</Badge>}
                            </td>
                            <td className={cell} style={CELL_STYLE}>
                              {run.corpusOverlap}
                              <span className="text-muted block text-[11px]">shared content words</span>
                            </td>
                            <td className={cell} style={CELL_STYLE}>
                              {run.retrievals}
                              {run.rewrites > 0 && <span className="text-muted block text-[11px]">{run.rewrites} rewrite{run.rewrites === 1 ? '' : 's'}</span>}
                            </td>
                            <td className={cell} style={CELL_STYLE}>
                              {run.decisiveVerdict === null
                                ? 'never graded'
                                : run.decisiveVerdict === 'supported'
                                  ? <Badge tone="emerald">supported</Badge>
                                  : <Badge tone="rose">rejected</Badge>}
                              <span className="text-muted block text-[11px]">
                                {run.decisiveReachedWindow ? 'reached the window' : 'never reached the window'}
                              </span>
                            </td>
                            <td className={cell} style={CELL_STYLE}>
                              {run.believedPassageId ?? 'nothing'}
                              <span className="text-muted block text-[11px]">
                                {run.believedScore === null ? 'no passage graded' : `score ${run.believedScore.toFixed(3)}`}
                              </span>
                            </td>
                            <td className={cell} style={CELL_STYLE}>
                              {ACTION_LABEL[run.action]}
                              <span className="text-muted block text-[11px]">“{run.answer}”</span>
                            </td>
                            <td className={cell} style={CELL_STYLE}>
                              {baseVerdict && <Badge tone={baseVerdict.tone}>{baseVerdict.label}</Badge>}
                            </td>
                            <td className={cell} style={CELL_STYLE}>
                              <Badge tone={verdict.tone}>{verdict.label}</Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="The gate is a threshold, and thresholds cut both ways" subtitle="The same six questions at every word-count threshold, with everything else held where the sliders have it.">
                <ChartFigure
                  title="Retrievals issued, avoided and correct answers against the gate threshold"
                  description={`Raising the words required to open the gate from 0 to ${OVERLAP_SWEEP[OVERLAP_SWEEP.length - 1]} saves retrievals and then starts closing the gate on questions the corpus could have answered. At the current setting of ${config.minCorpusOverlap} the engine issues ${gated.retrievalsIssued} retrievals and skips ${gated.wronglySkipped} it should not have.`}
                  columns={['threshold', 'issued', 'avoided', 'wrongly skipped', 'correct', 'tokens']}
                  rows={overlapSweep.map((row) => [row.threshold, row.issued, row.avoided, row.wronglySkipped, row.correct, row.tokens])}
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={overlapSweep}>
                      <CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 3" />
                      <XAxis dataKey="threshold" stroke="var(--text-muted)" fontSize={11} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} />
                      <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="issued" name="retrievals issued" stroke="#35e6ff" strokeWidth={2} />
                      <Line type="monotone" dataKey="wronglySkipped" name="wrongly skipped" stroke="#fb7185" strokeWidth={2} />
                      <Line type="monotone" dataKey="correct" name="right answers" stroke="#34d399" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartFigure>
                <p className="text-muted mt-2 text-[11px]">
                  Read the rose line before the cyan one. A gate that saves four retrievals and closes on two questions
                  the corpus could answer has not become more careful; it has become wrong in a new direction, and the
                  only reason the plain pipeline looks reckless on those two questions is that it spent tokens proving it
                  did not know.
                </p>
              </Panel>
            </div>
          </div>

          <Callout tone="insight" title={`The two documented failures of the critic, at the current threshold of ${config.criticThreshold.toFixed(2)}`}>
            <p>
              {nullCases.length === 0
                ? 'At this threshold neither of the cases built to fail is firing: the critic is agreeing with the answer key. Move the threshold and one of them will start to disagree — that is the point of the case set.'
                : `${nullCases.length} case${nullCases.length === 1 ? '' : 's'} built to fail are firing. ${nullCases
                    .map((run) => `“${run.title}”: ${run.lesson}`)
                    .join(' ')} A critique model that is right about the passage and wrong about the question still answers, because the critic grades relevance and nothing else.`}
            </p>
          </Callout>
        </TabPanel>
      )}

      {/* -------------------------------------------------------------- */}
      {tab === 'hops' && (
        <TabPanel idPrefix="agentic-retrieval-tabs" id="hops" active className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <Panel title="The two arms" subtitle="One flat query for the whole question, against one query per sub-question.">
              <Field
                label="Facts in the single-shot window"
                hint="How many records the flat pipeline can put in one window. This is the generous reading of the §12.2 pipeline: it is allowed every fact it can rank, not only the top-k."
              >
                <Slider
                  label="Facts in the single-shot window"
                  min={1}
                  max={5}
                  step={1}
                  value={config.factWindow}
                  onChange={(value) => update({ factWindow: value }, `window=${value}`)}
                />
              </Field>
              <Field
                label="Margin required to trust a hop"
                hint="A hop is trusted only when its best fact beats the runner-up by this much. Below it the hop abstains rather than feeding an intermediate answer forward."
              >
                <Slider
                  label="Margin required to trust a hop"
                  min={0}
                  max={0.4}
                  step={0.02}
                  value={config.minHopMargin}
                  onChange={(value) => update({ minHopMargin: value }, `margin=${value.toFixed(2)}`)}
                />
              </Field>
              <Card className="surface-2 mt-3 p-2">
                <p className="text-muted text-[11px]">
                  Both arms read the same store of {FACT_BY_ID.size} records, of which{' '}
                  {Array.from(FACT_BY_ID.values()).filter((fact) => fact.stale).length} are superseded and still filed.
                  Decomposition queries that store hop by hop; the flat pipeline queries it once with the whole
                  sentence.
                </p>
              </Card>
            </Panel>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Flat: hop coverage" value={percent(decomposition.singleShot.hopCoverage)} hint={`${decomposition.singleShot.runs.reduce((s, r) => s + r.hopsCovered, 0)} of ${decomposition.singleShot.hopsRequired} hops answered with the right fact`} />
              <StatTile label="Decomposed: hop coverage" value={percent(decomposition.decomposed.hopCoverage)} hint={`${decomposition.decomposed.runs.reduce((s, r) => s + r.hopsCovered, 0)} of ${decomposition.decomposed.hopsRequired} hops`} />
              <StatTile label="Flat: answers recovered" value={`${decomposition.singleShot.answersRecovered}/${decomposition.singleShot.questions}`} hint={percent(decomposition.singleShot.recoveryRate)} />
              <StatTile label="Decomposed: answers recovered" value={`${decomposition.decomposed.answersRecovered}/${decomposition.decomposed.questions}`} hint={`${decomposition.decomposed.retrievals} retrievals, ${decomposition.decomposed.tokens} tokens against ${decomposition.singleShot.retrievals} and ${decomposition.singleShot.tokens}`} />
            </div>
          </div>

          <Panel title="Hop by hop" subtitle="Each hop shows the query the agent actually issued, the entity it was built from and the entity the question called for. Where those two differ, a wrong intermediate answer went forward.">
            <div className="space-y-4">
              {decomposition.decomposed.runs.map((run) => {
                const flat = decomposition.singleShot.runs.find((item) => item.questionId === run.questionId)
                return (
                  <div key={run.questionId} className="surface-2 rounded-lg border p-3" style={CELL_STYLE}>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <strong>{run.title}</strong>
                      <span className="text-muted text-[11px]">{run.question}</span>
                    </div>
                    <div className="thin-scroll mt-2 overflow-x-auto">
                      <table className="w-full min-w-[760px] border-collapse">
                        <thead>
                          <tr>
                            {['Hop', 'Query issued', 'Subject used', 'Subject wanted', 'Fact chosen', 'Margin', 'Trusted', 'Right?'].map((header) => (
                              <th key={header} scope="col" className={`${cell} text-left uppercase`} style={CELL_STYLE}>
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {run.hops.map((hop) => {
                            const mismatch = hop.subjectUsed !== hop.subjectWanted
                            return (
                              <tr key={hop.index}>
                                <td className={cell} style={CELL_STYLE}>{hop.index + 1}</td>
                                <td className={cell} style={CELL_STYLE}>
                                  <code className="rounded px-1 text-[11px]" style={CELL_STYLE}>{hop.query}</code>
                                </td>
                                <td className={cell} style={CELL_STYLE}>
                                  {hop.subjectUsed}
                                  {mismatch && <span className="text-muted block text-[11px]">carried forward from the hop before</span>}
                                </td>
                                <td className={cell} style={CELL_STYLE}>
                                  {hop.subjectWanted}
                                  {mismatch && <Badge tone="rose">wrong subject</Badge>}
                                </td>
                                <td className={cell} style={CELL_STYLE}>
                                  {hop.chosen ? `${hop.chosen.object}` : 'nothing'}
                                  <span className="text-muted block text-[11px]">{hop.chosen?.id ?? 'no fact cleared the window'}{hop.chosen?.stale ? ' · superseded record' : ''}</span>
                                </td>
                                <td className={cell} style={CELL_STYLE}>
                                  {hop.margin.toFixed(3)}
                                  <span className="text-muted block text-[11px]">needs {config.minHopMargin.toFixed(2)}</span>
                                </td>
                                <td className={cell} style={CELL_STYLE}>
                                  {hop.trusted ? <Badge tone="emerald">trusted</Badge> : <Badge tone="amber">held back</Badge>}
                                </td>
                                <td className={cell} style={CELL_STYLE}>
                                  {hop.correct ? <Badge tone="emerald">right fact</Badge> : <Badge tone="rose">wrong fact</Badge>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="text-muted mt-2 flex flex-wrap gap-3 text-[11px]">
                      <span>Decomposed answers “{run.answer}” — {run.correct ? 'right' : 'wrong'}.</span>
                      {flat && <span>Flat answers “{flat.answer}” — {flat.correct ? 'right' : 'wrong'} — with {flat.retrievals} retrieval against {run.retrievals}.</span>}
                      {run.propagated && (
                        <span>
                          Propagation fired at hop {run.propagated.index + 1}: the subject carried forward was “
                          {run.propagated.subjectUsed}” where the question called for “{run.propagated.subjectWanted}”.
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="The margin sweep" subtitle="Trust every hop, or hold back on a thin lead.">
              <ChartFigure
                title="Hop coverage and recovered answers against the trust margin"
                description={`Across the margins ${MARGIN_SWEEP.map((m) => m.toFixed(2)).join(', ')}: hop coverage in per cent, answers recovered, retrievals and tokens.`}
                columns={['margin', 'coverage %', 'recovered', 'retrievals', 'tokens']}
                rows={marginSweep.map((row) => [row.margin.toFixed(2), row.coverage, row.recovered, row.retrievals, row.tokens])}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={marginSweep}>
                    <CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 3" />
                    <XAxis dataKey="margin" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="coverage" name="hop coverage %" stroke="#35e6ff" strokeWidth={2} />
                    <Line type="monotone" dataKey="recovered" name="answers recovered" stroke="#34d399" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartFigure>
              <p className="text-muted mt-2 text-[11px]">
                Coverage is not monotone in trust, and this engine says why rather than smoothing it: a hop whose lead is
                zero is a hop that guessed, so raising the margin from 0 removes the guessed hops — and where a guess
                happened to be right, that is exactly what is lost.
              </p>
            </Panel>

            <Panel title="What decomposition buys, and what it costs" subtitle="Read the two columns as one trade, not as a winner.">
              <ul className="text-muted space-y-2 text-xs">
                <li>
                  <strong>Coverage.</strong> The flat arm reaches {percent(decomposition.singleShot.recall)} of the facts
                  each question needs; the decomposed arm{' '}
                  {percent(decomposition.decomposed.runs.reduce((s, r) => s + r.recall, 0) / Math.max(1, decomposition.decomposed.questions))}.
                  A two-hop question cannot be expressed as one query, so the bridge fact is invisible to the flat arm.
                </li>
                <li>
                  <strong>Propagation.</strong>{' '}
                  {decomposition.decomposed.runs.filter((run) => run.propagated).length} of{' '}
                  {decomposition.decomposed.questions} questions show a wrong intermediate answer fed forward, and the
                  hop where it fired is named above. Decomposition does not reduce that risk; it creates the channel.
                </li>
                <li>
                  <strong>Cost.</strong> {decomposition.decomposed.retrievals} retrievals against{' '}
                  {decomposition.singleShot.retrievals}, and {decomposition.decomposed.tokens} tokens against{' '}
                  {decomposition.singleShot.tokens}. On the four-hop question the flat arm retrieves once and answers
                  from whatever it found.
                </li>
                <li>
                  <strong>The stale record.</strong> The store keeps a superseded supplier fact, so the first hop of the
                  delay question has two near-identical candidates and its margin is what decides. That is the honest
                  version of “retrieval quality”: the same query, the same store, a different amount of trust.
                </li>
              </ul>
            </Panel>
          </div>
        </TabPanel>
      )}

      {/* -------------------------------------------------------------- */}
      {tab === 'shapes' && (
        <TabPanel idPrefix="agentic-retrieval-tabs" id="shapes" active className="space-y-4">
          <Panel
            title="The survey's taxonomy, run as four programs"
            subtitle={`All four shapes read the same ${PIPELINE_CASES.length} cases with the same ${COST_MODEL.retrievalOverheadTokens}-token framing charge, so the columns are comparable.`}
          >
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse">
                <caption className="text-muted mb-2 text-left text-[11px]">
                  Measured on this case set only. The case set is synthetic and exists to be a measuring instrument: the
                  “right answers” column says nothing about a deployed retrieval system, and no figure from Chen et al.
                  2025 is reproduced here.
                </caption>
                <thead>
                  <tr>
                    {['Shape', 'Right answers', 'Recall', 'Retrievals', 'Tokens', 'Latency', 'Abstentions', 'Answers where the store had none'].map((header) => (
                      <th key={header} scope="col" className={`${cell} text-left uppercase`} style={CELL_STYLE}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pipelines.rows.map((row) => (
                    <tr key={row.shape}>
                      <td className={cell} style={CELL_STYLE}>
                        <strong>{row.label}</strong>
                        <span className="text-muted block text-[11px]">{row.description}</span>
                      </td>
                      <td className={cell} style={CELL_STYLE}>
                        {row.correct}/{row.cases}
                        <span className="text-muted block text-[11px]">{percent(row.correctRate)}</span>
                      </td>
                      <td className={cell} style={CELL_STYLE}>
                        {row.recall === null ? 'nothing to recall' : percent(row.recall)}
                      </td>
                      <td className={cell} style={CELL_STYLE}>{row.retrievals}</td>
                      <td className={cell} style={CELL_STYLE}>{row.tokens}</td>
                      <td className={cell} style={CELL_STYLE}>{row.latencyMs} ms</td>
                      <td className={cell} style={CELL_STYLE}>
                        {row.abstentions === 0 ? (
                          <Badge tone="rose">never</Badge>
                        ) : (
                          <Badge tone="emerald">{row.abstentions} times</Badge>
                        )}
                      </td>
                      <td className={cell} style={CELL_STYLE}>
                        {row.hallucinations}
                        <span className="text-muted block text-[11px]">
                          {percent(row.hallucinations / Math.max(1, row.cases))} of the cases
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="The same trade, drawn" subtitle="Right answers against answers given where the store had none.">
              <ChartFigure
                title="Correct answers and hallucinated answers per pipeline shape"
                description="Bars, per shape: how many of the nine cases the shape answered correctly, and how many it answered with something the store did not support."
                columns={['shape', 'right', 'unsupported']}
                rows={pipelines.rows.map((row) => [row.label, row.correct, row.hallucinations])}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={pipelines.rows.map((row) => ({ label: row.shape, right: row.correct, unsupported: row.hallucinations }))}>
                    <CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="right" name="right answers" fill="#34d399" />
                    <Bar dataKey="unsupported" name="answered with no support" fill="#fb7185" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFigure>
            </Panel>

            <Panel title="Why the cheapest shape is not the careful one" subtitle="Two rows worth reading closely.">
              <ul className="text-muted space-y-2 text-xs">
                {(['router', 'adaptive-critic'] as const).map((shape) => {
                  const row = pipelines.rows.find((item) => item.shape === shape)
                  if (!row) return null
                  return (
                    <li key={shape}>
                      <strong>{row.label}</strong> — {row.correct}/{row.cases} right, {row.retrievals} retrievals,{' '}
                      {row.tokens} tokens, {row.abstentions} abstentions and {row.hallucinations} answers the store did
                      not support.{' '}
                      {shape === 'router'
                        ? 'A router is a classifier: it decides once, up front, and an up-front decision cannot be revised when the passage turns out to be the wrong one.'
                        : 'Adaptive retrieval is the only shape here that can say it does not know, which is why its unsupported column is the smallest.'}
                    </li>
                  )
                })}
                <li>
                  <strong>The multi-hop column moves the ranking.</strong> Of the{' '}
                  {PIPELINE_CASES.filter((entry) => entry.kind === 'multi-hop').length} chain cases, the router sends{' '}
                  {pipelines.rows
                    .filter((row) => row.shape === 'router')
                    .flatMap((row) => row.runs)
                    .filter((run) => run.kind === 'multi-hop' && run.retrievals <= 1).length}{' '}
                  with a single retrieval — the chain that needs three is routed as a lookup. That is not a bug in this
                  engine: it is what the hand-authored routing table believes, and the survey's point is that a router
                  and a decomposer are different decisions, not two spellings of one.
                </li>
                <li>
                  <strong>Decomposition is the expensive one.</strong>{' '}
                  {(() => {
                    const decomposed = pipelines.rows.find((row: PipelineRow) => row.shape === 'decompose-then-retrieve')
                    const flat = pipelines.rows.find((row: PipelineRow) => row.shape === 'single-shot')
                    if (!decomposed || !flat) return 'not measured'
                    return `${decomposed.retrievals} retrievals and ${decomposed.latencyMs} ms against ${flat.retrievals} and ${flat.latencyMs} ms — ${percent(
                      decomposed.latencyMs / Math.max(1, flat.latencyMs) - 1,
                    )} more latency for ${signed(decomposed.correct - flat.correct)} answers and ${signed(
                      decomposed.hallucinations - flat.hallucinations,
                    )} unsupported ones.`
                  })()}
                </li>
              </ul>
            </Panel>
          </div>
        </TabPanel>
      )}

      <Panel title="What to notice" subtitle="Three claims about agentic retrieval, each of which is a number on this screen rather than a phrase.">
        <ul className="text-muted space-y-2 text-xs">
          <li>
            Deciding <em>whether</em> to look something up is a decision that can be wrong in both directions. At the
            current gate the engine skips {gated.retrievalsAvoided} retrievals it did not need and{' '}
            {gated.wronglySkipped} it did. Push the threshold up and the second number moves first.
          </li>
          <li>
            A critic is not an oracle. It grades relevance from {CRITIC_WEIGHTS.rerank} × the reranker's score,{' '}
            {CRITIC_WEIGHTS.coverage} × how much of the question the passage contains and {CRITIC_WEIGHTS.assertive} ×
            whether the passage reads as an assertion — and it never sees the answer key. That is why{' '}
            {gated.decoysAccepted} decoys are still waved through at this threshold, and why the two cases built to fail
            are in the table rather than hidden by it.
          </li>
          <li>
            Decomposition buys coverage and creates a channel for error.{' '}
            {decomposition.decomposed.runs.filter((run) => run.propagated).length} questions show the wrong subject
            carried into a later hop, and every one of them is a question the flat arm could not have got wrong that
            way.
          </li>
          <li>
            The four shapes are comparable, not ranked. The survey's taxonomy becomes four programs over one case set:
            same questions, same budget model, and a column for answering when the store had nothing.
          </li>
        </ul>
      </Panel>

      <LabReflection labId="retrieval" />
    </div>
  )
}
