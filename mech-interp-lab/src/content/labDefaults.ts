/**
 * The scenario each laboratory runs by default.
 *
 * A laboratory exists in two places: the browser, where the sliders start here, and
 * the terminal, where `tools/run-lab.mjs` prints the same numbers without a page to
 * open. That claim is only checkable if both read one list, so the defaults live here
 * rather than inside a `useState` call — and the runner's output is a reproduction of
 * the screen rather than a second opinion about it.
 *
 * These are the *starting* settings. Every screen lets a reader move them; nothing
 * here is a result.
 */

import type { InductionVariant } from '../core/induction'
import type { CorruptionSite } from '../core/inductionModel'

export interface SuperpositionScenario {
  featureCount: number
  dimensions: number
  importanceExponent: number
  seed: number
}

export interface AutoencoderScenario {
  featureCount: number
  dimensions: number
  /** The seed of the toy model whose activations the dictionary is fitted on. */
  streamSeed: number
  dictionarySize: number
  steps: number
  learningRate: number
  sparsity: number
  seed: number
  /** The splitting tab: two ground-truth features in a plane. */
  angle: number
  rare: number
  lambda: number
  splittingDictionary: number
  runs: number
}

export interface PatchingScenario {
  input: number
}

export interface AttentionScenario {
  headIndex: number
  targetIndex: number
}

export interface InductionScenario {
  block: number
  repeats: number
  temperature: number
  variant: InductionVariant
  seed: number
  selected: number
}

export interface CircuitScenario {
  targetIndex: number
  replacement: number
  threshold: number
  site: CorruptionSite
}

export type IoiPrompt = 'paper' | 'mirror'

export interface IoiScenario {
  prompt: IoiPrompt
}

export const SUPERPOSITION_DEFAULTS: SuperpositionScenario = {
  featureCount: 12,
  dimensions: 4,
  importanceExponent: 2,
  seed: 5,
}

export const AUTOENCODER_DEFAULTS: AutoencoderScenario = {
  featureCount: 8,
  dimensions: 6,
  streamSeed: 11,
  dictionarySize: 24,
  steps: 900,
  learningRate: 0.05,
  sparsity: 0.05,
  seed: 3,
  angle: 45,
  rare: 1,
  lambda: 0.04,
  splittingDictionary: 8,
  runs: 8,
}

export const PATCHING_DEFAULTS: PatchingScenario = { input: 4 }

export const ATTENTION_DEFAULTS: AttentionScenario = { headIndex: 2, targetIndex: 0 }

export const INDUCTION_DEFAULTS: InductionScenario = {
  block: 6,
  repeats: 2,
  temperature: 0.2,
  variant: 'composed',
  seed: 4,
  selected: 6,
}

export const CIRCUIT_DEFAULTS: CircuitScenario = { targetIndex: 0, replacement: 5, threshold: 0.9, site: 'occurrence' }

export const IOI_DEFAULTS: IoiScenario = { prompt: 'paper' }

/** Keyed by the laboratory id, so the runner can look a scenario up by the same name as the route. */
export const LAB_DEFAULTS: Record<string, object> = {
  superposition: SUPERPOSITION_DEFAULTS,
  autoencoder: AUTOENCODER_DEFAULTS,
  patching: PATCHING_DEFAULTS,
  attention: ATTENTION_DEFAULTS,
  induction: INDUCTION_DEFAULTS,
  circuit: CIRCUIT_DEFAULTS,
  ioi: IOI_DEFAULTS,
}
