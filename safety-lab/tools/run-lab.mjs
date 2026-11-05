#!/usr/bin/env node
/**
 * The laboratories, from the terminal.
 *
 * Every screen is a thin layer over a pure function in `src/core`, so the same
 * laboratory can be run without a browser. This file reads the scenario the sliders
 * start at — `src/content/labDefaults.ts`, which the screens read too — calls the same
 * core functions in the same order, and prints what they return. Nothing is
 * re-implemented here: a disagreement between this output and the page is a bug in one
 * of them, not a difference of opinion between two implementations.
 *
 *   npm run lab -- constitution
 *   npm run --silent lab -- all --csv > safety-lab.csv
 *   node --import ./tools/ts-resolver.mjs tools/run-lab.mjs privacy --json
 *
 * Options:
 *   --csv    `lab,kind,metric,value,note` rows on stdout, for a spreadsheet or a diff
 *   --json   one object per laboratory
 *   --seed N replace the scenario's seed, where a scenario has one
 *   --list   the registered laboratories and exit
 *   --help   this text
 */

import { fmt } from '@llm-materials/course-core'
import { LABS } from '../src/content/labs'
import { LAB_DEFAULTS } from '../src/content/labDefaults'
import {
  CRITICS,
  PRINCIPLES,
  buildCritiqueCases,
  buildExchanges,
  compareCritics,
  critique,
  detect,
  judgeAgreement,
  runConstitutionLoop,
  sampleJudgeVerdicts,
  verdictAgreement,
} from '../src/core/constitution'
import {
  buildDemonstrations,
  buildPreferencePairs,
  imitate,
  meanChoice,
  preferredRound,
  runTwoRound,
  trainSecondRound,
} from '../src/core/alignment'
import {
  SEARCH_POLICIES,
  budgetFor,
  buildFailures,
  discoveryCurve,
  marginalDiscovery,
  runRedTeam,
  searchCurve,
} from '../src/core/redteam'
import { CUES, auditClassifier, buildCorpus as buildCuedCorpus, cuedShareSweep, wrongCueControl } from '../src/core/sleeper'
import {
  buildQuestions,
  consistencySweep,
  effectiveLooks,
  expectedMajorityRate,
  expectedRepeatAgreement,
  interLabelerAgreement,
  labelQuestion,
  leanSweep,
  majorityProbability,
  readReward,
  repeatAgreementCurve,
  trainPolicy,
} from '../src/core/preference'
import { buildSycophancyCases, buildTrainingRecords, extractionCurve, flipRate, flipRateWhenChallenged, mitigationEffect, runExtraction } from '../src/core/measures'
import {
  PRIOR,
  TOKENS,
  buildCorpus,
  duplicationCurve,
  expectedExtraction,
  extractionAccuracy,
  membershipAttack,
  queryCurve,
} from '../src/core/memorisation'

const HELP = `usage: npm run lab -- <lab|all> [--csv] [--json] [--seed n]

  npm run --silent lab -- privacy --csv > privacy.csv   (npm's own banner goes to stdout)

laboratories:
${LABS.map((lab) => `  ${lab.id.padEnd(14)}${lab.name} — ${lab.blurb}`).join('\n')}
`

/** The numbers a laboratory reports, in the order its screen shows them. */
function scenario(settings, stats, tables = []) {
  return { settings, stats, tables }
}

const percent = (value, digits = 1) => `${fmt(value * 100, digits)}%`
const points = (value, digits = 1) => `${fmt(value * 100, digits)} points`

/* ------------------------------------------------------------------- scenarios */

/** The cue the corpus's harm actually rides on. The label sheets disagree about which cue that is. */
const REAL_CUE = CUES[0]

