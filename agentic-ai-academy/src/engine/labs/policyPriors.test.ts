import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRIOR_LEARNING_CONFIG,
  DEFAULT_SELF_GENERATED_CONFIG,
  LOOP_WORLD,
  PRETRAINING_FAMILY,
  TRANSFER_FAMILIES,
  buildDemonstrationPool,
  collectSelfGeneratedTransitions,
  decisionCells,
  divergence,
  evaluateInWorld,
  fitModel,
  greedyPolicyFromQ,
  naiveDynamics,
  pairKey,
  planInsideModel,
  probeRealDynamics,
  runPriorTransferLab,
  runSelfGeneratedLoop,
  scoreModelAgainstProbe,
  trainOnWorld,
  trueDynamics,
  type GenerationRow,
  type LearnedModel,
  type PriorLearningConfig,
} from './policyPriors'
import { DEFAULT_WORLD_MODEL_CONFIG } from './worldModel'

const familyById = (id: string) => {
  const family = TRANSFER_FAMILIES.find((entry) => entry.id === id)
  if (!family) throw new Error(`unknown family ${id}`)
  return family
}

const byFamilyId = (id: string) => {
  const entry = runPriorTransferLab(DEFAULT_PRIOR_LEARNING_CONFIG).families.find((candidate) => candidate.family.id === id)
  if (!entry) throw new Error(`unknown family ${id}`)
  return entry
}

/** Everything a generation row reports except which arm produced it. */
const fingerprint = (row: GenerationRow) => {
  const { arm: _arm, ...rest } = row
  return rest
}

