import type { ComponentType } from 'react'
import { GradientLab, GRADIENT_VIEWS } from './GradientLab'
import { PpoLab, PPO_VIEWS } from './PpoLab'
import { GaeLab, GAE_VIEWS } from './GaeLab'
import { KlLab, KL_VIEWS } from './KlLab'
import { PipelineLab, PIPELINE_VIEWS } from './PipelineLab'
import { OveroptimisationLab, OVEROPTIMISATION_VIEWS } from './OveroptimisationLab'

/**
 * The screen for each registered laboratory id.
 *
 * A record rather than a chain of conditionals, so that the test over the registry can
 * ask one question — is there a screen for every id, and an id for every screen — and
 * answer it for all six at once.
 */
export const LAB_SCREENS: Record<string, ComponentType> = {
  gradient: GradientLab,
  ppo: PpoLab,
  gae: GaeLab,
  kl: KlLab,
  pipeline: PipelineLab,
  overoptimisation: OveroptimisationLab,
}

/**
 * The tabs each screen offers, read off the screen itself.
 *
 * A lesson deep-links to one of these by name, so this is the list the curriculum is
 * checked against: a lesson that asks for a view the screen does not have is a link that
 * would quietly open the wrong panel.
 */
export const LAB_VIEWS: Record<string, readonly { value: string; label: string }[]> = {
  gradient: GRADIENT_VIEWS,
  ppo: PPO_VIEWS,
  gae: GAE_VIEWS,
  kl: KL_VIEWS,
  pipeline: PIPELINE_VIEWS,
  overoptimisation: OVEROPTIMISATION_VIEWS,
}