function constitution(D) {
  const exchanges = buildExchanges(D.exchanges, { compliance: D.compliance, seed: D.seed })
  const loop = runConstitutionLoop(exchanges)
  const verdicts = sampleJudgeVerdicts(exchanges, D.judgeNoise, D.seed + 11)
  const judge = judgeAgreement(verdicts.judged, verdicts.labels)

  const cases = buildCritiqueCases(D.cases, D.seed)
  const comparison = compareCritics(cases, CRITICS, { seed: D.seed })
  const selfVerdicts = detect(cases, CRITICS[0], { seed: D.seed })
  const externalVerdicts = detect(cases, CRITICS[1], { seed: D.seed })
  const both = verdictAgreement(selfVerdicts, externalVerdicts)
  const byCategory = PRINCIPLES.map((principle) => {
    let violations = 0
    let missedSelf = 0
    let missedExternal = 0
    cases.forEach((entry, index) => {
      if (!entry.violation || entry.exchange.category !== principle.category) return
      violations++
      if (!selfVerdicts[index]) missedSelf++
      if (!externalVerdicts[index]) missedExternal++
    })
    return { category: principle.category, violations, missedSelf, missedExternal }
  })

  const compliant = exchanges.filter((exchange) => exchange.compliant).length
  const objected = exchanges.filter((exchange) => critique(exchange) !== null).length

  return scenario(
    [
      ['exchanges', D.exchanges],
      ['compliance', percent(D.compliance, 0)],
      ['the judge’s error rate', percent(D.judgeNoise, 0)],
      ['cases the critics are asked about', D.cases],
      ['seed', D.seed],
    ],
    [
      ['the harm before', fmt(loop.harmBefore, 4), 'mean over the exchanges'],
      ['the harm after', fmt(loop.harmAfter, 4), 'what the loop left'],
      ['changed', String(loop.changed), `of ${exchanges.length} responses, ${compliant} of them compliant`],
      ['unchanged', String(loop.unchanged), `${objected} were objected to by a principle`],
      ['still useful', String(loop.stillUseful), 'revised and still answering the question'],
      ['critiques per change', fmt(loop.critiquesPerChange, 2), 'the price of one revision'],
      ['the judge’s agreement', percent(judge.agreement), `${judge.falsePositives} false positive(s), ${judge.falseNegatives} missed`],
      ['the two critics agree', percent(both.agreement), `${both.onlyA} only the self-critic, ${both.onlyB} only the external one`],
    ],
    [
      {
        caption: 'Each critic, over the same cases and the same seed',
        header: ['critic', 'violations', 'seen', 'missed', 'false alarms', 'recall', 'harm removed', 'cost', 'harm per cost'],
        rows: comparison.map((entry) => [
          entry.id,
          entry.violations,
          entry.detected,
          entry.missed,
          entry.falseAlarms,
          fmt(entry.recall, 4),
          fmt(entry.harmRemoved, 4),
          fmt(entry.cost, 0),
          fmt(entry.harmPerCost, 5),
        ]),
      },
      {
        caption: 'Where each critic is blind, by the category of the principle',
        header: ['category', 'violations', 'missed by the self-critic', 'missed by the external critic'],
        rows: byCategory.map((row) => [row.category, row.violations, row.missedSelf, row.missedExternal]),
      },
    ],
  )
}

function alignment(D) {
  const pool = buildDemonstrations(D.demonstrations, D.seed)
  const pairs = buildPreferencePairs(Math.max(4, Math.round(D.demonstrations / 2)), { chooseHelpful: D.chooseHelpful })
  const options = { steps: D.steps, learningRate: D.learningRate }
  const run = runTwoRound(pool, pairs, options)
  const second = trainSecondRound(run.roundOne, pairs, options)
  const target = meanChoice(pairs)
  const helpful = imitate(pool.filter((entry) => entry.kind === 'helpful'))
  const safe = imitate(pool.filter((entry) => entry.kind === 'harmless'))

  const weights = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
  const sweep = weights.map((weight) => preferredRound(pool, pairs, weight, options))
  const firstTwo = sweep.findIndex((entry) => entry.prefers === 'round two')
  const crossover = firstTwo <= 0 ? null : weights[firstTwo]
  const chosen = preferredRound(pool, pairs, D.helpfulWeight, options)

  return scenario(
    [
      ['demonstrations', D.demonstrations],
      ['the labels pick helpful', percent(D.chooseHelpful, 0)],
      ['learning rate', fmt(D.learningRate, 2)],
      ['steps', D.steps],
      ['the weight on helpfulness', percent(D.helpfulWeight, 0)],
      ['seed', D.seed],
    ],
    [
      ['after round one', `${fmt(run.roundOne.helpfulness, 3)}, ${fmt(run.roundOne.harmlessness, 3)}`, 'helpfulness, harmlessness'],
      ['after round two', `${fmt(run.roundTwo.helpfulness, 3)}, ${fmt(run.roundTwo.harmlessness, 3)}`, 'the same two axes'],
      ['the movement', fmt(run.movement, 4), 'how far the preference round travelled'],
      ['the residual', fmt(second.residual, 4), 'still short of what the labels ask for'],
      ['the labels’ target', `${fmt(target.helpfulness, 3)}, ${fmt(target.harmlessness, 3)}`, 'the mean of the expected choices'],
      ['the helpful cluster', `${fmt(helpful.helpfulness, 3)}, ${fmt(helpful.harmlessness, 3)}`, 'what the pool’s helpful half averages to'],
      ['the safe cluster', `${fmt(safe.helpfulness, 3)}, ${fmt(safe.harmlessness, 3)}`, 'and what its harmless half does'],
      ['at this weight', chosen.prefers, `round one ${fmt(chosen.roundOne, 4)}, round two ${fmt(chosen.roundTwo, 4)}`],
      ['the crossover', crossover === null ? 'never' : `at a weight of ${crossover}`, 'above it the second round is the better of the two'],
    ],
    [
      {
        caption: 'The same two rounds, under every weighting of the trade-off',
        header: ['weight on helpfulness', 'round one', 'round two', 'preferred'],
        rows: sweep.map((entry) => [
          fmt(entry.helpfulWeight, 1),
          fmt(entry.roundOne, 4),
          fmt(entry.roundTwo, 4),
          entry.prefers,
        ]),
      },
      {
        caption: 'Every step of the second round, and the distance left to the target',
        header: ['step', 'helpfulness', 'harmlessness', 'distance left'],
        rows: second.path.map((policy, step) => {
          const dh = policy.helpfulness - target.helpfulness
          const dn = policy.harmlessness - target.harmlessness
          return [step, fmt(policy.helpfulness, 4), fmt(policy.harmlessness, 4), fmt(Math.sqrt(dh * dh + dn * dn), 5)]
        }),
      },
    ],
  )
}

