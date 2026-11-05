#!/usr/bin/env node
/**
 * The laboratories, from the terminal.
 *
 * Every screen in the browser is a thin layer over a pure function in `src/core`, so
 * the same laboratory can be run without one. This file reads the scenario the
 * sliders start at — `src/content/labDefaults.ts`, which the screens read too — calls
 * the same core functions, and prints what they return. Nothing is re-implemented
 * here: the algorithms are shared, and a disagreement between this output and the
 * page is a bug in one of them.
 *
 *   npm run lab -- circuit --csv
 *   node --import ./tools/ts-resolver.mjs tools/run-lab.mjs all
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
import {
  ATTENTION_DEFAULTS,
  AUTOENCODER_DEFAULTS,
  CIRCUIT_DEFAULTS,
  INDUCTION_DEFAULTS,
  IOI_DEFAULTS,
  PATCHING_DEFAULTS,
  SUPERPOSITION_DEFAULTS,
} from '../src/content/labDefaults'
import { buildSuperpositionModel, coverage, generateFeatures, importanceThreshold, polysemanticity, tradeoffCurve } from '../src/core/superposition'
import { evaluateAutoencoder, monosemanticity, trainAutoencoder } from '../src/core/sae'
import { buildSuperposedSetup, splittingCurve, sparsitySweep } from '../src/core/splitting'
import { attributeAllNodes, buildIndirectObjectGraph, edgeWeights, faithfulness, patchNode, runCircuit, topologicalOrder } from '../src/core/patching'
import {
  ablateHeads,
  circuitShape,
  decomposePathway,
  directLogitEffect,
  headRun,
  headScores,
  logitDifference,
  ovCircuit,
  ovWrites,
  patchPath,
  qkCircuit,
  runModel,
  valueWrites,
} from '../src/core/attention'
import { INDUCTION_SEQUENCE, INDUCTION_TOKENS, corruptionSite, inductionCircuitEdges, inductionModel, inductionTargets, sitePosition } from '../src/core/inductionModel'
import { accuracyByRepeats, buildRepeatedSequence, inductionReport, matchingPositions, predictNext, TOKENS } from '../src/core/induction'
import { allEdgeIds, attributeEdges, corruptTokens, discoverCircuit, edgeNames, graphQuality, nodesInGraph } from '../src/core/circuitDiscovery'
import {
  IOI_MIRROR_MEASURE,
  IOI_MIRROR_SEQUENCE,
  IOI_MEASURE,
  IOI_SEQUENCE,
  IOI_TOKENS,
  ioiModel,
  ioiWorkflow,
} from '../src/core/ioi'

const HELP = `usage: npm run lab -- <lab|all> [--csv] [--json] [--seed n]

  npm run --silent lab -- circuit --csv > circuit.csv   (npm's own banner goes to stdout)

laboratories:
${LABS.map((lab) => `  ${lab.id.padEnd(14)}${lab.name} — ${lab.blurb}`).join('\n')}
`

/* ------------------------------------------------------------------- scenarios */

/** The numbers a laboratory reports, in the order its screen shows them. */
function scenario(settings, stats, tables = []) {
  return { settings, stats, tables }
}

