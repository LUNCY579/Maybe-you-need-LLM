import { describe, expect, it } from 'vitest'
import {
  agreeShare,
  buildQuestions,
  consistencySweep,
  effectiveLooks,
  expectedMajorityRate,
  expectedRepeatAgreement,
  interLabelerAgreement,
  labelQuestion,
  leanSweep,
  lookCorrelation,
  majorityProbability,
  readReward,
  repeatAgreementCurve,
  rightSide,
  trainPolicy,
  type Labeler,
} from './preference'

function labeler(over: Partial<Labeler> = {}): Labeler {
  return { id: 'l', agreeRate: 0.6, consistency: 0.5, looks: 3, ...over }
}

describe('one labeler, two looks', () => {
  it('gives the repeat-agreement rate in closed form', () => {
    expect(expectedRepeatAgreement(labeler({ agreeRate: 0.6, consistency: 0.8 }))).toBeCloseTo(0.8272, 8)
    expect(expectedRepeatAgreement(labeler({ consistency: 1 }))).toBe(1)
    expect(expectedRepeatAgreement(labeler({ agreeRate: 0.5, consistency: 0 }))).toBeCloseTo(0.5, 8)
  })

  it('is the sampled agreement of the looks it actually produced', () => {
    const profile = labeler({ agreeRate: 0.65, consistency: 0.7 })
    let agreed = 0
    for (let index = 0; index < 2000; index++) {
      const labels = labelQuestion(profile, index)
      if (labels.choices[0] === labels.choices[1]) agreed++
    }
    expect(agreed / 2000).toBeCloseTo(expectedRepeatAgreement(profile), 1)
  })

  it('correlates the looks by consistency squared and nothing else', () => {
    expect(lookCorrelation(labeler({ consistency: 0.5 }))).toBeCloseTo(0.25, 8)
    expect(lookCorrelation(labeler({ consistency: 0.9, agreeRate: 0.2 }))).toBeCloseTo(0.81, 8)
    for (const lean of [0.1, 0.5, 0.9]) expect(lookCorrelation(labeler({ agreeRate: lean, consistency: 0.4 }))).toBeCloseTo(0.16, 8)
  })

  it('counts a correlated panel as fewer opinions', () => {
    expect(effectiveLooks(labeler({ looks: 5, consistency: 0 }))).toBeCloseTo(5, 8)
    expect(effectiveLooks(labeler({ looks: 5, consistency: 1 }))).toBeCloseTo(1, 8)
    expect(effectiveLooks(labeler({ looks: 5, consistency: 0.5 }))).toBeCloseTo(2.5, 8)
    expect(effectiveLooks(labeler({ looks: 3 }))).toBeLessThan(3)
  })
})