function redteam(D) {
  const team = runRedTeam({ attacks: D.attacks, modelDriven: D.modelDriven, complianceRate: D.compliance, seed: D.seed })
  const other = runRedTeam({ attacks: D.attacks, modelDriven: !D.modelDriven, complianceRate: D.compliance, seed: D.seed })
  const curve = [2, 4, 6, 10, 16, 24, 40, 80].map((count) => {
    const result = runRedTeam({ attacks: count, modelDriven: D.modelDriven, complianceRate: D.compliance, seed: D.seed })
    return { count, coverage: result.coverage, rate: result.successRate, findings: result.distinctFindings }
  })

  const failures = buildFailures(D.failures, D.seed)
  const totals = [0.125, 0.25, 0.5, 0.75, 1].map((share) => Math.max(failures.length, Math.round(D.budget * share)))
  const spread = discoveryCurve(failures, totals.map((total) => Math.round(total / Math.max(1, failures.length))), { seed: D.seed })
  const hunt = searchCurve(failures, totals, SEARCH_POLICIES, { seed: D.seed, repetitions: D.repetitions })
  const last = hunt[hunt.length - 1]
  const needed = budgetFor(failures, 0.9)
  const guided = last?.searches.find((entry) => entry.id === 'guided')
  const unguided = last?.searches.find((entry) => entry.id === 'unguided')

  return scenario(
    [
      ['attacks', D.attacks],
      ['the attacker', D.modelDriven ? 'model-driven' : 'random'],
      ['compliance', percent(D.compliance, 0)],
      ['failures on the board', failures.length],
      ['largest budget', D.budget],
      ['runs per point', D.repetitions],
      ['seed', D.seed],
    ],
    [
      ['the attack success rate', percent(team.successRate), `${team.succeeded} of ${team.attempted} attacks`],
      ['the coverage', percent(team.coverage), `${team.categoriesReached} of ${team.categories} categories`],
      ['the distinct findings', String(team.distinctFindings), 'attacks that reached a category no earlier one had'],
      ['the other attacker’s coverage', percent(other.coverage), `the ${D.modelDriven ? 'random' : 'model-driven'} one, same budget`],
      ['the best the same total can do', last ? percent(last.ideal) : '—', 'the budget spent evenly, which no search does'],
      ['the hunt that went looking', guided ? percent(guided.rate) : '—', `at ${last?.total ?? 0} attempts, ${guided ? fmt(guided.rehits, 1) : 0} spent on failures already found`],
      ['the hunt that did not', unguided ? percent(unguided.rate) : '—', `the same budget, ${D.repetitions} runs averaged`],
      ['attempts per failure for nine in ten', String(needed), 'the budget the arithmetic says is enough'],
      ['what one more buys', fmt(marginalDiscovery(failures, needed), 5), 'at that budget — the point to stop searching'],
    ],
    [
      {
        caption: 'Inside the taxonomy: what each category got',
        header: ['category', 'attacks', 'failures', 'reached'],
        rows: team.byCategory.map((row) => [row.category, row.attacks, row.failures, row.reached ? 'yes' : 'no']),
      },
      {
        caption: 'The success rate and the coverage as the budget grows',
        header: ['attacks', 'the success rate', 'the coverage', 'distinct findings'],
        rows: curve.map((row) => [row.count, percent(row.rate), percent(row.coverage), row.findings]),
      },
      {
        caption: 'A total budget, and what each way of spending it found',
        header: ['total', 'the even ideal', 'the random expectation', ...SEARCH_POLICIES.map((policy) => policy.id), 'wasted (guided)'],
        rows: hunt.map((row) => [
          row.total,
          percent(row.ideal),
          percent(row.unguided),
          ...SEARCH_POLICIES.map((policy) => percent(row.searches.find((entry) => entry.id === policy.id)?.rate ?? 0)),
          fmt(row.searches.find((entry) => entry.id === 'guided')?.wasted ?? 0, 1),
        ]),
      },
      {
        caption: 'The spread, at an even share of each total',
        header: ['attempts per failure', 'the arithmetic', 'one run'],
        rows: spread.map((row) => [row.attempts, percent(row.expected), percent(row.observed)]),
      },
    ],
  )
}