function superposition(D) {
  const features = generateFeatures(D.featureCount, D.dimensions, D.seed, D.importanceExponent)
  const model = buildSuperpositionModel(features, D.dimensions, { seed: D.seed })
  const threshold = importanceThreshold(features, Math.min(3, features.length - 1), D.dimensions, { seed: D.seed })
  const tradeoff = tradeoffCurve(features, D.dimensions, { seed: D.seed })
  const last = tradeoff[tradeoff.length - 1] ?? {}

  return scenario(
    [
      ['features', D.featureCount],
      ['dimensions', D.dimensions],
      ['importance exponent', D.importanceExponent],
      ['seed', D.seed],
    ],
    [
      ['the loss', fmt(model.loss, 4), 'the expected squared error'],
      ['the interference', fmt(model.interference, 4), 'what the features pay each other'],
      ['features per direction', fmt(polysemanticity(model), 2), 'one would be monosemantic'],
      ['coverage', `${fmt(coverage(model, D.featureCount) * 100, 0)}%`, 'of the features represented'],
      ['free up to', `${D.dimensions}`, 'the features a model of this size can host alone'],
      ['newest feature’s price', fmt(last.marginalLoss ?? 0, 4), 'what the last feature added to the loss'],
      ['interference per kept feature', fmt(last.interferencePerFeature ?? 0, 4), 'what one feature pays for its company'],
      ['dropped', `${last.dropped ?? 0}`, 'of the features offered'],
    ],
    [
      {
        caption: 'Every feature, and what the model did with it',
        header: ['feature', 'importance', 'recovered', 'interference paid'],
        rows: features.map((feature, k) => [
          feature.id,
          fmt(feature.importance, 4),
          fmt(model.recoveryPerFeature[k] ?? 0, 4),
          fmt(model.interferencePerFeature[k] ?? 0, 4),
        ]),
      },
      {
        caption: 'The importance threshold, sampled',
        header: ['importance', 'the model’s decision'],
        rows: threshold.map((point) => [fmt(point.importance, 5), point.represented ? 'kept' : 'dropped']),
      },
    ],
  )
}

function autoencoder(D) {
  const features = generateFeatures(D.featureCount, D.dimensions, D.streamSeed)
  const fitted = buildSuperpositionModel(features, D.dimensions, { seed: D.streamSeed })
  const activations = features.map((feature) => {
    const stream = new Array(D.dimensions).fill(0)
    for (let k = 0; k < features.length; k++) {
      for (let i = 0; i < D.dimensions; i++) {
        stream[i] = (stream[i] ?? 0) + (fitted.columns[k]?.[i] ?? 0) * feature.value
      }
    }
    return stream
  })

  const trained = trainAutoencoder(activations, D.dictionarySize, {
    steps: D.steps,
    learningRate: D.learningRate,
    sparsityCoefficient: D.sparsity,
    seed: D.seed,
  })
  const evaluation = evaluateAutoencoder(trained.autoencoder, activations)
  const scores = monosemanticity(trained.autoencoder, activations, features.map((feature) => feature.id))

  const superposed = buildSuperposedSetup({
    angle: (D.angle * Math.PI) / 180,
    prevalence: [1, D.rare],
    seed: D.seed,
  })
  const sweep = sparsitySweep(superposed, {
    lambdas: [D.lambda],
    dictionaryFeatures: D.splittingDictionary,
    training: { seed: D.seed },
  })[0]
  const report = sweep.report
  const curve = splittingCurve(superposed, {
    runs: D.runs,
    dictionaryFeatures: D.splittingDictionary,
    training: { seed: D.seed },
  })

  return scenario(
    [
      ['activation width', D.dimensions],
      ['dictionary size', D.dictionarySize],
      ['sparsity λ', fmt(D.sparsity, 3)],
      ['steps', D.steps],
      ['seed', D.seed],
      ['splitting angle', `${D.angle}°`],
      ['rare feature weight', fmt(D.rare, 2)],
      ['sweep λ', fmt(D.lambda, 3)],
      ['sweep runs', D.runs],
    ],
    [
      ['the reconstruction error', fmt(evaluation.reconstructionError, 5), 'mean squared, per dimension'],
      ['the L0', fmt(evaluation.l0, 2), 'dictionary features active per activation'],
      ['the explained variance', fmt(evaluation.explainedVariance * 100, 1), '%'],
      ['the training loss', fmt(trained.history[trained.history.length - 1]?.loss ?? 0, 5), 'reconstruction plus the penalty'],
      ['split at λ', report.unownedFeatures.length === 0 ? 'yes' : 'no', `${report.ownedFeatures.length} of ${superposed.names.length} features owned`],
      ['merged rows', `${report.mergedRows.length}`, 'dictionary elements serving two features'],
      ['absorbed features', `${report.absorbed.length}`, 'a leak above the threshold'],
    ],
    [
      {
        caption: 'Each dictionary row, and what it is about',
        header: ['row', 'firing', 'features served', 'owns'],
        rows: report.rows.map((row) => [
          row.index,
          fmt(row.firing, 3),
          fmt(row.effectiveFeatures, 2),
          row.owns === null ? '—' : (superposed.names[row.owns] ?? '—'),
        ]),
      },
      {
        caption: 'Each ground-truth feature, and who represents it',
        header: ['feature', 'prevalence', 'rows of its own', 'alignment', 'the leak'],
        rows: report.features.map((feature) => [
          superposed.names[feature.feature],
          fmt(superposed.prevalence[feature.feature], 3),
          feature.dedicated.length,
          fmt(feature.alignment, 4),
          fmt(feature.absorption, 4),
        ]),
      },
      {
        caption: `Seven λ, ${D.runs} initialisations each (seeds ${D.seed} to ${D.seed + D.runs - 1})`,
        header: ['λ', 'L0', 'explained variance', 'split runs', 'merged runs', 'degraded runs'],
        rows: curve.map((point) => [
          fmt(point.lambda, 3),
          fmt(point.l0, 2),
          fmt(point.explainedVariance, 4),
          `${point.splitRuns}/${point.runs}`,
          point.degradedRuns > 0 ? `${point.degradedRuns}/${point.runs}` : '—',
          point.absorptionPerFeature.map((value) => fmt(value, 4)).join(' · '),
        ]),
      },
    ],
  )
}