describe('the majority the reward model actually reads', () => {
  it('is the binomial tail at a scatter of looks', () => {
    expect(majorityProbability(0.6, 3)).toBeCloseTo(0.648, 8)
    expect(majorityProbability(0.4, 3)).toBeCloseTo(0.352, 8)
    expect(majorityProbability(0.5, 3)).toBeCloseTo(0.5, 8)
    expect(majorityProbability(0.6, 1)).toBeCloseTo(0.6, 8)
    // An even panel needs a strict majority: three of four, not two.
    expect(majorityProbability(0.6, 4)).toBeCloseTo(0.4752, 8)
    expect(majorityProbability(0, 3)).toBe(0)
    expect(majorityProbability(1, 3)).toBe(1)
  })

  it('amplifies a lean when the looks are independent', () => {
    const scattered = labeler({ agreeRate: 0.6, consistency: 0, looks: 3 })
    expect(expectedMajorityRate(scattered)).toBeCloseTo(0.648, 8)
    expect(expectedMajorityRate(scattered)).toBeGreaterThan(0.6)
    // Five independent looks amplify further: the jury is more sure than the person.
    expect(expectedMajorityRate({ ...scattered, looks: 5 })).toBeCloseTo(0.6826, 4)
  })

  it('reports the bare lean when the looks are one opinion said three times', () => {
    for (const lean of [0.2, 0.4, 0.6, 0.8]) {
      expect(expectedMajorityRate(labeler({ agreeRate: lean, consistency: 1 }))).toBeCloseTo(lean, 8)
    }
  })

  it('is the single look itself at one look', () => {
    expect(expectedMajorityRate(labeler({ agreeRate: 0.62, consistency: 0.77, looks: 1 }))).toBeCloseTo(0.62, 8)
  })

  it('walks from the jury to the person as consistency rises', () => {
    // The finding, in one curve: consistency does not make the lean more
    // learnable, it stops the reward model over-shooting it.
    const rows = [0, 0.25, 0.5, 0.75, 1].map((consistency) =>
      expectedMajorityRate(labeler({ agreeRate: 0.6, consistency, looks: 3 })),
    )
    for (let i = 1; i < rows.length; i++) expect(rows[i]!).toBeLessThan(rows[i - 1]!)
    expect(rows[0]!).toBeGreaterThan(0.6)
    expect(rows[rows.length - 1]!).toBeCloseTo(0.6, 8)
    // And the other side of the tie, where the noise had been helping.
    const other = [0, 1].map((consistency) => expectedMajorityRate(labeler({ agreeRate: 0.4, consistency, looks: 3 })))
    expect(other[0]!).toBeLessThan(0.4)
    expect(other[1]!).toBeCloseTo(0.4, 8)
  })

  it('is flat at a labeler with no lean', () => {
    for (const consistency of [0, 0.5, 1]) expect(expectedMajorityRate(labeler({ agreeRate: 0.5, consistency }))).toBeCloseTo(0.5, 8)
  })
})

describe('the policy that follows the reward model', () => {
  const questions = buildQuestions(240, { seed: 23 })

  it('agrees with the user at the rate the arithmetic predicts', () => {
    for (const consistency of [0, 0.5, 1]) {
      const profile = labeler({ agreeRate: 0.6, consistency })
      const outcome = trainPolicy(profile, questions)
      expect(outcome.sycophancyRate).toBeCloseTo(expectedMajorityRate(profile), 1)
    }
  })

  it('is not the complement of accuracy', () => {
    // Half the users are right: agreeing is then both sycophantic and correct.
    const mixed = buildQuestions(240, { userRightRate: 0.5, seed: 31 })
    const outcome = trainPolicy(labeler({ agreeRate: 0.6 }), mixed)
    expect(outcome.sycophancyRate + outcome.accuracy).toBeGreaterThan(1)
    // And when every user is wrong, the two are complements after all.
    const allWrong = buildQuestions(120, { userRightRate: 0, seed: 31 })
    const strict = trainPolicy(labeler({ agreeRate: 0.6 }), allWrong)
    expect(strict.sycophancyRate + strict.accuracy).toBeCloseTo(1, 8)
  })

  it('collects a reward and a confidence, which are not the same number', () => {
    const sure = trainPolicy(labeler({ agreeRate: 0.95, consistency: 1 }), questions)
    const undecided = trainPolicy(labeler({ agreeRate: 0.5, consistency: 0 }), questions)
    expect(sure.meanReward).toBeGreaterThan(undecided.meanReward)
    expect(sure.meanConfidence).toBeGreaterThan(undecided.meanConfidence)
    expect(sure.meanReward).toBeLessThanOrEqual(1)
  })

  it('reads a tie as dissent, which is the conservative side', () => {
    const read = readReward({ latent: 'agree', choices: ['agree', 'dissent'] })
    expect(read.prefers).toBe('dissent')
    expect(read.faithful).toBe(false)
    expect(read.margin).toBe(0)
    expect(read.reward).toBe(0.5)
  })

  it('is faithful when the count recovered the latent side', () => {
    const labels = labelQuestion(labeler({ consistency: 1, looks: 5 }), 7)
    expect(agreeShare(labels)).toBe(labels.latent === 'agree' ? 1 : 0)
    expect(readReward(labels).faithful).toBe(true)
  })

  it('gives every look the same latent side when the labeler is consistent', () => {
    const labels = labelQuestion(labeler({ consistency: 1, looks: 4 }), 3)
    expect(new Set(labels.choices).size).toBe(1)
    expect(labels.choices[0]).toBe(labels.latent)
    expect(labelQuestion(labeler(), 3).choices).toEqual(labelQuestion(labeler(), 3).choices)
  })
})

