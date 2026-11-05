/**
 * The IOI toy circuit and the four-step procedure that finds it, tested.
 *
 * The claims here come in three grades, and the tests keep them apart:
 *
 * 1. *Behaviour of the toy.* It answers the prompt with the indirect object, and
 *    the mirrored prompt with the other name. These are properties of the wiring,
 *    established by running it — not by asserting the wiring, which would be circular.
 * 2. *What the procedure returns.* Step one finds only the heads that write the
 *    answer; the upstream heads score exactly zero there, and "exactly" is the
 *    point — their writes land in dimensions the readout never looks at. Each step's
 *    nonzero path effects are confined to the one circuit that could carry them, so
 *    a failure would say which link in the chain broke.
 * 3. *Identities.* The duplicate head's whole effect equals its key-path effect into
 *    the inhibitor, because nothing else in the model reads what it writes; the
 *    inhibition head's equals the sum of its two query paths, for the same reason.
 *    These are checks on the *decomposition*, not on the paper.
 *
 * Two numbers are deliberately not tested for agreement with the paper: the logit
 * difference (our toy's scale is its own) and the redundancy of the two movers (see
 * `it('makes the toy’s redundancy limitation explicit', ...)`).
 */

import { describe, expect, it } from 'vitest'
import { ablateHeads, logitDifference, patchPath, runModel } from './attention'
import {
  IOI_BLOCKS,
  IOI_DIMENSION,
  IOI_DIMENSION_NAMES,
  IOI_HEADS,
  IOI_MIRROR_MEASURE,
  IOI_MIRROR_SEQUENCE,
  IOI_MEASURE,
  IOI_ROLES,
  IOI_SEQUENCE,
  IOI_TOKENS,
  PAPER_FIGURES,
  ablatedMetric,
  buildIoiModel,
  ioiAttention,
  ioiModel,
  ioiWorkflow,
  publishedHeadCount,
  publishedIoICircuit,
} from './ioi'

/* ------------------------------------------------------------------ fixtures */

const clean = runModel(ioiModel, IOI_SEQUENCE)
const metric = logitDifference(clean, IOI_MEASURE)
const workflow = ioiWorkflow()
const mirror = ioiWorkflow(ioiModel, IOI_MIRROR_SEQUENCE, IOI_MIRROR_MEASURE)

const step = (id: 'direct' | 'attention' | 'upstream') => {
  const found = workflow.steps.find((candidate) => candidate.id === id)
  if (!found) throw new RangeError(`no step ${id}`)
  return found
}

/** The result of one step, addressed the way a reader of the table would. */
const find = (
  results: { target: { name: string }; via?: { name: string }; circuits?: string[]; effect: number; share: number }[],
  via: string | undefined,
  target: string,
  circuit: string | undefined,
) => {
  const matches = results.filter(
    (result) =>
      result.target.name === target &&
      (via === undefined || result.via?.name === via) &&
      (circuit === undefined || result.circuits?.join() === circuit),
  )
  if (matches.length !== 1) throw new RangeError(`find: ${matches.length} results match ${via} -> ${target} (${circuit}).`)
  return matches[0]
}

const predict = (run: { logits: number[][] }, position: number): number => {
  const row = run.logits[position]
  return row.reduce((best, value, index) => (value > row[best] ? index : best), 0)
}

/* ------------------------------------------------------------- 1. the toy's behaviour */