function patching(D) {
  const graph = buildIndirectObjectGraph()
  const clean = runCircuit(graph, [D.input, 2, 3])
  const corrupted = runCircuit(graph, [D.input + 3, 5, 6])
  const attribution = attributeAllNodes(graph, clean, corrupted)
  const edges = edgeWeights(graph, clean, corrupted)
  const order = topologicalOrder(graph)
  const score = faithfulness(graph, clean, corrupted, attribution.map((entry) => entry.node))

  return scenario(
    [
      ['input', D.input],
      ['corrupted input', D.input + 3],
      ['nodes', graph.nodes.length],
    ],
    [
      ['the largest effect', fmt(attribution[0]?.normalisedEffect ?? 0, 4), 'normalised to the biggest patch'],
      ['the faithfulness', `${fmt(score * 100, 1)}%`, 'of the change the whole graph accounts for'],
      ['the order', order.join(' → '), 'a topological order of the circuit'],
    ],
    [
      {
        caption: 'Patch every node, and rank the effects',
        header: ['node', 'effect', 'normalised', 'patched output'],
        rows: attribution.map((entry) => {
          const patched = patchNode(graph, clean, corrupted, entry.node)
          return [entry.label, fmt(entry.effect, 4), fmt(entry.normalisedEffect, 4), fmt(patched.patchedOutput, 4)]
        }),
      },
      {
        caption: 'The causal edge weights',
        header: ['from', 'to', 'weight'],
        rows: edges.map((edge) => [edge.from, edge.to, fmt(edge.weight, 4)]),
      },
    ],
  )
}

const ATTENTION_HEADS = inductionModel.layers.flatMap((layer, l) =>
  layer.map((head, h) => ({ layer: l, head: h, name: head.name })),
)