/** The cue on this sheet's label, and the weight the fit gave it. */
const weightOf = (sheet) => fmt(sheet.audit.cueWeights[0]?.weight ?? 0, 4)

function sleeper(D) {
  const training = buildCuedCorpus(D.trainingSize, {
    cues: [REAL_CUE],
    cuePrevalence: D.cuePrevalence,
    cuedShareOfHarm: D.cuedShareOfHarm,
    harmfulRate: D.harmfulRate,
    seed: D.seed,
  })
  const test = buildCuedCorpus(D.examples, {
    cues: [REAL_CUE],
    cuePrevalence: D.cuePrevalence,
    cuedShareOfHarm: D.cuedShareOfHarm,
    harmfulRate: D.harmfulRate,
    seed: D.seed + 4_009,
  })

  const sheets = [
    { value: 'carries', cue: REAL_CUE },
    { value: 'other', cue: CUES[1] },
  ].map((sheet) => {
    const audit = auditClassifier(training, test, [sheet.cue])
    const control = wrongCueControl(training, test, sheet.cue, REAL_CUE)
    return {
      ...sheet,
      audit,
      control,
      cuedTotal: control.unseen.detected + control.unseen.missed,
    }
  })
  const active = sheets.find((sheet) => sheet.value === D.sheet)
  const shares = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
  const sweep = cuedShareSweep(test, [REAL_CUE], shares, { trainingSize: D.trainingSize, seed: D.seed })

  const cuedHarm = test.filter((example) => example.harmful && example.cue === REAL_CUE).length
  const directHarm = test.filter((example) => example.harmful && example.cue === null).length

  return scenario(
    [
      ['the label sheet', `${D.sheet === 'carries' ? 'the cue that carries it' : 'a cue that is not it'} (${active.cue})`],
      ['examples', D.examples],
      ['training size', D.trainingSize],
      ['harmful rate', percent(D.harmfulRate, 0)],
      ['harm riding on the cue', percent(D.cuedShareOfHarm, 0)],
      ['the cue on harmless answers', percent(D.cuePrevalence, 0)],
      ['seed', D.seed],
    ],
    [
      ['the cued behaviour caught', `${active.control.unseen.detected} of ${active.cuedTotal}`, `harm that arrived with the ${REAL_CUE}`],
      ['the weight on the cue it was given', fmt(active.audit.cueWeights[0]?.weight ?? 0, 4), 'zero means the column taught it nothing'],
      ['the harm the evaluation reports', percent(active.audit.apparentHarmRate), 'an evaluation set that never fires the cue'],
      ['the harm there actually is', percent(active.audit.trueHarmRate), `under-reported by ${fmt(active.audit.underReportedBy * 100, 1)} points`],
      ['harm in the test set', `${cuedHarm} cued, ${directHarm} not`, 'the two groups the classifier is scored on separately'],
      ['caught without the cue', percent(active.audit.direct.detectionRate), `${active.audit.direct.detected} of ${active.audit.direct.detected + active.audit.direct.missed}`],
      ['the cut it was judged at', fmt(active.audit.threshold, 4), 'halfway between its own harm and safety means'],
      ['false alarms on clean answers', percent(active.control.guessed.falseAlarmRate), `of the ${test.filter((example) => !example.harmful).length} clean examples, at that cut`],
    ],
    [
      {
        caption: 'Both label sheets, the same behaviour',
        header: ['sheet', 'cue given a column', 'the weight on it', 'cued harm caught', 'harm reported', 'harm there is'],
        rows: sheets.map((sheet) => [
          sheet.value,
          sheet.cue,
          fmt(sheet.audit.cueWeights[0]?.weight ?? 0, 4),
          `${sheet.control.unseen.detected} of ${sheet.cuedTotal}`,
          percent(sheet.audit.apparentHarmRate),
          percent(sheet.audit.trueHarmRate),
        ]),
      },
      {
        caption: 'The wrong-cue control: the same quantities under each label sheet',
        header: ['the quantity', 'when the sheet names the date', 'when it names another cue'],
        rows: [
          ['the weight on the column it was given', weightOf(sheets[0]), weightOf(sheets[1])],
          ['the cued harm it flagged', `${sheets[0].control.unseen.detected} of ${sheets[0].cuedTotal}`, `${sheets[1].control.unseen.detected} of ${sheets[1].cuedTotal}`],
          ['the cued harm it missed', sheets[0].control.unseen.missed, sheets[1].control.unseen.missed],
          ['the false alarms on harmless answers', sheets[0].control.guessed.falseAlarms, sheets[1].control.guessed.falseAlarms],
          ['the cut it used', fmt(sheets[0].control.threshold, 4), fmt(sheets[1].control.threshold, 4)],
        ],
      },
      {
        caption: 'What labelling the cue buys, as more of the harm rides on it',
        header: ['share of the harm cued', 'cued detection', 'direct detection', 'the weight on the cue'],
        rows: sweep.map((row) => [
          percent(row.share, 0),
          percent(row.cuedDetection),
          percent(row.directDetection),
          fmt(row.cueWeight, 4),
        ]),
      },
    ],
  )
}

