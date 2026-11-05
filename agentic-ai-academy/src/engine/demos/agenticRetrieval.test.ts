import { describe, expect, it } from 'vitest'
import { RETRIEVAL_CASE_BY_ID, type RetrievalCase } from './retrieval'
import {
  CRITIQUE_CASES,
  DEFAULT_AGENTIC_CONFIG,
  MULTIHOP_QUESTIONS,
  PIPELINE_CASES,
  PIPELINE_SHAPES,
  comparePipelines,
  corpusOverlap,
  criticFeatures,
  criticScore,
  estimateTokens,
  runAdaptiveRetrieval,
  runQuestionDecomposition,
  type AgenticRetrievalConfig,
  type CritiqueCase,
  type PipelineShape,
} from './agenticRetrieval'

const cfg: AgenticRetrievalConfig = DEFAULT_AGENTIC_CONFIG
const critique = runAdaptiveRetrieval(cfg)
const decomp = runQuestionDecomposition(cfg)

const caseById = (id: string): CritiqueCase =>
  CRITIQUE_CASES.find((entry) => entry.id === id) as CritiqueCase
const gatedRun = (id: string) => {
  const run = critique.gated.runs.find((entry) => entry.caseId === id)
  if (!run) throw new Error(`no gated run for ${id}`)
  return run
}
const baseRun = (id: string) => {
  const run = critique.baseline.runs.find((entry) => entry.caseId === id)
  if (!run) throw new Error(`no baseline run for ${id}`)
  return run
}
const singleRun = (id: string) => {
  const run = decomp.singleShot.runs.find((entry) => entry.questionId === id)
  if (!run) throw new Error(`no single-shot run for ${id}`)
  return run
}
const chainRun = (id: string) => {
  const run = decomp.decomposed.runs.find((entry) => entry.questionId === id)
  if (!run) throw new Error(`no decomposed run for ${id}`)
  return run
}
const rowFor = (shape: PipelineShape) => {
  const row = comparePipelines(cfg).rows.find((entry) => entry.shape === shape)
  if (!row) throw new Error(`no row for ${shape}`)
  return row
}