describe('the compressed prompt', () => {
  it('is the template the paper uses, with the subject’s name the one that repeats', () => {
    expect(IOI_SEQUENCE.map((token) => IOI_TOKENS[token]).join(' ')).toBe('when mary and john store john gave drink to')
    expect(IOI_SEQUENCE[IOI_ROLES.s1]).toBe(IOI_SEQUENCE[IOI_ROLES.s2])
    expect(IOI_SEQUENCE[IOI_ROLES.io]).not.toBe(IOI_SEQUENCE[IOI_ROLES.s1])
    expect(IOI_MEASURE.position).toBe(IOI_SEQUENCE.length - 1)
  })

  it('names every stream dimension the wiring uses', () => {
    expect(IOI_DIMENSION_NAMES.length).toBe(IOI_DIMENSION)
    expect(IOI_DIMENSION_NAMES.slice(0, IOI_BLOCKS.name)).toEqual([...IOI_TOKENS])
    // The name and marker slots get their labels from the same constants the wiring
    // does, so the check is that none of them fell through to the fallback and that
    // no two of them collided on one dimension. (The two name slots are *called*
    // `mary` and `john`, deliberately: a marker block that repeated a token label
    // would be a wiring bug.)
    expect(IOI_DIMENSION_NAMES.slice(IOI_BLOCKS.name).filter((label) => /^dimension /.test(label))).toEqual([])
    expect(new Set(IOI_DIMENSION_NAMES.slice(IOI_BLOCKS.name)).size).toBe(IOI_DIMENSION - IOI_BLOCKS.name)
  })

  it('has the four heads at the layers and indices IOI_HEADS claims', () => {
    const names: Record<string, string> = {
      duplicateToken: 'duplicate-token head',
      sInhibition: 'S-inhibition head',
      nameMover: 'name mover head',
      backup: 'backup name mover',
    }
    for (const [key, target] of Object.entries(IOI_HEADS)) {
      expect(ioiModel.layers[target.layer][target.head].name).toBe(names[key])
    }
    expect(ioiModel.layers.length).toBe(3)
    // Four heads against the paper’s twenty-six: the toy demonstrates the
    // procedure’s order of questions, not GPT-2’s size.
    expect(clean.heads.length).toBe(4)
  })

  it('answers with the indirect object, and with the other name when the prompt is mirrored', () => {
    expect(metric).toBeGreaterThan(6)
    expect(predict(clean, IOI_MEASURE.position)).toBe(IOI_SEQUENCE[IOI_ROLES.io])
    const mirrored = runModel(ioiModel, IOI_MIRROR_SEQUENCE)
    expect(predict(mirrored, IOI_MIRROR_MEASURE.position)).toBe(IOI_MIRROR_SEQUENCE[IOI_ROLES.io])
    expect(logitDifference(mirrored, IOI_MIRROR_MEASURE)).toBeGreaterThan(6)
  })

  it('puts the inhibition head on the doubled name and the movers on the answer', () => {
    const at = new Map(ioiAttention().map((head) => [head.name, head.atEnd]))
    expect(at.get('S-inhibition head')?.[IOI_ROLES.s2]).toBeGreaterThan(0.99)
    expect(at.get('name mover head')?.[IOI_ROLES.io]).toBeGreaterThan(0.999)
    expect(at.get('backup name mover')?.[IOI_ROLES.io]).toBeGreaterThan(0.9)
    // The movers must not be reading the subject at all, at either of its positions.
    for (const name of ['name mover head', 'backup name mover']) {
      const row = at.get(name) ?? []
      expect(row[IOI_ROLES.s1] + row[IOI_ROLES.s2]).toBeLessThan(0.02)
    }
  })

  it('answers the mirrored prompt with the mirrored attention', () => {
    const at = new Map(ioiAttention(ioiModel, IOI_MIRROR_SEQUENCE).map((head) => [head.name, head.atEnd]))
    expect(at.get('S-inhibition head')?.[IOI_ROLES.s2]).toBeGreaterThan(0.99)
    expect(at.get('name mover head')?.[IOI_ROLES.io]).toBeGreaterThan(0.999)
  })

  it('loses the answer, not just the confidence, when the inhibition head is removed', () => {
    const ablated = ablateHeads(ioiModel, IOI_SEQUENCE, [IOI_HEADS.sInhibition])
    expect(logitDifference(ablated, IOI_MEASURE)).toBeLessThan(0)
    expect(predict(ablated, IOI_MEASURE.position)).toBe(IOI_SEQUENCE[IOI_ROLES.s1])
  })

  it('still answers correctly with the duplicate-token head removed, but far less confidently', () => {
    const ablated = ablateHeads(ioiModel, IOI_SEQUENCE, [IOI_HEADS.duplicateToken])
    expect(predict(ablated, IOI_MEASURE.position)).toBe(IOI_SEQUENCE[IOI_ROLES.io])
    expect(logitDifference(ablated, IOI_MEASURE)).toBeLessThan(metric / 2)
    // Without the mark the inhibition is a smear over both names, so the subject
    // closes the gap rather than overtaking it.
    const logits = ablated.logits[IOI_MEASURE.position]
    expect(logits[IOI_SEQUENCE[IOI_ROLES.s1]]).toBeGreaterThan(1)
  })

  it('scores its own ablation with no targets as the clean metric', () => {
    expect(ablatedMetric(ioiModel, IOI_SEQUENCE, [], IOI_MEASURE)).toBe(metric)
  })
})

/* --------------------------------------------------------- 2. the four steps */