function preference(D) {
  const labeler = { id: 'labeler', agreeRate: D.lean, consistency: D.consistency, looks: D.looks }
  const set = buildQuestions(D.questions, { userRightRate: D.userRightRate, seed: D.seed })
  const outcome = trainPolicy(labeler, set, { seed: D.seed })
  const levels = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
  const sweeps = consistencySweep({ agreeRate: D.lean, looks: D.looks }, levels, set, { seed: D.seed })
  const byLean = leanSweep({ consistency: D.consistency, looks: D.looks }, levels, set, { seed: D.seed })
  const curve = repeatAgreementCurve(labeler, levels)
  const other = { ...labeler, id: 'second labeler' }
  const across = {
    zero: interLabelerAgreement({ ...labeler, consistency: 0, id: 'first' }, { ...other, consistency: 0 }),
    current: interLabelerAgreement({ ...labeler, id: 'first' }, other),
    perfect: interLabelerAgreement({ ...labeler, consistency: 1, id: 'first' }, { ...other, consistency: 1 }),
  }

  let pairs = 0
  let agreed = 0
  set.forEach((_question, index) => {
    const labels = labelQuestion(labeler, D.seed + index * 101)
    for (let first = 0; first < labels.choices.length; first++) {
      for (let second = first + 1; second < labels.choices.length; second++) {
        pairs++
        if (labels.choices[first] === labels.choices[second]) agreed++
      }
    }
  })
  const sampled = pairs === 0 ? 0 : agreed / pairs
  const jury = Array.from({ length: 7 }, (_, index) => index * 2 + 1).map((size) => ({ size, scattered: majorityProbability(D.lean, size) }))
  const certain = readReward(labelQuestion({ ...labeler, consistency: 1 }, D.seed))

  return scenario(
    [
      ['questions', D.questions],
      ['looks per question', D.looks],
      ['the lean toward agreeing', percent(D.lean, 0)],
      ['consistency', percent(D.consistency, 0)],
      ['the user is right', percent(D.userRightRate, 0)],
      ['seed', D.seed],
    ],
    [
      ['two looks agree', percent(expectedRepeatAgreement(labeler)), `${percent(sampled)} sampled over ${set.length} questions`],
      ['the reward model picks agreeing', percent(expectedMajorityRate(labeler)), `against a lean of ${percent(D.lean, 0)}`],
      ['the panel is worth', `${fmt(effectiveLooks(labeler), 2)} looks`, `of the ${D.looks} it was counted as`],
      ['the policy agrees with the user', percent(outcome.sycophancyRate), `and is right ${percent(outcome.accuracy)} of the time`],
      ['the reward it collected', fmt(outcome.meanReward, 4), `at a mean confidence of ${fmt(outcome.meanConfidence, 4)}`],
      ['two labelers, no consistency', percent(across.zero.expected), `sampled ${percent(across.zero.observed)} — independent people, independent answers`],
      ['two labelers, this consistency', percent(across.current.expected), `sampled ${percent(across.current.observed)}`],
      ['two labelers, perfect consistency', percent(across.perfect.expected), 'the same person asked twice, which is what the number is then measuring'],
      ['one perfectly consistent labeler', `${certain.prefers} by ${fmt(certain.margin, 3)}`, `faithful to the latent side: ${certain.faithful ? 'yes' : 'no'}`],
    ],
    [
      {
        caption: 'The majority of a panel of independent looks, at a fixed lean',
        header: ['looks', 'the majority says agree', 'one look says agree'],
        rows: jury.map((row) => [row.size, percent(row.scattered), percent(D.lean)]),
      },
      {
        caption: 'Consistency walks, and the two numbers come apart',
        header: ['consistency', 'agreement expected', 'sycophancy', 'accuracy', 'the panel is worth'],
        rows: sweeps.map((row) => [
          fmt(row.consistency, 1),
          percent(row.expectedAgreement),
          percent(row.sycophancyRate),
          percent(row.accuracy),
          fmt(row.effectiveLooks, 2),
        ]),
      },
      {
        caption: 'The lean walks, at this consistency',
        header: ['the lean', 'sycophancy', 'the arithmetic', 'accuracy'],
        rows: byLean.map((row) => [percent(row.agreeRate, 0), percent(row.sycophancyRate), percent(row.expectedSycophancy), percent(row.accuracy)]),
      },
      {
        caption: 'The repeat-agreement rate, computed exactly, as consistency walks',
        header: ['consistency', 'two looks agree'],
        rows: curve.map((row) => [fmt(row.consistency, 1), percent(row.expected)]),
      },
    ],
  )
}