describe('adaptive retrieval with critique', () => {
  it('Ch. 12 §12.4: adaptive retrieval with critique.', () => {
    // Measured on the six hand-authored questions, at the default config
    // (k = 2, criticThreshold = 0.45, minCorpusOverlap = 2, one rewrite).
    // The plain pipeline retrieves every time and is right once.
    expect(critique.baseline.cases).toBe(6)
    expect(critique.baseline.retrievalsIssued).toBe(6)
    expect(critique.baseline.correct).toBe(1)
    expect(critique.baseline.abstentions).toBe(0)
    // It has no critic, so it turns away nothing: all 11 decoy passages that
    // reached a window were waved through, and it answered from them.
    expect(critique.baseline.decoysRejected).toBe(0)
    expect(critique.baseline.decoysAccepted).toBe(11)

    // The gate-and-critic policy closes the gate on the two questions the corpus
    // cannot answer and never needed, and pays for four rewrites on the rest —
    // so it issues *more* retrievals while avoiding two of six.
    expect(critique.gated.retrievalsAvoided).toBe(2)
    expect(critique.gated.wronglySkipped).toBe(0)
    expect(critique.gated.rewrites).toBe(4)
    expect(critique.gated.retrievalsIssued).toBe(8)
    // It rejects 9 of the 13 decoy passages it grades and is right 4 of 6.
    expect(critique.gated.decoysRejected).toBe(9)
    expect(critique.gated.decoysAccepted).toBe(4)
    expect(critique.gated.correct).toBe(4)
    expect(critique.gated.correct).toBeGreaterThan(critique.baseline.correct)
    // The cost of the extra passes, in the currency the chapter spends: tokens
    // per correct answer fall by more than half even though total tokens rise.
    expect(critique.gated.tokens).toBeGreaterThan(critique.baseline.tokens)
    expect(critique.gated.tokensPerCorrect).toBe(255)
    expect(critique.baseline.tokensPerCorrect).toBe(526)
    expect(critique.gated.tokensPerCorrect).toBeLessThan(critique.baseline.tokensPerCorrect)
  })

  it('gates on the questions the corpus has no words for', () => {
    // The gate is a lexical overlap test and these are the two it should fail to
    // open on: one shared content word, and zero.
    expect(corpusOverlap(caseById('c-what-is-warranty').question, caseById('c-what-is-warranty'))).toBe(1)
    expect(corpusOverlap(caseById('c-what-is-rag').question, caseById('c-what-is-rag'))).toBe(0)
    const skipped = critique.gated.runs.filter((run) => run.gateOpened === false)
    expect(skipped.map((run) => run.caseId).sort()).toEqual(['c-what-is-rag', 'c-what-is-warranty'])
    for (const run of skipped) {
      expect(run.retrievals).toBe(0)
      expect(run.action).toBe('answer-internally')
      expect(run.correct).toBe(true)
    }
    // Every question the corpus does own opens the gate, decoy or not.
    for (const run of critique.gated.runs.filter((entry) => entry.gateOpened)) {
      expect(run.retrievals).toBeGreaterThanOrEqual(1)
    }
    expect(gatedRun('c-return-window').retrievals).toBe(2)
  })

  it('answers from the passage its own critic believed, never from the key', () => {
    // The decision rule, checked as a rule rather than as an outcome: nothing is
    // correct unless the passage the agent answered from is the one that decides
    // the answer, and an abstention is only ever "the critic believed none".
    for (const run of critique.gated.runs) {
      const entry = caseById(run.caseId)
      if (run.correct && entry.needsRetrieval) {
        expect(run.believedPassageId).toBe(entry.decisivePassageId)
      }
      if (entry.needsRetrieval) continue
      // A question the corpus does not own can only be got right by staying out
      // of it — and the two that were got right are the two the gate closed on.
      expect(run.correct).toBe(run.gateOpened === false)
    }
    for (const run of critique.gated.runs.filter((entry) => entry.gateOpened)) {
      expect(run.abstained).toBe(run.believedPassageId === null)
      if (run.believedPassageId !== null) {
        expect(run.believedScore).toBeGreaterThanOrEqual(cfg.criticThreshold)
      } else {
        expect(Math.max(0, ...run.graded.map((item) => item.score))).toBeLessThan(cfg.criticThreshold)
      }
    }
    // The rewrite is re-scored against the rewritten wording, not against the
    // original ranking: the decoy that led the first window is not what decides.
    const rewrite = gatedRun('c-return-window')
    expect(rewrite.rewrites).toBe(1)
    expect(rewrite.windowOf).toContain('p-returns')
    expect(rewrite.believedPassageId).toBe('p-returns')
    expect(rewrite.action).toBe('answer-after-rewrite')
  })

  it('records the case where the critic is wrong and says so', () => {
    // Honest null 1: the decisive passage is rejected, the rewrite pulls the
    // passage that was a distractor in the corpus's own question, and the agent
    // is confidently wrong where the cheaper pipeline was right.
    const meeting = gatedRun('c-meeting-order')
    expect(meeting.nullCase).toBe(true)
    expect(meeting.decisiveVerdict).toBe('rejected')
    expect(meeting.believedPassageId).toBe('n-date-3')
    expect(meeting.correct).toBe(false)
    expect(baseRun('c-meeting-order').correct).toBe(true)
    expect(meeting.lesson).toMatch(/cross-encoder/i)

    // Honest null 2: support is not responsiveness. The critic is right that the
    // passage is sound and wrong that it answers a "why" question.
    const reason = gatedRun('c-refund-reason')
    expect(reason.nullCase).toBe(true)
    expect(reason.believedPassageId).toBe('p-returns')
    expect(reason.believedScore as number).toBeGreaterThan(cfg.criticThreshold)
    expect(reason.correct).toBe(false)
    expect(reason.lesson).toMatch(/responsiveness/i)

    // Two nulls, and exactly two runs that are confidently wrong under the critic.
    expect(critique.gated.runs.filter((run) => run.nullCase).length).toBe(2)
    expect(critique.gated.wrongAnswers).toBe(2)
  })

  it('starts abstaining only above the threshold in force', () => {
    const sweep = [0.45, 0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95].map((threshold) => {
      const summary = runAdaptiveRetrieval({ ...cfg, criticThreshold: threshold }).gated
      return { threshold, abstentions: summary.abstentions, correct: summary.correct, retrievals: summary.retrievalsIssued }
    })
    expect(sweep[0].abstentions).toBe(0)
    for (let i = 1; i < sweep.length; i += 1) {
      expect(sweep[i].abstentions).toBeGreaterThanOrEqual(sweep[i - 1].abstentions)
    }
    // The refusals arrive without extra retrievals, and from 0.65 upward every
    // extra refusal costs a correct answer rather than buying one.
    for (const point of sweep) expect(point.retrievals).toBe(8)
    const fromTop = sweep.filter((point) => point.threshold >= 0.65)
    expect(fromTop[fromTop.length - 1].correct).toBe(2)
    expect(fromTop[0].correct).toBe(4)
    expect(fromTop[fromTop.length - 1].abstentions).toBe(3)
  })

  it('inherits its errors from the cross-encoder figures it is given', () => {
    // The critic's features are hand-authored figures the borrowed corpus already
    // carries, and the null case is what that inheritance costs.
    const notes = RETRIEVAL_CASE_BY_ID.get('meeting-notes') as RetrievalCase
    const agenda = notes.passages.find((passage) => passage.id === 'n-agenda')
    if (!agenda) throw new Error('the borrowed corpus changed')
    // In that corpus this passage is the distractor, and it is filed as one: a low
    // cross-encoder reading and no relevance flag.
    expect(agenda.relevant).toBe(false)
    expect(agenda.rerank).toBeLessThan(0.5)
    // Read against *this* file's question it covers far more of the wording than
    // it does of the corpus's own question — and it is still rejected.
    const here = criticFeatures(caseById('c-meeting-order').question, agenda)
    const there = criticFeatures(notes.question, agenda)
    expect(here.coverage).toBeGreaterThan(there.coverage)
    expect(criticScore(here)).toBeLessThan(cfg.criticThreshold)
    // What the critic believes instead is the passage the *other* question was
    // built around: the rerank figure it leans on was authored for that one.
    const relevantThere = notes.passages.filter((passage) => passage.relevant).map((passage) => passage.id)
    expect(relevantThere).toEqual(['n-date-3'])
    expect(gatedRun('c-meeting-order').believedPassageId).toBe(relevantThere[0])
    expect(gatedRun('c-meeting-order').decisiveReachedWindow).toBe(true)
  })
})