function attention(D) {
  const head = ATTENTION_HEADS[D.headIndex]
  const target = inductionTargets()[D.targetIndex]
  const measure = { position: target.position, winner: target.expected, loser: INDUCTION_SEQUENCE[target.position] ?? 0 }
  const clean = runModel(inductionModel, INDUCTION_SEQUENCE)
  const params = inductionModel.layers[head.layer][head.head]
  const lastLayer = inductionModel.layers.length - 1
  const metric = logitDifference(clean, measure)

  const qk = circuitShape(qkCircuit(params))
  const ov = circuitShape(ovCircuit(params))
  let factorGap = 0
  for (const input of clean.inputs[0]) {
    const combined = ovWrites(params, input)
    const staged = valueWrites(params, input)
    for (let i = 0; i < combined.length; i++) factorGap = Math.max(factorGap, Math.abs((combined[i] ?? 0) - (staged[i] ?? 0)))
  }

  const pathway =
    head.layer === lastLayer
      ? decomposePathway(inductionModel, clean, { layer: head.layer, head: head.head, position: target.position, measure })
      : null
  const direct = directLogitEffect(inductionModel, clean, head, measure)

  const paths = []
  if (head.layer > 0) {
    for (const via of ATTENTION_HEADS.filter((candidate) => candidate.layer < head.layer)) {
      const source = ablateHeads(inductionModel, INDUCTION_SEQUENCE, [via])
      for (const circuit of ['query', 'key', 'value']) {
        const report = patchPath(inductionModel, clean, source, { from: via, to: head, circuits: [circuit] }, measure)
        paths.push({ via: via.name, circuit, effect: report.effect })
      }
    }
    paths.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
  }

  const inputs = clean.inputs[head.layer]
  const scores = headScores(params, inputs)[target.position] ?? []
  const pattern = headRun(clean, head.layer, head.head).pattern[target.position] ?? []

  return scenario(
    [
      ['head', `${head.name} (layer ${head.layer})`],
      ['the position', `${target.position}: ${INDUCTION_TOKENS[INDUCTION_SEQUENCE[target.position]]} should predict ${INDUCTION_TOKENS[target.expected]}`],
    ],
    [
      ['the metric', fmt(metric, 4), 'the logit difference, clean run'],
      [
        'the split',
        pathway ? fmt(pathway.total, 4) : 'not defined here',
        pathway ? 'the sum of the per-position terms' : 'only a last-layer head splits exactly',
      ],
      [
        'the ablation',
        pathway ? fmt(pathway.measured, 4) : fmt(direct, 4),
        pathway ? 'the same effect, measured by zeroing the head' : 'direct effect, since no exact split exists',
      ],
      [
        'the discrepancy',
        pathway ? fmt(pathway.discrepancy, 12) : '—',
        pathway ? 'total less measured: an identity, so this is zero' : '',
      ],
      ['QK non-zero cells', `${qk.nonZero} of ${qk.cells}`, `largest ${fmt(qk.largest, 4)}, Frobenius ${fmt(qk.frobenius, 4)}`],
      ['OV non-zero cells', `${ov.nonZero} of ${ov.cells}`, `largest ${fmt(ov.largest, 4)}, Frobenius ${fmt(ov.frobenius, 4)}`],
      ['the factorisation', fmt(factorGap, 12), 'W_O(W_V x) less (W_O W_V)x, worst coordinate'],
      ['the strongest path', paths.length > 0 ? `${paths[0].via} → ${paths[0].circuit}` : 'none', paths.length > 0 ? fmt(paths[0].effect, 4) : 'this head has no earlier head'],
    ],
    [
      {
        caption: 'One row per source position: the where, the what, and their product',
        header: ['source', 'token', 'score', 'attention', 'OV write on the readout', 'term'],
        rows: pattern.map((attentionWeight, source) => {
          const writes = dotReadout(params, inputs[source] ?? [], measure)
          return [
            source,
            INDUCTION_TOKENS[INDUCTION_SEQUENCE[source] ?? 0],
            fmt(scores[source] ?? 0, 4),
            fmt(attentionWeight, 4),
            fmt(writes, 4),
            fmt(attentionWeight * writes, 4),
          ]
        }),
      },
      pathway
        ? {
            caption: 'The terms of the decomposition, which sum to the head’s effect',
            header: ['source', 'attention', 'writes', 'term'],
            rows: pathway.terms.map((term) => [term.source, fmt(term.attention, 4), fmt(term.writes, 4), fmt(term.term, 4)]),
          }
        : null,
    ].filter(Boolean),
  )
}

/** The OV write of one input, projected on the readout difference the metric uses. */
function dotReadout(params, input, measure) {
  const written = ovWrites(params, input)
  const winner = inductionModel.readout[measure.winner] ?? []
  const loser = inductionModel.readout[measure.loser] ?? []
  let sum = 0
  for (let i = 0; i < written.length; i++) sum += written[i] * ((winner[i] ?? 0) - (loser[i] ?? 0))
  return sum
}