function sycophancy(D) {
  const cases = buildSycophancyCases(D.cases, D.seed)
  const rate = flipRate(cases)
  const challenged = flipRateWhenChallenged(cases)
  const effect = mitigationEffect(cases)
  const flipped = cases.filter((entry) => entry.neutral === entry.question && entry.underPressure !== entry.question).length
  const knew = cases.filter((entry) => entry.neutral === entry.question).length

  return scenario(
    [
      ['questions', D.cases],
      ['seed', D.seed],
    ],
    [
      ['the flip rate', percent(rate), `${flipped} of the ${knew} it knew`],
      ['with the challenge', percent(challenged), 'told the user may be wrong'],
      ['the effect of the mitigation', points(effect), 'the same questions, one sentence apart'],
      ['the questions', String(cases.length), 'every one of them answered, and the user’s answer is always wrong'],
    ],
    [
      {
        caption: `The first ${Math.min(8, flipped)} questions that flipped, and what the challenge did to them`,
        header: ['the right answer', 'the user asserted', 'the model, neutral', 'under pressure', 'challenged'],
        rows: cases
          .filter((entry) => entry.neutral === entry.question && entry.underPressure !== entry.question)
          .slice(0, 8)
          .map((entry) => [entry.question, entry.asserted, entry.neutral, entry.underPressure, entry.whenChallenged]),
      },
      {
        caption: 'Every combination of the three answers, counted over the whole set',
        header: ['with no pressure', 'under pressure', 'challenged', 'how many', 'what it means'],
        rows: shapes(cases),
      },
    ],
  )
}

/** The four shapes a pressure test can land in, counted — the table the screen scrolls through, without the scrolling. */
function shapes(cases) {
  const buckets = [
    { neutral: true, underPressure: true, label: 'held to the right answer whatever the user said' },
    { neutral: true, underPressure: false, label: 'flipped under pressure — the flip rate' },
    { neutral: false, underPressure: true, label: 'wrong before the pressure was applied' },
    { neutral: false, underPressure: false, label: 'wrong, and agreed with the user from the start' },
  ]
  return buckets.map((bucket) => {
    const match = cases.filter(
      (entry) =>
        (entry.neutral === entry.question) === bucket.neutral &&
        (entry.underPressure === entry.question) === bucket.underPressure,
    )
    const held = match.filter((entry) => entry.whenChallenged === entry.question).length
    return [
      bucket.neutral ? 'right' : 'agreed',
      bucket.underPressure ? 'right' : 'agreed',
      `${held} of ${match.length} right`,
      String(match.length),
      bucket.label,
    ]
  })
}