describe('step 1: which heads affect the output directly', () => {
  it('finds the two movers and nothing else', () => {
    expect(step('direct').found).toEqual(['name mover head', 'backup name mover'])
  })

  it('gives the upstream heads exactly zero, not merely a small number', () => {
    for (const name of ['duplicate-token head', 'S-inhibition head']) {
      expect(find(step('direct').results, undefined, name, undefined).effect).toBe(0)
    }
  })

  it('splits the metric between the movers exactly', () => {
    const mover = find(step('direct').results, undefined, 'name mover head', undefined)
    const backup = find(step('direct').results, undefined, 'backup name mover', undefined)
    expect(mover.share + backup.share).toBeCloseTo(1, 12)
    expect(mover.share).toBeGreaterThan(backup.share)
  })

  it('makes the toy’s redundancy limitation explicit', () => {
    // The paper’s §3.4 result is that the backups *take over*: ablate the name
    // movers and the backups’ attention on the object rises. Here the two movers are
    // one circuit at two gains, so their shares add to exactly 1 and nothing takes
    // over — the toy shows a weaker copy, and the screen has to say so.
    expect(workflow.criteria.redundancy.eachAlone.reduce((a, b) => a + b, 0)).toBeCloseTo(
      workflow.criteria.redundancy.bothTogether,
      12,
    )
    expect(workflow.criteria.redundancy.bothTogether).toBeCloseTo(1, 12)
  })
})

describe('step 2: which heads choose where those heads look', () => {
  it('finds the inhibition head through the movers’ queries', () => {
    expect(step('attention').found).toEqual(['S-inhibition head'])
    for (const mover of ['name mover head', 'backup name mover']) {
      expect(Math.abs(find(step('attention').results, 'S-inhibition head', mover, 'query').share)).toBeGreaterThan(0.1)
    }
  })

  it('finds nothing on the key or value side, exactly', () => {
    for (const result of step('attention').results) {
      if (result.circuits?.join() === 'query') continue
      expect(result.effect).toBe(0)
    }
  })

  it('cannot see the duplicate-token head from here, which is why step 3 exists', () => {
    for (const mover of ['name mover head', 'backup name mover']) {
      for (const circuit of ['query', 'key', 'value']) {
        expect(find(step('attention').results, 'duplicate-token head', mover, circuit).effect).toBe(0)
      }
    }
  })

  it('reverses the answer when it removes the inhibition', () => {
    const intoMover = find(step('attention').results, 'S-inhibition head', 'name mover head', 'query')
    expect(intoMover.effect).toBeLessThan(-metric)
  })
})

describe('step 3: what those heads read', () => {
  it('finds the duplicate-token head through the inhibition head’s keys', () => {
    expect(step('upstream').found).toEqual(['duplicate-token head'])
    expect(Math.abs(find(step('upstream').results, 'duplicate-token head', 'S-inhibition head', 'key').share)).toBeGreaterThan(0.5)
  })

  it('finds nothing else, exactly', () => {
    for (const result of step('upstream').results) {
      if (result.circuits?.join() === 'key' && result.via?.name === 'duplicate-token head') continue
      expect(result.effect).toBe(0)
    }
  })

  it('asks each step only about the heads the step before it found', () => {
    // The order of questions is the one thing carried in from the paper, so it is
    // worth pinning: step 2’s targets are step 1’s findings, and step 3’s are step 2’s.
    const targets = (results: { target: { name: string } }[]) => [...new Set(results.map((r) => r.target.name))]
    expect(targets(step('attention').results)).toEqual(step('direct').found)
    expect(targets(step('upstream').results)).toEqual(step('attention').found)
  })
})

describe('the four steps together', () => {
  it('arrives at all four heads', () => {
    expect(workflow.discovered).toEqual(['name mover head', 'backup name mover', 'S-inhibition head', 'duplicate-token head'])
  })

  it('is complete: ablating the discovered circuit leaves exactly nothing', () => {
    expect(workflow.criteria.afterCircuitAblation).toBe(0)
    expect(workflow.criteria.completeness).toBe(1)
    expect(workflow.criteria.clean).toBe(metric)
  })

  it('is minimal: every member of the circuit is needed', () => {
    for (const member of workflow.criteria.minimality) {
      expect(Math.abs(member.share)).toBeGreaterThan(0.2)
    }
  })

  it('gives the mirrored prompt the same circuit and the same numbers', () => {
    // Nothing in the wiring is specific to which of the two names is doubled, so a
    // prompt swap has to leave the procedure’s output bit-for-bit the same. A
    // memorised answer would not survive this.
    expect(mirror.discovered).toEqual(workflow.discovered)
    expect(mirror.criteria.completeness).toBeCloseTo(workflow.criteria.completeness, 12)
    mirror.steps.forEach((entry, index) => {
      expect(entry.found).toEqual(workflow.steps[index].found)
      entry.results.forEach((result, i) => {
        expect(result.effect).toBeCloseTo(workflow.steps[index].results[i].effect, 12)
      })
    })
  })

  it('is deterministic and independent of a rebuilt model', () => {
    const again = ioiWorkflow(buildIoiModel(), IOI_SEQUENCE, IOI_MEASURE)
    expect(again.discovered).toEqual(workflow.discovered)
    expect(again.criteria.clean).toBe(workflow.criteria.clean)
  })
})