describe('question decomposition for multi-hop retrieval', () => {
  it('Ch. 12 §12.4: question decomposition for multi-hop retrieval.', () => {
    // Ten hops across four questions, one hand-authored triple store.
    expect(decomp.singleShot.hopsRequired).toBe(10)
    expect(decomp.decomposed.hopsRequired).toBe(10)
    // Decomposition's gain: a window of one fact per hop has no middle, so more
    // of the required hops come back with the fact the question needed.
    expect(decomp.decomposed.hopCoverage).toBeGreaterThan(decomp.singleShot.hopCoverage)
    expect(decomp.singleShot.hopCoverage).toBe(0.4)
    expect(decomp.decomposed.hopCoverage).toBe(0.6)
    expect(decomp.decomposed.answersRecovered).toBe(2)
    expect(decomp.singleShot.answersRecovered).toBe(1)
    // Decomposition's cost, in the same breath: 10 retrievals and 1600 ms against
    // 4 and 640, and a *lower* recall, because a wrong hop reports a wrong entity
    // instead of merely missing one.
    expect(decomp.decomposed.retrievals).toBe(10)
    expect(decomp.singleShot.retrievals).toBe(4)
    expect(decomp.decomposed.latencyMs).toBe(1600)
    expect(decomp.singleShot.latencyMs).toBe(640)
    expect(decomp.decomposed.tokens).toBe(429)
    expect(decomp.singleShot.tokens).toBe(284)
    expect(decomp.decomposed.recall).toBeLessThan(decomp.singleShot.recall)
    // The four-hop question is the one a flat query cannot reach at all.
    expect(chainRun('mh-depot-manager').correct).toBe(true)
    expect(chainRun('mh-depot-manager').hopsCovered).toBe(4)
    expect(singleRun('mh-depot-manager').correct).toBe(false)
    expect(singleRun('mh-depot-manager').hopsCovered).toBe(2)
    // And the composition gap is visible in the answer, not just the score: the
    // flat query stops at the bridge fact and names the part when asked for the
    // company that supplies it.
    expect(singleRun('mh-invoice-supplier').answer).toBe('the 12V sensor module')
    expect(singleRun('mh-invoice-supplier').factsUsed).toBe(1)
  })

  it('pays for a wrong intermediate answer on the next hop', () => {
    // The store keeps a superseded supplier record next to the live one, and the
    // two are one shared word apart, so the hop is a coin toss: margin 0.000.
    const delay = chainRun('mh-sensor-delay')
    expect(delay.hops[0].margin).toBeLessThan(cfg.minHopMargin)
    expect(delay.hops[0].trusted).toBe(false)
    expect(delay.hops[0].correct).toBe(false)
    expect(delay.hops[0].chosen?.id).toBe('f-sensor-supplier-stale')
    // The wrong entity is fed forward. Hops 2 and 3 then do their own jobs
    // faithfully — they answer the question they were handed — and the chain
    // still lands on the wrong depot's April figure.
    expect(delay.hops[1].subjectUsed).toBe('Halvorsen Components')
    expect(delay.hops[1].subjectWanted).toBe('Nordwind Components')
    expect(delay.hops[1].trusted).toBe(true)
    expect(delay.hops[1].correct).toBe(false)
    expect(delay.hops[2].subjectUsed).toBe('the Antwerp depot')
    expect(delay.hops[2].trusted).toBe(true)
    expect(delay.propagated).not.toBe(null)
    expect(delay.hopsCovered).toBe(0)
    expect(delay.answer).toBe('two days')
    expect(delay.correct).toBe(false)
    // It answers, though. The propagation is not a refusal, which is the point.
    expect(
      rowFor('decompose-then-retrieve').runs.find((run) => run.caseId === 'pc-delay')?.abstained,
    ).toBe(false)
  })

  it('reports the propagation both ways, as numbers', () => {
    // Trust every hop however close the call: decomposition recovers all four
    // questions and every hop, which is the upper bound of the gain.
    const trusting = runQuestionDecomposition({ ...cfg, minHopMargin: 0 })
    expect(trusting.decomposed.answersRecovered).toBe(4)
    expect(trusting.decomposed.hopCoverage).toBe(1)
    expect(trusting.singleShot.answersRecovered).toBe(1)
    // Distrust a close call from 0.02 upward: two recovered answers are lost, and
    // the ones lost are exactly the two that run over the stale record.
    const distrustful = runQuestionDecomposition({ ...cfg, minHopMargin: 0.02 })
    expect(distrustful.decomposed.answersRecovered).toBe(2)
    expect(distrustful.decomposed.hopsRequired).toBe(trusting.decomposed.hopsRequired)
    expect(trusting.decomposed.answersRecovered - distrustful.decomposed.answersRecovered).toBe(2)
    // The flat pipeline is untouched by the knob: it never reads an intermediate
    // answer, so it can never be hurt by one.
    expect(distrustful.singleShot.answersRecovered).toBe(trusting.singleShot.answersRecovered)
    // Widening the single-shot window buys it the four-hop question at the cost of
    // crowding: two answers recovered on one retrieval, still below decomposition.
    const wide = runQuestionDecomposition({ ...cfg, factWindow: 4 })
    expect(wide.singleShot.answersRecovered).toBe(2)
    expect(wide.singleShot.retrievals).toBe(4)
    expect(wide.singleShot.recall).toBeGreaterThan(decomp.singleShot.recall)
    expect(wide.decomposed.answersRecovered).toBe(2)
  })

  it('never reads a hop ahead of the answer it has', () => {
    // Each query is built from the entity the previous hop returned, so a run's
    // wording is evidence about the order it worked in.
    for (const question of MULTIHOP_QUESTIONS) {
      const run = chainRun(question.id)
      expect(run.hops.length).toBe(question.hops.length)
      run.hops.forEach((hop, index) => {
        if (index === 0) expect(hop.subjectUsed).toBe(question.hops[0].subject.value)
        else expect(hop.subjectUsed).toBe(run.hops[index - 1].chosen?.object)
        expect(hop.query).toContain(hop.subjectUsed)
        expect(hop.retrievals).toBe(1)
      })
      // The chain is only right when every hop was.
      expect(run.correct).toBe(run.hops.every((hop) => hop.correct))
    }
  })
})