function induction(D) {
  const sequence = buildRepeatedSequence({ block: D.block, repeats: D.repeats, seed: D.seed })
  const composed = inductionReport(sequence, { variant: 'composed', temperature: D.temperature })
  const ablated = inductionReport(sequence, { variant: 'ablated', temperature: D.temperature })
  const active = Math.min(D.selected, sequence.length - 1)
  const prediction = predictNext(sequence, active, { variant: D.variant, temperature: D.temperature })
  const matches = matchingPositions(sequence, active)
  const curve = accuracyByRepeats({ block: D.block, seed: D.seed, temperature: D.temperature }, [2, 3, 4])
  const ablatedCurve = accuracyByRepeats({ block: D.block, seed: D.seed, temperature: D.temperature, variant: 'ablated' }, [2, 3, 4])

  return scenario(
    [
      ['block', D.block],
      ['repeats', D.repeats],
      ['temperature', fmt(D.temperature, 2)],
      ['seed', D.seed],
      ['the sequence', sequence.map((token) => TOKENS[token]).join(' ')],
    ],
    [
      ['composed accuracy', `${fmt(composed.accuracy * 100, 1)}%`, `${composed.correct} of ${composed.predictable} predictable positions`],
      ['ablated accuracy', `${fmt(ablated.accuracy * 100, 1)}%`, 'the same run with the previous-token head zeroed'],
      ['chance', `${fmt(composed.chance * 100, 1)}%`, 'a uniform guess over the block'],
      ['the position read', `${active}: ${TOKENS[sequence[active]]}`, `${matches.length} earlier occurrence(s)`],
      ['prediction', TOKENS[prediction.token] ?? '?', `attention on the winner ${fmt(prediction.confidence, 4)}`],
      ['the next token', TOKENS[sequence[active + 1]] ?? '—', 'what actually follows'],
    ],
    [
      {
        caption: 'Accuracy against the number of repeats',
        header: ['repeats', 'composed', 'ablated', 'predictable positions'],
        rows: curve.map((point, index) => [
          point.repeats,
          fmt(point.accuracy, 4),
          fmt(ablatedCurve[index]?.accuracy ?? 0, 4),
          point.predictable,
        ]),
      },
    ],
  )
}

const CIRCUIT_UNIVERSE = allEdgeIds(inductionModel)
const CIRCUIT_TRUTH = inductionCircuitEdges()