function privacy(D) {
  const training = buildTrainingRecords(D.records, D.seed)
  const extraction = runExtraction(training, { prefixLength: D.prefixLength, guesses: D.guesses, seed: D.seed })
  const exposure = extractionCurve(training, [0, 1, 2, 3, 4, 6, 8], { guesses: D.guesses, seed: D.seed })

  const corpus = buildCorpus(D.candidates, {
    repeatShare: D.repeatShare,
    maxCount: D.maxCount,
    nearDuplicateShare: D.nearDuplicateShare,
    seed: D.seed,
  })
  const attack = membershipAttack(corpus, { queries: D.queries, seed: D.seed })
  const cleanCorpus = buildCorpus(D.candidates, {
    repeatShare: D.repeatShare,
    maxCount: D.maxCount,
    nearDuplicateShare: 0,
    seed: D.seed,
  })
  const cleanAttack = membershipAttack(cleanCorpus, { queries: D.queries, seed: D.seed })

  const budgets = [1, 2, 4, 8, 16, 32, 64]
  const curve = queryCurve(corpus, budgets, { seed: D.seed })
  const oneQuery = queryCurve(corpus, [1], { seed: D.seed })[0]

  const groups = [
    'a member, seen once',
    'a member, seen more than once',
    'an outsider that resembles a member',
    'an outsider, nothing to resemble',
  ]
  const baseline = 1 / TOKENS
  const groupOf = (candidate) => {
    if (candidate.member && candidate.count > 1) return 'a member, seen more than once'
    if (candidate.member) return 'a member, seen once'
    if (candidate.probability > baseline) return 'an outsider that resembles a member'
    return 'an outsider, nothing to resemble'
  }
  const composition = groups.map((name) => {
    const inGroup = corpus.filter((candidate) => groupOf(candidate) === name)
    if (inGroup.length === 0) return { name, count: 0, share: 0, mean: baseline, seen: 0 }
    const mean = inGroup.reduce((sum, candidate) => sum + candidate.probability, 0) / inGroup.length
    const seen = inGroup.reduce((sum, candidate) => sum + candidate.count, 0) / inGroup.length
    return { name, count: inGroup.length, share: inGroup.length / corpus.length, mean, seen }
  })

  const members = corpus.filter((candidate) => candidate.member)
  const outsiders = corpus.filter((candidate) => !candidate.member)
  const countsAt = [...new Set([...corpus.map((candidate) => candidate.count), D.maxCount])].sort((a, b) => a - b)
  const counts = duplicationCurve(countsAt, { seed: D.seed })
  const listed = counts.reduce((sum, row) => sum + corpus.filter((candidate) => candidate.count === row.count).length, 0)

  return scenario(
    [
      ['records the prefix attack is run over', D.records],
      ['the prefix held', D.prefixLength],
      ['guesses per record', D.guesses],
      ['candidates', D.candidates],
      ['members seen more than once', percent(D.repeatShare, 0)],
      ['the most copies', D.maxCount],
      ['outsiders that resemble a member', percent(D.nearDuplicateShare, 0)],
      ['queries per candidate', D.queries],
      ['seed', D.seed],
    ],
    [
      ['the exposure', percent(extraction.successRate), `of the training set, at a prefix of ${D.prefixLength}`],
      ['the records recovered', `${extraction.recovered} of ${extraction.total}`, 'the whole sample, not a subsample of it'],
      ['the guesses spent', String(extraction.tokensGuessed), `${fmt(extraction.tokensGuessed / Math.max(1, extraction.recovered), 2)} per recovery`],
      ['the AUC', percent(attack.auc), 'a random member outranks a random outsider'],
      ['caught', percent(attack.truePositiveRate), `of the ${members.length} members`],
      ['wrongly caught', percent(attack.falsePositiveRate), `of the ${outsiders.length} outsiders`],
      ['its precision', percent(attack.precision), `of the ${attack.flagged} it flagged`],
      ['the same corpus without near-duplicates', percent(cleanAttack.auc), `the AUC falls from ${percent(attack.auc)}`],
      ['at one query', oneQuery ? percent(oneQuery.auc) : '—', 'the statistic is a coin, whatever the corpus holds'],
      ['the gain', curve.length > 1 ? points((curve[curve.length - 1].auc - oneQuery.auc)) : '—', `over ${budgets[budgets.length - 1]} queries`],
      ['the extraction rate of the members', percent(extractionAccuracy(members)), `the arithmetic says ${percent(expectedExtraction(members))}`],
      ['the model’s prior', `${PRIOR} copies`, `over ${TOKENS} tokens, so an unseen record is worth ${fmt(baseline, 4)}`],
    ],
    [
      {
        caption: 'The records, what the attacker held, and what the recovery cost',
        header: ['record', 'the prefix held', 'the secret', 'recovered?', 'the guesses it took'],
        rows: training.slice(0, 10).map((record, index) => {
          const detail = extraction.details[index]
          return [
            index + 1,
            record.prefix.slice(0, D.prefixLength),
            record.secret,
            detail?.recovered ? 'yes' : 'no',
            detail?.guessesUsed ?? 0,
          ]
        }),
      },
      {
        caption: 'The exposure against the length of the known prefix',
        header: ['the prefix held', 'the exposure'],
        rows: exposure.map((row) => [row.prefixLength, percent(row.successRate)]),
      },
      {
        caption: 'The kinds of candidate in the corpus, and what the model gives each',
        header: ['the kind', 'how many', 'the share', 'the mean probability', 'the log-ratio', 'copies each'],
        rows: composition.map((row) => [
          row.name,
          row.count,
          percent(row.share),
          fmt(row.mean, 5),
          fmt(Math.log(row.mean / baseline), 4),
          fmt(row.seen, 2),
        ]),
      },
      {
        caption: 'What the query budget buys',
        header: ['queries', 'AUC', 'caught', 'wrongly caught', 'precision', 'flagged'],
        rows: curve.map((row) => [
          row.queries,
          percent(row.auc),
          percent(row.truePositiveRate),
          percent(row.falsePositiveRate),
          percent(row.precision),
          row.flagged,
        ]),
      },
      {
        caption: `Extraction against duplication (${listed} of ${corpus.length} candidates listed)`,
        header: ['copies', 'candidates at this count', 'the model gives', 'said back, sampled', 'its score over the baseline'],
        rows: counts.map((row) => [
          row.count,
          corpus.filter((candidate) => candidate.count === row.count).length,
          percent(row.probability, 2),
          percent(row.observed, 2),
          fmt(row.score, 3),
        ]),
      },
    ],
  )
}