/* ------------------------------------------------------------- 3. identities */

describe('the decomposition is exhaustive on this toy', () => {
  it('gives the duplicate head’s whole effect as its key path into the inhibition head', () => {
    // Dimensions 11 and 12 are written by the duplicate head and read by nothing
    // but the inhibition head’s keys, so the two interventions are the same
    // intervention and must report the same number.
    const ablation = ablatedMetric(ioiModel, IOI_SEQUENCE, [IOI_HEADS.duplicateToken], IOI_MEASURE) - metric
    const keyPath = find(step('upstream').results, 'duplicate-token head', 'S-inhibition head', 'key').effect
    expect(keyPath).toBeCloseTo(ablation, 12)
  })

  it('gives the inhibition head’s whole effect as the sum of its two query paths', () => {
    const ablation = ablatedMetric(ioiModel, IOI_SEQUENCE, [IOI_HEADS.sInhibition], IOI_MEASURE) - metric
    const paths = ['name mover head', 'backup name mover'].map(
      (mover) => find(step('attention').results, 'S-inhibition head', mover, 'query').effect,
    )
    expect(paths[0] + paths[1]).toBeCloseTo(ablation, 9)
  })

  it('reproduces an ablation as a path patch when there is no other route', () => {
    // A third way of saying the same thing, from the other side: patching the
    // ablated duplicate head into the inhibition head’s keys, and nothing else, is
    // what ablating it does.
    const source = ablateHeads(ioiModel, IOI_SEQUENCE, [IOI_HEADS.duplicateToken])
    const direct = patchPath(ioiModel, clean, source, { from: IOI_HEADS.duplicateToken, to: IOI_HEADS.sInhibition, circuits: ['key'] }, IOI_MEASURE)
    const whole = patchPath(ioiModel, clean, source, { from: IOI_HEADS.duplicateToken, to: IOI_HEADS.sInhibition, circuits: ['qk'] }, IOI_MEASURE)
    expect(whole.effect).toBeCloseTo(direct.effect, 12)
  })
})

/* -------------------------------------------------------------- the quoted data */

describe('the published circuit, as quoted', () => {
  it('lists every head the paper counts', () => {
    const published = publishedIoICircuit()
    expect(publishedHeadCount()).toBe(published.heads)
    expect(published.classes).toBe(published.circuit.length)
  })

  it('names heads the way the paper writes them, without repeating one', () => {
    const all = publishedIoICircuit().circuit.flatMap((entry) => [...entry.heads, ...entry.fuzzy])
    for (const head of all) expect(head).toMatch(/^\d+\.\d+$/)
    expect(new Set(all).size).toBe(all.length)
  })

  it('keeps the quoted figures out of the computed ones', () => {
    // PAPER_FIGURES is transcription, not measurement: nothing in this module reads
    // it, and the toy’s own scale is its own.
    const published = publishedIoICircuit()
    expect(published.model).toContain('GPT-2 small')
    expect(PAPER_FIGURES.source).toBe('arXiv:2211.00593')
    expect(metric).not.toBeCloseTo(PAPER_FIGURES.meanLogitDifference, 1)
    expect(workflow.criteria.completeness).not.toBe(PAPER_FIGURES.circuitShareOfPerformance)
  })

  it('measures a logit difference of the shape the paper describes', () => {
    // Not a claim about GPT-2’s scale, only that the metric really is
    // indirect object against subject at the final position.
    expect(IOI_MEASURE.winner).toBe(IOI_SEQUENCE[IOI_ROLES.io])
    expect(IOI_MEASURE.loser).toBe(IOI_SEQUENCE[IOI_ROLES.s1])
    expect(IOI_MIRROR_MEASURE.winner).toBe(IOI_MIRROR_SEQUENCE[IOI_ROLES.io])
  })
})