describe('Lab C · pretrained prior versus learning from scratch', () => {
  it('Ch. 7 and Ch. 23: the earliest of the vision-language-action models, and the clearest statement of what web-scale pretraining buys a robot.', () => {
    const run = runPriorTransferLab(DEFAULT_PRIOR_LEARNING_CONFIG)
    // The prior is earned by interaction somewhere else, not handed over as an answer.
    expect(run.pretraining.interactionSteps).toBeGreaterThan(0)
    expect(run.pretraining.episodesToThreshold).not.toBeNull()

    // On the family that shares the pretraining structure, that earned table converts
    // into fewer target-family interactions: the prior is already at the threshold
    // before a single training episode on the target has run.
    const aligned = byFamilyId('same-structure-new-pose')
    expect(aligned.prior.episodesToThreshold).toBe(0)
    expect(aligned.prior.successAtBudget).toBeGreaterThanOrEqual(DEFAULT_PRIOR_LEARNING_CONFIG.successThreshold)
    expect(aligned.stepSaving).toBeGreaterThan(0)
    expect(aligned.negativeTransfer).toBe(false)
    expect(aligned.speedup).not.toBeNull()
    expect(aligned.speedup as number).toBeGreaterThan(1)
    expect(aligned.scratch.episodesToThreshold as number).toBeGreaterThan(0)

    // The same pretraining is a liability on the mirrored family, so the measurement
    // is not a one-sided claim about what pretraining buys.
    const mirrored = byFamilyId('mirrored-goal')
    expect(mirrored.negativeTransfer).toBe(true)
    expect(mirrored.stepSaving).toBeLessThan(0)
    expect(mirrored.prior.stepsToThreshold as number).toBeGreaterThan(mirrored.scratch.stepsToThreshold as number)

    expect(run.helped).toContain('same-structure-new-pose')
    expect(run.hurt).toContain('mirrored-goal')
    expect(run.signByFamily['mirrored-goal']).toBe('hurts')
    expect(run.signByFamily['same-structure-new-pose']).toBe('helps')
  })

  it('the prior is only an initialisation: at strength 0 it is indistinguishable from learning from scratch', () => {
    const run = runPriorTransferLab({ ...DEFAULT_PRIOR_LEARNING_CONFIG, priorStrength: 0 })
    for (const entry of run.families) {
      expect(entry.prior.stepsToThreshold).toBe(entry.scratch.stepsToThreshold)
      expect(entry.prior.episodesToThreshold).toBe(entry.scratch.episodesToThreshold)
      expect(entry.prior.curve).toEqual(entry.scratch.curve)
      expect(entry.prior.policy).toEqual(entry.scratch.policy)
      expect(entry.negativeTransfer).toBe(false)
      expect(entry.stepSaving).toBe(0)
    }
  })

  it('the transferred table changes the starting policy, and helps only where its structure carries over', () => {
    const config = DEFAULT_PRIOR_LEARNING_CONFIG
    const pretraining = trainOnWorld(PRETRAINING_FAMILY.world, config, { arm: 'scratch', initialQ: null })

    const aligned = familyById('same-structure-new-pose')
    const alignedPrior = trainOnWorld(aligned.world, config, { arm: 'prior', initialQ: pretraining.q })
    const alignedScratch = trainOnWorld(aligned.world, config, { arm: 'scratch', initialQ: null })
    // At episode 0 nothing has been learned on the target: the gap is the prior alone.
    expect(alignedPrior.curve[0].episode).toBe(0)
    expect(alignedPrior.curve[0].successRate).toBeGreaterThan(alignedScratch.curve[0].successRate)

    // The initial policy of the prior agent is the pretraining greedy policy, not the
    // all-zero one, and it disagrees with it on most of the grid.
    const zeros = Object.fromEntries(decisionCells(aligned.world).map((cell) => [`${cell[0]},${cell[1]}`, [0, 0, 0, 0]]))
    const transferredPolicy = greedyPolicyFromQ(aligned.world, pretraining.q)
    const zeroPolicy = greedyPolicyFromQ(aligned.world, zeros)
    const disagreements = Object.keys(transferredPolicy).filter((key) => transferredPolicy[key] !== zeroPolicy[key]).length
    expect(Object.keys(transferredPolicy)).toHaveLength(decisionCells(aligned.world).length)
    expect(disagreements).toBeGreaterThan(Object.keys(transferredPolicy).length / 2)

    // On the mirrored family the same table is no head start at all.
    const mirrored = byFamilyId('mirrored-goal')
    expect(mirrored.prior.curve[0].successRate).toBeLessThanOrEqual(mirrored.scratch.curve[0].successRate)
    expect(mirrored.prior.episodesToThreshold as number).toBeGreaterThan(mirrored.scratch.episodesToThreshold as number)
  })

  it('negative transfer is measured, and it survives a shorter and a longer budget', () => {
    for (const episodes of [80, 150, 240]) {
      const config: PriorLearningConfig = { ...DEFAULT_PRIOR_LEARNING_CONFIG, episodes }
      const run = runPriorTransferLab(config)
      const mirrored = run.families.find((entry) => entry.family.id === 'mirrored-goal')
      expect(mirrored).toBeDefined()
      expect(mirrored!.negativeTransfer).toBe(true)
      expect(mirrored!.stepSaving).toBeLessThan(0)
      // The aligned family keeps the opposite sign at every budget.
      const aligned = run.families.find((entry) => entry.family.id === 'same-structure-new-pose')
      expect(aligned!.negativeTransfer).toBe(false)
      expect(aligned!.stepSaving).toBeGreaterThan(0)
    }
  })

  it('every real-environment interaction is counted exactly once, including the probe', () => {
    const run = runPriorTransferLab(DEFAULT_PRIOR_LEARNING_CONFIG)
    for (const entry of run.families) {
      for (const arm of [entry.prior, entry.scratch]) {
        expect(arm.interactionSteps).toBe(arm.trainingSteps + arm.evaluationSteps)
        expect(arm.trainingSteps).toBeGreaterThan(0)
        expect(arm.evaluationSteps).toBeGreaterThan(0)
        expect(arm.curve.at(-1)?.interactionSteps).toBe(arm.interactionSteps)
        if (arm.reachedThreshold) {
          const steps = arm.stepsToThreshold as number
          expect(steps).toBeGreaterThan(0)
          expect(steps).toBeLessThanOrEqual(arm.interactionSteps)
          const crossing = arm.curve.find((point) => point.episode === arm.episodesToThreshold)
          expect(crossing?.interactionSteps).toBe(steps)
        } else {
          expect(arm.stepsToThreshold).toBeNull()
        }
      }
    }
  })

  it('never reports a threshold crossing that did not happen, and never hides one that did', () => {
    const starved: PriorLearningConfig = { ...DEFAULT_PRIOR_LEARNING_CONFIG, episodes: 10, evalInterval: 5, evalEpisodes: 20 }
    const run = runPriorTransferLab(starved)
    let missed = 0
    for (const entry of run.families) {
      for (const arm of [entry.prior, entry.scratch]) {
        if (arm.reachedThreshold) {
          const point = arm.curve.find((candidate) => candidate.episode === arm.episodesToThreshold)
          expect(point?.successRate).toBeGreaterThanOrEqual(starved.successThreshold)
          expect(arm.successAtBudget).toBeGreaterThanOrEqual(starved.successThreshold)
        } else {
          missed += 1
          expect(arm.successAtBudget).toBeLessThan(starved.successThreshold)
          expect(arm.curve.every((point) => point.successRate < starved.successThreshold)).toBe(true)
        }
      }
    }
    // Some arm must actually miss the threshold, or this only tests the happy path.
    expect(missed).toBeGreaterThan(0)
  })

  it('probes both arms with the same evaluation, so the difference is the policy', () => {
    const config = DEFAULT_PRIOR_LEARNING_CONFIG
    const family = familyById('quarter-turn')
    const pretraining = runPriorTransferLab(config).pretraining
    const scratch = trainOnWorld(family.world, config, { arm: 'scratch', initialQ: null })
    const again = trainOnWorld(family.world, config, { arm: 'scratch', initialQ: null })
    const prior = trainOnWorld(family.world, config, { arm: 'prior', initialQ: pretraining.q })

    expect(scratch.curve).toEqual(again.curve)
    expect(scratch.evaluationSteps).toBe(again.evaluationSteps)
    expect(scratch.trainingSteps).toBe(again.trainingSteps)

    // Both arms are probed on the same schedule: same episodes, same interval, same
    // seed. A gap between the curves can therefore only come from the policy under
    // evaluation, not from a different test being administered to each arm.
    expect(prior.curve.map((point) => point.episode)).toEqual(scratch.curve.map((point) => point.episode))
    expect(prior.curve.length).toBe(scratch.curve.length)

    // Re-running the shared probe by hand on each arm's episode-0 policy reproduces
    // the curve exactly, which is what "same evaluation, different policy" means.
    const probe = (policy: ReturnType<typeof greedyPolicyFromQ>) =>
      evaluateInWorld(family.world, policy, {
        episodes: config.evalEpisodes,
        stepCap: config.stepCap,
        seed: config.seed + 4100,
      })
    const zeros: Record<string, number[]> = Object.fromEntries(
      decisionCells(family.world).map((cell) => [`${cell[0]},${cell[1]}`, [0, 0, 0, 0]]),
    )
    // priorStrength is 1, so a scaled table and the raw transferred table greed the same.
    expect(prior.curve[0].successRate).toBe(probe(greedyPolicyFromQ(family.world, pretraining.q)).successRate)
    expect(scratch.curve[0].successRate).toBe(probe(greedyPolicyFromQ(family.world, zeros)).successRate)
    expect(greedyPolicyFromQ(family.world, pretraining.q)).not.toEqual(greedyPolicyFromQ(family.world, zeros))
  })

  it('is deterministic for a fixed seed and moves when the seed moves', () => {
    const first = runPriorTransferLab(DEFAULT_PRIOR_LEARNING_CONFIG)
    const second = runPriorTransferLab(DEFAULT_PRIOR_LEARNING_CONFIG)
    expect(second).toEqual(first)

    const other = runPriorTransferLab({ ...DEFAULT_PRIOR_LEARNING_CONFIG, seed: 11 })
    expect(other.families[0].prior.curve).not.toEqual(first.families[0].prior.curve)
    expect(other.pretraining.q).not.toEqual(first.pretraining.q)
  })
})