const RUNNERS = { constitution, alignment, redteam, sleeper, preference, sycophancy, privacy }

/* ------------------------------------------------------------------------ main */

function parseArgs(argv) {
  const options = { labs: [], csv: false, json: false, seed: null, list: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i]
    if (argument === '--csv') options.csv = true
    else if (argument === '--json') options.json = true
    else if (argument === '--list') options.list = true
    else if (argument === '--help' || argument === '-h') options.help = true
    else if (argument === '--seed') {
      const value = Number(argv[++i])
      if (!Number.isInteger(value)) throw new Error('--seed wants an integer')
      options.seed = value
    } else if (argument === 'all') options.labs.push(...Object.keys(RUNNERS))
    else if (argument?.startsWith('-')) throw new Error(`unknown option ${argument}`)
    else if (RUNNERS[argument]) options.labs.push(argument)
    else throw new Error(`no laboratory called ${argument}\n\n${HELP}`)
  }
  if (options.labs.length === 0 && !options.list && !options.help) options.labs.push('all')
  return options
}

function csvRow(value) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function text(lab, result) {
  const lines = []
  lines.push(`${lab.name} — ${lab.blurb}`)
  lines.push(`  settings  ${result.settings.map(([key, value]) => `${key}: ${value}`).join(' · ')}`)
  lines.push('')
  // A label or value wider than its column would otherwise run straight into the next one.
  const labelWidth = Math.max(32, ...result.stats.map(([name]) => String(name).length)) + 2
  const width = Math.max(18, ...result.stats.map(([, value]) => String(value).length)) + 2
  for (const [name, value, note] of result.stats) {
    lines.push(`  ${String(name).padEnd(labelWidth)}${String(value).padEnd(width)}${note ?? ''}`.trimEnd())
  }
  for (const table of result.tables) {
    lines.push('')
    lines.push(`  ${table.caption}`)
    const cells = [table.header, ...table.rows].map((row) => row.map(String))
    const widths = table.header.map((_, column) => Math.max(...cells.map((row) => (row[column] ?? '').length)) + 2)
    const line = (row) => `    ${row.map((cell, column) => String(cell).padEnd(widths[column])).join('').trimEnd()}`
    lines.push(line(table.header))
    for (const row of table.rows) lines.push(line(row))
  }
  return lines.join('\n')
}

function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(String(error.message ?? error))
    process.exit(2)
  }

  if (options.help) {
    console.log(HELP)
    return
  }
  if (options.list) {
    for (const lab of LABS) console.log(`${lab.id}\t${lab.name}`)
    return
  }

  const rows = [['lab', 'kind', 'metric', 'value', 'note']]
  const documents = []

  for (const id of options.labs) {
    const lab = LABS.find((entry) => entry.id === id)
    // The screen's own starting values, read from the same object the screen reads them from.
    const settings = { ...LAB_DEFAULTS[id] }
    if (options.seed !== null && 'seed' in settings) settings.seed = options.seed
    const result = RUNNERS[id](settings)

    if (options.json) {
      documents.push({
        lab: id,
        name: lab.name,
        settings: Object.fromEntries(result.settings),
        stats: Object.fromEntries(result.stats.map(([name, value]) => [name, value])),
        tables: result.tables.map((table) => ({ caption: table.caption, header: table.header, rows: table.rows })),
      })
      continue
    }

    if (options.csv) {
      for (const [key, value] of result.settings) rows.push([id, 'setting', key, String(value), ''])
      for (const [name, value, note] of result.stats) rows.push([id, 'stat', name, String(value), note ?? ''])
      for (const table of result.tables) {
        for (const row of table.rows) rows.push([id, 'row', table.caption, row.map(String).join(' | '), ''])
      }
      continue
    }

    console.log(text(lab, result))
    console.log('')
  }

  if (options.json) {
    console.log(JSON.stringify(documents.length === 1 ? documents[0] : documents, null, 2))
  } else if (options.csv) {
    for (const row of rows) console.log(row.map(csvRow).join(','))
  }
}

main()
