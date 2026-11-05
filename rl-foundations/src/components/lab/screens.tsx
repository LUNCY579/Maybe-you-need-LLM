import type { ComponentType } from 'react'
import { GridworldLab } from './GridworldLab'
import { PolicyGradientLab } from './PolicyGradientLab'
import { ReturnsLab } from './ReturnsLab'
import { ActorCriticLab } from './ActorCriticLab'

/** The screen for each id in the laboratory registry. */
export const LAB_SCREENS: Record<string, ComponentType> = {
  gridworld: GridworldLab,
  policygradient: PolicyGradientLab,
  returns: ReturnsLab,
  actorcritic: ActorCriticLab,
}

/**
 * The views each screen offers, in the order the control lists them.
 *
 * The curriculum names a view for every lesson, and a lesson that points at a
 * view the screen dropped would deep-link to nothing. This list is what that
 * check reads.
 */
export const LAB_VIEWS: Record<string, string[]> = {
  gridworld: ['world', 'value', 'optimal'],
  policygradient: ['derivation', 'estimator', 'baseline'],
  returns: ['nstep', 'lambda', 'weighting'],
  actorcritic: ['loop'],
}
