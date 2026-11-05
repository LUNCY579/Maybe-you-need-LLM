import { describe, expect, it } from 'vitest'
import {
  PATCH_SCENARIOS,
  PATCH_SCENARIO_BY_ID,
  layerStates,
  patch,
  probe,
  signalsFor,
  type PatchScenario,
} from './patching'

const capital = PATCH_SCENARIO_BY_ID.get('capital') as PatchScenario
const tool = PATCH_SCENARIO_BY_ID.get('tool') as PatchScenario

describe('the activation-patching demonstration', () => {
  it('carries no signal before the decision is made', () => {
    const signals = signalsFor(capital, 'a')
    for (let layer = 0; layer < capital.decisionLayer; layer += 1) {
      expect(signals[layer]).toBe(0)
    }
    expect(signals[capital.decisionLayer]).toBe(1)
  })

  it('decays the signal as it is carried forward', () => {
    const signals = signalsFor(capital, 'a')
    for (let layer = capital.decisionLayer + 1; layer < capital.layers; layer += 1) {
      expect(signals[layer]).toBeLessThan(signals[layer - 1])
      expect(signals[layer]).toBeGreaterThan(0)
    }
  })

  it('leaves the logit lens undecided before the decision', () => {
    const states = layerStates(capital, 'a')
    for (const state of states) {
      if (state.layer < capital.decisionLayer) {
        expect(state.readout).toBe('undecided')
      }
    }
    expect(states[capital.decisionLayer].readout).toBe('a')
  })

  it('finds a weak correlation with the prompt at every layer', () => {
    // The trap: the probe detects the concept everywhere, weakly.
    const lenient = probe(capital, 5)
    expect(lenient.every((result) => result.detected)).toBe(true)
    for (const result of lenient) {
      expect(result.confidence).toBeLessThan(25)
    }
  })

  it('detects nothing at a strict threshold', () => {
    const strict = probe(capital, 20)
    expect(strict.some((result) => result.detected)).toBe(false)
  })

  it('transfers the behaviour when the decision layer is patched', () => {
    const outcome = patch(capital, 'a', 'b', capital.decisionLayer)
    expect(outcome.changed).toBe(true)
    expect(outcome.answer).toBe(capital.runs.a.answer)
    expect(outcome.explanation).toMatch(/caused the behaviour/i)
  })

  it('changes nothing when a layer before the decision is patched', () => {
    for (let layer = 0; layer < capital.decisionLayer; layer += 1) {
      const outcome = patch(capital, 'a', 'b', layer)
      expect(outcome.changed, `patching layer ${layer} changed the answer`).toBe(false)
    }
  })

  it('changes nothing when the other run is patched into itself', () => {
    const outcome = patch(capital, 'b', 'b', capital.decisionLayer)
    expect(outcome.changed).toBe(false)
    expect(outcome.answer).toBe(capital.runs.b.answer)
  })

  it('localises the decision to a layer rather than to one layer only', () => {
    // Patching any layer from the decision onwards transfers the behaviour,
    // because the information is still there. This is the usual finding, and
    // it is why "the earliest layer that carries it" is the right claim.
    for (let layer = capital.decisionLayer; layer < capital.layers; layer += 1) {
      const outcome = patch(capital, 'a', 'b', layer)
      expect(outcome.changed, `patching layer ${layer} did not transfer`).toBe(true)
    }
  })

  it('finds the decision in the second scenario too', () => {
    const outcome = patch(tool, 'b', 'a', tool.decisionLayer)
    expect(outcome.changed).toBe(true)
    expect(outcome.answer).toBe(tool.runs.b.answer)

    const before = patch(tool, 'b', 'a', tool.decisionLayer - 1)
    expect(before.changed).toBe(false)
  })

  it('is deterministic', () => {
    expect(patch(capital, 'a', 'b', 4)).toEqual(patch(capital, 'a', 'b', 4))
    expect(probe(capital, 10)).toEqual(probe(capital, 10))
  })

  it('gives every scenario a decision layer inside the network', () => {
    for (const scenario of PATCH_SCENARIOS) {
      expect(scenario.decisionLayer).toBeGreaterThan(0)
      expect(scenario.decisionLayer).toBeLessThan(scenario.layers)
      expect(scenario.decay).toBeGreaterThan(0)
      expect(scenario.decay).toBeLessThan(1)
      expect(scenario.shadow.a.length).toBe(scenario.layers)
      expect(scenario.noise.b.length).toBe(scenario.layers)
      expect(scenario.runs.a.answer).not.toBe(scenario.runs.b.answer)
    }
  })
})