describe('the sweeps', () => {
  const questions = buildQuestions(240, { seed: 23 })

  it('prints the sampled line against the exact one', () => {
    const rows = consistencySweep({ agreeRate: 0.6, looks: 3 }, [0, 0.5, 1], questions, { seed: 5 })
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(Math.abs(row.gap)).toBeLessThan(0.08)
      expect(row.expectedSycophancy).toBeCloseTo(expectedMajorityRate(labeler({ agreeRate: 0.6, consistency: row.consistency })), 8)
    }
    expect(rows[2]!.expectedSycophancy).toBeLessThan(rows[0]!.expectedSycophancy)
    expect(rows[0]!.effectiveLooks).toBe(3)
    expect(rows[2]!.effectiveLooks).toBe(1)
    expect(rows[2]!.expectedAgreement).toBe(1)
    expect(rows[0]!.expectedAgreement).toBeCloseTo(0.52, 8)
  })

  it('moves on the lean, which is the axis that decides the outcome', () => {
    const rows = leanSweep({ consistency: 1, looks: 3 }, [0, 0.5, 1], questions, { seed: 5 })
    expect(rows[0]!.sycophancyRate).toBe(0)
    expect(rows[2]!.sycophancyRate).toBe(1)
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.expectedSycophancy).toBeGreaterThan(rows[i - 1]!.expectedSycophancy)
  })

  it('raises the reported agreement while it lowers the sycophancy', () => {
    // The number a team puts on the slide and the number the policy learns run
    // in opposite directions over the same sweep.
    const rows = consistencySweep({ agreeRate: 0.6, looks: 3 }, [0, 0.5, 1], questions, { seed: 5 })
    expect(rows[2]!.expectedAgreement).toBeGreaterThan(rows[0]!.expectedAgreement)
    expect(rows[2]!.expectedSycophancy).toBeLessThan(rows[0]!.expectedSycophancy)
    const curve = repeatAgreementCurve(labeler({ agreeRate: 0.6 }), [0, 0.5, 1])
    expect(curve.map((row) => row.consistency)).toEqual([0, 0.5, 1])
    expect(curve[0]!.expected).toBeCloseTo(0.52, 8)
    expect(curve[1]!.expected).toBeCloseTo(0.64, 8)
    expect(curve[2]!.expected).toBe(1)
  })
})

describe('two labelers', () => {
  it('agree at the rate their leans predict, whatever their consistency', () => {
    const a = labeler({ agreeRate: 0.6, consistency: 1 })
    const b = labeler({ agreeRate: 0.6, consistency: 0 })
    const same = interLabelerAgreement(a, b, { samples: 1000 })
    expect(same.expected).toBeCloseTo(0.6 * 0.6 + 0.4 * 0.4, 8)
    expect(same.observed).toBeCloseTo(same.expected, 1)
    expect(interLabelerAgreement(a, a, { samples: 1000 }).expected).toBeCloseTo(same.expected, 8)
  })

  it('agree less when they lean opposite ways', () => {
    const opposed = interLabelerAgreement(labeler({ agreeRate: 0.8 }), labeler({ agreeRate: 0.2 }), { samples: 1000 })
    expect(opposed.expected).toBeCloseTo(0.32, 8)
    expect(opposed.observed).toBeLessThan(0.5)
  })
})

describe('the questions', () => {
  it('is built at a stated rate of users who happen to be right', () => {
    const none = buildQuestions(100, { userRightRate: 0, seed: 2 })
    expect(none.some((question) => question.userIsRight)).toBe(false)
    const half = buildQuestions(200, { userRightRate: 0.5, seed: 2 })
    expect(half.filter((question) => question.userIsRight).length).toBeGreaterThan(80)
    for (const question of half) expect(rightSide(question)).toBe(question.userIsRight ? 'agree' : 'dissent')
  })
})