function circuit(D) {
  const target = inductionTargets()[D.targetIndex]
  const corruptedAt = sitePosition(target, D.site)
  const altSite = D.site === 'occurrence' ? 'successor' : 'occurrence'
  const altAt = sitePosition(target, altSite)
  const edited = corruptTokens(INDUCTION_SEQUENCE, [{ position: corruptedAt, token: D.replacement }])
  const clean = runModel(inductionModel, INDUCTION_SEQUENCE)
  const corrupted = runModel(inductionModel, edited)
  const measure = { position: target.position, winner: target.expected, loser: INDUCTION_SEQUENCE[target.position] ?? 0 }
  const gap = logitDifference(clean, measure) - logitDifference(corrupted, measure)

  const scores = attributeEdges(inductionModel, clean, corrupted, measure).sort(
    (a, b) => Math.abs(b.score) - Math.abs(a.score),
  )
  const search = discoverCircuit(inductionModel, clean, corrupted, measure, {
    threshold: D.threshold,
    maxSteps: CIRCUIT_UNIVERSE.length,
  })
  const altSearch = discoverCircuit(inductionModel, clean, runModel(inductionModel, corruptTokens(INDUCTION_SEQUENCE, [{ position: altAt, token: D.replacement }])), measure, {
    threshold: D.threshold,
    maxSteps: CIRCUIT_UNIVERSE.length,
  })
  const truth = graphQuality(inductionModel, clean, corrupted, measure, CIRCUIT_TRUTH)

  const found = CIRCUIT_TRUTH.filter((edge) => search.discovered.includes(edge))
  const altFound = CIRCUIT_TRUTH.filter((edge) => altSearch.discovered.includes(edge))
  const union = CIRCUIT_TRUTH.filter((edge) => search.discovered.includes(edge) || altSearch.discovered.includes(edge))
  const missed = CIRCUIT_TRUTH.filter((edge) => !search.discovered.includes(edge))
  const extra = search.discovered.filter((edge) => !CIRCUIT_TRUTH.includes(edge))

  return scenario(
    [
      ['the behaviour', `position ${target.position}: ${INDUCTION_TOKENS[INDUCTION_SEQUENCE[target.position]] ?? '?'} should predict ${INDUCTION_TOKENS[target.expected] ?? '?'}`],
      ['the corruption', `${INDUCTION_TOKENS[D.replacement] ?? '?'} at position ${corruptedAt}, the ${corruptionSite(D.site).role}`],
      ['the threshold', fmt(D.threshold, 2)],
      ['the graph', `${CIRCUIT_UNIVERSE.length} edges`],
    ],
    [
      ['the behavioural gap', fmt(gap, 4), 'clean metric less corrupted'],
      ['the circuit found', `${search.discoveredEdges} edges`, `at threshold ${fmt(D.threshold, 2)}`],
      ['the cost', `${search.passes} runs`, 'completed forward passes this search needed'],
      ['needed and found', `${found.length} of ${CIRCUIT_TRUTH.length}`, 'the edges the wiring needs, from this corruption'],
      ['missed', `${missed.length}`, 'needed here, but invisible to an intervention that leaves that half alone'],
      ['extra', `${extra.length}`, 'in the answer but not in the wiring'],
      ['the other corruption', `${altFound.length} of ${CIRCUIT_TRUTH.length}`, `the ${corruptionSite(altSite).role}, erased at position ${altAt}`],
      ['both together', `${union.length} of ${CIRCUIT_TRUTH.length}`, 'the union of the two answers is the circuit'],
      ['the wiring, graded', `${fmt(truth.faithfulness * 100, 1)}% faithful`, `and ${fmt(truth.completeness * 100, 1)}% complete`],
    ],
    [
      {
        caption: 'The edge scores, before any deletion',
        header: ['edge', 'with', 'without', 'score', 'needed'],
        rows: scores.map((entry) => [
          entry.edge.name,
          fmt(entry.withEdge, 4),
          fmt(entry.withoutEdge, 4),
          fmt(entry.score, 4),
          CIRCUIT_TRUTH.includes(entry.edge.id) ? 'yes' : '—',
        ]),
      },
      {
        caption: 'The pruning, step by step',
        header: ['deleted', 'score', 'edges left', 'faithfulness', 'completeness'],
        rows: search.steps.map((step) => [
          step.removed.edge.name,
          fmt(step.removed.score, 4),
          step.edges,
          fmt(step.faithfulness, 4),
          fmt(step.completeness, 4),
        ]),
      },
      {
        caption: 'The answer, edge by edge, against both corruptions',
        header: ['edge', 'in the wiring', 'this answer', 'the other corruption'],
        rows: [
          ...CIRCUIT_TRUTH.map((edge) => [
            edgeNames(inductionModel, [edge])[0] ?? edge,
            'needed',
            search.discovered.includes(edge) ? 'found' : 'missed',
            altSearch.discovered.includes(edge) ? 'found' : 'missed',
          ]),
          ...extra.map((edge) => [
            edgeNames(inductionModel, [edge])[0] ?? edge,
            'not needed',
            'kept anyway',
            altSearch.discovered.includes(edge) ? 'kept anyway' : '—',
          ]),
        ],
      },
      {
        caption: 'The nodes in the answer',
        header: ['node'],
        rows: nodesInGraph(inductionModel, search.discovered).map((node) => [node.name]),
      },
    ],
  )
}

