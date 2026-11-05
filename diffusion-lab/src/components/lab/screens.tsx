import type { ComponentType } from 'react'
import { ForwardLab } from './ForwardLab'
import { ReverseLab } from './ReverseLab'
import { SchedulesLab } from './SchedulesLab'
import { LatentLab } from './LatentLab'
import { GuidanceLab } from './GuidanceLab'
import { VariationalLab } from './VariationalLab'
import { PreconditioningLab } from './PreconditioningLab'

/**
 * The screen for each laboratory id.
 *
 * Held beside the registry so a test can compare the two lists: a laboratory
 * with no screen and a screen with no laboratory are both mistakes the
 * navigation would otherwise hide.
 */
export const LAB_SCREENS: Record<string, ComponentType> = {
  forward: ForwardLab,
  reverse: ReverseLab,
  schedules: SchedulesLab,
  latent: LatentLab,
  guidance: GuidanceLab,
  variational: VariationalLab,
  preconditioning: PreconditioningLab,
}