describe('Lab C · self-generated action data', () => {
  it('Ch. 23 §23.2.2: a generalist robot policy trained on self-generated action data — the open-problem version of the world-model lesson.', () => {
    const run = runSelfGeneratedLoop(DEFAULT_SELF_GENERATED_CONFIG)
    const { selfOnly, mixed } = run

    // Both arms boot from the externally supplied demonstrations, identically: same
    // seed, same probe, and generation 0 has no self-generated data to separate them.
    expect(fingerprint(mixed.generations[0])).toEqual(fingerprint(selfOnly.generations[0]))
    expect(selfOnly.generations[0].externalSamples).toBe(run.poolSize)
    expect(selfOnly.generations[0].selfSamples).toBe(0)
    // From generation 1 the arms are no longer the same run.
    expect(fingerprint(mixed.generations[1])).not.toEqual(fingerprint(selfOnly.generations[1]))

    // From generation 1 the self-only arm is retrained on its own data alone, its
    // measured model error crosses the threshold and never comes back under it.
    expect(selfOnly.errorCrossedAt).not.toBeNull()
    expect(selfOnly.errorCrossedAt as number).toBeGreaterThanOrEqual(1)
    expect(selfOnly.errorReturnedUnderAt).toBeNull()
    expect(selfOnly.finalError).toBeGreaterThan(DEFAULT_SELF_GENERATED_CONFIG.errorThreshold)
    expect(mixed.errorCrossedAt).toBeNull()
    expect(mixed.finalError).toBeLessThan(DEFAULT_SELF_GENERATED_CONFIG.errorThreshold)
    expect(selfOnly.finalError).toBeGreaterThan(mixed.finalError)
    expect(selfOnly.peakError).toBeGreaterThan(mixed.peakError)

    // The loop closes: every generation after the first is trained on transitions
    // the policy itself produced.
    expect(selfOnly.generations.slice(1).every((row) => row.selfSamples > 0)).toBe(true)
    expect(selfOnly.generations.slice(1).every((row) => row.dataOrigin === 'self-generated')).toBe(true)
    expect(selfOnly.meanSelfGeneratedShare).toBeGreaterThan(0.8)
    expect(mixed.meanSelfGeneratedShare).toBeLessThan(0.8)

    // Coverage is the mechanism: the demonstrations touch the whole state-action
    // space, the policy's own trajectories touch its own corridor.
    expect(selfOnly.initialCoverage).toBe(1)
    expect(selfOnly.finalCoverage).toBeLessThan(0.5)
    expect(mixed.finalCoverage).toBeGreaterThan(0.9)

    // The honest finding, in measured numbers: the self-only arm degrades, the mix does not.
    expect(selfOnly.degraded).toBe(true)
    expect(mixed.degraded).toBe(false)
    expect(selfOnly.finalSuccess).toBeLessThan(selfOnly.initialSuccess)
    expect(selfOnly.lowestSuccess).toBeLessThan(selfOnly.initialSuccess)
  })

  it('retrains each generation on the previous generation rollouts, transition for transition', () => {
    const config = DEFAULT_SELF_GENERATED_CONFIG
    const run = runSelfGeneratedLoop(config)
    for (const arm of run.arms) {
      for (let generation = 1; generation < config.generations; generation += 1) {
        const previous = arm.generations[generation - 1].policy
        const collected = collectSelfGeneratedTransitions(config.world, previous, {
          episodes: config.rolloutEpisodes,
          stepCap: config.stepCap,
          seed: config.seed + generation * 17,
        })
        const budget = Math.round(config.trainingSamples * (1 - arm.externalShareRequested))
        expect(arm.generations[generation].selfSamples).toBe(Math.min(collected.length, budget))
      }
    }
  })

  it('an empty demonstration pool makes the two arms literally the same arm', () => {
    const run = runSelfGeneratedLoop({ ...DEFAULT_SELF_GENERATED_CONFIG, demonstrationsPerPair: 0 })
    expect(run.poolSize).toBe(0)
    expect(run.mixed.generations.map(fingerprint)).toEqual(run.selfOnly.generations.map(fingerprint))
    expect(run.mixed.errorCrossedAt).toBe(run.selfOnly.errorCrossedAt)
    // Nothing was ever demonstrated: generation 0 has no data and no coverage.
    expect(run.selfOnly.generations[0].dataOrigin).toBe('no data')
    expect(run.selfOnly.generations[0].selfSamples).toBe(0)
    expect(run.selfOnly.generations[0].externalSamples).toBe(0)
    expect(run.selfOnly.generations[0].coverage).toBe(0)
    for (const row of run.selfOnly.generations) {
      expect(row.externalSamples).toBe(0)
      expect(row.dataOrigin === 'self-generated' || row.dataOrigin === 'no data').toBe(true)
    }
  })

  it('measures the self-generated share instead of assuming it', () => {
    const config = DEFAULT_SELF_GENERATED_CONFIG
    const run = runSelfGeneratedLoop(config)
    for (const arm of run.arms) {
      for (const row of arm.generations) {
        const total = row.selfSamples + row.externalSamples
        expect(row.selfGeneratedShare).toBe(total === 0 ? 0 : Math.round((row.selfSamples / total) * 1000) / 1000)
        if (row.generation === 0) {
          // Generation 0 is the demonstration bootstrap: no self data at all.
          expect(row.selfSamples).toBe(0)
          expect(row.externalSamples).toBe(run.poolSize)
        } else {
          expect(row.selfSamples).toBeLessThanOrEqual(Math.round(config.trainingSamples * (1 - arm.externalShareRequested)))
          expect(row.externalSamples).toBe(Math.min(run.poolSize, Math.round(config.trainingSamples * arm.externalShareRequested)))
        }
      }
    }
    expect(run.selfOnly.generations.at(-1)?.selfGeneratedShare).toBe(1)
    expect(run.mixed.generations.at(-1)?.selfGeneratedShare).toBeLessThan(1)
    expect(run.selfOnly.generations.at(-1)?.externalSamples).toBe(0)
    expect(run.mixed.generations.at(-1)?.externalSamples).toBeGreaterThan(0)
  })

  it('a bigger demonstration pool fits the bootstrapping generation better', () => {
    const thin = runSelfGeneratedLoop({ ...DEFAULT_SELF_GENERATED_CONFIG, demonstrationsPerPair: 2 })
    const generous = runSelfGeneratedLoop({ ...DEFAULT_SELF_GENERATED_CONFIG, demonstrationsPerPair: 10 })
    expect(generous.selfOnly.initialError).toBeLessThan(thin.selfOnly.initialError)
    expect(generous.mixed.initialError).toBeLessThan(thin.mixed.initialError)
    expect(generous.poolSize).toBeGreaterThan(thin.poolSize)

    // How much of the mix is external is what the external share knob buys.
    const mostlyExternal = runSelfGeneratedLoop({ ...DEFAULT_SELF_GENERATED_CONFIG, externalShare: 0.9 })
    const mostlySelf = runSelfGeneratedLoop({ ...DEFAULT_SELF_GENERATED_CONFIG, externalShare: 0.1 })
    expect(mostlyExternal.mixed.finalError).toBeLessThan(mostlySelf.mixed.finalError)
    expect(mostlyExternal.mixed.finalCoverage).toBeGreaterThan(mostlySelf.mixed.finalCoverage)
    expect(mostlyExternal.mixed.meanSelfGeneratedShare).toBeLessThan(mostlySelf.mixed.meanSelfGeneratedShare)
  })

  it('the fitted model normalises every pair it has seen, and the empty model is all fallback', () => {
    const config = DEFAULT_SELF_GENERATED_CONFIG
    const pool = buildDemonstrationPool(config.world, config.demonstrationsPerPair, config.seed + 77)
    const model = fitModel(config.world, pool, config.naivePriorMass)

    for (const pair of Object.values(model)) {
      const total = pair.outcomes.reduce((sum, outcome) => sum + outcome.probability, 0)
      expect(total).toBeCloseTo(1, 10)
      expect(pair.observations).toBeGreaterThan(0)
    }
    // The pool covers every decision cell and every action, once per requested repeat.
    expect(Object.keys(model).length).toBe(decisionCells(config.world).length * 4)
    for (const cell of decisionCells(config.world)) {
      for (let action = 0 as 0 | 1 | 2 | 3; action < 4; action = (action + 1) as 0 | 1 | 2 | 3) {
        expect(model[pairKey(cell, action)].observations).toBe(config.demonstrationsPerPair)
      }
    }

    const empty = fitModel(config.world, [], config.naivePriorMass)
    expect(Object.keys(empty)).toHaveLength(0)
  })

  it('the error metric reads the naive belief as wrong, and a true model as nearly flat', () => {
    const config = DEFAULT_SELF_GENERATED_CONFIG
    const probe = probeRealDynamics(config.world, config.probeSamplesPerPair, config.seed + 6161)
    expect(probe.pairs).toBe(decisionCells(config.world).length * 4)
    expect(probe.samples).toBe(probe.pairs * config.probeSamplesPerPair)
    for (const row of probe.rows) {
      expect(row.actual.reduce((sum, outcome) => sum + outcome.probability, 0)).toBeCloseTo(1, 10)
    }

    // Where nothing blocks the move, the naive belief is wrong by exactly the slip mass.
    const open: [number, number] = [0, 4]
    expect(divergence(naiveDynamics(config.world, open, 0), trueDynamics(config.world, open, 0))).toBeCloseTo(config.world.slip, 10)

    const naiveModel: LearnedModel = {}
    const trueModel: LearnedModel = {}
    for (const cell of decisionCells(config.world)) {
      for (let action = 0 as 0 | 1 | 2 | 3; action < 4; action = (action + 1) as 0 | 1 | 2 | 3) {
        naiveModel[pairKey(cell, action)] = { state: cell, action, observations: 0, outcomes: naiveDynamics(config.world, cell, action) }
        trueModel[pairKey(cell, action)] = { state: cell, action, observations: config.probeSamplesPerPair, outcomes: trueDynamics(config.world, cell, action) }
      }
    }
    const scoredNaive = scoreModelAgainstProbe(config.world, naiveModel, probe)
    const scoredTrue = scoreModelAgainstProbe(config.world, trueModel, probe)
    const run = runSelfGeneratedLoop(config)

    expect(scoredNaive.coverage).toBe(0)
    expect(scoredNaive.mean).toBeGreaterThan(0)
    // A model that is the true dynamics still carries the probe's own sampling noise,
    // and it must beat both the demonstration fit and the self-generated fit.
    expect(scoredTrue.mean).toBeLessThan(scoredNaive.mean)
    expect(scoredTrue.mean).toBeLessThan(run.selfOnly.generations[0].modelError)
    expect(scoredTrue.mean).toBeLessThan(run.selfOnly.finalError)
  })

  it('plans only inside the model it was given, so a worse model can misplace an action', () => {
    const config = DEFAULT_SELF_GENERATED_CONFIG
    const pool = buildDemonstrationPool(config.world, config.demonstrationsPerPair, config.seed + 77)
    const planned = planInsideModel(config.world, fitModel(config.world, pool, config.naivePriorMass), config.planningSweeps, config.discount)
    const naivePlan = planInsideModel(config.world, fitModel(config.world, [], config.naivePriorMass), config.planningSweeps, config.discount)

    expect(Object.keys(planned.policy)).toHaveLength(decisionCells(config.world).length)
    expect(planned.sweeps).toBe(config.planningSweeps)
    expect(Object.values(planned.policy).every((action) => action >= 0 && action < 4)).toBe(true)
    expect(naivePlan.policy).not.toEqual(planned.policy)
  })

  it('is deterministic for a fixed seed and reacts to the seed', () => {
    const first = runSelfGeneratedLoop(DEFAULT_SELF_GENERATED_CONFIG)
    const second = runSelfGeneratedLoop(DEFAULT_SELF_GENERATED_CONFIG)
    expect(second).toEqual(first)
    expect(second.selfOnly.generations).toEqual(first.selfOnly.generations)

    const other = runSelfGeneratedLoop({ ...DEFAULT_SELF_GENERATED_CONFIG, seed: 3 })
    expect(other.selfOnly.generations.map((row) => row.modelError)).not.toEqual(first.selfOnly.generations.map((row) => row.modelError))
    // Same pool recipe, different seed: same size, different transitions.
    expect(other.poolSize).toBe(first.poolSize)
    expect(buildDemonstrationPool(LOOP_WORLD, 1, 3)).not.toEqual(buildDemonstrationPool(LOOP_WORLD, 1, 4))
  })

  it('exposes the divergent pairs behind the mean, labelled by whether they were ever modelled', () => {
    const run = runSelfGeneratedLoop(DEFAULT_SELF_GENERATED_CONFIG)
    const last = run.selfOnly.generations.at(-1)
    expect(last).toBeDefined()
    expect(last?.worstDivergences.length).toBeGreaterThan(0)
    expect(last?.worstDivergences[0].divergence).toBeGreaterThan(0)
    for (const row of last?.worstDivergences ?? []) {
      expect(row.predicted.reduce((sum, outcome) => sum + outcome.probability, 0)).toBeCloseTo(1, 6)
      expect(row.actual.reduce((sum, outcome) => sum + outcome.probability, 0)).toBeCloseTo(1, 6)
      expect(row.source).toBe(row.observations > 0 ? 'learned' : 'naive fallback')
    }
    // The self-only arm leaves most pairs unmodelled, which is where its error sits.
    expect(last?.worstDivergences.filter((row) => row.source === 'naive fallback').length).toBeGreaterThan(0)
    expect(last?.worstDivergences[0].divergence).toBeGreaterThanOrEqual(last?.modelError ?? 0)
  })

  it('runs the loop in a world harsher than Lab C, where model error costs episodes', () => {
    expect(LOOP_WORLD.slip).toBeGreaterThan(DEFAULT_WORLD_MODEL_CONFIG.slip)
    // The threshold has to sit between what demonstrations achieve and what the
    // self-generated data achieves, or the crossing measures nothing.
    const run = runSelfGeneratedLoop(DEFAULT_SELF_GENERATED_CONFIG)
    expect(DEFAULT_SELF_GENERATED_CONFIG.errorThreshold).toBeGreaterThan(run.selfOnly.initialError)
    expect(DEFAULT_SELF_GENERATED_CONFIG.errorThreshold).toBeLessThan(run.selfOnly.peakError)
    expect(DEFAULT_SELF_GENERATED_CONFIG.errorThreshold).toBeGreaterThan(run.mixed.peakError)
  })
})