const IOI_PROMPTS = {
  paper: { tokens: IOI_SEQUENCE, measure: IOI_MEASURE },
  mirror: { tokens: IOI_MIRROR_SEQUENCE, measure: IOI_MIRROR_MEASURE },
}

function ioi(D) {
  const { tokens, measure } = IOI_PROMPTS[D.prompt]
  const workflow = ioiWorkflow(ioiModel, tokens, measure)
  const clean = runModel(ioiModel, tokens)
  const logits = clean.logits[measure.position] ?? []
  const predicted = logits.indexOf(Math.max(...logits))

  return scenario(
    [
      ['the prompt', tokens.map((token) => IOI_TOKENS[token]).join(' ')],
      ['the measure', `${IOI_TOKENS[measure.winner]} less ${IOI_TOKENS[measure.loser]} at position ${measure.position}`],
    ],
    [
      ['the prediction', IOI_TOKENS[predicted] ?? '?', 'the argmax token'],
      ['the circuit found', workflow.discovered.join(', ') || 'nothing', 'the four steps, in order'],
      ['the clean metric', fmt(workflow.criteria.clean, 4), 'the logit difference, untouched'],
      ['with the circuit ablated', fmt(workflow.criteria.afterCircuitAblation, 4), 'everything the four steps named, zeroed'],
      ['completeness', `${fmt(workflow.criteria.completeness * 100, 1)}%`, 'the share of the behaviour the circuit accounts for'],
      ['redundancy', workflow.criteria.redundancy.eachAlone.map((value) => fmt(value, 4)).join(' + '), `both together ${fmt(workflow.criteria.redundancy.bothTogether, 4)}`],
    ],
    [
      ...workflow.steps.map((step) => ({
        caption: `${step.title} — ${step.question}`,
        header: ['intervention', 'effect', 'share', 'found'],
        rows: step.results.map((result) => {
          const via = result.via ? `${result.via.name} via ${result.circuits?.join(', ') ?? ''}` : ''
          return [via ? `${result.target.name} ← ${via}` : result.target.name, fmt(result.effect, 4), fmt(result.share, 4), step.found.includes(result.target.name) ? 'yes' : '—']
        }),
      })),
      {
        caption: 'Minimality: every member ablated alone',
        header: ['member', 'effect', 'share'],
        rows: workflow.criteria.minimality.map((entry) => [
          entry.target.name,
          fmt(entry.effect, 4),
          fmt(entry.share, 4),
        ]),
      },
    ],
  )
}

const RUNNERS = { superposition, autoencoder, patching, attention, induction, circuit, ioi }
const SCENARIOS = {
  superposition: SUPERPOSITION_DEFAULTS,
  autoencoder: AUTOENCODER_DEFAULTS,
  patching: PATCHING_DEFAULTS,
  attention: ATTENTION_DEFAULTS,
  induction: INDUCTION_DEFAULTS,
  circuit: CIRCUIT_DEFAULTS,
  ioi: IOI_DEFAULTS,
}

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
  if (options.labs.length === 0 && options.list) return options
  return options
}

function csv(value) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function text(lab, result) {
  const lines = []
  lines.push(`${lab.name} — ${lab.blurb}`)
  lines.push(`  settings  ${result.settings.map(([key, value]) => `${key}: ${value}`).join(' · ')}`)
  lines.push('')
  // A value wider than the column would otherwise run straight into its note.
  const width = Math.max(18, ...result.stats.map(([, value]) => String(value).length)) + 2
  for (const [name, value, note] of result.stats) {
    lines.push(`  ${name.padEnd(30)}${String(value).padEnd(width)}${note ?? ''}`.trimEnd())
  }
  for (const table of result.tables) {
    lines.push('')
    lines.push(`  ${table.caption}`)
    const cells = [table.header, ...table.rows].map((row) => row.map(String))
    const widths = table.header.map((_, column) =>
      Math.max(...cells.map((row) => (row[column] ?? '').length)) + 2,
    )
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
    const settings = { ...SCENARIOS[id] }
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
    for (const row of rows) console.log(row.map(csv).join(','))
  }
}

main()
