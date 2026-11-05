import type { ComponentType } from 'react'
import { SuperpositionLab, SUPERPOSITION_VIEWS } from './SuperpositionLab'
import { AutoencoderLab, AUTOENCODER_VIEWS } from './AutoencoderLab'
import { PatchingLab, PATCHING_VIEWS } from './PatchingLab'
import { AttentionLab, ATTENTION_VIEWS } from './AttentionLab'
import { InductionLab, INDUCTION_VIEWS } from './InductionLab'
import { CircuitLab, CIRCUIT_VIEWS } from './CircuitLab'
import { IoiLab, IOI_VIEWS } from './IoiLab'

/**
 * The screen for each registered laboratory id.
 *
 * A record rather than a chain of conditionals, so that the test over the registry
 * can ask one question — is there a screen for every id, and an id for every screen —
 * and answer it for all seven at once.
 */
export const LAB_SCREENS: Record<string, ComponentType> = {
  superposition: SuperpositionLab,
  autoencoder: AutoencoderLab,
  patching: PatchingLab,
  attention: AttentionLab,
  induction: InductionLab,
  circuit: CircuitLab,
  ioi: IoiLab,
}

/**
 * The tabs each screen offers, read off the screen itself.
 *
 * A lesson deep-links to one of these by name, so this is the list the curriculum
 * is checked against: a lesson that asks for a view the screen does not have is a
 * link that would quietly open the wrong panel.
 */
export const LAB_VIEWS: Record<string, readonly { value: string; label: string }[]> = {
  superposition: SUPERPOSITION_VIEWS,
  autoencoder: AUTOENCODER_VIEWS,
  patching: PATCHING_VIEWS,
  attention: ATTENTION_VIEWS,
  induction: INDUCTION_VIEWS,
  circuit: CIRCUIT_VIEWS,
  ioi: IOI_VIEWS,
}