describe('agentic RAG as four pipeline shapes', () => {
  it('Ch. 12 §12.6: the survey that maps agentic RAG onto the single-shot pipeline the chapter teaches.', () => {
    const comparison = comparePipelines(cfg)
    expect(comparison.rows.map((row) => row.shape)).toEqual(PIPELINE_SHAPES.map((shape) => shape.value))
    const [single, router, adaptive, decomposed] = comparison.rows
    // Measured on the same nine questions, the same retriever, the same critic and
    // the same budget model — which is what makes the columns comparable.
    for (const row of comparison.rows) {
      expect(row.cases).toBe(PIPELINE_CASES.length)
      expect(row.cases).toBe(9)
    }
    // Recall: the critic shape reads the most of what it needed; decomposition
    // reads less than it retrieved because a wrong hop reports a wrong entity.
    expect(adaptive.recall as number).toBeGreaterThan(single.recall as number)
    expect((adaptive.recall as number) > (decomposed.recall as number)).toBe(true)
    expect(router.recall).toBe(single.recall)
    // Correct answers: the two shapes that decide *whether* to look up beat the one
    // that always looks up, which gets exactly one of nine.
    expect(single.correct).toBe(1)
    expect(router.correct).toBe(4)
    expect(adaptive.correct).toBe(4)
    expect(decomposed.correct).toBe(3)
    // Money: the router spends least, the critic spends most and buys the only
    // refusals, decomposition is the slowest by a distance.
    expect(router.retrievals).toBe(6)
    expect(single.retrievals).toBe(9)
    expect(adaptive.retrievals).toBe(11)
    expect(decomposed.retrievals).toBe(15)
    expect(router.tokens).toBe(640)
    expect(single.tokens).toBe(753)
    expect(decomposed.tokens).toBe(999)
    expect(adaptive.tokens).toBe(1249)
    expect(decomposed.latencyMs).toBe(2400)
    expect(adaptive.latencyMs).toBe(1630)
    // The column the survey is really about: answering when there was no answer.
    expect(single.hallucinations).toBe(8)
    expect(adaptive.hallucinations).toBe(2)
    expect(adaptive.abstentions).toBe(3)
    expect(router.abstentions).toBe(0)
    expect(adaptive.hallucinations < single.hallucinations).toBe(true)
  })

  it('gives each shape its own wins and losses on the shared case set', () => {
    const byShape = Object.fromEntries(comparePipelines(cfg).rows.map((row) => [row.shape, row]))
    const outcome = (shape: PipelineShape, caseId: string) =>
      (byShape[shape] as ReturnType<typeof rowFor>).runs.find((run) => run.caseId === caseId)
    // Only decomposition can chain, so only decomposition answers the four-hop
    // question; the critic abstains on it rather than guessing.
    expect(outcome('decompose-then-retrieve', 'pc-manager')?.correct).toBe(true)
    for (const shape of ['single-shot', 'router', 'adaptive-critic'] as const) {
      expect(outcome(shape, 'pc-manager')?.correct).toBe(false)
    }
    // The router's win is entirely on questions the corpus does not own, and it is
    // blind to the chain it mis-routes.
    expect(outcome('router', 'pc-rag')?.retrievals).toBe(0)
    expect(outcome('router', 'pc-rag')?.correct).toBe(true)
    expect(outcome('single-shot', 'pc-rag')?.correct).toBe(false)
    expect(outcome('router', 'pc-delay')?.outcome).toMatch(/routed to the lookup branch/)
    // The critic's win is the decoy question, at twice the retrievals.
    expect(outcome('adaptive-critic', 'pc-returns')?.correct).toBe(true)
    expect(outcome('adaptive-critic', 'pc-returns')?.retrievals).toBe(2)
    expect(outcome('single-shot', 'pc-returns')?.correct).toBe(false)
    // The chapter's null survives the trip into this table: the plain pipeline is
    // right about the meeting order and the critic is wrong.
    expect(outcome('single-shot', 'pc-meeting')?.correct).toBe(true)
    expect(outcome('adaptive-critic', 'pc-meeting')?.hallucinated).toBe(true)
  })

  it('keeps the books: every aggregate is the sum of the runs under it', () => {
    for (const row of comparePipelines(cfg).rows) {
      const recalls = row.runs.map((run) => run.recall).filter((value): value is number => value !== null)
      expect(row.recall).toBeCloseTo(
        recalls.reduce((sum, value) => sum + value, 0) / Math.max(1, recalls.length),
        10,
      )
      expect(row.retrievals).toBe(row.runs.reduce((sum, run) => sum + run.retrievals, 0))
      expect(row.tokens).toBe(row.runs.reduce((sum, run) => sum + run.tokens, 0))
      expect(row.latencyMs).toBe(row.runs.reduce((sum, run) => sum + run.latencyMs, 0))
      expect(row.correct).toBe(row.runs.filter((run) => run.correct).length)
      // Correct, abstained, hallucinated: a three-way partition of every question,
      // so no run can be both a refusal and an invented answer.
      expect(row.correct + row.abstentions + row.hallucinations).toBe(row.cases)
      for (const run of row.runs) {
        expect(Number(run.abstained) + Number(run.hallucinated) + Number(run.correct)).toBeLessThanOrEqual(1)
        expect(run.tokens).toBeGreaterThan(estimateTokens(run.title) > 0 ? 0 : 0)
      }
    }
  })

  it('says which number it is not claiming', () => {
    // Nothing here is a paper's result: the shapes are compared on a hand-authored
    // set, and every count is arithmetic over a stated budget model.
    const comparison = comparePipelines(cfg)
    const summary = runAdaptiveRetrieval(cfg)
    expect(comparison.rows.some((row) => row.correct > row.cases)).toBe(false)
    expect(summary.gated.abstentions).toBe(0)
    expect(summary.gated.correct + summary.gated.abstentions + summary.gated.wrongAnswers).toBe(6)
    // A case set the shapes cannot be confused about: each question is one kind.
    expect(new Set(PIPELINE_CASES.map((entry) => entry.id)).size).toBe(PIPELINE_CASES.length)
    expect(PIPELINE_CASES.filter((entry) => entry.kind === 'multi-hop')).toHaveLength(3)
    expect(PIPELINE_CASES.filter((entry) => entry.kind === 'no-retrieval')).toHaveLength(3)
  })
})

describe('the engines behind all three sections', () => {
  it('is deterministic, because nothing in it is sampled', () => {
    expect(JSON.stringify(runAdaptiveRetrieval(cfg))).toBe(JSON.stringify(critique))
    expect(JSON.stringify(runQuestionDecomposition(cfg))).toBe(JSON.stringify(decomp))
    expect(JSON.stringify(comparePipelines(cfg))).toBe(JSON.stringify(comparePipelines(cfg)))
  })

  it('answers the same question twice and gets the same trace twice', () => {
    const first = gatedRun('c-rollback')
    const again = runAdaptiveRetrieval(cfg).gated.runs.find((run) => run.caseId === 'c-rollback')
    expect(again?.trace).toEqual(first.trace)
    // The rollback case is the one where nothing in the first window answers, so
    // the rewrite is what reaches the decisive passage at all.
    expect(first.decisiveReachedWindow).toBe(true)
    expect(first.correct).toBe(true)
    expect(first.graded.filter((item) => item.decisive && item.supported)).toHaveLength(1)
  })
})
